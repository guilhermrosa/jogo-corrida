import * as THREE from 'three';
import { ROAD_HALF, CURB_W, WALL_OFF } from './track.js';

export const MAX_SPEED = 34;   // m/s (~122 km/h)
const ACCEL = 21;
const BRAKE = 38;
const REVERSE_MAX = 10;
const COAST = 7;
const OFFROAD_MAX = 15;
const BOOST_MUL = 1.4;
const KART_RADIUS = 1.2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...extra });
}

function nameTag(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.55)';
  g.beginPath(); g.roundRect(8, 8, 240, 48, 18); g.fill();
  g.fillStyle = '#' + new THREE.Color(color).getHexString();
  g.beginPath(); g.arc(36, 32, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif'; g.textBaseline = 'middle';
  g.fillText(text, 56, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set(2.4, 0.6, 1);
  sp.position.y = 2.6;
  return sp;
}

// Modelo do kart, virado para +z
function buildKartMesh(color, label) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = std(color, { metalness: 0.35, roughness: 0.35 });
  const dark = std(0x222428, { roughness: 0.8 });
  const metal = std(0x9e9e9e, { metalness: 0.8, roughness: 0.3 });

  const add = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  add(new THREE.BoxGeometry(1.5, 0.12, 2.7), dark, 0, 0.3, 0);          // chassi
  add(new THREE.BoxGeometry(1.3, 0.35, 1.6), paint, 0, 0.5, 0.25);       // carenagem
  const nose = add(new THREE.BoxGeometry(1.1, 0.28, 0.8), paint, 0, 0.45, 1.3);
  nose.rotation.x = 0.25;
  add(new THREE.BoxGeometry(1.9, 0.18, 0.35), dark, 0, 0.35, 1.65);      // para-choque
  add(new THREE.BoxGeometry(0.4, 0.3, 1.6), paint, 0.82, 0.45, -0.1);    // pontões laterais
  add(new THREE.BoxGeometry(0.4, 0.3, 1.6), paint, -0.82, 0.45, -0.1);
  add(new THREE.BoxGeometry(0.85, 0.75, 0.25), dark, 0, 0.85, -0.75);    // encosto do banco
  add(new THREE.BoxGeometry(0.85, 0.12, 0.6), dark, 0, 0.52, -0.5);      // assento

  // Motor e escapamento
  add(new THREE.BoxGeometry(0.6, 0.45, 0.5), metal, 0.35, 0.6, -1.15);
  const pipe = add(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), metal, -0.4, 0.55, -1.35);
  pipe.rotation.x = Math.PI / 2;

  // Aerofólio
  add(new THREE.BoxGeometry(1.8, 0.08, 0.45), paint, 0, 1.15, -1.45);
  add(new THREE.BoxGeometry(0.08, 0.5, 0.25), dark, 0.6, 0.9, -1.45);
  add(new THREE.BoxGeometry(0.08, 0.5, 0.25), dark, -0.6, 0.9, -1.45);

  // Piloto
  add(new THREE.CylinderGeometry(0.3, 0.36, 0.65, 10), std(0xf5f5f5), 0, 0.95, -0.35);
  const helmet = add(new THREE.SphereGeometry(0.33, 16, 12), paint, 0, 1.48, -0.3);
  helmet.scale.set(1, 1.05, 1.1);
  add(new THREE.BoxGeometry(0.46, 0.16, 0.12), std(0x111111, { metalness: 0.6, roughness: 0.1 }), 0, 1.5, 0.02);
  const sw = add(new THREE.TorusGeometry(0.2, 0.04, 6, 16), dark, 0, 0.98, 0.3);
  sw.rotation.x = -0.6;
  const arms = add(new THREE.BoxGeometry(0.7, 0.12, 0.5), std(0xf5f5f5), 0, 1.0, 0.05);
  arms.rotation.x = -0.4;

  // Rodas
  const tire = std(0x151515, { roughness: 0.9 });
  const rim = std(0xcfd8dc, { metalness: 0.7, roughness: 0.3 });
  const wheels = [], pivots = [];
  const mkWheel = (x, z, r, w, front) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    root.add(pivot);
    const wheel = new THREE.Group();
    pivot.add(wheel);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), tire);
    t.rotation.z = Math.PI / 2; t.castShadow = true;
    wheel.add(t);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 8), rim);
    h.rotation.z = Math.PI / 2;
    wheel.add(h);
    wheels.push(wheel);
    if (front) pivots.push(pivot);
  };
  mkWheel(0.95, 1.0, 0.33, 0.32, true);
  mkWheel(-0.95, 1.0, 0.33, 0.32, true);
  mkWheel(1.0, -1.0, 0.4, 0.45, false);
  mkWheel(-1.0, -1.0, 0.4, 0.45, false);

  // Faíscas do drift
  const sparks = [];
  for (const sx of [1, -1]) {
    const sp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    sp.position.set(sx * 1.05, 0.15, -1.45);
    sp.visible = false;
    root.add(sp);
    sparks.push(sp);
  }

  // Chama do turbo
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.1, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9100, transparent: true, opacity: 0.85 })
  );
  flame.geometry.rotateX(-Math.PI / 2);
  flame.position.set(-0.4, 0.55, -2.1);
  flame.visible = false;
  root.add(flame);

  if (label) root.add(nameTag(label, color));

  return { root, body, wheels, pivots, sparks, flame };
}

