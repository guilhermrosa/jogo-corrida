import * as THREE from 'three';

// =====================================================================
//  Texturas pintadas à mão em pixel art, no estilo do mundo
//  (oficina, latão, madeira, pedra). Desenhadas uma vez, com semente fixa,
//  e filtradas sem borrar de perto (pixel nítido) e suaves de longe.
// =====================================================================

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pixelTex(w, h, draw, { repeat = true, seed = 1, transpose = false } = {}) {
  let c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h, rng(seed));
  if (transpose) {
    // desenhado "em pé" (x ao longo da pista, y para baixo); a faixa usa u = altura, v = comprimento
    const t2 = document.createElement('canvas');
    t2.width = h; t2.height = w;
    const g2 = t2.getContext('2d');
    g2.setTransform(0, 1, 1, 0, 0, 0);
    g2.drawImage(c, 0, 0);
    c = t2;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- cores
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const rgb = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;
const shade = (s, k) => { const c = hex(s); return rgb(c.map((v) => Math.max(0, Math.min(255, v * k)))); };
const px = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0); };

// ponto que repete nas bordas (para a textura emendar sem costura)
function dot(g, W, H, x, y, w, h, col) {
  for (const ox of [0, -W, W]) for (const oy of [0, -H, H]) px(g, x + ox, y + oy, w, h, col);
}

// pedra arredondada com luz em cima à esquerda e sombra embaixo à direita
function stone(g, x, y, w, h, base, r) {
  const k = 0.88 + r() * 0.22;
  px(g, x + 1, y, w - 2, h, shade(base, k));
  px(g, x, y + 1, w, h - 2, shade(base, k));
  px(g, x + 1, y + 1, w - 3, 1, shade(base, k * 1.22));   // luz
  px(g, x + 1, y + 1, 1, h - 3, shade(base, k * 1.12));
  px(g, x + 2, y + h - 2, w - 3, 1, shade(base, k * 0.72)); // sombra
  px(g, x + w - 2, y + 2, 1, h - 3, shade(base, k * 0.78));
  if (r() < 0.5) px(g, x + 2 + ((r() * (w - 5)) | 0), y + 2 + ((r() * (h - 5)) | 0), 1, 1, shade(base, k * 0.8));
}

