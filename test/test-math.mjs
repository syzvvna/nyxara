// node test/test-math.mjs
import { lerp, clamp, easeInOut, easeIn, easeOut, project3Dto2D, hexToRgb } from '../src/utils/math.js';
import { strict as assert } from 'node:assert';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// lerp / clamp
assert.equal(lerp(0, 10, 0.5), 5);
assert.equal(lerp(-4, 4, 0.25), -2);
assert.equal(clamp(5, 0, 3), 3);
assert.equal(clamp(-5, 0, 3), 0);
assert.equal(clamp(2, 0, 3), 2);

// easing: endpoints, midpoint, monotonic
for (const fn of [easeInOut, easeIn, easeOut]) {
  assert.ok(close(fn(0), 0), `${fn.name}(0)=0`);
  assert.ok(close(fn(1), 1), `${fn.name}(1)=1`);
  let prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const v = fn(t);
    assert.ok(v >= prev - 1e-9, `${fn.name} monotonic at ${t}`);
    prev = v;
  }
}
assert.ok(close(easeInOut(0.5), 0.5));
assert.ok(easeIn(0.25) < 0.25, 'easeIn slow start');
assert.ok(easeOut(0.25) > 0.25, 'easeOut fast start');

// projection: point straight ahead (camera looks down -z at angle 0)
const W = 1000, H = 800, FOV = Math.PI / 3;
const ahead = project3Dto2D(0, -10, 0, W, H, FOV);
assert.ok(ahead, 'point ahead is visible');
assert.ok(close(ahead.sx, 500), 'dead ahead → screen center x');
assert.ok(ahead.sy > H / 2, 'ground point below horizon');
assert.ok(close(ahead.dist, 10));

// behind camera → null
assert.equal(project3Dto2D(0, 10, 0, W, H, FOV), null, 'behind camera culled');

// after a 180° turn the same point is now visible
const turned = project3Dto2D(0, 10, Math.PI, W, H, FOV);
assert.ok(turned && close(turned.sx, 500, 1e-6), '180° yaw sees the back point');

// point to the right lands right of center
const right = project3Dto2D(5, -10, 0, W, H, FOV);
assert.ok(right.sx > 500, 'right point → right half');

// nearer points project larger
const near = project3Dto2D(0, -5, 0, W, H, FOV);
assert.ok(near.scale > ahead.scale, 'closer → larger scale');

// hexToRgb
assert.deepEqual(hexToRgb('#8b5cf6'), { r: 139, g: 92, b: 246 });
assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
assert.deepEqual(hexToRgb('f59e0b'), { r: 245, g: 158, b: 11 });

console.log('✓ math.js — lerp/clamp/easing/projection/hex all correct');
