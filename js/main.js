import * as THREE from 'three';
import { DRIVERS, CUPS, TRACKS, THEMES, LAPS, POINTS, DRIVE, CLASS_STATS } from './data.js';
import { Track } from './track.js';
import { Kart, collideKarts, wrapAngle, clamp } from './kart.js';
import { ItemSystem } from './items.js';
import { aiDrive } from './ai.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, fmtTime } from './hud.js';
import { bakeDriver, spriteTexture } from './sprites.js';
import { ART } from './scenery.js';

const params = new URLSearchParams(location.search);
const AUTO = params.has('auto');

// ------------------------------------------------------------------ salvar progresso (troféus, espelho)
const store = {
  get(k, d) { try { const v = localStorage.getItem('kart3d:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kart3d:' + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};

// ------------------------------------------------------------------ renderização em baixa resolução (240 linhas, como no N64)
const RES_H = 240;
let retro = store.get('retro', true);
const renderer = new THREE.WebGLRenderer({ antialias: false });
document.getElementById('game').appendChild(renderer.domElement);
function applyRes() {
  renderer.setPixelRatio(retro ? Math.min(1, RES_H / window.innerHeight) : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.classList.toggle('retro', retro);
}
applyRes();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.4, 2600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x707070, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(0.5, 1, 0.3);
scene.add(sun);

const input = new Input();
const audio = new GameAudio();
const hud = new Hud();

// pilotos pré-renderizados
const bakes = {}, portraits = {};
// (são 32 ângulos x 5 poses por piloto: fotografamos um piloto por vez para a página não travar)
async function bakeAll() {
  const label = document.querySelector('#loading .hint');
  for (let i = 0; i < DRIVERS.length; i++) {
    const d = DRIVERS[i];
    label.textContent = `MONTANDO PILOTOS ${i + 1}/${DRIVERS.length}`;
    await new Promise((r) => setTimeout(r, 0));
    bakes[d.id] = bakeDriver(d);
    portraits[d.id] = bakes[d.id].portrait;
  }
  ART.portraits = portraits;
  document.getElementById('loading').classList.add('hidden');
}

// owl (coruja) que resgata quem cai
const owl = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('coruja'), alphaTest: 0.5 }));
owl.scale.setScalar(2.4);
owl.visible = false;
scene.add(owl);

// ------------------------------------------------------------------ estado
const G = {
  screen: 'title', cc: 100, driverId: DRIVERS[0].id, cupIdx: 0,
  raceNo: 0, points: {}, grid: [], rivals: [],
};
let R = null;          // corrida atual
let paused = false;
let podium = null;

// ------------------------------------------------------------------ telas / menus
const screens = ['title', 'cc', 'char', 'cup', 'results', 'podium', 'pause'];
function show(name) {
  G.screen = name;
  for (const s of screens) document.getElementById('screen-' + s).classList.toggle('hidden', s !== name);
  const first = document.querySelector(`#screen-${name} button:not(:disabled)`);
  if (first) setTimeout(() => first.focus(), 0);
  if (name === 'cc') document.getElementById('btn-mirror').disabled = !store.get('mirror', false);
}

document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { audio.init(); audio.sfx('confirm'); goTo(b.dataset.go); }));
function goTo(name) {
  if (name === 'title') { endPodium(); clearRace(); hud.show(false); audio.stopMusic(); showcase(); }
  show(name);
}
document.querySelectorAll('[data-cc]').forEach((b) => (b.onclick = () => {
  audio.sfx('confirm');
  G.cc = b.dataset.cc === 'espelho' ? 'espelho' : Number(b.dataset.cc);
  show('char');
}));

// tela de pilotos
const grid = document.getElementById('char-grid');
const info = document.getElementById('char-info');
function buildCharGrid() {
for (const d of DRIVERS) {
  const b = document.createElement('button');
  b.className = 'char';
  b.innerHTML = `<img src="${portraits[d.id]}" alt=""><span>${d.name}</span><span class="cls">${CLASS_STATS[d.cls].label}</span>`;
  const describe = () => {
    audio.sfx('select');
    const tips = { leve: 'Acelera rápido e perde pouco na grama, mas é empurrado fácil.', medio: 'Equilibrado nas curvas, porém com a aceleração mais lenta.', pesado: 'Demora a embalar, mas empurra todo mundo.' };
    info.innerHTML = `${d.name} — ${d.animal.toUpperCase()}<br>${tips[d.cls]}`;
  };
  b.onmouseenter = describe; b.onfocus = describe;
  b.onclick = () => { audio.sfx('confirm'); G.driverId = d.id; buildCups(); show('cup'); };
  grid.appendChild(b);
}
}

