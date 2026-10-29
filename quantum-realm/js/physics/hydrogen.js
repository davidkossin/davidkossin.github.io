/**
 * Hydrogen atom wavefunctions (atomic units a0=1).
 * Energy: E_n = −Rydberg / n²  with Rydberg ≈ 13.6057 eV
 * ψ_nlm = R_nl(r) Y_lm(θ,φ); orbital clouds sample |ψ|².
 */

import { RYDBERG_EV } from "./constants.js";

export function energyEv(n) {
  return -RYDBERG_EV / (n * n);
}

function factorial(k) {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

export function assocLaguerre(k, alpha, x) {
  let sum = 0;
  for (let j = 0; j <= k; j++) {
    const coeff =
      ((j % 2 === 0 ? 1 : -1) / factorial(j)) * binomial(k + alpha, k - j);
    sum += coeff * x ** j;
  }
  return sum;
}

/** Normalized radial function R_nl(r), a0 = 1. ∫ r² R² dr = 1 */
export function radialR(n, l, r) {
  if (n < 1 || l < 0 || l >= n || r < 0) return 0;
  const rho = (2 * r) / n;
  const norm = Math.sqrt(
    ((2 / n) ** 3 * factorial(n - l - 1)) / (2 * n * factorial(n + l))
  );
  return norm * Math.exp(-rho / 2) * rho ** l * assocLaguerre(n - l - 1, 2 * l + 1, rho);
}

function assocLegendre(l, m, x) {
  if (m < 0 || m > l) return 0;
  let pmm = 1;
  if (m > 0) {
    const somx2 = Math.sqrt(Math.max(0, 1 - x * x));
    let fact = 1;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2;
    }
  }
  if (l === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pll;
}

export function sphericalHarmonicDensity(l, m, theta) {
  const absM = Math.abs(m);
  const Plm = assocLegendre(l, absM, Math.cos(theta));
  const norm = Math.sqrt(
    ((2 * l + 1) / (4 * Math.PI)) * (factorial(l - absM) / factorial(l + absM))
  );
  const y = norm * Plm;
  return y * y;
}

export function orbitalDensity(n, l, m, r, theta) {
  const R = radialR(n, l, r);
  return R * R * sphericalHarmonicDensity(l, m, theta);
}

export function sampleOrbital(n, l, m, count, rng = Math.random) {
  const rMax = 2.5 * n * n;
  let peak = 0;
  for (let i = 0; i < 40; i++) {
    const r = (rMax * (i + 0.5)) / 40;
    for (let j = 0; j < 20; j++) {
      const theta = (Math.PI * (j + 0.5)) / 20;
      peak = Math.max(peak, orbitalDensity(n, l, m, r, theta));
    }
  }
  peak = Math.max(peak * 1.25, 1e-12);
  const pts = [];
  let guard = 0;
  while (pts.length < count && guard < count * 400) {
    guard++;
    const r = rMax * Math.cbrt(rng());
    const cosTh = 2 * rng() - 1;
    const theta = Math.acos(cosTh);
    const phi = 2 * Math.PI * rng();
    if (rng() < orbitalDensity(n, l, m, r, theta) / peak) {
      const sinTh = Math.sin(theta);
      pts.push({
        x: r * sinTh * Math.cos(phi),
        y: r * sinTh * Math.sin(phi),
        z: r * cosTh,
      });
    }
  }
  return pts;
}

/** Photon energy for emission n_from → n_to (n_from > n_to): E = E_from − E_to > 0? 
 *  E_n = −13.6/n² so E_high (less negative) − E_low = positive energy released. */
export function emissionEnergyEv(nFrom, nTo) {
  return energyEv(nFrom) - energyEv(nTo);
}

export function absorptionEnergyEv(nFrom, nTo) {
  return energyEv(nTo) - energyEv(nFrom);
}

/** Balmer (to n=2) wavelength in nm */
export function balmerWavelengthNm(nUpper) {
  if (nUpper <= 2) return null;
  const RH = 1.096776e7;
  const inv = RH * (0.25 - 1 / (nUpper * nUpper));
  return 1e9 / inv;
}

export function wavelengthToRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm >= 645 && nm <= 700) { r = 1; }
  let factor = 1;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / 40;
  if (nm > 645 && nm <= 700) factor = 0.3 + 0.7 * (700 - nm) / 55;
  if (nm < 380 || nm > 700) factor = 0;
  return {
    r: Math.pow(Math.max(0, r * factor), 0.8),
    g: Math.pow(Math.max(0, g * factor), 0.8),
    b: Math.pow(Math.max(0, b * factor), 0.8),
  };
}

/** Numerical check: ∫_0^∞ r² R_nl² dr ≈ 1 */
export function radialNormCheck(n, l, rMax = 80, steps = 4000) {
  const dr = rMax / steps;
  let acc = 0;
  for (let i = 0; i < steps; i++) {
    const r = (i + 0.5) * dr;
    const R = radialR(n, l, r);
    acc += r * r * R * R * dr;
  }
  return acc;
}
