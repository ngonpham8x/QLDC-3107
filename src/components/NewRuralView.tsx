/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Award, Map, MapPin, Eye, Plus, CheckCircle, XCircle,
  Settings, Check, X, Compass, Activity, ShieldAlert, Download, Printer,
  Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Sliders, Crosshair,
  Phone, Calendar, Users
} from "lucide-react";
import { RuralCriteria, Household, Resident, User, UserRole, canUserPerformAction } from "../types";
import { getCurrentGpsLocation } from "../utils/geolocation";
import GoogleGISMap from "./GoogleGISMap";

interface NewRuralViewProps {
  criteria: RuralCriteria[];
  households: Household[];
  residents?: Resident[];
  currentUser: User | null;
  onUpdateCriteria: (updated: RuralCriteria) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
}

export default function NewRuralView({
  criteria, households, residents = [], currentUser, onUpdateCriteria, onExport
}: NewRuralViewProps) {
  
  const [activeTab, setActiveTab] = useState<"criteria" | "gis">("gis");
  const [selectedHousePin, setSelectedHousePin] = useState<Household | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  // GIS Zoom, Pan, Fullscreen and Ward/Tổ Selection States
  const [mapZoom, setMapZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [selectedGisTo, setSelectedGisTo] = useState<string>("ALL");

  // Extract unique Tổ (wardId) from households list
  const uniqueTos = React.useMemo(() => {
    const tos = households
      .map(h => h.wardId || "")
      .filter(w => w.trim() !== "");
    return Array.from(new Set(tos)).sort();
  }, [households]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mapZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || mapZoom <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleGetCurrentLocation = () => {
    getCurrentGpsLocation(
      (coords) => {
        setCurrentLocation([coords.lat, coords.lng]);
        setMapZoom(1);
        setPanOffset({ x: 0, y: 0 });
      },
      (err) => alert(err)
    );
  };

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 }); // reset pan when fit to screen
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setMapZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      // scroll up -> zoom in
      setMapZoom(prev => Math.min(prev + 0.25, 5));
    } else {
      // scroll down -> zoom out
      setMapZoom(prev => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) {
          setPanOffset({ x: 0, y: 0 });
        }
        return next;
      });
    }
  };

  // Config Criteria state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<any>("Thu nhập");
  const [formValue, setFormValue] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formStatus, setFormStatus] = useState<"Đạt" | "Chưa đạt">("Đạt");

  const handleSubmitNewCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formValue.trim() || !formTarget.trim()) {
      alert("Vui lòng điền đủ tên, hiện trạng, và đích chỉ tiêu!");
      return;
    }

    const newCriteria: RuralCriteria = {
      id: `TC-${Date.now()}`,
      name: formName,
      status: formStatus,
      value: formValue,
      targetValue: formTarget,
      category: formCategory,
      lastUpdated: new Date().toISOString().split("T")[0]
    };

    onUpdateCriteria(newCriteria);
    setIsFormOpen(false);
    setFormName("");
    setFormValue("");
    setFormTarget("");
  };

  // Convert GPS coordinate to custom SVG grid space for mock GIS
  const convertCoordsToSvg = (lat?: number, lng?: number) => {
    // Default fallback bounds of our simulated neighborhood in Phường Bình Minh, Tây Ninh
    const minLat = 11.330;
    const maxLat = 11.378;
    const minLng = 106.105;
    const maxLng = 106.145;

    let actualLat = lat || 11.3450;
    let actualLng = lng || 106.1250;

    // Handle old HCMC-bound mock coordinates and map them smoothly to Phường Bình Minh bounds
    if (actualLat < 11.0 && actualLng > 106.5) {
      const hcmcMinLat = 10.775;
      const hcmcMaxLat = 10.795;
      const hcmcMinLng = 106.695;
      const hcmcMaxLng = 106.715;

      const latPct = (actualLat - hcmcMinLat) / (hcmcMaxLat - hcmcMinLat);
      const lngPct = (actualLng - hcmcMinLng) / (hcmcMaxLng - hcmcMinLng);

      actualLat = minLat + latPct * (maxLat - minLat);
      actualLng = minLng + lngPct * (maxLng - minLng);
    }

    // Percentages
    const xPct = ((actualLng - minLng) / (maxLng - minLng)) * 100;
    // Lat is inverted on screen coordinates (Y-axis points down)
    const yPct = 100 - (((actualLat - minLat) / (maxLat - minLat)) * 100);

    return {
      x: Math.min(Math.max(xPct, 10), 90),
      y: Math.min(Math.max(yPct, 10), 90)
    };
  };

  const getGenerationLabel = (hh: Household, allResidents: Resident[] = []) => {
    const members = allResidents.filter(r => r.householdId === hh.id && r.occupation !== "Đã qua đời");
    if (members.length === 0) return "Hộ gia đình khác";

    const normalize = (s: string) => s.trim().toLowerCase();
    let hasChildren = false;
    let hasParents = false;
    let hasGrandparents = false;
    let hasGrandchildren = false;

    members.forEach(m => {
      const rel = normalize(m.relationToOwner || "");
      if (rel.includes("con")) hasChildren = true;
      else if (rel.includes("bố") || rel.includes("mẹ") || rel.includes("cha")) hasParents = true;
      else if (rel.includes("ông") || rel.includes("bà")) hasGrandparents = true;
      else if (rel.includes("cháu")) hasGrandchildren = true;
    });

    let generationsCount = 1;
    if (hasParents || hasGrandparents) generationsCount++;
    if (hasChildren || hasGrandchildren) generationsCount++;

    if (generationsCount >= 3) return "Hộ gia đình 3 thế hệ trở lên";
    if (generationsCount === 2) return "Hộ gia đình 2 thế hệ";
    return "Hộ gia đình 1 thế hệ (vợ, chồng)";
  };

  const renderGisDetailPanel = () => {
    const members = selectedHousePin ? (residents || []).filter(r => r.householdId === selectedHousePin.id) : [];
    const ownerRes = members.find(r => r.id === selectedHousePin?.ownerId || r.relationToOwner === "Chủ hộ" || r.fullName === selectedHousePin?.ownerName);
    const ownerPhone = selectedHousePin?.phone || ownerRes?.phone;
    const ownerBirthDate = ownerRes?.birthDate;
    const ownerAge = ownerBirthDate ? (new Date().getFullYear() - new Date(ownerBirthDate).getFullYear()) : undefined;

    return (
      <div className="flex flex-col justify-between h-full space-y-4">
        {selectedHousePin ? (
          <div className="space-y-3.5 text-xs text-slate-700">
            {/* Top Header Row */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="bg-slate-100 text-slate-600 font-bold text-[11px] px-3 py-1 rounded-full font-mono tracking-wider">
                {selectedHousePin.id}
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1 rounded-xl shadow-2xs">
                {selectedHousePin.status}
              </span>
            </div>

            {/* Owner Info */}
            <div>
              <h4 className="text-lg font-bold text-slate-900 leading-tight">{selectedHousePin.ownerName}</h4>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Chủ hộ đại diện gia đình</p>

              {/* Contact & Age Box */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs font-medium text-slate-700 bg-emerald-50/70 border border-emerald-150 p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>SĐT: <strong className="font-bold text-slate-900">{ownerPhone || "Chưa cập nhật"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Tuổi: <strong className="font-bold text-slate-900">{ownerAge ? `${ownerAge} tuổi` : (ownerBirthDate ? ownerBirthDate : "Chưa cập nhật")}</strong></span>
                </div>
              </div>
            </div>

            {/* Address & Members info */}
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-start gap-1.5 text-slate-500 leading-snug">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div>{selectedHousePin.address}</div>
                  <div className="font-medium text-slate-700">{selectedHousePin.wardId || "Tổ 5"}{selectedHousePin.quarterId ? ` • ${selectedHousePin.quarterId}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Số thành viên trong hộ: <strong className="font-bold text-slate-900">{members.length} nhân khẩu</strong></span>
              </div>
            </div>

            {/* Badges / Tags list */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {/* Thế hệ */}
              <span className="bg-sky-50 text-blue-700 border border-sky-200/90 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                {getGenerationLabel(selectedHousePin, residents)}
              </span>

              {/* Gia đình văn hóa */}
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/90 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Gia đình văn hóa
              </span>

              {/* Rác thải */}
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                selectedHousePin.wasteCollectionStatus === "Chưa đăng ký" || !selectedHousePin.wasteCollectionStatus
                  ? "bg-rose-50 text-rose-700 border-rose-200/90"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200/90"
              }`}>
                Rác: {selectedHousePin.wasteCollectionStatus || (selectedHousePin.isWasteFeePaid ? "Thu gom định kỳ" : "Chưa đăng ký")}
              </span>

              {/* Nước sạch */}
              <span className="bg-amber-50 text-amber-900 border border-amber-300/80 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                Nước: {selectedHousePin.waterSource || "Nước máy tập trung"}
              </span>

              {/* Hộ nông nghiệp */}
              <span className="bg-orange-50 text-orange-800 border border-orange-300/90 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                Hộ nông nghiệp: {selectedHousePin.isAgri ? "Có" : (selectedHousePin.housingType || "Không")}
              </span>

              {/* Thuế PNN */}
              <span className="bg-sky-50 text-blue-900 border border-sky-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                Thuế PNN: {selectedHousePin.isNonAgriTaxPaid ? "Đã nộp" : "Miễn nộp"}
              </span>
            </div>

            {/* Household Photo */}
            {selectedHousePin.photoUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 h-36 relative mt-2 shadow-xs">
                <img src={selectedHousePin.photoUrl} alt="Ảnh hộ dân thực địa" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute bottom-1.5 left-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-xs font-mono">
                  Ảnh chụp địa chính thực địa
                </div>
              </div>
            )}

            {/* Notes Box */}
            {selectedHousePin.notes && (
              <div className="mt-2 bg-amber-50/80 border border-amber-300/80 rounded-xl p-3 text-xs text-amber-950 leading-relaxed shadow-2xs">
                <span className="font-bold text-amber-900">Ghi chú: </span>
                <span className="italic text-amber-900">{selectedHousePin.notes}</span>
              </div>
            )}

            {/* Member count summary only */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Số lượng thành viên nhân khẩu:</span>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  {members.length} nhân khẩu
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between space-y-3 pt-1">
            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 text-emerald-950 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" /> THỐNG KÊ GPS TOẠ ĐỘ
                </span>
                <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {households.filter(h => h.gpsLat && h.gpsLng && !Number.isNaN(Number(h.gpsLat))).length} / {households.length} Hộ
                </span>
              </div>
              <div className="text-xs text-emerald-800 leading-relaxed font-medium">
                Tỷ lệ phủ sóng định vị địa chính đạt <strong className="text-emerald-900 font-extrabold">{Math.round((households.filter(h => h.gpsLat && h.gpsLng && !Number.isNaN(Number(h.gpsLat))).length / (households.length || 1)) * 100)}%</strong> trên toàn khu vực Tổ dân phố.
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 text-xs">
              <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wide flex items-center gap-1 mb-1">
                <span>📍 PHÂN LOẠI MÀU MẮT GHIM (PIN):</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-slate-600">
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="flex items-center gap-1.5 font-medium text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-600"></span> 🔵 Ghim Xanh:
                  </span>
                  <span className="font-bold text-slate-800 text-[11px]">Tọa độ độc lập</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="flex items-center gap-1.5 font-medium text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600"></span> 🟠 Ghim Cam:
                  </span>
                  <span className="font-bold text-amber-800 text-[11px]">Tọa độ trùng / gần nhau</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="flex items-center gap-1.5 font-medium text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600"></span> 🔴 Ghim Đỏ:
                  </span>
                  <span className="font-bold text-red-700 text-[11px]">Hộ đang chọn xem</span>
                </div>
              </div>
            </div>

            <div className="text-center p-2 text-slate-400 space-y-1">
              <p className="font-bold text-xs text-slate-600">Chưa chọn Hộ gia đình</p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Nhấp vào bất kỳ <b className="text-emerald-700">ghim màu nào</b> trên bản đồ để mở hồ sơ chi tiết.
              </p>
            </div>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 leading-relaxed shrink-0">
          <b>* Định hướng quy hoạch:</b> Mô-đun GIS giúp cán bộ Tổ trưởng phân loại phân bổ cứu trợ dựa theo dữ liệu thực địa bản đồ địa dư Phường Bình Minh, Tây Ninh.
        </div>
      </div>
    );
  };

  const renderGisMapContents = (isBig: boolean) => {
    return (
      <div className="w-full h-full relative overflow-hidden flex flex-col justify-between">
        {/* Top map widgets */}
        <div className="absolute top-4 left-4 z-10 bg-slate-950/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 text-white text-xs shadow-xl select-none max-w-[240px] md:max-w-xs">
          <p className="font-bold flex items-center gap-1.5 text-slate-200">
            <Compass className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
            VỆ TINH GIS ĐỊA CHÍNH TỔ
          </p>
          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Tọa độ trung tâm: 11.367716N, 106.136728E (12.29 km)</p>
          <div className="flex flex-col gap-2 mt-3">
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-500 transition"
            >
              <span className="inline-flex items-center gap-1"><Crosshair className="w-3.5 h-3.5" /> Vị trí hiện tại</span>
            </button>
            <select
              value={selectedGisTo}
              onChange={(e) => setSelectedGisTo(e.target.value)}
              className="bg-slate-900 text-white border border-slate-700 text-[10px] focus:outline-none cursor-pointer font-extrabold pr-1 focus:ring-0 rounded-xl px-2 py-1 w-full"
            >
              <option value="ALL" className="bg-slate-950 text-white">Tất cả các Tổ</option>
              {uniqueTos.map(to => (
                <option key={to} value={to} className="bg-slate-950 text-white">{to}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Map Information / Hover coordinates info at bottom left */}
        <div className="absolute bottom-14 left-4 z-10 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-[9px] text-slate-300 select-none font-mono hidden md:block">
          <p>Góc nhìn từ trên cao: ~9,968 km | Phóng đại: {mapZoom.toFixed(2)}x</p>
          {mapZoom > 1 && <p className="text-[8px] text-emerald-400 mt-0.5 font-sans">Kéo rê chuột trái trên bản đồ để di chuyển</p>}
          {currentLocation && (
            <p className="text-[8px] text-emerald-300 mt-1">Vị trí hiện tại: {currentLocation[0].toFixed(6)}, {currentLocation[1].toFixed(6)}</p>
          )}
        </div>
        <div className="absolute bottom-14 right-4 z-10 flex flex-col gap-1.5 bg-slate-950/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl select-none">
          <button 
            type="button"
            onClick={handleZoomIn} 
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Phóng to (Zoom In)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={handleZoomOut} 
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Thu nhỏ (Zoom Out)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={handleResetZoom} 
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Thiết lập lại (Reset Zoom)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <div className="w-full border-t border-slate-800 my-0.5"></div>

          <button 
            type="button"
            onClick={handleGetCurrentLocation} 
            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg border border-emerald-400/80 transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-1"
            title="Lấy vị trí hiện tại"
          >
            <Crosshair className="w-5 h-5 animate-pulse" />
          </button>

          <button 
            type="button"
            onClick={() => setIsFullscreenMap(!isBig)} 
            className="p-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title={isBig ? "Thu nhỏ cửa sổ lớn" : "Phóng to toàn màn hình (Fullscreen)"}
          >
            {isBig ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Map SVG container viewport with grab cursors */}
        <div 
          className={`w-full h-full overflow-hidden relative select-none ${mapZoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
        >
          {/* Simulated Street Grid Map (Drawn using beautiful vector graphics) */}
          <svg 
            className="w-full h-full transition-transform duration-75 ease-out" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            style={{
              transform: `scale(${mapZoom}) translate(${panOffset.x / mapZoom}px, ${panOffset.y / mapZoom}px)`,
              transformOrigin: "center center",
            }}
          >
            {/* Back background texture for satellite vibe */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#334155" strokeWidth="0.1" strokeOpacity="0.4" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {/* River/Water vector */}
            <path d="M 0 85 Q 35 70, 70 90 T 100 80" fill="none" stroke="#0369a1" strokeWidth="12" strokeLinecap="round" strokeOpacity="0.3" />
            <text x="35" y="81" fill="#38bdf8" fontSize="2" fontWeight="bold" opacity="0.6" transform="rotate(-5, 35, 81)">Bờ Kênh Thanh Đa</text>

            {/* Street vectors */}
            {/* Hoa Sữa street */}
            <line x1="15" y1="0" x2="15" y2="100" stroke="#475569" strokeWidth="3" strokeOpacity="0.6" />
            <text x="14" y="25" fill="#94a3b8" fontSize="2" fontWeight="bold" opacity="0.8" transform="rotate(-90, 14, 25)">Đường Hoa Sữa (Tổ 5)</text>

            {/* Hoa Hồng street */}
            <line x1="50" y1="0" x2="50" y2="100" stroke="#475569" strokeWidth="3" strokeOpacity="0.6" />
            <text x="49" y="40" fill="#94a3b8" fontSize="2" fontWeight="bold" opacity="0.8" transform="rotate(-90, 49, 40)">Đường Hoa Hồng (Tổ 5)</text>

            {/* Điện Biên Phủ main highway */}
            <line x1="0" y1="50" x2="100" y2="50" stroke="#64748b" strokeWidth="4.5" strokeOpacity="0.6" />
            <text x="70" y="48" fill="#cbd5e1" fontSize="2.2" fontWeight="bold" opacity="0.9">Đại lộ Điện Biên Phủ (Tổ 6)</text>

            {/* Plots and grids */}
            <rect x="25" y="10" width="15" height="15" rx="1" fill="#1e293b" opacity="0.4" stroke="#334155" strokeWidth="0.2" />
            <rect x="65" y="10" width="20" height="20" rx="1" fill="#1e293b" opacity="0.4" stroke="#334155" strokeWidth="0.2" />
            <text x="71" y="21" fill="#64748b" fontSize="2.5" fontWeight="bold" opacity="0.5">Khu Nam Long</text>

            {/* Interactive Household Pins mapped to their SVG positions */}
            {households.map((h) => {
              const pos = convertCoordsToSvg(h.gpsLat, h.gpsLng);
              const isSelected = selectedHousePin?.id === h.id;
              
              // Check if this household belongs to the selected Tổ
              const isBelongingToSelectedTo = selectedGisTo === "ALL" || h.wardId === selectedGisTo;
              
              // If we want to hide or fade out others
              const opacityClass = isBelongingToSelectedTo ? "opacity-100" : "opacity-20 transition-opacity duration-300";

              return (
                <g 
                  key={h.id} 
                  className={`cursor-pointer group transition-all duration-300 ${opacityClass}`}
                  onClick={() => setSelectedHousePin(h)}
                >
                  {/* Animated aura ring for highlight */}
                  {isBelongingToSelectedTo && (
                    <circle 
                      cx={pos.x} cy={pos.y} r={isSelected ? "4.5" : "2.5"} 
                      fill="none" 
                      stroke={h.status === "Hộ nghèo" ? "#f43f5e" : "#10b981"} 
                      strokeWidth="0.5" 
                      className="animate-ping" 
                      opacity="0.6"
                    />
                  )}

                  {/* Outer Pin */}
                  <circle 
                    cx={pos.x} cy={pos.y} r={isSelected ? "2.5" : isBelongingToSelectedTo ? "1.8" : "1.2"} 
                    fill={h.status === "Hộ nghèo" ? "#ef4444" : h.status === "Hộ cận nghèo" ? "#f59e0b" : "#10b981"} 
                    stroke="#ffffff" 
                    strokeWidth={isBelongingToSelectedTo ? "0.3" : "0.15"}
                  />

                  {/* Text initials inside pin */}
                  {isBelongingToSelectedTo && (
                    <text 
                      x={pos.x} y={pos.y + 0.5} 
                      fill="#ffffff" 
                      fontSize="1" 
                      textAnchor="middle" 
                      fontWeight="bold"
                    >
                      H
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom help bar */}
        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between shrink-0 select-none z-10 rounded-b-2xl">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white"></span> Hộ Nghèo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white"></span> Hộ Cận Nghèo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white"></span> Hộ Bình Thường</span>
        </div>
      </div>
    );
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    const headers = [
      "STT", "Mã Tiêu Chí", "Tên Tiêu Chí", "Nhóm Lĩnh Vực", "Giá Trị Đạt Được", "Giá Trị Mục Tiêu", "Trạng Thái"
    ];
    const rows = criteria.map((c, idx) => [
      idx + 1,
      c.id,
      c.name,
      c.category,
      c.value,
      c.targetValue,
      c.status
    ]);
    onExport(type, "Chỉ số xây dựng Nông thôn mới", headers, rows);
  };

  return (
    <div id="new-rural-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-600" />
            Xây dựng Nông thôn mới & Đô thị văn minh
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi bộ tiêu chí quốc gia xây dựng đời sống mới kết hợp bản đồ vệ tinh số hóa (GIS)
          </p>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {onExport && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                title="Xuất bảng dữ liệu tiêu chí sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                title="Xuất bản in báo cáo PDF của các tiêu chí"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF (In)
              </button>
            </div>
          )}

          {/* Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("criteria")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === "criteria" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Tiêu chí đạt chuẩn
            </button>
            <button
              onClick={() => setActiveTab("gis")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === "gis" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Bản đồ địa lý (GIS)
            </button>
          </div>
        </div>
      </div>

      {activeTab === "criteria" ? (
        /* TAB 1: bộ tiêu chí đạt chuẩn */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl">
            <div>
              <h3 className="font-bold text-slate-700 text-sm">Cơ cấu rà soát tiêu chuẩn</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Đạt chuẩn: {criteria.filter(c => c.status === "Đạt").length} / {criteria.length} tiêu chí quốc gia
              </p>
            </div>
            {canUserPerformAction(currentUser, "add") && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm tiêu chí mới
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {criteria.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                      {c.category}
                    </span>
                    
                    {c.status === "Đạt" ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Đạt chuẩn
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 animate-pulse" /> Chưa đạt
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-800 text-base mt-2 leading-tight">{c.name}</h4>
                  
                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    <p><b>Hiện trạng địa phương:</b> <span className="text-slate-800 font-semibold">{c.value}</span></p>
                    <p><b>Yêu cầu tiêu chuẩn:</b> {c.targetValue}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-[10px] text-slate-400">
                  <span>Cập nhật ngày: {c.lastUpdated}</span>
                  
                  {canUserPerformAction(currentUser, "edit") && (
                    <button
                      onClick={() => {
                        const nextStatus = c.status === "Đạt" ? "Chưa đạt" : "Đạt";
                        onUpdateCriteria({ ...c, status: nextStatus });
                      }}
                      className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-2.5 py-1 rounded font-bold cursor-pointer"
                    >
                      Đổi trạng thái đạt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* TAB 2: Bản đồ địa lý số hoá GIS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map display box (Interactive vector representation of the neighborhoods) */}
          <div className="lg:col-span-2 relative z-0 bg-slate-900 border border-slate-850 rounded-2xl h-[420px] md:h-[460px] overflow-hidden shadow-inner">
            <GoogleGISMap
              households={households}
              selectedHouse={selectedHousePin}
              onSelectHouse={(house) => setSelectedHousePin(house)}
              center={currentLocation || undefined}
              viewZoom={currentLocation ? 15 : undefined}
              currentPosition={currentLocation}
              onGetCurrentLocation={handleGetCurrentLocation}
            />
          </div>

          {/* Sidebar Detail showing chosen house details */}
<div
  className="
    relative
    z-[100]
    bg-white
    border
    border-slate-200
    rounded-2xl
    p-5
    shadow-xl
    flex
    flex-col
    justify-between
    h-[420px]
    md:h-[460px]
  "
>
  {renderGisDetailPanel()}
</div>
        </div>
      )}

      {/* FULL-SCREEN GIS MAP OVERLAY MODAL */}
      {isFullscreenMap && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col p-4 md:p-6 overflow-hidden animate-fade-in">
          {/* Header of fullscreen GIS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <Compass className="w-6 h-6 text-emerald-400 animate-spin shrink-0" />
              <div>
                <h3 className="text-white font-bold text-base md:text-lg">Bản đồ địa lý số hoá hành chính & địa chính (GIS)</h3>
                <p className="text-slate-400 text-xs">Cuộn chuột để zoom, kéo rê chuột để di chuyển bản đồ và click chọn từng hộ dân</p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setIsFullscreenMap(false);
                setMapZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
            >
              <Minimize2 className="w-4 h-4" />
              Thoát bản đồ lớn
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
            {/* The Map on left */}
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-inner h-full">
              {renderGisMapContents(true)}
            </div>

            {/* Sidebar details on right */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full overflow-y-auto">
              {renderGisDetailPanel()}
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CRITERIA DIALOG */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base">Cấu hình tiêu chí đạt chuẩn mới</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-emerald-100 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCriteria} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-600">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên chỉ tiêu quốc gia *</label>
                <input
                  type="text"
                  required
                  placeholder="Tỷ lệ phủ sóng internet cáp quang..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân mục tiêu chí</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    <option value="Thu nhập">Thu nhập</option>
                    <option value="Nhà ở">Nhà ở</option>
                    <option value="Môi trường">Môi trường</option>
                    <option value="Giáo dục">Giáo dục</option>
                    <option value="Y tế">Y tế</option>
                    <option value="Lao động">Lao động</option>
                    <option value="Khác">Phân mục khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái thẩm định</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    <option value="Đạt">Đạt chuẩn</option>
                    <option value="Chưa đạt">Chưa đạt chuẩn</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giá trị hiện trạng *</label>
                  <input
                    type="text"
                    required
                    placeholder="94.5% số hộ dân"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mục tiêu yêu cầu *</label>
                  <input
                    type="text"
                    required
                    placeholder=">= 95% số hộ dân"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
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
                  Thêm vào bộ rà soát
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
