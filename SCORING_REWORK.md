# The scoring rework (r720, started)

## In plain words

Today every scored hand walks a list of about 170 Tricks and asks "do you own this one?"
for each. The rework turns that around: each Trick becomes its own small piece that says
which moments it cares about (a card scores, a hand is played, a round ends...), and scoring
walks your tray left to right and asks only the Tricks you own.

What that buys:
- **A second copy of a Trick counts**, because two copies are two pieces in the tray.
- **Every copy, prime and permaprime animates as its own beat**, because firing a Trick
  again is asking it again, and each ask makes its own events.
- **Tray order can mean something.**
- **Scoring gets faster** (unowned Tricks are never asked).
- **A new Trick is one small piece**, not edits inside a 1,500-line function.
- **It is the shape Godot wants** (a Resource and a script per Trick, signals for moments),
  so the port becomes translation, not redesign.

Nothing about how the game plays changes during the rework. Every stage is checked by the
golden test below: the same hands, scored the old way and the new way, must match exactly,
down to the animation's beats. Balance changes happen in their own passes, never inside a
migration pass.

## Where it stands today (measured, r719)

- `calcScore` (js/scoring.js) is one function of 1,533 lines. `hasTrick(` appears 247 times
  across js/ (126 in scoring.js, 54 in play-hand.js), `hasKnack(` 135 times.
- One scored hand makes about **178 `hasTrick` calls**, nearly all for Tricks not owned.
  Measured in the sim harness: calcScore 0.33ms a call, of which `hasTrick` is about 37%.
  A score is not slow enough to lag the game, but `findBestHand`, Autopilot and All Hands
  run calcScore thousands of times speculatively, so the saving is real there.
- `hasTrick(id)` is a yes / no. It cannot count copies, which is why a second copy does
  nothing and why only the five `SURVIVAL_STACKABLE_TRICKS` (Rich Soil and the four
  row / column line Tricks) can be held twice.
- What is already table-shaped and moves easily: `PER_CARD_PAYERS` (20 per-card rows), the
  per-card x mult list `_xl`, the timeline event format (`ledger.timeline`), `TB(id)` (a
  fused or changing Trick reading its part's BAL row), `trickFires(id)` (primes, permaprime,
  Mirror).

## The target shape

### A Trick is data plus a behaviour

- **Data** stays where it is: the pool row (js/data/tricks.js), its `BAL` row, its
  description template, its improvement ladder (`IMPROVE_PLAN` / `IMPROVE_STEP`; owner:
  every ladder keeps working exactly as now).
- **Behaviour** is a new table, `TRICK_FX[id]`, one object per Trick with a function per
  moment it cares about. Grouped one file per family under `js/trick-fx/` (classic scripts,
  loaded after scoring.js), the way Godot would hold one script per Trick.
- **An owned Trick is an instance**: the tray entry it already is (it already carries its
  line, rolled ranks, primes and `_rank`). Two copies are two instances.

### Moments (hooks)

Scoring, read-only and speculative, in today's order:

| moment | what it may do | today's code |
|---|---|---|
| `cardPips(ctx)` | add / multiply this card's pips, on its beat, once per replay | the per-card loop, `PER_CARD_PAYERS` |
| `cardMult(ctx)` | add / multiply mult on this card's beat | `_cardMultSeq`, `_xl` |
| `replays(ctx)` | name a replay source for this card | `_srcs` (QRL counts sources) |
| `handPips(ctx)` / `handMult(ctx)` | hand-level adds | the blocks after the card loop |
| `handXPips(ctx)` / `handXMult(ctx)` | hand-level multipliers | the x blocks |
| `force(ctx)` | force-trigger another Trick | Temporal Rift, Obligatory, 4x4 |
| `focus(ctx)` | extra Focus applications | `focusExtraApplies` |

After the hand (spends, counts, pays): `played`, `scaled` (today's `scalingCount`).
Elsewhere: `discard`, `swap`, `roundStart`, `roundEnd`, `levelUp`, `tick` (the clock),
`pickup`, `sell`, `boss`. These come in stage 4.

### The runner

- `ctx` carries what the hand is (cells, scoring order, components, the card being scored,
  its replay index) and the emit functions that already exist (`bPip`, `bMult`, `bPipX`,
  `bMultX`, `_ev`), so every payout still lands in the same contributions and the same
  timeline. The dance needs no change.
- **Order:** the phases keep today's order exactly (card adds, card x, hand adds, hand x,
  Focus). Inside one phase the tray is walked left to right. Adds commute, so most results
  are identical; the one place order can differ is rounding between two x mults in one
  phase (today x mult rounds to one decimal at each step). The golden test will show every
  such case; each is decided, not waved through.
- **Firing again** (prime, permaprime, Mirror, a forced trigger, a second copy) is the runner
  calling the same hook again. Each call emits its own events, which is what makes each copy
  and each replay its own beat in the dance.
- `hasTrick(id)` stays for questions that are not scoring (offers, UI, gates). It gains a
  sibling `trickCount(id)`.
- A fused Trick (`acts: [a, b]`) and Temp (`acts: [form]`) run their parts' behaviours. This is
  simpler than today's `_fid` billing: the instance that fires is the chip that flares.

