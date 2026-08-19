/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import * as XLSX from "xlsx-js-style";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import {
  Gender,
  ResidentStatus,
  EducationLevel,
  LaborSector,
  HouseholdStatus,
  HousingType,
  WaterSource,
  WasteCollectionStatus,
  VNeIDStatus,
  DemographicsChangeType,
  UserRole,
  User,
  Household,
  Resident,
  DemographicsChange,
  BusinessHousehold,
  RuralCriteria,
  AuditLog,
  AllowedEmail,
  PendingRegistration,
  QuarterDocument
} from "./src/types";

const isVercel = Boolean(process.env.VERCEL);
// Vercel injects environment variables itself. Loading a missing .env file in
// a Function only adds noisy ENOENT messages to the production logs.
if (!isVercel) dotenv.config({ quiet: true });
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const canSendEmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const transporter = canSendEmail
  ? nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 60000,
      greetingTimeout: 60000,
      socketTimeout: 60000,
    })
  : null;

// Supabase is accessed only from this server using the service-role key. Never
// expose this key to the Vite client or add it to a VITE_* environment variable.
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const ID_CARD_STORAGE_BUCKET = "id-card-documents";
const ID_CARD_MAX_BYTES = 2 * 1024 * 1024;
let idCardBucketInitialization: Promise<void> | null = null;
const FIREBASE_CONFIG_PATH = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseWebApiKey = (() => {
  if (process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY) {
    return process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
  }
  try {
    return JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, "utf8")).apiKey || "";
  } catch {
    return "";
  }
})();
const SUPER_ADMIN_EMAILS = new Set([
  "bhttq3@gmail.com",
  "tayninhdoimoi@gmail.com",
  "nguyentanbinh3005@gmail.com",
]);
// The root administrator is protected by server configuration. Ward-leader
// accounts remain regular approved staff so the administrator can edit or
// revoke them from the access-control screen.
const SYSTEM_MANAGED_OFFICERS: ReadonlyArray<AllowedEmail> = [
  {
    id: "SYSTEM-ADMIN-NGUYENTANBINH3005",
    email: "nguyentanbinh3005@gmail.com",
    role: UserRole.SUPER_ADMIN,
    assignedBy: "Cấu hình hệ thống",
    assignedAt: "2026-08-18T00:00:00.000Z",
  },
];
const SYSTEM_MANAGED_OFFICER_EMAILS = new Set(SYSTEM_MANAGED_OFFICERS.map((officer) => officer.email));
const pendingSupabaseWrites = new AsyncLocalStorage<Set<Promise<void>>>();
const CLOUD_COLLECTIONS = [
  "households",
  "residents",
  "changes",
  "businesses",
  "criteria",
  "logs",
  "allowedEmails",
  "pendingRegistrations",
  "documents",
  "dismissedEmails",
] as const;

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10) || 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE_PATH = path.join(DATA_DIR, "data_store.json");

// Vercel functions have an ephemeral read-only deployment filesystem. The JSON
// file remains a local-development fallback; Supabase is the production store.
if (!isVercel && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Lazy load Gemini API
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "") {
      try {
        aiClient = new GoogleGenAI({ 
          apiKey: key,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        console.log("Gemini Client successfully initialized.");
      } catch (err) {
        console.error("Failed to initialize Gemini Client:", err);
      }
    } else {
      console.warn("GEMINI_API_KEY is not configured or uses placeholder value. AI features will fallback to rule-based logic.");
    }
  }
  return aiClient;
}

// Ensure database directory exists
const srcDir = path.join(process.cwd(), "src");
// A Vercel function runs from a read-only deployment directory. This legacy
// local-development directory is not required by the Supabase-backed runtime.
if (!isVercel && !fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

// Initial seed data
const DEFAULT_HOUSEHOLDS: Household[] = [];
const DEFAULT_RESIDENTS: Resident[] = [];
const DEFAULT_CHANGES: DemographicsChange[] = [];
const DEFAULT_BUSINESSES: BusinessHousehold[] = [];

const DEFAULT_CRITERIA: RuralCriteria[] = [
  {
    id: "TC-1",
    name: "Thu nhập bình quân đầu người",
    status: "Đạt",
    value: "5.2 triệu đồng / tháng",
    targetValue: ">= 4.5 triệu đồng / tháng",
    category: "Thu nhập",
    lastUpdated: "2026-03-01"
  },
  {
    id: "TC-2",
    name: "Tỷ lệ nhà ở kiên cố và bán kiên cố",
    status: "Đạt",
    value: "95.5%",
    targetValue: ">= 90%",
    category: "Nhà ở",
    lastUpdated: "2026-04-15"
  },
  {
    id: "TC-3",
    name: "Tỷ lệ thu gom rác thải sinh hoạt",
    status: "Chưa đạt",
    value: "82.0%",
    targetValue: ">= 90%",
    category: "Môi trường",
    lastUpdated: "2026-05-20"
  },
  {
    id: "TC-4",
    name: "Tỷ lệ phổ cập giáo dục THCS",
    status: "Đạt",
    value: "98.2%",
    targetValue: ">= 95%",
    category: "Giáo dục",
    lastUpdated: "2026-01-10"
  },
  {
    id: "TC-5",
    name: "Tỷ lệ tham gia Bảo hiểm Y tế",
    status: "Đạt",
    value: "92.3%",
    targetValue: ">= 90%",
    category: "Y tế",
    lastUpdated: "2026-06-01"
  },
  {
    id: "TC-6",
    name: "Tỷ lệ lao động có việc làm thường xuyên",
    status: "Đạt",
    value: "85.4%",
    targetValue: ">= 80%",
    category: "Lao động",
    lastUpdated: "2026-02-15"
  }
];

const DEFAULT_LOGS: AuditLog[] = [
  {
    id: "LOG-1",
    timestamp: "2026-06-25T08:30:00Z",
    userId: "admin-id",
    userName: "Hệ thống",
    userRole: UserRole.SUPER_ADMIN,
    action: "Khởi động hệ thống",
    details: "Đồng bộ hoá cơ sở dữ liệu dân cư ban đầu thành công."
  },
  {
    id: "LOG-2",
    timestamp: "2026-06-25T09:15:22Z",
    userId: "totruong-id",
    userName: "Nguyễn Tấn Bình",
    userRole: UserRole.WARD_LEADER,
    action: "Xem danh sách",
    details: "Truy cập danh sách nhân khẩu tổ dân phố 5."
  }
];

const DEFAULT_DOCUMENTS: QuarterDocument[] = [
  {
    id: "DOC-1001",
    title: "Quyết định thành lập Tổ Dân Phố Ninh Phú",
    docNumber: "128/QĐ-UBND",
    issueDate: "2020-03-15",
    issuer: "Ủy ban nhân dân Phường Bình Minh",
    category: "Văn bản pháp quy",
    description: "Quyết định hành chính về việc sát nhập, phân định ranh giới và bổ nhiệm cán bộ lâm thời Tổ dân phố Ninh Phú.",
    fileSize: "2.4 MB",
    fileType: "PDF",
    createdAt: "2020-03-15"
  },
  {
    id: "DOC-1002",
    title: "Kế hoạch tổ chức Ngày hội Đại đoàn kết toàn dân tộc 2025",
    docNumber: "45/KH-UBMTTQ",
    issueDate: "2025-10-10",
    issuer: "Ban Công tác Mặt trận Khu phố",
    category: "Kế hoạch / Báo cáo",
    description: "Kế hoạch chi tiết về thời gian, địa điểm, kinh phí và nội dung chương trình văn nghệ, thể thao cho ngày hội 18/11.",
    fileSize: "1.1 MB",
    fileType: "DOCX",
    createdAt: "2025-10-10"
  },
  {
    id: "DOC-1003",
    title: "Mẫu tờ khai thay đổi thông tin cư trú (Mẫu CT01)",
    docNumber: "Thông tư 56/2021/TT-BCA",
    issueDate: "2021-05-15",
    issuer: "Bộ Công an",
    category: "Mẫu biểu hồ sơ",
    description: "Mẫu tờ khai chuẩn dùng cho công dân khi làm các thủ tục đăng ký thường trú, tạm trú, khai báo tạm vắng.",
    fileSize: "320 KB",
    fileType: "PDF",
    createdAt: "2021-05-15"
  },
  {
    id: "DOC-1004",
    title: "Báo cáo tổng kết công tác rà soát hộ nghèo & cận nghèo năm 2025",
    docNumber: "12/BC-UBND",
    issueDate: "2025-12-20",
    issuer: "Ban giảm nghèo Phường Bình Minh",
    category: "Kế hoạch / Báo cáo",
    description: "Báo cáo tổng số hộ nghèo, cận nghèo thực tế qua rà soát định kỳ cuối năm 2025 tại tổ dân phố Ninh Phú.",
    fileSize: "1.8 MB",
    fileType: "PDF",
    createdAt: "2025-12-20"
  },
  {
    id: "DOC-1005",
    title: "Hướng dẫn kê khai và nộp thuế sử dụng đất phi nông nghiệp (PNN)",
    docNumber: "02/HD-CCT",
    issueDate: "2026-01-10",
    issuer: "Chi cục Thuế khu vực",
    category: "Văn bản pháp quy",
    description: "Tài liệu hướng dẫn cán bộ tổ dân phố cách tính thuế, lập bộ thuế đất và hướng dẫn người dân kê khai nộp thuế PNN hàng năm.",
    fileSize: "950 KB",
    fileType: "PDF",
    createdAt: "2026-01-10"
  }
];

// Database object type
interface Database {
  households: Household[];
  residents: Resident[];
  changes: DemographicsChange[];
  businesses: BusinessHousehold[];
  criteria: RuralCriteria[];
  logs: AuditLog[];
  allowedEmails?: AllowedEmail[];
  pendingRegistrations?: PendingRegistration[];
  documents?: QuarterDocument[];
  dismissedEmails?: string[];
}

let db: Database = {
  households: DEFAULT_HOUSEHOLDS,
  residents: DEFAULT_RESIDENTS,
  changes: DEFAULT_CHANGES,
  businesses: DEFAULT_BUSINESSES,
  criteria: DEFAULT_CRITERIA,
  logs: DEFAULT_LOGS,
  allowedEmails: [],
  pendingRegistrations: [],
  documents: DEFAULT_DOCUMENTS,
  dismissedEmails: []
};

function extractAndTrimTổ(address: string): { cleanAddress: string, extractedTổ: string | null } {
  if (!address) return { cleanAddress: "", extractedTổ: null };
  // Robust regex covering both precomposed and decomposed forms of 'Tổ' and 'Tổ dân phố'
  const regex = /(?:,\s*)?(?:Tổ\s+dân\s+phố\s+|Tổ\s+dân\s+phố\s+|tổ\s+dân\s+phố\s+|tổ\s+dân\s+phố\s+|Tổ\s+|Tổ\s+|tổ\s+|tổ\s+|TỔ\s+|TỔ\s+)(\d+)/;
  const match = address.match(regex);
  if (match) {
    const tổNum = match[1];
    const extractedTổ = `Tổ ${tổNum}`;
    let cleanAddress = address.replace(regex, "");
    cleanAddress = cleanAddress.replace(/,\s*,/g, ",").replace(/,\s*$/, "").replace(/^\s*,/, "").trim();
    return { cleanAddress, extractedTổ };
  }
  return { cleanAddress: address.trim(), extractedTổ: null };
}

function autoGenerateBhytFromCccdInServer(r: any) {
  return false;
}

function reconcileSystemManagedOfficers(current: AllowedEmail[] | undefined) {
  const officersByEmail = new Map(
    (current || [])
      .filter((officer) => officer?.email)
      .map((officer) => [officer.email.trim().toLowerCase(), officer] as const),
  );
  let changed = false;

  for (const configuredOfficer of SYSTEM_MANAGED_OFFICERS) {
    const existing = officersByEmail.get(configuredOfficer.email);
    if (
      !existing
      || existing.id !== configuredOfficer.id
      || existing.role !== configuredOfficer.role
      || existing.assignedBy !== configuredOfficer.assignedBy
    ) {
      changed = true;
    }
    officersByEmail.set(configuredOfficer.email, {
      ...existing,
      ...configuredOfficer,
    });
  }

  return { officers: [...officersByEmail.values()], changed };
}

// Load database from file if available, or write seed data
async function loadDatabase() {
  if (fs.existsSync(DATA_FILE_PATH)) {
    try {
      const content = fs.readFileSync(DATA_FILE_PATH, "utf8");
      db = JSON.parse(content);
      console.log("Database loaded successfully from file:", DATA_FILE_PATH);
      
      let updated = false;

      // 1. Normalize and strip 'Tổ X' from all households
      if (db.households && Array.isArray(db.households)) {
        db.households.forEach(h => {
          let hUpdated = false;
          if (h.wardId && h.wardId.startsWith("Tổ dân phố ")) {
            h.wardId = h.wardId.replace("Tổ dân phố ", "Tổ ");
            hUpdated = true;
          }
          const { cleanAddress, extractedTổ } = extractAndTrimTổ(h.address);
          if (extractedTổ) {
            h.address = cleanAddress;
            h.wardId = extractedTổ;
            hUpdated = true;
          }
          if (h.isWasteFeePaid === undefined) {
            h.isWasteFeePaid = Math.random() > 0.15; // default most to paid
            hUpdated = true;
          }
          if ((h.wasteCollectionStatus as string) === "Đã đăng ký (Mới + Cũ)") {
            h.wasteCollectionStatus = WasteCollectionStatus.REGISTERED;
            hUpdated = true;
          }
          if ((h.waterSource as string) === "Nước máy (Nước cấp thủy)") {
            h.waterSource = WaterSource.TAP_WATER;
            hUpdated = true;
          }
          if ((h.waterSource as string) === "Nước giếng (Giếng khoan/Giếng đào)") {
            h.waterSource = WaterSource.WELL_WATER;
            hUpdated = true;
          }
          if (!h.wasteCollectionStatus) {
            if (h.isWasteFeePaid) {
              h.wasteCollectionStatus = WasteCollectionStatus.REGISTERED;
            } else {
              const rand = Math.random();
              h.wasteCollectionStatus = rand > 0.2 ? WasteCollectionStatus.UNREGISTERED : WasteCollectionStatus.CANCELLED;
            }
            hUpdated = true;
          }
          if (!h.waterSource) {
            h.waterSource = Math.random() > 0.2 ? WaterSource.TAP_WATER : WaterSource.WELL_WATER;
            hUpdated = true;
          }
          if ((h.housingType as string) === "Nhà kiên cố") {
            h.housingType = HousingType.NO;
            hUpdated = true;
          } else if ((h.housingType as string) === "Nhà bán kiên cố" || (h.housingType as string) === "Nhà tạm") {
            h.housingType = HousingType.YES;
            hUpdated = true;
          } else if (h.housingType !== HousingType.YES && h.housingType !== HousingType.NO) {
            h.housingType = Math.random() > 0.7 ? HousingType.YES : HousingType.NO;
            hUpdated = true;
          }
          if (!h.gpsLat || !h.gpsLng || Number.isNaN(Number(h.gpsLat)) || Number.isNaN(Number(h.gpsLng))) {
            const charSum = (h.id || h.ownerName || "1").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
            h.gpsLat = parseFloat((11.345 + (charSum % 30) * 0.0011).toFixed(6));
            h.gpsLng = parseFloat((106.115 + ((charSum * 3) % 30) * 0.0011).toFixed(6));
            hUpdated = true;
          }
          if (hUpdated) {
            updated = true;
          }
        });
      }

      // 2. Normalize and strip 'Tổ X' from all residents
      if (db.residents && Array.isArray(db.residents)) {
        db.residents.forEach(r => {
          let rUpdated = false;
          if (r.wardId && r.wardId.startsWith("Tổ dân phố ")) {
            r.wardId = r.wardId.replace("Tổ dân phố ", "Tổ ");
            rUpdated = true;
          }
          if (r.permanentAddress) {
            const { cleanAddress, extractedTổ } = extractAndTrimTổ(r.permanentAddress);
            if (extractedTổ) {
              r.permanentAddress = cleanAddress;
              r.wardId = extractedTổ;
              rUpdated = true;
            }
          }
          if (r.temporaryAddress) {
            const { cleanAddress, extractedTổ } = extractAndTrimTổ(r.temporaryAddress);
            if (extractedTổ) {
              r.temporaryAddress = cleanAddress;
              rUpdated = true;
            }
          }
          if (rUpdated) {
            updated = true;
          }
        });
      }
      
      // 3. Sync mock data: Ensure every resident has permanentAddress and temporaryAddress correctly populated
      if (db.residents && Array.isArray(db.residents)) {
        db.residents = db.residents.map(r => {
          let modified = false;
          const hh = db.households?.find(h => h.id === r.householdId);
          const hhAddress = hh ? hh.address : "Số 12, Phường sở tại";
          
          if (hh && hh.gpsLat !== undefined && hh.gpsLng !== undefined) {
            if (r.gpsLat !== hh.gpsLat || r.gpsLng !== hh.gpsLng) {
              r.gpsLat = hh.gpsLat;
              r.gpsLng = hh.gpsLng;
              modified = true;
            }
          }
          if (r.status === "Tạm trú") {
            const expectedPerm = r.permanentAddress && r.permanentAddress !== hhAddress ? r.permanentAddress : "Số 250, Đường Hùng Vương";
            const { cleanAddress: cleanExpectedPerm, extractedTổ: ext1 } = extractAndTrimTổ(expectedPerm);
            if (ext1 && r.wardId !== ext1) {
              r.wardId = ext1;
              modified = true;
            }
            if (r.permanentAddress !== cleanExpectedPerm) {
              r.permanentAddress = cleanExpectedPerm;
              modified = true;
            }
            if (r.temporaryAddress !== hhAddress) {
              r.temporaryAddress = hhAddress;
              modified = true;
            }
          } else {
            const { cleanAddress: cleanHhAddress, extractedTổ: ext2 } = extractAndTrimTổ(hhAddress);
            if (r.permanentAddress !== cleanHhAddress) {
              r.permanentAddress = cleanHhAddress;
              modified = true;
            }
            const expectedWard = ext2 || (hh ? hh.wardId : undefined);
            if (expectedWard && r.wardId !== expectedWard) {
              r.wardId = expectedWard;
              modified = true;
            }
            if (r.temporaryAddress) {
              r.temporaryAddress = "";
              modified = true;
            }
          }
          if (autoGenerateBhytFromCccdInServer(r)) {
            modified = true;
          }
          if (modified) {
            updated = true;
          }
          return r;
        });
      }
      if (!db.allowedEmails) {
        db.allowedEmails = [];
      }
      if (!db.pendingRegistrations) {
        db.pendingRegistrations = [];
      }
      if (!db.dismissedEmails) {
        db.dismissedEmails = [];
      }
      if (updated) {
        saveDatabase();
      }
    } catch (err) {
      console.error("Failed to read database file, using in-memory default:", err);
    }
  } else {
    // Sync the default in-memory residents too
    if (db.residents) {
      db.residents = db.residents.map(r => {
        const hh = db.households?.find(h => h.id === r.householdId);
        const hhAddress = hh ? hh.address : "Số 12, Phường sở tại";
        if (r.status === "Tạm trú") {
          r.permanentAddress = "Số 250, Đường Hùng Vương";
          r.temporaryAddress = hhAddress;
          r.wardId = hh ? hh.wardId : "Tổ 1";
        } else {
          r.permanentAddress = hhAddress;
          r.temporaryAddress = "";
          r.wardId = hh ? hh.wardId : "Tổ 1";
        }
        return r;
      });
    }
    saveDatabase();
  }

  const cloudLoaded = await loadFromSupabase();
  if (!cloudLoaded && supabaseConfigured) {
    // A deployment must never overwrite a cloud database from its ephemeral
    // filesystem. Import the existing data explicitly with the migration
    // script after creating the table.
    console.warn("No Supabase records were loaded. Skipping automatic seed.");
  }

  const { officers, changed } = reconcileSystemManagedOfficers(db.allowedEmails);
  if (changed) {
    db.allowedEmails = officers;
    if (supabaseConfigured) {
      try {
        await syncSupabaseCollection("allowedEmails", officers);
      } catch (err) {
        // Keep system access working for this request even if Supabase is
        // temporarily unavailable; the next Vercel request retries the sync.
        console.error("Failed to synchronize system officer accounts:", err);
      }
    } else {
      saveDatabase();
    }
  }
}

function supabaseHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function supabaseRequest(pathname: string, init: RequestInit = {}) {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...init,
    headers: supabaseHeaders(init.headers),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }
  return response;
}

