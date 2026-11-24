import * as THREE from 'three';
import { terrainDetail } from './textures.js';
import { oficina } from './oficina.js';
import { pantano } from './pantano.js';
import { sucata } from './sucata.js';
import { ilhas } from './ilhas.js';
import { EDGE, ROAD_HALF } from './data.js';
import { drawSprite } from './sprites.js';

// =====================================================================
//  Cenário: relevo, marcos temáticos, placas, arquibancadas, túneis
//  e coisas vivas — o que dá personalidade a cada pista
// =====================================================================

// Retratos dos pilotos para os outdoors (preenchido pelo main.js)
export const ART = { portraits: {} };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (k) => k * k * (3 - 2 * k);

function hash(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x / 170, z / 170) * 0.6 + vnoise(x / 60 + 7, z / 60) * 0.3 + vnoise(x / 22, z / 22 + 3) * 0.1;

function tex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const lam = (o) => new THREE.MeshLambertMaterial(o);
const basic = (o) => new THREE.MeshBasicMaterial(o);

// ---------------------------------------------------------------- distância até a pista
function makeDist(tr) {
  const xs = [], zs = [], ys = [];
  for (let i = 0; i < tr.N; i += 2) { xs.push(tr.px[i]); zs.push(tr.pz[i]); ys.push(tr.py[i]); }
  return (x, z) => {
    let bd = Infinity, bi = 0;
    for (let k = 0; k < xs.length; k++) {
      const dx = x - xs[k], dz = z - zs[k];
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; bi = k; }
    }
    return { d: Math.sqrt(bd), y: ys[bi], i: bi * 2 };
  };
}

// ================================================================= relevo
const RELIEF = {
  campos: { amp: 34, colors: (h, n) => (h > 0.62 ? mix(0x6f9a4a, 0x8a7a55, (h - 0.62) * 2.6) : mix(0x5fae3f, 0x3f8a2e, h * 1.3 + n * 0.3)) },
  praia:  { amp: 24, colors: (h, n) => (h < 0.12 ? mix(0xf2d99a, 0xe6c983, n) : mix(0x8fc25c, 0x5f9a3e, h + n * 0.2)) },
  // pântano: ilhotas de lama e musgo saindo da água; perto do calçadão é só água; morros escuros ao longe
  pantano: {
    amp: 30,
    height: (x, z, d, groundY) => {
      const far = smooth(clamp((d - 90) / 140, 0, 1));
      const isl = -1.3 + 2.6 * fbm(x * 2.2 + 31, z * 2.2 - 17);
      const near = d < EDGE + 5 ? -1.2 : isl;
      return Math.max(near, groundY + far * 30 * (0.3 + 0.7 * fbm(x, z)) - (1 - far) * 2);
    },
    colors: (h, n) => (h < 0.01 ? mix(0x2a2a1c, 0x34321e, n) : h < 0.06 ? mix(0x6a8a34, 0x587a2e, n) : mix(0x2f4a36, 0x24382c, h + n * 0.3)),
  },
  sucata: { amp: 34, colors: (h, n) => (h > 0.55 ? mix(0xc87a4a, 0xa85a3a, n) : mix(0xe8c07a, 0xd8a862, h * 1.4 + n * 0.4)) },
  oficina: { amp: 40, colors: (h, n) => (h < 0.06 ? mix(0xa89878, 0x8f8a62, n) : mix(0x8fbf5a, 0x5f9440, h + n * 0.3)) },
  serra:  { amp: 115, colors: (h, n) => (n > 0.62 && h > 0.15 ? mix(0x8d97a3, 0x6b7480, n) : mix(0xf2f6fb, 0xd9e4ef, h * 0.6 + n * 0.3)) },
};
function mix(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), clamp(t, 0, 1)); }

export function buildTerrain(tr, groundY) {
  const R = RELIEF[tr.def.theme];
  const dist = makeDist(tr);
  tr.dist = dist;
  let cx = 0, cz = 0;
  for (let i = 0; i < tr.N; i++) { cx += tr.px[i]; cz += tr.pz[i]; }
  cx /= tr.N; cz /= tr.N;
  tr.center = new THREE.Vector3(cx, 0, cz);

  const water = tr.water || [];
  const height = (x, z) => {
    if (!R) return groundY;
    const { d, y } = dist(x, z);
    if (R.height) return R.height(x, z, d, groundY);
    const clear = EDGE + 16 + Math.max(0, y) * 0.7;
    let k = smooth(clamp((d - clear) / 85, 0, 1));
    if (tr.def.theme === 'praia') k *= clamp((70 - z) / 110, 0, 1); // morros só longe do mar
    for (const [wx, wz, ww, wd] of water) if (x > wx - 6 && x < wx + ww + 6 && z > wz - 6 && z < wz + wd + 6) return Math.min(groundY - 0.6, (tr.def.waterY ?? 0) - 1.2);
    return groundY + R.amp * k * (0.3 + 0.7 * fbm(x, z));
  };
  tr.terrainY = height;
  if (!R) return;

  const SIZE = 2000, SEG = 150;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    const h = height(x, z);
    pos.setXYZ(i, x, h, z);
    const c = R.colors((h - groundY) / R.amp, fbm(x * 3.1, z * 3.1));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const detail = terrainDetail(tr.def.theme);
  detail.repeat.set(500, 500);
  const m = new THREE.Mesh(g, lam({ map: detail, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 }));
  tr.group.add(m);
}

// ================================================================= ajudantes de posicionamento
function spot(tr, idx, lat, minClear) {
  const v = tr.point(idx, lat);
  const { d } = tr.dist(v.x, v.z);
  if (d < minClear) return null;
  v.y = tr.terrainY(v.x, v.z);
  return v;
}

function facing(tr, i, side) {
  // placa voltada para quem vem pela pista, inclinada para o centro
  const fx = -tr.tx[i] - side * -tr.tz[i] * 0.8, fz = -tr.tz[i] - side * tr.tx[i] * 0.8;
  return Math.atan2(fx, fz);
}

