// ══════════════════════════════════════════════
// DEV PICKER (r234) - build the mode before you play it
// ══════════════════════════════════════════════
// Every other entry in MODES is a fixed combination of answers to the same few
// questions: which deck, what happens between rounds, how long a round is, does
// interacting cost time, are there bosses, who submits the hands, how is a hand
// priced. Classic answers them one way and Flow another, and the only way to try
// a combination nobody wrote down was to add a tenth mode.
//
// This asks the questions instead and SYNTHESIZES a MODES entry from the answers
// (pickerBuildMode). That is the whole design decision: everything downstream
// keeps reading the flags it already reads, so a custom run is not a special case
// anywhere outside this file.
//
// ── The rule this file exists to enforce ──
// An axis is only offered if it is a REAL CHOKEPOINT. A question the engine
// cannot actually honour is worse than no question, because the run then quietly
// plays as something other than what was picked. Where two axes are welded
// together in the engine (see pickerResolve) the picker FORCES the dependent one
// and says so on screen rather than pretending they are independent.

// ── The axes ────────────────────────────────────────────────────────────────
// `apply` is deliberately absent: an option is DATA, and pickerBuildMode reads
// the whole answer set at once. Options that only make sense together cannot be
// resolved one at a time (a no-clock run has nothing to charge interacts to), so
// there is no per-option apply step to get out of order.
const PICKER_AXES = [
  {
    id: 'deck', label: 'DECK', question: 'Which deck?',
    note: 'What the cards are. Everything else is built on this.',
    options: [
      { id: 'classic',  name: 'Four suits',  tag: '♠ ♥ ♦ ♣',
        desc: 'The standard 52. Aces, courts and the four suits, so every Trick in the game can turn up.' },
      { id: 'six',      name: 'Six suits',   tag: '♠ ♥ ♦ ♣ ★ ▲',
        desc: 'Two extra suits dilute the deck, so flushes are hard-won. Flush of 3 and Flush of 4 are playable from the start.' },
      { id: 'spectrum', name: 'Spectrum',    tag: '🔴 🟡 🔵 🟢 🟣 🟠 ⚫ ⚪',
        desc: 'No suits and no court. Seven colours and the values 0 to 11, plus a lone 15 and 20. The 9s, 10s and 11s are white and can never complete a flush. The 13 Tricks that need an Ace, a court card or a named suit are taken out of the pool.' },
    ],
  },
  {
    id: 'reward', label: 'BETWEEN ROUNDS', question: 'What happens after a round?',
    note: 'This also sets the shape of the run, because the two are the same decision in the engine.',
    options: [
      { id: 'grid',  name: 'Reward grid', tag: 'FOUR QUARTERS',
        desc: 'Payout, then a path across a board of buffs and penalties. Four quarters of five rounds and a boss, and the run ends when the last quarter closes.' },
      { id: 'slots', name: 'Eight slots', tag: 'FOUR QUARTERS',
        desc: 'A quarter is eight slots and then the boss. At each one you are dealt four things you could do with it: play a round, or buy a shop, a grid, an event or a free pick. Buying always costs a round you will not get to play.' },
      { id: 'pick3', name: 'Pick of three', tag: 'ENDLESS',
        desc: 'Clear the goal, take one of three rewards, face a bigger goal. No reward grid, no payout screen and no end: the run lasts until you miss one. The three reward-grid-only entities are kept out of the pool.' },
    ],
  },
  {
    id: 'clock', label: 'ROUND CLOCK', question: 'How long is a round?',
    note: 'The clock is what most of the timing entities read, so switching it off costs more than the pressure.',
    options: [
      { id: 'standard', name: '3:00',        tag: 'CLASSIC',  desc: 'The standard round. Miss the goal before it runs out and the run ends.' },
      { id: 'short',    name: '2:00',        tag: 'TIGHT',    desc: 'Survival\'s round. The same goals with a third less time to find them.' },
      { id: 'long',     name: '4:00',        tag: 'ROOMY',    desc: 'A minute more than standard. Slower boards and awkward hands stop being fatal.' },
      { id: 'none',     name: 'No limit',    tag: 'NO FAIL',  desc: 'The clock still runs, so everything that reads it still works, but reaching zero no longer ends the round. Nothing can fail you except a boss window. Interacting stops costing time, and the two entities that assume a refilling clock are kept out of the pool.' },
    ],
  },
  {
    id: 'timeCost', label: 'INTERACTING', question: 'Do swaps and discards cost time?',
    note: 'The counts cap them either way. This is only about the clock.',
    options: [
      { id: 'yes', name: 'Costs seconds', tag: '8s / 3s',
        desc: 'A swap bills 8 seconds and a discard 3 per card, off the round clock. Manipulating the board is a real trade against finding the hand.' },
      { id: 'no',  name: 'Free',          tag: '0s',
        desc: 'Swaps and discards cost nothing but the count. The clock is purely a deadline.' },
    ],
  },
  {
    id: 'bosses', label: 'BOSSES', question: 'Bosses?',
    note: '34 presets, dealt from a bag so none repeats inside a run.',
    options: [
      { id: 'yes', name: 'On',  tag: '34 PRESETS',
        desc: 'A boss closes every quarter, or arrives every five minutes of play in an endless run. Beating one pays a prize grid.' },
      { id: 'no',  name: 'Off', tag: 'NONE',
        desc: 'No boss rounds. A quarter still closes on its last round and still pays the prize grid, it is just an ordinary round that closes it.' },
    ],
  },
  {
    id: 'autoPlay', label: 'SUBMITTING', question: 'Who plays the hands?',
    note: 'A valid selection is submitted on a timer either way. This only sets how long that timer is.',
    options: [
      { id: 'you',  name: 'You do',     tag: '2.0s',
        desc: 'Select cards and press PLAY. A hand left sitting submits itself after two seconds, which is long enough to change your mind.' },
      { id: 'auto', name: 'Auto-submit', tag: '0.35s',
        desc: 'A valid hand fires almost as soon as it exists. Chaining, not deliberating - you are steering the board rather than choosing hands.' },
    ],
  },
  {
    id: 'scoring', label: 'HAND VALUES', question: 'What is a hand type worth?',
    note: 'The card pips you play are unchanged. This is only what the SHAPE is worth on top of them.',
    options: [
      { id: 'classic',    name: 'Pips and mult', tag: 'SHIPPED',
        desc: 'The priced ladder: every hand type carries its own base pips and its own mult, tuned against how often the shape actually turns up on a small grid.' },
      { id: 'mult_ladder', name: 'Mult only',    tag: 'NO BASE PIPS',
        desc: 'A hand type is worth its multiplier and nothing else. Every pip in the hand comes off the cards you played, so which cards you reach for matters more than which shape they make.' },
      { id: 'hand_size',  name: 'Card count',    tag: 'SIZE IS ALL',
        desc: 'No base pips, and the mult is simply how many cards you played. A seven-card hand is x7 whatever it is. Hand type stops being a price list and becomes only a Focus source.' },
    ],
  },
];

