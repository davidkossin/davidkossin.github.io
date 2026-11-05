/**
 * Chapter 4 — Earth and life (v3)
 * Deep-time close-ups / stylized land; late eras use Natural Earth globe.
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01,
  drawGlow, drawVignette, drawGrain, drawStarfield, rgba, mixRgb,
} from "../util.js";
import { stage, drawEarthGlobe, project } from "../globe.js?v=c4a3648";

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

function drawCambrian(ctx,st,p,q,show,view){if(show<0.01)return;const{w,h}=view;const{cx,cy,aw,ah}=st;ctx.save();ctx.globalAlpha=show;
  // FULL-CANVAS underwater — soft fog into edges (no hard rectangle)
  const water=ctx.createLinearGradient(0,0,0,h);
  water.addColorStop(0,rgba(6,40,85,0.98));water.addColorStop(0.35,rgba(12,85,125,0.97));water.addColorStop(0.7,rgba(18,70,90,0.97));water.addColorStop(1,rgba(30,48,42,0.98));
  ctx.fillStyle=water;ctx.fillRect(0,0,w,h);
  softDisc(ctx,cx-aw*0.05,cy-ah*0.28,Math.max(w,h)*0.42,{r:90,g:180,b:230},0.28);
  softDisc(ctx,cx+aw*0.2,cy-ah*0.05,Math.max(w,h)*0.28,{r:50,g:130,b:190},0.16);
  // Caustic rays
  ctx.save();ctx.globalCompositeOperation="lighter";
  for(let i=0;i<Math.floor(lerp(8,18,q));i++){const X=w*(0.08+hash01(i*3.1)*0.84);const sway=Math.sin(p*2+i)*18;const g=ctx.createLinearGradient(X,0,X+sway+50,h);g.addColorStop(0,rgba(150,215,255,0));g.addColorStop(0.35,rgba(150,215,255,0.14*show));g.addColorStop(1,rgba(150,215,255,0));ctx.fillStyle=g;ctx.fillRect(X-16,0,36,h);}ctx.restore();
  // Far hazy silhouettes (depth layer)
  ctx.save();ctx.globalAlpha=show*0.28;
  for(let i=0;i<7;i++){const fx=w*(0.1+hash01(i*2.2)*0.8),fy=h*(0.25+hash01(i*3.3)*0.35),fs=30+hash01(i)*50;ctx.fillStyle=rgba(20,50,70,0.9);ctx.beginPath();ctx.ellipse(fx,fy,fs,fs*0.28,hash01(i)-0.5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  // Seafloor sediment across full width
  const floorY=h*0.72;softDisc(ctx,w*0.5,floorY+80,w*0.7,{r:90,g:70,b:42},0.75);
  softDisc(ctx,w*0.3,floorY+40,w*0.35,{r:70,g:55,b:35},0.4);softDisc(ctx,w*0.7,floorY+50,w*0.4,{r:80,g:60,b:38},0.45);
  // Sponges / algae along seafloor
  for(let i=0;i<18;i++){const x=w*(0.05+i/18*0.9),hh=24+hash01(i*4.2)*70,ww=7+hash01(i*2)*12;const kind=hash01(i*7);
    if(kind<0.45){ // vase sponge
      ctx.fillStyle=rgba(100+hash01(i)*50,90,65,0.55);ctx.beginPath();ctx.moveTo(x-ww,floorY);ctx.quadraticCurveTo(x-ww*1.15,floorY-hh*0.5,x-ww*0.35,floorY-hh);ctx.lineTo(x+ww*0.35,floorY-hh);ctx.quadraticCurveTo(x+ww*1.15,floorY-hh*0.5,x+ww,floorY);ctx.closePath();ctx.fill();
      for(let k=0;k<3;k++){ctx.fillStyle=rgba(35,45,40,0.35);ctx.beginPath();ctx.arc(x+(hash01(i+k)-0.5)*ww*0.6,floorY-hh*(0.35+hash01(k)*0.45),1.5+hash01(k+i)*2.2,0,Math.PI*2);ctx.fill();}
    } else { // branching algae
      ctx.strokeStyle=rgba(60,110,80,0.55);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,floorY);ctx.quadraticCurveTo(x+(hash01(i)-0.5)*16,floorY-hh*0.5,x+(hash01(i*2)-0.5)*10,floorY-hh);ctx.stroke();
      for(let b=0;b<3;b++){const t=0.35+b*0.2;ctx.beginPath();ctx.moveTo(lerp(x,x+(hash01(i*2)-0.5)*10,t),lerp(floorY,floorY-hh,t));ctx.lineTo(lerp(x,x+(hash01(i*2)-0.5)*10,t)+(hash01(b+i)-0.5)*18,lerp(floorY,floorY-hh,t)-10);ctx.stroke();}
    }
  }
  const swim=p*2.4;
  // Proper trilobite — top-down/oblique: cephalon + genal spines, 3-lobed thorax, pygidium; tiny edge legs only
  function trilobite(x,y,sc,ang,tint){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.scale(sc,sc);
    softDisc(ctx,0,0,28,{r:tint[0],g:tint[1],b:tint[2]},0.2);
    const shell=rgba(tint[0],tint[1],tint[2],0.95);
    const ridge=rgba(Math.min(255,tint[0]+40),Math.min(255,tint[1]+32),Math.min(255,tint[2]+28),0.8);
    // Top-down oval body plan: cephalon → thorax → pygidium
    // Cephalon
    ctx.fillStyle=shell;ctx.beginPath();ctx.ellipse(0,-16,15,11,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ridge;ctx.beginPath();ctx.ellipse(0,-15,5.5,8,0,0,Math.PI*2);ctx.fill(); // glabella
    // Genal spines (short, rearward)
    ctx.strokeStyle=shell;ctx.lineWidth=2.2;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(-13,-12);ctx.quadraticCurveTo(-18,-4,-17,4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(13,-12);ctx.quadraticCurveTo(18,-4,17,4);ctx.stroke();
    // Thorax — three distinct lobes per segment (compact, not comb-like)
    for(let s=0;s<7;s++){const sy=-4+s*5.2;const hw=13-s*0.4;
      ctx.fillStyle=shell;
      ctx.beginPath();ctx.ellipse(-hw*0.55,sy,hw*0.38,2.6,0,0,Math.PI*2);ctx.fill(); // left pleural
      ctx.beginPath();ctx.ellipse(hw*0.55,sy,hw*0.38,2.6,0,0,Math.PI*2);ctx.fill();  // right pleural
      ctx.fillStyle=ridge;ctx.beginPath();ctx.ellipse(0,sy,4.2,2.8,0,0,Math.PI*2);ctx.fill(); // axial
      ctx.strokeStyle=rgba(12,20,30,0.3);ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(-hw*0.85,sy);ctx.lineTo(hw*0.85,sy);ctx.stroke();
      // tiny edge legs only
      if(s%3===0){ctx.strokeStyle=rgba(tint[0],tint[1],tint[2],0.45);ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(-hw*0.9,sy);ctx.lineTo(-hw*0.9-3.5,sy+2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(hw*0.9,sy);ctx.lineTo(hw*0.9+3.5,sy+2);ctx.stroke();}
    }
    // Pygidium
    ctx.fillStyle=shell;ctx.beginPath();ctx.ellipse(0,34,10,7,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ridge;ctx.beginPath();ctx.ellipse(0,33,4,5,0,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation="lighter";softDisc(ctx,-8,-18,4,{r:150,g:190,b:130},0.3);softDisc(ctx,8,-18,4,{r:150,g:190,b:130},0.3);
    ctx.restore();}
  trilobite(cx-aw*0.28,floorY-36,1.55,0.15,[40,58,72]);
  trilobite(cx-aw*0.02,floorY-22,1.25,-0.25,[48,65,78]);
  trilobite(cx+aw*0.22,floorY-48,1.4,0.35,[35,52,68]);
  trilobite(cx+aw*0.38,floorY-18,1.05,-0.1,[50,68,82]);
  // Anomalocaris — lateral flaps, segmented frontal appendages, stalked eyes
  const ax=cx+aw*0.16+Math.sin(swim)*22,ay=cy-ah*0.12+Math.cos(swim*0.7)*12;
  ctx.save();ctx.translate(ax,ay);ctx.rotate(-0.1+Math.sin(swim)*0.04);softDisc(ctx,0,0,100,{r:60,g:110,b:150},0.28);
  // lateral swimming flaps (behind body)
  for(let i=0;i<12;i++){const bx=-48+i*9;const flap=10+Math.sin(swim*1.5+i*0.6)*3;ctx.globalAlpha=show*(0.4+0.25*Math.sin(swim+i));
    ctx.fillStyle=rgba(30,55,80,0.8);ctx.beginPath();ctx.ellipse(bx,20,11,flap,0.15,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(bx,-20,11,flap,-0.15,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=show;
  // body
  ctx.fillStyle=rgba(22,42,62,0.94);ctx.beginPath();ctx.ellipse(0,0,78,26,-0.04,0,Math.PI*2);ctx.fill();
  // body segmentation hint
  ctx.strokeStyle=rgba(40,70,95,0.4);ctx.lineWidth=1;
  for(let i=0;i<8;i++){ctx.beginPath();ctx.ellipse(-40+i*12,0,6,22,0,0,Math.PI*2);ctx.stroke();}
  // circular mouth
  softDisc(ctx,-68,0,14,{r:50,g:90,b:110},0.45);ctx.fillStyle=rgba(180,70,55,0.75);ctx.beginPath();ctx.arc(-70,0,7,0,Math.PI*2);ctx.fill();
  // stalked eyes
  ctx.strokeStyle=rgba(30,55,75,0.9);ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(-52,-12);ctx.lineTo(-62,-28);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-52,12);ctx.lineTo(-62,28);ctx.stroke();
  ctx.fillStyle=rgba(230,235,120,0.92);ctx.beginPath();ctx.arc(-64,-30,6,0,Math.PI*2);ctx.arc(-64,30,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=rgba(30,40,20,0.85);ctx.beginPath();ctx.arc(-64,-30,2.5,0,Math.PI*2);ctx.arc(-64,30,2.5,0,Math.PI*2);ctx.fill();
  // Segmented frontal appendages
  function appendage(side){const sy=side*10;ctx.save();ctx.translate(-72,sy);ctx.rotate(side*0.55+Math.sin(swim)*0.08);
    for(let seg=0;seg<6;seg++){const a=-0.35*seg;ctx.rotate(a*0.15);ctx.fillStyle=rgba(28,50,70,0.92);ctx.beginPath();ctx.roundRect?ctx.roundRect(0,-4,16,8,3):(ctx.rect(0,-4,16,8));ctx.fill();
      // inward spines
      ctx.strokeStyle=rgba(40,70,95,0.85);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(10,-side*10);ctx.stroke();
      ctx.translate(14,0);}
    ctx.restore();}
  // fallback if roundRect missing — use ellipse segments instead
  function appendageSafe(side){const sy=side*12;let px=-74,py=sy,ang=side*0.9;
    for(let seg=0;seg<6;seg++){ang+=side*0.18;px+=Math.cos(ang)*13;py+=Math.sin(ang)*13;
      ctx.fillStyle=rgba(28,50,70,0.92);ctx.beginPath();ctx.ellipse(px,py,8,3.5,ang,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=rgba(50,80,105,0.8);ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(ang-side*1.2)*9,py+Math.sin(ang-side*1.2)*9);ctx.stroke();}}
  appendageSafe(-1);appendageSafe(1);
  // tail fan
  ctx.fillStyle=rgba(22,42,62,0.9);ctx.beginPath();ctx.moveTo(70,0);ctx.lineTo(110,-32);ctx.lineTo(92,0);ctx.lineTo(110,32);ctx.closePath();ctx.fill();
  ctx.restore();
  // Opabinia
  ctx.save();ctx.translate(cx-aw*0.12+Math.sin(swim*0.85)*16,cy+ah*0.02);softDisc(ctx,0,0,50,{r:70,g:130,b:100},0.24);ctx.fillStyle=rgba(42,82,68,0.92);ctx.beginPath();ctx.ellipse(8,0,40,14,0.08,0,Math.PI*2);ctx.fill();
  for(let i=0;i<5;i++){const ea=-1.0+i*0.5;const ex=Math.cos(ea)*18-16,ey=Math.sin(ea)*13-11;ctx.fillStyle=rgba(230,240,120,0.9);ctx.beginPath();ctx.arc(ex,ey,5,0,Math.PI*2);ctx.fill();ctx.fillStyle=rgba(30,40,20,0.8);ctx.beginPath();ctx.arc(ex,ey,1.8,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle=rgba(42,82,68,0.95);ctx.lineWidth=3.5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-28,0);ctx.quadraticCurveTo(-58,-28,-84,-6);ctx.stroke();
  ctx.fillStyle=rgba(42,82,68,0.95);ctx.beginPath();ctx.arc(-84,-6,7,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=rgba(42,82,68,0.7);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-84,-6);ctx.lineTo(-96,-12);ctx.moveTo(-84,-6);ctx.lineTo(-96,0);ctx.stroke();ctx.restore();
  // Hallucigenia
  ctx.save();ctx.translate(cx+aw*0.08,floorY-44);ctx.strokeStyle=rgba(70,55,85,0.88);ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(-30,0);ctx.quadraticCurveTo(0,-6,30,0);ctx.stroke();
  for(let i=0;i<7;i++){const x=-24+i*8;ctx.strokeStyle=rgba(90,70,110,0.88);ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(x,-2);ctx.lineTo(x-3,-24-(i%2)*6);ctx.stroke();ctx.beginPath();ctx.moveTo(x,2);ctx.lineTo(x+2,12);ctx.stroke();
    ctx.fillStyle=rgba(180,140,220,0.5);ctx.beginPath();ctx.arc(x-3,-24-(i%2)*6,2.5,0,Math.PI*2);ctx.fill();}ctx.restore();
  // Marrella
  ctx.save();ctx.translate(cx-aw*0.32+Math.cos(swim*0.55)*12,cy-ah*0.06);softDisc(ctx,0,0,36,{r:45,g:85,b:120},0.2);ctx.fillStyle=rgba(32,55,78,0.9);ctx.beginPath();ctx.ellipse(0,0,18,10,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(48,85,115,0.85);ctx.lineWidth=2;
  for(let i=0;i<8;i++){const a=-0.85+i*0.24;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.cos(a)*26,Math.sin(a)*22-12,Math.cos(a)*48,Math.sin(a)*32-6);ctx.stroke();}ctx.restore();
  // Pikaia
  ctx.save();ctx.lineWidth=5.5;ctx.lineCap="round";const pg=ctx.createLinearGradient(cx-aw*0.2,0,cx+aw*0.22,0);pg.addColorStop(0,rgba(40,80,95,0.15));pg.addColorStop(0.5,rgba(50,110,120,0.88));pg.addColorStop(1,rgba(40,80,95,0.15));ctx.strokeStyle=pg;ctx.beginPath();
  for(let i=0;i<=36;i++){const t=i/36,x=cx-aw*0.1-60+t*150,y=cy+ah*0.14+Math.sin(t*Math.PI*3.5+swim)*12;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
  ctx.strokeStyle=rgba(180,220,200,0.3);ctx.lineWidth=1.4;ctx.beginPath();for(let i=0;i<=36;i++){const t=i/36,x=cx-aw*0.1-60+t*150,y=cy+ah*0.14+Math.sin(t*Math.PI*3.5+swim)*12;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.restore();
  // Marine snow
  ctx.globalCompositeOperation="lighter";for(let i=0;i<Math.floor(lerp(40,90,q));i++)softDisc(ctx,hash01(i*1.1)*w,hash01(i*2.2)*h*0.85,2+hash01(i)*5,{r:140,g:210,b:240},0.25*show);
  // Soft fog falloff into edges (behind translucent placard)
  ctx.globalCompositeOperation="source-over";
  // Soft continuous vignette into all edges (no portal/box shape)
  const fog=ctx.createRadialGradient(w*0.55,h*0.45,Math.min(w,h)*0.45,w*0.5,h*0.5,Math.max(w,h)*0.85);
  fog.addColorStop(0,rgba(0,0,0,0));fog.addColorStop(0.65,rgba(4,12,24,0.08));fog.addColorStop(1,rgba(3,8,16,0.55));
  ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
  const edgeL=ctx.createLinearGradient(0,0,w*0.18,0);edgeL.addColorStop(0,rgba(3,8,16,0.5));edgeL.addColorStop(1,rgba(3,8,16,0));ctx.fillStyle=edgeL;ctx.fillRect(0,0,w*0.2,h);
  const edgeR=ctx.createLinearGradient(w,0,w*0.82,0);edgeR.addColorStop(0,rgba(3,8,16,0.5));edgeR.addColorStop(1,rgba(3,8,16,0));ctx.fillStyle=edgeR;ctx.fillRect(w*0.8,0,w*0.2,h);
  const edgeT=ctx.createLinearGradient(0,0,0,h*0.1);edgeT.addColorStop(0,rgba(3,8,16,0.4));edgeT.addColorStop(1,rgba(3,8,16,0));ctx.fillStyle=edgeT;ctx.fillRect(0,0,w,h*0.12);
  const edgeB=ctx.createLinearGradient(0,h,0,h*0.88);edgeB.addColorStop(0,rgba(3,8,16,0.55));edgeB.addColorStop(1,rgba(3,8,16,0));ctx.fillStyle=edgeB;ctx.fillRect(0,h*0.86,w,h*0.14);
  ctx.restore();}


function drawLandLife(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();ctx.globalAlpha=show;ctx.save();ctx.globalAlpha=show*0.3;drawEarthGlobe(ctx,cx,cy,R*0.9,{landMode:"pangaea",rotLon:p*10,ox:0.7,clouds:0.3,quality:q*0.8});ctx.restore();
  const ground=cy+R*0.35;softDisc(ctx,cx,ground+30,R*1.5,{r:50,g:80,b:40},0.5);for(let i=0;i<Math.floor(lerp(10,20,q));i++){const x=cx+(hash01(i*4)-0.5)*R*1.9,h=R*(0.3+hash01(i*2)*0.5);ctx.strokeStyle=rgba(50,120,65,0.85);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,ground);ctx.quadraticCurveTo(x+(hash01(i)-0.5)*14,ground-h*0.5,x,ground-h);ctx.stroke();ctx.fillStyle=rgba(70,150,85,0.75);ctx.beginPath();ctx.ellipse(x,ground-h,12+hash01(i*3)*14,8+hash01(i)*8,0.2,0,Math.PI*2);ctx.fill();}
  const tet=smootherstep(0.70,0.80,p);if(tet>0.02){const tx=cx+R*0.35,ty=ground-12;ctx.globalAlpha=show*tet;softDisc(ctx,tx,ty,55,{r:80,g:60,b:40},0.18);ctx.fillStyle=rgba(45,38,30,0.92);ctx.beginPath();ctx.ellipse(tx,ty,36,16,-0.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(tx-36,ty-6,16,10,-0.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(45,38,30,0.92);ctx.lineWidth=4;[[-16,12],[12,12],[-24,10],[20,10]].forEach(([lx,ly],i)=>{ctx.beginPath();ctx.moveTo(tx+lx,ty+6);ctx.lineTo(tx+lx+(i<2?-6:6),ty+ly+14);ctx.stroke();});}ctx.restore();}

function drawKPg(ctx,cx,cy,R,p,q,show){if(show<0.01)return;ctx.save();drawEarthGlobe(ctx,cx,cy,R,{landMode:"modern",rotLon:-70+p*15,ox:0.85,night:0.15,clouds:0.4,quality:q});const impact=smootherstep(0.80,0.92,p),after=smootherstep(0.88,0.98,p);ctx.globalCompositeOperation="lighter";const hit=project(-89.5,21.4,cx,cy,R,-70+p*15);if(hit){const glow=Math.sin(clamp(impact,0,1)*Math.PI)*0.75+after*0.2;drawGlow(ctx,hit.x,hit.y,40+glow*60,{r:255,g:190,b:100},0.45*glow);}ctx.globalCompositeOperation="source-over";const dust=smoothstep(0.84,0.92,p)*(1-smootherstep(0.94,1,p)*0.45);if(dust>0.01)softDisc(ctx,cx,cy,R*1.5,{r:70,g:50,b:35},0.32*dust);ctx.restore();}

const scene={id:"earth-and-life",title:"Earth and life",weight:1.4,checkpoints,
  render(ctx,localProgress,view){const{w,h,quality=1}=view;const p=clamp(localProgress,0,1);const st=stage(view);const{cx,cy,aw,ah}=st;const R=Math.min(aw,ah)*0.48;
    ctx.fillStyle="#05060f";ctx.fillRect(0,0,w,h);drawStarfield(ctx,w,h,Math.floor(55*quality),40,p*0.15,0.45);
    const oceansG=1-smootherstep(0.10,0.16,p),life=smoothstep(0.10,0.17,p)*(1-smootherstep(0.20,0.26,p)),goe=smoothstep(0.22,0.30,p)*(1-smootherstep(0.34,0.40,p)),euk=smoothstep(0.34,0.42,p)*(1-smootherstep(0.46,0.52,p)),edi=smoothstep(0.46,0.52,p)*(1-smootherstep(0.54,0.58,p)),cam=smoothstep(0.54,0.64,p)*(1-smootherstep(0.68,0.76,p)),land=smoothstep(0.66,0.76,p)*(1-smootherstep(0.80,0.88,p)),kpg=smootherstep(0.80,0.92,p);
    if(oceansG>0.02){ctx.save();ctx.globalAlpha=oceansG;const molten=1-smootherstep(0,0.08,p);drawEarthGlobe(ctx,cx,cy,R,{landMode:"ocean",rotLon:p*20,ox:0.05,molten,clouds:0,quality});ctx.restore();}
    drawStromatolites(ctx,cx,cy,R,p,quality,life);drawGOE(ctx,cx,cy,R,p,quality,goe);drawEukaryote(ctx,cx,cy,R,p,quality,euk);drawEdiacaran(ctx,cx,cy,R,p,quality,edi);drawCambrian(ctx,st,p,quality,cam,view);drawLandLife(ctx,cx,cy,R,p,quality,land);if(kpg>0.02)drawKPg(ctx,cx,cy,R,p,quality,kpg);
    drawVignette(ctx,w,h,0.5);drawGrain(ctx,w,h,Math.floor(p*700+200),0.026,quality);}};
export default scene;
