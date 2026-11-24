import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// =====================================================================
//  Pilotos em 3D, "fotografados" como sprites (como o MK64 fazia):
//  32 ângulos x 5 poses
// =====================================================================
export const FRAMES = 32;
export const CELL = 96;
export const POSES = 5; // 0 reto, 1 virando p/ esquerda, 2 virando p/ direita, 3 comemorando, 4 atordoado
const HALF = 1.5;        // metade da área fotografada (metros)
const CY = 1.15;         // centro vertical da foto
export const SPRITE_WORLD = HALF * 2;
export const SPRITE_GROUND = (HALF - CY) / (HALF * 2);

// visual de cada piloto (roupa, acessórios)
const LOOK = {
  // Pipoca: mensageira de bicicleta a vapor (jaqueta do correio, bolsa de cartas, óculos de aviadora)
  pipoca: { shirt: 0x3f6fa8, shoe: 0x6b4426, glove: 0xf5efe0 },
  // Tico: botânico do Brejo, cultiva os cogumelos que brilham (avental, lupa, mudas)
  tico:   { shirt: 0xd8c28a, shoe: 0x6b4426, glove: 0x7cc642, cap: 0xe8541e, spots: 0xfff3c4 },
  // Mel: relojoeira (avental de couro, lupa de joalheiro)
  mel:    { shirt: 0xf3e6c8, shoe: 0x6b4426, glove: 0xffffff },
  // Faísca: piloto de dirigível (jaqueta de couro com gola de lã, cachecol, óculos)
  faisca: { shirt: 0x7a4a2a, shoe: 0x2a1a10, glove: 0x3a2414, scarf: 0xe53935 },
  // Bento: foguista da ferrovia (macacão azul, lenço, quepe)
  bento:  { shirt: 0x3a5a8a, shoe: 0x3a2414, glove: 0xd8c8a8, scarf: 0xc0392b },
  // Tonho: cortador de gelo da serra (camisa xadrez, suspensórios, gorro, serrote)
  tonho:  { shirt: 0xb03a2e, shoe: 0x3e2723, glove: 0x6b4426, cap: 0x2f6a5a },
  // Rino: dono da fundição (colete, gravata-borboleta, corrente de relógio)
  rino:   { shirt: 0xe8e0d0, shoe: 0x111111, glove: 0x111111, vest: 0x4a2a5a },
  // Juca: capitão do navio-caldeira (casaca azul com botões de latão, cachimbo de vapor)
  juca:   { shirt: 0x1f2f5a, shoe: 0x3e2723, glove: 0xffffff, cap: 0x1a237e },
};

let renderer = null;
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(CELL, CELL);
    renderer.setClearColor(0x000000, 0);
  }
  return renderer;
}

// ------------------------------------------------------------------ utilitários de modelagem
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

class B {
  constructor() { this.cache = new Map(); }
  plastic(c, shin = 60) { return this.mat('p' + c + shin, () => new THREE.MeshPhongMaterial({ color: c, shininess: shin, specular: 0x555555 })); }
  fur(c) { return this.mat('f' + c, () => new THREE.MeshPhongMaterial({ color: c, shininess: 8, specular: 0x111111 })); }
  metal(c = 0xd8dde3) { return this.mat('m' + c, () => new THREE.MeshPhongMaterial({ color: c, shininess: 120, specular: 0xffffff })); }
  mat(key, fn) { if (!this.cache.has(key)) this.cache.set(key, fn()); return this.cache.get(key); }
  add(parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = null) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.rotation.set(...r);
    if (s) m.scale.set(...(Array.isArray(s) ? s : [s, s, s]));
    parent.add(m);
    return m;
  }
  sphere(parent, r, mat, p, s = null) { return this.add(parent, new THREE.SphereGeometry(r, 24, 16), mat, p, [0, 0, 0], s); }
  // cápsula ligando dois pontos (braços, pernas)
  limb(parent, a, b, r, mat) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 6, 12), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    parent.add(m);
    return m;
  }
  tube(parent, pts, r, mat) {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8, false);
    return this.add(parent, g, mat);
  }
  rbox(parent, w, h, d, rad, mat, p, r) { return this.add(parent, new RoundedBoxGeometry(w, h, d, 3, rad), mat, p, r); }
}

// ponto na superfície de uma esfera (yaw: para os lados, pitch: para cima)
const surf = (R, yaw, pitch) => [R * Math.cos(pitch) * Math.sin(yaw), R * Math.sin(pitch), R * Math.cos(pitch) * Math.cos(yaw)];

// ------------------------------------------------------------------ rosto
// olhos simples de desenho: oval escuro achatado no rosto com um brilhinho
// (sem globo branco saltado). lid: pálpebra da cor do pelo, olhar semicerrado
function eyes(b, head, R, { yaw = 0.3, pitch = 0.1, size = 0.07, expr = 'normal', lid = null } = {}) {
  const ink = b.plastic(0x1c1416, 70);
  for (const s of [1, -1]) {
    const p = surf(R * 0.985, s * yaw, pitch);
    const face = new THREE.Group();
    face.position.set(...p);
    face.lookAt(new THREE.Vector3(...p).multiplyScalar(2)); // z aponta para fora do rosto
    head.add(face);
    if (expr === 'happy') {
      b.add(face, new THREE.TorusGeometry(size * 0.7, size * 0.2, 6, 14, Math.PI), ink, [0, -size * 0.2, 0.01]);
    } else if (expr === 'dizzy') {
      for (const a of [0.8, -0.8]) b.add(face, new THREE.BoxGeometry(size * 1.6, size * 0.32, 0.03), ink, [0, 0, 0.01], [0, 0, a]);
    } else {
      b.add(face, new THREE.SphereGeometry(size, 18, 12), ink, [0, 0, 0], [0, 0, 0], [0.72, 1, 0.32]);
      const hy = lid ? -size * 0.4 : size * 0.38;
      b.add(face, new THREE.SphereGeometry(size * 0.26, 8, 6), b.plastic(0xffffff, 10), [-s * size * 0.2, hy, size * 0.24], [0, 0, 0], [1, 1, 0.5]);
      if (lid) // metade de cima coberta pela pálpebra, levemente inclinada
        b.add(face, new THREE.SphereGeometry(size * 1.06, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), b.fur(lid), [0, -size * 0.12, 0], [0, 0, s * 0.18], [0.76, 1, 0.38]);
    }
  }
}

function mouth(b, head, R, { pitch = -0.28, w = 0.13, expr = 'normal' } = {}) {
  const p = surf(R * 0.98, 0, pitch);
  if (expr === 'happy') {
    const m = b.sphere(head, w, b.plastic(0x8b1a1a, 20), p, [1, 0.8, 0.35]);
    b.sphere(head, w * 0.55, b.plastic(0xff6f80, 20), [p[0], p[1] - w * 0.35, p[2] + 0.02], [1, 0.5, 0.3]);
    return m;
  }
  if (expr === 'dizzy') return b.add(head, new THREE.TorusGeometry(w * 0.45, w * 0.16, 6, 14), b.plastic(0x5a1010), p);
  return b.add(head, new THREE.TorusGeometry(w, w * 0.17, 6, 16, Math.PI), b.plastic(0x5a1010), p, [0, 0, Math.PI]);
}

function cheeks(b, head, R, color = 0xff8fa8) {
  for (const s of [1, -1]) b.sphere(head, 0.06, b.mat('blush' + color, () => new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.6 })), surf(R * 0.97, s * 0.62, -0.12), [1, 0.6, 0.3]);
}

