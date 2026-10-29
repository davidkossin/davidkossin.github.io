/**
 * Spin singlet entanglement and Bell/CHSH correlations.
 * Quantum prediction for singlet: E(a, b) = −cos(a − b)
 * where a, b are detector angles (radians) for spin measurements along those axes.
 * CHSH: S = E(a,b) + E(a,b′) + E(a′,b) − E(a′,b′)
 * Quantum maximum (Tsirelson): 2√2 ≈ 2.828; local hidden variables: |S| ≤ 2.
 */

import { TWO_SQRT2 } from "./constants.js";

export function quantumCorrelation(angleA, angleB) {
  return -Math.cos(angleA - angleB);
}

/** Optimal CHSH angles: a=0, a′=π/4, b=π/8, b′=3π/8 → S = 2√2 */
export function chshValue(Eab, Eabp, Eapb, Eapbp) {
  return Eab + Eapb + Eabp - Eapbp;
}

export function quantumChsh(a, ap, b, bp) {
  return chshValue(
    quantumCorrelation(a, b),
    quantumCorrelation(a, bp),
    quantumCorrelation(ap, b),
    quantumCorrelation(ap, bp)
  );
}

export function tsirelsonBound() {
  return TWO_SQRT2;
}

/**
 * Local hidden-variable toy model: shared random λ ∈ [0, 2π),
 * outcome A = sign(cos(θ_a − λ)), B = −sign(cos(θ_b − λ)) (anti-correlated attempt).
 * Averaged correlation is the classical piecewise-linear bound, |E| ≤ 1 − 2|δ|/π …
 */
export function classicalCorrelation(angleA, angleB, samples = 20000, rng = Math.random) {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const lambda = rng() * 2 * Math.PI;
    const A = Math.cos(angleA - lambda) >= 0 ? 1 : -1;
    const B = Math.cos(angleB - lambda) >= 0 ? -1 : 1; // singlet-like anti-correlation at 0
    sum += A * B;
  }
  return sum / samples;
}

/**
 * Measure one entangled singlet pair at angles a, b.
 * Exact quantum sampling: P(same) = cos²((a−b)/2) for spin… 
 * For singlet spin: P(++)=P(--)= sin²(δ/2)/2? Standard:
 * P(A=α, B=β) with α,β=±1: (1/4)(1 − α β cos(a−b))
 * So P(agree)= (1 − cos δ)/2 = sin²(δ/2), P(disagree)=(1+cos δ)/2
 * Correlation E = P_agree*(+1 for ++ and -- contrib)... E = ⟨AB⟩ = −cos(a−b)
 */
export function measureSinglet(angleA, angleB, rng = Math.random) {
  const delta = angleA - angleB;
  // Sample A uniformly ±1, then B from conditional
  const A = rng() < 0.5 ? 1 : -1;
  // P(B=A | A) = (1 − cos δ)/2  → AB = +1
  // P(B=−A|A) = (1 + cos δ)/2 → AB = −1
  // ⟨AB⟩ = P(B=A)(+1) + P(B=−A)(−1) = (1−cosδ)/2 − (1+cosδ)/2 = −cosδ ✓
  const pSame = (1 - Math.cos(delta)) / 2;
  const B = rng() < pSame ? A : -A;
  return { A, B, product: A * B };
}

export { TWO_SQRT2 };
