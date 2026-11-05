/**
 * Chapter 7 — Finale
 * Chat types David's prompt; code streams; Objects In Space landing assembles.
 * Never show "Macinapp". Title kept clear of the placard via artCenter/safeRect.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, rgba,
} from "../util.js";

const PROMPT =
  "I'd like to host a personal website on my GitHub.io page. Let's start with a simple landing page that has a space theme to it.";

const CODE_LINES = [
  "<!DOCTYPE html>",
  "<html lang=\"en\">",
  "<title>Objects In Space</title>",
  "<canvas id=\"stars\"></canvas>",
  "<div class=\"nebula\"></div>",
  "<h1>Objects In Space</h1>",
  "<p class=\"tagline\">Projects that are the result of an exploding star.</p>",
];

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

function artCenter(view) {
  const { w, h } = view;
  if (view.safeRect) {
    const r = view.safeRect;
    return { cx: r.x + r.w * 0.5, cy: r.y + r.h * 0.48, aw: r.w, ah: r.h, x: r.x, y: r.y };
  }
  if (w < 700) {
    const top = 300;
    const bottom = 100;
    const ah = Math.max(120, h - top - bottom);
    return { cx: w * 0.5, cy: top + ah * 0.48, aw: w, ah, x: 0, y: top };
  }
  const leftPad = 380;
  const topPad = 70;
  const bottom = 100;
  const ah = Math.max(160, h - topPad - bottom);
  const x = leftPad * 0.15;
  return {
    cx: lerp(w * 0.55, leftPad + (w - leftPad) * 0.45, 0.7),
    cy: topPad + ah * 0.42,
    aw: w - leftPad * 0.4,
    ah,
    x: leftPad,
    y: topPad,
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
  return yy;
}

function drawChatBox(ctx, w, h, frame, p, quality) {
  const show = smootherstep(0.0, 0.10, p) * (1 - smootherstep(0.32, 0.46, p));
  if (show < 0.01) return;

  const boxW = Math.min(520, frame.aw * 0.92, w * 0.86);
  const boxH = Math.min(170, frame.ah * 0.55);
  const x = frame.cx - boxW / 2;
  const y = frame.cy - boxH / 2;

  ctx.save();
  ctx.globalAlpha = show;

  softDisc(ctx, frame.cx, frame.cy, boxW * 0.55, { r: 100, g: 160, b: 255 }, 0.1);
  ctx.fillStyle = rgba(12, 16, 32, 0.94);
  ctx.strokeStyle = rgba(125, 211, 252, 0.4);
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, boxW, boxH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = rgba(154, 163, 199, 0.95);
  ctx.font = `500 ${Math.max(11, Math.min(13, w * 0.014))}px Outfit, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Prompt · 22 Sep 2026", x + 18, y + 26);

  const typeProg = smootherstep(0.05, 0.26, p);
  const nChars = Math.floor(PROMPT.length * typeProg);
  const typed = PROMPT.slice(0, nChars);
  const caretOn = typeProg < 0.99 && Math.floor(p * 18) % 2 === 0;

  ctx.fillStyle = rgba(232, 236, 255, 0.95);
  ctx.font = `400 ${Math.max(13, Math.min(15, w * 0.017))}px Outfit, sans-serif`;
  wrapText(ctx, typed + (caretOn ? "▏" : ""), x + 18, y + 52, boxW - 36, 21);
  ctx.restore();
}

function drawCodeStream(ctx, w, h, frame, p, quality) {
  const show = smoothstep(0.26, 0.38, p) * (1 - smootherstep(0.44, 0.54, p));
  if (show < 0.01) return;
  ctx.save();
  ctx.globalAlpha = show * 0.85;

  const lineH = 16;
  const x = frame.cx - Math.min(240, frame.aw * 0.4);
  const y0 = frame.cy - CODE_LINES.length * lineH * 0.5;
  const reveal = smootherstep(0.30, 0.50, p);

  for (let i = 0; i < CODE_LINES.length; i++) {
    const lineOn = clamp((reveal * CODE_LINES.length - i) / 1.2, 0, 1);
    if (lineOn <= 0) continue;
    const chars = Math.floor(CODE_LINES[i].length * lineOn);
    const text = CODE_LINES[i].slice(0, chars);
    ctx.fillStyle = rgba(125, 211, 252, 0.55 + 0.35 * lineOn);
    ctx.font = `400 ${Math.max(11, Math.min(13, w * 0.014))}px ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.fillText(text, x, y0 + i * lineH);
  }
  ctx.restore();
}

function drawLandingAssemble(ctx, w, h, frame, p, quality) {
  const assemble = smootherstep(0.38, 0.62, p);
  if (assemble < 0.01) return;

  // Particles converging into starfield + title
  const n = Math.floor(lerp(50, 160, quality));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const birth = hash01(i * 1.1);
    const on = clamp((assemble - birth * 0.65) / 0.35, 0, 1);
    if (on <= 0) continue;
    // Start scattered, settle to final star positions
    const fx = hash01(i * 3.3) * w;
    const fy = hash01(i * 7.7 + 2) * h;
    const sx = frame.cx + (hash01(i * 2.1) - 0.5) * frame.aw * 1.2;
    const sy = frame.cy + (hash01(i * 4.4) - 0.5) * frame.ah;
    const x = lerp(sx, fx, on);
    const y = lerp(sy, fy, on);
    const r = 0.6 + hash01(i * 2) * 1.8;
    ctx.fillStyle = rgba(200, 220, 255, 0.55 * on);
    ctx.beginPath();
    ctx.arc(x, y, r * on, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nebula washes matching home page palette
  const neb = smootherstep(0.42, 0.62, p);
  if (neb > 0) {
    drawGlow(ctx, w * 0.22, h * 0.32, 280, { r: 99, g: 102, b: 241 }, 0.28 * neb);
    drawGlow(ctx, w * 0.78, h * 0.22, 260, { r: 14, g: 165, b: 233 }, 0.22 * neb);
    drawGlow(ctx, w * 0.58, h * 0.72, 300, { r: 168, g: 85, b: 247 }, 0.2 * neb);
    drawGlow(ctx, w * 0.4, h * 0.5, 200, { r: 56, g: 120, b: 220 }, 0.1 * neb);
  }
  ctx.restore();

  // Title + tagline — placed inside safe art frame (NOT under placard)
  const titleOn = smootherstep(0.46, 0.62, p);
  if (titleOn > 0.01) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, titleOn * 1.15);

    // Prefer left edge of safe frame on desktop (mimics home hero), else centered on mobile
    const mobile = w < 700;
    const fontSize = Math.max(26, Math.min(52, frame.aw * 0.11));
    ctx.font = `700 ${fontSize}px Orbitron, sans-serif`;
    const title = "Objects In Space";
    const tw = ctx.measureText(title).width;

    let tx;
    let ty;
    if (mobile) {
      tx = frame.cx - tw / 2;
      ty = frame.cy - 10;
    } else {
      // Sit in safe zone: right of placard / within frame
      tx = Math.max(frame.x + 16, Math.min(frame.cx - tw * 0.15, w - tw - 40));
      // If placard occupies top-left, push title toward vertical center of free area
      ty = Math.max(frame.y + fontSize, frame.cy - 20);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#e8ecff";
    ctx.shadowColor = "rgba(125, 211, 252, 0.5)";
    ctx.shadowBlur = 28;
    ctx.fillText(title, tx, ty);
    ctx.shadowBlur = 0;

    // Particle settle sparkles around title
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 12; i++) {
      const px = tx + hash01(i * 3) * tw;
      const py = ty - fontSize * 0.6 + hash01(i * 5) * fontSize;
      softDisc(ctx, px, py, 6, { r: 125, g: 211, b: 252 }, 0.15 * titleOn);
    }
    ctx.globalCompositeOperation = "source-over";

    const tagOn = smootherstep(0.58, 0.74, p);
    ctx.globalAlpha = titleOn * tagOn;
    ctx.fillStyle = rgba(154, 163, 199, 1);
    const tagSize = Math.max(13, Math.min(19, frame.aw * 0.035));
    ctx.font = `300 ${tagSize}px Outfit, sans-serif`;
    ctx.fillText("Projects that are the result of an exploding star.", tx, ty + fontSize * 0.7);

    // Soft action-pill ghosts (matching home buttons, non-interactive)
    const pillsOn = smootherstep(0.68, 0.84, p);
    if (pillsOn > 0.01) {
      ctx.globalAlpha = titleOn * pillsOn * 0.7;
      const labels = ["Weather Tracker", "The Orrery", "Stellar Events"];
      let px = tx;
      const py = ty + fontSize * 0.7 + 36;
      for (const label of labels) {
        ctx.font = `500 12px Outfit, sans-serif`;
        const pw = ctx.measureText(label).width + 28;
        const g = ctx.createLinearGradient(px, py, px + pw, py + 28);
        g.addColorStop(0, rgba(56, 189, 248, 0.85));
        g.addColorStop(1, rgba(129, 140, 248, 0.85));
        ctx.fillStyle = g;
        roundRect(ctx, px, py, pw, 28, 14);
        ctx.fill();
        ctx.fillStyle = rgba(6, 16, 24, 0.95);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px + pw / 2, py + 14);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        px += pw + 10;
        if (px > w - 80) break;
      }
    }
    ctx.restore();
  }
}

function drawYouAreHere(ctx, w, h, frame, p) {
  const here = smootherstep(0.78, 0.92, p);
  if (here < 0.01) return;
  ctx.save();
  ctx.globalAlpha = here * 0.9;
  const y = Math.min(h - 120, frame.y + frame.ah * 0.88);
  ctx.fillStyle = rgba(125, 211, 252, 0.95);
  ctx.font = `500 ${Math.max(11, w * 0.015)}px Orbitron, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("YOU ARE HERE", frame.cx, y);
  softDisc(ctx, frame.cx, y, 70, { r: 125, g: 211, b: 252 }, 0.18 * here);
  // Soft pulse ring
  ctx.strokeStyle = rgba(125, 211, 252, 0.25 * here);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(frame.cx, y, 28 + here * 10, 0, Math.PI * 2);
  ctx.stroke();
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
    const frame = artCenter(view);

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    drawChatBox(ctx, w, h, frame, p, quality);
    drawCodeStream(ctx, w, h, frame, p, quality);
    drawLandingAssemble(ctx, w, h, frame, p, quality);
    drawYouAreHere(ctx, w, h, frame, p);

    drawVignette(ctx, w, h, 0.48);
    drawGrain(ctx, w, h, Math.floor(p * 400 + 700), 0.026, quality);
  },
};

export default scene;
