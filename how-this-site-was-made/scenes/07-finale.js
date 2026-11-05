/**
 * Chapter 7 — Finale (v3) — polished chat, code stream, particles coalesce into title
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, rgba } from "../util.js";
import { stage } from "../globe.js?v=eb09baa";

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

const scene={id:"finale",title:"Finale",weight:1.0,checkpoints,
  render(ctx,localProgress,view){ const{w,h,quality=1}=view; const p=clamp(localProgress,0,1); const st=stage(view);
    ctx.fillStyle="#05060f"; ctx.fillRect(0,0,w,h);
    const chat=smootherstep(0,0.1,p)*(1-smootherstep(0.30,0.44,p));
    if(chat>0.01){ const boxW=Math.min(560,st.aw*0.92,w*0.88), boxH=Math.min(200,st.ah*0.55); const x=st.cx-boxW/2,y=st.cy-boxH/2; ctx.save(); ctx.globalAlpha=chat; softDisc(ctx,st.cx,st.cy,boxW*0.65,{r:100,g:160,b:255},0.16); ctx.fillStyle=rgba(10,14,28,0.95); ctx.strokeStyle=rgba(125,211,252,0.5); ctx.lineWidth=1.5; roundRect(ctx,x,y,boxW,boxH,16); ctx.fill(); ctx.stroke(); ctx.fillStyle=rgba(20,28,48,0.9); roundRect(ctx,x+1,y+1,boxW-2,38,14); ctx.fill(); ctx.fillStyle=rgba(125,211,252,0.9); ctx.beginPath(); ctx.arc(x+22,y+20,5,0,Math.PI*2); ctx.fill(); ctx.fillStyle=rgba(154,163,199,0.95); ctx.font=`500 ${Math.max(11,Math.min(13,w*0.014))}px Outfit,sans-serif`; ctx.textAlign="left"; ctx.fillText("Prompt · 22 Sep 2026",x+36,y+24); const typeProg=smootherstep(0.04,0.28,p); const typed=PROMPT.slice(0,Math.floor(PROMPT.length*typeProg)); const caret=typeProg<0.99&&Math.floor(p*16)%2===0; ctx.fillStyle=rgba(232,236,255,0.96); ctx.font=`400 ${Math.max(13,Math.min(16,w*0.017))}px Outfit,sans-serif`; wrapText(ctx,typed+(caret?"▏":""),x+20,y+60,boxW-40,22); ctx.restore(); }
    const code=smoothstep(0.26,0.38,p)*(1-smootherstep(0.44,0.54,p));
    if(code>0.01){ ctx.save(); ctx.globalAlpha=code*0.92; const lineH=18, blockW=Math.min(440,st.aw*0.78); const x=st.cx-blockW/2, y0=st.cy-CODE_LINES.length*lineH*0.55; ctx.fillStyle=rgba(8,12,24,0.78); ctx.strokeStyle=rgba(80,140,200,0.35); roundRect(ctx,x-16,y0-20,blockW+32,CODE_LINES.length*lineH+36,12); ctx.fill(); ctx.stroke(); const reveal=smootherstep(0.28,0.48,p); for(let i=0;i<CODE_LINES.length;i++){ const lineOn=clamp((reveal*CODE_LINES.length-i)/1.1,0,1); if(lineOn<=0) continue; ctx.fillStyle=rgba(90,200,160,0.35); ctx.font=`400 ${Math.max(11,Math.min(13,w*0.014))}px ui-monospace,monospace`; ctx.textAlign="left"; ctx.fillText(String(i+1).padStart(2," "),x-4,y0+i*lineH); ctx.fillStyle=rgba(125,211,252,0.55+0.4*lineOn); ctx.fillText(CODE_LINES[i].slice(0,Math.floor(CODE_LINES[i].length*lineOn)),x+24,y0+i*lineH); } ctx.restore(); }
    const assemble=smootherstep(0.38,0.68,p);
    if(assemble>0.01){ const mobile=w<700; const fontSize=Math.max(28,Math.min(56,st.aw*0.12)); ctx.save(); ctx.font=`700 ${fontSize}px Orbitron,sans-serif`; const title="Objects In Space"; const tw=ctx.measureText(title).width; let tx,ty; if(mobile){tx=st.cx-tw/2;ty=st.cy-8;} else {tx=Math.max(st.x+24,Math.min(st.cx-tw*0.05,w-tw-40)); ty=Math.max(st.y+fontSize+8,st.cy);} ctx.restore();
      // Dense particles that visibly coalesce into the title glyph band
      const n=Math.floor(lerp(160,420,quality)); ctx.save(); ctx.globalCompositeOperation="lighter";
      for(let i=0;i<n;i++){ const birth=hash01(i*1.1); const on=clamp((assemble-birth*0.5)/0.45,0,1); if(on<=0) continue;
        // Bias destinations into letter-like columns across the title width
        const col=Math.floor(hash01(i*4.4)*14)/14; const u=col+(hash01(i*3.3)-0.5)*0.04;
        const fx=tx+u*tw, fy=ty-fontSize*(0.08+hash01(i*2)*0.72);
        const sx=st.cx+(hash01(i*2.1)-0.5)*st.aw*1.35, sy=st.cy+(hash01(i*4.4)-0.5)*st.ah*1.1;
        const ease=on*on*(3-2*on); const x=lerp(sx,fx,ease), y=lerp(sy,fy,ease);
        const a=(0.35+0.65*on)*(0.55+0.45*assemble); ctx.fillStyle=rgba(170,220,255,a); ctx.beginPath(); ctx.arc(x,y,(1.0+hash01(i*2)*2.8)*(0.35+ease*0.85),0,Math.PI*2); ctx.fill();
        if(on>0.75) drawGlow(ctx,x,y,6,{r:140,g:200,b:255},0.25*on); }
      for(let i=0;i<Math.floor(lerp(40,120,quality));i++){ const birth=hash01(i*7.7); const on=clamp((assemble-birth*0.65)/0.35,0,1); if(on<=0) continue; ctx.fillStyle=rgba(200,225,255,0.5*on); ctx.beginPath(); ctx.arc(hash01(i*3.1)*w,hash01(i*5.5)*h,0.7+hash01(i)*1.8,0,Math.PI*2); ctx.fill(); }
      const neb=smootherstep(0.42,0.65,p); if(neb>0){ drawGlow(ctx,w*0.22,h*0.32,280,{r:99,g:102,b:241},0.28*neb); drawGlow(ctx,w*0.78,h*0.22,250,{r:14,g:165,b:233},0.22*neb); drawGlow(ctx,w*0.58,h*0.72,280,{r:168,g:85,b:247},0.2*neb); } ctx.restore();
      const titleOn=smootherstep(0.52,0.70,p); if(titleOn>0.01){ ctx.save(); ctx.globalAlpha=Math.min(1,titleOn*1.1); ctx.fillStyle="#e8ecff"; ctx.font=`700 ${fontSize}px Orbitron,sans-serif`; ctx.textAlign="left"; ctx.shadowColor="rgba(125,211,252,0.55)"; ctx.shadowBlur=32; ctx.fillText(title,tx,ty); ctx.shadowBlur=0; const tagOn=smootherstep(0.55,0.72,p); ctx.globalAlpha=titleOn*tagOn; ctx.fillStyle=rgba(154,163,199,1); ctx.font=`300 ${Math.max(13,Math.min(20,st.aw*0.036))}px Outfit,sans-serif`; ctx.fillText("Projects that are the result of an exploding star.",tx,ty+fontSize*0.72); const pillsOn=smootherstep(0.68,0.85,p); if(pillsOn>0.01){ ctx.globalAlpha=titleOn*pillsOn*0.75; let px=tx; const py=ty+fontSize*0.72+38; for(const label of ["Weather Tracker","The Orrery","Stellar Events"]){ ctx.font="500 12px Outfit,sans-serif"; const pw=ctx.measureText(label).width+28; const g=ctx.createLinearGradient(px,py,px+pw,py+28); g.addColorStop(0,rgba(56,189,248,0.9)); g.addColorStop(1,rgba(129,140,248,0.9)); ctx.fillStyle=g; roundRect(ctx,px,py,pw,28,14); ctx.fill(); ctx.fillStyle=rgba(6,16,24,0.95); ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label,px+pw/2,py+14); ctx.textAlign="left"; ctx.textBaseline="alphabetic"; px+=pw+10; if(px>w-80) break; } } ctx.restore(); } }
    const here=smootherstep(0.78,0.92,p); if(here>0.01){ ctx.save(); ctx.globalAlpha=here*0.9; const y=Math.min(h-110,st.y+st.ah*0.9); ctx.fillStyle=rgba(125,211,252,0.95); ctx.font=`500 ${Math.max(11,st.aw*0.028)}px Orbitron,sans-serif`; ctx.textAlign="center"; ctx.fillText("YOU ARE HERE",st.cx,y); softDisc(ctx,st.cx,y,70,{r:125,g:211,b:252},0.22*here); ctx.restore(); }
    drawVignette(ctx,w,h,0.46); drawGrain(ctx,w,h,Math.floor(p*400+700),0.024,quality);
  }};
export default scene;
