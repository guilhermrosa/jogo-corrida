import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { tinBot, giantBot } from './robots.js';

// =====================================================================
//  Copa Bolota no mundo steampunk: cada pista mantém o tema (campo, praia,
//  neve, lava) e ganha máquinas, autômatos e peças de latão e cobre.
// =====================================================================

const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);
const M = () => ({
  brass: phong({ color: 0xc9a24a, shininess: 70, specular: 0x887755 }),
  copper: phong({ color: 0xb8673a, shininess: 50, specular: 0x553322 }),
  iron: lam({ color: 0x3b3632 }), wood: lam({ color: 0x8a5a34 }), rust: lam({ color: 0x8a4a2a }),
  lamp: basic({ color: 0xffd98a }), verd: lam({ color: 0x6fb09c }), cream: lam({ color: 0xefe2c2 }),
});
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);

function gearMesh(R, T, mat, depth = 0.5) {
  const s = new THREE.Shape();
  for (let k = 0; k < T; k++) {
    const a = (k / T) * Math.PI * 2, st = (Math.PI * 2) / T, P = (aa, rr) => [Math.cos(aa) * rr, Math.sin(aa) * rr];
    if (!k) s.moveTo(...P(a, R * 0.82)); else s.lineTo(...P(a, R * 0.82));
    s.lineTo(...P(a + st * 0.2, R)); s.lineTo(...P(a + st * 0.5, R)); s.lineTo(...P(a + st * 0.7, R * 0.82));
  }
  const h = new THREE.Path(); h.absarc(0, 0, R * 0.3, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

function airship(parent, col, m) {
  const s = new THREE.Group();
  const env = add(s, new THREE.SphereGeometry(5, 18, 12), phong({ color: col, shininess: 30 })); env.scale.set(2.6, 1, 1);
  for (let k = -2; k <= 2; k++) { const b = add(s, new THREE.TorusGeometry(5.02 * Math.sqrt(1 - (k / 2.9) ** 2), 0.12, 4, 20), m.brass, k * 4, 0, 0); b.rotation.y = Math.PI / 2; }
  for (const rz of [0, Math.PI / 2]) { const f = add(s, new THREE.BoxGeometry(3, 4.5, 0.2), lam({ color: 0x8e3b2a }), -12); f.rotation.x = rz; }
  add(s, new THREE.BoxGeometry(7, 2, 2.4), lam({ color: 0x6b4426 }), 0, -6.4, 0);
  const prop = new THREE.Group(); prop.position.set(-4, -6.4, 0); s.add(prop);
  for (let k = 0; k < 3; k++) { const b = add(prop, new THREE.BoxGeometry(0.15, 2.6, 0.4), m.brass); b.rotation.x = (k / 3) * Math.PI * 2; }
  s.userData.prop = prop;
  parent.add(s);
  return s;
}

// torcida de robôs na largada e robozinhos trabalhando na beira da pista
export function robotCrew(tr, rnd, H, { workers = 8, color } = {}) {
  const N = tr.N, bots = [];
  const side = -H.sideWithRoom(tr, 12);
  for (let k = 0; k < 6; k++) {
    const i = (N - 8 + k * 5) % N;
    if (tr.isFall(i, side) || tr.bridge[i]) continue;
    const p = tr.point(i, side * (EDGE + 2.4 + (k % 2) * 1.6)); p.y = Math.max(tr.terrainY(p.x, p.z), tr.py[i] - 0.2);
    const b = tinBot(rnd, { mode: 'cheer', color });
    b.group.position.copy(p); b.group.rotation.y = Math.atan2(side * tr.tz[i], -side * tr.tx[i]); tr.group.add(b.group); bots.push(b);
  }
  for (let t = 0, made = 0; t < 300 && made < workers; t++) {
    const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
    if (tr.bridge[i] || tr.isFall(i, s) || tr.inTunnel?.(i)) continue;
    const p = tr.point(i, s * (EDGE + 2.5 + rnd() * 5));
    if (tr.dist(p.x, p.z).d < EDGE + 1.8) continue;
    if (tr.water && tr.water.some(([x, z, w, d]) => p.x > x - 2 && p.x < x + w + 2 && p.z > z - 2 && p.z < z + d + 2)) continue;
    p.y = tr.terrainY(p.x, p.z);
    if (tr.def.lava) p.y = tr.py[i] - 0.1;
    made++;
    const b = tinBot(rnd, { mode: ['work', 'walk', 'cheer', 'carry'][made % 4], color });
    b.group.position.copy(p); b.group.rotation.y = Math.atan2(s * tr.tz[i], -s * tr.tx[i]); tr.group.add(b.group); bots.push(b);
  }
  return (t, dt) => { for (const b of bots) b.update(t, dt); };
}

// ---------------------------------------------------------------- CAMPOS BOLOTA
export function camposSteam(tr, rnd, H) {
  const m = M(), anims = [], c = tr.center;
  // dirigível no lugar do balão de ar quente
  const ship = airship(tr.group, 0xc8a878, m);
  anims.push((t) => { ship.position.set(c.x + Math.cos(t * 0.05) * 80, 52 + Math.sin(t * 0.6) * 2, c.z + Math.sin(t * 0.05) * 55); ship.rotation.y = -t * 0.05 - Math.PI / 2; ship.userData.prop.rotation.x += 0.15; });
  // trator a vapor dando voltas pelo campo
  const at = H.findPlace(tr, rnd, 30, 70);
  if (at) {
    tr.landmarks = { ...(tr.landmarks || {}), show: at.clone() };
    const g = new THREE.Group(); tr.group.add(g);
    add(g, new THREE.BoxGeometry(2.2, 1.4, 4), lam({ color: 0x2f6a5a }), 0, 1.6, 0);
    add(g, cyl(0.9, 0.9, 3.2, 12), m.copper, 0, 2.2, 0.8).rotation.x = Math.PI / 2;
    add(g, cyl(0.25, 0.3, 2.2, 8), m.iron, 0, 3.6, 1.8);
    for (const s of [1, -1]) {
      const back = add(g, cyl(1.4, 1.4, 0.6, 14), m.iron, s * 1.4, 1.4, -1.2); back.rotation.z = Math.PI / 2;
      const front = add(g, cyl(0.7, 0.7, 0.5, 12), m.iron, s * 1.2, 0.7, 1.6); front.rotation.z = Math.PI / 2;
    }
    const driver = tinBot(rnd, { mode: 'cheer' }); driver.group.scale.setScalar(0.7); driver.group.position.set(0, 1.6, -1.2); g.add(driver.group);
    const puff = H.SPR.fumaca();
    const puffs = Array.from({ length: 5 }, (_, k) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, color: 0xdddddd })); tr.group.add(s); return { s, t: k / 5 }; });
    anims.push((t, dt) => {
      const a = t * 0.12;
      g.position.set(at.x + Math.cos(a) * 16, tr.terrainY(at.x + Math.cos(a) * 16, at.z + Math.sin(a) * 10), at.z + Math.sin(a) * 10);
      g.rotation.y = Math.atan2(-Math.sin(a) * 16, Math.cos(a) * 10);
      driver.update(t, dt);
      const top = new THREE.Vector3(0, 4.8, 1.8).applyQuaternion(g.quaternion).add(g.position);
      for (const p of puffs) { p.t = (p.t + dt * 0.5) % 1; p.s.position.set(top.x, top.y + p.t * 4, top.z); p.s.scale.setScalar(0.6 + p.t * 2.5); p.s.material.opacity = 0.7 * (1 - p.t); }
    });
  }
  // irrigação: cano de cobre com aspersores girando
  const ir = H.findPlace(tr, rnd, 20, 50);
  if (ir) {
    const g = new THREE.Group(); g.position.copy(ir); g.rotation.y = rnd() * 3; tr.group.add(g);
    add(g, cyl(0.3, 0.3, 30, 8), m.copper, 0, 0.6, 0).rotation.z = Math.PI / 2;
    for (let k = -2; k <= 2; k++) {
      add(g, cyl(0.12, 0.12, 2, 6), m.brass, k * 6, 1.6, 0);
      const head = new THREE.Group(); head.position.set(k * 6, 2.7, 0); g.add(head);
      for (const s of [1, -1]) add(head, new THREE.BoxGeometry(2.2, 0.12, 0.12), m.brass, s * 1.1, 0, 0);
      anims.push((t) => { head.rotation.y = t * 2 + k; });
    }
  }
  return anims;
}

