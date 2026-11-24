// =====================================================================
//  Dados do jogo — regras e números baseados no Mario Kart 64
//  (personagens, pistas e itens são originais; só as mecânicas são iguais)
// =====================================================================

// O MK64 usa "unidades" internas de velocidade. Convertendo para metros/segundo:
// 324 unidades (leve, 150cc) ≈ 70 km/h no velocímetro.
export const UNIT = 0.06;                 // m/s por unidade
export const KMH = 3.6;                   // m/s -> km/h
export const FPS = 60;                    // o jogo original roda a ~60 quadros/s na corrida
export const frames = (n) => n / FPS;     // converte quadros do original em segundos

// Velocidade máxima por classe de peso e cilindrada (unidades do MK64)
export const TOP_SPEED = {
  leve:   { 50: 294, 100: 314, 150: 324 },
  medio:  { 50: 290, 100: 310, 150: 320 },
  pesado: { 50: 290, 100: 310, 150: 320 },
};

// Estatísticas por classe (turn speed do MK64; aceleração e grama são estimativas fiéis ao comportamento:
// leves aceleram mais rápido e perdem menos na grama; médios têm a pior aceleração)
export const CLASS_STATS = {
  leve:   { turn: 1.28, accel: 8.6, offroad: 0.62, mtBoost: 1.17, label: 'LEVE' },
  medio:  { turn: 1.25, accel: 6.4, offroad: 0.55, mtBoost: 1.14, label: 'MÉDIO' },
  pesado: { turn: 1.15, accel: 7.2, offroad: 0.48, mtBoost: 1.14, label: 'PESADO' },
};

// 8 pilotos originais. Peso (para empurrões) e "toque triplo" seguem os valores dos 8 do MK64.
export const DRIVERS = [
  { id: 'pipoca', name: 'Pipoca', animal: 'coelha',  cls: 'leve',   weight: 0.9, tap: 3,   kart: 0xff6fa8, fur: 0xf5f0f0 },
  { id: 'tico',   name: 'Tico',   animal: 'sapo',    cls: 'leve',   weight: 0.7, tap: 3,   kart: 0x29b6f6, fur: 0x7cc642 },
  { id: 'mel',    name: 'Mel',    animal: 'gata',    cls: 'leve',   weight: 0.9, tap: 3,   kart: 0xffd54f, fur: 0xf4a340 },
  { id: 'faisca', name: 'Faísca', animal: 'raposa',  cls: 'medio',  weight: 1.2, tap: 2,   kart: 0xe53935, fur: 0xff7a1a },
  { id: 'bento',  name: 'Bento',  animal: 'cão',     cls: 'medio',  weight: 1.0, tap: 2,   kart: 0x43a047, fur: 0xb5835a },
  { id: 'tonho',  name: 'Tonho',  animal: 'urso',    cls: 'pesado', weight: 2.0, tap: 1.5, size: 5.5, kart: 0x8d6e63, fur: 0x7b4a2a },
  { id: 'rino',   name: 'Rino',   animal: 'rinoceronte', cls: 'pesado', weight: 1.8, tap: 1.5, size: 6, kart: 0x7e57c2, fur: 0x9e9ea6 },
  { id: 'juca',   name: 'Juca',   animal: 'jacaré',  cls: 'pesado', weight: 2.3, tap: 3,   size: 6, kart: 0x26a69a, fur: 0x4f8a3a },
];

// Tamanho no MK64: 5.5 para todos, exceto os dois maiores pesados (6)
for (const d of DRIVERS) d.size = d.size || 5.5;

// ---------------------------------------------------------------- Regras do Grand Prix
export const LAPS = 3;
export const POINTS = [9, 6, 3, 1, 0, 0, 0, 0];
export const RACERS = 8;

