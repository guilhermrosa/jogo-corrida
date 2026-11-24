import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE } from './data.js';
import { pixelTex } from './textures.js';

// =====================================================================
//  Peças comuns dos cenários: galpões por cima de um trecho de pista
//  (principal ou atalho), faixas ao longo da pista, texturas simples,
//  instâncias e fumaça.
// =====================================================================

export const lam = (o) => new THREE.MeshLambertMaterial(o);
export const basic = (o) => new THREE.MeshBasicMaterial(o);
export const phong = (o) => new THREE.MeshPhongMaterial(o);

// faixa ao longo de um caminho P entre os índices i0..i1: prof(t, i) -> [lat, y]
export function strip(P, i0, i1, prof, segs, vScale = 8) {
  const pos = [], uv = [], ix = [];
  let r = 0;
  for (let i = i0; i <= i1; i++, r++) {
    const k = P.wrap(i);
    for (let s = 0; s <= segs; s++) {
      const [lat, y] = prof(s / segs, k);
      const v = P.point(k, lat);
      pos.push(v.x, y, v.z);
      uv.push(s / segs, r / vScale);
      if (r > 0 && s < segs) { const a = (r - 1) * (segs + 1) + s, b = a + segs + 1; ix.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}

// texturas simples de parede
export function boardsTex(base = '#9a3a2a', trim = '#efe2c2') {
  return pixelTex(32, 32, (g, W, H, r) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 4) { g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`; g.fillRect(x, 0, 1, H); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 1, 0, 1, H); }
    g.fillStyle = trim; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 2, W, 2);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,20,10,.25)'; g.fillRect(r() * W, r() * H, 1, 3 + r() * 4); }
  });
}
export function brickTex(base = '#a0563a', mortar = '#5e3324') {
  return pixelTex(32, 32, (g, W, H, r) => {
    g.fillStyle = mortar; g.fillRect(0, 0, W, H);
    for (let y = 0, row = 0; y < H; y += 4, row++) for (let x = row % 2 ? -4 : 0; x < W; x += 8) {
      const k = 0.85 + r() * 0.3; const c = new THREE.Color(base).multiplyScalar(k);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x + 1, y + 1, 7, 3);
    }
  });
}
export function plateTex(base = '#5a524a', rivet = '#c9a24a') {
  return pixelTex(32, 32, (g, W, H, r) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
      g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`; g.fillRect(x + 1, y + 1, 14, 14);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 16, 1); g.fillRect(x, y, 1, 16);
      g.fillStyle = rivet; for (const [a, b] of [[2, 2], [13, 2], [2, 13], [13, 13]]) g.fillRect(x + a, y + b, 1, 1);
    }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(120,50,20,.25)'; g.fillRect(r() * W, r() * H, 2 + r() * 3, 1 + r() * 3); }
  });
}

// galpão comprido cobrindo a pista (paredes, telhado de duas águas, tesouras e lâmpadas)
export function shed(tr, P, i0, i1, { wall, roof = 0x6fb09c, h = 8, ridge = 3, lampColor = 0xffd98a, beams = 0x3b3632, windows = true } = {}) {
  const g = new THREE.Group(); tr.group.add(g);
  const W = EDGE + 0.6;
  if (P === tr) { const prev = tr.inTunnel; tr.inTunnel = (i) => (i >= i0 && i <= i1) || (prev ? prev(i) : false); }
  const wm = lam({ map: wall, side: THREE.DoubleSide });
  for (const s of [1, -1]) g.add(new THREE.Mesh(strip(P, i0, i1, (t, i) => [s * W, P.py[i] - 0.4 + t * (h + 0.4)], 1, 4), wm));
  g.add(new THREE.Mesh(strip(P, i0, i1, (t, i) => { const a = t * 2 - 1; return [a * (W + 0.8), P.py[i] + h + ridge * (1 - Math.abs(a)) - 0.2]; }, 2, 6), lam({ color: roof, side: THREE.DoubleSide })));
  // tesouras, lâmpadas e janelas acesas
  const beamGeo = [], lampGeo = [], winGeo = [];
  for (let i = i0 + 3; i < i1 - 2; i += 7) {
    const k = P.wrap(i), c = P.point(k, 0), yaw = P.heading(k);
    const b = new THREE.BoxGeometry(W * 2, 0.35, 0.35); b.rotateY(yaw); b.translate(c.x, P.py[k] + h - 0.3, c.z); beamGeo.push(b);
    const l = new THREE.BoxGeometry(0.9, 0.3, 0.9); l.translate(c.x, P.py[k] + h - 0.9, c.z); lampGeo.push(l);
    if (windows) for (const s of [1, -1]) {
      const v = P.point(k, s * (W + 0.05));
      const w = new THREE.PlaneGeometry(1.6, 1.4); w.rotateY(yaw + Math.PI / 2); w.translate(v.x, P.py[k] + h * 0.62, v.z); winGeo.push(w);
    }
  }
  if (beamGeo.length) g.add(new THREE.Mesh(mergeGeometries(beamGeo), lam({ color: beams })));
  if (lampGeo.length) g.add(new THREE.Mesh(mergeGeometries(lampGeo), basic({ color: lampColor })));
  if (winGeo.length) g.add(new THREE.Mesh(mergeGeometries(winGeo), basic({ color: 0xffc860, side: THREE.DoubleSide })));
  // fachadas nas duas pontas (frontão acima da entrada)
  for (const i of [i0, i1]) {
    const k = P.wrap(i), c = P.point(k, 0);
    const sh = new THREE.Shape();
    sh.moveTo(-W - 0.8, h - 0.2); sh.lineTo(0, h + ridge); sh.lineTo(W + 0.8, h - 0.2); sh.lineTo(W + 0.8, h - 1.6); sh.lineTo(-W - 0.8, h - 1.6);
    const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), wm);
    f.position.set(c.x, P.py[k], c.z); f.rotation.y = P.heading(k);
    g.add(f);
  }
  return g;
}

// fumaça/vapor subindo de pontos fixos
export function puffs(tr, SPR, points, { color = 0xffffff, rate = 0.35, size = 3, rise = 5, n = 4, opacity = 0.8 } = {}) {
  const map = SPR.fumaca(), ps = [];
  for (const v of points) for (let k = 0; k < n; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, color }));
    tr.group.add(s); ps.push({ s, v, t: k / n });
  }
  return (t, dt) => { for (const p of ps) { p.t = (p.t + dt * rate) % 1; p.s.position.set(p.v.x, p.v.y + p.t * rise, p.v.z); p.s.scale.setScalar(0.6 + p.t * size); p.s.material.opacity = opacity * (1 - p.t); } };
}

// instâncias de uma geometria em várias matrizes
export function instances(tr, geo, mat, mats) {
  if (!mats.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, n) => im.setMatrixAt(n, m));
  tr.group.add(im);
  return im;
}
export const TRS = (x, y, z, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));

// lugar livre perto de (x, z): procura em espiral até achar distância >= need da pista
export function freeNear(tr, x, z, need, maxR = 40) {
  for (let r = 0; r <= maxR; r += 4) for (let a = 0; a < 6.28; a += r ? 4 / r : 7) {
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (tr.dist(px, pz).d >= need) return new THREE.Vector3(px, tr.terrainY(px, pz), pz);
  }
  return null;
}
// em coordenadas do desenho (o modo espelho inverte x)
export const MX = (tr, x) => (tr.mirror ? -x : x);
