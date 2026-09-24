# Balance pass 9.24 — the plan (outstanding work only)

Source: the owner's `Balance_-_9.23.26.xlsx`. **A large slice of this sheet is
already live**: origin/main's r326 pass (commit `ce1bd68`, from the sheet's
earlier edition) implemented 13 of the 17 removals, 7 of the 20 rarity moves,
and ~70 of the description/number changes — verified by regenerating the CSV
from today's merged code and re-diffing field by field. What is below is only
what is still to do. **`BALANCE_PASS_9.24_DIFF.txt` is the per-row checklist**
(owner's exact text per id); `balance_sheet.csv` currently holds the owner's
sheet verbatim as the input of record.

> **DO NOT run `node tools/gen_balance_sheet.js` until Tier 8.** It rebuilds
> the CSV from code and wipes the owner's pending edits.

## Outstanding totals

| what | count |
|---|---|
| entities still to change | ~80 (see the DIFF file) |
| still to **remove** | 4 — Flash Flood (`ancient_grove`), Compound (`compound`), Restless (`restless`), Flywheel (`flywheel`, Sleight) |
| **new** Tricks | 10 |
| Trick → **Knack** conversion | 1 — Three's a Crowd |
| rarity moves | 13 |
| renames | 2 — `knave_power` → **Jackpot** · `dazed` → **Fresh Start** |
| system params | exalt `heart_mult` 2 → 4 · corrupt `spade_coins` −8 → −5 |
| cross-cutting new systems (from the notes column) | ~12 (Tier 4) |

## Owner decisions needed (each blocks only its own row)

1. **Echoes (`echo_hand`)** — its new text is word-for-word The Woodpecker's
   new text ("Marks a random card every 30s; scoring it replays it 2x").
   Copy-paste accident, or two identical Tricks intended? (Old Echoes:
   "same hand type as previous replays each card.")
2. **"Legendary" (new Trick)** — is that really its name? A Trick named after
   a rarity tier reads oddly on a tile that also prints its rarity.
3. **"Inert"** — the Piggy Bank note asks for a better word for a sleight that
   can't be swapped/discarded after use. Proposal: **"Spent"**.
4. **Move as One keyword list** — proposed list to review in Tier 4h.
5. **Head Start wording** — the owner asked for "a nicer way to word" the
   decaying first-hand Focus. Proposal: *"The round's first hand adds +5
   Focus; each later hand adds one less, down to nothing."*

(Resolved since the first draft of this plan: `stand_up`'s `#ERROR!` cell —
the owner overrode it in chat yesterday and it now mirrors Column Rush; and
Worn Path's buff-plus-remove — it is already removed.)

---

## Tier 1 — The four remaining removals (small session)

Flash Flood (`ancient_grove`), **Compound** (`compound`), Restless
(`restless`) — Tricks; **Flywheel** (`flywheel`) — Sleight. Same cleanup shape
as ce1bd68's 13: pool row, `BAL`, `DESC_TEMPLATES`, per-entity code, category
lists, dead state vars. Knock-ons:
- **Compound** is the heavy one: `TRICK_TIMERS` (cooldown widget), the 45s
  bank on the round tick, `bonusMult_compound` in scoring, CLAUDE.md's r190
  note. Grep noise: the English word "compound(ing)" in comments.
- **Flywheel** exits `focusRateMods()` — speed mods become Overclock +
  Governor only. Also `FLOW_BANNED_ENTITIES`-adjacent lists, if referenced.
- Verify an old save holding a removed id drops it cleanly (tray restore,
  grid Sleight restore for Flywheel).
- `big_win` is already gone, so the **Jackpot** name is free for Tier 2.

## Tier 2 — Numbers, rarities, renames (one session)

Value-only edits; descriptions follow via `DESC_TEMPLATES` / r206 substitution.
- **Renames:** `knave_power` → Jackpot · `dazed` → Fresh Start (display only;
  ids frozen; update TERMINOLOGY.md).
- **Rarity (13):** two_pair_mult rare→epic · first_play common→rare ·
  lucky_sevens epic→rare · acorns rare→epic · plan_ahead epic→rare ·
  meditation common→rare · five_second epic→rare · third_charm epic→rare ·
  the_queen legendary→epic · warehouse rare→common · cash_out common→rare ·
  last_call epic→rare · the_wanderer common→rare.
- **Numbers with no mechanic change:** meditation 1s→2s · mockingbird every
  3→4 hands · rowcol_retrigger 50%→2-in-3 · hourglass 1-in-3→50% ·
  eye_of_storm replay ×1→×2 · quick_draw base_cost 3→4 · exalt/corrupt
  params above.

## Tier 3 — Wording-only pass (one session)

The ~25 outstanding description edits that change no behaviour (before_the_tide,
ticktock, magpie "unspent"→"", right_time, study_hall's sentence, groove,
shape_cross "5 card +", dam_holding "+3s", echo_play/bellhop/cash_out/last_call
charge lines pending 4c, governor, power_cell/life_lessons "Focus limit",
mirror, wild_heart's trailing clause, two_pair_mult's dropped clause, etc.).
Two global vocabulary moves ride along:
- **"max Focus" → "Focus limit"** everywhere the player reads it (+ keyword
  defs and handbook).
- Keep `DESC_TEMPLATES` in sync (r205 rule) and rerun the r284 voice grep
  over anything rewritten. Fix the sheet's typos on the way in
  ("autmoatically", "regardles", "insted").

## Tier 4 — Shared machinery (one to two sessions; BEFORE Tiers 5–7)

- **4a. DONE (r339): "Valid N-card hand" predicate** (`realHandOfSize`, js/hand-detect.js; wired: five_second, five_stack, little_guys, five_fodder, heavy_hand, shape_line, shape_cross, counts3CardHand for ready_set_go/third_down, light_touch) (Five for Fodder + Little Guys notes):
  "5-card hand" = a real 5-card component hand (flush, straight, full house…),
  never 4 cards plus a tagalong/penalty card. One helper over
  `handComponentsFor`; wire `five_fodder`, `little_guys`, `five_second`, and
  audit every other "N-card hand" entity for whether the rule bites.
- **4b. MOSTLY DONE (r340): Focus-limit growers + live readouts.**
  `gainFocusCap(id, n, max)` + `focusCapGains` ledger (js/focus-config.js, in
  SAVE_VARS, reset in startGame). Quick Draw (2s window, +1/proc, max +10),
  Expanse (+1 max +10, then lose half Focus — moved into onFocusMaxed's
  keepFrac), Little Guys (max +15), Slow Burn (45s per +1, max +15, live
  "current" in its grid tooltip), Head Start (+5 first hand, −1 each later
  hand, floor 0). Also Richter + Collapsing Columns: threshold advance →
  flat +10 Focus. trickLiveDesc cases added for all four Tricks.
  REMAINING from 4b: Wait For Iiiit already has its readout; Stopwatch /
  Fight the Power readouts land with 4i.
- **4c. DONE (r341): n/max charges + the INERT state** (owner's word). Every
  charged Sleight's tile and grid tooltip read `n/max` (via sleightMaxCharges,
  so Maintenance-raised ceilings print). Piggy Bank and Capacitor fire IN
  PLACE, once per round, and go inert: cardCan blocks swap/discard, playing it
  in a hand is the one way off the board (discardToPlayed accepts an inert
  sleight or the fall would delete it from the run; the cycled copy comes back
  movable with its remaining charges). `INERT_ON_USE_SLEIGHTS` +
  `sleightUseInPlace` in js/sleights-runtime.js; `.sleight-inert` wash.
- **4d. DONE (r343) except Marathon (rides Tier 7).**
  `focusExtraApplies(handName, cells)` in js/scoring.js is the one count of
  extra fMult applications, read by BOTH sites (the FOCUS chip and step 5), so
  shown and paid agree - the chip now prints the real fMult^(1+extra) (old
  Phoenix showed fMult*2 against a paid fMult^2). `handTriggersPause` is the
  Phoenix's new clause: every per-hand pause source enumerated, all
  deterministic (vulture-buffed cards, Five Second Rule, Four Horse-man's
  roll, Dam Holding/High Water runs, Sundial column, Metronome target, Double
  Jeopardy mark) - ADD A PREDICATE THERE when adding a per-hand pause.
  Kaleidoscope: 4+ suits = second application (its +4 flat Focus is gone).
  The dance plays a second, quicker focus thump per extra application with the
  focus sound doubled (`targetFocusExtra`, captured at dance start - the
  global is overwritten by speculative calcScores). Marathon = one line in
  focusExtraApplies + its pool row. The fuller staggered-chip-copy/flight
  animation from the owner's note can still be layered on later.
- **4e. DONE (r344) except the Tier-7 newcomers.** Ripple: the 30s cooldown is
  gone - each adjacent-rank card rolls a deterministic, Luck-scaled 50%
  (`luckRollDet`, stream offset 7717; `_rippleLastFire` deleted). Threepeat's
  one-of-three, correct_run and second_hand were already deterministic
  (trickPickOne / _detReplayRand); Hourglass rolls live in doDiscard, which is
  a real one-shot event, so that is correct as is. Even Better and the
  Legendary roll land with their Tricks in Tier 7.
- **4f. DONE (r342): time buffs do not stack.** `cardTimeBuffed(card)`
  (js/deck-grid.js, beside permTime) is the one predicate over
  permTime/_vulturePause; all three grant sites ask it before trickFires.
  Temporal Rift is +3s REWIND via permTime (minute gate dropped - the no-stack
  rule is the limiter; out of CD_PER_MINUTE_TRICKS), Wait Four It +2s pause,
  The Vulture +3s pause and its buff fires once per SCORE, not per replay.
- **4g. "Speed bonus" keyword + handbook entry** (Overclock note): Focus
  comes from hand complexity AND how quickly the hand followed the previous
  one. `js/keywords.js` + handbook topic.
- **4h. Move as One keyword system** — random matching Trick (not
  lowest-rarity), a visible readout of WHICH keyword matched, and a CURATED
  list (generic words excluded). **Proposed list for owner review:** marked
  row/column · pause · rewind · replay · Focus · credits · swap · discard ·
  prime · streak · corner/edge/center · permanent card buffs · each hand
  family (Set, Run, Flush, Pair, Straight, Full House) · named ranks (Ace,
  face cards, 2s/3s/7s/8s) · named suits. Excluded: time, hand, card, score,
  round, play, grid.
- **4i. Timed-charge Sleights** — one mechanism for "time = charges":
  Stopwatch (60s, 6s = 1 charge, n/12 — charge-restoring and charge-scaling
  entities see them as real charges), Fight the Power (3 min, 20s = 1
  charge), Reflect (self-discards after 60s).

## Tier 5 — Trick mechanic changes (two sessions)

Per-row spec in the DIFF file. Grouped:
- **Clock/marks:** Cuckoo → every other hand pauses 1s per 5 replays this
  round · Double Jeopardy → 2 CELLS secretly marked (cell-keyed — deliberate
  exception to r192's card-keyed rule; document it) · Woodpecker → marks
  every 30s, no alternating blocks · Echoes pending decision 1 ·
  Sands of Time → ÷2, but ÷4 in modes with rounds over 3:00.
- **Replays:** Rerun → ×1.2 pips per replay · Chorus → ×1.75 mult per
  replay (both move from escalating adds to flat multipliers per replay) ·
  Ripple → 50% chance, no 30s gate (4e) · Near Extinction → last third of
  round (was last quarter) · Encore → set-type hands of odd ranks replay
  each card · Sideways to Infinity → each 8 replays once per OTHER 8 ·
  3rd Time's a Charm → 3rd card replays 2×.
- **Focus:** Collapsing Columns → Full House +10 Focus · **Richter → ×3 mult
  and +10 Focus** (both drop threshold-advance) · Quick Draw → within 2s,
  cap 10 · Head Start → +5 first hand, −1 per later hand, floor 0, rare ·
  Expanse → +1 limit then lose HALF Focus, cap +10 · Release Valve → lose
  flat 16 Focus · Cull → discard OR swap, +1 per 2 remaining · Kaleidoscope
  → 4+ suits applies Focus multiplier twice (4d) · Study Hall → replays
  count as cards scored · Acorns → +0.1 per card, epic · Clean Sweep → +5
  Focus +5 credits · Two Pair Streak (two_pair_mult) → epic, drop the
  "breaks the streak" clause if the mechanic changed (check code).
- **Card buffs:** Royal Favour → adjacency rank-up + Queens auto-discard
  after 45s on grid · Ace Absorb → 50% chance, removes an UNSCORING card ·
  Vulture / Wait Four It / Temporal Rift → 4f no-stack versions · Hourglass
  → 50% +1 replay.
- **Economy:** Blood Diamonds → hands of ONLY hearts+diamonds, +5 credits,
  −10s (cost, not rewind) · Hard Labour → doubles from 1, per round ·
  Undue Influence → counts SET HANDS (a two pair = one).
- **Primes/forces:** Double Take → each 2 FORCE-fires your RIGHTMOST Trick
  (rides r234 force-trick) · Prime Times → primes your LEFTMOST Trick ·
  Wild Heart/Inspirato → wording only.
- **Position:** 4x4 → counts as a row/column effect, draws its line behind
  column 4 · High Water → runs pause 1s per run played this round (no
  3-run gate) · Overtime/Groove/Right Time → wording.

## Tier 6 — Sleight rework batch (one to two sessions)

- **The Queen** → a real Queen-ranked card: +10 pips, +10 mult, 5s pause,
  **Royal Reach** (new mechanic: joins any hand containing a card in its
  row, column or diagonal at any distance; swaps the same way) — replaces
  the wild-rank TBD. Epic.
- **Warehouse** → counts as 2 cards toward a flush, no rank. Common.
- **Fresh Start** (`dazed`) → fires on DISCARD: shuffle all grid cards into
  the deck and redeal; costs 3 credits and 10s.
- **Wanderer** → passive: while on grid, ANY two cards may swap regardless of
  position; still spends swap stock; n/5 charges. Rare.
- **Magnet** → pulls every card of the tapped rank to replace itself and its
  adjacent cards via discard. Free of time/stock, but each replaced card
  COUNTS as a discard for scaling entities. Owner wants the animation redone:
  ranks visibly fly in; Magnet and the displaced cards visibly discard.
- **Sandbagger** → discard with a pair: rewind = pair's rank; +50% per
  additional set member; no below-rank-8 gate; n/3. **Last Call** → no
  final-minute gate, 3 charges, rare. **Cash Out** → 3 charges, rare.
- **Reflect** → cannot be played, self-discards after 60s (4i), no
  once-per-round lock. **Soul Mirror** → replays per count of that rank in
  the DECK; cannot be played.
- **Stopwatch / Fight the Power** → 4i timed-charge model. **Audit Fight the
  Power against the live boss roster** (owner doubts it works — the
  `cellCountsForTriggers` gap says audit, don't assume): does it suppress
  stones, curses, holds, score-side effects while on grid?
- **Shift Swap / Recycler** → trigger is two scored CARDS adjacent (was two
  hands); Petty Cash stays two hands. **Slow Burn** → per 45s, cap +15 (4b).
  **Piggy Bank / Capacitor** → Spent state (4c). Siphon → "discards on use"
  wording.

## Tier 7 — New content (one to two sessions)

Ten new Tricks (mint ids; TERMINOLOGY.md; BAL + DESC_TEMPLATES; pool, tags,
improve/force vocabulary; several are per-card ×mult — the r233 machinery):

| name | tier | effect |
|---|---|---|
| Obsessed | legendary | each heart ×mult = 1+(credits/100) |
| Buried Treasure | legendary | each diamond ×(1 + 0.1 per diamond scored this game) mult |
| Legendary (name pending, decision 2) | legendary | each scored spade: (luck/2)% chance to ×1.1 your credits |
| Patient Rulers | epic | if paused/rewound this round, face cards ×1.5 mult |
| Even Better | epic | even cards 66% chance ×2.2 pips (4e) |
| What are The Odds | epic | odd cards ×1.7 mult |
| Feelin Lucky | epic | 5 rolled ranks ×1.25 mult; SELL costs 30% of credits and rerolls the ranks instead — 3 times, then it really sells |
| Critical | epic | flush-family hands ×3 mult |
| Twinners | epic | set-family hands ×3 pips |
| Marathon | epic | run-family hands apply the Focus multiplier twice (4d + animation) |

Plus the conversion: **Three's a Crowd** becomes a rare-or-epic KNACK —
"hands count as 1 card bigger" (pair = 3-card, two pair = 5-card) for
Trick/entity triggers only, never for Natural Scaling; tagalongs never count
toward the size. Retire the Trick id per TERMINOLOGY rules.

Feelin Lucky's sell intercept touches the tray-sell flow (r278/r279) — the
confirm row must state the 30% cost and the reroll, and the third sell must
really sell.

## Tier 8 — Mode/UX asks from the notes (one session)

- **Rain Check:** Flow wording ("adds 30 seconds to the timer"); a way to
  SKIP the pick-of-three in Survival/Flow — owner's proposal: CONFIRM pressed
  twice with nothing selected = skip. (His third ask — tapping a selected
  offer again unselects it — already works per r280; verify and tick.)
- **More Better:** offer only in modes with frequent reward grids (extend the
  r323 `modeHasNoRewardGrid` ban — it should also exclude modes where grids
  are bought-only or rare).
- **Fight the Power** audit findings (Tier 6) written up for the owner.

## Tier 9 — Regen, docs, sim (one session)

- Re-run `node tools/gen_balance_sheet.js` — NOW the CSV and code agree; the
  10 new Tricks and the new Knack appear with real ids.
- Docs: CARD_EFFECTS.md (no-stack time buffs, Spent state), TERMINOLOGY.md
  (renames, new ids, keyword additions), CLAUDE.md drift (Compound in the
  r190 note and cooldown list; focusRateMods table; the r183 clock-mark
  table), OPEN_DECISIONS.md.
- **Run `tools/sim`** (its README: rerun after any hand/deck value change) —
  yesterday's pass plus this one is a large net buff; report the win-rate
  delta and let the owner decide on goal retunes.

## Sequencing

1 → 2 (removals free nothing here, but do them first anyway — Compound's
code touches scoring) → 3 → **4 before 5/6/7** → 5/6/7 in any order → 8 → 9.
Bump `BUILD` per commit; syntax-check; deploy with
`git push origin HEAD && git push origin HEAD:main`; re-run the unmerged-
branch check from CLAUDE.md before and after — this pass is exactly the
kind of multi-session work that r283 warns loses branches.
