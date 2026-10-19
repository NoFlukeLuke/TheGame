// ═══════════════════════════════════════════════════════════════════════════
// EVENT GRID LAB (r588, reworked r589) - events drawn as the board
// ═══════════════════════════════════════════════════════════════════════════
// Owner: every event should live on the board. A LOOK preview: nothing here is
// granted and no real event handler runs. Open index.html?evgrid (or dev ->
// Events & Bosses -> Event layouts). It starts a Classic run, pauses it, and
// turns the board into one of six sample events, one per shape an event takes.
//
// r589, after the owner's first look: Terminal stays, Marquee was the best of
// the rest, so the lab now shows three ways of crossing the two (WALL, READOUT,
// WIREFRAME) beside both originals. Zoom is gone; slide-off stays as an option.
// Two screens follow the owner's own designs in every layout:
//   Card Market  the board itself, full of buffed cards, the words above it
//   Deck Trim    the deck in one column per suit, a rank to a row, six rows
//                showing; arrows on the Focus bar scroll it (so do the mouse
//                wheel and a drag)
// Those two always stay in the board's own box.
//
// The layer is #egl, a child of #stage placed in design px. Every layout lays
// out on twelve half-cell rows; a piece is one cell or a merged run of cells,
// and every redraw is KEYED, so a cell that survives a change moves to its new
// box (FLIP) and only new cells turn over. The two card screens are one piece
// each holding their own grid (`eglViewPiece`), because they need the board's
// column count and a scroll. Text is N px x var(--fit), fitted on a hidden copy
// of the board first; the panel prints the smallest as drawn on screen.

const EGL_KEY = 'lethe.eventGridLab.v2';
const EGL_ROWS = 12;          // half-cell rows, on every layout
const EGL_CELL = 55;          // target cell width, design px: sets the column count
const EGL_PAD = 6, EGL_GAP = 5;
const EGL_NEED_FIT = 0.85;    // "only when it won't fit" goes wide below this
const EGL_MS = 560;           // a room change or a cell's move
const EGL_EASE = 'cubic-bezier(.62,0,.24,1)';
const EGL_REFLIP = 20;        // Hot Streak's second chance, as the event prices it
const EGL_DECK_ROWS = 6;      // rows of the deck's suit columns in view at once
const EGL_LAYOUTS = {
  wall:     { name: 'WALL',      note: 'Marquee as a wall of small amber screens: the prompt on the big one, every option and card on its own.' },
  readout:  { name: 'READOUT',   note: 'One amber screen over a row of keys. Touching a key prints its full text on the screen; the keys only carry a name.' },
  wire:     { name: 'WIREFRAME', note: 'One amber screen with Marquee drawn on it in lines: the prompt in a double box, each option and card in its own box.' },
  terminal: { name: 'TERMINAL',  note: 'The original: the event prints onto one screen, options are numbered lines.' },
  marquee:  { name: 'MARQUEE',   note: 'The original: a big prompt cell on top, options as cells under it.' },
};
const EGL_COMBINED = ['wall', 'readout', 'wire'];
const EGL_ROOMS = { box: 'IN THE BOX', slide: 'SLIDE OFF' };
// Where each buff key's value lives on a card (the stores in js/deck-grid.js).
const eglStores = () => ({ pips: permPips, mult: permMult, time: permTime, retrig: permRetrig,
                           xpips: permXPips, xmult: permXMult, focus: permFocus, coin: permCoins });

let egl = null;               // the open lab, or null
const eglPrefs = { ev: 0, lay: 'wall', room: 'box', need: false, right: false };
try {
  localStorage.removeItem('lethe.eventGridLab.v1');   // r588's layouts are gone
  Object.assign(eglPrefs, JSON.parse(localStorage.getItem(EGL_KEY) || '{}') || {});
} catch (e) {}
function eglSavePrefs() { try { localStorage.setItem(EGL_KEY, JSON.stringify(eglPrefs)); } catch (e) {} }
const eglTxt = v => (typeof v === 'function' ? v() : v) || '';
const eglEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const eglPlain = s => String(s || '').replace(/<[^>]*>/g, '');
const eglCol = s => (typeof colorizeKeywords === 'function') ? colorizeKeywords(s || '') : (s || '');
const eglRand = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());
const eglIsView = st => !!st && (st.t === 'shopgrid' || st.t === 'deckcols');

