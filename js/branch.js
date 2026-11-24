import * as THREE from 'three';
import { ROAD_HALF, EDGE } from './data.js';

// =====================================================================
//  Atalhos e caminhos alternativos: um trecho de pista aberto que sai
//  da pista principal (lado a lado, sem muro entre as duas) e volta a ela
//  mais à frente, ou termina numa rampa de onde o kart salta para outro
//  ponto da pista ("launch").
//  Cada amostra do atalho sabe a que índice da pista principal ela
//  corresponde (mainIdx), para contar voltas e posições normalmente.
// =====================================================================

const SIDE_D = ROAD_HALF * 2;   // centro do atalho fica colado na borda da pista principal

export class Branch {
  constructor(track, def, id) {
    this.track = track; this.def = def; this.id = id;
    this.closed = false;
    this.launch = def.launch || null;
    this.ai = def.ai ?? 0.4;
    const mx = track.mirror ? -1 : 1;
    const OV = def.overlap ?? 26;
    const ia = track.nearestGlobal(def.from[0] * mx, def.from[1]);
    const mids = def.mid.map(([x, z, y]) => new THREE.Vector3(x * mx, y, z));
    const s = Math.sign(track.lateral(mids[0].x, mids[0].z, ia)) || 1;
    const P = (i, lat) => { const v = track.point(i, lat); v.y = track.py[track.wrap(i)]; return v; };
    const pts = [P(ia, 0), P(ia + OV * 0.5, s * SIDE_D * 0.45), P(ia + OV, s * SIDE_D), ...mids];
    let ib;
    if (this.launch) {
      ib = track.nearestGlobal(def.to[0] * mx, def.to[1]);
    } else {
      ib = track.nearestGlobal(def.to[0] * mx, def.to[1]);
      const last = mids[mids.length - 1];
      const s2 = Math.sign(track.lateral(last.x, last.z, ib)) || 1;
      pts.push(P(ib - OV, s2 * SIDE_D), P(ib - OV * 0.5, s2 * SIDE_D * 0.45), P(ib, 0));
    }
    this.ia = ia; this.ib = ib;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength();
    const N = (this.N = Math.max(8, Math.round(L)));
    this.step = L / (N - 1);
    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const p = curve.getPointAt(u), t = curve.getTangentAt(u);
      t.y = 0; t.normalize();
      this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z; this.tx[i] = t.x; this.tz[i] = t.z;
    }
    // índice equivalente na pista principal (avança de ia até ib)
    const span = track.wrap(ib - ia);
    this.mainIdx = new Int32Array(N);
    for (let i = 0; i < N; i++) this.mainIdx[i] = track.wrap(ia + Math.round((span * i) / (N - 1)));

    // trechos colados na pista principal: mesma altura e sem muro entre as duas
    this.open = new Uint8Array(N * 2);
    this.mainHit = new Int32Array(N).fill(-1);
    const glue = (i, hint) => {
      const mi = track.nearest(this.px[i], this.pz[i], hint);
      const ml = track.lateral(this.px[i], this.pz[i], mi);
      if (Math.abs(ml) > EDGE * 2) return -1;
      this.py[i] = track.py[mi];
      const myLatOfMain = (track.px[mi] - this.px[i]) * -this.tz[i] + (track.pz[mi] - this.pz[i]) * this.tx[i];
      this.open[i * 2 + (myLatOfMain >= 0 ? 0 : 1)] = 1;
      if (Math.abs(ml) < 1.5) this.open[i * 2] = this.open[i * 2 + 1] = 1;
      else for (const d of [-1, 0, 1]) track.open[track.wrap(mi + d) * 2 + (ml >= 0 ? 0 : 1)] = id + 1;
      this.mainHit[i] = mi;
      return mi;
    };
    for (let i = 0, h = ia; i < Math.min(N * 0.5, OV + 8); i++) { h = glue(i, h); if (h < 0) break; }
    if (!this.launch) for (let i = N - 1, h = track.wrap(ib - 20); i > Math.max(N * 0.5, N - OV - 9); i--) { h = glue(i, h); if (h < 0) break; }
    // suaviza a altura na transição entre a parte colada e o resto
    const raw = Float32Array.from(this.py);
    for (let i = 0; i < N; i++) {
      if (this.mainHit[i] >= 0) continue;
      let a = 0, n = 0;
      for (let k = -6; k <= 6; k++) { const j = Math.min(N - 1, Math.max(0, i + k)); a += raw[j]; n++; }
      this.py[i] = a / n;
    }

