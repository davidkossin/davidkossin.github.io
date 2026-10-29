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
      parent: "55P/Tempel–Tuttle",
      desc: "A meteor shower occurs when Earth plows through a stream of dust left by a comet or asteroid; the grains burn up as meteors. The Leonids come from debris shed by Comet 55P/Tempel–Tuttle, and their trails appear to radiate from the constellation Leo. This year’s expected zenithal hourly rate is about 15 under dark skies, with the best viewing in the hours before dawn after the radiant rises.",
      source: "AMS / IMO 2026 calendar",
    },
    {
      id: "mercury-gwe-2026",
      type: "planet",
      title: "Mercury greatest western elongation",
      date: "2026-11-21T00:00:00Z",
      elongation: 20,
      desc: "Mercury never strays far from the Sun in our sky because its orbit lies inside Earth’s. Greatest western elongation is the morning when that angular separation peaks, so Mercury stands highest before sunrise. At about 20° from the Sun this apparition, look low in the east-southeast during dawn twilight.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "uranus-opp-2026",
      type: "planet",
      title: "Uranus at opposition",
      date: "2026-11-25T00:00:00Z",
      desc: "Opposition is when a planet lies opposite the Sun as seen from Earth, so it rises at sunset and is up all night. Uranus reaches that geometry now and is at its closest for the year, shining as a faint magnitude-5.6 “star.” Binoculars or a small telescope can reveal its pale green disk.",
      source: "Planetary opposition ephemeris",
    },
    {
      id: "ursids-2026",
      type: "meteor",
      title: "Ursid meteor shower peak",
      date: "2026-12-22T12:00:00Z",
      zhr: 10,
      radiant: { ra: 217, dec: 76, name: "Ursa Minor" },
      parent: "8P/Tuttle",
      desc: "The Ursids are meteors from dust released by Comet 8P/Tuttle. Earth crosses that stream each December, and the trails appear to radiate from near the bowl of the Little Dipper in Ursa Minor. Rates are modest (zenithal hourly rate near 10), but the radiant stays high all night for northern observers, so a short watch under dark skies can still be rewarding.",
      source: "AMS / IMO 2026 calendar",
    },
    {
      id: "geminids-2026",
      type: "meteor",
      title: "Geminid meteor shower peak",
      date: "2026-12-14T07:00:00Z",
      zhr: 120,
      radiant: { ra: 112, dec: 33, name: "Gemini" },
      parent: "3200 Phaethon",
      desc: "The Geminids are among the year’s richest showers. Unlike most major showers, their parent is the asteroid-like body 3200 Phaethon, whose debris stream Earth crosses each mid-December. Bright, medium-speed meteors appear to radiate from Gemini; under ideal conditions the zenithal hourly rate can reach about 120, and the radiant is already well up by midevening.",
      source: "AMS / IMO 2026 calendar",
    },
    {
      id: "venus-gwe-2027",
      type: "planet",
      title: "Venus greatest western elongation",
      date: "2027-01-03T00:00:00Z",
      elongation: 47,
      desc: "Venus, an inferior planet, reaches greatest western elongation when its angle from the Sun is largest on the morning side of the sky. At roughly 47° this apparition, it is a brilliant “morning star” high before sunrise. Through a telescope its disk shows a half-lit phase near this date, similar to a first-quarter Moon.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "quadrantids-2027",
      type: "meteor",
      title: "Quadrantid meteor shower peak",
      date: "2027-01-03T15:00:00Z",
      zhr: 120,
      radiant: { ra: 230, dec: 49, name: "Boötes" },
      parent: "2003 EH1",
      desc: "The Quadrantids arise when Earth crosses debris linked to the asteroid 2003 EH1, thought to be a remnant of a defunct comet. Their peak is famously brief—often only a few hours—yet the zenithal hourly rate can approach 120. The radiant lies in northern Boötes (once the obsolete constellation Quadrans Muralis); northern-hemisphere observers after midnight fare best, and the Moon is favorably dark this year.",
      source: "AMS / IMO 2027 calendar",
    },
    {
      id: "encke-2027",
      type: "comet",
      title: "Comet 2P/Encke near perihelion",
      date: "2027-01-24T00:00:00Z",
      mag: 6.5,
      desc: "Comet 2P/Encke is a short-period comet that returns every 3.3 years on a tight orbit around the Sun. Near perihelion it brightens as solar heat drives gas and dust from its nucleus into a coma and tail. Forecasts put it near binocular brightness (about magnitude 6–7) this return; look low in evening twilight from southern and mid-northern latitudes.",
      source: "BAA Comet Section / Seiichi Yoshida ephemeris",
    },
    {
      id: "mercury-gee-2027",
      type: "planet",
      title: "Mercury greatest eastern elongation",
      date: "2027-02-03T00:00:00Z",
      elongation: 18,
      desc: "Greatest eastern elongation places Mercury farthest east of the Sun, so it appears in the western sky after sunset. Mercury’s elongation never exceeds about 28°, and this evening apparition peaks near 18°. Catch it low in bright twilight with a clear western horizon; binoculars help pick it out against the dusk glow.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "annular-solar-2027",
      type: "eclipse",
      subtype: "annular-solar",
      title: "Annular solar eclipse",
      date: "2027-02-06T16:00:00Z",
      path: "South America, Atlantic, West & Central Africa",
      desc: "A solar eclipse happens when the New Moon passes between Earth and the Sun. In an annular eclipse the Moon is near apogee, so its apparent disk is slightly smaller than the Sun’s and a bright ring—“ring of fire”—remains. The path of annularity crosses southern South America and Africa; outside that path a partial eclipse is visible across much of those continents.",
      source: "NASA GSFC Eclipse Catalog (Espenak)",
      visibility: {
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
      desc: "At opposition Jupiter, Earth, and the Sun line up with Earth in the middle, so Jupiter is closest and brightest for the year. It rises near sunset and stays visible all night. Even small telescopes show its cloud belts and the four bright Galilean moons shifting from night to night.",
      source: "Planetary opposition ephemeris",
    },
    {
      id: "mars-opp-2027",
      type: "planet",
      title: "Mars at opposition",
      date: "2027-02-19T00:00:00Z",
      desc: "Mars reaches opposition when it lies opposite the Sun in our sky—Earth is then between Mars and the Sun, and the planet is near its closest approach of the cycle. It rises at sunset and is observable all night. Telescopes can show the ochre disk, dark markings, and polar caps when the atmosphere is steady.",
      source: "Planetary opposition ephemeris",
    },
    {
      id: "penumbral-lunar-2027",
      type: "eclipse",
      subtype: "penumbral-lunar",
      title: "Penumbral lunar eclipse · Snow Moon",
      date: "2027-02-20T23:13:00Z",
      desc: "A lunar eclipse occurs when the Full Moon passes through Earth’s shadow. In a penumbral eclipse the Moon only grazes the outer, partial shadow (the penumbra), so the shading is subtle rather than a deep red umbral eclipse. This event coincides with the Snow Moon and is visible from anywhere the Moon is above the horizon during the eclipse.",
      source: "NASA GSFC Eclipse Catalog (Espenak)",
    },
    {
      id: "mercury-gwe-2027",
      type: "planet",
      title: "Mercury greatest western elongation",
      date: "2027-03-17T00:00:00Z",
      elongation: 28,
      desc: "Mercury reaches greatest western elongation—its largest morning separation from the Sun—near 28°, close to the maximum possible. That geometry lifts it higher before sunrise than most apparitions. Look east in morning twilight for a starlike point that does not twinkle as strongly as the background stars.",
      source: "Planetary elongation ephemeris",
    },
    {
      id: "lyrids-2027",
      type: "meteor",
      title: "Lyrid meteor shower peak",
      date: "2027-04-22T16:00:00Z",
      zhr: 18,
      radiant: { ra: 272, dec: 33, name: "Lyra" },
      parent: "C/1861 G1 (Thatcher)",
      desc: "The Lyrids are an annual shower produced when Earth crosses dust left by Comet C/1861 G1 (Thatcher). Meteors appear to radiate from Lyra, near the bright star Vega. Typical zenithal hourly rates are near 18; this year a bright Moon will wash out fainter streaks, so expect mainly the brighter members under darker parts of the sky.",
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
      const distLabel = Math.round(dist).toLocaleString();
      let desc;
      if (isSuper) {
        desc =
          "A supermoon is a Full Moon that occurs near perigee—the closest point in the Moon’s elliptical orbit around Earth. At about " +
          distLabel +
          " km, this " +
          name +
          " appears roughly 7% larger and about 15% brighter than an average full Moon (and up to ~14% larger / ~30% brighter than a full Moon near apogee). The traditional name marks the season in folklore; the size boost is purely geometric.";
      } else {
        desc =
          "Full Moon happens when the Moon lies opposite the Sun, so its Earth-facing hemisphere is fully illuminated. This " +
          name +
          " is about " +
          distLabel +
          " km away. Traditional full-Moon names follow the season; the Moon’s changing distance along its elliptical orbit is what makes some full Moons look slightly larger than others.";
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
    const descEl = $("featured-desc");
    descEl.textContent = event.desc;
    descEl.classList.add("has-science");

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

  function localDetailRows(event) {
    const rows = [];
    if (!event.local) return rows;
    const L = event.local;
    if (L.moonIllum != null) rows.push(["Moon", L.moonIllum + "% lit"]);
    if (L.moonNote) rows.push(["Sky", L.moonNote]);
    if (L.radiantAlt != null) rows.push(["Radiant alt.", Math.round(L.radiantAlt) + "°"]);
    if (L.bestHint) rows.push(["Radiant", L.bestHint]);
    if (L.visibilityNote) rows.push(["Visibility", L.visibilityNote]);
    if (L.moonrise) rows.push(["Moonrise", fmtTime(L.moonrise)]);
    if (L.moonset) rows.push(["Moonset", fmtTime(L.moonset)]);
    if (L.rise) rows.push(["Rise", fmtTime(L.rise)]);
    if (L.set) rows.push(["Set", fmtTime(L.set)]);
    if (L.altitude != null && (event.type === "moon" || event.subtype === "penumbral-lunar"))
      rows.push(["Altitude at event", Math.round(L.altitude) + "°"]);
    if (event.parent) rows.push(["Parent body", event.parent]);
    if (event.zhr) rows.push(["Peak ZHR", String(event.zhr)]);
    if (event.elongation) rows.push(["Elongation", event.elongation + "°"]);
    if (event.distKm) rows.push(["Distance", Math.round(event.distKm).toLocaleString() + " km"]);
    if (event.mag) rows.push(["Est. magnitude", "~" + event.mag]);
    if (event.path) rows.push(["Path", event.path]);
    return rows;
  }

  function setCardExpanded(card, open) {
    const btn = card.querySelector(".card-toggle");
    const panel = card.querySelector(".card-panel");
    if (!btn || !panel) return;
    card.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function renderGrid(events, now) {
    const grid = $("event-grid");
    grid.innerHTML = "";
    for (const event of events) {
      const past = event._date.getTime() + 18 * 3600 * 1000 < now.getTime();
      const card = document.createElement("article");
      card.className = "event-card" + (past ? " past" : "");
      card.dataset.id = event.id;

      const panelId = "detail-" + event.id;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "card-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", panelId);
      toggle.setAttribute(
        "aria-label",
        event.title + ", " + fmtDate(event._date) + ". Show details."
      );

      const summary = document.createElement("div");
      summary.className = "card-summary";

      const art = document.createElement("div");
      art.className = "card-art";
      art.setAttribute("aria-hidden", "true");
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

      const chevron = document.createElement("span");
      chevron.className = "card-chevron";
      chevron.setAttribute("aria-hidden", "true");

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

      summary.appendChild(art);
      summary.appendChild(body);
      summary.appendChild(chevron);
      toggle.appendChild(summary);

      const panel = document.createElement("div");
      panel.className = "card-panel";
      panel.id = panelId;
      panel.setAttribute("aria-hidden", "true");
      const panelInner = document.createElement("div");
      panelInner.className = "card-panel-inner";
      const science = document.createElement("p");
      science.className = "card-science";
      science.textContent = event.desc;
      panelInner.appendChild(science);

      const rows = localDetailRows(event);
      if (rows.length) {
        const dl = document.createElement("dl");
        dl.className = "card-meta";
        for (const [k, v] of rows) {
          const dt = document.createElement("dt");
          dt.textContent = k;
          const dd = document.createElement("dd");
          dd.textContent = v;
          dl.appendChild(dt);
          dl.appendChild(dd);
        }
        panelInner.appendChild(dl);
      }
      panel.appendChild(panelInner);

      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        // one open at a time
        grid.querySelectorAll(".event-card.is-open").forEach((other) => {
          if (other !== card) setCardExpanded(other, false);
        });
        setCardExpanded(card, open);
        toggle.setAttribute(
          "aria-label",
          event.title +
            ", " +
            fmtDate(event._date) +
            (open ? ". Hide details." : ". Show details.")
        );
      });

      card.appendChild(toggle);
      card.appendChild(panel);
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
