// ============================================================
// NYXARA — particle system
// smoke and dust climbing through the lasers
// ============================================================

const FLOOR_Y = 0.05;
const CEILING_Y = 5.5;
const SPREAD = 12;

function softCircleTexture() {
  // canvas only exists in the browser; headless tests fall back to untextured points
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export class ParticleSystem {
  constructor(scene, cityColor, count = 300) {
    this.scene = scene;
    this.count = count;
    this.calm = 1.0;
    this.lastTime = null;

    const positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    this.swayPhase = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * SPREAD;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = FLOOR_Y + Math.random() * (CEILING_Y - FLOOR_Y);
      positions[i * 3 + 2] = Math.sin(a) * r;
      this.speeds[i] = 0.12 + Math.random() * 0.34;
      this.swayPhase[i] = Math.random() * Math.PI * 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const tex = softCircleTexture();
    this.material = new THREE.PointsMaterial({
      color: new THREE.Color(cityColor),
      size: 0.085,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    if (tex) this.material.map = tex;

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'particles';
    scene.add(this.points);
  }

  update(time) {
    if (this.lastTime === null) this.lastTime = time;
    let dt = time - this.lastTime;
    this.lastTime = time;
    if (dt < 0 || dt > 0.25) dt = 0.016; // tab-switch / first-frame guard

    const drift = dt * this.calm;
    const pos = this.geometry.attributes.position.array;

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      pos[ix + 1] += this.speeds[i] * drift;
      pos[ix] += Math.sin(time * 0.3 + this.swayPhase[i]) * 0.0024 * this.calm;
      pos[ix + 2] += Math.cos(time * 0.23 + this.swayPhase[i]) * 0.0019 * this.calm;

      if (pos[ix + 1] > CEILING_Y) {
        const r = Math.sqrt(Math.random()) * SPREAD;
        const a = Math.random() * Math.PI * 2;
        pos[ix] = Math.cos(a) * r;
        pos[ix + 1] = FLOOR_Y;
        pos[ix + 2] = Math.sin(a) * r;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  setColor(cityColor) {
    this.material.color.set(cityColor);
  }

  setCalm(on) {
    this.calm = on ? 0.25 : 1.0;
  }

  show() {
    this.points.visible = true;
  }

  hide() {
    this.points.visible = false;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    if (this.material.map) this.material.map.dispose();
    this.material.dispose();
  }
}
