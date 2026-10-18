// ═══════════════════════════════════════════════════════════════════════════
// EVENT GRID LAB (r588) - what events could look like if they lived on the board
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "I'd like for all events to exist only in the grid ... I'd like to see
// some options for the different types of events." A LOOK preview: nothing here
// is granted and no real event handler runs. Open index.html?evgrid (or dev ->
// Events & Bosses -> Event layouts). It starts a Classic run, pauses it, and
// draws one of six sample events (one per event shape) over the board in one of
// four layouts, in one of three rooms:
//   box    the board's own outline; nothing else moves
//   zoom   the camera pushes in until the board fills the screen's height, and
//          the board widens to everything still in view
//   slide  the side panels slide off the edges and the board takes the stage
// "Only when it won't fit" stays in the box until a step's text would shrink
// past EGL_NEED_FIT (or its cards need a second page), then takes the chosen
// room for that step alone.
//
// The samples use the real events' words, card faces and entity tiles, so the
// squeeze shown is the squeeze the game would have. The layer is #egl, a child
// of #stage placed in design px; its cells are absolutely placed in cell units
// like the pick of three, and every redraw is KEYED, so a cell that survives a
// change moves to its new box (FLIP) and only new cells turn over.
// Text that would overflow its cell is shrunk (--fit), measured first on a
// hidden copy of the board at the target size, and the panel prints the
// smallest text as drawn on screen.

const EGL_KEY = 'lethe.eventGridLab.v1';
const EGL_ROWS = 6;          // cell rows on every layout but the terminal
const EGL_TERM_ROWS = 12;    // the terminal's rows are text lines, half a cell
const EGL_CELL = 55;         // target cell width, design px: sets the column count
const EGL_PAD = 6, EGL_GAP = 5;
const EGL_NEED_FIT = 0.85;   // "only when it won't fit" goes wide below this
const EGL_MS = 560;          // a room change or a cell's move
const EGL_EASE = 'cubic-bezier(.62,0,.24,1)';
const EGL_REFLIP = 20;       // Hot Streak's second chance, as the event prices it
const EGL_LAYOUTS = {
  marquee:  { name: 'MARQUEE',  note: 'One big prompt cell on top, the options as cells under it. With room, the prompt becomes a column on the left.' },
  pages:    { name: 'PAGES',    note: 'A screen per step: the prompt gets the whole board, then each step, then the outcome. The cells turn over between screens.' },
  focus:    { name: 'FOCUS',    note: 'A one-line title and small option cells. Tap one and it opens across the board with its full text.' },
  terminal: { name: 'TERMINAL', note: 'The board is one screen and the event prints onto it. Options are numbered lines.' },
};
const EGL_ROOMS = { box: 'IN THE BOX', zoom: 'ZOOM IN', slide: 'SLIDE OFF' };

let egl = null;              // the open lab, or null
const eglPrefs = { ev: 0, lay: 'marquee', room: 'box', need: false };
try { Object.assign(eglPrefs, JSON.parse(localStorage.getItem(EGL_KEY) || '{}') || {}); } catch (e) {}
function eglSavePrefs() { try { localStorage.setItem(EGL_KEY, JSON.stringify(eglPrefs)); } catch (e) {} }
const eglTxt = v => (typeof v === 'function' ? v() : v) || '';
const eglEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const eglPlain = s => String(s || '').replace(/<[^>]*>/g, '');
const eglCol = s => (typeof colorizeKeywords === 'function') ? colorizeKeywords(s || '') : (s || '');
const eglRand = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());

// ── THE SAMPLES ─────────────────────────────────────────────────────────────
// One per shape an event takes. Built when the lab opens, from the live run.
function eglSamples() {
  const W = typeof WILD_RANK !== 'undefined' ? WILD_RANK : '✶';
  const nW = (typeof deckWildCount === 'function') ? deckWildCount() : 4;
  const tiers = BAL.deck_trim.tiers.map(t => ({ ...t, price: priceOf(t.price) }));
  const tier = () => tiers[(egl.picks[0] || [])[0]] || tiers[0];
  const order = { '♠': 0, '♥': 1, '♣': 2, '♦': 3 };
  const rv = r => ({ J: 11, Q: 12, K: 13, A: 14 }[r] || +r || 0);
  const deck = ((typeof springCuttableCards === 'function') ? springCuttableCards() : drawPile).filter(c => c && c.rank)
    .slice().sort((a, b) => (order[a.suit] ?? 9) - (order[b.suit] ?? 9) || rv(a.rank) - rv(b.rank));
  const tricks = ['common', 'rare', 'epic'].map(r => TRICK_POOL.filter(t => t.tier === r && !t.retired && t.desc)
    .sort((a, b) => Math.abs(a.desc.length - 80) - Math.abs(b.desc.length - 80))[0]).filter(Boolean);
  const pct = Math.round(((typeof OVERTIME_LEN_MULT !== 'undefined') ? OVERTIME_LEN_MULT - 1 : 0.3) * 100);
  const costs = (typeof OVERTIME_COSTS !== 'undefined') ? evShuffle(OVERTIME_COSTS.slice()).slice(0, 3) : [];
  const price = marketCardPrice();
  const offers = Array.from({ length: MARKET_OFFERS }, marketRollCard);
  const cardName = c => `${c.rank}${c.suit}`;
  const meta = id => EVENT_META[id] || { name: id, flavor: '' };
  return [
    { id: 'wild_cards', shape: 'two options', ...meta('wild_cards'),
      steps: [{ t: 'choice', label: 'CHOOSE ONE', note: `Your deck holds <b>${nW}</b> wilds.`, opts: [
        { icon: W, title: 'Wilds run free', text: 'For the rest of the run, wilds also complete runs and flushes.', rar: 'rare' },
        { icon: W + W, title: 'Double the wilds', text: `${nW} more wilds go into your deck (${nW} → ${nW * 2}).`, rar: 'rare' }] }],
      result: () => (egl.picks[0] || [])[0] === 1 ? [`+${nW} wilds go into your deck.`] : ['Wilds now complete runs and flushes.'] },
    { id: 'deck_trim', shape: 'three rungs, then cards', ...meta('deck_trim'),
      steps: [
        { t: 'choice', label: 'HOW DEEP', note: 'Every card you cut is gone for the rest of the run. The fewer cards in the deck, the more often the ones you kept come round.',
          opts: tiers.map(t => ({ icon: '✂️', title: `Cut ${t.cards} card${t.cards > 1 ? 's' : ''}`,
            text: t.price === 0 ? 'Free. Pick one card and it leaves the run.' : `Pick ${t.cards} cards and they leave the run.`,
            cost: t.price === 0 ? 'No charge' : `${t.price} credits`, rar: t.cards >= 4 ? 'epic' : t.cards >= 2 ? 'rare' : 'common' })) },
        { t: 'cards', label: () => `PICK ${tier().cards} CARD${tier().cards > 1 ? 'S' : ''} TO CUT`, note: 'Your draw pile.', cards: deck, pick: () => tier().cards }],
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
      steps: [{ t: 'shop', label: `${price} CREDITS EACH`, note: `In a round, double-tap the Lockbox to place one; a placed card joins your deck.`, items: offers, price }],
      result: () => { const n = (egl.picks[0] || []).length;
        return n ? [`${n} card${n > 1 ? 's go' : ' goes'} into your Lockbox.`, `-${n * price} credits.`] : ['You left without buying.']; } },
  ];
}

