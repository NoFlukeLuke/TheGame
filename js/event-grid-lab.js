// ═══════════════════════════════════════════════════════════════════════════
// EVENT GRID LAB (r588, r589, r593) - events drawn as the board
// ═══════════════════════════════════════════════════════════════════════════
// Owner: every event should live on the board. A LOOK preview: nothing here is
// granted and no real event handler runs. Open index.html?evgrid (or dev ->
// Events & Bosses -> Event layouts). It starts a Classic run, pauses it, and
// turns the board into one of six sample events, one per shape an event takes.
//
// r589: three crossings of Marquee and Terminal (WALL, READOUT, WIREFRAME)
// beside both originals. r593, the owner's pick: WIREFRAME in the box, with
//   - a 12-colour phosphor palette (EGL_PALETTE) so keywords, rarities, suits
//     and buffs keep something of their own colour on the amber glass
//   - an entity drawn large with no description; pointing at it or tapping it
//     opens the game's own tooltip
//   - ONE cursor on the board: in the prompt until a choice is made, then in
//     the chosen box (eglCursorHome)
//   - text that types out a character at a time (Settings -> Text speed,
//     textTypeCps); a tap finishes it
//   - card screens laid out as a 6 x 6 board: the words across the top row and
//     a half, the cards in the middle four columns at a playing card's shape
//   - old-school transitions between screens: CONSOLE (a command is typed, its
//     output scrolls the old screen away) or CUBE (the board turns like a cube)
// The other layouts stay for comparison and share all of it but the palette.
// Two screens follow the owner's designs in every layout and keep the box:
//   Card Market  the board itself, sixteen buffed cards
//   Deck Trim    the deck in one column per suit, a rank to a row, scrolled by
//                arrows over the Focus bar (or the wheel, or a drag)
//
// The layer is #egl, a child of #stage placed in design px. Every layout lays
// out on twelve half-cell rows; a piece is one cell or a merged run of cells,
// and every redraw is KEYED, so a surviving cell keeps its element. Text is
// N px x var(--fit), fitted on a hidden copy of the board first.

const EGL_KEY = 'lethe.eventGridLab.v3';
const EGL_ROWS = 12;          // half-cell rows, on every layout
const EGL_CELL = 55;          // target cell width, design px: sets the column count
const EGL_PAD = 6, EGL_GAP = 5;
const EGL_NEED_FIT = 0.85;    // "only when it won't fit" goes wide below this
const EGL_MS = 560;           // a room change or a cell's move
const EGL_EASE = 'cubic-bezier(.62,0,.24,1)';
const EGL_REFLIP = 20;        // Hot Streak's second chance, as the event prices it
const EGL_VIEW_ROWS = 4;      // card rows in view on a card screen (a 6 x 6 board's middle)
const EGL_CARD_RATIO = 0.714; // a playing card's width over its height (2.5 x 3.5)
const EGL_CON_LH = 13;        // design px a console line takes in the CONSOLE transition
const EGL_LAYOUTS = {
  wire:     { name: 'WIREFRAME', note: 'One amber screen with Marquee drawn on it in lines: the prompt in a double box, each option and card in its own box.' },
  wall:     { name: 'WALL',      note: 'Marquee as a wall of small amber screens: the prompt on the big one, every option and card on its own.' },
  readout:  { name: 'READOUT',   note: 'One amber screen over a row of keys. Touching a key prints its full text on the screen; the keys only carry a name.' },
  terminal: { name: 'TERMINAL',  note: 'The event prints onto one screen, options are numbered lines.' },
  marquee:  { name: 'MARQUEE',   note: 'A big prompt cell on top, options as cells under it.' },
};
const EGL_ROOMS = { box: 'IN THE BOX', slide: 'SLIDE OFF' };
const EGL_TRANS = { console: 'CONSOLE', cube: 'CUBE', flip: 'FLIP' };
// The phosphor palette (owner): twelve colours with the amber's warmth, so a
// thing can keep a hint of its usual colour on the amber screens. Written onto
// #egl as --wf-<name>; the CSS reads only those. [name, colour, what wears it]
const EGL_PALETTE = [
  ['amber',  '#ffb02e', 'words'],
  ['bright', '#ffd98a', 'titles, box labels'],
  ['dim',    '#9a6f2a', 'rules, quiet text'],
  ['cream',  '#fff1d8', 'spades, rewind, Sleights'],
  ['gold',   '#ffe066', 'credits, score, diamonds'],
  ['coral',  '#ff7656', 'mult, hearts, costs, losses'],
  ['rose',   '#ff8fb8', 'legendary, replay, wilds'],
  ['violet', '#d6a8ff', 'epic, Focus'],
  ['sky',    '#a4c6ff', 'pips, clubs, hands'],
  ['teal',   '#82dccb', 'rare, time, swap'],
  ['mint',   '#94ecb0', 'common, gains, play'],
  ['sage',   '#cde37e', 'pause'],
];
// Where each buff key's value lives on a card (the stores in js/deck-grid.js).
const eglStores = () => ({ pips: permPips, mult: permMult, time: permTime, retrig: permRetrig,
                           xpips: permXPips, xmult: permXMult, focus: permFocus, coin: permCoins });

