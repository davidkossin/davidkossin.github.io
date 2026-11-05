/**
 * Chapter 5 — Humans
 * Globe with migration, agriculture centers, cities, writing, printing.
 * State is a pure function of localProgress.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba, mixRgb,
} from "../util.js";

const checkpoints = [
  {
    id: "sapiens",
    at: 0.08,
    timeLabel: "about 300,000 years ago",
    title: "Homo sapiens",
    body: "Anatomically modern humans emerge in Africa. Fossil and genetic evidence place early Homo sapiens around 300,000 years ago. Cognitive and cultural capacities continue to evolve alongside other hominin populations that later go extinct.",
  },
  {
    id: "dispersal",
    at: 0.24,
    timeLabel: "major expansions from about 70,000 to 15,000 years ago",
    title: "Global dispersal",
    body: "Groups of Homo sapiens spread out of Africa into Eurasia, Australia, and eventually the Americas, adapting to climates from rainforests to tundra. They encounter and, in some regions, interbreed with Neanderthals and Denisovans. Routes followed coasts and inland corridors as ice ages waxed and waned.",
  },
  {
    id: "agriculture",
    at: 0.42,
    timeLabel: "beginning about 12,000 to 10,000 years ago",
    title: "Agriculture",
    body: "In multiple independent centers — including the Fertile Crescent, China, Mesoamerica, the Andes, New Guinea, the Sahel and Ethiopia, and eastern North America — people domesticate plants and animals. Farming supports denser populations and stored surplus, reshaping labor, property, and disease ecology.",
  },
  {
    id: "cities",
    at: 0.58,
    timeLabel: "from about 6,000 to 5,000 years ago onward",
    title: "Cities",
    body: "Urban settlements arise with specialized labor, monumental architecture, and long-distance trade. Cities concentrate innovation and inequality alike, and become hubs of states and empires that reorganize landscapes and peoples. Night lights begin to mark human density from orbit — a metaphor here for growing urban glow.",
  },
  {
    id: "writing",
    at: 0.72,
    timeLabel: "from about 5,400 to 5,000 years ago (earliest cuneiform)",
    title: "Writing",
    body: "Accounting tokens and pictographs develop into true writing systems capable of recording language. Mesopotamian cuneiform and Egyptian hieroglyphs are among the earliest. Writing enables administration, literature, law, and knowledge that outlasts a single generation’s memory.",
  },
  {
    id: "printing",
    at: 0.88,
    timeLabel: "movable type in East Asia earlier; Gutenberg press in Europe about 1450 CE",
    title: "Printing press",
    body: "Mechanical reproduction of text multiplies the reach of ideas. Movable type appears in East Asia centuries before Gutenberg’s European press accelerates literacy, scientific correspondence, and religious and political upheaval. Information begins to scale in a new way.",
  },
];

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
  const leftPad = 360;
  const topPad = 60;
  const bottom = 100;
  const ah = Math.max(160, h - topPad - bottom);
  return {
    cx: lerp(w * 0.52, leftPad + (w - leftPad) * 0.5, 0.55),
    cy: topPad + ah * 0.48,
    aw: Math.max(200, w - leftPad * 0.35),
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

/** Equirectangular-ish lon/lat → disc (simple orthographic-like). */
function lonLatToXY(lon, lat, cx, cy, r, rot) {
  const lam = ((lon - rot) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  // Orthographic facing longitude `rot`
  const x = Math.cos(phi) * Math.sin(lam);
  const y = -Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lam);
  return { x: cx + x * r, y: cy + y * r, visible: z > -0.05, z };
}

