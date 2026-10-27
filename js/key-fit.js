// ══ KEY FIT (r672, owner) ══════════════════════════════════════════════════
// "Make sure all words fit on all buttons in all circumstances." The three keys
// (SWAP / DISCARD / PLAY) are borrowed by every board screen and read a dozen
// different things: BUY, REROLL 2 rows, CLOCK IN, SKIP, CONFIRM, REROLL REWARD
// TYPE... Each has its own CSS, several skins and key looks lay their own sizes
// over it with !important, and a desktop console SWAP spilled its word and cost
// out of the key (measured 17 design px over at 1440x820, r665).
//
// This is the safety net under all of that: after any change to a key's markup
// or class, its size or the fonts, keyFitAll() measures every text run in each
// key against the key's own box and, if any spills, scales the font-size (and a
// px line-height / letter-spacing) of the key and every element inside it down
// in 4% steps until it fits, never below half. Inline !important beats the
// stylesheets' !important, and clearing the inline values first means a key
// is measured at its CSS size every time, so a takeover that puts a shorter
// word in gets the full size back. Nothing here changes a key's box.
const KEY_FIT_IDS = ['swap-indicator', 'btn-discard', 'btn-play'];
const KEY_FIT_TOL = 0.75;      // design px a glyph may sit past the edge (antialiasing)
const KEY_FIT_LATE_MS = 700;   // the settled second pass
let _kfQueued = false, _kfBusy = false, _kfObs = null, _kfLate = 0;

