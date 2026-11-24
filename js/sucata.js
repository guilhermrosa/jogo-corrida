import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { pixelTex } from './textures.js';
import { tinBot, giantBot } from './robots.js';

// =====================================================================
//  FERRO-VELHO DO SOL — deserto de sucata (Copa Engrenagem)
//  Torre de ferro-velho no meio da espiral, montes de sucata, cata-ventos,
//  guindaste com ímã, esteira, ponte quebrada, carcaças, cactos e mesas.
// =====================================================================

const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);
const BRASS = 0xc9a24a, IRON = 0x3b3632, COPPER = 0xb8673a;
// ferrugem, ferro sujo e tinta descascada (nada de cor viva: é ferro-velho)
const RUSTS = [0x7a4a30, 0x8a5a3a, 0x5e3e2a, 0x6a6058, 0x585450, 0x7a6a58, 0x6a4a38, 0x4e4a46, 0x8a6a4a, 0x5a5a50, 0x7a5a48, 0x4a5458];
// textura de ferrugem em tons de cinza (multiplica a cor de cada peça)
function rustTex() {
  return pixelTex(32, 32, (c, w, h, r) => {
    c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = 120 + r() * 120 | 0; c.fillStyle = `rgb(${v},${v * 0.92 | 0},${v * 0.85 | 0})`; c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 8; i++) { const x = r() * w; for (let y = r() * h, k = 0; k < 10; k++, y++) { c.fillStyle = 'rgba(90,40,20,.35)'; c.fillRect(x, y, 1, 1); } }
    for (let i = 0; i < 6; i++) { c.fillStyle = '#f0e8e0'; c.fillRect(r() * w, r() * h, 1, 1); }
  }, { seed: 61 });
}

function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function limb(a, b, r0, r1, seg = 6) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
function beamBox(a, b, w) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.BoxGeometry(w, len, w).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
function signTex(text, bg = '#c89a5e', fg = '#3a2414') {
  return pixelTex(64, 20, (c, w, h, r) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(80,40,20,.25)'; c.fillRect(r() * w, r() * h, 3, 1); }
    c.fillStyle = fg; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 1);
  }, { repeat: false, seed: text.length });
}

