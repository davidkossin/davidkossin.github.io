import { PALETTE, VIEW_W } from '../config.js';
import { computeWorth } from '../finance/Engine.js';
import { makeDialogChrome } from './Assets.js';

function money(n) {
  const v = Math.round(n || 0);
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString('en-US');
}

export class Hud {
  constructor() {
    this.chrome = null;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} portfolio
   * @param {object} [worthOverride]
   */
  draw(ctx, portfolio, worthOverride = null) {
    const worth = worthOverride || computeWorth(portfolio);
    const h = 42;
    const w = VIEW_W - 8;
    const x = 4;
    const y = 4;

    if (!this.chrome || this.chrome.width !== w || this.chrome.height !== h) {
      this.chrome = makeDialogChrome(w, h);
    }
    ctx.drawImage(this.chrome, x, y);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`Age ${portfolio.age}`, x + 8, y + 8);
    ctx.fillText(`Year ${portfolio.year}`, x + 72, y + 8);

    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(`Net ${money(worth.netWorth)}`, x + 160, y + 8);

    ctx.fillStyle = '#b0c8a0';
    ctx.fillText(`Sal ${money(portfolio.salary)}`, x + 8, y + 22);
    ctx.fillStyle = '#a0c0e0';
    ctx.fillText(`Liq ${money(worth.liquid)}`, x + 110, y + 22);
    ctx.fillStyle = '#d0b090';
    ctx.fillText(`Illiq ${money(worth.illiquid)}`, x + 210, y + 22);
  }
}