// ---------------------------------------------------------------- PRAIA DO COQUEIRO
export function praiaSteam(tr, rnd, H) {
  const m = M(), anims = [];
  // sino de mergulho de latão boiando no mar, com vigias
  const sea = tr.water ? tr.water[0] : null;
  if (sea) {
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group(); g.position.set(tr.center.x + (k ? 70 : -60), 0.1, sea[1] + 50 + k * 30); tr.group.add(g);
      if (!k) tr.landmarks = { ...(tr.landmarks || {}), show: g.position.clone() };
      add(g, new THREE.SphereGeometry(3, 16, 12), m.brass, 0, 1, 0);
      for (let a = 0; a < 4; a++) { const w = add(g, new THREE.CircleGeometry(0.7, 12), m.lamp, Math.cos(a * 1.57) * 3.02, 1.4, Math.sin(a * 1.57) * 3.02); w.lookAt(g.position.x + Math.cos(a * 1.57) * 10, 1.4, g.position.z + Math.sin(a * 1.57) * 10); }
      add(g, cyl(0.15, 0.15, 3, 6), m.iron, 0, 4.5, 0);
      const ph = rnd() * 6;
      anims.push((t) => { g.position.y = 0.1 + Math.sin(t * 1.1 + ph) * 0.3; g.rotation.z = Math.sin(t * 0.8 + ph) * 0.06; });
    }
    // boias-sino de cobre
    for (let k = 0; k < 6; k++) {
      const g = new THREE.Group(); g.position.set(tr.center.x + (rnd() - 0.5) * 300, 0.1, sea[1] + 15 + rnd() * 60); tr.group.add(g);
      add(g, cyl(0.9, 1.2, 1.4, 10), m.copper, 0, 0.5, 0);
      add(g, cyl(0.1, 0.1, 2.6, 6), m.iron, 0, 2.2, 0);
      add(g, new THREE.ConeGeometry(0.5, 0.7, 10, 1, true), m.brass, 0, 3.4, 0);
      add(g, new THREE.SphereGeometry(0.22, 8, 6), basic({ color: 0xff6040 }), 0, 3.9, 0);
      const ph = rnd() * 6;
      anims.push((t) => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.15; g.rotation.x = Math.cos(t + ph) * 0.1; });
    }
  }
  // salva-vidas robô numa cadeira alta, e robozinhos tomando sol
  const at = H.findPlace(tr, rnd, 10, 30, (p) => p.z > 40);
  if (at) {
    const g = new THREE.Group(); g.position.copy(at); tr.group.add(g);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, cyl(0.12, 0.12, 4, 6), m.wood, x, 2, z);
    add(g, new THREE.BoxGeometry(2.6, 0.3, 2.6), m.wood, 0, 4, 0);
    add(g, cyl(0.1, 0.1, 4, 6), m.iron, 1.2, 6, 1.2);
    add(g, new THREE.PlaneGeometry(2, 1.2), lam({ color: 0xb0322a, side: THREE.DoubleSide }), 2.2, 7.4, 1.2);
    const b = tinBot(rnd, { mode: 'cheer' }); b.group.position.y = 4.15; g.add(b.group);
    g.lookAt(tr.center.x, at.y, tr.center.z + 200);
    anims.push((t, dt) => b.update(t, dt));
  }
  return anims;
}

