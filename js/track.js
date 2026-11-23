import * as THREE from 'three';

// Meia-largura do asfalto, largura da zebra e distância do muro ao centro da pista (metros)
export const ROAD_HALF = 8;
export const CURB_W = 1.4;
export const WALL_OFF = ROAD_HALF + 7;

// Pontos de controle do circuito (x, z). A pista é uma spline fechada passando por eles.
const CONTROL = [
  [0, 0], [70, 0], [130, -15], [165, -70], [150, -130], [95, -155],
  [45, -120], [5, -135], [-50, -175], [-120, -160], [-160, -95],
  [-135, -35], [-80, -45], [-40, -5],
];

// Gerador pseudoaleatório com semente (cenário sempre igual)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export class Track {
  constructor(scene) {
    this.scene = scene;
    const pts = CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();
    const N = (this.N = Math.round(this.length)); // ~1 amostra por metro
    this.step = this.length / N;

    this.px = new Float32Array(N);
    this.pz = new Float32Array(N);
    this.tx = new Float32Array(N);
    this.tz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = this.curve.getPointAt(i / N);
      const t = this.curve.getTangentAt(i / N);
      t.y = 0; t.normalize();
      this.px[i] = p.x; this.pz[i] = p.z;
      this.tx[i] = t.x; this.tz[i] = t.z;
    }

    // Curvatura à frente de cada ponto (soma dos ângulos nos próximos 25 m) — usada pela IA
    this.curv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let a = 0;
      for (let k = 0; k < 25; k++) {
        const j = (i + k) % N, j2 = (j + 1) % N;
        const cross = this.tx[j] * this.tz[j2] - this.tz[j] * this.tx[j2];
        const dot = this.tx[j] * this.tx[j2] + this.tz[j] * this.tz[j2];
        a += Math.abs(Math.atan2(cross, dot));
      }
      this.curv[i] = a;
    }

    // Placas de turbo: procura trechos retos perto de algumas posições da pista
    this.pads = [];
    [[0.17, 0], [0.46, -3.5], [0.7, 3.5], [0.9, 0]].forEach(([f, lat]) => {
      let best = Math.round(f * N), bc = Infinity;
      for (let k = -40; k <= 40; k++) {
        const i = (Math.round(f * N) + k + N) % N;
        if (this.curv[i] < bc) { bc = this.curv[i]; best = i; }
      }
      this.pads.push({ idx: best, lat });
    });

    this.build();
  }

  wrap(i) { const N = this.N; return ((i % N) + N) % N; }

  heading(i) { i = this.wrap(i); return Math.atan2(this.tx[i], this.tz[i]); }

  // Ponto da pista no índice i, deslocado lateralmente por "lat" metros
  point(i, lat = 0, out = new THREE.Vector3()) {
    i = this.wrap(i);
    return out.set(this.px[i] - this.tz[i] * lat, 0, this.pz[i] + this.tx[i] * lat);
  }

  // Busca local do ponto mais próximo, a partir do índice anterior
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

  lateral(x, z, i) {
    return (x - this.px[i]) * -this.tz[i] + (z - this.pz[i]) * this.tx[i];
  }

  padAt(idx, lat) {
    const N = this.N;
    for (const p of this.pads) {
      const d = (idx - p.idx + N) % N;
      if ((d <= 4 || d >= N - 2) && Math.abs(lat - p.lat) < 2.4) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- Geometria

  flatRibbon(a, b, y, vLen) {
    const N = this.N, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const sx = -this.tz[k], sz = this.tx[k];
      pos.push(this.px[k] + sx * a, y, this.pz[k] + sz * a, this.px[k] + sx * b, y, this.pz[k] + sz * b);
      const v = (i * this.step) / vLen;
      uv.push(0, v, 1, v);
      if (i < N) { const j = i * 2; idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  wallRibbon(off, h, vLen) {
    const N = this.N, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const x = this.px[k] - this.tz[k] * off, z = this.pz[k] + this.tx[k] * off;
      pos.push(x, 0, z, x, h, z);
      const v = (i * this.step) / vLen;
      uv.push(v, 0, v, 1);
      if (i < N) { const j = i * 2; idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  build() {
    const scene = this.scene;
    const rnd = mulberry32(1234);

    // Texturas
    const asphalt = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#3b3d42'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) {
        const g = 40 + Math.random() * 40;
        c.fillStyle = `rgb(${g},${g},${g + 4})`;
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      c.fillStyle = '#f2f2f2';
      c.fillRect(6, 0, 6, h); c.fillRect(w - 12, 0, 6, h);
      c.fillStyle = '#e8e3c8';
      c.fillRect(w / 2 - 3, 0, 6, h / 2);
    });
    const curbTex = canvasTexture(16, 64, (c, w, h) => {
      c.fillStyle = '#e53935'; c.fillRect(0, 0, w, h / 2);
      c.fillStyle = '#fafafa'; c.fillRect(0, h / 2, w, h / 2);
    });
    const wallTex = canvasTexture(128, 32, (c, w, h) => {
      c.fillStyle = '#1565c0'; c.fillRect(0, 0, w / 2, h);
      c.fillStyle = '#fafafa'; c.fillRect(w / 2, 0, w / 2, h);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h - 5, w, 5);
    });
    const grassTex = canvasTexture(128, 128, (c, w, h) => {
      c.fillStyle = '#4f9a3c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        c.fillStyle = Math.random() < 0.5 ? '#468d35' : '#5aa846';
        c.fillRect(Math.random() * w, Math.random() * h, 2, 3);
      }
    });
    grassTex.repeat.set(120, 120);
    const checker = canvasTexture(64, 16, (c, w, h) => {
      const s = 8;
      for (let x = 0; x < w / s; x++) for (let y = 0; y < h / s; y++) {
        c.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        c.fillRect(x * s, y * s, s, s);
      }
    });
    checker.repeat.set(2, 1);
    this.padTex = canvasTexture(64, 128, (c, w, h) => {
      c.fillStyle = '#ff6f00'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffe082';
      for (let k = 0; k < 2; k++) {
        const y0 = k * 64 + 12;
        c.beginPath();
        c.moveTo(8, y0); c.lineTo(32, y0 + 26); c.lineTo(56, y0);
        c.lineTo(56, y0 + 16); c.lineTo(32, y0 + 42); c.lineTo(8, y0 + 16);
        c.closePath(); c.fill();
      }
    });

    // Chão
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);

    // Faixa de escape (terra) entre zebra e muro
    const runoff = new THREE.Mesh(
      this.flatRibbon(WALL_OFF + 0.5, -WALL_OFF - 0.5, 0.01, 10),
      new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
    );
    runoff.receiveShadow = true;
    scene.add(runoff);

    // Asfalto
    const road = new THREE.Mesh(
      this.flatRibbon(ROAD_HALF, -ROAD_HALF, 0.05, 16),
      new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92 })
    );
    road.receiveShadow = true;
    scene.add(road);

    // Zebras
    const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7 });
    for (const s of [1, -1]) {
      const curb = new THREE.Mesh(this.flatRibbon(s * (ROAD_HALF + CURB_W), s * ROAD_HALF, 0.06, 4), curbMat);
      curb.receiveShadow = true;
      scene.add(curb);
    }

    // Muros
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const wall = new THREE.Mesh(this.wallRibbon(s * WALL_OFF, 1.1, 8), wallMat);
      wall.castShadow = true; wall.receiveShadow = true;
      scene.add(wall);
    }

    // Linha de largada + pórtico
    const start = new THREE.Group();
    this.point(0, 0, start.position);
    start.rotation.y = this.heading(0);
    scene.add(start);

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, 2.5),
      new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.08;
    line.receiveShadow = true;
    start.add(line);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.5, roughness: 0.4 });
    for (const s of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postMat);
      post.position.set(s * (WALL_OFF + 0.9), 4, 0);
      post.castShadow = true;
      start.add(post);
    }
    const bannerTex = canvasTexture(512, 64, (c, w, h) => {
      c.fillStyle = '#c62828'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.font = 'italic 900 46px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('LARGADA  •  KART 3D  •  CHEGADA', w / 2, h / 2 + 2);
    });
    bannerTex.wrapS = bannerTex.wrapT = THREE.ClampToEdgeWrapping;
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry((WALL_OFF + 0.9) * 2 + 0.8, 1.8, 0.4),
      [postMat, postMat, postMat, postMat,
        new THREE.MeshStandardMaterial({ map: bannerTex }), new THREE.MeshStandardMaterial({ map: bannerTex })]
    );
    beam.position.y = 7.6;
    beam.castShadow = true;
    start.add(beam);

    // Arquibancada ao lado da largada
    const stand = new THREE.Group();
    stand.position.set(-(WALL_OFF + 9), 0, 8);
    start.add(stand);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.9 });
    const crowdTex = canvasTexture(256, 32, (c, w, h) => {
      c.fillStyle = '#546e7a'; c.fillRect(0, 0, w, h);
      const cols = ['#ef5350', '#42a5f5', '#ffee58', '#66bb6a', '#ffffff', '#ab47bc', '#ffa726'];
      for (let i = 0; i < 90; i++) {
        c.fillStyle = cols[(Math.random() * cols.length) | 0];
        c.beginPath(); c.arc(Math.random() * w, 8 + Math.random() * 18, 4, 0, Math.PI * 2); c.fill();
      }
    });
    crowdTex.repeat.set(4, 1);
    const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 1 });
    for (let k = 0; k < 4; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2 + k * 1.2, 50),
        [standMat, crowdMat, crowdMat, standMat, standMat, standMat]);
      step.position.set(k * -3, (1.2 + k * 1.2) / 2, 0);
      step.castShadow = step.receiveShadow = true;
      stand.add(step);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 52), new THREE.MeshStandardMaterial({ color: 0xc62828 }));
    roof.position.set(-4.5, 9, 0);
    roof.castShadow = true;
    stand.add(roof);

    // Placas de turbo
    this.padMat = new THREE.MeshBasicMaterial({ map: this.padTex, transparent: true, opacity: 0.95 });
    for (const p of this.pads) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), this.padMat);
      m.geometry.rotateX(-Math.PI / 2);
      this.point(p.idx, p.lat, m.position);
      m.position.y = 0.09;
      m.rotation.y = this.heading(p.idx);
      scene.add(m);
    }

    // Árvores (instanciadas) longe da pista
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
    const leafGeo = new THREE.ConeGeometry(2.6, 6.5, 7);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6d4c41 }), 320);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true }), 320);
    trunks.castShadow = leaves.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const color = new THREE.Color();
    let count = 0, tries = 0;
    const minD2 = (WALL_OFF + 5) ** 2;
    while (count < 320 && tries < 8000) {
      tries++;
      const x = (rnd() - 0.5) * 520, z = (rnd() - 0.5) * 420 - 80;
      let ok = true;
      for (let i = 0; i < this.N; i += 3) {
        const dx = x - this.px[i], dz = z - this.pz[i];
        if (dx * dx + dz * dz < minD2) { ok = false; break; }
      }
      // não colocar árvores em cima da arquibancada
      if (Math.abs(x) < 40 && z > 0 && z < 40) ok = false;
      if (!ok) continue;
      const sc = 0.7 + rnd() * 0.8;
      q.setFromAxisAngle(v.set(0, 1, 0), rnd() * Math.PI);
      s.set(sc, sc, sc);
      m4.compose(v.set(x, 1.5 * sc, z), q, s);
      trunks.setMatrixAt(count, m4);
      m4.compose(v.set(x, (3 + 3.2) * sc, z), q, s);
      leaves.setMatrixAt(count, m4);
      leaves.setColorAt(count, color.setHSL(0.28 + rnd() * 0.08, 0.55, 0.25 + rnd() * 0.12));
      count++;
    }
    trunks.count = leaves.count = count;
    scene.add(trunks, leaves);

    // Montanhas no horizonte
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x5d7a6a, flatShading: true, roughness: 1 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
      const r = 520 + rnd() * 120;
      const h = 70 + rnd() * 110, rad = 60 + rnd() * 60;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), mountMat);
      m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r - 80);
      m.rotation.y = rnd() * Math.PI;
      scene.add(m);
      if (h > 130) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.25, h * 0.25, 6), snowMat);
        cap.position.set(m.position.x, h - 2 - h * 0.125, m.position.z);
        cap.rotation.y = m.rotation.y;
        scene.add(cap);
      }
    }
  }

  update(dt) {
    this.padTex.offset.y = (this.padTex.offset.y + dt * 1.5) % 1;
  }
}
