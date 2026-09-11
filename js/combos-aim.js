const COMBO_FAMILIES = [
  { id:'discard_furnace',   name:'Discard Furnace',   slots:['free_discards','hoarder','discard_pips','landfill'] },
  { id:'retrigger_cascade', name:'Retrigger Cascade', slots:['soul_mirror',['reflect','corner_retrigger','rowcol_retrigger'],'club_double','high_and_mighty'] },
  { id:'priming_press',     name:'Priming Press',     slots:[['wild_heart','prime_times'],'twos_retrigger','muscle_memory'] },
  { id:'permanent_snowball',name:'Permanent Snowball',slots:[['the_naturalist','the_bomb','sapling'],'snowball','old_growth'] },
  { id:'sleight_charges',   name:'Sleight Charges',   slots:[['magician','stand_up','scalper'],['coin_toss','martyr']] },
  { id:'frozen_hour',       name:'Frozen Hour',       slots:['high_water','frozen_moment','sands_of_time'] },
  { id:'focus_overdrive',   name:'Focus Overdrive',   slots:['flow_state',['ancient_grove','richter'],['rhythm','kaleidoscope','before_the_tide']] },
  { id:'position_lock',     name:'Position Lock',     slots:[['rowcol_mult','rowcol_retrigger','rowcol_perm_double'],['shape_square','two_corners','shape_cross'],'magnet'] },
];
let _comboAnnounced = new Set(); // families that already fired the ONLINE toast (per game)
let _comboHinted    = new Set(); // families that already fired the "close" hint (per game)
function ownsEntity(id) {
  return (typeof ownsTrick === 'function' && ownsTrick(id))
      || (typeof hasKnack === 'function' && hasKnack(id))
      || (typeof grantedSleightIds !== 'undefined' && grantedSleightIds.has(id));
}
function _slotMet(slot) { return Array.isArray(slot) ? slot.some(ownsEntity) : ownsEntity(slot); }
function comboComplete(fam) { return fam.slots.every(_slotMet); }
function comboMissingSlot(fam) { const u = fam.slots.filter(s => !_slotMet(s)); return u.length === 1 ? u[0] : null; }
function entityDisplayName(slot) {
  const id = Array.isArray(slot) ? slot[0] : slot;
  return (TRICK_POOL.find(x => x.id === id)?.name)
      || (KNACK_POOL.find(x => x.id === id)?.name)
      || (SLEIGHT_POOL.find(x => x.id === id)?.name) || id;
}
// Called at round start: at most one completion toast, else at most one "close" hint.
function checkComboMilestones() {
  for (const fam of COMBO_FAMILIES) {
    if (comboComplete(fam)) {
      if (!_comboAnnounced.has(fam.id)) { _comboAnnounced.add(fam.id); _comboHinted.add(fam.id);
        showMessage(`⚡ COMBO ONLINE - ${fam.name}!`, '#ffd700'); return; }
    }
  }
  for (const fam of COMBO_FAMILIES) {
    if (comboComplete(fam) || _comboHinted.has(fam.id)) continue;
    const miss = comboMissingSlot(fam);
    if (miss) { _comboHinted.add(fam.id);
      showMessage(`Combo close: ${fam.name} - need ${entityDisplayName(miss)}`, '#8fd0ff'); return; }
  }
}

const AIM_SLEIGHTS = new Set(['reflect','soul_mirror']);
const AIM_ORDER = ['up','right','down','left'];
const AIM_DELTA = { up:[-1,0], right:[0,1], down:[1,0], left:[0,-1] };
const AIM_TILT  = { up:'rotateX(25deg)', down:'rotateX(-25deg)', right:'rotateY(25deg)', left:'rotateY(-25deg)' };
const AIM_ARROW = { up:'↑', right:'→', down:'↓', left:'←' };
function cycleSleightAim(card) {
  const i = AIM_ORDER.indexOf(card._aimDir || 'up');
  card._aimDir = AIM_ORDER[(i + 1) % AIM_ORDER.length];
}
function aimTargetCell(card, r, c) {
  const [dr, dc] = AIM_DELTA[card._aimDir || 'up'];
  const ar = r + dr, ac = c + dc;
  if (ar < 0 || ac < 0 || ar >= gridRows || ac >= gridCols) return null;
  return [ar, ac];
}
function findAimSleight(id) {
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r]?.[c];
      if (cell?._isSleight && sleightDef(cell)?.id === id) return { card: cell, r, c };
    }
  return null;
}
// ── Reflect / Soul Mirror (reworked r193) ───────────────────────────────────
// Both aim sleights used to key off the CELL they face. They now key off the
// RANK of the card in that cell, which is what makes them worth aiming: the
// target moves as the board falls, but the rank is a thing you can build around.
//
// Both are READ-ONLY from calcScore - findBestHand scores every candidate hand
// through it, so anything that mutates state here would fire on a hover. Reflect's
// once-per-round lock is therefore a flag that only playHand sets (see
// reflectSpendForRound), the same contract Siphon and Legacy use.