export class Kart {
  constructor(scene, { color, name, isPlayer = false, skill = 1, lane = 0 }) {
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.skill = skill;
    this.lane = lane;
    this.phase = Math.random() * Math.PI * 2;
    this.model = buildKartMesh(color, isPlayer ? null : name);
    scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.speed = 0;
    this.heading = 0;
    this.steer = 0;
    this.slip = 0;
    this.drift = 0;
    this.driftTime = 0;
    this.boostTime = 0;
    this.hop = 0;
    this.idx = 0;
    this.lat = 0;
    this.progress = 0;
    this.lapsDone = 0;
    this.lapStart = 0;
    this.lapTimes = [];
    this.finished = false;
    this.finishTime = 0;
    this.autopilot = false;
    this.stuck = 0;
    this.wrongWay = 0;
    this.wallHit = 0;
    this.events = [];
    this.turn = 0;
  }

  dispose(scene) {
    scene.remove(this.model.root);
    this.model.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
  }

  place(track, idx, lat) {
    idx = track.wrap(idx);
    track.point(idx, lat, this.pos);
    this.heading = track.heading(idx);
    this.idx = idx;
    this.lat = lat;
    this.progress = idx > track.N / 2 ? idx - track.N : idx;
    this.syncModel(0);
  }

  // Coloca o kart de volta no centro da pista (mantendo o progresso)
  respawn(track) {
    const idx = this.idx;
    track.point(idx, 0, this.pos);
    this.heading = track.heading(idx);
    this.lat = 0;
    this.speed = 0;
    this.drift = 0;
    this.slip = 0;
    this.stuck = 0;
  }

  get boosting() { return this.boostTime > 0; }

  get driftLevel() {
    if (!this.drift) return 0;
    return this.driftTime > 2.1 ? 2 : this.driftTime > 1.0 ? 1 : 0;
  }

