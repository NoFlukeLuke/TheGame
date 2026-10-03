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
      { id: 'leapfrog', name: 'A · Leapfrog', step: 4, desc: 'The first card you picked lifts and arcs over the other, which ducks under it; both snap past and settle.' },
      { id: 'rubber',   name: 'B · Rubber band', step: 4, desc: 'Both stretch toward each other, snap across and wobble to rest.' },
      { id: 'shove',    name: 'C · Shove', step: 4, desc: 'The first card barges across and knocks the other into its old cell.' },
    ] },
  { id: 'fly', label: 'Fly to preview', note: 'A played hand leaves the board for the preview tray.',
    options: [
      { id: 'current', name: 'Current: straight flight' },
      { id: 'lean',    name: 'A · Lean in', step: 5, desc: 'Each card tilts into its flight and straightens as it lands.' },
      { id: 'comet',   name: 'B · Comet', step: 5, desc: 'Cards streak along a curve with a short trail.' },
      { id: 'pinball', name: 'C · Pinball', step: 5, desc: 'Cards pop up, then drop into their slots with a bounce. Takes a fifth longer.' },
    ] },
  { id: 'discard', label: 'Discard', note: 'Cards you throw away.',
    options: [
      { id: 'current', name: 'Current: shrink and fade' },
      { id: 'toss',    name: 'A · Toss', step: 6, desc: 'Flicked off the board with a spin.' },
      { id: 'crumple', name: 'B · Crumple', step: 6, desc: 'Squashed into a ball that drops away.' },
      { id: 'sink',    name: 'C · Sink', step: 6, desc: 'Tips onto one corner and sinks into the table with a slight spin; the cards above fall in over it.' },
    ] },
  { id: 'cut', label: 'Cut from deck', note: 'A card removed from the run for good.',
    options: [
      { id: 'current', name: 'Current: shrink and fade' },
      { id: 'burn',  name: 'A · Burn', step: 6, desc: 'An edge catches and burns across the card.' },
      { id: 'snip',  name: 'B · Snip', step: 6, desc: 'Cut in two along a diagonal; the halves sink into the board.' },
      { id: 'deep',  name: 'C · Deep fall', step: 6, desc: 'Drops through the board into the dark, shrinking.' },
    ] },
  { id: 'buff', label: 'Buff lands', note: 'A card gains a permanent bonus.',
    options: [
      { id: 'current', name: 'Current: ring pulse' },
      { id: 'stamp',  name: 'A · Stamp', step: 6, desc: 'Pressed down like a rubber stamp; a ring in the buff\'s colour spreads out.' },
      { id: 'charge', name: 'B · Charge', step: 6, desc: 'Fills with light from the bottom, then flares.' },
      { id: 'flip',   name: 'C · Flip', step: 6, desc: 'Flips over and back, new and improved.' },
    ] },
  { id: 'boss', label: 'Boss effect on a card', note: 'A boss holds, marks or blocks a card.',
    options: [
      { id: 'current',  name: 'Current: none' },
      { id: 'shackle',  name: 'A · Shackle', step: 6, desc: 'A chain wraps the card and pulls tight.' },
      { id: 'static',   name: 'B · Static', step: 6, desc: 'TV static rolls over the card, which loses its colour and splits.' },
      { id: 'pressed',  name: 'C · Pressed', step: 6, desc: 'Squashed flat into the board.' },
    ] },
  { id: 'idle', label: 'Select and idle', note: 'Picking a card, and the board at rest.',
    options: [
      { id: 'current', name: 'Current: lift' },
      { id: 'ripple',    name: 'A · Ripple', step: 7, desc: 'Selecting sends a small wave through the cards around it.' },
      { id: 'gaze',      name: 'B · Gaze', step: 7, desc: 'Cards lean toward the pointer (tilting the phone on mobile).' },
      { id: 'attention', name: 'C · Attention', step: 7, desc: 'Selected cards hover and sway; the rest settle back.' },
      { id: 'watch',     name: 'D · Watch', step: 7, desc: 'Attention, and the other cards turn to look at the newest selected card (at the pointer when nothing is selected).' },
    ] },
];

const CARD_ANIM_KEY = 'lethe.cardAnims.v1';
let _cardAnimPick = (() => { try { return JSON.parse(localStorage.getItem(CARD_ANIM_KEY)) || {}; } catch (e) { return {}; } })();

