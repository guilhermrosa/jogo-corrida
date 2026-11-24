import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =====================================================================
//  Autômatos steampunk desajeitados: corpo de lata ou caldeira, olhos de lâmpada,
//  pernas curtas, balançam, tropeçam, piscam e soltam vapor.
//  Cada robô devolve { group, update(t, dt) }. As peças de cada parte são
//  fundidas numa malha só (cor por vértice) para pesar pouco.
// =====================================================================

const C = { brass: 0xc9a24a, copper: 0xb8673a, tin: 0x9aa0a4, rust: 0x8a4a2a, iron: 0x3b3632, cream: 0xe8dcc0, red: 0xb0322a };
let MAT = null, EYE = null, BULB = null;
function mats() {
  if (!MAT) {
    MAT = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 55, specular: 0x665544 });
    EYE = new THREE.MeshBasicMaterial({ color: 0xffd060 });
    BULB = new THREE.MeshBasicMaterial({ color: 0xff7040 });
  }
}

// junta várias peças [geometria, cor, x, y, z, rx, ry, rz] numa malha com cor por vértice
function part(list) {
  const geos = list.map(([geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
    const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g;
  });
  return new THREE.Mesh(mergeGeometries(geos), MAT);
}
const cyl = (r0, r1, h, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s);
const sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function arm(parent, side, claw, col) {
  const sh = new THREE.Group(); sh.position.set(side * 0.78, 1.55, 0); parent.add(sh);
  sh.add(part([[sph(0.2), C.brass], [cyl(0.09, 0.09, 0.7, 6), col, 0, -0.38, 0]]));
  const el = new THREE.Group(); el.position.set(0, -0.75, 0); sh.add(el);
  const fore = [[sph(0.13, 6, 5), C.brass], [cyl(0.08, 0.08, 0.6, 6), col, 0, -0.32, 0]];
  if (claw) for (const s of [1, -1]) fore.push([box(0.06, 0.28, 0.12), C.iron, s * 0.09, -0.7, 0, 0, 0, s * 0.35]);
  else fore.push([sph(0.14, 6, 5), C.iron, 0, -0.66, 0]);
  el.add(part(fore));
  return { sh, el };
}

// robozinho de lata: corpo de barril, cabeça de cúpula, olhos de lâmpada, antena
export function tinBot(rnd, opts = {}) {
  mats();
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const bc = opts.color ?? [C.copper, C.tin, C.rust, C.brass][(rnd() * 4) | 0];
  const h = 1.3 + rnd() * 0.5, top = 0.75 + h;
  const bodyParts = [[cyl(0.62, 0.7, h, 12), bc, 0, 0.75 + h / 2, 0], [cyl(0.72, 0.72, 0.1, 12), C.brass, 0, 0.85, 0], [cyl(0.72, 0.72, 0.1, 12), C.brass, 0, top - 0.1, 0],
    [new THREE.CircleGeometry(0.22, 12), C.cream, 0, 0.75 + h * 0.5, 0.66]];
  if (opts.mode === 'carry') bodyParts.push([box(0.9, 0.7, 0.7), C.rust, 0, 1.6, 0.75, 0, 0.2, 0]);
  body.add(part(bodyParts));
  const needle = part([[box(0.03, 0.18, 0.02), C.red, 0, 0.08, 0]]); needle.position.set(0, 0.75 + h * 0.5, 0.68); body.add(needle);
  const head = new THREE.Group(); head.position.y = top + 0.05; body.add(head);
  head.add(part([[new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.brass],
    [new THREE.TorusGeometry(0.15, 0.04, 5, 10), C.iron, 0.2, 0.22, 0.47], [new THREE.TorusGeometry(0.15, 0.04, 5, 10), C.iron, -0.2, 0.22, 0.47],
    [cyl(0.025, 0.025, 0.6, 4), C.iron, 0.1, 0.8, 0]]));
  const eyes = new THREE.Mesh(mergeGeometries([new THREE.CircleGeometry(0.13, 10).translate(0.2, 0, 0), new THREE.CircleGeometry(0.13, 10).translate(-0.2, 0, 0)]), EYE);
  eyes.position.set(0, 0.22, 0.48); head.add(eyes);
  const bulb = new THREE.Mesh(sph(0.09, 6, 5), BULB); bulb.position.set(0.1, 1.12, 0); head.add(bulb);
  const A = [arm(body, 1, rnd() < 0.5, C.iron), arm(body, -1, false, C.iron)];
  const L = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.32, 0.8, 0); g.add(hip);
    hip.add(part([[cyl(0.11, 0.11, 0.6, 6), C.iron, 0, -0.3, 0], [box(0.32, 0.14, 0.45), C.brass, 0, -0.68, 0.06]]));
    L.push(hip);
  }
  const ph = rnd() * 10, clumsy = 0.6 + rnd() * 0.8;
  const mode = opts.mode || 'walk';
  let blink = 0;
  const update = (t, dt) => {
    const w = t * (mode === 'cheer' ? 6 : 4) + ph;
    if (mode === 'walk' || mode === 'carry') {
      L[0].rotation.x = Math.sin(w) * 0.5; L[1].rotation.x = -Math.sin(w) * 0.5;
      body.rotation.z = Math.sin(w) * 0.09 * clumsy; body.position.y = Math.abs(Math.sin(w)) * 0.08;
      if (mode === 'carry') { A[0].sh.rotation.x = A[1].sh.rotation.x = -1.3; }
      else { A[0].sh.rotation.x = -Math.sin(w) * 0.6; A[1].sh.rotation.x = Math.sin(w) * 0.6; }
      // tropeça de vez em quando
      const trip = Math.max(0, Math.sin(t * 0.37 + ph) - 0.93) * 8;
      body.rotation.x = trip * 0.5;
    } else if (mode === 'cheer') {
      body.position.y = Math.max(0, Math.sin(w)) * 0.35;
      A[0].sh.rotation.z = 2.4 + Math.sin(w * 1.3) * 0.4; A[1].sh.rotation.z = -2.4 - Math.sin(w * 1.1) * 0.4;
      body.rotation.z = Math.sin(t * 0.7 + ph) * 0.12 * clumsy;
    } else if (mode === 'work') {
      A[0].sh.rotation.x = -1.1 - Math.abs(Math.sin(w * 1.5)) * 0.9; A[0].el.rotation.x = -0.6;
      body.rotation.x = 0.15 + Math.sin(w * 1.5) * 0.05;
    }
    head.rotation.y = Math.sin(t * 0.6 + ph) * 0.6;
    needle.rotation.z = Math.sin(t * 2 + ph) * 0.8;
    blink -= dt;
    if (blink < -3 - (ph % 3)) blink = 0.15;
    eyes.scale.y = blink > 0 ? 0.1 : 1;
    bulb.visible = Math.sin(t * 3 + ph) > 0;
  };
  return { group: g, update };
}

