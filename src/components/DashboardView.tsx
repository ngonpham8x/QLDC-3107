/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Users, Home, ShieldAlert, Award, FileSpreadsheet, 
  TrendingUp, Activity, Briefcase, GraduationCap, Heart, Printer, Download, Sparkles,
  Search, Filter, Trash2, Table, LayoutGrid, Upload, Database, RefreshCw, CheckCircle, FileJson
} from "lucide-react";
import { Household, Resident, BusinessHousehold, WasteCollectionStatus, WaterSource, UserRole } from "../types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

interface DashboardViewProps {
  households: Household[];
  residents: Resident[];
  businesses: BusinessHousehold[];
  onExport: (type: "xlsx" | "docx" | "pdf", entity: string, passedHeaders?: string[], passedRows?: any[][]) => void;
  isMobile: boolean;
  userRole?: UserRole;
  onGenerateMockData?: () => void;
  onClearAllData?: (bypassConfirm?: boolean) => void;
  onExportFullBackup?: () => void;
  onExportJSONBackup?: () => void;
  onRestoreBackup?: (file: File) => void;
}

export default function DashboardView({ 
  households, 
  residents, 
  businesses, 
  onExport, 
  isMobile, 
  userRole,
  onGenerateMockData,
  onClearAllData,
  onExportFullBackup,
  onExportJSONBackup,
  onRestoreBackup
}: DashboardViewProps) {
  const activeResidents = residents.filter(r => r.occupation !== "Đã qua đời");
  
  // Detailed Filtering States
  const [detCategory, setDetCategory] = React.useState("all");
  const [detGender, setDetGender] = React.useState("all");
  const [detWard, setDetWard] = React.useState("all");
  const [detSearch, setDetSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");
  const [showBackupTools, setShowBackupTools] = React.useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (isMobile) {
      setViewMode("cards");
    } else {
      setViewMode("table");
    }
  }, [isMobile]);

  const totalResidents = activeResidents.length;
  const totalHouseholds = households.length;

  // Demographics stats
  const maleCount = activeResidents.filter(r => r.gender === "Nam").length;
  const femaleCount = activeResidents.filter(r => r.gender === "Nữ").length;
  const otherGenderCount = totalResidents - maleCount - femaleCount;

  // Age calculation
  const getAge = (birthDateStr: string) => {
    const bdate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - bdate.getFullYear();
    const m = today.getMonth() - bdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bdate.getDate())) {
      age--;
    }
    return age;
  };

  const ages = activeResidents.map(r => getAge(r.birthDate));
  const childCount = ages.filter(a => a < 15).length; // Trẻ em < 15
  const workingAgeCount = ages.filter(a => a >= 15 && a < 60).length; // Lao động 15-59
  const elderlyCount = ages.filter(a => a >= 60).length; // Người già >= 60

  // Military Service Age calculations (Nam, 18-25, or 18-27 if higher education)
  const militaryServiceResidents = activeResidents.filter(r => {
    if (r.gender !== "Nam") return false;
    const age = getAge(r.birthDate);
    const hasHigherEd = r.education === "Đại học" || r.education === "Sau đại học" || r.education === "Cao đẳng" || r.education === "Trung cấp";
    const maxAge = hasHigherEd ? 27 : 25;
    return age >= 18 && age <= maxAge;
  });

  // Poverty stats
  const poorHouseholds = households.filter(h => h.status === "Hộ nghèo").length;
  const nearPoorHouseholds = households.filter(h => h.status === "Hộ cận nghèo").length;
  const normalHouseholds = totalHouseholds - poorHouseholds - nearPoorHouseholds;

  // BHYT stats
  const hasInsurance = activeResidents.filter(r => r.insuranceId).length;
  const noInsurance = totalResidents - hasInsurance;

  // Education Level Breakdown
  const eduStats = {
    NONE: activeResidents.filter(r => r.education === "Chưa qua đào tạo" || !r.education).length,
    PRIMARY: activeResidents.filter(r => r.education === "Tiểu học").length,
    SECONDARY: activeResidents.filter(r => r.education === "THCS").length,
    HIGH_SCHOOL: activeResidents.filter(r => r.education === "THPT").length,
    VOCATIONAL_COLLEGE: activeResidents.filter(r => r.education === "Trung cấp" || r.education === "Cao đẳng").length,
    UNIVERSITY_ABOVE: activeResidents.filter(r => r.education === "Đại học" || r.education === "Sau đại học").length,
  };

  // Labor statistics
  const employedCount = activeResidents.filter(r => r.isEmployed).length;
  const unemployedCount = totalResidents - employedCount - childCount; // kids don't count as unemployed

  // Detailed Filter Logic
  const filteredDetailedResidents = activeResidents.filter(r => {
    // 1. Category filter
    if (detCategory === "military") {
      if (r.gender !== "Nam") return false;
      const age = getAge(r.birthDate);
      const hasHigherEd = r.education === "Đại học" || r.education === "Sau đại học" || r.education === "Cao đẳng" || r.education === "Trung cấp";
      const maxAge = hasHigherEd ? 27 : 25;
      if (age < 18 || age > maxAge) return false;
    } else if (detCategory === "elderly") {
      if (getAge(r.birthDate) < 60) return false;
    } else if (detCategory === "children") {
      if (getAge(r.birthDate) >= 15) return false;
    } else if (detCategory === "student") {
      if (!r.isStudent) return false;
    } else if (detCategory === "employed") {
      if (!r.isEmployed) return false;
    } else if (detCategory === "unemployed") {
      const age = getAge(r.birthDate);
      if (r.isEmployed || age < 15 || age >= 60) return false;
    } else if (detCategory === "poor") {
      const hh = households.find(h => h.id === r.householdId);
      if (!hh || (hh.status !== "Hộ nghèo" && hh.status !== "Hộ cận nghèo")) return false;
    } else if (detCategory === "insurance") {
      if (!r.insuranceId) return false;
    } else if (detCategory === "disabled") {
      if (!r.isDisabled) return false;
    } else if (detCategory === "agri") {
      const hh = households.find(h => h.id === r.householdId);
      if (!hh || hh.housingType !== "Có") return false;
    }

    // 2. Gender filter
    if (detGender !== "all" && r.gender !== detGender) return false;

    // 3. Ward filter
    if (detWard !== "all" && r.wardId !== detWard) return false;

    // 4. Search filter
    if (detSearch.trim() !== "") {
      const searchLower = detSearch.toLowerCase();
      const matchesName = r.fullName.toLowerCase().includes(searchLower);
      const matchesId = r.id.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesId) return false;
    }

    return true;
  });

  const handleExportFiltered = (format: "xlsx" | "pdf") => {
    const headers = [
      "STT", "Họ tên", "Số CCCD", "Ngày sinh", "Tuổi", "Giới tính", 
      "Quan hệ", "Học vị", "Nghề nghiệp", "Số điện thoại", "Tổ dân phố", "Địa chỉ thường trú"
    ];
    const rows = filteredDetailedResidents.map((r, idx) => [
      idx + 1,
      r.fullName,
      r.id,
      r.birthDate,
      getAge(r.birthDate),
      r.gender,
      r.relationToOwner,
      r.education || "Chưa qua đào tạo",
      r.occupation || "Tự do",
      r.phone || "Chưa cập nhật",
      r.wardId || "N/A",
      r.permanentAddress || "Chưa cập nhật"
    ]);

    let filterLabel = "Báo cáo chi tiết ";
    if (detCategory !== "all") {
      const catLabels: {[key: string]: string} = {
        military: "Độ tuổi Nghĩa vụ quân sự",
        elderly: "Người cao tuổi",
        children: "Trẻ em dưới 15 tuổi",
        student: "Học sinh sinh viên",
        employed: "Nhân khẩu có việc làm",
        unemployed: "Nhân khẩu tự do thất nghiệp",
        poor: "Hộ nghèo cận nghèo",
        insurance: "Thẻ bảo hiểm y tế",
        disabled: "Người khuyết tật",
        agri: "Thành viên Hộ nông nghiệp"
      };
      filterLabel += (catLabels[detCategory] || detCategory) + " ";
    }
    if (detGender !== "all") {
      filterLabel += `Giới tính ${detGender} `;
    }
    if (detWard !== "all") {
      filterLabel += `thuộc ${detWard} `;
    }
    if (detSearch) {
      filterLabel += `Tìm kiếm ${detSearch} `;
    }
    filterLabel = filterLabel.trim() || "Báo cáo thống kê chi tiết nhân khẩu";

    onExport(format, filterLabel, headers, rows);
  };

  return (
    <div id="dashboard-view-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Welcome & Quick Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            Báo cáo điều hành & Thống kê dân cư
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Số liệu tổng hợp thời gian thực của Khu phố Ninh Phú
          </p>
        </div>

        {/* Rapid Actions & Printing */}
        <div className="flex flex-wrap items-center gap-2">
          {false && onGenerateMockData && (
            <button
              onClick={onGenerateMockData}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md transition-colors cursor-pointer"
              title="Tự động khởi tạo 25 hộ dân với 105 nhân khẩu mẫu có đầy đủ lý lịch, nghề nghiệp, bảo hiểm..."
            >
              <Sparkles className="w-3.5 h-3.5" />
              Khởi tạo 25 Hộ & 105 Nhân khẩu mẫu
            </button>
          )}
          <button
            onClick={() => onExport("xlsx", "residents")}
            className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất Excel Nhân khẩu (XLSX)
          </button>
          <button
            onClick={() => onExport("pdf", "residents")}
            className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Xuất PDF Nhân khẩu (PDF)
          </button>
          <button
            onClick={() => onExport("xlsx", "households")}
            className="flex items-center gap-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-sky-200 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Xuất Excel Hộ khẩu (XLSX)
          </button>
          <button
            onClick={() => onExport("pdf", "households")}
            className="flex items-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-amber-200 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Xuất PDF Hộ khẩu (PDF)
          </button>
        </div>
      </div>

      {/* KPI Core Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Residents Widget */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px]">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tổng nhân khẩu</span>
          <div>
            <h2 className="text-4xl font-black text-slate-800">{totalResidents}</h2>
            <p className="text-xs text-blue-500 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 100% cư trú thực tế
            </p>
          </div>
        </div>

        {/* Total Households Widget */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px]">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Số hộ gia đình</span>
          <div>
            <h2 className="text-4xl font-black text-slate-800">{totalHouseholds}</h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              TB {totalResidents > 0 ? (totalResidents / totalHouseholds).toFixed(1) : 0} người / hộ
            </p>
          </div>
        </div>

        {/* Poverty Indicator Widget - Orange Accent */}
        <div className="bg-[#F97316] text-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[140px]">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">An sinh xã hội</span>
          <div>
            <h2 className="text-4xl font-black">{poorHouseholds + nearPoorHouseholds}</h2>
            <p className="text-xs text-white/80 font-semibold mt-1">
              Hộ nghèo & cận nghèo ({totalHouseholds > 0 ? (((poorHouseholds + nearPoorHouseholds) / totalHouseholds) * 100).toFixed(1) : 0}%)
            </p>
          </div>
        </div>

        {/* Cultural/Policies families Widget */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px]">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Hộ văn hóa / Ưu đãi</span>
          <div>
            <h2 className="text-4xl font-black text-slate-800">{households.filter(h => h.isCulturalFamily).length}</h2>
            <p className="text-xs text-purple-600 font-semibold mt-1">
              {households.filter(h => h.isPolicyFamily || h.isMeritoriousFamily).length} hộ ưu đãi, chính sách
            </p>
          </div>
        </div>

        {/* Trash Fee Collection Widget - Teal/Green Accent */}
        <div className="bg-[#10B981] text-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[140px]">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Thu gom rác & Nước sạch</span>
          <div className="space-y-2 mt-2">
            <div>
              <p className="text-sm font-bold text-white">
                Rác: {households.filter(h => (h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.REGISTERED).length} đã ĐK
              </p>
              <p className="text-xs text-white/90 font-semibold">
                Chưa ĐK: {households.filter(h => (h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.UNREGISTERED).length} | Hủy: {households.filter(h => (h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.CANCELLED).length}
              </p>
            </div>
            <div className="border-t border-white/25 pt-2">
              <p className="text-sm font-bold text-white">
                Nước máy: {households.filter(h => (h.waterSource || WaterSource.TAP_WATER) === WaterSource.TAP_WATER).length} | Nước giếng: {households.filter(h => (h.waterSource || WaterSource.TAP_WATER) === WaterSource.WELL_WATER).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 1: Age & Gender Structure (Bento dark statistic card) */}
        <div className="bg-[#0F172A] text-white rounded-3xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-400 border-b border-slate-800 pb-3 flex items-center gap-2 uppercase tracking-widest text-xs">
            <Users className="w-4 h-4 text-blue-400" />
            Cơ cấu giới tính & Độ tuổi
          </h4>
 
          {/* Gender donut simulation */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Giới tính nhân khẩu</p>
            <div className="flex items-center justify-between gap-4">
              {/* Simple custom SVG Pie Chart */}
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="4" />
                  {/* Male slice */}
                  <circle 
                    cx="18" cy="18" r="15.915" fill="none" stroke="#60a5fa" strokeWidth="4" 
                    strokeDasharray={`${totalResidents > 0 ? (maleCount / totalResidents) * 100 : 0} ${totalResidents > 0 ? 100 - (maleCount / totalResidents) * 100 : 100}`}
                    strokeDashoffset="0"
                  />
                  {/* Female slice */}
                  <circle 
                    cx="18" cy="18" r="15.915" fill="none" stroke="#f472b6" strokeWidth="4" 
                    strokeDasharray={`${totalResidents > 0 ? (femaleCount / totalResidents) * 100 : 0} ${totalResidents > 0 ? 100 - (femaleCount / totalResidents) * 100 : 100}`}
                    strokeDashoffset={`-${totalResidents > 0 ? (maleCount / totalResidents) * 100 : 0}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black text-white">{totalResidents}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-widest">Cư dân</span>
                </div>
              </div>
 
              {/* Legends with large figures for elderly readers */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block"></span>
                    Nam
                  </span>
                  <span className="font-bold text-white">{maleCount} ({totalResidents > 0 ? ((maleCount/totalResidents)*100).toFixed(0) : 0}%)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <span className="w-3 h-3 rounded-full bg-pink-400 inline-block"></span>
                    Nữ
                  </span>
                  <span className="font-bold text-white">{femaleCount} ({totalResidents > 0 ? ((femaleCount/totalResidents)*100).toFixed(0) : 0}%)</span>
                </div>
                {otherGenderCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                      <span className="w-3 h-3 rounded-full bg-slate-500 inline-block"></span>
                      Khác
                    </span>
                    <span className="font-bold text-white">{otherGenderCount} ({totalResidents > 0 ? ((otherGenderCount/totalResidents)*100).toFixed(0) : 0}%)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* Age Brackets Progress Bars */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <p className="text-xs font-semibold text-slate-400">Cơ cấu nhóm tuổi</p>
            
            {/* Child group */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-300">0-14 tuổi (Trẻ em)</span>
                <span className="text-white font-bold">{childCount} trẻ ({totalResidents > 0 ? ((childCount/totalResidents)*100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full" style={{ width: `${totalResidents > 0 ? (childCount/totalResidents)*100 : 0}%` }}></div>
              </div>
            </div>
 
            {/* Working group */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-300">15-59 tuổi (Lao động)</span>
                <span className="text-white font-bold">{workingAgeCount} người ({totalResidents > 0 ? ((workingAgeCount/totalResidents)*100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-green-400 h-full rounded-full" style={{ width: `${totalResidents > 0 ? (workingAgeCount/totalResidents)*100 : 0}%` }}></div>
              </div>
            </div>
 
            {/* Elderly group */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-300">60+ tuổi (Người già)</span>
                <span className="text-white font-bold">{elderlyCount} người ({totalResidents > 0 ? ((elderlyCount/totalResidents)*100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-400 h-full rounded-full" style={{ width: `${totalResidents > 0 ? (elderlyCount/totalResidents)*100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Education & Labor Stats */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2 uppercase tracking-wider text-xs">
            <Briefcase className="w-4 h-4 text-blue-600" />
            Trình độ học vấn & Việc làm
          </h4>

          {/* Education list bar metrics */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Học vấn cao nhất đạt được</p>
            
            <div className="space-y-2.5">
              {[
                { label: "Đại học / Sau đại học", count: eduStats.UNIVERSITY_ABOVE, bg: "bg-indigo-600" },
                { label: "Cao đẳng / Trung cấp", count: eduStats.VOCATIONAL_COLLEGE, bg: "bg-blue-500" },
                { label: "Trung học Phổ thông", count: eduStats.HIGH_SCHOOL, bg: "bg-cyan-500" },
                { label: "Trung học Cơ sở", count: eduStats.SECONDARY, bg: "bg-teal-500" },
                { label: "Tiểu học", count: eduStats.PRIMARY, bg: "bg-emerald-400" },
                { label: "Chưa qua đào tạo", count: eduStats.NONE, bg: "bg-slate-400" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-600 font-medium w-36 truncate">{item.label}</span>
                  <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`${item.bg} h-full`} style={{ width: `${totalResidents > 0 ? (item.count / totalResidents) * 100 : 0}%` }}></div>
                  </div>
                  <span className="text-xs font-bold text-slate-800 w-12 text-right">{item.count} người</span>
                </div>
              ))}
            </div>
          </div>

          {/* Employment stats */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-center">
            <div className="flex-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Có việc làm</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{employedCount} cư dân</p>
              <p className="text-[9px] text-slate-400 font-medium">Tỷ lệ {workingAgeCount > 0 ? ((employedCount/workingAgeCount)*100).toFixed(0) : 0}% độ tuổi lao động</p>
            </div>
            <div className="flex-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Đang đi học</p>
              <p className="text-lg font-black text-blue-600 mt-0.5">{activeResidents.filter(r => r.isStudent).length} trẻ</p>
              <p className="text-[9px] text-slate-400 font-medium">Trường công/tư</p>
            </div>
          </div>
        </div>

        {/* Section 3: Healthcare & Social Security */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2 uppercase tracking-wider text-xs">
              <Heart className="w-4 h-4 text-blue-600" />
              Y tế & An sinh xã hội
            </h4>

            {/* Insurance progress bar */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-slate-700">Tỷ lệ Bảo hiểm Y tế (BHYT)</span>
                <span className="text-sm font-bold text-emerald-600">{totalResidents > 0 ? ((hasInsurance / totalResidents) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-1">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${totalResidents > 0 ? (hasInsurance / totalResidents) * 100 : 0}%` }}></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Có thẻ: {hasInsurance} người</span>
                <span>Chưa có: {noInsurance} người</span>
              </div>
            </div>

            {/* Social Security policy classifications */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đối tượng cần hỗ trợ đặc biệt</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-slate-100 p-2.5 rounded-xl flex flex-col justify-between bg-slate-50/50">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cao tuổi (&gt;60)</span>
                  <span className="text-base font-black text-slate-700 mt-1">{residents.filter(r => r.isElderly && r.occupation !== "Đã qua đời").length} người</span>
                </div>
                <div className="border border-slate-100 p-2.5 rounded-xl flex flex-col justify-between bg-slate-50/50">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Khuyết tật</span>
                  <span className="text-base font-black text-rose-600 mt-1">{residents.filter(r => r.isDisabled && r.occupation !== "Đã qua đời").length} người</span>
                </div>
                <div className="border border-slate-100 p-2.5 rounded-xl flex flex-col justify-between bg-slate-50/50">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Thai sản</span>
                  <span className="text-base font-black text-pink-600 mt-1">{residents.filter(r => r.isPregnant && r.occupation !== "Đã qua đời").length} người</span>
                </div>
                <div className="border border-slate-100 p-2.5 rounded-xl flex flex-col justify-between bg-slate-50/50">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trợ cấp tháng</span>
                  <span className="text-base font-black text-purple-600 mt-1">{residents.filter(r => r.subsidyType && r.occupation !== "Đã qua đời").length} người</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="bg-blue-50 dark:bg-slate-800/90 border border-blue-100 dark:border-blue-700/60 rounded-2xl p-3.5 text-[11px] text-blue-900 dark:text-blue-100 font-medium leading-relaxed mt-2 shadow-xs">
            <b className="text-blue-950 dark:text-blue-300">* Lưu ý rà soát:</b> Ưu tiên cập nhật thông tin chính sách định kỳ để đảm bảo nhận trợ cấp đầy đủ, kịp thời vào ngày 15 hàng tháng.
          </div>
        </div>
      </div>



      {/* Section: Interactive Multi-dimensional Filter & Detailed Category-based Report */}
      <div id="detailed-statistics-filter-section" className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                Lọc & kết xuất dữ liệu chi tiết từng mục
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Rà soát nhanh, tìm kiếm và xuất báo cáo đặc thù cho từng tiêu chí, nhóm nhân khẩu, giới tính và khu vực
              </p>
            </div>
          </div>
        </div>

        {/* Filters Panel Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">
              1. Nhóm nhân khẩu / tiêu chí *
            </label>
            <select
              value={detCategory}
              onChange={(e) => setDetCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium cursor-pointer"
            >
              <option value="all">Tất cả nhân khẩu (Toàn bộ)</option>
              <option value="military">Độ tuổi Nghĩa vụ quân sự (Nam, 18-25/27)</option>
              <option value="elderly">Người cao tuổi (≥ 60 tuổi)</option>
              <option value="children">Trẻ em dưới 15 tuổi</option>
              <option value="student">Học sinh & Sinh viên</option>
              <option value="employed">Lao động đang làm việc</option>
              <option value="unemployed">Lao động tự do / Thất nghiệp</option>
              <option value="poor">Cư dân hộ Nghèo / Cận nghèo</option>
              <option value="insurance">Đã đăng ký Bảo hiểm y tế</option>
              <option value="disabled">Người khuyết tật / Trợ cấp xã hội</option>
              <option value="agri">Thành viên thuộc Hộ nông nghiệp (Có)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">
              2. Bộ lọc Giới tính
            </label>
            <select
              value={detGender}
              onChange={(e) => setDetGender(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium cursor-pointer"
            >
              <option value="all">Tất cả giới tính</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">
              3. Khu vực / Tổ
            </label>
            <select
              value={detWard}
              onChange={(e) => setDetWard(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium cursor-pointer"
            >
              <option value="all">Tất cả tổ</option>
              {Array.from({ length: 50 }, (_, i) => `Tổ ${i + 1}`).map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">
              4. Tìm kiếm nhanh (Họ tên / CCCD)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={detSearch}
                onChange={(e) => setDetSearch(e.target.value)}
                placeholder="Nhập tên hoặc số định danh..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Results Counter & Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div className="text-xs text-slate-600 font-medium flex flex-wrap items-center gap-3">
            <span>
              Kết quả rà soát: Tìm thấy{" "}
              <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                {filteredDetailedResidents.length}
              </span>{" "}
              nhân khẩu.
            </span>
            
            {/* Toggle Dạng Bảng / Dạng Thẻ */}
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl border border-slate-300/30">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                Dạng bảng
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Dạng Thẻ (Mobile)
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExportFiltered("xlsx")}
              disabled={filteredDetailedResidents.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Xuất Excel (XLSX)
            </button>
            <button
              onClick={() => handleExportFiltered("pdf")}
              disabled={filteredDetailedResidents.length === 0}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-250 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              In Báo Cáo (PDF)
            </button>
          </div>
        </div>

        {/* Results Container (Table or Card View) */}
        {filteredDetailedResidents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            Không tìm thấy nhân khẩu nào khớp với các bộ lọc hiện tại. Vui lòng thay đổi cấu hình lọc.
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3 text-center">Giới tính</th>
                  <th className="py-3 px-3">Ngày sinh (Tuổi)</th>
                  <th className="py-3 px-3">Số định danh/CCCD</th>
                  <th className="py-3 px-3">Địa bàn cư trú</th>
                  <th className="py-3 px-3 font-medium">Học vấn & Việc làm</th>
                  <th className="py-3 px-3">Thông tin chính sách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filteredDetailedResidents.map((r) => {
                  const age = getAge(r.birthDate);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{r.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Quan hệ: {r.relationToOwner}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.gender === "Nam" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                        }`}>
                          {r.gender}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700">{new Date(r.birthDate).toLocaleDateString("vi-VN")}</span>
                        <span className="text-slate-400 text-[11px] ml-1">({age} tuổi)</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 font-medium">
                        {r.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-700">{r.wardId || "N/A"}</div>
                        <div className="text-[10px] text-slate-400 max-w-[150px] truncate" title={r.permanentAddress}>
                          {r.permanentAddress || "Chưa cập nhật"}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        <div className="text-[11px] font-semibold text-slate-700">
                          {r.isStudent ? "Học sinh/Sinh viên" : (r.occupation || "Nghề nghiệp tự do")}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.education || "Chưa qua đào tạo"}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.insuranceId ? (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold border border-emerald-100">BHYT</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px]">Chưa BHYT</span>
                          )}
                          {r.isDisabled && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-bold border border-rose-100">Khuyết tật</span>
                          )}
                          {r.isPregnant && (
                            <span className="px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded text-[9px] font-bold border border-pink-100">Thai sản</span>
                          )}
                          {r.subsidyType && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-bold border border-purple-100" title={r.subsidyType}>Nhận trợ cấp</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards / Mobile view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDetailedResidents.map((r) => {
              const age = getAge(r.birthDate);
              return (
                <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="font-bold text-slate-850 text-xs sm:text-sm truncate">{r.fullName}</h5>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Quan hệ: {r.relationToOwner}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                        r.gender === "Nam" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                      }`}>
                        {r.gender}
                      </span>
                    </div>

                    {/* Details body */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-500 border-t border-slate-50 pt-2.5">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Ngày sinh (Tuổi)</span>
                        <span className="font-semibold text-slate-700">{new Date(r.birthDate).toLocaleDateString("vi-VN")}</span>
                        <span className="text-slate-400 text-[10px] ml-1">({age}t)</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">CCCD / Số định danh</span>
                        <span className="font-mono font-bold text-slate-700">{r.id || "N/A"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Địa bàn / Thường trú</span>
                        <span className="font-bold text-slate-700 text-xs">{r.wardId || "N/A"}</span>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5" title={r.permanentAddress}>
                          {r.permanentAddress || "Chưa cập nhật"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Học vấn & Việc làm</span>
                        <span className="font-semibold text-slate-700 text-[10px]">
                          {r.isStudent ? "Học sinh/Sinh viên" : (r.occupation || "Nghề nghiệp tự do")}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-1">({r.education || "Chưa đào tạo"})</span>
                      </div>
                    </div>
                  </div>

                  {/* Policy Footer Tags */}
                  <div className="border-t border-slate-50 pt-2">
                    <div className="flex flex-wrap gap-1">
                      {r.insuranceId ? (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold border border-emerald-100">BHYT</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px]">Chưa BHYT</span>
                      )}
                      {r.isDisabled && (
                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-bold border border-rose-100">Khuyết tật</span>
                      )}
                      {r.isPregnant && (
                        <span className="px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded text-[9px] font-bold border border-pink-100">Thai sản</span>
                      )}
                      {r.subsidyType && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-bold border border-purple-100 truncate max-w-[105px]" title={r.subsidyType}>Nhận trợ cấp</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nút Ẩn/Hiện Quản trị Cơ sở Dữ liệu (Chỉ hiển thị cho Trưởng KP & Quản trị viên, Ẩn hoàn toàn đối với CTV nhập liệu) */}
      {userRole !== UserRole.COLLABORATOR && (
        <>
          <div className="flex justify-center pt-6 pb-2">
            <button
              onClick={() => setShowBackupTools(!showBackupTools)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-500" />
              {showBackupTools ? "Ẩn công cụ quản trị & sao lưu" : "Hiện công cụ quản trị & sao lưu"}
            </button>
          </div>

          {/* SECTION: SYSTEM ADMIN BACKUP & RESTORE TOOLS */}
          {showBackupTools && (
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-6 border border-slate-800 mt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm uppercase tracking-wider">
                  Quản trị Cơ sở Dữ liệu: Sao lưu & Khôi phục Hệ thống
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sao lưu dự phòng định kỳ hoặc phục hồi lại toàn bộ hộ dân, nhân khẩu, hộ kinh doanh, biến động khi bị sự cố hoặc xoá trắng hệ thống.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Xuất Bản Sao Lưu */}
            <div className="bg-slate-850/60 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h5 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  1. Xuất bản sao lưu dữ liệu
                </h5>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Tải về máy tính bản sao lưu toàn bộ dữ liệu của tổ dân phố Ninh Phú để lưu trữ dự phòng ngoại tuyến an toàn.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  onClick={onExportJSONBackup}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold text-slate-100 transition-colors cursor-pointer"
                >
                  <FileJson className="w-4 h-4 text-amber-400" />
                  Sao lưu cấu trúc (.JSON)
                </button>
                <button
                  onClick={onExportFullBackup}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                  Sao lưu Excel (.XLSX)
                </button>
              </div>
            </div>

            {/* Card 2: Phục Hồi Dữ Liệu */}
            <div className="bg-slate-850/60 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between lg:col-span-2">
              <div>
                <h5 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-400" />
                  2. Phục hồi dữ liệu từ file sao lưu (.JSON / .XLSX)
                </h5>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Tải lên tệp tin sao lưu <b>(.json hoặc .xlsx)</b> đã tải về trước đó để phục hồi ngay lập tức toàn bộ hệ thống dân cư.
                </p>
              </div>
              
              <div className="pt-2">
                <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <Upload className="w-8 h-8 text-slate-500 mb-2" />
                  <span className="text-xs font-bold text-slate-300">Nhấp để chọn tệp hoặc kéo thả vào đây</span>
                  <span className="text-[10px] text-slate-500 mt-1">Chấp nhận tệp .json cấu trúc hoặc tệp .xlsx nhiều phân hệ</span>
                  <input
                    type="file"
                    accept=".json,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && onRestoreBackup) {
                        onRestoreBackup(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* CẢNH BÁO / XOÁ TRẮNG DỮ LIỆU */}
          <div className="bg-rose-500/5 border border-rose-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-200">Xoá sạch dữ liệu mẫu để nhập dữ liệu thực tế</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Xoá toàn bộ dữ liệu mẫu hiện có trên máy chủ, đưa hệ thống về trạng thái trống hoàn toàn để phục vụ công tác rà soát dân cư thực tế.</p>
              </div>
            </div>
            {onClearAllData && (
              <button
                onClick={() => setIsClearAllModalOpen(true)}
                className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 hover:text-rose-100 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                Xoá sạch dữ liệu hệ thống
              </button>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {/* Reusable Confirmation Modal to completely bypass window.confirm */}
      <ConfirmDeleteModal
        isOpen={isClearAllModalOpen}
        title="Xoá sạch dữ liệu hệ thống"
        description="CẢNH BÁO CỰC KỲ QUAN TRỌNG: Thao tác này sẽ xoá TOÀN BỘ dữ liệu hộ dân, nhân khẩu, biến động dân cư và hộ kinh doanh hiện có trong hệ thống để đưa hệ thống về trạng thái trống hoàn toàn, sẵn sàng cho nhập liệu thực tế. Hành động này không thể hoàn tác!"
        confirmWord="XOÁ SẠCH"
        placeholder="Nhập 'XOÁ SẠCH' để xác nhận hành động"
        onConfirm={() => {
          setIsClearAllModalOpen(false);
          if (onClearAllData) {
            onClearAllData(true);
          }
        }}
        onCancel={() => setIsClearAllModalOpen(false)}
      />

      {/* Spacer to prevent overlapping from the footer on shorter viewports */}
      <div className="h-24 sm:h-32 shrink-0 clear-both" />
    </div>
  );
}