// ------------------------------------------------------------------ cabeças
function buildHead(b, d, expr) {
  const h = new THREE.Group();
  const L = LOOK[d.id];
  const fur = b.fur(d.fur);
  let R = 0.4;
  const ex = (o = {}) => ({ expr, ...o });

  switch (d.id) {
    case 'pipoca': { // coelha
      R = 0.38;
      const pink = b.fur(0xffb3cf);
      // cabeça levemente em forma de pera: mais larga nas bochechas
      b.sphere(h, R, fur, [0, 0.02, 0], [1, 0.95, 0.94]);
      for (const s of [1, -1]) b.sphere(h, 0.2, fur, [s * 0.14, -0.13, 0.12], [1, 0.82, 0.9]);
      // focinho fofo: duas almofadinhas, narizinho rosa e dentinhos
      for (const s of [1, -1]) b.sphere(h, 0.085, fur, [s * 0.065, -0.12, 0.33], [1, 0.85, 0.75]);
      b.sphere(h, 0.04, b.plastic(0xff6f9a, 60), [0, -0.06, 0.39], [1.3, 0.9, 0.8]);
      if (expr !== 'dizzy') for (const s of [1, -1]) b.rbox(h, 0.04, 0.06, 0.02, 0.01, b.plastic(0xffffff, 40), [s * 0.022, -0.21, 0.34]);
      // tufinho de pelo na testa
      for (const [x, y, z, r] of [[0.02, 0.33, 0.17, 0.06], [-0.05, 0.31, 0.19, 0.045]]) b.sphere(h, r, fur, [x, y, z]);
      // orelhas compridas em forma de folha, a da direita com a ponta dobrada
      for (const s of [1, -1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.13, 0.3, -0.06);
        ear.rotation.set(-0.22, s * 0.12, -s * (expr === 'dizzy' ? 0.8 : expr === 'happy' ? 0.28 : 0.14));
        h.add(ear);
        b.sphere(ear, 0.06, fur, [0, 0.02, 0]); // base mais fina
        b.add(ear, new THREE.SphereGeometry(1, 20, 14), fur, [0, 0.24, 0], [0, 0, 0], [0.105, 0.26, 0.05]);
        b.add(ear, new THREE.SphereGeometry(1, 16, 12), pink, [0, 0.24, 0.025], [0, 0, 0], [0.06, 0.2, 0.035]);
        const tip = new THREE.Group();
        tip.position.set(0, 0.45, 0);
        if (s > 0) tip.rotation.set(0.3, 0, -0.95); else tip.rotation.x = 0.12; // ponta caída para fora numa orelha só
        ear.add(tip);
        b.add(tip, new THREE.SphereGeometry(1, 20, 14), fur, [0, 0.1, 0], [0, 0, 0], [0.095, 0.15, 0.045]);
        b.add(tip, new THREE.SphereGeometry(1, 16, 12), pink, [0, 0.09, 0.022], [0, 0, 0], [0.052, 0.1, 0.03]);
      }
      // laço na base da orelha esquerda
      const bow = new THREE.Group(); bow.position.set(-0.17, 0.33, 0.04); bow.rotation.z = 0.35; h.add(bow);
      for (const s of [1, -1]) b.sphere(bow, 0.075, b.plastic(0xff3f8e), [s * 0.075, 0, 0], [1, 0.62, 0.5]);
      b.sphere(bow, 0.04, b.plastic(0xff3f8e), [0, 0, 0.02]);
      eyes(b, h, R, ex({ yaw: 0.3, pitch: 0.08, size: 0.068 }));
      if (expr !== 'normal') mouth(b, h, R, ex({ pitch: -0.42, w: 0.07 }));
      cheeks(b, h, R);
      // óculos de aviadora na testa
      {
        const gg = new THREE.Group(); gg.position.set(0, 0.17, 0.01); gg.rotation.x = -0.45; h.add(gg);
        b.add(gg, new THREE.TorusGeometry(0.345, 0.024, 6, 28), b.plastic(0x5a3a22), [0, 0, 0], [Math.PI / 2, 0, 0], [1.04, 1, 0.95]);
        for (const sd of [1, -1]) {
          b.add(gg, new THREE.CylinderGeometry(0.07, 0.08, 0.07, 16), b.metal(0xc9a24a), [sd * 0.11, 0, 0.32], [Math.PI / 2, 0, 0]);
          b.add(gg, new THREE.CircleGeometry(0.058, 16), b.plastic(0x9fd8e8, 140), [sd * 0.11, 0, 0.356]);
        }
      }
      break;
    }
    case 'tico': { // sapo + cogumelo
      R = 0.4;
      const SX = 1.32, SY = 0.7, SZ = 1.05; // cabeça larga e achatada de sapo
      b.sphere(h, R, fur, [0, -0.04, 0], [SX, SY, SZ]);
      b.sphere(h, R * 0.92, b.fur(0xe4f2b8), [0, -0.1, 0.04], [SX * 0.95, SY * 0.7, SZ * 0.98]); // papo claro
      // calombos dos olhos em cima da cabeça, com olho simples na frente
      for (const s of [1, -1]) {
        const bump = new THREE.Group(); bump.position.set(s * 0.22, 0.17, 0.1); h.add(bump);
        b.sphere(bump, 0.14, fur, [0, 0, 0], [1, 0.92, 0.95]);
        const face = new THREE.Group(); face.position.set(s * 0.02, 0.02, 0.125); face.rotation.y = s * 0.2; bump.add(face);
        const ink = b.plastic(0x1c1416, 70);
        if (expr === 'happy') b.add(face, new THREE.TorusGeometry(0.05, 0.014, 6, 14, Math.PI), ink, [0, -0.01, 0.005]);
        else if (expr === 'dizzy') for (const a2 of [0.8, -0.8]) b.add(face, new THREE.BoxGeometry(0.1, 0.022, 0.02), ink, [0, 0, 0.005], [0, 0, a2]);
        else {
          b.add(face, new THREE.SphereGeometry(0.068, 18, 12), ink, [0, 0, 0], [0, 0, 0], [0.75, 1, 0.32]);
          b.sphere(face, 0.018, b.plastic(0xffffff, 10), [-s * 0.014, 0.026, 0.017], [1, 1, 0.5]);
        }
      }
      // narinas
      for (const s of [1, -1]) b.sphere(h, 0.014, b.plastic(0x2e5a12), [s * 0.06, 0.03, 0.42]);
      // boca larga de sapo de uma bochecha à outra
      const mg = new THREE.Group(); mg.position.set(0, -0.04, 0); mg.scale.set(SX, SY, SZ); h.add(mg);
      {
        const happy = expr === 'happy';
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const y = -0.95 + (1.9 * k) / 16;
          pts.push(V(...surf(R * 1.0, y, (happy ? -0.27 + 0.2 * y * y : -0.2 + 0.1 * y * y) + (expr === 'dizzy' ? 0.04 * Math.sin(k * 1.6) : 0))));
        }
        if (happy) { // sorrisão aberto: boca escura com linguinha
          b.sphere(mg, 0.13, b.plastic(0x5a1010, 20), surf(R * 0.97, 0, -0.27), [1.7, 0.55, 0.3]);
          b.sphere(mg, 0.07, b.plastic(0xff6f80, 20), surf(R * 0.99, 0, -0.31), [1.6, 0.45, 0.3]);
        }
        b.tube(mg, pts, happy ? 0.016 : 0.011, b.plastic(0x2e3a12, 30));
      }
      cheeks(b, h, R * 1.12, 0xff7aa0);
      // chapeuzinho de cogumelo atrás dos olhos, inclinado como uma boina
      const cap = new THREE.Group(); cap.position.set(0, 0.22, -0.14); cap.rotation.set(-0.38, 0, 0.12);
      if (expr === 'dizzy') cap.rotation.z = 0.45;
      h.add(cap);
      b.add(cap, new THREE.CylinderGeometry(0.1, 0.12, 0.12, 16), b.fur(0xf3e5c0), [0, -0.02, 0]); // talo
      b.add(cap, new THREE.SphereGeometry(0.34, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), b.plastic(L.cap, 40), [0, 0.03, 0], [0, 0, 0], [1, 0.8, 1]);
      b.add(cap, new THREE.CylinderGeometry(0.34, 0.3, 0.04, 32), b.fur(0xf3e5c0), [0, 0.02, 0]);
      // lamelas embaixo do chapéu e o anelzinho do talo
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; b.add(cap, new THREE.BoxGeometry(0.012, 0.03, 0.2), b.fur(0xe8d2a8), [Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.2], [0, a, 0]); }
      b.add(cap, new THREE.TorusGeometry(0.105, 0.02, 6, 18), b.fur(0xf8ecd0), [0, -0.05, 0], [Math.PI / 2, 0, 0]);
      // dois cogumelinhos brotando do chapéu
      for (const [x, z, r, c] of [[0.2, -0.1, 0.07, 0xffc84a], [-0.16, -0.16, 0.055, 0xe8541e]]) {
        b.add(cap, new THREE.CylinderGeometry(0.02, 0.025, 0.08, 8), b.fur(0xf3e5c0), [x, 0.27, z]);
        b.add(cap, new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), b.plastic(c, 40), [x, 0.3, z]);
      }
      for (const [yaw, pitch, r] of [[0, 0.45, 0.075], [1.3, 0.4, 0.065], [-1.3, 0.4, 0.065], [2.5, 0.45, 0.07], [-2.5, 0.45, 0.07], [0.7, 1.05, 0.06], [-0.7, 1.05, 0.06], [3.14, 1.0, 0.06], [0, 1.45, 0.06]]) {
        const p = surf(0.345, yaw, pitch);
        const sp = b.sphere(cap, r, b.plastic(L.spots, 30), [p[0], 0.03 + p[1] * 0.8, p[2]], [1, 1, 0.4]);
        sp.quaternion.setFromUnitVectors(V(0, 0, 1), V(p[0], p[1] * 1.25, p[2]).normalize()); // achatada rente à superfície
      }
      break;
    }
    case 'mel': { // gata
      b.sphere(h, R, fur, [0, 0, 0], [1.05, 0.95, 0.95]);
      for (const s of [1, -1]) {
        b.add(h, new THREE.ConeGeometry(0.14, 0.26, 4), fur, [s * 0.24, 0.36, -0.02], [0, Math.PI / 4, -s * 0.35]);
        b.add(h, new THREE.ConeGeometry(0.08, 0.16, 4), b.fur(0xffb3cf), [s * 0.235, 0.35, 0.03], [0, Math.PI / 4, -s * 0.35]);
        // listras
        b.add(h, new THREE.BoxGeometry(0.03, 0.12, 0.02), b.fur(0xc76a12), surf(R * 1.0, s * 0.25, 0.62), [0.5, s * 0.25, 0]);
        for (const k of [0, 1]) b.add(h, new THREE.BoxGeometry(0.22, 0.008, 0.008), b.plastic(0x5d4037), [s * 0.28, -0.1 - k * 0.04, 0.35], [0, 0, s * (k ? -0.12 : 0.12)]);
      }
      b.sphere(h, 0.16, b.fur(0xffffff), surf(R * 0.8, 0, -0.25), [1.3, 0.75, 0.8]);
      b.sphere(h, 0.04, b.plastic(0xff6f9a), surf(R * 0.99, 0, -0.12), [1.3, 0.9, 1]);
      eyes(b, h, R, ex());
      mouth(b, h, R, ex({ pitch: -0.34, w: 0.06 }));
      cheeks(b, h, R);
      // flor no cabelo
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; b.sphere(h, 0.055, b.plastic(0xffffff), [-0.24 + Math.cos(a) * 0.06, 0.3 + Math.sin(a) * 0.06, 0.18], [1, 1, 0.5]); }
      b.sphere(h, 0.04, b.plastic(0xffc107), [-0.24, 0.3, 0.21]);
      // lupa de relojoeira: tiara de couro com a lente de latão baixada sobre o olho direito
      b.add(h, new THREE.TorusGeometry(0.36, 0.022, 6, 28), b.plastic(0x6b4426), [0, 0.16, -0.02], [Math.PI / 2 - 0.35, 0, 0], [1.08, 1, 0.98]);
      if (expr !== 'dizzy') {
        const lp = surf(R * 1.0, 0.3, 0.1);
        const lo = new THREE.Group(); lo.position.set(...lp); lo.lookAt(new THREE.Vector3(...lp).multiplyScalar(2)); h.add(lo);
        b.add(lo, new THREE.CylinderGeometry(0.075, 0.09, 0.1, 16), b.metal(0xc9a24a), [0, 0, 0.05], [Math.PI / 2, 0, 0]);
        b.add(lo, new THREE.CircleGeometry(0.068, 16), b.plastic(0xbfe8ff, 140), [0, 0, 0.101]);
        b.limb(h, V(0.26, 0.2, 0.28), V(lp[0], lp[1] + 0.06, lp[2]), 0.012, b.metal(0xc9a24a));
      }
      break;
    }
    case 'faisca': { // raposa
      b.sphere(h, R, fur, [0, 0, 0], [1.05, 0.95, 0.95]);
      for (const s of [1, -1]) {
        b.add(h, new THREE.ConeGeometry(0.15, 0.38, 4), fur, [s * 0.24, 0.42, -0.04], [0, Math.PI / 4, -s * 0.28]);
        b.add(h, new THREE.ConeGeometry(0.06, 0.12, 4), b.fur(0x2b2b2b), [s * 0.3, 0.59, -0.04], [0, Math.PI / 4, -s * 0.28]);
        b.sphere(h, 0.15, b.fur(0xffffff), surf(R * 0.75, s * 0.45, -0.3), [1, 0.8, 0.9]);
      }
      const snout = b.add(h, new THREE.ConeGeometry(0.16, 0.36, 16), b.fur(0xffffff), [0, -0.12, 0.44], [Math.PI / 2, 0, 0], [1, 1, 0.75]);
      snout.rotation.x = Math.PI / 2;
      b.sphere(h, 0.055, b.plastic(0x111111, 90), [0, -0.12, 0.62]);
      eyes(b, h, R, ex({ size: 0.068 }));
      mouth(b, h, R, ex({ pitch: -0.42, w: 0.07 }));
      // óculos de corrida na testa
      const gg = new THREE.Group(); gg.position.set(0, 0.26, 0.02); gg.rotation.x = -0.35; h.add(gg);
      b.add(gg, new THREE.TorusGeometry(0.42, 0.03, 6, 28), b.plastic(0x3e2723), [0, 0, -0.02], [Math.PI / 2, 0, 0], [1, 1, 0.95]);
      for (const s of [1, -1]) {
        b.add(gg, new THREE.TorusGeometry(0.085, 0.025, 8, 16), b.metal(0xffc107), [s * 0.12, 0.02, 0.36]);
        b.add(gg, new THREE.CircleGeometry(0.075, 16), b.plastic(0x4fc3f7, 120), [s * 0.12, 0.02, 0.365]);
      }
      break;
    }
    case 'bento': { // cão
      b.sphere(h, R, fur, [0, 0, 0], [1.05, 0.95, 0.95]);
      for (const s of [1, -1]) b.sphere(h, 0.17, b.fur(0x6d4c41), [s * 0.4, -0.06, -0.02], [0.5, 1.5, 0.9]).rotation.z = s * 0.25;
      b.sphere(h, 0.11, b.fur(0xffffff), surf(R * 0.94, 0.35, 0.25), [1, 1, 0.4]); // mancha no olho
      b.sphere(h, 0.19, b.fur(0xf0d9b5), surf(R * 0.82, 0, -0.25), [1.2, 0.8, 0.95]);
      b.sphere(h, 0.08, b.plastic(0x111111, 100), surf(R * 1.08, 0, -0.1), [1.3, 0.9, 1]);
      eyes(b, h, R, ex({ pitch: 0.15 }));
      mouth(b, h, R, ex({ pitch: -0.38, w: 0.09 }));
      if (expr !== 'dizzy') b.sphere(h, 0.06, b.plastic(0xff6f80), surf(R * 1.0, 0.06, -0.5), [1, 1.4, 0.5]);
      // quepe de ferroviário com distintivo de latão
      {
        const cap = new THREE.Group(); cap.position.set(0, 0.27, -0.02); cap.rotation.x = -0.12; h.add(cap);
        b.add(cap, new THREE.CylinderGeometry(0.34, 0.32, 0.16, 24), b.plastic(0x23304a, 30), [0, 0.06, 0]);
        b.add(cap, new THREE.CylinderGeometry(0.335, 0.335, 0.04, 24), b.plastic(0x111111, 30), [0, -0.01, 0]);
        b.rbox(cap, 0.36, 0.025, 0.18, 0.01, b.plastic(0x111111, 120), [0, -0.03, 0.32], [0.25, 0, 0]);
        b.add(cap, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), b.metal(0xc9a24a), [0, 0.06, 0.33], [Math.PI / 2, 0, 0]);
      }
      break;
    }
    case 'tonho': { // urso
      R = 0.43;
      b.sphere(h, R, fur, [0, 0, 0], [1.1, 0.95, 0.95]);
      // orelhas redondas saindo por cima do gorro
      for (const s of [1, -1]) { b.sphere(h, 0.12, fur, [s * 0.34, 0.47, -0.04], [1, 1, 0.75]); b.sphere(h, 0.065, b.fur(0xd7a979), [s * 0.34, 0.47, 0.045], [1, 1, 0.4]); }
      // focinho claro e arredondado, mais baixo, com nariz grande de urso em cima e boquinha embaixo
      const tan = b.fur(0xd7a979);
      const mz = [0, -0.14, 0.33];
      b.sphere(h, 0.17, tan, mz, [1.25, 0.82, 0.9]);
      b.sphere(h, 0.07, b.plastic(0x2a1a14, 110), [0, mz[1] + 0.07, mz[2] + 0.14], [1.35, 0.85, 0.9]);
      b.sphere(h, 0.018, b.plastic(0xffffff, 10), [0.03, mz[1] + 0.105, mz[2] + 0.19], [1.4, 0.8, 0.5]);
      b.add(h, new THREE.BoxGeometry(0.012, 0.05, 0.01), b.plastic(0x2a1a14), [0, mz[1] + 0.0, mz[2] + 0.165]);
      if (expr === 'happy') {
        b.sphere(h, 0.06, b.plastic(0x7a1a1a, 20), [0, mz[1] - 0.05, mz[2] + 0.13], [1.4, 0.8, 0.5]);
        b.sphere(h, 0.035, b.plastic(0xff6f80, 20), [0, mz[1] - 0.07, mz[2] + 0.145], [1.3, 0.6, 0.4]);
      } else if (expr === 'dizzy') {
        b.add(h, new THREE.TorusGeometry(0.025, 0.008, 6, 12), b.plastic(0x2a1a14), [0, mz[1] - 0.06, mz[2] + 0.145]);
      } else {
        for (const sd of [1, -1]) b.add(h, new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), b.plastic(0x2a1a14), [sd * 0.03, mz[1] - 0.03, mz[2] + 0.14], [0, 0, Math.PI]);
      }
      // olhos mais próximos e mais baixos, com sobrancelhas grossas e simpáticas
      eyes(b, h, R, ex({ yaw: 0.25, pitch: 0.06, size: 0.07 }));
      if (expr !== 'dizzy') for (const sd of [1, -1]) {
        const br = b.add(h, new THREE.CapsuleGeometry(0.018, 0.07, 4, 8), b.fur(0x4a2a14), surf(R * 1.0, sd * 0.25, 0.27));
        br.rotation.set(0.25, 0, Math.PI / 2 - sd * (expr === 'happy' ? 0.3 : 0.12));
      }
      cheeks(b, h, R * 1.05, 0xd9806a);
      // gorro de tricô com barra dobrada e pompom
      const cap = new THREE.Group(); cap.position.set(0, 0.25, -0.06); cap.rotation.x = -0.28; h.add(cap);
      b.add(cap, new THREE.SphereGeometry(0.44, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), b.fur(L.cap), [0, 0, 0], [0, 0, 0], [1.06, 0.95, 1.06]);
      b.add(cap, new THREE.TorusGeometry(0.43, 0.055, 8, 28), b.fur(0xe8e0d0), [0, 0.02, 0], [Math.PI / 2, 0, 0], [1.06, 1.06, 1]);
      b.sphere(cap, 0.1, b.fur(0xe8e0d0), [0, 0.43, 0]);
      break;
    }
    case 'rino': { // rinoceronte
      R = 0.42;
      b.sphere(h, R, fur, [0, 0, 0], [1, 0.95, 1.12]);
      b.sphere(h, 0.26, fur, [0, -0.13, 0.28], [1.1, 0.85, 1]); // focinho
      b.add(h, new THREE.ConeGeometry(0.1, 0.36, 12), b.plastic(0xf5f0e0, 30), [0, 0.12, 0.5], [0.55, 0, 0]);
      b.add(h, new THREE.ConeGeometry(0.06, 0.16, 12), b.plastic(0xf5f0e0, 30), [0, 0.18, 0.3], [0.35, 0, 0]);
      for (const s of [1, -1]) {
        b.add(h, new THREE.ConeGeometry(0.08, 0.2, 8), fur, [s * 0.27, 0.38, -0.08], [0, 0, -s * 0.4]);
        b.sphere(h, 0.03, b.plastic(0x333333), [s * 0.08, -0.12, 0.53]);
      }
      // óculos escuros
      for (const s of [1, -1]) b.rbox(h, 0.17, 0.1, 0.04, 0.02, b.plastic(0x111111, 140), [s * 0.13, 0.1, 0.4], [0, s * 0.25, 0]);
      b.add(h, new THREE.BoxGeometry(0.08, 0.025, 0.03), b.plastic(0x111111), [0, 0.11, 0.42]);
      if (expr !== 'normal') eyes(b, h, R, ex({ pitch: 0.12 }));
      mouth(b, h, R, ex({ pitch: -0.45, w: 0.1 }));
      break;
    }
    case 'juca': { // jacaré
      R = 0.4;
      b.sphere(h, R, fur, [0, 0, -0.02], [1.05, 0.9, 1]);
      const jaw = b.rbox(h, 0.46, 0.13, 0.62, 0.06, fur, [0, -0.17, 0.42], [expr === 'happy' ? 0.25 : 0.05, 0, 0]);
      b.rbox(h, 0.46, 0.13, 0.6, 0.06, fur, [0, -0.04, 0.42], [-0.05, 0, 0]);
      b.rbox(h, 0.4, 0.05, 0.55, 0.02, b.fur(0xf1e3a0), [0, -0.21, 0.42], [jaw.rotation.x, 0, 0]);
      for (let k = 0; k < 5; k++) for (const s of [1, -1]) b.add(h, new THREE.ConeGeometry(0.025, 0.06, 6), b.plastic(0xffffff), [s * 0.2, -0.12, 0.22 + k * 0.11], [Math.PI, 0, 0]);
      for (const s of [1, -1]) b.sphere(h, 0.03, b.plastic(0x1b3a12), [s * 0.08, 0.03, 0.7]);
      const eg = new THREE.Group(); eg.position.set(0, -0.02, 0); eg.scale.set(1.05, 0.9, 1); h.add(eg);
      eyes(b, eg, R, ex({ yaw: 0.36, pitch: 0.36, size: 0.072, lid: d.fur }));
      // quepe de capitão
      const cap = new THREE.Group(); cap.position.set(0, 0.24, -0.08); h.add(cap);
      b.add(cap, new THREE.CylinderGeometry(0.36, 0.33, 0.18, 24), b.plastic(0xffffff, 40), [0, 0.08, 0]);
      b.add(cap, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 24), b.plastic(L.cap, 40), [0, 0.0, 0]);
      b.rbox(cap, 0.42, 0.03, 0.2, 0.012, b.plastic(0x111111, 120), [0, -0.02, 0.33], [0.2, 0, 0]);
      b.sphere(cap, 0.06, b.metal(0xffc107), [0, 0.06, 0.34], [1, 1, 0.4]);
      // cachimbo de vapor no canto da boca, soltando fumacinha
      if (expr !== 'dizzy') {
        b.limb(h, V(0.18, -0.12, 0.62), V(0.32, -0.16, 0.78), 0.018, b.plastic(0x5a3a22, 30));
        b.add(h, new THREE.CylinderGeometry(0.05, 0.04, 0.1, 12), b.metal(0xc9a24a), [0.34, -0.11, 0.8]);
        for (const [y, r] of [[0.0, 0.04], [0.08, 0.05], [0.18, 0.06]]) b.sphere(h, r, b.mat('smk', () => new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })), [0.35 + y * 0.3, -0.02 + y, 0.8]);
      }
      break;
    }
  }
  return h;
}

