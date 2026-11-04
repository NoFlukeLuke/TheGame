// ══════════════════════════════════════════════════════════════════════════
// OVERTIME (r562, owner's design) - longer rounds, for two costs you pick between
// ══════════════════════════════════════════════════════════════════════════
// An event in every mode with events and a round clock. Taking it makes every
// round length the mode has OVERTIME_LEN_MULT longer for the rest of the run,
// boss rounds included (currentRoundDuration, triggerBoss). Then three costs are
// dealt from OVERTIME_COSTS, unseen until now: the player picks ONE TO AVOID and
// the other two apply for good. Skipping it silently puts a time Trick, Knack or
// Sleight into the next reward (reward grid or the Schedule's pick).
//
// overtimeRun is plain data in SAVE_VARS; every effect is read through a helper
// below, so a resumed run carries it and no site keeps its own copy.
let overtimeRun = { taken: false, costs: [], gift: false };
const OVERTIME_LEN_MULT  = 1.3;   // every round length, once taken
const OVERTIME_BOSS_GOAL = 1.25;  // 'boss_hard' (r590, owner): boss rounds need this much more score; their window keeps Overtime's length
const OVERTIME_QUOTA     = 1.15;  // 'quota': every future goal (never printed: "higher quotas")
const OVERTIME_PLAY_SECS = 5;     // 'play': each hand played costs this many seconds more
const OVERTIME_DISC_SECS = 2;     // 'discard': each discarded card costs this many seconds more
const OVERTIME_FADE      = 1.5;   // 'fade': Focus fades this many times as fast
const OVERTIME_LEFTOVER  = 0.25;  // 'leftover': the leftover-time line pays this share
const OVERTIME_INTEREST  = 0.5;   // 'interest': the interest cap is this share
const OVERTIME_MISS      = 0.5;   // 'clock_miss': chance a rewind or pause does not happen

const OVERTIME_COSTS = [
  { id: 'quota',      icon: '📈', name: 'Higher quotas',       desc: 'Every goal from now on is higher.',
    apply: () => { goalPenaltyMult *= OVERTIME_QUOTA; return 'higher quotas'; } },
  { id: 'play',       icon: '🐌', name: 'Slower hands',        desc: `Playing a hand costs ${OVERTIME_PLAY_SECS}s more.`,
    apply: () => { extraPlayCostPerm += OVERTIME_PLAY_SECS; playHandCostThisRound = extraPlayCostPerm + nextRoundPlayCost; return `hands +${OVERTIME_PLAY_SECS}s`; } },
  { id: 'discard',    icon: '🗑', name: 'Costlier discards',   desc: `Each discarded card costs ${OVERTIME_DISC_SECS}s more.`,
    apply: () => { extraDiscardCostPerm += OVERTIME_DISC_SECS; discardCostThisRound = extraDiscardCostPerm + nextRoundDiscardCost; return `discards +${OVERTIME_DISC_SECS}s a card`; } },
  { id: 'fade',       icon: '🌫', name: 'Restless Focus',      desc: `Focus fades ${OVERTIME_FADE}× as fast.`,
    apply: () => { if (typeof startFocusDecay === 'function' && typeof focusDecayTimerId !== 'undefined' && focusDecayTimerId) startFocusDecay(); return 'Focus fades faster'; } },
  { id: 'leftover',   icon: '⌛', name: 'Early finish docked', desc: `Leftover time pays ${Math.round((1 - OVERTIME_LEFTOVER) * 100)}% less.`,
    apply: () => 'leftover time pays less' },
  { id: 'interest',   icon: '🏦', name: 'Interest capped',     desc: `The interest cap is halved.`,
    apply: () => 'interest cap halved' },
  { id: 'boss_hard',  icon: '☠', name: 'Tough reviews',       desc: `Boss rounds need ${Math.round((OVERTIME_BOSS_GOAL - 1) * 100)}% more score.`,
    apply: () => 'boss rounds need more' },
  { id: 'clock_miss', icon: '🎲', name: 'Unreliable clock',    desc: `Rewinds and pauses have a ${Math.round(OVERTIME_MISS * 100)}% chance not to happen.`,
    apply: () => 'rewinds and pauses can miss' },
];

// ── The effects, one reader each ──
function otHas(id) { return !!(overtimeRun && overtimeRun.costs && overtimeRun.costs.includes(id)); }
// Every non-boss round length (currentRoundDuration).
function overtimeLenMult() { return overtimeRun && overtimeRun.taken ? OVERTIME_LEN_MULT : 1; }
// A boss round's window (triggerBoss): longer like every round. Its goal: raised by 'boss_hard'.
// (r590: 'boss_short' cut the window below its normal length while the reward made it longer.)
function overtimeBossMult() { return overtimeRun && overtimeRun.taken ? OVERTIME_LEN_MULT : 1; }
function overtimeBossGoalMult() { return otHas('boss_hard') ? OVERTIME_BOSS_GOAL : 1; }
function overtimeFocusFade()   { return otHas('fade') ? OVERTIME_FADE : 1; }                 // focusDecayIntervalNow
function overtimeLeftoverMult(){ return otHas('leftover') ? 1 / OVERTIME_LEFTOVER : 1; }    // seconds per credit
function overtimeInterestMult(){ return otHas('interest') ? OVERTIME_INTEREST : 1; }        // interestCap
function overtimeClockMisses() { return otHas('clock_miss') && Math.random() < OVERTIME_MISS; }  // rewindTime / pauseRound / Stopwatch

