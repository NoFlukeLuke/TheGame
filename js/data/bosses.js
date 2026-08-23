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
  },

  // ── r150 roster ────────────────────────────────────────────────────────────
  // Every one of these acts ONCE at round start and then on its interval — that
  // shape lives in bossSchedule (js/boss-effects.js), which is also where the
  // Contingency Plan knack stretches the timings.
  {
    id: 'the_metronome',
    name: 'THE METRONOME',
    flavor: 'It keeps your time now',
    brief: 'The clock runs at your Focus multiplier. At ×3 Focus, three seconds leave the clock every second. Focus is still worth having — it just costs you the round to hold.',
    objective: { type: 'score', target: 4200 },
    modifiers: ['time_scales_with_focus'],
    params: {}
  },
  {
    id: 'the_tollman',
    name: 'THE TOLLMAN',
    flavor: 'Every touch is billed',
    brief: 'Swaps and discards cost double, and playing a hand — normally free — is billed 3 seconds. Fix the board less. Play what you are dealt.',
    objective: { type: 'score', target: 4000 },
    modifiers: ['interact_surcharge'],
    params: { costMult: 2, playCostAdd: 3 }
  },
  {
    id: 'the_undertow',
    name: 'THE UNDERTOW',
    flavor: 'Concentration will not hold',
    brief: 'Every 15 seconds, 10 Focus is pulled out of the meter. Build it faster than it drains, or accept a low multiplier and score on volume.',
    objective: { type: 'score', target: 4200 },
    modifiers: ['focus_drain'],
    params: { everySecs: 15, amount: 10 }
  },
  {
    id: 'the_quarantine',
    name: 'THE QUARANTINE',
    flavor: 'The board is being condemned, cell by cell',
    brief: 'Every 15 seconds a cell is marked with a cross. Ten seconds later it goes dark: cards still fall into it, but nothing there can be selected, played, discarded or swapped. The dark cells accumulate.',
    objective: { type: 'score', target: 4000 },
    modifiers: ['cell_quarantine'],
    params: { everySecs: 15 }
  },
  {
    id: 'the_censor',
    name: 'THE CENSOR',
    flavor: 'Your paperwork is under review',
    brief: 'Every 35 seconds one of your Tricks is suspended for 45 seconds. The windows overlap, so for 10 seconds of every cycle two of them are down at once.',
    objective: { type: 'score', target: 4300 },
    modifiers: ['trick_blackout'],
    params: { everySecs: 35, holdSecs: 45 }
  },
  {
    id: 'the_blight',
    name: 'THE BLIGHT',
    flavor: 'It spreads through the board',
    brief: 'Every 20 seconds three more cells are contaminated, for the rest of the round. Cards scored from a contaminated cell contribute half their pips, and may fail to trigger a Trick they otherwise would.',
    objective: { type: 'score', target: 4200 },
    modifiers: ['cell_blight'],
    params: { everySecs: 20, count: 3 }
  },
  {
    id: 'the_recall',
    name: 'THE RECALL',
    flavor: 'That rank has been withdrawn',
    brief: 'One rank is withdrawn from play at a time — those cards sit on the board, inert. Every 45 seconds the previous rank is reinstated and a different one is taken. No rank is recalled twice.',
    objective: { type: 'score', target: 4000 },
    modifiers: ['rank_recall'],
    params: { everySecs: 45 }
  },
  {
    id: 'the_auditor',
    name: 'THE AUDITOR',
    flavor: 'Your allowances are under revision',
    brief: 'Every 30 seconds one swap or one discard is struck off your allowance for this round. Spend them while you still have them.',
    objective: { type: 'score', target: 4000 },
    modifiers: ['ration_cut'],
    params: { everySecs: 30 }
  },
  {
    id: 'the_ratchet',
    name: 'THE RATCHET',
    flavor: 'The bar only moves one way',
    brief: 'Every swap and every discard raises the objective by 5%. It never comes back down. Fixing the board is now a decision with a price attached.',
    objective: { type: 'score', target: 3800 },
    modifiers: ['goal_ratchet'],
    params: { rate: 0.05 }
  },
  {
    id: 'the_turnstile',
    name: 'THE TURNSTILE',
    flavor: 'Access is metered',
    brief: 'Every swap and every discard is billed 3 credits. Your balance cannot go below zero — but interest is paid on what survives the round.',
    objective: { type: 'score', target: 4000 },
    modifiers: ['interact_fee'],
    params: { fee: 3 }
  },
  {
    id: 'the_redaction',
    name: 'THE REDACTION',
    flavor: 'That hand is no longer recognised',
    brief: 'One hand type is marked down for the whole round — it scores 60% less. The hand is chosen when the review begins and does not change. Find another line.',
    objective: { type: 'score', target: 4200 },
    modifiers: ['redact_hand'],
    params: { mult: 0.4 }
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
