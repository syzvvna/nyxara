// node test/test-menu-audio.mjs
import { installDom } from './dom-stub.mjs';
import { strict as assert } from 'node:assert';

const { document, window } = installDom();
const { CITIES } = await import('../src/data/cities.js');
const { RadialMenu } = await import('../src/components/radialMenu.js');
const { AudioSystem } = await import('../src/utils/audio.js');

// ---------------- radial menu ----------------
let picked = -1;
const menu = new RadialMenu(CITIES, (i) => { picked = i; });

assert.equal(menu.items.length, 6, 'six entries');
menu.items.forEach((item, i) => {
  assert.equal(item.children[0].textContent, CITIES[i].name, 'city name');
  assert.equal(item.children[1].textContent, CITIES[i].coordinates, 'coordinates under the name');
  assert.equal(item.style['--c'], CITIES[i].colors.primary, 'city color variable');
  assert.ok(item.style['--ax'] !== undefined && item.style['--ay'] !== undefined, 'arc offsets set');
});

// arc: vertical offsets spread symmetrically, x bulges right of the edge anchor
const ys = menu.items.map((it) => parseFloat(it.style['--ay']));
assert.ok(ys[0] < 0 && ys[5] > 0, 'arc spreads vertically');
assert.ok(Math.abs(ys[0] + ys[5]) < 1, 'arc symmetric');
const xs = menu.items.map((it) => parseFloat(it.style['--ax']));
assert.ok(Math.max(...xs) <= 0.01, 'arc curves back toward the edge');
assert.ok(xs[2] > xs[0], 'middle names bulge out the most');

menu.items[3].dispatch('click');
assert.equal(picked, 3, 'click fires onCitySelect(index)');

menu.setActiveCity(2);
assert.ok(menu.items[2].classList.contains('active'));
assert.ok(!menu.items[3].classList.contains('active'));
menu.show();
assert.ok(menu.root.classList.contains('visible'));
menu.hide();
assert.ok(!menu.root.classList.contains('visible'));

// ---------------- audio ----------------
class StubParam {
  constructor(v) { this.value = v; this.events = []; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); }
  cancelScheduledValues() {}
}
class StubNode {
  constructor(kind) {
    this.kind = kind;
    this.connections = [];
    this.gain = new StubParam(1);
    this.frequency = new StubParam(0);
    this.detune = new StubParam(0);
    this.Q = new StubParam(0);
  }
  connect(n) { this.connections.push(n); }
  disconnect() {}
  start() { this.started = true; }
  stop(t) { this.stoppedAt = t; }
}
class StubAudioContext {
  constructor() { this.currentTime = 10; this.state = 'running'; this.destination = new StubNode('dest'); }
  createGain() { return new StubNode('gain'); }
  createOscillator() { return new StubNode('osc'); }
  createBiquadFilter() { return new StubNode('filter'); }
  resume() { this.state = 'running'; }
}

// no AudioContext available → graceful no-op (no sound before it CAN exist)
const silent = new AudioSystem();
silent.startAmbient(CITIES[0]);
assert.equal(silent.nodes, null, 'no context → no nodes, no throw');

// audio context only on user gesture: unlock() is that gesture
window.AudioContext = StubAudioContext;
const audio = new AudioSystem();
assert.equal(audio.ctx, null, 'no context before gesture');
assert.ok(audio.unlock(), 'gesture unlocks');
assert.ok(audio.ctx instanceof StubAudioContext, 'context created on gesture');

// per-city frequencies
const expect = { 'BERLIN': [45, 90], 'TOKYO': [48, 96], 'MEXICO CITY': [43, 86], 'NEW YORK': [46, 92], 'LONDON': [44, 88], 'TBILISI': [42, 84] };
for (const c of CITIES) {
  assert.deepEqual(audio.getFreqs(c), expect[c.name], `${c.name} Hz`);
}

audio.startAmbient(CITIES[0]); // Berlin 45/90
const n = audio.nodes;
assert.ok(n, 'drone running');
assert.equal(n.sub.frequency.value, 45, 'sub at 45Hz');
assert.equal(n.mid.frequency.value, 90, 'mid at 90Hz');
assert.ok(n.mid.detune.value < 0 && n.mid2.detune.value > 0, 'mid pair slightly detuned');
const fadeIn = n.master.gain.events.find((e) => e[0] === 'ramp');
assert.equal(fadeIn[2], 12, 'fade-in completes at now+2s');
assert.ok(fadeIn[1] > 0.1, 'fades up to audible');
assert.ok(n.sub.started && n.mid.started && n.lfo.started, 'oscillators started');
assert.ok(n.master.connections.includes(audio.ctx.destination), 'master → destination');
assert.equal(n.lfo.frequency.value, 0.9, 'slow LFO breathing');

// stop: 1s fade-out then oscillators stop
const held = n;
audio.stopAmbient();
assert.equal(audio.nodes, null, 'nodes released');
const fadeOut = held.master.gain.events.filter((e) => e[0] === 'ramp').pop();
assert.equal(fadeOut[2], 11, 'fade-out completes at now+1s');
assert.ok(fadeOut[1] < 0.001, 'fades to silence');
assert.ok(held.sub.stoppedAt >= 11, 'sub stops after the fade');

// switching cities restarts the drone at new frequencies
audio.startAmbient(CITIES[5]); // Tbilisi 42/84
assert.equal(audio.nodes.sub.frequency.value, 42, 'Tbilisi sub 42Hz');
audio.stopAmbient();

console.log('✓ radialMenu.js — 6-city arc, hover colors, select callback, active state');
console.log('✓ audio.js — gesture-gated context, per-city Hz, 2s fade-in, 1s fade-out');
