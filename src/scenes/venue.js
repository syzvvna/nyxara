// ============================================================
// NYXARA — venue scene
// the room, the architecture, the congregation
// ============================================================

import { clamp, lerp } from '../utils/math.js';
import { CrowdSystem, buildLoneFigure } from '../components/crowd.js';
import { LaserSystem } from '../components/lasers.js';
import { ParticleSystem } from '../components/particles.js';

const FOG_DENSITY = 0.038;
const EYE_Y = 1.7;
const PITCH_MIN = -15 * (Math.PI / 180);
const PITCH_MAX = 25 * (Math.PI / 180);
const LERP_K = 0.055;

function makeCanvasTexture(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function brickTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#160d09';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f1410';
    const bh = 16, bw = 32;
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw; x < w + bw; x += bw) {
        ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
  });
}

function tileTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0d1417';
    ctx.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        const v = 18 + Math.floor(Math.random() * 14);
        ctx.fillStyle = `rgb(${v - 6},${v + 6},${v + 8})`;
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      }
    }
  });
}

function reliefTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#17110a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a2012';
    ctx.lineWidth = 2;
    // stepped fret pattern, the old language of the stone
    for (let y = 12; y < h; y += 30) {
      ctx.beginPath();
      for (let x = 0; x < w; x += 24) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 14, y);
        ctx.lineTo(x + 14, y + 9);
        ctx.lineTo(x + 24, y + 9);
      }
      ctx.stroke();
    }
  });
}

export class VenueScene {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.city = null;
    this.calm = false;
    this.visible = false;
    this.onStrobe = null; // main wires this to the DOM flash layer

    this.scene = new THREE.Scene();

    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    this._nextStrobe = 4;
    this._strobeUntil = -1;