function buildCups() {
  const list = document.getElementById('cup-list');
  list.innerHTML = '';
  const trophies = store.get('trophies', {});
  CUPS.forEach((cup, i) => {
    const b = document.createElement('button');
    b.className = 'cup';
    const t = trophies[`${G.cc}-${i}`];
    const medal = t === 1 ? ' 🥇' : t === 2 ? ' 🥈' : t === 3 ? ' 🥉' : '';
    b.innerHTML = `<div class="cup-name">${cup.name}${medal}</div>` + cup.tracks.map((id, n) => `${n + 1}. ${TRACKS[id].name}`).join('<br>');
    b.onclick = () => { audio.sfx('confirm'); G.cupIdx = i; startGP(); };
    list.appendChild(b);
  });
}

// navegação dos menus por teclado/controle
function moveFocus(dir) {
  if (G.screen === 'race' || !document.querySelector(`#screen-${G.screen}`)) return;
  const btns = [...document.querySelectorAll(`#screen-${G.screen} button:not(:disabled)`)];
  if (!btns.length) return;
  const i = btns.indexOf(document.activeElement);
  btns[(i + dir + btns.length) % btns.length].focus();
}
['ArrowRight', 'ArrowDown', 'PadRight', 'PadDown'].forEach((c) => input.on(c, () => moveFocus(1)));
['ArrowLeft', 'ArrowUp', 'PadLeft', 'PadUp'].forEach((c) => input.on(c, () => moveFocus(-1)));
input.on('PadA', () => { if (G.screen !== 'race' && document.activeElement?.tagName === 'BUTTON') document.activeElement.click(); });
input.on('Enter', (e) => {
  if (G.screen === 'title') { e?.preventDefault?.(); audio.init(); goTo('cc'); }
});
input.on('PadB', () => back());
input.on('Escape', () => { if (G.screen === 'race' || G.screen === 'pause') setPaused(!paused); else back(); });
input.on('KeyP', () => { if (G.screen === 'race' || G.screen === 'pause') setPaused(!paused); });
input.on('KeyM', () => { const m = audio.toggleMute(); if (R) hud.banner(m ? 'SOM DESLIGADO' : 'SOM LIGADO', 1); });
input.on('KeyV', () => { retro = !retro; store.set('retro', retro); applyRes(); if (R) hud.banner(retro ? 'VISUAL RETRÔ' : 'VISUAL NÍTIDO', 1); });
function back() {
  const prev = { cc: 'title', char: 'cc', cup: 'char' }[G.screen];
  if (prev) goTo(prev);
}

document.getElementById('btn-resume').onclick = () => setPaused(false);
document.getElementById('btn-retry').onclick = () => { setPaused(false); startRace(); };
document.getElementById('btn-quit').onclick = () => { setPaused(false); goTo('title'); };

function setPaused(p) {
  if (!R) return;
  paused = p;
  show(p ? 'pause' : 'race');
  document.getElementById('screen-pause').classList.toggle('hidden', !p);
  if (p) { audio.engine(0, false, false); audio.stopMusic(); }
  else if (R.phase !== 'intro' && R.phase !== 'count') audio.playMusic(THEMES[R.track.def.theme].music);
}

// ------------------------------------------------------------------ Grand Prix
function startGP() {
  audio.init();
  G.raceNo = 0;
  G.points = {};
  for (const d of DRIVERS) G.points[d.id] = 0;
  const cpus = DRIVERS.filter((d) => d.id !== G.driverId).map((d) => d.id).sort(() => Math.random() - 0.5);
  G.grid = [...cpus, G.driverId];   // no MK64 você larga em 8º na primeira corrida
  G.rivals = cpus.slice(0, 2);      // 2 rivais "grudam" no jogador durante a copa
  startRace();
}

function clearRace() {
  if (!R) return;
  R.karts.forEach((k) => k.dispose());
  R.items.dispose();
  R.track.dispose(scene);
  R = null;
  owl.visible = false;
}

