/* ============================================================================
   F1 Clash 3D — Autonomous F1 Showcase
   Three.js (vendored, r186) • GLB assets • ES Module
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ============================== Konstanten ================================ */
const TOTAL_LAPS = 10;
const CAR_IDS = ['redbull', 'ferrari', 'mercedes'];
const clamp = THREE.MathUtils.clamp;

/* Wiederverwendete temp-Objekte — keine Allokationen im Render-Loop */
const _vA = new THREE.Vector3(), _vB = new THREE.Vector3(), _vC = new THREE.Vector3();
const _vD = new THREE.Vector3(), _vE = new THREE.Vector3(), _vF = new THREE.Vector3();
const _vG = new THREE.Vector3(), _vH = new THREE.Vector3(), _vI = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

/* ============================== Helfer ==================================== */
function formatRaceTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
function formatLapTime(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(3)}`;
}
function el(id) { return document.getElementById(id); }

/* ========================= Web-Audio F1 Motor ============================= */
class AudioEngine {
  constructor() {
    this.ctx = null; this.masterGain = null;
    this.isPlaying = false; this.isMuted = true;
    this.engineOsc1 = null; this.engineOsc2 = null; this.subOsc = null;
    this.turboOsc = null; this.filter = null;
    this.engineGain = null; this.turboGain = null;
  }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(110, this.ctx.currentTime);
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sawtooth';
      this.subOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.setValueAtTime(1200, this.ctx.currentTime);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(1800, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.engineOsc1.connect(this.engineGain);
      this.engineOsc2.connect(this.engineGain);
      this.subOsc.connect(this.engineGain);
      this.engineGain.connect(this.filter);
      this.filter.connect(this.masterGain);
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.engineOsc1.start(); this.engineOsc2.start();
      this.subOsc.start(); this.turboOsc.start();
      this.isPlaying = true;
    } catch (e) { console.warn('Web Audio init error:', e); }
  }
  toggleMute() {
    if (!this.ctx) {
      this.init(); this.isMuted = false;
      if (this.masterGain) this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      return !this.isMuted;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isMuted = !this.isMuted;
    const g = this.isMuted ? 0 : 0.4;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.05);
    return !this.isMuted;
  }
  update(speedKmh, rpm = 8000, gear = 4, braking = false) {
    if (!this.ctx || this.isMuted || !this.isPlaying) return;
    const t = this.ctx.currentTime;
    const base = 70 + (rpm / 13000) * 190;
    this.engineOsc1.frequency.setTargetAtTime(base, t, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(base * 1.5, t, 0.04);
    this.subOsc.frequency.setTargetAtTime(base * 0.5, t, 0.04);
    const turbo = 800 + (speedKmh / 350) * 2200;
    this.turboOsc.frequency.setTargetAtTime(turbo, t, 0.08);
    const cutoff = braking ? 1200 : 1600 + (speedKmh / 350) * 2500;
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.05);
  }
}

/* ============================ Rennsimulation ============================== */
class RaceSim {
  constructor(waypointsData) {
    this.waypointsData = waypointsData;
    this.curve = null; this.trackLength = 0;
    this.cars = [];
    this.simSpeed = 1; this.isPaused = false;
    this.raceStarted = false;          // false solange Startlicht-Sequenz läuft
    this.events = [];                  // {type:'overtake'|'lap'|'finish', ...}
    this.fastestLap = { time: Infinity, carId: null };
    this.initCurve();
  }
  initCurve() {
    const pts = this.waypointsData.waypoints.map(w => new THREE.Vector3(w.x, w.z + 0.035, -w.y));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.15);
    this.trackLength = this.curve.getLength();
    console.log(`F1 Track spline: ${this.trackLength.toFixed(1)} m, ${pts.length} Punkte`);
  }
  addCar(cfg) {
    const car = {
      id: cfg.id, name: cfg.name, team: cfg.team, number: cfg.number,
      color: cfg.color, badgeColor: cfg.badgeColor || cfg.color,
      modelGroup: cfg.modelGroup, wheelMeshes: cfg.wheelMeshes || [],
      progress: cfg.initialProgress || 0,
      laneOffset: cfg.laneOffset || 0, targetLaneOffset: cfg.laneOffset || 0,
      speed: 0, targetSpeed: 0, rpm: 4200, gear: 1,
      throttle: 0, brake: 1,
      drsActive: false, drsAvailable: false,
      ersCharge: 88, ersBoost: 0,
      paceMode: 'balanced',
      skill: cfg.skill || 1.0, formPhase: Math.random() * Math.PI * 2,
      tireCompound: cfg.tireCompound || 'SOFT', tireWear: 96,
      lap: 1, currentLapTime: 0, lastLapTime: null, bestLapTime: null,
      position: cfg.initialPosition || 1, prevPosition: cfg.initialPosition || 1,
      intervalToLeader: 0, finished: false, finishTime: null,
      wheelAngle: 0, steerAngle: 0, rollAngle: 0,
      headlight: null, headlightTarget: null, tailGlow: null, frontGlow: null,
    };
    this.cars.push(car);
    return car;
  }
  setPaceMode(id, mode) { const c = this.cars.find(c => c.id === id); if (c) c.paceMode = mode; }
  deployERS(id) {
    const c = this.cars.find(c => c.id === id);
    if (c && c.ersCharge > 12 && c.ersBoost <= 0) { c.ersBoost = 4.5; return true; }
    return false;
  }
  setSimSpeed(s) { this.simSpeed = s; }
  togglePause() { this.isPaused = !this.isPaused; return this.isPaused; }
  getScaledDt(dt) { return this.isPaused ? 0 : Math.min(dt, 0.1) * this.simSpeed; }

  update(dt) {
    this.events.length = 0;
    const sdt = this.getScaledDt(dt);
    if (sdt <= 0) return;
    const step = Math.min(sdt, 0.2);
    if (this.raceStarted) {
      for (let i = 0; i < this.cars.length; i++) this.updateCarPhysics(this.cars[i], step);
    } else {
      // Aufstellung am Grid: Autos korrekt platzieren (Bremslichter an)
      for (let i = 0; i < this.cars.length; i++) {
        const c = this.cars[i];
        this.curve.getTangentAt(c.progress, _vA);
        this.applyModelTransform(c, 0, _vA);
      }
    }
    // Sortierung nach (lap + progress) → Positionen
    this.cars.sort((a, b) => (b.lap + b.progress) - (a.lap + a.progress));
    const leader = this.cars[0];
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      const newPos = i + 1;
      if (this.raceStarted && newPos !== c.prevPosition) {
        // Positionswechsel → Event für Toast/Delta
        let other = null;
        for (const o of this.cars) if (o !== c && o.position === c.prevPosition) other = o;
        this.events.push({ type: 'position', car: c, from: c.prevPosition, to: newPos, other });
        c.prevPosition = newPos;
      }
      c.position = newPos;
      if (i === 0) c.intervalToLeader = 0;
      else {
        const gapM = (leader.lap + leader.progress - (c.lap + c.progress)) * this.trackLength;
        const v = Math.max(c.speed / 3.6, 25);
        c.intervalToLeader = gapM / v;
      }
    }
  }

  updateCarPhysics(car, dt) {
    const u = car.progress;
    // Kurven-Erkennung über Tangentenwinkel (Look-Ahead)
    const tan = this.curve.getTangentAt(u, _vA);
    const tanN = this.curve.getTangentAt((u + 0.018) % 1, _vB);
    const tanF = this.curve.getTangentAt((u + 0.055) % 1, _vC);
    const a1 = tan.angleTo(tanN), a2 = tan.angleTo(tanF);
    const curveAmount = Math.max(a1, a2 * 0.85);
    let target = 335 - Math.min(1, curveAmount / 0.52) ** 0.75 * 225;

    // Pace-Modus, Skill, Formkurve, Reifenverschleiß
    let paceFactor = car.skill * (1 + 0.0055 * Math.sin(car.lap * 2.1 + car.formPhase + car.currentLapTime * 0.02));
    if (car.paceMode === 'attack') paceFactor *= 1.075;
    else if (car.paceMode === 'conserve') paceFactor *= 0.93;
    const grip = 0.965 + 0.035 * (car.tireWear / 100);
    target *= paceFactor * grip;

    // DRS-Zonen (Boxen in Weltkoordinaten)
    const p = this.curve.getPointAt(u, _vD);
    const inMainDrs = p.x > -15 && p.x < 15 && p.z > -60 && p.z < 120;
    const inBackDrs = p.x > 120 && p.x < 210 && p.z > -160 && p.z < 30;
    car.drsAvailable = inMainDrs || inBackDrs;
    car.drsActive = car.drsAvailable && car.speed > 240;
    if (car.drsActive) target += 22;

    // ERS-Boost
    if (car.ersBoost > 0) { target += 16; car.ersBoost -= dt; }

    // Verkehr: Abstand halten + schmutzige Luft
    for (const o of this.cars) {
      if (o.id === car.id) continue;
      const gapAhead = ((o.progress - car.progress + 1) % 1) * this.trackLength;
      const laneDiff = Math.abs(car.laneOffset - o.laneOffset);
      if (gapAhead > 0.05 && gapAhead < 9.5 && laneDiff < 1.8) {
        const follow = Math.max(45, o.speed * Math.min(1, gapAhead / 9.5));
        target = Math.min(target, follow);
      } else if (gapAhead > 0.05 && gapAhead < 14 && laneDiff < 1.2) {
        target -= 7; // Dirty Air
      }
    }

    // Beschleunigung / Bremse
    if (car.speed < target) {
      let accel = (car.speed < 180 ? 65 : 35) * (car.paceMode === 'attack' ? 1.2 : 1);
      if (car.ersBoost > 0) accel *= 1.35;
      car.speed += accel * dt;
      if (car.speed > target) car.speed = target;
      car.throttle = 1; car.brake = 0;
    } else {
      car.speed -= 120 * dt;
      if (car.speed < target) car.speed = target;
      car.throttle = 0.1; car.brake = 0.9;
    }

    // Fortschritt & Runden
    const du = (car.speed / 3.6 * dt) / this.trackLength;
    const prev = car.progress;
    car.progress = (car.progress + du) % 1;
    car.currentLapTime += dt;
    if (car.progress < prev) {
      car.lap += 1;
      car.lastLapTime = car.currentLapTime;
      if (!car.bestLapTime || car.lastLapTime < car.bestLapTime) car.bestLapTime = car.lastLapTime;
      car.currentLapTime = 0;
      this.events.push({ type: 'lap', car });
      if (car.lastLapTime < this.fastestLap.time) {
        this.fastestLap = { time: car.lastLapTime, carId: car.id };
        this.events.push({ type: 'fastest', car, time: car.lastLapTime });
      }
      if (car.lap > TOTAL_LAPS && !car.finished) {
        car.finished = true;
        this.events.push({ type: 'finish', car });
      }
    }

    this.updateGearsAndRpm(car);

    // Reifen & ERS
    const wear = (car.paceMode === 'attack' ? 0.25 : car.paceMode === 'conserve' ? 0.08 : 0.15) * dt;
    car.tireWear = Math.max(15, car.tireWear - wear);
    if (car.ersBoost > 0) car.ersCharge = Math.max(0, car.ersCharge - 26 * dt);
    else if (car.brake > 0.5) car.ersCharge = Math.min(100, car.ersCharge + 12 * dt);
    else if (car.paceMode === 'attack' && car.speed > 240) car.ersCharge = Math.max(5, car.ersCharge - 8 * dt);
    else if (car.paceMode === 'conserve') car.ersCharge = Math.min(100, car.ersCharge + 4 * dt);

    this.updateOvertakingAI(car, dt);
    this.applyModelTransform(car, dt, tan);
  }

  updateGearsAndRpm(car) {
    const v = car.speed;
    let g = 1, lo = 0, hi = 80;
    if (v < 80) { g = 1; lo = 0; hi = 80; }
    else if (v < 125) { g = 2; lo = 75; hi = 125; }
    else if (v < 165) { g = 3; lo = 120; hi = 165; }
    else if (v < 205) { g = 4; lo = 160; hi = 205; }
    else if (v < 245) { g = 5; lo = 200; hi = 245; }
    else if (v < 280) { g = 6; lo = 240; hi = 280; }
    else if (v < 315) { g = 7; lo = 275; hi = 315; }
    else { g = 8; lo = 310; hi = 360; }
    car.gear = g;
    const frac = clamp((v - lo) / (hi - lo), 0, 1);
    car.rpm = Math.round(7500 + frac * 5000);
  }

  updateOvertakingAI(car, dt) {
    for (const o of this.cars) {
      if (o.id === car.id) continue;
      const ahead = ((o.progress - car.progress + 1) % 1) * this.trackLength;
      const behind = ((car.progress - o.progress + 1) % 1) * this.trackLength;
      const nearest = Math.min(ahead, behind);
      const laneDiff = Math.abs(car.laneOffset - o.laneOffset);
      // Ausweichen zum Überholen
      if (ahead > 1.5 && ahead < 35 && car.speed >= o.speed * 0.97 && laneDiff < 2) {
        car.targetLaneOffset = o.laneOffset > 0 ? -2.2 : 2.2;
      }
      // Kollisionsvermeidung dicht beieinander
      if (nearest < 7.5 && laneDiff < 2.2) {
        const dir = car.laneOffset >= o.laneOffset ? 1 : -1;
        car.targetLaneOffset = o.laneOffset + dir * 2.3;
      }
    }
    car.targetLaneOffset = clamp(car.targetLaneOffset, -3.5, 3.5);
    const diff = car.targetLaneOffset - car.laneOffset;
    car.laneOffset += diff * (1 - Math.exp(-3.2 * dt));
    car.steerAngle = clamp(diff * 0.5, -0.35, 0.35);
  }

  applyModelTransform(car, dt, tangent) {
    if (!car.modelGroup) return;
    const pos = this.curve.getPointAt(car.progress, _vE);
    const right = _vF.crossVectors(tangent, _UP).normalize();
    const carPos = _vG.copy(pos).addScaledVector(right, car.laneOffset);
    car.modelGroup.position.copy(carPos);

    // Blickpunkt entlang Tangente + Lenkeinschlag
    const steer = clamp((car.targetLaneOffset - car.laneOffset) * 0.14, -0.25, 0.25);
    const look = _vH.copy(tangent).addScaledVector(right, steer).normalize();
    car.modelGroup.lookAt(_vI.copy(carPos).add(look));
    // Leichte Rollneigung in Kurven + Nick beim Bremsen
    car.modelGroup.rotateZ(-steer * 0.55);
    car.modelGroup.rotateX(car.brake > 0.5 ? 0.012 : -0.006);

    // Räder drehen
    car.wheelAngle += (car.speed / 3.6 / 0.36) * dt;
    if (car.wheelMeshes && car.wheelMeshes.length) {
      for (let i = 0; i < car.wheelMeshes.length; i++) car.wheelMeshes[i].rotation.x = car.wheelAngle;
    }

    // Scheinwerfer & Bremslicht
    if (car.headlight) {
      car.headlight.position.copy(carPos).addScaledVector(_UP, 0.62).addScaledVector(tangent, 1.9);
      car.headlightTarget.position.copy(carPos).addScaledVector(tangent, 42).addScaledVector(_UP, -1.5);
      car.headlight.target = car.headlightTarget;
    }
    if (car.tailGlow) {
      car.tailGlow.position.copy(carPos).addScaledVector(tangent, -2.45).addScaledVector(_UP, 0.55);
      car.tailGlow.material.opacity = car.brake > 0.4 ? 0.95 : (this.lightsOn ? 0.3 : 0);
    }
    if (car.frontGlow) {
      car.frontGlow.position.copy(carPos).addScaledVector(tangent, 1.95).addScaledVector(_UP, 0.6);
    }
  }
}

/* ============================ Kamera-System =============================== */
const CAM_LABELS = {
  orbit: '🎥 Free Orbit', clash: '📱 F1 Clash Cam', chase: '🏎️ Chase Cam',
  cockpit: '🏁 Onboard T-Cam', tv: '📺 TV Broadcast', drone: '🚁 Aerial Drone',
};

class CameraController {
  constructor(camera, domElement, sim) {
    this.camera = camera; this.domElement = domElement; this.sim = sim;
    this.mode = 'orbit'; this.selectedCarId = 'redbull';
    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.08;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.02;
    this.orbit.minDistance = 3; this.orbit.maxDistance = 750;
    camera.position.set(30, 42, -10);
    this.orbit.target.set(0, 5, 25);
    this.orbit.update();
    this.tvCameras = [
      { name: 'Start/Ziel Gantry', pos: new THREE.Vector3(22, 24, 30) },
      { name: 'Turn 1 Braking Tower', pos: new THREE.Vector3(-32, 26, -100) },
      { name: 'Curva Grande Kran', pos: new THREE.Vector3(75, 32, -260) },
      { name: 'Lesmo Infield', pos: new THREE.Vector3(190, 28, -130) },
      { name: 'Back Straight DRS Tower', pos: new THREE.Vector3(125, 25, 90) },
      { name: 'Ascari Chicane Flyover', pos: new THREE.Vector3(60, 28, 240) },
      { name: 'Parabolica Post', pos: new THREE.Vector3(-55, 26, 180) },
    ];
    this.currentTvIndex = 0; this.droneAngle = 0; this.shakeT = 0;
  }
  setMode(mode) {
    this.mode = mode;
    this.orbit.enabled = mode === 'orbit';
    const fov = { clash: 40, cockpit: 70, chase: 62, tv: 32, drone: 55, orbit: 55 }[mode] || 55;
    const near = { cockpit: 0.05, chase: 0.1, tv: 0.5, clash: 0.5 }[mode] || 0.1;
    this.camera.fov = fov; this.camera.near = near;
    this.camera.updateProjectionMatrix();
    if (mode === 'orbit') this.frameSelectedCar();
  }
  selectCar(id) {
    this.selectedCarId = id;
    if (this.mode === 'orbit') this.frameSelectedCar();
  }
  frameSelectedCar() {
    const c = this.sim.cars.find(c => c.id === this.selectedCarId) || this.sim.cars[0];
    if (c && c.modelGroup) {
      const p = c.modelGroup.position;
      this.orbit.target.set(p.x, p.y + 1, p.z);
      this.camera.position.set(p.x + 6, p.y + 3.5, p.z - 7);
      this.orbit.update();
    }
  }
  focusOnTrack() {
    this.setMode('orbit');
    this.orbit.target.set(80, 5, 0);
    this.camera.position.set(80, 320, 360);
    this.orbit.update();
  }
  getSelectedCar() {
    return this.sim.cars.find(c => c.id === this.selectedCarId) || this.sim.cars[0];
  }
  update(dt) {
    const car = this.getSelectedCar();
    if (!car || !car.modelGroup) {
      if (this.mode === 'orbit') this.orbit.update();
      return;
    }
    this.shakeT += dt;
    const pos = car.modelGroup.position;
    const rot = car.modelGroup.rotation;
    const fwd = _vA.set(0, 0, 1).applyEuler(rot).normalize();
    const up = _vB.set(0, 1, 0).applyEuler(rot).normalize();

    switch (this.mode) {
      case 'orbit':
        // Orbit-Ziel folgt dem ausgewählten Auto (Kamera wird mitgezogen)
        this.orbit.target.lerp(_vC.copy(pos).add(_vD.set(0, 1.1, 0)), 1 - Math.exp(-7 * dt));
        this.orbit.update();
        break;
      case 'clash': {
        const iso = _vC.set(-24, 36, -24);
        const target = _vD.copy(pos).add(iso);
        this.camera.position.lerp(target, 1 - Math.exp(-8 * dt));
        this.camera.lookAt(_vE.copy(pos).add(_vF.set(0, 1.2, 0)));
        break;
      }
      case 'chase': {
        const target = _vC.copy(pos).addScaledVector(fwd, -9).addScaledVector(up, 3.2);
        this.camera.position.lerp(target, 1 - Math.exp(-12 * dt));
        const look = _vD.copy(pos).addScaledVector(fwd, 15).addScaledVector(up, 0.8);
        this.camera.lookAt(look);
        // FOV-Kick mit Geschwindigkeit
        const fovT = 58 + car.speed * 0.035;
        this.camera.fov += (fovT - this.camera.fov) * (1 - Math.exp(-4 * dt));
        this.camera.updateProjectionMatrix();
        break;
      }
      case 'cockpit': {
        const cam = _vC.copy(fwd).multiplyScalar(-0.25).addScaledVector(up, 1.12);
        this.camera.position.copy(pos).add(cam);
        const look = _vD.copy(pos).addScaledVector(fwd, 35).addScaledVector(up, 0.55)
          .addScaledVector(_vE.crossVectors(fwd, up).normalize(), car.steerAngle * 14);
        this.camera.lookAt(look);
        // Speed-Vibration + leichte Rollneigung
        const vib = car.speed / 340;
        this.camera.position.y += Math.sin(this.shakeT * 47) * 0.018 * vib;
        this.camera.rotation.z += -car.steerAngle * 0.35 + Math.sin(this.shakeT * 31) * 0.004 * vib;
        break;
      }
      case 'tv': {
        let best = Infinity, idx = this.currentTvIndex;
        for (let i = 0; i < this.tvCameras.length; i++) {
          const d = this.tvCameras[i].pos.distanceTo(pos);
          if (d > 30 && d < 180 && d < best) { best = d; idx = i; }
        }
        this.currentTvIndex = idx;
        const cam = this.tvCameras[idx];
        this.camera.position.lerp(cam.pos, 1 - Math.exp(-6 * dt));
        const look = _vC.copy(pos).add(_vD.set(0, 1.2, 0));
        this.camera.lookAt(look);
        // Handkamera-Sway
        this.camera.rotation.x += Math.sin(this.shakeT * 0.9) * 0.0035;
        this.camera.rotation.y += Math.cos(this.shakeT * 0.7) * 0.0035;
        break;
      }
      case 'drone': {
        this.droneAngle += 0.32 * dt;
        const tx = pos.x + Math.cos(this.droneAngle) * 30;
        const tz = pos.z + Math.sin(this.droneAngle) * 30;
        const ty = pos.y + 22;
        this.camera.position.lerp(_vC.set(tx, ty, tz), 1 - Math.exp(-5 * dt));
        const look = _vD.copy(pos).addScaledVector(fwd, 8).add(_vE.set(0, 1.2, 0));
        this.camera.lookAt(look);
        break;
      }
    }
  }
}

/* ================================ Minimap ================================= */
class TrackMinimap {
  constructor(canvas, waypointsData, sim) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.waypoints = waypointsData.waypoints; this.sim = sim;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const w of this.waypoints) {
      const z = -w.y;
      if (w.x < minX) minX = w.x; if (w.x > maxX) maxX = w.x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    this.bounds = { minX, maxX, minZ, maxZ };
    this.padding = 24;
    this.bgCanvas = null;
    this.drawAcc = 0;
    this.initBackground();
  }
  worldToCanvas(x, z) {
    const W = this.canvas.width, H = this.canvas.height;
    const sx = (W - this.padding * 2) / (this.bounds.maxX - this.bounds.minX);
    const sz = (H - this.padding * 2) / (this.bounds.maxZ - this.bounds.minZ);
    const s = Math.min(sx, sz);
    const cx = (this.bounds.minX + this.bounds.maxX) / 2;
    const cz = (this.bounds.minZ + this.bounds.maxZ) / 2;
    return { x: W / 2 + (x - cx) * s, y: H / 2 + (z - cz) * s };
  }
  initBackground() {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = this.canvas.width; this.bgCanvas.height = this.canvas.height;
    const c = this.bgCanvas.getContext('2d');
    const W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = 'rgba(10, 15, 25, 0.75)';
    c.beginPath(); c.roundRect(0, 0, W, H, 16); c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.12)'; c.lineWidth = 1.5; c.stroke();
    c.beginPath();
    for (let i = 0; i < this.waypoints.length; i++) {
      const w = this.waypoints[i];
      const p = this.worldToCanvas(w.x, -w.y);
      i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y);
    }
    c.closePath();
    c.shadowColor = 'rgba(0, 180, 255, 0.6)'; c.shadowBlur = 8;
    c.strokeStyle = 'rgba(200, 225, 255, 0.85)';
    c.lineWidth = 4.5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.stroke(); c.shadowBlur = 0;
    const sf = this.worldToCanvas(0, 40);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sf.x, sf.y, 4, 0, Math.PI * 2); c.fill();
  }
  draw(dt, selectedId) {
    this.drawAcc += dt;
    if (this.drawAcc < 0.034) return;   // ~30 Hz
    this.drawAcc = 0;
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bgCanvas) c.drawImage(this.bgCanvas, 0, 0);
    for (const car of this.sim.cars) {
      if (!car.modelGroup) continue;
      const p = this.worldToCanvas(car.modelGroup.position.x, car.modelGroup.position.z);
      if (car.id === selectedId) {
        c.beginPath(); c.arc(p.x, p.y, 11, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.stroke();
      }
      c.beginPath(); c.arc(p.x, p.y, 8, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill();
      c.lineWidth = 2.5; c.strokeStyle = car.color || '#ff3333'; c.stroke();
      c.beginPath(); c.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      c.fillStyle = car.color || '#ff3333'; c.fill();
      c.font = `bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`;
      c.fillStyle = '#ffffff';
      c.fillText(`P${car.position}`, p.x + 10, p.y + 3);
    }
  }
}

/* ================================ Haupt-App =============================== */
class F1ClashGame {
  constructor() {
    this.container = el('canvas-container');
    this.loadingOverlay = el('loading-overlay');
    this.progressFill = el('progress-fill');
    this.loadingStatus = el('loading-status');
    this.scene = null; this.camera = null; this.renderer = null;
    this.lastFrameT = performance.now();
    this.sunLight = null; this.hemiLight = null;
    this.floodLights = []; this.floodGlows = [];
    this.stars = null; this.envTextures = {};
    this.todIndex = 0;
    this.todPresets = [
      {
        name: 'Tag', icon: '☀️',
        sunColor: 0xffffff, sunIntensity: 3.0, sunPos: [120, 220, 140],
        skyColor: 0x88b7ee, groundColor: 0x334a33, ambient: 1.0,
        fogColor: 0xd8e6f8, fogDensity: 0.0011, bg: 0x98b8e0,
        exposure: 1.12, envInt: 0.55, trackTemp: 32, floods: 0, starOpacity: 0,
      },
      {
        name: 'Abend', icon: '🌅',
        sunColor: 0xff9a3c, sunIntensity: 2.6, sunPos: [-180, 55, -60],
        skyColor: 0xff8e53, groundColor: 0x33261e, ambient: 0.9,
        fogColor: 0x3d2f24, fogDensity: 0.0017, bg: 0x2e1f1c,
        exposure: 1.02, envInt: 0.45, trackTemp: 24, floods: 60, starOpacity: 0.18,
      },
      {
        name: 'Nacht', icon: '🌙',
        sunColor: 0x5577cc, sunIntensity: 0.55, sunPos: [60, 150, 80],
        skyColor: 0x223366, groundColor: 0x111a28, ambient: 1.05,
        fogColor: 0x0c1226, fogDensity: 0.0021, bg: 0x050a18,
        exposure: 0.95, envInt: 0.28, trackTemp: 14, floods: 230, starOpacity: 0.9,
      },
    ];
    this.sim = null; this.cameraController = null; this.minimap = null;
    this.audio = new AudioEngine();
    this.raceState = 'loading';       // loading | lights | racing | finished
    this.lightsT = 0; this.lampsLit = 0; this.holdT = 0.6 + Math.random() * 0.9;
    this.raceTime = 0; this.deltaTimers = {}; this.overtakeCooldown = 0;
    this.headlightsOn = false;
    this.init();
  }

  async init() {
    try {
      this.setupThree();
    } catch (e) {
      this.loadingStatus.innerHTML = `<span style="color:#ff5252">WebGL nicht verfügbar: ${e.message}</span>`;
      return;
    }
    this.setupLighting();
    this.setupEnvironment();
    try {
      this.updateProgress(12, 'Lade Strecken-Geometrie & Ideallinie...');
      const wpData = await (await fetch('./track_waypoints.json')).json();
      this.sim = new RaceSim(wpData);
      this.cameraController = new CameraController(this.camera, this.renderer.domElement, this.sim);
      this.minimap = new TrackMinimap(el('minimap-canvas'), wpData, this.sim);

      this.updateProgress(34, 'Lade Blender F1 Grand Prix Rennstrecke...');
      const loader = new GLTFLoader();
      const track = await this.loadModelAsync(loader, './f1_track.glb');
      this.processTrackMesh(track.scene);
      this.scene.add(track.scene);

      this.updateProgress(55, 'Lade Red Bull Racing RB20...');
      const rb = await this.loadModelAsync(loader, './cars/car_redbull.glb');
      const rbCar = this.normalizeAndPrepareCar(rb.scene, 'redbull', 5.4);
      this.scene.add(rbCar);
      this.sim.addCar({
        id: 'redbull', name: 'M. Verstappen', team: 'Red Bull Racing #1', number: 1,
        color: '#0055ff', badgeColor: '#3671c6', modelGroup: rbCar,
        wheelMeshes: rbCar.wheelMeshes, initialProgress: 0.05, laneOffset: -1.8,
        tireCompound: 'SOFT', initialPosition: 1, skill: 1.004,
      });

      this.updateProgress(75, 'Lade Aston Martin Aramco AMR24...');
      const fe = await this.loadModelAsync(loader, './cars/car_ferrari.glb');
      const feCar = this.normalizeAndPrepareCar(fe.scene, 'ferrari', 5.5);
      this.scene.add(feCar);
      this.sim.addCar({
        id: 'ferrari', name: 'F. Alonso', team: 'Aston Martin #14', number: 14,
        color: '#00594f', badgeColor: '#00594f', modelGroup: feCar,
        wheelMeshes: feCar.wheelMeshes, initialProgress: 0.038, laneOffset: 1.8,
        tireCompound: 'MEDIUM', initialPosition: 2, skill: 0.998,
      });

      this.updateProgress(93, 'Lade Mercedes-AMG W15...');
      const me = await this.loadModelAsync(loader, './cars/car_mercedes.glb');
      const meCar = this.normalizeAndPrepareCar(me.scene, 'mercedes', 5.5);
      this.scene.add(meCar);
      this.sim.addCar({
        id: 'mercedes', name: 'L. Hamilton', team: 'Mercedes-AMG #44', number: 44,
        color: '#00f0ff', badgeColor: '#00a19c', modelGroup: meCar,
        wheelMeshes: meCar.wheelMeshes, initialProgress: 0.024, laneOffset: -1,
        tireCompound: 'HARD', initialPosition: 3, skill: 0.995,
      });

      this.updateProgress(100, 'Startaufstellung bereit!');
      this.setupCarLights();
      this.setupUI();
      this.applyTimeOfDay(this.todPresets[0]);
      this.cameraController.frameSelectedCar();

      setTimeout(() => {
        this.loadingOverlay.style.opacity = '0';
        this.loadingOverlay.style.pointerEvents = 'none';
        setTimeout(() => { this.loadingOverlay.style.display = 'none'; }, 650);
        this.armStartLights();
      }, 400);

      this.animate();
    } catch (e) {
      console.error('Error loading 3D assets:', e);
      this.loadingStatus.innerHTML = `<span style="color:#ff5252">Fehler beim Laden: ${e.message}</span>`;
    }
  }

  updateProgress(pct, text) {
    if (this.progressFill) this.progressFill.style.width = `${pct}%`;
    if (this.loadingStatus) this.loadingStatus.innerText = text;
  }
  loadModelAsync(loader, url) {
    return new Promise((res, rej) => loader.load(url, res, undefined, rej));
  }

  /* ------------------------------ Renderer ------------------------------ */
  setupThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x98b8e0);
    this.scene.fog = new THREE.FogExp2(0xd8e6f8, 0.0011);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.35, 1600);
    this.camera.position.set(30, 42, -10);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, powerPreference: 'high-performance', precision: 'highp',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));  // Pixel-Ratio-Cap
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x88b7ee, 0x334a33, 1.0);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this.sunLight.position.set(120, 220, 140);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 700;
    this.sunLight.shadow.camera.left = -280;
    this.sunLight.shadow.camera.right = 280;
    this.sunLight.shadow.camera.top = 280;
    this.sunLight.shadow.camera.bottom = -280;
    this.sunLight.shadow.bias = -0.0002;
    this.sunLight.shadow.normalBias = 0.04;
    this.scene.add(this.sunLight);
    // Flutlichtmasten (Positionen entlang der Strecke)
    const floodPos = [
      [-25, 22, 110], [-25, 22, 20], [-30, 22, -90], [35, 22, -160],
      [120, 24, -290], [255, 25, -200], [265, 24, -50], [175, 22.5, 90],
      [70, 22, 260], [-90, 22, 170],
    ];
    const glowTex = this.makeGlowTexture('rgba(255, 244, 214, 1)');
    for (const p of floodPos) {
      const s = new THREE.SpotLight(0xfff4d6, 0, 300, 1.35, 0.45, 1.4);
      s.position.set(p[0], p[1], p[2]);
      s.target.position.set(p[0] + 10, 0, p[2] + 10);
      this.scene.add(s); this.scene.add(s.target);
      this.floodLights.push(s);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xfff0c8, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.set(p[0], p[1], p[2]);
      spr.scale.set(26, 26, 1);
      this.scene.add(spr);
      this.floodGlows.push(spr);
    }
  }

  setupEnvironment() {
    // Boden
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ color: 0x18260f, roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Sternenhimmel für Nacht
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.85);
      const r = 820;
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.cos(ph) * 0.6 + 60;
      positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xbfd4ff, size: 1.7, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false,
    }));
    this.scene.add(this.stars);
  }

  makeGlowTexture(inner = 'rgba(255,255,255,1)') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner);
    g.addColorStop(0.4, inner.replace('1)', '0.45)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    return t;
  }

  // Equirect-Gradient als Environment-Map für Lack-Reflexionen
  buildEnvTexture(preset) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 256);
    const day = preset.name === 'Tag', dusk = preset.name === 'Abend';
    g.addColorStop(0, day ? '#5f83b8' : dusk ? '#241a2e' : '#04060f');
    g.addColorStop(0.52, day ? '#9cc0e8' : dusk ? '#a44a28' : '#0a1230');
    g.addColorStop(0.62, day ? '#c8dcee' : dusk ? '#ff9a4a' : '#16204a');
    g.addColorStop(0.7, day ? '#4a5a3a' : '#1a140f');
    g.addColorStop(1, '#0a0c08');
    c.fillStyle = g; c.fillRect(0, 0, 512, 256);
    // Sonnenfleck für spekulare Reflexe
    const sunX = day ? 300 : dusk ? 90 : 380;
    const sunY = day ? 92 : dusk ? 128 : 70;
    const rg = c.createRadialGradient(sunX, sunY, 2, sunX, sunY, day ? 55 : 40);
    rg.addColorStop(0, day ? 'rgba(255,255,245,0.95)' : dusk ? 'rgba(255,190,110,0.9)' : 'rgba(190,210,255,0.7)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg;
    c.beginPath(); c.arc(sunX, sunY, 60, 0, Math.PI * 2); c.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  processTrackMesh(root) {
    root.traverse((n) => {
      if (!n.isMesh) return;
      const mat = (n.material && n.material.name ? n.material.name : '').toLowerCase();
      const nm = (n.name || '').toLowerCase();
      n.castShadow = !(
        mat.includes('asphalt') || mat.includes('grass') || mat.includes('gravel') ||
        mat.includes('runoff') || mat.includes('kerb') || mat.includes('curb') ||
        mat.includes('line') || mat.includes('grid') || mat.includes('seat') ||
        nm.includes('terrain') || nm.includes('track') || nm.includes('kerb') ||
        nm.includes('curb') || nm.includes('line') || nm.includes('runoff')
      );
      n.receiveShadow = true;
      if (!n.material) return;
      (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
        m.depthWrite = true; m.depthTest = true;
        if (mat.includes('asphalt') || nm.includes('track_surface')) {
          m.roughness = 0.82; m.metalness = 0.05; m.polygonOffset = false;
        } else if (mat.includes('line') || mat.includes('grid') ||
                   nm.includes('line') || nm.includes('grid') || nm.includes('mark')) {
          m.roughness = 0.55; m.polygonOffset = true;
          m.polygonOffsetFactor = -2.5; m.polygonOffsetUnits = -2.5;
        } else if (mat.includes('kerb') || mat.includes('curb') || nm.includes('kerb') || nm.includes('curb')) {
          m.roughness = 0.45; m.polygonOffset = true;
          m.polygonOffsetFactor = -1.8; m.polygonOffsetUnits = -1.8;
        } else if (mat.includes('runoff') || mat.includes('gravel') || nm.includes('runoff') || nm.includes('gravel')) {
          m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
        } else if (mat.includes('wall') || mat.includes('concrete') || mat.includes('tecpro') || mat.includes('seat')) {
          m.roughness = 0.7;
        } else if (mat.includes('gantry') || mat.includes('armco') || mat.includes('fence') || mat.includes('steel')) {
          m.metalness = 0.85; m.roughness = 0.35;
        } else if (mat.includes('floodlight') || mat.includes('light')) {
          m.emissive = new THREE.Color(0xfff2cc); m.emissiveIntensity = 0;
          this.floodMats = this.floodMats || [];
          this.floodMats.push(m);
        } else if (nm.includes('terrain') || mat.includes('grass')) {
          m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1;
        }
      });
    });
  }

  normalizeAndPrepareCar(root, id, targetLen = 5.4) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    root.scale.set(2.05 / size.x, 1.05 / size.y, targetLen / size.z);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    const center = new THREE.Vector3(); box.getCenter(center);
    root.position.x = -center.x; root.position.z = -center.z;
    root.position.y = -box.min.y;
    root.updateMatrixWorld(true);
    const group = new THREE.Group();
    group.add(root);
    const wheels = [];
    root.traverse((n) => {
      if (!n.isMesh) return;
      const nm = (n.name || '').toLowerCase();
      if (nm.includes('wheel') || nm.includes('tire') || nm.includes('rad') || nm.includes('tyre')) wheels.push(n);
      n.castShadow = true; n.receiveShadow = true;
      if (!n.material) return;
      (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
        m.transparent = false; m.opacity = 1;
        m.depthWrite = true; m.depthTest = true; m.side = THREE.FrontSide;
        if (id === 'redbull') { m.color.setHex(0x0a1e3c); m.roughness = 0.36; m.metalness = 0.4; }
        else { m.roughness = 0.42; m.metalness = 0.3; }
        m.envMapIntensity = 1.15;
        m.needsUpdate = true;
      });
    });
    group.wheelMeshes = wheels;
    return group;
  }

  // Scheinwerfer (SpotLight) + Heck-/Bremslicht-Sprites pro Auto
  setupCarLights() {
    const redGlow = this.makeGlowTexture('rgba(255, 40, 40, 1)');
    const whiteGlow = this.makeGlowTexture('rgba(220, 235, 255, 1)');
    for (const car of this.sim.cars) {
      const head = new THREE.SpotLight(0xeaf2ff, 0, 110, 0.5, 0.55, 1.5);
      const tgt = new THREE.Object3D();
      this.scene.add(head); this.scene.add(tgt);
      head.target = tgt;
      car.headlight = head; car.headlightTarget = tgt;

      const tail = new THREE.Sprite(new THREE.SpriteMaterial({
        map: redGlow, color: 0xff2828, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      tail.scale.set(1.5, 1.0, 1);
      this.scene.add(tail);
      car.tailGlow = tail;

      const front = new THREE.Sprite(new THREE.SpriteMaterial({
        map: whiteGlow, color: 0xdfeaff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      front.scale.set(2.0, 1.1, 1);
      this.scene.add(front);
      car.frontGlow = front;
    }
  }

  /* --------------------------- Start-Lichter ----------------------------- */
  armStartLights() {
    this.raceState = 'lights';
    this.lightsT = 0; this.lampsLit = 0;
    const wrap = el('start-lights');
    wrap.classList.remove('hidden');
    wrap.querySelectorAll('.start-lamp').forEach(l => l.classList.remove('lit'));
    const txt = el('start-text');
    txt.innerText = 'STARTEN'; txt.classList.remove('go');
    el('race-flag').innerText = '🟥 RENNSTART';
    el('race-flag').className = 'race-flag';
  }
  updateStartLights(dt) {
    if (this.raceState !== 'lights') return;
    this.lightsT += dt;
    const lamps = document.querySelectorAll('.start-lamp');
    const want = Math.min(5, Math.floor(this.lightsT / 0.75) + (this.lightsT > 0.1 ? 1 : 0));
    for (let i = 0; i < lamps.length; i++) lamps[i].classList.toggle('lit', i < want);
    this.lampsLit = want;
    // Motor heult bei jedem Licht auf
    for (const car of this.sim.cars) {
      car.throttle = 0.3 + this.lampsLit * 0.12;
      car.rpm = Math.round(5000 + this.lampsLit * 1400 + Math.sin(this.lightsT * 11 + car.number) * 400);
      car.gear = 1;
    }
    if (this.lampsLit >= 5) {
      this.holdT -= dt;
      if (this.holdT <= 0) {
        this.raceState = 'racing';
        this.sim.raceStarted = true;
        const wrap = el('start-lights');
        const txt = el('start-text');
        lamps.forEach(l => l.classList.remove('lit'));
        txt.innerText = 'LOS!'; txt.classList.add('go');
        el('race-flag').innerText = '🟩 GRÜNE FLAGGE';
        el('race-flag').className = 'race-flag green';
        setTimeout(() => wrap.classList.add('hidden'), 900);
        this.showToast('🟢 Licht aus — Rennen läuft!', 2600);
      }
    }
  }

  /* ------------------------------ Toasts --------------------------------- */
  showToast(text, ms = 3400) {
    const area = el('toast-area');
    while (area.children.length >= 3) area.removeChild(area.firstChild);
    const d = document.createElement('div');
    d.className = 'toast'; d.innerText = text;
    area.appendChild(d);
    setTimeout(() => d.classList.add('out'), ms);
    setTimeout(() => d.remove(), ms + 600);
  }

  /* ------------------------------ UI Setup ------------------------------- */
  setupUI() {
    const btnSpeed = el('btn-speed'), speedLabel = el('speed-label');
    const speeds = [1, 2, 4]; let sIdx = 0;
    btnSpeed.addEventListener('click', () => {
      sIdx = (sIdx + 1) % speeds.length;
      this.sim.setSimSpeed(speeds[sIdx]);
      speedLabel.innerText = `${speeds[sIdx]}x Speed`;
    });

    const btnPause = el('btn-pause'), pauseIcon = el('pause-icon');
    btnPause.addEventListener('click', () => {
      const p = this.sim.togglePause();
      pauseIcon.innerText = p ? '▶️' : '⏸️';
      btnPause.classList.toggle('active', p);
    });

    const btnTod = el('btn-tod'), todIcon = el('tod-icon'), todLabel = el('tod-label');
    btnTod.addEventListener('click', () => {
      this.todIndex = (this.todIndex + 1) % this.todPresets.length;
      const pr = this.todPresets[this.todIndex];
      todIcon.innerText = pr.icon; todLabel.innerText = pr.name;
      this.applyTimeOfDay(pr);
    });

    const btnSound = el('btn-sound'), soundIcon = el('sound-icon'), soundLabel = el('sound-label');
    btnSound.addEventListener('click', () => {
      const on = this.audio.toggleMute();
      soundIcon.innerText = on ? '🔊' : '🔇';
      soundLabel.innerText = on ? 'Sound ON' : 'Sound OFF';
      btnSound.classList.toggle('active', on);
    });

    const btnOverview = el('btn-overview');
    btnOverview.addEventListener('click', () => {
      this.cameraController.focusOnTrack();
      this.updateActiveCamBtn('orbit');
      this.updateCamBadge();
    });

    const btnErs = el('btn-ers');
    btnErs.addEventListener('click', () => this.deploySelectedERS());

    el('btn-restart').addEventListener('click', () => location.reload());

    // Fahrerkarten → Auswahl
    document.querySelectorAll('.driver-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.driver-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.cameraController.selectCar(card.getAttribute('data-car'));
        this.syncPaceButtons();
        this.updateCamBadge();
      });
    });

    // Pace-Modus
    document.querySelectorAll('.pace-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const mode = b.getAttribute('data-pace');
        this.sim.setPaceMode(this.cameraController.selectedCarId, mode);
        this.syncPaceButtons();
        const car = this.cameraController.getSelectedCar();
        if (car) this.showToast(`⚙️ ${car.name}: Pace → ${mode.toUpperCase()}`, 2200);
      });
    });

    // Kamera-Buttons
    document.querySelectorAll('.cam-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.switchCamera(b.getAttribute('data-cam'));
      });
    });

    window.addEventListener('keydown', (e) => {
      const modes = { '1': 'orbit', '2': 'clash', '3': 'chase', '4': 'cockpit', '5': 'tv', '6': 'drone' };
      if (modes[e.key]) this.switchCamera(modes[e.key]);
      else if (e.code === 'Space') { e.preventDefault(); btnPause.click(); }
      else if (e.key === 'm' || e.key === 'M') btnSound.click();
      else if (e.key === 'o' || e.key === 'O') btnOverview.click();
      else if (e.key === 'e' || e.key === 'E') this.deploySelectedERS();
      else if (e.key === 'Tab') { e.preventDefault(); this.cycleSelectedCar(); }
    });

    this.syncPaceButtons();
    this.updateCamBadge();
  }

  deploySelectedERS() {
    const id = this.cameraController.selectedCarId;
    if (this.sim.deployERS(id)) {
      const car = this.cameraController.getSelectedCar();
      this.showToast(`⚡ ERS Boost: ${car ? car.name : id} aktiviert!`, 2400);
    }
  }

  syncPaceButtons() {
    const car = this.cameraController.getSelectedCar();
    if (!car) return;
    document.querySelectorAll('.pace-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-pace') === car.paceMode);
    });
  }

  switchCamera(mode) {
    this.cameraController.setMode(mode);
    this.updateActiveCamBtn(mode);
    this.updateCamBadge();
    const hint = el('inspection-hint');
    if (hint) hint.style.opacity = mode === 'orbit' ? '1' : '0';
  }
  updateActiveCamBtn(mode) {
    document.querySelectorAll('.cam-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-cam') === mode);
    });
  }
  updateCamBadge() {
    const badge = el('cam-badge');
    if (!badge) return;
    const car = this.cameraController.getSelectedCar();
    badge.innerText = `${CAM_LABELS[this.cameraController.mode] || ''} • ${car ? car.name : ''}`;
  }
  cycleSelectedCar() {
    const cur = this.cameraController.selectedCarId;
    const next = CAR_IDS[(CAR_IDS.indexOf(cur) + 1) % CAR_IDS.length];
    document.querySelectorAll('.driver-card').forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-car') === next);
    });
    this.cameraController.selectCar(next);
    this.syncPaceButtons();
    this.updateCamBadge();
  }

  /* --------------------------- Tageszeit --------------------------------- */
  applyTimeOfDay(pr) {
    this.sunLight.color.setHex(pr.sunColor);
    this.sunLight.intensity = pr.sunIntensity;
    this.sunLight.position.set(pr.sunPos[0], pr.sunPos[1], pr.sunPos[2]);
    this.hemiLight.color.setHex(pr.skyColor);
    this.hemiLight.groundColor.setHex(pr.groundColor);
    this.hemiLight.intensity = pr.ambient;
    this.scene.background.setHex(pr.bg);
    this.scene.fog.color.setHex(pr.fogColor);
    this.scene.fog.density = pr.fogDensity;
    this.renderer.toneMappingExposure = pr.exposure;

    // Flutlicht + Glow
    const floodsOn = pr.floods > 0;
    this.floodLights.forEach(s => { s.visible = floodsOn; s.intensity = pr.floods; });
    this.floodGlows.forEach(s => { s.material.opacity = pr.name === 'Nacht' ? 0.55 : pr.name === 'Abend' ? 0.22 : 0; });
    if (this.floodMats) this.floodMats.forEach(m => { m.emissiveIntensity = pr.name === 'Nacht' ? 1.6 : pr.name === 'Abend' ? 0.5 : 0; });

    // Sterne (Fade übernimmt animate())
    this.targetStarOpacity = pr.starOpacity;

    // Environment-Map für Reflexionen
    if (!this.envTextures[pr.name]) this.envTextures[pr.name] = this.buildEnvTexture(pr);
    this.scene.environment = this.envTextures[pr.name];
    this.scene.environmentIntensity = pr.envInt;

    // Scheinwerfer bei Abend/Nacht
    this.headlightsOn = pr.name !== 'Tag';
    this.sim.lightsOn = this.headlightsOn;
    for (const car of this.sim.cars) {
      if (car.headlight) car.headlight.intensity = this.headlightsOn ? (pr.name === 'Nacht' ? 3200 : 1600) : 0;
      if (car.frontGlow) car.frontGlow.material.opacity = this.headlightsOn ? 0.75 : 0;
    }

    // Track-Meta (Temperatur)
    const meta = el('circuit-meta');
    if (meta) meta.innerText = `F1 GP • 5.793 km • Track Temp ${pr.trackTemp}°C • Dry`;
  }

  /* ------------------------------ HUD ------------------------------------ */
  updateHUD() {
    this.dom ||= {
      speed: el('telemetry-speed'), gear: el('telemetry-gear'), rpm: el('telemetry-rpm'),
      rpmFill: el('rpm-fill'), drs: el('telemetry-drs'),
      thrPedal: el('pedal-throttle'), brkPedal: el('pedal-brake'),
      tireText: el('tire-wear-text'), tireBar: el('tire-wear-bar'),
      ersText: el('ers-charge-text'), ersBar: el('ers-charge-bar'),
      ersBtn: el('btn-ers'), ersBtnState: el('ers-btn-state'),
      lap: el('lap-counter'), raceTime: el('race-time'), raceFlag: el('race-flag'),
      gaps: { redbull: el('gap-redbull'), ferrari: el('gap-ferrari'), mercedes: el('gap-mercedes') },
      lastlaps: { redbull: el('lastlap-redbull'), ferrari: el('lastlap-ferrari'), mercedes: el('lastlap-mercedes') },
      posTags: {},
      perfFps: el('perf-fps'), perfMs: el('perf-ms'), perfDot: el('perf-dot'),
    };
    const d = this.dom;
    const sel = this.cameraController.getSelectedCar();

    if (sel) {
      d.speed.innerText = Math.round(sel.speed);
      d.gear.innerText = this.raceState === 'lights' ? '1' : sel.gear;
      d.rpm.innerText = sel.rpm.toLocaleString('de-DE');
      d.rpmFill.style.width = `${clamp((sel.rpm - 5000) / 8000, 0, 1) * 100}%`;
      d.thrPedal.style.height = `${Math.round(sel.throttle * 100)}%`;
      d.brkPedal.style.height = `${Math.round(sel.brake * 100)}%`;

      if (sel.drsActive) {
        d.drs.className = 'drs-badge active'; d.drs.innerText = 'DRS OPEN';
      } else if (sel.drsAvailable) {
        d.drs.className = 'drs-badge'; d.drs.style.color = '#00f0ff'; d.drs.innerText = 'DRS READY';
      } else {
        d.drs.className = 'drs-badge'; d.drs.style.color = 'rgba(255,255,255,0.4)'; d.drs.innerText = 'DRS';
      }

      const tw = Math.round(sel.tireWear);
      d.tireText.innerText = `${tw}%`;
      d.tireBar.style.width = `${tw}%`;
      d.tireBar.style.background = tw > 50 ? 'var(--accent-green)' : tw > 25 ? 'var(--accent-yellow)' : '#ff2a2a';
      const ec = Math.round(sel.ersCharge);
      d.ersText.innerText = `${ec}%`;
      d.ersBar.style.width = `${ec}%`;

      // ERS-Button-Zustand
      if (sel.ersBoost > 0) {
        d.ersBtn.className = 'ers-btn deploying';
        d.ersBtnState.innerText = 'BOOST!';
      } else if (sel.ersCharge > 12) {
        d.ersBtn.className = 'ers-btn'; d.ersBtnState.innerText = 'READY';
      } else {
        d.ersBtn.className = 'ers-btn empty'; d.ersBtnState.innerText = 'LADET';
      }
      this.audio.update(sel.speed, sel.rpm, sel.gear, sel.brake > 0.4);
    }

    // Leaderboard
    const leader = this.sim.cars[0];
    if (leader) {
      const shownLap = Math.min(leader.lap, TOTAL_LAPS);
      d.lap.innerText = this.raceState === 'finished' ? `Ziel • ${TOTAL_LAPS} Runden` : `Runde ${shownLap}/${TOTAL_LAPS}`;
    }
    d.raceTime.innerText = formatRaceTime(this.raceTime);

    // Karten in Positionsreihenfolge + FLIP-Animation
    this.reorderDriverCards();
    for (const car of this.sim.cars) {
      const gap = d.gaps[car.id];
      if (gap) {
        if (car.position === 1) { gap.innerText = 'LEADER'; gap.style.color = 'var(--accent-yellow)'; }
        else { gap.innerText = `+${car.intervalToLeader.toFixed(3)}s`; gap.style.color = '#ffffff'; }
      }
      const ll = d.lastlaps[car.id];
      if (ll) ll.innerText = car.lastLapTime ? formatLapTime(car.lastLapTime) : '--:--.---';
      const card = document.querySelector(`.driver-card[data-car="${car.id}"]`);
      if (card) {
        const tag = card.querySelector('.pos-tag');
        if (tag && tag.innerText !== String(car.position)) tag.innerText = car.position;
      }
      // Delta-Pfeile
      const delta = el(`delta-${car.id}`);
      if (delta && this.deltaTimers[car.id] !== undefined) {
        if (this.deltaTimers[car.id] > 0) this.deltaTimers[car.id] -= this.hudDt;
        else { delta.className = 'pos-delta'; }
      }
    }
  }

  reorderDriverCards() {
    const list = el('driver-list');
    const cards = [...list.querySelectorAll('.driver-card')];
    const byId = {};
    for (const car of this.sim.cars) byId[car.id] = car.position;
    const sorted = [...cards].sort((a, b) => byId[a.getAttribute('data-car')] - byId[b.getAttribute('data-car')]);
    const prevTops = new Map(cards.map(c => [c, c.offsetTop]));
    let changed = false;
    for (const c of sorted) { if (c !== cards[sorted.indexOf(c)]) changed = true; list.appendChild(c); }
    if (!changed) return;
    for (const c of sorted) {
      const dy = prevTops.get(c) - c.offsetTop;
      if (dy) {
        c.style.transition = 'none';
        c.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
          c.style.transition = '';
          c.style.transform = '';
        });
      }
    }
  }

  handleSimEvents() {
    for (const ev of this.sim.events) {
      if (ev.type === 'position' && this.overtakeCooldown <= 0 && this.raceState === 'racing') {
        const delta = el(`delta-${ev.car.id}`);
        if (delta) {
          delta.innerText = ev.to < ev.from ? '▲' : '▼';
          delta.className = `pos-delta ${ev.to < ev.from ? 'up' : 'down'}`;
          this.deltaTimers[ev.car.id] = 4;
        }
        if (ev.to < ev.from && ev.other) {
          this.showToast(`⚔️ ${ev.car.name} überholt ${ev.other.name} — P${ev.to}`);
          this.overtakeCooldown = 5;
        }
      } else if (ev.type === 'fastest' && this.raceState === 'racing') {
        this.showToast(`🟣 Schnellste Runde: ${ev.car.name} — ${formatLapTime(ev.time)}`, 3000);
      } else if (ev.type === 'finish') {
        if (ev.car.position === 1 && this.raceState === 'racing') this.finishRace(ev.car);
      }
    }
    if (this.overtakeCooldown > 0) this.overtakeCooldown -= this.hudDt;
  }

  finishRace(winner) {
    this.raceState = 'finished';
    const flag = el('race-flag');
    flag.innerText = '🏁 ZIELFLAGGE'; flag.className = 'race-flag checkered';
    this.showToast(`🏁 ${winner.name} gewinnt den Grand Prix!`, 4200);
    setTimeout(() => {
      const banner = el('finish-banner');
      el('finish-title').innerText = `🏆 ${winner.name} siegt!`;
      const res = el('finish-results');
      res.innerHTML = '';
      const medals = ['🥇', '🥈', '🥉'];
      for (const car of this.sim.cars) {
        const row = document.createElement('div');
        row.className = `finish-row${car.position === 1 ? ' p1' : ''}`;
        const time = car.position === 1 ? formatRaceTime(this.raceTime) : `+${car.intervalToLeader.toFixed(3)}s`;
        row.innerHTML = `<span class="finish-pos">${medals[car.position - 1] || 'P' + car.position}</span>` +
          `<span class="finish-name">${car.name}</span>` +
          `<span class="finish-time">${car.finished ? time : time + ' (läuft)'}</span>`;
        res.appendChild(row);
      }
      banner.classList.remove('hidden');
    }, 1600);
  }

  /* --------------------------- Perf-Monitor ------------------------------ */
  updatePerformanceStats(dt) {
    this.frameCount = (this.frameCount || 0) + 1;
    this.fpsTimeAcc = (this.fpsTimeAcc || 0) + dt;
    if (this.fpsTimeAcc >= 0.4) {
      const fps = Math.min(144, Math.round(this.frameCount / this.fpsTimeAcc));
      const ms = ((this.fpsTimeAcc / this.frameCount) * 1000).toFixed(1);
      const d = this.dom;
      if (d && d.perfFps) d.perfFps.innerText = `${fps} FPS`;
      if (d && d.perfMs) d.perfMs.innerText = `${ms} ms`;
      if (d && d.perfDot) {
        const col = fps >= 48 ? 'var(--accent-green)' : fps >= 28 ? 'var(--accent-yellow)' : 'var(--f1-red)';
        d.perfDot.style.backgroundColor = col;
        d.perfDot.style.boxShadow = `0 0 8px ${col}`;
      }
      this.frameCount = 0; this.fpsTimeAcc = 0;
    }
  }

  /* ------------------------------- Loop ---------------------------------- */
  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameT) / 1000, 0.1);
    this.lastFrameT = now;
    this.hudDt = dt;
    this.updatePerformanceStats(dt);

    if (this.sim) {
      this.updateStartLights(this.sim.getScaledDt(dt));
      this.sim.update(dt);
      if (this.raceState === 'racing' || this.raceState === 'finished') {
        this.raceTime += this.sim.getScaledDt(dt);
      }
      this.handleSimEvents();
    }
    if (this.cameraController) this.cameraController.update(dt);
    if (this.minimap) this.minimap.draw(dt, this.cameraController ? this.cameraController.selectedCarId : null);

    // Sternen-Fade
    if (this.stars && this.targetStarOpacity !== undefined) {
      const m = this.stars.material;
      m.opacity += (this.targetStarOpacity - m.opacity) * (1 - Math.exp(-1.6 * dt));
      this.stars.visible = m.opacity > 0.02;
      this.stars.rotation.y += dt * 0.004;
    }

    this.hudTimer = (this.hudTimer || 0) + dt;
    if (this.hudTimer >= 0.066) { this.updateHUD(); this.hudTimer = 0; }

    this.renderer.render(this.scene, this.camera);
  }
}

/* --------------------------------- Boot ----------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  window.__f1app = new F1ClashGame();
});
