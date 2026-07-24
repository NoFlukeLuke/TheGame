const BOSS_PRESETS = [
  {
    id: 'stone_lord',
    name: 'THE STONE LORD',
    flavor: 'Your deck turns to rubble',
    objective: { type: 'score', target: 4000 },
    modifiers: ['inject_stones'],
    params: { stoneInjectCount: 5 }
  },
  {
    id: 'voidwright',
    name: 'THE VOIDWRIGHT',
    flavor: 'Your blessings flicker',
    objective: { type: 'score', target: 4500 },
    modifiers: ['trick_pool_split'],
    params: {}
  },
  {
    id: 'hand_of_famine',
    name: 'THE HAND OF FAMINE',
    flavor: 'A withered deck offers little',
    objective: { type: 'hand', handName: 'Flush', count: 2 },
    modifiers: ['low_card_infusion'],
    params: { lowCardWeight: 0.7 } // 70% of new cards drawn during boss are low (2–6)
  },
  {
    id: 'cornerless_king',
    name: 'THE CORNERLESS KING',
    flavor: 'The edges hold no salvation',
    objective: { type: 'score', target: 5000 },
    modifiers: ['void_corners', 'reduce_swaps'],
    params: { swapsDelta: -1 }
  },
  {
    id: 'the_hollow',
    name: 'THE HOLLOW',
    flavor: 'Cards crumble into nothing',
    objective: { type: 'score', target: 4500 },
    modifiers: ['periodic_null'],
    params: { nullIntervalSecs: 8, nullCount: 1 }
  }
];

let currentBoss = null;         // active boss preset (clone)
let bossObjectiveProgress = 0;  // score or hand-count progress
let bossPhase = 1;              // 1 or 2 for split-phase bosses (Voidwright)
let bossSwapsDelta = 0;         // applied to swaps for boss; restored on end
let trickPoolA = new Set();        // for Voidwright phase 1 disabled Tricks (by id)
let trickPoolB = new Set();        // for Voidwright phase 2 disabled Tricks
let bossLowCardActive = false;  // for Famine
let bossLockedHand = null;      // for hand-type lock modifier (not in roster v1 but framework-ready)
let bossNullInterval = null;    // for The Hollow periodic null modifier

// ── Cell helpers ──
