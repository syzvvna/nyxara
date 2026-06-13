// ============================================================
// NYXARA — crowd system
// the crowd was always a constellation —
// you just couldn't see it from inside.
// ============================================================

// 7 distinct body types.
// sw: shoulder width · ww: waist width · hw: hip width
// hs: head radius · ht: height (metres)
export const BODY_TYPES = {
  'tall-slim':  { sw: 0.32, ww: 0.18, hw: 0.22, hs: 0.12,  ht: 1.72 },
  'average':    { sw: 0.30, ww: 0.22, hw: 0.26, hs: 0.13,  ht: 1.58 },
  'broad':      { sw: 0.40, ww: 0.26, hw: 0.28, hs: 0.14,  ht: 1.65 },
  'petite':     { sw: 0.26, ww: 0.17, hw: 0.21, hs: 0.11,  ht: 1.42 },
  'stocky':     { sw: 0.36, ww: 0.30, hw: 0.34, hs: 0.145, ht: 1.52 },
  'tall-broad': { sw: 0.42, ww: 0.27, hw: 0.30, hs: 0.145, ht: 1.78 },
  'curvy':      { sw: 0.30, ww: 0.19, hw: 0.35, hs: 0.13,  ht: 1.55 },
};

const TYPE_NAMES = Object.keys(BODY_TYPES);
const RINGS = [
  { r: 2.2, weight: 0.10, jitter: 0.30 },
  { r: 4.0, weight: 0.18, jitter: 0.50 },
  { r: 6.5, weight: 0.30, jitter: 0.65 },
  { r: 9.5, weight: 0.42, jitter: 0.85 },
];
const RIM_SCALE = 1.06;

// ------------------------------------------------------------
// silhouette construction — a real human outline, drawn once
// per body type and cached. Not a cylinder. Not a sphere.
// ------------------------------------------------------------

// Appends an elliptical arc as `pieces` quadratic beziers. The shape's pen
// must already sit at angle `from`. Quadratics keep curve density under our
// control independent of the extrude's global curveSegments.
function ellipseArc(shape, cx, cy, rx, ry, from, to, pieces) {
  const step = (to - from) / pieces;
  for (let i = 0; i < pieces; i++) {
    const a0 = from + step * i;
    const a1 = a0 + step;
    const mid = (a0 + a1) / 2;
    const half = Math.abs(a1 - a0) / 2;
    const k = 1 / Math.cos(half); // tangent-intersection control point
    shape.quadraticCurveTo(
      cx + rx * Math.cos(mid) * k,
      cy + ry * Math.sin(mid) * k,
      cx + rx * Math.cos(a1),
      cy + ry * Math.sin(a1)
    );
  }
}