// ================================================================= outdoors
const ADS = [
  { bg: '#d32f2f', fg: '#fff', title: 'PIMENTA', sub: 'TURBO!', icon: 'pimenta' },
  { bg: '#1565c0', fg: '#fff', title: 'PNEUS', sub: 'TICO', who: 'tico' },
  { bg: '#2e7d32', fg: '#fff59d', title: 'SUCO', sub: 'BOLOTA', icon: 'coco' },
  { bg: '#ff8f00', fg: '#fff', title: 'MEL', sub: 'KART CLUB', who: 'mel' },
  { bg: '#4a148c', fg: '#fff', title: 'RINO', sub: 'MOTORES', who: 'rino' },
  { bg: '#006064', fg: '#fff', title: 'JUCA', sub: 'NÁUTICA', who: 'juca' },
  { bg: '#fafafa', fg: '#c62828', title: 'KART 3D', sub: 'GRAND PRIX', icon: 'aura' },
  { bg: '#e65100', fg: '#fff', title: 'FAÍSCA', sub: 'ÓCULOS', who: 'faisca' },
  { bg: '#ad1457', fg: '#fff', title: 'PIPOCA', sub: 'DOCES', who: 'pipoca' },
  { bg: '#5d4037', fg: '#ffe082', title: 'TONHO', sub: 'MEL PURO', who: 'tonho' },
  { bg: '#0277bd', fg: '#fff', title: 'BENTO', sub: 'RAÇÃO', who: 'bento' },
];

function adTexture(ad) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = ad.bg; g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 56, 128, 8);
  g.strokeStyle = ad.fg; g.lineWidth = 3; g.strokeRect(3, 3, 122, 58);
  g.fillStyle = ad.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 19px sans-serif'; g.fillText(ad.title, 84, 24);
  g.font = 'bold 13px sans-serif'; g.fillText(ad.sub, 84, 44);
  if (ad.icon) g.drawImage(drawSprite(ad.icon, 40), 8, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (ad.who && ART.portraits[ad.who]) {
    const img = new Image();
    img.onload = () => { g.drawImage(img, 2, 6, 54, 54); t.needsUpdate = true; };
    img.src = ART.portraits[ad.who];
  }
  return t;
}

function billboard(tr, pos, rotY, ad, scale = 1) {
  const g = new THREE.Group();
  g.position.copy(pos); g.rotation.y = rotY; g.scale.setScalar(scale);
  const t = adTexture(ad);
  const board = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 0.3),
    [lam({ color: 0x555555 }), lam({ color: 0x555555 }), lam({ color: 0x555555 }), lam({ color: 0x555555 }), lam({ map: t }), lam({ color: 0x777777 })]);
  board.position.y = 5;
  g.add(board);
  for (const s of [-3, 3]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), lam({ color: 0x8d8d8d }));
    post.position.set(s, 1.6, 0);
    g.add(post);
  }
  tr.group.add(g);
  return g;
}

function placeBillboards(tr, rnd) {
  let n = 0, last = -999;
  for (let i = 10; i < tr.N - 10; i += 3) {
    if (i - last < 55 || tr.curv[i] > 0.35 || tr.bridge[i]) continue;
    const side = n % 2 ? 1 : -1;
    if (tr.isFall(i, side)) continue;
    if (tr.inTunnel?.(i)) continue;
    const p = spot(tr, i, side * (EDGE + 7), EDGE + 5);
    if (!p) continue;
    p.y = Math.max(p.y, tr.py[i] - 0.5);
    billboard(tr, p, facing(tr, i, side), ADS[(n + Math.floor(rnd() * 3)) % ADS.length]);
    last = i; n++;
  }
}

// ================================================================= placas de curva (setas)
function placeChevrons(tr) {
  const arrowTex = (dir) => tex(64, 32, (c, w, h) => {
    c.fillStyle = '#d32f2f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    for (let k = 0; k < 3; k++) {
      const x = 8 + k * 18;
      c.beginPath();
      if (dir > 0) { c.moveTo(x + 12, 4); c.lineTo(x, 16); c.lineTo(x + 12, 28); c.lineTo(x + 18, 28); c.lineTo(x + 6, 16); c.lineTo(x + 18, 4); }
      else { c.moveTo(x, 4); c.lineTo(x + 12, 16); c.lineTo(x, 28); c.lineTo(x + 6, 28); c.lineTo(x + 18, 16); c.lineTo(x + 6, 4); }
      c.fill();
    }
  });
  const left = lam({ map: arrowTex(1) }), right = lam({ map: arrowTex(-1) }), back = lam({ color: 0x444444 });
  const geo = new THREE.BoxGeometry(3.4, 1.6, 0.15);
  for (let i = 0; i < tr.N; i += 7) {
    if (tr.curv[i] < 0.7 || tr.bridge[i] || tr.inTunnel?.(i)) continue;
    const j = (i + 14) % tr.N;
    const c = tr.tx[i] * tr.tz[j] - tr.tz[i] * tr.tx[j];
    const leftTurn = c < 0;
    const side = leftTurn ? 1 : -1;        // placa no lado de fora da curva
    if (tr.isFall(i, side)) continue;
    const p = tr.point(i, side * (EDGE + 1.4));
    if (tr.dist(p.x, p.z).d < EDGE) continue;
    const m = new THREE.Mesh(geo, [back, back, back, back, leftTurn ? left : right, back]);
    m.position.set(p.x, tr.py[i] + 1.9, p.z);
    m.rotation.y = tr.heading(i) + Math.PI;
    tr.group.add(m);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), back);
    post.position.set(p.x, tr.py[i] + 0.6, p.z);
    tr.group.add(post);
  }
}

// ================================================================= bandeirolas
function bunting(tr, a, b, sag = 1.2, count = 18) {
  const pos = [], col = [];
  const palette = [0xe53935, 0xffeb3b, 0x1e88e5, 0x43a047, 0xffffff, 0xff9800].map((c) => new THREE.Color(c));
  for (let k = 0; k < count; k++) {
    const t0 = k / count, t1 = (k + 0.7) / count, tm = (k + 0.35) / count;
    const P = (t) => new THREE.Vector3().lerpVectors(a, b, t).setY(THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag);
    const p0 = P(t0), p1 = P(t1), pm = P(tm).setY(P(tm).y - 0.9);
    pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, pm.x, pm.y, pm.z);
    const c = palette[k % palette.length];
    for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  tr.group.add(new THREE.Mesh(g, basic({ vertexColors: true, side: THREE.DoubleSide })));
  const line = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 13 }, (_, k) => {
    const t = k / 12; return new THREE.Vector3().lerpVectors(a, b, t).setY(THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag);
  }));
  tr.group.add(new THREE.Line(line, new THREE.LineBasicMaterial({ color: 0x333333 })));
}

