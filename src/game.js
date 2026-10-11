/**
 * Game: owns the loop, the state machine and the flow between levels.
 *
 * States
 *   menu    title screen (a small live scene behind the title)
 *   play    normal gameplay
 *   paused  play frozen under an overlay
 *   dying   brief fade-out before respawning at the checkpoint
 *   exiting fade-out before loading the next level
 *   end     final card after the ending scene
 */
import { VIEW_W, VIEW_H, STEP, LANTERN, TILE } from './config.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { Lantern } from './lantern.js';
import { Lighting } from './lighting.js';
import { Camera } from './camera.js';
import { Background } from './background.js';
import { Particles } from './particles.js';
import { Sound } from './audio.js';
import { Ending } from './ending.js';
import { drawHud } from './hud.js';
import { drawSafePoint, drawOrb, drawExit } from './entities.js';
import { drawMenu, drawPause, drawEnd } from './screens.js';
import { LEVELS } from './levels/index.js';
import { approach, dist, rectsOverlap } from './utils.js';

const SAVE_KEY = 'lastLantern.level';
const SAFE_REACH = 30; // px from the lamp pole that counts as "at the safe point"

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.lighting = new Lighting();
    this.sound = new Sound();
    this.camera = new Camera();
    this.particles = new Particles();
    this.player = new Player();
    this.lantern = new Lantern();

    this.state = 'menu';
    this.time = 0;
    this.fade = { value: 1, target: 0, speed: 1, then: null, color: '5,7,14' };
    this.menuIndex = 0;
    this.endTime = 0;

    this.input.onAnyKey(() => this.sound.init());
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.setupMenuScene();
  }

  // ------------------------------------------------------------------ setup

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    this.canvas.style.width = `${Math.floor(VIEW_W * fit)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * fit)}px`;
    this.scale = fit * dpr;
    this.canvas.width = Math.round(VIEW_W * this.scale);
    this.canvas.height = Math.round(VIEW_H * this.scale);
    this.lighting.resize(this.canvas.width, this.canvas.height, this.scale);
  }

  get savedLevel() {
    try {
      const n = parseInt(localStorage.getItem(SAVE_KEY), 10);
      return Number.isFinite(n) && n > 0 && n < LEVELS.length ? n : 0;
    } catch { return 0; }
  }

  set savedLevel(n) {
    try { localStorage.setItem(SAVE_KEY, String(n)); } catch { /* storage unavailable */ }
  }

  get menuOptions() {
    const opts = [];
    if (this.savedLevel > 0) opts.push({ label: 'ادامه', action: () => this.startLevel(this.savedLevel) });
    opts.push({ label: 'شروع تازه', action: () => this.startLevel(0) });
    return opts;
  }

  setupMenuScene() {
    this.menuBg = new Background({ seed: 7, skyTop: '#161c28', skyBottom: '#2a3242', fog: '120,135,160', moon: true }, 6000);
    this.player.reset(VIEW_W / 2, 448);
    this.player.onGround = true;
    this.lantern.reset();
    this.lantern.charge = 70;
  }

  // ----------------------------------------------------------- level flow

  startLevel(index) {
    this.levelIndex = index;
    this.levelDef = LEVELS[index];
    this.level = new Level(this.levelDef);
    this.background = new Background(this.levelDef.theme, this.level.pxWidth);
    this.lantern.reset();
    this.lantern.drainRate = this.levelDef.drain;
    this.checkpoint = { ...this.level.spawn };
    this.ending = this.levelDef.ending ? new Ending(this.level) : null;
    this.particles.clear();
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.camera.snap(this.player, this.level);
    this.heartbeatTimer = 0;
    this.savedLevel = index;
    this.sound.resetMood();
    this.state = 'play';
    this.fadeTo(0, 1.4);
  }

  respawn() {
    this.level.resetAfterDeath();
    this.lantern.reset();
    this.particles.clear();
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.camera.snap(this.player, this.level);
    this.state = 'play';
    this.fadeTo(0, 0.8);
  }

  die() {
    if (this.state !== 'play') return;
    this.state = 'dying';
    this.player.frozen = true;
    this.camera.shake = 0.6;
    this.sound.death();
    this.fadeTo(1, 0.9, () => this.respawn());
  }

  exitLevel() {
    this.state = 'exiting';
    this.player.frozen = true;
    this.sound.exit();
    const next = this.levelIndex + 1;
    this.fadeTo(1, 1.4, () => (next < LEVELS.length ? this.startLevel(next) : this.showEnd()));
  }

  showEnd() {
    this.state = 'end';
    this.endTime = 0;
    this.savedLevel = 0;
    this.fade.color = '255,245,225';
    this.fadeTo(0, 2.5, () => (this.fade.color = '5,7,14'));
  }

  toMenu() {
    this.fadeTo(1, 0.6, () => {
      this.state = 'menu';
      this.menuIndex = 0;
      this.sound.resetMood();
      this.fade.color = '5,7,14';
      this.setupMenuScene();
      this.fadeTo(0, 1);
    });
  }

  /** Fade the screen overlay to `target` over `seconds`, then call `then`. */
  fadeTo(target, seconds, then = null) {
    this.fade.target = target;
    this.fade.speed = 1 / Math.max(0.01, seconds);
    this.fade.then = then;
  }

  // ------------------------------------------------------------------- loop

  run() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      let stepped = false;
      while (acc >= STEP) {
        this.update(STEP);
        acc -= STEP;
        stepped = true;
      }
      if (stepped) this.input.endFrame();
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    this.time += dt;
    this.updateFade(dt);
    const input = this.input;

    if (input.wasPressed('fullscreen')) this.toggleFullscreen();
    if (input.wasPressed('mute')) this.sound.muted = !this.sound.muted;

    switch (this.state) {
      case 'menu': return this.updateMenu(dt);
      case 'paused':
        if (input.wasPressed('pause')) this.state = 'play';
        else if (input.wasPressed('quit')) this.toMenu();
        return;
      case 'end':
        this.endTime += dt;
        this.particles.update(dt);
        if (this.endTime > 3 && input.wasPressed('confirm')) this.toMenu();
        return;
      default:
        if (this.state === 'play' && input.wasPressed('pause')) {
          this.state = 'paused';
          return;
        }
        return this.updatePlay(dt);
    }
  }

  updateFade(dt) {
    const f = this.fade;
    if (f.value === f.target) return;
    f.value = approach(f.value, f.target, f.speed * dt);
    if (f.value === f.target && f.then) {
      const cb = f.then;
      f.then = null;
      cb();
    }
  }

  updateMenu(dt) {
    const opts = this.menuOptions;
    if (this.input.wasPressed('up')) this.menuIndex = (this.menuIndex + opts.length - 1) % opts.length;
    if (this.input.wasPressed('down')) this.menuIndex = (this.menuIndex + 1) % opts.length;
    this.menuIndex = Math.min(this.menuIndex, opts.length - 1);
    this.lantern.update(dt, true);
    if (this.input.wasPressed('confirm') && this.fade.target === 0) {
      const chosen = opts[this.menuIndex];
      this.fadeTo(1, 0.8, () => chosen.action());
      this.fade.target = 1;
    }
  }

  updatePlay(dt) {
    const { player, lantern, level, particles, sound } = this;

    // --- player
    const events = player.update(dt, this.input, level);
    for (const e of events) {
      if (e === 'jump') {
        sound.jump();
        lantern.spend(LANTERN.jumpCost * (level.def.drain > 0 ? 1 : 0));
      } else if (e === 'land') {
        sound.land();
        particles.burst(player.centerX, player.feetY, 6, {
          speed: 50, lift: 10, life: 0.5, color: '120,125,135', additive: false, gravity: 200,
        });
      }
    }
    level.update(dt, player.rect);

    // Lantern embers drift off while moving.
    if (!lantern.isOut && Math.abs(player.vx) > 40 && Math.random() < dt * 14) {
      const lp = player.lanternPos;
      particles.spawn({
        x: lp.x, y: lp.y, vx: -player.vx * 0.1 + (Math.random() - 0.5) * 20, vy: -25 - Math.random() * 25,
        life: 0.9, size: 1.5, color: '255,180,90', drag: 1,
      });
    }

    // --- hazards
    if (this.state === 'play') {
      if (player.y > level.pxHeight + 40 || level.touchesHazard(player.rect)) this.die();
    }

    // --- orbs
    for (const o of level.orbs) {
      if (o.active && dist(o.x, o.y, player.centerX, player.centerY) < 24) {
        o.active = false;
        o.pending = true;
        lantern.add(LANTERN.orbCharge);
        sound.orb();
        particles.burst(o.x, o.y, 18, { speed: 90, life: 0.9 });
      }
    }

    // --- safe points: light them up, set checkpoint, refill
    let atSafePoint = false;
    for (const sp of level.safePoints) {
      const near = Math.abs(sp.x - player.centerX) < SAFE_REACH && Math.abs(sp.y - player.feetY) < TILE;
      if (near) {
        atSafePoint = true;
        if (!sp.lit) {
          sp.lit = true;
          sound.checkpoint();
          particles.burst(sp.x, sp.y - 60, 26, { speed: 110, life: 1.1 });
        }
        this.checkpoint = { x: sp.x, y: sp.y };
        level.commitOrbs();
        lantern.add(LANTERN.refillRate * dt);
      }
      sp.glow = approach(sp.glow, sp.lit ? 1 : 0, dt * 1.5);
    }

    // --- lantern drain / darkness timer
    if (this.state === 'play') {
      const ev = lantern.update(dt, atSafePoint || level.def.drain === 0);
      if (ev === 'out') sound.lanternOut();
      if (ev === 'expired') this.die();
      this.updateHeartbeat(dt);
    } else {
      lantern.update(dt, true);
    }

    // --- exit
    if (this.state === 'play' && level.exit && rectsOverlap(player.rect, level.exit)) this.exitLevel();

    // --- ending scene
    if (this.ending) {
      this.ending.update(dt, player, sound, particles);
      if (this.ending.done && this.state === 'play') {
        this.state = 'exiting';
        this.fade.color = '255,245,225';
        this.fadeTo(1, 0.01, () => this.showEnd());
      }
    }

    particles.update(dt);
    this.camera.update(dt, player, level);
  }

  /** Heartbeat speeds up as the light runs out. */
  updateHeartbeat(dt) {
    const l = this.lantern;
    if (!l.isOut && !l.isLow) {
      this.heartbeatTimer = 0;
      return;
    }
    this.heartbeatTimer -= dt;
    if (this.heartbeatTimer <= 0) {
      this.sound.heartbeat();
      this.heartbeatTimer = l.isOut ? 0.45 + 0.5 * l.darkFraction : 1.2;
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  // ----------------------------------------------------------------- render

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = true;

    if (this.state === 'menu') this.renderMenu(ctx);
    else if (this.state === 'end') {
      drawEnd(ctx, this.time, this.endTime);
      this.particles.draw(ctx, { x: 0, y: 0, w: VIEW_W, h: VIEW_H });
    } else this.renderWorld(ctx);

    if (this.fade.value > 0) {
      ctx.fillStyle = `rgba(${this.fade.color},${this.fade.value})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  renderWorld(ctx) {
    const cam = (this.view = this.camera.view);
    const { level, player, lantern, ending, time } = this;
    const warmth = ending ? ending.warmth : 0;

    this.background.draw(ctx, cam, time, warmth);
    level.drawProps(ctx, cam);
    for (const sp of level.safePoints) drawSafePoint(ctx, sp, cam, time);
    if (level.exit) drawExit(ctx, level.exit, cam, time);
    level.drawTerrain(ctx, cam, time);
    if (ending) ending.draw(ctx, cam);
    player.draw(ctx, cam, lantern.glow);
    for (const o of level.orbs) if (o.active) drawOrb(ctx, o, cam, time);
    this.background.drawForegroundFog(ctx, time);

    // ---- lighting
    const lp = player.lanternPos;
    const lights = [{
      x: lp.x - cam.x, y: lp.y - cam.y, r: lantern.radius, strength: 1, glow: lantern.glow,
    }];
    for (const sp of level.safePoints) {
      lights.push({
        x: sp.x - cam.x, y: sp.y - 60 - cam.y,
        r: 45 + sp.glow * 150, strength: 0.55 + sp.glow * 0.4, glow: 0.2 + sp.glow * 0.7,
      });
    }
    for (const o of level.orbs) {
      if (o.active) lights.push({ x: o.x - cam.x, y: o.y - cam.y, r: 50, strength: 0.7, glow: 0.5, color: '255,220,150' });
    }
    if (level.exit) {
      const e = level.exit;
      lights.push({ x: e.x + e.w / 2 - cam.x, y: e.y + e.h / 2 - cam.y, r: 140, strength: 0.85, glow: 0.5, color: '170,190,235' });
    }
    if (ending) lights.push(...ending.lights(cam));

    const darkness = level.def.darkness * (ending ? ending.darknessFactor : 1);
    this.lighting.render(ctx, lights, darkness);

    // Particles and light threads are drawn above the darkness: they are light.
    this.particles.draw(ctx, cam);
    if (ending) {
      ending.drawThreads(ctx, cam, player);
      if (ending.whiteout > 0) {
        ctx.fillStyle = `rgba(255,245,225,${ending.whiteout})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    } else {
      drawHud(ctx, this, time);
    }

    if (this.state === 'paused') drawPause(ctx, time);
  }

  renderMenu(ctx) {
    // A slow pan across the empty street with the child standing still.
    const cam = { x: this.time * 12, y: 0, w: VIEW_W, h: VIEW_H };
    this.menuBg.draw(ctx, cam, this.time);
    ctx.fillStyle = '#1d222b';
    ctx.fillRect(0, 448, VIEW_W, VIEW_H - 448);
    ctx.fillStyle = '#3a4250';
    ctx.fillRect(0, 448, VIEW_W, 3);
    const still = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
    this.player.draw(ctx, still, this.lantern.glow);
    this.menuBg.drawForegroundFog(ctx, this.time);

    const lp = this.player.lanternPos;
    this.lighting.render(ctx, [{ x: lp.x, y: lp.y, r: this.lantern.radius * 1.2, strength: 1, glow: 0.9 }], 0.88);
    drawMenu(ctx, this.menuOptions, this.menuIndex, this.time);
  }
}
