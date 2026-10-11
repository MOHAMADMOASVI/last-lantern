/** Smooth-follow camera with a little look-ahead in the facing direction. */
import { VIEW_W, VIEW_H } from './config.js';
import { clamp, damp } from './utils.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = VIEW_W;
    this.h = VIEW_H;
    this.lookAhead = 0;
    this.shake = 0;
  }

  /** Jump straight to the target (on level start / respawn). */
  snap(target, level) {
    this.lookAhead = 0;
    this.x = clamp(target.centerX - this.w / 2, 0, Math.max(0, level.pxWidth - this.w));
    this.y = clamp(target.centerY - this.h * 0.55, 0, Math.max(0, level.pxHeight - this.h));
  }

  update(dt, target, level) {
    this.lookAhead += (target.facing * 70 - this.lookAhead) * damp(2, dt);
    const tx = clamp(target.centerX + this.lookAhead - this.w / 2, 0, Math.max(0, level.pxWidth - this.w));
    const ty = clamp(target.centerY - this.h * 0.55, 0, Math.max(0, level.pxHeight - this.h));
    this.x += (tx - this.x) * damp(6, dt);
    this.y += (ty - this.y) * damp(4, dt);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  /** Integer view position used for drawing (keeps tiles crisp). */
  get view() {
    const s = this.shake * 4;
    return {
      x: Math.round(this.x + (Math.random() - 0.5) * s),
      y: Math.round(this.y + (Math.random() - 0.5) * s),
      w: this.w,
      h: this.h,
    };
  }
}