// ---------------------------------------------------------------- SERRA GELADA
export function serraSteam(tr, rnd, H) {
  const m = M(), anims = [];
  // robôs da neve de cachecol e o removedor de neve a vapor
  const cols = [0xb0322a, 0x2f6a5a, 0xe8a221];
  for (let k = 0; k < 6; k++) {
    const at = H.findPlace(tr, rnd, EDGE + 4, 30);
    if (!at) continue;
    const b = tinBot(rnd, { mode: k % 2 ? 'work' : 'walk', color: 0x9aa0a4 });
    const scarf = add(b.group, new THREE.TorusGeometry(0.66, 0.16, 6, 14), lam({ color: cols[k % 3] }), 0, 2.05, 0); scarf.rotation.x = Math.PI / 2;
    const cap = add(b.group, new THREE.SphereGeometry(0.58, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam({ color: 0xffffff }), 0, 2.7, 0); cap.scale.y = 0.4;
    b.group.position.copy(at); b.group.rotation.y = rnd() * 6; tr.group.add(b.group);
    anims.push((t, dt) => b.update(t, dt));
  }
  // estação do teleférico: roda de polia gigante e casa de máquinas
  const at = H.findPlace(tr, rnd, 25, 60);
  if (at) {
    tr.landmarks = { ...(tr.landmarks || {}), show: at.clone() };
    const g = new THREE.Group(); g.position.copy(at); tr.group.add(g);
    add(g, new THREE.BoxGeometry(11, 10, 9), lam({ color: 0x7d8794 }), 0, -5, 0); // base de pedra na encosta
    add(g, new THREE.BoxGeometry(10, 6, 8), lam({ color: 0x8a5a3a }), 0, 3, 0);
    add(g, new THREE.ConeGeometry(8, 3.4, 4), lam({ color: 0xffffff }), 0, 7.7, 0).rotation.y = Math.PI / 4;
    for (const s of [1, -1]) add(g, cyl(0.5, 0.6, 5, 10), m.copper, s * 3, 9, -2);
    const wheel = gearMesh(4, 18, m.brass, 0.6); wheel.position.set(0, 8, 4.4); g.add(wheel);
    anims.push((t) => { wheel.rotation.z = t * 0.6; });
    for (let k = 0; k < 3; k++) add(g, new THREE.PlaneGeometry(1.4, 1.2), m.lamp, -3 + k * 3, 3.4, 4.01);
  }
  // canos de aquecimento soltando vapor na beira da pista
  const vents = [];
  for (let i = 30; i < tr.N; i += 140) {
    const s = (i / 140) % 2 < 1 ? 1 : -1;
    if (tr.isFall(i, s) || tr.inTunnel?.(i)) continue;
    const p = tr.point(i, s * (EDGE + 2)); p.y = tr.terrainY(p.x, p.z);
    const g = new THREE.Group(); g.position.copy(p); tr.group.add(g);
    add(g, cyl(0.45, 0.45, 3.2, 10), m.copper, 0, 1.6, 0);
    add(g, cyl(0.6, 0.6, 0.3, 10), m.brass, 0, 3.2, 0);
    const wheel = add(g, new THREE.TorusGeometry(0.5, 0.08, 4, 10), lam({ color: 0xb0322a }), 0.55, 2, 0); wheel.rotation.y = Math.PI / 2;
    vents.push(new THREE.Vector3(p.x, p.y + 3.4, p.z));
  }
  const puff = H.SPR.fumaca();
  const ps = [];
  for (const v of vents) for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, color: 0xffffff })); tr.group.add(s); ps.push({ s, v, t: k / 4 }); }
  anims.push((t, dt) => { for (const p of ps) { p.t = (p.t + dt * 0.4) % 1; p.s.position.set(p.v.x, p.v.y + p.t * 4, p.v.z); p.s.scale.setScalar(0.6 + p.t * 3); p.s.material.opacity = 0.8 * (1 - p.t); } });
  return anims;
}

