import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, MapPin, X, Maximize2, Minimize2 } from "lucide-react";

// Cấu hình icon ghim bản đồ bằng SVG Data URL (offline, 100% không cần kết nối CDN external)
const defaultSvgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 24 36"><path fill="#ef4444" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12zm0 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/><circle cx="12" cy="12" r="4" fill="#FFFFFF"/></svg>`;

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(defaultSvgPin)}`,
  iconRetinaUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(defaultSvgPin)}`,
  shadowUrl: "",
});

declare global {
  interface Window {
    google?: any;
  }
}

type Coordinates = { lat: number; lng: number };

interface MapPickerModalProps {
  isOpen: boolean;
  initialLat?: number | string;
  initialLng?: number | string;
  onClose: () => void;
  onSelect: (coordinates: Coordinates) => void;
}

const DEFAULT_CENTER: Coordinates = { lat: 11.367716, lng: 106.136728 };

function toCoordinate(value: number | string | undefined) {
  const coordinate =
    typeof value === "number"
      ? value
      : Number.parseFloat(value || "");

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function LocationPicker({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

// Component di chuyển mượt bản đồ Leaflet khi chọn vị trí mới
function FlyTo({ position }: { position: Coordinates }) {
  const map = useMap();
  const lastPosRef = React.useRef<string>("");

  useEffect(() => {
    const key = `${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
    if (key === lastPosRef.current) return;
    lastPosRef.current = key;
    map.flyTo([position.lat, position.lng], map.getZoom());
  }, [position.lat, position.lng, map]);

  return null;
}

// Component tự động cập nhật kích thước khung bản đồ Leaflet khi thay đổi chế độ phóng to / thu nhỏ
function MapResizer({ isZoomed, isOpen }: { isZoomed: boolean; isOpen: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timers = [
      setTimeout(() => map.invalidateSize(), 50),
      setTimeout(() => map.invalidateSize(), 200),
      setTimeout(() => map.invalidateSize(), 500),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, [map, isZoomed, isOpen]);

  return null;
}

import { getCurrentGpsLocation } from "../utils/geolocation";

export default function MapPickerModal({
  isOpen,
  initialLat,
  initialLng,
  onClose,
  onSelect,
}: MapPickerModalProps) {
  const [selected, setSelected] = useState<Coordinates>(() => ({ ...DEFAULT_CENTER }));
  const [layerType, setLayerType] = useState<"satellite" | "roadmap">("satellite");
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);

  const updateSelectedPosition = (position: Coordinates) => {
    setSelected(position);
    loadAddress(position.lat, position.lng);
  };

  // Cập nhật vị trí ban đầu khi Modal mở ra
  useEffect(() => {
    if (isOpen) {
      const lat = toCoordinate(initialLat);
      const lng = toCoordinate(initialLng);
      const initialPosition = lat !== undefined && lng !== undefined ? { lat, lng } : { ...DEFAULT_CENTER };
      setSelected(initialPosition);
      loadAddress(initialPosition.lat, initialPosition.lng);
      setLayerType("satellite");
    }
  }, [isOpen, initialLat, initialLng]);

  const loadAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      if (!response.ok) {
        setSelectedAddress(`Tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        return;
      }
      const result = await response.json();
      setSelectedAddress(result.display_name ?? `Tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch {
      setSelectedAddress(`Tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const searchAddress = async () => {
    if (!searchText.trim()) return;

    try {
      setSearching(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`
      );
      const result = await response.json();

      if (!result.length) {
        alert("Không tìm thấy địa chỉ.");
        return;
      }

      const location = result[0];
      const newPosition = {
        lat: Number(location.lat),
        lng: Number(location.lon),
      };

      updateSelectedPosition(newPosition);
    } catch {
      alert("Không thể tìm kiếm địa chỉ.");
    } finally {
      setSearching(false);
    }
  };

  const getCurrentLocation = () => {
    getCurrentGpsLocation((coords) => {
      updateSelectedPosition({
        lat: coords.lat,
        lng: coords.lng,
      });
    });
  };

  if (!isOpen) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className={`flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${
        isZoomed ? "max-w-6xl h-[90vh] md:h-[94vh]" : "max-h-[90vh] max-w-3xl"
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between bg-blue-700 px-5 py-4 text-white shrink-0">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <MapPin className="h-5 w-5" /> Chọn vị trí bản đồ
            </h3>
            <p className="mt-0.5 text-[11px] text-blue-100">
              Bấm vào bản đồ hoặc kéo ghim đến đúng vị trí.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="rounded-lg p-1.5 text-blue-100 hover:bg-blue-600 hover:text-white transition cursor-pointer"
              title={isZoomed ? "Thu nhỏ cửa sổ" : "Phóng to / Thu phóng cửa sổ"}
            >
              {isZoomed ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-blue-100 hover:bg-blue-600 hover:text-white transition cursor-pointer"
              aria-label="Đóng bản đồ"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 overflow-y-auto p-4 flex-1 max-h-[calc(90vh-70px)] md:max-h-[calc(94vh-70px)]">
          {/* Nút chuyển đổi lớp bản đồ */}
          <div className="flex items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
            <div className="flex bg-white rounded-full p-1 border border-slate-200 shadow-xs gap-1">
              <button
                type="button"
                onClick={() => setLayerType("satellite")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  layerType === "satellite"
                    ? "bg-[#0b7a43] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>🛰️</span> Vệ tinh
              </button>
              <button
                type="button"
                onClick={() => setLayerType("roadmap")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  layerType === "roadmap"
                    ? "bg-[#0b7a43] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>🗺️</span> Đường xá (OSM)
              </button>
            </div>
          </div>

          {/* Khung chứa Bản đồ với điều khiển nổi */}
          <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner z-0 shrink-0 ${
            isZoomed ? "h-[500px] md:h-[620px]" : "h-[360px] md:h-[400px]"
          }`}>
            {/* Nút Vị trí hiện tại - Nổi góc trên bên trái bên cạnh nút zoom */}
            <div className="absolute top-3 left-12 sm:left-16 z-[1000]">
              <button
                type="button"
                onClick={getCurrentLocation}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold shadow-xl border-2 border-white ring-2 ring-emerald-500/50 transition-all cursor-pointer"
                title="Định vị vị trí hiện tại của bạn"
              >
                <Crosshair className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse shrink-0" />
                <span className="whitespace-nowrap">Vị trí hiện tại</span>
              </button>
            </div>

            {/* Nhãn loại bản đồ - Nổi góc trên bên phải */}
            <div className="absolute top-3 right-2 sm:right-3 z-[1000]">
              {layerType === "satellite" ? (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0b7a43] text-white font-bold rounded-full text-xs shadow-md border border-emerald-500/80">
                  <span>🛰️</span>
                  <span>Vệ tinh</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0b7a43] text-white font-bold rounded-full text-xs shadow-md border border-emerald-500/80">
                  <span>🗺️</span>
                  <span>Đường xá</span>
                </div>
              )}
            </div>

            {/* Bản đồ chính */}
            <MapContainer
              center={[selected.lat, selected.lng]}
              zoom={15}
              maxZoom={20}
              className="h-full w-full z-0"
            >
              {layerType === "satellite" ? (
                <TileLayer
                  attribution='&copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps Vệ Tinh</a>'
                  url="https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}"
                  subdomains={["0", "1", "2", "3"]}
                  maxZoom={22}
                  maxNativeZoom={20}
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps</a>'
                  url="https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}"
                  subdomains={["0", "1", "2", "3"]}
                  maxZoom={22}
                  maxNativeZoom={20}
                />
              )}
                <Marker
                  position={[selected.lat, selected.lng]}
                  draggable={true}
                  eventHandlers={{
                    dragend(e) {
                      const marker = e.target;
                      const p = marker.getLatLng();
                      setSelected({ lat: p.lat, lng: p.lng });
                      loadAddress(p.lat, p.lng);
                    },
                  }}
                />
                <FlyTo position={selected} />
                <MapResizer isZoomed={isZoomed} isOpen={isOpen} />
                <LocationPicker
                  onPick={(lat, lng) => {
                    setSelected({ lat, lng });
                    loadAddress(lat, lng);
                  }}
                />
              </MapContainer>
          </div>

          {/* Thanh tìm kiếm */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nhập địa chỉ hoặc tên địa điểm..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-blue-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchAddress();
                }
              }}
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={searching}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {searching ? "Đang tìm..." : "🔍 Tìm"}
            </button>
          </div>

          {/* Hiển thị địa chỉ đã chọn */}
          {selectedAddress && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-700">📍 Địa chỉ đã chọn:</div>
              <div className="mt-1 text-slate-600">{selectedAddress}</div>
            </div>
          )}

          {/* Nhập tọa độ thủ công */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Vĩ độ (Lat)
              <input
                type="number"
                step="any"
                value={selected.lat}
                onChange={(event) => {
                  const lat = Number.parseFloat(event.target.value);
                  if (Number.isFinite(lat)) updateSelectedPosition({ ...selected, lat });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 focus:outline-blue-600"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Kinh độ (Lng)
              <input
                type="number"
                step="any"
                value={selected.lng}
                onChange={(event) => {
                  const lng = Number.parseFloat(event.target.value);
                  if (Number.isFinite(lng)) updateSelectedPosition({ ...selected, lng });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 focus:outline-blue-600"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Mở Google Maps bên ngoài
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onSelect(selected)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Crosshair className="h-3.5 w-3.5" /> Dùng vị trí này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}