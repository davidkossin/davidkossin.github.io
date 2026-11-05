/**
 * Chapter 8 — Finale (v4c) — page assembles; you are here.
 * Particles fully clear before the assemble checkpoint; single crisp title (no ghost).
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, rgba } from "../util.js";
import { stage } from "../globe.js?v=d130905";

const checkpoints = [
  { id:"assemble", at:0.40, timeLabel:"22 September 2026", title:"The page assembles",
    body:"Markup, styles, and scripts resolve into a dark canvas of stars, a nebula wash, and a title set in a geometric display face. The site's name and tagline take their places — the same elements visible on the home page today." },
  { id:"you-are-here", at:0.82, timeLabel:"about 13.8 billion years after the Big Bang", title:"You are here",
    body:"Light from the page reaches a display about 13.8 billion years after the Big Bang. Every nucleus heavier than lithium in the screen, the cables, and the reader was forged in stars or in their collisions. You are here." },
];

function softDisc(ctx,x,y,rad,color,a){
  const g=ctx.createRadialGradient(x,y,0,x,y,rad);
  g.addColorStop(0,rgba(color.r,color.g,color.b,a));
  g.addColorStop(0.55,rgba(color.r,color.g,color.b,a*0.35));
  g.addColorStop(1,rgba(color.r,color.g,color.b,0));
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
}
function roundRect(ctx,x,y,w,h,rad){
  ctx.beginPath();
  ctx.moveTo(x+rad,y);
  ctx.arcTo(x+w,y,x+w,y+h,rad);
  ctx.arcTo(x+w,y+h,x,y+h,rad);
  ctx.arcTo(x,y+h,x,y,rad);
  ctx.arcTo(x,y,x+w,y,rad);
  ctx.closePath();
}
function fitTitle(ctx, title, maxW, maxPx, minPx=16){
  let size=maxPx;
  while(size>minPx){
    ctx.font=`700 ${size}px Orbitron,Outfit,sans-serif`;
    if(ctx.measureText(title).width*1.1<=maxW) break;
    size-=1;
  }
  return size;
}

const scene={id:"finale",title:"Finale",weight:0.85,checkpoints,
  render(ctx,localProgress,view){
    const{w,h,quality=1}=view;
    const p=clamp(localProgress,0,1);
    const st=stage(view);
    ctx.fillStyle="#05060f";
    ctx.fillRect(0,0,w,h);

    const title="Objects In Space";
    const margin=Math.max(24, st.aw*0.06);
    const maxW=Math.max(100, Math.min(st.aw-margin*2, w-st.x-margin-16));
    const maxPx=Math.min(48, st.ah*0.14, maxW*0.09);
    ctx.save();
    let fontSize=fitTitle(ctx, title, maxW, maxPx, 16);
    ctx.font=`700 ${fontSize}px Orbitron,Outfit,sans-serif`;
    let tw=ctx.measureText(title).width;
    let tx=st.x+Math.max(0,(st.aw-tw)*0.5);
    while(tx+tw>w-24 && fontSize>16){
      fontSize-=1;
      ctx.font=`700 ${fontSize}px Orbitron,Outfit,sans-serif`;
      tw=ctx.measureText(title).width;
      tx=st.x+Math.max(0,(st.aw-tw)*0.5);
    }
    if(tx+tw>w-16) tx=Math.max(12, w-16-tw);
    const ty=st.y+st.ah*0.38;
    ctx.restore();

    // Particles only before assemble checkpoint (at=0.40)
    const particleVis = p >= 0.40 ? 0 : smootherstep(0.05, 0.22, p) * (1 - smootherstep(0.32, 0.39, p));
    if(particleVis>0.01){
      const n=Math.floor(lerp(120,320,quality));
      ctx.save(); ctx.globalCompositeOperation="lighter";
      for(let i=0;i<n;i++){
        const birth=hash01(i*1.1);
        const on=clamp((smootherstep(0.05,0.30,p)-birth*0.35)/0.5,0,1)*particleVis;
        if(on<=0) continue;
        const col=Math.floor(hash01(i*4.4)*14)/14;
        const u=col+(hash01(i*3.3)-0.5)*0.04;
        const fx=tx+u*tw, fy=ty-fontSize*(0.08+hash01(i*2)*0.72);
        const sx=st.cx+(hash01(i*2.1)-0.5)*st.aw*1.2;
        const sy=st.cy+(hash01(i*4.4)-0.5)*st.ah;
        const settle=smootherstep(0.15,0.35,p);
        const ease=on*on*(3-2*on);
        const x=lerp(sx,fx,ease*settle), y=lerp(sy,fy,ease*settle);
        ctx.fillStyle=rgba(170,220,255,0.5*on*particleVis);
        ctx.beginPath();
        ctx.arc(x,y,(1+hash01(i*2)*2.4)*(0.4+ease*0.7),0,Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    const neb=smootherstep(0.28,0.48,p);
    if(neb>0.01){
      ctx.save(); ctx.globalCompositeOperation="lighter";
      drawGlow(ctx,w*0.22,h*0.32,260,{r:99,g:102,b:241},0.26*neb);
      drawGlow(ctx,w*0.78,h*0.22,240,{r:14,g:165,b:233},0.2*neb);
      drawGlow(ctx,w*0.58,h*0.72,260,{r:168,g:85,b:247},0.18*neb);
      ctx.restore();
    }

    // Grain/vignette FIRST, then crisp title on top (no speckles on glyphs)
    drawVignette(ctx,w,h,0.42);
    drawGrain(ctx,w,h,Math.floor(p*400+700), p>=0.40 ? 0.012 : 0.022, quality);

    // Title fully formed from assemble checkpoint onward — one pass, no shadow, no ghost
    const titleOn=smootherstep(0.34,0.40,p);
    if(titleOn>0.01){
      ctx.save();
      ctx.globalAlpha=Math.min(1,titleOn);
      ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.shadowColor="transparent";
      softDisc(ctx, tx+tw*0.5, ty-fontSize*0.35, Math.max(tw,fontSize)*0.65, {r:90,g:160,b:255}, 0.12*titleOn);
      ctx.fillStyle="#e8ecff";
      ctx.font=`700 ${fontSize}px Orbitron,Outfit,sans-serif`;
      ctx.textAlign="left";
      ctx.textBaseline="alphabetic";
      ctx.fillText(title, tx, ty);

      const tag="Projects that are the result of an exploding star.";
      let tagSize=Math.max(12, Math.min(18, st.aw*0.032));
      ctx.font=`300 ${tagSize}px Outfit,sans-serif`;
      while(tagSize>11 && ctx.measureText(tag).width>maxW){
        tagSize-=1; ctx.font=`300 ${tagSize}px Outfit,sans-serif`;
      }
      const tagOn=smootherstep(0.36,0.42,p);
      ctx.globalAlpha=titleOn*Math.max(0.75, tagOn);
      ctx.fillStyle=rgba(154,163,199,1);
      ctx.fillText(tag, tx, ty+fontSize*0.72);

      const pillsOn=smootherstep(0.55,0.75,p)*(1-smootherstep(0.88,0.96,p)*0.25);
      if(pillsOn>0.01){
        ctx.globalAlpha=titleOn*pillsOn*0.8;
        let px=tx; const py=ty+fontSize*0.72+34;
        for(const label of ["Weather Tracker","The Orrery","Stellar Events"]){
          ctx.font="500 12px Outfit,sans-serif";
          const pw=ctx.measureText(label).width+28;
          if(px+pw>st.x+st.aw-8) break;
          const g=ctx.createLinearGradient(px,py,px+pw,py+28);
          g.addColorStop(0,rgba(56,189,248,0.9));
          g.addColorStop(1,rgba(129,140,248,0.9));
          ctx.fillStyle=g;
          roundRect(ctx,px,py,pw,28,14); ctx.fill();
          ctx.fillStyle=rgba(6,16,24,0.95);
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(label, px+pw/2, py+14);
          ctx.textAlign="left"; ctx.textBaseline="alphabetic";
          px+=pw+10;
        }
      }
      ctx.restore();
    }

    // You-are-here marker only — never redraw the title
    const here=smootherstep(0.70,0.86,p);
    if(here>0.01){
      ctx.save();
      ctx.globalAlpha=here*0.95;
      const y=Math.min(h-100, st.y+st.ah*0.82);
      softDisc(ctx, st.cx, y, 70, {r:125,g:211,b:252}, 0.26*here);
      ctx.fillStyle=rgba(125,211,252,0.98);
      ctx.font=`500 ${Math.max(12, Math.min(18, st.aw*0.034))}px Orbitron,Outfit,sans-serif`;
      ctx.textAlign="center";
      ctx.fillText("YOU ARE HERE", st.cx, y);
      ctx.restore();
    }
  }
};
export default scene;
