/* ==========================================================================
   LUMINA AUDIO ENGINE - Polyphonic Web Audio Synthesizer & Dynamic SFX
   ========================================================================== */

class LuminaAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filterNode = null;
    this.enabled = true;
    this.musicActive = false;
    this.currentZone = 0;
    this.step = 0;
    this.nextNoteTime = 0;
    this.bpm = 124;
    this.comboNoteIndex = 0;
    this.lastShardTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    this.ctx = new AudioContext();
    
    // Master Limiter / Compressor to avoid harsh clipping
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Dynamic Lowpass Filter (for pause/muffled effects)
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.setValueAtTime(18000, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(1.2, this.ctx.currentTime);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

    // Routing: Source -> Filter -> Compressor -> Master Gain -> Destination
    this.filterNode.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.nextNoteTime = this.ctx.currentTime + 0.1;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.24 : 0, this.ctx.currentTime, 0.04);
    }
    return this.enabled;
  }

  setMuffled(muffled) {
    if (!this.filterNode || !this.ctx) return;
    const targetFreq = muffled ? 600 : 18000;
    this.filterNode.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
  }

  // Pure Polyphonic Tone Generator
  playTone({ freq, duration = 0.2, type = "sine", volume = 0.2, slide = 0, delay = 0, detune = 0, attack = 0.01 }) {
    if (!this.ctx || !this.enabled) return;
    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime(detune, startTime);

    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  // Noise Burst Generator (for impacts, whooshes, steam, stomp)
  playNoise({ duration = 0.15, volume = 0.2, filterFreq = 1200, decay = 0.1, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const startTime = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * decay));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(filterFreq, startTime);
    noiseFilter.Q.setValueAtTime(1.8, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(this.filterNode);

    noiseSource.start(startTime);
  }

  // Rich SFX Palette
  playSFX(name) {
    if (!this.ctx || !this.enabled) return;

    switch (name) {
      case "jump":
        this.playTone({ freq: 280, duration: 0.18, type: "sine", volume: 0.22, slide: 260 });
        this.playTone({ freq: 140, duration: 0.12, type: "triangle", volume: 0.15, slide: 120 });
        break;

      case "double_jump":
        this.playTone({ freq: 520, duration: 0.22, type: "triangle", volume: 0.25, slide: 340 });
        this.playTone({ freq: 1040, duration: 0.18, type: "sine", volume: 0.18, slide: 400, delay: 0.03 });
        this.playNoise({ duration: 0.1, volume: 0.08, filterFreq: 3000 });
        break;

      case "dash":
        this.playNoise({ duration: 0.22, volume: 0.28, filterFreq: 1800, decay: 0.12 });
        this.playTone({ freq: 380, duration: 0.18, type: "sawtooth", volume: 0.12, slide: -180 });
        this.playTone({ freq: 80, duration: 0.2, type: "sine", volume: 0.3, slide: 60 });
        break;

      case "wall_slide":
        this.playNoise({ duration: 0.08, volume: 0.06, filterFreq: 900 });
        break;

      case "wall_jump":
        this.playTone({ freq: 320, duration: 0.16, type: "square", volume: 0.16, slide: 280 });
        this.playTone({ freq: 640, duration: 0.18, type: "sine", volume: 0.2, slide: 200, delay: 0.02 });
        break;

      case "stomp":
        this.playTone({ freq: 110, duration: 0.22, type: "square", volume: 0.35, slide: -65 });
        this.playNoise({ duration: 0.18, volume: 0.28, filterFreq: 600, decay: 0.08 });
        break;

      case "ground_pound":
        this.playTone({ freq: 75, duration: 0.35, type: "sine", volume: 0.45, slide: -30 });
        this.playNoise({ duration: 0.3, volume: 0.35, filterFreq: 450, decay: 0.18 });
        break;

      case "shard": {
        const now = Date.now();
        if (now - this.lastShardTime < 450) {
          this.comboNoteIndex = (this.comboNoteIndex + 1) % 6;
        } else {
          this.comboNoteIndex = 0;
        }
        this.lastShardTime = now;
        const scale = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C Major pentatonic high
        const baseFreq = scale[this.comboNoteIndex];
        this.playTone({ freq: baseFreq, duration: 0.16, type: "sine", volume: 0.22 });
        this.playTone({ freq: baseFreq * 1.5, duration: 0.12, type: "triangle", volume: 0.15, delay: 0.04 });
        break;
      }

      case "relic": {
        const relicScale = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        relicScale.forEach((f, i) => {
          this.playTone({ freq: f, duration: 0.5, type: "triangle", volume: 0.25, slide: 20, delay: i * 0.08 });
          this.playTone({ freq: f * 2, duration: 0.4, type: "sine", volume: 0.15, delay: i * 0.08 + 0.02 });
        });
        break;
      }

      case "hurt":
        this.playTone({ freq: 240, duration: 0.28, type: "sawtooth", volume: 0.28, slide: -160 });
        this.playNoise({ duration: 0.22, volume: 0.25, filterFreq: 800 });
        break;

      case "bumper":
        this.playTone({ freq: 220, duration: 0.28, type: "sine", volume: 0.3, slide: 550 });
        this.playTone({ freq: 440, duration: 0.25, type: "triangle", volume: 0.2, slide: 400, delay: 0.03 });
        break;

      case "geyser":
        this.playNoise({ duration: 0.35, volume: 0.18, filterFreq: 1500, decay: 0.25 });
        break;

      case "boss_laser":
        this.playTone({ freq: 700, duration: 0.4, type: "sawtooth", volume: 0.22, slide: -400 });
        this.playNoise({ duration: 0.3, volume: 0.2, filterFreq: 2400 });
        break;

      case "boss_slam":
        this.playTone({ freq: 65, duration: 0.6, type: "square", volume: 0.4, slide: -25 });
        this.playNoise({ duration: 0.45, volume: 0.4, filterFreq: 350 });
        break;

      case "checkpoint":
        [440, 554.37, 659.25, 880].forEach((f, i) => {
          this.playTone({ freq: f, duration: 0.3, type: "sine", volume: 0.18, delay: i * 0.07 });
        });
        break;

      case "victory": {
        const victoryChords = [
          [523.25, 659.25, 783.99],
          [587.33, 739.99, 880.00],
          [659.25, 830.61, 987.77],
          [783.99, 987.77, 1174.66, 1567.98]
        ];
        victoryChords.forEach((chord, step) => {
          chord.forEach(f => {
            this.playTone({ freq: f, duration: 0.65, type: "triangle", volume: 0.2, delay: step * 0.18 });
            this.playTone({ freq: f * 0.5, duration: 0.65, type: "sine", volume: 0.15, delay: step * 0.18 });
          });
        });
        break;
      }
    }
  }

  // Dynamic Multi-Zone Polyphonic BGM Track Generator
  updateMusic(zone, isBoss = false) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    
    // Scale profiles per zone
    // Zone 0: Grove (Mystical A Minor / C Major)
    // Zone 1: Cavern (Deep D Dorian / F Major)
    // Zone 2: Citadel (Heroic E Minor driving pulse)
    // Boss: Fast Chromatic / Phrygian Battle Theme
    
    const scales = {
      0: [
        [220, 261.63, 329.63, 392],    // Am7
        [174.61, 220, 261.63, 329.63], // Fmaj7
        [261.63, 329.63, 392, 523.25], // C
        [196, 246.94, 293.66, 392]     // G
      ],
      1: [
        [146.83, 220, 293.66, 349.23], // Dm
        [116.54, 174.61, 233.08, 293.66], // Bb
        [98, 146.83, 196, 246.94],     // Gm
        [110, 164.81, 220, 277.18]     // A7
      ],
      2: [
        [164.81, 246.94, 329.63, 392], // Em
        [130.81, 196, 261.63, 329.63], // C
        [146.83, 220, 293.66, 369.99], // D
        [123.47, 185, 246.94, 293.66]  // Bm
      ],
      boss: [
        [110, 155.56, 220, 311.13], // Diminished A
        [116.54, 164.81, 233.08, 329.63], // Bb Phrygian
        [98, 138.59, 196, 277.18],
        [123.47, 174.61, 246.94, 349.23]
      ]
    };

    const stepDuration = isBoss ? 0.16 : 0.24;
    const currentScale = isBoss ? scales.boss : (scales[zone] || scales[0]);

    while (this.nextNoteTime < now + 0.15) {
      const chordIndex = Math.floor(this.step / 8) % currentScale.length;
      const chord = currentScale[chordIndex];
      const noteInChord = chord[this.step % chord.length];

      // Bassline Pulse
      const bassFreq = chord[0] * 0.5;
      if (this.step % 2 === 0) {
        this.playTone({
          freq: bassFreq,
          duration: stepDuration * 1.4,
          type: isBoss ? "sawtooth" : "triangle",
          volume: isBoss ? 0.09 : 0.07,
          delay: Math.max(0, this.nextNoteTime - now)
        });
      }

      // Arpeggiated Melody Lead
      const leadFreq = noteInChord * (isBoss ? 2 : 1.5);
      this.playTone({
        freq: leadFreq,
        duration: stepDuration * 0.8,
        type: "sine",
        volume: 0.045,
        delay: Math.max(0, this.nextNoteTime - now)
      });

      // Background Soft Pad Chord on measure start
      if (this.step % 8 === 0) {
        chord.forEach(f => {
          this.playTone({
            freq: f,
            duration: stepDuration * 7.5,
            type: "sine",
            volume: 0.025,
            attack: 0.15,
            delay: Math.max(0, this.nextNoteTime - now)
          });
        });
      }

      this.nextNoteTime += stepDuration;
      this.step++;
    }
  }
}

// Global Export
window.LuminaAudioEngine = LuminaAudioEngine;
