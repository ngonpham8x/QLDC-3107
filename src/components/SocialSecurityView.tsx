/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Heart, GraduationCap, Briefcase, Award, Search, 
  Plus, Check, HelpCircle, FileText, MapPin, Users, Download, Printer,
  Table, LayoutGrid, X, Eye
} from "lucide-react";
import { Resident, LaborSector, EducationLevel, Household } from "../types";

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Chưa cập nhật";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const getBHYTExpiryStatus = (expiryDateStr?: string) => {
  if (!expiryDateStr) {
    return { 
      label: "Chưa cập nhật", 
      color: "text-slate-400 bg-slate-50 border border-slate-200", 
      isAboutToExpire: false, 
      isExpired: false 
    };
  }
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) {
    return { 
      label: "Không hợp lệ", 
      color: "text-slate-400 bg-slate-50 border border-slate-200", 
      isAboutToExpire: false, 
      isExpired: false 
    };
  }
  
  // Use local current date for comparison (June 28, 2026)
  const today = new Date("2026-06-28");
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { 
      label: "Hết hạn", 
      color: "text-rose-700 bg-rose-50 border border-rose-200 font-bold", 
      isAboutToExpire: false, 
      isExpired: true, 
      days: diffDays 
    };
  } else if (diffDays <= 190) { // Under 190 days is about to expire
    return { 
      label: `Sắp hết hạn (${diffDays} ngày)`, 
      color: "text-amber-700 bg-amber-50 border border-amber-200 font-bold animate-pulse", 
      isAboutToExpire: true, 
      isExpired: false, 
      days: diffDays 
    };
  } else {
    return { 
      label: "Còn hạn", 
      color: "text-emerald-700 bg-emerald-50 border border-emerald-100 font-semibold", 
      isAboutToExpire: false, 
      isExpired: false, 
      days: diffDays 
    };
  }
};

interface SocialSecurityViewProps {
  residents: Resident[];
  households: Household[];
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
}

