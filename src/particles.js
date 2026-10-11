/**
 * Lightweight particle system: embers, dust, sparkles and drifting motes.
 * Particles live in world space; `additive` ones are drawn with 'lighter'.
 */
export class Particles {
  constructor() {
    this.list = [];
  }

  /**
   * @param {object} p { x, y, vx, vy, life, size, color 'r,g,b', gravity, additive, drag }
   */
  spawn(p) {
    this.list.push({ gravity: 0, drag: 0, additive: true, alpha: 1, ...p, age: 0 });
  }

  /** A soft burst, e.g. collecting a light orb. */
  burst(x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (opts.speed ?? 80) * (0.3 + Math.random());
      this.spawn({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (opts.lift ?? 20),
        life: (opts.life ?? 0.8) * (0.6 + Math.random() * 0.6),
        size: opts.size ?? 2,
        color: opts.color ?? '255,200,120',
        gravity: opts.gravity ?? 0,
        drag: opts.drag ?? 2,
        additive: opts.additive ?? true,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - Math.min(1, p.drag * dt);
      p.vy *= 1 - Math.min(1, p.drag * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  clear() {
    this.list.length = 0;
  }

  draw(ctx, cam) {
    ctx.save();
    for (const p of this.list) {
      const x = p.x - cam.x, y = p.y - cam.y;
      if (x < -10 || x > cam.w + 10 || y < -10 || y > cam.h + 10) continue;
      const t = p.age / p.life;
      const a = p.alpha * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = `rgba(${p.color},${a})`;
      const s = p.size;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
  }
}
