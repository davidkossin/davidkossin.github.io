/**
 * Chapter 6 — Machines (v3) — large transistor morph, ARPANET, WWW, phones, nets, tokens
 */
import { clamp, lerp, smoothstep, smootherstep, hash01, drawGlow, drawVignette, drawGrain, rgba } from "../util.js";
import { stage } from "../globe.js?v=a09b8da";

const checkpoints = [
  { id:"electricity", at:0.08, timeLabel:"practical electric power from the late 19th century", title:"Electricity",
    body:"Electromagnetism, mapped in the 19th century, becomes infrastructure: generators, grids, motors, and light. Electric power decouples industry and communication from the limits of muscle, water, and steam alone, and becomes the substrate for every later machine on this timeline." },
  { id:"transistor", at:0.24, timeLabel:"1947 CE", title:"The transistor",
    body:"At Bell Labs, Bardeen, Brattain, and Shockley demonstrate a point-contact transistor — a solid-state switch and amplifier. Miniaturization follows. Transistors replace vacuum tubes and make modern computers, radios, and sensors possible at scale, then shrink into dense integrated circuits." },
  { id:"arpanet", at:0.40, timeLabel:"1969 CE", title:"ARPANET",
    body:"Packet-switched networking links research computers under U.S. ARPA funding. The first four nodes — UCLA, Stanford Research Institute (SRI), UC Santa Barbara, and the University of Utah — exchange packets in 1969. Protocols evolved from this lineage, especially TCP/IP, become the backbone of the global Internet." },
  { id:"www", at:0.55, timeLabel:"1989–1991 CE", title:"World Wide Web",
    body:"Tim Berners-Lee proposes and implements a hypertext system of URLs, HTTP, and HTML at CERN. The Web turns the Internet into a browsable information space that anyone with a link can publish to and read — including, decades later, this page." },
  { id:"smartphones", at:0.68, timeLabel:"widespread from the late 2000s", title:"Smartphones",
    body:"Pocket computers combine radios, sensors, cameras, and high-resolution displays. Always-on network access puts the Web, maps, cameras, and messaging in daily reach for billions of people, generating vast streams of digital text and images." },
  { id:"deep-learning", at:0.82, timeLabel:"breakthroughs accelerating from about 2012 CE onward", title:"Neural networks and deep learning",
    body:"Multi-layer neural networks, trained with gradient methods on large datasets and GPUs, surpass prior systems in vision, speech, and many prediction tasks. The same substrate — layers of weighted connections — scales to language." },
  { id:"llms", at:0.94, timeLabel:"2010s–2020s CE", title:"Large language models",
    body:"Models trained on enormous text corpora learn to predict the next token — and, in doing so, to summarize, translate, write code, and answer questions in natural language. They compress statistical patterns from centuries of human writing into tools that can assist in building software and websites." },
];

