import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VietnamMap } from './components/VietnamMap';
import { SmartPlanner } from './components/SmartPlanner';
import { PhotoJournal } from './components/PhotoJournal';
import { readUserData, writeUserData } from './lib/userStorage';
import { FlutterCodeViewer } from './components/FlutterCodeViewer';
import { 
  MapPin, Calendar, Camera, Code2, Smartphone, Monitor, 
  Wifi, Battery, Cloud, CloudCheck, User as UserIcon, LogIn, LogOut
} from 'lucide-react';

function TravelAppInner() {
  const { 
    currentUser, effectiveUserId, isAnonymous, isCloudReady, isSyncing, 
    signInGoogle, signOutUser, syncVisitedToCloud, fetchVisitedFromCloud 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'map' | 'planner' | 'journal' | 'flutter'>('map');

  // Visited provinces state
  const [visitedProvinces, setVisitedProvinces] = useState<string[]>(() => {
    const stored = readUserData<unknown>(effectiveUserId, 'visited-provinces', []);
    return Array.isArray(stored) ? stored.filter(item => typeof item === 'string') : [];
  });
  const visitedEdited = React.useRef(false);

  const [prefilledDestination, setPrefilledDestination] = useState<string>('');
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState('09:41');

  // UID changes remount the workspace; never merge across accounts.
  useEffect(() => {
    let cancelled = false;
    fetchVisitedFromCloud().then((cloudProvinces) => {
      if (!cancelled && !visitedEdited.current && cloudProvinces !== null) {
        setVisitedProvinces(cloudProvinces);
        try { writeUserData(effectiveUserId, 'visited-provinces', cloudProvinces); }
        catch (error) { console.warn('Could not cache visited provinces:', error); }
      }
    });
    return () => { cancelled = true; };
  }, [effectiveUserId]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleProvince = (provinceName: string) => {
    visitedEdited.current = true;
    setVisitedProvinces((prev) => {
      let updated: string[];
      if (prev.includes(provinceName)) {
        updated = prev.filter((p) => p !== provinceName);
      } else {
        updated = [...prev, provinceName];
      }
      try { writeUserData(effectiveUserId, 'visited-provinces', updated); }
      catch (error) { console.warn('Could not save visited provinces locally:', error); }
      // Save directly to Firebase Cloud Firestore!
      syncVisitedToCloud(updated);
      return updated;
    });
  };

  const handleSelectForPlanner = (destination: string) => {
    setPrefilledDestination(destination);
    setActiveTab('planner');
  };

  const navItems = [
    { id: 'map', label: 'Bản Đồ', icon: MapPin },
    { id: 'planner', label: 'Lịch Trình AI', icon: Calendar },
    { id: 'journal', label: 'Nhật Ký Ảnh', icon: Camera },
    { id: 'flutter', label: 'Mã Flutter', icon: Code2 },
  ] as const;

  return (
    <div className="min-h-screen bg-[#070e1b] text-slate-900 flex flex-col items-center justify-start p-0 sm:p-4 md:p-6 overflow-x-hidden selection:bg-cyan-500 selection:text-white">
      {/* Top Controller Bar */}
      <header className="w-full max-w-4xl py-2.5 px-4 mb-2 flex items-center justify-between text-slate-300 text-xs">
        <div className="flex items-center gap-2.5">
          <motion.div 
            whileHover={{ scale: 1.08, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-400 to-blue-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-cyan-500/30 border border-sky-300/40 cursor-pointer"
          >
            VN
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm tracking-tight">
                Việt Nam Đi & Nhớ
              </span>
              {/* Firebase Cloud Status Live Badge */}
              <span className="text-[10px] text-cyan-200 bg-sky-950/80 px-2 py-0.5 rounded-full border border-cyan-800/60 font-medium flex items-center gap-1 shadow-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${isCloudReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isSyncing ? 'Đang lưu Cloud...' : 'Firebase Cloud Live'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Auth Controls */}
        <div className="flex items-center gap-2">
          {/* User Sign-In Pill */}
          {isAnonymous ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={signInGoogle}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-100 border border-white/10 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shadow-xs"
              title="Đăng nhập Google để đồng bộ vĩnh viễn"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden md:inline">Đăng nhập</span>
            </motion.button>
          ) : (
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl border border-white/10 text-cyan-100">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="User" className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline font-bold truncate max-w-[100px]">{currentUser?.displayName?.split(' ')[0]}</span>
              <button onClick={signOutUser} title="Đăng xuất" className="text-slate-400 hover:text-white ml-1">
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="bg-slate-900/90 p-1 rounded-2xl border border-sky-950/80 flex items-center gap-1 shadow-inner">
            <button
              onClick={() => setIsMobileFrame(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isMobileFrame
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Khung Mobile</span>
            </button>
            <button
              onClick={() => setIsMobileFrame(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                !isMobileFrame
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Mở Rộng</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <motion.div
        layout
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className={`w-full relative flex flex-col bg-slate-50/95 overflow-hidden shadow-2xl transition-all ${
          isMobileFrame
            ? 'max-w-[420px] rounded-[50px] border-[8px] border-slate-800/95 ring-1 ring-sky-500/30 min-h-[830px] max-h-[92vh] shadow-cyan-950/60'
            : 'max-w-4xl rounded-3xl border border-sky-900/40 min-h-[86vh]'
        }`}
      >
        {/* Mobile Device Status Bar */}
        <div className="w-full bg-gradient-to-r from-[#0369a1] via-[#0284c7] to-[#0891b2] text-white px-6 pt-3.5 pb-2 flex items-center justify-between text-[11px] font-semibold select-none z-30 shrink-0 shadow-xs">
          <span>{currentTime}</span>

          {/* Dynamic Island */}
          {isMobileFrame && (
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="w-22 h-4.5 bg-slate-950 rounded-full flex items-center justify-between px-2.5 border border-white/10 shadow-inner"
            >
              <div className="w-2 h-2 rounded-full bg-slate-900 border border-cyan-500/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
            </motion.div>
          )}

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] font-bold text-cyan-200">5G</span>
            <Wifi className="w-3.5 h-3.5 text-cyan-100" />
            <Battery className="w-4 h-4 text-cyan-100" />
          </div>
        </div>

        {/* Scrollable Viewport Content */}
        <main className="flex-1 overflow-y-auto mobile-scroll-container bg-[#f8fbff] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.995 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="min-h-full"
            >
              {activeTab === 'map' && (
                <VietnamMap
                  visitedProvinces={visitedProvinces}
                  onToggleProvince={handleToggleProvince}
                  onSelectForPlanner={handleSelectForPlanner}
                />
              )}

              {activeTab === 'planner' && (
                <SmartPlanner
                  initialDestination={prefilledDestination}
                  onClearInitialDestination={() => setPrefilledDestination('')}
                />
              )}

              {activeTab === 'journal' && <PhotoJournal />}

              {activeTab === 'flutter' && <FlutterCodeViewer />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* iPhone Glass Bottom Navigation Bar */}
        <nav className="sticky bottom-0 inset-x-0 bg-white/85 backdrop-blur-2xl border-t border-sky-100/90 py-2.5 px-3 flex items-center justify-around z-40 shadow-[0_-4px_25px_rgba(2,132,199,0.09)] select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl cursor-pointer group transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavBackground"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 bg-gradient-to-r from-sky-50 via-cyan-50 to-sky-100 rounded-2xl border border-sky-200/80 -z-10 shadow-xs"
                  />
                )}

                <motion.div
                  animate={{ scale: isActive ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`p-1.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-gradient-to-tr from-sky-500 to-cyan-500 text-white shadow-md shadow-cyan-500/35'
                      : 'text-slate-400 group-hover:text-slate-600 group-hover:scale-105'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </motion.div>

                <span
                  className={`text-[10px] mt-0.5 font-bold transition-colors ${
                    isActive ? 'text-sky-700' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </motion.div>
    </div>
  );
}

function AuthenticatedWorkspace() {
  const { effectiveUserId, isCloudReady, signInGoogle, isSyncing } = useAuth();
  const [loginError, setLoginError] = useState('');
  if (!isCloudReady) return <div className="min-h-screen bg-[#070e1b] text-white flex items-center justify-center">Đang tải tài khoản...</div>;
  if (effectiveUserId) return <TravelAppInner key={effectiveUserId} />;
  return (
    <div className="min-h-screen bg-[#070e1b] text-white flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-5">
        <h1 className="text-2xl font-bold">Việt Nam Đi & Nhớ</h1>
        <p className="text-slate-300">Đăng nhập để quản lý lịch trình, nhật ký và các tỉnh đã đi của riêng bạn.</p>
        <button disabled={isSyncing} className="bg-cyan-500 rounded-xl px-5 py-3 font-bold disabled:opacity-50"
          onClick={async () => {
            setLoginError('');
            try { await signInGoogle(); }
            catch (error: any) { setLoginError(error.message || 'Không thể đăng nhập. Vui lòng thử lại.'); }
          }}>
          {isSyncing ? 'Đang đăng nhập...' : 'Đăng nhập Google'}
        </button>
        {loginError && <p role="alert" className="text-rose-300 text-sm">{loginError}</p>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedWorkspace />
    </AuthProvider>
  );
}
