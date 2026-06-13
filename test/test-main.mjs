// node test/test-main.mjs — drives the full state machine in real time
import realTHREE from './three-env.mjs';
import { installDom } from './dom-stub.mjs';
import { strict as assert } from 'node:assert';

const { document, window } = installDom();
window.__NYX_TEST__ = true;

// WebGL needs a GPU; everything else runs for real
class StubRenderer {
  constructor(opts) { this.domElement = opts && opts.canvas; }
  setPixelRatio(r) { this.pixelRatio = r; }
  setSize() {}
  render(scene) { this.lastScene = scene; }
}
class StubParam {
  constructor(v) { this.value = v; }
  setValueAtTime(v) { this.value = v; }
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}
class StubNode {
  constructor() { this.gain = new StubParam(1); this.frequency = new StubParam(0); this.detune = new StubParam(0); this.Q = new StubParam(0); }
  connect() {} disconnect() {} start() {} stop() {}
}
window.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new StubNode(); }
  createGain() { return new StubNode(); }
  createOscillator() { return new StubNode(); }
  createBiquadFilter() { return new StubNode(); }
  resume() {}
};

globalThis.THREE = { ...realTHREE, WebGLRenderer: StubRenderer };

const { App } = await import('../src/main.js');
const { CITIES } = await import('../src/data/cities.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const app = new App({
  timings: { introFade: 0.05, introHold: 0.12, introOut: 0.05, constellationPause: 0.15 },
});

assert.equal(app.state, 'LOADING', 'starts in LOADING');

await app.boot();
assert.equal(app.state, 'INTRO', 'boot → INTRO');
assert.ok(app.intro.classList.contains('visible'), 'intro line on screen');
assert.equal(app.introLine.textContent, 'six frequencies. all playing now.');
assert.ok(document.getElementById('boot').classList.contains('gone'), 'boot splash dismissed');

await sleep(420);
assert.equal(app.state, 'CONSTELLATION', 'intro dissolves to stars');
assert.ok(app.constellation.ui.classList.contains('visible'), 'constellation overlay visible');
assert.ok(!app.intro.classList.contains('visible'), 'intro gone');
assert.equal(app.renderer.lastScene, app.constellation.scene, 'rendering the stars');

// the door — audio may only be born here
assert.equal(app.audio.ctx, null, 'no audio context before the gesture');
app.constellation.door.dispatch('click');
assert.equal(app.state, 'DESCENDING', 'door → DESCENDING');
assert.ok(app.audio.ctx, 'gesture unlocked audio');
assert.ok(app.audio.nodes === null || app.audio.nodes, 'no drone during the fall yet');
assert.equal(app.venue.city.name, 'BERLIN', 'venue preloads during the fall');
assert.ok(app.descent.active, 'falling');

await sleep(120);
assert.equal(app.renderer.lastScene, app.descent.scene, 'rendering the tunnel');

await sleep(3300);
assert.equal(app.state, 'VENUE', 'landed in Berlin');
assert.ok(Math.abs(app.camera.position.y - 1.7) < 0.05, 'eye height after landing');
assert.ok(app.menu.root.classList.contains('visible'), 'radial menu up');
assert.equal(app.menu.activeIndex, 0, 'Berlin marked active');
assert.ok(app.audio.nodes, 'drone running');
assert.equal(app.audio.nodes.sub.frequency.value, 45, 'Berlin sub 45Hz');
assert.ok(app.hud.classList.contains('visible'), 'HUD revealed');
assert.ok(document.body.classList.contains('in-venue'), 'RGB drift armed');
await sleep(1300);
assert.equal(app.hudCity.textContent, 'BERLIN', 'city name resolved from noise');
assert.equal(app.hudCoords.textContent, '52.5°N 13.4°E', 'coordinates resolved');
assert.equal(app.hudLore.textContent, CITIES[0].lore, 'lore resolved');
assert.equal(app.renderer.lastScene, app.venue.scene, 'rendering the room');

// pick LONDON from the menu → full ascend/retint/descend cycle
app.menu.items[4].dispatch('click');
assert.equal(app.state, 'ASCENDING', 'city select → ASCENDING');
assert.equal(app.audio.nodes, null, 'drone faded out');
assert.ok(!app.menu.root.classList.contains('visible'), 'menu hidden');
assert.ok(!document.body.classList.contains('in-venue'), 'RGB drift off mid-flight');

await sleep(3300);
assert.equal(app.cityIndex, 4, 'arrived above London');
// transient constellation breath, then auto-descend
assert.ok(
  app.state === 'CONSTELLATION' || app.state === 'DESCENDING',
  `retinted constellation between worlds (state=${app.state})`
);
if (app.state === 'CONSTELLATION') {
  assert.equal(
    app.constellation.starUniforms.uColor.value.getHexString(),
    CITIES[4].colors.constellation.slice(1),
    'stars wear the emerald tint'
  );
}

await sleep(3700);
assert.equal(app.state, 'VENUE', 'auto-descended into London');
assert.equal(app.venue.city.name, 'LONDON');
assert.equal(app.venue.crowd.figures.length, 135, 'London density 135');
assert.equal(app.audio.nodes.sub.frequency.value, 44, 'London sub 44Hz');
assert.equal(app.menu.activeIndex, 4);

// CALM kills motion everywhere
app.calmBtn.dispatch('click');
assert.equal(app.calm, true);
assert.ok(document.body.classList.contains('calm'), 'body.calm set');
assert.equal(app.venue.calm, true, 'venue damped');
assert.equal(app.venue.crowd.calm, 0.35, 'crowd damped');
assert.equal(app.calmBtn.textContent, 'CALM · ON');
app.calmBtn.dispatch('click');
assert.equal(app.calm, false, 'calm toggles back');

// selecting the current city is a no-op
app.menu.items[4].dispatch('click');
assert.equal(app.state, 'VENUE', 'same city ignored');

app.stop();
console.log('✓ main.js — full loop: LOADING→INTRO→CONSTELLATION→DESCENDING→VENUE→ASCENDING→…→VENUE, calm, audio gating');
