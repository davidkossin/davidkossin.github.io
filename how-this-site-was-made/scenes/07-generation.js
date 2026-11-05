/**
 * Chapter 7 — From prompt to page (v4d)
 * Tokenization → transformer → autoregressive generation → git publish → HTTPS delivery.
 * Factual, gentle motion; no model names, parameter counts, or hardware claims.
 * Strict phase gating: only the active checkpoint's visual is drawn.
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, rgba } from "../util.js";
import { stage } from "../globe.js?v=cea7ac7";

const PROMPT = "I'd like to host a personal website on my GitHub.io page. Let's start with a simple landing page that has a space theme to it.";

/** Approximate subword pieces of the prompt (illustrative — real BPE merges vary by vocabulary). */
const TOKENS = [
  "I", "'d", " like", " to", " host", " a", " personal", " website", " on", " my",
  " Git", "Hub", ".", "io", " page", ".", " Let", "'s", " start", " with",
  " a", " simple", " landing", " page", " that", " has", " a", " space", " theme", " to", " it", ".",
];

/** Shorter display labels for transformer column headers. */
const TOK_SHORT = TOKENS.map((t) => {
  const s = t.trim() || "·";
  return s.length > 6 ? s.slice(0, 5) + "…" : s;
});

const CODE_LINES = [
  "<!DOCTYPE html>",
  '<html lang="en">',
  "<head>",
  '  <meta charset="utf-8">',
  '  <meta name="viewport" content="width=device-width">',
  "  <title>Objects In Space</title>",
  '  <link rel="stylesheet" href="styles.css">',
  "</head>",
  "<body>",
  '  <canvas id="stars" aria-hidden="true"></canvas>',
  '  <div class="nebula"></div>',
  '  <header class="hero">',
  "    <h1>Objects In Space</h1>",
  '    <p class="tagline">Projects that are the result of an exploding star.</p>',
  "  </header>",
  '  <nav class="projects">',
  '    <a href="/weather/">Weather Tracker</a>',
  '    <a href="/orrery/">The Orrery</a>',
  '    <a href="/stellar-events/">Stellar Events</a>',
  "  </nav>",
  '  <script src="main.js"></script>',
  "</body>",
  "</html>",
];

