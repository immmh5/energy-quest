import React from 'react';
import { TrialData } from '../types';
import { calculateBestFitSlope, formatMeters } from '../physics/formulas';
import { X, TrendingUp, HelpCircle } from 'lucide-react';

interface BounceGraphModalProps {
  trials: TrialData[];
  onClose: () => void;
  onProceedToPrediction: () => void;
}

export const BounceGraphModal: React.FC<BounceGraphModalProps> = ({
  trials,
  onClose,
  onProceedToPrediction,
}) => {
  const points = trials.map(t => ({ x: t.initialHeight, y: t.bounceHeight }));
  const slope = calculateBestFitSlope(points);
  const energyLossPct = (1 - slope) * 100;

  // Graph SVG scale parameters
  const maxX = 10;
  const maxY = 7;
  const svgW = 420;
  const svgH = 260;
  const padL = 50;
  const padB = 40;
  const plotW = svgW - padL - 20;
  const plotH = svgH - padB - 20;

  const toSvgX = (x: number) => padL + (x / maxX) * plotW;
  const toSvgY = (y: number) => svgH - padB - (y / maxY) * plotH;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-5 shadow-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-white">الرسم البياني وخط أفضل مطابقة</h3>
              <p className="text-xs text-slate-400">العلاقة بين ارتفاع السقوط (h₁) وارتفاع الارتداد (h₂)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SVG Plot */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex justify-center">
          <svg width={svgW} height={svgH} className="overflow-visible font-mono text-[10px]">
            {/* Grid lines */}
            {[2, 4, 6, 8, 10].map(x => (
              <line
                key={`gx-${x}`}
                x1={toSvgX(x)}
                y1={toSvgY(0)}
                x2={toSvgX(x)}
                y2={toSvgY(maxY)}
                stroke="#1e293b"
                strokeDasharray="3 3"
              />
            ))}
            {[1, 2, 3, 4, 5, 6].map(y => (
              <line
                key={`gy-${y}`}
                x1={toSvgX(0)}
                y1={toSvgY(y)}
                x2={toSvgX(maxX)}
                y2={toSvgY(y)}
                stroke="#1e293b"
                strokeDasharray="3 3"
              />
            ))}

            {/* Axes */}
            <line
              x1={toSvgX(0)}
              y1={toSvgY(0)}
              x2={toSvgX(maxX)}
              y2={toSvgY(0)}
              stroke="#64748b"
              strokeWidth="2"
            />
            <line
              x1={toSvgX(0)}
              y1={toSvgY(0)}
              x2={toSvgX(0)}
              y2={toSvgY(maxY)}
              stroke="#64748b"
              strokeWidth="2"
            />

            {/* Axis labels numbers */}
            {[2, 4, 6, 8, 10].map(x => (
              <text key={`tx-${x}`} x={toSvgX(x)} y={svgH - padB + 16} fill="#94a3b8" textAnchor="middle">
                {x}
              </text>
            ))}
            {[1, 2, 3, 4, 5, 6].map(y => (
              <text key={`ty-${y}`} x={padL - 8} y={toSvgY(y) + 3} fill="#94a3b8" textAnchor="end">
                {y}
              </text>
            ))}

            {/* Axis titles */}
            <text x={toSvgX(maxX / 2)} y={svgH - 5} fill="#cbd5e1" textAnchor="middle" className="font-sans font-semibold">
              ارتفاع السقوط h₁ (متر)
            </text>
            <text
              x={15}
              y={toSvgY(maxY / 2)}
              fill="#cbd5e1"
              textAnchor="middle"
              transform={`rotate(-90 15 ${toSvgY(maxY / 2)})`}
              className="font-sans font-semibold"
            >
              ارتفاع الارتداد h₂ (متر)
            </text>

            {/* Theoretical 100% elastic line (y = x) as gray dashed */}
            <line
              x1={toSvgX(0)}
              y1={toSvgY(0)}
              x2={toSvgX(6)}
              y2={toSvgY(6)}
              stroke="#475569"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text x={toSvgX(5.5)} y={toSvgY(6) - 5} fill="#64748b" className="font-sans text-[9px]">
              لو كان التصادم مرناً 100%
            </text>

            {/* Best-fit regression line y = slope * x */}
            {slope > 0 && (
              <line
                x1={toSvgX(0)}
                y1={toSvgY(0)}
                x2={toSvgX(maxX)}
                y2={toSvgY(slope * maxX)}
                stroke="#f97316"
                strokeWidth="2.5"
              />
            )}

            {/* Data points */}
            {trials.map((t, idx) => (
              <g key={t.id}>
                <circle
                  cx={toSvgX(t.initialHeight)}
                  cy={toSvgY(t.bounceHeight)}
                  r="5"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={toSvgX(t.initialHeight) + 6}
                  y={toSvgY(t.bounceHeight) - 6}
                  fill="#38bdf8"
                  className="font-bold"
                >
                  ت{idx + 1} ({t.bounceHeight.toFixed(2)}م)
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Physics Analysis Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">معادلة خط أفضل مطابقة:</span>
            <span className="font-bold text-orange-400 font-mono text-sm block">
              h₂ = {slope.toFixed(3)} × h₁
            </span>
            <span className="text-[11px] text-slate-400">
              (معامل الارتداد التربيعي e² = {(Math.sqrt(slope)).toFixed(2)}² = {slope.toFixed(3)})
            </span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">نسبة الطاقة الميكانيكية المفقودة:</span>
            <span className="font-bold text-rose-400 font-mono text-sm block">
              {energyLossPct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400">
              تتحول إلى طاقة حرارية في الكرة والأرضية وصوت الارتطام
            </span>
          </div>
        </div>

        {/* Educational takeaway */}
        <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-xl text-xs text-blue-200 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            النسبة بين ارتفاع الارتداد وارتفاع السقوط ثابتة دائماً (تقريباً 0.56). هذا يثبت أن ضياع الطاقة نسبة مئوية ثابتة من الطاقة الكلية الابتدائية، ولذلك لا يمكن للكرة أن تعود أبداً لنفس الارتفاع دون شغل إضافي!
          </p>
        </div>

        {/* CTA */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition"
          >
            إغلاق
          </button>
          <button
            onClick={() => {
              onClose();
              onProceedToPrediction();
            }}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-950/30"
          >
            الانتقال لتحدي التوقع من 10 أمتار!
          </button>
        </div>
      </div>
    </div>
  );
};