// ------------------------------------------------------------------ kart
function gearGeo(R, T, depth = 0.05) {
  const sh = new THREE.Shape();
  for (let k = 0; k < T; k++) {
    const a = (k / T) * Math.PI * 2, st = (Math.PI * 2) / T, P = (aa, rr) => [Math.cos(aa) * rr, Math.sin(aa) * rr];
    if (!k) sh.moveTo(...P(a, R * 0.8)); else sh.lineTo(...P(a, R * 0.8));
    sh.lineTo(...P(a + st * 0.2, R)); sh.lineTo(...P(a + st * 0.5, R)); sh.lineTo(...P(a + st * 0.7, R * 0.8));
  }
  const h = new THREE.Path(); h.absarc(0, 0, R * 0.3, 0, Math.PI * 2, true); sh.holes.push(h);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -depth / 2);
  return g;
}

function clockFace() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f0dc'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill();
  g.fillStyle = '#3a2414';
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.fillRect(32 + Math.sin(a) * 25 - 2, 32 - Math.cos(a) * 25 - 2, 4, 4); }
  g.lineWidth = 4; g.strokeStyle = '#3a2414'; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 12); g.moveTo(32, 32); g.lineTo(46, 38); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// karts steampunk: chassi, banco de couro, volante de madeira e rodas raiadas de latão em todos;