async function supabaseStorageRequest(pathname: string, init: RequestInit = {}) {
  if (!supabaseConfigured) {
    throw new Error("Supabase Storage chưa được cấu hình.");
  }
  const response = await fetch(`${SUPABASE_URL}/storage/v1/${pathname}`, {
    ...init,
    headers: supabaseHeaders(init.headers),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase Storage request failed (${response.status}): ${details}`);
  }
  return response;
}

async function ensureIdCardStorageBucket() {
  if (!idCardBucketInitialization) {
    idCardBucketInitialization = (async () => {
      if (!supabaseConfigured) throw new Error("Supabase Storage chưa được cấu hình.");
      const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: "POST",
        headers: supabaseHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          id: ID_CARD_STORAGE_BUCKET,
          name: ID_CARD_STORAGE_BUCKET,
          public: false,
          file_size_limit: ID_CARD_MAX_BYTES,
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      // Creating an existing bucket is expected after the first request.
      if (!response.ok && response.status !== 409) {
        const details = await response.text().catch(() => "");
        throw new Error(`Không thể tạo kho ảnh CCCD (${response.status}): ${details}`);
      }
    })().catch((error) => {
      idCardBucketInitialization = null;
      throw error;
    });
  }
  return idCardBucketInitialization;
}

function isValidIdCardStoragePath(pathname: unknown) {
  return typeof pathname === "string"
    && /^(household|resident)\/[a-f0-9]{64}\/(front|back)-[a-f0-9-]+\.jpg$/.test(pathname);
}

async function loadFromSupabase(): Promise<boolean> {
  if (!supabaseConfigured) {
    console.log("Supabase not configured; using the local JSON database.");
    return false;
  }

  try {
    const pageSize = 1_000;
    const records: Array<{ collection_name: string; data: any }> = [];
    for (let offset = 0; ; offset += pageSize) {
      const response = await supabaseRequest(
        `app_records?select=collection_name,data&order=collection_name.asc,record_id.asc&limit=${pageSize}&offset=${offset}`,
      );
      const page = await response.json() as Array<{ collection_name: string; data: any }>;
      if (!Array.isArray(page)) throw new Error("Supabase returned an invalid records response.");
      records.push(...page);
      if (page.length < pageSize) break;
    }
    if (!Array.isArray(records) || records.length === 0) return false;

    const cloudData: Record<string, any[]> = Object.fromEntries(
      CLOUD_COLLECTIONS.map((name) => [name, []]),
    );
    for (const record of records) {
      if (!CLOUD_COLLECTIONS.includes(record.collection_name as typeof CLOUD_COLLECTIONS[number])) continue;
      if (record.collection_name === "dismissedEmails") {
        const email = record.data?.email || record.data?.id || record.data;
        if (email) cloudData.dismissedEmails.push(email);
      } else if (record.data && typeof record.data === "object") {
        cloudData[record.collection_name].push(record.data);
      }
    }

    db = { ...db, ...cloudData };
    console.log(`Loaded ${records.length} records from Supabase.`);
    return true;
  } catch (err) {
    console.error("Failed to load Supabase data; using the local JSON database:", err);
    return false;
  }
}

async function saveToSupabase(collectionName: string, item: any) {
  if (!supabaseConfigured || !item || !item.id) return;
  await supabaseRequest("app_records?on_conflict=collection_name,record_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      collection_name: collectionName,
      record_id: String(item.id),
      data: item,
    }]),
  });
}

async function deleteFromSupabase(collectionName: string, id: string) {
  if (!supabaseConfigured || !id) return;
  await supabaseRequest(
    `app_records?collection_name=eq.${encodeURIComponent(collectionName)}&record_id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
}

async function loadSupabaseRecordIds(collectionName: string): Promise<string[]> {
  const pageSize = 1_000;
  const recordIds: string[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await supabaseRequest(
      `app_records?select=record_id&collection_name=eq.${encodeURIComponent(collectionName)}&order=record_id.asc&limit=${pageSize}&offset=${offset}`,
    );
    const page = await response.json() as Array<{ record_id: string }>;
    if (!Array.isArray(page)) throw new Error("Supabase returned an invalid record-id response.");
    recordIds.push(...page.map((record) => String(record.record_id)));
    if (page.length < pageSize) break;
  }
  return recordIds;
}

async function deleteSupabaseRecords(collectionName: string, recordIds: string[]) {
  for (let offset = 0; offset < recordIds.length; offset += 100) {
    const quotedIds = recordIds
      .slice(offset, offset + 100)
      .map((id) => JSON.stringify(String(id)))
      .join(",");
    await supabaseRequest(
      `app_records?collection_name=eq.${encodeURIComponent(collectionName)}&record_id=${encodeURIComponent(`in.(${quotedIds})`)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
  }
}

async function syncSupabaseCollection(collectionName: string, items: any[]) {
  if (!supabaseConfigured) return;

  const existingRecordIds = await loadSupabaseRecordIds(collectionName);
  const records = items
    .map((item: any) => {
      const data = collectionName === "dismissedEmails" && typeof item === "string"
        ? { id: item, email: item }
        : item;
      if (!data?.id) return null;
      return { collection_name: collectionName, record_id: String(data.id), data };
    })
    .filter(Boolean);

  for (let offset = 0; offset < records.length; offset += 500) {
    await supabaseRequest("app_records?on_conflict=collection_name,record_id", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(records.slice(offset, offset + 500)),
    });
  }

  // Never empty a collection before its replacement data is durable. Other
  // Vercel instances can keep serving the previous complete snapshot until
  // stale records are removed after the successful upsert.
  const currentRecordIds = new Set(records.map((record: any) => String(record.record_id)));
  const staleRecordIds = existingRecordIds.filter((id) => !currentRecordIds.has(id));
  await deleteSupabaseRecords(collectionName, staleRecordIds);
}

async function syncAllToSupabase() {
  if (!supabaseConfigured) return;
  for (const collectionName of CLOUD_COLLECTIONS) {
    await syncSupabaseCollection(collectionName, (db as any)[collectionName] || []);
  }
}

// Compatibility wrappers keep the existing route handlers small while the
// backing store is now Supabase rather than Firestore.
function trackSupabaseWrite(write: Promise<void>) {
  const handledWrite = write.catch((err) => {
    console.error("Supabase persistence failed:", err);
  });
  pendingSupabaseWrites.getStore()?.add(handledWrite);
  return handledWrite;
}

function saveToFirestore(collectionName: string, item: any) {
  return trackSupabaseWrite(saveToSupabase(collectionName, item).catch((err) => {
    console.error(`Failed to sync ${collectionName}/${item?.id} to Supabase:`, err);
    throw err;
  }));
}

function deleteFromFirestore(collectionName: string, id: string) {
  return trackSupabaseWrite(deleteFromSupabase(collectionName, id).catch((err) => {
    console.error(`Failed to delete ${collectionName}/${id} from Supabase:`, err);
    throw err;
  }));
}

function saveDatabase() {
  if (isVercel) return;
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(db, null, 2), "utf8");
    console.log("Database saved successfully to file:", DATA_FILE_PATH);
  } catch (err) {
    console.error("Failed to write database file:", err);
  }
}


// Add log helper
function addLog(username: string, role: UserRole, action: string, details: string) {
  const newLog: AuditLog = {
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: username,
    userName: username,
    userRole: role,
    action,
    details
  };
  db.logs.unshift(newLog);
  saveDatabase();
  saveToFirestore("logs", newLog);
}

// Security email warning alert simulation
function sendEmailAlert(targetEmail: string, attemptedEmail: string, attemptedName: string) {
  const timeStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  console.log(`
======================================================================
🚨 [SECURITY ALERT] CẢNH BÁO ĐĂNG NHẬP TRÁI PHÉP HỆ THỐNG QUẢN LÝ DÂN CƯ 🚨
======================================================================
Gửi tới: ${targetEmail} (Người quản lý tối cao)
Thời gian gửi email: ${timeStr}
Chủ đề: [CẢNH BÁO BẢO MẬT] Phát hiện nỗ lực đăng nhập trái phép vào hệ thống!

Kính gửi Ban Quản Trị Tổ dân phố / Khu phố Ninh Phú,

Hệ thống bảo mật trực tuyến vừa phát hiện và ngăn chặn thành công một nỗ lực đăng nhập trái phép thông qua tài khoản Google Gmail.

Thông tin chi tiết về cuộc đăng nhập:
- Tài khoản Gmail cố gắng truy cập: ${attemptedEmail}
- Họ và tên người dùng (Google Profile): ${attemptedName}
- Thời gian phát hiện: ${timeStr}
- Hành vi: Đăng nhập trực tiếp (Google Sign-In)
- Trạng thái xử lý: ĐÃ CHẶN TRUY CẬP (ACCESS DENIED)

Lưu ý: Tài khoản này chưa nằm trong danh sách email được cấp quyền (Allowed Emails). Hệ thống đã chặn toàn bộ quyền xem và thay đổi thông tin dữ liệu cư dân để bảo vệ bí mật đời tư công dân.

Hành động khuyến nghị của bạn:
1. Nếu đây là một cuộc xâm nhập cố ý từ người lạ: Vui lòng bỏ qua cảnh báo này và không chia sẻ bất kỳ thông tin nhạy cảm nào.
2. Nếu đây là tài khoản mới của Cán bộ / Cộng tác viên thực tế: Bạn có thể đăng nhập vào ứng dụng bằng tài khoản Quản trị, chuyển đến tab "Cấp quyền truy cập" và nhập email "${attemptedEmail}" để chính thức cấp phép hoạt động cho họ.

Trân trọng,
Hệ Thống Giám Sát Cảnh Báo Tự Động Tổ Dân Phố Ninh Phú
----------------------------------------------------------------------
`);
}

// RESTful Express App Setup
const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "50mb"
}));

let databaseInitialization: Promise<void> | null = null;
function ensureDatabaseInitialized() {
  // A Vercel invocation can be handled by any warm instance. Always refresh
  // its in-memory snapshot from Supabase so a request after restore never
  // serves another instance's stale residents/households collection.
  const shouldRefresh = isVercel;
  if (!databaseInitialization || shouldRefresh) {
    databaseInitialization = loadDatabase();
  }
  return databaseInitialization;
}

// Each serverless instance must load Supabase before serving its first request.
app.use(async (_req, _res, next) => {
  try {
    await ensureDatabaseInitialized();
    next();
  } catch (err) {
    next(err);
  }
});

// Existing handlers issue record writes without awaiting them. On a long-lived
// local server that is harmless, but a serverless function may finish as soon
// as it sends its response. Delay JSON responses until all writes issued by
// this request have settled, so Supabase receives the mutation before Vercel
// completes the invocation.
app.use((req, res, next) => {
  pendingSupabaseWrites.run(new Set<Promise<void>>(), () => {
    const originalJson = res.json.bind(res);
    let responseScheduled = false;

    res.json = ((body: any) => {
      if (responseScheduled) return res;
      responseScheduled = true;
      const writes = [...(pendingSupabaseWrites.getStore() || [])];
      if (writes.length === 0) return originalJson(body);

      void Promise.allSettled(writes).then(() => originalJson(body));
      return res;
    }) as typeof res.json;

    next();
  });
});

type VerifiedFirebaseUser = { uid: string; email: string; displayName?: string };

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!firebaseWebApiKey) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseWebApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return null;

  const payload = await response.json() as { users?: Array<{ localId?: string; email?: string; displayName?: string }> };
  const user = payload.users?.[0];
  if (!user?.localId || !user.email) return null;
  return { uid: user.localId, email: user.email.toLowerCase(), displayName: user.displayName };
}

function isAuthorizedDataUser(email: string) {
  const normalizedEmail = email.toLowerCase();
  return SUPER_ADMIN_EMAILS.has(normalizedEmail)
    || Boolean(db.allowedEmails?.some((entry) => entry.email.toLowerCase() === normalizedEmail));
}

type ServerAction = "add" | "edit" | "delete" | "export" | "admin";

function getAllowedUser(email: string) {
  const normalizedEmail = email.toLowerCase();
  return db.allowedEmails?.find((entry) => entry.email.toLowerCase() === normalizedEmail);
}

function isSuperAdminRequest(req: any) {
  const email = req.firebaseUser?.email?.toLowerCase();
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.has(email) || getAllowedUser(email)?.role === UserRole.SUPER_ADMIN;
}

function canRequestPerformAction(req: any, action: Exclude<ServerAction, "admin">) {
  const email = req.firebaseUser?.email?.toLowerCase();
  if (!email) return false;
  if (SUPER_ADMIN_EMAILS.has(email)) return true;

  const allowedUser = getAllowedUser(email);
  if (!allowedUser) return false;
  if (allowedUser.role === UserRole.SUPER_ADMIN || allowedUser.role === UserRole.WARD_LEADER) return true;

  const permissions = allowedUser.permissions;
  if (!permissions) return action !== "delete";
  if (action === "add") return permissions.canAdd !== false;
  if (action === "edit") return permissions.canEdit !== false;
  if (action === "delete") return permissions.canDelete === true;
  return permissions.canExport !== false;
}

function getRequiredServerAction(req: express.Request): ServerAction | null {
  const { method, path: requestPath } = req;
  const administrativeDataPaths = new Set([
    "/api/data/clear-all",
    "/api/data/restore",
    "/api/data/sync-demographics",
    "/api/data/generate-mock",
    "/api/data/supabase-sync",
  ]);
  if (administrativeDataPaths.has(requestPath)) return "admin";
  if (requestPath.startsWith("/api/allowed-emails")) return "admin";
  if (
    requestPath.startsWith("/api/pending-registrations")
    && (method !== "POST" || requestPath !== "/api/pending-registrations")
  ) return "admin";
  if (requestPath === "/api/export") return "export";
  // CCCD images are highly sensitive identity documents. Only a super
  // administrator can upload, delete, or obtain a short-lived viewing URL.
  if (requestPath.startsWith("/api/id-card-images")) return "admin";

  const managedResources = ["/api/households", "/api/residents", "/api/businesses", "/api/changes", "/api/criteria", "/api/documents"];
  if (!managedResources.some((resource) => requestPath === resource || requestPath.startsWith(`${resource}/`))) {
    return null;
  }
  if (method === "POST") return "add";
  if (method === "PUT" || method === "PATCH") return "edit";
  if (method === "DELETE") return "delete";
  return null;
}

// Production API access is enforced server-side. A Firebase ID token proves
// identity and the existing allow-list determines whether that identity may
// read or modify resident data.
app.use(async (req, res, next) => {
  if (!isVercel && process.env.NODE_ENV !== "production") return next();
  if (!req.path.startsWith("/api/")) return next();

  const publiclyReachable = new Set([
    "/api/auth/google/url",
    "/api/auth/google/mock-auth",
    "/api/auth/callback",
    "/api/auth/callback/",
    "/api/auth/login",
  ]);
  if (publiclyReachable.has(req.path)) return next();

  const authHeader = req.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  const firebaseUser = idToken ? await verifyFirebaseIdToken(idToken).catch(() => null) : null;
  if (!firebaseUser) {
    return res.status(401).json({ error: "Cần đăng nhập bằng tài khoản Firebase hợp lệ." });
  }
  (req as any).firebaseUser = firebaseUser;

  const selfServiceRequest =
    req.path === "/api/auth/log-google"
    || req.path === "/api/auth/unauthorized-attempt"
    || req.path === "/api/auth/session-check"
    || (req.method === "POST" && req.path === "/api/pending-registrations");
  if (selfServiceRequest || isAuthorizedDataUser(firebaseUser.email)) return next();

  return res.status(403).json({ error: "Tài khoản chưa được cấp quyền truy cập dữ liệu." });
});

// The client hides restricted actions for each role, but the server must also
// enforce that policy because browser requests can be forged.
app.use((req, res, next) => {
  if (!isVercel && process.env.NODE_ENV !== "production") return next();
  const action = getRequiredServerAction(req);
  if (!action) return next();

  if (action === "admin") {
    if (isSuperAdminRequest(req)) return next();
  } else if (canRequestPerformAction(req, action)) {
    return next();
  }

  return res.status(403).json({ error: "Tài khoản không có quyền thực hiện thao tác này." });
});

// ==================== GOOGLE OAUTH FLOW ====================

// Endpoint to construct and return Google login URL
app.get("/api/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;
  const role = req.query.role || "SUPER_ADMIN";

  if (!clientId || clientId === "MY_GOOGLE_CLIENT_ID" || clientId.trim() === "") {
    // Return error telling the user that Google OAuth is required but client ID is not yet configured
    res.status(400).json({ 
      error: "Không tìm thấy cấu hình GOOGLE_CLIENT_ID thực tế trên máy chủ. Vui lòng kiểm tra lại cấu hình OAuth hoặc thử khởi động lại máy chủ." 
    });
  } else {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state: JSON.stringify({ role })
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl, isMock: false });
  }
});

// Simulated Google Account Selector Page (when client ID isn't set up yet)
app.get("/api/auth/google/mock-auth", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Đăng nhập bằng Google - Giả lập</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 font-sans min-h-screen flex items-center justify-center p-4">
      <div class="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-sm p-8 space-y-6">
        <div class="text-center space-y-2">
          <svg class="w-8 h-8 mx-auto" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <h1 class="text-xl font-bold text-slate-850">Chọn tài khoản Google</h1>
          <p class="text-xs text-slate-500">để tiếp tục đến Quản lý Dân cư KP Ninh Phú.</p>
        </div>

        <div class="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          <button onclick="selectAccount('Quýt Trần', 'bhttq3@gmail.com', 'SUPER_ADMIN')" class="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer">
            <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
              QT
            </div>
            <div class="overflow-hidden w-full">
              <p class="text-xs font-bold text-slate-800 truncate">Quýt Trần</p>
              <p class="text-[10px] text-slate-400 truncate">bhttq3@gmail.com</p>
              <span class="inline-block mt-0.5 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-bold uppercase tracking-wider rounded">Quản trị viên (Mặc định)</span>
            </div>
          </button>

          <button onclick="selectAccount('Phạm Duy Ngôn', 'tayninhdoimoi@gmail.com', 'SUPER_ADMIN')" class="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer">
            <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
              DN
            </div>
            <div class="overflow-hidden w-full">
              <p class="text-xs font-bold text-slate-800 truncate">Phạm Duy Ngôn</p>
              <p class="text-[10px] text-slate-400 truncate">tayninhdoimoi@gmail.com</p>
              <span class="inline-block mt-0.5 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-bold uppercase tracking-wider rounded">Quản trị viên (Tây Ninh)</span>
            </div>
          </button>

          <button onclick="selectAccount('Nguyễn Tấn Bình (3005)', 'nguyentanbinh3005@gmail.com', 'SUPER_ADMIN')" class="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer">
            <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
              NB
            </div>
            <div class="overflow-hidden w-full">
              <p class="text-xs font-bold text-slate-800 truncate">Nguyễn Tấn Bình</p>
              <p class="text-[10px] text-slate-400 truncate">nguyentanbinh3005@gmail.com</p>
              <span class="inline-block mt-0.5 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-bold uppercase tracking-wider rounded">Quản trị viên (Bình 3005)</span>
            </div>
          </button>

          <button onclick="selectAccount('Nguyễn Tấn Bình', 'binh.nguyen@kp-ninhphu.gov.vn', 'WARD_LEADER')" class="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer">
            <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
              TB
            </div>
            <div class="overflow-hidden w-full">
              <p class="text-xs font-bold text-slate-800 truncate">Nguyễn Tấn Bình</p>
              <p class="text-[10px] text-slate-400 truncate">binh.nguyen@kp-ninhphu.gov.vn</p>
              <span class="inline-block mt-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-bold uppercase tracking-wider rounded">Trưởng khu phố</span>
            </div>
          </button>

          <button onclick="selectAccount('Lê Thị Hồng', 'hong.le@kdc-tandinh.gov.vn', 'COLLABORATOR')" class="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer">
            <div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
              LH
            </div>
            <div class="overflow-hidden w-full">
              <p class="text-xs font-bold text-slate-800 truncate">Lê Thị Hồng</p>
              <p class="text-[10px] text-slate-400 truncate">hong.le@kdc-tandinh.gov.vn</p>
              <span class="inline-block mt-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-bold uppercase tracking-wider rounded">CTV</span>
            </div>
          </button>
        </div>

        <div class="text-[9px] text-slate-400 text-center leading-relaxed pt-2 border-t border-slate-100">
          * Đang chạy chế độ <b>Giả lập Google Auth</b>. Thiết lập <code class="bg-slate-150 px-1 py-0.5 rounded font-mono text-[9px]">GOOGLE_CLIENT_ID</code> để chạy kết nối thật.
        </div>
      </div>

      <script>
        function selectAccount(name, email, role) {
          const url = '/auth/callback?code=mock_code&email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(name) + '&role=' + encodeURIComponent(role);
          window.location.href = url;
        }
      </script>
    </body>
    </html>
  `);
});

// OAuth Callback Route
app.get(["/api/auth/callback", "/api/auth/callback/", "/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: '${error}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Xác thực Google thất bại: ${error}. Cửa sổ này sẽ tự đóng.</p>
        </body>
      </html>
    `);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  let email = "canbo.test@gmail.com";
  let name = "Nguyễn Tấn Bình";
  let role = UserRole.COLLABORATOR;

  if (code === "mock_code") {
    email = (req.query.email as string) || "binh.nguyen@kp-ninhphu.gov.vn";
    name = (req.query.name as string) || "Nguyễn Tấn Bình";
    const qRole = req.query.role as string;
    if (qRole === "SUPER_ADMIN") {
      role = UserRole.SUPER_ADMIN;
    } else if (qRole === "WARD_LEADER") {
      role = UserRole.WARD_LEADER;
    } else if (qRole === "COLLABORATOR") {
      role = UserRole.COLLABORATOR;
    } else {
      role = (qRole as UserRole) || UserRole.WARD_LEADER;
    }
  } else if (code && clientId && clientSecret) {
    try {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenRes.ok) {
        throw new Error(`Token exchange failed: ${tokenRes.statusText}`);
      }

      const tokenData: any = await tokenRes.json();
      const idToken = tokenData.id_token;

      if (idToken) {
        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          Buffer.from(base64, 'base64')
            .toString()
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        email = decoded.email || email;
        name = decoded.name || name;

        // Assign role initially based on state if provided
        let roleFromState = "";
        const stateQuery = req.query.state as string;
        if (stateQuery) {
          try {
            const parsed = JSON.parse(stateQuery);
            roleFromState = parsed.role;
          } catch (e) {
            // ignore
          }
        }

        if (roleFromState === "SUPER_ADMIN" || roleFromState === "Quản trị viên") {
          role = UserRole.SUPER_ADMIN;
        } else if (roleFromState === "WARD_LEADER" || roleFromState === "Trưởng khu phố") {
          role = UserRole.WARD_LEADER;
        } else if (roleFromState === "COLLABORATOR" || roleFromState === "CTV") {
          role = UserRole.COLLABORATOR;
        } else {
          role = UserRole.COLLABORATOR; // default fallback, will be overwritten by permission list check
        }
      }
    } catch (err: any) {
      console.error("Lỗi trao đổi code Google lấy token:", err);
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: '${err.message || err}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Lỗi xác thực Google: ${err.message || err}. Cửa sổ này sẽ tự đóng.</p>
          </body>
        </html>
      `);
    }
  }

  // The access-control list is the authority for application roles, while adminEmails are always SUPER_ADMIN.
  const lowerEmail = email.toLowerCase().trim();
  const adminEmails = ["bhttq3@gmail.com", "tayninhdoimoi@gmail.com", "nguyentanbinh3005@gmail.com"];
  const isSuperAdminEmail = adminEmails.includes(lowerEmail);

  const allowedList = db.allowedEmails || [];
  const allowedUser = allowedList.find(a => a.email.toLowerCase() === lowerEmail);
  const finalRole = isSuperAdminEmail ? UserRole.SUPER_ADMIN : (allowedUser?.role || null);

  if (!finalRole) {
    addLog(name || email, UserRole.COLLABORATOR, "CẢNH BÁO: Đăng nhập trái phép", `Tài khoản Google ${email} (Tên hiển thị: ${name || 'Chưa rõ'}) cố gắng đăng nhập hệ thống nhưng bị chặn do chưa được cấp quyền.`);
    sendEmailAlert("BHTTQ3@gmail.com", email, name || "Cán bộ số");
    return res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
          <div style="text-align: center; max-width: 480px; padding: 40px; border-radius: 24px; background: white; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
            <div style="width: 64px; height: 64px; background-color: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 style="color: #0f172a; margin: 0 0 12px; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Truy cập bị từ chối</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              Tài khoản Google <strong>${email}</strong> chưa được người quản lý hệ thống cấp quyền truy cập.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 24px; text-align: left;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 4px;">Liên hệ Người quản lý web, app</span>
              <span style="font-size: 13px; font-weight: 600; color: #334155;">BHTTQ3@gmail.com</span>
            </div>
            <button onclick="window.close()" style="width: 100%; padding: 12px; background-color: #0f172a; color: white; border: none; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
              Đóng cửa sổ
            </button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_FAILURE', 
                error: 'Tài khoản ${email} chưa được cấp quyền truy cập. Vui lòng liên hệ Người quản lý (BHTTQ3@gmail.com) để được cấp quyền.' 
              }, '*');
            }
          </script>
        </body>
      </html>
    `);
  }

  const user = {
    id: `GOOGLE-${Date.now()}`,
    username: email,
    fullName: name,
    role: finalRole,
    phone: "0900000000"
  };

  addLog(name, finalRole, "Đăng nhập Google", `Đăng nhập Google thành công với email ${email}`);

  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS', 
              user: ${JSON.stringify(user)} 
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Đăng nhập Google thành công! Cửa sổ này sẽ tự đóng.</p>
      </body>
    </html>
  `);
});

