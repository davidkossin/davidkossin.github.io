/**
 * Numerical unit tests for Quantum Realm physics kernels.
 * Run: node --test quantum-realm/tests/physics.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  intensity,
  intensityWhichPath,
  buildSampler,
  sampleHit,
  sinc,
} from "../js/physics/doubleslit.js";
import { bornProb0, bornProb1, measureZ, stateFromAngles, gateH } from "../js/physics/born.js";
import { transmissionCoefficient } from "../js/physics/tunneling.js";
import {
  uncertaintyProduct,
  deltaX,
  deltaP,
  positionProbDensity,
} from "../js/physics/uncertainty.js";
import {
  energyEv,
  radialNormCheck,
  radialR,
  balmerWavelengthNm,
  emissionEnergyEv,
  absorptionEnergyEv,
} from "../js/physics/hydrogen.js";
import {
  quantumCorrelation,
  quantumChsh,
  measureSinglet,
  tsirelsonBound,
} from "../js/physics/bell.js";
import { energyRatio, normCheck, wavefunction } from "../js/physics/particlebox.js";
import { RYDBERG_EV } from "../js/physics/constants.js";

describe("double-slit", () => {
  const params = { d: 2, a: 0.4, wavelength: 0.7, L: 10 };
  it("peak near center", () => {
    assert.ok(intensity(0, params) > intensity(0.5, params));
  });
  it("sinc(0)=1", () => assert.equal(sinc(0), 1));
  it("which-path removes fringes (no deep nulls of cos²)", () => {
    // At a theoretical interference null, which-path intensity stays finite from envelope
    // Find approx first null of cos²(π d x / λL): π d x /λL = π/2 → x = λL/(2d)
    const xNull = (params.wavelength * params.L) / (2 * params.d);
    assert.ok(intensity(xNull, params) < 1e-6);
    assert.ok(intensityWhichPath(xNull, params) > 0.01);
  });
  it("samples roughly follow intensity (KS-ish mean)", () => {
    const sampler = buildSampler(params, { xmax: 4, bins: 1024 });
    let sum = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) sum += sampleHit(sampler, () => (i + 0.5) / N);
    // Deterministic quantile midpoints → mean near 0 by symmetry
    assert.ok(Math.abs(sum / N) < 0.15);
  });
});

describe("Born rule / Bloch", () => {
  it("θ=0 → P(0)=1", () => {
    assert.ok(Math.abs(bornProb0(0) - 1) < 1e-12);
    assert.ok(Math.abs(bornProb1(0)) < 1e-12);
  });
  it("θ=π → P(1)=1", () => {
    assert.ok(Math.abs(bornProb1(Math.PI) - 1) < 1e-12);
  });
  it("θ=π/2 → 50/50", () => {
    assert.ok(Math.abs(bornProb0(Math.PI / 2) - 0.5) < 1e-12);
  });
  it("H|0⟩ is equal superposition", () => {
    const s = gateH(stateFromAngles(0, 0));
    assert.ok(Math.abs(bornProb0(s.theta) - 0.5) < 1e-9);
  });
  it("empirical frequencies match Born (θ=2π/3)", () => {
    const theta = (2 * Math.PI) / 3;
    const p0 = bornProb0(theta);
    const prep = stateFromAngles(theta, 0.2);
    let c0 = 0;
    const N = 20000;
    let rngI = 0;
    const rng = () => {
      // simple LCG for reproducibility
      rngI = (rngI * 1664525 + 1013904223) >>> 0;
      return rngI / 0x100000000;
    };
    for (let i = 0; i < N; i++) {
      if (measureZ(prep, rng).bit === 0) c0++;
    }
    assert.ok(Math.abs(c0 / N - p0) < 0.02);
  });
});

describe("tunneling transmission", () => {
  it("T→1 for V0=0", () => {
    assert.ok(Math.abs(transmissionCoefficient(2, 0, 1) - 1) < 1e-12);
  });
  it("T decreases as barrier widens (E<V0)", () => {
    const t1 = transmissionCoefficient(2, 5, 0.5);
    const t2 = transmissionCoefficient(2, 5, 2.0);
    assert.ok(t1 > t2);
    assert.ok(t2 > 0 && t2 < 1);
  });
  it("known numerical check E=2,V=5,L=1", () => {
    const T = transmissionCoefficient(2, 5, 1);
    // κ=√(2*3)=√6≈2.449, sinh(κL)≈5.737
    // T=[1+(25*32.92)/(4*2*3)]^{-1}=[1+823/24]^{-1}≈0.0283
    assert.ok(T > 0.02 && T < 0.04, `T=${T}`);
  });
});

describe("uncertainty", () => {
  it("product is exactly 1/2", () => {
    for (const s of [0.3, 1, 2.5]) {
      assert.ok(Math.abs(uncertaintyProduct(s) - 0.5) < 1e-12);
      assert.equal(deltaX(s), s);
      assert.ok(Math.abs(deltaP(s) - 1 / (2 * s)) < 1e-12);
    }
  });
  it("position density integrates ~1", () => {
    const sx = 1;
    let acc = 0;
    const xmax = 8;
    const N = 4000;
    const dx = (2 * xmax) / N;
    for (let i = 0; i < N; i++) {
      const x = -xmax + (i + 0.5) * dx;
      acc += positionProbDensity(x, sx) * dx;
    }
    assert.ok(Math.abs(acc - 1) < 0.02, `acc=${acc}`);
  });
});

describe("hydrogen", () => {
  it("E_1 = −Rydberg", () => {
    assert.ok(Math.abs(energyEv(1) + RYDBERG_EV) < 1e-9);
  });
  it("E_n ∝ 1/n²", () => {
    assert.ok(Math.abs(energyEv(2) - energyEv(1) / 4) < 1e-9);
  });
  it("radial R_10 and R_21 normalize", () => {
    assert.ok(Math.abs(radialNormCheck(1, 0) - 1) < 0.02);
    assert.ok(Math.abs(radialNormCheck(2, 1) - 1) < 0.03);
  });
  it("Balmer H-α ≈ 656.3 nm", () => {
    const nm = balmerWavelengthNm(3);
    assert.ok(Math.abs(nm - 656.3) < 1.5, `nm=${nm}`);
  });
  it("absorption 1→2 ≈ 10.2 eV", () => {
    const e = absorptionEnergyEv(1, 2);
    assert.ok(Math.abs(e - 10.2) < 0.05, `e=${e}`);
  });
  it("R_10(0) finite peak", () => {
    assert.ok(radialR(1, 0, 0) > 0);
  });
});

describe("Bell / CHSH", () => {
  it("E(a,a)=−1", () => {
    assert.ok(Math.abs(quantumCorrelation(0.3, 0.3) + 1) < 1e-12);
  });
  it("Tsirelson angles give |S|=2√2", () => {
    // Optimal for singlet E=−cos: a=0, a′=π/2, b=π/4, b′=−π/4
    const S = Math.abs(quantumChsh(0, Math.PI / 2, Math.PI / 4, -Math.PI / 4));
    assert.ok(Math.abs(S - tsirelsonBound()) < 1e-9, `S=${S}`);
  });
  it("measureSinglet averages to −cosδ", () => {
    const a = 0.2;
    const b = 1.1;
    const target = quantumCorrelation(a, b);
    let sum = 0;
    const N = 30000;
    let rngI = 1;
    const rng = () => {
      rngI = (rngI * 1664525 + 1013904223) >>> 0;
      return rngI / 0x100000000;
    };
    for (let i = 0; i < N; i++) sum += measureSinglet(a, b, rng).product;
    assert.ok(Math.abs(sum / N - target) < 0.03);
  });
});

describe("particle in a box", () => {
  it("energies n²", () => {
    assert.equal(energyRatio(1), 1);
    assert.equal(energyRatio(3), 9);
  });
  it("ψ normalized", () => {
    assert.ok(Math.abs(normCheck(1) - 1) < 0.01);
    assert.ok(Math.abs(normCheck(4) - 1) < 0.01);
  });
  it("ψ(0)=ψ(L)=0", () => {
    assert.equal(wavefunction(2, 0, 1), 0);
    assert.equal(wavefunction(2, 1, 1), 0);
  });
});