function startRace() {
  clearRace();
  endPodium();
  const trackId = CUPS[G.cupIdx].tracks[G.raceNo];
  const track = new Track(scene, trackId, G.cc === 'espelho');
  const theme = THEMES[track.def.theme];
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, 140, 900);

  const karts = G.grid.map((id, slot) => {
    const d = DRIVERS.find((x) => x.id === id);
    const k = new Kart(scene, d, bakes[id], G.cc, { isPlayer: id === G.driverId });
    k.place(track, track.N - 6 - slot * 4.5, slot % 2 ? -3 : 3);
    k.lane = (Math.random() - 0.5) * 5;
    k.phase = Math.random() * 6;
    k.rival = G.rivals.includes(id);
    k.fastRecover = k.rival && (G.cc === 150 || G.cc === 'espelho');
    if (AUTO && k.isPlayer) k.autopilot = true;
    return k;
  });
  const player = karts.find((k) => k.isPlayer);
  R = { track, karts, player, items: null, phase: 'intro', t: 0, raceTime: 0, pressT: -1, prevThrottle: false, prevItem: false, done: 0, ranking: [...karts], finalLap: false };
  R.items = new ItemSystem(scene, track, karts, (k) => R.ranking.indexOf(k) + 1);
  hud.setup(track, karts, portraits);
  hud.show(true);
  hud.hideOwl();
  input.showTouch(true);
  paused = false;
  show('race');
  document.querySelectorAll('.screen').forEach((s) => s.id !== 'loading' && s.classList.add('hidden'));
  camState.h = player.heading;
  audio.stopMusic();
}

// ------------------------------------------------------------------ corrida
const INTRO = 2.0;          // câmera mostrando o grid
const GO = INTRO + 3.0;     // 3 luzes vermelhas, depois azul