function softDisc(ctx,x,y,rad,color,a){const g=ctx.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,rgba(color.r,color.g,color.b,a));g.addColorStop(0.55,rgba(color.r,color.g,color.b,a*0.35));g.addColorStop(1,rgba(color.r,color.g,color.b,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();}
function roundRect(ctx,x,y,w,h,rad){ctx.beginPath();ctx.moveTo(x+rad,y);ctx.arcTo(x+w,y,x+w,y+h,rad);ctx.arcTo(x+w,y+h,x,y+h,rad);ctx.arcTo(x,y+h,x,y,rad);ctx.arcTo(x,y,x+w,y,rad);ctx.closePath();}

function drawTransistor(ctx,cx,cy,size,p,q,show){
  if(show<0.01)return; const shrink=smootherstep(0.26,0.40,p); const device=1-shrink; const ic=shrink;
  ctx.save(); ctx.globalAlpha=show;
  if(device>0.05){ ctx.save(); ctx.globalAlpha=show*device; const S=size*1.35*lerp(1,0.18,shrink);
    // Soft lab lighting
    softDisc(ctx,cx-S*0.25,cy-S*0.45,S*1.5,{r:255,g:245,b:220},0.2); softDisc(ctx,cx+S*0.3,cy+S*0.1,S*1.1,{r:120,g:160,b:210},0.1);
    // Mount / base plate (label-free)
    ctx.fillStyle=rgba(36,34,42,1); roundRect(ctx,cx-S*0.58,cy+S*0.28,S*1.16,S*0.18,8); ctx.fill();
    // Germanium block — opaque metallic slab (must be opaque so grid lines do not show through)
    const geTop = cy+S*0.04;
    const geBot = cy+S*0.26;
    ctx.fillStyle=rgba(42,46,56,1);
    roundRect(ctx, cx-S*0.34, geTop, S*0.68, geBot-geTop, 5); ctx.fill();
    const ge=ctx.createLinearGradient(cx, geTop, cx, geBot);
    ge.addColorStop(0,rgba(120,126,138,1)); ge.addColorStop(0.35,rgba(62,66,76,1)); ge.addColorStop(1,rgba(28,30,38,1));
    ctx.fillStyle=ge; roundRect(ctx, cx-S*0.34, geTop, S*0.68, geBot-geTop, 5); ctx.fill();
    // soft top highlight only (horizontal, not a vertical lead)
    ctx.fillStyle=rgba(180,188,200,0.22);
    roundRect(ctx, cx-S*0.3, geTop+1, S*0.6, 3, 1); ctx.fill();
    // Cream polystyrene wedge resting on the slab
    const wedge=ctx.createLinearGradient(cx-S*0.3,cy-S*0.55,cx+S*0.3,geTop);
    wedge.addColorStop(0,rgba(245,235,210,0.98)); wedge.addColorStop(0.5,rgba(228,212,180,0.98)); wedge.addColorStop(1,rgba(198,182,152,0.98));
    ctx.fillStyle=wedge; ctx.beginPath(); ctx.moveTo(cx,cy-S*0.55); ctx.lineTo(cx+S*0.36,geTop); ctx.lineTo(cx-S*0.36,geTop); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=rgba(160,140,110,0.45); ctx.lineWidth=1.4; ctx.stroke();
    // Gold foil strips tapering to contact points on the germanium face
    const touchY = geTop + (geBot-geTop)*0.42;
    ctx.fillStyle=rgba(255,198,70,0.96);
    ctx.beginPath();
    ctx.moveTo(cx-S*0.14, cy-S*0.46); ctx.lineTo(cx-S*0.065, cy-S*0.46);
    ctx.lineTo(cx-S*0.095, touchY); ctx.lineTo(cx-S*0.11, touchY);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx+S*0.065, cy-S*0.46); ctx.lineTo(cx+S*0.14, cy-S*0.46);
    ctx.lineTo(cx+S*0.11, touchY); ctx.lineTo(cx+S*0.095, touchY);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation="lighter";
    drawGlow(ctx,cx-S*0.102,touchY,S*0.12,{r:255,g:220,b:100},0.65);
    drawGlow(ctx,cx+S*0.102,touchY,S*0.12,{r:255,g:220,b:100},0.65);
    ctx.fillStyle=rgba(255,245,180,0.95);
    ctx.beginPath(); ctx.arc(cx-S*0.102,touchY,3.2,0,Math.PI*2); ctx.arc(cx+S*0.102,touchY,3.2,0,Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation="source-over";
    ctx.fillStyle=rgba(230,210,160,0.9); ctx.font=`${Math.max(13,size*0.065)}px Outfit,sans-serif`; ctx.textAlign="center";
    ctx.fillText("1947 · point-contact transistor",cx,cy+S*0.55);
    ctx.restore();
  }
  if(ic>0.05){ ctx.save(); ctx.globalAlpha=show*smootherstep(0.05,0.6,ic); softDisc(ctx,cx,cy,size*1.05,{r:40,g:130,b:190},0.18); const n=Math.floor(lerp(8,18,q)); const cell=size*0.1; const dieW=n*cell*1.2;
    const die=ctx.createLinearGradient(cx,cy-dieW/2,cx,cy+dieW/2); die.addColorStop(0,rgba(30,55,90,0.85*ic)); die.addColorStop(1,rgba(15,30,55,0.9*ic)); ctx.fillStyle=die; roundRect(ctx,cx-dieW/2,cy-dieW/2,dieW,dieW,12); ctx.fill();
    ctx.strokeStyle=rgba(100,180,255,0.35*ic); ctx.lineWidth=1.5; ctx.stroke();
    ctx.globalCompositeOperation="lighter";
    for(let j=-n;j<=n;j++) for(let i=-n;i<=n;i++){ if(Math.hypot(i,j)>n*0.95) continue; const x=cx+i*cell,y=cy+j*cell; const gate=hash01(i*12+j*7+3);
      ctx.strokeStyle=rgba(100,210,255,(0.18+gate*0.5)*ic); ctx.lineWidth=1.1; ctx.strokeRect(x-cell*0.38,y-cell*0.38,cell*0.76,cell*0.76);
      if(gate>0.35){ const col=gate>0.72?{r:90,g:230,b:255}:gate>0.5?{r:180,g:160,b:255}:{r:255,g:200,b:120}; drawGlow(ctx,x,y,cell*0.45,col,0.55*ic); ctx.fillStyle=rgba(col.r,col.g,col.b,0.9*ic); ctx.fillRect(x-2.4,y-2.4,4.8,4.8);} }
    for(let i=0;i<8;i++){ const ang=(i/8)*Math.PI*2; const px=cx+Math.cos(ang)*dieW*0.52, py=cy+Math.sin(ang)*dieW*0.52; ctx.fillStyle=rgba(255,210,100,0.7*ic); ctx.fillRect(px-4,py-3,8,6); }
    ctx.restore();
  }
  ctx.restore();
}

const ARPA=[{id:"UCLA",x:-0.55,y:0.2},{id:"SRI",x:-0.32,y:-0.38},{id:"UCSB",x:-0.08,y:0.4},{id:"UTAH",x:0.5,y:-0.12}];
const ARPA_E=[[0,1],[0,2],[1,3],[1,2]];

const scene={id:"machines",title:"Machines",weight:1.25,checkpoints,
  render(ctx,localProgress,view){ const{w,h,quality=1}=view; const p=clamp(localProgress,0,1); const st=stage(view); const{cx,cy,aw,ah}=st; const size=Math.min(aw,ah)*0.52;
    ctx.fillStyle="#05060f"; ctx.fillRect(0,0,w,h);
    ctx.save(); ctx.strokeStyle=rgba(60,100,160,0.06); const step=lerp(70,48,quality); for(let x=0;x<w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();} for(let y=0;y<h;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();} ctx.restore();
    const elec=smootherstep(0,0.14,p)*(1-smootherstep(0.16,0.26,p));
    if(elec>0.01){ ctx.save(); ctx.globalAlpha=elec; ctx.globalCompositeOperation="lighter"; softDisc(ctx,cx,cy,size,{r:100,g:180,b:255},0.16); const cols=Math.floor(lerp(6,12,quality)),rows=Math.floor(lerp(4,8,quality)),spread=smootherstep(0.02,0.16,p); for(let j=0;j<rows;j++) for(let i=0;i<cols;i++){ const u=(i+0.5)/cols-0.5,v=(j+0.5)/rows-0.5; const lit=clamp((spread-Math.hypot(u,v)*0.95)/0.22,0,1); if(lit<=0) continue; const x=cx+u*size*1.5,y=cy+v*size*0.95; drawGlow(ctx,x,y,14+lit*14,{r:255,g:230,b:160},0.5*lit); ctx.fillStyle=rgba(255,245,200,0.95*lit); ctx.beginPath(); ctx.arc(x,y,2.8,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
    drawTransistor(ctx,cx,cy,size,p,quality,smoothstep(0.14,0.26,p)*(1-smootherstep(0.34,0.44,p)));
    const arpa=smoothstep(0.34,0.44,p)*(1-smootherstep(0.48,0.56,p));
    if(arpa>0.01){ ctx.save(); ctx.globalAlpha=arpa; softDisc(ctx,cx,cy,size*1.1,{r:80,g:140,b:255},0.14); const nodes=ARPA.map(n=>({...n,px:cx+n.x*size,py:cy+n.y*size})); ctx.globalCompositeOperation="lighter"; ARPA_E.forEach(([a,b],ei)=>{ const A=nodes[a],B=nodes[b]; ctx.strokeStyle=rgba(120,190,255,0.55); ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(A.px,A.py); ctx.lineTo(B.px,B.py); ctx.stroke(); const t=(p*2.5+ei*0.2)%1; drawGlow(ctx,lerp(A.px,B.px,t),lerp(A.py,B.py,t),14,{r:180,g:230,b:255},0.6); }); nodes.forEach(n=>{ drawGlow(ctx,n.px,n.py,30,{r:100,g:180,b:255},0.5); ctx.fillStyle=rgba(15,25,45,0.95); ctx.beginPath(); ctx.arc(n.px,n.py,15,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=rgba(160,210,255,0.9); ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle=rgba(220,235,255,0.95); ctx.font=`600 ${Math.max(13,size*0.075)}px Outfit,sans-serif`; ctx.textAlign="center"; ctx.textBaseline="top"; ctx.fillText(n.id,n.px,n.py+20); }); ctx.restore(); }
    const web=smoothstep(0.48,0.58,p)*(1-smootherstep(0.64,0.74,p));
    if(web>0.01){ ctx.save(); ctx.globalAlpha=web; ctx.globalCompositeOperation="lighter"; const n=Math.floor(lerp(14,28,quality)); const nodes=[]; for(let i=0;i<n;i++){ const ang=hash01(i*1.7)*Math.PI*2,dist=size*(0.12+hash01(i*3.1)*0.9); nodes.push({x:cx+Math.cos(ang)*dist,y:cy+Math.sin(ang)*dist*0.7,hub:i===0||hash01(i*5)>0.82}); } nodes[0]={x:cx,y:cy,hub:true}; for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){ const link=hash01(i*30+j); if(link>(nodes[i].hub||nodes[j].hub?0.5:0.18)) continue; ctx.strokeStyle=rgba(180,160,255,0.28); ctx.beginPath(); ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.stroke(); } nodes.forEach(nd=>{ drawGlow(ctx,nd.x,nd.y,nd.hub?24:12,nd.hub?{r:200,g:180,b:255}:{r:140,g:180,b:255},0.5); ctx.fillStyle=rgba(230,230,255,0.95); ctx.beginPath(); ctx.arc(nd.x,nd.y,nd.hub?5.5:3,0,Math.PI*2); ctx.fill(); }); ctx.restore(); }
    const ph=smoothstep(0.62,0.72,p)*(1-smootherstep(0.76,0.86,p));
    if(ph>0.01){ ctx.save(); ctx.globalAlpha=ph; const phones=Math.floor(lerp(1,5,quality)); for(let i=0;i<phones;i++){ const ox=(i-(phones-1)/2)*size*0.35; const x=cx+ox,y=cy,s=(i===((phones/2)|0)?1.3:0.95)*size*0.0048; softDisc(ctx,x,y,65*s,{r:80,g:140,b:255},0.2); ctx.fillStyle=rgba(16,20,34,0.96); ctx.strokeStyle=rgba(140,190,255,0.6); ctx.lineWidth=2; roundRect(ctx,x-28*s,y-52*s,56*s,104*s,12*s); ctx.fill(); ctx.stroke(); ctx.globalCompositeOperation="lighter"; const sg=ctx.createLinearGradient(x,y-40*s,x,y+28*s); sg.addColorStop(0,rgba(80,160,255,0.65)); sg.addColorStop(1,rgba(140,100,255,0.45)); ctx.fillStyle=sg; roundRect(ctx,x-22*s,y-42*s,44*s,74*s,6); ctx.fill(); ctx.globalCompositeOperation="source-over"; } ctx.restore(); }
    const nn=smoothstep(0.74,0.88,p)*(1-smootherstep(0.90,0.98,p)*0.5);
    if(nn>0.01){ const layers=quality>0.5?[5,9,9,7,4]:[4,7,6,3]; const x0=cx-size*0.75,x1=cx+size*0.75; ctx.save(); ctx.globalAlpha=nn; ctx.globalCompositeOperation="lighter"; softDisc(ctx,cx,cy,size,{r:120,g:100,b:220},0.12); const nodes=layers.map((count,li)=>{ const x=lerp(x0,x1,li/(layers.length-1)); return Array.from({length:count},(_,i)=>({x,y:cy+(i-(count-1)/2)*(size*0.2),act:0.35+0.65*hash01(i*3+li*11+Math.floor(p*18))})); }); for(let li=0;li<nodes.length-1;li++) for(const a of nodes[li]) for(const b of nodes[li+1]){ ctx.strokeStyle=rgba(160,140,255,(0.08+0.18*a.act*b.act)*(0.5+0.5*Math.sin((a.x+b.y)*0.04+p*10))); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); } nodes.flat().forEach(nd=>{ drawGlow(ctx,nd.x,nd.y,10+nd.act*10,{r:180,g:160,b:255},0.55*nd.act); ctx.fillStyle=rgba(235,225,255,0.95); ctx.beginPath(); ctx.arc(nd.x,nd.y,3.5+nd.act,0,Math.PI*2); ctx.fill(); }); ctx.restore(); }
    const tok=smootherstep(0.88,0.98,p);
    if(tok>0.01){ const samples=["the","next","token","is","a","probability","distribution","over","vocabulary","attn","context","transformer"]; ctx.save(); ctx.globalAlpha=tok; softDisc(ctx,cx,cy,size,{r:140,g:120,b:255},0.16); ctx.globalCompositeOperation="lighter"; const n=Math.floor(lerp(8,samples.length,quality)); for(let i=0;i<n;i++){ const t=(i/n+p*0.12)%1; const x=cx-size*0.85+t*size*1.7,y=cy+(hash01(i*4)-0.5)*size*0.55; const on=clamp((tok-i/n*0.4)/0.5,0,1); if(on<=0) continue; const tw=32+samples[i].length*6; ctx.fillStyle=rgba(40,35,70,0.78*on); roundRect(ctx,x-tw/2,y-14,tw,28,8); ctx.fill(); ctx.strokeStyle=rgba(180,160,255,0.5*on); ctx.stroke(); ctx.fillStyle=rgba(220,210,255,0.95*on); ctx.font="13px Outfit,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(samples[i],x,y); } ctx.restore(); }
    drawVignette(ctx,w,h,0.5); drawGrain(ctx,w,h,Math.floor(p*900+400),0.026,quality);
  }};
export default scene;