### Godot mapping

| here | Godot |
|---|---|
| pool row + BAL row | a `TrickData` Resource (exported fields) |
| `TRICK_FX[id]` | a script extending `TrickBehaviour`, one virtual method per moment |
| tray instance | a `TrickInstance` (RefCounted) holding the data, tier, line, primes |
| `ctx` | a `ScoreContext` object passed to each method |
| `ledger.timeline` | an Array of event Dictionaries, played by a Tween / AnimationPlayer sequence |
| moments outside scoring | signals (`round_started`, `hand_played`, `card_discarded`...) |

## The golden test (stage 1, built)

`node tools/scoring-golden/golden.js --check` scores ten hands on a fixed 5x5 board (pair,
set of 3, runs of 3 / 4 / 5, two pair, full house, flush, straight flush, a pair with a
kicker) through the real calcScore, for:
- no Trick,
- every live Trick (190, fused pairs included) alone in the tray at v1 and at v6,
- each of those in two states: **a** mid-round and plain; **b** the first hand of a round on
  a buffed board (replays, pips, mult, x buffs) with the clock paused and the counters up,
- 40 seeded five-Trick trays (fusions, Mirror, forced fires, x order).

802 cases, about 13 seconds. Each records the hand, the score, final pips and mult, and a
fingerprint of the animation timeline and of the contributions. `--only <trick id>` runs one
Trick; `--show <case>/<hand>` prints a case in full (case keys are `<id>@<version><state>`:
`overgrowth@6b` is Cascade at v6 in state b). Without `--check` it rewrites `baseline.json`.

Verified: three runs in a row match; Cascade's number nudged 20 -> 21 failed every Cascade
case and passed again when put back.

**Coverage: 114 of 190 Tricks change a score somewhere in the 802 cases.** The other 76 pay
outside calcScore (time, credits, Focus, counters, primes, deck changes) or wait for a state
the two setups do not reach. `--coverage` lists them; they are what stage 1b is for:

> river_run high_water overclock high_pair rare_bloom full_house_streak two_pair_mult richter
> deluge release_valve wild_heart knave_power before_the_tide first_fruits early_bird
> quick_draw first_play frozen_moment cuckoo double_jeopardy woodpecker vulture ticktock
> quarter_chime second_hand hourglass magpie starling phoenix wildfire monochrome
> lucky_sevens right_time study_hall rowcol_perm_double shape_square groove assembly_line
> obligatory suggestive flood overtime feng_shui clean_sweep acorns plan_ahead sixes_perm
> fours_perm twos_retrigger prime_times queens_upgrade aces_absorb monopoly mirror
> temporal_rift tunnel_vision first_wind cull expanse kaleidoscope flow_state heartwood
> landfill stand_up scalper little_guys five_second third_down wait_four_it undue_influence
> shaky_foundation buried_treasure relentless patient_rulers marathon dam_holding

Found while building it: a Trick handed to `injectTrickAfterReward` as the pool row itself
(not a copy) keeps its `_posAssigned` and rolled fields on the row, so a later grant of the
same Trick skips its line. The dev panel's Add Trick and the event / tour fillers pass rows;
the reward screens and Builds pass copies. Not fixed here (it touches only dev and tour
paths); noted for stage 3, where instances replace rows.

## Stages

Each stage ships on its own and the game plays the same after it.

1. **The golden test** (done, r720).
   **1b.** Extend it past calcScore: play the hand through the real `playHand` in the
   harness and record what it pays (credits, seconds, Focus, counters, primes, deck
   changes), plus a discard, a swap, a round start and a level-up. Target: every live Trick
   changes something in some case, or is listed with the reason it cannot.
2. **The runner, empty.** `ctx`, the phase runner and `TRICK_FX`, called at each phase
   position inside calcScore with nothing registered. Golden test: all match. Timing
   measured before and after.
3. **Move Tricks family by family**, each pass deleting the old branches it replaces:
   per-card flat adds (the `PER_CARD_PAYERS` rows first), hand-level adds, x multipliers,
   replay sources, line Tricks, clock and time Tricks, counter / scaling Tricks, forced and
   priming Tricks, then fused pairs and Temp. Each pass: golden all match, a real hand
   played in the browser at 1440x820 and 420x900 with dev mode on (no timeline drift), and
   the number of `hasTrick(` calls in scoring printed in the commit.
4. **The other moments** (play, discard, swap, round, clock, sell...) the same way, checked
   by stage 1b.
5. **Copies, per-copy beats, tray order.** Turn on what the new shape gives: a second copy
   fires as itself, a prime / permaprime fires as its own beat. Needs the owner's calls
   (below). The parked Knack (offer owned entities; improve or take a copy) is built here.
6. **Knacks and Sleights**, the same shape.

## For the owner, later (nothing needed now)

- **Copies and versions:** today a Trick's version (v1-v6) belongs to its id, so two copies
  would share one version. Keep it shared, or give each copy its own?
- **Tray order:** should order change results (Balatro-style left to right), or stay as
  today (fixed phases) with order only breaking ties?
- **Rounding:** if moving to tray order changes a score by a rounding step (x mults in one
  phase), accept it, or keep today's code order inside a phase?
