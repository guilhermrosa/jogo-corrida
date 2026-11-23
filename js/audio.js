// Áudio sintetizado (chiptune). As músicas são composições originais simples.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Cada música: [melodia, baixo] em semicolcheias; números = notas MIDI, 0 = pausa
const SONGS = [
  { // Campos: alegre, Dó maior
    bpm: 150,
    mel: [72, 0, 76, 79, 0, 76, 74, 72, 74, 0, 76, 74, 72, 0, 67, 0, 69, 0, 72, 76, 0, 74, 72, 69, 71, 0, 72, 74, 0, 0, 79, 0,
      81, 0, 79, 76, 0, 77, 76, 74, 72, 0, 74, 76, 0, 72, 69, 0, 67, 0, 69, 72, 0, 74, 76, 77, 79, 0, 76, 0, 72, 0, 0, 0],
    bass: [48, 48, 55, 48, 45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43],
  },
  { // Praia: tranquila, Fá maior
    bpm: 132,
    mel: [77, 0, 0, 81, 0, 79, 77, 0, 74, 0, 72, 0, 74, 77, 0, 0, 79, 0, 0, 81, 0, 84, 81, 0, 79, 0, 77, 79, 0, 0, 0, 0,
      77, 0, 0, 81, 0, 79, 77, 0, 74, 0, 77, 0, 79, 81, 0, 0, 82, 0, 81, 0, 79, 0, 77, 0, 76, 0, 77, 0, 0, 0, 0, 0],
    bass: [41, 0, 48, 41, 38, 0, 45, 38, 46, 0, 53, 46, 48, 0, 55, 48],
  },
  { // Serra: aventura, Ré menor
    bpm: 144,
    mel: [74, 0, 77, 0, 81, 0, 79, 77, 76, 0, 74, 0, 72, 0, 74, 0, 77, 0, 76, 74, 73, 0, 74, 76, 77, 0, 0, 0, 74, 0, 0, 0,
      81, 0, 79, 0, 77, 0, 76, 77, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 76, 77, 76, 74, 73, 74, 0, 0, 0, 0, 0, 0, 0],
    bass: [38, 45, 38, 45, 34, 41, 34, 41, 36, 43, 36, 43, 33, 40, 33, 40],
  },
  { // Vulcão: tensa, Mi menor
    bpm: 160,
    mel: [64, 0, 64, 67, 0, 64, 71, 0, 70, 0, 67, 0, 64, 0, 62, 0, 64, 0, 64, 67, 0, 69, 70, 0, 71, 0, 74, 0, 71, 0, 0, 0,
      76, 0, 74, 71, 0, 69, 67, 0, 69, 0, 71, 0, 67, 0, 64, 0, 62, 0, 64, 67, 0, 69, 67, 64, 63, 0, 64, 0, 0, 0, 0, 0],
    bass: [40, 40, 52, 40, 40, 40, 50, 40, 36, 36, 48, 36, 38, 38, 50, 38],
  },
];

