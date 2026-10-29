import { createSceneHost, el, bindRange } from "../scene.js";
import {
  positionProbDensity,
  momentumProbDensity,
  deltaX,
  deltaP,
  uncertaintyProduct,
} from "../physics/uncertainty.js";

export const meta = {
  id: "uncertainty",
  title: "Heisenberg Uncertainty",
  subtitle: "Squeeze position, widen momentum",
  blurb: "A Gaussian wave packet can’t be sharp in both position and momentum.",
  icon: "≈",
};

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">The more tightly you localize a particle in space, the broader its momentum spread must be — a Fourier fact, not “clumsy measurement.”</p>
        <p class="demo-intro">Left: |ψ(x)|². Right: |φ(p)|². For a minimum-uncertainty Gaussian, Δx Δp = ħ/2.</p>
        <div class="control-grid">
          <label>Position width σₓ <span data-v="sx"></span>
            <input type="range" id="sx" min="0.25" max="2.5" step="0.05" value="1" />
          </label>
        </div>
        <div class="stats">
          <p>Δx = <strong id="dx">—</strong> · Δp = <strong id="dp">—</strong></p>
          <p>Δx Δp = <strong id="prod">—</strong> (minimum 0.5)</p>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>Squeeze σₓ below 0.4 and watch momentum spread. Then widen σₓ and see Δp shrink — product stays at ½.</p>
          <p class="score" id="score">—</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p class="eq">ψ(x) = (2πσₓ²)<sup>−1/4</sup> e<sup>−x²/(4σₓ²)</sup></p>
          <p>Δx = σₓ, Δp = 1/(2σₓ), Δx Δp = ½ (= ħ/2).</p>
          <p>The uncertainty principle limits simultaneous sharpness of conjugate observables; it is not about instruments bumping the particle.</p>
        </details>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const host = createSceneHost(ui.querySelector("#stage"), {
    camY: 2.8, camZ: 8, targetY: 0.8, orbit: true,
  });
  const { THREE, scene } = host;

  const nBars = 64;
  const posBars = [];
  const momBars = [];
  const geom = new THREE.BoxGeometry(0.12, 1, 0.12);
  for (let i = 0; i < nBars; i++) {
    const mp = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
    const mm = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0xfb923c }));
    scene.add(mp);
    scene.add(mm);
    posBars.push(mp);
    momBars.push(mm);
  }
  // Labels as simple markers
  const mkLabel = (text, x, y, z, color) => {
    // sprite-less: small sphere marker + user reads panel
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.08),
      new THREE.MeshBasicMaterial({ color })
    );
    s.position.set(x, y, z);
    scene.add(s);
  };
  mkLabel("x", -3.5, 0.1, 0, 0x38bdf8);
  mkLabel("p", 3.5, 0.1, 0, 0xfb923c);

  let sigma = 1;

  function redraw() {
    ui.querySelector('[data-v="sx"]').textContent = sigma.toFixed(2);
    const dx = deltaX(sigma);
    const dp = deltaP(sigma);
    const prod = uncertaintyProduct(sigma);
    ui.querySelector("#dx").textContent = dx.toFixed(3);
    ui.querySelector("#dp").textContent = dp.toFixed(3);
    ui.querySelector("#prod").textContent = prod.toFixed(3);
    ui.querySelector("#score").textContent =
      Math.abs(prod - 0.5) < 1e-9
        ? "Minimum-uncertainty packet: ΔxΔp = ħ/2 ✓"
        : "—";

    const xMax = 5;
    const pMax = 5;
    let maxP = 0;
    let maxM = 0;
    const pVals = [];
    const mVals = [];
    for (let i = 0; i < nBars; i++) {
      const x = -xMax + (2 * xMax * (i + 0.5)) / nBars;
      const p = -pMax + (2 * pMax * (i + 0.5)) / nBars;
      const pv = positionProbDensity(x, sigma);
      const mv = momentumProbDensity(p, sigma);
      pVals.push(pv);
      mVals.push(mv);
      maxP = Math.max(maxP, pv);
      maxM = Math.max(maxM, mv);
    }
    for (let i = 0; i < nBars; i++) {
      const x = -xMax + (2 * xMax * (i + 0.5)) / nBars;
      const p = -pMax + (2 * pMax * (i + 0.5)) / nBars;
      const hp = (pVals[i] / maxP) * 2.4;
      const hm = (mVals[i] / maxM) * 2.4;
      posBars[i].position.set(x * 0.55 - 0.2, hp / 2, 0);
      posBars[i].scale.y = Math.max(0.02, hp);
      momBars[i].position.set(p * 0.55 + 0.2, hm / 2, 1.2);
      momBars[i].scale.y = Math.max(0.02, hm);
    }
  }

  bindRange(ui.querySelector("#sx"), (v) => {
    sigma = v;
    redraw();
  });
  redraw();

  return () => {
    host.dispose();
    ui.remove();
  };
}
