// ============ ciel : dôme nébuleux, soleil mourant, fragments d'anneau ============
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { glowSprite } from './textures.js';

export function createSky(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // dôme
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float h = clamp(vDir.y, -0.15, 1.0);
        vec3 deep = vec3(0.012, 0.02, 0.045);
        vec3 mid  = vec3(0.03, 0.07, 0.12);
        vec3 horizon = vec3(0.14, 0.09, 0.06);
        vec3 col = mix(horizon, mix(mid, deep, smoothstep(0.08, 0.7, h)), smoothstep(-0.05, 0.16, h));
        // nébuleuse
        vec2 uv = vDir.xz / max(0.25, vDir.y + 0.6) * 1.6;
        float n = noise(uv * 2.0 + uTime * 0.008) * 0.6 + noise(uv * 5.0 - uTime * 0.005) * 0.4;
        float neb = smoothstep(0.45, 0.9, n) * smoothstep(0.0, 0.35, h);
        col += vec3(0.10, 0.05, 0.14) * neb * 1.4;
        col += vec3(0.02, 0.12, 0.16) * smoothstep(0.55, 0.95, noise(uv * 3.0 + 40.0)) * smoothstep(0.05, 0.5, h);
        // bande aurora lente
        float band = sin(vDir.x * 4.0 + uTime * 0.05 + sin(vDir.z * 3.0)) * 0.5 + 0.5;
        col += vec3(0.0, 0.10, 0.09) * band * smoothstep(0.25, 0.55, h) * smoothstep(0.85, 0.5, h) * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), domeMat);
  dome.renderOrder = -10;
  group.add(dome);

  // étoiles
  const rng = mulberry32(42);
  const starN = 1500, sp = new Float32Array(starN * 3), ss = new Float32Array(starN), sc = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const th = rng() * Math.PI * 2, ph = Math.acos(rng() * 1.6 - 0.6);
    const r = 2250;
    sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sp[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * .9 + 40;
    sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    ss[i] = 1 + rng() * 2.6;
    const warm = rng() < .3;
    sc[i * 3] = warm ? 1 : .75; sc[i * 3 + 1] = warm ? .85 : .88; sc[i * 3 + 2] = warm ? .65 : 1;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(ss, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(sc, 3));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; varying float vTw;
      uniform float uTime;
      void main(){ vC=aColor; vTw = 0.65+0.35*sin(uTime*1.5+position.x*0.01);
        vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*2.2; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vC; varying float vTw;
      void main(){ vec2 d=gl_PointCoord-0.5; float a=smoothstep(0.5,0.05,length(d)); gl_FragColor=vec4(vC*vTw,a);}`
  });
  group.add(new THREE.Points(starGeo, starMat));

  // soleil mourant
  const sunDir = new THREE.Vector3(-0.42, 0.22, -0.88).normalize();
  const sunPos = sunDir.clone().multiplyScalar(2150);
  const sunMat = new THREE.ShaderMaterial({
    fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=position;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform float uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float limb = pow(max(0.0, vN.z), 0.55);
        vec2 uv = vP.xy * 0.012;
        float n = noise(uv + uTime*0.02)*0.5 + noise(uv*3.0 - uTime*0.015)*0.5;
        vec3 core = vec3(1.0, 0.82, 0.5);
        vec3 edge = vec3(1.0, 0.35, 0.15);
        vec3 col = mix(edge, core, limb) * (1.1 + n*0.5);
        col += vec3(1.0,0.5,0.2) * smoothstep(0.6,0.95,n) * 0.8;
        gl_FragColor = vec4(col*2.2, 1.0);
      }`
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(230, 48, 32), sunMat);
  sun.position.copy(sunPos);
  group.add(sun);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite('#ff9a3d'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .85
  }));
  glow.scale.setScalar(1350); glow.position.copy(sunPos);
  group.add(glow);

  // lune cyan
  const moon = new THREE.Mesh(new THREE.SphereGeometry(46, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x9fd8e8, fog: false }));
  moon.position.set(1400, 700, 900);
  group.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#38e1ff'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .3 }));
  moonGlow.scale.setScalar(260); moonGlow.position.copy(moon.position);
  group.add(moonGlow);

  // fragments de l'anneau brisé (silhouettes instanciées)
  const fragGeo = new THREE.BoxGeometry(1, 1, 1);
  const fragMat = new THREE.MeshBasicMaterial({ color: 0x131f2c, fog: false });
  const fragN = 110;
  const frags = new THREE.InstancedMesh(fragGeo, fragMat, fragN);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xff9a3d, fog: false });
  const strips = new THREE.InstancedMesh(fragGeo, stripMat, fragN);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const rng2 = mulberry32(99);
  const fragGroup = new THREE.Group();
  for (let i = 0; i < fragN; i++) {
    const arc = i < fragN * .6 ? 0 : 1;
    const a = (arc ? 1.9 : -0.5) + (i / fragN) * 2.6 + rng2() * .1;
    const r = 1250 + rng2() * 550 + arc * 350;
    const y = 180 + Math.sin(a * 2.2) * 160 + rng2() * 220 + arc * 180;
    pv.set(Math.cos(a) * r, y, Math.sin(a) * r);
    eu.set(rng2() * .8, a + rng2(), rng2() * .5);
    q.setFromEuler(eu);
    sv.set(30 + rng2() * 130, 12 + rng2() * 40, 20 + rng2() * 60);
    m.compose(pv, q, sv); frags.setMatrixAt(i, m);
    sv.set(sv.x * .96, 2.5, sv.z * .3);
    pv.y += 8;
    m.compose(pv, q, sv); strips.setMatrixAt(i, m);
  }
  fragGroup.add(frags); fragGroup.add(strips);
  group.add(fragGroup);

  return {
    sunDir,
    update(t) {
      domeMat.uniforms.uTime.value = t;
      starMat.uniforms.uTime.value = t;
      sunMat.uniforms.uTime.value = t;
      fragGroup.rotation.y = t * 0.0035;
      glow.material.opacity = .8 + Math.sin(t * .4) * .08;
    }
  };
}