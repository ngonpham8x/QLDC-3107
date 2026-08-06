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

// Global Leaflet default icon override to prevent missing asset 404 errors
delete (L.Icon.Default.prototype as any)._getIconUrl;
const defaultLeafletSvgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 24 36"><path fill="#0b7a43" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12zm0 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/><circle cx="12" cy="12" r="4" fill="#FFFFFF"/></svg>`;
L.Icon.Default.mergeOptions({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(defaultLeafletSvgPin)}`,
    iconRetinaUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(defaultLeafletSvgPin)}`,
    shadowUrl: "",
});

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

const createMarkerSvgIcon = (color: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 24 36"><path fill="${color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12zm0 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/><circle cx="12" cy="12" r="4" fill="#FFFFFF"/></svg>`;
    return new L.Icon({
        iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -38]
    });
};

const markerIcon = createMarkerSvgIcon("#2563eb"); // Blue
const orangeMarkerIcon = createMarkerSvgIcon("#f97316"); // Orange
const redMarkerIcon = createMarkerSvgIcon("#ef4444"); // Red

function RecenterMap({ center, zoom, bounds }: { center?: [number, number]; zoom?: number; bounds?: L.LatLngBoundsExpression | null }) {
    const map = useMap();
    const lastKeyRef = React.useRef<string>("");

    React.useEffect(() => {
        let key = "";
        if (bounds) {
            try {
                const b = L.latLngBounds(bounds as any);
                key = `bounds:${b.toBBoxString()}`;
            } catch {
                key = "bounds:invalid";
            }
        } else if (center && zoom) {
            key = `center:${center[0].toFixed(6)},${center[1].toFixed(6)},zoom:${zoom}`;
        }

        if (!key || key === lastKeyRef.current) {
            return;
        }

        lastKeyRef.current = key;

        if (bounds) {
            map.fitBounds(bounds, { padding: [45, 45], maxZoom: 17, animate: false });
            const t1 = setTimeout(() => {
                map.invalidateSize();
            }, 150);
            return () => clearTimeout(t1);
        } else if (center && zoom) {
            map.flyTo(center, zoom, { animate: true, duration: 0.8 });
            const t1 = setTimeout(() => {
                map.invalidateSize();
            }, 150);
            return () => clearTimeout(t1);
        }
    }, [center?.[0], center?.[1], zoom, bounds, map]);
    return null;
}

const DEFAULT_CENTER: [number, number] = [11.355000, 106.120000];
const DEFAULT_ZOOM = 15; // Level 15 for ideal view of all households in Ninh Phú

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
    const [mapType, setMapType] = React.useState<"google_map" | "google_hybrid">("google_map");
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

    const isValidGps = (lat?: number, lng?: number): boolean => {
        if (lat === undefined || lng === undefined || lat === null || lng === null) return false;
        const nLat = Number(lat);
        const nLng = Number(lng);
        if (Number.isNaN(nLat) || Number.isNaN(nLng) || nLat === 0 || nLng === 0) return false;
        return true;
    };

    const getCleanGpsCoords = (lat: number, lng: number): [number, number] => {
        const nLat = Number(lat);
        const nLng = Number(lng);
        if (Number.isNaN(nLat) || Number.isNaN(nLng)) {
            return DEFAULT_CENTER;
        }
        return [parseFloat(nLat.toFixed(6)), parseFloat(nLng.toFixed(6))];
    };

    const householdsWithGps = React.useMemo(() => {
        return households.filter((h) => isValidGps(h.gpsLat, h.gpsLng));
    }, [households]);

    // Calculate display position with visual micro-offset for overlapping/very close markers
    const { getAdjustedGpsCoords, isOverlapping, overlappingCount, standaloneCount } = React.useMemo(() => {
        const coordsMap = new Map<string, [number, number]>();
        const overlappingSet = new Set<string>();
        const validList = households.filter((h) => isValidGps(h.gpsLat, h.gpsLng));

        validList.forEach((h, index) => {
            const raw = getCleanGpsCoords(h.gpsLat!, h.gpsLng!);
            let lat = raw[0];
            let lng = raw[1];

            // Check if any other household in validList is within ~0.00035 degrees (~35m)
            let overlapCount = 0;
            for (let i = 0; i < validList.length; i++) {
                if (i === index) continue;
                const other = validList[i];
                const otherRaw = getCleanGpsCoords(other.gpsLat!, other.gpsLng!);
                const dLat = Math.abs(otherRaw[0] - raw[0]);
                const dLng = Math.abs(otherRaw[1] - raw[1]);
                if (dLat < 0.00035 && dLng < 0.00035) {
                    overlappingSet.add(h.id);
                    if (i < index) overlapCount++;
                }
            }

            if (overlapCount > 0) {
                // Apply a small visual offset (~35 meters) to unstack overlapping pin icons
                const angle = overlapCount * (Math.PI / 2);
                const offset = 0.00030 * overlapCount;
                lat += Math.sin(angle) * offset;
                lng += Math.cos(angle) * offset;
            }

            coordsMap.set(h.id, [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
        });

        return {
            getAdjustedGpsCoords: (h: Household): [number, number] => {
                if (coordsMap.has(h.id)) {
                    return coordsMap.get(h.id)!;
                }
                if (isValidGps(h.gpsLat, h.gpsLng)) {
                    return getCleanGpsCoords(h.gpsLat!, h.gpsLng!);
                }
                return DEFAULT_CENTER;
            },
            isOverlapping: (id: string) => overlappingSet.has(id),
            overlappingCount: overlappingSet.size,
            standaloneCount: validList.length - overlappingSet.size
        };
    }, [households]);

    // Calculate map bounds so all households are framed cleanly
    const mapBounds = React.useMemo(() => {
        if (forcedCenter || selectedHouse || focusResident || householdsWithGps.length < 2) {
            return null;
        }
        const points = householdsWithGps.map((h) => getAdjustedGpsCoords(h));
        return L.latLngBounds(points);
    }, [forcedCenter, selectedHouse, focusResident, householdsWithGps, getAdjustedGpsCoords]);

    const center: [number, number] =
        focusResident && isValidGps(focusResident.lat, focusResident.lng)
            ? getCleanGpsCoords(focusResident.lat, focusResident.lng)
            : forcedCenter ||
              (selectedHouse && isValidGps(selectedHouse.gpsLat, selectedHouse.gpsLng)
                  ? getAdjustedGpsCoords(selectedHouse)
                  : (householdsWithGps.length > 0
                      ? getAdjustedGpsCoords(householdsWithGps[0])
                      : DEFAULT_CENTER));

    const zoom = viewZoom || DEFAULT_ZOOM;

    return (
        <div className="relative w-full h-full min-h-[350px]">
            {/* Top Controls Overlay Container - Flex wrapped to prevent overlapping text on narrow screens */}
            <div className="absolute top-2 left-12 right-2 sm:top-3 sm:left-14 sm:right-3 z-[1000] pointer-events-none flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                {/* GPS Household Count & Marker Legend Capsule */}
                <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg border border-slate-200/90 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-slate-700 max-w-full">
                    <span className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="whitespace-nowrap">Đã có GPS: <strong className="text-emerald-700 font-extrabold">{householdsWithGps.length}/{households.length} hộ</strong></span>
                    </span>
                    <span className="text-slate-300 hidden xs:inline">|</span>
                    <span className="hidden xs:flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] shrink-0">
                        <span className="flex items-center gap-1" title="Hộ dân có tọa độ riêng biệt độc lập">
                            <span className="w-2 h-2 rounded-full bg-blue-500 border border-blue-600"></span>
                            <span>Độc lập ({standaloneCount})</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-800" title="Hộ dân có tọa độ trùng hoặc nằm sát nhau">
                            <span className="w-2 h-2 rounded-full bg-amber-500 border border-amber-600"></span>
                            <span>Trùng/Gần ({overlappingCount})</span>
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {onGetCurrentLocation && (
                        <button
                            type="button"
                            onClick={onGetCurrentLocation}
                            className="pointer-events-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-xl border-2 border-white ring-2 ring-emerald-500/50 transition-all cursor-pointer shrink-0"
                            title="Định vị vị trí hiện tại của bạn"
                        >
                            <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse shrink-0" />
                            <span className="whitespace-nowrap">Vị trí hiện tại</span>
                        </button>
                    )}

                    {/* Tile Layer Switcher - Floating Capsule */}
                    <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-0.5 sm:p-1 rounded-full shadow-lg border border-slate-200 flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-semibold shrink-0">
                        <button
                            type="button"
                            onClick={() => setMapType("google_map")}
                            className={`flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full transition cursor-pointer text-[10px] sm:text-xs ${
                                mapType === "google_map" 
                                    ? "bg-[#0b7a43] text-white font-bold shadow-xs" 
                                    : "text-slate-700 hover:bg-slate-100"
                            }`}
                        >
                            <span className="text-[10px] sm:text-xs">🗺️</span> Google Maps
                        </button>
                        <button
                            type="button"
                            onClick={() => setMapType("google_hybrid")}
                            className={`flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full transition cursor-pointer text-[10px] sm:text-xs ${
                                mapType === "google_hybrid" 
                                    ? "bg-[#0b7a43] text-white font-bold shadow-xs" 
                                    : "text-slate-700 hover:bg-slate-100"
                            }`}
                        >
                            <span className="text-[10px] sm:text-xs">🛰️</span> Vệ tinh
                        </button>
                    </div>
                </div>
            </div>

            {/* View Altitude Distance Badge */}
            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-[1000] bg-slate-900/85 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-md border border-slate-700/60 flex items-center gap-1 pointer-events-none max-w-[calc(100%-1rem)] truncate">
                <span className="text-xs">🚁</span> Tầm nhìn từ trên không: <strong className="text-emerald-400 font-bold">12,29 km</strong>
            </div>

            <MapContainer
                center={center}
                zoom={zoom}
                maxZoom={20}
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
                {mapType === "google_hybrid" ? (
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
                <RecenterMap center={center} zoom={zoom} bounds={mapBounds} />

                {currentPosition && !Number.isNaN(currentPosition[0]) && !Number.isNaN(currentPosition[1]) && isValidGps(currentPosition[0], currentPosition[1]) && (
                    <Marker
                        key="current-position"
                        position={currentPosition}
                        icon={markerIcon}
                    >
                        <Popup>Vị trí hiện tại của bạn</Popup>
                    </Marker>
                )}

                {households
                    .filter((h) => h.id !== selectedHouse?.id && isValidGps(h.gpsLat, h.gpsLng))
                    .map((h) => {
                        const pos = getAdjustedGpsCoords(h);
                        const rawLat = h.gpsLat!;
                        const rawLng = h.gpsLng!;
                        const isOverlap = isOverlapping(h.id);
                        return (
                            <Marker
                                key={h.id}
                                icon={isOverlap ? orangeMarkerIcon : markerIcon}
                                position={pos}
                                eventHandlers={{
                                    click: () => onSelectHouse?.(h)
                                }}
                            >
                                <Popup>
                                    <div className="p-0.5">
                                        <div className="flex items-center justify-between gap-2 mb-1 border-b border-slate-100 pb-1">
                                            <strong className="text-slate-900 font-mono text-xs">{h.id}</strong>
                                            {isOverlap ? (
                                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                                    🟠 Ghim Cam (Trùng/Gần)
                                                </span>
                                            ) : (
                                                <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-300 flex items-center gap-1">
                                                    🔵 Ghim Xanh (Độc lập)
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-extrabold text-slate-800 text-xs">{h.ownerName}</div>
                                        <div className="text-xs text-slate-600 mt-0.5">{h.address}</div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}

                {selectedHouse && isValidGps(selectedHouse.gpsLat, selectedHouse.gpsLng) && (
                    <Marker
                        key={`selected-house-${selectedHouse.id}`}
                        icon={redMarkerIcon}
                        position={getAdjustedGpsCoords(selectedHouse)}
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
                            </div>
                        </Popup>
                    </Marker>
                )}

                {focusResident && isValidGps(focusResident.lat, focusResident.lng) && 
                  (!selectedHouse || selectedHouse.gpsLat !== focusResident.lat || selectedHouse.gpsLng !== focusResident.lng) && (
                    <Marker
                        key={`focus-res-${focusResident.fullName}`}
                        icon={redMarkerIcon}
                        position={getCleanGpsCoords(focusResident.lat, focusResident.lng)}
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
                                    Tọa độ: {getCleanGpsCoords(focusResident.lat, focusResident.lng)[0].toFixed(6)}, {getCleanGpsCoords(focusResident.lat, focusResident.lng)[1].toFixed(6)}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}
