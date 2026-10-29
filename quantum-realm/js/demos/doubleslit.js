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
  const host = createSceneHost(stage, { camX: 1.8, camY: 1.4, camZ: 4.2, targetY: 0.7, targetZ: 0.6, fov: 48 });
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

  // Slit wall with two openings
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3358, metalness: 0.2, roughness: 0.7 });
  const wallGroup = new THREE.Group();
  wallGroup.position.set(0, 0.7, 1.6);
  const panels = [
    [-1.2, 0, 0.7, 1.8], [1.2, 0, 0.7, 1.8], // left/right
    [0, 0.75, 1.7, 0.3], [0, -0.75, 1.7, 0.3], // top/bottom
    [-0.35, 0, 0.25, 1.2], [0.35, 0, 0.25, 1.2], // center divider between slits
  ];
  for (const [x, y, w, h] of panels) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wallMat);
    mesh.position.set(x, y, 0);
    wallGroup.add(mesh);
  }
  scene.add(wallGroup);

  const gun = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b })
  );
  gun.rotation.x = Math.PI / 2;
  gun.position.set(0, 0.7, 3.2);
  scene.add(gun);

  let hits = 0;
  let params = { d: 2.8, a: 0.45, wavelength: 0.8, L: 8 };
  let whichPath = false;
  let sampler = null;
  let xmax = 3.5;
  let rate = 12;
  let accum = 0;
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

  // Flying particle sprites
  const flyers = [];
  function spawnFlyer(targetX) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: whichPath ? 0xfb923c : 0x7dd3fc })
    );
    m.position.set(0, 0.7, 3.0);
    scene.add(m);
    flyers.push({ mesh: m, t: 0, targetX, y: 0.4 + Math.random() * 1.0 });
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
      const z = 3.0 - f.t * 3.4;
      const x = f.targetX * (f.t * 0.55);
      f.mesh.position.set(x * 0.55, f.y, z);
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
