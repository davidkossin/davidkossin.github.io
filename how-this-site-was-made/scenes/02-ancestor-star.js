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
    return { cx: s.cx, cy: s.cy, dim, sx: s.x, sy: s.y, sw: s.w, sh: s.h };
  }
  return { cx: w * 0.55, cy: h * 0.48, dim: Math.min(w, h) * 0.7, sx: 0, sy: 0, sw: w, sh: h };
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
  drawBloom(ctx, cx, cy, radius * 1.2, mid, 0.42);
  drawGlow(ctx, cx, cy, radius * 1.08, core, 0.55);

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

/** Wedge cutaway — ~90° inside the star disk, plasma gradients, on-canvas labels */
function drawWedgeCutaway(ctx, cx, cy, radius, progress, quality, safe) {
  const reveal = smootherstep(0.12, 0.48, progress);
  if (reveal < 0.02) return;

  const a0 = -Math.PI / 4;
  const a1 = Math.PI / 4;
  const midAng = 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.995, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, a0, a1);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = rgba(8, 10, 22, 0.4 * reveal);
  ctx.fillRect(cx, cy - radius, radius + 2, radius * 2);

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
    const g = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
    g.addColorStop(0, rgba(Math.min(255, c.r + 60), Math.min(255, c.g + 50), Math.min(255, c.b + 40), 0.95 * on));
    g.addColorStop(0.55, rgba(c.r, c.g, c.b, 0.78 * on));
    g.addColorStop(1, rgba(Math.max(0, c.r - 40), Math.max(0, c.g - 30), Math.max(0, c.b - 20), 0.55 * on));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(255, 255, 255, 0.28 * on);
    ctx.lineWidth = Math.max(1.5, radius * 0.01);
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 0.995, a0, a1);
    ctx.stroke();
  }

  const feOn = clamp((reveal - 0.5) / 0.3, 0, 1);
  if (feOn > 0) {
    const feR = radius * SHELLS[SHELLS.length - 1].f;
    drawGlow(ctx, cx, cy, feR * 2.0, { r: 255, g: 245, b: 210 }, 0.45 * feOn);
    const fg = ctx.createRadialGradient(cx - feR * 0.25, cy - feR * 0.25, 0, cx, cy, feR);
    fg.addColorStop(0, rgba(255, 255, 255, 0.98 * feOn));
    fg.addColorStop(0.7, rgba(230, 230, 240, 0.9 * feOn));
    fg.addColorStop(1, rgba(180, 180, 200, 0.7 * feOn));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(cx, cy, feR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba(232, 236, 255, 0.5 * reveal);
  ctx.lineWidth = 1.75;
  for (const ang of [a0, a1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * radius * 0.99, cy + Math.sin(ang) * radius * 0.99);
    ctx.stroke();
  }
  ctx.restore();

  const sx = safe?.sx ?? 0;
  const sy = safe?.sy ?? 0;
  const sw = safe?.sw ?? 1280;
  const sh = safe?.sh ?? 800;
  const rightLimit = sx + sw - 10;
  const topLimit = sy + 10;
  const botLimit = sy + sh - 10;
  const fontPx = Math.max(11, Math.min(14, radius * 0.095));
  const wantColX = cx + radius * 0.78;
  const useColumn = wantColX + 36 < rightLimit && radius > 90;

  ctx.save();
  ctx.font = `700 ${fontPx}px Outfit, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  SHELLS.forEach((s, i) => {
    const on = clamp((reveal - i * 0.07) / 0.2, 0, 1);
    if (on < 0.35) return;
    const rOuter = radius * s.f;
    const rInner = i < SHELLS.length - 1 ? radius * SHELLS[i + 1].f : 0;
    const rMid = (rOuter + rInner) * 0.5;
    const ax = cx + Math.cos(midAng) * rMid;
    const ay = cy + Math.sin(midAng) * rMid;

    let lx, ly;
    if (useColumn) {
      lx = Math.min(wantColX, rightLimit - 30);
      const spread = Math.min(radius * 0.9, (SHELLS.length - 1) * (fontPx + 6));
      ly = cy - spread * 0.5 + i * (spread / Math.max(1, SHELLS.length - 1));
    } else {
      const labelAng = -0.12 + i * 0.04;
      lx = cx + Math.cos(labelAng) * Math.min(rMid + fontPx * 0.8, radius * 0.92);
      ly = cy + Math.sin(labelAng) * Math.min(rMid, radius * 0.55);
    }
    lx = clamp(lx, sx + 8, rightLimit - 26);
    ly = clamp(ly, topLimit + fontPx, botLimit - fontPx);

    ctx.globalAlpha = 0.95 * on;
    if (useColumn || Math.hypot(lx - ax, ly - ay) > 10) {
      ctx.strokeStyle = rgba(230, 235, 255, 0.7);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(lx - 2, ly);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(s.c.r, s.c.g, s.c.b, 1);
    ctx.beginPath();
    ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
    ctx.fill();
    const tw = ctx.measureText(s.label).width;
    ctx.fillStyle = rgba(5, 6, 18, 0.75);
    ctx.fillRect(lx - 3, ly - fontPx * 0.55, tw + 10, fontPx * 1.15);
    ctx.fillStyle = "#f0f3ff";
    ctx.fillText(s.label, lx + 1, ly);
  });
  ctx.restore();
}

/** Irregular filamentary remnant — tapered wisps + diffuse emission, not tubes */
function drawFilamentaryRemnant(ctx, w, h, cx, cy, p, quality, radiusScale) {
  const blast = smootherstep(0.46, 0.72, p) * (1 - smootherstep(0.74, 0.88, p));
  if (blast < 0.01) return;
  const R = radiusScale * lerp(0.15, 1.05, smootherstep(0.46, 0.72, p));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 5; i++) {
    const ox = (hash01(i * 2.2) - 0.5) * R * 0.25;
    const oy = (hash01(i * 3.1) - 0.5) * R * 0.2;
    drawGlow(ctx, cx + ox, cy + oy, R * (0.7 + hash01(i) * 0.4), { r: 255, g: 160, b: 70 }, 0.12 * blast);
  }
  drawBloom(ctx, cx, cy, R * 0.45, { r: 255, g: 240, b: 210 }, 0.55 * blast * (1 - blast * 0.4));

  drawGlow(ctx, cx, cy, R * 0.12, WHITE, 0.85 * blast);
  ctx.fillStyle = rgba(255, 250, 240, 0.95 * blast);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, R * 0.025), 0, Math.PI * 2);
  ctx.fill();

  const palette = [
    { r: 255, g: 200, b: 120 },
    { r: 120, g: 200, b: 255 },
    { r: 255, g: 120, b: 90 },
    { r: 180, g: 140, b: 255 },
    { r: 140, g: 255, b: 200 },
  ];

  for (let i = 0; i < Math.floor(lerp(8, 16, quality)); i++) {
    const ang = hash01(i * 4.1 + 9) * Math.PI * 2;
    const d = R * (0.2 + hash01(i * 2) * 0.55);
    drawGlow(ctx, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.85,
      R * (0.15 + hash01(i) * 0.25), palette[i % palette.length], 0.1 * blast);
  }

  const filaments = Math.floor(lerp(28, 55, quality));
  for (let i = 0; i < filaments; i++) {
    const ang = (i / filaments) * Math.PI * 2 + hash01(i) * 0.55;
    const len = R * (0.4 + hash01(i * 3) * 0.65);
    const curl = (hash01(i * 7) - 0.5) * 1.2;
    const col = palette[i % palette.length];
    const baseW = 1.2 + hash01(i * 6) * 4.5;
    const steps = 10;
    const x1 = cx + Math.cos(ang) * R * 0.1;
    const y1 = cy + Math.sin(ang) * R * 0.08;
    const x2 = cx + Math.cos(ang + curl * 0.35) * len;
    const y2 = cy + Math.sin(ang + curl * 0.35) * len * 0.82;
    const cpx = cx + Math.cos(ang + curl) * len * 0.5;
    const cpy = cy + Math.sin(ang + curl) * len * 0.42;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const omt = 1 - t;
      const x = omt * omt * x1 + 2 * omt * t * cpx + t * t * x2;
      const y = omt * omt * y1 + 2 * omt * t * cpy + t * t * y2;
      const taper = Math.pow(1 - t, 1.4);
      drawGlow(ctx, x, y, baseW * taper * 2.2, col, 0.22 * blast * taper);
    }
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, rgba(col.r, col.g, col.b, 0.55 * blast));
    g.addColorStop(1, rgba(col.r, col.g, col.b, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(0.6, baseW * 0.35);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
  }

  for (let i = 0; i < Math.floor(lerp(20, 40, quality)); i++) {
    const ang = hash01(i * 9.2) * Math.PI * 2;
    const len = R * (0.3 + hash01(i * 3.3) * 0.5);
    const col = palette[i % palette.length];
    ctx.strokeStyle = rgba(col.r, col.g, col.b, 0.2 * blast);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * R * 0.15, cy + Math.sin(ang) * R * 0.12);
    ctx.lineTo(cx + Math.cos(ang + 0.3) * len, cy + Math.sin(ang + 0.3) * len * 0.8);
    ctx.stroke();
  }

  const knots = Math.floor(lerp(35, 70, quality));
  for (let i = 0; i < knots; i++) {
    const ang = hash01(i * 1.9 + 3) * Math.PI * 2;
    const d = R * (0.25 + hash01(i * 4.2) * 0.85);
    const x = cx + Math.cos(ang) * d * (0.9 + hash01(i) * 0.25);
    const y = cy + Math.sin(ang) * d * (0.75 + hash01(i * 2) * 0.3);
    drawGlow(ctx, x, y, 5 + hash01(i * 3) * 14, palette[i % palette.length], 0.35 * blast);
  }

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
    const { cx, cy, dim, sx, sy, sw, sh } = stage(view, w, h);
    // Whole-star diameter ≈ 68% of safeContent min dim (room for soft bloom)
    const starR = dim * 0.34;

    drawNebulaBg(ctx, w, h, p, quality);

    const starPhase = 1 - smootherstep(0.46, 0.60, p);
    const heat = smootherstep(0.12, 0.5, p);
    const r = starR * starPhase * lerp(0.55, 1, smootherstep(0, 0.3, p));

    if (starPhase > 0.05 && r > 8) {
      drawMassiveStar(ctx, cx, cy, r, heat, p, quality);
      drawWedgeCutaway(ctx, cx, cy, r, p, quality, { sx, sy, sw, sh });
    }

    drawFilamentaryRemnant(ctx, w, h, cx, cy, p, quality, dim * 0.78);
    drawNSMerger(ctx, w, h, cx, cy, p, quality, dim);

    drawVignette(ctx, w, h, 0.5);
    drawGrain(ctx, w, h, Math.floor(p * 800 + 50), 0.008, quality);
  },
};

export default scene;
