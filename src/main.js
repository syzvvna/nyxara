// ============================================================
// NYXARA — orchestrator
// LOADING → INTRO → CONSTELLATION → DESCENDING → VENUE
//   → ASCENDING → CONSTELLATION → DESCENDING → …
// ============================================================

import { CITIES } from './data/cities.js';
import { ConstellationScene } from './scenes/constellation.js';
import { DescentScene } from './scenes/descent.js';
import { VenueScene } from './scenes/venue.js';
import { RadialMenu } from './components/radialMenu.js';
import { AudioSystem } from './utils/audio.js';
import { lerp } from './utils/math.js';

export const STATES = ['LOADING', 'INTRO', 'CONSTELLATION', 'DESCENDING', 'VENUE', 'ASCENDING'];

const TIMINGS = {
  introFade: 0.9,        // intro line fades in
  introHold: 2.0,        // holds
  introOut: 0.8,         // dissolves to stars
  constellationPause: 1.4, // breath between ascent and the next descent
};

const SCRAMBLE_CHARS = '█▓▒░<>/\\|=+*·:×ØΔ';

export class App {
  constructor(opts = {}) {
    this.t = { ...TIMINGS, ...(opts.timings || {}) };
    this.state = 'LOADING';
    this.cityIndex = 0;
    this.pendingCity = 0;
    this.calm = false;
    this._timer = null;
    this._autoDescend = false;
    this._homeReturn = false;
    this._scrambles = new Set();

    const canvas = document.getElementById('stage');
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      220
    );

    this.constellation = new ConstellationScene(this.renderer, this.camera);
    this.descent = new DescentScene(this.camera);
    this.venue = new VenueScene(this.renderer, this.camera);
    this.venue.setupControls(canvas);

    this.strobeEl = document.getElementById('fx-strobe');
    this.venue.onStrobe = (v) => {
      if (this.strobeEl) this.strobeEl.style.opacity = v;
    };

    this.audio = new AudioSystem();
    this.menu = new RadialMenu(CITIES, (i) => this.selectCity(i));

    this._buildIntro();
    this._buildHud();
    this._buildHomeBtn();
    this._initCursor();

    this.constellation.onEnter = () => this.enterNight();

    window.addEventListener('resize', () => this._resize());