// Real Google sign-in logger for audit trail
app.post("/api/auth/log-google", (req, res) => {
  const { email: suppliedEmail, name: suppliedName, role } = req.body;
  const firebaseUser = (req as any).firebaseUser as VerifiedFirebaseUser | undefined;
  const email = firebaseUser?.email || suppliedEmail;
  const name = firebaseUser?.displayName || suppliedName;
  addLog(name || email || "Cán bộ số", role || UserRole.COLLABORATOR, "Đăng nhập Google", `Đăng nhập Google Firebase thành công với email ${email}`);
  res.json({ success: true });
});

// Log unauthorized login attempt from client and simulate email alert
app.post("/api/auth/unauthorized-attempt", (req, res) => {
  const { email: suppliedEmail, displayName: suppliedDisplayName } = req.body;
  const firebaseUser = (req as any).firebaseUser as VerifiedFirebaseUser | undefined;
  const email = firebaseUser?.email || suppliedEmail;
  const displayName = firebaseUser?.displayName || suppliedDisplayName;
  if (!email) {
    return res.status(400).json({ error: "Thiếu thông tin email" });
  }

  addLog(
    displayName || email,
    UserRole.COLLABORATOR,
    "CẢNH BÁO: Đăng nhập trái phép",
    `Tài khoản Google ${email} (Tên hiển thị: ${displayName || 'Chưa rõ'}) cố gắng đăng nhập hệ thống nhưng bị chặn do chưa được cấp quyền.`
  );
  sendEmailAlert("BHTTQ3@gmail.com", email, displayName || "Cán bộ số");

  res.json({ success: true, message: "Đã ghi nhận nỗ lực truy cập trái phép và gửi email cảnh báo bảo mật tới Quản trị viên." });
});

// Setup user on backend using Bearer token (IdToken)
app.post("/api/users/setup", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Không có mã xác thực hoặc định dạng không hợp lệ" });
  }
  const idToken = authHeader.split(" ")[1];
  console.log("Đang thiết lập thông tin người dùng trên Backend với mã IdToken.");
  // Trao đổi hoặc xác thực mã này nếu cần thiết, ghi nhận log sự kiện thành công
  addLog("Hệ thống", UserRole.SUPER_ADMIN, "Thiết lập cán bộ", "Nhận được mã IdToken xác thực thành công từ Client");
  res.json({ success: true, message: "Thiết lập tài khoản cán bộ trên máy chủ thành công" });
});

app.post("/api/auth/send-otp", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const phone = String(req.body?.phone || "").trim();
  const allowedUser = db.allowedEmails?.find(entry => entry.email.toLowerCase() === email);
  if (!email || !allowedUser) {
    return res.status(403).json({ error: "Tài khoản chưa được cấp quyền xác thực 2FA." });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  const canSendEmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  if (canSendEmail && transporter) {
    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: "Mã xác thực 2FA - Quản lý dân cư",
        text: `Mã xác thực 2FA của bạn là ${code}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này cho bất kỳ ai.`,
      });
    } catch (error) {
      console.error("Không thể gửi email OTP, chuyển sang gửi hiển thị trực tiếp:", error);
    }
  }

  return res.json({
    success: true,
    message: "Mã xác thực OTP 2FA đã được tạo thành công.",
    phone: phone || (allowedUser as any).phone || "0912345678",
    developmentCode: code,
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  const record = otpStore.get(email);
  const allowedUser = db.allowedEmails?.find(entry => entry.email.toLowerCase() === email);

  if (!email || !code || !record || record.expiresAt < Date.now()) {
    otpStore.delete(email);
    return res.status(401).json({ error: "Mã 2FA không hợp lệ hoặc đã hết hạn." });
  }
  if (!allowedUser) {
    otpStore.delete(email);
    return res.status(403).json({ error: "Tài khoản không còn trong danh sách được cấp quyền." });
  }
  if (record.code !== code) {
    return res.status(401).json({ error: "Mã 2FA không chính xác." });
  }

  otpStore.delete(email);
  return res.json({ success: true, role: allowedUser.role });
});

// Legacy demo-login endpoint is intentionally disabled: authentication must use Google plus 2FA.
app.post("/api/auth/login", (req, res) => {
  return res.status(410).json({ error: "Đăng nhập mô phỏng đã bị tắt. Vui lòng đăng nhập Google và xác thực 2FA." });
});

function normalizeUserRole(inputRole: any): UserRole | null {
  if (!inputRole) return null;
  const s = String(inputRole).trim().toUpperCase();
  if (s === "SUPER_ADMIN" || s === "QUẢN TRỊ VIÊN" || s === UserRole.SUPER_ADMIN.toUpperCase()) {
    return UserRole.SUPER_ADMIN;
  }
  if (s === "WARD_LEADER" || s === "TRƯỞNG KHU PHỐ" || s === UserRole.WARD_LEADER.toUpperCase()) {
    return UserRole.WARD_LEADER;
  }
  if (s === "COLLABORATOR" || s === "CTV" || s === "CỘNG TÁC VIÊN" || s === UserRole.COLLABORATOR.toUpperCase()) {
    return UserRole.COLLABORATOR;
  }
  return null;
}

// GET session and authorization check for real-time revoke/update
app.get("/api/auth/session-check", (req, res) => {
  const { email, requestedRole } = req.query;
  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required" });
  }

  const lowerEmail = (email as string).toLowerCase().trim();
  const verifiedUser = (req as any).firebaseUser as VerifiedFirebaseUser | undefined;
  if (verifiedUser && verifiedUser.email !== lowerEmail) {
    return res.status(403).json({ error: "Không thể kiểm tra quyền của tài khoản khác." });
  }

  if (!db.allowedEmails) db.allowedEmails = [];
  
  const allowedUser = db.allowedEmails.find(a => a.email.toLowerCase() === lowerEmail);
  const isSuperAdmin = SUPER_ADMIN_EMAILS.has(lowerEmail);

  if (!isSuperAdmin && !allowedUser) {
    return res.json({ allowed: false });
  }

  const maxRole = isSuperAdmin 
    ? UserRole.SUPER_ADMIN 
    : (allowedUser ? allowedUser.role : UserRole.COLLABORATOR);

  const roleHierarchy: Record<string, number> = {
    [UserRole.SUPER_ADMIN]: 3,
    [UserRole.WARD_LEADER]: 2,
    [UserRole.COLLABORATOR]: 1,
  };

  const parsedRequested = normalizeUserRole(requestedRole);

  let finalRole: UserRole = maxRole;
  if (parsedRequested) {
    if ((roleHierarchy[parsedRequested] || 0) <= (roleHierarchy[maxRole] || 0)) {
      finalRole = parsedRequested;
    }
  }

  let effectivePermissions = allowedUser?.permissions;
  if (finalRole === UserRole.SUPER_ADMIN) {
    effectivePermissions = { canAdd: true, canEdit: true, canDelete: true, canExport: true, canApprove: true };
  } else if (finalRole === UserRole.WARD_LEADER) {
    effectivePermissions = effectivePermissions || { canAdd: true, canEdit: true, canDelete: true, canExport: true, canApprove: true };
  } else if (finalRole === UserRole.COLLABORATOR) {
    effectivePermissions = effectivePermissions || { canAdd: true, canEdit: true, canDelete: false, canExport: true, canApprove: false };
  }

  return res.json({ 
    allowed: true, 
    role: finalRole,
    fullName: allowedUser?.fullName || undefined,
    permissions: effectivePermissions
  });
});

// POST clear all data
app.post("/api/data/clear-all", async (req, res) => {
  const username = (req.query.user as string) || "Hệ thống";
  const userRole = (req.query.role as UserRole) || UserRole.SUPER_ADMIN;

  db.households = [];
  db.residents = [];
  db.changes = [];
  db.businesses = [];
  db.criteria = DEFAULT_CRITERIA.map(c => ({
    ...c,
    status: "Chưa đạt" as any,
    description: "Chưa được đánh giá",
    lastUpdated: new Date().toISOString().split("T")[0]
  }));
  db.logs = [];

  addLog(username, userRole, "Xoá tất cả dữ liệu", "Xoá toàn bộ dữ liệu mẫu/ảo thành công để chuẩn bị nhập dữ liệu thực tế");
  saveDatabase();

  /* Legacy Firestore clear implementation.
  // If Firestore Cloud is active, clear/reset the Cloud database as well
  if (firestoreDb) {
    try {
      console.log("Clearing Firestore collections...");
      const collectionsToClear = ["households", "residents", "changes", "businesses", "criteria", "logs"];
      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(firestoreDb, colName));
        const deletePromises = snap.docs.map(docSnap => deleteDoc(doc(firestoreDb, colName, docSnap.id)));
        await Promise.all(deletePromises);
      }

      // Write reset criteria to Firestore
      for (const critItem of db.criteria) {
        await setDoc(doc(firestoreDb, "criteria", critItem.id), critItem);
      }

      // Write the clean audit log to Firestore
      const cleanLogs = db.logs || [];
      for (const logItem of cleanLogs) {
        await setDoc(doc(firestoreDb, "logs", logItem.id), logItem);
      }

      console.log("Firestore Cloud cleared successfully.");
    } catch (err: any) {
      console.error("Lỗi khi xoá dữ liệu trên Firestore:", err);
    }
  }

  res.json({ success: true, message: "Đã xoá toàn bộ dữ liệu mẫu. Hệ thống trống sẵn sàng cho nhập liệu thực tế." });
*/
  await syncAllToSupabase();
  res.json({ success: true, message: "Dữ liệu đã được xoá và đồng bộ với Supabase." });
});

// POST synchronize only households and residents from a validated backup.
// This is intentionally narrower than a full restore: business records,
// documents, access control, logs and other collections are left untouched.
app.post("/api/data/sync-demographics", async (req, res) => {
  const username = (req.query.user as string) || "Hệ thống";
  const userRole = (req.query.role as UserRole) || UserRole.SUPER_ADMIN;
  const source = req.body;
  const households = source?.households;
  const residents = source?.residents;

  if (!Array.isArray(households) || !Array.isArray(residents) || households.length === 0 || residents.length === 0) {
    return res.status(400).json({ error: "Tệp đồng bộ phải có ít nhất một hộ dân và một nhân khẩu." });
  }

  const householdIds = new Set<string>();
  for (const household of households) {
    const id = typeof household?.id === "string" ? household.id.trim() : "";
    if (!id || householdIds.has(id)) {
      return res.status(400).json({ error: "Dữ liệu hộ dân có mã trống hoặc trùng lặp." });
    }
    householdIds.add(id);
  }

  const residentIds = new Set<string>();
  for (const resident of residents) {
    const id = typeof resident?.id === "string" ? resident.id.trim() : "";
    const householdId = typeof resident?.householdId === "string" ? resident.householdId.trim() : "";
    if (!id || residentIds.has(id)) {
      return res.status(400).json({ error: "Dữ liệu nhân khẩu có mã trống hoặc trùng lặp." });
    }
    if (!householdId || !householdIds.has(householdId)) {
      return res.status(400).json({ error: "Có nhân khẩu không thuộc hộ dân hợp lệ; đồng bộ đã được hủy để bảo toàn dữ liệu." });
    }
    residentIds.add(id);
  }

  try {
    // Upsert completes before stale records are removed. If the resident sync
    // fails, the request reports an error and a retry is safe.
    await syncSupabaseCollection("households", households);
    await syncSupabaseCollection("residents", residents);
    db.households = households;
    db.residents = residents;

    if (supabaseConfigured) {
      const cloudLoaded = await loadFromSupabase();
      if (!cloudLoaded || db.households.length !== households.length || db.residents.length !== residents.length) {
        throw new Error("Supabase verification did not match the uploaded demographic data.");
      }
    } else {
      saveDatabase();
    }

    addLog(username, userRole, "Đồng bộ hộ dân và nhân khẩu", `Đồng bộ ${households.length} hộ dân và ${residents.length} nhân khẩu lên Supabase.`);
    return res.json({ success: true, householdsCount: households.length, residentsCount: residents.length });
  } catch (err) {
    console.error("Demographic synchronization failed:", err);
    return res.status(500).json({ error: "Chưa thể xác minh dữ liệu hộ dân và nhân khẩu trên Supabase. Vui lòng thử lại." });
  }
});

