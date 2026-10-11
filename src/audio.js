/**
 * All sound is synthesised with WebAudio: no audio files to ship.
 * Browsers only allow audio after a user gesture, so `init()` is called on
 * the first key press.
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  /** Low drone + wind that loops for the whole game. */
  startAmbient() {
    const c = this.ctx;
    this.ambient = c.createGain();
    this.ambient.gain.value = 0;
    this.ambient.gain.linearRampToValueAtTime(1, c.currentTime + 3);
    this.ambient.connect(this.master);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const droneGain = c.createGain();
    droneGain.gain.value = 0.05;
    lp.connect(droneGain).connect(this.ambient);
    for (const f of [55, 55.35, 82.4]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }

    // Wind: filtered noise with a slowly wandering band.
    const noise = c.createBufferSource();
    noise.buffer = this.noiseBuffer(3);
    noise.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 450;
    bp.Q.value = 0.7;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(bp.frequency);
    lfo.start();
    const windGain = c.createGain();
    windGain.gain.value = 0.035;
    noise.connect(bp).connect(windGain).connect(this.ambient);
    noise.start();

    // A warm pad that only fades in for the ending.
    this.pad = c.createGain();
    this.pad.gain.value = 0;
    this.pad.connect(this.master);
    for (const f of [261.6, 329.6, 392, 523.3]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = 0.025;
      o.connect(g).connect(this.pad);
      o.start();
    }
  }

  noiseBuffer(seconds) {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** One enveloped oscillator note. */
  tone(freq, dur, { type = 'sine', vol = 0.1, delay = 0, slideTo = null, attack = 0.01 } = {}) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseHit(dur, vol, freq = 800) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  // ------------------------------------------------------------ game sounds

  jump() { this.noiseHit(0.08, 0.05, 1200); }
  land() { this.noiseHit(0.1, 0.07, 500); }

  orb() {
    this.tone(880, 0.5, { vol: 0.08 });
    this.tone(1318.5, 0.7, { vol: 0.05, delay: 0.07 });
  }

  checkpoint() {
    [392, 493.9, 587.3, 784].forEach((f, i) =>
      this.tone(f, 1.6, { vol: 0.05, delay: i * 0.09, attack: 0.05 }));
  }

  lanternOut() { this.tone(330, 1.2, { type: 'triangle', vol: 0.08, slideTo: 80 }); }

  heartbeat() {
    this.tone(62, 0.16, { vol: 0.35, slideTo: 40 });
    this.tone(58, 0.16, { vol: 0.22, delay: 0.19, slideTo: 38 });
  }

  death() { this.tone(180, 1.4, { type: 'triangle', vol: 0.1, slideTo: 45 }); }

  exit() {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.tone(f, 1.2, { vol: 0.05, delay: i * 0.12 }));
  }

  /** Each child the lanterns connect to plays the next note of a rising chord. */
  connect(index) {
    const notes = [523.3, 659.3, 784, 1046.5, 1318.5];
    const f = notes[index % notes.length];
    this.tone(f, 2.2, { vol: 0.07, attack: 0.03 });
    this.tone(f / 2, 2.5, { vol: 0.05, attack: 0.1 });
  }

  /** Warm pad swell for the final scene. */
  finale() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.pad.gain.cancelScheduledValues(t);
    this.pad.gain.setValueAtTime(this.pad.gain.value, t);
    this.pad.gain.linearRampToValueAtTime(1, t + 5);
    this.ambient.gain.linearRampToValueAtTime(0.25, t + 5);
  }

  resetMood() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.pad.gain.cancelScheduledValues(t);
    this.pad.gain.linearRampToValueAtTime(0, t + 2);
    this.ambient.gain.cancelScheduledValues(t);
    this.ambient.gain.linearRampToValueAtTime(1, t + 2);
  }
}
