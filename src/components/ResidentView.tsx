/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Users, Search, Plus, Edit, Trash2, ShieldAlert, Check, X,
  QrCode, UserPlus, Eye, Heart, GraduationCap, Briefcase, FileText, Download, Printer,
  MapPin, Camera, LayoutGrid, Table, Image, Maximize2, Minimize2, ZoomIn, History
} from "lucide-react";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import { Resident, Gender, ResidentStatus, EducationLevel, LaborSector, User, UserRole, Household, VNeIDStatus, DemographicsChange, canUserPerformAction } from "../types";
import ResidentStatusBadge from "./ResidentStatusBadge";
import { CameraCaptureModal } from "./CameraCaptureModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { CccdQrScannerModal } from "./CccdQrScannerModal";
import MapPickerModal from "./MapPickerModal";
import { getCurrentGpsLocation } from "../utils/geolocation";
import GoogleGISMap from "./GoogleGISMap";

interface ResidentViewProps {
  residents: Resident[];
  households: Household[];
  changes?: DemographicsChange[];
  currentUser: User | null;
  onAddResident: (resident: Resident) => void;
  onUpdateResident: (resident: Resident) => void;
  onDeleteResident: (id: string) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
  isMobile?: boolean;
  existingEntityIds?: Set<string>;
}

