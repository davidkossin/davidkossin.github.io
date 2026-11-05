/**
 * Chapter 6 — Machines
 * Electricity → transistor → IC → ARPANET → WWW → phones → deep learning → LLMs.
 * State is a pure function of localProgress.
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
    body: "At Bell Labs, Bardeen, Brattain, and Shockley demonstrate a point-contact transistor — a solid-state switch and amplifier. Miniaturization follows. Transistors replace vacuum tubes and make modern computers, radios, and sensors possible at scale, then shrink into dense integrated circuits.",
  },
  {
    id: "arpanet",
    at: 0.40,
    timeLabel: "1969 CE",
    title: "ARPANET",
    body: "Packet-switched networking links research computers under U.S. ARPA funding. The first four nodes — UCLA, Stanford Research Institute (SRI), UC Santa Barbara, and the University of Utah — exchange packets in 1969. Protocols evolved from this lineage, especially TCP/IP, become the backbone of the global Internet.",
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

function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Spreading grid of electric lights. */
function drawElectricity(ctx, w, h, cx, cy, p, quality) {
  const on = smootherstep(0.0, 0.16, p) * (1 - smootherstep(0.18, 0.28, p));
  if (on < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Soft power-plant core
  softDisc(ctx, cx, cy, 120, { r: 100, g: 180, b: 255 }, 0.12 * on);

  const cols = Math.floor(lerp(5, 11, quality));
  const rows = Math.floor(lerp(3, 7, quality));
  const spread = smootherstep(0.02, 0.18, p);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols - 0.5;
      const v = (j + 0.5) / rows - 0.5;
      const dist = Math.hypot(u, v);
      const birth = dist * 0.9;
      const lit = clamp((spread - birth) / 0.25, 0, 1);
      if (lit <= 0) continue;
      const x = cx + u * Math.min(w, h) * 0.7;
      const y = cy + v * Math.min(w, h) * 0.45;
      // Grid wires
      if (i < cols - 1) {
        const nLit = clamp((spread - Math.hypot(u + 1 / cols, v) * 0.9) / 0.25, 0, 1);
        ctx.strokeStyle = rgba(100, 180, 255, 0.15 * Math.min(lit, Math.max(nLit, 0.1)) * on);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(cx + (u + 1 / cols) * Math.min(w, h) * 0.7, y);
        ctx.stroke();
      }
      if (j < rows - 1) {
        ctx.strokeStyle = rgba(100, 180, 255, 0.12 * lit * on);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, cy + (v + 1 / rows) * Math.min(w, h) * 0.45);
        ctx.stroke();
      }
      drawGlow(ctx, x, y, 10 + lit * 10, { r: 255, g: 230, b: 160 }, 0.4 * lit * on);
      ctx.fillStyle = rgba(255, 245, 200, 0.9 * lit * on);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Gentle arc sparks near the core early on
  const spark = smoothstep(0.0, 0.1, p) * (1 - smoothstep(0.12, 0.22, p));
  if (spark > 0.01) {
    for (let i = 0; i < 5; i++) {
      const ang = hash01(i * 3) * Math.PI * 2 + p * 2;
      let x = cx, y = cy;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += Math.cos(ang + s) * 18;
        y += Math.sin(ang + hash01(i + s)) * 14;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(160, 210, 255, 0.35 * spark);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Point-contact transistor that shrinks into IC patterns. */
function drawTransistor(ctx, cx, cy, p, quality) {
  const show = smoothstep(0.14, 0.26, p) * (1 - smootherstep(0.34, 0.44, p));
  if (show < 0.01) return;

  // Shrink factor: large device → tiny cell in a grid
  const shrink = smootherstep(0.28, 0.42, p);
  const scale = lerp(1.0, 0.18, shrink);
  const icReveal = shrink;

  ctx.save();
  ctx.globalAlpha = show;

  if (icReveal < 0.85) {
    // Point-contact transistor (schematic)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    softDisc(ctx, 0, 0, 90, { r: 100, g: 180, b: 255 }, 0.15);

    // Germanium block
    ctx.fillStyle = rgba(60, 80, 110, 0.9);
    ctx.strokeStyle = rgba(160, 200, 255, 0.6);
    ctx.lineWidth = 2;
    roundRect(ctx, -48, -32, 96, 52, 6);
    ctx.fill();
    ctx.stroke();

    // Point contacts (two whiskers + base)
    ctx.strokeStyle = rgba(220, 230, 255, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -60);
    ctx.lineTo(-12, -10);
    ctx.moveTo(18, -60);
    ctx.lineTo(12, -10);
    ctx.stroke();
    // Contact tips glow
    ctx.globalCompositeOperation = "lighter";
    drawGlow(ctx, -12, -8, 14, { r: 120, g: 220, b: 255 }, 0.55);
    drawGlow(ctx, 12, -8, 14, { r: 120, g: 220, b: 255 }, 0.55);
    ctx.globalCompositeOperation = "source-over";
    // Base lead
    ctx.strokeStyle = rgba(180, 190, 220, 0.8);
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(0, 48);
    ctx.stroke();

    ctx.fillStyle = rgba(180, 210, 255, 0.7);
    ctx.font = "11px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("1947 · point-contact", 0, 68);
    ctx.restore();
  }

  // IC fabric emerging
  if (icReveal > 0.15) {
    const a = smootherstep(0.15, 0.7, icReveal) * show;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "lighter";
    const n = Math.floor(lerp(4, 10, quality));
    const cell = 18;
    for (let j = -n; j <= n; j++) {
      for (let i = -n; i <= n; i++) {
        if (Math.hypot(i, j) > n) continue;
        const x = cx + i * cell;
        const y = cy + j * cell;
        const gate = hash01(i * 12 + j * 7);
        ctx.strokeStyle = rgba(80, 200, 255, 0.25 + gate * 0.35);
        ctx.lineWidth = 1;
        // Trace
        ctx.strokeRect(x - 6, y - 6, 12, 12);
        if (gate > 0.45) {
          drawGlow(ctx, x, y, 5, { r: 100, g: 220, b: 255 }, 0.4);
          ctx.fillStyle = rgba(180, 240, 255, 0.7);
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }
    // Bus lines
    ctx.strokeStyle = rgba(125, 211, 252, 0.2);
    for (let i = -n; i <= n; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + i * cell, cy - n * cell);
      ctx.lineTo(cx + i * cell, cy + n * cell);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** 1969 four-node ARPANET. */
const ARPA_NODES = [
  { id: "UCLA", x: -0.55, y: 0.15 },
  { id: "SRI", x: -0.35, y: -0.35 },
  { id: "UCSB", x: -0.15, y: 0.35 },
  { id: "UTAH", x: 0.45, y: -0.15 },
];
const ARPA_EDGES = [
  [0, 1], [0, 2], [1, 3], [1, 2],
];

function drawArpanet(ctx, cx, cy, size, p, quality) {
  const show = smoothstep(0.34, 0.44, p) * (1 - smootherstep(0.48, 0.56, p));
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, cx, cy, size * 1.1, { r: 80, g: 140, b: 255 }, 0.1);

  const nodes = ARPA_NODES.map((n) => ({
    ...n,
    px: cx + n.x * size,
    py: cy + n.y * size,
  }));

  // Edges with packet pulses tied to progress
  ctx.globalCompositeOperation = "lighter";
  for (let ei = 0; ei < ARPA_EDGES.length; ei++) {
    const [a, b] = ARPA_EDGES[ei];
    const edgeOn = clamp((smootherstep(0.34, 0.48, p) - ei * 0.08) / 0.5, 0, 1);
    if (edgeOn <= 0) continue;
    const A = nodes[a], B = nodes[b];
    ctx.strokeStyle = rgba(120, 190, 255, 0.45 * edgeOn);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.px, A.py);
    ctx.lineTo(B.px, B.py);
    ctx.stroke();
    // Packet dot
    const t = (p * 3 + ei * 0.25) % 1;
    const qx = lerp(A.px, B.px, t);
    const qy = lerp(A.py, B.py, t);
    drawGlow(ctx, qx, qy, 10, { r: 180, g: 230, b: 255 }, 0.5 * edgeOn);
    ctx.fillStyle = rgba(230, 245, 255, 0.9 * edgeOn);
    ctx.beginPath();
    ctx.arc(qx, qy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  nodes.forEach((n, i) => {
    const nodeOn = clamp((smootherstep(0.34, 0.46, p) - i * 0.05) / 0.4, 0, 1);
    drawGlow(ctx, n.px, n.py, 22, { r: 100, g: 180, b: 255 }, 0.4 * nodeOn);
    ctx.fillStyle = rgba(20, 30, 50, 0.9 * nodeOn);
    ctx.beginPath();
    ctx.arc(n.px, n.py, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(160, 210, 255, 0.8 * nodeOn);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = rgba(220, 235, 255, 0.9 * nodeOn);
    ctx.font = `600 ${Math.max(10, size * 0.06)}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(n.id, n.px, n.py + 14);
  });
  ctx.restore();
}

/** Hypertext link web. */
function drawWWW(ctx, cx, cy, size, p, quality) {
  const show = smoothstep(0.48, 0.58, p) * (1 - smootherstep(0.66, 0.76, p));
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  ctx.globalCompositeOperation = "lighter";

  const nodes = [];
  const n = Math.floor(lerp(10, 22, quality));
  for (let i = 0; i < n; i++) {
    const ang = hash01(i * 1.7) * Math.PI * 2;
    const dist = size * (0.15 + hash01(i * 3.1) * 0.85);
    nodes.push({
      x: cx + Math.cos(ang) * dist,
      y: cy + Math.sin(ang) * dist * 0.72,
      hub: hash01(i * 5) > 0.75,
    });
  }
  // Prefer a central hub (CERN-like)
  nodes[0] = { x: cx, y: cy, hub: true };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const link = hash01(i * 30 + j);
      if (link > (nodes[i].hub || nodes[j].hub ? 0.55 : 0.22)) continue;
      const a = clamp((smootherstep(0.5, 0.62, p) - link * 0.4) / 0.4, 0, 1);
      ctx.strokeStyle = rgba(180, 160, 255, 0.22 * a);
      ctx.lineWidth = nodes[i].hub || nodes[j].hub ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(nodes[j].x, nodes[j].y);
      ctx.stroke();
    }
  }
  nodes.forEach((nd, i) => {
    const a = clamp((smootherstep(0.5, 0.62, p) - i / n * 0.35) / 0.5, 0, 1);
    const col = nd.hub ? { r: 200, g: 180, b: 255 } : { r: 140, g: 180, b: 255 };
    drawGlow(ctx, nd.x, nd.y, nd.hub ? 18 : 10, col, 0.4 * a);
    ctx.fillStyle = rgba(230, 230, 255, 0.9 * a);
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, nd.hub ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Document cards floating
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = show * 0.7;
  for (let i = 0; i < 4; i++) {
    const x = cx + (hash01(i * 2) - 0.5) * size * 1.4;
    const y = cy + (hash01(i * 5) - 0.5) * size * 0.9;
    ctx.fillStyle = rgba(30, 35, 60, 0.7);
    ctx.strokeStyle = rgba(180, 160, 255, 0.4);
    ctx.lineWidth = 1;
    roundRect(ctx, x - 16, y - 20, 32, 40, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(160, 150, 220, 0.5);
    ctx.fillRect(x - 10, y - 12, 20, 3);
    ctx.fillRect(x - 10, y - 5, 16, 3);
    ctx.fillRect(x - 10, y + 2, 18, 3);
  }
  ctx.restore();
}

function drawPhones(ctx, cx, cy, p, quality) {
  const show = smoothstep(0.62, 0.72, p) * (1 - smootherstep(0.78, 0.88, p));
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;

  const phones = Math.floor(lerp(1, 5, quality));
  for (let i = 0; i < phones; i++) {
    const ox = (i - (phones - 1) / 2) * 70;
    const x = cx + ox;
    const y = cy + Math.sin(i + p * 2) * 4;
    const s = i === ((phones / 2) | 0) ? 1.15 : 0.85;
    softDisc(ctx, x, y, 50 * s, { r: 80, g: 140, b: 255 }, 0.15);
    ctx.fillStyle = rgba(18, 22, 36, 0.95);
    ctx.strokeStyle = rgba(140, 190, 255, 0.55);
    ctx.lineWidth = 2;
    roundRect(ctx, x - 22 * s, y - 40 * s, 44 * s, 80 * s, 8 * s);
    ctx.fill();
    ctx.stroke();
    // Screen glow
    ctx.globalCompositeOperation = "lighter";
    const sg = ctx.createLinearGradient(x, y - 30 * s, x, y + 20 * s);
    sg.addColorStop(0, rgba(80, 160, 255, 0.55));
    sg.addColorStop(1, rgba(140, 100, 255, 0.35));
    ctx.fillStyle = sg;
    roundRect(ctx, x - 17 * s, y - 32 * s, 34 * s, 58 * s, 4);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // Home bar
    ctx.fillStyle = rgba(200, 220, 255, 0.35);
    ctx.fillRect(x - 8 * s, y + 28 * s, 16 * s, 2);
  }
  ctx.restore();
}

function drawNeural(ctx, cx, cy, size, p, quality) {
  const show = smoothstep(0.74, 0.88, p) * (1 - smootherstep(0.92, 0.99, p) * 0.55);
  if (show < 0.01) return;
  const layers = quality > 0.5 ? [5, 8, 8, 6, 4] : [4, 6, 5, 3];
  const x0 = cx - size * 0.7;
  const x1 = cx + size * 0.7;
  ctx.save();
  ctx.globalAlpha = show;
  ctx.globalCompositeOperation = "lighter";

  const nodes = layers.map((count, li) => {
    const x = lerp(x0, x1, li / (layers.length - 1));
    const arr = [];
    for (let i = 0; i < count; i++) {
      const y = cy + (i - (count - 1) / 2) * (size * 0.22);
      arr.push({ x, y, act: 0.35 + 0.65 * hash01(i * 3 + li * 11 + Math.floor(p * 20)) });
    }
    return arr;
  });

  for (let li = 0; li < nodes.length - 1; li++) {
    for (const a of nodes[li]) {
      for (const b of nodes[li + 1]) {
        const wgt = 0.08 + 0.2 * a.act * b.act;
        const pulse = 0.5 + 0.5 * Math.sin((a.x + b.y) * 0.04 + p * 12);
        ctx.strokeStyle = rgba(160, 140, 255, wgt * pulse);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  nodes.flat().forEach((nd) => {
    drawGlow(ctx, nd.x, nd.y, 8 + nd.act * 8, { r: 180, g: 160, b: 255 }, 0.45 * nd.act);
    ctx.fillStyle = rgba(230, 220, 255, 0.9);
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, 3 + nd.act, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawTokens(ctx, w, h, cx, cy, p, quality) {
  const show = smootherstep(0.88, 0.98, p);
  if (show < 0.01) return;
  const samples = [
    "the", "next", "token", "is", "a", "probability",
    "distribution", "over", "vocabulary", "∇", "attn",
    "context", "window", "transformer", "layer",
  ];
  ctx.save();
  ctx.globalAlpha = show;
  ctx.globalCompositeOperation = "lighter";
  softDisc(ctx, cx, cy, 140, { r: 140, g: 120, b: 255 }, 0.12);

  const n = Math.floor(lerp(8, samples.length, quality));
  for (let i = 0; i < n; i++) {
    const t = (i / n + p * 0.15) % 1;
    const x = cx - 160 + t * 320 + Math.sin(i * 2) * 8;
    const y = cy + (hash01(i * 4) - 0.5) * 80;
    const birth = i / n;
    const on = clamp((show - birth * 0.5) / 0.5, 0, 1);
    if (on <= 0) continue;
    const tw = 28 + samples[i].length * 5;
    ctx.fillStyle = rgba(40, 35, 70, 0.7 * on);
    roundRect(ctx, x - tw / 2, y - 12, tw, 24, 6);
    ctx.fill();
    ctx.strokeStyle = rgba(180, 160, 255, 0.45 * on);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba(220, 210, 255, 0.9 * on);
    ctx.font = "12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(samples[i], x, y);
    // Flow arrow
    if (i < n - 1) {
      ctx.strokeStyle = rgba(160, 140, 255, 0.25 * on);
      ctx.beginPath();
      ctx.moveTo(x + tw / 2 + 2, y);
      ctx.lineTo(x + tw / 2 + 14, y);
      ctx.stroke();
    }
  }
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
    const { cx, cy, ah } = artCenter(view);
    const size = Math.min(w * 0.32, ah * 0.4, 220);

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    // Subtle deep grid backdrop
    ctx.save();
    ctx.strokeStyle = rgba(60, 100, 160, 0.06);
    ctx.lineWidth = 1;
    const step = lerp(70, 48, quality);
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

    drawElectricity(ctx, w, h, cx, cy, p, quality);
    drawTransistor(ctx, cx, cy, p, quality);
    drawArpanet(ctx, cx, cy, size, p, quality);
    drawWWW(ctx, cx, cy, size, p, quality);
    drawPhones(ctx, cx, cy, p, quality);
    drawNeural(ctx, cx, cy, size, p, quality);
    drawTokens(ctx, w, h, cx, cy, p, quality);

    drawVignette(ctx, w, h, 0.52);
    drawGrain(ctx, w, h, Math.floor(p * 900 + 400), 0.028, quality);
  },
};

export default scene;
