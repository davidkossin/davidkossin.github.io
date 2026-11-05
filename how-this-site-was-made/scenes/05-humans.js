/**
 * Chapter 5 — Humans (v4c) — dual globes fitted in safeContent, correctly centered
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, drawStarfield, rgba } from "../util.js";
import { stage, drawEarthGlobe, drawGlobePath, drawGlobeMarker, project } from "../globe.js?v=a09b8da";

const checkpoints = [
  { id:"sapiens", at:0.08, timeLabel:"about 300,000 years ago", title:"Homo sapiens",
    body:"Anatomically modern humans emerge in Africa. Fossil and genetic evidence place early Homo sapiens around 300,000 years ago. Cognitive and cultural capacities continue to evolve alongside other hominin populations that later go extinct." },
  { id:"dispersal", at:0.24, timeLabel:"major expansions from about 70,000 to 15,000 years ago", title:"Global dispersal",
    body:"Groups of Homo sapiens spread out of Africa into Eurasia, Australia, and eventually the Americas, adapting to climates from rainforests to tundra. They encounter and, in some regions, interbreed with Neanderthals and Denisovans. Routes followed coasts and inland corridors as ice ages waxed and waned." },
  { id:"agriculture", at:0.42, timeLabel:"beginning about 12,000 to 10,000 years ago", title:"Agriculture",
    body:"In multiple independent centers — including the Fertile Crescent, China, Mesoamerica, the Andes, New Guinea, the Sahel and Ethiopia, and eastern North America — people domesticate plants and animals. Farming supports denser populations and stored surplus, reshaping labor, property, and disease ecology." },
  { id:"cities", at:0.58, timeLabel:"from about 6,000 to 5,000 years ago onward", title:"Cities",
    body:"Urban settlements arise with specialized labor, monumental architecture, and long-distance trade. Cities concentrate innovation and inequality alike, and become hubs of states and empires that reorganize landscapes and peoples. Night lights begin to mark human density from orbit — a metaphor here for growing urban glow." },
  { id:"writing", at:0.72, timeLabel:"from about 5,400 to 5,000 years ago (earliest cuneiform)", title:"Writing",
    body:"Accounting tokens and pictographs develop into true writing systems capable of recording language. Mesopotamian cuneiform and Egyptian hieroglyphs are among the earliest. Writing enables administration, literature, law, and knowledge that outlasts a single generation’s memory." },
  { id:"printing", at:0.88, timeLabel:"movable type in East Asia earlier; Gutenberg press in Europe about 1450 CE", title:"Printing press",
    body:"Mechanical reproduction of text multiplies the reach of ideas. Movable type appears in East Asia centuries before Gutenberg’s European press accelerates literacy, scientific correspondence, and religious and political upheaval. Information begins to scale in a new way." },
];

/** Old World routes — visible when globe centers on Indian Ocean / Arabia (rotLon ≈ 70). */
const ROUTES_OLD = [
  // Africa → Levant / Arabia
  { start:0.10, end:0.20, pts:[[36,4],[38,12],[36,22],[35,30],[38,34]] },
  // → South Asia
  { start:0.12, end:0.22, pts:[[36,22],[48,20],[62,18],[78,14],[90,12],[98,8]] },
  // → Sahul (~65–50 kya)
  { start:0.14, end:0.24, pts:[[100,5],[112,0],[122,-6],[132,-14],[140,-22],[145,-28],[150,-32]] },
  // → Europe ~45 kya
  { start:0.13, end:0.23, pts:[[35,34],[28,40],[18,45],[8,48],[0,46],[-5,43]] },
  // → East Asia (ends near Japan / NE Asia for handoff feel)
  { start:0.14, end:0.24, pts:[[80,28],[95,34],[110,38],[122,36],[130,42],[138,40]] },
];
/** Pacific / Americas — visible when globe centers on North Pacific / Beringia (rotLon ≈ -170). */
const ROUTES_NEW = [
  // East Asia → Beringia
  { start:0.15, end:0.24, pts:[[140,42],[155,50],[170,58],[180,64],[-170,65]] },
  // Beringia → North America (~16–15 kya)
  { start:0.16, end:0.26, pts:[[-170,65],[-150,62],[-130,55],[-115,48],[-100,42]] },
  // → South America
  { start:0.18, end:0.28, pts:[[-100,40],[-95,25],[-85,10],[-75,-5],[-70,-20],[-68,-35],[-70,-45]] },
];
const AGRI = [
  { lon:43, lat:35, at:0.0 }, { lon:112, lat:34, at:0.08 }, { lon:-98, lat:19, at:0.14 }, { lon:-75, lat:-13, at:0.20 },
  { lon:144, lat:-6, at:0.26 }, { lon:2, lat:14, at:0.30 }, { lon:38, lat:9, at:0.34 }, { lon:-85, lat:38, at:0.38 },
];
const CITIES = [[31.2,30],[44.4,33.3],[12.5,41.9],[2.35,48.85],[-0.12,51.5],[37.6,55.75],[77.2,28.6],[116.4,39.9],[139.7,35.7],[151.2,-33.9],[-74,40.7],[-87.6,41.9],[-118.2,34.05],[-99.1,19.4],[-46.6,-23.55],[-58.4,-34.6],[18.4,-33.9],[100.5,13.75]];

