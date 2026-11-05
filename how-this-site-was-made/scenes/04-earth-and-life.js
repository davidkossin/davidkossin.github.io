/**
 * Chapter 4 — Earth and life (v3)
 * Deep-time close-ups / stylized land; late eras use Natural Earth globe.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, drawStarfield, rgba, mixRgb,
} from "../util.js";
import { stage, drawEarthGlobe, project } from "../globe.js?v=9e87e54";

const checkpoints = [
  { id:"oceans", at:0.06, timeLabel:"by about 4.4 to 4.0 billion years ago", title:"Oceans form",
    body:"As Earth cools from a molten Hadean surface, water vapor condenses and liquid oceans accumulate — supplied by outgassing and by volatile-rich impactors. Liquid water provides a medium for chemistry that will later support life. The early atmosphere lacks free oxygen." },
  { id:"earliest-life", at:0.16, timeLabel:"by about 3.5 to 3.8 billion years ago (possibly earlier)", title:"Earliest life",
    body:"Geological and isotopic evidence points to microbial life in the Archean. The first organisms were prokaryotes — cells without nuclei — metabolizing chemical energy in an anoxic world. Layered stromatolites and microbial mats are among the earliest fossil clues." },
  { id:"goe", at:0.28, timeLabel:"about 2.4 to 2.1 billion years ago", title:"Great Oxidation Event",
    body:"Oxygenic photosynthesis by cyanobacteria releases O₂ as a waste product. After sinks such as dissolved iron are saturated, free oxygen accumulates in the atmosphere and oceans — a permanent transformation of Earth's surface chemistry that enables new metabolisms and eventually an ozone shield. Banded iron formations record the transition." },
  { id:"eukaryotes", at:0.40, timeLabel:"by about 1.8 to 1.5 billion years ago (estimates vary)", title:"Eukaryotic cells",
    body:"Cells with nuclei and internal organelles appear. Mitochondria — descendants of once free-living bacteria — power these cells through endosymbiosis. Eukaryotes open evolutionary paths toward larger genomes and complex multicellular bodies." },
  { id:"multicellular", at:0.50, timeLabel:"from roughly 600 million years ago and earlier experiments", title:"Multicellular life",
    body:"Lineages evolve cooperation among cells, with division of labor and adhesion. Soft-bodied Ediacaran organisms — fronds, discs, and quilted forms — leave enigmatic fossils. Multicellularity arises more than once across the tree of life." },
  { id:"cambrian", at:0.60, timeLabel:"about 540 to 520 million years ago", title:"Cambrian explosion",
    body:"In a geologically short interval, most major animal body plans appear in the fossil record — arthropods, chordates, mollusks, and others. Eyes, shells, and active predation become widespread. Rising oxygen and ecological feedbacks likely contributed." },
  { id:"land", at:0.72, timeLabel:"plants from about 470 Myr ago; tetrapods by about 360 Myr ago", title:"Life on land",
    body:"Plants, fungi, and invertebrates colonize terrestrial habitats, followed by vertebrate tetrapods. Forests reshape soils and the carbon cycle. Amniote eggs free some vertebrates from returning to water to reproduce." },
  { id:"extinctions", at:0.86, timeLabel:"five major mass extinctions; K–Pg at 66 million years ago", title:"Mass extinctions, including K–Pg",
    body:"Recurring crises reset ecosystems. The end-Cretaceous (K–Pg) extinction, linked to a large asteroid impact at Chicxulub and to Deccan volcanism, eliminates non-avian dinosaurs and many other groups. Mammals and birds diversify in the aftermath." },
];

function softDisc(ctx,x,y,rad,color,a){const g=ctx.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,rgba(color.r,color.g,color.b,a));g.addColorStop(0.55,rgba(color.r,color.g,color.b,a*0.35));g.addColorStop(1,rgba(color.r,color.g,color.b,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();}

function drawStromatolites(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();ctx.globalAlpha=show;softDisc(ctx,cx,cy,R*1.15,{r:40,g:100,b:140},0.4);const baseY=cy+R*0.32;softDisc(ctx,cx,baseY+R*0.2,R*1.3,{r:90,g:70,b:45},0.5);const n=Math.floor(lerp(6,12,q));for(let i=0;i<n;i++){const x=cx+(i-(n-1)/2)*R*0.15+Math.sin(i+p)*3;const h=R*(0.24+hash01(i*2)*0.18),w=R*(0.08+hash01(i*3)*0.04);for(let L=0;L<7;L++){const t=L/7;ctx.fillStyle=rgba(50+L*16,95+L*14,70+L*8,0.55-t*0.05);ctx.beginPath();ctx.ellipse(x,baseY-h*t*0.9,w*(1-t*0.2),h*0.28*(1-t*0.15),0,0,Math.PI*2);ctx.fill();}softDisc(ctx,x,baseY-h*0.55,w*1.6,{r:100,g:220,b:160},0.15*show);}ctx.restore();}

function drawGOE(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();ctx.globalAlpha=show;drawEarthGlobe(ctx,cx,cy,R,{landMode:"rodinia",rotLon:10+p*18,ox:lerp(0.15,0.85,smootherstep(0.22,0.34,p)),clouds:0.15,quality:q,landRgb:{r:110,g:95,b:60}});ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();for(let i=0;i<9;i++){const y=cy-R*0.4+i*R*0.09;ctx.strokeStyle=rgba(160,55,35,0.4*show);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(cx-R*0.85,y);ctx.quadraticCurveTo(cx,y+(i%2?8:-8),cx+R*0.7,y+3);ctx.stroke();}ctx.restore();ctx.globalCompositeOperation="lighter";softDisc(ctx,cx,cy,R*1.8,{r:120,g:200,b:255},0.22*show);ctx.restore();}

function drawEukaryote(ctx,cx,cy,R,p,q,show){if(show<0.01)return;const s=R*0.95;ctx.save();ctx.globalAlpha=show;softDisc(ctx,cx,cy,s*1.4,{r:100,g:180,b:255},0.25);const mem=ctx.createRadialGradient(cx-s*0.25,cy-s*0.3,s*0.05,cx,cy,s);mem.addColorStop(0,rgba(210,240,255,0.55));mem.addColorStop(0.45,rgba(110,175,210,0.5));mem.addColorStop(1,rgba(20,50,95,0.7));ctx.fillStyle=mem;ctx.beginPath();ctx.ellipse(cx,cy,s,s*0.78,0.12,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(180,230,255,0.55);ctx.lineWidth=3;ctx.stroke();softDisc(ctx,cx-s*0.08,cy-s*0.04,s*0.34,{r:130,g:100,b:190},0.55);ctx.fillStyle=rgba(85,60,140,0.75);ctx.beginPath();ctx.ellipse(cx-s*0.08,cy-s*0.04,s*0.24,s*0.2,-0.2,0,Math.PI*2);ctx.fill();for(let i=0;i<Math.floor(lerp(4,7,q));i++){const ang=(i/6)*Math.PI*2+p*0.6;const md=s*(0.42+hash01(i)*0.12);const mx=cx+Math.cos(ang)*md,my=cy+Math.sin(ang)*md*0.72;ctx.save();ctx.translate(mx,my);ctx.rotate(ang);softDisc(ctx,0,0,s*0.16,{r:255,g:150,b:70},0.35);ctx.fillStyle=rgba(255,140,70,0.85);ctx.beginPath();ctx.ellipse(0,0,s*0.13,s*0.055,0,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.restore();}

function drawEdiacaran(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();ctx.globalAlpha=show;softDisc(ctx,cx,cy,R*1.25,{r:20,g:50,b:70},0.55);const floor=cy+R*0.42;softDisc(ctx,cx,floor+20,R*1.4,{r:70,g:60,b:40},0.5);[[-0.55,1],[-0.2,1.2],[0.15,1.05],[0.5,0.9]].forEach(([ox,sc],i)=>{const x=cx+ox*R,h=R*0.55*sc,sw=Math.sin(p*2.5+i)*10;ctx.strokeStyle=rgba(150,200,170,0.75);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,floor);ctx.quadraticCurveTo(x+sw*0.5,floor-h*0.5,x+sw,floor-h);ctx.stroke();for(let s=0;s<8;s++){const t=(s+0.5)/8;ctx.fillStyle=rgba(130,185,155,0.4);ctx.beginPath();ctx.ellipse(x+sw*t,floor-h*t,(1-t*0.25)*R*0.1*sc,R*0.045*sc,0,0,Math.PI*2);ctx.fill();}});ctx.restore();}

function drawCambrian(ctx,st,p,q,show){if(show<0.01)return;const{cx,cy,aw,ah,x:x0,y:y0}=st;ctx.save();ctx.globalAlpha=show;
  // FULL-BLEED underwater (no bubble)
  const water=ctx.createLinearGradient(x0,y0,x0,y0+ah);
  water.addColorStop(0,rgba(12,48,90,0.95));water.addColorStop(0.45,rgba(18,80,120,0.9));water.addColorStop(1,rgba(25,50,55,0.96));
  ctx.fillStyle=water;ctx.fillRect(x0,y0,aw,ah);
  softDisc(ctx,cx-aw*0.1,cy-ah*0.25,Math.max(aw,ah)*0.5,{r:80,g:170,b:220},0.25);
  ctx.save();ctx.globalCompositeOperation="lighter";
  for(let i=0;i<Math.floor(lerp(6,14,q));i++){const X=cx+(hash01(i*3)-0.5)*aw*0.9;const g=ctx.createLinearGradient(X,y0,X+35,y0+ah);g.addColorStop(0,rgba(140,210,255,0));g.addColorStop(0.4,rgba(140,210,255,0.12*show));g.addColorStop(1,rgba(140,210,255,0));ctx.fillStyle=g;ctx.fillRect(X-10,y0,28,ah);}ctx.restore();
  const floorY=cy+ah*0.32;softDisc(ctx,cx,floorY+50,aw*0.7,{r:80,g:65,b:40},0.7);
  for(let i=0;i<8;i++){const x=cx-aw*0.4+i*aw*0.11,h=30+hash01(i*4)*40;ctx.fillStyle=rgba(100,90,70,0.55);ctx.beginPath();ctx.moveTo(x-10,floorY);ctx.quadraticCurveTo(x-14,floorY-h*0.5,x,floorY-h);ctx.quadraticCurveTo(x+14,floorY-h*0.5,x+10,floorY);ctx.fill();}
  const swim=p*2.2;
  function trilobite(x,y,sc,flip){ctx.save();ctx.translate(x,y);ctx.scale(flip?-sc:sc,sc);softDisc(ctx,0,0,40,{r:60,g:100,b:130},0.25);ctx.fillStyle=rgba(25,40,55,0.92);ctx.beginPath();ctx.ellipse(-20,0,16,14,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(25,40,55,0.9);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-24,-11);ctx.lineTo(-40,-20);ctx.moveTo(-24,11);ctx.lineTo(-40,20);ctx.stroke();for(let s=0;s<8;s++){const sx=-6+s*7;ctx.beginPath();ctx.ellipse(sx,0,5.5,12-s*0.7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(40,55,70,0.75);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(sx,9);ctx.lineTo(sx+2,18);ctx.moveTo(sx,-9);ctx.lineTo(sx+2,-18);ctx.stroke();}ctx.beginPath();ctx.ellipse(38,0,10,9,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  trilobite(cx-aw*0.28,floorY-24,1.5,false);trilobite(cx-aw*0.02,floorY-16,1.25,true);trilobite(cx+aw*0.22,floorY-30,1.4,false);trilobite(cx+aw*0.38,floorY-12,1.0,true);
  // Anomalocaris
  const ax=cx+aw*0.2+Math.sin(swim)*20,ay=cy-ah*0.12+Math.cos(swim*0.7)*12;
  ctx.save();ctx.translate(ax,ay);softDisc(ctx,0,0,80,{r:50,g:90,b:130},0.25);ctx.fillStyle=rgba(18,32,48,0.9);ctx.beginPath();ctx.ellipse(0,0,72,24,-0.15,0,Math.PI*2);ctx.fill();
  for(let i=0;i<8;i++){ctx.globalAlpha=show*0.5;ctx.beginPath();ctx.ellipse(-24+i*12,16,10,5,0.25,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(-24+i*12,-16,10,5,-0.25,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=show;ctx.strokeStyle=rgba(18,32,48,0.92);ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(-60,-8);ctx.quadraticCurveTo(-90,-34,-115,-14);ctx.moveTo(-60,8);ctx.quadraticCurveTo(-90,34,-115,14);ctx.stroke();
  ctx.beginPath();ctx.moveTo(60,0);ctx.lineTo(90,-28);ctx.lineTo(76,0);ctx.lineTo(90,28);ctx.closePath();ctx.fill();ctx.restore();
  // Opabinia
  ctx.save();ctx.translate(cx-aw*0.12+Math.sin(swim*0.8)*14,cy+ah*0.02);softDisc(ctx,0,0,45,{r:60,g:100,b:90},0.2);ctx.fillStyle=rgba(40,70,60,0.88);ctx.beginPath();ctx.ellipse(0,0,36,12,0.1,0,Math.PI*2);ctx.fill();
  for(let i=0;i<5;i++){const ea=-0.8+i*0.4;ctx.fillStyle=rgba(200,220,100,0.75);ctx.beginPath();ctx.arc(Math.cos(ea)*16-20,Math.sin(ea)*12-10,4,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle=rgba(40,70,60,0.88);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-32,0);ctx.quadraticCurveTo(-58,-24,-75,-10);ctx.stroke();ctx.beginPath();ctx.arc(-75,-10,6,0,Math.PI*2);ctx.fill();ctx.restore();
  // Hallucigenia
  ctx.save();ctx.translate(cx+aw*0.08,floorY-32);ctx.strokeStyle=rgba(50,40,60,0.85);ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(-26,0);ctx.quadraticCurveTo(0,-5,26,0);ctx.stroke();
  for(let i=0;i<7;i++){const x=-20+i*7;ctx.beginPath();ctx.moveTo(x,-2);ctx.lineTo(x-3,-20-(i%2)*5);ctx.stroke();ctx.beginPath();ctx.moveTo(x,2);ctx.lineTo(x+2,12);ctx.stroke();}ctx.restore();
  // Marrella
  ctx.save();ctx.translate(cx-aw*0.3+Math.cos(swim*0.5)*10,cy-ah*0.06);ctx.fillStyle=rgba(30,50,70,0.85);ctx.beginPath();ctx.ellipse(0,0,16,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(30,50,70,0.8);ctx.lineWidth=2;
  for(let i=0;i<6;i++){const a=-0.6+i*0.25;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.cos(a)*22,Math.sin(a)*20-12,Math.cos(a)*40,Math.sin(a)*28-6);ctx.stroke();}ctx.restore();
  // Pikaia
  ctx.strokeStyle=rgba(35,60,75,0.8);ctx.lineWidth=5;ctx.beginPath();for(let i=0;i<=28;i++){const t=i/28,x=cx-aw*0.05-55+t*130,y=cy+ah*0.1+Math.sin(t*Math.PI*3+swim)*10;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
  ctx.globalCompositeOperation="lighter";for(let i=0;i<Math.floor(lerp(25,60,q));i++)softDisc(ctx,cx+(hash01(i*1.1)-0.5)*aw,cy+(hash01(i*2.2)-0.5)*ah*0.8,2+hash01(i)*5,{r:120,g:200,b:230},0.22*show);
  ctx.restore();}

function drawLandLife(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();ctx.globalAlpha=show;ctx.save();ctx.globalAlpha=show*0.3;drawEarthGlobe(ctx,cx,cy,R*0.9,{landMode:"pangaea",rotLon:p*10,ox:0.7,clouds:0.3,quality:q*0.8});ctx.restore();
  const ground=cy+R*0.35;softDisc(ctx,cx,ground+30,R*1.5,{r:50,g:80,b:40},0.5);for(let i=0;i<Math.floor(lerp(10,20,q));i++){const x=cx+(hash01(i*4)-0.5)*R*1.9,h=R*(0.3+hash01(i*2)*0.5);ctx.strokeStyle=rgba(50,120,65,0.85);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,ground);ctx.quadraticCurveTo(x+(hash01(i)-0.5)*14,ground-h*0.5,x,ground-h);ctx.stroke();ctx.fillStyle=rgba(70,150,85,0.75);ctx.beginPath();ctx.ellipse(x,ground-h,12+hash01(i*3)*14,8+hash01(i)*8,0.2,0,Math.PI*2);ctx.fill();}
  const tet=smootherstep(0.70,0.80,p);if(tet>0.02){const tx=cx+R*0.35,ty=ground-12;ctx.globalAlpha=show*tet;softDisc(ctx,tx,ty,55,{r:80,g:60,b:40},0.18);ctx.fillStyle=rgba(45,38,30,0.92);ctx.beginPath();ctx.ellipse(tx,ty,36,16,-0.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(tx-36,ty-6,16,10,-0.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(45,38,30,0.92);ctx.lineWidth=4;[[-16,12],[12,12],[-24,10],[20,10]].forEach(([lx,ly],i)=>{ctx.beginPath();ctx.moveTo(tx+lx,ty+6);ctx.lineTo(tx+lx+(i<2?-6:6),ty+ly+14);ctx.stroke();});}ctx.restore();}

function drawKPg(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();drawEarthGlobe(ctx,cx,cy,R,{landMode:"modern",rotLon:-70+p*15,ox:0.85,night:0.15,clouds:0.4,quality:q});const impact=smootherstep(0.80,0.92,p),after=smootherstep(0.88,0.98,p);ctx.globalCompositeOperation="lighter";const hit=project(-89.5,21.4,cx,cy,R,-70+p*15);if(hit){const glow=Math.sin(clamp(impact,0,1)*Math.PI)*0.75+after*0.2;drawGlow(ctx,hit.x,hit.y,40+glow*60,{r:255,g:190,b:100},0.45*glow);}ctx.globalCompositeOperation="source-over";const dust=smoothstep(0.84,0.92,p)*(1-smootherstep(0.94,1,p)*0.45);if(dust>0.01)softDisc(ctx,cx,cy,R*1.5,{r:70,g:50,b:35},0.32*dust);ctx.restore();}

const scene={id:"earth-and-life",title:"Earth and life",weight:1.4,checkpoints,
  render(ctx,localProgress,view){const{w,h,quality=1}=view;const p=clamp(localProgress,0,1);const st=stage(view);const{cx,cy,aw,ah}=st;const R=Math.min(aw,ah)*0.44;
    ctx.fillStyle="#05060f";ctx.fillRect(0,0,w,h);drawStarfield(ctx,w,h,Math.floor(55*quality),40,p*0.15,0.45);
    const oceansG=1-smootherstep(0.10,0.16,p),life=smoothstep(0.10,0.17,p)*(1-smootherstep(0.20,0.26,p)),goe=smoothstep(0.22,0.30,p)*(1-smootherstep(0.34,0.40,p)),euk=smoothstep(0.34,0.42,p)*(1-smootherstep(0.46,0.52,p)),edi=smoothstep(0.46,0.52,p)*(1-smootherstep(0.54,0.58,p)),cam=smoothstep(0.54,0.64,p)*(1-smootherstep(0.68,0.76,p)),land=smoothstep(0.66,0.76,p)*(1-smootherstep(0.80,0.88,p)),kpg=smootherstep(0.80,0.92,p);
    if(oceansG>0.02){ctx.save();ctx.globalAlpha=oceansG;const molten=1-smootherstep(0,0.08,p);drawEarthGlobe(ctx,cx,cy,R,{landMode:"ocean",rotLon:p*20,ox:0.05,molten,clouds:0,quality});ctx.restore();}
    drawStromatolites(ctx,cx,cy,R,p,quality,life);drawGOE(ctx,cx,cy,R,p,quality,goe);drawEukaryote(ctx,cx,cy,R,p,quality,euk);drawEdiacaran(ctx,cx,cy,R,p,quality,edi);drawCambrian(ctx,st,p,quality,cam);drawLandLife(ctx,cx,cy,R,p,quality,land);if(kpg>0.02)drawKPg(ctx,cx,cy,R,p,quality,kpg);
    drawVignette(ctx,w,h,0.5);drawGrain(ctx,w,h,Math.floor(p*700+200),0.026,quality);}};
export default scene;