// The rank a Reflect currently faces, or null if it faces nothing / no Reflect.
function reflectAimedRank() {
  const f = findAimSleight('reflect');
  if (!f) return null;
  const t = aimTargetCell(f.card, f.r, f.c);
  if (!t) return null;
  const tc = gridData[t[0]]?.[t[1]];
  return (tc && tc.rank) ? tc.rank : null;
}
let reflectUsedThisRound = false;   // cleared in the round-start sweep
// True while Reflect would replay this card: it faces this card's rank and has
// not yet fired this round. The (r, c) arguments are kept for call-site
// compatibility - it is the rank that decides now, not the position.
function reflectAimsAt(r, c) {
  if (reflectUsedThisRound) return false;
  const rank = reflectAimedRank();
  if (rank === null) return false;
  const card = gridData[r]?.[c];
  return !!card && card.rank === rank;
}
// Called from playHand once a hand that used Reflect has committed.
function reflectSpendForRound(cells) {
  if (reflectUsedThisRound) return false;
  const rank = reflectAimedRank();
  if (rank === null) return false;
  const hit = (cells || []).some(([r, c]) => gridData[r]?.[c]?.rank === rank);
  if (hit) reflectUsedThisRound = true;
  return hit;
}

// Soul Mirror: while it faces a card, scoring that rank replays it once per copy
// of that rank ON THE GRID - so the payoff is a board state you can build toward,
// not just the fact that a mirror is pointed somewhere. Several Soul Mirrors
// facing the same rank still stack (each contributes its own count).
function soulMirrorRankCount(rank) {
  let mirrors = 0;
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r]?.[c];
      if (!cell?._isSleight || sleightDef(cell)?.id !== 'soul_mirror') continue;
      const t = aimTargetCell(cell, r, c);
      if (!t) continue;
      const tc = gridData[t[0]]?.[t[1]];
      if (tc && tc.rank === rank) mirrors++;
    }
  if (!mirrors) return 0;
  return mirrors * rankCountOnGrid(rank);
}
// How many cards of this rank are on the board right now (sleights/stones excluded).
function rankCountOnGrid(rank) {
  let n = 0;
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r]?.[c];
      if (cell && !cell._isSleight && !cell._isStone && cell.rank === rank) n++;
    }
  return n;
}

// One-shot effect flags consumed by scoring/round logic
let sleightNextHandDouble = false; // Echo: next hand scores twice
let _dabiSwapNext = false;          // Down and Back In: alternates discard/swap grant
let magnetArmed = null;             // {r,c,card} while Magnet waits for a target-rank tap
let sleightLegacyMult    = false; // Legacy: next hand ×3
let sleightAmplifierMult = 0;     // Amplifier: accumulated trick mult for next hand
let siphonMultX          = 1;     // Siphon: multiplies the next hand's mult (×4), cleared after the hand
let growthSpurtCapPenalty = 0;    // Growth Spurt: permanent max-Focus reduction (−5 per max), floored in focusCapNodes
let growthSpurtMaxedThisRound = false; // Growth Spurt: hit max this round → grant a random limit at round end
let grantedSleightIds = new Set(); // dedup: tracks which sleight IDs have been granted

// Altar effect tracking - investments that pay off over future rounds
let altarEffects = []; // [{ type:'mult_boost'|'time_boost'|'goal_reduce', value, roundsLeft }]

// streak tracking
let lastHandType = null;
let streakCount = 0;
// Combo Keeper knack state - save is armed initially; consumed on off-type hand;
// re-arms after 2 streak hands in a row following the off-type hand
let streakSaveArmed = true;
let streakSaveProgress = 0; // 0..2 - counts streak hands toward re-arm
let lastHandTime = 0;
let lastSwapTime = 0; // for Still Water trick
let lastHandRoundSeconds = null; // roundSeconds value when the previous hand was scored (Heron)
let lastSwapRoundSeconds = null; // roundSeconds value when the previous swap occurred (Eagle Eye)
let lastHandRankKey = null;      // sorted rank multiset of the previous scored hand (Deja Vu knack)
let _altSwapCount = 0;           // Mockingbird: counts hand-type alternations toward the next +1 swap

