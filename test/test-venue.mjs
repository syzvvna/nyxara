// node test/test-venue.mjs — loads all six venues headless
import THREE from './three-env.mjs';
import { installDom, StubElement } from './dom-stub.mjs';
import { strict as assert } from 'node:assert';

const { document } = installDom();
const { VenueScene } = await import('../src/scenes/venue.js');
const { CITIES } = await import('../src/data/cities.js');

const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 200);
const venue = new VenueScene({}, camera);

// every city loads: fog, architecture, systems, correct density
for (const city of CITIES) {
  venue.load(city);
  assert.ok(venue.scene.fog, `${city.name}: fog present`);
  assert.ok(Math.abs(venue.scene.fog.density - 0.038) < 1e-9, `${city.name}: FogExp2 density 0.038`);
  assert.equal(venue.scene.fog.isFogExp2, true, `${city.name}: FogExp2 type`);
  assert.equal(venue.crowd.figures.length, city.crowdDensity, `${city.name}: ${city.crowdDensity} dancers`);
  assert.equal(venue.lasers.lasers.length, 12, `${city.name}: 12 lasers`);
  assert.equal(venue.particles.count, 300, `${city.name}: 300 particles`);
  assert.ok(venue.arch.children.length >= 5, `${city.name}: architecture built (${venue.arch.children.length} pieces)`);
  assert.ok(venue.dj, `${city.name}: DJ on the booth`);

  // crowd carries the city accent
  assert.equal(venue.crowd.rimMat.color.getHexString(), city.colors.primary.slice(1), `${city.name}: crowd rim color`);

  venue.update(1.0);
  venue.update(2.0);
}

// city-specific signatures
venue.load(CITIES[2]); // MEXICO CITY
assert.ok(venue.torches && venue.torches.length === 6, 'Mexico: six torches');
assert.ok(venue.torches.filter((t) => t.light).length === 3, 'Mexico: three torch lights');
venue.load(CITIES[1]); // TOKYO
assert.ok(venue.gridMat, 'Tokyo: ceiling laser grid');
venue.load(CITIES[4]); // LONDON
let torusCount = 0;
venue.arch.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry') torusCount++; });
assert.equal(torusCount, 5, 'London: five brick arch ribs');

// reloading fully replaces the previous environment
const beforeChildren = venue.scene.children.length;
venue.load(CITIES[0]);
assert.ok(Math.abs(venue.scene.children.length - beforeChildren) <= 1, 'no scene-graph leak across loads');

// controls: drag rotates camera via lerp, pitch clamped
const stage = new StubElement('canvas');
venue.setupControls(stage);
venue.show(CITIES[0]);

stage.dispatch('pointerdown', { clientX: 500, clientY: 400 });
stage.dispatch('pointermove', { clientX: 300, clientY: 400 }); // drag left 200px
stage.dispatch('pointerup', {});
assert.ok(venue.targetYaw > 0.5, `drag sets yaw target (${venue.targetYaw.toFixed(3)})`);
const yawBefore = venue.yaw;
venue.update(3.0);
const step1 = venue.yaw - yawBefore;
assert.ok(step1 > 0, 'yaw lerps toward target');
assert.ok(Math.abs(step1 - (venue.targetYaw - yawBefore) * 0.055) < 1e-9, 'lerp factor 0.055');

// pitch clamp: drag way down and way up
stage.dispatch('pointerdown', { clientX: 0, clientY: 0 });
stage.dispatch('pointermove', { clientX: 0, clientY: 4000 });
stage.dispatch('pointerup', {});
assert.ok(Math.abs(venue.targetPitch - (-15 * Math.PI / 180)) < 1e-6, 'pitch clamped at -15°');
stage.dispatch('pointerdown', { clientX: 0, clientY: 4000 });
stage.dispatch('pointermove', { clientX: 0, clientY: -4000 });
stage.dispatch('pointerup', {});
assert.ok(Math.abs(venue.targetPitch - (25 * Math.PI / 180)) < 1e-6, 'pitch clamped at +25°');

// touch path works too
venue.targetYaw = 0; venue.yaw = 0;
stage.dispatch('touchstart', { touches: [{ clientX: 100, clientY: 100 }] });
stage.dispatch('touchmove', { touches: [{ clientX: 50, clientY: 100 }] });
stage.dispatch('touchend', {});
assert.ok(venue.targetYaw > 0.1, 'touch drag rotates');

// head bob: y = 1.7 + sin(t*0.8)*0.012
venue.update(10);
const expected = 1.7 + Math.sin(10 * 0.8) * 0.012;
assert.ok(Math.abs(camera.position.y - expected) < 1e-9, 'head bob formula exact');

// calm kills bob and strobe
let strobeVal = null;
venue.onStrobe = (v) => { strobeVal = v; };
venue.setCalm(true);
venue.update(11);
assert.ok(Math.abs(camera.position.y - 1.7) < 1e-9, 'calm: no head bob');
assert.equal(strobeVal, 0, 'calm: strobe forced off');
assert.equal(venue.crowd.calm, 0.35, 'calm reaches crowd');
venue.setCalm(false);

// strobe stays under 0.5 Hz
let flashes = 0;
let prev = 0;
venue._nextStrobe = 12;
for (let t = 12; t < 32; t += 0.016) {
  venue.update(t);
  if (strobeVal > 0 && prev === 0) flashes++;
  prev = strobeVal;
}
assert.ok(flashes <= 10 && flashes >= 4, `strobe ≤0.5Hz over 20s (got ${flashes})`);

// show/hide manage the body venue class
venue.hide();
assert.ok(!document.body.classList.contains('in-venue'), 'hide removes venue class');
venue.show(CITIES[3]);
assert.ok(document.body.classList.contains('in-venue'), 'show adds venue class');
assert.equal(venue.city.name, 'NEW YORK', 'show(city) loads when different');

console.log('✓ venue.js — 6 venues, fog 0.038, architecture, controls, bob, calm, ≤0.5Hz strobe');
