import * as THREE from 'three';
import { TOP_SPEED, CLASS_STATS, UNIT, DRIVE, ITEM_FX } from './data.js';
import { ROAD_HALF, EDGE } from './track.js';
import { follow } from './branch.js';
import { FRAMES, POSES, SPRITE_WORLD, SPRITE_GROUND, spriteTexture } from './sprites.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

const GRAVITY = 28;
const RADIUS = 0.85;
const SMOKE_COLORS = [0xffffff, 0xffe14a, 0xff3b1f]; // branco -> amarelo -> vermelho

export class Kart {
  constructor(scene, driver, bake, cc, { isPlayer = false } = {}) {
    this.scene = scene;
    this.driver = driver;
    this.name = driver.name;
    this.isPlayer = isPlayer;
    this.stats = CLASS_STATS[driver.cls];
    this.weight = driver.weight;
    this.sizeK = driver.size / 5.5;           // Rino e Juca são maiores, como Wario e Bowser
    this.radius = RADIUS * this.sizeK;
    this.setCC(cc);

    // sprite com o atlas pré-renderizado
    const tex = new THREE.CanvasTexture(bake.atlas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / FRAMES, 1 / POSES);
    this.tex = tex;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false }));
    this.sprite.center.set(0.5, SPRITE_GROUND);
    this.baseScale = SPRITE_WORLD * this.sizeK;
    this.sprite.scale.set(this.baseScale, this.baseScale, 1);
    scene.add(this.sprite);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: spriteTexture('sombraChao'), transparent: true, depthWrite: false })
    );
    scene.add(this.shadow);

    // fumaça da derrapagem e da grama
    this.smoke = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture('fumaca'), transparent: true, depthWrite: false }));
      s.visible = false;
      s.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
      scene.add(s);
      this.smoke.push(s);
    }
    this.smokeIdx = 0;
    this.smokeTimer = 0;

    this.pos = new THREE.Vector3();
    this.reset();
  }

  setCC(cc) {
    this.cc = cc;
    this.top = TOP_SPEED[this.driver.cls][cc === 'espelho' ? 100 : cc] * UNIT;
  }

  reset() {
    this.speed = 0; this.heading = 0; this.steer = 0; this.slip = 0;
    this.vy = 0; this.airborne = false;
    this.hopT = 0; this.hopHeld = false;
    this.drift = 0; this.driftStage = 0; this.driftAge = 0; this.outT = 0; this.outwardHold = 0;
    this.mtT = 0; this.boostT = 0; this.goldT = 0; this.starT = 0; this.shrinkT = 0; this.squashT = 0; this.ghostT = 0;
    this.spinT = 0; this.tumbleT = 0; this.tumbleKind = ''; this.burnoutT = 0; this.draftT = 0; this.draftBoostT = 0;
    this.fallT = 0; this.rescueT = 0; this.falling = false; this.graceT = 0;
    this.idx = 0; this.lat = 0; this.progress = 0; this.lapsDone = 0; this.lapStart = 0; this.lapTimes = [];
    this.finished = false; this.finishTime = 0; this.autopilot = false;
    this.wrongWay = 0; this.safeIdx = 0; this.stuck = 0;
    this.path = null; this.bidx = 0; this.safePath = null; this.flying = false; this.flyT = 0;
    this.prevThrottle = false; this.lastTap = -1; this.lastBrakeT = -10; this.clock = 0;
    this.item = null; this.itemCount = 0; this.rouletteT = 0; this.holding = false;
    this.events = [];
    this.turnVis = 0;
  }

  dispose() {
    this.scene.remove(this.sprite, this.shadow, ...this.smoke);
    this.tex.dispose();
    this.sprite.material.dispose();
    this.shadow.geometry.dispose(); this.shadow.material.dispose();
    this.smoke.forEach((s) => s.material.dispose());
  }

  place(track, idx, lat) {
    idx = track.wrap(Math.round(idx));
    track.point(idx, lat, this.pos);
    this.heading = track.heading(idx);
    this.idx = idx; this.safeIdx = idx; this.lat = lat; this.path = null; this.safePath = null; this.flying = false;
    this.progress = idx > track.N / 2 ? idx - track.N : idx;
  }

  get controllable() {
    return this.spinT <= 0 && this.tumbleT <= 0 && this.squashT <= 0 && this.burnoutT <= 0 && this.rescueT <= 0 && !this.falling;
  }
  get invincible() { return this.starT > 0; }
  get intangible() { return this.ghostT > 0; }
  get shrunk() { return this.shrinkT > 0; }
  get boosting() { return this.boostT > 0 || this.mtT > 0 || this.goldBurst > 0; }

  // ------------------------------------------------------------ reações a itens / batidas
  // cause = o que atingiu (para avisar o jogador); by = quem lançou
  hit(kind, cause = kind, by = null) {
    if (this.rescueT > 0 || this.falling) return false;
    if (this.invincible && kind !== 'squash') return false;
    if (this.intangible) return false;
    // já está rodando/capotado ou acabou de se recuperar: não apanha de novo em sequência
    if (this.graceT > 0 || this.spinT > 0 || this.tumbleT > 0 || this.squashT > 0) {
      if (kind === 'shrink' && !this.shrunk) { this.shrinkT = ITEM_FX.shrinkTime; this.lastHit = { kind, cause, by, t: this.clock }; this.events.push('hit'); return true; }
      return false;
    }
    // Frear no momento certo ao passar numa casca evita a rodada (só derrapa)
    if (kind === 'spin' && this.clock - this.lastBrakeT < 0.25 && Math.abs(this.steer) < 0.3) {
      this.speed *= 0.6;
      this.events.push('skid');
      this.lastHit = { kind: 'skid', cause, by, t: this.clock };
      return true;
    }
    this.drift = 0; this.driftStage = 0; this.mtT = 0; this.boostT = 0;
    const rec = this.fastRecover ? 0.5 : 1;   // no 150cc os 2 rivais se recuperam rápido
    if (kind === 'spin') { this.spinT = ITEM_FX.spinTime * rec; this.speed = Math.min(this.speed, this.top * 0.45); }
    else if (kind === 'tumble') { this.tumbleT = ITEM_FX.tumbleTime * rec; this.tumbleKind = 'tumble'; this.speed = 0; this.vy = 7; this.airborne = true; }
    else if (kind === 'blast') { this.tumbleT = ITEM_FX.blastTime * rec; this.tumbleKind = 'blast'; this.speed = 0; this.vy = 11; this.airborne = true; }
    else if (kind === 'squash') { this.squashT = ITEM_FX.squashTime; this.speed = 0; }
    else if (kind === 'shrink') { this.shrinkT = ITEM_FX.shrinkTime; this.spinT = 0.8; this.speed *= 0.5; }
    this.graceT = Math.max(this.spinT, this.tumbleT, this.squashT) + 0.6;
    this.lastHit = { kind, cause, by, t: this.clock };
    this.events.push('hit');
    return true;
  }

  // ------------------------------------------------------------ física
  update(dt, input, track, raceOn) {
    this.clock += dt;
    const T = (k) => (this[k] = Math.max(0, this[k] - dt));
    ['mtT', 'boostT', 'goldT', 'starT', 'ghostT', 'spinT', 'tumbleT', 'squashT', 'burnoutT', 'draftBoostT', 'graceT'].forEach(T);
    if (this.shrinkT > 0) { this.shrinkT -= dt; if (this.shrinkT <= 0) { this.shrinkT = 0; this.events.push('grow'); } }
    this.goldBurst = Math.max(0, (this.goldBurst || 0) - dt);
    if (input.brake) this.lastBrakeT = this.clock;

    // resgate pela coruja
    if (this.rescueT > 0) { this.updateRescue(dt, track, input); return; }

    const ctrl = this.controllable && raceOn;
    const onGround = !this.airborne;
    const offroad = onGround && Math.abs(this.lat) > ROAD_HALF + 0.4 && !this.falling;

    // velocidade máxima efetiva
    let top = this.top;
    if (this.shrunk) top *= ITEM_FX.shrinkMul;
    if (offroad && !this.invincible && this.boostT <= 0 && this.goldBurst <= 0) top *= this.stats.offroad;
    if (this.invincible) top = this.top * ITEM_FX.starMul;
    if (this.draftBoostT > 0) top *= 1.06;
    let boostTop = 0;
    if (this.boostT > 0 || this.goldBurst > 0) boostTop = this.top * ITEM_FX.boostMul;
    if (this.mtT > 0) boostTop = Math.max(boostTop, this.top * this.stats.mtBoost);

    // ----- aceleração
    const throttle = ctrl && input.throttle;
    const fresh = throttle && !this.prevThrottle;
    this.prevThrottle = ctrl && input.throttle;
    if (fresh && this.speed < this.top * 0.5 && onGround) {
      // "toque triplo": tocar repetidamente no acelerador recupera velocidade mais rápido
      if (this.clock - this.lastTap < 0.25) this.speed += this.driver.tap * 0.35;
      this.lastTap = this.clock;
    }

    if (this.spinT > 0) {
      this.speed = Math.max(0, this.speed - 9 * dt);
    } else if (this.tumbleT > 0 || this.squashT > 0 || this.burnoutT > 0) {
      this.speed = Math.max(0, this.speed - 25 * dt);
    } else if (boostTop > 0 && onGround) {
      if (this.speed < boostTop) this.speed = Math.min(boostTop, this.speed + 32 * dt);
    } else if (onGround) {
      if (throttle) {
        if (this.speed < 0) this.speed += 16 * dt;
        else if (this.speed < top) this.speed += this.stats.accel * (1 - 0.72 * clamp(this.speed / this.top, 0, 1)) * dt;
      } else if (ctrl && input.brake) {
        if (this.speed > 0) this.speed -= 16 * dt;
        else if (this.speed > -3.2) this.speed -= 5 * dt;
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3.5 * dt);
      }
      if (this.speed > top) this.speed = Math.max(top, this.speed - (offroad ? 16 : 7) * dt);
    }

    // ----- direção
    const steerIn = ctrl ? input.steer : 0;
    if (input.analog) this.steer = steerIn;
    else this.steer += clamp(steerIn - this.steer, -8 * dt, 8 * dt);

    // ----- pulinho (R) e derrapagem
    const hopFresh = ctrl && input.hop && !this.hopHeld;
    this.hopHeld = ctrl && input.hop;
    if (hopFresh && onGround && this.hopT <= 0) {
      this.hopT = DRIVE.hopTime;
      this.events.push('hop');
    }
    if (this.hopT > 0) {
      this.hopT -= dt;
      if (this.hopT <= 0 && this.hopHeld && Math.abs(steerIn) > 0.3 && this.speed > this.top * 0.3 && !this.drift) {
        this.drift = Math.sign(steerIn);
        this.driftStage = 0; this.driftAge = 0; this.outT = 0; this.outwardHold = 0;
      }
    }
    if (this.drift) {
      const inward = steerIn * this.drift; // direcional cru, como o analógico do N64
      this.driftAge += dt;
      // Mini-turbo: direcional para fora (ou solto) e depois para dentro, duas vezes: branco -> amarelo -> vermelho
      if (inward < 0.25) this.outT += dt;
      if (inward > 0.5) {
        if (this.outT >= DRIVE.wiggleMinOut && this.driftAge >= DRIVE.driftArmTime && this.driftStage < 2) {
          this.driftStage++;
          this.events.push('stage' + this.driftStage);
        }
        this.outT = 0;
      }
      // segurar para fora por tempo demais = rodada
      this.outwardHold = inward < -0.6 ? this.outwardHold + dt : 0;
      if (this.outwardHold > DRIVE.spinOutAfter * 0.5 && !this.spinWarned) { this.spinWarned = true; this.events.push('spinWarn'); }
      if (this.outwardHold === 0) this.spinWarned = false;
      if (this.outwardHold > DRIVE.spinOutAfter) {
        this.drift = 0; this.driftStage = 0;
        this.spinT = 0.9;
        this.lastHit = { kind: 'spin', cause: 'derrapagem', by: null, t: this.clock };
        this.events.push('hit');
      } else if (!this.hopHeld || this.speed < this.top * 0.25 || !ctrl) {
        if (this.driftStage === 2 && ctrl) { this.mtT = DRIVE.mtFrames / 60; this.events.push('mt'); }
        this.drift = 0; this.driftStage = 0;
      }
    }

    // giro
    const sf = clamp(Math.abs(this.speed) / 4, 0, 1) * (1 - 0.18 * clamp(this.speed / this.top, 0, 1));
    let yaw;
    if (this.drift) {
      const inward = this.steer * this.drift;
      yaw = this.drift * this.stats.turn * (0.95 + 0.6 * inward);
    } else {
      yaw = this.steer * this.stats.turn * 1.3;
    }
    if (this.airborne) yaw *= 0.5;
    if (this.spinT > 0) yaw = 0;
    this.turnVis = yaw * sf;
    this.heading = wrapAngle(this.heading + yaw * sf * dt * (this.speed >= 0 ? 1 : -1));
    const slipTarget = this.drift ? this.drift * 0.32 : 0;
    this.slip += (slipTarget - this.slip) * Math.min(1, 8 * dt);

    // ----- movimento
    const moveAngle = this.heading - this.slip;
    this.pos.x += Math.sin(moveAngle) * this.speed * dt;
    this.pos.z += Math.cos(moveAngle) * this.speed * dt;

    // pista principal ou atalho
    const prevIdx = this.idx;
    const fw = follow(track, this);
    const S = fw.S, newIdx = fw.si;
    const midx = this.path ? this.path.mainIdx[newIdx] : newIdx;
    let d = midx - prevIdx;
    if (d > track.N / 2) d -= track.N;
    if (d < -track.N / 2) d += track.N;
    this.progress += d;
    this.idx = midx;
    this.lat = fw.lat;
    if (fw.exit === 'launch' && !this.falling) { this.flying = true; this.flyT = 0; this.airborne = true; this.drift = 0; }

    // ----- bordas: muro (quica) ou queda
    const lim = EDGE - this.radius;
    if (Math.abs(this.lat) > lim && !this.falling && !this.flying) {
      if (S.isFall(newIdx, this.lat)) {
        if (Math.abs(this.lat) > EDGE + 0.3) { this.falling = true; this.fallT = 0; this.airborne = true; this.drift = 0; }
      } else {
        const push = (Math.abs(this.lat) - lim) * Math.sign(this.lat);
        this.pos.x -= -S.tz[newIdx] * push;
        this.pos.z -= S.tx[newIdx] * push;
        this.lat -= push;
        const th = S.heading(newIdx);
        const rel = wrapAngle(this.heading - th);
        // velocidade lateral (positiva = para o lado +): -sin(rel) * v. Indo contra o muro? espelha o ângulo (quique)
        const into = -Math.sin(rel) * this.speed * Math.sign(this.lat);
        if (into > 0.3) {
          const fwd = Math.abs(rel) < Math.PI / 2;
          const along = fwd ? th : th + Math.PI;           // direção paralela ao muro
          const relAlong = wrapAngle(this.heading - along);
          if (Math.abs(Math.sin(rel)) > 0.85) {
            // de frente no muro: o kart quica para trás
            this.speed = -this.speed * 0.25;
          } else {
            // de raspão: alinha com o muro e afasta um pouco, sem girar de repente
            this.heading = wrapAngle(along - relAlong * 0.25);
            this.speed *= 0.7;
          }
          this.events.push('wall');
        }
      }
    }

    // ----- altura: chão / ar
    const ground = S.groundY(this.pos.x, this.pos.z, newIdx);
    const predicted = this.pos.y + this.vy * dt - 0.5 * GRAVITY * dt * dt;
    if (this.falling) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      this.fallT += dt;
      if (this.pos.y < Math.min(track.hazardY, ground - 2.5) || this.fallT > 1.6) {
        this.events.push(track.def.lava ? 'lava' : track.def.water || track.def.swampWater ? 'splash' : 'fall');
        this.startRescue(track);
      }
    } else if (!this.airborne && S.gap[newIdx]) {
      // chegou ao vão da ponte quebrada sem estar no ar: cai
      this.falling = true; this.fallT = 0; this.airborne = true; this.drift = 0;
    } else if (!this.airborne) {
      if (ground >= predicted - 0.02 || this.tumbleT > 0) {
        this.vy = (ground - this.pos.y) / Math.max(dt, 1e-4);
        this.pos.y = ground;
      } else {
        this.airborne = true;
        this.pos.y = predicted;
        this.vy -= GRAVITY * dt;
      }
    } else if (this.flying) {
      // saltou da ponta de um atalho: só pousa se cair em cima da pista
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      this.flyT += dt;
      const over = Math.abs(this.lat) <= EDGE - 0.2;
      if (over && this.pos.y <= ground && this.vy < 0) {
        if (this.vy < -6) this.events.push('land');
        this.pos.y = ground; this.vy = 0; this.airborne = false; this.flying = false;
      } else if ((!over && this.pos.y < ground - 2) || this.pos.y < ground - 4 || this.flyT > 4) {
        this.flying = false; this.falling = true; this.fallT = 0;
      }
    } else {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground && S.gap[newIdx] && this.vy < 0) {
        this.falling = true; this.fallT = 0; // caiu dentro do vão
      } else if (this.pos.y <= ground) {
        if (this.vy < -6) this.events.push('land');
        this.pos.y = ground; this.vy = 0; this.airborne = false;
      }
    }
    if (!this.airborne && !this.falling && Math.abs(this.lat) < ROAD_HALF) { this.safeIdx = newIdx; this.safePath = this.path; }

    // contramão
    const relTrack = wrapAngle(this.heading - S.heading(newIdx));
    this.wrongWay = Math.abs(relTrack) > 1.9 && this.speed > 2 ? this.wrongWay + dt : 0;
  }

  // ------------------------------------------------------------ resgate
  startRescue(track) {
    this.falling = false;
    this.airborne = false;
    this.rescueT = 2.6;
    this.speed = 0; this.drift = 0; this.driftStage = 0; this.boostT = 0; this.mtT = 0;
    this.rescueFrom = this.pos.clone();
    this.flying = false;
    const sp = this.safePath;
    if (sp) {
      // caiu num atalho: atalho de salto (ou com vão) volta para antes da entrada; os outros voltam no próprio atalho
      if (sp.launch || sp.gap.some((g) => g)) { this.rescuePath = null; this.setRescue(track, track.wrap(sp.ia - 6)); }
      else { this.rescuePath = sp; this.setRescue(sp, Math.max(0, this.safeIdx - 4)); }
      this.events.push('rescue');
      return;
    }
    this.rescuePath = null;
    let idx = track.wrap(this.safeIdx - 4);
    // caiu no vão da ponte quebrada: a coruja leva para o outro lado (parado não dá para pular)
    for (let k = 0; k < 40; k++) if (track.gap[track.wrap(this.safeIdx + k)]) {
      let e = track.wrap(this.safeIdx + k);
      while (track.gap[e]) e = track.wrap(e + 1);
      idx = track.wrap(e + 3);
      break;
    }
    this.setRescue(track, idx);
    this.events.push('rescue');
  }

  setRescue(P, idx) {
    this.rescueTo = P.point(idx, 0);
    this.rescueTo.y = P.py[idx];
    this.rescueIdx = idx;
    this.rescueHeading = P.heading(idx);
  }

  updateRescue(dt, track, input) {
    this.rescueT -= dt;
    const t = 2.6 - this.rescueT;
    if (t < 0.6) {
      // coruja desce até o kart
    } else if (t < 1.9) {
      const k = (t - 0.6) / 1.3;
      const e = k * k * (3 - 2 * k);
      this.pos.lerpVectors(this.rescueFrom, this.rescueTo, e);
      this.pos.y = THREE.MathUtils.lerp(this.rescueFrom.y, this.rescueTo.y, e) + Math.sin(e * Math.PI) * 6 + 3 * e;
      this.heading = wrapAngle(this.heading + wrapAngle(this.rescueHeading - this.heading) * Math.min(1, 4 * dt));
    } else {
      const k = (t - 1.9) / 0.7;
      this.pos.copy(this.rescueTo);
      this.pos.y = this.rescueTo.y + 3 * (1 - k);
      this.heading = this.rescueHeading;
    }
    if (this.rescueT <= 0) {
      this.rescueT = 0;
      this.pos.copy(this.rescueTo);
      // volta para a pista (ou atalho) certa e corrige o progresso da volta
      const P = this.rescuePath;
      const midx = P ? P.mainIdx[this.rescueIdx] : this.rescueIdx;
      let d = midx - this.idx;
      if (d > track.N / 2) d -= track.N;
      if (d < -track.N / 2) d += track.N;
      this.progress += d;
      this.path = P; this.bidx = this.rescueIdx; this.safePath = P;
      this.idx = midx; this.safeIdx = this.rescueIdx; this.lat = 0;
      this.vy = 0;
      // segurar o acelerador ao ser solto: sai com embalo
      if (input.throttle) this.speed = this.top * 0.5;
    }
  }

  // ------------------------------------------------------------ visual (sprite no ângulo certo)
  syncView(dt, camera) {
    const dx = this.pos.x - camera.position.x, dz = this.pos.z - camera.position.z;
    const view = Math.atan2(dx, dz);
    let rel = wrapAngle(this.heading - view);
    if (this.spinT > 0) rel = wrapAngle(rel + this.clock * 18);
    if (this.squashT <= 0 && this.tumbleT > 0) rel = wrapAngle(rel + this.clock * 12);
    let f = Math.round((rel / (Math.PI * 2)) * FRAMES);
    f = ((f % FRAMES) + FRAMES) % FRAMES;
    const hurt = this.spinT > 0 || this.tumbleT > 0 || this.squashT > 0;
    this.celebrateT = Math.max(0, (this.celebrateT || 0) - dt);
    const pose = hurt ? 4 : this.celebrateT > 0 ? 3
      : this.drift ? (this.drift > 0 ? 1 : 2) : this.steer > 0.4 ? 1 : this.steer < -0.4 ? 2 : 0;
    this.tex.offset.set(f / FRAMES, 1 - (pose + 1) / POSES);

    const hop = this.hopT > 0 ? Math.sin((1 - this.hopT / DRIVE.hopTime) * Math.PI) * DRIVE.hopHeight : 0;
    this.sprite.position.set(this.pos.x, this.pos.y + hop + 0.02, this.pos.z);
    let sx = this.baseScale, sy = this.baseScale;
    if (this.shrunk) { sx *= 0.5; sy *= 0.5; }
    if (this.squashT > 0) { sy *= 0.3; sx *= 1.3; }
    this.sprite.scale.set(sx, sy, 1);
    this.sprite.material.rotation = this.tumbleT > 0 ? Math.sin(this.clock * 20) * 0.5 : 0;
    const mat = this.sprite.material;
    if (this.intangible) { mat.transparent = true; mat.opacity = this.isPlayer ? 0.35 : 0.0; mat.alphaTest = 0.01; }
    else { mat.transparent = false; mat.opacity = 1; mat.alphaTest = 0.5; }
    mat.color.setHex(this.invincible ? [0xffffff, 0xffe082, 0xff8a80, 0x80d8ff][Math.floor(this.clock * 16) % 4] : 0xffffff);

    this.shadow.visible = !this.falling && !this.intangible;
    this.shadow.position.set(this.pos.x, (this.airborne ? this.pos.y - 0.2 : this.pos.y) + 0.1, this.pos.z);

    // fumaça
    this.smokeTimer -= dt;
    const offroad = !this.airborne && Math.abs(this.lat) > ROAD_HALF + 0.4 && Math.abs(this.speed) > 4;
    if ((this.drift || offroad || this.mtT > 0 || this.burnoutT > 0) && this.smokeTimer <= 0) {
      this.smokeTimer = 0.04;
      const s = this.smoke[this.smokeIdx++ % this.smoke.length];
      const side = (this.smokeIdx % 2 ? 1 : -1) * 0.6;
      const bx = -Math.sin(this.heading) * 0.9, bz = -Math.cos(this.heading) * 0.9;
      s.position.set(this.pos.x + bx + Math.cos(this.heading) * side, this.pos.y + 0.25, this.pos.z + bz - Math.sin(this.heading) * side);
      const col = this.mtT > 0 ? 0xff9100 : this.drift ? SMOKE_COLORS[this.driftStage] : this.burnoutT > 0 ? 0xdddddd : 0xb8a98a;
      s.material.color.setHex(col);
      s.userData.life = 0.45;
      s.userData.vy = 1 + Math.random();
      s.visible = true;
    }
    for (const s of this.smoke) {
      if (!s.visible) continue;
      s.userData.life -= dt;
      if (s.userData.life <= 0) { s.visible = false; continue; }
      s.position.y += s.userData.vy * dt;
      const k = s.userData.life / 0.45;
      s.scale.setScalar(0.5 + (1 - k) * 0.9);
      s.material.opacity = k * 0.9;
    }
  }
}

