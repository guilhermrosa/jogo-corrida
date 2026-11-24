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

  if (k.path) k.wasOn = k.path; else if (k.wasOn) { k.wantBr = null; k.wasOn = null; }
  const look = Math.floor(6 + sp * 0.5);
  let lane = clamp(k.lane + k.dodge + Math.sin(time * 0.3 + k.phase) * 1.2, -4, 4);

  // atalhos: cada piloto decide (uma vez por passagem) se vai pegar o caminho alternativo
  let S = track, si = k.idx;
  if (k.path && (k.wantBr === k.path || k.path.mainHit[k.bidx] < 0)) { S = k.path; si = k.bidx; }
  else if (!k.path) {
    for (const br of track.branches) {
      let dd = br.ia - k.idx; if (dd < -N / 2) dd += N; if (dd > N / 2) dd -= N;
      if (dd > 0 && dd < 60 && k.brSeen !== br.id + ':' + Math.floor(k.progress / N)) {
        k.brSeen = br.id + ':' + Math.floor(k.progress / N);
        k.wantBr = Math.random() < br.ai ? br : null;
      }
      if (k.wantBr === br && dd <= 0 && dd > -br.N) { S = br; si = br.scan(k.pos.x, k.pos.z); lane *= 0.3; }
    }
  }
  if (S !== track) lane = clamp(lane, -2.5, 2.5);
  let tx, tz, curv = 0;
  if (S === track) {
    const ti = (k.idx + look) % N;
    tx = track.px[ti] - track.tz[ti] * lane;
    tz = track.pz[ti] + track.tx[ti] * lane;
    for (let j = 0; j < 4; j++) curv = Math.max(curv, track.curv[(k.idx + 3 + j * 6) % N]);
  } else {
    let ti = si + look;
    if (ti < S.N) { tx = S.px[ti] - S.tz[ti] * lane; tz = S.pz[ti] + S.tx[ti] * lane; }
    else { const m = track.wrap(S.ib + (ti - S.N) + 4); tx = track.px[m]; tz = track.pz[m]; }
    for (let j = 0; j < 4; j++) curv = Math.max(curv, S.curv[Math.min(S.N - 1, si + 3 + j * 6)]);
    if (S.launch) curv = 0;              // na rampa de salto: pé no fundo
  }
  const desired = Math.atan2(tx - k.pos.x, tz - k.pos.z);
  const steer = clamp(wrapAngle(desired - k.heading) * 2.4, -1, 1);

  // "elástico" do MK64: quem está atrás do jogador acelera, quem está muito à frente alivia.
  // Os 2 rivais da copa ficam mais grudados no jogador.
  let pace = PACE[k.cc] ?? 0.94;
  if (player && player !== k && !player.finished && !k.autopilot) {
    const gap = player.progress - k.progress;
    const band = k.rival ? 1 : 0.6;
    pace += clamp(gap / 120, -0.12, 0.12) * band;
    if (k.rival) pace += 0.015;
  }
  let target = k.top * pace * clamp(1.12 - curv * 0.55, 0.5, 1.08);
  if (S !== track && S.launch) target = k.top * 1.2;

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
