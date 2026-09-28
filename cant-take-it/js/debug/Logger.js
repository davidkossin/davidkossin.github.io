/**
 * Debug logger for playtest troubleshooting.
 * Logs stay in-browser (ring buffer + localStorage); export a JSON file to attach in chat.
 */
import { GAME_VERSION } from '../config.js';

const FLAG_KEY = 'ycitwy_debug';
const LOG_KEY = 'ycitwy_debug_log';
const MAX_ENTRIES = 800;

/** @type {Array<{t:string, type:string, [k:string]: unknown}>} */
let buffer = [];
let enabled = false;
/** @type {Array<{t:string, type:string, [k:string]: unknown}>} */
let recentOverlay = [];
/** Brief on-canvas confirmation after toggle (ms timestamp + label). */
let toastUntil = 0;
let toastLabel = '';
let toastPulse = 0;
/** @type {object|null} last hallway projection summary for late exports */
let hallwayStash = null;

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) buffer = parsed.slice(-MAX_ENTRIES);
  } catch {
    /* ignore */
  }
}

function persist() {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(buffer.slice(-MAX_ENTRIES)));
  } catch {
    /* quota — drop older half */
    try {
      buffer = buffer.slice(-Math.floor(MAX_ENTRIES / 2));
      localStorage.setItem(LOG_KEY, JSON.stringify(buffer));
    } catch {
      /* give up */
    }
  }
}

