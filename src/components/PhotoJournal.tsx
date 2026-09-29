import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry } from '../types/travel';
import { useAuth } from '../context/AuthContext';
import { saveJournalToCloud, loadJournalsFromCloud, deleteJournalFromCloud } from '../lib/firebase';
import { 
  Sparkles, Camera, Image as ImageIcon, Upload, Heart, 
  MapPin, PenTool, Hash, Bookmark, Trash2, ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

// 6 Curated High-Quality Representative Vietnam Photos for fast demo
const DEMO_PHOTOS = [
  {
    id: 'demo_1',
    name: 'Ruộng bậc thang Mù Cang Chải',
    location: 'Yên Bái - Mù Cang Chải',
    mood: 'Choáng ngợp, tự do và bình yên trước núi rừng Tây Bắc',
    imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'demo_2',
    name: 'Đèn lồng Phố Cổ Hội An',
    location: 'Quảng Nam - Phố cổ Hội An',
    mood: 'Hoài niệm, ấm áp và lãng mạn bên bờ sông Hoài',
    imageUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'demo_3',
    name: 'Vịnh Hạ Long kỳ vĩ',
    location: 'Quảng Ninh - Vịnh Hạ Long',
    mood: 'Hùng vĩ, ngỡ ngàng trước non nước ngàn năm',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
];

export const PhotoJournal: React.FC = () => {
  const { currentUser, effectiveUserId } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'feed'>('create');
  const [selectedImage, setSelectedImage] = useState<string>(DEMO_PHOTOS[0].imageUrl);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('image/jpeg');
  const [location, setLocation] = useState<string>(DEMO_PHOTOS[0].location);
  const [mood, setMood] = useState<string>(DEMO_PHOTOS[0].mood);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEntry, setGeneratedEntry] = useState<JournalEntry | null>(null);
  const [savedEntries, setSavedEntries] = useState<JournalEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved journals from localStorage & Cloud Firestore
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vietnam_photo_journals');
      if (stored) {
        setSavedEntries(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }

    if (effectiveUserId) {
      loadJournalsFromCloud(effectiveUserId).then((cloudJournals) => {
        if (cloudJournals && cloudJournals.length > 0) {
          setSavedEntries((prev) => {
            const map = new Map<string, JournalEntry>();
            prev.forEach((j) => map.set(j.id, j));
            cloudJournals.forEach((j) => map.set(j.id, j));
            const merged = Array.from(map.values());
            localStorage.setItem('vietnam_photo_journals', JSON.stringify(merged));
            return merged;
          });
        }
      });
    }
  }, [effectiveUserId]);

  // Handle image upload from user device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Select one of the iconic demo photos
  const handleSelectDemoPhoto = (photo: typeof DEMO_PHOTOS[0]) => {
    setSelectedImage(photo.imageUrl);
    setSelectedMimeType('image/jpeg');
    setLocation(photo.location);
    setMood(photo.mood);
  };

  // Call server-side API (Prompt 2)
  const handleGenerateJournal = async () => {
    if (!selectedImage || !location.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType: selectedMimeType,
          location,
          mood,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi khi viết nhật ký.');
      }

      const newEntry: JournalEntry = {
        id: `entry_${Date.now()}`,
        imageUrl: selectedImage,
        location,
        mood,
        caption: json.data.caption,
        journalText: json.data.journal,
        hashtags: json.data.hashtags,
        date: new Date().toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        likes: 1,
      };

      setGeneratedEntry(newEntry);

      confetti({
        particleCount: 45,
        spread: 55,
        origin: { y: 0.65 },
        colors: ['#0284c7', '#06b6d4', '#38bdf8', '#f59e0b'],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tạo nhật ký ảnh.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToAlbum = () => {
    if (!generatedEntry) return;
    const updated = [generatedEntry, ...savedEntries];
    setSavedEntries(updated);
    localStorage.setItem('vietnam_photo_journals', JSON.stringify(updated));

    // Save to Cloud Firestore
    if (effectiveUserId) {
      saveJournalToCloud(effectiveUserId, generatedEntry);
    }

    setActiveTab('feed');
  };

  const handleToggleLike = (id: string) => {
    const updated = savedEntries.map((item) =>
      item.id === id ? { ...item, likes: (item.likes || 0) + 1 } : item
    );
    setSavedEntries(updated);
    localStorage.setItem('vietnam_photo_journals', JSON.stringify(updated));
  };

  const handleDeleteEntry = (id: string) => {
    const updated = savedEntries.filter((item) => item.id !== id);
    setSavedEntries(updated);
    localStorage.setItem('vietnam_photo_journals', JSON.stringify(updated));

    // Delete from Cloud Firestore
    if (effectiveUserId) {
      deleteJournalFromCloud(effectiveUserId, id);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Top Banner - iPhone 18 Glacier Blue Gradient */}
      <div className="bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#0891b2] text-white p-5 rounded-b-3xl shadow-lg shadow-sky-900/20 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-cyan-100 border border-white/30 backdrop-blur-md">
            📸 AI Photo Memories Journal
          </span>
          <span className="text-xs text-cyan-100">
            {savedEntries.length} kỷ niệm đã lưu
          </span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Nhật Ký Ảnh Kỷ Niệm
        </h1>
        <p className="text-xs text-cyan-100/90 mt-1">
          Gửi bức ảnh và từ khóa tâm trạng - AI sẽ dệt nên những dòng tản văn lắng đọng
        </p>

        {/* Sub Navigation Toggle */}
        <div className="flex bg-black/20 p-1 rounded-2xl mt-4 max-w-xs backdrop-blur-md border border-white/10">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-sky-900 shadow-xs'
                : 'text-cyan-100 hover:text-white'
            }`}
          >
            Tạo nhật ký mới
          </button>
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white text-sky-900 shadow-xs'
                : 'text-cyan-100 hover:text-white'
            }`}
          >
            Sổ Kỷ Niệm ({savedEntries.length})
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'create' ? (
          <>
            {/* Image Preview & Upload Card */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  Ảnh chụp chuyến đi
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-sky-600 font-bold hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Tải ảnh từ máy
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Photo Preview Box */}
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-950 flex items-center justify-center border border-sky-100 shadow-inner group">
                <img
                  src={selectedImage}
                  alt="Travel memory preview"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 text-white pointer-events-none">
                  <p className="text-xs font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                    {location || 'Chọn địa điểm...'}
                  </p>
                  <p className="text-[11px] text-white/80 line-clamp-1 italic mt-0.5">
                    &ldquo;{mood}&rdquo;
                  </p>
                </div>
              </div>

              {/* Presets Gallery Chips */}
              <div>
                <p className="text-[11px] text-slate-400 font-medium mb-1.5">
                  Hoặc chọn nhanh ảnh mẫu danh thắng Việt Nam:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_PHOTOS.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => handleSelectDemoPhoto(photo)}
                      className={`relative rounded-xl overflow-hidden aspect-[16/10] border-2 transition-all cursor-pointer ${
                        selectedImage === photo.imageUrl
                          ? 'border-cyan-500 ring-2 ring-cyan-200'
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold p-0.5 truncate text-center">
                        {photo.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Input */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  Địa điểm chụp bức ảnh
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="VD: Sa Pa, Phố Cổ Hội An, Vịnh Hạ Long, Mũi Né..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-sky-100 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              {/* Mood / Keywords Input */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  Tâm trạng của bạn lúc này
                </label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="VD: Bình yên, hơi se lạnh, cảm thấy thư giãn..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-sky-100 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />

                {/* Mood Tag Suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Bình yên, hơi se lạnh, cảm thấy thư giãn',
                    'Hoài niệm, thơ mộng, ấm áp',
                    'Tự do phơi phới, rạo rực',
                    'Thanh tịnh, an yên trong lành',
                    'Nắng vàng, sảng khoái tràn đầy',
                  ].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                        mood === m
                          ? 'bg-sky-50 border-sky-300 text-sky-800 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.split(',')[0]}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button - Glacier Radiant */}
              <button
                onClick={handleGenerateJournal}
                disabled={isGenerating || !selectedImage || !location.trim()}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Nhà văn du lịch AI đang viết nhật ký cảm xúc...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Viết Nhật Ký Cho Bức Ảnh Này (AI)</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium">
                {errorMessage}
              </div>
            )}

            {/* Generated Entry Display Card (Polaroid Style) */}
            {generatedEntry && (
              <div className="bg-white rounded-3xl p-5 shadow-lg border border-sky-100 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                  <span className="text-xs font-bold text-sky-700 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5" />
                    Trang Nhật Ký Mới Viết Xong
                  </span>
                  <span className="text-[11px] text-slate-400">{generatedEntry.date}</span>
                </div>

                {/* Polaroid Frame */}
                <div className="bg-sky-50/40 p-3 rounded-2xl border border-sky-100 shadow-xs space-y-3">
                  <div className="rounded-xl overflow-hidden aspect-[4/3]">
                    <img
                      src={generatedEntry.imageUrl}
                      alt={generatedEntry.location}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-2 space-y-2">
                    {/* Caption (Tiêu đề) */}
                    <div className="border-l-3 border-cyan-500 pl-3">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-cyan-600">
                        🖋️ Caption
                      </p>
                      <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">
                        &ldquo;{generatedEntry.caption}&rdquo;
                      </h3>
                    </div>

                    {/* Journal text */}
                    <div className="pt-2 text-xs text-slate-700 leading-relaxed italic bg-white p-3 rounded-xl border border-sky-100 shadow-2xs">
                      {generatedEntry.journalText}
                    </div>

                    {/* Hashtags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {generatedEntry.hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveToAlbum}
                    className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 text-white font-extrabold text-xs shadow-md shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer hover:from-sky-600 hover:to-blue-700 transition-all"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>Lưu vào Cuốn Sổ Kỷ Niệm</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Sổ kỷ niệm Feed */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Những trang nhật ký đã lưu ({savedEntries.length})
              </h3>
              <button
                onClick={() => setActiveTab('create')}
                className="text-xs text-sky-600 font-bold hover:underline"
              >
                + Viết thêm kỷ niệm
              </button>
            </div>

            {savedEntries.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-sky-100 space-y-3">
                <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-700">Chưa có bài viết nào trong sổ kỷ niệm</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Hãy chọn một bức ảnh kỷ niệm du lịch Việt Nam và để AI chắp bút viết bài viết đầu tiên cho bạn!
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-2 py-2 px-4 rounded-xl bg-sky-600 text-white font-bold text-xs"
                >
                  Tạo bài viết ngay
                </button>
              </div>
            ) : (
              savedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-3xl p-4 shadow-sm border border-sky-100 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-sky-600" />
                        {entry.location}
                      </span>
                      <span className="text-[10px] text-slate-400">• {entry.date}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-slate-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="rounded-2xl overflow-hidden aspect-[16/10] bg-slate-900">
                    <img
                      src={entry.imageUrl}
                      alt={entry.location}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black text-slate-900 leading-snug">
                      &ldquo;{entry.caption}&rdquo;
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed italic bg-sky-50/50 p-3 rounded-2xl border border-sky-100">
                      {entry.journalText}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {entry.hashtags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] text-sky-700 bg-sky-50 font-medium px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sky-50 flex items-center justify-between text-xs text-slate-400">
                    <button
                      onClick={() => handleToggleLike(entry.id)}
                      className="flex items-center gap-1.5 text-rose-500 font-semibold hover:scale-105 active:scale-95 transition-transform"
                    >
                      <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                      <span>{entry.likes || 1} Yêu thích</span>
                    </button>
                    <span className="text-[10px] text-slate-400">Tâm trạng: {entry.mood}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
