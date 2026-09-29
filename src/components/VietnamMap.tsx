import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Province, TravelRecommendation } from '../types/travel';
import { VIETNAM_PROVINCES } from '../data/vietnamProvinces';
import { RealLeafletMap } from './RealLeafletMap';
import { 
  Sparkles, CheckCircle2, Circle, MapPin, 
  Search, X, ChevronRight, Award, Compass, ArrowRight, Globe
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VietnamMapProps {
  visitedProvinces: string[];
  onToggleProvince: (provinceName: string) => void;
  onSelectForPlanner: (destination: string) => void;
}

export const VietnamMap: React.FC<VietnamMapProps> = ({
  visitedProvinces,
  onToggleProvince,
  onSelectForPlanner,
}) => {
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [filterRegion, setFilterRegion] = useState<'all' | 'bac' | 'trung' | 'nam' | 'visited' | 'unvisited'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<TravelRecommendation | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const totalCount = VIETNAM_PROVINCES.length; // 63
  const visitedCount = visitedProvinces.length;
  const percentage = Math.round((visitedCount / totalCount) * 100);

  // Region stats
  const bacVisited = VIETNAM_PROVINCES.filter(p => p.region === 'bac' && visitedProvinces.includes(p.name)).length;
  const trungVisited = VIETNAM_PROVINCES.filter(p => p.region === 'trung' && visitedProvinces.includes(p.name)).length;
  const namVisited = VIETNAM_PROVINCES.filter(p => p.region === 'nam' && visitedProvinces.includes(p.name)).length;

  // Title rank based on percentage
  const travelerTitle = useMemo(() => {
    if (visitedCount >= 45) return '👑 Đại Sứ Du Lịch Việt Nam';
    if (visitedCount >= 30) return '🧭 Lữ Khách Xuyên Việt';
    if (visitedCount >= 15) return '🎒 Phượt Thủ Bản Lĩnh';
    if (visitedCount >= 5) return '🌿 Người Thích Xê Dịch';
    if (visitedCount >= 1) return '🌱 Mầm Non Khám Phá';
    return '🗺️ Bắt Đầu Chinh Phục';
  }, [visitedCount]);

  // Filtered provinces list
  const filteredProvinces = useMemo(() => {
    return VIETNAM_PROVINCES.filter((p) => {
      const matchQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.famousPlaces.some((fp) => fp.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.subRegion.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchQuery) return false;

      if (filterRegion === 'all') return true;
      if (filterRegion === 'visited') return visitedProvinces.includes(p.name);
      if (filterRegion === 'unvisited') return !visitedProvinces.includes(p.name);
      return p.region === filterRegion;
    });
  }, [filterRegion, searchQuery, visitedProvinces]);

  const handleToggle = (provinceName: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    const wasVisited = visitedProvinces.includes(provinceName);
    onToggleProvince(provinceName);

    if (!wasVisited) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#0284c7', '#06b6d4', '#38bdf8', '#fbbf24', '#f43f5e'],
      });
    }
  };

  const handleAnalyzeGu = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setShowAnalysisModal(true);

    try {
      const res = await fetch('/api/recommend-destination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitedProvinces }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi khi phân tích dữ liệu.');
      }

      setRecommendation(json.data);
    } catch (err: any) {
      setAnalysisError(err.message || 'Không thể kết nối đến AI.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Top Hero Banner - iPhone 18 Glacier Blue / Xanh Băng Nước Biển */}
      <div className="bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#0891b2] text-white p-5 rounded-b-[36px] shadow-xl shadow-sky-900/25 relative overflow-hidden">
        {/* Animated Background Ambient Glow */}
        <div className="absolute -right-10 -bottom-10 opacity-20 pointer-events-none animate-float">
          <Compass className="w-64 h-64 text-cyan-200" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2.5">
            <motion.span 
              whileHover={{ scale: 1.05 }}
              className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-cyan-100 border border-white/30 backdrop-blur-md shadow-xs flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
              <span>Bản Đồ Số Việt Nam</span>
            </motion.span>
            <motion.span 
              whileHover={{ scale: 1.05 }}
              className="text-xs font-extrabold text-cyan-100 flex items-center gap-1 bg-sky-950/30 px-2.5 py-1 rounded-full border border-white/10"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              {travelerTitle}
            </motion.span>
          </div>

          <h1 className="text-2xl font-black tracking-tight mb-1 text-white">
            Chinh Phục Việt Nam
          </h1>
          <p className="text-xs text-cyan-100/90 mb-4">
            Đánh dấu những vùng đất bạn đã đặt chân tới trên dải đất 63 tỉnh thành
          </p>

          {/* Progress Bar & Counter - Ice Glass Frosted Card */}
          <div className="bg-white/15 backdrop-blur-xl rounded-3xl p-4 border border-white/25 shadow-inner">
            <div className="flex justify-between items-end mb-2.5">
              <div>
                <motion.span 
                  key={visitedCount}
                  initial={{ scale: 1.3, color: '#38bdf8' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  className="text-3xl font-black text-white inline-block"
                >
                  {visitedCount}
                </motion.span>
                <span className="text-xs text-cyan-100 ml-1.5 font-bold">/ 63 tỉnh thành</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-amber-300">{percentage}%</span>
                <p className="text-[10px] text-cyan-100 font-semibold">Độ phủ chữ S</p>
              </div>
            </div>

            {/* Progress line with smooth motion and light shimmer */}
            <div className="relative w-full bg-sky-950/45 rounded-full h-3 overflow-hidden p-0.5 border border-white/15">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(percentage, 4)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="relative bg-gradient-to-r from-sky-200 via-cyan-300 to-amber-300 h-full rounded-full shadow-sm overflow-hidden"
              >
                {/* Shimmer light sweep */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
              </motion.div>
            </div>

            {/* 3 Regions breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/15 text-center">
              {[
                { label: 'Miền Bắc', count: `${bacVisited}/25` },
                { label: 'Miền Trung', count: `${trungVisited}/19` },
                { label: 'Miền Nam', count: `${namVisited}/19` },
              ].map((reg, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 rounded-2xl py-1.5 border border-white/10 transition-all cursor-default"
                >
                  <p className="text-[10px] text-cyan-100 font-medium">{reg.label}</p>
                  <p className="text-xs font-black text-white">{reg.count}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA: AI Recommendation with Spring Interaction */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAnalyzeGu}
            className="w-full mt-3.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-white via-sky-50 to-cyan-100 hover:from-white hover:to-cyan-200 text-[#0369a1] font-black text-xs shadow-lg shadow-sky-950/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/80"
          >
            <Sparkles className="w-4 h-4 text-cyan-600 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Phân tích &ldquo;Gu&rdquo; & Gợi ý điểm đến tiếp theo (AI)</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* Interactive Real Map Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-600" />
                Bản đồ Thật 63 Tỉnh Thành
              </h2>
              <p className="text-[11px] text-slate-400">Xem ảnh vệ tinh Google HD & đường phố chi tiết</p>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-extrabold border border-sky-200 shadow-2xs">
              Google Maps Live
            </span>
          </div>

          {/* Primary View: Real Leaflet Map with Google Satellite HD & Streets */}
          <RealLeafletMap
            visitedProvinces={visitedProvinces}
            selectedProvince={selectedProvince}
            onSelectProvince={setSelectedProvince}
            onToggleProvince={onToggleProvince}
            onSelectForPlanner={onSelectForPlanner}
          />

          {/* Selected Province Details Card with AnimatePresence */}
          <AnimatePresence>
            {selectedProvince && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="mt-3.5 p-4 rounded-3xl bg-gradient-to-r from-sky-50/95 to-cyan-50/95 border border-sky-200/80 flex flex-col gap-2 shadow-xs overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">{selectedProvince.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                        {selectedProvince.subRegion}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedProvince.lat.toFixed(2)}°N, {selectedProvince.lng.toFixed(2)}°E
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{selectedProvince.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedProvince(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-lg hover:bg-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Highlights */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selectedProvince.famousPlaces.map((place, idx) => (
                    <motion.span
                      key={idx}
                      whileHover={{ scale: 1.05 }}
                      className="text-[10px] px-2.5 py-1 rounded-xl bg-white text-slate-700 border border-sky-100 font-semibold shadow-2xs cursor-default"
                    >
                      📍 {place}
                    </motion.span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-sky-200/50 mt-1">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => handleToggle(selectedProvince.name, e)}
                    className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      visitedProvinces.includes(selectedProvince.name)
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                        : 'bg-white text-sky-700 border border-sky-300 hover:bg-sky-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {visitedProvinces.includes(selectedProvince.name) ? 'Đã check-in' : 'Đánh dấu đã đi'}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onSelectForPlanner(selectedProvince.name)}
                    className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Lên lịch trình AI</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Filter & Search Bar */}
        <div className="space-y-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tỉnh thành, địa danh (Hà Giang, Sa Pa, Hội An, Phú Quốc...)"
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-sky-100 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills with Motion Tap */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {[
              { id: 'all', label: `Tất cả (${totalCount})` },
              { id: 'visited', label: `Đã đi (${visitedCount})` },
              { id: 'unvisited', label: `Chưa đi (${totalCount - visitedCount})` },
              { id: 'bac', label: 'Miền Bắc' },
              { id: 'trung', label: 'Miền Trung' },
              { id: 'nam', label: 'Miền Nam' },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => setFilterRegion(tab.id as any)}
                className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                  filterRegion === tab.id
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                    : 'bg-white text-slate-600 border border-sky-100 hover:bg-sky-50/50'
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Province Check-in List with smooth staggered interactions */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Danh sách tỉnh thành ({filteredProvinces.length})
            </h3>
            <span className="text-[11px] text-sky-600 font-semibold">Bấm tên để bay tới trên bản đồ</span>
          </div>

          <div className="divide-y divide-sky-50 max-h-[380px] overflow-y-auto pr-1">
            {filteredProvinces.map((prov) => {
              const isVisited = visitedProvinces.includes(prov.name);
              return (
                <motion.div
                  key={prov.id}
                  whileHover={{ x: 4, backgroundColor: 'rgba(240, 249, 255, 0.8)' }}
                  onClick={() => {
                    setSelectedProvince(prov);
                  }}
                  className="py-2.5 px-2 flex items-center justify-between rounded-2xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => handleToggle(prov.name, e)}
                      className="p-0.5 text-sky-600 transition-transform"
                    >
                      {isVisited ? (
                        <CheckCircle2 className="w-5 h-5 text-cyan-600 fill-cyan-50 drop-shadow-2xs" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 hover:text-cyan-400" />
                      )}
                    </motion.button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isVisited ? 'text-sky-950 font-black' : 'text-slate-800'}`}>
                          {prov.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-600 font-semibold border border-sky-100">
                          {prov.subRegion}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {prov.famousPlaces.slice(0, 2).join(' • ')}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-transform" />
                </motion.div>
              );
            })}

            {filteredProvinces.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Không tìm thấy tỉnh thành nào phù hợp
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendation Modal with Spring Motion Animation */}
      <AnimatePresence>
        {showAnalysisModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-[32px] w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-sky-100 p-5 space-y-4"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-sky-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/25">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Gợi ý Điểm Đến Tiếp Theo</h3>
                    <p className="text-[11px] text-slate-500">Phân tích gu du lịch dựa trên {visitedCount} tỉnh đã đi</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAnalysisModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Loading State with Pulse Radar Effect */}
              {isAnalyzing && (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-sky-100 border-t-cyan-500 animate-spin" />
                    <div className="w-12 h-12 rounded-full bg-cyan-50 absolute inset-0 m-auto flex items-center justify-center animate-pulse">
                      <Compass className="w-6 h-6 text-cyan-600 animate-spin" style={{ animationDuration: '4s' }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">AI đang phân tích &ldquo;Gu&rdquo; du lịch của bạn...</p>
                    <p className="text-[11px] text-slate-400 mt-1">Đọc dữ liệu dải đất chữ S & tìm điểm đến lý tưởng nhất</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {analysisError && !isAnalyzing && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-center space-y-2">
                  <p className="text-xs text-rose-700 font-medium">{analysisError}</p>
                  <button
                    onClick={handleAnalyzeGu}
                    className="text-xs font-bold text-rose-800 underline"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {/* Result State */}
              {recommendation && !isAnalyzing && (
                <div className="space-y-3.5">
                  {/* 1. Gu Analysis */}
                  <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/70">
                    <div className="flex items-center gap-1.5 text-sky-900 font-bold text-xs mb-1">
                      <span>🔍</span>
                      <span>Phân tích Gu du lịch:</span>
                    </div>
                    <p className="text-xs text-sky-950 font-medium leading-relaxed">
                      {recommendation.guAnalysis}
                    </p>
                  </div>

                  {/* 2. Next Destination Ticket */}
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-3xl bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#0891b2] text-white p-4.5 shadow-xl shadow-sky-900/25 relative overflow-hidden"
                  >
                    <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 flex items-center gap-1">
                      <span>🎯</span>
                      <span>Điểm đến tiếp theo dành cho bạn</span>
                    </div>
                    <h4 className="text-2xl font-black text-white mt-1 tracking-tight">
                      {recommendation.nextDestination}
                    </h4>

                    {/* 3. Reason */}
                    <div className="mt-3 pt-3 border-t border-white/20">
                      <p className="text-[11px] font-bold text-cyan-100 flex items-center gap-1 mb-0.5">
                        <span>💡</span> Lý do:
                      </p>
                      <p className="text-xs text-white/95 leading-relaxed">
                        {recommendation.reason}
                      </p>
                    </div>
                  </motion.div>

                  {/* 4. 3 Experiences */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/60">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                      <span>🎒</span> 3 Trải nghiệm phải thử tại đây:
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {recommendation.experiences.map((exp, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 mt-1.5 shrink-0" />
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA: Go to Planner */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAnalysisModal(false);
                      onSelectForPlanner(recommendation.nextDestination);
                    }}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Lên lịch trình cho {recommendation.nextDestination} ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
