/**
 * Storage and Levels Configuration
 */
import { LevelInfo } from '../types';

export const INITIAL_LEVELS: LevelInfo[] = [
  {
    id: 1,
    slug: 'bounce-lab',
    title: 'مختبر الارتداد',
    englishTitle: 'Bounce Lab',
    description: 'أسقط كرة السلة من 3 ارتفاعات مختلفة، سجّل ارتفاع الارتداد، ارسم خط أفضل مطابقة، وتوقع ارتداد السقوط من 10 أمتار!',
    objective: 'اكتشاف سبب عدم عودة الكرة لنفس الارتفاع وفهم ضياع الطاقة الحركية إلى حرارة وصوت.',
    formula: 'h₂ = e² · h₁ | KE → PE_elastic → KE + E_loss',
    portalColor: '#f97316', // Orange
    accentColor: 'from-orange-500 to-amber-600',
    iconName: 'Flame',
    completed: false,
    stars: 0,
  },
  {
    id: 2,
    slug: 'kinetic-arena',
    title: 'حلبة الطاقة الحركية',
    englishTitle: 'Kinetic Arena',
    description: 'تحكم في الكتلة والسرعة واكتشف كيف تتضاعف الطاقة الحركية خطياً مع الكتلة وتربيعياً مع السرعة!',
    objective: 'إيقاف متزلج بكتلة 52 كغ يتحرك بسرعة 2.5 م/ث، وحساب الشغل اللازم لتسريع سيارة من 22 إلى 44 م/ث.',
    formula: 'KE = ½ m v² | W = ΔKE',
    portalColor: '#06b6d4', // Cyan
    accentColor: 'from-cyan-500 to-blue-600',
    iconName: 'Zap',
    completed: false,
    stars: 0,
  },
  {
    id: 3,
    slug: 'gravity-gym',
    title: 'نادي الجاذبية',
    englishTitle: 'Gravity Gym',
    description: 'ارفع كرة البولينج (7.30 كغ) من الرف إلى مستوى الكتف، وبدّل مستوى الإسناد ولاحظ القيم الموجبة والسالبة!',
    objective: 'فهم كيف يغير مستوى الإسناد (h = 0) طاقة الوضع، وأن شغل الجاذبية يعتمد فقط على فرق الارتفاع.',
    formula: 'PE = m g (h - h_ref) | W_g = -ΔPE',
    portalColor: '#10b981', // Emerald
    accentColor: 'from-emerald-500 to-teal-600',
    iconName: 'Dumbbell',
    completed: false,
    stars: 0,
  },
  {
    id: 4,
    slug: 'elastic-field',
    title: 'ميدان المرونة',
    englishTitle: 'Elastic Field',
    description: 'اسحب القوس أو اثنِ عمود القفز بالزانة؛ شاهد تحول طاقة الوضع المرونية إلى طاقة حركية ثم طاقة وضع تثاقلية.',
    objective: 'ملاحظة مخطط الأعمدة الثلاثي للتحولات: المرونية ← الحركية ← التثاقلية.',
    formula: 'PE_e = ½ k x² → KE → PE_g',
    portalColor: '#8b5cf6', // Violet
    accentColor: 'from-violet-500 to-purple-600',
    iconName: 'Crosshair',
    completed: false,
    stars: 0,
  },
  {
    id: 5,
    slug: 'grand-coaster',
    title: 'الأفعوانية الكبرى',
    englishTitle: 'Grand Coaster',
    description: 'عدّل مسار قطار الملاهي، ومع إيقاف الاحتكاك راقب ثبات الطاقة الميكانيكية الكلية عبر كل المنحدرات والحلقات!',
    objective: 'إثبات قانون حفظ الطاقة الميكانيكية وتأثير تغيير مستوى الإسناد على الأعمدة البيانية.',
    formula: 'E_total = KE + PE_g = ثابت',
    portalColor: '#ec4899', // Pink
    accentColor: 'from-pink-500 to-rose-600',
    iconName: 'Activity',
    completed: false,
    stars: 0,
  },
];

const STORAGE_KEY = 'energy_quest_progress_v1';

export function loadLevelsProgress(): LevelInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_LEVELS;
    const saved: Record<number, { completed: boolean; stars: number; bestScore?: number }> = JSON.parse(raw);
    return INITIAL_LEVELS.map(lvl => ({
      ...lvl,
      completed: saved[lvl.id]?.completed ?? lvl.completed,
      stars: saved[lvl.id]?.stars ?? lvl.stars,
      bestScore: saved[lvl.id]?.bestScore ?? lvl.bestScore,
    }));
  } catch {
    return INITIAL_LEVELS;
  }
}

export function saveLevelProgress(levelId: number, stars: number, score?: number) {
  try {
    const current = loadLevelsProgress();
    const map: Record<number, { completed: boolean; stars: number; bestScore?: number }> = {};
    for (const lvl of current) {
      if (lvl.id === levelId) {
        map[lvl.id] = {
          completed: true,
          stars: Math.max(lvl.stars, stars),
          bestScore: Math.max(lvl.bestScore || 0, score || 0),
        };
      } else {
        map[lvl.id] = {
          completed: lvl.completed,
          stars: lvl.stars,
          bestScore: lvl.bestScore,
        };
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save progress', err);
  }
}