// ---------------------------------------------------------------- estilos por tema
export const STYLE = {
  campos: {
    road: 'cobble', paveA: '#8b8680', mortar: '#4a4540', line: '#f4ead2',
    curb: ['#c8352e', '#efe6d0'], trim: '#b8873a',
    grass: ['#5fa83e', '#4d9532', '#7cc24f', '#3d7d28'], flowers: ['#ffd84a', '#ffffff', '#ff8fb1'],
    skirt: 'masonry', skirtA: '#9a8a74', skirtB: '#6f604f',
    wall: ['#efe6d0', '#c8352e'], wallTrim: '#b8873a',
  },
  praia: {
    road: 'planks', paveA: '#a8794a', mortar: '#4b3220', line: '#f4ead2',
    curb: ['#c8352e', '#efe6d0'], trim: '#b8873a',
    sand: ['#f0d79a', '#e3c47e', '#f8e6b4', '#cfae69'],
    skirt: 'boards', skirtA: '#9c6b3f', skirtB: '#5e3d22',
    wall: ['#efe6d0', '#2f7fc1'], wallTrim: '#b8873a',
  },
  serra: {
    road: 'slabs', paveA: '#7f8790', mortar: '#3f454d', line: '#f4f8ff',
    curb: ['#c8352e', '#f2f2ee'], trim: '#9aa4ad',
    snow: ['#eef4fb', '#d9e5f2', '#ffffff', '#bfd0e3'],
    skirt: 'masonry', skirtA: '#7d8794', skirtB: '#555e69',
    wall: ['#f2f2ee', '#34489e'], wallTrim: '#9aa4ad',
  },
  oficina: {
    road: 'cobble', paveA: '#9c8a76', mortar: '#4a3f36', line: '#f4e2b0',
    curb: ['#8e3b2a', '#efe2c2'], trim: '#c9a24a',
    slab: ['#b7aa94', '#8f8370', '#cfc4ae', '#6f6556'],
    skirt: 'brick', skirtA: '#a0563a', skirtB: '#5e3324',
    wall: ['#efe2c2', '#8e3b2a'], wallTrim: '#c9a24a',
  },
  pantano: {
    road: 'planks', paveA: '#7a5a3a', mortar: '#2a1d12', line: '#e8d890',
    curb: ['#8a3a2a', '#d8c8a0'], trim: '#8a7a4a',
    deck: ['#7a5c3c', '#5e4630', '#94744c', '#3e7a4a'],
    mud: ['#4a4a2a', '#3a3a22', '#5e6a32', '#2a2a18'],
    skirt: 'boards', skirtA: '#5e4630', skirtB: '#2e2012',
    wall: ['#7a5c3c', '#5e4630'], wallTrim: '#6a625a',
  },
  sucata: {
    road: 'dirt', paveA: '#c89a5e', mortar: '#8a6236', line: '#f4e2b0',
    curb: ['#b0482a', '#efe2c2'], trim: '#8a4a2a',
    sand: ['#e2b872', '#d4a862', '#f0cc8a', '#b8884a'],
    skirt: 'corrugated', skirtA: '#9a5a32', skirtB: '#5e3420',
    wall: ['#2a2624', '#2a2624'], wallTrim: '#8a4a2a', tires: true,
  },
  ilhas: {
    road: 'cobble', paveA: '#8e8a80', mortar: '#4a4440', line: '#e8d8a8',
    curb: ['#8a4a2a', '#d8ccb0'], trim: '#c9a24a',
    grass: ['#6aaa4a', '#5a9a3e', '#8ac45a', '#467a30'], flowers: ['#ff8fc8', '#ffffff', '#ffd84a'],
    skirt: 'masonry', skirtA: '#a89878', skirtB: '#6a5a4a',
    wall: ['#d8c8a8', '#c8b898'], wallTrim: '#c9a24a',
  },
  vulcao: {
    road: 'plates', paveA: '#4b4447', mortar: '#1e1a1b', line: '#ffb84a',
    curb: ['#e8a221', '#2a2526'], trim: '#a0622e',
    ash: ['#4a3a34', '#3a2c28', '#5e4a40', '#2a1f1c'],
    skirt: 'rock', skirtA: '#3a2b27', skirtB: '#211816',
    wall: ['#e8a221', '#2a2526'], wallTrim: '#a0622e',
  },
};