function softDisc(ctx,x,y,rad,color,a){const g=ctx.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,rgba(color.r,color.g,color.b,a));g.addColorStop(0.55,rgba(color.r,color.g,color.b,a*0.35));g.addColorStop(1,rgba(color.r,color.g,color.b,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();}
function roundRect(ctx,x,y,w,h,rad){ctx.beginPath();ctx.moveTo(x+rad,y);ctx.arcTo(x+w,y,x+w,y+h,rad);ctx.arcTo(x+w,y+h,x,y+h,rad);ctx.arcTo(x,y+h,x,y,rad);ctx.arcTo(x,y,x+w,y,rad);ctx.closePath();}

function drawRoutesOnGlobe(ctx, routes, cx, cy, R, rotLon, p, disp) {
  for (const route of routes) {
    const on = smoothstep(route.start, route.end, p) * disp;
    if (on > 0.01) drawGlobePath(ctx, route.pts, cx, cy, R, rotLon, Math.min(1, on * 1.15), { r:255, g:190, b:90 }, 2.3);
  }
}

/** Place a small label near a lon/lat, clamped inside a safe box so it never clips. */
function drawSafeLabel(ctx, lon, lat, gcx, gcy, R, rotLon, text, box, fontPx) {
  const pt = project(lon, lat, gcx, gcy, R, rotLon);
  if (!pt || pt.z < 0.2) {
    // fallback: below/ beside globe center inside box
    return;
  }
  let x = pt.x, y = pt.y + 14;
  ctx.font = `500 ${fontPx}px Outfit,sans-serif`;
  const tw = ctx.measureText(text).width;
  x = clamp(x, box.x + tw * 0.5 + 4, box.x + box.w - tw * 0.5 - 4);
  y = clamp(y, box.y + fontPx + 4, box.y + box.h - 4);
  ctx.fillStyle = rgba(255, 210, 140, 0.9);
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

const scene = { id:"humans", title:"Humans", weight:1.15, checkpoints,
  render(ctx, localProgress, view) {
    const { w,h,quality=1 }=view; const p=clamp(localProgress,0,1); const st=stage(view); const {cx,cy,aw,ah,x:sx,y:sy}=st;
    ctx.fillStyle="#05060f"; ctx.fillRect(0,0,w,h); drawStarfield(ctx,w,h,Math.floor(50*quality),51,p*0.12,0.4);
    const night=smootherstep(0.48,0.65,p);
    const overlay=smootherstep(0.62,0.78,p);
    const dual = smootherstep(0.08,0.16,p) * (1 - smootherstep(0.36,0.46,p));
    const single = 1 - dual;
    const mobile = w < 700;

    if (dual > 0.02) {
      const pad = Math.max(14, Math.min(aw, ah) * 0.04);
      const box = { x: sx + pad, y: sy + pad, w: aw - pad * 2, h: ah - pad * 2 };
      // Leave a little room under globes for labels
      const labelBand = mobile ? 22 : 20;
      let gx1, gy1, gx2, gy2, R;

      if (mobile) {
        // Stack vertically — both fully inside safeContent
        const gap = 18;
        const availH = box.h - gap - labelBand * 2;
        R = Math.min(box.w * 0.42, availH * 0.24);
        gx1 = box.x + box.w * 0.5;
        gx2 = gx1;
        gy1 = box.y + R + labelBand * 0.3;
        gy2 = box.y + box.h - R - labelBand * 0.3;
        // Ensure no overlap
        if (gy2 - gy1 < 2 * R + gap) {
          R = Math.max(40, (box.h - gap - labelBand * 2) / 4);
          gy1 = box.y + R + 8;
          gy2 = box.y + box.h - R - 8;
        }
      } else {
        // Side by side — both fully inside safeContent with margin
        const gap = Math.max(20, box.w * 0.04);
        const availW = box.w - gap;
        R = Math.min(availW / 4, (box.h - labelBand) / 2) * 0.92;
        gx1 = box.x + R + 4;
        gx2 = box.x + box.w - R - 4;
        gy1 = box.y + box.h * 0.48;
        gy2 = gy1;
        // Hard fit guarantee
        if (gx1 + R + gap / 2 > gx2 - R) {
          R = Math.max(50, (box.w - gap - 8) / 4);
          gx1 = box.x + R + 4;
          gx2 = box.x + box.w - R - 4;
        }
      }

      // Globe 1: Indian Ocean / Arabia — Africa, ME, Europe, S Asia, Australia
      const rotOld = 70;
      // Globe 2: North Pacific / Beringia — East Asia, Beringia, Americas
      const rotNew = -170;

      ctx.save(); ctx.globalAlpha = dual;
      drawEarthGlobe(ctx, gx1, gy1, R, { landMode:"modern", rotLon:rotOld, ox:0.9, night:0.05, clouds:0.35, quality });
      drawEarthGlobe(ctx, gx2, gy2, R, { landMode:"modern", rotLon:rotNew, ox:0.9, night:0.05, clouds:0.35, quality });

      const origin = project(36, 5, gx1, gy1, R, rotOld);
      if (origin) {
        ctx.globalCompositeOperation = "lighter";
        drawGlow(ctx, origin.x, origin.y, 14, { r:255, g:210, b:100 }, 0.55 * dual);
        ctx.globalCompositeOperation = "source-over";
      }
      drawRoutesOnGlobe(ctx, ROUTES_OLD, gx1, gy1, R, rotOld, p, dual);
      drawRoutesOnGlobe(ctx, ROUTES_NEW, gx2, gy2, R, rotNew, p, dual);

      // Labels fully inside safe box
      ctx.globalAlpha = dual * 0.85;
      const fontPx = Math.max(9, Math.min(12, R * 0.09));
      drawSafeLabel(ctx, 145, -28, gx1, gy1, R, rotOld, "~65–50 kya Sahul", box, fontPx);
      drawSafeLabel(ctx, -2, 46, gx1, gy1, R, rotOld, "~45 kya Europe", box, fontPx);
      drawSafeLabel(ctx, -155, 62, gx2, gy2, R, rotNew, "~16–15 kya Beringia", box, fontPx);
      drawSafeLabel(ctx, -70, -30, gx2, gy2, R, rotNew, "~15–12 kya", box, fontPx);

      // Fallback labels under each globe if projections missed (guaranteed visible)
      ctx.font = `500 ${fontPx}px Outfit,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(255, 210, 140, 0.75);
      const under1 = clamp(gy1 + R + fontPx + 4, box.y + fontPx, box.y + box.h - 2);
      const under2 = clamp(gy2 + R + fontPx + 4, box.y + fontPx, box.y + box.h - 2);
      // Only draw under-globe captions if projection labels may be tight on mobile
      if (mobile) {
        ctx.fillText("Out of Africa → Eurasia / Sahul", gx1, under1);
        ctx.fillText("Beringia → Americas", gx2, under2);
      }
      ctx.restore();
    }

    const R = Math.min(aw, ah) * 0.50;
    const rotLon = 20 + p * 30;
    if (single > 0.05) {
      ctx.save(); ctx.globalAlpha = single * (1 - overlay * 0.55);
      drawEarthGlobe(ctx, cx, cy, R, { landMode:"modern", rotLon, ox:0.9, night, clouds:0.4, quality });
      ctx.restore();
      const dispFade = smootherstep(0.34,0.40,p) * (1 - smootherstep(0.42,0.50,p));
      if (dispFade > 0.01) {
        drawRoutesOnGlobe(ctx, [...ROUTES_OLD, ...ROUTES_NEW], cx, cy, R, rotLon, Math.min(1, p + 0.15), dispFade);
      }
    }

    const agr=smootherstep(0.34,0.52,p)*(1-smootherstep(0.56,0.68,p)*0.35);
    if (agr>0.01) { ctx.save(); ctx.globalCompositeOperation="lighter"; for (const c of AGRI) { const on=clamp((agr-c.at)/0.22,0,1); if(on>0) drawGlobeMarker(ctx,c.lon,c.lat,cx,cy,R,rotLon,{r:140,g:230,b:150},8*on,"diamond"); } ctx.restore(); }
    const city=smootherstep(0.50,0.70,p);
    if (city>0.01) { ctx.save(); ctx.globalCompositeOperation="lighter"; const n=Math.floor(lerp(10,CITIES.length,quality)); for(let i=0;i<n;i++){ const [lon,lat]=CITIES[i]; const on=clamp((city-hash01(i*2)*0.3)/0.5,0,1); if(on<=0) continue; const pt=project(lon,lat,cx,cy,R,rotLon); if(!pt||pt.z<0.1) continue; drawGlow(ctx,pt.x,pt.y,7+on*8,{r:255,g:210,b:120},0.55*on*pt.z); ctx.fillStyle=rgba(255,235,180,0.9*on); ctx.fillRect(pt.x-1.3,pt.y-1.3,2.6,2.6);} ctx.restore(); }
    const wr=smoothstep(0.64,0.78,p)*(1-smootherstep(0.84,0.95,p)*0.5);
    if (wr>0.01) { const tw=Math.min(230,R*1.2), th=tw*0.72; const x=clamp(cx+R*0.5,tw*0.55,st.x+aw-tw*0.55), y=cy; ctx.save(); ctx.globalAlpha=wr; softDisc(ctx,x,y,tw*0.7,{r:180,g:140,b:80},0.2); ctx.fillStyle=rgba(165,125,75,0.92); roundRect(ctx,x-tw/2,y-th/2,tw,th,10); ctx.fill(); const typeOn=smootherstep(0.66,0.82,p); ctx.fillStyle=rgba(45,28,12,0.8); for(let i=0;i<Math.floor(lerp(12,30,quality));i++){ if(i/28>typeOn) break; const col=i%7,row=(i/7)|0; const gx=x-tw*0.38+col*(tw*0.11), gy=y-th*0.3+row*(th*0.18); ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+9,gy+2); ctx.lineTo(gx+1,gy+6); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    const pr=smootherstep(0.80,0.96,p);
    if (pr>0.01) { ctx.save(); ctx.globalAlpha=pr; softDisc(ctx,cx,cy,R*0.75,{r:160,g:140,b:255},0.16); ctx.fillStyle=rgba(35,30,50,0.95); ctx.fillRect(cx-60,cy-45,120,90); ctx.strokeStyle=rgba(180,170,220,0.55); ctx.strokeRect(cx-60,cy-45,120,90); ctx.fillStyle=rgba(70,60,95,0.95); ctx.fillRect(cx-48,cy-22,96,14); ctx.fillStyle=rgba(160,160,185,0.85); ctx.fillRect(cx-6,cy-62,12,42); ctx.beginPath(); ctx.arc(cx,cy-64,14,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation="lighter"; for(let i=0;i<Math.floor(lerp(8,16,quality));i++){ const ang=(i/14)*Math.PI*2+p*0.4; const on=clamp((pr-i/14*0.35)/0.5,0,1); ctx.fillStyle=rgba(230,230,245,0.22*on); ctx.save(); ctx.translate(cx+Math.cos(ang)*80*on,cy+Math.sin(ang)*55*on); ctx.rotate(ang*0.3); ctx.fillRect(-11,-15,22,30); ctx.restore(); } ctx.restore(); }
    drawVignette(ctx,w,h,0.5); drawGrain(ctx,w,h,Math.floor(p*500+300),0.026,quality);
  }
};
export default scene;
