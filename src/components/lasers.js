// ============================================================
// NYXARA — laser system
// twelve blades of light sweeping the congregation
// ============================================================

const RIG_RADIUS = 4.6;
const RIG_HEIGHT = 5.2;
const BEAM_LENGTH = 13;

export class LaserSystem {
  constructor(scene, cityColor, count = 12) {
    this.scene = scene;
    this.count = count;
    this.calm = 1.0;

    this.root = new THREE.Group();
    this.root.name = 'lasers';
    this.lasers = [];

    const color = new THREE.Color(cityColor);
    const housingGeo = new THREE.BoxGeometry(0.16, 0.1, 0.16);
    const housingMat = new THREE.MeshBasicMaterial({ color: 0x050507 });

    // shared beam geometry: a thin open cone whose tip sits at the rig,
    // extending down -y; the rig group is lookAt()-ed at the sweep target.
    const beamGeo = new THREE.CylinderGeometry(0.012, 0.34, BEAM_LENGTH, 7, 1, true);
    beamGeo.translate(0, -BEAM_LENGTH / 2, 0);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * RIG_RADIUS;
      const z = Math.sin(angle) * RIG_RADIUS;

      const light = new THREE.SpotLight(
        color.clone(),
        1.8,
        22,
        0.09 + Math.random() * 0.05,
        0.45,
        1.1
      );
      light.position.set(x, RIG_HEIGHT, z);

      const target = new THREE.Object3D();
      target.position.set(0, 0, 0);
      light.target = target;
      this.root.add(target);
      this.root.add(light);

      // emissive housing block at the rig
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(x, RIG_HEIGHT + 0.08, z);
      this.root.add(housing);

      const dotMat = new THREE.MeshBasicMaterial({ color: color.clone() });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), dotMat);
      dot.position.set(x, RIG_HEIGHT - 0.02, z);
      this.root.add(dot);

      // visible beam cone — additive, fanning toward the floor target
      const beamMat = new THREE.MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beamPivot = new THREE.Group();
      beamPivot.position.set(x, RIG_HEIGHT, z);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.x = -Math.PI / 2; // -y of the cone aligns with the pivot's +z look axis
      beamPivot.add(beam);
      this.root.add(beamPivot);

      this.lasers.push({
        light,
        target,
        beamPivot,
        beamMat,
        dotMat,
        phase: Math.random() * Math.PI * 2,
        speed: 0.22 + Math.random() * 0.26,
        sweepX: 2.6 + Math.random() * 4.2,
        sweepZ: 2.6 + Math.random() * 4.2,
        wobble: 0.7 + Math.random() * 0.6,
      });
    }

    scene.add(this.root);
  }

  update(time) {
    const t = time * this.calm + (1 - this.calm) * time * 0.25;
    for (let i = 0; i < this.lasers.length; i++) {
      const l = this.lasers[i];

      // slow lissajous sweep across the floor — independent timing per laser
      const tx = Math.sin(t * l.speed + l.phase) * l.sweepX;
      const tz = Math.cos(t * l.speed * l.wobble + l.phase * 1.7) * l.sweepZ;
      l.target.position.set(tx, 0, tz);

      l.light.intensity = (1.8 + Math.sin(time * 1.8 + l.phase) * 0.9) * (this.calm < 1 ? 0.7 : 1);

      l.beamPivot.lookAt(tx, 0, tz);
      l.beamMat.opacity = 0.07 + (l.light.intensity / 2.7) * 0.11;
    }
  }

  setColor(cityColor) {
    const c = new THREE.Color(cityColor);
    for (const l of this.lasers) {
      l.light.color.copy(c);
      l.beamMat.color.copy(c);
      l.dotMat.color.copy(c);
    }
  }

  setCalm(on) {
    this.calm = on ? 0.3 : 1.0;
  }

  show() {
    this.root.visible = true;
  }

  hide() {
    this.root.visible = false;
  }

  dispose() {
    this.scene.remove(this.root);
    for (const l of this.lasers) {
      l.beamMat.dispose();
      l.dotMat.dispose();
    }
    this.lasers.length = 0;
  }
}