// ── STATE ───────────────────────────────────────────────────────────────────
function eglStep()  { return egl.done || egl.step < 0 ? null : egl.ev.steps[egl.step]; }
function eglPicks() { return egl.picks[egl.step] || (egl.picks[egl.step] = []); }
function eglNeed(st) { return !st ? 0 : st.t === 'cards' ? eglTxt(st.pick) : (st.t === 'shop' || st.t === 'ladder') ? 0 : 1; }
function eglReady() { const st = eglStep(); return !st || eglPicks().length >= eglNeed(st); }
function eglStart(deal = true) {
  egl.ev = egl.samples[eglPrefs.ev];
  egl.step = eglPrefs.lay === 'pages' ? -1 : 0;
  egl.picks = []; egl.done = false; egl.skipped = false; egl.focus = null; egl.page = 0;
  egl.ladder = { n: 0, busy: false, over: false, lost: false, reflip: false, used: false, cap: null, log: [] };
  egl.seen = new Set();
  if (deal) egl.board.querySelectorAll(':scope > .egl-cell').forEach(el => el.remove());
  eglDraw({ turn: !deal });
}
function eglTap(i) {
  const st = eglStep(); if (!st || egl.ladder.busy) return;
  const p = eglPicks(), at = p.indexOf(i);
  if (st.t === 'shop') {
    if (at >= 0) p.splice(at, 1);
    else if ((p.length + 1) * st.price <= coins) p.push(i);
    else { eglShake(); return; }
  } else if (st.t === 'cards') {
    if (at >= 0) p.splice(at, 1);
    else { p.push(i); if (p.length > eglNeed(st)) p.shift(); }
  } else {
    egl.picks[egl.step] = [i];
    if (egl.lay === 'focus') egl.focus = i;
  }
  eglDraw();
}
function eglNext() {
  if (egl.done) { eglClose(true); return; }
  if (egl.step < 0) { egl.step = 0; eglDraw({ turn: true }); return; }
  const st = eglStep();
  if (st.t === 'ladder') { const L = egl.ladder; if (L.over) { egl.done = true; eglDraw({ turn: egl.lay === 'pages' }); } else eglFlip(L.reflip); return; }
  if (!eglReady()) { eglShake(); return; }
  egl.focus = null; egl.page = 0;
  if (egl.step < egl.ev.steps.length - 1) egl.step++; else egl.done = true;
  eglDraw({ turn: egl.lay === 'pages' });
}
function eglSkip() {
  const L = egl.ladder;
  if (eglStep()?.t === 'ladder' && (L.n || L.reflip)) { L.over = true; egl.done = true; }   // STOP / WALK AWAY
  else { egl.done = true; egl.skipped = true; }
  egl.focus = null;
  eglDraw({ turn: egl.lay === 'pages' });
}
function eglBack() { egl.focus = null; eglDraw(); }
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
function eglGeom(rect, rows) {
  const cols = Math.max(4, Math.min(12, Math.round(rect.w / EGL_CELL)));
  const cw = (rect.w - 2 * EGL_PAD - (cols - 1) * EGL_GAP) / cols;
  const ch = (rect.h - 2 * EGL_PAD - (rows - 1) * EGL_GAP) / rows;
  return { rect, cols, rows, cw, ch, wide: cols >= 9,
    box: (c, r, w, h) => ({ l: EGL_PAD + c * (cw + EGL_GAP), t: EGL_PAD + r * (ch + EGL_GAP),
                            w: w * cw + (w - 1) * EGL_GAP, h: h * ch + (h - 1) * EGL_GAP }) };
}
const eglRows = () => egl.lay === 'terminal' ? EGL_TERM_ROWS : EGL_ROWS;
function eglLandscape() { return !!document.getElementById('stage')?.classList.contains('landscape'); }
// The stage's zoom and viewport origin with the camera at rest (it carries no
// transform at play; the zoom room is the only thing here that gives it one).
// Read once with the camera at rest (open, and after a resize puts it back), so
// a redraw mid-dolly never reads a half-moved stage.
function eglRebase() {
  const st = document.getElementById('stage'), r = st.getBoundingClientRect();
  egl.base = { z: r.width / st.offsetWidth, sw: st.offsetWidth, sh: st.offsetHeight, sx: r.left, sy: r.top };
}
function eglBase() { if (!egl.base) eglRebase(); return egl.base; }
function eglBoxRect() {
  const st = document.getElementById('stage'), s = st.getBoundingClientRect(), g = document.getElementById('grid-slot').getBoundingClientRect();
  const z = s.width / st.offsetWidth;
  return { x: (g.left - s.left) / z, y: (g.top - s.top) / z, w: g.width / z, h: g.height / z };
}
// Where the board goes in a room: its rect in stage design px, and the camera.
function eglRoomTarget(room) {
  const box = eglBoxRect(), B = eglBase();
  if (room === 'slide') return { rect: { x: 8, y: 8, w: B.sw - 16, h: B.sh - 16 }, k: 1, tx: 0, ty: 0, slide: true };
  if (room !== 'zoom') return { rect: box, k: 1, tx: 0, ty: 0, slide: false };
  const vw = innerWidth, vh = innerHeight, m = 6;
  const k = (vh - 2 * m) / (box.h * B.z);
  const cx = B.sx + (box.x + box.w / 2) * B.z, cy = B.sy + (box.y + box.h / 2) * B.z;
  const tx = -(cx - vw / 2) * k, ty = -(cy - vh / 2) * k;
  const sx = vw / 2 + tx + k * (B.sx - vw / 2), sy = vh / 2 + ty + k * (B.sy - vh / 2), u = B.z * k;
  const x0 = -sx / u, x1 = (vw - sx) / u, y0 = -sy / u, y1 = (vh - sy) / u;
  return { rect: { x: x0 + 4, y: y0 + 4, w: x1 - x0 - 8, h: y1 - y0 - 8 }, k, tx, ty, slide: false };
}
function eglRoomNow() {
  if (!eglLandscape()) return 'box';
  if (!eglPrefs.need || eglPrefs.room === 'box') return eglPrefs.room;
  const m = eglMeasure(eglBoxRect());
  return (m.fit < EGL_NEED_FIT || m.paged) ? eglPrefs.room : 'box';
}