// ---------------------------------------------------------------- pista (128 x 128 = 13 m x 16 m)
export function roadTexture(theme) {
  const S = STYLE[theme];
  return pixelTex(128, 128, (g, W, H, r) => {
    const CURB = 9;
    px(g, 0, 0, W, H, S.mortar);
    const x0 = CURB + 1, x1 = W - CURB - 1;

    if (S.road === 'cobble') {
      // paralelepípedos em fileiras desencontradas
      for (let y = 0, row = 0; y < H; y += 8, row++) {
        let x = x0 - (row % 2 ? 5 : 0);
        while (x < x1) {
          const w = 8 + ((r() * 4) | 0);
          stone(g, Math.max(x0, x), y, Math.min(w, x1 - Math.max(x0, x)), 8, S.paveA, r);
          x += w;
        }
      }
    } else if (S.road === 'planks') {
      // pranchas atravessadas com pregos e veios
      for (let y = 0; y < H; y += 8) {
        const k = 0.86 + r() * 0.24;
        px(g, x0, y, x1 - x0, 7, shade(S.paveA, k));
        px(g, x0, y, x1 - x0, 1, shade(S.paveA, k * 1.18));
        for (let i = 0; i < 5; i++) px(g, x0 + r() * (x1 - x0 - 12), y + 2 + ((r() * 4) | 0), 6 + r() * 14, 1, shade(S.paveA, k * 0.82));
        const seam = x0 + 20 + ((r() * 70) | 0);
        px(g, seam, y, 1, 7, S.mortar);
        for (const nx of [x0 + 3, seam - 3, seam + 2, x1 - 4]) px(g, nx, y + 3, 1, 1, '#2a1d12');
      }
    } else if (S.road === 'slabs') {
      // lajes de pedra com geada nas frestas
      for (let y = 0, row = 0; y < H; y += 16, row++) {
        const cuts = [x0];
        let x = x0 + (row % 2 ? 12 : 22);
        while (x < x1 - 10) { cuts.push(x); x += 20 + ((r() * 14) | 0); }
        cuts.push(x1);
        for (let i = 0; i < cuts.length - 1; i++) stone(g, cuts[i], y, cuts[i + 1] - cuts[i], 16, S.paveA, r);
      }
      for (let i = 0; i < 90; i++) px(g, x0 + r() * (x1 - x0), r() * H, 1, 1, 'rgba(235,245,255,.7)');
    } else if (S.road === 'checker') {
      // calçamento xadrez vermelho e creme, pedras arredondadas
      const cw = (x1 - x0) / 8;
      for (let y = 0, row = 0; y < H; y += 8, row++) for (let c = 0; c < 8; c++) {
        stone(g, x0 + c * cw, y, Math.ceil(cw), 8, (row + c) % 2 ? S.paveA : S.paveB, r);
      }
    } else if (S.road === 'dirt') {
      // terra batida com sulcos de pneu, pedrinhas e parafusos perdidos
      px(g, x0, 0, x1 - x0, H, S.paveA);
      for (let i = 0; i < 900; i++) px(g, x0 + r() * (x1 - x0), r() * H, 1, 1, r() < 0.5 ? shade(S.paveA, 0.9) : shade(S.paveA, 1.08));
      for (const tx of [34, 44, 80, 90]) for (let y = 0; y < H; y++) { px(g, tx + Math.round(Math.sin(y / 9) * 1.5), y, 4, 1, shade(S.paveA, 0.84)); if (y % 4 === 0) px(g, tx + 1 + Math.round(Math.sin(y / 9) * 1.5), y, 2, 1, shade(S.paveA, 0.72)); }
      for (let i = 0; i < 30; i++) { const x = x0 + r() * (x1 - x0 - 3), y = r() * H; px(g, x, y, 2, 2, shade(S.paveA, 0.7)); px(g, x, y, 1, 1, shade(S.paveA, 1.2)); }
      for (let i = 0; i < 6; i++) { const x = x0 + r() * (x1 - x0 - 3), y = r() * H; px(g, x, y, 3, 3, '#7a7068'); px(g, x + 1, y + 1, 1, 1, '#c8c0b0'); }
    } else if (S.road === 'plates') {
      // chapas de ferro rebitadas com brilho de brasa nas emendas
      for (let y = 0; y < H; y += 32) {
        for (let x = x0; x < x1; x += 27) {
          const w = Math.min(27, x1 - x);
          const k = 0.9 + r() * 0.2;
          px(g, x + 1, y + 1, w - 1, 31, shade(S.paveA, k));
          px(g, x + 1, y + 1, w - 1, 1, shade(S.paveA, k * 1.3));
          px(g, x + 1, y + 31, w - 1, 1, 'rgba(255,110,20,.55)');
          for (const [rx, ry] of [[3, 3], [w - 4, 3], [3, 28], [w - 4, 28]]) {
            px(g, x + rx, y + ry, 2, 2, shade(S.paveA, 1.5)); px(g, x + rx + 1, y + ry + 1, 1, 1, '#151213');
          }
          for (let i = 0; i < 4; i++) px(g, x + 3 + r() * (w - 6), y + 5 + r() * 22, 2, 1, 'rgba(0,0,0,.25)');
        }
      }
    }

    // marcas de pneu e sujeira leves
    for (const tx of [38, 46, 82, 90]) for (let y = 0; y < H; y += 2) if (r() < 0.55) px(g, tx + ((r() * 2) | 0), y, 2, 2, 'rgba(0,0,0,.10)');

    // faixa central tracejada
    for (let y = 2; y < H / 2; y += 1) px(g, W / 2 - 1, y, 3, 1, S.line);
    px(g, W / 2 - 1, 2, 3, 1, shade(S.line, 1.1));

    // zebras (blocos com relevo) e friso de latão
    for (const [cx, dir] of [[0, 1], [W - CURB, -1]]) {
      for (let y = 0, k = 0; y < H; y += 16, k++) {
        const col = S.curb[k % 2];
        px(g, cx, y, CURB, 16, col);
        px(g, cx, y, CURB, 2, shade(col.startsWith('#') ? col : '#888888', 1.15));
        px(g, cx, y + 14, CURB, 2, shade(col, 0.75));
      }
      const tx = dir > 0 ? CURB : W - CURB - 1;
      px(g, tx, 0, 1, H, S.trim);
    }
  }, { seed: theme.length * 31 + 7 });
}

