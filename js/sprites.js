import * as THREE from 'three';

// Os pilotos do MK64 eram modelos 3D pré-renderizados como sprites em vários ângulos.
// Fazemos o mesmo: montamos cada piloto em 3D e "fotografamos" 16 ângulos x 3 poses (reto, virando à esquerda/direita).

export const FRAMES = 16;
export const CELL = 64;
export const POSES = 3; // 0 reto, 1 virando p/ esquerda, 2 virando p/ direita

let bakeRenderer = null;
function getRenderer() {
  if (!bakeRenderer) {
    bakeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
    bakeRenderer.setPixelRatio(1);
    bakeRenderer.setSize(CELL, CELL);
    bakeRenderer.setClearColor(0x000000, 0);
  }
  return bakeRenderer;
}

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

function add(parent, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? lam(color) : color);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

function eye(parent, x, y, z, r = 0.07) {
  add(parent, new THREE.SphereGeometry(r * 1.5, 8, 6), 0xffffff, x, y, z);
  add(parent, new THREE.SphereGeometry(r, 8, 6), 0x111111, x * 1.05, y, z + r * 0.9);
}

function buildHead(d) {
  const h = new THREE.Group();
  const fur = d.fur;
  const S = (r) => new THREE.SphereGeometry(r, 12, 10);
  switch (d.animal) {
    case 'coelha': {
      add(h, S(0.4), fur, 0, 0, 0);
      for (const s of [1, -1]) {
        const ear = add(h, new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), fur, s * 0.16, 0.55, -0.05, 0, 0, -s * 0.15);
        add(ear, new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), 0xff9fc4, 0, 0, 0.05);
        eye(h, s * 0.15, 0.06, 0.33);
      }
      add(h, S(0.06), 0xff6f9a, 0, -0.06, 0.4);
      break;
    }
    case 'sapo': {
      const head = add(h, S(0.42), fur, 0, -0.05, 0); head.scale.set(1.15, 0.8, 1);
      for (const s of [1, -1]) { add(h, S(0.15), fur, s * 0.22, 0.27, 0.1); eye(h, s * 0.22, 0.3, 0.2, 0.08); }
      add(h, new THREE.TorusGeometry(0.2, 0.03, 4, 12, Math.PI), 0x1b5e20, 0, -0.08, 0.36, 0, 0, Math.PI);
      break;
    }
    case 'gata': {
      add(h, S(0.4), fur, 0, 0, 0);
      for (const s of [1, -1]) { add(h, new THREE.ConeGeometry(0.13, 0.28, 4), fur, s * 0.24, 0.38, 0, 0, 0, -s * 0.3); eye(h, s * 0.15, 0.06, 0.33); }
      add(h, S(0.15), 0xffffff, 0, -0.12, 0.3).scale.set(1.3, 0.8, 0.8);
      add(h, S(0.05), 0xff6f9a, 0, -0.04, 0.42);
      break;
    }
    case 'raposa': {
      add(h, S(0.4), fur, 0, 0, 0);
      for (const s of [1, -1]) { add(h, new THREE.ConeGeometry(0.16, 0.42, 4), fur, s * 0.24, 0.42, 0, 0, 0, -s * 0.25); eye(h, s * 0.15, 0.08, 0.32); }
      add(h, new THREE.ConeGeometry(0.17, 0.4, 8), 0xffffff, 0, -0.1, 0.42, Math.PI / 2, 0, 0);
      add(h, S(0.06), 0x111111, 0, -0.1, 0.62);
      break;
    }
    case 'cão': {
      add(h, S(0.4), fur, 0, 0, 0);
      for (const s of [1, -1]) { add(h, S(0.16), 0x6d4c41, s * 0.38, -0.05, 0).scale.set(0.5, 1.4, 0.9); eye(h, s * 0.15, 0.08, 0.33); }
      add(h, S(0.17), 0xe0c09a, 0, -0.12, 0.33).scale.set(1.1, 0.8, 1);
      add(h, S(0.07), 0x111111, 0, -0.04, 0.48);
      break;
    }
    case 'urso': {
      add(h, S(0.45), fur, 0, 0, 0);
      for (const s of [1, -1]) { add(h, S(0.14), fur, s * 0.3, 0.33, 0); eye(h, s * 0.16, 0.08, 0.37); }
      add(h, S(0.19), 0xd7a979, 0, -0.12, 0.36).scale.set(1.1, 0.8, 0.9);
      add(h, S(0.07), 0x111111, 0, -0.06, 0.52);
      break;
    }
    case 'rinoceronte': {
      const head = add(h, S(0.43), fur, 0, 0, 0); head.scale.set(1, 0.95, 1.15);
      for (const s of [1, -1]) { add(h, new THREE.ConeGeometry(0.09, 0.2, 5), fur, s * 0.26, 0.4, -0.05); eye(h, s * 0.2, 0.1, 0.34); }
      add(h, new THREE.ConeGeometry(0.1, 0.34, 6), 0xf5f0e0, 0, 0.12, 0.5, 0.5, 0, 0);
      break;
    }
    case 'jacaré': {
      add(h, S(0.38), fur, 0, 0, -0.05);
      const snout = add(h, new THREE.BoxGeometry(0.42, 0.2, 0.55), fur, 0, -0.1, 0.4);
      add(snout, new THREE.BoxGeometry(0.4, 0.03, 0.5), 0xffffff, 0, -0.07, 0.02);
      for (const s of [1, -1]) { add(h, S(0.1), fur, s * 0.16, 0.3, 0.12); eye(h, s * 0.16, 0.33, 0.18, 0.06); }
      break;
    }
  }
  return h;
}

