import { PALETTE, VIEW_W } from '../config.js';
import { computeWorth } from '../finance/Engine.js';
import { makeHudIcon, makeHudBox } from './Assets.js';

function money(n) {
  const v = Math.round(n || 0);
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString('en-US');
}

/**
 * Floating LTTP-style HUD — icon + number clusters across the top,
 * not a solid full-width bar. Gold thin frames like item boxes.
 */
export class Hud {
  constructor() {}

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} portfolio
   * @param {object} [worthOverride]
   */
  draw(ctx, portfolio, worthOverride = null) {
    const worth = worthOverride || computeWorth(portfolio);
    const y = 4;
    const boxH = 18;

    const clusters = [
      { icon: 'age', label: String(portfolio.age), x: 6, w: 36 },
      { icon: 'year', label: String(portfolio.year), x: 46, w: 52 },
      { icon: 'bank', label: money(worth.bank), x: 102, w: 70 },
      { icon: 'portfolio', label: money(worth.portfolio), x: 176, w: 78 },
      { icon: 'salary', label: money(portfolio.salary || 0), x: 258, w: 58 },
    ];

    for (const c of clusters) {
      const box = makeHudBox(c.w, boxH);
      ctx.drawImage(box, c.x, y);
      const icon = makeHudIcon(c.icon);
      ctx.drawImage(icon, c.x + 3, y + 5);
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = PALETTE.uiText;
      // truncate if needed
      let text = c.label;
      while (text.length > 1 && ctx.measureText(text).width > c.w - 14) {
        text = text.slice(0, -1);
      }
      ctx.fillText(text, c.x + 12, y + 6);
    }

    // Kids list under Age cluster
    const kids = portfolio.kids || [];
    if (kids.length) {
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = '#a89878';
      const names = kids
        .slice(0, 4)
        .map((k) => `${(k.name || '?').slice(0, 6)} ${k.age}`)
        .join(' · ');
      ctx.fillText(names, 6, y + boxH + 3);
    }
  }
}
