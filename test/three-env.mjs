// Shared test environment: loads the vendored Three.js r128 UMD build and
// exposes it as the `THREE` global, exactly as the CDN script tag does in
// the browser. Geometry/scene-graph code runs headless — only WebGLRenderer
// needs a GPU, and tests never touch it.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const THREE = require('../assets/vendor/three.r128.min.js');
globalThis.THREE = THREE;

export default THREE;
