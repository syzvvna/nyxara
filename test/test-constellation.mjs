// node test/test-constellation.mjs
import THREE from './three-env.mjs';
import { installDom } from './dom-stub.mjs';
import { strict as assert } from 'node:assert';

const { document } = installDom();
const { ConstellationScene } = await import('../src/scenes/constellation.js');

const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 200);
const scene = new ConstellationScene({ /* renderer unused headless */ }, camera);

// 200 stars with per-star attributes
const geo = scene.stars.geometry;
assert.equal(geo.attributes.position.count, 200, '200 star points');
assert.ok(geo.attributes.aSize, 'per-star size attribute');
assert.ok(geo.attributes.aPhase, 'per-star breathing phase');
assert.ok(geo.attributes.aDrift, 'per-star drift');
const sizes = new Set(Array.from(geo.attributes.aSize.array).map((s) => s.toFixed(4)));
assert.ok(sizes.size > 150, 'sizes vary per star');

// stars form a disc in front of the camera
const pos = geo.attributes.position.array;
for (let i = 0; i < 200; i++) {
  assert.ok(pos[i * 3 + 2] < -10, 'stars hang in front of the camera');
  assert.ok(Math.hypot(pos[i * 3], pos[i * 3 + 1]) <= 27, 'disc bounded');
}

// nebula wash present
assert.equal(scene.nebulae.length, 3, 'nebula planes');

// slow group rotation over time
scene.update(0);
const r0 = scene.starGroup.rotation.z;
scene.update(10);
assert.ok(scene.starGroup.rotation.z > r0, 'group rotates slowly');
assert.ok(scene.starGroup.rotation.z - r0 < 0.5, '…but slowly');
assert.equal(scene.starUniforms.uTime.value, 10, 'shader time driven');

// overlay structure: title with glowing X, taglines, door
assert.ok(scene.ui, 'overlay built');
assert.match(scene.title.innerHTML, /NY<span class="nyx-x">X<\/span>ARA/, 'X is its own glowing span');
assert.equal(scene.sub.textContent, 'the night has coordinates');
assert.equal(scene.whisper.textContent, 'you were never supposed to find this');
assert.match(scene.door.innerHTML, /door-sigil/, 'door carries the sigil');
assert.match(scene.door.innerHTML, /keystone|M71 22/, 'door has a keystone');
assert.match(scene.door.innerHTML, /<svg/, 'door is SVG');

// door click fires onEnter only when visible
let entered = 0;
scene.onEnter = () => entered++;
scene.door.dispatch('click');
assert.equal(entered, 0, 'hidden door is inert');
scene.show('#7c3aed');
assert.ok(scene.visible);
assert.ok(scene.ui.classList.contains('visible'));
scene.door.dispatch('click');
assert.equal(entered, 1, 'door click fires onEnter');
assert.ok(scene.door.classList.contains('opening'));

// tint reaches stars, nebula and door glow
scene.setTint('#f87171');
assert.equal(scene.starUniforms.uColor.value.getHexString(), 'f87171');
assert.equal(scene.ui.style['--door-glow'], '#f87171');

scene.hide();
assert.equal(scene.visible, false);
assert.ok(!scene.ui.classList.contains('visible'));

console.log('✓ constellation.js — 200 breathing stars, nebula, title, ornate door, onEnter');