// ---------------------------------------------------------------- acostamento (64 x 64 = 4,5 m x 6 m)
function tufts(g, W, H, r, cols, n, flowers) {
  px(g, 0, 0, W, H, cols[0]);
  for (let i = 0; i < W * H * 0.25; i++) dot(g, W, H, r() * W, r() * H, 1, 1, cols[1]);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H;
    // tufo: folhas escuras embaixo, claras em cima
    dot(g, W, H, x - 1, y + 1, 3, 2, cols[3]);
    dot(g, W, H, x - 2, y - 1, 1, 2, cols[2]);
    dot(g, W, H, x, y - 2, 1, 3, cols[2]);
    dot(g, W, H, x + 2, y - 1, 1, 2, cols[2]);
  }
  if (flowers) for (let i = 0; i < 7; i++) {
    const x = r() * W, y = r() * H, c = flowers[(r() * flowers.length) | 0];
    dot(g, W, H, x, y, 2, 2, c); dot(g, W, H, x + 0.5, y + 0.5, 1, 1, '#ffef9a');
  }
}

export function groundTexture(theme, kind = 'shoulder') {
  const S = STYLE[theme];
  const big = kind === 'terrain';
  return pixelTex(64, 64, (g, W, H, r) => {
    if (theme === 'campos' || (theme === 'ilhas' && big)) tufts(g, W, H, r, S.grass, big ? 40 : 55, big ? null : S.flowers);
    else if (theme === 'ilhas') {
      // tábuas de madeira com friso de latão: serve na ilha e na ponte
      px(g, 0, 0, W, H, '#3a2414');
      for (let y = 0; y < H; y += 8) { const k = 0.85 + r() * 0.3; px(g, 0, y, W, 7, shade('#9a6a40', k)); px(g, 0, y, W, 1, shade('#9a6a40', k * 1.2)); for (let i = 0; i < 3; i++) px(g, r() * W, y + 2 + r() * 4, 6 + r() * 10, 1, shade('#9a6a40', k * 0.8)); for (const x of [4, 36]) px(g, x, y + 3, 1, 1, '#2a1a0a'); }
      px(g, W - 3, 0, 3, H, '#c9a24a'); px(g, W - 3, 0, 1, H, '#e8c070');
    }
    else if (theme === 'pantano' && !big) {
      // tábuas do calçadão com musgo nas frestas
      px(g, 0, 0, W, H, '#2e2012');
      for (let x = 0; x < W; x += 8) {
        const k = 0.85 + r() * 0.3;
        px(g, x, 0, 7, H, shade(S.deck[0], k)); px(g, x, 0, 1, H, shade(S.deck[0], k * 1.18));
        for (let i = 0; i < 3; i++) px(g, x + 2 + r() * 3, r() * H, 1, 5 + r() * 8, shade(S.deck[0], k * 0.8));
      }
      for (let i = 0; i < 26; i++) dot(g, W, H, ((r() * 8) | 0) * 8 - 1, r() * H, 2, 2 + r() * 3, S.deck[3]);
      for (let y = 12; y < H; y += 30) for (let x = 3; x < W; x += 8) px(g, x, y, 1, 1, '#1a120a');
    } else if (theme === 'pantano') {
      px(g, 0, 0, W, H, S.mud[1]);
      for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 3, 2, S.mud[0]); dot(g, W, H, x + 1, y - 1, 1, 1, S.mud[2]); }
      for (let i = 0; i < 20; i++) dot(g, W, H, r() * W, r() * H, 1, 1, S.mud[3]);
    }
    else if (theme === 'oficina' && !big) {
      // calçada de lajotas com bueiro de latão de vez em quando
      px(g, 0, 0, W, H, S.slab[3]);
      for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) stone(g, x, y, 16, 16, S.slab[0], r);
      px(g, 34, 18, 12, 12, '#6b5a2e'); px(g, 35, 19, 10, 10, '#c9a24a');
      for (let k = 0; k < 4; k++) px(g, 36, 21 + k * 2, 8, 1, '#5a4820');
      for (let i = 0; i < 8; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 2, 1, '#6d8f3a'); }
    } else if (theme === 'oficina') tufts(g, W, H, r, ['#8fae5a', '#7f9e4c', '#a6c46a', '#5f7f3a'], 40, null);
    else if (theme === 'praia') {
      px(g, 0, 0, W, H, S.sand[0]);
      for (let i = 0; i < W * H * 0.2; i++) dot(g, W, H, r() * W, r() * H, 1, 1, S.sand[1]);
      // ondulações de vento
      for (let y = 4; y < H; y += 9) for (let x = 0; x < W; x++) {
        const yy = y + Math.round(Math.sin((x / W) * Math.PI * 4 + y) * 1.5);
        dot(g, W, H, x, yy, 1, 1, S.sand[3]); dot(g, W, H, x, yy - 1, 1, 1, S.sand[2]);
      }
      if (!big) for (let i = 0; i < 3; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 3, 2, '#fff4e6'); dot(g, W, H, x + 1, y + 1, 1, 1, '#f4a88a'); }
    } else if (theme === 'sucata') {
      px(g, 0, 0, W, H, S.sand[0]);
      for (let i = 0; i < W * H * 0.2; i++) dot(g, W, H, r() * W, r() * H, 1, 1, S.sand[1]);
      for (let y = 5; y < H; y += 11) for (let x = 0; x < W; x++) { const yy = y + Math.round(Math.sin((x / W) * Math.PI * 2 + y) * 2); dot(g, W, H, x, yy, 1, 1, S.sand[3]); dot(g, W, H, x, yy - 1, 1, 1, S.sand[2]); }
      if (!big) for (let i = 0; i < 4; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 2, 2, '#7a7068'); dot(g, W, H, x + 2, y + 1, 2, 1, '#9a5a32'); }
    } else if (theme === 'serra') {
      px(g, 0, 0, W, H, S.snow[0]);
      for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 5 + r() * 6, 2, S.snow[1]); dot(g, W, H, x + 1, y + 2, 3 + r() * 4, 1, S.snow[3]); }
      for (let i = 0; i < 30; i++) dot(g, W, H, r() * W, r() * H, 1, 1, S.snow[2]);
    } else {
      px(g, 0, 0, W, H, S.ash[1]);
      for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H, s = 2 + ((r() * 3) | 0); dot(g, W, H, x, y, s, s - 1, S.ash[0]); dot(g, W, H, x, y, s - 1, 1, S.ash[2]); dot(g, W, H, x + 1, y + s - 1, s - 1, 1, S.ash[3]); }
      for (let i = 0; i < 6; i++) dot(g, W, H, r() * W, r() * H, 1, 1, '#ff7a1a');
    }
  }, { seed: theme.length * 13 + (big ? 5 : 1) });
}

