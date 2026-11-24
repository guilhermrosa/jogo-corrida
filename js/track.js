import * as THREE from 'three';
import { TRACKS, THEMES, ROAD_HALF, SHOULDER, EDGE } from './data.js';
import { buildTerrain, buildScenery } from './scenery.js';
import { Branch } from './branch.js';
import { roadTexture, groundTexture, terrainDetail, skirtTexture, wallTexture, waterTexture, lavaTexture } from './textures.js';

export { ROAD_HALF, SHOULDER, EDGE };

const GROUND_Y = -0.15;

// amplia um desenho pequeno 4x sem borrar (pixel nítido), para o modo de alta definição
export function crisp(c, k = 4) {
  const big = document.createElement('canvas');
  big.width = c.width * k; big.height = c.height * k;
  const g = big.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, big.width, big.height);
  return big;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Texturas pequenas e filtradas (o "borrado" típico do N64)
export function retroTex(w, h, draw, { repeat = true, nearest = false } = {}) {
  let c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  c = crisp(c);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 16;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; }
  return t;
}

function noiseFill(c, w, h, a, b, n = 0.5) {
  c.fillStyle = a; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * n; i++) {
    c.fillStyle = b;
    c.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1);
  }
}

export class Track {
  constructor(scene, id, mirror = false) {
    this.id = id;
    this.mirror = mirror;
    this.def = TRACKS[id];
    this.theme = THEMES[this.def.theme];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.animated = [];

    const pts = this.def.points.map(([x, z, y]) => new THREE.Vector3(mirror ? -x : x, y, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.water = this.def.water ? this.def.water.map(([x, z, w, d]) => [mirror ? -(x + w) : x, z, w, d]) : null;
    this.length = this.curve.getLength();
    const N = (this.N = Math.round(this.length));
    this.step = this.length / N;

    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = this.curve.getPointAt(i / N);
      const t = this.curve.getTangentAt(i / N);
      t.y = 0; t.normalize();
      this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z;
      this.tx[i] = t.x; this.tz[i] = t.z;
    }

    // Curvatura à frente (para a IA frear)
    this.curv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let a = 0;
      for (let k = 0; k < 22; k++) {
        const j = (i + k) % N, j2 = (j + 1) % N;
        const cross = this.tx[j] * this.tz[j2] - this.tz[j] * this.tx[j2];
        const dot = this.tx[j] * this.tx[j2] + this.tz[j] * this.tz[j2];
        a += Math.abs(Math.atan2(cross, dot));
      }
      this.curv[i] = a;
    }

    // Centro geométrico (para saber qual lado é "de fora")
    let cx = 0, cz = 0;
    for (let i = 0; i < N; i++) { cx += this.px[i]; cz += this.pz[i]; }
    cx /= N; cz /= N;

    // Tipo de cada borda: 0 = muro, 1 = queda.  [i*2] = lado +, [i*2+1] = lado -
    this.edgeFall = new Uint8Array(N * 2);
    this.open = new Uint8Array(N * 2);   // borda aberta para um atalho colado (id do atalho + 1)
    this.closed = true;
    this.bridge = new Uint8Array(N);
    this.gap = new Uint8Array(N);
    const q = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < N; i++) {
      const mx = mirror ? -1 : 1;
      const p = { x: this.px[i] * mx, y: this.py[i], z: this.pz[i], f: i / N };
      if (this.def.bridge && this.def.bridge(p)) this.bridge[i] = 1;
      if (this.def.gap && this.def.gap(p)) this.gap[i] = 1;
      [1, -1].forEach((s, k) => {
        q.x = this.px[i] - this.tz[i] * s * (EDGE + 4);
        q.z = this.pz[i] + this.tx[i] * s * (EDGE + 4);
        q.y = p.y;
        q.x *= mx;
        const outer = Math.hypot(q.x * mx - cx, q.z - cz) > Math.hypot(this.px[i] - cx, p.z - cz);
        const type = this.bridge[i] ? (this.def.bridgeEdge ? this.def.bridgeEdge(p, q, outer) : 'wall') : this.def.edge(p, q, outer);
        this.edgeFall[i * 2 + k] = type === 'fall' ? 1 : 0;
      });
    }