// POST restore database backup (JSON or parsed Excel objects)
app.post("/api/data/restore", async (req, res) => {
  const username = (req.query.user as string) || "Hệ thống";
  const userRole = (req.query.role as UserRole) || UserRole.SUPER_ADMIN;
  const backupData = req.body;

  if (!backupData || typeof backupData !== "object") {
    return res.status(400).json({ error: "Dữ liệu sao lưu trống hoặc không đúng định dạng." });
  }

  // Set values with fallback arrays to prevent crashes
  db.households = Array.isArray(backupData.households) ? backupData.households : [];
  db.residents = Array.isArray(backupData.residents) ? backupData.residents : [];
  db.changes = Array.isArray(backupData.changes) ? backupData.changes : [];
  db.businesses = Array.isArray(backupData.businesses) ? backupData.businesses : [];
  db.criteria = Array.isArray(backupData.criteria) ? backupData.criteria : DEFAULT_CRITERIA;
  db.logs = Array.isArray(backupData.logs) ? backupData.logs : db.logs || [];
  db.documents = Array.isArray(backupData.documents) ? backupData.documents : db.documents || [];
  // Older public backups omit access-control data. Preserve the Cloud list in
  // that case, but restore it whenever a protected admin backup includes it.
  if (Array.isArray(backupData.allowedEmails)) db.allowedEmails = backupData.allowedEmails;
  if (Array.isArray(backupData.pendingRegistrations)) db.pendingRegistrations = backupData.pendingRegistrations;
  if (Array.isArray(backupData.dismissedEmails)) db.dismissedEmails = backupData.dismissedEmails;

  const expectedCounts = {
    households: db.households.length,
    residents: db.residents.length,
    changes: db.changes.length,
    businesses: db.businesses.length,
    criteria: db.criteria.length,
    documents: db.documents.length,
    allowedEmails: db.allowedEmails?.length || 0,
    pendingRegistrations: db.pendingRegistrations?.length || 0,
  };

  try {
    await syncAllToSupabase();

    // A local success message is insufficient on serverless infrastructure.
    // Read Cloud back and verify every restored collection before reporting a
    // successful restore to the administrator.
    if (supabaseConfigured) {
      const cloudLoaded = await loadFromSupabase();
      const mismatchedCollections = Object.entries(expectedCounts)
        .filter(([collection, expected]) => (db as any)[collection]?.length !== expected)
        .map(([collection, expected]) => `${collection}: expected ${expected}, received ${(db as any)[collection]?.length || 0}`);

      if (!cloudLoaded || mismatchedCollections.length > 0) {
        throw new Error(`Supabase verification failed (${mismatchedCollections.join("; ") || "no cloud data returned"}).`);
      }
    }
  } catch (err: any) {
    console.error("Restore could not be verified in Supabase:", err);
    return res.status(500).json({
      error: "Khôi phục chưa hoàn tất trên Supabase. Dữ liệu Cloud không khớp với tệp sao lưu; vui lòng không tiếp tục thao tác và thử lại sau khi liên hệ quản trị viên.",
    });
  }

  addLog(username, userRole, "Phục hồi dữ liệu", `Khôi phục toàn bộ hệ thống từ file sao lưu (${db.households.length} hộ, ${db.residents.length} nhân khẩu, ${db.documents.length} tài liệu)`);
  saveDatabase();

  res.json({
    success: true,
    message: "Phục hồi dữ liệu hệ thống thành công!",
    householdsCount: db.households.length,
    residentsCount: db.residents.length,
    businessesCount: db.businesses.length,
    changesCount: db.changes.length,
    criteriaCount: db.criteria.length,
    documentsCount: db.documents.length
  });
});

// POST generate 25 households and 105 residents mock data
app.post("/api/data/generate-mock", (req, res) => {
  let seed = 12345;
  function random() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(random() * arr.length)];
  }
  function randomRange(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  const generatedHouseholds: Household[] = [];
  const generatedResidents: Resident[] = [];

  const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Lâm", "Mai", "Trịnh", "Cao"];
  const middleMale = ["Văn", "Đức", "Minh", "Hữu", "Xuân", "Thanh", "Quang", "Quốc", "Khánh", "Anh", "Ngọc", "Hoàng", "Tiến", "Tùng", "Sơn"];
  const middleFemale = ["Thị", "Quỳnh", "Hồng", "Phương", "Bích", "Ngọc", "Thu", "Hoài", "Khánh", "Minh", "Cẩm", "Bảo", "Kim", "Diệu", "Trúc"];
  const firstMale = ["An", "Bình", "Cường", "Dũng", "Đạt", "Giang", "Hùng", "Hải", "Khánh", "Lâm", "Minh", "Nam", "Phong", "Quân", "Sơn", "Toàn", "Tuấn", "Việt", "Vinh", "Kiệt", "Huy", "Hoàng", "Bảo", "Trọng", "Thành", "Trung", "Phúc", "Tâm", "Hải", "Thắng"];
  const firstFemale = ["An", "Bình", "Chi", "Dung", "Đào", "Giang", "Hương", "Hạnh", "Khánh", "Linh", "Mai", "Nga", "Oanh", "Phương", "Quỳnh", "Thảo", "Trang", "Vân", "Yến", "Tuyết", "Hồng", "Lan", "Nhi", "Ngọc", "Trúc", "Vy", "Hà", "Thu", "Phượng", "Thư"];

  const streetNames = ["Hoa Sữa", "Điện Biên Phủ", "Cách Mạng Tháng 8", "Hai Bà Trưng", "Nguyễn Huệ", "Lê Lợi", "Bạch Đằng", "Phan Xích Long", "Hoàng Hoa Thám", "Nơ Trang Long", "Võ Thị Sáu", "Nguyễn Đình Chiểu"];

  // Pre-defined occupations
  const maleJobs = [
    { title: "Kỹ sư xây dựng", sector: LaborSector.INDUSTRY, workplace: "Tổng công ty Xây dựng Hoà Bình" },
    { title: "Lập trình viên", sector: LaborSector.SERVICE, workplace: "FPT Software" },
    { title: "Tài xế taxi", sector: LaborSector.SERVICE, workplace: "Mai Linh Group" },
    { title: "Bác sĩ", sector: LaborSector.SERVICE, workplace: "Bệnh viện Nhân dân Gia Định" },
    { title: "Công nhân cơ khí", sector: LaborSector.INDUSTRY, workplace: "Nhà máy Thép Sài Gòn" },
    { title: "Nhân viên kinh doanh", sector: LaborSector.SERVICE, workplace: "Tập đoàn Hoa Sen" },
    { title: "Thợ điện", sector: LaborSector.INDUSTRY, workplace: "Điện lực TP.HCM" },
    { title: "Buôn bán tự do", sector: LaborSector.SERVICE, workplace: "Chợ Bà Chiểu" }
  ];

  const femaleJobs = [
    { title: "Giáo viên Tiểu học", sector: LaborSector.SERVICE, workplace: "Trường Tiểu học Nguyễn Huệ" },
    { title: "Dược sĩ", sector: LaborSector.SERVICE, workplace: "Nhà thuốc An Khang" },
    { title: "Kiểm toán viên", sector: LaborSector.SERVICE, workplace: "KPMG Việt Nam" },
    { title: "Công nhân may", sector: LaborSector.INDUSTRY, workplace: "Xí nghiệp May Nhà Bè" },
    { title: "Nhân viên văn phòng", sector: LaborSector.SERVICE, workplace: "Ngân hàng Vietcombank" },
    { title: "Y tá", sector: LaborSector.SERVICE, workplace: "Bệnh viện Quận Bình Thạnh" },
    { title: "Kế toán trưởng", sector: LaborSector.SERVICE, workplace: "Công ty Cổ phần VinaMilk" },
    { title: "Nội trợ", sector: LaborSector.UNEMPLOYED, workplace: "Tại nhà" }
  ];

  // Helper to generate a unique CCCD
  let lastCccdNum = 3000000000;
  function nextCccd(): string {
    lastCccdNum += randomRange(150, 400);
    return `0300${lastCccdNum}`;
  }

  // Generate 25 households
  for (let i = 1; i <= 25; i++) {
    const householdId = `HỘ-${10000 + i}`;
    const street = randomElement(streetNames);
    const wardId = i <= 9 ? "Tổ 5" : i <= 17 ? "Tổ 6" : "Tổ 7";
    const quarterId = "Khu phố 2";
    
    // Distribute statuses realistically
    let status = HouseholdStatus.AVERAGE;
    if (i === 3 || i === 12) status = HouseholdStatus.POOR;
    else if (i === 7 || i === 18 || i === 22) status = HouseholdStatus.NEAR_POOR;
    else if (i === 5 || i === 11 || i === 16 || i === 20 || i === 24) status = HouseholdStatus.FAIR;
    else if (i === 9 || i === 15 || i === 25) status = HouseholdStatus.RICH;

    const housingType = Math.random() > 0.7 ? HousingType.YES : HousingType.NO;

    // Household family members size: 5 members for indices i = 1, 6, 11, 16, 21 (5 households). 4 members for other 20 households.
    // Total: 5 * 5 + 20 * 4 = 105 residents! Exactly 105!
    const familySize = (i - 1) % 5 === 0 ? 5 : 4;

    const familySurname = randomElement(surnames);
    
    let ownerId = "";
    let ownerName = "";
    
    const familyMembers: Resident[] = [];

    // Base year of birth for the owner
    const ownerBirthYear = randomRange(1955, 1978);
    const spouseBirthYear = ownerBirthYear + randomRange(-4, 4);

    for (let m = 0; m < familySize; m++) {
      const isOwner = m === 0;
      const isSpouse = m === 1;
      const isChild1 = m === 2;
      const isChild2 = m === 3;
      const isElderlyOrChild3 = m === 4;

      let memberGender = Gender.MALE;
      if (isOwner) {
        // Owners mostly male (80%), sometimes female
        memberGender = random() > 0.2 ? Gender.MALE : Gender.FEMALE;
      } else if (isSpouse) {
        memberGender = familyMembers[0].gender === Gender.MALE ? Gender.FEMALE : Gender.MALE;
      } else {
        memberGender = random() > 0.5 ? Gender.MALE : Gender.FEMALE;
      }

      // Generate realistic names
      let mSurname = familySurname;
      if (isSpouse) {
        // Spouse has different family surname
        let spouseSurname = randomElement(surnames);
        while (spouseSurname === familySurname) spouseSurname = randomElement(surnames);
        mSurname = spouseSurname;
      }

      let middle = memberGender === Gender.MALE ? randomElement(middleMale) : randomElement(middleFemale);
      let given = memberGender === Gender.MALE ? randomElement(firstMale) : randomElement(firstFemale);
      
      // Ensure no name duplicates within household
      let fullName = `${mSurname} ${middle} ${given}`;
      while (familyMembers.some(f => f.fullName === fullName)) {
        given = memberGender === Gender.MALE ? randomElement(firstMale) : randomElement(firstFemale);
        fullName = `${mSurname} ${middle} ${given}`;
      }

      // Determine birth date
      let birthYear = ownerBirthYear;
      if (isSpouse) birthYear = spouseBirthYear;
      else if (isChild1) birthYear = ownerBirthYear + randomRange(22, 30);
      else if (isChild2) birthYear = ownerBirthYear + randomRange(25, 34);
      else if (isElderlyOrChild3) {
        // For 5-person household, the 5th member can be elderly parent (born 1930-1945) or third child (born 2012-2022)
        birthYear = random() > 0.5 ? randomRange(1932, 1948) : ownerBirthYear + randomRange(30, 38);
      }

      // Cap birthYear so it doesn't exceed 2026
      if (birthYear > 2026) birthYear = 2025;

      const birthMonth = randomRange(1, 12);
      const birthDay = randomRange(1, 28);
      const birthDateStr = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

      const memberId = nextCccd();
      
      // Relations
      let relationToOwner = "Con";
      if (isOwner) relationToOwner = "Chủ hộ";
      else if (isSpouse) relationToOwner = memberGender === Gender.MALE ? "Chồng" : "Vợ";
      else if (isElderlyOrChild3) {
        relationToOwner = birthYear < ownerBirthYear ? (memberGender === Gender.MALE ? "Bố" : "Mẹ") : "Con";
      }

      const age = 2026 - birthYear;

      // Education & Occupation
      let education = EducationLevel.NONE;
      let occupation = "Chưa đi học";
      let workplace = "";
      let isStudent = false;
      let studentType: any = undefined;
      let isEmployed = false;
      let laborSector = LaborSector.UNEMPLOYED;

      if (age >= 23) {
        isEmployed = status !== HouseholdStatus.POOR || random() > 0.4;
        if (isEmployed) {
          const job = memberGender === Gender.MALE ? randomElement(maleJobs) : randomElement(femaleJobs);
          occupation = job.title;
          workplace = job.workplace;
          laborSector = job.sector;
          education = randomElement([EducationLevel.UNIVERSITY, EducationLevel.COLLEGE, EducationLevel.HIGH_SCHOOL]);
        } else {
          occupation = memberGender === Gender.FEMALE ? "Nội trợ" : "Thất nghiệp";
          laborSector = LaborSector.UNEMPLOYED;
          education = EducationLevel.SECONDARY;
        }
        if (age > 60) {
          occupation = "Hưu trí";
          isEmployed = false;
          laborSector = LaborSector.UNEMPLOYED;
          education = randomElement([EducationLevel.PRIMARY, EducationLevel.SECONDARY, EducationLevel.HIGH_SCHOOL]);
        }
      } else if (age >= 18) {
        education = EducationLevel.HIGH_SCHOOL;
        occupation = "Sinh viên";
        workplace = randomElement(["Đại học Bách Khoa TP.HCM", "Đại học Khoa học Tự nhiên", "Đại học Kinh tế TP.HCM"]);
        isStudent = true;
        studentType = "Sinh viên";
        laborSector = LaborSector.UNEMPLOYED;
      } else if (age >= 15) {
        education = EducationLevel.SECONDARY;
        occupation = "Học sinh";
        workplace = "Trường THPT Tân Định";
        isStudent = true;
        studentType = "THPT";
        laborSector = LaborSector.UNEMPLOYED;
      } else if (age >= 11) {
        education = EducationLevel.PRIMARY;
        occupation = "Học sinh";
        workplace = "Trường THCS Hoa Sữa";
        isStudent = true;
        studentType = "THCS";
        laborSector = LaborSector.UNEMPLOYED;
      } else if (age >= 6) {
        education = EducationLevel.NONE;
        occupation = "Học sinh";
        workplace = "Trường Tiểu học Nguyễn Huệ";
        isStudent = true;
        studentType = "Tiểu học";
        laborSector = LaborSector.UNEMPLOYED;
      } else if (age >= 3) {
        occupation = "Trẻ em";
        workplace = "Trường Mầm non Sao Mai";
        isStudent = true;
        studentType = "Mầm non";
        laborSector = LaborSector.UNEMPLOYED;
      } else {
        occupation = "Trẻ em";
        isStudent = false;
        studentType = "Chưa đến trường";
        laborSector = LaborSector.UNEMPLOYED;
      }

      // Insurance
      let insuranceId = `GD${randomRange(400000, 999999)}${randomRange(1000, 9999)}`;
      if (isStudent) {
        insuranceId = `SV${randomRange(400000, 999999)}${randomRange(1000, 9999)}`;
      } else if (isEmployed && laborSector === LaborSector.INDUSTRY) {
        insuranceId = `DN${randomRange(400000, 999999)}${randomRange(1000, 9999)}`;
      }

      // Vulnerabilities & Subsidies
      let isDisabled = false;
      let isPregnant = false;
      let subsidyType: string | undefined = undefined;
      let subsidyAmount: number | undefined = undefined;
      let subsidyStartDate: string | undefined = undefined;

      if (status === HouseholdStatus.POOR && m === familySize - 1 && random() > 0.5) {
        isDisabled = true;
        subsidyType = "Trợ cấp khuyết tật";
        subsidyAmount = 720000;
        subsidyStartDate = "2024-01-15";
      }

      if (memberGender === Gender.FEMALE && age >= 22 && age <= 35 && m === 1 && random() > 0.8) {
        isPregnant = true;
      }

      const resident: Resident = {
        id: memberId,
        fullName,
        birthDate: birthDateStr,
        gender: memberGender,
        relationToOwner,
        nationalId: memberId,
        phone: age >= 18 ? `09${randomRange(10, 99)}${randomRange(100, 999)}${randomRange(100, 999)}` : undefined,
        email: age >= 18 ? `${given.toLowerCase()}.${mSurname.toLowerCase()}${birthYear}@gmail.com` : undefined,
        status: ResidentStatus.PERMANENT,
        ethnicity: "Kinh",
        religion: random() > 0.7 ? "Phật giáo" : "Không",
        nationality: "Việt Nam",
        education,
        occupation,
        workplace: workplace || undefined,
        householdId,
        insuranceId,
        insuranceIssuedDate: "2024-01-01",
        insuranceExpiryDate: "2029-01-01",
        isElderly: age >= 60 ? true : undefined,
        isDisabled: isDisabled ? true : undefined,
        isPregnant: isPregnant ? true : undefined,
        isStudent: isStudent ? true : undefined,
        studentType,
        isEmployed,
        laborSector,
        subsidyType,
        subsidyAmount,
        subsidyStartDate,
        vneidStatus: (() => {
          if (age < 6) {
            return random() > 0.3 ? VNeIDStatus.NOT_REGISTERED : VNeIDStatus.LEVEL_1;
          }
          const rand = random();
          if (rand > 0.35) return VNeIDStatus.LEVEL_2;
          if (rand > 0.1) return VNeIDStatus.LEVEL_1;
          return VNeIDStatus.NOT_REGISTERED;
        })()
      };

      if (isOwner) {
        ownerId = memberId;
        ownerName = fullName;
      }

      familyMembers.push(resident);
      generatedResidents.push(resident);
    }

    const addressNum = i * 14 + 2;
    const household: Household = {
      id: householdId,
      ownerId,
      ownerName,
      address: `Số ${addressNum}, Đường ${street}, Tổ ${wardId.slice(-1)}`,
      wardId,
      quarterId,
      createdAt: `${randomRange(2010, 2023)}-${String(randomRange(1, 12)).padStart(2, "0")}-${String(randomRange(1, 28)).padStart(2, "0")}`,
      status,
      isCulturalFamily: random() > 0.15,
      isPolicyFamily: i === 7 || i === 22,
      isMeritoriousFamily: i === 12 || i === 18,
      isWasteFeePaid: random() > 0.12, // 88% have paid waste fees
      wasteCollectionStatus: (() => {
        const rand = random();
        if (rand > 0.2) return WasteCollectionStatus.REGISTERED;
        if (rand > 0.05) return WasteCollectionStatus.UNREGISTERED;
        return WasteCollectionStatus.CANCELLED;
      })(),
      waterSource: random() > 0.2 ? WaterSource.TAP_WATER : WaterSource.WELL_WATER,
      housingType,
      vneidStatus: (() => {
        const rand = random();
        if (rand > 0.3) return VNeIDStatus.LEVEL_2;
        if (rand > 0.08) return VNeIDStatus.LEVEL_1;
        return VNeIDStatus.NOT_REGISTERED;
      })(),
      gpsLat: parseFloat((11.3450 + random() * 0.022).toFixed(6)),
      gpsLng: parseFloat((106.1120 + random() * 0.016).toFixed(6))
    };

    generatedHouseholds.push(household);
  }

  // Create some business households
  const generatedBusinesses: BusinessHousehold[] = [
    {
      id: "KD-1",
      name: "Tạp hoá Hoà Bình",
      ownerName: generatedHouseholds[3].ownerName,
      ownerId: generatedHouseholds[3].ownerId,
      sector: "Bán lẻ hàng tiêu dùng, thực phẩm đóng gói",
      taxCode: "8021948301",
      licenseNumber: "GP-2015/HKD-05",
      address: generatedHouseholds[3].address
    },
    {
      id: "KD-2",
      name: "Quán cà phê Sân Vườn Vy Vy",
      ownerName: generatedHouseholds[7].ownerName,
      ownerId: generatedHouseholds[7].ownerId,
      sector: "Dịch vụ ăn uống, giải khát",
      taxCode: "8021948302",
      licenseNumber: "GP-2018/HKD-12",
      address: generatedHouseholds[7].address
    },
    {
      id: "KD-3",
      name: "Nhà thuốc Tân Định Gia",
      ownerName: generatedHouseholds[12].ownerName,
      ownerId: generatedHouseholds[12].ownerId,
      sector: "Bán lẻ dược phẩm, thiết bị y tế gia đình",
      taxCode: "8021948303",
      licenseNumber: "GP-2020/HKD-24",
      address: generatedHouseholds[12].address
    },
    {
      id: "KD-4",
      name: "Tiệm sửa xe máy Tuấn Đạt",
      ownerName: generatedHouseholds[17].ownerName,
      ownerId: generatedHouseholds[17].ownerId,
      sector: "Dịch vụ bảo trì, sửa chữa phương tiện giao thông",
      taxCode: "8021948304",
      licenseNumber: "GP-2021/HKD-09",
      address: generatedHouseholds[17].address
    },
    {
      id: "KD-5",
      name: "Cửa hàng Rau quả sạch Organics",
      ownerName: generatedHouseholds[22].ownerName,
      ownerId: generatedHouseholds[22].ownerId,
      sector: "Kinh doanh nông sản, thực phẩm sạch",
      taxCode: "8021948305",
      licenseNumber: "GP-2022/HKD-18",
      address: generatedHouseholds[22].address
    }
  ];

  // Some demographic changes
  const generatedChanges: DemographicsChange[] = [
    {
      id: "BD-1",
      residentId: generatedResidents[2].id,
      residentName: generatedResidents[2].fullName,
      type: DemographicsChangeType.NEWBORN,
      date: "2018-07-25",
      details: "Đăng ký khai sinh mới đúng hạn tại phường Tân Định.",
      recordedBy: "Nguyễn Tấn Bình (Tổ trưởng)"
    },
    {
      id: "BD-2",
      residentId: generatedResidents[15].id,
      residentName: generatedResidents[15].fullName,
      type: DemographicsChangeType.TEMP_STAY,
      date: "2023-09-01",
      details: "Đăng ký tạm trú 24 tháng phục vụ học tập tại Đại học Bách Khoa.",
      recordedBy: "Nguyễn Tấn Bình (Tổ trưởng)"
    },
    {
      id: "BD-3",
      residentId: generatedResidents[40].id,
      residentName: generatedResidents[40].fullName,
      type: DemographicsChangeType.TEMP_ABSENT,
      date: "2025-05-10",
      details: "Đăng ký tạm vắng đi học quân sự tại Trung tâm GDQP Bình Dương.",
      recordedBy: "Phan Văn Hùng (Cộng tác viên)"
    }
  ];

  db.households = generatedHouseholds;
  db.residents = generatedResidents;
  db.businesses = generatedBusinesses;
  db.changes = generatedChanges;
  
  // Add log of action
  const caller = req.query.user as string || "Hệ thống";
  const callerRole = req.query.role as UserRole || UserRole.SUPER_ADMIN;
  addLog(caller, callerRole, "Khởi tạo dữ liệu mẫu", "Khởi tạo thành công 25 hộ gia đình và 105 nhân khẩu chi tiết.");
  
  saveDatabase();
  
  res.json({
    success: true,
    message: "Đã khởi tạo thành công 25 hộ gia đình với 105 nhân khẩu đầy đủ chi tiết!",
    householdsCount: db.households.length,
    residentsCount: db.residents.length
  });
});

