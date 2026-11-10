import React, { useState } from 'react';
import { QuizQuestion } from '../types';
import { sound } from '../audio/synth';
import confetti from 'canvas-confetti';
import { Star, CheckCircle2, XCircle, ArrowRight, RotateCcw, Home, Award, Sparkles, Check } from 'lucide-react';

interface QuizModalProps {
  levelTitle: string;
  questions: QuizQuestion[];
  onComplete: (stars: number, score: number) => void;
  onReplay: () => void;
  onReturnHub: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  levelTitle,
  questions,
  onComplete,
  onReplay,
  onReturnHub,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);

    const isCorrect = idx === currentQ.correctIndex;
    if (isCorrect) {
      sound.playCorrect();
      setCorrectAnswersCount(prev => prev + 1);
    } else {
      sound.playWrong();
    }
  };

  const handleNext = () => {
    sound.playClick();
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      const finalCorrect = correctAnswersCount + (selectedOption === currentQ.correctIndex ? 0 : 0);
      let awardedStars = 1;
      if (finalCorrect >= 2) awardedStars = 2;
      if (finalCorrect === 3) awardedStars = 3;

      setIsFinished(true);
      sound.playVictory();
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
      });
      onComplete(awardedStars, finalCorrect * 100);
    }
  };

  if (isFinished) {
    let finalStars = 1;
    if (correctAnswersCount >= 2) finalStars = 2;
    if (correctAnswersCount === 3) finalStars = 3;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
        <div className="bg-slate-900/95 border border-slate-700/80 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)] text-center space-y-6">
          <div className="inline-flex p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/20">
            <Award className="w-12 h-12" />
          </div>

          <div>
            <span className="text-xs font-mono font-bold text-amber-400 tracking-wider block uppercase mb-1">
              أتممت المستوى بنجاح • النتيجة النهائية
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">{levelTitle}</h2>
          </div>

          {/* Animated Stars Showcase */}
          <div className="flex justify-center items-center gap-3 py-2">
            {[1, 2, 3].map((star) => {
              const active = star <= finalStars;
              return (
                <div
                  key={star}
                  className={`p-2 rounded-2xl transition-all duration-500 transform ${
                    active
                      ? 'scale-110 bg-amber-500/10 border border-amber-500/30'
                      : 'scale-90 bg-slate-950/60 border border-slate-800'
                  }`}
                >
                  <Star
                    className={`w-12 h-12 transition-all ${
                      active
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.8)]'
                        : 'text-slate-700'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Score & Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-slate-400 block text-xs mb-1">دقة الإجابات في الاختبار</span>
              <span className="font-black text-emerald-400 text-xl font-mono">
                {correctAnswersCount} / {questions.length}
              </span>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-slate-400 block text-xs mb-1">التقييم المستحق</span>
              <span className="font-black text-amber-400 text-xl font-mono">
                {finalStars} من 3 نجوم
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                sound.playClick();
                onReplay();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-sm transition border border-slate-700 shadow-md active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة التجربة</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                onReturnHub();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm transition shadow-xl shadow-emerald-950/40 active:scale-95"
            >
              <Home className="w-4 h-4 fill-slate-950" />
              <span>العودة للجزيرة</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900/95 border border-slate-700/80 w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)] space-y-4">
        {/* Progress Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
              اختبار الفهم الفيزيائي
            </span>
            <h3 className="font-black text-slate-100 text-base sm:text-lg">{levelTitle}</h3>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-800 text-cyan-300 px-3 py-1 rounded-full border border-slate-700 shadow">
            السؤال {currentIndex + 1} من {questions.length}
          </span>
        </div>

        {/* Question Text */}
        <p className="text-base sm:text-lg font-black text-slate-100 leading-relaxed pt-1">
          {currentQ.question}
        </p>

        {/* Options */}
        <div className="space-y-2.5 pt-1">
          {currentQ.options.map((opt, idx) => {
            let btnStyle = 'bg-slate-950/80 border-slate-800 hover:border-slate-600 text-slate-200';
            if (isAnswered) {
              if (idx === currentQ.correctIndex) {
                btnStyle = 'bg-emerald-950/90 border-emerald-500 text-emerald-100 font-bold shadow-lg shadow-emerald-950/40';
              } else if (idx === selectedOption) {
                btnStyle = 'bg-rose-950/90 border-rose-500 text-rose-200';
              } else {
                btnStyle = 'bg-slate-950/40 border-slate-850 text-slate-500 opacity-50';
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-right p-3.5 rounded-2xl border text-sm sm:text-base transition-all flex items-center justify-between gap-3 ${btnStyle}`}
              >
                <span>{opt}</span>
                {isAnswered && idx === currentQ.correctIndex && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                {isAnswered && idx === selectedOption && idx !== currentQ.correctIndex && (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Scientific Explanation */}
        {isAnswered && (
          <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-1.5 text-xs sm:text-sm">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>التفسير العلمي الدقيق:</span>
            </span>
            <p className="text-slate-300 leading-relaxed">{currentQ.explanation}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          {isAnswered && (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 py-2.5 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm transition shadow-lg shadow-cyan-900/40 active:scale-95"
            >
              <span>{currentIndex + 1 === questions.length ? 'عرض النتيجة والنجوم' : 'السؤال التالي'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