// ---------------------------------------------------------------- Pilotagem
export const DRIVE = {
  hopTime: frames(6),          // pulinho: 6 quadros no ar
  hopHeight: 0.45,
  mtFrames: 14,                // mini-turbo dura 14 quadros
  wiggleMinOut: frames(4),     // tempo mínimo "para fora" antes de cada balanço (2º trecho do TAS: 4 quadros)
  driftArmTime: frames(9),     // primeiro trecho da derrapagem antes do 1º balanço (TAS: 9 quadros)
  spinOutAfter: 1.0,           // segurar o direcional para fora por tempo demais = rodada (estimado)
  rocketWindow: 0.3,           // apertar acelerar até 0,3 s antes da luz azul (estimado)
  burnoutTime: 1.0,            // largada queimada (estimado)
  draftTime: 2.0,              // vácuo: alguns segundos atrás de outro kart
};

// ---------------------------------------------------------------- Itens
// Mesmo comportamento dos itens do MK64, com outra roupagem
export const ITEMS = {
  pimenta:     { name: 'Pimenta',          like: 'Cogumelo' },
  pimenta3:    { name: '3 Pimentas',       like: '3 Cogumelos' },
  pimentaOuro: { name: 'Pimenta Dourada',  like: 'Cogumelo Dourado' },
  casca:       { name: 'Casca de Melancia', like: 'Banana' },
  casca5:      { name: 'Penca de Cascas',  like: 'Cacho de Bananas' },
  presente:    { name: 'Presente Falso',   like: 'Caixa Falsa' },
  coco:        { name: 'Coco',             like: 'Casco Verde' },
  coco3:       { name: '3 Cocos',          like: '3 Cascos Verdes' },
  abelha:      { name: 'Abelha',           like: 'Casco Vermelho' },
  abelha3:     { name: '3 Abelhas',        like: '3 Cascos Vermelhos' },
  vespao:      { name: 'Vespão',           like: 'Casco Espinhoso' },
  trovao:      { name: 'Trovão',           like: 'Raio' },
  aura:        { name: 'Aura Dourada',     like: 'Estrela' },
  sombra:      { name: 'Máscara Sombra',   like: 'Boo' },
};

// Probabilidades (%) no Grand Prix por posição (1º..8º) — tabela medida pelo TASVideos
export const ITEM_ODDS = {
  casca:       [30, 0, 0, 0, 0, 0, 0, 0],
  casca5:      [5, 5, 0, 0, 0, 0, 0, 0],
  coco:        [30, 5, 0, 0, 0, 0, 0, 0],
  coco3:       [5, 10, 10, 0, 0, 0, 0, 0],
  abelha:      [5, 15, 20, 15, 10, 0, 0, 0],
  abelha3:     [0, 20, 20, 20, 20, 20, 20, 20],
  vespao:      [0, 0, 0, 5, 5, 10, 10, 15],
  trovao:      [0, 5, 5, 10, 10, 15, 20, 20],
  presente:    [10, 5, 0, 0, 0, 0, 0, 0],
  aura:        [0, 5, 10, 15, 15, 20, 30, 30],
  sombra:      [5, 5, 0, 0, 0, 0, 0, 0],
  pimenta:     [10, 5, 5, 5, 5, 0, 0, 0],
  pimenta3:    [0, 15, 20, 20, 25, 25, 10, 5],
  pimentaOuro: [0, 5, 10, 10, 10, 10, 10, 10],
};

// Rivais do computador (como no MK64): não pegam itens nas caixas. O jogo dá itens a eles
// até 3 vezes por volta, de uma tabela própria, e eles só usam estes 6 itens:
// casca simples, aura (estrela), sombra (Boo), presente falso, pimenta simples e trovão.
// Nunca usam cocos, abelhas, vespão, itens triplos, penca ou pimenta dourada.
// Fatos do original: casca 60% em 1º e raio só 1% em 8º. O resto da tabela é estimado.
export const CPU_ITEMS_PER_LAP = 3;
export const CPU_ITEM_ODDS = {
  casca:    [60, 40, 40, 25, 25, 15, 15, 10],
  presente: [15, 15, 15, 10, 10, 10, 10, 10],
  pimenta:  [15, 25, 25, 35, 35, 35, 35, 34],
  sombra:   [5, 5, 5, 5, 5, 5, 5, 5],
  aura:     [5, 15, 15, 25, 25, 35, 35, 40],
  trovao:   [0, 0, 0, 0, 0, 0, 0, 1],
};