function _kfStageZoom() {
  const st = document.getElementById('stage'); if (!st) return 1;
  const w = st.getBoundingClientRect().width; return w > 0 ? w / (st.offsetWidth || 1) : 1;
}
// The worst spill of any visible text run past the key's border box, in viewport px.
function _kfOverflow(el) {
  const box = el.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return 0;
  let worst = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const p = n.parentElement; if (!p) continue;
    const cs = getComputedStyle(p);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.fontSize) === 0 || parseFloat(cs.opacity) === 0) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const rr of r.getClientRects()) {
      if (rr.width === 0 || rr.height === 0) continue;
      worst = Math.max(worst, box.left - rr.left, rr.right - box.right, box.top - rr.top, rr.bottom - box.bottom);
    }
  }
  return worst;
}
function _kfClear(el) {
  [el, ...el.querySelectorAll('[data-kf]')].forEach(n => {
    if (!n.hasAttribute('data-kf')) return;
    n.style.removeProperty('font-size'); n.style.removeProperty('line-height'); n.style.removeProperty('letter-spacing');
    n.removeAttribute('data-kf');
  });
}
function keyFitOne(el) {
  _kfClear(el);
  const cs0 = getComputedStyle(el);
  if (cs0.display === 'none' || cs0.visibility === 'hidden') return 1;
  const tol = KEY_FIT_TOL * _kfStageZoom();
  if (_kfOverflow(el) <= tol) return 1;
  // Every element in the key keeps its own ratio to the rest: read all sizes once, scale together.
  const px = v => /px$/.test(v) ? parseFloat(v) : null;
  const targets = [el, ...el.querySelectorAll('*')].map(n => {
    const cs = getComputedStyle(n);
    return { n, fs: parseFloat(cs.fontSize) || 0, lh: px(cs.lineHeight), ls: px(cs.letterSpacing) };
  });
  let k = 1;
  for (let i = 0; i < 13; i++) {
    k = +(k - 0.04).toFixed(2);
    targets.forEach(t => {
      t.n.setAttribute('data-kf', k);
      t.n.style.setProperty('font-size', (t.fs * k).toFixed(2) + 'px', 'important');
      if (t.lh !== null) t.n.style.setProperty('line-height', (t.lh * k).toFixed(2) + 'px', 'important');
      if (t.ls !== null) t.n.style.setProperty('letter-spacing', (t.ls * k).toFixed(2) + 'px', 'important');
    });
    if (_kfOverflow(el) <= tol) break;
  }
  return k;
}
function keyFitAll() {
  if (_kfBusy) return;
  _kfBusy = true;
  try { KEY_FIT_IDS.forEach(id => { const el = document.getElementById(id); if (el) keyFitOne(el); }); }
  finally { _kfBusy = false; }
}
function keyFitQueue() {
  // A second pass once any transition on the key has settled (a word that grows in
  // measured as fitting on the first frame: Flow's split-reroll pick, r672).
  clearTimeout(_kfLate); _kfLate = setTimeout(keyFitAll, KEY_FIT_LATE_MS);
  if (_kfQueued) return;
  _kfQueued = true;
  requestAnimationFrame(() => { _kfQueued = false; keyFitAll(); });
}
// Re-fit on anything that can change a key's words or box: markup (a takeover),
// a class (a skin, a key look, bulbs, armed), the key's size, the stage's size, fonts.
function keyFitWatch() {
  if (_kfObs) return;
  _kfObs = new MutationObserver(muts => {
    if (_kfBusy) return;
    for (const m of muts) {
      // the fitter's own inline writes come back as style / data-kf attribute records: not a change
      if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'data-kf')) continue;
      keyFitQueue(); return;
    }
  });
  const ro = (typeof ResizeObserver === 'function') ? new ResizeObserver(() => keyFitQueue()) : null;
  KEY_FIT_IDS.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    _kfObs.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    if (ro) ro.observe(el);
  });
  // skins and key looks are classes on <html> / <body>
  _kfObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  _kfObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const st = document.getElementById('stage');
  if (st) { _kfObs.observe(st, { attributes: true, attributeFilter: ['class'] }); if (ro) ro.observe(st); }
  window.addEventListener('resize', () => { keyFitQueue(); setTimeout(keyFitQueue, 450); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(keyFitQueue);
  if (document.fonts) document.fonts.addEventListener?.('loadingdone', keyFitQueue);
  keyFitQueue();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', keyFitWatch); else keyFitWatch();

// ══ BORROWED KEYS (r672) ═══════════════════════════════════════════════════
// A board screen that needs keys takes the three (PLAY, DISCARD, SWAP) the way
// the Schedule does (r662, mapKeysTake): the play words stay in the key, hidden
// in place (a display:contents wrapper), and the screen's label is laid over
// them, so every key keeps its exact play size in both orientations and giving
// it back is unwrapping. One owner at a time. keysTake(spec) / keysReturn();
// spec.play / .disc / .swap are { ico, word, sub, title, off, on, fn }. A press
// on a taken key runs its fn (capture listeners bound at load, so the play
// handlers never see it); a key with no word or `off` dims its label and the
// press refuses. The Schedule keeps its own copy of this (it was first).
const KB_IDS = ['btn-play', 'btn-discard', 'swap-indicator'];
let _kbSpec = null, _kbSaved = null;
function kbEls() { return KB_IDS.map(id => document.getElementById(id)); }
function keyLabelHTML(ico, word, sub) {
  const stack = w => `<span class="kb-w">${[...w].join('\n')}</span>`;
  return `<span class="kb-ico">${word ? (ico || '') : ''}</span>`
       + `<span class="kb-word">${String(word || '').split(' ').filter(Boolean).map(stack).join('')}</span>`
       + (sub ? `<span class="kb-sub">${sub}</span>` : '');
}
function keysTaken() { return !!_kbSaved; }
function keysTake(spec) {
  const els = kbEls();
  if (els.some(el => !el)) return;
  if (!_kbSaved) {
    _kbSaved = els.map(el => {
      const keep = document.createElement('span'); keep.className = 'kb-keep';
      while (el.firstChild) keep.appendChild(el.firstChild);
      el.appendChild(keep);
      const lab = document.createElement('span'); lab.className = 'kb'; el.appendChild(lab);
      return { title: el.title, disabled: el.disabled };
    });
    document.body.classList.add('kb-keys');
  }
  _kbSpec = spec || {};
  keysSync();
}
function keysSync() {
  if (!_kbSaved || !_kbSpec) return;
  const [play, disc, swap] = kbEls();
  [[play, _kbSpec.play], [disc, _kbSpec.disc], [swap, _kbSpec.swap]].forEach(([el, k]) => {
    if (!el) return;
    const lab = el.querySelector(':scope > .kb'); if (!lab) return;
    const html = keyLabelHTML(k && k.ico, k && k.word, k && k.sub);
    if (lab._html !== html) { lab.innerHTML = html; lab._html = html; }
    el.title = (k && k.title) || '';
    el.disabled = false;
    el.classList.toggle('kb-off', !k || !!k.off || !k.word);
    el.classList.toggle('kb-on', !!(k && k.on));
  });
}
function keysReturn() {
  if (!_kbSaved) return;
  kbEls().forEach((el, i) => {
    if (!el) return;
    el.querySelector(':scope > .kb')?.remove();
    const keep = el.querySelector(':scope > .kb-keep');
    if (keep) { while (keep.firstChild) el.insertBefore(keep.firstChild, keep); keep.remove(); }
    const sv = _kbSaved[i];
    el.title = sv.title; el.disabled = sv.disabled;
    el.classList.remove('kb-on', 'kb-off');
  });
  _kbSaved = null; _kbSpec = null;
  document.body.classList.remove('kb-keys');
}
KB_IDS.forEach((id, i) => document.getElementById(id)?.addEventListener('click', e => {
  if (!_kbSpec) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const k = [_kbSpec.play, _kbSpec.disc, _kbSpec.swap][i];
  if (k && k.fn && k.word && !k.off) k.fn();
  else if (typeof refuse === 'function') refuse();
}, true));