// The answers, by axis id. Defaults reproduce Classic exactly.
let pickerChoice = { deck:'classic', reward:'grid', clock:'standard', timeCost:'yes', bosses:'yes', autoPlay:'you', scoring:'classic' };
let pickerStep = 0;          // which axis is on screen; PICKER_AXES.length = the summary
let pickerForcedNotes = [];  // what pickerResolve had to override, for the UI to print

// ── Forced implications ─────────────────────────────────────────────────────
// Where the engine welds two axes together, the picker resolves it HERE, once,
// and records why. The alternative is offering a choice the run will not honour,
// which is the one thing this file must never do.
//
// Returns a CLEANED COPY - the player's own answers are never overwritten, so
// stepping back and changing the cause restores what they had picked.
function pickerResolve(c) {
  const out = { ...c };
  const notes = [];
  if (out.clock === 'none' && out.timeCost === 'yes') {
    // There is no deadline to bill against: the clock still ticks for the sake of
    // the entities that read it, but it cannot end the round, so a time charge is
    // a number with no consequence attached.
    out.timeCost = 'no';
    notes.push('With no round limit there is no deadline to bill against, so interacting is free.');
  }
  pickerForcedNotes = notes;
  return out;
}

// ── Synthesis ───────────────────────────────────────────────────────────────
// The flags below are the SAME ones the hand-written modes carry, and they are
// read by the same code. Anything that needed a new predicate got one that the
// shipped modes now route through too (survivalActive, flowActive, bossesEnabled,
// interactTimeCostsOn, roundClockEndsRound) - a custom run must not be a second
// implementation of a mode, or the two drift.
function pickerBuildMode(raw) {
  const c = pickerResolve(raw || pickerChoice);
  const spectrum = c.deck === 'spectrum';
  const pick3    = c.reward === 'pick3';
  return {
    id: 'custom',
    name: 'Custom',
    desc: pickerSummaryLine(c),
    // Kept on the mode so a save can rebuild it (js/save.js) and so the HUD and
    // the run history can say what was played.
    picker: { ...c },

    // ── Deck ──
    suitCount: spectrum ? 7 : (c.deck === 'six' ? 6 : 4),
    numeric: spectrum,

    // ── Between rounds, and the run shape that comes with it ──
    // survivalActive() is the pick-of-three loop AND the endless structure: they
    // are one package in the engine (30 call sites), which is exactly why the
    // picker asks about them as one question.
    actStructure: !pick3,
    guided: c.reward === 'slots',
    survival: pick3,
    winCondition: pick3 ? 'endless' : 'boss_defeat',

    // ── Clock ──
    clock: c.clock,                       // read by pickerRoundSeconds / roundClockEndsRound
    timeIsCurrency: c.timeCost === 'yes', // read by interactTimeCostsOn

    // ── The rest ──
    enableBosses: c.bosses === 'yes',     // read by bossesEnabled
    autoPlayHands: c.autoPlay === 'auto', // read by autoSubmitDelay
    scoringModel: c.scoring,              // installed by startGame
    enableShops: true,
    enableEvents: !pick3,
    autoRefillGrid: true,
  };
}

