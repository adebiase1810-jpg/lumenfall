// ============ LUMENFALL — orchestration, rendu, boucle unique ============
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { S, bus, save, startPresence, ensureChallenge, notif, echoById, presence } from './core/store.js';
import { clamp, damp, rand, nextFrame, uid } from './core/utils.js';
import { t } from './core/strings.js';
import { audio } from './audio/audio.js';
import { createSky } from './world/sky.js';
import { createWorld } from './world/world.js';
import { createCharacter } from './game/character.js';
import { createEffects } from './game/effects.js';
import { Match } from './game/match.js';
import { createHud } from './ui/hud.js';
import { createUI } from './ui/ui.js';
import { createNet } from './net/net.js';

const $ = id => document.getElementById(id);

// ---------- garde WebGL ----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

const app = {
  state: 'boot',
  squad: [],            // [{echo, pending, name, rig}]
  match: null,
  touchMode: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
  input: { keys: new Set(), mx: 0, my: 0, firing: false, jump: false, joyX: 0, joyY: 0, joySprint: false },
  fps: 60,
  squadIds: new Set(),
};
bus.squadIds = app.squadIds;

async function boot() {
  if (!webglOK()) throw new Error('WebGL indisponible sur ce navigateur.');
  const bootFill = $('boot-fill'), bootStatus = $('boot-status'), bootTip = $('boot-tip');
  $('boot-logo').innerHTML = `
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 4 A20 20 0 0 1 43 19" stroke="#38e1ff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
      <path d="M44 27 A20 20 0 0 1 29 43" stroke="#ff3d7e" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
      <path d="M20 44 A20 20 0 0 1 5 25" stroke="#38e1ff" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>
      <path d="M4 19 A20 20 0 0 1 15 6" stroke="#ffb347" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
      <path d="M24 10 L33 34 L24 29.5 L15 34 Z" fill="#ffb347"/>
    </svg>
    <div class="boot-word">LUMENFALL</div><div class="boot-sub">Arènes du Soleil Brisé</div>`;
  const tips = [t('boot.tip1'), t('boot.tip2'), t('boot.tip3')];
  let tipI = 0;
  bootTip.textContent = tips[0];
  const tipTimer = setInterval(() => { tipI = (tipI + 1) % tips.length; bootTip.textContent = tips[tipI]; }, 2600);
  const step = async (pct, key) => { bootFill.style.width = pct + '%'; bootStatus.textContent = t(key); await nextFrame(); await nextFrame(); };

  await step(8, 'boot.1');
  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.useLegacyLights = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('gl').appendChild(renderer.domElement);
  app.renderer = renderer;

  const scene = new THREE.Scene();
  app.scene = scene;
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .1, 3400);
  camera.position.set(0, 120, 260);
  app.camera = camera;

  await step(24, 'boot.2');
  await step(38, 'boot.3');
  app.sky = createSky(scene);

  await step(52, 'boot.4');
  app.world = createWorld(scene, renderer);

  await step(68, 'boot.5');
  app.effects = createEffects(scene, camera, renderer, $('fxlayer'));
  app.hero = createCharacter({ armor: S.custom.armor, energy: S.custom.energy, chassis: S.custom.skin });
  app.hero.group.position.set(0, 1.1, 52);
  app.hero.group.rotation.y = Math.PI;
  scene.add(app.hero.group);
  app.heroSpin = 0; app.heroAutoSpin = true;

  await step(80, 'boot.6');
  // ---------- post-processing ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .7, .55, .82);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: .32 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 d = vUv - 0.5;
        float r2 = dot(d,d);
        vec2 off = d * r2 * 0.015;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - off).b;
        col *= 1.0 - uVig * smoothstep(0.15, 0.75, r2);
        col += (hash(vUv * 913.0 + uTime) - 0.5) * 0.012;
        col = mix(col, col * vec3(1.03, 1.0, 0.97), 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);
  app.composer = composer; app.bloom = bloom; app.grade = grade; app.fxaa = fxaa;

  await step(90, 'boot.7');
  // ---------- systèmes ----------
  app.net = createNet();
  app.hud = createHud(app);
  app.ui = createUI(app);
  ensureChallenge();
  startPresence();
  applySettings();
  bindInput();
  onResize();
  window.addEventListener('resize', onResize);

  await step(100, 'boot.7');
  clearInterval(tipTimer);

  // ---------- intro caméra ----------
  app.state = 'intro';
  document.body.classList.remove('state-boot');
  document.body.classList.add('state-menu');
  if (app.touchMode) document.body.classList.add('touch');
  introT = 0;
  startLoop();
  $('boot').classList.add('fade');
  setTimeout(() => $('boot').classList.add('hidden'), 800);
  setTimeout(() => {
    app.state = 'menu';
    app.ui.mount();
    if (!S.profile.seenWelcome) app.ui.welcome();
    else if (audio.ready) audio.music('menu');
    // premier signal social différé (diégétique)
    if (!S.notifs.length) setTimeout(() => notif('social', 'notif.friendReq', { name: 'Sable' }), 25000);
  }, 2900);
}

