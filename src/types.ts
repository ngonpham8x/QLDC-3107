/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Gender {
  MALE = "Nam",
  FEMALE = "Nữ",
  OTHER = "Khác"
}

export enum ResidentStatus {
  PERMANENT = "Thường trú",
  TEMPORARY_STAY = "Tạm trú",
  TEMPORARY_ABSENT = "Tạm vắng"
}

export enum EducationLevel {
  NONE = "Chưa qua đào tạo",
  PRIMARY = "Tiểu học",
  SECONDARY = "THCS",
  HIGH_SCHOOL = "THPT",
  VOCATIONAL = "Trung cấp",
  COLLEGE = "Cao đẳng",
  UNIVERSITY = "Đại học",
  POSTGRADUATE = "Sau đại học"
}

export enum LaborSector {
  AGRICULTURE = "Nông nghiệp",
  INDUSTRY = "Công nghiệp",
  SERVICE = "Dịch vụ",
  UNEMPLOYED = "Thất nghiệp"
}

export enum HouseholdStatus {
  POOR = "Hộ nghèo",
  NEAR_POOR = "Hộ cận nghèo",
  AVERAGE = "Hộ trung bình",
  FAIR = "Hộ khá",
  RICH = "Hộ giàu"
}

export enum HousingType {
  YES = "Có",
  NO = "Không"
}

export enum WaterSource {
  TAP_WATER = "Nước máy",
  WELL_WATER = "Nước giếng"
}

export enum WasteCollectionStatus {
  REGISTERED = "Đã đăng ký",
  UNREGISTERED = "Chưa đăng ký",
  CANCELLED = "Đã hủy"
}

export enum DemographicsChangeType {
  NEWBORN = "Sinh mới",
  MOVE_IN = "Chuyển đến",
  MOVE_OUT = "Chuyển đi",
  TEMP_STAY = "Đăng ký tạm trú",
  TEMP_ABSENT = "Đăng ký tạm vắng",
  DEATH = "Qua đời"
}

// User roles for RBAC
export enum UserRole {
  SUPER_ADMIN = "Quản trị viên",
  WARD_LEADER = "Trưởng khu phố",
  COLLABORATOR = "CTV"
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  phone: string;
  avatarUrl?: string;
}

export interface Household {
  id: string; // Mã hộ gia đình (e.g. Hộ-10023)
  ownerId: string; // Mã nhân khẩu của chủ hộ
  ownerOldCmnd?: string; // Số CMND cũ của chủ hộ
  ownerName: string; // Tên chủ hộ lưu nhanh
  phone?: string; // Số điện thoại liên hệ chủ hộ
  address: string;
  wardId: string; // Tổ dân phố (e.g. Tổ 5)
  quarterId?: string; // Khu phố (e.g. Khu phố 2)
  createdAt: string;
  status: HouseholdStatus;
  isCulturalFamily: boolean; // Gia đình văn hóa
  isPolicyFamily: boolean; // Gia đình chính sách
  isMeritoriousFamily: boolean; // Gia đình có công với cách mạng
  isWasteFeePaid?: boolean; // Thu phí thu gom rác (legacy)
  wasteCollectionStatus?: WasteCollectionStatus; // Thu gom rác
  waterSource?: WaterSource; // Nước sạch
  housingType: HousingType;
  isAgri?: boolean; // Hộ nông nghiệp
  isNonAgriTaxPaid?: boolean; // Thuế đất PNN

// GPS
gpsLat?: number;
gpsLng?: number;
gpsUpdatedAt?: string;
gpsUpdatedBy?: string;

photoUrl?: string;
notes?: string;
  nonAgriTax?: string; // Thuế PNN (Đã nộp / Chưa nộp / Miễn nộp)
  customFields?: Record<string, string>; // Các trường thông tin bổ sung tự định nghĩa
}

export interface Resident {
  id: string; // Mã định danh / CCCD
  oldCmnd?: string; // Số CMND 9 số cũ (nếu có)
  fullName: string;
  birthDate: string;
  gender: Gender;
  relationToOwner: string; // Quan hệ với chủ hộ
  nationalId: string; // CMND / CCCD / Mã định danh
  passport?: string;
  phone?: string;
  email?: string;
  status: ResidentStatus;
  ethnicity: string; // Dân tộc
  religion: string; // Tôn giáo
  nationality: string; // Quốc tịch
  education: EducationLevel;
  occupation: string;
  workplace?: string;
  householdId: string; // Thuộc hộ gia đình nào
  wardId?: string; // Tổ dân phố (e.g. Tổ 5)
  permanentAddress?: string; // Địa chỉ thường trú
  temporaryAddress?: string; // Địa chỉ tạm trú
  createdAt?: string;
  
  // Health
  insuranceId?: string; // Mã BHYT
  hasHealthInsurance?: boolean; // Cờ thẻ BHYT
  insuranceIssuedDate?: string;
  insuranceExpiryDate?: string;
  isElderly?: boolean; // Người già (> 60)
  isDisabled?: boolean; // Khuyết tật
  isPregnant?: boolean; // Phụ nữ mang thai
  isOrphan?: boolean; // Trẻ em mồ côi

  // Education tracking
  isStudent?: boolean;
  studentType?: "Mầm non" | "Tiểu học" | "THCS" | "THPT" | "Sinh viên" | "Chưa đến trường" | "Bỏ học";

  // Labor tracking
  isEmployed: boolean;
  laborSector: LaborSector;
  isExportLabor?: boolean; // Lao động xuất khẩu

  // Social subsidy
  subsidyType?: string; // Loại trợ cấp
  subsidyAmount?: number; // Mức trợ cấp
  subsidyStartDate?: string;

  // Geographic and field metadata
  notes?: string;
  gpsLat?: number;
  gpsLng?: number;
  photoUrl?: string;
  customFields?: Record<string, string>; // Các trường thông tin bổ sung tự định nghĩa
}

export interface DemographicsChange {
  id: string;
  residentId: string;
  residentName: string;
  type: DemographicsChangeType;
  date: string;
  details: string; // JSON or text details (parents, old address, cause of death etc.)
  recordedBy: string;
}

export interface BusinessHousehold {
  id: string;
  name: string;
  ownerName: string;
  ownerId: string; // Resident ID
  sector: string;
  taxCode: string;
  licenseNumber: string;
  address: string;
  phone?: string;
  notes?: string;
}

export interface RuralCriteria {
  id: string;
  name: string;
  status: "Đạt" | "Chưa đạt";
  value: string;
  targetValue: string;
  category: "Thu nhập" | "Nhà ở" | "Môi trường" | "Giáo dục" | "Y tế" | "Lao động" | "Khác";
  lastUpdated: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress?: string;
}

// Offline sync queue
export interface SyncItem {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: "household" | "resident" | "change" | "business" | "criteria";
  data: any;
  timestamp: string;
}

export interface AllowedEmail {
  id: string; // Lowercased email as unique key
  email: string;
  fullName?: string;
  role: UserRole;
  assignedBy: string;
  assignedAt: string;
}

export interface PendingRegistration {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  requestedRole: UserRole;
  reason?: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface QuarterDocument {
  id: string;
  title: string;
  docNumber?: string;
  issueDate: string;
  issuer: string;
  category: "Văn bản pháp quy" | "Kế hoạch / Báo cáo" | "Mẫu biểu hồ sơ" | "Khác";
  description?: string;
  fileSize?: string;
  fileType?: string;
  fileUrl?: string;
  attachments?: { name: string; size: string; type: string; dataUrl: string }[];
  createdAt: string;
}
