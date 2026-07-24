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
        showMessage(`⚡ COMBO ONLINE — ${fam.name}!`, '#ffd700'); return; }
    }
  }
  for (const fam of COMBO_FAMILIES) {
    if (comboComplete(fam) || _comboHinted.has(fam.id)) continue;
    const miss = comboMissingSlot(fam);
    if (miss) { _comboHinted.add(fam.id);
      showMessage(`Combo close: ${fam.name} — need ${entityDisplayName(miss)}`, '#8fd0ff'); return; }
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
// Reflect: true if a Reflect currently aims at cell (r,c)
function reflectAimsAt(r, c) {
  const f = findAimSleight('reflect');
  if (!f) return false;
  const t = aimTargetCell(f.card, f.r, f.c);
  return !!t && t[0] === r && t[1] === c;
}
// Soul Mirror: how many Soul Mirrors currently face a card of this rank (they stack)
function soulMirrorRankCount(rank) {
  let n = 0;
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r]?.[c];
      if (!cell?._isSleight || sleightDef(cell)?.id !== 'soul_mirror') continue;
      const t = aimTargetCell(cell, r, c);
      if (!t) continue;
      const tc = gridData[t[0]]?.[t[1]];
      if (tc && tc.rank === rank) n++;
    }
  return n;
}

// One-shot effect flags consumed by scoring/round logic
let sleightNextHandDouble = false; // Echo: next hand scores twice
let _dabiSwapNext = false;          // Down and Back In: alternates discard/swap grant
let magnetArmed = null;             // {r,c,card} while Magnet waits for a target-rank tap
let sleightLegacyMult    = false; // Legacy: next hand ×3
let sleightAmplifierMult = 0;     // Amplifier: accumulated trick mult for next hand
let grantedSleightIds = new Set(); // dedup: tracks which sleight IDs have been granted

// Altar effect tracking — investments that pay off over future rounds
let altarEffects = []; // [{ type:'mult_boost'|'time_boost'|'goal_reduce', value, roundsLeft }]

// streak tracking
let lastHandType = null;
let streakCount = 0;
// Combo Keeper knack state — save is armed initially; consumed on off-type hand;
// re-arms after 2 streak hands in a row following the off-type hand
let streakSaveArmed = true;
let streakSaveProgress = 0; // 0..2 — counts streak hands toward re-arm
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
let retriggersThisRound = 0;  // count of card retriggers in scored hands this round (Cuckoo's pause length)
let _lastHandRetrigs = 0;     // extra retriggers in the most recent calcScore of a real hand (read in playHand)
let cuckooNextMinute = 0;     // next roundStartSeconds-roundSeconds threshold for Cuckoo's pause
let doubleJeopardyPos = null; // { r, c } — marked tile (Double Jeopardy); fires once per round
let djUsedThisRound = false;  // Double Jeopardy has already fired its pause this round
let firstPauseStartedRound = false; // a clock pause has begun this round (Vulture's "first pause" gate)
let firstPauseActive = false; // currently inside the round's first continuous pause stretch (Vulture)
let _lastHandVultureSeconds = 0; // sum of Vulture buff-seconds fired (retrigger-aware) in the last real calcScore
let woodpeckerPos = null;       // { r, c } — marked tile (Woodpecker) during an active 30s block
let woodpeckerActiveBlock = -1; // index of the 30s block already handled (even = active/marked, odd = off)
let metronomeHandType = null;   // Metronome knack: the hand type that pauses the clock this round
let shadyColumn = 0;            // Shady Tree sleight: the "shady" column this round
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

let resilience = false; // once per game second chance
let resilienceUsed = false;
let firstHandThisRound = true;
let freeSwapsLeft    = 2;   // free (no time cost) swaps remaining this round
let freeDiscardsLeft = 2;   // free (no time cost) discards remaining this round
let levelupTimer = null;
let levelupSeconds = 0;
let trickSelectionPhase = false;   // true while player is choosing a Trick on the grid
let trickSelectionOptions = [];    // the 3 Trick trick objects currently on display
let pendingTrickChoice = null;     // trick the player has tapped once (awaiting confirm tap)

// ── Goal / level-up queue ──
let goalReachedThisRound = false;
let interludeActive = false;    // true during the 5s heartbeat countdown
let bonusWindowActive = false;  // true during the 5s ring countdown — hands score normally during this
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
// Active for the CURRENT round (recomputed each round = permanent + next-round):
let playHandCostThisRound = 0;     // extra seconds per hand this round
let discardCostThisRound  = 0;     // extra seconds per discarded card this round
// Exalt/Corrupt suit mechanic — PAUSED by default (owner request: it was interfering
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
