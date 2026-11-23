import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { pixelTex } from './textures.js';

// =====================================================================
//  VILA ENGRENAGEM — cidade-oficina (Copa Engrenagem)
//  Casas tortinhas de enxaimel, torre do relógio, canal com roda d'água,
//  lampiões, canos de vapor sobre a rua, chaminés de fábrica e dirigível.
// =====================================================================

const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);
const BRASS = 0xc9a24a, IRON = 0x3b3632, COPPER = 0xb8673a;

// ---------------------------------------------------------------- texturas
const P = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };

function brickTex(base = '#a0563a', mortar = '#5e3324') {
  return pixelTex(64, 64, (g, W, H, r) => {
    P(g, 0, 0, W, H, mortar);
    for (let y = 0, row = 0; y < H; y += 6, row++) for (let x = row % 2 ? -5 : 0; x < W; x += 10) {
      const k = 0.85 + r() * 0.3;
      const c = base.match(/\w\w/g).map((h) => Math.min(255, parseInt(h, 16) * k) | 0);
      P(g, x, y, 9, 5, `rgb(${c})`);
      P(g, x, y, 9, 1, `rgba(255,255,255,.18)`);
    }
  }, { seed: 21 });
}

// fachada de enxaimel: metade esquerda = loja, metade direita = casa (cores vêm da cor do vértice)
function facadeTex() {
  return pixelTex(256, 128, (g, W, H, r) => {
    for (let v = 0; v < 2; v++) {
      const o = v * 128;
      P(g, o, 0, 128, H, '#f6f1e6');
      for (let i = 0; i < 500; i++) P(g, o + r() * 128, 10 + r() * 100, 1, 1, '#e4ddcc');
      // base de pedra
      P(g, o, 110, 128, 18, '#7d7468');
      for (let x = 0; x < 128; x += 12) { P(g, o + x + 1, 111, 10, 7, '#9a9082'); P(g, o + x + 7, 119, 10, 8, '#8d8476'); }
      // madeiras escuras
      const wood = '#4a2e1c';
      P(g, o, 10, 4, 100, wood); P(g, o + 124, 10, 4, 100, wood);
      P(g, o, 10, 128, 4, wood); P(g, o, 56, 128, 5, wood);
      // janelas de cima com venezianas e floreira
      for (const x of [16, 78]) {
        P(g, o + x - 7, 18, 6, 30, '#2f6a5a'); P(g, o + x + 31, 18, 6, 30, '#2f6a5a');
        P(g, o + x - 1, 17, 32, 33, '#c9a24a');
        const lit = r() < 0.5;
        P(g, o + x + 1, 19, 28, 29, lit ? '#ffd98a' : '#35506a');
        P(g, o + x + 14, 19, 2, 29, '#c9a24a'); P(g, o + x + 1, 32, 28, 2, '#c9a24a');
        if (!lit) P(g, o + x + 3, 21, 4, 8, 'rgba(255,255,255,.35)');
        P(g, o + x - 2, 49, 34, 5, '#6b3e22');
        for (let k = 0; k < 6; k++) P(g, o + x + k * 5, 46, 3, 3, ['#e53935', '#ffd84a', '#ff8fb1'][k % 3]);
      }
      // mãos-francesas em X entre as janelas
      for (let k = 0; k < 30; k++) { P(g, o + 52 + k * 0.8, 16 + k, 3, 2, wood); P(g, o + 76 - k * 0.8, 16 + k, 3, 2, wood); }
      if (v === 0) {
        // loja: vitrine, toldo listrado e porta
        P(g, o + 8, 66, 66, 4, '#c9a24a');
        for (let k = 0; k < 11; k++) P(g, o + 8 + k * 6, 61, 6, 8, k % 2 ? '#efe2c2' : '#b0322a');
        P(g, o + 10, 72, 62, 36, '#c9a24a'); P(g, o + 12, 74, 58, 32, '#2b3f52');
        P(g, o + 14, 96, 54, 8, '#7a5a3a');
        for (let k = 0; k < 5; k++) P(g, o + 18 + k * 10, 88 + (k % 2) * 3, 6, 8, ['#e8a221', '#9aa4ad', '#b8673a', '#c9a24a', '#e53935'][k]);
        P(g, o + 16, 76, 6, 12, 'rgba(255,255,255,.3)');
      } else {
        // casa: escotilha redonda de latão
        for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) {
          const d = Math.hypot(x, y);
          if (d <= 11) P(g, o + 38 + x, 86 + y, 1, 1, d > 8 ? '#c9a24a' : d > 7 ? '#8a6a2a' : '#35506a');
        }
        P(g, o + 33, 80, 4, 4, 'rgba(255,255,255,.4)');
        for (const [x, y] of [[0, -10], [0, 10], [-10, 0], [10, 0]]) P(g, o + 37 + x, 85 + y, 2, 2, '#5a4820');
      }
      // porta de madeira arredondada
      P(g, o + 84, 68, 26, 42, '#3a2414'); P(g, o + 86, 72, 22, 38, '#8a5a34');
      for (let k = 0; k < 4; k++) P(g, o + 88 + k * 5, 72, 1, 38, '#6b4426');
      P(g, o + 86, 70, 22, 2, '#3a2414');
      P(g, o + 103, 90, 3, 3, '#e0bd6a');
    }
  }, { seed: 77 });
}