// ── Clock-mark Tricks: pending bonuses accrued as the round clock passes static timestamps ──
// These accumulate while the clock ticks (see handleClockMarks in the round timer) and are
// consumed by the next hand played (see calcScore / playHand). Reset each round.
let _discardContextCards = null; // set during a discard so on_discard sleights can inspect co-discarded cards (Sandbagger)
let pendingHandPips = 0;   // Quarter Chime: +45 pips per multiple-of-15 second passed
let pendingHandMult = 0;   // Minute Hand: +3 mult per minute mark passed
let pendingCardPips = 0;   // Second Hand: +5 pips per minute mark passed

// ── Timing/Streak batch: pause-themed Trick state ──
let pausedSecondsRound = 0;   // total seconds the clock has spent paused this round (Albatross)
let rewoundSecondsRound = 0;  // total seconds rewound (given back) this round (Kingfisher)
let pauseInstanceGame = 0;    // PER GAME: number of clock pauses triggered (Hummingbird); reset only at newGame
let pausesThisRound = 0;      // PER ROUND: how many times the clock has been paused (time popup)
let rewindsThisRound = 0;     // PER ROUND: how many times the clock has been rewound (time popup)
let retriggersThisRound = 0;  // count of card retriggers in scored hands this round (Cuckoo's pause length)
let _lastHandRetrigs = 0;     // extra retriggers in the most recent calcScore of a real hand (read in playHand)
let _lastHandProcs   = {};    // per-id proc COUNTS from that same calcScore (read by the Rider penalty)
// Contribution-tally summaries (shown in the Contributions view when non-zero).
let replaysThisRound = 0;     // total card replays/retriggers across scored hands this round
let timeManipRound = 0;       // net seconds ADDED to the clock by scoring effects this round (Deluge/Overtime/etc.)
let cuckooNextMinute = 0;     // next roundStartSeconds-roundSeconds threshold for Cuckoo's pause
// Compound (mythic): the round score is banked every interval; the next scored hand
// pays the bank again. Both reset each round (see triggerLevelUp).
let compoundNextMark = 0;     // next elapsed-seconds threshold at which to bank
let compoundBanked   = 0;     // banked score awaiting the next hand's payout
let doubleJeopardyPos = null; // { r, c } - marked tile (Double Jeopardy); fires once per round
let djUsedThisRound = false;  // Double Jeopardy has already fired its pause this round
let firstPauseStartedRound = false; // a clock pause has begun this round (Vulture's "first pause" gate)
let firstPauseActive = false; // currently inside the round's first continuous pause stretch (Vulture)
let _lastHandVultureSeconds = 0; // sum of Vulture buff-seconds fired (retrigger-aware) in the last real calcScore
let _lastRetrigByCell = {};      // { 'r-c': replayCount } from the last calcScore (playHand reads for replay-aware coin/time)
let woodpeckerPos = null;       // { r, c } - marked tile (Woodpecker) during an active 30s block
let woodpeckerActiveBlock = -1; // index of the 30s block already handled (even = active/marked, odd = off)
let metronomeHandType = null;   // Metronome knack: the hand type that pauses the clock this round
let shadyColumn = 0;            // Shady Tree sleight: the "shady" column this round
let lighthouseColumn = 0;       // Lighthouse sleight: the favored column this round (alternates first ↔ last)
let lighthouseFlip = 0;         // alternator driving lighthouseColumn each round
let tempoElapsed = 0;           // Tempo knack: round-seconds banked toward the next swap/discard drip
let tempoNextIsSwap = true;     // Tempo knack: the drip alternates swap → discard → swap
let tempoInitApplied = false;   // Tempo knack: its one-time limit-set has run this game (reset on new game)
let stopwatchActive = false;    // Stopwatch sleight: clock frozen until the next hand's scoring animation ends
let stopwatchTimer = null;      // interval draining the Stopwatch second-budget while frozen
let stopwatchCardPos = null;    // { card, r, c } of the active Stopwatch

