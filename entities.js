// ============ physique partagée & ligne de vue ============
import { clamp, rayBox } from '../core/utils.js';

const R = .45, HEIGHT = 1.8, GRAV = -26;

export function makeEntity(x, z) {
  return {
    x, y: 0, z, vx: 0, vy: 0, vz: 0,
    yaw: 0, grounded: true, hp: 100, shield: 50, alive: true,
    lastHit: -99, spawnProt: 0, padCool: 0,
    team: null, name: '?', isPlayer: false,
    kills: 0, deaths: 0, score: 0, shots: 0, hits: 0,
    ammo: 24, reloadT: 0, fireCool: 0,
    rig: null, brain: null, respawnT: 0, speed01: 0, aimPitch: 0, aiming: false,
  };
}

export function stepPhysics(e, dt, world) {
  const prevY = e.y;
  e.vy += GRAV * dt;
  e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
  // limites
  const B = 196;
  if (e.x < -B) { e.x = -B; e.vx = Math.max(0, e.vx); }
  if (e.x > B) { e.x = B; e.vx = Math.min(0, e.vx); }
  if (e.z < -B) { e.z = -B; e.vz = Math.max(0, e.vz); }
  if (e.z > B) { e.z = B; e.vz = Math.min(0, e.vz); }
  // collisions horizontales (cercle vs AABB)
  const feet = e.y, headY = e.y + HEIGHT;
  for (const b of world.colliders) {
    if (feet + .25 >= b.y1 || headY <= b.y0) continue;
    const cx = clamp(e.x, b.x0, b.x1), cz = clamp(e.z, b.z0, b.z1);
    let dx = e.x - cx, dz = e.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), push = (R - d) / d;
      e.x += dx * push; e.z += dz * push;
    } else {
      // centre à l'intérieur : pousser sur l'axe de moindre pénétration
      const px = Math.min(e.x - b.x0 + R, b.x1 - e.x + R);
      const pz = Math.min(e.z - b.z0 + R, b.z1 - e.z + R);
      if (px < pz) e.x += (e.x - (b.x0 + b.x1) / 2 > 0 ? px : -px);
      else e.z += (e.z - (b.z0 + b.z1) / 2 > 0 ? pz : -pz);
    }
  }
  // support vertical
  e.grounded = false;
  if (e.y <= 0) { e.y = 0; e.vy = 0; e.grounded = true; }
  for (const b of world.colliders) {
    const inX = e.x > b.x0 - R * .6 && e.x < b.x1 + R * .6;
    const inZ = e.z > b.z0 - R * .6 && e.z < b.z1 + R * .6;
    if (!inX || !inZ) continue;
    if (e.vy <= 0 && prevY >= b.y1 - .02 && e.y < b.y1) {
      e.y = b.y1; e.vy = 0; e.grounded = true;
    } else if (e.vy > 0 && prevY + HEIGHT <= b.y0 + .02 && e.y + HEIGHT > b.y0) {
      e.y = b.y0 - HEIGHT; e.vy = 0;
    }
  }
  // propulseurs
  if (e.padCool > 0) e.padCool -= dt;
  if (e.grounded && e.padCool <= 0) {
    for (const p of world.pads) {
      const dx = e.x - p.x, dz = e.z - p.z;
      if (dx * dx + dz * dz < p.r * p.r) {
        e.vy = 21; e.grounded = false; e.padCool = .6;
        e.onPad && e.onPad();
        break;
      }
    }
  }
  if (e.spawnProt > 0) e.spawnProt -= dt;
}

export function losClear(x0, y0, z0, x1, y1, z1, colliders) {
  let dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < .001) return true;
  dx /= len; dy /= len; dz /= len;
  for (const b of colliders) {
    if (rayBox(x0, y0, z0, dx, dy, dz, len, b) < len) return false;
  }
  return true;
}

export function raycastWorld(x0, y0, z0, dx, dy, dz, len, colliders) {
  let best = len;
  for (const b of colliders) {
    const t = rayBox(x0, y0, z0, dx, dy, dz, best, b);
    if (t < best) best = t;
  }
  // sol
  if (dy < -1e-6) {
    const t = -y0 / dy;
    if (t >= 0 && t < best) best = t;
  }
  return best;
}