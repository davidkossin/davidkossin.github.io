/**
 * Chapter 7 — From prompt to page (v4c)
 * Tokenization → transformer → autoregressive generation → git publish → HTTPS delivery.
 * Factual, gentle motion; no model names, parameter counts, or hardware claims.
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, rgba } from "../util.js";
import { stage } from "../globe.js?v=8533430";

const PROMPT = "I'd like to host a personal website on my GitHub.io page. Let's start with a simple landing page that has a space theme to it.";

/** Approximate subword pieces of the prompt (illustrative — real BPE merges vary by vocabulary). */
const TOKENS = [
  "I", "'d", " like", " to", " host", " a", " personal", " website", " on", " my",
  " Git", "Hub", ".", "io", " page", ".", " Let", "'s", " start", " with",
  " a", " simple", " landing", " page", " that", " has", " a", " space", " theme", " to", " it", ".",
];

const CODE_LINES = [
  "<!DOCTYPE html>",
  '<html lang="en">',
  "<head>",
  "  <meta charset=\"utf-8\">",
  "  <title>Objects In Space</title>",
  "  <link rel=\"stylesheet\" href=\"styles.css\">",
  "</head>",
  "<body>",
  "  <canvas id=\"stars\"></canvas>",
  "  <div class=\"nebula\"></div>",
  "  <h1>Objects In Space</h1>",
  "  <p class=\"tagline\">Projects that are the result of an exploding star.</p>",
  "  <script src=\"main.js\"></script>",
  "</body>",
  "</html>",
];

const checkpoints = [
  { id: "prompt", at: 0.06, timeLabel: "22 September 2026", title: "The request",
    body: "A human types a request in natural language. The text will be processed by a large language model — a neural network trained to predict the next token in a sequence — which can draft HTML, CSS, and JavaScript for a personal site." },
  { id: "tokenization", at: 0.20, timeLabel: "22 September 2026", title: "Tokenization",
    body: "The prompt is split into tokens — often subword pieces rather than whole words — by a learned tokenizer such as byte-pair encoding. Each token maps to an integer ID in a fixed vocabulary, then to a learned embedding vector that the network can process." },
  { id: "through-the-network", at: 0.38, timeLabel: "22 September 2026", title: "Through the network",
    body: "Embedding vectors pass through stacked transformer layers. In each layer, self-attention lets every position weigh information from other positions in the sequence; feed-forward networks then transform those representations. Depth compounds these updates into contextual features useful for predicting what comes next." },
  { id: "generation", at: 0.56, timeLabel: "22 September 2026", title: "Generation",
    body: "The model emits one token at a time. At each step it produces a probability distribution over the vocabulary; a token is sampled (or chosen greedily), appended to the context, and fed back in — autoregressive decoding. The stream of tokens decodes into HTML, CSS, and JavaScript for the page." },
  { id: "publishing", at: 0.74, timeLabel: "22 September 2026", title: "Publishing",
    body: "The generated files are written to a Git repository, committed, and pushed to GitHub. GitHub Pages builds the site from the repository and publishes static assets to servers and a content-delivery network so they can be requested by browsers worldwide." },
  { id: "delivery", at: 0.90, timeLabel: "22 September 2026", title: "Delivery",
    body: "A browser resolves the hostname via DNS, opens an HTTPS connection, and requests the page. Packets carry HTML, CSS, and JavaScript; the browser parses them and paints pixels. That painted canvas is the moment the site assembles on screen." },
];

