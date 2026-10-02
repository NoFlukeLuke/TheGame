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
CARD_ANIM_RUN.swap.current = async ({ a, b }) => {
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), k = ra.width / a.offsetWidth || 1;
  const dx = (rb.left - ra.left) / k, dy = (rb.top - ra.top) / k;
  await Promise.all([
    caAnim(a, [{ translate: '0 0' }, { translate: `${dx}px ${dy}px` }], { duration: 220, easing: 'ease-out' }),
    caAnim(b, [{ translate: '0 0' }, { translate: `${-dx}px ${-dy}px` }], { duration: 220, easing: 'ease-out' }),
  ]);
};
CARD_ANIM_RUN.fly.current = async ({ cards, slots }) => {
  await Promise.all(cards.map((el, i) => {
    const r = el.getBoundingClientRect(), t = slots[i].getBoundingClientRect(), k = r.width / el.offsetWidth || 1;
    const dx = (t.left + t.width / 2 - r.left - r.width / 2) / k, dy = (t.top + t.height / 2 - r.top - r.height / 2) / k;
    const sc = t.width / r.width;
    return caWait(i * 100).then(() => caAnim(el, [{ translate: '0 0', scale: '1' }, { translate: `${dx}px ${dy}px`, scale: String(sc) }],
      { duration: 460, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }));
  }));
};
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
      <p class="ca-sub">Pick a look for each card movement and press Preview to play it on the mock board. Tap cards to choose which ones a preview uses. Looks marked with a step are built in that step of the plan.</p>
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
  try { await run(Object.assign({ board: _caLab.querySelector('#ca-board'), lab: true }, ctx)); } catch (e) { console.warn(e); }
  await caWait(350);
  _caBusy = false;
  caBuildBoard();
}
