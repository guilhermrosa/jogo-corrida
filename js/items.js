import * as THREE from 'three';
import { ITEM_ODDS, ITEM_FX, CPU_ITEM_ODDS, CPU_ITEMS_PER_LAP } from './data.js';
import { EDGE } from './track.js';
import { spriteTexture, drawSprite } from './sprites.js';
import { wrapAngle } from './kart.js';

const SELF_IMMUNE = 0.45;

function pickItem(place, table = ITEM_ODDS) {
  const p = Math.max(0, Math.min(7, place - 1));
  let r = Math.random() * 100;
  for (const [id, odds] of Object.entries(table)) {
    r -= odds[p];
    if (r < 0) return id;
  }
  return 'casca';
}

const COUNT = { pimenta3: 3, casca5: 5, coco3: 3, abelha3: 3 };
const BASE = { pimenta3: 'pimenta', casca5: 'casca', coco3: 'coco', abelha3: 'abelha' };
const DROPPABLE = new Set(['casca', 'presente', 'coco', 'abelha']);

export class ItemSystem {
  constructor(scene, track, karts, getPlace) {
    this.scene = scene;
    this.track = track;
    this.karts = karts;
    this.getPlace = getPlace;
    this.entities = [];
    this.events = [];
    this.boxes = [];
    this.time = 0;
    this.group = new THREE.Group();
    scene.add(this.group);

    // Caixas de itens: cubos girando
    const boxTex = new THREE.CanvasTexture(drawSprite('box', 32));
    boxTex.colorSpace = THREE.SRGBColorSpace;
    this.boxMat = new THREE.MeshLambertMaterial({ map: boxTex, transparent: true, opacity: 0.9, emissive: 0x331144 });
    const fakeTex = new THREE.CanvasTexture(drawSprite('presente', 32));
    fakeTex.colorSpace = THREE.SRGBColorSpace;
    this.fakeMat = new THREE.MeshLambertMaterial({ map: fakeTex, transparent: true, opacity: 0.9, emissive: 0x331144 });
    this.boxGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const v = new THREE.Vector3();
    for (const s of track.itemSpots) {
      const m = new THREE.Mesh(this.boxGeo, this.boxMat);
      track.point(s.idx, s.lat, v);
      m.position.set(v.x, v.y + 1.1, v.z);
      this.group.add(m);
      this.boxes.push({ mesh: m, respawn: 0, base: v.y + 1.1 });
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.boxGeo.dispose(); this.boxMat.dispose(); this.fakeMat.dispose();
    this.entities.forEach((e) => e.obj.material?.dispose?.());
  }

  // ---------------------------------------------------------------- entidades
  spawn(type, owner, pos, extra = {}) {
    let obj;
    if (type === 'presente') {
      obj = new THREE.Mesh(this.boxGeo, this.fakeMat);
    } else {
      obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(type), alphaTest: 0.5 }));
      obj.scale.setScalar(type === 'vespao' ? 1.8 : 1.3);
    }
    obj.position.copy(pos);
    this.group.add(obj);
    const e = { type, owner, pos: obj.position, obj, mode: 'ground', age: 0, vx: 0, vz: 0, vy: 0, idx: owner ? owner.idx : 0, bounces: 0, dead: false, ...extra };
    this.entities.push(e);
    return e;
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    this.group.remove(e.obj);
    if (e.obj.isSprite) e.obj.material.dispose();
  }

  heldOf(k) { return this.entities.filter((e) => !e.dead && e.owner === k && (e.mode === 'held' || e.mode === 'orbit' || e.mode === 'trail')); }

  dropHeld(k) {
    for (const e of this.heldOf(k)) {
      if (e.mode === 'orbit') this.kill(e);
      else { e.mode = 'ground'; e.owner = null; }
    }
    if (k.item && (k.item === 'casca5' || k.item === 'coco3' || k.item === 'abelha3')) { k.item = null; k.itemCount = 0; }
  }

  // ---------------------------------------------------------------- caixas / roleta
  updateBoxes(dt) {
    for (const b of this.boxes) {
      const m = b.mesh;
      if (b.respawn > 0) {
        b.respawn -= dt;
        m.visible = b.respawn <= 0;
        if (m.visible) m.scale.setScalar(0.2);
        continue;
      }
      m.scale.setScalar(Math.min(1, m.scale.x + dt * 3));
      m.rotation.y += dt * 1.6; m.rotation.x += dt * 0.9;
      m.position.y = b.base + Math.sin(this.time * 3 + m.position.x) * 0.15;
      for (const k of this.karts) {
        if (k.rescueT > 0 || k.falling) continue;
        if (Math.abs(k.pos.x - m.position.x) < 1.5 && Math.abs(k.pos.z - m.position.z) < 1.5 && Math.abs(k.pos.y + 1 - m.position.y) < 2) {
          b.respawn = ITEM_FX.boxRespawn;
          m.visible = false;
          this.events.push({ type: 'box', kart: k });
          if ((k.isPlayer) && !k.item && k.rouletteT <= 0 && !this.heldOf(k).length) {
            k.rouletteT = ITEM_FX.roulette;
            k.pendingItem = pickItem(this.getPlace(k));
            if (k.isPlayer) this.events.push({ type: 'roulette', kart: k });
          }
          break;
        }
      }
    }
  }

  // Rivais: recebem itens direto, em até 3 pontos sorteados de cada volta
  cpuGrants(k) {
    if (k.isPlayer) return;
    const N = this.track.N;
    const lap = Math.floor(k.progress / N);
    if (k.grantLap !== lap) {
      k.grantLap = lap;
      k.grantSpots = Array.from({ length: CPU_ITEMS_PER_LAP }, () => Math.floor((0.1 + Math.random() * 0.85) * N)).sort((a, b) => a - b);
    }
    const pos = ((k.progress % N) + N) % N;
    while (k.grantSpots.length && pos >= k.grantSpots[0]) {
      k.grantSpots.shift();
      if (!k.item && !this.heldOf(k).length) { k.item = pickItem(this.getPlace(k), CPU_ITEM_ODDS); k.itemCount = 1; }
    }
  }

  // ---------------------------------------------------------------- usar item (botão Z)
  press(k, aim = 0) {
    if (!k.item || !k.controllable) return;
    const id = k.item;
    const v = new THREE.Vector3();
    switch (id) {
      case 'pimenta': case 'pimenta3':
        if (k.shrunk) return;
        k.boostT = ITEM_FX.boostTime;
        this.events.push({ type: 'boost', kart: k });
        this.consume(k);
        return;
      case 'pimentaOuro':
        if (k.shrunk) return;
        if (k.goldT <= 0) { k.goldT = ITEM_FX.goldTime; k.goldActive = true; }
        k.goldBurst = ITEM_FX.boostTime * 0.7;
        this.events.push({ type: 'boost', kart: k });
        return;
      case 'aura':
        if (k.shrunk) return;
        k.starT = ITEM_FX.starTime; k.shrinkT = 0;
        this.events.push({ type: 'star', kart: k });
        this.consume(k); return;
      case 'sombra': {
        if (k.shrunk) return;
        k.ghostT = ITEM_FX.ghostTime;
        const victims = this.karts.filter((o) => o !== k && o.item && o.rouletteT <= 0 && !this.heldOf(o).length);
        this.consume(k);
        if (victims.length) {
          const o = victims[(Math.random() * victims.length) | 0];
          // rivais do computador só ficam com itens que eles podem usar; o resto é descartado
          if (k.isPlayer || CPU_ITEM_ODDS[o.item]) { k.item = o.item; k.itemCount = o.itemCount; }
          o.item = null; o.itemCount = 0;
          this.events.push({ type: 'steal', kart: k, victim: o });
        }
        this.events.push({ type: 'ghost', kart: k });
        return;
      }
      case 'trovao':
        for (const o of this.karts) {
          if (o === k || o.invincible || o.intangible || o.rescueT > 0) continue;
          this.dropHeld(o);
          o.hit('shrink');
        }
        this.events.push({ type: 'thunder', kart: k });
        this.consume(k); return;
      case 'vespao': {
        k.track = this.track;
        const p = new THREE.Vector3(k.pos.x, k.pos.y + 1.5, k.pos.z);
        this.spawn('vespao', k, p, { mode: 'spiny', idx: k.idx, lat: k.lat, prog: k.progress });
        this.events.push({ type: 'throw', kart: k });
        this.consume(k); return;
      }
      case 'casca5':
      case 'coco3':
      case 'abelha3': {
        const held = this.heldOf(k);
        if (!held.length) {
          // primeiro toque: forma a penca atrás / os 3 girando em volta
          const base = BASE[id];
          for (let n = 0; n < COUNT[id]; n++) {
            const e = this.spawn(base, k, k.pos.clone(), { mode: id === 'casca5' ? 'trail' : 'orbit', slot: n });
            e.angle = (n / 3) * Math.PI * 2;
          }
          k.itemCount = COUNT[id];
          return;
        }
        // toques seguintes: solta/atira um
        const e = held[held.length - 1];
        this.deploy(e, k, aim);
        k.itemCount--;
        if (k.itemCount <= 0) { k.item = null; k.itemCount = 0; }
        return;
      }
      default:
        if (DROPPABLE.has(id)) {
          // segura atrás enquanto o botão estiver apertado
          this.spawn(id, k, k.pos.clone(), { mode: 'held' });
          k.holding = true;
          k.item = null; k.itemCount = 0;
        }
    }
  }

  release(k, aim = 0) {
    if (!k.holding) return;
    k.holding = false;
    const e = this.entities.find((x) => !x.dead && x.owner === k && x.mode === 'held');
    if (e) this.deploy(e, k, aim);
  }

  consume(k) {
    if (COUNT[k.item]) {
      k.itemCount--;
      if (k.itemCount > 0) return;
    }
    k.item = null; k.itemCount = 0;
  }

  deploy(e, k, aim) {
    const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
    e.age = 0; e.owner = k;
    this.events.push({ type: 'throw', kart: k });
    if (e.type === 'coco' || e.type === 'abelha') {
      const back = aim < 0;
      const dir = back ? k.heading + Math.PI : k.heading;
      e.pos.set(k.pos.x + Math.sin(dir) * 2.2, k.pos.y + 0.5, k.pos.z + Math.cos(dir) * 2.2);
      e.idx = k.idx;
      e.heading = dir;
      if (e.type === 'abelha' && !back) {
        e.mode = 'homing';
        e.target = this.targetAhead(k);
        e.lat = k.lat;
      } else {
        e.mode = 'shell';
      }
    } else {
      // casca / presente: solta atrás ou arremessa para frente
      if (aim > 0) {
        e.mode = 'arc';
        e.pos.set(k.pos.x + fx * 1.5, k.pos.y + 1.2, k.pos.z + fz * 1.5);
        const sp = Math.max(k.speed, 0) + 12;
        e.vx = fx * sp; e.vz = fz * sp; e.vy = 6;
        e.idx = k.idx;
      } else {
        e.mode = 'ground';
        e.pos.set(k.pos.x - fx * 2.4, k.pos.y, k.pos.z - fz * 2.4);
        e.idx = k.idx;
      }
    }
  }

  targetAhead(k) {
    let best = null, bd = Infinity;
    for (const o of this.karts) {
      if (o === k || o.finished) continue;
      const d = o.progress - k.progress;
      if (d > 0 && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  leader() {
    let best = null;
    for (const o of this.karts) if (!o.finished && (!best || o.progress > best.progress)) best = o;
    return best;
  }

  // ---------------------------------------------------------------- simulação
  update(dt) {
    this.time += dt;
    const tr = this.track;
    this.updateBoxes(dt);

    // roletas e itens com tempo
    for (const k of this.karts) {
      this.cpuGrants(k);
      if (k.rouletteT > 0) {
        k.rouletteT -= dt;
        if (k.rouletteT <= 0) {
          k.item = k.pendingItem; k.itemCount = COUNT[k.item] || 1;
          if (k.isPlayer) this.events.push({ type: 'got', kart: k });
        }
      }
      if (k.item === 'pimentaOuro' && k.goldActive && k.goldT <= 0) { k.item = null; k.goldActive = false; }
    }

    for (const e of this.entities) {
      if (e.dead) continue;
      e.age += dt;
      const o = e.owner;
      switch (e.mode) {
        case 'held': case 'trail': {
          if (!o || o.rescueT > 0) { this.kill(e); break; }
          const back = 1.6 + (e.mode === 'trail' ? e.slot * 1.2 : 0);
          e.pos.set(o.pos.x - Math.sin(o.heading) * back, o.pos.y + 0.4, o.pos.z - Math.cos(o.heading) * back);
          break;
        }
        case 'orbit': {
          if (!o || o.rescueT > 0) { this.kill(e); break; }
          e.angle += dt * 6;
          e.pos.set(o.pos.x + Math.sin(e.angle) * 1.8, o.pos.y + 0.6, o.pos.z + Math.cos(e.angle) * 1.8);
          break;
        }
        case 'arc': {
          e.vy -= 25 * dt;
          e.pos.x += e.vx * dt; e.pos.z += e.vz * dt; e.pos.y += e.vy * dt;
          e.idx = tr.nearest(e.pos.x, e.pos.z, e.idx);
          const lat = tr.lateral(e.pos.x, e.pos.z, e.idx);
          const g = tr.groundY(e.pos.x, e.pos.z, e.idx);
          if (Math.abs(lat) > EDGE && tr.isFall(e.idx, lat) && e.pos.y < g - 1) { this.kill(e); break; }
          if (e.pos.y <= g && e.vy < 0) { e.pos.y = g; e.mode = 'ground'; }
          break;
        }
        case 'ground':
          break;
        case 'shell': this.moveShell(e, dt); break;
        case 'homing': this.moveHoming(e, dt); break;
        case 'spiny': this.moveSpiny(e, dt); break;
      }
      if (e.dead) continue;
      if (e.obj.isMesh) { e.obj.rotation.y += dt * 2; e.obj.position.y = e.pos.y + (e.mode === 'ground' ? 0.65 : 0); }
      if (e.type === 'abelha' || e.type === 'vespao') e.obj.material.rotation = Math.sin(this.time * 30) * 0.12;
      this.collide(e);
    }
    this.entities = this.entities.filter((e) => !e.dead);
  }

  moveShell(e, dt) {
    const tr = this.track;
    const sp = ITEM_FX.shellSpeed;
    e.pos.x += Math.sin(e.heading) * sp * dt;
    e.pos.z += Math.cos(e.heading) * sp * dt;
    e.idx = tr.nearest(e.pos.x, e.pos.z, e.idx);
    const lat = tr.lateral(e.pos.x, e.pos.z, e.idx);
    e.pos.y = tr.groundY(e.pos.x, e.pos.z, e.idx) + 0.5;
    if (Math.abs(lat) > EDGE - 0.4) {
      if (tr.isFall(e.idx, lat)) { this.kill(e); return; }
      // quica no muro
      const th = tr.heading(e.idx);
      e.heading = wrapAngle(th - wrapAngle(e.heading - th));
      const push = (Math.abs(lat) - (EDGE - 0.4)) * Math.sign(lat);
      e.pos.x += tr.tz[e.idx] * push; e.pos.z -= tr.tx[e.idx] * push;
      e.bounces++;
      this.events.push({ type: 'bounce', pos: e.pos });
      if (e.bounces > ITEM_FX.shellBounces) this.kill(e);
    }
    if (e.age > ITEM_FX.shellLife) this.kill(e);
  }

  moveHoming(e, dt) {
    const tr = this.track;
    const t = e.target;
    const sp = ITEM_FX.homingSpeed;
    const close = t && !t.finished && t.rescueT <= 0 && Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) < 18;
    if (close) {
      const want = Math.atan2(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
      e.heading = wrapAngle(e.heading + wrapAngle(want - e.heading) * Math.min(1, 10 * dt));
    } else {
      // segue a pista até chegar perto do alvo
      const ahead = (e.idx + 8) % tr.N;
      const wantLat = t ? Math.max(-4, Math.min(4, t.lat)) : 0;
      e.lat += (wantLat - e.lat) * Math.min(1, 2 * dt);
      const px = tr.px[ahead] - tr.tz[ahead] * e.lat, pz = tr.pz[ahead] + tr.tx[ahead] * e.lat;
      const want = Math.atan2(px - e.pos.x, pz - e.pos.z);
      e.heading = wrapAngle(e.heading + wrapAngle(want - e.heading) * Math.min(1, 8 * dt));
    }
    e.pos.x += Math.sin(e.heading) * sp * dt;
    e.pos.z += Math.cos(e.heading) * sp * dt;
    e.idx = tr.nearest(e.pos.x, e.pos.z, e.idx);
    const lat = tr.lateral(e.pos.x, e.pos.z, e.idx);
    e.pos.y = tr.groundY(e.pos.x, e.pos.z, e.idx) + 0.6;
    if (Math.abs(lat) > EDGE - 0.3) this.kill(e); // abelha bate no muro e some
    if (e.age > 14) this.kill(e);
  }

  moveSpiny(e, dt) {
    const tr = this.track;
    const t = this.leader();
    if (!t) { this.kill(e); return; }
    const gap = t.progress - e.prog;
    if (gap < 6 && Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) < 8) {
      // mergulha no líder
      const want = new THREE.Vector3(t.pos.x, t.pos.y + 0.5, t.pos.z);
      e.pos.lerp(want, Math.min(1, 6 * dt));
      if (e.pos.distanceTo(want) < 1) {
        for (const o of this.karts) if (o.pos.distanceTo(t.pos) < 5) { this.dropHeld(o); o.hit('blast'); }
        this.events.push({ type: 'blast', pos: e.pos.clone() });
        this.kill(e);
      }
      return;
    }
    // voa pela pista atropelando quem estiver no caminho
    const step = ITEM_FX.spinySpeed * dt / tr.step;
    e.prog += step;
    e.idx = tr.wrap(Math.floor(e.prog));
    e.lat += ((Math.abs(gap) < 40 ? t.lat : 0) - e.lat) * Math.min(1, 3 * dt);
    tr.point(e.idx, e.lat, e.pos);
    e.pos.y += 2.2;
    if (e.age > 40) this.kill(e);
  }

  collide(e) {
    if (e.dead) return;
    const reach = e.type === 'presente' ? 1.5 : 1.25;
    // contra karts
    for (const k of this.karts) {
      if (k.intangible || k.rescueT > 0 || k.falling) continue;
      if (k === e.owner && (e.mode === 'held' || e.mode === 'orbit' || e.mode === 'trail' || e.mode === 'spiny' || e.age < SELF_IMMUNE)) continue;
      if (e.mode === 'spiny' && k === this.leader()) continue;
      const dy = Math.abs(k.pos.y + 0.5 - e.pos.y);
      if (dy > (e.mode === 'spiny' ? 3 : 1.6)) continue;
      if (Math.hypot(k.pos.x - e.pos.x, k.pos.z - e.pos.z) > reach) continue;
      const effect = e.type === 'casca' ? 'spin' : 'tumble';
      if (k.hit(effect) || k.invincible) {
        if (!k.invincible) this.dropHeld(k);
        this.events.push({ type: 'hitItem', kart: k, by: e.owner });
        if (e.mode !== 'spiny') this.kill(e);
        if (e.mode === 'orbit' && e.owner) this.afterOrbitLoss(e.owner);
        return;
      }
    }
    // item contra item (cocos e abelhas destroem cascas, presentes e itens segurados)
    if (e.mode === 'shell' || e.mode === 'homing') {
      for (const o of this.entities) {
        if (o === e || o.dead || o.mode === 'spiny') continue;
        if (o.owner === e.owner && e.age < SELF_IMMUNE) continue;
        if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 1.2 && Math.abs(o.pos.y - e.pos.y) < 1.5) {
          if (o.mode === 'orbit' && o.owner) this.afterOrbitLoss(o.owner);
          this.kill(o); this.kill(e);
          this.events.push({ type: 'bounce', pos: e.pos });
          return;
        }
      }
    }
  }

  afterOrbitLoss(k) {
    if (k.item === 'coco3' || k.item === 'abelha3' || k.item === 'casca5') {
      k.itemCount = Math.max(0, k.itemCount - 1);
      if (k.itemCount === 0) k.item = null;
    }
  }
}