    // Rampa de salto logo antes do vão (a pista sobe reto até a borda)
    if (this.def.kick && this.gap.some((g) => g)) {
      const { len, rise } = this.def.kick;
      for (let g0 = 0; g0 < N; g0++) {
        if (!this.gap[g0] || this.gap[(g0 - 1 + N) % N]) continue;   // começo de cada vão
        for (let k = 1; k <= len; k++) this.py[(g0 - k + N) % N] += rise * (1 - (k - 1) / len);
      }
    }

    // Atalhos e caminhos alternativos
    this.branches = (this.def.branches || []).map((b, n) => new Branch(this, b, n));

    // Caixas de itens: fileiras atravessando a pista
    this.itemSpots = [];
    for (const f of this.def.itemRows) {
      const idx = Math.round(f * N);
      for (const lat of [-4.5, -1.5, 1.5, 4.5]) this.itemSpots.push({ idx, lat });
    }

    this.build();
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
  }

  wrap(i) { const N = this.N; return ((i % N) + N) % N; }
  heading(i) { i = this.wrap(i); return Math.atan2(this.tx[i], this.tz[i]); }

  point(i, lat = 0, out = new THREE.Vector3()) {
    i = this.wrap(i);
    return out.set(this.px[i] - this.tz[i] * lat, this.py[i], this.pz[i] + this.tx[i] * lat);
  }

  nearest(x, z, hint) {
    const N = this.N;
    let best = hint, bd = Infinity;
    for (let k = -25; k <= 45; k++) {
      const i = (hint + k + N) % N;
      const dx = x - this.px[i], dz = z - this.pz[i];
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Busca completa (usada só em respawn / itens sem referência)
  nearestGlobal(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.N; i++) {
      const dx = x - this.px[i], dz = z - this.pz[i];
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  lateral(x, z, i) { return (x - this.px[i]) * -this.tz[i] + (z - this.pz[i]) * this.tx[i]; }

  // altura do chão na pista, interpolada ao longo do trecho
  groundY(x, z, i) {
    const N = this.N;
    const j = (i + 1) % N, h = (i - 1 + N) % N;
    const along = (x - this.px[i]) * this.tx[i] + (z - this.pz[i]) * this.tz[i];
    if (along >= 0) return this.py[i] + (this.py[j] - this.py[i]) * Math.min(1, along / this.step);
    return this.py[i] + (this.py[h] - this.py[i]) * Math.min(1, -along / this.step);
  }

  isFall(i, lat) { return this.edgeFall[i * 2 + (lat >= 0 ? 0 : 1)] === 1; }

  // ------------------------------------------------------------------ construção visual
  ribbon(fa, fb, vLen, skip, P = this) {
    const N = P.N, pos = [], uv = [], idx = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const last = P.closed ? N : N - 1;
    for (let i = 0; i <= last; i++) {
      const k = i % N;
      fa(k, a); fb(k, b);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const v = (i * P.step) / vLen;
      uv.push(0, v, 1, v);
      if (i < last && !(skip && skip(k))) { const j = i * 2; idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); this.group.add(m); return m; }

  buildRoad(P, M) {
    const N = P.N;
    const R = (lat, dy = 0) => (k, out) => P.point(k, lat, out).setY(P.py[k] + dy);
    const nx = (k) => (P.closed ? (k + 1) % N : Math.min(N - 1, k + 1));
    const G = (k) => P.gap[k] || P.gap[nx(k)]; // vão da ponte quebrada: sem nada
    // atalho: asfalto um pouco acima (onde se sobrepõe à principal) e acostamento um pouco abaixo
    const ry = P.closed ? 0.06 : 0.075, sy = P.closed ? 0.03 : 0.015;
    this.mesh(this.ribbon(R(ROAD_HALF, ry), R(-ROAD_HALF, ry), 16, G, P), P.closed ? M.asphalt : M.asphaltB);
    const shoulderMat = M.shoulder;
    this.mesh(this.ribbon(R(EDGE, sy), R(ROAD_HALF, sy), 6, G, P), shoulderMat);
    this.mesh(this.ribbon(R(-ROAD_HALF, sy), R(-EDGE, sy), 6, G, P), shoulderMat);

    // Encostas (barrancos) da pista até o chão, exceto nas pontes
    const base = this.def.lava ? -0.8 : GROUND_Y;
    const skirtMat = M.skirt;
    for (const [s, kk] of [[1, 0], [-1, 1]]) {
      const top = (k, out) => P.point(k, s * EDGE, out);
      const bot = (k, out) => P.point(k, s * (EDGE + Math.max(0, P.py[k] - base) * 0.7 + 0.3), out).setY(base);
      this.mesh(this.ribbon(top, bot, 8, (k) => G(k) || P.bridge[k] || P.bridge[nx(k)] || P.open[k * 2 + kk] || P.open[nx(k) * 2 + kk], P), skirtMat);
    }

    // Muros baixos onde a borda não é uma queda
    const wallMat = M.wall;
    for (const [s, kk] of [[1, 0], [-1, 1]]) {
      const lo = (k, out) => P.point(k, s * EDGE, out);
      const hi = (k, out) => P.point(k, s * EDGE, out).setY(P.py[k] + 1.0);
      this.mesh(this.ribbon(lo, hi, 4, (k) => G(k) || P.edgeFall[k * 2 + kk] || P.edgeFall[nx(k) * 2 + kk] || P.open[k * 2 + kk] || P.open[nx(k) * 2 + kk], P), wallMat);
    }

    // Pontes: parte de baixo do tabuleiro e pilares
    if (P.bridge.some((b) => b)) {
      const under = M.under;
      const bl = (k, out) => P.point(k, EDGE, out).setY(P.py[k] - 0.8);
      const br = (k, out) => P.point(k, -EDGE, out).setY(P.py[k] - 0.8);
      this.mesh(this.ribbon(bl, br, 8, (k) => !P.bridge[k] || G(k), P), under);
      for (const s of [1, -1]) {
        const a = (k, out) => P.point(k, s * EDGE, out);
        const b = (k, out) => P.point(k, s * EDGE, out).setY(P.py[k] - 0.8);
        this.mesh(this.ribbon(a, b, 8, (k) => !P.bridge[k] || G(k), P), under);
      }
      const pillarMat = M.pillar;
      const v = new THREE.Vector3();
      const mats = [];
      const pw = this.theme.pillarW ?? 1.4;
      for (let i = 0; i < N; i += this.theme.pillarStep ?? 10) {
        if (!P.bridge[i] || P.gap[i] || P.gap[P.wrap(i + 3)] || P.gap[P.wrap(i - 3)]) continue;
        for (const s of [1, -1]) {
          P.point(i, s * (EDGE - 1), v);
          // não colocar pilar em cima de outro trecho da pista
          let clash = false;
          for (let j = 0; j < this.N; j += 2) {
            if (Math.abs(this.py[j] - P.py[i]) < 4) continue;
            if (Math.hypot(v.x - this.px[j], v.z - this.pz[j]) < EDGE + 3) { clash = true; break; }
          }
          for (const o of this.branches) for (let j = 0; j < o.N && !clash; j += 2) {
            if (Math.abs(o.py[j] - P.py[i]) < 4) continue;
            if (Math.hypot(v.x - o.px[j], v.z - o.pz[j]) < EDGE + 3) clash = true;
          }
          if (clash) continue;
          const h = P.py[i] - base + (this.theme.pillarDeep ?? 0);
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(v.x, P.py[i] - 0.8 - h / 2, v.z), new THREE.Quaternion(), new THREE.Vector3(pw, h, pw)));
        }
      }
      if (mats.length) {
        const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pillarMat, mats.length);
        mats.forEach((m, n) => im.setMatrixAt(n, m));
        this.group.add(im);
      }
    }

  }

  build() {
    const th = this.theme, N = this.N;
    const rnd = mulberry32(this.id.length * 977 + N);
    const lam = (opts) => new THREE.MeshLambertMaterial(opts);

    // ---------- texturas
    const T = this.def.theme;
    const asphalt = roadTexture(T);
    const shoulderTex = groundTexture(T);
    const groundTex = groundTexture(T, 'terrain');
    groundTex.repeat.set(500, 500);
    const skirtTex = skirtTexture(T);
    const wallTex = wallTexture(T);

    // ---------- chão, água e lava
    // relevo com morros (o chão plano fica só embaixo, como reserva)
    this.groundBase = GROUND_Y;
    buildTerrain(this, GROUND_Y);
    const ground = this.mesh(new THREE.PlaneGeometry(4000, 4000), lam({ map: groundTex, polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = this.def.void ? -400 : Math.min(GROUND_Y - (this.def.lava ? 2 : 0.4), (this.def.waterY ?? 0.12) - 0.8);
    if (this.def.void) { ground.visible = false; this.hazardY = -14; }

    if (this.def.water) {
      const wt = waterTexture(this.theme.waterColors);
      wt.repeat.set(40, 40);
      this.animated.push((dt) => { wt.offset.x += dt * 0.02; wt.offset.y += dt * 0.012; });
      const wm = lam({ map: wt, transparent: true, opacity: 0.92 });
      for (const [x, z, w, d] of this.water) {
        const m = this.mesh(new THREE.PlaneGeometry(w, d), wm);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x + w / 2, this.def.waterY ?? 0.12, z + d / 2);
      }
      this.hazardY = this.def.waterY ?? 0.12;
    }
    if (this.def.swampWater) {
      const wt = waterTexture(this.theme.waterColors);
      wt.repeat.set(160, 160);
      this.animated.push((dt) => { wt.offset.x += dt * 0.006; wt.offset.y += dt * 0.004; });
      const m = this.mesh(new THREE.PlaneGeometry(2400, 2400), lam({ map: wt, transparent: true, opacity: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(this.center?.x ?? 0, this.def.waterY, this.center?.z ?? 0);
      this.hazardY = this.def.waterY;
    }
    if (this.def.lava) {
      const lt = lavaTexture();
      lt.repeat.set(120, 120);
      this.animated.push((dt) => { lt.offset.x += dt * 0.03; lt.offset.y -= dt * 0.02; });
      const lava = this.mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ map: lt, fog: true }));
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = -0.6;
      this.hazardY = -0.6;
    }
    if (this.hazardY === undefined) this.hazardY = GROUND_Y;

    // ---------- pista (principal e atalhos)
    const M = {
      asphalt: lam({ map: asphalt }), asphaltB: lam({ map: asphalt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), shoulder: lam({ map: shoulderTex }),
      skirt: lam({ map: skirtTex, side: THREE.DoubleSide }), wall: lam({ map: wallTex, side: THREE.DoubleSide }),
      under: lam({ color: this.theme.deck ?? 0x6d4c41, side: THREE.DoubleSide }), pillar: lam({ color: this.theme.pillar ?? 0x8d8d8d }),
    };
    this.roadMats = M;
    this.buildRoad(this, M);
    for (const br of this.branches) this.buildRoad(br, M);

    // ---------- largada: faixa quadriculada e pórtico
    const checker = retroTex(16, 4, (c, w, h) => {
      for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x, y, 1, 1); }
    }, { nearest: true });
    const start = new THREE.Group();
    this.point(0, 0, start.position);
    start.rotation.y = this.heading(0);
    this.group.add(start);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 2), lam({ map: checker }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.09;
    start.add(line);
    // pórtico de largada do mundo steampunk: pilares de cobre rebitado, engrenagens girando e lampiões
    const brass = new THREE.MeshPhongMaterial({ color: 0xc9a24a, shininess: 70, specular: 0x887755 });
    const copper = new THREE.MeshPhongMaterial({ color: 0xb8673a, shininess: 50, specular: 0x553322 });
    const postMat = lam({ color: 0x3b3632 });
    const gearGeo = (R, T) => {
      const sh = new THREE.Shape();
      for (let k = 0; k < T; k++) {
        const a = (k / T) * Math.PI * 2, st = (Math.PI * 2) / T, P = (aa, rr) => [Math.cos(aa) * rr, Math.sin(aa) * rr];
        if (!k) sh.moveTo(...P(a, R * 0.82)); else sh.lineTo(...P(a, R * 0.82));
        sh.lineTo(...P(a + st * 0.2, R)); sh.lineTo(...P(a + st * 0.5, R)); sh.lineTo(...P(a + st * 0.7, R * 0.82));
      }
      const h = new THREE.Path(); h.absarc(0, 0, R * 0.3, 0, Math.PI * 2, true); sh.holes.push(h);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); g.translate(0, 0, -0.15);
      return g;
    };
    const gears = [];
    for (const s of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.2), copper);
      post.position.set(s * (EDGE + 0.9), 4, 0);
      start.add(post);
      for (const y of [0.6, 4, 7.6]) { const band = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), brass); band.position.set(s * (EDGE + 0.9), y, 0); start.add(band); }
      const g = new THREE.Mesh(gearGeo(1.6, 12), brass); g.position.set(s * (EDGE + 0.9), 8.6, 0.8); start.add(g); gears.push([g, s]);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd98a })); lamp.position.set(s * (EDGE + 0.9), 10.6, 0); start.add(lamp);
    }
    this.animated.push((dt) => { for (const [g, s] of gears) g.rotation.z += dt * 0.8 * s; });
    const banner = retroTex(128, 16, (c, w, h) => {
      c.fillStyle = '#2a2624'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c9a24a'; c.fillRect(1, 1, w - 2, h - 2);
      c.fillStyle = '#5a1e14'; c.fillRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#ffd98a'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.def.name.toUpperCase(), w / 2, h / 2 + 1);
    }, { repeat: false });
    const bmat = lam({ map: banner });
    const beam = new THREE.Mesh(new THREE.BoxGeometry((EDGE + 0.9) * 2 + 1.2, 1.8, 0.5), [brass, brass, brass, brass, bmat, bmat]);
    beam.position.y = 7;
    start.add(beam);
    // cano de vapor por cima da faixa
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, (EDGE + 0.9) * 2, 10), copper); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 8.3, -0.4); start.add(pipe);

    // ---------- céu: painel pintado ao redor (como os fundos do N64)
    this.buildBackdrop(rnd);

    // ---------- decoração: árvores em "X" (dois planos cruzados)
    this.buildDecor(rnd);
    buildScenery(this, rnd);
  }

  buildBackdrop(rnd) {
    const th = this.theme;
    const sky = new THREE.Color(th.sky);
    const tex = retroTex(512, 64, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#' + sky.clone().multiplyScalar(0.8).getHexString());
      g.addColorStop(1, '#' + new THREE.Color(th.fog).getHexString());
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // nuvens
      if (this.def.theme !== 'vulcao') {
        c.fillStyle = this.def.theme === 'pantano' ? 'rgba(190,225,220,.4)' : 'rgba(255,255,255,.85)';
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w, y = 6 + rnd() * 18;
          for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + k * 7, y + (k % 2) * 2, 8, 4, 0, 0, Math.PI * 2); c.fill(); }
        }
      } else {
        c.fillStyle = 'rgba(255,120,40,.35)';
        for (let i = 0; i < 10; i++) { c.beginPath(); c.ellipse(rnd() * w, 10 + rnd() * 20, 30, 6, 0, 0, Math.PI * 2); c.fill(); }
      }
      // montanhas
      const layers = this.def.theme === 'serra'
        ? [['#8fa3bb', 0.45], ['#c9d6e6', 0.62]]
        : this.def.theme === 'vulcao' ? [['#2a1414', 0.4], ['#1a0c0c', 0.6]]
          : this.def.theme === 'praia' ? [['#6aa7c9', 0.72]]
            : this.def.theme === 'oficina' ? [['#8a9fb0', 0.48], ['#6f9a5a', 0.66]]
              : this.def.theme === 'ilhas' ? [['#a8b8cc', 0.62], ['#c8ccd4', 0.74]]
              : this.def.theme === 'pantano' ? [['#3c6466', 0.5], ['#2a4a44', 0.64], ['#1e3632', 0.76]]
                : this.def.theme === 'sucata' ? [['#d89a6a', 0.46], ['#b86a42', 0.62]] : [['#5f8f6a', 0.5], ['#3f7a4a', 0.68]];
      for (const [col, base] of layers) {
        c.fillStyle = col;
        c.beginPath(); c.moveTo(0, h);
        let x = 0;
        while (x <= w) { c.lineTo(x, h * base + (rnd() - 0.5) * h * 0.35); x += 12 + rnd() * 24; }
        c.lineTo(w, h); c.closePath(); c.fill();
      }
      if (this.def.theme === 'vulcao') {
        c.fillStyle = '#ff6a00';
        c.beginPath(); c.moveTo(200, h * 0.38); c.lineTo(210, h * 0.2); c.lineTo(222, h * 0.2); c.lineTo(232, h * 0.38); c.fill();
      }
    }, { repeat: false });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = 2;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1100, 1100, 520, 32, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    cyl.position.y = 140;
    cyl.renderOrder = -1;
    this.group.add(cyl);
    this.backdrop = cyl;
  }

  buildDecor(rnd) {
    const type = this.theme.decor;
    const tex = retroTex(32, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      if (type === 'arvore') {
        c.fillStyle = '#6d4c41'; c.fillRect(13, 40, 6, 24);
        c.fillStyle = '#2e7d32'; c.beginPath(); c.arc(16, 26, 15, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#43a047'; c.beginPath(); c.arc(12, 20, 8, 0, Math.PI * 2); c.fill();
      } else if (type === 'coqueiro') {
        c.strokeStyle = '#8d6e63'; c.lineWidth = 4; c.beginPath(); c.moveTo(16, 64); c.quadraticCurveTo(22, 40, 15, 16); c.stroke();
        c.fillStyle = '#2e9e3e';
        for (let a = 0; a < 6; a++) { c.beginPath(); c.ellipse(15 + Math.cos(a) * 8, 14 + Math.sin(a) * 3, 9, 3, a, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#6d4c41'; c.beginPath(); c.arc(15, 17, 2.5, 0, Math.PI * 2); c.fill();
      } else if (type === 'pinheiro') {
        c.fillStyle = '#5d4037'; c.fillRect(14, 52, 4, 12);
        for (let k = 0; k < 3; k++) {
          c.fillStyle = '#1b5e20'; c.beginPath(); c.moveTo(16, 4 + k * 14); c.lineTo(3, 30 + k * 12); c.lineTo(29, 30 + k * 12); c.fill();
          c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(16, 4 + k * 14); c.lineTo(10, 14 + k * 13); c.lineTo(22, 14 + k * 13); c.fill();
        }
      } else {
        c.fillStyle = '#3e2723'; c.beginPath(); c.moveTo(2, 64); c.lineTo(8, 34); c.lineTo(20, 28); c.lineTo(30, 64); c.fill();
        c.fillStyle = '#ff7a1a'; c.fillRect(12, 50, 3, 3); c.fillRect(20, 42, 2, 2);
      }
    }, { repeat: false });
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(6, 12);
    geo.translate(0, 6, 0);
    const geo2 = geo.clone().rotateY(Math.PI / 2);
    const merged = mergeGeos([geo, geo2]);
    const count = this.theme.decorCount ?? 220;
    const inst = new THREE.InstancedMesh(merged, mat, count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let n = 0, tries = 0;
    while (n < count && tries < 9000) {
      tries++;
      const i = (rnd() * this.N) | 0;
      const side = rnd() < 0.5 ? 1 : -1;
      const dmin = this.theme.decorMin ?? 6;
      const dist = EDGE + Math.max(0, this.py[i]) * 0.7 + dmin + rnd() * 60;
      this.point(i, side * dist, v);
      // longe de qualquer trecho da pista, e fora de água/lava
      let ok = true;
      for (let j = 0; j < this.N; j += 3) {
        if (Math.hypot(v.x - this.px[j], v.z - this.pz[j]) < EDGE + Math.max(0, this.py[j]) * 0.7 + dmin - 1) { ok = false; break; }
      }
      if (ok && this.dist(v.x, v.z).d < EDGE + dmin) ok = false;
      if (ok && this.water) for (const [x, z, w, d] of this.water) if (v.x > x - 4 && v.x < x + w + 4 && v.z > z - 4 && v.z < z + d + 4) ok = false;
      if (ok && this.def.lava) ok = false;
      if (!ok) continue;
      const sc = 0.8 + rnd() * 0.6;
      q.setFromAxisAngle(s.set(0, 1, 0), rnd() * Math.PI);
      m4.compose(v.setY(this.terrainY(v.x, v.z) - 0.2), q, s.set(sc, sc, sc));
      inst.setMatrixAt(n++, m4);
    }
    inst.count = n;
    this.group.add(inst);

    // Vulcão: rochas pontudas saindo da lava
    if (this.def.lava) {
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x2b1d1a, flatShading: true });
      for (let k = 0; k < 60; k++) {
        const a = rnd() * Math.PI * 2, r = 220 + rnd() * 300;
        const h = 10 + rnd() * 40;
        const m = new THREE.Mesh(new THREE.ConeGeometry(4 + rnd() * 10, h, 5), rockMat);
        m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
        this.group.add(m);
      }
    }
  }

  update(dt, camera) { for (const f of this.animated) f(dt, camera); }
}

function mergeGeos(geos) {
  const pos = [], uv = [], nor = [], idx = [];
  let off = 0;
  for (const g of geos) {
    const p = g.attributes.position, u = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
