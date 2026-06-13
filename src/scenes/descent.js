// ============================================================
// NYXARA — descent transition
// the fall between the sky and the floor
// ============================================================

import { lerp, clamp, easeInOut, easeIn } from '../utils/math.js';

const DURATION = 3.0; // seconds
const TOP_Y = 20;
const FLOOR_Y = 1.7;
const STREAK_COUNT = 260;
const RING_COUNT = 16;

export class DescentScene {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.direction = 1; // 1 = descending, -1 = ascending
    this.startTime = null;
    this.onComplete = null;
    this.baseFov = camera ? camera.fov : 62;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#020108');

    this._buildStreaks();
    this._buildTunnel();
    this._buildLandingGlow();
  }

  _buildStreaks() {
    // stars smeared into vertical motion trails — stretched by group.scale.y
    const positions = new Float32Array(STREAK_COUNT * 2 * 3);
    for (let i = 0; i < STREAK_COUNT; i++) {
      const r = 1.6 + Math.random() * 8.5;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = -10 + Math.random() * 38;
      const len = 0.22 + Math.random() * 0.5;
      positions[i * 6] = x;
      positions[i * 6 + 1] = y - len / 2;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y + len / 2;
      positions[i * 6 + 5] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.streakMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#8b5cf6'),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.streaks = new THREE.LineSegments(geo, this.streakMat);
    // stretch around mid-fall height so trails smear both ways
    this.streaks.position.y = 9;
    geo.translate(0, -9, 0);
    this.scene.add(this.streaks);
  }

  _buildTunnel() {
    this.rings = [];
    this.ringMats = [];
    const ringGeo = new THREE.TorusGeometry(2.7, 0.022, 3, 40);
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#8b5cf6'),
        transparent: true,
        opacity: 0.10 + (i / RING_COUNT) * 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (i / (RING_COUNT - 1)) * 22 - 1;
      ring.scale.setScalar(1 + Math.sin(i * 1.7) * 0.18);
      this.scene.add(ring);
      this.rings.push(ring);
      this.ringMats.push(mat);
    }

    // soft volumetric shafts wrapping the fall line
    this.shaftMats = [];
    for (const [r, o] of [[2.9, 0.045], [4.8, 0.028]]) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#8b5cf6'),
        transparent: true,
        opacity: o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 44, 24, 1, true), mat);
      shaft.position.y = 9;
      this.scene.add(shaft);
      this.shaftMats.push(mat);
    }
  }

  _buildLandingGlow() {
    this.glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#8b5cf6'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(6, 36), this.glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.2;
    this.scene.add(glow);
  }

  setColor(hex) {
    this.streakMat.color.set(hex);
    this.glowMat.color.set(hex);
    for (const m of this.ringMats) m.color.set(hex);
    for (const m of this.shaftMats) m.color.set(hex);
  }

  play(fromColor, onComplete) {
    if (fromColor) this.setColor(fromColor);
    this.direction = 1;
    this.active = true;
    this.startTime = null;
    this.onComplete = onComplete || null;
    this.baseFov = this.camera.fov;
    this.camera.position.set(0, TOP_Y, 0);
    this.camera.rotation.set(-0.55, 0, 0);
  }

  playReverse(onComplete) {
    this.direction = -1;
    this.active = true;
    this.startTime = null;
    this.onComplete = onComplete || null;
    this.baseFov = this.camera.fov;
    this.camera.position.set(0, FLOOR_Y, 0);
    this.camera.rotation.set(0, 0, 0);
  }

  update(time) {
    if (!this.active) return;
    if (this.startTime === null) this.startTime = time;

    const p = clamp((time - this.startTime) / DURATION, 0, 1);
    const eased = easeInOut(p);
    const speed = Math.sin(p * Math.PI); // bell: accelerate, then brake
    const down = this.direction === 1;

    const y = down ? lerp(TOP_Y, FLOOR_Y, eased) : lerp(FLOOR_Y, TOP_Y, eased);
    this.camera.position.y = y;
    // slight spiral on the way through
    this.camera.position.x = Math.sin(p * Math.PI * 1.6) * 0.34 * speed;
    this.camera.position.z = Math.cos(p * Math.PI * 1.3) * 0.30 * speed;

    // gaze: pitch toward travel, roll with the spin, then settle
    this.camera.rotation.x = down ? lerp(-0.55, 0, eased) : lerp(0, 0.42, eased);
    this.camera.rotation.z = Math.sin(p * Math.PI) * 0.16 * this.direction;

    // FOV pump sells the velocity
    this.camera.fov = this.baseFov + speed * 21;
    this.camera.updateProjectionMatrix();

    // streaks smear with speed
    this.streaks.scale.y = 1 + speed * 1.6;
    this.streakMat.opacity = 0.25 + speed * 0.55;

    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].rotation.z = time * (0.25 + i * 0.04) * this.direction;
    }

    this.glowMat.opacity = down ? easeIn(p) * 0.5 : (1 - eased) * 0.4;

    if (p >= 1) {
      this.active = false;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      this.camera.rotation.set(0, 0, 0);
      this.camera.position.x = 0;
      this.camera.position.z = 0;
      const cb = this.onComplete;
      this.onComplete = null;
      if (cb) cb();
    }
  }
}
