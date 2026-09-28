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
  log('debug', { on: true, reason, version: GAME_VERSION });
}

export function disable(reason = 'manual') {
  if (!enabled) return;
  log('debug', { on: false, reason });
  enabled = false;
  persistFlag();
  persist();
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

export function getLogs() {
  return buffer.slice();
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
  const doc = {
    meta: {
      game: "You Can't Take It With You",
      version: GAME_VERSION,
      exportedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      entryCount: buffer.length,
      debugEnabled: enabled,
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

/** Draw DEBUG badge + last few lines (call from main loop when enabled). */
export function drawOverlay(ctx, viewW, canvasH) {
  if (!enabled) return;
  ctx.save();
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(80, 220, 255, 0.85)';
  ctx.fillText('DEBUG  ` /F2  Shift+D export', 4, canvasH - 3);

  ctx.font = '4px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(200, 230, 255, 0.55)';
  let y = canvasH - 12;
  for (let i = recentOverlay.length - 1; i >= 0; i--) {
    const e = recentOverlay[i];
    const line = `${e.type}${e.year != null ? ' y' + e.year : ''}${
      e.cashAfter != null ? ' cash=' + e.cashAfter : e.cash != null ? ' cash=' + e.cash : ''
    }${e.net != null ? ' net=' + e.net : ''}`;
    ctx.fillText(line.slice(0, 56), 4, y);
    y -= 6;
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

      if (e.key === 'F2' || e.key === '`') {
        e.preventDefault();
        toggle(e.key === 'F2' ? 'F2' : 'backtick');
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
  };
}