// a carroceria muda com a identidade de cada piloto
function buildKart(b, d, root, steerAng) {
  const paint = b.plastic(d.kart, 70);
  const iron = b.plastic(0x2e2a28, 30), brass = b.metal(0xc9a24a), copper = b.metal(0xb8673a), wood = b.plastic(0x8a5a34, 15);
  const leather = b.plastic(0x5a3a22, 20), glow = b.mat('glow', () => new THREE.MeshBasicMaterial({ color: 0xffa040 }));
  const id = d.id;
  b.rbox(root, id === 'pipoca' ? 0.5 : 1.1, 0.1, 1.9, 0.04, iron, [0, 0.19, -0.05]);       // chassi
  b.rbox(root, 0.56, 0.5, 0.1, 0.05, leather, [0, 0.62, -0.62], [-0.25, 0, 0]);           // banco
  b.rbox(root, 0.56, 0.08, 0.42, 0.03, leather, [0, 0.33, -0.42]);
  // volante de madeira com raios de latão
  if (id !== 'pipoca') b.limb(root, V(0, 0.42, 0.55), V(0, 0.74, 0.26), 0.025, brass);
  const wheel = new THREE.Group(); wheel.position.set(0, 0.78, 0.22); wheel.rotation.x = -1.0; root.add(wheel);
  const wr = new THREE.Group(); wr.rotation.z = steerAng; wheel.add(wr);
  b.add(wr, new THREE.TorusGeometry(0.17, 0.03, 8, 24), wood);
  for (const a of [0, Math.PI / 2]) b.add(wr, new THREE.BoxGeometry(0.32, 0.025, 0.025), brass, [0, 0, 0], [0, 0, a]);
  b.add(wr, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), brass, [0, 0, 0.02], [Math.PI / 2, 0, 0]);
  // rodas raiadas
  const tire = b.plastic(0x1e1a18, 10);
  const wheelAt = (x, z, r, w, front) => {
    const piv = new THREE.Group(); piv.position.set(x, r, z); if (front) piv.rotation.y = steerAng * 0.5; root.add(piv);
    b.add(piv, new THREE.TorusGeometry(r - 0.06, 0.065, 8, 22), tire, [0, 0, 0], [0, Math.PI / 2, 0], [1, 1, w / 0.13]);
    b.add(piv, new THREE.CylinderGeometry(r * 0.26, r * 0.26, w + 0.04, 12), brass, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (let k = 0; k < 6; k++) b.add(piv, new THREE.BoxGeometry(0.03, (r - 0.08) * 2, 0.03), brass, [0, 0, 0], [(k / 6) * Math.PI, 0, 0]);
    if (id === 'tonho' && !front) for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.sphere(piv, 0.03, b.metal(), [0, Math.sin(a) * r, Math.cos(a) * r]); } // pneus com cravos
  };
  if (id !== 'tonho' && id !== 'pipoca') for (const s of [1, -1]) wheelAt(s * 0.64, 0.66, 0.23, 0.22, 1);
  if (id !== 'juca') for (const s of [1, -1]) wheelAt(s * 0.68, -0.72, 0.29, 0.3, 0);
  const boiler = (x, z, h = 0.34, chim = 0.32) => {
    b.add(root, new THREE.CylinderGeometry(0.17, 0.17, h, 14), copper, [x, 0.38 + h / 2, z]);
    for (const y of [0.42, 0.36 + h]) b.add(root, new THREE.CylinderGeometry(0.18, 0.18, 0.03, 14), brass, [x, y, z]);
    b.add(root, new THREE.CylinderGeometry(0.06, 0.05, chim, 10), iron, [x, 0.38 + h + chim / 2, z]);
  };
  const pontoons = (mat) => { for (const s of [1, -1]) b.rbox(root, 0.26, 0.24, 1.0, 0.09, mat, [s * 0.58, 0.33, -0.1]); };

  switch (id) {
    case 'pipoca': { // velocípede do correio: roda dianteira gigante, quadro de latão e alforjes de cartas
      const fw = new THREE.Group(); fw.position.set(0, 0.44, 1.04); fw.rotation.y = steerAng * 0.5; root.add(fw);
      b.add(fw, new THREE.TorusGeometry(0.4, 0.045, 8, 28), tire, [0, 0, 0], [0, Math.PI / 2, 0]);
      b.add(fw, new THREE.TorusGeometry(0.36, 0.015, 6, 28), brass, [0, 0, 0], [0, Math.PI / 2, 0]);
      for (let k = 0; k < 8; k++) b.add(fw, new THREE.BoxGeometry(0.015, 0.72, 0.015), brass, [0, 0, 0], [(k / 8) * Math.PI, 0, 0]);
      b.add(fw, new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12), brass, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (const sd of [1, -1]) b.limb(fw, V(sd * 0.09, 0, 0), V(sd * 0.09, 0.5, -0.12), 0.022, brass);  // garfo
      // cesto pequeno em cima da roda, com cartas
      const wicker = b.plastic(0xc8a060, 10);
      b.rbox(root, 0.36, 0.2, 0.28, 0.03, wicker, [0, 1.0, 0.96]);
      for (let k = -1; k <= 1; k++) b.add(root, new THREE.BoxGeometry(0.015, 0.2, 0.29), b.plastic(0x9a7a40, 10), [k * 0.12, 1.0, 0.96]);
      for (const [x, r] of [[-0.06, 0.15], [0.07, -0.2]]) b.rbox(root, 0.16, 0.12, 0.015, 0.005, b.plastic(0xf8f4ea, 10), [x, 1.14, 0.96], [0, 0, r]);
      // quadro fino pintado ligando a roda ao banco
      b.tube(root, [V(0, 0.9, 0.9), V(0, 0.5, 0.45), V(0, 0.32, -0.1), V(0, 0.36, -0.8)], 0.07, paint);
      b.rbox(root, 0.42, 0.2, 0.9, 0.08, paint, [0, 0.3, -0.45]);
      for (const sd of [1, -1]) {
        b.rbox(root, 0.2, 0.3, 0.42, 0.05, leather, [sd * 0.38, 0.52, -0.8]);                   // alforjes de cartas
        b.rbox(root, 0.21, 0.08, 0.43, 0.03, b.plastic(0x7a4a2a, 20), [sd * 0.38, 0.66, -0.8]);
        b.rbox(root, 0.015, 0.12, 0.18, 0.005, b.plastic(0xf8f4ea, 10), [sd * 0.38, 0.72, -0.72], [0, 0, sd * 0.15]);
      }
      b.sphere(root, 0.05, brass, [0.16, 0.86, 0.36], [1, 0.6, 1]);                             // campainha
      b.add(root, new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), brass, [0, 0.29, -0.72], [0, 0, Math.PI / 2]);  // eixo traseiro
      boiler(0, -1.12, 0.28, 0.26);
      break;
    }
    case 'tico': { // vitória-régia sobre rodas: folha redonda, para-lamas de cogumelo e uma estufa grande atrás
      const leaf = b.plastic(0x4f9a4a, 20);
      b.add(root, new THREE.CylinderGeometry(0.82, 0.78, 0.1, 32, 1, false, 0.25, Math.PI * 2 - 0.5), leaf, [0, 0.3, 0.05]);
      b.add(root, new THREE.TorusGeometry(0.8, 0.05, 6, 32, Math.PI * 2 - 0.5), b.plastic(0x7aba5a, 20), [0, 0.36, 0.05], [Math.PI / 2, 0, 0.25]);
      for (let k = 0; k < 8; k++) b.add(root, new THREE.BoxGeometry(0.02, 0.012, 0.7), b.plastic(0x7aba5a, 20), [Math.sin((k / 8) * 6.28) * 0.38, 0.36, 0.05 + Math.cos((k / 8) * 6.28) * 0.38], [0, (k / 8) * 6.28, 0]);
      // para-lamas: chapéus de cogumelo pintados sobre as quatro rodas
      for (const [x, z, r, c] of [[0.66, 0.66, 0.28, 0xe8541e], [-0.66, 0.66, 0.28, 0xe8541e], [0.7, -0.72, 0.36, 0xffc84a], [-0.7, -0.72, 0.36, 0xffc84a]]) {
        b.add(root, new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), b.plastic(c, 40), [x, r + 0.12, z], [0, 0, 0], [0.75, 0.75, 1]);
        for (const [yy, zz] of [[0.6, 0.4], [0.75, -0.3], [0.3, 0.75]]) b.sphere(root, r * 0.16, b.plastic(0xfff3c4, 30), [x + Math.sign(x) * r * 0.5 * 0.75 * Math.cos(yy), r + 0.12 + r * 0.75 * Math.sin(yy), z + zz * r * 0.6], [1, 1, 0.5]);
      }
      // estufa grande atrás do banco
      b.add(root, new THREE.CylinderGeometry(0.46, 0.48, 0.12, 20), brass, [0, 0.42, -1.0]);
      for (const [x, z, c, hh] of [[0.15, -0.92, 0xe8541e, 0.24], [-0.17, -1.05, 0xffc84a, 0.18], [0.04, -1.18, 0x8ad8ff, 0.3], [-0.05, -0.85, 0xffffff, 0.14]]) {
        b.add(root, new THREE.CylinderGeometry(0.03, 0.04, hh, 8), b.fur(0xf3e5c0), [x, 0.48 + hh / 2, z]);
        b.add(root, new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), b.mat('gl' + c, () => new THREE.MeshBasicMaterial({ color: c })), [x, 0.48 + hh, z]);
      }
      b.add(root, new THREE.SphereGeometry(0.46, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), b.mat('glass', () => new THREE.MeshPhongMaterial({ color: 0xcfefff, transparent: true, opacity: 0.32, shininess: 150, specular: 0xffffff })), [0, 0.48, -1.0], [0, 0, 0], [1, 1.15, 1]);
      for (let k = 0; k < 4; k++) b.add(root, new THREE.TorusGeometry(0.46, 0.012, 4, 20, Math.PI), brass, [0, 0.48, -1.0], [0, (k / 4) * Math.PI, 0], [1, 1.15, 1]);
      b.sphere(root, 0.05, brass, [0, 1.02, -1.0]);
      // regador de cobre na frente
      b.add(root, new THREE.CylinderGeometry(0.1, 0.12, 0.2, 12), copper, [0.3, 0.46, 0.75]);
      b.limb(root, V(0.38, 0.5, 0.8), V(0.52, 0.66, 1.0), 0.025, copper);
      break;
    }
    case 'mel': { // relógio de bolso gigante: caixa de latão em pé na frente, coroa em cima e chave de corda enorme atrás
      b.rbox(root, 0.7, 0.24, 1.5, 0.08, paint, [0, 0.32, -0.25]);
      const watch = new THREE.Group(); watch.position.set(0, 0.66, 1.0); watch.rotation.x = -0.15; root.add(watch);
      b.add(watch, new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32), brass, [0, 0, 0], [Math.PI / 2, 0, 0]);
      b.add(watch, new THREE.TorusGeometry(0.5, 0.05, 8, 32), b.metal(0xe0c070), [0, 0, 0.1]);
      b.add(watch, new THREE.CircleGeometry(0.44, 32), new THREE.MeshPhongMaterial({ map: clockFace(), shininess: 40 }), [0, 0, 0.105]);
      b.add(watch, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), brass, [0, 0.56, 0]);        // coroa
      b.add(watch, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), brass, [0, 0.64, 0]);
      b.add(watch, new THREE.TorusGeometry(0.12, 0.025, 6, 16), brass, [0, 0.78, 0], [Math.PI / 2, 0, 0]);
      for (const sd of [1, -1]) {
        b.add(root, gearGeo(0.26, 12), copper, [sd * 0.39, 0.42, -0.1], [0, Math.PI / 2, 0]);
        b.add(root, gearGeo(0.16, 9), brass, [sd * 0.39, 0.5, -0.5], [0, Math.PI / 2, 0.2]);
      }
      const key = new THREE.Group(); key.position.set(0, 0.75, -1.12); root.add(key);
      b.add(key, new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), brass, [0, -0.1, 0]);
      b.add(key, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), brass, [0, 0.1, 0]);
      for (const sd of [1, -1]) b.add(key, new THREE.TorusGeometry(0.17, 0.05, 8, 18), brass, [sd * 0.2, 0.3, 0], [0, 0, 0], [1, 0.8, 1]);
      break;
    }
    case 'faisca': { // mini-dirigível sobre rodas: casco de charuto, lemes e hélice
      b.sphere(root, 0.5, paint, [0, 0.42, 0.1], [1.15, 0.6, 2.2]);
      for (let k = -1; k <= 1; k++) b.add(root, new THREE.TorusGeometry(0.4 * Math.sqrt(1 - (k * 0.45) ** 2) + 0.12, 0.02, 4, 22), brass, [0, 0.42, 0.1 + k * 0.5], [0, 0, 0], [1.4, 0.75, 1]);
      b.add(root, new THREE.ConeGeometry(0.12, 0.22, 12), brass, [0, 0.42, 1.2], [Math.PI / 2, 0, 0]);
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) b.rbox(root, 0.03, 0.32, 0.36, 0.01, paint, [Math.sin(a) * 0.18, 0.5 + Math.cos(a) * 0.18, -1.0], [0, 0, a]);
      const prop = new THREE.Group(); prop.position.set(0, 0.5, -1.25); root.add(prop);
      b.sphere(prop, 0.06, brass, [0, 0, 0]);
      for (let k = 0; k < 3; k++) { const bl = new THREE.Group(); bl.rotation.z = (k / 3) * Math.PI * 2 + 0.3; prop.add(bl); b.rbox(bl, 0.07, 0.36, 0.02, 0.01, wood, [0, 0.18, 0], [0, 0.3, 0]); }
      break;
    }
    case 'bento': { // locomotiva: caldeira deitada, chaminé de funil, limpa-trilhos e sino
      pontoons(paint);
      b.add(root, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 18), paint, [0, 0.5, 0.62], [Math.PI / 2, 0, 0]);
      for (const z of [0.3, 0.62, 0.94]) b.add(root, new THREE.CylinderGeometry(0.31, 0.31, 0.04, 18), brass, [0, 0.5, z], [Math.PI / 2, 0, 0]);
      b.add(root, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 18), iron, [0, 0.5, 1.08], [Math.PI / 2, 0, 0]);
      b.sphere(root, 0.08, glow, [0, 0.6, 1.11], [1, 1, 0.4]);                              // farol
      b.add(root, new THREE.CylinderGeometry(0.08, 0.07, 0.25, 10), iron, [0, 0.9, 0.86]);
      b.add(root, new THREE.CylinderGeometry(0.18, 0.08, 0.2, 14), iron, [0, 1.1, 0.86]);   // chaminé de funil
      b.add(root, new THREE.CylinderGeometry(0.06, 0.08, 0.1, 10), brass, [0, 0.85, 0.48]); // domo de vapor
      b.add(root, new THREE.ConeGeometry(0.07, 0.1, 10, 1, true), brass, [0.2, 0.86, 0.5]);  // sino
      for (let k = -3; k <= 3; k++) b.add(root, new THREE.BoxGeometry(0.03, 0.03, 0.4), b.plastic(0x8a1a1a, 30), [k * 0.1, 0.2, 1.28], [0.6, k * 0.12, 0]); // limpa-trilhos
      break;
    }
    case 'tonho': { // trenó de gelo: esquis na frente, lâmina de neve e caixote de gelo atrás
      const plank = b.plastic(0x9a6a3a, 15);
      for (let k = -2; k <= 2; k++) b.rbox(root, 0.2, 0.08, 1.4, 0.02, plank, [k * 0.21, 0.32, 0.25]);
      for (const s of [1, -1]) {
        b.rbox(root, 0.14, 0.05, 0.9, 0.02, b.metal(0xa8b0b8), [s * 0.58, 0.06, 0.66]);
        b.tube(root, [V(s * 0.58, 0.06, 1.1), V(s * 0.58, 0.14, 1.22), V(s * 0.58, 0.28, 1.24)], 0.04, b.metal(0xa8b0b8));
        b.limb(root, V(s * 0.58, 0.08, 0.66), V(s * 0.4, 0.32, 0.6), 0.035, iron);
      }
      b.rbox(root, 1.1, 0.26, 0.06, 0.02, copper, [0, 0.3, 1.32], [0.5, 0, 0]);             // lâmina de neve
      b.rbox(root, 0.7, 0.34, 0.5, 0.03, plank, [0, 0.52, -0.95]);
      const ice = b.mat('ice', () => new THREE.MeshPhongMaterial({ color: 0xa8dcf4, transparent: true, opacity: 0.85, shininess: 140 }));
      for (const [x, z] of [[-0.16, -0.9], [0.16, -1.0], [0, -0.92]]) b.rbox(root, 0.26, 0.22, 0.22, 0.02, ice, [x, 0.8 + (x === 0 ? 0.18 : 0), z]);
      break;
    }
    case 'rino': { // fornalha blindada: chapas rebitadas, grade em brasa e duas chaminés
      const plate = b.plastic(d.kart, 40);
      b.rbox(root, 1.2, 0.42, 1.9, 0.06, plate, [0, 0.4, 0.0]);
      for (const s of [1, -1]) for (let k = 0; k < 7; k++) b.sphere(root, 0.025, brass, [s * 0.605, 0.55, -0.8 + k * 0.27]);
      b.rbox(root, 0.8, 0.34, 0.08, 0.02, iron, [0, 0.48, 0.98]);
      for (let k = -3; k <= 3; k++) b.add(root, new THREE.BoxGeometry(0.06, 0.26, 0.02), glow, [k * 0.1, 0.48, 1.03]);
      for (const s of [1, -1]) {
        b.add(root, new THREE.CylinderGeometry(0.1, 0.12, 0.7, 12), iron, [s * 0.3, 0.9, -1.0]);
        b.add(root, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), brass, [s * 0.3, 1.25, -1.0]);
      }
      break;
    }
    case 'juca': { // barco a vapor: casco com proa, vigias, rodas de pás atrás e boia
      b.rbox(root, 1.06, 0.44, 1.6, 0.12, paint, [0, 0.42, -0.1]);
      b.add(root, new THREE.ConeGeometry(0.53, 0.8, 4, 1), paint, [0, 0.42, 1.08], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.83]);
      b.rbox(root, 1.08, 0.06, 1.62, 0.02, b.plastic(0xf8f4ea, 20), [0, 0.6, -0.1]);
      for (const s of [1, -1]) for (const z of [0.3, -0.1]) {
        b.add(root, new THREE.TorusGeometry(0.07, 0.02, 6, 14), brass, [s * 0.535, 0.42, z], [0, Math.PI / 2, 0]);
        b.add(root, new THREE.CircleGeometry(0.06, 14), b.plastic(0x9fd8e8, 140), [s * 0.536, 0.42, z], [0, s * Math.PI / 2, 0]);
      }
      for (const s of [1, -1]) {
        const pw = new THREE.Group(); pw.position.set(s * 0.68, 0.34, -0.78); root.add(pw);
        b.add(pw, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 18), wood, [0, 0, 0], [0, 0, Math.PI / 2]);
        for (let k = 0; k < 8; k++) b.add(pw, new THREE.BoxGeometry(0.24, 0.06, 0.18), b.plastic(0x8a1a1a, 30), [0, Math.sin((k / 8) * Math.PI * 2) * 0.28, Math.cos((k / 8) * Math.PI * 2) * 0.28], [(k / 8) * Math.PI * 2, 0, 0]);
        b.add(pw, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 18, 1, true, -Math.PI / 2, Math.PI), brass, [0, 0.02, 0], [0, 0, Math.PI / 2]);
      }
      b.add(root, new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), b.plastic(0x1a1a1a, 30), [0, 1.0, -1.02]);
      b.add(root, new THREE.CylinderGeometry(0.125, 0.125, 0.12, 12), b.plastic(0xc0392b, 30), [0, 1.18, -1.02]);
      const ring = b.add(root, new THREE.TorusGeometry(0.15, 0.05, 8, 16), b.plastic(0xf8f4ea, 30), [0.54, 0.5, 0.75], [0, Math.PI / 2, 0]);
      for (let k = 0; k < 4; k++) b.add(root, new THREE.TorusGeometry(0.15, 0.052, 8, 3, 0.35), b.plastic(0xc0392b, 30), [0.54, 0.5, 0.75], [0, Math.PI / 2, (k / 4) * Math.PI * 2]);
      void ring;
      break;
    }
  }
  return wheel;
}

