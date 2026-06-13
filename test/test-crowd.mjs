// node test/test-crowd.mjs — exercises the crowd system headless
import THREE from './three-env.mjs';
import { strict as assert } from 'node:assert';

const { CrowdSystem, BODY_TYPES, buildLoneFigure } = await import('../src/components/crowd.js');

// body type table matches the spec exactly
assert.equal(Object.keys(BODY_TYPES).length, 7, 'seven body types');
assert.deepEqual(BODY_TYPES['tall-slim'], { sw: 0.32, ww: 0.18, hw: 0.22, hs: 0.12, ht: 1.72 });
assert.deepEqual(BODY_TYPES['curvy'], { sw: 0.30, ww: 0.19, hw: 0.35, hs: 0.13, ht: 1.55 });

const scene = new THREE.Scene();
const crowd = new CrowdSystem(scene, '#8b5cf6', 150);

// exact population
assert.equal(crowd.figures.length, 150, '150 figures for density 150');
assert.equal(crowd.root.children.length, 150, '150 groups in scene graph');
assert.ok(scene.children.includes(crowd.root), 'crowd added to scene');

// every figure is a real extruded silhouette with arms on pivots
let extrudeCount = 0;
for (const f of crowd.figures) {
  const meshes = [];
  f.group.traverse((o) => o.isMesh && meshes.push(o));
  assert.ok(meshes.length >= 4, 'body + rim + two arms at minimum');
  for (const m of meshes) {
    assert.equal(m.geometry.type, 'ExtrudeGeometry', 'no cylinders, no spheres, no boxes');
    extrudeCount++;
  }
  assert.ok(f.lPivot.position.x < 0 && f.rPivot.position.x > 0, 'pivots at shoulders');
  assert.ok(f.lPivot.position.y > 1.0, 'shoulder pivots at shoulder height');
  assert.equal(typeof f.phase, 'number');
  assert.equal(typeof f.speed, 'number');
  assert.equal(typeof f.armRaise, 'boolean');
  assert.ok(f.bodyType in BODY_TYPES, 'valid body type');
}
console.log(`  ${extrudeCount} extruded meshes, all ExtrudeGeometry`);

// all 7 body types present in the crowd
const used = new Set(crowd.figures.map((f) => f.bodyType));
assert.equal(used.size, 7, `all 7 body types present (got ${[...used].join(', ')})`);

// rim meshes use BackSide + scale 1.06
const rims = [];
crowd.root.traverse((o) => {
  if (o.isMesh && o.material.side === THREE.BackSide) rims.push(o);
});
assert.ok(rims.length >= 150, 'every figure has a backface rim');
assert.ok(Math.abs(rims[0].scale.y - 1.06) < 1e-9, 'rim scaled 1.06');

// ring distribution: radii cluster around 2.2 / 4.0 / 6.5 / 9.5
const radii = crowd.figures.map((f) => Math.hypot(f.group.position.x, f.group.position.z));
const ringCenters = [2.2, 4.0, 6.5, 9.5];
for (const r of radii) {
  const nearest = Math.min(...ringCenters.map((c) => Math.abs(r - c)));
  assert.ok(nearest <= 0.9, `figure radius ${r.toFixed(2)} belongs to a ring`);
}
for (const c of ringCenters) {
  const inRing = radii.filter((r) => Math.abs(r - c) <= 0.9).length;
  assert.ok(inRing >= 8, `ring ${c} populated (${inRing})`);
}

// animation: bob/sway/arms move and are never synchronized
crowd.update(1.0);
const y1 = crowd.figures.map((f) => f.group.position.y);
const a1 = crowd.figures.map((f) => f.lPivot.rotation.z);
crowd.update(1.6);
const y2 = crowd.figures.map((f) => f.group.position.y);
assert.ok(y1.some((y, i) => Math.abs(y - y2[i]) > 1e-4), 'bodies bob over time');
assert.ok(Math.max(...y1.map(Math.abs)) <= 0.025 + 1e-9, 'bob amplitude per spec');
const distinct = new Set(y1.map((y) => y.toFixed(6)));
assert.ok(distinct.size > 100, `figures desynchronized (${distinct.size} distinct phases)`);

// raised vs hanging arms behave differently
const raised = crowd.figures.find((f) => f.armRaise);
const hanging = crowd.figures.find((f) => !f.armRaise);
assert.ok(raised && hanging, 'both arm modes exist');
assert.ok(Math.abs(raised.lPivot.rotation.z) > 1.8, 'raised arms point up');
assert.ok(Math.abs(hanging.lPivot.rotation.z) < 0.5, 'hanging arms stay down');
assert.ok(a1.some((a, i) => Math.abs(a - crowd.figures[i].lPivot.rotation.z) > 1e-5), 'arms animate');

// torso sway within spec amplitude
assert.ok(Math.max(...crowd.figures.map((f) => Math.abs(f.wrap.rotation.z))) <= 0.04 + 1e-9, 'sway ≤ 0.04');

// color swap reaches shared materials
crowd.setColor('#f59e0b');
assert.equal(crowd.rimMat.color.getHexString(), 'f59e0b');
assert.equal(crowd.bodyMat.emissive.getHexString(), 'f59e0b');

// calm mode damps motion
crowd.setCalm(true);
crowd.update(2.0);
assert.ok(Math.max(...crowd.figures.map((f) => Math.abs(f.group.position.y))) <= 0.025 * 0.35 + 1e-9, 'calm damps bob');
crowd.setCalm(false);

// show / hide
crowd.hide();
assert.equal(crowd.root.visible, false);
crowd.show();
assert.equal(crowd.root.visible, true);

// lone figure (DJ) builder
const dj = buildLoneFigure('#ef4444', 'tall-broad');
assert.ok(dj.group.children.length >= 4, 'DJ has body, rim, two arm pivots');
assert.ok(Math.abs(dj.ht - 1.78) < 1e-9);

// silhouette sanity: extruded body bounding box matches the body plan
const tallSlim = crowd.figures.find((f) => f.bodyType === 'tall-slim');
let bodyMesh = null;
tallSlim.wrap.traverse((o) => {
  if (o.isMesh && o.material.side !== THREE.BackSide && !bodyMesh && o.parent === tallSlim.wrap) bodyMesh = o;
});
bodyMesh.geometry.computeBoundingBox();
const bb = bodyMesh.geometry.boundingBox;
const height = bb.max.y - bb.min.y;
const width = bb.max.x - bb.min.x;
assert.ok(Math.abs(height - 1.72) < 0.06, `tall-slim height ≈ 1.72 (got ${height.toFixed(3)})`);
assert.ok(width < 0.5 && width > 0.28, `tall-slim width sane (got ${width.toFixed(3)})`);

// different body types produce genuinely different geometry
const g1 = crowd.figures.find((f) => f.bodyType === 'petite');
const g2 = crowd.figures.find((f) => f.bodyType === 'tall-broad');
let m1, m2;
g1.wrap.traverse((o) => { if (o.isMesh && !m1) m1 = o; });
g2.wrap.traverse((o) => { if (o.isMesh && !m2) m2 = o; });
assert.notEqual(m1.geometry, m2.geometry, 'distinct geometry per body type');

crowd.dispose();
assert.ok(!scene.children.includes(crowd.root), 'dispose removes crowd');

console.log('✓ crowd.js — 150 silhouettes, 7 body types, rings, rims, desynced motion');
