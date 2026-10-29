/**
 * Infinite square well (particle in a 1D box) on [0, L].
 * ψ_n(x) = √(2/L) sin(n π x / L),  n = 1, 2, 3, …
 * E_n = n² π² ℏ² / (2 m L²)  — we report E_n / E_1 = n²
 */

export function wavefunction(n, x, L) {
  if (x <= 0 || x >= L) return 0;
  return Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);
}

export function probabilityDensity(n, x, L) {
  const psi = wavefunction(n, x, L);
  return psi * psi;
}

/** Energy in units of E_1 = π² ℏ² / (2 m L²) */
export function energyRatio(n) {
  return n * n;
}

export function energyAbsolute(n, { hbar = 1, mass = 1, L = 1 } = {}) {
  return (n * n * Math.PI * Math.PI * hbar * hbar) / (2 * mass * L * L);
}

/** Check normalization ∫_0^L |ψ|² dx ≈ 1 */
export function normCheck(n, L = 1, steps = 2000) {
  const dx = L / steps;
  let acc = 0;
  for (let i = 0; i < steps; i++) {
    const x = (i + 0.5) * dx;
    acc += probabilityDensity(n, x, L) * dx;
  }
  return acc;
}
