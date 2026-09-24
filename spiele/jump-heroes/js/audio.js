'use strict';

const Audio = (() => {
  let ctx = null;
  let master = null, musicGain = null, sfxGain = null;
  let currentTrack = null;
  let schedTimer = null;
  let stepIdx = 0;
  let nextTime = 0;

  const MUSIC = {
    menu:   { bpm: 84, bassType: 'triangle', leadType: 'sine',     bass: [36, null, 43, null, 40, null, 43, null], lead: [72, 76, 79, 76, 74, 77, 81, 77] },
    green:  { bpm: 116, bassType: 'square',    leadType: 'square',   bass: [36, 36, 43, 36, 41, 41, 45, 41], lead: [72, null, 76, 79, null, 76, 74, null] },
    ice:    { bpm: 100, bassType: 'triangle', leadType: 'triangle', bass: [33, null, 40, 33, 38, null, 45, 38], lead: [69, 72, 76, 72, 71, 74, 78, 74] },
    volcano:{ bpm: 128, bassType: 'sawtooth',  leadType: 'square',   bass: [34, 34, 41, 34, 36, 36, 43, 36], lead: [70, 73, 77, 73, 75, 78, 82, 78] }
  };

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.connect(master);
      sfxGain.connect(master);
      master.connect(ctx.destination);
      applyVolumes();
      if (currentTrack) playMusic(currentTrack);
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function applyVolumes() {
    if (!ctx) return;
    const s = Save.data.settings;
    master.gain.value = s.master;
    musicGain.gain.value = s.music * 0.5;
    sfxGain.gain.value = s.sfx;
  }

  function tone(dest, t, dur, freq, type, vol, slideTo) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function scheduler() {
    if (!ctx || !currentTrack) return;
    const def_ = MUSIC[currentTrack];
    const stepDur = 60 / def_.bpm / 2;
    while (nextTime < ctx.currentTime + 0.35) {
      const b = def_.bass[stepIdx % def_.bass.length];
      const l = def_.lead[stepIdx % def_.lead.length];
      if (b != null) tone(musicGain, nextTime, stepDur * 0.95, midi(b), def_.bassType, 0.16);
      if (l != null) tone(musicGain, nextTime, stepDur * 0.8, midi(l), def_.leadType, 0.07);
      if (stepIdx % 2 === 1) tone(musicGain, nextTime, 0.03, 6000, 'square', 0.015);
      nextTime += stepDur;
      stepIdx++;
    }
  }

  function playMusic(key) {
    currentTrack = key;
    stepIdx = 0;
    if (!ctx) return;
    nextTime = ctx.currentTime + 0.1;
    if (schedTimer) clearInterval(schedTimer);
    schedTimer = setInterval(scheduler, 90);
  }

  function stopMusic() {
    currentTrack = null;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  const SFX = {
    click(t)  { tone(sfxGain, t, 0.07, 660, 'square', 0.12); },
    jump(t)   { tone(sfxGain, t, 0.14, 320, 'square', 0.1, 640); },
    coin(t)   { tone(sfxGain, t, 0.07, 1319, 'triangle', 0.14); tone(sfxGain, t + 0.06, 0.16, 1760, 'triangle', 0.14); },
    hurt(t)   { tone(sfxGain, t, 0.22, 220, 'sawtooth', 0.18, 70); },
    stomp(t)  { tone(sfxGain, t, 0.12, 200, 'square', 0.16, 60); },
    spring(t) { tone(sfxGain, t, 0.22, 240, 'square', 0.13, 980); },
    death(t)  { tone(sfxGain, t, 0.4, 400, 'sawtooth', 0.16, 60); },
    win(t)    { [523, 659, 784, 1047].forEach((f, i) => tone(sfxGain, t + i * 0.11, 0.22, f, 'square', 0.13)); },
    star(t, i){ tone(sfxGain, t, 0.18, 880 + i * 260, 'triangle', 0.15); },
    buy(t)    { [784, 1047].forEach((f, i) => tone(sfxGain, t + i * 0.09, 0.15, f, 'triangle', 0.15)); },
    deny(t)   { tone(sfxGain, t, 0.16, 180, 'square', 0.14, 120); },
    key(t)    { [988, 1319, 1568].forEach((f, i) => tone(sfxGain, t + i * 0.07, 0.14, f, 'triangle', 0.13)); },
    door(t)   { tone(sfxGain, t, 0.35, 300, 'sawtooth', 0.1, 80); },
    check(t)  { [659, 880].forEach((f, i) => tone(sfxGain, t + i * 0.08, 0.16, f, 'square', 0.1)); },
    bosshit(t){ tone(sfxGain, t, 0.25, 160, 'sawtooth', 0.2, 50); },
    bossdie(t){ [392, 330, 262, 196].forEach((f, i) => tone(sfxGain, t + i * 0.13, 0.28, f, 'sawtooth', 0.17)); },
    shield(t) { tone(sfxGain, t, 0.2, 520, 'triangle', 0.15, 260); }
  };

  function sfx(name, arg) {
    if (!ctx || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.001, arg);
  }

  document.addEventListener('pointerdown', () => init(), { passive: true });
  document.addEventListener('keydown', () => init(), { passive: true });

  return { init, applyVolumes, playMusic, stopMusic, sfx };
})();