    this.crowd = null;
    this.lasers = null;
    this.particles = null;
    this.arch = null;
    this.dj = null;
  }

  // ----------------------------------------------------------
  // construction
  // ----------------------------------------------------------

  load(cityData) {
    this._unload();
    this.city = cityData;
    const accents = cityData.colors;

    this.scene.background = new THREE.Color(accents.bg);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(accents.bg).getHex(), FOG_DENSITY);

    this.envGroup = new THREE.Group();
    this.envGroup.name = 'environment';
    this.scene.add(this.envGroup);
    this._disposables = [];

    this._buildFloorAndCeiling(cityData);
    this._buildLights(cityData);
    this._buildBooth(cityData);
    this._buildArchitecture(cityData);

    this.crowd = new CrowdSystem(this.scene, accents.primary, cityData.crowdDensity);
    this.lasers = new LaserSystem(this.scene, accents.laser, 12);
    this.particles = new ParticleSystem(this.scene, accents.primary, 300);
    this.crowd.setCalm(this.calm);
    this.lasers.setCalm(this.calm);
    this.particles.setCalm(this.calm);

    this._nextStrobe = 3 + Math.random() * 2;
  }

  _track(obj) {
    this._disposables.push(obj);
    return obj;
  }

  _mat(opts) {
    return this._track(new THREE.MeshStandardMaterial(opts));
  }

  _geo(g) {
    return this._track(g);
  }

  _buildFloorAndCeiling(city) {
    const accent = new THREE.Color(city.colors.primary);

    this.floorMat = this._mat({
      color: 0x0a0a0e,
      roughness: 0.42,
      metalness: 0.62,
      emissive: accent,
      emissiveIntensity: 0.018,
    });
    const floor = new THREE.Mesh(this._geo(new THREE.CircleGeometry(26, 48)), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.envGroup.add(floor);

    const ceilMat = this._mat({ color: 0x07070a, roughness: 0.95, metalness: 0.05 });
    const openSky = city.name === 'MEXICO CITY';
    const ceilGeo = openSky
      ? new THREE.RingGeometry(5.5, 26, 40)
      : new THREE.CircleGeometry(26, 40);
    const ceiling = new THREE.Mesh(this._geo(ceilGeo), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5.4;
    this.envGroup.add(ceiling);

    if (openSky) {
      // a coin of real night above the ruins
      const starPos = new Float32Array(70 * 3);
      for (let i = 0; i < 70; i++) {
        const r = Math.sqrt(Math.random()) * 5.2;
        const a = Math.random() * Math.PI * 2;
        starPos[i * 3] = Math.cos(a) * r;
        starPos[i * 3 + 1] = 7.5 + Math.random() * 4;
        starPos[i * 3 + 2] = Math.sin(a) * r;
      }
      const sg = this._geo(new THREE.BufferGeometry());
      sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const sm = this._track(new THREE.PointsMaterial({
        color: 0xcdd6ff, size: 0.05, transparent: true, opacity: 0.9,
        depthWrite: false,
      }));
      this.envGroup.add(new THREE.Points(sg, sm));
    }
  }

  _buildLights(city) {
    const ambient = new THREE.AmbientLight(0x141320, 1.1);
    this.envGroup.add(ambient);
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(city.colors.primary).multiplyScalar(0.5).getHex(),
      0x050508,
      0.22
    );
    this.envGroup.add(hemi);
  }

  _buildBooth(city) {
    const accent = new THREE.Color(city.colors.primary);
    const elevated = city.name === 'TOKYO';
    const h = elevated ? 1.5 : 0.9;

    const booth = new THREE.Group();
    booth.position.set(0, 0, -7);

    const baseMat = this._mat({ color: 0x0c0c10, roughness: 0.7, metalness: 0.3 });
    const base = new THREE.Mesh(this._geo(new THREE.BoxGeometry(4.2, h, 1.9)), baseMat);
    base.position.y = h / 2;
    booth.add(base);

    this.boothStripMat = this._track(new THREE.MeshBasicMaterial({ color: accent.clone() }));
    const strip = new THREE.Mesh(this._geo(new THREE.BoxGeometry(4.24, 0.05, 1.94)), this.boothStripMat);
    strip.position.y = h - 0.03;
    booth.add(strip);

    const console_ = new THREE.Mesh(this._geo(new THREE.BoxGeometry(2.3, 0.32, 0.7)), baseMat);
    console_.position.set(0, h + 0.16, 0.35);
    booth.add(console_);

    this.dj = buildLoneFigure(city.colors.primary, 'tall-slim');
    this.dj.group.position.set(0, h, -0.25);
    this.dj.baseY = h;
    // one hand riding the high
    this.dj.pivots[0].rotation.z = -(Math.PI - 0.55);
    this.dj.pivots[1].rotation.z = 0.35;
    this._track(this.dj.mats.bodyMat);
    this._track(this.dj.mats.rimMat);
    booth.add(this.dj.group);

    this.envGroup.add(booth);
  }

  _buildArchitecture(city) {
    this.arch = new THREE.Group();
    this.arch.name = 'architecture';

    switch (city.name) {
      case 'BERLIN': this._archBerlin(); break;
      case 'TOKYO': this._archTokyo(city); break;
      case 'MEXICO CITY': this._archMexico(city); break;
      case 'NEW YORK': this._archNewYork(); break;
      case 'LONDON': this._archLondon(); break;
      case 'TBILISI': this._archTbilisi(); break;
    }

    this.envGroup.add(this.arch);
  }

  _archBerlin() {
    // low concrete ceiling, exposed pipes, industrial steel beams
    const concrete = this._mat({ color: 0x141318, roughness: 0.96, metalness: 0.04 });
    const steel = this._mat({ color: 0x101216, roughness: 0.5, metalness: 0.8 });

    const pillarGeo = this._geo(new THREE.BoxGeometry(0.9, 5.4, 0.9));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.39;
      const p = new THREE.Mesh(pillarGeo, concrete);
      p.position.set(Math.cos(a) * 10.5, 2.7, Math.sin(a) * 10.5);
      this.arch.add(p);
    }

    const beamGeo = this._geo(new THREE.BoxGeometry(24, 0.45, 0.45));
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(beamGeo, steel);
      b.position.set(0, 4.55, i * 4.6);
      this.arch.add(b);
      const b2 = new THREE.Mesh(beamGeo, steel);
      b2.rotation.y = Math.PI / 2;
      b2.position.set(i * 4.6, 4.85, 0);
      this.arch.add(b2);
    }

    const pipeGeo = this._geo(new THREE.CylinderGeometry(0.08, 0.08, 23, 7));
    for (let i = 0; i < 6; i++) {
      const pipe = new THREE.Mesh(pipeGeo, steel);
      pipe.rotation.z = Math.PI / 2;
      pipe.rotation.y = (i % 3) * 0.5 - 0.5;
      pipe.position.set(0, 5.05 - (i % 2) * 0.22, -6 + i * 2.4);
      this.arch.add(pipe);
    }
  }

  _archTokyo(city) {
    // clean minimal walls, precision laser grid on the ceiling
    const panelMat = this._mat({ color: 0x0a0a12, roughness: 0.3, metalness: 0.6 });
    const edgeMat = this._track(new THREE.MeshBasicMaterial({
      color: new THREE.Color(city.colors.primary).multiplyScalar(0.6),
    }));

    const panelGeo = this._geo(new THREE.BoxGeometry(2.7, 3.6, 0.1));
    const edgeGeo = this._geo(new THREE.BoxGeometry(0.05, 3.6, 0.12));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * 12.5;
      const z = Math.sin(a) * 12.5;
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(x, 1.8, z);
      panel.rotation.y = -a + Math.PI / 2;
      this.arch.add(panel);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(x * 0.995, 1.8, z * 0.995);
      edge.rotation.y = -a + Math.PI / 2;
      edge.translateX(1.32);
      this.arch.add(edge);
    }

    // the grid: surgical lines of light across the ceiling
    const gridPts = [];
    for (let i = -5; i <= 5; i++) {
      gridPts.push(-10, 5.3, i * 2, 10, 5.3, i * 2);
      gridPts.push(i * 2, 5.3, -10, i * 2, 5.3, 10);
    }
    const gridGeo = this._geo(new THREE.BufferGeometry());
    gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gridPts), 3));
    this.gridMat = this._track(new THREE.LineBasicMaterial({
      color: new THREE.Color(city.colors.primary),
      transparent: true,
      opacity: 0.34,
    }));
    this.arch.add(new THREE.LineSegments(gridGeo, this.gridMat));
  }

  _archMexico(city) {
    // ancient stone, carved reliefs, torches alongside lasers
    const relief = reliefTexture();
    const stoneMat = this._mat({ color: 0x191207, roughness: 1.0, metalness: 0 });
    if (relief) {
      stoneMat.map = relief;
      this._track(relief);
    }

    const wallGeo = this._geo(new THREE.BoxGeometry(3.4, 4.3, 1.1));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const wall = new THREE.Mesh(wallGeo, stoneMat);
      wall.position.set(Math.cos(a) * 12, 2.0 + (i % 3) * 0.16, Math.sin(a) * 12);
      wall.rotation.y = -a + Math.PI / 2 + (i % 2 ? 0.05 : -0.04);
      this.arch.add(wall);
    }

    // carved monolith slabs closer in
    const slabGeo = this._geo(new THREE.BoxGeometry(1.6, 3.2, 0.7));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.8;
      const slab = new THREE.Mesh(slabGeo, stoneMat);
      slab.position.set(Math.cos(a) * 8.2, 1.6, Math.sin(a) * 8.2);
      slab.rotation.y = -a;
      this.arch.add(slab);
    }

    // torches — fire owns three lights, the lasers own the rest
    this.torches = [];
    const poleMat = this._mat({ color: 0x0e0a06, roughness: 0.9 });
    const poleGeo = this._geo(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6));
    const flameMat = this._track(new THREE.MeshBasicMaterial({
      color: 0xff9a3d,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const flameGeo = this._geo(new THREE.ConeGeometry(0.09, 0.34, 6));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.42;
      const x = Math.cos(a) * 8.6;
      const z = Math.sin(a) * 8.6;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 0.75, z);
      this.arch.add(pole);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x, 1.62, z);
      this.arch.add(flame);
      const torch = { flame, light: null, phase: Math.random() * Math.PI * 2 };
      if (i % 2 === 0) {
        const light = new THREE.PointLight(0xff7a26, 0.85, 7.5, 1.6);
        light.position.set(x, 1.7, z);
        this.arch.add(light);
        torch.light = light;
      }
      this.torches.push(torch);
    }
  }

  _archNewYork() {
    // warehouse steel, loading dock ceiling, concrete columns
    const steel = this._mat({ color: 0x12141a, roughness: 0.45, metalness: 0.85 });
    const concrete = this._mat({ color: 0x16120e, roughness: 0.95, metalness: 0.05 });

    const flangeGeo = this._geo(new THREE.BoxGeometry(0.5, 5.4, 0.07));
    const webGeo = this._geo(new THREE.BoxGeometry(0.07, 5.4, 0.4));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const col = new THREE.Group();
      const f1 = new THREE.Mesh(flangeGeo, steel);
      f1.position.z = 0.2;
      const f2 = new THREE.Mesh(flangeGeo, steel);
      f2.position.z = -0.2;
      const web = new THREE.Mesh(webGeo, steel);
      col.add(f1, f2, web);
      col.position.set(Math.cos(a) * 11, 2.7, Math.sin(a) * 11);
      col.rotation.y = -a;
      this.arch.add(col);
    }

    const columnGeo = this._geo(new THREE.BoxGeometry(1.1, 5.4, 1.1));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 1.2;
      const c = new THREE.Mesh(columnGeo, concrete);
      c.position.set(Math.cos(a) * 13.5, 2.7, Math.sin(a) * 13.5);
      this.arch.add(c);
    }

    const beamGeo = this._geo(new THREE.BoxGeometry(26, 0.5, 0.3));
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(beamGeo, steel);
      b.position.set(0, 4.9, i * 5.2);
      this.arch.add(b);
    }

    // corrugated dock ceiling
    const corrGeo = this._geo(new THREE.BoxGeometry(24, 0.06, 0.7));
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(corrGeo, concrete);
      c.position.set(0, 5.32 - (i % 2) * 0.1, -9.1 + i * 1.4);
      this.arch.add(c);
    }
  }

  _archLondon() {
    // exposed brick, low arches, a corridor that holds you
    const brick = brickTexture();
    const brickMat = this._mat({ color: 0x190f0b, roughness: 0.92, metalness: 0.02 });
    if (brick) {
      brick.repeat.set(6, 2);
      brickMat.map = brick;
      this._track(brick);
    }

    const wallGeo = this._geo(new THREE.BoxGeometry(0.6, 4.4, 26));
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(wallGeo, brickMat);
      wall.position.set(side * 8.2, 2.2, 0);
      this.arch.add(wall);
    }

    // arch ribs marching down the corridor
    const archGeo = this._geo(new THREE.TorusGeometry(8.2, 0.5, 7, 22, Math.PI));
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(archGeo, brickMat);
      rib.position.set(0, 0.4, -10 + i * 5);
      rib.scale.y = 0.52; // squash to a low vault
      this.arch.add(rib);
    }

    // end walls seal the room
    const endGeo = this._geo(new THREE.BoxGeometry(17, 4.4, 0.6));
    for (const side of [-1, 1]) {
      const end = new THREE.Mesh(endGeo, brickMat);
      end.position.set(0, 2.2, side * 13);
      this.arch.add(end);
    }
  }

  _archTbilisi() {
    // the drained Olympic pool — tiles, vaults, stadium columns
    const tiles = tileTexture();
    const tileMat = this._mat({ color: 0x121a1d, roughness: 0.35, metalness: 0.25 });
    if (tiles) {
      tiles.repeat.set(8, 3);
      tileMat.map = tiles;
      this._track(tiles);
    }
    const concrete = this._mat({ color: 0x16151a, roughness: 0.9, metalness: 0.1 });

    const wallGeo = this._geo(new THREE.BoxGeometry(4.6, 3.4, 0.5));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const wall = new THREE.Mesh(wallGeo, tileMat);
      wall.position.set(Math.cos(a) * 12.6, 1.7, Math.sin(a) * 12.6);
      wall.rotation.y = -a + Math.PI / 2;
      this.arch.add(wall);
    }

    // pool lane line still painted on the floor of the deep end
    const laneMat = this._track(new THREE.MeshBasicMaterial({
      color: 0x24343a, transparent: true, opacity: 0.5,
    }));
    const laneGeo = this._geo(new THREE.PlaneGeometry(0.18, 22));
    for (let i = -2; i <= 2; i++) {
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(i * 3.4, 0.012, 0);
      this.arch.add(lane);
    }

    // vaulted ceiling: half-cylinders spanning the hall
    const vaultGeo = this._geo(new THREE.CylinderGeometry(2.7, 2.7, 25, 18, 1, true, 0, Math.PI));
    for (let i = 0; i < 5; i++) {
      const vault = new THREE.Mesh(vaultGeo, concrete);
      vault.rotation.z = Math.PI / 2;
      vault.rotation.y = Math.PI / 2;
      vault.position.set(0, 5.35, -10 + i * 5);
      vault.scale.set(0.62, 1, 1);
      this.arch.add(vault);
    }

    const colGeo = this._geo(new THREE.CylinderGeometry(0.5, 0.58, 5.4, 10));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31;
      const col = new THREE.Mesh(colGeo, concrete);
      col.position.set(Math.cos(a) * 14, 2.7, Math.sin(a) * 14);
      this.arch.add(col);
    }
  }

  _unload() {
    if (this.crowd) { this.crowd.dispose(); this.crowd = null; }
    if (this.lasers) { this.lasers.dispose(); this.lasers = null; }
    if (this.particles) { this.particles.dispose(); this.particles = null; }
    if (this.envGroup) {
      this.scene.remove(this.envGroup);
      this.envGroup = null;
    }
    if (this._disposables) {
      for (const d of this._disposables) d.dispose && d.dispose();
    }
    this._disposables = [];
    this.torches = null;
    this.gridMat = null;
    this.dj = null;
    this.arch = null;
  }

  // ----------------------------------------------------------
  // controls
  // ----------------------------------------------------------

  setupControls(domElement) {
    this.dom = domElement;

    const down = (x, y) => {
      this._dragging = true;
      this._lastX = x;
      this._lastY = y;
    };
    const move = (x, y) => {
      if (!this._dragging || !this.visible) return;
      const dx = x - this._lastX;
      const dy = y - this._lastY;
      this._lastX = x;
      this._lastY = y;
      this.targetYaw -= dx * 0.0042; // horizontal drag → yaw
      this.targetPitch = clamp(this.targetPitch - dy * 0.003, PITCH_MIN, PITCH_MAX);
    };
    const up = () => { this._dragging = false; };

    domElement.addEventListener('pointerdown', (e) => down(e.clientX, e.clientY));
    domElement.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    domElement.addEventListener('pointerup', up);
    domElement.addEventListener('pointercancel', up);
    domElement.addEventListener('pointerleave', up);

    // touch fallback for browsers without pointer events
    domElement.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) down(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    domElement.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    domElement.addEventListener('touchend', up);
  }

  // ----------------------------------------------------------
  // per-frame
  // ----------------------------------------------------------

  update(time) {
    if (!this.city) return;

    this.crowd.update(time);
    this.lasers.update(time);
    this.particles.update(time);

    // camera: lerped look + head bob
    this.yaw += (this.targetYaw - this.yaw) * LERP_K;
    this.pitch += (this.targetPitch - this.pitch) * LERP_K;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
    this.camera.position.x = 0;
    this.camera.position.z = 0;
    this.camera.position.y = EYE_Y + (this.calm ? 0 : Math.sin(time * 0.8) * 0.012);

    // the floor breathes with the sub
    this.floorMat.emissiveIntensity = 0.016 + Math.abs(Math.sin(time * 1.05)) * 0.014;

    // DJ rides it
    if (this.dj) {
      this.dj.group.position.y = this.dj.baseY + Math.sin(time * 2.05) * 0.02;
      this.dj.pivots[0].rotation.z = -(Math.PI - 0.55) + Math.sin(time * 2.05) * 0.1;
    }

    if (this.torches) {
      for (const t of this.torches) {
        const flick = 0.75 + Math.sin(time * 9 + t.phase) * 0.12 + Math.sin(time * 23.7 + t.phase * 3) * 0.08;
        t.flame.scale.y = flick;
        t.flame.scale.x = t.flame.scale.z = 0.85 + flick * 0.2;
        if (t.light) t.light.intensity = 0.55 + flick * 0.45;
      }
    }

    if (this.gridMat) {
      this.gridMat.opacity = 0.26 + Math.abs(Math.sin(time * 0.7)) * 0.14;
    }

    // strobe — never faster than 0.5 Hz, never in calm mode
    if (!this.calm) {
      if (time >= this._nextStrobe) {
        this._strobeUntil = time + 0.07;
        this._nextStrobe = time + 2.0 + Math.random() * 2.6; // ≥ 2s between flashes
      }
      if (this.onStrobe) {
        this.onStrobe(time < this._strobeUntil ? 0.16 : 0);
      }
    } else if (this.onStrobe) {
      this.onStrobe(0);
    }
  }

  setCalm(on) {
    this.calm = on;
    if (this.crowd) this.crowd.setCalm(on);
    if (this.lasers) this.lasers.setCalm(on);
    if (this.particles) this.particles.setCalm(on);
    if (on && this.onStrobe) this.onStrobe(0);
  }

  show(cityData) {
    if (cityData && (!this.city || this.city.name !== cityData.name)) {
      this.load(cityData);
    }
    this.visible = true;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.camera.position.set(0, EYE_Y, 0);
    if (typeof document !== 'undefined') document.body.classList.add('in-venue');
  }

  hide() {
    this.visible = false;
    if (this.onStrobe) this.onStrobe(0);
    if (typeof document !== 'undefined') document.body.classList.remove('in-venue');
  }
}
