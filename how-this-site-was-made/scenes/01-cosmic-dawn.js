/**
 * Chapter 1 — Cosmic dawn (premium)
 * Smooth volumetric plasma, fog clearing into CMB mottling, first stars & galaxies.
 * State is a pure function of localProgress (+ view.quality for particle counts).
 */
import {
  clamp, lerp, smoothstep, smootherstep, hash01, fbm,
  drawGlow, drawBloom, drawVignette, drawGrain,
  drawVolumetricHaze, drawStarfield, rgba, mixRgb,
} from "../util.js";

const checkpoints = [
  {
    id: "big-bang",
    at: 0.02,
    timeLabel: "t = 0 · about 13.8 billion years ago",
    title: "The Big Bang",
    body: "According to the standard ΛCDM model, space, time, matter, and energy begin in an extremely hot, dense state. The age of the Universe today is about 13.8 billion years. What follows is a continuous cooling and expansion that sets the initial conditions for everything later on this page.",
  },
  {
    id: "inflation",
    at: 0.12,
    timeLabel: "about 10⁻³⁶ to 10⁻³² seconds after the Big Bang",
    title: "Cosmic inflation",
    body: "In a brief interval of accelerated expansion, regions that are now widely separated were once in causal contact. Inflation stretches tiny quantum fluctuations into the seeds of later large-scale structure. When inflation ends, its energy reheats into a hot soup of particles.",
  },
  {
    id: "qgp",
    at: 0.24,
    timeLabel: "about 10⁻⁶ seconds",
    title: "Quark–gluon plasma and hadrons",
    body: "For a short time the Universe is filled with a quark–gluon plasma — quarks and gluons not yet confined inside hadrons. As it cools through roughly a trillion kelvin, quarks bind into protons and neutrons. Electrons, neutrinos, and photons fill the remaining thermal bath.",
  },
  {
    id: "bbn",
    at: 0.36,
    timeLabel: "about 3 to 20 minutes",
    title: "Big Bang nucleosynthesis",
    body: "While the Universe is still hotter than about a billion kelvin, protons and neutrons fuse into light nuclei. Roughly three-quarters of baryonic mass ends as hydrogen-1, about one-quarter as helium-4, with traces of deuterium, helium-3, and lithium-7. Heavier elements form later inside stars.",
  },
  {
    id: "recombination",
    at: 0.52,
    timeLabel: "about 380,000 years",
    title: "Recombination and the cosmic microwave background",
    body: "Electrons combine with nuclei to form neutral atoms, and the photon mean free path grows suddenly. Light that last scattered then still fills the sky today as the cosmic microwave background — a nearly uniform glow at about 2.725 K, with tiny temperature variations of order one part in 100,000.",
  },
  {
    id: "dark-ages",
    at: 0.66,
    timeLabel: "about 380,000 years to ~100 million years",
    title: "The cosmic dark ages",
    body: "After the CMB is released, there are not yet luminous stars. Neutral hydrogen fills expanding space. Density perturbations grow under gravity, especially in dark matter, quietly assembling the halos that will host the first stars.",
  },
  {
    id: "first-stars",
    at: 0.80,
    timeLabel: "about 100 to 200 million years",
    title: "First stars — Population III",
    body: "In metal-free minihalos, molecular hydrogen cooling allows gas to collapse into the first stars. These Population III stars are thought to have been typically much more massive than the Sun, short-lived, and bright in ultraviolet light — the first local sources of illumination after the dark ages.",
  },
  {
    id: "reionization",
    at: 0.93,
    timeLabel: "up to about 1 billion years",
    title: "First galaxies and reionization",
    body: "Early galaxies assemble as stars and supernovae enrich the surrounding gas. Ultraviolet radiation gradually reionizes intergalactic hydrogen. Observations place the midpoint of reionization near redshift z ≈ 7–8 (roughly 600–700 million years), with the process largely complete by about 1 billion years after the Big Bang.",
  },
];

