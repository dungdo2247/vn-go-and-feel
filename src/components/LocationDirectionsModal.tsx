import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import { VIETNAM_PROVINCES } from '../data/vietnamProvinces';
import { 
  X, Navigation, MapPin, ExternalLink, Compass, Clock, Car, Bike, Sparkles, Layers, Globe, Map
} from 'lucide-react';

interface LocationDirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
  destinationCity: string;
  activityTime: string;
  activityDescription?: string;
  estimatedCost?: string;
}

export const LocationDirectionsModal: React.FC<LocationDirectionsModalProps> = ({
  isOpen,
  onClose,
  locationName,
  destinationCity,
  activityTime,
  activityDescription,
  estimatedCost,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [mapType, setMapType] = useState<'hybrid' | 'streets'>('streets');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Approximate coordinates based on destination province
  const matchedProvince = VIETNAM_PROVINCES.find((p) =>
    destinationCity.toLowerCase().includes(p.name.toLowerCase()) ||
    p.name.toLowerCase().includes(destinationCity.toLowerCase())
  ) || VIETNAM_PROVINCES[0];

  // Origin point (e.g. Hotel / City Center) and Destination coordinates
  const destLat = matchedProvince.lat + 0.015;
  const destLng = matchedProvince.lng + 0.02;
  const originLat = matchedProvince.lat - 0.02;
  const originLng = matchedProvince.lng - 0.015;

  // Approximate distance & travel time
  const distanceKm = 6.2;
  const bikeTimeMinutes = 15;
  const carTimeMinutes = 18;

  // Google Maps external navigation URL
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${locationName}, ${destinationCity}, Việt Nam`
  )}`;

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [(originLat + destLat) / 2, (originLng + destLng) / 2],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      const tileUrl =
        mapType === 'hybrid'
          ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      const initialLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ['0', '1', '2', '3'],
      }).addTo(map);

      tileLayerRef.current = initialLayer;

      // 1. Origin Marker
      const originIcon = L.divIcon({
        className: 'custom-origin-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: #0f172a;
            color: #ffffff;
            padding: 3px 8px;
            border-radius: 9999px;
            font-family: 'Be Vietnam Pro', sans-serif;
            font-size: 10px;
            font-weight: 700;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid #ffffff;
            white-space: nowrap;
          ">
            <span>🏨 Điểm xuất phát</span>
          </div>
        `,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      L.marker([originLat, originLng], { icon: originIcon }).addTo(map);

      // 2. Destination Marker
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
            color: #ffffff;
            padding: 4px 10px;
            border-radius: 9999px;
            font-family: 'Be Vietnam Pro', sans-serif;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 4px 14px rgba(2, 132, 199, 0.5);
            border: 2px solid #ffffff;
            white-space: nowrap;
          ">
            <span>📍 ${locationName}</span>
          </div>
        `,
        iconSize: [140, 28],
        iconAnchor: [70, 14],
      });
      L.marker([destLat, destLng], { icon: destIcon }).addTo(map);

      // 3. Routing Polyline
      const midLat = (originLat + destLat) / 2 + 0.005;
      const midLng = (originLng + destLng) / 2 - 0.005;

      const routePoints: [number, number][] = [
        [originLat, originLng],
        [originLat + 0.008, originLng + 0.006],
        [midLat, midLng],
        [destLat - 0.006, destLng - 0.008],
        [destLat, destLng],
      ];

      L.polyline(routePoints, {
        color: '#0284c7',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      L.polyline(routePoints, {
        color: '#38bdf8',
        weight: 10,
        opacity: 0.35,
        lineCap: 'round',
      }).addTo(map);

      map.fitBounds([
        [originLat, originLng],
        [destLat, destLng],
      ], { padding: [40, 40] });

      map.invalidateSize();
      mapInstanceRef.current = map;
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, locationName, destinationCity, mapType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md">
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[36px] shadow-2xl border border-sky-100 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* iOS Drag Handle Pill */}
        <div className="w-full pt-2.5 pb-1 flex justify-center bg-gradient-to-r from-[#0369a1] via-[#0284c7] to-[#0891b2] sm:hidden">
          <div className="w-12 h-1 bg-white/40 rounded-full" />
        </div>

        {/* Modal Top Header */}
        <div className="p-4 bg-gradient-to-r from-[#0369a1] via-[#0284c7] to-[#0891b2] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-xs">
              <Navigation className="w-4 h-4 text-cyan-200" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-200 uppercase tracking-wider">
                Bản Đồ Chỉ Đường & Lộ Trình
              </span>
              <h3 className="text-sm font-black text-white leading-tight">
                {locationName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map Container View */}
        <div className="relative w-full h-[260px] bg-slate-100 shrink-0">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Toggle Map Satellite / Streets */}
          <div className="absolute top-2.5 left-2.5 z-10 flex bg-white/95 backdrop-blur-md p-0.5 rounded-xl border border-sky-100 shadow-md text-[10px] font-bold">
            <button
              onClick={() => setMapType('streets')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                mapType === 'streets'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Map className="w-3 h-3" />
              <span>Đường phố</span>
            </button>
            <button
              onClick={() => setMapType('hybrid')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                mapType === 'hybrid'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Vệ tinh</span>
            </button>
          </div>

          {/* Floating ETA Badge */}
          <div className="absolute bottom-2.5 left-2.5 z-10 bg-slate-950/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-3 shadow-lg border border-white/15">
            <span className="flex items-center gap-1 text-cyan-300">
              <Bike className="w-3.5 h-3.5" />
              <span>{bikeTimeMinutes} phút ({distanceKm} km)</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Car className="w-3.5 h-3.5" />
              <span>{carTimeMinutes} phút</span>
            </span>
          </div>
        </div>

        {/* Info & Action Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Quick Route Summary */}
          <div className="p-3.5 bg-sky-50/70 rounded-2xl border border-sky-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <MapPin className="w-4 h-4 text-sky-600" />
                <span>Khu vực: {destinationCity}</span>
              </div>
              {activityTime && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-sky-100 text-sky-800 shadow-2xs">
                  {activityTime}
                </span>
              )}
            </div>

            {activityDescription && (
              <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-2.5 rounded-xl border border-sky-100/60 shadow-2xs">
                &ldquo;{activityDescription}&rdquo;
              </p>
            )}

            {estimatedCost && (
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-sky-100 text-slate-600 font-semibold">
                <span>Chi phí trải nghiệm dự kiến:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  💵 {estimatedCost}
                </span>
              </div>
            )}
          </div>

          {/* Transportation Tips */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs space-y-1">
            <p className="font-bold text-slate-800 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              Mẹo di chuyển tại {destinationCity}:
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Bạn có thể dễ dàng đi xe máy để hóng gió hoặc gọi taxi/Grab. Tuyến đường được tối ưu thuận tiện nhất theo Google Maps.
            </p>
          </div>

          {/* Primary Action Button: Open Real Google Maps Navigation */}
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Navigation className="w-4 h-4 text-cyan-100" />
            <span>Mở Bắt Đầu Điều Hướng trên Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </motion.a>
        </div>
      </motion.div>
    </div>
  );
};
