/**
 * Parallax background: sky, a distant skyline, empty houses with faded
 * shadows on their walls, bare trees, and drifting fog.
 *
 * Everything is generated from a seed so each level looks different but the
 * same level always looks the same.
 */
import { VIEW_W, VIEW_H } from './config.js';
import { seededRandom } from './utils.js';

const GROUND_Y = 470; // where background buildings stand (screen space)

export class Background {
  /**
   * @param {object} theme  { seed, skyTop, skyBottom, fog 'r,g,b', moon }
   * @param {number} levelWidth in px
   */
  constructor(theme, levelWidth) {
    this.theme = theme;
    const rand = seededRandom(theme.seed);
    this.layers = [
      { factor: 0.12, items: this.makeSkyline(rand, levelWidth, 0.12) },
      { factor: 0.35, items: this.makeHouses(rand, levelWidth, 0.35, '#161b25', 0.8) },
      { factor: 0.6, items: this.makeHouses(rand, levelWidth, 0.6, '#11151d', 1) },
      { factor: 0.8, items: this.makeNear(rand, levelWidth, 0.8) },
    ];
    this.fogBands = Array.from({ length: 6 }, (_, i) => ({
      y: 250 + i * 45 + rand() * 30,
      speed: 6 + rand() * 12,
      offset: rand() * 2000,
      alpha: 0.05 + rand() * 0.06,
      h: 60 + rand() * 60,
    }));
  }

  // ------------------------------------------------------------- generation

  span(levelWidth, factor) {
    return (levelWidth - VIEW_W) * factor + VIEW_W + 200;
  }

  makeSkyline(rand, levelWidth, factor) {
    const items = [];
    for (let x = -100; x < this.span(levelWidth, factor); x += 30 + rand() * 60) {
      items.push({ kind: 'tower', x, w: 30 + rand() * 60, h: 90 + rand() * 170, antenna: rand() < 0.2 });
    }
    return items;
  }

  makeHouses(rand, levelWidth, factor, color, scale) {
    const items = [];
    for (let x = -80 + rand() * 100; x < this.span(levelWidth, factor); x += 170 * scale + rand() * 150) {
      const w = (100 + rand() * 90) * scale;
      const h = (90 + rand() * 90) * scale;
      items.push({
        kind: 'house', x, w, h, color,
        roof: rand() < 0.75 ? 'pitched' : 'flat',
        chimney: rand() < 0.5,
        windows: Math.floor(1 + rand() * 3),
        broken: rand() < 0.4,
        shadow: rand() < 0.45 ? Math.floor(rand() * 4) : -1, // which shadow figure, if any
        seed: rand(),
      });
      if (rand() < 0.35) items.push({ kind: 'tree', x: x + w + 20 + rand() * 30, h: (110 + rand() * 80) * scale, seed: rand(), color });
    }
    return items;
  }

  makeNear(rand, levelWidth, factor) {
    const items = [];
    for (let x = rand() * 300; x < this.span(levelWidth, factor); x += 260 + rand() * 420) {
      const r = rand();
      if (r < 0.35) items.push({ kind: 'lamp', x, h: 150 + rand() * 30, bent: rand() * 0.25 });
      else if (r < 0.6) items.push({ kind: 'swing', x, broken: rand() < 0.5 });
      else items.push({ kind: 'fence', x, w: 120 + rand() * 160 });
    }
    return items;
  }

  // ---------------------------------------------------------------- drawing

