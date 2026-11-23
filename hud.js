// ============ HUD en partie ============
import { S } from '../core/store.js';
import { t } from '../core/strings.js';
import { audio } from '../audio/audio.js';
import { clamp, fmtTime, esc } from '../core/utils.js';

export function createHud(app) {
  const root = document.getElementById('hud');
  let match = null;
  let mmCtx = null, mmStatic = null;
  let annTimer = null, hintTimer = null;
  let frame = 0;

  const ICON_HEART = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.9-9.5-9C1 8.5 3 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 5 23 8.5 21.5 12c-2 4.1-9.5 9-9.5 9z"/></svg>';
  const ICON_BOLT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>';

  function mount(m) {
    match = m;
    const cfg = m.cfg;
    const isTeam = m.mode === 'confluence';
    const isFFA = m.mode === 'moisson';
    const isWave = m.mode === 'survie';
    root.innerHTML = `
      <div id="dmgvignette"></div><div id="lowhp"></div><div id="dmgdir"></div>
      <div class="hud-top">
        ${isWave ? `<div class="hud-wave" id="hud-wave"></div><div class="hud-lives" id="hud-lives"></div>` :
          `<div class="hud-timer" id="hud-timer">${cfg.free ? '∞' : fmtTime(m.timeLeft)}</div>`}
        ${isTeam ? `<div class="hud-scores">
          <div class="score-team a"><span class="score-lbl">${t('hud.teamA')}</span><span id="score-a">0</span></div>
          <div class="score-goal">${t('hud.goal')} ${cfg.score}</div>
          <div class="score-team b"><span id="score-b">0</span><span class="score-lbl">${t('hud.teamB')}</span></div>
        </div>` : isFFA ? `<div class="hud-scores">
          <div class="score-team a"><span class="score-lbl">◈</span><span id="score-a">0</span></div>
          <div class="score-goal">${t('hud.goal')} ${cfg.score}</div>
          <div class="score-team b"><span class="score-lbl">RIVAL</span><span id="score-b">0</span></div>
        </div>` : ''}
      </div>
      <canvas id="hud-minimap" width="168" height="168"></canvas>
      <div id="killfeed"></div>
      <div class="hud-bl">
        <div class="hud-portrait"><img id="hud-ava" alt=""></div>
        <div class="hud-vitals">
          <div class="vital sh"><div class="vital-bar"><i id="bar-sh" style="width:100%"></i></div><div class="vital-num" id="num-sh">50</div></div>
          <div class="vital hp" id="vital-hp"><div class="vital-bar"><i id="bar-hp" style="width:100%"></i></div><div class="vital-num" id="num-hp">100</div></div>
        </div>
      </div>
      <div class="hud-br">
        <div class="ammo-big" id="ammo">24<small>/24</small></div>
        <div class="weapon-name">${t('hud.weapon')}</div>
        <svg class="reload-ring hidden" id="reload-ring" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16"/><circle class="prog" id="reload-prog" cx="20" cy="20" r="16" stroke-dasharray="100.5" stroke-dashoffset="100.5"/>
        </svg>
      </div>
      <div id="crosshair"></div>
      <div id="hitmarker"><span style="left:0;top:12px;width:8px;height:2px"></span><span style="right:0;top:12px;width:8px;height:2px"></span><span style="top:0;left:12px;width:2px;height:8px"></span><span style="bottom:0;left:12px;width:2px;height:8px"></span></div>
      <div id="announce"></div>
      <div id="hint"></div>
      <div id="respawn" class="hidden"></div>
      <div id="scoreboard" class="hidden"></div>
      <div id="pause" class="hidden"></div>
      <div id="endscreen" class="hidden"></div>
      <div id="fps" class="${S.settings.showFps ? '' : 'hidden'}">-- FPS</div>
      <button id="hud-pausebtn" class="btn-icon clickable" data-action="pause.open" title="Pause">
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
      </button>
      <div id="touch">
        <div id="joy-zone"></div><div id="joy"><i></i></div>
        <div id="look-zone"></div>
        <div class="tbtn" id="tb-fire">TIR</div>
        <div class="tbtn" id="tb-jump">SAUT</div>
        <div class="tbtn" id="tb-reload">RECH</div>
      </div>`;
    root.classList.remove('hidden');
    document.getElementById('hud-ava').src = app.avatarURL();
    drawCrosshair();
    const mm = document.getElementById('hud-minimap');
    mmCtx = mm.getContext('2d');
    mmStatic = app.world.staticMap;
    if (isWave) updateWave(m);
    bindTouch();
    if (app.touchMode) hint(t('hud.objective.free') && 'Glissez à droite pour viser', 4);
  }

  function drawCrosshair() {
    const ch = document.getElementById('crosshair');
    if (!ch) return;
    const style = S.settings.crosshair;
    const gap = match?.player?.aiming ? 5 : 9 + (match?.player?.speed01 || 0) * 6;
    const col = '#eaf6ff';
    if (style === 'dot') ch.innerHTML = `<span style="left:20px;top:20px;width:4px;height:4px;border-radius:50%;background:${col}"></span>`;
    else if (style === 'circle') ch.innerHTML = `<span style="left:12px;top:12px;width:20px;height:20px;border-radius:50%;background:none;box-shadow:0 0 0 1.6px ${col},0 0 6px rgba(56,225,255,.8)"></span><span style="left:21px;top:21px;width:2px;height:2px;background:${col}"></span>`;
    else ch.innerHTML = `
      <span style="left:21px;top:${22 - gap - 7}px;width:2px;height:7px"></span>
      <span style="left:21px;top:${22 + gap}px;width:2px;height:7px"></span>
      <span style="top:21px;left:${22 - gap - 7}px;height:2px;width:7px"></span>
      <span style="top:21px;left:${22 + gap}px;height:2px;width:7px"></span>
      <span style="left:21px;top:21px;width:2px;height:2px"></span>`;
  }

  function update(m, dt) {
    frame++;
    const p = m.player;
    // vitals
    const hp = Math.max(0, Math.round(p.hp)), sh = Math.max(0, Math.round(p.shield));
    setBar('bar-hp', 'num-hp', hp, 100);
    setBar('bar-sh', 'num-sh', sh, 50);
    document.getElementById('vital-hp')?.classList.toggle('low', hp < 30);
    document.getElementById('lowhp')?.classList.toggle('on', hp < 30 && p.alive);
    // ammo
    const ammoEl = document.getElementById('ammo');
    if (ammoEl) {
      ammoEl.innerHTML = `${p.ammo}<small>/24</small>`;
      ammoEl.classList.toggle('low', p.ammo <= 5);
    }
    const ring = document.getElementById('reload-ring');
    if (ring) {
      if (p.reloadT > 0) {
        ring.classList.remove('hidden');
        document.getElementById('reload-prog').style.strokeDashoffset = 100.5 * (p.reloadT / 1.4);
      } else ring.classList.add('hidden');
    }
    // timer / scores
    const timer = document.getElementById('hud-timer');
    if (timer && !m.cfg.free) {
      timer.textContent = fmtTime(m.timeLeft);
      timer.classList.toggle('low', m.timeLeft < 30);
    }
    const sa = document.getElementById('score-a'), sb = document.getElementById('score-b');
    if (sa) {
      if (m.mode === 'confluence') { sa.textContent = m.scoreA; sb.textContent = m.scoreB; }
      else if (m.mode === 'moisson') {
        sa.textContent = p.score;
        sb.textContent = Math.max(...m.entities.filter(e => !e.isPlayer).map(e => e.score), 0);
      }
    }
    if (p.ammo === 5 && p.reloadT <= 0) hint(t('hud.lowammo'), 2);
    if (p.spawnProt > 0) hint(t('hud.protect'), .4);
    drawCrosshair();
    if (frame % 2 === 0) drawMinimap(m);
    // fps
    if (S.settings.showFps && frame % 30 === 0) {
      const f = document.getElementById('fps');
      if (f) f.textContent = Math.round(app.fps) + ' FPS';
    }
  }
  function setBar(barId, numId, v, max) {
    const b = document.getElementById(barId), n = document.getElementById(numId);
    if (b) b.style.width = clamp(v / max * 100, 0, 100) + '%';
    if (n) n.textContent = v;
  }

  function drawMinimap(m) {
    if (!mmCtx) return;
    const c = mmCtx, W = 168;
    c.clearRect(0, 0, W, W);
    c.drawImage(mmStatic, 0, 0, W, W);
    const px = v => (v + 200) / 400 * W;
    // éclats
    if (m.mode === 'moisson') {
      c.fillStyle = '#ffc23d';
      for (const sh of m.shards) { if (sh.active) { c.fillRect(px(sh.x) - 1.5, px(sh.z) - 1.5, 3, 3); } }
    }
    // pads
    c.fillStyle = 'rgba(56,225,255,.7)';
    for (const pd of m.world.pads) c.fillRect(px(pd.x) - 1, px(pd.z) - 1, 2, 2);
    // entités
    for (const e of m.entities) {
      if (!e.alive || e.isPlayer) continue;
      const ally = !m.cfg.ffa && e.team === m.player.team;
      c.fillStyle = ally ? '#ffb347' : '#ff4d5e';
      c.beginPath(); c.arc(px(e.x), px(e.z), 2.6, 0, 7); c.fill();
    }
    // joueur (flèche orientée)
    const p = m.player;
    c.save();
    c.translate(px(p.x), px(p.z));
    c.rotate(-m.camYaw + Math.PI);
    c.fillStyle = '#eaf6ff';
    c.beginPath(); c.moveTo(0, -5.5); c.lineTo(3.8, 4); c.lineTo(0, 1.8); c.lineTo(-3.8, 4); c.closePath(); c.fill();
    c.restore();
  }

  // ---- feedback ----
  function hitmarker(kill) {
    const h = document.getElementById('hitmarker');
    if (!h) return;
    h.classList.remove('show', 'kill');
    void h.offsetWidth;
    h.classList.add('show');
    if (kill) h.classList.add('kill');
  }
  function damageFlash(attacker) {
    const v = document.getElementById('dmgvignette');
    if (v) { v.style.opacity = 1; setTimeout(() => v.style.opacity = 0, 140); }
    if (attacker && match) {
      const d = document.getElementById('dmgdir');
      const ang = Math.atan2(attacker.x - match.player.x, attacker.z - match.player.z);
      const rel = ang - match.camYaw;
      if (d) {
        d.style.transform = `rotate(${-rel}rad)`;
        d.style.opacity = 1;
        setTimeout(() => d.style.opacity = 0, 500);
      }
    }
  }
  function killfeed(attacker, victim) {
    const kf = document.getElementById('killfeed');
    if (!kf) return;
    const el = document.createElement('div');
    el.className = 'kf';
    const an = attacker ? esc(attacker.name) : '—';
    const vn = esc(victim.name);
    el.innerHTML = `<span class="${attacker?.isPlayer ? 'you' : ''}">${an}</span>${ICON_BOLT}<span class="${victim.isPlayer ? 'you' : ''}">${vn}</span>`;
    kf.prepend(el);
    while (kf.children.length > 5) kf.lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 3600);
    setTimeout(() => el.remove(), 4200);
  }
  function announce(main, sub = '', cls = '') {
    const a = document.getElementById('announce');
    if (!a) return;
    clearTimeout(annTimer);
    a.innerHTML = `<div class="ann-main ${cls}">${esc(main)}</div>${sub ? `<div class="ann-sub">${esc(sub)}</div>` : ''}`;
    annTimer = setTimeout(() => a.innerHTML = '', 2100);
  }
  function hint(text, dur = 2) {
    const h = document.getElementById('hint');
    if (!h) return;
    h.textContent = text;
    h.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => h.classList.remove('show'), dur * 1000);
  }
  function flashScore() {
    const sa = document.getElementById('score-a');
    if (sa) { sa.style.transform = 'scale(1.4)'; setTimeout(() => sa.style.transform = '', 160); }
  }
  function showRespawn(killer) {
    const r = document.getElementById('respawn');
    if (!r) return;
    r.classList.remove('hidden');
    r.innerHTML = `
      <div class="resp-title">${t('hud.respawn')}</div>
      ${killer ? `<div class="resp-killer">${t('hud.respBy')} <b>${esc(killer.name)}</b></div>` : ''}
      <div class="resp-count" id="resp-count">3</div>
      <div class="resp-tip">${t('hud.respTip')}</div>`;
  }
  function updateRespawn(sec) {
    const c = document.getElementById('resp-count');
    if (c) c.textContent = Math.max(1, Math.ceil(sec));
  }
  function hideRespawn() { document.getElementById('respawn')?.classList.add('hidden'); }
  function updateWave(m) {
    const w = document.getElementById('hud-wave');
    if (w) w.textContent = `${t('hud.wave')} ${m.wave}`;
    const l = document.getElementById('hud-lives');
    if (l) {
      l.innerHTML = '';
      for (let i = 0; i < (m.cfg.lives || 3); i++) {
        const span = document.createElement('span');
        span.innerHTML = ICON_HEART;
        const svg = span.firstChild;
        if (i >= m.lives) svg.classList.add('off');
        l.appendChild(svg);
      }
    }
  }

  // ---- scoreboard ----
  function scoreboardRows(m, list) {
    return list.sort((a, b) => b.kills - a.kills || b.score - a.score).map(e => `
      <div class="sb-row ${e.isPlayer ? 'you' : ''}">
        <span class="n">${esc(e.name)} ${e.isPlayer ? `<em>${t('hud.you')}</em>` : `<em>${t('hud.ai')}</em>`}</span>
        <span class="v">${e.kills}</span><span class="v">${e.deaths}</span>
        <span class="v">${m.mode === 'moisson' ? e.score : e.kills * 100}</span>
        <span class="v">${e.shots ? Math.round(e.hits / e.shots * 100) + '%' : '—'}</span>
      </div>`).join('');
  }
  function scoreboardHTML(m) {
    const head = `<div class="sb-row head"><span>${t('hud.ffa')}</span><span class="v">${t('hud.kills')}</span><span class="v">${t('hud.deaths')}</span><span class="v">${t('hud.score')}</span><span class="v">${t('hud.acc')}</span></div>`;
    let body;
    if (m.cfg.ffa) body = head + scoreboardRows(m, [...m.entities]);
    else {
      body = `<div class="sb-team a">◢ ${t('hud.teamA')}${m.mode === 'confluence' ? ' — ' + m.scoreA : ''}</div>` + head + scoreboardRows(m, m.entities.filter(e => e.team === 'A')) +
        `<div class="sb-team b">◢ ${t('hud.teamB')}${m.mode === 'confluence' ? ' — ' + m.scoreB : ''}</div>` + head + scoreboardRows(m, m.entities.filter(e => e.team !== 'A'));
    }
    return `<div class="sb-card"><div class="sb-title"><span>${t('play.' + m.mode)}</span><small>${m.cfg.free ? '∞' : fmtTime(m.timeLeft)} · ${t('session.local')}</small></div>${body}</div>`;
  }
  function showScoreboard(v) {
    const sb = document.getElementById('scoreboard');
    if (!sb || !match) return;
    sb.classList.toggle('hidden', !v);
    if (v) sb.innerHTML = scoreboardHTML(match);
  }

  // ---- pause ----
  function setPaused(v, m) {
    const el = document.getElementById('pause');
    if (!el) return;
    document.body.classList.toggle('pause-open', v);
    el.classList.toggle('hidden', !v);
    if (v) {
      el.innerHTML = `
        <div class="pause-card">
          <div class="pause-title">${t('hud.paused')}</div>
          <div class="pause-btns">
            <button class="btn btn-primary" data-action="pause.resume">${t('hud.resume')}</button>
            <button class="btn btn-dark" data-action="pause.controls">${t('hud.controls')}</button>
            <button class="btn ${m.mode === 'training' ? 'btn-ghost' : 'btn-danger'}" data-action="pause.quit">${m.mode === 'training' ? t('hud.finishTraining') : t('hud.quit')}</button>
          </div>
          <div style="margin-top:20px">
            <div class="cfg-row" style="margin-bottom:12px">
              <div class="cfg-label"><span>${t('set.sens')}</span><output data-val-for="settings.sens">${S.settings.sens.toFixed(2)}</output></div>
              <input type="range" min="0.2" max="2" step="0.05" value="${S.settings.sens}" data-bind="settings.sens">
            </div>
            <div class="cfg-row">
              <div class="cfg-label"><span>${t('set.volMaster')}</span><output data-val-for="settings.volMaster">${Math.round(S.settings.volMaster * 100)}%</output></div>
              <input type="range" min="0" max="1" step="0.05" value="${S.settings.volMaster}" data-bind="settings.volMaster">
            </div>
          </div>
        </div>`;
    }
  }

  // ---- fin ----
  function showEnd(m, data) {
    const el = document.getElementById('endscreen');
    if (!el) return;
    document.body.classList.add('pause-open');
    const p = m.player;
    const resultTxt = m.mode === 'training' ? t('hud.session') :
      m.mode === 'survie' ? t('hud.waveReached') + ' ' + m.wave :
      data.result === 'win' ? t('hud.victory') : data.result === 'loss' ? t('hud.defeat') : t('hud.draw');
    const cls = data.result === 'win' ? '' : data.result === 'loss' ? 'loss' : 'neutral';
    const stats = [
      [t('end.kills'), p.kills], [t('end.deaths'), p.deaths],
      m.mode === 'moisson' ? [t('end.shards'), p.score] : m.mode === 'survie' ? [t('end.wave'), m.wave] : [t('end.time'), fmtTime(data.duration)],
      [t('end.acc'), Math.round(data.acc * 100) + '%'],
    ];
    el.innerHTML = `
      <div class="end-card">
        <div class="end-banner">
          <div class="end-result ${cls}">${resultTxt}</div>
          <div class="end-mode">${t('play.' + m.mode)} · ${fmtTime(data.duration)}</div>
        </div>
        <div class="end-stats">${stats.map(([k, v]) => `<div class="stat-cell"><div class="stat-val">${v}</div><div class="stat-key">${k}</div></div>`).join('')}</div>
        <div class="end-xp">
          <div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">${t('hud.xpEarned')}</div>
          ${data.lines.map(([k, v]) => `<div class="xp-line"><span>${k}</span><b>+${v}</b></div>`).join('')}
          <div class="xp-line xp-total"><span>TOTAL</span><b>+${data.xp} XP · +${data.lumen} ◈</b></div>
          ${data.ups.map(l => `<div class="lvlup"><div class="lvl-hex">${l}</div><div class="lvlup-txt"><b>${t('hud.lvlUp')}</b><div>${t('hud.unlocked')} ${t('lvl.' + (l >= 16 ? 'legende' : l >= 12 ? 'aube' : l >= 8 ? 'prisme' : l >= 5 ? 'veteran' : l >= 3 ? 'eclaireur' : 'porteur'))}</div></div></div>`).join('')}
        </div>
        ${scoreboardHTML(m)}
        <div class="end-btns">
          <button class="btn btn-primary btn-big" data-action="end.replay">${t('hud.replay')}</button>
          <button class="btn btn-dark" data-action="end.menu">${t('hud.menu')}</button>
        </div>
      </div>`;
    el.classList.remove('hidden');
  }

  // ---- tactile ----
  function bindTouch() {
    if (!app.touchMode) return;
    const joyZone = document.getElementById('joy-zone');
    const joy = document.getElementById('joy');
    const knob = joy.querySelector('i');
    const look = document.getElementById('look-zone');
    let joyId = null, lookId = null, jx = 0, jy = 0, lx = 0, ly = 0;
    joyZone.onpointerdown = e => {
      joyId = e.pointerId; jx = e.clientX; jy = e.clientY;
      joy.style.display = 'block';
      joy.style.left = (jx - 59) + 'px'; joy.style.top = (jy - 59) + 'px';
      joyZone.setPointerCapture(e.pointerId);
    };
    joyZone.onpointermove = e => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - jx, dy = e.clientY - jy;
      const d = Math.hypot(dx, dy), max = 46;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      app.input.joyX = dx / max; app.input.joyY = dy / max;
      app.input.joySprint = d > max * .92;
    };
    const joyEnd = e => {
      if (e.pointerId !== joyId) return;
      joyId = null; joy.style.display = 'none'; knob.style.transform = '';
      app.input.joyX = 0; app.input.joyY = 0; app.input.joySprint = false;
    };
    joyZone.onpointerup = joyEnd; joyZone.onpointercancel = joyEnd;
    look.onpointerdown = e => { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(e.pointerId); };
    look.onpointermove = e => {
      if (e.pointerId !== lookId) return;
      app.input.mx += (e.clientX - lx) * 2.2;
      app.input.my += (e.clientY - ly) * 2.2;
      lx = e.clientX; ly = e.clientY;
    };
    const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
    look.onpointerup = lookEnd; look.onpointercancel = lookEnd;
    const fire = document.getElementById('tb-fire');
    fire.onpointerdown = e => { e.preventDefault(); app.input.firing = true; app.playerAimingTouch = true; if (match) match.player.aiming = true; };
    fire.onpointerup = fire.onpointercancel = () => { app.input.firing = false; if (match) match.player.aiming = false; };
    document.getElementById('tb-jump').onpointerdown = e => { e.preventDefault(); app.input.jump = true; };
    document.getElementById('tb-reload').onpointerdown = e => {
      e.preventDefault();
      if (match && match.player.ammo < 24 && match.player.reloadT <= 0) { match.player.reloadT = 1.4; audio.play('reload'); }
    };
  }

  function unmount() {
    root.classList.add('hidden');
    root.innerHTML = '';
    document.body.classList.remove('pause-open');
    match = null; mmCtx = null;
  }

  return {
    mount, unmount, update, hitmarker, damageFlash, killfeed, announce, hint, flashScore,
    showRespawn, updateRespawn, hideRespawn, updateWave, showScoreboard, setPaused, showEnd, drawCrosshair,
    get match() { return match; }
  };
}