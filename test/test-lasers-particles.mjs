// node test/test-lasers-particles.mjs
import THREE from './three-env.mjs';
import { strict as assert } from 'node:assert';

const { LaserSystem } = await import('../src/components/lasers.js');
const { ParticleSystem } = await import('../src/components/particles.js');

// ---------------- lasers ----------------
const scene = new THREE.Scene();
const lasers = new LaserSystem(scene, '#8b5cf6', 12);

assert.equal(lasers.lasers.length, 12, 'twelve rigs');
const spots = [];
scene.traverse((o) => o.isSpotLight && spots.push(o));
assert.equal(spots.length, 12, 'twelve SpotLights in scene');
for (const l of lasers.lasers) {
  assert.ok(Math.abs(l.light.position.y - 5.2) < 1e-9, 'rigs at ceiling height 5.2');
  const r = Math.hypot(l.light.position.x, l.light.position.z);
  assert.ok(Math.abs(r - 4.6) < 1e-6, 'rigs arranged in a circle');
}

// sweep + intensity behaviour
lasers.update(0);
const t0 = lasers.lasers.map((l) => l.target.position.x);
lasers.update(2.5);
const t1 = lasers.lasers.map((l) => l.target.position.x);
assert.ok(t0.some((x, i) => Math.abs(x - t1[i]) > 0.01), 'targets sweep over time');
for (const l of lasers.lasers) {
  assert.ok(l.light.intensity >= 0.9 - 1e-9 && l.light.intensity <= 2.7 + 1e-9, `intensity in band (${l.light.intensity})`);
}
// independent timing: phases differ
const phases = new Set(lasers.lasers.map((l) => l.phase.toFixed(5)));
assert.ok(phases.size >= 11, 'independent per-laser phase');

lasers.setColor('#34d399');
assert.equal(lasers.lasers[0].light.color.getHexString(), '34d399');
assert.equal(lasers.lasers[5].beamMat.color.getHexString(), '34d399');

lasers.hide();
assert.equal(lasers.root.visible, false);
lasers.show();
assert.equal(lasers.root.visible, true);
lasers.dispose();
assert.ok(!scene.children.includes(lasers.root));

// ---------------- particles ----------------
const scene2 = new THREE.Scene();
const parts = new ParticleSystem(scene2, '#f59e0b', 300);

assert.equal(parts.geometry.attributes.position.count, 300, '300 particles');
assert.ok(scene2.children.includes(parts.points));

const arr = parts.geometry.attributes.position.array;
const before = Array.from(arr);
parts.update(0);
parts.update(0.5); // dt = 0.5 clamps to 16ms guard… use steps
parts.update(0.55);
parts.update(0.6);
let rose = 0;
for (let i = 0; i < 300; i++) {
  if (arr[i * 3 + 1] > before[i * 3 + 1]) rose++;
}
assert.ok(rose > 250, `particles drift upward (${rose}/300 rose)`);

// ceiling wrap: force one particle high and step
arr[1] = 5.49;
const sp = parts.speeds[0];
parts.speeds[0] = 10;
parts.update(0.65);
assert.ok(arr[1] <= 0.2, 'particle wraps back to the floor');
parts.speeds[0] = sp;

parts.setColor('#ef4444');
assert.equal(parts.material.color.getHexString(), 'ef4444');
parts.hide();
assert.equal(parts.points.visible, false);
parts.show();
parts.dispose();
assert.ok(!scene2.children.includes(parts.points));

console.log('✓ lasers.js — 12 sweeping rigs at y=5.2, intensity band, color swap');
console.log('✓ particles.js — 300 rising motes, ceiling wrap, color swap');
