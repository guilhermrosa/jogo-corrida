import * as THREE from 'three';
import { EDGE } from './data.js';

// =====================================================================
//  Colisão com o cenário. Tudo que existe no mapa e entra no corredor da
//  pista na altura do kart (pilar, poste, caixote, torre, arquibancada,
//  parede de galpão...) vira parede sólida.
//  Como: cada triângulo das peças perto da pista é cortado por um plano na
//  altura do kart (chão da pista + 0,9 m). O corte é um segmento no chão;
//  o kart é um círculo e não atravessa esses segmentos. Funciona para peças
//  ocas (galpão, túnel, celeiro): só as paredes contam, não a caixa toda.
//  Os segmentos ficam indexados pelas amostras da pista em que encostam.
//  Ignora: userData.road (pista, muro, chão, água) e userData.noSolid
//  (robôs andando, efeitos), sprites, linhas e fachos transparentes.
// =====================================================================

const CUT = 0.9;                          // altura do corte acima do chão da pista
const KART_LOW = 0.25, KART_HIGH = 1.7;   // faixa de altura do kart
const PIECE = 1.5;                        // segmentos longos são quebrados neste tamanho
const NEAR = 1.4;                         // distância máxima de uma amostra do corredor

export function buildSolids(tr) {
  const paths = [tr, ...(tr.branches || [])];
  const samples = [];
  paths.forEach((P, pid) => {
    for (let i = 0; i < P.N; i++) for (let l = -(EDGE - 0.6); l <= EDGE - 0.59; l += 1.2) {
      const a = P.point(i, l); samples.push({ x: a.x, z: a.z, y: P.py[i], pid, i });
    }
  });
  const CELL = 4, grid = new Map();
  const key = (gx, gz) => gx * 100003 + gz;
  for (const s of samples) {
    const k = key(Math.floor(s.x / CELL), Math.floor(s.z / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
  }
  // amostras perto de (x, z) dentro do raio
  const near = (x, z, rad, out) => {
    out.length = 0;
    for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++)
      for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
        const l = grid.get(key(gx, gz));
        if (l) for (const s of l) if ((s.x - x) ** 2 + (s.z - z) ** 2 < rad * rad) out.push(s);
      }
    return out;
  };

  const segs = [], index = paths.map((P) => new Array(P.N));
  const tmp = [], box = new THREE.Box3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();

  let src = null;
  const addSeg = (x0, z0, x1, z1, y0, y1) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(L / PIECE));
    for (let q = 0; q < n; q++) {
      const ax = x0 + ((x1 - x0) * q) / n, az = z0 + ((z1 - z0) * q) / n;
      const bx = x0 + ((x1 - x0) * (q + 1)) / n, bz = z0 + ((z1 - z0) * (q + 1)) / n;
      const hits = near((ax + bx) / 2, (az + bz) / 2, NEAR + PIECE / 2, tmp).filter((s) => y1 > s.y + KART_LOW && y0 < s.y + KART_HIGH);
      if (!hits.length) continue;
      const id = segs.length;
      segs.push({ ax, az, bx, bz, y0, y1, src });
      for (const s of hits) for (let d = -2; d <= 2; d++) {
        const P = paths[s.pid];
        const j = P.closed ? P.wrap(s.i + d) : s.i + d;
        if (j < 0 || j >= P.N) continue;
        const arr = (index[s.pid][j] ||= []);
        if (arr[arr.length - 1] !== id && !arr.includes(id)) arr.push(id);
      }
    }
  };

  // corta o triângulo ABC pelo plano y = h; devolve o segmento (se cruzar)
  const cutTri = (h) => {
    const pts = [];
    for (const [p, q] of [[A, B], [B, C], [C, A]]) {
      if ((p.y - h) * (q.y - h) < 0) { const t = (h - p.y) / (q.y - p.y); pts.push(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t); }
    }
    return pts.length >= 4 ? pts : null;
  };

  const doGeo = (geo, matrix) => {
    if (!geo.boundingBox) geo.computeBoundingBox();
    box.copy(geo.boundingBox).applyMatrix4(matrix);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const rad = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + NEAR;
    if (rad > 400) return;
    const cand = near(cx, cz, rad, tmp).filter((s) => box.max.y > s.y + KART_LOW && box.min.y < s.y + KART_HIGH
      && s.x > box.min.x - NEAR && s.x < box.max.x + NEAR && s.z > box.min.z - NEAR && s.z < box.max.z + NEAR);
    if (!cand.length) return;
    const pos = geo.attributes.position, idx = geo.index;
    const n = idx ? idx.count : pos.count;
    const local = [];
    for (let t = 0; t < n; t += 3) {
      const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
      A.fromBufferAttribute(pos, ia).applyMatrix4(matrix);
      B.fromBufferAttribute(pos, ib).applyMatrix4(matrix);
      C.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
      const y0 = Math.min(A.y, B.y, C.y), y1 = Math.max(A.y, B.y, C.y);
      const mx = (A.x + B.x + C.x) / 3, mz = (A.z + B.z + C.z) / 3;
      // altura da pista perto do triângulo
      const tl = Math.max(Math.abs(A.x - mx), Math.abs(B.x - mx), Math.abs(C.x - mx), Math.abs(A.z - mz), Math.abs(B.z - mz), Math.abs(C.z - mz));
      near(mx, mz, tl + NEAR, local);
      if (!local.length) continue;
      let ry = local[0].y, bd = Infinity;
      for (const s of local) { const d = (s.x - mx) ** 2 + (s.z - mz) ** 2; if (d < bd) { bd = d; ry = s.y; } }
      const cut = cutTri(ry + CUT);
      if (cut) addSeg(cut[0], cut[1], cut[2], cut[3], y0, y1);
    }
  };

  const m4 = new THREE.Matrix4();
  // o que se move pelo cenário (submarino, trator, carrinhos, guindaste) não vira parede:
  // roda as animações por alguns segundos e marca as peças que saíram do lugar
  tr.group.updateMatrixWorld(true);
  const before = new Map();
  tr.group.traverse((o) => { if (o.isMesh) before.set(o, new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)); });
  const v = new THREE.Vector3();
  for (const dt of [1.7, 2.9, 4.3]) {
    for (const f of tr.animated || []) f(dt);
    tr.group.updateMatrixWorld(true);
    for (const [o, p0] of before) if (v.setFromMatrixPosition(o.matrixWorld).distanceToSquared(p0) > 0.25) o.userData.noSolid = true;
  }
  tr.group.updateMatrixWorld(true);
  tr.group.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible || o.isSprite || o.userData.road || o.userData.noSolid) return;
    for (let p = o.parent; p && p !== tr.group; p = p.parent) if (p.userData.noSolid || !p.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((m) => m.transparent && m.opacity < 0.5)) return;   // fachos de luz, vapor
    src = o;
    if (o.isInstancedMesh) {
      for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, m4); m4.premultiply(o.matrixWorld); doGeo(o.geometry, m4); }
    } else doGeo(o.geometry, o.matrixWorld);
  });

  return { segs, index, paths };
}

