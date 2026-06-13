// node test/test-cities.mjs — validates the city registry shape
import { CITIES } from '../src/data/cities.js';
import { strict as assert } from 'node:assert';

assert.equal(CITIES.length, 6, 'six cities');

const HEX = /^#[0-9a-f]{6}$/i;
const names = [];

for (const c of CITIES) {
  for (const k of ['name', 'venue', 'tag', 'lore', 'coordinates', 'architecture']) {
    assert.equal(typeof c[k], 'string', `${c.name}.${k} is string`);
    assert.ok(c[k].length > 0, `${c.name}.${k} non-empty`);
  }
  assert.equal(typeof c.crowdDensity, 'number', `${c.name}.crowdDensity number`);
  assert.ok(c.crowdDensity >= 100 && c.crowdDensity <= 200, `${c.name} density sane`);
  for (const k of ['primary', 'bg', 'laser', 'constellation']) {
    assert.match(c.colors[k], HEX, `${c.name}.colors.${k} hex`);
  }
  assert.match(c.coordinates, /\d+\.\d°[NS] \d+\.\d°[EW]/, `${c.name} coordinates format`);
  names.push(c.name);
}

assert.deepEqual(names, ['BERLIN', 'TOKYO', 'MEXICO CITY', 'NEW YORK', 'LONDON', 'TBILISI']);
assert.equal(CITIES[0].crowdDensity, 150);
assert.equal(CITIES[2].crowdDensity, 160);
assert.equal(CITIES[5].colors.primary, '#ef4444');

console.log('✓ cities.js — 6 cities, all fields valid');
