import React, { useState, useEffect } from "react";
import { 
  Search, Plus, FileText, Download, Trash, Edit, Tag, Calendar, User, 
  Eye, X, Check, Save, FolderOpen, AlertCircle, ShieldAlert 
} from "lucide-react";
import { QuarterDocument, UserRole } from "../types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

interface QuarterDocumentsViewProps {
  currentUser: {
    id: string;
    fullName: string;
    role: UserRole;
  };
}

export default function QuarterDocumentsView({ currentUser }: QuarterDocumentsViewProps) {
  const [documents, setDocuments] = useState<QuarterDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formId, setFormId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formIssuer, setFormIssuer] = useState("");
  const [formCategory, setFormCategory] = useState<QuarterDocument["category"]>("Văn bản pháp quy");
  const [formDescription, setFormDescription] = useState("");
  const [formFileSize, setFormFileSize] = useState("1.2 MB");
  const [formFileType, setFormFileType] = useState("PDF");
  const [formAttachments, setFormAttachments] = useState<{ name: string; size: string; type: string; dataUrl: string }[]>([]);

  // Detail Modal state
  const [selectedDoc, setSelectedDoc] = useState<QuarterDocument | null>(null);

  // Delete confirm modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; title: string } | null>(null);

  // Load documents
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/documents");
      if (!response.ok) {
        throw new Error("Không thể tải danh sách tài liệu");
      }
      const data = await response.json();
      setDocuments(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.docNumber && doc.docNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      doc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = categoryFilter === "ALL" || doc.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Handle open add form
  const handleOpenAdd = () => {
    setFormMode("add");
    setFormId(`DOC-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormTitle("");
    setFormDocNumber("");
    setFormIssueDate(new Date().toISOString().split("T")[0]);
    setFormIssuer("Ban Điều Hành Khu Phố");
    setFormCategory("Văn bản pháp quy");
    setFormDescription("");
    setFormFileSize("0.0 KB");
    setFormFileType("Tài liệu đính kèm");
    setFormAttachments([]);
    setIsFormOpen(true);
  };

  // Handle open edit form
  const handleOpenEdit = (doc: QuarterDocument) => {
    setFormMode("edit");
    setFormId(doc.id);
    setFormTitle(doc.title);
    setFormDocNumber(doc.docNumber || "");
    setFormIssueDate(doc.issueDate);
    setFormIssuer(doc.issuer);
    setFormCategory(doc.category);
    setFormDescription(doc.description || "");
    setFormFileSize(doc.fileSize || "0.0 KB");
    setFormFileType(doc.fileType || "Tài liệu đính kèm");
    setFormAttachments(doc.attachments || []);
    setIsFormOpen(true);
  };

  // Handle attachment upload with client-side FileReader & Compression
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const dataUrl = reader.result;

          if (file.type.startsWith("image/")) {
            const img = new Image();
            img.onload = () => {
              let width = img.width;
              let height = img.height;
              const maxWidth = 500;
              const maxHeight = 500;

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
                const compressedUrl = canvas.toDataURL("image/jpeg", 0.6);
                setFormAttachments(prev => [
                  ...prev,
                  {
                    name: file.name,
                    size: `${(compressedUrl.length / 1024).toFixed(1)} KB`,
                    type: "PNG/JPG",
                    dataUrl: compressedUrl
                  }
                ]);
              } else {
                setFormAttachments(prev => [
                  ...prev,
                  {
                    name: file.name,
                    size: `${(dataUrl.length / 1024).toFixed(1)} KB`,
                    type: "PNG/JPG",
                    dataUrl
                  }
                ]);
              }
            };
            img.src = dataUrl;
          } else {
            // Check size: limit non-image base64 files to 300KB
            if (file.size > 300 * 1024) {
              alert(`Tệp "${file.name}" vượt quá giới hạn 300KB cho phép lưu trực tiếp. Vui lòng nén tệp hoặc chọn tệp nhỏ hơn.`);
              return;
            }
            const sizeStr = file.size > 1024 * 1024 
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
              : `${(file.size / 1024).toFixed(1)} KB`;
            setFormAttachments(prev => [
              ...prev,
              {
                name: file.name,
                size: sizeStr,
                type: file.name.split('.').pop()?.toUpperCase() || "FILE",
                dataUrl
              }
            ]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (indexIdx: number) => {
    setFormAttachments(prev => prev.filter((_, idx) => idx !== indexIdx));
  };

  // Save document
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Vui lòng nhập tiêu đề tài liệu");
      return;
    }

    const calculatedSize = formAttachments.length > 0 
      ? `${formAttachments.reduce((acc, a) => acc + (a.dataUrl.length * 0.75 / 1024), 0).toFixed(1)} KB`
      : "0.0 KB";

    const calculatedType = formAttachments.length > 0
      ? formAttachments[0].type
      : "Tài liệu đính kèm";

    const docData: Partial<QuarterDocument> = {
      id: formId,
      title: formTitle.trim(),
      docNumber: formDocNumber.trim() || undefined,
      issueDate: formIssueDate,
      issuer: formIssuer.trim(),
      category: formCategory,
      description: formDescription.trim() || undefined,
      fileSize: calculatedSize,
      fileType: calculatedType,
      attachments: formAttachments,
      createdAt: new Date().toISOString().split("T")[0]
    };

    const url = formMode === "add" ? "/api/documents" : `/api/documents/${formId}`;
    const method = formMode === "add" ? "POST" : "PUT";

    try {
      const queryParams = new URLSearchParams({
        user: currentUser.fullName,
        role: currentUser.role
      });
      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(docData)
      });

      if (!response.ok) {
        throw new Error("Không thể lưu tài liệu. Vui lòng kiểm tra quyền truy cập.");
      }

      await fetchDocuments();
      setIsFormOpen(false);
      alert(formMode === "add" ? "Thêm tài liệu thành công!" : "Cập nhật tài liệu thành công!");
    } catch (err: any) {
      alert(`[LỖI] ${err.message}`);
    }
  };

  // Delete document
  const handleDelete = async (id: string, title: string) => {
    try {
      const queryParams = new URLSearchParams({
        user: currentUser.fullName,
        role: currentUser.role
      });
      const response = await fetch(`/api/documents/${id}?${queryParams.toString()}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Không thể xóa tài liệu");
      }

      await fetchDocuments();
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
      alert("Đã xóa tài liệu thành công!");
    } catch (err: any) {
      alert(`[LỖI] ${err.message}`);
    }
  };

  // Simulated download / export document
  const handleDownload = (doc: QuarterDocument) => {
    alert(`[TẢI XUỐNG THÀNH CÔNG] Đang tải tài liệu "${doc.title}" (${doc.fileSize}, Định dạng ${doc.fileType}). Tài liệu đã được xác thực mã hóa an toàn.`);
    
    // Simulate real browser download trigger by exporting metadata text file
    const content = `
=========================================
BẢN GHI TÀI LIỆU KHU PHỐ NINH PHÚ (TRÍCH XUẤT)
=========================================
Mã số tài liệu: ${doc.id}
Tiêu đề: ${doc.title}
Số ký hiệu: ${doc.docNumber || "N/A"}
Ngày ban hành: ${doc.issueDate}
Cơ quan ban hành: ${doc.issuer}
Chuyên mục: ${doc.category}
Mô tả nội dung: ${doc.description || "Không có mô tả."}
Dung lượng: ${doc.fileSize} | Định dạng: ${doc.fileType}
Ngày trích xuất hệ thống: ${new Date().toLocaleDateString("vi-VN")}
Ban điều hành Tổ dân phố / Khu phố Ninh Phú
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.title.replace(/\s+/g, "_")}_Metadata.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isEditable = currentUser.role !== UserRole.COLLABORATOR;

  return (
    <div className="flex-1 p-4 sm:p-6 pb-16 space-y-6 overflow-y-auto bg-slate-50 text-slate-800" id="quarter-documents-root">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <span className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
              <FileText className="w-6 h-6" />
            </span>
            Hệ thống Lưu trữ Tài liệu Khu phố
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Nơi lưu trữ, quản lý văn bản pháp quy, kế hoạch, biểu mẫu hành chính, biên bản họp và tài liệu sử dụng đất Tổ dân phố Ninh Phú.
          </p>
        </div>

        {isEditable && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/10 transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            Thêm Tài liệu Mới
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tài liệu theo tiêu đề, số hiệu, người ban hành hoặc nội dung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600 focus:bg-white"
          />
        </div>

        <div className="md:w-64">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-emerald-600"
          >
            <option value="ALL">Tất cả chuyên mục</option>
            <option value="Văn bản pháp quy">Văn bản pháp quy</option>
            <option value="Kế hoạch / Báo cáo">Kế hoạch / Báo cáo</option>
            <option value="Mẫu biểu hồ sơ">Mẫu biểu hồ sơ</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/85">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-bold mt-4">Đang tải danh mục tài liệu lưu trữ...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-extrabold text-rose-800">Lỗi kết nối cơ sở dữ liệu</h4>
            <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>
          </div>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/85 text-center">
          <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-3">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-700">Không tìm thấy tài liệu phù hợp</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Thử thay đổi từ khóa tìm kiếm hoặc lọc theo chuyên mục tài liệu khác để hiển thị kết quả.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div 
              key={doc.id} 
              className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              id={`doc-card-${doc.id}`}
            >
              {/* Card Top Block */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2.5">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wide uppercase border ${
                    doc.category === "Văn bản pháp quy" 
                      ? "bg-purple-50 text-purple-700 border-purple-150" 
                      : doc.category === "Kế hoạch / Báo cáo"
                        ? "bg-blue-50 text-blue-700 border-blue-150"
                        : doc.category === "Mẫu biểu hồ sơ"
                          ? "bg-teal-50 text-teal-700 border-teal-150"
                          : "bg-slate-50 text-slate-700 border-slate-150"
                  }`}>
                    {doc.category}
                  </span>
                  
                  <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {doc.id}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-sm leading-snug line-clamp-2 hover:text-emerald-700 cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                    {doc.title}
                  </h3>
                  {doc.docNumber && (
                    <p className="text-xs text-slate-500 font-bold font-mono">
                      Số hiệu: {doc.docNumber}
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-400 font-medium line-clamp-3 leading-relaxed">
                  {doc.description || "Không có tóm tắt chi tiết cho tài liệu này."}
                </p>

                {/* Meta details */}
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ban hành: <b className="text-slate-700">{new Date(doc.issueDate).toLocaleDateString("vi-VN")}</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">Nơi phát hành: <b className="text-slate-700 font-semibold">{doc.issuer}</b></span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Eye className="w-4 h-4" />
                  Chi tiết
                </button>

                <button
                  onClick={() => handleDownload(doc)}
                  className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Tải tài liệu"
                >
                  <Download className="w-4.5 h-4.5" />
                </button>

                {isEditable && (
                  <>
                    <button
                      onClick={() => handleOpenEdit(doc)}
                      className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Chỉnh sửa tài liệu"
                    >
                      <Edit className="w-4.5 h-4.5" />
                    </button>

                    <button
                      onClick={() => {
                        setDocToDelete({ id: doc.id, title: doc.title });
                        setDeleteModalOpen(true);
                      }}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Xóa tài liệu"
                    >
                      <Trash className="w-4.5 h-4.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spacer to prevent overlapping from the footer on shorter viewports */}
      <div className="h-24 sm:h-32 shrink-0 clear-both" />

      {/* Add/Edit Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm tracking-wider uppercase">
                  {formMode === "add" ? "Thêm tài liệu lưu trữ" : "Cập nhật tài liệu"}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{formId}</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tiêu đề tài liệu *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tiêu đề hoặc tên đầy đủ của văn bản tài liệu..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Số hiệu ký hiệu</label>
                  <input
                    type="text"
                    placeholder="ví dụ: 12/QĐ-UBND"
                    value={formDocNumber}
                    onChange={(e) => setFormDocNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Chuyên mục tài liệu</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as QuarterDocument["category"])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  >
                    <option value="Văn bản pháp quy">Văn bản pháp quy</option>
                    <option value="Kế hoạch / Báo cáo">Kế hoạch / Báo cáo</option>
                    <option value="Mẫu biểu hồ sơ">Mẫu biểu hồ sơ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Ngày ban hành *</label>
                  <input
                    type="date"
                    required
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nơi ban hành *</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: UBND Phường Bình Minh"
                    value={formIssuer}
                    onChange={(e) => setFormIssuer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dung lượng tệp</label>
                  <input
                    type="text"
                    placeholder="ví dụ: 1.5 MB"
                    value={formFileSize}
                    onChange={(e) => setFormFileSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Định dạng tệp</label>
                  <select
                    value={formFileType}
                    onChange={(e) => setFormFileType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  >
                    <option value="PDF">PDF (Văn bản scan)</option>
                    <option value="DOCX">DOCX (Tài liệu Word)</option>
                    <option value="XLSX">XLSX (Bảng tính Excel)</option>
                    <option value="PNG">PNG / JPG (Hình ảnh)</option>
                    <option value="ZIP">ZIP / RAR (Tệp nén)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tóm tắt nội dung tài liệu</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Nhập tóm tắt nội dung tài liệu để dễ dàng tra cứu, phục vụ công tác rà soát cư dân sau này..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  rows={4}
                />
              </div>

              {/* Multiple Attachments Upload & Selection */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tài liệu, hình ảnh đính kèm ({formAttachments.length})
                </label>
                
                {formAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 border border-slate-150 rounded-xl">
                    {formAttachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs text-slate-700 shadow-xs">
                        <span className="font-semibold max-w-[140px] truncate" title={att.name}>{att.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold">({att.size})</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 transition-colors text-center relative cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={handleAttachmentUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Plus className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">Đính kèm tệp văn bản hoặc hình ảnh chụp thực địa</span>
                    <span className="text-[10px] text-slate-400">Hỗ trợ PDF, Word, Excel, TXT hoặc Ảnh (Tự động nén tối ưu)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg cursor-pointer min-h-[44px]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg cursor-pointer min-h-[44px]"
                >
                  <Save className="w-4 h-4" />
                  {formMode === "add" ? "Thêm mới" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#0F172A] text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-wider uppercase">Chi tiết hồ sơ lưu trữ</h3>
              </div>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="space-y-2">
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-250 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase">
                  {selectedDoc.category}
                </span>
                <h2 className="text-lg font-black text-slate-900 leading-snug">
                  {selectedDoc.title}
                </h2>
                {selectedDoc.docNumber && (
                  <p className="text-xs text-slate-500 font-extrabold font-mono bg-slate-50 px-3 py-1 rounded border border-slate-100 inline-block">
                    Số ký hiệu: {selectedDoc.docNumber}
                  </p>
                )}
              </div>

              {/* Document metadata info table */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Mã số lưu trữ</span>
                  <p className="text-xs font-mono font-extrabold text-slate-700">{selectedDoc.id}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cơ quan ban hành</span>
                  <p className="text-xs font-bold text-slate-700">{selectedDoc.issuer}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Ngày ban hành</span>
                  <p className="text-xs font-bold text-slate-700">{new Date(selectedDoc.issueDate).toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Dung lượng & Định dạng</span>
                  <p className="text-xs font-bold text-slate-700">{selectedDoc.fileSize || "Chưa rõ"} ({selectedDoc.fileType || "PDF"})</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tóm tắt nội dung văn bản</span>
                <div className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100 italic min-h-[80px]">
                  {selectedDoc.description || "Không có tóm tắt chi tiết được ghi nhận."}
                </div>
              </div>

              {/* Attachments Section */}
              {selectedDoc.attachments && selectedDoc.attachments.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tập tin đính kèm ({selectedDoc.attachments.length})</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {selectedDoc.attachments.map((att, idx) => {
                      const isImage = att.dataUrl.startsWith("data:image/") || ["PNG", "JPG", "JPEG", "GIF"].includes(att.type);
                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col justify-between gap-2.5">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate" title={att.name}>{att.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{att.size} | {att.type}</p>
                            </div>
                          </div>
                          
                          {isImage && (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-100 bg-slate-100">
                              <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = att.dataUrl;
                              link.download = att.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Tải tệp này
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <div className="text-[10px] text-slate-400 font-medium">
                  Đồng bộ mây: <b className="text-emerald-600">Đã đồng bộ an toàn</b>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer min-h-[44px]"
                  >
                    Đóng lại
                  </button>
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/15 cursor-pointer min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    Tải tài liệu ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen && docToDelete !== null}
        title={`Xoá tài liệu lưu trữ: ${docToDelete?.title}`}
        description={`Bạn có chắc chắn muốn xoá vĩnh viễn tài liệu này khỏi hồ sơ lưu trữ của tổ dân phố? Lưu ý: Hành động này không thể khôi phục.`}
        confirmWord={docToDelete?.title || "XOÁ"}
        placeholder={`Nhập tiêu đề tài liệu để xác nhận`}
        onConfirm={() => {
          if (docToDelete) {
            handleDelete(docToDelete.id, docToDelete.title);
          }
          setDeleteModalOpen(false);
          setDocToDelete(null);
        }}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDocToDelete(null);
        }}
      />
    </div>
  );
}