function ranking() {
  return [...R.karts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

function stepRace(dt) {
  R.t += dt;
  const { track, karts, player, items } = R;
  const pin = input.get();

  if (R.phase === 'intro' || R.phase === 'count') {
    // semáforo da coruja
    if (R.t >= INTRO) {
      if (R.phase === 'intro') { R.phase = 'count'; R.light = 0; }
      const n = Math.min(3, Math.floor(R.t - INTRO) + 1);
      if (n !== R.light) { R.light = n; hud.owlLights(n); audio.sfx('countLow'); }
    }
    // largada turbo: momento em que o acelerador foi apertado
    if (pin.throttle && !R.prevThrottle) R.pressT = R.t;
    if (!pin.throttle) R.pressT = -1;
    R.prevThrottle = pin.throttle;
    audio.engine(pin.throttle ? 0.6 : 0.05, pin.throttle, true);
    for (const k of karts) k.update(dt, { throttle: false, brake: false, steer: 0, hop: false }, track, false);
    if (R.t >= GO) {
      R.phase = 'race';
      hud.owlLights(4);
      setTimeout(() => R && R.phase === 'race' && hud.hideOwl(), 900);
      audio.sfx('countHigh');
      audio.playMusic(THEMES[track.def.theme].music);
      // jogador: acelerou na hora certa = turbo; cedo demais = pneu cantando parado
      if (!player.autopilot && pin.throttle && R.pressT >= 0) {
        if (R.pressT >= GO - DRIVE.rocketWindow) { player.boostT = 0.6; audio.sfx('boost'); hud.banner('LARGADA TURBO!', 1.2, 'blue'); }
        else { player.burnoutT = DRIVE.burnoutTime; audio.sfx('burnout'); }
      }
      for (const k of karts) if ((!k.isPlayer || k.autopilot) && Math.random() < 0.45) k.boostT = 0.6;
    }
    return;
  }

  R.raceTime += dt;
  for (const k of karts) {
    let inp;
    if (k.isPlayer && !k.autopilot) {
      inp = pin;
      if (pin.item && !R.prevItem) items.press(k, pin.aim);
      if (!pin.item && R.prevItem) items.release(k, pin.aim);
      R.prevItem = pin.item;
    } else {
      inp = aiDrive(k, track, items, player, R.raceTime, dt);
      if (k.isPlayer && k.holding) items.release(k);
    }
    k.update(dt, inp, track, true);
    if (!k.isPlayer || k.autopilot) {
      k.stuck = Math.abs(k.speed) < 1.5 && k.controllable ? k.stuck + dt : 0;
      if (k.stuck > 3) { k.stuck = 0; k.startRescue(track); }
    }
  }
  items.update(dt);
  collideKarts(karts);
  drafting(dt);
  R.ranking = ranking();
  for (const k of karts) checkLap(k);
  handleEvents();

  // alerta: algo vindo na sua direção
  const threat = player.finished ? null : items.threatTo(player);
  hud.warn(threat);
  if (threat) { R.warnBeep = (R.warnBeep || 0) - dt; if (R.warnBeep <= 0) { R.warnBeep = 0.35; audio.sfx('warn'); } }

  // contramão: a coruja avisa
  if (player.wrongWay > 1.5 && !player.finished && hud.owlT <= 0) hud.owlSign('↺ CONTRAMÃO', 1.2);

  if (R.phase === 'done') {
    R.done += dt;
    if (R.done > 5 || karts.every((k) => k.finished)) endRace();
  }
}

// vácuo: ficar logo atrás de outro kart por alguns segundos dá um empurrãozinho
function drafting(dt) {
  for (const k of R.karts) {
    let behind = false;
    for (const o of R.karts) {
      if (o === k) continue;
      const dx = o.pos.x - k.pos.x, dz = o.pos.z - k.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2 || d > 9) continue;
      const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
      const along = (dx * fx + dz * fz) / d;
      if (along > 0.97 && k.speed > k.top * 0.8) { behind = true; break; }
    }
    k.draftT = behind ? k.draftT + dt : 0;
    if (k.draftT > DRIVE.draftTime) { k.draftT = 0; k.draftBoostT = 1.0; if (k.isPlayer) audio.sfx('draft'); }
  }
}

function checkLap(k) {
  const done = Math.floor(k.progress / R.track.N);
  if (done <= k.lapsDone || k.finished) return;
  k.lapTimes.push(R.raceTime - k.lapStart);
  k.lapStart = R.raceTime;
  k.lapsDone = done;
  if (k.lapsDone >= LAPS) {
    k.finished = true; k.finishTime = R.raceTime; k.autopilot = true; k.celebrateT = 3;
    if (k.isPlayer) {
      const place = R.ranking.filter((o) => o.finished).length;
      audio.stopMusic();
      audio.sfx(place <= 4 ? 'finish' : 'lose');
      hud.owlSign('🏁', 3);
      hud.banner(place <= 4 ? `${place}º LUGAR!` : `${place}º... QUE PENA!`, 4, place <= 4 ? '' : 'warn');
      R.phase = 'done';
      R.done = 0;
    }
  } else if (k.isPlayer) {
    if (k.lapsDone === LAPS - 1) {
      hud.owlSign('VOLTA FINAL', 2);
      hud.banner('VOLTA FINAL!', 1.8);
      audio.sfx('finalLap');
      audio.setTempo(1.15);   // a música acelera na última volta, como no 64
    } else {
      hud.owlSign(`VOLTA ${k.lapsDone + 1}`, 2);
      audio.sfx('lap');
    }
  }
}

function handleEvents() {
  const p = R.player;
  for (const e of p.events) {
    const map = { hop: 'hop', stage1: 'stage1', stage2: 'stage2', mt: 'mt', hit: 'hit', skid: 'skid', wall: 'wall', bump: 'bump', splash: 'splash', lava: 'lava', fall: 'fall', rescue: 'rescue', grow: 'grow' };
    if (map[e]) audio.sfx(map[e]);
    if (e === 'skid') hud.banner('ESCAPOU!', 0.8, 'blue');
    if (e === 'hit' && p.lastHit) explainHit(p.lastHit);
    if (e === 'spinWarn') { hud.hitInfo('<b>CUIDADO!</b> VOLTE O DIRECIONAL PARA DENTRO', 0.8); audio.sfx('warn'); }
  }
  for (const k of R.karts) k.events.length = 0;
  for (const ev of R.items.events) {
    const mine = ev.kart === p;
    switch (ev.type) {
      case 'roulette': audio.sfx('roulette'); break;
      case 'got': audio.sfx('got'); break;
      case 'box': if (mine) audio.sfx('box'); break;
      case 'boost': if (mine) audio.sfx('boost'); break;
      case 'throw': if (mine) audio.sfx('throw'); break;
      case 'star': if (mine) audio.sfx('star'); break;
      case 'ghost': if (mine) audio.sfx('ghost'); break;
      case 'thunder': audio.sfx('thunder'); flash(); if (!mine && !p.invincible && !p.intangible) audio.sfx('shrink'); break;
      case 'blast': audio.sfx('blast'); break;
      case 'steal': if (ev.victim === p) hud.banner('ROUBARAM SEU ITEM!', 1.5, 'warn'); if (mine) hud.banner('ITEM ROUBADO!', 1.2, 'blue'); break;
      case 'hitItem': if (ev.by === p && ev.kart !== p) hud.banner('ACERTOU!', 0.7, 'blue'); break;
    }
  }
  R.items.events.length = 0;
}

const HIT_NAMES = {
  casca: 'UMA CASCA DE MELANCIA', presente: 'UM PRESENTE FALSO', coco: 'UM COCO', abelha: 'UMA ABELHA',
  vespao: 'O VESPÃO', trovao: 'O TROVÃO', aura: 'UM KART COM AURA DOURADA', atropelado: 'UM KART (VOCÊ ESTAVA PEQUENO)',
};
function explainHit(h) {
  if (h.cause === 'derrapagem') { hud.hitInfo('<b>RODOU!</b><br>VOCÊ SEGUROU PARA FORA TEMPO DEMAIS NA DERRAPAGEM'); return; }
  const what = HIT_NAMES[h.cause] || 'UM ITEM';
  const who = h.by && h.by !== R.player ? ` DE ${h.by.name.toUpperCase()}` : h.by === R.player ? ' (SEU PRÓPRIO)' : '';
  hud.hitInfo(`ATINGIDO POR <b>${what}${who}</b>`);
}

function flash() {
  const f = document.createElement('div');
  f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.8;pointer-events:none;transition:opacity .4s';
  document.body.appendChild(f);
  requestAnimationFrame(() => { f.style.opacity = '0'; setTimeout(() => f.remove(), 450); });
}

// ------------------------------------------------------------------ fim de corrida
function endRace() {
  const order = ranking();
  const place = order.indexOf(R.player) + 1;
  const qualified = place <= 4;
  audio.engine(0, false, false);
  R.phase = 'results';
  input.showTouch(false);
  hud.warn(null);
  hud.show(false);

  const rows = order.map((k, i) => {
    const pts = POINTS[i];
    const total = G.points[k.driver.id] + (qualified ? pts : 0);
    return `<tr class="${k.isPlayer ? 'me' : ''}"><td>${i + 1}º</td><td><img src="${portraits[k.driver.id]}"> ${k.name}</td>` +
      `<td>${k.finished ? fmtTime(k.finishTime) : '--'}</td><td class="plus">${qualified && pts ? '+' + pts : ''}</td><td>${total}</td></tr>`;
  });
  document.getElementById('results-table').innerHTML =
    `<tr><th>POS</th><th>PILOTO</th><th>TEMPO</th><th></th><th>PONTOS</th></tr>` + rows.join('');
  document.getElementById('results-title').textContent = `${TRACKS[R.track.id].name.toUpperCase()} — ${place}º LUGAR`;
  const btns = document.getElementById('results-buttons');
  btns.innerHTML = '';
  const add = (label, fn) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = () => { audio.sfx('confirm'); fn(); }; btns.appendChild(b); };
  const msg = document.getElementById('results-msg');

  if (qualified) {
    order.forEach((k, i) => (G.points[k.driver.id] += POINTS[i]));
    G.grid = order.map((k) => k.driver.id);      // próxima largada na ordem de chegada
    msg.textContent = '';
    if (G.raceNo < CUPS[G.cupIdx].tracks.length - 1) add('PRÓXIMA CORRIDA', () => { G.raceNo++; startRace(); });
    else add('VER PÓDIO', () => startPodium());
  } else {
    msg.innerHTML = 'Só os 4 primeiros pontuam.<br>Você precisa terminar entre os 4 para continuar a copa.';
    add('TENTAR DE NOVO', () => startRace());
    add('DESISTIR', () => goTo('title'));
  }
  show('results');
}