function drawStarfield(ctx, w, h, quality) {
  const n = Math.floor(lerp(24, 80, quality));
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rgba(190, 210, 255, 0.1 + hash01(i) * 0.35);
    ctx.beginPath();
    ctx.arc(hash01(i * 3) * w, hash01(i * 7) * h, 0.5 + hash01(i * 2) * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGlobe(ctx, cx, cy, r, p, night) {
  ctx.save();
  // Atmosphere
  drawGlow(ctx, cx, cy, r * 1.55, { r: 80, g: 140, b: 220 }, 0.28);
  drawGlow(ctx, cx, cy, r * 2.0, { r: 100, g: 160, b: 255 }, 0.1);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Ocean
  const ocean = night
    ? ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
    : ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  if (night) {
    ocean.addColorStop(0, rgba(30, 50, 90, 1));
    ocean.addColorStop(1, rgba(8, 15, 35, 1));
  } else {
    ocean.addColorStop(0, rgba(90, 160, 210, 1));
    ocean.addColorStop(0.55, rgba(35, 90, 160, 1));
    ocean.addColorStop(1, rgba(15, 40, 90, 1));
  }
  ctx.fillStyle = ocean;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Schematic continents — layered ellipses for softer coastlines
  const lands = [
    { lon: 20, lat: 8, parts: [[0.20,0.34,0.05],[0.12,0.18,0.4,-0.08,0.12],[0.1,0.14,-0.3,0.12,0.05]] },
    { lon: 12, lat: 50, parts: [[0.16,0.12,0.2],[0.1,0.08,-0.12,0.08]] },
    { lon: 90, lat: 40, parts: [[0.38,0.24,-0.15],[0.22,0.18,0.25,0.1],[0.14,0.12,0.35,-0.12]] },
    { lon: 135, lat: -25, parts: [[0.14,0.1,0.1],[0.08,0.06,0.1,0.06]] },
    { lon: -100, lat: 45, parts: [[0.24,0.26,0.25],[0.14,0.16,-0.12,0.1],[0.1,0.12,0.18,-0.14]] },
    { lon: -60, lat: -12, parts: [[0.13,0.28,-0.12],[0.09,0.14,0.08,0.12]] },
    { lon: 25, lat: -25, parts: [[0.08,0.1,0.1]] }, // southern Africa tip cue
  ];
  const rot = 15 + p * 25; // slow rotation with progress
  for (const L of lands) {
    const base = lonLatToXY(L.lon, L.lat, cx, cy, r, rot);
    if (!base.visible) continue;
    const shade = night ? rgba(28, 52, 38, 0.88) : rgba(68, 125, 72, 0.84);
    const hi = night ? rgba(40, 70, 50, 0.35) : rgba(110, 160, 90, 0.28);
    for (const part of L.parts) {
      const [rw, rh, rotA, ox = 0, oy = 0] = part;
      const sc = 0.65 + 0.35 * base.z;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(base.x + ox * r, base.y + oy * r, rw * r * sc, rh * r * sc, rotA || 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(base.x + ox * r - rw * r * 0.15, base.y + oy * r - rh * r * 0.2, rw * r * sc * 0.45, rh * r * sc * 0.4, rotA || 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Terminator / night side
  if (!night) {
    const tg = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    tg.addColorStop(0, rgba(255, 240, 210, 0.1));
    tg.addColorStop(0.45, rgba(0, 0, 0, 0));
    tg.addColorStop(0.7, rgba(0, 5, 20, 0.35));
    tg.addColorStop(1, rgba(0, 5, 25, 0.65));
    ctx.fillStyle = tg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else {
    // Soft limb light
    softDisc(ctx, cx - r * 0.4, cy - r * 0.35, r * 0.5, { r: 100, g: 140, b: 200 }, 0.12);
  }

  ctx.restore();

  // Atmosphere limb
  ctx.strokeStyle = rgba(140, 190, 255, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Migration routes out of Africa — approximate, dated by draw-progress.
 * Coordinates are schematic lon/lat on the rotating globe.
 */
const MIGRATION_ROUTES = [
  // North Africa / Levant corridor ~70–50 ka
  { pts: [[20, 5], [30, 20], [35, 32], [40, 38]], start: 0.14, end: 0.28, label: "Levant" },
  // Into Europe
  { pts: [[35, 32], [20, 42], [10, 48], [0, 50]], start: 0.18, end: 0.34, label: "Europe" },
  // South Asia / coastal
  { pts: [[35, 25], [55, 22], [75, 15], [95, 10]], start: 0.16, end: 0.32, label: "S Asia" },
  // SE Asia → Australia
  { pts: [[95, 10], [110, 5], [125, -5], [135, -20]], start: 0.20, end: 0.36, label: "Sahul" },
  // Siberia → Beringia → Americas
  { pts: [[100, 50], [140, 60], [170, 65], [-150, 60], [-120, 50], [-100, 40]], start: 0.26, end: 0.42, label: "Americas" },
  // South America continuation
  { pts: [[-100, 20], [-80, 5], [-70, -15], [-65, -35]], start: 0.34, end: 0.48, label: "S America" },
];

function drawMigration(ctx, cx, cy, r, p, quality) {
  const disp = smootherstep(0.12, 0.40, p) * (1 - smootherstep(0.40, 0.52, p));
  if (disp < 0.01) return;
  const rot = 15 + p * 25;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Origin glow in East Africa
  const origin = lonLatToXY(36, 5, cx, cy, r, rot);
  if (origin.visible) {
    drawGlow(ctx, origin.x, origin.y, 16, { r: 255, g: 210, b: 100 }, 0.45 * disp);
    ctx.fillStyle = rgba(255, 230, 160, 0.9 * disp);
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const route of MIGRATION_ROUTES) {
    const on = smoothstep(route.start, route.end, p);
    if (on < 0.01) continue;
    const pts = [];
    for (const [lon, lat] of route.pts) {
      const pt = lonLatToXY(lon, lat, cx, cy, r, rot);
      if (pt.visible) pts.push(pt);
    }
    if (pts.length < 2) continue;
    // Draw path up to `on` fraction
    const segs = pts.length - 1;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < segs; i++) {
      const segOn = clamp((on * segs - i), 0, 1);
      if (segOn <= 0) break;
      const a = pts[i];
      const b = pts[i + 1];
      const x1 = a.x;
      const y1 = a.y;
      const x2 = lerp(a.x, b.x, segOn);
      const y2 = lerp(a.y, b.y, segOn);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, rgba(255, 200, 100, 0.15 * disp));
      g.addColorStop(1, rgba(255, 180, 80, 0.55 * disp * segOn));
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (segOn > 0.95) {
        drawGlow(ctx, b.x, b.y, 8, { r: 255, g: 200, b: 100 }, 0.35 * on);
      }
    }
  }
  ctx.restore();
}

/** Independent agriculture centers — glowing points (shape+brightness, colorblind-safe). */
const AGRI_CENTERS = [
  { lon: 42, lat: 34, name: "Fertile Crescent", at: 0.0 },
  { lon: 115, lat: 32, name: "China", at: 0.08 },
  { lon: -98, lat: 18, name: "Mesoamerica", at: 0.16 },
  { lon: -75, lat: -12, name: "Andes", at: 0.22 },
  { lon: 145, lat: -6, name: "New Guinea", at: 0.28 },
  { lon: 10, lat: 14, name: "Sahel", at: 0.34 },
  { lon: 38, lat: 9, name: "Ethiopia", at: 0.38 },
  { lon: -85, lat: 38, name: "E. N. America", at: 0.42 },
];

function drawAgriculture(ctx, cx, cy, r, p, quality) {
  const agr = smootherstep(0.34, 0.52, p);
  if (agr < 0.01) return;
  const rot = 15 + p * 25;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < AGRI_CENTERS.length; i++) {
    const c = AGRI_CENTERS[i];
    const on = clamp((agr - c.at) / 0.25, 0, 1);
    if (on <= 0) continue;
    const pt = lonLatToXY(c.lon, c.lat, cx, cy, r, rot);
    if (!pt.visible) continue;
    // Diamond marker (shape cue) + warm glow (brightness cue)
    drawGlow(ctx, pt.x, pt.y, 20 + on * 12, { r: 120, g: 220, b: 140 }, 0.5 * on);
    drawGlow(ctx, pt.x, pt.y, 8, { r: 255, g: 240, b: 180 }, 0.65 * on);
    ctx.fillStyle = rgba(240, 255, 210, 0.95 * on);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - 6);
    ctx.lineTo(pt.x + 5, pt.y);
    ctx.lineTo(pt.x, pt.y + 6);
    ctx.lineTo(pt.x - 5, pt.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(255, 255, 255, 0.55 * on);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCityLights(ctx, cx, cy, r, p, quality) {
  const city = smootherstep(0.50, 0.70, p);
  if (city < 0.01) return;
  const rot = 15 + p * 25;
  // Schematic urban clusters
  const cities = [
    [30, 30], [15, 48], [30, 40], [77, 28], [116, 40], [139, 35],
    [-74, 40], [-87, 41], [-118, 34], [-99, 19], [-58, -34], [-46, -23],
    [31, 30], [3, 48], [12, 42], [37, 55], [151, -33], [72, 19],
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = Math.floor(lerp(8, cities.length, quality));
  for (let i = 0; i < n; i++) {
    const [lon, lat] = cities[i];
    const on = clamp((city - hash01(i * 2) * 0.35) / 0.5, 0, 1);
    if (on <= 0) continue;
    const pt = lonLatToXY(lon, lat, cx, cy, r, rot);
    if (!pt.visible) continue;
    drawGlow(ctx, pt.x, pt.y, 7 + on * 6, { r: 255, g: 210, b: 120 }, 0.45 * on);
    ctx.fillStyle = rgba(255, 230, 170, 0.85 * on);
    ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
  }
  // Soft network of faint links between nearby lights
  if (quality > 0.45 && city > 0.4) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (hash01(i * 20 + j) > 0.18) continue;
        const a = lonLatToXY(cities[i][0], cities[i][1], cx, cy, r, rot);
        const b = lonLatToXY(cities[j][0], cities[j][1], cx, cy, r, rot);
        if (!a.visible || !b.visible) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy > r * r * 0.45) continue;
        ctx.strokeStyle = rgba(255, 200, 120, 0.08 * city);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Cuneiform-inspired wedge glyphs. */
function drawWriting(ctx, w, h, cx, cy, r, p, quality) {
  const wr = smootherstep(0.64, 0.80, p) * (1 - smootherstep(0.84, 0.95, p) * 0.5);
  if (wr < 0.01) return;
  ctx.save();
  ctx.globalAlpha = wr;

  // Clay tablet
  const tw = Math.min(200, r * 1.1);
  const th = tw * 0.7;
  const tx = cx + r * 0.85;
  const ty = cy - r * 0.1;
  // Keep on screen
  const x = clamp(tx, tw * 0.6, w - tw * 0.6);
  const y = clamp(ty, th * 0.7, h - 120);

  softDisc(ctx, x, y, tw * 0.8, { r: 180, g: 140, b: 80 }, 0.15);
  ctx.fillStyle = rgba(160, 120, 70, 0.85);
  roundRect(ctx, x - tw / 2, y - th / 2, tw, th, 8);
  ctx.fill();
  ctx.strokeStyle = rgba(100, 70, 40, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wedge marks appearing with progress
  const glyphs = Math.floor(lerp(8, 24, quality));
  const typeOn = smootherstep(0.68, 0.82, p);
  ctx.fillStyle = rgba(50, 30, 15, 0.75);
  for (let i = 0; i < glyphs; i++) {
    if (i / glyphs > typeOn) break;
    const col = i % 6;
    const row = (i / 6) | 0;
    const gx = x - tw * 0.35 + col * (tw * 0.12);
    const gy = y - th * 0.28 + row * (th * 0.2);
    // Triangular wedge
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 8, gy + 2);
    ctx.lineTo(gx + 1, gy + 5);
    ctx.closePath();
    ctx.fill();
    // Vertical stroke
    if (hash01(i) > 0.4) {
      ctx.fillRect(gx + 9, gy, 2, 7);
    }
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawPress(ctx, w, h, cx, cy, r, p, quality) {
  const pr = smootherstep(0.80, 0.96, p);
  if (pr < 0.01) return;
  ctx.save();
  ctx.globalAlpha = pr;

  const px = cx;
  const py = cy + r * 0.15;

  // Press frame
  softDisc(ctx, px, py, 90, { r: 160, g: 140, b: 255 }, 0.12);
  ctx.fillStyle = rgba(40, 35, 55, 0.9);
  ctx.fillRect(px - 50, py - 35, 100, 70);
  ctx.strokeStyle = rgba(180, 170, 220, 0.5);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px - 50, py - 35, 100, 70);

  // Platen
  ctx.fillStyle = rgba(70, 60, 90, 0.95);
  ctx.fillRect(px - 40, py - 18, 80, 10);
  // Screw
  ctx.fillStyle = rgba(160, 160, 180, 0.8);
  ctx.fillRect(px - 4, py - 50, 8, 35);
  ctx.beginPath();
  ctx.arc(px, py - 52, 10, 0, Math.PI * 2);
  ctx.fill();

  // Type block
  ctx.fillStyle = rgba(30, 25, 40, 0.95);
  ctx.fillRect(px - 28, py - 4, 56, 22);
  // Letters as tiny rectangles
  ctx.fillStyle = rgba(220, 220, 240, 0.7);
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(px - 24 + (i % 6) * 8, py + ((i / 6) | 0) * 8, 5, 6);
  }

  // Radiating pages
  ctx.globalCompositeOperation = "lighter";
  const pages = Math.floor(lerp(6, 14, quality));
  for (let i = 0; i < pages; i++) {
    const ang = (i / pages) * Math.PI * 2 + p * 0.5;
    const dist = 70 + hash01(i) * 40;
    const on = clamp((pr - i / pages * 0.4) / 0.5, 0, 1);
    const x = px + Math.cos(ang) * dist * on;
    const y = py + Math.sin(ang) * dist * 0.7 * on;
    ctx.fillStyle = rgba(230, 230, 245, 0.18 * on);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang * 0.3);
    ctx.fillRect(-9, -12, 18, 24);
    ctx.restore();
  }
  ctx.restore();
}

const scene = {
  id: "humans",
  title: "Humans",
  weight: 1.15,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const { cx, cy, ah } = artCenter(view);
    const r = Math.min(w * 0.26, ah * 0.36, 195);

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);
    drawStarfield(ctx, w, h, quality);

    // Day → night transition as cities emerge (single blended draw)
    const night = smootherstep(0.48, 0.65, p);
    if (night < 0.05) {
      drawGlobe(ctx, cx, cy, r, p, false);
    } else if (night > 0.95) {
      drawGlobe(ctx, cx, cy, r, p, true);
    } else {
      ctx.save();
      ctx.globalAlpha = 1 - night;
      drawGlobe(ctx, cx, cy, r, p, false);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = night;
      drawGlobe(ctx, cx, cy, r, p, true);
      ctx.restore();
    }

    drawMigration(ctx, cx, cy, r, p, quality);
    drawAgriculture(ctx, cx, cy, r, p, quality);
    drawCityLights(ctx, cx, cy, r, p, quality);

    // Writing and press overlay (fade globe slightly)
    const overlay = smootherstep(0.62, 0.78, p);
    if (overlay > 0.01) {
      ctx.save();
      ctx.globalAlpha = 1 - overlay * 0.45;
      // globe already drawn; overlays on top
      ctx.restore();
    }
    drawWriting(ctx, w, h, cx, cy, r, p, quality);
    drawPress(ctx, w, h, cx, cy, r, p, quality);

    drawVignette(ctx, w, h, 0.52);
    drawGrain(ctx, w, h, Math.floor(p * 500 + 300), 0.028, quality);
  },
};

export default scene;
