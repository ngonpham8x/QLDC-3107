import React, { useState } from "react";
import { CheckSquare, Square, FileText, X, RotateCcw, Sliders, AlertCircle } from "lucide-react";

interface ExportColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  unitName: string;
  headers: string[];
  rows: any[][];
  onConfirmExport: (filteredHeaders: string[], filteredRows: any[][], orientation: "landscape" | "portrait") => void;
}

export const ExportColumnModal: React.FC<ExportColumnModalProps> = ({
  isOpen,
  onClose,
  reportTitle,
  headers,
  rows,
  onConfirmExport,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() =>
    headers.map((_, idx) => idx)
  );
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");

  if (!isOpen) return null;

  const handleToggleIndex = (idx: number) => {
    if (selectedIndices.includes(idx)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== idx));
    } else {
      setSelectedIndices([...selectedIndices, idx].sort((a, b) => a - b));
    }
  };

  const handleSelectAll = () => {
    setSelectedIndices(headers.map((_, idx) => idx));
  };

  const handleDeselectAll = () => {
    // Keep at least STT (index 0) if available, or empty
    setSelectedIndices([0]);
  };

  const handleConfirm = () => {
    if (selectedIndices.length === 0) return;
    const filteredHeaders = headers.filter((_, idx) => selectedIndices.includes(idx));
    const filteredRows = rows.map((row) =>
      row.filter((_, idx) => selectedIndices.includes(idx))
    );
    onConfirmExport(filteredHeaders, filteredRows, orientation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-600 dark:bg-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Sliders className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight leading-snug">
                Tùy chọn cột xuất PDF
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium truncate max-w-md">
                {reportTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-3">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                Tick chọn các cột cần hiển thị trên tệp PDF:
              </span>{" "}
              Hệ thống sẽ tự động tính toán kích thước phông chữ và căn lề chuẩn khổ giấy A4 vừa vặn 100% với các cột đã chọn.
            </div>
          </div>

          {/* Page Orientation Option */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>📐 Hướng trang PDF (A4 Orientation):</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  orientation === "landscape"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="text-base">📄</span>
                <div className="text-left">
                  <div>A4 Ngang (Landscape)</div>
                  <div className={`text-[10px] font-normal ${orientation === "landscape" ? "text-emerald-100" : "text-slate-400"}`}>
                    297mm x 210mm (Nhiều cột)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  orientation === "portrait"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="text-base">📜</span>
                <div className="text-left">
                  <div>A4 Dọc (Portrait)</div>
                  <div className={`text-[10px] font-normal ${orientation === "portrait" ? "text-emerald-100" : "text-slate-400"}`}>
                    210mm x 297mm (Danh sách gọn)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Actions & Selection Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Chọn tất cả ({headers.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 text-slate-400" />
                Bỏ chọn tất cả
              </button>
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                Đặt lại
              </button>
            </div>

            <div className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Đã chọn: {selectedIndices.length} / {headers.length} cột
            </div>
          </div>

          {selectedIndices.length === 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Vui lòng chọn ít nhất 1 cột để xuất báo cáo PDF.</span>
            </div>
          )}

          {/* Grid of Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[45vh] overflow-y-auto p-1">
            {headers.map((header, idx) => {
              const isChecked = selectedIndices.includes(idx);
              return (
                <label
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    handleToggleIndex(idx);
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    isChecked
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50 text-emerald-900 dark:text-emerald-200 shadow-2xs"
                      : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 opacity-60 hover:opacity-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Handled by label click
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-none"
                  />
                  <span className="truncate" title={header}>
                    <span className="text-[10px] text-slate-400 font-normal mr-1">#{idx + 1}</span>
                    {header}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Khổ giấy: <span className="font-bold text-slate-700 dark:text-slate-300">
              {orientation === "landscape" ? "A4 Ngang (Landscape)" : "A4 Dọc (Portrait)"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={selectedIndices.length === 0}
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Tạo & Xuất PDF ({selectedIndices.length} cột)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
