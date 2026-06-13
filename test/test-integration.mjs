// node test/test-integration.mjs — wiring integrity + performance budget
import realTHREE from './three-env.mjs';
import { installDom } from './dom-stub.mjs';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

// 1 — every local asset referenced by index.html exists
const refs = [...html.matchAll(/(?:src|href)="(?!https?:|data:)([^"]+)"/g)].map((m) => m[1]);
assert.ok(refs.includes('src/main.js'), 'module entry wired');
assert.ok(refs.includes('styles/main.css'), 'stylesheet wired');
assert.ok(refs.includes('assets/vendor/three.r128.min.js'), 'CDN fallback wired');
for (const ref of refs) {
  assert.ok(existsSync(resolve(root, ref)), `referenced file exists: ${ref}`);
}

// 2 — fonts + CDN three.js r128 present
assert.match(html, /fonts\.googleapis\.com\/css2\?family=Unbounded:wght@900/, 'Unbounded 900');
assert.match(html, /IBM\+Plex\+Mono/, 'IBM Plex Mono');
assert.match(html, /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js/, 'three r128 CDN');
assert.match(html, /<script type="module" src="src\/main\.js">/, 'ES module entry');

// 3 — every DOM id main.js asks for exists in the page
const src = readFileSync(resolve(root, 'src/main.js'), 'utf8');
const ids = [...src.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
assert.ok(ids.length >= 4, 'main.js binds to the page');
for (const id of ids) {
  assert.ok(html.includes(`id="${id}"`), `index.html provides #${id}`);
}
// …and ids used by scene overlays / shared helpers
for (const id of ['ui-root', 'fx-strobe', 'fx-scanlines', 'cursor', 'boot']) {
  assert.ok(html.includes(`id="${id}"`), `index.html provides #${id}`);
}

// 4 — css classes the JS toggles all exist in the stylesheet
const css = readFileSync(resolve(root, 'styles/main.css'), 'utf8');
for (const cls of [
  'const-ui', 'nyx-title', 'nyx-x', 'nyx-sub', 'nyx-whisper', 'nyx-door', 'door-sigil', 'door-hint',
  'radial-menu', 'radial-item', 'radial-name', 'radial-coords',
  'intro', 'intro-line', 'hud', 'hud-tag', 'hud-city', 'hud-coords', 'hud-lore',
  'calm-toggle', 'in-venue', 'calm', 'visible', 'active', 'opening', 'gone',
]) {
  assert.ok(css.includes(`.${cls}`), `styles cover .${cls}`);
}
assert.match(css, /cursor:\s*none/, 'native cursor hidden');
assert.match(css, /overflow:\s*hidden/, 'no scroll');
assert.match(css, /repeating-linear-gradient/, 'scanlines');
assert.match(css, /-webkit-font-smoothing:\s*antialiased/, 'font smoothing');

// 5 — performance budget per venue (proxy for 60fps: draw calls + lights)
const { document, window } = installDom();
window.__NYX_TEST__ = true;
globalThis.THREE = realTHREE;
const { VenueScene } = await import('../src/scenes/venue.js');
const { CITIES } = await import('../src/data/cities.js');

const camera = new realTHREE.PerspectiveCamera(62, 16 / 9, 0.1, 220);
const venue = new VenueScene({}, camera);
console.log('  per-venue render budget (worst case, before frustum culling):');
for (const city of CITIES) {
  venue.load(city);
  let meshes = 0, points = 0, lines = 0, lights = 0, verts = 0;
  venue.scene.traverse((o) => {
    if (o.isMesh) { meshes++; verts += o.geometry.attributes.position ? o.geometry.attributes.position.count : 0; }
    if (o.isPoints) points++;
    if (o.isLine || o.isLineSegments) lines++;
    if (o.isLight) lights++;
  });
  const drawCalls = meshes + points + lines;
  console.log(`    ${city.name.padEnd(12)} draws≈${String(drawCalls).padStart(4)}  verts≈${String(verts).padStart(6)}  lights=${lights}`);
  assert.ok(drawCalls < 950, `${city.name}: draw calls in budget (${drawCalls})`);
  assert.ok(verts < 800000, `${city.name}: vertex count in budget (${verts})`);
  assert.ok(lights <= 18, `${city.name}: light count bounded (${lights})`);
}

// 6 — geometry cache shared across venues (no rebuild churn)
const { CrowdSystem } = await import('../src/components/crowd.js');
const s1 = new realTHREE.Scene();
const c1 = new CrowdSystem(s1, '#fff', 10);
const s2 = new realTHREE.Scene();
const c2 = new CrowdSystem(s2, '#fff', 10);
const g1 = c1.figures.find((f) => f.bodyType === 'average');
const g2 = c2.figures.find((f) => f.bodyType === 'average');
let m1, m2;
g1.wrap.traverse((o) => { if (o.isMesh && !m1) m1 = o; });
g2.wrap.traverse((o) => { if (o.isMesh && !m2) m2 = o; });
assert.equal(m1.geometry, m2.geometry, 'silhouette geometry cached across crowds');

console.log('✓ integration — assets wired, ids/classes consistent, render budget holds for all six venues');
