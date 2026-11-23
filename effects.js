// ============ effets : particules pool, bolts instanciés, nombres, shake ============
import * as THREE from 'three';
import { particleSprite } from '../world/textures.js';
import { clamp, rand } from '../core/utils.js';

const MAXP = 1200, MAXB = 96, MAXN = 16;

export function createEffects(scene, camera, renderer, fxLayer) {
  // ---- particules ----
  const pos = new Float32Array(MAXP * 3), col = new Float32Array(MAXP * 3);
  const size = new Float32Array(MAXP), alpha = new Float32Array(MAXP);
  const vel = new Float32Array(MAXP * 3), life = new Float32Array(MAXP), maxLife = new Float32Array(MAXP);
  const grav = new Float32Array(MAXP);
  let cursor = 0, activeMax = 900;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: particleSprite() }, uScale: { value: 600 } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
      varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC=aColor; vA=aAlpha;
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_PointSize = clamp(aSize*uScale/-mv.z, 0.0, 64.0);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vC; varying float vA; uniform sampler2D uTex;
      void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA);}`
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const tmpC = new THREE.Color();

  function burst(x, y, z, color, n = 12, speed = 5, lifeS = .6, sizeS = .18, gravity = -6) {
    tmpC.set(color);
    for (let k = 0; k < n; k++) {
      const i = cursor; cursor = (cursor + 1) % activeMax;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const th = rand(Math.PI * 2), ph = rand(-1, 1);
      const s = speed * rand(.3, 1);
      vel[i * 3] = Math.cos(th) * s; vel[i * 3 + 1] = ph * s * .7 + speed * .25; vel[i * 3 + 2] = Math.sin(th) * s;
      col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
      size[i] = sizeS * rand(.6, 1.5);
      life[i] = maxLife[i] = lifeS * rand(.6, 1.3);
      grav[i] = gravity;
      alpha[i] = 1;
    }
  }
  function ring(x, y, z, color, n = 26, r = 1.2) {
    tmpC.set(color);
    for (let k = 0; k < n; k++) {
      const i = cursor; cursor = (cursor + 1) % activeMax;
      const a = (k / n) * Math.PI * 2;
      pos[i * 3] = x + Math.cos(a) * r * .3; pos[i * 3 + 1] = y + .1; pos[i * 3 + 2] = z + Math.sin(a) * r * .3;
      vel[i * 3] = Math.cos(a) * r * 4; vel[i * 3 + 1] = rand(1, 3); vel[i * 3 + 2] = Math.sin(a) * r * 4;
      col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
      size[i] = .22; life[i] = maxLife[i] = .7; grav[i] = -2; alpha[i] = 1;
    }
  }

  // ---- bolts ----
  const boltGeo = new THREE.BoxGeometry(.07, .07, 1);
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const bolts = new THREE.InstancedMesh(boltGeo, boltMat, MAXB);
  bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bolts.frustumCulled = false;
  scene.add(bolts);
  const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bs = new THREE.Vector3(), bp = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1), bd = new THREE.Vector3(), bc = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAXB; i++) { bolts.setMatrixAt(i, zero); bolts.setColorAt(i, bc.set(0xffffff)); }

  function syncBolts(list) {
    const n = Math.min(list.length, MAXB);
    for (let i = 0; i < n; i++) {
      const b = list[i];
      bd.set(b.dx, b.dy, b.dz);
      bq.setFromUnitVectors(Z, bd);
      bp.set(b.x, b.y, b.z);
      bs.set(1, 1, b.len || 1.6);
      bm.compose(bp, bq, bs);
      bolts.setMatrixAt(i, bm);
      bolts.setColorAt(i, bc.set(b.color));
    }
    for (let i = n; i < MAXB; i++) bolts.setMatrixAt(i, zero);
    bolts.instanceMatrix.needsUpdate = true;
    if (bolts.instanceColor) bolts.instanceColor.needsUpdate = true;
    bolts.count = MAXB;
  }

  // ---- muzzle flash ----
  const muzzleLight = new THREE.PointLight(0xffc880, 0, 14, 2);
  scene.add(muzzleLight);
  let muzzleT = 0;
  function muzzle(x, y, z, color = 0xffc880) {
    muzzleLight.position.set(x, y, z);
    muzzleLight.color.set(color);
    muzzleLight.intensity = 260;
    muzzleT = .06;
    burst(x, y, z, '#ffd9a0', 4, 3, .18, .12, 0);
  }

  // ---- nombres de dégâts (DOM) ----
  const nums = [];
  for (let i = 0; i < MAXN; i++) {
    const el = document.createElement('div');
    el.className = 'dmg-num'; el.style.display = 'none';
    fxLayer.appendChild(el);
    nums.push({ el, active: false, x: 0, y: 0, z: 0, vy: 0, life: 0 });
  }
  const proj = new THREE.Vector3();
  function number(x, y, z, text, cls = '') {
    const n = nums.find(n => !n.active) || nums[0];
    n.active = true; n.x = x + rand(-.3, .3); n.y = y; n.z = z + rand(-.3, .3);
    n.vy = 1.6; n.life = .9;
    n.el.textContent = text;
    n.el.className = 'dmg-num ' + cls;
    n.el.style.display = 'block';
  }

  // ---- shake ----
  let shakeV = 0;
  function shake(amount) { shakeV = Math.min(1.2, shakeV + amount); }

  function update(dt, t) {
    // particules
    for (let i = 0; i < activeMax; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      vel[i * 3 + 1] += grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < .05 && grav[i] < 0) { pos[i * 3 + 1] = .05; vel[i * 3 + 1] *= -.4; }
      alpha[i] = clamp(life[i] / maxLife[i], 0, 1);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    // muzzle
    if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzleLight.intensity = 0; }
    // nombres
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const n of nums) {
      if (!n.active) continue;
      n.life -= dt;
      n.y += n.vy * dt; n.vy *= .94;
      if (n.life <= 0) { n.active = false; n.el.style.display = 'none'; continue; }
      proj.set(n.x, n.y, n.z).project(camera);
      if (proj.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = 'block';
      n.el.style.transform = `translate(${(proj.x * .5 + .5) * w}px, ${(-proj.y * .5 + .5) * h}px) translate(-50%,-50%)`;
      n.el.style.opacity = clamp(n.life / .4, 0, 1);
    }
    shakeV = Math.max(0, shakeV - dt * 3.2);
  }

  return {
    burst, ring, syncBolts, muzzle, number, shake, update,
    get shakeValue() { return shakeV; },
    setQuality(q) {
      activeMax = { low: 250, medium: 550, high: 900, ultra: 1200 }[q] || 900;
      geo.setDrawRange(0, activeMax);
      mat.uniforms.uScale.value = renderer.domElement.height * .8;
    },
    onResize() { mat.uniforms.uScale.value = renderer.domElement.height * .8; },
    clear() {
      life.fill(0); alpha.fill(0);
      nums.forEach(n => { n.active = false; n.el.style.display = 'none'; });
      syncBolts([]);
      shakeV = 0; muzzleLight.intensity = 0;
    }
  };
}