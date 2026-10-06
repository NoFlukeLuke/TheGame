// ══════════════════════════════════════════════
// STOCK BULBS (r497) - small lamps in place of the x/y stock readouts
// ══════════════════════════════════════════════
// One bulb per point of a limit's MAX, set beside the thing it counts:
//   Swaps / Discards : a column between the board and the key. Green = a use left,
//                      red = used this round, dim = not unlocked yet.
//   Hand / Tricks    : a row on the tray's rim, or just beneath it (`trick` setting).
//                      Green = free, blue = in use, dim = not unlocked yet.
// A limit that goes up lights its new bulb with a flicker, a flash, then settles.
// The x/y readouts they replace are hidden (visibility, so tips still find them).
// Dev -> HUD & Display -> Aesthetics -> Stock bulbs. Store holds only overrides.
const SB_KEY = 'lethe.stockBulbs.v1';
const SB_DEFAULT = { on: 0, trick: 'rim' };
let sbCfg = (() => { try { return { ...SB_DEFAULT, ...JSON.parse(localStorage.getItem(SB_KEY) || '{}') }; } catch (e) { return { ...SB_DEFAULT }; } })();
const SB_SIZE = 8;        // design px, one bulb
const SB_GAP  = 2;        // design px between bulbs
const SB_EXT_MS = 1400;   // the extend animation
let _sbSig = '', _sbLast = {}, _sbTimer = 0;

function sbSave() {
  const o = {}; for (const k in SB_DEFAULT) if (sbCfg[k] !== SB_DEFAULT[k]) o[k] = sbCfg[k];
  try { Object.keys(o).length ? localStorage.setItem(SB_KEY, JSON.stringify(o)) : localStorage.removeItem(SB_KEY); } catch (e) {}
}
function sbSet(k, v) { sbCfg[k] = (k === 'on') ? +v : v; sbSave(); sbApply(); }

function sbLayer() {
  let l = document.getElementById('sb-layer');
  const st = document.getElementById('stage');
  if (!l && st) { l = document.createElement('div'); l.id = 'sb-layer'; st.appendChild(l); }
  return l;
}

// A rect in #stage design px (the cabinet is zoomed; offsetWidth is not).
function sbRect(el, st, z, sr) {
  if (!el || !el.offsetParent) return null;
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null;
  return { x: (r.left - sr.left) / z, y: (r.top - sr.top) / z, w: r.width / z, h: r.height / z };
}

// [{ kind, n, lit, used }]: n bulbs, the first `lit` are on; of those, `used` show the used colour.
function sbStocks() {
  const L = (typeof limits !== 'undefined') ? limits : {};
  const one = (id, have, usedIsLeft) => {
    const l = L[id]; if (!l) return null;
    const cur = l.current, n = Math.max(l.max, have, cur);
    return usedIsLeft ? { n, cur, lit: Math.max(cur, have), green: have } : { n, cur, lit: cur, used: Math.min(have, cur) };
  };
  return {
    swap: one('swaps', typeof swaps === 'number' ? swaps : 0, true),
    disc: one('discards', typeof discards === 'number' ? discards : 0, true),
    hand: one('selection', typeof selected !== 'undefined' ? selected.length : 0, false),
    trick: one('trick_slots', typeof trickTray !== 'undefined' ? trickTray.length : 0, false),
  };
}

function sbLive() {
  const sc = document.getElementById('sel-count');
  return !!(sc && sc.classList.contains('on'))
    && !(typeof rewardOnGrid !== 'undefined' && rewardOnGrid)
    && !(typeof shopGridActive !== 'undefined' && shopGridActive);
}