// ---------- qualité / paramètres ----------
function applySettings() {
  const s = S.settings;
  const q = s.quality;
  const baseRatio = { low: .75, medium: 1, high: 1.5, ultra: 2 }[q] || 1.5;
  const ratio = clamp(Math.min(devicePixelRatio || 1, baseRatio) * s.resScale, .4, 2);
  app.renderer.setPixelRatio(ratio);
  app.composer.setPixelRatio(ratio);
  onResize();
  app.world.setQuality(q, s.shadows);
  app.effects.setQuality(q);
  app.bloom.enabled = s.bloom && q !== 'low';
  app.bloom.strength = { low: 0, medium: .55, high: .7, ultra: .8 }[q];
  app.grade.enabled = q === 'high' || q === 'ultra';
  app.fxaa.enabled = q === 'high' || q === 'ultra';
  app.useComposer = q !== 'low';
  audio.apply();
  document.body.classList.toggle('fps-on', s.showFps);
  app.hud.drawCrosshair();
}
bus.on('settings', () => applySettings());

function onResize() {
  const w = innerWidth, h = innerHeight;
  app.camera.aspect = w / h;
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(w, h);
  app.composer.setSize(w, h);
  const pr = app.renderer.getPixelRatio();
  app.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  app.effects.onResize();
}

// ---------- caméra menu ----------
const menuCams = {
  home: { target: [1.4, 2.6, 52], dist: 7.5, yaw: Math.PI + .12, pitch: .1 },
  play: { target: [1.2, 2.8, 52], dist: 9, yaw: Math.PI - .3, pitch: .16 },
  squad: { target: [0, 2.4, 55], dist: 13, yaw: Math.PI, pitch: .18 },
  social: { target: [-1, 3.2, 50], dist: 10, yaw: Math.PI + .5, pitch: .22 },
  profile: { target: [1.5, 2.6, 52], dist: 8, yaw: Math.PI - .45, pitch: .12 },
  arsenal: { target: [0, 2.2, 52], dist: 4.6, yaw: Math.PI, pitch: .06 },
  settings: { target: [0, 4, 48], dist: 12, yaw: Math.PI + .7, pitch: .3 },
};
let menuCam = { ...menuCams.home };
let camCur = { yaw: Math.PI + .12, pitch: .1, dist: 7.5, tx: 1.4, ty: 2.6, tz: 52 };
let mouseX = 0, mouseY = 0, introT = 0;
app.setMenuCamera = sec => { menuCam = menuCams[sec] || menuCams.home; app.heroAutoSpin = sec === 'arsenal'; };