const NEXT_CANDIDATES = [
  { tok: "<", p: 0.38 },
  { tok: "  <", p: 0.22 },
  { tok: "</", p: 0.14 },
  { tok: "\\n", p: 0.09 },
  { tok: "  ", p: 0.05 },
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
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
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

/** Strict exclusive phase gates — only one phase fully on at each checkpoint `at`. */
function phaseGate(p, center, halfIn = 0.055, halfOut = 0.07) {
  const a0 = center - halfOut, a1 = center - halfIn, a2 = center + halfIn, a3 = center + halfOut;
  return smootherstep(a0, a1, p) * (1 - smootherstep(a2, a3, p));
}

function drawPromptBox(ctx, st, w, p, show) {
  if (show < 0.02) return;
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
  const typeProg = smootherstep(0.02, 0.12, p);
  const typed = PROMPT.slice(0, Math.floor(PROMPT.length * typeProg));
  const caret = typeProg < 0.99 && Math.floor(p * 16) % 2 === 0;
  ctx.fillStyle = rgba(232, 236, 255, 0.96);
  ctx.font = `400 ${Math.max(13, Math.min(16, w * 0.017))}px Outfit,sans-serif`;
  wrapText(ctx, typed + (caret ? "▏" : ""), x + 20, y + 60, boxW - 40, 22);
  ctx.restore();
}

function drawTokenization(ctx, st, w, p, q, show) {
  if (show < 0.02) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.42, { r: 80, g: 140, b: 220 }, 0.14);

  const reveal = smootherstep(0.14, 0.22, p);
  const nShow = Math.max(1, Math.floor(TOKENS.length * reveal));
  const fontPx = Math.max(10, Math.min(13, st.aw * 0.022));
  const chipH = fontPx + 12;
  const idH = 11;
  const barH = 16;
  const stackH = chipH + 6 + idH + 8 + barH; // chip → gap → ID → gap → embedding strip (no overlap)
  const gapX = 7, gapY = 18;
  const maxRowW = Math.min(st.aw * 0.94, w * 0.9);
  const x0 = st.cx - maxRowW / 2;
  let x = x0;
  let y = st.cy - st.ah * 0.28;

  ctx.font = `500 ${fontPx}px Outfit,sans-serif`;
  for (let i = 0; i < nShow; i++) {
    const raw = TOKENS[i];
    const chip = raw.trim() || "·";
    const id = 400 + i * 17 + ((hash01(i * 1.7) * 200) | 0);
    const tw = ctx.measureText(chip).width + 16;
    const chipW = Math.max(tw, 28);

    if (x + chipW > x0 + maxRowW) {
      x = x0;
      y += stackH + gapY;
    }
    const on = clamp((reveal * TOKENS.length - i) / 1.5, 0, 1);
    ctx.globalAlpha = show * on;

    // token chip
    ctx.fillStyle = rgba(24, 36, 64, 0.95);
    ctx.strokeStyle = rgba(125, 211, 252, 0.55);
    ctx.lineWidth = 1.2;
    roundRect(ctx, x, y, chipW, chipH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(232, 236, 255, 0.96);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 ${fontPx}px Outfit,sans-serif`;
    ctx.fillText(chip, x + chipW / 2, y + chipH / 2);

    // integer ID under chip (clean row, no overlap with bars)
    const idY = y + chipH + 5 + idH * 0.7;
    ctx.fillStyle = rgba(160, 190, 255, 0.75);
    ctx.font = `400 ${Math.max(9, fontPx - 2)}px ui-monospace,Menlo,monospace`;
    ctx.fillText(String(id), x + chipW / 2, idY);

    // embedding vector strip beneath the ID
    const barY = y + chipH + 6 + idH + 8;
    const dims = 6;
    const bw = Math.max(2.5, (chipW - 6) / dims - 1.5);
    for (let k = 0; k < dims; k++) {
      const h = 3 + hash01(i * 5.1 + k * 2.3) * (barH - 3);
      ctx.fillStyle = rgba(90, 170, 255, 0.35 + 0.45 * hash01(i + k));
      ctx.fillRect(x + 3 + k * (bw + 1.5), barY + barH - h, bw, h);
    }

    x += chipW + gapX;
  }

  // legend
  ctx.globalAlpha = show * 0.85;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgba(154, 163, 199, 0.8);
  ctx.font = `400 ${Math.max(10, st.aw * 0.018)}px Outfit,sans-serif`;
  const legendY = Math.min(st.y + st.ah - 12, y + stackH + 28);
  ctx.fillText("token → vocabulary ID → embedding vector", st.cx - maxRowW / 2, legendY);
  ctx.restore();
}

function drawNetwork(ctx, st, w, h, p, q, show) {
  if (show < 0.02) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.5, { r: 120, g: 100, b: 220 }, 0.12);

  // How many token columns fit
  const nTok = q > 0.55 ? 12 : 8;
  const nBlocks = q > 0.55 ? 4 : 3;
  const pad = 10;
  const left = st.x + pad;
  const right = st.x + st.aw - pad;
  const top = st.y + pad + 8;
  const bot = st.y + st.ah - pad - 4;
  const tokRowH = Math.max(16, Math.min(22, st.ah * 0.05));
  const blockGap = 6;
  const usableH = bot - top - tokRowH - 8;
  const blockH = (usableH - blockGap * (nBlocks - 1)) / nBlocks;
  const colGap = 4;
  const colW = (right - left - colGap * (nTok - 1)) / nTok;

  // Token positions along the bottom
  const toks = [];
  for (let i = 0; i < nTok; i++) {
    const cx = left + i * (colW + colGap) + colW / 2;
    toks.push({ i, cx, label: TOK_SHORT[i % TOK_SHORT.length] });
  }

  // Residual stream vertical glow behind each column
  ctx.globalCompositeOperation = "lighter";
  for (const t of toks) {
    const g = ctx.createLinearGradient(t.cx, bot, t.cx, top);
    g.addColorStop(0, rgba(100, 160, 255, 0.08));
    g.addColorStop(0.45, rgba(150, 130, 255, 0.28));
    g.addColorStop(1, rgba(190, 150, 255, 0.12));
    ctx.fillStyle = g;
    ctx.fillRect(t.cx - colW * 0.32, top, colW * 0.64, bot - top);
  }
  ctx.globalCompositeOperation = "source-over";

  // Transformer blocks (bottom = early layers, top = later)
  const pulse = 0.5 + 0.5 * Math.sin(p * Math.PI * 2); // gentle
  for (let b = 0; b < nBlocks; b++) {
    const by = bot - tokRowH - 8 - (b + 1) * blockH - b * blockGap;
    const attnH = blockH * 0.55;
    const ffnH = blockH * 0.38;
    const layerOn = smootherstep(0.30, 0.36, p) * (0.55 + 0.45 * smootherstep(0, 1, (b + 1) / nBlocks));

    // block frame
    ctx.globalAlpha = show * (0.5 + 0.5 * layerOn);
    ctx.fillStyle = rgba(16, 22, 42, 0.72);
    ctx.strokeStyle = rgba(140, 150, 255, 0.28 + 0.2 * layerOn);
    ctx.lineWidth = 1;
    roundRect(ctx, left - 4, by, right - left + 8, blockH, 10);
    ctx.fill();
    ctx.stroke();

    // label
    ctx.fillStyle = rgba(160, 170, 220, 0.7);
    ctx.font = `500 ${Math.max(9, Math.min(11, st.aw * 0.016))}px Outfit,sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Transformer block ${b + 1}`, left + 6, by + 4);
    ctx.fillStyle = rgba(140, 200, 255, 0.55);
    ctx.font = `400 ${Math.max(8, Math.min(10, st.aw * 0.014))}px Outfit,sans-serif`;
    ctx.fillText("self-attention (causal)", left + 6, by + 16);
    ctx.fillText("feed-forward", left + 6, by + attnH + 4);

    // Attention arcs — causal: j only attends to i <= j
    const attnY = by + 28 + attnH * 0.35;
    ctx.globalCompositeOperation = "lighter";
    for (let j = 0; j < nTok; j++) {
      for (let i = 0; i <= j; i++) {
        // Prefer local + a few long-range; weight from hash
        const dist = j - i;
        const base = dist === 0 ? 0.15 : Math.exp(-dist * 0.35) * (0.4 + 0.6 * hash01(b * 40 + i * 7 + j * 3));
        if (base < 0.12) continue;
        const wgt = base * layerOn * (0.85 + 0.15 * pulse);
        const a = toks[i], c = toks[j];
        const midY = attnY - 10 - dist * 2.8 - hash01(i + j + b) * 12;
        ctx.strokeStyle = rgba(190, 160, 255, 0.12 + 0.55 * wgt);
        ctx.lineWidth = 1.0 + wgt * 2.2;
        ctx.beginPath();
        ctx.moveTo(a.cx, attnY);
        ctx.quadraticCurveTo((a.cx + c.cx) / 2, midY, c.cx, attnY);
        ctx.stroke();
      }
    }
    // Attention position nodes
    for (const t of toks) {
      const act = 0.5 + 0.5 * hash01(t.i * 3 + b * 11 + Math.floor(p * 8));
      drawGlow(ctx, t.cx, attnY, 6 + act * 5, { r: 170, g: 150, b: 255 }, 0.35 * layerOn * act);
      ctx.fillStyle = rgba(230, 225, 255, 0.9);
      ctx.beginPath();
      ctx.arc(t.cx, attnY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // Feed-forward sublayer — small wide MLP per position
    const ffnY = by + attnH + ffnH * 0.45;
    for (const t of toks) {
      const hidden = q > 0.5 ? 3 : 2;
      for (let hix = 0; hix < hidden; hix++) {
        const hy = ffnY - 8 + hix * 7;
        const act = 0.3 + 0.7 * hash01(t.i * 9 + b * 5 + hix + Math.floor(p * 6));
        ctx.strokeStyle = rgba(100, 200, 180, 0.15 + 0.25 * act * layerOn);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(t.cx, attnY + 4);
        ctx.lineTo(t.cx - 6 + hix * 6, hy);
        ctx.lineTo(t.cx, ffnY + 10);
        ctx.stroke();
        ctx.fillStyle = rgba(120, 230, 200, 0.5 + 0.4 * act);
        ctx.beginPath();
        ctx.arc(t.cx - 6 + hix * 6, hy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // residual add node
      drawGlow(ctx, t.cx, ffnY + 10, 5, { r: 120, g: 200, b: 255 }, 0.3 * layerOn);
      ctx.fillStyle = rgba(180, 220, 255, 0.95);
      ctx.beginPath();
      ctx.arc(t.cx, ffnY + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Token chips along bottom
  ctx.globalAlpha = show;
  ctx.globalCompositeOperation = "source-over";
  for (const t of toks) {
    const chipW = Math.min(colW - 2, 52);
    const chipH = tokRowH - 2;
    const x = t.cx - chipW / 2;
    const y = bot - tokRowH;
    ctx.fillStyle = rgba(22, 32, 58, 0.95);
    ctx.strokeStyle = rgba(125, 211, 252, 0.45);
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, chipW, chipH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(220, 230, 255, 0.95);
    ctx.font = `500 ${Math.max(8, Math.min(11, chipW * 0.28))}px Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.label, t.cx, y + chipH / 2);
  }

  // Side legend
  ctx.globalAlpha = show * 0.75;
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(154, 163, 199, 0.75);
  ctx.font = `400 ${Math.max(9, st.aw * 0.015)}px Outfit,sans-serif`;
  ctx.fillText("residual stream ↑", right - 4, top + 10);
  ctx.restore();
}

