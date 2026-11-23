// ============ textures procédurales (canvas) ============
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function makeGround() {
  const c = canvas(1024, 1024), x = c.getContext('2d');
  const e = canvas(1024, 1024), ex = e.getContext('2d');
  const rng = mulberry32(77);
  x.fillStyle = '#0d1621'; x.fillRect(0, 0, 1024, 1024);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, 1024, 1024);
  const N = 8, S = 1024 / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const v = 10 + rng() * 9;
    x.fillStyle = `rgb(${v + 4},${v + 11},${v + 19})`;
    x.fillRect(i * S + 2, j * S + 2, S - 4, S - 4);
    // usure
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      const sx = i * S + rng() * S, sy = j * S + rng() * S;
      x.moveTo(sx, sy); x.lineTo(sx + (rng() - .5) * 60, sy + (rng() - .5) * 60); x.stroke();
    }
    if (rng() < .12) { // panneau rayé
      x.save(); x.beginPath(); x.rect(i * S + 6, j * S + 6, S - 12, S - 12); x.clip();
      x.strokeStyle = 'rgba(255,160,60,.13)'; x.lineWidth = 9;
      for (let k = -S; k < S * 2; k += 26) { x.beginPath(); x.moveTo(i * S + k, j * S); x.lineTo(i * S + k + S, j * S + S); x.stroke(); }
      x.restore();
    }
    // coutures lumineuses
    ex.strokeStyle = 'rgba(56,190,230,.5)'; ex.lineWidth = 2;
    ex.strokeRect(i * S + 1, j * S + 1, S - 2, S - 2);
    if (rng() < .1) { ex.fillStyle = 'rgba(255,160,60,.75)'; ex.fillRect(i * S + S * .3, j * S + S * .46, S * .4, 5); }
  }
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(10, 10);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const emissiveMap = new THREE.CanvasTexture(e);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping; emissiveMap.repeat.set(10, 10);
  return { map, emissiveMap };
}

