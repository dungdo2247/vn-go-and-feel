import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Province } from '../types/travel';
import { VIETNAM_PROVINCES, SPECIAL_ISLANDS } from '../data/vietnamProvinces';
import { Layers, Globe, Map, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface RealLeafletMapProps {
  visitedProvinces: string[];
  selectedProvince: Province | null;
  onSelectProvince: (province: Province) => void;
  onToggleProvince: (provinceName: string) => void;
  onSelectForPlanner: (destination: string) => void;
}

type MapLayerType = 'google_hybrid' | 'google_streets' | 'google_terrain' | 'osm';

export const RealLeafletMap: React.FC<RealLeafletMapProps> = ({
  visitedProvinces,
  selectedProvince,
  onSelectProvince,
  onToggleProvince,
  onSelectForPlanner,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Default to Google Satellite Hybrid (vệ tinh Google Maps sắc nét có tên địa danh)
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('google_hybrid');

  // Google Maps & OSM tile layers
  const tileSources: Record<MapLayerType, { url: string; maxZoom: number; subdomains?: string[]; attribution: string; name: string }> = {
    google_hybrid: {
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: 'Bản đồ vệ tinh &copy; Google Maps',
      name: 'Google Vệ Tinh (HD)',
    },
    google_streets: {
      url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: 'Bản đồ đường phố &copy; Google Maps',
      name: 'Google Đường Phố',
    },
    google_terrain: {
      url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: 'Bản đồ địa hình &copy; Google Maps',
      name: 'Google Địa Hình',
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
      name: 'OpenStreetMap',
    },
  };

  // Initialize Leaflet Map with Google Maps Tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [16.0, 107.8],
      zoom: 6,
      minZoom: 5,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
    });

    const cfg = tileSources[activeLayer];
    const initialLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains || ['a', 'b', 'c'],
    }).addTo(map);

    tileLayerRef.current = initialLayer;
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Invalidate size to ensure crisp rendering inside phone frame
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Layer when switched
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const cfg = tileSources[activeLayer];
    const newLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains || ['a', 'b', 'c'],
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [activeLayer]);

  // Render Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // 1. Hoàng Sa & Trường Sa Sovereign Markers (Flag & Banner)
    SPECIAL_ISLANDS.forEach((island) => {
      const islandIcon = L.divIcon({
        className: 'custom-island-marker',
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: #ffffff;
            padding: 4px 10px;
            border-radius: 9999px;
            font-family: 'Be Vietnam Pro', sans-serif;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 4px 14px rgba(220, 38, 38, 0.6);
            border: 2px solid #ffffff;
            white-space: nowrap;
            cursor: pointer;
            letter-spacing: 0.2px;
          ">
            <span style="color: #fde047; font-size: 13px;">★</span>
            <span>${island.name}</span>
          </div>
        `,
        iconSize: [150, 28],
        iconAnchor: [75, 14],
      });

      const islandMarker = L.marker([island.lat, island.lng], { icon: islandIcon });
      islandMarker.bindPopup(`
        <div style="font-family: 'Be Vietnam Pro', sans-serif; padding: 4px; max-width: 230px;">
          <h4 style="font-size: 13px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0;">★ ${island.name}</h4>
          <p style="font-size: 11px; color: #334155; margin: 0 0 6px 0; line-height: 1.4;">${island.description}</p>
          <span style="font-size: 10px; font-weight: 700; color: #0284c7; background: #f0f9ff; padding: 2px 6px; border-radius: 4px; display: inline-block;">Trực thuộc: ${island.province}</span>
        </div>
      `);
      markersLayerRef.current?.addLayer(islandMarker);
    });

    // 2. 63 Provinces Markers - iPhone Glacier Ice Blue & Oceanic Cyan
    VIETNAM_PROVINCES.forEach((prov) => {
      const isVisited = visitedProvinces.includes(prov.name);
      const isSelected = selectedProvince?.id === prov.id;

      // Elegant high-end mobile pin
      const markerHtml = `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: ${isSelected ? '4px 10px' : isVisited ? '3px 9px' : '2px 7px'};
          border-radius: 9999px;
          background: ${
            isSelected
              ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
              : isVisited
              ? 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)'
              : 'rgba(255, 255, 255, 0.95)'
          };
          color: ${isSelected || isVisited ? '#ffffff' : '#0f172a'};
          font-family: 'Be Vietnam Pro', sans-serif;
          font-size: ${isSelected ? '12px' : isVisited ? '11px' : '10px'};
          font-weight: ${isSelected || isVisited ? '800' : '600'};
          box-shadow: ${
            isSelected
              ? '0 6px 16px rgba(2, 132, 199, 0.5)'
              : isVisited
              ? '0 4px 12px rgba(6, 182, 212, 0.45)'
              : '0 2px 6px rgba(0, 0, 0, 0.25)'
          };
          border: ${
            isSelected
              ? '2px solid #bae6fd'
              : isVisited
              ? '2px solid #a5f3fc'
              : '1.5px solid #cbd5e1'
          };
          white-space: nowrap;
          cursor: pointer;
          transform: ${isSelected ? 'scale(1.08)' : 'scale(1)'};
          transition: all 0.2s ease-out;
        ">
          <span style="
            width: 7px;
            height: 7px;
            border-radius: 9999px;
            background: ${isSelected ? '#38bdf8' : isVisited ? '#22d3ee' : '#64748b'};
            box-shadow: 0 0 6px ${isSelected ? '#38bdf8' : isVisited ? '#22d3ee' : 'transparent'};
            display: inline-block;
          "></span>
          <span>${prov.name}</span>
          ${isVisited ? '<span style="font-size: 10px; color: #e0f2fe;">✓</span>' : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'province-custom-marker',
        html: markerHtml,
        iconSize: [isVisited ? 115 : 95, 26],
        iconAnchor: [50, 13],
      });

      const marker = L.marker([prov.lat, prov.lng], { icon: customIcon });

      marker.on('click', () => {
        onSelectProvince(prov);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [visitedProvinces, selectedProvince]);

  // Center or Fly to selected province
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedProvince) return;
    mapInstanceRef.current.flyTo([selectedProvince.lat, selectedProvince.lng], 9, {
      duration: 1.2,
    });
  }, [selectedProvince]);

  const handleResetVietnamView = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([16.0, 107.8], 6, {
      duration: 1.0,
    });
  };

  const handleZoomIn = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomOut();
  };

  return (
    <div className="relative w-full h-[520px] rounded-3xl overflow-hidden shadow-xl border border-sky-100">
      {/* Real Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Map Layer Switcher: Glacier Blue & Ocean White */}
      <div className="absolute top-3 left-3 z-10 flex items-center bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-sky-100 text-xs">
        <button
          onClick={() => setActiveLayer('google_hybrid')}
          className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeLayer === 'google_hybrid'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Vệ tinh Google (HD)</span>
        </button>

        <button
          onClick={() => setActiveLayer('google_streets')}
          className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeLayer === 'google_streets'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Đường phố Google</span>
        </button>

        <button
          onClick={() => setActiveLayer('google_terrain')}
          className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeLayer === 'google_terrain'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Địa hình</span>
        </button>
      </div>

      {/* Floating Map Controls (Zoom, Reset View) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          title="Phóng to"
          className="w-9 h-9 rounded-2xl bg-white/95 backdrop-blur-md shadow-md border border-sky-100 text-slate-800 flex items-center justify-center hover:bg-sky-50 active:scale-95 transition-all cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Thu nhỏ"
          className="w-9 h-9 rounded-2xl bg-white/95 backdrop-blur-md shadow-md border border-sky-100 text-slate-800 flex items-center justify-center hover:bg-sky-50 active:scale-95 transition-all cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetVietnamView}
          title="Toàn cảnh dải đất Việt Nam"
          className="w-9 h-9 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md flex items-center justify-center hover:from-sky-600 hover:to-cyan-600 active:scale-95 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Google Maps Real Data Badge */}
      <div className="absolute bottom-2 left-2 z-10 bg-slate-950/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 shadow-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        <span>Google Maps Live • Trực quan 63 Tỉnh Thành</span>
      </div>

      {/* Quick Legend at bottom right */}
      <div className="absolute bottom-2 right-2 z-10 bg-white/95 backdrop-blur-md text-slate-700 px-3 py-1 rounded-xl border border-sky-100 text-[11px] font-bold flex items-center gap-3 shadow-md">
        <span className="flex items-center gap-1.5 text-cyan-800">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
          Đã đi ({visitedProvinces.length})
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
          Chưa đi ({VIETNAM_PROVINCES.length - visitedProvinces.length})
        </span>
      </div>
    </div>
  );
};