const getAge = (birthDateStr: string) => {
  if (!birthDateStr) return 0;
  const bdate = new Date(birthDateStr);
  if (isNaN(bdate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - bdate.getFullYear();
  const m = today.getMonth() - bdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bdate.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export default function ResidentView({
  residents, households, changes = [], currentUser, onAddResident, onUpdateResident, onDeleteResident, onExport, isMobile = false, existingEntityIds
}: ResidentViewProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [residentToDelete, setResidentToDelete] = useState<{ id: string; fullName: string } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">("card");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [eduFilter, setEduFilter] = useState<string>("ALL");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("ALL");
  const [wardFilter, setWardFilter] = useState<string>("ALL");
  const [vneidFilter, setVneidFilter] = useState<string>("ALL");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [showResidentHistory, setShowResidentHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [gisModalResident, setGisModalResident] = useState<{ resident: Resident; household?: Household; lat: number; lng: number } | null>(null);

  const getResidentGisCoords = (resident: Resident) => {
    const parentHh = households.find((h) => h.id === resident.householdId);
    if (parentHh && parentHh.gpsLat !== undefined && parentHh.gpsLng !== undefined && !Number.isNaN(Number(parentHh.gpsLat))) {
      return { lat: Number(parentHh.gpsLat), lng: Number(parentHh.gpsLng) };
    }
    let lat = resident.gpsLat;
    let lng = resident.gpsLng;
    if (lat === undefined || lng === undefined || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      const charSum = (resident.id || resident.fullName || "1").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      lat = parseFloat((11.367716 + ((charSum % 20) - 10) * 0.0006).toFixed(6));
      lng = parseFloat((106.136728 + (((charSum * 3) % 20) - 10) * 0.0006).toFixed(6));
    } else {
      lat = Number(lat);
      lng = Number(lng);
    }
    return { lat, lng };
  };

  const openGisMapForResident = (resident: Resident) => {
    const parentHh = households.find((h) => h.id === resident.householdId);
    const { lat, lng } = getResidentGisCoords(resident);
    setGisModalResident({ resident, household: parentHh, lat, lng });
  };

  React.useEffect(() => {
    fetch("/api/logs")
      .then((r) => {
        if (!r.ok) return [];
        const ct = r.headers.get("content-type");
        if (ct && ct.includes("application/json")) return r.json();
        return [];
      })
      .then((data) => {
        if (Array.isArray(data)) setAuditLogs(data);
      })
      .catch((err) => console.error("Error loading logs in ResidentView:", err));
  }, []);

  const getResidentHistoryLogs = (m: Resident) => {
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

  // Form & Scanner states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDetailZoomed, setIsDetailZoomed] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningInProgress, setScanningInProgress] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Form Fields
  const [formId, setFormId] = useState(""); // CCCD / Personal ID
  const [formOldCmnd, setFormOldCmnd] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formGender, setFormGender] = useState<Gender>(Gender.MALE);
  const [formRelation, setFormRelation] = useState("Con");
  const [formPassport, setFormPassport] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<ResidentStatus>(ResidentStatus.PERMANENT);
  const [formVneidStatus, setFormVneidStatus] = useState<VNeIDStatus>(VNeIDStatus.LEVEL_2);
  const [formEthnicity, setFormEthnicity] = useState("Kinh");
  const [formReligion, setFormReligion] = useState("Không");
  const [formNationality, setFormNationality] = useState("Việt Nam");
  const [formEducation, setFormEducation] = useState<EducationLevel>(EducationLevel.HIGH_SCHOOL);
  const [formOccupation, setFormOccupation] = useState("");
  const [formWorkplace, setFormWorkplace] = useState("");
  const [formHouseholdId, setFormHouseholdId] = useState("");
  const [formWardId, setFormWardId] = useState("Tổ 1");
  const [formPermanentAddress, setFormPermanentAddress] = useState("");
  const [formTemporaryAddress, setFormTemporaryAddress] = useState("");
  
  // Health
  const [formInsuranceId, setFormInsuranceId] = useState("");
  const [formIsDisabled, setFormIsDisabled] = useState(false);
  const [formIsPregnant, setFormIsPregnant] = useState(false);
  
  // Student Category
  const [formIsStudent, setFormIsStudent] = useState(false);
  const [formStudentType, setFormStudentType] = useState<"Mầm non" | "Tiểu học" | "THCS" | "THPT" | "Sinh viên" | "Chưa đến trường" | "Bỏ học">("THPT");

  // Labor
  const [formIsEmployed, setFormIsEmployed] = useState(true);
  const [formLaborSector, setFormLaborSector] = useState<LaborSector>(LaborSector.SERVICE);

  // Geographic and field metadata states
  const [formNotes, setFormNotes] = useState("");
  const [formGpsLat, setFormGpsLat] = useState("");
  const [formGpsLng, setFormGpsLng] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formCustomFields, setFormCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [isScanningGps, setIsScanningGps] = useState(false);
  const [simulatingCamera, setSimulatingCamera] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isMapsPickerOpen, setIsMapsPickerOpen] = useState(false);
  const [showGpsControls, setShowGpsControls] = useState(false);

  // Danh sách Tổ dân phố khả dụng
  const availableWards = React.useMemo(() => {
    const wards = new Set<string>();
    residents.forEach((r) => {
      const parentHh = households.find((h) => h.id === r.householdId);
      const ward = r.wardId || parentHh?.wardId;
      if (ward) {
        wards.add(ward);
      } else {
        const match = (r.permanentAddress || parentHh?.address || "").match(/Tổ\s+\d+/i);
        if (match) wards.add(match[0]);
      }
    });
    households.forEach((h) => {
      if (h.wardId) wards.add(h.wardId);
      else if (h.address) {
        const match = h.address.match(/Tổ\s+\d+/i);
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
  }, [residents, households]);

  // Filtered residents
  const activeResidents = residents.filter(r => r.occupation !== "Đã qua đời");
  const filteredResidents = activeResidents.filter(r => {
    const hh = households.find(h => h.id === r.householdId);
    const matchesCustomFields = r.customFields && Object.entries(r.customFields).some(([k, v]) => 
      k.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesSearch = 
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.oldCmnd || "").includes(searchQuery) ||
      (r.phone && r.phone.includes(searchQuery)) ||
      (hh && hh.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      !!matchesCustomFields;

    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchesEdu = eduFilter === "ALL" || r.education === eduFilter;
    
    let matchesInsurance = true;
    if (insuranceFilter === "YES") {
      matchesInsurance = !!r.insuranceId || r.hasHealthInsurance === true;
    } else if (insuranceFilter === "NO" || insuranceFilter === "NO_CARD") {
      matchesInsurance = r.hasHealthInsurance === false || (!r.insuranceId && !r.hasHealthInsurance);
    } else if (insuranceFilter === "NOT_UPDATED") {
      matchesInsurance = !r.insuranceId;
    }

    const matchesWard = wardFilter === "ALL" || (r.wardId || hh?.wardId || "Tổ 1") === wardFilter || (r.permanentAddress || hh?.address || "").includes(wardFilter);
    const matchesVneid = vneidFilter === "ALL" || (r.vneidStatus || VNeIDStatus.NOT_REGISTERED) === vneidFilter;

    return matchesSearch && matchesStatus && matchesEdu && matchesInsurance && matchesWard && matchesVneid;
  });

  // Open Form Add
  const openAddForm = () => {
    setFormMode("add");
    setIsZoomed(false);
    setFormId("");
    setFormOldCmnd("");
    setFormFullName("");
    setFormBirthDate("");
    setFormGender(Gender.MALE);
    setFormRelation("Con");
    setFormPassport("");
    setFormPhone("");
    setFormEmail("");
    setFormStatus(ResidentStatus.PERMANENT);
    setFormVneidStatus(VNeIDStatus.LEVEL_2);
    setFormEthnicity("Kinh");
    setFormReligion("Không");
    setFormNationality("Việt Nam");
    setFormEducation(EducationLevel.HIGH_SCHOOL);
    setFormOccupation("");
    setFormWorkplace("");
    setFormHouseholdId(households[0]?.id || "");
    const initialHh = households[0];
    setFormWardId(initialHh?.wardId || "Tổ 1");
    setFormPermanentAddress("");
    setFormTemporaryAddress("");
    setFormInsuranceId("");
    setFormIsDisabled(false);
    setFormIsPregnant(false);
    setFormIsStudent(false);
    setFormIsEmployed(true);
    setFormLaborSector(LaborSector.SERVICE);
    setFormNotes("");
    setFormGpsLat("");
    setFormGpsLng("");
    setFormPhotoUrl("");
    setFormCustomFields([]);
    setIsScanningGps(false);
    setIsFormOpen(true);
  };

  // Open Form Edit
  const openEditForm = (r: Resident) => {
    setFormMode("edit");
    setIsZoomed(false);
    setFormId(r.id);
    setFormOldCmnd(r.oldCmnd || "");
    setFormFullName(r.fullName);
    setFormBirthDate(r.birthDate);
    setFormGender(r.gender);
    setFormRelation(r.relationToOwner);
    setFormPassport(r.passport || "");
    setFormPhone(r.phone || "");
    setFormEmail(r.email || "");
    setFormStatus(r.status);
    setFormVneidStatus((r.vneidStatus as VNeIDStatus) || VNeIDStatus.NOT_REGISTERED);
    setFormEthnicity(r.ethnicity);
    setFormReligion(r.religion);
    setFormNationality(r.nationality);
    setFormEducation(r.education);
    setFormOccupation(r.occupation);
    setFormWorkplace(r.workplace || "");
    setFormHouseholdId(r.householdId);
    const hh = households.find(h => h.id === r.householdId);
    setFormWardId(r.wardId || (hh ? hh.wardId : "Tổ 1"));
    setFormPermanentAddress(r.permanentAddress || "");
    setFormTemporaryAddress(r.temporaryAddress || "");
    setFormInsuranceId(r.insuranceId || "");
    setFormIsDisabled(!!r.isDisabled);
    setFormIsPregnant(!!r.isPregnant);
    setFormIsStudent(!!r.isStudent);
    setFormStudentType(r.studentType || "THPT");
    setFormIsEmployed(r.isEmployed);
    setFormLaborSector(r.laborSector);
    setFormNotes(r.notes || "");
    setFormGpsLat(r.gpsLat !== undefined ? String(r.gpsLat) : "");
    setFormGpsLng(r.gpsLng !== undefined ? String(r.gpsLng) : "");
    setFormPhotoUrl(r.photoUrl || "");
    if (r.customFields) {
      setFormCustomFields(Object.entries(r.customFields).map(([key, value]) => ({ key, value })));
    } else {
      setFormCustomFields([]);
    }
    setIsScanningGps(false);
    setIsFormOpen(true);
  };

  const handleScanGps = () => {
    setIsScanningGps(true);
    getCurrentGpsLocation(
      (coords) => {
        setFormGpsLat(String(coords.lat));
        setFormGpsLng(String(coords.lng));
        setIsScanningGps(false);
      },
      (errorMsg) => {
        setIsScanningGps(false);
        alert(errorMsg);
      }
    );
  };

  // Handle Scene Photo upload with client-side Data URL FileReader & Compression
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
              setFormPhotoUrl(dataUrl);
            } else {
              setFormPhotoUrl(reader.result as string);
            }
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Camera Simulation
  const handleSimulateCamera = () => {
    setSimulatingCamera(true);
    setTimeout(() => {
      // Simulated picture URL of Vietnamese standard resident profile photo / field photo
      setFormPhotoUrl("https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80");
      setSimulatingCamera(false);
    }, 1000);
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formId.trim() || !formBirthDate) {
      alert("Họ tên, Số định danh/CCCD và Ngày sinh bắt buộc phải điền đầy đủ!");
      return;
    }

    // Determine age of registration for automatic elderly check
    const age = new Date().getFullYear() - new Date(formBirthDate).getFullYear();

    const customFieldsObj: Record<string, string> = {};
    formCustomFields.forEach(field => {
      if (field.key.trim()) {
        customFieldsObj[field.key.trim()] = field.value;
      }
    });

    const residentData: Resident = {
      id: formId,
      oldCmnd: formOldCmnd.trim() || undefined,
      fullName: formFullName,
      birthDate: formBirthDate,
      gender: formGender,
      relationToOwner: formRelation,
      nationalId: formId,
      passport: formPassport || undefined,
      phone: formPhone || undefined,
      email: formEmail || undefined,
      status: formStatus,
      vneidStatus: formVneidStatus,
      ethnicity: formEthnicity,
      religion: formReligion,
      nationality: formNationality,
      education: formEducation,
      occupation: formOccupation,
      workplace: formWorkplace || undefined,
      householdId: formHouseholdId,
      wardId: formWardId,
      permanentAddress: formPermanentAddress || undefined,
      temporaryAddress: formStatus === ResidentStatus.TEMPORARY_STAY ? (formTemporaryAddress || undefined) : undefined,
      insuranceId: formInsuranceId.trim() || undefined,
      hasHealthInsurance: !!formInsuranceId.trim(),
      isElderly: age >= 60,
      isDisabled: formIsDisabled || undefined,
      isPregnant: formIsPregnant || undefined,
      isStudent: formIsStudent || undefined,
      studentType: formIsStudent ? formStudentType : undefined,
      isEmployed: formIsEmployed,
      laborSector: formIsEmployed ? formLaborSector : LaborSector.UNEMPLOYED,
      notes: formNotes || undefined,
      gpsLat: formGpsLat ? parseFloat(formGpsLat) : undefined,
      gpsLng: formGpsLng ? parseFloat(formGpsLng) : undefined,
      photoUrl: formPhotoUrl || undefined,
      customFields: customFieldsObj
    };

    if (formMode === "add") {
      onAddResident(residentData);
    } else {
      onUpdateResident(residentData);
    }
    setIsFormOpen(false);
  };

  // CCCD Chip QR Code Simulation
  const handleSimulateScan = (presetIndex: number) => {
    setScanningInProgress(true);
    setTimeout(() => {
      // Sample database of Vietnamese CCCD Chip QR Code structures
      const presets = [
        {
          cccd: "030095009483",
          name: "Vũ Hoàng Minh",
          dob: "1995-12-14",
          gender: Gender.MALE,
          address: "Số 44, Đường Lê Lợi, Tổ 5",
          phone: "0901234567"
        },
        {
          cccd: "030089021948",
          name: "Phạm Thùy Linh",
          dob: "1989-04-20",
          gender: Gender.FEMALE,
          address: "Hẻm 112/12, Điện Biên Phủ, Tổ 6",
          phone: "0988112233"
        }
      ];

      const selected = presets[presetIndex];
      setFormId(selected.cccd);
      setFormFullName(selected.name);
      setFormBirthDate(selected.dob);
      setFormGender(selected.gender);
      setFormPhone(selected.phone);
      setFormOccupation("Nhân viên Văn phòng");
      setFormWorkplace("Techcombank Sài Gòn");
      setFormStatus(ResidentStatus.PERMANENT);
      setFormPermanentAddress(selected.address);
      setFormTemporaryAddress(selected.address);
      
      setScanningInProgress(false);
      setIsScannerOpen(false);
    }, 1500);
  };

  const handleCccdScanSuccess = (data: {
    cccd: string;
    oldCmnd?: string;
    fullName: string;
    birthDate: string;
    gender: string;
    address: string;
  }) => {
    setFormId(data.cccd);
    setFormOldCmnd(data.oldCmnd || "");
    setFormFullName(data.fullName);
    setFormBirthDate(data.birthDate);
    
    if (data.gender === "Nam") {
      setFormGender(Gender.MALE);
    } else if (data.gender === "Nữ") {
      setFormGender(Gender.FEMALE);
    } else {
      setFormGender(Gender.OTHER);
    }
    
    setFormPermanentAddress(data.address);
    setFormTemporaryAddress(data.address);
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;

    // Extract any unique custom fields from the active residents
    const customKeys = new Set<string>();
    filteredResidents.forEach(r => {
      if (r.customFields) {
        Object.keys(r.customFields).forEach(k => customKeys.add(k));
      }
    });
    const customKeysArray = Array.from(customKeys);

    const headers = [
      "STT", "Họ tên Nhân khẩu", "Số CCCD", "Định Danh VNeID", "CMND cũ", "Ngày sinh", "Tuổi", "Giới tính",
      "Quan hệ với Chủ hộ", "Họ tên Chủ Hộ", "Số ĐT liên hệ", "Tổ dân phố", "Cư trú", "Địa chỉ Thường Trú", "Tạm Trú",
      "BHYT", "Trợ cấp xã hội", "Học vấn", "Nghề nghiệp", "Mã Hộ Gia Đình", "Tọa độ GPS GIS Hộ",
      ...customKeysArray
    ];
    const rows = filteredResidents.map((r, idx) => {
      const linkedHh = households.find(h => h.id === r.householdId);
      const ownerName = linkedHh ? linkedHh.ownerName : (r.relationToOwner === "Chủ hộ" ? r.fullName : "Chưa gắn");
      const phone = r.phone || linkedHh?.phone || "Chưa cập nhật";
      const gpsCoords = (linkedHh?.gpsLat !== undefined && linkedHh?.gpsLng !== undefined) 
        ? `${linkedHh.gpsLat}, ${linkedHh.gpsLng}` 
        : "Chưa định vị GIS";
      const bhytText = r.insuranceId ? `Đã có BHYT (${r.insuranceId})` : (r.hasHealthInsurance ? "Có BHYT" : "Chưa có BHYT");
      const subsidyText = r.subsidyType ? `${r.subsidyType} (${r.subsidyAmount || ""} đ/tháng)` : "Không";
      const customValues = customKeysArray.map(k => (r.customFields?.[k] || ""));

      return [
        idx + 1,
        r.fullName,
        r.id,
        r.vneidStatus || "Chưa đăng ký",
        r.oldCmnd || "",
        r.birthDate,
        getAge(r.birthDate),
        r.gender,
        r.relationToOwner,
        ownerName,
        phone,
        r.wardId || linkedHh?.wardId || "",
        r.status,
        r.permanentAddress || linkedHh?.address || "",
        r.temporaryAddress || "",
        bhytText,
        subsidyText,
        r.education,
        r.occupation || "N/A",
        r.householdId || "",
        gpsCoords,
        ...customValues
      ];
    });
    onExport(type, "Danh sách Nhân khẩu", headers, rows);
  };

  return (
    <div id="resident-view-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Quản lý dữ liệu nhân khẩu
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu lý lịch công dân, thông tin học vấn, việc làm, và chính sách BHYT
          </p>
        </div>

        {/* Action buttons (Export, Scan, Create) */}
        <div className="flex flex-wrap items-center gap-2">
          {onExport && canUserPerformAction(currentUser, "export") && (
            <>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                title="Xuất bảng dữ liệu nhân khẩu hiện tại sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                title="Xuất bản in báo cáo PDF của các nhân khẩu"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF (In)
              </button>
            </>
          )}

          {canUserPerformAction(currentUser, "add") && (
            <>
              <button
                onClick={openAddForm}
                className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Thêm nhân khẩu mới
              </button>
            </>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo họ tên, số CCCD, điện thoại, hoặc số hộ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600 focus:bg-white"
            />
          </div>

          {/* View Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Dạng Bảng</span>
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "card"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Dạng Thẻ (Mobile)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tổ dân phố / Khu vực</label>
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold focus:outline-emerald-600"
            >
              <option value="ALL">-- Tất cả các Tổ --</option>
              {availableWards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cư trú</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-emerald-600"
            >
              <option value="ALL">Tất cả trạng thái cư trú</option>
              <option value={ResidentStatus.PERMANENT}>Thường trú</option>
              <option value={ResidentStatus.TEMPORARY_STAY}>Tạm trú</option>
              <option value={ResidentStatus.TEMPORARY_ABSENT}>Tạm vắng</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Định Danh VNeID</label>
            <select
              value={vneidFilter}
              onChange={(e) => setVneidFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold focus:outline-emerald-600"
            >
              <option value="ALL">Tất cả định danh VNeID</option>
              <option value={VNeIDStatus.LEVEL_2}>🪪 Mức 2</option>
              <option value={VNeIDStatus.LEVEL_1}>🪪 Mức 1</option>
              <option value={VNeIDStatus.NOT_REGISTERED}>⚠️ Chưa đăng ký</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Học vấn</label>
            <select
              value={eduFilter}
              onChange={(e) => setEduFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-emerald-600"
            >
              <option value="ALL">Tất cả trình độ học vấn</option>
              <option value={EducationLevel.UNIVERSITY}>Đại học</option>
              <option value={EducationLevel.HIGH_SCHOOL}>THPT</option>
              <option value={EducationLevel.SECONDARY}>THCS</option>
              <option value={EducationLevel.PRIMARY}>Tiểu học</option>
              <option value={EducationLevel.NONE}>Chưa qua đào tạo</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Thẻ Bảo hiểm Y tế</label>
            <select
              value={insuranceFilter}
              onChange={(e) => setInsuranceFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-emerald-600"
            >
              <option value="ALL">Tất cả tình trạng BHYT</option>
              <option value="YES">Đã có BHYT</option>
              <option value="NO">Chưa có BHYT (Chưa có)</option>
              <option value="NOT_UPDATED">Chưa cập nhật mã BHYT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dual Layout View: High-Fidelity Table vs Mobile-Optimized Card Grid */}
      {viewMode === "table" ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-center">STT</th>
                  <th className="px-4 py-3">Mã Hộ</th>
                  <th className="px-4 py-3">Họ và Tên</th>
                  <th className="px-4 py-3">QH Chủ Hộ</th>
                  <th className="px-4 py-3 text-center">Giới Tính</th>
                  <th className="px-4 py-3">Ngày Sinh</th>
                  <th className="px-4 py-3 text-center">Tuổi</th>
                  <th className="px-4 py-3">Số CCCD</th>
                  <th className="px-4 py-3">Số CMND cũ</th>
                  <th className="px-4 py-3">Cư Trú</th>
                  <th className="px-4 py-3 text-center">Định Danh VNeID</th>
                  <th className="px-4 py-3">Tổ dân phố</th>
                  <th className="px-4 py-3">ĐC Thường Trú</th>
                  <th className="px-4 py-3">ĐC Tạm Trú</th>
                  <th className="px-4 py-3">Nghề Nghiệp</th>
                  <th className="px-4 py-3">Điện Thoại</th>
                  <th className="px-4 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredResidents.map((r, idx) => {
                  const hh = households.find(h => h.id === r.householdId);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono text-[9px] font-bold">
                          {r.householdId || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{r.fullName}</span>
                          <ResidentStatusBadge resident={r} changes={changes} />
                        </div>
                        {/* Priority tag */}
                        {r.isDisabled && (
                          <span className="ml-1 bg-rose-50 text-rose-600 px-1.5 py-0.2 rounded text-[8px] font-bold">KT</span>
                        )}
                        {r.isElderly && (
                          <span className="ml-1 bg-amber-50 text-amber-600 px-1.5 py-0.2 rounded text-[8px] font-bold">NCT</span>
                        )}
                        {r.gpsLat !== undefined && r.gpsLng !== undefined && (
                          <span className="ml-1 bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded text-[8px] font-bold" title={`Tọa độ: ${r.gpsLat}, ${r.gpsLng}`}>GPS</span>
                        )}
                        {r.photoUrl && (
                          <span className="ml-1 bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded text-[8px] font-bold" title="Có ảnh hiện trường">Ảnh</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium">{r.relationToOwner}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.gender === Gender.MALE 
                            ? "bg-blue-50 text-blue-600" 
                            : "bg-pink-50 text-pink-600"
                        }`}>
                          {r.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{formatDate(r.birthDate)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700 font-mono">{getAge(r.birthDate)}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{r.id}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{r.oldCmnd || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.status === ResidentStatus.PERMANENT 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                            : "bg-amber-50 text-amber-700 border border-amber-150"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          (r.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_2
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : (r.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_1
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {(r.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_2 && "🪪 Mức 2"}
                          {(r.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_1 && "🪪 Mức 1"}
                          {(r.vneidStatus || "Chưa đăng ký") !== VNeIDStatus.LEVEL_2 && (r.vneidStatus || "Chưa đăng ký") !== VNeIDStatus.LEVEL_1 && "⚠️ Chưa ĐK"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700 font-mono">
                        {r.wardId || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={r.permanentAddress || "Chưa cập nhật"}>
                        {r.permanentAddress || "Chưa cập nhật"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={r.temporaryAddress || "Chưa cập nhật"}>
                        {r.temporaryAddress || "Chưa cập nhật"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate" title={r.occupation}>
                        {r.occupation || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{r.phone || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openGisMapForResident(r)}
                            className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Xem bản đồ GIS vị trí nhân khẩu"
                          >
                            <MapPin className="w-4 h-4 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => setSelectedResident(r)}
                            className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Lý lịch chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canUserPerformAction(currentUser, "edit") && (
                            <button
                              onClick={() => openEditForm(r)}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Sửa thông tin"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canUserPerformAction(currentUser, "delete") && (
                            <button
                              onClick={() => {
                                setResidentToDelete({ id: r.id, fullName: r.fullName });
                                setDeleteModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Xoá bản ghi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredResidents.length === 0 && (
                  <tr>
                    <td colSpan={16} className="p-8 text-center text-slate-400">
                      Không tìm thấy dữ liệu nhân khẩu trùng khớp với điều kiện lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Mobile-Optimized Card Grid with minimum touch target size of 44px */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidents.map((r, idx) => {
            const hh = households.find(h => h.id === r.householdId);
            return (
              <div 
                key={r.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                {/* Visual side indicator for residency status */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  r.status === ResidentStatus.PERMANENT 
                    ? "bg-emerald-500" 
                    : "bg-amber-500"
                }`}></div>

                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                      STT: {idx + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      r.status === ResidentStatus.PERMANENT 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                        : "bg-amber-50 text-amber-700 border-amber-150"
                    }`}>
                      {r.status}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800">{r.fullName}</h3>
                    <ResidentStatusBadge resident={r} changes={changes} />
                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${
                      r.gender === Gender.MALE 
                        ? "bg-blue-50 text-blue-600" 
                        : "bg-pink-50 text-pink-600"
                    }`}>
                      {r.gender}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono text-[9px] font-bold">
                      Hộ: {r.householdId || "N/A"}
                    </span>
                    <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-[9px] font-semibold">
                      {r.relationToOwner}
                    </span>
                    {r.isElderly && (
                      <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-bold">NCT</span>
                    )}
                    {r.isDisabled && (
                      <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-bold">KT</span>
                    )}
                    {r.gpsLat !== undefined && r.gpsLng !== undefined && (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold">GPS</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Số CCCD</span>
                      <span className="font-mono text-slate-700 font-semibold">{r.id}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Số CMND cũ</span>
                      <span className="font-mono text-slate-700 font-semibold">{r.oldCmnd || "-"}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Ngày sinh (Tuổi)</span>
                      <span className="text-slate-700 font-medium">{formatDate(r.birthDate)} ({getAge(r.birthDate)} tuổi)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Điện thoại</span>
                      <span className="text-slate-700 font-mono font-medium">{r.phone || "-"}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Tổ dân phố</span>
                      <span className="text-slate-700 font-medium">{r.wardId || "-"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Thường trú</span>
                    <p className="text-slate-700 text-xs truncate" title={r.permanentAddress || "Chưa cập nhật"}>
                      {r.permanentAddress || "Chưa cập nhật"}
                    </p>
                  </div>

                  {/* Vị trí Bản đồ GIS khoanh đỏ theo hình đính kèm */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const { lat, lng } = getResidentGisCoords(r);
                        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
                        window.open(mapsUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer w-fit"
                      title="Mở Google Maps chỉ đường đến vị trí thực địa"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Bản đồ GIS: {getResidentGisCoords(r).lat.toFixed(4)}, {getResidentGisCoords(r).lng.toFixed(4)}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Card Action Buttons with 44px min-height */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => setSelectedResident(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px]"
                  >
                    <Eye className="w-4 h-4 text-emerald-600" />
                    Xem hồ sơ
                  </button>

                  {canUserPerformAction(currentUser, "edit") && (
                    <button
                      onClick={() => openEditForm(r)}
                      className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Sửa thông tin"
                    >
                      <Edit className="w-4.5 h-4.5" />
                    </button>
                  )}

                  {canUserPerformAction(currentUser, "delete") && (
                    <button
                      onClick={() => {
                        setResidentToDelete({ id: r.id, fullName: r.fullName });
                        setDeleteModalOpen(true);
                      }}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Xoá bản ghi"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredResidents.length === 0 && (
            <div className="col-span-full p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm">
              Không tìm thấy dữ liệu nhân khẩu trùng khớp với điều kiện lọc.
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL CARD */}
      {selectedResident && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className={`bg-white rounded-2xl w-full overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ${
            isDetailZoomed ? "max-w-4xl h-[90vh] md:h-[94vh]" : "max-w-xl max-h-[85vh]"
          }`}>
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">HỒ SƠ CÁ NHÂN: {selectedResident.fullName}</h3>
                    <ResidentStatusBadge resident={selectedResident} changes={changes} />
                  </div>
                  <p className="text-xs text-emerald-200 flex items-center gap-2">
                    <span>Mã định danh/CCCD: {selectedResident.id}</span>
                    <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold text-white">
                      {selectedResident.wardId || (households.find(h => h.id === selectedResident.householdId)?.wardId) || "Tổ 1"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openGisMapForResident(selectedResident)}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Xem vị trí thực địa trên Bản đồ GIS"
                >
                  <MapPin className="w-4 h-4 text-white" />
                  <span>
                    Bản đồ GIS: {getResidentGisCoords(selectedResident).lat.toFixed(4)}, {getResidentGisCoords(selectedResident).lng.toFixed(4)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailZoomed(!isDetailZoomed)}
                  className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
                  title={isDetailZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isDetailZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button onClick={() => setSelectedResident(null)} className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Họ và tên</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedResident.fullName}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Ngày sinh</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{formatDate(selectedResident.birthDate)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Giới tính</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.gender}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Số CCCD / CMND</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1 font-mono">{selectedResident.id}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Số CMND cũ</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1 font-mono">{selectedResident.oldCmnd || "Chưa cập nhật"}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Định danh VNeID</p>
                  <p className="mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 ${
                      (selectedResident.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_2
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : (selectedResident.vneidStatus || "Chưa đăng ký") === VNeIDStatus.LEVEL_1
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      🪪 {selectedResident.vneidStatus || "Chưa đăng ký"}
                    </span>
                  </p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Số điện thoại</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.phone || "Không có"}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Email</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.email || "Không có"}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Dân tộc - Tôn giáo</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.ethnicity} • {selectedResident.religion}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Quan hệ với chủ hộ</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.relationToOwner}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Địa chỉ thường trú</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.permanentAddress || "Chưa cập nhật"}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Địa chỉ tạm trú</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.temporaryAddress || "Chưa cập nhật"}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Education & Employment Details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-slate-700 flex items-center gap-1 mb-2">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" /> Trình độ học vấn
                  </h4>
                  <p className="font-semibold text-slate-800">{selectedResident.education}</p>
                  {selectedResident.isStudent && (
                    <p className="text-slate-500 mt-0.5">Phân loại: Học sinh {selectedResident.studentType}</p>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 flex items-center gap-1 mb-2">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> Lao động nghề nghiệp
                  </h4>
                  <p className="font-semibold text-slate-800">{selectedResident.occupation || "Không rõ"}</p>
                  {selectedResident.isEmployed && (
                    <p className="text-slate-500 mt-0.5">Lĩnh vực: {selectedResident.laborSector}</p>
                  )}
                </div>
              </div>

              {/* Health insurance */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                <h4 className="font-bold text-emerald-800 flex items-center gap-1 mb-2">
                  <Heart className="w-3.5 h-3.5 text-emerald-700" /> Chế độ y tế & An sinh xã hội
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-slate-700">Thẻ Bảo hiểm Y tế (BHYT):</p>
                    <p className="font-mono font-bold text-emerald-700 mt-0.5">{selectedResident.insuranceId || "Chưa cập nhật thẻ"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Trợ cấp bảo trợ xã hội:</p>
                    <p className="font-semibold text-purple-700 mt-0.5">{selectedResident.subsidyType || "Không thuộc diện trợ cấp"}</p>
                  </div>
                </div>
              </div>

              {/* Geographic and Survey Field Metadata */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" /> Thông tin khảo sát hiện trường
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Tọa độ địa dư (GPS)</p>
                    {selectedResident.gpsLat !== undefined && selectedResident.gpsLng !== undefined ? (
                      <div className="mt-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px] font-mono font-semibold text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        <span>{selectedResident.gpsLat}, {selectedResident.gpsLng}</span>
                      </div>
                    ) : (
                      <p className="text-slate-500 mt-1 italic text-[11px]">Chưa ghi nhận tọa độ</p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Ảnh hiện trường</p>
                    {selectedResident.photoUrl ? (
                      <div className="mt-1 relative group cursor-pointer border border-slate-200 rounded-lg overflow-hidden bg-slate-100 p-1">
                        <Zoom>
                          <img 
                            src={selectedResident.photoUrl} 
                            alt="Hiện trường" 
                            referrerPolicy="no-referrer"
                            className="w-full max-h-40 object-cover rounded-md shadow-xs hover:opacity-95 transition-opacity" 
                          />
                        </Zoom>
                      </div>
                    ) : (
                      <p className="text-slate-500 mt-1 italic text-[11px]">Không có ảnh chụp thực địa</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Ghi chú thực địa</p>
                  <p className="text-slate-700 mt-1 text-xs leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap font-medium">
                    {selectedResident.notes || "Không có ghi chú đặc biệt"}
                  </p>
                </div>
              </div>

              {/* Trường dữ liệu bổ sung */}
              {selectedResident.customFields && Object.entries(selectedResident.customFields).length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" /> Trường thông tin bổ sung
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                    {Object.entries(selectedResident.customFields).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-400 font-medium">{key}:</span>
                        <b className="text-slate-800 text-right">{val}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lịch sử cập nhật chi tiết */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResidentHistory(!showResidentHistory)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border shadow-2xs ${
                    showResidentHistory
                      ? "bg-amber-600 text-white border-amber-700 hover:bg-amber-700"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  <History className="w-4 h-4" />
                  {showResidentHistory ? "Ẩn lịch sử cập nhật chi tiết" : "Hiện lịch sử cập nhật chi tiết nhân khẩu"}
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${showResidentHistory ? "bg-amber-800 text-amber-100" : "bg-amber-200 text-amber-950"}`}>
                    {getResidentHistoryLogs(selectedResident).length}
                  </span>
                </button>

                {showResidentHistory && (
                  <div className="mt-3 bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 space-y-2.5 text-xs text-amber-950 animate-fade-in shadow-2xs">
                    <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-amber-700" />
                        Nhật ký lưu vết & Lịch sử biến động: <span className="underline">{selectedResident.fullName}</span>
                      </span>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {getResidentHistoryLogs(selectedResident).map((log) => (
                        <div key={log.id} className="bg-white p-2.5 rounded-lg border border-amber-200/90 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1">
                            <span className="font-bold text-slate-800">👤 Cán bộ thực hiện: {log.userName} ({log.userRole})</span>
                            <span className="text-slate-500 font-mono text-[10px]">⏱️ {log.timestamp}</span>
                          </div>
                          <p className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
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

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-150 flex justify-end shrink-0">
              <button onClick={() => setSelectedResident(null)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                Đóng lý lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM DIALOG */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 overflow-y-auto">
          <div className={`bg-white rounded-2xl w-full overflow-hidden shadow-2xl flex flex-col my-8 transition-all duration-300 ${
            isZoomed ? "max-w-4xl h-[90vh] md:h-[94vh]" : "max-w-xl max-h-[90vh]"
          }`}>
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-sm md:text-base">
                {formMode === "add" ? "Khai báo nhập tịch Nhân khẩu mới" : "Sửa đổi lý lịch Nhân khẩu"}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsZoomed(!isZoomed)} 
                  className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
                  title={isZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsFormOpen(false);
                    setIsScannerOpen(false);
                  }} 
                  className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SCANNER OVERLAY INTERFACE */}
            {isScannerOpen && (
              <div className="bg-slate-950 p-6 text-white text-center flex flex-col items-center justify-center relative min-h-[220px] border-b border-slate-800 shrink-0">
                <div className="absolute top-4 right-4">
                  <button 
                    type="button"
                    onClick={() => setIsScannerOpen(false)}
                    className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <QrCode className="w-8 h-8 text-blue-400 animate-pulse mb-2" />
                <h4 className="font-bold text-sm text-blue-300">TRÌNH QUÉT THẺ CĂN CƯỚC CHÍP QUỐC GIA</h4>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                  Sử dụng Camera thiết bị để tự động đọc mã QR trên đỉnh thẻ CCCD của công dân và tự động điền đơn.
                </p>

                {scanningInProgress ? (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
                      <div className="h-full bg-blue-500 absolute top-0 left-0 animate-[shimmer_1.5s_infinite] w-24"></div>
                    </div>
                    <span className="text-[10px] text-blue-400">Đang quét tia hồng ngoại, vui lòng giữ yên...</span>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSimulateScan(0)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-[10px] font-semibold text-slate-300 cursor-pointer"
                    >
                      Giả lập thẻ CCCD: Vũ Hoàng Minh
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateScan(1)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-[10px] font-semibold text-slate-300 cursor-pointer"
                    >
                      Giả lập thẻ CCCD: Phạm Thùy Linh
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-600">
              {formMode === "add" && (
                <div className="bg-emerald-50/90 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Khai báo nhanh bằng Quét QR CCCD</p>
                      <p className="text-[10px] text-emerald-700 font-medium">Tự động điền Họ tên, Số CCCD, Ngày sinh, Giới tính, Địa chỉ từ mã QR.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 shrink-0"
                  >
                    <QrCode className="w-4 h-4" /> Quét QR CCCD
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Họ và Tên khai sinh *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Tấn Bình"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số định danh / CCCD *</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="0300XXXXXXXX"
                    value={formId}
                    disabled={formMode === "edit"}
                    onChange={(e) => {
                      setFormId(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 font-mono disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số CMND cũ</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="123456789"
                    value={formOldCmnd}
                    onChange={(e) => setFormOldCmnd(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày sinh *</label>
                  <input
                    type="date"
                    required
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giới tính</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as Gender)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    <option value={Gender.MALE}>Nam</option>
                    <option value={Gender.FEMALE}>Nữ</option>
                    <option value={Gender.OTHER}>Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">QH với Chủ hộ</label>
                  <input
                    type="text"
                    required
                    placeholder="Con, Vợ, Chồng, Em..."
                    value={formRelation}
                    onChange={(e) => setFormRelation(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thuộc Hộ gia đình liên kết</label>
                  <select
                    value={formHouseholdId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormHouseholdId(val);
                      const hh = households.find(h => h.id === val);
                      if (hh) {
                        setFormWardId(hh.wardId || "Tổ 1");
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    {households.map(h => (
                      <option key={h.id} value={h.id}>Hộ {h.id} - {h.ownerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tổ dân phố *</label>
                  <select
                    value={formWardId}
                    onChange={(e) => setFormWardId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-emerald-50 border-emerald-300 font-semibold focus:outline-emerald-600"
                  >
                    {Array.from({ length: 50 }, (_, i) => `Tổ ${i + 1}`).map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái cư trú</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ResidentStatus)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
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
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-emerald-600 font-medium"
                  >
                    <option value={VNeIDStatus.LEVEL_2}>🪪 Mức 2</option>
                    <option value={VNeIDStatus.LEVEL_1}>🪪 Mức 1</option>
                    <option value={VNeIDStatus.NOT_REGISTERED}>⚠️ Chưa đăng ký</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={(formStatus === ResidentStatus.TEMPORARY_STAY || formStatus === ResidentStatus.TEMPORARY_ABSENT) ? "" : "md:col-span-2"}>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ thường trú</label>
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ thường trú..."
                    value={formPermanentAddress}
                    onChange={(e) => setFormPermanentAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                {(formStatus === ResidentStatus.TEMPORARY_STAY || formStatus === ResidentStatus.TEMPORARY_ABSENT) && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Địa chỉ tạm trú *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập địa chỉ tạm trú thực tế..."
                      value={formTemporaryAddress}
                      onChange={(e) => setFormTemporaryAddress(e.target.value)}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs text-amber-950 focus:outline-amber-600 bg-amber-50 font-medium"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dân tộc</label>
                  <input
                    type="text"
                    value={formEthnicity}
                    onChange={(e) => setFormEthnicity(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tôn giáo</label>
                  <input
                    type="text"
                    value={formReligion}
                    onChange={(e) => setFormReligion(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Education & Job Details */}
              <div className="border border-slate-150 p-4 rounded-xl space-y-3">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">Học vấn & Nghề nghiệp</label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9.5px] font-medium text-slate-500">Trình độ cao nhất</label>
                    <select
                      value={formEducation}
                      onChange={(e) => setFormEducation(e.target.value as EducationLevel)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white mt-1"
                    >
                      <option value={EducationLevel.NONE}>Chưa học xong phổ thông</option>
                      <option value={EducationLevel.PRIMARY}>Tiểu học</option>
                      <option value={EducationLevel.SECONDARY}>THCS</option>
                      <option value={EducationLevel.HIGH_SCHOOL}>THPT</option>
                      <option value={EducationLevel.VOCATIONAL}>Trung cấp / Nghề</option>
                      <option value={EducationLevel.COLLEGE}>Cao đẳng</option>
                      <option value={EducationLevel.UNIVERSITY}>Đại học</option>
                      <option value={EducationLevel.POSTGRADUATE}>Sau đại học</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-medium text-slate-500">Công việc hiện tại</label>
                    <input
                      type="text"
                      placeholder="Lập trình viên, Giáo viên, buôn bán..."
                      value={formOccupation}
                      onChange={(e) => setFormOccupation(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsStudent}
                      onChange={(e) => setFormIsStudent(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    Là Học sinh / Sinh viên
                  </label>

                  {formIsStudent && (
                    <select
                      value={formStudentType}
                      onChange={(e) => setFormStudentType(e.target.value as any)}
                      className="px-3 py-1 border border-slate-200 rounded text-xs text-slate-800 bg-white"
                    >
                      <option value="Mầm non">Trẻ mầm non</option>
                      <option value="Tiểu học">Cấp tiểu học</option>
                      <option value="THCS">Cấp THCS</option>
                      <option value="THPT">Cấp THPT</option>
                      <option value="Sinh viên">Đang học Đại học/Cao đẳng</option>
                    </select>
                  )}
                </div>
              </div>

              {/* BHYT & Vulnerable categories */}
              <div className="border border-slate-150 p-4 rounded-xl space-y-3">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">BHYT & Đối tượng xã hội</label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9.5px] font-medium text-slate-500">Mã thẻ BHYT (nếu có)</label>
                    <input
                      type="text"
                      placeholder="GDXXXXXXXX"
                      value={formInsuranceId}
                      onChange={(e) => setFormInsuranceId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono mt-1"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 justify-center">
                    <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsDisabled}
                        onChange={(e) => setFormIsDisabled(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      Người khuyết tật
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPregnant}
                        onChange={(e) => setFormIsPregnant(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      Phụ nữ mang thai
                    </label>
                  </div>
                </div>
              </div>

              {/* Geographic, Photo & Notes Metadata */}
              <div className="border border-slate-150 p-4 rounded-xl space-y-4">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                  Thông tin thực địa, GPS & Khảo sát hiện trường
                </label>

                {/* Ghi chú */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Ghi chú thêm</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Nhập thông tin ghi chú đặc biệt về nhân khẩu này (ví dụ: hoàn cảnh đặc biệt, đang đi học xa, bệnh hiểm nghèo...)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    rows={2}
                  />
                </div>

                {/* Trường dữ liệu bổ sung tự thêm/xoá */}
                <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50/50">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 uppercase">Trường thông tin bổ sung</label>
                    <button
                      type="button"
                      onClick={() => setFormCustomFields([...formCustomFields, { key: "", value: "" }])}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Thêm trường mới
                    </button>
                  </div>
                  
                  {formCustomFields.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Chưa có trường thông tin bổ sung nào. Nhấp "Thêm trường mới" để bổ sung.</p>
                  ) : (
                    <div className="space-y-2">
                      {formCustomFields.map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            required
                            placeholder="Tên trường (VD: Nơi sinh)"
                            value={field.key}
                            onChange={(e) => {
                              const updated = [...formCustomFields];
                              updated[idx].key = e.target.value;
                              setFormCustomFields(updated);
                            }}
                            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-emerald-600"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Giá trị (VD: Hà Nội)"
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...formCustomFields];
                              updated[idx].value = e.target.value;
                              setFormCustomFields(updated);
                            }}
                            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-emerald-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formCustomFields.filter((_, i) => i !== idx);
                              setFormCustomFields(updated);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Xóa trường này"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tọa độ GPS & Ảnh hiện trường thực tế từ chủ hộ / hộ gia đình liên kết */}
                {(() => {
                  const linkedHousehold = households.find(h => h.id === formHouseholdId) || households[0];
                  const displayLat = formGpsLat || linkedHousehold?.gpsLat || "11.367716";
                  const displayLng = formGpsLng || linkedHousehold?.gpsLng || "106.136728";
                  const displayPhoto = formPhotoUrl || linkedHousehold?.photoUrl;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* CARD TỌA ĐỘ GPS & NÚT ẨN HIỆN LẤY TỌA ĐỘ */}
                      <div className="border border-sky-200 bg-sky-50/50 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-sky-900 uppercase tracking-wider block">
                              Tọa độ GPS (Chủ hộ / Nhà ở)
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowGpsControls(!showGpsControls)}
                              className="text-[10px] font-extrabold text-sky-700 hover:text-sky-900 bg-sky-100 hover:bg-sky-200 px-2 py-0.5 rounded-md border border-sky-300 transition-colors cursor-pointer"
                            >
                              {showGpsControls ? "Ẩn lấy tọa độ" : "Hiện lấy tọa độ"}
                            </button>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-800 block mt-1.5 bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs">
                            📍 {displayLat}, {displayLng}
                          </span>
                        </div>

                        {showGpsControls && (
                          <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                            <button
                              type="button"
                              onClick={() => setIsMapsPickerOpen(true)}
                              className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" /> Chọn bản đồ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                getCurrentGpsLocation(
                                  (coords) => {
                                    setFormGpsLat(String(coords.lat));
                                    setFormGpsLng(String(coords.lng));
                                  },
                                  (err) => alert(err)
                                );
                              }}
                              className="py-1.5 px-3 bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-900 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Vị trí hiện tại
                            </button>
                          </div>
                        )}
                      </div>

                      {/* CARD ẢNH HIỆN TRƯỜNG NHÀ Ở CỦA CHỦ HỘ */}
                      <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                            Ảnh hiện trường / Nhà ở (Đồng bộ từ chủ hộ)
                          </span>
                          {displayPhoto ? (
                            <div className="mt-1.5 flex items-center gap-3 bg-white p-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                              <img
                                src={displayPhoto}
                                alt="Ảnh hiện trường"
                                className="w-14 h-12 object-cover rounded-lg border border-emerald-100 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-emerald-900 block truncate">
                                  Hộ {linkedHousehold?.id || formHouseholdId}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  Chủ hộ: {linkedHousehold?.ownerName || "Đã đồng bộ"}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-500 block mt-1">Chưa cập nhật hình ảnh</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsCameraModalOpen(true)}
                            className="flex-1 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <Camera className="w-3.5 h-3.5" /> Chụp ảnh mới
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setIsScannerOpen(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-semibold"
                >
                  Đăng ký cư dân
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(dataUrl) => setFormPhotoUrl(dataUrl)}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen && residentToDelete !== null}
        title={`Xoá thông tin nhân khẩu: ${residentToDelete?.fullName}`}
        description={`Bạn có chắc chắn muốn xoá vĩnh viễn cư dân này khỏi hệ thống? Lưu ý: Hành động này không thể khôi phục.`}
        confirmWord={residentToDelete?.fullName || "XOÁ"}
        placeholder={`Nhập tên cư dân '${residentToDelete?.fullName}' để xác nhận`}
        onConfirm={() => {
          if (residentToDelete) {
            onDeleteResident(residentToDelete.id);
          }
          setDeleteModalOpen(false);
          setResidentToDelete(null);
        }}
        onCancel={() => {
          setDeleteModalOpen(false);
          setResidentToDelete(null);
        }}
      />

      <CccdQrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleCccdScanSuccess}
      />

      <MapPickerModal
        isOpen={isMapsPickerOpen}
        initialLat={formGpsLat}
        initialLng={formGpsLng}
        onClose={() => setIsMapsPickerOpen(false)}
        onSelect={({ lat, lng }) => {
          setFormGpsLat(String(lat));
          setFormGpsLng(String(lng));
          setIsMapsPickerOpen(false);
        }}
      />

      {gisModalResident && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-slate-900/90 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    Vị Trí Bản Đồ GIS Thực Địa: Nhân Khẩu {gisModalResident.resident.fullName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    CCCD/Mã: {gisModalResident.resident.id} • Mã hộ: {gisModalResident.resident.householdId || "N/A"} • Thường trú: {gisModalResident.resident.permanentAddress || gisModalResident.household?.address || "Chưa cập nhật"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGisModalResident(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-900">
              <GoogleGISMap
                households={households}
                selectedHouse={gisModalResident.household || null}
                center={[gisModalResident.lat, gisModalResident.lng]}
                viewZoom={16}
                focusResident={{
                  fullName: gisModalResident.resident.fullName,
                  id: gisModalResident.resident.id,
                  relationToOwner: gisModalResident.resident.relationToOwner,
                  phone: gisModalResident.resident.phone,
                  permanentAddress: gisModalResident.resident.permanentAddress || gisModalResident.household?.address,
                  lat: gisModalResident.lat,
                  lng: gisModalResident.lng
                }}
              />
            </div>

            {/* Footer details */}
            <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
              <div className="flex items-center gap-4">
                <span>Nhân khẩu: <strong className="text-white">{gisModalResident.resident.fullName}</strong></span>
                <span>Quan hệ chủ hộ: <strong className="text-emerald-400">{gisModalResident.resident.relationToOwner}</strong></span>
                <span>SĐT: <strong className="text-sky-400">{gisModalResident.resident.phone || "Chưa có SĐT"}</strong></span>
                <span>Tọa độ GPS: <strong className="text-slate-300">{gisModalResident.lat.toFixed(6)}, {gisModalResident.lng.toFixed(6)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps?q=${gisModalResident.lat},${gisModalResident.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Mở Google Maps</span>
                </a>
                <button
                  type="button"
                  onClick={() => setGisModalResident(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