function softDisc(ctx, x, y, rad, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba(color.r, color.g, color.b, a));
  g.addColorStop(0.55, rgba(color.r, color.g, color.b, a * 0.35));
  g.addColorStop(1, rgba(color.r, color.g, color.b, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
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
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "", yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

function drawPromptBox(ctx, st, w, p, show) {
  if (show < 0.01) return;
  const boxW = Math.min(560, st.aw * 0.92, w * 0.88);
  const boxH = Math.min(200, st.ah * 0.55);
  const x = st.cx - boxW / 2, y = st.cy - boxH / 2;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, boxW * 0.65, { r: 100, g: 160, b: 255 }, 0.16);
  ctx.fillStyle = rgba(10, 14, 28, 0.95);
  ctx.strokeStyle = rgba(125, 211, 252, 0.5);
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, boxW, boxH, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(20, 28, 48, 0.9);
  roundRect(ctx, x + 1, y + 1, boxW - 2, 38, 14);
  ctx.fill();
  ctx.fillStyle = rgba(125, 211, 252, 0.9);
  ctx.beginPath();
  ctx.arc(x + 22, y + 20, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(154, 163, 199, 0.95);
  ctx.font = `500 ${Math.max(11, Math.min(13, w * 0.014))}px Outfit,sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Prompt · 22 Sep 2026", x + 36, y + 24);
  const typeProg = smootherstep(0.02, 0.14, p);
  const typed = PROMPT.slice(0, Math.floor(PROMPT.length * typeProg));
  const caret = typeProg < 0.99 && Math.floor(p * 16) % 2 === 0;
  ctx.fillStyle = rgba(232, 236, 255, 0.96);
  ctx.font = `400 ${Math.max(13, Math.min(16, w * 0.017))}px Outfit,sans-serif`;
  wrapText(ctx, typed + (caret ? "▏" : ""), x + 20, y + 60, boxW - 40, 22);
  ctx.restore();
}

function drawTokenization(ctx, st, w, p, q, show) {
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.45, { r: 80, g: 140, b: 220 }, 0.12);
  const reveal = smootherstep(0.14, 0.24, p);
  const nShow = Math.max(1, Math.floor(TOKENS.length * reveal));
  const fontPx = Math.max(10, Math.min(13, st.aw * 0.022));
  ctx.font = `500 ${fontPx}px Outfit,sans-serif`;
  const padX = 8, padY = 6, gap = 6;
  const maxRowW = Math.min(st.aw * 0.92, w * 0.88);
  let x0 = st.cx - maxRowW / 2;
  let x = x0, y = st.cy - st.ah * 0.22;
  const rowH = fontPx + padY * 2 + 4;
  for (let i = 0; i < nShow; i++) {
    const label = TOKENS[i].replace(/ /g, "·");
    const id = 400 + i * 17 + (hash01(i) * 200 | 0);
    const chip = `${TOKENS[i] === " " ? "␣" : TOKENS[i].trim() || "·"}`;
    const tw = ctx.measureText(chip).width + padX * 2;
    const idW = ctx.measureText(String(id)).width;
    const chipW = Math.max(tw, idW + padX * 2);
    if (x + chipW > x0 + maxRowW) {
      x = x0;
      y += rowH + gap + 10;
    }
    const on = clamp((reveal * TOKENS.length - i) / 1.2, 0, 1);
    ctx.globalAlpha = show * on;
    // chip
    ctx.fillStyle = rgba(24, 36, 64, 0.92);
    ctx.strokeStyle = rgba(125, 211, 252, 0.45);
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, chipW, fontPx + padY * 2, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(232, 236, 255, 0.95);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(chip, x + chipW / 2, y + (fontPx + padY * 2) / 2);
    // integer ID under chip
    ctx.fillStyle = rgba(180, 200, 255, 0.7);
    ctx.font = `400 ${Math.max(9, fontPx - 2)}px ui-monospace,monospace`;
    ctx.fillText(String(id), x + chipW / 2, y + fontPx + padY * 2 + 10);
    ctx.font = `500 ${fontPx}px Outfit,sans-serif`;
    // tiny embedding bars blooming
    if (on > 0.6) {
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 4; k++) {
        const h = 4 + hash01(i * 3 + k) * 10;
        ctx.fillStyle = rgba(100, 180, 255, 0.25 * on);
        ctx.fillRect(x + 4 + k * 5, y - 4 - h, 3, h);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    x += chipW + gap;
  }
  ctx.restore();
}

function drawNetwork(ctx, st, p, q, show) {
  if (show < 0.01) return;
  const layers = qualityLayers(q);
  const x0 = st.cx - st.aw * 0.38;
  const x1 = st.cx + st.aw * 0.38;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.5, { r: 120, g: 100, b: 220 }, 0.12);
  const nodes = layers.map((count, li) => {
    const x = lerp(x0, x1, li / (layers.length - 1));
    return Array.from({ length: count }, (_, i) => ({
      x,
      y: st.cy + (i - (count - 1) / 2) * Math.min(st.ah * 0.12, 28),
      act: 0.35 + 0.65 * hash01(i * 3 + li * 11 + Math.floor(p * 12)),
    }));
  });
  // attention arcs (self-attention within a mid layer) — gentle
  const attnLayer = nodes[Math.min(2, nodes.length - 1)];
  const attnOn = smootherstep(0.32, 0.40, p);
  ctx.globalCompositeOperation = "lighter";
  if (attnOn > 0.01 && attnLayer) {
    for (let i = 0; i < attnLayer.length; i++) {
      for (let j = i + 1; j < attnLayer.length; j++) {
        const wgt = hash01(i * 9 + j * 5) * attnOn;
        if (wgt < 0.25) continue;
        const a = attnLayer[i], b = attnLayer[j];
        ctx.strokeStyle = rgba(180, 160, 255, 0.08 + 0.22 * wgt);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const mx = (a.x + b.x) / 2 + 18;
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, (a.y + b.y) / 2, b.x, b.y);
        ctx.stroke();
      }
    }
  }
  // interlayer links
  const flow = smootherstep(0.32, 0.44, p);
  for (let li = 0; li < nodes.length - 1; li++) {
    for (const a of nodes[li]) {
      for (const b of nodes[li + 1]) {
        const link = hash01((a.y + b.x) * 0.01 + li);
        if (link > 0.55) continue;
        ctx.strokeStyle = rgba(140, 180, 255, (0.04 + 0.12 * a.act * b.act) * flow);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  nodes.flat().forEach((nd) => {
    drawGlow(ctx, nd.x, nd.y, 8 + nd.act * 8, { r: 160, g: 150, b: 255 }, 0.4 * nd.act * show);
    ctx.fillStyle = rgba(230, 225, 255, 0.95);
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, 2.8 + nd.act * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function qualityLayers(q) {
  return q > 0.55 ? [5, 7, 7, 7, 5] : [4, 5, 5, 4];
}

function drawGeneration(ctx, st, w, p, q, show) {
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.4, { r: 60, g: 160, b: 140 }, 0.12);
  const reveal = smootherstep(0.50, 0.66, p);
  const lines = CODE_LINES;
  const lineH = Math.max(14, Math.min(18, st.ah * 0.045));
  const blockW = Math.min(480, st.aw * 0.85);
  const x = st.cx - blockW / 2;
  const y0 = st.cy - (lines.length * lineH) * 0.5;
  ctx.fillStyle = rgba(8, 14, 24, 0.88);
  ctx.strokeStyle = rgba(80, 180, 160, 0.4);
  roundRect(ctx, x - 14, y0 - 18, blockW + 28, lines.length * lineH + 36, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(90, 200, 160, 0.5);
  ctx.font = `400 ${Math.max(10, lineH - 4)}px ui-monospace,monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  let shown = Math.floor(totalChars * reveal);
  for (let i = 0; i < lines.length; i++) {
    const take = Math.min(lines[i].length, Math.max(0, shown));
    shown -= take;
    ctx.fillStyle = rgba(70, 120, 100, 0.45);
    ctx.fillText(String(i + 1).padStart(2, " "), x - 4, y0 + i * lineH);
    ctx.fillStyle = rgba(140, 230, 200, 0.55 + 0.4 * (take / Math.max(1, lines[i].length)));
    ctx.fillText(lines[i].slice(0, take), x + 22, y0 + i * lineH);
    if (take < lines[i].length && take > 0) {
      // caret on active line
      const cw = ctx.measureText(lines[i].slice(0, take)).width;
      ctx.fillStyle = rgba(200, 255, 230, 0.8);
      ctx.fillRect(x + 22 + cw + 1, y0 + i * lineH - lineH * 0.7, 2, lineH * 0.85);
    }
    if (shown <= 0 && take < lines[i].length) break;
  }
  // small distribution hint — next-token probabilities
  const distOn = smootherstep(0.52, 0.60, p) * (1 - smootherstep(0.62, 0.68, p));
  if (distOn > 0.01) {
    ctx.globalAlpha = show * distOn;
    const bx = st.cx + blockW * 0.28;
    const by = st.cy - st.ah * 0.28;
    ctx.fillStyle = rgba(20, 30, 50, 0.85);
    roundRect(ctx, bx, by, 120, 70, 8);
    ctx.fill();
    ctx.fillStyle = rgba(154, 163, 199, 0.85);
    ctx.font = "400 9px Outfit,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("P(next token)", bx + 60, by + 14);
    const bars = [0.42, 0.22, 0.14, 0.09, 0.05];
    bars.forEach((h, i) => {
      ctx.fillStyle = rgba(100, 220, 180, 0.55);
      ctx.fillRect(bx + 12 + i * 20, by + 60 - h * 40, 14, h * 40);
    });
  }
  ctx.restore();
}

function drawPublishing(ctx, st, p, q, show) {
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.4, { r: 100, g: 120, b: 255 }, 0.14);
  const commitOn = smootherstep(0.68, 0.72, p);
  const pushOn = smootherstep(0.70, 0.76, p);
  const pagesOn = smootherstep(0.74, 0.80, p);
  // repo card
  const rw = Math.min(280, st.aw * 0.5), rh = 90;
  const rx = st.cx - rw * 0.55, ry = st.cy - 40;
  ctx.fillStyle = rgba(16, 22, 40, 0.92);
  ctx.strokeStyle = rgba(140, 160, 255, 0.45);
  roundRect(ctx, rx, ry, rw, rh, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(200, 210, 255, 0.95);
  ctx.font = `600 ${Math.max(12, st.aw * 0.028)}px Outfit,sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("git commit", rx + 16, ry + 28);
  ctx.fillStyle = rgba(140, 220, 180, 0.85 * commitOn);
  ctx.font = `400 ${Math.max(11, st.aw * 0.022)}px ui-monospace,monospace`;
  ctx.fillText("index.html  styles.css  main.js", rx + 16, ry + 52);
  ctx.fillStyle = rgba(154, 163, 199, 0.8 * commitOn);
  ctx.fillText("\"Add Objects In Space landing page\"", rx + 16, ry + 72);
  // arrow to GitHub
  if (pushOn > 0.01) {
    ctx.globalCompositeOperation = "lighter";
    const ax0 = rx + rw + 10, ax1 = st.cx + st.aw * 0.22;
    ctx.strokeStyle = rgba(140, 180, 255, 0.5 * pushOn);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax0, ry + rh / 2);
    ctx.lineTo(ax1 - 30, ry + rh / 2);
    ctx.stroke();
    drawGlow(ctx, lerp(ax0, ax1, (p * 2) % 1), ry + rh / 2, 12, { r: 150, g: 190, b: 255 }, 0.5 * pushOn);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgba(20, 28, 55, 0.95);
    roundRect(ctx, ax1 - 20, ry + 10, 110, 70, 12);
    ctx.fill();
    ctx.strokeStyle = rgba(160, 180, 255, 0.5);
    ctx.stroke();
    ctx.fillStyle = rgba(220, 230, 255, 0.95);
    ctx.font = `600 12px Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("GitHub", ax1 + 35, ry + 40);
    ctx.fillStyle = rgba(154, 163, 199, 0.85);
    ctx.font = "400 10px Outfit,sans-serif";
    ctx.fillText("git push", ax1 + 35, ry + 58);
  }
  if (pagesOn > 0.01) {
    ctx.globalAlpha = show * pagesOn;
    softDisc(ctx, st.cx, st.cy + st.ah * 0.28, 80, { r: 100, g: 200, b: 255 }, 0.2);
    ctx.fillStyle = rgba(180, 220, 255, 0.9);
    ctx.font = `500 ${Math.max(11, st.aw * 0.024)}px Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("GitHub Pages · build & deploy · CDN edge", st.cx, st.cy + st.ah * 0.28);
  }
  ctx.restore();
}

function drawDelivery(ctx, st, w, h, p, q, show) {
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.45, { r: 80, g: 160, b: 255 }, 0.14);
  const steps = [
    { label: "DNS", sub: "dkossin.com → address", at: 0.0 },
    { label: "HTTPS", sub: "TLS session", at: 0.15 },
    { label: "Request", sub: "GET /", at: 0.3 },
    { label: "Packets", sub: "HTML · CSS · JS", at: 0.45 },
    { label: "Parse", sub: "DOM · CSSOM", at: 0.6 },
    { label: "Paint", sub: "pixels on screen", at: 0.75 },
  ];
  const flow = smootherstep(0.86, 0.98, p);
  const n = steps.length;
  const y = st.cy;
  const x0 = st.cx - st.aw * 0.4;
  const x1 = st.cx + st.aw * 0.4;
  steps.forEach((s, i) => {
    const u = i / (n - 1);
    const x = lerp(x0, x1, u);
    const on = clamp((flow - s.at) / 0.2, 0, 1);
    ctx.globalAlpha = show * (0.35 + 0.65 * on);
    softDisc(ctx, x, y, 28, { r: 100, g: 180, b: 255 }, 0.2 * on);
    ctx.fillStyle = rgba(18, 28, 48, 0.92);
    ctx.strokeStyle = rgba(125, 211, 252, 0.4 + 0.4 * on);
    roundRect(ctx, x - 36, y - 28, 72, 56, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(232, 236, 255, 0.95);
    ctx.font = `600 ${Math.max(10, st.aw * 0.022)}px Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(s.label, x, y - 4);
    ctx.fillStyle = rgba(154, 163, 199, 0.85);
    ctx.font = `400 ${Math.max(8, st.aw * 0.016)}px Outfit,sans-serif`;
    ctx.fillText(s.sub, x, y + 14);
    if (i < n - 1) {
      const xN = lerp(x0, x1, (i + 1) / (n - 1));
      ctx.strokeStyle = rgba(120, 180, 255, 0.25 + 0.35 * on);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 38, y);
      ctx.lineTo(xN - 38, y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

const scene = {
  id: "generation",
  title: "Prompt to page",
  weight: 1.35,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const st = stage(view);
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);
    // Soft grid, very faint
    ctx.save();
    ctx.strokeStyle = rgba(60, 100, 160, 0.04);
    const step = lerp(70, 52, quality);
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();

    // Non-overlapping windows centered on each checkpoint `at`
    const promptG = smootherstep(0, 0.03, p) * (1 - smootherstep(0.10, 0.15, p));
    const tok = smoothstep(0.14, 0.19, p) * (1 - smootherstep(0.26, 0.32, p));
    const net = smoothstep(0.32, 0.37, p) * (1 - smootherstep(0.46, 0.52, p));
    const gen = smoothstep(0.50, 0.55, p) * (1 - smootherstep(0.64, 0.70, p));
    const pub = smoothstep(0.68, 0.73, p) * (1 - smootherstep(0.82, 0.87, p));
    const del = smootherstep(0.86, 0.91, p);

    drawPromptBox(ctx, st, w, p, promptG);
    drawTokenization(ctx, st, w, p, quality, tok);
    drawNetwork(ctx, st, p, quality, net);
    drawGeneration(ctx, st, w, p, quality, gen);
    drawPublishing(ctx, st, p, quality, pub);
    drawDelivery(ctx, st, w, h, p, quality, del);

    drawVignette(ctx, w, h, 0.48);
    drawGrain(ctx, w, h, Math.floor(p * 600 + 200), 0.02, quality);
  },
};
export default scene;
