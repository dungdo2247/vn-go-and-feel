import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TravelItinerary } from '../types/travel';
import { LocationDirectionsModal } from './LocationDirectionsModal';
import { useAuth } from '../context/AuthContext';
import { savePlanToCloud, loadPlansFromCloud, deletePlanFromCloud } from '../lib/firebase';
import { 
  Sparkles, Calendar, Users, Heart, DollarSign, 
  MapPin, Check, Copy, Bookmark, Trash2, ArrowRight, Sun, Sunrise, Moon, Navigation, Compass
} from 'lucide-react';
import { userStorageKey } from '../lib/userStorage';
import confetti from 'canvas-confetti';

function readSavedPlans(userId: string): TravelItinerary[] {
  try {
    const plans = JSON.parse(localStorage.getItem(userStorageKey(userId, 'itineraries')) || '[]');
    return Array.isArray(plans) ? plans.filter(plan => plan && Array.isArray(plan.itinerary)) : [];
  } catch {
    return [];
  }
}

function readCurrentPlan(userId: string): TravelItinerary | null {
  try {
    const plan = JSON.parse(localStorage.getItem(userStorageKey(userId, 'current-itinerary')) || 'null');
    if (plan && Array.isArray(plan.itinerary)) return plan;
  } catch {
    // Older or invalid browser data must not prevent the planner from opening.
  }
  return readSavedPlans(userId)[0] || null;
}

interface SmartPlannerProps {
  initialDestination?: string;
  onClearInitialDestination?: () => void;
}