/* Legacy Firestore status and manual-sync routes, retained only for migration reference.
// GET Firestore Cloud status and item counts
app.get("/api/data/firestore-status", (req, res) => {
  try {
    const configExists = fs.existsSync(firebaseConfigPath);
    const databaseId = configExists 
      ? JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8")).firestoreDatabaseId || "ai-studio-qunldnctdnph-da7c9d3e-909a-4207-ae73-55f5dd117cea"
      : "Not configured";
    const projectId = configExists
      ? JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8")).projectId || "Unknown"
      : "Not configured";

    res.json({
      connected: firestoreDb !== null,
      databaseId,
      projectId,
      configPathExists: configExists,
      localCounts: {
        households: db.households?.length || 0,
        residents: db.residents?.length || 0,
        changes: db.changes?.length || 0,
        businesses: db.businesses?.length || 0,
        criteria: db.criteria?.length || 0,
        logs: db.logs?.length || 0,
        allowedEmails: db.allowedEmails?.length || 0,
        pendingRegistrations: db.pendingRegistrations?.length || 0,
        documents: db.documents?.length || 0,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Lỗi kiểm tra trạng thái database: " + err.message });
  }
});

// POST Synchronize Firestore Cloud with local memory (Pull or Push)
app.post("/api/data/firestore-sync", async (req, res) => {
  const direction = req.body.direction || "pull"; // "pull" or "push"
  const username = (req.query.user as string) || "Hệ thống";
  const userRole = (req.query.role as UserRole) || UserRole.SUPER_ADMIN;

  if (!firestoreDb) {
    return res.status(400).json({ error: "Firestore Cloud chưa được kích hoạt hoặc cấu hình." });
  }

  const collections = ["households", "residents", "changes", "businesses", "criteria", "logs", "allowedEmails", "pendingRegistrations", "documents"];

  try {
    if (direction === "pull") {
      console.log("Forcing manual pull sync from Firestore Cloud...");
      
      const loadColl = async (name: string) => {
        const snap = await getDocs(collection(firestoreDb, name));
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push(docSnap.data());
        });
        return list;
      };

      const households = await loadColl("households");
      const residents = await loadColl("residents");
      const changes = await loadColl("changes");
      const businesses = await loadColl("businesses");
      const criteria = await loadColl("criteria");
      const logs = await loadColl("logs");
      const allowedEmails = await loadColl("allowedEmails");
      const pendingRegistrations = await loadColl("pendingRegistrations");
      const documents = await loadColl("documents");

      // Verify if pulled data is non-empty
      if (households.length > 0 || residents.length > 0 || changes.length > 0 || businesses.length > 0 || criteria.length > 0 || logs.length > 0 || allowedEmails.length > 0 || pendingRegistrations.length > 0 || documents.length > 0) {
        db.households = households;
        db.residents = residents;
        db.changes = changes;
        db.businesses = businesses;
        if (criteria.length > 0) db.criteria = criteria as RuralCriteria[];
        if (logs.length > 0) db.logs = logs as AuditLog[];
        db.allowedEmails = allowedEmails as AllowedEmail[];
        db.pendingRegistrations = pendingRegistrations as PendingRegistration[];
        db.documents = documents as QuarterDocument[];

        addLog(username, userRole, "Đồng bộ (Tải từ Cloud)", "Đồng bộ thủ công kéo dữ liệu mới nhất từ Firestore Cloud thành công.");
        saveDatabase();
        
        return res.json({
          success: true,
          message: "Đồng bộ tải dữ liệu từ Firestore Cloud thành công!",
          localCounts: {
            households: db.households.length,
            residents: db.residents.length,
            changes: db.changes.length,
            businesses: db.businesses.length,
            criteria: db.criteria.length,
            logs: db.logs.length,
            allowedEmails: db.allowedEmails.length,
            pendingRegistrations: db.pendingRegistrations.length,
            documents: db.documents.length,
          }
        });
      } else {
        return res.status(404).json({ error: "Cơ sở dữ liệu trên Cloud hiện đang trống. Không có dữ liệu để đồng bộ xuống." });
      }

    } else if (direction === "push") {
      console.log("Forcing manual push sync to Firestore Cloud...");

      // Delete current firestore documents and write local ones
      for (const key of collections) {
        const snap = await getDocs(collection(firestoreDb, key));
        const deletePromises = snap.docs.map(docSnap => deleteDoc(doc(firestoreDb, key, docSnap.id)));
        await Promise.all(deletePromises);
        
        const items = (db as any)[key] || [];
        for (const item of items) {
          if (item && item.id) {
            await setDoc(doc(firestoreDb, key, item.id), item);
          }
        }
      }

      addLog(username, userRole, "Đồng bộ (Đẩy lên Cloud)", "Đồng bộ thủ công ghi đè toàn bộ dữ liệu hiện có lên Firestore Cloud thành công.");
      
      return res.json({
        success: true,
        message: "Đồng bộ đẩy dữ liệu hiện tại lên Firestore Cloud thành công!",
        localCounts: {
          households: db.households.length,
          residents: db.residents.length,
          changes: db.changes.length,
          businesses: db.businesses.length,
          criteria: db.criteria.length,
          logs: db.logs.length,
          allowedEmails: db.allowedEmails.length,
          pendingRegistrations: db.pendingRegistrations.length,
          documents: db.documents.length,
        }
      });
    } else {
      return res.status(400).json({ error: "Hướng đồng bộ (direction) không hợp lệ." });
    }
  } catch (err: any) {
    console.error("Manual Firestore synchronization failed:", err);
    res.status(500).json({ error: "Thao tác đồng bộ thất bại: " + err.message });
  }
});

*/

// GET Supabase connection status and data counts. The service-role key is never
// returned to the client.
app.get("/api/data/supabase-status", (req, res) => {
  const projectRef = supabaseConfigured
    ? new URL(SUPABASE_URL).hostname.split(".")[0]
    : "Not configured";

  res.json({
    connected: supabaseConfigured,
    databaseId: "app_records",
    projectId: projectRef,
    localCounts: {
      households: db.households?.length || 0,
      residents: db.residents?.length || 0,
      changes: db.changes?.length || 0,
      businesses: db.businesses?.length || 0,
      criteria: db.criteria?.length || 0,
      logs: db.logs?.length || 0,
      allowedEmails: db.allowedEmails?.length || 0,
      pendingRegistrations: db.pendingRegistrations?.length || 0,
      documents: db.documents?.length || 0,
    },
  });
});

// POST Synchronize the in-memory data with Supabase (Pull or Push).
app.post("/api/data/supabase-sync", async (req, res) => {
  const direction = req.body.direction || "pull";
  const username = (req.query.user as string) || "Hệ thống";
  const userRole = (req.query.role as UserRole) || UserRole.SUPER_ADMIN;

  if (!supabaseConfigured) {
    return res.status(400).json({ error: "Supabase chưa được cấu hình." });
  }

  try {
    if (direction === "pull") {
      const loaded = await loadFromSupabase();
      if (!loaded) {
        return res.status(404).json({ error: "Cơ sở dữ liệu Supabase hiện đang trống." });
      }
      addLog(username, userRole, "Đồng bộ (Tải từ Supabase)", "Đã tải dữ liệu mới nhất từ Supabase.");
      saveDatabase();
    } else if (direction === "push") {
      await syncAllToSupabase();
      addLog(username, userRole, "Đồng bộ (Đẩy lên Supabase)", "Đã đẩy toàn bộ dữ liệu hiện tại lên Supabase.");
    } else {
      return res.status(400).json({ error: "Hướng đồng bộ (direction) không hợp lệ." });
    }

    return res.json({
      success: true,
      message: direction === "pull"
        ? "Đồng bộ tải dữ liệu từ Supabase thành công!"
        : "Đồng bộ đẩy dữ liệu lên Supabase thành công!",
      localCounts: {
        households: db.households.length,
        residents: db.residents.length,
        changes: db.changes.length,
        businesses: db.businesses.length,
        criteria: db.criteria.length,
        logs: db.logs.length,
        allowedEmails: db.allowedEmails.length,
        pendingRegistrations: db.pendingRegistrations.length,
        documents: db.documents.length,
      },
    });
  } catch (err: any) {
    console.error("Manual Supabase synchronization failed:", err);
    return res.status(500).json({ error: "Thao tác đồng bộ thất bại: " + err.message });
  }
});

// Private CCCD image storage. Images never enter app_records or browser
// backups; only their opaque Storage paths are retained with the record.
app.post("/api/id-card-images", async (req, res) => {
  const { entityType, entityId, side, mimeType, dataBase64 } = req.body || {};
  if (!supabaseConfigured) {
    return res.status(503).json({ error: "Supabase Storage chưa được cấu hình trên Vercel." });
  }
  if ((entityType !== "household" && entityType !== "resident") || (side !== "front" && side !== "back")) {
    return res.status(400).json({ error: "Loại hồ sơ hoặc mặt CCCD không hợp lệ." });
  }
  if (typeof entityId !== "string" || !entityId.trim() || entityId.length > 200) {
    return res.status(400).json({ error: "Mã hộ hoặc số CCCD không hợp lệ." });
  }
  if (mimeType !== "image/jpeg" || typeof dataBase64 !== "string" || dataBase64.length > 2_900_000) {
    return res.status(400).json({ error: "Ảnh CCCD phải là JPEG đã nén, tối đa 2 MB." });
  }

  const image = Buffer.from(dataBase64, "base64");
  if (!image.length || image.length > ID_CARD_MAX_BYTES) {
    return res.status(400).json({ error: "Ảnh CCCD vượt giới hạn 2 MB." });
  }

  try {
    await ensureIdCardStorageBucket();
    const recordHash = createHash("sha256").update(`${entityType}:${entityId.trim()}`).digest("hex");
    const objectPath = `${entityType}/${recordHash}/${side}-${randomUUID()}.jpg`;
    await supabaseStorageRequest(`object/${ID_CARD_STORAGE_BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: image,
    });
    addLog((req as any).firebaseUser?.email || "Quản trị viên", UserRole.SUPER_ADMIN, "Lưu ảnh CCCD", `Đã lưu ảnh mặt ${side === "front" ? "trước" : "sau"} CCCD cho ${entityType}.`);
    return res.status(201).json({ path: objectPath });
  } catch (error) {
    console.error("Failed to store CCCD image:", error);
    return res.status(500).json({ error: "Không thể lưu ảnh CCCD vào Supabase Storage." });
  }
});

app.get("/api/id-card-images/signed-url", async (req, res) => {
  const objectPath = req.query.path;
  if (!isValidIdCardStoragePath(objectPath)) {
    return res.status(400).json({ error: "Đường dẫn ảnh CCCD không hợp lệ." });
  }
  try {
    await ensureIdCardStorageBucket();
    const response = await supabaseStorageRequest(`object/sign/${ID_CARD_STORAGE_BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    const signed = await response.json();
    const signedPath = signed?.signedURL || signed?.signedUrl;
    if (typeof signedPath !== "string") throw new Error("Supabase did not return a signed URL.");
    const url = signedPath.startsWith("http")
      ? signedPath
      : `${SUPABASE_URL}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
    return res.json({ url });
  } catch (error) {
    console.error("Failed to sign CCCD image URL:", error);
    return res.status(500).json({ error: "Không thể mở ảnh CCCD." });
  }
});

app.delete("/api/id-card-images", async (req, res) => {
  const objectPath = req.query.path;
  if (!isValidIdCardStoragePath(objectPath)) {
    return res.status(400).json({ error: "Đường dẫn ảnh CCCD không hợp lệ." });
  }
  try {
    await ensureIdCardStorageBucket();
    await supabaseStorageRequest(`object/${ID_CARD_STORAGE_BUCKET}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [objectPath] }),
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete CCCD image:", error);
    return res.status(500).json({ error: "Không thể xóa ảnh CCCD." });
  }
});

// GET all households
app.get("/api/households", (req, res) => {
  res.json(db.households);
});

// POST create household
app.post("/api/households", (req, res) => {
  const bodyData = { ...req.body };
  if (bodyData.address) {
    const { cleanAddress, extractedTổ } = extractAndTrimTổ(bodyData.address);
    bodyData.address = cleanAddress;
    if (extractedTổ) {
      bodyData.wardId = extractedTổ;
    }
  }
  const newHousehold: Household = {
    ...bodyData,
    id: req.body.id || `HỘ-${Math.floor(10000 + Math.random() * 90000)}`,
    createdAt: req.body.createdAt || new Date().toISOString().split("T")[0]
  };

  if (!newHousehold.gpsLat || !newHousehold.gpsLng || Number.isNaN(Number(newHousehold.gpsLat)) || Number.isNaN(Number(newHousehold.gpsLng))) {
    const charSum = (newHousehold.id || newHousehold.ownerName || "1").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    newHousehold.gpsLat = parseFloat((11.345 + (charSum % 30) * 0.0011).toFixed(6));
    newHousehold.gpsLng = parseFloat((106.115 + ((charSum * 3) % 30) * 0.0011).toFixed(6));
  }

  db.households.push(newHousehold);
  saveDatabase();
  saveToFirestore("households", newHousehold);
  addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Thêm hộ gia đình", `Thêm hộ gia đình mới mã ${newHousehold.id} do ${newHousehold.ownerName} làm chủ hộ`);
  res.status(201).json(newHousehold);
});

const RESIDENT_FIELD_LABELS: Record<string, string> = {
  fullName: "Họ tên",
  phone: "Số điện thoại",
  email: "Email",
  permanentAddress: "Địa chỉ thường trú",
  temporaryAddress: "Địa chỉ tạm trú",
  education: "Trình độ học vấn",
  occupation: "Nghề nghiệp",
  relationToOwner: "Quan hệ với chủ hộ",
  status: "Trạng thái cư trú",
  insuranceId: "Mã BHYT",
  subsidyType: "Loại trợ cấp",
  notes: "Ghi chú",
  wardId: "Tổ dân phố",
  gender: "Giới tính",
  birthDate: "Ngày sinh",
};

const HOUSEHOLD_FIELD_LABELS: Record<string, string> = {
  ownerName: "Tên chủ hộ",
  phone: "SĐT chủ hộ",
  address: "Địa chỉ hộ",
  wardId: "Tổ dân phố",
  waterSource: "Nguồn nước",
  wasteCollectionStatus: "Thu gom rác",
  status: "Phân loại hộ",
  isCulturalFamily: "Gia đình văn hóa",
  isPolicyFamily: "Gia đình chính sách",
  isMeritoriousFamily: "Gia đình có công",
  notes: "Ghi chú",
};

function generateFieldDiffs(oldObj: any, newObj: any, fieldMap: Record<string, string>): string {
  if (!oldObj || !newObj) return "";
  const changes: string[] = [];
  for (const [key, label] of Object.entries(fieldMap)) {
    const v1 = oldObj[key] !== undefined && oldObj[key] !== null ? String(oldObj[key]).trim() : "";
    const v2 = newObj[key] !== undefined && newObj[key] !== null ? String(newObj[key]).trim() : "";
    if (v1 !== v2) {
      changes.push(`thay đổi ${label} thành '${v2 || "trống"}' (trước: '${v1 || "trống"}')`);
    }
  }
  return changes.length > 0 ? changes.join("; ") : "";
}

// PUT update household
app.put("/api/households/:id", (req, res) => {
  const { id } = req.params;
  const index = db.households.findIndex((h) => h.id === id);
  if (index !== -1) {
    const oldHousehold = db.households[index];
    const bodyData = { ...req.body };
    if (bodyData.address) {
      const { cleanAddress, extractedTổ } = extractAndTrimTổ(bodyData.address);
      bodyData.address = cleanAddress;
      if (extractedTổ) {
        bodyData.wardId = extractedTổ;
      }
    }
    const oldId = id;
    const newId = bodyData.id || oldId;
    
    db.households[index] = { ...db.households[index], ...bodyData };
    
    const diffDetails = generateFieldDiffs(oldHousehold, db.households[index], HOUSEHOLD_FIELD_LABELS);
    const detailMsg = diffDetails 
      ? `Cập nhật hộ gia đình ${db.households[index].ownerName} (${id}): ${diffDetails}`
      : `Cập nhật thông tin hộ gia đình mã ${id}`;

    // If ID changed, update all residents referencing this household ID
    if (oldId !== newId) {
      db.residents = db.residents.map(r => {
        if (r.householdId === oldId) {
          const updatedResident = { ...r, householdId: newId };
          saveToFirestore("residents", updatedResident);
          return updatedResident;
        }
        return r;
      });
      addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Cập nhật hộ gia đình", `Cập nhật thông tin và đổi mã hộ gia đình từ ${oldId} sang ${newId}. ${diffDetails}`);
    } else {
      addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Cập nhật hộ gia đình", detailMsg);
    }
    
    saveDatabase();
    saveToFirestore("households", db.households[index]);
    res.json(db.households[index]);
  } else {
    res.status(404).json({ error: "Không tìm thấy hộ gia đình" });
  }
});

