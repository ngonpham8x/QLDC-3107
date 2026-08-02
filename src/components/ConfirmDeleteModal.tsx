import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmWord: string; // The word the user must type exactly (e.g. "XÓA", "XÓA TOÀN BỘ", or Name)
  placeholder?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  confirmWord,
  placeholder = "Nhập từ khóa xác nhận...",
  onConfirm,
  onCancel
}: ConfirmDeleteModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState(false);

  // Helper to normalize Vietnamese accent placement to modern style
  const normalizeVietnamese = (str: string) => {
    return str
      .normalize("NFC")
      .toLowerCase()
      .replace(/óa/g, "oá")
      .replace(/óy/g, "oý")
      .replace(/úy/g, "uý")
      .replace(/òa/g, "oà")
      .replace(/ỏa/g, "oả")
      .replace(/õa/g, "oã")
      .replace(/ọa/g, "oạ")
      .replace(/ùy/g, "uỳ")
      .replace(/ủy/g, "uỷ")
      .replace(/ũy/g, "uỹ")
      .replace(/ụy/g, "uỵ");
  };

  // Helper to remove all Vietnamese tones/diacritics for fallback comparison
  const removeVietnameseTones = (str: string) => {
    let result = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    result = result.replace(/đ/g, "d").replace(/Đ/g, "d");
    return result.toLowerCase();
  };

  const checkMatch = (val: string, target: string) => {
    const v = val.trim();
    const t = target.trim();
    if (!v || !t) return false;
    
    // 1. Direct case-insensitive match
    if (v.toLowerCase() === t.toLowerCase()) return true;

    // 2. Normalized Vietnamese match (handles different Unicode NFC/NFD & accent placements like óa vs oá)
    if (normalizeVietnamese(v) === normalizeVietnamese(t)) return true;

    // 3. Accent-stripped match (highly user-friendly fallback, e.g., 'xoa toan bo' matches 'XOÁ TOÀN BỘ')
    if (removeVietnameseTones(v) === removeVietnameseTones(t)) return true;

    return false;
  };

  const isMatched = checkMatch(inputValue, confirmWord);

  // Reset input value when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMatched) {
      onConfirm();
    } else {
      setError(true);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-[100] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 relative"
          id="confirm-delete-modal-box"
        >
          {/* Header warning bar */}
          <div className="bg-rose-50 border-b border-rose-100 p-4 md:p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-800">XÁC MINH BẢO MẬT TỐI CAO</h4>
                <p className="text-[10px] text-rose-600 font-bold font-mono">Dữ liệu sẽ bị xóa vĩnh viễn</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-slate-800 leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {description}
              </p>
            </div>

            {/* Instruction Panel */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <p className="text-[11px] text-slate-600 font-bold">
                Để tránh xóa nhầm, quý cán bộ vui lòng nhập đúng từ khóa hiển thị dưới đây để mở khóa hành động:
              </p>
              <div className="flex items-center justify-center py-2 px-4 bg-white border border-slate-200 rounded-xl select-none">
                <span className="font-mono text-sm font-black tracking-widest text-rose-600 uppercase">
                  {confirmWord}
                </span>
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(false);
                }}
                placeholder={placeholder}
                className={`w-full px-4 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border text-xs text-slate-800 font-bold rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  error 
                    ? "border-rose-400 focus:ring-rose-200" 
                    : isMatched 
                    ? "border-emerald-400 focus:ring-emerald-100 bg-emerald-50/10" 
                    : "border-slate-250 focus:ring-slate-100 focus:border-slate-400"
                }`}
                autoFocus
              />
              {error && (
                <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Từ khóa xác thực chưa chính xác. Vui lòng nhập đúng chữ hoa/thường.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[44px]"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={!isMatched}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-black rounded-xl text-white transition-all min-h-[44px] ${
                  isMatched 
                    ? "bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/10 cursor-pointer" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Xác nhận xóa
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
