/**
 * Rectangular potential barrier transmission (exact, stationary scattering).
 * For E < V0 (tunneling):
 *   κ = √(2m(V0−E))/ℏ
 *   T = [1 + (V0² sinh²(κ L))/(4 E (V0−E))]^{-1}
 * For E > V0 (over-barrier):
 *   k2 = √(2m(E−V0))/ℏ
 *   T = [1 + (V0² sin²(k2 L))/(4 E (E−V0))]^{-1}
 * Units: we work in a convenient system where ℏ = 1, m = 1 so
 *   κ = √(2(V0−E)), energies in the same units as V0, L in those length units.
 */

export function transmissionCoefficient(E, V0, L, { hbar = 1, mass = 1 } = {}) {
  if (E <= 0 || L < 0) return 0;
  if (V0 === 0 || L === 0) return 1;
  const eps = 1e-12;
  if (Math.abs(E - V0) < eps) {
    // Limit E → V0: T = [1 + (m V0 L²)/(2 ℏ²)]^{-1}
    const arg = (mass * V0 * L * L) / (2 * hbar * hbar);
    return 1 / (1 + arg);
  }
  if (E < V0) {
    const kappa = Math.sqrt(2 * mass * (V0 - E)) / hbar;
    const sinhKL = Math.sinh(kappa * L);
    const denom = 1 + ((V0 * V0 * sinhKL * sinhKL) / (4 * E * (V0 - E)));
    return 1 / denom;
  }
  // E > V0
  const k2 = Math.sqrt(2 * mass * (E - V0)) / hbar;
  const sink = Math.sin(k2 * L);
  const denom = 1 + ((V0 * V0 * sink * sink) / (4 * E * (E - V0)));
  return 1 / denom;
}

/**
 * Split-step Fourier TDSE on a 1D grid (visualization).
 * i ℏ ∂ψ/∂t = −(ℏ²/2m) ∂²ψ/∂x² + V(x) ψ
 * With ℏ=m=1: half kick → free drift in k-space → half kick.
 */
export function makeBarrierPotential(N, xMin, xMax, V0, width, center = 0) {
  const dx = (xMax - xMin) / N;
  const V = new Float64Array(N);
  const half = width / 2;
  for (let i = 0; i < N; i++) {
    const x = xMin + (i + 0.5) * dx;
    V[i] = Math.abs(x - center) <= half ? V0 : 0;
  }
  return { V, dx, xMin, xMax };
}

export function gaussianPacket(N, xMin, dx, x0, k0, sigma) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let norm = 0;
  for (let i = 0; i < N; i++) {
    const x = xMin + (i + 0.5) * dx;
    const g = Math.exp(-((x - x0) ** 2) / (4 * sigma * sigma));
    re[i] = g * Math.cos(k0 * (x - x0));
    im[i] = g * Math.sin(k0 * (x - x0));
    norm += re[i] * re[i] + im[i] * im[i];
  }
  norm = Math.sqrt(norm * dx);
  for (let i = 0; i < N; i++) {
    re[i] /= norm;
    im[i] /= norm;
  }
  return { re, im };
}

/** Probability density |ψ|² and transmission estimate (integral x > barrierRight). */
export function probabilityDensity(re, im) {
  const N = re.length;
  const p = new Float64Array(N);
  for (let i = 0; i < N; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}

export function transmittedFraction(re, im, dx, xMin, barrierRight) {
  let t = 0;
  let tot = 0;
  for (let i = 0; i < re.length; i++) {
    const x = xMin + (i + 0.5) * dx;
    const p = re[i] * re[i] + im[i] * im[i];
    tot += p;
    if (x > barrierRight) t += p;
  }
  return tot > 0 ? t / tot : 0;
}

/** One split-step step; mutates re/im. Uses naive DFT O(N²) for small N (demo). */
export function splitStepStep(re, im, V, dx, dt) {
  const N = re.length;
  // Half potential kick
  halfKick(re, im, V, dt / 2);
  // Kinetic via DFT
  kineticDrift(re, im, dx, dt);
  halfKick(re, im, V, dt / 2);
}

function halfKick(re, im, V, dth) {
  for (let i = 0; i < re.length; i++) {
    const phase = -V[i] * dth; // ℏ=1
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const r = re[i];
    const m = im[i];
    re[i] = r * c - m * s;
    im[i] = r * s + m * c;
  }
}

function kineticDrift(re, im, dx, dt) {
  const N = re.length;
  // DFT
  const Re = new Float64Array(N);
  const Im = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    let sr = 0;
    let si = 0;
    for (let n = 0; n < N; n++) {
      const ang = (-2 * Math.PI * k * n) / N;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      sr += re[n] * c - im[n] * s;
      si += re[n] * s + im[n] * c;
    }
    Re[k] = sr;
    Im[k] = si;
  }
  // Multiply by exp(-i (ħ k²/2m) dt) with k = 2π ξ / (N dx), ħ=m=1
  for (let k = 0; k < N; k++) {
    const xi = k <= N / 2 ? k : k - N;
    const kappa = (2 * Math.PI * xi) / (N * dx);
    const phase = -0.5 * kappa * kappa * dt;
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const r = Re[k];
    const m = Im[k];
    Re[k] = r * c - m * s;
    Im[k] = r * s + m * c;
  }
  // Inverse DFT
  for (let n = 0; n < N; n++) {
    let sr = 0;
    let si = 0;
    for (let k = 0; k < N; k++) {
      const ang = (2 * Math.PI * k * n) / N;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      sr += Re[k] * c - Im[k] * s;
      si += Re[k] * s + Im[k] * c;
    }
    re[n] = sr / N;
    im[n] = si / N;
  }
}
