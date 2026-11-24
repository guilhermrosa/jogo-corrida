import * as THREE from 'three';
import { buildDriverModel } from './drivers3d.js';

// =====================================================================
//  Vitrine dos pilotos: o modelo 3D de verdade (o mesmo que é fotografado
//  para os sprites) num pedestal de latão. Arraste para girar 360°, role
//  para aproximar; parado, ele gira sozinho devagar.
// =====================================================================

export class DriverViewer {
  constructor() {
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x1d2330);
    s.fog = new THREE.Fog(0x1d2330, 9, 22);
    s.add(new THREE.HemisphereLight(0xfff2dc, 0x3a3448, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 6, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
    key.shadow.bias = -0.0005;
    s.add(key);
    const rim = new THREE.DirectionalLight(0xffc890, 1.3); rim.position.set(-4, 3, -5); s.add(rim);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.7); fill.position.set(-3, 1.5, 4); s.add(fill);

    // pedestal: disco de latão com dentes de engrenagem e base de ferro
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.6, roughness: 0.35 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x3b3632, metalness: 0.4, roughness: 0.6 });
    const turn = (this.turn = new THREE.Group()); s.add(turn);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.16, 48), brass); top.position.y = -0.08; top.receiveShadow = true; turn.add(top);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.18), brass);
      t.position.set(Math.cos(a) * 1.96, -0.08, Math.sin(a) * 1.96); t.rotation.y = -a; turn.add(t);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.5, 48), iron); base.position.y = -0.42; base.receiveShadow = true; s.add(base);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x252b38, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.67; floor.receiveShadow = true; s.add(floor);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    this.model = null; this.d = null; this.pose = 0;
    this.rot = -0.6; this.vel = 0; this.tilt = 0.22; this.zk = 1; this.idle = 9;
    this.drag = null;
  }

  show(d, pose = this.pose) {
    if (this.model) { this.turn.remove(this.model); this.model.userData.dispose?.(); }
    this.d = d; this.pose = pose;
    const m = (this.model = buildDriverModel(d, pose));
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.turn.add(m);
    const box = new THREE.Box3().setFromObject(m);
    this.center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.fit = Math.max(size.x, size.y * 1.15, size.z) * 2.6 + 1.4;
  }

  // arrastar com mouse ou dedo
  bind(el) {
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      this.drag = { x: e.clientX, y: e.clientY, t: performance.now() };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const now = performance.now(), dt = Math.max(1, now - this.drag.t) / 1000;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.rot += dx * 0.011;
      this.vel = (dx * 0.011) / dt;
      this.tilt = Math.min(0.75, Math.max(-0.05, this.tilt + dy * 0.004));
      this.drag = { x: e.clientX, y: e.clientY, t: now };
      this.idle = 0;
    });
    const up = () => { this.drag = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  }
  zoom(f) { this.zk = Math.min(1.6, Math.max(0.55, this.zk * f)); }
  spin(dir) { this.vel = dir * 3; this.idle = 0; }

  update(dt, aspect) {
    this.idle += dt;
    if (!this.drag) {
      // inércia do arrasto e, depois de um tempo parado, giro lento sozinho
      const auto = this.idle > 2.5 ? 0.45 : 0;
      this.vel += (auto - this.vel) * Math.min(1, dt * (this.idle > 2.5 ? 0.8 : 2.5));
      this.rot += this.vel * dt;
    }
    this.turn.rotation.y = this.rot;
    const c = this.center || new THREE.Vector3(0, 0.8, 0);
    const cam = this.camera;
    cam.aspect = aspect; cam.updateProjectionMatrix();
    // em tela estreita (celular em pé) afasta um pouco para caber
    const d = (this.fit || 5) * this.zk * (aspect < 1 ? 1 / Math.max(0.55, aspect) : 1);
    cam.position.set(0, c.y + Math.sin(this.tilt) * d, Math.cos(this.tilt) * d);
    // o modelo fica na parte de cima da tela; embaixo ficam as informações e os botões
    cam.lookAt(0, c.y - d * 0.06, 0);
  }

  render(renderer) { renderer.render(this.scene, this.camera); }
}
