/**
 * The final square. Other children wait with dim lanterns; walking up to each
 * one links the lanterns with a thread of light and pushes the darkness back.
 * When everyone is connected the whole square lights up and dawn breaks.
 */
import { drawLantern } from './player.js';
import { clamp, dist, easeInOut } from './utils.js';

const COATS = ['#6a5a3c', '#3d5a4a', '#5a3d52', '#3c4f6e', '#6e4a3c'];
const REACH = 58; // how close the player must get to connect
const FINALE_LENGTH = 10; // seconds from last connection to the end screen

export class Ending {
  constructor(level) {
    this.kids = level.children.map((c, i) => ({
      x: c.x,
      y: c.y,
      coat: COATS[i % COATS.length],
      height: 0.9 + ((i * 37) % 5) * 0.04,
      facing: -1,
      connected: false,
      glow: 0.12,
      connectTime: 0,
      phase: i * 1.7,
    }));
    this.chain = []; // kids in the order they were reached
    this.finaleTime = -1; // < 0 until everyone is connected
    this.time = 0;
    this.done = false;
  }

  get allConnected() { return this.chain.length === this.kids.length; }

  update(dt, player, sound, particles) {
    this.time += dt;
    for (const k of this.kids) {
      // They turn to look at you as you come closer.
      if (Math.abs(player.centerX - k.x) < 260) k.facing = player.centerX < k.x ? -1 : 1;
      if (!k.connected && dist(player.centerX, player.feetY, k.x, k.y) < REACH) {
        k.connected = true;
        k.connectTime = this.time;
        this.chain.push(k);
        sound.connect(this.chain.length - 1);
        particles.burst(k.x + k.facing * 9, k.y - 10, 30, { speed: 120, life: 1.2, color: '255,210,140' });
        if (this.allConnected) {
          this.finaleTime = 0;
          sound.finale();
        }
      }
      k.glow += ((k.connected ? 1 : 0.12 + Math.sin(this.time * 3 + k.phase) * 0.04) - k.glow) * Math.min(1, dt * 3);
    }

    if (this.finaleTime >= 0) {
      this.finaleTime += dt;
      if (this.finaleTime > 1.5) player.frozen = true;
      // Motes of light rising all over the square.
      if (Math.random() < dt * 40) {
        particles.spawn({
          x: player.centerX - 520 + Math.random() * 1040,
          y: player.feetY + 20,
          vx: (Math.random() - 0.5) * 10,
          vy: -30 - Math.random() * 60,
          life: 4 + Math.random() * 3,
          size: 2 + Math.random() * 2,
          color: '255,215,150',
          drag: 0,
        });
      }
      if (this.finaleTime > FINALE_LENGTH) this.done = true;
    }
  }

  /** Multiplier on the level's darkness: each connection helps, the finale clears it. */
  get darknessFactor() {
    const perKid = 1 - (this.chain.length / Math.max(1, this.kids.length)) * 0.35;
    if (this.finaleTime < 0) return perKid;
    return perKid * (1 - easeInOut(clamp(this.finaleTime / 5, 0, 1)));
  }

  /** 0..1, how far the sky has turned to dawn. */
  get warmth() {
    return this.finaleTime < 0 ? 0 : easeInOut(clamp((this.finaleTime - 1) / 6, 0, 1));
  }

  /** Fade-to-white amount at the very end. */
  get whiteout() {
    return this.finaleTime < 0 ? 0 : clamp((this.finaleTime - (FINALE_LENGTH - 2.5)) / 2.5, 0, 1);
  }

  lanternPos(k) {
    return { x: k.x + k.facing * 9, y: k.y - 14 * k.height + 9 + Math.sin(this.time * 1.5 + k.phase) };
  }

  lights(cam) {
    return this.kids.map((k) => {
      const p = this.lanternPos(k);
      return {
        x: p.x - cam.x,
        y: p.y - cam.y,
        r: 40 + k.glow * 200,
        strength: 0.6 + k.glow * 0.4,
        glow: k.glow,
      };
    });
  }

  draw(ctx, cam) {
    for (const k of this.kids) {
      const x = Math.round(k.x - cam.x);
      const y = Math.round(k.y - cam.y);
      if (x < -60 || x > cam.w + 60) continue;
      const s = k.height;
      const f = k.facing;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#1c2029';
      ctx.fillRect(-4, -9 * s, 3, 9 * s);
      ctx.fillRect(1, -9 * s, 3, 9 * s);
      ctx.fillStyle = k.coat;
      ctx.beginPath();
      ctx.moveTo(-6, -22 * s);
      ctx.lineTo(6, -22 * s);
      ctx.lineTo(8, -8 * s);
      ctx.lineTo(-8, -8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c3a086';
      ctx.beginPath();
      ctx.arc(f, -28 * s, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2622';
      ctx.beginPath();
      ctx.arc(f, -29 * s, 6, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.restore();

      const hx = x + f * 9, hy = y - 14 * s;
      const lp = this.lanternPos(k);
      ctx.strokeStyle = k.coat;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + f * 3, y - 19 * s);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      drawLantern(ctx, lp.x - cam.x, lp.y - cam.y, hx, hy, k.glow);
    }
  }

  /** Threads of light between connected lanterns (drawn additively). */
  drawThreads(ctx, cam, player) {
    if (!this.chain.length) return;
    const pts = [player.lanternPos, ...this.chain.map((k) => this.lanternPos(k))];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const kid = this.chain[i];
      const grow = clamp((this.time - kid.connectTime) / 0.8, 0, 1); // thread "travels" out
      const a = pts[i], b = pts[i + 1];
      const ax = a.x - cam.x, ay = a.y - cam.y;
      const bx = ax + (b.x - a.x) * grow, by = ay + (b.y - a.y) * grow;
      const sag = 24 + Math.sin(this.time * 1.3 + i) * 6;
      const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag * grow;
      for (const [w, alpha] of [[7, 0.08], [3, 0.25], [1.2, 0.8]]) {
        ctx.strokeStyle = `rgba(255,205,130,${alpha})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
