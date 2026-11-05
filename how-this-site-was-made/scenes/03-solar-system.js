/**
 * Chapter 3 — Solar system
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba,
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

function drawNebula(ctx, w, h, p, quality) {
  const str = 1 - smootherstep(0.35, 0.55, p);
  if (str < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const x = w * (0.3 + hash01(i * 1.1) * 0.4);
    const y = h * (0.3 + hash01(i * 2.2) * 0.4);
    drawGlow(ctx, x, y, 150 + i * 40, i % 2 ? { r: 100, g: 80, b: 180 } : { r: 60, g: 120, b: 180 }, 0.14 * str);
  }
  // Collapsing filaments
  const cx = w * 0.5, cy = h * 0.48;
  for (let i = 0; i < Math.floor(20 * quality); i++) {
    const ang = (i / 20) * Math.PI * 2;
    const r0 = Math.max(w, h) * 0.45 * str;
    const r1 = 40 + (1 - str) * 80;
    const g = ctx.createLinearGradient(
      cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.6,
      cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.6
    );
    g.addColorStop(0, rgba(140, 160, 255, 0));
    g.addColorStop(1, rgba(200, 180, 255, 0.25 * str));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.6);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSun(ctx, cx, cy, p) {
  const on = smootherstep(0.18, 0.4, p);
  if (on <= 0) return;
  const r = lerp(8, 36, on);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, cx, cy, r * 5, { r: 255, g: 200, b: 80 }, 0.4 * on);
  drawGlow(ctx, cx, cy, r * 2, { r: 255, g: 240, b: 180 }, 0.6 * on);
  ctx.fillStyle = rgba(255, 250, 230, 0.95 * on);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDisk(ctx, cx, cy, p, quality) {
  const disk = smootherstep(0.3, 0.5, p) * (1 - smootherstep(0.75, 0.95, p) * 0.3);
  if (disk < 0.01) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.28);
  ctx.globalCompositeOperation = "lighter";
  const maxR = Math.min(cx, cy * 3) * 0.85;
  for (let i = 0; i < Math.floor(lerp(8, 20, quality)); i++) {
    const r = maxR * (0.2 + i / 20);
    const a = 0.08 * disk * (1 - i / 22);
    ctx.strokeStyle = rgba(200, 170, 120, a);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Dust clumps
  for (let i = 0; i < Math.floor(40 * quality); i++) {
    const ang = hash01(i * 3) * Math.PI * 2 + p * 0.4;
    const r = maxR * (0.25 + hash01(i * 7) * 0.7);
    ctx.fillStyle = rgba(255, 210, 150, 0.15 * disk);
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlanets(ctx, cx, cy, p, quality) {
  const grow = smootherstep(0.5, 0.75, p);
  if (grow <= 0) return;
  const planets = [
    { orb: 0.22, r: 3, c: { r: 180, g: 180, b: 180 } },
    { orb: 0.32, r: 5, c: { r: 220, g: 180, b: 100 } },
    { orb: 0.42, r: 5.5, c: { r: 80, g: 140, b: 220 } },
    { orb: 0.52, r: 4, c: { r: 200, g: 100, b: 70 } },
    { orb: 0.68, r: 12, c: { r: 220, g: 180, b: 140 } },
    { orb: 0.82, r: 10, c: { r: 230, g: 200, b: 140 } },
  ];
  const maxR = Math.min(cx, cy) * 0.9;
  ctx.save();
  planets.forEach((pl, i) => {
    const on = clamp((grow - i * 0.08) / 0.25, 0, 1);
    if (on <= 0) return;
    const ang = p * (0.6 + i * 0.15) + i;
    const x = cx + Math.cos(ang) * maxR * pl.orb;
    const y = cy + Math.sin(ang) * maxR * pl.orb * 0.28;
    drawGlow(ctx, x, y, pl.r * 4 * on, pl.c, 0.25 * on);
    ctx.fillStyle = rgba(pl.c.r, pl.c.g, pl.c.b, 0.9 * on);
    ctx.beginPath();
    ctx.arc(x, y, pl.r * on, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawMoonImpact(ctx, w, h, cx, cy, p, quality) {
  const imp = smootherstep(0.78, 0.95, p);
  if (imp <= 0) return;
  // Earth
  const ex = cx + 40;
  const ey = cy;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, ex, ey, 50, { r: 60, g: 120, b: 200 }, 0.35 * imp);
  ctx.fillStyle = rgba(70, 130, 200, 0.9 * imp);
  ctx.beginPath();
  ctx.arc(ex, ey, 18, 0, Math.PI * 2);
  ctx.fill();
  // Theia approach / debris
  const sep = lerp(120, 25, smootherstep(0.78, 0.88, p));
  const tx = ex - sep;
  if (sep > 30) {
    ctx.fillStyle = rgba(180, 140, 100, 0.85 * imp);
    ctx.beginPath();
    ctx.arc(tx, ey, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  const debris = smootherstep(0.86, 1.0, p);
  if (debris > 0) {
    drawGlow(ctx, ex, ey, 80 * debris, { r: 255, g: 160, b: 80 }, 0.3 * debris);
    for (let i = 0; i < Math.floor(30 * quality); i++) {
      const ang = hash01(i) * Math.PI * 2;
      const r = 25 + hash01(i * 2) * 90 * debris;
      ctx.fillStyle = rgba(220, 180, 120, 0.4 * debris);
      ctx.beginPath();
      ctx.arc(ex + Math.cos(ang) * r, ey + Math.sin(ang) * r * 0.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Forming Moon
    ctx.fillStyle = rgba(200, 200, 210, 0.7 * debris);
    ctx.beginPath();
    ctx.arc(ex + 55 * debris, ey - 10, 6 * debris, 0, Math.PI * 2);
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
    const cx = w * 0.5;
    const cy = h * 0.48;

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    // Background stars
    for (let i = 0; i < Math.floor(50 * quality); i++) {
      ctx.fillStyle = rgba(200, 210, 255, 0.15 + hash01(i) * 0.4);
      ctx.fillRect(hash01(i * 2) * w, hash01(i * 5 + 1) * h, 1.5, 1.5);
    }

    drawNebula(ctx, w, h, p, quality);
    drawDisk(ctx, cx, cy, p, quality);
    drawSun(ctx, cx, cy, p);
    drawPlanets(ctx, cx, cy, p, quality);
    drawMoonImpact(ctx, w, h, cx, cy, p, quality);

    drawVignette(ctx, w, h, 0.55);
    drawGrain(ctx, w, h, Math.floor(p * 600 + 100), 0.03, quality);
  },
};

export default scene;
