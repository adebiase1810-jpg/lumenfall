// ============ l'Arène Hélios-9 — 400×400 m, quatre districts ============
import * as THREE from 'three';
import { mulberry32, rand, TAU } from '../core/utils.js';
import { makeGround, makeGlyph, makeBillboard, particleSprite } from './textures.js';

const BOUND = 200;

export function createWorld(scene, renderer) {
  const colliders = [];   // {x0,y0,z0,x1,y1,z1}
  const pads = [];        // propulseurs {x,z,r}
  const healthPads = [];  // {x,z,mesh,cool}
  const spawns = [];
  const anchors = [];     // points de patrouille
  const shardSpots = [];
  const group = new THREE.Group();
  scene.add(group);
  const rng = mulberry32(2026);
  const dynamic = [];     // objets animés

  const box = (cx, cy, cz, sx, sy, sz) => colliders.push({ x0: cx - sx / 2, y0: cy - sy / 2, z0: cz - sz / 2, x1: cx + sx / 2, y1: cy + sy / 2, z1: cz + sz / 2 });

  // ---- environnement réfléchi (PMREM baked une fois) ----
  {
    const env = new THREE.Scene();
    const grad = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vP; void main(){ float h=normalize(vP).y*0.5+0.5;
        vec3 c=mix(vec3(0.05,0.03,0.02), mix(vec3(0.04,0.08,0.12), vec3(0.01,0.02,0.05), h), smoothstep(0.0,0.4,h));
        gl_FragColor=vec4(c,1.);}`
    }));
    env.add(grad);
    const panel = (color, i, x, y, z, sx, sy) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      p.material.color.multiplyScalar(i);
      p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p);
    };
    panel(0xffb347, 6, -20, 12, -30, 22, 14);
    panel(0x38e1ff, 3, 25, 8, 20, 18, 10);
    panel(0xff3d7e, 1.4, 0, 25, 28, 12, 8);
    panel(0xffffff, 1.8, 0, 35, 0, 30, 30);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, .04).texture;
    pmrem.dispose();
  }

  // ---- lumières ----
  const hemi = new THREE.HemisphereLight(0x35506b, 0x120d08, .55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.6);
  sun.position.set(140, 190, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 20; sc.far = 520;
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = .25;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.FogExp2(0x0a1420, .0026);

  // ---- sol ----
  const gm = makeGround();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(BOUND * 2, BOUND * 2),
    new THREE.MeshStandardMaterial({ map: gm.map, emissiveMap: gm.emissiveMap, emissive: 0xffffff, emissiveIntensity: .55, metalness: .55, roughness: .5, envMapIntensity: .7 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  // plaza centrale
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(34, 48),
    new THREE.MeshStandardMaterial({ color: 0x18242f, metalness: .8, roughness: .28, envMapIntensity: 1.1 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = .04; plaza.receiveShadow = true;
  group.add(plaza);
  const ringInlay = new THREE.Mesh(new THREE.RingGeometry(30, 31.2, 64),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: .8 }));
  ringInlay.rotation.x = -Math.PI / 2; ringInlay.position.y = .07;
  group.add(ringInlay);
  const ringInlay2 = new THREE.Mesh(new THREE.RingGeometry(22, 22.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: .5 }));
  ringInlay2.rotation.x = -Math.PI / 2; ringInlay2.position.y = .07;
  group.add(ringInlay2);

  // ---- matériaux partagés ----
  const matStructure = new THREE.MeshStandardMaterial({ color: 0x24313f, metalness: .7, roughness: .42, envMapIntensity: .8 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x141d28, metalness: .6, roughness: .55 });
  const matRust = new THREE.MeshStandardMaterial({ color: 0x4a3527, metalness: .5, roughness: .6 });
  const matAmber = new THREE.MeshStandardMaterial({ color: 0x3a2c14, emissive: 0xffb347, emissiveIntensity: 1.5, metalness: .3, roughness: .4 });
  const matCyan = new THREE.MeshStandardMaterial({ color: 0x0e2a33, emissive: 0x38e1ff, emissiveIntensity: 1.4, metalness: .3, roughness: .4 });
  const matMagenta = new THREE.MeshStandardMaterial({ color: 0x2a1020, emissive: 0xff3d7e, emissiveIntensity: 1.3, metalness: .3, roughness: .4 });

  const addMesh = (geo, mat, x, y, z, ry = 0, cast = true, recv = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = cast; m.receiveShadow = recv;
    m.userData.static = true;
    group.add(m); return m;
  };

  // ---- LE PRISME (centre) ----
  addMesh(new THREE.BoxGeometry(24, 4, 24), matStructure, 0, 2, 0);
  box(0, 2, 0, 24, 4, 24);
  addMesh(new THREE.CylinderGeometry(5, 6.5, 46, 10), matDark, 0, 27, 0);
  box(0, 27, 0, 11, 46, 11);
  const core = addMesh(new THREE.IcosahedronGeometry(3.4, 1), matAmber.clone(), 0, 52, 0, 0, false, false);
  core.material.emissiveIntensity = 2.4;
  const coreLight = new THREE.PointLight(0xffb347, 950, 150, 2);
  coreLight.position.set(0, 50, 0); group.add(coreLight);
  const rings = [];
  [[8, .35, 0xffb347, 40], [11, .3, 0x38e1ff, 44], [14, .25, 0xff3d7e, 48]].forEach(([r, tube, col, y], i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x101820, emissive: col, emissiveIntensity: 1.8, metalness: .5, roughness: .3 }));
    ring.position.y = y; ring.rotation.x = Math.PI / 2 + (i - 1) * .18;
    group.add(ring); rings.push(ring);
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 300, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc880, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 200; group.add(beam);
  dynamic.push(t => {
    rings.forEach((r, i) => { r.rotation.z = t * (.15 + i * .1) * (i % 2 ? -1 : 1); });
    core.rotation.y = t * .4; core.rotation.x = Math.sin(t * .3) * .3;
    core.material.emissiveIntensity = 2 + Math.sin(t * 1.7) * .7;
    coreLight.intensity = 850 + Math.sin(t * 1.7) * 250;
  });

  // ---- helper districts ----
  const platform = (x, z, w, d, y, mat) => {
    addMesh(new THREE.BoxGeometry(w, .8, d), mat || matStructure, x, y, z);
    box(x, y, z, w, .8, d);
    // piliers
    [[-w / 2 + 1, -d / 2 + 1], [w / 2 - 1, -d / 2 + 1], [-w / 2 + 1, d / 2 - 1], [w / 2 - 1, d / 2 - 1]].forEach(([ox, oz]) => {
      addMesh(new THREE.BoxGeometry(1.2, y, 1.2), matDark, x + ox, y / 2 - .4, z + oz);
      box(x + ox, y / 2 - .4, z + oz, 1.2, y, 1.2);
    });
    // liseré lumineux
    const trim = addMesh(new THREE.BoxGeometry(w + .2, .15, d + .2), matCyan, x, y + .45, z, 0, false, false);
    trim.userData.static = true;
  };

  // ---- FORGE (NW) ----
  {
    const cx = -100, cz = -100;
    const contGeo = new THREE.BoxGeometry(6.2, 2.7, 2.7);
    const cont = new THREE.InstancedMesh(contGeo, new THREE.MeshStandardMaterial({ metalness: .55, roughness: .5, envMapIntensity: .7 }), 26);
    cont.castShadow = cont.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const cols = [0x4a3527, 0x24404a, 0x5a4a20, 0x33424f, 0x54322e];
    const contColors = new THREE.Color();
    for (let i = 0; i < 26; i++) {
      const gx = cx + (rng() - .5) * 70, gz = cz + (rng() - .5) * 70;
      const stack = rng() < .3 ? 1 : 0;
      const ry = rng() < .5 ? 0 : Math.PI / 2;
      eu.set(0, ry, 0); q.setFromEuler(eu);
      p.set(gx, 1.35 + stack * 2.7, gz);
      m.compose(p, q, one); cont.setMatrixAt(i, m);
      cont.setColorAt(i, contColors.setHex(cols[Math.floor(rng() * cols.length)]));
      box(gx, 1.35 + stack * 2.7, gz, ry === 0 ? 6.2 : 2.7, 2.7 + stack * 2.7, ry === 0 ? 2.7 : 6.2);
      if (stack) box(gx, 1.35, gz, ry === 0 ? 6.2 : 2.7, 2.7, ry === 0 ? 2.7 : 6.2);
    }
    cont.instanceColor.needsUpdate = true;
    group.add(cont);
    // portique
    addMesh(new THREE.BoxGeometry(2, 18, 2), matRust, cx - 20, 9, cz - 26);
    addMesh(new THREE.BoxGeometry(2, 18, 2), matRust, cx + 20, 9, cz - 26);
    addMesh(new THREE.BoxGeometry(46, 2.4, 3), matRust, cx, 18.5, cz - 26);
    box(cx - 20, 9, cz - 26, 2, 18, 2); box(cx + 20, 9, cz - 26, 2, 18, 2);
    const craneLight = addMesh(new THREE.BoxGeometry(46, .3, .5), matAmber, cx, 17.2, cz - 24.4, 0, false, false);
    // fosse de fusion
    const pit = addMesh(new THREE.CircleGeometry(7, 24), new THREE.MeshBasicMaterial({ color: 0xff7a2a }), cx + 22, .06, cz + 18, 0, false, false);
    pit.rotation.x = -Math.PI / 2;
    const pitLight = new THREE.PointLight(0xff7a2a, 420, 45, 2); pitLight.position.set(cx + 22, 4, cz + 18); group.add(pitLight);
    dynamic.push(t => { pitLight.intensity = 380 + Math.sin(t * 3.1) * 120; });
    // tuyaux
    for (let i = 0; i < 4; i++) {
      const pipe = addMesh(new THREE.CylinderGeometry(.7, .7, 30, 8), matDark, cx - 30 + i * 3, .7, cz + 28);
      pipe.rotation.z = Math.PI / 2; pipe.rotation.y = .3;
    }
    platform(cx - 14, cz + 8, 16, 10, 6);
    pads.push({ x: cx - 14, z: cz + 18, r: 1.7 });
    anchors.push([cx, cz], [cx - 25, cz + 20], [cx + 25, cz - 15], [cx - 10, cz - 30]);
  }

  // ---- ARCHIVES (NE) ----
  {
    const cx = 100, cz = -100;
    for (let i = 0; i < 10; i++) {
      const gx = cx - 24 + (i % 5) * 12, gz = cz - 14 + Math.floor(i / 5) * 26;
      const h = 12 + rng() * 6;
      const glyph = makeGlyph(i + 1, i % 2 ? '#38e1ff' : '#ffb347');
      const mono = new THREE.Mesh(new THREE.BoxGeometry(3, h, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a2531, metalness: .65, roughness: .4, emissive: 0xffffff, emissiveMap: glyph, emissiveIntensity: .8 }));
      mono.position.set(gx, h / 2, gz); mono.castShadow = mono.receiveShadow = true; mono.userData.static = true;
      group.add(mono);
      box(gx, h / 2, gz, 3, h, 8);
    }
    // halle couverte
    addMesh(new THREE.BoxGeometry(30, 1, 18), matStructure, cx + 6, 8, cz + 30);
    box(cx + 6, 8, cz + 30, 30, 1, 18);
    [[-13, -7], [13, -7], [-13, 7], [13, 7]].forEach(([ox, oz]) => {
      addMesh(new THREE.CylinderGeometry(.9, 1.1, 8, 8), matDark, cx + 6 + ox, 4, cz + 30 + oz);
      box(cx + 6 + ox, 4, cz + 30 + oz, 2, 8, 2);
    });
    const archLight = new THREE.PointLight(0x38e1ff, 380, 50, 2); archLight.position.set(cx + 6, 6, cz + 30); group.add(archLight);
    const holo = new THREE.Mesh(new THREE.TorusGeometry(4, .12, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }));
    holo.position.set(cx + 6, 4.5, cz + 30); group.add(holo);
    dynamic.push(t => { holo.rotation.x = t * .5; holo.rotation.y = t * .3; holo.position.y = 4.5 + Math.sin(t) * .4; });
    platform(cx - 20, cz + 32, 12, 8, 7);
    pads.push({ x: cx - 20, z: cz + 42, r: 1.7 });
    anchors.push([cx, cz], [cx + 6, cz + 30], [cx - 20, cz - 20], [cx + 20, cz + 10]);
  }

  // ---- BIOLUME (SE) ----
  {
    const cx = 100, cz = 100;
    const crysGeo = new THREE.OctahedronGeometry(1, 0);
    const crysMat = new THREE.MeshStandardMaterial({ color: 0x0e2a2e, emissive: 0x2ee6c8, emissiveIntensity: 1.1, metalness: .2, roughness: .25, envMapIntensity: 1.2 });
    const crys = new THREE.InstancedMesh(crysGeo, crysMat, 60);
    crys.castShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const cc = new THREE.Color();
    for (let i = 0; i < 60; i++) {
      const a = rng() * TAU, r = 6 + rng() * 38;
      const gx = cx + Math.cos(a) * r, gz = cz + Math.sin(a) * r;
      const h = 1 + rng() * 3.6;
      eu.set((rng() - .5) * .4, rng() * TAU, (rng() - .5) * .4); q.setFromEuler(eu);
      p.set(gx, h * .55, gz); s.set(.6 + rng() * 1.1, h, .6 + rng() * 1.1);
      m.compose(p, q, s); crys.setMatrixAt(i, m);
      crys.setColorAt(i, cc.setHSL(rng() < .7 ? .48 : .9, .8, .55 + rng() * .2));
      if (h > 2.4) box(gx, h * .4, gz, 1.4, h * .8, 1.4);
    }
    crys.instanceColor.needsUpdate = true;
    group.add(crys);
    // arbres lumineux
    for (let i = 0; i < 12; i++) {
      const a = rng() * TAU, r = 12 + rng() * 30;
      const gx = cx + Math.cos(a) * r, gz = cz + Math.sin(a) * r;
      const h = 5 + rng() * 4;
      addMesh(new THREE.CylinderGeometry(.35, .55, h, 7), matDark, gx, h / 2, gz);
      box(gx, h / 2, gz, 1, h, 1);
      const canopy = addMesh(new THREE.IcosahedronGeometry(1.6 + rng() * 1.4, 1),
        new THREE.MeshStandardMaterial({ color: 0x0a2018, emissive: rng() < .6 ? 0x2ee6a8 : 0xff3d7e, emissiveIntensity: .9, roughness: .5 }),
        gx, h + .8, gz, 0, false, false);
      dynamic.push(t => { canopy.position.y = h + .8 + Math.sin(t * .7 + gx) * .15; canopy.rotation.y = t * .1; });
    }
    // bassin réfléchissant
    const pond = addMesh(new THREE.CircleGeometry(9, 32),
      new THREE.MeshStandardMaterial({ color: 0x0a1a22, metalness: 1, roughness: .06, envMapIntensity: 1.6 }), cx - 16, .05, cz - 14, 0, false, true);
    pond.rotation.x = -Math.PI / 2;
    const bioLight = new THREE.PointLight(0x2ee6c8, 400, 55, 2); bioLight.position.set(cx, 6, cz); group.add(bioLight);
    platform(cx + 22, cz - 20, 12, 10, 6.5);
    pads.push({ x: cx + 22, z: cz - 31, r: 1.7 });
    anchors.push([cx, cz], [cx - 16, cz - 14], [cx + 20, cz + 20], [cx - 25, cz + 10]);
  }

  // ---- RELAIS (SW) ----
  {
    const cx = -100, cz = 100;
    for (let i = 0; i < 3; i++) {
      const gx = cx - 20 + i * 20, gz = cz - 18 + (i % 2) * 22;
      const h = 22 + i * 6;
      addMesh(new THREE.CylinderGeometry(.8, 1.6, h, 6), matStructure, gx, h / 2, gz);
      box(gx, h / 2, gz, 2.4, h, 2.4);
      const tip = addMesh(new THREE.SphereGeometry(.9, 10, 8), matMagenta.clone(), gx, h + .8, gz, 0, false, false);
      dynamic.push(t => { tip.material.emissiveIntensity = 1 + (Math.sin(t * 2.4 + i * 2) > .6 ? 1.6 : 0); });
    }
    // radar
    addMesh(new THREE.CylinderGeometry(2, 2.6, 5, 8), matDark, cx + 16, 2.5, cz + 20);
    box(cx + 16, 2.5, cz + 20, 5, 5, 5);
    const dish = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, TAU, 0, Math.PI / 3),
      new THREE.MeshStandardMaterial({ color: 0x2c3a48, metalness: .8, roughness: .3, side: THREE.DoubleSide }));
    bowl.rotation.x = Math.PI / 2.4; bowl.castShadow = true;
    dish.add(bowl);
    dish.position.set(cx + 16, 6.5, cz + 20);
    group.add(dish);
    dynamic.push(t => { dish.rotation.y = t * .35; });
    // panneaux solaires
    const panGeo = new THREE.BoxGeometry(5, .2, 3.4);
    const panMat = new THREE.MeshStandardMaterial({ color: 0x0e1e3a, metalness: .95, roughness: .15, envMapIntensity: 1.5 });
    const pans = new THREE.InstancedMesh(panGeo, panMat, 24);
    pans.castShadow = pans.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 24; i++) {
      const gx = cx - 32 + (i % 6) * 8, gz = cz + 8 + Math.floor(i / 6) * 7;
      eu.set(-.5, 0, 0); q.setFromEuler(eu);
      p.set(gx, 1.6, gz); m.compose(p, q, one); pans.setMatrixAt(i, m);
      addMesh(new THREE.BoxGeometry(.4, 1.6, .4), matDark, gx, .8, gz);
      box(gx, 1.2, gz, 5, 2.4, 3.4);
    }
    group.add(pans);
    const relLight = new THREE.PointLight(0xff3d7e, 300, 45, 2); relLight.position.set(cx, 10, cz); group.add(relLight);
    platform(cx - 24, cz - 24, 12, 8, 6);
    pads.push({ x: cx - 24, z: cz - 34, r: 1.7 });
    anchors.push([cx, cz], [cx + 16, cz + 20], [cx - 20, cz + 15], [cx + 10, cz - 25]);
  }

  // ---- couvertures mi-arène (couloirs structurés) ----
  {
    const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const crateMat = new THREE.MeshStandardMaterial({ metalness: .5, roughness: .55, envMapIntensity: .6 });
    const crates = new THREE.InstancedMesh(crateGeo, crateMat, 90);
    crates.castShadow = crates.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const cc = new THREE.Color();
    const cols = [0x2c3a48, 0x3a3226, 0x26404a, 0x413038];
    let ci = 0;
    const placeCrate = (gx, gz, big) => {
      if (ci >= 90) return;
      const sx = big ? 2.2 : 1.4, sy = big ? 1.5 : 1.4, sz = big ? 1.5 : 1.4;
      eu.set(0, rng() * .6 - .3, 0); q.setFromEuler(eu);
      p.set(gx, sy / 2, gz); s.set(sx / 1.4, sy / 1.4, sz / 1.4);
      m.compose(p, q, s); crates.setMatrixAt(ci, m);
      crates.setColorAt(ci, cc.setHex(cols[Math.floor(rng() * cols.length)]));
      box(gx, sy / 2, gz, sx + .2, sy, sz + .2);
      ci++;
    };
    // anneaux de couverture autour du Prisme
    for (let ring = 0; ring < 2; ring++) {
      const r = 46 + ring * 22, n = 14 + ring * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * .2;
        if (Math.abs(Math.sin(a * 2)) < .18) continue; // ouvertures de couloirs
        placeCrate(Math.cos(a) * r + (rng() - .5) * 4, Math.sin(a) * r + (rng() - .5) * 4, rng() < .4);
      }
    }
    // lignes diagonales
    for (let i = 0; i < 26; i++) {
      const t = (i / 26) * 2 - 1;
      placeCrate(t * 130 + (rng() - .5) * 8, t * 60 + (rng() - .5) * 8, rng() < .5);
      if (i % 2 === 0) placeCrate(t * 60 + (rng() - .5) * 8, -t * 130 + (rng() - .5) * 8, rng() < .5);
    }
    crates.count = ci;
    crates.instanceColor.needsUpdate = true;
    group.add(crates);
    // barricades avec liseré
    const barGeo = new THREE.BoxGeometry(3.2, 1.15, .4);
    const bars = new THREE.InstancedMesh(barGeo, matStructure, 36);
    bars.castShadow = bars.receiveShadow = true;
    const stripGeo = new THREE.BoxGeometry(3.2, .1, .42);
    const strips = new THREE.InstancedMesh(stripGeo, matAmber, 36);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const r = 85 + (i % 3) * 28;
      const gx = Math.cos(a) * r, gz = Math.sin(a) * r;
      const ry = a + Math.PI / 2;
      eu.set(0, ry, 0); q.setFromEuler(eu);
      p.set(gx, .58, gz); s.set(1, 1, 1);
      m.compose(p, q, s); bars.setMatrixAt(i, m);
      p.y = 1.2; m.compose(p, q, s); strips.setMatrixAt(i, m);
      const c = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry));
      box(gx, .6, gz, 3.2 * c + .4 * sn + .2, 1.2, 3.2 * sn + .4 * c + .2);
    }
    group.add(bars); group.add(strips);
  }

  // ---- propulseurs supplémentaires ----
  [[0, 70], [0, -70], [70, 0], [-70, 0], [150, 0], [-150, 0], [0, 150]].forEach(([x, z]) => pads.push({ x, z, r: 1.7 }));
  const padGeo = new THREE.CylinderGeometry(1.7, 2, .3, 20);
  const padMeshes = [];
  pads.forEach(p => {
    const mesh = new THREE.Mesh(padGeo, matCyan.clone());
    mesh.position.set(p.x, .15, p.z); mesh.receiveShadow = true;
    group.add(mesh); padMeshes.push(mesh);
    const chev = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.1, 4),
      new THREE.MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
    chev.position.set(p.x, 1.6, p.z);
    group.add(chev);
    dynamic.push(t => { chev.position.y = 1.4 + ((t * 1.4 + p.x) % 1.2); chev.material.opacity = .8 - ((t * 1.4 + p.x) % 1.2) * .55; chev.rotation.y = t * 2; });
  });
  dynamic.push(t => { padMeshes.forEach((pm, i) => pm.material.emissiveIntensity = 1.2 + Math.sin(t * 2.2 + i) * .5); });

  // ---- plateformes de soin ----
  [[60, 60], [-60, 60], [60, -60], [-60, -60]].forEach(([x, z]) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, .25, 20),
      new THREE.MeshStandardMaterial({ color: 0x0e2418, emissive: 0x3dffa0, emissiveIntensity: .9, metalness: .4, roughness: .4 }));
    base.position.set(x, .12, z); base.receiveShadow = true;
    group.add(base);
    const cross = new THREE.Group();
    const cm = new THREE.MeshBasicMaterial({ color: 0x3dffa0, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(.9, .28, .1), cm);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(.28, .9, .1), cm);
    cross.add(b1); cross.add(b2);
    cross.position.set(x, 1.7, z);
    group.add(cross);
    const hp = { x, z, mesh: base, cross, cool: 0 };
    healthPads.push(hp);
    dynamic.push(t => { cross.rotation.y = t * 1.2; cross.position.y = 1.7 + Math.sin(t * 1.5 + x) * .12; });
  });

  // ---- points d'apparition ----
  [[-170, -170], [-170, 170], [170, -170], [170, 170], [0, -180], [0, 180], [-180, 0], [180, 0]].forEach(([x, z], i) => {
    spawns.push({ x, z, team: x < 0 ? 'A' : x > 0 ? 'B' : (i % 2 ? 'A' : 'B') });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 24),
      new THREE.MeshBasicMaterial({ color: x < 0 ? 0xffb347 : 0x38e1ff, transparent: true, opacity: .35 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, .06, z);
    group.add(ring);
  });

  // ---- murs d'énergie ----
  const wallMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2a9fc4) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
      void main(){
        float scan = smoothstep(0.4,1.0,sin(vUv.y*60.0-uTime*2.0)*0.5+0.5)*0.25;
        float grid = (smoothstep(0.94,1.0,sin(vUv.x*200.0)*0.5+0.5)+smoothstep(0.94,1.0,sin(vUv.y*24.0)*0.5+0.5))*0.2;
        float fade = smoothstep(1.0,0.15,vUv.y);
        float pulse = 0.75+0.25*sin(uTime*0.8+vUv.x*6.0);
        gl_FragColor = vec4(uColor, (scan+grid+0.06)*fade*pulse);
      }`
  });
  [[0, -BOUND, 0], [0, BOUND, 0], [-BOUND, 0, Math.PI / 2], [BOUND, 0, Math.PI / 2]].forEach(([x, z, ry]) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(BOUND * 2, 16), wallMat);
    w.position.set(x, 8, z); w.rotation.y = ry;
    group.add(w);
  });
  dynamic.push(t => { wallMat.uniforms.uTime.value = t; });

  // ---- piliers de lumière (faux volumétrique) ----
  const shafts = new THREE.Group();
  const shaftGeo = new THREE.ConeGeometry(7, 70, 12, 1, true);
  [[0, 0, 0xffc880], [-100, -100, 0xff9a5a], [100, -100, 0x6ad8f0], [100, 100, 0x5ae8c8], [-100, 100, 0xf06a9a], [55, -40, 0xffc880]].forEach(([x, z, col]) => {
    const sh = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    sh.position.set(x, 38, z);
    shafts.add(sh);
  });
  group.add(shafts);

  // ---- hologrammes ----
  const bbMat1 = new THREE.MeshBasicMaterial({ map: makeBillboard(['LUMENFALL', 'ARÈNE HÉLIOS-9'], '#ffb347'), transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const bbMat2 = new THREE.MeshBasicMaterial({ map: makeBillboard(['CONFLUENCE', 'RAVIVEZ LE PRISME'], '#38e1ff'), transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const bb1 = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), bbMat1);
  bb1.position.set(-28, 14, 30); bb1.rotation.y = .5; group.add(bb1);
  const bb2 = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), bbMat2);
  bb2.position.set(30, 14, -28); bb2.rotation.y = Math.PI + .6; group.add(bb2);
  dynamic.push(t => {
    bbMat1.opacity = .68 + Math.sin(t * 5.3) * .07 + (Math.sin(t * 17) > .96 ? -.3 : 0);
    bbMat2.opacity = .68 + Math.sin(t * 4.1 + 2) * .07;
    bb1.position.y = 14 + Math.sin(t * .6) * .3;
    bb2.position.y = 14 + Math.sin(t * .6 + 2) * .3;
  });

  // ---- braises dérivantes ----
  const emberN = 900;
  const ep = new Float32Array(emberN * 3), ev = new Float32Array(emberN * 3), ec = new Float32Array(emberN * 3);
  for (let i = 0; i < emberN; i++) {
    ep[i * 3] = rand(-190, 190); ep[i * 3 + 1] = rand(.5, 40); ep[i * 3 + 2] = rand(-190, 190);
    ev[i * 3] = rand(-.4, .4); ev[i * 3 + 1] = rand(.15, .7); ev[i * 3 + 2] = rand(-.4, .4);
    const warm = Math.random() < .6;
    ec[i * 3] = warm ? 1 : .3; ec[i * 3 + 1] = warm ? .65 : .85; ec[i * 3 + 2] = warm ? .3 : 1;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3).setUsage(THREE.DynamicDrawUsage));
  emberGeo.setAttribute('aColor', new THREE.BufferAttribute(ec, 3));
  const emberMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: particleSprite() }, uScale: { value: 600 } },
    vertexShader: `attribute vec3 aColor; varying vec3 vC; uniform float uScale;
      void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_PointSize = clamp(uScale*0.14/-mv.z, 1.0, 5.0); gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vC; uniform sampler2D uTex;
      void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC, t.a*0.55);}`
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  group.add(embers);

  // ---- piédestaux du menu ----
  const pedestalPos = [{ x: 0, z: 52 }, { x: -5.5, z: 56 }, { x: 5.5, z: 56 }, { x: -10.5, z: 59.5 }, { x: 10.5, z: 59.5 }];
  pedestalPos.forEach((p, i) => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(i === 0 ? 2.2 : 1.7, i === 0 ? 2.6 : 2, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a2634, metalness: .75, roughness: .35, envMapIntensity: 1 }));
    ped.position.set(p.x, .55, p.z); ped.castShadow = ped.receiveShadow = true; ped.userData.static = true;
    group.add(ped);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(i === 0 ? 2.3 : 1.8, .07, 6, 32),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffb347 : 0x38e1ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowRing.rotation.x = Math.PI / 2; glowRing.position.set(p.x, 1.12, p.z);
    group.add(glowRing);
    dynamic.push(t => { glowRing.material.opacity = .55 + Math.sin(t * 2 + i * 1.3) * .3; });
    box(p.x, .55, p.z, i === 0 ? 4.4 : 3.4, 1.1, i === 0 ? 4.4 : 3.4);
  });
  const menuLight = new THREE.PointLight(0xffd9a8, 260, 30, 2);
  menuLight.position.set(3, 6, 56); group.add(menuLight);

  // ---- points de patrouille / éclats (validés hors collision) ----
  const walkable = (x, z, r = .8) => {
    if (Math.abs(x) > 192 || Math.abs(z) > 192) return false;
    for (const b of colliders) {
      if (b.y0 > 2) continue;
      if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
    }
    return true;
  };
  for (let i = 0; i < 60; i++) {
    const a = rng() * TAU, r = 20 + rng() * 160;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (walkable(x, z, 1.2)) shardSpots.push({ x, z });
  }
  [[-40, 0], [40, 0], [0, -40], [0, 40], [-140, -60], [140, 60], [-60, 140], [60, -140], [-160, 160], [160, -160]].forEach(([x, z]) => { if (walkable(x, z)) anchors.push([x, z]); });

  // figer les matrices statiques
  group.traverse(o => { if (o.userData.static) { o.updateMatrix(); o.matrixAutoUpdate = false; } });

  // ---- minimap statique ----
  const staticMap = document.createElement('canvas');
  staticMap.width = staticMap.height = 512;
  {
    const x = staticMap.getContext('2d');
    x.fillStyle = '#08111c'; x.fillRect(0, 0, 512, 512);
    const zones = [[-100, -100, '#3a2a14'], [100, -100, '#12303e'], [100, 100, '#0e332a'], [-100, 100, '#32162a']];
    zones.forEach(([zx, zz, col]) => {
      x.fillStyle = col; x.globalAlpha = .5;
      x.beginPath(); x.arc((zx + 200) / 400 * 512, (zz + 200) / 400 * 512, 62, 0, 7); x.fill();
    });
    x.globalAlpha = 1;
    x.fillStyle = '#1d3247';
    colliders.forEach(b => {
      if (b.y0 > 3) return;
      x.fillRect((b.x0 + 200) / 400 * 512, (b.z0 + 200) / 400 * 512, Math.max(1.5, (b.x1 - b.x0) / 400 * 512), Math.max(1.5, (b.z1 - b.z0) / 400 * 512));
    });
    x.strokeStyle = '#2c4d6b'; x.lineWidth = 3; x.strokeRect(2, 2, 508, 508);
    x.fillStyle = '#ffb347';
    x.beginPath(); x.arc(256, 256, 5, 0, 7); x.fill();
  }

  // ---- qualité ----
  let emberCount = 650, shadowEvery = 1, frame = 0;
  function setQuality(q, shadowsOn) {
    emberCount = { low: 160, medium: 380, high: 650, ultra: 900 }[q] || 650;
    emberGeo.setDrawRange(0, emberCount);
    shafts.visible = q === 'high' || q === 'ultra';
    const size = q === 'medium' ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    sun.castShadow = shadowsOn && q !== 'low';
    shadowEvery = q === 'medium' ? 3 : 1;
    renderer.shadowMap.enabled = shadowsOn && q !== 'low';
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    emberMat.uniforms.uScale.value = renderer.domElement.height;
  }

  return {
    colliders, pads, healthPads, spawns, anchors, shardSpots, staticMap, pedestalPos, walkable,
    setQuality,
    update(t, dt) {
      for (const fn of dynamic) fn(t);
      // braises
      const pos = emberGeo.attributes.position.array;
      for (let i = 0; i < emberCount; i++) {
        pos[i * 3] += ev[i * 3] * dt; pos[i * 3 + 1] += ev[i * 3 + 1] * dt; pos[i * 3 + 2] += ev[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] > 42) { pos[i * 3 + 1] = .5; pos[i * 3] = rand(-190, 190); pos[i * 3 + 2] = rand(-190, 190); }
      }
      emberGeo.attributes.position.needsUpdate = true;
      // ombres cadencées
      frame++;
      if (renderer.shadowMap.enabled && frame % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
      // cooldown soin
      for (const hp of healthPads) {
        if (hp.cool > 0) {
          hp.cool -= dt;
          hp.mesh.material.emissiveIntensity = .15;
          hp.cross.visible = false;
        } else { hp.mesh.material.emissiveIntensity = .9; hp.cross.visible = true; }
      }
    }
  };
}