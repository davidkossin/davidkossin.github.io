import { KEYS, TILE } from '../config.js';
import { makePlayerSprite } from './Assets.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 12;
    this.speed = 1.35;
    this.facing = 'down';
    this.moving = false;
    this.frame = 0;
    this.keys = new Set();
  }

  bindInput(target = window) {
    this._kd = (e) => {
      this.keys.add(e.key);
    };
    this._ku = (e) => {
      this.keys.delete(e.key);
    };
    target.addEventListener('keydown', this._kd);
    target.addEventListener('keyup', this._ku);
  }

  unbindInput(target = window) {
    if (this._kd) target.removeEventListener('keydown', this._kd);
    if (this._ku) target.removeEventListener('keyup', this._ku);
  }

  pressed(dirs) {
    for (const k of dirs) if (this.keys.has(k)) return true;
    return false;
  }

  /**
   * @param {number} dt - unused (fixed step)
   * @param {(nx:number,ny:number)=>boolean} solidAt - true if blocked
   */
  update(solidAt) {
    let dx = 0;
    let dy = 0;
    if (this.pressed(KEYS.left)) dx -= 1;
    if (this.pressed(KEYS.right)) dx += 1;
    if (this.pressed(KEYS.up)) dy -= 1;
    if (this.pressed(KEYS.down)) dy += 1;

    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) return;

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

    this.frame += 0.15;
  }

  draw(ctx, hairColor, hairLength, age) {
    const gray = Math.max(0, Math.min(1, (age - 50) / 50));
    const spr = makePlayerSprite(hairColor, hairLength, gray);
    // bob when moving
    const bob = this.moving ? Math.sin(this.frame) * 1 : 0;
    ctx.drawImage(spr, Math.round(this.x - 2), Math.round(this.y - 12 + bob));
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  /** AABB overlap with world rect */
  overlaps(rx, ry, rw, rh) {
    return this.x < rx + rw && this.x + this.w > rx && this.y < ry + rh && this.y + this.h > ry;
  }
}
