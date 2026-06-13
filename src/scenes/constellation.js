// ============================================================
// NYXARA — constellation scene
// you were never supposed to find this
// ============================================================

const STAR_COUNT = 200;

const STAR_VERT = `
  attribute float aSize;
  attribute float aPhase;
  attribute float aDrift;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float breathe = 0.5 + 0.5 * sin(uTime * (0.35 + aDrift * 0.5) + aPhase);
    p.x += sin(uTime * 0.05 * aDrift + aPhase) * 0.7;
    p.y += cos(uTime * 0.04 * aDrift + aPhase * 1.31) * 0.7;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * (0.55 + 0.45 * breathe) * (170.0 / -mv.z);
    vAlpha = 0.30 + 0.70 * breathe;
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.05, d);
    float core = smoothstep(0.16, 0.0, d) * 0.85;
    gl_FragColor = vec4(uColor + vec3(core), a * vAlpha);
  }
`;

const DOOR_SVG = `
<svg viewBox="0 0 170 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="doorWood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16101e"/>
      <stop offset="0.55" stop-color="#0d0a14"/>
      <stop offset="1" stop-color="#070510"/>
    </linearGradient>
    <linearGradient id="doorFrame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2c2138"/>
      <stop offset="0.5" stop-color="#1a1326"/>
      <stop offset="1" stop-color="#241a30"/>
    </linearGradient>
    <radialGradient id="sigilGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="var(--door-glow, #8b5cf6)" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="var(--door-glow, #8b5cf6)" stop-opacity="0.25"/>
      <stop offset="1" stop-color="var(--door-glow, #8b5cf6)" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- outer ornate frame, arched -->
  <path d="M22 238 L22 96 Q22 30 85 24 Q148 30 148 96 L148 238 Z"
        fill="url(#doorFrame)" stroke="#3a2b4d" stroke-width="2.5"/>
  <!-- frame ornament lines — left flourish runs longer than the right: slightly wrong -->
  <path d="M28 238 L28 96 Q28 38 85 31" fill="none" stroke="#473358" stroke-width="1.1"/>
  <path d="M142 238 L142 102 Q142 44 90 33" fill="none" stroke="#473358" stroke-width="1.1"/>
  <path d="M22 150 Q10 144 12 128 Q24 134 22 142" fill="#241a30" stroke="#3a2b4d" stroke-width="1"/>
  <path d="M148 158 Q158 152 157 140" fill="none" stroke="#3a2b4d" stroke-width="1"/>

  <!-- keystone -->
  <path d="M71 22 L99 22 L93 44 L77 44 Z" fill="#2c2138" stroke="#473358" stroke-width="1.4"/>
  <path d="M79 27 L91 27 L88 39 L82 39 Z" fill="none" stroke="#544070" stroke-width="0.8"/>

  <!-- door leaf -->
  <path d="M34 238 L34 100 Q34 44 85 38 Q136 44 136 100 L136 238 Z"
        fill="url(#doorWood)" stroke="#322543" stroke-width="1.6"/>

  <!-- recessed panels -->
  <path d="M46 122 Q46 66 85 60 Q88 66 88 78 L88 122 Z" fill="#0a0712" stroke="#2b2040" stroke-width="1.1"/>
  <path d="M124 124 Q124 68 88 60 Q85 67 85 79 L85 124 Q104 121 124 124 Z" fill="#0b0813" stroke="#2b2040" stroke-width="1.1"/>
  <rect x="46" y="178" width="34" height="48" fill="#0a0712" stroke="#2b2040" stroke-width="1.1"/>
  <rect x="90" y="176" width="34" height="50" fill="#0b0813" stroke="#2b2040" stroke-width="1.1"/>
  <rect x="51" y="183" width="24" height="38" fill="none" stroke="#221837" stroke-width="0.8"/>
  <rect x="95" y="181" width="24" height="40" fill="none" stroke="#221837" stroke-width="0.8"/>

  <!-- hinges + studs -->
  <circle cx="40" cy="110" r="1.6" fill="#473358"/>
  <circle cx="40" cy="160" r="1.6" fill="#473358"/>
  <circle cx="40" cy="210" r="1.6" fill="#473358"/>
  <circle cx="130" cy="112" r="1.6" fill="#473358"/>
  <circle cx="130" cy="162" r="1.6" fill="#473358"/>
  <circle cx="130" cy="212" r="1.6" fill="#473358"/>

  <!-- sigil — off-centre by two pixels, like it grew there -->
  <g class="door-sigil" transform="translate(87,150)">
    <circle r="26" fill="url(#sigilGlow)"/>
    <circle r="15" fill="none" stroke="var(--door-glow, #8b5cf6)" stroke-width="1.3" opacity="0.9"/>
    <circle r="10.5" fill="none" stroke="var(--door-glow, #8b5cf6)" stroke-width="0.7" opacity="0.55"/>
    <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="var(--door-glow, #8b5cf6)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M0 -15 L0 -20 M0 15 L0 20 M-15 0 L-20 0 M15 0 L20 0"
          stroke="var(--door-glow, #8b5cf6)" stroke-width="1" opacity="0.7"/>
    <circle r="2.1" fill="var(--door-glow, #8b5cf6)"/>
  </g>
</svg>`;