// Hand types the player can actually make given their current Selection Size cap.
// Used so we never assign a target hand a small hand-size can't build (e.g. no Flush at cap 3).
function achievableHandTypes() {
  const cap = limits.selection.current;
  const t = [];
  if (cap >= 2) t.push('Pair');
  if (cap >= 3) t.push('Three of a Kind', 'Run of 3');
  if (cap >= 4) t.push('Two Pair', 'Four of a Kind', 'Run of 4');
  if (cap >= 5) t.push('Straight', 'Flush', 'Full House', 'Straight Flush');
  return t;
}

// ── Dead Drop (r194): a cell that plays but does not pay ────────────────────
// Deliberately NOT part of isCellBlocked. The two boss cell states both take the
// cell out of play - VOID returns the card to the deck, QUARANTINED lets a card
// land but blocks selecting it - and this is a third thing: the card is
// selectable and COUNTS FOR HAND DETECTION, so three cards including it still
// make a Three of a Kind, and the hand still fires its whole-hand Tricks. What
// it does not do is contribute: zero pips, and none of its own per-card Tricks.
// Lasts to the end of the act (cleared where actNumber advances).
function isCellDead(r, c) { return deadCells.has(`${r}-${c}`); }

// Drawn from render(), NOT from renderBossCellOverlays - that one is gated on
// bossActive and clears itself when the boss ends, and a dead cell outlives the
// round it was taken in. Cheap no-op while the set is empty, which is the
// overwhelming majority of the time.
function renderDeadCellOverlays() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const had = gridEl.querySelector('.dead-cell');
  if (!deadCells.size) { if (had) gridEl.querySelectorAll('.dead-cell').forEach(el => el.remove()); return; }
  gridEl.querySelectorAll('.dead-cell').forEach(el => el.remove());
  deadCells.forEach(k => {
    const [r, c] = k.split('-').map(Number);
    if (r >= gridRows || c >= gridCols) return;   // board shrank under it
    const d = document.createElement('div');
    d.className = 'dead-cell';
    d.style.left = cellLeft(c) + 'px';
    d.style.top  = cellTop(r) + 'px';
    gridEl.appendChild(d);
  });
}

let resilience = false; // once per game second chance
let resilienceUsed = false;
let firstHandThisRound = true;
// DEAD as of r151 - the "first 2 swaps of a round are free" exemption was part of
// the old double-charge tangle and contradicted the flat 8s the UI now quotes.
// Still reset each round so restoring it is a one-line change in doSwap.
let freeSwapsLeft    = 2;
let freeDiscardsLeft = 2;   // free (no time cost) discards remaining this round
let levelupTimer = null;
let levelupSeconds = 0;
let trickSelectionPhase = false;   // true while player is choosing a Trick on the grid
let trickSelectionOptions = [];    // the 3 Trick trick objects currently on display
let pendingTrickChoice = null;     // trick the player has tapped once (awaiting confirm tap)

// ── Goal / level-up queue ──
let goalReachedThisRound = false;
let interludeActive = false;    // true during the 5s heartbeat countdown
let bonusWindowActive = false;  // true during the 5s ring countdown - hands score normally during this
let dealAnims = [];             // Web Animations API refs for the between-round card deal
let frozenRoundSeconds = 0;     // clock value when goal was scored
let sfxDuckGain = null;         // Web Audio gain node for ducking SFX during heartbeat
let pendingLevelUps = 0;
let suppressScoreDisplay = false; // true during goal hand dance for suspense
let heldBackScore = 0; // score temporarily withheld from display during goal dance

