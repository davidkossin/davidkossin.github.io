/**
 * Chapter 1 — Cosmic dawn
 * localProgress 0→1 maps log-style from t≈0 through ~1 Gyr after the Big Bang.
 * State is a pure function of localProgress (+ view.quality for particle counts).
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01, fbm,
  drawGlow, drawVignette, drawGrain, rgba, mixRgb,
} from "../util.js";

/** Map localProgress → approximate years after Big Bang (log span). */
function yearsAt(p) {
  // Visual eras keyed to log10(years). Floor at ~1e-43 y (~Planck), ceiling ~1e9 y.
  const logMin = -43;
  const logMax = 9;
  const logY = lerp(logMin, logMax, clamp(p, 0, 1));
  return Math.pow(10, logY);
}

function progressForYears(y) {
  const logMin = -43;
  const logMax = 9;
  const logY = Math.log10(Math.max(y, Math.pow(10, logMin)));
  return clamp((logY - logMin) / (logMax - logMin), 0, 1);
}

// Checkpoint `at` values are spaced for scrubber readability.
// Early-universe absolute times span ~43 orders of magnitude; a pure log map
// would crush inflation/QGP/BBN onto the same pixel as t=0. Labels stay exact.
const checkpoints = [
  {
    id: "big-bang",
    at: 0.02,
    timeLabel: "t = 0 · about 13.8 billion years ago",
    title: "The Big Bang",
    body: "According to the standard ΛCDM model, space, time, matter, and energy begin in an extremely hot, dense state. The age of the Universe today is about 13.8 billion years. What follows is a continuous cooling and expansion that sets the initial conditions for everything later on this page.",
  },
  {
    id: "inflation",
    at: 0.12,
    timeLabel: "about 10⁻³⁶ to 10⁻³² seconds after the Big Bang",
    title: "Cosmic inflation",
    body: "In a brief interval of accelerated expansion, regions that are now widely separated were once in causal contact. Inflation stretches tiny quantum fluctuations into the seeds of later large-scale structure. When inflation ends, its energy reheats into a hot soup of particles.",
  },
  {
    id: "qgp",
    at: 0.24,
    timeLabel: "about 10⁻⁶ seconds",
    title: "Quark–gluon plasma and hadrons",
    body: "For a short time the Universe is filled with a quark–gluon plasma — quarks and gluons not yet confined inside hadrons. As it cools through roughly a trillion kelvin, quarks bind into protons and neutrons. Electrons, neutrinos, and photons fill the remaining thermal bath.",
  },
  {
    id: "bbn",
    at: 0.36,
    timeLabel: "about 3 to 20 minutes",
    title: "Big Bang nucleosynthesis",
    body: "While the Universe is still hotter than about a billion kelvin, protons and neutrons fuse into light nuclei. Roughly three-quarters of baryonic mass ends as hydrogen-1, about one-quarter as helium-4, with traces of deuterium, helium-3, and lithium-7. Heavier elements form later inside stars.",
  },
  {
    id: "recombination",
    at: 0.52,
    timeLabel: "about 380,000 years",
    title: "Recombination and the cosmic microwave background",
    body: "Electrons combine with nuclei to form neutral atoms, and the photon mean free path grows suddenly. Light that last scattered then still fills the sky today as the cosmic microwave background — a nearly uniform glow at about 2.725 K, with tiny temperature variations of order one part in 100,000.",
  },
  {
    id: "dark-ages",
    at: 0.66,
    timeLabel: "about 380,000 years to ~100 million years",
    title: "The cosmic dark ages",
    body: "After the CMB is released, there are not yet luminous stars. Neutral hydrogen fills expanding space. Density perturbations grow under gravity, especially in dark matter, quietly assembling the halos that will host the first stars.",
  },
  {
    id: "first-stars",
    at: 0.80,
    timeLabel: "about 100 to 200 million years",
    title: "First stars — Population III",
    body: "In metal-free minihalos, molecular hydrogen cooling allows gas to collapse into the first stars. These Population III stars are thought to have been typically much more massive than the Sun, short-lived, and bright in ultraviolet light — the first local sources of illumination after the dark ages.",
  },
  {
    id: "reionization",
    at: 0.93,
    timeLabel: "up to about 1 billion years",
    title: "First galaxies and reionization",
    body: "Early galaxies assemble as stars and supernovae enrich the surrounding gas. Ultraviolet radiation gradually reionizes intergalactic hydrogen. Observations place the midpoint of reionization near redshift z ≈ 7–8 (roughly 600–700 million years), with the process largely complete by about 1 billion years after the Big Bang.",
  },
];

