// Minimal DOM stub so overlay-building modules can run headless.
// Components keep direct element references (no querySelector needed).

class StubClassList {
  constructor() { this._s = new Set(); }
  add(...c) { c.forEach((x) => this._s.add(x)); }
  remove(...c) { c.forEach((x) => this._s.delete(x)); }
  contains(c) { return this._s.has(c); }
  toggle(c, force) {
    const want = force === undefined ? !this._s.has(c) : force;
    want ? this._s.add(c) : this._s.delete(c);
    return want;
  }
}

class StubStyle {
  setProperty(k, v) { this[k] = v; }
}

export class StubElement {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new StubClassList();
    this.style = new StubStyle();
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this._html = '';
    this.textContent = '';
  }
  get className() { return [...this.classList._s].join(' '); }
  set className(v) { this.classList._s = new Set(v.split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) {
    if (this.listeners[t]) this.listeners[t] = this.listeners[t].filter((f) => f !== fn);
  }
  dispatch(type, evt = {}) {
    (this.listeners[type] || []).forEach((fn) => fn({ type, preventDefault() {}, stopPropagation() {}, ...evt }));
  }
  getContext() { return null; } // canvas stub → components fall back gracefully
}

export function installDom() {
  const registry = new Map();
  const body = new StubElement('body');

  const doc = {
    body,
    documentElement: new StubElement('html'),
    createElement: (tag) => new StubElement(tag),
    getElementById: (id) => {
      if (!registry.has(id)) {
        const el = new StubElement('div');
        el.attributes.id = id;
        body.appendChild(el);
        registry.set(id, el);
      }
      return registry.get(id);
    },
    addEventListener() {},
    removeEventListener() {},
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
    hidden: false,
  };

  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 16),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };

  globalThis.document = doc;
  globalThis.window = win;
  return { document: doc, window: win, body };
}