// How long a custom round is. Only ever consulted for a mode carrying a `clock`,
// so the shipped modes reach none of this.
const PICKER_CLOCK_SECONDS = { standard: 180, short: 120, long: 240, none: 600 };
function pickerRoundSeconds() {
  const k = (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.clock : null;
  return PICKER_CLOCK_SECONDS[k] || ROUND_DURATION;
}
// "This mode has no round clock." Flow is the shipped case; a custom run that
// answered 'no limit' is the other. Read by the round tick's end-of-round guard
// and by the entity ban list.
function modeHasNoRoundClock() {
  if (typeof flowActive === 'function' && flowActive()) return true;
  return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.clock === 'none');
}

function pickerActive() { return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.picker); }

// One line naming the combination, for the mode card, the HUD and run history.
function pickerSummaryLine(c) {
  c = c || pickerChoice;
  const deck = c.deck === 'spectrum' ? 'Spectrum' : c.deck === 'six' ? 'Six suits' : 'Four suits';
  const rew  = c.reward === 'pick3' ? 'pick of three' : c.reward === 'slots' ? 'eight slots' : 'reward grid';
  const bits = [deck, rew];
  if (c.clock !== 'standard') bits.push(c.clock === 'none' ? 'no clock' : PICKER_CLOCK_SECONDS[c.clock] / 60 + ':00 rounds');
  if (c.bosses === 'no') bits.push('no bosses');
  if (c.autoPlay === 'auto') bits.push('auto-submit');
  if (c.scoring !== 'classic') bits.push(c.scoring === 'hand_size' ? 'card-count scoring' : 'mult-only scoring');
  if (c.timeCost === 'no' && c.clock !== 'none') bits.push('free interacts');
  return bits.join(' · ');
}

