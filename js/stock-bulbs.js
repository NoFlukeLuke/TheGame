// ══════════════════════════════════════════════
// STOCK BULBS (r497) - small lamps in place of the x/y stock readouts
// ══════════════════════════════════════════════
// One bulb per point of a limit's MAX, set beside the thing it counts:
//   Swaps / Discards : a column on the key's left edge (split either side of the label
//                      when it does not fit). Green = a use left,
//                      red = used this round, dim = not unlocked yet.
//   Hand / Tricks    : a row centred on the tray's lower edge, or just beneath it (`trick`).
//                      Green = free, blue = in use, dim = not unlocked yet.
// A limit that goes up lights its new bulb with a flicker, a flash, then settles.
// The x/y readouts they replace are hidden (visibility, so tips still find them).
// Dev -> HUD & Display -> Aesthetics -> Stock bulbs. Store holds only overrides.
const SB_KEY = 'lethe.stockBulbs.v1';
const SB_DEFAULT = { on: 1, trick: 'rim' };   // r557 (owner): bulbs on by default; the store holds only what differs
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

// The key look (js/key-looks.js) draws the bulbs as pixel squares (css/key-looks.css).
function sbKeyLook() { return typeof keyLookOn === 'function' && keyLookOn(); }
function sbOn() { return !!sbCfg.on; }
function sbLive() {
  const sc = document.getElementById('sel-count');
  return !!(sc && sc.classList.contains('on'))
    && !(typeof rewardOnGrid !== 'undefined' && rewardOnGrid)
    && !(typeof shopGridActive !== 'undefined' && shopGridActive);
}