// ================================================================= arquibancada com torcida
function grandstand(tr, idx, side, len = 50) {
  const crowdTex = tex(128, 32, (c, w, h) => {
    c.fillStyle = '#455a64'; c.fillRect(0, 0, w, h);
    const cols = ['#ef5350', '#42a5f5', '#ffee58', '#66bb6a', '#ffffff', '#ab47bc', '#ffa726', '#8d6e63'];
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w, y = 8 + Math.random() * 18;
      c.fillStyle = cols[(Math.random() * cols.length) | 0]; c.fillRect(x - 2, y, 5, 8);
      c.fillStyle = '#ffd7b0'; c.beginPath(); c.arc(x + 0.5, y - 2, 2.5, 0, Math.PI * 2); c.fill();
    }
  }, true);
  crowdTex.repeat.set(len / 12, 1);
  const g = new THREE.Group();
  tr.point(idx, side * (EDGE + 6), g.position);
  g.position.y = tr.py[idx];
  g.rotation.y = tr.heading(idx);
  tr.group.add(g);
  const stand = lam({ color: 0x90a4ae }), crowd = lam({ map: crowdTex });
  // eixo x local aponta para o lado "-" da pista: afastar da pista = -side
  const out = -side;
  const faceIdx = side > 0 ? 0 : 1;               // face voltada para a pista
  for (let k = 0; k < 5; k++) {
    const hgt = 1.3 + k * 1.3;
    const mats = [stand, stand, crowd, stand, stand, stand];
    mats[faceIdx] = crowd;
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, hgt, len), mats);
    step.position.set(out * (k * 2.6 + 1.3), hgt / 2, 0);
    g.add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, len + 2), lam({ color: 0xc62828 }));
  roof.position.set(out * 7, 10, 0);
  roof.rotation.z = -out * 0.12;
  g.add(roof);
  for (const z of [-len / 2, len / 2]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 0.5), stand);
    col.position.set(out * 13.5, 5, z);
    g.add(col);
  }
  // torcida "pulando"
  let t = 0;
  tr.animated.push((dt) => { t += dt; crowdTex.offset.y = Math.floor(t * 6) % 2 ? 0.04 : 0; });
  return g;
}

// ================================================================= túnel atravessando um morro
function buildTunnel(tr, f0, f1, style) {
  const N = tr.N;
  const i0 = Math.round(f0 * N), i1 = Math.round(f1 * N);
  const idxs = [];
  for (let i = i0; i !== (i1 + 1) % N; i = (i + 1) % N) idxs.push(i);
  const RW = EDGE + 0.6, RH = 8.5, W = EDGE + 34, TOP = 16;
  const ice = style === 'gelo';
  const innerTex = tex(32, 32, (c, w, h) => {
    c.fillStyle = ice ? '#9fd3ef' : '#8a7868'; c.fillRect(0, 0, w, h);
    c.fillStyle = ice ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.3)';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) c.fillRect(x, y, 15, 7);
  }, true);
  innerTex.repeat.set(4, 6);
  const outerColor = ice ? 0xeef4fa : 0x5aa63a;

  const grid = (prof, segs) => {
    const pos = [], uv = [], ix = [];
    idxs.forEach((i, r) => {
      for (let k = 0; k <= segs; k++) {
        const [lat, y] = prof(k / segs, i);
        const p = tr.point(i, lat);
        pos.push(p.x, y, p.z);
        uv.push(k / segs, r / 8);
        if (r > 0 && k < segs) {
          const a = (r - 1) * (segs + 1) + k, b = a + segs + 1;
          ix.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    return g;
  };
  const archProf = (t, i) => { const a = t * Math.PI; return [Math.cos(a) * RW, tr.py[i] + Math.sin(a) * RH]; };
  const ridgeProf = (t, i) => {
    const lat = (t * 2 - 1) * W;
    const e = Math.abs(lat) / W;
    const y = tr.py[i] + TOP * Math.pow(Math.cos(e * Math.PI / 2), 0.7);
    return [lat, e > 0.98 ? Math.min(y, tr.groundBase) : y];
  };
  tr.group.add(new THREE.Mesh(grid(archProf, 14), basic({ map: innerTex, side: THREE.DoubleSide, color: ice ? 0xe8f6ff : 0xb8aca0 })));
  tr.group.add(new THREE.Mesh(grid(ridgeProf, 20), lam({ color: outerColor, side: THREE.DoubleSide })));

  // fachadas das entradas (morro com o buraco do túnel)
  const faceMat = lam({ color: ice ? 0xcfe3f2 : 0x8a7a65, side: THREE.DoubleSide });
  for (const i of [idxs[0], idxs[idxs.length - 1]]) {
    const shape = new THREE.Shape();
    const bottom = Math.min(tr.groundBase - tr.py[i], -0.4);
    shape.moveTo(-W, bottom);
    for (let k = 0; k <= 20; k++) { const [lat, y] = ridgeProf(k / 20, i); shape.lineTo(lat, y - tr.py[i]); }
    shape.lineTo(W, bottom);
    const hole = new THREE.Path();
    hole.moveTo(RW, 0.05);
    for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI; hole.lineTo(Math.cos(a) * RW, Math.sin(a) * RH); }
    hole.lineTo(-RW, 0.05);
    shape.holes.push(hole);
    const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), faceMat);
    tr.point(i, 0, face.position);
    face.rotation.y = tr.heading(i);
    tr.group.add(face);
    // moldura de pedra / gelo em volta da entrada
    const frame = new THREE.Mesh(new THREE.TorusGeometry(RW + 0.4, 0.7, 6, 20, Math.PI), lam({ color: ice ? 0xffffff : 0x9e9e9e }));
    frame.scale.set(1, RH / RW, 1);
    frame.position.copy(face.position);
    frame.rotation.y = face.rotation.y;
    tr.group.add(frame);
  }
  // luminárias no teto
  const lamp = basic({ color: ice ? 0xb3e5fc : 0xffe082 });
  for (let k = 4; k < idxs.length - 4; k += 9) {
    const i = idxs[k];
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 2.2), lamp);
    m.position.set(tr.px[i], tr.py[i] + RH - 0.4, tr.pz[i]);
    m.rotation.y = tr.heading(i);
    tr.group.add(m);
  }
  const set = new Set(idxs);
  const prev = tr.inTunnel;
  tr.inTunnel = (i) => set.has(i) || (prev ? prev(i) : false);
}

// ================================================================= sprites 2D (bichos, fogo...)
function spriteTex(draw, w = 32, h = 32) { const t = tex(w, h, draw); return t; }
function sprite(map, scale, pos) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: 0.4 }));
  s.scale.set(scale[0], scale[1], 1);
  s.center.set(0.5, 0);
  s.position.copy(pos);
  return s;
}

