import * as THREE from 'three';
import { EDGE } from './data.js';
import { tinBot, patrol } from './robots.js';
import { M, add, cyl, gearMesh } from './bolota.js';
import { lam, basic, phong, brickTex, plateTex, boardsTex, puffs, instances, TRS, freeNear, MX } from './kit.js';
import { signTex, signGate } from './granja.js';

// =====================================================================
//  PORTO DO COQUEIRO — o porto dos escafandristas: canal da doca com a ponte
//  levadiça (erguida, vira rampa), estaleiro de submarinos, píer com guindastes
//  baixando sinos de mergulho, prensa de óleo de coco e o farol de lente giratória.
// =====================================================================

function submarine(m, col = 0xb8673a, len = 16) {
  const g = new THREE.Group();
  const hull = add(g, new THREE.CapsuleGeometry(2, len - 4, 6, 14), phong({ color: col, shininess: 40 }));
  hull.rotation.x = Math.PI / 2;
  for (let k = -2; k <= 2; k++) { const r = add(g, new THREE.TorusGeometry(2.03, 0.1, 4, 16), m.brass, 0, 0, k * (len / 6)); void r; }
  add(g, new THREE.BoxGeometry(1.6, 2.2, 3.4), phong({ color: col, shininess: 40 }), 0, 2.6, -0.5);
  add(g, cyl(0.15, 0.15, 2.2, 6), m.iron, 0, 4.6, -1.2);
  for (let k = -1; k <= 1; k++) for (const s of [1, -1]) {
    const w = add(g, new THREE.CircleGeometry(0.4, 10), m.lamp, s * 2.02, 0.4, k * 3); w.rotation.y = s * Math.PI / 2;
  }
  const prop = new THREE.Group(); prop.position.z = -len / 2 - 0.4; g.add(prop);
  for (let k = 0; k < 4; k++) { const b = add(prop, new THREE.BoxGeometry(0.3, 2.4, 0.15), m.brass); b.rotation.z = (k * Math.PI) / 2; }
  g.userData.prop = prop;
  return g;
}