function drawGeneration(ctx, st, w, p, q, show) {
  if (show < 0.02) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.42, { r: 60, g: 160, b: 140 }, 0.12);

  const reveal = smootherstep(0.48, 0.58, p); // ~fully written by checkpoint at=0.56
  const lines = CODE_LINES;
  const maxLines = Math.min(lines.length, q > 0.5 ? 23 : 18);
  const lineH = Math.max(11, Math.min(15, (st.ah * 0.78) / (maxLines + 2)));
  const panelW = Math.min(420, st.aw * 0.62);
  const sideW = Math.min(160, st.aw * 0.28);
  const gap = 12;
  const totalW = panelW + gap + sideW;
  const fit = totalW <= st.aw * 0.96;
  const blockW = fit ? panelW : Math.min(panelW, st.aw * 0.9);
  const x = fit ? st.cx - totalW / 2 : st.cx - blockW / 2;
  const y0 = st.cy - (maxLines * lineH) * 0.48;

  // code panel
  ctx.fillStyle = rgba(8, 14, 24, 0.92);
  ctx.strokeStyle = rgba(80, 180, 160, 0.45);
  ctx.lineWidth = 1.2;
  roundRect(ctx, x - 12, y0 - 22, blockW + 24, maxLines * lineH + 40, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(90, 200, 160, 0.55);
  ctx.font = `500 ${Math.max(9, lineH - 2)}px Outfit,sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("index.html", x, y0 - 8);

  ctx.font = `400 ${Math.max(9, lineH - 3)}px ui-monospace,Menlo,monospace`;
  const totalChars = lines.slice(0, maxLines).reduce((s, l) => s + l.length, 0);
  let shown = Math.floor(totalChars * reveal);
  for (let i = 0; i < maxLines; i++) {
    const take = Math.min(lines[i].length, Math.max(0, shown));
    shown -= take;
    ctx.fillStyle = rgba(70, 120, 100, 0.4);
    ctx.fillText(String(i + 1).padStart(2, " "), x - 2, y0 + (i + 1) * lineH);
    const isTag = lines[i].includes("Objects In Space") || lines[i].includes("tagline") || lines[i].includes("canvas");
    ctx.fillStyle = rgba(
      isTag ? 180 : 140,
      isTag ? 240 : 230,
      isTag ? 210 : 200,
      0.55 + 0.4 * (take / Math.max(1, lines[i].length))
    );
    const slice = lines[i].slice(0, take);
    // clip long lines
    let draw = slice;
    while (ctx.measureText(draw).width > blockW - 28 && draw.length > 4) draw = draw.slice(0, -1);
    ctx.fillText(draw, x + 20, y0 + (i + 1) * lineH);
    if (take < lines[i].length && take > 0) {
      const cw = ctx.measureText(draw).width;
      ctx.fillStyle = rgba(200, 255, 230, 0.85);
      ctx.fillRect(x + 20 + cw + 1, y0 + (i + 1) * lineH - lineH * 0.7, 2, lineH * 0.85);
    }
    if (shown <= 0 && take < lines[i].length) break;
  }

  // P(next token) panel — only when generation phase is primary
  if (fit) {
    const bx = x + blockW + gap;
    const by = y0 - 10;
    const bh = Math.min(200, maxLines * lineH * 0.7);
    ctx.fillStyle = rgba(12, 20, 36, 0.94);
    ctx.strokeStyle = rgba(100, 200, 170, 0.4);
    roundRect(ctx, bx, by, sideW, bh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(180, 230, 210, 0.95);
    ctx.font = `600 ${Math.max(10, st.aw * 0.018)}px Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("P(next token)", bx + sideW / 2, by + 18);
    ctx.fillStyle = rgba(154, 163, 199, 0.75);
    ctx.font = `400 ${Math.max(8, st.aw * 0.014)}px Outfit,sans-serif`;
    ctx.fillText("sample → append", bx + sideW / 2, by + 34);

    const barMax = sideW - 70;
    NEXT_CANDIDATES.forEach((c, i) => {
      const rowY = by + 52 + i * 28;
      const isTop = i === 0;
      ctx.fillStyle = isTop ? rgba(40, 80, 70, 0.9) : rgba(24, 34, 52, 0.7);
      if (isTop) {
        roundRect(ctx, bx + 6, rowY - 12, sideW - 12, 24, 6);
        ctx.fill();
      }
      ctx.textAlign = "left";
      ctx.fillStyle = isTop ? rgba(160, 255, 210, 0.98) : rgba(180, 200, 220, 0.85);
      ctx.font = `${isTop ? 600 : 400} ${Math.max(9, st.aw * 0.015)}px ui-monospace,Menlo,monospace`;
      ctx.fillText(JSON.stringify(c.tok), bx + 12, rowY + 2);
      ctx.fillStyle = isTop ? rgba(80, 220, 170, 0.9) : rgba(100, 160, 200, 0.55);
      ctx.fillRect(bx + 58, rowY - 5, barMax * c.p, 10);
      ctx.fillStyle = rgba(200, 220, 240, 0.8);
      ctx.font = `400 ${Math.max(8, st.aw * 0.013)}px Outfit,sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText((c.p * 100).toFixed(0) + "%", bx + sideW - 10, rowY + 2);
    });
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(140, 220, 180, 0.85);
    ctx.font = `500 ${Math.max(9, st.aw * 0.014)}px Outfit,sans-serif`;
    ctx.fillText("sampled ✓", bx + sideW / 2, by + bh - 12);
  }
  ctx.restore();
}

function drawPublishing(ctx, st, w, h, p, q, show) {
  if (show < 0.02) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.48, { r: 100, g: 120, b: 255 }, 0.12);

  const commitOn = smootherstep(0.68, 0.72, p);
  const pushOn = smootherstep(0.70, 0.74, p);
  const pagesOn = smootherstep(0.72, 0.76, p);
  const edgeOn = smootherstep(0.73, 0.78, p);

  // Horizontal flow layout inside safeContent
  const cardH = Math.min(96, st.ah * 0.26);
  const arrowGap = Math.max(28, st.aw * 0.04);
  const span = st.aw - 16;
  const cardW = Math.min(168, (span - arrowGap * 2) / 3);
  const yCards = st.cy - st.ah * 0.32;
  const x0 = st.x + 8;
  const slot = (span - arrowGap * 2) / 3;

  function card(x, title, lines, accent) {
    ctx.fillStyle = rgba(16, 22, 40, 0.94);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.3;
    roundRect(ctx, x, yCards, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(210, 220, 255, 0.96);
    ctx.font = `600 ${Math.max(11, st.aw * 0.022)}px Outfit,sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, x + 12, yCards + 24);
    ctx.font = `400 ${Math.max(10, st.aw * 0.017)}px ui-monospace,Menlo,monospace`;
    lines.forEach((ln, i) => {
      ctx.fillStyle = rgba(150, 200, 180, 0.9 - i * 0.1);
      const maxW = cardW - 24;
      let s = ln;
      while (ctx.measureText(s).width > maxW && s.length > 4) s = s.slice(0, -1);
      ctx.fillText(s, x + 12, yCards + 46 + i * 16);
    });
  }

  const c1x = x0;
  const c2x = x0 + cardW + arrowGap;
  const c3x = x0 + (cardW + arrowGap) * 2;

  ctx.globalAlpha = show * Math.max(0.35, commitOn);
  card(c1x, "git commit", ["index.html", "styles.css  main.js", '"Add landing page"'], rgba(140, 160, 255, 0.5));

  // arrow 1
  ctx.globalAlpha = show * Math.max(0.25, pushOn);
  const a1x0 = c1x + cardW + 6, a1x1 = c2x - 6;
  ctx.strokeStyle = rgba(140, 180, 255, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a1x0, yCards + cardH / 2);
  ctx.lineTo(a1x1, yCards + cardH / 2);
  ctx.stroke();
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(a1x1, yCards + cardH / 2);
  ctx.lineTo(a1x1 - 8, yCards + cardH / 2 - 5);
  ctx.lineTo(a1x1 - 8, yCards + cardH / 2 + 5);
  ctx.fillStyle = rgba(140, 180, 255, 0.7);
  ctx.fill();
  drawGlow(ctx, lerp(a1x0, a1x1, (p * 1.5) % 1), yCards + cardH / 2, 10, { r: 150, g: 190, b: 255 }, 0.45 * pushOn);

  ctx.globalAlpha = show * Math.max(0.35, pushOn);
  card(c2x, "GitHub", ["davidkossin/", "*.github.io", "git push  ✓"], rgba(160, 180, 255, 0.55));

  ctx.globalAlpha = show * Math.max(0.25, pagesOn);
  const a2x0 = c2x + cardW + 6, a2x1 = c3x - 6;
  ctx.strokeStyle = rgba(140, 200, 255, 0.5);
  ctx.beginPath();
  ctx.moveTo(a2x0, yCards + cardH / 2);
  ctx.lineTo(a2x1, yCards + cardH / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a2x1, yCards + cardH / 2);
  ctx.lineTo(a2x1 - 8, yCards + cardH / 2 - 5);
  ctx.lineTo(a2x1 - 8, yCards + cardH / 2 + 5);
  ctx.fillStyle = rgba(140, 200, 255, 0.7);
  ctx.fill();

  ctx.globalAlpha = show * Math.max(0.35, pagesOn);
  card(c3x, "GitHub Pages", ["build static site", "deploy to CDN", "edge ready"], rgba(100, 200, 255, 0.5));

  // Faint world arc + CDN edge nodes
  ctx.globalAlpha = show * Math.max(0.2, edgeOn);
  const mapCy = st.cy + st.ah * 0.28;
  const mapRx = Math.min(st.aw * 0.42, 280);
  const mapRy = Math.min(st.ah * 0.18, 70);
  ctx.strokeStyle = rgba(120, 170, 230, 0.4);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(st.cx, mapCy, mapRx, mapRy, 0, 0, Math.PI * 2);
  ctx.stroke();
  // latitude lines
  ctx.strokeStyle = rgba(100, 150, 210, 0.22);
  ctx.beginPath();
  ctx.ellipse(st.cx, mapCy, mapRx, mapRy * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();

  const edges = [
    { lon: -0.7, lat: 0.2, label: "SFO" },
    { lon: -0.25, lat: 0.35, label: "IAD" },
    { lon: 0.15, lat: 0.25, label: "LHR" },
    { lon: 0.55, lat: -0.1, label: "SIN" },
    { lon: 0.75, lat: 0.15, label: "NRT" },
    { lon: -0.1, lat: -0.35, label: "GRU" },
  ];
  edges.forEach((e, i) => {
    const ex = st.cx + e.lon * mapRx;
    const ey = mapCy + e.lat * mapRy;
    const blink = 0.6 + 0.4 * Math.sin(p * 10 + i);
    softDisc(ctx, ex, ey, 18, { r: 100, g: 200, b: 255 }, 0.32 * edgeOn * blink);
    ctx.fillStyle = rgba(160, 230, 255, 0.95);
    ctx.beginPath();
    ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(200, 230, 255, 0.9);
    ctx.font = `500 ${Math.max(8, st.aw * 0.014)}px Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(e.label, ex, ey + 14);
    // gentle packet from Pages card toward edge
    if (edgeOn > 0.3) {
      const t = (p * 1.2 + i * 0.15) % 1;
      const px = lerp(c3x + cardW / 2, ex, t);
      const py = lerp(yCards + cardH, ey, t);
      ctx.fillStyle = rgba(160, 220, 255, 0.7 * (1 - t));
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.globalAlpha = show * 0.8;
  ctx.fillStyle = rgba(154, 163, 199, 0.8);
  ctx.font = `400 ${Math.max(10, st.aw * 0.016)}px Outfit,sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("CDN edge · static assets worldwide", st.cx, mapCy + mapRy + 18);
  ctx.restore();
}

function drawDelivery(ctx, st, w, h, p, q, show) {
  if (show < 0.02) return;
  ctx.save();
  ctx.globalAlpha = show;
  softDisc(ctx, st.cx, st.cy, st.aw * 0.5, { r: 80, g: 160, b: 255 }, 0.14);

  const flow = smootherstep(0.84, 0.895, p); // at checkpoint 0.90 fully lit
  const mobile = st.aw < 420 || w < 500;

  // Browser chrome — large, fills much of safeContent
  const bw = Math.min(st.aw * 0.92, mobile ? st.aw * 0.95 : 520);
  const bh = Math.min(st.ah * (mobile ? 0.72 : 0.78), mobile ? 340 : 360);
  const bx = st.cx - bw / 2;
  const by = st.cy - bh / 2;

  ctx.fillStyle = rgba(14, 18, 32, 0.96);
  ctx.strokeStyle = rgba(125, 211, 252, 0.45);
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 14);
  ctx.fill();
  ctx.stroke();

  // title bar
  const barH = 36;
  ctx.fillStyle = rgba(24, 30, 48, 0.98);
  roundRect(ctx, bx + 1, by + 1, bw - 2, barH, 12);
  ctx.fill();
  ctx.fillRect(bx + 1, by + barH - 8, bw - 2, 8);
  // traffic lights
  [[18, 210, 100], [255, 190, 70], [255, 100, 100]].forEach((c, i) => {
    ctx.fillStyle = rgba(c[0], c[1], c[2], 0.85);
    ctx.beginPath();
    ctx.arc(bx + 18 + i * 14, by + barH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  // URL bar with TLS lock
  const urlX = bx + 70, urlW = bw - 90, urlH = 22, urlY = by + (barH - urlH) / 2;
  ctx.fillStyle = rgba(10, 14, 26, 0.95);
  roundRect(ctx, urlX, urlY, urlW, urlH, 8);
  ctx.fill();
  const lockOn = clamp((flow - 0.15) / 0.2, 0, 1);
  // padlock icon
  const lx = urlX + 12, ly = urlY + urlH / 2;
  ctx.strokeStyle = rgba(100, 220, 160, 0.55 + 0.45 * lockOn);
  ctx.fillStyle = rgba(100, 220, 160, 0.55 + 0.45 * lockOn);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(lx, ly - 3, 3.2, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, lx - 4, ly - 2, 8, 7, 1.5);
  ctx.fill();
  ctx.fillStyle = rgba(220, 230, 255, 0.95);
  ctx.font = `400 ${Math.max(10, bw * 0.024)}px Outfit,sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("https://dkossin.com/", urlX + 28, urlY + urlH / 2);

  // Interior: pipeline stages — all lit at checkpoint
  const stages = [
    { label: "DNS", sub: "dkossin.com", detail: "→ 185.199.x.x", at: 0.0 },
    { label: "TLS", sub: "HTTPS", detail: "session ✓", at: 0.12 },
    { label: "GET /", sub: "request", detail: "packets →", at: 0.28 },
    { label: "Response", sub: "HTML·CSS·JS", detail: "← 200 OK", at: 0.45 },
    { label: "Parse", sub: "DOM · CSSOM", detail: "build tree", at: 0.62 },
    { label: "Paint", sub: "pixels", detail: "frame ready", at: 0.78 },
  ];
  const innerTop = by + barH + 16;
  const innerBot = by + bh - 16;
  const innerH = innerBot - innerTop;
  const n = stages.length;

  if (mobile) {
    // vertical stack on narrow screens
    const rowH = innerH / n;
    stages.forEach((s, i) => {
      const on = clamp((flow - s.at) / 0.1, 0, 1);
      const y = innerTop + i * rowH + rowH * 0.15;
      ctx.globalAlpha = show * (0.55 + 0.45 * on);
      ctx.fillStyle = rgba(20, 30, 50, 0.9);
      ctx.strokeStyle = rgba(125, 211, 252, 0.35 + 0.5 * on);
      roundRect(ctx, bx + 14, y, bw - 28, rowH * 0.7, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba(232, 236, 255, 0.95);
      ctx.font = `600 ${Math.max(11, bw * 0.04)}px Outfit,sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(s.label, bx + 26, y + rowH * 0.38);
      ctx.fillStyle = rgba(154, 163, 199, 0.9);
      ctx.font = `400 ${Math.max(9, bw * 0.03)}px Outfit,sans-serif`;
      ctx.fillText(s.sub + "  " + s.detail, bx + 26 + ctx.measureText(s.label).width + 12, y + rowH * 0.38);
      if (on > 0.7) {
        softDisc(ctx, bx + bw - 36, y + rowH * 0.35, 12, { r: 100, g: 220, b: 160 }, 0.35);
      }
    });
  } else {
    // horizontal pipeline filling browser body
    const padX = 18;
    const usable = bw - padX * 2;
    const boxW = Math.min(78, usable / n - 8);
    const boxH = Math.min(88, innerH * 0.42);
    const y = innerTop + innerH * 0.12;
    stages.forEach((s, i) => {
      const on = clamp((flow - s.at) / 0.1, 0, 1);
      const u = i / (n - 1);
      const x = bx + padX + u * (usable - boxW);
      ctx.globalAlpha = show * (0.6 + 0.4 * on);
      softDisc(ctx, x + boxW / 2, y + boxH / 2, 36, { r: 100, g: 180, b: 255 }, 0.18 * on);
      ctx.fillStyle = rgba(18, 28, 48, 0.95);
      ctx.strokeStyle = rgba(125, 211, 252, 0.35 + 0.55 * on);
      ctx.lineWidth = 1.4;
      roundRect(ctx, x, y, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba(232, 236, 255, 0.96);
      ctx.font = `600 ${Math.max(11, boxW * 0.2)}px Outfit,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.label, x + boxW / 2, y + 22);
      ctx.fillStyle = rgba(154, 163, 199, 0.9);
      ctx.font = `400 ${Math.max(8, boxW * 0.14)}px Outfit,sans-serif`;
      ctx.fillText(s.sub, x + boxW / 2, y + 44);
      ctx.fillStyle = rgba(140, 220, 180, 0.5 + 0.5 * on);
      ctx.font = `500 ${Math.max(8, boxW * 0.13)}px Outfit,sans-serif`;
      ctx.fillText(s.detail, x + boxW / 2, y + 64);
      if (i < n - 1) {
        const xN = bx + padX + ((i + 1) / (n - 1)) * (usable - boxW);
        ctx.strokeStyle = rgba(120, 180, 255, 0.25 + 0.45 * on);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + boxW + 2, y + boxH / 2);
        ctx.lineTo(xN - 2, y + boxH / 2);
        ctx.stroke();
        // traveling packet
        if (on > 0.3) {
          const t = (p * 2 + i * 0.2) % 1;
          const px = lerp(x + boxW, xN, t);
          ctx.fillStyle = rgba(160, 220, 255, 0.85);
          ctx.beginPath();
          ctx.arc(px, y + boxH / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Preview pane — painted page fragment
    const paintOn = clamp((flow - 0.78) / 0.15, 0, 1);
    ctx.globalAlpha = show * (0.35 + 0.65 * paintOn);
    const pvY = y + boxH + 18;
    const pvH = Math.max(60, innerBot - pvY - 4);
    ctx.fillStyle = rgba(8, 10, 22, 0.95);
    roundRect(ctx, bx + 18, pvY, bw - 36, pvH, 8);
    ctx.fill();
    softDisc(ctx, bx + bw / 2, pvY + pvH * 0.45, 50, { r: 90, g: 120, b: 220 }, 0.2 * paintOn);
    ctx.fillStyle = rgba(232, 236, 255, 0.95 * paintOn);
    ctx.font = `700 ${Math.max(14, Math.min(22, bw * 0.04))}px Orbitron,Outfit,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Objects In Space", bx + bw / 2, pvY + pvH * 0.45);
    ctx.fillStyle = rgba(154, 163, 199, 0.9 * paintOn);
    ctx.font = `300 ${Math.max(9, bw * 0.022)}px Outfit,sans-serif`;
    ctx.fillText("Projects that are the result of an exploding star.", bx + bw / 2, pvY + pvH * 0.45 + 22);
  }

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

    // Faint grid only as ambient (no text)
    ctx.save();
    ctx.strokeStyle = rgba(60, 100, 160, 0.035);
    const step = lerp(72, 54, quality);
    for (let x = st.x; x < st.x + st.aw; x += step) {
      ctx.beginPath(); ctx.moveTo(x, st.y); ctx.lineTo(x, st.y + st.ah); ctx.stroke();
    }
    ctx.restore();

    // Exclusive gates centered on each checkpoint `at`
    const promptG = phaseGate(p, 0.06, 0.04, 0.055);
    const tok = phaseGate(p, 0.20, 0.05, 0.065);
    const net = phaseGate(p, 0.38, 0.055, 0.07);
    const gen = phaseGate(p, 0.56, 0.055, 0.07);
    const pub = phaseGate(p, 0.74, 0.055, 0.07);
    const del = phaseGate(p, 0.90, 0.055, 0.08);

    // Draw only phases with meaningful opacity — prevents ghost bleed
    if (promptG > 0.02) drawPromptBox(ctx, st, w, p, promptG);
    if (tok > 0.02) drawTokenization(ctx, st, w, p, quality, tok);
    if (net > 0.02) drawNetwork(ctx, st, w, h, p, quality, net);
    if (gen > 0.02) drawGeneration(ctx, st, w, p, quality, gen);
    if (pub > 0.02) drawPublishing(ctx, st, w, h, p, quality, pub);
    if (del > 0.02) drawDelivery(ctx, st, w, h, p, quality, del);

    drawVignette(ctx, w, h, 0.48);
    drawGrain(ctx, w, h, Math.floor(p * 600 + 200), 0.018, quality);
  },
};
export default scene;