// empurra o kart para fora das paredes do cenário; devolve true se bateu andando contra
export function collideSolids(tr, k) {
  const S = tr.solids;
  if (!S || !S.segs.length) return false;
  const pid = k.path ? S.paths.indexOf(k.path) : 0;
  const ids = S.index[pid]?.[k.path ? k.bidx : k.idx];
  if (!ids) return false;
  const r = k.radius ?? 0.9, ya = k.pos.y + KART_LOW, yb = k.pos.y + KART_HIGH;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) for (const id of ids) {
    const s = S.segs[id];
    if (yb < s.y0 || ya > s.y1) continue;
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1e-6;
    const u = Math.max(0, Math.min(1, ((k.pos.x - s.ax) * ex + (k.pos.z - s.az) * ez) / L2));
    const qx = s.ax + ex * u, qz = s.az + ez * u;
    let nx = k.pos.x - qx, nz = k.pos.z - qz;
    const d = Math.hypot(nx, nz);
    if (d >= r) continue;
    if (d < 1e-4) {
      // em cima da linha: sai pelo lado de onde veio
      nx = -ez; nz = ex; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
      if (Math.sin(k.heading) * nx + Math.cos(k.heading) * nz > 0) { nx = -nx; nz = -nz; }
    } else { nx /= d; nz /= d; }
    k.pos.x = qx + nx * (r + 0.01); k.pos.z = qz + nz * (r + 0.01);
    if (pass) continue;
    const vx = Math.sin(k.heading) * k.speed, vz = Math.cos(k.heading) * k.speed;
    const into = -(vx * nx + vz * nz);
    if (into > 0.3) {
      if (into / Math.max(0.01, Math.abs(k.speed)) > 0.85) k.speed = -k.speed * 0.25;   // de frente: quica para trás
      else {
        // de raspão: alinha com a parede e perde um pouco de velocidade
        const tx = -nz, tz = nx, sg = Math.sign(vx * tx + vz * tz) || 1;
        let dh = Math.atan2(tx * sg, tz * sg) - k.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        k.heading += dh * 0.75;
        k.speed *= 0.7;
      }
      hit = true;
    }
  }
  return hit;
}