// ── THE ROOM ────────────────────────────────────────────────────────────────
// Every laid-out box in #stage outside the board, through the display:contents
// wrappers, with the way it leaves: up if it sits over the board, else out the
// nearer side. Things lying over the board itself (the goal flash) stay.
function eglSlideTargets() {
  const st = document.getElementById('stage'), s = st.getBoundingClientRect(), z = s.width / st.offsetWidth;
  const g = eglBoxRect(), out = [];
  const walk = par => [...par.children].forEach(el => {
    if (el.id === 'egl' || el.id === 'grid-slot' || el.tagName === 'SCRIPT') return;
    const cs = getComputedStyle(el);
    if (cs.display === 'contents') { walk(el); return; }
    if (cs.display === 'none' || cs.position === 'fixed') return;
    const r0 = el.getBoundingClientRect(); if (!r0.width || !r0.height) return;
    const r = { x: (r0.left - s.left) / z, y: (r0.top - s.top) / z, w: r0.width / z, h: r0.height / z };
    const ix = Math.max(0, Math.min(r.x + r.w, g.x + g.w) - Math.max(r.x, g.x)), iy = Math.max(0, Math.min(r.y + r.h, g.y + g.h) - Math.max(r.y, g.y));
    if (ix * iy > r.w * r.h * 0.5) return;
    const cx = r.x + r.w / 2;
    if (r.y + r.h <= g.y + 2 && cx > g.x && cx < g.x + g.w) out.push({ el, dx: 0, dy: -(r.y + r.h + 24), d: g.y - r.y - r.h });
    else if (cx < g.x + g.w / 2) out.push({ el, dx: -(r.x + r.w + 24), dy: 0, d: g.x - r.x - r.w });
    else out.push({ el, dx: s.width / z - r.x + 24, dy: 0, d: r.x - g.x - g.w });
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
function eglSetCamera(T) {
  const cam = document.getElementById('camera'); if (!cam) return;
  if (T.k === egl.k && T.tx === egl.tx && T.ty === egl.ty) return;
  const ms = Math.round(EGL_MS * 1.25);
  cam.style.transition = `transform ${ms}ms ${EGL_EASE}`;
  cam.style.transform = `translate(${T.tx}px, ${T.ty}px) scale(${T.k})`;
  egl.k = T.k; egl.tx = T.tx; egl.ty = T.ty;
  clearTimeout(egl.camT);
  // At rest the camera must carry NO transform (js/camera.js, rule 2).
  if (T.k === 1) egl.camT = setTimeout(() => { cam.style.transition = 'none'; cam.style.transform = ''; void cam.offsetWidth; cam.style.transition = ''; }, ms + 40);
}
function eglSetRect(rect, animate) {
  const L = egl.layer, prev = egl.rect;
  Object.assign(L.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
  egl.rect = rect;
  if (!animate || !prev || (prev.x === rect.x && prev.y === rect.y && prev.w === rect.w && prev.h === rect.h)) return false;
  L.getAnimations().forEach(a => a.cancel());
  L.animate([{ left: prev.x + 'px', top: prev.y + 'px', width: prev.w + 'px', height: prev.h + 'px' },
             { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' }],
            { duration: EGL_MS, easing: EGL_EASE });
  return true;
}

// ── PIECES ──────────────────────────────────────────────────────────────────
// A piece is one cell or one merged run of cells: { key, cls, html, c, r, w, h,
// tap, card, from }. A layout returns the pieces; eglFill adds the inert black
// cards wherever none landed, so the board always reads as a board.
let _eglPaged = false;
function eglPieces(G) {
  _eglPaged = false;
  const P = ({ marquee: eglLayMarquee, pages: eglLayPages, focus: eglLayFocus, terminal: eglLayTerminal })[egl.lay](G);
  return egl.lay === 'terminal' ? P : eglFill(P, G);
}
function eglFill(P, G) {
  const used = new Set();
  P.forEach(p => { for (let r = p.r; r < p.r + p.h; r++) for (let c = p.c; c < p.c + p.w; c++) used.add(c + ':' + r); });
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++)
    if (!used.has(c + ':' + r)) P.push({ key: `amb:${c}:${r}`, cls: 'egl-amb', c, r, w: 1, h: 1 });
  return P;
}
const eglSk = () => egl.done ? 'out' : 's' + egl.step;   // a step's pieces are new pieces

function eglPromptHTML(mode) {
  const ev = egl.ev, st = eglStep();
  const lab = egl.done ? 'OUTCOME' : eglTxt((st || ev.steps[0]).label);
  const note = egl.done ? '' : egl.step < 0 ? (ev.steps[0].note || '') : (st.note || '');
  if (mode === 'strip') {
    const n = ev.steps.length + (egl.lay === 'pages' ? 2 : 1), at = egl.done ? n - 1 : egl.step + (egl.lay === 'pages' ? 1 : 0);
    const dots = Array.from({ length: n }, (_, i) => `<i class="${i === at ? 'on' : i < at ? 'past' : ''}"></i>`).join('');
    return `<div class="egl-fit egl-strip-in" data-min="6.5"><div class="egl-s1"><b class="egl-sn">${eglEsc(ev.name)}</b>`
         + `<span class="egl-sl">${eglEsc(lab)}</span><span class="egl-dots">${dots}</span></div>`
         + `<div class="egl-s2">${note || eglEsc(ev.flavor)}</div></div>`;
  }
  return `<div class="egl-fit" data-min="${mode === 'hero' ? 9.5 : 8}"><div class="egl-kick">${egl.step < 0 || mode === 'full' ? 'EVENT' : ''}</div>`
       + `<div class="egl-name">${eglEsc(ev.name)}</div><div class="egl-flav">${eglEsc(ev.flavor)}</div>`
       + (note ? `<div class="egl-note">${note}</div>` : '')
       + `<div class="egl-lab">${eglEsc(lab)}</div></div>`;
}
function eglPrompt(mode, c, r, w, h, big) {
  return { key: 'prompt-' + mode, cls: `egl-prompt egl-p-${mode}${big ? ' egl-big' : ''}`, html: eglPromptHTML(mode), c, r, w, h };
}
function eglResult(R, big) {
  const lines = egl.skipped ? ['Skipped. Nothing changes.'] : egl.ev.result();
  return [{ key: 'result', cls: 'egl-result' + (big ? ' egl-big' : ''), ...R,
    html: `<div class="egl-fit" data-min="9"><div class="egl-kick">${egl.skipped ? 'SKIPPED' : 'DONE'}</div>`
        + lines.map(l => `<div class="egl-rl">${eglCol(l)}</div>`).join('') + `</div>` }];
}

// The action row: what the step can do, as cells. Secondary actions take a
// cell each from the left, the commit takes two (three with room) at the right.
function eglActs() {
  const st = eglStep(), L = egl.ladder, acts = [];
  let go = { label: 'CONFIRM', sub: '', off: false, on: eglNext };
  if (egl.done) go = { label: 'DONE', sub: 'back to the board', on: eglNext };
  else if (egl.step < 0) { acts.push({ label: 'SKIP', on: eglSkip }); go = { label: 'BEGIN', sub: '›', on: eglNext }; }
  else if (st.t === 'ladder') {
    if (L.busy) go = { label: 'FLIP', sub: '...', off: true };
    else if (L.over) go = { label: L.n && !L.lost ? 'TAKE THEM' : 'DONE', sub: '', on: eglNext };
    else if (L.reflip) { acts.push({ label: 'WALK AWAY', on: eglSkip }); go = { label: 'FLIP AGAIN', sub: `${EGL_REFLIP} credits`, on: eglNext }; }
    else { acts.push(L.n ? { label: 'STOP', sub: `take ${L.n}`, on: eglSkip } : { label: 'SKIP', on: eglSkip }); go = { label: 'FLIP', sub: L.n ? `for ${L.n + 1}` : 'heads or tails', on: eglNext }; }
  } else {
    if (egl.lay === 'focus' && egl.focus != null) acts.push({ label: 'BACK', on: eglBack });
    else if (!st.noSkip) acts.push({ label: 'SKIP', on: eglSkip });
    const p = eglPicks(), need = eglNeed(st), last = egl.step === egl.ev.steps.length - 1;
    if (st.t === 'shop') go = { label: p.length ? `BUY ${p.length}` : 'LEAVE', sub: p.length ? `${p.length * st.price} credits` : 'buy nothing', on: eglNext };
    else if (st.t === 'cards') go = { label: last ? 'CONFIRM' : 'NEXT', sub: `${p.length} of ${need} picked`, off: p.length < need, on: eglNext };
    else {
      const o = st.opts[p[0]];
      go = { label: last ? 'CONFIRM' : 'NEXT', sub: o ? (o.title || o.name) : 'tap an option', off: !o, on: eglNext };
    }
  }
  return { acts, go };
}
function eglActions(A, term, navPages) {
  const { acts, go } = eglActs(), sw = (term || A.w >= 9) ? 2 : 1, P = [];
  const gw = term ? (navPages ? 2 : Math.min(4, A.w - sw)) : A.w >= 9 ? 3 : 2;
  let c = A.c;
  acts.forEach(a => {
    if (c + sw > A.c + A.w - gw) return;
    P.push({ key: 'act-' + a.label, cls: 'egl-act' + (term ? ' egl-tact' : ''), c, r: A.r, w: sw, h: 1, tap: a.on,
      html: term ? `<div class="egl-fit" data-min="7" data-chrome>[ ${a.label} ]</div>` : `<div class="egl-fit" data-min="5.5" data-chrome><b>${a.label}</b>${a.sub ? `<i>${a.sub}</i>` : ''}</div>` });
    c += sw;
  });
  if (navPages) P.push(...eglNav(navPages, [{ c, r: A.r, w: 1, h: 1 }, { c: c + 1, r: A.r, w: 1, h: 1 }], term));
  P.push({ key: 'act-go', cls: 'egl-act egl-go' + (go.off ? ' egl-off' : '') + (term ? ' egl-tact' : ''), c: A.c + A.w - gw, r: A.r, w: gw, h: 1,
    tap: go.off ? eglShake : go.on,
    html: term ? `<div class="egl-fit" data-min="7" data-chrome>[ ${go.label}${go.sub ? ' · ' + eglEsc(go.sub).toUpperCase() : ''} ]</div>`
               : `<div class="egl-fit" data-min="6" data-chrome><b>${go.label}</b>${go.sub ? `<i>${eglEsc(go.sub)}</i>` : ''}</div>` });
  return P;
}

// ── STEP BODIES ─────────────────────────────────────────────────────────────
// R is the region in cells; mode is 'full' (everything shown), 'compact' (icon
// and name; a tap opens it) or 'menu' (the terminal's numbered lines).
function eglBody(R, mode, G) {
  const st = eglStep();
  if (!st) return [];
  if (st.t === 'cards') return eglCardsBody(st, R, mode, G);
  if (st.t === 'shop') return eglShopBody(st, R, mode, G);
  if (st.t === 'ladder') return eglLadderBody(st, R, mode, G);
  return eglOptsBody(st, R, mode, G);
}
// Spread n tiles of width w over R, centred, in as many rows as fit.
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
  if (st.t === 'entities') {
    const art = (typeof entityTileHTML === 'function')
      ? entityTileHTML({ entity: o.entity, id: o.id, emoji: o.emoji, label: o.name }, o.rar, { tip: false, extraClass: 'egl-obj' }) : '';
    if (mode === 'menu') return `<div class="egl-fit" data-min="7"><div class="egl-tm-l"><b>[${i + 1}]</b> ${eglEsc(o.name.toUpperCase())}<u></u><em>${o.rar.toUpperCase()}</em></div><div class="egl-tm-x">${eglEsc(eglPlain(o.desc))}</div></div>`;
    return `<div class="egl-fit" data-min="${mode === 'detail' ? 9 : 7}"><div class="egl-tag rar-${o.rar}">${o.rar}</div><div class="egl-art">${art}</div>`
         + `<div class="egl-ot">${eglEsc(o.name)}</div>${mode === 'compact' ? '' : `<div class="egl-ox">${eglCol(o.desc)}</div>`}</div>`;
  }
  const ico = (typeof emGlyph === 'function') ? emGlyph(o.icon) : o.icon;
  if (mode === 'menu') return `<div class="egl-fit" data-min="7"><div class="egl-tm-l"><b>[${i + 1}]</b> ${eglEsc(o.title.toUpperCase())}<u></u><em>${eglEsc((o.cost || '').toUpperCase())}</em></div><div class="egl-tm-x">${eglEsc(eglPlain(o.text))}</div></div>`;
  return `<div class="egl-fit" data-min="${mode === 'detail' ? 9 : 7}"><div class="egl-ico">${ico}</div><div class="egl-ot">${eglEsc(o.title)}</div>`
       + (mode === 'compact' ? '' : `<div class="egl-ox">${eglCol(o.text)}</div>`)
       + (o.cost ? `<div class="egl-cost">${eglEsc(o.cost)}</div>` : '') + `</div>`;
}
function eglOptCls(st, o, i, extra) {
  const sel = eglPicks().includes(i);
  return `egl-opt${st.t === 'entities' ? ' egl-ent' : ''}${o.rar ? ' rar-' + o.rar : ''}${st.tone === 'debuff' ? ' egl-debuff' : ''}${sel ? ' egl-sel' : ''} ${extra || ''}`;
}
function eglOptsBody(st, R, mode, G) {
  const n = st.opts.length, sk = eglSk(), P = [];
  if (mode === 'menu') {
    const h = Math.max(1, Math.min(3, Math.floor(R.h / n)));
    st.opts.forEach((o, i) => P.push({ key: `${sk}:o${i}`, cls: eglOptCls(st, o, i, 'egl-tm'), c: R.c, r: R.r + i * h, w: R.w, h, tap: () => eglTap(i), html: eglOptHTML(st, o, i, 'menu') }));
    return P;
  }
  if (mode === 'compact' && egl.focus != null) {
    const i = egl.focus, o = st.opts[i];
    return [{ key: `${sk}:detail`, from: `${sk}:o${i}`, cls: eglOptCls(st, o, i, 'egl-detail' + (G.wide ? ' egl-big' : '')), ...R, html: eglOptHTML(st, o, i, 'detail') }];
  }
  let w, h;
  if (mode === 'compact') { w = Math.min(G.wide ? 3 : 2, Math.max(1, Math.floor(R.w / n))); h = Math.min(R.h, 2); }
  else if (n === 1) { w = Math.min(R.w, G.wide ? 5 : 4); h = R.h; }
  else if (R.w >= n * 2) { w = Math.floor(R.w / n); h = R.h; }
  else { w = R.w; h = Math.max(1, Math.floor(R.h / n)); }
  eglSpread(n, R, w, h).forEach((b, i) => {
    const o = st.opts[i];
    P.push({ key: `${sk}:o${i}`, cls: eglOptCls(st, o, i, mode === 'compact' ? 'egl-compact' : (G.wide ? 'egl-big' : '')), ...b, tap: () => eglTap(i), html: eglOptHTML(st, o, i, mode) });
  });
  return P;
}
function eglCardFace(card) {
  let a = null;
  try { a = renderCardAppearance(card, 0, 0, { revealFog: true }); } catch (e) {}
  return a ? `<div class="${a.className}">${a.innerHTML}</div>` : `<div class="card">${card.rank}${card.suit}</div>`;
}
// Cards a page at a time. A page that cannot hold them all gives up its last
// two cells to ‹ and ›; how many pages it took is part of the comparison.
function eglPaging(N, cap, reserve) {
  if (N <= cap) return { per: N, pages: 1 };
  _eglPaged = true;
  const per = Math.max(1, cap - reserve);
  return { per, pages: Math.ceil(N / per) };
}
function eglNav(pages, at, term) {
  const P = [];
  const go = d => { egl.page = Math.max(0, Math.min(pages - 1, egl.page + d)); eglDraw(); };
  [['‹', -1, egl.page === 0], ['›', 1, egl.page >= pages - 1]].forEach(([g, d, off], j) =>
    P.push({ key: 'nav' + d, cls: 'egl-act egl-nav' + (off ? ' egl-off' : '') + (term ? ' egl-tact' : ''), ...at[j], tap: off ? null : () => go(d),
      html: `<div class="egl-fit" data-min="6" data-chrome><b>${g}</b><i>${egl.page + 1}/${pages}</i></div>` }));
  return P;
}
function eglCardsBody(st, R, mode, G) {
  const cards = st.cards, p = eglPicks(), sk = eglSk(), P = [];
  const cw = mode === 'menu' ? 2 : 1;
  const per = Math.floor(R.w / cw);
  const pg = eglPaging(cards.length, per * R.h, mode === 'menu' ? 0 : 2);
  egl.page = Math.min(egl.page, pg.pages - 1);
  const first = egl.page * pg.per;
  cards.slice(first, first + pg.per).forEach((cd, j) => {
    const i = first + j, sel = p.includes(i);
    const b = { c: R.c + (j % per) * cw, r: R.r + Math.floor(j / per), w: cw, h: 1 };
    if (mode === 'menu') P.push({ key: `${sk}:c${i}`, cls: 'egl-tm egl-tcard' + (sel ? ' egl-sel' : ''), ...b, tap: () => eglTap(i),
      html: `<div class="egl-fit" data-min="7">${sel ? '[×]' : '[ ]'} ${cd.rank}${cd.suit}</div>` });
    else P.push({ key: `${sk}:c${i}`, cls: 'egl-card' + (sel ? ' egl-sel' : ''), ...b, card: true, tap: () => eglTap(i), html: eglCardFace(cd) });
  });
  if (pg.pages > 1) {
    const at = mode === 'menu' ? null : [{ c: R.c + R.w - 2, r: R.r + R.h - 1, w: 1, h: 1 }, { c: R.c + R.w - 1, r: R.r + R.h - 1, w: 1, h: 1 }];
    if (at) P.push(...eglNav(pg.pages, at));
    else egl.termNav = pg.pages;
  }
  return P;
}
function eglShopBody(st, R, mode, G) {
  const items = st.items, p = eglPicks(), sk = eglSk(), P = [], n = items.length;
  const buffTxt = it => it.buffs.length ? it.buffs.map(b => b.label).join(' · ') : 'plain';
  if (mode === 'menu') {
    const cw = Math.max(3, Math.floor(R.w / 2)), per = Math.floor(R.w / cw);
    items.forEach((it, i) => {
      const sel = p.includes(i);
      P.push({ key: `${sk}:s${i}`, cls: 'egl-tm egl-tcard' + (sel ? ' egl-sel' : ''), c: R.c + (i % per) * cw, r: R.r + Math.floor(i / per), w: cw, h: 1, tap: () => eglTap(i),
        html: `<div class="egl-fit" data-min="7">${sel ? '[×]' : '[ ]'} ${it.card.rank}${it.card.suit} <span>${eglEsc(eglPlain(buffTxt(it)))}</span></div>` });
    });
    return P;
  }
  const sizes = [[2, 2], [1, 2], [1, 1]];
  const [w, h] = sizes.find(([w, h]) => Math.ceil(n / Math.max(1, Math.floor(R.w / w))) * h <= R.h) || [1, 1];
  eglSpread(n, R, w, h).forEach((b, i) => {
    const it = items[i], sel = p.includes(i);
    P.push({ key: `${sk}:s${i}`, cls: `egl-shop egl-sh${w}${h}` + (sel ? ' egl-sel' : '') + (it.buffs.length ? ' egl-buffed' : ''), ...b, card: true, tap: () => eglTap(i),
      html: `<div class="egl-shop-face">${eglCardFace(it.card)}</div><div class="egl-fit egl-shop-b" data-min="5.5"><div>${eglCol(buffTxt(it))}</div></div>` });
  });
  return P;
}
function eglLadderBody(st, R, mode, G) {
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
    html: `<div class="egl-bar" style="--lv:${(i + 1) / n}"></div><div class="egl-fit" data-min="7"><b>${i + 1}</b><i>${eglEsc(t)}</i></div>` }));
  return P;
}

// ── THE FOUR LAYOUTS ────────────────────────────────────────────────────────
function eglLayMarquee(G) {
  const P = [];
  if (G.wide) {
    const pw = G.cols >= 11 ? 4 : 3, R = { c: pw, r: 0, w: G.cols - pw, h: G.rows - 1 };
    P.push(eglPrompt('full', 0, 0, pw, G.rows, true));
    P.push(...(egl.done ? eglResult(R, true) : eglBody(R, 'full', G)), ...eglActions({ c: pw, r: G.rows - 1, w: G.cols - pw }));
  } else {
    const R = { c: 0, r: 2, w: G.cols, h: G.rows - 3 };
    P.push(eglPrompt('full', 0, 0, G.cols, 2));
    P.push(...(egl.done ? eglResult(R) : eglBody(R, 'full', G)), ...eglActions({ c: 0, r: G.rows - 1, w: G.cols }));
  }
  return P;
}
function eglLayPages(G) {
  const P = [], R = { c: 0, r: 0, w: G.cols, h: G.rows - 1 };
  if (egl.step < 0 && !egl.done) P.push(eglPrompt('hero', 0, 0, G.cols, G.rows - 1, G.wide));
  else if (egl.done) P.push(...eglResult(R, true));
  else { P.push(eglPrompt('strip', 0, 0, G.cols, 1)); P.push(...eglBody({ c: 0, r: 1, w: G.cols, h: G.rows - 2 }, 'full', G)); }
  P.push(...eglActions({ c: 0, r: G.rows - 1, w: G.cols }));
  return P;
}
function eglLayFocus(G) {
  const P = [eglPrompt('strip', 0, 0, G.cols, 1)], R = { c: 0, r: 1, w: G.cols, h: G.rows - 2 };
  P.push(...(egl.done ? eglResult(R, G.wide) : eglBody(R, 'compact', G)), ...eglActions({ c: 0, r: G.rows - 1, w: G.cols }));
  return P;
}
// The terminal prints: every line it has shown before stays put, the new ones
// type out in order (egl.seen).
function eglTermLines() {
  const ev = egl.ev, st = eglStep(), L = egl.ladder, out = [];
  out.push(['egl-t-h', `EVENT // ${ev.name.toUpperCase()}`], ['', ev.flavor], ['', ' ']);
  if (egl.done) { out.push(['egl-t-h', egl.skipped ? '> SKIPPED' : '> DONE']); (egl.skipped ? ['Nothing changes.'] : ev.result()).forEach(l => out.push(['', eglPlain(l)])); out.push(['egl-t-dim', ' '], ['egl-t-dim', 'PRESS DONE TO RETURN TO THE BOARD']); return out; }
  if (st.note) out.push(['', eglPlain(st.note)], ['', ' ']);
  if (st.t === 'ladder') L.log.forEach(l => out.push([/LOST|TAILS/.test(l) ? 'egl-t-bad' : /HEADS/.test(l) ? 'egl-t-good' : '', l]));
  out.push(['egl-t-h', `> ${eglTxt(st.label)}${st.t === 'cards' ? ` (${eglPicks().length}/${eglNeed(st)})` : ''}`]);
  return out;
}
function eglTermHTML() {
  let fresh = 0;
  const html = eglTermLines().map(([cls, t], i) => {
    const k = `${eglSk()}|${i}|${t}`, isNew = !egl.seen.has(k);
    if (!egl.measuring) egl.seen.add(k);
    return `<div class="egl-tl ${cls}${isNew ? ' egl-type' : ''}" style="--d:${isNew ? fresh++ * 170 : 0}ms">${eglEsc(t)}</div>`;
  }).join('');
  return `<div class="egl-fit" data-min="8">${html}<span class="egl-cursor"></span></div>`;
}
function eglLayTerminal(G) {
  const st = eglStep(), P = [];
  egl.termNav = 0;
  let menu = 0;
  if (st) menu = st.t === 'cards' ? Math.min(G.wide ? 11 : 7, Math.ceil(st.cards.length / Math.floor(G.cols / 2)))
              : st.t === 'shop' ? Math.ceil(st.items.length / Math.floor(G.cols / Math.max(3, Math.floor(G.cols / 2))))
              : st.t === 'ladder' ? st.rungs.length : Math.min(st.opts.length * 2, G.rows - 5);
  let S, R;
  if (G.wide && menu) { const half = Math.floor(G.cols / 2); S = { c: 0, r: 0, w: half, h: G.rows - 1 }; R = { c: half, r: 0, w: G.cols - half, h: G.rows - 1 }; }
  else { S = { c: 0, r: 0, w: G.cols, h: G.rows - 1 - menu }; R = { c: 0, r: G.rows - 1 - menu, w: G.cols, h: menu }; }
  P.push({ key: 'screen', cls: 'egl-term', ...S, html: eglTermHTML() });
  if (st && menu) P.push(...eglBody(R, 'menu', G));
  P.push(...eglActions({ c: 0, r: G.rows - 1, w: G.cols }, true, egl.termNav));
  // The terminal is one screen: whatever no line claimed is screen too.
  return eglFill(P, G).map(p => p.cls === 'egl-amb' ? { ...p, cls: 'egl-amb egl-tamb' } : p);
}

// ── DRAWING ─────────────────────────────────────────────────────────────────
function eglBuild(host, pieces, G, keyed) {
  const els = new Map();
  pieces.forEach(p => {
    const el = document.createElement('div');
    el.className = 'egl-cell ' + (p.cls || '');
    el.innerHTML = p.html || '';
    eglPlace(el, p, G);
    host.appendChild(el);
    if (keyed) els.set(p.key, el);
  });
  return els;
}
function eglPlace(el, p, G) {
  const b = G.box(p.c, p.r, p.w, p.h);
  el.style.left = b.l + 'px'; el.style.top = b.t + 'px'; el.style.width = b.w + 'px'; el.style.height = b.h + 'px';
  el.dataset.d = (p.c + p.r) * 26;
  if (p.card) {
    const face = p.cls.includes('egl-shop') ? (p.cls.includes('egl-sh11') ? 0.62 : 0.6) : 1;
    el.style.setProperty('--card-w', Math.max(10, b.w - 4) + 'px');
    el.style.setProperty('--card-h', Math.max(10, b.h * face - 4) + 'px');
  }
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
  const G = eglGeom(rect, eglRows());
  egl.measuring = true;
  const els = eglBuild(host, eglPieces(G), G, true);
  egl.measuring = false;
  const m = eglFitAll(host);
  m.paged = _eglPaged;
  m.fits = new Map([...els].map(([k, el]) => [k, el.querySelector('.egl-fit')?._fit ?? 1]));
  host.innerHTML = '';
  return m;
}
function eglDraw(opts = {}) {
  if (!egl) return;
  const room = eglRoomNow(), T = eglRoomTarget(room);
  const moved = room !== egl.room || opts.relayout;
  egl.room = room;
  eglSetSlide(!!T.slide);
  eglSetCamera(T);
  egl.layer.classList.toggle('egl-roomy', room !== 'box');
  eglSetRect(T.rect, moved && !opts.instant);
  const G = eglGeom(T.rect, eglRows());
  egl.board.dataset.lay = egl.measure.dataset.lay = egl.lay;
  const m = eglMeasure(T.rect);
  const pieces = eglPieces(G);
  eglReconcile(pieces, G, m.fits, { turn: !!opts.turn, animate: !opts.instant });
  egl.metric = { fit: m.fit, px: m.px, k: T.k, paged: _eglPaged, room };
  eglMountCoin();
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
      el = document.createElement('div'); el.dataset.k = p.key; board.appendChild(el); born.push({ el, p });
    }
    const cls = 'egl-cell ' + (p.cls || '');
    if (el.className !== cls) el.className = cls;
    if (el._html !== p.html) { el.innerHTML = p.html || ''; el._html = p.html; }
    el.onclick = p.tap ? e => { e.stopPropagation(); p.tap(); } : null;
    eglPlace(el, p, G);
    const fe = el.querySelector('.egl-fit'); if (fe) fe.style.setProperty('--fit', fits.get(p.key) ?? 1);
    const b = G.box(p.c, p.r, p.w, p.h);
    if (prev && animate && (Math.abs(prev.l - b.l) > 0.5 || Math.abs(prev.t - b.t) > 0.5 || Math.abs(prev.w - b.w) > 0.5 || Math.abs(prev.h - b.h) > 0.5))
      el.animate([{ left: prev.l + 'px', top: prev.t + 'px', width: prev.w + 'px', height: prev.h + 'px' },
                  { left: b.l + 'px', top: b.t + 'px', width: b.w + 'px', height: b.h + 'px' }], { duration: EGL_MS, easing: EGL_EASE });
  });
  // The dead fold away, edge-on; on a page turn, in a wave from the top left.
  old.forEach((el, k) => {
    if (seen.has(k)) return;
    el._dying = true; el.onclick = null; el.classList.add('egl-dying');
    if (!animate) { el.remove(); return; }
    const a = el.animate([{ transform: 'perspective(520px) rotateY(0deg)', opacity: 1 }, { transform: 'perspective(520px) rotateY(90deg)', opacity: 0.3 }],
      { duration: 190, delay: turn ? +el.dataset.d : 0, easing: 'ease-in', fill: 'forwards' });
    a.finished.then(() => el.remove(), () => el.remove());
  });
  // The new turn in from the other edge. One growing out of a cell that just
  // left (FOCUS's detail) opens from that cell's box instead.
  if (!animate) return;
  born.forEach(({ el, p }) => {
    const src = p.from && old.get(p.from);
    if (src) {
      const b = G.box(p.c, p.r, p.w, p.h), s = { l: src.offsetLeft, t: src.offsetTop, w: src.offsetWidth, h: src.offsetHeight };
      src.remove();
      el.animate([{ left: s.l + 'px', top: s.t + 'px', width: s.w + 'px', height: s.h + 'px' }, { left: b.l + 'px', top: b.t + 'px', width: b.w + 'px', height: b.h + 'px' }],
        { duration: 380, easing: EGL_EASE });
      el.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 220, fill: 'backwards' });
      return;
    }
    el.animate([{ transform: 'perspective(520px) rotateY(-90deg)', opacity: 0.3 }, { transform: 'perspective(520px) rotateY(0deg)', opacity: 1 }],
      { duration: 240, delay: (turn ? 250 : 0) + +el.dataset.d, easing: 'ease-out', fill: 'backwards' });
  });
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