export function buildDriverModel(d) {
  const root = new THREE.Group();
  const kart = lam(d.kart);
  const dark = lam(0x262626);
  // kart
  add(root, new THREE.BoxGeometry(1.15, 0.28, 1.7), kart, 0, 0.32, 0);
  add(root, new THREE.BoxGeometry(0.9, 0.24, 0.5), kart, 0, 0.42, 0.85, 0.25, 0, 0);
  add(root, new THREE.BoxGeometry(1.35, 0.14, 0.25), dark, 0, 0.26, 1.08);
  add(root, new THREE.BoxGeometry(1.25, 0.1, 0.32), kart, 0, 0.78, -0.92);
  add(root, new THREE.BoxGeometry(0.55, 0.35, 0.35), lam(0x9e9e9e), 0, 0.5, -0.75);
  for (const [x, z, r] of [[0.66, 0.6, 0.24], [-0.66, 0.6, 0.24], [0.7, -0.6, 0.3], [-0.7, -0.6, 0.3]]) {
    add(root, new THREE.CylinderGeometry(r, r, 0.3, 10), dark, x, r, z, 0, 0, Math.PI / 2);
    add(root, new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.32, 8), 0xdddddd, x, r, z, 0, 0, Math.PI / 2);
  }
  // piloto
  const driver = new THREE.Group();
  driver.position.set(0, 0.5, -0.15);
  root.add(driver);
  add(driver, new THREE.CylinderGeometry(0.28, 0.34, 0.55, 10), lam(0xffffff), 0, 0.3, 0);
  add(driver, new THREE.SphereGeometry(0.1, 8, 6), lam(d.fur), 0.3, 0.4, 0.3);
  add(driver, new THREE.SphereGeometry(0.1, 8, 6), lam(d.fur), -0.3, 0.4, 0.3);
  add(root, new THREE.TorusGeometry(0.18, 0.04, 6, 14), dark, 0, 0.95, 0.25, -0.8, 0, 0);
  const head = buildHead(d);
  head.position.set(0, 0.95, 0);
  driver.add(head);
  root.userData = { driver, head };
  return root;
}

