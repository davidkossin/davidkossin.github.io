/**
 * Chapter 3 — Solar system (v3 planetarium)
 * Large subjects, dusty spiral disk, snow line, gaps + shepherds, jets, Moon impact.
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
  if (s && s.w > 40 && s.h > 40) {
    return { cx: s.cx, cy: s.cy, dim: Math.min(s.w, s.h) };
  }
  return { cx: w * 0.55, cy: h * 0.48, dim: Math.min(w, h) * 0.7 };
}

function drawBg(ctx, w, h, p, quality) {
  ctx.fillStyle = "#060714";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, Math.floor(100 * quality), 30, p * 0.15, 0.55);
  // Rich purple/teal wash so it's never empty black
  drawVolumetricHaze(ctx, w, h, {
    count: Math.floor(lerp(5, 10, quality)),
    seed: 33,
    strength: 0.12,
    color: { r: 50, g: 40, b: 110 },
    progress: p * 0.3,
  });
}

function drawCollapsingNebula(ctx, w, h, cx, cy, p, quality, dim) {
  const str = 1 - smootherstep(0.26, 0.48, p);
  if (str < 0.01) return;

  drawVolumetricHaze(ctx, w, h, {
    count: Math.floor(lerp(10, 18, quality)),
    seed: 40,
    strength: 0.28 * str,
    color: { r: 130, g: 90, b: 210 },
    progress: p,
  });
  drawVolumetricHaze(ctx, w, h, {
    count: 8,
    seed: 41,
    strength: 0.18 * str,
    color: { r: 70, g: 130, b: 210 },
    progress: p,
  });

  // Dust lanes spiraling in
  ctx.save();
  const lanes = Math.floor(lerp(6, 12, quality));
  for (let i = 0; i < lanes; i++) {
    const ang0 = (i / lanes) * Math.PI * 2 + p * 0.5;
    ctx.strokeStyle = rgba(8, 10, 24, 0.5 * str);
    ctx.lineWidth = 10 + hash01(i) * 18;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.03) {
      const ang = ang0 + t * 2.2;
      const r = dim * 1.1 * (1 - t * 0.78) * str + dim * 0.08;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.4;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < lanes; i++) {
    const ang0 = (i / lanes) * Math.PI * 2 + 0.35 + p * 0.35;
    ctx.strokeStyle = rgba(200, 190, 255, 0.22 * str);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang0) * dim * 1.05 * str, cy + Math.sin(ang0) * dim * 0.42 * str);
    ctx.lineTo(cx + Math.cos(ang0) * dim * 0.12, cy + Math.sin(ang0) * dim * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function drawJets(ctx, cx, cy, p, dim) {
  // Faint tapered bipolar jets — fully faded before the disk checkpoint
  const jets = smoothstep(0.10, 0.22, p) * (1 - smootherstep(0.30, 0.42, p));
  if (jets < 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const dir of [-1, 1]) {
    const len = dim * 0.55 * jets;
    const steps = 12;
    for (let s = 0; s < steps; s++) {
      const t = s / (steps - 1);
      const y = cy + dir * len * t;
      const taper = Math.pow(1 - t, 1.6);
      const wobble = Math.sin(t * 9 + dir) * dim * 0.008;
      drawGlow(ctx, cx + wobble, y, (3.5 + 8 * taper) * jets, { r: 160, g: 210, b: 255 }, 0.16 * jets * taper);
      if (s % 3 === 1) {
        drawGlow(ctx, cx + wobble, y, 6 * jets * taper, { r: 200, g: 230, b: 255 }, 0.22 * jets * taper);
      }
    }
  }
  ctx.restore();
}

function drawSun(ctx, cx, cy, p, dim) {
  const on = smootherstep(0.14, 0.38, p) * (1 - smootherstep(0.80, 0.92, p) * 0.85);
  if (on < 0.01) return;
  const r = dim * 0.1 * lerp(0.5, 1, Math.min(1, on / 0.6));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawBloom(ctx, cx, cy, r * 5, { r: 255, g: 200, b: 90 }, 0.6 * on);
  drawGlow(ctx, cx, cy, r * 2, { r: 255, g: 240, b: 190 }, 0.75 * on);
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
  g.addColorStop(0, rgba(255, 252, 240, 0.98 * on));
  g.addColorStop(0.55, rgba(255, 220, 140, 0.95 * on));
  g.addColorStop(1, rgba(255, 180, 80, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProtoDisk(ctx, cx, cy, p, quality, dim) {
  const disk = smootherstep(0.18, 0.45, p) * (1 - smootherstep(0.72, 0.86, p));
  if (disk < 0.01) return;
  const maxR = dim * 0.72;
  const snowLine = 0.48;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.32);

  const dg = ctx.createRadialGradient(0, 0, maxR * 0.06, 0, 0, maxR);
  dg.addColorStop(0, rgba(255, 230, 170, 0.2 * disk));
  dg.addColorStop(snowLine * 0.85, rgba(230, 170, 100, 0.38 * disk));
  dg.addColorStop(snowLine, rgba(200, 200, 230, 0.32 * disk));
  dg.addColorStop(0.78, rgba(150, 180, 230, 0.22 * disk));
  dg.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(0, 0, maxR, 0, Math.PI * 2);
  ctx.fill();

  // Soft dusty spiral structure — overlapping glows, not paper cutouts
  ctx.globalCompositeOperation = "lighter";
  const arms = 3;
  for (let a = 0; a < arms; a++) {
    for (let t = 0; t <= 1; t += 0.028) {
      const ang = a * ((Math.PI * 2) / arms) + t * 3.5 + p * 0.5;
      const r = maxR * (0.18 + t * 0.75);
      const j = 1 + (hash01(a * 10 + Math.floor(t * 30)) - 0.5) * 0.04;
      const x = Math.cos(ang) * r * j;
      const y = Math.sin(ang) * r * j;
      const icy = r > maxR * snowLine;
      const col = icy ? { r: 170, g: 200, b: 255 } : { r: 255, g: 200, b: 140 };
      drawGlow(ctx, x, y, maxR * 0.07, col, 0.055 * disk * (1 - t * 0.35));
    }
  }

  // Soft dusty density clumps
  const clumps = Math.floor(lerp(30, 70, quality) * disk);
  for (let i = 0; i < clumps; i++) {
    const ang = hash01(i * 3) * Math.PI * 2 + p * 0.35;
    const r = maxR * (0.18 + hash01(i * 7) * 0.75);
    const icy = r > maxR * snowLine;
    const col = icy ? { r: 180, g: 210, b: 255 } : { r: 255, g: 200, b: 140 };
    drawGlow(ctx, Math.cos(ang) * r, Math.sin(ang) * r,
      4 + hash01(i * 5) * 10, col, 0.1 * disk);
  }

  // Soft gaps + shepherds
  const gaps = [
    { f: 0.36, shepherd: true },
    { f: 0.55, shepherd: true },
    { f: 0.72, shepherd: false },
  ];
  ctx.globalCompositeOperation = "source-over";
  gaps.forEach((g, i) => {
    const on = smootherstep(0.38 + i * 0.04, 0.52 + i * 0.04, p);
    ctx.strokeStyle = rgba(4, 6, 14, 0.35 * disk * on);
    ctx.lineWidth = maxR * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, maxR * g.f, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(4, 6, 14, 0.18 * disk * on);
    ctx.lineWidth = maxR * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, maxR * g.f, 0, Math.PI * 2);
    ctx.stroke();
    if (g.shepherd && on > 0.3) {
      const ang = p * (0.8 + i * 0.3) + i * 2;
      const x = Math.cos(ang) * maxR * g.f;
      const y = Math.sin(ang) * maxR * g.f;
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, x, y, 14, { r: 255, g: 220, b: 160 }, 0.45 * on * disk);
      ctx.fillStyle = rgba(255, 230, 180, 0.9 * on * disk);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  });

  // Soft snow-line hint
  ctx.strokeStyle = rgba(200, 220, 255, 0.14 * disk);
  ctx.setLineDash([4, 10]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, maxR * snowLine, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, 0, 0, maxR * 1.05, { r: 255, g: 200, b: 140 }, 0.07 * disk);

  ctx.restore();
}

function drawPlanets(ctx, cx, cy, p, quality, dim) {
  const grow = smootherstep(0.48, 0.78, p) * (1 - smootherstep(0.78, 0.90, p));
  if (grow < 0.01) return;
  const planets = [
    { orb: 0.18, r: 4, c: { r: 180, g: 180, b: 185 } },
    { orb: 0.28, r: 6.5, c: { r: 230, g: 190, b: 120 } },
    { orb: 0.38, r: 7, c: { r: 80, g: 145, b: 230 } },
    { orb: 0.48, r: 5, c: { r: 210, g: 110, b: 75 } },
    { orb: 0.64, r: 16, c: { r: 230, g: 190, b: 150 } },
    { orb: 0.78, r: 13, c: { r: 235, g: 210, b: 150 } },
  ];
  const maxR = dim * 0.7;
  ctx.save();
  ctx.strokeStyle = rgba(180, 200, 255, 0.1 * grow);
  ctx.lineWidth = 1;
  planets.forEach((pl) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, maxR * pl.orb, maxR * pl.orb * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  planets.forEach((pl, i) => {
    const on = clamp((grow - i * 0.06) / 0.22, 0, 1);
    if (on <= 0) return;
    const ang = p * (0.45 + i * 0.12) + i * 1.1;
    const x = cx + Math.cos(ang) * maxR * pl.orb;
    const y = cy + Math.sin(ang) * maxR * pl.orb * 0.32;
    drawGlow(ctx, x, y, pl.r * 5 * on, pl.c, 0.35 * on);
    ctx.fillStyle = rgba(pl.c.r, pl.c.g, pl.c.b, 0.95 * on);
    ctx.beginPath();
    ctx.arc(x, y, pl.r * on, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawMoonImpact(ctx, cx, cy, p, quality, dim) {
  const imp = smootherstep(0.76, 0.96, p);
  if (imp <= 0) return;
  const ex = cx;
  const ey = cy;
  const earthR = dim * 0.16;

  ctx.save();
  drawGlow(ctx, ex, ey, earthR * 3.5, { r: 70, g: 130, b: 210 }, 0.4 * imp);
  const eg = ctx.createRadialGradient(ex - earthR * 0.3, ey - earthR * 0.3, earthR * 0.1, ex, ey, earthR);
  eg.addColorStop(0, rgba(140, 185, 240, 0.98 * imp));
  eg.addColorStop(0.5, rgba(50, 110, 190, 0.98 * imp));
  eg.addColorStop(1, rgba(20, 50, 110, 0.98 * imp));
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(ex, ey, earthR, 0, Math.PI * 2);
  ctx.fill();

  const approach = smootherstep(0.76, 0.86, p);
  const contact = smootherstep(0.84, 0.90, p);
  const sep = lerp(dim * 0.38, earthR * 0.95, approach);
  if (contact < 0.92) {
    const tx = ex - sep;
    const ty = ey - earthR * 0.12;
    const tr = earthR * 0.55;
    drawGlow(ctx, tx, ty, tr * 2.8, { r: 200, g: 150, b: 100 }, 0.35 * imp * (1 - contact));
    ctx.fillStyle = rgba(190, 150, 110, 0.95 * imp * (1 - contact * 0.8));
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }

  const debris = smootherstep(0.82, 0.96, p);
  if (debris > 0) {
    ctx.globalCompositeOperation = "lighter";
    drawBloom(ctx, ex - earthR * 0.35, ey, earthR * 3.5 * debris, { r: 255, g: 180, b: 90 }, 0.55 * debris);

    // Debris ring — irregular, clumpy
    for (let ring = 0; ring < 2; ring++) {
      const segs = 40;
      ctx.strokeStyle = rgba(255, 200, 140, (0.4 - ring * 0.12) * debris);
      ctx.lineWidth = 4 - ring;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const ang = t * Math.PI * 2 - 0.4;
        const j = 0.92 + 0.15 * hash01(i + ring * 20);
        const rx = earthR * (3.2 + ring * 0.55) * debris * j;
        const ry = earthR * (1.1 + ring * 0.2) * debris * j;
        const x = ex + Math.cos(ang) * rx;
        const y = ey + Math.sin(ang) * ry;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    const n = Math.floor(70 * quality);
    for (let i = 0; i < n; i++) {
      const ang = hash01(i) * Math.PI * 2 + p;
      const rr = earthR * (1.5 + hash01(i * 2) * 4.5) * debris;
      const x = ex + Math.cos(ang) * rr;
      const y = ey + Math.sin(ang) * rr * 0.38;
      drawGlow(ctx, x, y, 4 + hash01(i * 3) * 6, { r: 255, g: 200, b: 140 }, 0.4 * debris * hash01(i + 1));
    }

    const moonOn = smootherstep(0.86, 0.97, p);
    const mx = ex + earthR * 4.2 * Math.min(1, debris * 1.05);
    const my = ey - earthR * 0.9;
    drawGlow(ctx, mx, my, 28 * moonOn, { r: 200, g: 205, b: 220 }, 0.5 * moonOn);
    ctx.globalCompositeOperation = "source-over";
    const mg = ctx.createRadialGradient(mx - 3, my - 3, 1, mx, my, 10 * moonOn);
    mg.addColorStop(0, rgba(230, 230, 235, 0.95 * moonOn));
    mg.addColorStop(1, rgba(140, 140, 155, 0.95 * moonOn));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 10 * moonOn, 0, Math.PI * 2);
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
    const { cx, cy, dim } = stage(view, w, h);

    drawBg(ctx, w, h, p, quality);
    drawCollapsingNebula(ctx, w, h, cx, cy, p, quality, dim);
    drawJets(ctx, cx, cy, p, dim); // behind disk — faint, gone by disk checkpoint
    drawProtoDisk(ctx, cx, cy, p, quality, dim);
    drawSun(ctx, cx, cy, p, dim);
    drawPlanets(ctx, cx, cy, p, quality, dim);
    drawMoonImpact(ctx, cx, cy, p, quality, dim);

    drawVignette(ctx, w, h, 0.48);
    drawGrain(ctx, w, h, Math.floor(p * 600 + 100), 0.008, quality);
  },
};

export default scene;
