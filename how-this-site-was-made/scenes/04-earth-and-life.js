/**
 * Chapter 4 — Earth and life
 * Premium planetarium visuals. State is a pure function of localProgress.
 * Sections are isolated draw* helpers so eras can be revised independently.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba, mixRgb,
} from "../util.js";

const checkpoints = [
  {
    id: "oceans",
    at: 0.06,
    timeLabel: "by about 4.4 to 4.0 billion years ago",
    title: "Oceans form",
    body: "As Earth cools from a molten Hadean surface, water vapor condenses and liquid oceans accumulate — supplied by outgassing and by volatile-rich impactors. Liquid water provides a medium for chemistry that will later support life. The early atmosphere lacks free oxygen.",
  },
  {
    id: "earliest-life",
    at: 0.16,
    timeLabel: "by about 3.5 to 3.8 billion years ago (possibly earlier)",
    title: "Earliest life",
    body: "Geological and isotopic evidence points to microbial life in the Archean. The first organisms were prokaryotes — cells without nuclei — metabolizing chemical energy in an anoxic world. Layered stromatolites and microbial mats are among the earliest fossil clues.",
  },
  {
    id: "goe",
    at: 0.28,
    timeLabel: "about 2.4 to 2.1 billion years ago",
    title: "Great Oxidation Event",
    body: "Oxygenic photosynthesis by cyanobacteria releases O₂ as a waste product. After sinks such as dissolved iron are saturated, free oxygen accumulates in the atmosphere and oceans — a permanent transformation of Earth's surface chemistry that enables new metabolisms and eventually an ozone shield. Banded iron formations record the transition.",
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
    body: "Lineages evolve cooperation among cells, with division of labor and adhesion. Soft-bodied Ediacaran organisms — fronds, discs, and quilted forms — leave enigmatic fossils. Multicellularity arises more than once across the tree of life.",
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

/** Center art in the area not covered by the placard / scrubber. */
function artCenter(view) {
  const { w, h } = view;
  if (view.safeRect) {
    const r = view.safeRect;
    return { cx: r.x + r.w * 0.5, cy: r.y + r.h * 0.48, aw: r.w, ah: r.h };
  }
  if (w < 700) {
    const top = 300;
    const bottom = 100;
    const ah = Math.max(120, h - top - bottom);
    return { cx: w * 0.5, cy: top + ah * 0.48, aw: w, ah };
  }
  // Desktop: placard ~370×260 top-left — prefer center-right of free zone
  const leftPad = 360;
  const topPad = 60;
  const bottom = 100;
  const aw = Math.max(200, w - leftPad * 0.35);
  const ah = Math.max(160, h - topPad - bottom);
  return {
    cx: lerp(w * 0.52, leftPad + (w - leftPad) * 0.5, 0.55),
    cy: topPad + ah * 0.48,
    aw,
    ah,
  };
}