const WHITE = { r: 255, g: 250, b: 240 };
const GOLD = { r: 255, g: 210, b: 120 };
const PLASMA = { r: 255, g: 140, b: 80 };
const QGP = { r: 255, g: 90, b: 140 };
const COOL_PLASMA = { r: 255, g: 170, b: 100 };
const CMB = { r: 180, g: 140, b: 120 };
const STAR = { r: 200, g: 220, b: 255 };
const GALAXY = { r: 140, g: 170, b: 255 };

function eraWeights(p) {
  // Soft blends between visual eras keyed to checkpoint `at` positions.
  const bb = smoothstep(0.00, 0.05, p) * (1 - smoothstep(0.06, 0.14, p));
  const infl = smoothstep(0.08, 0.14, p) * (1 - smoothstep(0.18, 0.26, p));
  const qgp = smoothstep(0.18, 0.28, p) * (1 - smoothstep(0.30, 0.38, p));
  const bbn = smoothstep(0.30, 0.40, p) * (1 - smoothstep(0.44, 0.52, p));
  const rec = smoothstep(0.46, 0.56, p) * (1 - smoothstep(0.58, 0.68, p));
  const dark = smoothstep(0.60, 0.70, p) * (1 - smoothstep(0.74, 0.82, p));
  const stars = smoothstep(0.70, 0.80, p) * (1 - smoothstep(0.90, 0.97, p) * 0.4);
  const gal = smoothstep(0.86, 0.94, p);
  return { bb, infl, qgp, bbn, rec, dark, stars, gal };
}

function colorTemp(p) {
  // Nuanced cooling: white-gold → plasma orange/magenta → amber → CMB beige → cold blue-black
  if (p < 0.2) return mixRgb(WHITE, GOLD, smoothstep(0, 0.2, p));
  if (p < 0.35) return mixRgb(GOLD, QGP, smoothstep(0.2, 0.35, p));
  if (p < 0.5) return mixRgb(QGP, COOL_PLASMA, smoothstep(0.35, 0.5, p));
  if (p < 0.65) return mixRgb(COOL_PLASMA, CMB, smoothstep(0.5, 0.65, p));
  if (p < 0.85) return mixRgb(CMB, { r: 40, g: 50, b: 80 }, smoothstep(0.65, 0.85, p));
  return mixRgb({ r: 40, g: 50, b: 80 }, { r: 8, g: 10, b: 28 }, smoothstep(0.85, 1, p));
}

function drawPlasmaField(ctx, w, h, p, quality, strength) {
  if (strength < 0.01) return;
  const cols = Math.max(8, Math.floor(28 * quality));
  const rows = Math.max(6, Math.floor(18 * quality));
  const cellW = w / cols;
  const cellH = h / rows;
  const scale = 2.2 + p * 1.5;
  const base = colorTemp(p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const nx = (i + 0.5) / cols;
      const ny = (j + 0.5) / rows;
      const n = fbm(nx * scale + p * 3.0, ny * scale * 0.8 + p * 2.1, quality > 0.6 ? 4 : 3);
      const n2 = fbm(nx * scale * 2.1 - p * 1.4, ny * scale * 1.7, 2);
      const bright = Math.pow(n * 0.7 + n2 * 0.3, 1.4);
      const a = bright * strength * 0.22;
      if (a < 0.01) continue;
      const c = mixRgb(base, WHITE, bright * 0.35);
      ctx.fillStyle = rgba(c.r, c.g, c.b, a);
      ctx.fillRect(i * cellW - 1, j * cellH - 1, cellW + 2, cellH + 2);
    }
  }
  ctx.restore();
}

