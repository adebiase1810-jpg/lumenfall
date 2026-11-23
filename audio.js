// ============ moteur audio 100% synthétisé (Web Audio) ============
import { S } from '../core/store.js';
import { clamp, rand, pick } from '../core/utils.js';

class AudioEngine {
  constructor() {
    this.ready = false; this.ctx = null;
    this.musicMode = null; this.musicTimer = null; this.nextNote = 0; this.beat = 0;
    this.intensity = 0; this.lowhp = false; this.ambNodes = [];
  }
  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000;
      this.master.connect(this.lp); this.lp.connect(c.destination);
      this.busMusic = c.createGain(); this.busSfx = c.createGain(); this.busAmb = c.createGain();
      [this.busMusic, this.busSfx, this.busAmb].forEach(b => b.connect(this.master));
      // buffer de bruit réutilisable
      const len = c.sampleRate * 1.2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ready = true;
      this.apply();
      this.startAmbience();
      if (this.musicMode) { const m = this.musicMode; this.musicMode = null; this.music(m); }
    } catch (e) { console.warn('Audio indisponible', e); }
  }
  apply() {
    if (!this.ready) return;
    const s = S.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.volMaster, t, .05);
    this.busMusic.gain.setTargetAtTime(s.volMusic * .9, t, .05);
    this.busSfx.gain.setTargetAtTime(s.volSfx, t, .05);
    this.busAmb.gain.setTargetAtTime(s.volAmb, t, .1);
  }
  toggleMute() {
    S.settings.muted = !S.settings.muted;
    this.apply();
    return S.settings.muted;
  }
  suspend() { if (this.ready && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ready && this.ctx.state === 'suspended') this.ctx.resume(); }
  setLowHP(on) {
    if (!this.ready || on === this.lowhp) return;
    this.lowhp = on;
    this.lp.frequency.setTargetAtTime(on ? 750 : 20000, this.ctx.currentTime, .25);
  }
  setIntensity(v) { this.intensity = clamp(v, 0, 1); }

  // --- primitives ---
  tone({ f = 440, f2, dur = .15, type = 'sine', vol = .2, bus = 'sfx', at = 0, attack = .004 }) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(bus === 'music' ? this.busMusic : bus === 'amb' ? this.busAmb : this.busSfx);
    o.start(t); o.stop(t + dur + .05);
  }
  noise({ dur = .1, freq = 2000, type = 'highpass', vol = .2, at = 0, q = 1, bus = 'sfx' }) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = freq; flt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    src.connect(flt); flt.connect(g); g.connect(bus === 'music' ? this.busMusic : bus === 'amb' ? this.busAmb : this.busSfx);
    src.start(t); src.stop(t + dur + .05);
  }

  // --- SFX nommés ---
  play(name, opt = {}) {
    if (!this.ready || S.settings.muted) return;
    switch (name) {
      case 'shoot':
        this.tone({ f: 920, f2: 170, dur: .09, type: 'square', vol: .16 });
        this.tone({ f: 240, f2: 60, dur: .1, type: 'sine', vol: .22 });
        this.noise({ dur: .05, freq: 3400, vol: .1 }); break;
      case 'eshoot':
        this.tone({ f: 660, f2: 130, dur: .09, type: 'square', vol: .07 });
        this.noise({ dur: .04, freq: 2600, vol: .05 }); break;
      case 'hit': this.tone({ f: 1250, dur: .045, type: 'triangle', vol: .18 }); break;
      case 'headshot': this.tone({ f: 1750, dur: .05, type: 'triangle', vol: .2 }); this.tone({ f: 2300, dur: .06, at: .03, vol: .12 }); break;
      case 'kill':
        this.tone({ f: 660, dur: .1, type: 'triangle', vol: .22 });
        this.tone({ f: 990, dur: .16, at: .07, type: 'triangle', vol: .2 });
        this.noise({ dur: .18, freq: 5200, vol: .07, at: .05 }); break;
      case 'reload':
        this.noise({ dur: .04, freq: 1600, vol: .14 });
        this.tone({ f: 320, f2: 540, dur: .14, at: .18, type: 'sawtooth', vol: .07 });
        this.noise({ dur: .05, freq: 2200, vol: .16, at: .95 }); break;
      case 'empty': this.tone({ f: 300, dur: .05, type: 'square', vol: .1 }); break;
      case 'jump': this.noise({ dur: .13, freq: 900, type: 'lowpass', vol: .12 }); this.tone({ f: 220, f2: 420, dur: .13, vol: .08 }); break;
      case 'land': this.noise({ dur: .1, freq: 380, type: 'lowpass', vol: clamp(opt.v || .15, .05, .35) }); break;
      case 'pad':
        this.tone({ f: 210, f2: 980, dur: .34, type: 'sawtooth', vol: .14 });
        this.noise({ dur: .3, freq: 1400, type: 'bandpass', vol: .14, q: 2 }); break;
      case 'shard': {
        const scale = [523, 587, 659, 784, 880, 1046, 1175, 1319];
        const f = scale[clamp(opt.combo || 0, 0, scale.length - 1)];
        this.tone({ f, dur: .34, type: 'sine', vol: .2 });
        this.tone({ f: f * 2, dur: .2, at: .02, vol: .07 }); break;
      }
      case 'heal': this.tone({ f: 520, dur: .2, vol: .14 }); this.tone({ f: 780, dur: .28, at: .1, vol: .12 }); break;
      case 'damage': this.noise({ dur: .13, freq: 520, type: 'lowpass', vol: .24 }); this.tone({ f: 150, f2: 70, dur: .14, vol: .2 }); break;
      case 'death': this.tone({ f: 320, f2: 50, dur: .6, type: 'sawtooth', vol: .18 }); this.noise({ dur: .5, freq: 700, type: 'lowpass', vol: .2 }); break;
      case 'respawn': this.tone({ f: 330, f2: 880, dur: .35, type: 'triangle', vol: .16 }); this.noise({ dur: .3, freq: 3000, vol: .06, at: .1 }); break;
      case 'hover': this.tone({ f: 1850, dur: .025, type: 'triangle', vol: .045 }); break;
      case 'click': this.tone({ f: 900, dur: .04, type: 'square', vol: .09 }); this.tone({ f: 1420, dur: .035, at: .025, vol: .07 }); break;
      case 'nav': this.tone({ f: 620, f2: 940, dur: .09, type: 'triangle', vol: .1 }); break;
      case 'notif': this.tone({ f: 740, dur: .14, vol: .13 }); this.tone({ f: 988, dur: .2, at: .1, vol: .12 }); break;
      case 'count': this.tone({ f: 660, dur: .1, type: 'square', vol: .13 }); break;
      case 'go': this.tone({ f: 990, dur: .24, type: 'square', vol: .16 }); this.tone({ f: 1320, dur: .3, at: .04, vol: .12 }); break;
      case 'wave': this.tone({ f: 110, dur: .6, type: 'sawtooth', vol: .2 }); this.tone({ f: 165, dur: .6, at: .05, type: 'sawtooth', vol: .14 }); this.noise({ dur: .5, freq: 900, type: 'lowpass', vol: .1 }); break;
      case 'victory':
        [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone({ f, dur: .5, at: i * .13, type: 'triangle', vol: .18 }));
        this.noise({ dur: .8, freq: 6000, vol: .05, at: .3 }); break;
      case 'defeat':
        [440, 349, 293, 220].forEach((f, i) => this.tone({ f, dur: .55, at: i * .17, type: 'sawtooth', vol: .1 }));
        break;
      case 'levelup':
        [659, 880, 1046, 1319].forEach((f, i) => this.tone({ f, dur: .3, at: i * .08, type: 'triangle', vol: .16 }));
        break;
      case 'buy': this.tone({ f: 784, dur: .12, vol: .15 }); this.tone({ f: 1175, dur: .18, at: .08, vol: .13 }); break;
      case 'error': this.tone({ f: 220, dur: .16, type: 'square', vol: .12 }); this.tone({ f: 180, dur: .2, at: .1, type: 'square', vol: .1 }); break;
      case 'teleport': this.tone({ f: 1200, f2: 240, dur: .3, type: 'sine', vol: .13 }); this.noise({ dur: .25, freq: 4200, vol: .07 }); break;
    }
  }

  // --- ambiance persistante ---
  startAmbience() {
    if (!this.ready || this.ambNodes.length) return;
    const c = this.ctx;
    const wind = c.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 320;
    const wg = c.createGain(); wg.gain.value = .05;
    wind.connect(wf); wf.connect(wg); wg.connect(this.busAmb); wind.start();
    const hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 52;
    const hg = c.createGain(); hg.gain.value = .035;
    hum.connect(hg); hg.connect(this.busAmb); hum.start();
    const lfo = c.createOscillator(); lfo.frequency.value = .07;
    const lg = c.createGain(); lg.gain.value = 90;
    lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    this.ambNodes = [wind, hum, lfo];
  }

  // --- musique générative ---
  music(mode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    clearInterval(this.musicTimer); this.musicTimer = null;
    if (!mode || !this.ready) return;
    this.nextNote = this.ctx.currentTime + .1; this.beat = 0;
    this.musicTimer = setInterval(() => this.schedule(), 180);
  }
  schedule() {
    if (!this.ready || !this.musicMode || this.ctx.state !== 'running') return;
    const game = this.musicMode === 'game';
    const bpm = game ? 112 : 66, spb = 60 / bpm;
    while (this.nextNote < this.ctx.currentTime + .35) {
      const at = this.nextNote - this.ctx.currentTime;
      const b = this.beat;
      // accords : Am → F → C → G (une mesure de 8 croches par accord)
      const chords = [[220, 261.6, 329.6, 440], [174.6, 220, 261.6, 349.2], [196, 261.6, 329.6, 392], [164.8, 196, 246.9, 329.6]];
      const chord = chords[Math.floor(b / 8) % 4];
      if (b % 8 === 0) {
        chord.forEach((f, i) => {
          this.tone({ f: f / 2, dur: spb * 8.5, type: 'sawtooth', vol: .028, bus: 'music', at, attack: spb * 1.5 });
          this.tone({ f: f / 2 * 1.006, dur: spb * 8.5, type: 'sawtooth', vol: .022, bus: 'music', at, attack: spb * 2 });
        });
        this.tone({ f: chord[0] / 4, dur: spb * 8, type: 'sine', vol: .09, bus: 'music', at, attack: .3 });
      }
      if (game) {
        // pulsation rythmique
        if (b % 2 === 0) this.tone({ f: 130, f2: 42, dur: .12, type: 'sine', vol: .16, bus: 'music', at });
        if (b % 2 === 1) this.noise({ dur: .03, freq: 8200, vol: .035 + this.intensity * .04, bus: 'music', at });
        const seq = [chord[0] / 2, chord[0] / 2, chord[2] / 2, chord[1] / 2];
        this.tone({ f: seq[b % 4], dur: spb * .48, type: 'sawtooth', vol: .05 + this.intensity * .03, bus: 'music', at });
        if (this.intensity > .4 && b % 4 === 2) this.tone({ f: chord[3], dur: spb * .4, type: 'square', vol: .025, bus: 'music', at });
      } else if (b % 3 === 0 && Math.random() < .6) {
        // arpèges épars au menu
        this.tone({ f: pick(chord) * 2, dur: spb * 1.6, type: 'triangle', vol: .05, bus: 'music', at });
      }
      this.nextNote += spb / 2; this.beat++;
    }
  }
}
export const audio = new AudioEngine();