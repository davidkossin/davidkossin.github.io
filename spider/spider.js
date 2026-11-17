(function () {
  const TOTAL = 191;
  const thumbs = Array.from(document.querySelectorAll(".thumb"));
  const lightbox = document.getElementById("lightbox");
  const image = document.getElementById("lightbox-image");
  const counter = document.getElementById("lightbox-counter");
  const btnClose = lightbox.querySelector(".lb-close");
  const btnPrev = lightbox.querySelector(".lb-prev");
  const btnNext = lightbox.querySelector(".lb-next");

  let index = 0;
  let lastFocus = null;
  let fadeTimer = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function largeSrc(i) {
    const n = String(i + 1).padStart(3, "0");
    return "images/large/" + n + ".webp";
  }

  function setCaption(i) {
    const n = i + 1;
    counter.textContent = n + " / " + TOTAL;
    image.alt = "1977 Alfa Romeo Spider, photo " + n + " of " + TOTAL;
  }

  function showImage(i, { fade } = { fade: true }) {
    index = (i + TOTAL) % TOTAL;
    const src = largeSrc(index);
    setCaption(index);

    const apply = function () {
      image.src = src;
      image.classList.remove("is-fading");
    };

    if (!fade || reduceMotion || lightbox.hidden) {
      apply();
      return;
    }

    window.clearTimeout(fadeTimer);
    image.classList.add("is-fading");
    fadeTimer = window.setTimeout(apply, 180);
  }

  function openAt(i) {
    lastFocus = document.activeElement;
    showImage(i, { fade: false });
    lightbox.hidden = false;
    requestAnimationFrame(function () {
      lightbox.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
    btnClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    const hide = function () {
      if (!lightbox.classList.contains("is-open")) {
        lightbox.hidden = true;
        image.removeAttribute("src");
      }
    };
    if (reduceMotion) hide();
    else window.setTimeout(hide, 350);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  thumbs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      openAt(Number(btn.dataset.index));
    });
  });

  btnClose.addEventListener("click", closeLightbox);
  btnPrev.addEventListener("click", function () {
    showImage(index - 1);
  });
  btnNext.addEventListener("click", function () {
    showImage(index + 1);
  });

  lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", function (event) {
    if (lightbox.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showImage(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      showImage(index - 1);
    }
  });

  lightbox.addEventListener("touchstart", function (event) {
    if (event.touches.length !== 1) return;
    touchActive = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  lightbox.addEventListener("touchend", function (event) {
    if (!touchActive || event.changedTouches.length !== 1) return;
    touchActive = false;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) showImage(index + 1);
    else showImage(index - 1);
  }, { passive: true });

  lightbox.addEventListener("touchcancel", function () {
    touchActive = false;
  });
})();
