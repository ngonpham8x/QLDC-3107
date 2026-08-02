import React, { useState, useEffect } from "react";
import { UserRole, AllowedEmail, PendingRegistration } from "../types";
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Mail, 
  Users, 
  UserPlus, 
  Clock, 
  AlertCircle, 
  Check, 
  X, 
  Phone, 
  FileText, 
  UserCheck, 
  HelpCircle,
  Edit
} from "lucide-react";

export default function AllowedEmailsView() {
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>(UserRole.WARD_LEADER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEmail, setEditingEmail] = useState<AllowedEmail | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>(UserRole.WARD_LEADER);
  const [quickApproveAlert, setQuickApproveAlert] = useState<{ id: string; email: string; userName: string } | null>(null);
  const [quickApproveRole, setQuickApproveRole] = useState<UserRole>(UserRole.WARD_LEADER);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    email: string;
    title: string;
    type: "revoke" | "reject";
    id?: string;
  } | null>(null);

  const handleStartEditRole = (allowed: AllowedEmail) => {
    setEditingEmail(allowed);
    setEditingRole(allowed.role);
  };

  const handleSaveRole = async () => {
    if (!editingEmail) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/allowed-emails/${encodeURIComponent(editingEmail.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editingRole })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể cập nhật vai trò.");
      }

      setAllowedEmails(allowedEmails.map(a => a.email === editingEmail.email ? { ...a, role: editingRole } : a));
      setSuccess(`Đã cập nhật vai trò của tài khoản ${editingEmail.email} thành công!`);
      setEditingEmail(null);
    } catch (err: any) {
      setError(err.message || "Lỗi khi cập nhật vai trò.");
    }
  };
  
  // Sub-tabs for approved list, pending request list, and security alerts
  const [subTab, setSubTab] = useState<"approved" | "pending" | "security">("approved");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Fetch allowed emails
      const resAllowed = await fetch("/api/allowed-emails");
      if (resAllowed.ok) {
        const data = await resAllowed.json();
        setAllowedEmails(data);
      } else {
        setError("Không thể tải danh sách email được cấp quyền.");
      }

      // Fetch pending registrations
      const resPending = await fetch("/api/pending-registrations");
      if (resPending.ok) {
        const data = await resPending.json();
        setPendingRegistrations(data);
      }

      // Fetch security alerts from system logs
      const resLogs = await fetch("/api/logs");
      if (resLogs.ok) {
        const logsData = await resLogs.json();
        const filtered = logsData.filter((log: any) => 
          log.action?.includes("CẢNH BÁO") || 
          log.action?.includes("Từ chối đăng nhập") ||
          log.details?.includes("chưa được cấp quyền")
        );
        setSecurityAlerts(filtered);
      }
    } catch (err) {
      setError("Có lỗi xảy ra khi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQuickApprove = (email: string) => {
    setNewEmail(email);
    setNewRole(UserRole.WARD_LEADER);
    setSuccess(`Đã điền email "${email}". Vui lòng chọn vai trò và bấm "Cấp quyền ngay" bên trái.`);
    // Scroll container or window to make it visible
    const container = document.getElementById("allowed-emails-container");
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleQuickApproveSubmit = async (email: string, role: UserRole, logId?: string) => {
    setError("");
    setSuccess("");

    const emailToSubmit = email.trim().toLowerCase();
    if (!emailToSubmit) return;

    const adminEmails = ["bhttq3@gmail.com", "tayninhdoimoi@gmail.com", "nguyentanbinh3005@gmail.com"];
    if (adminEmails.includes(emailToSubmit)) {
      setError("Email này là Người quản lý mặc định, luôn có quyền tối cao.");
      setQuickApproveAlert(null);
      return;
    }

    try {
      const res = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSubmit,
          role,
          assignedBy: "Người quản lý"
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể cấp quyền.");
      }

      const added = await res.json();
      setAllowedEmails(prev => [...prev, added]);
      setSuccess(`Đã cấp quyền truy cập thành công cho tài khoản ${emailToSubmit}!`);
      setQuickApproveAlert(null);

      // If logId is provided, also delete that security alert
      if (logId) {
        await fetch(`/api/logs/${logId}`, { method: "DELETE" });
        setSecurityAlerts(prev => prev.filter(log => log.id !== logId));
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi cấp quyền.");
      setQuickApproveAlert(null);
    }
  };

  const handleDismissAlert = async (logId: string) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/logs/${logId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể xóa cảnh báo.");
      }

      setSecurityAlerts(prev => prev.filter(log => log.id !== logId));
      setSuccess("Đã bỏ qua cảnh báo bảo mật thành công và lưu danh sách bỏ qua.");
    } catch (err: any) {
      setError(err.message || "Lỗi khi xóa cảnh báo.");
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const emailToSubmit = newEmail.trim().toLowerCase();
    if (!emailToSubmit) return;

    const adminEmails = ["bhttq3@gmail.com", "tayninhdoimoi@gmail.com", "nguyentanbinh3005@gmail.com"];
    if (adminEmails.includes(emailToSubmit)) {
      setError("Email này là Người quản lý mặc định, luôn có quyền tối cao.");
      return;
    }

    try {
      const res = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSubmit,
          role: newRole,
          assignedBy: "Người quản lý"
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể cấp quyền.");
      }

      const added = await res.json();
      setAllowedEmails([...allowedEmails, added]);
      setNewEmail("");
      setSuccess(`Đã cấp quyền truy cập thành công cho tài khoản ${emailToSubmit}!`);
    } catch (err: any) {
      setError(err.message || "Lỗi khi cấp quyền.");
    }
  };

  const handleRevokePermission = async (email: string) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/allowed-emails/${encodeURIComponent(email)}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể hủy quyền.");
      }

      setAllowedEmails(allowedEmails.filter(a => a.email !== email));
      setSuccess(`Đã hủy thành công quyền truy cập của tài khoản ${email}.`);
    } catch (err: any) {
      setError(err.message || "Lỗi khi hủy quyền.");
    }
  };

  const handleApproveRegistration = async (id: string, email: string) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/pending-registrations/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: "Người quản lý" })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể duyệt tài khoản.");
      }

      const resData = await res.json();
      
      // Update state
      setPendingRegistrations(pendingRegistrations.filter(p => p.id !== id));
      setAllowedEmails([...allowedEmails, resData.allowed]);
      setSuccess(`Đã duyệt & cấp quyền truy cập thành công cho tài khoản ${email}!`);
    } catch (err: any) {
      setError(err.message || "Lỗi khi duyệt tài khoản.");
    }
  };

  const handleRejectRegistration = async (id: string, email: string) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/pending-registrations/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: "Người quản lý" })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể từ chối.");
      }

      setPendingRegistrations(pendingRegistrations.filter(p => p.id !== id));
      setSuccess(`Đã từ chối cấp quyền cho tài khoản ${email}.`);
    } catch (err: any) {
      setError(err.message || "Lỗi khi xử lý.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" id="allowed-emails-container">
      {/* Upper Info Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white border border-slate-700/50 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center border border-blue-500/30 shrink-0">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-wide uppercase">TRUNG TÂM KIỂM SOÁT QUYỀN TRUY CẬP</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dành riêng cho Người quản lý. Xét duyệt yêu cầu đăng ký tự động của cán bộ, cấp/thu hồi quyền đăng nhập hệ thống của cán bộ cấp cơ sở và điều tra viên.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Cấp quyền trực tiếp (Left Side) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center border border-emerald-100">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-950 text-xs uppercase tracking-wider">Cấp quyền trực tiếp</h3>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-[11px] text-rose-800 font-semibold flex gap-2.5 items-start">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-[11px] text-emerald-800 font-semibold flex gap-2.5 items-start animate-fade-in">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAddPermission} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Địa chỉ Google Gmail</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="nhap.email@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-emerald-600 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vai trò phân quyền</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-emerald-600 font-semibold cursor-pointer"
              >
                <option value={UserRole.WARD_LEADER}>Trưởng khu phố (Cán bộ Tổ trưởng)</option>
                <option value={UserRole.COLLABORATOR}>Cộng tác viên (Điều tra viên nhập liệu)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer duration-200 active:scale-[0.98] uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              Cấp quyền ngay
            </button>
          </form>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-[10px] text-slate-500 leading-relaxed space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wide">Quy định bảo mật cán bộ:</h4>
            <p>1. Chỉ cấp quyền cho email Google chính thức của cán bộ, người được phép tham gia quản lý cư trú.</p>
            <p>2. Khi hủy quyền, cán bộ đó sẽ ngay lập tức bị tước quyền truy cập và bị từ chối đăng nhập trong lần kế tiếp.</p>
          </div>
        </div>

        {/* Danh sách phân quyền & Yêu cầu đăng ký (Right Side) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col min-h-[400px]">
          {/* Custom Sub-tab header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center border border-blue-100">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-950 text-xs uppercase tracking-wider">
                Quản lý truy cập cán bộ
              </h3>
            </div>

            {/* Elegant pill switches */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setSubTab("approved")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subTab === "approved"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Cán bộ đã duyệt ({allowedEmails.length})
              </button>
              <button
                onClick={() => setSubTab("pending")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab === "pending"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Yêu cầu đăng ký ({pendingRegistrations.length})
                {pendingRegistrations.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setSubTab("security")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab === "security"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-rose-500 hover:text-rose-800"
                }`}
              >
                Cảnh báo bảo mật ({securityAlerts.length})
                {securityAlerts.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto mt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-xs">
                <Clock className="w-8 h-8 animate-spin text-emerald-600" />
                <span>Đang tải cơ sở dữ liệu...</span>
              </div>
            ) : subTab === "approved" ? (
              allowedEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs text-center space-y-2">
                  <Users className="w-12 h-12 text-slate-300" />
                  <p className="font-bold">Chưa có cán bộ nào được cấp quyền.</p>
                  <p className="text-slate-500">Hãy thêm địa chỉ email Gmail của cán bộ ở bên trái để cấp quyền truy cập.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Địa chỉ Google Gmail</th>
                      <th className="py-3 px-4">Vai trò / Chức vụ</th>
                      <th className="py-3 px-4">Ngày cấp quyền</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allowedEmails.map((allowed) => (
                      <tr key={allowed.id} className="hover:bg-slate-50/40 transition-colors font-medium">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold text-[10px] uppercase">
                              {allowed.email.charAt(0)}
                            </div>
                            <span className="font-semibold text-slate-800">{allowed.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border ${
                            allowed.role === UserRole.SUPER_ADMIN
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : allowed.role === UserRole.WARD_LEADER
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}>
                            {allowed.role === UserRole.SUPER_ADMIN ? "Quản trị viên" : allowed.role === UserRole.WARD_LEADER ? "Trưởng khu phố" : "CTV / Nhập liệu"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[10px]">
                          {new Date(allowed.assignedAt).toLocaleDateString("vi-VN")} lúc {new Date(allowed.assignedAt).toLocaleTimeString("vi-VN")}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleStartEditRole(allowed)}
                            className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-100 mr-1"
                            title="Sửa vai trò"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteModal({
                              isOpen: true,
                              email: allowed.email,
                              title: "Xóa phê duyệt quyền truy cập",
                              type: "revoke"
                            })}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                            title="Hủy quyền truy cập"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : subTab === "pending" ? (
              // Pending Sub-tab view
              pendingRegistrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs text-center space-y-2">
                  <UserCheck className="w-12 h-12 text-slate-300" />
                  <p className="font-bold">Không có yêu cầu đăng ký nào đang chờ duyệt.</p>
                  <p className="text-slate-500">Các yêu cầu từ màn hình đăng ký bên ngoài sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Thông tin đăng ký</th>
                      <th className="py-3 px-4">Vai trò đề xuất</th>
                      <th className="py-3 px-4">Lý do xin cấp quyền</th>
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-4 text-right">Xử lý duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingRegistrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-50/40 transition-colors font-medium text-slate-700">
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900">{reg.fullName}</p>
                            <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {reg.email}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {reg.phone}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border ${
                            reg.requestedRole === UserRole.WARD_LEADER
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}>
                            {reg.requestedRole === UserRole.WARD_LEADER ? "Trưởng khu phố" : "CTV / Nhập liệu"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-[180px] break-words">
                          <p className="text-[11px] leading-normal">{reg.reason || "Không có lý do được cung cấp."}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                          {new Date(reg.requestedAt).toLocaleDateString("vi-VN")}<br />
                          {new Date(reg.requestedAt).toLocaleTimeString("vi-VN")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveRegistration(reg.id, reg.email)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer border border-emerald-100"
                              title="Phê duyệt"
                            >
                              <Check className="w-3.5 h-3.5 font-black" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteModal({
                                isOpen: true,
                                email: reg.email,
                                title: "Từ chối & xóa phê duyệt yêu cầu",
                                type: "reject",
                                id: reg.id
                              })}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer border border-rose-100"
                              title="Từ chối"
                            >
                              <X className="w-3.5 h-3.5 font-black" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              // Security Alerts View
              securityAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs text-center space-y-2">
                  <ShieldCheck className="w-12 h-12 text-emerald-500/80" />
                  <p className="font-bold text-slate-800">Hệ thống an toàn!</p>
                  <p className="text-slate-500">Chưa ghi nhận nỗ lực truy cập trái phép hoặc cảnh báo bảo mật nào.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Tài khoản & Thiết bị</th>
                      <th className="py-3 px-4">Loại sự kiện</th>
                      <th className="py-3 px-4">Chi tiết phát hiện</th>
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-4 text-right">Phản ứng nhanh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {securityAlerts.map((log) => {
                      // Attempt to extract email from details or log userId
                      let emailAttempt = log.userId || "";
                      if (log.details && log.details.includes("Tài khoản Google")) {
                        const match = log.details.match(/Tài khoản Google ([^\s]+)/);
                        if (match && match[1]) {
                          emailAttempt = match[1];
                        }
                      }
                      return (
                        <tr key={log.id} className="hover:bg-rose-50/20 transition-colors font-medium text-slate-700 bg-rose-50/5">
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-900">{log.userName || "Khách lạ"}</p>
                              <span className="text-[10px] text-rose-600 font-mono flex items-center gap-1 font-semibold">
                                <Mail className="w-3 h-3 text-rose-400" />
                                {emailAttempt}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border bg-rose-50 text-rose-800 border-rose-200">
                              CHẶN ĐĂNG NHẬP
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-[200px] break-words">
                            <p className="text-[11px] leading-relaxed font-semibold text-rose-950">{log.details}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-mono text-[10px]">
                            {new Date(log.timestamp).toLocaleDateString("vi-VN")}<br />
                            {new Date(log.timestamp).toLocaleTimeString("vi-VN")}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setQuickApproveAlert({
                                    id: log.id,
                                    email: emailAttempt,
                                    userName: log.userName || "Cán bộ số"
                                  });
                                  setQuickApproveRole(UserRole.WARD_LEADER);
                                }}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200/60 transition-all text-[11px] flex items-center gap-1.5 hover:shadow-xs active:scale-95 duration-100 cursor-pointer"
                                title="Cấp quyền nhanh"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Cấp quyền nhanh
                              </button>
                              <button
                                onClick={() => handleDismissAlert(log.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200/60 transition-all text-[11px] flex items-center gap-1.5 hover:shadow-xs active:scale-95 duration-100 cursor-pointer"
                                title="Từ chối và xóa cảnh báo"
                              >
                                <X className="w-3.5 h-3.5" />
                                Từ chối
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>
      
      {/* Modal Sửa Quyền */}
      {editingEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center border border-blue-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-950 text-xs uppercase tracking-wider">
                  Sửa quyền truy cập
                </h3>
              </div>
              <button
                onClick={() => setEditingEmail(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Địa chỉ Email Gmail
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={editingEmail.email}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-500 bg-slate-100 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Chọn vai trò phân quyền mới
                </label>
                <select
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-blue-600 font-semibold cursor-pointer"
                >
                  <option value={UserRole.WARD_LEADER}>Trưởng khu phố (WARD_LEADER)</option>
                  <option value={UserRole.COLLABORATOR}>Cộng tác viên (COLLABORATOR)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={() => setEditingEmail(null)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveRole}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md active:scale-95"
              >
                Cập nhật vai trò
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cấp Quyền Nhanh */}
      {quickApproveAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center border border-emerald-100">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-950 text-xs uppercase tracking-wider">
                  Cấp quyền truy cập nhanh
                </h3>
              </div>
              <button
                onClick={() => setQuickApproveAlert(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Họ tên cán bộ
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={quickApproveAlert.userName}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-100 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Địa chỉ Email Gmail
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={quickApproveAlert.email}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-500 bg-slate-100 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Chọn vai trò phân quyền
                </label>
                <select
                  value={quickApproveRole}
                  onChange={(e) => setQuickApproveRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-emerald-600 font-semibold cursor-pointer"
                >
                  <option value={UserRole.WARD_LEADER}>Trưởng khu phố (Cán bộ Tổ trưởng)</option>
                  <option value={UserRole.COLLABORATOR}>Cộng tác viên (Điều tra viên nhập liệu)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={() => setQuickApproveAlert(null)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleQuickApproveSubmit(quickApproveAlert.email, quickApproveRole, quickApproveAlert.id)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md active:scale-95 uppercase tracking-wide"
              >
                Cấp quyền ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Revoking / Deleting Permissions */}
      {confirmDeleteModal && confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-200 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">
                  XÁC NHẬN XÓA PHÊ DUYỆT
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Quyền truy cập tài khoản cán bộ</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed font-semibold space-y-1">
              <p>Bạn có chắc chắn muốn xóa/hủy phê duyệt quyền truy cập của tài khoản này không?</p>
              <p className="font-extrabold text-rose-800 break-all text-[11px] bg-rose-100/60 px-2 py-1 rounded border border-rose-200/50 mt-1">
                📧 {confirmDeleteModal.email}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors text-center shadow-xs"
              >
                Không
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDeleteModal;
                  setConfirmDeleteModal(null);
                  if (target.type === "revoke") {
                    handleRevokePermission(target.email);
                  } else if (target.type === "reject" && target.id) {
                    handleRejectRegistration(target.id, target.email);
                  }
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 uppercase tracking-wider text-center"
              >
                Có
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
