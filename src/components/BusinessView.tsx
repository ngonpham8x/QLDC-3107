/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BusinessHousehold, User, UserRole, Resident, Household, HouseholdStatus, WaterSource, WasteCollectionStatus } from "../types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { 
  Briefcase as BusinessIcon, Search as SearchIcon, Plus as PlusIcon, 
  Edit as EditIcon, Trash2 as TrashIcon, X as XIcon, Check as CheckIcon, 
  FileSpreadsheet as FileIcon, Building as BuildingIcon, Download, Printer,
  Maximize2, Minimize2, Eye, Users
} from "lucide-react";

interface BusinessViewProps {
  businesses: BusinessHousehold[];
  residents: Resident[];
  households: Household[];
  currentUser: User | null;
  onAddBusiness: (bus: BusinessHousehold) => void;
  onUpdateBusiness: (bus: BusinessHousehold) => void;
  onDeleteBusiness: (id: string) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
  existingEntityIds?: Set<string>;
}

export default function BusinessView({
  businesses, residents, households, currentUser, onAddBusiness, onUpdateBusiness, onDeleteBusiness, onExport, existingEntityIds
}: BusinessViewProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");

  // Form Fields
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formOwnerId, setFormOwnerId] = useState("");
  const [formSector, setFormSector] = useState("");
  const [formTaxCode, setFormTaxCode] = useState("");
  const [formLicense, setFormLicense] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState<BusinessHousehold | null>(null);

  const handleHouseholdChange = (hhId: string) => {
    setSelectedHouseholdId(hhId);
    const household = households.find(h => h.id === hhId);
    if (household) {
      setFormAddress(household.address);
      const members = residents.filter(r => r.householdId === hhId);
      if (members.length > 0) {
        setFormOwnerId(members[0].id);
        setFormPhone(members[0].phone || "");
      } else {
        setFormOwnerId("");
        setFormPhone("");
      }
    } else {
      setFormOwnerId("");
      setFormAddress("");
      setFormPhone("");
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.taxCode.includes(searchQuery) ||
    b.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddForm = () => {
    setFormMode("add");
    setFormId(`KD-${Date.now()}`);
    setFormName("");
    setFormSector("");
    setFormTaxCode("");
    setFormLicense("");
    setFormNotes("");
    
    // Set default household and default owner in it
    if (households.length > 0) {
      const defaultHh = households[0];
      setSelectedHouseholdId(defaultHh.id);
      setFormAddress(defaultHh.address);
      const members = residents.filter(r => r.householdId === defaultHh.id);
      if (members.length > 0) {
        setFormOwnerId(members[0].id);
        setFormPhone(members[0].phone || "");
      } else {
        setFormOwnerId("");
        setFormPhone("");
      }
    } else {
      setSelectedHouseholdId("");
      setFormOwnerId("");
      setFormAddress("");
      setFormPhone("");
    }
    
    setIsFormOpen(true);
  };

  const openEditForm = (b: BusinessHousehold) => {
    setFormMode("edit");
    setFormId(b.id);
    setFormName(b.name);
    setFormOwnerId(b.ownerId);
    setFormSector(b.sector);
    setFormTaxCode(b.taxCode);
    setFormLicense(b.licenseNumber);
    setFormAddress(b.address);
    setFormPhone(b.phone || "");
    setFormNotes(b.notes || "");

    // Find household for current owner
    const ownerRes = residents.find(r => r.id === b.ownerId);
    if (ownerRes) {
      setSelectedHouseholdId(ownerRes.householdId);
    } else {
      setSelectedHouseholdId(households[0]?.id || "");
    }
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSector.trim() || !formTaxCode.trim() || !formLicense.trim() || !formAddress.trim()) {
      alert("Vui lòng điền đầy đủ các thông tin pháp lý của hộ kinh doanh!");
      return;
    }

    if (!formOwnerId) {
      alert("Vui lòng chọn thành viên trong hộ đăng ký đứng tên hộ kinh doanh!");
      return;
    }

    const resident = residents.find(r => r.id === formOwnerId);
    const ownerName = resident ? resident.fullName : "Không rõ";

    const businessData: BusinessHousehold = {
      id: formId,
      name: formName,
      ownerName,
      ownerId: formOwnerId,
      sector: formSector,
      taxCode: formTaxCode,
      licenseNumber: formLicense,
      address: formAddress,
      phone: formPhone,
      notes: formNotes
    };

    if (formMode === "add") {
      onAddBusiness(businessData);
    } else {
      onUpdateBusiness(businessData);
    }
    setIsFormOpen(false);
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    const headers = [
      "STT", "Tên Hộ Kinh Doanh", "Mã Số Thuế", "Số Giấy Phép", "Lĩnh Vực", "Họ Tên Chủ Hộ", "Số Điện Thoại", "Địa Chỉ", "Ghi Chú"
    ];
    const rows = filteredBusinesses.map((b, idx) => [
      idx + 1,
      b.name,
      b.taxCode,
      b.licenseNumber,
      b.sector,
      b.ownerName,
      b.phone || "Chưa cập nhật",
      b.address,
      b.notes || ""
    ]);
    onExport(type, "Danh sách Hộ Kinh Doanh cá thể", headers, rows);
  };

  return (
    <div id="business-view-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BuildingIcon className="w-6 h-6 text-emerald-600" />
            Quản lý hộ kinh doanh cá thể
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Đăng ký thuế, cấp phép giấy tờ kinh doanh, kiểm soát ngành nghề hoạt động kinh tế địa phương
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onExport && (
            <>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                title="Xuất bảng dữ liệu kinh doanh sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                title="Xuất bản in báo cáo PDF của các hộ kinh doanh"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF (In)
              </button>
            </>
          )}

          {true && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              Đăng ký hộ kinh doanh mới
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên cửa hàng, tên chủ hộ, mã số thuế hoặc số giấy phép..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Grid of Business Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBusinesses.map((b) => (
          <div key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div 
              onClick={() => setSelectedBusinessDetail(b)}
              className="p-5 space-y-3.5 cursor-pointer hover:bg-emerald-50/10 active:bg-emerald-50/25 transition-all group"
              title="Nhấn để xem chi tiết hộ kinh doanh"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono text-[9px] font-bold">
                    Mã số thuế: {b.taxCode}
                  </span>
                  <h3 className="text-base font-bold text-slate-800 mt-2 group-hover:text-emerald-700 transition-colors">{b.name}</h3>
                </div>
                <BuildingIcon className="w-5 h-5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <p><b>Chủ cơ sở kinh doanh:</b> <span className="text-slate-800 font-semibold">{b.ownerName}</span></p>
                {b.phone && <p><b>Số điện thoại:</b> <span className="text-slate-800 font-mono">{b.phone}</span></p>}
                <p><b>Lĩnh vực ngành nghề:</b> {b.sector}</p>
                <p><b>Số Giấy phép HKD:</b> <span className="font-mono text-slate-700">{b.licenseNumber}</span></p>
                <p><b>Địa điểm hoạt động:</b> {b.address}</p>
                {b.notes && <p><b>Ghi chú:</b> <span className="text-slate-500 italic">{b.notes}</span></p>}
              </div>
            </div>

            {/* Footer actions */}
            <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-mono">ID: {b.id}</span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedBusinessDetail(b)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                  title="Xem thông tin chi tiết"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  Chi tiết
                </button>

                {(currentUser?.role !== UserRole.COLLABORATOR || !existingEntityIds?.has(b.id)) && (
                  <button
                    onClick={() => openEditForm(b)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="Chỉnh sửa pháp lý"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                {(currentUser?.role !== UserRole.COLLABORATOR || !existingEntityIds?.has(b.id)) && (
                  <button
                    onClick={() => {
                      setBusinessToDelete({ id: b.id, name: b.name });
                      setDeleteModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    title="Xoá đăng ký kinh doanh"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredBusinesses.length === 0 && (
          <div className="col-span-full bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-xs">
            Không tìm thấy hộ kinh doanh cá thể nào trong khu vực.
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className={`bg-white rounded-2xl w-full transition-all duration-300 overflow-hidden shadow-2xl flex flex-col ${
            isZoomed ? "max-w-4xl h-[90vh] max-h-[95vh]" : "max-w-lg max-h-[85vh]"
          }`}>
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <BuildingIcon className="w-5 h-5 text-emerald-300" />
                {formMode === "add" ? "Khai báo thành lập Hộ Kinh Doanh mới" : "Cập nhật Giấy phép hộ kinh doanh"}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)} 
                  className="text-emerald-100 hover:text-white p-1 hover:bg-emerald-700/50 rounded-lg transition-colors cursor-pointer"
                  title={isZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isZoomed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button 
                  type="button"
                  onClick={() => { setIsFormOpen(false); setIsZoomed(false); }} 
                  className="text-emerald-100 hover:text-white p-1 hover:bg-emerald-700/50 rounded-lg transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-600">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên Hộ kinh doanh / Cửa hiệu *</label>
                <input
                  type="text"
                  required
                  placeholder="Tạp hoá Minh Đức"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chọn Hộ gia đình đăng ký *</label>
                  <select
                    value={selectedHouseholdId}
                    onChange={(e) => handleHouseholdChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-emerald-600 font-semibold cursor-pointer"
                  >
                    <option value="">-- Chọn Hộ gia đình --</option>
                    {households.map(h => (
                      <option key={h.id} value={h.id}>Hộ: {h.ownerName} ({h.id}) - {h.address}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Người đứng tên đại diện (Đã chọn) *</label>
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-bold flex items-center justify-between">
                    <span className="truncate">
                      {formOwnerId ? (
                        residents.find(r => r.id === formOwnerId)?.fullName || "Không tìm thấy"
                      ) : (
                        <span className="text-rose-500 font-semibold">Chưa chọn thành viên</span>
                      )}
                    </span>
                    {formOwnerId && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm font-mono font-bold uppercase shrink-0">{formOwnerId}</span>}
                  </div>
                </div>
              </div>

              {/* Members in selected household selector */}
              <div className="border border-slate-200/85 rounded-xl p-3 bg-slate-50 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Thành viên trong Hộ gia đình đăng ký (Nhấn chọn người đứng tên HKD) *</label>
                {selectedHouseholdId ? (
                  (() => {
                    const members = residents.filter(r => r.householdId === selectedHouseholdId);
                    if (members.length === 0) {
                      return (
                        <p className="text-xs text-amber-600 font-bold bg-amber-50 p-3 rounded-lg border border-amber-200">
                          Hộ gia đình này chưa có thành viên nào được đăng ký nhân khẩu trên hệ thống.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {members.map(member => {
                          const isSelected = formOwnerId === member.id;
                          return (
                            <div 
                              key={member.id} 
                              onClick={() => {
                                setFormOwnerId(member.id);
                                if (member.phone) {
                                  setFormPhone(member.phone);
                                }
                              }}
                              className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                                isSelected 
                                  ? "bg-emerald-50 border-emerald-400 shadow-xs" 
                                  : "bg-white border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <div className="mt-0.5 shrink-0">
                                <input
                                  type="radio"
                                  name="business_owner_radio"
                                  checked={isSelected}
                                  onChange={() => {
                                    setFormOwnerId(member.id);
                                    if (member.phone) {
                                      setFormPhone(member.phone);
                                    }
                                  }}
                                  className="accent-emerald-600 h-4 w-4 cursor-pointer"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                  <p className="text-xs font-bold text-slate-900 truncate">{member.fullName}</p>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold shrink-0">{member.relationToOwner}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-1.5 text-[10px] text-slate-500 font-semibold">
                                  <p>Ngày sinh: <span className="text-slate-700 font-bold">{member.birthDate}</span></p>
                                  <p>Số định danh: <span className="font-mono text-slate-700 font-bold">{member.nationalId || "Chưa cấp"}</span></p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200/60 text-center font-medium">
                    Vui lòng chọn Hộ gia đình đăng ký ở phía trên để chọn người đại diện đứng tên.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngành nghề kinh doanh cụ thể *</label>
                <input
                  type="text"
                  required
                  placeholder="Kinh doanh nhu yếu phẩm, bán lẻ hàng hóa tổng hợp..."
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã số thuế doanh nghiệp *</label>
                  <input
                    type="text"
                    required
                    placeholder="8123XXXXXX"
                    value={formTaxCode}
                    onChange={(e) => setFormTaxCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số giấy phép đăng ký KD *</label>
                  <input
                    type="text"
                    required
                    placeholder="GP-2025/HKD-X"
                    value={formLicense}
                    onChange={(e) => setFormLicense(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ đăng ký trụ sở chính *</label>
                <input
                  type="text"
                  required
                  placeholder="Số 88, Đường Điện Biên Phủ, Tổ 6"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="09XXXXXXXX"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    placeholder="Nhập ghi chú thêm..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Legal confirmation */}
              <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-[11px]">
                <b>* Cam kết pháp chế:</b> Hộ kinh doanh có trách nhiệm thực hiện đầy đủ nghĩa vụ thuế môn bài, thuế khoán địa phương theo quy định và đảm bảo trật tự lòng lề đường đô thị.
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-semibold"
                >
                  Cấp phép đăng ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED VIEW MODAL */}
      {selectedBusinessDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            <div className="bg-emerald-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center border border-emerald-700 shrink-0">
                  <BuildingIcon className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">{selectedBusinessDetail.name}</h3>
                  <p className="text-[10px] text-emerald-300 font-mono mt-0.5">MST: {selectedBusinessDetail.taxCode} | GP: {selectedBusinessDetail.licenseNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBusinessDetail(null)} 
                className="text-emerald-100 hover:text-white p-1.5 hover:bg-emerald-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 bg-slate-50/50">
              {/* Section 1: Business Details & Representative Profile */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl lg:col-span-2 space-y-4 shadow-2xs">
                  <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                    Thông tin Pháp lý & Hoạt động
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tên Hộ kinh doanh / Cửa hiệu:</p>
                      <p className="font-bold text-slate-800 mt-1 text-sm">{selectedBusinessDetail.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Mã số thuế doanh nghiệp:</p>
                      <p className="font-mono font-bold text-slate-950 mt-1 text-sm bg-slate-100 px-2 py-0.5 rounded-md inline-block">{selectedBusinessDetail.taxCode}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Lĩnh vực kinh doanh:</p>
                      <p className="font-semibold text-slate-800 mt-1">{selectedBusinessDetail.sector}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Số Giấy phép đăng ký:</p>
                      <p className="font-mono font-bold text-emerald-800 mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block border border-emerald-100">{selectedBusinessDetail.licenseNumber}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Địa chỉ đăng ký hoạt động:</p>
                      <p className="font-semibold text-slate-800 mt-1">{selectedBusinessDetail.address}</p>
                    </div>
                    {selectedBusinessDetail.phone && (
                      <div>
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Số điện thoại liên hệ:</p>
                        <p className="font-mono font-bold text-slate-800 mt-1">{selectedBusinessDetail.phone}</p>
                      </div>
                    )}
                    {selectedBusinessDetail.notes && (
                      <div className="col-span-1 sm:col-span-2">
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ghi chú / Cam kết hoạt động:</p>
                        <p className="text-slate-600 italic mt-1 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60 text-xs">{selectedBusinessDetail.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-2xs">
                  <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                    Người Đứng Tên Hộ Kinh Doanh
                  </h4>
                  {(() => {
                    const representative = residents.find(r => r.id === selectedBusinessDetail.ownerId);
                    if (!representative) {
                      return (
                        <div className="text-xs text-slate-500 space-y-1.5">
                          <p className="font-bold text-slate-800 text-sm">{selectedBusinessDetail.ownerName}</p>
                          <p className="text-rose-500 italic font-semibold">Cảnh báo: Nhân khẩu đứng tên đại diện chưa được liên kết đầy đủ trên cơ sở dữ liệu gốc.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="text-xs space-y-3">
                        <div>
                          <p className="text-slate-400 font-medium">Họ và tên đại diện:</p>
                          <p className="font-bold text-slate-800 text-sm mt-0.5">{representative.fullName}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-slate-400 font-medium">Ngày sinh:</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{representative.birthDate}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-medium">Giới tính:</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{representative.gender}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Số định danh / CCCD:</p>
                          <p className="font-mono font-bold text-slate-800 mt-0.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{representative.nationalId || "Chưa cấp"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Quan hệ với chủ hộ:</p>
                          <p className="font-semibold text-slate-700 mt-0.5">{representative.relationToOwner}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Nghề nghiệp thực tế:</p>
                          <p className="font-semibold text-slate-700 mt-0.5">{representative.occupation}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Section 2: Linked Household Details & All Resident Members */}
              {(() => {
                const representative = residents.find(r => r.id === selectedBusinessDetail.ownerId);
                const household = representative ? households.find(h => h.id === representative.householdId) : null;
                if (!household) return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-4 rounded-xl font-semibold">
                    Không tìm thấy thông tin Hộ gia đình liên kết trực tiếp trên hệ thống dân cư.
                  </div>
                );

                const householdMembers = residents.filter(r => r.householdId === household.id);

                return (
                  <div className="space-y-4">
                    <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-2xs">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600" />
                          Hộ Gia Đình Đăng Ký Liên Kết
                        </h4>
                        <span className="text-[10px] bg-slate-100 text-slate-800 font-mono font-bold px-2 py-0.5 rounded border border-slate-200">MÃ SỐ HỘ: {household.id}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <p className="text-slate-400 font-medium">Tên chủ hộ gia đình:</p>
                          <p className="font-bold text-slate-800 mt-0.5">{household.ownerName}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Địa chỉ thường trú hộ:</p>
                          <p className="font-semibold text-slate-700 mt-0.5">{household.address}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Phân loại hộ nghèo:</p>
                          <p className="font-semibold mt-0.5 text-slate-800">
                            {household.status === HouseholdStatus.POOR ? "Hộ nghèo 🟥" : household.status === HouseholdStatus.NEAR_POOR ? "Hộ cận nghèo 🟧" : "Bình thường 🟩"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Nước sạch & Thu gom rác:</p>
                          <p className="font-semibold text-slate-700 mt-0.5">
                            {household.waterSource === WaterSource.TAP_WATER ? "💧 Có sử dụng" : "❌ Chưa"} | {household.wasteCollectionStatus === WasteCollectionStatus.REGISTERED ? "🗑️ Đã đăng ký" : "❌ Chưa"}
                          </p>
                        </div>
                      </div>

                      {/* Members table */}
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Danh sách thành viên đăng ký cư trú ({householdMembers.length} thành viên):
                          </p>
                        </div>
                        
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-3">Họ và tên thành viên</th>
                                <th className="p-3">Quan hệ với chủ hộ</th>
                                <th className="p-3">Ngày sinh</th>
                                <th className="p-3">Giới tính</th>
                                <th className="p-3">Số CCCD / Định danh</th>
                                <th className="p-3">Nghề nghiệp thực tế</th>
                                <th className="p-3 text-center">Bảo hiểm y tế</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {householdMembers.map((m) => {
                                const isRepresentative = m.id === selectedBusinessDetail.ownerId;
                                return (
                                  <tr key={m.id} className={`hover:bg-slate-50/80 transition-colors ${isRepresentative ? "bg-emerald-50/50 font-bold text-emerald-950" : ""}`}>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1.5">
                                        <span className="truncate">{m.fullName}</span>
                                        {isRepresentative && (
                                          <span className="text-[8px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                                            Đại diện HKD
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 text-slate-500">{m.relationToOwner}</td>
                                    <td className="p-3 font-mono text-slate-600">{m.birthDate}</td>
                                    <td className="p-3 text-slate-500">{m.gender}</td>
                                    <td className="p-3 font-mono text-slate-600">{m.nationalId || "Chưa cấp"}</td>
                                    <td className="p-3 text-slate-500">{m.occupation}</td>
                                    <td className="p-3 text-center">
                                      {m.insuranceId ? (
                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-sm" title={m.insuranceId}>BHYT: {m.insuranceId}</span>
                                      ) : (
                                        <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-sm">Chưa có</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedBusinessDetail(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer"
              >
                Đóng thông tin chi tiết
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen && businessToDelete !== null}
        title={`Thu hồi và xoá đăng ký kinh doanh: ${businessToDelete?.name}`}
        description={`Bạn có chắc chắn muốn thu hồi và xoá vĩnh viễn giấy phép/đăng ký kinh doanh này? Lưu ý: Hành động này không thể khôi phục.`}
        confirmWord={businessToDelete?.name || "XOÁ"}
        placeholder={`Nhập tên hộ kinh doanh '${businessToDelete?.name}' để xác nhận`}
        onConfirm={() => {
          if (businessToDelete) {
            onDeleteBusiness(businessToDelete.id);
          }
          setDeleteModalOpen(false);
          setBusinessToDelete(null);
        }}
        onCancel={() => {
          setDeleteModalOpen(false);
          setBusinessToDelete(null);
        }}
      />
    </div>
  );
}
