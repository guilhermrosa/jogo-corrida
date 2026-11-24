import * as THREE from 'three';
import { pixelTex } from './textures.js';
import { tinBot } from './robots.js';

// =====================================================================
//  Pódio no mundo steampunk: praça de oficina no fim de tarde, pedestais de
//  cobre rebitado com números em engrenagens, arco de engrenagem girando,
//  caldeiras soltando vapor de comemoração, canhões de confete, robôs torcendo
//  e um dirigível com faixa.
// =====================================================================

const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);

function rng(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function gearShape(R, T, hole = 0.3) {
  const s = new THREE.Shape();
  for (let k = 0; k < T; k++) {
    const a = (k / T) * Math.PI * 2, st = (Math.PI * 2) / T, P = (aa, rr) => [Math.cos(aa) * rr, Math.sin(aa) * rr];
    if (!k) s.moveTo(...P(a, R * 0.84)); else s.lineTo(...P(a, R * 0.84));
    s.lineTo(...P(a + st * 0.2, R)); s.lineTo(...P(a + st * 0.5, R)); s.lineTo(...P(a + st * 0.7, R * 0.84));
  }
  if (hole) { const h = new THREE.Path(); h.absarc(0, 0, R * hole, 0, Math.PI * 2, true); s.holes.push(h); }
  return s;
}

export function buildPodiumScene(group, smokeTex) {
  const r = rng(7);
  const brass = phong({ color: 0xc9a24a, shininess: 70, specular: 0x887755 });
  const copper = phong({ color: 0xb8673a, shininess: 50, specular: 0x553322 });
  const iron = lam({ color: 0x3b3632 });
  const anims = [];

  // chão: praça de paralelepípedos com um anel de latão
  const cobble = pixelTex(64, 64, (c, w, h, rr) => {
    c.fillStyle = '#4a4038'; c.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 8, row++) for (let x = row % 2 ? -5 : 0; x < w; x += 10) {
      const k = 0.85 + rr() * 0.3; c.fillStyle = `rgb(${150 * k | 0},${136 * k | 0},${118 * k | 0})`; c.fillRect(x + 1, y + 1, 9, 7);
      c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + 1, y + 1, 9, 1);
    }
  }, { seed: 4 });
  cobble.repeat.set(30, 30);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), lam({ map: cobble }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.4, 8, 40), brass); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; group.add(ring);

  // pedestais de cobre rebitado com número numa engrenagem de latão
  const plate = pixelTex(32, 32, (c, w, h) => {
    c.fillStyle = '#8a5236'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#a8663e'; c.fillRect(1, 1, w - 2, h - 2);
    c.fillStyle = 'rgba(255,220,170,.4)'; c.fillRect(1, 1, w - 2, 1);
    c.fillStyle = '#e6b070'; for (const [x, y] of [[3, 3], [27, 3], [3, 27], [27, 27], [15, 3], [15, 27]]) c.fillRect(x, y, 2, 2);
  }, { seed: 2 });
  const heights = [3, 2, 1.2], xs = [0, -3.4, 3.4];
  heights.forEach((h, i) => {
    const t = plate.clone(); t.repeat.set(2, Math.max(1, Math.round(h))); t.needsUpdate = true;
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 3), lam({ map: t })); b.position.set(xs[i], h / 2, 0); group.add(b);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 3.2), brass); cap.position.set(xs[i], h + 0.1, 0); group.add(cap);
    const gear = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(0.75, 12, 0), { depth: 0.12, bevelEnabled: false }), brass);
    gear.position.set(xs[i], h / 2 + 0.05, 1.52); group.add(gear);
    const num = pixelTex(16, 16, (c, w, hh) => { c.fillStyle = '#2a1a10'; c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.clearRect(0, 0, w, hh); c.fillText(String(i + 1), w / 2, hh / 2 + 1); }, { repeat: false });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), lam({ map: num, transparent: true })); n.position.set(xs[i], h / 2 + 0.05, 1.66); group.add(n);
    anims.push((tt) => { gear.rotation.z = tt * (i % 2 ? -0.6 : 0.6); });
  });
  // troféu de latão em cima do primeiro lugar, atrás do kart
  {
    const cup = new THREE.Group(); cup.position.set(0, 3.2, -1.1); group.add(cup);
    const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(0.25 + Math.sin(t * Math.PI * 0.9) * 0.55 + t * 0.2, t * 1.4)); }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), brass); body.position.y = 0.5; cup.add(body);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 0.5, 14), brass); foot.position.y = 0.25; cup.add(foot);
    for (const s of [1, -1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.07, 6, 12, Math.PI), brass); h.position.set(s * 0.85, 1.3, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; cup.add(h); }
    const g = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(0.35, 10, 0.3), { depth: 0.08, bevelEnabled: false }), copper); g.position.set(0, 1.1, 0.62); cup.add(g);
    anims.push((tt) => { cup.rotation.y = Math.sin(tt * 0.8) * 0.4; g.rotation.z = tt; });
  }

  // arco de engrenagem gigante atrás do pódio, girando
  {
    const arch = new THREE.Group(); arch.position.set(0, 0, -7); group.add(arch);
    const big = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(9, 30, 0.82), { depth: 0.8, bevelEnabled: false, curveSegments: 32 }), brass);
    big.position.y = 3; arch.add(big);
    for (const s of [1, -1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 2), copper); pil.position.set(s * 10.5, 7, 0); arch.add(pil);
      const sg = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(2.6, 12, 0.3), { depth: 0.6, bevelEnabled: false }), copper); sg.position.set(s * 10.5, 14.5, 0.8); arch.add(sg);
      anims.push((tt) => { sg.rotation.z = -tt * 0.9 * s; });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), basic({ color: 0xffd98a })); lamp.position.set(s * 10.5, 17.6, 0); arch.add(lamp);
    }
    const banner = pixelTex(128, 20, (c, w, h) => {
      c.fillStyle = '#2a2624'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9a24a'; c.fillRect(2, 2, w - 4, h - 4); c.fillStyle = '#5a1e14'; c.fillRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#ffd98a'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CAMPEÕES', w / 2, h / 2 + 1);
    }, { repeat: false });
    const b = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 0.3), [iron, iron, iron, iron, lam({ map: banner }), iron]); b.position.set(0, 13.2, 0.9); arch.add(b);
    anims.push((tt) => { big.rotation.z = tt * 0.15; });
  }

  // caldeiras dos lados soltando vapor de comemoração, e canhões de confete
  const puffs = [];
  const confetti = [];
  for (const s of [1, -1]) {
    const g = new THREE.Group(); g.position.set(s * 11, 0, -4); group.add(g);
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 4, 14), copper); boiler.position.y = 2; g.add(boiler);
    for (const y of [0.6, 2, 3.4]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.25, 14), brass); band.position.y = y; g.add(band); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass); dome.position.y = 4; g.add(dome);
    const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 8), brass); whistle.position.y = 5.8; g.add(whistle);
    for (let k = 0; k < 6; k++) {
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, color: 0xffffff }));
      g.add(p); puffs.push({ p, t: k / 6, base: 6.4 });
    }
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.2, 10), brass);
    cannon.position.set(s * 6, 0.9, 2.2); cannon.rotation.z = s * 0.5; cannon.scale.setScalar(0.7); group.add(cannon);
    const cols = [0xc9a24a, 0xb8673a, 0xefe2c2, 0xb0322a, 0x6fb09c];
    for (let k = 0; k < 40; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), basic({ color: cols[k % cols.length], side: THREE.DoubleSide }));
      group.add(c);
      confetti.push({ c, s, t: r() * 3, vx: (r() - 0.5) * 2 - s * 3, vy: 6 + r() * 4, vz: (r() - 0.3) * 2, sp: r() * 8 });
    }
  }

  // robozinhos torcendo em volta
  const bots = [];
  for (const [x, z] of [[-12, 2.5], [-9.5, 4], [-7, 1.5], [7, 1.5], [9.5, 4], [12, 2.5], [-5.5, -4], [5.5, -4]]) {
    const b = tinBot(r, { mode: 'cheer' });
    b.group.position.set(x, 0, z);
    b.group.lookAt(0, 0, 4); group.add(b.group); bots.push(b);
  }

  // lampiões e casas-oficina ao fundo
  for (let k = 0; k < 8; k++) {
    const x = -24 + k * 7, z = -20 - (k % 2) * 4;
    const h = 7 + r() * 5;
    const house = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6), lam({ color: [0xe8c070, 0xb5654a, 0x8a9a8a, 0xc4a888][k % 4] })); house.position.set(x, h / 2, z); house.rotation.z = (r() - 0.5) * 0.05; group.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 3, 4), lam({ color: [0x6fb09c, 0x8e3b2a, 0x5a6473][k % 3] })); roof.position.set(x, h + 1.5, z); roof.rotation.y = Math.PI / 4; group.add(roof);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 8), copper); ch.position.set(x + 1.5, h + 2.5, z); group.add(ch);
    for (let m = 0; m < 2; m++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.2), basic({ color: 0xffd98a })); w.position.set(x - 1.4 + m * 2.8, h * 0.6, z + 3.01); group.add(w); }
  }

  // dirigível com faixa passando lá no alto
  const ship = new THREE.Group(); group.add(ship);
  {
    const env = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 10), phong({ color: 0xc8a878, shininess: 30 })); env.scale.set(2.6, 1, 1); ship.add(env);
    const gond = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 1.4), lam({ color: 0x6b4426 })); gond.position.y = -3.8; ship.add(gond);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), lam({ color: 0xb0322a, side: THREE.DoubleSide })); flag.position.set(-9, -1.5, 0); ship.add(flag);
  }

  let last = 0;
  return (t) => {
    const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    for (const f of anims) f(t);
    for (const b of bots) b.update(t, dt);
    for (const p of puffs) {
      // apito: baforadas fortes de tempos em tempos
      const burst = (t % 3) < 1.2;
      p.t = (p.t + dt * (burst ? 0.9 : 0.2)) % 1;
      p.p.position.set(p.t * 0.6, p.base + p.t * 5, 0); p.p.scale.setScalar(0.6 + p.t * 3); p.p.material.opacity = (burst ? 0.9 : 0.3) * (1 - p.t);
    }
    for (const q of confetti) {
      q.t += dt;
      const tt = q.t % 3;
      q.c.position.set(q.s * 6 + q.vx * tt, 1.8 + q.vy * tt - 4.5 * tt * tt * 0.9, 2.2 + q.vz * tt);
      if (q.c.position.y < 0.05) q.c.position.y = 0.05;
      q.c.rotation.set(t * q.sp, t * q.sp * 0.7, 0);
    }
    const a = t * 0.12;
    ship.position.set(Math.cos(a) * 40, 22, -30 + Math.sin(a) * 12);
    ship.rotation.y = -a - Math.PI / 2;
  };
}
