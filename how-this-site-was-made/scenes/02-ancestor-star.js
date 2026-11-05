/**
 * Chapter 2 — Ancestor star
 * Massive-star life, core-collapse supernova, and neutron-star merger r-process.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01, fbm,
  drawGlow, drawVignette, drawGrain, rgba, mixRgb,
} from "../util.js";

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

function drawStar(ctx, cx, cy, radius, heat, quality) {
  const core = mixRgb({ r: 255, g: 255, b: 255 }, { r: 255, g: 160, b: 60 }, heat);
  const mid = mixRgb({ r: 255, g: 200, b: 120 }, { r: 255, g: 80, b: 40 }, heat);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, cx, cy, radius * 3.2, mid, 0.35);
  drawGlow(ctx, cx, cy, radius * 1.6, core, 0.55);
  drawGlow(ctx, cx, cy, radius * 0.7, { r: 255, g: 255, b: 255 }, 0.8);
  // Photosphere
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, rgba(255, 250, 240, 0.95));
  g.addColorStop(0.5, rgba(core.r, core.g, core.b, 0.85));
  g.addColorStop(1, rgba(mid.r, mid.g, mid.b, 0.0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShells(ctx, cx, cy, radius, progress, quality) {
  const shells = [
    { f: 1.0, c: { r: 120, g: 180, b: 255 }, name: "H" },
    { f: 0.78, c: { r: 180, g: 220, b: 255 }, name: "He" },
    { f: 0.58, c: { r: 255, g: 220, b: 120 }, name: "C/O" },
    { f: 0.42, c: { r: 255, g: 160, b: 80 }, name: "Ne/Mg" },
    { f: 0.28, c: { r: 255, g: 100, b: 80 }, name: "Si" },
    { f: 0.14, c: { r: 200, g: 200, b: 210 }, name: "Fe" },
  ];
  const reveal = smootherstep(0.18, 0.55, progress);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  shells.forEach((s, i) => {
    const on = clamp((reveal - i * 0.12) / 0.2, 0, 1);
    if (on <= 0) return;
    const r = radius * s.f;
    ctx.strokeStyle = rgba(s.c.r, s.c.g, s.c.b, 0.35 * on);
    ctx.lineWidth = Math.max(1.5, radius * 0.035);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    drawGlow(ctx, cx, cy, r * 1.05, s.c, 0.08 * on);
  });
  ctx.restore();
}

function drawSupernova(ctx, w, h, cx, cy, p, quality) {
  const blast = smootherstep(0.48, 0.72, p);
  if (blast <= 0) return;
  const rad = Math.max(w, h) * lerp(0.02, 0.75, blast);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, cx, cy, rad * 0.4, { r: 255, g: 255, b: 240 }, 0.7 * (1 - blast * 0.5));
  drawGlow(ctx, cx, cy, rad, { r: 255, g: 180, b: 80 }, 0.45 * (1 - blast * 0.3));
  drawGlow(ctx, cx, cy, rad * 1.3, { r: 255, g: 80, b: 40 }, 0.2 * (1 - blast * 0.4));

  // Filaments
  const n = Math.floor(lerp(12, 36, quality));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + hash01(i) * 0.4;
    const len = rad * (0.5 + hash01(i * 3) * 0.6);
    const x2 = cx + Math.cos(ang) * len;
    const y2 = cy + Math.sin(ang) * len * 0.85;
    const g = ctx.createLinearGradient(cx, cy, x2, y2);
    g.addColorStop(0, rgba(255, 240, 200, 0.5 * (1 - blast * 0.4)));
    g.addColorStop(1, rgba(255, 100, 40, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2 + hash01(i * 2) * 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMerger(ctx, w, h, p, quality) {
  const m = smootherstep(0.72, 0.95, p);
  if (m <= 0) return;
  const cx = w * 0.5;
  const cy = h * 0.48;
  const sep = lerp(90, 0, smootherstep(0.72, 0.88, p));
  const a1x = cx - sep;
  const a2x = cx + sep;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Two neutron stars
  drawGlow(ctx, a1x, cy, 28, { r: 160, g: 200, b: 255 }, 0.5 * m);
  drawGlow(ctx, a2x, cy, 28, { r: 160, g: 200, b: 255 }, 0.5 * m);
  ctx.fillStyle = rgba(220, 235, 255, 0.9 * m);
  ctx.beginPath();
  ctx.arc(a1x, cy, 6, 0, Math.PI * 2);
  ctx.arc(a2x, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  // Spiral ejecta / r-process glow after contact
  const eject = smootherstep(0.86, 1.0, p);
  if (eject > 0) {
    drawGlow(ctx, cx, cy, 120 * eject, { r: 255, g: 200, b: 80 }, 0.35 * eject);
    drawGlow(ctx, cx, cy, 220 * eject, { r: 180, g: 80, b: 255 }, 0.18 * eject);
    const n = Math.floor(40 * quality);
    for (let i = 0; i < n; i++) {
      const ang = hash01(i * 1.3) * Math.PI * 2 + p * 1.5;
      const r = 20 + hash01(i * 4) * 180 * eject;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.55;
      ctx.fillStyle = rgba(255, 210, 120, 0.35 * eject * hash01(i));
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + hash01(i * 2) * 2, 0, Math.PI * 2);
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
    const cx = w * 0.5;
    const cy = h * 0.48;

    // Nebula background
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const x = hash01(i * 2.1) * w;
      const y = hash01(i * 3.7) * h;
      const col = i % 2 === 0 ? { r: 80, g: 60, b: 160 } : { r: 40, g: 100, b: 160 };
      drawGlow(ctx, x, y, 180 + hash01(i) * 120, col, 0.12);
    }
    ctx.restore();

    const starPhase = 1 - smootherstep(0.5, 0.65, p);
    const starR = lerp(28, 70, smootherstep(0.0, 0.35, p)) * starPhase;
    const heat = smootherstep(0.2, 0.55, p);

    if (starPhase > 0.05) {
      drawShells(ctx, cx, cy, starR * 1.35, p, quality);
      drawStar(ctx, cx, cy, starR, heat, quality);
    }

    drawSupernova(ctx, w, h, cx, cy, p, quality);
    drawMerger(ctx, w, h, p, quality);

    // Element dust after SN
    const dust = smootherstep(0.55, 0.75, p) * (1 - smootherstep(0.85, 1, p) * 0.5);
    if (dust > 0) {
      const n = Math.floor(60 * quality);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const ang = hash01(i) * Math.PI * 2;
        const dist = (0.1 + hash01(i * 5) * 0.9) * Math.max(w, h) * 0.4 * dust;
        const x = cx + Math.cos(ang) * dist;
        const y = cy + Math.sin(ang) * dist * 0.7;
        ctx.fillStyle = rgba(255, 180, 100, 0.2 * dust);
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    }

    drawVignette(ctx, w, h, 0.55);
    drawGrain(ctx, w, h, Math.floor(p * 800 + 50), 0.03, quality);
  },
};

export default scene;
