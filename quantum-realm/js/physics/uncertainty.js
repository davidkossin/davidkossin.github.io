/**
 * Minimum-uncertainty Gaussian wave packet.
 * ψ(x) = (2π σ_x²)^{-1/4} exp(−x²/(4 σ_x²))   [ℏ = 1 form often uses 2σ² in denom]
 * With this convention: Δx = σ_x,  Δp = 1/(2 σ_x),  Δx Δp = 1/2  (= ℏ/2 when ℏ=1).
 * Momentum-space wavefunction is also Gaussian with σ_p = 1/(2 σ_x).
 */

export function positionGaussian(x, sigmaX) {
  const norm = Math.pow(2 * Math.PI * sigmaX * sigmaX, -0.25);
  return norm * Math.exp(-(x * x) / (4 * sigmaX * sigmaX));
}

export function momentumGaussian(p, sigmaX) {
  const sigmaP = 1 / (2 * sigmaX);
  const norm = Math.pow(2 * Math.PI * sigmaP * sigmaP, -0.25);
  return norm * Math.exp(-(p * p) / (4 * sigmaP * sigmaP));
}

export function deltaX(sigmaX) {
  return sigmaX;
}

export function deltaP(sigmaX) {
  return 1 / (2 * sigmaX);
}

export function uncertaintyProduct(sigmaX) {
  return deltaX(sigmaX) * deltaP(sigmaX); // = 0.5
}

/** |ψ(x)|² */
export function positionProbDensity(x, sigmaX) {
  const a = positionGaussian(x, sigmaX);
  return a * a;
}

/** |φ(p)|² */
export function momentumProbDensity(p, sigmaX) {
  const a = momentumGaussian(p, sigmaX);
  return a * a;
}
