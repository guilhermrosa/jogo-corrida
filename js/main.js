import * as THREE from 'three';
import { Track } from './track.js';
import { Kart, collideKarts, wrapAngle } from './kart.js';
import { aiInput } from './ai.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, formatTime } from './hud.js';

const COLORS = [
  { name: 'Vermelho', hex: 0xe53935 },
  { name: 'Azul', hex: 0x1e88e5 },
  { name: 'Verde', hex: 0x43a047 },
  { name: 'Amarelo', hex: 0xfdd835 },
  { name: 'Roxo', hex: 0x8e24aa },
  { name: 'Laranja', hex: 0xfb8c00 },
];
const RIVALS = [
  { name: 'Bia Turbo', skill: 0.97 },
  { name: 'Léo Veloz', skill: 0.94 },
  { name: 'Zeca Curva', skill: 0.91 },
];
const LAP_OPTIONS = [1, 3, 5];
const params = new URLSearchParams(location.search);
const AUTO = params.has('auto'); // ?auto -> o jogador também é pilotado pela IA (modo demonstração)

// ------------------------------------------------------------------ Cena
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x8fd3ff, 180, 750);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);

scene.add(new THREE.HemisphereLight(0xcfeaff, 0x4a6b3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const track = new Track(scene);
const input = new Input();
const audio = new GameAudio();
const hud = new Hud(track);

// ------------------------------------------------------------------ Estado
let karts = [];
let player = null;
let state = 'menu'; // menu | countdown | race | finished
let paused = false;
let raceTime = 0;
let countdown = 0;
let lastCount = 0;
let laps = 3;
let colorIdx = 0;
let finishTimer = 0;
let menuTime = 0;
let camHeading = 0;
const camLook = new THREE.Vector3();

function buildGrid() {
  karts.forEach((k) => k.dispose(scene));
  karts = [];
  const rivalColors = COLORS.filter((_, i) => i !== colorIdx);
  RIVALS.forEach((r, i) => {
    karts.push(new Kart(scene, { color: rivalColors[i * 2 % rivalColors.length].hex, name: r.name, skill: r.skill, lane: i % 2 ? -2.5 : 2.5 }));
  });
  player = new Kart(scene, { color: COLORS[colorIdx].hex, name: 'Você', isPlayer: true, skill: 0.9 });
  karts.push(player);
  // Grid de largada: jogador sai por último
  karts.forEach((k, i) => k.place(track, track.N - 10 - i * 7, i % 2 ? -3.5 : 3.5));
  camHeading = player.heading;
}

function startRace() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  buildGrid();
  if (AUTO) player.autopilot = true;
  state = 'countdown';
  paused = false;
  countdown = 3.999;
  lastCount = 4;
  raceTime = 0;
  finishTimer = 0;
  hud.show(true);
  hud.countdown('');
  input.showTouch(true);
  audio.init();
  snapCamera();
}

function goToMenu() {
  state = 'menu';
  paused = false;
  hud.show(false);
  input.showTouch(false);
  audio.engine(0, false, false);
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  buildGrid();
}

function setPaused(p) {
  if (state !== 'race' && state !== 'countdown') return;
  paused = p;
  document.getElementById('pause').classList.toggle('hidden', !p);
  if (p) audio.engine(0, false, false);
}

// ------------------------------------------------------------------ Menu
function setupMenu() {
  const colorsEl = document.getElementById('colors');
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === colorIdx ? ' active' : '');
    b.style.background = '#' + c.hex.toString(16).padStart(6, '0');
    b.title = c.name;
    b.onclick = () => {
      colorIdx = i;
      colorsEl.querySelectorAll('.swatch').forEach((s, j) => s.classList.toggle('active', j === i));
      buildGrid();
    };
    colorsEl.appendChild(b);
  });
  const lapsEl = document.getElementById('laps');
  LAP_OPTIONS.forEach((n) => {
    const b = document.createElement('button');
    b.className = 'lap-btn' + (n === laps ? ' active' : '');
    b.textContent = n;
    b.onclick = () => {
      laps = n;
      lapsEl.querySelectorAll('.lap-btn').forEach((s) => s.classList.toggle('active', s === b));
    };
    lapsEl.appendChild(b);
  });
  document.getElementById('btn-start').onclick = startRace;
  document.getElementById('btn-again').onclick = startRace;
  document.getElementById('btn-menu').onclick = goToMenu;
  document.getElementById('btn-resume').onclick = () => setPaused(false);
  document.getElementById('btn-quit').onclick = goToMenu;
}

