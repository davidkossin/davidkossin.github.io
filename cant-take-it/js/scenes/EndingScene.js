import { VIEW_W, VIEW_H, CANVAS_H, PALETTE, KEYS } from '../config.js';
import { drawWorthChart } from '../render/Charts.js';
import { computeWorth } from '../finance/Engine.js';
import { formatMoneyDisplay } from '../render/Dialog.js';

export class EndingScene {
  constructor() {
    this.phase = 0; // 0 fade, 1 text, 2 menu, 3 charts
    this.alpha = 0;
    this.timer = 0;
    this.done = false;
    this.waitKey = false;
    this.game = null;
    this.menuIndex = 0;
    this.menu = [
      { label: 'See your charts', value: 'charts' },
      { label: 'New Game', value: 'new' },
    ];
  }

  enter(game = null) {
    this.phase = 0;
    this.alpha = 0;
    this.timer = 0;
    this.done = false;
    this.waitKey = false;
    this.game = game;
    this.menuIndex = 0;
  }

  update() {
    this.timer += 1;
    if (this.phase === 0) {
      this.alpha = Math.min(1, this.timer / 90);
      if (this.alpha >= 1) {
        this.phase = 1;
        this.timer = 0;
      }
    } else if (this.phase === 1) {
      if (this.timer > 60) {
        this.phase = 2;
        this.waitKey = true;
      }
    }
  }

  handleKey(e) {
    if (this.phase === 3) {
      if (KEYS.confirm.includes(e.key) || KEYS.cancel.includes(e.key)) {
        this.phase = 2;
        this.waitKey = true;
        return true;
      }
      return false;
    }

    if (!this.waitKey || this.phase !== 2) return false;

    if (KEYS.up.includes(e.key)) {
      this.menuIndex = (this.menuIndex - 1 + this.menu.length) % this.menu.length;
      e.preventDefault();
      return true;
    }
    if (KEYS.down.includes(e.key)) {
      this.menuIndex = (this.menuIndex + 1) % this.menu.length;
      e.preventDefault();
      return true;
    }
    if (KEYS.confirm.includes(e.key)) {
      const choice = this.menu[this.menuIndex].value;
      if (choice === 'charts') {
        this.phase = 3;
        this.waitKey = true;
      } else {
        this.done = true;
      }
      e.preventDefault();
      return true;
    }
    return false;
  }

  render(ctx) {
    ctx.fillStyle = `rgba(0,0,0,${this.alpha})`;
    ctx.fillRect(0, 0, VIEW_W, CANVAS_H);

    if (this.phase >= 1 && this.phase < 3) {
      ctx.textAlign = 'center';
      const worth = this.game ? computeWorth(this.game.portfolio) : null;
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#666';
      if (worth) {
        ctx.fillText(`Net Worth  ${formatMoneyDisplay(worth.netWorth)}`, VIEW_W / 2, 90);
        ctx.fillText(`The Bank   ${formatMoneyDisplay(worth.bank)}`, VIEW_W / 2, 106);
      } else {
        ctx.fillText('Net Worth  - - -', VIEW_W / 2, 90);
        ctx.fillText('Assets    - - -', VIEW_W / 2, 106);
      }

      ctx.fillStyle = PALETTE.gold;
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText("You can't take", VIEW_W / 2, 140);
      ctx.fillText('it with you…', VIEW_W / 2, 158);

      if (this.phase >= 2) {
        ctx.font = '7px "Press Start 2P", monospace';
        this.menu.forEach((m, i) => {
          const sel = i === this.menuIndex;
          ctx.fillStyle = sel ? PALETTE.gold : PALETTE.uiText;
          ctx.fillText(`${sel ? '▶ ' : '  '}${m.label}`, VIEW_W / 2, 190 + i * 16);
        });
      }
      ctx.textAlign = 'left';
    }

    if (this.phase === 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIEW_W, CANVAS_H);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.gold;
      ctx.textAlign = 'center';
      ctx.fillText('Your life ledger', VIEW_W / 2, 22);
      ctx.textAlign = 'left';
      drawWorthChart(ctx, this.game?.worthHistory || [], {
        x: 16,
        y: 32,
        w: VIEW_W - 32,
        h: CANVAS_H - 80,
        series: ['netWorth', 'bank', 'salary'],
      });
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.uiText;
      ctx.textAlign = 'center';
      ctx.fillText('Enter / Esc — back', VIEW_W / 2, CANVAS_H - 12);
      ctx.textAlign = 'left';
    }
  }
}
