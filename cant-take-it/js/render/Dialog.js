/**
 * SNES / LTTP-styled dialog & menu boxes (logical canvas space).
 */

import { PALETTE, VIEW_W, VIEW_H, KEYS } from '../config.js';
import { makeDialogChrome } from './Assets.js';

export class Dialog {
  constructor() {
    this.active = false;
    this.title = '';
    this.lines = [];
    this.options = []; // { label, value }
    this.selected = 0;
    this.mode = 'text'; // text | menu | prompt | confirm
    this.promptValue = '';
    this.promptType = 'text'; // text | number
    this.resolve = null;
    this.chrome = null;
    this.flash = 0;
  }

  /**
   * Show message; resolves when confirmed.
   */
  show(text, { title = '' } = {}) {
    return new Promise((resolve) => {
      this.active = true;
      this.mode = 'text';
      this.title = title;
      this.lines = wrapText(text, 36);
      this.options = [{ label: 'OK', value: true }];
      this.selected = 0;
      this.resolve = resolve;
      this.chrome = null;
    });
  }

  /**
   * Show menu; resolves with option value.
   */
  menu(text, options, { title = '' } = {}) {
    return new Promise((resolve) => {
      this.active = true;
      this.mode = 'menu';
      this.title = title;
      this.lines = wrapText(text, 36);
      this.options = options;
      this.selected = 0;
      this.resolve = resolve;
      this.chrome = null;
    });
  }

  confirm(text, { title = 'Confirm', yes = 'Yes', no = 'No' } = {}) {
    return this.menu(text, [
      { label: yes, value: true },
      { label: no, value: false },
    ], { title });
  }

  prompt(text, { title = '', defaultValue = '', type = 'text' } = {}) {
    return new Promise((resolve) => {
      this.active = true;
      this.mode = 'prompt';
      this.title = title;
      this.lines = wrapText(text, 36);
      this.promptValue = String(defaultValue ?? '');
      this.promptType = type;
      this.options = [
        { label: 'Accept', value: '__accept' },
        { label: 'Cancel', value: '__cancel' },
      ];
      this.selected = 0;
      this.resolve = resolve;
      this.chrome = null;
    });
  }

  close(result) {
    const r = this.resolve;
    this.active = false;
    this.resolve = null;
    if (r) r(result);
  }

  handleKeyDown(e) {
    if (!this.active) return false;

    if (this.mode === 'prompt') {
      if (e.key === 'Backspace') {
        this.promptValue = this.promptValue.slice(0, -1);
        e.preventDefault();
        return true;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const ch = e.key;
        if (this.promptType === 'number') {
          if (/[0-9.\-]/.test(ch)) this.promptValue += ch;
        } else if (this.promptValue.length < 28) {
          this.promptValue += ch;
        }
        e.preventDefault();
        return true;
      }
    }

    if (KEYS.up.includes(e.key)) {
      this.selected = (this.selected - 1 + this.options.length) % this.options.length;
      e.preventDefault();
      return true;
    }
    if (KEYS.down.includes(e.key)) {
      this.selected = (this.selected + 1) % this.options.length;
      e.preventDefault();
      return true;
    }
    if (KEYS.confirm.includes(e.key)) {
      const opt = this.options[this.selected];
      if (this.mode === 'prompt') {
        if (opt.value === '__cancel') this.close(null);
        else {
          let v = this.promptValue;
          if (this.promptType === 'number') {
            const n = parseFloat(v);
            v = Number.isFinite(n) ? n : 0;
          }
          this.close(v);
        }
      } else {
        this.close(opt.value);
      }
      e.preventDefault();
      return true;
    }
    if (KEYS.cancel.includes(e.key)) {
      if (this.mode === 'prompt') this.close(null);
      else if (this.mode === 'menu' || this.mode === 'confirm') {
        const cancel = this.options.find((o) => o.value === false || o.value === null);
        this.close(cancel ? cancel.value : this.options[this.options.length - 1].value);
      }
      e.preventDefault();
      return true;
    }
    return true; // consume while open
  }

  draw(ctx) {
    if (!this.active) return;
    const boxW = 280;
    const lineH = 12;
    const optH = 14;
    const pad = 12;
    const textH = this.lines.length * lineH;
    const promptH = this.mode === 'prompt' ? 20 : 0;
    const optsH = this.options.length * optH + 4;
    const titleH = this.title ? 16 : 0;
    const boxH = Math.min(200, pad * 2 + titleH + textH + promptH + optsH + 8);
    const x = Math.floor((VIEW_W - boxW) / 2);
    const y = VIEW_H - boxH - 8;

    if (!this.chrome || this.chrome.width !== boxW || this.chrome.height !== boxH) {
      this.chrome = makeDialogChrome(boxW, boxH);
    }
    ctx.drawImage(this.chrome, x, y);

    ctx.imageSmoothingEnabled = false;
    let ty = y + pad;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';

    if (this.title) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(this.title, x + pad, ty);
      ty += titleH;
    }

    ctx.fillStyle = PALETTE.uiText;
    for (const line of this.lines) {
      ctx.fillText(line, x + pad, ty);
      ty += lineH;
    }

    if (this.mode === 'prompt') {
      ty += 4;
      ctx.fillStyle = '#000';
      ctx.fillRect(x + pad, ty, boxW - pad * 2, 14);
      ctx.strokeStyle = PALETTE.uiBorder;
      ctx.strokeRect(x + pad, ty, boxW - pad * 2, 14);
      ctx.fillStyle = PALETTE.uiText;
      const caret = (Math.floor(performance.now() / 400) % 2 === 0) ? '▌' : '';
      ctx.fillText(String(this.promptValue) + caret, x + pad + 3, ty + 3);
      ty += 18;
    } else {
      ty += 6;
    }

    this.options.forEach((opt, i) => {
      const selected = i === this.selected;
      if (selected) {
        ctx.fillStyle = 'rgba(200,160,80,0.25)';
        ctx.fillRect(x + pad - 2, ty - 1, boxW - pad * 2 + 4, optH);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText('▶', x + pad, ty);
      } else {
        ctx.fillStyle = PALETTE.uiText;
      }
      ctx.fillText(opt.label, x + pad + 12, ty);
      ty += optH;
    });
  }
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