// Durações e forças dos itens (o MK64 não tem esses valores documentados: estimados pelo comportamento)
export const ITEM_FX = {
  boostTime: 1.0, boostMul: 1.32,   // pimenta
  goldTime: 7.5,                     // janela da pimenta dourada
  starTime: 8.0, starMul: 1.12,      // aura dourada
  shrinkTime: 6.0, shrinkMul: 0.72,  // trovão
  squashTime: 1.6,
  ghostTime: 6.0,                    // máscara sombra
  spinTime: 1.2,                     // casca
  tumbleTime: 1.6,                   // coco / abelha / presente
  blastTime: 2.4,                    // vespão
  shellSpeed: 30,                    // m/s
  homingSpeed: 27,
  spinySpeed: 36,
  shellBounces: 5,
  shellLife: 10,
  boxRespawn: 2.0,
  roulette: 1.4,
};

// ---------------------------------------------------------------- Pistas
export const ROAD_HALF = 6.5;
export const SHOULDER = 4.5;
export const EDGE = ROAD_HALF + SHOULDER;

function lemniscate(n, ax, az, yf) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2 + Math.PI * 1.62;
    pts.push([ax * Math.cos(t), az * Math.sin(2 * t), yf(t)]);
  }
  return pts;
}

export const CUPS = [
  {
    name: 'Copa Bolota',
    tracks: ['campos', 'praia', 'serra', 'vulcao'],
  },
  {
    name: 'Copa Engrenagem',
    tracks: ['oficina', 'pantano', 'sucata'],
  },
];

export const TRACKS = {
  campos: {
    name: 'Campos Bolota',
    theme: 'campos',
    // [x, z, altura]
    points: [[0, 0, 0], [56, 0, 0], [104, -12, 1], [132, -56, 3], [120, -104, 5], [76, -124, 4], [36, -96, 2],
      [4, -108, 1], [-40, -140, 1], [-96, -128, 2], [-128, -76, 3], [-108, -28, 2], [-64, -36, 1], [-32, -4, 0]],
    itemRows: [0.2, 0.52, 0.78],
    edge: () => 'wall',
  },
  praia: {
    name: 'Praia do Coqueiro',
    theme: 'praia',
    points: [[0, -30, 0.6], [60, -45, 0.6], [120, -25, 0.6], [150, 25, 0.6], [120, 72, 0.6], [62, 84, 0.8],
      [0, 80, 2.6], [-60, 88, 0.8], [-122, 66, 0.6], [-150, 25, 0.6], [-120, -10, 0.6], [-60, -30, 0.6]],
    itemRows: [0.15, 0.45, 0.75],
    water: [[-400, 100, 800, 400], [-20, 40, 40, 62]],       // retângulos [x, z, largura, profundidade]
    bridge: (p) => Math.abs(p.x) < 28 && p.z > 40,
    edge: (p, q) => (q.z > 100 ? 'fall' : 'wall'),
  },
  serra: {
    name: 'Serra Gelada',
    theme: 'serra',
    points: [[0, 0, 0], [70, 0, 0], [130, -20, 2], [160, -80, 8], [130, -140, 14], [60, -160, 20], [0, -130, 24],
      [-36, -84, 27], [-64, -46, 18], [-120, -20, 10], [-150, -70, 6], [-190, -40, 3], [-160, 20, 1], [-90, 30, 0], [-40, 14, 0]],
    itemRows: [0.18, 0.45, 0.72],
    edge: (p, q, outer) => (p.y > 9 && outer ? 'fall' : 'wall'),
  },
  vulcao: {
    name: 'Vulcão Oito',
    theme: 'vulcao',
    points: lemniscate(18, 150, 80, (t) => 2 + 4.5 * (1 + Math.sin(t))),
    itemRows: [0.12, 0.4, 0.62, 0.88],
    lava: true,
    bridge: (p) => Math.abs(p.x) < 34 && Math.abs(p.z) < 34 && p.y > 6,
    edge: (p, q, outer) => (outer && Math.abs(p.x) > 110 ? 'fall' : 'wall'),
  },
};

