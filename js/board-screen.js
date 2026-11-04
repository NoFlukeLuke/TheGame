// ══ THE BOARD SCREEN (r644, owner) ═════════════════════════════════════════
// A small event-style screen laid over the board's box: the amber glass of the
// improvement animation (r632) and the event lab's WIREFRAME look (r593), with a
// typed header, a body of boxes and a row of keys at the foot. Body-level, zoomed
// like the stage, so everything inside is design px (r503's rule).
//
// boardScreenOpen({ head, html, keys, peek, cls, zIndex, onClose }) draws one and
// returns a controller: { el, body, close(), place() }. `keys` are
// { label, fn, primary, dim }; `peek: true` adds a PEEK key that hides the screen
// so the board under it can be read (the lines a position Trick marks), and
// brings it back on the next tap. Only one screen is up at a time; opening a
// second closes the first. The row chooser (Surveyor / Leveler, js/scoring.js)
// and the Limit Break (js/limit-break.js, console mode) use it.
let _bsLayer = null, _bsOpen = null;
function bsStage() {
  const st = document.getElementById('stage'); if (!st) return null;
  const sr = st.getBoundingClientRect(), z = sr.width / (st.offsetWidth || 1);
  return z > 0.01 ? { st, sr, z } : null;
}
function bsRectOf(el, S) {
  const r = el.getBoundingClientRect();
  return { l: (r.left - S.sr.left) / S.z, t: (r.top - S.sr.top) / S.z, w: r.width / S.z, h: r.height / S.z };
}
// The box the screen covers: the board's slot, in the stage's design px.
function bsBoardBox(S) {
  const slot = document.getElementById('grid-slot') || document.getElementById('grid');
  const g = slot ? bsRectOf(slot, S) : null;
  if (g && g.w > 40 && g.h > 40) return g;
  return { l: S.st.offsetWidth * .1, t: S.st.offsetHeight * .1, w: S.st.offsetWidth * .8, h: S.st.offsetHeight * .8 };
}
function bsLayer(S) {
  if (!_bsLayer || !_bsLayer.isConnected) {
    _bsLayer = document.createElement('div'); _bsLayer.id = 'bs-layer';
    document.body.appendChild(_bsLayer);
    // After the turn (as lbConsolePlace): bootstrap toggles .landscape later, then the slot slides.
    const go = () => { if (_bsOpen) _bsOpen.place(); };
    window.addEventListener('resize', () => { setTimeout(go, 0); setTimeout(go, 400); });
  }
  const s = _bsLayer.style;
  s.zoom = S.z;
  s.left = (S.sr.left / S.z) + 'px'; s.top = (S.sr.top / S.z) + 'px';
  s.width = S.st.offsetWidth + 'px'; s.height = S.st.offsetHeight + 'px';
  return _bsLayer;
}
function bsEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// Types a line at the game's text speed (Settings -> Display -> Text speed);
// every character holds its room first so nothing reflows. Resolves when done;
// `ctl.finishTyping()` ends it at once (a tap anywhere on the screen).
function bsType(el, ctl) {
  const units = [];
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) {
      const frag = document.createDocumentFragment();
      for (const ch of c.textContent) { const i = document.createElement('i'); i.className = 'bs-ch bs-tu'; i.textContent = ch; frag.appendChild(i); units.push(i); }
      c.replaceWith(frag);
    } else walk(c);
  });
  walk(el);
  const cur = document.createElement('i'); cur.className = 'bs-cur typing'; el.appendChild(cur);
  const cps = (typeof textTypeCps === 'function') ? textTypeCps() : 160;
  const per = cps > 0 ? 1000 / cps : 0;
  return new Promise(res => {
    let k = 0, t = 0;
    const done = () => { clearTimeout(t); units.forEach(u => u.classList.remove('bs-tu')); cur.classList.remove('typing'); if (units.length) units[units.length - 1].after(cur); ctl.finishTyping = null; res(); };
    ctl.finishTyping = done;
    const step = () => {
      if (k >= units.length || per === 0) return done();
      const u = units[k++]; u.classList.remove('bs-tu'); u.after(cur);
      t = setTimeout(step, u.textContent === ' ' ? 0 : per);
    };
    step();
  });
}
function boardScreenOpen(opts) {
  const S = bsStage(); if (!S) return null;
  if (_bsOpen) _bsOpen.close(true);
  const layer = bsLayer(S);
  if (opts.zIndex) layer.style.zIndex = opts.zIndex; else layer.style.removeProperty('z-index');
  const el = document.createElement('div'); el.className = 'bs-screen' + (opts.cls ? ' ' + opts.cls : '');
  el.innerHTML = `<div class="bs-head"></div><div class="bs-body"></div><div class="bs-keys"></div>`;
  const head = el.querySelector('.bs-head'), body = el.querySelector('.bs-body'), keysEl = el.querySelector('.bs-keys');
  if (typeof opts.html === 'string') body.innerHTML = opts.html; else if (opts.html) body.appendChild(opts.html);
  const ctl = { el, body, head, keys: keysEl, peeking: false, finishTyping: null };
  const mkKey = (k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bs-key' + (k.primary ? ' bs-primary' : '') + (k.dim ? ' bs-dim' : '');
    b.textContent = k.label; if (k.id) b.id = k.id;
    b.addEventListener('click', e => { e.stopPropagation(); k.fn && k.fn(ctl, b); });
    keysEl.appendChild(b); return b;
  };
  if (opts.peek) {
    const pk = mkKey({ label: 'PEEK', fn: () => ctl.peek(!ctl.peeking) });
    pk.classList.add('bs-peek-key');
    ctl.peek = (on) => { ctl.peeking = !!on; el.classList.toggle('bs-peeking', ctl.peeking); pk.textContent = ctl.peeking ? 'BACK' : 'PEEK'; };
  }
  (opts.keys || []).forEach(mkKey);
  ctl.place = () => {
    const S2 = bsStage(); if (!S2) return;
    bsLayer(S2);
    const g = opts.box ? opts.box(S2) : bsBoardBox(S2);
    el.style.left = g.l + 'px'; el.style.top = g.t + 'px'; el.style.width = g.w + 'px'; el.style.height = g.h + 'px';
  };
  ctl.close = (quiet) => {
    if (_bsOpen !== ctl) return;
    _bsOpen = null;
    if (ctl.finishTyping) ctl.finishTyping();
    const off = () => { el.remove(); layer.classList.toggle('bs-on', !!_bsOpen); if (!quiet && opts.onClose) opts.onClose(); };
    if (quiet || (typeof skipOn === 'function' && skipOn('transitions')) || document.body.classList.contains('reduced-motion')) { off(); return; }
    try { el.animate([{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(50% 0 50% 0)', opacity: .5 }], { duration: 150, easing: 'ease-in', fill: 'forwards' }).finished.then(off, off); } catch (e) { off(); }
  };
  // A tap on the screen itself finishes the typing.
  el.addEventListener('pointerdown', () => { if (ctl.finishTyping) ctl.finishTyping(); });
  ctl.place();
  layer.appendChild(el); layer.classList.add('bs-on');
  _bsOpen = ctl;
  if (!(typeof skipOn === 'function' && skipOn('transitions')) && !document.body.classList.contains('reduced-motion')) {
    try { el.animate([{ clipPath: 'inset(50% 0 50% 0)', opacity: .6 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 180, easing: 'ease-out' }); } catch (e) {}
    try { if (typeof sfxPrintFeed === 'function') sfxPrintFeed(); } catch (e) {}
  }
  if (opts.head) { head.textContent = opts.head; bsType(head, ctl); }
  return ctl;
}
function boardScreenOpenNow() { return _bsOpen; }
function boardScreenClose() { if (_bsOpen) _bsOpen.close(true); }