// ── THE SAMPLES ─────────────────────────────────────────────────────────────
// One per shape an event takes. Built when the lab opens, from the live run.
function eglSamples() {
  const W = typeof WILD_RANK !== 'undefined' ? WILD_RANK : '✶';
  const nW = (typeof deckWildCount === 'function') ? deckWildCount() : 4;
  const tiers = BAL.deck_trim.tiers.map(t => ({ ...t, price: priceOf(t.price) }));
  const tier = () => tiers[(egl.picks[0] || [])[0]] || tiers[0];
  const deck = everyDeckCard();
  const tricks = ['common', 'rare', 'epic'].map(r => TRICK_POOL.filter(t => t.tier === r && !t.retired && t.desc)
    .sort((a, b) => Math.abs(a.desc.length - 80) - Math.abs(b.desc.length - 80))[0]).filter(Boolean);
  const pct = Math.round(((typeof OVERTIME_LEN_MULT !== 'undefined') ? OVERTIME_LEN_MULT - 1 : 0.3) * 100);
  const costs = (typeof OVERTIME_COSTS !== 'undefined') ? evShuffle(OVERTIME_COSTS.slice()).slice(0, 3) : [];
  const price = marketCardPrice();
  // Owner: the market is the board, full of buffed cards. The real event's odds
  // of a second buff hold among them.
  const two = BAL.market.two_buffs / (BAL.market.two_buffs + BAL.market.one_buff);
  const offers = Array.from({ length: (gridRows || 4) * (gridCols || 4) }, () =>
    ({ card: marketRollCard().card, buffs: rollBuffs(Math.random() < two ? 2 : 1, { event: true }) }));
  const cardName = c => `${c.rank}${c.suit || ''}`;
  const meta = id => EVENT_META[id] || { name: id, flavor: '' };
  return [
    { id: 'wild_cards', shape: 'two options', ...meta('wild_cards'),
      steps: [{ t: 'choice', label: 'CHOOSE ONE', note: `Your deck holds <b>${nW}</b> wilds.`, opts: [
        { icon: W, title: 'Wilds run free', text: 'For the rest of the run, wilds also complete runs and flushes.', rar: 'rare' },
        { icon: W + W, title: 'Double the wilds', text: `${nW} more wilds go into your deck (${nW} → ${nW * 2}).`, rar: 'rare' }] }],
      result: () => (egl.picks[0] || [])[0] === 1 ? [`+${nW} wilds go into your deck.`] : ['Wilds now complete runs and flushes.'] },
    { id: 'deck_trim', shape: 'three rungs, then the deck', ...meta('deck_trim'),
      steps: [
        { t: 'choice', label: 'HOW DEEP', note: 'Every card you cut is gone for the rest of the run. The fewer cards in the deck, the more often the ones you kept come round.',
          opts: tiers.map(t => ({ icon: '✂️', title: `Cut ${t.cards} card${t.cards > 1 ? 's' : ''}`,
            text: t.price === 0 ? 'Free. Pick one card and it leaves the run.' : `Pick ${t.cards} cards and they leave the run.`,
            cost: t.price === 0 ? 'No charge' : `${t.price} credits`, rar: t.cards >= 4 ? 'epic' : t.cards >= 2 ? 'rare' : 'common' })) },
        { t: 'deckcols', label: () => `PICK ${tier().cards} TO CUT`, note: 'Your deck, one column per suit.', cards: deck, pick: () => tier().cards }],
      result: () => { const c = (egl.picks[1] || []).map(i => cardName(deck[i])); const t = tier();
        return [`${c.join(', ') || 'Nothing'} ${c.length > 1 ? 'leave' : 'leaves'} the run.`, t.price ? `-${t.price} credits.` : 'No charge.']; } },
    { id: 'merchant', shape: 'pick an entity', ...meta('merchant'),
      steps: [{ t: 'entities', label: 'PIECES OF YOUR ENGINES · TAKE ONE', opts: tricks.map(t => ({
        entity: 'trick', id: t.id, emoji: (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦', name: t.name, desc: t.desc, rar: t.tier })) }],
      result: () => [`${(tricks[(egl.picks[0] || [])[0]] || {}).name || 'It'} joins your Tricks.`] },
    { id: 'overtime', shape: 'several steps', ...meta('overtime'),
      steps: [
        { t: 'choice', label: 'ON THE CLOCK', note: 'Take it and three costs are dealt. You avoid one; the other two last the rest of the run.',
          opts: [{ icon: '⏳', title: 'Longer rounds', text: `Every round from now on is ${pct}% longer, boss rounds included.` }] },
        { t: 'choice', label: 'PICK ONE TO AVOID', note: 'The other two apply for the rest of the run.', noSkip: true, tone: 'debuff',
          opts: costs.map(c => ({ icon: c.icon, title: c.name, text: c.desc })) }],
      result: () => { const a = (egl.picks[1] || [])[0], keep = costs.filter((c, i) => i !== a);
        return [`Every round is ${pct}% longer.`, `You avoided ${(costs[a] || {}).name || 'nothing'}.`, `${keep.map(c => c.name).join(' and ')} last the rest of the run.`]; } },
    { id: 'hot_streak', shape: 'a gamble', ...meta('hot_streak'),
      steps: [{ t: 'ladder', label: 'FLIP OR STOP', note: `Each heads adds a pick of three. Stop when you like and take them; a tails loses them all. A first tails can be flipped again for ${EGL_REFLIP} credits.`,
        rungs: ['1 pick', '2 picks', '3 picks', '4 picks'] }],
      result: () => { const L = egl.ladder;
        if (L.lost) return ['Tails. The picks are lost.'];
        if (!L.n) return ['You walked away with nothing.'];
        return [`${L.n} ${L.n === 1 ? 'pick' : 'picks'} of three, one after another.`]; } },
    { id: 'market', shape: 'buy several', ...meta('market'),
      steps: [{ t: 'shopgrid', label: `${price} CREDITS EACH`, note: 'Tap the cards you want. They go into your Lockbox.', items: offers, price }],
      result: () => { const n = (egl.picks[0] || []).length;
        return n ? [`${n} card${n > 1 ? 's go' : ' goes'} into your Lockbox.`, `-${n * price} credits.`] : ['You left without buying.']; } },
  ];
}

// ── STATE ───────────────────────────────────────────────────────────────────
function eglStep()  { return egl.done ? null : egl.ev.steps[egl.step]; }
function eglPicks() { return egl.picks[egl.step] || (egl.picks[egl.step] = []); }
function eglNeed(st) { return !st ? 0 : (st.t === 'deckcols') ? eglTxt(st.pick) : (st.t === 'shopgrid' || st.t === 'ladder') ? 0 : 1; }
function eglReady() { const st = eglStep(); return !st || eglPicks().length >= eglNeed(st); }
function eglStart(deal = true) {
  egl.ev = egl.samples[eglPrefs.ev];
  egl.step = 0; egl.picks = []; egl.done = false; egl.skipped = false;
  egl.inspect = null; egl.dvRow = 0;
  egl.ladder = { n: 0, busy: false, over: false, lost: false, reflip: false, used: false, cap: null, log: [] };
  egl.seen = new Set();
  if (deal) egl.board.querySelectorAll(':scope > .egl-cell').forEach(el => el.remove());
  eglDraw({ turn: !deal });
}
function eglTap(i) {
  const st = eglStep(); if (!st || egl.ladder.busy) return;
  const p = eglPicks(), at = p.indexOf(i);
  egl.inspect = i;
  if (st.t === 'shopgrid') {
    if (at >= 0) p.splice(at, 1);
    else if ((p.length + 1) * st.price <= coins) p.push(i);
    else { eglShake(); return; }
  } else if (st.t === 'deckcols') {
    if (at >= 0) p.splice(at, 1);
    else { p.push(i); if (p.length > eglNeed(st)) p.shift(); }
  } else egl.picks[egl.step] = [i];
  eglDraw();
}
// READOUT prints whatever the pointer rests on, before it is tapped.
function eglHover(i) { if (egl.lay !== 'readout' || egl.inspect === i || egl.ladder.busy) return; egl.inspect = i; eglDraw(); }
function eglNext() {
  if (egl.done) { eglClose(true); return; }
  const st = eglStep();
  if (st.t === 'ladder') { const L = egl.ladder; if (L.over) { egl.done = true; eglDraw(); } else eglFlip(L.reflip); return; }
  if (!eglReady()) { eglShake(); return; }
  egl.inspect = null; egl.dvRow = 0;
  if (egl.step < egl.ev.steps.length - 1) egl.step++; else egl.done = true;
  eglDraw();
}
function eglSkip() {
  const L = egl.ladder;
  if (eglStep()?.t === 'ladder' && (L.n || L.reflip)) { L.over = true; egl.done = true; }   // STOP / WALK AWAY
  else { egl.done = true; egl.skipped = true; }
  eglDraw();
}
function eglFlip(paid) {
  const L = egl.ladder; if (L.busy || L.over) return;
  if (paid) { if (coins < EGL_REFLIP) { eglShake(); return; } L.used = true; }
  L.reflip = false; L.busy = true; L.cap = null; L.log.push('> FLIPPING...');
  eglDraw();
  const side = eglRand() < 0.5 ? 'heads' : 'tails';
  const coin = egl.coin && egl.coin.el.isConnected ? egl.coin : null;
  (coin ? coin.flip(side) : new Promise(r => setTimeout(r, 900))).then(() => {
    if (!egl) return;
    L.busy = false;
    if (side === 'heads') { L.n++; L.cap = [`HEADS · RUNG ${L.n}`, 'win']; if (L.n >= eglStep().rungs.length) L.over = true; }
    else if (L.n === 0 && !L.used) { L.reflip = true; L.cap = ['TAILS', 'lose']; }
    else { L.lost = true; L.over = true; L.cap = ['TAILS · ALL LOST', 'lose']; }
    L.log.push('> ' + L.cap[0]);
    eglDraw();
  });
}

// ── GEOMETRY ────────────────────────────────────────────────────────────────
function eglGeom(rect) {
  const rows = EGL_ROWS, cols = Math.max(4, Math.min(12, Math.round(rect.w / EGL_CELL)));
  const cw = (rect.w - 2 * EGL_PAD - (cols - 1) * EGL_GAP) / cols;
  const ch = (rect.h - 2 * EGL_PAD - (rows - 1) * EGL_GAP) / rows;
  return { rect, cols, rows, cw, ch, wide: cols >= 9,
    box: (c, r, w, h) => ({ l: EGL_PAD + c * (cw + EGL_GAP), t: EGL_PAD + r * (ch + EGL_GAP),
                            w: w * cw + (w - 1) * EGL_GAP, h: h * ch + (h - 1) * EGL_GAP }) };
}
function eglLandscape() { return !!document.getElementById('stage')?.classList.contains('landscape'); }
function eglZoom() { const st = document.getElementById('stage'); return st.getBoundingClientRect().width / st.offsetWidth; }
// An element's box in #stage design px.
function eglDesignRect(el) {
  const st = document.getElementById('stage'), s = st.getBoundingClientRect(), g = el.getBoundingClientRect(), z = s.width / st.offsetWidth;
  return { x: (g.left - s.left) / z, y: (g.top - s.top) / z, w: g.width / z, h: g.height / z };
}
const eglBoxRect = () => eglDesignRect(document.getElementById('grid-slot'));
function eglRoomTarget(room) {
  const st = document.getElementById('stage');
  return room === 'slide' ? { rect: { x: 8, y: 8, w: st.offsetWidth - 16, h: st.offsetHeight - 16 }, slide: true }
                          : { rect: eglBoxRect(), slide: false };
}
// The two card screens are the board, so they keep its box.
function eglRoomNow() {
  if (!eglLandscape() || eglIsView(eglStep())) return 'box';
  if (!eglPrefs.need || eglPrefs.room === 'box') return eglPrefs.room;
  return eglMeasure(eglBoxRect()).fit < EGL_NEED_FIT ? eglPrefs.room : 'box';
}

// ── THE ROOM ────────────────────────────────────────────────────────────────
// Every laid-out box in #stage outside the board, through the display:contents
// wrappers, with the way it leaves: up if it sits over the board, else out the
// nearer side. Things lying over the board itself (the goal flash) stay.
function eglSlideTargets() {
  const st = document.getElementById('stage'), g = eglBoxRect(), out = [];
  const walk = par => [...par.children].forEach(el => {
    if (el.id === 'egl' || el.id === 'egl-scroll' || el.id === 'grid-slot' || el.tagName === 'SCRIPT') return;
    const cs = getComputedStyle(el);
    if (cs.display === 'contents') { walk(el); return; }
    if (cs.display === 'none' || cs.position === 'fixed') return;
    const r0 = el.getBoundingClientRect(); if (!r0.width || !r0.height) return;
    const r = eglDesignRect(el);
    const ix = Math.max(0, Math.min(r.x + r.w, g.x + g.w) - Math.max(r.x, g.x)), iy = Math.max(0, Math.min(r.y + r.h, g.y + g.h) - Math.max(r.y, g.y));
    if (ix * iy > r.w * r.h * 0.5) return;
    const cx = r.x + r.w / 2;
    if (r.y + r.h <= g.y + 2 && cx > g.x && cx < g.x + g.w) out.push({ el, dx: 0, dy: -(r.y + r.h + 24), d: g.y - r.y - r.h });
    else if (cx < g.x + g.w / 2) out.push({ el, dx: -(r.x + r.w + 24), dy: 0, d: g.x - r.x - r.w });
    else out.push({ el, dx: st.offsetWidth - r.x + 24, dy: 0, d: r.x - g.x - g.w });
  });
  walk(st);
  return out;
}
function eglSetSlide(on) {
  if (on === egl.slid) return;
  egl.slid = on;
  if (on && !egl.slideEls) egl.slideEls = eglSlideTargets();
  (egl.slideEls || []).forEach(({ el, dx, dy, d }) => {
    const delay = Math.round(Math.min(160, Math.max(0, d) * 0.6));
    el.style.transition = `translate ${EGL_MS}ms ${EGL_EASE} ${on ? delay : 0}ms`;
    el.style.translate = on ? `${dx}px ${dy}px` : '';
  });
  const sb = document.getElementById('sb-layer');
  if (sb) { sb.style.transition = 'opacity .2s'; sb.style.opacity = on ? '0' : ''; }
  clearTimeout(egl.slideT);
  if (!on) egl.slideT = setTimeout(() => (egl.slideEls || []).forEach(({ el }) => { el.style.transition = ''; }), EGL_MS + 200);
}
function eglSetRect(rect, animate) {
  const L = egl.layer, prev = egl.rect;
  Object.assign(L.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
  egl.rect = rect;
  if (!animate || !prev || (prev.x === rect.x && prev.y === rect.y && prev.w === rect.w && prev.h === rect.h)) return;
  L.getAnimations().forEach(a => a.cancel());
  L.animate([{ left: prev.x + 'px', top: prev.y + 'px', width: prev.w + 'px', height: prev.h + 'px' },
             { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' }],
            { duration: EGL_MS, easing: EGL_EASE });
}

// ── PIECES ──────────────────────────────────────────────────────────────────
// A piece is one cell or a merged run of cells: { key, cls, html, c, r, w, h,
// tap, hover, hoverAt }. A layout returns the pieces; eglFill puts an empty cell
// wherever none landed, two rows tall where it can, so the board stays a board.
function eglPieces(G) {
  const st = eglStep(), L = egl.lay;
  let P;
  if (L === 'terminal') P = eglLayTerminal(G);
  else if (eglIsView(st)) P = eglLayView(G);
  else if (L === 'readout') P = eglLayReadout(G);
  else P = eglLayMarquee(G);
  return eglFill(P, G);
}
function eglFill(P, G) {
  const used = new Set();
  P.forEach(p => { for (let r = p.r; r < p.r + p.h; r++) for (let c = p.c; c < p.c + p.w; c++) used.add(c + ':' + r); });
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
    if (used.has(c + ':' + r)) continue;
    const h = (r + 1 < G.rows && !used.has(c + ':' + (r + 1))) ? 2 : 1;
    for (let k = 0; k < h; k++) used.add(c + ':' + (r + k));
    P.push({ key: `amb:${c}:${r}:${h}`, cls: 'egl-amb', c, r, w: 1, h });
  }
  return P;
}
const eglSk = () => egl.done ? 'out' : 's' + egl.step;   // a step's pieces are new pieces

// Lines that type out the first time they are drawn (egl.seen), then stay put.
function eglLinesHTML(lines, min) {
  let fresh = 0;
  const html = lines.map(([cls, t], i) => {
    const k = `${egl.lay}|${eglSk()}|${i}|${t}`, isNew = !egl.seen.has(k);
    if (!egl.measuring) egl.seen.add(k);
    return `<div class="egl-tl ${cls}${isNew ? ' egl-type' : ''}" style="--d:${isNew ? fresh++ * 150 : 0}ms">${t ? eglEsc(t) : '&nbsp;'}</div>`;
  }).join('');
  return `<div class="egl-fit" data-min="${min}">${html}<span class="egl-cursor"></span></div>`;
}
function eglOutcome() { return egl.skipped ? ['Skipped. Nothing changes.'] : egl.ev.result(); }
// The prompt as amber lines: all of it, or the one-line head of a card screen.
function eglPromptLines(head) {
  const ev = egl.ev, st = eglStep();
  const lab = egl.done ? (egl.skipped ? 'SKIPPED' : 'DONE') : eglTxt(st.label);
  const note = egl.done ? '' : eglPlain(st.note || '');
  if (head) return [['egl-t-n2', `${ev.name.toUpperCase()} // ${lab}`]];
  return [['egl-t-n', ev.name.toUpperCase()], ['egl-t-f', ev.flavor], ...(note ? [['egl-t-x', note]] : []), ['egl-t-l', `> ${lab}`]];
}
// What the screen says about the thing last touched (READOUT, and the head of
// TERMINAL's card screens).
function eglInspectLines() {
  const st = eglStep(), i = egl.inspect, L = egl.ladder;
  if (!st) return eglOutcome().map(l => ['egl-t-good', eglPlain(l)]);
  if (st.t === 'ladder') return L.log.length ? L.log.slice(-3).map(l => [/LOST|TAILS/.test(l) ? 'egl-t-bad' : /HEADS/.test(l) ? 'egl-t-good' : '', l])
                                             : [['egl-t-dim', 'FLIP TO CLIMB A RUNG.']];
  if (st.t === 'shopgrid') {
    const it = st.items[i], n = eglPicks().length;
    const basket = ['egl-t-c', `BASKET ${n} · ${n * st.price} OF ${coins} CREDITS`];
    if (!it) return [['egl-t-dim', eglPlain(st.note)], basket];
    return [['egl-t-h', `> ${it.card.rank}${it.card.suit} · ${eglCodes(it.card, it.buffs).join(' · ')}`], basket];
  }
  if (st.t === 'deckcols') {
    const cd = st.cards[i], p = eglPicks();
    const cut = ['egl-t-c', `CUT ${p.length} OF ${eglNeed(st)}: ${p.map(j => st.cards[j].rank + (st.cards[j].suit || '')).join(' ') || '-'}`];
    if (!cd) return [['egl-t-dim', eglPlain(st.note)], cut];
    const codes = eglCodes(cd);
    return [['egl-t-h', `> ${cd.rank}${cd.suit || ''} · ${codes.length ? codes.join(' · ') : 'PLAIN'}`], cut];
  }
  const o = st.opts[i];
  if (!o) return [['egl-t-dim', 'TOUCH A KEY TO READ IT.']];
  return [['egl-t-h', `> [${i + 1}] ${(o.title || o.name).toUpperCase()}${o.rar && st.t === 'entities' ? ' · ' + o.rar.toUpperCase() : ''}`],
          ['', eglPlain(o.text || o.desc)], ...(o.cost ? [['egl-t-c', `COST · ${o.cost.toUpperCase()}`]] : [])];
}

// The prompt piece, in each layout's own material.
function eglPromptPiece(R, head) {
  const L = egl.lay, mode = head ? 'head' : 'full';
  if (L === 'marquee') return { key: 'prompt-' + mode, cls: `egl-prompt egl-p-${head ? 'strip' : 'full'}${!head && R.h > 6 ? ' egl-big' : ''}`, html: eglMarqueePromptHTML(head), ...R };
  if (L === 'readout') {
    const lines = head ? [...eglPromptLines(true), ...eglInspectLines()] : [...eglPromptLines(false), ['egl-t-rule', ''], ...eglInspectLines()];
    return { key: 'screen-' + mode, cls: 'egl-screen', html: eglLinesHTML(lines, 9), ...R };
  }
  if (L === 'wire') {
    const lines = head ? [['egl-t-x', eglPlain(eglStep()?.note || '')]] : eglPromptLines(false).filter(l => l[0] !== 'egl-t-n');
    const leg = head ? `${egl.ev.name.toUpperCase()} // ${eglTxt(eglStep().label)}` : `EVENT · ${egl.ev.name.toUpperCase()}`;
    return { key: 'prompt-' + mode, cls: 'egl-prompt', html: `<div class="egl-wb egl-wb2"><span class="egl-leg">${eglEsc(leg)}</span>${eglLinesHTML(lines, 9)}</div>`, ...R };
  }
  // WALL: a screen of its own
  const lines = head ? [...eglPromptLines(true), ['egl-t-x', eglPlain(eglStep()?.note || '')]] : eglPromptLines(false);
  return { key: 'prompt-' + mode, cls: 'egl-prompt', html: eglLinesHTML(lines, 9), ...R };
}
function eglMarqueePromptHTML(head) {
  const ev = egl.ev, st = eglStep();
  const lab = egl.done ? 'OUTCOME' : eglTxt(st.label), note = egl.done ? '' : (st.note || '');
  if (head) return `<div class="egl-fit egl-strip-in" data-min="6.5"><div class="egl-s1"><b class="egl-sn">${eglEsc(ev.name)}</b>`
                 + `<span class="egl-sl">${eglEsc(lab)}</span></div><div class="egl-s2">${note || eglEsc(ev.flavor)}</div></div>`;
  return `<div class="egl-fit" data-min="8"><div class="egl-kick">EVENT</div>`
       + `<div class="egl-name">${eglEsc(ev.name)}</div><div class="egl-flav">${eglEsc(ev.flavor)}</div>`
       + (note ? `<div class="egl-note">${note}</div>` : '') + `<div class="egl-lab">${eglEsc(lab)}</div></div>`;
}
function eglResult(R) {
  const L = egl.lay, lines = eglOutcome();
  if (L === 'marquee') return [{ key: 'result', cls: 'egl-result', ...R,
    html: `<div class="egl-fit" data-min="9"><div class="egl-kick">${egl.skipped ? 'SKIPPED' : 'DONE'}</div>`
        + lines.map(l => `<div class="egl-rl">${eglCol(l)}</div>`).join('') + `</div>` }];
  const body = eglLinesHTML([['egl-t-l', egl.skipped ? '> SKIPPED' : '> DONE'], ...lines.map(l => ['egl-t-good', eglPlain(l)])], 10);
  return [{ key: 'result', cls: 'egl-result', ...R,
    html: L === 'wire' ? `<div class="egl-wb egl-wb2"><span class="egl-leg">OUTCOME</span>${body}</div>` : body }];
}

// The action row: secondary actions from the left, the commit at the right.
function eglActs() {
  const st = eglStep(), L = egl.ladder, acts = [];
  let go = { label: 'CONFIRM', sub: '', off: false, on: eglNext };
  if (egl.done) go = { label: 'DONE', sub: 'back to the board', on: eglNext };
  else if (st.t === 'ladder') {
    if (L.busy) go = { label: 'FLIP', sub: '...', off: true };
    else if (L.over) go = { label: L.n && !L.lost ? 'TAKE THEM' : 'DONE', sub: '', on: eglNext };
    else if (L.reflip) { acts.push({ label: 'WALK AWAY', on: eglSkip }); go = { label: 'FLIP AGAIN', sub: `${EGL_REFLIP} credits`, on: eglNext }; }
    else { acts.push(L.n ? { label: 'STOP', sub: `take ${L.n}`, on: eglSkip } : { label: 'SKIP', on: eglSkip }); go = { label: 'FLIP', sub: L.n ? `for ${L.n + 1}` : 'heads or tails', on: eglNext }; }
  } else {
    if (!st.noSkip) acts.push({ label: 'SKIP', on: eglSkip });
    const p = eglPicks(), need = eglNeed(st), last = egl.step === egl.ev.steps.length - 1;
    if (st.t === 'shopgrid') go = { label: p.length ? `BUY ${p.length}` : 'LEAVE', sub: p.length ? `${p.length * st.price} credits` : 'buy nothing', on: eglNext };
    else if (st.t === 'deckcols') go = { label: last ? 'CUT' : 'NEXT', sub: `${p.length} of ${need} picked`, off: p.length < need, on: eglNext };
    else {
      const o = st.opts[p[0]];
      go = { label: last ? 'CONFIRM' : 'NEXT', sub: o ? (o.title || o.name) : 'tap an option', off: !o, on: eglNext };
    }
  }
  return { acts, go };
}
// The amber screens print their keys as [ BRACKETS ]; MARQUEE's and READOUT's are tiles.
function eglActions(A) {
  const { acts, go } = eglActs(), P = [], term = egl.lay === 'wall' || egl.lay === 'wire' || egl.lay === 'terminal';
  const sw = (term || A.w >= 9) ? 2 : 1, gw = term ? Math.min(4, A.w - sw) : A.w >= 9 ? 3 : 2;
  const h = A.h || 1, small = h < 2 ? ' egl-act1' : '';
  let c = A.c;
  acts.forEach(a => {
    if (c + sw > A.c + A.w - gw) return;
    P.push({ key: 'act-' + a.label, cls: 'egl-act' + small + (term ? ' egl-tact' : ''), c, r: A.r, w: sw, h, tap: a.on,
      html: term ? `<div class="egl-fit" data-min="7" data-chrome>[ ${a.label} ]</div>`
                 : `<div class="egl-fit" data-min="5.5" data-chrome><b>${a.label}</b>${a.sub ? `<i>${a.sub}</i>` : ''}</div>` });
    c += sw;
  });
  P.push({ key: 'act-go', cls: 'egl-act egl-go' + small + (go.off ? ' egl-off' : '') + (term ? ' egl-tact' : ''), c: A.c + A.w - gw, r: A.r, w: gw, h,
    tap: go.off ? eglShake : go.on,
    html: term ? `<div class="egl-fit" data-min="7" data-chrome>[ ${go.label}${go.sub ? ' · ' + eglEsc(go.sub).toUpperCase() : ''} ]</div>`
               : `<div class="egl-fit" data-min="6" data-chrome><b>${go.label}</b>${go.sub ? `<i>${eglEsc(go.sub)}</i>` : ''}</div>` });
  return P;
}

// ── STEP BODIES ─────────────────────────────────────────────────────────────
// mode: 'full' (MARQUEE, WALL), 'keys' (READOUT: a name only, the words go to
// the screen), 'box' (WIREFRAME), 'menu' (TERMINAL's numbered lines).
const eglBodyMode = () => ({ marquee: 'full', wall: 'full', readout: 'keys', wire: 'box', terminal: 'menu' })[egl.lay];
function eglBody(R, G) {
  const st = eglStep(), mode = eglBodyMode();
  if (!st) return [];
  if (st.t === 'ladder') return eglLadderBody(st, R, mode);
  return eglOptsBody(st, R, mode, G);
}
function eglSpread(n, R, w, h) {
  const per = Math.max(1, Math.floor(R.w / w)), rows = Math.ceil(n / per), out = [];
  const r0 = R.r + Math.max(0, Math.floor((R.h - rows * h) / 2));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per), inRow = Math.min(per, n - row * per);
    out.push({ c: R.c + Math.floor((R.w - inRow * w) / 2) + (i % per) * w, r: r0 + row * h, w, h });
  }
  return out;
}
function eglOptHTML(st, o, i, mode) {
  const ent = st.t === 'entities';
  const art = ent && (typeof entityTileHTML === 'function')
    ? entityTileHTML({ entity: o.entity, id: o.id, emoji: o.emoji, label: o.name }, o.rar, { tip: false, extraClass: 'egl-obj' }) : '';
  const ico = ent ? `<div class="egl-art">${art}</div>` : `<div class="egl-ico">${(typeof emGlyph === 'function') ? emGlyph(o.icon) : o.icon}</div>`;
  const title = ent ? o.name : o.title, text = ent ? o.desc : o.text, tag = ent ? o.rar : (o.cost || '');
  if (mode === 'menu') return `<div class="egl-fit" data-min="7"><div class="egl-tm-l"><b>[${i + 1}]</b> ${eglEsc(title.toUpperCase())}<u></u><em>${eglEsc(tag.toUpperCase())}</em></div><div class="egl-tm-x">${eglEsc(eglPlain(text))}</div></div>`;
  if (mode === 'keys') return `<i class="egl-led"></i><div class="egl-fit" data-min="7">${ico}<div class="egl-ot">${eglEsc(title)}</div>`
                            + (tag ? `<div class="egl-cost">${eglEsc(tag)}</div>` : '') + `</div>`;
  if (mode === 'box') return `<div class="egl-wb"><span class="egl-leg">[${i + 1}] ${eglEsc(title.toUpperCase())}</span>`
                           + `<div class="egl-fit" data-min="8">${ico}<div class="egl-ox">${eglEsc(eglPlain(text))}</div>`
                           + (tag ? `<div class="egl-cost">${eglEsc(tag.toUpperCase())}</div>` : '') + `</div></div>`;
  const amber = egl.lay !== 'marquee';
  return `<div class="egl-fit" data-min="7">${ent ? `<div class="egl-tag rar-${o.rar}">${o.rar}</div>` : ''}${ico}<div class="egl-ot">${eglEsc(title)}</div>`
       + `<div class="egl-ox">${amber ? eglEsc(eglPlain(text)) : eglCol(text)}</div>`
       + (o.cost ? `<div class="egl-cost">${eglEsc(o.cost)}</div>` : '') + `</div>`;
}
function eglOptsBody(st, R, mode, G) {
  const n = st.opts.length, sk = eglSk(), P = [], sel = eglPicks();
  const cls = (o, i, extra) => `egl-opt${st.t === 'entities' ? ' egl-ent' : ''}${o.rar ? ' rar-' + o.rar : ''}${st.tone === 'debuff' ? ' egl-debuff' : ''}`
                             + `${sel.includes(i) ? ' egl-sel' : ''}${egl.inspect === i ? ' egl-insp' : ''} ${extra || ''}`;
  if (mode === 'menu') {
    const h = Math.max(1, Math.min(3, Math.floor(R.h / n)));
    st.opts.forEach((o, i) => P.push({ key: `${sk}:o${i}`, cls: cls(o, i, 'egl-tm'), c: R.c, r: R.r + i * h, w: R.w, h, tap: () => eglTap(i), html: eglOptHTML(st, o, i, 'menu') }));
    return P;
  }
  let w, h;
  if (n === 1) { w = Math.min(R.w, G.wide ? 5 : 4); h = R.h; }
  else if (R.w >= n * 2) { w = Math.floor(R.w / n); h = R.h; }
  else { w = R.w; h = Math.max(1, Math.floor(R.h / n)); }
  eglSpread(n, R, w, h).forEach((b, i) => {
    const o = st.opts[i];
    P.push({ key: `${sk}:o${i}`, cls: cls(o, i, G.wide && mode === 'full' ? 'egl-big' : ''), ...b,
      tap: () => eglTap(i), hover: () => eglHover(i), html: eglOptHTML(st, o, i, mode) });
  });
  return P;
}
function eglLadderBody(st, R, mode) {
  const L = egl.ladder, P = [], n = st.rungs.length;
  const cls = i => (L.lost && i < L.n ? ' egl-lost' : !L.lost && i < L.n ? ' egl-lit' : (!L.over && !L.reflip && i === L.n) ? ' egl-next' : '');
  if (mode === 'menu') {
    st.rungs.forEach((t, j) => { const i = n - 1 - j;
      P.push({ key: 'rung' + i, cls: 'egl-tm egl-trung' + cls(i), c: R.c, r: R.r + j, w: R.w, h: 1,
        html: `<div class="egl-fit" data-min="7"><div class="egl-tm-l"><b>RUNG ${i + 1}</b> ${'▮'.repeat(i + 1)}${'▯'.repeat(n - 1 - i)}<u></u><em>${eglEsc(t.toUpperCase())}</em></div></div>` }); });
    return P;
  }
  const rw = Math.max(1, Math.floor((R.w - 2) / n)), wc = R.w - n * rw;
  P.push({ key: 'coin', cls: 'egl-coin', c: R.c, r: R.r, w: wc, h: R.h, html: `<div class="egl-coinhost"></div>` });
  st.rungs.forEach((t, i) => P.push({ key: 'rung' + i, cls: 'egl-rung' + cls(i), c: R.c + wc + i * rw, r: R.r, w: rw, h: R.h,
    html: (mode === 'keys' ? '<i class="egl-led"></i>' : '') + `<div class="egl-bar" style="--lv:${(i + 1) / n}"></div><div class="egl-fit" data-min="7"><b>${i + 1}</b><i>${eglEsc(t)}</i></div>` }));
  return P;
}

// ── THE CARD SCREENS ────────────────────────────────────────────────────────
function eglCardFace(card) {
  let a = null;
  try { a = renderCardAppearance(card, 0, 0, { revealFog: true }); } catch (e) {}
  return a ? `<div class="${a.className}">${a.innerHTML}</div>` : `<div class="card">${card.rank}${card.suit}</div>`;
}
// A market card is not owned, so its buffs are written to the stores for this
// one render and taken straight back out; the face then wears its real bands.
function eglFaceBuffed(card, buffs) {
  const k = cardId(card), S = eglStores(), undo = [];
  buffs.forEach(b => Object.entries(b.e || {}).forEach(([key, v]) => {
    const s = S[key]; if (!s) return;
    undo.push([s, k in s, s[k]]); s[k] = v;
  }));
  try { return eglCardFace(card); }
  finally { undo.reverse().forEach(([s, had, old]) => { if (had) s[k] = old; else delete s[k]; }); }
}
// A card's buffs in a few words: the offer's own labels, or what the deck card holds.
function eglCodes(card, buffs) {
  if (buffs) return buffs.map(b => eglPlain(b.label).toUpperCase());
  const k = cardId(card), S = eglStores(), v = key => (S[key] && S[key][k]) || 0, out = [];
  if (v('pips')) out.push(`+${v('pips')} PIPS`);
  if (v('mult')) out.push(`+${v('mult')} MULT`);
  if (v('xpips') > 1) out.push(`×${v('xpips')} PIPS`);
  if (v('xmult') > 1) out.push(`×${v('xmult')} MULT`);
  if (v('retrig')) out.push(`${v('retrig')} REPLAY`);
  if (v('time')) out.push(`+${v('time')}S REWIND`);
  if (v('focus')) out.push(`+${v('focus')} FOCUS`);
  if (v('coin')) out.push(`+${v('coin')} CREDITS`);
  return out;
}
// The deck in one column per suit, a rank to a row from the Ace down, wilds last.
// A rank no suit holds has no row; a rank one suit holds twice has two.
function eglDeckCols(cards) {
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS.slice() : ['♠', '♥', '♦', '♣'];
  const rv = r => ({ J: 11, Q: 12, K: 13, A: 14 }[r] || +r || 0);
  const ranks = ((typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS.slice() : ['2','3','4','5','6','7','8','9','10','J','Q','K','A'])
    .sort((a, b) => rv(b) - rv(a));
  const W = typeof WILD_RANK !== 'undefined' ? WILD_RANK : '✶';
  if (!ranks.includes(W)) ranks.push(W);
  const used = new Set(), rows = [];
  ranks.forEach(rk => {
    const per = suits.map(s => cards.reduce((a, c, i) => (c.rank === rk && c.suit === s ? a.concat(i) : a), []));
    per.forEach(a => a.forEach(i => used.add(i)));
    const n = Math.max(0, ...per.map(a => a.length));
    for (let k = 0; k < n; k++) rows.push(per.map(a => a[k] ?? -1));
  });
  const rest = cards.map((c, i) => i).filter(i => !used.has(i));
  for (let j = 0; j < rest.length; j += suits.length) rows.push(suits.map((s, k) => rest[j + k] ?? -1));
  return { cols: suits.length, rows };
}
// Which material a card takes: the real face (MARQUEE, READOUT), a screen of its
// own (WALL) or a line drawing on the shared glass (WIREFRAME, TERMINAL).
const eglCardStyle = () => ({ marquee: 'face', readout: 'face', wall: 'phos', wire: 'line', terminal: 'line' })[egl.lay];
function eglSlotHTML(s, style, cw, ch, sel, cut) {
  if (!s) return `<div class="egl-vs egl-vempty"></div>`;
  const on = sel.includes(s.i) ? (cut ? ' egl-vcut' : ' egl-vbuy') : '', insp = egl.inspect === s.i ? ' egl-insp' : '';
  if (style === 'face') {
    const fh = s.buffs ? ch * 0.66 : ch;
    const lab = s.buffs ? `<div class="egl-fit egl-vlab" data-min="6"><div>${eglCol(s.buffs.map(b => b.label).join(' · '))}</div></div>` : '';
    return `<div class="egl-vs${on}${insp}" data-i="${s.i}" style="--card-w:${(cw - 2).toFixed(1)}px;--card-h:${(fh - 2).toFixed(1)}px">`
         + `<div class="egl-vface">${s.buffs ? eglFaceBuffed(s.card, s.buffs) : eglCardFace(s.card)}</div>${lab}<i class="egl-x">CUT</i></div>`;
  }
  const red = s.card.suit === '♥' || s.card.suit === '♦' ? ' egl-red' : '';
  const codes = eglCodes(s.card, s.buffs);
  return `<div class="egl-vs egl-tc egl-tc-${style}${red}${on}${insp}${codes.length ? ' egl-tcb' : ''}" data-i="${s.i}">`
       + `<b>${eglEsc(s.card.rank)}</b><i>${s.card.suit || ''}</i>${codes.length ? `<em>${codes.map(eglEsc).join('<br>')}</em>` : ''}<u>CUT</u></div>`;
}
function eglViewPiece(R, G) {
  const st = eglStep(), b = G.box(R.c, R.r, R.w, R.h), style = eglCardStyle(), cut = st.t === 'deckcols';
  let cols, rows, slots, vis;
  if (cut) {
    const D = eglDeckCols(st.cards);
    cols = D.cols; rows = D.rows.length; vis = Math.min(EGL_DECK_ROWS, rows);
    slots = D.rows.flat().map(i => i < 0 ? null : { i, card: st.cards[i] });
  } else {
    cols = gridCols || 4; rows = Math.ceil(st.items.length / cols); vis = rows;
    slots = st.items.map((it, i) => ({ i, card: it.card, buffs: it.buffs }));
  }
  const pad = 3, gap = 4;
  const cw = (b.w - 2 * pad - (cols - 1) * gap) / cols, ch = (b.h - 2 * pad - (vis - 1) * gap) / vis;
  if (!egl.measuring) egl.view = { rows, vis };
  const sel = eglPicks();
  const html = `<div class="egl-vw" style="--vc:${cols};--vh:${ch.toFixed(2)}px;--vg:${gap}px">`
             + slots.map(s => eglSlotHTML(s, style, cw, ch, sel, cut)).join('') + `</div>`;
  return { key: `${eglSk()}:view`, cls: `egl-view egl-v-${style}${cut ? ' egl-v-cut' : ''}`, ...R, html,
    tap: e => { if (egl.dragged) return; const s = e.target.closest('[data-i]'); if (s) eglTap(+s.dataset.i); },
    hoverAt: e => { const s = e.target.closest('[data-i]'); if (s) eglHover(+s.dataset.i); } };
}

// ── THE LAYOUTS ─────────────────────────────────────────────────────────────
// MARQUEE, WALL and WIREFRAME share Marquee's plan: prompt on top (a column on
// the left with room), options under it, the action row at the foot.
function eglLayMarquee(G) {
  const P = [], ah = egl.lay === 'wire' ? 1 : 2;
  if (G.wide) {
    const pw = G.cols >= 11 ? 4 : 3, R = { c: pw, r: 0, w: G.cols - pw, h: G.rows - ah };
    P.push(eglPromptPiece({ c: 0, r: 0, w: pw, h: G.rows }));
    P.push(...(egl.done ? eglResult(R) : eglBody(R, G)), ...eglActions({ c: pw, r: G.rows - ah, w: G.cols - pw, h: ah }));
  } else {
    const R = { c: 0, r: 4, w: G.cols, h: G.rows - 4 - ah };
    P.push(eglPromptPiece({ c: 0, r: 0, w: G.cols, h: 4 }));
    P.push(...(egl.done ? eglResult(R) : eglBody(R, G)), ...eglActions({ c: 0, r: G.rows - ah, w: G.cols, h: ah }));
  }
  return P;
}
// READOUT: half the board is the screen; the keys and the action row share the
// rest. Keys too many to stand side by side (a phone) stack, so they get more.
function eglLayReadout(G) {
  const st = eglStep(), n = st && st.opts ? st.opts.length : 0, sh = n > 1 && G.cols < n * 2 ? 4 : 6;
  const P = [eglPromptPiece({ c: 0, r: 0, w: G.cols, h: sh })];
  if (!egl.done) P.push(...eglBody({ c: 0, r: sh, w: G.cols, h: G.rows - sh - 2 }, G));
  P.push(...eglActions({ c: 0, r: G.rows - 2, w: G.cols, h: 2 }));
  return P;
}
// A card screen: a head over the cards, the action row one half-row tall.
function eglLayView(G) {
  const hh = egl.lay === 'readout' ? 3 : 2;
  return [eglPromptPiece({ c: 0, r: 0, w: G.cols, h: hh }, true), eglViewPiece({ c: 0, r: hh, w: G.cols, h: G.rows - hh - 1 }, G),
          ...eglActions({ c: 0, r: G.rows - 1, w: G.cols, h: 1 })];
}
function eglTermLines() {
  const ev = egl.ev, st = eglStep(), L = egl.ladder, out = [];
  out.push(['egl-t-h', `EVENT // ${ev.name.toUpperCase()}`], ['', ev.flavor], ['', '']);
  if (egl.done) { out.push(['egl-t-h', egl.skipped ? '> SKIPPED' : '> DONE']); eglOutcome().forEach(l => out.push(['', eglPlain(l)])); out.push(['egl-t-dim', ''], ['egl-t-dim', 'PRESS DONE TO RETURN TO THE BOARD']); return out; }
  if (st.note) out.push(['', eglPlain(st.note)], ['', '']);
  if (st.t === 'ladder') L.log.forEach(l => out.push([/LOST|TAILS/.test(l) ? 'egl-t-bad' : /HEADS/.test(l) ? 'egl-t-good' : '', l]));
  out.push(['egl-t-h', `> ${eglTxt(st.label)}`]);
  return out;
}
function eglLayTerminal(G) {
  const st = eglStep(), P = [];
  if (eglIsView(st)) {
    const lines = [['egl-t-h', `EVENT // ${egl.ev.name.toUpperCase()} // ${eglTxt(st.label)}`], ...eglInspectLines()];
    return [{ key: 'screen-head', cls: 'egl-term', c: 0, r: 0, w: G.cols, h: 3, html: eglLinesHTML(lines, 8) },
            eglViewPiece({ c: 0, r: 3, w: G.cols, h: G.rows - 4 }, G), ...eglActions({ c: 0, r: G.rows - 1, w: G.cols, h: 1 })];
  }
  const menu = !st ? 0 : st.t === 'ladder' ? st.rungs.length : Math.min(st.opts.length * 2, G.rows - 5);
  let S, R;
  if (G.wide && menu) { const half = Math.floor(G.cols / 2); S = { c: 0, r: 0, w: half, h: G.rows - 1 }; R = { c: half, r: 0, w: G.cols - half, h: G.rows - 1 }; }
  else { S = { c: 0, r: 0, w: G.cols, h: G.rows - 1 - menu }; R = { c: 0, r: G.rows - 1 - menu, w: G.cols, h: menu }; }
  P.push({ key: 'screen', cls: 'egl-term', ...S, html: eglLinesHTML(eglTermLines(), 8) });
  if (st && menu) P.push(...eglBody(R, G));
  P.push(...eglActions({ c: 0, r: G.rows - 1, w: G.cols, h: 1 }));
  return P;
}

// ── DRAWING ─────────────────────────────────────────────────────────────────
function eglPlace(el, p, G) {
  const b = G.box(p.c, p.r, p.w, p.h);
  el.style.left = b.l + 'px'; el.style.top = b.t + 'px'; el.style.width = b.w + 'px'; el.style.height = b.h + 'px';
  el.dataset.d = (p.c + p.r) * 20;
}
// Shrink each .egl-fit until its text stays inside its cell: a binary search
// over --fit, 0.5 to 1. Returns the smallest fit and smallest text (design px).
function eglFitAll(host) {
  let fit = 1, px = Infinity;
  host.querySelectorAll('.egl-fit').forEach(el => {
    const over = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    el.style.setProperty('--fit', 1);
    let f = 1;
    if (over()) {
      let lo = 0.5, hi = 1;
      for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; el.style.setProperty('--fit', m); if (over()) hi = m; else lo = m; }
      f = Math.floor(lo * 100) / 100; el.style.setProperty('--fit', f);
    }
    el._fit = f;
    if (!('chrome' in el.dataset)) { fit = Math.min(fit, f); px = Math.min(px, (+el.dataset.min || 8) * f); }
  });
  return { fit, px };
}
// The same pieces at another size, drawn out of sight, to read their fit.
function eglMeasure(rect) {
  const host = egl.measure;
  host.style.width = rect.w + 'px'; host.style.height = rect.h + 'px';
  const G = eglGeom(rect);
  egl.measuring = true;
  const pieces = eglPieces(G);
  egl.measuring = false;
  const els = new Map();
  pieces.forEach(p => {
    const el = document.createElement('div');
    el.className = 'egl-cell ' + (p.cls || '');
    el.innerHTML = p.html || '';
    eglPlace(el, p, G);
    host.appendChild(el);
    els.set(p.key, el);
  });
  const m = eglFitAll(host);
  m.fits = new Map([...els].map(([k, el]) => [k, [...el.querySelectorAll('.egl-fit')].map(f => f._fit)]));
  host.innerHTML = '';
  return m;
}
function eglDraw(opts = {}) {
  if (!egl) return;
  const room = eglRoomNow(), T = eglRoomTarget(room);
  const moved = room !== egl.room || opts.relayout;
  egl.room = room;
  eglSetSlide(!!T.slide);
  egl.layer.classList.toggle('egl-roomy', room !== 'box');
  eglSetRect(T.rect, moved && !opts.instant);
  egl.layer.dataset.lay = egl.lay;
  const G = eglGeom(T.rect);
  const m = eglMeasure(T.rect);
  eglReconcile(eglPieces(G), G, m.fits, { turn: !!opts.turn, animate: !opts.instant });
  egl.metric = { fit: m.fit, px: m.px, room };
  eglMountCoin();
  eglMountView();
  eglScrollPaint();
  eglPanelPaint();
}
function eglReconcile(pieces, G, fits, { turn, animate }) {
  const board = egl.board, old = new Map();
  board.querySelectorAll(':scope > .egl-cell').forEach(el => { if (!el._dying) old.set(el.dataset.k, el); });
  const seen = new Set(), born = [];
  pieces.forEach(p => {
    let el = turn ? null : old.get(p.key), prev = null;
    if (el) {
      seen.add(p.key);
      prev = { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      el.getAnimations().forEach(a => a.cancel());
    } else {
      el = document.createElement('div'); el.dataset.k = p.key; board.appendChild(el); born.push(el);
    }
    const cls = 'egl-cell ' + (p.cls || '');
    if (el.className !== cls) el.className = cls;
    if (el._html !== p.html) { el.innerHTML = p.html || ''; el._html = p.html; }
    el.onclick = p.tap ? e => { e.stopPropagation(); p.tap(e); } : null;
    el.onmouseenter = p.hover || null;
    el.onmouseover = p.hoverAt || null;
    eglPlace(el, p, G);
    (fits.get(p.key) || []).forEach((f, j) => { const fe = el.querySelectorAll('.egl-fit')[j]; if (fe) fe.style.setProperty('--fit', f); });
    const b = G.box(p.c, p.r, p.w, p.h);
    if (prev && animate && (Math.abs(prev.l - b.l) > 0.5 || Math.abs(prev.t - b.t) > 0.5 || Math.abs(prev.w - b.w) > 0.5 || Math.abs(prev.h - b.h) > 0.5))
      el.animate([{ left: prev.l + 'px', top: prev.t + 'px', width: prev.w + 'px', height: prev.h + 'px' },
                  { left: b.l + 'px', top: b.t + 'px', width: b.w + 'px', height: b.h + 'px' }], { duration: EGL_MS, easing: EGL_EASE });
  });
  // The dead fold away edge-on; a layout change folds them in a wave from the top left.
  old.forEach((el, k) => {
    if (seen.has(k)) return;
    el._dying = true; el.onclick = null; el.onmouseenter = null; el.onmouseover = null; el.classList.add('egl-dying');
    if (!animate) { el.remove(); return; }
    const a = el.animate([{ transform: 'perspective(520px) rotateY(0deg)', opacity: 1 }, { transform: 'perspective(520px) rotateY(90deg)', opacity: 0.3 }],
      { duration: 190, delay: turn ? +el.dataset.d : 0, easing: 'ease-in', fill: 'forwards' });
    a.finished.then(() => el.remove(), () => el.remove());
  });
  if (!animate) return;
  born.forEach(el => el.animate([{ transform: 'perspective(520px) rotateY(-90deg)', opacity: 0.3 }, { transform: 'perspective(520px) rotateY(0deg)', opacity: 1 }],
    { duration: 240, delay: (turn ? 250 : 0) + +el.dataset.d, easing: 'ease-out', fill: 'backwards' }));
}
function eglMountCoin() {
  const host = egl.board.querySelector('.egl-coin:not(.egl-dying) .egl-coinhost');
  if (!host || typeof evCoin !== 'function') { egl.coin = null; return; }
  if (!host.firstChild) egl.coin = evCoin(host);
  const L = egl.ladder;
  if (egl.coin && !L.busy) egl.coin.caption(...(L.cap || ['HEADS OR TAILS', '']));
}
function eglShake() {
  egl.layer.animate([{ translate: '0 0' }, { translate: '-4px 0' }, { translate: '3px 0' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 260 });
  if (typeof sfxRefuse === 'function') try { sfxRefuse(); } catch (e) {}
}

// ── SCROLLING THE DECK ──────────────────────────────────────────────────────
// The suit columns scroll a row at a time: the arrows on the Focus bar, the
// mouse wheel over the cards, or a drag. --vr on the view is the top row.
function eglScrollMax() { const V = egl.view; return V ? Math.max(0, V.rows - V.vis) : 0; }
function eglScrollBy(d) {
  const n = Math.max(0, Math.min(eglScrollMax(), egl.dvRow + d));
  if (n === egl.dvRow) return false;
  egl.dvRow = n;
  egl.board.querySelector('.egl-view:not(.egl-dying)')?.style.setProperty('--vr', n);
  eglScrollPaint();
  if (typeof sfxKeyClick === 'function') try { sfxKeyClick('up'); } catch (e) {}
  return true;
}
function eglMountView() {
  const el = egl.board.querySelector('.egl-view:not(.egl-dying)');
  if (!el) return;
  egl.dvRow = Math.min(egl.dvRow, eglScrollMax());
  el.style.setProperty('--vr', egl.dvRow);
  if (el._wired || !el.classList.contains('egl-v-cut')) return;
  el._wired = true;
  let acc = 0, y0 = null, step = 40;
  el.addEventListener('wheel', e => {
    e.preventDefault();
    acc += e.deltaY;
    if (Math.abs(acc) >= 40) { eglScrollBy(Math.sign(acc)); acc = 0; }
  }, { passive: false });
  el.addEventListener('pointerdown', e => { y0 = e.clientY; egl.dragged = false; step = (el.querySelector('.egl-vs')?.getBoundingClientRect().height || 40) * 0.7; });
  el.addEventListener('pointermove', e => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    if (Math.abs(dy) >= step) { eglScrollBy(dy < 0 ? 1 : -1); y0 = e.clientY; egl.dragged = true; }
  });
  const end = () => { y0 = null; setTimeout(() => { if (egl) egl.dragged = false; }, 0); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
}
// Owner: for this screen, up and down arrows appear on the Focus bar. They sit
// over it while the deck is open and go when it closes.
function eglScrollPaint() {
  let sc = document.getElementById('egl-scroll');
  const fm = document.getElementById('focus-meter-wrap'), st = egl && !egl.closing && !egl.done ? eglStep() : null;
  const on = st && st.t === 'deckcols' && egl.room === 'box' && eglScrollMax() > 0 && fm && fm.offsetWidth;
  if (!on) { sc?.classList.remove('on'); return; }
  if (!sc) {
    sc = document.createElement('div'); sc.id = 'egl-scroll';
    sc.innerHTML = '<button class="egl-sc-b" data-d="-1" aria-label="Scroll up">▲</button><div class="egl-sc-t"><i></i></div>'
                 + '<button class="egl-sc-b" data-d="1" aria-label="Scroll down">▼</button>';
    document.getElementById('stage').appendChild(sc);
    // A press steps once; holding it keeps stepping.
    sc.querySelectorAll('.egl-sc-b').forEach(b => {
      let t = null;
      const stop = () => { clearTimeout(t); clearInterval(t); t = null; };
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); stop();
        const d = +b.dataset.d;
        if (!egl || !eglScrollBy(d)) return;
        t = setTimeout(() => { t = setInterval(() => { if (!egl || !eglScrollBy(d)) stop(); }, 110); }, 320);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    });
  }
  const r = eglDesignRect(fm);
  Object.assign(sc.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  sc.dataset.lay = egl.lay;
  const V = egl.view, max = eglScrollMax(), th = sc.querySelector('.egl-sc-t i');
  th.style.top = (egl.dvRow / V.rows * 100) + '%';
  th.style.height = (V.vis / V.rows * 100) + '%';
  sc.querySelector('[data-d="-1"]').disabled = egl.dvRow <= 0;
  sc.querySelector('[data-d="1"]').disabled = egl.dvRow >= max;
  sc.classList.add('on');
}

// ── OPEN AND CLOSE ──────────────────────────────────────────────────────────
// The board's own cards turn edge-on and the event's cells turn in behind
// them; closing is the same in reverse. The turned-away cards hold edge-on
// (fill forwards) until the board is hidden, then hand their rotate back.
let _eglBoardAnims = [];
function eglTurnBoard(out) {
  const cards = [...document.querySelectorAll('#grid > .card, #grid > .trick-card')];
  let end = 0;
  cards.forEach(el => {
    const d = Math.round((el.offsetLeft + el.offsetTop) / 7);
    end = Math.max(end, d + 220);
    const a = el.animate([{ rotate: `y ${out ? 0 : -90}deg` }, { rotate: `y ${out ? 90 : 0}deg` }],
      { duration: 220, delay: d, easing: out ? 'ease-in' : 'ease-out', fill: out ? 'forwards' : 'backwards' });
    if (out) _eglBoardAnims.push(a);
  });
  return new Promise(r => setTimeout(r, end + 20));
}
function eglBoardHidden() {
  document.body.classList.add('egl-on');
  egl.layer.style.visibility = '';
  _eglBoardAnims.forEach(a => { try { a.cancel(); } catch (e) {} });
  _eglBoardAnims = [];
}
function eglOpen() {
  if (egl) return;
  try { gameTimerPaused = true; } catch (e) {}
  document.getElementById('next-goal-bg')?.classList.remove('show');
  const layer = document.createElement('div'); layer.id = 'egl';
  layer.innerHTML = '<div class="egl-board"></div><div class="egl-board egl-measure" aria-hidden="true"></div>';
  document.getElementById('stage').appendChild(layer);
  egl = { layer, board: layer.firstChild, measure: layer.lastChild, samples: eglSamples(), room: 'box', rect: null, slid: false };
  eglPrefs.ev = Math.min(eglPrefs.ev, egl.samples.length - 1);
  if (!EGL_LAYOUTS[eglPrefs.lay]) eglPrefs.lay = 'wall';
  if (!EGL_ROOMS[eglPrefs.room]) eglPrefs.room = 'box';
  egl.lay = eglPrefs.lay;
  layer.dataset.lay = egl.lay;
  eglPanelBuild();
  layer.style.visibility = 'hidden';
  eglSetRect(eglBoxRect(), false);
  eglTurnBoard(true).then(() => { if (!egl) return; eglBoardHidden(); eglStart(false); });
  egl.onResize = () => { clearTimeout(egl.resT); egl.resT = setTimeout(eglResize, 200); };
  addEventListener('resize', egl.onResize);
}
// DONE: the event turns back into the board, which is what the real thing does
// once it has paid; the lab then deals the same event again.
function eglClose(again) {
  if (!egl || egl.closing) return;
  egl.closing = true;
  eglScrollPaint();
  [...egl.board.children].forEach(el => el.animate([{ transform: 'perspective(520px) rotateY(0deg)' }, { transform: 'perspective(520px) rotateY(90deg)' }],
    { duration: 190, delay: +el.dataset.d || 0, easing: 'ease-in', fill: 'forwards' }));
  const room = egl.room;
  setTimeout(() => {
    if (!egl) return;
    egl.board.innerHTML = '';
    egl.room = 'box';
    eglSetSlide(false); eglSetRect(eglBoxRect(), room !== 'box');
    egl.layer.classList.remove('egl-roomy');
    setTimeout(() => {
      if (!egl) return;
      document.body.classList.remove('egl-on');
      egl.layer.style.visibility = 'hidden';
      eglTurnBoard(false).then(() => {
        if (!egl) return;
        if (!again) { eglTeardown(); return; }
        setTimeout(() => { if (!egl) return; egl.closing = false;
          eglTurnBoard(true).then(() => { if (!egl) return; eglBoardHidden(); eglStart(false); }); }, 650);
      });
    }, room !== 'box' ? EGL_MS + 60 : 0);
  }, 420);
}
function eglResize() {
  if (!egl || egl.closing) return;
  (egl.slideEls || []).forEach(({ el }) => { el.style.transition = 'none'; el.style.translate = ''; });
  egl.slid = false; egl.slideEls = null; egl.room = 'box';
  void document.body.offsetWidth;
  eglDraw({ instant: true });
}
function eglTeardown() {
  if (!egl) return;
  removeEventListener('resize', egl.onResize);
  eglSetSlide(false);
  egl.layer.remove(); egl.panel?.remove(); document.getElementById('egl-scroll')?.remove();
  document.body.classList.remove('egl-on');
  egl = null;
}

// ── THE PANEL ───────────────────────────────────────────────────────────────
function eglPanelBuild() {
  const p = document.createElement('div');
  p.id = 'egl-panel';
  const lays = ids => ids.map(k => `<button data-lay="${k}">${EGL_LAYOUTS[k].name}</button>`).join('');
  p.innerHTML = `
    <div class="eglp-head"><b>EVENT LAYOUTS</b><span class="eglp-n"></span><button class="eglp-side" title="Other side">⇄</button><button class="eglp-min" title="Fold">–</button><button class="eglp-x" title="Close">×</button></div>
    <div class="eglp-body">
      <div class="eglp-row"><button class="eglp-prev">‹</button><div class="eglp-ev"><div class="eglp-name"></div><div class="eglp-shape"></div></div><button class="eglp-next">›</button></div>
      <div class="eglp-lab">MARQUEE × TERMINAL</div>
      <div class="eglp-row">${lays(EGL_COMBINED)}</div>
      <div class="eglp-lab">THE ORIGINALS</div>
      <div class="eglp-row">${lays(Object.keys(EGL_LAYOUTS).filter(k => !EGL_COMBINED.includes(k)))}</div>
      <div class="eglp-note"></div>
      <div class="eglp-lab">ROOM</div>
      <div class="eglp-row">${Object.entries(EGL_ROOMS).map(([k, v]) => `<button data-room="${k}">${v}</button>`).join('')}</div>
      <label class="eglp-need"><input type="checkbox"> only when the text won't fit</label>
      <div class="eglp-metric"></div>
      <div class="eglp-row"><button class="eglp-replay">REPLAY</button></div>
    </div>`;
  document.body.appendChild(p);
  egl.panel = p;
  const ev = d => { eglPrefs.ev = (eglPrefs.ev + d + egl.samples.length) % egl.samples.length; eglSavePrefs(); eglStart(false); };
  p.querySelector('.eglp-prev').onclick = () => ev(-1);
  p.querySelector('.eglp-next').onclick = () => ev(1);
  p.querySelectorAll('[data-lay]').forEach(b => b.onclick = () => { eglPrefs.lay = egl.lay = b.dataset.lay; eglSavePrefs(); eglStart(false); });
  p.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { if (b.disabled) return; eglPrefs.room = b.dataset.room; eglSavePrefs(); eglDraw(); });
  p.querySelector('.eglp-need input').onchange = e => { eglPrefs.need = e.target.checked; eglSavePrefs(); eglDraw(); };
  p.querySelector('.eglp-replay').onclick = () => eglStart(false);
  p.querySelector('.eglp-min').onclick = () => p.classList.toggle('folded');
  p.classList.toggle('eglp-right', !!eglPrefs.right);
  p.querySelector('.eglp-side').onclick = () => { eglPrefs.right = !eglPrefs.right; eglSavePrefs(); p.classList.toggle('eglp-right', eglPrefs.right); };
  p.querySelector('.eglp-x').onclick = () => eglClose(false);
  p.addEventListener('keydown', e => e.stopPropagation());
  if (innerWidth < 700) p.classList.add('folded');
}
function eglPanelPaint() {
  const p = egl && egl.panel; if (!p) return;
  const ev = egl.ev, M = egl.metric || {};
  p.querySelector('.eglp-n').textContent = `${eglPrefs.ev + 1} / ${egl.samples.length}`;
  p.querySelector('.eglp-name').textContent = ev.name;
  p.querySelector('.eglp-shape').textContent = ev.shape;
  p.querySelectorAll('[data-lay]').forEach(b => b.classList.toggle('on', b.dataset.lay === egl.lay));
  const land = eglLandscape();
  p.querySelectorAll('[data-room]').forEach(b => { b.classList.toggle('on', b.dataset.room === eglPrefs.room); b.disabled = !land && b.dataset.room !== 'box'; });
  p.querySelector('.eglp-need input').checked = !!eglPrefs.need;
  p.querySelector('.eglp-note').textContent = EGL_LAYOUTS[egl.lay].note + (land ? '' : ' (Portrait: in the box only.)');
  // The smallest text as drawn on screen, beside the pick of three's 7.5px
  // descriptions on this screen for scale.
  const z = eglZoom(), shrunk = M.fit < 1 ? `, shrunk to ${Math.round(M.fit * 100)}%` : '';
  p.querySelector('.eglp-metric').innerHTML = (isFinite(M.px) ? `Smallest text <b>${(M.px * z).toFixed(1)}px</b> on screen${shrunk}.<br>` : '')
    + `Pick of three descriptions: ${(7.5 * z).toFixed(1)}px.`
    + (eglIsView(eglStep()) ? '<br>Card screens stay in the box.' : eglPrefs.need && M.room !== eglPrefs.room ? '<br>Fits in the box, so it stays there.' : '');
}

// ── ENTRY ───────────────────────────────────────────────────────────────────
// index.html?evgrid starts a Classic run for it, as the event tour does.
(function () {
  if (!/[?&]evgrid\b/.test(location.search)) return;
  try { window.insightsOn = () => false; } catch (e) {}
  window.addEventListener('load', () => setTimeout(() => {
    try { devStartMode('normal'); } catch (e) {}
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      try { coins = Math.max(coins, 60); updateCoinsUI?.(); } catch (e) {}
      try { const fill = TRICK_POOL.filter(t => !t.retired && !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(t.id)));
            while (trickTray.length < 4 && fill.length && !trickTrayFull()) injectTrickAfterReward(fill.shift()); } catch (e) {}
      try { gameTimerPaused = true; recomputeGridMetrics(); _devSafeRender(); } catch (e) {}
      eglOpen();
    }, 2500);
  }, 1200));
})();
