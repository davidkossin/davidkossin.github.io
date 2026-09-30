(function () {
  // Colorblind-safe pair: orange = city A, blue = city B
  const COLOR_A = "#E06900";
  const COLOR_A_LOW = "#F4A261";
  const COLOR_B = "#0072B2";
  const COLOR_B_LOW = "#56B4E9";
  const COLOR_A_SOFT = "rgba(224, 105, 0, 0.35)";
  const COLOR_B_SOFT = "rgba(0, 114, 178, 0.35)";

  const DEFAULT_A = { zip: "90045", short: "Los Angeles", label: "Los Angeles (90045)", state: "CA" };
  const DEFAULT_B = { zip: "97034", short: "Lake Oswego", label: "Lake Oswego (97034)", state: "OR" };
  const START_DATE = "2026-01-01";
  const STORAGE_KEY = "weatherTracker.customPair.v1";
  const TZ = "America/Los_Angeles";
  const DAILY =
    "temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,rain_sum,cloud_cover_mean,daylight_duration";

  const metaEl = document.getElementById("meta");
  const taglineEl = document.getElementById("tagline");
  const formEl = document.getElementById("zip-form");
  const zipAInput = document.getElementById("zip-a");
  const zipBInput = document.getElementById("zip-b");
  const zipAResolved = document.getElementById("zip-a-resolved");
  const zipBResolved = document.getElementById("zip-b-resolved");
  const errorEl = document.getElementById("zip-error");
  const compareBtn = document.getElementById("zip-compare");
  const resetBtn = document.getElementById("zip-reset");

  const charts = {};
  let bundledData = null;
  let lastData = null;
  let activeMode = "default";

  function isNarrow() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function pacificTodayIso() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function validateZip(raw) {
    const zip = String(raw || "").trim();
    return /^\d{5}$/.test(zip) ? zip : null;
  }

  function setError(msg) {
    if (!msg) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  function setBusy(busy) {
    compareBtn.disabled = busy;
    resetBtn.disabled = busy;
    zipAInput.disabled = busy;
    zipBInput.disabled = busy;
    compareBtn.textContent = busy ? "Loading…" : "Compare";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateTagline(locA, locB) {
    taglineEl.innerHTML =
      escapeHtml(locA.short) +
      ' <span class="zip">' +
      escapeHtml(locA.zip) +
      "</span> vs " +
      escapeHtml(locB.short) +
      ' <span class="zip">' +
      escapeHtml(locB.zip) +
      "</span>, from the start of 2026 through today.";
  }

  function setResolved(el, place) {
    if (!place) {
      el.textContent = "";
      return;
    }
    el.textContent = place.short + (place.state ? ", " + place.state : "");
  }

  function syncForm(locA, locB) {
    zipAInput.value = locA.zip;
    zipBInput.value = locB.zip;
    setResolved(zipAResolved, locA);
    setResolved(zipBResolved, locB);
  }

  function baseOptions(yLabel) {
    const narrow = isNarrow();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: {
            color: "#c9d0ef",
            boxWidth: narrow ? 10 : 12,
            font: { size: narrow ? 11 : 12 },
            usePointStyle: true,
            pointStyle: "circle",
            padding: narrow ? 10 : 12,
          },
        },
        tooltip: {
          backgroundColor: "rgba(8, 12, 28, 0.95)",
          titleColor: "#e8ecff",
          bodyColor: "#c9d0ef",
          borderColor: "rgba(232, 236, 255, 0.12)",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#8b93b8",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: narrow ? 5 : 10,
            font: { size: narrow ? 10 : 12 },
          },
          grid: { color: "rgba(232, 236, 255, 0.06)" },
        },
        y: {
          title: {
            display: !narrow,
            text: yLabel,
            color: "#8b93b8",
          },
          ticks: {
            color: "#8b93b8",
            font: { size: narrow ? 10 : 12 },
            maxTicksLimit: narrow ? 6 : 8,
          },
          grid: { color: "rgba(232, 236, 255, 0.06)" },
        },
      },
    };
  }

  function lineDataset(label, data, color, dashed) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 1.75,
      pointRadius: 0,
      pointHoverRadius: isNarrow() ? 4 : 3,
      hitRadius: isNarrow() ? 8 : 4,
      tension: 0.2,
      borderDash: dashed ? [5, 4] : undefined,
    };
  }

  function destroyCharts() {
    Object.keys(charts).forEach((id) => {
      if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
      }
    });
  }

  function makeChart(id, config) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === "undefined") return null;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(el, config);
    return charts[id];
  }

  function shortLabel(loc) {
    return loc.short || loc.zip;
  }

  function renderCharts(data) {
    const labels = data.dates;
    const a = data.series.a;
    const b = data.series.b;
    const nameA = shortLabel(data.locations.a);
    const nameB = shortLabel(data.locations.b);

    destroyCharts();

    makeChart("chart-temp", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset(nameA + " high", a.high, COLOR_A, false),
          lineDataset(nameA + " low", a.low, COLOR_A_LOW, true),
          lineDataset(nameB + " high", b.high, COLOR_B, false),
          lineDataset(nameB + " low", b.low, COLOR_B_LOW, true),
        ],
      },
      options: baseOptions("°F"),
    });

    makeChart("chart-humidity", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset(nameA, a.humidity, COLOR_A, false),
          lineDataset(nameB, b.humidity, COLOR_B, false),
        ],
      },
      options: (() => {
        const o = baseOptions("%");
        o.scales.y.min = 0;
        o.scales.y.max = 100;
        return o;
      })(),
    });

    makeChart("chart-rain", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: nameA,
            data: a.rain,
            borderColor: COLOR_A,
            backgroundColor: COLOR_A_SOFT,
            borderWidth: 1.75,
            pointRadius: 0,
            pointHoverRadius: isNarrow() ? 4 : 3,
            hitRadius: isNarrow() ? 8 : 4,
            tension: 0.15,
            fill: true,
          },
          {
            label: nameB,
            data: b.rain,
            borderColor: COLOR_B,
            backgroundColor: COLOR_B_SOFT,
            borderWidth: 1.75,
            pointRadius: 0,
            pointHoverRadius: isNarrow() ? 4 : 3,
            hitRadius: isNarrow() ? 8 : 4,
            tension: 0.15,
            fill: true,
          },
        ],
      },
      options: (() => {
        const o = baseOptions("inches");
        o.scales.y.min = 0;
        return o;
      })(),
    });

    makeChart("chart-cloud", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset(nameA, a.cloudCover, COLOR_A, false),
          lineDataset(nameB, b.cloudCover, COLOR_B, false),
        ],
      },
      options: (() => {
        const o = baseOptions("%");
        o.scales.y.min = 0;
        o.scales.y.max = 100;
        return o;
      })(),
    });

    makeChart("chart-daylight", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset(nameA, a.daylight, COLOR_A, false),
          lineDataset(nameB, b.daylight, COLOR_B, false),
        ],
      },
      options: baseOptions("hours"),
    });
  }

  function updateMeta(data, sourceNote) {
    const refresh = data.generatedAt
      ? " · last refresh " +
        new Date(data.generatedAt).toLocaleString("en-US", {
          timeZone: "America/Phoenix",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }) +
        " PT"
      : "";
    metaEl.textContent =
      data.dates.length +
      " days · " +
      fmtDate(data.startDate) +
      " → " +
      fmtDate(data.endDate) +
      refresh +
      (sourceNote ? " · " + sourceNote : "");
  }

  function applyView(data, mode) {
    activeMode = mode;
    lastData = data;
    updateTagline(data.locations.a, data.locations.b);
    syncForm(data.locations.a, data.locations.b);
    updateMeta(data, mode === "custom" ? "live fetch" : "");
    renderCharts(data);
  }

  function normalizeBundled(raw) {
    return {
      generatedAt: raw.generatedAt,
      startDate: raw.startDate,
      endDate: raw.endDate,
      dates: raw.dates,
      locations: {
        a: {
          zip: raw.locations.la.id,
          short: raw.locations.la.short,
          label: raw.locations.la.label,
          state: "CA",
          latitude: raw.locations.la.latitude,
          longitude: raw.locations.la.longitude,
        },
        b: {
          zip: raw.locations.lo.id,
          short: raw.locations.lo.short,
          label: raw.locations.lo.label,
          state: "OR",
          latitude: raw.locations.lo.latitude,
          longitude: raw.locations.lo.longitude,
        },
      },
      series: {
        a: raw.series.la,
        b: raw.series.lo,
      },
    };
  }

  async function loadBundled() {
    const res = await fetch("./data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load weather data");
    bundledData = normalizeBundled(await res.json());
    return bundledData;
  }

  async function lookupZip(zip) {
    const res = await fetch("https://api.zippopotam.us/us/" + zip);
    if (res.status === 404 || !res.ok) {
      throw new Error("Could not find ZIP " + zip + ".");
    }
    const data = await res.json();
    const place = data.places && data.places[0];
    if (!place) throw new Error("Could not find ZIP " + zip + ".");
    return {
      zip,
      short: place["place name"],
      state: place["state abbreviation"] || "",
      label: place["place name"] + " (" + zip + ")",
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
    };
  }

  async function fetchArchiveDaily(loc, endDate) {
    const params = new URLSearchParams({
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      start_date: START_DATE,
      end_date: endDate,
      daily: DAILY,
      timezone: TZ,
      temperature_unit: "fahrenheit",
      precipitation_unit: "inch",
    });
    const res = await fetch(
      "https://archive-api.open-meteo.com/v1/archive?" + params.toString()
    );
    if (!res.ok) throw new Error("Weather fetch failed for " + loc.zip + ".");
    const raw = await res.json();
    if (!raw.daily || !raw.daily.time) {
      throw new Error("Unexpected weather response for " + loc.zip + ".");
    }
    return raw.daily;
  }

  function seriesFromDaily(daily) {
    return {
      high: daily.temperature_2m_max,
      low: daily.temperature_2m_min,
      humidity: daily.relative_humidity_2m_mean,
      rain: daily.rain_sum,
      cloudCover: daily.cloud_cover_mean,
      daylight: daily.daylight_duration.map((v) =>
        v == null ? null : Math.round((v / 3600) * 1000) / 1000
      ),
    };
  }

  async function fetchCustomPair(zipA, zipB) {
    const end = pacificTodayIso();
    const endDate = end < START_DATE ? START_DATE : end;

    const [locA, locB] = await Promise.all([lookupZip(zipA), lookupZip(zipB)]);
    setResolved(zipAResolved, locA);
    setResolved(zipBResolved, locB);

    const [dailyA, dailyB] = await Promise.all([
      fetchArchiveDaily(locA, endDate),
      fetchArchiveDaily(locB, endDate),
    ]);

    if (JSON.stringify(dailyA.time) !== JSON.stringify(dailyB.time)) {
      throw new Error("Date ranges did not match between the two locations.");
    }

    return {
      generatedAt: new Date().toISOString(),
      startDate: START_DATE,
      endDate,
      dates: dailyA.time,
      locations: { a: locA, b: locB },
      series: {
        a: seriesFromDaily(dailyA),
        b: seriesFromDaily(dailyB),
      },
    };
  }

  function saveCustom(zipA, zipB) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ zipA, zipB }));
    } catch (_) {
      /* ignore */
    }
  }

  function clearCustom() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function readSavedCustom() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const a = validateZip(parsed.zipA);
      const b = validateZip(parsed.zipB);
      if (!a || !b) return null;
      if (a === DEFAULT_A.zip && b === DEFAULT_B.zip) return null;
      return { zipA: a, zipB: b };
    } catch (_) {
      return null;
    }
  }

  async function showDefaults() {
    clearCustom();
    setError("");
    if (!bundledData) await loadBundled();
    applyView(bundledData, "default");
  }

  async function showCustom(zipA, zipB) {
    setError("");
    setBusy(true);
    metaEl.textContent = "Fetching weather for " + zipA + " and " + zipB + "…";
    try {
      const data = await fetchCustomPair(zipA, zipB);
      saveCustom(zipA, zipB);
      applyView(data, "custom");
    } catch (err) {
      console.error(err);
      setError(
        err && err.message
          ? err.message
          : "Could not load weather for those ZIP codes. Check the ZIPs and try again."
      );
      if (lastData) {
        updateMeta(lastData, activeMode === "custom" ? "live fetch" : "");
      } else {
        metaEl.textContent = "Comparison not updated.";
      }
      throw err;
    } finally {
      setBusy(false);
    }
  }

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = validateZip(zipAInput.value);
    const b = validateZip(zipBInput.value);
    if (!a || !b) {
      setError("Enter two valid US 5-digit ZIP codes.");
      return;
    }
    if (a === DEFAULT_A.zip && b === DEFAULT_B.zip) {
      showDefaults().catch((err) => console.error(err));
      return;
    }
    showCustom(a, b).catch(() => {
      /* error already shown */
    });
  });

  resetBtn.addEventListener("click", () => {
    showDefaults().catch((err) => {
      metaEl.textContent = "Could not load weather data. Try refreshing in a moment.";
      console.error(err);
    });
  });

  [zipAInput, zipBInput].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 5);
    });
  });

  const mq = window.matchMedia("(max-width: 640px)");
  function onViewportChange() {
    if (lastData) renderCharts(lastData);
  }
  if (mq.addEventListener) mq.addEventListener("change", onViewportChange);
  else if (mq.addListener) mq.addListener(onViewportChange);

  async function boot() {
    if (typeof Chart === "undefined") {
      setTimeout(boot, 40);
      return;
    }
    try {
      await loadBundled();
      const saved = readSavedCustom();
      if (saved) {
        syncForm(
          { zip: saved.zipA, short: "…", state: "" },
          { zip: saved.zipB, short: "…", state: "" }
        );
        try {
          await showCustom(saved.zipA, saved.zipB);
          return;
        } catch (_) {
          /* fall through to defaults */
        }
      }
      applyView(bundledData, "default");
    } catch (err) {
      metaEl.textContent = "Could not load weather data. Try refreshing in a moment.";
      console.error(err);
    }
  }

  boot();
})();
