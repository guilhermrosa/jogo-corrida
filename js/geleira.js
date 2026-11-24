import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { tinBot } from './robots.js';
import { M, add, cyl, gearMesh } from './bolota.js';
import { lam, basic, phong, brickTex, plateTex, boardsTex, puffs, instances, TRS, freeNear } from './kit.js';
import { signTex } from './granja.js';

// =====================================================================
//  SERRA GELADA — a Companhia de Gelo da Serra: as caldeiras do mundo
//  precisam de gelo para esfriar, e ele vem daqui. Depósito no vale,
//  usina frigorífica, teleférico de caixotes de gelo, túnel cavado na
//  geleira, gretas para pular e o lago onde autômatos serram blocos.
// =====================================================================

export function geleira(tr, rnd, H) {
  const m = M(), anims = [], smoke = [], cold = [];
  const iceMat = phong({ color: 0xa8dcf4, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.88 });
  const iceDeep = lam({ color: 0x5a9ac8 });
  const block = new THREE.BoxGeometry(1.6, 1.2, 1.2);

  // ---------------------------------------------------- gretas: paredes de gelo descendo nas duas bordas de cada vão
  const gaps = [];
  for (let i = 0; i < tr.N; i++) if (tr.gap[i] && !tr.gap[tr.wrap(i - 1)]) { let e = i; while (tr.gap[tr.wrap(e + 1)]) e = tr.wrap(e + 1); gaps.push([i, e]); }
  for (const [a, b] of gaps) {
    for (const [i, s] of [[tr.wrap(a - 1), -1], [tr.wrap(b + 1), 1]]) {
      const c = tr.point(i, 0);
      const g = new THREE.Group(); g.position.set(c.x, tr.py[i], c.z); g.rotation.y = tr.heading(i); tr.group.add(g);
      // penhasco de gelo: uma placa larga e funda, com estalactites
      add(g, new THREE.BoxGeometry(EDGE * 2 + 30, 30, 3), iceDeep, 0, -15.2, s * 1.5);
      add(g, new THREE.BoxGeometry(EDGE * 2 + 30, 1.4, 3.4), iceMat, 0, -0.8, s * 1.6);
      for (let k = -6; k <= 6; k++) { const st = add(g, new THREE.ConeGeometry(0.6, 2.4 + rnd() * 2, 5), iceMat, k * 3, -2.6, s * 0.2); st.rotation.x = Math.PI; }
    }
    // no fundo da greta, um brilho azul
    const mid = tr.point(Math.round((a + b) / 2), 0);
    const glow = add(tr.group, new THREE.PlaneGeometry(EDGE * 2 + 30, (b - a + 3) * tr.step), basic({ color: 0x2a6aa0 }), mid.x, tr.py[a] - 24, mid.z);
    glow.rotation.x = -Math.PI / 2; glow.rotation.z = -tr.heading(a);
    // placas de aviso antes do salto
    const i0 = tr.wrap(a - 26);
    for (const s of [1, -1]) {
      const p = tr.point(i0, s * (EDGE + 0.8));
      add(tr.group, new THREE.BoxGeometry(0.25, 3, 0.25), m.iron, p.x, tr.py[i0] + 1.5, p.z);
      const sg = add(tr.group, new THREE.BoxGeometry(3.6, 1.2, 0.2), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('GRETA!') }), m.brass], p.x, tr.py[i0] + 3.4, p.z);
      sg.rotation.y = tr.heading(i0) + Math.PI;
    }
  }

  // ---------------------------------------------------- túnel cavado na geleira, entre as duas gretas
  if (gaps.length >= 2) {
    const t0 = gaps[0][1] + 40, t1 = gaps[1][0] - 50;
    if (t1 - t0 > 40) H.buildTunnel(tr, t0 / tr.N, t1 / tr.N, 'gelo');
  }

  // ---------------------------------------------------- depósito de gelo e usina frigorífica, perto da largada
  const dep = freeNear(tr, tr.px[30] + 0, tr.pz[30] - 40, EDGE + 16, 30);
  if (dep) {
    const g = new THREE.Group(); g.position.copy(dep); tr.group.add(g);
    add(g, new THREE.BoxGeometry(28, 12, 16), lam({ map: boardsTex('#5a6a7a', '#c9d6e6') }), 0, 6, 0);
    add(g, new THREE.CylinderGeometry(0.01, 17, 5, 4, 1), lam({ color: 0xffffff }), 0, 14.5, 0).rotation.y = Math.PI / 4;
    add(g, new THREE.BoxGeometry(22, 2, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('CIA. DE GELO') }), m.brass], 0, 10, 8.2);
    add(g, new THREE.BoxGeometry(8, 7, 0.3), lam({ color: 0x1a2a3a }), 0, 3.5, 8.1);
    // pilhas de blocos de gelo
    const stacks = [];
    for (let k = 0; k < 40; k++) { const x = -12 + (k % 8) * 1.8, z = 11 + Math.floor(k / 8) * 1.4 - 0, y = Math.floor(k / 16) * 1.2; stacks.push(TRS(dep.x + x, dep.y + 0.6 + y, dep.z + z + (k % 2) * 0.1)); }
    instances(tr, block, iceMat, stacks);
    // máquina frigorífica: compressores, canos cobertos de gelo e fumaça fria
    const plant = new THREE.Group(); plant.position.set(22, 0, -2); g.add(plant);
    add(plant, new THREE.BoxGeometry(12, 9, 10), lam({ map: brickTex('#8a8f9a', '#4a4f5a') }), 0, 4.5, 0);
    for (const z of [-3, 0, 3]) { add(plant, cyl(1.4, 1.4, 6, 12), m.copper, 7.4, 3, z).rotation.z = Math.PI / 2; add(plant, cyl(1.55, 1.55, 0.5, 12), iceMat, 10.5, 3, z).rotation.z = Math.PI / 2; }
    add(plant, cyl(0.5, 0.5, 14, 8), iceMat, -4, 9, 4).rotation.x = Math.PI / 2;
    const fly = gearMesh(3, 16, m.brass, 0.6); fly.position.set(-6.4, 5, 0); fly.rotation.y = Math.PI / 2; plant.add(fly);
    anims.push((t) => { fly.rotation.x = t * 1.5; });
    add(plant, cyl(0.8, 1, 10, 10), m.iron, 3, 14, -3);
    smoke.push(new THREE.Vector3(dep.x + 25, dep.y + 19.5, dep.z - 5));
    for (const z of [-3, 0, 3]) cold.push(new THREE.Vector3(dep.x + 33.5, dep.y + 3, dep.z - 2 + z));
    // robôs carregando blocos
    for (let k = 0; k < 3; k++) { const b = tinBot(rnd, { mode: 'carry', color: 0x9aa0a4 }); b.group.position.set(-8 + k * 5, 0, 15); g.add(b.group); anims.push((t, dt) => b.update(t, dt)); }
    tr.landmarks = { ...(tr.landmarks || {}), show: dep.clone() };
  }

  // ---------------------------------------------------- teleférico de caixotes de gelo: do alto da geleira até o depósito
  let top = 0;
  for (let i = 0; i < tr.N; i++) if (tr.py[i] > tr.py[top]) top = i;
  const tside = tr.isFall(top, 1) ? 1 : -1;
  const A = freeNear(tr, tr.point(top, tside * (EDGE + 30)).x, tr.point(top, tside * (EDGE + 30)).z, EDGE + 12, 30);
  if (A && dep) {
    A.y = Math.max(A.y, tr.py[top]);
    const B = dep.clone().add(new THREE.Vector3(-14, 0, -10));
    const pts = [], n = 7;
    for (let k = 0; k <= n; k++) {
      const p = new THREE.Vector3().lerpVectors(A, B, k / n);
      let gy = tr.terrainY(p.x, p.z);
      const near = tr.dist(p.x, p.z);
      if (near.d < EDGE + 2) gy = near.y;          // não plantar torre na pista
      const h = 16 + (k === 0 || k === n ? 0 : 4);
      if (near.d >= EDGE + 2 || k === 0 || k === n) {
        add(tr.group, new THREE.BoxGeometry(1, h, 1), m.iron, p.x, gy + h / 2, p.z);
        add(tr.group, new THREE.BoxGeometry(4, 0.4, 0.6), m.brass, p.x, gy + h, p.z);
      }
      pts.push(new THREE.Vector3(p.x, Math.max(gy + h - 0.4, tr.py[near.i] + 12), p.z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    tr.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineBasicMaterial({ color: 0x2a2624 })));
    // estações nas pontas
    for (const [P, r] of [[A, 1], [B, 0.8]]) {
      const st = new THREE.Group(); st.position.copy(P); tr.group.add(st); st.scale.setScalar(r);
      add(st, new THREE.BoxGeometry(9, 7, 7), lam({ color: 0x8a5a3a }), 0, 3.5, 0);
      add(st, new THREE.ConeGeometry(7, 3, 4), lam({ color: 0xffffff }), 0, 8.5, 0).rotation.y = Math.PI / 4;
      const wheel = gearMesh(3.2, 16, m.brass, 0.5); wheel.position.set(0, 12, 0); wheel.rotation.x = Math.PI / 2; st.add(wheel);
      anims.push((t) => { wheel.rotation.z = t * 0.8; });
      if (P.y > 10) add(st, new THREE.BoxGeometry(10, 30, 8), lam({ color: 0x7d8794 }), 0, -15, 0);
    }
    const crates = Array.from({ length: 6 }, (_, k) => {
      const g = new THREE.Group(); tr.group.add(g);
      add(g, new THREE.BoxGeometry(0.15, 2, 0.15), m.iron, 0, -1, 0);
      add(g, new THREE.BoxGeometry(2.6, 1.6, 2.2), lam({ map: boardsTex('#8a6a3a', '#c9a24a') }), 0, -2.6, 0);
      add(g, new THREE.BoxGeometry(2, 0.9, 1.7), iceMat, 0, -1.4, 0);
      return { g, t: k / 6 };
    });
    anims.push((t, dt) => { for (const c of crates) { c.t = (c.t + dt * 0.012) % 1; c.g.position.copy(curve.getPointAt(c.t)); } });
  }

  // ---------------------------------------------------- lago congelado (caminho alternativo) com serradores autômatos
  const br = tr.branches[0];
  if (br) {
    const mid = br.point(Math.round(br.N / 2), 0);
    let minY = 1e9; for (let i = 0; i < br.N; i++) minY = Math.min(minY, br.py[i]);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(46, 40), phong({ color: 0xc4e8fa, shininess: 140, specular: 0xffffff, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
    lake.rotation.x = -Math.PI / 2; lake.position.set(mid.x, Math.min(minY - 0.12, tr.groundBase + 0.05), mid.z); tr.group.add(lake);
    // buracos de água escura, blocos serrados e autômatos com serras
    const holes = [], cut = [];
    for (let k = 0; k < 40 && holes.length < 6; k++) {
      const a = rnd() * 6.28, r = 14 + rnd() * 26, x = mid.x + Math.cos(a) * r, z = mid.z + Math.sin(a) * r;
      if (tr.dist(x, z).d < EDGE + 5) continue;
      holes.push([x, z]);
      const h = add(tr.group, new THREE.PlaneGeometry(4, 3), basic({ color: 0x1a3a5a }), x, lake.position.y + 0.03, z); h.rotation.x = -Math.PI / 2; h.rotation.z = rnd() * 3;
      for (let q = 0; q < 4; q++) cut.push(TRS(x + 3 + q * 1.8, lake.position.y + 0.6, z + 2, rnd() * 0.3));
      const b = tinBot(rnd, { mode: 'work', color: [0x9aa0a4, 0xb8673a, 0xc9a24a][holes.length % 3] });
      b.group.position.set(x - 2.6, lake.position.y, z); b.group.lookAt(x, lake.position.y, z); tr.group.add(b.group);
      const saw = gearMesh(0.9, 16, m.iron, 0.1); saw.position.set(0, 0.6, 1.4); b.group.add(saw);
      anims.push((t, dt) => { b.update(t, dt); saw.rotation.z = t * 12; });
    }
    instances(tr, block, iceMat, cut);
    const sign = add(tr.group, new THREE.BoxGeometry(7, 1.4, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('LAGO DE GELO') }), m.brass]);
    const sp = br.point(8, 0); sign.position.set(sp.x, br.py[8] + 6.5, sp.z); sign.rotation.y = br.heading(8) + Math.PI;
  }

  // ---------------------------------------------------- caldeiras de aquecimento (vapor quente) e torres de gelo
  for (let k = 0; k < 3; k++) {
    const i = Math.round(((k + 0.2) / 3) * tr.N), s = k % 2 ? 1 : -1;
    const p = tr.point(i, s * (EDGE + 6));
    if (tr.dist(p.x, p.z).d < EDGE + 3 || tr.isFall(i, s)) continue;
    p.y = tr.terrainY(p.x, p.z);
    const g = new THREE.Group(); g.position.copy(p); tr.group.add(g);
    add(g, cyl(2, 2.2, 5, 14), m.copper, 0, 2.5, 0);
    add(g, new THREE.SphereGeometry(2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.brass, 0, 5, 0);
    add(g, cyl(0.4, 0.4, 3, 8), m.iron, 0, 7.5, 0);
    smoke.push(new THREE.Vector3(p.x, p.y + 9, p.z));
  }
  anims.push(puffs(tr, H.SPR, smoke, { color: 0xeeeeee, rate: 0.3, size: 4, rise: 7 }));
  anims.push(puffs(tr, H.SPR, cold, { color: 0xd8f0ff, rate: 0.5, size: 2, rise: -1.5, n: 3, opacity: 0.6 }));
  return anims;
}
