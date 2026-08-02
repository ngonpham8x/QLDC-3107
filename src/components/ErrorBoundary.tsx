import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Trash2, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Đã xảy ra lỗi hiển thị (Ứng dụng đã tự khôi phục)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hệ thống bảo vệ giao diện đã phát hiện ngoại lệ và ngăn chặn trang trắng.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 my-4 font-mono text-xs text-rose-300 overflow-auto max-h-48 leading-relaxed">
              <p className="font-bold mb-1 text-rose-200">
                {this.state.error?.name}: {this.state.error?.message || "Không xác định"}
              </p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-400 whitespace-pre-wrap mt-2 pt-2 border-t border-slate-800">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-700/60">
              <button
                onClick={this.handleClearCacheAndReload}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>Xóa Cache & Khởi động lại</span>
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang ngay</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
