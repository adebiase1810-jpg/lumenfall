// ============ cerveau des bots — machine à états + évitement ============
import { rand, pick, clamp, damp, rotY, rayBox, angDamp } from '../core/utils.js';
import { losClear } from './entities.js';

const DIFF = {
  recrue: { react: .75, spread: .085, dmg: 8, speed: 6.2, fireGap: 1.1, burst: 3, orbit: 13, flee: false },
  veteran: { react: .45, spread: .05, dmg: 11, speed: 7.4, fireGap: .75, burst: 4, orbit: 11, flee: true },
  elite: { react: .26, spread: .028, dmg: 14, speed: 8.4, fireGap: .5, burst: 5, orbit: 9, flee: true },
};

export function createBrain(bot, match, difficulty, aggr = .6) {
  const D = DIFF[difficulty] || DIFF.veteran;
  let state = 'patrol';
  let target = null;          // ennemi visé
  let waypoint = null;
  let thinkT = rand(0, .2), strafeT = 0, strafeSign = 1, reactT = 0;
  let burstLeft = 0, fireT = 0, wpT = 0;
  let fleePad = null;

  const blocked = (dx, dz, dist) => {
    for (const b of match.world.colliders) {
      if (b.y0 > bot.y + 1.4 || b.y1 < bot.y + .3) continue;
      if (rayBox(bot.x, bot.y + 1, bot.z, dx, 0, dz, dist, b) < dist) return true;
    }
    return false;
  };
  const steer = (tx, tz, dt, speedMul = 1) => {
    let dx = tx - bot.x, dz = tz - bot.z;
    const d = Math.hypot(dx, dz);
    if (d < .01) return 0;
    dx /= d; dz /= d;
    if (blocked(dx, dz, 2.4)) {
      for (const a of [.55, -.55, 1.1, -1.1, 1.7, -1.7, 2.5, -2.5]) {
        const [rx, rz] = rotY(dx, dz, a);
        if (!blocked(rx, rz, 2.4)) { dx = rx; dz = rz; break; }
      }
    }
    // séparation
    for (const o of match.entities) {
      if (o === bot || !o.alive) continue;
      const ox = bot.x - o.x, oz = bot.z - o.z;
      const od = ox * ox + oz * oz;
      if (od < 2 && od > .0001) { const f = .6 / Math.sqrt(od); dx += ox * f; dz += oz * f; }
    }
    const n = Math.hypot(dx, dz) || 1;
    const sp = D.speed * speedMul;
    bot.vx = damp(bot.vx, dx / n * sp, 8, dt);
    bot.vz = damp(bot.vz, dz / n * sp, 8, dt);
    return d;
  };

  function think() {
    const enemies = match.enemiesOf(bot);
    let best = null, bestD = 58;
    for (const e of enemies) {
      if (!e.alive || e.spawnProt > 0) continue;
      const d = Math.hypot(e.x - bot.x, e.z - bot.z);
      if (d < bestD && losClear(bot.x, bot.y + 1.55, bot.z, e.x, e.y + 1.2, e.z, match.world.colliders)) { best = e; bestD = d; }
    }
    if (best && best !== target) reactT = D.react * rand(.8, 1.3);
    target = best;

    if (D.flee && bot.hp < 28 && bot.shield <= 0) {
      let pad = null, pd = 70;
      for (const hp of match.world.healthPads) {
        if (hp.cool > 0) continue;
        const d = Math.hypot(hp.x - bot.x, hp.z - bot.z);
        if (d < pd) { pad = hp; pd = d; }
      }
      if (pad) { state = 'flee'; fleePad = pad; return; }
    }
    if (target) { state = 'engage'; return; }
    if (match.mode === 'moisson') {
      const sh = match.nearestShard(bot.x, bot.z);
      if (sh) { state = 'collect'; waypoint = sh; return; }
    }
    state = 'patrol';
    if (!waypoint || wpT <= 0) {
      const a = pick(match.world.anchors);
      waypoint = { x: a[0] + rand(-8, 8), z: a[1] + rand(-8, 8) };
      wpT = rand(5, 9);
    }
  }

  return {
    get state() { return state; },
    update(dt) {
      if (!bot.alive) return;
      thinkT -= dt; wpT -= dt; strafeT -= dt; reactT -= dt; fireT -= dt;
      if (thinkT <= 0) { thinkT = .16 + rand(0, .08); think(); }
      if (strafeT <= 0) { strafeT = rand(.9, 2.2) * (1.4 - aggr * .6); strafeSign = Math.random() < .5 ? 1 : -1; }

      let faceX = null, faceZ = null;
      if (state === 'engage' && target && target.alive) {
        const dx = target.x - bot.x, dz = target.z - bot.z;
        const d = Math.hypot(dx, dz) || 1;
        faceX = target.x; faceZ = target.z;
        bot.aiming = true;
        bot.aimPitch = Math.atan2((target.y + 1.2) - (bot.y + 1.55), d);
        // orbite + maintien de distance
        const nx = dx / d, nz = dz / d;
        const [sx, sz] = rotY(nx, nz, strafeSign * Math.PI / 2);
        const want = D.orbit * (1 - aggr * .25);
        const radial = clamp((d - want) * .25, -1, 1);
        const tx = bot.x + (nx * radial + sx * .9) * 6;
        const tz = bot.z + (nz * radial + sz * .9) * 6;
        steer(tx, tz, dt, .9);
        // tir
        if (reactT <= 0 && fireT <= 0 && bot.reloadT <= 0 &&
            losClear(bot.x, bot.y + 1.55, bot.z, target.x, target.y + 1.2, target.z, match.world.colliders)) {
          if (bot.ammo <= 0) { bot.reloadT = 1.6; }
          else {
            match.botFire(bot, target, D.spread * (1.25 - aggr * .4), D.dmg);
            burstLeft--;
            if (burstLeft <= 0) { burstLeft = D.burst; fireT = D.fireGap * rand(.8, 1.4) * (1.3 - aggr * .5); }
            else fireT = .13;
          }
        }
      } else if (state === 'flee' && fleePad) {
        bot.aiming = false;
        const d = steer(fleePad.x, fleePad.z, dt, 1.15);
        if (d < 1.5 || fleePad.cool > 0) { state = 'patrol'; fleePad = null; }
        faceX = fleePad?.x; faceZ = fleePad?.z;
      } else if (state === 'collect' && waypoint) {
        bot.aiming = false;
        const d = steer(waypoint.x, waypoint.z, dt, 1.05);
        if (d < 1.2 || !waypoint.active) { waypoint = null; state = 'patrol'; }
        faceX = waypoint?.x; faceZ = waypoint?.z;
      } else {
        bot.aiming = false;
        if (waypoint) {
          const d = steer(waypoint.x, waypoint.z, dt, .7);
          if (d < 2) { waypoint = null; }
          faceX = waypoint?.x; faceZ = waypoint?.z;
        } else { bot.vx = damp(bot.vx, 0, 6, dt); bot.vz = damp(bot.vz, 0, 6, dt); }
      }
      if (bot.reloadT > 0) { bot.reloadT -= dt; if (bot.reloadT <= 0) bot.ammo = 24; }
      // orientation
      if (faceX !== null && faceX !== undefined) {
        bot.yaw = angDamp(bot.yaw, Math.atan2(faceX - bot.x, faceZ - bot.z), 10, dt);
      } else if (Math.abs(bot.vx) + Math.abs(bot.vz) > .5) {
        bot.yaw = angDamp(bot.yaw, Math.atan2(bot.vx, bot.vz), 8, dt);
      }
      bot.speed01 = clamp(Math.hypot(bot.vx, bot.vz) / 8.5, 0, 1);
    }
  };
}