  update(dt, input, track) {
    const offroad = Math.abs(this.lat) > ROAD_HALF + CURB_W * 0.7;
    const topMul = this.isPlayer ? 1 : 1.06;
    let max = (offroad ? OFFROAD_MAX : MAX_SPEED) * topMul;
    if (this.boostTime > 0) {
      max = MAX_SPEED * BOOST_MUL;
      this.boostTime -= dt;
    }

    // Aceleração / frenagem
    const s = this.speed;
    if (input.throttle) {
      if (s < 0) this.speed += BRAKE * dt;
      else if (s < max) this.speed += ACCEL * (this.boostTime > 0 ? 2.2 : 1) * (1 - 0.45 * clamp(s / MAX_SPEED, 0, 1)) * dt;
    } else if (input.brake) {
      if (s > 0) this.speed -= BRAKE * dt;
      else if (s > -REVERSE_MAX) this.speed -= ACCEL * 0.6 * dt;
    } else {
      this.speed -= Math.sign(s) * Math.min(Math.abs(s), COAST * dt);
    }
    if (this.speed > max) this.speed = Math.max(max, this.speed - (offroad ? 30 : 12) * dt);

    // Direção suavizada (teclado é digital)
    this.steer += clamp(input.steer - this.steer, -7 * dt, 7 * dt);

    // Drift
    if (input.drift && !this.drift && Math.abs(input.steer) > 0.2 && this.speed > 14 && !offroad) {
      this.drift = Math.sign(input.steer);
      this.driftTime = 0;
      this.hop = 0.25;
    }
    if (this.drift && (!input.drift || this.speed < 9 || offroad)) {
      const lvl = this.driftLevel;
      if (lvl > 0 && this.speed >= 9) {
        this.boostTime = Math.max(this.boostTime, lvl === 2 ? 1.5 : 0.8);
        this.events.push('boost');
      }
      this.drift = 0;
    }

    const speedFactor = clamp(Math.abs(this.speed) / 7, 0, 1) * (1 - 0.35 * clamp(this.speed / MAX_SPEED, 0, 1));
    let turn, slipTarget;
    if (this.drift) {
      const inward = this.steer * this.drift; // -1..1 (positivo = fechar a curva)
      turn = this.drift * (1.25 + 0.75 * inward) * 1.45;
      this.driftTime += dt * (inward > 0.3 ? 1.35 : 0.75);
      slipTarget = 0.38 * this.drift;
    } else {
      turn = this.steer * 2.05;
      slipTarget = 0;
    }
    this.turn = turn * speedFactor;
    this.heading = wrapAngle(this.heading + this.turn * dt * (this.speed >= 0 ? 1 : -1));
    this.slip += (slipTarget - this.slip) * Math.min(1, 6 * dt);

    const moveAngle = this.heading - this.slip;
    this.pos.x += Math.sin(moveAngle) * this.speed * dt;
    this.pos.z += Math.cos(moveAngle) * this.speed * dt;

    // Relação com a pista
    const newIdx = track.nearest(this.pos.x, this.pos.z, this.idx);
    let d = newIdx - this.idx;
    if (d > track.N / 2) d -= track.N;
    if (d < -track.N / 2) d += track.N;
    this.progress += d;
    this.idx = newIdx;
    this.lat = track.lateral(this.pos.x, this.pos.z, newIdx);

    // Muros
    const lim = WALL_OFF - KART_RADIUS;
    this.wallHit = Math.max(0, this.wallHit - dt);
    if (Math.abs(this.lat) > lim) {
      const push = (Math.abs(this.lat) - lim) * Math.sign(this.lat);
      this.pos.x -= -track.tz[newIdx] * push;
      this.pos.z -= track.tx[newIdx] * push;
      this.lat -= push;
      const th = track.heading(newIdx);
      const rel = wrapAngle(this.heading - th);
      const impact = Math.abs(Math.sin(rel));
      if (this.wallHit === 0 && Math.abs(this.speed) > 8 && impact > 0.15) this.events.push('bump');
      this.wallHit = 0.3;
      this.speed -= this.speed * Math.min(1, impact * 4 * dt + 0.6 * dt);
      const target = Math.abs(rel) < Math.PI / 2 ? th : th + Math.PI;
      this.heading = wrapAngle(this.heading + wrapAngle(target - this.heading) * Math.min(1, 5 * dt));
    }

    // Placas de turbo
    if (track.padAt(newIdx, this.lat) && this.speed > 0) {
      if (this.boostTime < 0.5) this.events.push('boost');
      this.boostTime = Math.max(this.boostTime, 1.1);
    }

    // Contramão
    const relTrack = wrapAngle(this.heading - track.heading(newIdx));
    this.wrongWay = Math.abs(relTrack) > 1.9 && this.speed > 3 ? this.wrongWay + dt : 0;

    this.syncModel(dt);
  }

  syncModel(dt) {
    const m = this.model;
    this.hop = Math.max(0, this.hop - dt);
    const hopY = Math.sin((this.hop / 0.25) * Math.PI) * 0.35 * (this.hop > 0 ? 1 : 0);
    m.root.position.set(this.pos.x, hopY, this.pos.z);
    m.root.rotation.y = this.heading;
    const roll = clamp(this.turn * Math.abs(this.speed) * 0.0028, -0.12, 0.12);
    m.body.rotation.z += (roll - m.body.rotation.z) * Math.min(1, 8 * dt);
    for (const p of m.pivots) p.rotation.y = this.steer * 0.45 + (this.drift ? -this.drift * 0.2 : 0);
    for (const w of m.wheels) w.rotation.x += (this.speed * dt) / 0.36;

    const lvl = this.driftLevel;
    const showSparks = this.drift !== 0;
    const sparkColor = lvl === 2 ? 0xff7a00 : lvl === 1 ? 0x40c4ff : 0xe0e0e0;
    for (const sp of m.sparks) {
      sp.visible = showSparks;
      if (showSparks) {
        sp.material.color.setHex(sparkColor);
        const sc = (lvl === 0 ? 0.5 : 1) * (0.6 + Math.random() * 0.8);
        sp.scale.setScalar(sc);
        sp.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      }
    }
    m.flame.visible = this.boostTime > 0;
    if (m.flame.visible) m.flame.scale.set(1, 1, 0.7 + Math.random() * 0.7);
  }
}

// Colisão simples entre karts (círculos)
export function collideKarts(karts) {
  const minD = KART_RADIUS * 2;
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;
        // quem está atrás perde um pouco de velocidade
        const avg = (a.speed + b.speed) / 2;
        a.speed += (avg - a.speed) * 0.3;
        b.speed += (avg - b.speed) * 0.3;
        if (a.isPlayer || b.isPlayer) (a.isPlayer ? a : b).events.push('bump');
      }
    }
  }
}
