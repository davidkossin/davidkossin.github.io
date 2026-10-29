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

  function drawRocket(ctx, w, h, key, opts) {
    opts = opts || {};
    const anim = opts.anim || 0;
    const mini = !!opts.mini;
    ctx.clearRect(0, 0, w, h);

    // Starfield / sky
    if (!mini) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#05060f");
      g.addColorStop(0.55, "#0a1028");
      g.addColorStop(1, "#12182e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 97 + anim * 4) % w + w) % w;
        const sy = ((i * 53) % (h * 0.72));
        const r = (i % 3 === 0 ? 1.2 : 0.7) * (0.6 + 0.4 * Math.sin(anim * 0.02 + i));
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "rgba(5,6,15,0.2)";
      ctx.fillRect(0, 0, w, h);
    }

    const cx = w * 0.5;
    const groundY = mini ? h * 0.92 : h * 0.88;
    const rocketH = mini ? h * 0.78 : h * 0.72;
    const baseY = groundY - (mini ? 2 : 8);

    if (!mini) {
      // Pad / ground glow
      const padG = ctx.createRadialGradient(cx, groundY, 4, cx, groundY, w * 0.42);
      padG.addColorStop(0, "rgba(251,146,60,0.35)");
      padG.addColorStop(0.4, "rgba(99,102,241,0.12)");
      padG.addColorStop(1, "transparent");
      ctx.fillStyle = padG;
      ctx.fillRect(0, groundY - 40, w, 80);

      // Pad platform
      ctx.fillStyle = "rgba(80,90,120,0.55)";
      ctx.fillRect(cx - w * 0.22, groundY - 4, w * 0.44, 8);
      ctx.fillStyle = "rgba(40,48,70,0.7)";
      ctx.fillRect(cx - w * 0.18, groundY + 4, w * 0.36, 6);

      // Vapor
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const vx = cx + Math.sin(anim * 0.03 + i * 1.2) * (18 + i * 8);
        const vy = groundY - 10 - i * 6;
        const vr = 10 + i * 4 + Math.sin(anim * 0.05 + i) * 3;
        ctx.fillStyle = `rgba(200,220,255,${0.06 + i * 0.02})`;
        ctx.beginPath();
        ctx.ellipse(vx, vy, vr, vr * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const drawer = DRAWERS[key] || DRAWERS.generic;
    drawer(ctx, cx, baseY, rocketH, anim, mini);

    if (!mini) {
      // Soft glow around vehicle
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(cx, baseY - rocketH * 0.45, 4, cx, baseY - rocketH * 0.45, rocketH * 0.35);
      glow.addColorStop(0, "rgba(125,211,252,0.12)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function bodyGrad(ctx, x0, y0, x1, y1, c1, c2) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    return g;
  }

  function drawNoseCone(ctx, cx, tipY, baseY, halfW, color) {
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.quadraticCurveTo(cx + halfW * 1.05, tipY + (baseY - tipY) * 0.55, cx + halfW, baseY);
    ctx.lineTo(cx - halfW, baseY);
    ctx.quadraticCurveTo(cx - halfW * 1.05, tipY + (baseY - tipY) * 0.55, cx, tipY);
    ctx.closePath();
    ctx.fillStyle = color || "#e8ecff";
    ctx.fill();
  }

  function drawCylinder(ctx, cx, top, bot, halfW, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(cx - halfW, top, halfW * 2, bot - top);
  }

  function drawFins(ctx, cx, y, halfW, finH, finOut, color) {
    ctx.fillStyle = color || "#9aa3c0";
    // left
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.lineTo(cx - halfW - finOut, y + finH * 0.85);
    ctx.lineTo(cx - halfW, y + finH);
    ctx.closePath();
    ctx.fill();
    // right
    ctx.beginPath();
    ctx.moveTo(cx + halfW, y);
    ctx.lineTo(cx + halfW + finOut, y + finH * 0.85);
    ctx.lineTo(cx + halfW, y + finH);
    ctx.closePath();
    ctx.fill();
  }

  function drawEngineBell(ctx, cx, y, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, y);
    ctx.lineTo(cx - r, y + r * 1.1);
    ctx.lineTo(cx + r, y + r * 1.1);
    ctx.lineTo(cx + r * 0.55, y);
    ctx.closePath();
    ctx.fillStyle = color || "#6b7280";
    ctx.fill();
  }

  const DRAWERS = {
    falcon9(ctx, cx, base, H, anim, mini) {
      const half = H * 0.055;
      const tip = base - H;
      const fairingBot = tip + H * 0.22;
      const interstage = tip + H * 0.55;
      drawNoseCone(ctx, cx, tip, fairingBot, half * 1.05, "#f1f5f9");
      drawCylinder(ctx, cx, fairingBot, interstage, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#e2e8f0", "#94a3b8"));
      // black stripe
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - half, interstage - H * 0.02, half * 2, H * 0.04);
      drawCylinder(ctx, cx, interstage, base - H * 0.04, half * 0.95, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#cbd5e1", "#64748b"));
      // SpaceX-ish black chevron mark
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(cx - half * 0.35, tip + H * 0.38, half * 0.7, H * 0.08);
      drawFins(ctx, cx, base - H * 0.12, half * 0.95, H * 0.1, half * 0.9, "#475569");
      drawEngineBell(ctx, cx, base - H * 0.04, half * 0.7, "#78716c");
      if (!mini) drawLandingLegs(ctx, cx, base - H * 0.08, half, H * 0.06);
    },

    falconheavy(ctx, cx, base, H, anim, mini) {
      const half = H * 0.048;
      const tip = base - H;
      // side boosters
      const off = half * 2.15;
      drawBoosterStick(ctx, cx - off, tip + H * 0.18, base, half * 0.9);
      drawBoosterStick(ctx, cx + off, tip + H * 0.18, base, half * 0.9);
      DRAWERS.falcon9(ctx, cx, base, H, anim, true);
      if (!mini) {
        drawLandingLegs(ctx, cx - off, base - H * 0.08, half * 0.9, H * 0.05);
        drawLandingLegs(ctx, cx + off, base - H * 0.08, half * 0.9, H * 0.05);
      }
    },

    starship(ctx, cx, base, H, anim, mini) {
      const half = H * 0.07;
      const tip = base - H;
      // stainless steel look
      const steel = bodyGrad(ctx, cx - half, 0, cx + half, 0, "#f8fafc", "#94a3b8");
      drawNoseCone(ctx, cx, tip, tip + H * 0.18, half, "#e2e8f0");
      drawCylinder(ctx, cx, tip + H * 0.18, tip + H * 0.48, half, steel);
      // flap hinges / heat tiles hint
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - half, tip + H * 0.48, half * 2, H * 0.02);
      drawCylinder(ctx, cx, tip + H * 0.5, base - H * 0.05, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#cbd5e1", "#64748b"));
      // forward flaps
      ctx.fillStyle = "#64748b";
      ctx.fillRect(cx - half * 1.55, tip + H * 0.28, half * 0.55, H * 0.08);
      ctx.fillRect(cx + half, tip + H * 0.28, half * 0.55, H * 0.08);
      // aft flaps
      ctx.fillRect(cx - half * 1.7, base - H * 0.22, half * 0.7, H * 0.12);
      ctx.fillRect(cx + half, base - H * 0.22, half * 0.7, H * 0.12);
      // engines
      for (let i = -1; i <= 1; i++) {
        drawEngineBell(ctx, cx + i * half * 0.7, base - H * 0.05, half * 0.35, "#78716c");
      }
    },

    electron(ctx, cx, base, H, anim, mini) {
      const half = H * 0.07;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.2, half, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.2, tip + H * 0.55, half, "#1e3a5f");
      // carbon-composite look with accent band
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(cx - half, tip + H * 0.55, half * 2, H * 0.03);
      drawCylinder(ctx, cx, tip + H * 0.58, base - H * 0.05, half * 0.95, "#0f172a");
      drawFins(ctx, cx, base - H * 0.14, half * 0.95, H * 0.1, half * 0.7, "#334155");
      drawEngineBell(ctx, cx, base - H * 0.05, half * 0.55, "#64748b");
    },

    neutron(ctx, cx, base, H, anim, mini) {
      const half = H * 0.085;
      const tip = base - H;
      // distinctive fairing / reusable first stage
      drawNoseCone(ctx, cx, tip, tip + H * 0.22, half * 1.1, "#e2e8f0");
      drawCylinder(ctx, cx, tip + H * 0.22, tip + H * 0.5, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#94a3b8", "#475569"));
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(cx - half, tip + H * 0.5, half * 2, H * 0.025);
      drawCylinder(ctx, cx, tip + H * 0.525, base - H * 0.06, half * 0.95, "#1e293b");
      drawFins(ctx, cx, base - H * 0.16, half * 0.95, H * 0.12, half * 1.1, "#64748b");
      drawEngineBell(ctx, cx, base - H * 0.06, half * 0.65, "#78716c");
    },

    vulcan(ctx, cx, base, H, anim, mini) {
      const half = H * 0.06;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.18, half, "#f8fafc");
      // Centaur upper
      drawCylinder(ctx, cx, tip + H * 0.18, tip + H * 0.42, half * 0.85, "#cbd5e1");
      // orange foam / white core
      drawCylinder(ctx, cx, tip + H * 0.42, base - H * 0.08, half, "#f97316");
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(cx - half * 0.3, tip + H * 0.5, half * 0.6, H * 0.3);
      // SRBs
      const off = half * 1.85;
      drawCylinder(ctx, cx - off, tip + H * 0.48, base - H * 0.06, half * 0.45, "#e2e8f0");
      drawCylinder(ctx, cx + off, tip + H * 0.48, base - H * 0.06, half * 0.45, "#e2e8f0");
      drawNoseCone(ctx, cx - off, tip + H * 0.42, tip + H * 0.48, half * 0.45, "#f1f5f9");
      drawNoseCone(ctx, cx + off, tip + H * 0.42, tip + H * 0.48, half * 0.45, "#f1f5f9");
      drawEngineBell(ctx, cx, base - H * 0.08, half * 0.6, "#57534e");
    },

    atlasv(ctx, cx, base, H, anim, mini) {
      const half = H * 0.055;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.2, half * 1.05, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.2, tip + H * 0.4, half * 0.9, "#e2e8f0");
      // Centaur
      ctx.fillStyle = "#64748b";
      ctx.fillRect(cx - half * 0.9, tip + H * 0.38, half * 1.8, H * 0.03);
      // orange core
      drawCylinder(ctx, cx, tip + H * 0.41, base - H * 0.07, half, "#ea580c");
      drawEngineBell(ctx, cx, base - H * 0.07, half * 0.65, "#57534e");
    },

    newglenn(ctx, cx, base, H, anim, mini) {
      const half = H * 0.075;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.16, half, "#f1f5f9");
      drawCylinder(ctx, cx, tip + H * 0.16, tip + H * 0.4, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#e2e8f0", "#94a3b8"));
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(cx - half, tip + H * 0.4, half * 2, H * 0.03);
      drawCylinder(ctx, cx, tip + H * 0.43, base - H * 0.06, half * 0.98, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#93c5fd", "#1e3a8a"));
      // landing fins
      drawFins(ctx, cx, base - H * 0.15, half * 0.98, H * 0.1, half * 0.85, "#1e40af");
      for (let i = -1; i <= 1; i++) {
        drawEngineBell(ctx, cx + i * half * 0.55, base - H * 0.06, half * 0.35, "#64748b");
      }
    },

    ariane6(ctx, cx, base, H, anim, mini) {
      const half = H * 0.055;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.2, half, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.2, tip + H * 0.45, half * 0.95, "#e2e8f0");
      // black / white ESA banding
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(cx - half * 0.95, tip + H * 0.45, half * 1.9, H * 0.04);
      drawCylinder(ctx, cx, tip + H * 0.49, base - H * 0.08, half, "#f8fafc");
      // P120C boosters
      const off = half * 1.9;
      drawCylinder(ctx, cx - off, tip + H * 0.5, base - H * 0.06, half * 0.42, "#e2e8f0");
      drawCylinder(ctx, cx + off, tip + H * 0.5, base - H * 0.06, half * 0.42, "#e2e8f0");
      drawNoseCone(ctx, cx - off, tip + H * 0.44, tip + H * 0.5, half * 0.42, "#cbd5e1");
      drawNoseCone(ctx, cx + off, tip + H * 0.44, tip + H * 0.5, half * 0.42, "#cbd5e1");
      drawEngineBell(ctx, cx, base - H * 0.08, half * 0.55, "#57534e");
    },

    vegac(ctx, cx, base, H, anim, mini) {
      const half = H * 0.065;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.22, half, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.22, tip + H * 0.55, half * 0.95, "#e2e8f0");
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(cx - half * 0.95, tip + H * 0.55, half * 1.9, H * 0.03);
      drawCylinder(ctx, cx, tip + H * 0.58, base - H * 0.05, half * 0.9, "#cbd5e1");
      drawFins(ctx, cx, base - H * 0.12, half * 0.9, H * 0.08, half * 0.6, "#64748b");
      drawEngineBell(ctx, cx, base - H * 0.05, half * 0.5, "#57534e");
    },

    h3(ctx, cx, base, H, anim, mini) {
      const half = H * 0.06;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.2, half, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.2, tip + H * 0.48, half, "#e2e8f0");
      // JAXA blue/white
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(cx - half, tip + H * 0.48, half * 2, H * 0.035);
      drawCylinder(ctx, cx, tip + H * 0.515, base - H * 0.07, half * 0.95, "#f1f5f9");
      const off = half * 1.75;
      drawCylinder(ctx, cx - off, tip + H * 0.52, base - H * 0.05, half * 0.4, "#e2e8f0");
      drawCylinder(ctx, cx + off, tip + H * 0.52, base - H * 0.05, half * 0.4, "#e2e8f0");
      drawEngineBell(ctx, cx, base - H * 0.07, half * 0.55, "#57534e");
    },

    pslv(ctx, cx, base, H, anim, mini) {
      DRAWERS._isroSolid(ctx, cx, base, H, "#ea580c");
    },
    gslv(ctx, cx, base, H, anim, mini) {
      DRAWERS._isroSolid(ctx, cx, base, H, "#f97316");
    },
    lvm3(ctx, cx, base, H, anim, mini) {
      const half = H * 0.065;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.18, half, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.18, tip + H * 0.4, half, "#e2e8f0");
      drawCylinder(ctx, cx, tip + H * 0.4, base - H * 0.08, half, "#f97316");
      const off = half * 1.85;
      drawCylinder(ctx, cx - off, tip + H * 0.42, base - H * 0.06, half * 0.45, "#ea580c");
      drawCylinder(ctx, cx + off, tip + H * 0.42, base - H * 0.06, half * 0.45, "#ea580c");
      drawEngineBell(ctx, cx, base - H * 0.08, half * 0.55, "#57534e");
    },
    _isroSolid(ctx, cx, base, H, coreColor) {
      const half = H * 0.055;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.18, half, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.18, tip + H * 0.45, half * 0.9, "#e2e8f0");
      drawCylinder(ctx, cx, tip + H * 0.45, base - H * 0.06, half, coreColor);
      drawFins(ctx, cx, base - H * 0.12, half, H * 0.08, half * 0.55, "#64748b");
      drawEngineBell(ctx, cx, base - H * 0.06, half * 0.5, "#57534e");
    },

    longmarch(ctx, cx, base, H, anim, mini) {
      const half = H * 0.055;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.18, half, "#f8fafc");
      // distinctive green
      drawCylinder(ctx, cx, tip + H * 0.18, base - H * 0.07, half, "#4d7c0f");
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(cx - half, tip + H * 0.4, half * 2, H * 0.025);
      ctx.fillRect(cx - half, tip + H * 0.55, half * 2, H * 0.025);
      const off = half * 1.8;
      drawCylinder(ctx, cx - off, tip + H * 0.35, base - H * 0.05, half * 0.42, "#65a30d");
      drawCylinder(ctx, cx + off, tip + H * 0.35, base - H * 0.05, half * 0.42, "#65a30d");
      drawEngineBell(ctx, cx, base - H * 0.07, half * 0.55, "#57534e");
    },

    soyuz(ctx, cx, base, H, anim, mini) {
      const half = H * 0.05;
      const tip = base - H;
      // ogive fairing
      drawNoseCone(ctx, cx, tip, tip + H * 0.22, half * 1.15, "#f8fafc");
      drawCylinder(ctx, cx, tip + H * 0.22, tip + H * 0.4, half, "#e2e8f0");
      // Korolev cross boosters
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      angles.forEach((a, i) => {
        const ox = Math.cos(a + Math.PI / 4) * half * 1.65;
        const oy = 0;
        // only draw L/R visually distinct for 2D
        if (i % 2 === 0) {
          const bx = cx + (i === 0 ? -half * 1.7 : half * 1.7);
          drawCylinder(ctx, bx, tip + H * 0.38, base - H * 0.05, half * 0.55, "#ea580c");
          drawNoseCone(ctx, bx, tip + H * 0.32, tip + H * 0.38, half * 0.55, "#f97316");
        }
      });
      drawCylinder(ctx, cx, tip + H * 0.4, base - H * 0.08, half, "#c2410c");
      // gray equipment bay band
      ctx.fillStyle = "#64748b";
      ctx.fillRect(cx - half, tip + H * 0.38, half * 2, H * 0.04);
      drawEngineBell(ctx, cx, base - H * 0.08, half * 0.55, "#57534e");
    },

    generic(ctx, cx, base, H, anim, mini) {
      const half = H * 0.06;
      const tip = base - H;
      drawNoseCone(ctx, cx, tip, tip + H * 0.2, half, "#e2e8f0");
      drawCylinder(ctx, cx, tip + H * 0.2, tip + H * 0.55, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#94a3b8", "#475569"));
      ctx.fillStyle = "#7dd3fc";
      ctx.fillRect(cx - half, tip + H * 0.55, half * 2, H * 0.025);
      drawCylinder(ctx, cx, tip + H * 0.575, base - H * 0.06, half * 0.95, "#334155");
      drawFins(ctx, cx, base - H * 0.14, half * 0.95, H * 0.1, half * 0.8, "#64748b");
      drawEngineBell(ctx, cx, base - H * 0.06, half * 0.55, "#57534e");
    },
  };

  function drawBoosterStick(ctx, cx, top, base, half) {
    drawNoseCone(ctx, cx, top, top + (base - top) * 0.08, half, "#e2e8f0");
    drawCylinder(ctx, cx, top + (base - top) * 0.08, base - (base - top) * 0.04, half, bodyGrad(ctx, cx - half, 0, cx + half, 0, "#cbd5e1", "#64748b"));
    drawEngineBell(ctx, cx, base - (base - top) * 0.04, half * 0.7, "#78716c");
  }

  function drawLandingLegs(ctx, cx, y, half, len) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx - half - len, y + len);
    ctx.moveTo(cx + half, y);
    ctx.lineTo(cx + half + len, y + len);
    ctx.stroke();
  }

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
    renderFeatured(launches[0]);
    renderGrid(launches.slice(1));
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
    drawRocket(ctx, els.canvas.width, els.canvas.height, key, {
      anim: featuredAnimT,
      mini: false,
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
        if (cctx) drawRocket(cctx, canvas.width, canvas.height, key, { mini: true, anim: 0 });
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

  function updateCountdowns() {
    const now = Date.now();
    if (launches[0]) {
      els.countdown.textContent = formatCountdown(launches[0], now);
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
      if (featuredAnimT % 2 === 0) paintFeatured();
      animRaf = requestAnimationFrame(step);
    };
    if (animRaf) cancelAnimationFrame(animRaf);
    animRaf = requestAnimationFrame(step);
  }

  loadData();
})();
