/**
 * Text overlays for the menu, pause and end screens. The game itself is
 * wordless; only these frames use (minimal) text.
 */
import { VIEW_W, VIEW_H } from './config.js';

export const FONT = '"Vazirmatn", "Geeza Pro", "Tahoma", sans-serif';

function text(ctx, str, x, y, size, color, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function glowTitle(ctx, x, y, size, alpha, time) {
  ctx.save();
  ctx.shadowColor = `rgba(255,170,80,${0.6 * alpha})`;
  ctx.shadowBlur = 30 + Math.sin(time * 2) * 6;
  text(ctx, 'آخرین چراغ', x, y, size, `rgba(255,222,170,${alpha})`, 700);
  ctx.restore();
}

/**
 * @param {Array<{label: string}>} options
 * @param {number} selected index
 */
export function drawMenu(ctx, options, selected, time, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  glowTitle(ctx, VIEW_W / 2, 130, 64, 1, time);
  options.forEach((opt, i) => {
    const y = 250 + i * 46;
    const active = i === selected;
    text(ctx, opt.label, VIEW_W / 2, y, 24, active ? 'rgba(255,214,160,1)' : 'rgba(180,190,210,0.5)', active ? 600 : 400);
    if (active) {
      // small flame marker beside the active option
      const f = 0.7 + Math.sin(time * 6) * 0.3;
      ctx.fillStyle = `rgba(255,180,90,${f})`;
      ctx.fillRect(VIEW_W / 2 + 70, y - 4, 6, 8);
      ctx.fillRect(VIEW_W / 2 - 76, y - 4, 6, 8);
    }
  });
  text(ctx, '← → حرکت    ·    Space پرش    ·    Esc مکث    ·    F تمام‌صفحه', VIEW_W / 2, VIEW_H - 34, 14, 'rgba(160,170,190,0.45)');
  ctx.restore();
}

export function drawPause(ctx, time) {
  ctx.fillStyle = 'rgba(5,7,14,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  glowTitle(ctx, VIEW_W / 2, VIEW_H / 2 - 40, 40, 0.9, time);
  text(ctx, 'Esc ادامه    ·    Q منو    ·    M صدا', VIEW_W / 2, VIEW_H / 2 + 30, 18, 'rgba(200,205,220,0.7)');
}

/** Warm dawn end card with a row of lit lanterns. */
export function drawEnd(ctx, time, t) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#3c4470');
  g.addColorStop(0.55, '#d9906a');
  g.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // a row of lanterns, softly bobbing
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = VIEW_W / 2 + (i - (n - 1) / 2) * 60;
    const y = 330 + Math.sin(time * 1.4 + i) * 4;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, 40);
    halo.addColorStop(0, 'rgba(255,240,200,0.8)');
    halo.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 40, y - 40, 80, 80);
    ctx.fillStyle = '#3a2e24';
    ctx.fillRect(x - 5, y - 9, 10, 3);
    ctx.fillRect(x - 5, y + 7, 10, 3);
    ctx.fillStyle = '#fff1c8';
    ctx.fillRect(x - 4, y - 6, 8, 13);
  }

  const a = Math.min(1, t / 2);
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, 'آخرین چراغ', VIEW_W / 2, 170, 58, 'rgba(60,40,40,0.85)', 700);
  text(ctx, 'هیچ چراغی تنها نمی‌ماند', VIEW_W / 2, 235, 22, 'rgba(70,50,50,0.7)');
  if (t > 3) {
    ctx.globalAlpha = Math.min(1, (t - 3) / 1) * (0.55 + Math.sin(time * 3) * 0.25);
    text(ctx, 'Enter', VIEW_W / 2, VIEW_H - 50, 18, 'rgba(70,50,50,0.9)');
  }
  ctx.restore();
}
