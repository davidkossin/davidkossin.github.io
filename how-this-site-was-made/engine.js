/**
 * Timeline engine — scrubber, crossfade, play/pause, adaptive quality.
 * Scenes are opaque modules; the engine never reads placard prose except to display it.
 */
import { clamp, lerp, smoothstep, smootherstep } from "./util.js";

const CROSSFADE = 0.035; // fraction of global progress for chapter blends
const SNAP_RADIUS = 0.018; // global scrub units
const PLAY_SPEED = 0.012; // global progress per second (slow)

/**
 * @typedef {{ id: string, at: number, timeLabel: string, title: string, body: string }} Checkpoint
 * @typedef {{
 *   id: string,
 *   title: string,
 *   weight: number,
 *   checkpoints: Checkpoint[],
 *   render: (ctx: CanvasRenderingContext2D, localProgress: number, view: object) => void
 * }} Scene
 */

export function createEngine({ canvas, scenes, ui }) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Build layout: cumulative weight → global [0,1]
  const totalWeight = scenes.reduce((s, sc) => s + (sc.weight || 1), 0);
  const layout = [];
  let acc = 0;
  for (const sc of scenes) {
    const w = (sc.weight || 1) / totalWeight;
    layout.push({ scene: sc, start: acc, end: acc + w, weight: w });
    acc += w;
  }

  // Flatten checkpoints with global positions
  const allCheckpoints = [];
  for (const L of layout) {
    for (const cp of L.scene.checkpoints) {
      allCheckpoints.push({
        ...cp,
        sceneId: L.scene.id,
        globalAt: L.start + clamp(cp.at, 0, 1) * L.weight,
        chapterTitle: L.scene.title,
      });
    }
  }
  allCheckpoints.sort((a, b) => a.globalAt - b.globalAt);

  let progress = 0; // global 0..1
  let playing = false;
  let pointerDragging = false;
  let snapTarget = null;
  let snapVel = 0;
  let quality = 1;
  let frameMsEma = 16.7;
  let lastTs = performance.now();
  let placardOpacity = 1;
  let placardSlide = 0;
  let lastCpId = allCheckpoints[0]?.id;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2.5);
    // Adaptive resolution
    dpr = rawDpr * (quality > 0.55 ? 1 : quality > 0.35 ? 0.85 : 0.7);
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sceneAt(g) {
    for (let i = 0; i < layout.length; i++) {
      const L = layout[i];
      if (g <= L.end || i === layout.length - 1) {
        const local = L.weight > 0 ? clamp((g - L.start) / L.weight, 0, 1) : 0;
        return { index: i, layout: L, local };
      }
    }
    const last = layout[layout.length - 1];
    return { index: layout.length - 1, layout: last, local: 1 };
  }

  function nearestCheckpoint(g) {
    let best = allCheckpoints[0];
    let bestDist = Infinity;
    for (const cp of allCheckpoints) {
      const d = Math.abs(cp.globalAt - g);
      if (d < bestDist) {
        bestDist = d;
        best = cp;
      }
    }
    return { cp: best, dist: bestDist };
  }

  function activeCheckpoint(g) {
    // Prefer checkpoint we are at or just past within its chapter
    let active = allCheckpoints[0];
    for (const cp of allCheckpoints) {
      if (cp.globalAt <= g + 0.001) active = cp;
      else break;
    }
    return active;
  }


  /** Rectangle free of placard / topbar / scrubber — scenes should center art here. */
  function getSafeContentRect() {
    const pad = 12;
    let top = pad + 48; // below brand
    let left = pad;
    let right = cssW - pad;
    let bottom = cssH - pad;

    if (ui.scrubber) {
      const r = ui.scrubber.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      bottom = Math.min(bottom, r.top - canvasRect.top - pad);
    } else if (ui.track) {
      const r = ui.track.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      bottom = Math.min(bottom, r.top - canvasRect.top - 36);
    }

    if (ui.placard) {
      const r = ui.placard.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const px = r.left - canvasRect.left;
      const py = r.top - canvasRect.top;
      const pr = px + r.width;
      const pb = py + r.height;
      const narrow = cssW < 700;
      if (narrow) {
        // Placard spans width — stage sits below it
        top = Math.max(top, pb + pad);
      } else {
        // Desktop: prefer stage to the right of the placard if that yields a usable width
        const rightWidth = cssW - pr - pad * 2;
        const belowHeight = bottom - (pb + pad);
        if (rightWidth >= cssW * 0.38) {
          left = Math.max(left, pr + pad);
          top = Math.max(top, py); // align roughly with placard top band
        } else if (belowHeight > 120) {
          top = Math.max(top, pb + pad);
        } else {
          left = Math.max(left, pr + pad);
        }
      }
    }

    const x = clamp(left, 0, cssW);
    const y = clamp(top, 0, cssH);
    const w = Math.max(40, right - x);
    const h = Math.max(40, bottom - y);
    return { x, y, w, h, cx: x + w * 0.5, cy: y + h * 0.5 };
  }

  function renderFrame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    // Adaptive quality
    frameMsEma = frameMsEma * 0.9 + (dt * 1000) * 0.1;
    if (frameMsEma > 22) quality = Math.max(0.3, quality - 0.02);
    else if (frameMsEma < 14) quality = Math.min(1, quality + 0.01);

    // Snap ease
    if (snapTarget != null && !pointerDragging) {
      const diff = snapTarget - progress;
      if (Math.abs(diff) < 0.0004) {
        progress = snapTarget;
        snapTarget = null;
        snapVel = 0;
      } else {
        // Smooth critically-damped-ish ease
        snapVel = snapVel * 0.75 + diff * 8 * dt;
        progress = clamp(progress + snapVel, 0, 1);
      }
    } else if (playing && !pointerDragging && !reducedMotion) {
      progress = clamp(progress + PLAY_SPEED * dt, 0, 1);
      if (progress >= 1) playing = false;
    }

    // Placard transition
    const cp = activeCheckpoint(progress);
    if (cp.id !== lastCpId) {
      lastCpId = cp.id;
      placardOpacity = 0;
      placardSlide = 12;
      updatePlacard(cp);
    }
    placardOpacity = lerp(placardOpacity, 1, 1 - Math.pow(0.001, dt));
    placardSlide = lerp(placardSlide, 0, 1 - Math.pow(0.001, dt));
    if (ui.placard) {
      ui.placard.style.opacity = String(placardOpacity);
      ui.placard.style.transform = `translateY(${placardSlide}px)`;
    }

    // Draw
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      resize();
    }

    const safeContent = getSafeContentRect();
    const view = {
      w: cssW,
      h: cssH,
      dpr,
      quality,
      reducedMotion,
      time: ts / 1000,
      safeContent,
    };

    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, cssW, cssH);

    const { index, layout: L, local } = sceneAt(progress);

    // Crossfade with neighbor near edges
    const edgeDist = Math.min(progress - L.start, L.end - progress);
    const fadeZone = CROSSFADE;
    let drawn = false;

    if (edgeDist < fadeZone && layout.length > 1) {
      const nearStart = progress - L.start < fadeZone;
      const neighborIdx = nearStart ? index - 1 : index + 1;
      if (neighborIdx >= 0 && neighborIdx < layout.length) {
        const N = layout[neighborIdx];
        const t = nearStart
          ? 1 - (progress - L.start) / fadeZone
          : 1 - (L.end - progress) / fadeZone;
        const blend = smoothstep(0, 1, clamp(t, 0, 1));
        // Draw neighbor then current with alpha
        ctx.save();
        ctx.globalAlpha = blend;
        const trueNLocal = clamp((progress - N.start) / N.weight, 0, 1);
        N.scene.render(ctx, trueNLocal, view);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 1 - blend * 0.85;
        L.scene.render(ctx, local, view);
        ctx.restore();
        drawn = true;
      }
    }

    if (!drawn) {
      L.scene.render(ctx, local, view);
    }

    updateScrubberChrome(progress, cp);
    updatePlayButton();

    requestAnimationFrame(renderFrame);
  }

  function updatePlacard(cp) {
    if (!ui.placardTime) return;
    ui.placardTime.textContent = cp.timeLabel;
    ui.placardTitle.textContent = cp.title;
    ui.placardBody.textContent = cp.body;
    ui.placardChapter.textContent = cp.chapterTitle;
    if (ui.live) ui.live.textContent = `${cp.chapterTitle}: ${cp.title}. ${cp.timeLabel}.`;
  }

  function updateScrubberChrome(g, cp) {
    if (ui.thumb) {
      ui.thumb.style.left = `${g * 100}%`;
    }
    if (ui.fill) {
      ui.fill.style.width = `${g * 100}%`;
    }
    if (ui.slider) {
      ui.slider.setAttribute("aria-valuenow", String(Math.round(g * 1000)));
      ui.slider.setAttribute("aria-valuetext", `${cp.title}, ${cp.timeLabel}`);
    }
  }

  function updatePlayButton() {
    if (!ui.playBtn) return;
    ui.playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
    ui.playBtn.textContent = playing ? "Pause" : "Play";
  }

  function setProgressFromClientX(clientX) {
    const track = ui.track;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const g = clamp((clientX - rect.left) / rect.width, 0, 1);
    progress = g;
    snapTarget = null;
  }

  function releaseSnap() {
    const { cp, dist } = nearestCheckpoint(progress);
    if (dist < SNAP_RADIUS) {
      snapTarget = cp.globalAt;
      snapVel = 0;
    }
  }

  function jumpCheckpoint(dir) {
    const g = progress;
    if (dir > 0) {
      const next = allCheckpoints.find((c) => c.globalAt > g + 0.002);
      snapTarget = next ? next.globalAt : allCheckpoints[allCheckpoints.length - 1].globalAt;
    } else {
      let prev = allCheckpoints[0];
      for (const c of allCheckpoints) {
        if (c.globalAt < g - 0.002) prev = c;
        else break;
      }
      snapTarget = prev.globalAt;
    }
    snapVel = 0;
    playing = false;
  }

  // Build tick marks + era labels
  function buildTicks() {
    if (!ui.ticks || !ui.eras) return;
    ui.ticks.innerHTML = "";
    ui.eras.innerHTML = "";
    for (const cp of allCheckpoints) {
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.style.left = `${cp.globalAt * 100}%`;
      tick.title = cp.title;
      ui.ticks.appendChild(tick);
    }
    for (const L of layout) {
      const era = document.createElement("span");
      era.className = "era";
      era.style.left = `${(L.start + L.weight * 0.5) * 100}%`;
      era.textContent = L.scene.title;
      ui.eras.appendChild(era);
    }
  }

  // Pointer events on scrubber
  function onPointerDown(e) {
    pointerDragging = true;
    playing = false;
    snapTarget = null;
    ui.track.setPointerCapture?.(e.pointerId);
    setProgressFromClientX(e.clientX);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!pointerDragging) return;
    setProgressFromClientX(e.clientX);
  }
  function onPointerUp(e) {
    if (!pointerDragging) return;
    pointerDragging = false;
    setProgressFromClientX(e.clientX);
    releaseSnap();
  }

  function onKey(e) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      jumpCheckpoint(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      jumpCheckpoint(-1);
    } else if (e.key === " " || e.key === "k") {
      e.preventDefault();
      if (!reducedMotion) playing = !playing;
    } else if (e.key === "Home") {
      e.preventDefault();
      snapTarget = 0;
      playing = false;
    } else if (e.key === "End") {
      e.preventDefault();
      snapTarget = 1;
      playing = false;
    }
  }

  // Init
  resize();
  buildTicks();
  updatePlacard(allCheckpoints[0]);
  window.addEventListener("resize", resize);

  ui.track.addEventListener("pointerdown", onPointerDown);
  ui.track.addEventListener("pointermove", onPointerMove);
  ui.track.addEventListener("pointerup", onPointerUp);
  ui.track.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKey);

  ui.playBtn?.addEventListener("click", () => {
    if (reducedMotion) return;
    playing = !playing;
    if (progress >= 1) progress = 0;
  });

  // Expose for debugging / tests
  const api = {
    get progress() { return progress; },
    set progress(v) { progress = clamp(v, 0, 1); snapTarget = null; },
    get checkpoints() { return allCheckpoints; },
    get layout() { return layout; },
    jumpCheckpoint,
    gotoCheckpointId(id) {
      const cp = allCheckpoints.find((c) => c.id === id);
      if (cp) { snapTarget = cp.globalAt; playing = false; }
    },
  };

  requestAnimationFrame(renderFrame);
  return api;
}
