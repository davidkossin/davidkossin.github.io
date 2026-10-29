/* Escape Velocity — Objects In Space
   Launch Library 2 data + illustrated vehicle graphics */

(function () {
  "use strict";

  const DATA_URL = "./data/launches.json";
  const LIVE_URL =
    "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=30&mode=detailed";
  const CACHE_KEY = "ev-launches-v1";
  const CACHE_TTL_MS = 30 * 60 * 1000;

  const VEHICLE_HEIGHT_M = {
    falcon9: 70,
    falconheavy: 70,
    starship: 121,
    electron: 18,
    neutron: 43,
    vulcan: 61.6,
    atlasv: 58.3,
    newglenn: 98,
    ariane6: 63,
    vegac: 35,
    h3: 57,
    pslv: 44,
    gslv: 49.1,
    lvm3: 43.4,
    longmarch: 57,
    soyuz: 46.1,
    generic: 50,
  };

  /** @type {any[]} */
  let launches = [];
  /** @type {number|null} */
  let tickTimer = null;
  /** @type {number|null} */
  let animRaf = null;
  let featuredAnimT = 0;
  /** @type {number|null} ms override from ?now= ISO */
  let clockOffsetMs = null; // added to Date.now when set via absolute override
  let clockFixedMs = null;  // absolute "now" if ?now= provided
  let forceLiftoffDemo = false;
  let liftoffStartMs = null; // when liftoff anim began
  const LIFTOFF_ANIM_MS = 16000;
  const FEATURED_HOLD_MS = 15 * 60 * 1000;

  function parseClockParams() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("liftoff") === "1" || q.get("liftoff") === "true") {
        forceLiftoffDemo = true;
      }
      const nowParam = q.get("now");
      if (nowParam) {
        const t = Date.parse(nowParam);
        if (!Number.isNaN(t)) clockFixedMs = t;
      }
    } catch (_) {}
  }

  function nowMs() {
    if (clockFixedMs != null) return clockFixedMs;
    return Date.now();
  }

  function liftoffProgressFor(launch, now) {
    if (!launch || !launch.net) return 0;
    const status = (launch.status || "").toLowerCase();
    // Don't animate for hold / scrub / TBD
    if (/hold|scrub|to be determined|^tbd$/.test(status)) return 0;
    if (forceLiftoffDemo) {
      if (liftoffStartMs == null) liftoffStartMs = now;
      return Math.min(1, (now - liftoffStartMs) / LIFTOFF_ANIM_MS);
    }
    const net = new Date(launch.net).getTime();
    if (Number.isNaN(net)) return 0;
    // Only liftoff path for Go / TBC / in flight / success / unknown go-ish
    const allow =
      !status ||
      /go|to be confirmed|^tbc$|in flight|success|liftoff/.test(status) ||
      status.indexOf("go") === 0;
    if (!allow) return 0;
    if (now < net) return 0;
    const elapsed = now - net;
    if (elapsed >= LIFTOFF_ANIM_MS) return 1;
    return elapsed / LIFTOFF_ANIM_MS;
  }

  function isStillFeaturedWindow(launch, now) {
    if (!launch || !launch.net) return false;
    const net = new Date(launch.net).getTime();
    if (Number.isNaN(net)) return true;
    return now < net + FEATURED_HOLD_MS;
  }

  function selectFeaturedAndUpcoming(list, now) {
    const sorted = list.slice().sort((a, b) => {
      const ta = a.net ? new Date(a.net).getTime() : Infinity;
      const tb = b.net ? new Date(b.net).getTime() : Infinity;
      return ta - tb;
    });
    // Keep launches until NET+15m in the active set
    const active = sorted.filter((L) => isStillFeaturedWindow(L, now));
    const pool = active.length ? active : sorted;
    return { featured: pool[0] || null, upcoming: pool.slice(1) };
  }

  parseClockParams();

  const els = {
    status: document.getElementById("data-status"),
    featured: document.getElementById("featured"),
    canvas: document.getElementById("featured-canvas"),
    scale: document.getElementById("vehicle-scale"),
    kicker: document.getElementById("featured-kicker"),
    statusPill: document.getElementById("featured-status"),
    vandy: document.getElementById("featured-vandy"),
    title: document.getElementById("featured-title"),
    when: document.getElementById("featured-when"),
    countdown: document.getElementById("featured-countdown"),
    missionDesc: document.getElementById("featured-mission-desc"),
    vehicleDesc: document.getElementById("featured-vehicle-desc"),
    meta: document.getElementById("featured-meta"),
    webcast: document.getElementById("featured-webcast"),
    grid: document.getElementById("launch-grid"),
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const FAMILY_MAP = {
    "falcon9": "falcon9",
    "falcon-heavy": "falconheavy",
    "falconheavy": "falconheavy",
    "starship": "starship",
    "electron": "electron",
    "neutron": "neutron",
    "vulcan": "vulcan",
    "atlas5": "atlasv",
    "atlasv": "atlasv",
    "new-glenn": "newglenn",
    "newglenn": "newglenn",
    "ariane6": "ariane6",
    "vega": "vegac",
    "vegac": "vegac",
    "h3": "h3",
    "pslv": "pslv",
    "gslv": "gslv",
    "lvm3": "lvm3",
    "long-march": "longmarch",
    "longmarch": "longmarch",
    "soyuz": "soyuz",
    "generic": "generic",
  };

  function normalizeLaunch(raw) {
    if (!raw) return null;
    // Already flat (live trim) or nested (bundled JSON)
    if (raw.vehicle_key || typeof raw.vehicle === "string") {
      const key = FAMILY_MAP[raw.vehicle_key] || FAMILY_MAP[guessKey(raw.vehicle)] || "generic";
      return {
        id: raw.id,
        name: raw.name,
        net: raw.net,
        window_start: raw.window_start,
        window_end: raw.window_end,
        status: raw.status || "",
        status_abbrev: raw.status_abbrev || raw.status || "",
        provider: raw.provider || "",
        vehicle: raw.vehicle || "",
        vehicle_key: key,
        vehicle_description: raw.vehicle_description || "",
        mission_name: raw.mission_name || "",
        mission_description: raw.mission_description || "",
        orbit: raw.orbit || "",
        pad: raw.pad || "",
        location: raw.location || "",
        webcast: raw.webcast || "",
        vandenberg: raw.vandenberg === true || isVandenbergLoc(raw.location, raw.pad),
      };
    }
    const st = raw.status || {};
    const veh = raw.vehicle || {};
    const mis = raw.mission || {};
    const pad = raw.pad || {};
    const family = FAMILY_MAP[veh.family] || FAMILY_MAP[guessKey(veh.name)] || "generic";
    const webcast =
      (raw.webcasts && raw.webcasts[0] && raw.webcasts[0].url) || "";
    return {
      id: raw.id,
      name: raw.name,
      net: raw.net,
      window_start: raw.window_start,
      window_end: raw.window_end,
      status: st.name || "",
      status_abbrev: st.abbrev || st.name || "",
      provider: raw.provider || "",
      vehicle: veh.name || "",
      vehicle_key: family,
      vehicle_description: veh.description || "",
      mission_name: mis.name || "",
      mission_description: mis.description || "",
      orbit: mis.orbit || "",
      pad: pad.name || "",
      location: pad.location || "",
      webcast,
      vandenberg: raw.vandenberg === true || isVandenbergLoc(pad.location, pad.name),
    };
  }

  function isVandenbergLoc(location, pad) {
    const loc = String(location || "").toLowerCase();
    const p = String(pad || "").toLowerCase();
    // Only pad/location fields — never mission name, webcast title, or description
    return /\bvandenberg\b|\bvafb\b|vandenberg space force/.test(loc + " " + p);
  }

  function isVandenberg(launch) {
    return !!(launch && launch.vandenberg);
  }

  function statusClass(status) {
    const s = (status || "").toLowerCase();
    if (s === "go" || s.indexOf("go for") === 0) return "go";
    if (s === "to be confirmed" || s === "tbc") return "tbc";
    if (s === "to be determined" || s === "tbd") return "tbd";
    if (s === "hold") return "hold";
    if (s === "in flight") return "in-flight";
    if (s === "success" || s === "partial failure") return "success";
    if (s === "failure") return "failure";
    return "";
  }

  function formatLocal(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return iso;
    }
  }

  function formatEta(ms) {
    const past = ms < 0;
    const abs = Math.abs(ms);
    const totalSec = Math.floor(abs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (d > 0) return `${past ? "−" : ""}${d}d ${h}h`;
    if (h > 0) return `${past ? "−" : ""}${h}h ${m}m`;
    return `${past ? "−" : ""}${m}m`;
  }

  function formatCountdown(launch, now) {
    const net = launch.net ? new Date(launch.net).getTime() : NaN;
    if (Number.isNaN(net)) return "NET TBD";
    const status = (launch.status || "").toLowerCase();
    const diff = net - now;

    if (status === "in flight") return "T+ In flight";
    if (status === "success") return "Liftoff — success";
    if (status === "failure") return "Liftoff — failure";
    if (status === "hold") {
      const base = diff > 0 ? formatTMinus(diff) : "HOLD";
      return `HOLD · ${base}`;
    }

    if (diff > 0) {
      const prefix =
        status === "to be determined" || status === "tbd"
          ? "NET "
          : status === "to be confirmed" || status === "tbc"
            ? "TBC "
            : "";
      return prefix + formatTMinus(diff);
    }
    return "T+ " + formatTPlus(-diff);
  }

  function formatTMinus(ms) {
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (d > 0) return `T− ${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    return `T− ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function formatTPlus(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  /* ---------- Rocket drawing ---------- */

  /* ---------- Rocket drawing (accurate silhouettes) ---------- */

  /** Approximate real heights (m) for scale bar + relative drawing */
  const VEHICLE_HEIGHT_M_DRAW = {
    falcon9: 70,
    falconheavy: 70,
    starship: 121,
    electron: 18,
    neutron: 43,
    vulcan: 61.6,
    atlasv: 58.3,
    newglenn: 98,
    ariane6: 63,
    vegac: 35,
    h3: 57,
    pslv: 44,
    gslv: 49.1,
    lvm3: 43.4,
    longmarch: 57,
    soyuz: 46.1,
    generic: 50,
  };

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  /**
   * opts: { anim, mini, name, liftoffProgress 0..1, liftoffActive, nowMs }
   * liftoffProgress: 0 at pad, 1 fully off-screen
   */
  function drawRocket(ctx, w, h, key, opts) {
    opts = opts || {};
    const anim = opts.anim || 0;
    const mini = !!opts.mini;
    const reduced = prefersReducedMotion();
    const lift = Math.max(0, Math.min(1, opts.liftoffProgress || 0));
    const name = opts.name || "";

    ctx.clearRect(0, 0, w, h);

    // Sky
    if (!mini) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#03040a");
      g.addColorStop(0.45, "#0a1024");
      g.addColorStop(0.78, "#141c32");
      g.addColorStop(1, "#1a2238");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Slow starfield — ~8x slower than before; twinkle only if motion OK
      const drift = reduced ? 0 : anim * 0.35;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 97 + drift * 0.15) % w + w) % w;
        const sy = ((i * 53 + drift * 0.04) % (h * 0.78));
        const tw = reduced
          ? 0.75
          : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(anim * 0.008 + i * 1.7));
        const r = (i % 5 === 0 ? 1.15 : 0.65) * tw;
        ctx.globalAlpha = 0.35 + tw * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "rgba(5,6,15,0.15)";
      ctx.fillRect(0, 0, w, h);
    }

    const cx = w * 0.5;
    const groundY = mini ? h * 0.92 : h * 0.88;
    // Scale rocket so tallest (Starship ~121m) fits; others proportional
    const refH = 121;
    const realH = VEHICLE_HEIGHT_M_DRAW[key] || VEHICLE_HEIGHT_M_DRAW.generic;
    const maxRocketPx = mini ? h * 0.78 : h * 0.7;
    const rocketH = maxRocketPx * (realH / refH);
    // Liftoff: translate upward with ease-in acceleration
    const liftPx = lift > 0 ? Math.pow(lift, 1.65) * (h * 1.15) : 0;
    const baseY = groundY - (mini ? 2 : 8) - liftPx;

    if (!mini) {
      // Pad glow
      const padG = ctx.createRadialGradient(cx, groundY, 4, cx, groundY, w * 0.4);
      padG.addColorStop(0, lift > 0 ? `rgba(251,146,60,${0.45 + lift * 0.35})` : "rgba(251,146,60,0.28)");
      padG.addColorStop(0.45, "rgba(99,102,241,0.1)");
      padG.addColorStop(1, "transparent");
      ctx.fillStyle = padG;
      ctx.fillRect(0, groundY - 50, w, 90);

      // Pad deck
      ctx.fillStyle = "rgba(70,80,110,0.65)";
      ctx.fillRect(cx - w * 0.2, groundY - 3, w * 0.4, 7);
      ctx.fillStyle = "rgba(35,42,65,0.8)";
      ctx.fillRect(cx - w * 0.16, groundY + 4, w * 0.32, 5);

      // Tower (simple)
      ctx.strokeStyle = "rgba(148,163,184,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.14, groundY);
      ctx.lineTo(cx + w * 0.14, groundY - rocketH * 0.85);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const ty = groundY - (rocketH * 0.85 * i) / 5;
        ctx.beginPath();
        ctx.moveTo(cx + w * 0.14, ty);
        ctx.lineTo(cx + w * 0.1, ty + 8);
        ctx.stroke();
      }

      // Ambient vapor
      if (lift < 0.85) {
        for (let i = 0; i < 6; i++) {
          const vx = cx + Math.sin((reduced ? 0 : anim) * 0.012 + i * 1.1) * (20 + i * 10);
          const vy = groundY - 8 - i * 5 - lift * 30;
          const vr = 12 + i * 5;
          ctx.fillStyle = `rgba(200,220,255,${0.05 + i * 0.015})`;
          ctx.beginPath();
          ctx.ellipse(vx, vy, vr * (1 + lift), vr * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Exhaust / plume during liftoff
    if (!mini && lift > 0 && lift < 1) {
      drawExhaust(ctx, cx, Math.min(baseY + rocketH * 0.02, groundY - 2), rocketH, lift, anim);
      // Billowing smoke at pad
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI - Math.PI / 2;
        const dist = 18 + lift * 70 + i * 6;
        const sx = cx + Math.cos(ang) * dist * (0.4 + lift);
        const sy = groundY - 5 + Math.sin(anim * 0.02 + i) * 4;
        ctx.fillStyle = `rgba(180,190,210,${0.12 * (1 - lift)})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 22 + i * 3, 10 + i, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const drawer = DRAWERS[key] || DRAWERS.generic;
    if (lift < 0.98 || mini) {
      drawer(ctx, cx, baseY, rocketH, anim, mini, name, lift);
    }

    if (!mini && lift < 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(
        cx,
        baseY - rocketH * 0.45,
        4,
        cx,
        baseY - rocketH * 0.45,
        rocketH * 0.35
      );
      glow.addColorStop(0, "rgba(125,211,252,0.1)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Liftoff caption
    if (!mini && lift > 0.05 && lift < 0.95) {
      ctx.fillStyle = "rgba(253,186,116,0.95)";
      ctx.font = '600 13px "Orbitron", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("LIFTOFF", cx, 28);
    }
  }

  function drawExhaust(ctx, cx, y, H, lift, anim) {
    const len = H * (0.15 + lift * 0.9);
    const plume = ctx.createLinearGradient(cx, y, cx, y + len);
    plume.addColorStop(0, "rgba(255,255,255,0.95)");
    plume.addColorStop(0.15, "rgba(253,224,71,0.9)");
    plume.addColorStop(0.4, "rgba(251,146,60,0.75)");
    plume.addColorStop(0.7, "rgba(239,68,68,0.35)");
    plume.addColorStop(1, "transparent");
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(cx - 8, y);
    ctx.quadraticCurveTo(cx - 18 - lift * 10, y + len * 0.4, cx - 6, y + len);
    ctx.quadraticCurveTo(cx, y + len * 1.05, cx + 6, y + len);
    ctx.quadraticCurveTo(cx + 18 + lift * 10, y + len * 0.4, cx + 8, y);
    ctx.closePath();
    ctx.fill();
    // Core
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(cx - 3, y);
    ctx.lineTo(cx - 2, y + len * 0.45);
    ctx.lineTo(cx + 2, y + len * 0.45);
    ctx.lineTo(cx + 3, y);
    ctx.closePath();
    ctx.fill();
  }

  function bodyGrad(ctx, x0, y0, x1, y1, c1, c2) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c1);
    g.addColorStop(0.5, c2);
    g.addColorStop(1, c1);
    return g;
  }

  function cyl(ctx, cx, top, bot, half, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx - half, top);
    ctx.lineTo(cx + half, top);
    ctx.lineTo(cx + half, bot);
    ctx.lineTo(cx - half, bot);
    ctx.closePath();
    ctx.fill();
  }

  function nose(ctx, cx, tipY, baseY, half, color) {
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.bezierCurveTo(cx + half * 0.15, tipY, cx + half, tipY + (baseY - tipY) * 0.55, cx + half, baseY);
    ctx.lineTo(cx - half, baseY);
    ctx.bezierCurveTo(cx - half, tipY + (baseY - tipY) * 0.55, cx - half * 0.15, tipY, cx, tipY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function ogive(ctx, cx, tipY, baseY, half, color) {
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.quadraticCurveTo(cx + half * 1.05, tipY + (baseY - tipY) * 0.7, cx + half, baseY);
    ctx.lineTo(cx - half, baseY);
    ctx.quadraticCurveTo(cx - half * 1.05, tipY + (baseY - tipY) * 0.7, cx, tipY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function panelLines(ctx, cx, top, bot, half, n, color) {
    ctx.strokeStyle = color || "rgba(15,23,42,0.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i < n; i++) {
      const y = top + ((bot - top) * i) / n;
      ctx.beginPath();
      ctx.moveTo(cx - half + 1, y);
      ctx.lineTo(cx + half - 1, y);
      ctx.stroke();
    }
  }

  function engineBell(ctx, cx, y, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, y);
    ctx.quadraticCurveTo(cx - r * 1.05, y + r * 0.55, cx - r, y + r * 1.15);
    ctx.lineTo(cx + r, y + r * 1.15);
    ctx.quadraticCurveTo(cx + r * 1.05, y + r * 0.55, cx + r * 0.45, y);
    ctx.closePath();
    ctx.fillStyle = color || "#57534e";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
  }

  function gridFin(ctx, x, y, w, h, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 4, 0);
      ctx.lineTo((w * i) / 4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (h * i) / 4);
      ctx.lineTo(w, (h * i) / 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function landingLegs(ctx, cx, y, half, len) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    // Folded-ish along body then out
    ctx.beginPath();
    ctx.moveTo(cx - half * 0.9, y - len * 0.3);
    ctx.lineTo(cx - half - len * 0.35, y + len * 0.55);
    ctx.lineTo(cx - half - len * 0.7, y + len);
    ctx.moveTo(cx + half * 0.9, y - len * 0.3);
    ctx.lineTo(cx + half + len * 0.35, y + len * 0.55);
    ctx.lineTo(cx + half + len * 0.7, y + len);
    ctx.stroke();
    // Feet
    ctx.fillStyle = "#64748b";
    ctx.fillRect(cx - half - len * 0.85, y + len - 2, len * 0.35, 3);
    ctx.fillRect(cx + half + len * 0.5, y + len - 2, len * 0.35, 3);
  }

  function srb(ctx, cx, top, bot, half, noseColor, bodyColor) {
    ogive(ctx, cx, top - (bot - top) * 0.08, top, half, noseColor || "#f1f5f9");
    cyl(ctx, cx, top, bot, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, bodyColor || "#e2e8f0", "#94a3b8"));
    engineBell(ctx, cx, bot, half * 0.75, "#44403c");
  }

  function parseAtlasSrbs(name) {
    // Atlas V 401 = 0 SRBs, 411=1, ... 551=5
    const m = String(name || "").match(/atlas\s*v\s*(\d)(\d)(\d)/i);
    if (!m) return 0;
    return parseInt(m[2], 10) || 0;
  }

  function parseArianeBoosters(name) {
    if (/ariane\s*64|a64/i.test(name || "")) return 4;
    if (/ariane\s*62|a62/i.test(name || "")) return 2;
    return 2;
  }

  function parseVulcanSrbs(name) {
    const m = String(name || "").match(/vc\s*([246])/i) || String(name || "").match(/vulcan.*?(\d)\s*s/i);
    if (m) return parseInt(m[1], 10);
    if (/vc4|4s/i.test(name || "")) return 4;
    if (/vc6|6s/i.test(name || "")) return 6;
    return 2;
  }

  function longMarchVariant(name) {
    const n = String(name || "").toLowerCase();
    if (/long\s*march\s*5|cz[- ]?5|chang zheng 5/.test(n)) return "lm5";
    if (/long\s*march\s*7|cz[- ]?7/.test(n)) return "lm7";
    if (/long\s*march\s*3|cz[- ]?3/.test(n)) return "lm3";
    if (/long\s*march\s*2|cz[- ]?2/.test(n)) return "lm2";
    if (/long\s*march\s*8|cz[- ]?8/.test(n)) return "lm8";
    if (/long\s*march\s*12|cz[- ]?12/.test(n)) return "lm12";
    return "lm3";
  }

  const DRAWERS = {
    falcon9(ctx, cx, base, H, anim, mini, name) {
      // Real: ~70×3.7 m — white stages, black interstage, octaweb, grid fins, legs
      const half = H * (3.7 / 70) * 0.5; // radius in px
      const tip = base - H;
      const fairingBot = tip + H * 0.18;
      const s2bot = tip + H * 0.32;
      const interTop = s2bot;
      const interBot = tip + H * 0.36;
      // Fairing (white ogive, two halves seam)
      ogive(ctx, cx, tip, fairingBot, half * 1.02, "#f8fafc");
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.beginPath();
      ctx.moveTo(cx, tip + 2);
      ctx.lineTo(cx, fairingBot);
      ctx.stroke();
      // S2 white
      cyl(ctx, cx, fairingBot, interTop, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f1f5f9", "#cbd5e1"));
      panelLines(ctx, cx, fairingBot, interTop, half, 3);
      // Black interstage
      cyl(ctx, cx, interTop, interBot, half * 1.02, "#0f172a");
      // S1 white
      cyl(ctx, cx, interBot, base - H * 0.055, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#e2e8f0", "#94a3b8"));
      panelLines(ctx, cx, interBot, base - H * 0.055, half, 6, "rgba(15,23,42,0.15)");
      // Dark raceway / conduit
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx + half * 0.55, interBot, half * 0.22, H * 0.5);
      // SpaceX chevron-ish mark (simple dark band — not a logo)
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.35, tip + H * 0.42);
      ctx.lineTo(cx, tip + H * 0.4);
      ctx.lineTo(cx + half * 0.35, tip + H * 0.42);
      ctx.lineTo(cx + half * 0.35, tip + H * 0.48);
      ctx.lineTo(cx, tip + H * 0.46);
      ctx.lineTo(cx - half * 0.35, tip + H * 0.48);
      ctx.closePath();
      ctx.fill();
      // Grid fins (deployed look, gray)
      const finY = tip + H * 0.38;
      gridFin(ctx, cx - half - H * 0.035, finY, H * 0.032, H * 0.045, false);
      gridFin(ctx, cx + half, finY, H * 0.032, H * 0.045, true);
      // Landing legs folded
      if (!mini) landingLegs(ctx, cx, base - H * 0.08, half, H * 0.055);
      // Octaweb / engines (show 3 of 9 in silhouette)
      for (let i = -1; i <= 1; i++) {
        engineBell(ctx, cx + i * half * 0.55, base - H * 0.055, half * 0.32, "#57534e");
      }
    },

    falconheavy(ctx, cx, base, H, anim, mini, name) {
      const half = H * (3.7 / 70) * 0.5;
      const tip = base - H;
      const off = half * 2.15;
      // Side boosters with nose cones (no fairing)
      for (const sx of [cx - off, cx + off]) {
        ogive(ctx, sx, tip + H * 0.16, tip + H * 0.28, half * 0.95, "#e2e8f0");
        cyl(ctx, sx, tip + H * 0.28, tip + H * 0.36, half * 0.95, "#0f172a");
        cyl(ctx, sx, tip + H * 0.36, base - H * 0.055, half * 0.95, bodyGrad(ctx, sx - half, 0, sx + half, 0, "#e2e8f0", "#94a3b8"));
        if (!mini) landingLegs(ctx, sx, base - H * 0.08, half * 0.95, H * 0.05);
        engineBell(ctx, sx, base - H * 0.055, half * 0.45, "#57534e");
      }
      DRAWERS.falcon9(ctx, cx, base, H, anim, true, name);
      if (!mini) landingLegs(ctx, cx, base - H * 0.08, half, H * 0.055);
    },

    starship(ctx, cx, base, H, anim, mini, name) {
      // Super Heavy + Starship — stainless, flaps, hot-staging ring
      const half = H * (9 / 121) * 0.5;
      const tip = base - H;
      const shipBot = tip + H * (50 / 121); // ship ~50m of 121
      const ringTop = shipBot;
      const ringBot = shipBot + H * 0.02;
      const steel = bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f8fafc", "#94a3b8");
      const steelDark = bodyGrad(ctx, cx - half, 0, cx + half, 0, "#e2e8f0", "#64748b");
      // Ship nose
      ogive(ctx, cx, tip, tip + H * 0.08, half, "#e2e8f0");
      // Heat-tile belly hint (darker strip)
      cyl(ctx, cx, tip + H * 0.08, shipBot, half, steel);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - half, tip + H * 0.1, half * 0.35, shipBot - tip - H * 0.12);
      // Forward flaps
      ctx.fillStyle = "#64748b";
      ctx.fillRect(cx - half * 1.55, tip + H * 0.14, half * 0.55, H * 0.06);
      ctx.fillRect(cx + half, tip + H * 0.14, half * 0.55, H * 0.06);
      // Aft flaps on ship
      ctx.fillRect(cx - half * 1.65, shipBot - H * 0.08, half * 0.65, H * 0.07);
      ctx.fillRect(cx + half, shipBot - H * 0.08, half * 0.65, H * 0.07);
      // Hot-staging ring
      cyl(ctx, cx, ringTop, ringBot, half * 1.08, "#334155");
      // Super Heavy
      cyl(ctx, cx, ringBot, base - H * 0.04, half, steelDark);
      panelLines(ctx, cx, ringBot, base - H * 0.04, half, 8, "rgba(15,23,42,0.18)");
      // Grid fins on booster
      gridFin(ctx, cx - half - H * 0.03, tip + H * 0.55, H * 0.028, H * 0.04, false);
      gridFin(ctx, cx + half, tip + H * 0.55, H * 0.028, H * 0.04, true);
      // Raptor bells
      for (let i = -2; i <= 2; i++) {
        engineBell(ctx, cx + i * half * 0.35, base - H * 0.04, half * 0.22, "#57534e");
      }
    },

    electron(ctx, cx, base, H, anim, mini, name) {
      // ~18×1.2 m black carbon composite, Rutherford, small fins
      const half = H * (1.2 / 18) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.16, half * 1.05, "#e2e8f0");
      cyl(ctx, cx, tip + H * 0.16, tip + H * 0.42, half, "#0f172a");
      // Kick stage / green band accent (Rocket Lab teal-ish)
      ctx.fillStyle = "#2dd4bf";
      ctx.fillRect(cx - half, tip + H * 0.42, half * 2, H * 0.025);
      cyl(ctx, cx, tip + H * 0.445, base - H * 0.06, half * 0.98, "#020617");
      panelLines(ctx, cx, tip + H * 0.445, base - H * 0.06, half, 4, "rgba(45,212,191,0.15)");
      // Battery packs hint
      ctx.fillStyle = "#134e4a";
      ctx.fillRect(cx - half * 0.7, tip + H * 0.55, half * 1.4, H * 0.08);
      // Fins
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(cx - half, base - H * 0.14);
      ctx.lineTo(cx - half - half * 1.2, base - H * 0.02);
      ctx.lineTo(cx - half, base - H * 0.06);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + half, base - H * 0.14);
      ctx.lineTo(cx + half + half * 1.2, base - H * 0.02);
      ctx.lineTo(cx + half, base - H * 0.06);
      ctx.fill();
      engineBell(ctx, cx, base - H * 0.06, half * 0.7, "#64748b");
    },

    neutron(ctx, cx, base, H, anim, mini, name) {
      const half = H * (7 / 43) * 0.42;
      const tip = base - H;
      // Hungry Hippo fairing concept — wider upper
      ogive(ctx, cx, tip, tip + H * 0.2, half * 1.25, "#e2e8f0");
      cyl(ctx, cx, tip + H * 0.2, tip + H * 0.48, half * 1.15, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#cbd5e1", "#64748b"));
      ctx.fillStyle = "#2dd4bf";
      ctx.fillRect(cx - half * 1.15, tip + H * 0.48, half * 2.3, H * 0.02);
      cyl(ctx, cx, tip + H * 0.5, base - H * 0.06, half, "#0f172a");
      // Landing fins
      ctx.fillStyle = "#475569";
      ctx.fillRect(cx - half * 1.6, base - H * 0.2, half * 0.6, H * 0.12);
      ctx.fillRect(cx + half, base - H * 0.2, half * 0.6, H * 0.12);
      engineBell(ctx, cx, base - H * 0.06, half * 0.7, "#57534e");
    },

    vulcan(ctx, cx, base, H, anim, mini, name) {
      // Orange-tan BE-4 core, white Centaur, white GEM 63XL, wide fairing
      const half = H * (5.4 / 61.6) * 0.5;
      const tip = base - H;
      const nSrb = parseVulcanSrbs(name);
      ogive(ctx, cx, tip, tip + H * 0.16, half * 1.15, "#f8fafc"); // wide fairing
      // Centaur V (silver/white)
      cyl(ctx, cx, tip + H * 0.16, tip + H * 0.38, half * 0.85, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f1f5f9", "#94a3b8"));
      ctx.fillStyle = "#334155";
      ctx.fillRect(cx - half * 0.85, tip + H * 0.38, half * 1.7, H * 0.015);
      // Orange foam core (BE-4)
      cyl(ctx, cx, tip + H * 0.395, base - H * 0.07, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#fdba74", "#c2410c"));
      panelLines(ctx, cx, tip + H * 0.395, base - H * 0.07, half, 5, "rgba(69,26,3,0.2)");
      // GEM SRBs
      const positions = [];
      if (nSrb <= 2) positions.push(-1.85, 1.85);
      else if (nSrb <= 4) positions.push(-2.05, -1.15, 1.15, 2.05);
      else positions.push(-2.15, -1.3, -0.45, 0.45, 1.3, 2.15);
      positions.slice(0, nSrb).forEach((f) => {
        srb(ctx, cx + half * f, tip + H * 0.42, base - H * 0.05, half * 0.38, "#f8fafc", "#e2e8f0");
      });
      engineBell(ctx, cx - half * 0.4, base - H * 0.07, half * 0.4, "#44403c");
      engineBell(ctx, cx + half * 0.4, base - H * 0.07, half * 0.4, "#44403c");
    },

    atlasv(ctx, cx, base, H, anim, mini, name) {
      const half = H * (3.81 / 58.3) * 0.5;
      const tip = base - H;
      const nSrb = parseAtlasSrbs(name);
      ogive(ctx, cx, tip, tip + H * 0.17, half * 1.05, "#f8fafc");
      // Centaur
      cyl(ctx, cx, tip + H * 0.17, tip + H * 0.36, half * 0.88, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f1f5f9", "#94a3b8"));
      ctx.fillStyle = "#475569";
      ctx.fillRect(cx - half * 0.88, tip + H * 0.36, half * 1.76, H * 0.02);
      // Copper-orange RD-180 stage
      cyl(ctx, cx, tip + H * 0.38, base - H * 0.07, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#fb923c", "#9a3412"));
      panelLines(ctx, cx, tip + H * 0.38, base - H * 0.07, half, 4, "rgba(69,26,3,0.25)");
      const offs = [];
      for (let i = 0; i < nSrb; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2);
        offs.push(side * (1.7 + row * 0.15));
      }
      offs.forEach((f) => srb(ctx, cx + half * f, tip + H * 0.45, base - H * 0.05, half * 0.36, "#f8fafc", "#e2e8f0"));
      engineBell(ctx, cx, base - H * 0.07, half * 0.65, "#44403c");
    },

    newglenn(ctx, cx, base, H, anim, mini, name) {
      // ~98m, 7m fairing, blue first stage, white upper, landing fins
      const half = H * (7 / 98) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.14, half, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.14, tip + H * 0.36, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f1f5f9", "#94a3b8"));
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(cx - half, tip + H * 0.36, half * 2, H * 0.02);
      cyl(ctx, cx, tip + H * 0.38, base - H * 0.05, half * 0.98, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#60a5fa", "#1e3a8a"));
      panelLines(ctx, cx, tip + H * 0.38, base - H * 0.05, half, 6, "rgba(30,58,138,0.35)");
      // Landing fins
      ctx.fillStyle = "#1e40af";
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.98, base - H * 0.18);
      ctx.lineTo(cx - half * 1.7, base - H * 0.04);
      ctx.lineTo(cx - half * 0.98, base - H * 0.06);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + half * 0.98, base - H * 0.18);
      ctx.lineTo(cx + half * 1.7, base - H * 0.04);
      ctx.lineTo(cx + half * 0.98, base - H * 0.06);
      ctx.fill();
      for (let i = -1; i <= 1; i++) engineBell(ctx, cx + i * half * 0.45, base - H * 0.05, half * 0.28, "#475569");
    },

    ariane6(ctx, cx, base, H, anim, mini, name) {
      const half = H * (5.4 / 63) * 0.5;
      const tip = base - H;
      const n = parseArianeBoosters(name);
      ogive(ctx, cx, tip, tip + H * 0.18, half, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.18, tip + H * 0.42, half * 0.95, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f8fafc", "#cbd5e1"));
      // Black ESA band
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(cx - half * 0.95, tip + H * 0.42, half * 1.9, H * 0.035);
      // Blue accent line
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(cx - half * 0.95, tip + H * 0.455, half * 1.9, H * 0.008);
      cyl(ctx, cx, tip + H * 0.463, base - H * 0.07, half, "#f8fafc");
      panelLines(ctx, cx, tip + H * 0.463, base - H * 0.07, half, 4);
      const pos = n >= 4 ? [-2.0, -1.15, 1.15, 2.0] : [-1.85, 1.85];
      pos.forEach((f) => srb(ctx, cx + half * f, tip + H * 0.48, base - H * 0.05, half * 0.4, "#e2e8f0", "#f1f5f9"));
      engineBell(ctx, cx, base - H * 0.07, half * 0.55, "#44403c");
    },

    vegac(ctx, cx, base, H, anim, mini, name) {
      const half = H * (3.4 / 35) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.2, half, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.2, tip + H * 0.5, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#e2e8f0", "#94a3b8"));
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(cx - half, tip + H * 0.5, half * 2, H * 0.025);
      cyl(ctx, cx, tip + H * 0.525, base - H * 0.06, half * 0.92, "#cbd5e1");
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.92, base - H * 0.14);
      ctx.lineTo(cx - half * 1.5, base - H * 0.04);
      ctx.lineTo(cx - half * 0.92, base - H * 0.06);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + half * 0.92, base - H * 0.14);
      ctx.lineTo(cx + half * 1.5, base - H * 0.04);
      ctx.lineTo(cx + half * 0.92, base - H * 0.06);
      ctx.fill();
      engineBell(ctx, cx, base - H * 0.06, half * 0.55, "#57534e");
    },

    h3(ctx, cx, base, H, anim, mini, name) {
      const half = H * (5.2 / 57) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.17, half, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.17, tip + H * 0.4, half, "#f1f5f9");
      // JAXA blue + orange markings
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(cx - half, tip + H * 0.4, half * 2, H * 0.03);
      ctx.fillStyle = "#f97316";
      ctx.fillRect(cx - half, tip + H * 0.43, half * 2, H * 0.012);
      cyl(ctx, cx, tip + H * 0.442, base - H * 0.07, half * 0.95, "#f8fafc");
      srb(ctx, cx - half * 1.75, tip + H * 0.48, base - H * 0.05, half * 0.38, "#e2e8f0", "#fdba74");
      srb(ctx, cx + half * 1.75, tip + H * 0.48, base - H * 0.05, half * 0.38, "#e2e8f0", "#fdba74");
      engineBell(ctx, cx, base - H * 0.07, half * 0.5, "#57534e");
    },

    pslv(ctx, cx, base, H, anim, mini, name) {
      // PSLV with up to 6 PSOM strap-ons
      const half = H * (2.8 / 44) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.14, half * 1.05, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.14, tip + H * 0.35, half, "#e2e8f0");
      // Solid stages white/orange bands
      cyl(ctx, cx, tip + H * 0.35, tip + H * 0.55, half, "#f97316");
      cyl(ctx, cx, tip + H * 0.55, base - H * 0.06, half, "#ea580c");
      panelLines(ctx, cx, tip + H * 0.35, base - H * 0.06, half, 4, "rgba(69,26,3,0.25)");
      const pos = [-2.1, -1.25, -0.4, 0.4, 1.25, 2.1];
      pos.forEach((f, i) => {
        const top = tip + H * (0.48 + (i % 2) * 0.04);
        srb(ctx, cx + half * f, top, base - H * 0.05, half * 0.32, "#f8fafc", "#fdba74");
      });
      engineBell(ctx, cx, base - H * 0.06, half * 0.55, "#57534e");
    },

    gslv(ctx, cx, base, H, anim, mini, name) {
      // GSLV Mk II: core + 4 L40H liquid strap-ons, ogive fairing, cryogenic upper
      const half = H * (2.8 / 49.1) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.16, half * 1.1, "#f8fafc");
      // Cryogenic upper (shorter, white)
      cyl(ctx, cx, tip + H * 0.16, tip + H * 0.34, half * 0.9, "#e2e8f0");
      ctx.fillStyle = "#64748b";
      ctx.fillRect(cx - half * 0.9, tip + H * 0.34, half * 1.8, H * 0.015);
      // Core orange/brown solids look
      cyl(ctx, cx, tip + H * 0.355, base - H * 0.07, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#fb923c", "#9a3412"));
      // 4 L40H liquid strap-ons (thicker, flat tops with small noses)
      [-1.9, -1.05, 1.05, 1.9].forEach((f) => {
        const sx = cx + half * f;
        ogive(ctx, sx, tip + H * 0.38, tip + H * 0.44, half * 0.42, "#fdba74");
        cyl(ctx, sx, tip + H * 0.44, base - H * 0.05, half * 0.42, bodyGrad(ctx, sx - half, 0, sx + half, 0, "#f97316", "#7c2d12"));
        engineBell(ctx, sx, base - H * 0.05, half * 0.32, "#44403c");
      });
      engineBell(ctx, cx, base - H * 0.07, half * 0.5, "#57534e");
    },

    lvm3(ctx, cx, base, H, anim, mini, name) {
      // LVM3: large core + two S200 boosters
      const half = H * (4 / 43.4) * 0.5;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.16, half * 1.05, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.16, tip + H * 0.38, half, "#e2e8f0");
      cyl(ctx, cx, tip + H * 0.38, base - H * 0.07, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#fb923c", "#c2410c"));
      // Huge S200s
      srb(ctx, cx - half * 1.95, tip + H * 0.32, base - H * 0.04, half * 0.55, "#f8fafc", "#ea580c");
      srb(ctx, cx + half * 1.95, tip + H * 0.32, base - H * 0.04, half * 0.55, "#f8fafc", "#ea580c");
      engineBell(ctx, cx, base - H * 0.07, half * 0.55, "#57534e");
    },

    longmarch(ctx, cx, base, H, anim, mini, name) {
      const v = longMarchVariant(name);
      const half = H * 0.045;
      const tip = base - H;
      if (v === "lm5") {
        // Large white 5m core + 4 boosters
        const h5 = H * (5 / 57) * 0.5;
        ogive(ctx, cx, tip, tip + H * 0.14, h5, "#f8fafc");
        cyl(ctx, cx, tip + H * 0.14, base - H * 0.06, h5, bodyGrad(ctx, cx - h5, 0, cx + h5, 0, "#f8fafc", "#cbd5e1"));
        panelLines(ctx, cx, tip + H * 0.14, base - H * 0.06, h5, 6);
        [-1.85, -1.05, 1.05, 1.85].forEach((f) =>
          srb(ctx, cx + h5 * f, tip + H * 0.28, base - H * 0.04, h5 * 0.42, "#f1f5f9", "#e2e8f0")
        );
        engineBell(ctx, cx, base - H * 0.06, h5 * 0.5, "#57534e");
        return;
      }
      if (v === "lm7" || v === "lm8" || v === "lm12") {
        ogive(ctx, cx, tip, tip + H * 0.15, half * 1.1, "#f8fafc");
        cyl(ctx, cx, tip + H * 0.15, base - H * 0.06, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f8fafc", "#94a3b8"));
        // Light green band common on some CZ
        ctx.fillStyle = "#4d7c0f";
        ctx.fillRect(cx - half, tip + H * 0.4, half * 2, H * 0.02);
        [-1.8, 1.8].forEach((f) => srb(ctx, cx + half * f, tip + H * 0.35, base - H * 0.04, half * 0.4, "#f1f5f9", "#e2e8f0"));
        engineBell(ctx, cx, base - H * 0.06, half * 0.5, "#57534e");
        return;
      }
      // LM-2 / LM-3 classic green with yellow bands + strap-ons
      ogive(ctx, cx, tip, tip + H * 0.14, half, "#f8fafc");
      cyl(ctx, cx, tip + H * 0.14, base - H * 0.06, half, "#3f6212");
      ctx.fillStyle = "#fde047";
      ctx.fillRect(cx - half, tip + H * 0.32, half * 2, H * 0.02);
      ctx.fillRect(cx - half, tip + H * 0.5, half * 2, H * 0.02);
      ctx.fillRect(cx - half, tip + H * 0.68, half * 2, H * 0.02);
      [-1.75, 1.75].forEach((f) => srb(ctx, cx + half * f, tip + H * 0.3, base - H * 0.04, half * 0.4, "#fef9c3", "#4d7c0f"));
      engineBell(ctx, cx, base - H * 0.06, half * 0.5, "#57534e");
    },

    soyuz(ctx, cx, base, H, anim, mini, name) {
      // Korolev cross: central core + 4 tapered strap-ons, ogive fairing, gray equipment bay
      const half = H * (2.95 / 46.1) * 0.5;
      const tip = base - H;
      // Fairing / payload
      ogive(ctx, cx, tip, tip + H * 0.2, half * 1.2, "#f8fafc");
      // Escape tower stub for crewed — skip for generic sat
      // Instrument / equipment bay (gray cylinder)
      cyl(ctx, cx, tip + H * 0.2, tip + H * 0.28, half * 1.05, "#64748b");
      // Third stage
      cyl(ctx, cx, tip + H * 0.28, tip + H * 0.4, half, "#e2e8f0");
      // Core (orange/green-gray)
      cyl(ctx, cx, tip + H * 0.4, base - H * 0.08, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#fb923c", "#9a3412"));
      // 4 tapered boosters — draw L/R clearly; hint front/back with narrower
      const boosters = [
        { x: -1.7, z: 1 },
        { x: 1.7, z: 1 },
        { x: -0.95, z: 0.75 },
        { x: 0.95, z: 0.75 },
      ];
      boosters.forEach(({ x, z }) => {
        const sx = cx + half * x;
        const bh = half * 0.55 * z;
        const bTop = tip + H * 0.36;
        // Tapered: wider at bottom
        ctx.beginPath();
        ctx.moveTo(sx - bh * 0.7, bTop);
        ctx.lineTo(sx + bh * 0.7, bTop);
        ctx.lineTo(sx + bh * 1.15, base - H * 0.05);
        ctx.lineTo(sx - bh * 1.15, base - H * 0.05);
        ctx.closePath();
        ctx.fillStyle = bodyGrad(ctx, sx - bh, 0, sx + bh, 0, "#fdba74", "#7c2d12");
        ctx.fill();
        // Nose cone tip
        ogive(ctx, sx, bTop - H * 0.05, bTop, bh * 0.7, "#f97316");
        engineBell(ctx, sx, base - H * 0.05, bh * 0.7, "#44403c");
      });
      // Fregat / upper hint
      ctx.fillStyle = "#334155";
      ctx.fillRect(cx - half, tip + H * 0.26, half * 2, H * 0.02);
      engineBell(ctx, cx, base - H * 0.08, half * 0.5, "#57534e");
    },

    generic(ctx, cx, base, H, anim, mini, name) {
      const half = H * 0.04;
      const tip = base - H;
      ogive(ctx, cx, tip, tip + H * 0.18, half, "#e2e8f0");
      cyl(ctx, cx, tip + H * 0.18, tip + H * 0.5, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#94a3b8", "#475569"));
      ctx.fillStyle = "#7dd3fc";
      ctx.fillRect(cx - half, tip + H * 0.5, half * 2, H * 0.02);
      cyl(ctx, cx, tip + H * 0.52, base - H * 0.06, half * 0.95, "#334155");
      engineBell(ctx, cx, base - H * 0.06, half * 0.5, "#57534e");
    },
  };

  // Expose for contact-sheet / tests
  window.__evDrawRocket = drawRocket;
  window.__evDrawers = Object.keys(DRAWERS);
  window.__evVehicleHeights = VEHICLE_HEIGHT_M_DRAW;

  /* ---------- Data loading ---------- */

  async function loadData() {
    let bundled = null;
    let source = "cached file";
    try {
      const res = await fetch(DATA_URL + "?t=" + Date.now());
      if (res.ok) {
        bundled = await res.json();
      }
    } catch (e) {
      console.warn("bundled launches fetch failed", e);
    }

    // Optional live refresh with localStorage cache
    let live = null;
    try {
      const cached = readCache();
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        live = cached.data;
        source = "local cache";
      } else {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(LIVE_URL, { signal: controller.signal });
        clearTimeout(to);
        if (res.ok) {
          const raw = await res.json();
          live = trimLive(raw);
          writeCache(live);
          source = "live API";
        } else if (res.status === 429) {
          source = bundled ? "cached file (API rate-limited)" : "unavailable";
        }
      }
    } catch {
      // degrade silently
      if (bundled) source = "cached file";
    }

    const data = live && live.launches && live.launches.length ? live : bundled;
    if (!data || !data.launches || !data.launches.length) {
      els.status.textContent = "Launch data unavailable right now.";
      return;
    }

    launches = data.launches
      .map(normalizeLaunch)
      .filter(Boolean)
      .sort((a, b) => {
        const ta = a.net ? new Date(a.net).getTime() : Infinity;
        const tb = b.net ? new Date(b.net).getTime() : Infinity;
        return ta - tb;
      });

    // ?liftoff=1 without ?now= → pin clock to featured NET so the anim is visible
    if (forceLiftoffDemo && clockFixedMs == null && launches[0] && launches[0].net) {
      const net = new Date(launches[0].net).getTime();
      if (!Number.isNaN(net)) {
        clockFixedMs = net;
        liftoffStartMs = net;
      }
    }

    const updated = data.updated ? formatLocal(data.updated) : "";
    els.status.textContent = updated
      ? `Data updated ${updated} · ${source}`
      : `Showing ${launches.length} upcoming launches · ${source}`;

    renderAll();
    startTick();
    startAnim();
  }

  function trimLive(raw) {
    const results = raw.results || [];
    return {
      updated: new Date().toISOString(),
      source: "ll2-live",
      count: results.length,
      launches: results.map((L) => {
        // Minimal trim matching fetch_launches.py shape
        const rocket = L.rocket || {};
        const cfg = rocket.configuration || {};
        const pad = L.pad || {};
        const loc = pad.location || {};
        const mission = (L.mission && L.mission) || (L.missions && L.missions[0]) || {};
        const status = L.status || {};
        const padName = pad.name || "";
        const locName = loc.name || "";
        return {
          id: L.id,
          name: L.name,
          net: L.net,
          window_start: L.window_start,
          window_end: L.window_end,
          status: status.name || status.abbrev || "",
          status_abbrev: status.abbrev || "",
          provider: (L.launch_service_provider && L.launch_service_provider.name) || "",
          vehicle: cfg.full_name || cfg.name || "",
          vehicle_key: guessKey(cfg.full_name || cfg.name || ""),
          vehicle_description: cfg.description || "",
          mission_name: mission.name || "",
          mission_description: mission.description || "",
          orbit: (mission.orbit && mission.orbit.name) || "",
          pad: padName,
          location: locName,
          country: loc.country_code || "",
          webcast: ((L.vidURLs && L.vidURLs[0] && L.vidURLs[0].url) ||
            (L.vid_urls && L.vid_urls[0] && L.vid_urls[0].url) ||
            "") || "",
          image: L.image || "",
          vandenberg: isVandenbergLoc(locName, padName),
        };
      }),
    };
  }

  function guessKey(name) {
    const n = (name || "").toLowerCase();
    if (/falcon\s*heavy/.test(n)) return "falconheavy";
    if (/falcon\s*9/.test(n)) return "falcon9";
    if (/starship|super\s*heavy/.test(n)) return "starship";
    if (/electron/.test(n)) return "electron";
    if (/neutron/.test(n)) return "neutron";
    if (/vulcan/.test(n)) return "vulcan";
    if (/atlas\s*v/.test(n)) return "atlasv";
    if (/new\s*glenn/.test(n)) return "newglenn";
    if (/ariane\s*6/.test(n)) return "ariane6";
    if (/vega/.test(n)) return "vegac";
    if (/\bh3\b/.test(n)) return "h3";
    if (/pslv/.test(n)) return "pslv";
    if (/gslv/.test(n)) return "gslv";
    if (/lvm\s*3|gslv\s*mk\s*iii/.test(n)) return "lvm3";
    if (/long\s*march|chang\s*zheng/.test(n)) return "longmarch";
    if (/soyuz/.test(n)) return "soyuz";
    return "generic";
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* quota */
    }
  }

  /* ---------- Render ---------- */

  function renderAll() {
    if (!launches.length) return;
    const { featured, upcoming } = selectFeaturedAndUpcoming(launches, nowMs());
    if (!featured) return;
    renderFeatured(featured);
    renderGrid(upcoming);
    updateCountdowns();
  }

  function renderFeatured(L) {
    const key = L.vehicle_key || guessKey(L.vehicle);
    els.title.textContent = L.name || L.mission_name || "Upcoming launch";
    els.when.textContent = formatLocal(L.net);
    els.statusPill.textContent = L.status_abbrev || L.status || "—";
    els.statusPill.className = "status-pill " + statusClass(L.status);
    const showVandy = isVandenberg(L);
    els.vandy.hidden = !showVandy;
    els.vandy.toggleAttribute('hidden', !showVandy);
    els.vandy.setAttribute('aria-hidden', showVandy ? 'false' : 'true');
    els.missionDesc.textContent =
      L.mission_description ||
      (L.mission_name ? `Mission: ${L.mission_name}` : "Mission details to be published.");
    els.vehicleDesc.textContent =
      L.vehicle_description ||
      `${L.vehicle || "Launch vehicle"} — ${L.provider || "provider TBD"}.`;

    const rows = [
      ["Provider", L.provider || "—"],
      ["Vehicle", L.vehicle || "—"],
      ["Pad", [L.pad, L.location].filter(Boolean).join(" · ") || "—"],
      ["Orbit", L.orbit || "—"],
      ["Window", windowText(L)],
    ];
    els.meta.innerHTML = rows
      .map(
        ([k, v]) =>
          `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
      )
      .join("");

    if (L.webcast) {
      els.webcast.hidden = false;
      els.webcast.innerHTML = `<a href="${escapeHtml(L.webcast)}" target="_blank" rel="noopener noreferrer">Watch webcast</a>`;
    } else {
      els.webcast.hidden = true;
      els.webcast.innerHTML = "";
    }

    const hm = VEHICLE_HEIGHT_M[key];
    if (hm) {
      els.scale.hidden = false;
      els.scale.textContent = `~${hm} m class`;
    } else {
      els.scale.hidden = true;
    }

    els.canvas.dataset.vehicle = key;
    els.canvas.dataset.vehicleName = L.vehicle || L.name || "";
    els.canvas.dataset.net = L.net || "";
    els.canvas.dataset.status = L.status || "";
    const now = nowMs();
    const net = L.net ? new Date(L.net).getTime() : NaN;
    if (!Number.isNaN(net) && now >= net && now < net + FEATURED_HOLD_MS) {
      els.kicker.textContent = now < net + LIFTOFF_ANIM_MS ? "Liftoff" : "In flight";
    } else {
      els.kicker.textContent = "Next launch";
    }
    paintFeatured();
  }

  function windowText(L) {
    if (!L.window_start && !L.window_end) return "—";
    if (L.window_start && L.window_end && L.window_start !== L.window_end) {
      return `${formatLocal(L.window_start)} → ${formatLocal(L.window_end)}`;
    }
    return formatLocal(L.window_start || L.window_end || L.net);
  }

  function paintFeatured() {
    const ctx = els.canvas.getContext("2d");
    if (!ctx) return;
    const key = els.canvas.dataset.vehicle || "generic";
    const name = els.canvas.dataset.vehicleName || "";
    const fakeLaunch = {
      net: els.canvas.dataset.net,
      status: els.canvas.dataset.status,
    };
    const lift = liftoffProgressFor(fakeLaunch, nowMs());
    drawRocket(ctx, els.canvas.width, els.canvas.height, key, {
      anim: featuredAnimT,
      mini: false,
      name,
      liftoffProgress: lift,
    });
  }

  function renderGrid(list) {
    els.grid.innerHTML = "";
    list.forEach((L, idx) => {
      const key = L.vehicle_key || guessKey(L.vehicle);
      const card = document.createElement("article");
      card.className = "launch-card";
      card.dataset.index = String(idx);

      const btnId = `launch-btn-${idx}`;
      const panelId = `launch-panel-${idx}`;

      card.innerHTML = `
        <button type="button" class="card-toggle" id="${btnId}"
          aria-expanded="false" aria-controls="${panelId}">
          <div class="card-summary">
            <div class="card-art"><canvas width="112" height="144" aria-hidden="true"></canvas></div>
            <div class="card-body">
              <span class="card-type">${escapeHtml(L.vehicle || "Launch")}</span>
              <h3>${escapeHtml(L.name || L.mission_name || "Mission")}</h3>
              <span class="card-date">${escapeHtml(formatLocal(L.net))}</span>
              <span class="card-eta" data-net="${escapeHtml(L.net || "")}"></span>
              <div class="card-pills">
                <span class="status-pill ${statusClass(L.status)}">${escapeHtml(L.status_abbrev || L.status || "")}</span>
                ${isVandenberg(L) ? '<span class="badge vandy">Vandenberg SFB, California</span>' : ""}
              </div>
            </div>
            <span class="card-chevron" aria-hidden="true"></span>
          </div>
        </button>
        <div class="card-panel" id="${panelId}" role="region" aria-labelledby="${btnId}" hidden>
          <div class="card-panel-inner">
            <p class="card-science">${escapeHtml(L.mission_description || "Mission details to be published.")}</p>
            <p class="card-science">${escapeHtml(L.vehicle_description || L.vehicle || "")}</p>
            <dl class="card-meta">
              <dt>Provider</dt><dd>${escapeHtml(L.provider || "—")}</dd>
              <dt>Pad</dt><dd>${escapeHtml([L.pad, L.location].filter(Boolean).join(" · ") || "—")}</dd>
              <dt>Orbit</dt><dd>${escapeHtml(L.orbit || "—")}</dd>
              <dt>Window</dt><dd>${escapeHtml(windowText(L))}</dd>
              ${
                L.webcast
                  ? `<dt>Webcast</dt><dd><a href="${escapeHtml(L.webcast)}" target="_blank" rel="noopener noreferrer">Open link</a></dd>`
                  : ""
              }
            </dl>
          </div>
        </div>
      `;

      const canvas = card.querySelector("canvas");
      if (canvas) {
        const cctx = canvas.getContext("2d");
        if (cctx) drawRocket(cctx, canvas.width, canvas.height, key, { mini: true, anim: 0, name: L.vehicle || "" });
      }

      const btn = card.querySelector(".card-toggle");
      const panel = card.querySelector(".card-panel");
      btn.addEventListener("click", () => toggleCard(card, btn, panel));
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCard(card, btn, panel);
        }
      });

      els.grid.appendChild(card);
    });
  }

  function toggleCard(card, btn, panel) {
    const open = card.classList.contains("is-open");
    // close others
    els.grid.querySelectorAll(".launch-card.is-open").forEach((other) => {
      if (other === card) return;
      other.classList.remove("is-open");
      const ob = other.querySelector(".card-toggle");
      const op = other.querySelector(".card-panel");
      if (ob) ob.setAttribute("aria-expanded", "false");
      if (op) {
        op.hidden = true;
      }
    });

    if (open) {
      card.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      panel.hidden = true;
    } else {
      card.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      panel.hidden = false;
    }
  }

  let lastFeaturedId = null;
  function updateCountdowns() {
    const now = nowMs();
    // Demo / ?now= liftoff: advance pinned clock with wall-clock delta
    if (forceLiftoffDemo && clockFixedMs != null) {
      if (!updateCountdowns._wall0) {
        updateCountdowns._wall0 = Date.now();
        updateCountdowns._pin0 = clockFixedMs;
      }
      clockFixedMs = updateCountdowns._pin0 + (Date.now() - updateCountdowns._wall0);
    }
    const { featured, upcoming } = selectFeaturedAndUpcoming(launches, now);
    if (featured) {
      const fid = featured.id || featured.name;
      if (fid !== lastFeaturedId) {
        lastFeaturedId = fid;
        renderFeatured(featured);
        renderGrid(upcoming);
      } else {
        // Update kicker as we cross liftoff / T+15 boundary
        const net = featured.net ? new Date(featured.net).getTime() : NaN;
        if (!Number.isNaN(net) && now >= net && now < net + FEATURED_HOLD_MS) {
          els.kicker.textContent = now < net + LIFTOFF_ANIM_MS ? "Liftoff" : "In flight";
        } else if (!Number.isNaN(net) && now < net) {
          els.kicker.textContent = "Next launch";
        }
      }
      // After T+15m, promote next without full reload
      if (!isStillFeaturedWindow(featured, now)) {
        lastFeaturedId = null;
        renderAll();
        return;
      }
      els.countdown.textContent = formatCountdown(featured, now);
    }
    els.grid.querySelectorAll(".card-eta").forEach((node) => {
      const net = node.getAttribute("data-net");
      if (!net) {
        node.textContent = "";
        return;
      }
      const t = new Date(net).getTime();
      if (Number.isNaN(t)) {
        node.textContent = "";
        return;
      }
      const diff = t - now;
      if (diff > 0) node.textContent = "in " + formatEta(diff);
      else node.textContent = "T+ " + formatEta(diff);
    });
  }

  function startTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(updateCountdowns, 1000);
  }

  function startAnim() {
    const step = () => {
      featuredAnimT += 1;
      // Paint every frame during liftoff; otherwise every 3rd frame (stars are slow)
      const fakeLaunch = {
        net: els.canvas && els.canvas.dataset.net,
        status: els.canvas && els.canvas.dataset.status,
      };
      const lift = liftoffProgressFor(fakeLaunch, nowMs());
      if (lift > 0 && lift < 1) paintFeatured();
      else if (featuredAnimT % 3 === 0) paintFeatured();
      animRaf = requestAnimationFrame(step);
    };
    if (animRaf) cancelAnimationFrame(animRaf);
    animRaf = requestAnimationFrame(step);
  }

  loadData();
})();
