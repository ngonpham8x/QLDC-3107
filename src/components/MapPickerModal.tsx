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

// Khắc phục lỗi icon mặc định của Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (!apiKey || apiKey === "YOUR_API_KEY" || !apiKey.startsWith("AIza")) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY không hợp lệ."));
  }
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    (window as any).gm_authFailure = () => {
      mapsLoader = null;
      reject(new Error("Khóa Google Maps không hợp lệ hoặc hết hạn."));
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsLoader = null;
      reject(new Error("Không thể tải Google Maps."));
    };
    document.head.appendChild(script);
  });

  return mapsLoader;
}

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
  useEffect(() => {
    map.flyTo([position.lat, position.lng], map.getZoom());
  }, [position, map]);

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

export default function MapPickerModal({
  isOpen,
  initialLat,
  initialLng,
  onClose,
  onSelect,
}: MapPickerModalProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [selected, setSelected] = useState<Coordinates>(() => ({ ...DEFAULT_CENTER }));
  const [mapProvider, setMapProvider] = useState<"google" | "osm">("osm");
  const [layerType, setLayerType] = useState<"satellite" | "roadmap">("roadmap");
  const [mapError, setMapError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    // If Google Maps JS API fails or is not available, we stay on google provider using Leaflet Satellite tiles
  }, [mapError]);

  const updateSelectedPosition = (position: Coordinates, panMap = true) => {
    setSelected(position);
    loadAddress(position.lat, position.lng);

    if (mapProvider === "google" && window.google?.maps) {
      if (markerRef.current) {
        markerRef.current.setPosition(position);
      } else if (mapRef.current) {
        markerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position,
          draggable: true,
        });
        markerRef.current.addListener("dragend", (event: any) => {
          if (!event.latLng) return;
          const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setSelected(newPos);
          loadAddress(newPos.lat, newPos.lng);
        });
      }
      if (panMap && mapRef.current) mapRef.current.panTo(position);
    }
  };

  // Khởi tạo Google Maps khi chọn Provider Google
  useEffect(() => {
    if (!isOpen || mapProvider !== "google") return;

    const lat = toCoordinate(initialLat);
    const lng = toCoordinate(initialLng);
    const initialPosition = lat !== undefined && lng !== undefined ? { lat, lng } : { ...selected };

    if (!apiKey) {
      setMapError("Chưa cấu hình VITE_GOOGLE_MAPS_API_KEY.");
      return;
    }

    let disposed = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (disposed || !mapElementRef.current) return;
        const map = new window.google.maps.Map(mapElementRef.current, {
          center: initialPosition,
          zoom: 17,
          mapTypeId: window.google.maps.MapTypeId.HYBRID,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        markerRef.current = new window.google.maps.Marker({
          map,
          position: initialPosition,
          draggable: true,
        });

        markerRef.current.addListener("dragend", (event: any) => {
          if (event.latLng) {
            const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
            setSelected(newPos);
            loadAddress(newPos.lat, newPos.lng);
          }
        });

        map.addListener("click", (event: any) => {
          if (!event.latLng) return;
          const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setSelected(position);
          if (markerRef.current) markerRef.current.setPosition(position);
          loadAddress(position.lat, position.lng);
        });
      })
      .catch((error: Error) => {
        if (disposed) return;
        setMapError(error.message);
      });

    return () => {
      disposed = true;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, isOpen, mapProvider]);

  useEffect(() => {
    if (mapRef.current && window.google?.maps) {
      setTimeout(() => {
        window.google.maps.event.trigger(mapRef.current, "resize");
        if (selected) mapRef.current.panTo(selected);
      }, 150);
    }
  }, [isZoomed]);

  // Cập nhật vị trí ban đầu khi Modal mở ra
  useEffect(() => {
    if (isOpen) {
      const lat = toCoordinate(initialLat);
      const lng = toCoordinate(initialLng);
      const initialPosition = lat !== undefined && lng !== undefined ? { lat, lng } : { ...DEFAULT_CENTER };
      setSelected(initialPosition);
      loadAddress(initialPosition.lat, initialPosition.lng);
      setMapProvider("osm");
      setLayerType("roadmap");
    }
  }, [isOpen, initialLat, initialLng]);

  const loadAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const result = await response.json();
      setSelectedAddress(result.display_name ?? "");
    } catch {
      setSelectedAddress("");
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          updateSelectedPosition(currentPos);
        },
        () => {
          alert("Không thể lấy vị trí hiện tại của bạn.");
        }
      );
    } else {
      alert("Trình duyệt của bạn không hỗ trợ định vị Geolocation.");
    }
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
          {/* Nút chuyển đổi Provider bản đồ */}
          <div className="flex items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
            <div className="flex bg-white rounded-full p-1 border border-slate-200 shadow-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setMapProvider("osm");
                  setLayerType("roadmap");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  mapProvider === "osm"
                    ? "bg-[#0b7a43] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>🌍</span> OpenStreetMap
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapProvider("google");
                  setLayerType("satellite");
                  if (mapRef.current && window.google?.maps) {
                    mapRef.current.setMapTypeId(window.google.maps.MapTypeId.HYBRID);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  mapProvider === "google"
                    ? "bg-[#0b7a43] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>🗺</span> Google Maps
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
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 text-xs font-bold shadow-md border border-emerald-500/80 transition-all cursor-pointer"
                title="Định vị vị trí hiện tại của bạn"
              >
                <Crosshair className="h-3.5 w-3.5 animate-pulse shrink-0" />
                <span className="hidden sm:inline">Vị trí hiện tại</span>
                <span className="sm:hidden">Vị trí</span>
              </button>
            </div>

            {/* Nút Vệ tinh / Đường xá - Nổi góc trên bên phải */}
            <div className="absolute top-3 right-2 sm:right-3 z-[1000] bg-white/95 backdrop-blur-md p-1 rounded-full shadow-lg border border-slate-200 flex items-center gap-1 text-xs font-semibold">
              {mapProvider === "google" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setLayerType("satellite");
                      if (mapRef.current && window.google?.maps) {
                        mapRef.current.setMapTypeId(window.google.maps.MapTypeId.HYBRID);
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition cursor-pointer ${
                      layerType === "satellite"
                        ? "bg-[#0b7a43] text-white font-bold shadow-xs"
                        : "text-slate-700 hover:bg-slate-100 font-semibold"
                    }`}
                  >
                    <span>🛰️</span>
                    <span className="hidden sm:inline">Vệ tinh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLayerType("roadmap");
                      if (mapRef.current && window.google?.maps) {
                        mapRef.current.setMapTypeId(window.google.maps.MapTypeId.ROADMAP);
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition cursor-pointer ${
                      layerType === "roadmap"
                        ? "bg-[#0b7a43] text-white font-bold shadow-xs"
                        : "text-slate-700 hover:bg-slate-100 font-semibold"
                    }`}
                  >
                    <span>🗺️</span>
                    <span className="hidden sm:inline">Đường xá</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1 bg-[#0b7a43] text-white font-bold rounded-full text-xs">
                  <span>🗺️</span>
                  <span>Đường xá</span>
                </div>
              )}
            </div>

            {/* Bản đồ chính */}
            {mapProvider === "google" && window.google?.maps ? (
              <div
                ref={mapElementRef}
                className="h-full w-full"
              />
            ) : (
              <MapContainer
                center={[selected.lat, selected.lng]}
                zoom={13}
                className="h-full w-full z-0"
              >
                {layerType === "satellite" ? (
                  <TileLayer
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                ) : (
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            )}
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