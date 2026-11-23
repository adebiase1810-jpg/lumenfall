// ============ état persistant, progression, social local ============
import { bus, uid, pick, rand, randi, clamp } from './utils.js';
import { setLang } from './strings.js';

const KEY = 'lumenfall.save.v1';
let storageOK = true;

// ---- Roster d'Échos (compagnons IA locaux, diégétiques) ----
export const ECHOES = [
  { id: 'vesper', name: 'Vesper', tag: '0417', level: 24, energy: '#38e1ff', armor: '#1d2f3a', chassis: 'spectre', aggr: .85, bio: 'Duelliste des passerelles. Frappe avant que la lumière ne bouge.' },
  { id: 'kaito', name: 'Kaïto', tag: '2201', level: 31, energy: '#ffb347', armor: '#3a2c1c', chassis: 'colosse', aggr: .6, bio: 'Forgé dans la Fonderie. Son blindage porte encore la chaleur.' },
  { id: 'nyx', name: 'Nyx', tag: '0093', level: 18, energy: '#ff3d7e', armor: '#2a1a2e', chassis: 'spectre', aggr: .95, bio: 'Chuchote aux cristaux de Biolume. Ils répondent.' },
  { id: 'sable', name: 'Sable', tag: '5510', level: 12, energy: '#8dff57', armor: '#233420', chassis: 'vanguard', aggr: .5, bio: 'Patiente comme le désert de cendre sous le Relais.' },
  { id: 'iris7', name: 'Iris-7', tag: '7707', level: 40, energy: '#eaf6ff', armor: '#2c3540', chassis: 'aube', aggr: .75, bio: 'Septième itération. Les six précédentes dorment dans les Archives.' },
  { id: 'orin', name: 'Orin', tag: '3345', level: 9, energy: '#38e1ff', armor: '#22303f', chassis: 'vanguard', aggr: .4, bio: 'Jeune Porteur, vieux réflexes.' },
  { id: 'mara', name: 'Mara', tag: '8812', level: 27, energy: '#ff3d7e', armor: '#33202a', chassis: 'colosse', aggr: .7, bio: 'Collecte les éclats comme d’autres collectionnent les regrets.' },
  { id: 'theon', name: 'Théon', tag: '1108', level: 15, energy: '#ffb347', armor: '#2c2a20', chassis: 'aube', aggr: .65, bio: 'Il jure avoir vu l’anneau se briser. Personne ne le contredit.' },
  { id: 'zephra', name: 'Zéphra', tag: '6620', level: 22, energy: '#38e1ff', armor: '#1c2c3a', chassis: 'spectre', aggr: .9, bio: 'Plus rapide que sa propre ombre projetée.' },
  { id: 'okta', name: 'Okta', tag: '9034', level: 7, energy: '#8dff57', armor: '#25301f', chassis: 'vanguard', aggr: .35, bio: 'Huit tentatives d’ancrage. Huit survies.' },
  { id: 'rune', name: 'Rune', tag: '4456', level: 33, energy: '#eaf6ff', armor: '#31383f', chassis: 'aube', aggr: .8, bio: 'Grave des glyphes sur chaque prisme ravivé.' },
  { id: 'cendre', name: 'Cendre', tag: '0666', level: 20, energy: '#ff4d5e', armor: '#301c1c', chassis: 'colosse', aggr: .88, bio: 'Ce qui reste quand la Forge se tait.' },
  { id: 'lys', name: 'Lys', tag: '2727', level: 11, energy: '#ff3d7e', armor: '#2c1f2c', chassis: 'spectre', aggr: .55, bio: 'Fleurit là où les autres s’éteignent.' },
  { id: 'boreal', name: 'Boréal', tag: '1919', level: 29, energy: '#38e1ff', armor: '#1e2e38', chassis: 'vanguard', aggr: .72, bio: 'Garde le Relais quand les antennes gèlent.' },
];
export const echoById = id => ECHOES.find(e => e.id === id);

// ---- Catalogue cosmétique ----
export const COSMETICS = {
  skins: [
    { id: 'vanguard', name: 'Vanguard', cost: 0, desc: 'Châssis d’assaut équilibré. Ligne d’épaule franche.' },
    { id: 'spectre', name: 'Spectre', cost: 0, desc: 'Profil effilé, capuche sensorielle. Fait pour la vitesse.' },
    { id: 'colosse', name: 'Colosse', cost: 800, desc: 'Blindage lourd, réservoirs dorsaux jumeaux.' },
    { id: 'aube', name: 'Aube', cost: 1400, desc: 'Ailerons photoniques. La silhouette des légendes.' },
  ],
  banners: [
    { id: 'aube', name: 'Aube', cost: 0 }, { id: 'prisme', name: 'Prisme', cost: 0 },
    { id: 'forge', name: 'Forge', cost: 400 }, { id: 'biolume', name: 'Biolume', cost: 400 },
    { id: 'orbite', name: 'Orbite', cost: 650 }, { id: 'signal', name: 'Signal', cost: 900 },
  ],
  titles: [
    { id: 'porteur', lvl: 1 }, { id: 'eclaireur', lvl: 3 }, { id: 'veteran', lvl: 5 },
    { id: 'prisme', lvl: 8 }, { id: 'aube', lvl: 12 }, { id: 'legende', lvl: 16 },
  ],
  armorColors: ['#22303f', '#cfd8e3', '#7a2430', '#14454f', '#4a3b28', '#3a2a55', '#23402c', '#7a4a14'],
  energyColors: ['#ffb347', '#38e1ff', '#ff3d7e', '#8dff57', '#ff4d5e', '#eaf6ff'],
};