// tom de cinza que multiplica as cores do relevo (desenho sem cor própria)
export function terrainDetail(theme) {
  return pixelTex(64, 64, (g, W, H, r) => {
    px(g, 0, 0, W, H, '#e6e6e6');
    const L = (v) => `rgb(${v},${v},${v})`;
    for (let i = 0; i < W * H * 0.18; i++) dot(g, W, H, r() * W, r() * H, 1, 1, L(205 + r() * 20));
    if (theme === 'serra') {
      for (let i = 0; i < 22; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 6, 1, L(200)); dot(g, W, H, x + 1, y - 1, 4, 1, L(255)); }
    } else if (theme === 'praia') {
      for (let y = 3; y < H; y += 8) for (let x = 0; x < W; x++) dot(g, W, H, x, y + Math.round(Math.sin(x / 5 + y) * 1.4), 1, 1, L(196));
    } else {
      for (let i = 0; i < 46; i++) {
        const x = r() * W, y = r() * H;
        dot(g, W, H, x - 1, y + 1, 3, 2, L(170));
        dot(g, W, H, x - 2, y - 1, 1, 2, L(255)); dot(g, W, H, x, y - 2, 1, 3, L(255)); dot(g, W, H, x + 2, y - 1, 1, 2, L(250));
      }
    }
  }, { seed: theme.length * 17 + 3 });
}