// Gera o atlas de sprites (16 ângulos x 3 poses) e um retrato do piloto
export function bakeDriver(d) {
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const model = buildDriverModel(d);
  scene.add(model);

  const cam = new THREE.OrthographicCamera(-1.35, 1.35, 1.35, -1.35, 0.1, 50);
  const elev = 0.26;
  cam.position.set(0, 1.05 + Math.sin(elev) * 10, -Math.cos(elev) * 10);
  cam.lookAt(0, 1.05, 0);

  const atlas = document.createElement('canvas');
  atlas.width = CELL * FRAMES;
  atlas.height = CELL * POSES;
  const g = atlas.getContext('2d');
  const { driver, head } = model.userData;

  for (let pose = 0; pose < POSES; pose++) {
    const lean = pose === 0 ? 0 : pose === 1 ? 1 : -1; // + = virando à esquerda
    driver.rotation.z = lean * 0.22;
    head.rotation.y = lean * 0.35;
    for (let f = 0; f < FRAMES; f++) {
      model.rotation.y = (f / FRAMES) * Math.PI * 2;
      r.render(scene, cam);
      g.drawImage(r.domElement, f * CELL, pose * CELL);
    }
  }

  // retrato (de frente)
  driver.rotation.z = 0; head.rotation.y = 0; model.rotation.y = Math.PI;
  const pc = new THREE.OrthographicCamera(-0.62, 0.62, 0.62, -0.62, 0.1, 50);
  pc.position.set(0, 1.55, -10);
  pc.lookAt(0, 1.5, 0);
  r.render(scene, pc);
  const portrait = document.createElement('canvas');
  portrait.width = portrait.height = CELL;
  portrait.getContext('2d').drawImage(r.domElement, 0, 0);

  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  return { atlas, portrait: portrait.toDataURL() };
}

