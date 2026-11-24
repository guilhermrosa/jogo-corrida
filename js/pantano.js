import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { pixelTex } from './textures.js';

// =====================================================================
//  BREJO DAS CALDEIRAS — pântano com máquinas (Copa Engrenagem)
//  Calçadão de tábuas sobre a água, árvores retorcidas com barba-de-velho,
//  cogumelos que brilham, vitórias-régias, lampiões, cano-mestre, bombas
//  de vareta, barco a vapor, cabanas de caldeira, vaga-lumes e libélulas.
// =====================================================================

const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);
const BRASS = 0xc9a24a, IRON = 0x3b3632, COPPER = 0xb8673a, RUST = 0x8a4a2a, WOOD = 0x5e4630;

function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const ni = (g) => (g.index ? g.toNonIndexed() : g);
// cilindro ligando dois pontos
function limb(a, b, r0, r1, seg = 7) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function mossTex() {
  return pixelTex(16, 64, (g, W, H, r) => {
    g.clearRect(0, 0, W, H);
    for (let k = 0; k < 7; k++) {
      const x = 1 + r() * (W - 3), len = 20 + r() * 42;
      for (let y = 0; y < len; y++) {
        const xx = x + Math.sin(y * 0.3 + k) * 1.2;
        g.fillStyle = y % 5 === 0 ? '#c8dca0' : '#9ab87a';
        g.fillRect(xx | 0, y, 2, 1);
      }
    }
  }, { repeat: false, seed: 8 });
}
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function pantano(tr, rnd, H) {
  const N = tr.N;
  const WY = tr.def.waterY;
  const onLand = (x, z) => tr.terrainY(x, z) > WY + 0.15;
  const occupied = [];
  const free = (x, z, r) => occupied.every(([ox, oz, or]) => Math.hypot(x - ox, z - oz) > r + or);
  const clear = (x, z, need) => tr.dist(x, z).d >= need;
  // ponto aleatório perto da pista, a uma distância lateral entre a e b
  const around = (a, b) => {
    const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
    const p = tr.point(i, s * (EDGE + a + rnd() * (b - a)));
    p.y = tr.terrainY(p.x, p.z);
    return p;
  };
  const mats = {
    iron: lam({ color: IRON }), rust: lam({ color: RUST }), wood: lam({ color: WOOD }),
    brass: phong({ color: BRASS, shininess: 70, specular: 0x887755 }), copper: phong({ color: COPPER, shininess: 50, specular: 0x553322 }),
    lamp: basic({ color: 0xffc870 }),
  };
  const puffTex = H.SPR.fumaca();
  const smokers = [];

  H.grandstand(tr, 12, H.sideWithRoom(tr, 12), 50);
  for (let k = -20; k <= 40; k += 6) for (const s of [1, -1]) { const p = tr.point((k + N) % N, s * (EDGE + 12)); occupied.push([p.x, p.z, 3]); }

  // ------------------------------------------------ NAVIO-CALDEIRA: a pista entra pela proa e atravessa a casa de máquinas
  const shipAnims = [];
  if (tr.def.ship) {
    const mx = tr.mirror ? -1 : 1, sd = tr.def.ship;
    const idx = [];
    for (let i = 0; i < N; i++) { const x = mx * tr.px[i]; if (x >= sd.x0 && x <= sd.x1 && tr.pz[i] < sd.zMax) idx.push(i); }
    if (idx.length > 20) {
      // os índices podem dar a volta no fim da pista: ordena pela sequência contínua
      idx.sort((a, b) => a - b);
      let i0 = idx[0], i1 = idx[idx.length - 1];
      const im = idx[Math.floor(idx.length / 2)];
      const A = tr.point(i0, 0), B = tr.point(i1, 0);
      const L = A.distanceTo(B);
      const D = tr.py[im];
      const g = new THREE.Group();
      g.position.copy(A.clone().add(B).multiplyScalar(0.5)); g.position.y = 0;
      g.rotation.y = Math.atan2(B.x - A.x, B.z - A.z); // +z local = sentido da corrida (proa em -z, por onde se entra)
      tr.group.add(g);
      for (let k = 0; k < idx.length; k += 4) { const p = tr.point(idx[k], 0); occupied.push([p.x, p.z, 26]); }
      const W = EDGE + 3, T = 1.2;
      const plate = pixelTex(64, 64, (c, w, h, r) => {
        c.fillStyle = '#4a4440'; c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 32) {
          const k = 0.85 + r() * 0.3; c.fillStyle = `rgb(${90 * k | 0},${82 * k | 0},${76 * k | 0})`; c.fillRect(x + 1, y + 1, 31, 15);
          c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + 1, y + 1, 31, 1);
          c.fillStyle = '#c9a24a'; for (const [rx, ry] of [[3, 3], [28, 3], [3, 12], [28, 12]]) c.fillRect(x + rx, y + ry, 2, 2);
        }
      }, { seed: 41 });
      plate.repeat.set(L / 6, 2);
      const hullM = lam({ map: plate }), inner = lam({ map: plate.clone(), color: 0xd8c8b0 });
      inner.map.repeat.set(L / 5, 1.5); inner.map.needsUpdate = true;
      const red = lam({ color: 0x8a2e22 }), cream = lam({ color: 0xefe2c2 });
      const box = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
      const top = D + 9;
      for (const s of [1, -1]) {
        // costado: ferro rebitado, faixa vermelha na linha d'água e friso de latão
        box(T, top - (WY - 2), L, hullM, s * (W + T / 2), (top + WY - 2) / 2, 0);
        box(T + 0.3, 1.8, L + 0.2, red, s * (W + T / 2), WY + 0.5, 0);
        box(T + 0.5, 0.5, L + 0.4, mats.brass, s * (W + T / 2), top + 0.1, 0);
        box(0.3, 0.3, L, mats.brass, s * (W - 0.2), D + 3.2, 0); // corrimão interno
      }
      // vigias acesas dos dois lados
      {
        const port = [], rings = [];
        for (const s of [1, -1]) for (let z = -L / 2 + 4; z < L / 2 - 3; z += 4.5) for (const y of [D + 5.6, WY + 2.6]) {
          const c = new THREE.CircleGeometry(0.55, 10).toNonIndexed(); c.rotateY(s * Math.PI / 2); c.translate(s * (W + T + 0.02), y, z); port.push(c);
          const r = new THREE.TorusGeometry(0.62, 0.1, 4, 10).toNonIndexed(); r.rotateY(s * Math.PI / 2); r.translate(s * (W + T + 0.04), y, z); rings.push(r);
        }
        g.add(new THREE.Mesh(mergeGeometries(port), mats.lamp));
        g.add(new THREE.Mesh(mergeGeometries(rings), mats.brass));
      }
      // teto da casa de máquinas e convés
      box(2 * (W + T), 0.8, L, inner, 0, top + 0.4, 0);
      box(2 * (W + T) + 0.6, 0.3, L + 0.6, lam({ color: 0x7a5a3a }), 0, top + 0.95, 0);
      // lâmpadas no teto
      { const ls = []; for (let z = -L / 2 + 5; z < L / 2; z += 8) for (const x of [-6, 0, 6]) { const b = new THREE.BoxGeometry(1.2, 0.3, 1.2).toNonIndexed(); b.translate(x, top - 0.1, z); ls.push(b); } g.add(new THREE.Mesh(mergeGeometries(ls), mats.lamp)); }

      // casa de máquinas: pistões gigantes subindo e descendo, virabrequim girando
      for (const s of [1, -1]) {
        const cx = s * (W - 1.6);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, L - 6, 10), mats.iron); shaft.rotation.x = Math.PI / 2; shaft.position.set(cx, top - 1.6, 0); g.add(shaft);
        shipAnims.push((t) => { shaft.rotation.y = t * 3; });
        for (let k = 0; k < 5; k++) {
          const z = -L / 2 + 8 + k * ((L - 16) / 4);
          box(2.4, 2.2, 2.4, mats.copper, cx, D + 1.1, z);                        // cilindro
          box(2.7, 0.3, 2.7, mats.brass, cx, D + 2.25, z);
          const rod = box(0.45, 4.2, 0.45, mats.brass, cx, D + 4.2, z);            // haste
          const head = box(1.6, 0.9, 1.6, mats.iron, cx, D + 6, z);               // cruzeta
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 14), mats.copper); disc.rotation.x = Math.PI / 2; disc.position.set(cx, top - 1.6, z + 1.2); g.add(disc);
          const ph = k * 1.25;
          shipAnims.push((t) => { const y = Math.sin(t * 3 + ph) * 0.9; rod.position.y = D + 4.2 + y; head.position.y = D + 6 + y; disc.rotation.y = t * 3 + ph; });
          // manômetro na parede
          const gg = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14), lam({ color: 0xf4ead2 })); gg.position.set(s * (W - 0.05), D + 5, z + 3); gg.rotation.y = -s * Math.PI / 2; g.add(gg);
        }
        // canos correndo pelas paredes
        for (const y of [D + 7.4, D + 8]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, L, 8), y > D + 7.6 ? mats.copper : mats.brass); pp.rotation.x = Math.PI / 2; pp.position.set(s * (W - 0.4), y, 0); g.add(pp); }
      }

      // proa: visor levantado (como uma balsa) e rampa abaixada, a "ponte" de entrada
      const W1 = W + T;
      const bowShape = new THREE.Shape(); bowShape.moveTo(-W1, 0); bowShape.lineTo(W1, 0); bowShape.lineTo(W1 * 0.55, 9); bowShape.lineTo(0, 16); bowShape.lineTo(-W1 * 0.55, 9); bowShape.closePath();
      const bowGeo = new THREE.ExtrudeGeometry(bowShape, { depth: top - WY + 1, bevelEnabled: false });
      bowGeo.rotateX(-Math.PI / 2); bowGeo.translate(0, -(top - WY + 1), 0);
      const visor = new THREE.Group(); visor.position.set(0, top + 0.8, -L / 2); g.add(visor);
      const vm = new THREE.Mesh(bowGeo, [hullM, red]); visor.add(vm);
      visor.rotation.x = 1.25;
      const nameTex = pixelTex(128, 24, (c, w, h) => {
        c.fillStyle = '#2a2624'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9a24a'; c.fillRect(2, 2, w - 4, h - 4); c.fillStyle = '#5a1e14'; c.fillRect(4, 4, w - 8, h - 8);
        c.fillStyle = '#ffd98a'; c.font = 'bold 14px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CALDEIRÃO', w / 2, h / 2 + 1);
      }, { repeat: false });
      const name = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), lam({ map: nameTex })); name.position.set(0, top + 2.6, -L / 2 - 0.05); name.rotation.y = Math.PI; g.add(name);
      const nameBack = name.clone(); nameBack.rotation.y = 0; nameBack.position.z = -L / 2 + 0.6; g.add(nameBack);
      box(2 * W1, 2.6, 0.6, hullM, 0, top + 2.5, -L / 2 + 0.3);                // viga acima da entrada
      const ramp = box(2 * W - 2, 0.12, 10, lam({ map: plate.clone() }), 0, D + 0.12, -L / 2 - 5);
      ramp.material.map.repeat.set(3, 2); ramp.material.map.needsUpdate = true;
      for (const s of [1, -1]) {
        const a0 = new THREE.Vector3(s * (W - 2), D + 0.2, -L / 2 - 9.5), a1 = new THREE.Vector3(s * (W - 2), top + 2.6, -L / 2 - 1);
        const ch = new THREE.Mesh(limb(a0, a1, 0.1, 0.1, 5), mats.iron); g.add(ch);
        box(1.4, 1.4, 1.4, mats.brass, s * (W - 0.6), top + 2.6, -L / 2);       // roldanas
      }
      // popa: saída com comporta levantada e leme
      box(2 * W1, 2.6, 0.6, hullM, 0, top + 2.5, L / 2 - 0.3);
      const gate = box(2 * W - 1, 7, 0.4, hullM, 0, 0, 0); gate.geometry.translate(0, -3.5, 0); gate.position.set(0, top + 2.4, L / 2); gate.rotation.x = -1.15;
      box(0.8, 9, 5, red, 0, WY - 1, L / 2 + 3);

      // rodas de pás gigantes nos dois lados
      for (const s of [1, -1]) {
        const wheel = new THREE.Group(); wheel.position.set(s * (W1 + 2.6), D + 3, -2); g.add(wheel);
        for (const off of [-1.4, 1.4]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 6, 28), mats.iron); rim.rotation.y = Math.PI / 2; rim.position.x = off; wheel.add(rim); }
        for (let k = 0; k < 14; k++) {
          const arm = new THREE.Group(); arm.rotation.x = (k / 14) * Math.PI * 2; wheel.add(arm);
          const pad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 2.2), lam({ color: 0x6b4426 })); pad.position.y = 8.2; arm.add(pad);
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.6, 0.3), mats.iron); sp.position.y = 4.3; arm.add(sp);
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.4, 12), mats.brass); hub.rotation.z = Math.PI / 2; wheel.add(hub);
        const house = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 4.4, 24, 1, true, 0, Math.PI), lam({ color: 0xc9a24a, side: THREE.DoubleSide })); house.rotation.z = Math.PI / 2; house.position.set(s * (W1 + 2.6), D + 3, -2); g.add(house);
        shipAnims.push((t) => { wheel.rotation.x = -t * 0.7; });
      }

      // superestrutura: cabines, ponte de comando, chaminés e guindaste no convés
      const deckY = top + 1.1;
      box(2 * W - 6, 5, L * 0.42, cream, 0, deckY + 2.5, -L * 0.12);
      { const ws = []; for (const s of [1, -1]) for (let z = -L * 0.32; z < L * 0.08; z += 3) { const w = new THREE.PlaneGeometry(1.4, 1.6).toNonIndexed(); w.rotateY(s * Math.PI / 2); w.translate(s * (W - 2.95), deckY + 3, z); ws.push(w); } g.add(new THREE.Mesh(mergeGeometries(ws), mats.lamp)); }
      box(2 * W - 4, 0.4, L * 0.46, lam({ color: 0x2f6a5a }), 0, deckY + 5.2, -L * 0.12);
      box(10, 4, 7, cream, 0, deckY + 7.4, -L * 0.26);
      const bridgeWin = box(9, 1.4, 0.1, mats.lamp, 0, deckY + 8, -L * 0.26 - 3.56);
      box(11, 0.4, 8, lam({ color: 0x2f6a5a }), 0, deckY + 9.6, -L * 0.26);
      void bridgeWin;
      const stacks = [];
      for (const z of [L * 0.18, L * 0.32]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 16, 16), red); st.position.set(0, deckY + 8, z); g.add(st);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2, 1.4, 16), lam({ color: 0x1e1a18 })); cap.position.set(0, deckY + 16.6, z); g.add(cap);
        for (const y of [4, 9, 13]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.5, 16), mats.brass); b.position.set(0, deckY + y, z); g.add(b); }
        stacks.push(new THREE.Vector3(0, deckY + 17.5, z));
      }
      // engrenagem gigante entre as chaminés
      const bigGear = new THREE.Mesh(new THREE.TorusGeometry(4, 0.6, 6, 24), mats.brass); bigGear.position.set(W - 4, deckY + 6, L * 0.25); bigGear.rotation.y = Math.PI / 2; g.add(bigGear);
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const tth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 1), mats.brass); tth.position.set(Math.cos(a) * 4.7, Math.sin(a) * 4.7, 0); tth.rotation.z = a; bigGear.add(tth); }
      shipAnims.push((t) => { bigGear.rotation.z = t * 0.5; });
      // mastro com bandeirolas
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 14), mats.wood); mast.position.set(0, deckY + 7, -L * 0.42); g.add(mast);
      for (const z of [-L * 0.42]) { const fl = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), lam({ color: 0xb0322a, side: THREE.DoubleSide })); fl.position.set(1.5, deckY + 13, z); g.add(fl); shipAnims.push((t) => { fl.rotation.y = Math.sin(t * 2) * 0.3; }); }
      for (const p of stacks) smokers.push(p.clone().applyQuaternion(g.quaternion).add(g.position), p.clone().applyQuaternion(g.quaternion).add(g.position).add(new THREE.Vector3(0, 0.5, 0)));
      tr.landmarks = { ...(tr.landmarks || {}), ship: i0 };
    }
  }

  // ------------------------------------------------ árvores retorcidas com raízes e barba-de-velho
  {
    const trunks = [], crowns = [], moss = [];
    const mt = mossTex();
    let made = 0;
    for (let t = 0; t < 600 && made < 64; t++) {
      const p = around(3, made < 30 ? 22 : 60);
      if (!clear(p.x, p.z, EDGE + 4) || !free(p.x, p.z, 5)) continue;
      occupied.push([p.x, p.z, 4]);
      made++;
      const base = new THREE.Vector3(p.x, Math.max(p.y, WY) - 0.3, p.z);
      const H0 = 5 + rnd() * 5, lean = new THREE.Vector3((rnd() - 0.5) * 7, 0, (rnd() - 0.5) * 7);
      const pts = [base.clone().add(new THREE.Vector3(0, 1.8, 0))];
      for (let k = 1; k <= 4; k++) pts.push(base.clone().add(new THREE.Vector3(lean.x * Math.sin(k * 0.6) + (rnd() - 0.5) * 2.5, 1.8 + (H0 * k) / 4, lean.z * Math.sin(k * 0.6) + (rnd() - 0.5) * 2.5)));
      const r0 = 1 + rnd() * 0.7;
      for (let k = 0; k < 4; k++) trunks.push(tint(limb(pts[k], pts[k + 1], r0 * (1 - k * 0.18), r0 * (1 - (k + 1) * 0.18)), 0x4a3c2c));
      // raízes de mangue
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + rnd();
        const foot = base.clone().add(new THREE.Vector3(Math.cos(a) * (2 + rnd()), -0.6, Math.sin(a) * (2 + rnd())));
        const knee = base.clone().add(new THREE.Vector3(Math.cos(a) * 1.2, 1.2, Math.sin(a) * 1.2));
        trunks.push(tint(limb(foot, knee, 0.18, 0.22, 5), 0x3e3224), tint(limb(knee, pts[0], 0.22, r0 * 0.9, 5), 0x3e3224));
      }
      // galhos e copa achatada em tufos
      const top = pts[4];
      const cols = [0x3e6a3a, 0x4a7a40, 0x365e34, 0x56803e];
      for (let k = 0; k < 5 + (rnd() * 3 | 0); k++) {
        const a = rnd() * Math.PI * 2, rr = 3 + rnd() * 4;
        const c = top.clone().add(new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.8) * 2.5, Math.sin(a) * rr));
        const elbow = pts[2 + (k % 2)].clone().lerp(c, 0.5); elbow.y += 1.2;
        trunks.push(tint(limb(pts[2 + (k % 2)], elbow, 0.5, 0.32, 5), 0x4a3c2c), tint(limb(elbow, c, 0.32, 0.16, 5), 0x4a3c2c));
        const blob = new THREE.IcosahedronGeometry(3 + rnd() * 2, 1).toNonIndexed();
        blob.scale(1.25, 0.55, 1.25); blob.translate(c.x, c.y + 0.4, c.z);
        crowns.push(tint(blob, cols[(rnd() * 4) | 0]));
        // barba-de-velho pendurada
        for (let m = 0; m < 4; m++) {
          const len = 3 + rnd() * 5;
          const pl = new THREE.PlaneGeometry(1.2, len); pl.translate(0, -len / 2, 0); pl.rotateY(rnd() * Math.PI);
          pl.translate(c.x + (rnd() - 0.5) * 5, c.y - 0.5, c.z + (rnd() - 0.5) * 5);
          moss.push(ni(pl));
        }
      }
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(trunks), lam({ vertexColors: true })));
    tr.group.add(new THREE.Mesh(mergeGeometries(crowns), lam({ vertexColors: true, flatShading: true })));
    tr.group.add(new THREE.Mesh(mergeGeometries(moss), lam({ map: mt, alphaTest: 0.5, side: THREE.DoubleSide })));
  }

  // ------------------------------------------------ cogumelos que brilham
  {
    const stems = [], caps = [], spots = [];
    const glow = [0xff6fb0, 0x4fe0d0, 0xb070ff, 0xffa040];
    for (let t = 0, made = 0; t < 600 && made < 44; t++) {
      const p = around(2, 30);
      if (!onLand(p.x, p.z) || !clear(p.x, p.z, EDGE + 2) || !free(p.x, p.z, 2)) continue;
      made++;
      const col = glow[(rnd() * glow.length) | 0];
      const n = 2 + (rnd() * 4 | 0);
      for (let k = 0; k < n; k++) {
        const s = k === 0 ? (made % 4 === 0 ? 4 + rnd() * 2.5 : 1.4 + rnd() * 2.4) : 0.5 + rnd() * 1;
        const x = p.x + (k ? (rnd() - 0.5) * 4 : 0), z = p.z + (k ? (rnd() - 0.5) * 4 : 0);
        const y = tr.terrainY(x, z);
        const h = s * 1.6, lean = (rnd() - 0.5) * 0.3;
        const st = new THREE.CylinderGeometry(s * 0.16, s * 0.24, h, 8).toNonIndexed(); st.rotateZ(lean); st.translate(x, y + h / 2, z);
        stems.push(st);
        const cap = new THREE.SphereGeometry(s * 0.75, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(); cap.scale(1, 0.62, 1); cap.rotateZ(lean); cap.translate(x - Math.sin(lean) * h, y + h * 0.98, z);
        caps.push(tint(cap, col));
        for (let m = 0; m < 4; m++) {
          const a = rnd() * Math.PI * 2, rr = s * 0.45;
          const sp = new THREE.SphereGeometry(s * 0.09, 5, 4).toNonIndexed();
          sp.translate(x - Math.sin(lean) * h + Math.cos(a) * rr, y + h * 0.98 + s * 0.3, z + Math.sin(a) * rr);
          spots.push(sp);
        }
      }
      occupied.push([p.x, p.z, 2.5]);
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(stems), lam({ color: 0xe8dcc0, emissive: 0x3a3428 })));
    tr.group.add(new THREE.Mesh(mergeGeometries(caps), basic({ vertexColors: true })));
    tr.group.add(new THREE.Mesh(mergeGeometries(spots), basic({ color: 0xfff4d8 })));
  }

  // ------------------------------------------------ vitórias-régias com flor, e taboas
  {
    const pads = [], flowers = [], reeds = [], heads = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let t = 0; t < 2500 && pads.length < 320; t++) {
      const p = around(1.5, 60);
      if (onLand(p.x, p.z) || !clear(p.x, p.z, EDGE + 1.2)) continue;
      const r = 0.6 + rnd() * 1.1;
      q.setFromAxisAngle(up, rnd() * 6.28);
      pads.push(m4.clone().compose(new THREE.Vector3(p.x, WY + 0.04, p.z), q, sc.set(r, 1, r)));
      if (rnd() < 0.2) flowers.push(new THREE.Matrix4().makeTranslation(p.x + 0.2, WY + 0.25, p.z));
    }
    for (let t = 0; t < 3000 && reeds.length < 520; t++) {
      const p = around(1, 50);
      if (!clear(p.x, p.z, EDGE + 1) || Math.abs(tr.terrainY(p.x, p.z) - WY) > 0.7) continue; // na beira da água
      for (let k = 0; k < 4; k++) {
        const x = p.x + (rnd() - 0.5) * 2, z = p.z + (rnd() - 0.5) * 2, h = 1.6 + rnd() * 1.8;
        q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25));
        reeds.push(new THREE.Matrix4().compose(new THREE.Vector3(x, WY - 0.2, z), q, sc.set(1, h, 1)));
        if (rnd() < 0.5) heads.push(new THREE.Matrix4().compose(new THREE.Vector3(x, WY - 0.2 + h * 0.88, z), q, new THREE.Vector3(1, 1, 1)));
      }
    }
    const inst = (geo, mat, list) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, n) => im.setMatrixAt(n, m)); tr.group.add(im); };
    const padGeo = new THREE.CircleGeometry(1, 10, 0.35, Math.PI * 2 - 0.7); padGeo.rotateX(-Math.PI / 2);
    inst(padGeo, lam({ color: 0x4e8a3a, side: THREE.DoubleSide }), pads);
    const fl = new THREE.ConeGeometry(0.3, 0.35, 6, 1, true); fl.rotateX(Math.PI);
    inst(fl, basic({ color: 0xff8fc8, side: THREE.DoubleSide }), flowers);
    const rg = new THREE.CylinderGeometry(0.03, 0.05, 1, 4); rg.translate(0, 0.5, 0);
    inst(rg, lam({ color: 0x6a7a3a }), reeds);
    inst(new THREE.CapsuleGeometry(0.11, 0.4, 2, 6), lam({ color: 0x5a3a20 }), heads);
  }

  // ------------------------------------------------ lampiões no corrimão e varais de lanternas
  {
    const posts = [], arms = [], lamps = [], caps = [];
    for (let i = 3; i < N; i += 18) {
      const s = (i / 18) % 2 < 1 ? 1 : -1;
      if (tr.isFall(i, s)) continue;
      const base = tr.point(i, s * (EDGE + 0.4)); base.y = tr.py[i];
      const inward = tr.point(i, s * (EDGE - 1.2)); inward.y = tr.py[i];
      const pTop = base.clone(); pTop.y += 4.2;
      const aEnd = inward.clone(); aEnd.y += 4.2;
      posts.push(limb(base, pTop, 0.12, 0.09, 6));
      arms.push(limb(pTop, aEnd, 0.06, 0.06, 4));
      const l = new THREE.BoxGeometry(0.45, 0.65, 0.45).toNonIndexed(); l.translate(aEnd.x, aEnd.y - 0.6, aEnd.z); lamps.push(l);
      const c = new THREE.ConeGeometry(0.4, 0.35, 4).toNonIndexed(); c.rotateY(Math.PI / 4); c.translate(aEnd.x, aEnd.y - 0.12, aEnd.z); caps.push(c);
    }
    // varais atravessando a pista com lanternas coloridas
    const bulbs = [], wires = [];
    for (const f of [0.22, 0.38, 0.6, 0.86]) {
      const i = Math.round(f * N);
      const a = tr.point(i, EDGE + 0.6), b = tr.point(i, -(EDGE + 0.6));
      a.y = b.y = tr.py[i] + 6;
      for (const p of [a, b]) posts.push(limb(new THREE.Vector3(p.x, tr.py[i], p.z), p, 0.15, 0.12, 6));
      const cols = [0xffc870, 0x9fffd0, 0xff9fd0];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= Math.sin(t * Math.PI) * 1.4;
        if (k < 12) { const p2 = new THREE.Vector3().lerpVectors(a, b, (k + 1) / 12); p2.y -= Math.sin(((k + 1) / 12) * Math.PI) * 1.4; wires.push(limb(p, p2, 0.03, 0.03, 3)); }
        if (k > 0 && k < 12) { const bb = new THREE.SphereGeometry(0.28, 6, 5).toNonIndexed(); bb.scale(1, 1.3, 1); bb.translate(p.x, p.y - 0.4, p.z); bulbs.push(tint(bb, cols[k % 3])); }
      }
    }
    tr.group.add(new THREE.Mesh(mergeGeometries([...posts, ...arms, ...wires]), mats.iron));
    tr.group.add(new THREE.Mesh(mergeGeometries(lamps), mats.lamp));
    tr.group.add(new THREE.Mesh(mergeGeometries(caps), mats.brass));
    tr.group.add(new THREE.Mesh(mergeGeometries(bulbs), basic({ vertexColors: true })));
  }

  // ------------------------------------------------ cano de cobre correndo junto do corrimão
  const valves = [];
  {
    const runs = [];
    let cur = [];
    const S = 1;
    for (let i = 0; i <= N; i += 3) {
      const k = i % N;
      if (tr.isFall(k, S)) { if (cur.length > 2) runs.push(cur); cur = []; continue; }
      const p = tr.point(k, S * (EDGE + 0.15)); p.y = tr.py[k] + 1.3; // em cima do corrimão
      cur.push(p);
    }
    if (cur.length > 2) runs.push(cur);
    const pipeGeos = [], clampGeos = [];
    for (const run of runs) {
      pipeGeos.push(ni(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length * 2, 0.28, 8, false)));
      for (let n = 0; n < run.length; n += 4) {
        const c = new THREE.TorusGeometry(0.34, 0.08, 4, 10).toNonIndexed();
        const dir = run[Math.min(n + 1, run.length - 1)].clone().sub(run[Math.max(0, n - 1)]).normalize();
        c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
        c.translate(run[n].x, run[n].y, run[n].z); clampGeos.push(c);
      }
      for (let n = 6; n < run.length - 3; n += 22) valves.push(run[n].clone());
    }
    if (pipeGeos.length) tr.group.add(new THREE.Mesh(mergeGeometries(pipeGeos), mats.copper));
    if (clampGeos.length) tr.group.add(new THREE.Mesh(mergeGeometries(clampGeos), mats.brass));
    const vw = [];
    for (const v of valves) {
      const st = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6).toNonIndexed(); st.translate(v.x, v.y + 0.4, v.z); vw.push(st);
      const w = new THREE.TorusGeometry(0.4, 0.07, 4, 10).toNonIndexed(); w.rotateX(Math.PI / 2); w.translate(v.x, v.y + 0.85, v.z); vw.push(w);
      smokers.push(v.clone().add(new THREE.Vector3(0, 0.9, 0)));
    }
    if (vw.length) tr.group.add(new THREE.Mesh(mergeGeometries(vw), lam({ color: 0xb0322a })));
  }

  // ------------------------------------------------ cano-mestre passando por baixo da subida
  if (tr.def.pipe) {
    const mx = tr.mirror ? -1 : 1;
    const [a0, b0] = tr.def.pipe.map(([x, z]) => new THREE.Vector3(mx * x, WY + 1.1, z));
    const g = [], fl = [];
    g.push(limb(a0, b0, 1.5, 1.5, 16));
    const len = a0.distanceTo(b0);
    for (let k = 0; k <= len; k += 9) {
      const p = new THREE.Vector3().lerpVectors(a0, b0, k / len);
      const f = limb(p.clone().add(new THREE.Vector3(0, 0, -0.25)), p.clone().add(new THREE.Vector3(0, 0, 0.25)), 1.85, 1.85, 16);
      fl.push(f);
      const leg = new THREE.BoxGeometry(0.5, 1.6, 3.4).toNonIndexed(); leg.translate(p.x, WY - 0.2, p.z); g.push(leg);
    }
    tr.group.add(new THREE.Mesh(mergeGeometries(g), mats.copper));
    tr.group.add(new THREE.Mesh(mergeGeometries(fl), mats.brass));
    // casa de bombas nas pontas, com caldeira em pé e chaminé
    for (const end of [a0, b0]) {
      if (!clear(end.x, end.z, EDGE + 6)) continue;
      occupied.push([end.x, end.z, 9]);
      const h = new THREE.Group(); h.position.set(end.x, WY, end.z); tr.group.add(h);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 12), mats.wood); deck.position.y = 1.2; h.add(deck);
      for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3), mats.wood); st.position.set(x, 0, z); h.add(st); }
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 7, 14), mats.copper); boiler.position.y = 5; h.add(boiler);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.brass); dome.position.y = 8.5; h.add(dome);
      for (const y of [2.6, 5, 7.4]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.3, 14), mats.brass); b.position.y = y; h.add(b); }
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6, 10), mats.iron); stack.position.set(3.4, 6, 2); h.add(stack);
      smokers.push(new THREE.Vector3(end.x + 3.4, WY + 9.3, end.z + 2));
      const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 14), lam({ color: 0xf4ead2 })); gauge.rotation.x = Math.PI / 2; gauge.position.set(0, 6, 2.5); h.add(gauge);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 6, 14), lam({ color: 0xb0322a })); wheel.position.set(0, 3.6, 2.6); h.add(wheel);
      tr.animated.push((dt) => { wheel.rotation.z += dt * 0.5; });
    }
  }

  // ------------------------------------------------ bombas de vareta (cavalos de pau) balançando
  const jacks = [];
  for (let t = 0; t < 300 && jacks.length < 6; t++) {
    const p = around(7, 24);
    if (!clear(p.x, p.z, EDGE + 6) || !free(p.x, p.z, 7)) continue;
    occupied.push([p.x, p.z, 7]);
    const g = new THREE.Group(); g.position.set(p.x, Math.max(p.y, WY), p.z); g.rotation.y = rnd() * 6; tr.group.add(g);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 9), mats.wood); deck.position.y = 0.5; g.add(deck);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 0.3), mats.iron); leg.position.set(s * 1, 2.8, 0); leg.rotation.z = -s * 0.2; g.add(leg); }
    const beamG = new THREE.Group(); beamG.position.set(0, 5, 0); g.add(beamG);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 8), mats.rust); beamG.add(bm);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.7, 12, 1, false, 0, Math.PI), mats.rust); head.rotation.z = Math.PI / 2; head.rotation.y = Math.PI / 2; head.position.z = 4.1; beamG.add(head);
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 12), mats.iron); cw.rotation.z = Math.PI / 2; cw.position.set(0, -1, -3.6); beamG.add(cw);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4), mats.brass); rod.position.set(0, 2.6, 4.9); g.add(rod);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), mats.lamp); lamp.position.set(0, 5.8, 0); g.add(lamp);
    jacks.push({ beamG, rod, ph: rnd() * 6 });
  }

  // ------------------------------------------------ cabanas de caldeira sobre palafitas
  for (let t = 0, made = 0; t < 300 && made < 5; t++) {
    const p = around(9, 26);
    if (!clear(p.x, p.z, EDGE + 7) || !free(p.x, p.z, 8)) continue;
    made++;
    occupied.push([p.x, p.z, 8]);
    const g = new THREE.Group(); g.position.set(p.x, WY, p.z); tr.group.add(g);
    const near = tr.dist(p.x, p.z).i; g.lookAt(tr.px[near], WY, tr.pz[near]);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 4.4), mats.wood); st.position.set(x, 1.2, z); st.rotation.z = (rnd() - 0.5) * 0.15; g.add(st); }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 7), lam({ color: [0x6e5a3e, 0x5a6a4a, 0x7a5c3c][made % 3] })); hut.position.y = 5.6; hut.rotation.z = (rnd() - 0.5) * 0.06; g.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 3.2, 4), lam({ color: [0x6fb09c, RUST, 0x5a6473][made % 3] })); roof.position.y = 9.4; roof.rotation.y = Math.PI / 4; roof.rotation.z = (rnd() - 0.5) * 0.12; g.add(roof);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), mats.lamp); win.position.set(0, 6, 3.52); g.add(win);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 6, 14), mats.brass); ring.position.set(0, 6, 3.55); g.add(ring);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 5, 8), mats.copper); stack.position.set(2.2, 10, -1); g.add(stack);
    smokers.push(new THREE.Vector3(2.2, 12.6, -1).applyQuaternion(g.quaternion).add(g.position));
    // canos descendo até a água, borbulhando
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5), mats.copper); pipe.position.set(-3.8, 2.4, 1); g.add(pipe);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 9), mats.wood); deck.position.y = 3.3; g.add(deck);
  }

  // ------------------------------------------------ máquina afundada: engrenagem e caldeira enferrujadas
  for (let t = 0, made = 0; t < 200 && made < 2; t++) {
    const p = around(8, 30);
    if (onLand(p.x, p.z) || !clear(p.x, p.z, EDGE + 7) || !free(p.x, p.z, 7)) continue;
    made++;
    occupied.push([p.x, p.z, 7]);
    const g = new THREE.Group(); g.position.set(p.x, WY, p.z); g.rotation.y = rnd() * 6; tr.group.add(g);
    const gear = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.55, 6, 18), mats.rust); gear.rotation.set(0.3, 0, 0.2); gear.position.y = 1.4; g.add(gear);
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.9), mats.rust); tooth.position.set(Math.cos(a) * 4, Math.sin(a) * 4, 0); tooth.rotation.z = a; gear.add(tooth); }
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 6, 12), mats.rust); boiler.position.set(4, 0.3, 2); boiler.rotation.set(1.2, 0, 0.3); g.add(boiler);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), lam({ color: 0x4e7a3a })); moss.scale.set(1.4, 0.5, 1); moss.position.set(3.6, 1.4, 1); g.add(moss);
  }

  // ------------------------------------------------ draga a vapor: corrente de caçambas tirando lama do fundo
  const dredges = [];
  for (let t = 0; t < 300 && dredges.length < 1; t++) {
    const p = around(10, 22);
    if (onLand(p.x, p.z) || !clear(p.x, p.z, EDGE + 9) || !free(p.x, p.z, 14)) continue;
    occupied.push([p.x, p.z, 14]);
    const g = new THREE.Group(); g.position.set(p.x, WY, p.z); tr.group.add(g);
    const near = tr.dist(p.x, p.z).i; g.rotation.y = tr.heading(near);
    const box = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
    box(10, 1.6, 22, lam({ color: 0x5a3a2a }), 0, 0.5, 0);
    box(10.4, 0.5, 22.4, mats.brass, 0, 1.4, 0);
    box(7, 5, 8, lam({ color: 0x6f8a80 }), 0, 4, 4);
    box(7.6, 0.4, 8.6, mats.rust, 0, 6.7, 4);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 6, 10), mats.iron); st.position.set(2, 9.5, 6); g.add(st);
    smokers.push(new THREE.Vector3(2, 12.8, 6).applyQuaternion(g.quaternion).add(g.position));
    // pórtico em A segurando a escada de caçambas
    for (const x of [-3.5, 3.5]) { g.add(new THREE.Mesh(limb(new THREE.Vector3(x, 1.6, -2), new THREE.Vector3(x * 0.4, 11, -6), 0.25, 0.25, 6), mats.iron)); g.add(new THREE.Mesh(limb(new THREE.Vector3(x, 1.6, -10), new THREE.Vector3(x * 0.4, 11, -6), 0.25, 0.25, 6), mats.iron)); }
    const ladder = new THREE.Group(); ladder.position.set(0, 10, -6); ladder.rotation.x = -0.95; g.add(ladder);
    const LL = 18;
    box(0.5, 0.8, LL, mats.rust, -1.2, 0, -LL / 2, ladder); box(0.5, 0.8, LL, mats.rust, 1.2, 0, -LL / 2, ladder);
    for (const z of [0, -LL]) { const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 8), mats.iron); tb.rotation.z = Math.PI / 2; tb.position.z = z; ladder.add(tb); }
    const buckets = [];
    const bGeo = new THREE.BoxGeometry(1.6, 0.9, 1.1), bMat = lam({ color: 0x8a4a2a });
    for (let k = 0; k < 16; k++) { const b = new THREE.Mesh(bGeo, bMat); ladder.add(b); buckets.push(b); }
    // calha despejando a lama
    const chute = box(1.6, 0.3, 6, mats.rust, 4, 8, -4); chute.rotation.x = 0.3; chute.rotation.y = -0.6;
    dredges.push({ buckets, LL });
    tr.landmarks = { ...(tr.landmarks || {}), dredge: g.position.clone() };
  }

  // ------------------------------------------------ guindaste a vapor girando com a carga balançando
  const cranes = [];
  for (let t = 0; t < 300 && cranes.length < 2; t++) {
    const p = around(6, 18);
    if (!clear(p.x, p.z, EDGE + 5) || !free(p.x, p.z, 8)) continue;
    occupied.push([p.x, p.z, 8]);
    const g = new THREE.Group(); g.position.set(p.x, Math.max(p.y, WY), p.z); tr.group.add(g);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 1.4, 12), mats.wood); deck.position.y = 0.6; g.add(deck);
    const turn = new THREE.Group(); turn.position.y = 1.3; g.add(turn);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 4), lam({ color: 0xe8a221 })); cab.position.set(0, 1.5, -0.8); turn.add(cab);
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 10), mats.copper); boiler.position.set(0, 1.4, -2.9); turn.add(boiler);
    const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 2.6, 8), mats.iron); stk.position.set(0, 3.8, -2.9); turn.add(stk);
    const jib = new THREE.Mesh(limb(new THREE.Vector3(0, 1.5, 1), new THREE.Vector3(0, 12, 9), 0.35, 0.22, 6), mats.rust); turn.add(jib);
    const tip = new THREE.Vector3(0, 12, 9);
    const hook = new THREE.Group(); hook.position.copy(tip); turn.add(hook);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6), mats.iron); cable.position.y = -3; hook.add(cable);
    const load = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), lam({ color: [0x9a6a3a, 0x6f8a80][cranes.length % 2] })); load.position.y = -6.8; hook.add(load);
    cranes.push({ turn, hook, ph: rnd() * 6 });
    tr.landmarks = { ...(tr.landmarks || {}), crane: g.position.clone() };
  }

  // ------------------------------------------------ barco a vapor de roda de pás dando voltas no pântano
  const boat = new THREE.Group(); tr.group.add(boat);
  const paddles = [];
  {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 14), lam({ color: 0x8a3a2a })); hull.position.y = 0.4; boat.add(hull);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 1.4, 12, 1, false, 0, Math.PI), lam({ color: 0x8a3a2a })); bow.position.set(0, 0.4, 7); bow.rotation.y = -Math.PI / 2; boat.add(bow);
    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 8), lam({ color: 0xefe2c2 })); deck2.position.set(0, 2.3, -1); boat.add(deck2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 9), lam({ color: 0x2f6a5a })); roof.position.set(0, 3.6, -1); boat.add(roof);
    for (let k = 0; k < 3; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.9), mats.lamp); w.position.set(2.22, 2.4, -3.5 + k * 2.5); w.rotation.y = Math.PI / 2; boat.add(w); const w2 = w.clone(); w2.position.x = -2.22; w2.rotation.y = -Math.PI / 2; boat.add(w2); }
    for (const z of [0.5, -2.5]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 5, 10), mats.iron); st.position.set(0, 6, z); boat.add(st); const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.6, 10), mats.brass); cr.position.set(0, 8.6, z); boat.add(cr); }
    for (const s of [1, -1]) {
      const wheel = new THREE.Group(); wheel.position.set(s * 2.9, 1, -2); boat.add(wheel);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 5, 14), mats.wood); rim.rotation.y = Math.PI / 2; wheel.add(rim);
      for (let k = 0; k < 8; k++) { const pd = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1.9), mats.wood); pd.rotation.x = (k / 8) * Math.PI; wheel.add(pd); }
      const box = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.9, 12, 1, false, 0, Math.PI), lam({ color: 0xc9a24a })); box.rotation.z = Math.PI / 2; box.rotation.y = Math.PI / 2; box.position.set(s * 2.9, 1, -2); boat.add(box);
      paddles.push(wheel);
    }
  }

  // ------------------------------------------------ vaga-lumes (pontinhos piscando) e libélulas
  const flies = [];
  {
    const gt = glowTex();
    for (let grp = 0; grp < 3; grp++) {
      const n = 130, pos = new Float32Array(n * 3), base = [];
      for (let k = 0; k < n; k++) {
        const p = around(1, 45);
        const y = Math.max(tr.terrainY(p.x, p.z), WY) + 0.6 + rnd() * 4.5;
        base.push([p.x, y, p.z, rnd() * 6]);
        pos.set([p.x, y, p.z], k * 3);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: [0xe4ff70, 0xfff080, 0xb8ff90][grp], size: 0.9, map: gt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const pts = new THREE.Points(geo, mat); tr.group.add(pts);
      flies.push({ geo, mat, base, ph: grp * 2.1 });
    }
  }
  const dragons = [];
  {
    const body = phong({ color: 0x2aa8c8, shininess: 90, specular: 0xffffff }), wingM = basic({ color: 0xcff4ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const cols = [0x2aa8c8, 0x3ac870, 0xd04a8a, 0xe8a221];
    for (let k = 0; k < 14; k++) {
      const g = new THREE.Group(); tr.group.add(g);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.1, 5), k % 4 ? phong({ color: cols[k % 4], shininess: 90, specular: 0xffffff }) : body); b.rotation.x = Math.PI / 2; g.add(b);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), b.material); hd.position.z = 0.6; g.add(hd);
      const wings = [];
      for (const z of [0.2, -0.05]) for (const s of [1, -1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.16), wingM); w.geometry.translate(0.375, 0, 0);
        const piv = new THREE.Group(); piv.position.set(0, 0.04, z); piv.scale.x = s; piv.add(w); w.rotation.x = -Math.PI / 2; g.add(piv);
        wings.push(piv);
      }
      const i = (rnd() * N) | 0, s = rnd() < 0.5 ? 1 : -1;
      const c = tr.point(i, s * (EDGE + 2 + rnd() * 12));
      c.y = Math.max(tr.py[i], WY) + 1.2 + rnd() * 2.5;
      dragons.push({ g, wings, c, r: 2 + rnd() * 5, sp: 0.6 + rnd() * 0.8, ph: rnd() * 6, last: new THREE.Vector3() });
    }
  }

  // ------------------------------------------------ fumaça
  const puffs = [];
  for (const top of smokers) for (let k = 0; k < 4; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xb8c8c4 }));
    tr.group.add(s); puffs.push({ s, top, t: k / 4 });
  }

  // ------------------------------------------------ animações
  const C = tr.center;
  let bx = 0, bz = 0;
  for (let i = 0; i < N; i++) { bx = Math.max(bx, Math.abs(tr.px[i] - C.x)); bz = Math.max(bz, Math.abs(tr.pz[i] - C.z)); }
  const RX = bx + 60, RZ = bz + 55;
  let t = 0;
  tr.animated.push((dt) => {
    t += dt;
    for (const f of shipAnims) f(t);
    for (const d of dredges) {
      // caçambas correm em volta da escada: descem por baixo e sobem cheias por cima
      const per = d.LL * 2 + Math.PI * 2.4;
      d.buckets.forEach((b, k) => {
        let u = ((t * 2 + (k / d.buckets.length) * per) % per);
        if (u < d.LL) { b.position.set(0, 1.3, -u); b.rotation.x = 0; }
        else if (u < d.LL + Math.PI * 1.2) { const a = (u - d.LL) / 1.2; b.position.set(0, Math.cos(a) * 1.3, -d.LL - Math.sin(a) * 1.3); b.rotation.x = a; }
        else if (u < d.LL * 2 + Math.PI * 1.2) { b.position.set(0, -1.3, -d.LL + (u - d.LL - Math.PI * 1.2)); b.rotation.x = Math.PI; }
        else { const a = (u - d.LL * 2 - Math.PI * 1.2) / 1.2; b.position.set(0, -Math.cos(a) * 1.3, Math.sin(a) * 1.3); b.rotation.x = Math.PI + a; }
      });
    }
    for (const c of cranes) { c.turn.rotation.y = Math.sin(t * 0.25 + c.ph) * 1.6; c.hook.rotation.z = Math.sin(t * 1.3 + c.ph) * 0.12; c.hook.rotation.x = Math.cos(t * 1.1 + c.ph) * 0.08; }
    for (const j of jacks) { const a = Math.sin(t * 1.4 + j.ph) * 0.32; j.beamG.rotation.x = a; j.rod.position.y = 2.6 - a * 4; }
    for (const f of flies) {
      const arr = f.geo.attributes.position.array;
      for (let k = 0; k < f.base.length; k++) {
        const [x, y, z, ph] = f.base[k];
        arr[k * 3] = x + Math.sin(t * 0.5 + ph) * 1.2; arr[k * 3 + 1] = y + Math.sin(t * 0.8 + ph * 2) * 0.5; arr[k * 3 + 2] = z + Math.cos(t * 0.4 + ph) * 1.2;
      }
      f.geo.attributes.position.needsUpdate = true;
      f.mat.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + f.ph));
    }
    for (const d of dragons) {
      // voa em oitos, parando de vez em quando para pairar
      const hover = Math.sin(t * 0.37 + d.ph) > 0.6;
      if (!hover) d.ph2 = (d.ph2 || 0) + dt * d.sp;
      const a = d.ph + (d.ph2 || 0);
      d.last.copy(d.g.position);
      d.g.position.set(d.c.x + Math.sin(a) * d.r, d.c.y + Math.sin(a * 2.3) * 0.6, d.c.z + Math.sin(a * 2) * d.r * 0.5);
      const dx = d.g.position.x - d.last.x, dz = d.g.position.z - d.last.z;
      if (dx * dx + dz * dz > 1e-6) d.g.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(t * 40 + d.ph) * 0.5;
      d.wings.forEach((w, n) => { w.rotation.z = (n % 2 ? -1 : 1) * flap * (w.scale.x); });
    }
    const ba = t * 0.03;
    boat.position.set(C.x + Math.cos(ba) * RX, WY + 0.1 + Math.sin(t * 1.2) * 0.06, C.z + Math.sin(ba) * RZ);
    boat.rotation.y = Math.atan2(-Math.sin(ba) * RX, Math.cos(ba) * RZ);
    paddles.forEach((p) => { p.rotation.x -= dt * 2.4; });
    for (const p of puffs) {
      p.t = (p.t + dt * 0.18) % 1;
      p.s.position.set(p.top.x + p.t * 2.5, p.top.y + p.t * 7, p.top.z);
      p.s.scale.setScalar(1 + p.t * 3.5); p.s.material.opacity = 0.6 * (1 - p.t);
    }
  });
  // fumaça do barco segue junto
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xc8d0cc }));
    tr.group.add(s);
    let pt = k / 6;
    tr.animated.push((dt) => {
      pt = (pt + dt * 0.3) % 1;
      const top = new THREE.Vector3(0, 9, k % 2 ? 0.5 : -2.5).applyQuaternion(boat.quaternion).add(boat.position);
      s.position.set(top.x, top.y + pt * 5, top.z); s.scale.setScalar(0.8 + pt * 3); s.material.opacity = 0.55 * (1 - pt);
    });
  }
}