const SPR = {
  vaca: () => spriteTex((c) => {
    c.fillStyle = '#fff'; c.fillRect(6, 12, 20, 11); c.fillStyle = '#222'; c.fillRect(9, 13, 6, 5); c.fillRect(18, 17, 5, 4);
    c.fillStyle = '#fff'; c.fillRect(22, 8, 8, 8); c.fillStyle = '#ffb3b3'; c.fillRect(26, 13, 4, 3);
    c.fillStyle = '#222'; c.fillRect(24, 10, 2, 2); c.fillRect(7, 23, 3, 6); c.fillRect(22, 23, 3, 6); c.fillRect(11, 23, 3, 6); c.fillRect(18, 23, 3, 6);
  }),
  girassol: () => spriteTex((c) => {
    c.fillStyle = '#2e7d32'; c.fillRect(15, 14, 2, 18); c.fillRect(10, 22, 5, 3);
    c.fillStyle = '#fdd835'; for (let a = 0; a < 10; a++) { c.beginPath(); c.ellipse(16 + Math.cos(a) * 6, 10 + Math.sin(a) * 6, 3, 2, a, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#6d4c41'; c.beginPath(); c.arc(16, 10, 4, 0, Math.PI * 2); c.fill();
  }),
  caranguejo: () => spriteTex((c) => {
    c.fillStyle = '#e53935'; c.beginPath(); c.ellipse(16, 22, 9, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(3, 14, 5, 5); c.fillRect(24, 14, 5, 5);
    c.fillStyle = '#fff'; c.fillRect(12, 13, 3, 4); c.fillRect(18, 13, 3, 4); c.fillStyle = '#000'; c.fillRect(13, 14, 1, 2); c.fillRect(19, 14, 1, 2);
    c.strokeStyle = '#c62828'; c.lineWidth = 1.5; for (const x of [9, 12, 20, 23]) { c.beginPath(); c.moveTo(x, 26); c.lineTo(x + (x < 16 ? -3 : 3), 31); c.stroke(); }
  }),
  gaivota: () => spriteTex((c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, 12); c.quadraticCurveTo(9, 4, 16, 14); c.quadraticCurveTo(23, 4, 30, 12); c.stroke();
    c.fillStyle = '#ffb300'; c.fillRect(15, 14, 3, 2);
  }),
  fogo: () => spriteTex((c) => {
    const g = c.createRadialGradient(16, 22, 2, 16, 20, 14);
    g.addColorStop(0, '#fff59d'); g.addColorStop(0.4, '#ffb300'); g.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(16, 0); c.quadraticCurveTo(30, 20, 16, 32); c.quadraticCurveTo(2, 20, 16, 0); c.fill();
  }),
  fumaca: () => spriteTex((c) => {
    const g = c.createRadialGradient(16, 16, 2, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  }),
  bonecoNeve: null,
};

// ================================================================= CAMPOS BOLOTA
function campos(tr, rnd) {
  const c = tr.center;
  // balão de ar quente com o emblema da bolota
  const env = tex(64, 32, (g, w, h) => {
    const cols = ['#e53935', '#ffeb3b', '#1e88e5', '#ffffff', '#43a047', '#ff9800'];
    for (let k = 0; k < 12; k++) { g.fillStyle = cols[k % cols.length]; g.fillRect((k * w) / 12, 0, w / 12 + 1, h); }
    g.fillStyle = '#6d4c41'; g.beginPath(); g.arc(16, 17, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a1887f'; g.fillRect(10, 9, 12, 5);
  });
  const balloon = new THREE.Group();
  const pts = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 9 * (t < 0.5 ? 1 : 0.85 + 0.15 * Math.cos((t - 0.5) * 2)) + (t > 0.85 ? -1 : 0), t * 20)); }
  pts.reverse();
  const envelope = new THREE.Mesh(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(Math.max(0.6, p.x), 20 - p.y)), 24), new THREE.MeshPhongMaterial({ map: env, shininess: 30 }));
  balloon.add(envelope);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 2.6), lam({ color: 0x8d6e63 }));
  basket.position.y = -4;
  balloon.add(basket);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5), lam({ color: 0x444444 }));
    r.position.set(x * 1.6, -1, z * 1.6); r.rotation.z = -x * 0.25; r.rotation.x = z * 0.25;
    balloon.add(r);
  }
  tr.group.add(balloon);
  let bt = 0;
  tr.animated.push((dt) => {
    bt += dt;
    balloon.position.set(c.x + Math.cos(bt * 0.05) * 60, 48 + Math.sin(bt * 0.6) * 2, c.z + Math.sin(bt * 0.05) * 40);
    balloon.rotation.y = bt * 0.1;
  });

  // moinho de vento
  const mill = findPlace(tr, rnd, 40, 90);
  if (mill) {
    const g = new THREE.Group(); g.position.copy(mill); tr.group.add(g);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, 16, 8), lam({ color: 0xf5f5f5 }));
    tower.position.y = 8; g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4, 8), lam({ color: 0xc62828 }));
    cap.position.y = 18; g.add(cap);
    const hub = new THREE.Group(); hub.position.set(0, 15, 3.2); g.add(hub);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 0.2), lam({ color: 0x8d6e63 }));
      blade.position.y = 4.5; const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; arm.add(blade); hub.add(arm);
    }
    g.lookAt(c.x, mill.y, c.z);
    tr.animated.push((dt) => { hub.rotation.z += dt * 0.8; });
  }

  // celeiro com cerca e vaquinhas
  const barn = findPlace(tr, rnd, 45, 100);
  if (barn) {
    const g = new THREE.Group(); g.position.copy(barn); g.rotation.y = rnd() * 6; tr.group.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 10), lam({ color: 0xc62828 }));
    body.position.y = 4; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8.4, 5, 4, 1), lam({ color: 0x5d4037 }));
    roof.scale.set(1.25, 1, 0.9); roof.position.y = 10.5; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), lam({ color: 0xffffff }));
    door.position.set(0, 3, 5.01); g.add(door);
    const doorIn = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), lam({ color: 0x8e2020 }));
    doorIn.position.set(0, 2.6, 5.02); g.add(doorIn);
    // cerca
    const postGeo = new THREE.BoxGeometry(0.3, 1.4, 0.3), railGeo = new THREE.BoxGeometry(0.15, 0.15, 4);
    const wood = lam({ color: 0xd7ccc8 });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const x = Math.cos(a) * 20, z = Math.sin(a) * 20 + 4;
      const p = new THREE.Mesh(postGeo, wood); p.position.set(x, 0.7, z); g.add(p);
      const r = new THREE.Mesh(railGeo, wood); r.position.set(Math.cos(a + 0.22) * 20, 1, Math.sin(a + 0.22) * 20 + 4); r.rotation.y = -a; g.add(r);
    }
    const cow = SPR.vaca();
    for (let k = 0; k < 5; k++) {
      const s = sprite(cow, [3.2, 3.2], new THREE.Vector3(Math.cos(k * 1.3) * 12, 0, Math.sin(k * 1.3) * 12 + 6));
      g.add(s);
    }
  }

  // campos de girassóis
  const sf = SPR.girassol();
  for (let p = 0; p < 4; p++) {
    const at = findPlace(tr, rnd, 22, 60);
    if (!at) continue;
    for (let k = 0; k < 40; k++) {
      const x = at.x + (rnd() - 0.5) * 22, z = at.z + (rnd() - 0.5) * 14;
      if (tr.dist(x, z).d < EDGE + 6) continue;
      tr.group.add(sprite(sf, [2.2, 2.2], new THREE.Vector3(x, tr.terrainY(x, z), z)));
    }
  }

  // bolota gigante (mascote da copa) perto da largada
  const ac = spot(tr, 25, -(EDGE + 22), EDGE + 14) || spot(tr, 25, EDGE + 22, EDGE + 14);
  if (ac) {
    const g = new THREE.Group(); g.position.copy(ac); tr.group.add(g);
    const nut = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), new THREE.MeshPhongMaterial({ color: 0xc7894b, shininess: 50 }));
    nut.scale.set(1, 1.25, 1); nut.position.y = 7; g.add(nut);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam({ color: 0x6d4c41 }));
    cap.position.y = 9.5; g.add(cap);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2), lam({ color: 0x4e342e }));
    stem.position.y = 14.5; g.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 2, 12), lam({ color: 0x9e9e9e }));
    base.position.y = 1; g.add(base);
    let t = 0;
    tr.animated.push((dt) => { t += dt; g.rotation.y = Math.sin(t * 0.5) * 0.3; });
  }

  grandstand(tr, 12, sideWithRoom(tr, 12), 56);
  buildTunnel(tr, 0.58, 0.66, 'pedra');
}

