import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const UNIT = 0.001; // 1 scene unit = 1,000 km
const AUTOPLAY_SEC = 108;
const HOLD_MS = 5500;
const SE_HALO_SEC = 64;
const EM_HALO_SEC = 28;
const PRESENT_ISO = "2026-11-16";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const COLORS = {
  "SE-L1": 0x56b4e9,
  "SE-L2": 0xe69f00,
  "EM-L1": 0xcc79a7,
  "EM-L2": 0xf0e442,
  transfer: 0xe0e8ff,
};

function $(id) { return document.getElementById(id); }

function isoToMjd(iso) {
  const ms = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  return ms / 86400000 + 40587;
}
function mjdToDate(mjd) {
  return new Date((mjd - 40587) * 86400000);
}
function fmtDay(mjd) {
  const d = mjdToDate(mjd);
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
}
function fmtFull(mjd) {
  const d = mjdToDate(mjd);
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

function unpack(pack) {
  if (!pack) return [];
  const t0 = pack.t0_mjd;
  const n = pack.n || pack.hours.length;
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    pts[i] = { mjd: t0 + pack.hours[i] / 24, x: pack.x[i], y: pack.y[i], z: pack.z[i] };
  }
  return pts;
}

function atSeries(pts, mjd) {
  if (!pts || !pts.length) return null;
  if (mjd <= pts[0].mjd) return pts[0];
  if (mjd >= pts[pts.length - 1].mjd) return pts[pts.length - 1];
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].mjd <= mjd) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  const t = (mjd - a.mjd) / (b.mjd - a.mjd || 1);
  return { mjd, x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z: a.z + t * (b.z - a.z) };
}

function lerp3(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z: a.z + t * (b.z - a.z) };
}

function dist3(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function makeDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.7, "rgba(255,255,255,0.18)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function pointPos(point, moon, rse, C) {
  if (point === "SE-L1") return { x: -C.se_l1_km * (rse / C.au_km), y: 0, z: 0 };
  if (point === "SE-L2") return { x:  C.se_l2_km * (rse / C.au_km), y: 0, z: 0 };
  if (point === "SE-L3") return { x: -rse * (2 - (7 / 12) * 3.0404235e-6), y: 0, z: 0 };
  if (point === "SE-L4") return { x: -rse * 0.5, y:  rse * Math.sqrt(3) / 2, z: 0 };
  if (point === "SE-L5") return { x: -rse * 0.5, y: -rse * Math.sqrt(3) / 2, z: 0 };
  if (!moon) return { x: 0, y: 0, z: 0 };
  const mn = Math.hypot(moon.x, moon.y, moon.z) || 1;
  const ux = moon.x / mn, uy = moon.y / mn, uz = moon.z / mn;
  const scale = mn / 384400;
  if (point === "EM-L1") {
    const d = C.em_l1_km * scale;
    return { x: moon.x - ux * d, y: moon.y - uy * d, z: moon.z - uz * d };
  }
  if (point === "EM-L2") {
    const d = C.em_l2_km * scale;
    return { x: moon.x + ux * d, y: moon.y + uy * d, z: moon.z + uz * d };
  }
  return { x: 0, y: 0, z: 0 };
}

function stayAt(m, mjd) {
  for (let i = 0; i < m.stays.length; i++) {
    const st = m.stays[i];
    const a = isoToMjd(st.arrival);
    const b = st.departure ? isoToMjd(st.departure) : 1e12;
    if (mjd >= a && mjd <= b) return st;
  }
  return null;
}

function visible(m, mjd) {
  return mjd >= isoToMjd(m.appear_start) - 0.05 && mjd <= isoToMjd(m.appear_end) + 0.2;
}

function launchedBy(m, mjd) {
  return mjd >= isoToMjd(m.launch) - 0.05;
}

