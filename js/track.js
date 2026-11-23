import * as THREE from 'three';
import { TRACKS, THEMES, ROAD_HALF, SHOULDER, EDGE } from './data.js';
import { buildTerrain, buildScenery } from './scenery.js';

export { ROAD_HALF, SHOULDER, EDGE };

const GROUND_Y = -0.15;

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
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
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
    this.bridge = new Uint8Array(N);
    const q = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < N; i++) {
      const mx = mirror ? -1 : 1;
      const p = { x: this.px[i] * mx, y: this.py[i], z: this.pz[i], f: i / N };
      if (this.def.bridge && this.def.bridge(p)) this.bridge[i] = 1;
      [1, -1].forEach((s, k) => {
        q.x = this.px[i] - this.tz[i] * s * (EDGE + 4);
        q.z = this.pz[i] + this.tx[i] * s * (EDGE + 4);
        q.y = p.y;
        q.x *= mx;
        const outer = Math.hypot(q.x * mx - cx, q.z - cz) > Math.hypot(this.px[i] - cx, p.z - cz);
        const type = this.bridge[i] ? 'wall' : this.def.edge(p, q, outer);
        this.edgeFall[i * 2 + k] = type === 'fall' ? 1 : 0;
      });
    }

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
  ribbon(fa, fb, vLen, skip) {
    const N = this.N, pos = [], uv = [], idx = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      fa(k, a); fb(k, b);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const v = (i * this.step) / vLen;
      uv.push(0, v, 1, v);
      if (i < N && !(skip && skip(k))) { const j = i * 2; idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); this.group.add(m); return m; }

  build() {
    const th = this.theme, N = this.N;
    const rnd = mulberry32(this.id.length * 977 + N);
    const lam = (opts) => new THREE.MeshLambertMaterial(opts);

    // ---------- texturas
    const asphalt = retroTex(32, 64, (c, w, h) => {
      noiseFill(c, w, h, this.def.theme === 'vulcao' ? '#4a4247' : '#5d5d66', 'rgba(0,0,0,.22)', 0.6);
      for (let y = 0; y < h; y += 16) {
        c.fillStyle = '#e53935'; c.fillRect(0, y, 2, 8); c.fillRect(w - 2, y, 2, 8);
        c.fillStyle = '#ffffff'; c.fillRect(0, y + 8, 2, 8); c.fillRect(w - 2, y + 8, 2, 8);
      }
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(w / 2 - 1, 0, 1, h / 2);
    });
    const shoulderTex = retroTex(32, 32, (c, w, h) => noiseFill(c, w, h, th.shoulder, th.shoulder2, 0.35));
    const groundTex = retroTex(32, 32, (c, w, h) => noiseFill(c, w, h, th.ground, th.ground2, 0.35));
    groundTex.repeat.set(160, 160);
    const skirtTex = retroTex(32, 32, (c, w, h) => {
      noiseFill(c, w, h, th.skirt, 'rgba(0,0,0,.2)', 0.4);
      c.fillStyle = 'rgba(255,255,255,.08)';
      for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 2);
    });
    const wallTex = retroTex(32, 16, (c, w, h) => {
      c.fillStyle = th.wall[0]; c.fillRect(0, 0, w / 2, h);
      c.fillStyle = th.wall[1]; c.fillRect(w / 2, 0, w / 2, h);
    });

    // ---------- chão, água e lava
    // relevo com morros (o chão plano fica só embaixo, como reserva)
    this.groundBase = GROUND_Y;
    buildTerrain(this, GROUND_Y);
    const ground = this.mesh(new THREE.PlaneGeometry(4000, 4000), lam({ map: groundTex, polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y - (this.def.lava ? 2 : 0.4);

    if (this.def.water) {
      const wt = retroTex(32, 32, (c, w, h) => {
        noiseFill(c, w, h, '#2f9fe0', '#7fd0ff', 0.12);
      });
      wt.repeat.set(30, 30);
      this.animated.push((dt) => { wt.offset.x += dt * 0.02; wt.offset.y += dt * 0.012; });
      const wm = lam({ map: wt, transparent: true, opacity: 0.92 });
      for (const [x, z, w, d] of this.water) {
        const m = this.mesh(new THREE.PlaneGeometry(w, d), wm);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x + w / 2, 0.12, z + d / 2);
      }
      this.hazardY = 0.12;
    }
    if (this.def.lava) {
      const lt = retroTex(32, 32, (c, w, h) => {
        noiseFill(c, w, h, '#ff5a00', '#ffd23a', 0.25);
        c.fillStyle = 'rgba(120,0,0,.5)';
        for (let i = 0; i < 6; i++) c.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 6, 3);
      });
      lt.repeat.set(60, 60);
      this.animated.push((dt) => { lt.offset.x += dt * 0.03; lt.offset.y -= dt * 0.02; });
      const lava = this.mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ map: lt, fog: true }));
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = -0.6;
      this.hazardY = -0.6;
    }
    if (this.hazardY === undefined) this.hazardY = GROUND_Y;

    // ---------- pista
    const P = (lat, dy = 0) => (k, out) => this.point(k, lat, out).setY(this.py[k] + dy);
    this.mesh(this.ribbon(P(ROAD_HALF, 0.06), P(-ROAD_HALF, 0.06), 16), lam({ map: asphalt }));
    const shoulderMat = lam({ map: shoulderTex });
    this.mesh(this.ribbon(P(EDGE, 0.03), P(ROAD_HALF, 0.03), 6), shoulderMat);
    this.mesh(this.ribbon(P(-ROAD_HALF, 0.03), P(-EDGE, 0.03), 6), shoulderMat);

    // Encostas (barrancos) da pista até o chão, exceto nas pontes
    const base = this.def.lava ? -0.8 : GROUND_Y;
    const skirtMat = lam({ map: skirtTex, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const top = (k, out) => this.point(k, s * EDGE, out);
      const bot = (k, out) => this.point(k, s * (EDGE + Math.max(0, this.py[k] - base) * 0.7 + 0.3), out).setY(base);
      this.mesh(this.ribbon(top, bot, 8, (k) => this.bridge[k] || this.bridge[(k + 1) % N]), skirtMat);
    }

    // Muros baixos onde a borda não é uma queda
    const wallMat = lam({ map: wallTex, side: THREE.DoubleSide });
    for (const [s, kk] of [[1, 0], [-1, 1]]) {
      const lo = (k, out) => this.point(k, s * EDGE, out);
      const hi = (k, out) => this.point(k, s * EDGE, out).setY(this.py[k] + 1.0);
      this.mesh(this.ribbon(lo, hi, 4, (k) => this.edgeFall[k * 2 + kk] || this.edgeFall[((k + 1) % N) * 2 + kk]), wallMat);
    }

    // Pontes: parte de baixo do tabuleiro e pilares
    if (this.bridge.some((b) => b)) {
      const under = lam({ color: 0x6d4c41, side: THREE.DoubleSide });
      const bl = (k, out) => this.point(k, EDGE, out).setY(this.py[k] - 0.8);
      const br = (k, out) => this.point(k, -EDGE, out).setY(this.py[k] - 0.8);
      this.mesh(this.ribbon(bl, br, 8, (k) => !this.bridge[k]), under);
      for (const s of [1, -1]) {
        const a = (k, out) => this.point(k, s * EDGE, out);
        const b = (k, out) => this.point(k, s * EDGE, out).setY(this.py[k] - 0.8);
        this.mesh(this.ribbon(a, b, 8, (k) => !this.bridge[k]), under);
      }
      const pillarMat = lam({ color: 0x8d8d8d });
      const v = new THREE.Vector3();
      for (let i = 0; i < N; i += 10) {
        if (!this.bridge[i]) continue;
        for (const s of [1, -1]) {
          this.point(i, s * (EDGE - 1), v);
          // não colocar pilar em cima de outro trecho da pista
          let clash = false;
          for (let j = 0; j < N; j += 2) {
            if (Math.abs(this.py[j] - this.py[i]) < 4) continue;
            if (Math.hypot(v.x - this.px[j], v.z - this.pz[j]) < EDGE + 3) { clash = true; break; }
          }
          if (clash) continue;
          const h = this.py[i] - base;
          const p = this.mesh(new THREE.BoxGeometry(1.4, h, 1.4), pillarMat);
          p.position.set(v.x, base + h / 2 - 0.8, v.z);
        }
      }
    }

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
    const postMat = lam({ color: 0x455a64 });
    for (const s of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8), postMat);
      post.position.set(s * (EDGE + 0.8), 3.5, 0);
      start.add(post);
    }
    const banner = retroTex(128, 16, (c, w, h) => {
      c.fillStyle = '#d32f2f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.def.name.toUpperCase(), w / 2, h / 2 + 1);
    }, { repeat: false });
    const bmat = lam({ map: banner });
    const beam = new THREE.Mesh(new THREE.BoxGeometry((EDGE + 0.8) * 2 + 0.8, 1.6, 0.4), [postMat, postMat, postMat, postMat, bmat, bmat]);
    beam.position.y = 6.6;
    start.add(beam);

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
        c.fillStyle = 'rgba(255,255,255,.85)';
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
          : this.def.theme === 'praia' ? [['#6aa7c9', 0.72]] : [['#5f8f6a', 0.5], ['#3f7a4a', 0.68]];
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
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(6, 12);
    geo.translate(0, 6, 0);
    const geo2 = geo.clone().rotateY(Math.PI / 2);
    const merged = mergeGeos([geo, geo2]);
    const count = 220;
    const inst = new THREE.InstancedMesh(merged, mat, count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let n = 0, tries = 0;
    while (n < count && tries < 9000) {
      tries++;
      const i = (rnd() * this.N) | 0;
      const side = rnd() < 0.5 ? 1 : -1;
      const dist = EDGE + Math.max(0, this.py[i]) * 0.7 + 6 + rnd() * 60;
      this.point(i, side * dist, v);
      // longe de qualquer trecho da pista, e fora de água/lava
      let ok = true;
      for (let j = 0; j < this.N; j += 3) {
        if (Math.hypot(v.x - this.px[j], v.z - this.pz[j]) < EDGE + Math.max(0, this.py[j]) * 0.7 + 5) { ok = false; break; }
      }
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
