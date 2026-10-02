// ══ CARD ANIMATIONS (r436) ═══════════════════════════════════════════════════
// Step 3 of the card-animation plan: the lab. Every way a card moves (swap, fly
// to the preview, discard, cut, buff, boss effects, select / idle) is one row in
// CARD_ANIM_KINDS with a dropdown of looks. Dev panel -> Card Animations opens the
// lab: a mock board of real card faces (renderCardAppearance) with the settings
// laid over it and a Preview button per row.
//
// A look is a RUNNER, (ctx) => Promise, that animates card ELEMENTS. The lab and
// the game call the same runner, which is what keeps the preview honest: the
// steps that build a look also wire it into its game site, reading
// cardAnimChoice(kind). Until a look is built its option is listed and disabled,
// with the step that builds it.
//
// "Current" is what ships today, drawn here as a stand-in so it can be compared.

const CARD_ANIM_KINDS = [
  { id: 'swap', label: 'Swap', note: 'Two cards trade places.',
    options: [
      { id: 'current', name: 'Current: slide' },
      { id: 'leapfrog', name: 'A · Leapfrog', step: 4, desc: 'The first card you picked lifts and arcs over the other, which ducks under it.' },
      { id: 'rubber',   name: 'B · Rubber band', step: 4, desc: 'Both stretch toward each other, snap across and wobble to rest.' },
      { id: 'shove',    name: 'C · Shove', step: 4, desc: 'The first card barges across and knocks the other into its old cell.' },
    ] },
  { id: 'fly', label: 'Fly to preview', note: 'A played hand leaves the board for the preview tray.',
    options: [
      { id: 'current', name: 'Current: straight flight' },
      { id: 'lean',    name: 'A · Lean in', step: 5, desc: 'Each card tilts into its flight and straightens as it lands.' },
      { id: 'comet',   name: 'B · Comet', step: 5, desc: 'Cards streak along a curve with a short trail.' },
      { id: 'pinball', name: 'C · Pinball', step: 5, desc: 'Cards pop up, then drop into their slots with a bounce.' },
    ] },
  { id: 'discard', label: 'Discard', note: 'Cards you throw away.',
    options: [
      { id: 'current', name: 'Current: shrink and fade' },
      { id: 'toss',    name: 'A · Toss', step: 6, desc: 'Flicked off the board with a spin.' },
      { id: 'crumple', name: 'B · Crumple', step: 6, desc: 'Squashed into a ball that drops away.' },
      { id: 'sink',    name: 'C · Sink', step: 6, desc: 'Falls back into the table, darkening as it goes.' },
    ] },
  { id: 'cut', label: 'Cut from deck', note: 'A card removed from the run for good.',
    options: [
      { id: 'current', name: 'Current: shrink and fade' },
      { id: 'burn',  name: 'A · Burn', step: 6, desc: 'An edge catches and burns across the card.' },
      { id: 'snip',  name: 'B · Snip', step: 6, desc: 'Cut in two along a diagonal; the halves fall apart.' },
      { id: 'deep',  name: 'C · Deep fall', step: 6, desc: 'Drops through the board into the dark, shrinking.' },
    ] },
  { id: 'buff', label: 'Buff lands', note: 'A card gains a permanent bonus.',
    options: [
      { id: 'current', name: 'Current: ring pulse' },
      { id: 'stamp',  name: 'A · Stamp', step: 6, desc: 'Pressed down like a rubber stamp, with a thud.' },
      { id: 'charge', name: 'B · Charge', step: 6, desc: 'Fills with light from the bottom, then flares.' },
      { id: 'flip',   name: 'C · Flip', step: 6, desc: 'Flips over and back, new and improved.' },
    ] },
  { id: 'boss', label: 'Boss effect on a card', note: 'A boss holds, marks or blocks a card.',
    options: [
      { id: 'current',  name: 'Current: none' },
      { id: 'shackle',  name: 'A · Shackle', step: 6, desc: 'A chain wraps the card and pulls tight.' },
      { id: 'static',   name: 'B · Static', step: 6, desc: 'The card glitches and loses its colour.' },
      { id: 'pressed',  name: 'C · Pressed', step: 6, desc: 'Squashed flat into the board.' },
    ] },
  { id: 'idle', label: 'Select and idle', note: 'Picking a card, and the board at rest.',
    options: [
      { id: 'current', name: 'Current: lift' },
      { id: 'ripple',    name: 'A · Ripple', step: 7, desc: 'Selecting sends a small wave through the cards around it.' },
      { id: 'gaze',      name: 'B · Gaze', step: 7, desc: 'Cards lean toward the pointer (tilting the phone on mobile).' },
      { id: 'attention', name: 'C · Attention', step: 7, desc: 'Selected cards hover and sway; the rest settle back.' },
    ] },
];