    // bordas, pontes e vãos
    const q = { x: 0, y: 0, z: 0 };
    this.edgeFall = new Uint8Array(N * 2);
    this.bridge = new Uint8Array(N);
    this.gap = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const p = { x: this.px[i] * mx, y: this.py[i], z: this.pz[i], f: i / N, i, n: N };
      if (def.bridge && def.bridge(p)) this.bridge[i] = 1;
      if (def.gap && def.gap(p)) this.gap[i] = 1;
      [1, -1].forEach((sg, k) => {
        if (this.open[i * 2 + k]) return;
        q.x = (this.px[i] - this.tz[i] * sg * (EDGE + 4)) * mx; q.z = this.pz[i] + this.tx[i] * sg * (EDGE + 4); q.y = p.y;
        const type = def.edge ? def.edge(p, q) : 'wall';
        this.edgeFall[i * 2 + k] = type === 'fall' ? 1 : 0;
      });
    }
    // rampa no fim de um atalho de salto
    if (this.launch) {
      const { len, rise } = this.launch;
      for (let k = 0; k < len; k++) this.py[N - 1 - k] += rise * (1 - k / len);
      for (let k = 0; k < 4; k++) this.edgeFall[(N - 1 - k) * 2] = this.edgeFall[(N - 1 - k) * 2 + 1] = 0;
    }
    this.curv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let a = 0;
      for (let k = 0; k < 22; k++) {
        const j = Math.min(N - 2, i + k), j2 = j + 1;
        a += Math.abs(Math.atan2(this.tx[j] * this.tz[j2] - this.tz[j] * this.tx[j2], this.tx[j] * this.tx[j2] + this.tz[j] * this.tz[j2]));
      }
      this.curv[i] = a;
    }
  }

  wrap(i) { return i < 0 ? 0 : i >= this.N ? this.N - 1 : i; }
  heading(i) { i = this.wrap(i); return Math.atan2(this.tx[i], this.tz[i]); }
  point(i, lat = 0, out = new THREE.Vector3()) {
    i = this.wrap(i);
    return out.set(this.px[i] - this.tz[i] * lat, this.py[i], this.pz[i] + this.tx[i] * lat);
  }
  nearest(x, z, hint) {
    let best = hint, bd = Infinity;
    for (let k = -25; k <= 45; k++) {
      const i = hint + k;
      if (i < 0 || i >= this.N) continue;
      const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  nearestGlobal(x, z) { return this.scan(x, z); }
  scan(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.N; i++) { const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  lateral(x, z, i) { return (x - this.px[i]) * -this.tz[i] + (z - this.pz[i]) * this.tx[i]; }
  along(x, z, i) { return (x - this.px[i]) * this.tx[i] + (z - this.pz[i]) * this.tz[i]; }
  groundY(x, z, i) {
    const along = this.along(x, z, i);
    const j = along >= 0 ? Math.min(this.N - 1, i + 1) : Math.max(0, i - 1);
    return this.py[i] + (this.py[j] - this.py[i]) * Math.min(1, Math.abs(along) / this.step);
  }
  isFall(i, lat) { return this.edgeFall[i * 2 + (lat >= 0 ? 0 : 1)] === 1; }
  isOpen(i, lat) { return this.open[i * 2 + (lat >= 0 ? 0 : 1)] === 1; }
}

// ---------------------------------------------------------------------
// Acompanha um objeto (kart ou item) pela pista e pelos atalhos.
// o = { pos, idx (índice na principal), path (Branch|null), bidx }
// Devolve { S, si, lat, exit } onde exit = 'launch' quando saiu voando da ponta de um atalho.
// ---------------------------------------------------------------------
export function follow(track, o) {
  const x = o.pos.x, z = o.pos.z;
  let exit = null;
  if (o.path) {
    const br = o.path;
    let si = br.nearest(x, z, o.bidx ?? 0);
    const al = br.along(x, z, si);
    if ((si >= br.N - 1 && al > 0) || (si <= 0 && al < 0)) {
      // saiu pela ponta do atalho
      exit = si > 0 && br.launch ? 'launch' : 'end';
      o.path = null;
      o.idx = track.nearest(x, z, track.wrap((si > 0 ? br.ib : br.ia) - 15));
    } else {
      o.bidx = si;
      const lat = br.lateral(x, z, si);
      if (br.isOpen(si, lat) && br.mainHit[si] >= 0) {
        const mi = track.nearest(x, z, br.mainHit[si]);
        const ml = track.lateral(x, z, mi);
        if (Math.abs(ml) < Math.abs(lat) && Math.abs(track.py[mi] - o.pos.y) < 2) { o.path = null; o.idx = mi; return { S: track, si: mi, lat: ml, exit }; }
      }
      o.idx = br.mainIdx[si];
      return { S: br, si, lat, exit };
    }
  }
  const si = track.nearest(x, z, o.idx);
  const lat = track.lateral(x, z, si);
  const ob = track.open[si * 2 + (lat >= 0 ? 0 : 1)];
  if (ob && !exit) {
    const br = track.branches[ob - 1];
    const bi = br.scan(x, z);
    const bl = br.lateral(x, z, bi);
    if (Math.abs(bl) < Math.abs(lat) && bi > 0 && bi < br.N - 1 && Math.abs(br.py[bi] - o.pos.y) < 2 && !o.flying) { o.path = br; o.bidx = bi; o.idx = br.mainIdx[bi]; return { S: br, si: bi, lat: bl, exit }; }
  }
  o.idx = si;
  return { S: track, si, lat, exit };
}

// índice equivalente na pista principal
export const mainIndex = (o, si) => (o.path ? o.path.mainIdx[si] : si);