// ------------------------------------------------------------------ roupa e acessórios (identidade de cada um)
function outfit(b, d, dr, k, L) {
  const brass = b.metal(0xc9a24a), leather = b.plastic(0x6b4426, 25);
  const fz = 0.17 * k + 0.03;                 // frente do peito
  const chest = (x, y, z = 0) => [x, y, fz + z + (0.45 - y) * 0.14];
  const buttons = (xs, ys, r = 0.022) => { for (const x of xs) for (const y of ys) b.sphere(dr, r, brass, chest(x, y, 0.01)); };
  switch (d.id) {
    case 'pipoca': {
      buttons([0.05], [0.28, 0.38, 0.48]);
      // bolsa de cartas a tiracolo
      b.tube(dr, [V(-0.2 * k, 0.6, 0.02), V(0, 0.42, fz + 0.03), V(0.2 * k, 0.22, fz - 0.02), V(0.27 * k, 0.14, 0.02)], 0.022, leather);
      b.rbox(dr, 0.08, 0.2, 0.24, 0.03, leather, [0.27 * k, 0.12, 0.0]);
      for (const [y, z] of [[0.25, -0.04], [0.24, 0.04]]) b.rbox(dr, 0.012, 0.1, 0.14, 0.005, b.plastic(0xf8f4ea, 10), [0.27 * k, y, z], [0, 0, 0.1]);
      break;
    }
    case 'tico': {
      // avental verde de botânico, com lupa e uma muda no bolso
      b.rbox(dr, 0.3 * k, 0.42, 0.03, 0.02, b.fur(0x4a7a3a), chest(0, 0.3), [0.14, 0, 0]);
      b.rbox(dr, 0.14, 0.09, 0.02, 0.01, b.fur(0x3a6a2a), chest(0.06, 0.24, 0.02), [0.14, 0, 0]);
      b.limb(dr, V(0.04, 0.26, fz + 0.05), V(0.04, 0.36, fz + 0.06), 0.012, brass);
      b.add(dr, new THREE.TorusGeometry(0.035, 0.008, 6, 14), brass, [0.04, 0.39, fz + 0.06]);
      b.add(dr, new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), b.fur(0xf3e5c0), [0.1, 0.32, fz + 0.04]);
      b.add(dr, new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), b.plastic(0xffc84a, 40), [0.1, 0.36, fz + 0.04]);
      break;
    }
    case 'mel': {
      // avental de couro de relojoeira com ferramentas
      b.rbox(dr, 0.32 * k, 0.44, 0.03, 0.02, b.plastic(0x7a4a2a, 25), chest(0, 0.3), [0.14, 0, 0]);
      for (const x of [-0.06, 0, 0.06]) b.add(dr, new THREE.CylinderGeometry(0.01, 0.01, 0.09, 6), brass, chest(x, 0.4, 0.03));
      b.add(dr, new THREE.TorusGeometry(0.05, 0.01, 6, 16), brass, chest(-0.06, 0.22, 0.03));
      break;
    }
    case 'faisca': {
      // jaqueta de couro de aviador com gola de lã e ponta do cachecol voando
      b.add(dr, new THREE.TorusGeometry(0.17, 0.05, 8, 20), b.fur(0xf0e6d0), [0, 0.6, 0.0], [Math.PI / 2 + 0.15, 0, 0]);
      b.limb(dr, V(0, 0.5, fz + 0.02), V(0.0, 0.18, fz + 0.04), 0.008, b.plastic(0x3a2414));
      buttons([-0.07, 0.07], [0.42]);
      b.limb(dr, V(0.12, 0.66, -0.12), V(0.36, 0.62, -0.42), 0.035, b.fur(L.scarf));
      break;
    }
    case 'bento': {
      // macacão de foguista com peitilho, alças e manchas de fuligem
      b.rbox(dr, 0.26 * k, 0.22, 0.03, 0.02, b.fur(0x2e4a74), chest(0, 0.34), [0.14, 0, 0]);
      buttons([-0.09, 0.09], [0.44], 0.026);
      for (const x of [-0.09, 0.09]) b.limb(dr, V(x, 0.46, fz), V(x * 1.4, 0.6, 0.0), 0.016, b.fur(0x2e4a74));
      for (const [x, y] of [[0.06, 0.3], [-0.05, 0.22]]) b.sphere(dr, 0.03, b.mat('soot', () => new THREE.MeshPhongMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.5 })), chest(x, y, 0.02), [1, 0.7, 0.3]);
      break;
    }
    case 'tonho': {
      // suspensórios e serrote de cortar gelo nas costas
      for (const x of [-0.1, 0.1]) b.limb(dr, V(x * k, 0.62, 0.02), V(x * k, 0.12, fz - 0.02), 0.022, b.plastic(0x2a1a10, 20));
      for (const x of [-0.1, 0.1]) b.sphere(dr, 0.025, brass, chest(x * k, 0.2, 0.02));
      const saw = new THREE.Group(); saw.position.set(0, 0.45, -0.28 * k); saw.rotation.z = 0.7; dr.add(saw);
      b.add(saw, new THREE.BoxGeometry(0.75, 0.13, 0.015), b.metal(0xc8ccd0), [0, 0, 0]);
      for (let t = 0; t < 12; t++) b.add(saw, new THREE.ConeGeometry(0.02, 0.04, 3), b.metal(0xc8ccd0), [-0.34 + t * 0.06, -0.08, 0], [Math.PI, 0, 0]);
      b.rbox(saw, 0.16, 0.15, 0.05, 0.02, b.plastic(0x8a5a34, 20), [0.45, 0.02, 0]);
      break;
    }
    case 'rino': {
      // colete, gravata-borboleta e corrente do relógio de bolso
      const vest = b.fur(L.vest);
      for (const sd of [1, -1]) b.rbox(dr, 0.16 * k, 0.4, 0.04, 0.03, vest, chest(sd * 0.11 * k, 0.33, -0.005), [0.14, sd * 0.25, 0]);
      buttons([-0.05], [0.24, 0.32, 0.4], 0.02);
      for (const sd of [1, -1]) b.add(dr, new THREE.ConeGeometry(0.05, 0.1, 8), b.plastic(0x8a1a1a, 40), [sd * 0.05, 0.6, fz + 0.03], [0, 0, sd * Math.PI / 2]);
      b.sphere(dr, 0.025, b.plastic(0x8a1a1a, 40), [0, 0.6, fz + 0.04]);
      b.tube(dr, [V(-0.05, 0.3, fz + 0.04), V(0.05, 0.24, fz + 0.05), V(0.14, 0.27, fz + 0.03)], 0.008, b.metal(0xffc107));
      b.add(dr, new THREE.CylinderGeometry(0.035, 0.035, 0.015, 14), b.metal(0xffc107), [0.15, 0.25, fz + 0.03], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'juca': {
      // casaca de capitão: duas fileiras de botões e dragonas douradas
      buttons([-0.08, 0.08], [0.24, 0.34, 0.44], 0.025);
      for (const sd of [1, -1]) {
        b.sphere(dr, 0.1, b.metal(0xffc107), [sd * 0.27 * k, 0.6, -0.02], [1, 0.35, 0.9]);
        for (let t = 0; t < 5; t++) b.add(dr, new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4), b.metal(0xffc107), [sd * (0.33 * k + 0.02), 0.55, -0.08 + t * 0.04]);
      }
      break;
    }
  }
}