// ------------------------------------------------------------------ pódio
function startPodium() {
  const standings = DRIVERS.map((d) => d.id).sort((a, b) => G.points[b] - G.points[a] || G.grid.indexOf(a) - G.grid.indexOf(b));
  const place = standings.indexOf(G.driverId) + 1;
  clearRace();
  hud.show(false);
  podium = { group: new THREE.Group(), karts: [], t: 0 };
  scene.add(podium.group);
  scene.background = new THREE.Color(0x4fb3ff);
  scene.fog = new THREE.Fog(0x9fd8ff, 60, 300);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x4caf50 }));
  ground.rotation.x = -Math.PI / 2;
  podium.group.add(ground);
  const heights = [3, 2, 1.2], xs = [0, -3.4, 3.4], cols = [0xffd54f, 0xcfd8dc, 0xff9e5e];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, heights[i], 3), new THREE.MeshLambertMaterial({ color: cols[i] }));
    b.position.set(xs[i], heights[i] / 2, 0);
    podium.group.add(b);
    const d = DRIVERS.find((x) => x.id === standings[i]);
    const k = new Kart(scene, d, bakes[d.id], 100, { isPlayer: d.id === G.driverId });
    k.pos.set(xs[i], heights[i], 0);
    k.heading = Math.PI;
    podium.karts.push(k);
  }
  const cupName = CUPS[G.cupIdx].name.toUpperCase();
  const t = document.getElementById('podium-title');
  const m = document.getElementById('podium-msg');
  if (place <= 3) {
    const medal = ['OURO', 'PRATA', 'BRONZE'][place - 1];
    t.textContent = `${cupName} — TROFÉU DE ${medal}!`;
    m.innerHTML = standings.slice(0, 4).map((id, i) => `${i + 1}º ${DRIVERS.find((d) => d.id === id).name} — ${G.points[id]} pts`).join('<br>');
    const trophies = store.get('trophies', {});
    const key = `${G.cc}-${G.cupIdx}`;
    if (!trophies[key] || trophies[key] > place) trophies[key] = place;
    store.set('trophies', trophies);
    if (place === 1 && G.cc === 150 && !store.get('mirror', false)) {
      store.set('mirror', true);
      m.innerHTML += '<br><br>MODO ESPELHO DESBLOQUEADO!';
    }
    audio.sfx('finish');
  } else {
    t.textContent = cupName;
    m.innerHTML = `Que pena! Você ficou em ${place}º.<br>Quem sabe da próxima vez!`;
    audio.sfx('lose');
  }
  show('podium');
}

