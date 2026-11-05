/**
 * Chapter 7 — Finale (v4c) — particles clear by assemble checkpoint; no ghost title
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, rgba } from "../util.js";
import { stage } from "../globe.js?v=b69902c";

const PROMPT = "I'd like to host a personal website on my GitHub.io page. Let's start with a simple landing page that has a space theme to it.";
const CODE_LINES = ["<!DOCTYPE html>",'<html lang="en">',"<title>Objects In Space</title>",'<canvas id="stars"></canvas>','<div class="nebula"></div>',"<h1>Objects In Space</h1>",'<p class="tagline">Projects that are the result of an exploding star.</p>'];
const checkpoints = [
  { id:"prompt", at:0.18, timeLabel:"22 September 2026", title:"A request in natural language",
    body:"A human types a request in natural language. A large language model, trained on text written by billions of people over several thousand years, interprets the request, writes HTML, CSS, and JavaScript, and publishes it to a server." },
  { id:"assemble", at:0.55, timeLabel:"22 September 2026", title:"The page assembles",
    body:"Markup, styles, and scripts resolve into a dark canvas of stars, a nebula wash, and a title set in a geometric display face. The site's name and tagline take their places — the same elements visible on the home page today." },
  { id:"you-are-here", at:0.88, timeLabel:"about 13.8 billion years after the Big Bang", title:"You are here",
    body:"Light from the page reaches a display about 13.8 billion years after the Big Bang. Every nucleus heavier than lithium in the screen, the cables, and the reader was forged in stars or in their collisions. You are here." },
];
function softDisc(ctx,x,y,rad,color,a){const g=ctx.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,rgba(color.r,color.g,color.b,a));g.addColorStop(0.55,rgba(color.r,color.g,color.b,a*0.35));g.addColorStop(1,rgba(color.r,color.g,color.b,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();}
function roundRect(ctx,x,y,w,h,rad){ctx.beginPath();ctx.moveTo(x+rad,y);ctx.arcTo(x+w,y,x+w,y+h,rad);ctx.arcTo(x+w,y+h,x,y+h,rad);ctx.arcTo(x,y+h,x,y,rad);ctx.arcTo(x,y,x+w,y,rad);ctx.closePath();}
function wrapText(ctx,text,x,y,maxW,lineH){const words=text.split(" ");let line="",yy=y;for(let i=0;i<words.length;i++){const test=line?line+" "+words[i]:words[i];if(ctx.measureText(test).width>maxW&&line){ctx.fillText(line,x,yy);line=words[i];yy+=lineH;}else line=test;}if(line)ctx.fillText(line,x,yy);}

/** Fit title font so full string sits inside safeContent with margin.
 *  Orbitron loads late — measure with a 1.08 safety factor so we do not clip. */
function fitTitle(ctx, title, maxW, maxPx, minPx = 16) {
  let size = maxPx;
  while (size > minPx) {
    ctx.font = `700 ${size}px Orbitron,sans-serif`;
    if (ctx.measureText(title).width * 1.08 <= maxW) break;
    size -= 1;
  }
  return size;
}

