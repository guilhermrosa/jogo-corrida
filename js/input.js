// Teclado, controle (gamepad) e toque — mapeados como o controle do N64:
// A = acelerar, B = frear, R = pulo/derrapagem, Z = item, direcional analógico = virar / mirar
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, hop: false, item: false };
    this.handlers = {};
    this.padPrev = [];
    window.addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code) && !(e.target instanceof HTMLButtonElement && (e.code === 'Space'))) e.preventDefault();
      if (!e.repeat && this.handlers[e.code]) this.handlers[e.code](e);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.setupTouch();
  }

  on(code, fn) { this.handlers[code] = fn; }

  setupTouch() {
    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) return;
    this.touchEnabled = true;
    document.querySelectorAll('#touch button').forEach((b) => {
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

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  // botões do controle que funcionam como "tecla apertada uma vez" (Start, A nos menus)
  pollPad() {
    const p = this.pad();
    if (!p) return;
    const map = { 9: 'Escape', 0: 'PadA', 1: 'PadB', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
    for (const [i, code] of Object.entries(map)) {
      const down = !!p.buttons[i]?.pressed;
      if (down && !this.padPrev[i] && this.handlers[code]) this.handlers[code]();
      this.padPrev[i] = down;
    }
  }

  get() {
    const k = this.keys, t = this.touch;
    let left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    let right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    let throttle = k.has('ArrowUp') || k.has('KeyX') || t.gas;
    let brake = k.has('ArrowDown') || k.has('KeyC') || t.brake;
    let hop = k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight') || t.hop;
    let item = k.has('KeyZ') || k.has('KeyE') || t.item;
    let aim = k.has('KeyW') ? 1 : k.has('KeyS') ? -1 : 0;
    let steer = (left ? 1 : 0) - (right ? 1 : 0);
    let analog = false;

    const p = this.pad();
    if (p) {
      const b = (i) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.abs(ax) > 0.15) { steer = -Math.sign(ax) * Math.min(1, (Math.abs(ax) - 0.15) / 0.75); analog = true; }
      if (b(14)) steer = 1;
      if (b(15)) steer = -1;
      throttle = throttle || b(0);
      brake = brake || b(1) || b(2);
      hop = hop || b(5) || b(7);
      item = item || b(4) || b(6);
      if (ay < -0.5) aim = 1; else if (ay > 0.5) aim = -1;
    }
    return { throttle, brake, steer, hop, item, aim, analog };
  }
}