export const SmartPlanner: React.FC<SmartPlannerProps> = ({
  initialDestination = '',
  onClearInitialDestination,
}) => {
  const { currentUser, effectiveUserId } = useAuth();
  const SAVED_PLANS_KEY = userStorageKey(effectiveUserId, 'itineraries');
  const CURRENT_PLAN_KEY = userStorageKey(effectiveUserId, 'current-itinerary');
  const [currentPlan, setCurrentPlan] = useState<TravelItinerary | null>(() => readCurrentPlan(effectiveUserId));
  const [destination, setDestination] = useState(initialDestination || currentPlan?.destination || '');
  const [duration, setDuration] = useState(currentPlan?.duration || '');
  const [companions, setCompanions] = useState(currentPlan?.companions || '');
  const [preferences, setPreferences] = useState(currentPlan?.preferences || '');
  const [budget, setBudget] = useState(currentPlan?.budget || '');

  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [checkedActivities, setCheckedActivities] = useState<Record<string, boolean>>({});
  const [savedPlans, setSavedPlans] = useState<TravelItinerary[]>(() => readSavedPlans(effectiveUserId));
  const [showSavedList, setShowSavedList] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State to show live map directions when user clicks on a location in the timeline
  const [selectedLocationForDirections, setSelectedLocationForDirections] = useState<{
    locationName: string;
    activityTime: string;
    activityDescription?: string;
    estimatedCost?: string;
  } | null>(null);

  // Update destination if passed from Map
  useEffect(() => {
    if (initialDestination) {
      setDestination(initialDestination);
      if (onClearInitialDestination) onClearInitialDestination();
    }
  }, [initialDestination, onClearInitialDestination]);

  // Load saved itineraries from LocalStorage and Cloud Firestore
  useEffect(() => {
    let cancelled = false;
    if (effectiveUserId) {
      loadPlansFromCloud(effectiveUserId).then((cloudPlans) => {
        if (!cancelled && cloudPlans && cloudPlans.length > 0) {
          setCurrentPlan(prev => prev || cloudPlans[0]);
          setSavedPlans((prev) => {
            const map = new Map<string, TravelItinerary>();
            prev.forEach((p) => p.id && map.set(p.id, p));
            cloudPlans.forEach((p) => p.id && map.set(p.id, p));
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(merged));
            } catch (error) {
              console.warn('Could not cache itineraries:', error);
            }
            return merged;
          });
        }
      });
    }
    return () => { cancelled = true; };
  }, [effectiveUserId]);

  // Call server-side API (Prompt 1)
  const handleGeneratePlan = async () => {
    if (!destination.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          duration,
          companions,
          preferences,
          budget,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi khi lên lịch trình.');
      }

      const generatedData: TravelItinerary = {
        ...json.data,
        destination,
        duration,
        companions,
        preferences,
        budget,
        id: `plan_${Date.now()}`,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };

      persistPlan(generatedData);
      selectPlan(generatedData);

      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#0284c7', '#06b6d4', '#38bdf8', '#fbbf24', '#f43f5e'],
      });
    } catch (err: any) {
      let msg = err.message || 'Không thể tạo lịch trình. Vui lòng thử lại.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error && parsed.error.message) {
          msg = parsed.error.message;
        }
      } catch {}
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActivityCheck = (day: number, actIdx: number) => {
    const key = `${day}_${actIdx}`;
    setCheckedActivities((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectPlan = (plan: TravelItinerary) => {
    setCurrentPlan(plan);
    setActiveDay(plan.itinerary[0]?.day || 1);
    setCheckedActivities({});
    try {
      localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(plan));
    } catch (error) {
      console.warn('Could not remember current itinerary:', error);
      setErrorMessage('Không thể lưu trên trình duyệt này. Vui lòng kiểm tra dung lượng hoặc quyền lưu trữ.');
    }
  };

  const persistPlan = (plan: TravelItinerary) => {
    // Persist immediately, even if the user leaves while generation is finishing.
    // Match by ID so separate trips with the same title are not overwritten.
    const plans = new Map<string, TravelItinerary>();
    [plan, ...savedPlans, ...readSavedPlans(effectiveUserId)].forEach(item => {
      const id = item.id || item.title;
      if (!plans.has(id)) plans.set(id, item);
    });
    const updated = Array.from(plans.values());
    setSavedPlans(updated);
    try {
      localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('Could not save itinerary locally:', error);
      setErrorMessage('Không thể lưu trên trình duyệt này. Vui lòng kiểm tra dung lượng hoặc quyền lưu trữ.');
    }
    if (effectiveUserId) {
      void savePlanToCloud(effectiveUserId, plan);
    }
  };

  const handleSavePlan = () => {
    if (currentPlan) persistPlan(currentPlan);
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPlans.filter((p) => p.id !== id);
    setSavedPlans(updated);
    try {
      localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(updated));
      if (currentPlan?.id === id) {
        localStorage.removeItem(CURRENT_PLAN_KEY);
      }
    } catch (error) {
      console.warn('Could not remove itinerary locally:', error);
    }
    if (currentPlan?.id === id) setCurrentPlan(null);

    // Delete from Cloud Firestore
    if (effectiveUserId) {
      deletePlanFromCloud(effectiveUserId, id);
    }
  };

  const handleCopyFormattedText = () => {
    if (!currentPlan) return;

    let text = `✈️ LỊCH TRÌNH: ${currentPlan.title}\n`;
    text += `📍 Điểm đến: ${currentPlan.destination} | Thời gian: ${currentPlan.duration}\n`;
    text += `👥 Đối tượng: ${currentPlan.companions} | Ngân sách: ${currentPlan.budget}\n`;
    text += `📝 Tóm tắt: ${currentPlan.summary}\n\n`;

    currentPlan.itinerary.forEach((dayPlan) => {
      text += `--- NGÀY ${dayPlan.day} ---\n`;
      dayPlan.activities.forEach((act) => {
        text += `• [${act.time}] ${act.locationName} (${act.estimatedCost})\n  ${act.description}\n`;
      });
      text += '\n';
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTimeIcon = (timeStr: string) => {
    const lower = timeStr.toLowerCase();
    if (lower.includes('sáng') || lower.includes('morning')) return <Sunrise className="w-3.5 h-3.5 text-amber-500" />;
    if (lower.includes('chiều') || lower.includes('afternoon')) return <Sun className="w-3.5 h-3.5 text-cyan-500" />;
    return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Header - iPhone Glacier Blue Gradient */}
      <div className="bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#0891b2] text-white p-5 rounded-b-[36px] shadow-xl shadow-sky-900/25 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-cyan-100 border border-white/30 backdrop-blur-md shadow-xs">
            🤖 AI Smart Travel Planner
          </span>
          {savedPlans.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSavedList(!showSavedList)}
              className="text-xs px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Bookmark className="w-3 h-3 text-amber-300" />
              <span>Đã lưu ({savedPlans.length})</span>
            </motion.button>
          )}
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Lên Lịch Trình Thông Minh
        </h1>
        <p className="text-xs text-cyan-100/90 mt-1">
          Tạo kế hoạch chi tiết từng buổi với chi phí dự kiến chuẩn thực tế tại Việt Nam
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Saved Plans Modal / Accordion */}
        <AnimatePresence>
          {showSavedList && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Chuyến đi của bạn ({savedPlans.length})
                </h3>
                <button
                  onClick={() => setShowSavedList(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 p-1"
                >
                  Đóng
                </button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedPlans.map((plan) => (
                  <motion.div
                    key={plan.id}
                    whileHover={{ scale: 1.015, x: 2 }}
                    onClick={() => {
                      selectPlan(plan);
                      setShowSavedList(false);
                    }}
                    className="p-3 rounded-2xl bg-sky-50/60 hover:bg-sky-100/60 border border-sky-100 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{plan.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        📍 {plan.destination} • {plan.duration}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSaved(plan.id || '', e)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form Card */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100 space-y-3.5">
          {/* Destination */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              Điểm đến mong muốn
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="VD: Đà Lạt, Hà Giang, Phú Quốc, Ninh Bình, Đà Nẵng..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-sky-100 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
            />
            {/* Quick Pick Destinations with Motion Pills */}
            <div className="flex gap-1.5 overflow-x-auto pt-2 pb-0.5 scrollbar-none">
              {['Đà Lạt', 'Hà Giang', 'Phú Quốc', 'Ninh Bình', 'Đà Nẵng', 'Quy Nhơn'].map((city) => (
                <motion.button
                  key={city}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setDestination(city)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                    destination === city
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
                      : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                  }`}
                >
                  {city}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Duration & Companions (2 cols) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                Thời gian
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-sky-100 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
              >
                <option value="">Chọn thời gian</option>
                <option value="2 ngày 1 đêm">2 ngày 1 đêm</option>
                <option value="3 ngày 2 đêm">3 ngày 2 đêm</option>
                <option value="4 ngày 3 đêm">4 ngày 3 đêm</option>
                <option value="5 ngày 4 đêm">5 ngày 4 đêm</option>
                <option value="1 ngày khám phá">1 ngày khám phá</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                Đối tượng
              </label>
              <select
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-sky-100 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
              >
                <option value="">Chọn đối tượng</option>
                <option value="Đi cùng người yêu">Đi cùng người yêu</option>
                <option value="Đi một mình (Solo travel)">Đi một mình</option>
                <option value="Nhóm bạn thân">Nhóm bạn thân</option>
                <option value="Gia đình có trẻ nhỏ">Gia đình có trẻ nhỏ</option>
                <option value="Gia đình nhiều thế hệ">Gia đình nhiều thế hệ</option>
                <option value="Đồng nghiệp công ty">Đồng nghiệp công ty</option>
              </select>
            </div>
          </div>

          {/* Preferences / Style */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Sở thích / Phong cách du lịch
            </label>
            <input
              type="text"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="VD: Thiên nhiên, yên tĩnh, thích cafe đẹp và đồ nướng..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-sky-100 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs font-medium"
            />
            {/* Quick Preference Tags */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              {[
                'Thiên nhiên & yên tĩnh',
                'Cafe đẹp & sống ảo',
                'Ăn đồ nướng & chill',
                'Ẩm thực đường phố',
                'Nghỉ dưỡng sang chảnh',
                'Trekking & phiêu lưu',
              ].map((style) => (
                <motion.button
                  key={style}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    if (preferences.includes(style)) return;
                    setPreferences((prev) => (prev ? `${prev}, ${style}` : style));
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-sky-50/70 hover:bg-sky-100 text-slate-600 hover:text-sky-800 border border-sky-100 transition-colors"
                >
                  + {style}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              Ngân sách dự kiến
            </label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="VD: Khoảng 4 triệu VNĐ, 2-3 triệu..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-sky-100 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs font-semibold"
            />
          </div>

          {/* Submit Button - Glacier Blue Radiant Glow with Spring Press */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGeneratePlan}
            disabled={isLoading || !destination.trim()}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>AI đang phân tích và thiết kế lộ trình chuẩn...</span>
              </div>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
                <span>Tạo Lịch Trình Chi Tiết Ngay</span>
              </>
            )}
          </motion.button>
        </div>

        {/* AI Loading Radar Animation Box */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-200/80 flex flex-col items-center justify-center text-center gap-3 shadow-xs"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-3 border-sky-200 border-t-cyan-600 animate-spin" />
              <Compass className="w-6 h-6 text-sky-600 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                Đang tối ưu lịch trình từng buổi cho {destination}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tính toán chi phí hợp lý, thời gian di chuyển và các tọa độ check-in đẹp nhất
              </p>
            </div>
          </motion.div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium"
          >
            {errorMessage}
          </motion.div>
        )}

        {/* Generated Timeline Result */}
        {currentPlan && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Plan Header Card */}
            <div className="bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#0891b2] rounded-3xl p-4 text-white shadow-xl shadow-sky-900/25 space-y-2 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-cyan-100 border border-white/30 shadow-2xs">
                    {currentPlan.duration} • {currentPlan.companions}
                  </span>
                  <h2 className="text-lg font-black text-white mt-1.5 leading-snug">
                    {currentPlan.title}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCopyFormattedText}
                    title="Sao chép toàn bộ lịch trình"
                    className="p-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-cyan-300" /> : <Copy className="w-4 h-4" />}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSavePlan}
                    title="Lưu vào Chuyến đi của tôi"
                    className="p-2 rounded-2xl bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 transition-colors cursor-pointer shadow-xs"
                  >
                    <Bookmark className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* 2-Sentence Summary */}
              <p className="text-xs text-cyan-50/95 leading-relaxed bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-xs">
                {currentPlan.summary}
              </p>

              <div className="flex items-center justify-between text-[11px] text-cyan-100 pt-1 font-semibold">
                <span>💰 Dự toán: {currentPlan.budget}</span>
                <span>📍 {currentPlan.destination}</span>
              </div>
            </div>

            {/* Day Selector Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {currentPlan.itinerary.map((d) => (
                <motion.button
                  key={d.day}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveDay(d.day)}
                  className={`py-2 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeDay === d.day
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'bg-white text-slate-600 border border-sky-100 hover:bg-sky-50/50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ngày {d.day}</span>
                  <span className="text-[10px] opacity-80">({d.activities.length} điểm)</span>
                </motion.button>
              ))}
            </div>

            {/* Timeline Activities for Selected Day */}
            {(() => {
              const currentDayPlan = currentPlan.itinerary.find((d) => d.day === activeDay) || currentPlan.itinerary[0];
              if (!currentDayPlan) return null;

              return (
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100 space-y-3">
                  <div className="flex items-center justify-between border-b border-sky-100 pb-2.5">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📅 Timeline Chi Tiết - Ngày {currentDayPlan.day}</span>
                    </h3>
                    <span className="text-[11px] text-sky-600 font-semibold">Bấm tên điểm để chỉ đường</span>
                  </div>

                  {/* Vertical Timeline Items */}
                  <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-sky-100">
                    {currentDayPlan.activities.map((act, actIdx) => {
                      const isDone = !!checkedActivities[`${currentDayPlan.day}_${actIdx}`];

                      return (
                        <motion.div 
                          key={actIdx} 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: actIdx * 0.08, duration: 0.25 }}
                          className="relative group"
                        >
                          {/* Timeline bullet */}
                          <motion.button
                            whileTap={{ scale: 0.8 }}
                            onClick={() => toggleActivityCheck(currentDayPlan.day, actIdx)}
                            className={`absolute -left-5 top-1 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                              isDone
                                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 border-cyan-500 text-white scale-110 shadow-xs'
                                : 'bg-white border-sky-200 hover:border-cyan-500'
                            }`}
                          >
                            {isDone && <Check className="w-2.5 h-2.5" />}
                          </motion.button>

                          {/* Activity Card */}
                          <div
                            className={`p-3.5 rounded-2xl border transition-all ${
                              isDone
                                ? 'bg-slate-50/80 border-slate-200 opacity-60'
                                : 'bg-sky-50/30 border-sky-100 hover:border-sky-300 hover:bg-sky-50/60 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-sky-100 text-slate-700 flex items-center gap-1 shadow-2xs">
                                {getTimeIcon(act.time)}
                                {act.time}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60">
                                💵 {act.estimatedCost}
                              </span>
                            </div>

                            {/* Clickable Location with Direction Badge & Motion Hover */}
                            <motion.div
                              whileHover={{ scale: 1.01, x: 2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() =>
                                setSelectedLocationForDirections({
                                  locationName: act.locationName,
                                  activityTime: act.time,
                                  activityDescription: act.description,
                                  estimatedCost: act.estimatedCost,
                                })
                              }
                              className="mt-1 flex items-center justify-between group/loc cursor-pointer hover:bg-sky-100/70 p-1.5 -mx-1.5 rounded-xl transition-all"
                              title="Bấm để xem bản đồ chỉ đường & lộ trình"
                            >
                              <h4
                                className={`text-xs font-bold text-slate-900 flex items-center gap-1.5 group-hover/loc:text-sky-700 transition-colors ${
                                  isDone ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                <MapPin className="w-3.5 h-3.5 text-sky-600 group-hover/loc:scale-125 transition-transform shrink-0" />
                                <span className="underline decoration-sky-300 underline-offset-2 font-black">
                                  {act.locationName}
                                </span>
                              </h4>

                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1 group-hover/loc:bg-sky-600 group-hover/loc:text-white transition-all shadow-2xs">
                                <Navigation className="w-3 h-3" />
                                <span>Chỉ đường</span>
                              </span>
                            </motion.div>

                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                              {act.description}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>

      {/* Interactive Map Directions Modal */}
      {selectedLocationForDirections && (
        <LocationDirectionsModal
          isOpen={!!selectedLocationForDirections}
          onClose={() => setSelectedLocationForDirections(null)}
          locationName={selectedLocationForDirections.locationName}
          destinationCity={currentPlan?.destination || destination}
          activityTime={selectedLocationForDirections.activityTime}
          activityDescription={selectedLocationForDirections.activityDescription}
          estimatedCost={selectedLocationForDirections.estimatedCost}
        />
      )}
    </div>
  );
};
