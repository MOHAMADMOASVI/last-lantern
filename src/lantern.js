/**
 * The lantern's charge. It drains over time (per-level rate) and a little per
 * jump. When it hits zero a short grace timer starts: reach a safe point
 * before it ends or the level resets to the last checkpoint.
 */
import { LANTERN } from './config.js';
import { clamp, easeOutCubic, lerp } from './utils.js';

export class Lantern {
  constructor() {
    this.drainRate = 2;
    this.reset();
  }

  reset() {
    this.charge = LANTERN.max;
    this.darkTimer = 0; // counts down while the lantern is out
    this.flicker = 1;
    this.time = 0;
  }

  get fraction() { return this.charge / LANTERN.max; }
  get isOut() { return this.charge <= 0; }
  get isLow() { return this.fraction < LANTERN.lowThreshold; }
  /** 1 → just went out, 0 → time's up. */
  get darkFraction() { return this.isOut ? this.darkTimer / LANTERN.darkGrace : 1; }

  /**
   * @returns {'out'|'expired'|null} an event when the state changes
   */
  update(dt, paused = false) {
    this.time += dt;
    this.updateFlicker();
    if (paused) return null;

    if (!this.isOut) {
      this.charge -= this.drainRate * dt;
      if (this.charge <= 0) {
        this.charge = 0;
        this.darkTimer = LANTERN.darkGrace;
        return 'out';
      }
      return null;
    }
    this.darkTimer -= dt;
    return this.darkTimer <= 0 ? 'expired' : null;
  }

  spend(amount) {
    if (!this.isOut) this.charge = Math.max(0.01, this.charge - amount);
  }

  add(amount) {
    this.charge = clamp(this.charge + amount, 0, LANTERN.max);
  }

  /** Irregular flame flicker; gets more violent as the charge drops. */
  updateFlicker() {
    const t = this.time;
    const calm = 1 + Math.sin(t * 7.3) * 0.015 + Math.sin(t * 13.1) * 0.01;
    if (!this.isLow || this.isOut) {
      this.flicker = this.isOut ? 0.85 + Math.sin(t * 5) * 0.1 : calm;
      return;
    }
    const severity = 1 - this.fraction / LANTERN.lowThreshold; // 0..1
    const dip = Math.random() < 0.04 * severity ? 0.55 + Math.random() * 0.25 : 1;
    this.flicker = calm * lerp(1, dip, severity) + (Math.random() - 0.5) * 0.06 * severity;
  }

  /** Light radius in pixels. */
  get radius() {
    if (this.isOut) return LANTERN.emberRadius * this.flicker;
    const r = lerp(LANTERN.minRadius, LANTERN.maxRadius, easeOutCubic(this.fraction));
    return r * this.flicker;
  }

  /** Brightness of the glass itself (0..1). */
  get glow() {
    return this.isOut ? 0.15 : clamp(0.35 + this.fraction * 0.8, 0, 1) * this.flicker;
  }
}
