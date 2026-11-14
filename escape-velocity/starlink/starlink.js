// Starlink Constellation — Escape Velocity
//
// Model notes (code only):
// - Time axis D is days relative to the data reference instant (newest GP epoch).
//   D controls which satellites exist, orbit raising after launch, and decay.
// - Orbital phase, RAAN precession (J2) and Earth rotation run on a separate
//   gentle clock (tau, 60x real time). At D = 0, tau = 0 the satellites are at
//   their catalogued positions and Earth is at the matching sidereal angle.
//   Running phase and precession on the date axis would strobe at playback speed.
// - Orbits are circular (Starlink eccentricity ~1e-4). Satellites with no current
//   elements use SATCAT inclination, a launch-group altitude and pseudo-random
//   RAAN/phase (see scripts/fetch_starlink.py).
// - After launch each batch sits in a short "train" along the insertion orbit
//   above the launch trail, then blends into its operational plane and altitude
//   over the orbit-raising period; decaying satellites lower and fade out.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const V = "sl1";
const RE = 6378.137;
const MU = 398600.4418;
const J2 = 1.08262668e-3;
const DAY = 86400;
const TAU_RATE = 60 / DAY; // visual clock: days of orbital motion per real second
const PLAY_SECONDS = 52;
const TRAIL_DAYS = 26;
const INSERT_ALT = 300;
const DEG = Math.PI / 180;
const SITES = [
  [28.5619, -80.5772],
  [28.6082, -80.6041],
  [34.6321, -120.6106],
  [25.997, -97.157],
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const el = (id) => document.getElementById(id);
const stage = el("sl-stage");
const canvas = el("sl-canvas");
const slider = el("sl-slider");
const playBtn = el("sl-play");
const out = {
  year: el("sl-year"),
  date: el("sl-date"),
  launched: el("sl-launched"),
  inorbit: el("sl-inorbit"),
  launches: el("sl-launches"),
  latest: el("sl-latest"),
  asof: el("sl-asof"),
};

const fmt = new Intl.NumberFormat("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => String(n).padStart(2, "0");

function gmst(ms) {
  const jd = ms / 86400000 + 2440587.5;
  const t = jd - 2451545.0;
  return (2 * Math.PI * (0.779057273264 + 1.00273781191135448 * t)) % (2 * Math.PI);
}

// lat/lon (deg) on unit sphere, Earth-fixed, in three.js axes (y = north)
function ecefDir(lat, lon, out3 = new THREE.Vector3()) {
  const p = lat * DEG, l = lon * DEG;
  return out3.set(Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l));
}

function upperBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= x) lo = m + 1; else hi = m;
  }
  return lo;
}

function lowerBoundSorted(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < x) lo = m + 1; else hi = m;
  }
  return lo;
}

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + " " + res.status);
  return res.json();
}