const defaultSettings = () => ({
  quality: 'high', resScale: 1, fov: 80, bloom: true, shadows: true,
  sens: 1, invertY: false, aimHold: true, autoSprint: false, shake: true, dmgNums: true,
  showFps: false, crosshair: 'cross',
  volMaster: .8, volMusic: .6, volSfx: .85, volAmb: .5, muted: false,
  lang: 'fr', netUrl: 'ws://localhost:8080',
});

const defaultSave = () => ({
  v: 1,
  profile: { id: uid(), name: 'Porteur-' + randi(100, 999), created: Date.now(), seenWelcome: false },
  settings: defaultSettings(),
  custom: { skin: 'vanguard', armor: '#22303f', energy: '#ffb347', banner: 'aube', title: 'porteur' },
  progress: { xp: 0, level: 1, lumen: 250 },
  stats: { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, shards: 0, shots: 0, hits: 0, playtime: 0, bestWave: 0 },
  matches: [],
  friends: ['vesper', 'kaito', 'nyx'],
  requests: { in: ['sable', 'iris7'], out: [] },
  notifs: [],
  owned: { skins: ['vanguard', 'spectre'], banners: ['aube', 'prisme'] },
  challenge: null,
  lastMode: 'confluence',
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return defaultSave();
    const base = defaultSave();
    // fusion défensive
    return {
      ...base, ...d,
      settings: { ...base.settings, ...(d.settings || {}) },
      custom: { ...base.custom, ...(d.custom || {}) },
      progress: { ...base.progress, ...(d.progress || {}) },
      stats: { ...base.stats, ...(d.stats || {}) },
      owned: { ...base.owned, ...(d.owned || {}) },
      requests: { in: [], out: [], ...(d.requests || {}) },
      profile: { ...base.profile, ...(d.profile || {}) },
    };
  } catch (e) { storageOK = false; return defaultSave(); }
}

export const S = load();
setLang(S.settings.lang);

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) {
      if (storageOK) { storageOK = false; bus.emit('toast', { type: 'warn', title: 'toast.storage', msg: 'toast.storageMsg' }); }
    }
    bus.emit('save');
  }, 350);
}
export const storageAvailable = () => storageOK;
export function set(path, val) {
  const parts = path.split('.');
  let o = S;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
  if (path.startsWith('settings.')) { if (path === 'settings.lang') setLang(val); bus.emit('settings', path); }
  save();
}

// ---- progression ----
export const xpNeed = lvl => 400 + (lvl - 1) * 150;
export function levelInfo() {
  const need = xpNeed(S.progress.level);
  return { level: S.progress.level, xp: S.progress.xp, need, pct: clamp(S.progress.xp / need, 0, 1) };
}
export function addXP(amount) {
  if (amount <= 0) return [];
  S.progress.xp += Math.round(amount);
  const ups = [];
  while (S.progress.xp >= xpNeed(S.progress.level)) {
    S.progress.xp -= xpNeed(S.progress.level);
    S.progress.level++;
    ups.push(S.progress.level);
    notif('xp', 'notif.levelUp', { n: S.progress.level });
  }
  save(); bus.emit('level');
  return ups;
}
export function addLumen(n) { S.progress.lumen = Math.max(0, S.progress.lumen + Math.round(n)); save(); bus.emit('level'); }
export function bumpStat(key, n = 1) { S.stats[key] = (S.stats[key] || 0) + n; save(); }

export function recordMatch(rec) {
  S.matches.unshift({ id: uid(), date: Date.now(), ...rec });
  if (S.matches.length > 30) S.matches.length = 30;
  S.stats.matches++;
  if (rec.result === 'win') S.stats.wins++;
  else if (rec.result === 'loss') S.stats.losses++;
  if (rec.wave) S.stats.bestWave = Math.max(S.stats.bestWave, rec.wave);
  save(); bus.emit('matches');
}

// ---- notifications ----
export function notif(type, key, params = {}) {
  S.notifs.unshift({ id: uid(), type, key, params, ts: Date.now(), read: false });
  if (S.notifs.length > 40) S.notifs.length = 40;
  save(); bus.emit('notif');
}
export const unreadCount = () => S.notifs.filter(n => !n.read).length;
export function markNotifsRead() { S.notifs.forEach(n => n.read = true); save(); bus.emit('notif'); }
export function clearNotifs() { S.notifs = []; save(); bus.emit('notif'); }

