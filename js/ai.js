import { clamp, wrapAngle } from './kart.js';

const PACE = { 50: 0.9, 100: 0.94, 150: 0.97, espelho: 0.94 };

// Pilotos controlados pelo computador
export function aiDrive(k, track, items, player, time, dt) {
  const N = track.N;
  const sp = Math.max(k.speed, 0);

  // desviar de cascas/presentes no chão à frente
  if (!k.dodgeT || k.dodgeT <= 0) {
    k.dodge = 0;
    for (const e of items.entities) {
      if (e.mode !== 'ground') continue;
      let d = e.idx - k.idx;
      if (d < 0) d += N;
      if (d > 2 && d < 22) {
        const el = track.lateral(e.pos.x, e.pos.z, e.idx);
        const myLane = k.lane + k.dodge;
        if (Math.abs(el - myLane) < 2.2) { k.dodge = el > 0 ? -3.2 : 3.2; k.dodgeT = 0.8; break; }
      }
    }
  } else k.dodgeT -= dt;

  const look = Math.floor(6 + sp * 0.5);
  const lane = clamp(k.lane + k.dodge + Math.sin(time * 0.3 + k.phase) * 1.2, -4, 4);
  const ti = (k.idx + look) % N;
  const tx = track.px[ti] - track.tz[ti] * lane;
  const tz = track.pz[ti] + track.tx[ti] * lane;
  const desired = Math.atan2(tx - k.pos.x, tz - k.pos.z);
  const steer = clamp(wrapAngle(desired - k.heading) * 2.4, -1, 1);

  let curv = 0;
  for (let j = 0; j < 4; j++) curv = Math.max(curv, track.curv[(k.idx + 3 + j * 6) % N]);

  // "elástico" do MK64: quem está atrás do jogador acelera, quem está muito à frente alivia.
  // Os 2 rivais da copa ficam mais grudados no jogador.
  let pace = PACE[k.cc] ?? 0.94;
  if (player && player !== k && !player.finished && !k.autopilot) {
    const gap = player.progress - k.progress;
    const band = k.rival ? 1 : 0.6;
    pace += clamp(gap / 120, -0.12, 0.12) * band;
    if (k.rival) pace += 0.015;
  }
  const target = k.top * pace * clamp(1.12 - curv * 0.55, 0.5, 1.08);

  // usar itens
  if (k.item && k.controllable) aiItems(k, items, time, dt);

  return {
    throttle: sp < target,
    brake: sp > target + 2.5,
    steer,
    hop: false,
    analog: true,
  };
}

function aiItems(k, items, time, dt) {
  k.itemWait = (k.itemWait ?? 1 + Math.random() * 2.5) - dt;
  const ahead = items.targetAhead(k);
  const gapAhead = ahead ? ahead.progress - k.progress : Infinity;
  let behind = Infinity;
  for (const o of items.karts) { if (o !== k) { const g = k.progress - o.progress; if (g > 0 && g < behind) behind = g; } }

  const fire = (aim = 0) => { items.press(k, aim); items.release(k, aim); k.itemWait = 0.6 + Math.random() * 1.5; };
  switch (k.item) {
    case 'pimenta': case 'pimenta3': case 'pimentaOuro':
      if (k.itemWait <= 0 && items.track.curv[k.idx] < 0.35) fire();
      break;
    case 'aura': case 'trovao': case 'vespao': case 'sombra':
      if (k.itemWait <= 0) fire();
      break;
    case 'casca': case 'presente': case 'casca5':
      if (behind < 14 || k.itemWait < -4) fire();
      break;
    case 'coco': case 'coco3':
      if ((gapAhead < 22 && Math.abs(ahead.lat - k.lat) < 2.5) || k.itemWait < -6) fire();
      else if (k.item === 'coco3' && !items.heldOf(k).length) items.press(k);
      break;
    case 'abelha': case 'abelha3':
      if (gapAhead < 90 && k.itemWait <= 0) fire();
      else if (k.item === 'abelha3' && !items.heldOf(k).length) items.press(k);
      break;
  }
}
