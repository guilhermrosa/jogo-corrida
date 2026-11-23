const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight',
]);

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false };
    this.handlers = {};

    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat && this.handlers[e.code]) this.handlers[e.code]();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this.setupTouch();
  }

  on(code, fn) { this.handlers[code] = fn; }

  setupTouch() {
    const el = document.getElementById('touch');
    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) return;
    this.touchEnabled = true;
    el.querySelectorAll('button').forEach((b) => {
      const key = b.dataset.key;
      const set = (v) => (e) => { e.preventDefault(); this.touch[key] = v; b.classList.toggle('active', v); };
      b.addEventListener('pointerdown', set(true));
      b.addEventListener('pointerup', set(false));
      b.addEventListener('pointercancel', set(false));
      b.addEventListener('pointerleave', set(false));
    });
  }

  showTouch(show) {
    if (this.touchEnabled) document.getElementById('touch').classList.toggle('hidden', !show);
  }

  get() {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    return {
      throttle: k.has('ArrowUp') || k.has('KeyW') || t.gas,
      brake: k.has('ArrowDown') || k.has('KeyS') || t.brake,
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      drift: k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight') || t.drift,
    };
  }
}
