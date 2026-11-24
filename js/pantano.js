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
