/**
 * FORGEFRONT 3D - AUDIO ENGINE (Web Audio API Synthesizer & SFX)
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this._ambientStarted = false;
        this._ambientNodes = null;
        this._lastChimeAt = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.startAmbient();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this._ambientNodes) {
            const t = this.ctx ? this.ctx.currentTime : 0;
            this._ambientNodes.gain.gain.cancelScheduledValues(t);
            this._ambientNodes.gain.gain.linearRampToValueAtTime(this.enabled ? 0.05 : 0.0001, t + 0.4);
        }
        return this.enabled;
    }

    /** Very quiet factory drone — starts on first user-gesture audio init. */
    startAmbient() {
        if (this._ambientStarted || !this.ctx) return;
        this._ambientStarted = true;
        try {
            const t = this.ctx.currentTime;
            const master = this.ctx.createGain();
            master.gain.setValueAtTime(0.0001, t);
            master.gain.linearRampToValueAtTime(this.enabled ? 0.05 : 0.0001, t + 2.5);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 220;

            // two slow detuned oscillators = distant machinery hum
            const o1 = this.ctx.createOscillator();
            o1.type = 'sawtooth';
            o1.frequency.value = 55;   // A1
            const o2 = this.ctx.createOscillator();
            o2.type = 'triangle';
            o2.frequency.value = 82.4; // E2

            const g1 = this.ctx.createGain(); g1.gain.value = 0.5;
            const g2 = this.ctx.createGain(); g2.gain.value = 0.4;
            o1.connect(g1); g1.connect(filter);
            o2.connect(g2); g2.connect(filter);
            filter.connect(master);
            master.connect(this.ctx.destination);

            // gentle slow swell so the hum breathes
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 0.09;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.02;
            lfo.connect(lfoGain);
            lfoGain.connect(master.gain);

            o1.start(); o2.start(); lfo.start();
            this._ambientNodes = { gain: master, oscs: [o1, o2, lfo] };
        } catch (e) { /* audio unsupported — ignore */ }
    }

    playClick() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playPlaceBelt() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playBuildMachine() {
        if (!this.enabled) return;
        this.init();
        // Heavy metallic clank
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.18);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(280, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.2);
        osc2.stop(this.ctx.currentTime + 0.2);
    }

    playGoldChime() {
        if (!this.enabled) return;
        this.init();
        // throttle: massive deliveries would otherwise stack dozens of dings
        const now = performance.now();
        if (now - this._lastChimeAt < 110) return;
        this._lastChimeAt = now;
        // High crystal coin ding
        const notes = [1046.5, 1318.5, 1567.98]; // C6, E6, G6
        const freq = notes[Math.floor(Math.random() * notes.length)];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }

    playError() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(130, this.ctx.currentTime);
        osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.09);
        gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.16);
    }

    playContractNew() {
        if (!this.enabled) return;
        this.init();
        // soft double-ding: a clipboard offer arriving
        [659.25, 987.77].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.09);
            gain.gain.setValueAtTime(0.13, this.ctx.currentTime + i * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.09 + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.09);
            osc.stop(this.ctx.currentTime + i * 0.09 + 0.3);
        });
    }

    playContractDone() {
        if (!this.enabled) return;
        this.init();
        // bright payout arpeggio
        [523.25, 659.25, 880, 1174.66].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.07);
            gain.gain.setValueAtTime(0.14, this.ctx.currentTime + i * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.07 + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.07);
            osc.stop(this.ctx.currentTime + i * 0.07 + 0.25);
        });
    }

    playVictory() {
        if (!this.enabled) return;
        this.init();
        // triumphant fanfare: rising chords
        const seq = [
            [261.63, 329.63, 392.0],   // C
            [293.66, 369.99, 440.0],   // D
            [329.63, 415.30, 493.88],  // E
            [392.0, 523.25, 659.25]    // C major high
        ];
        seq.forEach((chord, ci) => {
            chord.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + ci * 0.22);
                const at = this.ctx.currentTime + ci * 0.22;
                gain.gain.setValueAtTime(0.0001, at);
                gain.gain.linearRampToValueAtTime(0.07, at + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(at);
                osc.stop(at + 0.55);
            });
        });
    }

    playDemolish() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playUpgrade() {
        if (!this.enabled) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.06);

            gain.gain.setValueAtTime(0.15, this.ctx.currentTime + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.06 + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + idx * 0.06);
            osc.stop(this.ctx.currentTime + idx * 0.06 + 0.2);
        });
    }
}

window.soundEngine = new SoundEngine();
