/**
 * The Quantum Realm — hub router with lazy-loaded demos.
 */
import { prefersReducedMotion } from "./scene.js";

const SUBJECTS = [
  {
    id: "double-slit",
    title: "Wave–Particle Duality",
    subtitle: "Double-slit",
    blurb: "Fire particles one-by-one and grow an interference pattern — or erase it with a which-path detector.",
    module: () => import("./demos/doubleslit.js"),
    accent: "#38bdf8",
  },
  {
    id: "superposition",
    title: "Superposition & Measurement",
    subtitle: "Bloch sphere",
    blurb: "Rotate a qubit, collapse it on measurement, and match Born-rule statistics.",
    module: () => import("./demos/bloch.js"),
    accent: "#a78bfa",
  },
  {
    id: "tunneling",
    title: "Quantum Tunneling",
    subtitle: "Barrier penetration",
    blurb: "Send a wave packet at a barrier and tune the exact transmission probability.",
    module: () => import("./demos/tunneling.js"),
    accent: "#fb923c",
  },
  {
    id: "uncertainty",
    title: "Heisenberg Uncertainty",
    subtitle: "Fourier spreads",
    blurb: "Squeeze in position and watch momentum widen — product locked at ħ/2.",
    module: () => import("./demos/uncertainty.js"),
    accent: "#34d399",
  },
  {
    id: "orbitals",
    title: "Atomic Orbitals",
    subtitle: "Hydrogen clouds",
    blurb: "Explore real |ψ|² clouds, quantized energies, and Balmer emission colors.",
    module: () => import("./demos/orbitals.js"),
    accent: "#f472b6",
  },
  {
    id: "entanglement",
    title: "Entanglement & Bell Test",
    subtitle: "CHSH correlations",
    blurb: "Measure an entangled pair and push CHSH past the classical limit of 2.",
    module: () => import("./demos/entanglement.js"),
    accent: "#fbbf24",
  },
  {
    id: "particle-in-a-box",
    title: "Particle in a Box",
    subtitle: "Standing waves",
    blurb: "Fit sine waves in a well — energies rise as n² with n−1 nodes.",
    module: () => import("./demos/particlebox.js"),
    accent: "#2dd4bf",
  },
];

const hub = document.getElementById("hub");
const demoRoot = document.getElementById("demo-root");
const demoChrome = document.getElementById("demo-chrome");
const demoTitle = document.getElementById("demo-title");
const backBtn = document.getElementById("back-btn");

let unmount = null;
let activeId = null;

function cardHTML(s) {
  return `
    <button type="button" class="subject-card" data-id="${s.id}" style="--accent:${s.accent}">
      <span class="card-glow" aria-hidden="true"></span>
      <span class="card-subtitle">${s.subtitle}</span>
      <span class="card-title">${s.title}</span>
      <span class="card-blurb">${s.blurb}</span>
      <span class="card-cta">Open lab →</span>
    </button>`;
}

function renderHub() {
  hub.innerHTML = `
    <header class="qr-hero">
      <p class="eyebrow">Interactive physics</p>
      <h1>The Quantum Realm</h1>
      <p class="tagline">Seven mini labs where the math of quantum mechanics becomes something you can poke, tune, and score.</p>
      ${prefersReducedMotion() ? "" : '<p class="hint-line">Tip: drag to orbit · scroll to zoom · demos pause when this tab is hidden.</p>'}
    </header>
    <div class="subject-grid" role="list">
      ${SUBJECTS.map(cardHTML).join("")}
    </div>
    <p class="footnote">Language note: “measurement” means a physical interaction that records an outcome — not consciousness. Entanglement does not send signals faster than light.</p>
  `;
  hub.hidden = false;
  demoChrome.hidden = true;
  demoRoot.hidden = true;
  hub.querySelectorAll(".subject-card").forEach((btn) => {
    btn.addEventListener("click", () => openSubject(btn.dataset.id));
  });
}

async function openSubject(id) {
  const subject = SUBJECTS.find((s) => s.id === id);
  if (!subject) {
    location.hash = "";
    return;
  }
  if (unmount) {
    unmount();
    unmount = null;
  }
  activeId = id;
  location.hash = id;
  hub.hidden = true;
  demoChrome.hidden = false;
  demoRoot.hidden = false;
  demoRoot.innerHTML = `<div class="demo-loading">Loading ${subject.title}…</div>`;
  demoTitle.textContent = subject.title;
  try {
    const mod = await subject.module();
    demoRoot.innerHTML = "";
    unmount = mod.mount(demoRoot);
  } catch (err) {
    console.error(err);
    demoRoot.innerHTML = `<p class="demo-error">Could not load this lab. Check the console for details.</p>`;
  }
}

function closeSubject() {
  if (unmount) {
    unmount();
    unmount = null;
  }
  activeId = null;
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  demoRoot.innerHTML = "";
  renderHub();
}

backBtn.addEventListener("click", closeSubject);

function routeFromHash() {
  const id = location.hash.replace(/^#/, "");
  if (id && SUBJECTS.some((s) => s.id === id)) openSubject(id);
  else {
    if (unmount) {
      unmount();
      unmount = null;
    }
    renderHub();
  }
}

window.addEventListener("hashchange", routeFromHash);
routeFromHash();