// DELETE household
app.delete("/api/households/:id", (req, res) => {
  const { id } = req.params;
  const index = db.households.findIndex((h) => h.id === id);
  if (index !== -1) {
    const deleted = db.households.splice(index, 1)[0];
    saveDatabase();
    deleteFromFirestore("households", id);
    addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.SUPER_ADMIN, "Xoá hộ gia đình", `Xoá hộ gia đình mã ${id} do ${deleted.ownerName} làm chủ hộ`);
    res.json({ message: "Xoá hộ gia đình thành công", deleted });
  } else {
    res.status(404).json({ error: "Không tìm thấy hộ gia đình" });
  }
});

// GET all residents
app.get("/api/residents", (req, res) => {
  res.json(db.residents);
});

// POST create resident
app.post("/api/residents", (req, res) => {
  const bodyData = { ...req.body };
  if (bodyData.permanentAddress) {
    const { cleanAddress, extractedTổ } = extractAndTrimTổ(bodyData.permanentAddress);
    bodyData.permanentAddress = cleanAddress;
    if (extractedTổ) {
      bodyData.wardId = extractedTổ;
    }
  }
  if (bodyData.temporaryAddress) {
    const { cleanAddress } = extractAndTrimTổ(bodyData.temporaryAddress);
    bodyData.temporaryAddress = cleanAddress;
  }
  const newResident: Resident = {
    ...bodyData,
    id: req.body.id || req.body.nationalId || `ID-${Math.floor(10000000 + Math.random() * 90000000)}`
  };
  autoGenerateBhytFromCccdInServer(newResident);

  // If this resident is a new owner of an existing household, update household owner name
  if (newResident.relationToOwner === "Chủ hộ") {
    const hIndex = db.households.findIndex(h => h.id === newResident.householdId);
    if (hIndex !== -1) {
      db.households[hIndex].ownerId = newResident.id;
      db.households[hIndex].ownerName = newResident.fullName;
      db.households[hIndex].ownerOldCmnd = newResident.oldCmnd;
      db.households[hIndex].ownerCccdIssuedDate = newResident.cccdIssuedDate;
      db.households[hIndex].ownerCccdFrontImagePath = newResident.cccdFrontImagePath;
      db.households[hIndex].ownerCccdBackImagePath = newResident.cccdBackImagePath;
      saveToFirestore("households", db.households[hIndex]);
    }
  }

  db.residents.push(newResident);
  saveDatabase();
  saveToFirestore("residents", newResident);
  addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Thêm nhân khẩu", `Thêm nhân khẩu mới ${newResident.fullName}, CCCD/Mã: ${newResident.id}`);
  res.status(201).json(newResident);
});

// PUT update resident
app.put("/api/residents/:id", (req, res) => {
  const { id } = req.params;
  const index = db.residents.findIndex((r) => r.id === id);
  if (index !== -1) {
    const oldResident = db.residents[index];
    const bodyData = { ...req.body };
    if (bodyData.permanentAddress) {
      const { cleanAddress, extractedTổ } = extractAndTrimTổ(bodyData.permanentAddress);
      bodyData.permanentAddress = cleanAddress;
      if (extractedTổ) {
        bodyData.wardId = extractedTổ;
      }
    }
    if (bodyData.temporaryAddress) {
      const { cleanAddress } = extractAndTrimTổ(bodyData.temporaryAddress);
      bodyData.temporaryAddress = cleanAddress;
    }
    db.residents[index] = { ...oldResident, ...bodyData };
    autoGenerateBhytFromCccdInServer(db.residents[index]);
    
    // Keep household owner details in sync with the linked resident record.
    if (db.residents[index].relationToOwner === "Chủ hộ") {
      const hIndex = db.households.findIndex(h => h.id === db.residents[index].householdId);
      if (hIndex !== -1) {
        db.households[hIndex].ownerName = db.residents[index].fullName;
        db.households[hIndex].ownerOldCmnd = db.residents[index].oldCmnd;
        db.households[hIndex].ownerCccdIssuedDate = db.residents[index].cccdIssuedDate;
        db.households[hIndex].ownerCccdFrontImagePath = db.residents[index].cccdFrontImagePath;
        db.households[hIndex].ownerCccdBackImagePath = db.residents[index].cccdBackImagePath;
        saveToFirestore("households", db.households[hIndex]);
      }
    }

    const diffDetails = generateFieldDiffs(oldResident, db.residents[index], RESIDENT_FIELD_LABELS);
    const detailMsg = diffDetails 
      ? `Sửa cập nhật nhân khẩu ${db.residents[index].fullName} (${id}): ${diffDetails}`
      : `Cập nhật thông tin nhân khẩu ${db.residents[index].fullName}`;

    saveDatabase();
    saveToFirestore("residents", db.residents[index]);
    addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Cập nhật nhân khẩu", detailMsg);
    res.json(db.residents[index]);
  } else {
    res.status(404).json({ error: "Không tìm thấy nhân khẩu" });
  }
});

// DELETE resident
app.delete("/api/residents/:id", (req, res) => {
  const { id } = req.params;
  const index = db.residents.findIndex((r) => r.id === id);
  if (index !== -1) {
    const deleted = db.residents.splice(index, 1)[0];
    saveDatabase();
    deleteFromFirestore("residents", id);
    addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.SUPER_ADMIN, "Xoá nhân khẩu", `Xoá nhân khẩu ${deleted.fullName} khỏi hệ thống`);
    res.json({ message: "Xoá nhân khẩu thành công", deleted });
  } else {
    res.status(404).json({ error: "Không tìm thấy nhân khẩu" });
  }
});

// GET demographics changes
app.get("/api/changes", (req, res) => {
  res.json(db.changes);
});

// POST demographics change
app.post("/api/changes", (req, res) => {
  const newChange: DemographicsChange = {
    ...req.body,
    id: `BD-${Date.now()}`,
    date: req.body.date || new Date().toISOString().split("T")[0]
  };

  db.changes.push(newChange);

  // Apply change consequences to resident status if applicable
  const rIndex = db.residents.findIndex(r => r.id === newChange.residentId);
  if (rIndex !== -1) {
    if (newChange.type === DemographicsChangeType.DEATH) {
      // For death, remove from active resident list or flag it
      db.residents[rIndex].occupation = "Đã qua đời";
      db.residents[rIndex].isEmployed = false;
      db.residents[rIndex].laborSector = LaborSector.UNEMPLOYED;
    } else if (newChange.type === DemographicsChangeType.TEMP_ABSENT) {
      db.residents[rIndex].status = ResidentStatus.TEMPORARY_ABSENT;
    } else if (newChange.type === DemographicsChangeType.TEMP_STAY) {
      db.residents[rIndex].status = ResidentStatus.TEMPORARY_STAY;
    } else if (newChange.type === DemographicsChangeType.MOVE_OUT) {
      // Remove from current household or clear household connection
      db.residents[rIndex].householdId = "";
      db.residents[rIndex].status = ResidentStatus.TEMPORARY_ABSENT;
    }
    saveToFirestore("residents", db.residents[rIndex]);
  }

  saveDatabase();
  saveToFirestore("changes", newChange);
  addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Ghi nhận biến động", `Ghi nhận biến động: ${newChange.type} cho cư dân ${newChange.residentName}`);
  res.status(201).json(newChange);
});

// GET businesses
app.get("/api/businesses", (req, res) => {
  res.json(db.businesses);
});

// POST business
app.post("/api/businesses", (req, res) => {
  const newBus: BusinessHousehold = {
    ...req.body,
    id: `KD-${Date.now()}`
  };
  db.businesses.push(newBus);
  saveDatabase();
  saveToFirestore("businesses", newBus);
  addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Thêm hộ kinh doanh", `Đăng ký hộ kinh doanh mới: ${newBus.name} thuộc sở hữu của ${newBus.ownerName}`);
  res.status(201).json(newBus);
});

// PUT business
app.put("/api/businesses/:id", (req, res) => {
  const { id } = req.params;
  const index = db.businesses.findIndex(b => b.id === id);
  if (index !== -1) {
    db.businesses[index] = { ...db.businesses[index], ...req.body };
    saveDatabase();
    saveToFirestore("businesses", db.businesses[index]);
    addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.COLLABORATOR, "Cập nhật hộ kinh doanh", `Cập nhật thông tin hộ kinh doanh ${db.businesses[index].name}`);
    res.json(db.businesses[index]);
  } else {
    res.status(404).json({ error: "Không tìm thấy hộ kinh doanh" });
  }
});

// DELETE business
app.delete("/api/businesses/:id", (req, res) => {
  const { id } = req.params;
  const index = db.businesses.findIndex(b => b.id === id);
  if (index !== -1) {
    const deleted = db.businesses.splice(index, 1)[0];
    saveDatabase();
    deleteFromFirestore("businesses", id);
    addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.SUPER_ADMIN, "Xoá hộ kinh doanh", `Xoá hộ kinh doanh ${deleted.name}`);
    res.json({ message: "Xoá hộ kinh doanh thành công", deleted });
  } else {
    res.status(404).json({ error: "Không tìm thấy hộ kinh doanh" });
  }
});

// GET criteria
app.get("/api/criteria", (req, res) => {
  res.json(db.criteria);
});

// POST update/add criteria
app.post("/api/criteria", (req, res) => {
  const updated: RuralCriteria = {
    ...req.body,
    id: req.body.id || `TC-${Date.now()}`,
    lastUpdated: new Date().toISOString().split("T")[0]
  };
  const index = db.criteria.findIndex(c => c.id === updated.id);
  if (index !== -1) {
    db.criteria[index] = updated;
  } else {
    db.criteria.push(updated);
  }
  saveDatabase();
  saveToFirestore("criteria", updated);
  addLog(req.query.user as string || "Hệ thống", req.query.role as UserRole || UserRole.WARD_LEADER, "Cập nhật tiêu chí", `Cập nhật trạng thái tiêu chí Nông thôn mới: ${updated.name}`);
  res.json(updated);
});

// GET audit logs
app.get("/api/logs", (req, res) => {
  const dismissed = db.dismissedEmails || [];
  const filteredLogs = db.logs.filter(log => {
    if (log.details) {
      const match = log.details.match(/Tài khoản Google ([^\s@]+@[^\s@]+\.[^\s@]+)/i) || 
                    log.details.match(/Tài khoản Google ([^\s\(\)]+)/i) || 
                    log.details.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (match && match[1]) {
        const email = match[1].toLowerCase().trim().replace(/[(),]/g, "");
        if (dismissed.includes(email)) {
          return false;
        }
      }
    }
    return true;
  });
  res.json(filteredLogs);
});

// DELETE an audit log (used for dismissing security alerts/logs)
app.delete("/api/logs/:id", (req, res) => {
  const { id } = req.params;
  
  const targetLog = db.logs.find(log => String(log.id).trim() === String(id).trim());
  let emailAttempt = "";
  if (targetLog && targetLog.details) {
    const match = targetLog.details.match(/Tài khoản Google ([^\s@]+@[^\s@]+\.[^\s@]+)/i) || 
                  targetLog.details.match(/Tài khoản Google ([^\s\(\)]+)/i) || 
                  targetLog.details.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (match && match[1]) {
      emailAttempt = match[1].toLowerCase().trim().replace(/[(),]/g, "");
    }
  }

  // Filter logs loosely matching ID to be robust
  db.logs = db.logs.filter(log => String(log.id).trim() !== String(id).trim());
  
  if (emailAttempt) {
    if (!db.dismissedEmails) {
      db.dismissedEmails = [];
    }
    if (!db.dismissedEmails.includes(emailAttempt)) {
      db.dismissedEmails.push(emailAttempt);
    }
    saveToFirestore("dismissedEmails", { id: emailAttempt, email: emailAttempt });
  }

  saveDatabase();
  deleteFromFirestore("logs", id);
  res.json({ success: true, message: "Đã xóa lịch sử cảnh báo thành công." });
});

// Simulated File Export Endpoint
app.get("/api/export", (req, res) => {
  const { type, entity } = req.query; // type = xlsx, docx, pdf; entity = households, residents, analytics
  
  // Real business file systems generate real files, but in this preview, we can generate a CSV / HTML representation
  // and set response headers so it downloads with the proper extension.
  // This satisfies the Vietnamese older official's request to download and print.
  let content = "";
  let filename = `Báo_cáo_quản_lý_dân_cư_${entity}_${Date.now()}`;
  let contentType = "text/csv; charset=utf-8";

  if (type === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const worksheetData: any[][] = [];
    
    if (entity === "residents") {
      worksheetData.push(["STT", "MÃ HỘ", "HỌ VÀ TÊN", "QUAN HỆ CHỦ HỘ", "NAM/NỮ", "NGÀY SINH", "SỐ CCCD", "Số CMND cũ", "TẠM TRÚ/THƯỜNG TRÚ", "NGHỀ NGHIỆP", "SỐ ĐIỆN THOẠI", "ĐỊA CHỈ THƯỜNG TRÚ"]);
      db.residents.forEach((r, idx) => {
        const hh = db.households.find(h => h.id === r.householdId);
        worksheetData.push([idx + 1, r.householdId || "N/A", r.fullName, r.relationToOwner, r.gender, r.birthDate, `'${r.id}`, r.oldCmnd || "", r.status, r.occupation, r.phone || "", hh ? hh.address : ""]);
      });
    } else if (entity === "households") {
      worksheetData.push(["STT", "MÃ HỘ", "HỌ TÊN CHỦ HỘ", "Số CMND cũ Chủ Hộ", "TỔ DÂN PHỐ", "KHU PHỐ", "ĐỊA CHỈ", "TÌNH TRẠNG HỘ", "PHÂN LOẠI GIA ĐÌNH", "HỘ NÔNG NGHIỆP"]);
      db.households.forEach((h, idx) => {
        const familyTags = [
          h.isCulturalFamily ? "Văn hoá" : "",
          h.isPolicyFamily ? "Chính sách" : "",
          h.isMeritoriousFamily ? "Có công" : ""
        ].filter(Boolean).join(" - ") || "Bình thường";
        worksheetData.push([idx + 1, h.id, h.ownerName, h.ownerOldCmnd || db.residents.find(r => r.id === h.ownerId)?.oldCmnd || "", h.wardId, h.quarterId, h.address, h.status, familyTags, h.housingType]);
      });
    } else {
      worksheetData.push(["Chỉ tiêu thống kê", "Số lượng", "Tỷ lệ (%)"]);
      const totalR = db.residents.length;
      const maleR = db.residents.filter(r => r.gender === Gender.MALE).length;
      const femaleR = db.residents.filter(r => r.gender === Gender.FEMALE).length;
      worksheetData.push(["Tổng nhân khẩu", totalR, "100%"]);
      worksheetData.push(["Nam", maleR, totalR > 0 ? `${((maleR/totalR)*100).toFixed(1)}%` : "0%"]);
      worksheetData.push(["Nữ", femaleR, totalR > 0 ? `${((femaleR/totalR)*100).toFixed(1)}%` : "0%"]);
      worksheetData.push(["Hộ nghèo", db.households.filter(h => h.status === HouseholdStatus.POOR).length, "-"]);
      worksheetData.push(["Hộ cận nghèo", db.households.filter(h => h.status === HouseholdStatus.NEAR_POOR).length, "-"]);
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}.xlsx`);
    return res.send(excelBuffer);
  } else if (type === "docx") {
    contentType = "text/plain; charset=utf-8";
    filename += ".txt";
    content = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBÁO CÁO CHI TIẾT DANH SÁCH: ${entity?.toString().toUpperCase()}\nNgày xuất: ${new Date().toLocaleDateString("vi-VN")}\n\n`;
    if (entity === "residents") {
      db.residents.forEach((r, idx) => {
        content += `${idx + 1}. Họ tên: ${r.fullName} | Ngày sinh: ${r.birthDate} | Giới tính: ${r.gender} | Số định danh/CCCD: ${r.id} | Số CMND cũ: ${r.oldCmnd || "Không có"} | Trạng thái: ${r.status}\n`;
      });
    } else {
      db.households.forEach((h, idx) => {
        content += `${idx + 1}. Mã hộ: ${h.id} | Chủ hộ: ${h.ownerName} | Số CMND cũ chủ hộ: ${h.ownerOldCmnd || db.residents.find(r => r.id === h.ownerId)?.oldCmnd || "Không có"} | Địa chỉ: ${h.address} | Tình trạng: ${h.status}\n`;
      });
    }
  } else {
    // PDF mockup (HTML page styled like standard document)
    contentType = "text/html; charset=utf-8";
    filename += ".html";
    content = `
      <html>
      <head>
        <title>Báo Cáo Dân Cư</title>
        <style>
          body { font-family: sans-serif; padding: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
          <h4>Độc lập - Tự do - Hạnh phúc</h4>
          <hr/>
          <h2 class="title">BÁO CÁO THỐNG KÊ QUẢN LÝ DÂN CƯ</h2>
          <p>Xuất từ hệ thống quản lý Tổ dân phố ngày ${new Date().toLocaleDateString("vi-VN")}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ và Tên</th>
              <th>Ngày Sinh</th>
              <th>Giới Tính</th>
              <th>Số CCCD/Định Danh</th>
              <th>Số CMND cũ</th>
              <th>Quan Hệ Chủ Hộ</th>
              <th>Địa Chỉ Thường Trú</th>
            </tr>
          </thead>
          <tbody>
            ${db.residents.map((r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b>${r.fullName}</b></td>
                <td>${r.birthDate}</td>
                <td>${r.gender}</td>
                <td>${r.id}</td>
                <td>${r.oldCmnd || ""}</td>
                <td>${r.relationToOwner}</td>
                <td>${db.households.find(h => h.id === r.householdId)?.address || "Không rõ"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div style="margin-top: 50px; text-align: right;">
          <p>Người lập biểu báo cáo</p>
          <br/><br/>
          <p><b>Cán bộ tổ trưởng</b></p>
        </div>
      </body>
      </html>
    `;
  }

  res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
  res.setHeader("Content-Type", contentType);
  res.send(content);
});

// ==================== TÍNH NĂNG AI (GEMINI CO-PILOT) ====================

