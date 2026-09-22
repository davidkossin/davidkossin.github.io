(function () {
  // Colorblind-safe pair: orange = Los Angeles, blue = Lake Oswego
  const LA = "#E06900";        // vivid orange
  const LA_LOW = "#F4A261";    // lighter orange for LA low / secondary
  const LO = "#0072B2";        // strong blue
  const LO_LOW = "#56B4E9";    // lighter blue for LO low / secondary
  const LA_SOFT = "rgba(224, 105, 0, 0.35)";
  const LO_SOFT = "rgba(0, 114, 178, 0.35)";

  const metaEl = document.getElementById("meta");

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function baseOptions(yLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: {
            color: "#c9d0ef",
            boxWidth: 12,
            usePointStyle: true,
            pointStyle: "circle",
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
            maxTicksLimit: 10,
          },
          grid: { color: "rgba(232, 236, 255, 0.06)" },
        },
        y: {
          title: {
            display: true,
            text: yLabel,
            color: "#8b93b8",
          },
          ticks: { color: "#8b93b8" },
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
      pointHoverRadius: 3,
      tension: 0.2,
      borderDash: dashed ? [5, 4] : undefined,
    };
  }

  function makeChart(id, config) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === "undefined") return null;
    return new Chart(el, config);
  }

  async function load() {
    const res = await fetch("./data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load weather data");
    const data = await res.json();

    metaEl.textContent =
      data.dates.length +
      " days · " +
      fmtDate(data.startDate) +
      " → " +
      fmtDate(data.endDate) +
      " · last refresh " +
      new Date(data.generatedAt).toLocaleString("en-US", {
        timeZone: "America/Phoenix",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }) +
      " PT";

    const labels = data.dates;
    const la = data.series.la;
    const lo = data.series.lo;

    makeChart("chart-temp", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset("LA high", la.high, LA, false),
          lineDataset("LA low", la.low, LA_LOW, true),
          lineDataset("Lake Oswego high", lo.high, LO, false),
          lineDataset("Lake Oswego low", lo.low, LO_LOW, true),
        ],
      },
      options: baseOptions("°F"),
    });

    makeChart("chart-humidity", {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset("Los Angeles", la.humidity, LA, false),
          lineDataset("Lake Oswego", lo.humidity, LO, false),
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
            label: "Los Angeles",
            data: la.rain,
            borderColor: LA,
            backgroundColor: LA_SOFT,
            borderWidth: 1.75,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.15,
            fill: true,
          },
          {
            label: "Lake Oswego",
            data: lo.rain,
            borderColor: LO,
            backgroundColor: LO_SOFT,
            borderWidth: 1.75,
            pointRadius: 0,
            pointHoverRadius: 3,
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
          lineDataset("Los Angeles", la.cloudCover, LA, false),
          lineDataset("Lake Oswego", lo.cloudCover, LO, false),
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
          lineDataset("Los Angeles", la.daylight, LA, false),
          lineDataset("Lake Oswego", lo.daylight, LO, false),
        ],
      },
      options: baseOptions("hours"),
    });
  }

  function boot() {
    if (typeof Chart === "undefined") {
      setTimeout(boot, 40);
      return;
    }
    load().catch((err) => {
      metaEl.textContent = "Could not load weather data. Try refreshing in a moment.";
      console.error(err);
    });
  }

  boot();
})();