function endPodium() {
  if (!podium) return;
  podium.karts.forEach((k) => k.dispose());
  scene.remove(podium.group);
  podium.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  podium = null;
}

// ------------------------------------------------------------------ câmera
const camState = { h: 0, look: new THREE.Vector3() };
const tmp = new THREE.Vector3();

function chaseCamera(dt) {
  const p = R.player;
  if (p.rescueT > 0 || p.falling) {
    camera.lookAt(p.pos.x, p.pos.y + 1, p.pos.z);
    return;
  }
  // a câmera acompanha o kart com atraso; na derrapagem ela fica "para fora" da curva
  camState.h += wrapAngle(p.heading - p.slip * 1.2 - camState.h) * Math.min(1, 4.5 * dt);
  const back = 5.8, up = 2.5;
  tmp.set(p.pos.x - Math.sin(camState.h) * back, p.pos.y + up, p.pos.z - Math.cos(camState.h) * back);
  camera.position.lerp(tmp, 1 - Math.exp(-12 * dt));
  const ground = R.track.groundY(camera.position.x, camera.position.z, R.track.nearest(camera.position.x, camera.position.z, p.idx));
  if (camera.position.y < ground + 1.2) camera.position.y = ground + 1.2;
  tmp.set(p.pos.x + Math.sin(camState.h) * 3, p.pos.y + 1.1, p.pos.z + Math.cos(camState.h) * 3);
  camState.look.lerp(tmp, 1 - Math.exp(-14 * dt));
  camera.lookAt(camState.look);
}

