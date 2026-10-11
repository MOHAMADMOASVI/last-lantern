/**
 * Keyboard input mapped to abstract actions.
 * `isDown` is for held keys; `wasPressed` is true for the frame the key went
 * down and is cleared by `endFrame()` once at least one simulation step ran.
 */

const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  confirm: ['Enter', 'Space'],
  pause: ['Escape', 'KeyP'],
  fullscreen: ['KeyF'],
  quit: ['KeyQ'],
  mute: ['KeyM'],
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.anyKeyListeners = [];

    target.addEventListener('keydown', (e) => {
      if (Object.values(BINDINGS).some((codes) => codes.includes(e.code))) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        this.anyKeyListeners.forEach((fn) => fn(e));
      }
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    // Releasing everything on blur prevents "stuck" movement after alt-tab.
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(action) {
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  wasPressed(action) {
    return BINDINGS[action].some((c) => this.pressed.has(c));
  }

  /** Horizontal axis in [-1, 1]. */
  axisX() {
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }

  onAnyKey(fn) {
    this.anyKeyListeners.push(fn);
  }

  endFrame() {
    this.pressed.clear();
  }
}