const WHITE = { r: 255, g: 252, b: 245 };
const GOLD = { r: 255, g: 210, b: 130 };
const PLASMA_HOT = { r: 255, g: 140, b: 70 };
const PLASMA_PINK = { r: 255, g: 100, b: 140 };
const PLASMA_COOL = { r: 255, g: 170, b: 110 };
const CMB_WARM = { r: 210, g: 160, b: 130 };
const CMB_COOL = { r: 90, g: 110, b: 150 };
const STAR = { r: 210, g: 225, b: 255 };

function colorTemp(p) {
  if (p < 0.15) return mixRgb(WHITE, GOLD, smoothstep(0, 0.15, p));
  if (p < 0.32) return mixRgb(GOLD, PLASMA_PINK, smoothstep(0.15, 0.32, p));
  if (p < 0.48) return mixRgb(PLASMA_PINK, PLASMA_COOL, smoothstep(0.32, 0.48, p));
  if (p < 0.62) return mixRgb(PLASMA_COOL, CMB_WARM, smoothstep(0.48, 0.62, p));
  if (p < 0.82) return mixRgb(CMB_WARM, { r: 28, g: 34, b: 60 }, smoothstep(0.62, 0.82, p));
  return mixRgb({ r: 28, g: 34, b: 60 }, { r: 5, g: 6, b: 16 }, smoothstep(0.82, 1, p));
}

function stageCenter(view, w, h) {
  const s = view.safeContent;
  if (s && s.w > 40) return { cx: s.cx, cy: s.cy };
  return { cx: w * 0.5, cy: h * 0.48 };
}

function drawPlasmaVolume(ctx, w, h, p, quality, opacity) {
  if (opacity < 0.01) return;
  // Soft radial blobs only — never cell/ImageData fields (avoids any grid).
  const n = Math.floor(lerp(10, 22, quality));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = ((hash01(i * 2.1 + 2) + p * 0.04 * (hash01(i) - 0.4)) % 1) * w;
    const y = ((hash01(i * 5.3 + 4) + p * 0.03 * (hash01(i + 1) - 0.5)) % 1) * h;
    const rad = (0.18 + hash01(i * 8) * 0.55) * Math.max(w, h);
    const hot = hash01(i * 3) > 0.45;
    const col = hot ? mixRgb(PLASMA_HOT, GOLD, hash01(i * 4)) : mixRgb(PLASMA_PINK, PLASMA_COOL, hash01(i * 5));
    const a = opacity * (0.08 + hash01(i * 6) * 0.14);
    drawGlow(ctx, x, y, rad, col, a);
  }
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < Math.floor(n * 0.6); i++) {
    const x = hash01(i * 9.1 + 7) * w;
    const y = hash01(i * 4.4 + 8) * h;
    const rad = (0.08 + hash01(i * 2) * 0.2) * Math.max(w, h);
    drawGlow(ctx, x, y, rad, WHITE, 0.06 * opacity);
  }
  ctx.restore();
  drawVolumetricHaze(ctx, w, h, {
    count: Math.floor(lerp(6, 12, quality)),
    seed: 3,
    strength: 0.22 * opacity,
    color: mixRgb(PLASMA_HOT, GOLD, 0.4),
    progress: p,
    composite: "lighter",
  });
}

function drawCMBField(ctx, w, h, strength, quality, p) {
  if (strength < 0.01) return;
  // Soft all-sky wash
  ctx.save();
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  g.addColorStop(0, rgba(CMB_WARM.r, CMB_WARM.g, CMB_WARM.b, 0.28 * strength));
  g.addColorStop(0.55, rgba(160, 130, 120, 0.14 * strength));
  g.addColorStop(1, rgba(40, 50, 80, 0.06 * strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Anisotropy as large soft blobs (no grids) — warm/cool patches
  const n = Math.floor(lerp(18, 36, quality));
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 3.7 + 11) * w;
    const y = hash01(i * 8.1 + 13) * h;
    const rad = (0.12 + hash01(i * 2.2) * 0.28) * Math.max(w, h);
    const warm = hash01(i * 5.5 + 11) > 0.5;
    const col = warm ? { r: 230, g: 175, b: 140 } : { r: 90, g: 115, b: 160 };
    drawGlow(ctx, x, y, rad, col, 0.11 * strength);
  }
  ctx.restore();
}