async function main() {
  const [data, coast] = await Promise.all([
    loadJSON("../data/starlink.json?v=" + V),
    loadJSON("../data/coastline.json?v=" + V),
  ]);
  el("sl-loading").hidden = true;

  const refMs = data.ref;
  const N = data.L.length;
  const NL = data.launches.length;

  // ---- per-launch arrays
  const lT = new Float64Array(NL); // days rel ref
  const lPad = new Uint8Array(NL);
  const lCount = new Uint16Array(NL);
  const lFirst = new Uint32Array(NL);
  for (let k = 0; k < NL; k++) {
    const L = data.launches[k];
    lT[k] = (L[1] * 1000 - refMs) / 86400000;
    lPad[k] = L[2];
    lCount[k] = L[3];
  }
  // satellites are sorted by launch; record first index
  for (let i = N - 1; i >= 0; i--) lFirst[data.L[i]] = i;

  // ---- per-satellite arrays
  const sTL = new Float64Array(N);
  const sTD = new Float64Array(N);
  const sInc = new Float64Array(N);
  const sCi = new Float64Array(N), sSi = new Float64Array(N);
  const sRf = new Float64Array(N);
  const sO0 = new Float64Array(N), sOd = new Float64Array(N);
  const sU0 = new Float64Array(N), sN = new Float64Array(N);
  const sR = new Float64Array(N);
  const sIdx = new Uint16Array(N);
  const incSum = new Float64Array(NL);
  for (let i = 0; i < N; i++) {
    const k = data.L[i];
    sTL[i] = lT[k] + 0.04; // deployment roughly an hour after liftoff
    sTD[i] = data.D[i] ? (data.D[i] * 1000 - refMs) / 86400000 : Infinity;
    const inc = (data.I[i] / 100) * DEG;
    sInc[i] = inc;
    sCi[i] = Math.cos(inc);
    sSi[i] = Math.sin(inc);
    incSum[k] += data.I[i] / 100;
    const a = RE + data.A[i];
    sRf[i] = a / RE;
    const n = Math.sqrt(MU / (a * a * a)) * DAY; // rad/day
    sN[i] = n;
    sOd[i] = -1.5 * n * J2 * (RE / a) ** 2 * Math.cos(inc);
    sO0[i] = (data.O[i] / 100) * DEG;
    sU0[i] = (data.U[i] / 100) * DEG;
    sR[i] = data.R[i];
    sIdx[i] = i - lFirst[k];
  }
  const lInc = new Float64Array(NL);
  for (let k = 0; k < NL; k++) lInc[k] = incSum[k] / lCount[k];

  // sorted arrays for counters
  const launchSorted = Float64Array.from(sTL).sort();
  const decaySorted = Float64Array.from(sTD.filter((x) => isFinite(x))).sort();
  const lTsorted = Float64Array.from(lT).sort();

  const D_MIN = Math.floor(lT[0]) - 4;
  const D_MAX = 0;

  // ---- three.js
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.6;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 10;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.22;
  controls.addEventListener("start", () => { controls.autoRotate = false; needsRender = true; });
  controls.addEventListener("change", () => { needsRender = true; });

  // Earth group rotates with sidereal angle
  const earth = new THREE.Group();
  scene.add(earth);

  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uLight: { value: new THREE.Vector3(0.4, 0.5, 1).normalize() } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV; uniform vec3 uLight;
      void main(){
        float d = max(dot(vN, normalize(vV + uLight*0.6)), 0.0);
        vec3 deep = vec3(0.02, 0.05, 0.14);
        vec3 lit = vec3(0.06, 0.16, 0.38);
        vec3 c = mix(deep, lit, pow(d, 1.6));
        float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
        c += vec3(0.12, 0.32, 0.65) * rim * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMat));

  // coastlines
  {
    const pts = [];
    const v = new THREE.Vector3();
    for (const line of coast) {
      for (let j = 0; j + 3 < line.length; j += 2) {
        ecefDir(line[j + 1], line[j], v).multiplyScalar(1.002);
        pts.push(v.x, v.y, v.z);
        ecefDir(line[j + 3], line[j + 2], v).multiplyScalar(1.002);
        pts.push(v.x, v.y, v.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    earth.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x4f86d9, transparent: true, opacity: 0.75 })));
  }

  // atmosphere halo
  {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(max(0.0, 0.72 - dot(-vN, vV)), 2.2); gl_FragColor = vec4(0.25,0.55,1.0, f*0.55); }`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), m));
  }

  // launch trails (Earth-fixed)
  const TRAIL_SEG = 28;
  const trailEnd = []; // per launch: Earth-fixed end point (unit dir * radius) and site dir
  const trailPos = new Float32Array(NL * TRAIL_SEG * 2 * 3);
  const trailAlpha = new Float32Array(NL * TRAIL_SEG * 2);
  {
    for (let k = 0; k < NL; k++) {
      const [lat, lon] = SITES[lPad[k]];
      const inc = lInc[k];
      const cl = Math.cos(lat * DEG);
      const s = Math.max(-1, Math.min(1, Math.cos(inc * DEG) / cl));
      let az;
      if (lPad[k] === 2) az = Math.PI - Math.asin(s); // Vandenberg: southbound
      else if (lPad[k] !== 3 && inc < 48) az = Math.PI - Math.asin(s); // Florida 43 deg: southeast
      else az = Math.asin(s); // northeast / east
      const pts = [];
      const p1 = lat * DEG, l1 = lon * DEG;
      const ARC = 24 * DEG;
      for (let j = 0; j <= TRAIL_SEG; j++) {
        const f = j / TRAIL_SEG;
        const d = ARC * f;
        const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(az));
        const l2 = l1 + Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
        const r = 1.003 + (INSERT_ALT / RE) * Math.pow(f, 0.55);
        pts.push(ecefDir(p2 / DEG, l2 / DEG).multiplyScalar(r));
      }
      trailEnd.push({ site: ecefDir(lat, lon), end: pts[TRAIL_SEG].clone() });
      for (let j = 0; j < TRAIL_SEG; j++) {
        const o = ((k * TRAIL_SEG + j) * 2) * 3;
        trailPos.set([pts[j].x, pts[j].y, pts[j].z, pts[j + 1].x, pts[j + 1].y, pts[j + 1].z], o);
      }
    }
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trailAlphaAttr = new THREE.BufferAttribute(trailAlpha, 1);
  trailAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  trailGeo.setAttribute("alpha", trailAlphaAttr);
  const trailMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `attribute float alpha; varying float vA;
      void main(){ vA = alpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying float vA; void main(){ if(vA<=0.001) discard; gl_FragColor = vec4(1.0,0.72,0.28, vA); }`,
  });
  const trails = new THREE.LineSegments(trailGeo, trailMat);
  trails.frustumCulled = false;
  earth.add(trails);

  // satellites
  const satPos = new Float32Array(N * 3);
  const satAlpha = new Float32Array(N);
  const satGeo = new THREE.BufferGeometry();
  const satPosAttr = new THREE.BufferAttribute(satPos, 3);
  satPosAttr.setUsage(THREE.DynamicDrawUsage);
  const satAlphaAttr = new THREE.BufferAttribute(satAlpha, 1);
  satAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  satGeo.setAttribute("position", satPosAttr);
  satGeo.setAttribute("alpha", satAlphaAttr);
  const satMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: 2.4 }, uScale: { value: 1.0 } },
    vertexShader: `attribute float alpha; varying float vA; uniform float uSize; uniform float uScale;
      void main(){
        vA = alpha;
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        gl_PointSize = clamp(uSize * uScale * (4.0 / -mv.z), 1.2, 6.0 * uScale);
        gl_Position = projectionMatrix*mv;
        if (alpha <= 0.0) gl_Position = vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader: `varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = dot(c,c);
        if (r > 0.25) discard;
        float a = smoothstep(0.25, 0.02, r) * vA;
        gl_FragColor = vec4(0.94, 0.97, 1.0, a);
      }`,
  });
  const sats = new THREE.Points(satGeo, satMat);
  sats.frustumCulled = false;
  scene.add(sats);

  // ---- camera framing
  const theta0 = gmst(refMs);
  function initialCamera() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const aspect = w / h;
    const vfov = camera.fov * DEG;
    // fit globe (with shell) to ~62% of the smaller dimension
    const fitH = 1.12 / Math.tan(vfov / 2) / 0.8;
    const fitW = 1.12 / (Math.tan(vfov / 2) * aspect) / 0.84;
    const dist = Math.max(fitH, fitW);
    // look at the western Atlantic / North America at the reference instant
    const dir = ecefDir(24, -78);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta0);
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);
    controls.update();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    satMat.uniforms.uScale.value = Math.min(window.devicePixelRatio || 1, 2) * (w < 640 ? 0.9 : 1);
    needsRender = true;
  }

  // ---- state
  let D = reduceMotion ? D_MAX : D_MIN;
  let playing = !reduceMotion;
  let playP = 0; // 0..1 playback progress
  let tau = 0;
  let needsRender = true;
  let lastDrawnD = NaN;

  // playback easing: constant speed, easing to a stop over the final 18%
  const P0 = 0.82;
  const K = 1 / (P0 + (1 - P0) / 2);
  function ease(p) {
    if (p <= P0) return K * p;
    const q = (p - P0) / (1 - P0);
    return K * (P0 + (1 - P0) * (q - q * q / 2));
  }
  function easeInv(x) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ease(m) < x) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  slider.min = String(D_MIN);
  slider.max = String(D_MAX);
  slider.step = "1";

  // year ticks
  {
    const ticks = el("sl-ticks");
    const y0 = new Date(refMs + D_MIN * 86400000).getUTCFullYear() + 1;
    const y1 = new Date(refMs).getUTCFullYear();
    for (let y = y0; y <= y1; y++) {
      const d = (Date.UTC(y, 0, 1) - refMs) / 86400000;
      const f = (d - D_MIN) / (D_MAX - D_MIN);
      const s = document.createElement("span");
      s.textContent = String(y);
      s.style.left = (f * 100).toFixed(2) + "%";
      if ((y - y0) % 2 === 1) s.className = "minor";
      ticks.appendChild(s);
    }
  }

  el("sl-span").textContent = "Every launch " + new Date(data.launches[0][1] * 1000).getUTCFullYear() + "–" + new Date(refMs).getUTCFullYear();
  out.asof.textContent = "Data as of " + new Date(refMs).toISOString().slice(0, 16).replace("T", " ") + " UTC · " +
    fmt.format(N) + " satellites, " + fmt.format(NL) + " launches.";

  function setPlaying(p) {
    playing = p;
    playBtn.classList.toggle("paused", !p);
    playBtn.setAttribute("aria-label", p ? "Pause" : "Play");
  }
  setPlaying(playing);

  playBtn.addEventListener("click", () => {
    if (playing) { setPlaying(false); return; }
    const x = (D - D_MIN) / (D_MAX - D_MIN);
    playP = x >= 0.999 ? 0 : easeInv(x);
    if (x >= 0.999) D = D_MIN;
    setPlaying(true);
  });

  const onScrub = () => {
    setPlaying(false);
    D = Math.max(D_MIN, Math.min(D_MAX, parseFloat(slider.value)));
    needsRender = true;
  };
  slider.addEventListener("input", onScrub);
  slider.addEventListener("pointerdown", () => setPlaying(false));

  // ---- per-frame update
  const tmpSite = new THREE.Vector3(), tmpEnd = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const trainE = new Float64Array(NL * 3), trainB = new Float64Array(NL * 3);

  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  function update() {
    const theta = theta0 + 2 * Math.PI * 1.00273781191 * tau;
    earth.rotation.y = theta;

    // launches in view: trails + train frames
    const kMax = upperBound(lTsorted, D) - 1;
    trailAlpha.fill(0);
    for (let k = kMax; k >= 0; k--) {
      const age = D - lT[k];
      if (age > 200) break;
      // train frame in inertial coordinates
      const te = trailEnd[k];
      tmpSite.copy(te.site).applyAxisAngle(yAxis, theta);
      tmpEnd.copy(te.end).applyAxisAngle(yAxis, theta);
      const r = tmpEnd.length();
      tmpEnd.divideScalar(r);
      tmpN.crossVectors(tmpSite, tmpEnd).normalize();
      tmpB.crossVectors(tmpN, tmpEnd); // along-track direction
      trainE[k * 3] = tmpEnd.x; trainE[k * 3 + 1] = tmpEnd.y; trainE[k * 3 + 2] = tmpEnd.z;
      trainB[k * 3] = tmpB.x; trainB[k * 3 + 1] = tmpB.y; trainB[k * 3 + 2] = tmpB.z;
      if (age < TRAIL_DAYS) {
        const grow = Math.min(1, Math.max(0, age) / 2.5 + 0.08);
        const fade = Math.pow(1 - age / TRAIL_DAYS, 1.4);
        for (let j = 0; j < TRAIL_SEG; j++) {
          const f = (j + 1) / TRAIL_SEG;
          if (f > grow + 1e-6) break;
          const head = 1 - Math.min(1, (grow - f) * 1.4);
          const a = fade * (0.25 + 0.75 * head) * 0.95;
          const o = (k * TRAIL_SEG + j) * 2;
          trailAlpha[o] = a; trailAlpha[o + 1] = a;
        }
      }
    }
    trailAlphaAttr.needsUpdate = true;

    const nLaunched = upperBound(launchSorted, D);
    const r0 = 1 + INSERT_ALT / RE;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const tl = sTL[i];
      if (D < tl || D >= sTD[i]) { satAlpha[i] = 0; continue; }
      const age = D - tl;
      // operational orbit position (inertial, three.js axes)
      const Om = sO0[i] + sOd[i] * tau;
      const u = sU0[i] + sN[i] * tau;
      const cO = Math.cos(Om), sO = Math.sin(Om), cu = Math.cos(u), su = Math.sin(u);
      let fx = cO * cu - sO * su * sCi[i];
      let fy = su * sSi[i];
      let fz = -(sO * cu + cO * su * sCi[i]);
      let rr = sRf[i];
      let alpha = 0.9;
      const s = smooth((age - 1.5) / sR[i]);
      if (s < 1) {
        const k = data.L[i];
        const cnt = lCount[k];
        const spread = Math.min(5.2, 0.05 + age * 0.12);
        const d = (cnt > 1 ? sIdx[i] / (cnt - 1) : 0) * spread;
        const cd = Math.cos(d), sd = Math.sin(d);
        const px = trainE[k * 3] * cd + trainB[k * 3] * sd;
        const py = trainE[k * 3 + 1] * cd + trainB[k * 3 + 1] * sd;
        const pz = trainE[k * 3 + 2] * cd + trainB[k * 3 + 2] * sd;
        let x = px + (fx - px) * s, y = py + (fy - py) * s, z = pz + (fz - pz) * s;
        const l = Math.hypot(x, y, z) || 1;
        fx = x / l; fy = y / l; fz = z / l;
        rr = r0 + (sRf[i] - r0) * s;
        alpha = 0.55 + 0.4 * s + (age < 0.5 ? 0.3 : 0);
      }
      const td = sTD[i];
      if (td !== Infinity) {
        const life = td - tl;
        const L = Math.min(50, life * 0.4);
        const left = td - D;
        if (left < L) {
          const q = 1 - left / L;
          const floor = 1 + 150 / RE;
          rr = rr + (floor - rr) * q;
          alpha *= q > 0.6 ? (1 - q) / 0.4 : 1;
        }
      }
      satAlpha[i] = alpha;
      satPos[o] = fx * rr; satPos[o + 1] = fy * rr; satPos[o + 2] = fz * rr;
    }
    satPosAttr.needsUpdate = true;
    satAlphaAttr.needsUpdate = true;

    // counters
    const nDecayed = upperBound(decaySorted, D);
    const nLaunches = upperBound(lTsorted, D);
    out.launched.textContent = fmt.format(nLaunched);
    out.inorbit.textContent = fmt.format(nLaunched - nDecayed);
    out.launches.textContent = fmt.format(nLaunches);
    const dt = new Date(refMs + D * 86400000);
    out.year.textContent = String(dt.getUTCFullYear());
    out.date.textContent = dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()] + " " + dt.getUTCFullYear() + " · " +
      pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes()) + " UTC";
    if (nLaunches > 0) {
      const k = nLaunches - 1;
      const ld = new Date(refMs + lT[k] * 86400000);
      const label = k === 0 ? "Tintin A/B prototypes" : fmt.format(lCount[k]) + " satellites";
      out.latest.innerHTML = "<strong>Latest launch</strong>" + ld.getUTCDate() + " " + MONTHS[ld.getUTCMonth()] + " " +
        ld.getUTCFullYear() + " · " + data.pads[lPad[k]] + " · " + label;
    } else {
      out.latest.textContent = "";
    }
    slider.value = String(Math.round(D));
    slider.style.setProperty("--fill", (((D - D_MIN) / (D_MAX - D_MIN)) * 100).toFixed(2) + "%");
    lastDrawnD = D;
  }

  // ---- loop
  let last = performance.now();
  window.__sl = {
    get D() { return D; }, set D(v) { D = v; needsRender = true; setPlaying(false); },
    get playing() { return playing; }, D_MIN, D_MAX, N, NL, ref: refMs, frames: 0,
    counts: () => ({ launched: out.launched.textContent, inorbit: out.inorbit.textContent, launches: out.launches.textContent, date: out.date.textContent }),
  };
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      playP = Math.min(1, playP + dt / PLAY_SECONDS);
      D = D_MIN + (D_MAX - D_MIN) * ease(playP);
      if (playP >= 1) { D = D_MAX; setPlaying(false); }
      needsRender = true;
    }
    if (!reduceMotion) { tau += dt * TAU_RATE; needsRender = true; }
    if (controls.update()) needsRender = true;
    if (needsRender) {
      update();
      renderer.render(scene, camera);
      window.__sl.frames++;
      needsRender = false;
    }
    requestAnimationFrame(frame);
  }

  resize();
  initialCamera();
  new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  const l = el("sl-loading");
  l.hidden = false;
  l.textContent = "Satellite data could not be loaded.";
});
