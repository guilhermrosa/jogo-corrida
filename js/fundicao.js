import * as THREE from 'three';
import { EDGE } from './data.js';
import { tinBot } from './robots.js';
import { M, add, cyl, gearMesh } from './bolota.js';
import { lam, basic, phong, shed, brickTex, plateTex, puffs, instances, TRS, freeNear, MX } from './kit.js';
import { signTex } from './granja.js';

// =====================================================================
//  FUNDIÇÃO DO VULCÃO — a fundição que usa o calor do vulcão: galpão de
//  fundição com ponte rolante e caçamba, passarela sem muretas por cima do
//  poço de metal derretido, monte de escória com rampa, chaminés de tijolo
//  e vagonetes de minério dando voltas.
// =====================================================================

export function fundicao(tr, rnd, H) {
  const m = M(), anims = [], smoke = [];
  const X = (x) => MX(tr, x);
  const molten = basic({ color: 0xffa020 });
  const hot = basic({ color: 0xff5a10 });

  // ---------------------------------------------------- galpão de fundição sobre a reta oeste
  const i0 = tr.nearestGlobal(X(-136), -18), i1 = tr.nearestGlobal(X(-90), -12);
  if (i1 > i0 + 20) {
    shed(tr, tr, i0, i1, { wall: brickTex('#6a3a2a', '#2a1a14'), roof: 0x3b3632, h: 10, ridge: 3, lampColor: 0xff9a40 });
    // ponte rolante com caçamba de metal derretido indo e voltando
    const a = tr.point(i0 + 6, 0), b = tr.point(i1 - 6, 0), y = Math.max(tr.py[i0], tr.py[i1]) + 9;
    const crane = new THREE.Group(); tr.group.add(crane);
    add(crane, new THREE.BoxGeometry((EDGE + 0.6) * 2, 0.8, 1), m.brass);
    const ladle = new THREE.Group(); ladle.position.y = -3.4; crane.add(ladle);
    add(ladle, new THREE.CylinderGeometry(1.4, 1, 2, 12, 1, true), lam({ color: 0x3a2a22, side: THREE.DoubleSide }));
    add(ladle, new THREE.CircleGeometry(1.3, 12), molten, 0, 0.8, 0).rotation.x = -Math.PI / 2;
    for (const s of [1, -1]) add(ladle, new THREE.BoxGeometry(0.1, 3, 0.1), m.iron, s * 1.3, 1.6, 0);
    const yaw = tr.heading(i0);
    crane.rotation.y = yaw;
    anims.push((t) => { const u = (Math.sin(t * 0.25) + 1) / 2; crane.position.set(a.x + (b.x - a.x) * u, y, a.z + (b.z - a.z) * u); ladle.rotation.z = Math.sin(t * 1.3) * 0.08; });
    // moldes incandescentes no chão, dos dois lados
    const molds = [];
    for (let i = i0 + 4; i < i1 - 2; i += 6) for (const s of [1, -1]) { const p = tr.point(i, s * (EDGE - 0.2)); molds.push(TRS(p.x, tr.py[i] + 0.15, p.z, tr.heading(i))); }
    instances(tr, new THREE.BoxGeometry(1.2, 0.3, 2.2), hot, molds);
    const e = tr.point(i0, 0);
    const sg = add(tr.group, new THREE.BoxGeometry(9, 1.6, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('FUNDICAO') }), m.brass], e.x, tr.py[i0] + 11.6, e.z);
    sg.rotation.y = tr.heading(i0) + Math.PI;
  }

  // ---------------------------------------------------- poço de metal derretido embaixo da passarela
  const cat = tr.branches[0];
  if (cat) {
    const mid = cat.point(Math.round(cat.N * 0.5), 0);
    const pool = add(tr.group, new THREE.CircleGeometry(34, 30), molten, mid.x, -0.45, mid.z); pool.rotation.x = -Math.PI / 2;
    const rim = add(tr.group, new THREE.TorusGeometry(34, 1.4, 6, 30), lam({ color: 0x2a1e1c }), mid.x, -0.4, mid.z); rim.rotation.x = Math.PI / 2;
    pool.material = basic({ color: 0xff8a10 });
    anims.push((t) => { pool.material.color.setHSL(0.07 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 3) * 0.03); });
    // postinhos de ferro com lampiões (sem mureta) ao longo da passarela
    const posts = [], lamps = [];
    for (let i = 8; i < cat.N - 8; i += 6) for (const s of [1, -1]) { const p = cat.point(i, s * (EDGE - 0.3)); posts.push(TRS(p.x, cat.py[i], p.z)); if (i % 18 === 8) lamps.push(TRS(p.x, cat.py[i] + 2.2, p.z)); }
    const pg = cyl(0.08, 0.1, 2.2, 6); pg.translate(0, 1.1, 0); instances(tr, pg, m.iron, posts);
    instances(tr, new THREE.SphereGeometry(0.25, 6, 5), basic({ color: 0xffd98a }), lamps);
    const sg = add(tr.group, new THREE.BoxGeometry(8, 1.4, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('SEM MURETA!') }), m.brass]);
    const sp = cat.point(4, 0); sg.position.set(sp.x, cat.py[4] + 6, sp.z); sg.rotation.y = cat.heading(4) + Math.PI;
    for (const s of [1, -1]) { const pp = cat.point(4, s * 4); add(tr.group, new THREE.BoxGeometry(0.3, 6, 0.3), m.iron, pp.x, cat.py[4] + 3, pp.z); }
  }

  // ---------------------------------------------------- monte de escória com a rampa, e o canal de lava embaixo do salto
  const ramp = tr.branches[1];
  if (ramp) {
    const rocks = [];
    for (let i = Math.round(ramp.N * 0.45); i < ramp.N; i += 3) for (const s of [1, -1]) {
      const p = ramp.point(i, s * (EDGE + 2 + rnd() * 4));
      if (tr.dist(p.x, p.z).d < EDGE + 1) continue;
      rocks.push(TRS(p.x, ramp.py[i] - 2.5 - rnd() * 2, p.z, rnd() * 6, 2.5 + rnd() * 2));
    }
    instances(tr, new THREE.DodecahedronGeometry(1, 0), lam({ color: 0x2a2220, flatShading: true }), rocks);
    const end = ramp.point(ramp.N - 1, 0), land = tr.point(ramp.ib, 0);
    const ch = add(tr.group, new THREE.PlaneGeometry(14, 60), molten, (end.x + land.x) / 2, -0.4, (end.z + land.z) / 2);
    ch.rotation.x = -Math.PI / 2; ch.rotation.z = Math.atan2(land.x - end.x, land.z - end.z) + Math.PI / 2;
    const sg = add(tr.group, new THREE.BoxGeometry(7, 1.4, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('ESCORIA') }), m.brass]);
    const sp = ramp.point(10, 0); sg.position.set(sp.x, ramp.py[10] + 6, sp.z); sg.rotation.y = ramp.heading(10) + Math.PI;
    for (const s of [1, -1]) { const pp = ramp.point(10, s * 3.4); add(tr.group, new THREE.BoxGeometry(0.3, 6, 0.3), m.iron, pp.x, ramp.py[10] + 3, pp.z); }
    tr.landmarks = { ...(tr.landmarks || {}), show: end.clone() };
  }

  // ---------------------------------------------------- chaminés de tijolo soltando fumaça escura
  const bt = brickTex('#7a3a2a', '#3a1a14'); bt.repeat.set(2, 6);
  for (let k = 0; k < 6; k++) {
    const p = H.findPlace(tr, rnd, 25, 70, null, true);
    if (!p) continue;
    const h = 30 + rnd() * 16;
    add(tr.group, new THREE.CylinderGeometry(2.2, 3.4, h, 10), lam({ map: bt }), p.x, h / 2 - 1, p.z);
    add(tr.group, cyl(2.6, 2.6, 1, 10), m.iron, p.x, h - 1, p.z);
    smoke.push(new THREE.Vector3(p.x, h, p.z));
  }

  // ---------------------------------------------------- trilho com vagonetes de minério incandescente
  const c = tr.center, R = 230;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.4, 4, 120), m.iron); rail.rotation.x = Math.PI / 2; rail.position.set(c.x, 1.2, c.z); tr.group.add(rail);
  const carts = Array.from({ length: 8 }, (_, k) => {
    const g = new THREE.Group(); tr.group.add(g);
    add(g, new THREE.BoxGeometry(3, 1.8, 2), m.rust, 0, 2.3, 0);
    add(g, new THREE.BoxGeometry(2.6, 0.5, 1.6), hot, 0, 3.3, 0);
    return { g, a: (k / 8) * Math.PI * 2 };
  });
  anims.push((t) => { for (const cr of carts) { const a = cr.a + t * 0.04; cr.g.position.set(c.x + Math.cos(a) * R, 0, c.z + Math.sin(a) * R); cr.g.rotation.y = -a; } });

  // ---------------------------------------------------- operários de ferro
  for (let k = 0; k < 4; k++) {
    const p = H.findPlace(tr, rnd, 8, 20, null, true);
    if (!p) continue;
    const i = tr.dist(p.x, p.z).i;
    p.y = tr.py[i] - 0.1;
    const b = tinBot(rnd, { mode: k % 2 ? 'work' : 'carry', color: 0x4a4440 });
    b.group.position.copy(p); tr.group.add(b.group);
    anims.push((t, dt) => b.update(t, dt));
  }

  anims.push(puffs(tr, H.SPR, smoke, { color: 0x4a4040, rate: 0.2, size: 7, rise: 14, opacity: 0.7 }));
  return anims;
}
