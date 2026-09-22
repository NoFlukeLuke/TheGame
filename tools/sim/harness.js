// Loads the real game JS (classic scripts, shared global scope) into a Node vm
// context with a proxy DOM, so calcScore / findBestHand / goalForLevel / the
// entity pools are the real ones. Usage: const G = require('./harness').load();
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = require('path').resolve(__dirname, '..', '..');

function makeStyle() {
  const t = {};
  t.setProperty = (k, v) => { t[k] = v; };
  t.getPropertyValue = (k) => t[k] ?? '';
  t.removeProperty = (k) => { delete t[k]; };
  return new Proxy(t, { get: (o, k) => o[k] ?? '', set: (o, k, v) => { o[k] = v; return true; } });
}
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: makeStyle(),
    dataset: {},
    children: [],
    childNodes: [],
    attributes: {},
    _listeners: {},
    parentNode: null,
    parentElement: null,
    innerHTML: '', textContent: '', innerText: '', value: '', id: '',
    className: '',
    offsetWidth: 100, offsetHeight: 100, clientWidth: 100, clientHeight: 100,
    scrollWidth: 100, scrollHeight: 100, offsetParent: null, offsetLeft: 0, offsetTop: 0,
    disabled: false, checked: false, hidden: false,
  };
  el.classList = {
    _set: new Set(),
    add(...c) { c.forEach(x => this._set.add(x)); },
    remove(...c) { c.forEach(x => this._set.delete(x)); },
    toggle(c, f) { if (f === undefined) f = !this._set.has(c); f ? this._set.add(c) : this._set.delete(c); return f; },
    contains(c) { return this._set.has(c); },
  };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 });
  el.appendChild = (c) => { el.children.push(c); el.childNodes.push(c); if (c && typeof c === 'object') { c.parentNode = el; c.parentElement = el; } return c; };
  el.append = (...cs) => cs.forEach(c => { if (typeof c === 'object') el.appendChild(c); });
  el.prepend = el.append;
  el.insertBefore = (c) => el.appendChild(c);
  el.removeChild = (c) => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; };
  el.remove = () => {};
  el.replaceChildren = () => { el.children = []; el.childNodes = []; };
  el.querySelector = () => makeEl('div');
  el.querySelectorAll = () => [];
  el.getElementsByClassName = () => [];
  el.closest = () => null;
  el.contains = () => false;
  el.matches = () => false;
  el.addEventListener = (t, fn) => { (el._listeners[t] = el._listeners[t] || []).push(fn); };
  el.removeEventListener = () => {};
  el.dispatchEvent = () => true;
  el.setAttribute = (k, v) => { el.attributes[k] = String(v); if (k === 'id') el.id = v; };
  el.getAttribute = (k) => (k in el.attributes ? el.attributes[k] : null);
  el.removeAttribute = (k) => { delete el.attributes[k]; };
  el.hasAttribute = (k) => k in el.attributes;
  el.focus = () => {}; el.blur = () => {}; el.click = () => {};
  el.animate = () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {}, addEventListener() {}, onfinish: null });
  el.getAnimations = () => [];
  el.getContext = () => new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => {}) });
  el.firstElementChild = null; el.lastElementChild = null; el.firstChild = null; el.nextElementSibling = null;
  el.cloneNode = () => makeEl(tag);
  el.insertAdjacentHTML = () => {};
  el.scrollTo = () => {}; el.scrollIntoView = () => {};
  return el;
}

function load(opts = {}) {
  const byId = new Map();
  const getById = (id) => { if (!byId.has(id)) { const e = makeEl('div'); e.id = id; byId.set(id, e); } return byId.get(id); };

  const documentStub = {
    getElementById: getById,
    createElement: (t) => makeEl(t),
    createElementNS: (ns, t) => makeEl(t),
    createTextNode: (t) => ({ textContent: t }),
    createDocumentFragment: () => makeEl('fragment'),
    querySelector: () => makeEl('div'),
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: makeEl('body'),
    head: makeEl('head'),
    documentElement: makeEl('html'),
    fonts: { ready: Promise.resolve(), addEventListener: () => {} },
    hidden: false,
    visibilityState: 'visible',
    elementFromPoint: () => null,
    hasFocus: () => true,
  };

  const storage = new Map();
  const localStorageStub = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    key: (i) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  };
  if (opts.localStorage) for (const [k, v] of Object.entries(opts.localStorage)) storage.set(k, v);

  const quietConsole = { log(){}, warn(){}, error(){}, info(){}, debug(){}, group(){}, groupEnd(){}, table(){} };
  const sandbox = {
    console: quietConsole,
    document: documentStub,
    localStorage: localStorageStub,
    sessionStorage: localStorageStub,
    navigator: { userAgent: 'node-sim', maxTouchPoints: 0, language: 'en' },
    location: { href: 'file:///index.html', search: '', hash: '', reload: () => {} },
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
    getComputedStyle: () => new Proxy({}, { get: (t, k) => (k === 'getPropertyValue' ? () => '' : '') }),
    innerWidth: 1440, innerHeight: 820, devicePixelRatio: 1,
    addEventListener: () => {}, removeEventListener: () => {},
    alert: () => {}, confirm: () => true, prompt: () => null,
    fetch: () => Promise.reject(new Error('no fetch in sim')),
    Image: function () { return { addEventListener: () => {} }; },
    Audio: function () { return { play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {}, load: () => {} }; },
    AudioContext: undefined,
    Math, JSON, Object, Array, Number, String, Boolean, Date, RegExp, Map, Set, WeakMap, WeakSet,
    Promise, Symbol, Error, TypeError, RangeError, parseInt, parseFloat, isNaN, isFinite,
    Infinity, NaN, undefined,
    structuredClone: (x) => JSON.parse(JSON.stringify(x)),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);

  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...idx.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const errors = [];
  for (const s of srcs) {
    const code = fs.readFileSync(path.join(ROOT, s), 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: s });
    } catch (e) {
      errors.push({ file: s, err: String(e && e.message || e) });
    }
  }

  const G = {
    ctx,
    errors,
    eval: (code) => vm.runInContext(code, ctx),
    get: (name) => vm.runInContext(name, ctx),
    byId,
  };
  return G;
}

module.exports = { load };