window.addEventListener('pointermove', e => {
  mouseX = (e.clientX / innerWidth - .5) * 2;
  mouseY = (e.clientY / innerHeight - .5) * 2;
});
// drag arsenal
let dragging = false, lastDragX = 0;
$('gl').addEventListener('pointerdown', e => {
  if (app.state === 'menu' && app.ui?.section === 'arsenal') { dragging = true; lastDragX = e.clientX; }
});
window.addEventListener('pointermove', e => {
  if (dragging) { app.heroSpin += (e.clientX - lastDragX) * .012; lastDragX = e.clientX; }
});
window.addEventListener('pointerup', () => dragging = false);
$('gl').addEventListener('wheel', e => {
  if (app.state === 'menu' && app.ui?.section === 'arsenal') {
    menuCams.arsenal.dist = clamp(menuCams.arsenal.dist + e.deltaY * .004, 3, 9);
    e.preventDefault();
  }
}, { passive: false });

// ---------- escouade ----------
app.squadInvite = id => {
  const e = echoById(id);
  if (!e) return;
  if (app.squad.length >= 3) { bus.emit('toast', { type: 'warn', title: 'toast.full', msg: 'toast.fullMsg' }); return; }
  if (app.squad.some(s => s.echo?.id === id || (s.pending && s.id === id))) return;
  const st = presence.get(id);
  if (st === 'ingame' || st === 'offline') {
    bus.emit('toast', { type: 'warn', title: 'toast.busy', msg: e.name, raw: true });
    return;
  }
  const slot = { pending: true, id, name: e.name, echo: null, rig: null };
  app.squad.push(slot);
  bus.emit('toast', { type: 'social', title: 'toast.invited', msg: e.name, raw: true });
  bus.emit('squad');
  setTimeout(() => {
    const i = app.squad.indexOf(slot);
    if (i === -1) return;
    slot.pending = false; slot.echo = e;
    presence.set(id, 'squad'); app.squadIds.add(id);
    slot.rig = createCharacter({ armor: e.armor, energy: e.energy, chassis: e.chassis });
    const pos = app.world.pedestalPos[app.squad.indexOf(slot) + 1] || { x: 8, z: 58 };
    slot.rig.group.position.set(pos.x, 1.1, pos.z);
    slot.rig.group.rotation.y = Math.PI;
    slot.rig.spawn();
    app.scene.add(slot.rig.group);
    app.effects.ring(pos.x, 1.1, pos.z, e.energy, 24, 1);
    audio.play('teleport');
    notif('social', 'notif.inviteOk', { name: e.name });
    bus.emit('squad');
  }, rand(1400, 3000));
};
app.squadRemove = id => {
  const i = app.squad.findIndex(s => s.echo?.id === id || s.id === id);
  if (i === -1) return;
  const s = app.squad[i];
  if (s.rig) { app.effects.burst(s.rig.group.position.x, 2, s.rig.group.position.z, s.echo?.energy || '#38e1ff', 20, 5, .6, .16); s.rig.dispose(); }
  app.squad.splice(i, 1);
  app.squadIds.delete(id);
  if (presence.get(id) === 'squad') presence.set(id, 'online');
  // repositionner les rigs restants
  app.squad.forEach((s2, j) => {
    if (s2.rig) {
      const pos = app.world.pedestalPos[j + 1];
      s2.rig.group.position.set(pos.x, 1.1, pos.z);
    }
  });
  bus.emit('squad');
};
app.squadClear = () => { [...app.squad].forEach(s => app.squadRemove(s.echo?.id || s.id)); };
app.squadJoin = id => {
  app.squadClear();
  app.squadInvite(id);
  const e = echoById(id);
  bus.emit('toast', { type: 'social', title: 'toast.joined', msg: e.name, raw: true });
};

