/**
 * Orthographic globe helpers + Natural Earth land rendering.
 * Land rings: public-domain Natural Earth 110m (see ne-land.js).
 */
import { clamp, lerp, smoothstep, hash01, drawGlow, rgba, mixRgb } from "./util.js";
import { NE_LAND_RINGS, RODINIA_RINGS, PANGAEA_RINGS } from "./ne-land.js?v=eb09baa";

export { NE_LAND_RINGS, RODINIA_RINGS, PANGAEA_RINGS };

/** Focal stage inside view.safeContent (fallback if absent). */
export function stage(view) {
  const { w, h } = view;
  const s = view.safeContent;
  if (s && s.w > 40 && s.h > 40) {
    return { cx: s.cx, cy: s.cy, aw: s.w, ah: s.h, x: s.x, y: s.y };
  }
  if (w < 700) {
    const top = 300, bottom = 100;
    const ah = Math.max(120, h - top - bottom);
    return { cx: w * 0.5, cy: top + ah * 0.48, aw: w, ah, x: 0, y: top };
  }
  const left = 380, top = 70, bottom = 100;
  const ah = Math.max(160, h - top - bottom);
  return {
    cx: left + (w - left) * 0.48,
    cy: top + ah * 0.48,
    aw: w - left * 0.35,
    ah,
    x: left * 0.2,
    y: top,
  };
}

/** Orthographic projection. rotLon in degrees (camera longitude). Returns null if back-facing. */
export function project(lon, lat, cx, cy, r, rotLon = 0) {
  const p = projectRaw(lon, lat, cx, cy, r, rotLon);
  if (p.z < -0.02) return null;
  return p;
}