export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.musicOn = true; this.last = {}; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.32; this.master.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 900;
    this.osc1 = c.createOscillator(); this.osc1.type = 'square';
    this.osc2 = c.createOscillator(); this.osc2.type = 'sawtooth';
    this.osc1.connect(this.filter); this.osc2.connect(this.filter);
    this.filter.connect(this.engGain); this.engGain.connect(this.master);
    this.osc1.start(); this.osc2.start();
  }

  engine(ratio, throttle, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 70 + ratio * 150;
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.035 + (throttle ? 0.035 : 0) : 0, t, 0.08);
  }

  tone(freq, dur, type = 'square', vol = 0.2, endFreq = null, delay = 0, bus = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200) {
    if (!this.ctx) return;
    const c = this.ctx, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }

  throttleSfx(name, gap) {
    if (!this.ctx) return false;
    const t = this.ctx.currentTime;
    if (t - (this.last[name] || 0) < gap) return false;
    this.last[name] = t; return true;
  }

  sfx(name) {
    switch (name) {
      case 'countLow': this.tone(NOTE(69), 0.25, 'square', 0.18); break;
      case 'countHigh': this.tone(NOTE(81), 0.6, 'square', 0.18); break;
      case 'hop': this.tone(300, 0.08, 'square', 0.08, 500); break;
      case 'stage1': this.tone(NOTE(84), 0.08, 'square', 0.1); break;
      case 'stage2': this.tone(NOTE(88), 0.08, 'square', 0.1); this.tone(NOTE(91), 0.1, 'square', 0.1, null, 0.06); break;
      case 'mt': this.tone(200, 0.3, 'sawtooth', 0.14, 700); break;
      case 'boost': this.tone(160, 0.5, 'sawtooth', 0.16, 900); break;
      case 'roulette': if (this.throttleSfx('roulette', 0.07)) this.tone(NOTE(84 + ((Math.random() * 5) | 0)), 0.05, 'square', 0.06); break;
      case 'got': this.tone(NOTE(79), 0.08, 'square', 0.12); this.tone(NOTE(84), 0.15, 'square', 0.12, null, 0.08); break;
      case 'box': this.tone(NOTE(91), 0.06, 'triangle', 0.1); break;
      case 'throw': this.tone(500, 0.12, 'triangle', 0.12, 200); break;
      case 'hit': if (this.throttleSfx('hit', 0.2)) { this.noise(0.3, 0.25, 900); this.tone(220, 0.35, 'square', 0.12, 80); } break;
      case 'skid': this.noise(0.25, 0.15, 3000); break;
      case 'wall': if (this.throttleSfx('wall', 0.25)) { this.tone(120, 0.15, 'triangle', 0.25, 60); this.noise(0.1, 0.15, 600); } break;
      case 'bump': if (this.throttleSfx('bump', 0.3)) this.tone(150, 0.1, 'triangle', 0.18, 90); break;
      case 'splash': this.noise(0.6, 0.25, 2000); break;
      case 'lava': this.noise(0.6, 0.25, 500); this.tone(90, 0.5, 'sawtooth', 0.1, 40); break;
      case 'fall': this.tone(700, 0.6, 'square', 0.1, 120); break;
      case 'rescue': [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(76 + n), 0.09, 'triangle', 0.12, null, i * 0.08)); break;
      case 'lap': this.tone(NOTE(76), 0.1, 'square', 0.12); this.tone(NOTE(81), 0.2, 'square', 0.12, null, 0.12); break;
      case 'finalLap': [0, 4, 7, 12, 7, 12].forEach((n, i) => this.tone(NOTE(76 + n), 0.11, 'square', 0.12, null, i * 0.1)); break;
      case 'finish': [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.2, 'square', 0.13, null, i * 0.14)); break;
      case 'lose': [72, 69, 65, 60].forEach((n, i) => this.tone(NOTE(n), 0.3, 'triangle', 0.13, null, i * 0.22)); break;
      case 'thunder': this.noise(1.0, 0.35, 400); this.tone(60, 0.9, 'sawtooth', 0.15, 30); break;
      case 'star': [0, 2, 4, 5, 7, 9, 11, 12].forEach((n, i) => this.tone(NOTE(84 + n), 0.06, 'square', 0.07, null, i * 0.04)); break;
      case 'ghost': this.tone(NOTE(60), 0.6, 'sine', 0.15, NOTE(72)); break;
      case 'shrink': this.tone(900, 0.5, 'square', 0.1, 150); break;
      case 'grow': this.tone(150, 0.4, 'square', 0.1, 700); break;
      case 'blast': this.noise(0.9, 0.4, 700); break;
      case 'draft': this.tone(NOTE(88), 0.15, 'sine', 0.08); break;
      case 'burnout': this.noise(0.8, 0.15, 2500); break;
      case 'select': this.tone(NOTE(84), 0.06, 'square', 0.1); break;
      case 'confirm': this.tone(NOTE(79), 0.07, 'square', 0.1); this.tone(NOTE(86), 0.12, 'square', 0.1, null, 0.07); break;
    }
  }

  // ---------------------------------------------------------- música
  playMusic(i) {
    this.stopMusic();
    if (!this.ctx) return;
    this.song = SONGS[i % SONGS.length];
    this.step = 0; this.tempo = 1;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setTempo(k) { this.tempo = k; }

  stopMusic() { clearInterval(this.timer); this.timer = null; }

  schedule() {
    const c = this.ctx, s = this.song;
    if (!c || !s) return;
    const stepDur = 60 / (s.bpm * this.tempo) / 4;
    while (this.nextT < c.currentTime + 0.12) {
      const delay = this.nextT - c.currentTime;
      if (this.musicOn) {
        const m = s.mel[this.step % s.mel.length];
        if (m) this.tone(NOTE(m), stepDur * 1.6, 'square', 0.09, null, delay, this.musicBus);
        if (this.step % 4 === 0) {
          const b = s.bass[(this.step / 4) % s.bass.length];
          if (b) this.tone(NOTE(b), stepDur * 3.5, 'triangle', 0.22, null, delay, this.musicBus);
        }
        if (this.step % 8 === 4) this.noiseAt(delay);
      }
      this.step++;
      this.nextT += stepDur;
    }
  }

  noiseAt(delay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * 0.05);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = 0.12;
    s.connect(g); g.connect(this.musicBus); s.start(c.currentTime + delay);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }
}
