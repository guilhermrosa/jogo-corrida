import * as THREE from 'three';
export { FRAMES, CELL, POSES, SPRITE_WORLD, SPRITE_GROUND, bakeDriver } from './drivers3d.js';

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