/** Orthographic with z; always returns coords (may be backfacing). */
export function projectRaw(lon, lat, cx, cy, r, rotLon = 0) {
  const lam = ((lon - rotLon) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(lam);
  const y = -Math.sin(phi);
  const z = cosPhi * Math.cos(lam);
  return { x: cx + x * r, y: cy + y * r, z };
}

/** Insert limb point between a (front) and b (back) or vice versa. */
function limbPoint(a, b, cx, cy, r) {
  // a.z and b.z have opposite signs (or one ~0). Interpolate in 3D-ish via z.
  const t = a.z / (a.z - b.z);
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  // Snap to circle
  const dx = x - cx, dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  return { x: cx + (dx / len) * r, y: cy + (dy / len) * r, z: 0 };
}


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

/**
 * Draw an Earth-like globe.
 * @param {object} opts
 * @param {'modern'|'rodinia'|'pangaea'|'ocean'|'molten'} opts.landMode
 * @param {number} opts.rotLon slow rotation degrees
 * @param {number} opts.ox oxygenation 0–1 (sky/ocean tint)
 * @param {number} opts.night 0–1 blend to night side / city-ready
 * @param {number} opts.clouds 0–1
 * @param {number} opts.molten 0–1 lava overlay
 */
export function drawEarthGlobe(ctx, cx, cy, r, opts = {}) {
  const {
    landMode = "modern",
    rotLon = 20,
    ox = 0.5,
    night = 0,
    clouds = 0.35,
    molten = 0,
    quality = 1,
    landRgb = null,
  } = opts;

  ctx.save();

  // Atmosphere rim
  const atm = mixRgb({ r: 160, g: 120, b: 70 }, { r: 120, g: 180, b: 255 }, ox);
  drawGlow(ctx, cx, cy, r * 1.55, atm, 0.22 + ox * 0.18);
  drawGlow(ctx, cx, cy, r * 2.05, atm, 0.1 + ox * 0.08);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Ocean fill
  if (molten > 0.55) {
    const lava = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
    lava.addColorStop(0, rgba(255, 230, 150, 1));
    lava.addColorStop(0.35, rgba(255, 120, 40, 1));
    lava.addColorStop(0.75, rgba(140, 30, 15, 1));
    lava.addColorStop(1, rgba(30, 8, 5, 1));
    ctx.fillStyle = lava;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < Math.floor(lerp(5, 12, quality)); i++) {
      const ang = hash01(i * 2.2) * Math.PI * 2;
      const d = hash01(i * 3.1) * r * 0.7;
      softDisc(ctx, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, r * (0.1 + hash01(i) * 0.16), { r: 255, g: 180, b: 60 }, 0.3 * molten);
    }
    ctx.globalCompositeOperation = "source-over";
  } else {
    const deep = mixRgb({ r: 12, g: 35, b: 70 }, { r: 10, g: 60, b: 120 }, ox);
    const shallow = mixRgb({ r: 40, g: 90, b: 130 }, { r: 45, g: 130, b: 175 }, ox);
    const nightDeep = { r: 6, g: 12, b: 28 };
    const oA = mixRgb(deep, nightDeep, night * 0.85);
    const oB = mixRgb(shallow, { r: 20, g: 40, b: 70 }, night * 0.7);
    const og = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
    og.addColorStop(0, rgba(oB.r + 25, oB.g + 25, oB.b + 15, 1));
    og.addColorStop(0.55, rgba(oA.r + 15, oA.g + 25, oA.b + 20, 1));
    og.addColorStop(1, rgba(oA.r, oA.g, oA.b, 1));
    ctx.fillStyle = og;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Soft depth swirls
    for (let i = 0; i < Math.floor(lerp(3, 8, quality)); i++) {
      const ang = hash01(i * 5.5) * Math.PI * 2 + rotLon * 0.01;
      const d = r * (0.2 + hash01(i * 2.1) * 0.55);
      softDisc(
        ctx,
        cx + Math.cos(ang) * d,
        cy + Math.sin(ang) * d * 0.85,
        r * (0.12 + hash01(i) * 0.18),
        { r: oB.r + 30, g: oB.g + 40, b: oB.b + 30 },
        0.1
      );
    }
  }

  // Land
  let rings = null;
  if (landMode === "modern") rings = NE_LAND_RINGS;
  else if (landMode === "rodinia") rings = RODINIA_RINGS;
  else if (landMode === "pangaea") rings = PANGAEA_RINGS;

  if (rings && molten < 0.85) {
    const baseLand = landRgb || (night > 0.55
      ? { r: 32, g: 58, b: 40 }
      : mixRgb({ r: 72, g: 115, b: 55 }, { r: 45, g: 120, b: 65 }, ox));
    const maxRings = quality > 0.65 ? rings.length : quality > 0.35 ? Math.min(rings.length, 60) : Math.min(rings.length, 32);
    const alpha = 0.95 * (1 - molten * 0.9);
    ctx.fillStyle = rgba(baseLand.r, baseLand.g, baseLand.b, alpha);
    ctx.strokeStyle = rgba(baseLand.r - 20, baseLand.g - 10, baseLand.b - 15, 0.45 * alpha);
    ctx.lineWidth = 1;

    for (let ri = 0; ri < maxRings; ri++) {
      const ring = rings[ri];
      if (ring.length < 4) continue;
      // Build front-facing path with limb stitching
      const raw = ring.map(([lon, lat]) => projectRaw(lon, lat, cx, cy, r, rotLon));
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i < raw.length; i++) {
        const cur = raw[i];
        const prev = raw[(i - 1 + raw.length) % raw.length];
        const curFront = cur.z > 0.0;
        const prevFront = prev.z > 0.0;
        if (curFront && prevFront) {
          if (!drawing) { ctx.moveTo(prev.x, prev.y); drawing = true; }
          ctx.lineTo(cur.x, cur.y);
        } else if (curFront && !prevFront) {
          const lp = limbPoint(cur, prev, cx, cy, r);
          if (!drawing) { ctx.moveTo(lp.x, lp.y); drawing = true; }
          else ctx.lineTo(lp.x, lp.y);
          ctx.lineTo(cur.x, cur.y);
        } else if (!curFront && prevFront) {
          const lp = limbPoint(prev, cur, cx, cy, r);
          if (!drawing) { ctx.moveTo(prev.x, prev.y); drawing = true; }
          ctx.lineTo(lp.x, lp.y);
          // stop run at limb — continue building same path via subsequent front segments
        }
      }
      if (drawing) {
        ctx.closePath();
        ctx.fill();
      }
    }

    // Coastline for definition
    ctx.beginPath();
    for (let ri = 0; ri < Math.min(maxRings, 35); ri++) {
      const ring = rings[ri];
      let prev = null;
      for (let i = 0; i < ring.length; i++) {
        const pt = project(ring[i][0], ring[i][1], cx, cy, r, rotLon);
        if (!pt || pt.z < 0.08) { prev = null; continue; }
        if (prev) { ctx.moveTo(prev.x, prev.y); ctx.lineTo(pt.x, pt.y); }
        prev = pt;
      }
    }
    ctx.stroke();

    if (night < 0.7 && molten < 0.3) {
      softDisc(ctx, cx - r * 0.3, cy - r * 0.35, r * 0.55, { r: 180, g: 200, b: 140 }, 0.08);
    }
  }

  // Clouds (smooth ellipses, not noise blocks)
  if (clouds > 0.02 && molten < 0.5) {
    const n = Math.floor(lerp(6, 16, quality));
    for (let i = 0; i < n; i++) {
      const lon = hash01(i * 1.7) * 360 - 180;
      const lat = (hash01(i * 3.3) - 0.5) * 140;
      const pt = project(lon + rotLon * 0.2, lat, cx, cy, r, rotLon);
      if (!pt || pt.z < 0.15) continue;
      const a = clouds * (0.12 + hash01(i) * 0.18) * pt.z;
      softDisc(ctx, pt.x, pt.y, r * (0.08 + hash01(i * 2) * 0.12) * pt.z, { r: 230, g: 235, b: 245 }, a);
    }
  }

  // Terminator
  const termAng = -0.4 + rotLon * 0.004;
  const tg = ctx.createLinearGradient(
    cx + Math.cos(termAng) * r,
    cy + Math.sin(termAng) * r,
    cx - Math.cos(termAng) * r,
    cy - Math.sin(termAng) * r
  );
  if (night > 0.5) {
    tg.addColorStop(0, rgba(80, 120, 180, 0.08));
    tg.addColorStop(0.35, rgba(0, 0, 0, 0));
    tg.addColorStop(0.55, rgba(0, 4, 18, 0.45));
    tg.addColorStop(1, rgba(0, 2, 12, 0.75));
  } else {
    tg.addColorStop(0, rgba(255, 240, 210, 0.12));
    tg.addColorStop(0.42, rgba(0, 0, 0, 0));
    tg.addColorStop(0.65, rgba(0, 5, 20, 0.35));
    tg.addColorStop(1, rgba(0, 5, 25, 0.62));
  }
  ctx.fillStyle = tg;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Specular
  if (molten < 0.4) {
    softDisc(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.25, { r: 220, g: 240, b: 255 }, 0.2 * (1 - night * 0.7));
  }

  ctx.restore();

  // Limb stroke
  ctx.strokeStyle = rgba(atm.r, atm.g, atm.b, 0.4 + ox * 0.2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.2, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draw a path of [lon,lat] points as a glowing arc on the globe. */
export function drawGlobePath(ctx, pts, cx, cy, r, rotLon, progressAlong, color, width = 2) {
  if (progressAlong < 0.01) return;
  const n = pts.length;
  const until = Math.max(2, Math.floor(1 + (n - 1) * progressAlong));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  let prev = null;
  for (let i = 0; i < until; i++) {
    const pt = project(pts[i][0], pts[i][1], cx, cy, r, rotLon);
    if (!pt) {
      prev = null;
      continue;
    }
    if (prev) {
      const g = ctx.createLinearGradient(prev.x, prev.y, pt.x, pt.y);
      g.addColorStop(0, rgba(color.r, color.g, color.b, 0.15));
      g.addColorStop(1, rgba(color.r, color.g, color.b, 0.55));
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
    prev = pt;
  }
  if (prev) {
    drawGlow(ctx, prev.x, prev.y, 8, color, 0.45);
    ctx.fillStyle = rgba(255, 240, 200, 0.9);
    ctx.beginPath();
    ctx.arc(prev.x, prev.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGlobeMarker(ctx, lon, lat, cx, cy, r, rotLon, color, size = 5, shape = "diamond") {
  const pt = project(lon, lat, cx, cy, r, rotLon);
  if (!pt || pt.z < 0.05) return null;
  drawGlow(ctx, pt.x, pt.y, size * 2.5, color, 0.45 * pt.z);
  ctx.fillStyle = rgba(255, 255, 240, 0.95 * pt.z);
  if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - size);
    ctx.lineTo(pt.x + size * 0.75, pt.y);
    ctx.lineTo(pt.x, pt.y + size);
    ctx.lineTo(pt.x - size * 0.75, pt.y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  return pt;
}