TRACKS.oficina = {
  name: 'Vila Engrenagem',
  theme: 'oficina',
  // circuito de rua: avenida da largada, ponte sobre o canal, praça da torre do relógio, outra ponte e volta
  points: [[0, 0, 0], [60, 0, 0], [100, -6, 0], [118, -34, 1.2], [118, -66, 3.6], [110, -94, 1], [84, -106, 0], [46, -104, 0],
    [24, -112, 0], [12, -130, 0], [-12, -134, 0], [-30, -120, 0], [-60, -110, 0], [-100, -110, 0], [-132, -102, 0],
    [-148, -84, 1.2], [-150, -66, 3.6], [-144, -42, 1.2], [-130, -14, 0], [-100, 0, 0], [-50, 4, 0]],
  itemRows: [0.16, 0.44, 0.72],
  water: [[-500, -80, 1000, 28]],                       // canal atravessando a cidade
  waterY: -1.6,
  bridge: (p) => Math.abs(p.z + 66) < 17 && p.y > 1.4,
  edge: () => 'wall',
  tower: [0, -108],                                     // torre do relógio, no meio da praça
};

TRACKS.pantano = {
  name: 'Brejo das Caldeiras',
  theme: 'pantano',
  // calçadão de tábuas sobre palafitas, serpenteando pelo pântano; sobe por cima do cano-mestre
  points: [[0, 0, 1.2], [50, 0, 1.2], [92, -12, 1.3], [114, -46, 1.6], [106, -84, 2.6], [70, -104, 4.4], [34, -96, 3],
    [10, -70, 1.6], [-22, -58, 1.3], [-50, -76, 1.4], [-62, -106, 1.6], [-84, -128, 1.6], [-120, -130, 1.6], [-158, -130, 1.6],
    [-186, -110, 1.6], [-192, -68, 1.5], [-172, -30, 1.3], [-130, -8, 1.2], [-80, 8, 1.2], [-40, 8, 1.2]],
  itemRows: [0.16, 0.46, 0.74],
  swampWater: true,
  waterY: -0.35,
  bridge: () => true,                                     // tudo é calçadão
  // sem corrimão do lado de fora em alguns trechos: dá para cair na água
  bridgeEdge: (p, q, outer) => (outer && ((p.x < -170 && p.z > -100) || (p.x > 96 && p.z > -70 && p.z < -20)) ? 'fall' : 'wall'),
  edge: () => 'wall',
  pipe: [[66, -150], [66, -40]],                          // cano-mestre que passa por baixo da subida
  ship: { x0: -158, x1: -84, zMax: -112 },               // navio-caldeira: a pista atravessa a casa de máquinas
};

