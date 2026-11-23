import { MAX_SPEED, clamp, wrapAngle } from './kart.js';

// Piloto automático: segue a linha da pista olhando à frente e freia antes das curvas
export function aiInput(k, track, player, time) {
  const N = track.N;
  const sp = Math.max(k.speed, 0);
  const look = Math.floor(7 + sp * 0.45);
  const lane = clamp(k.lane + Math.sin(time * 0.35 + k.phase) * 2, -5, 5);
  const ti = (k.idx + look) % N;
  const tx = track.px[ti] - track.tz[ti] * lane;
  const tz = track.pz[ti] + track.tx[ti] * lane;
  const desired = Math.atan2(tx - k.pos.x, tz - k.pos.z);
  const diff = wrapAngle(desired - k.heading);
  const steer = clamp(diff * 2.6, -1, 1);

  // curvatura no trecho à frente
  let curv = 0;
  for (let j = 0; j < 4; j++) curv = Math.max(curv, track.curv[(k.idx + 4 + j * 7) % N]);

  // "elástico": rivais aceleram um pouco se ficam para trás do jogador e aliviam se estão muito à frente
  let skill = k.skill;
  if (player && !k.autopilot && player !== k && !player.finished) {
    const gap = player.progress - k.progress;
    skill += clamp(gap / 160, -0.1, 0.08);
  }
  const target = MAX_SPEED * skill * clamp(1.08 - curv * 0.5, 0.55, 1.06);

  return {
    throttle: sp < target,
    brake: sp > target + 3,
    steer,
    drift: false,
  };
}