// ================================================================= PRAIA DO COQUEIRO
function praia(tr, rnd) {
  const c = tr.center;
  // farol numa pedra dentro do mar
  let far = 0;
  for (let i = 0; i < tr.N; i++) if (tr.pz[i] > tr.pz[far]) far = i;
  const lh = new THREE.Group();
  lh.position.set(tr.px[far] + (tr.mirror ? 40 : -40), 0, 150);
  tr.group.add(lh);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(12, 0), lam({ color: 0x795548, flatShading: true }));
  rock.scale.set(1.2, 0.5, 1.2); rock.position.y = 1; lh.add(rock);
  const stripes = tex(16, 64, (g, w, h) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#fff' : '#d32f2f'; g.fillRect(0, (k * h) / 8, w, h / 8); } });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 24, 16), lam({ map: stripes }));
  tower.position.y = 16; lh.add(tower);
  const room = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 12), basic({ color: 0xfff59d }));
  room.position.y = 29.5; lh.add(room);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 12), lam({ color: 0x212121 }));
  roof.position.y = 32.5; lh.add(roof);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 40, 12, 1, true), basic({ color: 0xfffde7, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -20, 0); beam.geometry.rotateZ(Math.PI / 2);
  const beamPivot = new THREE.Group(); beamPivot.position.y = 29.5; beamPivot.add(beam); lh.add(beamPivot);
  tr.animated.push((dt) => { beamPivot.rotation.y += dt * 0.9; });

  // arco de pedra natural sobre a pista
  const ai = Math.round(tr.N * 0.3);
  const arch = new THREE.Group();
  tr.point(ai, 0, arch.position);
  arch.rotation.y = tr.heading(ai);   // eixo x local atravessa a pista
  tr.group.add(arch);
  const rockMat = lam({ color: 0xa1887f, flatShading: true });
  const R = EDGE + 3;
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8 + rnd() * 1.4, 0), rockMat);
    r.position.set(Math.cos(a) * R, tr.py[ai] + Math.sin(a) * 13 + 1, (rnd() - 0.5) * 1.5);
    r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    arch.add(r);
  }
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 0), rockMat);
    r.position.set(s * (R + 1), tr.py[ai] - 1 + k * 2.5, 0); arch.add(r);
  }

  // guarda-sóis, cadeiras e castelos de areia
  const umbColors = [0xe53935, 0x1e88e5, 0xffeb3b, 0x43a047, 0xff9800, 0xab47bc];
  for (let k = 0; k < 26; k++) {
    const at = findPlace(tr, rnd, EDGE + 8, 45, (p) => p.z > 20 && p.z < 98);
    if (!at) continue;
    const g = new THREE.Group(); g.position.copy(at); tr.group.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2), lam({ color: 0xffffff }));
    pole.position.y = 1.6; g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1, 8), lam({ color: umbColors[k % umbColors.length] }));
    top.position.y = 3.3; top.rotation.z = 0.15; g.add(top);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), lam({ color: umbColors[(k + 2) % umbColors.length] }));
    towel.rotation.x = -Math.PI / 2; towel.position.set(1.6, 0.05, 0.4); g.add(towel);
    if (k % 4 === 0) {
      const castle = new THREE.Group(); castle.position.set(-2.2, 0, 1); g.add(castle);
      const sand = lam({ color: 0xe0c27a });
      for (const [x, z] of [[0, 0], [1.2, 0], [0, 1.2], [1.2, 1.2]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 6), sand); t.position.set(x, 0.55, z); castle.add(t); }
      const keep = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 6), sand); keep.position.set(0.6, 1.4, 0.6); castle.add(keep);
    }
  }
  // cabanas com pranchas de surfe
  for (let k = 0; k < 4; k++) {
    const at = findPlace(tr, rnd, EDGE + 14, 55, (p) => p.z < 40);
    if (!at) continue;
    const g = new THREE.Group(); g.position.copy(at); g.lookAt(c.x, at.y, c.z); tr.group.add(g);
    for (const [x, z] of [[2.5, 2.5], [-2.5, 2.5], [2.5, -2.5], [-2.5, -2.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2), lam({ color: 0x8d6e63 })); p.position.set(x, 1, z); g.add(p); }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 6), lam({ color: [0x4fc3f7, 0xffb74d, 0xf06292, 0xaed581][k] }));
    hut.position.y = 3.7; g.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3, 4), lam({ color: 0xd7b56d }));
    roof.position.y = 7; roof.rotation.y = Math.PI / 4; g.add(roof);
    for (let s = 0; s < 3; s++) {
      const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 2.6, 4, 8), lam({ color: [0xff5252, 0xffeb3b, 0x40c4ff][s] }));
      board.scale.z = 0.25; board.position.set(-2 + s * 1.3, 2.2, 3.4); board.rotation.z = 0.1 * (s - 1); g.add(board);
    }
  }
  // veleiro e gaivotas
  const boat = new THREE.Group(); tr.group.add(boat);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 9), lam({ color: 0xffffff })); hull.position.y = 0.6; boat.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 10), lam({ color: 0x795548 })); mast.position.y = 6; boat.add(mast);
  const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 10.5, 0), new THREE.Vector3(0, 1.5, -5)]), basic({ color: 0xff7043, side: THREE.DoubleSide }));
  boat.add(sail);
  const gull = SPR.gaivota();
  const gulls = [];
  for (let k = 0; k < 7; k++) { const s = sprite(gull, [2.2, 2.2], new THREE.Vector3()); tr.group.add(s); gulls.push({ s, r: 20 + rnd() * 40, h: 18 + rnd() * 14, ph: rnd() * 6, sp: 0.2 + rnd() * 0.3, cx: c.x + (rnd() - 0.5) * 200, cz: c.z + 40 + rnd() * 80 }); }
  // caranguejos andando de lado na areia
  const crab = SPR.caranguejo();
  const crabs = [];
  for (let k = 0; k < 10; k++) {
    const at = findPlace(tr, rnd, EDGE + 4, 30, (p) => p.z > 40);
    if (!at) continue;
    const s = sprite(crab, [1.4, 1.4], at); tr.group.add(s); crabs.push({ s, x: at.x, ph: rnd() * 6 });
  }
  // espuma na beira do mar
  const foam = tex(64, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.85)'; for (let x = 0; x < w; x += 4) g.fillRect(x, 2 + Math.sin(x) * 2, 3, 3); }, true);
  foam.repeat.set(60, 1);
  const foamM = new THREE.Mesh(new THREE.PlaneGeometry(800, 4), basic({ map: foam, transparent: true, depthWrite: false }));
  foamM.rotation.x = -Math.PI / 2; foamM.position.set(c.x, 0.16, 101); tr.group.add(foamM);

  let t = 0;
  tr.animated.push((dt) => {
    t += dt;
    boat.position.set(c.x + Math.sin(t * 0.03) * 220, 0, 230 + Math.cos(t * 0.03) * 30);
    boat.rotation.y = t * 0.03 + Math.PI / 2;
    boat.rotation.z = Math.sin(t * 1.3) * 0.05;
    for (const g of gulls) { const a = t * g.sp + g.ph; g.s.position.set(g.cx + Math.cos(a) * g.r, g.h + Math.sin(t * 2 + g.ph), g.cz + Math.sin(a) * g.r); g.s.scale.y = 2.2 * (0.7 + 0.3 * Math.abs(Math.sin(t * 6 + g.ph))); }
    for (const cr of crabs) cr.s.position.x = cr.x + Math.sin(t * 0.7 + cr.ph) * 3;
    foam.offset.y = Math.sin(t * 0.8) * 0.15;
    foamM.position.z = 101 + Math.sin(t * 0.8) * 1.2;
  });

  grandstand(tr, 10, sideWithRoom(tr, 10), 44);
}

