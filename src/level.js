/**
 * Level: parses an ASCII map into terrain + entities and draws the terrain.
 *
 * Map legend (one character per 32px tile):
 *   #  stone ground / wall           -  wooden one-way platform
 *   ^  spikes (hazard)               ~  crumbling stone (falls when stood on)
 *   P  player start                  S  safe point (lamp: refills + checkpoint)
 *   o  light orb (small recharge)    E  exit to the next level
 *   C  another child (ending scene)
 *   Decorations (no collision): t teddy bear, b ball, c toy wagon,
 *                               h rocking horse, F fountain
 */
import { TILE, COLORS } from './config.js';
import { rectsOverlap } from './utils.js';

const TERRAIN = new Set(['#', '-', '^', '~']);
const PROPS = new Set(['t', 'b', 'c', 'h', 'F']);

const CRUMBLE_SHAKE = 0.45; // seconds between first touch and collapse
const CRUMBLE_RESPAWN = 3.5;

export class Level {
  /** @param {object} def a level definition from src/levels/ */
  constructor(def) {
    this.def = def;
    this.rows = def.map.length;
    this.cols = Math.max(...def.map.map((r) => r.length));
    this.pxWidth = this.cols * TILE;
    this.pxHeight = this.rows * TILE;

    this.grid = [];
    this.orbs = [];
    this.safePoints = [];
    this.children = [];
    this.props = [];
    this.crumbles = new Map(); // "x,y" -> { state, t }
    this.exit = null;
    this.spawn = { x: TILE * 2, y: TILE * 10 };

    this.parse(def.map);
  }

