/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ZoomIn, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";

interface DeviceSimulatorProps {
  children: (isMobile: boolean, deviceType: "web" | "android" | "ios") => React.ReactNode;
}

export default function DeviceSimulator({ children }: DeviceSimulatorProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [isDetectedMobile, setIsDetectedMobile] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isMobileHeaderCollapsed, setIsMobileHeaderCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent.toLowerCase();
      const isMobileUA = /iphone|ipad|ipod|android|blackberry|iemobile|opera mini/i.test(ua);
      const isSmallScreen = window.innerWidth < 1024; // Breakpoint for mobile/tablet optimized dashboard layout
      setIsDetectedMobile(isMobileUA || isSmallScreen);
      setIsIos(/iphone|ipad|ipod/i.test(ua));
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return (
    <div id="device-simulator-root" className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Simulation Control Header - Full on desktop/tablet, collapsable on mobile */}
      {isMobileHeaderCollapsed && (
        <header className="md:hidden bg-[#111c2e] border-b border-slate-800 px-3 py-1.5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">QLDC</span>
            <span className="text-[11px] font-bold text-white truncate max-w-[180px]">HỆ THỐNG QUẢN LÝ DÂN CƯ</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileHeaderCollapsed(false)}
            className="flex items-center gap-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-1 rounded-lg border border-slate-700 transition-all cursor-pointer"
            title="Mở rộng khung thanh công cụ"
          >
            <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hiện Banner</span>
          </button>
        </header>
      )}

      <header className={`bg-[#111c2e] border-b border-slate-800/80 px-4 py-3 sm:px-6 sm:py-4 flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shrink-0 ${isMobileHeaderCollapsed ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex flex-col gap-1 sm:gap-1.5">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-emerald-500 text-slate-950 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-extrabold text-xs sm:text-sm tracking-wider shadow-sm select-none shrink-0">
                QLDC
              </div>
              <div>
                <h1 className="font-bold text-xs sm:text-sm md:text-base text-white tracking-wide uppercase leading-tight">
                  HỆ THỐNG QUẢN LÝ DÂN CƯ TRỰC TUYẾN
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                  Mô hình quản lý Tổ dân phố / Khu phố thông minh tại Việt Nam
                </p>
              </div>
            </div>

            {/* Collapse Button for Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileHeaderCollapsed(true)}
              className="md:hidden flex items-center gap-1 text-[10px] font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-700 transition-all cursor-pointer shrink-0"
              title="Thu gọn khung thanh công cụ"
            >
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ẩn Banner</span>
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-slate-400 pl-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              Kết nối máy chủ: Online
            </span>
            <span className="text-slate-700">|</span>
            <span>Cơ sở dữ liệu quốc gia dân cư 2026</span>
          </div>
        </div>

        {/* Zoom Control Panel in the pill style - highly responsive */}
        <div className="flex items-center justify-between sm:justify-start bg-slate-950/80 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-slate-800 shadow-inner w-full md:w-auto max-w-sm md:max-w-none">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mr-2 sm:mr-3 select-none shrink-0">
            <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">THU PHÓNG:</span>
          </span>
          <div className="flex items-center flex-1 sm:flex-initial justify-center gap-1">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-xs font-bold transition-all hover:bg-slate-800 cursor-pointer"
              title="Thu nhỏ"
            >
              -
            </button>
            <input
              type="range"
              min="50"
              max="150"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-16 xs:w-24 sm:w-28 accent-emerald-500 h-1 rounded-lg cursor-pointer bg-slate-800 mx-1 sm:mx-2"
            />
            <button
              onClick={() => setZoom(Math.min(150, zoom + 10))}
              className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-xs font-bold transition-all hover:bg-slate-800 cursor-pointer"
              title="Phóng to"
            >
              +
            </button>
          </div>
          <button
            onClick={() => setZoom(100)}
            className="text-[10px] sm:text-[11px] font-bold text-emerald-400 hover:text-white px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-900 border border-slate-700/80 rounded-lg transition-all flex items-center gap-1 ml-2 sm:ml-3 shadow-sm cursor-pointer shrink-0"
            title="Đặt lại 100%"
          >
            <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            100%
          </button>
        </div>
      </header>

      {/* Main Container - Responsive layout adapting to detected device */}
      <main className="flex-1 flex justify-center items-stretch bg-slate-950 overflow-hidden relative">
        <div 
          className="bg-slate-100 text-slate-900 overflow-hidden flex flex-col absolute top-0 left-0"
          style={{ 
            zoom: zoom / 100,
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale"
          }}
        >
          {children(isDetectedMobile, isDetectedMobile ? (isIos ? "ios" : "android") : "web")}
        </div>
      </main>
    </div>
  );
}
