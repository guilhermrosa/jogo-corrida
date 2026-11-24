import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { tinBot } from './robots.js';
import { M, add, cyl, gearMesh } from './bolota.js';
import { lam, basic, phong, shed, boardsTex, brickTex, plateTex, puffs, instances, TRS, freeNear, MX } from './kit.js';

// =====================================================================
//  FAZENDA DOS SILOS — a cooperativa que colhe, debulha e ensaca bolotas a vapor.
//  Silos de cobre e uma esteira de caçambas por cima da largada, o celeiro-
//  debulhadora (caminho alternativo por dentro), o viaduto de madeira e ferro,
//  o moinho de latão, a colheitadeira a vapor e o pomar de carvalhos.
// =====================================================================

function oakGeo() {
  const parts = [];
  const tint = (g, c) => { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  parts.push(tint(new THREE.CylinderGeometry(0.45, 0.7, 4, 6).translate(0, 2, 0).toNonIndexed(), 0x5a3a22));
  parts.push(tint(new THREE.IcosahedronGeometry(3.2, 0).translate(0, 5.6, 0).toNonIndexed(), 0x3f7a2e));
  parts.push(tint(new THREE.IcosahedronGeometry(2.2, 0).translate(1.8, 6.8, 0.6).toNonIndexed(), 0x4f8e34));
  parts.push(tint(new THREE.IcosahedronGeometry(2, 0).translate(-1.6, 6.4, -0.8).toNonIndexed(), 0x467f30));
  return mergeGeometries(parts);
}

export function granja(tr, rnd, H) {
  const m = M(), anims = [];
  const P = (x, z) => new THREE.Vector3(MX(tr, x), 0, z);
  const smoke = [];

  // ---------------------------------------------------- celeiro-debulhadora por cima do caminho alternativo
  const br = tr.branches[0];
  if (br) {
    const i0 = Math.round(br.N * 0.3), i1 = Math.round(br.N * 0.72);
    shed(tr, br, i0, i1, { wall: boardsTex('#9a3426', '#efe2c2'), roof: 0x5f9a88, h: 8.5, ridge: 3.5 });
    // tambor debulhador girando no teto e bolotas passando numa esteira
    const mid = Math.round((i0 + i1) / 2), c = br.point(mid, 0);
    const hold = new THREE.Group(); hold.position.set(c.x, br.py[mid] + 6.6, c.z); hold.rotation.y = br.heading(mid); tr.group.add(hold);
    const drum = new THREE.Group(); hold.add(drum);
    const d = add(drum, cyl(1.1, 1.1, EDGE * 2 - 1, 14), m.brass); d.rotation.z = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const rib = add(drum, new THREE.BoxGeometry(EDGE * 2 - 1, 0.25, 0.4), m.iron); rib.position.set(0, Math.cos(k) * 1.15, Math.sin(k) * 1.15); rib.rotation.x = k; }
    anims.push((t) => { drum.rotation.x = t * 3; });
    const nutGeo = new THREE.SphereGeometry(0.35, 6, 5); nutGeo.scale(1, 1.3, 1);
    const nuts = new THREE.InstancedMesh(nutGeo, lam({ color: 0xb87a3e }), 30); tr.group.add(nuts);
    const belt = (k) => { const u = k % 1, i = i0 + 2 + u * (i1 - i0 - 4); const j = Math.floor(i); return br.point(j, -EDGE + 1.2).setY(br.py[j] + 5.2); };
    const mtx = new THREE.Matrix4();
    anims.push((t) => { for (let n = 0; n < 30; n++) { const v = belt(n / 30 + t * 0.05); nuts.setMatrixAt(n, mtx.makeTranslation(v.x, v.y, v.z)); } nuts.instanceMatrix.needsUpdate = true; });
    // placa
    const sign = add(tr.group, new THREE.BoxGeometry(8, 1.6, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('DEBULHADORA') }), m.brass]);
    const e = br.point(i0, 0); sign.position.set(e.x, br.py[i0] + 9.4, e.z); sign.rotation.y = br.heading(i0) + Math.PI;
  }

  // ---------------------------------------------------- silos de cobre com esteira de caçambas por cima da largada
  const silo = freeNear(tr, MX(tr, -72), -54, EDGE + 18);
  const mill = freeNear(tr, MX(tr, -62), 40, EDGE + 14);
  if (silo) {
    const g = new THREE.Group(); g.position.copy(silo); tr.group.add(g);
    const pl = plateTex('#a8603a', '#e0bd6a'); pl.repeat.set(3, 4);
    const sm = phong({ map: pl, shininess: 40 });
    const spots = [[0, 0], [11, 2], [-10, 4], [2, -11]];
    spots.forEach(([x, z], n) => {
      const h = 20 + n * 2;
      add(g, cyl(4.6, 4.6, h, 18), sm, x, h / 2, z);
      add(g, new THREE.ConeGeometry(5, 3.4, 18), m.verd, x, h + 1.7, z);
      for (let b = 1; b < 4; b++) add(g, cyl(4.72, 4.72, 0.35, 18), m.brass, x, (h * b) / 4, z);
      add(g, cyl(0.5, 0.5, 2, 8), m.copper, x, h + 4, z);
      smoke.push(new THREE.Vector3(silo.x + x, silo.y + h + 5, silo.z + z));
    });
    add(g, new THREE.BoxGeometry(24, 0.5, 2), m.iron, 0.5, 22.5, 1);   // passarela no topo
    // casa da fazenda com chaminé
    const house = new THREE.Group(); house.position.set(-22, 0, -6); g.add(house);
    add(house, new THREE.BoxGeometry(10, 6, 8), lam({ map: brickTex('#b5654a') }), 0, 3, 0);
    const roof = add(house, new THREE.CylinderGeometry(0.01, 7.4, 4, 4, 1), m.verd, 0, 8, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, 0.9);
    add(house, cyl(0.6, 0.6, 4, 8), m.copper, 3, 9, 0);
    smoke.push(new THREE.Vector3(silo.x - 22 + 3, silo.y + 11.5, silo.z - 6));
  }
  if (silo && mill) {
    // beneficiadora (onde as bolotas viram farinha) do outro lado da pista
    const g = new THREE.Group(); g.position.copy(mill); tr.group.add(g);
    add(g, new THREE.BoxGeometry(14, 10, 12), lam({ map: brickTex('#a0563a') }), 0, 5, 0);
    add(g, new THREE.BoxGeometry(15, 1, 13), m.verd, 0, 10.5, 0);
    add(g, new THREE.BoxGeometry(4, 6, 4), m.copper, 0, 14, 0);                  // funil
    const wheel = gearMesh(3, 14, m.brass, 0.5); wheel.position.set(7.4, 6, 0); wheel.rotation.y = Math.PI / 2; g.add(wheel);
    anims.push((t) => { wheel.rotation.x = t * 0.8; });
    smoke.push(new THREE.Vector3(mill.x, mill.y + 18, mill.z));
    // esteira: treliça reta do silo até o funil, a 16 m de altura
    const a = new THREE.Vector3(silo.x, silo.y + 18, silo.z + 6), b = new THREE.Vector3(mill.x, mill.y + 16, mill.z);
    const len = a.distanceTo(b), yaw = Math.atan2(b.x - a.x, b.z - a.z), mid = a.clone().lerp(b, 0.5);
    const truss = new THREE.Group(); truss.position.copy(mid); truss.rotation.y = yaw; truss.rotation.x = -Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)); tr.group.add(truss);
    for (const s of [1, -1]) { add(truss, new THREE.BoxGeometry(0.3, 0.3, len), m.iron, s * 1.4, 1.2, 0); add(truss, new THREE.BoxGeometry(0.3, 0.3, len), m.iron, s * 1.4, -0.4, 0); }
    for (let z = -len / 2; z < len / 2; z += 3) for (const s of [1, -1]) { const dg = add(truss, new THREE.BoxGeometry(0.15, 2, 0.15), m.iron, s * 1.4, 0.4, z); dg.rotation.x = 0.6; }
    add(truss, new THREE.BoxGeometry(2.4, 0.15, len), lam({ color: 0x2a2624 }), 0, 0, 0);
    // pilares da esteira longe da pista
    for (const f of [0.08, 0.92]) {
      const p = a.clone().lerp(b, f); const gy = tr.terrainY(p.x, p.z);
      if (tr.dist(p.x, p.z).d > EDGE + 3) add(tr.group, new THREE.BoxGeometry(1, p.y - gy, 1), m.iron, p.x, (p.y + gy) / 2, p.z);
    }
    const bucketGeo = new THREE.BoxGeometry(1.6, 0.9, 1.2);
    const buckets = new THREE.InstancedMesh(bucketGeo, m.copper, 12); tr.group.add(buckets);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(truss.rotation);
    anims.push((t) => { for (let n = 0; n < 12; n++) { const u = (n / 12 + t * 0.04) % 1; const v = a.clone().lerp(b, u); v.y += 0.8; buckets.setMatrixAt(n, mt.compose(v, q, new THREE.Vector3(1, 1, 1))); } buckets.instanceMatrix.needsUpdate = true; });
    tr.landmarks = { ...(tr.landmarks || {}), show: mid.clone() };
  }

  // ---------------------------------------------------- moinho de tijolo com pás de latão
  const wm = freeNear(tr, MX(tr, 165), -72, EDGE + 18);
  if (wm) {
    const g = new THREE.Group(); g.position.copy(wm); tr.group.add(g);
    add(g, new THREE.CylinderGeometry(3, 4.6, 18, 10), lam({ map: brickTex('#b5654a') }), 0, 9, 0);
    add(g, new THREE.ConeGeometry(4, 4.4, 10), m.verd, 0, 20.2, 0);
    const hub = new THREE.Group(); hub.position.set(0, 16, 3.8); g.add(hub);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; hub.add(arm);
      add(arm, new THREE.BoxGeometry(0.3, 10, 0.2), m.iron, 0, 5, 0);
      add(arm, new THREE.BoxGeometry(1.8, 7, 0.1), m.brass, 0.9, 6, 0);
    }
    add(g, cyl(0.6, 0.6, 1.4, 10), m.copper, 0, 16, 3.2).rotation.x = Math.PI / 2;
    g.lookAt(tr.center.x, wm.y, tr.center.z);
    anims.push((t) => { hub.rotation.z = t * 0.9; });
  }

  // ---------------------------------------------------- campo de trigo-bolota com a colheitadeira a vapor
  const field = freeNear(tr, MX(tr, -132), 72, EDGE + 22, 20);
  if (field) {
    const wheat = [];
    for (let x = -24; x <= 24; x += 2.4) for (let z = -14; z <= 14; z += 2.4) {
      const px = field.x + x, pz = field.z + z;
      if (tr.dist(px, pz).d < EDGE + 4) continue;
      wheat.push(TRS(px, tr.terrainY(px, pz), pz, rnd() * 3, 0.9 + rnd() * 0.3));
    }
    const wg = new THREE.ConeGeometry(0.9, 2.2, 5); wg.translate(0, 1.1, 0);
    instances(tr, wg, lam({ color: 0xd8b04a, flatShading: true }), wheat);
    const hv = new THREE.Group(); tr.group.add(hv);
    add(hv, new THREE.BoxGeometry(4, 3.2, 6), lam({ color: 0x2f6a5a }), 0, 2.6, 0);
    add(hv, cyl(1.2, 1.2, 4.6, 12), m.copper, 0, 3.6, -1).rotation.x = Math.PI / 2;
    add(hv, cyl(0.35, 0.4, 3.4, 8), m.iron, 0.8, 6.2, -2.4);
    const reel = new THREE.Group(); reel.position.set(0, 1.8, 4.2); hv.add(reel);
    add(reel, cyl(0.25, 0.25, 7, 8), m.iron).rotation.z = Math.PI / 2;
    for (let k = 0; k < 5; k++) { const bl = add(reel, new THREE.BoxGeometry(7, 0.2, 0.2), m.brass, 0, Math.cos(k * 1.26) * 1.2, Math.sin(k * 1.26) * 1.2); void bl; }
    add(hv, new THREE.BoxGeometry(7.6, 0.6, 1.6), m.brass, 0, 0.8, 4.4);
    for (const s of [1, -1]) for (const z of [-2, 2]) { const w = add(hv, cyl(1.1, 1.1, 0.6, 12), m.iron, s * 2.2, 1.1, z); w.rotation.z = Math.PI / 2; }
    const drv = tinBot(rnd, { mode: 'cheer', color: 0xb8673a }); drv.group.scale.setScalar(0.7); drv.group.position.set(0, 4.2, 0.6); hv.add(drv.group);
    const top = new THREE.Vector3();
    const smk = puffs(tr, H.SPR, [top], { color: 0x9a9a9a, rate: 0.6, size: 3, rise: 4, n: 5 });
    anims.push((t, dt) => {
      const u = Math.sin(t * 0.12) * 20;
      hv.position.set(field.x + u, tr.terrainY(field.x + u, field.z), field.z);
      hv.rotation.y = Math.cos(t * 0.12) > 0 ? Math.PI / 2 : -Math.PI / 2;
      reel.rotation.x = t * 4;
      drv.update(t, dt);
      top.set(0.8, 8, -2.4).applyQuaternion(hv.quaternion).add(hv.position);
      smk(t, dt);
    });
    // espantalhos autômatos
    for (let k = 0; k < 3; k++) {
      const b = tinBot(rnd, { mode: 'work', color: [0xb8673a, 0x9aa0a4, 0xc9a24a][k] });
      const x = field.x + (k - 1) * 18, z = field.z + 18;
      if (tr.dist(x, z).d < EDGE + 3) continue;
      b.group.position.set(x, tr.terrainY(x, z), z); b.group.rotation.y = rnd() * 6; tr.group.add(b.group);
      add(b.group, new THREE.ConeGeometry(1.2, 0.8, 10), lam({ color: 0xd8b04a }), 0, 3.6, 0);   // chapéu de palha
      anims.push((t, dt) => b.update(t, dt));
    }
  }

  // ---------------------------------------------------- pomar de carvalhos em fileiras
  const oaks = [];
  const groves = [[70, 52], [-40, -60], [60, -150], [-150, -60]];
  for (const [gx, gz] of groves) {
    for (let x = -30; x <= 30; x += 9) for (let z = -22; z <= 22; z += 9) {
      const px = MX(tr, gx) + x + (rnd() - 0.5) * 2, pz = gz + z + (rnd() - 0.5) * 2;
      if (tr.dist(px, pz).d < EDGE + 6) continue;
      if (silo && Math.hypot(px - silo.x, pz - silo.z) < 34) continue;
      if (field && Math.abs(px - field.x) < 34 && Math.abs(pz - field.z) < 24) continue;
      oaks.push(TRS(px, tr.terrainY(px, pz) - 0.2, pz, rnd() * 6, 0.8 + rnd() * 0.4));
    }
  }
  instances(tr, oakGeo(), lam({ vertexColors: true, flatShading: true }), oaks);

  // ---------------------------------------------------- bolota gigante no pedestal de latão
  const ac = freeNear(tr, MX(tr, 30), 30, EDGE + 10, 16);
  if (ac) {
    const g = new THREE.Group(); g.position.copy(ac); tr.group.add(g);
    const nut = add(g, new THREE.SphereGeometry(4, 20, 14), phong({ color: 0xc7894b, shininess: 50 }), 0, 7.5, 0); nut.scale.set(1, 1.25, 1);
    add(g, new THREE.SphereGeometry(4.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam({ color: 0x6d4c41 }), 0, 10, 0);
    add(g, cyl(0.4, 0.5, 2), lam({ color: 0x4e342e }), 0, 15, 0);
    add(g, cyl(4, 5, 2, 14), m.brass, 0, 1, 0);
    const gear = gearMesh(5.4, 20, m.copper, 0.6); gear.rotation.x = Math.PI / 2; gear.position.y = 2.2; g.add(gear);
    anims.push((t) => { g.rotation.y = Math.sin(t * 0.5) * 0.3; gear.rotation.z = t * 0.3; });
  }

  anims.push(puffs(tr, H.SPR, smoke, { color: 0xe8e8e8, rate: 0.25, size: 4, rise: 7 }));
  return anims;
}

