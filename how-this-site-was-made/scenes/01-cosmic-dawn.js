/**
 * Chapter 1 — Cosmic dawn (v3 planetarium)
 * Large subjects in safeContent; rich full-canvas backgrounds; mid-clear recombination.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawBloom, drawVignette, drawGrain,
  drawVolumetricHaze, drawStarfield, rgba, mixRgb,
} from "../util.js";

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

const WHITE = { r: 255, g: 252, b: 245 };
const GOLD = { r: 255, g: 210, b: 130 };
const PLASMA_HOT = { r: 255, g: 150, b: 70 };
const PLASMA_PINK = { r: 255, g: 110, b: 150 };
const PLASMA_COOL = { r: 255, g: 175, b: 115 };
const CMB_WARM = { r: 255, g: 170, b: 120 };
const CMB_COOL = { r: 70, g: 110, b: 190 };
const STAR = { r: 210, g: 225, b: 255 };

function stage(view, w, h) {
  const s = view.safeContent;
  if (s && s.w > 40 && s.h > 40) {
    const dim = Math.min(s.w, s.h);
    return { cx: s.cx, cy: s.cy, dim };
  }
  return { cx: w * 0.5, cy: h * 0.48, dim: Math.min(w, h) * 0.7 };
}

function colorTemp(p) {
  if (p < 0.15) return mixRgb(WHITE, GOLD, smoothstep(0, 0.15, p));
  if (p < 0.32) return mixRgb(GOLD, PLASMA_PINK, smoothstep(0.15, 0.32, p));
  if (p < 0.48) return mixRgb(PLASMA_PINK, PLASMA_COOL, smoothstep(0.32, 0.48, p));
  if (p < 0.62) return mixRgb(PLASMA_COOL, CMB_WARM, smoothstep(0.48, 0.62, p));
  if (p < 0.82) return mixRgb(CMB_WARM, { r: 18, g: 22, b: 48 }, smoothstep(0.62, 0.82, p));
  return mixRgb({ r: 18, g: 22, b: 48 }, { r: 5, g: 6, b: 16 }, smoothstep(0.82, 1, p));
}

function drawRichBackdrop(ctx, w, h, p, quality) {
  const bg = colorTemp(p);
  const dark = smootherstep(0.58, 0.85, p);
  const deep = mixRgb(bg, { r: 8, g: 10, b: 28 }, dark * 0.75);
  ctx.fillStyle = rgba(deep.r, deep.g, deep.b, 1);
  ctx.fillRect(0, 0, w, h);
  const sheets = Math.floor(lerp(6, 12, quality));
  for (let i = 0; i < sheets; i++) {
    const x = hash01(i * 1.7 + 2) * w;
    const y = hash01(i * 3.3 + 4) * h;
    const rad = (0.35 + hash01(i * 5) * 0.55) * Math.max(w, h);
    let col;
    if (p < 0.45) col = mixRgb(PLASMA_HOT, GOLD, hash01(i));
    else if (p < 0.65) col = mixRgb(CMB_WARM, { r: 120, g: 80, b: 160 }, hash01(i));
    else col = mixRgb({ r: 40, g: 60, b: 120 }, { r: 80, g: 40, b: 120 }, hash01(i));
    drawGlow(ctx, x, y, rad, col, (0.06 + hash01(i * 2) * 0.1) * (1 - dark * 0.4));
  }
}

/** High-contrast Planck-like CMB with dark gaps between patches */
function drawCMBMap(ctx, w, h, strength, quality) {
  if (strength < 0.01) return;
  ctx.save();
  const base = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  base.addColorStop(0, rgba(22, 20, 38, 0.75 * strength));
  base.addColorStop(1, rgba(3, 4, 12, 0.95 * strength));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const n = Math.floor(lerp(32, 60, quality));
  for (let i = 0; i < n; i++) {
    const gx = hash01(i * 2.1 + 11);
    const gy = hash01(i * 4.7 + 13);
    const cx = (gx * 0.65 + hash01(Math.floor(gx * 5) * 3.1) * 0.35) * w;
    const cy = (gy * 0.65 + hash01(Math.floor(gy * 5) * 5.2) * 0.35) * h;
    const rad = (0.05 + hash01(i * 3.3) * 0.14) * Math.max(w, h);
    const warm = hash01(i * 7.7 + 11) > 0.48;
    const col = warm
      ? { r: 255, g: 155 + hash01(i) * 45, b: 85 + hash01(i * 2) * 45 }
      : { r: 45 + hash01(i) * 45, g: 85 + hash01(i * 2) * 45, b: 175 + hash01(i * 3) * 55 };
    drawGlow(ctx, cx, cy, rad, col, (0.32 + hash01(i * 1.5) * 0.3) * strength);
  }
  for (let i = 0; i < 7; i++) {
    const cx = hash01(i * 9.1 + 40) * w;
    const cy = hash01(i * 6.2 + 41) * h;
    const rad = (0.16 + hash01(i) * 0.14) * Math.max(w, h);
    drawGlow(ctx, cx, cy, rad, i % 2 === 0 ? CMB_WARM : CMB_COOL, 0.24 * strength);
  }
  ctx.restore();
}