export function porto(tr, rnd, H) {
  const m = M(), anims = [], smoke = [];
  const X = (x) => MX(tr, x);
  const stone = lam({ map: brickTex('#9a9088', '#5a524a') });

  // ---------------------------------------------------- canal da doca: cais de pedra e a ponte levadiça
  const cx = X(41), cw = 8;
  for (const s of [-1, 1]) {
    const q = add(tr.group, new THREE.BoxGeometry(1.4, 2.4, 150), stone, cx + s * (cw / 2 + 0.7), -0.4, -6);
    void q;
  }
  // torres da ponte levadiça nas duas margens, com contrapeso e engrenagem
  const br = tr.branches[0];
  if (br) {
    const end = br.point(br.N - 1, 0); end.y = br.py[br.N - 1];
    const bz = end.z;
    for (const s of [-1, 1]) for (const side of [-1, 1]) {
      // torres plantadas dentro do canal, rente ao cais (a pista principal passa colada na outra margem)
      const g = new THREE.Group(); g.position.set(cx + s * (cw / 2 - 0.9), -0.8, bz + side * (EDGE + 2.3)); tr.group.add(g);
      add(g, new THREE.BoxGeometry(2.8, 14, 2.8), stone, 0, 7, 0);
      add(g, new THREE.ConeGeometry(2.4, 3, 4), m.verd, 0, 15.5, 0).rotation.y = Math.PI / 4;
      const gear = gearMesh(2.2, 14, m.brass, 0.5); gear.position.set(0, 10, -side * 1.8); g.add(gear);
      anims.push((t) => { gear.rotation.z = Math.sin(t * 0.5) * 0.4 * s; });
      add(g, new THREE.BoxGeometry(2.4, 3, 2.4), m.iron, 0, 4 + Math.sin(rnd() * 6), side * 2.6);    // contrapeso, do lado de fora
    }
    // folha da outra margem: emperrou abaixada, rente ao cais (só a deste lado subiu e virou rampa).
    // fica baixa e curta para não parecer rampa nem ficar no caminho do salto
    const fx = tr.mirror ? -1 : 1;
    const leaf = add(tr.group, new THREE.BoxGeometry(3.2, 0.35, EDGE * 2), lam({ map: boardsTex('#7a5a3a', '#c9a24a') }), cx + fx * (cw / 2 + 1.6), 0.05, bz);
    leaf.userData.noSolid = true;
    for (const side of [-1, 1]) add(tr.group, new THREE.BoxGeometry(0.5, 0.5, 0.5), m.iron, cx + fx * (cw / 2 + 0.4), 0.3, bz + side * (EDGE - 0.4));
    for (const side of [-1, 1]) add(tr.group, cyl(0.08, 0.08, 14, 4), m.iron, cx, 9, bz + side * EDGE).rotation.z = 0.9;
    // placa de perigo
    signGate(tr, m, br, br.N - 22, 'PONTE ERGUIDA!');
    tr.landmarks = { ...(tr.landmarks || {}), show: end.clone() };
  }
  // um submarino pequeno subindo e descendo no canal
  const mini = submarine(m, 0xc9a24a, 7); mini.scale.setScalar(0.8); tr.group.add(mini);
  anims.push((t) => { const u = Math.sin(t * 0.08); mini.position.set(cx, -0.6 + Math.sin(t) * 0.1, 30 + u * 40); mini.rotation.y = Math.cos(t * 0.08) > 0 ? 0 : Math.PI; mini.userData.prop.rotation.z = t * 6; });

  // ---------------------------------------------------- estaleiro: galpão com um submarino saindo pelos trilhos
  const yard = freeNear(tr, X(40), -140, EDGE + 20, 30);
  if (yard) {
    const g = new THREE.Group(); g.position.copy(yard); tr.group.add(g);
    const pl = plateTex('#6a625a', '#c9a24a'); pl.repeat.set(4, 2);
    add(g, new THREE.BoxGeometry(30, 16, 22), lam({ map: pl }), 0, 8, -6);
    add(g, new THREE.CylinderGeometry(11.5, 11.5, 30, 16, 1, false, 0, Math.PI), m.verd, 0, 16, -6).rotation.z = Math.PI / 2;
    add(g, new THREE.BoxGeometry(20, 12, 0.4), lam({ color: 0x1a1614 }), 0, 6, 5.1);
    const sub = submarine(m, 0x8a2e22, 22); sub.position.set(0, 3.6, 10); g.add(sub);
    for (const s of [1, -1]) add(g, new THREE.BoxGeometry(0.4, 0.3, 30), m.iron, s * 2.4, 0.2, 14);
    // guindaste-pórtico por cima do submarino
    for (const s of [1, -1]) add(g, new THREE.BoxGeometry(0.8, 18, 0.8), m.iron, s * 9, 9, 14);
    add(g, new THREE.BoxGeometry(19, 1, 1.2), m.brass, 0, 18, 14);
    const hook = add(g, new THREE.BoxGeometry(1.2, 1.2, 1.2), m.copper, 0, 12, 14);
    anims.push((t) => { hook.position.x = Math.sin(t * 0.3) * 7; sub.userData.prop.rotation.z = t * 2; });
    for (const s of [1, -1]) { add(g, cyl(1, 1.2, 10, 10), m.copper, s * 12, 21, -10); smoke.push(new THREE.Vector3(yard.x + s * 12, yard.y + 27, yard.z - 10)); }
    const sign = add(g, new THREE.BoxGeometry(14, 2, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('ESTALEIRO') }), m.brass], 0, 13.5, 5.3);
    void sign;
    g.lookAt(tr.center.x, yard.y, tr.center.z);
  }

  // ---------------------------------------------------- píer: guindastes com sinos de mergulho e submarinos atracados
  const pierIdx = [];
  for (let i = 0; i < tr.N; i += 2) if (tr.bridge[i]) pierIdx.push(i);
  for (let n = 0; n < 4; n++) {
    const i = pierIdx[Math.floor(((n + 0.5) / 4) * pierIdx.length)];
    if (i === undefined) continue;
    // lado do mar = o lado cuja borda é uma queda
    const s = tr.isFall(i, 1) ? 1 : -1;
    const base = tr.point(i, s * (EDGE + 4)); base.y = tr.py[i];
    const g = new THREE.Group(); g.position.copy(base); g.rotation.y = Math.atan2(s * tr.tz[i], -s * tr.tx[i]) + Math.PI; tr.group.add(g);
    add(g, cyl(0.8, 1, 3, 10), m.iron, 0, -1.5, 0);
    const turret = new THREE.Group(); g.add(turret);
    add(turret, new THREE.BoxGeometry(3, 2.4, 3), m.copper, 0, 1.2, 0);
    const jib = add(turret, new THREE.BoxGeometry(0.6, 0.6, 12), m.brass, 0, 4.5, 5); jib.rotation.x = -0.3;
    const cable = add(turret, cyl(0.05, 0.05, 1, 4), m.iron, 0, 0, 10.6);
    const bell = new THREE.Group(); turret.add(bell);
    add(bell, new THREE.SphereGeometry(1.5, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), m.brass);
    add(bell, new THREE.CircleGeometry(0.4, 8), m.lamp, 0, 0.5, 1.5);
    const ph = rnd() * 6;
    anims.push((t) => {
      turret.rotation.y = Math.sin(t * 0.2 + ph) * 0.5;
      const y = 2 + Math.sin(t * 0.35 + ph) * 4;  // desce até a água e sobe
      bell.position.set(0, y, 10.6);
      cable.position.y = (y + 6.2) / 2 + 0.6; cable.scale.y = Math.max(0.1, 6.2 - y);
    });
    // submarino atracado ao lado
    const sub = submarine(m, [0xb8673a, 0x2f6a5a, 0x8a2e22, 0xc9a24a][n], 14 + n * 2);
    const sp = tr.point(i + 14, s * (EDGE + 7)); sub.position.set(sp.x, -0.4, sp.z); sub.rotation.y = tr.heading(i + 14); tr.group.add(sub);
    anims.push((t) => { sub.position.y = -0.4 + Math.sin(t * 0.9 + n) * 0.15; });
  }
  // cabeços de amarração e caixotes no píer (instâncias)
  const bol = [], crates = [];
  for (let k = 0; k < pierIdx.length; k += 9) {
    const i = pierIdx[k], s = tr.isFall(i, 1) ? 1 : -1;
    const p = tr.point(i, s * (EDGE - 0.6)); bol.push(TRS(p.x, tr.py[i], p.z, 0, 1));
    if (k % 27 === 0) { const c = tr.point(i, -s * (EDGE + 2)); crates.push(TRS(c.x, tr.py[i] - 0.3, c.z, rnd() * 3, 1 + rnd() * 0.4)); }
  }
  const bg = cyl(0.3, 0.4, 0.9, 8); bg.translate(0, 0.45, 0); instances(tr, bg, m.iron, bol);
  const cg = new THREE.BoxGeometry(1.6, 1.6, 1.6); cg.translate(0, 0.8, 0); instances(tr, cg, lam({ map: boardsTex('#8a6a3a', '#5a3a22') }), crates);

  // ---------------------------------------------------- prensa de óleo de coco na areia
  const pr = freeNear(tr, X(-40), 40, EDGE + 12, 24);
  if (pr) {
    const g = new THREE.Group(); g.position.copy(pr); tr.group.add(g);
    add(g, new THREE.BoxGeometry(12, 8, 9), lam({ map: brickTex('#c8a070', '#7a5a3a') }), 0, 4, 0);
    add(g, new THREE.BoxGeometry(13, 0.8, 10), m.verd, 0, 8.4, 0);
    for (const x of [-3, 3]) { add(g, cyl(1.4, 1.4, 3, 12), m.copper, x, 10.2, 0); }
    add(g, cyl(0.6, 0.7, 8, 8), m.iron, 4.5, 12, -3); smoke.push(new THREE.Vector3(pr.x + 4.5, pr.y + 16.5, pr.z - 3));
    const ram = add(g, new THREE.BoxGeometry(3, 2.4, 3), m.iron, -8, 6, 4);
    add(g, new THREE.BoxGeometry(4, 0.6, 4), m.brass, -8, 0.3, 4);
    for (const x of [-9.6, -6.4]) add(g, new THREE.BoxGeometry(0.4, 9, 0.4), m.iron, x, 4.5, 4);
    const nuts = [];
    for (let k = 0; k < 14; k++) nuts.push(TRS(pr.x - 4 + (rnd() - 0.5) * 6, pr.y + 0.6, pr.z + 7 + rnd() * 3, 0, 0.7 + rnd() * 0.3));
    instances(tr, new THREE.SphereGeometry(0.8, 8, 6), lam({ color: 0x6a4428 }), nuts);
    anims.push((t) => { const u = (t * 0.6) % 1; ram.position.y = u < 0.2 ? 6 - (u / 0.2) * 4.6 : 1.4 + ((u - 0.2) / 0.8) * 4.6; });
    const sg = add(g, new THREE.BoxGeometry(10, 1.6, 0.3), [m.brass, m.brass, m.brass, m.brass, lam({ map: signTex('OLEO DE COCO') }), m.brass], 0, 6.5, 4.7);
    void sg;
    const bot = tinBot(rnd, { mode: 'carry', color: 0xc9a24a }); g.add(bot.group);
    anims.push(patrol(bot, new THREE.Vector3(-6, 0, 8.5), new THREE.Vector3(3, 0, 8.5), rnd, { speed: 0.8 }));
  }

  // ---------------------------------------------------- farol do promontório, com lente giratória
  let top = 0;
  for (let i = 0; i < tr.N; i++) if (tr.py[i] > tr.py[top]) top = i;
  const lhs = tr.isFall(top, 1) ? 1 : -1;
  const lp = tr.point(top, lhs * (EDGE + 9)); lp.y = tr.py[top] - 1;
  const lh = new THREE.Group(); lh.position.copy(lp); tr.group.add(lh);
  add(lh, new THREE.CylinderGeometry(7, 9, 4, 10), lam({ color: 0x7a6a5a, flatShading: true }), 0, 0, 0);
  const stripes = plateTex('#efe2c2', '#b8673a'); stripes.repeat.set(2, 4);
  add(lh, new THREE.CylinderGeometry(2.6, 3.8, 24, 14), lam({ map: stripes }), 0, 14, 0);
  for (let k = 0; k < 4; k++) add(lh, cyl(3.9 - k * 0.3, 3.9 - k * 0.3, 0.6, 14), m.copper, 0, 4 + k * 6, 0);
  add(lh, cyl(3.4, 3.4, 0.6, 14), m.brass, 0, 26.3, 0);
  add(lh, cyl(2.6, 2.6, 3.4, 12), basic({ color: 0xfff2b0 }), 0, 28.2, 0);
  add(lh, new THREE.ConeGeometry(3.2, 3, 12), m.verd, 0, 31.4, 0);
  const lens = new THREE.Group(); lens.position.y = 28.2; lh.add(lens);
  for (let k = 0; k < 6; k++) { const r = add(lens, new THREE.BoxGeometry(0.3, 3, 0.3), m.brass, Math.cos(k) * 2.7, 0, Math.sin(k) * 2.7); void r; }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5, 60, 12, 1, true), basic({ color: 0xfffde7, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -30, 0); beam.geometry.rotateZ(Math.PI / 2); lens.add(beam);
  anims.push((t) => { lens.rotation.y = t * 0.8; });

  anims.push(puffs(tr, H.SPR, smoke, { color: 0xdddddd, rate: 0.3, size: 4, rise: 7 }));
  return anims;
}