// Offered while it has not been taken and the mode's clock can end a round.
function overtimeOfferable() {
  if (overtimeRun && overtimeRun.taken) return false;
  return !(typeof modeHasNoRoundClock === 'function' && modeHasNoRoundClock());
}

// ── The event ──
// Phase 'offer': the time, and a note that it has a price. Confirm takes it.
// Phase 'cost': three costs, unseen until now; Skip is gone (it was taken). The
// tapped one is AVOIDED; Confirm applies the other two.
function renderOvertime() {
  const body = document.getElementById('event-body');
  eventState.phase = 'offer';
  body.appendChild(evLabel('ON THE CLOCK'));
  const pct = Math.round((OVERTIME_LEN_MULT - 1) * 100);
  const tile = makeChoiceEl({ icon: '⏳', name: 'Longer rounds',
    desc: `Every round from now on is ${pct}% longer, boss rounds included.`,
    onClick: () => { tile.classList.add('selected'); setEventConfirm(true); } });
  body.appendChild(tile);
  body.appendChild(evNote('Take it and three costs are dealt. You avoid one; the other two last the rest of the run.'));
}

function renderOvertimeCosts() {
  const body = document.getElementById('event-body');
  body.innerHTML = '';
  eventState.phase = 'cost';
  eventState.overtimeAvoid = null;
  eventState.overtimeCosts = evShuffle(OVERTIME_COSTS.slice()).slice(0, 3);
  setEventConfirm(false);
  const skip = document.getElementById('event-skip');
  if (skip) skip.style.display = 'none';
  body.appendChild(evLabel('PICK ONE TO AVOID', true));
  const els = [];
  eventState.overtimeCosts.forEach(c => {
    const el = makeChoiceEl({ icon: c.icon, name: c.name, desc: c.desc, cls: 'debuff',
      onClick: () => {
        els.forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        eventState.overtimeAvoid = c.id;
        setEventConfirm(true);
      } });
    els.push(el);
    body.appendChild(el);
  });
  body.appendChild(evNote('The other two apply for the rest of the run.'));
}

function confirmOvertime() {
  if (eventState.phase !== 'cost') { renderOvertimeCosts(); return; }
  if (!eventState.overtimeAvoid) return;
  const keep = (eventState.overtimeCosts || []).filter(c => c.id !== eventState.overtimeAvoid);
  overtimeRun = { taken: true, costs: keep.map(c => c.id), gift: false };
  const notes = keep.map(c => { try { return c.apply(); } catch (e) { return null; } }).filter(Boolean);
  // Deliberately NO render(): an event opens over a cleared board (on the Schedule
  // the grid holds map tiles), and every screen that follows repaints.
  noteMessage(`Overtime · rounds ${Math.round((OVERTIME_LEN_MULT - 1) * 100)}% longer · ${notes.join(' · ')}`, 'var(--gold)');
  closeEvent();
}

// Skipped: the next reward carries a time entity. Silent by design (owner).
function skipOvertime() { if (overtimeRun) overtimeRun.gift = true; }

// ── The gift: a time Trick, Knack or Sleight, through the rarity table ──
// Things that GIVE time (rewinds, pauses, round-start seconds). Ids, so a rename
// never drops one.
const OVERTIME_GIFT_IDS = {
  trick:   ['high_water', 'dam_holding', 'five_second', 'double_jeopardy', 'cuckoo', 'right_time', 'deluge',
            'overtime', 'magpie', 'vulture', 'wait_four_it'],
  knack:   ['rain_check', 'time_bank', 'carry_time', 'long_pause', 'sundial', 'metronome', 'time_slip', 'replay_rewind',
            'deja_vu', 'clockmaker'],
  sleight: ['syncopation', 'rewind', 'last_call', 'sandbag', 'snooze', 'shady_tree', 'stopwatch'],
};
// Returns { type, def } or null, and spends the gift only when it returns one.
function overtimeTakeGift() {
  if (!overtimeRun || !overtimeRun.gift) return null;
  const banned = id => (typeof offerBanned === 'function' && offerBanned(id))
    || (typeof survivalEntityBanned === 'function' && survivalEntityBanned(id));
  const ownedT = new Set((acquiredTricks || []).map(t => t.id)), ownedK = new Set((acquiredKnacks || []).map(k => k.id));
  const pools = {
    trick:   TRICK_POOL.filter(t => OVERTIME_GIFT_IDS.trick.includes(t.id) && !ownedT.has(t.id) && !banned(t.id)),
    knack:   KNACK_POOL.filter(k => OVERTIME_GIFT_IDS.knack.includes(k.id) && !ownedK.has(k.id) && !banned(k.id)),
    sleight: SLEIGHT_POOL.filter(s => OVERTIME_GIFT_IDS.sleight.includes(s.id) && !banned(s.id)
      && !(typeof grantedSleightIds !== 'undefined' && grantedSleightIds.has(s.id))
      && (typeof sleightOfferable !== 'function' || sleightOfferable(s))),
  };
  const types = Object.keys(pools).filter(t => pools[t].length);
  if (!types.length) return null;
  const type = types[Math.floor(Math.random() * types.length)];
  const tierOf = type === 'trick' ? (e => e.tier || 'common') : (e => e.rarity || 'common');
  const def = (typeof pickEntityByRarity === 'function' && pickEntityByRarity(pools[type], tierOf))
    || pools[type][Math.floor(Math.random() * pools[type].length)];
  if (!def) return null;
  overtimeRun.gift = false;
  return { type, def };
}