// Pequenos sprites 2D desenhados à mão (itens, coruja, fumaça)
export function drawSprite(kind, size = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / 32;
  g.scale(s, s);
  const circ = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const ell = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
  switch (kind) {
    case 'pimenta': case 'pimenta3':
      ell(16, 18, 6, 11, '#e53935', 0.5); ell(14, 15, 2, 5, '#ff8a80', 0.5);
      g.fillStyle = '#2e7d32'; g.fillRect(19, 3, 4, 6); break;
    case 'pimentaOuro':
      ell(16, 18, 6, 11, '#ffc107', 0.5); ell(14, 15, 2, 5, '#fff59d', 0.5);
      g.fillStyle = '#2e7d32'; g.fillRect(19, 3, 4, 6); break;
    case 'casca': case 'casca5':
      g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(16, 14, 13, 0.1 * Math.PI, 0.9 * Math.PI); g.fill();
      g.fillStyle = '#c8e6c9'; g.beginPath(); g.arc(16, 14, 10, 0.1 * Math.PI, 0.9 * Math.PI); g.fill();
      g.fillStyle = '#ef5350'; g.beginPath(); g.arc(16, 14, 8, 0.12 * Math.PI, 0.88 * Math.PI); g.fill();
      circ(13, 20, 1, '#111'); circ(19, 20, 1, '#111'); break;
    case 'presente': case 'box':
      g.fillStyle = kind === 'box' ? '#ab47bc' : '#8e24aa'; g.fillRect(4, 8, 24, 20);
      g.fillStyle = '#ffeb3b'; g.fillRect(14, 8, 4, 20); g.fillRect(4, 15, 24, 4);
      ell(11, 6, 5, 3, '#ffeb3b', 0.4); ell(21, 6, 5, 3, '#ffeb3b', -0.4);
      g.fillStyle = '#fff'; g.font = 'bold 12px monospace'; g.textAlign = 'center';
      g.fillText(kind === 'box' ? '?' : '¿', 9, 27); break;
    case 'coco': case 'coco3':
      circ(16, 17, 12, '#6d4c41'); circ(12, 13, 4, '#8d6e63');
      circ(13, 21, 1.6, '#3e2723'); circ(19, 21, 1.6, '#3e2723'); circ(16, 25, 1.6, '#3e2723'); break;
    case 'abelha': case 'abelha3':
      ell(16, 18, 11, 8, '#ffd600');
      g.fillStyle = '#212121'; g.fillRect(12, 10, 3, 16); g.fillRect(19, 10, 3, 16);
      ell(12, 7, 5, 4, 'rgba(255,255,255,.85)'); ell(21, 7, 5, 4, 'rgba(255,255,255,.85)');
      circ(26, 17, 2, '#111'); break;
    case 'vespao':
      ell(16, 19, 13, 9, '#1565c0');
      g.fillStyle = '#90caf9'; g.fillRect(11, 11, 3, 16); g.fillRect(18, 11, 3, 16);
      ell(10, 7, 6, 4, 'rgba(255,255,255,.9)'); ell(22, 7, 6, 4, 'rgba(255,255,255,.9)');
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(29, 19); g.lineTo(23, 16); g.lineTo(23, 22); g.fill();
      circ(5, 17, 2, '#fff'); break;
    case 'trovao':
      ell(16, 11, 12, 7, '#78909c'); ell(10, 9, 6, 5, '#90a4ae');
      g.fillStyle = '#ffeb3b'; g.beginPath(); g.moveTo(17, 14); g.lineTo(10, 24); g.lineTo(15, 24); g.lineTo(12, 31); g.lineTo(22, 20); g.lineTo(17, 20); g.lineTo(20, 14); g.fill(); break;
    case 'aura':
      for (let k = 0; k < 8; k++) {
        g.save(); g.translate(16, 16); g.rotate((k * Math.PI) / 4);
        g.fillStyle = k % 2 ? '#ffca28' : '#fff176'; g.fillRect(-2, -15, 4, 8); g.restore();
      }
      circ(16, 16, 8, '#ffd54f'); circ(13, 15, 1.5, '#111'); circ(19, 15, 1.5, '#111'); break;
    case 'sombra':
      ell(16, 16, 14, 8, '#4527a0'); ell(9, 16, 4, 3, '#fff'); ell(23, 16, 4, 3, '#fff');
      circ(9, 16, 1.6, '#111'); circ(23, 16, 1.6, '#111'); break;
    case 'coruja':
      ell(16, 18, 11, 12, '#8d6e63'); ell(16, 21, 7, 8, '#d7ccc8');
      circ(11, 12, 5, '#fff'); circ(21, 12, 5, '#fff'); circ(11, 12, 2.2, '#111'); circ(21, 12, 2.2, '#111');
      g.fillStyle = '#ffb300'; g.beginPath(); g.moveTo(14, 15); g.lineTo(18, 15); g.lineTo(16, 19); g.fill();
      ell(4, 18, 4, 8, '#6d4c41', 0.4); ell(28, 18, 4, 8, '#6d4c41', -0.4);
      g.fillStyle = '#e53935'; g.fillRect(9, 3, 14, 4); g.fillRect(14, 0, 4, 4); break;
    case 'fumaca':
      circ(16, 16, 13, 'rgba(255,255,255,1)'); circ(10, 12, 8, 'rgba(255,255,255,1)'); break;
    case 'faisca':
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(16, 0); g.lineTo(20, 12); g.lineTo(32, 16); g.lineTo(20, 20); g.lineTo(16, 32); g.lineTo(12, 20); g.lineTo(0, 16); g.lineTo(12, 12); g.fill(); break;
    case 'sombraChao': {
      const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32); break;
    }
  }
  return c;
}

const spriteTexCache = {};
export function spriteTexture(kind) {
  if (!spriteTexCache[kind]) {
    const t = new THREE.CanvasTexture(drawSprite(kind, 32));
    t.colorSpace = THREE.SRGBColorSpace;
    spriteTexCache[kind] = t;
  }
  return spriteTexCache[kind];
}
