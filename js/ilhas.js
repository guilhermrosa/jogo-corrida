import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { pixelTex, groundTexture } from './textures.js';
import { tinBot } from './robots.js';

// =====================================================================
//  ILHAS DAS CORRENTES — ilhas flutuantes presas por correntes (Copa Engrenagem)
//  Ilhas de pedra no céu, correntes gigantes, pontes pênseis, cremalheira com
//  engrenagens, pico com cachoeira, casa de caldeira, dirigíveis e mar de nuvens.
// =====================================================================

const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const phong = (o) => new THREE.MeshPhongMaterial(o);
const BRASS = 0xc9a24a, IRON = 0x3b3632, COPPER = 0xb8673a;

function hash(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
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

// pedra flutuante: cone irregular com camadas de cor, ponta para baixo
function rockGeo(r, depth, seed, topY) {
  const pts = [];
  const steps = 9;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const rr = r * Math.pow(1 - t, 0.75) * (1 + (hash(seed, k) - 0.5) * 0.18) + (k === steps ? 0.01 : 0);
    pts.push(new THREE.Vector2(Math.max(0.3, rr), -t * depth));
  }
  const g = new THREE.LatheGeometry(pts.reverse(), 14).toNonIndexed();
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const bands = [new THREE.Color(0x8a6a4a), new THREE.Color(0xa87a52), new THREE.Color(0x6a5040), new THREE.Color(0xb89060)];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const j = 1 + (hash(Math.round(x * 0.7) + seed, Math.round(z * 0.7) + Math.round(y)) - 0.5) * 0.25;
    pos.setXYZ(i, x * j, y, z * j);
    const c = bands[Math.abs(Math.floor(y / 3 + seed)) % 4];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.translate(0, topY, 0);
  return g;
}