  draw(ctx, cam, time, warmth = 0) {
    const t = this.theme;
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, t.skyTop);
    sky.addColorStop(1, t.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Warmth is used by the ending to turn the night sky toward dawn.
    if (warmth > 0) {
      const dawn = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      dawn.addColorStop(0, `rgba(70,80,130,${warmth * 0.6})`);
      dawn.addColorStop(0.6, `rgba(230,140,90,${warmth * 0.55})`);
      dawn.addColorStop(1, `rgba(255,200,130,${warmth * 0.7})`);
      ctx.fillStyle = dawn;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (t.moon) {
      const mx = 720 - cam.x * 0.03, my = 110;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
      g.addColorStop(0, 'rgba(190,205,230,0.22)');
      g.addColorStop(0.2, 'rgba(160,180,215,0.1)');
      g.addColorStop(1, 'rgba(160,180,215,0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - 120, my - 120, 240, 240);
      ctx.fillStyle = 'rgba(200,212,235,0.35)';
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    this.layers.forEach((layer, i) => {
      const ox = -cam.x * layer.factor;
      const oy = -cam.y * layer.factor;
      for (const it of layer.items) {
        const x = it.x + ox;
        if (x > VIEW_W + 60 || x + (it.w ?? 80) < -60) continue;
        DRAW[it.kind](ctx, x, GROUND_Y + oy + i * 12, it, time);
      }
      if (i === 0) this.drawFog(ctx, time, cam, 0.5);
    });
    this.drawFog(ctx, time, cam, 1);
  }

  drawFog(ctx, time, cam, strength) {
    const fog = this.theme.fog;
    for (const b of this.fogBands) {
      const x = -((time * b.speed + b.offset + cam.x * 0.3) % 1600);
      const g = ctx.createLinearGradient(0, b.y - b.h / 2, 0, b.y + b.h / 2);
      g.addColorStop(0, `rgba(${fog},0)`);
      g.addColorStop(0.5, `rgba(${fog},${b.alpha * strength})`);
      g.addColorStop(1, `rgba(${fog},0)`);
      ctx.fillStyle = g;
      for (let k = 0; k < 3; k++) {
        const bx = x + k * 1600;
        ctx.beginPath();
        ctx.ellipse(bx + 400, b.y, 700, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Low fog drawn in front of the terrain for depth. */
  drawForegroundFog(ctx, time) {
    const fog = this.theme.fog;
    const g = ctx.createLinearGradient(0, VIEW_H - 140, 0, VIEW_H);
    g.addColorStop(0, `rgba(${fog},0)`);
    g.addColorStop(1, `rgba(${fog},${0.14 + Math.sin(time * 0.4) * 0.03})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, VIEW_H - 140, VIEW_W, 140);
  }
}

// Shadow figures faded onto walls: echoes of the people who lived here.
const SHADOWS = [
  // child reaching up to an adult's hand
  (ctx) => {
    person(ctx, 0, 0, 1);
    person(ctx, 26, 0, 0.6);
    ctx.fillRect(10, -44, 18, 3);
  },
  // child with a ball
  (ctx) => {
    person(ctx, 0, 0, 0.62);
    ctx.beginPath();
    ctx.arc(20, -8, 7, 0, Math.PI * 2);
    ctx.fill();
  },
  // two children holding hands
  (ctx) => {
    person(ctx, 0, 0, 0.6);
    person(ctx, 22, 0, 0.55);
    ctx.fillRect(4, -26, 18, 3);
  },
  // a child holding a lantern high
  (ctx) => {
    person(ctx, 0, 0, 0.62);
    ctx.fillRect(6, -52, 3, 14);
    ctx.fillRect(3, -60, 9, 10);
  },
];

/** A very simple human silhouette, feet at (x, y), `s` = scale (1 = adult). */
function person(ctx, x, y, s) {
  const h = 90 * s;
  ctx.beginPath();
  ctx.arc(x, y - h + 9 * s, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - h + 20 * s);
  ctx.lineTo(x + 10 * s, y - h + 20 * s);
  ctx.lineTo(x + 13 * s, y - h * 0.4);
  ctx.lineTo(x + 6 * s, y);
  ctx.lineTo(x - 6 * s, y);
  ctx.lineTo(x - 13 * s, y - h * 0.4);
  ctx.closePath();
  ctx.fill();
}

const DRAW = {
  tower(ctx, x, base, it) {
    ctx.fillStyle = '#1e2533';
    ctx.fillRect(x, base - it.h, it.w, it.h + 80);
    if (it.antenna) ctx.fillRect(x + it.w / 2, base - it.h - 30, 2, 30);
  },

  house(ctx, x, base, it) {
    const { w, h } = it;
    ctx.fillStyle = it.color;
    ctx.fillRect(x, base - h, w, h + 80);
    if (it.roof === 'pitched') {
      ctx.beginPath();
      ctx.moveTo(x - 8, base - h);
      ctx.lineTo(x + w / 2, base - h - w * 0.38);
      ctx.lineTo(x + w + 8, base - h);
      ctx.fill();
    } else {
      ctx.fillRect(x - 4, base - h - 6, w + 8, 6);
    }
    if (it.chimney) ctx.fillRect(x + w * 0.7, base - h - w * 0.35, 12, w * 0.3);

    // windows: dark holes with a faint frame; broken ones have a crooked shutter
    const ww = 16, wh = 20;
    for (let i = 0; i < it.windows; i++) {
      const wx = x + ((i + 1) * w) / (it.windows + 1) - ww / 2;
      const wy = base - h + h * 0.3;
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(120,135,160,0.08)';
      ctx.fillRect(wx - 1, wy - 1, ww + 2, 1);
      ctx.fillRect(wx + ww / 2 - 0.5, wy, 1, wh);
      if (it.broken && i === 0) {
        ctx.save();
        ctx.translate(wx + ww, wy);
        ctx.rotate(0.5);
        ctx.fillStyle = it.color;
        ctx.fillRect(0, 0, 7, wh);
        ctx.restore();
      }
    }
    // door
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(x + w * 0.15, base - 34, 16, 34);

    if (it.shadow >= 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.translate(x + w * 0.62, base);
      ctx.scale(0.7, 0.7);
      SHADOWS[it.shadow](ctx);
      ctx.restore();
    }
  },

  tree(ctx, x, base, it) {
    ctx.strokeStyle = it.color;
    ctx.lineCap = 'round';
    const branch = (bx, by, len, ang, width, depth) => {
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (depth > 0) {
        const j = (it.seed * 10 + depth) % 1;
        branch(ex, ey, len * 0.7, ang - 0.45 - j * 0.2, width * 0.65, depth - 1);
        branch(ex, ey, len * 0.68, ang + 0.4 + j * 0.2, width * 0.65, depth - 1);
      }
    };
    branch(x, base + 10, it.h * 0.45, -Math.PI / 2, 7, 4);
  },

  lamp(ctx, x, base, it) {
    ctx.save();
    ctx.translate(x, base + 40);
    ctx.rotate(it.bent);
    ctx.fillStyle = '#0c0f15';
    ctx.fillRect(-3, -it.h, 6, it.h);
    ctx.fillRect(-3, -it.h, 26, 4);
    ctx.fillRect(16, -it.h + 4, 12, 10);
    ctx.restore();
  },

  swing(ctx, x, base, it) {
    ctx.strokeStyle = '#0c0f15';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, base + 40);
    ctx.lineTo(x + 30, base - 80);
    ctx.lineTo(x + 60, base + 40);
    ctx.moveTo(x + 100, base + 40);
    ctx.lineTo(x + 130, base - 80);
    ctx.lineTo(x + 160, base + 40);
    ctx.moveTo(x + 25, base - 78);
    ctx.lineTo(x + 135, base - 78);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 70, base - 78);
    ctx.lineTo(x + 70, base - 10);
    ctx.moveTo(x + 92, base - 78);
    ctx.lineTo(x + 92, it.broken ? base - 40 : base - 10);
    ctx.stroke();
    ctx.fillStyle = '#0c0f15';
    if (it.broken) {
      ctx.save();
      ctx.translate(x + 70, base - 10);
      ctx.rotate(0.9);
      ctx.fillRect(0, -2, 26, 4);
      ctx.restore();
    } else ctx.fillRect(x + 66, base - 12, 30, 4);
  },

  fence(ctx, x, base, it) {
    ctx.fillStyle = '#0c0f15';
    ctx.fillRect(x, base - 10, it.w, 4);
    ctx.fillRect(x, base + 10, it.w, 4);
    for (let px = 0; px < it.w; px += 14) {
      const lean = ((px * 7) % 5) - 2;
      ctx.beginPath();
      ctx.moveTo(x + px, base + 40);
      ctx.lineTo(x + px + lean, base - 26);
      ctx.lineTo(x + px + 4 + lean, base - 32);
      ctx.lineTo(x + px + 8, base + 40);
      ctx.fill();
    }
  },
};