// ================================================================= SERRA GELADA
function serra(tr, rnd) {
  const c = tr.center;
  // neve caindo em volta da câmera
  const COUNT = 700;
  const flakes = new Float32Array(COUNT * 3);
  for (let k = 0; k < COUNT; k++) { flakes[k * 3] = (rnd() - 0.5) * 120; flakes[k * 3 + 1] = rnd() * 60; flakes[k * 3 + 2] = (rnd() - 0.5) * 120; }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const snow = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.9, depthWrite: false }));
  snow.frustumCulled = false;
  tr.group.add(snow);
  tr.animated.push((dt, cam) => {
    if (cam) snow.position.set(cam.position.x, cam.position.y - 20, cam.position.z);
    for (let k = 0; k < COUNT; k++) {
      flakes[k * 3 + 1] -= dt * (3 + (k % 5));
      flakes[k * 3] += Math.sin((flakes[k * 3 + 1] + k) * 0.3) * dt * 0.8;
      if (flakes[k * 3 + 1] < 0) flakes[k * 3 + 1] += 60;
    }
    fg.attributes.position.needsUpdate = true;
  });

  // lago congelado no meio da pista
  const lake = findPlace(tr, rnd, 40, 140, (p) => tr.terrainY(p.x, p.z) < 3);
  if (lake) {
    const ice = new THREE.Mesh(new THREE.CircleGeometry(26, 28), new THREE.MeshPhongMaterial({ color: 0xbfe6ff, shininess: 120, specular: 0xffffff }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(lake.x, Math.max(lake.y, tr.groundBase) + 0.25, lake.z); tr.group.add(ice);
  }

  // chalé com fumaça na chaminé
  const ch = findPlace(tr, rnd, EDGE + 22, 70);
  if (ch) {
    const g = new THREE.Group(); g.position.copy(ch); g.lookAt(c.x, ch.y, c.z); tr.group.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), lam({ color: 0x8d5a3b })); body.position.y = 3; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.8, 4.5, 4, 1), lam({ color: 0xffffff }));
    roof.position.y = 8.2; roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, 0.92); g.add(roof);
    for (const x of [-2.5, 2.5]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), basic({ color: 0xffd54f })); w.position.set(x, 3.5, 4.01); g.add(w); }
    const chim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1.2), lam({ color: 0x795548 })); chim.position.set(2.5, 9.5, 0); g.add(chim);
    const puffTex = SPR.fumaca();
    const puffs = Array.from({ length: 8 }, (_, k) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xdddddd })); g.add(s); return { s, t: k / 8 }; });
    tr.animated.push((dt) => { for (const p of puffs) { p.t = (p.t + dt * 0.25) % 1; p.s.position.set(2.5 + p.t * 2, 11 + p.t * 9, 0); p.s.scale.setScalar(1 + p.t * 3); p.s.material.opacity = 0.8 * (1 - p.t); } });
  }

  // bonecos de neve
  for (let k = 0; k < 7; k++) {
    const at = findPlace(tr, rnd, EDGE + 6, 30);
    if (!at) continue;
    const g = new THREE.Group(); g.position.copy(at); g.rotation.y = rnd() * 6; tr.group.add(g);
    const white = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 20 });
    [[1.3, 1.2], [0.95, 3.1], [0.7, 4.5]].forEach(([r, y]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), white); b.position.y = y; g.add(b); });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), lam({ color: 0xff7043 })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 4.5, 0.85); g.add(nose);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 12), lam({ color: 0x212121 })); hat.position.y = 5.45; g.add(hat);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.18, 6, 14), lam({ color: [0xe53935, 0x1e88e5, 0x43a047][k % 3] })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 3.85; g.add(scarf);
  }

  // teleférico subindo a montanha
  let ai = 0;
  for (let i = 0; i < tr.N; i++) if (tr.py[i] < tr.py[ai]) ai = i;
  const A = tr.point(ai, 0).add(new THREE.Vector3(0, 0, 0));
  const dir = new THREE.Vector3(A.x - c.x, 0, A.z - c.z).normalize();
  const start = A.clone().add(dir.clone().multiplyScalar(60));
  const end = start.clone().add(dir.clone().multiplyScalar(420));
  start.y = tr.terrainY(start.x, start.z); end.y = tr.terrainY(end.x, end.z);
  const towers = 6, pts = [];
  for (let k = 0; k <= towers; k++) {
    const p = new THREE.Vector3().lerpVectors(start, end, k / towers);
    p.y = tr.terrainY(p.x, p.z);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), lam({ color: 0x546e7a }));
    tw.position.set(p.x, p.y + 7, p.z); tr.group.add(tw);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 0.4), lam({ color: 0x546e7a }));
    arm.position.set(p.x, p.y + 14, p.z); arm.lookAt(p.x + dir.z, p.y + 14, p.z - dir.x); tr.group.add(arm);
    pts.push(new THREE.Vector3(p.x, p.y + 13.6, p.z));
  }
  const cableCurve = new THREE.CatmullRomCurve3(pts);
  tr.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cableCurve.getPoints(60)), new THREE.LineBasicMaterial({ color: 0x263238 })));
  const cabins = Array.from({ length: 5 }, (_, k) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), lam({ color: [0xe53935, 0xffeb3b, 0x1e88e5, 0x43a047, 0xff9800][k] })); box.position.y = -2.4; g.add(box);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 2.5), basic({ color: 0xb3e5fc })); win.position.y = -2.1; g.add(win);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), lam({ color: 0x333333 })); rod.position.y = -0.7; g.add(rod);
    tr.group.add(g); return { g, t: k / 5 };
  });
  tr.animated.push((dt) => { for (const cb of cabins) { cb.t = (cb.t + dt * 0.015) % 1; cb.g.position.copy(cableCurve.getPointAt(cb.t)); } });

  // cristais de gelo
  const crystal = new THREE.MeshPhongMaterial({ color: 0x9fe2ff, transparent: true, opacity: 0.85, shininess: 140, specular: 0xffffff, flatShading: true });
  for (let k = 0; k < 10; k++) {
    const at = findPlace(tr, rnd, EDGE + 5, 35);
    if (!at) continue;
    for (let q = 0; q < 4; q++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(1 + rnd() * 1.5, 0), crystal);
      m.scale.y = 2.2; m.position.set(at.x + (rnd() - 0.5) * 4, at.y + 1.5, at.z + (rnd() - 0.5) * 4); m.rotation.set(rnd() * 0.5, rnd() * 3, rnd() * 0.5);
      tr.group.add(m);
    }
  }

  buildTunnel(tr, 0.86, 0.93, 'gelo');
}

