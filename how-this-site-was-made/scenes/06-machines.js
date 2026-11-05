/**
 * Chapter 6 — Machines
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba,
} from "../util.js";

const checkpoints = [
  {
    id: "electricity",
    at: 0.08,
    timeLabel: "practical electric power from the late 19th century",
    title: "Electricity",
    body: "Electromagnetism, mapped in the 19th century, becomes infrastructure: generators, grids, motors, and light. Electric power decouples industry and communication from the limits of muscle, water, and steam alone, and becomes the substrate for every later machine on this timeline.",
  },
  {
    id: "transistor",
    at: 0.24,
    timeLabel: "1947 CE",
    title: "The transistor",
    body: "At Bell Labs, Bardeen, Brattain, and Shockley demonstrate a point-contact transistor — a solid-state switch and amplifier. Miniaturization follows. Transistors replace vacuum tubes and make modern computers, radios, and sensors possible at scale.",
  },
  {
    id: "arpanet",
    at: 0.40,
    timeLabel: "1969 CE",
    title: "ARPANET",
    body: "Packet-switched networking links research computers under U.S. ARPA funding. The first ARPANET node-to-node message is sent in 1969. Protocols evolved from this lineage — especially TCP/IP — become the backbone of the global Internet.",
  },
  {
    id: "www",
    at: 0.55,
    timeLabel: "1989–1991 CE",
    title: "World Wide Web",
    body: "Tim Berners-Lee proposes and implements a hypertext system of URLs, HTTP, and HTML at CERN. The Web turns the Internet into a browsable information space that anyone with a link can publish to and read — including, decades later, this page.",
  },
  {
    id: "smartphones",
    at: 0.68,
    timeLabel: "widespread from the late 2000s",
    title: "Smartphones",
    body: "Pocket computers combine radios, sensors, cameras, and high-resolution displays. Always-on network access puts the Web, maps, cameras, and messaging in daily reach for billions of people, generating vast streams of digital text and images.",
  },
  {
    id: "deep-learning",
    at: 0.82,
    timeLabel: "breakthroughs accelerating from about 2012 CE onward",
    title: "Neural networks and deep learning",
    body: "Multi-layer neural networks, trained with gradient methods on large datasets and GPUs, surpass prior systems in vision, speech, and many prediction tasks. The same substrate — layers of weighted connections — scales to language.",
  },
  {
    id: "llms",
    at: 0.94,
    timeLabel: "2010s–2020s CE",
    title: "Large language models",
    body: "Models trained on enormous text corpora learn to predict the next token — and, in doing so, to summarize, translate, write code, and answer questions in natural language. They compress statistical patterns from centuries of human writing into tools that can assist in building software and websites.",
  },
];

function drawGrid(ctx, w, h, p, quality) {
  const on = smootherstep(0.0, 0.2, p);
  ctx.save();
  ctx.strokeStyle = rgba(80, 140, 220, 0.08 * on);
  ctx.lineWidth = 1;
  const step = lerp(60, 40, quality);
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSparks(ctx, w, h, p, quality) {
  const elec = smoothstep(0.0, 0.18, p) * (1 - smoothstep(0.25, 0.4, p) * 0.4);
  if (elec < 0.01) return;
  const n = Math.floor(lerp(8, 24, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const x0 = hash01(i * 2) * w;
    const y0 = hash01(i * 3 + 1) * h;
    let x = x0, y = y0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (hash01(i * 10 + s) - 0.5) * 40;
      y += (hash01(i * 11 + s + 3) - 0.3) * 30;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(120, 200, 255, 0.35 * elec);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTransistor(ctx, cx, cy, p) {
  const on = smootherstep(0.15, 0.35, p);
  if (on < 0.01) return;
  ctx.save();
  ctx.globalAlpha = on;
  ctx.translate(cx, cy);
  ctx.strokeStyle = rgba(125, 211, 252, 0.8);
  ctx.fillStyle = rgba(125, 211, 252, 0.15);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-40, -28, 80, 56);
  ctx.fill();
  ctx.stroke();
  // Legs
  [[-20, 28], [0, 28], [20, 28]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 22);
    ctx.stroke();
  });
  ctx.fillStyle = rgba(232, 236, 255, 0.7);
  ctx.font = "12px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("1947", 0, -36);
  ctx.restore();
}

function drawNetwork(ctx, w, h, cx, cy, p, quality) {
  const net = smootherstep(0.32, 0.6, p);
  if (net < 0.01) return;
  const nodes = [];
  const n = Math.floor(lerp(8, 18, quality));
  for (let i = 0; i < n; i++) {
    nodes.push({
      x: cx + (hash01(i * 1.3) - 0.5) * w * 0.7,
      y: cy + (hash01(i * 2.7) - 0.5) * h * 0.5,
    });
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hash01(i * 20 + j) > 0.65) continue;
      const a = clamp((net - hash01(i + j) * 0.4) / 0.4, 0, 1);
      ctx.strokeStyle = rgba(100, 180, 255, 0.2 * a);
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(nodes[j].x, nodes[j].y);
      ctx.stroke();
    }
  }
  nodes.forEach((nd, i) => {
    const a = clamp((net - i / n * 0.5) / 0.5, 0, 1);
    drawGlow(ctx, nd.x, nd.y, 12, { r: 120, g: 200, b: 255 }, 0.35 * a);
    ctx.fillStyle = rgba(200, 230, 255, 0.8 * a);
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawWeb(ctx, w, h, p) {
  const web = smootherstep(0.48, 0.65, p);
  if (web < 0.01) return;
  ctx.save();
  ctx.globalAlpha = 0.5 * web;
  ctx.strokeStyle = rgba(196, 181, 253, 0.6);
  ctx.lineWidth = 1.5;
  const cx = w * 0.5, cy = h * 0.42;
  for (let ring = 1; ring <= 3; ring++) {
    ctx.beginPath();
    ctx.arc(cx, cy, 40 * ring * web, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * 120 * web, cy + Math.sin(ang) * 120 * web);
    ctx.stroke();
  }
  ctx.fillStyle = rgba(232, 236, 255, 0.7);
  ctx.font = `${Math.max(13, w * 0.018)}px Orbitron, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("WWW", cx, cy + 5);
  ctx.restore();
}

function drawPhone(ctx, w, h, p) {
  const ph = smootherstep(0.62, 0.78, p);
  if (ph < 0.01) return;
  const x = w * 0.5, y = h * 0.48;
  ctx.save();
  ctx.globalAlpha = ph;
  ctx.fillStyle = rgba(20, 24, 40, 0.9);
  ctx.strokeStyle = rgba(125, 211, 252, 0.6);
  ctx.lineWidth = 2;
  roundRect(ctx, x - 28, y - 48, 56, 96, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(60, 100, 180, 0.5);
  roundRect(ctx, x - 22, y - 40, 44, 70, 4);
  ctx.fill();
  drawGlow(ctx, x, y, 80, { r: 100, g: 160, b: 255 }, 0.15 * ph);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNeural(ctx, w, h, p, quality) {
  const dl = smootherstep(0.74, 0.95, p);
  if (dl < 0.01) return;
  const layers = [4, 6, 6, 3];
  const x0 = w * 0.28;
  const x1 = w * 0.72;
  const cy = h * 0.45;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const nodes = layers.map((count, li) => {
    const x = lerp(x0, x1, li / (layers.length - 1));
    const arr = [];
    for (let i = 0; i < count; i++) {
      const y = cy + (i - (count - 1) / 2) * 28;
      arr.push({ x, y });
    }
    return arr;
  });
  for (let li = 0; li < nodes.length - 1; li++) {
    for (const a of nodes[li]) {
      for (const b of nodes[li + 1]) {
        const pulse = 0.15 + 0.15 * Math.sin((a.x + b.y + p * 40) * 0.05);
        ctx.strokeStyle = rgba(167, 139, 250, pulse * dl);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  nodes.flat().forEach((nd) => {
    drawGlow(ctx, nd.x, nd.y, 10, { r: 180, g: 160, b: 255 }, 0.4 * dl);
    ctx.fillStyle = rgba(230, 220, 255, 0.9 * dl);
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

const scene = {
  id: "machines",
  title: "Machines",
  weight: 1.25,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const cx = w * 0.5;
    const cy = h * 0.45;

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    drawGrid(ctx, w, h, p, quality);
    drawSparks(ctx, w, h, p, quality);

    // Crossfade machine motifs
    const tPhase = 1 - smootherstep(0.35, 0.5, p);
    if (tPhase > 0.05) {
      ctx.save();
      ctx.globalAlpha = tPhase;
      drawTransistor(ctx, cx, cy, Math.min(p / 0.35, 1));
      ctx.restore();
    }

    drawNetwork(ctx, w, h, cx, cy, p, quality);

    const wPhase = smoothstep(0.45, 0.55, p) * (1 - smootherstep(0.62, 0.72, p));
    if (wPhase > 0.05) {
      ctx.save();
      ctx.globalAlpha = wPhase;
      drawWeb(ctx, w, h, 1);
      ctx.restore();
    }

    const phPhase = smoothstep(0.62, 0.72, p) * (1 - smootherstep(0.78, 0.88, p));
    if (phPhase > 0.05) {
      ctx.save();
      ctx.globalAlpha = phPhase;
      drawPhone(ctx, w, h, 1);
      ctx.restore();
    }

    drawNeural(ctx, w, h, p, quality);

    drawVignette(ctx, w, h, 0.55);
    drawGrain(ctx, w, h, Math.floor(p * 900 + 400), 0.03, quality);
  },
};

export default scene;
