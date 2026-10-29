import { createSceneHost, el, bindRange } from "../scene.js";
import {
  stateFromAngles,
  bornProb0,
  measureZ,
  gateX,
  gateH,
  gateZ,
  blochVector,
} from "../physics/born.js";

export const meta = {
  id: "superposition",
  title: "Superposition & Measurement",
  subtitle: "Qubit on the Bloch sphere",
  blurb: "Rotate a qubit, measure it many times, and watch Born-rule statistics emerge.",
  icon: "◉",
};

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">A qubit can be a blend of 0 and 1 — but one measurement gives only one definite answer, with probabilities set by the state’s angles.</p>
        <p class="demo-intro">The arrow is the Bloch vector for a single qubit. Gates rotate it. Measuring along z collapses it to a pole; repeating from the same prepared state builds the histogram predicted by the Born rule.</p>
        <div class="control-grid">
          <label>θ (polar) <span data-v="th"></span>
            <input type="range" id="th" min="0" max="3.1416" step="0.01" value="1.047" />
          </label>
          <label>φ (azimuth) <span data-v="ph"></span>
            <input type="range" id="ph" min="0" max="6.2832" step="0.01" value="0" />
          </label>
          <div class="btn-row">
            <button type="button" id="gx" class="btn-mini">X</button>
            <button type="button" id="gz" class="btn-mini">Z</button>
            <button type="button" id="gh" class="btn-mini">H</button>
            <button type="button" id="reset" class="btn-mini">Reset |0⟩</button>
          </div>
          <button type="button" class="btn-primary" id="measure">Measure once</button>
          <button type="button" class="btn-ghost" id="burst">Measure ×100 (re-prepare)</button>
        </div>
        <div class="stats">
          <p>P(0) = <strong id="p0">—</strong> · P(1) = <strong id="p1">—</strong></p>
          <p>Counts — 0: <span id="c0">0</span> · 1: <span id="c1">0</span></p>
          <div class="bar"><i id="bar0"></i></div>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>Apply H to |0⟩, then measure ×100. You should see roughly 50/50. Set θ ≈ 2π/3 and check that the 0-fraction tracks cos²(θ/2).</p>
          <p class="score" id="score">Challenge: —</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p>|ψ⟩ = cos(θ/2)|0⟩ + e<sup>iφ</sup> sin(θ/2)|1⟩</p>
          <p class="eq">P(0) = cos²(θ/2), P(1) = sin²(θ/2)</p>
          <p>Measurement does not require a mind — it is an irreversible interaction that correlates the qubit with a macroscopic readout.</p>
        </details>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const host = createSceneHost(ui.querySelector("#stage"), {
    camY: 0.3, camZ: 3.2, targetY: 0, fov: 42,
  });
  const { THREE, scene } = host;

  // Bloch sphere
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.35,
      metalness: 0.1,
      roughness: 0.6,
    })
  );
  scene.add(sphere);
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, wireframe: true, transparent: true, opacity: 0.25 })
  ));

  // Axes
  const axisMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  function axis(from, to, c) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: c })));
  }
  axis([0, -1.15, 0], [0, 1.15, 0], 0xfbbf24); // z
  axis([-1.15, 0, 0], [1.15, 0, 0], 0x38bdf8); // x
  axis([0, 0, -1.15], [0, 0, 1.15], 0xa78bfa); // y

  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    1.0,
    0xfb923c,
    0.12,
    0.08
  );
  scene.add(arrow);

  let state = stateFromAngles(0, 0);
  let prepared = stateFromAngles(Math.PI / 3, 0);
  let c0 = 0, c1 = 0;

  function syncFromSliders() {
    const th = parseFloat(ui.querySelector("#th").value);
    const ph = parseFloat(ui.querySelector("#ph").value);
    prepared = stateFromAngles(th, ph);
    state = prepared;
    ui.querySelector('[data-v="th"]').textContent = th.toFixed(2);
    ui.querySelector('[data-v="ph"]').textContent = ph.toFixed(2);
    refresh();
  }

  function setSlidersFromState(s) {
    ui.querySelector("#th").value = String(s.theta);
    ui.querySelector("#ph").value = String(s.phi % (2 * Math.PI));
    prepared = s;
    state = s;
    refresh();
  }

  function refresh() {
    const v = blochVector(state);
    arrow.setDirection(new THREE.Vector3(v.x, v.z, v.y).normalize()); // map Bloch y→z visual depth
    // Use x,z,y so z is up on screen
    arrow.setDirection(new THREE.Vector3(v.x, v.z, -v.y).normalize());
    const p0 = bornProb0(prepared.theta);
    ui.querySelector("#p0").textContent = p0.toFixed(3);
    ui.querySelector("#p1").textContent = (1 - p0).toFixed(3);
    ui.querySelector("#c0").textContent = String(c0);
    ui.querySelector("#c1").textContent = String(c1);
    const tot = c0 + c1;
    const frac = tot ? c0 / tot : p0;
    ui.querySelector("#bar0").style.width = `${(frac * 100).toFixed(1)}%`;
    if (tot >= 80) {
      const err = Math.abs(c0 / tot - p0);
      ui.querySelector("#score").textContent =
        err < 0.08 ? `Nice — empirical P(0) within ${(err * 100).toFixed(1)}% of theory` : `Keep measuring — error ${(err * 100).toFixed(1)}%`;
    }
  }

  bindRange(ui.querySelector("#th"), syncFromSliders);
  bindRange(ui.querySelector("#ph"), syncFromSliders);
  ui.querySelector("#gx").onclick = () => setSlidersFromState(gateX(prepared));
  ui.querySelector("#gz").onclick = () => setSlidersFromState(gateZ(prepared));
  ui.querySelector("#gh").onclick = () => setSlidersFromState(gateH(prepared));
  ui.querySelector("#reset").onclick = () => {
    c0 = c1 = 0;
    setSlidersFromState(stateFromAngles(0, 0));
  };
  ui.querySelector("#measure").onclick = () => {
    const r = measureZ(prepared);
    if (r.bit === 0) c0++; else c1++;
    state = r.state;
    refresh();
    // snap arrow then allow user to re-prepare via sliders
  };
  ui.querySelector("#burst").onclick = () => {
    for (let i = 0; i < 100; i++) {
      const r = measureZ(prepared);
      if (r.bit === 0) c0++; else c1++;
    }
    state = prepared;
    refresh();
  };

  syncFromSliders();
  return () => {
    host.dispose();
    ui.remove();
  };
}