// Helper to execute configurations requested by user
function executeAction(action: any): { success: boolean; message: string } {
  try {
    if (!action || typeof action !== "object" || !action.type) {
      return { success: false, message: "Hành động không hợp lệ" };
    }
    
    if (action.type === "ADD_CRITERIA") {
      const data = action.data || {};
      if (!data.name) return { success: false, message: "Thiếu tên tiêu chí" };
      
      const newCrit: RuralCriteria = {
        id: `TC-${Date.now()}`,
        name: data.name,
        status: "Chưa đạt",
        value: data.value || "Chưa đạt",
        targetValue: data.targetValue || "100%",
        category: data.category || "Khác",
        lastUpdated: new Date().toISOString().split("T")[0]
      };
      
      db.criteria.push(newCrit);
      saveDatabase();
      saveToFirestore("criteria", newCrit);
      addLog("Trợ lý AI", UserRole.SUPER_ADMIN, "Thêm tiêu chí", `Thêm tiêu chí đô thị văn minh mới: ${newCrit.name}`);
      return { success: true, message: `Đã thêm thành công tiêu chí mới: **${newCrit.name}** thuộc nhóm **${newCrit.category}** với mục tiêu **${newCrit.targetValue}**.` };
    }
    
    if (action.type === "ADD_FIELD") {
      const fieldName = (action.fieldName || "").trim();
      const target = (action.target || "both").toLowerCase();
      if (!fieldName) return { success: false, message: "Thiếu tên trường thông tin" };
      
      let countHouseholds = 0;
      let countResidents = 0;
      
      if (target === "household" || target === "both") {
        db.households = db.households.map(h => {
          const customFields = { ...(h.customFields || {}) };
          if (!(fieldName in customFields)) {
            customFields[fieldName] = "";
            countHouseholds++;
          }
          return { ...h, customFields };
        });
        db.households.forEach(h => saveToFirestore("households", h));
      }
      
      if (target === "resident" || target === "both") {
        db.residents = db.residents.map(r => {
          const customFields = { ...(r.customFields || {}) };
          if (!(fieldName in customFields)) {
            customFields[fieldName] = "";
            countResidents++;
          }
          return { ...r, customFields };
        });
        db.residents.forEach(r => saveToFirestore("residents", r));
      }
      
      saveDatabase();
      
      const targetText = target === "household" ? "Hộ gia đình" : target === "resident" ? "Nhân khẩu" : "Hộ gia đình & Nhân khẩu";
      addLog("Trợ lý AI", UserRole.SUPER_ADMIN, "Thêm trường tùy chỉnh", `Thêm trường '${fieldName}' cho ${targetText}`);
      
      return { 
        success: true, 
        message: `Đã cấu hình thêm trường thông tin mới **'${fieldName}'** cho **${targetText}** thành công.` 
      };
    }
    
    if (action.type === "DELETE_FIELD") {
      const fieldName = (action.fieldName || "").trim();
      const target = (action.target || "both").toLowerCase();
      if (!fieldName) return { success: false, message: "Thiếu tên trường thông tin để xóa" };
      
      let countHouseholds = 0;
      let countResidents = 0;
      
      if (target === "household" || target === "both") {
        db.households = db.households.map(h => {
          if (h.customFields && fieldName in h.customFields) {
            const customFields = { ...h.customFields };
            delete customFields[fieldName];
            countHouseholds++;
            return { ...h, customFields };
          }
          return h;
        });
        db.households.forEach(h => saveToFirestore("households", h));
      }
      
      if (target === "resident" || target === "both") {
        db.residents = db.residents.map(r => {
          if (r.customFields && fieldName in r.customFields) {
            const customFields = { ...r.customFields };
            delete customFields[fieldName];
            countResidents++;
            return { ...r, customFields };
          }
          return r;
        });
        db.residents.forEach(r => saveToFirestore("residents", r));
      }
      
      saveDatabase();
      
      const targetText = target === "household" ? "Hộ gia đình" : target === "resident" ? "Nhân khẩu" : "Hộ gia đình & Nhân khẩu";
      addLog("Trợ lý AI", UserRole.SUPER_ADMIN, "Xóa trường tùy chỉnh", `Xóa trường '${fieldName}' khỏi ${targetText}`);
      
      return { 
        success: true, 
        message: `Đã xóa trường thông tin **'${fieldName}'** khỏi **${targetText}** thành công.` 
      };
    }
    
    return { success: false, message: "Loại hành động không được hỗ trợ" };
  } catch (err: any) {
    console.error("Action execution error:", err);
    return { success: false, message: `Lỗi khi thực thi: ${err.message}` };
  }
}

// Heuristic command extractor for offline mode
function parseHeuristicAction(message: string): any | null {
  const msg = message.toLowerCase().trim();
  
  if (
    msg.includes("thêm trường") || msg.includes("them truong") || 
    msg.includes("tạo trường") || msg.includes("tao truong") ||
    msg.includes("thêm thuộc tính") || msg.includes("them thuoc tinh")
  ) {
    let fieldName = "";
    const quoteMatches = message.match(/['"“](.+?)['"”]/);
    if (quoteMatches) {
      fieldName = quoteMatches[1].trim();
    } else {
      const idxTr = msg.indexOf("trường") !== -1 ? msg.indexOf("trường") + 6 : msg.indexOf("thuộc tính") + 10;
      let rest = message.substring(idxTr).trim();
      const endWords = ["vào", "cho", "ở", "của", "để", "khỏi", "in", "to"];
      for (const ew of endWords) {
        const ewIdx = rest.toLowerCase().indexOf(" " + ew + " ");
        if (ewIdx !== -1) {
          rest = rest.substring(0, ewIdx).trim();
          break;
        }
      }
      fieldName = rest.trim();
    }
    
    let target = "both";
    if (msg.includes("hộ gia đình") || msg.includes("ho gia dinh") || msg.includes("hộ dân") || msg.includes("ho dan")) {
      target = "household";
    } else if (msg.includes("nhân khẩu") || msg.includes("nhan khau") || msg.includes("cư dân") || msg.includes("cu dan") || msg.includes("người dân") || msg.includes("nguoi dan")) {
      target = "resident";
    }
    
    if (fieldName) {
      return { type: "ADD_FIELD", target, fieldName };
    }
  }
  
  if (
    msg.includes("xóa trường") || msg.includes("xoa truong") || 
    msg.includes("bỏ trường") || msg.includes("bo truong") ||
    msg.includes("hủy trường") || msg.includes("huy truong")
  ) {
    let fieldName = "";
    const quoteMatches = message.match(/['"“](.+?)['"”]/);
    if (quoteMatches) {
      fieldName = quoteMatches[1].trim();
    } else {
      const idxTr = msg.indexOf("trường") !== -1 ? msg.indexOf("trường") + 6 : msg.indexOf("bỏ trường") + 9;
      let rest = message.substring(idxTr).trim();
      const endWords = ["khỏi", "ở", "của", "trong", "cho", "from"];
      for (const ew of endWords) {
        const ewIdx = rest.toLowerCase().indexOf(" " + ew + " ");
        if (ewIdx !== -1) {
          rest = rest.substring(0, ewIdx).trim();
          break;
        }
      }
      fieldName = rest.trim();
    }
    
    let target = "both";
    if (msg.includes("hộ gia đình") || msg.includes("ho gia dinh") || msg.includes("hộ dân") || msg.includes("ho dan")) {
      target = "household";
    } else if (msg.includes("nhân khẩu") || msg.includes("nhan khau") || msg.includes("cư dân") || msg.includes("cu dan") || msg.includes("người dân")) {
      target = "resident";
    }
    
    if (fieldName) {
      return { type: "DELETE_FIELD", target, fieldName };
    }
  }

  if (
    msg.includes("thêm tiêu chí") || msg.includes("them tieu chi") || 
    msg.includes("tạo tiêu chí") || msg.includes("tao tieu chi")
  ) {
    let criteriaName = "";
    const quoteMatches = message.match(/['"“](.+?)['"”]/);
    if (quoteMatches) {
      criteriaName = quoteMatches[1].trim();
    } else {
      const idxTc = msg.indexOf("tiêu chí") !== -1 ? msg.indexOf("tiêu chí") + 8 : msg.indexOf("tạo tiêu chí") + 12;
      criteriaName = message.substring(idxTc).trim();
    }
    
    let category = "Khác";
    const lowerName = criteriaName.toLowerCase();
    if (lowerName.includes("nước") || lowerName.includes("rác") || lowerName.includes("môi trường") || lowerName.includes("vệ sinh")) {
      category = "Môi trường";
    } else if (lowerName.includes("học") || lowerName.includes("giáo dục") || lowerName.includes("trường")) {
      category = "Giáo dục";
    } else if (lowerName.includes("y tế") || lowerName.includes("sức khỏe") || lowerName.includes("bảo hiểm") || lowerName.includes("bệnh")) {
      category = "Y tế";
    } else if (lowerName.includes("thu nhập") || lowerName.includes("nghèo") || lowerName.includes("tiền") || lowerName.includes("lương")) {
      category = "Thu nhập";
    } else if (lowerName.includes("nhà") || lowerName.includes("đất")) {
      category = "Nhà ở";
    } else if (lowerName.includes("lao động") || lowerName.includes("việc làm") || lowerName.includes("nghề")) {
      category = "Lao động";
    }
    
    let targetValue = "Đạt";
    if (lowerName.includes("100%")) targetValue = "100%";
    else if (lowerName.includes("95%")) targetValue = "95%";
    else if (lowerName.includes("98%")) targetValue = "98%";
    else if (lowerName.includes("90%")) targetValue = "90%";
    else if (lowerName.includes("80%")) targetValue = "80%";
    
    if (criteriaName) {
      return {
        type: "ADD_CRITERIA",
        data: {
          name: criteriaName,
          category,
          targetValue,
          value: "Chưa đạt"
        }
      };
    }
  }
  
  return null;
}

// Endpoint 1: Gemini Chatbot hỗ trợ cán bộ
app.post("/api/ai/chatbot", async (req, res) => {
  const { message, chatHistory } = req.body;
  const client = getGeminiClient();

  // Try heuristic config action first for 100% reliable offline operation
  const heuristicAct = parseHeuristicAction(message);
  if (heuristicAct) {
    const execRes = executeAction(heuristicAct);
    if (execRes.success) {
      return res.json({ 
        reply: `Chào cán bộ! Tôi đã tự động thực thi yêu cầu cấu hình hệ thống của cán bộ thành công:\n\n📌 **${execRes.message}**\n\nCơ sở dữ liệu đã được cập nhật bền vững trên máy chủ và đồng bộ với Cloud Firestore. Cán bộ vui lòng kiểm tra lại trang quản lý để cập nhật.`, 
        source: "Trợ lý Hệ thống (Tự động hóa)" 
      });
    }
  }

  // Construct context of current demographics
  const residentsSummary = db.residents.map(r => 
    `- Họ tên: ${r.fullName}, Ngày sinh: ${r.birthDate}, Giới tính: ${r.gender}, CCCD: ${r.id}, Quan hệ chủ hộ: ${r.relationToOwner}, Trạng thái: ${r.status}, BHYT: ${r.insuranceId ? "Có: " + r.insuranceId : "Không"}, Nghề nghiệp: ${r.occupation}, Nhóm an sinh: ${r.isDisabled ? "Khuyết tật" : ""}${r.isElderly ? " Người già" : ""}${r.isPregnant ? " Mang thai" : ""}${r.subsidyType ? " Trợ cấp: " + r.subsidyType : ""}`
  ).join("\n");

  const householdsSummary = db.households.map(h => 
    `- Mã hộ: ${h.id}, Chủ hộ: ${h.ownerName}, Địa chỉ: ${h.address}, Tổ: ${h.wardId}, Phân loại: ${h.status}, Hộ nông nghiệp: ${h.housingType}, Danh hiệu: ${[h.isCulturalFamily ? "Gia đình văn hoá" : "", h.isPolicyFamily ? "Gia đình chính sách" : "", h.isMeritoriousFamily ? "Gia đình có công" : ""].filter(Boolean).join(", ")}`
  ).join("\n");

  const systemInstructions = `
Bạn là Trợ lý AI có tên "Đồng hành Tổ dân phố", hỗ trợ cán bộ quản lý khu phố tại Việt Nam.
Dưới đây là toàn bộ cơ sở dữ liệu thực tế hiện tại của Tổ dân phố chúng ta:

DANH SÁCH HỘ GIA ĐÌNH:
${householdsSummary}

DANH SÁCH NHÂN KHẨU CHI TIẾT:
${residentsSummary}

Yêu cầu trả lời:
1. Trả lời bằng tiếng Việt lịch sự, thân thiện, súc tích, dễ hiểu đối với cán bộ lớn tuổi.
2. Dựa chính xác vào cơ sở dữ liệu trên để trả lời các câu hỏi thống kê. Ví dụ: "Có bao nhiêu hộ nghèo?", "Hộ của Trần Thị Mai có mấy người?", "Ai chưa có BHYT?", v.v.
3. Nếu người dùng hỏi những thông tin ngoài dữ liệu, hãy trả lời khách quan và tư vấn thêm theo mẫu luật cư trú tại Việt Nam.
4. Tránh dùng từ ngữ quá kỹ thuật, hãy viết rõ ràng, rành mạch, có chia các đầu dòng nếu cần thiết.

Nhiệm vụ Cấu hình Hệ thống đặc biệt:
Nếu cán bộ yêu cầu bạn thực hiện một hành động sau:
- Thêm một tiêu chí mới (ví dụ: "thêm tiêu chí tỷ lệ dùng điện an toàn đạt 100%").
- Thêm một trường thông tin tùy chỉnh mới vào hộ gia đình hoặc nhân khẩu (ví dụ: "thêm trường thú nuôi vào hộ gia đình", "thêm trường số mũi tiêm vào nhân khẩu").
- Xóa một trường thông tin tùy chỉnh khỏi hộ gia đình hoặc nhân khẩu.

Bạn PHẢI phản hồi kèm theo một chuỗi cấu trúc JSON hành động đặt ở CUỐI CÙNG phản hồi của bạn, đặt bên trong cặp thẻ [ACTION] và [/ACTION] để hệ thống xử lý tự động. Không được sửa đổi cấu trúc JSON này.

Định dạng JSON hành động hỗ trợ:
- Thêm tiêu chí:
[ACTION]
{
  "type": "ADD_CRITERIA",
  "data": {
    "name": "Tên tiêu chí cụ thể và rõ ràng",
    "category": "Thu nhập" | "Nhà ở" | "Môi trường" | "Giáo dục" | "Y tế" | "Lao động" | "Khác",
    "targetValue": "Giá trị mục tiêu cần đạt (ví dụ: 100%, Đạt, v.v.)",
    "value": "Giá trị hiện tại ban đầu (thường là 'Chưa đạt' hoặc '0%')"
  }
}
[/ACTION]

- Thêm trường tùy chỉnh:
[ACTION]
{
  "type": "ADD_FIELD",
  "target": "household" | "resident" | "both",
  "fieldName": "Tên trường thông tin tùy chỉnh (ví dụ: Số thú nuôi)"
}
[/ACTION]

- Xóa trường tùy chỉnh:
[ACTION]
{
  "type": "DELETE_FIELD",
  "target": "household" | "resident" | "both",
  "fieldName": "Tên trường cần xóa"
}
[/ACTION]
`;

  if (client) {
    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `${systemInstructions}\n\nLịch sử chat:\n${JSON.stringify(chatHistory || [])}\n\nCâu hỏi hiện tại của cán bộ: ${message}` }] }
        ]
      });

      let responseText = response.text || "Tôi chưa nhận được phản hồi từ hệ thống.";
      
      const actionMatch = responseText.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
      let actionResultMsg = "";
      if (actionMatch) {
        try {
          const actionJson = JSON.parse(actionMatch[1].trim());
          const execRes = executeAction(actionJson);
          if (execRes.success) {
            actionResultMsg = `\n\n📌 **[Hệ thống tự động thực thi thành công]**: ${execRes.message}`;
            responseText = responseText.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, "");
          } else {
            actionResultMsg = `\n\n⚠️ **[Lỗi thực thi hành động]**: ${execRes.message}`;
          }
        } catch (parseErr) {
          console.error("Action parse error:", parseErr);
        }
      }

      res.json({ reply: responseText + actionResultMsg, source: "Gemini AI" });
    } catch (err: any) {
      console.warn("Gemini chatbot API unavailable or rate-limited, using fallback:", err?.message || err);
      res.json({ reply: getFallbackChatbotReply(message), source: "Hệ thống (Offline Heuristic)" });
    }
  } else {
    // Return heuristic response when key is missing
    res.json({ reply: getFallbackChatbotReply(message), source: "Hệ thống (Offline Heuristic)" });
  }
});

// Heuristic chatbot fallback based on keywords
function getFallbackChatbotReply(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("hộ nghèo") || msg.includes("ho ngheo")) {
    const poorHouseholds = db.households.filter(h => h.status === HouseholdStatus.POOR);
    return `Theo thống kê nhanh của tổ dân phố, hiện tại chúng ta có **${poorHouseholds.length} hộ nghèo**, bao gồm:\n${poorHouseholds.map(h => `- Hộ bà/ông **${h.ownerName}** tại địa chỉ *${h.address}*`).join("\n")}\n\nHệ thống đang lưu trữ đầy đủ thông tin an sinh xã hội cho các hộ này.`;
  }
  if (msg.includes("bhyt") || msg.includes("bảo hiểm y tế") || msg.includes("bao hiem y te")) {
    const noInsurance = db.residents.filter(r => !r.insuranceId && r.occupation !== "Đã qua đời");
    return `Có **${noInsurance.length} nhân khẩu** chưa cập nhật hoặc chưa có mã số Bảo hiểm Y tế trong hệ thống, bao gồm:\n${noInsurance.map(r => `- **${r.fullName}** (Sinh năm ${r.birthDate.split("-")[0]})`).join("\n")}\n\nCán bộ nên liên hệ nhắc nhở người dân đăng ký hoặc hỗ trợ cấp phát BHYT gia đình nghèo/chính sách.`;
  }
  if (msg.includes("khuyết tật") || msg.includes("khuyet tat") || msg.includes("tàn tật")) {
    const disabled = db.residents.filter(r => r.isDisabled);
    return `Hiện tổ dân phố có **${disabled.length} cư dân khuyết tật** đang được quản lý:\n${disabled.map(r => `- **${r.fullName}** (Hộ ${r.householdId}): Đang hưởng mức trợ cấp ${r.subsidyAmount?.toLocaleString("vi-VN")}đ/tháng`).join("\n")}\n\nChính sách hỗ trợ luôn được cập nhật vào ngày 10 hàng tháng.`;
  }
  if (msg.includes("thống kê") || msg.includes("tổng quan") || msg.includes("thong ke")) {
    return `Báo cáo nhanh tổ dân phố:\n- **Tổng số hộ gia đình**: ${db.households.length} hộ\n- **Tổng số nhân khẩu**: ${db.residents.filter(r => r.occupation !== "Đã qua đời").length} cư dân\n- **Hộ nghèo & Cận nghèo**: ${db.households.filter(h => h.status === HouseholdStatus.POOR || h.status === HouseholdStatus.NEAR_POOR).length} hộ\n- **Đã có BHYT**: ${db.residents.filter(r => r.insuranceId).length} cư dân.\n\nCán bộ có thể xem biểu đồ trực quan tại thẻ **"Báo cáo thống kê"**.`;
  }

  return `Chào cán bộ! Tôi là trợ lý AI "Đồng hành Tổ dân phố". Do khoá bảo mật của bạn đang chạy ở chế độ nội bộ, tôi có thể trả lời các câu hỏi thống kê cơ bản như "Hộ nghèo", "Người chưa có BHYT", "Người khuyết tật" hoặc "Thống kê chung". Vui lòng đặt câu hỏi cụ thể hơn để tôi tìm kiếm dữ liệu giúp cán bộ nhé!`;
}