// ---- social local ----
export const presence = new Map(); // id -> status
ECHOES.forEach(e => presence.set(e.id, pick(['online', 'online', 'ingame', 'lobby', 'away', 'offline'])));
export const friendState = id =>
  S.friends.includes(id) ? 'friend' :
  S.requests.out.includes(id) ? 'pending' :
  S.requests.in.includes(id) ? 'incoming' : 'none';

export function sendRequest(id) {
  if (friendState(id) !== 'none') return false;
  S.requests.out.push(id); save(); bus.emit('friends');
  // L'Écho accepte après un délai (simulation locale assumée)
  setTimeout(() => {
    const i = S.requests.out.indexOf(id);
    if (i === -1) return;
    S.requests.out.splice(i, 1);
    if (!S.friends.includes(id)) S.friends.push(id);
    notif('social', 'notif.friendOk', { name: echoById(id).name });
    bus.emit('toast', { type: 'social', title: 'toast.friendAdded', msg: echoById(id).name });
    bus.emit('friends'); save();
  }, rand(3500, 9000));
  return true;
}
export function acceptRequest(id) {
  const i = S.requests.in.indexOf(id); if (i === -1) return;
  S.requests.in.splice(i, 1);
  if (!S.friends.includes(id)) S.friends.push(id);
  notif('social', 'notif.friendNew', { name: echoById(id).name });
  save(); bus.emit('friends');
}
export function declineRequest(id) {
  const i = S.requests.in.indexOf(id); if (i !== -1) S.requests.in.splice(i, 1);
  save(); bus.emit('friends');
}
export function cancelRequest(id) {
  const i = S.requests.out.indexOf(id); if (i !== -1) S.requests.out.splice(i, 1);
  save(); bus.emit('friends');
}
export function removeFriend(id) {
  const i = S.friends.indexOf(id); if (i !== -1) S.friends.splice(i, 1);
  save(); bus.emit('friends');
}

// simulation de présence (un seul intervalle)
let presenceStarted = false;
export function startPresence() {
  if (presenceStarted) return; presenceStarted = true;
  setInterval(() => {
    const n = randi(1, 2);
    for (let i = 0; i < n; i++) {
      const e = pick(ECHOES);
      if (bus.squadIds && bus.squadIds.has(e.id)) { presence.set(e.id, 'squad'); continue; }
      presence.set(e.id, pick(['online', 'online', 'online', 'ingame', 'ingame', 'lobby', 'away', 'offline']));
    }
    bus.emit('presence');
  }, 7000);
}

// ---- défi du jour ----
const CHAL_TYPES = [
  { type: 'kills', target: 12, xp: 300, lm: 150 },
  { type: 'shards', target: 20, xp: 300, lm: 150 },
  { type: 'wins', target: 1, xp: 350, lm: 180 },
  { type: 'wave', target: 3, xp: 320, lm: 160 },
];
const dayKey = () => new Date().toISOString().slice(0, 10);
export function ensureChallenge() {
  const k = dayKey();
  if (!S.challenge || S.challenge.date !== k) {
    const day = Math.floor(Date.now() / 86400000);
    const def = CHAL_TYPES[day % CHAL_TYPES.length];
    S.challenge = { date: k, ...def, progress: 0, claimed: false };
    save();
  }
  return S.challenge;
}
export function challengeTick(type, n = 1) {
  const c = ensureChallenge();
  if (c.claimed || c.type !== type) return;
  const before = c.progress;
  c.progress = Math.min(c.target, c.progress + n);
  if (before < c.target && c.progress >= c.target) notif('ok', 'notif.challenge');
  save(); bus.emit('challenge');
}
export function claimChallenge() {
  const c = ensureChallenge();
  if (c.claimed || c.progress < c.target) return false;
  c.claimed = true;
  addXP(c.xp); addLumen(c.lm);
  notif('xp', 'notif.challengeClaim', { xp: c.xp, lm: c.lm });
  save(); bus.emit('challenge');
  return true;
}

// ---- cosmétiques ----
export const ownsCos = (kind, id) => (S.owned[kind] || []).includes(id);
export function buyCos(kind, id) {
  const item = COSMETICS[kind].find(c => c.id === id);
  if (!item || ownsCos(kind, id)) return false;
  if (S.progress.lumen < item.cost) return false;
  S.progress.lumen -= item.cost;
  S.owned[kind].push(id);
  notif('ok', 'notif.buy', { name: item.name });
  save(); bus.emit('level');
  return true;
}
export function equipCos(kind, id) {
  const map = { skins: 'skin', banners: 'banner', titles: 'title' };
  S.custom[map[kind]] = id; save(); bus.emit('custom');
}
export const titleFor = lvl => {
  let cur = COSMETICS.titles[0];
  for (const ti of COSMETICS.titles) if (lvl >= ti.lvl) cur = ti;
  return cur.id;
};