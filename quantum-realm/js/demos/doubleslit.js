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
        <button type="button" class="btn-ghost" id="clear">Clear screen</button>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const stage = ui.querySelector("#stage");
  const host = createSceneHost(stage, { camX: 2.4, camY: 1.5, camZ: 4.0, targetY: 0.7, targetZ: 0.9, fov: 46 });
  const { THREE, scene } = host;

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

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 2.1),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  screen.position.set(0, 0.9, -0.2);
  scene.add(screen);

  // Opaque barrier: three full-height panels → exactly two slits at ±d/2 (width a).
  // Visual x = physics × VIS_SCALE so openings track the same d,a as the intensity law.
  const VIS_SCALE = 0.55;
  const WALL_HALF = 2.6;
  const WALL_H = 1.85;
  const WALL_Z = 1.6;
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
  gun.position.set(0, SLIT_Y, 3.2);
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
  }
  ui.querySelector("#clear").addEventListener("click", clear);

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
  const Z_GUN = 3.0;
  const Z_SLIT = WALL_Z;
  const Z_SCREEN = -0.05;
  function spawnFlyer(targetX) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: whichPath ? 0xfb923c : 0x7dd3fc })
    );
    m.position.set(0, SLIT_Y, Z_GUN);
    scene.add(m);
    const slitX = Math.random() < 0.5 ? slitLeftX : slitRightX;
    // Jitter within slit width so paths fill the opening
    const halfA = (params.a * VIS_SCALE) / 2;
    const slitJitter = (Math.random() - 0.5) * halfA * 0.7;
    flyers.push({
      mesh: m,
      t: 0,
      targetX,
      slitX: slitX + slitJitter,
      y: SLIT_Y + (Math.random() - 0.5) * 0.35,
    });
  }

  host.setTick((t) => {
    const dt = 1 / 60;
    accum += rate * dt;
    while (accum >= 1) {
      accum -= 1;
      if (!sampler) rebuild();
      const x = sampleHit(sampler);
      spawnFlyer(x);
    }
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t += dt * 1.8;
      const u = Math.min(1, f.t);
      let x, z;
      if (u < 0.42) {
        const s = u / 0.42;
        x = f.slitX * s;
        z = Z_GUN + (Z_SLIT - Z_GUN) * s;
      } else {
        const s = (u - 0.42) / 0.58;
        x = f.slitX + (f.targetX * 0.55 - f.slitX) * s;
        z = Z_SLIT + (Z_SCREEN - Z_SLIT) * s;
      }
      f.mesh.position.set(x, f.y, z);
      if (f.t >= 1) {
        paintHit(f.targetX);
        scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        flyers.splice(i, 1);
        if (hits % 25 === 0) updateScore();
      }
    }
  });

  rebuild();
  return () => {
    flyers.forEach((f) => {
      scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
    });
    host.dispose();
    ui.remove();
  };
}
