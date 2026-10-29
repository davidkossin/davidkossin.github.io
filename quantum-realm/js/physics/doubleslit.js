/**
 * Far-field two-slit intensity with single-slit envelope.
 * I(x) ∝ [sinc(β)]² [cos(δ/2)]²
 * δ = 2π d x / (λ L),  β = π a x / (λ L)
 * where d = slit separation, a = slit width, λ = wavelength, L = screen distance.
 * Sampling draws hits from the normalized intensity (Born rule for detection).
 */

export function phaseDelta(x, { d, wavelength, L }) {
  return (2 * Math.PI * d * x) / (wavelength * L);
}

export function betaEnvelope(x, { a, wavelength, L }) {
  return (Math.PI * a * x) / (wavelength * L);
}

/** sinc(u) = sin(u)/u with sinc(0)=1 */
export function sinc(u) {
  if (Math.abs(u) < 1e-12) return 1;
  return Math.sin(u) / u;
}

/**
 * Relative intensity at screen coordinate x (center = 0).
 * Returns value in [0, 1] when normalized against peak ≈ 1 at x=0 for a≪d.
 */
export function intensity(x, params) {
  const delta = phaseDelta(x, params);
  const beta = betaEnvelope(x, params);
  const interference = Math.cos(delta / 2) ** 2;
  const envelope = sinc(beta) ** 2;
  return envelope * interference;
}

/** Build a discrete PDF over [-xmax, xmax] and return cumulative for sampling. */
export function buildSampler(params, { xmax, bins = 2048 } = {}) {
  const xs = new Float64Array(bins);
  const weights = new Float64Array(bins);
  let sum = 0;
  for (let i = 0; i < bins; i++) {
    const x = -xmax + (2 * xmax * (i + 0.5)) / bins;
    xs[i] = x;
    const w = intensity(x, params);
    weights[i] = w;
    sum += w;
  }
  const cdf = new Float64Array(bins);
  let acc = 0;
  for (let i = 0; i < bins; i++) {
    acc += weights[i] / sum;
    cdf[i] = acc;
  }
  cdf[bins - 1] = 1;
  return { xs, cdf, weights, sum };
}

/** Sample one detection position from |ψ|² (via intensity). */
export function sampleHit(sampler, rng = Math.random) {
  const u = rng();
  const { xs, cdf } = sampler;
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return xs[lo];
}

/**
 * Classical which-path: incoherently add two single-slit patterns (no cross term).
 * I_cl(x) ∝ ½ [sinc(β_+)]² + ½ [sinc(β_-)]² ≈ sinc²(β) when slits identical
 * (envelope only — interference term vanishes).
 */
export function intensityWhichPath(x, params) {
  const beta = betaEnvelope(x, params);
  return sinc(beta) ** 2;
}

export function buildWhichPathSampler(params, opts) {
  const p = { ...params };
  const bins = opts?.bins ?? 2048;
  const xmax = opts.xmax;
  const xs = new Float64Array(bins);
  const weights = new Float64Array(bins);
  let sum = 0;
  for (let i = 0; i < bins; i++) {
    const x = -xmax + (2 * xmax * (i + 0.5)) / bins;
    xs[i] = x;
    const w = intensityWhichPath(x, p);
    weights[i] = w;
    sum += w;
  }
  const cdf = new Float64Array(bins);
  let acc = 0;
  for (let i = 0; i < bins; i++) {
    acc += weights[i] / sum;
    cdf[i] = acc;
  }
  cdf[bins - 1] = 1;
  return { xs, cdf, weights, sum };
}