function signTex(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d'); g.scale(4, 4);
  g.fillStyle = '#5a1e14'; g.fillRect(0, 0, 128, 24); g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 22);
  g.fillStyle = '#ffd98a'; g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 13);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t;
}
export { signTex };

// placa por cima de um caminho (atalho): postes nas bordas, fora do caminho dos karts
export function signGate(tr, m, P, i, text, h = 6.5) {
  // anda pelo caminho até achar um ponto em que os postes não caiam na pista principal
  const clear = (k) => [1, -1].every((s) => {
    const q = P.point(k, s * (EDGE + 0.5)), j = tr.nearestGlobal(q.x, q.z);
    return Math.abs(tr.lateral(q.x, q.z, j)) > EDGE + 1.2 || Math.abs(tr.py[j] - P.py[k]) > 3;
  });
  for (let d = 0; d < 30 && P !== tr && !clear(i); d++) i = Math.min(P.N - 6, i + 1);
  const w = EDGE * 2 + 1.2, y = P.py[i];
  const sg = add(tr.group, new THREE.BoxGeometry(Math.min(w, 12), 1.5, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex(text) }), m.brass]);
  const sp = P.point(i, 0); sg.position.set(sp.x, y + h, sp.z); sg.rotation.y = P.heading(i) + Math.PI;
  const bar = add(tr.group, new THREE.BoxGeometry(w, 0.25, 0.25), m.iron, sp.x, y + h + 0.9, sp.z);
  bar.rotation.y = P.heading(i);
  for (const s of [1, -1]) { const pp = P.point(i, s * (EDGE + 0.5)); add(tr.group, new THREE.BoxGeometry(0.3, h + 1, 0.3), m.iron, pp.x, y + (h + 1) / 2, pp.z); }
}