function roofTex() {
  return pixelTex(64, 64, (g, W, H) => {
    P(g, 0, 0, W, H, '#9a9a9a');
    for (let y = 0, row = 0; y < H; y += 8, row++) for (let x = row % 2 ? -4 : 0; x < W; x += 8) {
      P(g, x + 1, y, 7, 7, '#e2e2e2'); P(g, x + 1, y + 6, 7, 2, '#b0b0b0'); P(g, x + 1, y, 7, 1, '#ffffff'); P(g, x + 2, y + 7, 5, 1, '#7a7a7a');
    }
  }, { seed: 3 });
}

function clockTex() {
  const t = pixelTex(128, 128, (g, W, H) => {
    P(g, 0, 0, W, H, '#c9a24a');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 64, y - 64);
      if (d < 54) P(g, x, y, 1, 1, d > 50 ? '#8a6a2a' : '#f4ead2');
    }
    g.save(); g.translate(64, 64);
    for (let k = 0; k < 12; k++) {
      g.rotate(Math.PI / 6);
      P(g, -2, -48, 4, k % 3 === 2 ? 12 : 7, '#3a2a1a');
    }
    g.restore();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - 64, y - 64); if (d < 16 && d > 12) P(g, x, y, 1, 1, '#c9a24a'); }
  }, { repeat: false, seed: 5 });
  return t;
}

// ---------------------------------------------------------------- geometrias
function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// telhado de duas águas: cumeeira ao longo de z (sem índice)
function gableRoof(w, d, h, over = 0.7) {
  const x = w / 2 + over, z = d / 2 + over, sl = Math.hypot(x, h);
  const pos = [], uv = [];
  const quad = (a, b, c, e, uva) => { pos.push(...a, ...b, ...c, ...a, ...c, ...e); uv.push(...uva[0], ...uva[1], ...uva[2], ...uva[0], ...uva[2], ...uva[3]); };
  const U = (zz) => zz / 2.5, Vs = sl / 2.5;
  quad([-x, 0, z], [-x, 0, -z], [0, h, -z], [0, h, z], [[U(z), 0], [U(-z), 0], [U(-z), Vs], [U(z), Vs]]);
  quad([x, 0, -z], [x, 0, z], [0, h, z], [0, h, -z], [[U(-z), 0], [U(z), 0], [U(z), Vs], [U(-z), Vs]]);
  // lado de baixo do beiral
  quad([-x, 0, -z], [-x, 0, z], [x, 0, z], [x, 0, -z], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// empenas (triângulos das pontas), pintadas com o reboco liso da fachada
function gables(w, d, h) {
  const x = w / 2, z = d / 2;
  const pos = [-x, 0, z, x, 0, z, 0, h, z, x, 0, -z, -x, 0, -z, 0, h, -z];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0).map((_, i) => (i % 2 ? 0.985 : 0.06)), 2));
  g.computeVertexNormals();
  return g;
}