export function sucata(tr, rnd, H) {
  const N = tr.N;
  const occupied = [];
  const free = (x, z, r) => occupied.every(([ox, oz, or]) => Math.hypot(x - ox, z - oz) > r + or);
  const clear = (x, z, need) => tr.dist(x, z).d >= need;
  const around = (a, b) => {
    const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
    const p = tr.point(i, s * (EDGE + a + rnd() * (b - a)));
    p.y = tr.terrainY(p.x, p.z);
    return p;
  };
  const mats = {
    iron: lam({ color: IRON }), rust: lam({ color: 0x8a4a2a }), wood: lam({ color: 0x8a5a34 }),
    brass: phong({ color: BRASS, shininess: 70, specular: 0x887755 }), copper: phong({ color: COPPER, shininess: 50, specular: 0x553322 }),
    lamp: basic({ color: 0xffd98a }), vc: lam({ vertexColors: true, map: rustTex() }),
  };
  const puffTex = H.SPR.fumaca();
  const smokers = [];
  const anims = [];
  const mx = tr.mirror ? -1 : 1;
  const T = new THREE.Vector3(mx * tr.def.tower[0], 0, tr.def.tower[1]);
  occupied.push([T.x, T.z, 44]);

  H.grandstand(tr, 12, H.sideWithRoom(tr, 12), 44);
  for (let k = -16; k <= 36; k += 6) for (const s of [1, -1]) { const p = tr.point((k + N) % N, s * (EDGE + 12)); occupied.push([p.x, p.z, 3]); }

  // ------------------------------------------------ torre de ferro-velho no meio da espiral
  {
    const g = new THREE.Group(); g.position.copy(T); tr.group.add(g);
    const junk = [];
    let y = 0, r = 12;
    while (y < 50) {
      const h = 2.5 + rnd() * 3;
      // anel de caixas, carcaças e tambores tortos
      const n = Math.max(3, Math.round(r * 0.9));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
        const kind = rnd();
        let geo;
        if (kind < 0.5) geo = new THREE.BoxGeometry(2 + rnd() * 3, h, 2 + rnd() * 3).toNonIndexed();
        else if (kind < 0.8) { geo = new THREE.CylinderGeometry(1 + rnd(), 1 + rnd(), h, 10).toNonIndexed(); }
        else { geo = new THREE.CylinderGeometry(1.2, 1.2, 3.5, 10).toNonIndexed(); geo.rotateZ(Math.PI / 2); }
        geo.rotateY(rnd() * 3); geo.rotateZ((rnd() - 0.5) * 0.25); geo.rotateX((rnd() - 0.5) * 0.25);
        geo.translate(Math.cos(a) * r * 0.75, y + h / 2, Math.sin(a) * r * 0.75);
        junk.push(tint(geo, RUSTS[(rnd() * RUSTS.length) | 0]));
      }
      const core = new THREE.CylinderGeometry(r * 0.75, r * 0.8, h, 8).toNonIndexed(); core.translate(0, y + h / 2, 0);
      junk.push(tint(core, 0x5a4a3a));
      // plataforma com corrimão a cada andar
      const deck = new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.4, 12).toNonIndexed(); deck.translate(0, y + h + 0.2, 0);
      junk.push(tint(deck, 0x6a5a4a));
      y += h + 0.4;
      r = Math.max(5, r - 0.6);
    }
    g.add(new THREE.Mesh(mergeGeometries(junk), mats.vc));
    // relógio torto e engrenagens girando na torre
    const face = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20), lam({ color: 0xf4ead2 })); face.position.set(0, 30, 8.6); face.rotation.z = 0.12; g.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.35, 6, 20), mats.brass); ring.position.copy(face.position); g.add(ring);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.1), mats.iron); hand.geometry.translate(0, 1.2, 0); hand.position.set(0, 30, 8.75); g.add(hand);
    anims.push((t) => { hand.rotation.z = -t * 0.8; });
    const gearGeo = new THREE.TorusGeometry(2.4, 0.5, 6, 16);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.6;
      const gg = new THREE.Mesh(gearGeo, k % 2 ? mats.brass : mats.copper);
      gg.position.set(Math.cos(a) * 9.6, 10 + k * 8, Math.sin(a) * 9.6); gg.rotation.y = -a + Math.PI / 2; g.add(gg);
      for (let m = 0; m < 10; m++) { const b = (m / 10) * Math.PI * 2; const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.8), gg.material); tooth.position.set(Math.cos(b) * 2.9, Math.sin(b) * 2.9, 0); tooth.rotation.z = b; gg.add(tooth); }
      anims.push((t) => { gg.rotation.z = t * (k % 2 ? 0.6 : -0.6); });
    }
    // cata-vento no topo, chaminé fumegando e bandeira
    const mill = new THREE.Group(); mill.position.set(0, y + 6, 0); g.add(mill);
    g.add(new THREE.Mesh(limb(new THREE.Vector3(0, y, 0), new THREE.Vector3(0, y + 6, 0), 0.4, 0.3), mats.iron));
    const rotor = new THREE.Group(); rotor.position.z = 1; mill.add(rotor);
    for (let k = 0; k < 8; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.6, 0.1), lam({ color: k % 2 ? 0xefe2c2 : 0xb0482a })); bl.geometry.translate(0, 2.6, 0); bl.rotation.z = (k / 8) * Math.PI * 2; bl.rotation.y = 0.3; rotor.add(bl); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 3), lam({ color: 0xefe2c2 })); tail.position.z = -3; mill.add(tail);
    anims.push((t) => { rotor.rotation.z = t * 2.2; mill.rotation.y = Math.sin(t * 0.2) * 0.6; });
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 9, 10), mats.copper); stack.position.set(3, y + 2, -2); g.add(stack);
    smokers.push(new THREE.Vector3(T.x + 3, y + 7, T.z - 2));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), mats.iron); pole.position.set(-3, y + 3, 1); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), lam({ color: 0xe8a221, side: THREE.DoubleSide })); flag.position.set(-1.7, y + 5.2, 1); g.add(flag);
    anims.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.3; });
    // lâmpadas penduradas
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), mats.lamp); l.position.set(Math.cos(a) * 9.6, 6 + (k % 4) * 7, Math.sin(a) * 9.6); g.add(l); }
    tr.landmarks = { ...(tr.landmarks || {}), towerTop: y };
  }

  // ------------------------------------------------ viaduto de vigas enferrujadas (treliça nos trechos elevados)
  {
    const truss = [];
    for (let i = 0; i < N; i += 4) {
      const j = (i + 4) % N;
      if (!tr.bridge[i] || !tr.bridge[j] || tr.gap[i] || tr.gap[j]) continue;
      for (const s of [1, -1]) {
        if (tr.isFall(i, s)) continue;
        const a = tr.point(i, s * (EDGE + 0.4)), b = tr.point(j, s * (EDGE + 0.4));
        a.y = tr.py[i] - 0.8; b.y = tr.py[j] - 0.8;
        const at = a.clone(), bt = b.clone(); at.y += 2.8; bt.y += 2.8;
        truss.push(beamBox(a, at, 0.3), beamBox(at, bt, 0.35), beamBox((i / 4) % 2 ? a : at, (i / 4) % 2 ? bt : b, 0.22));
      }
    }
    if (truss.length) tr.group.add(new THREE.Mesh(mergeGeometries(truss), lam({ color: 0x6a3a22 })));
  }

  // ------------------------------------------------ ponte quebrada: pontas rasgadas, vergalhões e placas de "PULE!"
  {
    let g0 = -1, g1 = -1;
    for (let i = 0; i < N; i++) if (tr.gap[i]) { if (g0 < 0) g0 = i; g1 = i; }
    if (g0 >= 0) {
      tr.landmarks = { ...(tr.landmarks || {}), gap: g0 };
      const bits = [];
      for (const [i, dir] of [[tr.wrap(g0 - 1), 1], [tr.wrap(g1 + 1), -1]]) {
        for (let k = -5; k <= 5; k++) {
          const p = tr.point(i, k * 2); p.y = tr.py[i] - 0.4;
          const q = p.clone().add(new THREE.Vector3(tr.tx[i] * dir * (0.8 + rnd() * 1.6), (rnd() - 0.6) * 1.2, tr.tz[i] * dir * (0.8 + rnd() * 1.6)));
          bits.push(limb(p, q, 0.06, 0.04, 4));
        }
        // pedaço de viga pendurado
        const p = tr.point(i, (rnd() - 0.5) * 10); p.y = tr.py[i] - 1;
        const q = p.clone().add(new THREE.Vector3(tr.tx[i] * dir * 1.5, -5, tr.tz[i] * dir * 1.5));
        bits.push(beamBox(p, q, 0.5));
      }
      tr.group.add(new THREE.Mesh(mergeGeometries(bits), mats.iron));
      // placas antes da ponte
      const warn = lam({ map: signTex('PULE!', '#e8a221', '#2a1a10') });
      const turbo = lam({ map: signTex('ACELERE', '#b0482a', '#ffe8c0') });
      for (const [back, mat] of [[60, turbo], [35, warn]]) {
        const i = tr.wrap(g0 - back);
        for (const s of [1, -1]) {
          const p = tr.point(i, s * (EDGE + 0.8)); p.y = tr.py[i];
          const sg = new THREE.Group(); sg.position.copy(p); sg.rotation.y = tr.heading(i) + Math.PI + s * 0.25; tr.group.add(sg);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), mats.wood); post.position.y = 1.5; sg.add(post);
          const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.12), [mats.wood, mats.wood, mats.wood, mats.wood, mat, mat]); board.position.y = 3; board.rotation.z = s * 0.08; sg.add(board);
        }
      }
    }
  }

  // ------------------------------------------------ montes de sucata
  {
    const parts = [];
    for (let t = 0, made = 0; t < 700 && made < 50; t++) {
      const p = around(3, made < 30 ? 18 : 70);
      if (!clear(p.x, p.z, EDGE + 4) || !free(p.x, p.z, 6)) continue;
      made++;
      const R = 3.5 + rnd() * 6;
      occupied.push([p.x, p.z, R]);
      for (let k = 0; k < 10 + R * 3; k++) {
        const a = rnd() * Math.PI * 2, d = rnd() * R, hh = (1 - d / R) * R * 0.9;
        const kind = rnd();
        let geo, col = RUSTS[(rnd() * RUSTS.length) | 0];
        if (kind < 0.25) geo = new THREE.BoxGeometry(1.5 + rnd() * 2.5, 0.08, 1 + rnd() * 1.6).toNonIndexed();          // chapas
        else if (kind < 0.4) geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10).toNonIndexed();                    // tambores
        else if (kind < 0.55) { geo = new THREE.TorusGeometry(0.6 + rnd() * 0.3, 0.26, 5, 12).toNonIndexed(); col = 0x262220; } // pneus
        else if (kind < 0.68) geo = new THREE.CylinderGeometry(0.12, 0.12, 2.5 + rnd() * 3, 6).toNonIndexed();      // canos
        else if (kind < 0.8) geo = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 12).toNonIndexed();                  // rodas e engrenagens
        else if (kind < 0.9) geo = new THREE.BoxGeometry(1.8, 0.9, 1).toNonIndexed();                                // motores
        else geo = new THREE.TorusGeometry(0.9, 0.12, 4, 14).toNonIndexed();                                         // aros
        geo.rotateX(rnd() * 3); geo.rotateY(rnd() * 3); geo.rotateZ(rnd() * 3);
        geo.translate(p.x + Math.cos(a) * d, p.y + hh * rnd() + 0.3, p.z + Math.sin(a) * d);
        parts.push(tint(geo, col));
      }
      const mound = new THREE.SphereGeometry(R, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(); mound.scale(1, 0.5, 1); mound.translate(p.x, p.y - 0.2, p.z);
      parts.push(tint(mound, 0x5a4434));
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(parts), mats.vc));
  }

  // ------------------------------------------------ cata-ventos de bombear água
  for (let t = 0, made = 0; t < 200 && made < 5; t++) {
    const p = around(8, 40);
    if (!clear(p.x, p.z, EDGE + 6) || !free(p.x, p.z, 4)) continue;
    made++; occupied.push([p.x, p.z, 4]);
    const g = new THREE.Group(); g.position.copy(p); tr.group.add(g);
    const frame = [];
    const h = 12 + rnd() * 5;
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) frame.push(beamBox(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 0.2, h, z * 0.2), 0.2));
    for (let y = 3; y < h; y += 3) { const k = 1 - (y / h) * 0.8; frame.push(beamBox(new THREE.Vector3(-1.6 * k, y, -1.6 * k), new THREE.Vector3(1.6 * k, y, 1.6 * k), 0.12), beamBox(new THREE.Vector3(1.6 * k, y, -1.6 * k), new THREE.Vector3(-1.6 * k, y, 1.6 * k), 0.12)); }
    g.add(new THREE.Mesh(mergeGeometries(frame), mats.iron));
    const head = new THREE.Group(); head.position.y = h + 0.6; g.add(head);
    const rot = new THREE.Group(); rot.position.z = 0.8; head.add(rot);
    for (let k = 0; k < 14; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.06), lam({ color: k % 2 ? 0xb8b0a0 : 0x8a4a2a })); bl.geometry.translate(0, 1.7, 0); bl.rotation.z = (k / 14) * Math.PI * 2; bl.rotation.y = 0.35; rot.add(bl); }
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 2.6), lam({ color: 0xefe2c2 })); vane.position.z = -2; head.add(vane);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.2, 14), mats.copper); tank.position.set(3.4, 1.1, 0); g.add(tank);
    const sp = 1.5 + rnd(), ph = rnd() * 6;
    anims.push((t) => { rot.rotation.z = t * sp; head.rotation.y = Math.sin(t * 0.15 + ph) * 0.8; });
  }

  // ------------------------------------------------ guindaste com eletroímã levantando uma carcaça
  for (let t = 0, made = 0; t < 200 && made < 2; t++) {
    const p = around(10, 26);
    if (!clear(p.x, p.z, EDGE + 8) || !free(p.x, p.z, 8)) continue;
    made++; occupied.push([p.x, p.z, 8]);
    const g = new THREE.Group(); g.position.copy(p); tr.group.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 6), mats.rust); base.position.y = 0.7; g.add(base);
    for (const s of [-1, 1]) { const tread = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 6.6), mats.iron); tread.position.set(s * 2.8, 0.6, 0); g.add(tread); }
    const turn = new THREE.Group(); turn.position.y = 1.4; g.add(turn);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.6), lam({ color: 0xe8a221 })); cab.position.set(0, 1.5, -1); turn.add(cab);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mats.lamp); win.position.set(0, 2, 0.81); turn.add(win);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 2.5, 8), mats.iron); st.position.set(1, 4, -2.2); turn.add(st);
    smokers.push(null);
    const boomEnd = new THREE.Vector3(0, 15, 11);
    turn.add(new THREE.Mesh(mergeGeometries([beamBox(new THREE.Vector3(-0.8, 1.5, 0.5), boomEnd, 0.35), beamBox(new THREE.Vector3(0.8, 1.5, 0.5), boomEnd, 0.35), beamBox(new THREE.Vector3(0, 4, -1), boomEnd, 0.12)]), mats.rust));
    const hang = new THREE.Group(); hang.position.copy(boomEnd); turn.add(hang);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6), mats.iron); cable.position.y = -3; hang.add(cable);
    const magnet = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.7, 14), mats.copper); magnet.position.y = -6.3; hang.add(magnet);
    const car = new THREE.Group(); car.position.y = -7.8; hang.add(car);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 4.6), lam({ color: 0x4a6a8a })); car.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 2.2), lam({ color: 0x4a6a8a })); roof.position.y = 1; car.add(roof);
    for (const [x, z] of [[-1.3, -1.5], [1.3, -1.5], [-1.3, 1.5], [1.3, 1.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), mats.iron); w.rotation.z = Math.PI / 2; w.position.set(x, -0.5, z); car.add(w); }
    const ph = rnd() * 6;
    anims.push((t) => { turn.rotation.y = Math.sin(t * 0.22 + ph) * 1.4; hang.rotation.z = Math.sin(t * 1.4 + ph) * 0.1; hang.rotation.x = Math.cos(t * 1.1) * 0.06; });
  }

  // ------------------------------------------------ esteira levando sucata até o alto da torre
  {
    const top = tr.landmarks?.towerTop ?? 30;
    let start = null;
    for (let t = 0; t < 100 && !start; t++) {
      const a = rnd() * Math.PI * 2, d = 55 + rnd() * 20;
      const p = new THREE.Vector3(T.x + Math.cos(a) * d, 0, T.z + Math.sin(a) * d);
      // a esteira não pode cruzar a pista: testa pontos ao longo dela
      let ok = clear(p.x, p.z, EDGE + 6);
      for (let k = 0; k <= 10 && ok; k++) { const q = p.clone().lerp(T, k / 10 * 0.75); ok = clear(q.x, q.z, EDGE + 4) || k / 10 * 0.75 > 0.55; }
      if (ok) start = p;
    }
    if (start) {
      start.y = tr.terrainY(start.x, start.z);
      const end = T.clone().lerp(start, 0.18); end.y = top - 4;
      const dir = end.clone().sub(start), len = dir.length();
      const belt = new THREE.Group(); belt.position.copy(start); belt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()); tr.group.add(belt);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, len), mats.iron); frame.position.z = len / 2; belt.add(frame);
      for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, len), mats.rust); rail.position.set(s * 1.2, 0.4, len / 2); belt.add(rail); }
      const legs = [];
      for (let z = 6; z < len - 2; z += 9) { const w = start.clone().add(dir.clone().multiplyScalar(z / len)); const gy = tr.terrainY(w.x, w.z); legs.push(beamBox(new THREE.Vector3(w.x, gy, w.z), new THREE.Vector3(w.x, w.y - 0.3, w.z), 0.4)); }
      if (legs.length) tr.group.add(new THREE.Mesh(mergeGeometries(legs), mats.rust));
      const items = [];
      for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.2), lam({ color: RUSTS[k % RUSTS.length] })); b.position.y = 0.7; belt.add(b); items.push(b); }
      anims.push((t) => { items.forEach((b, k) => { b.position.z = ((t * 2.5 + (k / items.length) * len) % len); }); });
    }
  }

  // ------------------------------------------------ placas tortas, carcaças, barris e pilhas de pneus
  {
    const words = ['SUCATA', 'PERIGO', 'ÓLEO', 'FERRO-VELHO', 'PEÇAS', 'NÃO PARE'];
    for (let k = 0; k < 10; k++) {
      const p = around(2.5, 9);
      if (!clear(p.x, p.z, EDGE + 2) || !free(p.x, p.z, 1.5)) continue;
      const sg = new THREE.Group(); sg.position.copy(p); sg.rotation.y = rnd() * 6; sg.rotation.z = (rnd() - 0.5) * 0.25; tr.group.add(sg);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), mats.wood); post.position.y = 1.6; sg.add(post);
      for (let m = 0; m < 2; m++) {
        const tx = signTex(words[(k + m * 3) % words.length]);
        const arrow = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.1), [mats.wood, mats.wood, mats.wood, mats.wood, lam({ map: tx }), lam({ map: tx })]);
        arrow.position.set(m ? -0.6 : 0.6, 2.5 - m * 0.9, 0); arrow.rotation.y = m ? 0.5 : -0.3; arrow.rotation.z = (rnd() - 0.5) * 0.3; sg.add(arrow);
      }
    }
    const hulls = [];
    for (let t = 0, made = 0; t < 200 && made < 9; t++) {
      const p = around(3, 30);
      if (!clear(p.x, p.z, EDGE + 3) || !free(p.x, p.z, 3)) continue;
      made++; occupied.push([p.x, p.z, 3]);
      const col = RUSTS[(rnd() * RUSTS.length) | 0], rot = rnd() * 6, sink = 0.3 + rnd() * 0.5;
      const add = (geo, c = col) => { geo.rotateZ((rnd() - 0.5) * 0.2); geo.rotateY(rot); geo.translate(p.x, p.y - sink, p.z); hulls.push(tint(geo, c)); };
      const b = new THREE.BoxGeometry(2.6, 1.2, 4.8).toNonIndexed(); b.translate(0, 0.9, 0); add(b);
      const c = new THREE.BoxGeometry(2.2, 1, 2.4).toNonIndexed(); c.translate(0, 2, -0.3); add(c);
      for (const [x, z] of [[-1.3, -1.6], [1.3, 1.6]]) { const w = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10).toNonIndexed(); w.rotateZ(Math.PI / 2); w.translate(x, 0.5, z); add(w, 0x2a2624); }
    }
    for (let t = 0, made = 0; t < 200 && made < 20; t++) {
      const p = around(1.5, 14);
      if (!clear(p.x, p.z, EDGE + 1.5) || !free(p.x, p.z, 1.2)) continue;
      made++;
      if (rnd() < 0.5) for (let k = 0; k < 2 + (rnd() * 4 | 0); k++) { const ty = new THREE.TorusGeometry(0.7, 0.3, 5, 12).toNonIndexed(); ty.rotateX(Math.PI / 2); ty.translate(p.x, p.y + 0.3 + k * 0.55, p.z); hulls.push(tint(ty, k % 3 === 2 ? 0xe8a221 : 0x2a2624)); }
      else { const br = new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10).toNonIndexed(); br.translate(p.x, p.y + 0.65, p.z); hulls.push(tint(br, [0xb0482a, 0x4a6a8a, 0x6a7a3a][made % 3])); }
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(hulls), mats.vc));
  }

  // ------------------------------------------------ cactos e mesas de pedra ao longe
  {
    const cac = [];
    for (let t = 0, made = 0; t < 300 && made < 30; t++) {
      const p = around(6, 80);
      if (!clear(p.x, p.z, EDGE + 5) || !free(p.x, p.z, 2)) continue;
      made++;
      const h = 3 + rnd() * 4;
      cac.push(limb(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(p.x, p.y + h, p.z), 0.5, 0.45, 8));
      const top = new THREE.SphereGeometry(0.45, 8, 5).toNonIndexed(); top.translate(p.x, p.y + h, p.z); cac.push(top);
      for (const s of [1, -1]) if (rnd() < 0.7) {
        const y0 = p.y + h * (0.35 + rnd() * 0.25), a = rnd() * 6;
        const e = new THREE.Vector3(p.x + Math.cos(a) * 1.4 * s, y0, p.z + Math.sin(a) * 1.4 * s);
        cac.push(limb(new THREE.Vector3(p.x, y0, p.z), e, 0.3, 0.3, 6), limb(e, e.clone().add(new THREE.Vector3(0, 1.6, 0)), 0.3, 0.28, 6));
      }
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(cac), lam({ color: 0x5a8a3a })));
    const mesas = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rnd() * 0.3, d = 420 + rnd() * 200;
      const x = tr.center.x + Math.cos(a) * d, z = tr.center.z + Math.sin(a) * d, r = 40 + rnd() * 60, h = 40 + rnd() * 70;
      const m = new THREE.CylinderGeometry(r * 0.8, r, h, 7).toNonIndexed(); m.translate(x, h / 2 - 5, z);
      mesas.push(tint(m, [0xc8784a, 0xb86a42, 0xd8905a][k % 3]));
      const cap = new THREE.CylinderGeometry(r * 0.82, r * 0.8, 3, 7).toNonIndexed(); cap.translate(x, h - 4, z);
      mesas.push(tint(cap, 0xa85a3a));
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(mesas), lam({ vertexColors: true, flatShading: true })));
  }

  // ------------------------------------------------ autômatos: robozinhos de lata trabalhando, carregando e torcendo
  const bots = [];
  {
    const modes = ['walk', 'walk', 'carry', 'work', 'walk', 'carry', 'work'];
    for (let t = 0, made = 0; t < 400 && made < 14; t++) {
      const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
      const lat = s * (EDGE + 2.5 + rnd() * 6);
      const a = tr.point(i, lat), b = tr.point((i + 10) % N, lat);
      a.y = tr.terrainY(a.x, a.z); b.y = tr.terrainY(b.x, b.z);
      if (tr.bridge[i] || tr.bridge[(i + 10) % N] || !clear(a.x, a.z, EDGE + 1.8) || !clear(b.x, b.z, EDGE + 1.8) || !free(a.x, a.z, 2)) continue;
      made++; occupied.push([a.x, a.z, 2]);
      const mode = modes[made % modes.length];
      const bot = tinBot(rnd, { mode });
      bot.group.position.copy(a); tr.group.add(bot.group);
      if (!tr.landmarks?.bot) tr.landmarks = { ...(tr.landmarks || {}), bot: a.clone(), botI: i };
      const sp = 0.08 + rnd() * 0.06, ph = rnd() * 6;
      bots.push((t, dt) => {
        if (mode !== 'work') {
          // vai e volta pela calçada, virando no fim do caminho
          const u = (Math.sin(t * sp * 6 + ph) + 1) / 2, dir = Math.cos(t * sp * 6 + ph);
          bot.group.position.lerpVectors(a, b, u);
          bot.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + (dir < 0 ? Math.PI : 0);
        } else bot.group.rotation.y = Math.atan2(s * tr.tz[i], -s * tr.tx[i]); // de frente para a pista
        bot.update(t, dt);
      });
    }
    // torcida de robôs perto da largada, do lado sem arquibancada
    const side = -H.sideWithRoom(tr, 12);
    for (let k = 0; k < 7; k++) {
      const i = (N - 10 + k * 5) % N;
      const p = tr.point(i, side * (EDGE + 2.2 + (k % 2) * 1.6)); p.y = tr.terrainY(p.x, p.z);
      const bot = tinBot(rnd, { mode: 'cheer' });
      bot.group.position.copy(p); bot.group.rotation.y = Math.atan2(side * tr.tz[i], -side * tr.tx[i]); tr.group.add(bot.group);
      bots.push((t, dt) => bot.update(t, dt));
    }
    // robô gigante levantando uma carcaça perto da pista
    for (let t = 0; t < 200; t++) {
      const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
      const p = tr.point(i, s * (EDGE + 9)); p.y = tr.terrainY(p.x, p.z);
      if (tr.bridge[i] || !clear(p.x, p.z, EDGE + 7) || !free(p.x, p.z, 6)) continue;
      occupied.push([p.x, p.z, 6]);
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 4.4), lam({ color: 0x6a6058, map: mats.vc.map })); car.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 2.2), body.material); roof.position.y = 1; car.add(roof);
      const gb = giantBot(rnd, car);
      gb.group.position.copy(p); gb.group.rotation.y = Math.atan2(s * tr.tz[i], -s * tr.tx[i]); tr.group.add(gb.group);
      smokers.push(gb.smokeAt.clone().applyEuler(gb.group.rotation).add(gb.group.position));
      bots.push((t, dt) => gb.update(t, dt));
      tr.landmarks = { ...(tr.landmarks || {}), giant: p.clone(), giantI: i };
      break;
    }
  }
  anims.push((t) => { const dt = 1 / 60; for (const b of bots) b(t, dt); });

  // ------------------------------------------------ fumaça e animações
  const puffs = [];
  for (const top of smokers) if (top) for (let k = 0; k < 6; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0x9a9088 }));
    tr.group.add(s); puffs.push({ s, top, t: k / 6 });
  }
  let t = 0;
  tr.animated.push((dt) => {
    t += dt;
    for (const f of anims) f(t);
    for (const p of puffs) {
      p.t = (p.t + dt * 0.15) % 1;
      p.s.position.set(p.top.x + p.t * 6, p.top.y + p.t * 12, p.top.z);
      p.s.scale.setScalar(1.5 + p.t * 6); p.s.material.opacity = 0.65 * (1 - p.t);
    }
  });
}