    this.clock = new THREE.Clock();
    this._running = false;
  }

  // ----------------------------------------------------------
  // overlays
  // ----------------------------------------------------------

  _mount() {
    return document.getElementById('ui-root') || document.body;
  }

  _buildIntro() {
    this.intro = document.createElement('div');
    this.intro.className = 'intro';
    this.introLine = document.createElement('div');
    this.introLine.className = 'intro-line';
    this.introLine.textContent = 'six frequencies. all playing now.';
    this.intro.appendChild(this.introLine);
    this._mount().appendChild(this.intro);
  }

  _buildHud() {
    this.hud = document.createElement('div');
    this.hud.className = 'hud';

    this.hudTag = document.createElement('div');
    this.hudTag.className = 'hud-tag';
    this.hudCity = document.createElement('div');
    this.hudCity.className = 'hud-city';
    this.hudCoords = document.createElement('div');
    this.hudCoords.className = 'hud-coords';
    this.hudLore = document.createElement('div');
    this.hudLore.className = 'hud-lore';

    this.hud.appendChild(this.hudTag);
    this.hud.appendChild(this.hudCity);
    this.hud.appendChild(this.hudCoords);
    this.hud.appendChild(this.hudLore);
    this._mount().appendChild(this.hud);

    this.calmBtn = document.createElement('button');
    this.calmBtn.className = 'calm-toggle';
    this.calmBtn.textContent = '⏸ MOTION';
    this.calmBtn.setAttribute('aria-pressed', 'false');
    this.calmBtn.setAttribute('title', 'pause all motion & effects');
    this.calmBtn.addEventListener('click', () => this.setCalm(!this.calm));
    this._mount().appendChild(this.calmBtn);
  }

  _buildHomeBtn() {
    this.homeBtn = document.createElement('button');
    this.homeBtn.className = 'home-btn';
    this.homeBtn.textContent = 'NYX/ARA';
    this.homeBtn.addEventListener('click', () => this._returnHome());
    this._mount().appendChild(this.homeBtn);
  }

  _returnHome() {
    if (this.state !== 'VENUE') return;
    this._homeReturn = true;
    this.pendingCity = this.cityIndex;
    this.setState('ASCENDING');
  }

  _initCursor() {
    this.cursorEl = document.getElementById('cursor');
    this._cx = window.innerWidth / 2;
    this._cy = window.innerHeight / 2;
    this._tx = this._cx;
    this._ty = this._cy;

    document.addEventListener('mousemove', (e) => {
      this._tx = e.clientX;
      this._ty = e.clientY;
    });
    document.addEventListener('mouseover', (e) => {
      if (!this.cursorEl || !e.target || !e.target.closest) return;
      const hot = e.target.closest('.nyx-door, .radial-item, .calm-toggle, .home-btn');
      this.cursorEl.classList.toggle('over', !!hot);
    });
    document.addEventListener('pointerdown', () => {
      this.cursorEl && this.cursorEl.classList.add('down');
    });
    document.addEventListener('pointerup', () => {
      this.cursorEl && this.cursorEl.classList.remove('down');
    });
  }

  // characters resolve from ASCII noise
  scrambleIn(el, text, duration = 0.85, delay = 0) {
    if (!el) return;
    if (el._scrCancel) el._scrCancel();
    let dead = false;
    el._scrCancel = () => { dead = true; this._scrambles.delete(el._scrCancel); };
    this._scrambles.add(el._scrCancel);

    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + delay * 1000;
    const step = () => {
      if (dead) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const p = Math.min(Math.max((now - start) / (duration * 1000), 0), 1);
      const locked = Math.floor(p * text.length);
      let out = text.slice(0, locked);
      for (let i = locked; i < text.length; i++) {
        out += text[i] === ' '
          ? ' '
          : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = text;
        el._scrCancel();
      }
    };
    window.requestAnimationFrame(step);
  }

  _revealHud(city) {
    this.hud.style.setProperty('--c', city.colors.primary);
    this.hud.classList.add('visible');
    this.scrambleIn(this.hudTag, city.venue + ' · ' + city.tag, 0.7, 0.15);
    this.scrambleIn(this.hudCity, city.name, 0.9, 0);
    this.scrambleIn(this.hudCoords, city.coordinates, 0.8, 0.25);
    this.scrambleIn(this.hudLore, city.lore, 1.1, 0.4);
  }

  _setAccent(hex) {
    if (document.documentElement && document.documentElement.style.setProperty) {
      document.documentElement.style.setProperty('--accent', hex);
    }
  }

  // ----------------------------------------------------------
  // state machine
  // ----------------------------------------------------------

  setState(next) {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.state = next;
    const city = CITIES[this.cityIndex];

    switch (next) {
      case 'INTRO': {
        this.intro.classList.add('visible');
        this._timer = setTimeout(() => {
          this.intro.classList.remove('visible');
          this._timer = setTimeout(
            () => this.setState('CONSTELLATION'),
            this.t.introOut * 1000
          );
        }, (this.t.introFade + this.t.introHold) * 1000);
        break;
      }

      case 'CONSTELLATION': {
        this.constellation.show(city.colors.constellation);
        if (this._autoDescend) {
          this._timer = setTimeout(
            () => this.setState('DESCENDING'),
            this.t.constellationPause * 1000
          );
        }
        break;
      }

      case 'DESCENDING': {
        this._autoDescend = false;
        this.constellation.hide();
        this.venue.load(city); // build the room while we fall toward it
        this.descent.play(city.colors.primary, () => this.setState('VENUE'));
        break;
      }

      case 'VENUE': {
        this.venue.show(city);
        this.venue.setCalm(this.calm);
        this.menu.show();
        this.menu.setActiveCity(this.cityIndex);
        this.audio.startAmbient(city);
        this._revealHud(city);
        this._setAccent(city.colors.primary);
        if (typeof document !== 'undefined' && 'title' in document) {
          document.title = `NYXARA — ${city.name} ${city.coordinates}`;
        }
        break;
      }

      case 'ASCENDING': {
        this.audio.stopAmbient();
        this.menu.hide();
        this.hud.classList.remove('visible');
        this.venue.hide();
        this.descent.playReverse(() => {
          this.cityIndex = this.pendingCity;
          if (this._homeReturn) {
            this._homeReturn = false;
            this._autoDescend = false;
            this.constellation.setTint('#7c3aed');
          } else {
            this._autoDescend = true;
          }
          this.setState('CONSTELLATION');
        });
        break;
      }
    }
  }

  enterNight() {
    if (this.state !== 'CONSTELLATION') return;
    this.audio.unlock(); // user gesture — the only place a context may be born
    if (this._autoDescend) {
      // door clicked during the transient pause: descend immediately
      this._autoDescend = false;
    }
    this.setState('DESCENDING');
  }

  selectCity(i) {
    if (this.state !== 'VENUE' || i === this.cityIndex) return;
    this.pendingCity = i;
    this.setState('ASCENDING');
  }

  setCalm(on) {
    this.calm = on;
    document.body.classList.toggle('calm', on);
    this.venue.setCalm(on);
    this.calmBtn.textContent = on ? '▶ MOTION' : '⏸ MOTION';
    this.calmBtn.setAttribute('aria-pressed', String(on));
    this.calmBtn.classList.toggle('on', on);
  }

  // ----------------------------------------------------------
  // loop
  // ----------------------------------------------------------

  async boot() {
    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 2500)),
        ]);
      }
    } catch (e) { /* fonts are decoration, not a dependency */ }

    const bootEl = document.getElementById('boot');
    if (bootEl) bootEl.classList.add('gone');

    this._running = true;
    const loop = () => {
      if (!this._running) return;
      window.requestAnimationFrame(loop);
      this._frame(this.clock.getElapsedTime());
    };
    loop();

    this.setState('INTRO');
  }

  stop() {
    this._running = false;
  }

  _frame(time) {
    // cursor chases the pointer
    if (this.cursorEl) {
      this._cx = lerp(this._cx, this._tx, 0.3);
      this._cy = lerp(this._cy, this._ty, 0.3);
      this.cursorEl.style.left = this._cx + 'px';
      this.cursorEl.style.top = this._cy + 'px';
    }

    switch (this.state) {
      case 'INTRO':
      case 'CONSTELLATION':
        this.constellation.update(time);
        this.renderer.render(this.constellation.scene, this.camera);
        break;

      case 'DESCENDING':
      case 'ASCENDING': {
        this.descent.update(time); // completion callback may flip state
        const scene =
          this.state === 'VENUE' ? this.venue.scene :
          this.state === 'CONSTELLATION' ? this.constellation.scene :
          this.descent.scene;
        this.renderer.render(scene, this.camera);
        break;
      }

      case 'VENUE':
        this.venue.update(time);
        this.renderer.render(this.venue.scene, this.camera);
        break;
    }
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// ------------------------------------------------------------
// boot in the browser; tests construct App themselves
// ------------------------------------------------------------

const isBrowser =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  !window.__NYX_TEST__;

if (isBrowser) {
  try {
    const app = new App();
    window.NYXARA = app;
    app.boot();
  } catch (err) {
    const bootText = document.querySelector('.boot-text');
    if (bootText) {
      bootText.textContent = 'this device cannot open the portal (WebGL required)';
    }
    console.error('NYXARA failed to ignite:', err);
  }
}
