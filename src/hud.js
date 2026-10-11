/**
 * In-game HUD (no text): lantern charge gauge, the "lantern is out" countdown
 * ring, a hint arrow toward the nearest safe point, and a pulsing vignette.
 */
import { VIEW_W, VIEW_H } from './config.js';
import { clamp } from './utils.js';

export function drawHud(ctx, game, time) {
  const { lantern, player, level } = game;
  const cam = game.view;

  drawVignette(ctx, lantern, time);

  // --- charge gauge (top-left): a lantern icon and a slim bar
  const low = lantern.isLow;
  const x = 28, y = 30;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#2b2620';
  ctx.fillRect(x - 6, y - 10, 12, 3);
  ctx.fillRect(x - 6, y + 9, 12, 3);
  const glow = lantern.glow;
  ctx.fillStyle = `rgb(${Math.round(60 + 195 * glow)},${Math.round(45 + 160 * glow)},${Math.round(30 + 100 * glow)})`;
  ctx.fillRect(x - 5, y - 7, 10, 16);

  const bw = 150, bh = 6, bx = x + 16, by = y - 2;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(bx, by, bw, bh);
  const pulse = low ? 0.55 + Math.abs(Math.sin(time * 6)) * 0.45 : 1;
  ctx.fillStyle = low ? `rgba(255,120,70,${pulse})` : 'rgba(255,190,100,0.95)';
  ctx.fillRect(bx, by, bw * lantern.fraction, bh);
  ctx.restore();

  // --- countdown ring around the child while the lantern is out
  if (lantern.isOut) {
    const px = player.centerX - cam.x, py = player.centerY - cam.y;
    const f = lantern.darkFraction;
    ctx.save();
    ctx.strokeStyle = `rgba(255,140,90,${0.35 + (1 - f) * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    ctx.stroke();
    ctx.restore();
  }

  // --- arrow to the nearest safe point when light is running out and it's off-screen
  if (lantern.isLow && level.safePoints.length) {
    const target = nearestSafePoint(level, player);
    if (target) {
      const tx = target.x - cam.x, ty = target.y - 50 - cam.y;
      const onScreen = tx > 20 && tx < VIEW_W - 20 && ty > 20 && ty < VIEW_H - 20;
      if (!onScreen) drawEdgeArrow(ctx, tx, ty, time);
    }
  }
}

export function nearestSafePoint(level, player) {
  let best = null, bestD = Infinity;
  for (const sp of level.safePoints) {
    const d = Math.hypot(sp.x - player.centerX, sp.y - player.feetY);
    if (d < bestD) { bestD = d; best = sp; }
  }
  return best;
}

function drawEdgeArrow(ctx, tx, ty, time) {
  const cx = VIEW_W / 2, cy = VIEW_H / 2;
  const ang = Math.atan2(ty - cy, tx - cx);
  const ex = clamp(cx + Math.cos(ang) * 1000, 34, VIEW_W - 34);
  const ey = clamp(cy + Math.sin(ang) * 1000, 34, VIEW_H - 34);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.globalAlpha = 0.45 + Math.sin(time * 5) * 0.25;
  ctx.fillStyle = '#ffc27a';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -9);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVignette(ctx, lantern, time) {
  let strength = 0.45;
  let color = '0,0,0';
  if (lantern.isOut) {
    // heartbeat-synced pulse, more intense as time runs out
    const urgency = 1 - lantern.darkFraction;
    strength = 0.6 + (0.25 + urgency * 0.3) * Math.pow(Math.abs(Math.sin(time * (3 + urgency * 3))), 6);
    color = '25,0,0';
  } else if (lantern.isLow) {
    strength = 0.5 + Math.abs(Math.sin(time * 2)) * 0.1;
  }
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
