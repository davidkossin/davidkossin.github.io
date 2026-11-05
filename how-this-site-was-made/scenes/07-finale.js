/**
 * Chapter 7 — Finale
 * A chat types David's prompt; the Objects In Space landing page assembles.
 * Deterministic from localProgress (typing length = f(progress)).
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba,
} from "../util.js";

const PROMPT =
  "I'd like to host a personal website on my GitHub.io page. Let's start with a simple landing page that has a space theme to it.";

const checkpoints = [
  {
    id: "prompt",
    at: 0.18,
    timeLabel: "22 September 2026",
    title: "A request in natural language",
    body: "A human types a request in natural language. A large language model, trained on text written by billions of people over several thousand years, interprets the request, writes HTML, CSS, and JavaScript, and publishes it to a server.",
  },
  {
    id: "assemble",
    at: 0.55,
    timeLabel: "22 September 2026",
    title: "The page assembles",
    body: "Markup, styles, and scripts resolve into a dark canvas of stars, a nebula wash, and a title set in a geometric display face. The site's name and tagline take their places — the same elements visible on the home page today.",
  },
  {
    id: "you-are-here",
    at: 0.88,
    timeLabel: "about 13.8 billion years after the Big Bang",
    title: "You are here",
    body: "Light from the page reaches a display about 13.8 billion years after the Big Bang. Every nucleus heavier than lithium in the screen, the cables, and the reader was forged in stars or in their collisions. You are here.",
  },
];

function drawChatBox(ctx, w, h, p, quality) {
  const show = smootherstep(0.0, 0.12, p) * (1 - smootherstep(0.38, 0.55, p));
  if (show < 0.01) return;

  const boxW = Math.min(520, w * 0.86);
  const boxH = 160;
  const x = (w - boxW) / 2;
  const y = h * 0.38;

  ctx.save();
  ctx.globalAlpha = show;

  // Panel
  ctx.fillStyle = rgba(12, 16, 32, 0.82);
  ctx.strokeStyle = rgba(125, 211, 252, 0.35);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, boxW, boxH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = rgba(154, 163, 199, 0.9);
  ctx.font = `500 ${Math.max(11, w * 0.014)}px Outfit, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Prompt · 22 Sep 2026", x + 18, y + 28);

  // Typed text
  const typeProg = smootherstep(0.08, 0.40, p);
  const nChars = Math.floor(PROMPT.length * typeProg);
  const typed = PROMPT.slice(0, nChars);
  const caretOn = typeProg < 0.99 && Math.floor(p * 20) % 2 === 0;

  ctx.fillStyle = rgba(232, 236, 255, 0.95);
  ctx.font = `400 ${Math.max(13, Math.min(16, w * 0.018))}px Outfit, sans-serif`;
  wrapText(ctx, typed + (caretOn ? "▏" : ""), x + 18, y + 56, boxW - 36, 22);

  drawGlow(ctx, x + boxW / 2, y + boxH / 2, boxW * 0.6, { r: 100, g: 160, b: 255 }, 0.08 * show);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLandingAssemble(ctx, w, h, p, quality) {
  const assemble = smootherstep(0.32, 0.65, p);
  if (assemble < 0.01) return;

  // Stars field assembling
  const n = Math.floor(lerp(40, 140, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const birth = hash01(i * 1.1);
    const on = clamp((assemble - birth * 0.7) / 0.3, 0, 1);
    if (on <= 0) continue;
    const x = hash01(i * 3.3) * w;
    const y = hash01(i * 7.7 + 2) * h;
    const r = 0.6 + hash01(i * 2) * 1.8;
    ctx.fillStyle = rgba(200, 220, 255, 0.55 * on);
    ctx.beginPath();
    ctx.arc(x, y, r * on, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nebula washes (match home page palette)
  const neb = smootherstep(0.40, 0.62, p);
  if (neb > 0) {
    drawGlow(ctx, w * 0.2, h * 0.3, 220, { r: 99, g: 102, b: 241 }, 0.18 * neb);
    drawGlow(ctx, w * 0.8, h * 0.2, 200, { r: 14, g: 165, b: 233 }, 0.14 * neb);
    drawGlow(ctx, w * 0.6, h * 0.75, 240, { r: 168, g: 85, b: 247 }, 0.12 * neb);
  }
  ctx.restore();

  // Title + tagline
  const titleOn = smootherstep(0.42, 0.62, p);
  if (titleOn > 0.01) {
    ctx.save();
    ctx.globalAlpha = titleOn;
    ctx.fillStyle = "#e8ecff";
    ctx.font = `700 ${Math.max(28, Math.min(56, w * 0.07))}px Orbitron, sans-serif`;
    ctx.textAlign = "left";
    const tx = w * 0.1;
    const ty = h * 0.42;
    ctx.shadowColor = "rgba(125, 211, 252, 0.45)";
    ctx.shadowBlur = 30;
    ctx.fillText("Objects In Space", tx, ty);
    ctx.shadowBlur = 0;

    const tagOn = smootherstep(0.48, 0.64, p);
    ctx.globalAlpha = titleOn * tagOn;
    ctx.fillStyle = rgba(154, 163, 199, 1);
    ctx.font = `300 ${Math.max(14, Math.min(20, w * 0.025))}px Outfit, sans-serif`;
    ctx.fillText("Projects that are the result of an exploding star.", tx, ty + 42);
    ctx.restore();
  }
}

function drawYouAreHere(ctx, w, h, p) {
  const here = smootherstep(0.75, 0.92, p);
  if (here < 0.01) return;
  ctx.save();
  ctx.globalAlpha = here * 0.85;
  ctx.fillStyle = rgba(125, 211, 252, 0.95);
  ctx.font = `500 ${Math.max(12, w * 0.016)}px Orbitron, sans-serif`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "0.2em";
  ctx.fillText("YOU ARE HERE", w * 0.5, h * 0.78);
  drawGlow(ctx, w * 0.5, h * 0.78, 80, { r: 125, g: 211, b: 252 }, 0.2 * here);
  ctx.restore();
}

const scene = {
  id: "finale",
  title: "Finale",
  weight: 1.0,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);

    // Background shifts from chat-dark to home-page space
    const bgBlend = smootherstep(0.4, 0.7, p);
    ctx.fillStyle = rgba(
      lerp(5, 5, bgBlend),
      lerp(6, 6, bgBlend),
      lerp(15, 15, bgBlend),
      1
    );
    ctx.fillRect(0, 0, w, h);

    drawChatBox(ctx, w, h, p, quality);
    drawLandingAssemble(ctx, w, h, p, quality);
    drawYouAreHere(ctx, w, h, p);

    drawVignette(ctx, w, h, 0.5);
    drawGrain(ctx, w, h, Math.floor(p * 400 + 700), 0.028, quality);
  },
};

export default scene;