// ------------------------------------------------------------------ piloto completo numa pose
export function buildDriverModel(d, pose = 0) {
  const b = new B();
  const root = new THREE.Group();
  const L = LOOK[d.id];
  const heavy = d.cls === 'pesado' ? 1.18 : d.cls === 'leve' ? 0.94 : 1;
  const lean = pose === 1 ? 1 : pose === 2 ? -1 : 0;
  const expr = pose === 3 ? 'happy' : pose === 4 ? 'dizzy' : 'normal';
  const steerAng = lean * 0.6;

  buildKart(b, d, root, steerAng);

  const driver = new THREE.Group();
  driver.position.set(0, 0.6, -0.36);
  driver.rotation.z = lean * 0.17 + (pose === 4 ? 0.28 : 0);
  root.add(driver);
  const shirt = b.fur(L.shirt), fur = b.fur(d.fur), glove = b.plastic(L.glove, 30), shoe = b.plastic(L.shoe, 50);
  const W = (x, y, z) => V(x, y - 0.6, z + 0.36); // coordenadas do kart -> do piloto

  // pernas (sentado, joelhos para cima)
  for (const s of [1, -1]) {
    const hip = W(s * 0.13 * heavy, 0.62, -0.32), knee = W(s * 0.21 * heavy, 0.8, 0.12), foot = W(s * 0.17, 0.46, 0.52);
    b.limb(driver, hip, knee, 0.085 * heavy, shirt);
    b.limb(driver, knee, foot, 0.075 * heavy, shirt);
    b.sphere(driver, 0.09, shoe, [foot.x, foot.y - 0.02, foot.z + 0.05], [1, 0.75, 1.5]);
  }
  // tronco
  const torso = b.add(driver, new THREE.CapsuleGeometry(0.22 * heavy, 0.26, 8, 16), shirt, [0, 0.38, -0.02], [0.14, 0, 0], [1, 1, 0.85]);
  b.sphere(driver, 0.2 * heavy, shirt, [0, 0.2, 0.02], [1.05, 0.8, 0.95]);
  if (L.scarf) b.add(driver, new THREE.TorusGeometry(0.16, 0.06, 8, 20), b.fur(L.scarf), [0, 0.68, 0.02], [Math.PI / 2 + 0.2, 0, 0]);
  if (d.id === 'juca') b.add(driver, new THREE.TorusGeometry(0.17, 0.025, 6, 20), b.metal(0xffc107), [0, 0.62, 0.06], [Math.PI / 2 + 0.5, 0, 0]);
  outfit(b, d, driver, heavy, L);

  // braços: mãos no volante (ou para cima / balançando)
  const wc = V(0, 0.78, 0.22);
  for (const s of [1, -1]) {
    const sh = W(s * 0.26 * heavy, 1.1, -0.36);
    let hand, elbow;
    if (pose === 3) { hand = W(s * 0.42, 1.78, -0.22); elbow = W(s * 0.46, 1.42, -0.32); }
    else if (pose === 4) { hand = W(s * 0.62, 1.22, -0.12); elbow = W(s * 0.48, 1.08, -0.34); }
    else {
      const a = s * 0.0 + Math.PI / 2 - s * 1.15 + lean * 0.6 * 0; // ângulo no aro
      const ang = (s > 0 ? 0.25 : Math.PI - 0.25) + steerAng;
      hand = V(wc.x + Math.cos(ang) * 0.17, wc.y + Math.sin(ang) * 0.1, wc.z - Math.sin(ang) * 0.05);
      hand = W(hand.x, hand.y, hand.z);
      elbow = W(s * 0.36 * heavy, 0.86, -0.12);
      void a;
    }
    b.limb(driver, sh, elbow, 0.075 * heavy, d.cls === 'pesado' && d.id !== 'juca' ? fur : shirt);
    b.limb(driver, elbow, hand, 0.065 * heavy, fur);
    b.sphere(driver, 0.085, glove, [hand.x, hand.y, hand.z]);
  }
  // pescoço e cabeça (cabeça grande, estilo "chibi")
  b.add(driver, new THREE.CylinderGeometry(0.09, 0.11, 0.14, 12), fur, [0, 0.66, 0.02]);
  const head = buildHead(b, d, expr);
  head.position.set(0, 0.9, 0.06);
  head.rotation.y = lean * 0.4;
  if (pose === 3) head.rotation.x = -0.15;
  if (pose === 4) { head.rotation.z = 0.3; head.rotation.x = 0.1; }
  driver.add(head);
  void torso;

  root.userData.dispose = () => {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    b.cache.forEach((m) => { m.map?.dispose(); m.dispose(); });
  };
  return root;
}

