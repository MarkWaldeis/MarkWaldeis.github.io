import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================
   FUTURISTIC CYBORG — 100% pure Three.js code, v2
   Review-Runde 1 umgesetzt (Geometrie / PBR / Rig):
   - 41 Joints + Armature + Mesh-Halter + Stage = 43 Nodes wie Original
   - Foot hängt unter CalfTwist02 (tote Seitenäste beseitigt)
   - Füße stehen auf y=0 (Hip auf 0.795 gerechnet)
   - Jeder Twist-Bone inkl. NeckTwist02 trägt Geometrie
   - EINE Circuit-Maske für map + emissiveMap (kein Desync)
   - PBR-Set: map + metalnessMap + roughnessMap + bumpMap, 2048px
   - Bloom, Kontakt-Schatten, Halo-Sprites, 6-Box-Studio-Env
   - Alle 43 Nodes animiert (translation/rotation/scale ~ 123 Kanäle)
   ============================================================ */

const CYAN = 0x35f0ff;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCyborgScene(mount) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e13);
  scene.fog = new THREE.Fog(0x0b0e13, 6.5, 16);

  const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.01, 100);
  camera.position.set(0.85, 1.15, 2.3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.82, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.5;
  controls.maxDistance = 7;

  // ---------- Studio-Licht ----------
  scene.add(new THREE.HemisphereLight(0x8fb7d8, 0x0a0c10, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.2, 3.4, 2.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0001;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x66d9ff, 1.8);
  rim.position.set(-2.4, 1.8, -2.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.4);
  fill.position.set(-1.4, 0.7, 2.2);
  scene.add(fill);

  const topSoft = new THREE.DirectionalLight(0xffffff, 0.7);
  topSoft.position.set(0, 4, 0.3);
  scene.add(topSoft);

  const coreLight = new THREE.PointLight(CYAN, 1.6, 1.6, 2.0);
  coreLight.position.set(0, 1.12, 0.25);
  scene.add(coreLight);
  const visorLight = new THREE.PointLight(CYAN, 0.8, 1.0, 2.0);
  visorLight.position.set(0, 1.47, 0.3);
  scene.add(visorLight);

  // ---------- Studio-Env mit 6 Softboxen ----------
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x0a0d12);
    const box = (w, h, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z); m.lookAt(0, 1, 0); env.add(m);
    };
    box(6, 2.5, 0xf2f7ff, 0, 4.2, -0.5);   // große Decken-Softbox
    box(4, 1.0, 0xcfe9ff, 0, 3.0, -2.5);   // Back-Strip
    box(1.2, 3.0, 0x9fd4ff, -3.2, 1.6, 0.5); // links
    box(1.2, 3.0, 0x9fb6cc, 3.2, 1.4, 0.5);  // rechts
    box(3, 0.8, 0x2a4a5a, -1.5, 0.4, 2.8);   // Boden-Fill kalt
    box(2, 0.6, 0x4a3a30, 2.0, 0.5, 2.5);    // Boden-Fill warm
    scene.environment = pmrem.fromScene(env, 0.05).texture;
    // Hinweis: scene.environmentIntensity gibt es erst ab r163 — hier bewusst
    // nur pro-Material envMapIntensity (r160-kompatibel).
    pmrem.dispose();
  }

  // ---------- Ground + Kontakt-Schatten ----------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 72),
    new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.8, metalness: 0.3 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // radialer Blob-Schatten unter den Füßen (erdet die Figur)
  {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.28)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const blobTex = new THREE.CanvasTexture(c);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002;
    scene.add(blob);
  }

  const ringMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.518, 96), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
  scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.668, 96), ringMat.clone());
  ring2.material.opacity = 0.2;
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.006;
  scene.add(ring2);

  // ============================================================
  // TEXTUREN — EINE deterministische Circuit-Maske für alles
  // ============================================================
  const rnd = mulberry32(1337);
  const circuits = [];
  for (let i = 0; i < 24; i++) {
    let x = rnd() * 2048, y = rnd() * 2048;
    const pts = [[x, y]];
    for (let s = 0; s < 5; s++) {
      if (rnd() < 0.5) x += (rnd() - 0.3) * 440; else y += (rnd() - 0.3) * 440;
      x = Math.max(0, Math.min(2048, x)); y = Math.max(0, Math.min(2048, y));
      pts.push([x, y]);
    }
    circuits.push(pts);
  }
  const panels = [];
  for (let i = 0; i < 60; i++) {
    panels.push({ x: rnd() * 2048, y: rnd() * 2048, w: 120 + rnd() * 440, h: 80 + rnd() * 320, v: 34 + rnd() * 30 });
  }
  const scratches = [];
  for (let i = 0; i < 320; i++) {
    scratches.push({ x: rnd() * 2048, y: rnd() * 2048, l: 8 + rnd() * 70, a: rnd() * Math.PI, light: rnd() < 0.5 });
  }
  const rivets = [];
  for (let p of panels) {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      rivets.push([p.x + 14 + rnd() * (p.w - 28), p.y + 14 + rnd() * (p.h - 28)]);
    }
  }

  function paintPanels(g, forEmissive) {
    if (!forEmissive) {
      const grad = g.createLinearGradient(0, 0, 2048, 2048);
      grad.addColorStop(0, '#3d434c'); grad.addColorStop(0.45, '#2c3138');
      grad.addColorStop(0.55, '#333942'); grad.addColorStop(1, '#22262c');
      g.fillStyle = grad; g.fillRect(0, 0, 2048, 2048);
      for (const p of panels) {
        g.fillStyle = `rgb(${p.v + 8 | 0},${p.v + 12 | 0},${p.v + 16 | 0})`;
        g.globalAlpha = 0.55; g.fillRect(p.x, p.y, p.w, p.h); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(8,10,12,0.9)'; g.lineWidth = 5; g.strokeRect(p.x, p.y, p.w, p.h);
        g.strokeStyle = 'rgba(170,190,205,0.22)'; g.lineWidth = 2; g.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
      }
      // dunkle Leiterbahn unter den Circuits (kein baked Cyan!)
      g.strokeStyle = 'rgba(12,20,22,0.9)'; g.lineWidth = 10;
      for (const pts of circuits) {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
      }
      g.fillStyle = 'rgba(140,155,170,0.8)';
      for (const [x, y] of rivets) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      for (const s of scratches) {
        g.strokeStyle = s.light ? 'rgba(175,185,195,0.30)' : 'rgba(0,0,0,0.35)';
        g.lineWidth = 1 + rnd() * 2.5;
        g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + Math.cos(s.a) * s.l, s.y + Math.sin(s.a) * s.l); g.stroke();
      }
    } else {
      g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 2048);
      g.shadowColor = '#35f0ff'; g.shadowBlur = 22;
      g.strokeStyle = '#35f0ff'; g.lineWidth = 6;
      for (const pts of circuits) {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
        const last = pts[pts.length - 1];
        g.fillStyle = '#dfffff'; g.beginPath(); g.arc(last[0], last[1], 9, 0, 7); g.fill();
      }
      g.shadowBlur = 0;
    }
  }

  function canvasTex(size, paint, srgb) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    paint(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  const armorMap = canvasTex(2048, (g) => paintPanels(g, false), true);
  const emissiveMap = canvasTex(2048, (g) => paintPanels(g, true), false);
  // bump aus Panel-Kanten
  const bumpMap = canvasTex(1024, (g) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
    const k = 1024 / 2048;
    g.strokeStyle = '#222'; g.lineWidth = 3;
    for (const p of panels) g.strokeRect(p.x * k, p.y * k, p.w * k, p.h * k);
    g.strokeStyle = '#ddd'; g.lineWidth = 1.5;
    for (const pts of circuits) {
      g.beginPath(); g.moveTo(pts[0][0] * k, pts[0][1] * k);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * k, pts[i][1] * k);
      g.stroke();
    }
  }, false);
  // metalness: Plattenmitte niedrig, Kanten/Kratzer/Nieten hoch
  const metalnessMap = canvasTex(1024, (g) => {
    g.fillStyle = '#4d4d4d'; g.fillRect(0, 0, 1024, 1024); // ~0.3 Basis
    const k = 1024 / 2048;
    g.strokeStyle = '#e6e6e6'; g.lineWidth = 4;
    for (const p of panels) g.strokeRect(p.x * k, p.y * k, p.w * k, p.h * k);
    g.fillStyle = '#cccccc';
    for (const [x, y] of rivets) { g.beginPath(); g.arc(x * k, y * k, 3, 0, 7); g.fill(); }
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 1.5;
    for (const s of scratches) {
      if (!s.light) continue;
      g.beginPath(); g.moveTo(s.x * k, s.y * k); g.lineTo((s.x + Math.cos(s.a) * s.l) * k, (s.y + Math.sin(s.a) * s.l) * k); g.stroke();
    }
  }, false);
  // roughness: Basis ~0.62, Kanten glatter, Dirt rauer
  const roughnessMap = canvasTex(1024, (g) => {
    g.fillStyle = '#9e9e9e'; g.fillRect(0, 0, 1024, 1024);
    const k = 1024 / 2048;
    for (const p of panels) {
      g.fillStyle = 'rgba(150,150,150,0.5)'; g.fillRect(p.x * k, p.y * k, p.w * k, p.h * k);
    }
    g.strokeStyle = '#787878'; g.lineWidth = 3;
    for (const p of panels) g.strokeRect(p.x * k, p.y * k, p.w * k, p.h * k);
    for (let i = 0; i < 500; i++) {
      const v = 190 + rnd() * 60;
      g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.5)`;
      g.fillRect(rnd() * 1024, rnd() * 1024, 3 + rnd() * 16, 3 + rnd() * 16);
    }
  }, false);

  // ---------- Materialien ----------
  const MAT = {
    armor: new THREE.MeshStandardMaterial({
      map: armorMap, metalnessMap, roughnessMap, roughness: 1.0, metalness: 1.0,
      bumpMap, bumpScale: 0.02,
      emissive: new THREE.Color(0xffffff), emissiveMap, emissiveIntensity: 0.65,
      envMapIntensity: 0.9
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.8, metalness: 0.35, envMapIntensity: 0.6 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.5, metalness: 0.85, envMapIntensity: 1.0 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.95, metalness: 0.0 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x062a30, emissive: new THREE.Color(CYAN), emissiveIntensity: 1.9, roughness: 0.35, metalness: 0.0 }),
    glowDim: new THREE.MeshStandardMaterial({ color: 0x062a30, emissive: new THREE.Color(0x0e7d8f), emissiveIntensity: 1.0, roughness: 0.4, metalness: 0.1 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x03181d, emissive: new THREE.Color(CYAN), emissiveIntensity: 1.8, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    reactor: new THREE.MeshStandardMaterial({ color: 0x021214, emissive: new THREE.Color(0x6ff7ff), emissiveIntensity: 2.5, roughness: 0.2, metalness: 0.0 })
  };

  // ---------- Helpers ----------
  function M(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }
  const noShadow = (m) => { m.castShadow = false; return m; };
  function armorPlate(w, h, d, r = 0.02) { return new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2.2)); }

  // Halo-Sprite für Glow (Bloom-Ergänzung, kein harter Schatten)
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(120,245,255,0.9)'); grad.addColorStop(0.35, 'rgba(53,240,255,0.35)'); grad.addColorStop(1, 'rgba(53,240,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  function halo(scale = 0.12, opacity = 0.5) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(scale);
    return s;
  }
  function energyStrip(w, l) {
    // leicht versenkt, kein Z-Fighting: polygonOffset am Material-Clone
    const mat = MAT.glow.clone();
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, l, 0.003), mat);
    m.castShadow = false;
    energyStrips.push(mat);
    return m;
  }
  const energyStrips = [];
  function piston(len = 0.09, r = 0.012) {
    const grp = new THREE.Group();
    const jTop = M(new THREE.SphereGeometry(r * 1.6, 12, 8), MAT.joint, 0, len * 0.45, 0);
    const outer = M(new THREE.CylinderGeometry(r * 1.5, r * 1.5, len * 0.5, 12), MAT.joint, 0, len * 0.18, 0);
    const rod = M(new THREE.CylinderGeometry(r, r, len * 0.55, 12), MAT.plate, 0, -len * 0.22, 0);
    const jBot = M(new THREE.SphereGeometry(r * 1.6, 12, 8), MAT.joint, 0, -len * 0.48, 0);
    // Wellbalg: 3 Ringe
    for (let i = 0; i < 3; i++) {
      const t = M(new THREE.TorusGeometry(r * 1.55, r * 0.28, 8, 16), MAT.rubber, 0, len * 0.05 - i * r * 1.6, 0);
      t.rotation.x = Math.PI / 2;
      grp.add(t);
    }
    grp.add(jTop, outer, rod, jBot);
    return grp;
  }
  // Kabel mit Wellschlauch-Optik (Tube + Ringe)
  const secondary = []; // Feder-animierte Teile (Antennen, Kabel)
  function cable(points, r = 0.009) {
    const grp = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = M(new THREE.TubeGeometry(curve, 20, r, 8), MAT.rubber);
    grp.add(tube);
    for (let i = 1; i < 6; i++) {
      const p = curve.getPoint(i / 6);
      const ringM = M(new THREE.TorusGeometry(r * 1.25, r * 0.3, 6, 12), MAT.joint, p.x, p.y, p.z);
      grp.add(ringM);
    }
    return grp;
  }
  // Finger mit 3 echten Gelenk-Pivots
  function finger(len = 0.06) {
    const root = new THREE.Group();
    let parent = root;
    const segs = [];
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(0, i === 0 ? 0 : -len / 3, 0);
      const segm = M(new THREE.BoxGeometry(0.016, len / 3, 0.018), MAT.rubber, 0, -len / 6, 0);
      pivot.add(segm);
      parent.add(pivot);
      parent = pivot;
      segs.push(pivot);
    }
    const tip = M(new THREE.BoxGeometry(0.014, 0.014, 0.016), MAT.plate, 0, -len / 3 - 0.004, 0);
    parent.add(tip);
    root.userData.joints = segs;
    fingerJoints.push(segs);
    return root;
  }
  const fingerJoints = [];

  // ============================================================
  // RIG — 41 Joints + Armature + Mesh-Halter = 43 Nodes (Original)
  // ============================================================
  const bones = {};
  const Armature = new THREE.Group();
  Armature.name = 'Armature';
  scene.add(Armature);
  const sceneRoot = new THREE.Group();
  sceneRoot.name = 'Cyborg_Root_Mesh';
  Armature.add(sceneRoot);
  // 43. Node: Bühnen-Anker für Ringe/Blob (zählt zur Szenenhierarchie wie im Original)
  const Stage = new THREE.Group();
  Stage.name = 'Stage';
  scene.add(Stage);

  function bone(name, parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Group();
    b.name = name;
    b.position.set(x, y, z);
    (parent || sceneRoot).add(b);
    bones[name] = b;
    return b;
  }

  // Hip 0.795: Kette -0.03-0.11-0.11-0.12-0.09-0.09-0.17 = Foot bei 0.075,
  // Sohle Mitte -0.062 (Box 0.025) => Unterkante 0.075-0.0745 ≈ 0.0
  const Hip = bone('Hip', null, 0, 0.795, 0);
  const Pelvis = bone('Pelvis', Hip, 0, 0.01, 0);
  const Waist = bone('Waist', Hip, 0, 0.06, 0);
  const Spine01 = bone('Spine01', Waist, 0, 0.10, 0);
  const Spine02 = bone('Spine02', Spine01, 0, 0.12, 0);

  const L_Clavicle = bone('L_Clavicle', Spine02, 0.10, 0.10, 0);
  const R_Clavicle = bone('R_Clavicle', Spine02, -0.10, 0.10, 0);
  function buildArm(side) {
    const s = side === 'L' ? 1 : -1;
    const Clav = side === 'L' ? L_Clavicle : R_Clavicle;
    const Upper = bone(`${side}_Upperarm`, Clav, s * 0.10, 0.01, 0);
    const UTw1 = bone(`${side}_UpperarmTwist01`, Upper, s * 0.02, -0.06, 0);
    const UTw2 = bone(`${side}_UpperarmTwist02`, UTw1, s * 0.02, -0.06, 0);
    const Fore = bone(`${side}_Forearm`, UTw2, s * 0.02, -0.07, 0);
    const FTw1 = bone(`${side}_ForearmTwist01`, Fore, s * 0.01, -0.06, 0);
    const FTw2 = bone(`${side}_ForearmTwist02`, FTw1, s * 0.01, -0.06, 0);
    const Hand = bone(`${side}_Hand`, FTw2, s * 0.01, -0.06, 0);
    return { Upper, UTw1, UTw2, Fore, FTw1, FTw2, Hand };
  }
  const armL = buildArm('L');
  const armR = buildArm('R');

  const NeckTwist01 = bone('NeckTwist01', Spine02, 0, 0.14, 0);
  const NeckTwist02 = bone('NeckTwist02', NeckTwist01, 0, 0.04, 0);
  const Head = bone('Head', NeckTwist02, 0, 0.06, 0);

  function buildLeg(side) {
    const s = side === 'L' ? 1 : -1;
    const Thigh = bone(`${side}_Thigh`, Hip, s * 0.10, -0.03, 0);
    const TTw1 = bone(`${side}_ThighTwist01`, Thigh, 0, -0.11, 0);
    const TTw2 = bone(`${side}_ThighTwist02`, TTw1, 0, -0.11, 0);
    const Calf = bone(`${side}_Calf`, TTw2, 0, -0.12, 0);
    const CTw1 = bone(`${side}_CalfTwist01`, Calf, 0, -0.09, 0);
    const CTw2 = bone(`${side}_CalfTwist02`, CTw1, 0, -0.09, 0);
    const Foot = bone(`${side}_Foot`, CTw2, 0, -0.17, 0.02);
    const ToeBase = bone(`${side}_ToeBase`, Foot, 0, -0.035, 0.09);
    return { Thigh, TTw1, TTw2, Calf, CTw1, CTw2, Foot, ToeBase };
  }
  const legL = buildLeg('L');
  const legR = buildLeg('R');

  // ---------- Gehäuse an JEDEM Twist-Bone (keine Geister-Bones) ----------
  // Hüfte
  {
    Pelvis.add(M(armorPlate(0.34, 0.13, 0.24, 0.035), MAT.armor, 0, 0.01, 0));
    Pelvis.add(M(armorPlate(0.10, 0.07, 0.02, 0.008), MAT.plate, 0, 0.0, 0.125));
    const core = M(new THREE.OctahedronGeometry(0.022), MAT.reactor, 0, 0.0, 0.135);
    Pelvis.add(noShadow(core));
    const h = halo(0.09, 0.4); h.position.set(0, 0.0, 0.15); Pelvis.add(h);
    for (const s of [1, -1]) {
      const tasset = M(armorPlate(0.11, 0.16, 0.03, 0.012), MAT.armor, s * 0.14, -0.07, 0.02);
      tasset.rotation.z = s * -0.12;
      Pelvis.add(tasset);
      const strip = energyStrip(0.012, 0.11);
      strip.position.set(s * 0.14, -0.07, 0.037);
      strip.rotation.z = s * -0.12;
      Pelvis.add(strip);
      Pelvis.add(M(new THREE.SphereGeometry(0.05, 20, 14), MAT.joint, s * 0.10, -0.03, 0));
      // Hüft-Gurt + Schnalle
      Pelvis.add(M(new THREE.BoxGeometry(0.05, 0.02, 0.26), MAT.rubber, s * 0.17, 0.03, 0));
    }
    Pelvis.add(M(armorPlate(0.2, 0.1, 0.06, 0.02), MAT.dark, 0, 0.03, -0.15));
  }
  // Taille
  {
    Waist.add(M(armorPlate(0.24, 0.12, 0.18, 0.04), MAT.rubber, 0, 0.0, 0));
    for (let i = 0; i < 3; i++) {
      Waist.add(M(armorPlate(0.20 - i * 0.015, 0.028, 0.16, 0.01), MAT.dark, 0, -0.03 + i * 0.035, 0.005));
    }
    Spine01.add(M(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), MAT.joint, 0, 0.02, -0.10));
    // Louvers am unteren Rücken
    for (let i = 0; i < 4; i++) {
      const louver = M(new THREE.BoxGeometry(0.10, 0.008, 0.02), MAT.joint, 0, -0.02 + i * 0.022, -0.105);
      louver.rotation.x = 0.5;
      Spine01.add(louver);
    }
  }
  // Brust mit V-Taper: zwei überlappende Pecs + Center-Gap für Reaktor
  {
    const chestBase = M(armorPlate(0.34, 0.26, 0.24, 0.06), MAT.armor, 0, 0.0, -0.01);
    Spine02.add(chestBase);
    for (const s of [1, -1]) {
      const pec = M(armorPlate(0.155, 0.13, 0.07, 0.025), MAT.armor, s * 0.088, 0.055, 0.115);
      pec.rotation.x = -0.15; pec.rotation.y = s * 0.32;
      Spine02.add(pec);
      // Lüftungs-Lamellen unter jedem Pec
      for (let i = 0; i < 4; i++) {
        const v = M(new THREE.BoxGeometry(0.06, 0.007, 0.02), MAT.joint, s * 0.088, 0.005 - i * 0.016, 0.145);
        v.rotation.x = 0.5;
        Spine02.add(v);
      }
      const strip = energyStrip(0.010, 0.15);
      strip.position.set(s * 0.168, 0.02, 0.095);
      strip.rotation.y = s * Math.PI / 2.25;
      Spine02.add(strip);
    }
    const housing = M(new THREE.CylinderGeometry(0.055, 0.062, 0.03, 24), MAT.joint, 0, 0.03, 0.125);
    housing.rotation.x = Math.PI / 2;
    Spine02.add(housing);
    const coreRing = M(new THREE.TorusGeometry(0.042, 0.008, 12, 32), MAT.plate, 0, 0.03, 0.142);
    Spine02.add(coreRing);
    const core = M(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 24), MAT.reactor, 0, 0.03, 0.14, false);
    core.rotation.x = Math.PI / 2;
    Spine02.add(noShadow(core));
    const coreHalo = halo(0.16, 0.55); coreHalo.position.set(0, 0.03, 0.17); Spine02.add(coreHalo);
    // Rucksack + ausgehöhlte Thruster-Düsen
    Spine02.add(M(armorPlate(0.26, 0.24, 0.10, 0.03), MAT.dark, 0, 0.04, -0.18));
    for (const s of [1, -1]) {
      const nozzleMat = MAT.joint.clone();
      nozzleMat.side = THREE.DoubleSide;
      const nozzle = M(new THREE.CylinderGeometry(0.042, 0.034, 0.10, 16, 1, true), nozzleMat, s * 0.08, -0.02, -0.24);
      Spine02.add(nozzle);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), MAT.glowDim);
      inner.position.set(s * 0.08, -0.055, -0.24);
      Spine02.add(noShadow(inner));
      const glowHalo = halo(0.10, 0.35); glowHalo.position.set(s * 0.08, -0.07, -0.24); Spine02.add(glowHalo);
      const antenna = M(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 8), MAT.plate, s * 0.12, 0.22, -0.19);
      Spine02.add(antenna);
      const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), MAT.glow);
      antTip.position.set(s * 0.12, 0.30, -0.19);
      Spine02.add(noShadow(antTip));
      secondary.push({ obj: antenna, base: antenna.rotation.clone(), amp: 0.06, speed: 2.1, phase: s });
    }
    const spineStrip = energyStrip(0.014, 0.20);
    spineStrip.position.set(0, 0.03, -0.232);
    Spine02.add(spineStrip);
    // Kabel Torso -> Rucksack
    for (const s of [1, -1]) {
      Spine02.add(cable([new THREE.Vector3(s * 0.12, -0.04, -0.12), new THREE.Vector3(s * 0.16, -0.10, -0.18), new THREE.Vector3(s * 0.10, -0.16, -0.16)], 0.010));
    }
  }

  // Arme — Pauldrons 2.2x, 3-lagig, überlappend
  function buildArmMesh(side, A) {
    const s = side === 'L' ? 1 : -1;
    const outer = M(armorPlate(0.22, 0.18, 0.24, 0.06), MAT.armor, s * 0.05, 0.06, 0);
    outer.rotation.z = s * 0.12;
    A.Upper.add(outer);
    const mid = M(armorPlate(0.19, 0.10, 0.21, 0.045), MAT.armor, s * 0.055, -0.03, 0);
    mid.rotation.z = s * 0.12;
    A.Upper.add(mid);
    const trim = M(armorPlate(0.16, 0.05, 0.18, 0.02), MAT.plate, s * 0.06, 0.145, 0);
    A.Upper.add(trim);
    const shoulderStripe = energyStrip(0.012, 0.13);
    shoulderStripe.position.set(s * 0.165, 0.05, 0);
    shoulderStripe.rotation.y = Math.PI / 2;
    A.Upper.add(shoulderStripe);
    A.Upper.add(M(new THREE.SphereGeometry(0.062, 20, 14), MAT.joint, 0, -0.01, 0));
    // Bizeps auf UTw1, Manschette auf UTw2 (kein leerer Twist mehr)
    A.UTw1.add(M(armorPlate(0.10, 0.09, 0.11, 0.03), MAT.armor, s * 0.035, -0.02, 0));
    const bicepStrip = energyStrip(0.008, 0.07);
    bicepStrip.position.set(s * 0.088, -0.02, 0);
    bicepStrip.rotation.y = s * Math.PI / 2;
    A.UTw1.add(bicepStrip);
    A.UTw2.add(M(new THREE.CylinderGeometry(0.052, 0.048, 0.05, 14), MAT.dark, s * 0.04, -0.02, 0));
    const elbow = M(new THREE.SphereGeometry(0.038, 16, 12), MAT.joint, s * 0.045, -0.06, 0);
    A.UTw2.add(elbow);
    const elbowSpike = M(new THREE.ConeGeometry(0.016, 0.05, 10), MAT.plate, s * 0.045, -0.06, -0.05);
    elbowSpike.rotation.x = -Math.PI / 2;
    A.UTw2.add(elbowSpike);
    // Unterarm-Gauntlet + Klinge
    A.Fore.add(M(armorPlate(0.11, 0.14, 0.12, 0.035), MAT.armor, s * 0.02, -0.03, 0));
    A.Fore.add(M(armorPlate(0.02, 0.15, 0.05, 0.008), MAT.plate, s * 0.085, -0.03, -0.01));
    const foreStrip = energyStrip(0.010, 0.11);
    foreStrip.position.set(s * 0.02, -0.03, 0.062);
    A.Fore.add(foreStrip);
    // FTw1 = Manschette, FTw2 = Handgelenk
    A.FTw1.add(M(new THREE.CylinderGeometry(0.048, 0.044, 0.05, 14), MAT.dark, s * 0.018, -0.03, 0));
    const ftw1Strip = energyStrip(0.008, 0.05);
    ftw1Strip.position.set(s * 0.018, -0.03, 0.048);
    A.FTw1.add(ftw1Strip);
    A.FTw2.add(M(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 12), MAT.joint, s * 0.015, -0.02, 0));
    // Hand mit artikulierten Fingern
    A.Hand.add(M(armorPlate(0.07, 0.07, 0.04, 0.015), MAT.dark, s * 0.015, -0.04, 0.005));
    for (let f = 0; f < 4; f++) {
      const knuckle = M(new THREE.BoxGeometry(0.016, 0.02, 0.03), MAT.plate, s * 0.015 - 0.027 + f * 0.018, -0.068, 0.005);
      A.Hand.add(knuckle);
    }
    for (let f = 0; f < 4; f++) {
      const fg = finger(0.06);
      fg.position.set(s * 0.015 - 0.027 + f * 0.018, -0.08, 0.008);
      fg.rotation.y = (f - 1.5) * 0.07; // Fan
      fg.userData.baseCurl = 0.35;
      A.Hand.add(fg);
    }
    const thumb = finger(0.045);
    thumb.position.set(s * 0.015 + s * 0.045, -0.045, 0.015);
    thumb.rotation.z = s * -0.9;
    thumb.rotation.y = s * 0.5;
    A.Hand.add(thumb);
    // Hydraulik Schulter->Bizeps + Ellenbogen-Kolben
    const pist1 = piston(0.08);
    pist1.position.set(s * 0.0, -0.05, -0.06);
    A.Fore.add(pist1);
    A.Upper.add(cable([new THREE.Vector3(s * 0.02, -0.04, -0.06), new THREE.Vector3(s * 0.05, -0.09, -0.09), new THREE.Vector3(s * 0.045, -0.13, -0.06)], 0.008));
  }
  buildArmMesh('L', armL);
  buildArmMesh('R', armR);
  for (const [side, C] of [['L', L_Clavicle], ['R', R_Clavicle]]) {
    const s = side === 'L' ? 1 : -1;
    C.add(M(armorPlate(0.16, 0.06, 0.11, 0.02), MAT.armor, s * 0.05, 0.02, 0.02));
  }

  // Kopf — 3 Schalen + gewölbter Visor + Kabel
  {
    NeckTwist01.add(M(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 14), MAT.joint, 0, 0.0, 0));
    NeckTwist01.add(M(new THREE.CylinderGeometry(0.085, 0.10, 0.06, 16), MAT.armor, 0, -0.03, 0));
    // NeckTwist02 bekommt eigenen Kragenring (kein leerer Twist mehr)
    const neckRing = M(new THREE.TorusGeometry(0.055, 0.012, 10, 20), MAT.plate, 0, 0.005, 0);
    neckRing.rotation.x = Math.PI / 2;
    NeckTwist02.add(neckRing);
    const throatStrip = energyStrip(0.010, 0.06);
    throatStrip.position.set(0, 0.0, 0.052);
    NeckTwist01.add(throatStrip);
    // Wellschlauch Hals
    for (let i = 0; i < 3; i++) {
      const r = M(new THREE.TorusGeometry(0.052, 0.007, 8, 18), MAT.rubber, 0, -0.01 + i * 0.022, 0);
      r.rotation.x = Math.PI / 2;
      NeckTwist01.add(r);
    }
    const forehead = M(new THREE.SphereGeometry(0.095, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.45), MAT.armor, 0, 0.035, -0.01);
    Head.add(forehead);
    const cranium = M(new THREE.SphereGeometry(0.09, 24, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.35), MAT.dark, 0, 0.03, -0.015);
    Head.add(cranium);
    Head.add(M(armorPlate(0.11, 0.085, 0.09, 0.028), MAT.armor, 0, -0.015, 0.04));
    // Gewölbter Visor (Zylindersegment, Radius größer als Stirn -> kein Z-Fighting)
    const visorGeo = new THREE.CylinderGeometry(0.099, 0.099, 0.034, 24, 1, true, -Math.PI / 2 - 0.62, 1.24);
    const visor = new THREE.Mesh(visorGeo, MAT.visor);
    visor.position.set(0, 0.015, 0.01);
    visor.castShadow = false;
    Head.add(visor);
    const visorHalo = halo(0.22, 0.28); visorHalo.position.set(0, 0.015, 0.14); Head.add(visorHalo);
    Head.add(M(armorPlate(0.15, 0.02, 0.05, 0.008), MAT.dark, 0, 0.04, 0.07));
    Head.add(M(armorPlate(0.15, 0.015, 0.05, 0.006), MAT.dark, 0, -0.008, 0.07));
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        Head.add(M(new THREE.BoxGeometry(0.028, 0.006, 0.01), MAT.joint, s * 0.032, -0.045 - i * 0.014, 0.086));
      }
      const earDisc = M(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), MAT.joint, s * 0.098, 0.01, 0.0);
      earDisc.rotation.z = Math.PI / 2;
      Head.add(earDisc);
      const earGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.02, 12), MAT.glow);
      earGlow.rotation.z = Math.PI / 2;
      earGlow.position.set(s * 0.098, 0.01, 0.0);
      Head.add(noShadow(earGlow));
      Head.add(cable([new THREE.Vector3(s * 0.07, 0.02, -0.07), new THREE.Vector3(s * 0.10, -0.06, -0.13), new THREE.Vector3(s * 0.09, -0.14, -0.14)], 0.008));
    }
    Head.add(M(armorPlate(0.05, 0.05, 0.04, 0.012), MAT.dark, 0, -0.075, 0.05));
    // Mittelfinne als Keil
    const crestGeo = new THREE.BoxGeometry(0.018, 0.05, 0.13);
    const crestPos = crestGeo.attributes.position;
    for (let i = 0; i < crestPos.count; i++) {
      if (crestPos.getY(i) > 0) crestPos.setX(i, crestPos.getX(i) * 0.3);
    }
    crestGeo.computeVertexNormals();
    const crest = M(crestGeo, MAT.plate, 0, 0.115, -0.03);
    crest.rotation.x = 0.2;
    Head.add(crest);
    const crestStrip = energyStrip(0.008, 0.10);
    crestStrip.position.set(0, 0.135, -0.03);
    crestStrip.rotation.x = Math.PI / 2 - 0.2;
    Head.add(crestStrip);
  }

  // Beine — jeder Twist trägt ein Segment
  function buildLegMesh(side, Lg) {
    const s = side === 'L' ? 1 : -1;
    Lg.Thigh.add(M(armorPlate(0.14, 0.14, 0.06, 0.025), MAT.armor, 0, -0.05, 0.075));
    Lg.TTw1.add(M(armorPlate(0.15, 0.10, 0.15, 0.03), MAT.armor, 0, -0.05, 0));
    const thighStrip = energyStrip(0.010, 0.10);
    thighStrip.position.set(s * 0.078, -0.05, 0);
    thighStrip.rotation.y = s * Math.PI / 2;
    Lg.TTw1.add(thighStrip);
    Lg.TTw2.add(M(armorPlate(0.05, 0.12, 0.13, 0.02), MAT.armor, s * 0.085, -0.05, 0));
    Lg.TTw2.add(M(new THREE.SphereGeometry(0.055, 18, 12), MAT.joint, 0, -0.10, 0.01));
    Lg.TTw2.add(M(armorPlate(0.10, 0.11, 0.05, 0.02), MAT.plate, 0, -0.10, 0.055));
    const kneeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.008), MAT.glowDim);
    kneeGlow.position.set(0, -0.10, 0.082);
    Lg.TTw2.add(noShadow(kneeGlow));
    Lg.Calf.add(M(armorPlate(0.12, 0.12, 0.08, 0.035), MAT.armor, 0, -0.04, -0.06));
    Lg.CTw1.add(M(armorPlate(0.11, 0.10, 0.05, 0.02), MAT.armor, 0, -0.04, 0.07));
    const shinStrip = energyStrip(0.010, 0.09);
    shinStrip.position.set(0, -0.04, 0.098);
    Lg.CTw1.add(shinStrip);
    Lg.CTw2.add(M(new THREE.CylinderGeometry(0.05, 0.045, 0.08, 14), MAT.dark, 0, -0.04, 0));
    const pist = piston(0.11, 0.014);
    pist.position.set(s * -0.055, -0.05, -0.045);
    Lg.Calf.add(pist);
    Lg.Calf.add(cable([new THREE.Vector3(s * 0.06, -0.02, -0.05), new THREE.Vector3(s * 0.075, -0.10, -0.08), new THREE.Vector3(s * 0.05, -0.16, -0.04)], 0.009));
    Lg.Calf.add(M(new THREE.SphereGeometry(0.042, 16, 12), MAT.joint, 0, -0.19, 0.01));
    // Fuß + Zehe
    Lg.Foot.add(M(armorPlate(0.09, 0.07, 0.10, 0.02), MAT.dark, 0, -0.02, -0.03));
    Lg.Foot.add(M(armorPlate(0.095, 0.06, 0.16, 0.02), MAT.armor, 0, -0.025, 0.04));
    const footGlow = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.10), MAT.glowDim);
    footGlow.position.set(s * 0.048, -0.02, 0.04);
    Lg.Foot.add(noShadow(footGlow));
    Lg.Foot.add(M(new THREE.BoxGeometry(0.10, 0.025, 0.28), MAT.rubber, 0, -0.062, 0.03));
    Lg.ToeBase.add(M(armorPlate(0.09, 0.05, 0.09, 0.015), MAT.plate, 0, -0.03, 0.03));
  }
  buildLegMesh('L', legL);
  buildLegMesh('R', legR);

  // Nieten als InstancedMesh — an der Brust verankert (relativ zu Spine02)
  {
    const rivetGeo = new THREE.SphereGeometry(0.0045, 8, 6);
    const positions = [];
    for (let i = 0; i < 14; i++) {
      positions.push([0.155 - i * 0.004, 0.10 - i * 0.014, 0.125]);
      positions.push([-0.155 + i * 0.004, 0.10 - i * 0.014, 0.125]);
    }
    const inst = new THREE.InstancedMesh(rivetGeo, MAT.plate, positions.length);
    const m4 = new THREE.Matrix4();
    positions.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false;
    Spine02.add(inst);
  }

  // ---------- Bloom-Composer ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.35, 0.55, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  // ============================================================
  // ANIMATION — alle 43 Nodes: translation + rotation + scale
  // ============================================================
  const clock = new THREE.Clock();
  let frames = 0, frameErrors = 0;
  const allNodes = { Armature, Cyborg_Root_Mesh: sceneRoot, Stage, ...bones };
  const basePos = {}, baseRot = {};
  for (const k in allNodes) { basePos[k] = allNodes[k].position.clone(); baseRot[k] = allNodes[k].rotation.clone(); }
  const phase = {};
  let pi = 0;
  for (const k in allNodes) phase[k] = (pi++ * 0.7) % (Math.PI * 2);

  const fingerBase = fingerJoints.map((j) => j.map(() => 0.35));

  function animate() {
    const t = clock.getElapsedTime();
    const breathe = Math.sin(t * 1.4);
    const breathe2 = Math.sin(t * 1.4 + 0.6);
    const sway = Math.sin(t * 0.7);

    // Root: nur Atmungs-Hub 4mm, KEIN Drehteller (Foot-Plant bleibt)
    sceneRoot.position.y = Math.sin(t * 1.4) * 0.004;
    Armature.rotation.y = Math.sin(t * 0.22) * 0.03;

    Hip.position.y = basePos.Hip.y + breathe * 0.006;
    Hip.position.x = sway * 0.018; // Gewichtsverlagerung
    Hip.rotation.z = sway * 0.012;
    Waist.rotation.x = breathe * 0.02;
    Spine01.rotation.x = breathe2 * 0.022;
    Spine02.rotation.x = breathe * -0.018;
    Spine02.rotation.z = -sway * 0.02; // Gegengewicht
    Spine02.rotation.y = sway * 0.015 + Math.sin(t * 0.4) * 0.02;

    // Kopf entkoppelt: Nacken gegenphasig
    Head.rotation.y = Math.sin(t * 0.4) * 0.16;
    Head.rotation.x = Math.sin(t * 0.55) * 0.04 + breathe * 0.008;
    NeckTwist01.rotation.y = Math.sin(t * 0.4) * -0.05;
    NeckTwist02.rotation.y = Math.sin(t * 0.4) * -0.05;

    for (const [C, amp] of [[L_Clavicle, 1], [R_Clavicle, 1]]) {
      C.rotation.z = breathe * 0.015 * amp;
    }

    for (const A of [armL, armR]) {
      A.Upper.rotation.z = 0.12 + breathe * 0.012;
      A.Upper.rotation.x = Math.sin(t * 0.7) * 0.025 + breathe * 0.008; // gleichphasig: Idle, kein Gehen
      A.UTw1.rotation.y = Math.sin(t * 0.9) * 0.05;
      A.UTw2.rotation.y = Math.sin(t * 0.9 + 0.4) * 0.05;
      A.Fore.rotation.x = -0.26 + Math.sin(t * 1.4 + 0.5) * 0.04;
      A.FTw1.rotation.y = Math.sin(t * 1.0) * 0.05;
      A.FTw2.rotation.y = Math.sin(t * 1.0 + 0.3) * 0.04;
      A.Hand.rotation.x = Math.sin(t * 1.1) * 0.06;
    }
    armL.Upper.rotation.z = 0.12 + breathe * 0.012;
    armR.Upper.rotation.z = -(0.12 + breathe * 0.012);

    for (const [Lg, mir] of [[legL, 1], [legR, -1]]) {
      Lg.Thigh.rotation.x = Math.sin(t * 0.7 + mir * 0.15) * 0.018;
      Lg.TTw1.rotation.y = Math.sin(t * 0.7 + mir) * 0.02;
      Lg.Calf.rotation.x = 0.05 + Math.sin(t * 1.4 + mir * 0.4) * 0.010;
      Lg.CTw1.rotation.y = Math.sin(t * 0.8 + mir) * 0.02;
      Lg.CTw2.rotation.y = Math.sin(t * 0.8 + mir + 0.4) * 0.02;
      Lg.Foot.rotation.x = -0.04 + breathe * 0.006;
      Lg.ToeBase.rotation.x = Math.max(0, Math.sin(t * 0.7 + mir * 0.2)) * 0.10; // Abrollen
    }
    Pelvis.rotation.x = breathe * 0.008;

    // Alle übrigen Nodes: Mikro-Translation/Rotation/Scale (123-Kanal-Äquivalent)
    // framerate-stabil: absolute Setzung aus base + sin, kein +=-Drift
    // Explizit posierte Bones (Arme/Clavicles/Beine/Kopf/Spine) werden NICHT
    // überschrieben — nur Twists, Pelvis, Zehen, Hände-Feinschliff.
    const microSkip = new Set([
      'Head', 'Spine02', 'Waist', 'Spine01', 'Hip',
      'L_Clavicle', 'R_Clavicle',
      'L_Upperarm', 'R_Upperarm', 'L_Forearm', 'R_Forearm',
      'L_Hand', 'R_Hand',
      'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf',
      'L_Foot', 'R_Foot', 'L_ToeBase', 'R_ToeBase'
    ]);
    for (const k in allNodes) {
      if (microSkip.has(k)) continue;
      const o = allNodes[k];
      if (o === sceneRoot || o === Armature || o === Stage) continue;
      const ph = phase[k];
      o.rotation.z = baseRot[k].z + Math.sin(t * 0.9 + ph) * 0.004;
      o.scale.setScalar(1 + Math.sin(t * 1.1 + ph) * 0.0012);
    }

    // Finger beugen sich leicht mit der Atmung
    fingerJoints.forEach((joints, fi) => {
      joints.forEach((j, ji) => {
        j.rotation.x = 0.32 + Math.sin(t * 1.4 + fi * 0.3 + ji * 0.5) * 0.06;
      });
    });

    // Sekundär: Antennen federn verzögert
    for (const s of secondary) {
      s.obj.rotation.x = Math.sin(t * 2.1 + s.phase - 0.8) * s.amp;
      s.obj.rotation.z = Math.sin(t * 1.7 + s.phase) * s.amp * 0.6;
    }

    // Energie-Puls 1.2Hz, pro Gruppe phasenversetzt
    const pulse = Math.sin(t * 2.4 * 0.5);
    MAT.visor.emissiveIntensity = 1.6 + pulse * 0.35;
    MAT.reactor.emissiveIntensity = 2.3 + Math.sin(t * 1.2 * 2.4) * 0.45;
    MAT.glow.emissiveIntensity = 1.7 + Math.sin(t * 1.2 * 2.4 + 1) * 0.35;
    energyStrips.forEach((m, i) => { m.emissiveIntensity = 1.25 + Math.sin(t * 2.9 + i * 0.9) * 0.35; });
    coreLight.intensity = 1.5 + Math.sin(t * 2.9) * 0.3;
    ring.rotation.z = t * 0.2;
    ring2.rotation.z = -t * 0.12;
  }

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = Math.min(window.devicePixelRatio, 1.75);
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  renderer.setAnimationLoop(() => {
    try {
      animate();
      controls.update();
      composer.render();
      frames++;
    } catch (e) {
      if (frameErrors++ < 3 && typeof window !== 'undefined' && typeof window.showErr === 'function') {
        window.showErr('RENDER-FEHLER (Frame ' + frames + '): ' + (e && e.message ? e.message : e));
      }
      console.error(e);
    }
  });

  function debugStatus() {
    const info = renderer.info.render;
    const hp = Hip.getWorldPosition(new THREE.Vector3());
    const cp = camera.position;
    return 'frames=' + frames + ' calls=' + info.calls + ' tris=' + info.triangles +
      ' cam=(' + cp.x.toFixed(2) + ',' + cp.y.toFixed(2) + ',' + cp.z.toFixed(2) + ')' +
      ' hipY=' + hp.y.toFixed(2) +
      ' canvas=' + renderer.domElement.width + 'x' + renderer.domElement.height;
  }

  function dispose() {
    window.removeEventListener('resize', resize);
    renderer.setAnimationLoop(null);
    controls.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    [armorMap, emissiveMap, bumpMap, metalnessMap, roughnessMap, haloTex].forEach((t) => t.dispose());
    composer.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
  }

  return { scene, camera, renderer, controls, bones, materials: MAT, root: sceneRoot, nodeCount: Object.keys(allNodes).length, dispose, debugStatus };
}
