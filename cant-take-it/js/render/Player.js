import { KEYS, TILE } from '../config.js';
import { makePlayerSprite } from './Assets.js';
import { virtualKeys } from '../input/VirtualPad.js';

/** Movement keys only — typing never pollutes the pressed set. */
const MOVE_KEYS = new Set([
  ...KEYS.up,
  ...KEYS.down,
  ...KEYS.left,
  ...KEYS.right,
]);

export class Player {
  constructor(x, y, { speed = 1.35 } = {}) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 12;
    this.speed = speed;
    this.facing = 'down';
    this.moving = false;
    this.frame = 0;
    this.animTimer = 0;
    this.keys = new Set();
    /** When false, keydown does not add keys (dialogs / locked / pause). */
    this.inputEnabled = true;
  }

  bindInput(target = window) {
    this._kd = (e) => {
      if (!this.inputEnabled) return;
      if (!MOVE_KEYS.has(e.key)) return;
      this.keys.add(e.key);
    };
    this._ku = (e) => {
      // Always process keyup so held keys don't stick after re-enable
      this.keys.delete(e.key);
      if (e.key.length === 1) {
        this.keys.delete(e.key.toLowerCase());
        this.keys.delete(e.key.toUpperCase());
      }
    };
    target.addEventListener('keydown', this._kd);
    target.addEventListener('keyup', this._ku);
  }

  unbindInput(target = window) {
    if (this._kd) target.removeEventListener('keydown', this._kd);
    if (this._ku) target.removeEventListener('keyup', this._ku);
  }

  clearKeys() {
    this.keys.clear();
  }

  pressed(dirs) {
    for (const k of dirs) {
      if (this.keys.has(k)) return true;
      if (virtualKeys.has(k)) return true;
    }
    return false;
  }

  /**
   * @param {(nx:number,ny:number,w:number,h:number)=>boolean} solidAt
   */
  update(solidAt) {
    let dx = 0;
    let dy = 0;
    if (this.pressed(KEYS.left)) dx -= 1;
    if (this.pressed(KEYS.right)) dx += 1;
    if (this.pressed(KEYS.up)) dy -= 1;
    if (this.pressed(KEYS.down)) dy += 1;

    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) {
      this.animTimer = 0;
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
    else this.facing = dy < 0 ? 'up' : 'down';

    const len = Math.hypot(dx, dy) || 1;
    dx = (dx / len) * this.speed;
    dy = (dy / len) * this.speed;

    const tryMove = (mx, my) => {
      const nx = this.x + mx;
      const ny = this.y + my;
      if (!solidAt(nx, ny, this.w, this.h)) {
        this.x = nx;
        this.y = ny;
        return true;
      }
      return false;
    };

    if (!tryMove(dx, dy)) {
      if (!tryMove(dx, 0)) tryMove(0, dy);
    }

    // Snappy 4-frame walk cycle
    this.animTimer += 1;
    if (this.animTimer >= 6) {
      this.animTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }
  }

  draw(ctx, hairColor, hairLength, age) {
    const gray = Math.max(0, Math.min(1, (age - 50) / 50));
    const spr = makePlayerSprite(
      hairColor,
      hairLength,
      gray,
      this.facing,
      this.moving ? this.frame : 0
    );
    // slight bob on odd frames
    const bob = this.moving && (this.frame === 1 || this.frame === 3) ? -1 : 0;
    ctx.drawImage(spr, Math.round(this.x - 2), Math.round(this.y - 12 + bob));
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  overlaps(rx, ry, rw, rh) {
    return this.x < rx + rw && this.x + this.w > rx && this.y < ry + rh && this.y + this.h > ry;
  }
}
