/**
 * Chapter 3 — Solar system (premium)
 * Collapsing nebula with dust lanes, proto-Sun, gapped disk, accretion, Moon impact.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawBloom, drawVignette, drawGrain,
  drawVolumetricHaze, drawStarfield, rgba,
} from "../util.js";

const checkpoints = [
  {
    id: "nebula",
    at: 0.08,
    timeLabel: "about 4.6 billion years ago",
    title: "Solar nebula collapse",
    body: "A portion of a giant molecular cloud — enriched with heavy elements from earlier stars and supernovae — collapses under gravity. Conservation of angular momentum flattens the cloud into a rotating disk surrounding a dense central protostar.",
  },
  {
    id: "sun-ignites",
    at: 0.28,
    timeLabel: "about 4.6 billion years ago",
    title: "The Sun ignites",
    body: "As the protostar's core temperature climbs above about 10 million kelvin, hydrogen fusion begins. The young Sun settles onto the main sequence, flooding the surrounding disk with light and a stellar wind that will eventually clear leftover gas.",
  },
  {
    id: "disk",
    at: 0.48,
    timeLabel: "first few million years of the Solar System",
    title: "Protoplanetary disk",
    body: "Dust grains stick together and settle toward the midplane of the disk. Inside the snow line, rocky materials dominate; farther out, ices are abundant. The disk is the construction site for planets, moons, asteroids, and comets.",
  },
  {
    id: "planets",
    at: 0.68,
    timeLabel: "over roughly the first 10 to 100 million years",
    title: "Planets accrete",
    body: "Planetesimals collide and grow into planetary embryos, then into the terrestrial planets. Beyond the snow line, cores accrete thick hydrogen–helium envelopes to become the gas and ice giants. Dynamical rearrangements reshape orbital spacing.",
  },
  {
    id: "moon",
    at: 0.88,
    timeLabel: "about 4.5 billion years ago",
    title: "Moon-forming impact",
    body: "A Mars-sized body, often called Theia, collides with the proto-Earth in a giant impact. Debris from the mantles of both worlds forms a disk that coalesces into the Moon. The event helps explain the Moon's composition and the angular momentum of the Earth–Moon system.",
  },
];

function stage(view, w, h) {
  const s = view.safeContent;
  if (s && s.w > 40) return { cx: s.cx, cy: s.cy, scale: Math.min(s.w, s.h) };
  return { cx: w * 0.5, cy: h * 0.48, scale: Math.min(w, h) };
}

function drawBg(ctx, w, h, p, quality) {
  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, Math.floor(60 * quality), 30, p * 0.2, 0.5);
}

function drawCollapsingNebula(ctx, w, h, cx, cy, p, quality) {
  const str = 1 - smootherstep(0.28, 0.50, p);
  if (str < 0.01) return;

  drawVolumetricHaze(ctx, w, h, {
    count: Math.floor(lerp(7, 14, quality)),
    seed: 40,
    strength: 0.22 * str,
    color: { r: 120, g: 90, b: 200 },
    progress: p,
  });
  drawVolumetricHaze(ctx, w, h, {
    count: 6,
    seed: 41,
    strength: 0.16 * str,
    color: { r: 80, g: 120, b: 200 },
    progress: p,
  });

  // Dust lanes — dark curved filaments spiraling in
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const lanes = Math.floor(lerp(5, 10, quality));
  for (let i = 0; i < lanes; i++) {
    const ang0 = (i / lanes) * Math.PI * 2 + p * 0.4;
    ctx.strokeStyle = rgba(5, 6, 15, 0.45 * str);
    ctx.lineWidth = 8 + hash01(i) * 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.04) {
      const ang = ang0 + t * 1.8;
      const r = Math.max(w, h) * 0.48 * (1 - t * 0.75) * str + 30;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.42;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Infalling bright filaments
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < lanes; i++) {
    const ang0 = (i / lanes) * Math.PI * 2 + 0.4 + p * 0.3;
    const g = ctx.createLinearGradient(
      cx + Math.cos(ang0) * 200, cy + Math.sin(ang0) * 80,
      cx, cy
    );
    g.addColorStop(0, rgba(160, 180, 255, 0));
    g.addColorStop(1, rgba(200, 190, 255, 0.3 * str));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang0) * Math.max(w, h) * 0.4 * str, cy + Math.sin(ang0) * Math.max(w, h) * 0.18 * str);
    ctx.lineTo(cx + Math.cos(ang0) * 40, cy + Math.sin(ang0) * 18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSun(ctx, cx, cy, p) {
  const on = smootherstep(0.16, 0.40, p) * (1 - smootherstep(0.80, 0.92, p) * 0.85);
  if (on <= 0.01) return;
  const r = lerp(10, 38, Math.min(1, on / 0.5));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawBloom(ctx, cx, cy, r * 4.5, { r: 255, g: 200, b: 90 }, 0.55 * on);
  drawGlow(ctx, cx, cy, r * 1.8, { r: 255, g: 240, b: 190 }, 0.7 * on);
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
  g.addColorStop(0, rgba(255, 252, 240, 0.98 * on));
  g.addColorStop(0.6, rgba(255, 220, 140, 0.95 * on));
  g.addColorStop(1, rgba(255, 180, 80, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProtoDisk(ctx, cx, cy, p, quality, scale) {
  const disk = smootherstep(0.22, 0.48, p) * (1 - smootherstep(0.72, 0.86, p));
  if (disk < 0.01) return;
  const maxR = Math.min(scale * 0.48, Math.min(cx, cy) * 0.95);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.30);
  ctx.globalCompositeOperation = "lighter";

  // Continuous disk gradient (not stepped rings only)
  const dg = ctx.createRadialGradient(0, 0, maxR * 0.08, 0, 0, maxR);
  dg.addColorStop(0, rgba(255, 230, 180, 0.15 * disk));
  dg.addColorStop(0.25, rgba(220, 180, 120, 0.28 * disk));
  dg.addColorStop(0.55, rgba(180, 140, 100, 0.18 * disk));
  dg.addColorStop(0.78, rgba(140, 160, 200, 0.12 * disk));
  dg.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(0, 0, maxR, 0, Math.PI * 2);
  ctx.fill();

  // Gaps (darker annular bands)
  const gaps = [0.38, 0.55, 0.72];
  ctx.globalCompositeOperation = "source-over";
  gaps.forEach((gf, i) => {
    const on = smootherstep(0.40 + i * 0.05, 0.55 + i * 0.05, p);
    ctx.strokeStyle = rgba(5, 6, 15, 0.55 * disk * on);
    ctx.lineWidth = maxR * 0.045;
    ctx.beginPath();
    ctx.arc(0, 0, maxR * gf, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Bright ring edges
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const r = maxR * (0.2 + i * 0.15);
    ctx.strokeStyle = rgba(255, 210, 150, 0.08 * disk);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Planetesimals
  const n = Math.floor(lerp(30, 90, quality) * disk);
  for (let i = 0; i < n; i++) {
    const ang = hash01(i * 3) * Math.PI * 2 + p * (0.3 + hash01(i) * 0.4);
    const r = maxR * (0.22 + hash01(i * 7) * 0.72);
    // Avoid deep gaps a bit
    ctx.fillStyle = rgba(255, 220, 170, 0.35 * disk * (0.4 + hash01(i * 2) * 0.6));
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 1.2 + hash01(i * 5) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlanets(ctx, cx, cy, p, quality, scale) {
  const grow = smootherstep(0.50, 0.78, p) * (1 - smootherstep(0.78, 0.90, p));
  if (grow <= 0.01) return;
  const planets = [
    { orb: 0.20, r: 3.2, c: { r: 180, g: 180, b: 185 } },
    { orb: 0.30, r: 5.2, c: { r: 230, g: 190, b: 120 } },
    { orb: 0.40, r: 5.8, c: { r: 80, g: 145, b: 230 } },
    { orb: 0.50, r: 4.2, c: { r: 210, g: 110, b: 75 } },
    { orb: 0.66, r: 13, c: { r: 230, g: 190, b: 150 } },
    { orb: 0.80, r: 11, c: { r: 235, g: 210, b: 150 } },
  ];
  const maxR = Math.min(scale * 0.48, Math.min(cx, cy) * 0.9);
  ctx.save();
  // Faint orbits
  ctx.strokeStyle = rgba(180, 200, 255, 0.08 * grow);
  ctx.lineWidth = 1;
  planets.forEach((pl) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, maxR * pl.orb, maxR * pl.orb * 0.30, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  planets.forEach((pl, i) => {
    const on = clamp((grow - i * 0.07) / 0.22, 0, 1);
    if (on <= 0) return;
    const ang = p * (0.5 + i * 0.12) + i * 1.1;
    const x = cx + Math.cos(ang) * maxR * pl.orb;
    const y = cy + Math.sin(ang) * maxR * pl.orb * 0.30;
    drawGlow(ctx, x, y, pl.r * 5 * on, pl.c, 0.3 * on);
    ctx.fillStyle = rgba(pl.c.r, pl.c.g, pl.c.b, 0.95 * on);
    ctx.beginPath();
    ctx.arc(x, y, pl.r * on, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawMoonImpact(ctx, w, h, cx, cy, p, quality, scale) {
  const imp = smootherstep(0.76, 0.96, p);
  if (imp <= 0) return;

  const ex = cx + scale * 0.02;
  const ey = cy;
  const earthR = Math.min(28, scale * 0.07);

  ctx.save();
  // Earth body
  drawGlow(ctx, ex, ey, earthR * 3.2, { r: 70, g: 130, b: 210 }, 0.35 * imp);
  const eg = ctx.createRadialGradient(ex - earthR * 0.3, ey - earthR * 0.3, earthR * 0.1, ex, ey, earthR);
  eg.addColorStop(0, rgba(140, 185, 240, 0.98 * imp));
  eg.addColorStop(0.55, rgba(50, 110, 190, 0.98 * imp));
  eg.addColorStop(1, rgba(20, 50, 110, 0.98 * imp));
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(ex, ey, earthR, 0, Math.PI * 2);
  ctx.fill();

  // Theia approaches then merges
  const approach = smootherstep(0.76, 0.87, p);
  const contact = smootherstep(0.86, 0.92, p);
  const sep = lerp(scale * 0.32, earthR * 0.9, approach);
  if (contact < 0.95) {
    const tx = ex - sep;
    const ty = ey - earthR * 0.15;
    const tr = earthR * 0.58;
    drawGlow(ctx, tx, ty, tr * 2.5, { r: 200, g: 150, b: 100 }, 0.3 * imp * (1 - contact));
    ctx.fillStyle = rgba(190, 150, 110, 0.92 * imp * (1 - contact * 0.85));
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Impact bloom + debris ring → Moon
  const debris = smootherstep(0.82, 0.96, p);
  if (debris > 0) {
    ctx.globalCompositeOperation = "lighter";
    drawBloom(ctx, ex - earthR * 0.4, ey, 100 * debris, { r: 255, g: 180, b: 90 }, 0.55 * debris);

    // Debris ring (smooth ellipse strokes)
    for (const [rx, ry, a, lw] of [
      [3.6, 1.2, 0.45, 5],
      [4.2, 1.45, 0.25, 3],
    ]) {
      ctx.strokeStyle = rgba(255, 205, 150, a * debris);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(ex, ey, earthR * rx * debris, earthR * ry * debris, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    const n = Math.floor(55 * quality);
    for (let i = 0; i < n; i++) {
      const ang = hash01(i) * Math.PI * 2 + p * 0.8;
      const rr = earthR * (1.6 + hash01(i * 2) * 4.2) * debris;
      const x = ex + Math.cos(ang) * rr;
      const y = ey + Math.sin(ang) * rr * 0.38;
      drawGlow(ctx, x, y, 4 + hash01(i * 3) * 5, { r: 255, g: 200, b: 140 }, 0.35 * debris * hash01(i + 1));
    }

    // Coalescing Moon
    const moonOn = smootherstep(0.86, 0.96, p);
    const mx = ex + earthR * 4.0 * Math.min(1, debris * 1.05);
    const my = ey - earthR * 0.85;
    drawGlow(ctx, mx, my, 22 * moonOn, { r: 200, g: 205, b: 220 }, 0.45 * moonOn);
    ctx.globalCompositeOperation = "source-over";
    const mg = ctx.createRadialGradient(mx - 2, my - 2, 1, mx, my, 8 * moonOn);
    mg.addColorStop(0, rgba(230, 230, 235, 0.95 * moonOn));
    mg.addColorStop(1, rgba(140, 140, 155, 0.95 * moonOn));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 8 * moonOn, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const scene = {
  id: "solar-system",
  title: "Solar system",
  weight: 1.1,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const { cx, cy, scale } = stage(view, w, h);

    drawBg(ctx, w, h, p, quality);
    drawCollapsingNebula(ctx, w, h, cx, cy, p, quality);
    drawProtoDisk(ctx, cx, cy, p, quality, scale);
    drawSun(ctx, cx, cy, p);
    drawPlanets(ctx, cx, cy, p, quality, scale);
    drawMoonImpact(ctx, w, h, cx, cy, p, quality, scale);

    drawVignette(ctx, w, h, 0.52);
    drawGrain(ctx, w, h, Math.floor(p * 600 + 100), 0.028, quality);
  },
};

export default scene;
