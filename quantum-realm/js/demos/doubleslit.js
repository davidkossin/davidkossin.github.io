import { createSceneHost, el, bindRange } from "../scene.js";
import {
  buildSampler,
  buildWhichPathSampler,
  intensity,
  intensityWhichPath,
  sampleHit,
} from "../physics/doubleslit.js";

export const meta = {
  id: "double-slit",
  title: "Wave–Particle Duality",
  subtitle: "Double-slit experiment",
  blurb: "Send particles one at a time and watch an interference pattern emerge.",
  icon: "⫸",
};

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">Even single particles build an interference pattern — unless a which-path detector destroys the wave-like coherence.</p>
        <p class="demo-intro">Electrons (or photons) are fired one by one through two slits. Each makes one spot on the screen. Over many hits, the spots follow the quantum intensity law — not two simple piles.</p>
        <div class="control-grid">
          <label>Wavelength λ <span data-v="lam"></span>
            <input type="range" id="lam" min="0.4" max="1.6" step="0.02" value="0.8" />
          </label>
          <label>Slit spacing d <span data-v="d"></span>
            <input type="range" id="d" min="1.5" max="5" step="0.1" value="2.8" />
          </label>
          <label>Slit width a <span data-v="a"></span>
            <input type="range" id="a" min="0.2" max="1.2" step="0.05" value="0.45" />
          </label>
          <label class="check"><input type="checkbox" id="which" /> Which-path detector <span class="hint">(destroys interference)</span></label>
          <label>Fire rate <span data-v="rate"></span>
            <input type="range" id="rate" min="1" max="40" step="1" value="12" />
          </label>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>Build a clear fringe pattern (≥ 800 hits), then turn on the which-path detector and watch the fringes wash out into a single-slit envelope.</p>
          <p class="score" id="score">Hits: 0 · Pattern score: —</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p>Far-field intensity with slit separation <em>d</em>, width <em>a</em>, wavelength <em>λ</em>, screen distance <em>L</em>:</p>
          <p class="eq">I(x) ∝ sinc²(π a x / λL) · cos²(π d x / λL)</p>
          <p>Hits are sampled from this |ψ|² distribution (Born rule). A which-path measurement removes the cos² interference term.</p>
          <p class="caveat">“Observation” here means a physical interaction that entangles path information with a detector — not consciousness.</p>
        </details>
        <div class="btn-row">
          <button type="button" class="btn-ghost" id="clear">Clear screen</button>
          <button type="button" class="btn-ghost" id="resetView">Reset view</button>
        </div>
      </aside>
      <div class="stage-stack">
        <div class="demo-stage" id="stage"></div>
        <p class="pattern-hist-label">Hit pattern</p>
        <canvas class="pattern-hist" id="hist" width="640" height="72" aria-label="Histogram of screen hits"></canvas>
      </div>
    </div>
  `);
  root.appendChild(ui);
  const stage = ui.querySelector("#stage");
  // Start pulled back; fitView() frames the full apparatus for the current aspect.
  const host = createSceneHost(stage, {
    camX: 5.2, camY: 3.2, camZ: 6.4, targetX: 0, targetY: 0.85, targetZ: 1.2, fov: 42,
    minDistance: 2, maxDistance: 28,
  });
  const { THREE, scene, camera, controls } = host;

  // Screen as a texture we paint into
  const texW = 512;
  const texH = 256;
  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0c18";
  ctx.fillRect(0, 0, texW, texH);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const SCREEN_Z = -1.35;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.3),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  screen.position.set(0, 0.95, SCREEN_Z);
  scene.add(screen);

  // Floor strip so depth reads clearly
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 6.2),
    new THREE.MeshStandardMaterial({ color: 0x0b1024, metalness: 0.05, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, 1.0);
  scene.add(floor);

  // Opaque barrier: three full-height panels → exactly two slits at ±d/2 (width a).
  // Visual x = physics × VIS_SCALE so openings track the same d,a as the intensity law.
  const VIS_SCALE = 0.55;
  const WALL_HALF = 2.6;
  const WALL_H = 1.85;
  const WALL_Z = 1.45;
  const SLIT_Y = 0.7;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3358, metalness: 0.2, roughness: 0.7 });
  const wallGroup = new THREE.Group();
  wallGroup.position.set(0, SLIT_Y, WALL_Z);
  scene.add(wallGroup);

  const detectorGroup = new THREE.Group();
  detectorGroup.position.set(0, SLIT_Y, WALL_Z);
  detectorGroup.visible = false;
  scene.add(detectorGroup);
  const detMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c, emissive: 0x9a3412, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.4,
  });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfdba74 });

  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      if (c.geometry) c.geometry.dispose();
      // shared materials — do not dispose
    }
  }

  function addDetectorAt(x) {
    // Just downstream of each opening, at slit mid-height
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.11), detMat);
    sensor.position.set(x, 0.15, -0.16);
    detectorGroup.add(sensor);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), lensMat);
    lens.position.set(x, 0.15, -0.26);
    detectorGroup.add(lens);
  }

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc, metalness: 0.35, roughness: 0.4, emissive: 0x0284c7, emissiveIntensity: 0.2,
  });

  function addTrimBox(x, y, w, h) {
    if (w < 0.01 || h < 0.01) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), trimMat);
    mesh.position.set(x, y, 0.06);
    wallGroup.add(mesh);
  }

  /** One solid wall plate with exactly two rectangular holes at ±d/2 (width a). */
  function rebuildBarrier() {
    clearGroup(wallGroup);
    clearGroup(detectorGroup);
    const d = params.d * VIS_SCALE;
    const a = Math.min(params.a * VIS_SCALE, d * 0.92);
    const halfA = a / 2;
    const L0 = -d / 2 - halfA;
    const L1 = -d / 2 + halfA;
    const R0 = d / 2 - halfA;
    const R1 = d / 2 + halfA;
    const halfH = WALL_H / 2;
    const margin = 0.28; // solid band above/below slits
    const y0 = -halfH + margin;
    const y1 = halfH - margin;

    const shape = new THREE.Shape();
    shape.moveTo(-WALL_HALF, -halfH);
    shape.lineTo(WALL_HALF, -halfH);
    shape.lineTo(WALL_HALF, halfH);
    shape.lineTo(-WALL_HALF, halfH);
    shape.lineTo(-WALL_HALF, -halfH);

    function slitHole(x0, x1) {
      const hole = new THREE.Path();
      // Opposite winding to outer shape so ExtrudeGeometry cuts the openings
      hole.moveTo(x0, y0);
      hole.lineTo(x1, y0);
      hole.lineTo(x1, y1);
      hole.lineTo(x0, y1);
      hole.lineTo(x0, y0);
      shape.holes.push(hole);
    }
    slitHole(L0, L1);
    slitHole(R0, R1);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: false,
    });
    geom.translate(0, 0, -0.06);
    const wall = new THREE.Mesh(geom, wallMat);
    wallGroup.add(wall);

    // Cyan frames around the two openings only
    for (const [x0, x1] of [[L0, L1], [R0, R1]]) {
      const cx = (x0 + x1) / 2;
      const sw = x1 - x0;
      const sh = y1 - y0;
      addTrimBox(cx, y1, sw + 0.05, 0.045);
      addTrimBox(cx, y0, sw + 0.05, 0.045);
      addTrimBox(x0, (y0 + y1) / 2, 0.045, sh);
      addTrimBox(x1, (y0 + y1) / 2, 0.045, sh);
    }

    addDetectorAt(-d / 2);
    addDetectorAt(d / 2);
    detectorGroup.visible = whichPath;
    slitLeftX = -d / 2;
    slitRightX = d / 2;
  }

  const gun = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b })
  );
  gun.rotation.x = Math.PI / 2;
  gun.position.set(0, SLIT_Y, 3.55);
  scene.add(gun);

  let hits = 0;
  let params = { d: 2.8, a: 0.45, wavelength: 0.8, L: 8 };
  let whichPath = false;
  let sampler = null;
  let xmax = 3.5;
  let rate = 12;
  let accum = 0;
  let slitLeftX = -0.77;
  let slitRightX = 0.77;
  const hist = new Float64Array(texW);
  const histCanvas = ui.querySelector("#hist");
  const histCtx = histCanvas.getContext("2d");

  /** Frame gun → double-slit wall → screen for the current stage aspect (desktop + mobile). */
  function fitView() {
    host.resize();
    const box = new THREE.Box3(
      new THREE.Vector3(-WALL_HALF - 0.15, -0.05, SCREEN_Z - 0.25),
      new THREE.Vector3(WALL_HALF + 0.15, SLIT_Y + WALL_H / 2 + 0.35, 3.9)
    );
    const center = box.getCenter(new THREE.Vector3());
    // Bias look-at slightly toward the wall so slits stay readable
    center.z = (WALL_Z + SCREEN_Z) * 0.35 + 3.55 * 0.15;
    const size = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(0.78, 0.42, 0.55).normalize();
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    // Sphere that contains the AABB
    const radius = 0.5 * Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
    const distV = radius / Math.sin(vFov / 2);
    const distH = radius / Math.sin(hFov / 2);
    const dist = Math.max(distV, distH) * 1.08;
    if (controls) {
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(dir, dist);
      controls.update();
    } else {
      camera.position.copy(center).addScaledVector(dir, dist);
      camera.lookAt(center);
    }
  }

  function drawHistogram() {
    const w = histCanvas.width;
    const h = histCanvas.height;
    histCtx.fillStyle = "#07091a";
    histCtx.fillRect(0, 0, w, h);
    // Theory curve
    let maxTh = 0;
    const th = new Float64Array(w);
    for (let i = 0; i < w; i++) {
      const x = -xmax + (2 * xmax * (i + 0.5)) / w;
      const v = whichPath ? intensityWhichPath(x, params) : intensity(x, params);
      th[i] = v;
      if (v > maxTh) maxTh = v;
    }
    histCtx.beginPath();
    for (let i = 0; i < w; i++) {
      const y = h - 4 - (maxTh > 0 ? (th[i] / maxTh) * (h - 10) : 0);
      if (i === 0) histCtx.moveTo(i, y);
      else histCtx.lineTo(i, y);
    }
    histCtx.strokeStyle = "rgba(167,139,250,0.55)";
    histCtx.lineWidth = 1.5;
    histCtx.stroke();
    // Empirical hits
    let maxH = 0;
    for (let i = 0; i < texW; i++) if (hist[i] > maxH) maxH = hist[i];
    if (maxH > 0) {
      histCtx.beginPath();
      for (let i = 0; i < w; i++) {
        const src = Math.min(texW - 1, Math.floor((i / w) * texW));
        const y = h - 4 - (hist[src] / maxH) * (h - 10);
        if (i === 0) histCtx.moveTo(i, y);
        else histCtx.lineTo(i, y);
      }
      histCtx.strokeStyle = whichPath ? "rgba(251,146,60,0.95)" : "rgba(125,211,252,0.95)";
      histCtx.lineWidth = 2;
      histCtx.stroke();
    }
    // Zero line
    histCtx.strokeStyle = "rgba(148,163,184,0.25)";
    histCtx.beginPath();
    histCtx.moveTo(0, h - 4);
    histCtx.lineTo(w, h - 4);
    histCtx.stroke();
  }

  function rebuild() {
    params = {
      d: parseFloat(ui.querySelector("#d").value),
      a: parseFloat(ui.querySelector("#a").value),
      wavelength: parseFloat(ui.querySelector("#lam").value),
      L: 8,
    };
    whichPath = ui.querySelector("#which").checked;
    sampler = whichPath
      ? buildWhichPathSampler(params, { xmax, bins: 2048 })
      : buildSampler(params, { xmax, bins: 2048 });
    ui.querySelector('[data-v="lam"]').textContent = params.wavelength.toFixed(2);
    ui.querySelector('[data-v="d"]').textContent = params.d.toFixed(2);
    ui.querySelector('[data-v="a"]').textContent = params.a.toFixed(2);
    rebuildBarrier();
    drawHistogram();
  }

  bindRange(ui.querySelector("#lam"), rebuild);
  bindRange(ui.querySelector("#d"), rebuild);
  bindRange(ui.querySelector("#a"), rebuild);
  ui.querySelector("#which").addEventListener("change", rebuild);
  bindRange(ui.querySelector("#rate"), (v) => {
    rate = v;
    ui.querySelector('[data-v="rate"]').textContent = String(v);
  });

  function clear() {
    hits = 0;
    hist.fill(0);
    ctx.fillStyle = "#0a0c18";
    ctx.fillRect(0, 0, texW, texH);
    tex.needsUpdate = true;
    updateScore();
    drawHistogram();
  }
  ui.querySelector("#clear").addEventListener("click", clear);
  ui.querySelector("#resetView").addEventListener("click", fitView);

  function paintHit(x) {
    // map x in [-xmax,xmax] to texture u
    const u = (x + xmax) / (2 * xmax);
    const px = Math.max(0, Math.min(texW - 1, Math.floor(u * texW)));
    hist[px]++;
    hits++;
    const y = 20 + Math.floor(Math.random() * (texH - 40));
    ctx.fillStyle = whichPath ? "rgba(251,146,60,0.55)" : "rgba(125,211,252,0.55)";
    ctx.fillRect(px - 1, y - 1, 3, 3);
    tex.needsUpdate = true;
    if (hits % 5 === 0 || hits < 8) {
      updateScore();
      drawHistogram();
    }
  }

  function updateScore() {
    // Compare histogram to theory via correlation
    let score = "—";
    if (hits >= 200) {
      let dot = 0, n1 = 0, n2 = 0;
      for (let i = 0; i < texW; i++) {
        const x = -xmax + (2 * xmax * (i + 0.5)) / texW;
        const th = whichPath ? intensityWhichPath(x, params) : intensity(x, params);
        const h = hist[i];
        dot += th * h;
        n1 += th * th;
        n2 += h * h;
      }
      const corr = n1 > 0 && n2 > 0 ? dot / Math.sqrt(n1 * n2) : 0;
      score = `${(corr * 100).toFixed(0)}% match to theory`;
    }
    ui.querySelector("#score").textContent = `Hits: ${hits} · Pattern score: ${score}`;
  }

  // Flying particles: gun → chosen slit opening → screen hit
  const flyers = [];
  const Z_GUN = 3.35;
  const Z_SLIT = WALL_Z;
  function spawnFlyer(targetX) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: whichPath ? 0xfb923c : 0x7dd3fc })
    );
    m.position.set(0, SLIT_Y, Z_GUN);
    scene.add(m);
    const slitX = Math.random() < 0.5 ? slitLeftX : slitRightX;
    const halfA = (params.a * VIS_SCALE) / 2;
    const slitJitter = (Math.random() - 0.5) * halfA * 0.65;
    // Screen hit x in world units (screen half-width ≈ 2.3)
    const screenX = Math.max(-2.2, Math.min(2.2, targetX * (2.2 / xmax)));
    flyers.push({
      mesh: m,
      t: 0,
      targetX,
      slitX: slitX + slitJitter,
      screenX,
      y: SLIT_Y + (Math.random() - 0.5) * 0.28,
    });
  }

  host.setTick((t) => {
    const dt = 1 / 60;
    accum += rate * dt;
    while (accum >= 1) {
      accum -= 1;
      if (!sampler) rebuild();
      spawnFlyer(sampleHit(sampler));
    }
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t += dt * 1.55;
      const u = Math.min(1, f.t);
      let x, z;
      if (u < 0.4) {
        const s = u / 0.4;
        x = f.slitX * s;
        z = Z_GUN + (Z_SLIT - Z_GUN) * s;
      } else {
        const s = (u - 0.4) / 0.6;
        // Ease outward only after clearing the wall so paths don't float beside it
        const ease = s * s;
        x = f.slitX + (f.screenX - f.slitX) * ease;
        z = Z_SLIT + (SCREEN_Z - Z_SLIT) * s;
      }
      f.mesh.position.set(x, f.y, z);
      if (f.t >= 1) {
        paintHit(f.targetX);
        scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        flyers.splice(i, 1);
      }
    }
  });

  rebuild();
  // Defer fit until layout has real stage size (esp. mobile)
  requestAnimationFrame(() => {
    fitView();
    requestAnimationFrame(fitView);
  });
  const ro = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => fitView())
    : null;
  if (ro) ro.observe(stage);
  window.addEventListener("resize", fitView);

  return () => {
    if (ro) ro.disconnect();
    window.removeEventListener("resize", fitView);
    flyers.forEach((f) => {
      scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
    });
    host.dispose();
    ui.remove();
  };
}