// Where each group goes: { x, y, dir: 'col'|'row', size }.
function sbPlaces(st, z, sr) {
  const land = st.classList.contains('landscape');
  const grid = sbRect(document.getElementById('grid'), st, z, sr);
  const out = {};
  const keyCol = (id, n) => {
    const k = sbRect(document.getElementById(id), st, z, sr); if (!k || !grid) return null;
    const gap = k.x - (grid.x + grid.w);
    const size = Math.max(4, Math.min(SB_SIZE, gap - 3));
    const len = n * size + (n - 1) * SB_GAP;
    return { x: k.x - Math.min(5, (gap - size) / 2) - size, y: k.y + (k.h - len) / 2, dir: 'col', size };
  };
  const trayRow = (el, n, where, below) => {
    const t = sbRect(el, st, z, sr); if (!t) return null;
    let size = SB_SIZE, y;
    if (where === 'below') { size = Math.max(4, Math.min(SB_SIZE, (below == null ? SB_SIZE + 3 : below) - 2)); y = t.y + t.h + 1; }
    else if (where === 'mid') y = t.y + (t.h - size) / 2;
    else y = t.y - size / 2;
    const len = n * size + (n - 1) * SB_GAP;
    return { x: t.x + t.w - 10 - len, y, dir: 'row', size };
  };
  // the room under a tray: down to the next thing drawn below it, or the stage edge
  const roomBelow = (el, nextIds) => {
    const t = sbRect(el, st, z, sr); if (!t) return null;
    let lim = st.offsetHeight;
    nextIds.forEach(id => { const r = sbRect(document.getElementById(id), st, z, sr);
      if (r && r.y >= t.y + t.h - 1 && r.x < t.x + t.w && r.x + r.w > t.x) lim = Math.min(lim, r.y); });
    return lim - (t.y + t.h);
  };
  const s = sbStocks();
  if (s.swap) out.swap = keyCol('swap-indicator', s.swap.n);
  if (s.disc) out.disc = keyCol('btn-discard', s.disc.n);
  const tt = document.getElementById('trick-tray-area');
  if (s.trick) out.trick = trayRow(tt, s.trick.n, sbCfg.trick, roomBelow(tt, ['btn-records', 'btn-pause', 'knack-carousel-wrap', 'grid']));
  const hp = land ? document.getElementById('selected-cards') : null;
  if (s.hand) out.hand = hp && hp.offsetWidth
    ? trayRow(hp, s.hand.n, sbCfg.trick, roomBelow(hp, ['trick-tray-area']))
    : trayRow(document.getElementById('sel-count'), s.hand.n, 'mid');
  return out;
}

function sbPaint(force) {
  const st = document.getElementById('stage'); const l = sbLayer();
  if (!st || !l) return;
  const on = sbCfg.on && sbLive();
  l.style.display = on ? '' : 'none';
  if (!on) { _sbSig = ''; return; }
  const sr = st.getBoundingClientRect(), z = sr.width / (st.offsetWidth || 1);
  const stocks = sbStocks(), places = sbPlaces(st, z, sr);
  const sig = JSON.stringify([stocks, places, sbCfg.trick]);
  if (!force && sig === _sbSig) return;
  _sbSig = sig;
  for (const g of ['swap', 'disc', 'hand', 'trick']) {
    const s = stocks[g], p = places[g];
    let box = l.querySelector(`.sb-${g}`);
    if (!s || !p) { if (box) box.remove(); continue; }
    if (!box) { box = document.createElement('div'); box.className = `sb-grp sb-${g}`; l.appendChild(box); }
    box.classList.toggle('sb-col', p.dir === 'col');
    box.style.cssText = `left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;--sb:${p.size.toFixed(1)}px;gap:${SB_GAP}px`;
    while (box.children.length < s.n) box.appendChild(document.createElement('i'));
    while (box.children.length > s.n) box.lastChild.remove();
    const prev = _sbLast[g];
    [...box.children].forEach((b, i) => {
      let cls = 'sb-b';
      if (i < s.lit) cls += s.green != null ? (i < s.green ? ' sb-on sb-gr' : ' sb-on sb-rd')
                                            : (i < s.used ? ' sb-on sb-bl' : ' sb-on sb-gr');
      // a newly unlocked bulb: flicker, flash, settle
      if (prev != null && i >= prev && i < s.cur) { b._sbExt = performance.now(); }
      if (b._sbExt && performance.now() - b._sbExt < SB_EXT_MS) cls += ' sb-ext';
      if (b.className !== cls) b.className = cls;
    });
    _sbLast[g] = s.cur;
  }
}

function sbApply() {
  document.documentElement.classList.toggle('stock-bulbs', !!sbCfg.on);
  const a = document.getElementById('dev-sb-on'); if (a) a.value = sbCfg.on ? sbCfg.trick : 'off';
  clearInterval(_sbTimer); _sbTimer = 0;
  if (sbCfg.on) _sbTimer = setInterval(() => sbPaint(false), 150);
  sbPaint(true);
}
function sbChoose(v) { if (v === 'off') sbSet('on', 0); else { sbCfg.trick = v; sbSet('on', 1); } }

// Selection changes paint at once rather than on the next tick.
if (typeof updateSelectionUI === 'function') {
  const _sbUsu = updateSelectionUI;
  updateSelectionUI = function () { const r = _sbUsu.apply(this, arguments); if (sbCfg.on) sbPaint(false); return r; };
}
if (document.body) sbApply(); else document.addEventListener('DOMContentLoaded', sbApply);
