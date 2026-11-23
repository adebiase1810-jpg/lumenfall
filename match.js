// ============ match : modes, règles, projectiles, score, flux ============
import * as THREE from 'three';
import { S, addXP, addLumen, bumpStat, recordMatch, challengeTick, ensureChallenge, echoById } from '../core/store.js';
import { audio } from '../audio/audio.js';
import { clamp, damp, rand, pick, randi, segSphere, rayBox, fmtTime } from '../core/utils.js';
import { createCharacter } from './character.js';
import { createBrain } from './ai.js';
import { makeEntity, stepPhysics, raycastWorld, losClear } from './entities.js';
import { t } from '../core/strings.js';

const MODES = {
  confluence: { bots: 7, score: 30, time: 6, team: true },
  moisson: { bots: 5, score: 30, time: 5, ffa: true },
  survie: { bots: 0, lives: 3, team: true, waves: true },
  training: { bots: 4, free: true },
};
export const modeDefaults = m => ({ ...MODES[m] });

const BOT_NAMES = ['Axiome', 'Velléité', 'Onde-9', 'Sillage', 'Brèche', 'Halo-2', 'Ferrite', 'Prisme-4', 'Lueur', 'Statique', 'Écho-X', 'Cortex'];

export class Match {
  constructor(app, config) {
    this.app = app;
    this.cfg = { ...modeDefaults(config.mode), ...config };
    this.mode = config.mode;
    this.world = app.world;
    this.entities = [];
    this.bolts = [];
    this.shards = [];
    this.player = null;
    this.time = 0;
    this.timeLeft = (this.cfg.time || 0) * 60;
    this.state = 'countdown'; // countdown | live | ended
    this.countT = 3.6;
    this.paused = false;
    this.scoreA = 0; this.scoreB = 0;
    this.wave = 0; this.lives = this.cfg.lives || 3;
    this.waveQueue = 0; this.waveSpawnT = 0; this.intermission = 0;
    this.streak = 0; this.lastKillT = -99; this.streakBonus = 0;
    this.combo = 0; this.comboT = 0;
    this.shardMeshes = [];
    this.intensityT = 0;
    this.tmpV = new THREE.Vector3();
    this.build();
  }

