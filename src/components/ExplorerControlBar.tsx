import React from 'react';
import { Bot, Zap, ArrowUp, ArrowDown, Move } from 'lucide-react';
import { sound } from '../audio/synth';

interface ExplorerControlBarProps {
  isExplorerMode: boolean;
  isFirstPerson: boolean;
  onToggleMode: () => void;
  onTouchKey?: (key: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down' | 'sprint', active: boolean) => void;
  className?: string;
}

export const ExplorerControlBar: React.FC<ExplorerControlBarProps> = ({
  isExplorerMode,
  isFirstPerson,
  onToggleMode,
  onTouchKey,
  className = '',
}) => {
  return (
    <>
      {/* Toggle Button placed prominently in top-left or header */}
      <div className={`pointer-events-auto flex items-center gap-2 ${className}`}>
        <button
          onClick={() => {
            sound.playClick();
            onToggleMode();
          }}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl font-bold text-xs transition-all shadow-lg backdrop-blur-md border ${
            isExplorerMode
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/80 shadow-emerald-950/40'
              : 'bg-slate-900/90 hover:bg-slate-800 text-sky-300 border-sky-500/40 shadow-slate-950/50'
          }`}
          title={isExplorerMode ? 'انقر للعودة لمتابعة التجربة المخبرية' : 'تفعيل روبوت الاستكشاف والتحكم الحر بـ WASD'}
        >
          <Bot className={`w-4 h-4 ${isExplorerMode ? 'text-amber-300' : 'text-sky-400'}`} />
          <span>
            {isExplorerMode ? 'نمط اللاعب (نشط 🤖)' : 'وضع استكشاف المختبر 🤖'}
          </span>
          {isExplorerMode && isFirstPerson && (
            <span className="bg-sky-500/30 text-sky-200 border border-sky-400/40 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              منظور 1D
            </span>
          )}
        </button>
      </div>

      {/* When Explorer Mode is active: Show Guidance Banner and Mobile D-Pad */}
      {isExplorerMode && (
        <>
          {/* Top Info Banner */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-fadeIn w-auto max-w-[96vw]">
            <div className="flex flex-wrap items-center justify-center gap-2 py-1.5 px-4 rounded-full bg-slate-950/92 border border-emerald-500/40 text-slate-200 text-xs shadow-2xl backdrop-blur-md">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Move className="w-3.5 h-3.5" />
                التحكم:
              </span>
              <span className="hidden sm:inline">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] border border-slate-700">W</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] border border-slate-700 mx-0.5">S</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] border border-slate-700">A</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] border border-slate-700 mr-1.5">D</kbd>
                للتحرك
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300 font-bold flex items-center gap-0.5">
                <kbd className="px-1.5 py-0.5 bg-amber-950/80 text-amber-300 rounded text-[11px] border border-amber-600/60 font-mono">Ctrl</kbd>
                <span>تيربو وسرعة فائقة ⚡</span>
              </span>
              <span className="text-slate-500">•</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] border border-slate-700 text-amber-300">Space</kbd> صعود
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] border border-slate-700 text-sky-300">Shift</kbd> هبوط
              </span>
              <span className="text-slate-500 hidden md:inline">•</span>
              <span className="text-slate-300 hidden md:inline">
                كلك يسار: تحريك الشاشة (2D Pan) • كلك يمين: دوران 3D
              </span>
              <span className="text-slate-500">•</span>
              <span className={isFirstPerson ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                {isFirstPerson ? '👁️ منظور الشخص الأول (1D)' : '🔍 قرّب الكاميرا لوجه اللاعب لدخول 1D'}
              </span>
            </div>
          </div>

          {/* On-screen touch flight & sprint controls for mobile */}
          {onTouchKey && (
            <div className="fixed bottom-24 right-4 z-40 pointer-events-auto flex flex-col gap-2.5 sm:hidden">
              <button
                onTouchStart={() => onTouchKey('sprint', true)}
                onTouchEnd={() => onTouchKey('sprint', false)}
                onMouseDown={() => onTouchKey('sprint', true)}
                onMouseUp={() => onTouchKey('sprint', false)}
                className="w-12 h-12 rounded-full bg-amber-600/90 text-white flex flex-col items-center justify-center border border-amber-400 shadow-xl active:bg-amber-500 text-[10px] font-bold"
              >
                <Zap className="w-5 h-5 text-amber-200" />
                تيربو
              </button>
              <button
                onTouchStart={() => onTouchKey('up', true)}
                onTouchEnd={() => onTouchKey('up', false)}
                onMouseDown={() => onTouchKey('up', true)}
                onMouseUp={() => onTouchKey('up', false)}
                className="w-12 h-12 rounded-full bg-emerald-600/90 text-white flex flex-col items-center justify-center border border-emerald-400 shadow-xl active:bg-emerald-500 text-[10px]"
              >
                <ArrowUp className="w-5 h-5" />
                صعود
              </button>
              <button
                onTouchStart={() => onTouchKey('down', true)}
                onTouchEnd={() => onTouchKey('down', false)}
                onMouseDown={() => onTouchKey('down', true)}
                onMouseUp={() => onTouchKey('down', false)}
                className="w-12 h-12 rounded-full bg-slate-800/90 text-sky-300 flex flex-col items-center justify-center border border-sky-400/50 shadow-xl active:bg-slate-700 text-[10px]"
              >
                <ArrowDown className="w-5 h-5" />
                هبوط
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
};