// ---------------------------------------------------------------- VULCÃO OITO (fundição)
export function vulcaoSteam(tr, rnd, H) {
  const m = M(), anims = [];
  const glow = basic({ color: 0xff7a1a });
  // martelos-pilão batendo ao lado da pista
  for (let k = 0; k < 4; k++) {
    const i = Math.round(((k + 0.5) / 4) * tr.N) % tr.N, s = k % 2 ? 1 : -1;
    const p = tr.point(i, s * (EDGE + 4)); p.y = tr.py[i];
    if (tr.dist(p.x, p.z).d < EDGE + 2) continue;
    const g = new THREE.Group(); g.position.copy(p); g.rotation.y = tr.heading(i); tr.group.add(g);
    add(g, new THREE.BoxGeometry(5, 1, 5), m.iron, 0, -0.5 - 3, 0).scale.y = 1;
    add(g, cyl(0.7, 0.9, 8, 8), m.iron, 0, -4, 0);
    for (const x of [-2, 2]) add(g, new THREE.BoxGeometry(0.6, 12, 0.6), m.iron, x, 6, 0);
    add(g, new THREE.BoxGeometry(5, 1, 1.2), m.brass, 0, 12, 0);
    add(g, new THREE.BoxGeometry(3, 1, 3), glow, 0, 0.5, 0);
    const ham = add(g, new THREE.BoxGeometry(3.2, 2.4, 2.4), m.rust, 0, 6, 0);
    add(g, cyl(0.6, 0.6, 3, 10), m.copper, 2.6, 9, 0);
    const ph = k * 1.3;
    anims.push((t) => { const u = (t * 0.7 + ph) % 1; ham.position.y = u < 0.15 ? 9 - (u / 0.15) * 7.2 : 1.8 + ((u - 0.15) / 0.85) * 7.2; });
  }
  // cadinho gigante derramando metal derretido
  const at = H.findPlace(tr, rnd, 30, 70, null, true);
  if (at) {
    tr.landmarks = { ...(tr.landmarks || {}), show: new THREE.Vector3(at.x, 10, at.z) };
    const g = new THREE.Group(); g.position.set(at.x, 0, at.z); tr.group.add(g);
    for (const s of [1, -1]) add(g, new THREE.BoxGeometry(1.4, 24, 1.4), m.iron, s * 8, 12, 0);
    add(g, new THREE.BoxGeometry(18, 1.4, 2), m.brass, 0, 24, 0);
    const pot = new THREE.Group(); pot.position.y = 18; g.add(pot);
    add(pot, new THREE.CylinderGeometry(4, 3, 5, 16, 1, true), lam({ color: 0x5a3a2a, side: THREE.DoubleSide }));
    add(pot, new THREE.CircleGeometry(3.8, 16), glow, 0, 1.8, 0).rotation.x = -Math.PI / 2;
    const stream = add(g, cyl(0.6, 0.9, 18, 8), basic({ color: 0xffa020 }), 4.2, 9, 0);
    const gears = [];
    for (const s of [1, -1]) { const gm = gearMesh(2.4, 12, m.copper, 0.5); gm.position.set(s * 8.8, 18, 0); gm.rotation.y = Math.PI / 2; g.add(gm); gears.push(gm); }
    anims.push((t) => { for (const gm of gears) gm.rotation.x = Math.sin(t * 0.4) * 0.6; });
    anims.push((t) => { const tip = Math.max(0, Math.sin(t * 0.4)); pot.rotation.z = -tip * 0.6; stream.visible = tip > 0.6; stream.scale.x = stream.scale.z = 0.6 + Math.sin(t * 9) * 0.1; });
  }
  // canos de vapor e robôs de ferro (escuros, à prova de fogo)
  return anims;
}

