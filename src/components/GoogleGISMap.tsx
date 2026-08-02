import React from "react";
import { Household } from "../types";
import { Crosshair } from "lucide-react";

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

interface Props {
    households: Household[];
    selectedHouse?: Household | null;
    onSelectHouse?: (house: Household) => void;
    center?: [number, number];
    viewZoom?: number;
    currentPosition?: [number, number] | null;
    onGetCurrentLocation?: () => void;
    focusResident?: {
        fullName: string;
        id?: string;
        relationToOwner?: string;
        phone?: string;
        permanentAddress?: string;
        lat: number;
        lng: number;
    } | null;
}

const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redMarkerIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    const prevCenterRef = React.useRef<string>("");

    React.useEffect(() => {
        const key = `${center[0].toFixed(5)}_${center[1].toFixed(5)}_${zoom}`;
        if (prevCenterRef.current !== key) {
            prevCenterRef.current = key;
            map.setView(center, zoom, { animate: false });
            const t1 = setTimeout(() => {
                map.invalidateSize();
            }, 150);
            return () => clearTimeout(t1);
        }
    }, [center, zoom, map]);
    return null;
}

const DEFAULT_CENTER: [number, number] = [11.367716, 106.136728];
const DEFAULT_ZOOM = 16; // Level 16 for optimal street detail in Ninh Phú