function humanBodyShape(p, headPieces = 4) {
  const { sw, ww, hw, hs, ht } = p;

  const headR = hs;
  const headCY = ht - hs * 1.04;          // head centre (crown ≈ ht)
  const jawA = 0.92;                      // radians off horizontal where neck meets skull
  const jawX = Math.cos(jawA) * headR * 0.88;
  const jawY = headCY - Math.sin(jawA) * headR;

  const neckHW = hs * 0.40;
  const neckBaseY = jawY - hs * 0.40;     // trapezius line
  const shHW = sw / 2;                    // shoulder edge
  const shEdgeY = neckBaseY - 0.055;      // shoulders slope down from the neck
  const pitY = shEdgeY - 0.085;           // armpit
  const waistHW = ww / 2;
  const waistY = ht * 0.585;
  const hipHW = hw / 2;
  const hipY = ht * 0.50;
  const crotchY = ht * 0.435;
  const kneeY = ht * 0.27;
  const gapHW = hipHW * 0.16 + 0.010;     // half-gap between the legs
  const ankleW = 0.052 + hw * 0.05;       // leg width at the ankle
  const kneeOutX = hipHW * 0.74 + gapHW * 0.3;

  const s = new THREE.Shape();

  // — left leg, outer edge, climbing from the floor —
  s.moveTo(-(gapHW + ankleW), 0);
  s.quadraticCurveTo(-(kneeOutX + 0.012), kneeY, -hipHW * 0.96, hipY * 0.86);
  s.quadraticCurveTo(-hipHW * 1.04, hipY * 0.97, -hipHW, hipY);

  // — left flank: hip → waist → ribs → armpit —
  s.quadraticCurveTo(-(waistHW + (hipHW - waistHW) * 0.45), (hipY + waistY) / 2, -waistHW, waistY);
  s.quadraticCurveTo(-(waistHW + (shHW - waistHW) * 0.30), (waistY + pitY) / 2, -shHW * 0.97, pitY);

  // — left deltoid cap and trapezius slope into the neck —
  s.quadraticCurveTo(-shHW * 1.05, shEdgeY + 0.012, -shHW * 0.82, shEdgeY + 0.030);
  s.quadraticCurveTo(-shHW * 0.42, neckBaseY + 0.004, -neckHW, neckBaseY);

  // — neck up to the jaw —
  s.lineTo(-neckHW * 0.94, jawY + 0.006);
  s.quadraticCurveTo(-neckHW * 0.9, jawY + 0.01, -jawX, jawY);

  // — head: slightly tall ellipse traced jaw → crown → jaw —
  ellipseArc(s, 0, headCY, headR * 0.88, headR, Math.PI + jawA, -jawA, headPieces);

  // — right jaw, neck, trapezius, deltoid —
  s.quadraticCurveTo(neckHW * 0.9, jawY + 0.01, neckHW * 0.94, jawY + 0.006);
  s.lineTo(neckHW, neckBaseY);
  s.quadraticCurveTo(shHW * 0.42, neckBaseY + 0.004, shHW * 0.82, shEdgeY + 0.030);
  s.quadraticCurveTo(shHW * 1.05, shEdgeY + 0.012, shHW * 0.97, pitY);

  // — right flank down: armpit → ribs → waist → hip —
  s.quadraticCurveTo(waistHW + (shHW - waistHW) * 0.30, (waistY + pitY) / 2, waistHW, waistY);
  s.quadraticCurveTo(waistHW + (hipHW - waistHW) * 0.45, (hipY + waistY) / 2, hipHW, hipY);

  // — right leg, outer edge down to the floor —
  s.quadraticCurveTo(hipHW * 1.04, hipY * 0.97, hipHW * 0.96, hipY * 0.86);
  s.quadraticCurveTo(kneeOutX + 0.012, kneeY, gapHW + ankleW, 0);

  // — right foot, inner edge back up to the crotch —
  s.lineTo(gapHW + ankleW * 0.42, 0);
  s.quadraticCurveTo(gapHW * 1.5, kneeY, gapHW * 1.15, crotchY * 0.62);
  s.quadraticCurveTo(gapHW * 1.05, crotchY * 0.92, 0, crotchY);

  // — left inner leg back down, close —
  s.quadraticCurveTo(-gapHW * 1.05, crotchY * 0.92, -gapHW * 1.15, crotchY * 0.62);
  s.quadraticCurveTo(-gapHW * 1.5, kneeY, -(gapHW + ankleW * 0.42), 0);
  s.closePath();

  return s;
}

function armShape(p, capPieces = 2) {
  const { sw, ht } = p;
  const aw = 0.030 + sw * 0.085;          // upper-arm half width
  const len = ht * 0.40;
  const bend = 0.030;                     // relaxed elbow drift
  const elbowW = aw * 0.78;
  const wristW = aw * 0.48;
  const elbowY = -len * 0.48;
  const wristY = -len * 0.90;
  const wristX = bend * 0.55;

  const s = new THREE.Shape();
  // shoulder cap over the pivot at (0,0)
  s.moveTo(-aw, 0);
  ellipseArc(s, 0, 0, aw, aw, Math.PI, 0, capPieces);
  // outer edge → elbow → wrist
  s.quadraticCurveTo(aw + 0.006, elbowY * 0.55, bend + elbowW, elbowY);
  s.quadraticCurveTo(bend + elbowW * 0.8, (elbowY + wristY) / 2, wristX + wristW, wristY);
  // hand
  s.quadraticCurveTo(wristX + wristW * 1.55, wristY - len * 0.055, wristX, -len * 1.015);
  s.quadraticCurveTo(wristX - wristW * 1.55, wristY - len * 0.055, wristX - wristW, wristY);
  // inner edge back up
  s.quadraticCurveTo(bend - elbowW * 0.85, (elbowY + wristY) / 2, bend - elbowW, elbowY);
  s.quadraticCurveTo(-aw - 0.004, elbowY * 0.55, -aw, 0);
  s.closePath();

  return { shape: s, aw, len };
}

