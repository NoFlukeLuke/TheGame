# Score scaling (r278) - what the simulation found and what shipped

The question: 1500 base / 30% per round felt a good bit too easy. Target: most
runs winnable, a real chance of failure - roughly Balatro White Stake / Slay
the Spire Ascension 1.

The method: a bot plays whole runs through the real game code (see
`tools/sim/README.md`), hundreds of runs per candidate curve, and we compare
win rates. The bot is weaker than a good player (it cannot build 6-7 card
layered hands or draft synergies), so its win rate is a FLOOR: pick curves
where the bot wins ~25-40% and a decent player lands around 60-75%.
**Rerun the sweep after the deck rework** - one command, nothing to rebuild.

## The anchor (recalibrated after your playtest report)

The bot's pace is its skill knob, and pace turns out to gate the SPEED Focus
bonus (zero past 8s a hand). At the original 12s pace the bot never earned any
speed Focus - your pairs-to-pump-Focus engine did not exist for it. At a 6s
pace it plays that engine (Focus ~x1.5-3.4) and the numbers line up with your
experience: at your 1500 / 30% it wins **93.8%** and almost never dies early -
you reported roughly 27 of 30 rounds cleared comfortably. The shipped r278
curve reads **30%** for that same bot; a player who also drafts synergies and
builds 6-7 card layered hands lands well above it.

Failed runs die at the wall, not on stuck boards: at death the bot is still
playing ~9 hands in the round, at Focus x3.4, and reaches ~83% of the goal.
Round-1 deaths are ~0% at the calibrated pace.

## What shipped, per mode

### Classic - base 1500, +32%/round to round 12, +45%/round after

Bot: **37%** solo, 25% under load; deaths at rounds 15-24, round-1 deaths ~1%.
Scaling does not have to be one number, and the two-segment shape tested
better than every single rate: a flat 40% (18% win) frontloads too much pain,
a flat 30% is the too-easy baseline, and raising the BASE instead (1800-2000)
just creates round-1 deaths before you own a single Trick - the wrong place
to lose. Curve: R1 1,500 · R6 6,000 · R12 32,000 · R18 295,500 · R24 2.75M.

### Schedule (map) - its own curve: +18% per LEVEL, review at 8.2x

Two real findings here, not just numbers:

1. **The Schedule could not share Classic's curve at all.** Every obligation
   advances the level, played or bought (the mode's load-bearing rule), so the
   Schedule climbs ~11 levels a quarter against Classic's 6. On the shared 35%
   curve the bot won **0 of 100** - a wall around slot 12-25 that no loadout
   climbs. `goalForLevel` now dispatches to a Schedule-only growth
   (`MAP_GOAL_GROWTH`, 18%/level ≈ 34% per played round, i.e. the same felt
   pace as Classic).
2. **The review multiplier had to flatten with the curve.** At the old 1.40^8
   (14.8x the quarter-open goal) with 18% growth, 98% of failed runs died AT a
   review - all difficulty in one tile. At 1.30^8 (8.2x), deaths split about
   half reviews, half late obligations. Q1 review asks 12,000.

Bot: 41-64% across sweeps - the gentlest of the three for the bot, reasonable
for the intended default mode.

### Survival - growth 25%/level (base stays 900)

A structural discovery: the 5th boss (the win condition) arrives around level
25-30, and at 30-35% growth **nothing reaches that deep** - level 28 at 35%
asks ~1.4M in a 120-second round. Bot: 0-1% at 30-35%, 22% at 22% growth.
Shipped 25% (bot ~9%; the bot is weakest in survival's fast format, so its
floor understates players most here). If survival still feels impossible in
playtesting, the better lever than growth is the boss CADENCE
(`SURVIVAL_BOSS_EVERY_SECONDS`): bosses every 200-240s end the run around
level 18-22 instead of 28.

## Knobs, all live in dev panel -> Goals

- Classic: round-1 goal, early growth, **late growth**, **the round it
  shifts** (new), rounding.
- Schedule: **harder each level by** (new, under "other").
- Survival: round-1 goal, growth.
Everything falls back to the constants (`BASE_GOAL`, `GOAL_SCALE`,
`GOAL_SCALE_LATE`, `GOAL_LATE_START` in js/data/cards.js; `MAP_GOAL_GROWTH`,
`MAP_BOSS_SCALE` in js/map-mode.js; `SURVIVAL_GOAL_SCALE` in js/survival.js),
so a data-file retune is still the shipped balance.

## Caveats to keep in mind

- The bot floor is least trustworthy in Survival (pace-sensitive) and does not
  face boss modifiers anywhere, so real boss rounds are harder than simulated.
- Difficulty tiers 2-3 (PRESSURE/AUDIT) shape the reward grid, not the curve,
  and were not simulated.
- The deck rework will move all of this. The harness reads the live files:
  `cd tools/sim && node runner.js classic 100 '{"native":true}'` re-measures
  the shipped curve in ~3 minutes.
