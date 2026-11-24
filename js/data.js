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
  { id: 'tico',   name: 'Tico',   animal: 'sapo',    cls: 'leve',   weight: 0.7, tap: 3,   kart: 0x3aa58a, fur: 0x7cc642 },
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

// Rivais do computador: ganham item só ao passar por uma caixa (um por vez, como o jogador),
// sorteado de uma tabela própria; eles só usam estes 6 itens:
// casca simples, aura (estrela), sombra (Boo), presente falso, pimenta simples e trovão.
// Nunca usam cocos, abelhas, vespão, itens triplos, penca ou pimenta dourada.
// Fatos do original: casca 60% em 1º e raio só 1% em 8º. O resto da tabela é estimado.
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

// a serra é desenhada em escala maior e encolhida um pouco (volta mais curta)
const SK = 0.86;
const SERRA_S = (pts) => pts.map(([x, z, y]) => [x * SK, z * SK, y]);

export const CUPS = [
  {
    name: 'Copa Pistão',
    tracks: ['campos', 'praia', 'serra', 'vulcao'],
  },
  {
    name: 'Copa Engrenagem',
    tracks: ['oficina', 'pantano', 'sucata', 'ilhas'],
  },
];

export const TRACKS = {
  campos: {
    name: 'Fazenda dos Silos',
    theme: 'campos',
    // cooperativa de bolotas a vapor: reta dos silos, subida do moinho, viaduto de madeira e ferro
    // por cima da largada, descida até o canal de irrigação e volta pelo pomar
    points: [[-40, 0, 0], [20, 0, 0], [64, -4, 0], [100, -24, 1], [118, -58, 3.5], [108, -96, 7], [76, -116, 9.5], [36, -112, 10],
      [10, -84, 10], [2, -44, 10], [2, -4, 10], [4, 34, 8.5], [-10, 66, 5.5], [-42, 80, 2], [-80, 84, 0.4], [-100, 108, 0.2],
      [-130, 112, 0.2], [-158, 104, 0.2], [-176, 80, 0.2], [-178, 50, 0.2], [-168, 18, 0], [-140, -6, 0], [-104, -14, 0], [-74, -8, 0]],
    itemRows: [0.08, 0.42, 0.66],
    bridge: (p) => p.y > 3,
    edge: () => 'wall',
    branches: [
      // caminho alternativo: por dentro do celeiro-debulhadora, mais curto e mais fechado
      { from: [92, -18], mid: [[84, -50, 3.5], [70, -72, 6.5], [58, -92, 9]], to: [28, -108], ai: 0.5, bridge: () => false },
    ],
  },
  praia: {
    name: 'Porto dos Escafandros',
    theme: 'praia',
    // porto dos escafandristas: calçadão, volta da doca do canal (com ponte levadiça), píer dos
    // submarinos sobre o mar, e subida ao promontório do farol
    points: [[-20, 0, 0.6], [14, 2, 0.6], [24, -24, 0.8], [26, -60, 1], [29, -84, 1.2], [41, -96, 1.2], [53, -84, 1.2], [56, -60, 1], [56, -20, 0.8], [57, 2, 0.6], [66, 12, 0.6], [82, 17, 0.6],
      [108, 20, 0.6], [146, 34, 1.4], [164, 72, 1.8], [150, 108, 1.8], [110, 120, 1.8], [64, 116, 1.8], [24, 104, 1.8], [-16, 108, 1.8],
      [-56, 100, 1.6], [-98, 80, 1.2], [-128, 48, 2.6], [-142, 10, 5.5], [-132, -28, 8.5], [-104, -46, 9.5], [-78, -30, 6], [-54, -8, 2]],
    itemRows: [0.1, 0.44, 0.7],
    water: [[-400, 70, 800, 400], [37, -84, 8, 160]],      // mar ao sul e o canal da doca
    waterY: -0.6,
    bridge: (p) => p.z > 66,
    bridgeEdge: (p, q) => (q.z > p.z + 6 && p.x > -40 && p.x < 130 ? 'fall' : 'wall'),
    edge: (p, q, outer) => (outer && p.y > 4 ? 'fall' : 'wall'),
    branches: [
      // ponte levadiça erguida: serve de rampa por cima do canal da doca
      { from: [-16, 0], overlap: 16, mid: [[16, 13, 0.9], [28, 12, 2.4], [36, 12, 3.4]], launch: { len: 12, rise: 3 }, to: [68, 12], ai: 0.3, bridge: (p) => p.i > p.n - 26 },
    ],
  },
  serra: {
    name: 'Serra Gelada',
    theme: 'serra',
    // Companhia de Gelo da Serra: depósito no vale, subida em zigue-zague, túnel da geleira,
    // crista dos teleféricos, descida pela calha de gelo e o lago congelado onde cortam os blocos
    points: SERRA_S([[0, 0, 0], [60, 0, 0], [110, -8, 1], [140, -36, 3], [146, -76, 6], [122, -106, 9.5], [80, -112, 12.5], [40, -100, 15],
      [6, -116, 17.5], [-24, -146, 20], [-62, -152, 22], [-86, -174, 22.5], [-102, -194, 22.5], [-124, -194, 21.5], [-138, -172, 19.5], [-140, -144, 17.5], [-142, -110, 16], [-146, -72, 14], [-128, -42, 12],
      [-150, -12, 8.5], [-160, 22, 5], [-136, 52, 2], [-94, 60, 0.5], [-54, 42, 0], [-30, 14, 0]]),
    itemRows: [0.12, 0.44, 0.7],
    edge: (p, q, outer) => (p.y > 9 && outer ? 'fall' : 'wall'),
    // gretas na geleira: dois saltos obrigatórios (na crista e no começo da descida)
    gap: (p) => { const x = p.x / SK, z = p.z / SK; return (z < -140 && x < -44 && x > -52) || (x < -130 && z > -128 && z < -121); },
    kick: { len: 12, rise: 2.2 },
    branches: [
      // pelo lago congelado, entre os cortadores de gelo
      { from: [-156 * SK, -2 * SK], mid: SERRA_S([[-130, 18, 2], [-100, 30, 0.6]]), to: [-60 * SK, 44 * SK], ai: 0.5 },
    ],
  },
  vulcao: {
    name: 'Fundição do Vulcão',
    theme: 'vulcao',
    // fundição dentro do vulcão: oito com viaduto por cima da largada, galpão de fundição,
    // passarela sem muretas por cima do poço de corrida e rampa de escória por cima do canal de lava
    points: [[-60, 0, 2], [-20, 0, 2.2], [30, 4, 2.6], [80, 20, 3], [124, 10, 3.5], [142, -30, 4.5], [122, -72, 6], [80, -84, 8],
      [40, -54, 10], [6, -14, 11], [-24, 22, 10.5], [-62, 50, 8.5], [-100, 66, 6], [-134, 54, 4.5], [-148, 18, 3.4], [-138, -18, 2.6],
      [-106, -22, 2], [-80, -8, 2]],
    itemRows: [0.12, 0.4, 0.62, 0.88],
    lava: true,
    bridge: (p) => p.y > 7,
    edge: (p, q, outer) => (outer && (p.x > 100 || p.x < -130) ? 'fall' : 'wall'),
    branches: [
      // passarela da casa de corrida: sem muretas, por cima do metal derretido
      { from: [60, 14], mid: [[92, -14, 4], [98, -46, 5.8]], to: [70, -80], ai: 0.35, edge: () => 'fall', bridge: () => true },
      // rampa do monte de escória: pula o canal de lava e cai na volta oeste
      { from: [-50, 44], mid: [[-86, 44, 8.6], [-112, 30, 8.8], [-130, 10, 9]], launch: { len: 14, rise: 2.6 }, to: [-148, 6], ai: 0.25 },
    ],
  },
};
TRACKS.oficina = {
  name: 'Burgo do Vapor',
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
  // rotatória da torre: dá para passar pelo norte (pista principal) ou pelo sul, rente ao canal
  branches: [{ from: [60, -104], mid: [[22, -92, 0], [0, -91.5, 0], [-22, -93, 0]], to: [-64, -110], ai: 0.5, overlap: 22 }],
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
  name: 'Deserto da Sucata',
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

// ilhas: espiral descendo 1,5 volta em volta do pico (centro -125,-45, raio 26), de 24 a 10 m
const ILHAS_E = [-125, -45];
const spiralDown = Array.from({ length: 17 }, (_, k) => {
  const a = -Math.PI / 2 - (k / 16) * 3 * Math.PI;
  return [ILHAS_E[0] + 26 * Math.cos(a), ILHAS_E[1] + 26 * Math.sin(a), 24 - 14 * (k / 16)];
});
TRACKS.ilhas = {
  name: 'Ilhas das Correntes',
  theme: 'ilhas',
  // tudo no céu: ilha da largada, ponte pênsil descendo, salto entre ilhas, subida de cremalheira,
  // espiral descendo em volta do pico e volta para a ilha da largada
  points: [[-40, 0, 20], [0, 0, 20], [40, 0, 20], [72, -8, 19.5], [96, -30, 17.5], [106, -60, 15], [102, -84, 14],
    [92, -104, 14], [72, -112, 14], [44, -116, 11], [24, -126, 11], [2, -124, 11],
    [-18, -114, 13], [-38, -100, 17], [-56, -88, 21.5], [-74, -80, 24], [-100, -72, 24], ...spiralDown,
    [-100, -17, 11.5], [-75, -8, 14.5], [-58, -2, 17.5]],
  itemRows: [0.06, 0.36, 0.58, 0.86],
  void: true,                                              // embaixo só há nuvens
  islands: [[0, 0, 40, 20], [98, -96, 24, 14], [24, -122, 26, 11], [-86, -78, 22, 24], [-125, -45, 12, 34]],
  spire: ILHAS_E,
  bridge: () => true,
  bridgeEdge: (p, q) => {
    const d = (o) => Math.hypot(o.x - ILHAS_E[0], o.z - ILHAS_E[1]);
    if (d(p) < 34 && d(q) > d(p)) return 'fall';           // espiral: lado de fora sem muro
    if (p.x > 60 && p.x < 104 && p.z < -10 && p.z > -70 && q.x > p.x) return 'fall'; // ponte pênsil: um lado aberto
    return 'wall';
  },
  edge: () => 'wall',
  gap: (p) => p.z < -100 && p.x > 56 && p.x < 63,           // salto entre a 2ª e a 3ª ilha
  kick: { len: 14, rise: 2.6 },
};

export const THEMES = {
  campos: { sky: 0x7ec8ff, fog: 0xb8e2ff, deck: 0x5a3a22, pillar: 0x6b4426, pillarW: 1.0, pillarStep: 7, ground: '#5aa63a', ground2: '#4c9430', shoulder: '#6fb84a', shoulder2: '#5ea53c', skirt: '#8a6a43', wall: ['#ffffff', '#e53935'], decor: 'arvore', music: 0 },
  praia:  { sky: 0x6fd0ff, fog: 0xc9f0ff, deck: 0x6a4a32, pillar: 0x5a4030, pillarW: 0.8, pillarStep: 6, pillarDeep: 2, ground: '#f2d99a', ground2: '#e8cc85', shoulder: '#f5e2aa', shoulder2: '#ead291', skirt: '#d9b870', wall: ['#ffffff', '#1e88e5'], decor: 'coqueiro', music: 1 },
  serra:  { sky: 0xa9c8e8, fog: 0xdfe8f2, ground: '#eef4fa', ground2: '#dde8f2', shoulder: '#f4f8fc', shoulder2: '#e3ecf5', skirt: '#7d8794', wall: ['#ffffff', '#3949ab'], decor: 'pinheiro', music: 2 },
  oficina: { sky: 0x8fbfe0, fog: 0xe9cf9a, light: 0xfff0d8, sun: 0xffdca8, ground: '#8fae5a', ground2: '#7f9e4c', shoulder: '#b7aa94', shoulder2: '#a89a82', skirt: '#a0563a', wall: ['#efe2c2', '#8e3b2a'], decor: 'arvore', decorMin: 50, decorCount: 120, music: 0 },
  pantano: { sky: 0x426e80, fog: 0x4f7a7c, fogNear: 70, fogFar: 560, light: 0xb8d8d8, sun: 0xc8e4dc, lightI: 1.35, sunI: 0.8, ground: '#3e4a2a', ground2: '#34402a', shoulder: '#6e5236', shoulder2: '#5e4630', skirt: '#5e4630', wall: ['#7a5c3c', '#5e4630'], decor: 'arvore', decorCount: 0, deck: 0x4a3622, pillar: 0x5a4030, pillarW: 0.7, pillarStep: 6, pillarDeep: 2, waterColors: ['#2c6266', '#347070', '#94d4c4', '#22504e'], music: 2 },
  sucata: { sky: 0x6cc0dc, fog: 0xf2d8a4, light: 0xfff0d8, sun: 0xffe2b0, ground: '#e2b872', ground2: '#d4a862', shoulder: '#d8ae6a', shoulder2: '#c89c5a', skirt: '#9a6a3a', wall: ['#2a2624', '#2a2624'], decor: 'arvore', decorCount: 0, deck: 0x5a3a2a, pillar: 0x6a3a22, pillarW: 1.2, music: 1 },
  ilhas: { sky: 0x86bce4, fog: 0xe4dccc, fogNear: 160, fogFar: 1100, light: 0xfff0e8, sun: 0xffe4c8, ground: '#6aaa4a', ground2: '#5a9a3e', shoulder: '#6aaa4a', shoulder2: '#5a9a3e', skirt: '#8a6a4a', wall: ['#d8c8a8', '#b8a888'], decor: 'arvore', decorCount: 0, deck: 0x6a4a32, pillarStep: 1e9, music: 0 },
  vulcao: { sky: 0x3a1a24, fog: 0x5a2420, ground: '#3b2a26', ground2: '#2f211e', shoulder: '#5a4038', shoulder2: '#4b352f', skirt: '#2a1e1c', wall: ['#ffb300', '#212121'], decor: 'rocha', music: 3 },
};
