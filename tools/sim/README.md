# Monte Carlo balance sim (r278)

Plays whole runs headlessly with a greedy bot, through the REAL game code:
`harness.js` loads every `js/*.js` file from `index.html`'s script order into a
Node vm with a stubbed DOM, so `calcScore`, `detectHand`, the entity pools, the
luck tables, focus generation and natural scaling are the shipped ones. Rerun it
whenever the deck, the hand values or the entity pools change - the harness
reads the live files, nothing is copied.

## Usage

```
cd tools/sim
node runner.js <classic|schedule|survival> <runs> '<sched-json>' [handTime]
```

- `{"native":true}` plays the game's own shipped curve (`goalForLevel`).
- Otherwise: `{"base":1500,"roundTo":500,"segments":[[12,32],[99,45]]}` means
  levels up to 12 grow 32% per level, everything after 45%. Schedule also takes
  `"bossMult"` (review quota = quarter-open goal x that); survival takes
  `"bossEvery"` (seconds of live play per boss, default 300).
- `handTime` (default 12s) is the bot's pace per hand - the skill knob.
- `sweep.sh <mode>` runs the r278 config lists into `sweep_<mode>.jsonl`.

Output per config: win rate, share of deaths on boss rounds, a histogram of the
level each loss died at, ms per run.

## What the bot does and does not do

Does: real deals, connected-subset search (up to 5 cards), plays the highest
`calcScore` candidate, swaps when no hand exists (`tutorialFindSwap`), discards
low cards, spends real interact costs, real entity draws (pick-of-three takes
the best of 3 by tier), prefers the growth limits, real clock-mark tricks (the
round clock is simulated per second through `handleClockMarks`), real natural
scaling and entity improvements.

Does not: exploit 6-7 card layered hands (perf cap), draft synergies, use
Sleight activations, face boss modifiers, or suffer reward-grid debuffs. The
first three make it WEAKER than a good player, the last two make it stronger;
net, treat its win rate as a floor a real player clears by a wide margin.

## Calibration anchors (2026-09-19, pre-deck-rework)

Classic, 100 runs each, handTime 12:

| curve | bot win % |
|---|---|
| 1500 base, 30%/round | 57 (the owner's "a good bit too easy") |
| 1200 base, 35%/round | 39 |
| **1500 base, 32% then 45% from round 13 (shipped r278)** | **37** |
| 1500 base, 40%/round | 18 |
| 2000 base, 45%/round | 5 |

Schedule: shipped-r277 curve (Classic's 35%/level) = 0/100 - a wall, because a
Schedule level advances on every obligation, ~2x Classic's rate. 18%/level with
the review at 8.2x (shipped r278) = 41-64% across two sweeps. Survival: 30-35%
growth = 0-1/100 (the 5th boss sits at level ~25-30, unreachable at that
compounding); 22% = 22/100; shipped r278 is 25% = ~9/100 (the bot is weakest in
survival's 120s format, so its floor is lowest there).
