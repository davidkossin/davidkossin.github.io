/**
 * Chapter 2 — Ancestor star (premium)
 * Massive star, onion-shell fusion cutaway, core-collapse SN remnant, NS merger + kilonova.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawBloom, drawVignette, drawGrain,
  drawVolumetricHaze, drawStarfield, rgba, mixRgb,
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

const SHELLS = [
  { f: 1.00, c: { r: 120, g: 190, b: 255 }, label: "H" },
  { f: 0.82, c: { r: 180, g: 220, b: 255 }, label: "He" },
  { f: 0.66, c: { r: 255, g: 220, b: 120 }, label: "C" },
  { f: 0.52, c: { r: 255, g: 180, b: 90 }, label: "Ne" },
  { f: 0.40, c: { r: 255, g: 140, b: 70 }, label: "O" },
  { f: 0.28, c: { r: 255, g: 100, b: 80 }, label: "Si" },
  { f: 0.14, c: { r: 210, g: 210, b: 220 }, label: "Fe" },
];

function stage(view, w, h) {
  const s = view.safeContent;
  if (s && s.w > 40) return { cx: s.cx, cy: s.cy, scale: Math.min(s.w, s.h) };
  return { cx: w * 0.5, cy: h * 0.48, scale: Math.min(w, h) };
}

function drawNebulaBg(ctx, w, h, p, quality) {
  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, Math.floor(55 * quality), 12, p * 0.3, 0.45);
  drawVolumetricHaze(ctx, w, h, {
    count: Math.floor(lerp(6, 11, quality)),
    seed: 20,
    strength: 0.16,
    color: { r: 80, g: 50, b: 150 },
    progress: p,
  });
  drawVolumetricHaze(ctx, w, h, {
    count: 5,
    seed: 21,
    strength: 0.12,
    color: { r: 60, g: 100, b: 180 },
    progress: p * 0.7,
  });
}

function drawMassiveStar(ctx, cx, cy, radius, heat, quality) {
  const core = mixRgb({ r: 255, g: 255, b: 255 }, { r: 255, g: 170, b: 80 }, heat);
  const mid = mixRgb({ r: 255, g: 210, b: 140 }, { r: 255, g: 90, b: 50 }, heat);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawBloom(ctx, cx, cy, radius * 2.8, mid, 0.55);
  drawGlow(ctx, cx, cy, radius * 1.5, core, 0.65);
  // Photosphere disc
  const g = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, radius * 0.1, cx, cy, radius);
  g.addColorStop(0, rgba(255, 252, 245, 0.98));
  g.addColorStop(0.45, rgba(core.r, core.g, core.b, 0.95));
  g.addColorStop(0.85, rgba(mid.r, mid.g, mid.b, 0.7));
  g.addColorStop(1, rgba(mid.r, mid.g, mid.b, 0));
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  // Limb darkening ring
  ctx.strokeStyle = rgba(255, 160, 80, 0.25 * heat);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOnionCutaway(ctx, cx, cy, radius, progress, quality) {
  const reveal = smootherstep(0.15, 0.50, progress);
  if (reveal < 0.02) return;
  // Clip to right half for cutaway look
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy - radius * 1.15, radius * 1.4, radius * 2.3);
  ctx.clip();

  // Outer photosphere fade on cut side
  ctx.globalCompositeOperation = "source-over";
  SHELLS.forEach((s, i) => {
    const on = clamp((reveal - i * 0.08) / 0.18, 0, 1);
    if (on <= 0) return;
    const r = radius * s.f;
    const g = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    g.addColorStop(0, rgba(s.c.r, s.c.g, s.c.b, 0.05 * on));
    g.addColorStop(0.7, rgba(s.c.r, s.c.g, s.c.b, 0.22 * on));
    g.addColorStop(1, rgba(s.c.r, s.c.g, s.c.b, 0.55 * on));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = rgba(s.c.r, s.c.g, s.c.b, 0.7 * on);
    ctx.lineWidth = Math.max(1.5, radius * 0.028);
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  });

  // Element labels along the cut mid-radii
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  SHELLS.forEach((s, i) => {
    const on = clamp((reveal - i * 0.08) / 0.18, 0, 1);
    if (on < 0.45) return;
    const rOuter = radius * s.f;
    const rInner = i < SHELLS.length - 1 ? radius * SHELLS[i + 1].f : 0;
    const rMid = (rOuter + rInner) * 0.5;
    ctx.globalAlpha = 0.9 * on;
    ctx.fillStyle = "#e8ecff";
    ctx.font = `600 ${Math.max(10, Math.min(14, radius * 0.11))}px Outfit, sans-serif`;
    ctx.fillText(s.label, cx + Math.max(14, rMid * 0.35), cy - rMid);
  });
  ctx.restore();
}

function drawSupernovaRemnant(ctx, w, h, cx, cy, p, quality) {
  const blast = smootherstep(0.48, 0.78, p) * (1 - smootherstep(0.76, 0.88, p));
  if (blast <= 0.01) return;
  const rad = Math.max(w, h) * lerp(0.02, 0.55, smootherstep(0.48, 0.78, p));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Core flash fading
  drawBloom(ctx, cx, cy, rad * 0.35, { r: 255, g: 250, b: 230 }, 0.7 * (1 - blast * 0.55));
  drawGlow(ctx, cx, cy, rad * 0.85, { r: 255, g: 170, b: 70 }, 0.4 * (1 - blast * 0.35));

  // Expanding remnant shell (double ellipse for thickness)
  const shellR = rad * 0.92;
  for (const [sx, sy, a] of [[1, 0.78, 0.5], [1.08, 0.84, 0.25]]) {
    ctx.strokeStyle = rgba(255, 200, 120, a * (0.45 + 0.55 * (1 - blast)));
    ctx.lineWidth = Math.max(2.5, 7 * (1 - blast * 0.45));
    ctx.beginPath();
    ctx.ellipse(cx, cy, shellR * sx, shellR * sy, 0.12, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawGlow(ctx, cx, cy, shellR * 1.15, { r: 255, g: 120, b: 50 }, 0.22 * (1 - blast * 0.3));

  // Filaments (curved, not straight rays)
  const n = Math.floor(lerp(22, 48, quality));
  for (let i = 0; i < n; i++) {
    const ang0 = (i / n) * Math.PI * 2 + hash01(i) * 0.35;
    const len = rad * (0.55 + hash01(i * 3) * 0.55);
    const curl = (hash01(i * 7) - 0.5) * 0.9;
    const x1 = cx + Math.cos(ang0) * rad * 0.12;
    const y1 = cy + Math.sin(ang0) * rad * 0.1;
    const x2 = cx + Math.cos(ang0 + curl * 0.4) * len;
    const y2 = cy + Math.sin(ang0 + curl * 0.4) * len * 0.82;
    const cpx = cx + Math.cos(ang0 + curl) * len * 0.55;
    const cpy = cy + Math.sin(ang0 + curl) * len * 0.45;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, rgba(255, 240, 200, 0.55 * (1 - blast * 0.4)));
    g.addColorStop(0.6, rgba(255, 140, 60, 0.35 * (1 - blast * 0.3)));
    g.addColorStop(1, rgba(255, 80, 40, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5 + hash01(i * 2) * 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
  }

  // Ejecta clumps
  for (let i = 0; i < Math.floor(25 * quality); i++) {
    const ang = hash01(i * 1.9) * Math.PI * 2;
    const d = rad * (0.3 + hash01(i * 4) * 0.75);
    const x = cx + Math.cos(ang) * d;
    const y = cy + Math.sin(ang) * d * 0.8;
    drawGlow(ctx, x, y, 6 + hash01(i) * 10, { r: 255, g: 180, b: 100 }, 0.25 * blast * (1 - blast * 0.3));
  }
  ctx.restore();
}

function drawNSMerger(ctx, w, h, cx, cy, p, quality) {
  const m = smootherstep(0.68, 0.98, p);
  if (m <= 0) return;

  const inspiral = smootherstep(0.68, 0.90, p);
  const sep = lerp(110, 0, inspiral);
  const orbitAng = p * 5.5; // slow spiral feel tied to progress
  const a1x = cx + Math.cos(orbitAng) * sep;
  const a1y = cy + Math.sin(orbitAng) * sep * 0.45;
  const a2x = cx + Math.cos(orbitAng + Math.PI) * sep;
  const a2y = cy + Math.sin(orbitAng + Math.PI) * sep * 0.45;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Gravitational-wave-ish faint spirals
  if (sep > 8) {
    ctx.strokeStyle = rgba(160, 200, 255, 0.12 * m);
    ctx.lineWidth = 1.5;
    for (let turn = 0; turn < 2; turn++) {
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const ang = orbitAng + t * Math.PI * 2 + turn * Math.PI;
        const r = sep * (1 - t * 0.15) * (1 + turn * 0.15);
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.45;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  if (sep > 4) {
    drawGlow(ctx, a1x, a1y, 32, { r: 160, g: 200, b: 255 }, 0.55 * m);
    drawGlow(ctx, a2x, a2y, 32, { r: 160, g: 200, b: 255 }, 0.55 * m);
    ctx.fillStyle = rgba(230, 240, 255, 0.95 * m);
    ctx.beginPath();
    ctx.arc(a1x, a1y, 5.5, 0, Math.PI * 2);
    ctx.arc(a2x, a2y, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kilonova
  const eject = smootherstep(0.86, 1.0, p);
  if (eject > 0) {
    drawBloom(ctx, cx, cy, 140 * eject, { r: 255, g: 200, b: 90 }, 0.55 * eject);
    drawGlow(ctx, cx, cy, 260 * eject, { r: 180, g: 90, b: 255 }, 0.28 * eject);
    drawGlow(ctx, cx, cy, 90 * eject, { r: 255, g: 240, b: 220 }, 0.45 * eject);
    // Toroidal ejecta hint
    ctx.strokeStyle = rgba(255, 180, 100, 0.35 * eject);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70 * eject, 28 * eject, 0, 0, Math.PI * 2);
    ctx.stroke();
    const n = Math.floor(50 * quality);
    for (let i = 0; i < n; i++) {
      const ang = hash01(i * 1.3) * Math.PI * 2 + p * 1.2;
      const r = 18 + hash01(i * 4) * 200 * eject;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.5;
      ctx.fillStyle = rgba(255, 210, 140, 0.4 * eject * hash01(i));
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + hash01(i * 2) * 2.2, 0, Math.PI * 2);
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
    const { cx, cy, scale } = stage(view, w, h);

    drawNebulaBg(ctx, w, h, p, quality);

    const starPhase = 1 - smootherstep(0.48, 0.62, p);
    const starR = lerp(34, Math.min(90, scale * 0.22), smootherstep(0.0, 0.35, p)) * starPhase;
    const heat = smootherstep(0.15, 0.55, p);

    if (starPhase > 0.05 && starR > 2) {
      drawMassiveStar(ctx, cx, cy, starR, heat, quality);
      drawOnionCutaway(ctx, cx, cy, starR, p, quality);
    }

    drawSupernovaRemnant(ctx, w, h, cx, cy, p, quality);
    drawNSMerger(ctx, w, h, cx, cy, p, quality);

    drawVignette(ctx, w, h, 0.55);
    drawGrain(ctx, w, h, Math.floor(p * 800 + 50), 0.028, quality);
  },
};

export default scene;