function softDisc(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color.r, color.g, color.b, a));
  g.addColorStop(0.55, rgba(color.r, color.g, color.b, a * 0.35));
  g.addColorStop(1, rgba(color.r, color.g, color.b, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarfield(ctx, w, h, p, quality) {
  const n = Math.floor(lerp(28, 90, quality));
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 2.5 + 1) * w;
    const y = hash01(i * 4.1 + 3) * h;
    const a = 0.08 + hash01(i * 1.3) * 0.35;
    const r = 0.5 + hash01(i * 7) * 1.4;
    ctx.fillStyle = rgba(190, 210, 255, a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Molten → cooling → ocean Earth with terminator and atmosphere. */
function drawPlanet(ctx, cx, cy, r, p, quality) {
  const molten = 1 - smootherstep(0.0, 0.07, p);
  const ocean = smootherstep(0.01, 0.08, p);
  const ox = smootherstep(0.22, 0.38, p); // oxygenation / sky tint
  const land = smootherstep(0.62, 0.78, p);
  const mammalEra = smootherstep(0.88, 0.98, p);

  ctx.save();

  // Atmosphere rim — thickens and blues with oxygen
  const atmCol = mixRgb({ r: 160, g: 120, b: 70 }, { r: 120, g: 180, b: 255 }, ox);
  const atmA = 0.18 + ocean * 0.22 + ox * 0.18;
  drawGlow(ctx, cx, cy, r * 1.55, atmCol, atmA);
  drawGlow(ctx, cx, cy, r * 2.1, atmCol, atmA * 0.35);

  // Body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (molten > 0.02) {
    // Hadean lava field — smooth radial + soft blotches (no blocky noise)
    const lava = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r);
    lava.addColorStop(0, rgba(255, 220, 140, 1));
    lava.addColorStop(0.35, rgba(255, 120, 40, 1));
    lava.addColorStop(0.7, rgba(160, 40, 20, 1));
    lava.addColorStop(1, rgba(40, 10, 8, 1));
    ctx.globalAlpha = molten;
    ctx.fillStyle = lava;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    const blotchN = Math.floor(lerp(6, 14, quality));
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < blotchN; i++) {
      const ang = hash01(i * 2.2) * Math.PI * 2;
      const d = hash01(i * 3.1) * r * 0.7;
      const bx = cx + Math.cos(ang) * d;
      const by = cy + Math.sin(ang) * d;
      softDisc(ctx, bx, by, r * (0.12 + hash01(i) * 0.18), { r: 255, g: 180, b: 60 }, 0.35 * molten);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  if (ocean > 0.02) {
    // Deep ocean base
    const deep = mixRgb({ r: 18, g: 40, b: 70 }, { r: 15, g: 70, b: 130 }, ox);
    const shallow = mixRgb({ r: 40, g: 90, b: 130 }, { r: 50, g: 140, b: 180 }, ox);
    const og = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    og.addColorStop(0, rgba(shallow.r + 30, shallow.g + 30, shallow.b + 20, ocean));
    og.addColorStop(0.55, rgba(deep.r + 20, deep.g + 30, deep.b + 20, ocean));
    og.addColorStop(1, rgba(deep.r, deep.g, deep.b, ocean));
    ctx.fillStyle = og;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Soft current / depth variation
    const swirlN = Math.floor(lerp(4, 10, quality));
    for (let i = 0; i < swirlN; i++) {
      const ang = hash01(i * 5.5) * Math.PI * 2 + p * 0.3;
      const d = r * (0.2 + hash01(i * 2.1) * 0.55);
      softDisc(
        ctx,
        cx + Math.cos(ang) * d,
        cy + Math.sin(ang) * d * 0.85,
        r * (0.15 + hash01(i * 1.4) * 0.2),
        { r: shallow.r + 40, g: shallow.g + 50, b: shallow.b + 40 },
        0.12 * ocean
      );
    }
  }

  // Continents / landmasses
  if (land > 0.02) {
    const lands = [
      [-0.25, -0.15, 0.38, 0.42, 0.3],
      [0.28, -0.05, 0.3, 0.34, -0.4],
      [-0.05, 0.38, 0.22, 0.2, 0.5],
      [0.42, 0.32, 0.16, 0.18, 0.2],
      [-0.45, 0.2, 0.14, 0.22, -0.6],
    ];
    for (let i = 0; i < lands.length; i++) {
      const [lx, ly, rw, rh, rot] = lands[i];
      const green = mixRgb({ r: 70, g: 110, b: 55 }, { r: 55, g: 130, b: 70 }, ox);
      const desert = { r: 140, g: 120, b: 70 };
      const c = mixRgb(green, desert, hash01(i * 3) * 0.35);
      ctx.fillStyle = rgba(c.r, c.g, c.b, 0.82 * land);
      ctx.beginPath();
      ctx.ellipse(cx + lx * r, cy + ly * r, rw * r, rh * r, rot, 0, Math.PI * 2);
      ctx.fill();
      // Soft highlight edge
      ctx.fillStyle = rgba(c.r + 40, c.g + 40, c.b + 20, 0.18 * land);
      ctx.beginPath();
      ctx.ellipse(cx + lx * r - rw * r * 0.2, cy + ly * r - rh * r * 0.25, rw * r * 0.55, rh * r * 0.45, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Banded iron formations during GOE (layered reddish bands near coasts)
  const bif = smoothstep(0.24, 0.32, p) * (1 - smoothstep(0.38, 0.48, p));
  if (bif > 0.02) {
    for (let i = 0; i < 7; i++) {
      const y = cy - r * 0.35 + i * r * 0.1;
      ctx.strokeStyle = rgba(160, 60, 40, 0.35 * bif);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, y);
      ctx.quadraticCurveTo(cx, y + (i % 2 ? 6 : -6), cx + r * 0.55, y + 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(40, 50, 60, 0.25 * bif);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, y + 3);
      ctx.quadraticCurveTo(cx, y + 3 + (i % 2 ? 4 : -4), cx + r * 0.55, y + 5);
      ctx.stroke();
    }
  }

  // Soft cloud wisps after oxygenation (smooth, not noisy blocks)
  const clouds = smootherstep(0.30, 0.5, p) * ocean;
  if (clouds > 0.05) {
    for (let i = 0; i < 6; i++) {
      const ang = hash01(i * 8.1) * Math.PI * 2 + p * 0.4;
      const d = r * (0.25 + hash01(i * 2.2) * 0.55);
      softDisc(
        ctx,
        cx + Math.cos(ang) * d,
        cy + Math.sin(ang) * d * 0.75,
        r * (0.1 + hash01(i) * 0.12),
        { r: 220, g: 230, b: 245 },
        0.14 * clouds
      );
    }
  }

  // Terminator (day/night soft limb) — slow rotation with progress
  const rot = p * 1.15;
  const termAng = -0.55 + rot * 0.35;
  const tg = ctx.createLinearGradient(
    cx + Math.cos(termAng) * r,
    cy + Math.sin(termAng) * r,
    cx - Math.cos(termAng) * r,
    cy - Math.sin(termAng) * r
  );
  tg.addColorStop(0, rgba(255, 240, 210, 0.12 * ocean));
  tg.addColorStop(0.42, rgba(0, 0, 0, 0));
  tg.addColorStop(0.58, rgba(0, 0, 0, 0));
  tg.addColorStop(1, rgba(0, 5, 20, 0.55));
  ctx.fillStyle = tg;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Specular ocean glint + secondary rim light
  if (ocean > 0.2) {
    softDisc(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.28, { r: 220, g: 240, b: 255 }, 0.28 * ocean);
    softDisc(ctx, cx + r * 0.25, cy + r * 0.15, r * 0.18, { r: 100, g: 160, b: 200 }, 0.12 * ocean);
    // Fine sparkle band on lit limb
    for (let i = 0; i < 8; i++) {
      const ang = -2.2 + i * 0.18;
      softDisc(
        ctx,
        cx + Math.cos(ang) * r * 0.82,
        cy + Math.sin(ang) * r * 0.82,
        3 + hash01(i) * 3,
        { r: 200, g: 230, b: 255 },
        0.2 * ocean
      );
    }
  }

  ctx.restore();

  // Thin atmosphere limb stroke
  ctx.save();
  ctx.strokeStyle = rgba(atmCol.r, atmCol.g, atmCol.b, 0.35 + ox * 0.25);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Reducing-atmosphere amber haze early
  const haze = (1 - smootherstep(0.18, 0.36, p)) * ocean;
  if (haze > 0.02) {
    softDisc(ctx, cx, cy, r * 1.15, { r: 190, g: 140, b: 70 }, 0.14 * haze);
  }

  // Soft cityless mammal-era warmth (post K–Pg diversification cue)
  if (mammalEra > 0.02) {
    softDisc(ctx, cx + r * 0.15, cy - r * 0.1, r * 0.9, { r: 100, g: 160, b: 120 }, 0.08 * mammalEra);
  }
}

/** Gentle impact sparks during early Hadean. */
function drawImpacts(ctx, cx, cy, r, p, quality) {
  const era = (1 - smootherstep(0.0, 0.12, p)) * smootherstep(0.0, 0.04, p);
  if (era < 0.01) return;
  const n = Math.floor(lerp(3, 8, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const birth = hash01(i * 4.2);
    const life = clamp((p * 8 - birth * 3) % 1.2, 0, 1);
    const flash = Math.sin(life * Math.PI) * era;
    if (flash < 0.02) continue;
    const ang = hash01(i * 1.7) * Math.PI * 2;
    const d = r * (0.7 + hash01(i * 2.9) * 0.45);
    const x = cx + Math.cos(ang) * d;
    const y = cy + Math.sin(ang) * d;
    drawGlow(ctx, x, y, 18 + flash * 28, { r: 255, g: 180, b: 80 }, 0.45 * flash);
    drawGlow(ctx, x, y, 8, { r: 255, g: 240, b: 200 }, 0.55 * flash);
  }
  ctx.restore();
}

/** Zoom toward stromatolites / microbial mats. */
function drawStromatolites(ctx, cx, cy, r, p, quality) {
  const show = smoothstep(0.10, 0.17, p) * (1 - smoothstep(0.20, 0.26, p));
  if (show < 0.01) return;
  // Gentle zoom: mats grow from shoreline
  const zoom = smootherstep(0.12, 0.20, p);
  const baseY = cy + r * lerp(0.55, 0.15, zoom);
  const scale = lerp(0.55, 1.15, zoom);
  ctx.save();
  ctx.globalAlpha = show;
  const mats = Math.floor(lerp(4, 9, quality));
  for (let i = 0; i < mats; i++) {
    const x = cx + (i - (mats - 1) / 2) * r * 0.22 * scale + Math.sin(i + p) * 4;
    const h = r * (0.12 + hash01(i * 2) * 0.1) * scale;
    const w = r * (0.08 + hash01(i * 3) * 0.05) * scale;
    // Layered dome
    for (let layer = 0; layer < 5; layer++) {
      const t = layer / 5;
      ctx.fillStyle = rgba(
        60 + layer * 18,
        100 + layer * 12,
        80 + layer * 8,
        0.55 - t * 0.08
      );
      ctx.beginPath();
      ctx.ellipse(x, baseY - h * t * 0.85, w * (1 - t * 0.25), h * 0.35 * (1 - t * 0.2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft bioluminescent rim (subtle)
    softDisc(ctx, x, baseY - h * 0.5, w * 1.4, { r: 80, g: 200, b: 140 }, 0.12 * show);
  }
  // Water surface line
  ctx.strokeStyle = rgba(140, 200, 220, 0.25 * show);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.9, baseY + 4);
  ctx.quadraticCurveTo(cx, baseY - 2, cx + r * 0.9, baseY + 6);
  ctx.stroke();
  ctx.restore();
}

/** Eukaryotic cell with nucleus + mitochondria. */
function drawEukaryote(ctx, cx, cy, r, p, quality) {
  const show = smoothstep(0.34, 0.42, p) * (1 - smoothstep(0.48, 0.56, p));
  if (show < 0.01) return;
  const s = r * 0.85;
  const x = cx + r * 0.05;
  const y = cy;
  ctx.save();
  ctx.globalAlpha = show;
  ctx.globalCompositeOperation = "lighter";
  softDisc(ctx, x, y, s * 1.3, { r: 140, g: 200, b: 255 }, 0.2);
  ctx.globalCompositeOperation = "source-over";

  // Membrane + cytoplasm depth
  const mem = ctx.createRadialGradient(x - s * 0.25, y - s * 0.3, s * 0.08, x, y, s);
  mem.addColorStop(0, rgba(200, 235, 250, 0.55));
  mem.addColorStop(0.35, rgba(120, 180, 210, 0.45));
  mem.addColorStop(0.7, rgba(60, 120, 170, 0.5));
  mem.addColorStop(1, rgba(25, 55, 100, 0.65));
  ctx.fillStyle = mem;
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.78, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // Cytoplasm granules
  for (let i = 0; i < 10; i++) {
    const ang = hash01(i * 2.4) * Math.PI * 2;
    const d = s * (0.2 + hash01(i * 1.5) * 0.45);
    softDisc(
      ctx,
      x + Math.cos(ang) * d,
      y + Math.sin(ang) * d * 0.75,
      s * (0.04 + hash01(i) * 0.05),
      { r: 160, g: 210, b: 230 },
      0.25 * show
    );
  }
  ctx.strokeStyle = rgba(180, 230, 255, 0.55);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.78, 0.15, 0, Math.PI * 2);
  ctx.stroke();
  // Outer halo membrane
  ctx.strokeStyle = rgba(140, 200, 255, 0.2);
  ctx.lineWidth = 6;
  ctx.stroke();

  // Nucleus
  softDisc(ctx, x - s * 0.1, y - s * 0.05, s * 0.32, { r: 120, g: 100, b: 180 }, 0.55);
  ctx.fillStyle = rgba(90, 70, 140, 0.7);
  ctx.beginPath();
  ctx.ellipse(x - s * 0.1, y - s * 0.05, s * 0.22, s * 0.18, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Nucleolus
  ctx.fillStyle = rgba(200, 180, 255, 0.6);
  ctx.beginPath();
  ctx.arc(x - s * 0.08, y - s * 0.04, s * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Mitochondria
  const mitos = Math.floor(lerp(3, 6, quality));
  for (let i = 0; i < mitos; i++) {
    const ang = (i / mitos) * Math.PI * 2 + p * 0.8;
    const md = s * (0.4 + hash01(i) * 0.15);
    const mx = x + Math.cos(ang) * md;
    const my = y + Math.sin(ang) * md * 0.75;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang + 0.5);
    ctx.fillStyle = rgba(255, 140, 80, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cristae hint
    ctx.strokeStyle = rgba(255, 200, 140, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.07, 0);
    ctx.lineTo(s * 0.07, 0);
    ctx.stroke();
    ctx.restore();
    softDisc(ctx, mx, my, s * 0.18, { r: 255, g: 160, b: 80 }, 0.2 * show);
  }
  ctx.restore();
}

/** Ediacaran fronds. */
function drawEdiacaran(ctx, cx, cy, r, p, quality) {
  const show = smoothstep(0.46, 0.52, p) * (1 - smoothstep(0.54, 0.58, p));
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  const seafloor = cy + r * 0.55;
  // Soft sand
  softDisc(ctx, cx, seafloor + 20, r * 1.4, { r: 80, g: 70, b: 50 }, 0.25);

  const fronds = [
    [-0.55, 0.9, 0.02],
    [-0.2, 1.15, -0.1],
    [0.15, 1.0, 0.08],
    [0.5, 0.85, -0.05],
  ];
  for (let i = 0; i < fronds.length; i++) {
    const [ox, sc, sway] = fronds[i];
    const x = cx + ox * r;
    const h = r * 0.55 * sc;
    const swayAmt = Math.sin(p * 3 + i) * 8 * sway; // slow, progress-tied
    ctx.strokeStyle = rgba(160, 200, 170, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, seafloor);
    ctx.quadraticCurveTo(x + swayAmt, seafloor - h * 0.5, x + swayAmt * 1.4, seafloor - h);
    ctx.stroke();
    // Quilted segments
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const t = (s + 0.5) / segs;
      const sy = seafloor - h * t;
      const sx = x + swayAmt * t * 1.4;
      const half = (1 - t * 0.3) * r * 0.1 * sc;
      ctx.fillStyle = rgba(140, 190, 160, 0.35);
      ctx.beginPath();
      ctx.ellipse(sx, sy, half, half * 0.55, swayAmt * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(200, 230, 200, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Disc-shaped forms
  for (let i = 0; i < 3; i++) {
    const dx = cx + (hash01(i * 9) - 0.5) * r * 1.2;
    const dy = seafloor - 8 - hash01(i * 2) * 10;
    softDisc(ctx, dx, dy, 12 + hash01(i) * 8, { r: 150, g: 170, b: 140 }, 0.35 * show);
  }
  ctx.restore();
}

/** Cambrian seafloor diorama with silhouettes. */
function drawCambrian(ctx, cx, cy, r, p, quality) {
  const show = smoothstep(0.54, 0.64, p) * (1 - smoothstep(0.70, 0.80, p) * 0.85);
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;

  const floorY = cy + r * 0.55;
  // Soft water volume (no hard rectangle)
  softDisc(ctx, cx, cy + r * 0.1, r * 2.4, { r: 10, g: 40, b: 80 }, 0.55);
  softDisc(ctx, cx, cy - r * 0.15, r * 1.7, { r: 40, g: 110, b: 180 }, 0.22);
  softDisc(ctx, cx - r * 0.3, cy - r * 0.4, r * 1.0, { r: 100, g: 180, b: 230 }, 0.12);
  const water = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy + r * 0.3, r * 2.2);
  water.addColorStop(0, rgba(60, 130, 190, 0.18));
  water.addColorStop(0.55, rgba(15, 50, 90, 0.35));
  water.addColorStop(1, rgba(5, 15, 30, 0));
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.05, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Seafloor
  softDisc(ctx, cx, floorY + 30, r * 1.8, { r: 60, g: 50, b: 35 }, 0.5);
  ctx.fillStyle = rgba(70, 55, 40, 0.6);
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.5, floorY + 50);
  ctx.quadraticCurveTo(cx, floorY - 10, cx + r * 1.5, floorY + 40);
  ctx.lineTo(cx + r * 1.5, floorY + 80);
  ctx.lineTo(cx - r * 1.5, floorY + 80);
  ctx.fill();

  // Soft caustic light rays
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < Math.floor(lerp(3, 7, quality)); i++) {
    const x0 = cx + (hash01(i * 3) - 0.5) * r * 1.8;
    const g = ctx.createLinearGradient(x0, cy - r * 0.5, x0 + 20, floorY);
    g.addColorStop(0, rgba(120, 200, 255, 0));
    g.addColorStop(0.5, rgba(120, 200, 255, 0.08 * show));
    g.addColorStop(1, rgba(120, 200, 255, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 12, cy - r * 0.5, 24, r * 1.5);
  }
  ctx.restore();

  // Trilobite silhouettes
  function trilobite(x, y, sc, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -sc : sc, sc);
    ctx.fillStyle = rgba(20, 30, 40, 0.75);
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head shield
    ctx.beginPath();
    ctx.ellipse(-14, 0, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Segments
    for (let s = 0; s < 5; s++) {
      ctx.beginPath();
      ctx.ellipse(-4 + s * 5, 0, 4, 10 - s * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spines
    ctx.strokeStyle = rgba(20, 30, 40, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(-28, -14);
    ctx.moveTo(-18, 8);
    ctx.lineTo(-28, 14);
    ctx.stroke();
    ctx.restore();
  }

  trilobite(cx - r * 0.55, floorY - 18, 1.1, false);
  trilobite(cx - r * 0.15, floorY - 10, 0.85, true);
  trilobite(cx + r * 0.25, floorY - 22, 1.0, false);
  trilobite(cx + r * 0.55, floorY - 8, 0.7, true);
  trilobite(cx - r * 0.75, floorY - 6, 0.55, false);

  // Soft shelly debris / small fauna on floor
  for (let i = 0; i < 14; i++) {
    const sx = cx + (hash01(i * 3.3) - 0.5) * r * 2.2;
    const sy = floorY - 2 - hash01(i * 1.7) * 10;
    softDisc(ctx, sx, sy, 3 + hash01(i) * 4, { r: 100, g: 140, b: 150 }, 0.25 * show);
  }

  // Distant soft reef mounds
  for (let i = 0; i < 4; i++) {
    const rx = cx - r * 0.9 + i * r * 0.55;
    softDisc(ctx, rx, floorY - 5, 28 + i * 4, { r: 40, g: 70, b: 60 }, 0.2 * show);
  }

  // Anomalocaris silhouette (swimming)
  const ax = cx + r * 0.4 + Math.sin(p * 4) * 12;
  const ay = cy - r * 0.15 + Math.cos(p * 3) * 6;
  ctx.save();
  ctx.translate(ax, ay);
  softDisc(ctx, 0, 0, 55, { r: 60, g: 100, b: 140 }, 0.2 * show);
  ctx.fillStyle = rgba(15, 25, 35, 0.78);
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 17, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Tail fan
  ctx.beginPath();
  ctx.moveTo(38, 0);
  ctx.lineTo(62, -20);
  ctx.lineTo(52, 0);
  ctx.lineTo(62, 20);
  ctx.closePath();
  ctx.fill();
  // Grasping appendages
  ctx.strokeStyle = rgba(15, 25, 35, 0.75);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-32, -4);
  ctx.quadraticCurveTo(-50, -18, -58, -8);
  ctx.moveTo(-32, 4);
  ctx.quadraticCurveTo(-50, 18, -58, 8);
  ctx.stroke();
  // Side lobes
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = show * 0.45;
    ctx.beginPath();
    ctx.ellipse(-10 + i * 8, 12, 6, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-10 + i * 8, -12, 6, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Early chordate / Pikaia-like ribbon
  const chx = cx - r * 0.3;
  const chy = cy + r * 0.15;
  ctx.strokeStyle = rgba(30, 50, 60, 0.65);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(chx - 40, chy);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    ctx.lineTo(chx - 40 + t * 80, chy + Math.sin(t * Math.PI * 3 + p * 5) * 6);
  }
  ctx.stroke();
  // Notochord highlight
  ctx.strokeStyle = rgba(180, 220, 230, 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chx - 40, chy);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    ctx.lineTo(chx - 40 + t * 80, chy + Math.sin(t * Math.PI * 3 + p * 5) * 6);
  }
  ctx.stroke();

  // Floating plankton dots
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < Math.floor(lerp(8, 20, quality)); i++) {
    const px = cx + (hash01(i * 1.1) - 0.5) * r * 2;
    const py = cy + (hash01(i * 2.2) - 0.5) * r * 1.2;
    softDisc(ctx, px, py, 3 + hash01(i) * 4, { r: 100, g: 200, b: 220 }, 0.2 * show);
  }
  ctx.restore();
}

/** Life on land: plants + tetrapod. */
function drawLandLife(ctx, cx, cy, r, p, quality) {
  const show = smoothstep(0.66, 0.76, p) * (1 - smootherstep(0.80, 0.88, p));
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  const ground = cy + r * 0.55;

  // Ground
  softDisc(ctx, cx, ground + 40, r * 1.6, { r: 50, g: 70, b: 40 }, 0.35);
  ctx.fillStyle = rgba(55, 80, 45, 0.55);
  ctx.beginPath();
  ctx.ellipse(cx, ground + 20, r * 1.3, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Early plants / cooksonia-like stalks and later fern silhouettes
  const plants = Math.floor(lerp(5, 12, quality));
  for (let i = 0; i < plants; i++) {
    const x = cx + (hash01(i * 4) - 0.5) * r * 1.8;
    const h = r * (0.25 + hash01(i * 2) * 0.45);
    const verdancy = smootherstep(0.68, 0.78, p);
    ctx.strokeStyle = rgba(60, 120, 70, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.quadraticCurveTo(x + (hash01(i) - 0.5) * 10, ground - h * 0.5, x, ground - h);
    ctx.stroke();
    // Frond / sporangia
    if (verdancy > 0.3) {
      ctx.fillStyle = rgba(80, 150, 90, 0.6 * verdancy);
      ctx.beginPath();
      ctx.ellipse(x, ground - h, 8 + hash01(i * 3) * 10, 5 + hash01(i) * 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Small terminal sporangia
      ctx.fillStyle = rgba(120, 140, 70, 0.7);
      ctx.beginPath();
      ctx.arc(x, ground - h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tetrapod silhouette emerging
  const tet = smootherstep(0.72, 0.82, p);
  if (tet > 0.02) {
    const tx = cx + r * 0.35;
    const ty = ground - 8;
    ctx.globalAlpha = show * tet;
    ctx.fillStyle = rgba(40, 35, 30, 0.8);
    // Body
    ctx.beginPath();
    ctx.ellipse(tx, ty, 28, 12, -0.15, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.ellipse(tx - 28, ty - 4, 12, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    [[-12, 8], [8, 8], [-18, 6], [14, 6]].forEach(([lx, ly], i) => {
      ctx.beginPath();
      ctx.moveTo(tx + lx, ty + 4);
      ctx.lineTo(tx + lx + (i < 2 ? -4 : 4), ty + ly + 10);
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(40, 35, 30, 0.8);
      ctx.stroke();
    });
    // Tail
    ctx.beginPath();
    ctx.moveTo(tx + 24, ty);
    ctx.quadraticCurveTo(tx + 45, ty + 4, tx + 55, ty - 2);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/** Gentle K–Pg impact + dust, then mammal dots. */
function drawKPg(ctx, cx, cy, r, p, quality) {
  const impact = smootherstep(0.80, 0.90, p);
  const after = smootherstep(0.88, 0.98, p);
  if (impact < 0.01) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Incoming body — soft, no harsh flash
  const ix = cx + r * 0.7 - impact * r * 0.15;
  const iy = cy - r * 0.55 + impact * r * 0.25;
  const glow = Math.sin(clamp(impact, 0, 1) * Math.PI) * 0.7 + after * 0.15;
  drawGlow(ctx, ix, iy, 40 + glow * 50, { r: 255, g: 190, b: 100 }, 0.35 * glow);
  drawGlow(ctx, ix, iy, 18, { r: 255, g: 230, b: 180 }, 0.4 * glow);
  softDisc(ctx, ix, iy, 6, { r: 255, g: 255, b: 240 }, 0.7 * glow);

  // Dust veil (gentle, not a white flash)
  ctx.globalCompositeOperation = "source-over";
  const dust = smoothstep(0.84, 0.92, p) * (1 - smootherstep(0.94, 1.0, p) * 0.5);
  if (dust > 0.01) {
    softDisc(ctx, cx, cy, r * 1.6, { r: 80, g: 60, b: 40 }, 0.28 * dust);
    softDisc(ctx, cx, cy - r * 0.2, r * 2.2, { r: 50, g: 40, b: 30 }, 0.18 * dust);
  }
  ctx.restore();

  // Mammals diversifying — soft warm points on land
  if (after > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const n = Math.floor(lerp(4, 12, quality));
    for (let i = 0; i < n; i++) {
      const ang = hash01(i * 2.7) * Math.PI * 2;
      const d = r * (0.35 + hash01(i * 1.5) * 0.45);
      const x = cx + Math.cos(ang) * d;
      const y = cy + Math.sin(ang) * d * 0.7;
      const on = clamp((after - hash01(i) * 0.4) / 0.4, 0, 1);
      drawGlow(ctx, x, y, 10, { r: 255, g: 200, b: 140 }, 0.35 * on);
    }
    ctx.restore();
  }
}

function drawOxygenSky(ctx, w, h, cx, cy, r, p) {
  const ox = smootherstep(0.22, 0.4, p);
  if (ox < 0.01) return;
  // Soft sky wash beyond the planet
  const g = ctx.createRadialGradient(cx, cy, r * 1.1, cx, cy, Math.max(w, h) * 0.55);
  g.addColorStop(0, rgba(100, 170, 255, 0.08 * ox));
  g.addColorStop(0.5, rgba(60, 100, 180, 0.05 * ox));
  g.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const scene = {
  id: "earth-and-life",
  title: "Earth and life",
  weight: 1.4,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const { cx, cy, ah } = artCenter(view);
    const r = Math.min(w * 0.28, ah * 0.38, 210);

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);
    drawStarfield(ctx, w, h, p, quality);

    // Close-up eras dim the globe so dioramas read clearly
    const closeUp =
      smoothstep(0.12, 0.18, p) * (1 - smoothstep(0.20, 0.26, p)) +
      smoothstep(0.34, 0.42, p) * (1 - smoothstep(0.48, 0.56, p)) +
      smoothstep(0.46, 0.52, p) * (1 - smoothstep(0.54, 0.58, p)) +
      smoothstep(0.54, 0.64, p) * (1 - smoothstep(0.70, 0.80, p)) +
      smoothstep(0.66, 0.76, p) * (1 - smootherstep(0.80, 0.88, p));
    const planetAlpha = 1 - clamp(closeUp, 0, 0.92);

    drawOxygenSky(ctx, w, h, cx, cy, r, p);
    if (planetAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = planetAlpha;
      drawPlanet(ctx, cx, cy, r, p, quality);
      drawImpacts(ctx, cx, cy, r, p, quality);
      ctx.restore();
    }
    drawStromatolites(ctx, cx, cy, r, p, quality);
    drawEukaryote(ctx, cx, cy, r, p, quality);
    drawEdiacaran(ctx, cx, cy, r, p, quality);
    drawCambrian(ctx, cx, cy, r, p, quality);
    drawLandLife(ctx, cx, cy, r, p, quality);
    drawKPg(ctx, cx, cy, r, p, quality);

    drawVignette(ctx, w, h, 0.52);
    drawGrain(ctx, w, h, Math.floor(p * 700 + 200), 0.028, quality);
  },
};

export default scene;