export default function GoogleGISMap({
    households,
    selectedHouse,
    onSelectHouse,
    center: forcedCenter,
    viewZoom,
    currentPosition,
    onGetCurrentLocation,
    focusResident
}: Props) {
    const [mapType, setMapType] = React.useState<"satellite" | "osm">("osm");
    const selectedMarkerRef = React.useRef<L.Marker | null>(null);
    const focusMarkerRef = React.useRef<L.Marker | null>(null);

    React.useEffect(() => {
        if (selectedMarkerRef.current) {
            const timer = setTimeout(() => {
                selectedMarkerRef.current?.openPopup();
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [selectedHouse?.id]);

    React.useEffect(() => {
        if (focusMarkerRef.current) {
            const timer = setTimeout(() => {
                focusMarkerRef.current?.openPopup();
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [focusResident?.fullName, focusResident?.lat, focusResident?.lng]);

    const getGpsCoords = (h: Household): [number, number] => {
        if (h.gpsLat !== undefined && h.gpsLng !== undefined && !Number.isNaN(Number(h.gpsLat)) && !Number.isNaN(Number(h.gpsLng))) {
            return [Number(h.gpsLat), Number(h.gpsLng)];
        }
        const charSum = (h.id || h.ownerName || "1").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const lat = parseFloat((11.367716 + ((charSum % 20) - 10) * 0.0006).toFixed(6));
        const lng = parseFloat((106.136728 + (((charSum * 3) % 20) - 10) * 0.0006).toFixed(6));
        return [lat, lng];
    };

    const center: [number, number] =
        focusResident
            ? [focusResident.lat, focusResident.lng]
            : forcedCenter ||
              (selectedHouse
                  ? getGpsCoords(selectedHouse)
                  : DEFAULT_CENTER);

    const zoom = viewZoom || DEFAULT_ZOOM;

    return (
        <div className="relative w-full h-full min-h-[350px]">
            {/* Top Controls Overlay Container - Flex wrapped to prevent overlapping text on narrow screens */}
            <div className="absolute top-3 left-14 right-3 z-[1000] pointer-events-none flex flex-wrap items-center justify-end gap-2">
                {onGetCurrentLocation && (
                    <button
                        type="button"
                        onClick={onGetCurrentLocation}
                        className="pointer-events-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1.5 rounded-full text-xs font-semibold shadow-md border border-emerald-500/80 transition-all cursor-pointer shrink-0"
                        title="Định vị vị trí hiện tại của bạn"
                    >
                        <Crosshair className="w-3.5 h-3.5 animate-pulse" />
                        <span>Vị trí <span className="hidden sm:inline">hiện tại</span></span>
                    </button>
                )}

                {/* Tile Layer Switcher - Floating Capsule */}
                <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-1 rounded-full shadow-lg border border-slate-200 flex items-center gap-1 text-xs font-semibold shrink-0">
                    <button
                        type="button"
                        onClick={() => setMapType("satellite")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition cursor-pointer text-xs ${
                            mapType === "satellite" 
                                ? "bg-[#0b7a43] text-white font-bold shadow-xs" 
                                : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                        <span className="text-xs">🛰️</span> Vệ tinh
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType("osm")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition cursor-pointer text-xs ${
                            mapType === "osm" 
                                ? "bg-[#0b7a43] text-white font-bold shadow-xs" 
                                : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                        <span className="text-xs">🗺️</span> Đường xá
                    </button>
                </div>
            </div>

            {/* View Altitude Distance Badge */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/85 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-md border border-slate-700/60 flex items-center gap-1.5 pointer-events-none">
                <span className="text-xs">🚁</span> Tầm nhìn từ trên không: <strong className="text-emerald-400 font-bold">Khoảng cách 12,29 km</strong>
            </div>

            <MapContainer
                center={center}
                zoom={zoom}
                scrollWheelZoom={true}
                doubleClickZoom={true}
                touchZoom={true}
                zoomControl={true}
                dragging={true}
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "16px",
                    minHeight: "350px"
                }}
            >
                {mapType === "satellite" ? (
                    <TileLayer
                        attribution="&copy; Esri World Imagery"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                ) : (
                    <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                )}
                <RecenterMap center={center} zoom={zoom} />

                {currentPosition && !Number.isNaN(currentPosition[0]) && !Number.isNaN(currentPosition[1]) && (
                    <Marker
                        key="current-position"
                        position={currentPosition}
                        icon={markerIcon}
                    >
                        <Popup>Vị trí hiện tại của bạn</Popup>
                    </Marker>
                )}

                {households.filter((h) => h.id !== selectedHouse?.id).map((h) => {
                    const pos = getGpsCoords(h);
                    return (
                        <Marker
                            key={h.id}
                            icon={markerIcon}
                            position={pos}
                            eventHandlers={{
                                click: () => onSelectHouse?.(h)
                            }}
                        >
                            <Popup>
                                <strong>{h.id}</strong>
                                <br />
                                {h.ownerName}
                                <br />
                                {h.address}
                            </Popup>
                        </Marker>
                    );
                })}

                {selectedHouse && (
                    <Marker
                        key={`selected-house-${selectedHouse.id}`}
                        icon={redMarkerIcon}
                        position={getGpsCoords(selectedHouse)}
                        ref={selectedMarkerRef}
                    >
                        <Popup autoPan={false}>
                            <div className="p-1.5 max-w-[240px]">
                                <div className="font-bold text-xs text-red-600 mb-1 flex items-center gap-1">
                                    📍 Vị trí Hộ Khẩu: <span className="font-mono">{selectedHouse.id}</span>
                                </div>
                                <div className="font-extrabold text-slate-800 text-sm">
                                    Chủ hộ: {selectedHouse.ownerName}
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                    Địa chỉ: <strong>{selectedHouse.address}</strong>
                                </div>
                                {selectedHouse.phone && (
                                    <div className="text-xs text-slate-600">
                                        SĐT: <strong>{selectedHouse.phone}</strong>
                                    </div>
                                )}
                                <div className="mt-1.5 pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-1 text-[11px]">
                                    <span className="text-slate-600">Nước sạch: <strong className="text-emerald-700">{selectedHouse.waterSource || "Nước máy"}</strong></span>
                                    <span className="text-slate-600">Rác thải: <strong className="text-blue-700">{selectedHouse.wasteCollectionStatus || "Đã đăng ký"}</strong></span>
                                    <span className="text-slate-600">Diện hộ: <strong className="text-rose-700">{selectedHouse.status || "Bình thường"}</strong></span>
                                    <span className="text-slate-600">Hộ nông nghiệp: <strong className="text-slate-700">{selectedHouse.isAgri ? "Có" : "Không"}</strong></span>
                                </div>
                                <div className="text-[10px] text-emerald-700 font-mono mt-2 font-bold bg-emerald-50 p-1 rounded border border-emerald-100 text-center">
                                    Tọa độ: {getGpsCoords(selectedHouse)[0].toFixed(6)}, {getGpsCoords(selectedHouse)[1].toFixed(6)}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {focusResident && !Number.isNaN(focusResident.lat) && !Number.isNaN(focusResident.lng) && (
                    <Marker
                        key={`focus-res-${focusResident.fullName}`}
                        icon={redMarkerIcon}
                        position={[focusResident.lat, focusResident.lng]}
                        ref={focusMarkerRef}
                    >
                        <Popup autoPan={false}>
                            <div className="p-1 max-w-[220px]">
                                <div className="font-bold text-sm text-red-600 mb-1 flex items-center gap-1">
                                    📍 Vị trí Nhân Khẩu
                                </div>
                                <div className="font-bold text-slate-800 text-sm">{focusResident.fullName}</div>
                                {focusResident.relationToOwner && (
                                    <div className="text-xs text-slate-600">Quan hệ: <strong>{focusResident.relationToOwner}</strong></div>
                                )}
                                {focusResident.phone && (
                                    <div className="text-xs text-slate-600">SĐT: <strong>{focusResident.phone}</strong></div>
                                )}
                                {focusResident.permanentAddress && (
                                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">Địa chỉ: {focusResident.permanentAddress}</div>
                                )}
                                <div className="text-[10px] text-emerald-700 font-mono mt-1 font-bold">
                                    Tọa độ: {focusResident.lat.toFixed(6)}, {focusResident.lng.toFixed(6)}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}
