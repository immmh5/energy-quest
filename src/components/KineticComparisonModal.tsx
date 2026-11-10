import React, { useState } from 'react';
import { calculateKE, formatJoules } from '../physics/formulas';
import { X, Zap, ArrowRight, BarChart2, TrendingUp, Check } from 'lucide-react';

interface KineticComparisonModalProps {
  onClose: () => void;
}

export const KineticComparisonModal: React.FC<KineticComparisonModalProps> = ({ onClose }) => {
  const [baseMass, setBaseMass] = useState(50); // kg
  const [baseSpeed, setBaseSpeed] = useState(10); // m/s

  // Baseline
  const keBase = calculateKE(baseMass, baseSpeed);

  // Case 1: Double mass (2m, v) -> 2 * KE
  const keDoubleMass = calculateKE(baseMass * 2, baseSpeed);

  // Case 2: Double speed (m, 2v) -> 4 * KE
  const keDoubleSpeed = calculateKE(baseMass, baseSpeed * 2);

  // Max for bar chart scaling
  const maxKe = Math.max(keDoubleSpeed, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-5 shadow-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-white">المقارنة البصرية: الكتلة مقابل السرعة</h3>
              <p className="text-xs text-slate-400">لماذا تتضاعف الطاقة الحركية 4 مرات عند مضاعفة السرعة؟</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sliders for interactive comparison */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
          <div>
            <div className="flex justify-between font-mono text-slate-300 mb-1">
              <span>الكتلة المرجعية (m):</span>
              <span className="font-bold text-amber-400">{baseMass} كغ</span>
            </div>
            <input
              type="range"
              min="20"
              max="200"
              step="10"
              value={baseMass}
              onChange={(e) => setBaseMass(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-slate-300 mb-1">
              <span>السرعة المرجعية (v):</span>
              <span className="font-bold text-cyan-400">{baseSpeed} م/ث</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={baseSpeed}
              onChange={(e) => setBaseSpeed(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 3 Visual Bars Comparison */}
        <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
          {/* Baseline Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-semibold">1. الحالة الأصلية (m = {baseMass}كغ ، v = {baseSpeed}م/ث)</span>
              <span className="font-mono font-bold text-slate-300">{formatJoules(keBase)} (1×)</span>
            </div>
            <div className="w-full h-5 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
              <div
                style={{ width: `${(keBase / maxKe) * 100}%` }}
                className="h-full bg-slate-400 transition-all duration-300 rounded-lg flex items-center justify-end px-2 text-[10px] font-mono text-slate-950 font-bold"
              >
                1×
              </div>
            </div>
          </div>

          {/* Double Mass Bar (2x) */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <span>2. مضاعفة الكتلة فقط (2m = {baseMass * 2}كغ ، v = {baseSpeed}م/ث)</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">تناسب خطي</span>
              </span>
              <span className="font-mono font-bold text-amber-400">{formatJoules(keDoubleMass)} (2×)</span>
            </div>
            <div className="w-full h-5 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
              <div
                style={{ width: `${(keDoubleMass / maxKe) * 100}%` }}
                className="h-full bg-amber-500 transition-all duration-300 rounded-lg flex items-center justify-end px-2 text-[10px] font-mono text-slate-950 font-bold"
              >
                2×
              </div>
            </div>
          </div>

          {/* Double Speed Bar (4x!) */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <span>3. مضاعفة السرعة فقط (m = {baseMass}كغ ، 2v = {baseSpeed * 2}م/ث)</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-bold">تناسب تربيعي v²</span>
              </span>
              <span className="font-mono font-bold text-cyan-400">{formatJoules(keDoubleSpeed)} (4×!)</span>
            </div>
            <div className="w-full h-5 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
              <div
                style={{ width: `${(keDoubleSpeed / maxKe) * 100}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-lg flex items-center justify-end px-2 text-[10px] font-mono text-slate-950 font-bold"
              >
                4× (أربعة أضعاف!)
              </div>
            </div>
          </div>
        </div>

        {/* Physics Law Card */}
        <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl text-xs space-y-1.5">
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>النتيجة الفيزيائية الهامة لسلامة المرور وحوادث السير:</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            لأن الطاقة الحركية تعتمد على مربع السرعة ($v^2$)، فإن قيادة السيارة بضعف السرعة لا تضاعف طاقة الارتطام مرتين بل تضاعفها <strong className="text-cyan-300">4 أضعاف</strong>، وتتطلب مسافة كبح وشغلاً مضاعفاً 4 مرات للتوقف!
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
          >
            فهمت، العودة إلى الحلبة
          </button>
        </div>
      </div>
    </div>
  );
};