// robô gigante de caldeira: cabeça-chaminé, braços de pistão levantando algo devagar
export function giantBot(rnd, carry) {
  mats();
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  body.add(part([[cyl(2.2, 2.6, 4.6, 16), C.copper, 0, 5.6, 0], [cyl(2.65, 2.65, 0.3, 16), C.brass, 0, 3.6, 0], [cyl(2.65, 2.65, 0.3, 16), C.brass, 0, 5.6, 0],
    [cyl(2.65, 2.65, 0.3, 16), C.brass, 0, 7.6, 0], [new THREE.CircleGeometry(0.9, 16), C.cream, 0, 6, 2.33], [box(1.6, 0.8, 0.1), C.iron, 0, 4.4, 2.4]]));
  const head = new THREE.Group(); head.position.y = 8; body.add(head);
  head.add(part([[cyl(1.3, 1.6, 1.8, 12), C.tin, 0, 0.9, 0], [cyl(0.4, 0.5, 2.6, 10), C.iron, 0.5, 2.9, -0.3]]));
  const eyes = new THREE.Mesh(mergeGeometries([new THREE.CircleGeometry(0.42, 12).translate(0.6, 0, 0), new THREE.CircleGeometry(0.42, 12).translate(-0.6, 0, 0)]), EYE);
  eyes.position.set(0, 1.1, 1.42); head.add(eyes);
  const arms = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(s * 2.7, 7, 0); body.add(sh);
    sh.add(part([[sph(0.7, 10, 8), C.brass], [cyl(0.35, 0.35, 3, 8), C.iron, 0, -1.4, 0.4, -0.3], [cyl(0.5, 0.4, 2.6, 8), C.copper, 0, -3.2, 2, -1.2]]));
    arms.push(sh);
  }
  const held = new THREE.Group(); held.position.set(0, 4.2, 4.2); body.add(held);
  if (carry) held.add(carry);
  g.add(part([[cyl(0.6, 0.7, 3.4, 8), C.iron, 1.2, 1.7, 0], [cyl(0.6, 0.7, 3.4, 8), C.iron, -1.2, 1.7, 0], [box(1.6, 0.6, 2.2), C.brass, 1.2, 0.3, 0.3], [box(1.6, 0.6, 2.2), C.brass, -1.2, 0.3, 0.3]]));
  const ph = rnd() * 6;
  let blink = 0;
  const update = (t, dt) => {
    const lift = (Math.sin(t * 0.5 + ph) + 1) / 2;
    arms.forEach((a) => { a.rotation.x = -lift * 0.9; });
    held.position.y = 4.2 + lift * 3; held.position.z = 4.2 - lift * 0.6;
    held.rotation.z = Math.sin(t * 1.3) * 0.08;
    body.rotation.z = Math.sin(t * 0.9 + ph) * 0.03;
    head.rotation.y = Math.sin(t * 0.3 + ph) * 0.5;
    blink -= dt; if (blink < -4) blink = 0.2;
    eyes.scale.y = blink > 0 ? 0.1 : 1;
  };
  return { group: g, update, smokeAt: new THREE.Vector3(0.5, 12.4, -0.3) };
}
