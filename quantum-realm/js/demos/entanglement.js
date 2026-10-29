import { createSceneHost, el, bindRange } from "../scene.js";
import {
  quantumCorrelation,
  quantumChsh,
  classicalCorrelation,
  measureSinglet,
  tsirelsonBound,
} from "../physics/bell.js";

export const meta = {
  id: "entanglement",
  title: "Entanglement & Bell Test",
  subtitle: "Correlations beyond local hidden variables",
  blurb: "Choose detector angles for an entangled pair and compare quantum vs classical correlations.",
  icon: "∞",
};

export function mount(root) {
  const ui = el(`
    <div class="demo-layout">
      <aside class="demo-panel">
        <p class="demo-kicker">Key idea</p>
        <p class="demo-key">Entangled particles show correlations no local hidden-variable story can fully match — yet this never sends a usable signal faster than light.</p>
        <p class="demo-intro">Each run prepares a spin singlet. You pick analyzer angles for A and B. Quantum mechanics predicts E(a,b) = −cos(a−b). CHSH combines four angle pairs; quantum theory can reach 2√2 ≈ 2.828 while local realism stays ≤ 2.</p>
        <div class="control-grid">
          <label>Angle a <span data-v="a"></span>°
            <input type="range" id="a" min="0" max="180" step="1" value="0" />
          </label>
          <label>Angle a′ <span data-v="ap"></span>°
            <input type="range" id="ap" min="0" max="180" step="1" value="90" />
          </label>
          <label>Angle b <span data-v="b"></span>°
            <input type="range" id="b" min="0" max="180" step="1" value="45" />
          </label>
          <label>Angle b′ <span data-v="bp"></span>°
            <input type="range" id="bp" min="0" max="180" step="1" value="135" />
          </label>
          <label class="check"><input type="checkbox" id="lhv" /> Compare local hidden-variable model</label>
          <button type="button" class="btn-primary" id="run">Run 2000 trials (current a,b)</button>
          <button type="button" class="btn-ghost" id="chsh">Compute CHSH (quantum)</button>
        </div>
        <div class="stats">
          <p>⟨AB⟩ empirical = <strong id="emp">—</strong></p>
          <p>Quantum −cos(a−b) = <strong id="q">—</strong></p>
          <p>Classical model ≈ <strong id="c">—</strong></p>
          <p>CHSH S = <strong id="S">—</strong> <span class="hint">(quantum ≤ 2√2, classical ≤ 2)</span></p>
        </div>
        <div class="challenge">
          <strong>Try this</strong>
          <p>Use a=0°, a′=90°, b=45°, b′=135° and push |S| above 2 (Bell violation) toward ≈ 2.828.</p>
          <p class="score" id="score">—</p>
        </div>
        <details class="math">
          <summary>The math</summary>
          <p class="eq">E(a,b) = −cos(a − b) (singlet)</p>
          <p class="eq">S = E(a,b)+E(a,b′)+E(a′,b)−E(a′,b′) ≤ 2√2</p>
          <p>Choosing settings after a pair is “created” still cannot transmit information FTL — each local outcome looks random until compared.</p>
        </details>
      </aside>
      <div class="demo-stage" id="stage"></div>
    </div>
  `);
  root.appendChild(ui);
  const host = createSceneHost(ui.querySelector("#stage"), {
    camY: 1.4, camZ: 5, targetY: 0.4,
  });
  const { THREE, scene } = host;

  // Two detector discs
  function makeDetector(x, color) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.08, 48),
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.45 })
    );
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    needle.position.y = 0.25;
    g.add(needle);
    g.position.set(x, 0.5, 0);
    scene.add(g);
    return { group: g, needle };
  }
  const detA = makeDetector(-1.6, 0x38bdf8);
  const detB = makeDetector(1.6, 0xfb923c);

  function detLabel(text, x, color) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "bold 44px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(0.5, 0.25, 1);
    spr.position.set(x, 1.25, 0);
    scene.add(spr);
  }
  detLabel("A", -1.6, "#38bdf8");
  detLabel("B", 1.6, "#fb923c");

  // Pair source
  const src = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x4c1d95 })
  );
  src.position.set(0, 0.5, 0);
  scene.add(src);

  const deg = (id) => (parseFloat(ui.querySelector(id).value) * Math.PI) / 180;
  const degVal = (id) => parseFloat(ui.querySelector(id).value);

  function syncNeedles() {
    detA.needle.rotation.z = -deg("#a");
    detB.needle.rotation.z = -deg("#b");
    ["a", "ap", "b", "bp"].forEach((k) => {
      ui.querySelector(`[data-v="${k}"]`).textContent = String(degVal("#" + k));
    });
    const q = quantumCorrelation(deg("#a"), deg("#b"));
    ui.querySelector("#q").textContent = q.toFixed(3);
    if (ui.querySelector("#lhv").checked) {
      ui.querySelector("#c").textContent = classicalCorrelation(
        deg("#a"), deg("#b"), 8000
      ).toFixed(3);
    } else {
      ui.querySelector("#c").textContent = "—";
    }
  }

  ["#a", "#ap", "#b", "#bp"].forEach((id) => {
    ui.querySelector(id).addEventListener("input", syncNeedles);
  });
  ui.querySelector("#lhv").addEventListener("change", syncNeedles);

  ui.querySelector("#run").onclick = () => {
    const a = deg("#a");
    const b = deg("#b");
    let sum = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) sum += measureSinglet(a, b).product;
    const emp = sum / N;
    ui.querySelector("#emp").textContent = emp.toFixed(3);
    syncNeedles();
  };

  ui.querySelector("#chsh").onclick = () => {
    const a = deg("#a");
    const ap = deg("#ap");
    const b = deg("#b");
    const bp = deg("#bp");
    const Sraw = quantumChsh(a, ap, b, bp);
    const S = Math.abs(Sraw);
    ui.querySelector("#S").textContent = `${S.toFixed(3)} (raw ${Sraw.toFixed(3)})`;
    const bound = tsirelsonBound();
    ui.querySelector("#score").textContent =
      S > 2
        ? `Bell violation! |S| = ${S.toFixed(3)} > 2 (Tsirelson ${bound.toFixed(3)})`
        : `|S| = ${S.toFixed(3)} ≤ 2 — try 0° / 90° / 45° / 135°`;
  };

  // Soft pulse animation
  let t0 = 0;
  host.setTick((t) => {
    t0 = t * 0.001;
    src.scale.setScalar(1 + 0.06 * Math.sin(t0 * 3));
  });

  syncNeedles();
  return () => {
    host.dispose();
    ui.remove();
  };
}