// ---------------------------------------------------------------- kit comum: lampiões a gás e pórticos de canos de vapor
export function steamKit(tr, rnd, H) {
  const m = M(), anims = [], N = tr.N;
  // lampiões de latão, alternando os lados
  const spots = [];
  for (let i = 6; i < N; i += 26) {
    const s = (Math.floor(i / 26) % 2) ? 1 : -1;
    if (tr.isFall(i, s) || tr.inTunnel?.(i)) continue;
    const p = tr.point(i, s * (EDGE + 1.2)); p.y = tr.py[i];
    if (tr.dist(p.x, p.z).d < EDGE + 0.8) continue;
    spots.push(p);
  }
  const inst = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, spots.length); spots.forEach((p, n) => im.setMatrixAt(n, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); tr.group.add(im); };
  const post = cyl(0.12, 0.2, 5, 6); post.translate(0, 2.5, 0);
  inst(post, m.iron);
  const head = new THREE.BoxGeometry(0.6, 0.85, 0.6); head.translate(0, 5.4, 0); inst(head, m.lamp);
  const cap = new THREE.ConeGeometry(0.55, 0.5, 4); cap.rotateY(Math.PI / 4); cap.translate(0, 6.05, 0); inst(cap, m.brass);
  const ring = new THREE.TorusGeometry(0.42, 0.06, 4, 10); ring.rotateX(Math.PI / 2); ring.translate(0, 4.95, 0); inst(ring, m.brass);
  // pórticos de canos atravessando a pista, soltando vapor
  const vents = [];
  for (const f of [0.33, 0.72]) {
    let i = Math.round(f * N);
    for (let t = 0; t < 50 && (tr.curv[i] > 0.35 || tr.bridge[i] || tr.inTunnel?.(i) || tr.isFall(i, 1) || tr.isFall(i, -1)); t++) i = (i + 3) % N;
    const g = new THREE.Group(); tr.point(i, 0, g.position); g.position.y = tr.py[i]; g.rotation.y = tr.heading(i); tr.group.add(g);
    const span = (EDGE + 2) * 2;
    for (const s of [1, -1]) { add(g, new THREE.BoxGeometry(1, 9.5, 1), m.copper, s * (EDGE + 2), 4.75, 0); add(g, new THREE.BoxGeometry(1.3, 0.3, 1.3), m.brass, s * (EDGE + 2), 9.4, 0); }
    add(g, cyl(0.55, 0.55, span + 1.5, 10), m.copper, 0, 8.4, 0).rotation.z = Math.PI / 2;
    add(g, cyl(0.35, 0.35, span + 1.5, 10), m.brass, 0, 9.4, 0.9).rotation.z = Math.PI / 2;
    for (const x of [-span / 3, span / 3]) add(g, cyl(0.8, 0.8, 0.3, 10), m.brass, x, 8.4, 0).rotation.z = Math.PI / 2;
    const gear = gearMesh(1.6, 12, m.brass, 0.4); gear.position.set(EDGE + 2, 7, 0.8); g.add(gear);
    anims.push((t) => { gear.rotation.z = t; });
    add(g, new THREE.TorusGeometry(0.9, 0.14, 6, 14), lam({ color: 0xb0322a }), -3, 7.2, 0).rotation.x = Math.PI / 2;
    vents.push(new THREE.Vector3(2, 8.9, 0).applyEuler(g.rotation).add(g.position));
  }
  const puff = H.SPR.fumaca();
  const ps = [];
  for (const v of vents) for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, color: 0xffffff })); tr.group.add(s); ps.push({ s, v, t: k / 5 }); }
  anims.push((t, dt) => {
    const burst = (t % 4) < 1.6;
    for (const p of ps) { p.t = (p.t + dt * (burst ? 0.9 : 0.25)) % 1; p.s.position.set(p.v.x, p.v.y + p.t * 4, p.v.z); p.s.scale.setScalar(0.6 + p.t * 3); p.s.material.opacity = (burst ? 0.85 : 0.35) * (1 - p.t); }
  });
  return anims;
}
