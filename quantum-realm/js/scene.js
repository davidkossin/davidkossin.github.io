/**
 * Shared Three.js helpers: renderer setup, animation loop, dispose, reduced motion.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function prefersReducedMotion() {
  return typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createSceneHost(container, opts = {}) {
  const width = () => container.clientWidth || 640;
  const height = () => container.clientHeight || 400;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background ?? 0x07091a);

  const camera = new THREE.PerspectiveCamera(
    opts.fov ?? 45,
    width() / height(),
    opts.near ?? 0.05,
    opts.far ?? 200
  );
  camera.position.set(
    opts.camX ?? 0,
    opts.camY ?? 1.2,
    opts.camZ ?? 4
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height(), false);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.setAttribute("role", "img");
  container.appendChild(renderer.domElement);

  let controls = null;
  if (opts.orbit !== false) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !prefersReducedMotion();
    controls.dampingFactor = 0.08;
    controls.target.set(opts.targetX ?? 0, opts.targetY ?? 0, opts.targetZ ?? 0);
    if (opts.minDistance) controls.minDistance = opts.minDistance;
    if (opts.maxDistance) controls.maxDistance = opts.maxDistance;
    controls.update();
  }

  const light = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(light);
  const dir = new THREE.DirectionalLight(0xbcd7ff, 0.85);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  let raf = 0;
  let running = true;
  let onTick = null;
  const reduced = prefersReducedMotion();

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onResize = () => {
    const w = width();
    const h = Math.max(1, height());
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  };
  window.addEventListener("resize", onResize);

  function frame(t) {
    raf = 0;
    if (!running) return;
    if (controls && controls.enableDamping) controls.update();
    if (onTick) onTick(t);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    running = true;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  startLoop();
  // One static frame if reduced motion and caller never animates heavily
  if (reduced) {
    // still loop at low cost for interaction; demos may freeze simulators
  }

  return {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    reduced,
    setTick(fn) {
      onTick = fn;
    },
    resize: onResize,
    dispose() {
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      if (controls) controls.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}

/** Simple UI helpers for demo panels */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function bindRange(input, onChange) {
  const fire = () => onChange(parseFloat(input.value));
  input.addEventListener("input", fire);
  fire();
}