// ---------------------------------------------------------------- barranco (64 x 64 = largura x 8 m)
export function skirtTexture(theme) {
  const S = STYLE[theme];
  return pixelTex(64, 64, (g, W, H, r) => {
    px(g, 0, 0, W, H, S.skirtB);
    if (S.skirt === 'masonry') {
      for (let y = 0, row = 0; y < H; y += 8, row++) {
        let x = row % 2 ? -8 : 0;
        while (x < W) { const w = 14 + ((r() * 6) | 0); stone(g, x, y, w, 8, S.skirtA, r); x += w; }
      }
      for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 3, 1, '#5a7d38'); dot(g, W, H, x + 1, y - 1, 1, 1, '#7aa84a'); }
    } else if (S.skirt === 'brick') {
      for (let y = 0, row = 0; y < H; y += 6, row++) {
        let x = row % 2 ? -5 : 0;
        while (x < W) { stone(g, x, y, 10, 6, S.skirtA, r); x += 10; }
      }
      for (let i = 0; i < 6; i++) { const x = r() * W, y = r() * H; dot(g, W, H, x, y, 4, 2, 'rgba(60,40,30,.35)'); }
    } else if (S.skirt === 'corrugated') {
      // chapa ondulada enferrujada, remendada
      for (let x = 0; x < W; x++) { const k = 0.8 + 0.3 * Math.abs(Math.sin(x * 0.8)); px(g, x, 0, 1, H, shade(S.skirtA, k)); }
      for (let i = 0; i < 14; i++) dot(g, W, H, r() * W, r() * H, 3 + r() * 5, 2 + r() * 3, 'rgba(70,30,10,.45)');
      const px0 = 10 + r() * 30; px(g, px0, 20, 20, 16, '#6a625a'); for (const [rx, ry] of [[1, 1], [17, 1], [1, 13], [17, 13]]) px(g, px0 + rx, 20 + ry, 2, 2, '#c8c0b0');
    } else if (S.skirt === 'boards') {
      for (let x = 0; x < W; x += 8) {
        const k = 0.85 + r() * 0.25;
        px(g, x, 0, 7, H, shade(S.skirtA, k)); px(g, x, 0, 1, H, shade(S.skirtA, k * 1.2));
        for (let i = 0; i < 3; i++) px(g, x + 2 + r() * 3, r() * H, 1, 6 + r() * 8, shade(S.skirtA, k * 0.8));
      }
      for (const y of [10, 42]) { px(g, 0, y, W, 4, '#a8803a'); px(g, 0, y, W, 1, '#e0bd6a'); for (let x = 3; x < W; x += 8) px(g, x, y + 1, 2, 2, '#5e4520'); }
    } else {
      for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, w = 6 + r() * 10, h = 4 + r() * 6; stone(g, x, y, w, h, S.skirtA, r); }
      for (let i = 0; i < 8; i++) dot(g, W, H, r() * W, r() * H, 2, 1, 'rgba(255,110,20,.6)');
    }
  }, { seed: theme.length * 7 + 2, transpose: true });
}

