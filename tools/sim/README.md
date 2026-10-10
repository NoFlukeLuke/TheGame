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

## Trick audit (r519): which Tricks are out of line for their rarity

`trick-audit.js` scores the same hands with every on/off combination of a
5-Trick loadout through the real `calcScore`, and splits each hand's score
fairly between its Tricks (Shapley values: a Trick's credit is its added score
averaged over every order the five could have been added in; the credits add up
exactly to the hand's score above its no-Trick score).

```
node tools/sim/trick-audit.js --passes loadouts --out main.json            # ~75 min on 4 cores
node tools/sim/trick-audit.js --passes focus,time,hold,levels,pairs --out extra.json
python3 tools/sim/trick-audit-report.py main.json extra.json --out trick-audit.xlsx
```

- **loadouts**: Flow's Trick pool shuffled and dealt five at a time, 30 deals,
  so every Trick sits in 30 to 34 loadouts. 100 shared 5x5 boards x 10 hands: the
  "random hand" set (a random size 2-5, then a random real hand of that size, the
  same hands for every loadout) and the "chosen hand" set (each board's best hand
  for that loadout). Each hand is scored 32 times.
- **focus**: each Trick alone through the real `generateHandFocus` / `addFocus`
  / `onFocusMaxed` / `focusDecayTick`, 150 runs of 8 six-hand levels. The
  no-Trick run also sets the Focus each loadout hand is scored at.
- **time**: seconds (pause + rewind), credits and stock a hand, per Trick.
- **hold**: scaling Tricks alone after 0-144 hands held, and by hand position.
- **levels**: each Trick alone at levels 4 / 12 / 24.
- **pairs**: every pair of Tricks alone together on 200 hands; the extra
  multiplier a pair makes beyond each one alone.

What the sim SETS rather than plays (the `DEFAULTS` block in trick-audit.js,
all overridable with `--cfg '{...}'`): level 12, quarter 2 (QRL 2), six hands a
level, ~6s a hand (1.5s minimum), a level starting with 45-300s on Flow's
clock, 15s of reward screens between levels, 25% swap / 15% discard (3 cards)
chance before a hand, 0-50 credits, 2 Sleights owned with 2 charges missing,
scaling Tricks held 48 hands, a deck with 4 cards at +10 pips and 2 at +4 mult.
Runs are tapped in rank order where the board allows (Rogue Wave). Mirror is
tilted at its better neighbour. Pause Tricks feed a simplified pause model
(`AUD_handPause`: Cuckoo and card time buffs left out). Royal Favour and Ace
Absorb reshape the deck and are not scored; Wild Side and Wait For Iiiit never
pay in Flow (no reward grid). The sim replaces `hasTrick` with a set lookup and
silences notices and audio; nothing in the game is changed.

### Results at r518 (`tools/sim/out/trick-audit-r518.xlsx`)

Raw data: `out/trick-audit-r518-main.json.gz` and `-extra.json.gz` (the report
script reads them as they are). Headlines, at level 12 in Flow:

- A typical hand with no Tricks scores ~620 points (111 pips x 3.8 mult).
  +1 mult adds 31% to it, +10 pips adds 10%. Only pips grow with level, so a
  flat-pips Trick keeps ~1/5 of its level-4 value at level 24; flat mult keeps
  all of it.
- Rarity barely tracks power: the average Score Trick lifts a random hand
  x1.40 Common, x1.44 Rare, x1.56 Epic, x1.43 Legendary (chosen hands: 1.50 /
  1.79 / 1.77 / 2.29), and the median Score Trick only x1.11.
- 18 Score Tricks are 3x+ their rarity average; 38 are under 1/5 of it (49
  Tricks counting Focus and Time Tricks against their own kind).
  Loadouts holding Cloud Nine, Wellspring, Old Growth, Rising Tide or Jackpot
  lift a hand x10.8 (median); all others x1.8.
- Focus averages x1.32 with no Trick (it resets every level, and a level's
  first hand earns no speed bonus). Acorns is the best Focus Trick (+30%);
  Expanse (-8%) and Release Valve (-14%) lower it.
- The Hummingbird + any every-hand pause/rewind Trick is uncapped (x29 with
  Hoarder House).
- A ridge regression of each loadout's log lift on its Tricks explains 95% of
  the variance and matches the Shapley numbers (r = 0.99).

### Steering pass (r535): how hard is a Trick's condition to make?

The loadout pass prices a condition in by chance (random hands) and by what is
already on the board (chosen hands). The steer pass adds what a player does to
make a hand: one neighbour swap and one discard.

```
node tools/sim/trick-audit.js --passes steer --out steer.json      # ~85 min on 4 cores
python3 tools/sim/trick-steer-report.py steer.json --out trick-steer.xlsx
```

Each Trick ALONE (and no Trick, the baseline), on the loadout pass's 100
boards, in each board's first round state. The player picks the hand that
scores best with the Trick at three levels: as dealt; with one neighbour swap
(orthogonal, the game's rule); with one discard of 1-3 connected cards first
(cards above fall, new ones drop in; 2 random draws), then optionally the swap.
It does this for the best hand of each size (2-5 cards) and for the best hand
of any size, and asks whether the Trick paid on the hand it picked (the bare
score of that very hand, same board, same stock used). The headline number is
the average over the four sizes with a swap and a discard: a player who plays
a spread of hand lengths and steers each one. `--scoring mult_ladder` (or
`hand_size`) runs it under another scoring model (js/focus-config.js).

How the search is made affordable: every connected shape of 2-5 cells is
listed once; a shape is only sent to `handComponentsFor` (~0.3ms) if its ranks
can split into sets and runs (`AUD_quickOk`, checked against the real test on
28,000 shapes: it never turns away a real hand); answers are kept per board for
the whole worker (`AUD_steerUse`), and a swap only rescans the shapes through
its two cells.

What it does not do: the discard tried is the least disruptive group whose
draws give the best hands (a sharper player aims it at a nearly made hand);
the clock cost of a swap or discard is not charged; the player maximises
score, not score per second, so a Trick for small or fast hands reads lower
than it plays (its 2-card column shows it).

#### Results at r533 (`tools/sim/out/trick-steer-r533.xlsx`)

Raw data: `out/trick-steer-r533.json.gz` (the report script reads it as it is).
14 Score Tricks never paid alone (they need other Tricks, clock pauses or a
later hand: Mirror, Double Take, Prime Times, Inspirato, Move as One, the
pause birds, Deep Breath, Patient Rulers, Ley Line, Feng Shui, Bedrock) and are
not ranked. Medians of the other 103, each Trick alone:

| median Score Trick | Common | Rare | Epic | Legendary |
|---|---|---|---|---|
| random hand | x1.31 | x1.13 | x1.09 | x1.15 |
| best hand, as dealt | x1.20 | x1.20 | x1.38 | x1.51 |
| best hand, one swap | x1.17 | x1.19 | x1.43 | x1.71 |
| best hand, swap + discard | x1.18 | x1.19 | x1.42 | x1.78 |
| steered, all hand sizes | x1.23 | x1.23 | x1.42 | x1.42 |
| pays on: random hand | 36% | 36% | 36% | 47% |
| pays on: best hand, swap + discard | 73% | 87% | 85% | 78% |

- Steering removes most of the condition gap: the typical Trick of every
  rarity pays on three quarters or more of boards once the player picks the
  hand and has a swap and a discard. What still separates the rarities is
  what they pay, and it does not separate them much: Rare = Common, and
  Legendary = Epic across hand sizes.
- Conditions that read narrow on random hands are easy to steer to. Pays on
  random hands -> pays on the best hand with a swap and a discard, and that
  hand's lift: Lie Down (one row) 18% -> every board, x4.41; Stand Up (one
  column) 19% -> every board, x2.49; Rainbow (four suits) 4% -> every board,
  x10.55; Critical (flush type) 2% -> 77%, x1.90; Stretch 0% -> 94%, x7.06.
- Hard conditions with small payoffs stay small: Richter (Four of a Kind, x3
  mult) and Twenty-One (a total of 21, x3 pips) are made on 75% / 74% of
  boards but lift those hands only x1.71 / x1.48.
- Strongest steered: Old Growth x7.3, Cloud Nine x6.8, Wellspring x6.3,
  Lie Down x4.7, Jackpot x3.9, What are The Odds x3.4.
- Stand Up (Common, `column_rush`) and Stand-Up (Rare, `stand_up`) are the
  same Trick: +5 mult per card on one-column hands.
- Ranked into today's tier sizes, 30 of the 103 stay where they are.
