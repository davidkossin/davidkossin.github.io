import { VIEW_W, VIEW_H, PALETTE } from '../config.js';
import { KEYS } from '../config.js';

export class EndingScene {
  constructor() {
    this.phase = 0; // 0 fade, 1 text, 2 wait
    this.alpha = 0;
    this.timer = 0;
    this.done = false;
    this.waitKey = false;
  }

  enter() {
    this.phase = 0;
    this.alpha = 0;
    this.timer = 0;
    this.done = false;
    this.waitKey = false;
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
    if (!this.waitKey) return false;
    if (KEYS.confirm.includes(e.key) || e.key.length === 1 || e.key === 'Enter') {
      this.done = true;
      return true;
    }
    return false;
  }

  render(ctx) {
    ctx.fillStyle = `rgba(0,0,0,${this.alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.phase >= 1) {
      ctx.textAlign = 'center';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#666';
      ctx.fillText('Net Worth  - - -', VIEW_W / 2, 90);
      ctx.fillText('Assets    - - -', VIEW_W / 2, 108);

      ctx.fillStyle = PALETTE.gold;
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText("You can't take", VIEW_W / 2, 150);
      ctx.fillText('it with you…', VIEW_W / 2, 168);

      if (this.phase >= 2 && Math.floor(this.timer / 40) % 2 === 0) {
        ctx.fillStyle = PALETTE.uiText;
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText('Press any key — New Game', VIEW_W / 2, 210);
      }
      ctx.textAlign = 'left';
    }
  }
}