// ================================================================= VULCÃO OITO
function vulcao(tr, rnd) {
  const c = tr.center;
  // vulcão gigante ao fundo
  const vpos = new THREE.Vector3(c.x + 60, 0, c.z - 420);
  const lavaTex = tex(32, 32, (g, w, h) => { g.fillStyle = '#ff5a00'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; for (let i = 0; i < 60; i++) g.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 3, 1); }, true);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(40, 210, 170, 18, 1, true), lam({ color: 0x3a2622, flatShading: true }));
  cone.position.set(vpos.x, 84, vpos.z); tr.group.add(cone);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(40, 18), basic({ map: lavaTex }));
  crater.rotation.x = -Math.PI / 2; crater.position.set(vpos.x, 165, vpos.z); tr.group.add(crater);
  for (let k = 0; k < 3; k++) {
    const a = -0.5 + k * 0.5;
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(9, 180), basic({ map: lavaTex, side: THREE.DoubleSide }));
    stream.position.set(vpos.x + Math.sin(a) * 126, 84, vpos.z + Math.cos(a) * 126);
    stream.lookAt(vpos.x, 84, vpos.z); stream.rotateX(-0.47);
    tr.group.add(stream);
  }
  const smokeTex = SPR.fumaca();
  const smoke = Array.from({ length: 14 }, (_, k) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, color: 0x554444, fog: false })); tr.group.add(s); return { s, t: k / 14 }; });
  const fireTex = SPR.fogo();
  const balls = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, fog: false })); s.scale.setScalar(12); tr.group.add(s); return { s, t: Math.random() * 3, vx: 0, vz: 0, vy: 0 }; });

  // braseiros ao longo da pista
  const fires = [];
  for (let i = 0; i < tr.N; i += 45) {
    for (const side of [1, -1]) {
      const p = tr.point(i, side * (EDGE + 2.2));
      if (tr.dist(p.x, p.z).d < EDGE + 1) continue;
      const g = new THREE.Group(); g.position.set(p.x, tr.py[i], p.z); tr.group.add(g);
      const ph = tr.py[i] + 3.8;   // pilar sai de dentro da lava
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, ph, 6), lam({ color: 0x424242 })); pillar.position.y = 3 - ph / 2; g.add(pillar);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.6, 0.8, 8), lam({ color: 0x212121 })); bowl.position.y = 3.3; g.add(bowl);
      const f = sprite(fireTex, [2.4, 3], new THREE.Vector3(0, 3.4, 0)); f.material.transparent = true; f.material.alphaTest = 0.05; g.add(f);
      fires.push({ f, ph: rnd() * 6 });
    }
  }
  // pilares com runas brilhantes e pedras flutuando
  const rune = tex(16, 64, (g, w, h) => { g.fillStyle = '#2b1d1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff6d00'; for (let y = 6; y < h; y += 14) { g.fillRect(5, y, 6, 2); g.fillRect(7, y - 3, 2, 8); } });
  for (let k = 0; k < 10; k++) {
    const at = findPlace(tr, rnd, EDGE + 10, 70, null, true);
    if (!at) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 3), lam({ map: rune, emissive: 0x220800 }));
    m.position.set(at.x, 8, at.z); m.rotation.y = rnd() * 3; tr.group.add(m);
  }
  const floats = [];
  for (let k = 0; k < 12; k++) {
    const at = findPlace(tr, rnd, EDGE + 18, 120, null, true);
    if (!at) continue;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + rnd() * 4, 0), lam({ color: 0x3e2723, flatShading: true }));
    m.position.set(at.x, 10 + rnd() * 20, at.z); tr.group.add(m);
    floats.push({ m, y: m.position.y, ph: rnd() * 6 });
  }
  // bolhas de lava estourando
  const bubbleMat = basic({ color: 0xffa000 });
  const bubbles = Array.from({ length: 16 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), bubbleMat); tr.group.add(m);
    return { m, t: Math.random() * 2, at: null };
  });

  let t = 0;
  tr.animated.push((dt) => {
    t += dt;
    for (const s of smoke) { s.t = (s.t + dt * 0.05) % 1; s.s.position.set(vpos.x + Math.sin(s.t * 5) * 15 * s.t, 175 + s.t * 140, vpos.z + s.t * 40); s.s.scale.setScalar(30 + s.t * 90); s.s.material.opacity = 0.75 * (1 - s.t); }
    for (const b of balls) {
      b.t -= dt;
      if (b.t <= 0) { b.t = 4 + Math.random() * 3; b.s.position.set(vpos.x, 170, vpos.z); b.vx = (Math.random() - 0.5) * 50; b.vz = (Math.random() - 0.5) * 50 + 20; b.vy = 55 + Math.random() * 30; }
      b.vy -= 25 * dt; b.s.position.x += b.vx * dt; b.s.position.y += b.vy * dt; b.s.position.z += b.vz * dt;
      b.s.visible = b.s.position.y > 0;
    }
    for (const f of fires) { const k = 0.85 + Math.sin(t * 13 + f.ph) * 0.1 + Math.random() * 0.08; f.f.scale.set(2.4 * k, 3 * k * (0.9 + Math.sin(t * 9 + f.ph) * 0.1), 1); }
    for (const fl of floats) { fl.m.position.y = fl.y + Math.sin(t * 0.6 + fl.ph) * 1.5; fl.m.rotation.y += dt * 0.1; }
    for (const b of bubbles) {
      b.t -= dt;
      if (b.t <= 0 || !b.at) {
        b.t = 1 + Math.random() * 1.5;
        const i = (Math.random() * tr.N) | 0, side = Math.random() < 0.5 ? 1 : -1;
        b.at = tr.point(i, side * (EDGE + 8 + Math.random() * 25));
      }
      const k = 1 - b.t / 2.5;
      b.m.position.set(b.at.x, -0.6, b.at.z);
      b.m.scale.setScalar(0.3 + Math.max(0, k) * 1.6);
    }
  });
}