let egl = null;               // the open lab, or null
const eglPrefs = { ev: 0, lay: 'wire', room: 'box', tr: 'console', need: false, right: false };
try {
  ['lethe.eventGridLab.v1', 'lethe.eventGridLab.v2'].forEach(k => localStorage.removeItem(k));   // the owner's pick is the new default
  Object.assign(eglPrefs, JSON.parse(localStorage.getItem(EGL_KEY) || '{}') || {});
} catch (e) {}
function eglSavePrefs() { try { localStorage.setItem(EGL_KEY, JSON.stringify(eglPrefs)); } catch (e) {} }
const eglTxt = v => (typeof v === 'function' ? v() : v) || '';
const eglEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const eglPlain = s => String(s || '').replace(/<[^>]*>/g, '');
const eglCol = s => (typeof colorizeKeywords === 'function') ? colorizeKeywords(s || '') : eglEsc(s || '');
const eglRand = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());
const eglIsView = st => !!st && (st.t === 'shopgrid' || st.t === 'deckcols');
const eglTypeCps = () => (typeof textTypeCps === 'function') ? textTypeCps() : 160;
const eglSuitCls = s => ({ '♠': 'sp', '♥': 'he', '♦': 'di', '♣': 'cl' })[s] || 'xx';

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
  // Owner: the market is the board, full of buffed cards (a 6 x 6 board's
  // middle four by four). The real event's odds of a second buff hold.
  const two = BAL.market.two_buffs / (BAL.market.two_buffs + BAL.market.one_buff);
  const offers = Array.from({ length: EGL_VIEW_ROWS * 4 }, () =>
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
function eglReset() {
  egl.ev = egl.samples[eglPrefs.ev];
  egl.step = 0; egl.picks = []; egl.done = false; egl.skipped = false;
  egl.inspect = null; egl.dvRow = 0;
  egl.ladder = { n: 0, busy: false, over: false, lost: false, reflip: false, used: false, cap: null, log: [] };
  egl.seen = new Set();
  if (egl.ty) egl.ty.q = [];
}
// A layout or event change from the panel.
function eglStart() { eglGo(eglReset, 'switch'); }
function eglTap(i) {
  const st = eglStep(); if (!st || egl.busy || egl.ladder.busy) return;
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
  // An entity says what it does in the game's own tooltip, on a tap as well as
  // under the pointer.
  if (st.t === 'entities' && typeof showEntityTooltip === 'function' && typeof _etReadData === 'function') {
    const el = egl.board.querySelector(`[data-k="${eglSk()}:o${i}"] [data-et]`);
    const pl = el && _etReadData(el);
    if (pl) try { showEntityTooltip(el, pl); } catch (e) {}
  }
}
// READOUT prints whatever the pointer rests on, before it is tapped; so does a
// card screen in every layout (its cards carry marks, not words).
function eglHover(i) {
  if ((egl.lay !== 'readout' && !eglIsView(eglStep())) || egl.inspect === i || egl.ladder.busy || egl.busy || eglTyping()) return;
  egl.inspect = i; eglDraw();
}
function eglNext() {
  if (egl.busy) return;
  if (egl.done) { eglClose(true); return; }
  const st = eglStep();
  if (st.t === 'ladder') { const L = egl.ladder; if (L.over) eglGo(() => { egl.done = true; }, 'done'); else eglFlip(L.reflip); return; }
  if (!eglReady()) { eglShake(); return; }
  const last = egl.step >= egl.ev.steps.length - 1;
  eglGo(() => { egl.inspect = null; egl.dvRow = 0; if (last) egl.done = true; else egl.step++; }, last ? 'done' : 'step');
}
function eglSkip() {
  if (egl.busy) return;
  const L = egl.ladder, ladder = eglStep()?.t === 'ladder' && (L.n || L.reflip);   // STOP / WALK AWAY
  eglGo(() => { if (ladder) L.over = true; else egl.skipped = true; egl.done = true; }, 'done');
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
  if (eglIsView(st)) P = eglLayView(G);
  else if (L === 'terminal') P = eglLayTerminal(G);
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
// A short stable id for a piece of text, so it types out once and stays typed.
function eglHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
// The tail of a class attribute that makes an element type out (eglTypeScan),
// unless it already has. Use as `class="x${eglTy(key)}>`.
function eglTy(k) {
  const id = eglHash(k);
  return (eglTypeCps() && !egl.seen.has(id) && egl.lay !== 'marquee') ? ` egl-ty" data-ty="${id}"` : '"';
}
// Amber lines: [class, text, rich, live]. A rich line keeps the game's keyword
// colours; a live line (a running count) types once and then changes in place.
function eglLinesHTML(lines, min) {
  const html = lines.map(([cls, t, rich, live], i) => !t ? `<div class="egl-tl ${cls}">&nbsp;</div>`
    : `<div class="egl-tl ${cls}${eglTy(`${egl.lay}|${eglSk()}|${i}|${live ? 'live' : t}`)}>${rich ? eglCol(t) : eglEsc(t)}</div>`).join('');
  return `<div class="egl-fit" data-min="${min}">${html}</div>`;
}
function eglOutcome() { return egl.skipped ? ['Skipped. Nothing changes.'] : egl.ev.result(); }
// The prompt as amber lines: all of it, or the one-line head of a card screen.
function eglPromptLines(head) {
  const ev = egl.ev, st = eglStep();
  const lab = egl.done ? (egl.skipped ? 'SKIPPED' : 'DONE') : eglTxt(st.label);
  const note = egl.done ? '' : (st.note || '');
  if (head) return [['egl-t-n2', `${ev.name.toUpperCase()} // ${lab}`]];
  return [['egl-t-n', ev.name.toUpperCase()], ['egl-t-f', ev.flavor, 1], ...(note ? [['egl-t-x', note, 1]] : []), ['egl-t-l', `> ${lab}`]];
}
// What the screen says about the thing last touched (READOUT, and the heads of
// the card screens).
function eglInspectLines() {
  const st = eglStep(), i = egl.inspect, L = egl.ladder;
  if (!st) return eglOutcome().map(l => ['egl-t-good', l, 1]);
  if (st.t === 'ladder') return L.log.length ? L.log.slice(-3).map(l => [/LOST|TAILS/.test(l) ? 'egl-t-bad' : /HEADS/.test(l) ? 'egl-t-good' : '', l])
                                             : [['egl-t-dim', 'FLIP TO CLIMB A RUNG.']];
  if (st.t === 'shopgrid') {
    const it = st.items[i];
    return [...(it ? [['egl-t-h', `> ${it.card.rank}${it.card.suit} · ${eglCodes(it.card, it.buffs).map(c => c.v + ' ' + c.w).join(' · ')}`, 0, 1]] : []), eglStatusLine()];
  }
  if (st.t === 'deckcols') {
    const cd = st.cards[i], codes = cd ? eglCodes(cd) : [];
    return [...(cd ? [['egl-t-h', `> ${cd.rank}${cd.rank2 ? '/' + cd.rank2 : ''}${cd.suit || ''}${cd.suit2 || ''} · ${codes.length ? codes.map(c => (c.v + ' ' + c.w).trim()).join(' · ') : 'PLAIN'}`, 0, 1]] : []), eglStatusLine()];
  }
  const o = st.opts[i];
  if (!o) return [['egl-t-dim', 'TOUCH A KEY TO READ IT.']];
  return [['egl-t-h', `> [${i + 1}] ${(o.title || o.name).toUpperCase()}${o.rar && st.t === 'entities' ? ' · ' + o.rar.toUpperCase() : ''}`],
          ['', o.text || o.desc, 1], ...(o.cost ? [['egl-t-c', `COST · ${o.cost.toUpperCase()}`]] : [])];
}
// A card screen's running count: what is in the basket, or what will be cut.
function eglStatusLine() {
  const st = eglStep(), p = eglPicks();
  if (st.t === 'shopgrid') return ['egl-t-c', `BASKET ${p.length} · ${p.length * st.price} OF ${coins} CREDITS`, 0, 1];
  return ['egl-t-c', `CUT ${p.length} OF ${eglNeed(st)}: ${p.map(j => st.cards[j].rank + (st.cards[j].suit || '')).join(' ') || '·'}`, 0, 1];
}

// The prompt piece, in each layout's own material.
function eglPromptPiece(R, head) {
  const L = egl.lay, mode = head ? 'head' : 'full';
  if (L === 'marquee') return { key: 'prompt-' + mode, cls: `egl-prompt egl-p-${head ? 'strip' : 'full'}${!head && R.h > 6 ? ' egl-big' : ''}`, html: eglMarqueePromptHTML(head), ...R };
  if (L === 'readout') {
    const lines = head ? [...eglPromptLines(true), ...eglInspectLines()] : [...eglPromptLines(false), ['egl-t-rule', ''], ...eglInspectLines()];
    return { key: 'screen-' + mode, cls: 'egl-screen', html: eglLinesHTML(lines, 9), ...R };
  }
  if (L === 'terminal') {
    const st = eglStep();
    return { key: 'screen-head', cls: 'egl-term', html: eglLinesHTML([['egl-t-h', `EVENT // ${egl.ev.name.toUpperCase()} // ${eglTxt(st.label)}`], ...eglInspectLines()], 8), ...R };
  }
  const note = eglStep()?.note || '';
  if (L === 'wire') {
    const lines = head ? [['egl-t-x', note, 1], ...eglInspectLines()] : eglPromptLines(false).filter(l => l[0] !== 'egl-t-n');
    const leg = head ? `${egl.ev.name.toUpperCase()} // ${eglTxt(eglStep().label)}` : `EVENT · ${egl.ev.name.toUpperCase()}`;
    return { key: 'prompt-' + mode, cls: 'egl-prompt', html: `<div class="egl-wb egl-wb2"><span class="egl-leg${eglTy('leg|' + eglSk() + '|' + leg)}>${eglEsc(leg)}</span>${eglLinesHTML(lines, 9)}</div>`, ...R };
  }
  // WALL: a screen of its own
  const lines = head ? [...eglPromptLines(true), ['egl-t-x', note, 1], ...eglInspectLines()] : eglPromptLines(false);
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
  // WIREFRAME's box is labelled OUTCOME and the prompt already says DONE.
  const body = eglLinesHTML([...(L === 'wire' ? [] : [['egl-t-l', egl.skipped ? '> SKIPPED' : '> DONE']]), ...lines.map(l => ['egl-t-good', l, 1])], 10);
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
      html: term ? `<div class="egl-fit" data-min="7" data-chrome><span class="egl-at">[ ${a.label} ]</span></div>`
                 : `<div class="egl-fit" data-min="5.5" data-chrome><b>${a.label}</b>${a.sub ? `<i>${a.sub}</i>` : ''}</div>` });
    c += sw;
  });
  P.push({ key: 'act-go', cls: 'egl-act egl-go' + small + (go.off ? ' egl-off' : '') + (term ? ' egl-tact' : ''), c: A.c + A.w - gw, r: A.r, w: gw, h,
    tap: go.off ? eglShake : go.on,
    html: term ? `<div class="egl-fit" data-min="7" data-chrome><span class="egl-at">[ ${go.label}${go.sub ? ' · ' + eglEsc(go.sub).toUpperCase() : ''} ]</span></div>`
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
  // WIREFRAME draws the entity large and lets its tooltip carry the words.
  const art = ent && (typeof entityTileHTML === 'function')
    ? entityTileHTML({ entity: o.entity, id: o.id, emoji: o.emoji, label: o.name }, o.rar, { tip: mode === 'box', extraClass: 'egl-obj' }) : '';
  const ico = ent ? `<div class="egl-art">${art}</div>` : `<div class="egl-ico">${(typeof emGlyph === 'function') ? emGlyph(o.icon) : o.icon}</div>`;
  const title = ent ? o.name : o.title, text = ent ? o.desc : o.text, tag = ent ? o.rar : (o.cost || '');
  if (mode === 'menu') return `<div class="egl-fit" data-min="7"><div class="egl-tm-l"><b>[${i + 1}]</b> ${eglEsc(title.toUpperCase())}<u></u><em>${eglEsc(tag.toUpperCase())}</em></div><div class="egl-tm-x">${eglEsc(eglPlain(text))}</div></div>`;
  if (mode === 'keys') return `<i class="egl-led"></i><div class="egl-fit" data-min="7">${ico}<div class="egl-ot">${eglEsc(title)}</div>`
                            + (tag ? `<div class="egl-cost">${eglEsc(tag)}</div>` : '') + `</div>`;
  if (mode === 'box') {
    const ty = f => eglTy(`opt|${eglSk()}|${i}|${f}`);
    const leg = `<span class="egl-leg${ty('l')}>[${i + 1}] ${eglEsc(title.toUpperCase())}</span>`;
    // An entity's box has no label (owner): its border closes, and the name sits
    // just above the picture, three lines at most.
    if (ent) return `<div class="egl-wb egl-wb-ent"><div class="egl-fit" data-min="8"><div class="egl-enw"><div class="egl-en${ty('n')}>${eglEsc(title.toUpperCase())}</div></div>`
                  + `${ico}<div class="egl-rar rar-${o.rar}${ty('r')}>${eglEsc(o.rar.toUpperCase())}</div></div></div>`;
    return `<div class="egl-wb">${leg}<div class="egl-fit" data-min="8">${ico}<div class="egl-ox${ty('x')}>${eglCol(text)}</div>`
         + (tag ? `<div class="egl-cost${ty('c')}>${eglEsc(tag.toUpperCase())}</div>` : '') + `</div></div>`;
  }
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
  let w, h, flat = '';
  if (n === 1) { w = Math.min(R.w, G.wide ? 5 : 4); h = R.h; }
  else if (R.w >= n * 2) { w = Math.floor(R.w / n); h = R.h; }
  else { w = R.w; h = Math.max(1, Math.floor(R.h / n)); flat = ' egl-flat'; }   // stacked: a box is a wide strip
  eglSpread(n, R, w, h).forEach((b, i) => {
    const o = st.opts[i];
    P.push({ key: `${sk}:o${i}`, cls: cls(o, i, (G.wide && mode === 'full' ? 'egl-big' : '') + flat), ...b,
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
// A market card is not owned, so its buffs are written to the stores for one
// render and taken straight back out; the face then wears its real marks.
function eglWithBuffs(card, buffs, fn) {
  const k = cardId(card), S = eglStores(), undo = [];
  (buffs || []).forEach(b => Object.entries(b.e || {}).forEach(([key, v]) => {
    const s = S[key]; if (!s) return;
    undo.push([s, k in s, s[k]]); s[k] = v;
  }));
  try { return fn(); }
  finally { undo.reverse().forEach(([s, had, old]) => { if (had) s[k] = old; else delete s[k]; }); }
}
const eglFaceBuffed = (card, buffs) => eglWithBuffs(card, buffs, () => eglCardFace(card));
// A card's marks on the amber screens (r600, owner): the game's own set, as
// renderCardAppearance draws it, in the palette: the corner bands and x marks
// (cardBandsHTML with palette inks), a curse's badge, Fodder, a coin, the
// scaling arrow and a card state.
const EGL_BAND_INK = { pips: 'var(--wf-sky)', mult: 'var(--wf-coral)', rewind: 'var(--wf-cream)', pause: 'var(--wf-sage)', replay: 'var(--wf-mint)' };
function eglCardMarks(card) {
  const k = cardId(card), curse = cardCurses[k], cd = curse && CURSE_DEFS[curse.id];
  const grow = (permPipsGrow[k] || 0) || (permMultGrow[k] || 0);
  const html = (typeof cardBandsHTML === 'function' ? cardBandsHTML(card, f => EGL_BAND_INK[f.id] || 'var(--wf-amber)') : '')
    + (cd ? `<i class="egl-mk egl-mk-curse">${emGlyph(cd.icon)}<b>${curse.left}</b></i>` : '')
    + ((typeof cardIsFodder === 'function' && cardIsFodder(card)) ? '<i class="egl-mk egl-mk-fodder">♻</i>' : '')
    + (grow ? '<i class="egl-mk egl-mk-grow">↗</i>' : '')
    + ((typeof permCoins !== 'undefined' && permCoins[k]) ? '<i class="egl-mk egl-mk-coin"></i>' : '')
    + ((typeof cardStateBadgeHTML === 'function') ? cardStateBadgeHTML(card) : '');
  return { html, cls: cd ? ' egl-cursed' : '' };
}
// A card's buffs as { v: '+12', w: 'PIPS', k: buff key }: the offer's own
// labels, or what a deck card holds.
function eglCodes(card, buffs) {
  if (buffs) return buffs.map(b => {
    // The value keeps its case: VT323's S is a 5, so +2S reads +25.
    const t = eglPlain(b.label).split(' ');
    return { v: t[0], w: t.slice(1).join(' ').toUpperCase(), k: b.op && b.op.buff ? b.op.buff.key : '' };
  });
  const k = cardId(card), S = eglStores(), v = key => (S[key] && S[key][k]) || 0, out = [];
  if (v('pips')) out.push({ v: `+${v('pips')}`, w: 'PIPS', k: 'pips' });
  if (v('mult')) out.push({ v: `+${v('mult')}`, w: 'MULT', k: 'mult' });
  if (v('xpips') > 1) out.push({ v: `×${v('xpips')}`, w: 'PIPS', k: 'xpips' });
  if (v('xmult') > 1) out.push({ v: `×${v('xmult')}`, w: 'MULT', k: 'xmult' });
  if (v('retrig')) out.push({ v: `+${v('retrig')}`, w: 'REPLAY', k: 'retrig' });
  if (v('time')) out.push({ v: `+${v('time')}s`, w: 'REWIND', k: 'time' });
  if (v('focus')) out.push({ v: `+${v('focus')}`, w: 'FOCUS', k: 'focus' });
  if (v('coin')) out.push({ v: `+${v('coin')}`, w: 'CREDITS', k: 'coin' });
  if (card._vulturePause) out.push({ v: `+${card._vulturePause}s`, w: 'PAUSE', k: 'pause' });
  if ((typeof permPipsGrow !== 'undefined' && permPipsGrow[k]) || (typeof permMultGrow !== 'undefined' && permMultGrow[k])) out.push({ v: 'SCALING', w: '', k: 'grow' });
  if (typeof cardIsFodder === 'function' && cardIsFodder(card)) out.push({ v: 'FODDER', w: '', k: 'fodder' });
  const cu = cardCurses[k], cdef = cu && CURSE_DEFS[cu.id];
  if (cdef) out.push({ v: cdef.name.toUpperCase(), w: `${cu.left} LEFT`, k: 'curse' });
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
    const fh = s.buffs ? ch * 0.7 : ch, fw = Math.min(cw, fh * EGL_CARD_RATIO);
    const lab = s.buffs ? `<div class="egl-fit egl-vlab" data-min="5.5"><div>${eglCol(s.buffs.map(b => b.label).join(' · '))}</div></div>` : '';
    return `<div class="egl-vs${on}${insp}" data-i="${s.i}" style="--card-w:${(fw - 2).toFixed(1)}px;--card-h:${(fh - 2).toFixed(1)}px">`
         + `<div class="egl-vface">${s.buffs ? eglFaceBuffed(s.card, s.buffs) : eglCardFace(s.card)}</div>${lab}<i class="egl-x">CUT</i></div>`;
  }
  // A deck card wears its marks only (the head line says what they are); a market
  // card prints its offer as well.
  const c = s.card, wild = c.rank === (typeof WILD_RANK !== 'undefined' ? WILD_RANK : '✶');
  const codes = s.buffs ? eglCodes(c, s.buffs) : [], mk = eglWithBuffs(c, s.buffs, () => eglCardMarks(c));
  const suit2 = c.suit2 ? `<span class="egl-s2 egl-s-${eglSuitCls(c.suit2)}">${c.suit2}</span>` : '';
  return `<div class="egl-vs egl-tc egl-tc-${style} egl-s-${wild ? 'wild' : eglSuitCls(c.suit)}${on}${insp}${codes.length ? ' egl-tcb' : ''}${mk.cls}" data-i="${s.i}">`
       + `<span class="egl-cid"><span class="egl-cr">${eglEsc(c.rank)}${c.rank2 ? `<small>${eglEsc(c.rank2)}</small>` : ''}</span><span class="egl-cs">${c.suit || ''}${suit2}</span></span>`
       + (codes.length ? `<span class="egl-cb">${codes.map(x => `<em class="egl-k-${x.k}"><strong>${eglEsc(x.v)}</strong><small>${eglEsc(x.w)}</small></em>`).join('')}</span>` : '')
       + mk.html + `<u>CUT</u></div>`;
}
function eglViewPiece(R, G) {
  const st = eglStep(), b = G.box(R.c, R.r, R.w, R.h), style = eglCardStyle(), cut = st.t === 'deckcols';
  let cols, rows, slots;
  if (cut) {
    const D = eglDeckCols(st.cards);
    cols = D.cols; rows = D.rows.length;
    slots = D.rows.flat().map(i => i < 0 ? null : { i, card: st.cards[i] });
  } else {
    cols = 4; rows = Math.ceil(st.items.length / cols);
    slots = st.items.map((it, i) => ({ i, card: it.card, buffs: it.buffs }));
  }
  // Slots line up with the board's own cells; a card is a playing card's shape
  // inside one, as tall as the slot.
  const vis = Math.min(EGL_VIEW_ROWS, rows), gap = EGL_GAP;
  const sw = (b.w - (cols - 1) * gap) / cols, sh = (b.h - (vis - 1) * gap) / vis, cw = Math.min(sw, sh * EGL_CARD_RATIO);
  if (!egl.measuring) egl.view = { rows, vis };
  const sel = eglPicks();
  const html = `<div class="egl-vw" style="--vc:${cols};--vh:${sh.toFixed(2)}px;--vg:${gap}px;--cw:${cw.toFixed(2)}px">`
             + slots.map(s => eglSlotHTML(s, style, sw, sh, sel, cut)).join('') + `</div>`;
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
// A card screen, laid out as a 6 x 6 board (owner): the words across the top
// row and a half, the cards in the middle columns as that board's cards, the
// keys in the last half row. Columns the cards do not need stay empty.
function eglLayView(G) {
  const st = eglStep(), cols = st.t === 'deckcols' ? eglDeckCols(st.cards).cols : 4;
  const span = Math.min(G.cols, cols), c0 = Math.floor((G.cols - span) / 2);
  return [eglPromptPiece({ c: 0, r: 0, w: G.cols, h: 3 }, true), eglViewPiece({ c: c0, r: 3, w: span, h: G.rows - 4 }, G),
          ...eglActions({ c: 0, r: G.rows - 1, w: G.cols, h: 1 })];
}
function eglTermLines() {
  const ev = egl.ev, st = eglStep(), L = egl.ladder, out = [];
  out.push(['egl-t-h', `EVENT // ${ev.name.toUpperCase()}`], ['', ev.flavor, 1], ['', '']);
  if (egl.done) { out.push(['egl-t-h', egl.skipped ? '> SKIPPED' : '> DONE']); eglOutcome().forEach(l => out.push(['', l, 1])); out.push(['egl-t-dim', ''], ['egl-t-dim', 'PRESS DONE TO RETURN TO THE BOARD']); return out; }
  if (st.note) out.push(['', st.note, 1], ['', '']);
  if (st.t === 'ladder') L.log.forEach(l => out.push([/LOST|TAILS/.test(l) ? 'egl-t-bad' : /HEADS/.test(l) ? 'egl-t-good' : '', l]));
  out.push(['egl-t-h', `> ${eglTxt(st.label)}`]);
  return out;
}
function eglLayTerminal(G) {
  const st = eglStep(), P = [];
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
  if (typeof fitEntityNames === 'function') try { fitEntityNames(egl.board, '.egl-art .rwd-name:not([data-fit-src])'); } catch (e) {}
  eglMountCoin();
  eglMountView();
  eglTypeScan();
  eglCursorPlace();
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
  // FLIP: the dead fold away edge-on; a layout change folds them in a wave.
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

// ── TYPING ──────────────────────────────────────────────────────────────────
// New words type out a character at a time (Settings -> Text speed), in the
// order they sit on the board. Each element is laid out whole with the part
// not typed yet hidden (.egl-tu), so nothing reflows and the fit stays true.
// A tap on the board while it types shows everything at once.
const eglTyping = () => !!(egl && egl.ty && egl.ty.q.length);
function eglTypeScan() {
  const T = egl.ty || (egl.ty = { q: [], raf: 0, budget: 0, last: 0, at: null });
  egl.board.querySelectorAll('.egl-ty').forEach(el => {
    if (el._tyQ || el.closest('.egl-dying')) return;
    el._tyQ = true;
    const texts = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) texts.push(w.currentNode);
    const nodes = texts.map(t => {
      const a = document.createElement('span'), b = document.createElement('span');
      b.className = 'egl-tu'; b.textContent = t.data;
      t.parentNode.insertBefore(a, t); t.parentNode.replaceChild(b, t);
      return { a, b, full: b.textContent, k: 0 };
    });
    T.q.push({ el, key: el.dataset.ty, nodes });
  });
  if (!eglTypeCps()) { eglTypeAll(); return; }
  if (!egl.holdType && !T.raf && T.q.length) { T.last = performance.now(); T.raf = requestAnimationFrame(eglTypeTick); }
}
function eglTypeTick(now) {
  const T = egl && egl.ty; if (!T) return;
  T.raf = 0;
  if (egl.holdType) return;
  T.budget = Math.min(T.budget + (now - T.last) * eglTypeCps() / 1000, 60); T.last = now;
  while (T.budget >= 1 && T.q.length) {
    const it = T.q[0];
    if (!it.el.isConnected) { egl.seen.add(it.key); T.q.shift(); continue; }
    const nd = it.nodes.find(x => x.k < x.full.length);
    if (!nd) { eglTypeDone(it); T.q.shift(); continue; }
    nd.k++; nd.a.textContent = nd.full.slice(0, nd.k); nd.b.textContent = nd.full.slice(nd.k);
    T.at = nd;
    if (nd.full[nd.k - 1] !== ' ') T.budget--;   // spaces cost nothing
  }
  if (!T.q.length) T.at = null;
  eglCursorPlace();
  if (T.q.length) T.raf = requestAnimationFrame(eglTypeTick);
}
function eglTypeDone(it) {
  it.nodes.forEach(x => { x.a.textContent = x.full; x.b.remove(); });
  it.el.classList.remove('egl-ty');
  egl.seen.add(it.key);
}
function eglTypeAll() {
  const T = egl && egl.ty; if (!T) return;
  T.q.forEach(it => { if (it.el.isConnected) eglTypeDone(it); else egl.seen.add(it.key); });
  T.q = []; T.at = null; T.budget = 0;
  eglCursorPlace();
}

// ── THE CURSOR ──────────────────────────────────────────────────────────────
// One cursor on the board (owner): with the text while it types, then resting
// at the end of the box that has the focus: the prompt until a choice is made,
// then the chosen box (CONFIRM on a card screen), the outcome once done.
function eglCursor() {
  let c = document.getElementById('egl-cur');
  if (!c) { c = document.createElement('i'); c.id = 'egl-cur'; }
  return c;
}
function eglCursorHome() {
  const B = egl.board, st = eglStep(), q = s => B.querySelector(s + ':not(.egl-dying)');
  const prompt = () => q('.egl-prompt') || q('.egl-screen') || q('.egl-term');
  if (egl.done) return q('.egl-result') || prompt();
  if (st && eglPicks().length) return (eglIsView(st) || st.t === 'ladder') ? q('.egl-go') : (q('.egl-opt.egl-sel') || q('.egl-go'));
  return prompt();
}
function eglCursorPlace() {
  if (!egl) return;
  const c = eglCursor(), T = egl.ty;
  if (egl.lay === 'marquee') { c.remove(); return; }
  if (T && T.at && T.q.length && T.at.a.isConnected) { c.classList.add('typing'); if (c.previousSibling !== T.at.a) T.at.a.after(c); return; }
  c.classList.remove('typing');
  const box = eglCursorHome();
  const spot = box && [...box.querySelectorAll('.egl-tl:not(.egl-t-rule), .egl-ox, .egl-cost, .egl-rar, .egl-at, .egl-tm-x')].pop();
  if (!spot) { c.remove(); return; }
  if (spot.lastChild !== c) spot.appendChild(c);
}

// ── TRANSITIONS ─────────────────────────────────────────────────────────────
// Owner: old-school changes between screens. CONSOLE types a command at the
// foot of the screen, its output scrolls the old screen up and away, and the
// new one scrolls in after it. CUBE turns the board like a cube. FLIP is r588's
// cells turning over. Both new ones run between two copies (eglSnap): the
// screen being left, and the new one with its words not yet typed, which type
// out once it lands (holdType). Reduced motion takes FLIP.
function eglTrKind() {
  const reduced = (typeof SETTINGS !== 'undefined' && SETTINGS && SETTINGS.reducedMotion);
  return reduced ? 'flip' : (EGL_TRANS[eglPrefs.tr] ? eglPrefs.tr : 'console');
}
// A copy of the board as it stands (or of the game's own board, `fromGrid`).
function eglSnap(fromGrid) {
  const face = document.createElement('div');
  face.className = 'egl-face';
  face.style.background = getComputedStyle(egl.layer).background;
  if (fromGrid) {
    const g = document.getElementById('grid'), cs = getComputedStyle(g), cl = g.cloneNode(true), r = eglDesignRect(g);
    cl.removeAttribute('id');
    cl.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    ['background', 'padding', 'border', 'borderRadius', 'boxShadow', 'boxSizing', 'width', 'height'].forEach(p => { cl.style[p] = cs[p]; });
    Object.assign(cl.style, { position: 'absolute', left: (r.x - egl.rect.x) + 'px', top: (r.y - egl.rect.y) + 'px', visibility: 'visible', margin: '0' });
    face.appendChild(cl);
  } else {
    egl.board.querySelectorAll(':scope > .egl-cell:not(.egl-dying)').forEach(c => face.appendChild(c.cloneNode(true)));
    face.querySelectorAll('#egl-cur').forEach(e => e.remove());
  }
  return face;
}
// Moves the lab to its next state through the chosen transition. A change of
// room (slide-off) has nothing to turn between, so it moves the r588 way.
function eglGo(mutate, kind) {
  if (!egl || egl.busy) return;
  try { if (typeof hideEntityTooltip === 'function') hideEntityTooltip(true); } catch (e) {}
  eglTypeAll();
  const tr = eglTrKind(), from = tr === 'flip' ? null : eglSnap();
  mutate();
  if (tr === 'flip' || eglRoomNow() !== egl.room) { eglDraw({ turn: kind === 'switch' }); return; }
  egl.busy = true; egl.holdType = true;
  eglDraw({ instant: true });
  const to = eglSnap();
  egl.board.style.visibility = 'hidden';
  eglTransit(tr, from, to, kind).then(eglReveal);
}
function eglReveal() {
  if (!egl) return;
  egl.board.style.visibility = '';
  egl.busy = false; egl.holdType = false;
  eglTypeScan(); eglCursorPlace(); eglScrollPaint();
}
function eglTrHost(cls) { const h = document.createElement('div'); h.className = 'egl-tr ' + cls; egl.layer.appendChild(h); return h; }
function eglTransit(tr, from, to, kind) {
  return tr === 'cube' ? eglCube(from, to, kind === 'close' ? -1 : 1) : eglConsole(from, to, eglScript(kind));
}
function eglCube(from, to, dir) {
  const host = eglTrHost('egl-tr-cube'), w = egl.rect.w, ms = 720;
  host.style.perspective = Math.round(w * 2.6) + 'px';
  host.append(from, to);
  [from, to].forEach(f => { f.style.transformOrigin = `50% 50% ${-w / 2}px`; });
  const opt = { duration: ms, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' };
  from.animate([{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${-90 * dir}deg)`, filter: 'brightness(.25)' }], opt);
  const a = to.animate([{ transform: `rotateY(${90 * dir}deg)`, filter: 'brightness(.25)' }, { transform: 'rotateY(0deg)', filter: 'brightness(1)' }], opt);
  if (typeof sfxScreenTurn === 'function') try { sfxScreenTurn(); } catch (e) {}
  return a.finished.then(() => host.remove(), () => host.remove());
}
// The command and its output for a CONSOLE change, from what is changing.
function eglScript(kind) {
  const ev = egl.ev, st = eglStep(), pad = (a, b) => `${a} `.padEnd(24, '.') + ` ${b}`;
  if (kind === 'open') return { cmd: `run ${ev.id}`, lines: [[pad('loading event', 'ok')], [pad('pausing clock', 'ok')], [pad('reading run', `${everyDeckCard().length} cards`)], [pad('drawing screen', 'ok')]] };
  if (kind === 'close') return { cmd: 'exit', lines: [[pad('applying', 'ok')], [pad('dealing board', `${gridRows * gridCols} cards`)], [pad('resuming clock', 'ok')]] };
  if (kind === 'switch') return { cmd: `run ${ev.id} --layout ${EGL_LAYOUTS[egl.lay].name.toLowerCase()}`, lines: [[pad('loading event', 'ok')], [pad('drawing screen', 'ok')]] };
  if (kind === 'done') return { cmd: `${ev.id} --confirm`, lines: [[pad('checking choice', 'ok')], ...eglOutcome().map(l => ['  ' + eglPlain(l), 'egl-con-good']), [pad('writing run', 'ok')]] };
  const prev = ev.steps[egl.step - 1], pick = prev && prev.opts ? prev.opts[(egl.picks[egl.step - 1] || [])[0]] : null;
  const lines = [[pad('reading choice', pick ? (pick.title || pick.name).toLowerCase() : 'ok')]];
  if (st && st.t === 'deckcols') lines.push([pad('reading deck', `${st.cards.length} cards`)], [pad('sorting by suit', 'ok')], [pad('ranking', 'a to 2')]);
  if (st && st.opts) lines.push([pad('dealing options', st.opts.length)]);
  lines.push([pad('drawing screen', 'ok')]);
  return { cmd: `${ev.id} --step ${egl.step + 1}`, lines };
}
function eglConsole(from, to, script) {
  const host = eglTrHost('egl-tr-con'), H = egl.rect.h, lh = EGL_CON_LH;
  host.style.background = getComputedStyle(egl.layer).background;
  const col = document.createElement('div'), out = document.createElement('div');
  col.className = 'egl-con-col'; out.className = 'egl-con-out';
  [from, to].forEach(f => { f.style.position = 'relative'; f.style.inset = 'auto'; f.style.height = H + 'px'; });
  col.append(from, out, to); host.appendChild(col);
  let y = 0;
  const put = () => { col.style.transform = `translateY(${-y}px)`; };
  const add = (t, cls) => { const d = document.createElement('div'); d.className = 'egl-con-l ' + (cls || ''); d.textContent = t; out.appendChild(d); y += lh; put(); return d; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const cps = eglTypeCps() * 1.5;
  return (async () => {
    const cmd = add('', 'egl-con-cmd'), full = '> ' + script.cmd;
    if (cps) for (let k = 1; k <= full.length; k++) { cmd.textContent = full.slice(0, k); await wait(1000 / cps); if (!egl) return; }
    else cmd.textContent = full;
    if (typeof sfxKeyClick === 'function') try { sfxKeyClick('down'); } catch (e) {}
    await wait(140);
    for (const l of script.lines) { add(l[0], l[1]); await wait(40); if (!egl) return; }
    // The new screen comes up from below, a line or two at a time, the way a
    // terminal fills.
    const end = H + script.lines.length * lh + lh;
    while (y < end) { y = Math.min(end, y + lh * 2); put(); await wait(16); if (!egl) return; }
    host.remove();
  })();
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
        if (!egl || egl.busy || !eglScrollBy(d)) return;
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
// FLIP: the board's own cards turn edge-on and the event's cells turn in behind
// them. CONSOLE / CUBE: the game's board is copied and the transition runs from
// that copy to the event (and back on the way out). The turned-away cards hold
// edge-on (fill forwards) until the board is hidden, then hand their rotate back.
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
  EGL_PALETTE.forEach(([n, c]) => layer.style.setProperty('--wf-' + n, c));
  document.getElementById('stage').appendChild(layer);
  egl = { layer, board: layer.firstChild, measure: layer.lastChild, samples: eglSamples(), room: 'box', rect: null, slid: false, seen: new Set() };
  eglPrefs.ev = Math.min(eglPrefs.ev, egl.samples.length - 1);
  if (!EGL_LAYOUTS[eglPrefs.lay]) eglPrefs.lay = 'wire';
  if (!EGL_ROOMS[eglPrefs.room]) eglPrefs.room = 'box';
  egl.lay = eglPrefs.lay;
  layer.dataset.lay = egl.lay;
  // A tap while text types shows it all, and is spent doing so.
  layer.addEventListener('pointerdown', () => { if (eglTyping() && !egl.busy) { eglTypeAll(); egl.eatClick = true; } }, true);
  layer.addEventListener('click', e => { if (egl && egl.eatClick) { egl.eatClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  eglPanelBuild();
  layer.style.visibility = 'hidden';
  eglSetRect(eglBoxRect(), false);
  eglEnter();
  egl.onResize = () => { clearTimeout(egl.resT); egl.resT = setTimeout(eglResize, 200); };
  addEventListener('resize', egl.onResize);
}
// The event takes the board over, from the game's own board.
function eglEnter() {
  eglReset();
  const tr = eglTrKind();
  if (tr === 'flip' || eglRoomNow() !== 'box') {
    eglTurnBoard(true).then(() => { if (!egl) return; eglBoardHidden(); eglDraw({ turn: true }); });
    return;
  }
  const from = eglSnap(true);
  egl.busy = true; egl.holdType = true;
  egl.layer.style.visibility = '';
  document.body.classList.add('egl-on');
  eglDraw({ instant: true });
  const to = eglSnap();
  egl.board.style.visibility = 'hidden';
  eglTransit(tr, from, to, 'open').then(eglReveal);
}
// DONE: the event hands the board back, which is what the real thing does once
// it has paid; the lab then opens the same event again.
function eglClose(again) {
  if (!egl || egl.closing || egl.busy) return;
  egl.closing = true;
  eglTypeAll();
  try { if (typeof hideEntityTooltip === 'function') hideEntityTooltip(true); } catch (e) {}
  eglScrollPaint();
  const tr = eglTrKind(), room = egl.room;
  const reopen = () => setTimeout(() => { if (!egl) return; egl.closing = false; eglEnter(); }, 900);
  if (tr !== 'flip' && room === 'box') {
    const from = eglSnap(), to = eglSnap(true);
    egl.busy = true;
    egl.board.style.visibility = 'hidden';
    eglTransit(tr, from, to, 'close').then(() => {
      if (!egl) return;
      egl.busy = false;
      egl.board.innerHTML = ''; egl.board.style.visibility = '';
      document.body.classList.remove('egl-on');
      egl.layer.style.visibility = 'hidden';
      if (again) reopen(); else eglTeardown();
    });
    return;
  }
  [...egl.board.children].forEach(el => el.animate([{ transform: 'perspective(520px) rotateY(0deg)' }, { transform: 'perspective(520px) rotateY(90deg)' }],
    { duration: 190, delay: +el.dataset.d || 0, easing: 'ease-in', fill: 'forwards' }));
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
      eglTurnBoard(false).then(() => { if (!egl) return; if (again) reopen(); else eglTeardown(); });
    }, room !== 'box' ? EGL_MS + 60 : 0);
  }, 420);
}
function eglResize() {
  if (!egl || egl.closing || egl.busy) return;
  (egl.slideEls || []).forEach(({ el }) => { el.style.transition = 'none'; el.style.translate = ''; });
  egl.slid = false; egl.slideEls = null; egl.room = 'box';
  void document.body.offsetWidth;
  eglDraw({ instant: true });
}
function eglTeardown() {
  if (!egl) return;
  removeEventListener('resize', egl.onResize);
  eglSetSlide(false);
  if (egl.ty && egl.ty.raf) cancelAnimationFrame(egl.ty.raf);
  egl.layer.remove(); egl.panel?.remove(); document.getElementById('egl-scroll')?.remove();
  document.body.classList.remove('egl-on');
  egl = null;
}

// ── THE PANEL ───────────────────────────────────────────────────────────────
function eglPanelBuild() {
  const p = document.createElement('div');
  p.id = 'egl-panel';
  const row = (attr, map) => Object.entries(map).map(([k, v]) => `<button data-${attr}="${k}">${typeof v === 'string' ? v : v.name}</button>`).join('');
  const speeds = { normal: 'NORMAL', fast: 'FAST', instant: 'INSTANT' };
  p.innerHTML = `
    <div class="eglp-head"><b>EVENT LAYOUTS</b><span class="eglp-n"></span><button class="eglp-side" title="Other side">⇄</button><button class="eglp-min" title="Fold">–</button><button class="eglp-x" title="Close">×</button></div>
    <div class="eglp-body">
      <div class="eglp-row"><button class="eglp-prev">‹</button><div class="eglp-ev"><div class="eglp-name"></div><div class="eglp-shape"></div></div><button class="eglp-next">›</button></div>
      <div class="eglp-lab">LAYOUT</div>
      <div class="eglp-row eglp-wrap">${row('lay', EGL_LAYOUTS)}</div>
      <div class="eglp-note"></div>
      <div class="eglp-lab">TRANSITION</div>
      <div class="eglp-row">${row('tr', EGL_TRANS)}</div>
      <div class="eglp-lab">TEXT SPEED <i>(also in Settings)</i></div>
      <div class="eglp-row">${row('spd', speeds)}</div>
      <div class="eglp-lab">ROOM</div>
      <div class="eglp-row">${row('room', EGL_ROOMS)}</div>
      <label class="eglp-need"><input type="checkbox"> only when the text won't fit</label>
      <div class="eglp-lab">PALETTE</div>
      <div class="eglp-pal">${EGL_PALETTE.map(([n, c, use]) => `<i style="background:${c}" title="${n} ${c}: ${use}"></i>`).join('')}</div>
      <div class="eglp-metric"></div>
      <div class="eglp-row"><button class="eglp-replay">REPLAY</button></div>
    </div>`;
  document.body.appendChild(p);
  egl.panel = p;
  const ev = d => { eglPrefs.ev = (eglPrefs.ev + d + egl.samples.length) % egl.samples.length; eglSavePrefs(); eglStart(); };
  p.querySelector('.eglp-prev').onclick = () => ev(-1);
  p.querySelector('.eglp-next').onclick = () => ev(1);
  p.querySelectorAll('[data-lay]').forEach(b => b.onclick = () => { if (egl.busy) return; eglPrefs.lay = b.dataset.lay; eglSavePrefs(); eglGo(() => { egl.lay = eglPrefs.lay; eglReset(); }, 'switch'); });
  p.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { eglPrefs.tr = b.dataset.tr; eglSavePrefs(); eglPanelPaint(); });
  p.querySelectorAll('[data-spd]').forEach(b => b.onclick = () => {
    if (typeof setSetting === 'function') setSetting('textSpeed', b.dataset.spd); else if (typeof SETTINGS !== 'undefined') SETTINGS.textSpeed = b.dataset.spd;
    eglPanelPaint();
  });
  p.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { if (b.disabled || egl.busy) return; eglPrefs.room = b.dataset.room; eglSavePrefs(); eglDraw(); });
  p.querySelector('.eglp-need input').onchange = e => { eglPrefs.need = e.target.checked; eglSavePrefs(); eglDraw(); };
  p.querySelector('.eglp-replay').onclick = () => eglStart();
  p.querySelector('.eglp-min').onclick = () => p.classList.toggle('folded');
  p.classList.toggle('eglp-right', !!eglPrefs.right);
  p.querySelector('.eglp-side').onclick = () => { eglPrefs.right = !eglPrefs.right; eglSavePrefs(); p.classList.toggle('eglp-right', eglPrefs.right); };
  p.querySelector('.eglp-x').onclick = () => eglClose(false);
  p.addEventListener('keydown', e => e.stopPropagation());
  if (innerWidth < 700) p.classList.add('folded');
}
function eglPanelPaint() {
  const p = egl && egl.panel; if (!p || !egl.ev) return;
  const ev = egl.ev, M = egl.metric || {};
  p.querySelector('.eglp-n').textContent = `${eglPrefs.ev + 1} / ${egl.samples.length}`;
  p.querySelector('.eglp-name').textContent = ev.name;
  p.querySelector('.eglp-shape').textContent = ev.shape;
  p.querySelectorAll('[data-lay]').forEach(b => b.classList.toggle('on', b.dataset.lay === egl.lay));
  p.querySelectorAll('[data-tr]').forEach(b => b.classList.toggle('on', b.dataset.tr === eglPrefs.tr));
  const spd = (typeof SETTINGS !== 'undefined' && SETTINGS && SETTINGS.textSpeed) || 'normal';
  p.querySelectorAll('[data-spd]').forEach(b => b.classList.toggle('on', b.dataset.spd === spd));
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
