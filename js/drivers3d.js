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
  pipoca: { shirt: 0xff9cc8, shoe: 0xffffff, glove: 0xffffff },
  tico:   { shirt: 0xffe082, shoe: 0x8d6e63, glove: 0xffffff, cap: 0xe8541e, spots: 0xfff3c4 },
  mel:    { shirt: 0xfff176, shoe: 0xff8a65, glove: 0xffffff },
  faisca: { shirt: 0x37474f, shoe: 0x212121, glove: 0x212121, scarf: 0xe53935 },
  bento:  { shirt: 0xffffff, shoe: 0x5d4037, glove: 0xffffff, scarf: 0x1565c0 },
  tonho:  { shirt: 0xffa726, shoe: 0x3e2723, glove: 0xffffff, cap: 0x2e7d32 },
  rino:   { shirt: 0x263238, shoe: 0x111111, glove: 0x111111 },
  juca:   { shirt: 0xffffff, shoe: 0x3e2723, glove: 0xffffff, cap: 0x1a237e },
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
function eyes(b, head, R, { yaw = 0.32, pitch = 0.12, size = 0.085, expr = 'normal', pupil = 0x1a1a1a } = {}) {
  for (const s of [1, -1]) {
    const p = surf(R * 0.96, s * yaw, pitch);
    if (expr === 'happy') {
      const arc = b.add(head, new THREE.TorusGeometry(size * 0.8, size * 0.22, 6, 14, Math.PI), b.plastic(0x1a1a1a), p, [0, s * yaw, 0]);
      arc.position.z += 0.02;
    } else if (expr === 'dizzy') {
      for (const a of [0.8, -0.8]) b.add(head, new THREE.BoxGeometry(size * 1.8, size * 0.35, 0.03), b.plastic(0x1a1a1a), [p[0], p[1], p[2] + 0.03], [0, s * yaw, a]);
    } else {
      const w = b.sphere(head, size, b.plastic(0xffffff, 80), p, [1, 1.25, 0.6]);
      w.rotation.y = s * yaw;
      const pp = surf(R * 0.96 + size * 0.42, s * yaw * 0.92, pitch);
      b.sphere(head, size * 0.58, b.plastic(pupil, 90), pp, [1, 1.2, 0.6]);
      const hl = surf(R * 0.96 + size * 0.62, s * yaw * 0.85, pitch + 0.07);
      b.sphere(head, size * 0.2, b.plastic(0xffffff, 10), hl);
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
      b.sphere(h, R, fur, [0, 0, 0], [1, 0.95, 0.95]);
      for (const s of [1, -1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.15, 0.32, -0.05);
        ear.rotation.set(-0.15, 0, -s * (expr === 'dizzy' ? 0.9 : 0.18));
        h.add(ear);
        b.add(ear, new THREE.CapsuleGeometry(0.095, 0.48, 6, 12), fur, [0, 0.3, 0], [0, 0, 0], [1, 1, 0.6]);
        b.add(ear, new THREE.CapsuleGeometry(0.055, 0.4, 6, 12), b.fur(0xffb3cf), [0, 0.3, 0.04], [0, 0, 0], [1, 1, 0.4]);
      }
      // laço
      for (const s of [1, -1]) b.sphere(h, 0.08, b.plastic(0xff3f8e), [0.2 + s * 0.08, 0.36, 0.05], [1, 0.6, 0.5]);
      b.sphere(h, 0.045, b.plastic(0xff3f8e), [0.2, 0.36, 0.06]);
      b.sphere(h, 0.17, b.fur(0xffffff), surf(R * 0.78, 0, -0.22), [1.2, 0.8, 0.8]);
      b.sphere(h, 0.045, b.plastic(0xff6f9a), surf(R * 0.98, 0, -0.08), [1.3, 1, 1]);
      b.add(h, new THREE.BoxGeometry(0.07, 0.07, 0.03), b.plastic(0xffffff), surf(R * 0.93, 0, -0.36));
      eyes(b, h, R, ex({ pupil: 0xd81b60 }));
      mouth(b, h, R, ex({ pitch: -0.3, w: 0.08 }));
      cheeks(b, h, R);
      break;
    }
    case 'tico': { // sapo + cogumelo
      R = 0.41;
      b.sphere(h, R, fur, [0, -0.04, 0], [1.15, 0.82, 1]);
      b.sphere(h, 0.3, b.fur(0xe9f5c9), [0, -0.12, 0.13], [1.15, 0.55, 0.8]); // queixo claro
      // olhos saltados
      for (const s of [1, -1]) {
        b.sphere(h, 0.15, fur, [s * 0.2, 0.2, 0.17]);
      }
      const eg = new THREE.Group(); eg.position.set(0, 0.14, 0.08); h.add(eg);
      eyes(b, eg, 0.28, ex({ yaw: 0.62, pitch: 0.28, size: 0.1 }));
      mouth(b, h, R, ex({ pitch: -0.25, w: expr === 'happy' ? 0.14 : 0.22 }));
      cheeks(b, h, R, 0xff7aa0);
      // chapéu de cogumelo: aba larga com pintas
      const cap = new THREE.Group(); cap.position.set(0, 0.2, -0.04); cap.rotation.x = -0.12;
      if (expr === 'dizzy') cap.rotation.z = 0.25;
      h.add(cap);
      b.add(cap, new THREE.SphereGeometry(0.58, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), b.plastic(L.cap, 40), [0, 0, 0], [0, 0, 0], [1, 0.72, 1]);
      b.add(cap, new THREE.CylinderGeometry(0.58, 0.5, 0.06, 32), b.fur(0xf3e5c0), [0, -0.02, 0]);
      for (const [yaw, pitch, r] of [[0, 0.5, 0.11], [1.2, 0.35, 0.09], [-1.2, 0.35, 0.09], [2.3, 0.4, 0.1], [-2.3, 0.4, 0.1], [3.14, 0.5, 0.1], [0.6, 1.05, 0.08], [-0.6, 1.05, 0.08], [2.2, 1.0, 0.08], [-2.2, 1.0, 0.08], [0, 1.4, 0.09]]) {
        const p = surf(0.585, yaw, pitch);
        const sp = b.sphere(cap, r, b.plastic(L.spots, 30), [p[0], p[1] * 0.72, p[2]], [1, 0.45, 1]);
        sp.lookAt(sp.position.clone().multiplyScalar(2));
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
      eyes(b, h, R, ex({ pupil: 0x2e7d32 }));
      mouth(b, h, R, ex({ pitch: -0.34, w: 0.06 }));
      cheeks(b, h, R);
      // flor no cabelo
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; b.sphere(h, 0.055, b.plastic(0xffffff), [-0.24 + Math.cos(a) * 0.06, 0.3 + Math.sin(a) * 0.06, 0.18], [1, 1, 0.5]); }
      b.sphere(h, 0.04, b.plastic(0xffc107), [-0.24, 0.3, 0.21]);
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
      eyes(b, h, R, ex({ pupil: 0x6d4c41, size: 0.08 }));
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
      break;
    }
    case 'tonho': { // urso
      R = 0.43;
      b.sphere(h, R, fur, [0, 0, 0], [1.08, 0.96, 0.96]);
      for (const s of [1, -1]) { b.sphere(h, 0.13, fur, [s * 0.32, 0.3, -0.04]); b.sphere(h, 0.07, b.fur(0xd7a979), [s * 0.32, 0.3, 0.03], [1, 1, 0.5]); }
      b.sphere(h, 0.2, b.fur(0xd7a979), surf(R * 0.8, 0, -0.28), [1.15, 0.8, 0.95]);
      b.sphere(h, 0.075, b.plastic(0x111111, 100), surf(R * 1.02, 0, -0.14), [1.4, 0.9, 1]);
      eyes(b, h, R, ex({ pitch: 0.12, size: 0.075 }));
      mouth(b, h, R, ex({ pitch: -0.4, w: 0.08 }));
      // boné virado para trás
      const cap = new THREE.Group(); cap.position.set(0, 0.17, -0.02); cap.rotation.x = -0.15; h.add(cap);
      b.add(cap, new THREE.SphereGeometry(0.43, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), b.plastic(L.cap, 30), [0, 0, 0], [0, 0, 0], [1.05, 0.75, 1.05]);
      b.rbox(cap, 0.36, 0.035, 0.3, 0.015, b.plastic(L.cap, 30), [0, 0.03, -0.5], [0.15, 0, 0]);
      b.sphere(cap, 0.04, b.plastic(0xffffff), [0, 0.31, 0]);
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
      for (const s of [1, -1]) { b.sphere(h, 0.03, b.plastic(0x1b3a12), [s * 0.08, 0.03, 0.7]); b.sphere(h, 0.12, fur, [s * 0.17, 0.25, 0.14]); }
      const eg = new THREE.Group(); eg.position.set(0, 0.2, 0.02); h.add(eg);
      eyes(b, eg, 0.27, ex({ yaw: 0.6, pitch: 0.2, size: 0.085, pupil: 0x8a6d00 }));
      // quepe de capitão
      const cap = new THREE.Group(); cap.position.set(0, 0.24, -0.08); h.add(cap);
      b.add(cap, new THREE.CylinderGeometry(0.36, 0.33, 0.18, 24), b.plastic(0xffffff, 40), [0, 0.08, 0]);
      b.add(cap, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 24), b.plastic(L.cap, 40), [0, 0.0, 0]);
      b.rbox(cap, 0.42, 0.03, 0.2, 0.012, b.plastic(0x111111, 120), [0, -0.02, 0.33], [0.2, 0, 0]);
      b.sphere(cap, 0.06, b.metal(0xffc107), [0, 0.06, 0.34], [1, 1, 0.4]);
      break;
    }
  }
  return h;
}

