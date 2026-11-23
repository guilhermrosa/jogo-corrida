export function formatTime(t) {
  if (!isFinite(t)) return '--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(track) {
    this.track = track;
    this.el = {
      hud: $('hud'), lap: $('hud-lap'), time: $('hud-time'), best: $('hud-best'),
      pos: $('hud-pos'), posTotal: $('hud-pos-total'), speed: $('hud-speed'),
      driftFill: $('drift-fill'), banner: $('banner'), countdown: $('countdown'),
    };
    this.bannerTimer = 0;
    this.setupMinimap();
  }

  setupMinimap() {
    const tr = this.track;
    this.mm = $('minimap');
    this.mctx = this.mm.getContext('2d');
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < tr.N; i++) {
      minX = Math.min(minX, tr.px[i]); maxX = Math.max(maxX, tr.px[i]);
      minZ = Math.min(minZ, tr.pz[i]); maxZ = Math.max(maxZ, tr.pz[i]);
    }
    const size = this.mm.width, pad = 26;
    const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const ox = (size - (maxX - minX) * scale) / 2, oz = (size - (maxZ - minZ) * scale) / 2;
    this.toMap = (x, z) => [ox + (x - minX) * scale, oz + (z - minZ) * scale];

    // Desenha a pista uma vez num canvas separado
    const bg = document.createElement('canvas');
    bg.width = bg.height = size;
    const g = bg.getContext('2d');
    g.lineJoin = g.lineCap = 'round';
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= tr.N; i += 2) {
        const [x, y] = this.toMap(tr.px[i % tr.N], tr.pz[i % tr.N]);
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath();
    };
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 11; path(); g.stroke();
    g.strokeStyle = '#455a64'; g.lineWidth = 7; path(); g.stroke();
    const [sx, sy] = this.toMap(tr.px[0], tr.pz[0]);
    g.fillStyle = '#fff'; g.fillRect(sx - 2, sy - 7, 4, 14);
    this.mmBg = bg;
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  banner(text, dur = 1.6, warn = false) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.add('show');
    b.classList.toggle('warn', warn);
    this.bannerTimer = dur;
  }

  countdown(text, go = false) {
    const c = this.el.countdown;
    c.textContent = text;
    c.classList.toggle('go', go);
  }

  update(dt, player, karts, ranking, raceTime, laps) {
    const e = this.el;
    const lap = Math.min(laps, player.lapsDone + 1);
    e.lap.textContent = `${lap}/${laps}`;
    e.time.textContent = formatTime(player.finished ? player.finishTime : raceTime);
    e.best.textContent = player.lapTimes.length ? formatTime(Math.min(...player.lapTimes)) : '--';
    e.pos.textContent = ranking.indexOf(player) + 1;
    e.posTotal.textContent = '/' + karts.length;
    e.speed.textContent = Math.round(Math.abs(player.speed) * 3.6);

    const fill = player.drift ? Math.min(1, player.driftTime / 2.1) : 0;
    e.driftFill.style.width = `${fill * 100}%`;
    e.driftFill.style.background = player.driftLevel === 2 ? '#ff9100' : player.driftLevel === 1 ? '#40c4ff' : '#bdbdbd';

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) e.banner.classList.remove('show');
    }

    // Minimapa
    const g = this.mctx, s = this.mm.width;
    g.clearRect(0, 0, s, s);
    g.drawImage(this.mmBg, 0, 0);
    for (const k of karts) {
      if (k === player) continue;
      const [x, y] = this.toMap(k.pos.x, k.pos.z);
      g.fillStyle = '#' + k.color.toString(16).padStart(6, '0');
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    }
    const [px, py] = this.toMap(player.pos.x, player.pos.z);
    g.fillStyle = '#' + player.color.toString(16).padStart(6, '0');
    g.strokeStyle = '#fff'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }
}
