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

/** Value noise 2D */
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
  for (let i = 0; i < octaves; i++) {
    v += a * valueNoise2(x * f, y * f);
    a *= 0.5;
    f *= 2;
  }
  return v;
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

/** Soft vignette */
export function drawVignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.65, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Subtle film grain — density scales with quality */
export function drawGrain(ctx, w, h, seed, amount = 0.04, quality = 1) {
  // Sparse 1×1 speckles — avoids blocky grid artifacts from large steps.
  const dens = quality > 0.7 ? 0.0028 : quality > 0.4 ? 0.0018 : 0.0010;
  const count = Math.floor(w * h * dens);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = amount * 1.4;
  for (let i = 0; i < count; i++) {
    const n = hash01(i * 19.7 + seed * 3.1);
    const x = (hash01(i * 3.3 + seed) * w) | 0;
    const y = (hash01(i * 7.1 + seed * 1.7) * h) | 0;
    const v = (n * 220 + 20) | 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = prev;
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

      // faint star dust
      const n = Math.floor(40 * (view.quality || 1));
      for (let i = 0; i < n; i++) {
        const px = hash01(i * 3.1 + 2) * w;
        const py = hash01(i * 5.7 + 9) * h;
        const a = 0.08 + hash01(i * 1.3) * 0.18;
        ctx.fillStyle = `rgba(180,200,255,${a})`;
        ctx.fillRect(px, py, 1.5, 1.5);
      }

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#9aa3c7";
      ctx.font = `500 ${Math.max(14, Math.min(22, w * 0.028))}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label || title, w * 0.5, h * 0.42);
      ctx.globalAlpha = 0.22;
      ctx.font = `300 ${Math.max(12, Math.min(16, w * 0.02))}px Outfit, system-ui, sans-serif`;
      ctx.fillText("Coming in a later revision", w * 0.5, h * 0.42 + 28);
      ctx.restore();

      drawVignette(ctx, w, h, 0.65);
    },
  };
}
