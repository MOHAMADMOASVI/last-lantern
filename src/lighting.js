/**
 * Darkness + light rendering.
 *
 * 1. An offscreen canvas is filled with near-black fog.
 * 2. Each light "erases" a soft circle from it (destination-out).
 * 3. The result is laid over the scene, then a warm additive glow is added
 *    on top so lit areas feel amber rather than just "less dark".
 *
 * A light: { x, y (screen px), r, strength 0..1, color 'r,g,b', glow 0..1 }
 */
import { VIEW_W, VIEW_H } from './config.js';

export class Lighting {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scale = 1;
  }

  resize(pixelW, pixelH, scale) {
    this.canvas.width = pixelW;
    this.canvas.height = pixelH;
    this.scale = scale;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx main (already scaled) context
   * @param {Array} lights
   * @param {number} darkness 0 (no fog) .. 1 (pitch black)
   * @param {string} fogColor 'r,g,b' colour of the darkness
   */
  render(ctx, lights, darkness, fogColor = '5,7,14') {
    const d = this.ctx;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.clearRect(0, 0, this.canvas.width, this.canvas.height);
    d.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    if (darkness > 0.001) {
      d.globalCompositeOperation = 'source-over';
      d.fillStyle = `rgba(${fogColor},${darkness})`;
      d.fillRect(0, 0, VIEW_W, VIEW_H);

      d.globalCompositeOperation = 'destination-out';
      for (const l of lights) {
        if (l.r <= 1 || l.strength <= 0) continue;
        if (l.x + l.r < 0 || l.x - l.r > VIEW_W || l.y + l.r < 0 || l.y - l.r > VIEW_H) continue;
        const g = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(0,0,0,${l.strength})`);
        g.addColorStop(0.45, `rgba(0,0,0,${l.strength * 0.8})`);
        g.addColorStop(0.75, `rgba(0,0,0,${l.strength * 0.35})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g;
        d.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      d.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.canvas, 0, 0, VIEW_W, VIEW_H);
    }

    ctx.save();
    // Tint what the light reveals toward the light's colour (amber by default)...
    ctx.globalCompositeOperation = 'soft-light';
    for (const l of lights) {
      if (!l.glow || l.r <= 1) continue;
      if (l.x + l.r < 0 || l.x - l.r > VIEW_W || l.y + l.r < 0 || l.y - l.r > VIEW_H) continue;
      const color = l.color || '255,150,60';
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${color},${0.9 * l.glow})`);
      g.addColorStop(0.6, `rgba(${color},${0.5 * l.glow})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    // ...then add a warm additive glow around the source.
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.glow || l.r <= 1) continue;
      const r = l.r * 0.8;
      if (l.x + r < 0 || l.x - r > VIEW_W || l.y + r < 0 || l.y - r > VIEW_H) continue;
      const color = l.color || '255,170,80';
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      g.addColorStop(0, `rgba(${color},${0.5 * l.glow})`);
      g.addColorStop(0.35, `rgba(${color},${0.2 * l.glow})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}