const CARD_ANIM_KEY = 'lethe.cardAnims.v1';
let _cardAnimPick = (() => { try { return JSON.parse(localStorage.getItem(CARD_ANIM_KEY)) || {}; } catch (e) { return {}; } })();

// Which look a kind uses. A look that is not built yet reads as 'current'.
function cardAnimChoice(kind) {
  const id = _cardAnimPick[kind] || 'current';
  return cardAnimRunner(kind, id) ? id : 'current';
}
function setCardAnimChoice(kind, id) {
  if (id === 'current') delete _cardAnimPick[kind]; else _cardAnimPick[kind] = id;
  try { Object.keys(_cardAnimPick).length ? localStorage.setItem(CARD_ANIM_KEY, JSON.stringify(_cardAnimPick)) : localStorage.removeItem(CARD_ANIM_KEY); } catch (e) {}
}

// Runners: CARD_ANIM_RUN[kind][option](ctx) -> Promise. Steps 4-7 add to this.
const CARD_ANIM_RUN = { swap: {}, fly: {}, discard: {}, cut: {}, buff: {}, boss: {}, idle: {} };
function cardAnimRunner(kind, id) { return (CARD_ANIM_RUN[kind] || {})[id] || null; }

const caWait = ms => new Promise(r => setTimeout(r, ms));
const caAnim = (el, frames, opts) => new Promise(res => {
  if (!el || !el.animate) return res();
  const a = el.animate(frames, opts);
  a.onfinish = () => { a.cancel(); res(); };      // a filled animation owns its property for good
  a.oncancel = () => res();
});

// ── Current looks, as stand-ins for comparison ──────────────────────────────
// ── SWAP (step 4) ───────────────────────────────────────────────────────────
// Runners are FLIP-shaped, exactly as the game does a swap: the data and the DOM
// have ALREADY swapped, so `a` (the card picked first) sits in its new cell and
// is animated FROM its old one. dx/dy is how far `a` travelled, in design px; `b`
// travelled the opposite way. Only the standalone translate/scale/rotate/filter
// properties move, so the heartbeat's own transform keeps beating underneath.
const CARD_SWAP_MS = { current: 220, leapfrog: 380, rubber: 400, shove: 360 };
function cardSwapMs() { return CARD_SWAP_MS[cardAnimChoice('swap')] || 220; }

function caSwapGeom(a, dx, dy) {
  const h = (a && a.offsetHeight) || 75, w = (a && a.offsetWidth) || 57;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  const len = Math.hypot(dx, dy) || 1;
  // a unit vector at right angles to the travel, pointing up (or left on a vertical swap)
  let px = -dy / len, py = dx / len;
  if (horiz ? py > 0 : px > 0) { px = -px; py = -py; }
  return { h, w, horiz, px, py, sx: Math.sign(dx) || 1, sy: Math.sign(dy) || 1 };
}
const caT = (x, y) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
async function caLift(el, ms, run) {
  if (!el) return run();
  const z = el.style.zIndex; el.style.zIndex = '30';
  try { await run(); } finally { el.style.zIndex = z; }
}