// The owner's picks (r468). The store holds only choices that differ from these.
const CARD_ANIM_DEFAULT = { swap: 'leapfrog', fly: 'pinball', discard: 'sink', cut: 'snip', buff: 'stamp', boss: 'static', idle: 'watch' };
// Which look a kind uses. A look that is not built yet reads as 'current'.
function cardAnimChoice(kind) {
  const id = _cardAnimPick[kind] || CARD_ANIM_DEFAULT[kind] || 'current';
  return cardAnimRunner(kind, id) ? id : 'current';
}
function setCardAnimChoice(kind, id) {
  if (id === (CARD_ANIM_DEFAULT[kind] || 'current')) delete _cardAnimPick[kind]; else _cardAnimPick[kind] = id;
  if (kind === 'idle') setTimeout(() => { try { cardAnimApplyIdle(); } catch (e) {} });
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

// ── SWAP (step 4) ───────────────────────────────────────────────────────────
// Runners are FLIP-shaped, exactly as the game does a swap: the data and the DOM
// have ALREADY swapped, so `a` (the card picked first) sits in its new cell and
// is animated FROM its old one. dx/dy is how far `a` travelled, in design px; `b`
// travelled the opposite way. Only the standalone translate/scale/rotate/filter
// properties move, so the heartbeat's own transform keeps beating underneath.
const CARD_SWAP_MS = { current: 220, leapfrog: 418, rubber: 400, shove: 360 };
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
// A: the first card lifts and arcs over; the other ducks under it. Both land a
// little past their cell and snap back (the shove's snap).
CARD_ANIM_RUN.swap.leapfrog = async ({ a, b, dx, dy }) => {
  const g = caSwapGeom(a, dx, dy), arc = (g.horiz ? g.h : g.w) * 0.55, dur = CARD_SWAP_MS.leapfrog;
  const lean = (g.horiz ? g.sx : g.sy) * 9;
  await Promise.all([
    caLift(a, dur, () => caAnim(a, [
      { translate: caT(-dx, -dy), scale: '1', rotate: '0deg', filter: 'brightness(1)' },
      { translate: caT(-dx * .5 + g.px * arc, -dy * .5 + g.py * arc), scale: '1.22', rotate: `${lean}deg`, filter: 'brightness(1.08) drop-shadow(0 10px 8px rgba(0,0,0,.45))', offset: .45 },
      { translate: caT(dx * .07, dy * .07), scale: '0.96', rotate: `${-lean * .4}deg`, filter: 'brightness(1)', offset: .72 },
      { translate: caT(-dx * .02, -dy * .02), scale: '1.01', rotate: `${lean * .12}deg`, filter: 'brightness(1)', offset: .88 },
      { translate: '0px 0px', scale: '1', rotate: '0deg', filter: 'brightness(1)' }],
      { duration: dur, easing: 'cubic-bezier(.3,.6,.35,1)' })),
    caAnim(b, [
      { translate: caT(dx, dy), scale: '1', rotate: '0deg', filter: 'brightness(1)' },
      { translate: caT(dx * .55, dy * .55), scale: '.86', rotate: '0deg', filter: 'brightness(.72)', offset: .45 },
      { translate: caT(-dx * .08, -dy * .08), scale: '1', rotate: `${-lean * .5}deg`, filter: 'brightness(1)', offset: .74 },
      { translate: caT(dx * .02, dy * .02), scale: '1', rotate: `${lean * .15}deg`, filter: 'brightness(1)', offset: .89 },
      { translate: '0px 0px', scale: '1', rotate: '0deg', filter: 'brightness(1)' }],
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
// A look may take longer than the dance's own flight (pinball: a fifth longer).
// The dance multiplies its flight by this, so its beats wait for the landing.
const CARD_FLY_MUL = { pinball: 1.2 };
function cardFlyMs(ms, id) { return caReduced() ? ms : ms * (CARD_FLY_MUL[id || cardAnimChoice('fly')] || 1); }
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
  cards.forEach((el, i) => setTimeout(() => flyGridCardToSlot(el, slots[i], cardFlyMs(460, id), i, id), i * 100));
  await caWait(cards.length * 100 + cardFlyMs(460, id) + 440);
};
Object.keys(CARD_FLY_LOOKS).forEach(id => { CARD_ANIM_RUN.fly[id] = caFly(id); });

// ── DISCARD and CUT (step 6) ────────────────────────────────────────────────
// Exits: the element is about to be removed, so the end state is KEPT (no cancel).
// ctx.cards are the elements; ctx.target is a viewport rect to aim at (the DISCARD
// button in the game), or null.
const caKeep = (el, frames, opts) => new Promise(res => {
  if (!el || !el.animate) return res();
  const a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
  a.onfinish = res; a.oncancel = res; setTimeout(res, (opts.duration || 300) + (opts.delay || 0) + 80);
});
const caK = el => { const r = el.getBoundingClientRect(); return (r.width / (el.offsetWidth || 1)) || 1; };
function caAim(el, target) {
  const r = el.getBoundingClientRect(), k = caK(el);
  if (!target) return { dx: 0, dy: el.offsetHeight * 1.2, k };
  return { dx: (target.left + target.width / 2 - r.left - r.width / 2) / k, dy: (target.top + target.height / 2 - r.top - r.height / 2) / k, k };
}
const caZ = el => { el.style.zIndex = '20'; };
const caRnd = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());
const CARD_EXIT_MS = { discard: { current: 280, toss: 440, crumple: 480, sink: 200 }, cut: { current: 280, burn: 620, snip: 600, deep: 520 } };
// Sink (r468): the board waits only CARD_EXIT_MS for it. The card itself is a
// stand-in copy that keeps sinking for CA_SINK_MS while the cards above fall in
// over it, so it is drawn under its neighbours and carries no card id.
const CA_SINK_MS = 1000;
const CA_STRIP = /^(selected|hand-|swap-pending|unreachable|flowr-|ca-pick|tray-)/;
function caStandIn(el, clip) {
  const c = el.cloneNode(true);
  [...c.classList].forEach(k => { if (CA_STRIP.test(k)) c.classList.remove(k); });
  c.removeAttribute('data-card-id'); c.classList.add('ca-standin');
  c.style.transition = 'none'; c.style.zIndex = '0'; c.style.opacity = '1'; c.style.boxShadow = 'none';
  if (clip) c.style.clipPath = clip;
  el.parentNode.insertBefore(c, el.parentNode.firstChild);   // first child: every card paints over it
  return c;
}
// Tips toward one corner (a 3D tilt about the card's diagonal), spins at most 60
// degrees and sinks, dimming only a little.
function caSinkInto(c, side, ms, delay, drift) {
  const spin = side * (36 + caRnd() * 22), tilt = d => `perspective(420px) rotate3d(1, ${-side}, 0, ${d}deg)`;
  const ox = (drift || 0);
  const a = c.animate([
    { transform: tilt(0),  rotate: '0deg', scale: '1', translate: caT(0, 0), filter: 'brightness(1)', opacity: 1 },
    { transform: tilt(20), rotate: `${spin * .22}deg`, scale: '.93', translate: caT(ox * .4 + side * 2, 3), filter: 'brightness(.93)', opacity: 1, offset: .3 },
    { transform: tilt(46), rotate: `${spin * .65}deg`, scale: '.74', translate: caT(ox * .8 + side * 5, 9), filter: 'brightness(.8)', opacity: .9, offset: .7 },
    { transform: tilt(62), rotate: `${spin}deg`, scale: '.5', translate: caT(ox + side * 8, 14), filter: 'brightness(.65)', opacity: 0 }],
    { duration: ms, delay: delay || 0, easing: 'cubic-bezier(.45,.05,.7,.9)', fill: 'forwards' });
  return new Promise(res => { const end = () => { c.remove(); res(); }; a.onfinish = end; a.oncancel = end; setTimeout(end, ms + (delay || 0) + 120); });
}

CARD_ANIM_RUN.discard.current = async ({ cards, target }) => {
  await Promise.all(cards.map(el => { caZ(el); const { dx, dy } = caAim(el, target);
    return caKeep(el, [{ translate: '0px 0px', scale: '1', opacity: 1 }, { translate: caT(dx, dy), scale: '.3', opacity: 0 }],
      { duration: 280, easing: 'cubic-bezier(0.4,0,1,1)' }); }));
};
// A: flicked off the board with a spin, arcing toward the discard pile
CARD_ANIM_RUN.discard.toss = async ({ cards, target }) => {
  await Promise.all(cards.map((el, i) => { caZ(el); const { dx, dy } = caAim(el, target), h = el.offsetHeight;
    const spin = (dx >= 0 ? 1 : -1) * (300 + caRnd() * 200);
    return caKeep(el, [
      { translate: '0px 0px', rotate: '0deg', scale: '1', opacity: 1 },
      { translate: caT(dx * .35, dy * .35 - h * .9), rotate: `${spin * .4}deg`, scale: '.9', opacity: 1, offset: .4 },
      { translate: caT(dx, dy), rotate: `${spin}deg`, scale: '.35', opacity: 0 }],
      { duration: CARD_EXIT_MS.discard.toss, delay: i * 40, easing: 'cubic-bezier(.3,.5,.6,1)' }); }));
};
// B: squashed into a ball that drops away
CARD_ANIM_RUN.discard.crumple = async ({ cards }) => {
  await Promise.all(cards.map((el, i) => { caZ(el); const h = el.offsetHeight;
    return caKeep(el, [
      { scale: '1 1', rotate: '0deg', borderRadius: '5px', filter: 'brightness(1)', translate: '0px 0px', opacity: 1 },
      { scale: '.78 .62', rotate: '8deg', borderRadius: '18px', filter: 'brightness(.85) contrast(1.2)', translate: '0px 0px', opacity: 1, offset: .3 },
      { scale: '.42 .44', rotate: '-14deg', borderRadius: '50%', filter: 'brightness(.7) contrast(1.3)', translate: '0px 0px', opacity: 1, offset: .55 },
      { scale: '.34 .34', rotate: '40deg', borderRadius: '50%', filter: 'brightness(.6)', translate: caT(0, h * 1.3), opacity: 0 }],
      { duration: CARD_EXIT_MS.discard.crumple, delay: i * 40, easing: 'cubic-bezier(.4,0,.7,1)' }); }));
};
// C: tips onto a corner and sinks into the table; the cards above fall in over it
CARD_ANIM_RUN.discard.sink = async ({ cards, lab }) => {
  const done = cards.map((el, i) => {
    if (!el.parentNode) return Promise.resolve();
    const c = caStandIn(el); el.style.opacity = '0';
    return caSinkInto(c, caRnd() < .5 ? -1 : 1, CA_SINK_MS, i * 40);
  });
  await (lab ? Promise.all(done) : caWait(CARD_EXIT_MS.discard.sink + (cards.length - 1) * 40));
};

CARD_ANIM_RUN.cut.current = async ({ cards }) => {
  await Promise.all(cards.map(el => caKeep(el, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.85' }], { duration: 280, easing: 'ease-in' })));
};
// A: an edge catches and burns across the card
CARD_ANIM_RUN.cut.burn = async ({ cards }) => {
  await Promise.all(cards.map(el => {
    caZ(el);
    const fire = document.createElement('div'); fire.className = 'ca-burn'; el.appendChild(fire);
    const d = CARD_EXIT_MS.cut.burn;
    caKeep(fire, [{ '--ca-burn': '0%' }, { '--ca-burn': '115%' }], { duration: d * .8, easing: 'ease-in' });
    return caKeep(el, [
      { filter: 'sepia(0) brightness(1)', scale: '1', opacity: 1 },
      { filter: 'sepia(.8) brightness(.7)', scale: '.97', opacity: 1, offset: .6 },
      { filter: 'sepia(1) brightness(.15)', scale: '.9', opacity: 0 }], { duration: d, easing: 'ease-in' });
  }));
};
// B: cut in two along a diagonal; the halves part and sink into the board, as a discard does
CARD_ANIM_RUN.cut.snip = async ({ cards }) => {
  await Promise.all(cards.map(el => {
    const parent = el.parentNode; if (!parent) return Promise.resolve();
    const line = document.createElement('div'); line.className = 'ca-snipline';
    line.style.left = el.style.left; line.style.top = el.style.top; line.style.width = el.offsetWidth + 'px'; line.style.height = el.offsetHeight + 'px';
    parent.appendChild(line); setTimeout(() => line.remove(), 260);
    return caWait(150).then(() => {
      if (!el.parentNode) return;
      const h1 = caStandIn(el, 'polygon(0 0,100% 0,0 100%)'), h2 = caStandIn(el, 'polygon(100% 0,100% 100%,0 100%)');
      el.style.opacity = '0';
      return Promise.all([caSinkInto(h1, -1, 900, 0, -6), caSinkInto(h2, 1, 900, 40, 6)]);
    });
  }));
};
// C: drops through the board into the dark, shrinking
CARD_ANIM_RUN.cut.deep = async ({ cards }) => {
  await Promise.all(cards.map(el => { caZ(el); return caKeep(el, [
    { scale: '1', rotate: '0deg', translate: '0px 0px', filter: 'brightness(1)', opacity: 1 },
    { scale: '1.06', rotate: '0deg', translate: '0px -4px', filter: 'brightness(1.05)', opacity: 1, offset: .15 },
    { scale: '.16', rotate: `${caRnd() < .5 ? -1 : 1}${18 + caRnd() * 20}deg`, translate: '0px 10px', filter: 'brightness(0)', opacity: 0 }],
    { duration: CARD_EXIT_MS.cut.deep, easing: 'cubic-bezier(.55,0,.9,.5)' }); }));
};

// ── BUFF and BOSS (step 6) ──────────────────────────────────────────────────
// Entrances on a card that stays: everything returns to rest (caAnim cancels).
const caOverlay = (el, cls, ms) => { const o = document.createElement('div'); o.className = cls; el.appendChild(o); setTimeout(() => o.remove(), ms + 60); return o; };

CARD_ANIM_RUN.buff.current = async ({ cards }) => {
  await Promise.all(cards.map(el => caAnim(el, [
    { scale: '1', boxShadow: '0 0 0 0 #4aa3e000' },
    { scale: '1.08', boxShadow: '0 0 0 3px #4aa3e0, 0 0 16px #4aa3e0' },
    { scale: '1', boxShadow: '0 0 0 0 #4aa3e000' }], { duration: 450, easing: 'ease' })));
};
// A: pressed down like a rubber stamp; a ring in the buff's colour spreads out
// (ctx.color, from caBuffColor; the lab gives each card a different family).
const CA_BUFF_COLORS = { pips: '#5b8fe8', mult: '#e5503f', time: '#f4ead2', replay: '#3fcf8a', coin: '#e8c25a', focus: '#b48cff', minus: '#8f877a' };
function caBuffColor(e) {
  e = e || {};
  if (e.subpips) return CA_BUFF_COLORS.minus;
  if (e.mult || e.growMult || e.xmult) return CA_BUFF_COLORS.mult;
  if (e.pips || e.growPips || e.xpips) return CA_BUFF_COLORS.pips;
  if (e.retrig) return CA_BUFF_COLORS.replay;
  if (e.time) return CA_BUFF_COLORS.time;
  if (e.coin) return CA_BUFF_COLORS.coin;
  if (e.focus) return CA_BUFF_COLORS.focus;
  return '#ffe9a8';
}
const CA_STAMP_MS = 552;
CARD_ANIM_RUN.buff.stamp = async ({ cards, color, lab }) => {
  const cols = Object.values(CA_BUFF_COLORS);
  await Promise.all(cards.map((el, i) => caWait(i * 84).then(() => {
    setTimeout(() => {
      const ring = caOverlay(el, 'ca-stampring', 900);
      ring.style.setProperty('--ca-ring', lab ? cols[i % cols.length] : (color || '#ffe9a8'));
    }, CA_STAMP_MS * .5);
    try { sfxCardSelect?.(); } catch (e) {}
    return caAnim(el, [
      { scale: '1', translate: '0px 0px', filter: 'brightness(1)' },
      { scale: '1.14', translate: '0px -6px', filter: 'brightness(1.1)', offset: .35 },
      { scale: '.93', translate: '0px 1px', filter: 'brightness(1.25)', offset: .55 },
      { scale: '1.02', translate: '0px 0px', filter: 'brightness(1.05)', offset: .78 },
      { scale: '1', translate: '0px 0px', filter: 'brightness(1)' }], { duration: CA_STAMP_MS, easing: 'cubic-bezier(.4,0,.3,1)' });
  })));
  await caWait(500);
};
// B: fills with light from the bottom, then flares
CARD_ANIM_RUN.buff.charge = async ({ cards }) => {
  await Promise.all(cards.map((el, i) => caWait(i * 70).then(() => {
    const o = caOverlay(el, 'ca-charge', 640);
    caAnim(o, [{ clipPath: 'inset(100% 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: .6 }, { clipPath: 'inset(0 0 0 0)', opacity: 0 }], { duration: 640, easing: 'ease-in-out' });
    return caAnim(el, [
      { filter: 'brightness(1)', scale: '1' },
      { filter: 'brightness(1.05)', scale: '1', offset: .55 },
      { filter: 'brightness(1.6) drop-shadow(0 0 10px #ffe9a8)', scale: '1.07', offset: .7 },
      { filter: 'brightness(1)', scale: '1' }], { duration: 640, easing: 'ease' });
  })));
};
// C: flips over and back
CARD_ANIM_RUN.buff.flip = async ({ cards }) => {
  await Promise.all(cards.map((el, i) => caWait(i * 70).then(() => caAnim(el, [
    { rotate: 'y 0deg', scale: '1', filter: 'brightness(1)' },
    { rotate: 'y 90deg', scale: '1.12', filter: 'brightness(.7)', offset: .3 },
    { rotate: 'y 270deg', scale: '1.12', filter: 'brightness(.7)', offset: .62 },
    { rotate: 'y 360deg', scale: '1', filter: 'brightness(1.25)', offset: .85 },
    { rotate: 'y 360deg', scale: '1', filter: 'brightness(1)' }], { duration: 560, easing: 'cubic-bezier(.4,0,.3,1)' }))));
};

CARD_ANIM_RUN.boss.current = async () => { await caWait(200); };
// A: a chain wraps the card and pulls tight
CARD_ANIM_RUN.boss.shackle = async ({ cards }) => {
  await Promise.all(cards.map(el => {
    const o = caOverlay(el, 'ca-chain', 900);
    caAnim(o, [{ scale: '0 1', opacity: 1 }, { scale: '1.08 1', opacity: 1, offset: .35 }, { scale: '1 1', opacity: 1, offset: .5 }, { scale: '1 1', opacity: 1, offset: .8 }, { scale: '1 1', opacity: 0 }], { duration: 900, easing: 'ease-out' });
    return caAnim(el, [
      { translate: '0px 0px', scale: '1' }, { translate: '0px 0px', scale: '1', offset: .35 },
      { translate: '-2px 0px', scale: '.95', offset: .42 }, { translate: '2px 0px', scale: '.95', offset: .5 },
      { translate: '-1px 0px', scale: '.96', offset: .58 }, { translate: '0px 0px', scale: '1' }], { duration: 900 });
  }));
};
// B: TV static. The noise is the channel change's own (ccNoise, js/channel-change.js),
// cycled a frame every 40ms with a rolling bar, while the card loses its colour and
// splits red / blue the way the channel change splits the picture.
const CA_STATIC_MS = 820;
CARD_ANIM_RUN.boss.static = async ({ cards }) => {
  const noise = typeof ccNoise === 'function' ? ccNoise() : [];
  await Promise.all(cards.map(el => {
    const o = caOverlay(el, 'ca-static', CA_STATIC_MS);
    o.innerHTML = '<i class="ca-roll"></i>';
    let f = 0;
    const tick = () => { if (!noise.length) return; o.style.backgroundImage = noise[f++ % noise.length]; o.style.backgroundPosition = `${(caRnd() * 90) | 0}px ${(caRnd() * 90) | 0}px`; };
    tick(); const iv = setInterval(tick, 40); setTimeout(() => clearInterval(iv), CA_STATIC_MS + 40);
    caAnim(o, [{ opacity: 0 }, { opacity: .92, offset: .1 }, { opacity: .85, offset: .55 }, { opacity: .45, offset: .8 }, { opacity: 0 }], { duration: CA_STATIC_MS, easing: 'linear' });
    const split = n => `grayscale(1) contrast(1.25) drop-shadow(${n}px 0 rgba(255,0,64,.6)) drop-shadow(${-n}px 0 rgba(0,190,255,.6))`;
    return caAnim(el, [
      { translate: '0px 0px', filter: 'grayscale(0) contrast(1)' },
      { translate: '3px 0px', filter: split(3), offset: .12 },
      { translate: '-4px 0px', filter: split(4), offset: .24 },
      { translate: '1px 0px', filter: split(2), offset: .4 },
      { translate: '-2px 0px', filter: split(3), offset: .55 },
      { translate: '0px 0px', filter: split(1), offset: .75 },
      { translate: '0px 0px', filter: 'grayscale(0) contrast(1)' }], { duration: CA_STATIC_MS, easing: 'steps(12)' });
  }));
};
// C: squashed flat into the board
CARD_ANIM_RUN.boss.pressed = async ({ cards }) => {
  await Promise.all(cards.map(el => caAnim(el, [
    { scale: '1 1', translate: '0px 0px', filter: 'brightness(1)' },
    { scale: '1.04 1.06', translate: '0px -3px', filter: 'brightness(1)', offset: .2 },
    { scale: '1.1 .78', translate: '0px 4px', filter: 'brightness(.6)', offset: .45 },
    { scale: '1.05 .86', translate: '0px 3px', filter: 'brightness(.7)', offset: .7 },
    { scale: '1 1', translate: '0px 0px', filter: 'brightness(1)' }], { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)' })));
};

// The game's calls. Each finds the chosen look and plays it on card elements.
const caReduced = () => document.body.classList.contains('reduced-motion');
function cardAnimExit(kind, els, target) {
  els = (els || []).filter(Boolean); if (!els.length) return Promise.resolve();
  const id = caReduced() ? 'current' : cardAnimChoice(kind);
  return cardAnimRunner(kind, id)({ cards: els, target }).catch(() => {});
}
function cardAnimOn(kind, els, opts) {
  els = (els || []).filter(e => e && e.isConnected); if (!els.length || caReduced()) return;
  const id = cardAnimChoice(kind); if (id === 'current') return;   // today's look is drawn by the caller
  cardAnimRunner(kind, id)(Object.assign({ cards: els }, opts)).catch(() => {});
}
// Board elements for card objects or ids (only cards drawn on #grid right now).
function cardAnimEls(cards) {
  const g = document.getElementById('grid'); if (!g) return [];
  return (cards || []).map(cd => cd && g.querySelector(`[data-card-id="${typeof cd === 'object' ? cd._id : cd}"]`)).filter(Boolean);
}

// ── SELECT and IDLE (step 7) ────────────────────────────────────────────────
// A: Ripple. Selecting a card sends a small wave through the cards around it.
function caRippleFrom(src, board) {
  if (!src || !board) return;
  const sr = src.getBoundingClientRect(), k = caK(src), w = src.offsetWidth;
  board.querySelectorAll('.card').forEach(el => {
    if (el === src) return;
    const r = el.getBoundingClientRect();
    const dx = (r.left + r.width / 2 - sr.left - sr.width / 2) / k, dy = (r.top + r.height / 2 - sr.top - sr.height / 2) / k;
    const dist = Math.hypot(dx, dy) / (w * 1.15); if (dist > 2.6) return;
    const push = 5 * (1 - dist / 2.8);
    caAnim(el, [{ translate: '0px 0px', scale: '1' }, { translate: caT(dx / (dist * w * 1.15 || 1) * push, dy / (dist * w * 1.15 || 1) * push), scale: String(1 + push * .006) }, { translate: '0px 0px', scale: '1' }],
      { duration: 360, delay: dist * 70, easing: 'ease-out' });
  });
}
CARD_ANIM_RUN.idle.current = async ({ cards }) => {
  for (const el of cards) { el.classList.add('selected'); await caWait(160); }
  await caWait(700); cards.forEach(el => el.classList.remove('selected'));
};
CARD_ANIM_RUN.idle.ripple = async ({ cards, board }) => {
  for (const el of cards) { el.classList.add('selected'); caRippleFrom(el, board); await caWait(380); }
  await caWait(500); cards.forEach(el => el.classList.remove('selected'));
};
// B: Gaze. Cards lean toward the pointer (the phone's tilt on mobile).
// D: Watch (r468) is Attention plus Gaze: the selected cards hover, and the rest
// look at the newest selected card instead of the pointer (the pointer again
// once nothing is selected). The selected cards themselves do not turn.
let _gazeBoard = null, _gazePt = null, _gazeRaf = 0, _gazeWatch = false;
function caGazeFocusEl(b) {
  if (!_gazeWatch) return null;
  if (b.id === 'grid') {
    const last = typeof selected !== 'undefined' && selected.length ? selected[selected.length - 1] : null;
    const cd = last && gridData[last[0]]?.[last[1]];
    return cd ? b.querySelector(`[data-card-id="${cd._id}"]`) : null;
  }
  return b._gazeFocus && b._gazeFocus.isConnected ? b._gazeFocus : null;
}
function caGazeFrame() {
  _gazeRaf = 0;
  const b = _gazeBoard; if (!b || !b.isConnected) return;
  const fe = caGazeFocusEl(b), fr = fe && fe.getBoundingClientRect();
  const pt = fr ? { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 } : _gazePt;
  b.querySelectorAll('.card').forEach(el => {
    if (!pt || el === fe || (_gazeWatch && el.classList.contains('selected')) || el.classList.contains('ca-standin')) { el.style.rotate = ''; return; }
    const r = el.getBoundingClientRect();
    const dx = pt.x - (r.left + r.width / 2), dy = pt.y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1, ang = Math.min(14, 2200 / (d + 120));
    el.style.rotate = `${(-dy / d).toFixed(3)} ${(dx / d).toFixed(3)} 0 ${ang.toFixed(1)}deg`;
  });
}
function caGazePoint(x, y) { _gazePt = x == null ? null : { x, y }; if (!_gazeRaf) _gazeRaf = requestAnimationFrame(caGazeFrame); }
function caGazeAttach(board, watch) {
  _gazeWatch = !!watch;
  if (_gazeBoard === board) { caGazePoint(_gazePt ? _gazePt.x : null, _gazePt ? _gazePt.y : null); return; }
  caGazeDetach();
  _gazeBoard = board; if (!board) return;
  board.classList.add('ca-gazing');
  board._gzMove = e => caGazePoint(e.clientX, e.clientY);
  board._gzLeave = () => caGazePoint(null);
  board.addEventListener('pointermove', board._gzMove);
  board.addEventListener('pointerleave', board._gzLeave);
  window.addEventListener('deviceorientation', caGazeTilt);
}
function caGazeDetach() {
  const b = _gazeBoard; _gazeBoard = null;
  window.removeEventListener('deviceorientation', caGazeTilt);
  if (!b) return;
  b.classList.remove('ca-gazing');
  b.removeEventListener('pointermove', b._gzMove); b.removeEventListener('pointerleave', b._gzLeave);
  b.querySelectorAll('.card').forEach(el => { el.style.rotate = ''; });
}
function caGazeTilt(e) {
  if (!_gazeBoard || e.gamma == null) return;
  const r = _gazeBoard.getBoundingClientRect();
  caGazePoint(r.left + r.width / 2 + Math.max(-1, Math.min(1, e.gamma / 30)) * r.width,
              r.top + r.height / 2 + Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * r.height);
}
CARD_ANIM_RUN.idle.gaze = async ({ board }) => {
  caGazeAttach(board);
  const r = board.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let t = 0; t <= 1; t += 1 / 60) {
    caGazePoint(cx + Math.cos(t * Math.PI * 2) * r.width * .6, cy + Math.sin(t * Math.PI * 2) * r.height * .6);
    await caWait(33);
  }
  caGazePoint(null); await caWait(60);
  if (board.id === 'ca-board') caGazeDetach(); else cardAnimApplyIdle();
};
// D: Watch. Attention on the selected cards, and the rest look at the newest one.
CARD_ANIM_RUN.idle.watch = async ({ cards, board }) => {
  const host = board.closest('#ca-lab') || document.body;
  host.classList.add('ca-idle-attention');
  caGazeAttach(board, true);
  for (const el of cards) { el.classList.add('selected'); board._gazeFocus = el; caGazePoint(null); await caWait(800); }
  await caWait(1200);
  cards.forEach(el => el.classList.remove('selected')); board._gazeFocus = null; caGazePoint(null);
  await caWait(250);
  if (host !== document.body) { host.classList.remove('ca-idle-attention'); caGazeDetach(); } else cardAnimApplyIdle();
};
// C: Attention. Selected cards hover and sway; the rest settle back.
CARD_ANIM_RUN.idle.attention = async ({ cards, board }) => {
  const host = board.closest('#ca-lab') || document.body;
  host.classList.add('ca-idle-attention');
  for (const el of cards) { el.classList.add('selected'); await caWait(200); }
  await caWait(1600); cards.forEach(el => el.classList.remove('selected'));
  if (host !== document.body) host.classList.remove('ca-idle-attention');
};

// The game's idle hooks: set once, and again whenever the choice changes.
function cardAnimApplyIdle() {
  const id = cardAnimChoice('idle'), g = document.getElementById('grid');
  document.body.classList.toggle('ca-idle-attention', (id === 'attention' || id === 'watch') && !caReduced());
  if ((id === 'gaze' || id === 'watch') && !caReduced() && g) caGazeAttach(g, id === 'watch'); else if (_gazeBoard && _gazeBoard.id === 'grid') caGazeDetach();
}
let _caLastSel = new Set();
// Called from the end of render(): a card newly selected sends the ripple.
function cardAnimAfterRender() {
  const g = document.getElementById('grid'); if (!g) return;
  const now = new Set((typeof selected !== 'undefined' ? selected : []).map(([r, c]) => r + '-' + c));
  if (cardAnimChoice('idle') === 'ripple' && !caReduced()) {
    now.forEach(k => { if (_caLastSel.has(k)) return;
      const [r, c] = k.split('-').map(Number), cd = gridData[r]?.[c];
      const el = cd && g.querySelector(`[data-card-id="${cd._id}"]`); if (el) caRippleFrom(el, g); });
  }
  _caLastSel = now;
  if (_gazeWatch && _gazeBoard === g) caGazePoint(_gazePt ? _gazePt.x : null, _gazePt ? _gazePt.y : null);   // Watch: turn to the newest pick
}
document.addEventListener('DOMContentLoaded', () => { try { cardAnimApplyIdle(); } catch (e) {} });

// ── The lab ──────────────────────────────────────────────────────────────────
const CA_ROWS = 4, CA_COLS = 5;
let _caLab = null, _caBusy = false, _caPickN = 0;

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

function closeCardAnimLab() { if (_caLab) { _caLab.remove(); _caLab = null; } _caBusy = false; try { cardAnimApplyIdle(); } catch (e) {} }   // a Gaze preview borrowed the gaze from #grid

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
    el.onclick = () => { if (!_caBusy) { el.classList.toggle('ca-pick'); el.dataset.pickN = ++_caPickN; } };
    board.appendChild(el);
  }
  const slots = _caLab.querySelector('#ca-slots');
  slots.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
}

function caCell(r, c) { return _caLab && _caLab.querySelector(`#ca-board [data-r="${r}"][data-c="${c}"]`); }

// Which cards a preview uses: the ones you tapped, or a sensible default.
function caTargets(kind) {
  const picked = [..._caLab.querySelectorAll('#ca-board .ca-pick')].sort((x, y) => x.dataset.pickN - y.dataset.pickN);   // tap order
  if (kind === 'swap') {
    if (picked.length >= 2) return { a: picked[0], b: picked[1] };
    return { a: caCell(1, 1), b: caCell(1, 2) };
  }
  const cards = picked.length ? picked : (kind === 'fly' ? [caCell(2, 1), caCell(2, 2), caCell(2, 3)] : [caCell(1, 2), caCell(2, 2)]);
  return { cards, slots: [..._caLab.querySelectorAll('#ca-slots i')], target: _caLab.querySelector('#ca-tray').getBoundingClientRect() };
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