// ── OPEN AND CLOSE ──────────────────────────────────────────────────────────
// The board's own cards turn edge-on and the event's cells turn in behind
// them; closing is the same in reverse.
// The turned-away cards hold edge-on (fill forwards) until the board is
// hidden, and only then hand their rotate back (eglBoardHidden).
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
  egl = { layer, board: layer.firstChild, measure: layer.lastChild, samples: eglSamples(), room: 'box', rect: null, k: 1, tx: 0, ty: 0, slid: false };
  eglPrefs.ev = Math.min(eglPrefs.ev, egl.samples.length - 1);
  if (!EGL_LAYOUTS[eglPrefs.lay]) eglPrefs.lay = 'marquee';
  egl.lay = eglPrefs.lay;
  eglRebase();
  eglPanelBuild();
  layer.style.visibility = 'hidden';
  eglSetRect(eglBoxRect(), false);
  eglTurnBoard(true).then(() => { if (!egl) return; eglBoardHidden(); eglStart(false); });
  egl.onResize = () => { clearTimeout(egl.resT); egl.resT = setTimeout(eglResize, 200); };
  addEventListener('resize', egl.onResize);
}
// DONE: the event turns back into the board, which is what the real thing does
// once it has paid; the lab then deals the same event again so it can be read
// twice.
function eglClose(again) {
  if (!egl || egl.closing) return;
  egl.closing = true;
  const cells = [...egl.board.children];
  cells.forEach(el => el.animate([{ transform: 'perspective(520px) rotateY(0deg)' }, { transform: 'perspective(520px) rotateY(90deg)' }],
    { duration: 190, delay: +el.dataset.d || 0, easing: 'ease-in', fill: 'forwards' }));
  const room = egl.room;
  setTimeout(() => {
    if (!egl) return;
    egl.board.innerHTML = '';
    egl.room = 'box';
    eglSetSlide(false); eglSetCamera({ k: 1, tx: 0, ty: 0 }); eglSetRect(eglBoxRect(), room !== 'box');
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
  const cam = document.getElementById('camera');
  (egl.slideEls || []).forEach(({ el }) => { el.style.transition = 'none'; el.style.translate = ''; });
  egl.slid = false; egl.slideEls = null;
  if (cam && egl.k !== 1) { cam.style.transition = 'none'; cam.style.transform = ''; }
  egl.k = 1; egl.tx = 0; egl.ty = 0; egl.base = null; egl.room = 'box';
  void document.body.offsetWidth;
  eglRebase();
  eglDraw({ instant: true });
}
function eglTeardown() {
  if (!egl) return;
  removeEventListener('resize', egl.onResize);
  eglSetSlide(false);
  const cam = document.getElementById('camera');
  if (cam && egl.k !== 1) { cam.style.transition = 'none'; cam.style.transform = ''; }
  egl.layer.remove(); egl.panel?.remove();
  document.body.classList.remove('egl-on');
  egl = null;
}

// ── THE PANEL ───────────────────────────────────────────────────────────────
function eglPanelBuild() {
  const p = document.createElement('div');
  p.id = 'egl-panel';
  p.innerHTML = `
    <div class="eglp-head"><b>EVENT LAYOUTS</b><span class="eglp-n"></span><button class="eglp-side" title="Other side">⇄</button><button class="eglp-min" title="Fold">–</button><button class="eglp-x" title="Close">×</button></div>
    <div class="eglp-body">
      <div class="eglp-row"><button class="eglp-prev">‹</button><div class="eglp-ev"><div class="eglp-name"></div><div class="eglp-shape"></div></div><button class="eglp-next">›</button></div>
      <div class="eglp-lab">LAYOUT</div>
      <div class="eglp-row eglp-lays">${Object.entries(EGL_LAYOUTS).map(([k, v]) => `<button data-lay="${k}">${v.name}</button>`).join('')}</div>
      <div class="eglp-note"></div>
      <div class="eglp-lab">ROOM</div>
      <div class="eglp-row eglp-rooms">${Object.entries(EGL_ROOMS).map(([k, v]) => `<button data-room="${k}">${v}</button>`).join('')}</div>
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
  const z = eglBase().z, onScreen = (M.px || 0) * z * (M.k || 1);
  const shrunk = M.fit < 1 ? `, shrunk to ${Math.round(M.fit * 100)}%` : '';
  p.querySelector('.eglp-metric').innerHTML = `Smallest text <b>${onScreen.toFixed(1)}px</b> on screen${shrunk}.`
    + `<br>Pick of three descriptions: ${(7.5 * z).toFixed(1)}px.`
    + (M.paged ? '<br>Cards need more than one page here.' : '')
    + (eglPrefs.need && M.room !== eglPrefs.room ? '<br>Fits in the box, so it stays there.' : '');
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