// Colisão entre karts considerando o peso (pesados empurram leves)
export function collideKarts(karts) {
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j];
      if (a.rescueT > 0 || b.rescueT > 0 || a.intangible || b.intangible || a.falling || b.falling) continue;
      if (Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      const rr = (a.radius + b.radius) * (a.shrunk || b.shrunk ? 0.75 : 1);
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      // aura dourada derruba quem encosta; kart normal amassa kart encolhido
      if (a.invincible && !b.invincible) { b.hit('tumble', 'aura', a); continue; }
      if (b.invincible && !a.invincible) { a.hit('tumble', 'aura', b); continue; }
      if (a.shrunk && !b.shrunk) { a.hit('squash', 'atropelado', b); continue; }
      if (b.shrunk && !a.shrunk) { b.hit('squash', 'atropelado', a); continue; }
      const d = Math.sqrt(d2);
      const over = rr - d;
      const nx = dx / d, nz = dz / d;
      const wa = a.weight, wb = b.weight;
      const ka = wb / (wa + wb), kb = wa / (wa + wb);
      a.pos.x -= nx * over * ka * 1.6; a.pos.z -= nz * over * ka * 1.6;
      b.pos.x += nx * over * kb * 1.6; b.pos.z += nz * over * kb * 1.6;
      const avg = (a.speed * wa + b.speed * wb) / (wa + wb);
      a.speed += (avg - a.speed) * 0.25;
      b.speed += (avg - b.speed) * 0.25;
      if (a.isPlayer || b.isPlayer) (a.isPlayer ? a : b).events.push('bump');
    }
  }
}
