import { createSceneHost, el } from "../scene.js";
import {
  energyEv,
  sampleOrbital,
  absorptionEnergyEv,
  emissionEnergyEv,
  balmerWavelengthNm,
  wavelengthToRGB,
} from "../physics/hydrogen.js";

export const meta = {
  id: "orbitals",
  title: "Atomic Orbitals",
  subtitle: "Hydrogen probability clouds",
  blurb: "Explore real hydrogen wavefunctions and match photon energies to jumps between levels.",
  icon: "⚛",
};

const ORBITALS = [
  { n: 1, l: 0, m: 0, name: "1s" },
  { n: 2, l: 0, m: 0, name: "2s" },
  { n: 2, l: 1, m: 0, name: "2p₀" },
  { n: 2, l: 1, m: 1, name: "2p±₁" },
  { n: 3, l: 0, m: 0, name: "3s" },
  { n: 3, l: 1, m: 0, name: "3p₀" },
  { n: 3, l: 2, m: 0, name: "3d₀" },
  { n: 3, l: 2, m: 2, name: "3d±₂" },
];

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">Electrons in atoms don’t follow tiny planetary orbits — the cloud is a probability map from a quantized wavefunction.</p>
        <p class="demo-intro">Points are sampled from |ψ<sub>nlm</sub>|² for hydrogen. Energy depends only on n: E<sub>n</sub> = −13.6 eV / n². Fire a photon with the right energy to climb a level; emission can show Balmer colors.</p>
        <div class="control-grid">
          <label>Orbital
            <select id="orb"></select>
          </label>
          <label>Current level n = <strong id="ncur">1</strong></label>
          <label>Photon energy (eV) <span data-v="ph"></span>
            <input type="range" id="ph" min="0.3" max="13" step="0.01" value="10.2" />
          </label>
          <button type="button" class="btn-primary" id="absorb">Absorb photon</button>
          <button type="button" class="btn-ghost" id="emit">Emit toward n=2 (Balmer)</button>
        </div>
        <div class="stats">
          <p>E<sub>n</sub> = <strong id="En">—</strong> eV</p>
          <p id="msg" class="msg">—</p>
          <div id="line" class="spectral-line" hidden></div>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>From n=1, absorb ≈ 10.2 eV to reach n=2, then emit to see H-α (≈ 656 nm, red).</p>
          <p class="score" id="score">—</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p class="eq">E<sub>n</sub> = −13.6057 eV / n²</p>
          <p>ψ<sub>nlm</sub>(r,θ,φ) = R<sub>nl</sub>(r) Y<sub>lm</sub>(θ,φ). Orbitals are standing probability waves, not classical trajectories.</p>
        </details>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const sel = ui.querySelector("#orb");
  ORBITALS.forEach((o, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = o.name;
    sel.appendChild(opt);
  });

  const host = createSceneHost(ui.querySelector("#stage"), {
    camY: 2, camZ: 8, targetY: 0, fov: 42,
  });
  const { THREE, scene } = host;

  let pointsObj = null;
  let nLevel = 1;
  let achieved = { absorb: false, balmer: false };

  function colorForNL(n, l) {
    const hues = [0x38bdf8, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185];
    return hues[(n + l) % hues.length];
  }

  function rebuildCloud() {
    const o = ORBITALS[parseInt(sel.value, 10)];
    const count = host.reduced ? 1200 : 3500;
    const pts = sampleOrbital(o.n, o.l, o.m, count);
    const positions = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      // scale a0 units for view
      const s = 0.55;
      positions[i * 3] = pts[i].x * s;
      positions[i * 3 + 1] = pts[i].z * s;
      positions[i * 3 + 2] = pts[i].y * s;
    }
    if (pointsObj) {
      scene.remove(pointsObj);
      pointsObj.geometry.dispose();
      pointsObj.material.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colorForNL(o.n, o.l),
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    pointsObj = new THREE.Points(geo, mat);
    scene.add(pointsObj);
    nLevel = o.n;
    ui.querySelector("#ncur").textContent = String(nLevel);
    ui.querySelector("#En").textContent = energyEv(nLevel).toFixed(3);
  }

  sel.addEventListener("change", rebuildCloud);
  const ph = ui.querySelector("#ph");
  ph.addEventListener("input", () => {
    ui.querySelector('[data-v="ph"]').textContent = parseFloat(ph.value).toFixed(2);
  });
  ph.dispatchEvent(new Event("input"));

  ui.querySelector("#absorb").onclick = () => {
    const E = parseFloat(ph.value);
    // Find nearest higher n
    let best = null;
    let bestErr = Infinity;
    for (let nf = nLevel + 1; nf <= 6; nf++) {
      const need = absorptionEnergyEv(nLevel, nf);
      const err = Math.abs(need - E);
      if (err < bestErr) {
        bestErr = err;
        best = { nf, need };
      }
    }
    if (best && bestErr < 0.15) {
      nLevel = best.nf;
      ui.querySelector("#msg").textContent = `Absorbed — now n = ${nLevel} (need ${best.need.toFixed(2)} eV)`;
      ui.querySelector("#ncur").textContent = String(nLevel);
      ui.querySelector("#En").textContent = energyEv(nLevel).toFixed(3);
      // snap select to matching n if possible
      const idx = ORBITALS.findIndex((o) => o.n === nLevel);
      if (idx >= 0) {
        sel.value = String(idx);
        rebuildCloud();
      }
      if (nLevel === 2) achieved.absorb = true;
    } else {
      ui.querySelector("#msg").textContent = best
        ? `No match — closest jump needs ${best.need.toFixed(2)} eV (Δ=${bestErr.toFixed(2)})`
        : "Already at a high level";
    }
    updateScore();
  };

  ui.querySelector("#emit").onclick = () => {
    if (nLevel <= 2) {
      ui.querySelector("#msg").textContent = "Need n > 2 to emit a Balmer photon to n = 2";
      return;
    }
    const nFrom = nLevel;
    const nm = balmerWavelengthNm(nFrom);
    const rgb = wavelengthToRGB(nm);
    const eV = emissionEnergyEv(nFrom, 2);
    nLevel = 2;
    ui.querySelector("#ncur").textContent = "2";
    ui.querySelector("#En").textContent = energyEv(2).toFixed(3);
    ui.querySelector("#msg").textContent = `Emitted ${nm.toFixed(1)} nm (${eV.toFixed(2)} eV) · n=${nFrom}→2`;
    const line = ui.querySelector("#line");
    line.hidden = false;
    line.style.background = `rgb(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)})`;
    line.textContent = `H (n=${nFrom}→2) · ${nm.toFixed(0)} nm`;
    const idx = ORBITALS.findIndex((o) => o.n === 2 && o.l === 0);
    if (idx >= 0) {
      sel.value = String(idx);
      rebuildCloud();
    }
    if (nFrom === 3) achieved.balmer = true;
    updateScore();
  };

  function updateScore() {
    ui.querySelector("#score").textContent =
      achieved.absorb && achieved.balmer
        ? "Challenge complete: 1→2 absorption and Balmer emission"
        : `Progress — absorb to n=2: ${achieved.absorb ? "✓" : "…"} · H-α path: ${achieved.balmer ? "✓" : "…"}`;
  }

  rebuildCloud();
  updateScore();

  return () => {
    host.dispose();
    ui.remove();
  };
}
