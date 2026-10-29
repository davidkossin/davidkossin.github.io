/**
 * Qubit on the Bloch sphere.
 * |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩
 * Born rule: P(0) = cos²(θ/2), P(1) = sin²(θ/2)
 */

export function stateFromAngles(theta, phi) {
  const th = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const ph = ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return {
    theta: th,
    phi: ph,
    alpha: { re: Math.cos(th / 2), im: 0 },
    beta: {
      re: Math.sin(th / 2) * Math.cos(ph),
      im: Math.sin(th / 2) * Math.sin(ph),
    },
  };
}

export function bornProb0(theta) {
  return Math.cos(theta / 2) ** 2;
}

export function bornProb1(theta) {
  return Math.sin(theta / 2) ** 2;
}

/** Measure in computational basis; returns 0 or 1 and collapsed state. */
export function measureZ(state, rng = Math.random) {
  const p0 = bornProb0(state.theta);
  const bit = rng() < p0 ? 0 : 1;
  const collapsed = bit === 0
    ? stateFromAngles(0, 0)
    : stateFromAngles(Math.PI, 0);
  return { bit, state: collapsed, p0, p1: 1 - p0 };
}

/** Apply Pauli-X (bit flip): θ → π−θ, φ → φ+π */
export function gateX(state) {
  return stateFromAngles(Math.PI - state.theta, state.phi + Math.PI);
}

/** Apply Pauli-Z: φ → φ+π */
export function gateZ(state) {
  return stateFromAngles(state.theta, state.phi + Math.PI);
}

/** Hadamard: |0⟩→(|0⟩+|1⟩)/√2, |1⟩→(|0⟩−|1⟩)/√2 — exact on Bloch via matrix. */
export function gateH(state) {
  // Represent as complex amplitudes, apply H = (1/√2)[[1,1],[1,-1]]
  const a = state.alpha;
  const b = state.beta;
  const s = Math.SQRT1_2;
  const a2 = { re: s * (a.re + b.re), im: s * (a.im + b.im) };
  const b2 = { re: s * (a.re - b.re), im: s * (a.im - b.im) };
  return amplitudesToState(a2, b2);
}

function amplitudesToState(alpha, beta) {
  const norm = Math.hypot(alpha.re, alpha.im, beta.re, beta.im);
  const ar = alpha.re / norm;
  const ai = alpha.im / norm;
  const br = beta.re / norm;
  const bi = beta.im / norm;
  // Global phase: make alpha real and non-negative
  const phase = Math.atan2(ai, ar);
  const c = Math.cos(-phase);
  const s = Math.sin(-phase);
  const aRe = ar * c - ai * s;
  const bRe = br * c - bi * s;
  const bIm = br * s + bi * c;
  const theta = 2 * Math.acos(Math.min(1, Math.max(0, Math.abs(aRe))));
  const phi = Math.atan2(bIm, bRe);
  return stateFromAngles(theta, phi);
}

/** Bloch vector (x,y,z) for visualization. */
export function blochVector(state) {
  const { theta, phi } = state;
  return {
    x: Math.sin(theta) * Math.cos(phi),
    y: Math.sin(theta) * Math.sin(phi),
    z: Math.cos(theta),
  };
}
