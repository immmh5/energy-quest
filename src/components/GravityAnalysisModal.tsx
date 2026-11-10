import React from 'react';
import { X, Dumbbell, HelpCircle, Check, ArrowDown, ArrowUp } from 'lucide-react';

interface GravityAnalysisModalProps {
  onClose: () => void;
}

export const GravityAnalysisModal: React.FC<GravityAnalysisModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-5 shadow-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Dumbbell className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-white">دليل مستويات الإسناد وشغل الجاذبية</h3>
              <p className="text-xs text-slate-400">فهم القيم السالبة لطاقة الوضع وثبات شغل الجاذبية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Core Rules Cards */}
        <div className="space-y-2.5 text-xs">
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>1. مستوى الإسناد ($h_0$) هو خيار اختياري يحدده الباحث:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              طاقة الوضع ليست مطلقة؛ فالقانون هو PE = m · g · (h - h₀). إذا اخترت رف الكرات كمرجع (h₀ = 0.61 م)، فإن طاقة وضع الكرة على الرف تصبح 0 J، بينما تصبح طاقتها على سطح الأرض <strong className="text-rose-400">سالبة (-43.6 J)</strong> لأنها تقع أسفل المرجع.
            </p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <ArrowUp className="w-4 h-4 text-cyan-400" />
              <span>2. إشارة شغل الجاذبية (Gravity Work):</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              - أثناء <strong className="text-amber-300">الرفع لأعلى</strong>: تؤثر الجاذبية لأسفل والإزاحة لأعلى ← شغل الجاذبية <strong className="text-rose-400">سالب (Wg &lt; 0)</strong> ويقاوم الرفع.<br/>
              - أثناء <strong className="text-amber-300">الهبوط لأسفل</strong>: تؤثر الجاذبية لأسفل والإزاحة لأسفل ← شغل الجاذبية <strong className="text-emerald-400">موجب (Wg &gt; 0)</strong> ويسرع الجسم.
            </p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-purple-400 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-purple-400" />
              <span>3. الشغل والتغير في الطاقة كميات فيزيائية حقيقية ومطلقة:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              مهما غيرت مستوى الإسناد (سواء اخترت الأرض، أو الرف، أو سقف الغرفة)، فإن فرق الطاقة $\Delta PE$ والشغل $W_g = -\Delta PE$ يظلان <strong className="text-purple-300">ثابتين تماماً</strong> ولا يتغيران؛ لأن $(h_2 - h_0) - (h_1 - h_0) = h_2 - h_1$.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
          >
            العودة للتجربة
          </button>
        </div>
      </div>
    </div>
  );
};