// Where each group goes: { x, y, dir: 'col'|'row', size, split?: rows per side, w? }.
function sbPlaces(st, z, sr) {
  const land = st.classList.contains('landscape');
  const out = {};
  // On the key, flush inside its left edge. If the column is taller than the key, the
  // bulbs split in half, one column each side of the label (left fills first).
  const keyCol = (id, n) => {
    const k = sbRect(document.getElementById(id), st, z, sr); if (!k) return null;
    const kl = typeof keyLookCfg === 'function' ? keyLookCfg() : null;
    const size = kl ? kl.size : SB_SIZE, pad = kl ? kl.pad : 4;   // r662: a key look's squares sit inside the rim
    const len = m => m * size + (m - 1) * SB_GAP;
    if (len(n) <= k.h - 2 * pad) return { x: k.x + pad, y: k.y + (k.h - len(n)) / 2, dir: 'col', size };
    const rows = Math.ceil(n / 2);
    return { x: k.x + pad, y: k.y + (k.h - len(rows)) / 2, dir: 'col', size, split: rows, w: k.w - 2 * pad };
  };
  const trayRow = (el, n, where, below) => {
    const t = sbRect(el, st, z, sr); if (!t) return null;
    let size = SB_SIZE, y;
    if (where === 'below') { size = Math.max(4, Math.min(SB_SIZE, (below == null ? SB_SIZE + 3 : below) - 2)); y = t.y + t.h + 1; }
    else if (where === 'mid') y = t.y + (t.h - size) / 2;
    else if (where === 'in') y = t.y + t.h - size - 3;   // r691: inside the screen, along its lower edge
    else y = t.y + t.h - size / 2;                       // centred on the tray's lower edge
    const len = n * size + (n - 1) * SB_GAP;
    return { x: where === 'mid' ? t.x + t.w - 10 - len : t.x + (t.w - len) / 2, y, dir: 'row', size };
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
  // r662: with a key look on, a key another screen has borrowed (REROLL, CONFIRM, BUY...)
  // shows that screen's words alone; the squares would sit on them.
  const own = id => !sbKeyLook() || (id === 'swap-indicator' ? !!document.querySelector('#swap-indicator .swap-word')
    : id === 'btn-discard' ? !!document.getElementById('disc-count')
    : !document.getElementById('btn-play')?.classList.contains('reward-buy'));
  if (s.swap && own('swap-indicator')) out.swap = keyCol('swap-indicator', s.swap.n);
  if (s.disc && own('btn-discard')) out.disc = keyCol('btn-discard', s.disc.n);
  const tt = document.getElementById('trick-tray-area');
  if (s.trick) out.trick = trayRow(tt, s.trick.n, sbCfg.trick, roomBelow(tt, ['btn-records', 'btn-pause', 'knack-carousel-wrap', 'grid']));
  // r691 (owner): with the key look's squares the Trick row sits INSIDE its screen, along the
  // lower edge, drawn in the tray itself behind the chips (sbPaint hosts it there).
  if (out.trick && sbKeyLook()) {
    const tr = sbRect(tt, st, z, sr), p = trayRow(tt, s.trick.n, 'in');
    if (tr && p) out.trick = Object.assign(p, { inTray: true, x: p.x - tr.x, y: p.y - tr.y });
  }
  // The hand preview's box. On a phone it shares its half of the strip with Knacks
  // (js/portrait-panel.js), so while Knacks show, that same box stands in for it.
  const vis = id => { const e = document.getElementById(id); return e && e.offsetParent && e.offsetWidth ? e : null; };
  const hp = land ? vis('selected-cards') : (vis('hand-preview-area') || vis('knack-carousel-wrap'));
  // Console mode (r564, owner): the hand size is a column on the PLAY key, like the
  // swaps and discards on theirs.
  const machine = typeof trayMachineOn === 'function' && trayMachineOn();
  if (s.hand && (machine || sbKeyLook())) { if (!document.body.classList.contains('grid-screen') && own('btn-play')) out.hand = keyCol('btn-play', s.hand.n); }
  else if (s.hand) out.hand = hp
    ? trayRow(hp, s.hand.n, sbCfg.trick, roomBelow(hp, land ? ['trick-tray-area'] : ['sel-count', 'grid', 'trick-tray-area']))
    : trayRow(document.getElementById('sel-count'), s.hand.n, 'mid');
  return out;
}

function sbPaint(force) {
  const st = document.getElementById('stage'); const l = sbLayer();
  if (!st || !l) return;
  const on = sbOn() && sbLive();
  l.style.display = on ? '' : 'none';
  if (!on) { _sbSig = ''; return; }
  const sr = st.getBoundingClientRect(), z = sr.width / (st.offsetWidth || 1);
  const stocks = sbStocks(), places = sbPlaces(st, z, sr);
  const sig = JSON.stringify([stocks, places, sbCfg.trick]);
  if (!force && sig === _sbSig) return;
  _sbSig = sig;
  for (const g of ['swap', 'disc', 'hand', 'trick']) {
    const s = stocks[g], p = places[g];
    const tray = g === 'trick' && document.getElementById('trick-tray-area');
    let box = l.querySelector(`.sb-${g}`) || (tray && tray.querySelector(`.sb-${g}`));
    if (!s || !p) { if (box) box.remove(); continue; }
    if (!box) { box = document.createElement('div'); box.className = `sb-grp sb-${g}`; l.appendChild(box); }
    const host = (p.inTray && tray) || l;   // r691: the Trick row lives in its tray, first child so the chips paint over it
    if (box.parentElement !== host) host.prepend(box);
    box.classList.toggle('sb-in', !!p.inTray);
    box.classList.toggle('sb-col', p.dir === 'col' && !p.split);
    box.classList.toggle('sb-split', !!p.split);
    box.classList.toggle('sb-flush', g === 'swap' || g === 'disc' || (g === 'hand' && p.dir === 'col'));
    box.style.cssText = `left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;--sb:${p.size.toFixed(1)}px;gap:${SB_GAP}px`
      + (p.split ? `;width:${p.w.toFixed(1)}px;--sb-rows:${p.split}` : '');
    while (box.children.length < s.n) { const b = document.createElement('i'); b.appendChild(document.createElement('b')); box.appendChild(b); }
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
  document.documentElement.classList.toggle('stock-bulbs', sbOn());
  const a = document.getElementById('dev-sb-on'); if (a) a.value = sbCfg.on ? sbCfg.trick : 'off';
  clearInterval(_sbTimer); _sbTimer = 0;
  if (sbOn()) _sbTimer = setInterval(() => sbPaint(false), 150);
  sbPaint(true);
}
function sbChoose(v) { if (v === 'off') sbSet('on', 0); else { sbCfg.trick = v; sbSet('on', 1); } }

// Selection changes paint at once rather than on the next tick.
if (typeof updateSelectionUI === 'function') {
  const _sbUsu = updateSelectionUI;
  updateSelectionUI = function () { const r = _sbUsu.apply(this, arguments); if (sbOn()) sbPaint(false); return r; };
}
if (document.body) sbApply(); else document.addEventListener('DOMContentLoaded', sbApply);
