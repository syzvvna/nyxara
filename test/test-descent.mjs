// node test/test-descent.mjs
import THREE from './three-env.mjs';
import { strict as assert } from 'node:assert';

const { DescentScene } = await import('../src/scenes/descent.js');

const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 200);
const d = new DescentScene(camera);

assert.ok(d.scene.children.length > 3, 'tunnel populated');
assert.equal(d.streaks.geometry.attributes.position.count, 520, '260 streak lines (2 verts each)');
assert.equal(d.rings.length, 16, 'tunnel rings');

// full descent: 20 → 1.7 in 3s with easing and exactly one completion
let done = 0;
d.play('#f472b6', () => done++);
assert.equal(camera.position.y, 20, 'starts at y=20');
assert.equal(d.streakMat.color.getHexString(), 'f472b6', 'tunnel tinted by fromColor');

d.update(100.0); // first frame locks start time
assert.equal(camera.position.y, 20, 't=0 still at top');

d.update(100.3);
const early = camera.position.y;
d.update(101.5);
const mid = camera.position.y;
assert.ok(early > 18.4, `easeIn: barely moved early (y=${early.toFixed(2)})`);
assert.ok(mid < 12 && mid > 9, `midpoint near centre (y=${mid.toFixed(2)})`);
assert.ok(camera.fov > 62 + 15, 'FOV pumped at peak speed');
assert.ok(d.streaks.scale.y > 2, 'streaks smeared into trails at speed');

d.update(102.9);
assert.ok(camera.position.y < 2.4, 'almost landed');
assert.equal(done, 0, 'not complete yet');

d.update(103.05);
assert.equal(done, 1, 'onComplete fired once');
assert.ok(Math.abs(camera.position.y - 1.7) < 1e-9, 'landed at eye height 1.7');
assert.ok(Math.abs(camera.fov - 62) < 1e-9, 'FOV restored');
assert.equal(d.active, false);
assert.equal(camera.rotation.z, 0, 'roll settled');

d.update(104); // inert after completion
assert.equal(done, 1, 'no double fire');

// reverse: 1.7 → 20
let rose = 0;
d.playReverse(() => rose++);
assert.ok(Math.abs(camera.position.y - 1.7) < 1e-9, 'reverse starts at floor');
d.update(200);
d.update(201.5);
assert.ok(camera.position.y > 9, 'rising');
d.update(203.2);
assert.equal(rose, 1, 'reverse completes');
assert.ok(Math.abs(camera.position.y - 20) < 1e-9, 'back at the sky');

console.log('✓ descent.js — 3s eased fall 20→1.7, FOV pump, streak smear, clean reverse');