function drawFirstStars(ctx, w, h, cx, cy, p, quality, strength) {
  if (strength < 0.01) return;
  const count = Math.floor(lerp(20, 100, quality));
  const ignite = smootherstep(0.70, 0.90, p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const birth = hash01(i * 13.1);
    const on = clamp((ignite - birth * 0.8) / 0.22, 0, 1) * strength;
    if (on <= 0) continue;
    // Bias slightly toward stage center, still fill frame
    const bx = hash01(i * 19.7 + 3.1);
    const by = hash01(i * 7.3 + 11.9);
    const x = lerp(bx * w, cx + (bx - 0.5) * w * 0.9, 0.35);
    const y = lerp(by * h, cy + (by - 0.5) * h * 0.85, 0.35);
    const r = 0.7 + hash01(i * 2.9) * 2.6;
    const col = hash01(i * 5.5) > 0.65 ? { r: 255, g: 215, b: 175 } : STAR;
    const pulse = 0.88 + 0.12 * Math.sin((p * 6 + i) * 1.3);
    drawGlow(ctx, x, y, r * 26 * on * pulse, col, 0.5 * on);
    drawGlow(ctx, x, y, r * 8 * on, WHITE, 0.4 * on);
    ctx.fillStyle = rgba(255, 255, 255, 0.92 * on);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.1, r * on), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGalaxies(ctx, w, h, cx, cy, p, quality, strength) {
  if (strength < 0.01) return;
  const count = Math.floor(lerp(5, 16, quality));
  const grow = smootherstep(0.86, 1.0, p) * strength;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const gx = lerp(hash01(i * 4.4 + 2) * w, cx + (hash01(i * 4.4) - 0.5) * w * 0.85, 0.3);
    const gy = lerp(hash01(i * 9.1 + 6) * h, cy + (hash01(i * 9.1) - 0.5) * h * 0.75, 0.3);
    const ang = hash01(i * 3.3) * Math.PI * 2;
    const size = (36 + hash01(i * 2.2) * 80) * grow;
    const a = (0.1 + hash01(i) * 0.14) * grow;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(ang);
    ctx.scale(1, 0.32 + hash01(i * 1.7) * 0.35);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    g.addColorStop(0, rgba(240, 245, 255, a * 2));
    g.addColorStop(0.2, rgba(150, 170, 255, a));
    g.addColorStop(0.55, rgba(100, 70, 180, a * 0.4));
    g.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawInflationRings(ctx, cx, cy, w, h, p, strength) {
  if (strength < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 6; k++) {
    const t = (p * 1.6 + k * 0.14) % 1;
    const r = Math.max(w, h) * (0.04 + t * 0.5);
    ctx.strokeStyle = rgba(255, 230, 180, 0.14 * strength * (1 - t));
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawBloom(ctx, cx, cy, Math.max(w, h) * 0.28, GOLD, 0.35 * strength);
  ctx.restore();
}

const scene = {
  id: "cosmic-dawn",
  title: "Cosmic dawn",
  weight: 1.6,
  checkpoints,
  render(ctx, localProgress, view) {
    const { w, h, quality = 1 } = view;
    const p = clamp(localProgress, 0, 1);
    const { cx, cy } = stageCenter(view, w, h);

    // Era opacities (soft morphs)
    const flash = Math.max(1 - smoothstep(0.0, 0.14, p), smoothstep(0.0, 0.04, p) * (1 - smoothstep(0.05, 0.14, p)));
    const infl = smoothstep(0.06, 0.14, p) * (1 - smoothstep(0.18, 0.28, p));
    const plasma = smoothstep(0.12, 0.28, p) * (1 - smootherstep(0.48, 0.64, p));
    const fogOpaque = (1 - smootherstep(0.46, 0.60, p)) * clamp(plasma * 0.9 + 0.55 * (1 - smoothstep(0.38, 0.52, p)), 0, 1);
    const cmb = smootherstep(0.48, 0.60, p) * (1 - smootherstep(0.76, 0.90, p));
    const dark = smootherstep(0.60, 0.72, p);
    const stars = smootherstep(0.70, 0.84, p);
    const gal = smootherstep(0.86, 0.96, p);

    const bg = colorTemp(p);
    const deep = mixRgb(bg, { r: 5, g: 6, b: 15 }, dark * 0.92);
    ctx.fillStyle = rgba(deep.r, deep.g, deep.b, 1);
    ctx.fillRect(0, 0, w, h);

    // Big Bang flash
    if (flash > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rad = Math.max(w, h) * lerp(0.2, 1.05, smootherstep(0, 0.1, p));
      drawGlow(ctx, cx, cy, rad, WHITE, 0.95 * flash);
      drawGlow(ctx, cx, cy, rad * 0.55, GOLD, 0.75 * flash);
      drawGlow(ctx, cx, cy, rad * 0.22, WHITE, 0.95 * flash);
      ctx.restore();
    }

    drawInflationRings(ctx, cx, cy, w, h, p, infl);

    // Hot plasma volume (smooth — no cells)
    drawPlasmaVolume(ctx, w, h, p, quality, Math.max(plasma, fogOpaque * 0.85));

    // Dense fog that CLEARS at recombination → transparency
    if (fogOpaque > 0.02) {
      ctx.save();
      // Optical depth falls as recombination proceeds
      const depth = fogOpaque;
      const hazeCol = colorTemp(Math.min(p, 0.55));
      // Multiple soft layers for volumetric depth
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const rad = Math.max(w, h) * (0.35 + t * 0.55);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, rgba(hazeCol.r, hazeCol.g, hazeCol.b, 0.12 * depth * (1 - t * 0.5)));
        g.addColorStop(0.55, rgba(hazeCol.r, hazeCol.g, hazeCol.b, 0.22 * depth));
        g.addColorStop(1, rgba(30, 12, 5, 0.4 * depth * (0.6 + t * 0.4)));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      // Extra soft fog sheets as overlapping glows
      for (let i = 0; i < Math.floor(lerp(4, 8, quality)); i++) {
        drawGlow(
          ctx,
          hash01(i * 2.2 + 5) * w,
          hash01(i * 4.1 + 6) * h,
          (0.25 + hash01(i) * 0.4) * Math.max(w, h),
          hazeCol,
          0.1 * depth
        );
      }
      ctx.restore();
    }

    // CMB emerges as fog clears
    drawCMBField(ctx, w, h, cmb + fogOpaque * 0.05, quality, p);

    // Drift particles in plasma era
    if (plasma > 0.05) {
      const n = Math.floor(lerp(30, 110, quality) * plasma);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const layer = (i % 3) + 1;
        const x = ((hash01(i * 1.7) + p * (0.05 / layer)) % 1) * w;
        const y = ((hash01(i * 3.9 + 4) + p * 0.02 / layer) % 1) * h;
        const c = colorTemp(p);
        ctx.fillStyle = rgba(c.r, c.g, c.b, 0.28 / layer * plasma);
        ctx.beginPath();
        ctx.arc(x, y, (0.6 + hash01(i * 8) * 2) / layer, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (dark > 0.4 && stars < 0.3) {
      drawStarfield(ctx, w, h, Math.floor(20 * quality), 1, p, 0.15 * dark);
    }

    drawFirstStars(ctx, w, h, cx, cy, p, quality, Math.max(stars, gal * 0.5));
    drawGalaxies(ctx, w, h, cx, cy, p, quality, gal);

    if (p > 0.78) {
      drawStarfield(ctx, w, h, Math.floor(50 * quality), 4, p, 0.35 * smootherstep(0.78, 0.95, p));
    }

    drawVignette(ctx, w, h, 0.48 + dark * 0.2);
    drawGrain(ctx, w, h, Math.floor(p * 1000), 0.03, quality);
  },
};

export default scene;