function gearGeo(r, teeth = 10, thick = 0.4) {
  const s = new THREE.Shape();
  const ri = r * 0.82;
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * Math.PI * 2, a1 = ((k + 0.25) / teeth) * Math.PI * 2, a2 = ((k + 0.5) / teeth) * Math.PI * 2, a3 = ((k + 0.75) / teeth) * Math.PI * 2;
    const pt = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
    if (k === 0) s.moveTo(...pt(a0, ri)); else s.lineTo(...pt(a0, ri));
    s.lineTo(...pt(a1, r)); s.lineTo(...pt(a2, r)); s.lineTo(...pt(a3, ri));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true);
  s.holes.push(hole);
  // raios: furos entre os braços
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.15, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -thick / 2);
  return g;
}

// ---------------------------------------------------------------- utilidades de posição
function clearOf(tr, x, z, need) { return tr.dist(x, z).d >= need; }
function inCanal(tr, x, z, m = 2) {
  if (!tr.water) return false;
  for (const [wx, wz, ww, wd] of tr.water) if (x > wx - m && x < wx + ww + m && z > wz - m && z < wz + wd + m) return true;
  return false;
}

// ================================================================= cena
export function oficina(tr, rnd, H) {
  const N = tr.N;
  const occupied = []; // círculos já usados [x, z, r]
  const free = (x, z, r) => occupied.every(([ox, oz, or]) => Math.hypot(x - ox, z - oz) > r + or);
  const tw = tr.def.tower ? new THREE.Vector3((tr.mirror ? -1 : 1) * tr.def.tower[0], 0, tr.def.tower[1]) : null;
  if (tw) occupied.push([tw.x, tw.z, 16]);

  // arquibancada perto da largada, e o outro lado fica para as casas
  const gsSide = H.sideWithRoom(tr, 12);
  H.grandstand(tr, 12, gsSide, 56);
  for (let k = -20; k <= 44; k += 6) { const p = tr.point((k + N) % N, gsSide * (EDGE + 14)); occupied.push([p.x, p.z, 12]); }

  const mats = {
    wall: lam({ map: facadeTex(), vertexColors: true }),
    roof: lam({ map: roofTex(), vertexColors: true, side: THREE.DoubleSide }),
    brick: lam({ map: brickTex() }),
    brass: phong({ color: BRASS, shininess: 70, specular: 0x887755 }),
    iron: lam({ color: IRON }),
    copper: phong({ color: COPPER, shininess: 50, specular: 0x553322 }),
  };
  const PLASTER = [0xf1e3c0, 0xe8c070, 0xe89a78, 0xa8d0c4, 0xc4bcd6, 0xb0cce4, 0xf4d4a8, 0xd8e4a0];
  const ROOFS = [0xc0603a, 0x5a6473, 0x6fb09c, 0x8e3b2a, 0x9a5a34];

  const wallGeos = [], roofGeos = [], brickGeos = [], brassGeos = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const place = (geo, pos, rotY, tilt = 0, extra = null) => {
    e.set(0, rotY, tilt);
    q.setFromEuler(e);
    m4.compose(pos, q, one);
    if (extra) geo.applyMatrix4(extra);
    geo.applyMatrix4(m4);
    return geo;
  };
  const puffTex = H.SPR.fumaca();
  const smokers = [];
  const gears = [];
  const gearShared = gearGeo(1, 10, 0.35);

  const signMats = new Map();
  const signMat = (ad) => { if (!signMats.has(ad)) signMats.set(ad, lam({ map: H.adTexture(ad) })); return signMats.get(ad); };
  const signBoard = new THREE.BoxGeometry(2.8, 1.4, 0.12), signArm = new THREE.BoxGeometry(3.2, 0.12, 0.12);

  // ------------------------------------------------ casas ao longo das ruas
  let houses = 0;
  for (const side of [1, -1]) {
    let i = 0;
    while (i < N) {
      const dz = 8 + rnd() * 5, dx = 8 + rnd() * 4, hgt = 7 + rnd() * 6;
      const step = Math.max(4, Math.round(dz + 1));
      const k = i % N;
      i += step;
      if (tr.bridge[k] || (side === gsSide && (k > N - 22 || k < 46))) continue;
      const lat = side * (EDGE + 3.5 + dx / 2 + rnd() * 2);
      const c = tr.point(k, lat);
      const rad = Math.hypot(dx, dz) / 2;
      if (!clearOf(tr, c.x, c.z, EDGE + 2.5 + rad * 0.75) || inCanal(tr, c.x, c.z, rad + 2) || !free(c.x, c.z, rad * 0.85)) continue;
      // casinhas pequenas nas pontas para preencher
      occupied.push([c.x, c.z, rad * 0.85]);
      const y = tr.terrainY(c.x, c.z) - 0.1;
      const rotY = tr.heading(k);
      const tilt = (rnd() - 0.5) * 0.06; // tortinhas de propósito
      const base = new THREE.Vector3(c.x, y, c.z);
      const plaster = PLASTER[(rnd() * PLASTER.length) | 0];
      const variant = rnd() < 0.45 ? 0 : 1;
      // paredes
      const box = new THREE.BoxGeometry(dx, hgt, dz).toNonIndexed();
      box.translate(0, hgt / 2, 0);
      const uv = box.attributes.uv;
      for (let n = 0; n < uv.count; n++) uv.setX(n, (uv.getX(n) + variant) / 2);
      // topo e fundo da caixa: reboco liso
      for (let n = 12; n < 24; n++) uv.setXY(n, 0.03 + variant * 0.5, 0.985);
      wallGeos.push(tint(place(box, base, rotY, tilt), plaster));
      // telhado (às vezes atravessado) com empenas
      const across = rnd() < 0.35;
      const rh = 3 + rnd() * 2.5;
      const rw = across ? dz : dx, rd = across ? dx : dz;
      const rot = new THREE.Matrix4().makeRotationY(across ? Math.PI / 2 : 0);
      const lift = new THREE.Matrix4().makeTranslation(0, hgt, 0).multiply(rot).multiply(new THREE.Matrix4().makeRotationZ((rnd() - 0.5) * 0.08));
      roofGeos.push(tint(place(gableRoof(rw, rd, rh), base, rotY, tilt, lift), ROOFS[(rnd() * ROOFS.length) | 0]));
      const gb = gables(rw, rd, rh);
      const gu = gb.attributes.uv; for (let n = 0; n < gu.count; n++) gu.setX(n, 0.03 + variant * 0.5);
      wallGeos.push(tint(place(gb, base, rotY, tilt, lift), plaster));
      // chaminé
      if (rnd() < 0.7) {
        const cx = (rnd() - 0.5) * dx * 0.5, cz = (rnd() - 0.5) * dz * 0.5, ch = rh + 1.5 + rnd() * 1.5;
        const chim = new THREE.BoxGeometry(1.2, ch, 1.2).toNonIndexed();
        chim.translate(cx, hgt + ch / 2, cz);
        brickGeos.push(place(chim, base, rotY, tilt));
        if (houses % 3 === 0) {
          const top = new THREE.Vector3(cx, hgt + ch + 0.3, cz).applyEuler(new THREE.Euler(0, rotY, tilt)).add(base);
          smokers.push(top);
        }
      }
      // engrenagem girando na fachada virada para a rua
      if (rnd() < 0.28 && gears.length < 14) {
        const r = 1.4 + rnd() * 1.2;
        const g = new THREE.Mesh(gearShared, mats.brass);
        g.scale.set(r, r, 1);
        const fx = side * (dx / 2 + 0.2); // x local aponta para o lado "-" da pista: a rua fica em +side
        const local = new THREE.Vector3(fx, hgt * (0.45 + rnd() * 0.3), (rnd() - 0.5) * dz * 0.4);
        const holder = new THREE.Group();
        holder.position.copy(local.applyEuler(new THREE.Euler(0, rotY, 0)).add(base));
        holder.rotation.y = rotY + Math.PI / 2;
        holder.add(g);
        tr.group.add(holder);
        gears.push({ g, s: (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.8) / r });
      }
      // placa de loja pendurada, de frente para quem vem
      if (variant === 0 && rnd() < 0.55) {
        const ad = H.ADS[(rnd() * H.ADS.length) | 0];
        const sg = new THREE.Group();
        const local = new THREE.Vector3(side * (dx / 2 + 1.6), hgt * 0.62, dz * 0.3);
        sg.position.copy(local.applyEuler(new THREE.Euler(0, rotY, 0)).add(base));
        sg.rotation.y = rotY;
        const board = new THREE.Mesh(signBoard, [mats.iron, mats.iron, mats.iron, mats.iron, signMat(ad), signMat(ad)]);
        board.position.y = -0.9;
        sg.add(board);
        const arm = new THREE.Mesh(signArm, mats.iron);
        arm.position.set(-side * 0.2, 0, 0);
        sg.add(arm);
        tr.group.add(sg);
      }
      houses++;
    }
  }
  const addMerged = (list, mat) => { if (list.length) tr.group.add(new THREE.Mesh(mergeGeometries(list), mat)); };
  addMerged(wallGeos, mats.wall);
  addMerged(roofGeos, mats.roof);
  addMerged(brickGeos, mats.brick);
  addMerged(brassGeos, mats.brass);

  // fumaça das chaminés
  const smokeSprites = [];
  for (const top of smokers.slice(0, 18)) {
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xd8d4cc }));
      tr.group.add(s);
      smokeSprites.push({ s, top, t: k / 3 + rnd() * 0.1 });
    }
  }

  // ------------------------------------------------ torre do relógio na praça
  let hands = null;
  if (tw) {
    tw.y = tr.terrainY(tw.x, tw.z);
    const g = new THREE.Group(); g.position.copy(tw); tr.group.add(g);
    // praça de pedra
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(15, 24), lam({ color: 0xb8a890 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.12; g.add(plaza);
    const ring = new THREE.Mesh(new THREE.RingGeometry(13.5, 15, 24), lam({ color: 0x8a7a64 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14; g.add(ring);
    const bt = brickTex('#b5654a', '#5e3324'); bt.repeat.set(2, 5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8), lam({ map: bt }));
    body.position.y = 12; g.add(body);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1, 9.2), mats.brass); cornice.position.y = 18; g.add(cornice);
    const top = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 9), lam({ map: bt })); top.position.y = 22.5; g.add(top);
    const cap2 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 10), mats.brass); cap2.position.y = 26.3; g.add(cap2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.4, 9, 4), phong({ color: 0x6fb09c, shininess: 40 }));
    roof.position.y = 31.2; roof.rotation.y = Math.PI / 4; roof.rotation.z = 0.05; g.add(roof); // levemente torta
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4), mats.brass); spire.position.y = 37; g.add(spire);
    const vane = new THREE.Group(); vane.position.y = 38.5; g.add(vane);
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.1), mats.brass); vane.add(arrow);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.08), mats.brass); tail.position.x = -1.4; vane.add(tail);
    const faceMat = lam({ map: clockTex() });
    hands = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const f = new THREE.Group(); f.rotation.y = a; f.position.y = 22.5; g.add(f);
      const face = new THREE.Mesh(new THREE.CircleGeometry(3.1, 24), faceMat); face.position.z = 4.52; f.add(face);
      const hh = new THREE.Group(); hh.position.z = 4.6; f.add(hh);
      const mh = new THREE.Group(); mh.position.z = 4.66; f.add(mh);
      const hb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.6, 0.06), lam({ color: 0x2a1a10 })); hb.position.y = 0.7; hh.add(hb);
      const mb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.06), lam({ color: 0x2a1a10 })); mb.position.y = 1.1; mh.add(mb);
      hands.push([hh, mh]);
      // engrenagem grande atrás do relógio, aparecendo de lado
      if (k % 2 === 0) {
        const gg = new THREE.Mesh(gearShared, mats.copper); gg.scale.set(2.2, 2.2, 1);
        const holder = new THREE.Group(); holder.position.set(4.3, -6, 0); holder.rotation.y = Math.PI / 2; f.add(holder); holder.add(gg);
        gears.push({ g: gg, s: 0.35 });
      }
    }
    // canos subindo pela torre
    for (const s of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 17, 8), mats.copper);
      pipe.position.set(s * 4.3, 8.5, 2.5); g.add(pipe);
      const valve = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 6, 12), mats.brass);
      valve.position.set(s * 4.9, 6, 2.5); valve.rotation.y = Math.PI / 2; g.add(valve);
    }
    // bancos e canteiro
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), lam({ color: 0x8a5a34 }));
      bench.position.set(Math.cos(a) * 9.5, 0.6, Math.sin(a) * 9.5); bench.rotation.y = -a + Math.PI / 2; g.add(bench);
    }
    let vt = 0;
    tr.animated.push((dt) => { vt += dt; vane.rotation.y = Math.sin(vt * 0.3) * 1.2; });
  }

  // ------------------------------------------------ canal: cais de tijolo, barquinhos e roda d'água
  if (tr.water) {
    for (const [wx, wz, ww, wd] of tr.water) {
      const qt = brickTex('#8f7a66', '#4a3f36'); qt.repeat.set(ww / 6, 1);
      const quay = lam({ map: qt });
      const coping = lam({ color: 0xb8aa94 });
      for (const z of [wz, wz + wd]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, 3.2, 0.8), quay);
        wall.position.set(wx + ww / 2, -1.55, z); tr.group.add(wall);
        const cp = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.3, 1.6), coping);
        cp.position.set(wx + ww / 2, 0.05, z + (z === wz ? -0.4 : 0.4)); tr.group.add(cp);
        // calçada ao longo do cais (cobre a descida do terreno)
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(ww, 6.5), lam({ color: 0x9c8e78 }));
        walk.rotation.x = -Math.PI / 2; walk.position.set(wx + ww / 2, -0.1, z + (z === wz ? -3.25 : 3.25)); tr.group.add(walk);
      }
      // barquinhos ancorados
      const boatCols = [0xb0322a, 0x2f6a5a, 0xe8a221, 0x35506a];
      for (let k = 0; k < 7; k++) {
        const x = wx + ww / 2 + (rnd() - 0.5) * 400, z = wz + 3 + rnd() * (wd - 6);
        if (!clearOf(tr, x, z, EDGE + 6)) continue;
        const b = new THREE.Group(); b.position.set(x, (tr.def.waterY ?? 0) + 0.2, z); b.rotation.y = (rnd() - 0.5) * 0.4; tr.group.add(b);
        const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 7, 8, 1, false, 0, Math.PI), lam({ color: boatCols[k % 4], side: THREE.DoubleSide }));
        hull.rotation.z = Math.PI / 2; hull.rotation.y = Math.PI / 2; hull.rotation.x = Math.PI; b.add(hull);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), lam({ color: 0xefe2c2 })); cab.position.y = 0.8; b.add(cab);
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 8), mats.brass); stack.position.set(0, 2.1, -0.4); b.add(stack);
        let bt = rnd() * 6;
        tr.animated.push((dt) => { bt += dt; b.position.y = (tr.def.waterY ?? 0) + 0.2 + Math.sin(bt * 1.3) * 0.08; b.rotation.z = Math.sin(bt) * 0.04; });
      }
      // moinho com roda d'água na beira do canal
      let best = null;
      for (let t = 0; t < 40 && !best; t++) {
        const x = (rnd() - 0.5) * 300, z = wz - 5.5;
        if (clearOf(tr, x, z, EDGE + 18) && free(x, z, 9) && tr.dist(x, z + 7).d > EDGE + 8) best = new THREE.Vector3(x, 0, z);
      }
      if (best) {
        occupied.push([best.x, best.z, 9]);
        const g = new THREE.Group(); g.position.copy(best); tr.group.add(g);
        const mill = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 9), lam({ color: 0xe8c070 })); mill.position.y = 4.5; g.add(mill);
        const mr = new THREE.Mesh(gableRoof(12, 9, 4), lam({ color: 0x8e3b2a, side: THREE.DoubleSide })); mr.position.y = 9; mr.rotation.y = Math.PI / 2; g.add(mr);
        const wheel = new THREE.Group(); wheel.position.set(0, -0.6, 7); wheel.rotation.y = Math.PI / 2; g.add(wheel);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 6, 20), lam({ color: 0x6b4426 })); rim.rotation.y = Math.PI / 2; wheel.add(rim);
        for (let k = 0; k < 10; k++) {
          const arm = new THREE.Group(); arm.rotation.x = (k / 10) * Math.PI * 2; wheel.add(arm);
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), lam({ color: 0x6b4426 })); sp.position.y = 2; arm.add(sp);
          const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.1), lam({ color: 0x8a5a34 })); pad.position.y = 4.1; arm.add(pad);
        }
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 10), mats.brass); axle.rotation.z = Math.PI / 2; wheel.add(axle);
        tr.animated.push((dt) => { wheel.rotation.x -= dt * 0.6; });
      }
    }
  }

  // ------------------------------------------------ lampiões a gás nas calçadas
  {
    const postGeo = new THREE.CylinderGeometry(0.12, 0.18, 4.6, 6); postGeo.translate(0, 2.3, 0);
    const headGeo = new THREE.BoxGeometry(0.6, 0.8, 0.6); headGeo.translate(0, 4.9, 0);
    const capGeo = new THREE.ConeGeometry(0.55, 0.5, 4); capGeo.rotateY(Math.PI / 4); capGeo.translate(0, 5.5, 0);
    const spots = [];
    for (let i = 4; i < N; i += 22) for (const s of [1, -1]) {
      if (tr.bridge[i] || tr.inTunnel?.(i)) continue;
      const p = tr.point(i, s * (EDGE + 1.3));
      if (!clearOf(tr, p.x, p.z, EDGE + 0.8)) continue;
      p.y = tr.py[i];
      spots.push(p);
    }
    const mk = (geo, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach((p, n) => im.setMatrixAt(n, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
      tr.group.add(im);
    };
    mk(postGeo, mats.iron);
    mk(headGeo, basic({ color: 0xffe2a0 }));
    mk(capGeo, mats.brass);
  }

  // ------------------------------------------------ canos de vapor atravessando a rua
  const vents = [];
  for (const f of [0.3, 0.86]) {
    let i = Math.round(f * N);
    for (let t = 0; t < 40 && (tr.curv[i] > 0.35 || tr.bridge[i]); t++) i = (i + 3) % N;
    const g = new THREE.Group();
    tr.point(i, 0, g.position); g.position.y = tr.py[i];
    g.rotation.y = tr.heading(i);
    tr.group.add(g);
    const span = (EDGE + 2) * 2;
    for (const s of [1, -1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 1), lam({ map: brickTex() })); col.position.set(s * (EDGE + 2), 4.5, 0); g.add(col);
    }
    for (const [y, z, r, mat] of [[8.2, 0, 0.55, mats.copper], [9.3, 0.9, 0.35, mats.brass]]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, span + 1.5, 10), mat); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, y, z); g.add(pipe);
      for (const x of [-span / 3, span / 3]) { const flange = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.3, 10), mats.brass); flange.rotation.z = Math.PI / 2; flange.position.set(x, y, z); g.add(flange); }
    }
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.14, 6, 14), lam({ color: 0xb0322a })); valve.position.set(3, 7.1, 0); valve.rotation.x = Math.PI / 2; g.add(valve);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 14), lam({ color: 0xf4ead2 })); gauge.rotation.x = Math.PI / 2; gauge.position.set(-4, 8.2, 0.65); g.add(gauge);
    vents.push(new THREE.Vector3(-2, 8.6, 0).applyEuler(g.rotation).add(g.position));
  }
  const ventPuffs = [];
  for (const v of vents) for (let k = 0; k < 5; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xffffff }));
    tr.group.add(s); ventPuffs.push({ s, v, t: k / 5 });
  }

  // ------------------------------------------------ chaminés de fábrica ao fundo
  const stacks = [];
  for (let k = 0; k < 4; k++) {
    const p = H.findPlace(tr, rnd, 55, 120, (pp) => !inCanal(tr, pp.x, pp.z, 6) && free(pp.x, pp.z, 8));
    if (!p) continue;
    occupied.push([p.x, p.z, 8]);
    const g = new THREE.Group(); g.position.copy(p); tr.group.add(g);
    const st = brickTex('#9a4a32', '#4a2418'); st.repeat.set(3, 8);
    const h = 34 + rnd() * 14;
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3, h, 12), lam({ map: st })); stack.position.y = h / 2; g.add(stack);
    for (const y of [h * 0.35, h * 0.7, h]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.7, 12), mats.brass); band.position.y = y; g.add(band); }
    const hall = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 14), lam({ color: 0xb5654a })); hall.position.set(9, 5, 0); g.add(hall);
    const hr = new THREE.Mesh(gableRoof(18, 14, 4), lam({ color: 0x5a6473, side: THREE.DoubleSide })); hr.position.set(9, 10, 0); hr.rotation.y = Math.PI / 2; g.add(hr);
    stacks.push(new THREE.Vector3(p.x, p.y + h + 0.5, p.z));
  }
  const stackPuffs = [];
  for (const top of stacks) for (let k = 0; k < 7; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xb8b0a8 }));
    tr.group.add(s); stackPuffs.push({ s, top, t: k / 7 });
  }

  // ------------------------------------------------ dirigível passeando sobre a cidade
  const ship = new THREE.Group(); tr.group.add(ship);
  {
    const env = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 12), phong({ color: 0xe8c070, shininess: 30 })); env.scale.set(2.6, 1, 1); ship.add(env);
    for (let k = -2; k <= 2; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(5.02 * Math.sqrt(1 - (k / 2.9) ** 2), 0.12, 4, 20), mats.brass); band.rotation.y = Math.PI / 2; band.position.x = k * 4; ship.add(band); }
    for (const [ry, rz] of [[0, 0], [0, Math.PI / 2]]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.2), lam({ color: 0xb0322a })); fin.position.x = -12; fin.rotation.set(rz, ry, 0); ship.add(fin); }
    const gond = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 2.2), lam({ color: 0x6b4426 })); gond.position.y = -6.2; ship.add(gond);
    for (const x of [-2, 2]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2), mats.iron); rope.position.set(x, -5, 0); ship.add(rope); }
    const prop = new THREE.Group(); prop.position.set(-3.6, -6.2, 0); ship.add(prop);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.4), mats.brass); b.rotation.x = (k / 3) * Math.PI * 2; prop.add(b); }
    ship.userData.prop = prop;
  }
  const C = tr.center;

  // ------------------------------------------------ caixotes e barris pelas calçadas
  {
    const crates = [], barrels = [];
    for (let k = 0; k < 30; k++) {
      const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
      const p = tr.point(i, s * (EDGE + 2.2 + rnd() * 1.5));
      if (tr.bridge[i] || !clearOf(tr, p.x, p.z, EDGE + 1.5) || inCanal(tr, p.x, p.z, 1) || !free(p.x, p.z, 1)) continue;
      p.y = tr.terrainY(p.x, p.z);
      const crate = rnd() < 0.5;
      const geo = crate ? new THREE.BoxGeometry(1.2, 1.2, 1.2).toNonIndexed() : new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10).toNonIndexed();
      geo.rotateY(rnd() * 3); geo.translate(p.x, p.y + 0.6, p.z);
      (crate ? crates : barrels).push(geo);
    }
    addMerged(crates, lam({ color: 0x9a6a3a }));
    addMerged(barrels, lam({ color: 0x6b4426 }));
  }

  // ------------------------------------------------ animações
  let t = 0;
  tr.animated.push((dt) => {
    t += dt;
    for (const { g, s } of gears) g.rotation.z += dt * s;
    if (hands) for (const [hh, mh] of hands) { mh.rotation.z = -t * 0.5; hh.rotation.z = -t * 0.5 / 12 - 1; }
    for (const p of smokeSprites) {
      p.t = (p.t + dt * 0.22) % 1;
      p.s.position.set(p.top.x + p.t * 1.5, p.top.y + p.t * 6, p.top.z);
      p.s.scale.setScalar(0.8 + p.t * 2.6); p.s.material.opacity = 0.75 * (1 - p.t);
    }
    for (const p of stackPuffs) {
      p.t = (p.t + dt * 0.12) % 1;
      p.s.position.set(p.top.x + p.t * 8, p.top.y + p.t * 16, p.top.z + p.t * 3);
      p.s.scale.setScalar(2.5 + p.t * 9); p.s.material.opacity = 0.7 * (1 - p.t);
    }
    // vapor em baforadas: sai com força, para, sai de novo
    const burst = (t % 4) < 1.6;
    for (const p of ventPuffs) {
      p.t = (p.t + dt * (burst ? 0.9 : 0.25)) % 1;
      p.s.position.set(p.v.x, p.v.y + p.t * 4, p.v.z);
      p.s.scale.setScalar(0.6 + p.t * 3); p.s.material.opacity = (burst ? 0.85 : 0.35) * (1 - p.t);
    }
    const a = t * 0.035;
    ship.position.set(C.x + Math.cos(a) * 110, 58 + Math.sin(t * 0.4) * 1.5, C.z + Math.sin(a) * 80);
    ship.rotation.y = -a - Math.PI / 2 + Math.atan2(80, 110) * 0;
    ship.userData.prop.rotation.x += dt * 10;
  });
}
