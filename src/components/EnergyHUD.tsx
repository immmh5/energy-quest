import React, { useState } from 'react';
import { EnergyState } from '../types';
import { formatMeters, formatVelocity, formatMass } from '../physics/formulas';
import { ChevronDown, ChevronUp, BarChart3, HelpCircle, Eye, EyeOff } from 'lucide-react';

interface EnergyHUDProps {
  energy: EnergyState;
  maxEnergyScale?: number; // scale ceiling in Joules, auto-adjusts if exceeded
  showWork?: boolean;
  showElastic?: boolean;
  referenceHeightLabel?: string;
  onReferenceHeightChange?: (h: number) => void;
  availableRefHeights?: { label: string; height: number }[];
}

export const EnergyHUD: React.FC<EnergyHUDProps> = ({
  energy,
  maxEnergyScale = 60,
  showWork = true,
  showElastic = false,
  onReferenceHeightChange,
  availableRefHeights,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFormulaTooltip, setShowFormulaTooltip] = useState(false);

  // Dynamic scale ceiling so bars fit comfortably
  const currentMax = Math.max(
    maxEnergyScale,
    Math.abs(energy.ke),
    Math.abs(energy.peGrav),
    Math.abs(energy.peElastic),
    Math.abs(energy.workDone),
    Math.abs(energy.totalEnergy),
    10
  );

  // Bar height percentage relative to half the chart height (from zero axis)
  const calcHeightPercent = (val: number) => {
    const ratio = Math.abs(val) / currentMax;
    return Math.min(Math.max(ratio * 88, val !== 0 ? 4 : 0), 92);
  };

  const bars = [
    {
      id: 'ke',
      title: 'طاقة حركية',
      symbol: 'KE',
      formula: '½ m v²',
      value: energy.ke,
      color: 'bg-cyan-500',
      border: 'border-cyan-300',
      textColor: 'text-cyan-300',
      glow: 'shadow-[0_0_14px_rgba(6,182,212,0.7)]',
      bgGlow: 'bg-cyan-500/20',
      isNegative: energy.ke < 0,
      visible: true,
    },
    {
      id: 'peGrav',
      title: 'وضع تثاقلية',
      symbol: 'PE_g',
      formula: 'm g (h - h₀)',
      value: energy.peGrav,
      color: 'bg-emerald-500',
      border: 'border-emerald-300',
      textColor: 'text-emerald-300',
      glow: 'shadow-[0_0_14px_rgba(16,185,129,0.7)]',
      bgGlow: 'bg-emerald-500/20',
      isNegative: energy.peGrav < -0.01,
      visible: true,
    },
    {
      id: 'peElastic',
      title: 'وضع مرونية',
      symbol: 'PE_e',
      formula: '½ k x²',
      value: energy.peElastic,
      color: 'bg-amber-500',
      border: 'border-amber-300',
      textColor: 'text-amber-300',
      glow: 'shadow-[0_0_14px_rgba(245,158,11,0.7)]',
      bgGlow: 'bg-amber-500/20',
      isNegative: energy.peElastic < 0,
      visible: showElastic,
    },
    {
      id: 'work',
      title: 'الشغل المبذول',
      symbol: 'W',
      formula: 'F · d',
      value: energy.workDone,
      color: 'bg-purple-500',
      border: 'border-purple-300',
      textColor: 'text-purple-300',
      glow: 'shadow-[0_0_14px_rgba(168,85,247,0.7)]',
      bgGlow: 'bg-purple-500/20',
      isNegative: energy.workDone < -0.01,
      visible: showWork,
    },
    {
      id: 'total',
      title: 'الطاقة الكلية',
      symbol: 'E_tot',
      formula: 'KE + PE',
      value: energy.totalEnergy,
      color: 'bg-yellow-400',
      border: 'border-yellow-200',
      textColor: 'text-yellow-300',
      glow: 'shadow-[0_0_16px_rgba(250,204,21,0.85)]',
      bgGlow: 'bg-yellow-400/25',
      isNegative: energy.totalEnergy < -0.01,
      visible: true,
    },
  ].filter(b => b.visible);

  return (
    <aside
      aria-label="مخطط الطاقة المباشر"
      className="fixed top-3 right-3 z-30 w-80 sm:w-96 md:w-[450px] max-w-[94vw] pointer-events-none transition-all duration-300"
    >
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.2)] p-3 sm:p-4 pointer-events-auto text-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide text-white">
                مخطط أعمدة الطاقة الحي
              </h2>
              <span className="text-[11px] font-mono font-bold text-slate-400 block -mt-0.5">
                المقياس: ±{Math.round(currentMax)} جول
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormulaTooltip(!showFormulaTooltip)}
              title="القوانين الفيزيائية"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition border border-slate-700"
            >
              {isCollapsed ? (
                <>
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>إظهار</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span>طي</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsed Compact State Summary */}
        {isCollapsed && (
          <div className="flex items-center justify-between py-1 text-xs sm:text-sm font-bold">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">الطاقة الكلية:</span>
              <span className="font-mono text-yellow-400 font-black text-base">
                {energy.totalEnergy.toFixed(1)} J
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-cyan-400">
              <span className="text-slate-400 font-sans font-normal text-xs">الحركية:</span>
              <span className="font-black">{energy.ke.toFixed(1)} J</span>
            </div>
          </div>
        )}

        {/* Formulas helper overlay when clicked */}
        {showFormulaTooltip && !isCollapsed && (
          <div className="mb-3 p-3 bg-slate-950/95 border border-cyan-700/80 rounded-xl text-xs space-y-1.5 text-slate-200 font-mono">
            <div className="font-bold text-cyan-400 font-sans text-xs sm:text-sm mb-1">
              القوانين الفيزيائية المعتمدة:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold block text-sm">KE = ½ m v²</span>
                <span className="text-[11px] text-slate-400 font-sans">تتناسب طردياً مع مربع السرعة</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold block text-sm">PE = m g (h - h₀)</span>
                <span className="text-[11px] text-slate-400 font-sans">تكون سالبة أسفل الإسناد (h &lt; h₀)</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-purple-400 font-bold block text-sm">W = F · d = ΔKE</span>
                <span className="text-[11px] text-slate-400 font-sans">شغل القوة يغير الطاقة الحركية</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-yellow-400 font-bold block text-sm">E = KE + PE</span>
                <span className="text-[11px] text-slate-400 font-sans">حفظ الطاقة الميكانيكية</span>
              </div>
            </div>
          </div>
        )}

        {!isCollapsed && (
          <>
            {/* Live Readouts Strip - Larger Prominent Typography */}
            <div className="grid grid-cols-4 gap-2 mb-3 text-center">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 shadow-inner">
                <span className="text-slate-400 block text-xs font-semibold mb-0.5">الارتفاع (h)</span>
                <span className="font-black text-emerald-400 font-mono text-sm sm:text-base tracking-tight block">
                  {formatMeters(energy.height)}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 shadow-inner">
                <span className="text-slate-400 block text-xs font-semibold mb-0.5">السرعة (v)</span>
                <span className="font-black text-cyan-400 font-mono text-sm sm:text-base tracking-tight block">
                  {formatVelocity(energy.velocity)}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 shadow-inner">
                <span className="text-slate-400 block text-xs font-semibold mb-0.5">الكتلة (m)</span>
                <span className="font-black text-amber-400 font-mono text-sm sm:text-base tracking-tight block">
                  {formatMass(energy.mass)}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 shadow-inner">
                <span className="text-slate-400 block text-xs font-semibold mb-0.5">مرجع (h₀)</span>
                <span className="font-black text-slate-200 font-mono text-sm sm:text-base tracking-tight block">
                  {energy.refHeight.toFixed(2)} م
                </span>
              </div>
            </div>

            {/* Reference Height Quick Picker if available */}
            {availableRefHeights && onReferenceHeightChange && (
              <div className="flex items-center justify-between bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800 mb-2.5 text-xs sm:text-sm">
                <span className="text-slate-300 font-bold">مستوى الإسناد (h₀):</span>
                <select
                  value={energy.refHeight}
                  onChange={(e) => onReferenceHeightChange(parseFloat(e.target.value))}
                  className="bg-slate-900 text-emerald-300 font-bold font-mono px-2 py-1 rounded-lg border border-slate-700 focus:outline-none cursor-pointer"
                >
                  {availableRefHeights.map((rh, i) => (
                    <option key={i} value={rh.height} className="bg-slate-900 text-slate-100">
                      {rh.label} ({rh.height.toFixed(2)} م)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Zero-Axis Textbook Bar Chart - Taller & Larger Font */}
            <div className="relative h-44 sm:h-48 bg-slate-950 rounded-xl border border-slate-800 px-3 sm:px-4 py-2.5 overflow-hidden flex flex-col justify-between shadow-inner">
              {/* Zero reference horizontal axis line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-slate-500 z-10 pointer-events-none flex items-center justify-between px-2">
                <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 shadow">
                  مستوى الصفر 0 J
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  + موجب لأعلى / - سالب لأسفل
                </span>
              </div>

              {/* Upper (Positive) and Lower (Negative) zones */}
              <div className="flex items-stretch justify-around gap-2 h-full relative z-20">
                {bars.map((bar) => {
                  const heightPct = calcHeightPercent(bar.value);
                  const isNeg = bar.value < -0.01;

                  return (
                    <div key={bar.id} className="flex-1 relative flex flex-col items-center h-full">
                      {/* Top Zone: Positive bars grow upwards from bottom (center of chart) */}
                      <div className="flex-1 w-full flex flex-col justify-end items-center relative">
                        {!isNeg && heightPct > 0 && (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-8 sm:w-12 rounded-t-md transition-all duration-75 ${bar.color} ${bar.border} ${bar.glow} border-t-2 border-x relative group`}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs sm:text-sm font-mono font-black whitespace-nowrap text-white bg-slate-900/95 px-1.5 py-0.5 rounded-md shadow-lg border border-slate-700">
                              {bar.value.toFixed(1)}J
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Spacer for zero-axis line */}
                      <div className="h-0.5 w-full"></div>

                      {/* Bottom Zone: Negative bars grow downwards from top (center of chart) */}
                      <div className="flex-1 w-full flex flex-col justify-start items-center relative">
                        {isNeg && heightPct > 0 && (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-8 sm:w-12 rounded-b-md transition-all duration-75 ${bar.color} ${bar.border} ${bar.glow} border-b-2 border-x relative group opacity-95`}
                          >
                            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs sm:text-sm font-mono font-black whitespace-nowrap text-rose-300 bg-slate-900/95 px-1.5 py-0.5 rounded-md shadow-lg border border-rose-900">
                              {bar.value.toFixed(1)}J
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Symbol Label */}
                      <div className="absolute -bottom-1 text-center pointer-events-none">
                        <span className={`text-xs sm:text-sm font-black block tracking-tight ${bar.textColor}`}>
                          {bar.symbol}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Labels legend row - Enlarged font */}
            <div className="flex flex-wrap items-center justify-around gap-2 mt-2.5 pt-2 border-t border-slate-800 text-xs sm:text-sm">
              {bars.map((bar) => (
                <div key={bar.id} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${bar.color}`} />
                  <span className="text-slate-200 font-bold">{bar.title}</span>
                  <span className="font-mono text-slate-400 text-xs font-semibold">({bar.formula})</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