export function ilhas(tr, rnd, H) {
  const N = tr.N;
  const mx = tr.mirror ? -1 : 1;
  const ISL = tr.def.islands.map(([x, z, r, lv], n, all) => {
    const c = new THREE.Vector3(mx * x, 0, z);
    if (n === all.length - 1) return { c, r, lv, top: lv };      // o pico fica no meio da espiral, sem pista em cima
    let low = Infinity;
    for (let i = 0; i < tr.N; i++) if (Math.hypot(tr.px[i] - c.x, tr.pz[i] - c.z) < r) low = Math.min(low, tr.py[i]);
    const top = (low === Infinity ? lv : low) - 1.0;              // grama logo abaixo do tabuleiro mais baixo
    return { c, r, lv: top + 1, top };
  });
  const onIsland = (x, z, m = 0) => ISL.find((s) => Math.hypot(x - s.c.x, z - s.c.z) < s.r - m);
  const clear = (x, z, need) => tr.dist(x, z).d >= need;
  const mats = {
    iron: lam({ color: IRON }), wood: lam({ color: 0x8a5a34 }),
    brass: phong({ color: BRASS, shininess: 70, specular: 0x887755 }), copper: phong({ color: COPPER, shininess: 50, specular: 0x553322 }),
    lamp: basic({ color: 0xffd98a }), vc: lam({ vertexColors: true }),
  };
  const anims = [];
  const puffTex = H.SPR.fumaca();
  const smokers = [];

  H.grandstand(tr, 12, H.sideWithRoom(tr, 12), 40);

  // ------------------------------------------------ as ilhas: grama em cima, pedra em camadas embaixo
  {
    const rocks = [], tops = [];
    ISL.forEach((s, n) => {
      const top = s.top;
      const spire = n === ISL.length - 1;
      if (spire) {
        // pico de pedra alto no meio da espiral
        rocks.push(rockGeo(s.r, 70, n * 7 + 3, s.lv));
        const col = new THREE.CylinderGeometry(s.r * 0.95, s.r * 1.05, s.lv + 6, 12).toNonIndexed(); col.translate(s.c.x, (s.lv - 6) / 2, s.c.z);
        rocks.push(tint(col, 0x9a7a52));
        rocks[rocks.length - 2].translate(s.c.x, 0, s.c.z);
        rocks[rocks.length - 2].translate(0, -6, 0);
      } else {
        const g = rockGeo(s.r * 1.05, s.r * 1.4, n * 7 + 3, top - 0.6); g.translate(s.c.x, 0, s.c.z); rocks.push(g);
      }
      const t = new THREE.CylinderGeometry(s.r * 1.08, s.r * 1.02, 1.4, 20).toNonIndexed(); t.translate(s.c.x, (spire ? s.lv : top) - 0.7, s.c.z); tops.push(t);
    });
    tr.group.add(new THREE.Mesh(mergeGeometries(rocks), lam({ vertexColors: true, flatShading: true })));
    const gt = groundTexture('ilhas', 'terrain'); gt.repeat.set(8, 8);
    tr.group.add(new THREE.Mesh(mergeGeometries(tops), lam({ map: gt })));
    // raízes e cipós pendurados embaixo das ilhas
    const roots = [];
    ISL.forEach((s, n) => {
      if (n === ISL.length - 1) return;
      for (let k = 0; k < s.r * 0.8; k++) {
        const a = rnd() * Math.PI * 2, d = s.r * (0.6 + rnd() * 0.4);
        const p = new THREE.Vector3(s.c.x + Math.cos(a) * d, s.lv - 2, s.c.z + Math.sin(a) * d);
        roots.push(limb(p, p.clone().add(new THREE.Vector3((rnd() - 0.5) * 2, -4 - rnd() * 8, (rnd() - 0.5) * 2)), 0.15, 0.05, 4));
      }
    });
    tr.group.add(new THREE.Mesh(mergeGeometries(roots), lam({ color: 0x5a7a3a })));
  }

  // ------------------------------------------------ árvores redondas, cogumelos e flores em cima das ilhas
  {
    const trunks = [], crowns = [], stems = [], caps = [], spots = [];
    ISL.forEach((s, n) => {
      if (n === ISL.length - 1) return;
      const count = Math.round(s.r * 0.9);
      for (let k = 0, tries = 0; k < count && tries < count * 20; tries++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (s.r - 2);
        const x = s.c.x + Math.cos(a) * d, z = s.c.z + Math.sin(a) * d;
        if (!clear(x, z, EDGE + 6)) continue;
        k++;
        const y = s.lv - 1;
        if (rnd() < 0.8) {
          const h = 3 + rnd() * 4;
          trunks.push(limb(new THREE.Vector3(x, y, z), new THREE.Vector3(x + (rnd() - 0.5), y + h, z + (rnd() - 0.5)), 0.4, 0.25));
          const cr = new THREE.IcosahedronGeometry(2.2 + rnd() * 1.6, 1).toNonIndexed(); cr.translate(x, y + h + 1.4, z);
          crowns.push(tint(cr, [0x4e7a3a, 0x5e8a40, 0x6a7a3a, 0x3e6a34][(rnd() * 4) | 0]));
        } else {
          const sc = 0.8 + rnd() * 1.8, h = sc * 1.4;
          const st = new THREE.CylinderGeometry(sc * 0.2, sc * 0.28, h, 8).toNonIndexed(); st.translate(x, y + h / 2, z); stems.push(st);
          const cap = new THREE.SphereGeometry(sc * 0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(); cap.scale(1, 0.65, 1); cap.translate(x, y + h, z); caps.push(cap);
          for (let m = 0; m < 5; m++) { const b = rnd() * Math.PI * 2, rr = sc * 0.5; const sp = new THREE.SphereGeometry(sc * 0.12, 5, 4).toNonIndexed(); sp.translate(x + Math.cos(b) * rr, y + h + sc * 0.33, z + Math.sin(b) * rr); spots.push(sp); }
        }
      }
    });
    tr.group.add(new THREE.Mesh(mergeGeometries(trunks), lam({ color: 0x6a4a32 })));
    tr.group.add(new THREE.Mesh(mergeGeometries(crowns), lam({ vertexColors: true, flatShading: true })));
    tr.group.add(new THREE.Mesh(mergeGeometries(stems), lam({ color: 0xf4ead2 })));
    tr.group.add(new THREE.Mesh(mergeGeometries(caps), lam({ color: 0x8a5a3a })));
    tr.group.add(new THREE.Mesh(mergeGeometries(spots), lam({ color: 0xe8dcc0 })));
  }

  // ------------------------------------------------ correntes gigantes ligando as ilhas e pendendo para as nuvens
  {
    const links = [];
    const linkAlong = (pts) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const len = curve.getLength(), n = Math.floor(len / 1.5);
      for (let k = 0; k < n; k++) {
        const p = curve.getPointAt(k / n), t = curve.getTangentAt(k / n);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), t);
        if (k % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
        links.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
      }
    };
    // a corrente não pode passar perto de nenhum trecho da pista (em planta e em altura)
    const chainOk = (pts) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      for (let k = 0; k <= 40; k++) {
        const p = curve.getPointAt(k / 40);
        for (let i = 0; i < N; i += 2) if (Math.hypot(p.x - tr.px[i], p.z - tr.pz[i]) < EDGE + 4 && Math.abs(p.y - tr.py[i]) < 12) return false;
        for (const o of ISL) if (Math.hypot(p.x - o.c.x, p.z - o.c.z) < o.r * 0.95 && p.y < o.top && p.y > o.top - o.r * 1.2) return false;
      }
      return true;
    };
    const winches = [];
    const order = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
    for (const [ia, ib] of order) {
      const A = ISL[ia], B = ISL[ib];
      const base = Math.atan2(B.c.z - A.c.z, B.c.x - A.c.x);
      let made = 0;
      for (const off of [0.9, -0.9, 1.3, -1.3, 0.5, -0.5]) {
        if (made >= 2) break;
        const aa = base + off, ab = base + Math.PI - off;
        const p0 = new THREE.Vector3(A.c.x + Math.cos(aa) * (A.r + 0.5), A.top + 0.6, A.c.z + Math.sin(aa) * (A.r + 0.5));
        const p1 = new THREE.Vector3(B.c.x + Math.cos(ab) * (B.r + 0.5), B.top + 0.6, B.c.z + Math.sin(ab) * (B.r + 0.5));
        const sag = p0.distanceTo(p1) * 0.22;
        const mid = p0.clone().lerp(p1, 0.5); mid.y -= sag;
        const pts = [p0, p0.clone().lerp(mid, 0.5).setY((p0.y + mid.y) / 2 - sag * 0.15), mid, mid.clone().lerp(p1, 0.5).setY((p1.y + mid.y) / 2 - sag * 0.15), p1];
        if (!chainOk(pts.slice(1, 4))) continue;
        if (!clear(p0.x, p0.z, EDGE + 5) || !clear(p1.x, p1.z, EDGE + 5)) continue;
        linkAlong(pts);
        winches.push([p0, aa], [p1, ab]);
        made++;
      }
    }
    // guinchos de latão segurando cada corrente na borda da ilha
    const wg = [];
    for (const [p, ang] of winches) {
      const inward = new THREE.Vector3(-Math.cos(ang), 0, -Math.sin(ang));
      const c = p.clone().add(inward.clone().multiplyScalar(2.2));
      const yaw = Math.atan2(inward.x, inward.z);
      const add = (geo, x, y, z) => { geo.rotateY(yaw); geo.translate(c.x + x, c.y + y, c.z + z); wg.push(geo.toNonIndexed()); };
      add(new THREE.BoxGeometry(3.4, 1, 2.4), 0, -0.1, 0);
      const drum = new THREE.CylinderGeometry(0.9, 0.9, 2.6, 12); drum.rotateZ(Math.PI / 2); add(drum, 0, 1.1, 0);
      const gear = new THREE.TorusGeometry(1.2, 0.25, 5, 12); gear.rotateY(Math.PI / 2); add(gear, 1.5, 1.1, 0);
    }
    if (wg.length) tr.group.add(new THREE.Mesh(mergeGeometries(wg), mats.brass));
    const lg = new THREE.TorusGeometry(0.6, 0.2, 5, 10); lg.scale(1.5, 1, 1);
    const im = new THREE.InstancedMesh(lg, phong({ color: 0x5a5250, shininess: 60, specular: 0x888888 }), links.length);
    links.forEach((m, i) => im.setMatrixAt(i, m));
    tr.group.add(im);
  }

  // ------------------------------------------------ pontes: torres e cabos de ponte pênsil onde não há ilha embaixo
  const spans = [];
  {
    let cur = null;
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const sp = tr.def.spire;
      const nearSpire = sp && Math.hypot(tr.px[k] - mx * sp[0], tr.pz[k] - sp[1]) < 36;
      const air = !onIsland(tr.px[k], tr.pz[k], 3) && !tr.gap[k] && !nearSpire;
      if (air && !cur) cur = [k];
      else if (air && cur) cur.push(k);
      else if (!air && cur) { if (cur.length > 18) spans.push(cur); cur = null; }
    }
    if (cur && cur.length > 18) spans.push(cur);
    const towers = [], cables = [], hangers = [];
    const lamps = [];
    for (const sp of spans) {
      const ends = [sp[0], sp[sp.length - 1]];
      for (const s of [1, -1]) {
        const tops = ends.map((i) => { const p = tr.point(i, s * (EDGE + 0.6)); p.y = tr.py[i] + 9; return p; });
        for (const [n, i] of ends.entries()) {
          const b = tr.point(i, s * (EDGE + 0.6)); b.y = tr.py[i] - 0.8;
          towers.push(limb(b, tops[n], 0.55, 0.45, 8));
          const l = new THREE.SphereGeometry(0.55, 8, 6).toNonIndexed(); l.translate(tops[n].x, tops[n].y + 0.6, tops[n].z); lamps.push(l);
        }
        // cabo em catenária entre as torres e pendurais até o tabuleiro
        const pts = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20, i = sp[Math.round(t * (sp.length - 1))];
          const p = tr.point(i, s * (EDGE + 0.6));
          p.y = THREE.MathUtils.lerp(tops[0].y, tops[1].y, t) - Math.sin(t * Math.PI) * 7;
          pts.push(p);
        }
        cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.18, 5).toNonIndexed());
        for (let k = 2; k < 20; k += 1) {
          const i = sp[Math.round((k / 20) * (sp.length - 1))];
          const d = tr.point(i, s * (EDGE + 0.6)); d.y = tr.py[i] + 1;
          if (pts[k].y - d.y > 0.5) hangers.push(limb(d, pts[k], 0.06, 0.06, 4));
        }
      }
    }
    if (towers.length) tr.group.add(new THREE.Mesh(mergeGeometries(towers), mats.brass));
    if (cables.length) tr.group.add(new THREE.Mesh(mergeGeometries([...cables, ...hangers]), mats.iron));
    if (lamps.length) tr.group.add(new THREE.Mesh(mergeGeometries(lamps), mats.lamp));
  }

  // ------------------------------------------------ turbinas de latão embaixo de cada ilha
  {
    ISL.forEach((s, n) => {
      if (n === ISL.length - 1) return;
      const depth = s.r * 1.4 + 0.6;
      const g = new THREE.Group(); g.position.set(s.c.x, s.top - depth + 1.5, s.c.z); tr.group.add(g);
      const k = Math.max(0.6, s.r / 30);
      g.scale.setScalar(k);
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.2, 5, 16), mats.copper); nac.position.y = -2; g.add(nac);
      for (const y of [-0.2, -2, -3.8]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.35, 16), mats.brass); b.position.y = y; g.add(b); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.45, 6, 28), mats.brass); ring.rotation.x = Math.PI / 2; ring.position.y = -5; g.add(ring);
      for (let m = 0; m < 4; m++) { const a = (m / 4) * Math.PI * 2; const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 7.4), mats.iron); arm.position.set(Math.cos(a) * 3.7, -5, Math.sin(a) * 3.7); arm.rotation.y = -a + Math.PI / 2; g.add(arm); }
      const rotor = new THREE.Group(); rotor.position.y = -5.3; g.add(rotor);
      for (let m = 0; m < 5; m++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.15, 1.4), lam({ color: 0x8a6a4a })); bl.geometry.translate(3.4, 0, 0); bl.rotation.y = (m / 5) * Math.PI * 2; bl.rotation.x = 0.25; rotor.add(bl); }
      const hub = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mats.brass); hub.position.y = -5.3; g.add(hub);
      const sp = 2 + n * 0.4;
      anims.push((t) => { rotor.rotation.y = t * sp; });
      // escapes de vapor nas laterais da turbina
      smokers.push(new THREE.Vector3(s.c.x + 3.4 * k, s.top - depth + 1.5 - 1 * k, s.c.z));
    });
  }

  // ------------------------------------------------ cremalheira: engrenagens gigantes girando ao lado da subida
  {
    let best = null, bestRise = 0;
    for (let i = 0; i < N; i++) { const r = tr.py[(i + 40) % N] - tr.py[i]; if (r > bestRise) { bestRise = r; best = i; } }
    if (best !== null && bestRise > 6) {
      const gearShape = (R, T) => {
        const s = new THREE.Shape();
        for (let k = 0; k < T; k++) {
          const a = (k / T) * Math.PI * 2, st = (Math.PI * 2) / T, P = (aa, rr) => [Math.cos(aa) * rr, Math.sin(aa) * rr];
          if (!k) s.moveTo(...P(a, R * 0.84)); else s.lineTo(...P(a, R * 0.84));
          s.lineTo(...P(a + st * 0.2, R)); s.lineTo(...P(a + st * 0.5, R)); s.lineTo(...P(a + st * 0.7, R * 0.84));
        }
        const h = new THREE.Path(); h.absarc(0, 0, R * 0.25, 0, Math.PI * 2, true); s.holes.push(h);
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const hh = new THREE.Path(); hh.absarc(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.14, 0, Math.PI * 2, true); s.holes.push(hh); }
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -0.4);
        return g;
      };
      const gg = gearShape(4.5, 16);
      for (let k = 0; k < 4; k++) {
        const i = (best + 4 + k * 10) % N;
        for (const s of [1, -1]) {
          const p = tr.point(i, s * (EDGE + 1.6)); p.y = tr.py[i] - 1.5;
          const holder = new THREE.Group(); holder.position.copy(p); holder.rotation.y = tr.heading(i) + Math.PI / 2; tr.group.add(holder);
          const g = new THREE.Mesh(gg, k % 2 ? mats.copper : mats.brass); holder.add(g);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), mats.iron); hub.rotation.x = Math.PI / 2; holder.add(hub);
          anims.push((t) => { g.rotation.z = (k % 2 ? 1 : -1) * t * 0.9; });
        }
      }
      // trilho dentado nas bordas da subida
      const rack = [];
      for (let k = 0; k < 40; k++) {
        const i = (best + k) % N;
        for (const s of [1, -1]) { const p = tr.point(i, s * (EDGE - 0.3)); p.y = tr.py[i] + 0.25; const b = new THREE.BoxGeometry(0.5, 0.35, 0.35).toNonIndexed(); b.rotateY(tr.heading(i)); b.translate(p.x, p.y, p.z); rack.push(b); }
      }
      tr.group.add(new THREE.Mesh(mergeGeometries(rack), mats.brass));
      tr.landmarks = { ...(tr.landmarks || {}), climb: best };
    }
  }

  // ------------------------------------------------ pico: farol-caldeira no topo e cachoeira caindo nas nuvens
  {
    const s = ISL[ISL.length - 1];
    const g = new THREE.Group(); g.position.set(s.c.x, s.lv, s.c.z); tr.group.add(g);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 12, 12), mats.copper); tower.position.y = 6; g.add(tower);
    for (const y of [2, 6, 10]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.5, 12), mats.brass); b.position.y = y; g.add(b); }
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 10), basic({ color: 0xfff0b0 })); lantern.position.y = 13.5; g.add(lantern);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 10), lam({ color: 0x6fb09c })); roof.position.y = 17; g.add(roof);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(3, 26, 12, 1, true), basic({ color: 0xfff0b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.z = Math.PI / 2; beam.position.set(14, 0, 0);
    const rot = new THREE.Group(); rot.position.y = 13.5; rot.add(beam); g.add(rot);
    anims.push((t) => { rot.rotation.y = t * 0.6; });
    for (let k = 0; k < 2; k++) { const gr = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.45, 6, 16), mats.brass); gr.position.set(0, 7, 3.4); gr.rotation.y = k * Math.PI / 2; g.add(gr); anims.push((t) => { gr.rotation.z = t * (k ? 0.7 : -0.7); }); }
    // cachoeira: textura correndo para baixo
    const wt = pixelTex(16, 64, (c, w, h, r) => {
      c.fillStyle = '#9fd8f0'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { c.fillStyle = r() < 0.5 ? '#ffffff' : '#c8ecff'; c.fillRect(r() * w, r() * h, 1, 3 + r() * 6); }
    }, { seed: 12 });
    wt.repeat.set(3, 6);
    anims.push((t) => { wt.offset.y = t * 0.9; });
    {
      const D = ISL[3];
      let best = null;
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * Math.PI * 2;
        const x = D.c.x + Math.cos(a) * (D.r + 1), z = D.c.z + Math.sin(a) * (D.r + 1);
        const d = tr.dist(x, z).d;
        if (!best || d > best.d) best = { a, d, x, z };
      }
      const fallH = D.top + 26;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, fallH, 10, 1, true, -0.9, 1.8), basic({ map: wt, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      water.position.set(best.x, D.top - fallH / 2, best.z); water.rotation.y = -best.a + Math.PI / 2;
      tr.group.add(water);
      // riacho em cima da ilha correndo até a borda
      const brook = new THREE.Mesh(new THREE.PlaneGeometry(2.4, D.r * 0.5), basic({ map: wt, transparent: true, opacity: 0.8 }));
      brook.rotation.x = -Math.PI / 2; brook.rotation.z = -best.a + Math.PI / 2;
      brook.position.set(D.c.x + Math.cos(best.a) * D.r * 0.78, D.top + 0.05, D.c.z + Math.sin(best.a) * D.r * 0.78);
      tr.group.add(brook);
    }
    smokers.push(new THREE.Vector3(s.c.x + 2, s.lv + 19.5, s.c.z));
  }

  // ------------------------------------------------ casa de caldeira com roda d'água na ilha alta (antes da espiral)
  {
    const s = ISL[3];
    let spot = null;
    for (let k = 0; k < 60 && !spot; k++) {
      const a = rnd() * Math.PI * 2, d = s.r * (0.4 + rnd() * 0.45);
      const x = s.c.x + Math.cos(a) * d, z = s.c.z + Math.sin(a) * d;
      if (clear(x, z, EDGE + 7)) spot = new THREE.Vector3(x, s.lv - 1, z);
    }
    if (spot) {
      const g = new THREE.Group(); g.position.copy(spot); tr.group.add(g);
      g.lookAt(s.c.x, spot.y, s.c.z);
      const house = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 7), lam({ color: 0xe8c070 })); house.position.y = 3; house.rotation.z = 0.04; g.add(house);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 4, 4), lam({ color: 0x8e3b2a })); roof.position.y = 8; roof.rotation.y = Math.PI / 4; roof.rotation.z = -0.06; g.add(roof);
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 7, 14), mats.copper); boiler.position.set(6, 3.5, 0); g.add(boiler);
      for (const y of [1, 3.5, 6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.35, 14), mats.brass); b.position.set(6, y, 0); g.add(b); }
      const gauge = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), lam({ color: 0xf4ead2 })); gauge.position.set(6, 4.6, 2.62); g.add(gauge);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.05), lam({ color: 0xb0322a })); needle.geometry.translate(0, 0.4, 0); needle.position.set(6, 4.6, 2.66); g.add(needle);
      anims.push((t) => { needle.rotation.z = Math.sin(t * 1.7) * 0.8; });
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 6, 10), mats.iron); stack.position.set(6, 10, 0); g.add(stack);
      smokers.push(new THREE.Vector3(6, 13.2, 0).applyQuaternion(g.quaternion).add(g.position));
      for (const x of [-2, 2]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), mats.lamp); w.position.set(x, 3.5, 3.52); g.add(w); }
    }
  }

  // ------------------------------------------------ dirigíveis: um atracado no mastro da ilha da largada, outros passeando
  const ships = [];
  const makeShip = (scale, col) => {
    const s = new THREE.Group();
    const env = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 12), phong({ color: col, shininess: 30 })); env.scale.set(2.6, 1, 1); s.add(env);
    for (let k = -2; k <= 2; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(5.02 * Math.sqrt(1 - (k / 2.9) ** 2), 0.12, 4, 20), mats.brass); band.rotation.y = Math.PI / 2; band.position.x = k * 4; s.add(band); }
    for (const rz of [0, Math.PI / 2]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.2), lam({ color: 0xb0322a })); fin.position.x = -12; fin.rotation.x = rz; s.add(fin); }
    const gond = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 2.4), lam({ color: 0x6b4426 })); gond.position.y = -6.4; s.add(gond);
    for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), mats.lamp); w.position.set(-2.4 + k * 1.6, -6.2, 1.22); s.add(w); }
    const prop = new THREE.Group(); prop.position.set(-4, -6.4, 0); s.add(prop);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.4), mats.brass); b.rotation.x = (k / 3) * Math.PI * 2; prop.add(b); }
    s.scale.setScalar(scale);
    s.userData.prop = prop;
    tr.group.add(s);
    return s;
  };
  {
    const A = ISL[0];
    let spot = null;
    for (let k = 0; k < 80 && !spot; k++) {
      const a = rnd() * Math.PI * 2, d = A.r * (0.55 + rnd() * 0.35);
      const x = A.c.x + Math.cos(a) * d, z = A.c.z + Math.sin(a) * d;
      if (clear(x, z, EDGE + 10)) spot = new THREE.Vector3(x, A.lv - 1, z);
    }
    if (spot) {
      const mast = new THREE.Mesh(limb(spot, spot.clone().add(new THREE.Vector3(0, 16, 0)), 0.6, 0.4, 8), mats.iron); tr.group.add(mast);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 6, 12), mats.brass); ring.position.copy(spot).add(new THREE.Vector3(0, 16, 0)); tr.group.add(ring);
      const docked = makeShip(1, 0xc8a878);
      const out = spot.clone().sub(A.c).setY(0).normalize();
      docked.position.copy(spot).add(new THREE.Vector3(0, 16, 0)).add(out.clone().multiplyScalar(13.5));
      docked.rotation.y = Math.atan2(-out.z, out.x) + Math.PI;
      const base = docked.position.clone();
      anims.push((t) => { docked.position.y = base.y + Math.sin(t * 0.8) * 0.4; docked.rotation.z = Math.sin(t * 0.6) * 0.03; docked.userData.prop.rotation.x += 0.02; });
    }
    const C = tr.center;
    for (const [rad, h, sp, col, sc] of [[190, 48, 0.03, 0x8a9a8a, 1.1], [240, 30, -0.022, 0xb8a080, 0.8], [150, 70, 0.04, 0xb8673a, 0.7]]) {
      const s = makeShip(sc, col);
      const ph = rnd() * 6;
      ships.push({ s, rad, h, sp, ph, C });
    }
  }

  // ------------------------------------------------ mar de nuvens e nuvens soltas
  {
    const ct = pixelTex(128, 128, (c, w, h, r) => {
      c.fillStyle = '#e8ecf0'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h, rr = 14 + r() * 22;
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { c.fillStyle = 'rgba(196,206,220,.5)'; c.beginPath(); c.arc(x + ox, y + oy + 4, rr, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x + ox, y + oy, rr, 0, Math.PI * 2); c.fill(); }
      }
    }, { seed: 33 });
    ct.repeat.set(7, 7);
    anims.push((t) => { ct.offset.x = t * 0.004; });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), basic({ map: ct }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(tr.center.x, -26, tr.center.z); tr.group.add(sea);
    const puff = H.SPR.fumaca();
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2, d = 60 + rnd() * 260;
      const p = new THREE.Vector3(tr.center.x + Math.cos(a) * d, -14 + rnd() * 60, tr.center.z + Math.sin(a) * d);
      if (tr.dist(p.x, p.z).d < EDGE + 20 && p.y > 0) continue;
      const g = new THREE.Group(); g.position.copy(p); tr.group.add(g);
      for (let m = 0; m < 4; m++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xf4f6f8, transparent: true, opacity: 0.85, depthWrite: false }));
        s.position.set((m - 1.5) * 6, rnd() * 3, rnd() * 4); s.scale.setScalar(10 + rnd() * 8); g.add(s);
      }
      const sp = (rnd() - 0.5) * 2;
      anims.push((t) => { g.position.x = p.x + Math.sin(t * 0.03 + a) * 20 * sp; });
    }
  }

  // ------------------------------------------------ robozinhos cuidando dos guinchos e acenando para quem passa
  {
    const bots = [];
    let made = 0;
    ISL.forEach((s, n) => {
      if (n === ISL.length - 1) return;
      for (let k = 0, tries = 0; k < 3 && tries < 60; tries++) {
        const a = rnd() * Math.PI * 2, d = s.r * (0.3 + rnd() * 0.6);
        const x = s.c.x + Math.cos(a) * d, z = s.c.z + Math.sin(a) * d;
        if (!clear(x, z, EDGE + 2.5) || tr.dist(x, z).d > EDGE + 9) continue;
        k++; made++;
        const b = tinBot(rnd, { mode: made % 3 === 0 ? 'cheer' : made % 3 === 1 ? 'work' : 'walk' });
        b.group.position.set(x, s.top, z);
        const ti = tr.dist(x, z).i; b.group.lookAt(tr.px[ti], s.top, tr.pz[ti]);
        tr.group.add(b.group); bots.push(b);
      }
    });
    anims.push((t) => { for (const b of bots) b.update(t, 1 / 60); });
  }

  // ------------------------------------------------ fumaça e animações
  const puffs = [];
  for (const top of smokers) for (let k = 0; k < 5; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xe8e0e8 }));
    tr.group.add(s); puffs.push({ s, top, t: k / 5 });
  }
  let t = 0;
  tr.animated.push((dt) => {
    t += dt;
    for (const f of anims) f(t);
    for (const sh of ships) {
      const a = sh.ph + t * sh.sp;
      sh.s.position.set(sh.C.x + Math.cos(a) * sh.rad, sh.h + Math.sin(t * 0.5 + sh.ph) * 2, sh.C.z + Math.sin(a) * sh.rad);
      sh.s.rotation.y = -a + (sh.sp > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI;
      sh.s.userData.prop.rotation.x += dt * 10;
    }
    for (const p of puffs) {
      p.t = (p.t + dt * 0.18) % 1;
      p.s.position.set(p.top.x + p.t * 3, p.top.y + p.t * 8, p.top.z);
      p.s.scale.setScalar(1 + p.t * 4); p.s.material.opacity = 0.6 * (1 - p.t);
    }
  });
}