  // ---------- construction ----------
  build() {
    const app = this.app;
    // joueur
    const p = makeEntity(0, 120);
    p.isPlayer = true; p.name = S.profile.name; p.team = this.cfg.ffa ? 'P' : 'A';
    p.rig = createCharacter({ armor: S.custom.armor, energy: S.custom.energy, chassis: S.custom.skin });
    app.scene.add(p.rig.group);
    p.onPad = () => { audio.play('pad'); app.effects.ring(p.x, p.y, p.z, '#38e1ff', 20, 1); };
    this.player = p;
    this.entities.push(p);

    // escouade
    const squad = app.squad.filter(s => s.echo);
    const usedNames = new Set();
    const mkBot = (opts) => {
      const b = makeEntity(opts.x, opts.z);
      b.name = opts.name; b.team = opts.team;
      b.energyColor = opts.energy;
      b.rig = createCharacter({ armor: opts.armor, energy: opts.energy, chassis: opts.chassis });
      app.scene.add(b.rig.group);
      b.onPad = () => app.effects.ring(b.x, b.y, b.z, '#38e1ff', 14, .8);
      b.brain = createBrain(b, this, opts.diff || this.cfg.difficulty || 'veteran', opts.aggr ?? .6);
      b.passive = !!opts.passive;
      b.hpMax = opts.hp || 100;
      b.hp = b.hpMax;
      // barre de vie
      const cv = document.createElement('canvas'); cv.width = 72; cv.height = 12;
      b.hpCanvas = cv; b.hpTex = new THREE.CanvasTexture(cv);
      b.hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: b.hpTex, depthWrite: false, transparent: true }));
      b.hpSprite.scale.set(1.5, .25, 1);
      app.scene.add(b.hpSprite);
      this.drawHP(b);
      this.entities.push(b);
      return b;
    };
    this.mkBot = mkBot;

    const spawnFor = (team, i) => {
      const pts = this.world.spawns.filter(s => this.cfg.ffa || s.team === team);
      const s = pts[i % pts.length];
      return { x: s.x + rand(-4, 4), z: s.z + rand(-4, 4) };
    };
    const botName = () => {
      let n; let guard = 0;
      do { n = pick(BOT_NAMES) + (Math.random() < .4 ? '-' + randi(2, 99) : ''); } while (usedNames.has(n) && ++guard < 20);
      usedNames.add(n); return n;
    };

    if (this.mode === 'confluence') {
      const total = this.cfg.bots + 1;
      const allies = Math.ceil(total / 2) - 1;
      const enemies = this.cfg.bots - allies;
      for (let i = 0; i < allies; i++) {
        const e = squad[i]?.echo;
        const sp = spawnFor('A', i + 1);
        mkBot({
          ...sp, team: 'A', name: e ? e.name : botName(),
          armor: e ? e.armor : '#2a3442', energy: e ? e.energy : '#ffb347',
          chassis: e ? e.chassis : pick(['vanguard', 'spectre']), aggr: e ? e.aggr : .6
        });
      }
      for (let i = 0; i < enemies; i++) {
        const sp = spawnFor('B', i);
        mkBot({ ...sp, team: 'B', name: botName(), armor: '#1d2f3a', energy: '#38e1ff', chassis: pick(['vanguard', 'spectre', 'colosse']), aggr: rand(.5, .9) });
      }
    } else if (this.mode === 'moisson') {
      for (let i = 0; i < this.cfg.bots; i++) {
        const e = squad[i]?.echo;
        const sp = spawnFor(null, i);
        mkBot({
          ...sp, team: 'F' + i, name: e ? e.name : botName(),
          armor: e ? e.armor : '#2c2233', energy: e ? e.energy : '#ff3d7e',
          chassis: e ? e.chassis : pick(['spectre', 'vanguard']), aggr: e ? e.aggr : rand(.5, .9)
        });
      }
      this.spawnShardField(22);
    } else if (this.mode === 'survie') {
      squad.forEach((s, i) => {
        const e = s.echo;
        mkBot({ x: -8 + i * 8, z: 130, team: 'A', name: e.name, armor: e.armor, energy: e.energy, chassis: e.chassis, aggr: e.aggr });
      });
      this.startWave(1);
    } else { // training
      for (let i = 0; i < this.cfg.bots; i++) {
        const a = (i / Math.max(1, this.cfg.bots)) * Math.PI * 2;
        mkBot({
          x: Math.cos(a) * 40, z: 100 + Math.sin(a) * 30, team: 'B', name: 'Cible-' + (i + 1),
          armor: '#26313d', energy: '#3dffa0', chassis: 'vanguard',
          passive: !this.cfg.returnFire, aggr: .4, hp: 100
        });
      }
    }
    // placement joueur
    const ps = this.mode === 'survie' || this.mode === 'training' ? { x: 0, z: 120 } : spawnFor(this.cfg.ffa ? null : 'A', 0);
    p.x = ps.x; p.z = ps.z;
    p.yaw = Math.atan2(-p.x, -p.z);
    this.camYaw = p.yaw; this.camPitch = .12;
    this.app.hud.mount(this);
    this.app.hud.announce(t('play.' + this.mode), t('hud.objective.' + (this.cfg.team ? 'team' : this.cfg.ffa ? 'ffa' : this.cfg.waves ? 'waves' : 'free')), 'cy');
    audio.music('game');
  }

  drawHP(b) {
    const x = b.hpCanvas.getContext('2d');
    x.clearRect(0, 0, 72, 12);
    x.fillStyle = 'rgba(5,10,16,.8)'; x.fillRect(0, 0, 72, 12);
    const pct = clamp(b.hp / b.hpMax, 0, 1);
    x.fillStyle = b.team === 'A' ? '#ffb347' : b.team === 'B' && this.mode === 'training' ? '#3dffa0' : '#ff4d5e';
    x.fillRect(2, 3, 68 * pct, 6);
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.strokeRect(.5, .5, 71, 11);
    b.hpTex.needsUpdate = true;
  }

  enemiesOf(e) {
    if (this.cfg.ffa) return this.entities.filter(o => o !== e);
    return this.entities.filter(o => o.team !== e.team);
  }
  alliesOf(e) { return this.entities.filter(o => o !== e && o.team === e.team); }

  // ---------- éclats ----------
  spawnShardField(n) {
    const geo = this.shardGeo || (this.shardGeo = new THREE.OctahedronGeometry(.38, 0));
    const mat = this.shardMat || (this.shardMat = new THREE.MeshStandardMaterial({ color: 0x4a3510, emissive: 0xffc23d, emissiveIntensity: 2.2, metalness: .3, roughness: .3 }));
    for (let i = 0; i < n; i++) this.addShard();
  }
  addShard(x, z, temp = false) {
    const spot = (x === undefined) ? pick(this.world.shardSpots) : { x, z };
    const mesh = new THREE.Mesh(this.shardGeo || (this.shardGeo = new THREE.OctahedronGeometry(.38, 0)),
      this.shardMat || (this.shardMat = new THREE.MeshStandardMaterial({ color: 0x4a3510, emissive: 0xffc23d, emissiveIntensity: 2.2, metalness: .3, roughness: .3 })));
    mesh.position.set(spot.x, 1, spot.z);
    this.app.scene.add(mesh);
    const sh = { x: spot.x, z: spot.z, mesh, active: true, temp, life: temp ? 20 : Infinity, phase: rand(6.28) };
    this.shards.push(sh);
    return sh;
  }
  nearestShard(x, z) {
    let best = null, bd = 1e9;
    for (const sh of this.shards) {
      if (!sh.active) continue;
      const d = (sh.x - x) ** 2 + (sh.z - z) ** 2;
      if (d < bd) { bd = d; best = sh; }
    }
    return best;
  }
  collectShard(e, sh) {
    sh.active = false;
    sh.mesh.removeFromParent();
    e.score++;
    if (e.isPlayer) {
      this.comboT = 2.5; this.combo = Math.min(7, this.combo + 1);
      audio.play('shard', { combo: this.combo });
      this.app.effects.burst(sh.x, 1, sh.z, '#ffc23d', 14, 4, .5, .16);
      this.app.effects.number(sh.x, 1.6, sh.z, '+1 ◈', 'xp');
      bumpStat('shards'); challengeTick('shards');
      this.app.hud.flashScore();
    } else {
      this.app.effects.burst(sh.x, 1, sh.z, '#ffc23d', 6, 3, .4, .12);
    }
    if (!sh.temp) this.addShard();
    if (this.cfg.ffa && e.score >= this.cfg.score) this.end(e.isPlayer ? 'win' : 'loss', e);
  }

  // ---------- vagues ----------
  startWave(n) {
    this.wave = n;
    this.waveQueue = Math.min(3 + n, 12);
    this.waveSpawnT = 0;
    audio.play('wave');
    this.app.hud.announce(t('hud.wave') + ' ' + n, t('hud.waveIncoming'), 'rd');
    this.app.hud.updateWave(this);
  }
  spawnWaveBot() {
    const pts = this.world.spawns;
    const s = pick(pts);
    const diff = this.wave < 3 ? 'recrue' : this.wave < 6 ? 'veteran' : 'elite';
    const b = this.mkBot({
      x: s.x + rand(-5, 5), z: s.z + rand(-5, 5), team: 'B',
      name: 'Hostile-' + randi(10, 99), armor: '#2a1620', energy: '#ff4d5e',
      chassis: pick(['vanguard', 'spectre', 'colosse']), diff, aggr: rand(.6, 1),
      hp: 80 + this.wave * 8
    });
    b.rig.spawn();
    this.app.effects.ring(b.x, 0, b.z, '#ff4d5e', 20, 1);
  }

  // ---------- tir ----------
  fireBolt(owner, ox, oy, oz, dx, dy, dz, dmg, color) {
    if (this.bolts.length >= 90) this.bolts.shift();
    this.bolts.push({ x: ox, y: oy, z: oz, dx, dy, dz, speed: 115, life: 1.5, dmg, owner, color, len: 1.7 });
    owner.shots++;
    if (owner.isPlayer) bumpStat('shots');
  }
  playerFire() {
    const p = this.player;
    if (!p.alive || p.reloadT > 0 || p.fireCool > 0 || this.state !== 'live') return;
    if (p.ammo <= 0) { audio.play('empty'); p.reloadT = 1.4; audio.play('reload'); return; }
    p.fireCool = .125;
    p.ammo--;
    const app = this.app;
    // direction : caméra → point visé, bolt depuis le canon
    const cam = app.camera;
    const dir = this.tmpV.set(0, 0, -1).applyQuaternion(cam.quaternion).clone();
    const hitT = raycastWorld(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 160, this.world.colliders);
    let aimX = cam.position.x + dir.x * hitT, aimY = cam.position.y + dir.y * hitT, aimZ = cam.position.z + dir.z * hitT;
    // assistance tactile
    if (app.touchMode) {
      let best = null, bestAng = .12;
      for (const e of this.enemiesOf(p)) {
        if (!e.alive) continue;
        const tx = e.x - cam.position.x, ty = e.y + 1.2 - cam.position.y, tz = e.z - cam.position.z;
        const d = Math.hypot(tx, ty, tz);
        if (d > 70) continue;
        const dot = (tx * dir.x + ty * dir.y + tz * dir.z) / d;
        const ang = Math.acos(clamp(dot, -1, 1));
        if (ang < bestAng && losClear(p.x, p.y + 1.55, p.z, e.x, e.y + 1.2, e.z, this.world.colliders)) { best = e; bestAng = ang; }
      }
      if (best) {
        aimX = aimX * .35 + best.x * .65; aimY = aimY * .35 + (best.y + 1.2) * .65; aimZ = aimZ * .35 + best.z * .65;
      }
    }
    const muzzle = p.rig.muzzle.getWorldPosition(new THREE.Vector3());
    let dx = aimX - muzzle.x, dy = aimY - muzzle.y, dz = aimZ - muzzle.z;
    const n = Math.hypot(dx, dy, dz) || 1;
    dx /= n; dy /= n; dz /= n;
    const spread = (p.aiming ? .006 : .016) + p.speed01 * .014 + (p.grounded ? 0 : .02);
    dx += rand(-spread, spread); dy += rand(-spread, spread); dz += rand(-spread, spread);
    const nn = Math.hypot(dx, dy, dz);
    this.fireBolt(p, muzzle.x, muzzle.y, muzzle.z, dx / nn, dy / nn, dz / nn, 22, '#ffd9a0');
    p.rig.kick();
    app.effects.muzzle(muzzle.x, muzzle.y, muzzle.z);
    app.effects.shake(S.settings.shake ? .06 : 0);
    this.camPitch = clamp(this.camPitch + .0045, -1.2, 1.35);
    audio.play('shoot');
    if (p.ammo === 0) { p.reloadT = 1.4; audio.play('reload'); }
  }
  botFire(bot, target, spread, dmg) {
    if (bot.passive || !bot.alive) return;
    if (bot.ammo <= 0) return;
    bot.ammo--;
    const muzzle = bot.rig.muzzle.getWorldPosition(new THREE.Vector3());
    let dx = target.x - muzzle.x, dy = (target.y + 1.15) - muzzle.y, dz = target.z - muzzle.z;
    const n = Math.hypot(dx, dy, dz) || 1;
    dx /= n; dy /= n; dz /= n;
    dx += rand(-spread, spread); dy += rand(-spread, spread) * .6; dz += rand(-spread, spread);
    const nn = Math.hypot(dx, dy, dz);
    const color = bot.team === 'A' ? '#ffc880' : this.mode === 'survie' ? '#ff6a7a' : this.cfg.ffa ? '#ff7aa8' : '#7ae8ff';
    this.fireBolt(bot, muzzle.x, muzzle.y, muzzle.z, dx / nn, dy / nn, dz / nn, dmg, color);
    bot.rig.kick();
    const d = Math.hypot(bot.x - this.player.x, bot.z - this.player.z);
    if (d < 70) audio.play('eshoot');
    if (bot.ammo <= 0) bot.reloadT = 1.6;
  }

  // ---------- dégâts / morts ----------
  damage(victim, dmg, attacker, headshot = false) {
    if (!victim.alive || victim.spawnProt > 0 || this.state !== 'live') return;
    if (attacker && attacker !== victim && !this.cfg.ffa && attacker.team === victim.team) return;
    victim.lastHit = this.time;
    let remaining = dmg;
    if (victim.shield > 0) {
      const absorbed = Math.min(victim.shield, remaining);
      victim.shield -= absorbed; remaining -= absorbed;
    }
    victim.hp -= remaining;
    victim.rig.flash();
    if (attacker?.isPlayer) {
      attacker.hits++; bumpStat('hits');
      this.app.hud.hitmarker(false);
      audio.play(headshot ? 'headshot' : 'hit');
      if (S.settings.dmgNums) this.app.effects.number(victim.x, victim.y + 2, victim.z, Math.round(dmg), headshot ? 'crit' : '');
    }
    if (victim.isPlayer) {
      audio.play('damage');
      this.app.effects.shake(S.settings.shake ? .22 : 0);
      this.app.hud.damageFlash(attacker);
      audio.setLowHP(victim.hp < 30 && victim.hp > 0);
    } else {
      this.drawHP(victim);
    }
    this.app.effects.burst(victim.x, victim.y + 1.3, victim.z, headshot ? '#ffc23d' : '#ff8a5e', 6, 4, .35, .12);
    if (victim.hp <= 0) this.kill(victim, attacker);
  }
  kill(victim, attacker) {
    victim.alive = false;
    victim.deaths++;
    victim.rig.die();
    victim.hpSprite.visible = false;
    this.app.effects.burst(victim.x, victim.y + 1, victim.z, victim.energyColor || S.custom.energy, 30, 7, .8, .2);
    this.app.effects.ring(victim.x, victim.y, victim.z, '#ff4d5e', 24, 1.4);
    if (attacker && attacker !== victim) {
      attacker.kills++;
      if (!this.cfg.ffa && !this.cfg.waves) {
        if (attacker.team === 'A') this.scoreA++; else this.scoreB++;
      }
    }
    this.app.hud.killfeed(attacker, victim);
    if (this.mode === 'moisson') {
      for (let i = 0; i < 3; i++) this.addShard(victim.x + rand(-2.5, 2.5), victim.z + rand(-2.5, 2.5), true);
    }
    if (attacker?.isPlayer) {
      audio.play('kill');
      this.app.hud.hitmarker(true);
      bumpStat('kills'); challengeTick('kills');
      this.streak++;
      this.app.effects.number(victim.x, victim.y + 2.2, victim.z, '+100 XP', 'xp');
      if (this.time - this.lastKillT < 3.5) {
        this.streakBonus += 50;
        this.app.hud.announce(t('hud.double'), '', '');
      }
      this.lastKillT = this.time;
      if (this.streak === 3) this.app.hud.announce(t('hud.streak') + ' ×3', '', '');
      if (this.streak === 5) { this.app.hud.announce(t('hud.rage'), '', ''); this.streakBonus += 100; }
      if (this.streak === 8) { this.app.hud.announce(t('hud.legend'), '', ''); this.streakBonus += 200; }
      audio.setIntensity(1);
    }
    if (victim.isPlayer) {
      audio.play('death'); audio.setLowHP(false);
      this.streak = 0;
      bumpStat('deaths');
      if (this.mode === 'survie') {
        this.lives--;
        this.app.hud.updateWave(this);
        if (this.lives <= 0) { this.end('loss', attacker, true); return; }
      }
      victim.respawnT = 3;
      this.app.hud.showRespawn(attacker);
    } else {
      victim.respawnT = this.mode === 'training' ? 2 : this.mode === 'survie' ? Infinity : 3.5;
    }
    // fin d'équipe
    if (this.mode === 'confluence') {
      if (this.scoreA >= this.cfg.score) this.end('win');
      else if (this.scoreB >= this.cfg.score) this.end('loss');
    }
  }
  respawn(e) {
    const pts = this.world.spawns.filter(s => this.cfg.ffa || this.cfg.waves || s.team === e.team || this.mode === 'training');
    // choisir loin des ennemis
    let best = null, bestScore = -1;
    for (let k = 0; k < 3; k++) {
      const s = pick(pts.length ? pts : this.world.spawns);
      let minD = 1e9;
      for (const o of this.enemiesOf(e)) if (o.alive) minD = Math.min(minD, Math.hypot(o.x - s.x, o.z - s.z));
      if (minD > bestScore) { bestScore = minD; best = s; }
    }
    e.x = best.x + rand(-3, 3); e.z = best.z + rand(-3, 3); e.y = 0;
    e.vx = e.vy = e.vz = 0;
    e.hp = e.hpMax || 100; e.shield = 50; e.alive = true;
    e.ammo = 24; e.reloadT = 0; e.spawnProt = 2;
    e.rig.group.visible = true;
    e.rig.group.rotation.set(0, e.yaw, 0);
    e.rig.group.scale.setScalar(1);
    e.rig.spawn();
    if (e.hpSprite) { e.hpSprite.visible = true; this.drawHP(e); }
    this.app.effects.ring(e.x, 0, e.z, e.isPlayer ? S.custom.energy : (e.energyColor || '#38e1ff'), 26, 1.2);
    if (e.isPlayer) {
      audio.play('respawn');
      this.app.hud.hideRespawn();
      this.camYaw = Math.atan2(-e.x, -e.z);
    }
  }

  // ---------- boucle ----------
  update(dt) {
    if (this.paused || this.state === 'ended') return;
    const app = this.app, p = this.player;
    this.time += dt;
    bumpPlaytime(dt);

    if (this.state === 'countdown') {
      const prev = Math.ceil(this.countT);
      this.countT -= dt;
      const cur = Math.ceil(this.countT);
      if (cur !== prev && cur > 0) { audio.play('count'); app.hud.announce(String(cur), '', 'cy'); }
      if (this.countT <= 0) { this.state = 'live'; audio.play('go'); app.hud.announce(t('hud.countGO'), '', ''); }
      app.hud.update(this, dt);
      this.updateCamera(dt);
      this.syncRigs(dt);
      return;
    }

    // chrono
    if (!this.cfg.free && !this.cfg.waves) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        if (this.mode === 'confluence') this.end(this.scoreA > this.scoreB ? 'win' : this.scoreA < this.scoreB ? 'loss' : 'draw');
        else {
          const best = Math.max(...this.entities.filter(e => !e.isPlayer).map(e => e.score), 0);
          this.end(p.score > best ? 'win' : p.score < best ? 'loss' : 'draw');
        }
        return;
      }
    }
    // vagues
    if (this.cfg.waves) {
      const alive = this.entities.filter(e => e.team === 'B' && e.alive).length;
      if (this.waveQueue > 0) {
        this.waveSpawnT -= dt;
        if (this.waveSpawnT <= 0 && alive < 8) { this.waveSpawnT = .8; this.waveQueue--; this.spawnWaveBot(); }
      } else if (alive === 0 && this.intermission <= 0) {
        this.intermission = 5;
        audio.play('victory');
        challengeTick('wave');
        app.hud.announce(t('hud.waveClear'), '+200 XP', 'cy');
        this.waveXp = (this.waveXp || 0) + 200;
        // réanimer l'escouade
        this.entities.forEach(e => { if (e.team === 'A' && !e.isPlayer && !e.alive) { e.respawnT = .5; } });
        p.hp = Math.min(100, p.hp + 40); p.shield = 50;
      }
      if (this.intermission > 0) {
        this.intermission -= dt;
        if (this.intermission <= 0) this.startWave(this.wave + 1);
      }
    }
    // combo éclats
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // entrées joueur
    this.updatePlayer(dt);
    // bots
    for (const e of this.entities) {
      if (e.isPlayer) continue;
      if (e.alive) {
        if (!e.passive || this.mode === 'training') e.brain.update(dt);
        else { e.vx = damp(e.vx, 0, 6, dt); e.vz = damp(e.vz, 0, 6, dt); e.speed01 = 0; }
        stepPhysics(e, dt, this.world);
        this.regen(e, dt);
        this.pickups(e);
      } else if (e.respawnT !== Infinity) {
        e.respawnT -= dt;
        if (e.respawnT <= 0) this.respawn(e);
      }
    }
    // joueur physique
    if (p.alive) {
      stepPhysics(p, dt, this.world);
      this.regen(p, dt);
      this.pickups(p);
      if (p.fireCool > 0) p.fireCool -= dt;
      if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.ammo = 24; } }
      if (app.input.firing) this.playerFire();
    } else {
      p.respawnT -= dt;
      app.hud.updateRespawn(p.respawnT);
      if (p.respawnT <= 0) this.respawn(p);
    }
    // projectiles
    this.updateBolts(dt);
    // éclats
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      if (!sh.active) { this.shards.splice(i, 1); continue; }
      sh.life -= dt;
      if (sh.life <= 0) { sh.active = false; sh.mesh.removeFromParent(); this.shards.splice(i, 1); continue; }
      sh.mesh.position.y = 1 + Math.sin(this.time * 2 + sh.phase) * .22;
      sh.mesh.rotation.y = this.time * 1.6 + sh.phase;
    }
    // rigs + hp sprites
    this.syncRigs(dt);
    // caméra + HUD
    this.updateCamera(dt);
    app.effects.syncBolts(this.bolts);
    app.hud.update(this, dt);
    // intensité musicale
    this.intensityT -= dt;
    if (this.intensityT <= 0) { this.intensityT = .5; audio.setIntensity(Math.max(0, audio.intensity - .15)); }
  }

  regen(e, dt) {
    if (this.time - e.lastHit > 4.5 && e.shield < 50) e.shield = Math.min(50, e.shield + 14 * dt);
  }
  pickups(e) {
    if (this.mode === 'moisson') {
      for (const sh of this.shards) {
        if (!sh.active) continue;
        const dx = sh.x - e.x, dz = sh.z - e.z;
        if (dx * dx + dz * dz < 2.4 && e.y < 2.5) this.collectShard(e, sh);
      }
    }
    for (const hp of this.world.healthPads) {
      if (hp.cool > 0) continue;
      const dx = hp.x - e.x, dz = hp.z - e.z;
      if (dx * dx + dz * dz < 4 && e.hp < (e.hpMax || 100) - 5 && e.y < 1.5) {
        e.hp = Math.min(e.hpMax || 100, e.hp + 45);
        hp.cool = 15;
        if (e.isPlayer) { audio.play('heal'); this.app.effects.number(e.x, e.y + 2.2, e.z, '+45', 'heal'); audio.setLowHP(false); }
        else this.drawHP(e);
        this.app.effects.ring(hp.x, 0, hp.z, '#3dffa0', 20, 1.2);
      }
    }
  }

  updatePlayer(dt) {
    const p = this.player, app = this.app, inp = app.input;
    if (!p.alive) { inp.firing = false; return; }
    // orientation caméra
    const sens = S.settings.sens * .0023;
    this.camYaw -= inp.mx * sens;
    this.camPitch += inp.my * sens * (S.settings.invertY ? 1 : -1);
    this.camPitch = clamp(this.camPitch, -1.15, 1.3);
    inp.mx = 0; inp.my = 0;
    // déplacement
    let ix = 0, iz = 0;
    if (inp.keys.has('KeyW')) iz -= 1;
    if (inp.keys.has('KeyS')) iz += 1;
    if (inp.keys.has('KeyA')) ix -= 1;
    if (inp.keys.has('KeyD')) ix += 1;
    ix += inp.joyX; iz += inp.joyY;
    const il = Math.hypot(ix, iz);
    if (il > 1) { ix /= il; iz /= il; }
    const sprint = (inp.keys.has('ShiftLeft') || S.settings.autoSprint || inp.joySprint) && iz < -.1 && !p.aiming;
    const speed = p.aiming ? 5 : sprint ? 10.4 : 7.4;
    const s = Math.sin(this.camYaw), c = Math.cos(this.camYaw);
    const wx = (ix * c - iz * s) * speed;
    const wz = (-ix * s - iz * c) * -speed;
    const accel = p.grounded ? 12 : 4;
    p.vx = damp(p.vx, wx, accel, dt);
    p.vz = damp(p.vz, wz, accel, dt);
    p.speed01 = clamp(Math.hypot(p.vx, p.vz) / 10.4, 0, 1);
    if (inp.jump && p.grounded) { p.vy = 9.4; p.grounded = false; audio.play('jump'); inp.jump = false; }
    inp.jump = false;
    const wasGrounded = p.grounded;
    p.onPadLand = null;
    // orientation du personnage
    const moving = Math.hypot(p.vx, p.vz) > .8;
    const faceYaw = (p.aiming || inp.firing || this.time - (p.lastShot || 0) < .4)
      ? this.camYaw : moving ? Math.atan2(p.vx, p.vz) : p.yaw;
    p.yaw = p.yaw + (((faceYaw - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 12);
    p.aimPitch = -this.camPitch * .8;
    if (!wasGrounded && p.grounded) audio.play('land', { v: .12 });
  }

  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) { this.bolts.splice(i, 1); continue; }
      const step = b.speed * dt;
      // monde
      const tWorld = raycastWorld(b.x, b.y, b.z, b.dx, b.dy, b.dz, step, this.world.colliders);
      let tHit = tWorld, victim = null, head = false;
      for (const e of this.entities) {
        if (!e.alive || e === b.owner || e.spawnProt > 0) continue;
        if (!this.cfg.ffa && e.team === b.owner.team) continue;
        const th = segSphere(b.x, b.y, b.z, b.dx, b.dy, b.dz, step, e.x, e.y + 1.66, e.z, .26);
        const tb = segSphere(b.x, b.y, b.z, b.dx, b.dy, b.dz, step, e.x, e.y + 1.05, e.z, .48);
        const t = Math.min(th, tb);
        if (t < tHit) { tHit = t; victim = e; head = th < tb; }
      }
      if (victim) {
        this.damage(victim, b.dmg * (head ? 1.6 : 1), b.owner, head);
        this.bolts.splice(i, 1);
        continue;
      }
      if (tWorld < step) {
        this.app.effects.burst(b.x + b.dx * tWorld, b.y + b.dy * tWorld, b.z + b.dz * tWorld, b.color, 5, 3, .3, .1);
        this.bolts.splice(i, 1);
        continue;
      }
      b.x += b.dx * step; b.y += b.dy * step; b.z += b.dz * step;
    }
  }

  syncRigs(dt) {
    const t = this.time;
    for (const e of this.entities) {
      const g = e.rig.group;
      g.position.set(e.x, e.y, e.z);
      if (e.alive || e.respawnT > 0) g.rotation.y = e.yaw;
      e.rig.animate({
        speed01: e.speed01, aim: e.aiming || (e.isPlayer && this.app.input.firing),
        aimPitch: e.isPlayer ? -this.camPitch * .8 : e.aimPitch,
        grounded: e.grounded, baseY: e.y, protected: e.spawnProt > 0
      }, t + e.x * .1, dt);
      if (!e.alive) { g.position.y = e.y; }
      if (e.hpSprite) {
        e.hpSprite.position.set(e.x, e.y + 2.25, e.z);
        const d = Math.hypot(e.x - this.player.x, e.z - this.player.z);
        e.hpSprite.visible = e.alive && d < 65 && !e.isPlayer;
      }
    }
  }

  updateCamera(dt) {
    const app = this.app, p = this.player, cam = app.camera;
    const aiming = p.aiming;
    const dist = aiming ? 2.1 : 4.3;
    const shoulder = aiming ? .55 : .85;
    const pivotX = p.x, pivotY = p.y + 1.62, pivotZ = p.z;
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const fx = -Math.sin(this.camYaw) * cp, fy = sp, fz = -Math.cos(this.camYaw) * cp;
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    let idealX = pivotX - fx * dist + rx * shoulder;
    let idealY = pivotY - fy * dist + .15;
    let idealZ = pivotZ - fz * dist + rz * shoulder;
    // collision caméra
    let dx = idealX - pivotX, dy = idealY - pivotY, dz = idealZ - pivotZ;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    const t = raycastWorld(pivotX, pivotY, pivotZ, dx, dy, dz, len, this.world.colliders);
    const k = Math.min(len, Math.max(.4, t - .25));
    cam.position.set(pivotX + dx * k, Math.max(.3, pivotY + dy * k), pivotZ + dz * k);
    const lookX = pivotX + fx * 12 + rx * shoulder * .6;
    const lookY = pivotY + fy * 12;
    const lookZ = pivotZ + fz * 12 + rz * shoulder * .6;
    cam.lookAt(lookX, lookY, lookZ);
    // shake
    const sh = app.effects.shakeValue;
    if (sh > 0) {
      cam.position.x += rand(-1, 1) * sh * .12;
      cam.position.y += rand(-1, 1) * sh * .12;
    }
    // FOV
    const targetFov = aiming ? S.settings.fov * .72 : S.settings.fov + p.speed01 * 4;
    cam.fov = damp(cam.fov, targetFov, 10, dt);
    cam.updateProjectionMatrix();
  }

  // ---------- pause / fin ----------
  setPaused(v) {
    this.paused = v;
    if (v) { audio.setIntensity(0); }
    this.app.hud.setPaused(v, this);
  }
  end(result, highlight = null, survieEnd = false) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    audio.setLowHP(false);
    const p = this.player;
    const acc = p.shots > 0 ? p.hits / p.shots : 0;
    const duration = this.time;
    // XP
    const lines = [];
    let xp = 0, lumen = 0;
    if (this.mode === 'training') {
      const tx = Math.min(200, p.kills * 25);
      lines.push([t('xp.training'), tx]); xp += tx; lumen = p.kills * 2;
    } else {
      const kx = p.kills * 100;
      lines.push([t('xp.kills') + ' ×' + p.kills, kx]); xp += kx; lumen += p.kills * 8;
      if (this.mode === 'moisson') { const sx = p.score * 25; lines.push([t('xp.shards') + ' ×' + p.score, sx]); xp += sx; lumen += p.score * 2; }
      if (this.mode === 'survie') { const wx = this.waveXp || 0; if (wx) lines.push([t('xp.waves'), wx]); xp += wx; }
      if (this.streakBonus) { lines.push([t('xp.streak'), this.streakBonus]); xp += this.streakBonus; }
      if (result === 'win') { lines.push([t('xp.win'), 300]); xp += 300; lumen += 50; challengeTick('wins'); }
      else { lines.push([t('xp.play'), 100]); xp += 100; lumen += 15; }
    }
    const ups = addXP(xp);
    addLumen(lumen);
    if (this.mode !== 'training') {
      recordMatch({
        mode: this.mode, result, kills: p.kills, deaths: p.deaths,
        score: this.mode === 'moisson' ? p.score : this.mode === 'survie' ? this.wave : p.kills,
        wave: this.mode === 'survie' ? this.wave : 0,
        acc: Math.round(acc * 100), duration: Math.round(duration), xp
      });
    }
    if (ups.length) audio.play('levelup');
    audio.play(result === 'win' ? 'victory' : result === 'loss' ? 'defeat' : 'go');
    audio.setIntensity(0);
    this.app.hud.showEnd(this, { result, xp, lumen, lines, ups, acc, duration, survieEnd });
    ensureChallenge();
  }

  dispose() {
    for (const e of this.entities) {
      e.rig.dispose();
      if (e.hpSprite) { e.hpSprite.material.map.dispose(); e.hpSprite.material.dispose(); e.hpSprite.removeFromParent(); }
    }
    for (const sh of this.shards) sh.mesh.removeFromParent();
    this.shards.length = 0;
    this.bolts.length = 0;
    this.app.effects.clear();
    this.entities.length = 0;
    audio.setLowHP(false);
  }
}

// temps de jeu réel (accumulé par paliers pour limiter les écritures)
let ptAcc = 0;
function bumpPlaytime(dt) {
  ptAcc += dt;
  if (ptAcc >= 5) { bumpStat('playtime', Math.round(ptAcc)); ptAcc = 0; }
}