// ------------------------------------------------------------------ kart
function emblem(d) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#' + new THREE.Color(d.kart).getHexString(); g.lineWidth = 6; g.stroke();
  g.fillStyle = '#222'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(d.name[0], 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildKart(b, d, root, steerAng) {
  const paint = b.plastic(d.kart, 90);
  const dark = b.plastic(0x2b2b2e, 30);
  const chrome = b.metal();
  b.rbox(root, 1.12, 0.1, 1.9, 0.04, dark, [0, 0.19, -0.05]);                        // chassi
  b.rbox(root, 0.92, 0.26, 0.8, 0.1, paint, [0, 0.36, 0.72], [0.14, 0, 0]);         // bico
  b.sphere(root, 0.3, paint, [0, 0.3, 1.05], [1.45, 0.48, 0.75]);
  for (const s of [1, -1]) b.rbox(root, 0.28, 0.26, 1.05, 0.1, paint, [s * 0.6, 0.33, -0.1]); // pontões
  b.rbox(root, 0.72, 0.36, 0.08, 0.04, paint, [0, 0.55, 0.38], [-0.45, 0, 0]);       // carenagem frontal
  const em = b.add(root, new THREE.CircleGeometry(0.13, 24), new THREE.MeshPhongMaterial({ map: emblem(d), shininess: 40 }), [0, 0.58, 0.43], [-0.45, 0, 0]);
  em.material.map.needsUpdate = true;
  b.rbox(root, 0.56, 0.5, 0.1, 0.05, dark, [0, 0.62, -0.62], [-0.25, 0, 0]);         // banco
  b.rbox(root, 0.56, 0.08, 0.42, 0.03, dark, [0, 0.33, -0.42]);
  // volante
  const col = b.limb(root, V(0, 0.42, 0.55), V(0, 0.74, 0.26), 0.025, chrome);
  const wheel = new THREE.Group(); wheel.position.set(0, 0.78, 0.22); wheel.rotation.x = -1.0; root.add(wheel);
  const wr = new THREE.Group(); wr.rotation.z = steerAng; wheel.add(wr);
  b.add(wr, new THREE.TorusGeometry(0.17, 0.032, 8, 24), dark);
  b.add(wr, new THREE.BoxGeometry(0.32, 0.035, 0.03), dark);
  b.add(wr, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), paint, [0, 0, 0.02], [Math.PI / 2, 0, 0]);
  // para-choques
  b.tube(root, [V(-0.62, 0.24, 0.98), V(-0.35, 0.22, 1.28), V(0.35, 0.22, 1.28), V(0.62, 0.24, 0.98)], 0.035, chrome);
  b.tube(root, [V(-0.72, 0.3, -1.12), V(-0.3, 0.3, -1.24), V(0.3, 0.3, -1.24), V(0.72, 0.3, -1.12)], 0.035, chrome);
  // motor e escapamento
  b.rbox(root, 0.36, 0.3, 0.34, 0.05, b.metal(0x9aa3ad), [0.28, 0.42, -0.88]);
  b.add(root, new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), b.metal(0x7b858f), [0.28, 0.64, -0.88]);
  b.tube(root, [V(0.12, 0.42, -0.9), V(-0.15, 0.42, -1.0), V(-0.3, 0.5, -1.15), V(-0.32, 0.72, -1.2)], 0.04, chrome);
  b.add(root, new THREE.CylinderGeometry(0.07, 0.055, 0.2, 12), chrome, [-0.32, 0.8, -1.2]);
  // aerofólio
  b.rbox(root, 1.2, 0.06, 0.28, 0.025, paint, [0, 0.98, -1.1], [-0.12, 0, 0]);
  for (const s of [1, -1]) b.rbox(root, 0.05, 0.42, 0.12, 0.02, dark, [s * 0.42, 0.77, -1.08]);
  // rodas
  const tire = b.plastic(0x1b1b1b, 10);
  for (const [x, z, r, w, front] of [[0.64, 0.66, 0.23, 0.26, 1], [-0.64, 0.66, 0.23, 0.26, 1], [0.68, -0.72, 0.29, 0.36, 0], [-0.68, -0.72, 0.29, 0.36, 0]]) {
    const piv = new THREE.Group(); piv.position.set(x, r, z); if (front) piv.rotation.y = steerAng * 0.5; root.add(piv);
    b.add(piv, new THREE.CylinderGeometry(r, r, w, 22), tire, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (const s of [1, -1]) b.add(piv, new THREE.TorusGeometry(r - 0.045, 0.045, 8, 22), tire, [s * w / 2, 0, 0], [0, Math.PI / 2, 0]);
    b.add(piv, new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.02, 16), chrome, [0, 0, 0], [0, 0, Math.PI / 2]);
    b.add(piv, new THREE.CylinderGeometry(r * 0.25, r * 0.25, w + 0.05, 10), paint, [0, 0, 0], [0, 0, Math.PI / 2]);
  }
  return wheel;
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
