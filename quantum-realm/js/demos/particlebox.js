import { createSceneHost, el, bindRange } from "../scene.js";
import {
  wavefunction,
  probabilityDensity,
  energyRatio,
  normCheck,
} from "../physics/particlebox.js";

export const meta = {
  id: "particle-in-a-box",
  title: "Particle in a Box",
  subtitle: "Standing waves & quantized energy",
  blurb: "Watch allowed wavefunctions in an infinite well — energies climb as n².",
  icon: "▦",
};

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">Confine a particle and only certain standing waves fit — so energy comes in discrete steps proportional to n².</p>
        <p class="demo-intro">Blue surface: ψ<sub>n</sub>(x). Orange bars: |ψ|². Walls are infinite (ψ = 0 at the edges). Toggle n and compare shapes and energies.</p>
        <div class="control-grid">
          <label>Quantum number n <span data-v="n"></span>
            <input type="range" id="n" min="1" max="6" step="1" value="1" />
          </label>
          <label class="check"><input type="checkbox" id="showP" checked /> Show |ψ|²</label>
          <label class="check"><input type="checkbox" id="animate" checked /> Phase animation</label>
        </div>
        <div class="stats">
          <p>E<sub>n</sub> / E<sub>1</sub> = <strong id="Er">1</strong></p>
          <p>Nodes (zeros inside): <strong id="nodes">0</strong></p>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>Find n where energy is 9× the ground state, and count the nodes (should be n−1).</p>
          <p class="score" id="score">—</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p class="eq">ψ<sub>n</sub>(x) = √(2/L) sin(nπx/L), E<sub>n</sub> = n² π² ℏ² / (2mL²)</p>
          <p>Probability density |ψ|² is what detectors register; ψ itself can be negative (phase) without being “negative probability.”</p>
        </details>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const host = createSceneHost(ui.querySelector("#stage"), {
    camY: 2.2, camZ: 4.5, targetY: 0.6,
  });
  const { THREE, scene } = host;

  const L = 1;
  const segs = 80;
  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.2 });
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.6), wallMat);
  const wallR = wallL.clone();
  wallL.position.set(-1.05, 1.0, 0);
  wallR.position.set(1.05, 1.0, 0);
  scene.add(wallL, wallR);

  const curvePts = [];
  for (let i = 0; i <= segs; i++) curvePts.push(new THREE.Vector3(0, 0, 0));
  const psiGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
  const psiLine = new THREE.Line(
    psiGeom,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
  );
  scene.add(psiLine);

  const bars = [];
  for (let i = 0; i < segs; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(2 / segs * 0.85, 1, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xfb923c, transparent: true, opacity: 0.85 })
    );
    scene.add(m);
    bars.push(m);
  }

  let n = 1;
  let phase = 0;
  let showP = true;
  let animate = !host.reduced;

  function redraw() {
    ui.querySelector('[data-v="n"]').textContent = String(n);
    ui.querySelector("#Er").textContent = String(energyRatio(n));
    ui.querySelector("#nodes").textContent = String(n - 1);
    ui.querySelector("#score").textContent =
      n === 3
        ? "Correct — n=3 has E/E₁ = 9 and 2 nodes"
        : `n=${n}: E/E₁=${energyRatio(n)}, nodes=${n - 1}`;

    const positions = psiGeom.attributes.position.array;
    let maxP = 0;
    const dens = [];
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs) * L;
      const psi = wavefunction(n, x, L) * Math.cos(phase);
      const X = -1 + 2 * (i / segs);
      positions[i * 3] = X;
      positions[i * 3 + 1] = 1.0 + psi * 0.9;
      positions[i * 3 + 2] = 0;
      if (i < segs) {
        const xd = ((i + 0.5) / segs) * L;
        const p = probabilityDensity(n, xd, L);
        dens.push(p);
        maxP = Math.max(maxP, p);
      }
    }
    psiGeom.attributes.position.needsUpdate = true;
    for (let i = 0; i < segs; i++) {
      const X = -1 + 2 * ((i + 0.5) / segs);
      const h = showP ? (dens[i] / maxP) * 1.4 : 0.001;
      bars[i].visible = showP;
      bars[i].scale.y = Math.max(0.02, h);
      bars[i].position.set(X, 0.15 + bars[i].scale.y / 2, 0.35);
    }
  }

  bindRange(ui.querySelector("#n"), (v) => {
    n = Math.round(v);
    redraw();
  });
  ui.querySelector("#showP").onchange = (e) => {
    showP = e.target.checked;
    redraw();
  };
  ui.querySelector("#animate").onchange = (e) => {
    animate = e.target.checked && !host.reduced;
  };
  if (host.reduced) ui.querySelector("#animate").checked = false;

  host.setTick(() => {
    if (animate) {
      phase += 0.04;
      redraw();
    }
  });
  redraw();

  return () => {
    host.dispose();
    ui.remove();
  };
}
