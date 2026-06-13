// ============================================================
// NYXARA — audio system
// the drone under everything
// ============================================================

// sub / mid drone frequencies per city (Hz)
const CITY_FREQS = {
  'BERLIN':      [45, 90],
  'TOKYO':       [48, 96],
  'MEXICO CITY': [43, 86],
  'NEW YORK':    [46, 92],
  'LONDON':      [44, 88],
  'TBILISI':     [42, 84],
};

const FADE_IN = 2.0;
const FADE_OUT = 1.0;

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.nodes = null;
    this.unlocked = false;
  }

  // must be called from a user gesture — the door click
  unlock() {
    if (!this.ctx) {
      const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
                 (typeof globalThis !== 'undefined' && globalThis.AudioContext);
      if (!AC) return false;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
    this.unlocked = true;
    return true;
  }

  getFreqs(cityData) {
    return CITY_FREQS[cityData.name] || [44, 88];
  }

  startAmbient(cityData) {
    if (!this.unlocked && !this.unlock()) return;
    if (this.nodes) this.stopAmbient(0.25);

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const [subHz, midHz] = this.getFreqs(cityData);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.5, now + FADE_IN); // 2s fade in

    // gentle lowpass keeps the drone subterranean
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.Q.setValueAtTime(0.6, now);

    // sub bass drone
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(subHz, now);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.42, now);

    // mid drone, slightly detuned pair for the slow beat-frequency shimmer
    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(midHz, now);
    mid.detune.setValueAtTime(-5, now);
    const mid2 = ctx.createOscillator();
    mid2.type = 'triangle';
    mid2.frequency.setValueAtTime(midHz, now);
    mid2.detune.setValueAtTime(6, now);
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.085, now);

    // slow LFO breathes the whole drone like a distant kick bleeding through walls
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.9, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.08, now);

    sub.connect(subGain);
    subGain.connect(filter);
    mid.connect(midGain);
    mid2.connect(midGain);
    midGain.connect(filter);
    filter.connect(master);
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    master.connect(ctx.destination);

    sub.start(now);
    mid.start(now);
    mid2.start(now);
    lfo.start(now);

    this.nodes = { master, filter, sub, mid, mid2, lfo, subGain, midGain, lfoGain };
  }

  stopAmbient(fade = FADE_OUT) {
    if (!this.nodes || !this.ctx) return;
    const n = this.nodes;
    this.nodes = null;
    const now = this.ctx.currentTime;

    n.master.gain.cancelScheduledValues && n.master.gain.cancelScheduledValues(now);
    n.master.gain.setValueAtTime(n.master.gain.value || 0.5, now);
    n.master.gain.linearRampToValueAtTime(0.0001, now + fade); // 1s fade out

    const stopAt = now + fade + 0.1;
    for (const osc of [n.sub, n.mid, n.mid2, n.lfo]) {
      try { osc.stop(stopAt); } catch (e) { /* already stopped */ }
    }
    const cleanup = () => {
      for (const node of Object.values(n)) {
        try { node.disconnect(); } catch (e) { /* detached */ }
      }
    };
    if (typeof setTimeout !== 'undefined') {
      setTimeout(cleanup, (fade + 0.2) * 1000);
    } else {
      cleanup();
    }
  }
}
