import React, { useEffect, useState } from "react";
import { CreditCard, Eye, LoaderCircle, Trash2, Upload } from "lucide-react";

type IdCardEntityType = "household" | "resident";

interface IdCardImagesProps {
  entityType: IdCardEntityType;
  entityId: string;
  frontPath?: string;
  backPath?: string;
  onChange: (next: { frontPath?: string; backPath?: string }) => void;
  disabled?: boolean;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

async function toOptimizedImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Không thể đọc ảnh CCCD."));
      element.src = sourceUrl;
    });
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Thiết bị không hỗ trợ nén ảnh.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75) > MAX_IMAGE_BYTES) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    }
    const base64 = dataUrl.split(",")[1] || "";
    if (!base64 || Math.ceil(base64.length * 0.75) > MAX_IMAGE_BYTES) {
      throw new Error("Ảnh sau khi nén vẫn quá 2 MB. Vui lòng chụp rõ hơn hoặc giảm kích thước ảnh.");
    }
    return { base64, mimeType: "image/jpeg", fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function IdCardImages({ entityType, entityId, frontPath, backPath, onChange, disabled = false }: IdCardImagesProps) {
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [uploadingSide, setUploadingSide] = useState<"front" | "back" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (disabled) {
      setFrontUrl("");
      setBackUrl("");
      return;
    }
    let active = true;
    const loadSignedUrl = async (path: string | undefined, setUrl: (value: string) => void) => {
      if (!path) {
        setUrl("");
        return;
      }
      try {
        const response = await fetch(`/api/id-card-images/signed-url?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        if (response.ok && data.url && active) setUrl(data.url);
      } catch {
        if (active) setUrl("");
      }
    };
    void loadSignedUrl(frontPath, setFrontUrl);
    void loadSignedUrl(backPath, setBackUrl);
    return () => { active = false; };
  }, [frontPath, backPath, disabled]);

  const upload = async (side: "front" | "back", file?: File) => {
    if (!file || disabled) return;
    if (!entityId.trim()) {
      setMessage("Hãy nhập mã hộ hoặc số CCCD trước khi tải ảnh.");
      return;
    }
    try {
      setUploadingSide(side);
      setMessage("");
      const image = await toOptimizedImage(file);
      const response = await fetch("/api/id-card-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          side,
          mimeType: image.mimeType,
          dataBase64: image.base64,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.path) throw new Error(data.error || "Không thể lưu ảnh CCCD.");

      onChange(side === "front" ? { frontPath: data.path, backPath } : { frontPath, backPath: data.path });
      // Do not delete the previous object here. The parent record may still
      // point to it until the administrator submits the form. Keeping it
      // prevents a cancelled/failed form submission from breaking an image
      // reference; unreferenced objects can be cleaned up separately.
      setMessage(`Đã tải ảnh mặt ${side === "front" ? "trước" : "sau"}. Nhấn Lưu biểu mẫu để cập nhật liên kết.`);
    } catch (error: any) {
      setMessage(error?.message || "Không thể tải ảnh CCCD.");
    } finally {
      setUploadingSide(null);
    }
  };

  const remove = (side: "front" | "back") => {
    const path = side === "front" ? frontPath : backPath;
    if (!path || disabled || !window.confirm(`Bỏ liên kết ảnh mặt ${side === "front" ? "trước" : "sau"} CCCD? Ảnh chỉ được xóa sau khi hệ thống xác nhận không còn bản ghi nào sử dụng.`)) return;
    // As with replacement, defer physical deletion until a server-side
    // retention/cleanup task can prove no saved record references the file.
    // This keeps an unsaved cancelled edit from creating a broken link.
    onChange(side === "front" ? { frontPath: undefined, backPath } : { frontPath, backPath: undefined });
    setMessage("Đã bỏ liên kết ảnh. Nhấn Lưu biểu mẫu để xác nhận thay đổi.");
  };

  const card = (side: "front" | "back", path?: string, url?: string) => {
    const uploading = uploadingSide === side;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase text-slate-600">Mặt {side === "front" ? "trước" : "sau"}</span>
          {path && <span className="text-[9px] font-bold text-emerald-700">Đã lưu</span>}
        </div>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="block h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-100" title="Mở ảnh lớn">
            <img src={url} alt={`CCCD mặt ${side === "front" ? "trước" : "sau"}`} className="w-full h-full object-cover" />
          </a>
        ) : (
          <div className="h-24 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-1">
            <CreditCard className="w-5 h-5" />
            <span className="text-[9px] font-semibold">{disabled && path ? "Ảnh được bảo vệ" : "Chưa có ảnh"}</span>
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex-1 h-8 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold cursor-pointer disabled:opacity-60">
            {uploading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Đang lưu" : "Tải ảnh"}
            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={(event) => { void upload(side, event.target.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
          {url && <a href={url} target="_blank" rel="noreferrer" className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900" title="Xem ảnh"><Eye className="w-3.5 h-3.5" /></a>}
          {path && <button type="button" onClick={() => remove(side)} disabled={disabled || uploading} className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Bỏ liên kết ảnh"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-3">
      <div>
        <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">Hình ảnh CCCD hai mặt</h4>
        <p className="text-[10px] text-indigo-700 mt-1">Ảnh được nén tối đa 2 MB và lưu trong kho riêng tư Supabase; không nằm trong tệp dữ liệu dân cư.{disabled ? " Chỉ Super Admin được xem và quản lý." : ""}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{card("front", frontPath, frontUrl)}{card("back", backPath, backUrl)}</div>
      {message && <p className={`text-[10px] font-medium ${message.startsWith("Đã") ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
    </section>
  );
}
