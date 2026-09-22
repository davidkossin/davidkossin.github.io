(function () {
  const canvas = document.getElementById("stars");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const stars = [];
  const STAR_COUNT = 160;
  let width = 0;
  let height = 0;
  let raf = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random() * 0.7 + 0.2,
        tw: Math.random() * Math.PI * 2,
        sp: 0.004 + Math.random() * 0.01,
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const pulse = 0.55 + 0.45 * Math.sin(t * s.sp + s.tw);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(232, 236, 255," + (s.a * pulse) + ")";
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function start() {
    cancelAnimationFrame(raf);
    resize();
    seed();
    if (reduce.matches) {
      draw(0);
      cancelAnimationFrame(raf);
      return;
    }
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", start);
  reduce.addEventListener("change", start);
  start();
})();