/** Patchy glowing billows with gaps — mid-clear reveals CMB underneath */
function drawPlasmaFog(ctx, w, h, p, quality, opacity) {
  if (opacity < 0.01) return;
  const n = Math.floor(lerp(7, 13, quality));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = ((hash01(i * 2.2 + 1) + p * 0.05 * (hash01(i + 2) - 0.35)) % 1) * w;
    const y = ((hash01(i * 5.1 + 3) + p * 0.04 * (hash01(i + 4) - 0.5)) % 1) * h;
    const rad = (0.12 + hash01(i * 7) * 0.26) * Math.max(w, h);
    const col = mixRgb(mixRgb(PLASMA_HOT, GOLD, hash01(i)), PLASMA_PINK, hash01(i * 3) * 0.4);
    drawGlow(ctx, x, y, rad, col, opacity * (0.42 + hash01(i * 4) * 0.32));
  }
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < Math.floor(n * 0.75); i++) {
    const x = hash01(i * 8.2 + 9) * w;
    const y = hash01(i * 3.9 + 10) * h;
    drawGlow(ctx, x, y, (0.045 + hash01(i) * 0.07) * Math.max(w, h), WHITE, 0.22 * opacity);
    drawGlow(ctx, x, y, (0.09 + hash01(i * 2) * 0.1) * Math.max(w, h), GOLD, 0.24 * opacity);
  }
  ctx.restore();
}

function drawInflationRings(ctx, cx, cy, dim, p, strength) {
  if (strength < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const R = dim * 0.85;
  for (let k = 0; k < 7; k++) {
    const t = (p * 1.4 + k * 0.12) % 1;
    ctx.strokeStyle = rgba(255, 230, 180, 0.16 * strength * (1 - t));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.15 + t * 1.1), 0, Math.PI * 2);
    ctx.stroke();
  }
  drawBloom(ctx, cx, cy, dim * 0.7, GOLD, 0.45 * strength);
  ctx.restore();
}

