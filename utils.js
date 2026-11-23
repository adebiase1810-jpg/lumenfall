// ============ utilitaires partagés ============
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function angDamp(cur, target, lambda, dt) {
  let d = (target - cur) % TAU;
  if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  return cur + d * (1 - Math.exp(-lambda * dt));
}
export const fmtTime = s => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const fmtNum = n => Math.round(n).toLocaleString('fr-FR');
export const fmtDate = ts => new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' +
  new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const fmtDur = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

// Bus d'événements minimal
class EventBus {
  constructor() { this.map = new Map(); }
  on(ev, fn) { if (!this.map.has(ev)) this.map.set(ev, new Set()); this.map.get(ev).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.map.get(ev)?.delete(fn); }
  emit(ev, data) { this.map.get(ev)?.forEach(fn => { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }); }
}
export const bus = new EventBus();

// Intersection segment / AABB (méthode des slabs). d normalisé, retourne t ou Infinity.
export function rayBox(ox, oy, oz, dx, dy, dz, len, b) {
  let tmin = 0, tmax = len;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.y1, b.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return Infinity; continue; }
    const inv = 1 / d[i];
    let t1 = (mn[i] - o[i]) * inv, t2 = (mx[i] - o[i]) * inv;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}
// Intersection segment / sphère, retourne t ou Infinity
export function segSphere(ox, oy, oz, dx, dy, dz, len, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0 || tca > len + r) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  const t = tca - Math.sqrt(r2 - d2);
  return t >= 0 && t <= len ? t : Infinity;
}
export const rotY = (x, z, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, -x * s + z * c];
};
export const nextFrame = () => new Promise(r => requestAnimationFrame(r));
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));