// geometry cache shared by every CrowdSystem instance
const geoCache = new Map();

function geometryFor(typeName) {
  if (geoCache.has(typeName)) return geoCache.get(typeName);

  const p = BODY_TYPES[typeName];
  const depth = 0.085 + p.ww * 0.30;

  const bodyGeo = new THREE.ExtrudeGeometry(humanBodyShape(p, 4), {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 4,
  });
  bodyGeo.translate(0, -p.ht / 2, -depth / 2); // centre for clean rim scaling

  // the rim is a soft halo — it can afford far fewer vertices
  const bodyGeoLo = new THREE.ExtrudeGeometry(humanBodyShape(p, 3), {
    steps: 1,
    depth,
    bevelEnabled: false,
    curveSegments: 2,
  });
  bodyGeoLo.translate(0, -p.ht / 2, -depth / 2);

  const arm = armShape(p, 2);
  const armDepth = depth * 0.52;
  const armGeo = new THREE.ExtrudeGeometry(arm.shape, {
    steps: 1,
    depth: armDepth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 3,
  });
  armGeo.translate(0, 0, -armDepth / 2);

  const armLo = armShape(p, 2);
  const armGeoLo = new THREE.ExtrudeGeometry(armLo.shape, {
    steps: 1,
    depth: armDepth,
    bevelEnabled: false,
    curveSegments: 2,
  });
  armGeoLo.translate(0, 0, -armDepth / 2);

  const neckBaseY = p.ht - p.hs * 1.04 - Math.sin(0.92) * p.hs - p.hs * 0.40;
  const entry = {
    bodyGeo,
    bodyGeoLo,
    armGeo,
    armGeoLo,
    ht: p.ht,
    shoulderX: p.sw / 2 - arm.aw * 0.45,
    shoulderY: neckBaseY - 0.012,
  };
  geoCache.set(typeName, entry);
  return entry;
}

// ------------------------------------------------------------
// CrowdSystem
// ------------------------------------------------------------