// ------------------------------------------------------------------ fotografar
export function bakeDriver(d) {
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x50505a, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.5, 4, -4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.9); fill.position.set(-3, 1.5, -2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(0, 3, 5); scene.add(rim);

  const cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 50);
  const elev = 0.26;
  cam.position.set(0, CY + Math.sin(elev) * 10, -Math.cos(elev) * 10);
  cam.lookAt(0, CY, 0);

  const atlas = document.createElement('canvas');
  atlas.width = CELL * FRAMES;
  atlas.height = CELL * POSES;
  const g = atlas.getContext('2d');
  let portrait = null;

  for (let pose = 0; pose < POSES; pose++) {
    const model = buildDriverModel(d, pose);
    scene.add(model);
    for (let f = 0; f < FRAMES; f++) {
      model.rotation.y = (f / FRAMES) * Math.PI * 2;
      r.render(scene, cam);
      g.drawImage(r.domElement, f * CELL, pose * CELL);
    }
    if (pose === 0) {
      // retrato de frente
      model.rotation.y = Math.PI;
      const pc = new THREE.OrthographicCamera(-0.66, 0.66, 0.66, -0.66, 0.1, 50);
      pc.position.set(0, 1.6, -10);
      pc.lookAt(0, 1.55, 0);
      r.render(scene, pc);
      const c = document.createElement('canvas');
      c.width = c.height = CELL;
      c.getContext('2d').drawImage(r.domElement, 0, 0);
      portrait = c.toDataURL();
    }
    scene.remove(model);
    model.userData.dispose();
  }
  return { atlas, portrait };
}