function drawCMBMottle(ctx, w, h, p, quality, strength) {
  if (strength < 0.01) return;
  const cols = Math.max(10, Math.floor(36 * quality));
  const rows = Math.max(8, Math.floor(24 * quality));
  const cellW = w / cols;
  const cellH = h / rows;
  ctx.save();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const nx = i / cols;
      const ny = j / rows;
      const n = fbm(nx * 4.5 + 10, ny * 3.2 + 4, 3);
      const delta = (n - 0.5) * 2; // -1..1
      const warm = delta > 0;
      const a = Math.abs(delta) * strength * 0.32;
      ctx.fillStyle = warm
        ? rgba(220, 170, 140, a)
        : rgba(120, 140, 180, a);
      ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
    }
  }
  ctx.restore();
}

function starPos(i, w, h) {
  return {
    x: hash01(i * 19.7 + 3.1) * w,
    y: hash01(i * 7.3 + 11.9) * h,
    r: 0.6 + hash01(i * 2.9) * 2.4,
    hue: hash01(i * 5.5),
  };
}

function drawFirstStars(ctx, w, h, p, quality, strength) {
  if (strength < 0.01) return;
  const count = Math.floor(lerp(18, 110, quality) * Math.max(strength, 0.35));
  const ignite = smootherstep(0.72, 0.90, p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const birth = hash01(i * 13.1);
    const on = clamp((ignite - birth * 0.85) / 0.2, 0, 1);
    if (on <= 0) continue;
    const s = starPos(i, w, h);
    const col = s.hue > 0.7 ? { r: 255, g: 210, b: 180 } : s.hue > 0.35 ? STAR : { r: 180, g: 200, b: 255 };
    const pulse = 0.85 + 0.15 * Math.sin((p * 8 + i) * 1.7); // slow, tied to progress not wall time for determinism when scrubbing
    // Slight wall-clock shimmer only via very small amplitude would break determinism; keep pure.
    drawGlow(ctx, s.x, s.y, s.r * 22 * on * pulse, col, 0.55 * on);
    drawGlow(ctx, s.x, s.y, s.r * 8 * on, { r: 255, g: 255, b: 255 }, 0.45 * on);
    ctx.fillStyle = rgba(255, 255, 255, 0.95 * on);
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1.2, s.r * on), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGalaxies(ctx, w, h, p, quality, strength) {
  if (strength < 0.01) return;
  const count = Math.floor(lerp(4, 18, quality));
  const grow = smootherstep(0.90, 1.0, p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const gx = hash01(i * 4.4 + 2) * w;
    const gy = hash01(i * 9.1 + 6) * h;
    const ang = hash01(i * 3.3) * Math.PI * 2;
    const size = (30 + hash01(i * 2.2) * 70) * grow;
    const a = (0.08 + hash01(i) * 0.12) * strength * grow;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(ang);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    g.addColorStop(0, rgba(230, 240, 255, a * 1.8));
    g.addColorStop(0.25, rgba(GALAXY.r, GALAXY.g, GALAXY.b, a));
    g.addColorStop(0.7, rgba(80, 60, 140, a * 0.35));
    g.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.scale(1, 0.35 + hash01(i * 1.7) * 0.35);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawParticles(ctx, w, h, p, quality, era) {
  const n = Math.floor(lerp(20, 120, quality) * (era.qgp * 0.8 + era.bbn * 0.5 + era.bb * 0.3 + 0.15));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    // Deterministic positions that slowly drift with progress (gentle parallax layers)
    const layer = (i % 3) + 1;
    const baseX = hash01(i * 1.7);
    const baseY = hash01(i * 3.9 + 4);
    const drift = p * (0.04 / layer);
    const x = ((baseX + drift * (hash01(i + 1) - 0.3)) % 1) * w;
    const y = ((baseY + drift * 0.5 * (hash01(i + 2) - 0.5)) % 1) * h;
    const r = (0.5 + hash01(i * 8) * 1.8) / layer;
    const c = colorTemp(p);
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.25 / layer);
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const scene = {
  id: "cosmic-dawn",
  title: "Cosmic dawn",
  weight: 1.6,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const era = eraWeights(p);
    const bg = colorTemp(p);

    // Background fill — deep space cooling
    const darkness = smootherstep(0.55, 0.85, p);
    const br = lerp(bg.r, 5, darkness * 0.92);
    const bgG = lerp(bg.g, 6, darkness * 0.92);
    const bb = lerp(bg.b, 15, darkness * 0.85);
    ctx.fillStyle = rgba(br, bgG, bb, 1);
    ctx.fillRect(0, 0, w, h);

    // Big Bang flash core
    if (era.bb > 0.01 || p < 0.15) {
      const flash = Math.max(era.bb, 1 - smoothstep(0, 0.15, p));
      const cx = w * 0.5;
      const cy = h * 0.48;
      const rad = Math.max(w, h) * lerp(0.15, 0.95, smootherstep(0, 0.1, p));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, cx, cy, rad, WHITE, 0.95 * flash);
      drawGlow(ctx, cx, cy, rad * 0.55, GOLD, 0.7 * flash);
      drawGlow(ctx, cx, cy, rad * 0.25, WHITE, 0.9 * flash);
      ctx.restore();
    }

    // Inflation: gentle radial stretch suggestion (slow rings, not a zoom rush)
    if (era.infl > 0.01) {
      const cx = w * 0.5;
      const cy = h * 0.48;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        const t = (p * 2 + k * 0.12) % 1;
        const r = Math.max(w, h) * (0.05 + t * 0.55);
        ctx.strokeStyle = rgba(255, 230, 180, 0.12 * era.infl * (1 - t));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawGlow(ctx, cx, cy, Math.max(w, h) * 0.35, GOLD, 0.25 * era.infl);
      ctx.restore();
    }

    drawPlasmaField(ctx, w, h, p, quality, Math.max(era.qgp, era.bbn) * 0.9 + era.infl * 0.3);
    drawParticles(ctx, w, h, p, quality, era);

    // Fog that clears at recombination
    const fog = (1 - smootherstep(0.52, 0.68, p)) * (0.35 + era.bbn * 0.4 + era.qgp * 0.3);
    if (fog > 0.01) {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
      const fc = colorTemp(Math.min(p, 0.55));
      g.addColorStop(0, rgba(fc.r, fc.g, fc.b, 0.15 * fog));
      g.addColorStop(0.5, rgba(fc.r, fc.g, fc.b, 0.28 * fog));
      g.addColorStop(1, rgba(20, 10, 5, 0.45 * fog));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // CMB mottling after fog clears — linger faintly through dark ages
    const cmbStr = smootherstep(0.50, 0.62, p) * (1 - smootherstep(0.82, 0.95, p)) * 1.0;
    drawCMBMottle(ctx, w, h, p, quality, cmbStr * 0.85 + era.rec * 0.65);

    // Soft CMB all-sky wash
    if (cmbStr > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, w * 0.5, h * 0.5, Math.max(w, h) * 0.55, CMB, 0.08 * cmbStr);
      ctx.restore();
    }

    drawFirstStars(ctx, w, h, p, quality, Math.max(era.stars, era.gal * 0.65, smootherstep(0.72, 0.85, p)));
    drawGalaxies(ctx, w, h, p, quality, Math.max(era.gal, smootherstep(0.88, 0.96, p)));

    // Parallax dust after first light (very slow)
    if (p > 0.8) {
      const dustN = Math.floor(30 * quality);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < dustN; i++) {
        const layer = (i % 3) + 1;
        const x = ((hash01(i * 2.2) + p * 0.02 / layer) % 1) * w;
        const y = hash01(i * 6.6 + 1) * h;
        ctx.fillStyle = rgba(180, 200, 255, 0.06 / layer);
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.restore();
    }

    drawVignette(ctx, w, h, 0.5 + darkness * 0.2);
    drawGrain(ctx, w, h, Math.floor(p * 1000), 0.035, quality);
  },
};

export default scene;