// procura um lugar livre (longe de qualquer trecho da pista)
function findPlace(tr, rnd, minD, maxD, filter = null, allowLava = false) {
  for (let tries = 0; tries < 80; tries++) {
    const i = (rnd() * tr.N) | 0;
    const side = rnd() < 0.5 ? 1 : -1;
    const lat = side * (EDGE + minD + rnd() * (maxD - minD));
    const p = tr.point(i, lat);
    if (tr.dist(p.x, p.z).d < EDGE + Math.max(6, minD * 0.6)) continue;
    if (tr.water) { let wet = false; for (const [x, z, w, d] of tr.water) if (p.x > x - 3 && p.x < x + w + 3 && p.z > z - 3 && p.z < z + d + 3) wet = true; if (wet) continue; }
    if (filter && !filter(p)) continue;
    p.y = tr.terrainY(p.x, p.z);
    if (!allowLava && tr.def.lava) continue;
    return p;
  }
  return null;
}

function sideWithRoom(tr, i) {
  for (const s of [1, -1]) {
    let ok = true;
    for (let k = -25; k <= 25; k += 5) { const p = tr.point(i + k, s * (EDGE + 16)); if (tr.dist(p.x, p.z).d < EDGE + 12 || tr.isFall((i + k + tr.N) % tr.N, s)) ok = false; }
    if (ok) return s;
  }
  return 1;
}

// ================================================================= entrada
export function buildScenery(tr, rnd) {
  const theme = tr.def.theme;
  if (theme === 'campos') campos(tr, rnd);
  if (theme === 'praia') praia(tr, rnd);
  if (theme === 'serra') serra(tr, rnd);
  if (theme === 'vulcao') vulcao(tr, rnd);
  if (theme === 'ilhas') ilhas(tr, rnd, { SPR, ADS, adTexture, grandstand, sideWithRoom, findPlace, spot, sprite });
  if (theme === 'sucata') sucata(tr, rnd, { SPR, ADS, adTexture, grandstand, sideWithRoom, findPlace, spot, sprite, billboard, facing });
  if (theme === 'pantano') pantano(tr, rnd, { SPR, ADS, adTexture, grandstand, sideWithRoom, findPlace, spot, sprite });
  if (theme === 'oficina') oficina(tr, rnd, { SPR, ADS, adTexture, grandstand, sideWithRoom, findPlace, spot, sprite });
  if (theme !== 'oficina' && !tr.def.void) placeBillboards(tr, rnd); // na cidade, os anúncios são placas penduradas nas lojas
  if (!tr.def.void) placeChevrons(tr);
  // bandeirolas atravessando a reta de largada
  for (const k of [-14, 14]) {
    const a = tr.point(k, EDGE + 0.8), b = tr.point(k, -(EDGE + 0.8));
    a.y = b.y = tr.py[((k % tr.N) + tr.N) % tr.N] + 6.2;
    bunting(tr, a, b, 0.8);
  }
  // postes nas pontas das bandeirolas
  for (const k of [-14, 14]) for (const s of [1, -1]) {
    const p = tr.point(k, s * (EDGE + 0.8));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 0.3), lam({ color: 0x9e9e9e }));
    post.position.set(p.x, tr.py[((k % tr.N) + tr.N) % tr.N] + 3.2, p.z);
    tr.group.add(post);
  }
  void ROAD_HALF;
}