// espiral de 1,5 volta em volta da torre de ferro-velho (centro 96,-150, raio 28), subindo de 0,6 a 18 m
const SUCATA_C = [96, -150];
const helix = Array.from({ length: 15 }, (_, k) => {
  const a = -(k / 14) * 3 * Math.PI;
  return [SUCATA_C[0] + 28 * Math.cos(a), SUCATA_C[1] + 28 * Math.sin(a), 0.6 + 17.4 * (k / 14)];
});
const nearTower = (p) => Math.hypot(p.x - SUCATA_C[0], p.z - SUCATA_C[1]);
TRACKS.sucata = {
  name: 'Ferro-Velho do Sol',
  theme: 'sucata',
  // largada, lombadas de duna, espiral subindo a torre, viaduto por cima da largada e ponte quebrada com salto
  points: [[0, 0, 0], [40, 0, 0], [62, -1, 0.2], [80, -4, 2.6], [99, -10, 0.2], [118, -20, 2.8], [136, -34, 0.2],
    [150, -60, 0.3], [148, -96, 0.4], [134, -124, 0.5], ...helix,
    [64, -118, 17.6], [61, -80, 16.4], [58, -30, 14.8], [56, 10, 13.6], [48, 40, 12.8], [30, 56, 12.2],
    [12, 62, 12], [-4, 64, 12.6], [-20, 64, 11.4], [-38, 60, 10.2], [-64, 46, 6], [-88, 26, 2],
    [-98, 6, 0.3], [-70, -1, 0], [-40, 0, 0]],
  itemRows: [0.05, 0.4, 0.62, 0.8],
  tower: SUCATA_C,
  bridge: (p) => p.y > 3.2,
  // na espiral, o lado de fora não tem muro
  bridgeEdge: (p, q) => (nearTower(p) < 36 && nearTower(q) > nearTower(p) ? 'fall' : 'wall'),
  edge: () => 'wall',
  gap: (p) => p.z > 50 && p.x < -6 && p.x > -13 && p.y > 8, // ponte quebrada: tem que pular
  kick: { len: 14, rise: 3 },
};

export const THEMES = {
  campos: { sky: 0x7ec8ff, fog: 0xb8e2ff, ground: '#5aa63a', ground2: '#4c9430', shoulder: '#6fb84a', shoulder2: '#5ea53c', skirt: '#8a6a43', wall: ['#ffffff', '#e53935'], decor: 'arvore', music: 0 },
  praia:  { sky: 0x6fd0ff, fog: 0xc9f0ff, ground: '#f2d99a', ground2: '#e8cc85', shoulder: '#f5e2aa', shoulder2: '#ead291', skirt: '#d9b870', wall: ['#ffffff', '#1e88e5'], decor: 'coqueiro', music: 1 },
  serra:  { sky: 0xa9c8e8, fog: 0xdfe8f2, ground: '#eef4fa', ground2: '#dde8f2', shoulder: '#f4f8fc', shoulder2: '#e3ecf5', skirt: '#7d8794', wall: ['#ffffff', '#3949ab'], decor: 'pinheiro', music: 2 },
  oficina: { sky: 0x8fbfe0, fog: 0xe9cf9a, light: 0xfff0d8, sun: 0xffdca8, ground: '#8fae5a', ground2: '#7f9e4c', shoulder: '#b7aa94', shoulder2: '#a89a82', skirt: '#a0563a', wall: ['#efe2c2', '#8e3b2a'], decor: 'arvore', decorMin: 50, decorCount: 120, music: 0 },
  pantano: { sky: 0x426e80, fog: 0x4f7a7c, fogNear: 70, fogFar: 560, light: 0xb8d8d8, sun: 0xc8e4dc, lightI: 1.35, sunI: 0.8, ground: '#3e4a2a', ground2: '#34402a', shoulder: '#6e5236', shoulder2: '#5e4630', skirt: '#5e4630', wall: ['#7a5c3c', '#5e4630'], decor: 'arvore', decorCount: 0, deck: 0x4a3622, pillar: 0x5a4030, pillarW: 0.7, pillarStep: 6, pillarDeep: 2, waterColors: ['#2c6266', '#347070', '#94d4c4', '#22504e'], music: 2 },
  sucata: { sky: 0x6cc0dc, fog: 0xf2d8a4, light: 0xfff0d8, sun: 0xffe2b0, ground: '#e2b872', ground2: '#d4a862', shoulder: '#d8ae6a', shoulder2: '#c89c5a', skirt: '#9a6a3a', wall: ['#2a2624', '#2a2624'], decor: 'arvore', decorCount: 0, deck: 0x5a3a2a, pillar: 0x6a3a22, pillarW: 1.2, music: 1 },
  vulcao: { sky: 0x3a1a24, fog: 0x5a2420, ground: '#3b2a26', ground2: '#2f211e', shoulder: '#5a4038', shoulder2: '#4b352f', skirt: '#2a1e1c', wall: ['#ffb300', '#212121'], decor: 'rocha', music: 3 },
};