  parse(map) {
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        const ch = map[y][x] ?? ' ';
        const cx = x * TILE + TILE / 2; // tile centre
        const bottom = (y + 1) * TILE; // floor line entities stand on
        row.push(TERRAIN.has(ch) ? ch : ' ');

        if (ch === '~') this.crumbles.set(`${x},${y}`, { state: 'idle', t: 0 });
        else if (ch === 'P') this.spawn = { x: cx, y: bottom };
        else if (ch === 'S') this.safePoints.push({ x: cx, y: bottom, lit: false, glow: 0 });
        else if (ch === 'o')
          this.orbs.push({ x: cx, y: y * TILE + TILE / 2, active: true, phase: x * 0.7, pending: false });
        else if (ch === 'E') this.exit = { x: cx - 18, y: bottom - 64, w: 36, h: 64 };
        else if (ch === 'C') this.children.push({ x: cx, y: bottom });
        else if (PROPS.has(ch)) this.props.push({ type: ch, x: cx, y: bottom, seed: x * 13 + y });
      }
      this.grid.push(row);
    }
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return ' ';
    return this.grid[ty][tx];
  }

  isSolid(tx, ty) {
    const t = this.tileAt(tx, ty);
    if (t === '#') return true;
    if (t === '~') return this.crumbles.get(`${tx},${ty}`).state !== 'fallen';
    return false;
  }

  isOneWay(tx, ty) {
    return this.tileAt(tx, ty) === '-';
  }

  /** Spikes have a smaller hitbox than their tile to feel fair. */
  touchesHazard(rect) {
    const x0 = Math.floor(rect.x / TILE), x1 = Math.floor((rect.x + rect.w) / TILE);
    const y0 = Math.floor(rect.y / TILE), y1 = Math.floor((rect.y + rect.h) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) !== '^') continue;
        const hit = { x: tx * TILE + 5, y: ty * TILE + 16, w: TILE - 10, h: TILE - 16 };
        if (rectsOverlap(rect, hit)) return true;
      }
    return false;
  }

  /** Player stood on these tiles this step: start crumbling any fragile ones. */
  notifyStanding(tiles) {
    for (const [tx, ty] of tiles) {
      const c = this.crumbles.get(`${tx},${ty}`);
      if (c && c.state === 'idle') {
        c.state = 'shaking';
        c.t = 0;
      }
    }
  }

  update(dt, playerRect) {
    for (const [key, c] of this.crumbles) {
      c.t += dt;
      if (c.state === 'shaking' && c.t >= CRUMBLE_SHAKE) {
        c.state = 'fallen';
        c.t = 0;
      } else if (c.state === 'fallen' && c.t >= CRUMBLE_RESPAWN) {
        // Don't respawn inside the player.
        const [tx, ty] = key.split(',').map(Number);
        if (!rectsOverlap(playerRect, { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })) {
          c.state = 'idle';
          c.t = 0;
        }
      }
    }
  }

  /** Restores state that should reset on death (crumbles, orbs taken since the checkpoint). */
  resetAfterDeath() {
    for (const c of this.crumbles.values()) {
      c.state = 'idle';
      c.t = 0;
    }
    for (const o of this.orbs) {
      if (o.pending) {
        o.active = true;
        o.pending = false;
      }
    }
  }

  /** Called at a checkpoint: orbs taken so far are now permanently collected. */
  commitOrbs() {
    for (const o of this.orbs) o.pending = false;
  }

  // ------------------------------------------------------------------ drawing

  drawTerrain(ctx, cam, time) {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const x1 = Math.min(this.cols - 1, Math.ceil((cam.x + cam.w) / TILE) + 1);
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.grid[ty][tx];
        if (t === ' ') continue;
        const px = tx * TILE - cam.x;
        const py = ty * TILE - cam.y;
        if (t === '#') this.drawStone(ctx, tx, ty, px, py);
        else if (t === '-') this.drawPlank(ctx, tx, ty, px, py);
        else if (t === '^') this.drawSpikes(ctx, px, py);
        else if (t === '~') this.drawCrumble(ctx, tx, ty, px, py, time);
      }
    }
  }

  drawStone(ctx, tx, ty, px, py) {
    const hash = (tx * 73856093) ^ (ty * 19349663);
    const exposedTop = this.tileAt(tx, ty - 1) !== '#';
    const depth = ty - this.surfaceRow(tx, ty);
    ctx.fillStyle = depth > 1 ? COLORS.stoneDark : COLORS.stone;
    ctx.fillRect(px, py, TILE, TILE);

    // Brick seams: offset every other row, very low contrast.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px, py + TILE - 2, TILE, 2);
    ctx.fillRect(px + (ty % 2 ? 0 : TILE / 2), py, 2, TILE);

    if ((hash & 7) === 0) {
      // occasional crack
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 8, py + 6);
      ctx.lineTo(px + 14, py + 16);
      ctx.lineTo(px + 11, py + 26);
      ctx.stroke();
    }

    if (exposedTop) {
      ctx.fillStyle = COLORS.stoneTop;
      ctx.fillRect(px, py, TILE, 4);
      // dead grass tufts
      ctx.fillStyle = '#3a4032';
      const n = (hash >>> 3) & 3;
      for (let i = 0; i < n; i++) {
        const gx = px + (((hash >>> (i * 5)) & 31) % 28) + 2;
        ctx.fillRect(gx, py - 3, 1, 3);
        ctx.fillRect(gx + 2, py - 2, 1, 2);
      }
    }
  }

  /** How many solid tiles are above this one (for darker deep ground). */
  surfaceRow(tx, ty) {
    let y = ty;
    while (y > 0 && this.tileAt(tx, y - 1) === '#') y--;
    return y;
  }

  drawPlank(ctx, tx, ty, px, py) {
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(px, py, TILE, 9);
    ctx.fillStyle = COLORS.woodTop;
    ctx.fillRect(px, py, TILE, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + TILE - 1, py, 1, 9);
    // support posts at the ends of a plank run
    const left = this.tileAt(tx - 1, ty) !== '-';
    const right = this.tileAt(tx + 1, ty) !== '-';
    ctx.fillStyle = '#2a221c';
    if (left) ctx.fillRect(px + 3, py + 9, 3, 12);
    if (right) ctx.fillRect(px + TILE - 6, py + 9, 3, 12);
  }

  drawSpikes(ctx, px, py) {
    ctx.fillStyle = COLORS.spike;
    for (let i = 0; i < 4; i++) {
      const sx = px + i * 8;
      ctx.beginPath();
      ctx.moveTo(sx, py + TILE);
      ctx.lineTo(sx + 4, py + 14);
      ctx.lineTo(sx + 8, py + TILE);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(200,210,230,0.25)';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + i * 8 + 3, py + 16, 1, 5);
  }

  drawCrumble(ctx, tx, ty, px, py, time) {
    const c = this.crumbles.get(`${tx},${ty}`);
    if (c.state === 'fallen') {
      // a piece falling away, fading out
      if (c.t < 0.6) {
        ctx.globalAlpha = 1 - c.t / 0.6;
        ctx.fillStyle = COLORS.stone;
        ctx.fillRect(px + 4, py + c.t * c.t * 900, TILE - 8, TILE - 10);
        ctx.globalAlpha = 1;
      }
      return;
    }
    const shake = c.state === 'shaking' ? Math.sin(time * 90 + tx) * 2 : 0;
    ctx.fillStyle = '#343a45';
    ctx.fillRect(px + shake, py, TILE, TILE - 6);
    ctx.fillStyle = '#56606f';
    ctx.fillRect(px + shake, py, TILE, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + shake + 6, py + 3);
    ctx.lineTo(px + shake + 13, py + 13);
    ctx.lineTo(px + shake + 22, py + 9);
    ctx.lineTo(px + shake + 27, py + 22);
    ctx.stroke();
  }

  drawProps(ctx, cam) {
    for (const p of this.props) {
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      if (x < -80 || x > cam.w + 80) continue;
      ctx.save();
      ctx.translate(x, y);
      PROP_DRAW[p.type]?.(ctx, p.seed);
      ctx.restore();
    }
  }
}

