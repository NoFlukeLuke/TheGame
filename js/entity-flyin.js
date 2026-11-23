// ── THE FLY-IN (r805, owner) ─────────────────────────────────────────────────
// When a screen shows something you already OWN (an improvement to pick, the Trick
// you invest, the entities on Spin to Improve's and Entity Slots' reels, a Trick to
// cut or permaprime, the store's "you own this" shelf) or your own CARDS (every card
// event's deck picker, Card Slots' reels), it does not simply appear: it FLIES from
// where it lives (its tray chip, the Sleight on the board, RECORDS for a card) to
// its place on the screen, and leaves a dotted outline in its rarity colour behind
// until the screen is gone. A soft riffle plays as a batch takes its places. The
// flight is approximate on purpose: close is enough.
//
// efiScan(root)   every owned entity tile under `root` (entityTileHTML stamps
//                 data-ent-id; the Balance Sheet and the store stamp it themselves)
// efiCardsIn(els) card slots (the deck picker): copies from RECORDS
// efiBurst(srcs, rect, n, done)  a handful of copies into a rect (the slot window)
const EFI = { ms: 620, stagger: 60, cardMs: 480, cardStagger: 40, max: 14, tick: 400 };
let _efiGhosts = [], _efiTimer = null, _efiBatchAt = 0;
function efiOn() {
  if (document.body.classList.contains('reduced-motion')) return false;
  if (typeof skipOn === 'function' && skipOn('transitions')) return false;
  return true;
}
function efiRecordsEl() { return document.getElementById('btn-records'); }
// Where an owned entity lives on screen right now.
function efiSourceEl(type, id) {
  if (typeof danceEntityEl !== 'function') return null;
  try { return danceEntityEl(type, id); } catch (e) { return null; }
}
function efiTypeOf(el) {
  return el.classList.contains('entity-trick') ? 'trick' : el.classList.contains('entity-knack') ? 'knack' : el.classList.contains('entity-sleight') ? 'sleight' : null;
}
function efiSfx() {
  const now = performance.now();
  if (now - _efiBatchAt < 400) return;
  _efiBatchAt = now;
  try { if (typeof sfxFlipShuffle === 'function') sfxFlipShuffle(); } catch (e) {}
}
// The ghost: the source wears .efi-gone (css/entity-flyin.css) while its copy is on a screen.
function efiGhostAdd(type, id, dest) {
  _efiGhosts.push({ type, id, dest });
  efiGhostPaint();
  if (!_efiTimer) _efiTimer = setInterval(efiGhostTick, EFI.tick);
}
function efiGhostPaint() {
  _efiGhosts.forEach(g => { const src = efiSourceEl(g.type, g.id); if (src && !src.classList.contains('efi-gone')) src.classList.add('efi-gone'); });
}
function efiGhostTick() {
  const gone = [];
  _efiGhosts = _efiGhosts.filter(g => {
    const live = g.dest && g.dest.isConnected && g.dest.offsetParent !== null;
    if (!live) gone.push(g);
    return live;
  });
  gone.forEach(g => { if (!_efiGhosts.some(x => x.type === g.type && x.id === g.id)) { const src = efiSourceEl(g.type, g.id); if (src) src.classList.remove('efi-gone'); } });
  document.querySelectorAll('.efi-gone').forEach(el => {
    const t = el.dataset.trickId ? 'trick' : el.dataset.knackId ? 'knack' : 'sleight';
    const id = el.dataset.trickId || el.dataset.knackId || null;
    if (id && !_efiGhosts.some(g => g.type === t && g.id === id)) el.classList.remove('efi-gone');
  });
  efiGhostPaint();   // a re-rendered chip comes back without the class
  if (!_efiGhosts.length) { clearInterval(_efiTimer); _efiTimer = null; }
}
// One flight: a copy of `dest` from `src`'s box to its own. The copy is drawn at the
// destination's zoom (r503: its px are then design px).
function efiFly(src, dest, i, ms) {
  const a = src.getBoundingClientRect(), b = dest.getBoundingClientRect();
  if (!a.width || !b.width || !dest.offsetWidth) return false;
  const zoom = b.width / dest.offsetWidth || 1;
  const c = dest.cloneNode(true);
  c.removeAttribute('id'); c.classList.add('efi-copy'); c.classList.remove('selected', 'selectable', 'unselectable', 'picked');
  c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  c.style.cssText = `position:fixed;left:${b.left / zoom}px;top:${b.top / zoom}px;width:${dest.offsetWidth}px;height:${dest.offsetHeight}px;zoom:${zoom};margin:0;z-index:10002;pointer-events:none;transform-origin:center;visibility:visible;opacity:1;`;
  document.body.appendChild(c);
  const dx = (a.left + a.width / 2 - (b.left + b.width / 2)) / zoom, dy = (a.top + a.height / 2 - (b.top + b.height / 2)) / zoom;
  const s0 = Math.max(.25, Math.min(2.5, a.width / b.width));
  dest.classList.add('efi-wait');
  const slow = (typeof animSlow === 'function') ? animSlow() : 1;
  const anim = c.animate([
    { translate: `${dx}px ${dy}px`, scale: s0, opacity: 0, filter: 'brightness(1.5)' },
    { translate: `${dx}px ${dy}px`, scale: s0, opacity: 1, filter: 'brightness(1.5)', offset: .08 },
    { translate: `${dx * .5}px ${dy * .5 - 18}px`, scale: (s0 + 1) / 2 * 1.06, opacity: 1, filter: 'brightness(1.25)', offset: .55 },
    { translate: '0 0', scale: 1.04, opacity: 1, filter: 'brightness(1.1)', offset: .9 },
    { translate: '0 0', scale: 1, opacity: 1, filter: 'none' }],
    { duration: ms * slow, delay: i * EFI.stagger * slow, easing: 'cubic-bezier(.3,.6,.35,1)', fill: 'both' });
  let done = false;
  const end = () => { if (done) return; done = true; dest.classList.remove('efi-wait'); c.remove(); };
  anim.onfinish = end; setTimeout(end, (ms + i * EFI.stagger) * slow + 150);
  return true;
}
// Every owned entity tile under root flies in from its tray, once.
function efiScan(root) {
  root = root || document;
  if (!root.querySelectorAll) return;
  const tiles = [...root.querySelectorAll('.reward-cell.entity[data-ent-id]')].filter(el => !el.dataset.efiDone && !el.closest('.evt-sym') && !el.closest('.efi-copy'));
  if (!tiles.length) return;
  let i = 0, any = false;
  tiles.forEach(el => {
    el.dataset.efiDone = '1';
    const id = el.dataset.entId, type = efiTypeOf(el);
    if (!id || !type) return;
    if (typeof entityOwnedNow === 'function' && !entityOwnedNow(id)) return;
    const src = efiSourceEl(type, id); if (!src || src === el || src.contains(el)) return;
    efiGhostAdd(type, id, el);
    if (!efiOn()) return;
    if (efiFly(src, el, Math.min(i, EFI.max), EFI.ms)) { any = true; i++; }
  });
  if (any) efiSfx();
}
// Card slots: copies from RECORDS, the first EFI.max of them; the rest just show.
function efiCardsIn(slots) {
  if (!efiOn() || !slots || !slots.length) return;
  const rec = efiRecordsEl(); if (!rec || !rec.offsetWidth) return;
  let i = 0, any = false;
  slots.forEach(el => {
    if (el.dataset.efiDone) return; el.dataset.efiDone = '1';
    if (i >= EFI.max) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const view = el.closest('.edp-view'); if (view) { const v = view.getBoundingClientRect(); if (r.top > v.bottom || r.bottom < v.top) return; }
    if (efiFly(rec, el, i, EFI.cardMs)) { any = true; i++; }
  });
  if (any) efiSfx();
}
// A burst of n small copies from `srcs` (elements) into a rect: the slot window
// filling as its reels turn. The copies are the sources' own pictures.
function efiBurst(srcs, rect, n, done) {
  const list = (srcs || []).filter(Boolean);
  if (!efiOn() || !list.length || !rect || !rect.width) { if (done) done(); return; }
  const slow = (typeof animSlow === 'function') ? animSlow() : 1;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  for (let i = 0; i < n; i++) {
    const src = list[i % list.length], a = src.getBoundingClientRect();
    if (!a.width) continue;
    const zoom = a.width / (src.offsetWidth || 1) || 1;
    const c = src.cloneNode(true); c.removeAttribute('id'); c.classList.add('efi-copy'); c.classList.remove('efi-gone');
    c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    c.style.cssText = `position:fixed;left:${a.left / zoom}px;top:${a.top / zoom}px;width:${src.offsetWidth}px;height:${src.offsetHeight}px;zoom:${zoom};margin:0;z-index:10002;pointer-events:none;transform-origin:center;`;
    document.body.appendChild(c);
    const tx = (cx + (fxRandom() - .5) * rect.width * .7 - (a.left + a.width / 2)) / zoom, ty = (cy + (fxRandom() - .5) * rect.height * .6 - (a.top + a.height / 2)) / zoom;
    const anim = c.animate([
      { translate: '0 0', scale: 1, opacity: 0 }, { translate: '0 0', scale: 1, opacity: 1, offset: .1 },
      { translate: `${tx * .55}px ${ty * .55 - 20}px`, scale: .8, opacity: 1, offset: .6 },
      { translate: `${tx}px ${ty}px`, scale: .45, opacity: 0 }],
      { duration: 560 * slow, delay: i * 55 * slow, easing: 'cubic-bezier(.4,.4,.3,1)', fill: 'both' });
    anim.onfinish = () => c.remove(); setTimeout(() => c.remove(), (560 + i * 55) * slow + 120);
  }
  efiSfx();
  setTimeout(() => { if (done) done(); }, (380 + Math.min(n, 6) * 55) * slow);
}
