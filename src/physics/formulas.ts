/**
 * Physics Engine Helpers - Analytical Formulas
 * g = 9.80 m/s^2
 * KE = 1/2 m v^2
 * PE = m g (h - h_ref)
 * W = F d
 * PE_elastic = 1/2 k x^2
 */

export const GRAVITY_G = 9.80; // m/s²

/**
 * Calculates kinetic energy in Joules
 * KE = 0.5 * m * v^2
 */
export function calculateKE(massKg: number, velocityMs: number): number {
  if (massKg <= 0) return 0;
  return 0.5 * massKg * (velocityMs * velocityMs);
}

/**
 * Calculates gravitational potential energy relative to reference level in Joules
 * PE = m * g * (height - refHeight)
 * Note: Can be negative if height is below refHeight!
 */
export function calculatePEgrav(massKg: number, heightM: number, refHeightM: number = 0): number {
  return massKg * GRAVITY_G * (heightM - refHeightM);
}

/**
 * Calculates elastic potential energy in Joules
 * PE_e = 0.5 * k * x^2
 */
export function calculatePEelastic(springConstantK: number, displacementX: number): number {
  if (springConstantK <= 0) return 0;
  return 0.5 * springConstantK * (displacementX * displacementX);
}

/**
 * Calculates work done by a force over displacement
 * W = F * d (in parallel direction)
 */
export function calculateWork(forceN: number, distanceM: number): number {
  return forceN * distanceM;
}

/**
 * Work done by gravity when moving from h1 to h2:
 * W_g = - m * g * (h2 - h1)
 * Gravity does negative work going up (h2 > h1)
 * and positive work coming down (h2 < h1).
 */
export function calculateGravityWork(massKg: number, h1: number, h2: number): number {
  return -massKg * GRAVITY_G * (h2 - h1);
}

/**
 * Speed from free fall starting from rest from height h to h_target:
 * v = sqrt(2 * g * (h - h_target))
 */
export function velocityFromFreeFall(hStart: number, hCurrent: number): number {
  const deltaH = Math.max(0, hStart - hCurrent);
  return Math.sqrt(2 * GRAVITY_G * deltaH);
}

/**
 * Height reached given initial vertical velocity v0:
 * h_peak = v0^2 / (2 * g)
 */
export function heightFromVelocity(v0: number): number {
  return (v0 * v0) / (2 * GRAVITY_G);
}

/**
 * Standard basketball coefficient of restitution:
 * e = v_after / v_before
 * h_bounce = e^2 * h_drop
 * We use realistic e = 0.75 (0.75^2 = 0.5625)
 */
export const BASKETBALL_RESTITUTION = 0.75;

export function calculateBounceHeight(dropHeight: number, restitution: number = BASKETBALL_RESTITUTION): number {
  return dropHeight * (restitution * restitution);
}

/**
 * Calculate simple linear regression y = slope * x passing through origin (0,0)
 * slope = sum(x * y) / sum(x^2)
 */
export function calculateBestFitSlope(points: Array<{ x: number; y: number }>): number {
  if (points.length === 0) return 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (const pt of points) {
    sumXY += pt.x * pt.y;
    sumX2 += pt.x * pt.x;
  }
  if (sumX2 === 0) return 0;
  return sumXY / sumX2;
}

/**
 * Format numbers with Arabic SI units
 */
export function formatJoules(val: number): string {
  if (Math.abs(val) >= 10000) {
    return `${(val / 1000).toFixed(2)} ك.جول`; // kJ
  }
  return `${val.toFixed(1)} جول`;
}

export function formatMeters(val: number): string {
  return `${val.toFixed(2)} م`;
}

export function formatVelocity(val: number): string {
  return `${val.toFixed(2)} م/ث`;
}

export function formatMass(val: number): string {
  return `${val.toFixed(2)} كغ`;
}

export function formatForce(val: number): string {
  return `${val.toFixed(1)} نيوتن`;
}
