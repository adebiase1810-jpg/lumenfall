// ============ interface du jeu : navigation, panneaux, social, arsenal ============
import * as THREE from 'three';
import {
  S, set, save, bus, levelInfo, ECHOES, echoById, presence, friendState,
  sendRequest, acceptRequest, declineRequest, cancelRequest, removeFriend,
  ensureChallenge, claimChallenge, COSMETICS, ownsCos, buyCos, equipCos,
  unreadCount, markNotifsRead, clearNotifs, storageAvailable,
} from '../core/store.js';
import { t } from '../core/strings.js';
import { audio } from '../audio/audio.js';
import { clamp, esc, fmtNum, fmtDate, fmtDur, uid } from '../core/utils.js';
import { avatarURL, bannerURL } from '../world/textures.js';
import { modeDefaults } from '../game/match.js';

// ---- icônes ----
const I = (() => {
  const w = (p, fill = false) => `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${p}</svg>`;
  return {
    home: w('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
    play: w('<path d="M6 4l14 8-14 8z"/>', true),
    squad: w('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.5c2.8.3 5 2.6 5 5.5"/>'),
    social: w('<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/><circle cx="9" cy="12" r=".8" fill="currentColor"/><circle cx="13" cy="12" r=".8" fill="currentColor"/><circle cx="17" cy="12" r=".8" fill="currentColor"/>'),
    user: w('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
    arsenal: w('<path d="M12 2 20 7v10l-8 5-8-5V7z"/><path d="M12 8v8M8 10l8 4M16 10l-8 4"/>'),
    gear: w('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),
    bell: w('<path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>'),
    sound: w('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
    soundoff: w('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
    expand: w('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    search: w('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
    plus: w('<path d="M12 5v14M5 12h14"/>'),
    x: w('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: w('<path d="m4.5 12.5 5 5 10-11"/>'),
    crown: w('<path d="M3 17h18M4 16l-1-8 5 3 4-6 4 6 5-3-1 8z"/>'),
    trophy: w('<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H3.5a3.5 3.5 0 0 0 3.6 3.5M17 6h3.5a3.5 3.5 0 0 1-3.6 3.5"/>'),
    bolt: w('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>', true),
    shard: w('<path d="M12 2 19 12l-7 10L5 12z"/><path d="M12 2v20M5 12h14"/>'),
    target: w('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
    waves: w('<path d="M2 8c3-3 6-3 9 0s6 3 9 0M2 14c3-3 6-3 9 0s6 3 9 0M2 20c3-3 6-3 9 0s6 3 9 0"/>'),
    leaf: w('<path d="M5 19C5 9 12 4 20 4c0 9-5 15-14 15"/><path d="M5 19c3-5 7-8 11-10"/>'),
    clock: w('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
    skull: w('<path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6.5V20h9v-3.5C18.5 15 20 13 20 10a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.4" fill="currentColor"/><circle cx="15" cy="11" r="1.4" fill="currentColor"/>'),
    info: w('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'),
    heart: w('<path d="M12 21s-7.5-4.9-9.5-9C1 8.5 3 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 5 23 8.5 21.5 12c-2 4.1-9.5 9-9.5 9z"/>'),
    help: w('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.3-.9 1-.9 1.7M12 16.5v.5"/>'),
    edit: w('<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
    lock: w('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    net: w('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z"/>'),
  };
})();
export const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 48 48" fill="none">
  <path d="M24 4 A20 20 0 0 1 43 19" stroke="#38e1ff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
  <path d="M44 27 A20 20 0 0 1 29 43" stroke="#ff3d7e" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>
  <path d="M20 44 A20 20 0 0 1 5 25" stroke="#38e1ff" stroke-width="2.6" stroke-linecap="round" opacity=".5"/>
  <path d="M4 19 A20 20 0 0 1 15 6" stroke="#ffb347" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
  <path d="M24 10 L33 34 L24 29.5 L15 34 Z" fill="url(#lg1)"/>
  <defs><linearGradient id="lg1" x1="15" y1="10" x2="33" y2="34"><stop stop-color="#ffd9a0"/><stop offset=".55" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5e3a"/></linearGradient></defs>
</svg>`;

const STATUS_KEY = { online: 'st.online', ingame: 'st.ingame', lobby: 'st.lobby', away: 'st.away', offline: 'st.offline', squad: 'st.squad' };
const ACTIVITY = { online: 'Hélios-9 · Promenade', ingame: 'Confluence — Arène Hélios-9', lobby: 'Prépare une escouade', away: 'Signal faible', offline: 'Dernier ancrage récent', squad: 'À vos côtés' };

export function createUI(app) {
  const root = document.getElementById('ui');
  const topbar = document.getElementById('topbar');
  const rail = document.getElementById('rail');
  const panel = document.getElementById('panel');
  const foot = document.getElementById('menufoot');
  const notifDrop = document.getElementById('dropdown-notif');
  const toasts = document.getElementById('toasts');
  const modal = document.getElementById('modal');
  let section = 'home';
  let socialTab = 'friends';
  let arsenalTab = 'skins';
  let settingsTab = 'graphics';
  let searchQ = '';
  let selectedMode = S.lastMode || 'confluence';
  let cfg = { ...modeDefaults(selectedMode), difficulty: 'veteran', returnFire: false };
  let confirmCb = null;
  let notifOpen = false;

  const ava = (colors, seed, size) => avatarURL(colors, seed, size);
  const echoAva = (e, size = 96) => ava({ armor: e.armor, energy: e.energy }, e.tag | 0, size);
  const myAva = (size = 96) => ava({ armor: S.custom.armor, energy: S.custom.energy }, 7, size);
  app.avatarURL = myAva;

  // ================= TOPBAR =================
  function renderTopbar() {
    const li = levelInfo();
    const unread = unreadCount();
    topbar.innerHTML = `
      <div class="logo" data-action="nav.home">${LOGO_MARK}
        <div><div class="logo-word">LUMENFALL</div><div class="logo-sub">Arènes d'Éclat</div></div>
      </div>
      <div class="top-spacer"></div>
      <div class="chip-lumen" title="Lumen">${I.shard}<span>${fmtNum(S.progress.lumen)}</span></div>
      <div class="chip-player" data-action="nav.profile">
        <div class="chip-ava"><img src="${myAva(48)}" alt=""></div>
        <div>
          <div class="chip-name">${esc(S.profile.name)}</div>
          <div class="chip-lvl">${t('top.level')} ${li.level} · ${Math.round(li.pct * 100)}%</div>
          <div class="xp-mini"><i style="width:${li.pct * 100}%"></i></div>
        </div>
      </div>
      <div class="rel">
        <button class="btn-icon ${unread ? 'on' : ''}" data-action="notif.toggle" title="${t('top.notifs')}">${I.bell}</button>
        ${unread ? `<span class="badge-dot">${unread}</span>` : ''}
      </div>
      <button class="btn-icon ${S.settings.muted ? '' : 'on'} ${audio.ready ? '' : 'pulse-hint'}" data-action="audio.toggle" title="${t('top.sound')} (M)">
        ${S.settings.muted ? I.soundoff : I.sound}
      </button>
      <button class="btn-icon" data-action="help" title="${t('top.help')}">${I.help}</button>
      <button class="btn-icon" data-action="fullscreen" title="${t('top.fullscreen')}">${I.expand}</button>
      <button class="btn-icon" data-action="nav.settings" title="${t('nav.settings')}">${I.gear}</button>`;
  }

  // ================= RAIL =================
  const NAV = [
    ['home', 'nav.home', I.home], ['play', 'nav.play', I.play], ['squad', 'nav.squad', I.squad],
    ['social', 'nav.social', I.social], ['profile', 'nav.profile', I.user],
    ['arsenal', 'nav.arsenal', I.arsenal], ['settings', 'nav.settings', I.gear],
  ];
  function renderRail() {
    const reqCount = S.requests.in.length;
    rail.innerHTML = NAV.map(([id, key, icon]) => `
      <button class="nav-btn ${section === id ? 'active' : ''}" data-action="nav.${id}">
        ${icon}<span>${t(key)}</span>
        ${id === 'social' && reqCount ? `<span class="nav-badge">${reqCount}</span>` : ''}
      </button>`).join('') +
      `<div class="rail-foot">HÉLIOS-9<br><b>${app.net.status === 'on' ? t('session.net') : t('session.local')}</b></div>`;
    foot.innerHTML = `<span>${t('foot.ver')} · <span class="sess">${app.net.status === 'on' ? t('session.net') : t('session.local')}</span></span><span>${t('foot.hint')}</span>`;
  }

  // ================= PANNEAUX =================
  function show(sec) {
    section = sec;
    notifOpen = false; notifDrop.classList.add('hidden');
    renderRail();
    app.setMenuCamera(sec);
    const R = { home: renderHome, play: renderPlay, squad: renderSquad, social: renderSocial, profile: renderProfile, arsenal: renderArsenal, settings: renderSettings };
    (R[sec] || renderHome)();
    audio.play('nav');
  }

  function squadSlotsHTML(compact = false) {
    const slots = [];
    slots.push(`<div class="slot">
      <div class="slot-ava"><img src="${myAva(48)}" alt=""></div>
      <div><div class="slot-name">${esc(S.profile.name)} ${I.crown}</div><div class="slot-stat">${t('home.you')} · ${t('home.leader')}</div></div>
      <span class="dot squad" style="margin-left:auto"></span>
    </div>`);
    for (let i = 0; i < 3; i++) {
      const s = app.squad[i];
      if (!s) slots.push(`<div class="slot empty" data-action="nav.social">${I.plus} ${t('home.emptySlot')}</div>`);
      else if (s.pending) slots.push(`<div class="slot pending"><span class="spin"></span> ${t('squad.pending')} <b>${esc(s.name)}</b></div>`);
      else {
        const e = s.echo;
        slots.push(`<div class="slot">
          <div class="slot-ava"><img src="${echoAva(e, 48)}" alt=""></div>
          <div><div class="slot-name">${esc(e.name)}</div><div class="slot-stat">NIV ${e.level} · ${t('st.squad')}</div></div>
          <button class="btn-icon" data-action="squad.kick" data-id="${e.id}" title="${t('squad.kick')}">${I.x}</button>
        </div>`);
      }
    }
    return `<div class="squad-slots">${slots.join('')}</div>`;
  }

  function challengeHTML() {
    const c = ensureChallenge();
    const pct = Math.round(c.progress / c.target * 100);
    const desc = t('chal.' + c.type).replace('{n}', c.target);
    return `<div class="chal-row">
      <div class="chal-ico">${c.type === 'kills' ? I.target : c.type === 'shards' ? I.shard : c.type === 'wins' ? I.trophy : I.waves}</div>
      <div style="flex:1">
        <div class="chal-name">${desc}</div>
        <div class="chal-desc">${c.progress} / ${c.target}</div>
      </div>
    </div>
    <div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:9px">
      <span class="chal-reward">${t('chal.reward').replace('{xp}', c.xp).replace('{lm}', c.lm)}</span>
      ${c.claimed ? `<span style="color:var(--ok);font-weight:700;font-size:13px">${t('home.claimed')}</span>` :
        c.progress >= c.target ? `<button class="btn btn-primary btn-sm" data-action="challenge.claim">${t('home.claim')}</button>` : ''}
    </div>`;
  }

  function renderHome() {
    const last = S.lastMode;
    panel.innerHTML = `
      <div class="home-grid">
        <div class="home-hero">
          <div class="reveal" style="--d:.05s">
            <div class="home-kicker">${t('home.kicker')}</div>
            <h1 class="home-title">LUMENFALL</h1>
            <p class="home-lore">${t('home.lore')}</p>
            <div class="home-cta">
              <button class="btn btn-primary btn-big" data-action="home.play">${I.play} ${t('home.play')}</button>
              <span class="home-last">${t('home.last')} <b data-action="home.quick">${t('play.' + last)}</b></span>
            </div>
          </div>
        </div>
        <div class="home-side">
          <div class="card reveal" style="--d:.15s">
            <h3>${I.squad} ${t('home.squad')}</h3>
            ${squadSlotsHTML(true)}
          </div>
          <div class="card reveal" style="--d:.25s">
            <h3>${I.trophy} ${t('home.challenge')}</h3>
            ${challengeHTML()}
          </div>
          <div class="card reveal" style="--d:.35s">
            <h3>${I.bolt} ${t('home.news')}</h3>
            <div class="news-item"><span class="news-tag">${t('news.1t')}</span>${t('news.1')}</div>
            <div class="news-item"><span class="news-tag">${t('news.2t')}</span>${t('news.2')}</div>
            <div class="news-item"><span class="news-tag">${t('news.3t')}</span>${t('news.3')}</div>
          </div>
        </div>
      </div>`;
  }

  const MODE_META = [
    ['confluence', 'squad', 'play.meta.team'], ['moisson', 'shard', 'play.meta.ffa'],
    ['survie', 'waves', 'play.meta.waves'], ['training', 'target', 'play.meta.free'],
  ];
  function renderPlay() {
    const d = modeDefaults(selectedMode);
    cfg = { ...d, difficulty: cfg.difficulty || 'veteran', returnFire: cfg.returnFire || false, ...(['confluence', 'moisson', 'survie', 'training'].includes(selectedMode) ? {} : {}) };
    const hasSquad = app.squad.some(s => s.echo);
    panel.innerHTML = `
      <div class="sec-head reveal"><span class="sec-title">${t('play.title')}</span><span class="sec-sub">${t('play.sub')}</span></div>
      <div class="mode-grid">
        ${MODE_META.map(([m, icon, meta], i) => `
          <button class="mode-card mc-${m} ${selectedMode === m ? 'sel' : ''} reveal" style="--d:${.05 + i * .07}s" data-action="mode.select" data-id="${m}">
            <span class="mode-num">0${i + 1}</span>
            <span class="mode-ico">${I[icon]}</span>
            <span class="mode-name">${t('play.' + m)}</span>
            <span class="mode-desc">${t('play.' + m + '.d')}</span>
            <span class="mode-meta">${t(meta)}</span>
          </button>`).join('')}
      </div>
      <div class="card panel-narrow reveal" style="--d:.35s">
        <h3>${I.gear} ${t('play.config')} — ${t('play.' + selectedMode)}</h3>
        <div class="cfg-grid">
          <div class="cfg-row">
            <div class="cfg-label"><span>${t('play.difficulty')}</span></div>
            <select data-cfg="difficulty">
              ${['recrue', 'veteran', 'elite'].map(d2 => `<option value="${d2}" ${cfg.difficulty === d2 ? 'selected' : ''}>${t('diff.' + d2)}</option>`).join('')}
            </select>
          </div>
          ${selectedMode !== 'survie' ? `
          <div class="cfg-row">
            <div class="cfg-label"><span>${t('play.bots')}</span><output id="cfg-bots-out">${cfg.bots}</output></div>
            <input type="range" min="${selectedMode === 'confluence' ? 3 : 1}" max="11" step="1" value="${cfg.bots}" data-cfg="bots">
          </div>` : `
          <div class="cfg-row">
            <div class="cfg-label"><span>${t('play.lives')}</span><output id="cfg-lives-out">${cfg.lives}</output></div>
            <input type="range" min="1" max="5" step="1" value="${cfg.lives}" data-cfg="lives">
          </div>`}
          ${d.score ? `
          <div class="cfg-row">
            <div class="cfg-label"><span>${t('play.score')}</span><output id="cfg-score-out">${cfg.score}</output></div>
            <input type="range" min="10" max="60" step="5" value="${cfg.score}" data-cfg="score">
          </div>` : ''}
          ${d.time ? `
          <div class="cfg-row">
            <div class="cfg-label"><span>${t('play.time')}</span><output id="cfg-time-out">${cfg.time}</output></div>
            <input type="range" min="3" max="10" step="1" value="${cfg.time}" data-cfg="time">
          </div>` : ''}
          ${selectedMode === 'training' ? `
          <div class="cfg-row">
            <div class="cfg-label"><span>${t('play.returnFire')}</span></div>
            <label class="toggle"><input type="checkbox" ${cfg.returnFire ? 'checked' : ''} data-cfg="returnFire"><i></i></label>
          </div>` : ''}
        </div>
        <div class="launch-row">
          <button class="btn btn-primary btn-big" data-action="play.launch">${I.play} ${hasSquad && selectedMode !== 'training' ? t('play.launchSquad') : t('play.launch')}</button>
          <span class="launch-note">${hasSquad && selectedMode !== 'training' ? t('play.noteSquad') + ' ' : ''}${t('play.note')}</span>
        </div>
      </div>`;
    panel.querySelectorAll('input[type=range]').forEach(syncRangeFill);
  }

  function renderSquad() {
    panel.innerHTML = `
      <div class="sec-head reveal"><span class="sec-title">${t('squad.title')}</span><span class="sec-sub">${t('squad.sub')}</span></div>
      <div class="home-grid">
        <div class="card reveal" style="--d:.1s;max-width:520px">
          <h3>${I.squad} ${t('home.squad')} · ${app.squad.filter(s => s.echo).length + 1}/4</h3>
          ${squadSlotsHTML()}
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
            <button class="btn btn-ghost" data-action="nav.social">${I.plus} ${t('squad.invite')}</button>
            ${app.squad.length ? `<button class="btn btn-danger" data-action="squad.dissolve">${I.x} ${t('squad.dissolve')}</button>` : ''}
          </div>
          <p class="launch-note" style="margin-top:14px">${t('squad.hint')}</p>
        </div>
        <div class="home-side">
          <div class="card reveal" style="--d:.2s">
            <h3>${I.play} ${t('squad.mode')}</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${['confluence', 'survie', 'moisson'].map(m => `
                <button class="btn ${selectedMode === m ? 'btn-primary' : 'btn-dark'}" data-action="mode.select" data-id="${m}" style="justify-content:flex-start">${t('play.' + m)}</button>`).join('')}
            </div>
            <button class="btn btn-primary btn-big" style="width:100%;margin-top:16px" data-action="play.launch">${I.play} ${t('play.launch')}</button>
          </div>
          <div class="card reveal" style="--d:.3s">
            <h3>${I.trophy} ${t('home.challenge')}</h3>
            ${challengeHTML()}
          </div>
        </div>
      </div>`;
  }

  // ---------- social ----------
  function friendRow(e, context) {
    const st = presence.get(e.id) || 'offline';
    const fs = friendState(e.id);
    const inSquad = app.squad.some(s => s.echo?.id === e.id);
    let actions = '';
    if (context === 'friends') {
      actions = `
        ${!inSquad ? `<button class="btn btn-ghost btn-sm" data-action="friend.invite" data-id="${e.id}">${I.plus} ${t('social.invite')}</button>` : ''}
        ${st === 'lobby' && !inSquad ? `<button class="btn btn-dark btn-sm" data-action="friend.join" data-id="${e.id}">${t('social.join')}</button>` : ''}
        <button class="btn btn-dark btn-sm" data-action="friend.profile" data-id="${e.id}">${t('social.profile')}</button>
        <button class="btn-icon" style="width:32px;height:32px" data-action="friend.remove" data-id="${e.id}" title="${t('social.remove')}">${I.x}</button>`;
    } else if (context === 'search') {
      actions = fs === 'friend' ? `<span class="cos-state" style="color:var(--ok)">${I.check} ${t('social.friend')}</span>` :
        fs === 'pending' ? `<button class="btn btn-dark btn-sm" data-action="friend.cancel" data-id="${e.id}">${t('social.pending')} · ${t('social.cancel')}</button>` :
        fs === 'incoming' ? `<button class="btn btn-primary btn-sm" data-action="friend.accept" data-id="${e.id}">${t('social.accept')}</button>` :
        `<button class="btn btn-ghost btn-sm" data-action="friend.add" data-id="${e.id}">${I.plus} ${t('social.add')}</button>`;
    } else if (context === 'in') {
      actions = `<button class="btn btn-primary btn-sm" data-action="friend.accept" data-id="${e.id}">${I.check} ${t('social.accept')}</button>
        <button class="btn btn-dark btn-sm" data-action="friend.decline" data-id="${e.id}">${t('social.decline')}</button>`;
    } else if (context === 'out') {
      actions = `<button class="btn btn-dark btn-sm" data-action="friend.cancel" data-id="${e.id}">${t('social.cancel')}</button>`;
    }
    return `<div class="friend-row">
      <div class="f-ava" data-action="friend.profile" data-id="${e.id}"><img src="${echoAva(e, 64)}" alt=""></div>
      <div class="f-main">
        <div class="f-name" data-action="friend.profile" data-id="${e.id}">${esc(e.name)} <span class="f-tag">#${e.tag}</span> <span class="f-lvl">NIV ${e.level}</span></div>
        <div class="f-act"><span class="dot ${st}"></span>${t(STATUS_KEY[st])} · ${ACTIVITY[st]}</div>
      </div>
      <div class="f-actions">${actions}</div>
    </div>`;
  }

  function renderSocial() {
    const friends = S.friends.map(echoById).filter(Boolean);
    const reqIn = S.requests.in.map(echoById).filter(Boolean);
    const reqOut = S.requests.out.map(echoById).filter(Boolean);
    let body = '';
    if (socialTab === 'friends') {
      body = friends.length ? friends.map(e => friendRow(e, 'friends')).join('') :
        `<div class="empty-state">${I.social}${t('social.noFriends')}</div>`;
      if (app.net.status === 'on') {
        body += `<div class="card" style="margin-top:18px"><h3>${I.net} ${t('social.online')}</h3>` +
          (app.net.peers.length ? app.net.peers.map(p => `<div class="friend-row"><div class="f-main"><div class="f-name">${esc(p.name)}</div><div class="f-act"><span class="dot online"></span>${t('st.online')}</div></div></div>`).join('') :
            `<div class="empty-state" style="padding:16px">${t('st.online')} · 0</div>`) + '</div>';
      }
    } else if (socialTab === 'requests') {
      body = `<h3 style="margin-bottom:10px;font-size:13px;letter-spacing:.2em;color:var(--text2);text-transform:uppercase">${t('social.received')} (${reqIn.length})</h3>` +
        (reqIn.length ? reqIn.map(e => friendRow(e, 'in')).join('') : `<div class="empty-state" style="padding:16px">${t('social.noReq')}</div>`) +
        `<h3 style="margin:20px 0 10px;font-size:13px;letter-spacing:.2em;color:var(--text2);text-transform:uppercase">${t('social.sent')} (${reqOut.length})</h3>` +
        (reqOut.length ? reqOut.map(e => friendRow(e, 'out')).join('') : `<div class="empty-state" style="padding:16px">${t('social.noReq')}</div>`);
    } else {
      const q = searchQ.trim().toLowerCase();
      const results = ECHOES.filter(e => !q || e.name.toLowerCase().includes(q) || e.tag.includes(q));
      body = `<div class="search-wrap">${I.search}<input type="text" id="social-search" placeholder="${t('social.searchPh')}" value="${esc(searchQ)}" maxlength="24"></div>` +
        (results.length ? results.map(e => friendRow(e, 'search')).join('') : `<div class="empty-state">${I.search}${t('social.noResults')}</div>`);
    }
    panel.innerHTML = `
      <div class="sec-head reveal"><span class="sec-title">${t('social.title')}</span><span class="sec-sub">${t('social.sub')}</span></div>
      <div class="social-note reveal" style="--d:.05s">${t('social.note')}</div>
      <div class="tabs reveal" style="--d:.1s">
        <button class="tab ${socialTab === 'friends' ? 'active' : ''}" data-action="social.tab" data-id="friends">${t('social.friends')}<span class="cnt">${friends.length}</span></button>
        <button class="tab ${socialTab === 'requests' ? 'active' : ''}" data-action="social.tab" data-id="requests">${t('social.requests')}<span class="cnt">${reqIn.length + reqOut.length}</span></button>
        <button class="tab ${socialTab === 'search' ? 'active' : ''}" data-action="social.tab" data-id="search">${t('social.search')}</button>
      </div>
      <div class="panel-narrow reveal" style="--d:.15s" id="social-body">${body}</div>`;
    const search = document.getElementById('social-search');
    if (search) {
      search.addEventListener('input', () => {
        searchQ = search.value;
        const bodyEl = document.getElementById('social-body');
        const q = searchQ.trim().toLowerCase();
        const results = ECHOES.filter(e => !q || e.name.toLowerCase().includes(q) || e.tag.includes(q));
        const wrap = bodyEl.querySelector('.search-wrap').outerHTML;
        bodyEl.innerHTML = wrap + (results.length ? results.map(e => friendRow(e, 'search')).join('') : `<div class="empty-state">${I.search}${t('social.noResults')}</div>`);
        const s2 = document.getElementById('social-search');
        s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length);
        s2.addEventListener('input', arguments.callee);
      });
    }
  }

  // ---------- profil ----------
  function renderProfile() {
    const st = S.stats;
    const li = levelInfo();
    const kd = st.deaths ? (st.kills / st.deaths).toFixed(2) : st.kills.toFixed(2);
    const acc = st.shots ? Math.round(st.hits / st.shots * 100) + '%' : '—';
    const wr = st.matches ? Math.round(st.wins / st.matches * 100) + '%' : '—';
    const banner = bannerURL(S.custom.banner, { armor: S.custom.armor, energy: S.custom.energy });
    const hist = S.matches.slice(0, 10);
    panel.innerHTML = `
      <div class="panel-narrow">
        <div class="prof-banner reveal" style="background-image:url('${banner}')"></div>
        <div class="prof-head reveal" style="--d:.08s">
          <div class="prof-ava"><img src="${myAva(128)}" alt=""></div>
          <div class="prof-id">
            <div class="prof-name">${esc(S.profile.name)} <button class="btn-icon" data-action="profile.edit" title="${t('prof.edit')}">${I.edit}</button></div>
            <div class="prof-title">${t('lvl.' + S.custom.title)} · #${S.profile.id.slice(0, 4).toUpperCase()}</div>
          </div>
        </div>
        <div class="prof-lvlrow reveal" style="--d:.12s">
          <div class="lvl-hex">${li.level}</div>
          <div style="flex:1;min-width:200px">
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);margin-bottom:5px">
              <span>${t('top.level')} ${li.level}</span><span>${fmtNum(li.xp)} / ${fmtNum(li.need)} XP</span>
            </div>
            <div class="bar"><i style="width:${li.pct * 100}%"></i></div>
          </div>
        </div>
        <div class="stat-grid reveal" style="--d:.16s">
          <div class="stat-cell"><div class="stat-val">${st.matches}</div><div class="stat-key">${t('prof.matches')}</div></div>
          <div class="stat-cell"><div class="stat-val ok">${st.wins}</div><div class="stat-key">${t('prof.wins')} · ${wr}</div></div>
          <div class="stat-cell"><div class="stat-val cy">${st.kills}</div><div class="stat-key">${t('prof.kills')}</div></div>
          <div class="stat-cell"><div class="stat-val mg">${kd}</div><div class="stat-key">${t('prof.kd')}</div></div>
          <div class="stat-cell"><div class="stat-val">${st.shards}</div><div class="stat-key">${t('prof.shards')}</div></div>
          <div class="stat-cell"><div class="stat-val cy">${acc}</div><div class="stat-key">${t('prof.acc')}</div></div>
          <div class="stat-cell"><div class="stat-val">${st.bestWave || '—'}</div><div class="stat-key">${t('prof.bestWave')}</div></div>
          <div class="stat-cell"><div class="stat-val ok">${fmtDur(st.playtime)}</div><div class="stat-key">${t('prof.time')}</div></div>
        </div>
        ${hist.length ? `<div class="card reveal" style="--d:.2s;margin-bottom:20px"><h3>${I.bolt} ${t('prof.form')}</h3><canvas id="form-chart" width="640" height="70" style="width:100%;height:70px"></canvas></div>` : ''}
        <div class="card reveal" style="--d:.24s">
          <h3>${I.clock} ${t('prof.history')}</h3>
          ${hist.length ? hist.map(m => `
            <div class="hist-row">
              <span class="hist-res ${m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : 'neutral'}">${m.result === 'win' ? t('hud.victory') : m.result === 'loss' ? t('hud.defeat') : t('hud.draw')}</span>
              <span class="hist-mode">${t('play.' + m.mode)}</span>
              <span class="hist-kd">${m.kills} É / ${m.deaths} M${m.wave ? ' · Vague ' + m.wave : ''}</span>
              <span class="hist-xp">+${m.xp} XP</span>
              <span class="hist-date">${fmtDate(m.date)}</span>
            </div>`).join('') : `<div class="empty-state">${I.clock}${t('prof.noHistory')}</div>`}
        </div>
      </div>`;
    const chart = document.getElementById('form-chart');
    if (chart) {
      const x = chart.getContext('2d');
      const data = S.matches.slice(0, 10).reverse();
      const max = Math.max(...data.map(m => m.score), 1);
      const bw = 640 / data.length;
      data.forEach((m, i) => {
        const h = Math.max(6, m.score / max * 58);
        x.fillStyle = m.result === 'win' ? '#ffb347' : m.result === 'loss' ? '#ff4d5e' : '#38e1ff';
        x.globalAlpha = .85;
        x.fillRect(i * bw + 8, 66 - h, bw - 16, h);
      });
    }
  }

  // ---------- arsenal ----------
  function renderArsenal() {
    let body = '';
    if (arsenalTab === 'skins') {
      body = `<div class="cos-list">${COSMETICS.skins.map(s => {
        const owned = ownsCos('skins', s.id);
        const eq = S.custom.skin === s.id;
        return `<button class="cos-item ${eq ? 'eq' : ''} ${owned ? '' : 'locked'}" data-action="arsenal.skin" data-id="${s.id}">
          <div class="cos-swatch" style="background:linear-gradient(135deg,${S.custom.armor},${S.custom.energy})"></div>
          <div><div class="cos-name">${s.name}</div><div class="cos-desc">${s.desc}</div></div>
          <span class="cos-state">${eq ? I.check + ' ' + t('arsenal.equipped') : owned ? t('arsenal.equip') : s.cost === 0 ? t('arsenal.free') : I.shard + ' ' + s.cost}</span>
        </button>`;
      }).join('')}</div>`;
    } else if (arsenalTab === 'colors') {
      body = `
        <div class="cfg-label" style="margin-bottom:10px"><span>${t('arsenal.armor')}</span></div>
        <div class="swatches" style="margin-bottom:22px">${COSMETICS.armorColors.map(c => `<div class="swatch ${S.custom.armor === c ? 'eq' : ''}" style="background:${c}" data-action="arsenal.armor" data-id="${c}"></div>`).join('')}</div>
        <div class="cfg-label" style="margin-bottom:10px"><span>${t('arsenal.energy')}</span></div>
        <div class="swatches">${COSMETICS.energyColors.map(c => `<div class="swatch ${S.custom.energy === c ? 'eq' : ''}" style="background:${c};box-shadow:inset 0 0 0 2px rgba(255,255,255,.15),0 0 12px ${c}66" data-action="arsenal.energy" data-id="${c}"></div>`).join('')}</div>`;
    } else if (arsenalTab === 'banners') {
      body = `<div class="cos-list">${COSMETICS.banners.map(b => {
        const owned = ownsCos('banners', b.id);
        const eq = S.custom.banner === b.id;
        const url = bannerURL(b.id, { armor: S.custom.armor, energy: S.custom.energy });
        return `<button class="cos-item ${eq ? 'eq' : ''} ${owned ? '' : 'locked'}" data-action="arsenal.banner" data-id="${b.id}">
          <div class="banner-prev" style="background-image:url('${url}')"></div>
          <div class="cos-name">${b.name}</div>
          <span class="cos-state">${eq ? I.check + ' ' + t('arsenal.equipped') : owned ? t('arsenal.equip') : I.shard + ' ' + b.cost}</span>
        </button>`;
      }).join('')}</div>`;
    } else {
      body = `<div class="cos-list">${COSMETICS.titles.map(ti => {
        const unlocked = S.progress.level >= ti.lvl;
        const eq = S.custom.title === ti.id;
        return `<button class="cos-item ${eq ? 'eq' : ''} ${unlocked ? '' : 'locked'}" data-action="arsenal.title" data-id="${ti.id}">
          <div class="cos-swatch" style="background:linear-gradient(135deg,#1a2634,#0e1a2a);display:flex;align-items:center;justify-content:center;color:${unlocked ? 'var(--amber)' : 'var(--text3)'}">${unlocked ? I.crown : I.lock}</div>
          <div><div class="cos-name">${t('lvl.' + ti.id)}</div><div class="cos-desc">${t('arsenal.locked')} ${ti.lvl}</div></div>
          <span class="cos-state">${eq ? I.check + ' ' + t('arsenal.equipped') : unlocked ? t('arsenal.equip') : I.lock + ' ' + ti.lvl}</span>
        </button>`;
      }).join('')}</div>`;
    }
    panel.innerHTML = `
      <div class="sec-head reveal"><span class="sec-title">${t('arsenal.title')}</span><span class="sec-sub">${t('arsenal.sub')}</span></div>
      <div class="arsenal-grid">
        <div class="arsenal-stage"><div class="arsenal-hint reveal">${t('arsenal.drag')}</div></div>
        <div class="card reveal" style="--d:.1s">
          <div class="tabs" style="margin-bottom:14px">
            ${[['skins', 'arsenal.chassis'], ['colors', 'arsenal.colors'], ['banners', 'arsenal.banners'], ['titles', 'arsenal.titles']].map(([id, key]) =>
              `<button class="tab ${arsenalTab === id ? 'active' : ''}" data-action="arsenal.tab" data-id="${id}" style="padding:7px 12px;font-size:12px">${t(key)}</button>`).join('')}
          </div>
          ${body}
        </div>
      </div>`;
  }

  // ---------- paramètres ----------
  function rangeRow(key, path, min, max, step, fmt = v => v) {
    const v = pathGet(path);
    return `<div class="set-row">
      <div><div class="set-name">${t(key)}</div>${t(key + '.d') !== key + '.d' ? `<div class="set-desc">${t(key + '.d')}</div>` : ''}</div>
      <div class="set-ctrl"><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-bind="${path}"><output data-val-for="${path}">${fmt(v)}</output></div>
    </div>`;
  }
  function toggleRow(key, path) {
    return `<div class="set-row">
      <div><div class="set-name">${t(key)}</div>${t(key + '.d') !== key + '.d' ? `<div class="set-desc">${t(key + '.d')}</div>` : ''}</div>
      <label class="toggle"><input type="checkbox" ${pathGet(path) ? 'checked' : ''} data-bind="${path}"><i></i></label>
    </div>`;
  }
  const pathGet = p => p.split('.').reduce((o, k) => o[k], S);
  const pct = v => Math.round(v * 100) + '%';

  function renderSettings() {
    let body = '';
    if (settingsTab === 'graphics') {
      body = `
        <div class="set-row"><div><div class="set-name">${t('set.quality')}</div><div class="set-desc">${t('set.quality.d')}</div></div>
          <div class="set-ctrl"><select data-bind="settings.quality" style="width:160px">
            ${['low', 'medium', 'high', 'ultra'].map(q => `<option value="${q}" ${S.settings.quality === q ? 'selected' : ''}>${t('q.' + q)}</option>`).join('')}
          </select></div></div>
        ${rangeRow('set.res', 'settings.resScale', .5, 1.5, .05, pct)}
        ${rangeRow('set.fov', 'settings.fov', 60, 100, 1, v => v + '°')}
        ${toggleRow('set.bloom', 'settings.bloom')}
        ${toggleRow('set.shadows', 'settings.shadows')}
        ${toggleRow('set.fps', 'settings.showFps')}
        <div class="set-row"><div class="set-name">${t('set.fullscreen')}</div>
          <button class="btn btn-ghost btn-sm" data-action="fullscreen">${document.fullscreenElement ? t('set.fullscreen.off') : t('set.fullscreen.on')}</button></div>`;
    } else if (settingsTab === 'audio') {
      body = `
        ${rangeRow('set.volMaster', 'settings.volMaster', 0, 1, .05, pct)}
        ${rangeRow('set.volMusic', 'settings.volMusic', 0, 1, .05, pct)}
        ${rangeRow('set.volSfx', 'settings.volSfx', 0, 1, .05, pct)}
        ${rangeRow('set.volAmb', 'settings.volAmb', 0, 1, .05, pct)}
        ${toggleRow('set.mute', 'settings.muted')}`;
    } else if (settingsTab === 'controls') {
      body = `
        ${rangeRow('set.sens', 'settings.sens', .2, 2, .05, v => Number(v).toFixed(2))}
        ${toggleRow('set.invertY', 'settings.invertY')}
        ${toggleRow('set.aimHold', 'settings.aimHold')}
        ${toggleRow('set.autoSprint', 'settings.autoSprint')}
        ${toggleRow('set.shake', 'settings.shake')}`;
    } else if (settingsTab === 'interface') {
      body = `
        ${toggleRow('set.dmgNums', 'settings.dmgNums')}
        <div class="set-row"><div class="set-name">${t('set.crosshair')}</div>
          <div class="set-ctrl"><select data-bind="settings.crosshair" style="width:140px">
            ${['cross', 'dot', 'circle'].map(c => `<option value="${c}" ${S.settings.crosshair === c ? 'selected' : ''}>${t('ch.' + c)}</option>`).join('')}
          </select></div></div>
        <div class="set-row"><div><div class="set-name">${t('set.lang')}</div><div class="set-desc">${t('set.lang.d')}</div></div>
          <div class="set-ctrl"><select data-bind="settings.lang" style="width:140px">
            <option value="fr" ${S.settings.lang === 'fr' ? 'selected' : ''}>Français</option>
            <option value="en" ${S.settings.lang === 'en' ? 'selected' : ''}>English</option>
          </select></div></div>`;
    } else {
      const ns = app.net.status;
      body = `
        <div class="social-note" style="margin-bottom:14px">${t('set.net.d')}</div>
        <div class="set-row"><div class="set-name">${t('set.netUrl')}</div>
          <div class="set-ctrl" style="min-width:260px"><input type="text" data-bind="settings.netUrl" value="${esc(S.settings.netUrl)}" style="width:220px"></div></div>
        <div class="set-row">
          <div><div class="set-name">${t('net.' + (ns === 'on' ? 'on' : ns === 'connecting' ? 'connecting' : ns === 'error' ? 'error' : 'off'))}</div>
          ${ns === 'on' ? `<div class="set-desc">${app.net.peers.length} ${t('st.online').toLowerCase()}</div>` : ''}</div>
          ${ns === 'on' || ns === 'connecting' ?
            `<button class="btn btn-danger btn-sm" data-action="net.disconnect">${t('set.netDisconnect')}</button>` :
            `<button class="btn btn-ghost btn-sm" data-action="net.connect">${I.net} ${t('set.netConnect')}</button>`}
        </div>`;
    }
    panel.innerHTML = `
      <div class="sec-head reveal"><span class="sec-title">${t('set.title')}</span><span class="sec-sub">${t('set.sub')}</span></div>
      <div class="tabs reveal" style="--d:.05s">
        ${[['graphics', 'set.graphics'], ['audio', 'set.audio'], ['controls', 'set.controls'], ['interface', 'set.interface'], ['network', 'set.network']].map(([id, key]) =>
          `<button class="tab ${settingsTab === id ? 'active' : ''}" data-action="settings.tab" data-id="${id}">${t(key)}</button>`).join('')}
      </div>
      <div class="card panel-narrow reveal" style="--d:.1s">${body}</div>`;
    panel.querySelectorAll('input[type=range]').forEach(syncRangeFill);
  }

  function syncRangeFill(r) {
    const min = +r.min, max = +r.max, v = +r.value;
    r.style.setProperty('--p', ((v - min) / (max - min) * 100) + '%');
  }

  // ================= notifications =================
  function renderNotifDrop() {
    if (!notifOpen) { notifDrop.classList.add('hidden'); return; }
    const items = S.notifs.slice(0, 20);
    notifDrop.innerHTML = `
      <div class="notif-head"><b>${t('notif.title')}</b>
        <div style="display:flex;gap:6px">
          <button class="btn btn-dark btn-sm" data-action="notif.read">${t('notif.markRead')}</button>
          <button class="btn btn-dark btn-sm" data-action="notif.clear">${t('notif.clear')}</button>
        </div></div>
      ${items.length ? items.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}">
          <div class="notif-ico ni-${n.type}">${n.type === 'social' ? I.social : n.type === 'xp' ? I.bolt : n.type === 'ok' ? I.check : I.info}</div>
          <div><div>${notifText(n)}</div><div class="notif-time">${fmtDate(n.ts)}</div></div>
        </div>`).join('') : `<div class="empty-state" style="padding:20px">${t('notif.empty')}</div>`}`;
    notifDrop.classList.remove('hidden');
  }
  function notifText(n) {
    let s = t(n.key);
    for (const [k, v] of Object.entries(n.params || {})) s = s.replace('{' + k + '}', esc(v));
    return s;
  }

  function toast(type, title, msg = '', raw = false) {
    const el = document.createElement('div');
    const colors = { info: 'var(--info)', ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', social: 'var(--magenta)', xp: 'var(--amber)' };
    el.className = 'toast';
    el.style.setProperty('--tc', colors[type] || colors.info);
    el.innerHTML = `<div class="toast-ico ni-${type}">${type === 'social' ? I.social : type === 'ok' ? I.check : type === 'warn' || type === 'danger' ? I.info : I.bolt}</div>
      <div><div class="toast-title">${raw ? title : t(title)}</div>${msg ? `<div class="toast-msg">${raw ? msg : (t(msg) !== msg ? t(msg) : msg)}</div>` : ''}</div>`;
    toasts.appendChild(el);
    audio.play('notif');
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 4000);
    while (toasts.children.length > 4) toasts.firstChild.remove();
  }

  // ================= modales =================
  function openModal(html) {
    modal.innerHTML = `<div class="modal-card" style="position:relative">${html}</div>`;
    modal.classList.remove('hidden');
  }
  function closeModal() { modal.classList.add('hidden'); modal.innerHTML = ''; confirmCb = null; }
  function confirm(titleKey, msgKey, cb, params = {}) {
    let msg = t(msgKey);
    for (const [k, v] of Object.entries(params)) msg = msg.replace('{' + k + '}', esc(v));
    confirmCb = cb;
    openModal(`
      <div class="modal-title">${t(titleKey)}</div>
      <p style="color:var(--text2);line-height:1.6">${msg}</p>
      <div class="modal-actions">
        <button class="btn btn-dark" data-action="modal.close">${t('modal.no')}</button>
        <button class="btn btn-danger" data-action="confirm.ok">${t('modal.yes')}</button>
      </div>`);
  }
  function echoProfile(e) {
    const st = presence.get(e.id) || 'offline';
    const fs = friendState(e.id);
    openModal(`
      <button class="btn-icon modal-close" data-action="modal.close">${I.x}</button>
      <div style="height:90px;clip-path:var(--clip-s);background:linear-gradient(120deg,${e.armor},#0a1220 70%);position:relative;margin-bottom:-30px">
        <div style="position:absolute;inset:0;background:radial-gradient(80% 100% at 80% 0%,${e.energy}33,transparent)"></div>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;margin-left:16px;position:relative">
        <div class="prof-ava" style="width:84px;height:84px"><img src="${echoAva(e, 128)}" alt=""></div>
        <div style="padding-bottom:4px">
          <div class="prof-name" style="font-size:21px">${esc(e.name)} <span class="f-tag">#${e.tag}</span></div>
          <div class="prof-title">NIV ${e.level} · ${t(STATUS_KEY[st])}</div>
        </div>
      </div>
      <p style="color:var(--text2);line-height:1.6;margin:16px 0;font-style:italic">« ${e.bio} »</p>
      <div class="social-note" style="margin:0 0 6px">${t('social.note')}</div>
      <div class="modal-actions">
        ${fs === 'friend' ? `<button class="btn btn-ghost" data-action="friend.invite" data-id="${e.id}">${I.plus} ${t('social.invite')}</button>` :
          fs === 'none' ? `<button class="btn btn-ghost" data-action="friend.add" data-id="${e.id}">${I.plus} ${t('social.add')}</button>` : ''}
        <button class="btn btn-dark" data-action="modal.close">${t('modal.close')}</button>
      </div>`);
  }
  function helpModal() {
    const rows = [
      ['keys.move', '<kbd>ZQSD</kbd> / <kbd>WASD</kbd>'], ['keys.look', '<kbd>Souris</kbd>'],
      ['keys.fire', '<kbd>Clic gauche</kbd>'], ['keys.aim', '<kbd>Clic droit</kbd>'],
      ['keys.jump', '<kbd>Espace</kbd>'], ['keys.sprint', '<kbd>Maj</kbd>'],
      ['keys.reload', '<kbd>R</kbd>'], ['keys.score', '<kbd>Tab</kbd>'],
      ['keys.pause', '<kbd>Échap</kbd>'], ['keys.mute', '<kbd>M</kbd>'],
    ];
    openModal(`
      <button class="btn-icon modal-close" data-action="modal.close">${I.x}</button>
      <div class="modal-title">${t('hud.controls')}</div>
      <table class="key-table">${rows.map(([k, v]) => `<tr><td>${t(k)}</td><td style="text-align:right">${v}</td></tr>`).join('')}</table>
      <div class="modal-actions"><button class="btn btn-primary" data-action="modal.close">${t('modal.close')}</button></div>`);
  }
  function welcome() {
    openModal(`
      <div class="welcome-logo">${LOGO_MARK.replace('class="logo-mark"', 'style="width:64px;height:64px"')}</div>
      <div class="modal-title" style="justify-content:center">${t('welcome.title')}</div>
      <p class="welcome-lore">${t('welcome.lore')}</p>
      <div class="welcome-keys">
        <span>${t('keys.move')} — <kbd>ZQSD/WASD</kbd></span><span>${t('keys.fire')} — <kbd>Clic G</kbd></span>
        <span>${t('keys.jump')} — <kbd>Espace</kbd></span><span>${t('keys.aim')} — <kbd>Clic D</kbd></span>
        <span>${t('keys.sprint')} — <kbd>Maj</kbd></span><span>${t('keys.reload')} — <kbd>R</kbd></span>
      </div>
      <p style="font-size:12.5px;color:var(--text3);margin-top:10px">${t('welcome.audio')}</p>
      <div class="modal-actions" style="justify-content:center">
        <button class="btn btn-primary btn-big" data-action="welcome.enter">${I.play} ${t('welcome.enter')}</button>
      </div>`);
  }

  // ================= actions (délégation globale) =================
  function onAction(action, el, ev) {
    const id = el.dataset.id;
    const [ns, act] = action.split('.');
    if (ns !== 'audio') audio.play('click');
    switch (action) {
      case 'nav.home': case 'nav.play': case 'nav.squad': case 'nav.social':
      case 'nav.profile': case 'nav.arsenal': case 'nav.settings':
        if (app.state === 'match') break;
        show(act); break;
      case 'home.play': show('play'); break;
      case 'home.quick': selectedMode = S.lastMode; app.startMatch({ mode: selectedMode, difficulty: cfg.difficulty }); break;
      case 'mode.select':
        selectedMode = id;
        cfg = { ...modeDefaults(id), difficulty: cfg.difficulty, returnFire: cfg.returnFire };
        S.lastMode = id; save();
        if (section === 'squad') renderSquad(); else { show('play'); }
        break;
      case 'play.launch': app.startMatch({ mode: selectedMode, ...cfg }); break;
      case 'challenge.claim':
        if (claimChallenge()) { audio.play('buy'); renderTopbar(); if (section === 'home') renderHome(); else if (section === 'squad') renderSquad(); }
        break;
      case 'squad.kick': app.squadRemove(id); if (section === 'squad') renderSquad(); else if (section === 'home') renderHome(); break;
      case 'squad.dissolve': app.squadClear(); renderSquad(); break;
      case 'social.tab': socialTab = id; renderSocial(); break;
      case 'friend.add':
        if (sendRequest(id)) toast('social', 'toast.reqSent', echoById(id).name, true);
        refreshSocialViews(); break;
      case 'friend.accept': acceptRequest(id); audio.play('buy'); refreshSocialViews(); renderRail(); break;
      case 'friend.decline': declineRequest(id); refreshSocialViews(); renderRail(); break;
      case 'friend.cancel': cancelRequest(id); refreshSocialViews(); break;
      case 'friend.remove':
        confirm('modal.confirmRemove', 'modal.confirmRemoveMsg', () => {
          removeFriend(id); app.squadRemove(id); toast('warn', 'toast.friendRemoved', echoById(id).name, true); refreshSocialViews();
        }, { name: echoById(id).name });
        break;
      case 'friend.invite': app.squadInvite(id); closeModal(); refreshSocialViews(); break;
      case 'friend.join': app.squadJoin(id); closeModal(); show('squad'); break;
      case 'friend.profile': echoProfile(echoById(id)); break;
      case 'notif.toggle': notifOpen = !notifOpen; renderNotifDrop(); break;
      case 'notif.read': markNotifsRead(); renderNotifDrop(); renderTopbar(); break;
      case 'notif.clear': clearNotifs(); renderNotifDrop(); renderTopbar(); break;
      case 'audio.toggle': {
        audio.init();
        const muted = audio.toggleMute();
        save(); renderTopbar();
        toast(muted ? 'warn' : 'ok', muted ? 'toast.audioOff' : 'toast.audioOn');
        break;
      }
      case 'fullscreen':
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
        setTimeout(() => { if (section === 'settings') renderSettings(); }, 300);
        break;
      case 'help': case 'pause.controls': helpModal(); break;
      case 'profile.edit':
        openModal(`
          <div class="modal-title">${t('prof.edit')}</div>
          <input type="text" id="name-input" maxlength="16" placeholder="${t('prof.namePh')}" value="${esc(S.profile.name)}">
          <div class="modal-actions">
            <button class="btn btn-dark" data-action="modal.close">${t('modal.no')}</button>
            <button class="btn btn-primary" data-action="profile.savename">${t('prof.save')}</button>
          </div>`);
        setTimeout(() => document.getElementById('name-input')?.focus(), 60);
        break;
      case 'profile.savename': {
        const v = document.getElementById('name-input')?.value.trim();
        if (v && v.length >= 3) {
          S.profile.name = v.slice(0, 16); save();
          closeModal(); renderTopbar(); renderProfile();
          toast('ok', 'toast.nameOk');
        } else audio.play('error');
        break;
      }
      case 'arsenal.tab': arsenalTab = id; renderArsenal(); break;
      case 'arsenal.skin':
        if (ownsCos('skins', id)) { equipCos('skins', id); app.rebuildHero(); toast('ok', 'toast.equipped', '', true); }
        else if (buyCos('skins', id)) { equipCos('skins', id); app.rebuildHero(); audio.play('buy'); renderTopbar(); }
        else { audio.play('error'); toast('warn', 'toast.noLumen', 'toast.noLumenMsg'); }
        renderArsenal(); break;
      case 'arsenal.banner':
        if (ownsCos('banners', id)) { equipCos('banners', id); toast('ok', 'toast.equipped', '', true); }
        else if (buyCos('banners', id)) { equipCos('banners', id); audio.play('buy'); renderTopbar(); }
        else { audio.play('error'); toast('warn', 'toast.noLumen', 'toast.noLumenMsg'); }
        renderArsenal(); break;
      case 'arsenal.title': {
        const ti = COSMETICS.titles.find(x => x.id === id);
        if (S.progress.level >= ti.lvl) { equipCos('titles', id); toast('ok', 'toast.equipped', '', true); renderArsenal(); }
        else audio.play('error');
        break;
      }
      case 'arsenal.armor': S.custom.armor = id; save(); app.updateHeroColors(); renderArsenal(); renderTopbar(); break;
      case 'arsenal.energy': S.custom.energy = id; save(); app.updateHeroColors(); renderArsenal(); renderTopbar(); break;
      case 'settings.tab': settingsTab = id; renderSettings(); break;
      case 'net.connect': app.net.connect(); setTimeout(renderSettings, 400); break;
      case 'net.disconnect': app.net.disconnect(); renderSettings(); break;
      case 'modal.close': closeModal(); break;
      case 'confirm.ok': { const cb = confirmCb; closeModal(); cb && cb(); break; }
      case 'welcome.enter':
        S.profile.seenWelcome = true; save();
        audio.init(); audio.music('menu');
        closeModal();
        break;
      // ---- HUD / pause ----
      case 'pause.open': if (app.match && app.match.state !== 'ended') app.pauseMatch(true); break;
      case 'pause.resume': app.pauseMatch(false); break;
      case 'pause.quit':
        if (app.match?.mode === 'training') { closeModal(); app.match.end('draw', null, false); document.exitPointerLock?.(); }
        else confirm('modal.confirmQuit', 'modal.confirmQuitMsg', () => { app.exitMatch(false); toast('warn', 'toast.quit', 'toast.quitMsg'); });
        break;
      case 'end.replay': { const m = app.match; const c = m ? { mode: m.mode, ...m.cfg } : null; app.exitMatch(true); if (c) app.startMatch(c); break; }
      case 'end.menu': app.exitMatch(true); break;
    }
  }
  function refreshSocialViews() {
    if (section === 'social') renderSocial();
    else if (section === 'home') renderHome();
    else if (section === 'squad') renderSquad();
    renderRail();
  }

  // délégation unique sur body (couvre UI + HUD + modales)
  document.body.addEventListener('click', ev => {
    const el = ev.target.closest('[data-action]');
    if (el) { onAction(el.dataset.action, el, ev); return; }
    if (notifOpen && !ev.target.closest('#dropdown-notif')) { notifOpen = false; renderNotifDrop(); }
    if (ev.target === modal) closeModal();
  });
  document.body.addEventListener('pointerover', ev => {
    const el = ev.target.closest('[data-action]');
    if (el && !el.contains(ev.relatedTarget)) audio.play('hover');
  });
  document.body.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.bind) {
      let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      set(el.dataset.bind, v);
      const out = document.querySelector(`[data-val-for="${el.dataset.bind}"]`);
      if (out) {
        const p = el.dataset.bind;
        out.textContent = p.includes('vol') || p === 'settings.resScale' ? Math.round(v * 100) + '%' : p === 'settings.sens' ? Number(v).toFixed(2) : p === 'settings.fov' ? v + '°' : v;
      }
      if (el.type === 'range') syncRangeFill(el);
    }
    if (el.dataset.cfg) {
      const k = el.dataset.cfg;
      cfg[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      const out = document.getElementById('cfg-' + k + '-out');
      if (out) out.textContent = cfg[k];
      if (el.type === 'range') syncRangeFill(el);
    }
  });
  document.body.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.bind && el.tagName === 'SELECT') {
      set(el.dataset.bind, el.value);
      if (el.dataset.bind === 'settings.lang') { renderTopbar(); renderRail(); show(section); }
      if (el.dataset.bind === 'settings.quality' && section === 'settings') renderSettings();
    }
    if (el.dataset.cfg && el.tagName === 'SELECT') cfg[el.dataset.cfg] = el.value;
  });

  // bus
  bus.on('toast', d => toast(d.type || 'info', d.title, d.msg || '', d.raw));
  bus.on('notif', () => { renderTopbar(); if (notifOpen) renderNotifDrop(); renderRail(); });
  bus.on('friends', () => { renderRail(); refreshSocialViews(); });
  bus.on('level', () => renderTopbar());
  bus.on('challenge', () => { if (section === 'home') renderHome(); });
  bus.on('presence', () => { if (section === 'social' && socialTab === 'friends') renderSocial(); });
  bus.on('net', () => { renderRail(); if (section === 'settings' && settingsTab === 'network') renderSettings(); if (section === 'social') renderSocial(); });
  bus.on('settings', path => {
    if (path === 'settings.muted') renderTopbar();
    if (path === 'settings.showFps') document.body.classList.toggle('fps-on', S.settings.showFps);
  });
  bus.on('squad', () => { if (section === 'home') renderHome(); else if (section === 'squad') renderSquad(); });
  bus.on('matches', () => { if (section === 'profile') renderProfile(); });

  return {
    show, renderTopbar, renderRail, welcome, helpModal, toast, confirm, closeModal,
    refreshSquad: () => { if (section === 'home') renderHome(); else if (section === 'squad') renderSquad(); },
    get section() { return section; },
    mount() { root.classList.remove('hidden'); renderTopbar(); renderRail(); show('home'); },
  };
}