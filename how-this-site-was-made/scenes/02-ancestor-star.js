/**
 * Chapter 2 — Ancestor star (v3 planetarium)
 * Large star, wedge cutaway with thick colorblind-safe shells + leader labels,
 * Cas A / Crab-like filamentary supernova, NS merger + kilonova.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawBloom, drawVignette, drawGrain,
  drawVolumetricHaze, drawStarfield, rgba, mixRgb,
} from "../util.js";

const WHITE = { r: 255, g: 252, b: 245 };

const checkpoints = [
  {
    id: "star-forms",
    at: 0.08,
    timeLabel: "billions of years before the Sun · within the first generations of stars",
    title: "A massive star forms",
    body: "In a dense molecular cloud enriched by earlier stars, gravity collapses gas into a luminous, massive star — tens of times the mass of the Sun. Such stars burn hot and fast. Their cores reach temperatures and densities that allow nuclear fusion beyond hydrogen and helium.",
  },
  {
    id: "fusion-shells",
    at: 0.32,
    timeLabel: "stellar lifetime: typically a few million years for the most massive stars",
    title: "Fusion shells up to iron",
    body: "Layer by layer, the star fuses hydrogen to helium, then helium to carbon and oxygen, and onward through neon, magnesium, silicon, and other species. The process builds an onion-like structure of burning shells. Fusion stops at iron-group nuclei: binding them further does not release energy.",
  },
  {
    id: "supernova",
    at: 0.58,
    timeLabel: "seconds to hours for the collapse and shock breakout; the remnant shines for weeks to months",
    title: "Core-collapse supernova",
    body: "When the iron core can no longer support itself, it collapses in less than a second to nuclear densities, forming a proto-neutron star (or, if massive enough, a black hole). A shock revitalized by neutrinos unbinds the envelope — a core-collapse supernova that seeds the Galaxy with newly forged elements.",
  },
  {
    id: "ns-merger",
    at: 0.84,
    timeLabel: "merger timescale: from millions to billions of years after the progenitor stars form",
    title: "Neutron-star merger and the r-process",
    body: "Some supernovae leave neutron-star binaries that inspiral through gravitational-wave emission. When they merge, neutron-rich ejecta undergo rapid neutron capture (the r-process), synthesizing many of the elements heavier than iron — including gold, platinum, and uranium — later incorporated into planets like Earth.",
  },
];

/** Colorblind-safe shells with clear luminance steps (outer → Fe core) */
const SHELLS = [
  { f: 1.00, c: { r: 80, g: 170, b: 255 }, label: "H" },   // sky blue
  { f: 0.84, c: { r: 120, g: 220, b: 200 }, label: "He" }, // teal
  { f: 0.70, c: { r: 255, g: 230, b: 90 }, label: "C" },   // yellow
  { f: 0.56, c: { r: 255, g: 170, b: 50 }, label: "Ne" },  // orange
  { f: 0.44, c: { r: 255, g: 100, b: 70 }, label: "O" },   // red-orange
  { f: 0.30, c: { r: 220, g: 80, b: 140 }, label: "Si" },  // magenta
  { f: 0.16, c: { r: 240, g: 240, b: 245 }, label: "Fe" }, // bright iron core
];

function stage(view, w, h) {
  const s = view.safeContent;
  if (s && s.w > 40 && s.h > 40) {
    const dim = Math.min(s.w, s.h);
    return { cx: s.cx, cy: s.cy, dim };
  }
  return { cx: w * 0.55, cy: h * 0.48, dim: Math.min(w, h) * 0.7 };
}

function drawNebulaBg(ctx, w, h, p, quality) {
  ctx.fillStyle = "#07081a";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, Math.floor(90 * quality), 12, p * 0.25, 0.55);
  drawVolumetricHaze(ctx, w, h, {
    count: Math.floor(lerp(8, 14, quality)),
    seed: 20,
    strength: 0.2,
    color: { r: 90, g: 50, b: 160 },
    progress: p,
  });
  drawVolumetricHaze(ctx, w, h, {
    count: 7,
    seed: 21,
    strength: 0.14,
    color: { r: 40, g: 100, b: 180 },
    progress: p * 0.6,
  });
  drawVolumetricHaze(ctx, w, h, {
    count: 5,
    seed: 22,
    strength: 0.1,
    color: { r: 160, g: 60, b: 80 },
    progress: p * 0.4,
  });
}