function introCamera() {
  const p = R.player;
  const k = clamp(R.t / INTRO, 0, 1);
  const e = k * k * (3 - 2 * k);
  // começa na frente do grid, girando até ficar atrás do jogador
  const ang = p.heading + Math.PI * (1 - e);
  const dist = 14 - 8.2 * e;
  camera.position.set(p.pos.x - Math.sin(ang) * dist, p.pos.y + 4 - 1.5 * e, p.pos.z - Math.cos(ang) * dist);
  camState.look.set(p.pos.x, p.pos.y + 1, p.pos.z);
  camera.lookAt(camState.look);
  camState.h = p.heading;
}

// menu: câmera passeando pela primeira pista
let showTrack = null;
function showcase() {
  if (showTrack) return;
  showTrack = new Track(scene, 'campos');
  scene.background = new THREE.Color(THEMES.campos.sky);
  scene.fog = new THREE.Fog(THEMES.campos.fog, 140, 900);
}
function hideShowcase() { if (showTrack) { showTrack.dispose(scene); showTrack = null; } }
let showT = 0;
function showcaseCamera(dt) {
  showT += dt * 9;
  const tr = showTrack;
  const i = Math.floor(showT) % tr.N;
  tr.point(i, 0, tmp);
  camera.position.set(tmp.x, tmp.y + 3.5, tmp.z);
  const j = (i + 12) % tr.N;
  camera.lookAt(tr.px[j], tr.py[j] + 2.5, tr.pz[j]);
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  input.pollPad();

  if (R && !paused) {
    if (showTrack) hideShowcase();
    if (R.phase !== 'results') stepRace(dt);
    R.track.update(dt, camera);
    if (R.phase === 'intro') introCamera(); else chaseCamera(dt);
    for (const k of R.karts) k.syncView(dt, camera);
    updateOwl();
    if (R.phase !== 'results') {
      hud.update(dt, R.player, R.ranking, R.raceTime, LAPS);
      const p = R.player;
      if (R.phase === 'race' || R.phase === 'done') audio.engine(Math.abs(p.speed) / (p.top * 1.3), p.prevThrottle, true);
    }
    R.track.backdrop.position.set(camera.position.x, 140, camera.position.z);
  } else if (podium) {
    podium.t += dt;
    const a = podium.t * 0.25;
    camera.position.set(Math.sin(a) * 3 + 0, 4.2, 9.5);
    camera.lookAt(0, 2.4, 0);
    for (const k of podium.karts) { k.heading = Math.atan2(camera.position.x - k.pos.x, camera.position.z - k.pos.z); k.syncView(dt, camera); }
  } else if (showTrack) {
    showTrack.update(dt, camera);
    showcaseCamera(dt);
    showTrack.backdrop.position.set(camera.position.x, 140, camera.position.z);
  }
  // modo foto (testes/registro): câmera travada num ponto
  if (window.__photo) {
    camera.position.copy(window.__photo.p);
    camera.lookAt(window.__photo.t);
    if (R) R.track.backdrop.position.set(camera.position.x, 140, camera.position.z);
  }
  renderer.render(scene, camera);
}

function updateOwl() {
  const p = R.player;
  // a coruja aparece para quem cair (só mostramos a do jogador e dos karts próximos)
  const k = R.karts.find((x) => x.rescueT > 0 && x.pos.distanceTo(camera.position) < 60) || null;
  owl.visible = !!k;
  if (!k) return;
  const t = 2.6 - k.rescueT;
  const drop = t < 0.6 ? (1 - t / 0.6) * 10 : t > 1.9 ? (t - 1.9) * 12 : 0;
  owl.position.set(k.pos.x, k.pos.y + 2.8 + drop, k.pos.z);
  if (k === p) hud.hideOwl();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyRes();
});

// ------------------------------------------------------------------ início
showcase();
frame();
await bakeAll();
buildCharGrid();
show('title');

// acesso para testes automatizados: ?auto&start=1&track=praia&cc=150
window.__game = {
  get R() { return R; }, G, startGP, startRace, input, camera, THREE, renderer,
  simulate(seconds, step = 1 / 60) {
    for (let t = 0; t < seconds && R && R.phase !== 'results'; t += step) { stepRace(step); }
    return R && R.phase;
  },
};
if (params.has('start')) {
  if (params.get('cc')) G.cc = params.get('cc') === 'espelho' ? 'espelho' : Number(params.get('cc'));
  if (params.get('driver')) G.driverId = params.get('driver');
  startGP();
  if (params.get('race')) { G.raceNo = Number(params.get('race')); startRace(); }
}