// ---------- héros ----------
app.rebuildHero = () => {
  const old = app.hero;
  app.hero = createCharacter({ armor: S.custom.armor, energy: S.custom.energy, chassis: S.custom.skin });
  app.hero.group.position.copy(old.group.position);
  app.hero.group.rotation.y = Math.PI + app.heroSpin;
  app.scene.add(app.hero.group);
  app.effects.ring(0, 1.1, 52, S.custom.energy, 24, 1.1);
  old.dispose();
};
app.updateHeroColors = () => { app.hero.setColors(S.custom.armor, S.custom.energy); app.effects.burst(0, 2.4, 52, S.custom.energy, 10, 3, .5, .14); };

// ---------- match ----------
app.startMatch = config => {
  if (app.match) { app.match.dispose(); app.match = null; }
  app.ui.closeModal();
  S.lastMode = config.mode; save();
  document.body.classList.add('in-match');
  app.state = 'match';
  app.hero.group.visible = false;
  app.squad.forEach(s => { if (s.rig) s.rig.group.visible = false; });
  app.match = new Match(app, config);
  if (!app.touchMode) {
    try { app.renderer.domElement.requestPointerLock(); } catch (e) {}
  }
};
app.pauseMatch = v => {
  if (!app.match || app.match.state === 'ended') return;
  app.match.setPaused(v);
  if (v) { document.exitPointerLock?.(); }
  else if (!app.touchMode) { try { app.renderer.domElement.requestPointerLock(); } catch (e) {} }
};
app.exitMatch = silent => {
  if (app.match) { app.match.dispose(); app.match = null; }
  app.hud.unmount();
  document.body.classList.remove('in-match', 'pause-open');
  document.exitPointerLock?.();
  app.state = 'menu';
  app.hero.group.visible = true;
  app.squad.forEach(s => { if (s.rig) s.rig.group.visible = true; });
  app.camera.fov = 52; app.camera.updateProjectionMatrix();
  audio.music('menu');
  audio.setIntensity(0);
  app.ui.renderTopbar();
  app.ui.show('home');
};

// ---------- entrées ----------
function bindInput() {
  const inp = app.input;
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'KeyM') {
      audio.init(); audio.toggleMute(); save(); app.ui?.renderTopbar();
      return;
    }
    if (app.state === 'match' && app.match) {
      if (e.code === 'Tab') { e.preventDefault(); app.hud.showScoreboard(true); return; }
      if (e.code === 'Escape') {
        if (app.match.state !== 'ended') app.pauseMatch(!app.match.paused);
        return;
      }
      if (app.match.paused) return;
      inp.keys.add(e.code);
      if (e.code === 'Space') { e.preventDefault(); inp.jump = true; }
      if (e.code === 'KeyR' && app.match.player.ammo < 24 && app.match.player.reloadT <= 0 && app.match.player.alive) {
        app.match.player.reloadT = 1.4; audio.play('reload');
      }
    } else if (e.code === 'Escape') {
      app.ui?.closeModal();
    }
  });
  window.addEventListener('keyup', e => {
    inp.keys.delete(e.code);
    if (e.code === 'Tab') app.hud.showScoreboard(false);
  });
  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === app.renderer.domElement && app.match && !app.match.paused) {
      inp.mx += e.movementX; inp.my += e.movementY;
    }
  });
  window.addEventListener('mousedown', e => {
    audio.init();
    if (!audio.musicMode && app.state === 'menu') audio.music('menu');
    if (app.state !== 'match' || !app.match || app.match.paused || app.touchMode) return;
    if (document.pointerLockElement !== app.renderer.domElement) {
      if (app.match.state !== 'ended') { try { app.renderer.domElement.requestPointerLock(); } catch (err) {} }
      return;
    }
    if (e.button === 0) inp.firing = true;
    if (e.button === 2) {
      if (S.settings.aimHold) app.match.player.aiming = true;
      else app.match.player.aiming = !app.match.player.aiming;
    }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) inp.firing = false;
    if (e.button === 2 && S.settings.aimHold && app.match) app.match.player.aiming = false;
  });
  window.addEventListener('contextmenu', e => { if (app.state === 'match') e.preventDefault(); });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== app.renderer.domElement && app.state === 'match' && app.match &&
        app.match.state === 'live' && !app.match.paused && !app.touchMode) {
      app.pauseMatch(true);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      if (app.state === 'match' && app.match && app.match.state === 'live' && !app.match.paused) app.pauseMatch(true);
    } else audio.resume();
  });
  window.addEventListener('beforeunload', () => {
    try { localStorage.setItem('lumenfall.save.v1', JSON.stringify(S)); } catch (e) {}
  });
  window.addEventListener('blur', () => { inp.keys.clear(); inp.firing = false; });
}