export function makeGlyph(seed = 1, color = '#38e1ff') {
  const c = canvas(256, 512), x = c.getContext('2d');
  const rng = mulberry32(seed * 131 + 7);
  x.fillStyle = '#0a141f'; x.fillRect(0, 0, 256, 512);
  x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 3; x.globalAlpha = .9;
  for (let row = 0; row < 9; row++) {
    const y = 30 + row * 52;
    for (let g = 0; g < 4; g++) {
      const gx = 26 + g * 56, t = rng();
      x.globalAlpha = .35 + rng() * .6;
      if (t < .3) x.strokeRect(gx, y, 34, 34);
      else if (t < .55) { x.beginPath(); x.arc(gx + 17, y + 17, 15, 0, Math.PI * (1 + rng())); x.stroke(); }
      else if (t < .8) { x.beginPath(); x.moveTo(gx, y + 34); x.lineTo(gx + 17, y); x.lineTo(gx + 34, y + 34); x.closePath(); x.stroke(); }
      else { x.fillRect(gx + 4, y + 12, 26, 8); x.fillRect(gx + 12, y + 2, 8, 30); }
    }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBillboard(lines, color = '#ffb347') {
  const c = canvas(512, 256), x = c.getContext('2d');
  x.clearRect(0, 0, 512, 256);
  x.strokeStyle = color; x.lineWidth = 3; x.globalAlpha = .8;
  x.strokeRect(8, 8, 496, 240);
  x.globalAlpha = 1; x.fillStyle = color;
  x.font = '900 52px Orbitron, sans-serif'; x.textAlign = 'center';
  x.fillText(lines[0] || '', 256, 110);
  x.font = '600 26px Rajdhani, sans-serif'; x.globalAlpha = .75;
  x.fillText(lines[1] || '', 256, 160);
  // lignes de scan
  x.globalAlpha = .16;
  for (let y = 0; y < 256; y += 6) x.fillRect(8, y, 496, 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function particleSprite() {
  const c = canvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.35, 'rgba(255,255,255,.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export function glowSprite(color = '#ffb347') {
  const c = canvas(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color); g.addColorStop(.25, color + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- avatar hexagonal ----
export function avatarURL(colors, seed = 1, size = 96) {
  const c = canvas(size, size), x = c.getContext('2d');
  const rng = mulberry32(seed * 97 + 13);
  const a = colors.armor || '#22303f', en = colors.energy || '#ffb347';
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, a); g.addColorStop(1, '#0a121e');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  // éclats de fond
  x.globalAlpha = .22; x.fillStyle = en;
  for (let i = 0; i < 4; i++) {
    x.beginPath();
    const px = rng() * size, py = rng() * size;
    x.moveTo(px, py); x.lineTo(px + 14 + rng() * 20, py + 6); x.lineTo(px + 4, py + 18 + rng() * 16);
    x.closePath(); x.fill();
  }
  x.globalAlpha = 1;
  // casque stylisé
  const cx = size / 2, cy = size * .52, r = size * .3;
  x.fillStyle = '#0d1520';
  x.beginPath();
  x.moveTo(cx - r, cy + r * .9); x.lineTo(cx - r, cy - r * .35);
  x.quadraticCurveTo(cx, cy - r * 1.35, cx + r, cy - r * .35);
  x.lineTo(cx + r, cy + r * .9); x.closePath(); x.fill();
  x.strokeStyle = en; x.lineWidth = size * .03; x.stroke();
  // visière
  x.fillStyle = en; x.shadowColor = en; x.shadowBlur = size * .12;
  x.fillRect(cx - r * .72, cy - r * .18, r * 1.44, r * .3);
  const url = c.toDataURL();
  return url;
}

// ---- bannières ----
export function bannerURL(id, colors) {
  const c = canvas(600, 160), x = c.getContext('2d');
  const en = colors.energy || '#ffb347', ar = colors.armor || '#22303f';
  const bg = x.createLinearGradient(0, 0, 600, 160);
  bg.addColorStop(0, '#0a1220'); bg.addColorStop(1, ar);
  x.fillStyle = bg; x.fillRect(0, 0, 600, 160);
  x.strokeStyle = en; x.fillStyle = en;
  const rng = mulberry32(id.length * 31 + 5);
  if (id === 'aube') {
    x.globalAlpha = .85;
    x.beginPath(); x.arc(300, 190, 90, Math.PI, 0); x.fill();
    x.globalAlpha = .3;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      x.lineWidth = 3; x.beginPath();
      x.moveTo(300 + Math.cos(a) * 100, 190 + Math.sin(a) * 100);
      x.lineTo(300 + Math.cos(a) * (140 + rng() * 60), 190 + Math.sin(a) * (140 + rng() * 60)); x.stroke();
    }
  } else if (id === 'prisme') {
    for (let i = 0; i < 9; i++) {
      x.globalAlpha = .12 + rng() * .5;
      const px = i * 70 - 20, h = 60 + rng() * 90;
      x.beginPath(); x.moveTo(px, 160); x.lineTo(px + 45, 160 - h); x.lineTo(px + 90, 160); x.closePath(); x.fill();
    }
  } else if (id === 'forge') {
    x.globalAlpha = .5; x.lineWidth = 16;
    for (let i = -160; i < 700; i += 56) { x.beginPath(); x.moveTo(i, 170); x.lineTo(i + 120, -10); x.stroke(); }
    x.globalAlpha = .9; x.fillRect(0, 130, 600, 6);
  } else if (id === 'biolume') {
    for (let i = 0; i < 26; i++) {
      x.globalAlpha = .15 + rng() * .6;
      x.beginPath(); x.arc(rng() * 600, rng() * 160, 3 + rng() * 14, 0, 7); x.fill();
    }
  } else if (id === 'orbite') {
    x.globalAlpha = .7; x.lineWidth = 2.5;
    for (let i = 1; i < 7; i++) { x.globalAlpha = .8 - i * .1; x.beginPath(); x.ellipse(300, 80, i * 55, i * 16, -.25, 0, 7); x.stroke(); }
    x.globalAlpha = 1; x.beginPath(); x.arc(300, 80, 12, 0, 7); x.fill();
  } else { // signal
    x.globalAlpha = .85; x.lineWidth = 3; x.beginPath();
    for (let px = 0; px <= 600; px += 4) {
      const y = 80 + Math.sin(px * .05) * 26 * Math.sin(px * .011) + (rng() - .5) * 8;
      px === 0 ? x.moveTo(px, y) : x.lineTo(px, y);
    }
    x.stroke();
  }
  x.globalAlpha = .12;
  for (let y = 0; y < 160; y += 5) x.fillRect(0, y, 600, 1);
  return c.toDataURL();
}