export async function startLagrange(opts) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = $("lg-stage");
  const canvas = $("lg-canvas");
  const labelLayer = $("lg-labels");
  const loading = $("lg-loading");
  const slider = $("lg-slider");
  const playBtn = $("lg-play");
  const panel = $("lg-panel");
  const tip = $("lg-tip");

  const currentTab = document.querySelector(".ev-tabs a[aria-current='page']");
  if (currentTab && currentTab.scrollIntoView) {
    currentTab.scrollIntoView({ inline: "center", block: "nearest" });
  }

  let missions, traj, C, moonPts, rseT0, rseHours, rseKm, scPts = {}, sources = {};

  try {
    const [mj, tj] = await Promise.all([
      fetch(opts.missionsUrl).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(opts.trajUrl).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);
    missions = mj.missions;
    traj = tj;
    C = tj.constants;
    moonPts = unpack(tj.moon);
    rseT0 = tj.r_se.t0_mjd;
    rseHours = tj.r_se.hours;
    rseKm = tj.r_se.km;
    sources = tj.sources || {};
    for (const m of missions) {
      scPts[m.id] = unpack(tj.spacecraft[m.id]);
      if (sources[m.id]) m.source = sources[m.id];
    }
    if ($("lg-asof")) {
      $("lg-asof").textContent = "Catalog as of 16 November 2026. Horizons vectors retrieved 16 November 2026.";
    }
  } catch (err) {
    if (loading) loading.textContent = "Could not load trajectory data.";
    console.error(err);
    return;
  }

  function rSe(mjd) {
    const h = (mjd - rseT0) * 24;
    const hrs = rseHours, kms = rseKm;
    if (h <= hrs[0]) return kms[0];
    if (h >= hrs[hrs.length - 1]) return kms[kms.length - 1];
    let lo = 0, hi = hrs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (hrs[mid] <= h) lo = mid; else hi = mid;
    }
    const den = hrs[hi] - hrs[lo] || 1;
    const t = (h - hrs[lo]) / den;
    return kms[lo] + t * (kms[hi] - kms[lo]);
  }

  /* ----- compressed timeline ----- */
  const tStart = isoToMjd("1978-08-12");
  const tEnd = isoToMjd(PRESENT_ISO);
  const nDays = Math.floor(tEnd - tStart) + 1;
  const weight = new Float64Array(nDays);
  const cum = new Float64Array(nDays + 1);

  function dayWeight(mjd) {
    let w = 0.035;
    let occ = false, event = false;
    for (const m of missions) {
      const start = isoToMjd(m.appear_start);
      const end = isoToMjd(m.appear_end);
      if (mjd < start - 1 || mjd > end + 1) continue;
      for (let i = 0; i < m.stays.length; i++) {
        const st = m.stays[i];
        const arr = isoToMjd(st.arrival);
        const dep = st.departure ? isoToMjd(st.departure) : end;
        const t0 = i === 0 ? start : (m.stays[i - 1].departure ? isoToMjd(m.stays[i - 1].departure) : arr);
        if (mjd >= t0 && mjd <= arr) {
          const age = mjd - t0;
          w = Math.max(w, age <= 45 ? 8 : 3.5);
        }
        if (mjd >= arr && mjd <= dep) {
          occ = true;
          if (mjd - arr <= 12) event = true;
          if (st.departure && dep - mjd <= 8) event = true;
        }
        if (st.departure && mjd > dep && mjd <= Math.min(dep + 50, end)) {
          w = Math.max(w, 5);
        }
      }
    }
    if (event) w = Math.max(w, 4);
    if (occ && w < 1) w = 0.14;
    return w;
  }
  for (let i = 0; i < nDays; i++) weight[i] = dayWeight(tStart + i);
  for (let i = 0; i < nDays; i++) cum[i + 1] = cum[i] + weight[i];
  const W = cum[nDays];

  function uToMjd(u) {
    const u0 = Math.max(0, Math.min(1, u));
    const target = u0 * W;
    let lo = 0, hi = nDays;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid; else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const f = (target - cum[lo]) / span;
    return tStart + lo + f;
  }
  function mjdToU(mjd) {
    if (mjd <= tStart) return 0;
    if (mjd >= tEnd) return 1;
    const i = Math.min(nDays - 1, Math.max(0, Math.floor(mjd - tStart)));
    const f = mjd - tStart - i;
    const w = cum[i] + f * weight[i];
    return w / W;
  }
  function playbackSec(mjdA, mjdB) {
    return Math.abs(mjdToU(mjdB) - mjdToU(mjdA)) * AUTOPLAY_SEC;
  }

  /* ----- slider ticks ----- */
  const tickYears = [1978, 1995, 2001, 2009, 2015, 2018, 2022, 2026];
  const ticksEl = $("lg-ticks");
  if (ticksEl) {
    ticksEl.innerHTML = "";
    for (const y of tickYears) {
      const iso = y === 1978 ? "1978-08-12" : (y === 2026 ? PRESENT_ISO : y + "-01-01");
      const u = mjdToU(isoToMjd(iso));
      const s = document.createElement("span");
      s.textContent = String(y);
      s.style.left = (u * 100) + "%";
      if (y === 2001 || y === 2018) s.className = "minor";
      ticksEl.appendChild(s);
    }
  }

  /* ----- three.js scene ----- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 2, 400000);
  camera.up.set(0, 0, 1);
  camera.position.set(900, -2600, 1400);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.7;
  controls.panSpeed = 0.5;
  controls.minDistance = 18;
  controls.maxDistance = 280000;
  controls.target.set(0, 0, 0);
  controls.screenSpacePanning = true;

  scene.add(new THREE.AmbientLight(0x9aa8c8, 0.45));
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sunLight.position.set(-4000, 0, 400);
  scene.add(sunLight);

  const earthR = C.earth_radius_km * UNIT;
  const moonR = C.moon_radius_km * UNIT;
  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x3a6fd4, emissive: 0x0a1a3a, specular: 0x88b4ff, shininess: 18,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), earthMat);
  earth.scale.setScalar(earthR);
  scene.add(earth);
  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  atmos.scale.setScalar(earthR * 1.15);
  scene.add(atmos);

  const moonMat = new THREE.MeshPhongMaterial({ color: 0xc8c4b8, emissive: 0x1a1916, shininess: 4 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), moonMat);
  moon.scale.setScalar(moonR);
  scene.add(moon);

  const moonOrbitGeo = new THREE.BufferGeometry();
  const moonOrbit = new THREE.LineLoop(moonOrbitGeo, new THREE.LineBasicMaterial({
    color: 0x8a90a8, transparent: true, opacity: 0.22,
  }));
  scene.add(moonOrbit);

  function makeMarker(color, size) {
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const s = size;
    const mk = (pts) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      g.add(new THREE.Line(geo, mat));
    };
    mk([new THREE.Vector3(-s, 0, 0), new THREE.Vector3(s, 0, 0)]);
    mk([new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, s, 0)]);
    mk([new THREE.Vector3(0, 0, -s * 0.7), new THREE.Vector3(0, 0, s * 0.7)]);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(s * 2.4, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData.isHit = true;
    g.add(hit);
    return g;
  }

  const markers = {};
  for (const p of ["SE-L1", "SE-L2", "EM-L1", "EM-L2"]) {
    markers[p] = makeMarker(COLORS[p], p.startsWith("EM") ? 8 : 22);
    scene.add(markers[p]);
  }
  const farMarkers = {};
  for (const p of ["SE-L3", "SE-L4", "SE-L5"]) {
    farMarkers[p] = makeMarker(0x9aa3bf, 800);
    farMarkers[p].visible = false;
    scene.add(farMarkers[p]);
  }

  const labels = {};
  function addLabel(id, text) {
    const el = document.createElement("span");
    el.textContent = text;
    el.dataset.id = id;
    labelLayer.appendChild(el);
    labels[id] = el;
  }
  addLabel("earth", "Earth");
  addLabel("moon", "Moon");
  addLabel("SE-L1", "SE-L1");
  addLabel("SE-L2", "SE-L2");
  addLabel("EM-L1", "EM-L1");
  addLabel("EM-L2", "EM-L2");
  addLabel("SE-L3", "SE-L3");
  addLabel("SE-L4", "SE-L4");
  addLabel("SE-L5", "SE-L5");

  const dotTex = makeDotTexture();
  const scObj = {};
  for (const m of missions) {
    const mat = new THREE.SpriteMaterial({
      map: dotTex, color: COLORS.transfer, transparent: true, depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(14, 14, 1);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    const group = new THREE.Group();
    group.add(spr);
    group.add(hit);
    group.visible = false;
    const orbitMat = new THREE.LineBasicMaterial({
      color: COLORS.transfer, transparent: true, opacity: 0.32, depthWrite: false,
    });
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry(), orbitMat);
    orbit.visible = false;
    const pathMat = new THREE.LineBasicMaterial({
      color: 0xc5d0e8, transparent: true, opacity: 0.28, depthWrite: false,
    });
    const path = new THREE.Line(new THREE.BufferGeometry(), pathMat);
    path.visible = false;
    scene.add(group);
    scene.add(orbit);
    scene.add(path);
    scObj[m.id] = { group, spr, hit, orbit, path, mat: spr.material, orbitMat, pathMat };
    hit.userData.scId = m.id;
  }

  const ndc = new THREE.Vector3();
  function project(x, y, z, el, show) {
    if (!show) { el.style.display = "none"; return; }
    ndc.set(x * UNIT, y * UNIT, z * UNIT).project(camera);
    if (ndc.z > 1 || ndc.z < -1 || Math.abs(ndc.x) > 1.15 || Math.abs(ndc.y) > 1.15) {
      el.style.display = "none";
      return;
    }
    const r = canvas.getBoundingClientRect();
    el.style.display = "";
    el.style.left = ((ndc.x * 0.5 + 0.5) * r.width) + "px";
    el.style.top = ((-ndc.y * 0.5 + 0.5) * r.height) + "px";
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  /* ----- time state ----- */
  let playing = !reduced;
  let u = 0;
  let lastTs = 0;
  let holdUntil = 0;
  let frames = 0;
  let mjd = tStart;
  let fly = null;
  let activeView = "overview";
  let selected = null;
  let selectedKind = null; // "sc" | "point"
  let pointerDown = null;

  if (reduced) {
    u = 1;
    mjd = tEnd;
    playing = false;
    playBtn.classList.add("paused");
    playBtn.setAttribute("aria-label", "Play");
  }

  function setPlaying(on) {
    playing = on;
    playBtn.classList.toggle("paused", !on);
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    if (on && u >= 0.999) {
      u = 0;
      holdUntil = 0;
    }
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));

  slider.max = "10000";
  slider.addEventListener("input", () => {
    u = Number(slider.value) / 10000;
    mjd = uToMjd(u);
    playing = false;
    playBtn.classList.add("paused");
    playBtn.setAttribute("aria-label", "Play");
    holdUntil = 0;
    refreshClock();
  });

  function refreshClock() {
    const d = mjdToDate(mjd);
    $("lg-year").textContent = String(d.getUTCFullYear());
    $("lg-date").textContent = fmtDay(mjd);
    slider.value = String(Math.round(mjdToU(mjd) * 10000));
    slider.style.setProperty("--fill", (mjdToU(mjd) * 100) + "%");
    slider.setAttribute("aria-valuetext", fmtFull(mjd));
  }

  function snapshot(at) {
    const moon = atSeries(moonPts, at) || { x: 384400, y: 0, z: 0 };
    const rse = rSe(at);
    const pts = {
      "SE-L1": pointPos("SE-L1", moon, rse, C),
      "SE-L2": pointPos("SE-L2", moon, rse, C),
      "EM-L1": pointPos("EM-L1", moon, rse, C),
      "EM-L2": pointPos("EM-L2", moon, rse, C),
      "SE-L3": pointPos("SE-L3", moon, rse, C),
      "SE-L4": pointPos("SE-L4", moon, rse, C),
      "SE-L5": pointPos("SE-L5", moon, rse, C),
    };
    const occupying = [];
    const transferring = [];
    const launched = [];
    const vis = [];
    for (const m of missions) {
      if (launchedBy(m, at)) launched.push(m.id);
      if (!visible(m, at)) continue;
      const st = stayAt(m, at);
      const pos = atSeries(scPts[m.id], at);
      const rec = { id: m.id, name: m.name, point: st ? st.point : null, pos, stay: st, source: m.source };
      vis.push(rec);
      if (st) occupying.push(rec);
      else transferring.push(rec);
    }
    return { moon, rse, pts, occupying, transferring, launched, vis };
  }

  function loopFor(m, at, point, P) {
    const pts = scPts[m.id];
    if (!pts || !pts.length) return null;
    const period = point.startsWith("EM") ? 14.5 : 180;
    const lo = at - period * 0.55, hi = at + period * 0.55;
    const slice = [];
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].mjd >= lo && pts[i].mjd <= hi) slice.push(pts[i]);
    }
    if (slice.length < 8) return null;
    const c = P.pts[point];
    if (!c) return null;
    // only keep points near the L-point (within a generous halo)
    const maxR = point.startsWith("EM") ? 120000 : 1600000;
    const near = slice.filter((p) => dist3(p, c) < maxR);
    if (near.length < 8) return null;
    return near;
  }

  function phasePos(loop, at, clock, periodSec, pointKind) {
    if (!loop || loop.length < 2) return null;
    const t0 = loop[0].mjd, t1 = loop[loop.length - 1].mjd;
    const span = Math.max(0.1, t1 - t0);
    let s = (at - t0) / span;
    if (!reduced) s += clock / periodSec;
    s = ((s % 1) + 1) % 1;
    const f = s * (loop.length - (pointKind === "closed" ? 0 : 1));
    const n = loop.length;
    const i = Math.floor(f) % n;
    const t = f - Math.floor(f);
    const a = loop[i], b = loop[(i + 1) % n];
    return lerp3(a, b, t);
  }

  function recentPath(m, at) {
    const pts = scPts[m.id];
    if (!pts) return null;
    const start = isoToMjd(m.appear_start);
    const lo = Math.max(start, at - 80);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].mjd >= lo && pts[i].mjd <= at + 0.01) out.push(pts[i]);
    }
    if (out.length && out[out.length - 1].mjd < at - 0.2) {
      const cur = atSeries(pts, at);
      if (cur) out.push(cur);
    }
    return out.length >= 2 ? out : null;
  }

  function setLine(line, pts, closed) {
    if (!pts || pts.length < 2) { line.visible = false; return; }
    const arr = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      arr[i * 3] = pts[i].x * UNIT;
      arr[i * 3 + 1] = pts[i].y * UNIT;
      arr[i * 3 + 2] = pts[i].z * UNIT;
    }
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry();
    line.geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    line.visible = true;
  }

  function bodyVisualRadius(trueR, camDist, minFrac) {
    return Math.max(trueR, minFrac * camDist);
  }

  let lastSnap = null;
  let clockT = 0;

  function updateScene(dt) {
    const P = snapshot(mjd);
    lastSnap = P;
    const camDist = camera.position.distanceTo(controls.target);
    const eScale = bodyVisualRadius(earthR, camDist, 0.011);
    const mScale = bodyVisualRadius(moonR, camDist, 0.007);
    earth.scale.setScalar(eScale);
    atmos.scale.setScalar(eScale * 1.18);
    moon.position.set(P.moon.x * UNIT, P.moon.y * UNIT, P.moon.z * UNIT);
    moon.scale.setScalar(mScale);

    // moon orbit ring (current month of samples)
    const ring = [];
    const m0 = mjd - 14, m1 = mjd + 14;
    for (let i = 0; i < moonPts.length; i++) {
      if (moonPts[i].mjd >= m0 && moonPts[i].mjd <= m1) ring.push(moonPts[i]);
    }
    setLine(moonOrbit, ring, true);
    moonOrbit.visible = camDist < 8000;

    for (const p of ["SE-L1", "SE-L2", "EM-L1", "EM-L2"]) {
      const q = P.pts[p];
      markers[p].position.set(q.x * UNIT, q.y * UNIT, q.z * UNIT);
      const near = p.startsWith("EM") ? (camDist < 2500) : true;
      markers[p].visible = near;
      const ms = p.startsWith("EM") ? Math.max(4, Math.min(14, camDist * 0.02)) : Math.max(10, Math.min(28, camDist * 0.01));
      markers[p].scale.setScalar(ms / 22);
    }
    const far = camDist > 25000;
    for (const p of ["SE-L3", "SE-L4", "SE-L5"]) {
      const q = P.pts[p];
      farMarkers[p].position.set(q.x * UNIT, q.y * UNIT, q.z * UNIT);
      farMarkers[p].visible = far;
      farMarkers[p].scale.setScalar(Math.max(1, camDist / 40000));
    }

    const emZoom = camDist < 2200 || activeView === "EM-L1" || activeView === "EM-L2" || activeView === "earth";
    project(0, 0, 0, labels.earth, camDist < 20000);
    project(P.moon.x, P.moon.y, P.moon.z, labels.moon, emZoom || camDist < 4000);
    project(P.pts["SE-L1"].x, P.pts["SE-L1"].y, P.pts["SE-L1"].z, labels["SE-L1"], camDist < 20000);
    project(P.pts["SE-L2"].x, P.pts["SE-L2"].y, P.pts["SE-L2"].z, labels["SE-L2"], camDist < 20000);
    project(P.pts["EM-L1"].x, P.pts["EM-L1"].y, P.pts["EM-L1"].z, labels["EM-L1"], emZoom);
    project(P.pts["EM-L2"].x, P.pts["EM-L2"].y, P.pts["EM-L2"].z, labels["EM-L2"], emZoom);
    project(P.pts["SE-L3"].x, P.pts["SE-L3"].y, P.pts["SE-L3"].z, labels["SE-L3"], far);
    project(P.pts["SE-L4"].x, P.pts["SE-L4"].y, P.pts["SE-L4"].z, labels["SE-L4"], far);
    project(P.pts["SE-L5"].x, P.pts["SE-L5"].y, P.pts["SE-L5"].z, labels["SE-L5"], far);

    const byId = {};
    for (const rec of P.vis) byId[rec.id] = rec;

    for (const m of missions) {
      const o = scObj[m.id];
      const rec = byId[m.id];
      if (!rec || !rec.pos) {
        o.group.visible = false;
        o.orbit.visible = false;
        o.path.visible = false;
        continue;
      }
      const point = rec.point;
      const col = point ? COLORS[point] : COLORS.transfer;
      o.mat.color.setHex(col);
      o.orbitMat.color.setHex(point ? COLORS[point] : COLORS.transfer);
      let pos = rec.pos;
      let loop = null;
      if (point) {
        loop = loopFor(m, mjd, point, P);
        const psec = point.startsWith("EM") ? EM_HALO_SEC : SE_HALO_SEC;
        const ph = loop ? phasePos(loop, mjd, clockT, psec, "closed") : null;
        if (ph) pos = ph;
      }
      o.group.position.set(pos.x * UNIT, pos.y * UNIT, pos.z * UNIT);
      o.group.visible = true;
      const sprS = Math.max(8, Math.min(28, camDist * 0.012));
      o.spr.scale.set(sprS, sprS, 1);
      const hitR = Math.max(10, Math.min(55, camDist * 0.018));
      o.hit.scale.setScalar(hitR);
      if (loop && point) {
        setLine(o.orbit, loop, true);
        o.orbitMat.opacity = 0.34;
        o.path.visible = false;
      } else {
        o.orbit.visible = false;
        const path = recentPath(m, mjd);
        setLine(o.path, path, false);
      }
    }

    $("lg-atpoints").textContent = String(P.occupying.length);
    $("lg-transfer").textContent = String(P.transferring.length);
    $("lg-launched").textContent = String(P.launched.length);

    let latest = "";
    let latestMjd = -1e9, latestName = "";
    for (const m of missions) {
      const lm = isoToMjd(m.launch);
      if (lm <= mjd && lm >= latestMjd) { latestMjd = lm; latestName = m.name; }
    }
    const arrivals = P.transferring;
    if (arrivals.length) {
      const a = arrivals[arrivals.length - 1];
      latest = "En route · " + a.name;
    } else if (latestName) {
      latest = latestName;
    }
    $("lg-latest").innerHTML = latest ? "<strong>Latest</strong>" + latest : "";
  }

  /* ----- fly-to ----- */
  const views = ["overview", "earth", "SE-L1", "SE-L2", "EM-L1", "EM-L2"];
  function flyTarget(name, P) {
    if (name === "overview") return { target: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(900, -2600, 1400) };
    if (name === "earth") return { target: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(120, -420, 260) };
    const q = P.pts[name];
    const t = new THREE.Vector3(q.x * UNIT, q.y * UNIT, q.z * UNIT);
    const rad = name.startsWith("EM") ? 90 : (name === "SE-L2" ? 1100 : 900);
    const pos = t.clone().add(new THREE.Vector3(rad * 0.35, -rad * 0.85, rad * 0.45));
    return { target: t, pos };
  }
  function startFly(name) {
    const P = lastSnap || snapshot(mjd);
    const dest = flyTarget(name, P);
    fly = {
      name,
      t0: performance.now(),
      dur: 1400,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: dest.pos,
      toTarget: dest.target,
    };
    activeView = name;
    for (const b of document.querySelectorAll("#lg-fly button")) {
      b.setAttribute("aria-pressed", b.dataset.view === name ? "true" : "false");
    }
  }
  $("lg-fly").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (b) startFly(b.dataset.view);
  });

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function tickFly(now) {
    if (!fly) return;
    const t = Math.min(1, (now - fly.t0) / fly.dur);
    const s = easeInOut(t);
    camera.position.lerpVectors(fly.fromPos, fly.toPos, s);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, s);
    if (t >= 1) fly = null;
  }

  /* ----- info cards ----- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function closePanel() {
    panel.hidden = true;
    document.body.classList.remove("lg-panel-open");
    selected = null;
    selectedKind = null;
  }
  function openScCard(id) {
    const m = missions.find((x) => x.id === id);
    if (!m) return;
    selected = id;
    selectedKind = "sc";
    const col = m.stays[m.stays.length - 1] ? COLORS[m.stays[m.stays.length - 1].point] : COLORS.transfer;
    const hex = "#" + col.toString(16).padStart(6, "0");
    const points = [...new Set(m.stays.map((s) => s.point))].join(", ");
    const arr = m.stays[0] ? fmtFull(isoToMjd(m.stays[0].arrival)) : "—";
    const stLabel = m.status === "active" ? "Active" :
      m.status === "heliocentric disposal" ? "Heliocentric disposal" :
      m.status === "retired-departed" ? "Retired, departed" : m.status;
    const note = m.source_note || ((m.approximate || m.source === "modeled")
      ? "This path is modeled from published dates and typical halo amplitudes; no public Horizons ephemeris covered the flight."
      : "");
    const approx = note ? '<p class="approx">' + escapeHtml(note) + "</p>" : "";
    const zoomPoint = (stayAt(m, mjd) || m.stays[m.stays.length - 1] || {}).point;
    panel.innerHTML =
      '<div class="sheet-handle" aria-hidden="true"><span class="sheet-grip"></span></div>' +
      '<div class="panel-head"><span class="dot" style="background:' + hex + ';color:' + hex + '"></span><h2>' + escapeHtml(m.name) + '</h2><button class="close" type="button" aria-label="Close">&times;</button></div>' +
      approx +
      '<dl>' +
      row("Agency", m.agency) +
      row("Launch", fmtFull(isoToMjd(m.launch)) + (m.launch_time ? " · " + m.launch_time : "")) +
      row("Arrival", arr) +
      row("Point" + (m.stays.length > 1 ? "s" : ""), points) +
      row("Status", stLabel) +
      "</dl>" +
      '<p class="facts">' + escapeHtml(m.summary) + "</p>" +
      (zoomPoint ? '<button class="zoom-btn" type="button" data-fly="' + zoomPoint + '">View ' + zoomPoint + "</button>" : "") +
      (m.url ? '<a class="mission-link" href="' + escapeHtml(m.url) + '" target="_blank" rel="noopener noreferrer">Mission page</a>' : "");
    panel.hidden = false;
    document.body.classList.add("lg-panel-open");
    panel.querySelector(".close").addEventListener("click", closePanel);
    const zb = panel.querySelector("[data-fly]");
    if (zb) zb.addEventListener("click", () => startFly(zb.getAttribute("data-fly")));
  }
  function row(k, v) {
    return '<div class="row"><dt>' + escapeHtml(k) + "</dt><dd>" + escapeHtml(v) + "</dd></div>";
  }
  function openPointCard(point) {
    const info = (arguments.callee && null) || null;
    const catalog = arguments[1];
    void catalog;
    selected = point;
    selectedKind = "point";
    // loaded with missions file — look up from last fetch
    openPointCardFromData(point);
  }

  let pointInfo = null;
  // re-fetch not needed; we stored missions json only. Load points from a closure var.
  // We'll set pointInfo after load — patch: stored on traj? We only have missions.
  // Re-get from first fetch: we didn't keep mj.points. Store it now if possible by another parse.
  // Fix: capture points by reading from a global set below after I patch startLagrange.
  // For now, embed fallback text:
  const POINT_INFO = {
    "SE-L1": { name: "Sun–Earth L1", summary: "Sun–Earth L1 lies about 1.5 million kilometres sunward of Earth, where the gravitational pull of the Sun and Earth, together with the orbital motion, allow a spacecraft to remain in a halo or Lissajous orbit and watch the Sun and the solar wind continuously." },
    "SE-L2": { name: "Sun–Earth L2", summary: "Sun–Earth L2 lies about 1.5 million kilometres beyond Earth, opposite the Sun. A spacecraft there stays lined up with Earth as both travel around the Sun, which suits cold, stable observatories such as Webb, Euclid, Gaia, and Roman." },
    "EM-L1": { name: "Earth–Moon L1", summary: "Earth–Moon L1 lies between the Earth and the Moon, roughly 58,000 to 61,000 kilometres from the Moon. ARTEMIS P1 and P2 were the first spacecraft to occupy this point, in 2010–2011, before entering lunar orbit." },
    "EM-L2": { name: "Earth–Moon L2", summary: "Earth–Moon L2 lies beyond the Moon, about 64,500 kilometres farther from Earth. It is a natural place for a far-side communications relay. Queqiao has occupied a halo orbit there since 2018; ARTEMIS P1 and Chang'e 5-T1 visited earlier." },
    "SE-L3": { name: "Sun–Earth L3", summary: "Sun–Earth L3 lies on the far side of the Sun, opposite Earth. No artificial spacecraft has been stationed there." },
    "SE-L4": { name: "Sun–Earth L4", summary: "Sun–Earth L4 leads Earth in its orbit by 60 degrees, about 150 million kilometres away. No spacecraft has been stationed there; STEREO-A and OSIRIS-REx passed through the region on other missions." },
    "SE-L5": { name: "Sun–Earth L5", summary: "Sun–Earth L5 trails Earth in its orbit by 60 degrees, about 150 million kilometres away. No spacecraft has been stationed there; STEREO-B and Hayabusa2 passed through the region on other missions." },
  };

  function openPointCardFromData(point) {
    const info = POINT_INFO[point];
    if (!info) return;
    selected = point;
    selectedKind = "point";
    const col = COLORS[point] || 0x9aa3bf;
    const hex = "#" + col.toString(16).padStart(6, "0");
    const here = (lastSnap ? lastSnap.occupying.filter((r) => r.point === point) : []).map((r) => r.name);
    const nowLine = here.length ? here.join(", ") : "None at this date.";
    panel.innerHTML =
      '<div class="sheet-handle" aria-hidden="true"><span class="sheet-grip"></span></div>' +
      '<div class="panel-head"><span class="dot" style="background:' + hex + ';color:' + hex + '"></span><h2>' + escapeHtml(info.name) + '</h2><button class="close" type="button" aria-label="Close">&times;</button></div>' +
      '<dl>' + row("Designation", point) + row("At this date", nowLine) + "</dl>" +
      '<p class="facts">' + escapeHtml(info.summary) + "</p>" +
      (COLORS[point] ? '<button class="zoom-btn" type="button" data-fly="' + point + '">View ' + point + "</button>" : "");
    panel.hidden = false;
    document.body.classList.add("lg-panel-open");
    panel.querySelector(".close").addEventListener("click", closePanel);
    const zb = panel.querySelector("[data-fly]");
    if (zb) zb.addEventListener("click", () => startFly(point));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const scHits = [];
    for (const m of missions) {
      const o = scObj[m.id];
      if (!o.group.visible) continue;
      const hs = raycaster.intersectObject(o.hit, false);
      if (hs.length) scHits.push({ dist: hs[0].distance, id: m.id });
    }
    scHits.sort((a, b) => a.dist - b.dist);
    if (scHits.length) return { kind: "sc", id: scHits[0].id };
    const ptHits = [];
    for (const p of ["SE-L1", "SE-L2", "EM-L1", "EM-L2"]) {
      if (!markers[p].visible) continue;
      const hs = raycaster.intersectObject(markers[p], true);
      if (hs.length) ptHits.push({ dist: hs[0].distance, id: p });
    }
    for (const p of ["SE-L3", "SE-L4", "SE-L5"]) {
      if (!farMarkers[p].visible) continue;
      const hs = raycaster.intersectObject(farMarkers[p], true);
      if (hs.length) ptHits.push({ dist: hs[0].distance, id: p });
    }
    ptHits.sort((a, b) => a.dist - b.dist);
    if (ptHits.length) return { kind: "point", id: ptHits[0].id };
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    pointerDown = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointerDown && (Math.abs(e.clientX - pointerDown.x) > 6 || Math.abs(e.clientY - pointerDown.y) > 6)) {
      pointerDown.moved = true;
    }
    const h = pick(e.clientX, e.clientY);
    if (h && !pointerDown) {
      canvas.classList.add("over");
      const name = h.kind === "sc" ? (missions.find((m) => m.id === h.id) || {}).name : (POINT_INFO[h.id] || {}).name;
      if (name) {
        tip.hidden = false;
        tip.textContent = name;
        tip.style.left = e.clientX + "px";
        tip.style.top = e.clientY + "px";
      }
    } else {
      canvas.classList.remove("over");
      tip.hidden = true;
    }
  });
  function pointerEnd(e) {
    const p = pointerDown;
    pointerDown = null;
    tip.hidden = true;
    if (!p || p.moved) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) return;
    const h = pick(e.clientX, e.clientY);
    if (!h) { closePanel(); return; }
    if (h.kind === "sc") openScCard(h.id);
    else openPointCardFromData(h.id);
  }
  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", () => { pointerDown = null; });
  canvas.addEventListener("pointerleave", () => { tip.hidden = true; canvas.classList.remove("over"); });

  /* ----- animation ----- */
  if (loading) loading.hidden = true;

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    frames++;
    if (!reduced) clockT += dt;
    if (playing) {
      if (u < 1) {
        u += dt / AUTOPLAY_SEC;
        if (u >= 1) {
          u = 1;
          mjd = tEnd;
          holdUntil = ts + HOLD_MS;
        } else {
          mjd = uToMjd(u);
        }
        refreshClock();
      } else if (ts >= holdUntil) {
        playing = false;
        playBtn.classList.add("paused");
        playBtn.setAttribute("aria-label", "Play");
      }
    }
    tickFly(ts);
    controls.update();
    updateScene(dt);
    renderer.render(scene, camera);
  }

  refreshClock();
  updateScene(0);
  requestAnimationFrame(frame);

  /* ----- test hook ----- */
  window.__lg = {
    get frames() { return frames; },
    get playing() { return playing; },
    get date() { return mjdToDate(mjd).toISOString().slice(0, 10); },
    get mjd() { return mjd; },
    get u() { return mjdToU(mjd); },
    autoplaySeconds: AUTOPLAY_SEC,
    reduced,
    get occupying() {
      const P = lastSnap || snapshot(mjd);
      return P.occupying.map((r) => ({ id: r.id, name: r.name, point: r.point }));
    },
    get transferring() {
      const P = lastSnap || snapshot(mjd);
      return P.transferring.map((r) => r.id);
    },
    get launched() {
      const P = lastSnap || snapshot(mjd);
      return P.launched.slice();
    },
    counts(iso) {
      const P = snapshot(isoToMjd(iso));
      const by = { "SE-L1": [], "SE-L2": [], "EM-L1": [], "EM-L2": [] };
      for (const r of P.occupying) if (by[r.point]) by[r.point].push(r.id);
      return {
        date: iso,
        occupying: P.occupying.length,
        transferring: P.transferring.length,
        launched: P.launched.length,
        byPoint: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])),
        ids: by,
        names: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.map((id) => (missions.find((m) => m.id === id) || {}).name)])),
      };
    },
    setDate(iso) {
      mjd = isoToMjd(iso);
      u = mjdToU(mjd);
      playing = false;
      playBtn.classList.add("paused");
      refreshClock();
      updateScene(0);
    },
    setU(v) {
      u = Math.max(0, Math.min(1, v));
      mjd = uToMjd(u);
      playing = false;
      playBtn.classList.add("paused");
      refreshClock();
      updateScene(0);
    },
    play() { setPlaying(true); },
    pause() { setPlaying(false); },
    flyTo: startFly,
    openCard: openScCard,
    openPoint: openPointCardFromData,
    closeCard: closePanel,
    get cardOpen() { return !panel.hidden; },
    get cardId() { return selected; },
    playbackSec,
    compactSample() {
      return {
        gap1982to1994: playbackSec(isoToMjd("1982-06-10"), isoToMjd("1994-11-01")),
        realGapYears: (isoToMjd("1994-11-01") - isoToMjd("1982-06-10")) / 365.25,
        transferISEE3: playbackSec(isoToMjd("1978-08-12"), isoToMjd("1978-11-20")),
        transferJWST: playbackSec(isoToMjd("2021-12-25"), isoToMjd("2022-01-24")),
        autoplay: AUTOPLAY_SEC,
      };
    },
    missions: missions.map((m) => m.id),
    get view() { return activeView; },
  };
}
