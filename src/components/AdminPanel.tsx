import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, FileText, Database, RefreshCw, Download, Upload, 
  Trash2, Search, ArrowLeftRight, Clock, UserCheck, AlertTriangle, 
  Shield, Check, UserMinus, Plus, Server, Cloud, Cpu, Sparkles, CheckCircle, XCircle, HelpCircle
} from "lucide-react";
import { User, UserRole, AuditLog } from "../types";
import AllowedEmailsView from "./AllowedEmailsView";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

interface AdminPanelProps {
  currentUser: User | null;
  onRefreshData: () => Promise<void>;
  onGenerateMockData: () => Promise<void>;
  onClearMockData: (bypassConfirm?: boolean) => Promise<void>;
  onRestoreBackup: (file: File) => Promise<void>;
  onExportBackup: () => void;
  isMobile: boolean;
}

export default function AdminPanel({
  currentUser,
  onRefreshData,
  onGenerateMockData,
  onClearMockData,
  onRestoreBackup,
  onExportBackup,
  isMobile
}: AdminPanelProps) {
  const [adminTab, setAdminTab] = useState<"permissions" | "logs" | "database" | "maintenance">("permissions");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Logs States
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [logPage, setLogPage] = useState(1);
  const itemsPerPage = 15;

  // Database Status & Sync States
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<"pull" | "push" | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [viewingSchema, setViewingSchema] = useState<string | null>(null);

  // File upload refs for full restore and demographic-only synchronization.
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const demographicsFileInputRef = React.useRef<HTMLInputElement>(null);

  // Simple confirmation modal state
  const [simpleConfirm, setSimpleConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Simple alert modal state
  const [localAlert, setLocalAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch("/api/logs");
      if (res.ok) {
        const ct = res.headers.get("content-type");
        if (ct && ct.includes("application/json")) {
          const data = await res.json();
          setLogs(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchDbStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch("/api/data/supabase-status");
      if (res.ok) {
        const ct = res.headers.get("content-type");
        if (ct && ct.includes("application/json")) {
          const data = await res.json();
          setDbStatus(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch database status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (adminTab === "logs") {
      fetchLogs();
    } else if (adminTab === "database") {
      fetchDbStatus();
    }
  }, [adminTab]);

  const handleSync = async (direction: "pull" | "push") => {
    // If not connected to Supabase, we run in simulated demo mode to give a great experience
    if (!dbStatus?.connected) {
      const demoConfirmMsg = direction === "pull"
        ? "Hệ thống hiện đang chạy ở chế độ ngoại tuyến / Demo (chưa liên kết Supabase). Bạn có muốn chạy đồng bộ GIẢ LẬP để kéo dữ liệu mẫu từ Cloud ảo không?"
        : "Hệ thống hiện đang chạy ở chế độ ngoại tuyến / Demo (chưa liên kết Supabase). Bạn có muốn chạy đồng bộ GIẢ LẬP để đẩy dữ liệu hiện tại lên Cloud ảo không?";
        
      setSimpleConfirm({
        isOpen: true,
        title: direction === "pull" ? "Đồng bộ Tải xuống Giả lập (PULL DEMO)" : "Đồng bộ Đẩy lên Giả lập (PUSH DEMO)",
        message: demoConfirmMsg,
        confirmText: "Bắt đầu Đồng bộ ảo",
        cancelText: "Hủy bỏ",
        onConfirm: async () => {
          setSimpleConfirm(null);
          try {
            setSyncing(true);
            setSyncDirection(direction);
            setSyncMessage(direction === "pull" ? "Đang tải dữ liệu từ Cloud ảo..." : "Đang ghi đè lên Cloud ảo...");
            
            // Wait for 1.2s to simulate network request
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            if (direction === "pull") {
              await onGenerateMockData();
              setLocalAlert({
                isOpen: true,
                title: "Đồng bộ thành công (Demo)",
                message: "Hệ thống đã kéo dữ liệu từ đám mây ảo về máy chủ và lưu trữ thành công (25 hộ dân, 105 nhân khẩu mẫu).",
                type: "success"
              });
            } else {
              setLocalAlert({
                isOpen: true,
                title: "Đồng bộ thành công (Demo)",
                message: "Đã đồng bộ đẩy toàn bộ dữ liệu máy chủ lên cơ sở dữ liệu đám mây ảo thành công!",
                type: "success"
              });
            }
            setSyncMessage("Đồng bộ ảo thành công!");
            fetchDbStatus();
            onRefreshData();
          } catch (err: any) {
            setLocalAlert({
              isOpen: true,
              title: "Lỗi đồng bộ ảo",
              message: err.message,
              type: "error"
            });
          } finally {
            setSyncing(false);
            setSyncDirection(null);
          }
        }
      });
      return;
    }

    const confirmMsg = direction === "pull"
      ? "Cảnh báo bảo mật tối cao:\nBạn đang yêu cầu tải và đồng bộ toàn bộ dữ liệu từ Supabase về máy chủ. Hành động này sẽ ghi đè và thay thế hoàn toàn bộ nhớ cache cục bộ.\n\nBạn có muốn tiếp tục?"
      : "Cảnh báo bảo mật tối cao:\nBạn đang yêu cầu đồng bộ dữ liệu hiện có lên Supabase. Bản ghi mới sẽ được lưu trước; chỉ các bản ghi không còn ở máy chủ mới bị loại bỏ sau khi lưu thành công.\n\nBạn có muốn tiếp tục?";
    
    setSimpleConfirm({
      isOpen: true,
      title: direction === "pull" ? "Đồng bộ Tải xuống (PULL)" : "Đồng bộ Đẩy lên (PUSH)",
      message: confirmMsg,
      confirmText: "Xác nhận Đồng bộ",
      cancelText: "Hủy bỏ",
      onConfirm: async () => {
        setSimpleConfirm(null);
        try {
          setSyncing(true);
          setSyncDirection(direction);
          setSyncMessage(direction === "pull" ? "Đang kéo dữ liệu từ Supabase..." : "Đang tải dữ liệu cục bộ lên Supabase...");
          
          const res = await fetch(`/api/data/supabase-sync?user=${encodeURIComponent(currentUser?.fullName || "Admin")}&role=${currentUser?.role || "SUPER_ADMIN"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ direction })
          });

          const result = await res.json();
          if (res.ok && result.success) {
            setLocalAlert({
              isOpen: true,
              title: "Đồng bộ thành công",
              message: result.message || "Toàn bộ dữ liệu đã được đồng bộ hóa thành công!",
              type: "success"
            });
            setSyncMessage("Đồng bộ thành công!");
            fetchDbStatus();
            onRefreshData();
          } else {
            setLocalAlert({
              isOpen: true,
              title: "Lỗi đồng bộ",
              message: result.error || "Không xác định",
              type: "error"
            });
            setSyncMessage(`Thất bại: ${result.error || "Lỗi bất định"}`);
          }
        } catch (err: any) {
          setLocalAlert({
            isOpen: true,
            title: "Đồng bộ thất bại",
            message: err.message,
            type: "error"
          });
          setSyncMessage(`Lỗi kết nối: ${err.message}`);
        } finally {
          setSyncing(false);
          setSyncDirection(null);
        }
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSimpleConfirm({
        isOpen: true,
        title: "Khôi phục cơ sở dữ liệu",
        message: `Bạn có chắc chắn muốn khôi phục cơ sở dữ liệu từ tệp tin "${file.name}"? Dữ liệu hiện tại trên máy chủ sẽ bị thay thế hoàn toàn.`,
        confirmText: "Xác nhận Khôi phục",
        cancelText: "Hủy bỏ",
        onConfirm: async () => {
          setSimpleConfirm(null);
          try {
            await onRestoreBackup(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
            fetchDbStatus();
            setLocalAlert({
              isOpen: true,
              title: "Khôi phục thành công",
              message: `Dữ liệu từ tệp tin "${file.name}" đã được khôi phục thành công vào hệ thống!`,
              type: "success"
            });
          } catch (err: any) {
            console.error("Lỗi khôi phục dữ liệu:", err);
            setLocalAlert({
              isOpen: true,
              title: "Khôi phục thất bại",
              message: err.message || "Đã xảy ra lỗi khi khôi phục dữ liệu.",
              type: "error"
            });
          }
        }
      });
    }
  };

  const handleDemographicsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSimpleConfirm({
      isOpen: true,
      title: "Đồng bộ Hộ dân và Nhân khẩu",
      message: `Đồng bộ riêng Hộ dân và Nhân khẩu từ tệp "${file.name}" lên Supabase? Dữ liệu cán bộ, tài liệu, hộ kinh doanh và các mục khác không bị thay đổi.`,
      confirmText: "Đồng bộ lên Supabase",
      cancelText: "Hủy bỏ",
      onConfirm: async () => {
        setSimpleConfirm(null);
        try {
          setSyncing(true);
          setSyncMessage("Đang xác minh và đồng bộ hộ dân, nhân khẩu lên Supabase...");
          const backup = JSON.parse(await file.text());
          const res = await fetch(`/api/data/sync-demographics?user=${encodeURIComponent(currentUser?.fullName || "Admin")}&role=${currentUser?.role || "SUPER_ADMIN"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backup),
          });
          const result = await res.json();
          if (!res.ok || !result.success) {
            throw new Error(result.error || "Không thể đồng bộ dữ liệu dân cư.");
          }

          await onRefreshData();
          fetchDbStatus();
          setSyncMessage("Đồng bộ hộ dân và nhân khẩu thành công.");
          setLocalAlert({
            isOpen: true,
            title: "Đồng bộ thành công",
            message: `Đã đồng bộ ${result.householdsCount} hộ dân và ${result.residentsCount} nhân khẩu lên Supabase. Các dữ liệu khác không thay đổi.`,
            type: "success",
          });
        } catch (err: any) {
          setSyncMessage(`Đồng bộ thất bại: ${err.message || "Lỗi không xác định"}`);
          setLocalAlert({
            isOpen: true,
            title: "Không thể đồng bộ",
            message: err.message || "Không thể đọc hoặc xác minh tệp dữ liệu.",
            type: "error",
          });
        } finally {
          setSyncing(false);
          if (demographicsFileInputRef.current) demographicsFileInputRef.current.value = "";
        }
      },
    });
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Log filtering & pagination
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.userName || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.userId || "").toLowerCase().includes(logSearch.toLowerCase());
    
    const matchesRole = roleFilter === "all" || log.userRole === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((logPage - 1) * itemsPerPage, logPage * itemsPerPage);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    } catch {
      return isoStr;
    }
  };

  const schemaDetails: { [key: string]: { title: string, desc: string, fields: string[] } } = {
    households: {
      title: "Household (Sơ đồ Hộ gia đình)",
      desc: "Lưu trữ toàn bộ thông tin về hộ dân, địa chỉ, nước sạch, rác thải, hộ nghèo và thông tin chủ hộ.",
      fields: ["id", "ownerName", "address", "wardId", "phone", "hasCleanWater", "wasteStatus", "isPoor", "isAgri"]
    },
    residents: {
      title: "Resident (Sơ đồ Nhân khẩu)",
      desc: "Lưu trữ thông tin chi tiết từng thành viên trong gia đình: CCCD, nghề nghiệp, BHYT, thai sản, trợ cấp, học vấn.",
      fields: ["id", "fullName", "cccd", "birthDate", "gender", "relationToOwner", "education", "occupation", "hasHealthInsurance", "isDisabled", "isPregnant"]
    },
    changes: {
      title: "DemographicsChange (Sơ đồ Biến động)",
      desc: "Ghi nhận lịch sử di biến động nhân khẩu như: khai tử, khai sinh, tạm trú, tạm vắng, chuyển đi, chuyển đến.",
      fields: ["id", "residentId", "residentName", "type", "date", "reason", "approvedBy"]
    },
    businesses: {
      title: "BusinessHousehold (Sơ đồ Hộ kinh doanh)",
      desc: "Quản lý cơ sở kinh doanh cá thể hoạt động trong khu vực tổ dân phố/khu phố Ninh Phú.",
      fields: ["id", "name", "ownerName", "businessType", "taxCode", "revenueClass"]
    },
    criteria: {
      title: "RuralCriteria (Sơ đồ Tiêu chí Văn minh)",
      desc: "Đánh giá chất lượng cuộc sống, văn minh đô thị và các mục tiêu tự động quét dữ liệu.",
      fields: ["id", "name", "status", "value", "targetValue", "category", "lastUpdated"]
    },
    logs: {
      title: "AuditLog (Sơ đồ Nhật ký)",
      desc: "Lịch sử ghi lại hoạt động thao tác hệ thống thời gian thực để ngăn chặn và giám sát hành vi phá hoại.",
      fields: ["id", "timestamp", "userId", "userName", "userRole", "action", "details"]
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" id="admin-panel-container">
      {/* Admin Panel Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-black tracking-tight">CỔNG ĐIỀU HÀNH TRUNG ƯƠNG</h2>
          <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
            Nơi phân quyền tài khoản truy cập, giám sát toàn bộ hoạt động của cán bộ khu phố thời gian thực và quản lý dữ liệu sao lưu dự phòng.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shrink-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs">
            Admin
          </div>
          <div>
            <p className="text-xs font-bold text-white">{currentUser?.fullName || "Người quản lý"}</p>
            <p className="text-[10px] text-emerald-400 font-bold font-mono">Quản trị hệ thống</p>
          </div>
        </div>
      </div>

      {/* Admin Tab Switching */}
      <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setAdminTab("permissions")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "permissions"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Cấp quyền truy cập
        </button>
        <button
          onClick={() => setAdminTab("logs")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "logs"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" /> Nhật ký hệ thống
        </button>
        <button
          onClick={() => setAdminTab("database")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "database"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Database className="w-4 h-4" /> Cơ sở dữ liệu Cloud
        </button>
        <button
          onClick={() => setAdminTab("maintenance")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "maintenance"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <RefreshCw className="w-4 h-4" /> Bảo trì & Khởi tạo
        </button>
      </div>

      {/* Admin Tab Contents */}
      <div className="mt-4">
        {/* TAB 1: ALLOWED EMAILS */}
        {adminTab === "permissions" && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <AllowedEmailsView />
          </div>
        )}

        {/* TAB 2: AUDIT LOGS */}
        {adminTab === "logs" && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs p-6 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Nhật ký sự kiện thời gian thực</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Giám sát các hành động đăng nhập, cập nhật, xóa sửa dữ liệu của các tài khoản.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors cursor-pointer"
                  title="Tải lại nhật ký"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Filter and Search Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm cán bộ, thao tác, chi tiết..."
                  value={logSearch}
                  onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setLogPage(1); }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Tất cả vai trò cán bộ</option>
                  <option value={UserRole.SUPER_ADMIN}>Cán bộ Quản trị tối cao</option>
                  <option value={UserRole.WARD_LEADER}>Trưởng Khu phố / Tổ dân phố</option>
                  <option value={UserRole.COLLABORATOR}>Cộng tác viên điều tra</option>
                </select>
              </div>

              <div className="flex items-center justify-end text-[11px] text-slate-500 font-bold">
                Tìm thấy {filteredLogs.length} dòng nhật ký
              </div>
            </div>

            {/* Logs Table */}
            <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Cán bộ thực hiện</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3">Hành động</th>
                      <th className="px-4 py-3">Mô tả chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 bg-white">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            <span>Đang tải nhật ký từ máy chủ...</span>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Không tìm thấy nhật ký hoạt động nào khớp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => {
                        const isSuperAdmin = log.userRole === UserRole.SUPER_ADMIN;
                        const isWardLeader = log.userRole === UserRole.WARD_LEADER;
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-[11px] font-mono font-semibold text-slate-500 whitespace-nowrap">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {log.userName}
                              <p className="text-[10px] text-slate-400 font-mono font-medium">{log.userId}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {isSuperAdmin ? (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-100">
                                  Quản trị viên
                                </span>
                              ) : isWardLeader ? (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                                  Trưởng khu phố
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold border border-purple-100">
                                  Cộng tác viên
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action.includes("Xoá") || log.action.includes("Hủy") || log.action.includes("CẢNH BÁO")
                                  ? "bg-rose-50 text-rose-700 border border-rose-100"
                                  : log.action.includes("Thêm") || log.action.includes("Cấp") || log.action.includes("Đồng bộ")
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : log.action.includes("Đăng nhập")
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                  <button
                    disabled={logPage === 1}
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Trang trước
                  </button>
                  <span className="text-xs text-slate-600 font-bold">Trang {logPage} / {totalPages}</span>
                  <button
                    disabled={logPage === totalPages}
                    onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUPABASE MANAGEMENT & SYNCHRONIZATION */}
        {adminTab === "database" && (
          <div className="space-y-6">
            {/* Live Status Header Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl">
                    <Cloud className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      Trạng thái Supabase
                      {loadingStatus ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      ) : dbStatus?.connected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          Hoạt động Trực tuyến
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold border border-rose-100">
                          Ngoại tuyến / Lỗi kết nối
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-400">Kết nối cơ sở dữ liệu đám mây Google Cloud Platform thời gian thực.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 font-mono text-[10px] font-bold text-slate-600">
                  <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 uppercase text-[8px] block tracking-wide font-black">Google Cloud Project ID</span>
                    <span className="text-slate-800 break-all">{dbStatus?.projectId || "Đang kết nối..."}</span>
                  </div>
                  <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 uppercase text-[8px] block tracking-wide font-black">Database Instance ID</span>
                    <span className="text-slate-800 break-all">{dbStatus?.databaseId || "Đang kết nối..."}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between border border-slate-800 relative overflow-hidden shadow-md">
                <div className="absolute right-[-20px] top-[-20px] text-indigo-500/10 shrink-0">
                  <Cpu className="w-24 h-24" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-400" /> Báo cáo lưu trữ
                  </span>
                  <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                    Hệ thống lưu trữ phi cấu trúc (NoSQL Document) mang lại tốc độ truy xuất cực nhanh và chế độ ngoại tuyến vượt trội.
                  </p>
                </div>
                <button
                  onClick={fetchDbStatus}
                  className="mt-4 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Kiểm tra kết nối
                </button>
              </div>
            </div>

            {/* Manual Sync Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Pull Sync */}
              <div className="bg-white border border-slate-200 hover:border-emerald-200/80 transition-all rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[9px] font-bold uppercase border border-emerald-150">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" /> Đồng bộ một chiều tải xuống (PULL)
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Tải dữ liệu từ Supabase</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Kéo bản sao lưu trữ trực tuyến mới nhất từ Supabase để ghi đè và đồng bộ cho bộ nhớ đệm máy chủ. Phù hợp khi bạn chuyển sang sử dụng thiết bị mới hoặc muốn khôi phục dữ liệu gốc.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    disabled={syncing}
                    onClick={() => handleSync("pull")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {syncing && syncDirection === "pull" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {syncMessage}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Đồng bộ Tải xuống từ Cloud
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 2: Push Sync */}
              <div className="bg-white border border-slate-200 hover:border-indigo-200/80 transition-all rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 text-[9px] font-bold uppercase border border-indigo-150">
                    <span className="w-1 h-1 rounded-full bg-indigo-500" /> Đồng bộ một chiều đẩy lên (PUSH)
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Tải dữ liệu máy chủ lên Cloud</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Đẩy bản ghi nhớ cục bộ hiện tại lên Supabase để lưu trữ đồng bộ. Hệ thống lưu bản ghi mới trước, rồi mới loại bỏ bản ghi Cloud không còn tồn tại ở máy chủ. Phù hợp khi bạn vừa hoàn thành chỉnh sửa dữ liệu offline quy mô lớn và muốn xuất bản đồng bộ.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    disabled={syncing}
                    onClick={() => handleSync("push")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {syncing && syncDirection === "push" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {syncMessage}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Đồng bộ Đẩy lên Cloud (Ghi đè)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Collection Explorer with Schema Visualizer */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Cấu trúc bộ sưu tập và Bản ghi (Database Schema & Size)</h3>
                <p className="text-[10px] text-slate-400">Khám phá chi tiết kích thước dữ liệu thực tế đang hoạt động và sơ đồ thiết kế cơ sở dữ liệu.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Households */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Hộ Gia Đình (Households)</span>
                    <p className="text-lg font-black text-slate-900">{dbStatus?.localCounts?.households || 0} <span className="text-[10px] font-medium text-slate-500">tài liệu</span></p>
                  </div>
                  <button
                    onClick={() => setViewingSchema(viewingSchema === "households" ? null : "households")}
                    className="px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    Sơ đồ
                  </button>
                </div>

                {/* Residents */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Nhân Khẩu (Residents)</span>
                    <p className="text-lg font-black text-slate-900">{dbStatus?.localCounts?.residents || 0} <span className="text-[10px] font-medium text-slate-500">tài liệu</span></p>
                  </div>
                  <button
                    onClick={() => setViewingSchema(viewingSchema === "residents" ? null : "residents")}
                    className="px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    Sơ đồ
                  </button>
                </div>

                {/* Changes */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Biến Động (Changes)</span>
                    <p className="text-lg font-black text-slate-900">{dbStatus?.localCounts?.changes || 0} <span className="text-[10px] font-medium text-slate-500">tài liệu</span></p>
                  </div>
                  <button
                    onClick={() => setViewingSchema(viewingSchema === "changes" ? null : "changes")}
                    className="px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    Sơ đồ
                  </button>
                </div>

                {/* Businesses */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Hộ Kinh Doanh (Businesses)</span>
                    <p className="text-lg font-black text-slate-900">{dbStatus?.localCounts?.businesses || 0} <span className="text-[10px] font-medium text-slate-500">tài liệu</span></p>
                  </div>
                  <button
                    onClick={() => setViewingSchema(viewingSchema === "businesses" ? null : "businesses")}
                    className="px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    Sơ đồ
                  </button>
                </div>

                {/* Criteria */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Tiêu Chí Văn Minh (Criteria)</span>
                    <p className="text-lg font-black text-slate-900">{dbStatus?.localCounts?.criteria || 0} <span className="text-[10px] font-medium text-slate-500">tài liệu</span></p>
                  </div>
                  <button
                    onClick={() => setViewingSchema(viewingSchema === "criteria" ? null : "criteria")}
                    className="px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    Sơ đồ
                  </button>
                </div>

                {/* Logs */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Nhật Ký (Logs)</span>
                    <p className="text-lg font-black text-slate-900">{dbStatus?.localCounts?.logs || 0} <span className="text-[10px] font-medium text-slate-500">tài liệu</span></p>
                  </div>
                  <button
                    onClick={() => setViewingSchema(viewingSchema === "logs" ? null : "logs")}
                    className="px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    Sơ đồ
                  </button>
                </div>
              </div>

              {/* Schema Detail Overlay box */}
              {viewingSchema && schemaDetails[viewingSchema] && (
                <div className="bg-indigo-50/35 border border-indigo-150 rounded-2xl p-4 md:p-5 mt-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      {schemaDetails[viewingSchema].title}
                    </h5>
                    <button
                      onClick={() => setViewingSchema(null)}
                      className="text-xs text-indigo-500 hover:text-indigo-800 font-extrabold cursor-pointer"
                    >
                      Đóng sơ đồ
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{schemaDetails[viewingSchema].desc}</p>
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-600 block mb-1">Các trường dữ liệu chính (Blueprint Property)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {schemaDetails[viewingSchema].fields.map((f) => (
                        <span key={f} className="px-2 py-1 bg-white border border-indigo-100 text-indigo-800 rounded-md font-mono text-[9px] font-bold">
                          {f}
                        </span>
                      ))}
                      <span className="px-2 py-1 bg-indigo-100/50 border border-indigo-200 text-indigo-900 rounded-md font-mono text-[9px] font-black italic">
                        + các trường định danh an sinh xã hội bổ sung
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: BACKUP & MAINTENANCE */}
        {adminTab === "maintenance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database backups */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Sao lưu & Phục hồi dữ liệu</h3>
                  <p className="text-[10px] text-slate-400">Tránh mất mát dữ liệu dân cư bằng cách sao lưu thường xuyên.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống hỗ trợ cơ chế sao lưu toàn bộ cơ sở dữ liệu bao gồm: hộ gia đình, nhân khẩu, biến động, hộ kinh doanh và nhật ký hệ thống ra một tệp JSON tiêu chuẩn để lưu trữ độc lập hoặc nhập ngược lại khi cần thiết.
              </p>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={onExportBackup}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Tải tệp Sao Lưu
                </button>

                <button
                  onClick={handleTriggerFileInput}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> Khôi phục dữ liệu
                </button>

                <button
                  onClick={() => demographicsFileInputRef.current?.click()}
                  disabled={syncing}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Chỉ đồng bộ Hộ dân và Nhân khẩu"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Đồng bộ dân cư
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <input
                type="file"
                ref={demographicsFileInputRef}
                onChange={handleDemographicsFileChange}
                accept=".json,application/json"
                className="hidden"
              />
            </div>

            {/* Initialize & Maintenance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Bảo trì hệ thống trống</h3>
                  <p className="text-[10px] text-slate-400">Cài đặt ban đầu hoặc xóa dữ liệu mẫu để đưa vào thực tế.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Sử dụng các công cụ này khi chuyển giao hệ thống để xóa sạch các dữ liệu thử nghiệm ngẫu nhiên, đưa hệ thống về trạng thái ban đầu sạch sẽ để phục vụ cán bộ khu phố nhập liệu thực tế.
              </p>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setSimpleConfirm({
                      isOpen: true,
                      title: "Khởi tạo dữ liệu mẫu",
                      message: "Bạn có chắc muốn tự động tạo dữ liệu mẫu (25 hộ dân, 105 nhân khẩu)? Việc này sẽ ghi đè và thay thế toàn bộ dữ liệu hiện tại.",
                      confirmText: "Xác nhận Khởi tạo",
                      cancelText: "Hủy bỏ",
                      onConfirm: async () => {
                        setSimpleConfirm(null);
                        try {
                          await onGenerateMockData();
                          fetchDbStatus();
                          setLocalAlert({
                            isOpen: true,
                            title: "Khởi tạo thành công",
                            message: "Đã khởi tạo thành công cơ sở dữ liệu mẫu bao gồm 25 hộ gia đình với 105 nhân khẩu đa dạng thông tin an sinh xã hội!",
                            type: "success"
                          });
                        } catch (err: any) {
                          console.error("Lỗi khởi tạo dữ liệu mẫu:", err);
                        }
                      }
                    });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" /> Tạo dữ liệu mẫu
                </button>

                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Trash2 className="w-4 h-4" /> Xoá toàn bộ dữ liệu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title="Xoá toàn bộ dữ liệu hệ thống"
        description="CẢNH BÁO: Thao tác này sẽ xoá sạch toàn bộ dữ liệu hộ dân, nhân khẩu, biến động dân cư và hộ kinh doanh trong hệ thống để chuẩn bị nhập liệu thực tế."
        confirmWord="XOÁ TOÀN BỘ"
        placeholder="Nhập 'XOÁ TOÀN BỘ' để xác nhận"
        onConfirm={async () => {
          setIsDeleteModalOpen(false);
          try {
            await onClearMockData(true);
            fetchDbStatus();
            setLocalAlert({
              isOpen: true,
              title: "Xoá dữ liệu thành công",
              message: "Toàn bộ cơ sở dữ liệu trên máy chủ đã được xoá sạch hoàn toàn và sẵn sàng để cán bộ nhập liệu thực tế!",
              type: "success"
            });
          } catch (err: any) {
            setLocalAlert({
              isOpen: true,
              title: "Lỗi xoá dữ liệu",
              message: err.message || "Đã xảy ra lỗi không xác định.",
              type: "error"
            });
          }
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {simpleConfirm && simpleConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-[99999]">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">{simpleConfirm.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">{simpleConfirm.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSimpleConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {simpleConfirm.cancelText || "Hủy"}
              </button>
              <button
                onClick={simpleConfirm.onConfirm}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {simpleConfirm.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {localAlert && localAlert.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-[99999]">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              {localAlert.type === "success" && (
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
              )}
              {localAlert.type === "error" && (
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              {localAlert.type === "info" && (
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
              )}
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">{localAlert.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">{localAlert.message}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setLocalAlert(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
