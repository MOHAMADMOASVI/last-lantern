/**
 * Drawing for the interactive level objects: safe-point lamps, light orbs and
 * the exit doorway. Their logic lives in game.js; these are pure renderers.
 */

/** Street lamp that acts as checkpoint + refill station. (x, y) = foot of pole. */
export function drawSafePoint(ctx, sp, cam, time) {
  const x = Math.round(sp.x - cam.x);
  const y = Math.round(sp.y - cam.y);
  if (x < -60 || x > cam.w + 60) return;

  ctx.fillStyle = '#2b313c';
  ctx.fillRect(x - 7, y - 6, 14, 6); // base
  ctx.fillStyle = '#20252e';
  ctx.fillRect(x - 2, y - 66, 4, 62); // pole
  ctx.fillRect(x - 9, y - 70, 18, 4); // cap
  ctx.fillRect(x - 6, y - 74, 12, 4);

  // glass
  const g = sp.glow; // 0 unlit → 1 fully lit
  const flick = 1 + Math.sin(time * 9 + sp.x) * 0.04 * g;
  ctx.fillStyle = g > 0.05
    ? `rgba(255,${Math.round(170 + 60 * g)},${Math.round(90 + 60 * g)},${(0.35 + 0.65 * g) * flick})`
    : 'rgba(80,95,120,0.45)';
  ctx.fillRect(x - 6, y - 66, 12, 13);
  // a tiny ember even when unlit so you can find it in the dark
  ctx.fillStyle = `rgba(255,170,90,${0.5 + Math.sin(time * 2.5 + sp.x) * 0.25})`;
  ctx.fillRect(x - 1, y - 59, 2, 2);
  ctx.fillStyle = '#20252e';
  ctx.fillRect(x - 7, y - 54, 14, 3);
}

export function drawOrb(ctx, orb, cam, time) {
  const bob = Math.sin(time * 2.4 + orb.phase) * 4;
  const x = orb.x - cam.x;
  const y = orb.y - cam.y + bob;
  if (x < -30 || x > cam.w + 30) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.8 + Math.sin(time * 5 + orb.phase) * 0.2;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
  g.addColorStop(0, `rgba(255,235,180,${0.9 * pulse})`);
  g.addColorStop(0.3, `rgba(255,190,110,${0.45 * pulse})`);
  g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 14, y - 14, 28, 28);
  ctx.fillStyle = '#fff6dc';
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  ctx.restore();
}

/** Stone doorway with pale light spilling from the other side. */
export function drawExit(ctx, exit, cam, time) {
  const x = Math.round(exit.x - cam.x);
  const y = Math.round(exit.y - cam.y);
  if (x < -80 || x > cam.w + 80) return;
  const { w, h } = exit;

  const inner = ctx.createLinearGradient(x, y, x + w, y);
  inner.addColorStop(0, 'rgba(150,170,210,0.35)');
  inner.addColorStop(0.5, `rgba(200,215,240,${0.55 + Math.sin(time * 1.5) * 0.08})`);
  inner.addColorStop(1, 'rgba(150,170,210,0.35)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.fill();

  // frame
  ctx.strokeStyle = '#3a414d';
  ctx.lineWidth = 5;
  ctx.stroke();

  // light rays spilling onto the ground
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(170,190,230,0.06)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 6 + i * 10, y + 10);
    ctx.lineTo(x - 50 + i * 20, y + h);
    ctx.lineTo(x + w + 50 - (2 - i) * 20, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
