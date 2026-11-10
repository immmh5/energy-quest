/**
 * Energy Quest (مغامرة الطاقة)
 * Type Definitions
 */

export interface LevelInfo {
  id: number;
  slug: string;
  title: string;
  englishTitle: string;
  description: string;
  objective: string;
  formula: string;
  portalColor: string;
  accentColor: string;
  iconName: string;
  completed: boolean;
  stars: number; // 0 to 3
  bestScore?: number;
}

export interface EnergyState {
  ke: number;          // Kinetic Energy (J)
  peGrav: number;      // Gravitational Potential Energy (J)
  peElastic: number;   // Elastic Potential Energy (J)
  workDone: number;    // Work done (J)
  totalEnergy: number; // Mechanical Total Energy (J)
  refHeight: number;   // Current reference level height (m)
  mass: number;        // Object mass (kg)
  velocity: number;    // Speed (m/s)
  height: number;      // Current height above absolute ground (m)
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TrialData {
  id: number;
  initialHeight: number; // m
  bounceHeight: number;  // m
  restitutionSq: number; // ratio h_bounce / h_drop
  energyLostPct: number; // %
}

export type ReferenceLevelMode = 'ground' | 'rack' | 'custom';