function drawFirstStars(ctx, w, h, cx, cy, dim, p, quality, strength) {
  if (strength < 0.01) return;
  const count = Math.floor(lerp(40, 130, quality));
  const ignite = smootherstep(0.68, 0.88, p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const birth = hash01(i * 13.1);
    const on = clamp((ignite - birth * 0.75) / 0.25, 0, 1) * strength;
    if (on <= 0) continue;
    const inStage = hash01(i * 2.2) > 0.22;
    const x = inStage ? cx + (hash01(i * 19.7) - 0.5) * dim * 1.15 : hash01(i * 19.7 + 3) * w;
    const y = inStage ? cy + (hash01(i * 7.3) - 0.5) * dim * 0.95 : hash01(i * 7.3 + 11) * h;
    const r = (1.3 + hash01(i * 2.9) * 4) * (inStage ? 1.4 : 0.85);
    const col = hash01(i * 5.5) > 0.6 ? { r: 255, g: 220, b: 180 } : STAR;
    const pulse = 0.88 + 0.12 * Math.sin((p * 5 + i) * 1.2);
    drawGlow(ctx, x, y, r * 22 * on * pulse, col, 0.55 * on);
    drawGlow(ctx, x, y, r * 7 * on, WHITE, 0.5 * on);
    ctx.fillStyle = rgba(255, 255, 255, 0.95 * on);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.4, r * 0.55 * on), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGalaxies(ctx, w, h, cx, cy, dim, p, quality, strength) {
  if (strength < 0.01) return;
  const count = Math.floor(lerp(8, 20, quality));
  const grow = smootherstep(0.84, 1.0, p) * strength;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const inStage = i < count * 0.65;
    const gx = inStage ? cx + (hash01(i * 4.4) - 0.5) * dim : hash01(i * 4.4 + 2) * w;
    const gy = inStage ? cy + (hash01(i * 9.1) - 0.5) * dim * 0.85 : hash01(i * 9.1 + 6) * h;
    const ang = hash01(i * 3.3) * Math.PI * 2;
    const size = (55 + hash01(i * 2.2) * 115) * grow * (inStage ? 1.25 : 0.7);
    const a = (0.12 + hash01(i) * 0.16) * grow;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(ang);
    ctx.scale(1, 0.30 + hash01(i * 1.7) * 0.32);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    g.addColorStop(0, rgba(245, 248, 255, a * 2.2));
    g.addColorStop(0.18, rgba(160, 180, 255, a));
    g.addColorStop(0.5, rgba(110, 70, 190, a * 0.45));
    g.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(180, 200, 255, 0.22 * a);
    ctx.lineWidth = 2;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05) {
        const ra = size * (0.2 + t * 0.75);
        const aa = arm * Math.PI + t * 2.8;
        const x = Math.cos(aa) * ra;
        const y = Math.sin(aa) * ra;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
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
    const { cx, cy, dim } = stage(view, w, h);
    const subjectR = dim * 0.72;

    drawRichBackdrop(ctx, w, h, p, quality);

    const flash = Math.max(1 - smoothstep(0.0, 0.12, p), 0);
    const infl = smoothstep(0.05, 0.14, p) * (1 - smoothstep(0.16, 0.26, p));
    const plasmaEra = smoothstep(0.10, 0.30, p) * (1 - smootherstep(0.55, 0.72, p));
    // Mid-clear at 0.52: patchy fog over strong CMB
    const fogAmt = (1 - smootherstep(0.40, 0.58, p)) * clamp(0.22 + plasmaEra * 0.65, 0, 0.8);
    const cmbAmt = smootherstep(0.36, 0.50, p) * (1 - smootherstep(0.70, 0.88, p));
    const dark = smootherstep(0.58, 0.75, p);
    const stars = smootherstep(0.68, 0.86, p);
    const gal = smootherstep(0.84, 0.97, p);

    if (flash > 0.02 || p < 0.1) {
      const f = Math.max(flash, 1 - smoothstep(0, 0.1, p));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, cx, cy, subjectR * 2.2 * lerp(0.4, 1.3, smootherstep(0, 0.08, p)), WHITE, 0.95 * f);
      drawGlow(ctx, cx, cy, subjectR * 1.2, GOLD, 0.8 * f);
      drawGlow(ctx, cx, cy, subjectR * 0.45, WHITE, 0.95 * f);
      ctx.restore();
    }

    drawInflationRings(ctx, cx, cy, subjectR, p, infl);

    if (plasmaEra > 0.05) {
      drawPlasmaFog(ctx, w, h, p, quality, plasmaEra * 0.75);
      drawVolumetricHaze(ctx, w, h, {
        count: Math.floor(lerp(8, 14, quality)),
        seed: 3,
        strength: 0.18 * plasmaEra,
        color: mixRgb(PLASMA_HOT, GOLD, 0.4),
        progress: p,
      });
    }

    drawCMBMap(ctx, w, h, cmbAmt, quality);
    drawPlasmaFog(ctx, w, h, p, quality, fogAmt);
    // Extra dense billows near stage for volumetric depth at mid-clear
    if (fogAmt > 0.08) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const x = cx + (hash01(i * 2.5 + 70) - 0.5) * dim * 1.1;
        const y = cy + (hash01(i * 4.1 + 71) - 0.5) * dim * 0.8;
        drawGlow(ctx, x, y, dim * (0.28 + hash01(i) * 0.25), mixRgb(PLASMA_HOT, GOLD, hash01(i)), fogAmt * 0.45);
      }
      ctx.restore();
    }

    if (plasmaEra > 0.05 || fogAmt > 0.08) {
      const n = Math.floor(lerp(40, 140, quality) * Math.max(plasmaEra, fogAmt));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const x = ((hash01(i * 1.7) + p * 0.04) % 1) * w;
        const y = ((hash01(i * 3.9 + 4) + p * 0.02) % 1) * h;
        const c = colorTemp(Math.min(p, 0.55));
        ctx.fillStyle = rgba(c.r, c.g, c.b, 0.35 * Math.max(plasmaEra, fogAmt));
        ctx.beginPath();
        ctx.arc(x, y, 0.7 + hash01(i * 8) * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (dark > 0.3) drawStarfield(ctx, w, h, Math.floor(90 * quality), 1, p, 0.4 * dark);
    drawFirstStars(ctx, w, h, cx, cy, dim, p, quality, Math.max(stars, gal * 0.4));
    drawGalaxies(ctx, w, h, cx, cy, dim, p, quality, gal);
    if (p > 0.75) drawStarfield(ctx, w, h, Math.floor(100 * quality), 4, p, 0.5 * smootherstep(0.75, 0.95, p));

    drawVignette(ctx, w, h, 0.4 + dark * 0.18);
    // Keep grain very light so it never reads as a grid over the CMB
    drawGrain(ctx, w, h, Math.floor(p * 1000), 0.006, quality);
  },
};

export default scene;
