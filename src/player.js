/**
 * The child: movement (with coyote time, jump buffering and variable jump
 * height) and a small procedural drawing with a swinging lantern.
 */
import { PHYS, PLAYER } from './config.js';
import { moveAndCollide } from './physics.js';
import { approach, clamp } from './utils.js';

export class Player {
  constructor() {
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.reset(0, 0);
  }

  /** Place the player with feet at (x, y). */
  reset(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.runPhase = 0;
    this.squash = 0; // landing squash, decays to 0
    this.swing = 0; // lantern pendulum angle
    this.swingVel = 0;
    this.frozen = false; // true during cutscenes / death
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
  get feetY() { return this.y + this.h; }
  get rect() { return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 2 }; }

  /** World position of the lantern flame (light source). */
  get lanternPos() {
    const hx = this.centerX + this.facing * 9;
    const hy = this.y + 14;
    return { x: hx + Math.sin(this.swing) * 9, y: hy + Math.cos(this.swing) * 9 };
  }

  /**
   * Advances one fixed step. Returns a list of event names
   * ('jump', 'land') that other systems react to (sound, particles, lantern).
   */
  update(dt, input, level) {
    const events = [];
    const dir = this.frozen ? 0 : input.axisX();
    const prevVx = this.vx;

    // Horizontal: accelerate toward target speed, with separate air control.
    if (dir !== 0) {
      this.facing = dir;
      const accel = this.onGround ? PHYS.groundAccel : PHYS.airAccel;
      this.vx = approach(this.vx, dir * PHYS.moveSpeed, accel * dt);
    } else {
      const fric = this.onGround ? PHYS.groundFriction : PHYS.airFriction;
      this.vx = approach(this.vx, 0, fric * dt);
    }

    // Jump timing helpers.
    this.coyote = this.onGround ? PHYS.coyoteTime : this.coyote - dt;
    if (!this.frozen && input.wasPressed('jump')) this.buffer = PHYS.jumpBuffer;
    else this.buffer -= dt;

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -PHYS.jumpVelocity;
      this.buffer = 0;
      this.coyote = 0;
      this.onGround = false;
      events.push('jump');
    }

    // Gravity; releasing jump early makes a shorter hop.
    let g = PHYS.gravity;
    if (this.vy < 0 && (this.frozen || !input.isDown('jump'))) g *= PHYS.jumpCutGravity;
    this.vy = Math.min(this.vy + g * dt, PHYS.maxFall);

    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    const hit = moveAndCollide(this, level, dt);
    this.onGround = hit.onGround;
    if (hit.onGround) level.notifyStanding(hit.groundTiles);
    if (this.onGround && !wasGround) {
      this.squash = clamp(fallSpeed / PHYS.maxFall, 0.15, 1);
      events.push('land');
    }

    // Animation state.
    if (this.onGround && Math.abs(this.vx) > 10) this.runPhase += Math.abs(this.vx) * dt * 0.055;
    this.squash = approach(this.squash, 0, dt * 4);

    // Lantern pendulum: driven by horizontal acceleration, damped.
    const accelX = (this.vx - prevVx) / dt;
    this.swingVel += (-this.swing * 60 - accelX * 0.012 - this.swingVel * 5) * dt;
    this.swing = clamp(this.swing + this.swingVel * dt, -0.9, 0.9);

    return events;
  }

  draw(ctx, cam, lanternGlow) {
    const x = Math.round(this.centerX - cam.x);
    const y = Math.round(this.feetY - cam.y);
    const f = this.facing;
    const run = this.onGround && Math.abs(this.vx) > 10;
    const legSwing = run ? Math.sin(this.runPhase) * 5 : 0;
    const bob = run ? Math.abs(Math.cos(this.runPhase)) * 1.5 : 0;
    const sq = this.squash * 4;

    ctx.save();
    ctx.translate(x, y);

    // legs
    ctx.fillStyle = '#1c2029';
    if (this.onGround) {
      ctx.fillRect(-4 + legSwing * 0.6, -9, 3, 9);
      ctx.fillRect(1 - legSwing * 0.6, -9, 3, 9);
    } else {
      ctx.fillRect(-4, -10, 3, 7); // tucked in the air
      ctx.fillRect(1, -9, 3, 6);
    }

    ctx.translate(0, -bob + sq);
    ctx.scale(1 + this.squash * 0.15, 1 - this.squash * 0.12);

    // coat (slightly too big – it was someone else's)
    ctx.fillStyle = '#44546a';
    ctx.beginPath();
    ctx.moveTo(-6, -22);
    ctx.lineTo(6, -22);
    ctx.lineTo(8, -8);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    // scarf
    ctx.fillStyle = '#8c3a2c';
    ctx.fillRect(-6, -23, 12, 3);
    ctx.fillRect(-f * 5 - 1.5, -21, 3, 7 + Math.sin(this.runPhase * 0.5) * 1.5);

    // head + beanie
    ctx.fillStyle = '#c7a488';
    ctx.beginPath();
    ctx.arc(f * 1, -28, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#262a35';
    ctx.beginPath();
    ctx.arc(f * 1, -29, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(f * 1 - 6, -30, 12, 2);
    // eye: a single dark dot, looking ahead
    ctx.fillStyle = '#15171c';
    ctx.fillRect(f * 3.5 - 0.5, -28, 1.5, 1.5);

    ctx.restore();

    // arm + lantern (world coordinates, so the swing is independent of squash)
    const lp = this.lanternPos;
    const hx = this.centerX + f * 9 - cam.x;
    const hy = this.y + 14 - cam.y + sq;
    ctx.strokeStyle = '#3c4a5d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + f * 3, y - 19 + sq);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    drawLantern(ctx, lp.x - cam.x, lp.y - cam.y, hx, hy, lanternGlow);
  }
}

/**
 * Draws a small hand lantern hanging from (hx, hy) with its body at (lx, ly).
 * `glow` in [0, 1] controls how bright the glass is. Shared with the ending's
 * other children.
 */
export function drawLantern(ctx, lx, ly, hx, hy, glow) {
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(lx, ly - 5);
  ctx.stroke();

  ctx.fillStyle = '#2b2620';
  ctx.fillRect(lx - 4, ly - 6, 8, 2);
  ctx.fillRect(lx - 4, ly + 5, 8, 2);
  const g = Math.max(0, Math.min(1, glow));
  ctx.fillStyle = `rgb(${Math.round(60 + 195 * g)}, ${Math.round(45 + 170 * g)}, ${Math.round(30 + 110 * g)})`;
  ctx.fillRect(lx - 3, ly - 4, 6, 9);
  ctx.fillStyle = `rgba(255,255,230,${0.85 * g})`;
  ctx.fillRect(lx - 1, ly - 1, 2, 4);
}
