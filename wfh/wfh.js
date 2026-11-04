(function () {
  "use strict";

  // Swap this after Worker deploy.
  const API_BASE = window.WFH_API_BASE || "https://wfh-poll.dkossin.workers.dev";

  const NAME_KEY = "wfh-visitor-name";
  const params = new URLSearchParams(location.search);
  const nowOverride = params.get("now");

  const REASON_FALLBACK = [
    { id: "apartment_maintenance", label: "Apartment Maintenance" },
    { id: "package_delivery", label: "Package Delivery" },
    { id: "medical_appointment", label: "Medical Appointment" },
    { id: "car_issue", label: "Car Issue / Maintenance" },
    { id: "migraine", label: "Migraine" },
    { id: "sick", label: "Sick" },
    { id: "airport", label: "Airport Pickup/Drop-off" },
    { id: "none", label: "None: Comes In Every Day" },
    { id: "other", label: "Other" },
  ];
  const DAY_FALLBACK = [
    { id: "mon", label: "Mon" },
    { id: "tue", label: "Tue" },
    { id: "wed", label: "Wed" },
    { id: "thu", label: "Thu" },
    { id: "fri", label: "Fri" },
    { id: "none", label: "None" },
  ];

  let state = null;
  let selectedReason = null;
  let selectedDay = null;
  let adminReason = null;
  let adminDay = null;
  let countdownTimer = null;

  const $ = (id) => document.getElementById(id);

  function apiUrl(path, extraParams) {
    const base = API_BASE.endsWith("/") ? API_BASE : API_BASE + "/";
    const u = new URL(path.replace(/^\//, ""), base);
    if (nowOverride) u.searchParams.set("now", nowOverride);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v != null) u.searchParams.set(k, v);
      }
    }
    return u.toString();
  }

  async function api(path, options = {}) {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      const body = nowOverride ? { ...opts.body, now: nowOverride } : { ...opts.body };
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(apiUrl(path), opts);
    let data;
    try {
      data = await res.json();
    } catch {
      data = { error: "Bad response from server." };
    }
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function reasons() {
    return state?.reasons || REASON_FALLBACK;
  }
  function days() {
    return state?.days || DAY_FALLBACK;
  }

  function reasonLabel(id, otherText) {
    if (id === "other" && otherText) return `Other: ${otherText}`;
    const r = reasons().find((x) => x.id === id);
    return r ? r.label : id;
  }

  function dayLabel(id) {
    const d = days().find((x) => x.id === id);
    return d ? d.label : id;
  }

  function formatWeekRange(monday) {
    if (!monday) return "—";
    const [y, m, d] = monday.split("-").map(Number);
    const mon = new Date(Date.UTC(y, m - 1, d));
    const fri = new Date(Date.UTC(y, m - 1, d + 4));
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    });
    const yfmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${fmt.format(mon)} – ${yfmt.format(fri)}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatDeadlineShort(iso) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Phoenix",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function buildReasonList(container, name, onChange, selectedId) {
    container.innerHTML = "";
    for (const r of reasons()) {
      const label = document.createElement("label");
      label.className = "reason-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = r.id;
      input.checked = selectedId === r.id;
      input.addEventListener("change", () => onChange(r.id));
      const span = document.createElement("span");
      span.textContent = r.label;
      label.append(input, span);
      container.appendChild(label);
    }
  }

  function buildDayButtons(container, onChange, selectedId) {
    container.innerHTML = "";
    for (const d of days()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-btn";
      btn.textContent = d.label;
      btn.dataset.day = d.id;
      btn.setAttribute("aria-pressed", selectedId === d.id ? "true" : "false");
      btn.addEventListener("click", () => {
        container.querySelectorAll(".day-btn").forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.day === d.id ? "true" : "false");
        });
        onChange(d.id);
      });
      container.appendChild(btn);
    }
  }

  function setDayPressed(container, dayId) {
    container.querySelectorAll(".day-btn").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.day === dayId ? "true" : "false");
    });
  }

  function onPickReason(id) {
    selectedReason = id;
    $("other-wrap").hidden = id !== "other";
    if (id === "none") {
      selectedDay = "none";
      setDayPressed($("day-buttons"), "none");
    }
  }

  function onPickDay(id) {
    selectedDay = id;
  }

  async function fetchOtherTexts(week) {
    const res = await fetch(apiUrl("/api/other-texts", { week }));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function loadAdminOtherChecks() {
    const week = $("admin-week").value;
    const box = $("admin-other-checks");
    if (!week) return;
    try {
      const data = await fetchOtherTexts(week);
      const others = data.others || [];
      if (!others.length) {
        box.hidden = false;
        box.innerHTML = "<p class='empty'>No Other submissions for this week.</p>";
        return;
      }
      box.hidden = false;
      box.innerHTML =
        "<p style='color:var(--muted);font-size:0.85rem;margin-bottom:0.35rem'>Mark submitted Other texts that count as correct:</p>";
      for (const o of others) {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = o.nameKey;
        cb.name = "otherCorrect";
        const span = document.createElement("span");
        span.textContent = `${o.name}: “${o.reasonOther || ""}”`;
        lab.append(cb, span);
        box.appendChild(lab);
      }
    } catch (e) {
      box.hidden = false;
      box.innerHTML = `<p class="form-status error">${escapeHtml(e.message)}</p>`;
    }
  }

  function onAdminReason(id) {
    adminReason = id;
    $("admin-other-wrap").hidden = id !== "other";
    if (id === "none") {
      adminDay = "none";
      setDayPressed($("admin-day-buttons"), "none");
    }
    if (id === "other") loadAdminOtherChecks();
    else {
      $("admin-other-checks").hidden = true;
      $("admin-other-checks").innerHTML = "";
    }
  }

  function onAdminDay(id) {
    adminDay = id;
  }

  function renderPicksTable(tbody, picks, withPoints) {
    tbody.innerHTML = "";
    const cols = withPoints ? 4 : 3;
    if (!picks || !picks.length) {
      tbody.innerHTML = `<tr><td colspan="${cols}" class="empty">No picks yet.</td></tr>`;
      return;
    }
    for (const p of picks) {
      const tr = document.createElement("tr");
      const isHidden = p.hidden === true || p.reason == null || p.day == null;
      const reasonCell = isHidden
        ? `<td><span class="hidden-pick">Hidden</span></td>`
        : `<td>${escapeHtml(reasonLabel(p.reason, p.reasonOther))}</td>`;
      const dayCell = isHidden
        ? `<td><span class="hidden-pick">Hidden</span></td>`
        : `<td>${escapeHtml(dayLabel(p.day))}</td>`;
      let html = `<td>${escapeHtml(p.name)}</td>${reasonCell}${dayCell}`;
      if (withPoints) {
        html +=
          !isHidden && p.points != null
            ? `<td class="pts-cell">${p.points}</td>`
            : `<td class="pts-cell">—</td>`;
      }
      tr.innerHTML = html;
      tbody.appendChild(tr);
    }
  }

  function renderScoreboard(rows) {
    const body = $("scoreboard-body");
    if (!rows || !rows.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty">No scored weeks yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td class="pts-cell">${r.points}</td><td>${r.weeksPlayed}</td><td>${r.exactHits}</td></tr>`
      )
      .join("");
  }

  function renderHistory(history) {
    const list = $("history-list");
    list.innerHTML = "";
    if (!history || !history.length) {
      list.innerHTML = `<p class="empty">No resolved weeks yet.</p>`;
      return;
    }
    for (const h of history) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = formatWeekRange(h.monday);
      const ans = document.createElement("p");
      ans.className = "history-answer";
      ans.textContent = `Answer: ${reasonLabel(h.result.reason, h.result.reasonOther)} · ${dayLabel(h.result.day)}`;
      const table = document.createElement("table");
      table.className = "picks-table";
      table.innerHTML =
        "<thead><tr><th>Name</th><th>Reason</th><th>Day</th><th>Pts</th></tr></thead>";
      const tb = document.createElement("tbody");
      renderPicksTable(tb, h.picks, true);
      table.appendChild(tb);
      details.append(summary, ans, table);
      list.appendChild(details);
    }
  }

  function renderAdminWeeks() {
    const sel = $("admin-week");
    const unresolved = state.unresolvedWeeks || [];
    const historyMondays = (state.history || []).map((h) => h.monday);
    const options = new Set([state.currentWeek?.monday, ...unresolved, ...historyMondays]);
    const sorted = [...options].filter(Boolean).sort().reverse();
    sel.innerHTML = "";
    for (const m of sorted) {
      const opt = document.createElement("option");
      opt.value = m;
      const resolved = historyMondays.includes(m);
      opt.textContent =
        formatWeekRange(m) +
        (m === state.currentWeek?.monday ? " (current)" : "") +
        (resolved ? " (resolved — re-score)" : "");
      sel.appendChild(opt);
    }
    if (state.currentWeek?.monday) sel.value = state.currentWeek.monday;
  }

  function updateCountdown() {
    const el = $("deadline-countdown");
    const meta = $("deadline-meta");
    if (!state?.openWeek?.deadline) {
      el.textContent = "—";
      return;
    }
    const end = new Date(state.openWeek.deadline).getTime();
    const now = nowOverride ? new Date(nowOverride).getTime() : Date.now();
    const diff = end - now;
    if (!state.openWeek.accepting || diff <= 0) {
      el.textContent = "Closed";
      meta.textContent =
        "Picks closed Friday night at midnight, Arizona time (" +
        formatDeadlineShort(state.openWeek.deadline) +
        ")";
      return;
    }
    const s = Math.floor(diff / 1000);
    const daysN = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    el.textContent = `${daysN}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
    meta.textContent =
      "Picks close Friday night at midnight, Arizona time (" +
      formatDeadlineShort(state.openWeek.deadline) +
      ")";
  }

  function applyState(data) {
    state = data;
    $("open-week-label").textContent = formatWeekRange(data.openWeek.monday);
    $("open-week-heading-label").textContent = formatWeekRange(data.openWeek.monday);
    $("current-week-label").textContent = formatWeekRange(data.currentWeek.monday);
    $("submit-week-target").textContent = `Picks are for week of ${formatWeekRange(data.openWeek.monday)} (Arizona time).`;
    $("open-week-note").textContent = data.openWeek.accepting
      ? "Accepting submissions"
      : "Submissions closed";
    $("current-week-note").textContent = data.currentWeek.result
      ? "Resolved"
      : "Locked · playing out";

    const rb = $("current-result");
    if (data.currentWeek.result) {
      rb.hidden = false;
      const r = data.currentWeek.result;
      rb.textContent = `Result: ${reasonLabel(r.reason, r.reasonOther)} · ${dayLabel(r.day)}`;
    } else {
      rb.hidden = true;
    }

    renderPicksTable($("current-picks-body"), data.currentWeek.picks, true);
    renderPicksTable($("open-picks-body"), data.openWeek.picks, false);
    renderScoreboard(data.scoreboard);
    renderHistory(data.history);
    renderAdminWeeks();

    buildReasonList($("reason-list"), "reason", onPickReason, selectedReason);
    buildDayButtons($("day-buttons"), onPickDay, selectedDay);
    buildReasonList($("admin-reason-list"), "adminReason", onAdminReason, adminReason);
    buildDayButtons($("admin-day-buttons"), onAdminDay, adminDay);

    $("submit-btn").disabled = !data.openWeek.accepting;
    updateCountdown();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdown, 1000);
  }

  async function refresh() {
    applyState(await api("/api/state"));
  }

  $("pick-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("form-status");
    status.className = "form-status";
    status.textContent = "";
    const name = $("name-input").value.trim();
    if (!name) {
      status.className = "form-status error";
      status.textContent = "Name is required.";
      return;
    }
    if (!selectedReason) {
      status.className = "form-status error";
      status.textContent = "Select a reason.";
      return;
    }
    if (!selectedDay) {
      status.className = "form-status error";
      status.textContent = "Select a day.";
      return;
    }
    try {
      const saved = await api("/api/submit", {
        method: "POST",
        body: {
          name,
          reason: selectedReason,
          day: selectedDay,
          reasonOther: selectedReason === "other" ? $("other-input").value : undefined,
        },
      });
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch (_) {}
      status.className = "form-status ok";
      const pick = saved && saved.pick;
      if (pick && pick.reason) {
        const rLabel = reasonLabel(pick.reason, pick.reasonOther);
        const dLabel = dayLabel(pick.day);
        status.textContent = `Pick saved — ${rLabel} · ${dLabel}. Others stay hidden until the deadline.`;
      } else {
        status.textContent = "Pick saved.";
      }
      await refresh();
    } catch (err) {
      status.className = "form-status error";
      status.textContent = err.message || "Could not save pick.";
    }
  });

  $("admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("admin-status");
    status.className = "form-status";
    status.textContent = "";
    if (!adminReason || !adminDay) {
      status.className = "form-status error";
      status.textContent = "Select actual reason and day.";
      return;
    }
    const otherCorrect = [
      ...document.querySelectorAll('#admin-other-checks input[name="otherCorrect"]:checked'),
    ].map((el) => el.value);
    const code = $("admin-code").value;
    try {
      await api("/api/admin/result", {
        method: "POST",
        headers: { "X-Admin-Code": code },
        body: {
          adminCode: code,
          weekMonday: $("admin-week").value,
          reason: adminReason,
          day: adminDay,
          reasonOther: adminReason === "other" ? $("admin-other-input").value : undefined,
          otherCorrect: adminReason === "other" ? otherCorrect : undefined,
        },
      });
      status.className = "form-status ok";
      status.textContent = "Result saved.";
      await refresh();
    } catch (err) {
      status.className = "form-status error";
      status.textContent = err.message || "Could not save result.";
    }
  });

  $("admin-week").addEventListener("change", () => {
    if (adminReason === "other") loadAdminOtherChecks();
  });

  async function init() {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) $("name-input").value = saved;
    } catch (_) {}

    buildReasonList($("reason-list"), "reason", onPickReason, null);
    buildDayButtons($("day-buttons"), onPickDay, null);
    buildReasonList($("admin-reason-list"), "adminReason", onAdminReason, null);
    buildDayButtons($("admin-day-buttons"), onAdminDay, null);

    try {
      await refresh();
    } catch (err) {
      $("form-status").className = "form-status error";
      $("form-status").textContent =
        "Could not reach the API. Check API_BASE in wfh.js. " + (err.message || "");
    }
  }

  init();
})();