CARD_ANIM_RUN.swap.current = async ({ a, b, dx, dy }) => {
  const o = { duration: CARD_SWAP_MS.current, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' };
  await Promise.all([
    caAnim(a, [{ translate: caT(-dx, -dy), scale: '1.09' }, { translate: '0px 0px', scale: '1' }], o),
    caAnim(b, [{ translate: caT(dx, dy), scale: '1.09' }, { translate: '0px 0px', scale: '1' }], o),
  ]);
};
// A: the first card lifts and arcs over; the other ducks under it.
CARD_ANIM_RUN.swap.leapfrog = async ({ a, b, dx, dy }) => {
  const g = caSwapGeom(a, dx, dy), arc = (g.horiz ? g.h : g.w) * 0.55, dur = CARD_SWAP_MS.leapfrog;
  const lean = (g.horiz ? g.sx : g.sy) * 9;
  await Promise.all([
    caLift(a, dur, () => caAnim(a, [
      { translate: caT(-dx, -dy), scale: '1', rotate: '0deg', filter: 'brightness(1)' },
      { translate: caT(-dx * .5 + g.px * arc, -dy * .5 + g.py * arc), scale: '1.16', rotate: `${lean}deg`, filter: 'brightness(1.08) drop-shadow(0 10px 8px rgba(0,0,0,.45))', offset: .45 },
      { translate: '0px 0px', scale: '0.97', rotate: `${-lean * .3}deg`, filter: 'brightness(1)', offset: .82 },
      { translate: '0px 0px', scale: '1', rotate: '0deg', filter: 'brightness(1)' }],
      { duration: dur, easing: 'cubic-bezier(.3,.6,.35,1)' })),
    caAnim(b, [
      { translate: caT(dx, dy), scale: '1', filter: 'brightness(1)' },
      { translate: caT(dx * .55, dy * .55), scale: '.86', filter: 'brightness(.72)', offset: .45 },
      { translate: '0px 0px', scale: '1', filter: 'brightness(1)' }],
      { duration: dur, easing: 'cubic-bezier(.4,0,.3,1)' }),
  ]);
};
// B: both stretch toward each other, snap past, and wobble to rest.
CARD_ANIM_RUN.swap.rubber = async ({ a, b, dx, dy }) => {
  const g = caSwapGeom(a, dx, dy), dur = CARD_SWAP_MS.rubber;
  const st = (k) => g.horiz ? `${1 + k} ${1 - k * .5}` : `${1 - k * .5} ${1 + k}`;
  const leg = (el, x, y, sgn) => caAnim(el, [
    { translate: caT(-x, -y), scale: st(0), rotate: '0deg' },
    { translate: caT(-x * .88, -y * .88), scale: st(.16), rotate: '0deg', offset: .28 },
    { translate: caT(x * .14, y * .14), scale: st(-.08), rotate: `${sgn * 4}deg`, offset: .52 },
    { translate: caT(-x * .06, -y * .06), scale: st(.04), rotate: `${-sgn * 2.5}deg`, offset: .72 },
    { translate: caT(x * .02, y * .02), scale: st(-.015), rotate: `${sgn}deg`, offset: .87 },
    { translate: '0px 0px', scale: st(0), rotate: '0deg' }],
    { duration: dur, easing: 'cubic-bezier(.45,.05,.4,1)' });
  await Promise.all([caLift(a, dur, () => leg(a, dx, dy, 1)), leg(b, -dx, -dy, -1)]);
};
// C: the first card barges across and knocks the other into its old cell.
CARD_ANIM_RUN.swap.shove = async ({ a, b, dx, dy }) => {
  const g = caSwapGeom(a, dx, dy), dur = CARD_SWAP_MS.shove;
  const lean = (g.horiz ? g.sx : g.sy) * 7;
  await Promise.all([
    caLift(a, dur, () => caAnim(a, [
      { translate: caT(-dx, -dy), rotate: '0deg', scale: '1' },
      { translate: caT(-dx * .45, -dy * .45), rotate: `${lean}deg`, scale: '1.06', offset: .35 },
      { translate: caT(dx * .06, dy * .06), rotate: `${-lean * .4}deg`, scale: '1.02', offset: .62 },
      { translate: '0px 0px', rotate: '0deg', scale: '1' }],
      { duration: dur, easing: 'cubic-bezier(.5,0,.3,1)' })),
    caAnim(b, [
      { translate: caT(dx, dy), rotate: '0deg' },
      { translate: caT(dx, dy), rotate: '0deg', offset: .3 },
      { translate: caT(dx * .82, dy * .82), rotate: `${lean * .6}deg`, offset: .4 },
      { translate: caT(-dx * .1, -dy * .1), rotate: `${-lean * 1.4}deg`, offset: .72 },
      { translate: caT(dx * .03, dy * .03), rotate: `${lean * .4}deg`, offset: .88 },
      { translate: '0px 0px', rotate: '0deg' }],
      { duration: dur, easing: 'cubic-bezier(.3,.7,.4,1)' }),
  ]);
};
// The game's swap: one call, whichever look is chosen.
function cardAnimSwap(a, b, dx, dy) {
  const run = cardAnimRunner('swap', cardAnimChoice('swap'));
  if (document.body.classList.contains('reduced-motion')) return Promise.resolve();
  return run({ a, b, dx, dy }).catch(() => {});
}

// ── FLY TO PREVIEW (step 5) ─────────────────────────────────────────────────
// The game flies a fixed-position CLONE of each card from its cell to its
// preview slot (flyGridCardToSlot, js/score-dance.js). A look is the keyframes for
// that clone: dx/dy from the card's centre to the slot's centre (viewport px), sc
// the size it lands at, i its place in the hand, h its height on screen. Every
// look keeps the same duration, because the dance times its beats to it.
const CARD_FLY_LOOKS = {
  current: (dx, dy, sc) => ({ easing: 'cubic-bezier(.35,.65,.3,1)', frames: [
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx}px,${dy}px) scale(${sc})`, opacity: .9 }] }),
  // A: tilts into its flight and straightens as it lands
  lean: (dx, dy, sc) => {
    const lean = Math.max(-18, Math.min(18, dx * .045 + (dy < 0 ? -4 : 4) * Math.sign(dx || 1)));
    return { easing: 'cubic-bezier(.4,.1,.3,1)', frames: [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * .3}px,${dy * .3}px) scale(${1 + (sc - 1) * .25 + .05}) rotate(${lean}deg)`, opacity: 1, offset: .35 },
      { transform: `translate(${dx * .96}px,${dy * .96}px) scale(${sc * 1.04}) rotate(${-lean * .18}deg)`, opacity: .95, offset: .86 },
      { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(0deg)`, opacity: .9 }] };
  },
  // B: streaks along a curve, leaving a short trail
  comet: (dx, dy, sc, i, h) => {
    const len = Math.hypot(dx, dy) || 1, bow = Math.min(len * .28, h * 1.6) * (i % 2 ? 1 : -1);
    const px = -dy / len * bow, py = dx / len * bow;
    const pt = t => `translate(${dx * t + px * 4 * t * (1 - t)}px,${dy * t + py * 4 * t * (1 - t)}px)`;
    return { easing: 'cubic-bezier(.5,0,.25,1)', ghosts: 3, frames: [
      { transform: `${pt(0)} scale(1) rotate(0deg)`, opacity: 1 },
      { transform: `${pt(.3)} scale(${1 + (sc - 1) * .3}) rotate(${bow > 0 ? 8 : -8}deg)`, opacity: 1, offset: .3 },
      { transform: `${pt(.65)} scale(${1 + (sc - 1) * .65}) rotate(${bow > 0 ? 4 : -4}deg)`, opacity: 1, offset: .62 },
      { transform: `${pt(1)} scale(${sc}) rotate(0deg)`, opacity: .9 }] };
  },
  // C: pops up, then drops into its slot with a bounce
  pinball: (dx, dy, sc, i, h) => {
    const up = -h * .55;
    return { easing: 'linear', frames: [
      { transform: 'translate(0,0) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.8,.4,1)' },
      { transform: `translate(${dx * .2}px,${up}px) scale(${1.12})`, opacity: 1, offset: .3, easing: 'cubic-bezier(.55,0,.85,.4)' },
      { transform: `translate(${dx}px,${dy + h * sc * .12}px) scale(${sc * 1.04},${sc * .92})`, opacity: .95, offset: .74, easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: `translate(${dx}px,${dy - h * sc * .07}px) scale(${sc})`, opacity: .92, offset: .87, easing: 'ease-in' },
      { transform: `translate(${dx}px,${dy}px) scale(${sc})`, opacity: .9 }] };
  },
};
function cardFlyLook(dx, dy, sc, i, h, id) {
  const f = CARD_FLY_LOOKS[id || cardAnimChoice('fly')] || CARD_FLY_LOOKS.current;
  return document.body.classList.contains('reduced-motion') ? CARD_FLY_LOOKS.current(dx, dy, sc) : f(dx, dy, sc, i || 0, h || 75);
}
// The lab flies its cards through the game's own function.
const caFly = id => async ({ cards, slots }) => {
  cards.forEach((el, i) => {
    const s = slots[i]; if (!s) return;
    s.innerHTML = `<div class="${el.className.replace('ca-pick', '')}" style="position:relative;left:0;top:0">${el.innerHTML}</div>`;
    s.style.opacity = '0';
  });
  cards.forEach((el, i) => setTimeout(() => flyGridCardToSlot(el, slots[i], 460, i, id), i * 100));
  await caWait(cards.length * 100 + 900);
};
Object.keys(CARD_FLY_LOOKS).forEach(id => { CARD_ANIM_RUN.fly[id] = caFly(id); });

const caShrinkFade = async ({ cards }) => {
  await Promise.all(cards.map(el => caAnim(el, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.85' }],
    { duration: 180, easing: 'ease-in', fill: 'forwards' })));
};
CARD_ANIM_RUN.discard.current = caShrinkFade;
CARD_ANIM_RUN.cut.current = caShrinkFade;
CARD_ANIM_RUN.buff.current = async ({ cards }) => {
  await Promise.all(cards.map(el => caAnim(el, [
    { scale: '1', boxShadow: '0 0 0 0 #4aa3e000' },
    { scale: '1.08', boxShadow: '0 0 0 3px #4aa3e0, 0 0 16px #4aa3e0' },
    { scale: '1', boxShadow: '0 0 0 0 #4aa3e000' }], { duration: 450, easing: 'ease' })));
};
CARD_ANIM_RUN.boss.current = async () => { await caWait(300); };
CARD_ANIM_RUN.idle.current = async ({ cards }) => {
  for (const el of cards) { el.classList.add('selected'); await caWait(160); }
  await caWait(700);
  cards.forEach(el => el.classList.remove('selected'));
};

// ── The lab ──────────────────────────────────────────────────────────────────
const CA_ROWS = 4, CA_COLS = 5;
let _caLab = null, _caBusy = false;

function caMockCard(i) {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], suits = ['♠', '♥', '♦', '♣'];
  return { rank: ranks[(i * 5 + 3) % 13], suit: suits[(i * 3) % 4], _id: 'ca-mock-' + i };
}

function openCardAnimLab() {
  closeCardAnimLab();
  const lab = document.createElement('div');
  lab.id = 'ca-lab';
  lab.innerHTML = `
    <div id="ca-stage">
      <div id="ca-board"></div>
      <div id="ca-tray"><span>PREVIEW</span><div id="ca-slots"></div></div>
    </div>
    <div id="ca-panel">
      <div id="ca-head"><b>CARD ANIMATIONS</b><button id="ca-close" aria-label="Close">✕</button></div>
      <p class="ca-sub">Pick a look for each card movement and press Preview to play it on the mock board. Tap cards to choose which ones a preview uses. Swap: the first card you tap is the one picked first. Looks marked with a step are built in that step of the plan.</p>
      <div id="ca-rows"></div>
      <button id="ca-reset" class="ca-btn">Reset the board</button>
    </div>`;
  document.body.appendChild(lab);
  _caLab = lab;
  lab.querySelector('#ca-close').onclick = closeCardAnimLab;
  lab.querySelector('#ca-reset').onclick = () => caBuildBoard();
  const rows = lab.querySelector('#ca-rows');
  rows.innerHTML = CARD_ANIM_KINDS.map(k => `
    <div class="ca-row" data-k="${k.id}">
      <div class="ca-lbl">${k.label}<small>${k.note}</small></div>
      <select>${k.options.map(o => `<option value="${o.id}"${cardAnimRunner(k.id, o.id) ? '' : ' disabled'}>${o.name}${cardAnimRunner(k.id, o.id) ? '' : ` (step ${o.step})`}</option>`).join('')}</select>
      <button class="ca-btn ca-play">Preview</button>
      <div class="ca-desc"></div>
    </div>`).join('');
  rows.querySelectorAll('.ca-row').forEach(row => {
    const kind = CARD_ANIM_KINDS.find(k => k.id === row.dataset.k), sel = row.querySelector('select');
    sel.value = cardAnimChoice(kind.id);
    const desc = () => { const o = kind.options.find(o => o.id === sel.value); row.querySelector('.ca-desc').textContent = (o && o.desc) || ''; };
    sel.onchange = () => { setCardAnimChoice(kind.id, sel.value); desc(); };
    desc();
    row.querySelector('.ca-play').onclick = () => caPreview(kind.id, sel.value);
  });
  caBuildBoard();
}

function closeCardAnimLab() { if (_caLab) { _caLab.remove(); _caLab = null; } _caBusy = false; }

function caBuildBoard() {
  if (!_caLab) return;
  const board = _caLab.querySelector('#ca-board');
  board.innerHTML = '';
  const cw = parseFloat(getComputedStyle(board).getPropertyValue('--card-w')) || 64;
  const ch = parseFloat(getComputedStyle(board).getPropertyValue('--card-h')) || 86;
  const gap = 8;
  board.style.width = (CA_COLS * cw + (CA_COLS - 1) * gap) + 'px';
  board.style.height = (CA_ROWS * ch + (CA_ROWS - 1) * gap) + 'px';
  for (let r = 0; r < CA_ROWS; r++) for (let c = 0; c < CA_COLS; c++) {
    const card = caMockCard(r * CA_COLS + c);
    let look = { className: 'card', innerHTML: `<div class="rank">${card.rank}</div><div class="suit">${card.suit}</div>` };
    try { look = renderCardAppearance(card, r, c, { revealFog: true }); } catch (e) {}
    const el = document.createElement('div');
    el.className = look.className; el.innerHTML = look.innerHTML;
    el.dataset.r = r; el.dataset.c = c;
    el.style.left = (c * (cw + gap)) + 'px'; el.style.top = (r * (ch + gap)) + 'px';
    el.onclick = () => { if (!_caBusy) el.classList.toggle('ca-pick'); };
    board.appendChild(el);
  }
  const slots = _caLab.querySelector('#ca-slots');
  slots.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
}

function caCell(r, c) { return _caLab && _caLab.querySelector(`#ca-board [data-r="${r}"][data-c="${c}"]`); }

// Which cards a preview uses: the ones you tapped, or a sensible default.
function caTargets(kind) {
  const picked = [..._caLab.querySelectorAll('#ca-board .ca-pick')];
  if (kind === 'swap') {
    if (picked.length >= 2) return { a: picked[0], b: picked[1] };
    return { a: caCell(1, 1), b: caCell(1, 2) };
  }
  const cards = picked.length ? picked : (kind === 'fly' ? [caCell(2, 1), caCell(2, 2), caCell(2, 3)] : [caCell(1, 2), caCell(2, 2)]);
  return { cards, slots: [..._caLab.querySelectorAll('#ca-slots i')] };
}

async function caPreview(kind, id) {
  const run = cardAnimRunner(kind, id);
  if (!_caLab || _caBusy || !run) return;
  _caBusy = true;
  const ctx = caTargets(kind);
  _caLab.querySelectorAll('#ca-board .ca-pick').forEach(el => el.classList.remove('ca-pick'));
  if (kind === 'swap' && ctx.a && ctx.b) {
    // exactly what the game does: swap the cells first, then animate from the old ones
    const al = parseFloat(ctx.a.style.left), at = parseFloat(ctx.a.style.top);
    const bl = parseFloat(ctx.b.style.left), bt = parseFloat(ctx.b.style.top);
    ctx.a.style.left = bl + 'px'; ctx.a.style.top = bt + 'px';
    ctx.b.style.left = al + 'px'; ctx.b.style.top = at + 'px';
    ctx.dx = bl - al; ctx.dy = bt - at;
  }
  try { await run(Object.assign({ board: _caLab.querySelector('#ca-board'), lab: true }, ctx)); } catch (e) { console.warn(e); }
  await caWait(350);
  _caBusy = false;
  caBuildBoard();
}
