(function () {
  "use strict";

  /* ---------- constants ---------- */
  var AU_KM = 149597870.7;
  var SUN_R_KM = 695700;
  var LIGHT_MIN_PER_AU = 499.004784 / 60;
  var D2R = Math.PI / 180;
  var TAU = Math.PI * 2;
  var J2000 = 2451545.0;

  /* Standish / JPL approximate Keplerian elements, 1800 AD - 2050 AD.
     [a, da, e, de, I, dI, L, dL, varpi, dvarpi, Omega, dOmega] (AU, deg; rates per Julian century) */
  var PLANETS = [
    {
      name: "Mercury", color: "#b9b2a8", req: 2440.5, rkm: 2439.7,
      el: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
      stats: { diameter: "4,879 km", mass: "3.30 × 10²³ kg", avg: "0.387 AU · 57.9 million km", period: "87.97 days", day: "175.9 days (solar day)", moons: "0", gravity: "3.70 m/s²", temp: "167 °C" },
      fact: "The smallest planet and the closest to the Sun. Its daytime surface reaches about 430 °C while the night side falls to about −180 °C.",
      moons: []
    },
    {
      name: "Venus", color: "#e8c98e", req: 6051.8, rkm: 6051.8,
      el: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
      stats: { diameter: "12,104 km", mass: "4.87 × 10²⁴ kg", avg: "0.723 AU · 108.2 million km", period: "224.7 days", day: "116.7 days (solar day)", moons: "0", gravity: "8.87 m/s²", temp: "464 °C" },
      fact: "The hottest planet, with a surface pressure about 92 times Earth's. It spins backwards, so the Sun rises in the west.",
      moons: []
    },
    {
      name: "Earth", color: "#6fa8dc", req: 6378.1, rkm: 6371.0,
      el: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
      stats: { diameter: "12,742 km", mass: "5.97 × 10²⁴ kg", avg: "1.000 AU · 149.6 million km", period: "365.25 days", day: "24 hours", moons: "1", gravity: "9.81 m/s²", temp: "15 °C" },
      fact: "The only known world with life. About 71% of its surface is covered by liquid water.",
      moons: [
        { name: "Moon", a: 384400, P: 27.321662, L0: 218.316, r: 1737, fact: "Always keeps the same face toward Earth." }
      ]
    },
    {
      name: "Mars", color: "#d9775a", req: 3396.2, rkm: 3389.5,
      el: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
      stats: { diameter: "6,779 km", mass: "6.42 × 10²³ kg", avg: "1.524 AU · 227.9 million km", period: "687 days", day: "24 h 37 min", moons: "2", gravity: "3.71 m/s²", temp: "−65 °C" },
      fact: "Home to Olympus Mons, the tallest volcano in the solar system at roughly 22 km high.",
      moons: [
        { name: "Phobos", a: 9376, P: 0.31891, L0: 150, r: 11, fact: "Orbits Mars in under eight hours, faster than Mars rotates." },
        { name: "Deimos", a: 23463, P: 1.26244, L0: 40, r: 6, fact: "The smaller and outer of Mars's two moons." }
      ]
    },
    {
      name: "Jupiter", color: "#d8b48c", req: 71492, rkm: 69911,
      el: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
      stats: { diameter: "139,820 km", mass: "1.90 × 10²⁷ kg", avg: "5.204 AU · 778.5 million km", period: "11.86 years", day: "9 h 56 min", moons: "95", gravity: "24.8 m/s²", temp: "−110 °C (cloud tops)" },
      fact: "Its mass is more than twice that of all the other planets combined. The Great Red Spot is a storm wider than Earth that has been observed for centuries.",
      moons: [
        { name: "Amalthea", a: 181366, P: 0.49818, L0: 20, r: 84, fact: "A reddish, irregular moon about 250 km long." },
        { name: "Io", a: 421700, P: 1.769138, L0: 106.08, r: 1822, fact: "The most volcanically active body in the solar system." },
        { name: "Europa", a: 671034, P: 3.551181, L0: 175.73, r: 1561, fact: "Hides a global ocean of liquid water beneath its ice shell." },
        { name: "Ganymede", a: 1070412, P: 7.154553, L0: 120.56, r: 2634, fact: "The largest moon in the solar system, bigger than Mercury." },
        { name: "Callisto", a: 1882709, P: 16.689018, L0: 84.44, r: 2410, fact: "One of the most heavily cratered surfaces known." }
      ]
    },
    {
      name: "Saturn", color: "#e3d3a0", req: 60268, rkm: 58232, rings: [[74500, 92000], [92000, 117580], [122170, 136775]],
      el: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
      stats: { diameter: "116,460 km", mass: "5.68 × 10²⁶ kg", avg: "9.537 AU · 1.43 billion km", period: "29.45 years", day: "10 h 33 min", moons: "274", gravity: "10.4 m/s²", temp: "−140 °C (cloud tops)" },
      fact: "The least dense planet, less dense than water. Its rings span about 280,000 km yet are often only around 10 meters thick.",
      moons: [
        { name: "Mimas", a: 185539, P: 0.942422, L0: 100, r: 198, fact: "Its giant Herschel crater gives it a Death Star look." },
        { name: "Enceladus", a: 238042, P: 1.370218, L0: 30, r: 252, fact: "Geysers near its south pole vent water ice into space." },
        { name: "Tethys", a: 294672, P: 1.887802, L0: 250, r: 531, fact: "Composed almost entirely of water ice." },
        { name: "Dione", a: 377415, P: 2.736915, L0: 160, r: 561, fact: "An icy moon with bright, cliff-like fractures." },
        { name: "Rhea", a: 527068, P: 4.5175, L0: 300, r: 764, fact: "Saturn's second-largest moon." },
        { name: "Titan", a: 1221870, P: 15.945421, L0: 70, r: 2575, fact: "Has a thick atmosphere and lakes of liquid methane and ethane." },
        { name: "Iapetus", a: 3560820, P: 79.3215, L0: 200, r: 735, fact: "One hemisphere is dark and the other bright, and an equatorial ridge circles it." }
      ]
    },
    {
      name: "Uranus", color: "#8fd3d6", req: 25559, rkm: 25362,
      el: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
      stats: { diameter: "50,724 km", mass: "8.68 × 10²⁵ kg", avg: "19.19 AU · 2.87 billion km", period: "84.01 years", day: "17 h 14 min", moons: "29", gravity: "8.69 m/s²", temp: "−195 °C" },
      fact: "Its axis is tilted about 98°, so it rolls around the Sun on its side. It has recorded the coldest planetary atmosphere, near −224 °C.",
      moons: [
        { name: "Miranda", a: 129900, P: 1.413479, L0: 60, r: 236, fact: "Features Verona Rupes, a cliff up to about 20 km high." },
        { name: "Ariel", a: 190900, P: 2.520379, L0: 200, r: 579, fact: "The brightest of Uranus's major moons." },
        { name: "Umbriel", a: 266000, P: 4.144176, L0: 320, r: 585, fact: "The darkest of Uranus's major moons." },
        { name: "Titania", a: 436300, P: 8.705872, L0: 110, r: 789, fact: "The largest moon of Uranus." },
        { name: "Oberon", a: 583500, P: 13.463239, L0: 250, r: 761, fact: "The outermost of Uranus's five major moons." }
      ]
    },
    {
      name: "Neptune", color: "#6f86e8", req: 24764, rkm: 24622,
      el: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
      stats: { diameter: "49,244 km", mass: "1.02 × 10²⁶ kg", avg: "30.07 AU · 4.50 billion km", period: "164.8 years", day: "16 h 6 min", moons: "16", gravity: "11.2 m/s²", temp: "−200 °C" },
      fact: "Winds reach over 1,800 km/h, the fastest in the solar system. It was found in 1846 after its position was predicted mathematically.",
      moons: [
        { name: "Proteus", a: 117647, P: 1.122315, L0: 130, r: 210, fact: "Neptune's second-largest moon." },
        { name: "Triton", a: 354759, P: -5.876854, L0: 280, r: 1353, fact: "Orbits Neptune backwards and is likely a captured Kuiper belt object." }
      ]
    }
  ];

  /* Voyager state vectors from JPL Horizons (Sun-centred, ecliptic J2000), 2026-01-01 00:00 UTC */
  var VOY_JD = 2461041.5;
  var VOYAGERS = [
    { id: "v1", name: "Voyager 1", color: "#f4d58d",
      p: [-4.762659739242758e9, -2.014761457045306e10, 1.457753551876435e10],
      v: [-2.072816913981589, -13.61111711012975, 9.834684958533998] },
    { id: "v2", name: "Voyager 2", color: "#9be3c5",
      p: [5.868355260926653e9, -1.555691440749276e10, -1.315244404280593e10],
      v: [4.203428908881701, -9.341334116213933, -11.3209912742229] }
  ];

  /* ---------- orbital mechanics ---------- */
  function julian(ms) { return ms / 86400000 + 2440587.5; }

  function solveKepler(M, e) {
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
    var E = M + e * Math.sin(M);
    for (var i = 0; i < 12; i++) {
      var d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return E;
  }

  function elementsAt(el, T) {
    var a = el[0] + el[1] * T, e = el[2] + el[3] * T, I = (el[4] + el[5] * T) * D2R;
    var L = el[6] + el[7] * T, w = el[8] + el[9] * T, O = (el[10] + el[11] * T) * D2R;
    var M = (L - w) * D2R;
    var om = w * D2R - O;
    var E = solveKepler(M, e);
    return {
      a: a, e: e, E: E, b: a * Math.sqrt(1 - e * e),
      cO: Math.cos(O), sO: Math.sin(O), cI: Math.cos(I), sI: Math.sin(I), co: Math.cos(om), so: Math.sin(om)
    };
  }

  function orbitXY(o, E, out) {
    var xv = o.a * (Math.cos(E) - o.e), yv = o.b * Math.sin(E);
    out[0] = (o.co * o.cO - o.so * o.sO * o.cI) * xv + (-o.so * o.cO - o.co * o.sO * o.cI) * yv;
    out[1] = (o.co * o.sO + o.so * o.cO * o.cI) * xv + (-o.so * o.sO + o.co * o.cO * o.cI) * yv;
    out[2] = (o.so * o.sI) * xv + (o.co * o.sI) * yv;
    out[3] = Math.hypot(xv, yv);
    return out;
  }

  function planetState(jd) {
    var T = (jd - J2000) / 36525, res = [];
    for (var i = 0; i < PLANETS.length; i++) {
      var o = elementsAt(PLANETS[i].el, T), p = orbitXY(o, o.E, [0, 0, 0, 0]);
      res.push({ x: p[0], y: p[1], z: p[2], r: p[3], lon: ((Math.atan2(p[1], p[0]) / D2R) % 360 + 360) % 360, o: o });
    }
    return res;
  }

  function voyagerState(jd) {
    var dt = (jd - VOY_JD) * 86400;
    return VOYAGERS.map(function (v) {
      var x = (v.p[0] + v.v[0] * dt) / AU_KM, y = (v.p[1] + v.v[1] * dt) / AU_KM, z = (v.p[2] + v.v[2] * dt) / AU_KM;
      return { x: x, y: y, z: z, r: Math.sqrt(x * x + y * y + z * z), lon: ((Math.atan2(y, x) / D2R) % 360 + 360) % 360 };
    });
  }

  /* ---------- additional small moons (drawn as unlabeled points) ---------- */
  var MOON_GM = { Jupiter: 1.26687e8, Saturn: 3.7931e7, Uranus: 5.794e6, Neptune: 6.8365e6 };
  var MOON_TOTAL = { Earth: 1, Mars: 2, Jupiter: 95, Saturn: 274, Uranus: 29, Neptune: 16 };
  // [a km, period days (negative = retrograde)] for moons with known orbits
  var KNOWN_SMALL = {
    Jupiter: [[128000, 0.295], [129000, 0.298], [221900, 0.6745], [7393000, 130], [11165000, 240.9], [11460000, 250.6], [11717000, 259.2], [11741000, 259.6], [17144000, 456], [18928000, 533]],
    Saturn: [[133584, 0.575], [136505, 0.594], [137670, 0.602], [139380, 0.613], [141720, 0.629], [151422, 0.694], [151472, 0.695], [167500, 0.808], [194440, 1.01], [197700, 1.037], [212280, 1.154], [294710, 1.888], [294710, 1.888], [377200, 2.737], [377396, 2.737], [1481100, 21.28], [12947780, -550.3],
      [11111000, 449], [11442000, 451], [15200000, 687], [17538000, 896], [18239000, 926], [16393000, 783], [17343000, 871], [15541000, -728], [18628000, -952], [19007000, -1004], [19459000, -1017], [20314000, -1088], [23040000, -1315]],
    Uranus: [[49770, 0.335], [53790, 0.376], [59170, 0.435], [61780, 0.464], [62680, 0.474], [64350, 0.493], [66090, 0.513], [69940, 0.558], [74800, 0.618], [75260, 0.624], [76400, 0.638], [86010, 0.762], [97700, 0.923],
      [4276000, -267], [7231000, -580], [7948000, -677], [8504000, -749], [12179000, -1288], [14345000, 1661], [16256000, -1978], [17418000, -2225], [20901000, -2887]],
    Neptune: [[48227, 0.294], [50075, 0.311], [52526, 0.335], [61953, 0.429], [73548, 0.555], [105283, 0.95], [5513400, 360.1], [16681000, -1879], [22422000, 2914], [23571000, 3168], [46695000, -9074], [48387000, -9740]]
  };
  // [count (0 = fill remainder), a min, a max, direction] bands for moons without individual data
  var FILL_BANDS = {
    Jupiter: [[5, 11.1e6, 12.0e6, 1], [20, 20.7e6, 22.0e6, -1], [28, 22.7e6, 23.9e6, -1], [20, 23.0e6, 24.8e6, -1], [0, 18.5e6, 29.0e6, -1]],
    Saturn: [[25, 11.0e6, 18.0e6, 1], [20, 16.5e6, 19.5e6, 1], [0, 12.0e6, 25.0e6, -1]],
    Uranus: [[0, 7.0e6, 20.5e6, -1]],
    Neptune: [[0, 15.0e6, 50.0e6, -1]]
  };
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  PLANETS.forEach(function (P, pi) {
    P.extras = [];
    var known = KNOWN_SMALL[P.name]; if (!known) return;
    var rnd = mulberry(1234 + pi * 977), gm = MOON_GM[P.name];
    function add(a, Pd, dir) {
      var per = Pd ? Pd : dir * 2 * Math.PI * Math.sqrt(a * a * a / gm) / 86400;
      P.extras.push({ a: a, P: per, L0: rnd() * 360 });
    }
    known.forEach(function (k) { add(k[0], k[1]); });
    var want = MOON_TOTAL[P.name] - P.moons.length - P.extras.length;
    var bands = FILL_BANDS[P.name], used = 0, b, n, i;
    for (b = 0; b < bands.length; b++) {
      n = bands[b][0] || Math.max(0, want - used);
      n = Math.min(n, want - used);
      for (i = 0; i < n; i++) {
        // radii cluster toward the middle of each band
        var u = (rnd() + rnd()) / 2;
        add(bands[b][1] + (bands[b][2] - bands[b][1]) * u, 0, bands[b][3]);
      }
      used += n;
    }
  });

  function moonAngle(m, jd) {
    return (m.L0 + 360 * (jd - J2000) / m.P) * D2R;
  }

  /* ---------- time ---------- */
  var q = new URLSearchParams(location.search);
  var fixedT = q.get("t") ? Date.parse(q.get("t")) : NaN;
  var t0Real = Date.now();
  function nowMs() { return isNaN(fixedT) ? Date.now() : fixedT + (Date.now() - t0Real); }

  window.__orrery = { planetState: planetState, voyagerState: voyagerState, julian: julian, moonAngle: moonAngle, PLANETS: PLANETS };

  /* ---------- formatting ---------- */
  function commas(n) { return Math.round(n).toLocaleString("en-US"); }
  function fmtAU(a) { return a >= 100 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a.toFixed(3); }
  function fmtKm(km) {
    if (km >= 1e9) return (km / 1e9).toFixed(km >= 1e10 ? 1 : 2) + " billion km";
    if (km >= 1e6) return (km / 1e6).toFixed(km >= 1e8 ? 1 : 2).replace(/\.?0+$/, "") + " million km";
    return commas(km) + " km";
  }
  function fmtLight(au) {
    var s = au * LIGHT_MIN_PER_AU * 60;
    function g(v) { return v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, ""); }
    if (s < 60) return g(s) + " light-seconds";
    if (s < 3600) return g(s / 60) + " light-minutes";
    if (s < 86400) return g(s / 3600) + " light-hours";
    if (s < 86400 * 365.25) return g(s / 86400) + " light-days";
    return g(s / 86400 / 365.25) + " light-years";
  }
  function niceFloor(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- DOM ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("orrery"), ctx = canvas.getContext("2d");
  var elClock = $("clock"), elSwitch = $("scaleSwitch"), elChips = $("chips"), elZoomCtl = $("zoomctl"), elBack = $("back");
  var elPanel = $("panel"), elMoonCard = $("moonCard"), elTip = $("tip"), elKeyBar = $("keyBar"), elBarLine = $("barLine"), elBarLabel = $("barLabel"), elKeyText = $("keyText");
  var elControls = $("controls");

  /* ---------- state ---------- */
  var W = 0, H = 0, dpr = 1;
  var scaleOn = false, s = 0;            // To Scale toggle and its animated value 0..1
  var sel = -1;                           // selected planet
  var loc = -1, lTarget = 0, l = 0;       // local (moon) view
  var selMoon = -1;
  var cam = { x: 0, y: 0, ppa: 10 }, tween = null;
  var cz = { k: 1, x: 0, y: 0 }, lz = { k: 1, x: 0, y: 0 }, vtween = null, frameDt = 0.016, uiR = [];
  var CZ_MAX = 14, LZ_MIN = 0.6, LZ_MAX = 12;
  var vr = { x0: 0, y0: 0, x1: 100, y1: 100 };
  var hover = null;                       // {type, i, j}
  var hoverAmt = {};                      // smooth hover values
  var hits = [];
  var labelPrev = {};
  var mouse = { x: 0, y: 0, in: false };
  var pl = null, vy = null, jd = 0;
  var lastTs = 0;

  function isMobile() { return W <= 720; }

  /* ---------- asteroid / Kuiper belt (deterministic) ---------- */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeBelt(n, rmin, rmax, seed, gaps, shape) {
    var rnd = mulberry(seed), out = [];
    while (out.length < n) {
      var u = rnd(), r = rmin + (rmax - rmin) * (shape ? shape(u) : u);
      var ok = true;
      for (var g = 0; g < gaps.length; g++) if (Math.abs(r - gaps[g]) < 0.022 && rnd() < 0.85) ok = false;
      if (!ok) continue;
      out.push({ r: r + (rnd() - 0.5) * 0.04, th: rnd() * TAU, n: TAU / (Math.pow(r, 1.5) * 365.25) });
    }
    return out;
  }
  var ASTEROIDS = makeBelt(2600, 2.1, 3.3, 12345, [2.5, 2.82, 2.95, 3.27], function (u) { return 0.5 + (u - 0.5) * (0.9 + 0.1 * Math.abs(u - 0.5) * 2) + 0 * u; });
  var KUIPER = makeBelt(1800, 30, 50, 777, [], function (u) { return Math.pow(u, 1.3) * 0.75 + u * 0.25 * u; });

  /* ---------- view mapping ---------- */
  var COMP_C = 0.6;
  var COMP_K = Math.log(1 + 31 / COMP_C);
  function compR(r) { return Math.log(1 + r / COMP_C) / COMP_K; }
  function vrW() { return vr.x1 - vr.x0; }
  function vrH() { return vr.y1 - vr.y0; }
  function cx0() { return (vr.x0 + vr.x1) / 2; }
  function cy0() { return (vr.y0 + vr.y1) / 2; }
  function Rc() { return 0.43 * Math.min(vrW(), vrH()); }
  function ppaFit() { return 0.43 * Math.min(vrW(), vrH()) / 31; }
  function ppaMin() { return 0.43 * Math.min(W, H) / 215; }
  var PPA_MAX = 4e6;
  var out2 = [0, 0];
  function toScreen(x, y, o) {
    var r = Math.hypot(x, y), k = r > 1e-9 ? compR(r) / r * Rc() : 0;
    var ax = cx0() + x * k, ay = cy0() - y * k;
    ax = cx0() + (ax - cx0()) * cz.k + cz.x; ay = cy0() + (ay - cy0()) * cz.k + cz.y;
    var bx = cx0() + (x - cam.x) * cam.ppa, by = cy0() - (y - cam.y) * cam.ppa;
    o[0] = ax + (bx - ax) * s; o[1] = ay + (by - ay) * s;
    return o;
  }

  /* ---------- label placement ---------- */
  var MAXLEN = 34, LENS = [14, 24, MAXLEN], LAB_H = 16;
  var ANG_DEG = [-45, -135, 45, 135, 0, -90, 180, 90, -22, -68, -112, -158, 22, 68, 112, 158, -10, -80, -100, -170, 10, 80, 100, 170];
  var ANGLES = ANG_DEG.map(function (d) { return [Math.cos(d * D2R), Math.sin(d * D2R)]; });
  var ANG_PEN = ANG_DEG.map(function (d, i) { return i < 4 ? i * 8 : 40 + (i - 4) * 2; });
  var labelState = {};
  var measureCache = {};
  function measure(font, t) {
    var k = font + "|" + t;
    if (measureCache[k] === undefined) { ctx.font = font; measureCache[k] = ctx.measureText(t).width; }
    return measureCache[k];
  }
  function ovArea(a, b, pad) {
    var w = Math.min(a.x1, b.x1 + pad) - Math.max(a.x0, b.x0 - pad), h = Math.min(a.y1, b.y1 + pad) - Math.max(a.y0, b.y0 - pad);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function ptIn(x, y, r) { return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1; }
  function labGeom(x, y, reff, dx, dy, len, tw) {
    var sx = x + dx * (reff + 3), sy = y + dy * (reff + 3), ex = sx + dx * len, ey = sy + dy * len, right = dx >= 0, ty = ey + dy * 5;
    var rect = right ? { x0: ex + 3, x1: ex + 5 + tw, y0: ty - LAB_H / 2, y1: ty + LAB_H / 2 } : { x0: ex - 5 - tw, x1: ex - 3, y0: ty - LAB_H / 2, y1: ty + LAB_H / 2 };
    return { sx: sx, sy: sy, ex: ex, ey: ey, ty: ty, right: right, rect: rect };
  }

  function placeLabels(items, bounds, font, opts) {
    opts = opts || {};
    var placed = [], ui = bounds.ui || [], cap = bounds.rcap || 1e9;
    var obst = items.map(function (it) { var r = Math.min(it.obr !== undefined ? it.obr : it.r, cap) + 3; return { x0: it.x - r, x1: it.x + r, y0: it.y - r, y1: it.y + r, id: it.id }; });
    if (bounds.extra) bounds.extra.forEach(function (e) { obst.push(e); });
    var order = items.slice().sort(function (a, b) { return (b.force ? 1 : 0) - (a.force ? 1 : 0) || (a.pri || 0) - (b.pri || 0); });
    order.forEach(function (it) {
      var tw = measure(font, it.text), reff = Math.min(it.r, cap), area = (tw + 4) * LAB_H;
      var st = labelState[it.id];
      if (!st) st = labelState[it.id] = { dx: 0.7071, dy: -0.7071, len: LENS[0], a: 0, vis: true, ai: -1, li: -1, init: false };
      var best = null, ai, li, i, j;
      for (ai = 0; ai < ANGLES.length; ai++) {
        for (li = 0; li < LENS.length; li++) {
          var g = labGeom(it.x, it.y, reff, ANGLES[ai][0], ANGLES[ai][1], LENS[li], tw), r = g.rect, col = 0, oob = 0;
          oob = area - Math.max(0, Math.min(r.x1, bounds.x1) - Math.max(r.x0, bounds.x0)) * Math.max(0, Math.min(r.y1, bounds.y1) - Math.max(r.y0, bounds.y0));
          for (i = 0; i < placed.length; i++) col += 1.5 * ovArea(r, placed[i], 2);
          for (j = 0; j < obst.length; j++) if (obst[j].id !== it.id) {
            col += 2 * ovArea(r, obst[j], 1);
            if (ptIn((g.sx + g.ex) / 2, (g.sy + g.ey) / 2, obst[j]) || ptIn(g.ex, g.ey, obst[j])) col += 120;
          }
          for (i = 0; i < ui.length; i++) col += 3 * ovArea(r, ui[i], 2);
          var pen = col + 3 * oob + ANG_PEN[ai] + LENS[li] * 0.5;
          if (st.ai === ai) pen -= st.li === li ? 40 : 22;
          if (!best || pen < best.pen) best = { pen: pen, col: col, oob: oob, ai: ai, li: li, g: g };
        }
      }
      var hide = best.oob > 0.6 * area || (bounds.vis && (it.x < bounds.vis.x0 || it.x > bounds.vis.x1 || it.y < bounds.vis.y0 || it.y > bounds.vis.y1));
      if (!hide && opts.canHide && !it.force) hide = best.col > (st.vis ? 0.5 : 0.2) * area;
      st.vis = !hide;
      var tdx = ANGLES[best.ai][0], tdy = ANGLES[best.ai][1], tlen = LENS[best.li];
      if (!st.init) { st.dx = tdx; st.dy = tdy; st.len = tlen; st.a = st.vis ? 1 : 0; st.init = true; }
      st.ai = best.ai; st.li = best.li;
      var f = 1 - Math.pow(1e-5, frameDt);
      st.dx += (tdx - st.dx) * f; st.dy += (tdy - st.dy) * f;
      var nl = Math.hypot(st.dx, st.dy) || 1; st.dx /= nl; st.dy /= nl;
      st.len += (tlen - st.len) * f;
      st.a += ((st.vis ? 1 : 0) - st.a) * f; if (Math.abs((st.vis ? 1 : 0) - st.a) < 0.01) st.a = st.vis ? 1 : 0;
      if (st.vis) placed.push(best.g.rect);
      it.lab = st; it.tw = tw; it.reff = reff;
      it.geo = labGeom(it.x, it.y, reff, st.dx, st.dy, st.len, tw);
      it.visible = st.a > 0.02;
      it.rect = st.a > 0.5 ? it.geo.rect : null;
    });
  }

  function drawLabel(it, alpha, font) {
    if (!it.visible) return;
    var g = it.geo, h = it.h || 0;
    ctx.globalAlpha = alpha * it.lab.a * (0.8 + 0.2 * h);
    ctx.strokeStyle = "rgba(210,218,255," + (0.4 + 0.5 * h) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(g.ex, g.ey); ctx.stroke();
    ctx.font = font; ctx.textBaseline = "middle"; ctx.textAlign = g.right ? "left" : "right";
    var tx = g.right ? g.ex + 4 : g.ex - 4;
    ctx.lineJoin = "round"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(5,8,22,0.75)"; ctx.strokeText(it.text, tx, g.ty + 0.5);
    ctx.fillStyle = h > 0.05 ? "#ffffff" : "rgba(226,231,255,0.9)";
    ctx.fillText(it.text, tx, g.ty + 0.5);
    ctx.globalAlpha = 1;
  }

  function uiRects() {
    var out = [];
    [elControls, elZoomCtl, elBack, $("heading"), elPanel, $("key")].forEach(function (e) {
      if (!e || e.hidden) return;
      var r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom });
    });
    return out;
  }

  /* ---------- drawing: solar scene ---------- */
  var tmp = [0, 0];
  var orbitBuf = [0, 0, 0, 0];
  var PLANET_FONT = "400 12.5px Outfit, sans-serif";
  var MOON_FONT = "400 11.5px Outfit, sans-serif";

  function hAmt(id, target) {
    var v = hoverAmt[id] || 0;
    v += (target - v) * 0.22;
    if (Math.abs(target - v) < 0.01) v = target;
    hoverAmt[id] = v;
    return v;
  }

  function drawSolar(alpha, forHits) {
    var cx = cx0(), cy = cy0();
    var i, k;
    var sunPx = [0, 0]; toScreen(0, 0, sunPx);
    var sunR = lerp(11, Math.max(1.3, SUN_R_KM / AU_KM * cam.ppa), s);
    sunR = Math.min(sunR, 1e5);

    ctx.globalAlpha = alpha;

    /* belts */
    var A = 0.5 * alpha;
    ctx.fillStyle = "rgba(190,198,230,0.42)";
    ctx.globalAlpha = alpha;
    var dd = jd - J2000;
    for (i = 0; i < ASTEROIDS.length; i++) {
      var a = ASTEROIDS[i], th = a.th + a.n * dd;
      toScreen(a.r * Math.cos(th), a.r * Math.sin(th), tmp);
      ctx.fillRect(tmp[0] - 0.5, tmp[1] - 0.5, 1, 1);
    }
    if (s > 0.01) {
      ctx.globalAlpha = alpha * s * 0.7;
      ctx.fillStyle = "rgba(150,170,230,0.4)";
      for (i = 0; i < KUIPER.length; i++) {
        var b = KUIPER[i], tb = b.th + b.n * dd;
        toScreen(b.r * Math.cos(tb), b.r * Math.sin(tb), tmp);
        ctx.fillRect(tmp[0] - 0.5, tmp[1] - 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = alpha;

    /* orbits */
    var N = 360;
    for (i = 0; i < PLANETS.length; i++) {
      var o = pl[i].o, h = hAmt("o" + i, (hover && hover.type === "planet" && hover.i === i) ? 1 : 0);
      var selF = sel === i ? 1 : 0;
      ctx.beginPath();
      for (k = -N; k <= N; k++) {
        var u = k / N, E = o.E + Math.PI * Math.sign(u) * Math.pow(Math.abs(u), 3);
        orbitXY(o, E, orbitBuf);
        toScreen(orbitBuf[0], orbitBuf[1], tmp);
        if (k === -N) ctx.moveTo(tmp[0], tmp[1]); else ctx.lineTo(tmp[0], tmp[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(190,205,255," + (0.2 + 0.5 * h + 0.2 * selF) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* sun glow */
    var gr = Math.min(lerp(sunR * 4 + 40, sunR * 2.4 + 14, s), 4000);
    var g = ctx.createRadialGradient(sunPx[0], sunPx[1], 0, sunPx[0], sunPx[1], gr);
    g.addColorStop(0, "rgba(255,226,160,0.55)");
    g.addColorStop(Math.min(0.99, sunR / gr), "rgba(255,200,110,0.32)");
    g.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sunPx[0], sunPx[1], gr, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff3d0";
    ctx.beginPath(); ctx.arc(sunPx[0], sunPx[1], sunR, 0, TAU); ctx.fill();

    /* planets */
    var items = [];
    for (i = 0; i < PLANETS.length; i++) {
      var P = PLANETS[i];
      toScreen(pl[i].x, pl[i].y, tmp);
      var tr = P.req / AU_KM * cam.ppa;
      var cr = 2.4 + 6.4 * Math.sqrt(P.req / 71492);
      var rr = lerp(cr, Math.max(tr, 1.2), s);
      rr = Math.min(rr, 1e5);
      var hv = hAmt("p" + i, (hover && hover.type === "planet" && hover.i === i) ? 1 : 0);
            items.push({ id: "p" + i, i: i, x: tmp[0], y: tmp[1], r: rr, text: P.name, h: sel === i ? 1 : hv, force: hv > 0.5 || sel === i, color: P.color, pri: 8 - i });
    }
    var bounds = { x0: 6, x1: W - 6, y0: 6, y1: H - 6, ui: uiR, rcap: 0.3 * Math.min(vrW(), vrH()), vis: { x0: -4, x1: vr.x1 + 4, y0: -4, y1: vr.y1 + 4 } };
    bounds.extra = [{ x0: sunPx[0] - Math.min(sunR, 60) - 4, x1: sunPx[0] + Math.min(sunR, 60) + 4, y0: sunPx[1] - Math.min(sunR, 60) - 4, y1: sunPx[1] + Math.min(sunR, 60) + 4, id: "sun" }];

    /* voyagers (items) */
    var vitems = [];
    if (s > 0.01) {
      for (i = 0; i < VOYAGERS.length; i++) {
        toScreen(vy[i].x, vy[i].y, tmp);
        var hvv = hAmt("v" + i, (hover && hover.type === "voy" && hover.i === i) ? 1 : 0);
        vitems.push({ id: "v" + i, i: i, x: tmp[0], y: tmp[1], r: 3, text: VOYAGERS[i].name, h: hvv, force: hvv > 0.5, color: VOYAGERS[i].color, pri: 3.5 });
      }
    }
    placeLabels(items.concat(vitems), bounds, PLANET_FONT, { canHide: s > 0.5 });

    items.forEach(function (it) {
      var P = PLANETS[it.i], sunDir = [sunPx[0] - it.x, sunPx[1] - it.y], sl = Math.hypot(sunDir[0], sunDir[1]) || 1;
      var r = it.r, h = it.h;
      if (h > 0.01 || sel === it.i) {
        var ha = Math.max(h, sel === it.i ? 0.55 : 0);
        var gg = ctx.createRadialGradient(it.x, it.y, r, it.x, it.y, r + 14);
        gg.addColorStop(0, hexA(P.color, 0.45 * ha)); gg.addColorStop(1, hexA(P.color, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(it.x, it.y, r + 14, 0, TAU); ctx.fill();
        ctx.strokeStyle = hexA("#ffffff", 0.7 * ha); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(it.x, it.y, r + 4 + 1.5 * h, 0, TAU); ctx.stroke();
      }
      if (r < 3 && s > 0.4) {
        ctx.strokeStyle = hexA(P.color, 0.28 * s); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(it.x, it.y, 6, 0, TAU); ctx.stroke();
      }
      if (P.rings && r > 2.5) { // saturn ring hint in true/compressed sizes
        ctx.strokeStyle = hexA(P.color, 0.5); ctx.lineWidth = Math.max(1, r * 0.18);
        ctx.beginPath(); ctx.ellipse(it.x, it.y, r * 1.9, r * 0.55, -0.35, 0, TAU); ctx.stroke();
      }
      var grd = ctx.createRadialGradient(it.x + sunDir[0] / sl * r * 0.35, it.y + sunDir[1] / sl * r * 0.35, r * 0.1, it.x, it.y, r);
      grd.addColorStop(0, lighten(P.color, 0.35)); grd.addColorStop(1, P.color);
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, TAU); ctx.fill();
    });

    vitems.forEach(function (it) {
      var a2 = alpha * s, h = it.h;
      ctx.globalAlpha = a2;
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(it.x, it.y, 2.2 + h, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(it.color, 0.4 + 0.4 * h); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(it.x, it.y, 6 + 2 * h, 0, TAU); ctx.stroke();
      ctx.globalAlpha = alpha;
    });
    ctx.globalAlpha = alpha * 1;
    items.forEach(function (it) { drawLabel(it, alpha, PLANET_FONT); });
    vitems.forEach(function (it) { drawLabel(it, alpha * s, PLANET_FONT); });
    ctx.globalAlpha = 1;

    if (forHits) {
      hits = [];
      items.forEach(function (it) { hits.push({ type: "planet", i: it.i, x: it.x, y: it.y, r: Math.max(it.r + 6, 13), lab: it.rect }); });
      if (s > 0.5) vitems.forEach(function (it) { hits.push({ type: "voy", i: it.i, x: it.x, y: it.y, r: 13, lab: it.rect }); });
    }
    return items;
  }

  /* ---------- drawing: local (moon) scene ---------- */
  function localLayout() {
    var P = PLANETS[loc], w = vrW(), h = vrH(), m = Math.min(w, h);
    var Rp = Math.max(14, Math.min(34, m * 0.055));
    var Rmax = m * 0.40;
    var amax = P.moons.length ? P.moons[P.moons.length - 1].a : 6 * P.req;
    var base = 1.5 * P.req;
    var den = Math.log(amax / base);
    var aout = amax;
    P.extras.forEach(function (e) { if (e.a > aout) aout = e.a; });
    var Rout = Math.min(m * 0.465, Rmax + 0.075 * m), denO = Math.log(aout / amax);
    function map(a) {
      if (a <= base) return Rp * a / P.req;
      if (a > amax) return denO > 0 ? Rmax + (Rout - Rmax) * Math.log(a / amax) / denO : Rmax;
      return 1.5 * Rp + (Rmax - 1.5 * Rp) * Math.log(a / base) / den;
    }
    return { P: P, Rp: Rp, Rmax: Rmax, map: map, cx: cx0(), cy: cy0() };
  }

  function localE() { return loc >= 0 ? localLayout().Rmax : 100; }
  function localBar(L) {
    var cands = [], p, m;
    for (p = 2; p <= 8; p++) { cands.push(1 * Math.pow(10, p), 2 * Math.pow(10, p), 5 * Math.pow(10, p)); }
    var best = cands[0];
    for (var i = 0; i < cands.length; i++) { if (L.map(cands[i]) * lz.k <= L.Rmax * 0.62) best = cands[i]; }
    return { km: best, px: Math.max(4, L.map(best) * lz.k) };
  }

  var moonItems = [];
  function drawLocal(alpha, forHits) {
    var L = localLayout(), P = L.P, kz = lz.k, cx = L.cx + lz.x, cy = L.cy + lz.y, i;
    var Rp = L.Rp * kz;
    ctx.globalAlpha = alpha;
    // soft glow behind planet
    var gl = ctx.createRadialGradient(cx, cy, Rp, cx, cy, Rp * 3.4);
    gl.addColorStop(0, hexA(P.color, 0.22)); gl.addColorStop(1, hexA(P.color, 0));
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, Rp * 3.4, 0, TAU); ctx.fill();

    // rings
    if (P.rings) {
      ctx.lineCap = "butt";
      P.rings.forEach(function (rg, idx) {
        var r0 = L.map(rg[0]) * kz, r1 = L.map(rg[1]) * kz;
        ctx.strokeStyle = hexA(P.color, idx === 1 ? 0.6 : 0.42);
        ctx.lineWidth = r1 - r0;
        ctx.beginPath(); ctx.arc(cx, cy, (r0 + r1) / 2, 0, TAU); ctx.stroke();
      });
    }
    // orbits
    P.moons.forEach(function (m, j) {
      var h = hAmt("mo" + j, (hover && hover.type === "moon" && hover.j === j) || selMoon === j ? 1 : 0);
      ctx.strokeStyle = "rgba(190,205,255," + (0.12 + 0.45 * h) + ")"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, L.map(m.a) * kz, 0, TAU); ctx.stroke();
    });
    // planet
    var grd = ctx.createRadialGradient(cx - Rp * 0.3, cy - Rp * 0.3, Rp * 0.1, cx, cy, Rp);
    grd.addColorStop(0, lighten(P.color, 0.35)); grd.addColorStop(1, P.color);
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.fill();

    if (P.extras.length) {
      ctx.fillStyle = "rgba(200,208,235,0.5)";
      for (i = 0; i < P.extras.length; i++) {
        var e = P.extras[i], te = moonAngle(e, jd), re = L.map(e.a) * kz;
        ctx.beginPath(); ctx.arc(cx + re * Math.cos(te), cy - re * Math.sin(te), 1.25, 0, TAU); ctx.fill();
      }
    }
    var items = [{ id: "lp", text: P.name, x: cx, y: cy, r: P.rings ? L.map(P.rings[2][1]) * kz : Rp, obr: Rp, h: 0, force: true, pri: -1 }];
    moonItems = [];
    P.moons.forEach(function (m, j) {
      var th = moonAngle(m, jd), rr = L.map(m.a) * kz;
      var x = cx + rr * Math.cos(th), y = cy - rr * Math.sin(th);
      var mr = 2.6 + 3.4 * Math.sqrt(m.r / 2634);
      var h = hAmt("mh" + j, (hover && hover.type === "moon" && hover.j === j) || selMoon === j ? 1 : 0);
      var it = { id: "m" + j, j: j, text: m.name, x: x, y: y, r: mr, h: h, force: h > 0.5, pri: -m.r / 1000 };
      items.push(it); moonItems.push(it);
    });
    var bounds = { x0: 6, x1: W - 6, y0: 6, y1: H - 6, ui: uiR, rcap: 0.3 * Math.min(vrW(), vrH()), vis: { x0: -4, x1: vr.x1 + 4, y0: -4, y1: vr.y1 + 4 } };
    placeLabels(items, bounds, MOON_FONT, {});
    moonItems.forEach(function (it) {
      var h = it.h;
      if (h > 0.01) {
        var gg = ctx.createRadialGradient(it.x, it.y, it.r, it.x, it.y, it.r + 12);
        gg.addColorStop(0, "rgba(255,255,255," + 0.35 * h + ")"); gg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(it.x, it.y, it.r + 12, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "#d9dcec";
      ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); ctx.fill();
    });
    items.forEach(function (it) { drawLabel(it, alpha, it.id === "lp" ? PLANET_FONT : MOON_FONT); });
    if (!P.moons.length) {
      ctx.globalAlpha = alpha * 0.8; ctx.fillStyle = "#9aa3c7"; ctx.font = "300 13px Outfit, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("No moons", cx, cy + Rp + 30);
    }
    ctx.globalAlpha = 1;
    if (forHits) {
      hits = [];
      moonItems.forEach(function (it) { hits.push({ type: "moon", j: it.j, x: it.x, y: it.y, r: Math.max(it.r + 6, 13), lab: it.rect }); });
    }
    return L;
  }

  /* ---------- helpers ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function hexA(h, a) { var c = rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function lighten(h, f) { var c = rgb(h); return "rgb(" + c.map(function (v) { return Math.round(v + (255 - v) * f); }).join(",") + ")"; }

  /* ---------- camera ---------- */
  function clampCam() {
    cam.ppa = Math.max(ppaMin(), Math.min(PPA_MAX, cam.ppa));
    cam.x = Math.max(-400, Math.min(400, cam.x)); cam.y = Math.max(-400, Math.min(400, cam.y));
  }
  function camTo(x, y, ppa, dur) {
    ppa = Math.max(ppaMin(), Math.min(PPA_MAX, ppa));
    tween = { t0: performance.now(), dur: dur || 1100, from: { x: cam.x, y: cam.y, p: cam.ppa }, to: { x: x, y: y, p: ppa } };
  }
  function zoomAt(mx, my, f) {
    tween = null;
    var wx = cam.x + (mx - cx0()) / cam.ppa, wy = cam.y - (my - cy0()) / cam.ppa;
    cam.ppa = Math.max(ppaMin(), Math.min(PPA_MAX, cam.ppa * f));
    cam.x = wx - (mx - cx0()) / cam.ppa; cam.y = wy + (my - cy0()) / cam.ppa;
    clampCam();
  }
  function clampView(v, E) {
    v.k = v.k;
    var lim = Math.max(0, v.k - 1) * E;
    v.x = Math.max(-lim, Math.min(lim, v.x)); v.y = Math.max(-lim, Math.min(lim, v.y));
  }
  function zoomView(v, mx, my, f, kmin, kmax, E) {
    var k2 = Math.max(kmin, Math.min(kmax, v.k * f)), r = k2 / v.k, ox = mx - cx0(), oy = my - cy0();
    v.x = ox - (ox - v.x) * r; v.y = oy - (oy - v.y) * r; v.k = k2; clampView(v, E);
  }
  function viewTo(v, k, x, y, dur) {
    vtween = { v: v, t0: performance.now(), dur: dur || 600, from: { k: v.k, x: v.x, y: v.y }, to: { k: k, x: x, y: y } };
  }
  function zoomBy(mx, my, f) {
    if (lTarget === 1) { if (l < 0.9) return; vtween = null; zoomView(lz, mx, my, f, LZ_MIN, LZ_MAX, localE()); }
    else if (l > 0.02) return;
    else if (scaleOn) zoomAt(mx, my, f);
    else { vtween = null; zoomView(cz, mx, my, f, 1, CZ_MAX, Rc()); }
  }
  function panBy(dx, dy) {
    if (lTarget === 1) { if (l < 0.9) return; vtween = null; lz.x += dx; lz.y += dy; clampView(lz, localE()); }
    else if (l > 0.02) return;
    else if (scaleOn) { tween = null; cam.x -= dx / cam.ppa; cam.y += dy / cam.ppa; clampCam(); }
    else { vtween = null; cz.x += dx; cz.y += dy; clampView(cz, Rc()); }
  }
  function jump(id) {
    if (id === "fit") { camTo(0, 0, ppaFit(), 1000); return; }
    var idx = id === "v1" ? 0 : 1, v = vy[idx];
    var rp = Math.hypot(v.x, v.y);
    var ppa = Math.min(vrW(), vrH()) * 0.5 / (rp / 2 * 1.45);
    camTo(v.x / 2, v.y / 2, ppa, 1300);
  }

  /* ---------- panel ---------- */
  function buildPanel(i) {
    var P = PLANETS[i], st = P.stats;
    var rows = [
      ["Diameter", st.diameter], ["Mass", st.mass], ["Distance from Sun (average)", st.avg],
      ["Distance from Sun (now)", '<span id="pNow"></span>'], ["Orbital period", st.period], ["Day length", st.day],
      ["Natural Satellites", st.moons], ["Surface gravity", st.gravity], ["Average temperature", st.temp]
    ];
    elPanel.innerHTML =
      '<div class="sheet-grip" aria-hidden="true"></div>' +
      '<div class="panel-head"><span class="dot" style="background:' + P.color + ';color:' + P.color + '"></span><h2>' + P.name + '</h2><button class="close" type="button" aria-label="Close">&times;</button></div>' +
      "<dl>" + rows.map(function (r) { return '<div class="row"><dt>' + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>" +
      '<p class="facts">' + esc(P.fact) + "</p>" +
      '<button class="zoom-btn" type="button" id="zoomBtn"></button>';
    elPanel.querySelector(".close").addEventListener("click", closePanel);
    $("zoomBtn").addEventListener("click", function () { if (loc === i && lTarget === 1) endLocal(); else startLocal(i); });
    updatePanelButton();
    updatePanelLive();
    elPanel.scrollTop = 0;
  }
  function updatePanelButton() {
    var b = $("zoomBtn"); if (!b) return;
    b.textContent = (lTarget === 1 && loc === sel) ? "Back to solar system" : "Zoom into " + PLANETS[sel].name;
  }
  function updatePanelLive() {
    var e = $("pNow"); if (!e || sel < 0 || !pl) return;
    e.textContent = fmtAU(pl[sel].r) + " AU · " + fmtKm(pl[sel].r * AU_KM);
  }
  function selectPlanet(i) {
    selMoon = -1; elMoonCard.hidden = true;
    var wasOpen = sel >= 0;
    sel = i;
    if (lTarget === 1 && loc !== i) { /* switching planet while zoomed is not exposed */ }
    elPanel.hidden = false; document.body.classList.add("panel-open");
    buildPanel(i);
  }
  function closePanel() {
    sel = -1; elPanel.hidden = true; document.body.classList.remove("panel-open");
    if (lTarget === 1) endLocal();
  }
  function startLocal(i) {
    loc = i; lTarget = 1; selMoon = -1; elMoonCard.hidden = true;
    lz.k = 1; lz.x = 0; lz.y = 0; vtween = null;
    if (sel !== i) selectPlanet(i);
    document.body.classList.add("local");
    elControls.hidden = true; elBack.hidden = false;
    updatePanelButton();
  }
  function endLocal() {
    lTarget = 0; selMoon = -1; elMoonCard.hidden = true;
    elControls.hidden = false; elBack.hidden = true;
    document.body.classList.remove("local");
    updatePanelButton();
  }
  elBack.addEventListener("click", endLocal);

  function showMoonCard(j) {
    var P = PLANETS[loc], m = P.moons[j]; selMoon = j;
    elMoonCard.innerHTML = "<h3>" + esc(m.name) + "</h3><p>Radius " + commas(m.r) + " km · Orbit " + commas(m.a) + " km from " + P.name +
      "</p><p>Period " + Math.abs(m.P).toFixed(m.P < 10 ? 2 : 1) + " days" + (m.P < 0 ? " (retrograde)" : "") + "</p><p>" + esc(m.fact) + "</p>";
    elMoonCard.hidden = false;
  }
  function positionMoonCard() {
    if (selMoon < 0 || elMoonCard.hidden) return;
    var it = moonItems[selMoon]; if (!it) return;
    var w = elMoonCard.offsetWidth, h = elMoonCard.offsetHeight;
    var x = it.x + 18, y = it.y + 18;
    if (x + w > W - 8) x = it.x - w - 18;
    if (y + h > H - 8) y = it.y - h - 18;
    if (isMobile()) { x = Math.min(Math.max(8, x), W - w - 8); y = Math.min(Math.max(8, y), H - h - 8); }
    elMoonCard.style.left = Math.max(8, x) + "px"; elMoonCard.style.top = Math.max(60, y) + "px";
  }

  /* planet list for keyboard users */
  (function () {
    var list = $("planetList");
    PLANETS.forEach(function (P, i) {
      var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = P.name;
      b.addEventListener("click", function () { selectPlanet(i); });
      list.appendChild(b);
    });
  })();

  /* ---------- toggle ---------- */
  function setScale(on) {
    scaleOn = on; elSwitch.setAttribute("aria-checked", on ? "true" : "false");
    elChips.hidden = !on;
    if (!on) { pinned = null; cz.k = 1; cz.x = 0; cz.y = 0; vtween = null; }
    if (on) { tween = null; if (s < 0.01) { cam.x = 0; cam.y = 0; cam.ppa = ppaFit(); } }
  }
  elSwitch.addEventListener("click", function () { setScale(!scaleOn); });
  elChips.addEventListener("click", function (e) { var b = e.target.closest("[data-jump]"); if (b) jump(b.getAttribute("data-jump")); });
  $("zin").addEventListener("click", function () { zoomBy(cx0(), cy0(), 1.7); });
  $("zout").addEventListener("click", function () { zoomBy(cx0(), cy0(), 1 / 1.7); });
  $("zfit").addEventListener("click", function () {
    if (lTarget === 1) viewTo(lz, 1, 0, 0, 600);
    else if (scaleOn) jump("fit");
    else viewTo(cz, 1, 0, 0, 600);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (selMoon >= 0) { selMoon = -1; elMoonCard.hidden = true; return; }
    if (lTarget === 1) { endLocal(); return; }
    if (sel >= 0) closePanel();
  });

  /* ---------- pointer interaction ---------- */
  var pointers = {}, gesture = null, downInfo = null;
  function pcount() { return Object.keys(pointers).length; }

  function hitTest(x, y, touch) {
    if (l > 0.05 && l < 0.95) return null;
    if (l <= 0.05 && lTarget === 1) return null;
    var best = null, bd = 1e9;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], d = Math.hypot(x - h.x, y - h.y), rad = h.r + (touch ? 8 : 0);
      var inLab = h.lab && x >= h.lab.x0 - 2 && x <= h.lab.x1 + 2 && y >= h.lab.y0 && y <= h.lab.y1;
      if (d <= rad || inLab) { var dd = inLab ? 0 : d; if (dd < bd) { bd = dd; best = h; } }
    }
    return best;
  }

  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    downInfo = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, touch: e.pointerType !== "mouse", multi: pcount() > 1 };
    if (pcount() === 2) {
      var ks = Object.keys(pointers), a = pointers[ks[0]], b = pointers[ks[1]];
      gesture = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      downInfo.multi = true;
    }
  });
  canvas.addEventListener("pointermove", function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; mouse.touch = e.pointerType !== "mouse";
    var p = pointers[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (downInfo) downInfo.moved += Math.abs(dx) + Math.abs(dy);
    if (pcount() === 1) {
      if (downInfo && downInfo.moved > 3) panBy(dx, dy);
    } else if (pcount() === 2 && gesture) {
      var ks = Object.keys(pointers), a = pointers[ks[0]], b = pointers[ks[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.d > 0) zoomBy((a.x + b.x) / 2, (a.y + b.y) / 2, d / gesture.d);
      gesture.d = d;
    }
  });
  function pointerEnd(e) {
    var had = pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (pcount() < 2) gesture = null;
    if (had && downInfo && !downInfo.multi && downInfo.moved < 8 && performance.now() - downInfo.t < 700) {
      var h = hitTest(e.clientX, e.clientY, downInfo.touch);
      if (h) {
        if (h.type === "planet") selectPlanet(h.i);
        else if (h.type === "moon") showMoonCard(h.j);
        else if (h.type === "voy") { pinned = { type: "voy", i: h.i }; }
      } else if (selMoon >= 0) { selMoon = -1; elMoonCard.hidden = true; }
      if (!h || h.type !== "voy") pinned = null;
    }
    if (pcount() === 0) downInfo = null;
  }
  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", pointerEnd);
  canvas.addEventListener("pointerleave", function () { mouse.in = false; });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    zoomBy(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
  }, { passive: false });

  var pinned = null; // clicked voyager
  function updateHover() {
    hover = pinned && s > 0.5 && lTarget === 0 ? pinned : null;
    var over = mouse.in && !mouse.touch && !(downInfo && downInfo.moved > 8) ? hitTest(mouse.x, mouse.y, false) : null;
    canvas.style.cursor = over ? "pointer" : (lTarget === 1 || l < 0.05 ? (pcount() ? "grabbing" : "grab") : "default");
    if (hover) {
      var h2 = hits.filter(function (q2) { return q2.type === "voy" && q2.i === hover.i; })[0];
      if (h2) {
        elTip.textContent = VOYAGERS[hover.i].name + " · " + fmtAU(vy[hover.i].r) + " AU";
        elTip.style.left = Math.min(Math.max(h2.x, 10), W - 190) + "px"; elTip.style.top = Math.max(h2.y, 50) + "px";
        elTip.hidden = false; return;
      }
    }
    elTip.hidden = true;
  }

  /* ---------- key ---------- */
  var keyBuilt = "";
  function updateKey() {
    var mode = lTarget === 1 || l > 0.5 ? "local" : (s > 0.5 ? "scale" : "comp");
    var html = "";
    if (mode === "comp") {
      elKeyBar.hidden = true;
      html = PLANETS.map(function (P, i) {
        return '<span class="k' + (hover && hover.type === "planet" && hover.i === i ? " on" : "") + '"><i style="background:' + P.color + '"></i>' + P.name + " " + fmtAU(pl[i].r) + " AU</span>";
      }).join("");
    } else if (mode === "scale") {
      elKeyBar.hidden = false;
      var au = niceFloor(110 / cam.ppa), unitAU = au >= 0.5, prim, sec;
      if (!unitAU) { au = niceFloor(110 / cam.ppa * AU_KM) / AU_KM; }
      var km = au * AU_KM;
      prim = unitAU ? commas(au) + " AU" : commas(km) + " km";
      sec = unitAU ? fmtKm(km) : fmtAU(au).replace(/(\.\d*?)0+$/, "$1") + " AU";
      elBarLine.style.width = Math.max(4, au * cam.ppa) + "px";
      elBarLabel.textContent = prim + " · " + sec + " · " + fmtLight(au);
      html = '<span class="k">1 AU = ' + fmtLight(1) + " = " + fmtKm(AU_KM) + "</span>";
      html += VOYAGERS.map(function (v, i) { return '<span class="k"><i style="background:' + v.color + '"></i>' + v.name + " " + fmtAU(vy[i].r) + " AU · " + fmtLight(vy[i].r) + "</span>"; }).join("");
    } else {
      elKeyBar.hidden = false;
      var L = localLayout(), b = localBar(L);
      elBarLine.style.width = b.px + "px";
      elBarLabel.textContent = commas(b.km) + " km";
      html = '<span class="k">' + PLANETS[loc].name + " equatorial radius " + commas(L.P.req) + " km</span>";
    }
    var key = html;
    if (key !== keyBuilt) { elKeyText.innerHTML = html; keyBuilt = key; }
  }

  /* ---------- main loop ---------- */
  function resize() {
    var nw = window.innerWidth, nh = window.innerHeight, nd = Math.min(window.devicePixelRatio || 1, 2);
    if (nw !== W || nh !== H || nd !== dpr) {
      W = nw; H = nh; dpr = nd;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    }
  }
  function targetRect() {
    var mob = isMobile();
    var top = mob ? 150 : 76, bottom = H - (mob ? 74 : 62);
    var r = { x0: 0, y0: top, x1: W, y1: bottom };
    if (!elPanel.hidden) {
      if (mob) r.y1 = Math.min(bottom, H * 0.54 - 10); else r.x1 = W - 360;
    }
    if (!mob) r.x0 = 150; // leave room for controls on the left
    else r.x0 = 0;
    if (!mob && elPanel.hidden) r.x0 = 0;
    return r;
  }

  var clockTxt = "";
  function updateClock(ms) {
    var d = new Date(ms), M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function z(n) { return (n < 10 ? "0" : "") + n; }
    var t = d.getUTCDate() + " " + M[d.getUTCMonth()] + " " + d.getUTCFullYear() + " · " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + ":" + z(d.getUTCSeconds()) + " UTC";
    if (t !== clockTxt) { elClock.textContent = t; clockTxt = t; }
  }

  var lastKey = 0, lastPanel = 0;
  function frame(ts) {
    var dt = Math.min(0.1, (ts - (lastTs || ts)) / 1000); lastTs = ts;
    resize(); frameDt = dt || 0.016; uiR = uiRects();
    var ms = nowMs(); jd = julian(ms);
    pl = planetState(jd); vy = voyagerState(jd);

    // rect smoothing
    var tr = targetRect(), k = 1 - Math.pow(0.0005, dt);
    if (!vr.init) { vr = { x0: tr.x0, y0: tr.y0, x1: tr.x1, y1: tr.y1, init: true }; cam.ppa = ppaFit(); }
    vr.x0 += (tr.x0 - vr.x0) * k; vr.x1 += (tr.x1 - vr.x1) * k; vr.y0 += (tr.y0 - vr.y0) * k; vr.y1 += (tr.y1 - vr.y1) * k;

    // animations
    var st = scaleOn ? 1 : 0;
    if (s !== st) { s += Math.sign(st - s) * dt / 1.4; if ((st - s) * Math.sign(st - s) < 0) s = st; }
    var sE = s; // eased by use below
    if (l !== lTarget) { l += Math.sign(lTarget - l) * dt / 1.0; if ((lTarget - l) * Math.sign(lTarget - l) < 0) l = lTarget; if (l === 0) { loc = lTarget === 0 ? -1 : loc; } }
    if (tween) {
      var tt = Math.min(1, (performance.now() - tween.t0) / tween.dur), e = ease(tt);
      cam.x = lerp(tween.from.x, tween.to.x, e); cam.y = lerp(tween.from.y, tween.to.y, e);
      cam.ppa = Math.exp(lerp(Math.log(tween.from.p), Math.log(tween.to.p), e));
      if (tt >= 1) tween = null;
    }
    if (vtween) {
      var vt = Math.min(1, (performance.now() - vtween.t0) / vtween.dur), ve = ease(vt), vv = vtween.v;
      vv.k = Math.exp(lerp(Math.log(vtween.from.k), Math.log(vtween.to.k), ve));
      vv.x = lerp(vtween.from.x, vtween.to.x, ve); vv.y = lerp(vtween.from.y, vtween.to.y, ve);
      if (vt >= 1) vtween = null;
    }
    if (s >= 1 && (cz.k !== 1 || cz.x || cz.y)) { cz.k = 1; cz.x = 0; cz.y = 0; }
    // use eased s for rendering
    var sRaw = s; s = ease(Math.max(0, Math.min(1, sRaw)));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var le = ease(Math.max(0, Math.min(1, l)));
    if (le < 0.999) {
      ctx.save();
      if (le > 0 && loc >= 0) {
        var pp = [0, 0]; toScreen(pl[loc].x, pl[loc].y, pp);
        var sc = 1 + le * 7, ccx = cx0(), ccy = cy0();
        ctx.translate(pp[0] + (ccx - pp[0]) * le, pp[1] + (ccy - pp[1]) * le);
        ctx.scale(sc, sc); ctx.translate(-pp[0], -pp[1]);
      }
      drawSolar(1 - le, le < 0.02);
      ctx.restore();
    }
    if (le > 0.001 && loc >= 0) {
      ctx.save();
      var c2x = cx0(), c2y = cy0(), sc2 = 0.55 + 0.45 * le;
      ctx.translate(c2x, c2y); ctx.scale(sc2, sc2); ctx.translate(-c2x, -c2y);
      drawLocal(le, le > 0.98);
      ctx.restore();
      if (le < 0.98) hits = [];
    }
    s = sRaw;

    updateHover();
    positionMoonCard();
    updateClock(ms);
    if (ts - lastKey > 60) { updateKey(); lastKey = ts; }
    if (ts - lastPanel > 1000) { updatePanelLive(); lastPanel = ts; }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", function () { resize(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureCache = {}; });
  resize();
  requestAnimationFrame(frame);

  window.__orrery.probe = function () {
    var res = [];
    for (var i = 0; i < PLANETS.length; i++) {
      var o = pl[i].o, best = 1e9, N = 2000, a = [0, 0], c = [0, 0], d = [0, 0];
      toScreen(pl[i].x, pl[i].y, a);
      for (var k = 0; k < N; k++) {
        var E = o.E + (k / N) * TAU, E2 = o.E + ((k + 1) / N) * TAU;
        orbitXY(o, E, orbitBuf); toScreen(orbitBuf[0], orbitBuf[1], c);
        orbitXY(o, E2, orbitBuf); toScreen(orbitBuf[0], orbitBuf[1], d);
        var vx = d[0] - c[0], vy = d[1] - c[1], L = vx * vx + vy * vy, t = L ? Math.max(0, Math.min(1, ((a[0] - c[0]) * vx + (a[1] - c[1]) * vy) / L)) : 0;
        best = Math.min(best, Math.hypot(a[0] - c[0] - t * vx, a[1] - c[1] - t * vy));
      }
      res.push(+best.toFixed(4));
    }
    return res;
  };
  window.__orrery.dbg = function () { return { s: s, l: l, loc: loc, sel: sel, cam: cam, scaleOn: scaleOn }; };
})();
