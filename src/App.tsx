import React, { useState, useEffect } from 'react';
import { LevelInfo } from './types';
import { loadLevelsProgress, saveLevelProgress } from './utils/storage';
import { HubScene } from './three/HubScene';
import { Level1BounceLab } from './three/levels/Level1BounceLab';
import { Level2KineticArena } from './three/levels/Level2KineticArena';
import { Level3GravityGym } from './three/levels/Level3GravityGym';
import { Level4ElasticField } from './three/levels/Level4ElasticField';
import { Level5GrandCoaster } from './three/levels/Level5GrandCoaster';
import { sound } from './audio/synth';
import {
  Volume2,
  VolumeX,
  LayoutGrid,
  Star,
  Sparkles,
  X,
  ChevronLeft,
  Flame,
  Zap,
  Dumbbell,
  Crosshair,
  Activity,
  Play,
  Atom,
  Compass,
  Home,
} from 'lucide-react';

export default function App() {
  const [levels, setLevels] = useState<LevelInfo[]>(() => loadLevelsProgress());
  const [currentLevelId, setCurrentLevelId] = useState<number | null>(null); // null = Hub
  const [showLevelSelectModal, setShowLevelSelectModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted());
  const [hasStarted, setHasStarted] = useState<boolean>(true);

  // Total stars
  const totalStars = levels.reduce((acc, lvl) => acc + lvl.stars, 0);
  const maxPossibleStars = levels.length * 3;

  // Global keyboard shortcuts (Space / Enter to start on Title screen, Esc to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasStarted && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        sound.playRelease();
        setHasStarted(true);
      } else if (e.code === 'Escape') {
        setShowLevelSelectModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted]);

  const handleStartGame = () => {
    sound.playRelease();
    setHasStarted(true);
  };

  const handleLevelSelect = (levelId: number) => {
    sound.playClick();
    setCurrentLevelId(levelId);
    setShowLevelSelectModal(false);
  };

  const handleReturnHub = () => {
    sound.playClick();
    setCurrentLevelId(null);
  };

  const handleCompleteLevel = (levelId: number, stars: number, score: number) => {
    saveLevelProgress(levelId, stars, score);
    setLevels(loadLevelsProgress());
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const getLevelIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-5 h-5 text-orange-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-cyan-400" />;
      case 'Dumbbell':
        return <Dumbbell className="w-5 h-5 text-emerald-400" />;
      case 'Crosshair':
        return <Crosshair className="w-5 h-5 text-violet-400" />;
      case 'Activity':
      default:
        return <Activity className="w-5 h-5 text-pink-400" />;
    }
  };

  const currentLevel = levels.find((l) => l.id === currentLevelId);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-['Cairo',sans-serif] text-slate-100 select-none">
      {/* Active 3D Scene Viewport */}
      {currentLevelId === null && (
        <HubScene levels={levels} onSelectLevel={handleLevelSelect} />
      )}

      {currentLevelId === 1 && (
        <Level1BounceLab
          onCompleteLevel={(stars, score) => handleCompleteLevel(1, stars, score)}
          onReturnHub={handleReturnHub}
        />
      )}

      {currentLevelId === 2 && (
        <Level2KineticArena
          onCompleteLevel={(stars, score) => handleCompleteLevel(2, stars, score)}
          onReturnHub={handleReturnHub}
        />
      )}

      {currentLevelId === 3 && (
        <Level3GravityGym
          onCompleteLevel={(stars, score) => handleCompleteLevel(3, stars, score)}
          onReturnHub={handleReturnHub}
        />
      )}

      {currentLevelId === 4 && (
        <Level4ElasticField
          onCompleteLevel={(stars, score) => handleCompleteLevel(4, stars, score)}
          onReturnHub={handleReturnHub}
        />
      )}

      {currentLevelId === 5 && (
        <Level5GrandCoaster
          onCompleteLevel={(stars, score) => handleCompleteLevel(5, stars, score)}
          onReturnHub={handleReturnHub}
        />
      )}

      {/* Unified Global Top-Left Navigation Bar */}
      {hasStarted && (
        <nav
          aria-label="قائمة التحكم والتنقل"
          className="fixed top-3 left-3 z-40 flex items-center gap-2 pointer-events-auto animate-fade-in"
        >
          {currentLevelId !== null ? (
            <>
              <button
                onClick={handleReturnHub}
                title="العودة للجزيرة الرئيسية"
                className="flex items-center gap-1.5 py-2 px-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:text-white hover:bg-slate-800 transition shadow-xl backdrop-blur-md text-xs font-black active:scale-95"
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">الجزيرة</span>
              </button>

              {currentLevel && (
                <div className="flex items-center gap-2 py-2 px-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md text-xs font-black">
                  <span className="text-cyan-400 font-mono font-bold">المستوى {currentLevel.id}:</span>
                  <span className="text-white hidden sm:inline">{currentLevel.title}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 py-2 px-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md text-xs font-black">
              <Atom className="w-4 h-4 text-cyan-400 animate-spin-slow" />
              <span className="text-white">مغامرة الطاقة</span>
            </div>
          )}

          <button
            onClick={handleToggleMute}
            title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-xl backdrop-blur-md active:scale-95"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setShowLevelSelectModal(true);
            }}
            title="قائمة المستويات"
            className="flex items-center gap-2 py-2 px-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:text-white hover:bg-slate-800 transition shadow-xl backdrop-blur-md text-xs font-black active:scale-95"
          >
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">المستويات (5)</span>
          </button>

          <div className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md text-xs font-mono font-black text-amber-300">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            <span className="tabular-nums">
              {totalStars} / {maxPossibleStars}
            </span>
          </div>
        </nav>
      )}

      {/* Polished Start Screen (Title Screen) */}
      {!hasStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-700/80 w-full max-w-xl rounded-3xl p-6 sm:p-10 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)] text-center space-y-6">
            {/* Title Lockup Badge */}
            <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-300 shadow-xl shadow-cyan-950/30">
              <Atom className="w-12 h-12 text-cyan-400 animate-spin-slow" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-cyan-400 tracking-wider uppercase block mb-1">
                فيزياء تفاعلية ثلاثية الأبعاد • المرحلة الثانوية
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                مغامرة الطاقة
              </h1>
              <p className="text-sm font-mono text-slate-400 mt-1">Energy Quest 3D</p>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              استكشف أسرار الميكانيكا الكلاسيكية وتحولات الطاقة (الحركية، التثاقلية، والمرونية) عبر 5 مختبرات تفاعلية ثلاثية الأبعاد بمخطط طاقة فوري مدرسي!
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300 font-semibold">
                ⚡ مخطط طاقة بمحور الصفر
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300 font-semibold">
                📐 فيزياء تحليلية دقيقة
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300 font-semibold">
                ⭐ تقييم وتحديات واختبارات
              </span>
            </div>

            {/* Primary Start CTA Button */}
            <div className="pt-2 space-y-3">
              <button
                onClick={handleStartGame}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-base shadow-2xl shadow-emerald-950/60 transition transform hover:scale-[1.02] active:scale-98"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>بدء المغامرة واستكشاف الجزيرة</span>
              </button>

              <p className="text-xs text-slate-500 font-mono">
                اضغط <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Space</kbd> أو <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Enter</kbd> للبدء السريع
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Glassmorphic Level Select Modal */}
      {showLevelSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900/95 border border-slate-700/80 w-full max-w-2xl rounded-3xl p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)] text-slate-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <LayoutGrid className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-lg text-white">اختر مختبر الطاقة</h3>
                  <p className="text-xs text-slate-400">5 مستويات فيزيائية تفاعلية مع مخططات الطاقة الحية</p>
                </div>
              </div>
              <button
                onClick={() => setShowLevelSelectModal(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Levels List with Glassmorphic styling */}
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 py-1">
              {levels.map((lvl) => (
                <div
                  key={lvl.id}
                  onClick={() => handleLevelSelect(lvl.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] ${
                    currentLevelId === lvl.id
                      ? 'ring-2 ring-cyan-500 border-cyan-500 bg-slate-800/90 shadow-lg'
                      : 'border-slate-800/80 hover:border-slate-600 bg-slate-950/70 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                      {getLevelIcon(lvl.iconName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-cyan-400 font-bold">المستوى {lvl.id}</span>
                        <h4 className="font-black text-sm sm:text-base text-white group-hover:text-cyan-300 transition">
                          {lvl.title}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                          ({lvl.englishTitle})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{lvl.objective}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Stars */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= lvl.stars
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                              : 'text-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                    <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-white transition group-hover:-translate-x-1" />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span className="font-mono font-bold">
                النجوم المحققة: {totalStars} من {maxPossibleStars}
              </span>
              <button
                onClick={() => {
                  setShowLevelSelectModal(false);
                  handleReturnHub();
                }}
                className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black transition border border-slate-700"
              >
                العودة للجزيرة ثلاثية الأبعاد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