function drawMassiveStar(ctx, cx, cy, radius, heat, p, quality) {
  const core = mixRgb({ r: 255, g: 255, b: 255 }, { r: 255, g: 175, b: 90 }, heat);
  const mid = mixRgb({ r: 255, g: 215, b: 150 }, { r: 255, g: 100, b: 55 }, heat);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawBloom(ctx, cx, cy, radius * 2.6, mid, 0.6);
  drawGlow(ctx, cx, cy, radius * 1.5, core, 0.7);

  // Photosphere
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createRadialGradient(cx - radius * 0.28, cy - radius * 0.28, radius * 0.08, cx, cy, radius);
  g.addColorStop(0, rgba(255, 252, 245, 0.98));
  g.addColorStop(0.4, rgba(core.r, core.g, core.b, 0.96));
  g.addColorStop(0.82, rgba(mid.r, mid.g, mid.b, 0.9));
  g.addColorStop(1, rgba(mid.r, mid.g, mid.b, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Gentle convective shimmer (deterministic soft blotches on surface)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.96, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  const n = Math.floor(lerp(12, 28, quality));
  for (let i = 0; i < n; i++) {
    const ang = hash01(i * 2.1) * Math.PI * 2 + p * 0.35;
    const dist = hash01(i * 3.7) * radius * 0.75;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const rr = radius * (0.08 + hash01(i * 5) * 0.14);
    const shimmer = 0.04 + 0.04 * Math.sin((p * 4 + i) * 1.7);
    drawGlow(ctx, x, y, rr, WHITE, shimmer);
  }
  ctx.restore();
  ctx.restore();
}

/** Wedge cutaway with thick shells + leader-line labels ≥12px */
function drawWedgeCutaway(ctx, cx, cy, radius, progress, quality, canvasW) {
  const reveal = smootherstep(0.12, 0.48, progress);
  if (reveal < 0.02) return;

  // Wedge opens lower-right; labels sit LEFT of star (on-canvas)
  const a0 = -0.35;
  const a1 = 1.35;

  ctx.save();
  // Clip to wedge
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius * 1.02, a0, a1);
  ctx.closePath();
  ctx.clip();

  // Darken cut face slightly
  ctx.fillStyle = rgba(10, 12, 24, 0.35 * reveal);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, a0, a1);
  ctx.fill();

  // Thick filled shells (annular wedges)
  for (let i = 0; i < SHELLS.length; i++) {
    const on = clamp((reveal - i * 0.07) / 0.2, 0, 1);
    if (on <= 0) continue;
    const rOuter = radius * SHELLS[i].f;
    const rInner = i < SHELLS.length - 1 ? radius * SHELLS[i + 1].f : 0;
    const c = SHELLS[i].c;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, a0, a1);
    ctx.arc(cx, cy, rInner, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.82 * on);
    ctx.fill();
    // Bright rim
    ctx.strokeStyle = rgba(255, 255, 255, 0.35 * on);
    ctx.lineWidth = Math.max(2, radius * 0.012);
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, a0, a1);
    ctx.stroke();
  }

  // Fe core disc
  const feOn = clamp((reveal - 0.55) / 0.25, 0, 1);
  if (feOn > 0) {
    const feR = radius * SHELLS[SHELLS.length - 1].f;
    drawGlow(ctx, cx, cy, feR * 2.2, { r: 255, g: 240, b: 200 }, 0.4 * feOn);
    ctx.fillStyle = rgba(245, 245, 250, 0.95 * feOn);
    ctx.beginPath();
    ctx.arc(cx, cy, feR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Cut edges (radial lines)
  ctx.save();
  ctx.strokeStyle = rgba(232, 236, 255, 0.55 * reveal);
  ctx.lineWidth = 2;
  for (const ang of [a0, a1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.stroke();
  }
  ctx.restore();

  // Leader lines + labels to the RIGHT of star (fits in safeContent on desktop)
  const midAng = (a0 + a1) * 0.5;
  const fontPx = Math.max(13, Math.min(18, radius * 0.095));
  const maxX = (canvasW || 1280) - 20;
  ctx.save();
  ctx.font = `700 ${fontPx}px Outfit, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const labelX = Math.min(maxX - 8, cx + radius * 1.08);
  SHELLS.forEach((s, i) => {
    const on = clamp((reveal - i * 0.07) / 0.2, 0, 1);
    if (on < 0.35) return;
    const rOuter = radius * s.f;
    const rInner = i < SHELLS.length - 1 ? radius * SHELLS[i + 1].f : 0;
    const rMid = (rOuter + rInner) * 0.5;
    const ax = cx + Math.cos(midAng) * rMid;
    const ay = cy + Math.sin(midAng) * rMid;
    const ly = cy - radius * 0.62 + i * (fontPx + 11);
    ctx.globalAlpha = 0.98 * on;
    ctx.strokeStyle = rgba(230, 235, 255, 0.9);
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(labelX - 4, ly);
    ctx.stroke();
    ctx.fillStyle = rgba(s.c.r, s.c.g, s.c.b, 1);
    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fill();
    const tw = ctx.measureText(s.label).width;
    ctx.fillStyle = rgba(5, 6, 18, 0.78);
    ctx.fillRect(labelX - 4, ly - fontPx * 0.6, tw + 12, fontPx * 1.25);
    ctx.fillStyle = "#f0f3ff";
    ctx.fillText(s.label, labelX + 2, ly);
  });
  ctx.restore();
}

/** Irregular filamentary remnant — Cas A / Crab style, NOT a UI ellipse */
function drawFilamentaryRemnant(ctx, w, h, cx, cy, p, quality, radiusScale) {
  const blast = smootherstep(0.46, 0.72, p) * (1 - smootherstep(0.74, 0.88, p));
  if (blast < 0.01) return;
  const R = radiusScale * lerp(0.15, 1.05, smootherstep(0.46, 0.72, p));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Soft shock glow (irregular — multiple offset centers)
  for (let i = 0; i < 5; i++) {
    const ox = (hash01(i * 2.2) - 0.5) * R * 0.25;
    const oy = (hash01(i * 3.1) - 0.5) * R * 0.2;
    drawGlow(ctx, cx + ox, cy + oy, R * (0.7 + hash01(i) * 0.4), { r: 255, g: 160, b: 70 }, 0.12 * blast);
  }
  drawBloom(ctx, cx, cy, R * 0.45, { r: 255, g: 240, b: 210 }, 0.55 * blast * (1 - blast * 0.4));

  // Bright compact remnant (NS / hotspot)
  drawGlow(ctx, cx, cy, R * 0.12, WHITE, 0.85 * blast);
  ctx.fillStyle = rgba(255, 250, 240, 0.95 * blast);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, R * 0.025), 0, Math.PI * 2);
  ctx.fill();

  // Wispy multi-colored filaments (quadratic curves with jittered endpoints)
  const filaments = Math.floor(lerp(45, 90, quality));
  const palette = [
    { r: 255, g: 200, b: 120 },
    { r: 120, g: 200, b: 255 },
    { r: 255, g: 120, b: 90 },
    { r: 180, g: 140, b: 255 },
    { r: 140, g: 255, b: 200 },
  ];
  for (let i = 0; i < filaments; i++) {
    const ang = (i / filaments) * Math.PI * 2 + hash01(i) * 0.5;
    const len = R * (0.45 + hash01(i * 3) * 0.7);
    const curl = (hash01(i * 7) - 0.5) * 1.4;
    const x1 = cx + Math.cos(ang) * R * (0.08 + hash01(i * 2) * 0.12);
    const y1 = cy + Math.sin(ang) * R * (0.08 + hash01(i * 2) * 0.1);
    const x2 = cx + Math.cos(ang + curl * 0.35) * len * (0.85 + hash01(i * 4) * 0.3);
    const y2 = cy + Math.sin(ang + curl * 0.35) * len * (0.7 + hash01(i * 5) * 0.35);
    const cpx = cx + Math.cos(ang + curl) * len * 0.5;
    const cpy = cy + Math.sin(ang + curl) * len * 0.42;
    const col = palette[i % palette.length];
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, rgba(col.r, col.g, col.b, 0.65 * blast));
    g.addColorStop(0.55, rgba(col.r, col.g, col.b, 0.35 * blast));
    g.addColorStop(1, rgba(col.r, col.g, col.b, 0));
    // Soft glow under filament
    ctx.strokeStyle = rgba(col.r, col.g, col.b, 0.2 * blast);
    ctx.lineWidth = 8 + hash01(i * 6) * 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.5 + hash01(i * 6) * 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
  }

  // Clumpy ejecta knots
  const knots = Math.floor(lerp(35, 70, quality));
  for (let i = 0; i < knots; i++) {
    const ang = hash01(i * 1.9 + 3) * Math.PI * 2;
    const d = R * (0.25 + hash01(i * 4.2) * 0.85);
    const x = cx + Math.cos(ang) * d * (0.9 + hash01(i) * 0.25);
    const y = cy + Math.sin(ang) * d * (0.75 + hash01(i * 2) * 0.3);
    const col = palette[i % palette.length];
    drawGlow(ctx, x, y, 5 + hash01(i * 3) * 14, col, 0.35 * blast);
  }

  // Irregular Cas A–like shell belt (clumpy, not a clean ring)
  const shellN = Math.floor(lerp(40, 80, quality));
  for (let i = 0; i < shellN; i++) {
    const ang = (i / shellN) * Math.PI * 2 + hash01(i * 2.7) * 0.4;
    const jitter = 0.72 + hash01(i * 5.1) * 0.45;
    const x = cx + Math.cos(ang) * R * jitter;
    const y = cy + Math.sin(ang) * R * jitter * 0.88;
    const col = palette[i % palette.length];
    drawGlow(ctx, x, y, 8 + hash01(i) * 16, col, 0.4 * blast);
    if (hash01(i * 3) > 0.55) {
      drawGlow(ctx, x + (hash01(i + 1) - 0.5) * 20, y + (hash01(i + 2) - 0.5) * 16, 12, col, 0.25 * blast);
    }
  }

  ctx.restore();
}

function drawNSMerger(ctx, w, h, cx, cy, p, quality, dim) {
  const m = smootherstep(0.68, 0.98, p);
  if (m <= 0) return;
  const inspiral = smootherstep(0.68, 0.90, p);
  const sep = lerp(dim * 0.28, 0, inspiral);
  const orbitAng = p * 5.5;
  const a1x = cx + Math.cos(orbitAng) * sep;
  const a1y = cy + Math.sin(orbitAng) * sep * 0.48;
  const a2x = cx + Math.cos(orbitAng + Math.PI) * sep;
  const a2y = cy + Math.sin(orbitAng + Math.PI) * sep * 0.48;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (sep > 6) {
    ctx.strokeStyle = rgba(160, 200, 255, 0.14 * m);
    ctx.lineWidth = 1.5;
    for (let turn = 0; turn < 2; turn++) {
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const ang = orbitAng + t * Math.PI * 2 + turn * Math.PI;
        const r = sep * (1 - t * 0.12) * (1 + turn * 0.12);
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.48;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    drawGlow(ctx, a1x, a1y, 36, { r: 160, g: 200, b: 255 }, 0.55 * m);
    drawGlow(ctx, a2x, a2y, 36, { r: 160, g: 200, b: 255 }, 0.55 * m);
    ctx.fillStyle = rgba(230, 240, 255, 0.95 * m);
    ctx.beginPath();
    ctx.arc(a1x, a1y, 6, 0, Math.PI * 2);
    ctx.arc(a2x, a2y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const eject = smootherstep(0.86, 1.0, p);
  if (eject > 0) {
    drawBloom(ctx, cx, cy, dim * 0.35 * eject, { r: 255, g: 200, b: 90 }, 0.6 * eject);
    drawGlow(ctx, cx, cy, dim * 0.55 * eject, { r: 180, g: 90, b: 255 }, 0.3 * eject);
    drawGlow(ctx, cx, cy, dim * 0.2 * eject, { r: 255, g: 240, b: 220 }, 0.5 * eject);
    // Torus ejecta
    ctx.strokeStyle = rgba(255, 180, 100, 0.4 * eject);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, dim * 0.22 * eject, dim * 0.08 * eject, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    const n = Math.floor(60 * quality);
    for (let i = 0; i < n; i++) {
      const ang = hash01(i * 1.3) * Math.PI * 2 + p;
      const r = dim * (0.05 + hash01(i * 4) * 0.4) * eject;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.5;
      ctx.fillStyle = rgba(255, 210, 140, 0.45 * eject * hash01(i));
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + hash01(i * 2) * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const scene = {
  id: "ancestor-star",
  title: "Ancestor star",
  weight: 1.2,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const { cx, cy, dim } = stage(view, w, h);
    const starR = dim * 0.68;

    drawNebulaBg(ctx, w, h, p, quality);

    const starPhase = 1 - smootherstep(0.46, 0.60, p);
    const heat = smootherstep(0.12, 0.5, p);
    const r = starR * starPhase * lerp(0.55, 1, smootherstep(0, 0.3, p));

    if (starPhase > 0.05 && r > 8) {
      drawMassiveStar(ctx, cx, cy, r, heat, p, quality);
      drawWedgeCutaway(ctx, cx, cy, r, p, quality, w);
    }

    drawFilamentaryRemnant(ctx, w, h, cx, cy, p, quality, dim * 0.95);
    drawNSMerger(ctx, w, h, cx, cy, p, quality, dim);

    drawVignette(ctx, w, h, 0.5);
    drawGrain(ctx, w, h, Math.floor(p * 800 + 50), 0.008, quality);
  },
};

export default scene;
