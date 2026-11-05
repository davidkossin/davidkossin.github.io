/**
 * Chapter 5 — Humans
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba,
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
    body: "Groups of Homo sapiens spread out of Africa and into Eurasia, Australia, and eventually the Americas, adapting to climates from rainforests to tundra. They encounter and, in some regions, interbreed with Neanderthals and Denisovans.",
  },
  {
    id: "agriculture",
    at: 0.42,
    timeLabel: "beginning about 12,000 to 10,000 years ago",
    title: "Agriculture",
    body: "In multiple independent centers, people domesticate plants and animals. Farming supports denser populations and stored surplus, but also new labor regimes, property concepts, and zoonotic disease. The Holocene climate stability helps make sedentary life viable.",
  },
  {
    id: "cities",
    at: 0.58,
    timeLabel: "from about 6,000 to 5,000 years ago onward",
    title: "Cities",
    body: "Urban settlements arise with specialized labor, monumental architecture, and long-distance trade. Cities concentrate innovation and inequality alike, and become hubs of states and empires that reorganize landscapes and peoples.",
  },
  {
    id: "writing",
    at: 0.72,
    timeLabel: "from about 5,400 to 5,000 years ago (earliest cuneiform)",
    title: "Writing",
    body: "Accounting tokens and pictographs develop into true writing systems capable of recording language. Writing enables administration, literature, law, and the accumulation of knowledge across generations far beyond oral memory alone.",
  },
  {
    id: "printing",
    at: 0.88,
    timeLabel: "movable type in East Asia earlier; Gutenberg press in Europe about 1450 CE",
    title: "Printing press",
    body: "Mechanical reproduction of text multiplies the reach of ideas. In Europe, the Gutenberg press accelerates literacy, scientific correspondence, and religious and political upheaval. Information begins to scale in a new way.",
  },
];

function drawGlobe(ctx, cx, cy, r, p) {
  ctx.save();
  drawGlow(ctx, cx, cy, r * 1.6, { r: 60, g: 120, b: 200 }, 0.25);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, rgba(90, 150, 210, 1));
  g.addColorStop(1, rgba(25, 55, 110, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Simple continent blobs
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const lands = [
    [ -0.2, -0.1, 0.35, 0.4 ],
    [ 0.25, 0.0, 0.28, 0.32 ],
    [ -0.05, 0.35, 0.2, 0.2 ],
    [ 0.45, 0.3, 0.15, 0.18 ],
  ];
  lands.forEach((L, i) => {
    ctx.fillStyle = rgba(70, 130, 75, 0.75);
    ctx.beginPath();
    ctx.ellipse(cx + L[0] * r, cy + L[1] * r, L[2] * r, L[3] * r, 0.2 * i, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawMigration(ctx, cx, cy, r, p, quality) {
  const disp = smootherstep(0.15, 0.4, p);
  if (disp < 0.01) return;
  const paths = 8;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < paths; i++) {
    const ang0 = -2.2 + i * 0.45;
    const len = r * (0.9 + hash01(i) * 0.8) * disp;
    const x0 = cx - r * 0.15;
    const y0 = cy + r * 0.1;
    const x1 = x0 + Math.cos(ang0) * len;
    const y1 = y0 + Math.sin(ang0) * len * 0.7;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(255, 220, 120, 0.5 * disp));
    g.addColorStop(1, rgba(255, 180, 80, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 20, x1, y1);
    ctx.stroke();
    drawGlow(ctx, x1, y1, 8, { r: 255, g: 200, b: 100 }, 0.35 * disp);
  }
  ctx.restore();
}

function drawSettlements(ctx, cx, cy, r, p, quality) {
  const agr = smootherstep(0.35, 0.55, p);
  const city = smootherstep(0.5, 0.7, p);
  if (agr < 0.01) return;
  const n = Math.floor(lerp(6, 20, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const ang = hash01(i * 2.4) * Math.PI * 2;
    const dist = r * (0.5 + hash01(i * 1.9) * 0.7);
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist * 0.85;
    const on = clamp((agr - hash01(i) * 0.4) / 0.4, 0, 1);
    const bright = 0.2 + city * 0.5;
    drawGlow(ctx, x, y, 6 + city * 8, { r: 255, g: 210, b: 120 }, bright * on);
    ctx.fillStyle = rgba(255, 230, 160, 0.7 * on);
    ctx.fillRect(x - 1, y - 1, 2 + city * 2, 2 + city * 2);
  }
  ctx.restore();
}

function drawScript(ctx, w, h, p) {
  const wr = smootherstep(0.65, 0.85, p);
  if (wr < 0.01) return;
  ctx.save();
  ctx.globalAlpha = 0.35 * wr;
  ctx.fillStyle = "#e8ecff";
  ctx.font = `${Math.max(14, w * 0.022)}px "Orbitron", sans-serif`;
  ctx.textAlign = "center";
  const glyphs = "𒀭 Aa 文 α 1";
  ctx.fillText(glyphs, w * 0.5, h * 0.78);
  ctx.globalAlpha = 0.25 * wr;
  ctx.font = `${Math.max(12, w * 0.016)}px Outfit, sans-serif`;
  ctx.fillText("records · laws · letters · books", w * 0.5, h * 0.78 + 22);
  ctx.restore();
}

function drawPress(ctx, w, h, cx, cy, p) {
  const pr = smootherstep(0.82, 0.98, p);
  if (pr < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Radiating pages
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + p;
    const x = cx + Math.cos(ang) * 110 * pr;
    const y = cy + Math.sin(ang) * 70 * pr;
    ctx.fillStyle = rgba(230, 230, 240, 0.15 * pr);
    ctx.fillRect(x - 10, y - 14, 20, 28);
  }
  drawGlow(ctx, cx, cy + 40, 100, { r: 200, g: 180, b: 255 }, 0.2 * pr);
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
    const cx = w * 0.5;
    const cy = h * 0.45;
    const r = Math.min(w, h) * 0.2;

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < Math.floor(35 * quality); i++) {
      ctx.fillStyle = rgba(180, 200, 255, 0.12 + hash01(i) * 0.3);
      ctx.fillRect(hash01(i * 3) * w, hash01(i * 7) * h, 1.2, 1.2);
    }

    drawGlobe(ctx, cx, cy, r, p);
    drawMigration(ctx, cx, cy, r, p, quality);
    drawSettlements(ctx, cx, cy, r, p, quality);
    drawScript(ctx, w, h, p);
    drawPress(ctx, w, h, cx, cy, p);

    drawVignette(ctx, w, h, 0.55);
    drawGrain(ctx, w, h, Math.floor(p * 500 + 300), 0.03, quality);
  },
};

export default scene;
