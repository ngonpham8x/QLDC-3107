/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FileText, Plus, Search, Calendar, Eye, X, 
  Baby, MapPin, Skull, LogIn, LogOut, CheckCircle, Clock, Download, Printer, Users,
  GraduationCap, Briefcase, Heart, Table, Maximize2, Minimize2, QrCode
} from "lucide-react";
import { CccdQrScannerModal } from "./CccdQrScannerModal";
import { 
  DemographicsChange, DemographicsChangeType, Resident, User, UserRole,
  Gender, ResidentStatus, EducationLevel, LaborSector, Household, canUserPerformAction 
} from "../types";

interface DemographicsChangeViewProps {
  changes: DemographicsChange[];
  residents: Resident[];
  households: Household[];
  currentUser: User | null;
  onAddChange: (change: Omit<DemographicsChange, "id">) => void;
  onAddResident: (resident: Resident) => void;
  onUpdateResident: (resident: Resident) => void;
  onUpdateHousehold: (household: Household) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
}

export default function DemographicsChangeView({
  changes, residents, households, currentUser, onAddChange, onAddResident, onUpdateResident, onUpdateHousehold, onExport
}: DemographicsChangeViewProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [missingResidentName, setMissingResidentName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "table" | "cards">("timeline");

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getAge = (birthDateStr?: string) => {
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

  const handleViewResident = (residentId: string, name: string) => {
    const found = residents.find(r => r.id === residentId);
    if (found) {
      setSelectedResident(found);
      setMissingResidentName(null);
    } else {
      setSelectedResident(null);
      setMissingResidentName(name);
    }
  };
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form Fields
  const [formResidentId, setFormResidentId] = useState("");
  const [formType, setFormType] = useState<DemographicsChangeType>(DemographicsChangeType.NEWBORN);
  const [formDate, setFormDate] = useState("");
  const [formDetails, setFormDetails] = useState("");

  // New resident form states
  const [newResidentName, setNewResidentName] = useState("");
  const [newResidentCccd, setNewResidentCccd] = useState("");
  const [newResidentCccdIssuedDate, setNewResidentCccdIssuedDate] = useState("");
  const [newResidentBirthDate, setNewResidentBirthDate] = useState("");
  const [newResidentGender, setNewResidentGender] = useState<Gender>(Gender.MALE);
  const [newResidentRelation, setNewResidentRelation] = useState("Con");
  const [newResidentPhone, setNewResidentPhone] = useState("");
  const [newResidentEmail, setNewResidentEmail] = useState("");
  const [newResidentEthnicity, setNewResidentEthnicity] = useState("Kinh");
  const [newResidentReligion, setNewResidentReligion] = useState("Không");
  const [newResidentNationality, setNewResidentNationality] = useState("Việt Nam");
  const [newResidentEducation, setNewResidentEducation] = useState<EducationLevel>(EducationLevel.NONE);
  const [newResidentOccupation, setNewResidentOccupation] = useState("Trẻ em");
  const [newResidentWorkplace, setNewResidentWorkplace] = useState("");
  const [newResidentPermanentAddress, setNewResidentPermanentAddress] = useState("");
  const [newResidentTemporaryAddress, setNewResidentTemporaryAddress] = useState("");
  const [newResidentInsuranceId, setNewResidentInsuranceId] = useState("");
  const [newResidentIsElderly, setNewResidentIsElderly] = useState(false);
  const [newResidentIsDisabled, setNewResidentIsDisabled] = useState(false);
  const [newResidentIsPregnant, setNewResidentIsPregnant] = useState(false);
  const [newResidentIsOrphan, setNewResidentIsOrphan] = useState(false);
  const [newResidentIsStudent, setNewResidentIsStudent] = useState(false);
  const [newResidentStudentType, setNewResidentStudentType] = useState<"Mầm non" | "Tiểu học" | "THCS" | "THPT" | "Sinh viên" | "Chưa đến trường" | "Bỏ học">("Chưa đến trường");
  const [newResidentIsEmployed, setNewResidentIsEmployed] = useState(false);
  const [newResidentLaborSector, setNewResidentLaborSector] = useState<LaborSector>(LaborSector.UNEMPLOYED);
  const [newResidentIsExportLabor, setNewResidentIsExportLabor] = useState(false);
  const [newResidentSubsidyType, setNewResidentSubsidyType] = useState("");
  const [newResidentSubsidyAmount, setNewResidentSubsidyAmount] = useState("");
  const [newResidentSubsidyStartDate, setNewResidentSubsidyStartDate] = useState("");
  const [newResidentNotes, setNewResidentNotes] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const handleCccdScanSuccess = (data: {
    cccd: string;
    oldCmnd?: string;
    fullName: string;
    birthDate: string;
    gender: string;
    address: string;
    issueDate?: string;
  }) => {
    setNewResidentCccd(data.cccd);
    setNewResidentCccdIssuedDate(data.issueDate || "");
    setNewResidentName(data.fullName);
    setNewResidentBirthDate(data.birthDate);
    if (data.gender === "Nam") {
      setNewResidentGender(Gender.MALE);
    } else if (data.gender === "Nữ") {
      setNewResidentGender(Gender.FEMALE);
    } else {
      setNewResidentGender(Gender.OTHER);
    }
    if (data.address) {
      setNewResidentPermanentAddress(data.address);
      setNewResidentTemporaryAddress("");
    }
  };

  // Household selection and multiple checked residents states
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);

  // Sync address with selected household
  useEffect(() => {
    if (selectedHouseholdId) {
      const hh = households.find(h => h.id === selectedHouseholdId);
      if (hh) {
        setNewResidentPermanentAddress(hh.address);
      }
    }
  }, [selectedHouseholdId, households]);

  // Set default household when open or list changes
  useEffect(() => {
    if (isFormOpen && households.length > 0 && !selectedHouseholdId) {
      setSelectedHouseholdId(households[0].id);
    }
  }, [isFormOpen, households, selectedHouseholdId]);

  const filteredChanges = changes.filter(c => {
    const matchesSearch = 
      c.residentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.residentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleOpenForm = () => {
    setFormType(DemographicsChangeType.NEWBORN);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDetails("");
    setFormResidentId(residents[0]?.id || "");
    
    // Reset resident sub-form
    setNewResidentName("");
    setNewResidentCccd("");
    setNewResidentCccdIssuedDate("");
    setNewResidentBirthDate("");
    setNewResidentGender(Gender.MALE);
    setNewResidentRelation("Con");
    setNewResidentPhone("");
    setNewResidentEmail("");
    setNewResidentEthnicity("Kinh");
    setNewResidentReligion("Không");
    setNewResidentNationality("Việt Nam");
    setNewResidentEducation(EducationLevel.NONE);
    setNewResidentOccupation("Trẻ em");
    setNewResidentWorkplace("");
    setNewResidentPermanentAddress("");
    setNewResidentTemporaryAddress("");
    setNewResidentInsuranceId("");
    setNewResidentIsElderly(false);
    setNewResidentIsDisabled(false);
    setNewResidentIsPregnant(false);
    setNewResidentIsOrphan(false);
    setNewResidentIsStudent(false);
    setNewResidentStudentType("Chưa đến trường");
    setNewResidentIsEmployed(false);
    setNewResidentLaborSector(LaborSector.UNEMPLOYED);
    setNewResidentIsExportLabor(false);
    setNewResidentSubsidyType("");
    setNewResidentSubsidyAmount("");
    setNewResidentSubsidyStartDate("");
    setNewResidentNotes("");

    // Reset multiselect
    if (households.length > 0) {
      setSelectedHouseholdId(households[0].id);
    } else {
      setSelectedHouseholdId("");
    }
    setSelectedResidentIds([]);
    
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDate) {
      alert("Vui lòng chọn ngày diễn ra sự kiện!");
      return;
    }

    const isNewResidentType = 
      formType === DemographicsChangeType.NEWBORN ||
      formType === DemographicsChangeType.MOVE_IN ||
      formType === DemographicsChangeType.TEMP_STAY;

    if (isNewResidentType) {
      if (!newResidentName.trim()) {
        alert("Vui lòng nhập họ tên cho cư dân mới!");
        return;
      }
      if (!newResidentBirthDate) {
        alert("Vui lòng chọn ngày sinh cho cư dân mới!");
        return;
      }
      if (!selectedHouseholdId) {
        alert("Vui lòng chọn hộ gia đình tiếp nhận cư dân mới!");
        return;
      }

      const selectedHh = households.find(h => h.id === selectedHouseholdId);
      const generatedId = newResidentCccd.trim() || `RES-${Date.now()}`;

      // Check for duplicate Resident ID/CCCD
      if (newResidentCccd.trim() && residents.some(r => r.id === newResidentCccd.trim())) {
        alert("Mã định danh/CCCD này đã tồn tại trong hệ thống!");
        return;
      }

      // 1. Create and add new resident
      const newResident: Resident = {
        id: generatedId,
        cccdIssuedDate: newResidentCccdIssuedDate || undefined,
        fullName: newResidentName.trim(),
        birthDate: newResidentBirthDate,
        gender: newResidentGender,
        relationToOwner: newResidentRelation,
        nationalId: newResidentCccd.trim() || generatedId,
        phone: newResidentPhone.trim() || undefined,
        email: newResidentEmail.trim() || undefined,
        status: formType === DemographicsChangeType.TEMP_STAY ? ResidentStatus.TEMPORARY_STAY : ResidentStatus.PERMANENT,
        ethnicity: newResidentEthnicity.trim(),
        religion: newResidentReligion.trim(),
        nationality: newResidentNationality.trim(),
        education: newResidentEducation,
        occupation: newResidentOccupation.trim(),
        workplace: newResidentWorkplace.trim() || undefined,
        householdId: selectedHouseholdId,
        wardId: selectedHh?.wardId || "Tổ 1",
        permanentAddress: newResidentPermanentAddress || selectedHh?.address,
        temporaryAddress: newResidentTemporaryAddress.trim() || undefined,
        insuranceId: newResidentInsuranceId.trim() || undefined,
        hasHealthInsurance: !!newResidentInsuranceId.trim(),
        isElderly: newResidentIsElderly,
        isDisabled: newResidentIsDisabled,
        isPregnant: newResidentIsPregnant,
        isOrphan: newResidentIsOrphan,
        isStudent: newResidentIsStudent,
        studentType: newResidentIsStudent ? newResidentStudentType : undefined,
        isEmployed: newResidentIsEmployed,
        laborSector: newResidentLaborSector,
        isExportLabor: newResidentIsExportLabor,
        subsidyType: newResidentSubsidyType.trim() || undefined,
        subsidyAmount: newResidentSubsidyAmount ? Number(newResidentSubsidyAmount) : undefined,
        subsidyStartDate: newResidentSubsidyStartDate || undefined,
        notes: newResidentNotes.trim() || undefined
      };

      onAddResident(newResident);

      // 2. Sync to household if they are the Owner
      if (newResidentRelation === "Chủ hộ" && selectedHh) {
        onUpdateHousehold({
          ...selectedHh,
          ownerId: newResident.id,
          ownerName: newResident.fullName
        });
      }

      // 3. Add demographic change record
      onAddChange({
        residentId: newResident.id,
        residentName: newResident.fullName,
        type: formType,
        date: formDate,
        details: formDetails.trim() || `Đăng ký thành viên mới gia nhập hộ gia đình ${selectedHouseholdId} với vai trò là ${newResidentRelation}.`,
        recordedBy: currentUser?.fullName || "Cán bộ quản lý"
      });

    } else {
      // For MOVE_OUT, TEMP_ABSENT, DEATH
      if (!selectedHouseholdId) {
        alert("Vui lòng chọn hộ gia đình!");
        return;
      }
      if (selectedResidentIds.length === 0) {
        alert("Vui lòng chọn ít nhất một cư dân trong hộ!");
        return;
      }

      // Loop through each selected resident ID
      for (const resId of selectedResidentIds) {
        const resident = residents.find(r => r.id === resId);
        if (!resident) continue;

        // 1. Add demographic change record
        onAddChange({
          residentId: resId,
          residentName: resident.fullName,
          type: formType,
          date: formDate,
          details: formDetails.trim() || `Khai báo sự kiện ${formType.toLowerCase()} tại hộ gia đình ${selectedHouseholdId}.`,
          recordedBy: currentUser?.fullName || "Cán bộ quản lý"
        });

        // 2. Sync / update resident in the system
        if (formType === DemographicsChangeType.DEATH) {
          onUpdateResident({
            ...resident,
            occupation: "Đã qua đời"
          });
        } else if (formType === DemographicsChangeType.TEMP_ABSENT) {
          onUpdateResident({
            ...resident,
            status: ResidentStatus.TEMPORARY_ABSENT,
            notes: resident.notes ? `${resident.notes} (Đăng ký tạm vắng từ ngày ${formDate})` : `Đăng ký tạm vắng từ ngày ${formDate}`
          });
        } else if (formType === DemographicsChangeType.MOVE_OUT) {
          onUpdateResident({
            ...resident,
            status: ResidentStatus.TEMPORARY_ABSENT,
            notes: resident.notes ? `${resident.notes} (Đã chuyển đi nơi khác từ ngày ${formDate})` : `Đã chuyển đi nơi khác từ ngày ${formDate}`
          });
        }
      }
    }

    setIsFormOpen(false);
  };

  const getEventIcon = (type: DemographicsChangeType) => {
    switch (type) {
      case DemographicsChangeType.NEWBORN:
        return <Baby className="w-5 h-5 text-sky-500" />;
      case DemographicsChangeType.MOVE_IN:
        return <LogIn className="w-5 h-5 text-emerald-500" />;
      case DemographicsChangeType.MOVE_OUT:
        return <LogOut className="w-5 h-5 text-rose-500" />;
      case DemographicsChangeType.TEMP_STAY:
        return <Clock className="w-5 h-5 text-indigo-500" />;
      case DemographicsChangeType.TEMP_ABSENT:
        return <Clock className="w-5 h-5 text-amber-500" />;
      case DemographicsChangeType.DEATH:
        return <Skull className="w-5 h-5 text-slate-700" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    const headers = [
      "STT", "Họ tên Công dân", "Số CCCD", "Loại Biến Động", "Ngày Ghi Nhận", "Chi Tiết Sự Vụ"
    ];
    const rows = filteredChanges.map((c, idx) => [
      idx + 1,
      c.residentName,
      c.residentId,
      c.type,
      c.date,
      c.details
    ]);
    onExport(type, "Biến động dân cư Hộ tịch", headers, rows);
  };

  const isNewResidentType = 
    formType === DemographicsChangeType.NEWBORN ||
    formType === DemographicsChangeType.MOVE_IN ||
    formType === DemographicsChangeType.TEMP_STAY;

  const currentHouseholdResidents = residents.filter(r => r.householdId === selectedHouseholdId);

  return (
    <div id="demographics-change-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-600" />
            Biến động dân cư (Hộ tịch)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Lịch sử sinh tử, di dời địa bàn cư trú, đăng ký tạm trú, tạm vắng chính thức
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onExport && canUserPerformAction(currentUser, "export") && (
            <>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                title="Xuất bảng dữ liệu biến động sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                title="Xuất bản in báo cáo PDF của biến động dân cư"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF (In)
              </button>
            </>
          )}

          {canUserPerformAction(currentUser, "add") && (
            <button
              onClick={handleOpenForm}
              className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Khai báo biến động mới
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên công dân, số định danh, hoặc chi tiết sự vụ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600 focus:bg-white"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="sm:w-52">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600 font-semibold cursor-pointer"
            >
              <option value="ALL">Tất cả loại biến động</option>
              <option value={DemographicsChangeType.NEWBORN}>Khai sinh mới</option>
              <option value={DemographicsChangeType.MOVE_IN}>Chuyển đến địa bàn</option>
              <option value={DemographicsChangeType.MOVE_OUT}>Chuyển đi nơi khác</option>
              <option value={DemographicsChangeType.TEMP_STAY}>Đăng ký tạm trú</option>
              <option value={DemographicsChangeType.TEMP_ABSENT}>Đăng ký tạm vắng</option>
              <option value={DemographicsChangeType.DEATH}>Khai tử (Qua đời)</option>
            </select>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                viewMode === "timeline"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Dòng thời gian</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Bảng dữ liệu</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Dạng thẻ (Mobile)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conditionally render Timeline, Table, or Mobile Card lists */}
      {viewMode === "timeline" ? (
        <div className="relative border-l-2 border-slate-200 pl-6 ml-4 space-y-6">
          {filteredChanges.map((change) => (
            <div key={change.id} className="relative bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:shadow-md transition-shadow">
              {/* Left anchor circle representing state event icon */}
              <div className="absolute -left-[37px] top-4 bg-white border border-slate-200 p-1.5 rounded-full shadow-sm z-10">
                {getEventIcon(change.type)}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    change.type === DemographicsChangeType.NEWBORN ? "bg-sky-50 text-sky-700 animate-pulse" :
                    change.type === DemographicsChangeType.DEATH ? "bg-slate-100 text-slate-800" :
                    change.type === DemographicsChangeType.MOVE_IN ? "bg-emerald-50 text-emerald-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {change.type}
                  </span>
                  <h3 className="text-base font-bold text-slate-800 mt-1.5">{change.residentName}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-[10px] text-slate-400">Mã định danh: <span className="font-mono">{change.residentId}</span></p>
                    <button
                      onClick={() => handleViewResident(change.residentId, change.residentName)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50 transition-colors text-[9px] font-bold cursor-pointer"
                    >
                      <Eye className="w-2.5 h-2.5" /> Chi tiết nhân khẩu
                    </button>
                  </div>
                </div>

                <div className="text-right sm:text-right text-xs text-slate-500">
                  <p className="font-bold flex items-center justify-end gap-1"><Calendar className="w-3.5 h-3.5" /> {change.date}</p>
                  <p className="text-[10px] mt-0.5">Cán bộ lập phiếu: {change.recordedBy}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                <b>Nội dung biên bản:</b> {change.details}
              </p>
            </div>
          ))}

          {filteredChanges.length === 0 && (
            <div className="bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-xs">
              Chưa có ghi chép biến động dân cư nào được lưu trữ.
            </div>
          )}
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-xs text-slate-600 min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-center hidden md:table-cell">STT</th>
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-20 min-w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">Họ và Tên</th>
                  <th className="px-4 py-3 text-center min-w-[130px]">Loại Biến Động</th>
                  <th className="px-4 py-3 text-center min-w-[100px]">Ngày Ghi Nhận</th>
                  <th className="px-4 py-3 hidden sm:table-cell min-w-[120px]">Số Định Danh / CCCD</th>
                  <th className="px-4 py-3 hidden lg:table-cell min-w-[120px]">Cán Bộ Ghi Nhận</th>
                  <th className="px-4 py-3 hidden md:table-cell min-w-[200px]">Chi Tiết Sự Vụ</th>
                  <th className="px-4 py-3 text-right sticky right-0 bg-slate-50 z-20 min-w-[100px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.15)]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredChanges.map((change, idx) => (
                  <tr key={change.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-slate-400 hidden md:table-cell">{idx + 1}</td>
                    <td className="px-4 py-3 sticky left-0 bg-white font-bold text-slate-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] hover:bg-slate-50 transition-colors">
                      {change.residentName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-block ${
                        change.type === DemographicsChangeType.NEWBORN ? "bg-sky-50 text-sky-700 animate-pulse border border-sky-100" :
                        change.type === DemographicsChangeType.DEATH ? "bg-slate-100 text-slate-800 border border-slate-200" :
                        change.type === DemographicsChangeType.MOVE_IN ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {change.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-600">{formatDate(change.date)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 hidden sm:table-cell">{change.residentId}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{change.recordedBy}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-xs truncate" title={change.details}>{change.details}</td>
                    <td className="px-4 py-3 text-right sticky right-0 bg-white z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.15)] hover:bg-slate-50 transition-colors">
                      <button
                        onClick={() => handleViewResident(change.residentId, change.residentName)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors text-[10px] font-bold cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredChanges.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      Chưa có ghi chép biến động dân cư nào được lưu trữ.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {filteredChanges.map((change) => (
            <div 
              key={change.id} 
              className={`bg-white border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 ${
                change.type === DemographicsChangeType.NEWBORN ? "border-t-sky-500" :
                change.type === DemographicsChangeType.DEATH ? "border-t-slate-500" :
                change.type === DemographicsChangeType.MOVE_IN ? "border-t-emerald-500" :
                "border-t-amber-500"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    change.type === DemographicsChangeType.NEWBORN ? "bg-sky-50 text-sky-700 border-sky-100" :
                    change.type === DemographicsChangeType.DEATH ? "bg-slate-50 text-slate-700 border-slate-200" :
                    change.type === DemographicsChangeType.MOVE_IN ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                    "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                    {change.type}
                  </span>
                  <div className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{change.date}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-wide">{change.residentName}</h3>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Mã / CCCD:</span>
                    <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">{change.residentId}</span>
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nội dung ghi chép</div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{change.details}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Cán bộ</span>
                  <span className="text-[10px] text-slate-600 font-bold">{change.recordedBy}</span>
                </div>
                <button
                  onClick={() => handleViewResident(change.residentId, change.residentName)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-850 transition-all text-[10px] font-bold cursor-pointer border border-emerald-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem hồ sơ</span>
                </button>
              </div>
            </div>
          ))}

          {filteredChanges.length === 0 && (
            <div className="col-span-full bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-xs">
              Chưa có ghi chép biến động dân cư nào được lưu trữ.
            </div>
          )}
        </div>
      )}

      {/* FORM MODAL DIALOG */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 overflow-y-auto">
          <div className={`bg-white rounded-2xl w-full overflow-hidden shadow-2xl flex flex-col my-8 transition-all duration-300 ${
            isZoomed ? "max-w-4xl h-[90vh] md:h-[94vh]" : "max-w-2xl max-h-[90vh]"
          }`}>
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-100" />
                <h3 className="font-bold text-base">Khai báo hồ sơ Biến động cư trú</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
                  title={isZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button onClick={() => setIsFormOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-emerald-700/50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-slate-600">
              
              {/* Type and date select always shown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Loại sự kiện biến động</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as DemographicsChangeType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={DemographicsChangeType.NEWBORN}>Sinh mới (Khai sinh)</option>
                    <option value={DemographicsChangeType.MOVE_IN}>Chuyển từ địa bàn khác đến</option>
                    <option value={DemographicsChangeType.MOVE_OUT}>Chuyển đi địa bàn khác</option>
                    <option value={DemographicsChangeType.TEMP_STAY}>Đăng ký tạm trú</option>
                    <option value={DemographicsChangeType.TEMP_ABSENT}>Đăng ký tạm vắng</option>
                    <option value={DemographicsChangeType.DEATH}>Qua đời (Khai tử)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày diễn ra sự kiện</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* DYNAMIC FORM SECTION */}
              {isNewResidentType ? (
                /* SECTION 1: Adding a completely new resident */
                <div className="space-y-4">
                  <div className="border-l-4 border-emerald-600 pl-3">
                    <h4 className="text-sm font-bold text-slate-800">Thông tin nhân khẩu mới</h4>
                    <p className="text-[10px] text-slate-400">Nhập đầy đủ thông tin để tự động khởi tạo nhân khẩu mới đồng bộ vào hệ thống</p>
                  </div>

                  <div className="bg-emerald-50/90 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Khai báo nhanh bằng QR CCCD</p>
                        <p className="text-[10px] text-emerald-700 font-medium">Tự động điền Họ tên, Số CCCD, Ngày sinh từ thẻ CCCD.</p>
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

                  {/* Target household & basic info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hộ gia đình tiếp nhận *</label>
                      <select
                        value={selectedHouseholdId}
                        onChange={(e) => setSelectedHouseholdId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                        required
                      >
                        <option value="">-- Chọn hộ gia đình --</option>
                        {households.map(h => (
                          <option key={h.id} value={h.id}>Hộ {h.id} - Chủ hộ: {h.ownerName} ({h.address})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quan hệ với chủ hộ *</label>
                      <select
                        value={newResidentRelation}
                        onChange={(e) => setNewResidentRelation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                        required
                      >
                        <option value="Con">Con</option>
                        <option value="Vợ">Vợ</option>
                        <option value="Chồng">Chồng</option>
                        <option value="Cháu">Cháu</option>
                        <option value="Chủ hộ">Chủ hộ (Thay thế chủ hộ cũ)</option>
                        <option value="Bố">Bố</option>
                        <option value="Mẹ">Mẹ</option>
                        <option value="Anh">Anh</option>
                        <option value="Chị">Chị</option>
                        <option value="Em">Em</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Họ và tên đầy đủ *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Nguyễn Văn A"
                        value={newResidentName}
                        onChange={(e) => setNewResidentName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số CMND / CCCD / Định danh</label>
                      <input
                        type="text"
                        placeholder="Để trống nếu chưa cấp hoặc trẻ sơ sinh"
                        value={newResidentCccd}
                        onChange={(e) => {
                          setNewResidentCccd(e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày tháng năm sinh *</label>
                      <input
                        type="date"
                        required
                        value={newResidentBirthDate}
                        onChange={(e) => setNewResidentBirthDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày cấp CCCD</label>
                      <input
                        type="date"
                        value={newResidentCccdIssuedDate}
                        onChange={(e) => setNewResidentCccdIssuedDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giới tính *</label>
                      <select
                        value={newResidentGender}
                        onChange={(e) => setNewResidentGender(e.target.value as Gender)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                        required
                      >
                        <option value={Gender.MALE}>Nam</option>
                        <option value={Gender.FEMALE}>Nữ</option>
                        <option value={Gender.OTHER}>Khác</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã số Bảo hiểm y tế</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: GD479..."
                        value={newResidentInsuranceId}
                        onChange={(e) => setNewResidentInsuranceId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  {/* Demographic & Culture */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dân tộc</label>
                      <input
                        type="text"
                        value={newResidentEthnicity}
                        onChange={(e) => setNewResidentEthnicity(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tôn giáo</label>
                      <input
                        type="text"
                        value={newResidentReligion}
                        onChange={(e) => setNewResidentReligion(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quốc tịch</label>
                      <input
                        type="text"
                        value={newResidentNationality}
                        onChange={(e) => setNewResidentNationality(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ thường trú</label>
                      <input
                        type="text"
                        placeholder="Tự động lấy theo địa chỉ hộ gia đình tiếp nhận"
                        value={newResidentPermanentAddress}
                        onChange={(e) => setNewResidentPermanentAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ tạm trú</label>
                      <input
                        type="text"
                        placeholder="Điền nếu khác địa chỉ thường trú"
                        value={newResidentTemporaryAddress}
                        onChange={(e) => setNewResidentTemporaryAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Education & Employment */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghề nghiệp hiện tại</label>
                      <input
                        type="text"
                        value={newResidentOccupation}
                        onChange={(e) => setNewResidentOccupation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trình độ học vấn</label>
                      <select
                        value={newResidentEducation}
                        onChange={(e) => setNewResidentEducation(e.target.value as EducationLevel)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                      >
                        <option value={EducationLevel.NONE}>Chưa qua đào tạo</option>
                        <option value={EducationLevel.PRIMARY}>Tiểu học</option>
                        <option value={EducationLevel.SECONDARY}>THCS</option>
                        <option value={EducationLevel.HIGH_SCHOOL}>THPT</option>
                        <option value={EducationLevel.VOCATIONAL}>Trung cấp</option>
                        <option value={EducationLevel.COLLEGE}>Cao đẳng</option>
                        <option value={EducationLevel.UNIVERSITY}>Đại học</option>
                        <option value={EducationLevel.POSTGRADUATE}>Sau đại học</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick toggle settings */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h5 className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Trạng thái đặc biệt & An sinh xã hội</h5>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newResidentIsElderly}
                          onChange={(e) => setNewResidentIsElderly(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Người cao tuổi</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newResidentIsDisabled}
                          onChange={(e) => setNewResidentIsDisabled(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Khuyết tật</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newResidentIsPregnant}
                          onChange={(e) => setNewResidentIsPregnant(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Thai sản (Nữ)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newResidentIsOrphan}
                          onChange={(e) => setNewResidentIsOrphan(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Trẻ em mồ côi</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={newResidentIsStudent}
                            onChange={(e) => setNewResidentIsStudent(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Đang đi học (Học sinh/Sinh viên)</span>
                        </label>
                        {newResidentIsStudent && (
                          <select
                            value={newResidentStudentType}
                            onChange={(e) => setNewResidentStudentType(e.target.value as any)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                          >
                            <option value="Chưa đến trường">Chưa đến trường</option>
                            <option value="Mầm non">Mầm non</option>
                            <option value="Tiểu học">Tiểu học</option>
                            <option value="THCS">THCS</option>
                            <option value="THPT">THPT</option>
                            <option value="Sinh viên">Sinh viên</option>
                            <option value="Bỏ học">Bỏ học</option>
                          </select>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={newResidentIsEmployed}
                            onChange={(e) => setNewResidentIsEmployed(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Có việc làm</span>
                        </label>
                        {newResidentIsEmployed && (
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={newResidentLaborSector}
                              onChange={(e) => setNewResidentLaborSector(e.target.value as LaborSector)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                            >
                              <option value={LaborSector.AGRICULTURE}>Nông nghiệp</option>
                              <option value={LaborSector.INDUSTRY}>Công nghiệp</option>
                              <option value={LaborSector.SERVICE}>Dịch vụ</option>
                              <option value={LaborSector.UNEMPLOYED}>Thất nghiệp</option>
                            </select>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                              <input
                                type="checkbox"
                                checked={newResidentIsExportLabor}
                                onChange={(e) => setNewResidentIsExportLabor(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span>XKLĐ</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SECTION 2: Selecting multiple residents of a household for MOVE_OUT, TEMP_ABSENT, or DEATH */
                <div className="space-y-4">
                  <div className="border-l-4 border-amber-500 pl-3">
                    <h4 className="text-sm font-bold text-slate-800">Chọn hộ dân & Cư dân ghi nhận biến động</h4>
                    <p className="text-[10px] text-slate-400">Chọn hộ gia đình sau đó tích chọn những thành viên chịu ảnh hưởng của biến động</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chọn hộ gia đình liên quan *</label>
                    <select
                      value={selectedHouseholdId}
                      onChange={(e) => {
                        setSelectedHouseholdId(e.target.value);
                        setSelectedResidentIds([]); // Reset selected residents
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                      required
                    >
                      <option value="">-- Chọn hộ gia đình --</option>
                      {households.map(h => (
                        <option key={h.id} value={h.id}>Hộ {h.id} - Chủ hộ: {h.ownerName} ({h.address})</option>
                      ))}
                    </select>
                  </div>

                  {selectedHouseholdId && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Tích chọn các thành viên trong hộ bị ảnh hưởng *</label>
                      
                      {currentHouseholdResidents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-52 overflow-y-auto">
                          {currentHouseholdResidents.map(r => {
                            const isChecked = selectedResidentIds.includes(r.id);
                            return (
                              <label key={r.id} className="flex items-center gap-2.5 p-2 bg-white hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors border border-slate-150 shadow-2xs">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedResidentIds(prev => prev.filter(id => id !== r.id));
                                    } else {
                                      setSelectedResidentIds(prev => [...prev, r.id]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 text-xs truncate">{r.fullName}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">Quan hệ: {r.relationToOwner}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                          Hộ gia đình này hiện không có thành viên nào được đăng ký.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Common Details Field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chi tiết nội dung biên bản *</label>
                <textarea
                  required
                  rows={3}
                  placeholder={
                    formType === DemographicsChangeType.NEWBORN ? "Ghi chú tên cha, mẹ, nơi sinh sản, bệnh viện..." :
                    formType === DemographicsChangeType.DEATH ? "Ghi rõ ngày mất, giờ mất, nguyên nhân từ trần, số giấy chứng tử..." :
                    "Ghi rõ địa chỉ chuyển đi / chuyển tới, mục đích, thời hạn hoặc lý do biến động..."
                  }
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-emerald-600 focus:bg-white resize-none"
                />
              </div>

              {/* Notice guidelines */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800">
                <b>* Chú ý về tính pháp lý:</b> Mọi sự kiện biến động cư dân sau khi xác nhận sẽ trực tiếp ảnh hưởng đến hồ sơ quản lý nhân khẩu và các quyền lợi an sinh liên quan. Hãy đảm bảo thông tin trùng khớp với văn bản giấy của UBND Phường cấp.
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-sm hover:shadow-md"
                >
                  Xác nhận lưu trữ biên bản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL CARD */}
      {selectedResident && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-fadeIn">
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-base">HỒ SƠ CÁ NHÂN: {selectedResident.fullName}</h3>
                  <p className="text-xs text-emerald-200 flex items-center gap-2">
                    <span>Mã định danh/CCCD: {selectedResident.id}</span>
                    <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold text-white">
                      {selectedResident.wardId || (households.find(h => h.id === selectedResident.householdId)?.wardId) || "Tổ 1"}
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedResident(null)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
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
                      <div className="mt-1 relative group">
                        <img 
                          src={selectedResident.photoUrl} 
                          alt="Hiện trường" 
                          referrerPolicy="no-referrer"
                          className="w-full max-h-32 object-cover rounded-lg border border-slate-200 shadow-sm" 
                        />
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
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedResident(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSING RESIDENT MODAL */}
      {missingResidentName && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-fadeIn">
            <div className="bg-amber-600 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-sm uppercase">Lưu ý hồ sơ lưu trữ</h3>
              </div>
              <button onClick={() => setMissingResidentName(null)} className="text-amber-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed text-slate-700">
                Nhân khẩu <b>{missingResidentName}</b> hiện tại không có trong danh sách quản lý tích cực của Tổ dân phố Ninh Phú.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                <p className="font-semibold">* Nguyên nhân phổ biến:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>Nhân khẩu đã thực hiện thủ tục <b>Chuyển đi nơi khác</b>.</li>
                  <li>Nhân khẩu đã làm thủ tục <b>Khai tử</b> (qua đời).</li>
                  <li>Hồ sơ nhân khẩu gốc đã bị xóa hoặc thay đổi mã định danh.</li>
                </ul>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Cán bộ vẫn có thể tra cứu lịch sử sự kiện này trực tiếp tại dòng thời gian biến động dân cư hộ tịch.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100 gap-2">
              <button
                type="button"
                onClick={() => setMissingResidentName(null)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      <CccdQrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleCccdScanSuccess}
      />
    </div>
  );
}
