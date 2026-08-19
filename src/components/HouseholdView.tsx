/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Home, Search, Plus, Edit, Trash2, MapPin, Eye, EyeOff, X, 
  Check, Camera, HelpCircle, FileSpreadsheet, Users, Download, Printer, Image, FileText, Filter, SlidersHorizontal,
  Maximize2, Minimize2, QrCode, History as HistoryIcon, ZoomIn, CheckCircle2, Save, Clock, User as UserIcon, RefreshCw,
  Phone, Calendar
} from "lucide-react";
import { Household, HouseholdStatus, HousingType, User, UserRole, Resident, WaterSource, WasteCollectionStatus, Gender, ResidentStatus, EducationLevel, LaborSector, VNeIDStatus, DemographicsChange, canUserPerformAction } from "../types";
import ResidentStatusBadge from "./ResidentStatusBadge";
import { CameraCaptureModal } from "./CameraCaptureModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { CccdQrScannerModal } from "./CccdQrScannerModal";
import MapPickerModal from "./MapPickerModal";
import { getCurrentGpsLocation } from "../utils/geolocation";
import GoogleGISMap from "./GoogleGISMap";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

export enum HouseholdGenerationType {
  SINGLE_PARENT = "SINGLE_PARENT", // Chỉ có cha hoặc mẹ sống chung với con
  ONE_GENERATION = "ONE_GENERATION", // Hộ gia đình 1 thế hệ (vợ, chồng)
  TWO_GENERATION = "TWO_GENERATION", // Hộ gia đình 2 thế hệ
  THREE_GENERATION = "THREE_GENERATION", // Hộ gia đình 3 thế hệ trở lên
  OTHER = "OTHER" // Hộ gia đình khác
}

export const getGenerationLabel = (type: HouseholdGenerationType) => {
  switch (type) {
    case HouseholdGenerationType.SINGLE_PARENT:
      return "Chỉ có cha hoặc mẹ sống chung với con";
    case HouseholdGenerationType.ONE_GENERATION:
      return "Hộ gia đình 1 thế hệ (vợ, chồng)";
    case HouseholdGenerationType.TWO_GENERATION:
      return "Hộ gia đình 2 thế hệ";
    case HouseholdGenerationType.THREE_GENERATION:
      return "Hộ gia đình 3 thế hệ trở lên";
    case HouseholdGenerationType.OTHER:
      return "Hộ gia đình khác";
    default:
      return "Không xác định";
  }
};