// ---------------------------------------------------------------- muro (64 x 16 = 4 m x 1 m)
export function wallTexture(theme) {
  const S = STYLE[theme];
  if (S.tires) return pixelTex(64, 16, (g, W, H) => {
    // muro de pneus velhos empilhados, alguns pintados
    px(g, 0, 0, W, H, '#1a1716');
    for (const [y, off] of [[0, 0], [8, 4]]) for (let x = -off; x < W; x += 8) {
      const col = ((x + y) / 8) % 5 === 0 ? '#c8352e' : ((x + y) / 8) % 7 === 0 ? '#efe2c2' : '#2e2a28';
      px(g, x + 1, y + 1, 7, 6, col); px(g, x + 1, y + 1, 7, 1, '#5a5450'); px(g, x + 3, y + 3, 3, 2, '#0e0c0b');
    }
  }, { seed: 9, transpose: true });
  return pixelTex(64, 16, (g, W, H) => {
    for (let k = 0; k < 2; k++) {
      const x = k * 32, col = S.wall[k];
      px(g, x, 0, 32, H, col);
      px(g, x, 3, 32, 1, shade(col, 1.12));
      px(g, x, H - 4, 32, 1, shade(col, 0.78));
      px(g, x, 0, 1, H, shade(col, 0.7));
    }
    // frisos de latão com rebites em cima e embaixo
    for (const y of [0, H - 3]) {
      px(g, 0, y, W, 3, S.wallTrim); px(g, 0, y, W, 1, shade(S.wallTrim, 1.3)); px(g, 0, y + 2, W, 1, shade(S.wallTrim, 0.7));
      for (let x = 3; x < W; x += 8) { px(g, x, y + 1, 1, 1, shade(S.wallTrim, 1.55)); }
    }
  }, { seed: 9, transpose: true });
}

// ---------------------------------------------------------------- água e lava
export function waterTexture(cols = ['#2f8fd6', '#3aa0e4', '#bfe8ff', '#2378bd']) {
  return pixelTex(64, 64, (g, W, H, r) => {
    px(g, 0, 0, W, H, cols[0]);
    for (let i = 0; i < 260; i++) dot(g, W, H, r() * W, r() * H, 2, 1, cols[1]);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = r() * H;
      // marolinha de desenho: arco claro com sombra
      dot(g, W, H, x, y, 5, 1, cols[2]); dot(g, W, H, x - 1, y + 1, 1, 1, cols[2]); dot(g, W, H, x + 5, y + 1, 1, 1, cols[2]);
      dot(g, W, H, x, y + 2, 5, 1, cols[3]);
    }
  }, { seed: 4 });
}

export function lavaTexture() {
  return pixelTex(64, 64, (g, W, H, r) => {
    px(g, 0, 0, W, H, '#ff6a00');
    for (let i = 0; i < 140; i++) dot(g, W, H, r() * W, r() * H, 3, 2, '#ffa020');
    for (let i = 0; i < 40; i++) dot(g, W, H, r() * W, r() * H, 2, 1, '#ffe066');
    // crostas escuras flutuando
    for (let i = 0; i < 9; i++) {
      const x = r() * W, y = r() * H, w = 5 + r() * 6, h = 3 + r() * 3;
      dot(g, W, H, x, y, w, h, '#6a1a08'); dot(g, W, H, x + 1, y, w - 2, 1, '#9a3a12'); dot(g, W, H, x + 1, y + h, w - 1, 1, '#ffd24a');
    }
  }, { seed: 6 });
}
