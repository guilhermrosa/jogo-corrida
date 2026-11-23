// Sons sintetizados com Web Audio (sem arquivos externos)
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastBump = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(c.destination);

    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.osc1 = c.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = c.createOscillator();
    this.osc2.type = 'square';
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.osc1.start();
    this.osc2.start();
  }

  engine(ratio, throttle, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + ratio * 125;
    this.osc1.frequency.setTargetAtTime(f, t, 0.06);
    this.osc2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.06);
    this.filter.frequency.setTargetAtTime(350 + ratio * 1400 + (throttle ? 400 : 0), t, 0.08);
    this.engGain.gain.setTargetAtTime(on ? 0.07 + (throttle ? 0.06 : 0) : 0, t, 0.12);
  }

  tone(freq, dur, type = 'square', vol = 0.25, endFreq = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  beep(high = false) { this.tone(high ? 880 : 440, high ? 0.6 : 0.25, 'square', 0.2); }
  boost() { this.tone(180, 0.45, 'sawtooth', 0.18, 900); }
  lap() { this.tone(660, 0.12, 'triangle', 0.25); setTimeout(() => this.tone(990, 0.25, 'triangle', 0.25), 120); }
  bump() {
    if (!this.ctx || this.ctx.currentTime - this.lastBump < 0.35) return;
    this.lastBump = this.ctx.currentTime;
    this.tone(110, 0.18, 'triangle', 0.35, 50);
  }
  finish() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.25), i * 140)); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }
}