export class CrowdSystem {
  constructor(scene, cityColor, density) {
    this.scene = scene;
    this.density = density;
    this.calm = 1.0; // motion multiplier; CALM mode lowers it

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0b0b11,
      roughness: 0.88,
      metalness: 0.14,
      emissive: new THREE.Color(cityColor),
      emissiveIntensity: 0.075,
    });
    this.rimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cityColor),
      side: THREE.BackSide,
    });

    this.root = new THREE.Group();
    this.root.name = 'crowd';
    this.figures = [];

    this._populate();
    scene.add(this.root);
  }

  _populate() {
    // ring allocation that always sums to the requested density
    const counts = RINGS.map((ring) => Math.floor(this.density * ring.weight));
    let placed = counts.reduce((a, b) => a + b, 0);
    for (let i = RINGS.length - 1; placed < this.density; i = (i + 1) % RINGS.length) {
      counts[i]++;
      placed++;
    }

    let figureIndex = 0;
    RINGS.forEach((ring, ringIdx) => {
      const n = counts[ringIdx];
      for (let i = 0; i < n; i++) {
        // guarantee all 7 body types exist in every crowd
        const typeName =
          figureIndex < TYPE_NAMES.length
            ? TYPE_NAMES[figureIndex]
            : TYPE_NAMES[(Math.random() * TYPE_NAMES.length) | 0];

        const angle = (i / n) * Math.PI * 2 + Math.random() * (Math.PI * 2 / n) * 0.85;
        const radius = ring.r + (Math.random() * 2 - 1) * ring.jitter;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        this._buildFigure(typeName, x, z, ringIdx);
        figureIndex++;
      }
    });
  }

  _buildFigure(typeName, x, z, ringIdx) {
    const { bodyGeo, bodyGeoLo, armGeo, armGeoLo, ht, shoulderX, shoulderY } = geometryFor(typeName);
    const detailed = ringIdx < 2; // inner rings get rim-lit arms too

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    // the ritual faces its centre
    group.rotation.y = Math.atan2(x, z) + Math.PI + (Math.random() * 2 - 1) * 0.35;
    const sc = 0.95 + Math.random() * 0.1;
    group.scale.setScalar(sc);

    const wrap = new THREE.Group(); // sway pivot at the feet
    group.add(wrap);

    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.position.y = ht / 2;
    wrap.add(body);

    const rim = new THREE.Mesh(bodyGeoLo, this.rimMat);
    rim.position.y = ht / 2;
    rim.scale.setScalar(RIM_SCALE);
    wrap.add(rim);

    const lPivot = new THREE.Group();
    lPivot.position.set(-shoulderX, shoulderY, 0);
    const lArm = new THREE.Mesh(armGeo, this.bodyMat);
    lPivot.add(lArm);
    wrap.add(lPivot);

    const rPivot = new THREE.Group();
    rPivot.position.set(shoulderX, shoulderY, 0);
    const rArm = new THREE.Mesh(armGeo, this.bodyMat);
    rArm.scale.x = -1; // mirror the elbow bend
    rPivot.add(rArm);
    wrap.add(rPivot);

    if (detailed) {
      const lRim = new THREE.Mesh(armGeoLo, this.rimMat);
      lRim.scale.setScalar(RIM_SCALE);
      lPivot.add(lRim);
      const rRim = new THREE.Mesh(armGeoLo, this.rimMat);
      rRim.scale.set(-RIM_SCALE, RIM_SCALE, RIM_SCALE);
      rPivot.add(rRim);
    }

    this.root.add(group);
    this.figures.push({
      group,
      wrap,
      lPivot,
      rPivot,
      bodyType: typeName,
      phase: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random() * 1.1,
      armRaise: Math.random() < 0.38,
      raiseAmt: 0.85 + Math.random() * 0.28,
      armPhase: Math.random() * Math.PI * 2,
    });
  }

  update(time) {
    const calm = this.calm;
    for (let i = 0; i < this.figures.length; i++) {
      const f = this.figures[i];
      const t = time * f.speed;

      // body bob — never synchronized across figures
      f.group.position.y = Math.sin(t + f.phase) * 0.025 * calm;

      // torso sway around the feet
      f.wrap.rotation.z = Math.sin(t * 0.5 + f.phase) * 0.04 * calm;

      if (f.armRaise) {
        // hands up, swaying overhead — left pivot rotates negative (outward)
        const reach = (Math.PI - 0.40) * f.raiseAmt;
        f.lPivot.rotation.z = -(reach + Math.sin(t * 0.9 + f.armPhase) * 0.17 * calm);
        f.rPivot.rotation.z = reach + Math.sin(t * 0.9 + f.armPhase + 1.35) * 0.17 * calm;
      } else {
        // arms hanging, drifting with the bass
        f.lPivot.rotation.z = -(0.10 + Math.sin(t * 0.55 + f.armPhase) * 0.075 * calm);
        f.rPivot.rotation.z = 0.10 + Math.sin(t * 0.55 + f.armPhase + 0.9) * 0.075 * calm;
      }
    }
  }

  setColor(cityColor) {
    this.bodyMat.emissive.set(cityColor);
    this.rimMat.color.set(cityColor);
  }

  setCalm(on) {
    this.calm = on ? 0.35 : 1.0;
  }

  show() {
    this.root.visible = true;
  }

  hide() {
    this.root.visible = false;
  }

  dispose() {
    this.scene.remove(this.root);
    this.bodyMat.dispose();
    this.rimMat.dispose();
    this.figures.length = 0;
    // geometry cache is shared across venues on purpose — never disposed here
  }
}

// builds a single standalone figure (the DJ on the booth)
export function buildLoneFigure(cityColor, typeName = 'tall-slim') {
  const sys = { bodyMat: null, rimMat: null };
  const { bodyGeo, bodyGeoLo, armGeo, ht, shoulderX, shoulderY } = geometryFor(typeName);

  sys.bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0b0b11,
    roughness: 0.85,
    metalness: 0.15,
    emissive: new THREE.Color(cityColor),
    emissiveIntensity: 0.14,
  });
  sys.rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cityColor), side: THREE.BackSide });

  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, sys.bodyMat);
  body.position.y = ht / 2;
  group.add(body);
  const rim = new THREE.Mesh(bodyGeoLo, sys.rimMat);
  rim.position.y = ht / 2;
  rim.scale.setScalar(RIM_SCALE);
  group.add(rim);

  const pivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * shoulderX, shoulderY, 0);
    const arm = new THREE.Mesh(armGeo, sys.bodyMat);
    arm.scale.x = side === 1 ? -1 : 1;
    pivot.add(arm);
    group.add(pivot);
    pivots.push(pivot);
  }

  return { group, pivots, mats: sys, ht };
}
