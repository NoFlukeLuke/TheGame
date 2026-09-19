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

**Use handTime 6, not 12.** The owner's pairs-for-Focus play (~5-6s a hand) earns
the SPEED Focus bonus, which zeroes at 8s - so a 12s bot plays the whole run at
Focus x1.00 while a 6s bot rides ~x1.5-3.4. Measured: at 12s the owner's
"too easy" curve read 57% (bot artificially weak); at 6s it reads **93.8%**,
which matches the report. The 6s figures are the calibrated ones:

| curve (classic, handTime 6) | bot win % |
|---|---|
| 1500 base, 30%/round | 93.8 (the owner's "a good bit too easy") |
| **1500 base, 32% then 45% from round 13 (shipped r278)** | **30** |

Death diagnostics (the `deathDiag` block): failed rounds die playing ~9 hands at
Focus x3.4 and reaching ~83% of goal - wall deaths, not board stalls. About a
third of a death round's clock goes to dry scans, mostly late at high Selection
Size where the minimum-selection floor bites; the bot never plays High Card and
only swaps/discards reactively, so that share is an overcount of a real player's.

Schedule: shipped-r277 curve (Classic's 35%/level) = 0/100 - a wall, because a
Schedule level advances on every obligation, ~2x Classic's rate. 18%/level with
the review at 8.2x (shipped r278) = 41-64% across two sweeps. Survival: 30-35%
growth = 0-1/100 (the 5th boss sits at level ~25-30, unreachable at that
compounding); 22% = 22/100; shipped r278 is 25% = ~9/100 (the bot is weakest in
survival's 120s format, so its floor is lowest there).
