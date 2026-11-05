/**
 * Chapter 4 — Earth and life
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01, fbm,
  drawGlow, drawVignette, drawGrain, rgba, mixRgb,
} from "../util.js";

const checkpoints = [
  {
    id: "oceans",
    at: 0.06,
    timeLabel: "by about 4.4 to 4.0 billion years ago",
    title: "Oceans form",
    body: "As Earth cools, water vapor condenses and liquid oceans accumulate — supplied by outgassing and by volatile-rich impactors. Liquid water provides a medium for chemistry that will later support life. The early atmosphere lacks free oxygen.",
  },
  {
    id: "earliest-life",
    at: 0.16,
    timeLabel: "by about 3.5 to 3.8 billion years ago (possibly earlier)",
    title: "Earliest life",
    body: "Geological and isotopic evidence points to microbial life in the Archean. The first organisms were prokaryotes — cells without nuclei — metabolizing chemical energy in an anoxic world. Stromatolites and carbon isotope ratios are among the clues.",
  },
  {
    id: "goe",
    at: 0.28,
    timeLabel: "about 2.4 to 2.1 billion years ago",
    title: "Great Oxidation Event",
    body: "Oxygenic photosynthesis by cyanobacteria releases O₂ as a waste product. After sinks such as dissolved iron are saturated, free oxygen accumulates in the atmosphere and oceans — a permanent transformation of Earth's surface chemistry that enables new metabolisms and eventually an ozone shield.",
  },
  {
    id: "eukaryotes",
    at: 0.40,
    timeLabel: "by about 1.8 to 1.5 billion years ago (estimates vary)",
    title: "Eukaryotic cells",
    body: "Cells with nuclei and internal organelles appear. Mitochondria — descendants of once free-living bacteria — power these cells through endosymbiosis. Eukaryotes open evolutionary paths toward larger genomes and complex multicellular bodies.",
  },
  {
    id: "multicellular",
    at: 0.50,
    timeLabel: "from roughly 600 million years ago and earlier experiments",
    title: "Multicellular life",
    body: "Lineages evolve cooperation among cells, with division of labor and adhesion. Soft-bodied Ediacaran organisms leave enigmatic fossils. Multicellularity arises more than once across the tree of life.",
  },
  {
    id: "cambrian",
    at: 0.60,
    timeLabel: "about 540 to 520 million years ago",
    title: "Cambrian explosion",
    body: "In a geologically short interval, most major animal body plans appear in the fossil record — arthropods, chordates, mollusks, and others. Eyes, shells, and active predation become widespread. Rising oxygen and ecological feedbacks likely contributed.",
  },
  {
    id: "land",
    at: 0.72,
    timeLabel: "plants from about 470 Myr ago; tetrapods by about 360 Myr ago",
    title: "Life on land",
    body: "Plants, fungi, and invertebrates colonize terrestrial habitats, followed by vertebrate tetrapods. Forests reshape soils and the carbon cycle. Amniote eggs free some vertebrates from returning to water to reproduce.",
  },
  {
    id: "extinctions",
    at: 0.86,
    timeLabel: "five major mass extinctions; K–Pg at 66 million years ago",
    title: "Mass extinctions, including K–Pg",
    body: "Recurring crises reset ecosystems. The end-Cretaceous (K–Pg) extinction, linked to a large asteroid impact at Chicxulub and to Deccan volcanism, eliminates non-avian dinosaurs and many other groups. Mammals and birds diversify in the aftermath.",
  },
];

function drawEarth(ctx, cx, cy, r, p, quality) {
  // Planet base
  const ocean = smootherstep(0.0, 0.12, p);
  const ox = smootherstep(0.22, 0.35, p); // oxygenation tint
  const land = smootherstep(0.65, 0.8, p);

  ctx.save();
  // Atmosphere glow
  drawGlow(ctx, cx, cy, r * 1.8, { r: 80, g: 140, b: 220 }, 0.2 + ox * 0.15);
  // Body
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  const deep = mixRgb({ r: 20, g: 40, b: 80 }, { r: 20, g: 80, b: 160 }, ocean);
  const surface = mixRgb(deep, { r: 40, g: 120, b: 180 }, ox * 0.4);
  g.addColorStop(0, rgba(surface.r + 40, surface.g + 40, surface.b + 30, 1));
  g.addColorStop(1, rgba(surface.r, surface.g, surface.b, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Continents hint
  if (land > 0.05) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      const ang = hash01(i * 2.2) * Math.PI * 2;
      const dist = hash01(i * 3.1) * r * 0.6;
      const lx = cx + Math.cos(ang) * dist;
      const ly = cy + Math.sin(ang) * dist;
      ctx.fillStyle = rgba(80, 140, 70, 0.55 * land);
      ctx.beginPath();
      ctx.ellipse(lx, ly, r * 0.25 * hash01(i), r * 0.15, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Early haze / reducing atmosphere
  const haze = 1 - smootherstep(0.2, 0.4, p);
  if (haze > 0.05) {
    ctx.fillStyle = rgba(180, 140, 80, 0.12 * haze);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLifeSparks(ctx, cx, cy, r, p, quality) {
  const life = smootherstep(0.12, 0.25, p);
  if (life < 0.01) return;
  const n = Math.floor(lerp(8, 28, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const ang = hash01(i * 1.7) * Math.PI * 2 + p * 0.5;
    const dist = r * (0.7 + hash01(i * 4) * 0.5);
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const on = clamp((life - hash01(i) * 0.5) / 0.5, 0, 1);
    drawGlow(ctx, x, y, 8, { r: 100, g: 220, b: 160 }, 0.25 * on);
  }
  ctx.restore();
}

function drawOxygenBurst(ctx, cx, cy, r, p) {
  const goe = smoothstep(0.24, 0.34, p) * (1 - smoothstep(0.36, 0.48, p));
  if (goe < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, cx, cy, r * 2.2, { r: 120, g: 200, b: 255 }, 0.25 * goe);
  drawGlow(ctx, cx, cy, r * 3.0, { r: 180, g: 220, b: 255 }, 0.12 * goe);
  ctx.restore();
}

function drawCambrianBurst(ctx, w, h, cx, cy, p, quality) {
  const burst = smoothstep(0.55, 0.68, p) * (1 - smoothstep(0.7, 0.82, p) * 0.5);
  if (burst < 0.01) return;
  const n = Math.floor(lerp(10, 30, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + p;
    const dist = 80 + hash01(i) * 100;
    const x = cx + Math.cos(ang) * dist * burst;
    const y = cy + Math.sin(ang) * dist * 0.7 * burst;
    const c = hash01(i * 3) > 0.5 ? { r: 100, g: 200, b: 255 } : { r: 255, g: 180, b: 100 };
    drawGlow(ctx, x, y, 14, c, 0.3 * burst);
  }
  ctx.restore();
}

function drawImpact(ctx, cx, cy, r, p, quality) {
  const kpg = smootherstep(0.80, 0.92, p);
  if (kpg < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const ix = cx + r * 0.55;
  const iy = cy - r * 0.35;
  drawGlow(ctx, ix, iy, 60 * kpg, { r: 255, g: 200, b: 80 }, 0.5 * kpg);
  drawGlow(ctx, ix, iy, 120 * kpg, { r: 255, g: 100, b: 40 }, 0.25 * kpg);
  // Dust veil
  ctx.fillStyle = rgba(60, 40, 30, 0.25 * kpg);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const scene = {
  id: "earth-and-life",
  title: "Earth and life",
  weight: 1.4,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const cx = w * 0.5;
    const cy = h * 0.48;
    const r = Math.min(w, h) * 0.22;

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    // Soft space dust
    for (let i = 0; i < Math.floor(40 * quality); i++) {
      ctx.fillStyle = rgba(180, 200, 255, 0.1 + hash01(i) * 0.25);
      ctx.fillRect(hash01(i * 2.5) * w, hash01(i * 4.1) * h, 1.2, 1.2);
    }

    drawEarth(ctx, cx, cy, r, p, quality);
    drawLifeSparks(ctx, cx, cy, r, p, quality);
    drawOxygenBurst(ctx, cx, cy, r, p);
    drawCambrianBurst(ctx, w, h, cx, cy, p, quality);
    drawImpact(ctx, cx, cy, r, p, quality);

    // Era color wash at edges
    const wash = ctx.createRadialGradient(cx, cy, r, cx, cy, Math.max(w, h) * 0.6);
    const green = smootherstep(0.65, 0.85, p);
    wash.addColorStop(0, rgba(0, 0, 0, 0));
    wash.addColorStop(1, rgba(20, 40 + green * 40, 30, 0.35));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    drawVignette(ctx, w, h, 0.55);
    drawGrain(ctx, w, h, Math.floor(p * 700 + 200), 0.03, quality);
  },
};

export default scene;
