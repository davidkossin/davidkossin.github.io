/* Stellar Events — Objects In Space
   Event dates verified against NASA Eclipse Catalog, AMS/IMO shower calendars,
   BAA Comet Section (2P/Encke). Moon phases computed with astronomy-engine. */
(function () {
  "use strict";

  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const ZIP_URL = "https://api.zippopotam.us/us/";
  const DEFAULT_ZIP = "90045";
  const SUPERMOON_KM = 362000;
  const HORIZON_END = new Date("2027-05-01T00:00:00Z");

  const MOON_NAMES = {
    1: "Wolf Moon",
    2: "Snow Moon",
    3: "Worm Moon",
    4: "Pink Moon",
    5: "Flower Moon",
    6: "Strawberry Moon",
    7: "Buck Moon",
    8: "Sturgeon Moon",
    9: "Corn Moon",
    10: "Hunter's Moon",
    11: "Beaver Moon",
    12: "Cold Moon",
  };

  /* Hard-coded events verified from published sources (window ~Oct 2026–Apr 2027).
     Times are peak / mid-event in UTC where a specific instant is known. */
  const STATIC_EVENTS = [
    {
      id: "leonids-2026",
      type: "meteor",
      title: "Leonid meteor shower peak",
      date: "2026-11-18T10:00:00Z",
      endDate: "2026-11-18T14:00:00Z",
      zhr: 15,
      radiant: { ra: 154, dec: 22, name: "Leo" },
      desc: "Moderate shower from Comet 55P/Tempel–Tuttle. Best in the hours before dawn after the radiant rises.",
      source: "AMS / IMO 2026 calendar",
    },
    {
      id: "mercury-gwe-2026",
      type: "planet",
      title: "Mercury greatest western elongation",
      date: "2026-11-21T00:00:00Z",
      elongation: 20,
      desc: "Mercury reaches greatest separation west of the Sun and is best placed in the morning sky.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "uranus-opp-2026",
      type: "planet",
      title: "Uranus at opposition",
      date: "2026-11-25T00:00:00Z",
      desc: "Uranus is opposite the Sun and visible all night. Binoculars or a small telescope reveal a pale green disk.",
      source: "Planetary opposition ephemeris",
    },
    {
      id: "ursids-2026",
      type: "meteor",
      title: "Ursid meteor shower peak",
      date: "2026-12-22T12:00:00Z",
      zhr: 10,
      radiant: { ra: 217, dec: 76, name: "Ursa Minor" },
      desc: "A short, low-rate shower from Comet 8P/Tuttle. The radiant stays high for northern observers.",
      source: "AMS / IMO 2026 calendar",
    },
    {
      id: "geminids-2026",
      type: "meteor",
      title: "Geminid meteor shower peak",
      date: "2026-12-14T07:00:00Z",
      zhr: 120,
      radiant: { ra: 112, dec: 33, name: "Gemini" },
      desc: "One of the year's richest showers. Bright, medium-speed meteors; the radiant is well up by midevening.",
      source: "AMS / IMO 2026 calendar",
    },
    {
      id: "venus-gwe-2027",
      type: "planet",
      title: "Venus greatest western elongation",
      date: "2027-01-03T00:00:00Z",
      elongation: 47,
      desc: "Venus stands farthest west of the Sun as a brilliant morning star.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "quadrantids-2027",
      type: "meteor",
      title: "Quadrantid meteor shower peak",
      date: "2027-01-03T15:00:00Z",
      zhr: 120,
      radiant: { ra: 230, dec: 49, name: "Boötes" },
      desc: "A sharp peak lasting only a few hours. Favorable moon; best for northern-hemisphere observers after midnight.",
      source: "AMS / IMO 2027 calendar",
    },
    {
      id: "encke-2027",
      type: "comet",
      title: "Comet 2P/Encke near perihelion",
      date: "2027-01-24T00:00:00Z",
      mag: 6.5,
      desc: "Short-period comet expected near binocular brightness around perihelion. Look low in the evening twilight for southern and mid-northern latitudes.",
      source: "BAA Comet Section / Seiichi Yoshida ephemeris",
    },
    {
      id: "mercury-gee-2027",
      type: "planet",
      title: "Mercury greatest eastern elongation",
      date: "2027-02-03T00:00:00Z",
      elongation: 18,
      desc: "Mercury is farthest east of the Sun and best seen in evening twilight.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "annular-solar-2027",
      type: "eclipse",
      subtype: "annular-solar",
      title: "Annular solar eclipse",
      date: "2027-02-06T16:00:00Z",
      path: "South America, Atlantic, West & Central Africa",
      desc: "A ring of fire along a path across southern South America and Africa. Outside the path, a partial eclipse is visible across much of South America and Africa.",
      source: "NASA GSFC Eclipse Catalog (Espenak)",
      visibility: {
        // Rough bounding boxes for partial visibility (lat/lon)
        regions: [
          { latMin: -55, latMax: 25, lonMin: -80, lonMax: 40 },
        ],
      },
    },
    {
      id: "jupiter-opp-2027",
      type: "planet",
      title: "Jupiter at opposition",
      date: "2027-02-11T00:00:00Z",
      desc: "Jupiter is closest and brightest for the year, rising at sunset and visible all night.",
      source: "Planetary opposition ephemeris",
    },
    {
      id: "mars-opp-2027",
      type: "planet",
      title: "Mars at opposition",
      date: "2027-02-19T00:00:00Z",
      desc: "Mars is opposite the Sun and well placed for telescopic viewing throughout the night.",
      source: "Planetary opposition ephemeris",
    },
    {
      id: "penumbral-lunar-2027",
      type: "eclipse",
      subtype: "penumbral-lunar",
      title: "Penumbral lunar eclipse · Snow Moon",
      date: "2027-02-20T23:13:00Z",
      desc: "The Snow Moon passes through Earth's shallow penumbra, producing a subtle shading across the full Moon. Visible wherever the Moon is above the horizon.",
      source: "NASA GSFC Eclipse Catalog (Espenak)",
    },
    {
      id: "mercury-gwe-2027",
      type: "planet",
      title: "Mercury greatest western elongation",
      date: "2027-03-17T00:00:00Z",
      elongation: 28,
      desc: "Favorable morning apparition of Mercury at greatest western elongation.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "lyrids-2027",
      type: "meteor",
      title: "Lyrid meteor shower peak",
      date: "2027-04-22T16:00:00Z",
      zhr: 18,
      radiant: { ra: 272, dec: 33, name: "Lyra" },
      desc: "Annual shower from Comet C/1861 G1 (Thatcher). A bright Moon will wash out fainter meteors this year.",
      source: "AMS / IMO 2027 calendar",
    },
  ];

  const state = {
    observer: { lat: 33.95, lon: -118.4, label: "Los Angeles, CA", zip: "90045" },
    events: [],
    featured: null,
    countdownTimer: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function waitForAstronomy() {
    return new Promise((resolve) => {
      if (typeof Astronomy !== "undefined") return resolve();
      const t = setInterval(() => {
        if (typeof Astronomy !== "undefined") {
          clearInterval(t);
          resolve();
        }
      }, 30);
    });
  }

  /* ---------- Geocoding ---------- */

  async function lookupZip(zip) {
    const res = await fetch(ZIP_URL + encodeURIComponent(zip));
    if (!res.ok) throw new Error("ZIP not found");
    const data = await res.json();
    const place = data.places && data.places[0];
    if (!place) throw new Error("ZIP not found");
    return {
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      label: `${place["place name"]}, ${place["state abbreviation"]}`,
      zip: data["post code"] || zip,
    };
  }

  async function searchPlace(query) {
    const zipMatch = query.match(/^\s*(\d{5})(?:-\d{4})?\s*$/);
    if (zipMatch) return lookupZip(zipMatch[1]);

    const url =
      GEOCODE_URL +
      "?name=" +
      encodeURIComponent(query) +
      "&count=5&language=en&format=json";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Lookup failed");
    const data = await res.json();
    const results = (data.results || []).filter((r) => r.country_code === "US" || !query.match(/,/));
    const pick = (data.results || [])[0];
    if (!pick) throw new Error("Place not found");
    // Prefer US if the query looks local
    const us = (data.results || []).find((r) => r.country_code === "US");
    const chosen = us || pick;
    const parts = [chosen.name];
    if (chosen.admin1) parts.push(chosen.admin1);
    if (chosen.country_code && chosen.country_code !== "US") parts.push(chosen.country_code);
    return {
      lat: chosen.latitude,
      lon: chosen.longitude,
      label: parts.join(", "),
      zip: null,
    };
  }

  /* ---------- Astronomy helpers ---------- */

  function moonDistanceKm(time) {
    const ill = Astronomy.Illumination(Astronomy.Body.Moon, time);
    return ill.geo_dist * 149597870.7;
  }

  function buildMoonEvents(now) {
    const out = [];
    let t = Astronomy.MakeTime(now);
    // Search forward from a bit before now so we catch current/upcoming
    t = t.AddDays(-2);
    for (let i = 0; i < 10; i++) {
      const fm = Astronomy.SearchMoonPhase(180, t, 40);
      if (!fm) break;
      const d = fm.date;
      if (d > HORIZON_END) break;
      const dist = moonDistanceKm(fm);
      const month = d.getUTCMonth() + 1;
      const name = MOON_NAMES[month] || "Full Moon";
      const isSuper = dist < SUPERMOON_KM;
      const title = isSuper ? `${name} (supermoon)` : name;
      let desc = `Full Moon`;
      if (isSuper) {
        desc = `Supermoon — the Moon is near perigee (${Math.round(dist).toLocaleString()} km), appearing slightly larger and brighter than average.`;
      } else {
        desc = `Full Moon at about ${Math.round(dist).toLocaleString()} km from Earth.`;
      }
      // Skip if this full moon coincides with penumbral eclipse (same day) — eclipse card covers it
      const eclipseDay = "2027-02-20";
      const dayStr = d.toISOString().slice(0, 10);
      if (dayStr === eclipseDay) {
        // Still include moon as part of eclipse event later; skip standalone
        t = fm.AddDays(1);
        continue;
      }
      if (d >= new Date(now.getTime() - 36 * 3600 * 1000)) {
        out.push({
          id: "fullmoon-" + dayStr,
          type: "moon",
          title,
          date: d.toISOString(),
          distKm: dist,
          supermoon: isSuper,
          desc,
          source: "Computed lunar phase",
        });
      }
      t = fm.AddDays(1);
    }
    return out;
  }

  function enrichLocal(event, observer) {
    const when = new Date(event.date);
    const time = Astronomy.MakeTime(when);
    const observerAstro = new Astronomy.Observer(observer.lat, observer.lon, 0);
    const local = { ...event.local };

    try {
      if (event.type === "moon" || event.subtype === "penumbral-lunar") {
        const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observerAstro, +1, time.AddDays(-1), 2);
        const set = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observerAstro, -1, time.AddDays(-0.5), 2);
        if (rise) local.moonrise = rise.date;
        if (set) local.moonset = set.date;
        const eq = Astronomy.Equator(Astronomy.Body.Moon, time, observerAstro, true, true);
        const hor = Astronomy.Horizon(time, observerAstro, eq.ra, eq.dec, "normal");
        local.altitude = hor.altitude;
        local.visible = hor.altitude > -0.5;
      }

      if (event.type === "meteor" && event.radiant) {
        // Radiant altitude at local 2 AM on peak night
        const local2am = new Date(when);
        // Approximate: use peak UTC; compute horizon of radiant
        const radEq = { ra: event.radiant.ra / 15, dec: event.radiant.dec }; // ra hours
        const hor = Astronomy.Horizon(time, observerAstro, radEq.ra, radEq.dec, "normal");
        local.radiantAlt = hor.altitude;
        local.bestHint =
          hor.altitude > 30
            ? "Radiant well placed at peak"
            : hor.altitude > 0
              ? "Radiant above horizon at peak"
              : "Radiant below horizon at this peak time — try later in the night";
      }

      if (event.type === "eclipse" && event.subtype === "annular-solar") {
        const start = Astronomy.MakeTime(new Date(when.getTime() - 2 * 86400000));
        const localEclipse = Astronomy.SearchLocalSolarEclipse(start, observerAstro);
        const peakMs = localEclipse && localEclipse.peak && localEclipse.peak.time.date.getTime();
        const near = peakMs && Math.abs(peakMs - when.getTime()) < 2 * 86400000;
        if (near) {
          local.eclipseVisible = true;
          const pct = Math.round((localEclipse.obscuration || 0) * 100);
          local.visibilityNote =
            localEclipse.kind === "annular"
              ? "Annular eclipse visible — about " + pct + "% obscured at peak"
              : "Partial solar eclipse visible — about " + pct + "% obscured at peak";
          local.eclipsePeak = localEclipse.peak.time.date;
        } else {
          local.eclipseVisible = false;
          local.visibilityNote = "Not visible from your location (path: " + event.path + ")";
        }
      }

      if (event.type === "eclipse" && event.subtype === "penumbral-lunar") {
        const eq = Astronomy.Equator(Astronomy.Body.Moon, time, observerAstro, true, true);
        const hor = Astronomy.Horizon(time, observerAstro, eq.ra, eq.dec, "normal");
        local.visible = hor.altitude > -0.5;
        local.altitude = hor.altitude;
        local.visibilityNote = local.visible
          ? "Moon above horizon at mid-eclipse from your location"
          : "Moon below horizon at mid-eclipse from your location";
      }

      if (event.type === "planet") {
        const bodyMap = {
          Mercury: Astronomy.Body.Mercury,
          Venus: Astronomy.Body.Venus,
          Mars: Astronomy.Body.Mars,
          Jupiter: Astronomy.Body.Jupiter,
          Uranus: Astronomy.Body.Uranus,
        };
        const name = event.title.split(" ")[0];
        const body = bodyMap[name];
        if (body) {
          const eq = Astronomy.Equator(body, time, observerAstro, true, true);
          const hor = Astronomy.Horizon(time, observerAstro, eq.ra, eq.dec, "normal");
          local.altitude = hor.altitude;
          const rise = Astronomy.SearchRiseSet(body, observerAstro, +1, time.AddDays(-0.5), 1.5);
          const set = Astronomy.SearchRiseSet(body, observerAstro, -1, time, 1.5);
          if (rise) local.rise = rise.date;
          if (set) local.set = set.date;
        }
      }
    } catch (err) {
      // localization soft-fail
    }

    // Moon illumination interference for meteors
    if (event.type === "meteor") {
      const ill = Astronomy.Illumination(Astronomy.Body.Moon, time);
      local.moonIllum = Math.round(ill.phase_fraction * 100);
      if (local.moonIllum >= 70) local.moonNote = "Bright Moon — fainter meteors washed out";
      else if (local.moonIllum >= 40) local.moonNote = "Moderate moonlight";
      else local.moonNote = "Dark skies favored";
    }

    return local;
  }

  function assembleEvents(now, observer) {
    const moons = buildMoonEvents(now);
    const all = [...STATIC_EVENTS, ...moons].map((e) => {
      const local = enrichLocal(e, observer);
      return { ...e, local, _date: new Date(e.date) };
    });
    all.sort((a, b) => a._date - b._date);
    return all.filter((e) => e._date <= HORIZON_END);
  }

  /* ---------- Formatting ---------- */

  function fmtDate(d, opts) {
    return new Intl.DateTimeFormat(undefined, opts || {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  }

  function fmtTime(d) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  }

  function fmtDateTime(d) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  }

  function countdownParts(target, now) {
    let ms = target - now;
    if (ms < 0) ms = 0;
    const sec = Math.floor(ms / 1000);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return { days, hours, mins, secs, done: target <= now };
  }

  function typeLabel(t) {
    return (
      {
        moon: "Full Moon",
        meteor: "Meteor Shower",
        eclipse: "Eclipse",
        planet: "Planet",
        comet: "Comet",
      }[t] || t
    );
  }

  /* ---------- Canvas art ---------- */

  function paintStars(ctx, w, h, seed) {
    let s = seed || 42;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 80; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = rnd() * 1.4 + 0.3;
      ctx.fillStyle = `rgba(220,230,255,${0.25 + rnd() * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMoon(ctx, cx, cy, r, phaseDeg, opts) {
    opts = opts || {};
    // phaseDeg: 0 new, 90 first quarter, 180 full, 270 last quarter
    ctx.save();
    // glow
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6);
    g.addColorStop(0, "rgba(200,210,255,0.35)");
    g.addColorStop(1, "rgba(200,210,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // disk
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = opts.tint || "#e8ecff";
    ctx.fill();

    // simple maria
    ctx.fillStyle = "rgba(120,130,160,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.25, cy - r * 0.1, r * 0.28, r * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.2, cy + r * 0.25, r * 0.2, r * 0.16, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // terminator shadow for non-full
    const alpha = ((phaseDeg % 360) + 360) % 360;
    if (alpha < 175 || alpha > 185) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
      ctx.clip();
      // illuminated fraction
      const waxing = alpha <= 180;
      const k = Math.cos((alpha * Math.PI) / 180); // 1 at new? wait: at 0 cos=1, at 180 cos=-1
      // Use illuminated fraction from phase: (1 - cos(phase))/2 for elongation from new... 
      // Simpler: draw dark ellipse overlay
      ctx.fillStyle = "rgba(5,6,15,0.92)";
      if (Math.abs(alpha - 180) > 5) {
        // Draw shade on the dark side
        const shadeRight = alpha < 180; // waxing: left lit → shade right? 
        // phase 0 = new (all dark), 90 = right lit, 180 = full, 270 = left lit
        ctx.beginPath();
        if (alpha <= 180) {
          // waxing: left dark
          ctx.arc(cx, cy, r + 1, Math.PI / 2, -Math.PI / 2, false);
          const rx = r * Math.cos((alpha * Math.PI) / 180);
          ctx.ellipse(cx, cy, Math.abs(rx), r + 1, 0, -Math.PI / 2, Math.PI / 2, alpha > 90);
        } else {
          // waning: right dark
          ctx.arc(cx, cy, r + 1, -Math.PI / 2, Math.PI / 2, false);
          const rx = r * Math.cos((alpha * Math.PI) / 180);
          ctx.ellipse(cx, cy, Math.abs(rx), r + 1, 0, Math.PI / 2, -Math.PI / 2, alpha < 270);
        }
        ctx.fill();
      }
    }

    if (opts.penumbra) {
      ctx.strokeStyle = "rgba(251,191,36,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(30,20,10,0.18)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMeteors(ctx, w, h, radiantX, radiantY) {
    paintStars(ctx, w, h, 77);
    // radiant glow
    const g = ctx.createRadialGradient(radiantX, radiantY, 2, radiantX, radiantY, 40);
    g.addColorStop(0, "rgba(125,211,252,0.8)");
    g.addColorStop(1, "rgba(125,211,252,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(radiantX, radiantY, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.arc(radiantX, radiantY, 3, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + 0.3;
      const dist = 50 + (i % 5) * 28;
      const len = 28 + (i % 4) * 12;
      const x1 = radiantX + Math.cos(ang) * dist;
      const y1 = radiantY + Math.sin(ang) * dist;
      const x2 = radiantX + Math.cos(ang) * (dist + len);
      const y2 = radiantY + Math.sin(ang) * (dist + len);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, "rgba(200,220,255,0)");
      grad.addColorStop(0.4, "rgba(125,211,252,0.3)");
      grad.addColorStop(1, "rgba(255,255,255,0.95)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 + (i % 3) * 0.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function drawEclipse(ctx, w, h, annular) {
    paintStars(ctx, w, h, 11);
    const cx = w * 0.5;
    const cy = h * 0.52;
    const sunR = Math.min(w, h) * 0.28;
    // sun
    const sg = ctx.createRadialGradient(cx, cy, sunR * 0.2, cx, cy, sunR * 1.4);
    sg.addColorStop(0, "rgba(255,220,120,0.9)");
    sg.addColorStop(0.5, "rgba(251,191,36,0.55)");
    sg.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fill();
    // moon silhouette
    const moonR = annular ? sunR * 0.92 : sunR * 1.02;
    ctx.fillStyle = "#05060f";
    ctx.beginPath();
    ctx.arc(cx + (annular ? 0 : sunR * 0.08), cy, moonR, 0, Math.PI * 2);
    ctx.fill();
    if (annular) {
      ctx.strokeStyle = "rgba(253,230,138,0.95)";
      ctx.lineWidth = sunR * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, sunR * 0.96, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlanet(ctx, w, h, kind) {
    paintStars(ctx, w, h, kind === "Mercury" ? 3 : kind === "Venus" ? 5 : kind === "Mars" ? 7 : kind === "Jupiter" ? 9 : 13);
    const cx = w * 0.5;
    const cy = h * 0.55;
    const colors = {
      Mercury: ["#c4b5fd", "#a78bfa"],
      Venus: ["#fde68a", "#fbbf24"],
      Mars: ["#fda4af", "#f43f5e"],
      Jupiter: ["#fdba74", "#f97316"],
      Uranus: ["#99f6e4", "#2dd4bf"],
    };
    const [c1, c2] = colors[kind] || ["#7dd3fc", "#38bdf8"];
    const r = Math.min(w, h) * (kind === "Jupiter" ? 0.28 : kind === "Venus" ? 0.22 : 0.18);
    // orbit ring
    ctx.strokeStyle = "rgba(232,236,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * 1.8, r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (kind === "Jupiter") {
      ctx.strokeStyle = "rgba(120,60,20,0.35)";
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy + i * r * 0.22, r * 0.95, r * 0.12, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (kind === "Saturn") {
      /* unused */
    }
    // sun glow off to side for elongation events
    if (kind === "Mercury" || kind === "Venus") {
      const sx = w * 0.12;
      const sy = h * 0.3;
      const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 35);
      sg.addColorStop(0, "rgba(253,230,138,0.9)");
      sg.addColorStop(1, "rgba(253,230,138,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, 35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawComet(ctx, w, h) {
    paintStars(ctx, w, h, 21);
    const cx = w * 0.62;
    const cy = h * 0.4;
    // tail
    const g = ctx.createLinearGradient(cx, cy, w * 0.05, h * 0.85);
    g.addColorStop(0, "rgba(167,139,250,0.7)");
    g.addColorStop(0.4, "rgba(125,211,252,0.25)");
    g.addColorStop(1, "rgba(125,211,252,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.05, h * 0.85);
    ctx.quadraticCurveTo(w * 0.35, h * 0.55, cx, cy + 8);
    ctx.closePath();
    ctx.fill();
    // coma
    const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
    cg.addColorStop(0, "rgba(255,255,255,0.95)");
    cg.addColorStop(0.3, "rgba(200,220,255,0.6)");
    cg.addColorStop(1, "rgba(125,211,252,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  function planetKindFromTitle(title) {
    const names = ["Mercury", "Venus", "Mars", "Jupiter", "Uranus", "Saturn"];
    return names.find((n) => title.startsWith(n)) || "Mercury";
  }

  function renderFeaturedArt(event) {
    const canvas = $("featured-canvas");
    if (!canvas || !event) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 420;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = cssW;
    const h = cssH;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    if (event.type === "moon") {
      paintStars(ctx, w, h, 55);
      drawMoon(ctx, w * 0.5, h * 0.52, Math.min(w, h) * 0.28, 180, {
        tint: event.supermoon ? "#f0f4ff" : "#e8ecff",
      });
    } else if (event.type === "meteor") {
      drawMeteors(ctx, w, h, w * 0.35, h * 0.3);
    } else if (event.type === "eclipse") {
      drawEclipse(ctx, w, h, event.subtype === "annular-solar");
      if (event.subtype === "penumbral-lunar") {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#05060f";
        ctx.fillRect(0, 0, w, h);
        paintStars(ctx, w, h, 17);
        drawMoon(ctx, w * 0.5, h * 0.52, Math.min(w, h) * 0.28, 180, { penumbra: true });
      }
    } else if (event.type === "planet") {
      drawPlanet(ctx, w, h, planetKindFromTitle(event.title));
    } else if (event.type === "comet") {
      drawComet(ctx, w, h);
    }
  }

  function renderCardArt(canvas, event) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth || 88;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = size;
    const h = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    if (event.type === "moon") {
      paintStars(ctx, w, h, 8);
      drawMoon(ctx, w / 2, h / 2, w * 0.32, 180);
    } else if (event.type === "meteor") {
      drawMeteors(ctx, w, h, w * 0.35, h * 0.3);
    } else if (event.type === "eclipse") {
      if (event.subtype === "penumbral-lunar") {
        paintStars(ctx, w, h, 4);
        drawMoon(ctx, w / 2, h / 2, w * 0.3, 180, { penumbra: true });
      } else {
        drawEclipse(ctx, w, h, true);
      }
    } else if (event.type === "planet") {
      drawPlanet(ctx, w, h, planetKindFromTitle(event.title));
    } else if (event.type === "comet") {
      drawComet(ctx, w, h);
    }
  }

  /* ---------- UI ---------- */

  function pickFeatured(events, now) {
    const upcoming = events.filter((e) => e._date.getTime() + 12 * 3600 * 1000 >= now.getTime());
    return upcoming[0] || events[events.length - 1] || null;
  }

  function renderFeatured(event, now) {
    state.featured = event;
    if (!event) return;
    $("featured-kicker").textContent = event._date > now ? "Next up" : "Now";
    $("featured-title").textContent = event.title;
    $("featured-when").textContent = fmtDateTime(event._date);
    $("featured-desc").textContent = event.desc;

    const meta = $("featured-meta");
    meta.innerHTML = "";
    const rows = [];
    rows.push(["Type", typeLabel(event.type)]);
    if (event.zhr) rows.push(["Peak ZHR", String(event.zhr)]);
    if (event.radiant) rows.push(["Radiant", event.radiant.name]);
    if (event.elongation) rows.push(["Elongation", event.elongation + "°"]);
    if (event.distKm) rows.push(["Distance", Math.round(event.distKm).toLocaleString() + " km"]);
    if (event.mag) rows.push(["Est. magnitude", "~" + event.mag]);
    if (event.path) rows.push(["Path", event.path]);
    if (event.local) {
      if (event.local.moonIllum != null) rows.push(["Moon", event.local.moonIllum + "% lit"]);
      if (event.local.moonNote) rows.push(["Sky", event.local.moonNote]);
      if (event.local.radiantAlt != null)
        rows.push(["Radiant alt.", Math.round(event.local.radiantAlt) + "°"]);
      if (event.local.visibilityNote) rows.push(["Visibility", event.local.visibilityNote]);
      if (event.local.moonrise) rows.push(["Moonrise", fmtTime(event.local.moonrise)]);
      if (event.local.rise) rows.push(["Rise", fmtTime(event.local.rise)]);
      if (event.local.set) rows.push(["Set", fmtTime(event.local.set)]);
    }
    rows.push(["Location", state.observer.label]);
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      meta.appendChild(dt);
      meta.appendChild(dd);
    }

    renderFeaturedArt(event);
    updateCountdown();
  }

  function updateCountdown() {
    const el = $("featured-countdown");
    const event = state.featured;
    if (!el || !event) return;
    const now = new Date();
    const parts = countdownParts(event._date, now);
    if (parts.done) {
      el.textContent = "Peak window";
      return;
    }
    const bits = [];
    if (parts.days) bits.push(parts.days + "d");
    bits.push(String(parts.hours).padStart(2, "0") + "h");
    bits.push(String(parts.mins).padStart(2, "0") + "m");
    bits.push(String(parts.secs).padStart(2, "0") + "s");
    el.textContent = bits.join(" ");
  }

  function renderGrid(events, now) {
    const grid = $("event-grid");
    grid.innerHTML = "";
    for (const event of events) {
      const past = event._date.getTime() + 18 * 3600 * 1000 < now.getTime();
      const card = document.createElement("article");
      card.className = "event-card" + (past ? " past" : "");
      card.dataset.id = event.id;

      const art = document.createElement("div");
      art.className = "card-art";
      const canvas = document.createElement("canvas");
      canvas.width = 88;
      canvas.height = 88;
      art.appendChild(canvas);

      const body = document.createElement("div");
      body.className = "card-body";
      const type = document.createElement("div");
      type.className = "card-type";
      type.textContent = typeLabel(event.type);
      const h3 = document.createElement("h3");
      h3.textContent = event.title;
      const date = document.createElement("div");
      date.className = "card-date";
      date.textContent = fmtDate(event._date);
      const note = document.createElement("div");
      note.className = "card-note";
      let noteText = "";
      if (event.zhr) noteText = "ZHR ~" + event.zhr;
      if (event.local && event.local.moonNote) noteText += (noteText ? " · " : "") + event.local.moonNote;
      if (event.local && event.local.visibilityNote) noteText = event.local.visibilityNote;
      if (event.supermoon) noteText = "Near perigee";
      if (event.elongation) noteText = event.elongation + "° from the Sun";
      if (event.mag) noteText = "Est. mag ~" + event.mag;
      note.textContent = noteText;

      body.appendChild(type);
      body.appendChild(h3);
      body.appendChild(date);
      if (noteText) body.appendChild(note);
      if (event.supermoon) {
        const b = document.createElement("span");
        b.className = "badge";
        b.textContent = "Supermoon";
        body.appendChild(b);
      }
      if (event.local && event.local.eclipseVisible === false) {
        const b = document.createElement("span");
        b.className = "badge warn";
        b.textContent = "Not visible here";
        body.appendChild(b);
      }

      card.appendChild(art);
      card.appendChild(body);
      grid.appendChild(card);
      renderCardArt(canvas, event);
    }
  }

  function refresh() {
    const now = new Date();
    state.events = assembleEvents(now, state.observer);
    const featured = pickFeatured(state.events, now);
    renderFeatured(featured, now);
    renderGrid(state.events, now);
  }

  async function applyLocation(query) {
    const err = $("loc-error");
    err.hidden = true;
    try {
      const place = await searchPlace(query.trim());
      state.observer = {
        lat: place.lat,
        lon: place.lon,
        label: place.label,
        zip: place.zip,
      };
      $("loc-resolved").textContent =
        place.label +
        " · " +
        place.lat.toFixed(2) +
        "°, " +
        place.lon.toFixed(2) +
        "°";
      refresh();
    } catch (e) {
      err.textContent = "Could not find that location. Try a US ZIP or city name.";
      err.hidden = false;
    }
  }

  async function init() {
    await waitForAstronomy();
    $("loc-form").addEventListener("submit", (e) => {
      e.preventDefault();
      applyLocation($("loc-input").value);
    });

    // Default location
    try {
      await applyLocation(DEFAULT_ZIP);
    } catch (e) {
      state.observer = { lat: 33.95, lon: -118.4, label: "Los Angeles, CA", zip: "90045" };
      $("loc-resolved").textContent = "Los Angeles, CA · 33.95°, −118.40°";
      refresh();
    }

    state.countdownTimer = setInterval(updateCountdown, 1000);
    window.addEventListener("resize", () => {
      if (state.featured) renderFeaturedArt(state.featured);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