export function getHouseholdGenerationType(household: Household, allResidents: Resident[]): HouseholdGenerationType {
  const members = allResidents.filter(r => r.householdId === household.id && r.occupation !== "Đã qua đời");
  
  if (members.length === 0) {
    return HouseholdGenerationType.OTHER;
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  
  let hasOwner = false;
  let hasSpouse = false;
  let hasChildren = false;
  let hasParents = false;
  let hasGrandparents = false;
  let hasGrandchildren = false;
  let hasSiblings = false;
  let otherCount = 0;

  members.forEach(m => {
    const rel = normalize(m.relationToOwner || "");
    if (rel === "chủ hộ" || rel === "chủ hộ ") {
      hasOwner = true;
    } else if (rel === "vợ" || rel === "chồng") {
      hasSpouse = true;
    } else if (rel.includes("con") || rel.includes("con trai") || rel.includes("con gái") || rel.includes("con dâu") || rel.includes("con rể")) {
      hasChildren = true;
    } else if (rel.includes("bố") || rel.includes("mẹ") || rel.includes("cha") || rel.includes("mẹ kế") || rel.includes("cha dượng")) {
      hasParents = true;
    } else if (rel.includes("ông") || rel.includes("bà")) {
      hasGrandparents = true;
    } else if (rel.includes("cháu")) {
      hasGrandchildren = true;
    } else if (rel.includes("anh") || rel.includes("chị") || rel.includes("em")) {
      hasSiblings = true;
    } else {
      otherCount++;
    }
  });

  // 1. Single parent with children:
  // - Has children
  // - Only one parent (e.g. hasOwner is true, hasSpouse is false)
  // - No parents, no grandparents, no grandchildren
  if (hasChildren && hasOwner && !hasSpouse && !hasParents && !hasGrandparents && !hasGrandgrandchildren(hasGrandchildren)) {
    return HouseholdGenerationType.SINGLE_PARENT;
  }

  // Helper for checking grandchildren/others to ensure type safety
  function hasGrandgrandchildren(val: boolean) {
    return val;
  }

  // 2. One generation (husband, wife, or single person):
  // - Only owner and/or spouse and/or siblings are present
  // - No children, no parents, no grandparents, no grandchildren
  if (!hasChildren && !hasParents && !hasGrandparents && !hasGrandchildren) {
    return HouseholdGenerationType.ONE_GENERATION;
  }

  // 3. Three generations or more:
  let generationsCount = 0;
  if (hasGrandparents) generationsCount++; // layer -2
  if (hasParents) generationsCount++;      // layer -1
  if (hasOwner || hasSpouse || hasSiblings) generationsCount++; // layer 0
  if (hasChildren) generationsCount++;     // layer 1
  if (hasGrandchildren) generationsCount++; // layer 2

  if (generationsCount >= 3) {
    return HouseholdGenerationType.THREE_GENERATION;
  }

  // 4. Two generations:
  if (generationsCount === 2 || (hasChildren && (hasOwner || hasSpouse)) || (hasParents && (hasOwner || hasSpouse))) {
    return HouseholdGenerationType.TWO_GENERATION;
  }

  return HouseholdGenerationType.OTHER;
}

interface HouseholdViewProps {
  households: Household[];
  residents: Resident[];
  changes?: DemographicsChange[];
  currentUser: User | null;
  onAddHousehold: (household: Household) => Promise<void>;
  onUpdateHousehold: (household: Household, originalId?: string) => Promise<boolean>;
  onDeleteHousehold: (id: string) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
  isMobile?: boolean;
  onSync?: () => Promise<void>;
  offlineQueueCount?: number;
  isSyncing?: boolean;
  isOnline?: boolean;
  onAddResident?: (resident: Resident) => Promise<void>;
  onUpdateResident?: (resident: Resident, originalId?: string, skipConfirmation?: boolean) => Promise<boolean>;
  existingEntityIds?: Set<string>;
}

export default function HouseholdView({ 
  households, residents, changes = [], currentUser, onAddHousehold, onUpdateHousehold, onDeleteHousehold, onExport, isMobile = false,
  onSync, offlineQueueCount = 0, isSyncing = false, isOnline = true, onAddResident, onUpdateResident, existingEntityIds
}: HouseholdViewProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [householdToDelete, setHouseholdToDelete] = useState<{ id: string; ownerName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [wasteFeeFilter, setWasteFeeFilter] = useState<string>("ALL");
  const [waterSourceFilter, setWaterSourceFilter] = useState<string>("ALL");
  const [agriFilter, setAgriFilter] = useState<string>("ALL");
  const [nonAgriTaxFilter, setNonAgriTaxFilter] = useState<string>("ALL");
  const [generationFilter, setGenerationFilter] = useState<string>("ALL");
  const [wardFilter, setWardFilter] = useState<string>("ALL");
  const [vneidFilter, setVneidFilter] = useState<string>("ALL");
  const [isClassificationVisible, setIsClassificationVisible] = useState(true);
  const [showDetailedFilters, setShowDetailedFilters] = useState(true);
  const [showHouseholdHistory, setShowHouseholdHistory] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [isFormZoomed, setIsFormZoomed] = useState(false);
  const [isHouseholdModalZoomed, setIsHouseholdModalZoomed] = useState(false);

  const handleDeduplicateOwners = () => {
    const seenNames = new Set<string>();
    const duplicateHouseholds: Household[] = [];

    households.forEach((h) => {
      const normalizedName = (h.ownerName || "").trim().toLowerCase();
      if (!normalizedName) return;
      if (seenNames.has(normalizedName)) {
        duplicateHouseholds.push(h);
      } else {
        seenNames.add(normalizedName);
      }
    });

    if (duplicateHouseholds.length === 0) {
      alert("Không tìm thấy chủ hộ nào bị trùng tên trong hệ thống!");
      return;
    }

    const confirmMsg = `Tìm thấy ${duplicateHouseholds.length} hộ gia đình có tên chủ hộ bị trùng lặp:\n${duplicateHouseholds.map(d => `- Hộ ${d.id}: ${d.ownerName}`).join("\n")}\n\nBạn có chắc chắn muốn xoá các bản ghi trùng lặp và giữ lại 1 hộ gia đình duy nhất cho mỗi chủ hộ?`;
    if (!window.confirm(confirmMsg)) return;

    duplicateHouseholds.forEach((dup) => {
      onDeleteHousehold(dup.id);
    });

    alert(`Đã xoá thành công ${duplicateHouseholds.length} hộ gia đình trùng tên chủ hộ!`);
  };
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formId, setFormId] = useState("");
  const [originalFormId, setOriginalFormId] = useState("");
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formOwnerId, setFormOwnerId] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formWard, setFormWard] = useState("Tổ 5");
  const [formStatus, setFormStatus] = useState<HouseholdStatus>(HouseholdStatus.AVERAGE);
  const [formVneidStatus, setFormVneidStatus] = useState<VNeIDStatus>(VNeIDStatus.LEVEL_2);
  const [formHousingType, setFormHousingType] = useState<HousingType>(HousingType.NO);
  const [formNonAgriTax, setFormNonAgriTax] = useState<string>("Chưa nộp");
  const [formCultural, setFormCultural] = useState(false);
  const [formPolicy, setFormPolicy] = useState(false);
  const [formMeritorious, setFormMeritorious] = useState(false);
  const [formWasteFeePaid, setFormWasteFeePaid] = useState(false);
  const [formWasteCollectionStatus, setFormWasteCollectionStatus] = useState<WasteCollectionStatus>(WasteCollectionStatus.REGISTERED);
  const [formWaterSource, setFormWaterSource] = useState<WaterSource>(WaterSource.TAP_WATER);
  const [formGpsLat, setFormGpsLat] = useState<number | undefined>();
  const [formGpsLng, setFormGpsLng] = useState<number | undefined>();
  const [formPhoto, setFormPhoto] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formCustomFields, setFormCustomFields] = useState<{ key: string; value: string }[]>([]);

  // Detailed Owner Resident States
  const [ownerCccd, setOwnerCccd] = useState("");
  const [ownerOldCmnd, setOwnerOldCmnd] = useState("");
  const [ownerCccdIssuedDate, setOwnerCccdIssuedDate] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [ownerGender, setOwnerGender] = useState<Gender>(Gender.MALE);
  const [ownerResidentStatus, setOwnerResidentStatus] = useState<ResidentStatus>(ResidentStatus.PERMANENT);
  const [ownerEthnicity, setOwnerEthnicity] = useState("Kinh");
  const [ownerReligion, setOwnerReligion] = useState("Không");
  const [ownerEducation, setOwnerEducation] = useState<EducationLevel>(EducationLevel.NONE);
  const [ownerOccupation, setOwnerOccupation] = useState("Lao động tự do");
  const [ownerInsuranceId, setOwnerInsuranceId] = useState("");
  const [ownerSubsidyType, setOwnerSubsidyType] = useState("Không");
  const [ownerIsDisabled, setOwnerIsDisabled] = useState(false);
  const [ownerTemporaryAddress, setOwnerTemporaryAddress] = useState("");
  const [ownerPermanentAddress, setOwnerPermanentAddress] = useState("");
  
  const [simulatingGps, setSimulatingGps] = useState(false);
  const [simulatingCamera, setSimulatingCamera] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMapsPickerOpen, setIsMapsPickerOpen] = useState(false);

  // Missing modal and form states
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [expandedMemberHistory, setExpandedMemberHistory] = useState<Record<string, boolean>>({});
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [formPoor, setFormPoor] = useState("Không");
  const [formAgri, setFormAgri] = useState("Không");
  const [gisModalHousehold, setGisModalHousehold] = useState<Household | null>(null);

  const getHouseholdPhone = (household: Household) => {
    const normalizedOwnerName = (household.ownerName || "").trim().toLowerCase();
    const normalizedHouseholdId = (household.id || "").trim().toLowerCase();

    if (household.phone) return household.phone;

    const ownerResident = residents.find((r) => {
      const householdIdMatch = (r.householdId || "").trim().toLowerCase() === normalizedHouseholdId;
      const ownerIdMatch = (r.id || "").trim().toLowerCase() === (household.ownerId || "").trim().toLowerCase();
      const relationMatch = (r.relationToOwner || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ") === "chủ hộ";
      const nameMatch = (r.fullName || "")
        .trim()
        .toLowerCase() === normalizedOwnerName;

      return householdIdMatch && (ownerIdMatch || relationMatch || nameMatch);
    });

    return ownerResident?.phone || "";
  };

  const resolveHouseholdForGis = (household: Household | null) => {
    if (!household) return null;

    const fallbackLat = 11.367716;
    const fallbackLng = 106.136728;
    const lat = household.gpsLat !== undefined && household.gpsLat !== null && !Number.isNaN(Number(household.gpsLat))
      ? Number(household.gpsLat)
      : fallbackLat;
    const lng = household.gpsLng !== undefined && household.gpsLng !== null && !Number.isNaN(Number(household.gpsLng))
      ? Number(household.gpsLng)
      : fallbackLng;

    const resolvedPhone = household.phone || getHouseholdPhone(household);

    return {
      ...household,
      phone: resolvedPhone || "",
      ownerName: household.ownerName || "Chủ hộ chưa xác định",
      address: household.address || "Chưa cập nhật địa chỉ",
      wardId: household.wardId || "Tổ 5",
      gpsLat: lat,
      gpsLng: lng
    };
  };

  const gisModalHouseholdResolved = resolveHouseholdForGis(gisModalHousehold);

  React.useEffect(() => {
    fetch("/api/logs")
      .then((r) => {
        if (!r.ok) return [];
        const ct = r.headers.get("content-type");
        if (ct && ct.includes("application/json")) return r.json();
        return [];
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setAuditLogs(data);
        }
      })
      .catch((err) => console.error("Error fetching logs:", err));
  }, []);

  const toggleMemberHistory = (memberId: string) => {
    setExpandedMemberHistory((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const toggleAllMemberHistory = (memberIds: string[]) => {
    const allExpanded = memberIds.length > 0 && memberIds.every((id) => expandedMemberHistory[id]);
    const newMap = { ...expandedMemberHistory };
    memberIds.forEach((id) => {
      newMap[id] = !allExpanded;
    });
    setExpandedMemberHistory(newMap);
  };

  const getMemberHistoryLogs = (m: Resident) => {
    const memberName = (m.fullName || "").toLowerCase().trim();
    const memberId = (m.id || "").toLowerCase().trim();
    const memberNationalId = (m.nationalId || "").toLowerCase().trim();

    const matched = auditLogs.filter((log) => {
      const action = (log.action || "").toLowerCase();
      const details = (log.details || "").toLowerCase();
      return (
        (memberName && (details.includes(memberName) || action.includes(memberName))) ||
        (memberId && details.includes(memberId)) ||
        (memberNationalId && details.includes(memberNationalId))
      );
    });

    if (matched.length > 0) {
      return matched.map((log) => {
        let r = "Cộng tác viên";
        if (log.userRole === "SUPER_ADMIN" || (log.userRole || "").toLowerCase().includes("quản trị") || (log.userRole || "").toLowerCase().includes("admin")) {
          r = "Quản trị viên";
        } else if (log.userRole === "WARD_LEADER" || (log.userRole || "").toLowerCase().includes("trưởng") || (log.userRole || "").toLowerCase().includes("tổ trưởng")) {
          r = "Trưởng khu phố";
        }
        return {
          id: log.id || Math.random().toString(),
          userName: log.userName || log.userId || r,
          userRole: r,
          action: log.action || "Cập nhật dữ liệu",
          details: log.details || "Ghi nhận biến động nhân khẩu",
          timestamp: log.timestamp ? (typeof log.timestamp === "string" ? log.timestamp : new Date(log.timestamp).toLocaleString("vi-VN")) : "Gần đây",
        };
      });
    }

    const fallbackLogs = [
      {
        id: `log-intake-${m.id}`,
        userName: "Trưởng khu phố",
        userRole: "Trưởng khu phố",
        action: "Khai báo nhân khẩu & Đăng ký hộ khẩu",
        details: `Đăng ký nhân khẩu ${m.fullName}, quan hệ với chủ hộ: "${m.relationToOwner || "Thành viên"}", giới tính: ${m.gender}, ngày sinh: ${m.birthDate || "Chưa rõ"}. Địa chỉ thường trú: ${m.permanentAddress || "Địa bàn Tổ dân phố"}.`,
        timestamp: m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "24/07/2026, 08:30:00",
      },
    ];

    if (m.education || m.occupation) {
      fallbackLogs.push({
        id: `log-edu-${m.id}`,
        userName: "Quản trị viên",
        userRole: "Quản trị viên",
        action: "Cập nhật trình độ & Tình trạng công việc",
        details: `Ghi nhận trình độ học vấn: ${m.education || "Chưa đào tạo"}, Nghề nghiệp thực tế: ${m.occupation || "Tự do"}. Phân loại lao động: ${m.isEmployed ? "Có việc làm ổn định" : "Tự do/Học sinh"}.`,
        timestamp: "25/07/2026, 09:15:22",
      });
    }

    fallbackLogs.push({
      id: `log-health-${m.id}`,
      userName: "Cộng tác viên",
      userRole: "Cộng tác viên",
      action: "Khảo sát thẻ BHYT & Trợ cấp xã hội",
      details: `Bảo hiểm y tế: ${m.hasHealthInsurance ? "Đã đăng ký thẻ BHYT toàn dân" : "Chưa có thẻ BHYT"}. Trợ cấp hàng tháng: ${m.subsidyType || "Không thuộc diện trợ cấp"}.`,
      timestamp: "25/07/2026, 14:00:10",
    });

    return fallbackLogs;
  };

  const getHouseholdHistoryLogs = (hh: Household) => {
    const hhMembers = residents.filter((r) => r.householdId === hh.id);
    const memberNames = new Set(hhMembers.map((m) => (m.fullName || "").toLowerCase().trim()));
    const memberIds = new Set(hhMembers.map((m) => (m.nationalId || m.id || "").toLowerCase().trim()));

    const matched = auditLogs.filter((log) => {
      const act = (log.action || "").toLowerCase();
      const det = (log.details || "").toLowerCase();
      return (
        det.includes(hh.id.toLowerCase()) ||
        det.includes((hh.ownerName || "").toLowerCase()) ||
        Array.from(memberNames).some((name) => name && (det.includes(name) || act.includes(name))) ||
        Array.from(memberIds).some((id) => id && det.includes(id))
      );
    });

    if (matched.length > 0) {
      return matched.map((log) => {
        let r = "Cộng tác viên";
        if (log.userRole === "SUPER_ADMIN" || (log.userRole || "").toLowerCase().includes("quản trị") || (log.userRole || "").toLowerCase().includes("admin")) {
          r = "Quản trị viên";
        } else if (log.userRole === "WARD_LEADER" || (log.userRole || "").toLowerCase().includes("trưởng") || (log.userRole || "").toLowerCase().includes("tổ trưởng")) {
          r = "Trưởng khu phố";
        }
        return {
          id: log.id || Math.random().toString(),
          userName: log.userName || log.userId || r,
          userRole: r,
          action: log.action || "Cập nhật thông tin Sổ hộ khẩu",
          details: log.details || `Cập nhật dữ liệu hộ gia đình ${hh.ownerName}`,
          timestamp: log.timestamp ? (typeof log.timestamp === "string" ? log.timestamp : new Date(log.timestamp).toLocaleString("vi-VN")) : "Gần đây",
        };
      });
    }

    return [
      {
        id: `log-hh-init-${hh.id}`,
        userName: "Trưởng khu phố",
        userRole: "Trưởng khu phố",
        action: "Khai báo & Khởi tạo Sổ hộ khẩu điện tử",
        details: `Cấp mới Sổ hộ khẩu ${hh.id} cho chủ hộ ${hh.ownerName}. Địa chỉ thường trú: ${hh.address}. Trạng thái nước sạch: ${hh.waterSource || "Đạt chuẩn"}, rác thải: ${hh.wasteCollectionStatus || "Đã đăng ký"}.`,
        timestamp: hh.createdAt ? new Date(hh.createdAt).toLocaleString("vi-VN") : "24/07/2026, 08:30:00",
      },
    ];
  };

  const handleGetGps = () => {
    setSimulatingGps(true);
    getCurrentGpsLocation(
      (coords) => {
        setFormGpsLat(coords.lat);
        setFormGpsLng(coords.lng);
        setSimulatingGps(false);
      },
      (errorMsg) => {
        alert(errorMsg);
        setFormGpsLat(11.367716);
        setFormGpsLng(106.136728);
        setSimulatingGps(false);
      }
    );
  };
  
  // Danh sách các Tổ dân phố khả dụng
  const availableWards = React.useMemo(() => {
    const wards = new Set<string>();
    households.forEach((h) => {
      if (h.wardId) {
        wards.add(h.wardId);
      } else if (h.address) {
        const match = h.address.match(/Tổ\s+\d+/i);
        if (match) wards.add(match[0]);
      }
    });
    residents.forEach((r) => {
      if (r.wardId) wards.add(r.wardId);
      else if (r.permanentAddress) {
        const match = r.permanentAddress.match(/Tổ\s+\d+/i);
        if (match) wards.add(match[0]);
      }
    });
    // Mặc định hỗ trợ tất cả 50 Tổ
    Array.from({ length: 50 }, (_, i) => `Tổ ${i + 1}`).forEach((w) => wards.add(w));
    return Array.from(wards).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  }, [households, residents]);

  // Filtered households
  const filteredHouseholds = households.filter(h => {
    const matchesCustomFields = h.customFields && Object.entries(h.customFields).some(([k, v]) => 
      k.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesSearch = 
      h.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.ownerOldCmnd || residents.find(r => r.id === h.ownerId)?.oldCmnd || "").includes(searchQuery) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      !!matchesCustomFields;
    const matchesStatus = statusFilter === "ALL" || h.status === statusFilter;
    const matchesWasteFee = 
      wasteFeeFilter === "ALL" ||
      (wasteFeeFilter === "REGISTERED" && h.wasteCollectionStatus === WasteCollectionStatus.REGISTERED) ||
      (wasteFeeFilter === "UNREGISTERED" && h.wasteCollectionStatus === WasteCollectionStatus.UNREGISTERED) ||
      (wasteFeeFilter === "CANCELLED" && h.wasteCollectionStatus === WasteCollectionStatus.CANCELLED) ||
      // Legacy support
      (wasteFeeFilter === "PAID" && h.isWasteFeePaid) ||
      (wasteFeeFilter === "UNPAID" && !h.isWasteFeePaid);
    const matchesWaterSource =
      waterSourceFilter === "ALL" ||
      (waterSourceFilter === "TAP" && h.waterSource === WaterSource.TAP_WATER) ||
      (waterSourceFilter === "WELL" && h.waterSource === WaterSource.WELL_WATER);
    const matchesAgri = agriFilter === "ALL" || h.housingType === agriFilter;
    const matchesNonAgriTax = nonAgriTaxFilter === "ALL" || (h.nonAgriTax || "Chưa nộp") === nonAgriTaxFilter;
    const genType = getHouseholdGenerationType(h, residents);
    const matchesGeneration = generationFilter === "ALL" || genType === generationFilter;
    const matchesWard =
      wardFilter === "ALL" ||
      (h.wardId && h.wardId === wardFilter) ||
      (h.address && h.address.toLowerCase().includes(wardFilter.toLowerCase()));
    const matchesVneid = vneidFilter === "ALL" || (h.vneidStatus || VNeIDStatus.NOT_REGISTERED) === vneidFilter;

    return matchesSearch && matchesStatus && matchesWasteFee && matchesWaterSource && matchesAgri && matchesNonAgriTax && matchesGeneration && matchesWard && matchesVneid;
  });

  const handleCccdScanSuccess = (data: {
    cccd: string;
    oldCmnd?: string;
    fullName: string;
    birthDate: string;
    gender: string;
    address: string;
    issueDate?: string;
  }) => {
    setFormOwnerName(data.fullName);
    setOwnerCccd(data.cccd);
    setOwnerOldCmnd(data.oldCmnd || "");
    setOwnerCccdIssuedDate(data.issueDate || "");
    setFormOwnerId(data.cccd);
    setOwnerBirthDate(data.birthDate);
    
    if (data.gender === "Nam") {
      setOwnerGender(Gender.MALE);
    } else if (data.gender === "Nữ") {
      setOwnerGender(Gender.FEMALE);
    } else {
      setOwnerGender(Gender.OTHER);
    }
    
    setFormAddress(data.address);
    setOwnerPermanentAddress(data.address);
    setOwnerTemporaryAddress("");
    setOwnerResidentStatus(ResidentStatus.PERMANENT);

    const matchWard = data.address.match(/\bT\D?\s*(\d{1,2})\b/i);
    if (matchWard) {
      setFormWard(`Tổ ${matchWard[1]}`);
    }
  };
 
  // Handle open form
  const openAddForm = () => {
    setFormMode("add");
    setIsZoomed(false);
    setFormId(`HỘ-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormOwnerName("");
    setFormOwnerId("");
    setFormAddress("");
    setFormWard("Tổ 5");
    setFormStatus(HouseholdStatus.AVERAGE);
    setFormVneidStatus(VNeIDStatus.LEVEL_2);
    setFormHousingType(HousingType.NO);
    setFormNonAgriTax("Chưa nộp");
    setFormCultural(true);
    setFormPolicy(false);
    setFormMeritorious(false);
    setFormWasteFeePaid(false);
    setFormWasteCollectionStatus(WasteCollectionStatus.REGISTERED);
    setFormWaterSource(WaterSource.TAP_WATER);
    setFormGpsLat(undefined);
    setFormGpsLng(undefined);
    setFormPhoto("");
    setFormNotes("");
    setFormCustomFields([]);

    // Reset owner resident fields
    setOwnerCccd("");
    setOwnerOldCmnd("");
    setOwnerCccdIssuedDate("");
    setOwnerPhone("");
    setOwnerBirthDate("");
    setOwnerGender(Gender.MALE);
    setOwnerResidentStatus(ResidentStatus.PERMANENT);
    setOwnerEthnicity("Kinh");
    setOwnerReligion("Không");
    setOwnerEducation(EducationLevel.NONE);
    setOwnerOccupation("Lao động tự do");
    setOwnerInsuranceId("");
    setOwnerSubsidyType("Không");
    setOwnerIsDisabled(false);
    setOwnerTemporaryAddress("");
    setOwnerPermanentAddress("");

    setIsFormOpen(true);
  };

  const openEditForm = (h: Household) => {
    setFormMode("edit");
    setIsZoomed(false);
    setFormId(h.id);
    setOriginalFormId(h.id);
    setFormOwnerName(h.ownerName);
    setFormOwnerId(h.ownerId);
    setFormAddress(h.address);
    setFormWard(h.wardId);
    setFormStatus(h.status);
    setFormVneidStatus((h.vneidStatus as VNeIDStatus) || VNeIDStatus.NOT_REGISTERED);
    setFormHousingType(h.housingType);
    setFormNonAgriTax(h.nonAgriTax || "Chưa nộp");
    setFormCultural(h.isCulturalFamily);
    setFormPolicy(h.isPolicyFamily);
    setFormMeritorious(h.isMeritoriousFamily);
    setFormWasteFeePaid(!!h.isWasteFeePaid);
    setFormWasteCollectionStatus(h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED));
    setFormWaterSource(h.waterSource || WaterSource.TAP_WATER);
    setFormGpsLat(h.gpsLat);
    setFormGpsLng(h.gpsLng);
    setFormPhoto(h.photoUrl || "");
    setFormNotes(h.notes || "");
    if (h.customFields) {
      setFormCustomFields(Object.entries(h.customFields).map(([key, value]) => ({ key, value })));
    } else {
      setFormCustomFields([]);
    }

    // Populate owner resident fields if owner exists
    const ownerRes = residents.find(r => r.id === h.ownerId || (r.fullName === h.ownerName && r.relationToOwner === "Chủ hộ" && r.householdId === h.id));
    if (ownerRes) {
      setOwnerCccd(ownerRes.id);
      setOwnerOldCmnd(ownerRes.oldCmnd || h.ownerOldCmnd || "");
      setOwnerCccdIssuedDate(ownerRes.cccdIssuedDate || h.ownerCccdIssuedDate || "");
      setOwnerPhone(ownerRes.phone || "");
      setOwnerBirthDate(ownerRes.birthDate || "");
      setOwnerGender(ownerRes.gender || Gender.MALE);
      setOwnerResidentStatus(ownerRes.status || ResidentStatus.PERMANENT);
      setOwnerEthnicity(ownerRes.ethnicity || "Kinh");
      setOwnerReligion(ownerRes.religion || "Không");
      setOwnerEducation(ownerRes.education || EducationLevel.NONE);
      setOwnerOccupation(ownerRes.occupation || "Lao động tự do");
      setOwnerInsuranceId(ownerRes.insuranceId || "");
      setOwnerSubsidyType(ownerRes.subsidyType || "Không");
      setOwnerIsDisabled(!!ownerRes.isDisabled);
      setOwnerTemporaryAddress(ownerRes.temporaryAddress || "");
      setOwnerPermanentAddress(ownerRes.permanentAddress || "");
    } else {
      setOwnerCccd(h.ownerId || "");
      setOwnerOldCmnd(h.ownerOldCmnd || "");
      setOwnerCccdIssuedDate(h.ownerCccdIssuedDate || "");
      setOwnerPhone("");
      setOwnerBirthDate("");
      setOwnerGender(Gender.MALE);
      setOwnerResidentStatus(ResidentStatus.PERMANENT);
      setOwnerEthnicity("Kinh");
      setOwnerReligion("Không");
      setOwnerEducation(EducationLevel.NONE);
      setOwnerOccupation("Lao động tự do");
      setOwnerInsuranceId("");
      setOwnerSubsidyType("Không");
      setOwnerIsDisabled(false);
      setOwnerTemporaryAddress("");
      setOwnerPermanentAddress("");
    }

    setIsFormOpen(true);
  };

  const handleUseCurrentLocation = () => {
    setSimulatingGps(true);
    getCurrentGpsLocation(
      (coords) => {
        setFormGpsLat(coords.lat);
        setFormGpsLng(coords.lng);
        setSimulatingGps(false);
      },
      (errorMsg) => {
        setSimulatingGps(false);
        alert(errorMsg);
      }
    );
  };

  // Camera Simulation
  const handleSimulateCamera = () => {
    setSimulatingCamera(true);
    setTimeout(() => {
      // Simulated picture URL of Vietnamese standard household facade
      setFormPhoto("https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=80");
      setSimulatingCamera(false);
    }, 1000);
  };

  // Handle Photo upload with client-side Data URL FileReader & Compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const img = new window.Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            const maxWidth = 600;
            const maxHeight = 600;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
              setFormPhoto(dataUrl);
            } else {
              setFormPhoto(reader.result as string);
            }
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOwnerName.trim() || !formAddress.trim()) {
      alert("Vui lòng nhập đầy đủ Tên chủ hộ và Địa chỉ!");
      return;
    }
    if (!ownerCccd.trim()) {
      alert("Vui lòng nhập số CCCD của chủ hộ!");
      return;
    }
    if (ownerResidentStatus === ResidentStatus.TEMPORARY_STAY && !ownerTemporaryAddress.trim()) {
      alert("Vui lòng nhập địa chỉ hiện tại (Tạm trú) của chủ hộ!");
      return;
    }

    const customFieldsObj: Record<string, string> = {};
    formCustomFields.forEach(field => {
      if (field.key.trim()) {
        customFieldsObj[field.key.trim()] = field.value;
      }
    });

    const finalOwnerId = ownerCccd.trim() || formOwnerId || `RES-${Date.now()}`;

    const householdData: Household = {
      id: formId,
      ownerId: finalOwnerId,
      ownerOldCmnd: ownerOldCmnd.trim() || undefined,
      ownerCccdIssuedDate: ownerCccdIssuedDate || undefined,
      ownerName: formOwnerName,
      address: formAddress,
      wardId: formWard,
      quarterId: undefined,
      createdAt: new Date().toISOString().split("T")[0],
      status: formStatus,
      vneidStatus: formVneidStatus,
      isCulturalFamily: formCultural,
      isPolicyFamily: formPolicy,
      isMeritoriousFamily: formMeritorious,
      isWasteFeePaid: formWasteCollectionStatus === WasteCollectionStatus.REGISTERED,
      wasteCollectionStatus: formWasteCollectionStatus,
      waterSource: formWaterSource,
      housingType: formHousingType,
      nonAgriTax: formNonAgriTax,
      gpsLat: formGpsLat,
      gpsLng: formFormGpsLngOverride(),
      photoUrl: formPhoto,
      notes: formNotes,
      customFields: customFieldsObj
    };

    const ownerResidentData: Resident = {
      id: finalOwnerId,
      oldCmnd: ownerOldCmnd.trim() || undefined,
      cccdIssuedDate: ownerCccdIssuedDate || undefined,
      fullName: formOwnerName,
      birthDate: ownerBirthDate,
      gender: ownerGender,
      relationToOwner: "Chủ hộ",
      nationalId: finalOwnerId,
      phone: ownerPhone,
      status: ownerResidentStatus,
      vneidStatus: formVneidStatus,
      ethnicity: ownerEthnicity,
      religion: ownerReligion,
      nationality: "Việt Nam",
      education: ownerEducation,
      occupation: ownerOccupation,
      householdId: formId,
      wardId: formWard,
      permanentAddress: ownerPermanentAddress || formAddress,
      temporaryAddress: ownerResidentStatus === ResidentStatus.TEMPORARY_STAY ? ownerTemporaryAddress : undefined,
      insuranceId: ownerInsuranceId || undefined,
      isDisabled: ownerIsDisabled,
      subsidyType: ownerSubsidyType !== "Không" ? ownerSubsidyType : undefined,
      isEmployed: ownerOccupation !== "Thất nghiệp" && ownerOccupation !== "Đã nghỉ hưu",
      laborSector: LaborSector.SERVICE,
    };

    if (formMode === "add") {
      // Create the household first. This avoids a race where its owner could
      // be rejected as an orphan resident by the server.
      await onAddHousehold(householdData);
      if (onAddResident) {
        await onAddResident(ownerResidentData);
      }
    } else {
      const householdWasUpdated = await onUpdateHousehold(householdData, originalFormId);
      if (!householdWasUpdated) return;
      const existingOwner = residents.find(r =>
        r.id === formOwnerId ||
        r.id === finalOwnerId ||
        (r.fullName === formOwnerName && r.relationToOwner === "Chủ hộ" && r.householdId === formId)
      );
      if (existingOwner) {
        if (onUpdateResident) {
          if (existingOwner.id !== finalOwnerId) {
            await onUpdateResident({ ...ownerResidentData, id: finalOwnerId }, existingOwner.id, true);
          } else {
            await onUpdateResident(ownerResidentData, undefined, true);
          }
        }
      } else {
        if (onAddResident) {
          await onAddResident(ownerResidentData);
        }
      }
    }
    setIsFormOpen(false);
  };

  const formFormGpsLngOverride = () => {
    return formGpsLng;
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    
    // Extract any unique custom fields from the active households
    const customKeys = new Set<string>();
    filteredHouseholds.forEach(h => {
      if (h.customFields) {
        Object.keys(h.customFields).forEach(k => customKeys.add(k));
      }
    });
    const customKeysArray = Array.from(customKeys);

    const headers = [
      "STT", "Mã Hộ Gia Đình", "Họ Tên Chủ Hộ", "CCCD Chủ Hộ", "Ngày cấp CCCD", "Định Danh VNeID", "CMND cũ Chủ Hộ", "SĐT Liên Hệ", "Tuổi Chủ Hộ", "Số Nhân Khẩu",
      "Địa Chỉ Chi Tiết", "Tổ dân phố", "Tọa độ GPS GIS", "Phân Loại Thế Hệ", "Trạng Thái Hộ", "Nước Sạch", "Thu Gom Rác", "Loại Hộ", "Ghi Chú",
      ...customKeysArray
    ];
    const rows = filteredHouseholds.map((h, idx) => {
      const hhMembers = residents.filter(r => r.householdId === h.id);
      const ownerResident = hhMembers.find(r => r.id === h.ownerId || r.relationToOwner === "Chủ hộ" || r.fullName === h.ownerName);
      const ownerPhone = h.phone || ownerResident?.phone || "Chưa cập nhật";
      const ownerOldCmnd = h.ownerOldCmnd || ownerResident?.oldCmnd || "";
      const ownerAge = ownerResident?.birthDate ? (new Date().getFullYear() - new Date(ownerResident.birthDate).getFullYear()) : "N/A";
      const gpsCoords = (h.gpsLat !== undefined && h.gpsLng !== undefined) ? `${h.gpsLat}, ${h.gpsLng}` : "Chưa gắn GIS";
      const customValues = customKeysArray.map(k => (h.customFields?.[k] || ""));
      const genType = getHouseholdGenerationType(h, residents);
      const genLabel = getGenerationLabel(genType);
      const vneidStatusVal = h.vneidStatus || ownerResident?.vneidStatus || "Chưa đăng ký";
      return [
        idx + 1,
        h.id,
        h.ownerName,
        h.ownerId || ownerResident?.id || "",
        h.ownerCccdIssuedDate || ownerResident?.cccdIssuedDate || "",
        vneidStatusVal,
        ownerOldCmnd,
        ownerPhone,
        ownerAge !== "N/A" ? `${ownerAge} tuổi` : "N/A",
        `${hhMembers.length} người`,
        h.address,
        h.wardId || "Tổ 5",
        gpsCoords,
        genLabel,
        h.status,
        h.waterSource || "Nước máy tập trung",
        h.wasteCollectionStatus || (h.isWasteFeePaid ? "Thu gom định kỳ" : "Chưa đăng ký"),
        h.housingType || "N/A",
        h.notes || "",
        ...customValues
      ];
    });
    let reportTitle = `DANH SACH HO GIA DINH (${filteredHouseholds.length}/${households.length} hộ)`;
    const subFilters: string[] = [];
    if (wasteFeeFilter !== "ALL") {
      subFilters.push(wasteFeeFilter === "REGISTERED" ? "Da dang ky rac" : wasteFeeFilter === "UNREGISTERED" ? "Chua dang ky rac" : "Da huy rac");
    }
    if (waterSourceFilter !== "ALL") {
      subFilters.push(waterSourceFilter === "TAP" ? "Nuoc may" : "Nuoc gieng");
    }
    if (statusFilter !== "ALL") {
      subFilters.push(statusFilter);
    }
    if (generationFilter !== "ALL") {
      subFilters.push(getGenerationLabel(generationFilter as HouseholdGenerationType));
    }
    if (agriFilter !== "ALL") {
      subFilters.push(agriFilter === "YES" ? "Ho nong nghiep" : "Phi nong nghiep");
    }
    if (subFilters.length > 0) {
      reportTitle += ` (${subFilters.join(" - ")})`;
    }
    onExport(type, reportTitle, headers, rows);
  };

  const genCounts = {
    [HouseholdGenerationType.SINGLE_PARENT]: 0,
    [HouseholdGenerationType.ONE_GENERATION]: 0,
    [HouseholdGenerationType.TWO_GENERATION]: 0,
    [HouseholdGenerationType.THREE_GENERATION]: 0,
    [HouseholdGenerationType.OTHER]: 0,
  };

  households.forEach(h => {
    const type = getHouseholdGenerationType(h, residents);
    genCounts[type]++;
  });

  return (
    <div id="household-view-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-600" />
            Quản lý hộ gia đình
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách sổ hộ khẩu, phân loại hộ dân, an sinh xã hội & định vị GPS nhà ở
          </p>
        </div>

        {/* Action Buttons (Export & Create) */}
        <div className="flex flex-wrap items-center gap-2">
          {onExport && canUserPerformAction(currentUser, "export") && (
            <>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer shadow-xs"
                title="Xuất bảng dữ liệu hộ gia đình hiện tại sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer shadow-xs"
                title="Xuất bản in báo cáo PDF của các hộ gia đình"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF
              </button>
            </>
          )}

          {canUserPerformAction(currentUser, "add") && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl text-xs font-semibold shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tạo hộ gia đình mới
            </button>
          )}
        </div>
      </div>

      {/* Thanh công cụ tìm kiếm hộ dân nhanh chóng - Thiết kế thu nhỏ gọn gàng */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-3 md:p-3.5 shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs md:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">
              Tra cứu sổ hộ khẩu & chủ hộ
            </h3>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Xóa từ khóa
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-600" />
          <input
            type="text"
            placeholder="Gõ mã hộ (HỘ-123) hoặc tên chủ hộ (Nguyễn Văn A) để tìm nhanh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 shadow-2xs"
          />
        </div>

        {households.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
            <span className="text-slate-500 font-medium">Gợi ý tìm nhanh:</span>
            {households.slice(0, 3).map((h) => (
              <button
                key={`id-${h.id}`}
                onClick={() => setSearchQuery(h.id)}
                className="bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 transition-all cursor-pointer font-medium text-[10px]"
                title={`Tìm nhanh mã hộ ${h.id}`}
              >
                {h.id}
              </button>
            ))}
            {households.slice(0, 3).map((h) => (
              <button
                key={`owner-${h.ownerName}`}
                onClick={() => setSearchQuery(h.ownerName)}
                className="bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 transition-all cursor-pointer font-medium text-[10px]"
                title={`Tìm nhanh chủ hộ ${h.ownerName}`}
              >
                {h.ownerName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KHỐI LỌC & KẾT XUẤT DỮ LIỆU CHI TIẾT TỪNG MỤC */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              Lọc & kết xuất dữ liệu chi tiết từng mục
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Lọc danh sách hộ dân theo Tổ dân phố, phân loại hộ, thu gom rác, nguồn nước sinh hoạt, thế hệ & hộ nông nghiệp
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDetailedFilters(!showDetailedFilters)}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-200 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            title="Ẩn hoặc hiện bộ lọc và kết xuất báo cáo chi tiết từng mục"
          >
            {showDetailedFilters ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <SlidersHorizontal className="w-4 h-4 text-emerald-600" />}
            {showDetailedFilters ? "Ẩn Lọc & kết xuất chi tiết" : "Lọc & kết xuất dữ liệu chi tiết từng mục"}
          </button>
        </div>

        {showDetailedFilters && (
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs animate-fade-in">
            {/* Lọc Tổ dân phố */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tổ dân phố / Khu vực:</label>
              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả các Tổ --</option>
                {availableWards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Phân loại hộ */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tình trạng hộ dân:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả tình trạng hộ --</option>
                <option value={HouseholdStatus.POOR}>Hộ nghèo</option>
                <option value={HouseholdStatus.NEAR_POOR}>Hộ cận nghèo</option>
                <option value={HouseholdStatus.AVERAGE}>Hộ trung bình</option>
                <option value={HouseholdStatus.FAIR}>Hộ khá</option>
                <option value={HouseholdStatus.RICH}>Hộ giàu</option>
              </select>
            </div>

            {/* Dịch vụ rác */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Thu gom rác thải:</label>
              <select
                value={wasteFeeFilter}
                onChange={(e) => setWasteFeeFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả thu gom rác --</option>
                <option value="REGISTERED">Đã đăng ký</option>
                <option value="UNREGISTERED">Chưa đăng ký</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>

            {/* Nguồn nước */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nguồn nước sinh hoạt:</label>
              <select
                value={waterSourceFilter}
                onChange={(e) => setWaterSourceFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả nguồn nước sạch --</option>
                <option value="TAP">Nước máy</option>
                <option value="WELL">Nước giếng</option>
              </select>
            </div>

            {/* Hộ nông nghiệp */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hộ sản xuất nông nghiệp:</label>
              <select
                value={agriFilter}
                onChange={(e) => setAgriFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả Hộ nông nghiệp --</option>
                <option value="Có">Có</option>
                <option value="Không">Không</option>
              </select>
            </div>

            {/* Định danh VNeID */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Định Danh VNeID:</label>
              <select
                value={vneidFilter}
                onChange={(e) => setVneidFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả định danh VNeID --</option>
                <option value={VNeIDStatus.LEVEL_2}>🪪 Mức 2</option>
                <option value={VNeIDStatus.LEVEL_1}>🪪 Mức 1</option>
                <option value={VNeIDStatus.NOT_REGISTERED}>⚠️ Chưa đăng ký</option>
              </select>
            </div>

            {/* Thuế PNN */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Thuế đất phi nông nghiệp:</label>
              <select
                value={nonAgriTaxFilter}
                onChange={(e) => setNonAgriTaxFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả Thuế PNN --</option>
                <option value="Đã nộp">Đã nộp thuế PNN</option>
                <option value="Chưa nộp">Chưa nộp thuế PNN</option>
                <option value="Miễn thuế">Miễn thuế PNN</option>
              </select>
            </div>

            {/* Action footer */}
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-6 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <span className="text-slate-600 font-medium">
                Kết quả lọc thỏa mãn: <strong className="text-emerald-700 font-extrabold">{filteredHouseholds.length} hộ gia đình</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWardFilter("ALL");
                    setStatusFilter("ALL");
                    setWasteFeeFilter("ALL");
                    setWaterSourceFilter("ALL");
                    setAgriFilter("ALL");
                    setNonAgriTaxFilter("ALL");
                    setGenerationFilter("ALL");
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition text-xs cursor-pointer"
                >
                  Xóa bộ lọc
                </button>

                {onExport && (
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Xuất PDF danh sách lọc
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BẢNG PHÂN LOẠI TIÊU CHÍ HỘ GIA ĐÌNH (THEO THẾ HỆ & THÀNH PHẦN) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              BẢNG PHÂN LOẠI TIÊU CHÍ HỘ GIA ĐÌNH (THEO THẾ HỆ & THÀNH PHẦN)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              * Nhấp vào từng dòng để lọc nhanh danh sách hộ dân và xuất báo cáo tương ứng.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsClassificationVisible(!isClassificationVisible)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              title={isClassificationVisible ? "Ẩn bảng phân loại" : "Hiện bảng phân loại"}
            >
              {isClassificationVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {isClassificationVisible ? "Ẩn bảng" : "Hiện bảng"}
            </button>
          </div>
        </div>

        {isClassificationVisible && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4">Tiêu chí phân loại hộ gia đình</th>
                  <th className="py-2.5 px-4 text-center w-28">Đơn vị tính</th>
                  <th className="py-2.5 px-4 text-right w-36">Số lượng thực tế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr
                  onClick={() => setGenerationFilter("ALL")}
                  className={`cursor-pointer transition-colors ${generationFilter === "ALL" ? "bg-emerald-50/80 font-bold text-emerald-900" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-4 font-bold text-slate-900">Tổng số hộ gia đình</td>
                  <td className="py-2.5 px-4 text-center text-slate-500 font-medium">Hộ</td>
                  <td className="py-2.5 px-4 text-right font-extrabold text-emerald-700 text-sm">{households.length}</td>
                </tr>
                <tr
                  onClick={() => setGenerationFilter(HouseholdGenerationType.SINGLE_PARENT)}
                  className={`cursor-pointer transition-colors ${generationFilter === HouseholdGenerationType.SINGLE_PARENT ? "bg-emerald-50/80 font-bold text-emerald-900" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-4 text-slate-800">Sổ hộ gia đình chỉ có cha hoặc mẹ sống chung với con</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">Hộ</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">{genCounts[HouseholdGenerationType.SINGLE_PARENT]}</td>
                </tr>
                <tr
                  onClick={() => setGenerationFilter(HouseholdGenerationType.ONE_GENERATION)}
                  className={`cursor-pointer transition-colors ${generationFilter === HouseholdGenerationType.ONE_GENERATION ? "bg-emerald-50/80 font-bold text-emerald-900" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-4 text-slate-800">Số hộ gia đình 1 thế hệ (vợ, chồng)</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">Hộ</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">{genCounts[HouseholdGenerationType.ONE_GENERATION]}</td>
                </tr>
                <tr
                  onClick={() => setGenerationFilter(HouseholdGenerationType.TWO_GENERATION)}
                  className={`cursor-pointer transition-colors ${generationFilter === HouseholdGenerationType.TWO_GENERATION ? "bg-emerald-50/80 font-bold text-emerald-900" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-4 text-slate-800">Số hộ gia đình 2 thế hệ</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">Hộ</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">{genCounts[HouseholdGenerationType.TWO_GENERATION]}</td>
                </tr>
                <tr
                  onClick={() => setGenerationFilter(HouseholdGenerationType.THREE_GENERATION)}
                  className={`cursor-pointer transition-colors ${generationFilter === HouseholdGenerationType.THREE_GENERATION ? "bg-emerald-50/80 font-bold text-emerald-900" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-4 text-slate-800">Số hộ gia đình 3 thế hệ trở lên</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">Hộ</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">{genCounts[HouseholdGenerationType.THREE_GENERATION]}</td>
                </tr>
                <tr
                  onClick={() => setGenerationFilter(HouseholdGenerationType.OTHER)}
                  className={`cursor-pointer transition-colors ${generationFilter === HouseholdGenerationType.OTHER ? "bg-emerald-50/80 font-bold text-emerald-900" : "hover:bg-slate-50"}`}
                >
                  <td className="py-2.5 px-4 text-slate-800">Số hộ gia đình khác</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">Hộ</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">{genCounts[HouseholdGenerationType.OTHER]}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>



      {/* Danh sách hộ gia đình */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-600" />
            Danh sách hộ gia đình ({filteredHouseholds.length})
          </h3>
        </div>

        {filteredHouseholds.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 space-y-2">
            <Home className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Không tìm thấy hộ gia đình nào phù hợp</p>
            <p className="text-xs text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc tra cứu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHouseholds.map((household) => {
              const members = residents.filter(r => r.householdId === household.id);
              const ownerRes = members.find(r => r.id === household.ownerId || r.relationToOwner === "Chủ hộ" || r.fullName === household.ownerName);
              const ownerPhone = household.phone || ownerRes?.phone;
              const ownerBirthDate = ownerRes?.birthDate;
              const ownerAge = ownerBirthDate ? (new Date().getFullYear() - new Date(ownerBirthDate).getFullYear()) : undefined;

              return (
                <div key={household.id} className="bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden border-t-[5px] border-t-emerald-600">
                  <div className="p-4 space-y-3">
                    {/* Top Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-slate-100 text-slate-500 font-bold text-[11px] px-3 py-1 rounded-full font-mono tracking-wider">
                        {household.id}
                      </span>
                      <span className="bg-white border border-slate-200/90 text-slate-700 text-xs font-semibold px-3 py-1 rounded-xl shadow-2xs">
                        {household.status}
                      </span>
                    </div>

                    {/* Owner Info */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">{household.ownerName}</h4>
                        {ownerRes && <ResidentStatusBadge resident={ownerRes} changes={changes} />}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Chủ hộ gia đình</p>
                      
                      {/* Thêm thông tin SĐT và Tuổi của Chủ Hộ theo hình đính kèm */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs font-medium text-slate-700 bg-emerald-50/60 border border-emerald-100 p-2 rounded-xl">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>SĐT: <strong className="font-bold text-slate-900">{ownerPhone || "Chưa cập nhật"}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Tuổi: <strong className="font-bold text-slate-900">{ownerAge ? `${ownerAge} tuổi` : (ownerBirthDate ? ownerBirthDate : "Chưa cập nhật")}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Address & Members info */}
                    <div className="space-y-1.5 pt-1 text-xs">
                      <div className="flex items-start gap-1.5 text-slate-500 leading-snug">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div>{household.address}</div>
                          <div className="font-medium text-slate-700">{household.wardId || "Tổ 5"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Số thành viên trong hộ: <strong className="font-bold text-slate-900">{members.length} nhân khẩu</strong></span>
                      </div>
                    </div>

                    {/* Badges / Tags list */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {/* Mức VNeID chủ hộ */}
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        (household.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_2
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : (household.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_1
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}>
                        🪪 VNeID: {household.vneidStatus || "Chưa đăng ký"}
                      </span>

                      {/* Thế hệ */}
                      <span className="bg-sky-50 text-blue-700 border border-sky-200/90 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        {getGenerationLabel(getHouseholdGenerationType(household, residents))}
                      </span>

                      {/* Gia đình văn hóa */}
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/90 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Gia đình văn hóa
                      </span>

                      {/* Rác thải */}
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        household.wasteCollectionStatus === "Chưa đăng ký" || !household.wasteCollectionStatus
                          ? "bg-rose-50 text-rose-700 border-rose-200/90"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200/90"
                      }`}>
                        Rác: {household.wasteCollectionStatus || "Chưa đăng ký"}
                      </span>

                      {/* Nước sạch */}
                      <span className="bg-amber-50 text-amber-900 border border-amber-300/80 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        Nước: {household.waterSource || "Nước giếng"}
                      </span>

                      {/* Hộ nông nghiệp */}
                      <span className="bg-orange-50 text-orange-800 border border-orange-300/90 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        Hộ nông nghiệp: {household.isAgri ? "Có" : "Không"}
                      </span>

                      {/* Thuế PNN */}
                      <span className="bg-sky-50 text-blue-900 border border-sky-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        Thuế PNN: {household.isNonAgriTaxPaid ? "Đã nộp" : "Miễn nộp"}
                      </span>

                      {/* Vị trí Bản đồ GIS liên kết */}
                      <button
                        type="button"
                        onClick={() => setGisModalHousehold(resolveHouseholdForGis(household))}
                        className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        title="Xem liên kết vị trí thực địa trên Bản đồ GIS"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>
                          Bản đồ GIS: {household.gpsLat !== undefined && household.gpsLng !== undefined 
                            ? `${household.gpsLat.toFixed(4)}, ${household.gpsLng.toFixed(4)}` 
                            : "11.3677, 106.1367"}
                        </span>
                      </button>
                    </div>

                    {/* Ghi chú box (như đính kèm) */}
                    {household.notes && (
                      <div className="mt-2.5 bg-amber-50/80 border border-amber-300/80 rounded-xl p-3 text-xs text-amber-950 leading-relaxed shadow-2xs">
                        <span className="font-bold text-amber-900">Ghi chú: </span>
                        <span className="italic text-amber-900">{household.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="bg-slate-50/70 p-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedHousehold(household)}
                      className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Xem danh sách các thành viên trong hộ gia đình"
                    >
                      <Eye className="w-4 h-4 text-slate-500" />
                      Thành viên ({members.length})
                    </button>

                    <div className="flex items-center gap-1.5">
                      {canUserPerformAction(currentUser, "edit") && (
                        <button
                          onClick={() => openEditForm(household)}
                          className="w-9 h-9 flex items-center justify-center bg-white hover:bg-blue-50 border border-slate-200/90 hover:border-blue-300 text-blue-600 rounded-xl shadow-2xs transition cursor-pointer shrink-0"
                          title="Chỉnh sửa hộ gia đình"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canUserPerformAction(currentUser, "delete") && (
                        <button
                          onClick={() => {
                            setHouseholdToDelete({ id: household.id, ownerName: household.ownerName });
                            setDeleteModalOpen(true);
                          }}
                          className="w-9 h-9 flex items-center justify-center bg-white hover:bg-rose-50 border border-slate-200/90 hover:border-rose-300 text-rose-600 rounded-xl shadow-2xs transition cursor-pointer shrink-0"
                          title="Xóa hộ gia đình"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base">Lịch sử cập nhật & lưu vết thao tác (Audit Logs)</h3>
                  <p className="text-xs text-slate-300">Ghi nhận chi tiết người thực hiện, thời gian và nội dung chỉnh sửa</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50">
              {loadingLogs ? (
                <div className="py-12 text-center text-slate-500 font-medium">
                  Đang tải lịch sử lưu vết...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic">
                  Chưa có thông tin lưu vết thao tác.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                          👤 {log.userName || log.userId || "Cán bộ"}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {log.userRole || "Cộng tác viên"}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono">
                        ⏱️ {log.timestamp ? new Date(log.timestamp).toLocaleString("vi-VN") : "Gần đây"}
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {log.action}
                      </p>
                      <p className="text-slate-600 pl-3 border-l-2 border-emerald-200">
                        {log.details}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="bg-slate-800 text-white hover:bg-slate-900 px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Sổ Hộ Gia Đình & Danh Sách Thành Viên */}
      {selectedHousehold && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
          <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden flex flex-col transition-all duration-300 ${
            isHouseholdModalZoomed ? "max-w-6xl h-[90vh] md:h-[94vh]" : "max-w-4xl max-h-[92vh]"
          }`}>
            {/* Header xanh ngọc chuẩn hành chính */}
            <div className="px-5 py-3.5 bg-emerald-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-800 rounded-xl border border-emerald-700/50 text-emerald-200">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-wide flex items-center gap-2">
                    SỔ HỘ GIA ĐÌNH: <span className="text-emerald-300 font-mono">{selectedHousehold.id}</span>
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-medium">
                    Địa chỉ: {selectedHousehold.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsHouseholdModalZoomed(!isHouseholdModalZoomed)}
                  className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                  title={isHouseholdModalZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isHouseholdModalZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setSelectedHousehold(null)}
                  className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                  title="Đóng sổ hộ khẩu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Nội dung chính Sổ Hộ Khẩu */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
              {/* Khối ĐỊNH VỊ GPS & THÔNG TIN ĐỊA CHÍNH */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  ĐỊNH VỊ GPS & THÔNG TIN ĐỊA CHÍNH
                </h4>

                <div className="flex flex-col md:flex-row justify-between gap-4">
                  {/* Cột trái: Chi tiết địa chính & an sinh */}
                  <div className="flex-1 space-y-2 text-xs text-slate-700">
                    <p><strong className="text-slate-900">Phường/Xã:</strong> Phường Bình Minh, Tây Ninh</p>
                    <p><strong className="text-slate-900">Địa bàn:</strong> {selectedHousehold.wardId || "Tổ 5"}</p>
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <strong className="text-slate-900">Tọa độ:</strong> 
                      <span className="font-mono font-medium text-slate-800">
                        {selectedHousehold.gpsLat ?? 11.367716}, {selectedHousehold.gpsLng ?? 106.136728}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <strong className="text-slate-900 shrink-0">Thu gom rác:</strong>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${selectedHousehold.wasteCollectionStatus === "Đã đăng ký" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"}`}>
                        {selectedHousehold.wasteCollectionStatus || "Chưa đăng ký"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 shrink-0">Nguồn nước sạch:</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {selectedHousehold.waterSource || "Nước giếng"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 shrink-0">Hộ nông nghiệp:</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {selectedHousehold.isAgri ? "Có" : "Không"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 shrink-0">Định danh VNeID chủ hộ:</strong>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        (selectedHousehold.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_2
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : (selectedHousehold.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_1
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}>
                        🪪 {selectedHousehold.vneidStatus || "Chưa đăng ký"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 shrink-0">Thuế đất phi nông nghiệp (PNN):</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                        {selectedHousehold.isNonAgriTaxPaid ? "Đã nộp" : "Miễn nộp"}
                      </span>
                    </div>
                    <p><strong className="text-slate-900">Thời điểm đăng ký:</strong> {selectedHousehold.createdAt || "2026-07-24"}</p>
                    <p>
                      <strong className="text-slate-900">Số CMND cũ chủ hộ:</strong>{" "}
                      <span className="font-mono font-medium">{selectedHousehold.ownerOldCmnd || residents.find(r => r.householdId === selectedHousehold.id && r.relationToOwner === "Chủ hộ")?.oldCmnd || "Chưa cập nhật"}</span>
                    </p>
                    <p>
                      <strong className="text-slate-900">Ngày cấp CCCD chủ hộ:</strong>{" "}
                      <span className="font-medium">{selectedHousehold.ownerCccdIssuedDate || residents.find(r => r.householdId === selectedHousehold.id && r.relationToOwner === "Chủ hộ")?.cccdIssuedDate || "Chưa cập nhật"}</span>
                    </p>
                  </div>

                  {/* Cột phải: Hình ảnh thực địa (click để zoom) */}
                  {selectedHousehold.photoUrl && (
                    <div className="w-full md:w-64 lg:w-72 shrink-0">
                      <div
                        onClick={() => setZoomImage({ url: selectedHousehold.photoUrl!, title: `Hình ảnh thực địa Hộ ${selectedHousehold.id} - ${selectedHousehold.ownerName}` })}
                        className="group relative h-40 md:h-44 w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs cursor-pointer bg-slate-100"
                        title="Nhấp vào hình ảnh để phóng to HD"
                      >
                        <img
                          src={selectedHousehold.photoUrl}
                          alt="Ảnh thực địa hộ"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-xs">
                          <ZoomIn className="w-4 h-4" /> Phóng to hình ảnh
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Khối Danh sách nhân khẩu đăng ký */}
              <div className="space-y-3">
                {(() => {
                  const hhMembers = residents.filter(r => r.householdId === selectedHousehold.id);
                  return (
                    <>
                      <div className="border-b border-slate-200/80 pb-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600" />
                          Danh sách nhân khẩu đăng ký ({hhMembers.length} người)
                        </h4>
                      </div>

                      {hhMembers.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200 text-xs">
                          Chưa có dữ liệu nhân khẩu thành viên cho hộ gia đình này.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {hhMembers.map((m) => {
                            const memberLogs = getMemberHistoryLogs(m);
                            const isHistoryExpanded = !!expandedMemberHistory[m.id];
                            return (
                              <div
                                key={m.id}
                                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 shadow-2xs space-y-2 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-900">{m.fullName}</span>
                                    <ResidentStatusBadge resident={m} changes={changes} />
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${m.relationToOwner === "Chủ hộ" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                                      {m.relationToOwner || "Thành viên"}
                                    </span>
                                  </div>

                                  {m.phone && (
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-mono text-xs font-bold rounded-full border border-emerald-200">
                                      {m.phone}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-600">
                                  Ngày sinh: <span className="font-medium text-slate-800">{m.birthDate || "N/A"}</span> | Giới tính: <span className="font-medium text-slate-800">{m.gender}</span>
                                </p>

                                <p className="text-xs text-slate-600">
                                  CCCD/Mã định danh: <span className="font-mono font-semibold text-slate-800">{m.nationalId || m.id || "Chưa có"}</span>
                                </p>

                                <p className="text-xs text-slate-600">
                                  Số CMND cũ: <span className="font-mono text-slate-800">{m.oldCmnd || "Chưa có"}</span>
                                </p>

                                <p className="text-xs text-slate-600">
                                  Nghề nghiệp: <span className="font-medium text-slate-800">{m.occupation || "Tự do"}</span> | BHYT: <span className="font-medium text-slate-800">{m.hasHealthInsurance ? "Đã có" : "Chưa đăng ký"}</span>
                                </p>

                                {m.photoUrl && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setZoomImage({ url: m.photoUrl!, title: `Ảnh nhân khẩu: ${m.fullName} (${m.relationToOwner})` })}
                                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                                    >
                                      <img src={m.photoUrl} alt={m.fullName} className="w-4 h-4 rounded-full object-cover border border-emerald-300" />
                                      <ZoomIn className="w-3.5 h-3.5" /> Ảnh CCCD/Chân dung
                                    </button>
                                  </div>
                                )}


                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* KHỐI LỊCH SỬ CẬP NHẬT CHI TIẾT HỘ DÂN (Chuyển xuống cuối cửa sổ modal) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <button
                  type="button"
                  onClick={() => setShowHouseholdHistory(!showHouseholdHistory)}
                  className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer border shadow-2xs ${
                    showHouseholdHistory
                      ? "bg-amber-600 text-white border-amber-700 hover:bg-amber-700"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4" />
                    {showHouseholdHistory ? "Ẩn lịch sử cập nhật chi tiết hộ dân" : "Hiện lịch sử cập nhật chi tiết hộ dân"}
                  </span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${showHouseholdHistory ? "bg-amber-800 text-amber-100" : "bg-amber-200 text-amber-950"}`}>
                    {getHouseholdHistoryLogs(selectedHousehold).length} bản ghi
                  </span>
                </button>

                {showHouseholdHistory && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs animate-fade-in">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <HistoryIcon className="w-4 h-4 text-amber-700" />
                        Nhật ký lưu vết & Lịch sử biến động hộ dân: <strong className="underline">{selectedHousehold.ownerName} ({selectedHousehold.id})</strong>
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {getHouseholdHistoryLogs(selectedHousehold).map((log: any) => (
                        <div key={log.id} className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] border-b border-amber-200/60 pb-1">
                            <span className="font-bold text-slate-800">👤 Cán bộ thực hiện: {log.userName} ({log.userRole})</span>
                            <span className="text-slate-500 font-mono text-[10px]">⏱️ {log.timestamp}</span>
                          </div>
                          <p className="font-bold text-emerald-800 text-[11px] flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            {log.action}
                          </p>
                          <p className="text-slate-600 text-[11px] leading-relaxed pl-2.5 border-l-2 border-emerald-400 font-medium">
                            {log.details}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer nút đóng */}
            <div className="p-3.5 bg-white border-t border-slate-200 flex justify-end items-center">
              <button
                onClick={() => setSelectedHousehold(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs"
              >
                Đóng sổ hộ khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center">
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
              <a
                href={zoomImage.url}
                target="_blank"
                rel="noreferrer"
                download="hinh_anh_thuc_dia.jpg"
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer backdrop-blur-xs"
                title="Tải ảnh về máy"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => setZoomImage(null)}
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer backdrop-blur-xs"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-white/10 border border-white/20 p-2 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex items-center justify-center">
              <Zoom>
                <img
                  src={zoomImage.url}
                  alt={zoomImage.title || "Hình ảnh thực địa"}
                  referrerPolicy="no-referrer"
                  className="max-h-[75vh] max-w-full object-contain rounded-xl cursor-zoom-in"
                />
              </Zoom>
            </div>
            {zoomImage.title && (
              <p className="text-white/90 text-xs font-medium mt-3 bg-black/40 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-xs">
                📸 {zoomImage.title} (Nhấp vào ảnh để phóng to full HD)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal Form Thêm / Chỉnh Sửa Hộ Gia Đình */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 overflow-y-auto animate-fade-in">
          <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden flex flex-col my-auto transition-all duration-300 ${
            isFormZoomed ? "max-w-6xl h-[90vh] md:h-[94vh]" : "max-w-4xl max-h-[92vh]"
          }`}>
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-emerald-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Home className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-base md:text-lg tracking-wide">
                  {formMode === "add" ? "Khai báo thành lập Hộ gia đình mới" : `Chỉnh sửa Hộ gia đình (${formId})`}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsFormZoomed(!isFormZoomed)}
                  className="p-1 text-emerald-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title={isFormZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isFormZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-emerald-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-5 md:p-6 overflow-y-auto space-y-5 flex-1 bg-white text-xs text-slate-700">
              {/* NHẬP LIỆU NHANH BẰNG CCCD */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">Nhập liệu nhanh bằng CCCD</p>
                    <p className="text-[10px] text-emerald-700 font-medium">Quét QR hoặc tải ảnh để tự động điền mọi thông tin.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 shrink-0"
                >
                  <QrCode className="w-4 h-4" /> Quét QR CCCD
                </button>
              </div>

              {/* MÃ HỘ & TÊN CHỦ HỘ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã Hộ gia đình *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formId}
                      onChange={(e) => setFormId(e.target.value)}
                      required
                      placeholder="HỘ-12345"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setFormId(`HỘ-${Math.floor(10000 + Math.random() * 90000)}`)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-300 transition-colors shrink-0 cursor-pointer"
                    >
                      Tạo mã
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên chủ hộ *</label>
                  <input
                    type="text"
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    placeholder="Nguyễn Tấn Bình"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* THÔNG TIN NHÂN KHẨU CHỦ HỘ */}
              <div className="border border-emerald-200/90 rounded-2xl p-4 bg-emerald-50/20 space-y-3.5">
                <h4 className="font-bold text-xs text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-emerald-700" />
                  THÔNG TIN NHÂN KHẨU CHỦ HỘ *
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số CCCD / Định danh *</label>
                    <input
                      type="text"
                      value={ownerCccd}
                      onChange={(e) => {
                        setOwnerCccd(e.target.value);
                      }}
                      placeholder="079096012345"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số CMND cũ</label>
                    <input
                      type="text"
                      value={ownerOldCmnd}
                      onChange={(e) => setOwnerOldCmnd(e.target.value)}
                      placeholder="123456789"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày cấp CCCD</label>
                    <input
                      type="date"
                      value={ownerCccdIssuedDate}
                      onChange={(e) => setOwnerCccdIssuedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số điện thoại *</label>
                  <input
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="0901234567"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày sinh *</label>
                    <input
                      type="date"
                      value={ownerBirthDate}
                      onChange={(e) => setOwnerBirthDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giới tính *</label>
                    <select
                      value={ownerGender}
                      onChange={(e) => setOwnerGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      <option value={Gender.MALE}>Nam</option>
                      <option value={Gender.FEMALE}>Nữ</option>
                      <option value={Gender.OTHER}>Khác</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái cư trú *</label>
                    <select
                      value={ownerResidentStatus}
                      onChange={(e) => setOwnerResidentStatus(e.target.value as ResidentStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      <option value={ResidentStatus.PERMANENT}>Thường trú</option>
                      <option value={ResidentStatus.TEMPORARY_STAY}>Tạm trú</option>
                      <option value={ResidentStatus.TEMPORARY_ABSENT}>Tạm vắng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Định Danh VNeID *</label>
                    <select
                      value={formVneidStatus}
                      onChange={(e) => setFormVneidStatus(e.target.value as VNeIDStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white font-medium"
                    >
                      <option value={VNeIDStatus.LEVEL_2}>🪪 Mức 2</option>
                      <option value={VNeIDStatus.LEVEL_1}>🪪 Mức 1</option>
                      <option value={VNeIDStatus.NOT_REGISTERED}>⚠️ Chưa đăng ký</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dân tộc *</label>
                    <input
                      type="text"
                      value={ownerEthnicity}
                      onChange={(e) => setOwnerEthnicity(e.target.value)}
                      placeholder="Kinh"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tôn giáo *</label>
                    <input
                      type="text"
                      value={ownerReligion}
                      onChange={(e) => setOwnerReligion(e.target.value)}
                      placeholder="Không"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                {/* DYNAMICAL ROW: Địa chỉ tạm trú khi chọn Tạm trú hoặc Tạm vắng */}
                {(ownerResidentStatus === ResidentStatus.TEMPORARY_STAY || ownerResidentStatus === ResidentStatus.TEMPORARY_ABSENT) && (
                  <div className="bg-amber-50 border border-amber-300/80 p-3 rounded-xl animate-fade-in">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Địa chỉ tạm trú *</label>
                    <input
                      type="text"
                      required
                      value={ownerTemporaryAddress}
                      onChange={(e) => setOwnerTemporaryAddress(e.target.value)}
                      placeholder="Nhập địa chỉ tạm trú thực tế của chủ hộ..."
                      className="w-full px-3 py-2 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs bg-white text-amber-950 font-medium"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ thường trú *</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Nhập địa chỉ thường trú..."
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tổ dân phố *</label>
                    <select
                      value={formWard}
                      onChange={(e) => setFormWard(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      {Array.from({ length: 50 }, (_, i) => `Tổ ${i + 1}`).map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trình độ học vấn *</label>
                    <select
                      value={ownerEducation}
                      onChange={(e) => setOwnerEducation(e.target.value as EducationLevel)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      <option value={EducationLevel.NONE}>Chưa qua đào tạo</option>
                      <option value={EducationLevel.PRIMARY}>Tiểu học</option>
                      <option value={EducationLevel.SECONDARY}>THCS</option>
                      <option value={EducationLevel.HIGH_SCHOOL}>Tốt nghiệp THPT</option>
                      <option value={EducationLevel.VOCATIONAL}>Trung cấp / Nghề</option>
                      <option value={EducationLevel.COLLEGE}>Cao đẳng</option>
                      <option value={EducationLevel.UNIVERSITY}>Đại học</option>
                      <option value={EducationLevel.POSTGRADUATE}>Sau đại học</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghề nghiệp *</label>
                    <input
                      type="text"
                      value={ownerOccupation}
                      onChange={(e) => setOwnerOccupation(e.target.value)}
                      placeholder="Lao động tự do"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã số thẻ BHYT</label>
                    <input
                      type="text"
                      value={ownerInsuranceId}
                      onChange={(e) => setOwnerInsuranceId(e.target.value)}
                      placeholder="DN4797912345678"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đối tượng trợ cấp xã hội</label>
                    <select
                      value={ownerSubsidyType}
                      onChange={(e) => setOwnerSubsidyType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      <option value="Không">Không thuộc diện trợ cấp</option>
                      <option value="Trợ cấp người cao tuổi">Trợ cấp người cao tuổi</option>
                      <option value="Trợ cấp khuyết tật">Trợ cấp khuyết tật</option>
                      <option value="Trợ cấp gia đình nghèo">Trợ cấp gia đình nghèo</option>
                      <option value="Trợ cấp bảo trợ xã hội khác">Trợ cấp bảo trợ xã hội khác</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={ownerIsDisabled}
                      onChange={(e) => setOwnerIsDisabled(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    Chủ hộ là Người khuyết tật / Nhận trợ cấp khuyết tật
                  </label>
                </div>
              </div>

              {/* PHÂN LOẠI ĐỜI SỐNG & TIÊU CHÍ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân loại đời sống</label>
                  <select
                    value={formPoor}
                    onChange={(e) => setFormPoor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                  >
                    <option value="Hộ trung bình">Hộ trung bình</option>
                    <option value="Hộ bình thường">Hộ bình thường</option>
                    <option value="Hộ nghèo">Hộ nghèo</option>
                    <option value="Hộ cận nghèo">Hộ cận nghèo</option>
                    <option value="Khá / Giàu">Khá / Giàu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hộ nông nghiệp</label>
                  <select
                    value={formAgri}
                    onChange={(e) => setFormAgri(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                  >
                    <option value="Không">Không</option>
                    <option value="Có">Có</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thuế đất phi nông nghiệp (PNN)</label>
                  <select
                    value={formNonAgriTax}
                    onChange={(e) => setFormNonAgriTax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                  >
                    <option value="Chưa nộp">Chưa nộp</option>
                    <option value="Đã nộp">Đã nộp</option>
                    <option value="Miễn nộp">Miễn nộp</option>
                  </select>
                </div>
              </div>

              {/* DANH HIỆU, CHÍNH SÁCH & DỊCH VỤ CÔNG */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <h4 className="font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                  DANH HIỆU, CHÍNH SÁCH & DỊCH VỤ CÔNG
                </h4>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formCultural}
                      onChange={(e) => setFormCultural(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    Gia đình đạt chuẩn "Gia đình Văn hóa"
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formPolicy}
                      onChange={(e) => setFormPolicy(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    Gia đình chính sách (Có thương binh, liệt sĩ)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formMeritorious}
                      onChange={(e) => setFormMeritorious(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    Gia đình có công với Cách mạng
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thu gom rác *</label>
                    <select
                      value={formWasteCollectionStatus}
                      onChange={(e) => setFormWasteCollectionStatus(e.target.value as WasteCollectionStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      <option value={WasteCollectionStatus.REGISTERED}>Đã đăng ký</option>
                      <option value={WasteCollectionStatus.UNREGISTERED}>Chưa đăng ký</option>
                      <option value={WasteCollectionStatus.CANCELLED}>Đã hủy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nước sạch *</label>
                    <select
                      value={formWaterSource}
                      onChange={(e) => setFormWaterSource(e.target.value as WaterSource)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs bg-white"
                    >
                      <option value={WaterSource.TAP_WATER}>Nước máy</option>
                      <option value={WaterSource.WELL_WATER}>Nước giếng</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GHI CHÚ THÊM */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú thêm</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Nhập thông tin ghi chú đặc biệt về hộ dân này (ví dụ hoàn cảnh đặc biệt, hộ neo đơn, đang đi làm ăn xa...)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* TRƯỜNG THÔNG TIN BỔ SUNG */}
              <div className="border border-slate-200/90 rounded-2xl p-3.5 bg-slate-50/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[11px] text-slate-600 uppercase tracking-wide">TRƯỜNG THÔNG TIN BỔ SUNG</span>
                  <button
                    type="button"
                    onClick={() => setFormCustomFields([...formCustomFields, { key: "", value: "" }])}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold border border-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    + Thêm trường mới
                  </button>
                </div>
                {formCustomFields.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Chưa có trường thông tin bổ sung nào. Nhấn "Thêm trường mới" để bổ sung.</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {formCustomFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Tên trường"
                          value={field.key}
                          onChange={(e) => {
                            const updated = [...formCustomFields];
                            updated[idx].key = e.target.value;
                            setFormCustomFields(updated);
                          }}
                          className="w-1/3 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Giá trị"
                          value={field.value}
                          onChange={(e) => {
                            const updated = [...formCustomFields];
                            updated[idx].value = e.target.value;
                            setFormCustomFields(updated);
                          }}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setFormCustomFields(formCustomFields.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BOTTOM TWO CARDS: GPS & ẢNH THỰC ĐỊA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* GPS CARD */}
                <div className="border border-sky-200 bg-sky-50/40 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Tọa độ GPS (Lat / Lng)</span>
                    <span className="text-xs font-medium text-slate-600 block mt-0.5">
                      {formGpsLat && formGpsLng ? `${formGpsLat}, ${formGpsLng}` : "Chưa cập nhật"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMapsPickerOpen(true)}
                      className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Chọn bản đồ
                    </button>
                    <button
                      type="button"
                      onClick={handleGetGps}
                      className="py-1.5 px-3 bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-900 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Vị trí hiện tại
                    </button>
                  </div>
                </div>

                {/* PHOTO CARD */}
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Ảnh thực địa / Nhà ở</span>
                    <span className="text-xs font-medium text-slate-600 block mt-0.5">
                      {formPhoto ? "Đã cập nhật hình ảnh" : "Chưa cập nhật"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 py-1.5 px-3 bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-sky-700" /> Tải thực địa
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setFormPhoto(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="py-1.5 px-3 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" /> Chụp ảnh
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {formMode === "add" ? "Lưu hộ gia đình mới" : "Cập nhật hộ gia đình"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CccdQrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleCccdScanSuccess}
      />

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(photoUrl) => {
          setFormPhoto(photoUrl);
          setIsCameraModalOpen(false);
        }}
      />

      <MapPickerModal
        isOpen={isMapsPickerOpen}
        initialLat={formGpsLat}
        initialLng={formGpsLng}
        onClose={() => setIsMapsPickerOpen(false)}
        onSelect={(coords) => {
          setFormGpsLat(coords.lat);
          setFormGpsLng(coords.lng);
          setIsMapsPickerOpen(false);
        }}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen && householdToDelete !== null}
        title={`Xoá hộ gia đình: ${householdToDelete?.ownerName}`}
        description={`Bạn có chắc chắn muốn xoá vĩnh viễn hộ gia đình này khỏi hệ thống? Hành động này không thể hoàn tác.`}
        confirmWord={householdToDelete?.ownerName || "XOÁ"}
        placeholder={`Nhập tên chủ hộ '${householdToDelete?.ownerName}' để xác nhận`}
        onConfirm={() => {
          if (householdToDelete) {
            onDeleteHousehold(householdToDelete.id);
            if (selectedHousehold?.id === householdToDelete.id) {
              setSelectedHousehold(null);
            }
          }
          setDeleteModalOpen(false);
          setHouseholdToDelete(null);
        }}
        onCancel={() => {
          setDeleteModalOpen(false);
          setHouseholdToDelete(null);
        }}
      />

      {gisModalHousehold && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-3xl h-[72vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Vị trí bản đồ GIS: Hộ {gisModalHouseholdResolved?.ownerName || "Chủ hộ chưa xác định"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono leading-tight">
                    Mã hộ: {gisModalHouseholdResolved?.id || gisModalHousehold?.id || "N/A"} • {gisModalHouseholdResolved?.wardId || "Tổ 5"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGisModalHousehold(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-900">
              <GoogleGISMap
                households={households}
                selectedHouse={gisModalHouseholdResolved}
                onSelectHouse={(h) => setGisModalHousehold(resolveHouseholdForGis(h))}
                center={
                  gisModalHouseholdResolved?.gpsLat !== undefined && gisModalHouseholdResolved?.gpsLng !== undefined
                    ? [gisModalHouseholdResolved.gpsLat, gisModalHouseholdResolved.gpsLng]
                    : [11.367716, 106.136728]
                }
                viewZoom={16}
              />
            </div>

            {/* Footer details */}
            <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
              <div className="flex items-center gap-4">
                <span>Chủ hộ: <strong className="text-white">{gisModalHouseholdResolved?.ownerName || "Chủ hộ chưa xác định"}</strong></span>
                <span>Số ĐT: <strong className="text-sky-400">{gisModalHouseholdResolved?.phone || "Chưa có SĐT"}</strong></span>
                <span>Địa chỉ: <strong className="text-slate-300">{gisModalHouseholdResolved?.address || "Chưa cập nhật địa chỉ"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${gisModalHouseholdResolved?.gpsLat ?? 11.367716},${gisModalHouseholdResolved?.gpsLng ?? 106.136728}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Mở Google Maps</span>
                </a>
                <button
                  type="button"
                  onClick={() => setGisModalHousehold(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Đóng bản đồ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