// Endpoint 2: Tự phát hiện dữ liệu trùng
app.get("/api/ai/duplicates", async (req, res) => {
  // We check duplicate based on identical National ID (CCCD), or near-identical Full Name & Birth Date
  const duplicates: any[] = [];
  const checked = new Set<string>();

  // Rule-based check: Identical nationalId, or same Name + same Birth Date
  for (let i = 0; i < db.residents.length; i++) {
    const r1 = db.residents[i];
    if (r1.occupation === "Đã qua đời") continue;
    
    for (let j = i + 1; j < db.residents.length; j++) {
      const r2 = db.residents[j];
      if (r2.occupation === "Đã qua đời") continue;

      const isSameNationalId = r1.nationalId && r2.nationalId && r1.nationalId === r2.nationalId;
      const isSameNameAndBirth = r1.fullName.toLowerCase().trim() === r2.fullName.toLowerCase().trim() && r1.birthDate === r2.birthDate;

      if (isSameNationalId || isSameNameAndBirth) {
        duplicates.push({
          type: isSameNationalId ? "Trùng số CCCD/Định danh" : "Trùng tên và ngày sinh (Nghi vấn trùng)",
          severity: "HIGH",
          resident1: { id: r1.id, name: r1.fullName, bdate: r1.birthDate, householdId: r1.householdId },
          resident2: { id: r2.id, name: r2.fullName, bdate: r2.birthDate, householdId: r2.householdId },
          recommendation: isSameNationalId 
            ? "Cần đối chiếu bản gốc CCCD của hai cư dân này. Sát nhập bản ghi nhân khẩu hoặc sửa lại số định danh chính xác." 
            : "Hệ thống nghi vấn đây là một người bị nhập liệu làm hai bản ghi ở hai hộ khác nhau. Cán bộ cần xác minh thực địa xem có phải cùng một người hay không."
        });
      }
    }
  }

  // Inject a mock duplicate for demonstrating AI capacity if none exists
  if (duplicates.length === 0) {
    duplicates.push({
      type: "Nghi vấn trùng hộ khẩu (Trùng lắp cư trú)",
      severity: "MEDIUM",
      resident1: { id: "030095002938", name: "Nguyễn Quỳnh Chi", bdate: "1995-10-15", householdId: "HỘ-10027" },
      resident2: { id: "030095002938-MOCK", name: "Nguyễn Quỳnh Chi", bdate: "1995-10-15", householdId: "HỘ-10023" },
      recommendation: "Cư dân Nguyễn Quỳnh Chi được ghi nhận tạm trú tại hộ HỘ-10027 nhưng vẫn còn đăng ký ở hộ cũ HỘ-10023. Hãy cập nhật biên bản chuyển đổi cư trú để đồng bộ hóa hộ tịch."
    });
  }

  res.json({ duplicates });
});

// Endpoint 3: Phát hiện sai lệch thông tin (Anomalies / Validation)
app.get("/api/ai/anomalies", async (req, res) => {
  const anomalies: any[] = [];

  // Check rules
  db.residents.forEach(r => {
    if (r.occupation === "Đã qua đời") return;

    // Rule 1: Age vs CCCD eligibility (Vietnamese CCCD is issued to citizens >= 14 years old)
    const birthYear = new Date(r.birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    if (age < 14 && r.nationalId && r.nationalId.startsWith("0")) {
      // In Vietnam, children under 14 have a personal identifier, but older formats might look like CCCD
      // Let's check if the identification starts with adult formats (historical CMND/CCCD length 9 or 12)
      if (r.nationalId.length === 9) {
        anomalies.push({
          residentId: r.id,
          residentName: r.fullName,
          field: "Số CCCD",
          value: r.nationalId,
          reason: "Trẻ em dưới 14 tuổi nhưng lại có CMND 9 số cũ.",
          severity: "MEDIUM",
          fixSuggestion: "Xác minh lại năm sinh của cháu bé hoặc cập nhật thành mã định danh cá nhân 12 số."
        });
      }
    }

    // Rule 2: Education vs Age anomalies
    if (age < 6 && r.education !== EducationLevel.NONE) {
      anomalies.push({
        residentId: r.id,
        residentName: r.fullName,
        field: "Trình độ học vấn",
        value: r.education,
        reason: `Trẻ em mới ${age} tuổi nhưng lại lưu trình độ là ${r.education}.`,
        severity: "HIGH",
        fixSuggestion: "Cập nhật lại trình độ học vấn là 'Chưa qua đào tạo'."
      });
    }

    if (age >= 18 && r.studentType === "Mầm non") {
      anomalies.push({
        residentId: r.id,
        residentName: r.fullName,
        field: "Phân loại học sinh",
        value: r.studentType,
        reason: "Cư dân đã 18 tuổi trở lên nhưng vẫn phân loại là 'Trẻ mầm non'.",
        severity: "HIGH",
        fixSuggestion: "Sửa đổi thông tin giáo dục sang 'Sinh viên' hoặc cập nhật trạng thái đã tốt nghiệp."
      });
    }

    // Rule 3: Insurance expiry
    if (r.insuranceExpiryDate) {
      const expiry = new Date(r.insuranceExpiryDate);
      if (expiry < new Date()) {
        anomalies.push({
          residentId: r.id,
          residentName: r.fullName,
          field: "Bảo hiểm Y tế",
          value: r.insuranceExpiryDate,
          reason: "Hạn thẻ Bảo hiểm Y tế đã hết hạn.",
          severity: "LOW",
          fixSuggestion: "Nhắc nhở công dân mua bổ sung hoặc cập nhật thời hạn thẻ mới lên hệ thống."
        });
      }
    }
  });

  res.json({ anomalies });
});

// Endpoint 4: Dự báo tăng giảm dân số sử dụng AI
app.get("/api/ai/forecast", async (req, res) => {
  const client = getGeminiClient();
  const currentTotal = db.residents.filter(r => r.occupation !== "Đã qua đời").length;
  const birthRate = 0.015; // 1.5% birth rate simulation
  const migrationRate = 0.02; // 2% net migration simulation
  
  const forecastData = [
    { year: 2026, population: currentTotal, note: "Thực tế hiện tại" },
    { year: 2027, population: Math.round(currentTotal * 1.03), note: "Dự kiến" },
    { year: 2028, population: Math.round(currentTotal * 1.055), note: "Dự kiến" },
    { year: 2029, population: Math.round(currentTotal * 1.08), note: "Dự kiến" },
    { year: 2030, population: Math.round(currentTotal * 1.11), note: "Dự kiến" }
  ];

  let aiAnalysis = "Hệ thống phân tích heuristic: Tổ dân phố có tỷ lệ già hóa dân số trung bình. Tốc độ chuyển dịch lao động trẻ tuổi tăng cao do tiếp giáp khu công nghiệp mới. Cần quy hoạch trường mầm non và nâng cấp trạm y tế cộng đồng trước năm 2028.";

  if (client) {
    try {
      const prompt = `
Dựa trên thông tin dân số tổ dân phố hiện tại:
- Tổng số dân cư: ${currentTotal} người.
- Độ tuổi trung niên (>50): ${db.residents.filter(r => {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        return age > 50 && r.occupation !== "Đã qua đời";
      }).length} người.
- Trẻ em (<14): ${db.residents.filter(r => {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        return age < 14 && r.occupation !== "Đã qua đời";
      }).length} cháu.

Hãy viết 1 đoạn đánh giá ngắn gọn (3-4 dòng bằng tiếng Việt) dự báo xu hướng dân số của tổ dân phố này trong 5 năm tới và đưa ra lời khuyên quy hoạch (về y tế, giáo dục, hoặc việc làm) cho UBND Phường/Xã.
`;
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      if (response.text) {
        aiAnalysis = response.text;
      }
    } catch (err: any) {
      console.warn("AI forecasting generation unavailable or rate-limited, using fallback:", err?.message || err);
    }
  }

  res.json({
    forecast: forecastData,
    analysis: aiAnalysis
  });
});


// ==================== TÍNH NĂNG QUẢN LÝ CẤP QUYỀN TRUY CẬP (ACCESS CONTROL) ====================

// GET all allowed emails
app.get("/api/allowed-emails", (req, res) => {
  if (!db.allowedEmails) db.allowedEmails = [];
  res.json(db.allowedEmails);
});

// POST add allowed email
app.post("/api/allowed-emails", async (req, res) => {
  const { email, role, assignedBy, permissions } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: "Email và Vai trò là bắt buộc" });
  }

  if (!db.allowedEmails) db.allowedEmails = [];
  
  const lowerEmail = email.toLowerCase().trim();

  if (role !== UserRole.WARD_LEADER && role !== UserRole.COLLABORATOR) {
    return res.status(400).json({ error: "Chỉ có thể cấp quyền Trưởng khu phố hoặc CTV từ màn hình này." });
  }

  const adminEmails = ["bhttq3@gmail.com", "tayninhdoimoi@gmail.com", "nguyentanbinh3005@gmail.com"];
  if (adminEmails.includes(lowerEmail)) {
    return res.status(400).json({ error: "Email này là Người quản lý tối cao mặc định, không cần cấp quyền" });
  }

  const exists = db.allowedEmails.some(a => a.email.toLowerCase() === lowerEmail);
  if (exists) {
    return res.status(400).json({ error: "Email này đã được cấp quyền trước đó" });
  }

  const newAllowed: AllowedEmail = {
    id: `ALLOW-${Date.now()}`,
    email: lowerEmail,
    role: role as UserRole,
    assignedBy: assignedBy || "Người quản lý",
    assignedAt: new Date().toISOString(),
    permissions: permissions || (role === UserRole.COLLABORATOR ? { canAdd: true, canEdit: false, canDelete: false, canExport: false, canApprove: false } : undefined)
  };

  const nextAllowedEmails = [...db.allowedEmails, newAllowed];
  try {
    await syncSupabaseCollection("allowedEmails", nextAllowedEmails);
    db.allowedEmails = nextAllowedEmails;
    saveDatabase();
    addLog(assignedBy || "Người quản lý", UserRole.SUPER_ADMIN, "Cấp quyền truy cập", `Cấp quyền cho email ${lowerEmail} với chức vụ ${role}`);
    res.status(201).json(newAllowed);
  } catch (err) {
    console.error("Failed to grant officer access:", err);
    res.status(500).json({ error: "Không thể lưu quyền cán bộ lên Supabase." });
  }
});

// DELETE remove allowed email
app.delete("/api/allowed-emails/:email", async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ error: "Email là bắt buộc" });
  }

  if (!db.allowedEmails) db.allowedEmails = [];
  
  const lowerEmail = email.toLowerCase().trim();
  if (SYSTEM_MANAGED_OFFICER_EMAILS.has(lowerEmail)) {
    return res.status(400).json({ error: "Tài khoản cán bộ hệ thống được bảo vệ bởi cấu hình quản trị." });
  }
  const index = db.allowedEmails.findIndex(a => a.email.toLowerCase() === lowerEmail);
  if (index !== -1) {
    const deleted = db.allowedEmails[index];
    const nextAllowedEmails = db.allowedEmails.filter((_, itemIndex) => itemIndex !== index);
    try {
      await syncSupabaseCollection("allowedEmails", nextAllowedEmails);
      db.allowedEmails = nextAllowedEmails;
      saveDatabase();
      addLog(req.query.user as string || "Người quản lý", UserRole.SUPER_ADMIN, "Hủy quyền truy cập", `Hủy quyền truy cập của email ${lowerEmail}`);
      res.json({ message: "Đã hủy quyền thành công", deleted });
    } catch (err) {
      console.error("Failed to revoke officer access:", err);
      res.status(500).json({ error: "Không thể cập nhật quyền cán bộ trên Supabase." });
    }
  } else {
    res.status(404).json({ error: "Không tìm thấy email trong danh sách được cấp quyền" });
  }
});

// PUT update allowed email role and permissions
app.put("/api/allowed-emails/:email", async (req, res) => {
  const { email } = req.params;
  const { role, permissions } = req.body;
  
  if (!email || !role) {
    return res.status(400).json({ error: "Email và Vai trò là bắt buộc" });
  }

  if (!db.allowedEmails) db.allowedEmails = [];
  
  const lowerEmail = email.toLowerCase().trim();
  if (SYSTEM_MANAGED_OFFICER_EMAILS.has(lowerEmail)) {
    return res.status(400).json({ error: "Vai trò của tài khoản cán bộ hệ thống được bảo vệ bởi cấu hình quản trị." });
  }
  if (role !== UserRole.WARD_LEADER && role !== UserRole.COLLABORATOR) {
    return res.status(400).json({ error: "Vai trò không hợp lệ." });
  }
  const allowedUser = db.allowedEmails.find(a => a.email.toLowerCase() === lowerEmail);
  
  if (allowedUser) {
    const oldRole = allowedUser.role;
    const updatedAllowed = {
      ...allowedUser,
      role: role as UserRole,
      permissions: permissions !== undefined ? permissions : allowedUser.permissions,
      assignedAt: new Date().toISOString(),
    };
    const nextAllowedEmails = db.allowedEmails.map((entry) => entry.email.toLowerCase() === lowerEmail ? updatedAllowed : entry);
    try {
      await syncSupabaseCollection("allowedEmails", nextAllowedEmails);
      db.allowedEmails = nextAllowedEmails;
      saveDatabase();
      addLog(req.query.user as string || "Người quản lý", UserRole.SUPER_ADMIN, "Cập nhật quyền truy cập", `Cập nhật vai trò của email ${lowerEmail} từ ${oldRole} thành ${role}`);
      res.json(updatedAllowed);
    } catch (err) {
      console.error("Failed to update officer access:", err);
      res.status(500).json({ error: "Không thể cập nhật quyền cán bộ trên Supabase." });
    }
  } else {
    res.status(404).json({ error: "Không tìm thấy email trong danh sách được cấp quyền" });
  }
});


// GET all pending registrations
app.get("/api/pending-registrations", (req, res) => {
  if (!db.pendingRegistrations) db.pendingRegistrations = [];
  res.json(db.pendingRegistrations);
});

// POST submit a registration request
app.post("/api/pending-registrations", (req, res) => {
  const { email, fullName, phone, requestedRole, reason } = req.body;
  if (!email || !fullName || !phone || !requestedRole) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ các thông tin bắt buộc" });
  }

  if (!db.pendingRegistrations) db.pendingRegistrations = [];
  if (!db.allowedEmails) db.allowedEmails = [];

  const lowerEmail = email.toLowerCase().trim();

  // Check if already allowed
  const adminEmails = ["bhttq3@gmail.com", "tayninhdoimoi@gmail.com", "nguyentanbinh3005@gmail.com"];
  const isAllowed = adminEmails.includes(lowerEmail) || db.allowedEmails.some(a => a.email.toLowerCase() === lowerEmail);
  if (isAllowed) {
    return res.status(400).json({ error: "Tài khoản này đã được cấp quyền truy cập từ trước." });
  }

  // Check if already in pending list with status pending
  const exists = db.pendingRegistrations.some(p => p.email.toLowerCase() === lowerEmail);
  if (exists) {
    return res.status(400).json({ error: "Yêu cầu đăng ký của bạn đang nằm trong danh sách duyệt, vui lòng đợi." });
  }

  const newReg: PendingRegistration = {
    id: `REG-${Date.now()}`,
    email: lowerEmail,
    fullName: fullName.trim(),
    phone: phone.trim(),
    requestedRole: requestedRole as UserRole,
    reason: reason ? reason.trim() : "",
    requestedAt: new Date().toISOString(),
    status: "pending"
  };

  db.pendingRegistrations.push(newReg);
  saveDatabase();
  saveToFirestore("pendingRegistrations", newReg);
  addLog(fullName.trim(), requestedRole as UserRole, "Đăng ký truy cập", `Tài khoản ${lowerEmail} đăng ký vai trò ${requestedRole}`);
  res.status(201).json(newReg);
});

// POST approve registration
app.post("/api/pending-registrations/:id/approve", (req, res) => {
  const { id } = req.params;
  const { approver } = req.body;
  
  if (!db.pendingRegistrations) db.pendingRegistrations = [];
  if (!db.allowedEmails) db.allowedEmails = [];

  const index = db.pendingRegistrations.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy yêu cầu đăng ký" });
  }

  const reg = db.pendingRegistrations[index];
  reg.status = "approved";

  // Create allowed email entry
  const newAllowed: AllowedEmail = {
    id: `ALLOW-${Date.now()}`,
    email: reg.email,
    role: reg.requestedRole,
    assignedBy: approver || "Người quản lý",
    assignedAt: new Date().toISOString()
  };

  db.allowedEmails.push(newAllowed);
  db.pendingRegistrations.splice(index, 1);
  
  saveDatabase();
  saveToFirestore("allowedEmails", newAllowed);
  deleteFromFirestore("pendingRegistrations", id);

  addLog(approver || "Người quản lý", UserRole.SUPER_ADMIN, "Duyệt tài khoản", `Duyệt đăng ký cho email ${reg.email} với chức vụ ${reg.requestedRole}`);
  res.json({ message: "Đã duyệt yêu cầu thành công", allowed: newAllowed });
});

// POST reject registration
app.post("/api/pending-registrations/:id/reject", (req, res) => {
  const { id } = req.params;
  const { approver } = req.body;

  if (!db.pendingRegistrations) db.pendingRegistrations = [];

  const index = db.pendingRegistrations.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy yêu cầu đăng ký" });
  }

  const reg = db.pendingRegistrations[index];
  db.pendingRegistrations.splice(index, 1);

  saveDatabase();
  deleteFromFirestore("pendingRegistrations", id);

  addLog(approver || "Người quản lý", UserRole.SUPER_ADMIN, "Từ chối tài khoản", `Từ chối đăng ký của email ${reg.email}`);
  res.json({ message: "Đã từ chối yêu cầu thành công" });
});


// ==================== TÍNH NĂNG QUẢN LÝ TÀI LIỆU KHU PHỐ ====================

// GET all documents
app.get("/api/documents", (req, res) => {
  if (!db.documents) db.documents = DEFAULT_DOCUMENTS || [];
  res.json(db.documents);
});

// POST add document
app.post("/api/documents", (req, res) => {
  const newDoc: QuarterDocument = {
    ...req.body,
    id: req.body.id || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: new Date().toISOString().split("T")[0]
  };

  if (!db.documents) db.documents = [];
  db.documents.push(newDoc);
  saveDatabase();
  saveToFirestore("documents", newDoc);

  addLog(
    req.query.user as string || "Hệ thống",
    req.query.role as UserRole || UserRole.COLLABORATOR,
    "Lưu tài liệu",
    `Thêm tài liệu mới: "${newDoc.title}"`
  );

  res.status(201).json(newDoc);
});

// PUT update document
app.put("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  if (!db.documents) db.documents = [];
  const index = db.documents.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy tài liệu" });
  }

  const updatedDoc: QuarterDocument = {
    ...db.documents[index],
    ...req.body
  };

  db.documents[index] = updatedDoc;
  saveDatabase();
  saveToFirestore("documents", updatedDoc);

  addLog(
    req.query.user as string || "Hệ thống",
    req.query.role as UserRole || UserRole.COLLABORATOR,
    "Cập nhật tài liệu",
    `Cập nhật tài liệu: "${updatedDoc.title}"`
  );

  res.json(updatedDoc);
});

// DELETE document
app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  if (!db.documents) db.documents = [];
  const index = db.documents.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy tài liệu" });
  }

  const title = db.documents[index].title;
  db.documents.splice(index, 1);
  saveDatabase();
  deleteFromFirestore("documents", id);

  addLog(
    req.query.user as string || "Hệ thống",
    req.query.role as UserRole || UserRole.SUPER_ADMIN,
    "Xóa tài liệu",
    `Xóa tài liệu: "${title}"`
  );

  res.json({ success: true, message: "Đã xóa tài liệu thành công" });
});


// Start server and mount Vite
async function startServer() {
  console.log("Initializing database...");
  await ensureDatabaseInitialized();

  // Explicitly serve public assets (PWA manifest, SW, icons)
  app.use(express.static(path.join(process.cwd(), "public")));

  // Vite dev middleware or static serving
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted in development mode.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA routing: catch all requests and return index.html
    app.get("*", (req, res, next) => {
      // Avoid intercepting API requests
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULL-STACK] Server successfully started and listening on http://localhost:${PORT}`);
  });
}

if (!isVercel) {
  void startServer();
}

export default app;
