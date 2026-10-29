import { createSceneHost, el, bindRange } from "../scene.js";
import {
  transmissionCoefficient,
  makeBarrierPotential,
  gaussianPacket,
  probabilityDensity,
  transmittedFraction,
  splitStepStep,
} from "../physics/tunneling.js";

export const meta = {
  id: "tunneling",
  title: "Quantum Tunneling",
  subtitle: "Wave packet meets a barrier",
  blurb: "Dial barrier height and width — some probability leaks through even when the particle “shouldn’t.”",
  icon: "↯",
};

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">A quantum particle can appear on the far side of a barrier even when its energy is below the barrier height — with a precise transmission probability.</p>
        <p class="demo-intro">The glowing sheet is |ψ|² for a wave packet. The orange block is a rectangular potential. Theory T uses the exact rectangular-barrier formula; the animation is a split-step Schrödinger evolution (ℏ = m = 1 units).</p>
        <div class="control-grid">
          <label>Particle energy E <span data-v="E"></span>
            <input type="range" id="E" min="0.5" max="8" step="0.1" value="2.5" />
          </label>
          <label>Barrier height V₀ <span data-v="V"></span>
            <input type="range" id="V" min="1" max="12" step="0.1" value="5" />
          </label>
          <label>Barrier width L <span data-v="L"></span>
            <input type="range" id="L" min="0.4" max="3" step="0.05" value="1.2" />
          </label>
          <button type="button" class="btn-primary" id="run">Launch packet</button>
        </div>
        <div class="stats">
          <p>Exact T(E) = <strong id="T">—</strong></p>
          <p>Simulated transmission ≈ <strong id="Tsim">—</strong></p>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>Hit a target transmission of 10–20% by tuning E, V₀, and L while E &lt; V₀ (true tunneling).</p>
          <p class="score" id="score">Target 10–20%: —</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p>For E &lt; V₀, width L (ℏ, m as set):</p>
          <p class="eq">T = [1 + V₀² sinh²(κL) / (4E(V₀−E))]⁻¹, κ = √(2m(V₀−E))/ℏ</p>
          <p>Tunneling is not a classical “borrow energy” trick — the wavefunction is nonzero inside the forbidden region.</p>
        </details>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const host = createSceneHost(ui.querySelector("#stage"), {
    camX: 0, camY: 3.5, camZ: 9, targetY: 0.5, fov: 40,
  });
  const { THREE, scene } = host;

  const N = 96; // modest for O(N²) DFT
  const xMin = -12;
  const xMax = 12;
  let E = 2.5, V0 = 5, Lw = 1.2;
  let pot = makeBarrierPotential(N, xMin, xMax, V0, Lw, 0);
  let packet = null;
  let running = false;
  let stepsLeft = 0;

  // Barrier mesh
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xfb923c, transparent: true, opacity: 0.55 })
  );
  scene.add(barrier);

  // |ψ|² as a ribbon of bars
  const bars = [];
  const barGeom = new THREE.BoxGeometry(pot.dx * 0.85, 1, 0.25);
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(
      barGeom,
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 })
    );
    const x = xMin + (i + 0.5) * pot.dx;
    m.position.set(x * 0.35, 0.05, 0);
    scene.add(m);
    bars.push(m);
  }

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  function updateLabels() {
    ui.querySelector('[data-v="E"]').textContent = E.toFixed(2);
    ui.querySelector('[data-v="V"]').textContent = V0.toFixed(2);
    ui.querySelector('[data-v="L"]').textContent = Lw.toFixed(2);
    const T = transmissionCoefficient(E, V0, Lw);
    ui.querySelector("#T").textContent = T.toFixed(4);
    const ok = E < V0 && T >= 0.1 && T <= 0.2;
    ui.querySelector("#score").textContent = ok
      ? `Success — T = ${(T * 100).toFixed(1)}% in the tunnel window`
      : E >= V0
        ? "Tip: set E below V₀ for tunneling (not just over-barrier)"
        : `T = ${(T * 100).toFixed(2)}% — aim for 10–20%`;
    barrier.scale.set(Lw * 0.35, Math.max(0.3, V0 * 0.25), 1);
    barrier.position.set(0, barrier.scale.y / 2, 0);
  }

  function launch() {
    pot = makeBarrierPotential(N, xMin, xMax, V0, Lw, 0);
    const k0 = Math.sqrt(2 * E); // p = ħk, ħ=m=1, E=k²/2
    packet = gaussianPacket(N, xMin, pot.dx, -6, k0, 1.0);
    running = true;
    stepsLeft = host.reduced ? 40 : 180;
    ui.querySelector("#Tsim").textContent = "…";
  }

  bindRange(ui.querySelector("#E"), (v) => { E = v; updateLabels(); });
  bindRange(ui.querySelector("#V"), (v) => { V0 = v; updateLabels(); });
  bindRange(ui.querySelector("#L"), (v) => { Lw = v; updateLabels(); });
  ui.querySelector("#run").onclick = launch;

  function paint() {
    if (!packet) return;
    const p = probabilityDensity(packet.re, packet.im);
    let max = 0;
    for (let i = 0; i < N; i++) max = Math.max(max, p[i]);
    max = Math.max(max, 1e-9);
    for (let i = 0; i < N; i++) {
      const h = (p[i] / max) * 2.8;
      bars[i].scale.y = Math.max(0.02, h);
      bars[i].position.y = bars[i].scale.y / 2;
      const cool = p[i] / max;
      bars[i].material.color.setRGB(0.15 + 0.2 * cool, 0.55 + 0.3 * cool, 0.95);
    }
  }

  host.setTick(() => {
    if (!running || !packet) return;
    const dt = 0.02;
    // several substeps
    const nSub = host.reduced ? 2 : 3;
    for (let s = 0; s < nSub; s++) splitStepStep(packet.re, packet.im, pot.V, pot.dx, dt);
    stepsLeft--;
    paint();
    if (stepsLeft <= 0) {
      running = false;
      const frac = transmittedFraction(
        packet.re, packet.im, pot.dx, xMin, Lw / 2 + 0.05
      );
      ui.querySelector("#Tsim").textContent = frac.toFixed(3);
    }
  });

  updateLabels();
  // idle packet preview
  packet = gaussianPacket(N, xMin, pot.dx, -6, Math.sqrt(2 * E), 1.0);
  paint();

  return () => {
    host.dispose();
    ui.remove();
  };
}