export default function SocialSecurityView({ residents, households, onExport }: SocialSecurityViewProps) {
  const [activeTab, setActiveTab] = useState<"health" | "education" | "labor" | "welfare">("health");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  React.useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setViewMode("cards");
      } else {
        setViewMode("table");
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const activeResidents = residents.filter(r => r.occupation !== "Đã qua đời");

  // Health Stats
  const hasBHYT = activeResidents.filter(r => r.insuranceId);
  const noBHYT = activeResidents.filter(r => !r.insuranceId);
  const disabled = activeResidents.filter(r => r.isDisabled);
  const pregnant = activeResidents.filter(r => r.isPregnant);

  // Education Stats
  const students = activeResidents.filter(r => r.isStudent);
  const mamNon = students.filter(r => r.studentType === "Mầm non");
  const tieuHoc = students.filter(r => r.studentType === "Tiểu học");
  const thcs = students.filter(r => r.studentType === "THCS");
  const thpt = students.filter(r => r.studentType === "THPT");
  const sinhVien = students.filter(r => r.studentType === "Sinh viên");
  const boHoc = activeResidents.filter(r => r.isStudent && r.studentType === "Bỏ học");

  // Labor Stats
  const workingAge = activeResidents.filter(r => {
    const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
    return age >= 15 && age < 60;
  });
  const employed = workingAge.filter(r => r.isEmployed);
  const unemployed = workingAge.filter(r => !r.isEmployed);
  const exportLabor = activeResidents.filter(r => r.isExportLabor);

  // Welfare Stats
  const elderly = activeResidents.filter(r => r.isElderly);
  const subsidies = activeResidents.filter(r => r.subsidyType);

  // Filter residents list for current view
  const getFilteredList = () => {
    let list: Resident[] = [];
    if (activeTab === "health") {
      list = activeResidents.filter(r => !r.insuranceId || r.isDisabled || r.isPregnant || (r.insuranceExpiryDate && (getBHYTExpiryStatus(r.insuranceExpiryDate).isAboutToExpire || getBHYTExpiryStatus(r.insuranceExpiryDate).isExpired)));
    } else if (activeTab === "education") {
      list = students;
    } else if (activeTab === "labor") {
      list = workingAge;
    } else if (activeTab === "welfare") {
      list = activeResidents.filter(r => r.isElderly || r.isDisabled || r.subsidyType);
    }

    if (query) {
      list = list.filter(r => r.fullName.toLowerCase().includes(query.toLowerCase()) || r.id.includes(query));
    }
    return list;
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    
    let title = "";
    let headers: string[] = ["STT", "Họ tên", "Tuổi", "QH Chủ Hộ", "Mã Hộ"];
    let rows: any[][] = [];

    const list = getFilteredList();

    if (activeTab === "health") {
      title = "Báo cáo An sinh Sức khỏe Y tế";
      headers.push("Bảo hiểm Y tế", "Hạn thẻ BHYT", "Trạng thái hạn thẻ", "Ưu tiên sức khoẻ");
      rows = list.map((r, idx) => {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        const expiryStatus = getBHYTExpiryStatus(r.insuranceExpiryDate);
        return [
          idx + 1,
          r.fullName,
          `${age} tuổi`,
          r.relationToOwner,
          r.householdId,
          r.insuranceId || "Chưa cập nhật BHYT",
          r.insuranceExpiryDate ? formatDate(r.insuranceExpiryDate) : "N/A",
          expiryStatus.label,
          r.isDisabled ? "Người khuyết tật" : (r.isPregnant ? "Mang thai" : "Diện theo dõi BHYT")
        ];
      });
    } else if (activeTab === "education") {
      title = "Báo cáo Giáo dục Phổ cập";
      headers.push("Cấp học", "Trạng thái");
      rows = list.map((r, idx) => {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        return [
          idx + 1,
          r.fullName,
          `${age} tuổi`,
          r.relationToOwner,
          r.householdId,
          r.studentType || "N/A",
          r.isStudent ? "Có đi học" : "Không đi học"
        ];
      });
    } else if (activeTab === "labor") {
      title = "Báo cáo Lao động Việc làm";
      headers.push("Tình trạng Việc làm", "Lĩnh vực Lao động");
      rows = list.map((r, idx) => {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        return [
          idx + 1,
          r.fullName,
          `${age} tuổi`,
          r.relationToOwner,
          r.householdId,
          r.isEmployed ? "Đang có việc làm" : "Thất nghiệp/Chưa có việc",
          r.laborSector
        ];
      });
    } else {
      title = "Báo cáo Cứu trợ Bảo trợ Xã hội";
      headers.push("Diện hỗ trợ", "Trợ cấp tháng");
      rows = list.map((r, idx) => {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        return [
          idx + 1,
          r.fullName,
          `${age} tuổi`,
          r.relationToOwner,
          r.householdId,
          r.subsidyType || "Người già / Cần theo dõi",
          r.subsidyAmount ? `${r.subsidyAmount.toLocaleString("vi-VN")} đ` : "0 đ"
        ];
      });
    }

    onExport(type, title, headers, rows);
  };

  return (
    <div id="social-security-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-600" />
            Chương trình An sinh & Phát triển Cộng đồng
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Hệ thống giám sát tiêu chí y tế, giáo dục phổ cập, lực lượng lao động và trợ giúp xã hội
          </p>
        </div>

        {/* Global actions */}
        {onExport && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleExport("xlsx")}
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
              title="Xuất dữ liệu an sinh tab hiện tại sang Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất Excel
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
              title="Xuất bản in báo cáo PDF an sinh"
            >
              <Printer className="w-3.5 h-3.5" />
              Xuất PDF (In)
            </button>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto shrink-0">
        {[
          { id: "health", label: "Chăm sóc Y tế (BHYT)", icon: <Heart className="w-4 h-4" /> },
          { id: "education", label: "Giáo dục & Trường lớp", icon: <GraduationCap className="w-4 h-4" /> },
          { id: "labor", label: "Lao động & Việc làm", icon: <Briefcase className="w-4 h-4" /> },
          { id: "welfare", label: "Cứu trợ xã hội (BHXH)", icon: <Award className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-white text-emerald-700 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid summarizing core metrics based on tab */}
      {activeTab === "health" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <h4 className="text-emerald-800 font-bold text-xs uppercase tracking-wider">Đã có thẻ BHYT</h4>
            <p className="text-3xl font-bold text-emerald-950 mt-1">{hasBHYT.length} người</p>
            <p className="text-[10px] text-emerald-700 mt-1">Chiếm {activeResidents.length > 0 ? ((hasBHYT.length / activeResidents.length) * 100).toFixed(1) : 0}% dân số tổ dân phố</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
            <h4 className="text-rose-800 font-bold text-xs uppercase tracking-wider">Chưa tham gia BHYT</h4>
            <p className="text-3xl font-bold text-rose-950 mt-1">{noBHYT.length} người</p>
            <p className="text-[10px] text-rose-700 mt-1">Cần cán bộ vận động tham gia BHYT hộ gia đình</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <h4 className="text-blue-800 font-bold text-xs uppercase tracking-wider">Phụ nữ mang thai & Khuyết tật</h4>
            <p className="text-3xl font-bold text-blue-950 mt-1">{disabled.length + pregnant.length} người</p>
            <p className="text-[10px] text-blue-700 mt-1">Hưởng dịch vụ chăm sóc y tế tại trạm y tế phường miễn phí</p>
          </div>
        </div>
      )}

      {activeTab === "health" && (
        (() => {
          const expiringBHYTResidents = activeResidents.filter(r => {
            if (!r.insuranceId || !r.insuranceExpiryDate) return false;
            const status = getBHYTExpiryStatus(r.insuranceExpiryDate);
            return status.isAboutToExpire || status.isExpired;
          });
          if (expiringBHYTResidents.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mt-4">
              <h5 className="text-amber-800 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Danh sách thẻ BHYT sắp hết hạn / đã hết hạn ({expiringBHYTResidents.length} người)
              </h5>
              <p className="text-[10.5px] text-amber-600 mt-0.5">
                Cán bộ cần liên hệ nhắc nhở hoặc hỗ trợ làm thủ tục gia hạn để đảm bảo quyền lợi khám chữa bệnh của người dân.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {expiringBHYTResidents.map(r => {
                  const status = getBHYTExpiryStatus(r.insuranceExpiryDate);
                  return (
                    <div key={r.id} className="bg-white p-3 rounded-xl border border-amber-100 flex flex-col justify-between text-xs shadow-xs">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{r.fullName}</p>
                        <p className="text-slate-500 mt-1">Mã thẻ: <span className="font-mono font-semibold text-slate-700">{r.insuranceId}</span></p>
                        <p className="text-slate-500">Ngày hết hạn: <span className="font-mono text-slate-700">{formatDate(r.insuranceExpiryDate)}</span></p>
                      </div>
                      <span className={`mt-2.5 px-2 py-1 rounded-lg text-center text-[10px] ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}

      {activeTab === "education" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
            <p className="text-xs text-slate-500 font-semibold">Trẻ mầm non</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{mamNon.length} cháu</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
            <p className="text-xs text-slate-500 font-semibold">Tiểu học & THCS</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{tieuHoc.length + thcs.length} học sinh</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
            <p className="text-xs text-slate-500 font-semibold">Học sinh THPT</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{thpt.length} học sinh</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
            <p className="text-xs text-slate-500 font-semibold">Sinh viên ĐH/CĐ</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{sinhVien.length} sinh viên</p>
          </div>
        </div>
      )}

      {activeTab === "labor" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <h4 className="text-emerald-800 font-bold text-xs uppercase tracking-wider">Lao động đang có việc làm</h4>
            <p className="text-3xl font-bold text-emerald-950 mt-1">{employed.length} người</p>
            <p className="text-[10px] text-emerald-700 mt-1">Tỷ lệ {workingAge.length > 0 ? ((employed.length / workingAge.length) * 100).toFixed(1) : 0}% tổng số lao động trong tuổi</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <h4 className="text-amber-800 font-bold text-xs uppercase tracking-wider">Đang thất nghiệp / Tự do</h4>
            <p className="text-3xl font-bold text-amber-950 mt-1">{unemployed.length} người</p>
            <p className="text-[10px] text-amber-700 mt-1">Cần trung tâm giới thiệu việc làm hỗ trợ</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <h4 className="text-blue-800 font-bold text-xs uppercase tracking-wider">Lao động xuất khẩu</h4>
            <p className="text-3xl font-bold text-blue-950 mt-1">{exportLabor.length} người</p>
            <p className="text-[10px] text-blue-700 mt-1">Đang làm việc tại Nhật Bản, Hàn Quốc, Đài Loan...</p>
          </div>
        </div>
      )}

      {activeTab === "welfare" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
            <h4 className="text-purple-800 font-bold text-xs uppercase tracking-wider">Người cao tuổi (&gt;60)</h4>
            <p className="text-3xl font-bold text-purple-950 mt-1">{elderly.length} cụ</p>
            <p className="text-[10px] text-purple-700 mt-1">Tất cả đều được hỗ trợ chăm sóc người già định kỳ</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <h4 className="text-emerald-800 font-bold text-xs uppercase tracking-wider">Đang nhận trợ cấp chính quyền</h4>
            <p className="text-3xl font-bold text-emerald-950 mt-1">{subsidies.length} cư dân</p>
            <p className="text-[10px] text-emerald-700 mt-1">Cứu trợ chất độc da cam, liệt sĩ, thương binh, nghèo khó</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
            <h4 className="text-rose-800 font-bold text-xs uppercase tracking-wider">Ngân sách trợ cấp hàng tháng</h4>
            <p className="text-3xl font-bold text-rose-950 mt-1">
              {subsidies.reduce((sum, r) => sum + (r.subsidyAmount || 0), 0).toLocaleString("vi-VN")} đ
            </p>
            <p className="text-[10px] text-rose-700 mt-1">Chi trả trực tiếp qua Kho bạc Nhà nước Việt Nam</p>
          </div>
        </div>
      )}

      {/* Target search list for focused oversight */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <h4 className="font-bold text-xs uppercase text-slate-600 tracking-wider">
            {activeTab === "health" && "Danh sách nhân khẩu cần rà soát Bảo hiểm Y tế / Chăm sóc"}
            {activeTab === "education" && "Danh sách Học sinh & Sinh viên đang đi học"}
            {activeTab === "labor" && "Lực lượng lao động trong độ tuổi 15 - 59"}
            {activeTab === "welfare" && "Danh sách cư dân diện hưởng chính sách xã hội / Người già"}
          </h4>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Toggle Dạng Bảng / Dạng Thẻ */}
            <div className="flex items-center bg-slate-200/50 p-0.5 rounded-lg border border-slate-300/30">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                Dạng bảng
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Dạng Thẻ (Mobile)
              </button>
            </div>

            <div className="relative sm:w-64 w-full">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Lọc danh sách theo tên..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-emerald-600"
              />
            </div>
          </div>
        </div>

        {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Họ và Tên</th>
                  <th className="px-4 py-2.5">Tuổi</th>
                  <th className="px-4 py-2.5">Quan Hệ Chủ Hộ</th>
                  <th className="px-4 py-2.5">Mã Hộ Gia Đình</th>
                  
                  {activeTab === "health" && (
                    <>
                      <th className="px-4 py-2.5">Bảo hiểm Y tế</th>
                      <th className="px-4 py-2.5">Hạn thẻ BHYT</th>
                      <th className="px-4 py-2.5">Trạng thái hạn thẻ</th>
                      <th className="px-4 py-2.5">Ưu tiên sức khoẻ</th>
                    </>
                  )}
                  {activeTab === "education" && (
                    <>
                      <th className="px-4 py-2.5">Cấp học</th>
                      <th className="px-4 py-2.5">Cơ sở đào tạo</th>
                    </>
                  )}
                  {activeTab === "labor" && (
                    <>
                      <th className="px-4 py-2.5">Việc làm</th>
                      <th className="px-4 py-2.5">Ngành nghề kỹ năng</th>
                    </>
                  )}
                  {activeTab === "welfare" && (
                    <>
                      <th className="px-4 py-2.5">Diện hỗ trợ</th>
                      <th className="px-4 py-2.5">Mức trợ cấp tháng</th>
                    </>
                  )}
                  <th className="px-4 py-2.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {getFilteredList().map((r) => {
                  const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">{r.fullName}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{age} tuổi</td>
                      <td className="px-4 py-3 text-slate-500">{r.relationToOwner}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                          {r.householdId}
                        </span>
                      </td>

                      {activeTab === "health" && (
                        <>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {r.insuranceId ? (
                              <span className="text-emerald-700 font-semibold">{r.insuranceId}</span>
                            ) : (
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Chưa cập nhật</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {r.insuranceExpiryDate ? formatDate(r.insuranceExpiryDate) : "N/A"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${getBHYTExpiryStatus(r.insuranceExpiryDate).color}`}>
                              {getBHYTExpiryStatus(r.insuranceExpiryDate).label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.isDisabled && <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-[10px]">Người khuyết tật</span>}
                            {r.isPregnant && <span className="bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded text-[10px] ml-1">Mang thai</span>}
                            {!r.isDisabled && !r.isPregnant && <span className="text-slate-400">Diện theo dõi BHYT</span>}
                          </td>
                        </>
                      )}

                      {activeTab === "education" && (
                        <>
                          <td className="px-4 py-3">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                              {r.studentType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{r.workplace || "Trường học địa phương"}</td>
                        </>
                      )}

                      {activeTab === "labor" && (
                        <>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              r.isEmployed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {r.isEmployed ? "Có việc làm" : "Thất nghiệp"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {r.occupation} {r.isExportLabor && <span className="bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-bold">Lao động XK</span>}
                          </td>
                        </>
                      )}

                      {activeTab === "welfare" && (
                        <>
                          <td className="px-4 py-3 font-medium">
                            {r.subsidyType ? (
                              <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-bold">{r.subsidyType}</span>
                            ) : r.isElderly ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Người cao tuổi (&gt;60)</span>
                            ) : (
                              <span className="text-slate-400">Chưa xếp diện trợ cấp</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">
                            {r.subsidyAmount ? `${r.subsidyAmount.toLocaleString("vi-VN")} đ` : "-"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedResident(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors text-[10px] font-bold cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {getFilteredList().length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-400">
                      Không tìm thấy dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards / Mobile view */
          <div className="p-4 bg-slate-50/20 border-t border-slate-100">
            {getFilteredList().length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                Không tìm thấy nhân khẩu rà soát nào khớp.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredList().map((r) => {
                  const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
                  return (
                    <div 
                      key={r.id} 
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h5 className="font-bold text-slate-800 text-xs sm:text-sm truncate">{r.fullName}</h5>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Quan hệ: {r.relationToOwner}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                            r.gender === "Nam" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-pink-50 text-pink-600 border border-pink-100"
                          }`}>
                            {r.gender || "Nam"}
                          </span>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Mã hộ gia đình</span>
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                              {r.householdId}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Tuổi / Số định danh</span>
                            <span className="font-semibold text-slate-700">{age} tuổi</span>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">{r.id}</p>
                          </div>

                          {/* Conditional Details based on Tab */}
                          {activeTab === "health" && (
                            <>
                              <div className="col-span-2 border-t border-slate-50 pt-1.5">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Bảo hiểm Y tế</span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {r.insuranceId ? (
                                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-100">
                                      {r.insuranceId}
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px] border border-rose-100">
                                      Chưa cập nhật
                                    </span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getBHYTExpiryStatus(r.insuranceExpiryDate).color}`}>
                                    {getBHYTExpiryStatus(r.insuranceExpiryDate).label}
                                  </span>
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Thời hạn thẻ BHYT</span>
                                <span className="font-semibold text-slate-700 font-mono">
                                  {r.insuranceExpiryDate ? formatDate(r.insuranceExpiryDate) : "N/A"}
                                </span>
                              </div>
                            </>
                          )}

                          {activeTab === "education" && (
                            <>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Cấp học / Diện học</span>
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                                  {r.studentType || "Học sinh"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Cơ sở đào tạo</span>
                                <span className="font-medium text-slate-700">
                                  {r.workplace || "Trường học địa phương"}
                                </span>
                              </div>
                            </>
                          )}

                          {activeTab === "labor" && (
                            <>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Việc làm</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  r.isEmployed 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border-rose-100"
                                }`}>
                                  {r.isEmployed ? "Có việc làm" : "Thất nghiệp"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Nghề nghiệp / Kỹ năng</span>
                                <span className="font-medium text-slate-700 text-[11px] block truncate" title={r.occupation}>
                                  {r.occupation || "Tự do"}
                                </span>
                                {r.isExportLabor && (
                                  <span className="inline-block mt-1 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold text-[9px] border border-indigo-100">
                                    Lao động XK
                                  </span>
                                )}
                              </div>
                            </>
                          )}

                          {activeTab === "welfare" && (
                            <>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Diện hỗ trợ xã hội</span>
                                {r.subsidyType ? (
                                  <span className="inline-block text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-purple-100">
                                    {r.subsidyType}
                                  </span>
                                ) : r.isElderly ? (
                                  <span className="inline-block text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-150">
                                    Người cao tuổi (&gt;60)
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Chưa xếp diện trợ cấp</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Trợ cấp hàng tháng</span>
                                <span className="font-mono font-bold text-slate-800 text-xs">
                                  {r.subsidyAmount ? `${r.subsidyAmount.toLocaleString("vi-VN")} đ` : "-"}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Policy / Care Badges & Detail Button for Mobile Cards */}
                      <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {r.isDisabled && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-100">
                              Khuyết tật
                            </span>
                          )}
                          {r.isPregnant && (
                            <span className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded text-[9px] font-bold border border-pink-100">
                              Mang thai
                            </span>
                          )}
                          {r.isStudent && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-100">
                              Học sinh
                            </span>
                          )}
                          {!r.isDisabled && !r.isPregnant && !r.isStudent && (
                            <span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[9px] border border-slate-150">
                              An sinh xã hội
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedResident(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors text-[10px] font-bold cursor-pointer shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" /> Chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL MODAL CARD */}
      {selectedResident && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-base">HỒ SƠ CÁ NHÂN: {selectedResident.fullName}</h3>
                  <p className="text-xs text-emerald-200 flex items-center gap-2">
                    <span>Mã định danh/CCCD: {selectedResident.id}</span>
                    <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold text-white">
                      {(households.find(h => h.id === selectedResident.householdId)?.wardId) || "Tổ 1"}
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedResident(null)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 flex-1 scrollbar-thin">
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
                  <p className="text-sm font-medium text-slate-800 mt-1">{selectedResident.ethnicity || "Kinh"} • {selectedResident.religion || "Không"}</p>
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
                  <p className="font-semibold text-slate-800">{selectedResident.education || "Không có"}</p>
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
    </div>
  );
}
