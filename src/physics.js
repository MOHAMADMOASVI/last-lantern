/**
 * Tile-based AABB collision. Axes are resolved separately (X, then Y), which
 * is simple and stable for a grid world.
 *
 * Tile kinds are answered by the level:
 *   level.isSolid(tx, ty)   – full blocks (walls, ground, intact crumbles)
 *   level.isOneWay(tx, ty)  – platforms you can jump up through
 */
import { TILE } from './config.js';

/**
 * Moves `body` ({x, y, w, h, vx, vy}) by its velocity and resolves collisions.
 * Returns info about what was touched this step.
 */
export function moveAndCollide(body, level, dt) {
  const result = { onGround: false, hitCeiling: false, hitWall: false, groundTiles: [] };

  // ---- X axis ----
  body.x += body.vx * dt;
  body.x = Math.max(0, Math.min(body.x, level.pxWidth - body.w));
  forEachTile(body, (tx, ty) => {
    if (!level.isSolid(tx, ty)) return;
    if (body.vx > 0) body.x = tx * TILE - body.w;
    else if (body.vx < 0) body.x = (tx + 1) * TILE;
    body.vx = 0;
    result.hitWall = true;
  });

  // ---- Y axis ----
  const prevBottom = body.y + body.h;
  body.y += body.vy * dt;
  forEachTile(body, (tx, ty) => {
    const top = ty * TILE;
    const solid = level.isSolid(tx, ty);
    // One-way platforms only stop you when falling onto them from above.
    const oneWay = !solid && level.isOneWay(tx, ty) && body.vy >= 0 && prevBottom <= top + 0.5;
    if (!solid && !oneWay) return;

    if (body.vy >= 0) {
      body.y = top - body.h;
      body.vy = 0;
      result.onGround = true;
      result.groundTiles.push([tx, ty]);
    } else if (solid) {
      body.y = (ty + 1) * TILE;
      body.vy = 0;
      result.hitCeiling = true;
    }
  });

  return result;
}

/** Calls fn(tx, ty) for every tile the body currently overlaps. */
function forEachTile(body, fn) {
  const x0 = Math.floor(body.x / TILE);
  const x1 = Math.floor((body.x + body.w - 0.001) / TILE);
  const y0 = Math.floor(body.y / TILE);
  const y1 = Math.floor((body.y + body.h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) fn(tx, ty);
}
