// ============ Porteurs — personnages procéduraux articulés ============
import * as THREE from 'three';
import { clamp, damp, angDamp, TAU } from '../core/utils.js';

const geoCache = new Map();
function G(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const boxG = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sphG = r => G(`s${r}`, () => new THREE.SphereGeometry(r, 10, 8));
const cylG = (r1, r2, h) => G(`c${r1},${r2},${h}`, () => new THREE.CylinderGeometry(r1, r2, h, 8));
const coneG = (r, h) => G(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 8));

const STYLE = {
  vanguard: { bulk: 1, shoulder: .26, hood: false, tanks: false, fins: false },
  spectre: { bulk: .82, shoulder: .18, hood: true, tanks: false, fins: false },
  colosse: { bulk: 1.28, shoulder: .34, hood: false, tanks: true, fins: false },
  aube: { bulk: .95, shoulder: .22, hood: false, tanks: false, fins: true },
};

export function createCharacter({ armor = '#22303f', energy = '#ffb347', chassis = 'vanguard' } = {}) {
  const st = STYLE[chassis] || STYLE.vanguard;
  const b = st.bulk;
  const mats = {
    body: new THREE.MeshStandardMaterial({ color: armor, metalness: .72, roughness: .38, envMapIntensity: .9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x10161f, metalness: .6, roughness: .5 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0c1218, emissive: energy, emissiveIntensity: 1.7, metalness: .3, roughness: .35 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x05080c, emissive: energy, emissiveIntensity: 2.6, metalness: .2, roughness: .2 }),
  };
  const group = new THREE.Group();
  const mesh = (geo, mat, parent, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true;
    parent.add(m); return m;
  };

  // hiérarchie
  const hips = new THREE.Group(); hips.position.y = .98; group.add(hips);
  mesh(boxG(.34 * b, .2, .22 * b), mats.dark, hips, 0, 0, 0);
  const torso = new THREE.Group(); torso.position.y = .12; hips.add(torso);
  mesh(boxG(.46 * b, .5, .28 * b), mats.body, torso, 0, .3, 0);
  mesh(boxG(.48 * b, .14, .3 * b), mats.trim, torso, 0, .48, 0);           // plastron lumineux
  mesh(boxG(.3 * b, .08, .3 * b), mats.dark, torso, 0, .05, 0);
  const head = new THREE.Group(); head.position.y = .66; torso.add(head);
  mesh(boxG(.24, .24, .26), mats.body, head, 0, .1, 0);
  mesh(boxG(.2, .07, .05), mats.visor, head, 0, .1, .135);                 // visière
  mesh(cylG(.012, .012, .18), mats.trim, head, .1, .3, -.05);              // antenne
  if (st.hood) {
    const hood = mesh(coneG(.2, .3), mats.dark, head, 0, .24, -.03);
    hood.rotation.x = -.25;
  }
  // dos
  mesh(boxG(.34 * b, .4, .14), mats.dark, torso, 0, .3, -.2 * b);
  if (st.tanks) {
    mesh(cylG(.08, .08, .42), mats.body, torso, -.12, .3, -.3 * b);
    mesh(cylG(.08, .08, .42), mats.body, torso, .12, .3, -.3 * b);
    mesh(cylG(.085, .085, .04), mats.trim, torso, -.12, .52, -.3 * b);
    mesh(cylG(.085, .085, .04), mats.trim, torso, .12, .52, -.3 * b);
  }
  const thrusters = [];
  [-.1, .1].forEach(x => {
    const th = mesh(coneG(.055, .14), mats.trim, torso, x * b, .06, -.24 * b);
    th.rotation.x = Math.PI; thrusters.push(th);
  });
  if (st.fins) {
    [-1, 1].forEach(s => {
      const fin = mesh(boxG(.04, .5, .22), mats.trim, torso, s * .3 * b, .42, -.22 * b);
      fin.rotation.z = s * .5; fin.rotation.y = s * -.3;
    });
  }
  // bras
  const arms = {};
  [-1, 1].forEach(s => {
    const side = s < 0 ? 'L' : 'R';
    const shoulder = new THREE.Group();
    shoulder.position.set(s * (.3 * b + .06), .52, 0); torso.add(shoulder);
    mesh(sphG(st.shoulder * .8), mats.body, shoulder, s * .04, .02, 0);
    mesh(boxG(.12 * b, .3, .13 * b), mats.body, shoulder, s * .03, -.18, 0);
    const fore = new THREE.Group(); fore.position.set(s * .03, -.36, 0); shoulder.add(fore);
    mesh(boxG(.1 * b, .28, .11 * b), mats.dark, fore, 0, -.13, 0);
    mesh(boxG(.11 * b, .05, .12 * b), mats.trim, fore, 0, -.02, 0);
    arms[side] = { shoulder, fore };
  });
  // arme (main droite)
  const gun = new THREE.Group();
  gun.position.set(0, -.3, .06); arms.R.fore.add(gun);
  mesh(boxG(.07, .12, .34), mats.dark, gun, 0, 0, .1);
  mesh(boxG(.05, .05, .4), mats.body, gun, 0, .05, .22);
  const cell = mesh(boxG(.04, .06, .12), mats.visor, gun, 0, .02, .02);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .05, .46); gun.add(muzzle);
  // jambes
  const legs = {};
  [-1, 1].forEach(s => {
    const side = s < 0 ? 'L' : 'R';
    const thigh = new THREE.Group(); thigh.position.set(s * .13 * b, -.08, 0); hips.add(thigh);
    mesh(boxG(.15 * b, .42, .17 * b), mats.body, thigh, 0, -.2, 0);
    const shin = new THREE.Group(); shin.position.y = -.44; thigh.add(shin);
    mesh(boxG(.12 * b, .4, .14 * b), mats.dark, shin, 0, -.18, 0);
    mesh(boxG(.13 * b, .06, .2 * b), mats.trim, shin, 0, -.36, .03);
    mesh(boxG(.14 * b, .08, .24 * b), mats.body, shin, 0, -.42, .05);
    legs[side] = { thigh, shin };
  });

  let phase = Math.random() * TAU;
  let recoil = 0, flashT = 0, deadT = -1, spawnT = -1;
  const baseTrimI = 1.7, baseVisorI = 2.6;

  const rig = {
    group, muzzle, mats, thrusters,
    setColors(a, e) {
      mats.body.color.set(a);
      mats.trim.emissive.set(e);
      mats.visor.emissive.set(e);
    },
    kick() { recoil = 1; },
    flash() { flashT = .12; },
    die() { deadT = 0; },
    spawn() { spawnT = 0; group.visible = true; },
    animate(p, t, dt) {
      // p: {speed01, aim, aimPitch, grounded, vy, moving}
      phase += dt * (4 + p.speed01 * 9);
      const run = p.speed01;
      const swing = Math.sin(phase) * .75 * run;
      if (deadT >= 0) {
        deadT += dt;
        const k = clamp(deadT / .7, 0, 1);
        group.rotation.x = -k * Math.PI / 2 * .9;
        group.position.y = (p.baseY || 0) - k * .3;
        const s = 1 - clamp((deadT - .8) / .6, 0, 1);
        group.scale.setScalar(Math.max(.001, s));
        if (s <= .01) group.visible = false;
        return;
      }
      if (spawnT >= 0) {
        spawnT += dt;
        const k = clamp(spawnT / .5, 0, 1);
        group.scale.setScalar(.2 + .8 * k);
        mats.trim.emissiveIntensity = baseTrimI + (1 - k) * 4;
        if (k >= 1) spawnT = -1;
      }
      group.rotation.x = 0;
      group.position.y = p.baseY || 0;
      // jambes
      legs.L.thigh.rotation.x = swing;
      legs.R.thigh.rotation.x = -swing;
      legs.L.shin.rotation.x = Math.max(0, -swing) * .9 + (p.grounded ? 0 : .5);
      legs.R.shin.rotation.x = Math.max(0, swing) * .9 + (p.grounded ? 0 : .5);
      // torse : respiration + inclinaison course
      torso.rotation.x = run * .16 + Math.sin(t * 1.8) * .02;
      torso.position.y = .12 + Math.abs(Math.sin(phase)) * .045 * run + Math.sin(t * 1.8) * .012;
      hips.rotation.y = Math.sin(phase) * .06 * run;
      // bras
      recoil = damp(recoil, 0, 14, dt);
      if (p.aim) {
        const pitch = clamp(p.aimPitch || 0, -1, 1);
        arms.R.shoulder.rotation.x = -Math.PI / 2 - pitch + recoil * .35;
        arms.R.shoulder.rotation.y = -.12;
        arms.R.fore.rotation.x = -.1 + recoil * .3;
        arms.L.shoulder.rotation.x = -Math.PI / 2.3 - pitch;
        arms.L.shoulder.rotation.y = .55;
        arms.L.fore.rotation.x = -.5;
        head.rotation.x = -pitch * .5;
      } else {
        arms.R.shoulder.rotation.x = -swing * .5 - .15 + recoil * .4;
        arms.R.shoulder.rotation.y = 0;
        arms.R.fore.rotation.x = -.35;
        arms.L.shoulder.rotation.x = swing * .5 - .1;
        arms.L.shoulder.rotation.y = 0;
        arms.L.fore.rotation.x = -.3;
        head.rotation.x = Math.sin(t * .9) * .04;
        head.rotation.y = Math.sin(t * .5) * .1 * (1 - run);
      }
      // thrusters en l'air
      const air = p.grounded ? 0 : 1;
      thrusters.forEach(th => { th.scale.setScalar(1 + air * 1.4); });
      mats.trim.emissiveIntensity = baseTrimI + air * 1.2;
      // flash de dégât
      if (flashT > 0) {
        flashT -= dt;
        mats.visor.emissiveIntensity = baseVisorI + 5;
        mats.body.emissive = mats.body.emissive || new THREE.Color();
        mats.body.emissive.setRGB(1, .3, .3);
        mats.body.emissiveIntensity = .8;
      } else {
        mats.visor.emissiveIntensity = baseVisorI;
        mats.body.emissiveIntensity = 0;
      }
      // protection d'apparition
      if (p.protected) mats.trim.emissiveIntensity = baseTrimI + Math.sin(t * 14) * 1.2 + 1.2;
    },
    dispose() {
      Object.values(mats).forEach(m => m.dispose());
      group.removeFromParent();
    }
  };
  return rig;
}