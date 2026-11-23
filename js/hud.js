import { drawSprite } from './sprites.js';
import { ITEMS, KMH } from './data.js';

const $ = (id) => document.getElementById(id);
const ITEM_IDS = Object.keys(ITEMS);
const POS_COLORS = ['#ffd700', '#e0e0e0', '#ff9c3a', '#7fd4ff', '#c5e1a5', '#c5e1a5', '#c5e1a5', '#c5e1a5'];

// tempo no formato do MK64: 0'00"00
export function fmtTime(t) {
  if (!isFinite(t) || t < 0) return `-'--"--`;
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}'${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), lap: $('hud-lap'), time: $('hud-time'), laps: $('hud-laps'),
      itemCanvas: $('item-canvas'), itemCount: $('item-count'), pos: $('hud-pos'),
      rank: $('hud-rank'), speed: $('hud-speed'), banner: $('banner'),
      owl: $('owl'), lights: [...document.querySelectorAll('#lights .lamp')], owlSign: $('owl-sign'),
    };
    this.ictx = this.el.itemCanvas.getContext('2d');
    this.ictx.imageSmoothingEnabled = false;
    this.icons = {};
    for (const id of ITEM_IDS) this.icons[id] = drawSprite(id, 32);
    $('owl-img').src = drawSprite('coruja', 64).toDataURL();
    this.bannerT = 0;
    this.owlT = 0;
    this.mm = $('minimap');
    this.mctx = this.mm.getContext('2d');
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  setup(track, karts, portraits) {
    // ranking lateral com retratos
    this.el.rank.innerHTML = '';
    this.rankImgs = new Map();
    for (const k of karts) {
      const img = document.createElement('img');
      img.src = portraits[k.driver.id];
      img.className = k.isPlayer ? 'me' : '';
      this.el.rank.appendChild(img);
      this.rankImgs.set(k, img);
    }
    this.lastOrder = '';
    this.el.laps.innerHTML = '';
    this.shownLaps = 0;
    this.buildMinimap(track);
  }

  buildMinimap(tr) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < tr.N; i++) {
      minX = Math.min(minX, tr.px[i]); maxX = Math.max(maxX, tr.px[i]);
      minZ = Math.min(minZ, tr.pz[i]); maxZ = Math.max(maxZ, tr.pz[i]);
    }
    const W = this.mm.width, H = this.mm.height, pad = 10;
    const sc = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = (W - (maxX - minX) * sc) / 2, oz = (H - (maxZ - minZ) * sc) / 2;
    this.toMap = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    g.lineJoin = g.lineCap = 'round';
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= tr.N; i += 2) {
        const [x, y] = this.toMap(tr.px[i % tr.N], tr.pz[i % tr.N]);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    };
    g.strokeStyle = '#000'; g.lineWidth = 7; path(); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 4; path(); g.stroke();
    const [sx, sy] = this.toMap(tr.px[0], tr.pz[0]);
    g.fillStyle = '#e53935'; g.fillRect(sx - 3, sy - 3, 6, 6);
    this.mmBg = bg;
  }

  banner(text, dur = 1.5, cls = '') {
    const b = this.el.banner;
    b.textContent = text;
    b.className = 'show ' + cls;
    this.bannerT = dur;
  }

  // coruja: semáforo da largada e placas
  owlLights(n, show = true) {
    this.el.owl.classList.toggle('hidden', !show);
    this.el.owl.classList.add('lights');
    this.el.lights.forEach((l, i) => {
      l.className = 'lamp' + (n === 4 ? ' blue' : i < n ? ' red' : '');
    });
    this.el.owlSign.textContent = '';
  }

  owlSign(text, dur = 2) {
    this.el.owl.classList.remove('hidden', 'lights');
    this.el.owlSign.textContent = text;
    this.owlT = dur;
  }

  hideOwl() { this.el.owl.classList.add('hidden'); this.owlT = 0; }

  update(dt, player, ranking, raceTime, laps) {
    const e = this.el;
    const lap = Math.min(laps, player.lapsDone + 1);
    e.lap.innerHTML = `<small>VOLTA</small> ${Math.max(1, lap)}/${laps}`;
    e.time.textContent = fmtTime(player.finished ? player.finishTime : raceTime);
    if (player.lapTimes.length !== this.shownLaps) {
      this.shownLaps = player.lapTimes.length;
      e.laps.innerHTML = player.lapTimes.map((t, i) => `<div>${i + 1}ª ${fmtTime(t)}</div>`).join('');
    }

    const place = ranking.indexOf(player) + 1;
    e.pos.innerHTML = `${place}<small>º</small>`;
    e.pos.style.color = POS_COLORS[place - 1];
    e.speed.innerHTML = `${Math.round(Math.abs(player.speed) * KMH)}<small>km/h</small>`;

    // ranking com retratos
    const order = ranking.map((k) => k.driver.id).join();
    if (order !== this.lastOrder) {
      this.lastOrder = order;
      ranking.forEach((k) => e.rank.appendChild(this.rankImgs.get(k)));
    }

    // janela do item
    const g = this.ictx;
    g.clearRect(0, 0, 32, 32);
    let icon = null;
    if (player.rouletteT > 0) icon = this.icons[ITEM_IDS[Math.floor(player.rouletteT * 18) % ITEM_IDS.length]];
    else if (player.item) icon = this.icons[player.item];
    if (icon) g.drawImage(icon, 0, 0);
    const n = player.item && player.itemCount > 1 ? '×' + player.itemCount : '';
    e.itemCount.textContent = n;

    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) e.banner.className = ''; }
    if (this.owlT > 0) { this.owlT -= dt; if (this.owlT <= 0) this.hideOwl(); }

    // minimapa
    const m = this.mctx;
    m.clearRect(0, 0, this.mm.width, this.mm.height);
    m.drawImage(this.mmBg, 0, 0);
    for (let i = ranking.length - 1; i >= 0; i--) {
      const k = ranking[i];
      const [x, y] = this.toMap(k.pos.x, k.pos.z);
      m.fillStyle = '#000';
      m.fillRect(x - 3, y - 3, 6, 6);
      m.fillStyle = '#' + k.driver.kart.toString(16).padStart(6, '0');
      m.fillRect(x - 2, y - 2, 4, 4);
    }
    const [px, py] = this.toMap(player.pos.x, player.pos.z);
    m.strokeStyle = '#fff'; m.lineWidth = 2; m.strokeRect(px - 4, py - 4, 8, 8);
  }
}