/**
 * Abandoned toys and furniture. Drawn with the origin at the floor, centred.
 * Colours are faded on purpose: they only come alive inside the lantern light.
 */
const PROP_DRAW = {
  // teddy bear slumped on its side
  t(ctx) {
    ctx.rotate(-0.25);
    ctx.fillStyle = '#5c4636';
    ctx.beginPath();
    ctx.ellipse(0, -8, 8, 9, 0, 0, Math.PI * 2); // body
    ctx.ellipse(-2, -20, 6.5, 6, 0, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-7, -25, 2.6, 0, Math.PI * 2);
    ctx.arc(3, -25, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a6150';
    ctx.beginPath();
    ctx.ellipse(-1, -7, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16120f';
    ctx.fillRect(-5, -22, 1.6, 1.6);
    ctx.fillRect(0, -22, 1.6, 1.6);
  },
  // deflated ball
  b(ctx) {
    ctx.fillStyle = '#6b3a3a';
    ctx.beginPath();
    ctx.ellipse(0, -7, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -7);
    ctx.quadraticCurveTo(0, -3, 9, -7);
    ctx.stroke();
  },
  // toppled toy wagon
  c(ctx) {
    ctx.fillStyle = '#3f4f5c';
    ctx.fillRect(-14, -16, 24, 10);
    ctx.fillStyle = '#23292f';
    ctx.beginPath();
    ctx.arc(-9, -4, 4, 0, Math.PI * 2);
    ctx.arc(5, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d3238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, -12);
    ctx.lineTo(20, -2);
    ctx.stroke();
  },
  // rocking horse
  h(ctx) {
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -40, 40, Math.PI * 0.36, Math.PI * 0.64);
    ctx.stroke();
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-10, -22, 20, 8); // body
    ctx.fillRect(-9, -14, 3, 12); // legs
    ctx.fillRect(6, -14, 3, 12);
    ctx.fillRect(8, -30, 6, 10); // neck
    ctx.fillRect(10, -32, 9, 5); // head
    ctx.fillStyle = '#3a2d22';
    ctx.fillRect(-13, -22, 4, 3); // tail
  },
  // dry fountain in the square
  F(ctx) {
    ctx.fillStyle = '#3a414c';
    ctx.fillRect(-46, -18, 92, 18);
    ctx.fillStyle = '#4b5462';
    ctx.fillRect(-48, -20, 96, 4);
    ctx.fillStyle = '#353c46';
    ctx.fillRect(-6, -52, 12, 34);
    ctx.fillStyle = '#4b5462';
    ctx.fillRect(-20, -56, 40, 5);
    ctx.beginPath();
    ctx.arc(0, -60, 7, 0, Math.PI * 2);
    ctx.fill();
  },
};
