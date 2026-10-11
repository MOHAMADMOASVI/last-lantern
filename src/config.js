/**
 * Global tuning values. Everything a designer might want to tweak lives here,
 * so gameplay feel can be adjusted without touching the logic modules.
 */

// Logical resolution. The canvas is scaled to fit the window, but all game
// code works in these units.
export const VIEW_W = 960;
export const VIEW_H = 540;
export const TILE = 32;

// Fixed simulation step (seconds). Rendering runs at display rate.
export const STEP = 1 / 120;

export const PHYS = {
  gravity: 2200,
  moveSpeed: 220,
  groundAccel: 2200,
  airAccel: 1500,
  groundFriction: 2600,
  airFriction: 600,
  jumpVelocity: 680,
  jumpCutGravity: 1.8, // extra gravity multiplier while rising with jump released
  maxFall: 900,
  coyoteTime: 0.1, // grace period to jump after walking off a ledge
  jumpBuffer: 0.12, // pressing jump slightly before landing still counts
};

export const PLAYER = {
  width: 16,
  height: 28,
};

export const LANTERN = {
  max: 100,
  jumpCost: 1.2, // extra drain per jump: moving is not free
  orbCharge: 18,
  refillRate: 90, // per second while standing at a safe point
  minRadius: 70, // radius when the lantern is almost empty
  maxRadius: 250,
  emberRadius: 34, // radius once the lantern is fully out
  darkGrace: 6, // seconds to reach a safe point after the light dies
  lowThreshold: 0.25, // fraction of charge where flicker + heartbeat start
};

export const COLORS = {
  voidDark: '#05070e',
  lanternCore: '#ffe3a1',
  lanternWarm: '#ffb347',
  lanternDeep: '#e2702a',
  stoneTop: '#46505f',
  stone: '#262c37',
  stoneDark: '#191d25',
  wood: '#3d3128',
  woodTop: '#5a4736',
  spike: '#5b6371',
};