const scene={id:"finale",title:"Finale",weight:1.0,checkpoints,
  render(ctx,localProgress,view){ const{w,h,quality=1}=view; const p=clamp(localProgress,0,1); const st=stage(view);
    ctx.fillStyle="#05060f"; ctx.fillRect(0,0,w,h);
    const chat=smootherstep(0,0.1,p)*(1-smootherstep(0.30,0.44,p));
    if(chat>0.01){ const boxW=Math.min(560,st.aw*0.92,w*0.88), boxH=Math.min(200,st.ah*0.55); const x=st.cx-boxW/2,y=st.cy-boxH/2; ctx.save(); ctx.globalAlpha=chat; softDisc(ctx,st.cx,st.cy,boxW*0.65,{r:100,g:160,b:255},0.16); ctx.fillStyle=rgba(10,14,28,0.95); ctx.strokeStyle=rgba(125,211,252,0.5); ctx.lineWidth=1.5; roundRect(ctx,x,y,boxW,boxH,16); ctx.fill(); ctx.stroke(); ctx.fillStyle=rgba(20,28,48,0.9); roundRect(ctx,x+1,y+1,boxW-2,38,14); ctx.fill(); ctx.fillStyle=rgba(125,211,252,0.9); ctx.beginPath(); ctx.arc(x+22,y+20,5,0,Math.PI*2); ctx.fill(); ctx.fillStyle=rgba(154,163,199,0.95); ctx.font=`500 ${Math.max(11,Math.min(13,w*0.014))}px Outfit,sans-serif`; ctx.textAlign="left"; ctx.fillText("Prompt · 22 Sep 2026",x+36,y+24); const typeProg=smootherstep(0.04,0.28,p); const typed=PROMPT.slice(0,Math.floor(PROMPT.length*typeProg)); const caret=typeProg<0.99&&Math.floor(p*16)%2===0; ctx.fillStyle=rgba(232,236,255,0.96); ctx.font=`400 ${Math.max(13,Math.min(16,w*0.017))}px Outfit,sans-serif`; wrapText(ctx,typed+(caret?"▏":""),x+20,y+60,boxW-40,22); ctx.restore(); }
    const code=smoothstep(0.26,0.38,p)*(1-smootherstep(0.44,0.54,p));
    if(code>0.01){ ctx.save(); ctx.globalAlpha=code*0.92; const lineH=18, blockW=Math.min(440,st.aw*0.78); const x=st.cx-blockW/2, y0=st.cy-CODE_LINES.length*lineH*0.55; ctx.fillStyle=rgba(8,12,24,0.78); ctx.strokeStyle=rgba(80,140,200,0.35); roundRect(ctx,x-16,y0-20,blockW+32,CODE_LINES.length*lineH+36,12); ctx.fill(); ctx.stroke(); const reveal=smootherstep(0.28,0.48,p); for(let i=0;i<CODE_LINES.length;i++){ const lineOn=clamp((reveal*CODE_LINES.length-i)/1.1,0,1); if(lineOn<=0) continue; ctx.fillStyle=rgba(90,200,160,0.35); ctx.font=`400 ${Math.max(11,Math.min(13,w*0.014))}px ui-monospace,monospace`; ctx.textAlign="left"; ctx.fillText(String(i+1).padStart(2," "),x-4,y0+i*lineH); ctx.fillStyle=rgba(125,211,252,0.55+0.4*lineOn); ctx.fillText(CODE_LINES[i].slice(0,Math.floor(CODE_LINES[i].length*lineOn)),x+24,y0+i*lineH); } ctx.restore(); }

    // Title layout (shared by assemble → you-are-here — one title only)
    const title="Objects In Space";
    const margin = Math.max(24, st.aw * 0.06);
    const maxW = Math.max(100, Math.min(st.aw - margin * 2, w - st.x - margin - 16));
    const maxPx = Math.min(48, st.ah * 0.14, maxW * 0.095);
    ctx.save();
    let fontSize = fitTitle(ctx, title, maxW, maxPx, 16);
    ctx.font = `700 ${fontSize}px Orbitron,sans-serif`;
    let tw = ctx.measureText(title).width;
    let tx = st.x + Math.max(0, (st.aw - tw) * 0.5);
    while (tx + tw > w - 20 && fontSize > 16) {
      fontSize -= 1;
      ctx.font = `700 ${fontSize}px Orbitron,sans-serif`;
      tw = ctx.measureText(title).width;
      tx = st.x + Math.max(0, (st.aw - tw) * 0.5);
    }
    if (tx + tw > w - 16) tx = Math.max(12, w - 16 - tw);
    const ty = st.y + st.ah * 0.40;
    ctx.restore();

    // Particles ONLY during the transition before the assemble checkpoint.
    // Fully gone by at=0.55 so the title is crisp with zero stray dots.
    const particleVis = smootherstep(0.36, 0.46, p) * (1 - smootherstep(0.50, 0.55, p));
    if (particleVis > 0.01) {
      const n = Math.floor(lerp(160, 420, quality));
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const birth = hash01(i * 1.1);
        const on = clamp((smootherstep(0.36, 0.50, p) - birth * 0.35) / 0.5, 0, 1) * particleVis;
        if (on <= 0) continue;
        const col = Math.floor(hash01(i * 4.4) * 14) / 14;
        const u = col + (hash01(i * 3.3) - 0.5) * 0.04;
        const fx = tx + u * tw, fy = ty - fontSize * (0.08 + hash01(i * 2) * 0.72);
        const sx = st.cx + (hash01(i * 2.1) - 0.5) * st.aw * 1.2;
        const sy = st.cy + (hash01(i * 4.4) - 0.5) * st.ah;
        // Settle toward glyphs, but fade out entirely before checkpoint
        const settle = smootherstep(0.40, 0.52, p);
        const ease = on * on * (3 - 2 * on);
        const x = lerp(sx, fx, ease * settle);
        const y = lerp(sy, fy, ease * settle);
        ctx.fillStyle = rgba(170, 220, 255, 0.55 * on * particleVis);
        ctx.beginPath();
        ctx.arc(x, y, (1.0 + hash01(i * 2) * 2.6) * (0.4 + ease * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < Math.floor(lerp(30, 80, quality)); i++) {
        const on = particleVis * (0.4 + 0.6 * hash01(i * 7.7));
        ctx.fillStyle = rgba(200, 225, 255, 0.35 * on);
        ctx.beginPath();
        ctx.arc(hash01(i * 3.1) * w, hash01(i * 5.5) * h, 0.6 + hash01(i) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Nebula wash under title from late assemble onward
    const neb = smootherstep(0.48, 0.58, p);
    if (neb > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, w * 0.22, h * 0.32, 280, { r:99, g:102, b:241 }, 0.28 * neb);
      drawGlow(ctx, w * 0.78, h * 0.22, 250, { r:14, g:165, b:233 }, 0.22 * neb);
      drawGlow(ctx, w * 0.58, h * 0.72, 280, { r:168, g:85, b:247 }, 0.2 * neb);
      ctx.restore();
    }

    // Crisp title from just before assemble checkpoint through the rest of the scene.
    // Fully opaque / settled at at=0.55 — no particles on glyphs.
    const titleOn = smootherstep(0.48, 0.55, p);
    if (titleOn > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, titleOn);
      ctx.fillStyle = "#e8ecff";
      ctx.font = `700 ${fontSize}px Orbitron,sans-serif`;
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(125,211,252,0.45)";
      ctx.shadowBlur = 22;
      ctx.fillText(title, tx, ty);
      ctx.shadowBlur = 0;

      const tag = "Projects that are the result of an exploding star.";
      let tagSize = Math.max(12, Math.min(18, st.aw * 0.032));
      ctx.font = `300 ${tagSize}px Outfit,sans-serif`;
      while (tagSize > 11 && ctx.measureText(tag).width > maxW) {
        tagSize -= 1;
        ctx.font = `300 ${tagSize}px Outfit,sans-serif`;
      }
      const tagOn = smootherstep(0.50, 0.55, p);
      ctx.globalAlpha = titleOn * Math.max(0.7, tagOn);
      ctx.fillStyle = rgba(154, 163, 199, 1);
      ctx.fillText(tag, tx, ty + fontSize * 0.72);

      const pillsOn = smootherstep(0.62, 0.82, p) * (1 - smootherstep(0.84, 0.94, p) * 0.35);
      if (pillsOn > 0.01) {
        ctx.globalAlpha = titleOn * pillsOn * 0.75;
        let px = tx;
        const py = ty + fontSize * 0.72 + 34;
        for (const label of ["Weather Tracker", "The Orrery", "Stellar Events"]) {
          ctx.font = "500 12px Outfit,sans-serif";
          const pw = ctx.measureText(label).width + 28;
          if (px + pw > st.x + st.aw - 8) break;
          const g = ctx.createLinearGradient(px, py, px + pw, py + 28);
          g.addColorStop(0, rgba(56, 189, 248, 0.9));
          g.addColorStop(1, rgba(129, 140, 248, 0.9));
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
        }
      }
      ctx.restore();
    }

    // You-are-here: ONLY the marker — do not redraw title (would create a ghost duplicate)
    const here = smootherstep(0.74, 0.90, p);
    if (here > 0.01) {
      ctx.save();
      ctx.globalAlpha = here * 0.95;
      const y = Math.min(h - 110, st.y + st.ah * 0.82);
      softDisc(ctx, st.cx, y, 80, { r:125, g:211, b:252 }, 0.28 * here);
      ctx.fillStyle = rgba(125, 211, 252, 0.98);
      ctx.font = `500 ${Math.max(12, Math.min(18, st.aw * 0.034))}px Orbitron,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("YOU ARE HERE", st.cx, y);
      ctx.restore();
    }
    drawVignette(ctx,w,h,0.46); drawGrain(ctx,w,h,Math.floor(p*400+700),0.024,quality);
  }};
export default scene;