export class ConstellationScene {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.onEnter = null;
    this.visible = false;
    this._firstVisit = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#030208');

    this._buildStars();
    this._buildNebula();
    this._buildOverlay();
  }

  _buildStars() {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const drifts = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // a disc of stars, slightly thick, hanging in front of the camera
      const r = Math.sqrt(Math.random()) * 26;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a) * r * 0.72;
      positions[i * 3 + 2] = -14 - Math.random() * 26;
      sizes[i] = 0.5 + Math.pow(Math.random(), 2.2) * 2.6;
      phases[i] = Math.random() * Math.PI * 2;
      drifts[i] = 0.4 + Math.random() * 1.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1));

    this.starUniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#7c3aed') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starGroup = new THREE.Group();
    this.stars = new THREE.Points(geo, mat);
    this.starGroup.add(this.stars);
    this.scene.add(this.starGroup);
  }

  _nebulaTexture(hex) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext && c.getContext('2d');
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, hex + 'a8');
    g.addColorStop(0.4, hex + '46');
    g.addColorStop(1, hex + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  _buildNebula() {
    this.nebulae = [];
    const specs = [
      { x: -9, y: 4, z: -42, s: 58, c: '#2a1060', o: 0.5 },
      { x: 12, y: -6, z: -48, s: 66, c: '#1b0a44', o: 0.45 },
      { x: 2, y: 9, z: -52, s: 50, c: '#43179a', o: 0.30 },
    ];
    for (const n of specs) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(n.c),
        transparent: true,
        opacity: n.o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const tex = this._nebulaTexture('#ffffff');
      if (tex) mat.map = tex;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(n.s, n.s), mat);
      mesh.position.set(n.x, n.y, n.z);
      this.scene.add(mesh);
      this.nebulae.push({ mesh, baseOpacity: n.o, baseColor: new THREE.Color(n.c) });
    }
  }

  _buildOverlay() {
    if (typeof document === 'undefined') return;
    const mount = document.getElementById('ui-root') || document.body;

    this.ui = document.createElement('div');
    this.ui.className = 'const-ui';

    const stack = document.createElement('div');
    stack.className = 'const-stack';

    this.title = document.createElement('h1');
    this.title.className = 'nyx-title';
    this.title.innerHTML = 'NY<span class="nyx-x">X</span>ARA';

    this.sub = document.createElement('div');
    this.sub.className = 'nyx-sub';
    this.sub.textContent = 'the night has coordinates';

    this.whisper = document.createElement('div');
    this.whisper.className = 'nyx-whisper';
    this.whisper.textContent = 'you were never supposed to find this';

    this.door = document.createElement('div');
    this.door.className = 'nyx-door';
    this.door.setAttribute('role', 'button');
    this.door.setAttribute('aria-label', 'enter the night');
    this.door.innerHTML = DOOR_SVG;

    this.doorHint = document.createElement('div');
    this.doorHint.className = 'door-hint';
    this.doorHint.textContent = 'enter';

    this.door.appendChild(this.doorHint);
    this.door.addEventListener('click', () => {
      if (!this.visible) return;
      this.door.classList.add('opening');
      if (this.onEnter) this.onEnter();
    });

    stack.appendChild(this.title);
    stack.appendChild(this.sub);
    stack.appendChild(this.whisper);
    stack.appendChild(this.door);
    this.ui.appendChild(stack);
    mount.appendChild(this.ui);
  }

  update(time) {
    this.starUniforms.uTime.value = time;
    this.starGroup.rotation.z = time * 0.012; // slow group rotation
    this.starGroup.rotation.y = Math.sin(time * 0.05) * 0.05;
    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      n.mesh.material.opacity = n.baseOpacity * (0.82 + 0.18 * Math.sin(time * 0.21 + i * 2.1));
      n.mesh.rotation.z = time * 0.006 * (i % 2 === 0 ? 1 : -1);
    }
  }

  setTint(cityColor) {
    this.starUniforms.uColor.value.set(cityColor);
    const tint = new THREE.Color(cityColor);
    for (const n of this.nebulae) {
      n.mesh.material.color.copy(n.baseColor).lerp(tint, 0.38);
    }
    if (this.ui && this.ui.style && this.ui.style.setProperty) {
      this.ui.style.setProperty('--door-glow', cityColor);
    }
  }

  show(cityColor) {
    if (cityColor) this.setTint(cityColor);
    this.visible = true;
    if (this.camera) {
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
    }
    if (this.ui) {
      this.door.classList.remove('opening');
      this.ui.classList.toggle('returning', !this._firstVisit);
      this.ui.classList.add('visible');
    }
    this._firstVisit = false;
  }

  hide() {
    this.visible = false;
    if (this.ui) this.ui.classList.remove('visible');
  }
}