// ── Challenge card state ──
let challengeCard = null;
let challengeActive = false;
let roundPenaltySeconds = 0;       // PERMANENT: seconds shaved off the round-time cap (stacks; reward "-5s round cap")
// ── Reward-grid time/resource debuffs ──
// Permanent (stack forever, reset only on new game):
let extraPlayCostPerm    = 0;      // +seconds added to the cost of playing a hand
let extraDiscardCostPerm = 0;      // +seconds added per discarded card
// Next-round-only (folded into next round at round start, then cleared). +buff / -penalty:
let nextRoundDiscardDelta = 0;     // change to next round's discard count
let nextRoundSwapDelta    = 0;     // change to next round's swap count
let nextRoundSecondsDelta = 0;     // change to next round's starting seconds (+15s buff)
let nextRoundPlayCost     = 0;     // +seconds to hand cost, next round only
let nextRoundDiscardCost  = 0;     // +seconds per discarded card, next round only
// ── Reward-grid penalties added r193 ──
// Permanent (reset only on a new game):
let goalPenaltyMult   = 1;         // multiplies every future round goal (Quota Revision)
let focusRatePenalty  = 1;         // divides the Focus a hand generates (Red Tape)
// Next-round-only:
let skipNextPayout    = false;     // the next round's end-of-round payout pays nothing (Withheld)
// One owned entity is switched off for the first half of the next round (Suspension).
// { type:'trick'|'knack'|'sleight' } while armed; gains { id } once the round deals.
let pendingEntityLockout = null;
let entityLockout        = null;
// ── Five more reward-grid penalties (r194) ──
// Permanent for the rest of the ACT:
let deadCells         = new Set();  // "r-c" cells whose card scores nothing (Dead Drop)
// Permanent for the run, or until the ridden Trick leaves you:
let riderTrickId      = null;       // Trick every proc of which costs seconds (Rider)
// Counted down, then gone:
let interestFreezeRounds = 0;       // rounds left with no interest paid (Interest Freeze)
let spotCheckHand     = null;       // hand type scoring at half mult (Spot Check)
let spotCheckLeft     = 0;          // how many more of it must be played to clear it
// Next round only:
let nextRoundGridShrink = null;     // 'rows' | 'cols' - the board loses one, once (Short Staffed)

// ── Suspension: one owned entity switched off for half a round (r193) ────────
// The reward-grid tile names the TYPE when you take it ("a Sleight will not work
// for the first half of next round") and the specific entity is only chosen when
// that round deals. That is the point of the penalty: you know what kind of hole
// is coming and you cannot plan around which one, so it is a real risk rather
// than a known cost.
//
// KNOWN GAP, deliberate: the sleight case gates applySleightGridEffect, which is
// where every ACTIVATION-driven sleight funnels through. The three passive mult
// sleights (Whetstone, Entourage, Lighthouse) and the focus-rate pair work by
// being scanned where they sit, so they are not covered. Suspension therefore
// bites an activation sleight harder than a passive one - worth knowing before
// tuning its weight up.
function resolveEntityLockout() {
  entityLockout = null;
  if (!pendingEntityLockout) return;
  const type = pendingEntityLockout.type;
  pendingEntityLockout = null;
  let pool = [];
  if (type === 'trick')       pool = (trickTray || []).map(t => ({ id: t.id, name: t.name }));
  else if (type === 'knack')  pool = (acquiredKnacks || []).map(t => ({ id: t.id, name: t.name }));
  else if (type === 'sleight') {
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      const cd = gridData?.[r]?.[c];
      if (cd?._isSleight) { const d = sleightDef(cd); if (d) pool.push({ id: d.id, name: d.name }); }
    }
  }
  if (!pool.length) return;   // nothing of that type owned - the penalty simply misses
  const pick = pool[Math.floor(Math.random() * pool.length)];
  // Half of THIS round, measured off the clock the round actually started with,
  // so it is half a round in every mode rather than half of Classic's 180.
  entityLockout = { type, id: pick.id, name: pick.name, until: (roundStartSeconds || roundSeconds) / 2 };
  showMessage(`Suspended: ${pick.name} (half the round)`, 'var(--red)');
}
// True while the lockout window is open. Flow has no round clock to run down, so
// the window there is the first half of the session clock, which is the same
// reading of "half a round" the rest of the game uses.
function entityLockoutOpen() {
  return !!entityLockout && roundSeconds > entityLockout.until;
}
function entitySuspended(type, id) {
  return entityLockoutOpen() && entityLockout.type === type && entityLockout.id === id;
}
// Active for the CURRENT round (recomputed each round = permanent + next-round):
let playHandCostThisRound = 0;     // extra seconds per hand this round
let discardCostThisRound  = 0;     // extra seconds per discarded card this round
// Exalt/Corrupt suit mechanic - PAUSED by default (owner request: it was interfering
// with hand submission). Toggle in the pause-menu Settings. Persisted across sessions.
// When off: cards never get exalted/corrupted, existing flags grant no buffs, no glow.
let exaltCorruptEnabled = (localStorage.getItem('exaltCorruptEnabled') === 'true');
let challengeOverlayTimer = null;
let isChallengeTrickPick = false; // true when selectTrick is called from a challenge reward, not a level-up
let nextShopTime = GAME_DURATION - 120; // first shop after 2 minutes elapsed
let coins = 0;

// ══════════════════════════════════════════════
// BOSS SYSTEM (v1)
// ══════════════════════════════════════════════
const BOSS_LOOP_DURATION  = 360; // boss every 6 minutes (used in timer-based modes only)