input.on('Escape', () => setPaused(!paused));
input.on('KeyP', () => setPaused(!paused));
input.on('KeyM', () => hud.banner(audio.toggleMute() ? 'SOM DESLIGADO' : 'SOM LIGADO', 1));
input.on('KeyR', () => { if (state === 'race' && !paused && player && !player.finished) player.respawn(track); });
input.on('Enter', () => { if (state === 'menu') startRace(); });

// ------------------------------------------------------------------ Corrida
function ranking() {
  return [...karts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

function handleLaps(k) {
  const done = Math.floor(k.progress / track.N);
  if (done > k.lapsDone && !k.finished) {
    k.lapTimes.push(raceTime - k.lapStart);
    k.lapStart = raceTime;
    k.lapsDone = done;
    if (k.lapsDone >= laps) {
      k.finished = true;
      k.finishTime = raceTime;
      k.autopilot = true;
      if (k === player) {
        audio.finish();
        const pos = ranking().indexOf(player) + 1;
        hud.banner(pos === 1 ? 'VITÓRIA! 🏆' : `CHEGADA! ${pos}º LUGAR`, 4);
        state = 'finished';
      }
    } else if (k === player) {
      audio.lap();
      if (k.lapsDone === laps - 1) hud.banner('VOLTA FINAL!', 2);
      else hud.banner(`VOLTA ${k.lapsDone + 1}  •  ${formatTime(k.lapTimes[k.lapTimes.length - 1])}`, 2);
    }
  }
}

function stepKarts(dt, active) {
  const idle = { throttle: false, brake: false, steer: 0, drift: false };
  for (const k of karts) {
    let inp;
    if (!active) inp = idle;
    else if (k.isPlayer && !k.autopilot) inp = input.get();
    else inp = aiInput(k, track, player, raceTime);
    k.update(dt, inp, track);

    // IA presa contra o muro -> volta para a pista
    if (active && (!k.isPlayer || k.autopilot)) {
      k.stuck = Math.abs(k.speed) < 2 ? k.stuck + dt : 0;
      if (k.stuck > 2) k.respawn(track);
    }
  }
  collideKarts(karts);
  if (active) karts.forEach(handleLaps);

  // eventos de som / avisos do jogador
  for (const e of player.events) {
    if (e === 'boost') { audio.boost(); if (!player.finished) hud.banner('TURBO!', 0.8); }
    if (e === 'bump') audio.bump();
  }
  karts.forEach((k) => (k.events.length = 0));
  if (player.wrongWay > 1.2 && !player.finished && state === 'race') hud.banner('CONTRAMÃO!', 0.3, true);
}

function showResults() {
  const rows = ranking().map((k, i) => {
    const best = k.lapTimes.length ? formatTime(Math.min(...k.lapTimes)) : '--';
    const total = k.finished ? formatTime(k.finishTime) : 'correndo...';
    const dot = `<span class="dot" style="background:#${k.color.toString(16).padStart(6, '0')}"></span>`;
    return `<tr class="${k === player ? 'me' : ''}"><td>${i + 1}º</td><td>${dot}${k.name}</td><td>${total}</td><td>${best}</td></tr>`;
  });
  document.getElementById('results-table').innerHTML =
    '<tr><th>POS</th><th>PILOTO</th><th>TEMPO</th><th>MELHOR VOLTA</th></tr>' + rows.join('');
  const pos = ranking().indexOf(player) + 1;
  document.getElementById('results-title').textContent = pos === 1 ? '🏆 Você venceu!' : `Você terminou em ${pos}º`;
}

// ------------------------------------------------------------------ Câmera
function chaseTarget(out) {
  const back = player.speed < -1 ? -1 : 1;
  out.set(
    player.pos.x - Math.sin(camHeading) * 7.5 * back,
    3.3,
    player.pos.z - Math.cos(camHeading) * 7.5 * back
  );
  return out;
}
const tmp = new THREE.Vector3();

function snapCamera() {
  camHeading = player.heading;
  camera.position.copy(chaseTarget(tmp));
  camLook.set(player.pos.x, 1.2, player.pos.z);
  camera.lookAt(camLook);
}

function updateCamera(dt) {
  camHeading += wrapAngle(player.heading - player.slip * 0.5 - camHeading) * Math.min(1, 5 * dt);
  chaseTarget(tmp);
  camera.position.lerp(tmp, 1 - Math.exp(-8 * dt));
  tmp.set(player.pos.x + Math.sin(camHeading) * 4, 1.3, player.pos.z + Math.cos(camHeading) * 4);
  camLook.lerp(tmp, 1 - Math.exp(-12 * dt));
  camera.lookAt(camLook);
  const fov = 65 + (player.boosting ? 10 : 0) + Math.max(0, player.speed) * 0.12;
  camera.fov += (fov - camera.fov) * Math.min(1, 4 * dt);
  camera.updateProjectionMatrix();
}

function updateMenuCamera(dt) {
  menuTime += dt;
  const a = menuTime * 0.12;
  const c = player.pos;
  camera.position.set(c.x + Math.cos(a) * 26, 9 + Math.sin(menuTime * 0.3) * 2, c.z + Math.sin(a) * 26);
  camera.lookAt(c.x, 1, c.z);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ Loop
const clock = new THREE.Clock();
let resultsTimer = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (!paused) {
    track.update(dt);

    if (state === 'menu') {
      stepKarts(dt, false);
      updateMenuCamera(dt);
    } else {
      if (state === 'countdown') {
        countdown -= dt;
        const n = Math.ceil(countdown);
        if (n !== lastCount) {
          lastCount = n;
          if (n > 0) { hud.countdown(String(n)); audio.beep(false); }
          else { hud.countdown('JÁ!', true); audio.beep(true); state = 'race'; setTimeout(() => hud.countdown(''), 800); }
        }
        stepKarts(dt, false);
        const inp = input.get();
        audio.engine(inp.throttle ? 0.35 : 0.05, inp.throttle, true);
      } else {
        raceTime += dt;
        stepKarts(dt, true);
        audio.engine(Math.abs(player.speed) / 40, input.get().throttle || player.autopilot, true);

        if (state === 'finished') {
          finishTimer += dt;
          resultsTimer -= dt;
          if (finishTimer > 2.5 && resultsTimer <= 0) {
            resultsTimer = 0.5;
            showResults();
            document.getElementById('results').classList.remove('hidden');
            input.showTouch(false);
          }
        }
      }
      updateCamera(dt);
      hud.update(dt, player, karts, ranking(), raceTime, laps);
    }

    sun.position.set(player.pos.x + 60, 110, player.pos.z + 40);
    sun.target.position.copy(player.pos);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setupMenu();
buildGrid();
frame();

// Acesso para testes/depuração no console
window.__game = {
  get karts() { return karts; }, get player() { return player; }, get state() { return state; }, get raceTime() { return raceTime; },
  track, startRace,
  // avança a simulação sem renderizar (para testes automatizados)
  simulate(seconds, step = 1 / 60) {
    let respawns = 0;
    for (let t = 0; t < seconds && (state === 'race' || state === 'finished'); t += step) {
      raceTime += step;
      const before = karts.map((k) => k.stuck);
      stepKarts(step, true);
      karts.forEach((k, i) => { if (before[i] > 1.9 && k.stuck === 0 && k.speed === 0) respawns++; });
    }
    return respawns;
  },
};
if (AUTO && params.has('start')) startRace();