// ══════════════════════════════════════════════
// THE SCREEN
// ══════════════════════════════════════════════
function openPickerMode() {
  pickerStep = 0;
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('picker-overlay')?.classList.add('show');
  renderPicker();
}
function closePickerMode() {
  document.getElementById('picker-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.add('show');
}

function pickerSet(axisId, optId) {
  pickerChoice[axisId] = optId;
  pickerResolve(pickerChoice);   // refresh the forced-note list for the footer
  renderPicker();
}
function pickerGo(d) {
  pickerStep = Math.max(0, Math.min(PICKER_AXES.length, pickerStep + d));
  renderPicker();
}

function renderPicker() {
  const body = document.getElementById('picker-body');
  const rail = document.getElementById('picker-rail');
  const foot = document.getElementById('picker-foot');
  if (!body) return;
  const resolved = pickerResolve(pickerChoice);
  const onSummary = pickerStep >= PICKER_AXES.length;

  // The rail is the readout AND the control: every answered axis is one step back.
  rail.innerHTML = PICKER_AXES.map((a, i) =>
    `<button class="pk-rail-step${i === pickerStep ? ' on' : ''}${i < pickerStep ? ' done' : ''}" data-step="${i}">` +
      `<span class="pk-rail-n">${i + 1}</span><span class="pk-rail-l">${a.label}</span></button>`
  ).join('') +
  `<button class="pk-rail-step${onSummary ? ' on' : ''}" data-step="${PICKER_AXES.length}">` +
    `<span class="pk-rail-n">✓</span><span class="pk-rail-l">START</span></button>`;
  rail.querySelectorAll('.pk-rail-step').forEach(b => {
    b.onclick = () => { pickerStep = parseInt(b.dataset.step, 10); renderPicker(); };
  });

  if (onSummary) {
    body.innerHTML = pickerSummaryHTML(resolved);
    body.querySelectorAll('.pk-srow').forEach(b => {
      b.onclick = () => { pickerStep = parseInt(b.dataset.step, 10); renderPicker(); };
    });
  }
  else {
    const ax = PICKER_AXES[pickerStep];
    body.innerHTML =
      `<div class="pk-q">${ax.question}</div>` +
      `<div class="pk-note">${ax.note}</div>` +
      `<div class="pk-opts">` + ax.options.map(o => {
        // The RESOLVED answer is what is shown as chosen, and a forced one says so
        // - otherwise the screen would show a tick against something the run is
        // not going to do.
        const on = resolved[ax.id] === o.id;
        const forced = on && pickerChoice[ax.id] !== o.id;
        return `<button class="pk-opt${on ? ' on' : ''}${forced ? ' forced' : ''}" data-opt="${o.id}">` +
          `<div class="pk-opt-head"><span class="pk-opt-name">${o.name}</span><span class="pk-opt-tag">${o.tag}</span></div>` +
          `<div class="pk-opt-desc">${o.desc}</div>` +
          (forced ? `<div class="pk-opt-forced">SET BY AN EARLIER ANSWER</div>` : '') +
        `</button>`;
      }).join('') + `</div>` +
      (pickerForcedNotes.length ? `<div class="pk-forced">${pickerForcedNotes.map(n => `<div>${n}</div>`).join('')}</div>` : '');
    body.querySelectorAll('.pk-opt').forEach(b => { b.onclick = () => pickerSet(ax.id, b.dataset.opt); });
  }
  body.scrollTop = 0;

  foot.innerHTML =
    `<button class="pk-btn pk-back">${pickerStep === 0 ? 'CANCEL' : 'BACK'}</button>` +
    `<div class="pk-sum">${pickerSummaryLine(resolved)}</div>` +
    `<button class="pk-btn pk-next${onSummary ? ' go' : ''}">${onSummary ? 'START RUN' : 'NEXT'}</button>`;
  foot.querySelector('.pk-back').onclick = () => { if (pickerStep === 0) closePickerMode(); else pickerGo(-1); };
  foot.querySelector('.pk-next').onclick = () => { if (onSummary) pickerStart(); else pickerGo(1); };
}

function pickerSummaryHTML(c) {
  // Each row is a BUTTON back to its own question - the line under the heading
  // says the rows are tappable, so they have to be. The handler is bound in
  // renderPicker, which is what rebuilds this markup.
  const rows = PICKER_AXES.map((a, i) => {
    const o = a.options.find(x => x.id === c[a.id]) || a.options[0];
    return `<button class="pk-srow" data-step="${i}"><span class="pk-sl">${a.label}</span><span class="pk-sv">${o.name}</span><span class="pk-st">${o.tag}</span></button>`;
  }).join('');
  return `<div class="pk-q">Your mode</div>` +
    `<div class="pk-note">Tap any line to change it. The tier is picked on the mode card.</div>` +
    `<div class="pk-summary">${rows}</div>` +
    (pickerForcedNotes.length ? `<div class="pk-forced">${pickerForcedNotes.map(n => `<div>${n}</div>`).join('')}</div>` : '');
}

function pickerStart() {
  // Registered in MODES under its own id so every `MODES[...]` lookup, the save's
  // mode field and the run history all resolve it the way they resolve any other
  // mode. Rebuilt on every start, so re-running the picker cannot leave the last
  // combination behind.
  MODES.custom = pickerBuildMode(pickerChoice);
  ACTIVE_MODE = MODES.custom;
  pendingDifficulty = (typeof difficultyForMode === 'function') ? difficultyForMode('custom') : 1;
  document.getElementById('picker-overlay')?.classList.remove('show');
  startGame();
}
