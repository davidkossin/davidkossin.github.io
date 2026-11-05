/** Shared helpers for timeline scenes. Deterministic given seeds + progress. */

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function smootherstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Hash → [0,1) */
export function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function hash2(i, j) {
  return hash01(i * 12.9898 + j * 78.233);
}

/** Value noise 2D (smooth hermite interpolation — sample continuously, never draw as cells) */
export function valueNoise2(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/** Fractal Brownian motion */
export function fbm(x, y, octaves = 4) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * valueNoise2(x * f, y * f);
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return v / (norm || 1);
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgba(r, g, b, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

export function mixRgb(c1, c2, t) {
  return {
    r: lerp(c1.r, c2.r, t),
    g: lerp(c1.g, c2.g, t),
    b: lerp(c1.b, c2.b, t),
  };
}

/** Soft radial glow with additive-ish look via high alpha layering */
export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  if (radius <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color.r, color.g, color.b, alpha));
  g.addColorStop(0.35, rgba(color.r, color.g, color.b, alpha * 0.45));
  g.addColorStop(0.7, rgba(color.r, color.g, color.b, alpha * 0.12));
  g.addColorStop(1, rgba(color.r, color.g, color.b, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Multi-stop soft bloom (wider falloff) */
export function drawBloom(ctx, x, y, radius, color, alpha = 1) {
  if (radius <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, x, y, radius * 1.8, color, alpha * 0.25);
  drawGlow(ctx, x, y, radius * 0.9, color, alpha * 0.45);
  drawGlow(ctx, x, y, radius * 0.35, { r: 255, g: 255, b: 255 }, alpha * 0.55);
  ctx.restore();
}

/** Soft vignette */
export function drawVignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* ── Smooth noise field (offscreen → bilinear upscale) ─────────────────── */

const _noiseCache = new Map();

/**
 * Build (or reuse) a small offscreen canvas filled with continuous fbm.
 * Never draw noise as large unfiltered cells — always upscale with smoothing.
 *
 * @param {object} opts
 * @param {number} opts.bw buffer width (default 160)
 * @param {number} opts.bh buffer height (default 100)
 * @param {number} opts.scale noise frequency
 * @param {number} opts.octaves
 * @param {number} opts.seed
 * @param {number} opts.ox offset x in noise space
 * @param {number} opts.oy offset y in noise space
 * @param {{r:number,g:number,b:number}} opts.colorA
 * @param {{r:number,g:number,b:number}} opts.colorB
 * @param {number} opts.contrast 0–1
 * @param {boolean} opts.signed if true, map noise around 0.5 for CMB-like ±delta
 */
export function getSmoothNoiseCanvas(opts = {}) {
  const bw = opts.bw || 256;
  const bh = opts.bh || 160;
  const scale = opts.scale ?? 3.2;
  const octaves = opts.octaves ?? 4;
  const seed = opts.seed ?? 0;
  const ox = opts.ox ?? 0;
  const oy = opts.oy ?? 0;
  const contrast = opts.contrast ?? 0.55;
  const signed = !!opts.signed;
  const cA = opts.colorA || { r: 255, g: 180, b: 100 };
  const cB = opts.colorB || { r: 80, g: 40, b: 20 };
  // Quantize offsets so cache hits during scrub (deterministic)
  const qox = Math.round(ox * 40) / 40;
  const qoy = Math.round(oy * 40) / 40;
  const key = `${bw}x${bh}|${scale}|${octaves}|${seed}|${qox}|${qoy}|${contrast}|${signed}|${cA.r},${cA.g},${cA.b}|${cB.r},${cB.g},${cB.b}`;
  let entry = _noiseCache.get(key);
  if (entry) return entry;

  const c = document.createElement("canvas");
  c.width = bw;
  c.height = bh;
  const ictx = c.getContext("2d", { willReadFrequently: true });
  const img = ictx.createImageData(bw, bh);
  const d = img.data;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const n = fbm((x / bw) * scale + qox + seed * 0.17, (y / bh) * scale * 0.75 + qoy + seed * 0.31, octaves);
      let t;
      if (signed) {
        // Centered around 0.5 for anisotropy
        t = clamp(0.5 + (n - 0.5) * (1.2 + contrast), 0, 1);
      } else {
        t = clamp((n - 0.5 * (1 - contrast)) / (contrast + 0.001), 0, 1);
        t = t * t * (3 - 2 * t);
      }
      const col = mixRgb(cB, cA, t);
      const i = (y * bw + x) * 4;
      d[i] = col.r;
      d[i + 1] = col.g;
      d[i + 2] = col.b;
      d[i + 3] = 255;
    }
  }
  ictx.putImageData(img, 0, 0);
  // Blur via a second buffer (drawing a canvas onto itself with filter is unreliable)
  try {
    const tmp = document.createElement("canvas");
    tmp.width = bw;
    tmp.height = bh;
    const tctx = tmp.getContext("2d");
    tctx.filter = "blur(2.2px)";
    tctx.drawImage(c, 0, 0);
    tctx.filter = "none";
    ictx.clearRect(0, 0, bw, bh);
    ictx.drawImage(tmp, 0, 0);
  } catch (_) { /* filter unsupported — ImageData fbm is already smooth */ }
  // Cap cache size
  if (_noiseCache.size > 48) {
    const first = _noiseCache.keys().next().value;
    _noiseCache.delete(first);
  }
  _noiseCache.set(key, c);
  return c;
}

/**
 * Draw a smooth noise field covering (dx,dy,dw,dh).
 * Upscales a low-res buffer with imageSmoothingQuality = "high" — no grid.
 */
export function drawSmoothNoise(ctx, dx, dy, dw, dh, opts = {}) {
  const buf = getSmoothNoiseCanvas(opts);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.composite) ctx.globalCompositeOperation = opts.composite;
  ctx.drawImage(buf, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * Soft volumetric haze from overlapping radial blobs (no cells).
 * Positions are deterministic from seed + progress drift.
 */
export function drawVolumetricHaze(ctx, w, h, opts = {}) {
  const count = opts.count ?? 7;
  const seed = opts.seed ?? 1;
  const strength = opts.strength ?? 0.2;
  const color = opts.color || { r: 255, g: 160, b: 90 };
  const progress = opts.progress ?? 0;
  if (strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = opts.composite || "lighter";
  for (let i = 0; i < count; i++) {
    const px = (hash01(i * 2.1 + seed) + progress * 0.03 * (hash01(i + 3) - 0.4)) * w;
    const py = (hash01(i * 5.7 + seed * 2) + progress * 0.02 * (hash01(i + 5) - 0.5)) * h;
    const rad = (0.22 + hash01(i * 9 + seed) * 0.45) * Math.max(w, h);
    const a = strength * (0.35 + hash01(i * 1.3) * 0.65);
    drawGlow(ctx, px, py, rad, color, a);
  }
  ctx.restore();
}

/**
 * Fine film grain as sparse 1×1 speckles (never blocky cells).
 */
export function drawGrain(ctx, w, h, seed, amount = 0.04, quality = 1) {
  const dens = quality > 0.7 ? 0.0016 : quality > 0.4 ? 0.0010 : 0.0006;
  const count = Math.floor(w * h * dens);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = amount;
  for (let i = 0; i < count; i++) {
    const n = hash01(i * 19.7 + seed * 3.1);
    const x = (hash01(i * 3.3 + seed) * w) | 0;
    const y = (hash01(i * 7.1 + seed * 1.7) * h) | 0;
    const v = (n * 200 + 30) | 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = prev;
}

/** Starfield of tiny points — gentle parallax via progress */
export function drawStarfield(ctx, w, h, count, seed, progress = 0, alpha = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const layer = (i % 3) + 1;
    const x = ((hash01(i * 2.2 + seed) + progress * (0.015 / layer)) % 1) * w;
    const y = hash01(i * 6.6 + seed + 1) * h;
    const a = alpha * (0.15 + hash01(i * 4) * 0.55) / layer;
    const r = (0.4 + hash01(i * 8) * 1.4) / Math.sqrt(layer);
    ctx.fillStyle = rgba(200, 215, 255, a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Placeholder scene factory for stub chapters */
export function makeStubScene({ id, title, weight, checkpoints, label }) {
  return {
    id,
    title,
    weight,
    checkpoints: checkpoints.map((c, i) => ({
      id: c.id || `${id}-${i}`,
      at: c.at,
      timeLabel: c.timeLabel || "",
      title: c.title,
      body: c.body || "This chapter is a placeholder in the mockup. Visuals and placard text will be added in a later revision.",
    })),
    render(ctx, localProgress, view) {
      const { w, h } = view;
      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, w, h);
      drawStarfield(ctx, w, h, Math.floor(40 * (view.quality || 1)), 9, localProgress, 0.4);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#9aa3c7";
      ctx.font = `500 ${Math.max(14, Math.min(22, w * 0.028))}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cx = view.safeContent?.cx ?? w * 0.5;
      const cy = view.safeContent?.cy ?? h * 0.42;
      ctx.fillText(label || title, cx, cy);
      ctx.restore();
      drawVignette(ctx, w, h, 0.65);
    },
  };
}