function persistFlag() {
  try {
    localStorage.setItem(FLAG_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isEnabled() {
  return enabled;
}

export function enable(reason = 'manual') {
  if (enabled) return;
  enabled = true;
  persistFlag();
  flashToast('DEBUG ON');
  log('debug', { on: true, reason, version: GAME_VERSION });
  flushHallwayStashToLog();
}

export function disable(reason = 'manual') {
  if (!enabled) return;
  log('debug', { on: false, reason });
  enabled = false;
  persistFlag();
  persist();
  flashToast('DEBUG OFF');
}

export function toggle(reason = 'hotkey') {
  if (enabled) disable(reason);
  else enable(reason);
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} [payload]
 */
export function log(type, payload = {}) {
  if (!enabled && type !== 'debug') return;
  const entry = { t: new Date().toISOString(), type, ...payload };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  recentOverlay.push(entry);
  if (recentOverlay.length > 6) recentOverlay = recentOverlay.slice(-6);
  if (enabled) {
    try {
      console.debug('[ycitwy]', type, payload);
    } catch {
      /* ignore */
    }
    // Persist periodically (every 8 events) to limit quota churn
    if (buffer.length % 8 === 0) persist();
  }
}

export function setHallwayStash(summary) {
  hallwayStash = summary ? { ...summary, stashedAt: new Date().toISOString() } : null;
}

export function getHallwayStash() {
  return hallwayStash;
}

export function getLogs() {
  return buffer.slice();
}

/** Re-log stashed hallway summary into the ring buffer (e.g. debug enabled mid-hallway). */
export function flushHallwayStashToLog() {
  if (!hallwayStash || !enabled) return;
  log('hallway_stash', hallwayStash);
}

export function clearLogs() {
  buffer = [];
  recentOverlay = [];
  persist();
  log('debug', { cleared: true });
}

function stampFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `ycitwy-debug-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}

export function exportDownload() {
  persist();
  if (hallwayStash && enabled) {
    // Ensure late exports include hallway math even if debug was off at enter
    const already = buffer.some((e) => e.type === 'hallway_stash' || e.type === 'hallway_enter');
    if (!already) log('hallway_stash', hallwayStash);
  }
  const doc = {
    meta: {
      game: "You Can't Take It With You",
      version: GAME_VERSION,
      exportedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      entryCount: buffer.length,
      debugEnabled: enabled,
      hallwayStash: hallwayStash,
    },
    log: buffer.slice(),
  };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = stampFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  log('export', { file: a.download, entries: buffer.length });
  return a.download;
}

export async function copyToClipboard() {
  persist();
  const doc = {
    meta: {
      version: GAME_VERSION,
      exportedAt: new Date().toISOString(),
      entryCount: buffer.length,
    },
    log: buffer.slice(),
  };
  const text = JSON.stringify(doc, null, 2);
  await navigator.clipboard.writeText(text);
  log('export', { via: 'clipboard', entries: buffer.length });
}

function flashToast(label) {
  toastLabel = label;
  toastUntil = Date.now() + 1800;
  toastPulse = 0;
}

/** Draw DEBUG badge + last few lines (call from main loop). Toast draws even when OFF. */
export function drawOverlay(ctx, viewW, canvasH) {
  const now = Date.now();
  ctx.save();

  // Always draw brief ON/OFF toast so toggle is unmistakable
  if (now < toastUntil && toastLabel) {
    const life = (toastUntil - now) / 1800;
    const alpha = Math.min(1, life * 2);
    ctx.fillStyle = `rgba(10, 8, 24, ${0.82 * alpha})`;
    ctx.fillRect(viewW / 2 - 70, 10, 140, 22);
    ctx.strokeStyle = toastLabel.includes('OFF')
      ? `rgba(255, 80, 160, ${alpha})`
      : `rgba(80, 255, 220, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(viewW / 2 - 70, 10, 140, 22);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = toastLabel.includes('OFF')
      ? `rgba(255, 160, 200, ${alpha})`
      : `rgba(120, 255, 230, ${alpha})`;
    ctx.fillText(toastLabel, viewW / 2, 21);
  }

  if (!enabled) {
    ctx.restore();
    return;
  }

  toastPulse = (toastPulse + 1) % 120;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin((toastPulse / 120) * Math.PI * 2));

  // Top cyan/magenta border strip (readable on hallway + decision room)
  ctx.fillStyle = `rgba(0, 255, 220, ${0.35 + pulse * 0.45})`;
  ctx.fillRect(0, 0, viewW, 3);
  ctx.fillStyle = `rgba(255, 60, 200, ${0.3 + pulse * 0.4})`;
  ctx.fillRect(0, 3, viewW, 2);

  // Corner panel — bottom-left, large bright badge
  const panelH = 28 + Math.min(6, recentOverlay.length) * 7;
  const panelW = Math.min(viewW - 8, 210);
  const px = 3;
  const py = canvasH - panelH - 3;
  ctx.fillStyle = 'rgba(8, 6, 20, 0.88)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = `rgba(80, 255, 230, ${0.7 + pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
  ctx.strokeStyle = `rgba(255, 80, 200, ${0.45 + pulse * 0.35})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 3.5, py + 3.5, panelW - 7, panelH - 7);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = `rgba(100, 255, 240, ${0.9 + pulse * 0.1})`;
  ctx.fillText('DEBUG ON', px + 7, py + 6);
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(220, 240, 255, 0.92)';
  ctx.fillText('Shift+D export  ·  `/F2 toggle', px + 7, py + 16);

  ctx.font = '4px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(180, 220, 255, 0.75)';
  let y = py + 26;
  for (let i = recentOverlay.length - 1; i >= 0; i--) {
    const e = recentOverlay[i];
    const line = `${e.type}${e.year != null ? ' y' + e.year : ''}${
      e.cashAfter != null ? ' cash=' + e.cashAfter : e.cash != null ? ' cash=' + e.cash : ''
    }${e.net != null ? ' net=' + e.net : ''}`;
    ctx.fillText(line.slice(0, 48), px + 7, y);
    y += 7;
  }
  ctx.restore();
}

/** Bootstrap from URL + localStorage; install hotkeys. */
export function initDebugFromEnvironment() {
  loadPersisted();
  let want = false;
  try {
    const q = new URLSearchParams(window.location.search);
    const v = (q.get('debug') || '').toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') want = true;
    if (v === '0' || v === 'false' || v === 'no') want = false;
    else if (localStorage.getItem(FLAG_KEY) === '1') want = true;
  } catch {
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') want = true;
    } catch {
      /* ignore */
    }
  }
  if (want) enable('boot');

  window.addEventListener(
    'keydown',
    (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Capture phase: works anytime during play (dialogs, hallway, room) unless typing in an input
      if (e.key === 'F2' || e.code === 'F2' || e.key === '`' || e.code === 'Backquote') {
        e.preventDefault();
        e.stopPropagation();
        toggle(e.key === 'F2' || e.code === 'F2' ? 'F2' : 'backtick');
        return;
      }
      if (enabled && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        exportDownload();
      }
      if (enabled && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        copyToClipboard().catch((err) => console.warn('clipboard failed', err));
      }
    },
    true
  );
}

// Expose for console: window.__ycitwyDebug
if (typeof window !== 'undefined') {
  window.__ycitwyDebug = {
    enable,
    disable,
    toggle,
    isEnabled,
    log,
    getLogs,
    clearLogs,
    exportDownload,
    copyToClipboard,
    getHallwayStash,
    setHallwayStash,
  };
}