// ---------- boucle unique ----------
let last = 0, fpsAcc = 0, fpsN = 0;
function startLoop() {
  const loop = t => {
    requestAnimationFrame(loop);
    const now = t / 1000;
    let dt = Math.min(.05, now - (last || now));
    last = now;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= .5) { app.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

    app.sky.update(now);
    app.world.update(now, dt);

    if (app.state === 'intro') {
      introT += dt;
      const k = clamp(introT / 2.8, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      const from = { x: 40, y: 150, z: 280 }, to = computeMenuCamPos();
      app.camera.position.set(
        from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, from.z + (to.z - from.z) * e);
      app.camera.lookAt(0, 20 - 17 * e, 30 + 22 * e);
      app.hero.animate({ speed01: 0, aim: false, grounded: true, baseY: 1.1 }, now, dt);
    } else if (app.state === 'menu') {
      // caméra orbitale amortie
      const c = menuCam;
      camCur.yaw = damp(camCur.yaw, c.yaw + Math.sin(now * .07) * .1 + mouseX * .06, 3, dt);
      camCur.pitch = damp(camCur.pitch, c.pitch + mouseY * .03, 3, dt);
      camCur.dist = damp(camCur.dist, c.dist, 3, dt);
      camCur.tx = damp(camCur.tx, c.target[0], 3, dt);
      camCur.ty = damp(camCur.ty, c.target[1], 3, dt);
      camCur.tz = damp(camCur.tz, c.target[2], 3, dt);
      const cp = Math.cos(camCur.pitch);
      app.camera.position.set(
        camCur.tx - Math.sin(camCur.yaw) * cp * camCur.dist,
        camCur.ty + Math.sin(camCur.pitch) * camCur.dist,
        camCur.tz - Math.cos(camCur.yaw) * cp * camCur.dist);
      app.camera.lookAt(camCur.tx, camCur.ty, camCur.tz);
      // héros
      if (app.heroAutoSpin && !dragging) app.heroSpin += dt * .25;
      app.hero.group.rotation.y = Math.PI + app.heroSpin;
      app.hero.animate({ speed01: 0, aim: false, grounded: true, baseY: 1.1 }, now, dt);
      app.squad.forEach((s, i) => {
        if (s.rig) s.rig.animate({ speed01: 0, aim: false, grounded: true, baseY: 1.1 }, now + i * 1.7, dt);
      });
    } else if (app.state === 'match' && app.match) {
      app.match.update(dt);
    }

    app.effects.update(dt, now);
    app.grade.uniforms.uTime.value = now;
    if (app.useComposer) app.composer.render();
    else app.renderer.render(app.scene, app.camera);
  };
  requestAnimationFrame(loop);
}
function computeMenuCamPos() {
  const c = menuCams.home;
  const cp = Math.cos(c.pitch);
  return {
    x: c.target[0] - Math.sin(c.yaw) * cp * c.dist,
    y: c.target[1] + Math.sin(c.pitch) * c.dist,
    z: c.target[2] - Math.cos(c.yaw) * cp * c.dist,
  };
}

boot().catch(err => {
  console.error(err);
  $('boot')?.classList.add('hidden');
  $('fatal').classList.remove('hidden');
  $('fatal-msg').textContent = String(err && err.message || err).slice(0, 300);
});