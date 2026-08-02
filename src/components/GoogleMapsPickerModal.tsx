import React, { useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, MapPin, X } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

type Coordinates = { lat: number; lng: number };

interface GoogleMapsPickerModalProps {
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
  const coordinate = typeof value === "number" ? value : Number.parseFloat(value || "");
  return Number.isFinite(coordinate) ? coordinate : undefined;
}

export default function GoogleMapsPickerModal({
  isOpen,
  initialLat,
  initialLng,
  onClose,
  onSelect,
}: GoogleMapsPickerModalProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selected, setSelected] = useState<Coordinates>(() => ({ ...DEFAULT_CENTER }));
  const [mapError, setMapError] = useState("");
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const updateSelectedPosition = (position: Coordinates, panMap = true) => {
    setSelected(position);
    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else if (mapRef.current && window.google?.maps) {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        draggable: true,
      });
      markerRef.current.addListener("dragend", (event: any) => {
        if (!event.latLng) return;
        setSelected({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
    }
    if (panMap && mapRef.current) mapRef.current.panTo(position);
  };

  useEffect(() => {
    if (!isOpen) return;

    const lat = toCoordinate(initialLat);
    const lng = toCoordinate(initialLng);
    const initialPosition = lat !== undefined && lng !== undefined ? { lat, lng } : { ...DEFAULT_CENTER };
    setSelected(initialPosition);
    setMapError("");

    if (!apiKey) {
      setMapError("Chưa cấu hình VITE_GOOGLE_MAPS_API_KEY. Bạn vẫn có thể nhập tọa độ hoặc mở Google Maps bên ngoài.");
      return;
    }

    let disposed = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (disposed || !mapElementRef.current) return;
        const map = new window.google.maps.Map(mapElementRef.current, {
          center: initialPosition,
          zoom: 13,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        markerRef.current = new window.google.maps.Marker({ map, position: initialPosition, draggable: true });
        markerRef.current.addListener("dragend", (event: any) => {
          if (event.latLng) setSelected({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
        map.addListener("click", (event: any) => {
          if (!event.latLng) return;
          const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setSelected(position);
          markerRef.current.setPosition(position);
        });
      })
      .catch((error: Error) => {
        if (!disposed) setMapError(error.message);
      });

    return () => {
      disposed = true;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, initialLat, initialLng, isOpen]);

  if (!isOpen) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-blue-700 px-5 py-4 text-white">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-5 w-5" /> Chọn vị trí trên Google Maps</h3>
            <p className="mt-0.5 text-[11px] text-blue-100">Bấm vào bản đồ hoặc kéo ghim đến đúng vị trí nhà.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-blue-100 hover:bg-blue-600 hover:text-white" aria-label="Đóng bản đồ">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {mapError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{mapError}</div>
          ) : (
            <div ref={mapElementRef} className="h-[360px] w-full rounded-xl border border-slate-200 bg-slate-100" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Vĩ độ
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
              Kinh độ
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800">
            <ExternalLink className="h-3.5 w-3.5" /> Mở Google Maps
          </a>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">Hủy</button>
            <button type="button" onClick={() => onSelect(selected)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Crosshair className="h-3.5 w-3.5" /> Dùng vị trí này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
