# Balance pass 9.24 — the plan

Source: the owner's `Balance_-_9.23.26.xlsx` diffed against the repo's
`balance_sheet.csv` as generated from code at commit `87c8a20`. The owner's
sheet is now **imported over `balance_sheet.csv`** (his 322 rows, blank Excel
rows dropped), and the full field-by-field diff is committed beside this file
as **`BALANCE_PASS_9.24_DIFF.txt`** — that file is the working checklist; this
file is the order of battle.

> **DO NOT run `node tools/gen_balance_sheet.js` until this whole pass is
> done.** It rebuilds the CSV from code and would wipe the owner's edits. The
> regen is Tier 9's job, after the code has caught up.

## The totals

| what | count |
|---|---|
| entities edited | **178** (152 Tricks, 24 Sleights, 2 system rows) |
| marked **remove** | **17** (16 Tricks + 1 Sleight) |
| **new** Tricks (rows with no id) | **10** |
| Trick converted to a **Knack** | 1 (Three's a Crowd) |
| rarity moves | 20 |
| renames | 2 (Knave for the People → **Jackpot** · Dazed & Confused → **Fresh Start**) |
| Knacks touched | **0** |
| system params | exalt `heart_mult` 2 → 4 · corrupt `spade_coins` −8 → −5 |

Roughly 60 of the 158 description edits are wording-only normalisation
("Runs ×mult" → "Runs score ×N mult", "max Focus" → "Focus limit"); the rest
are real number or mechanic changes. Every one is in the DIFF file.

## Owner decisions needed (each blocks only its own row)

1. **Stand-Up (`stand_up`)** — the new description came through as `#ERROR!`
   (Excel eats a cell that starts with `+`, `=` or `x`). What should it read?
   Old text: "+10 pips for each charge remaining across all your Sleights."
2. **Echoes (`echo_hand`)** — its new text is word-for-word The Woodpecker's
   new text ("Marks a random card every 30s; scoring it replays it 2x").
   Copy-paste accident, or are two identical Tricks intended?
3. **Worn Path** — buffed to +50 pips AND marked "remove". Remove wins unless
   told otherwise (same double-signal on Compound, Huddle, Escalation — all
   treated as remove).
4. **"Legendary" (new Trick)** — is that really its name? A Trick named after
   a rarity tier will read oddly on a tile that also prints its rarity.
5. **"Inert"** — the Piggy Bank note asks if there's a better word for a
   sleight that can no longer be swapped/discarded after use. Proposal:
   **"Spent"**. Whichever word wins becomes a keyword.
6. **Move as One keyword list** — proposed list to review, in Tier 4h below.

---

## Tier 1 — Removals (one session)

Take these out of the pools, `BAL`, `DESC_TEMPLATES`, and their per-entity code
in `js/scoring.js` / `js/play-hand.js` / elsewhere. Grep each id; watch for the
English word "compound" in unrelated comments.

**Tricks (16):** Flash Flood (`ancient_grove`) · Worn Path (`worn_path`) ·
Redline (`redline`) · Compound (`compound`) · Second Nature (`second_nature`) ·
Shock (`trinity`) · Last Stand (`last_stand`) · Fertile Ground
(`fertile_ground`) · Huddle (`huddle`) · Veteran (`veteran_bonus`) · Prolific
(`prolific`) · Snowball (`snowball`) · Jackpot (`big_win`) · Escalation
(`escalation`) · Restless (`restless`) · Feedback Loop (`feedback_loop`).

**Sleights (1):** Flywheel (`flywheel`).

Knock-ons to clean in the same session:
- **`PER_CARD_PAYERS`** (js/scoring.js): Shock (`trinity`) has a row.
- **`TRICK_TIMERS` / cooldown widget**: Compound is wired (45s bank on the
  round tick). Redline is in the r190 xMULT pool; Last Stand too — the r190
  "pools are 10 and 10" counts in CLAUDE.md will drift, update the note.
- **`focusRateMods()`** (js/focus-config.js): Second Nature (complexity ×2)
  and Flywheel (speed ×1.5) both die. After this: complexity = Shorthand only,
  speed = Overclock + Governor.
- **Escalation**: its r205/r207 `handsPlayedRound` payout code.
- **Build recipes / synergies** (js/combos-aim.js, SYNERGY_COMBOS.md) and
  Move as One's keyword matching — check none reference removed ids.
- Old saves holding a removed Trick: the tray restore should drop an id that
  no longer resolves rather than render a blank chip — verify, don't assume.
- **`big_win` must go before Tier 2's rename**, since Knave for the People
  takes its freed name "Jackpot".

## Tier 2 — Numbers, rarities, renames, costs (one session)

Everything where the mechanic is untouched and only a value moves. Most are a
`BAL` edit (descriptions follow via `DESC_TEMPLATES` / the r206 substitution);
rarity is a pool-field edit. Full values in the DIFF file. Highlights:

- **Rarity moves (20):** correct_run legendary→rare · two_pair_mult rare→epic ·
  lucky_sevens epic→rare · plan_ahead epic→rare · nines_mult rare→epic ·
  acorns rare→epic · row_power common→rare · first_play common→rare ·
  meditation common→rare · landfill common→epic · magician rare→common ·
  third_charm epic→rare · five_second epic→rare · spade_flood rare→epic ·
  kingfisher epic→rare · the_queen legendary→epic · warehouse rare→common ·
  cash_out common→rare · last_call epic→rare · the_wanderer common→rare.
- **Renames:** `knave_power` → **Jackpot** · `dazed` → **Fresh Start**.
  Update TERMINOLOGY.md (ids stay frozen).
- **Pure retunes** (sample; ~35 total in the DIFF): Quake +3→+5 mult/card ·
  Enriched +40→+100 · Unsummit level×4→×2 · Nimble +5→+10 · Full Load
  +6→+10/card · First Fruits +2→+3 · Sapling +2→+5 · Early Bird +3→+5 ·
  Night Owl +1→+3 · The Heron +3→+10 · The Swift → 5 mult/10s · Kingfisher
  /5s→/2s · Traveler every 3→4 hands · Rainbow +4→+16 mult/card · Balance
  +2→+5 · Diversity +2 flat→+5 per card · Power Line +2→+5 · Echo Location
  50%→2-in-3 · Stretch ×2→×4 · Stand Up (column) +2→+5 · Lie Down +2→+10 ·
  Ley Line +2 once/min→+1 no gate · Perfect Ten every 10→9, +1→+3 ·
  Meditation 1s→2s · Combo Score +2→+4 · More Better +4→+5 · Wild Side
  +3→+6 · Hourglass 1-in-3→50% · Every Day Essentials rank≤6, rank×3 pips ·
  Face Value → +10 pips · Men of Repute +1→+5 mult · Dark Matter half→full
  time · quick_draw base_cost 3→4 · exalt/corrupt params above.

## Tier 3 — Wording pass (one session)

The ~60 description edits with no behaviour change. Two global vocabulary
moves ride along:

- **"max Focus" → "Focus limit"** everywhere the player reads it (Expanse,
  Little Guys, Power Cell, Slow Burn, Release Valve, handbook, keyword defs).
- The normalised verb shape: **"X scores +N"** / "Score ×N pips" (Aftershock,
  Magnitude, Twenty-One, First Light, Deep Breath, Interest, Portfolio,
  Undertow, Sediment, Tick-Tock, Quarter Chime, Dam Holding, Wave Amp, Eagle
  Eye, Blackjack, edge/shape tricks, sleight charge lines, and the rest
  flagged wording-only in the DIFF).

Keep `DESC_TEMPLATES` in sync (r205 rule: the sentence must regenerate from
BAL), and rerun the r284 voice grep (`because|so you can|deliberately…`) over
anything rewritten.

## Tier 4 — Shared machinery (one to two sessions; BEFORE Tiers 5–7)

New cross-cutting systems that many rows below depend on. Build each once.

- **4a. "Valid N-card hand" predicate.** Owner's rule (Five for Fodder +
  Little Guys notes): "5-card hand" means a real 5-card component hand —
  flush, straight, full house etc. — never 4 cards plus a tagalong/penalty
  card. One helper over `handComponentsFor`; apply to `five_fodder`,
  `little_guys`, `five_second`, and audit every other "N-card hand" entity
  (Full Load, Nimble, Ready Set Go, shape tricks) for whether the rule bites.
- **4b. Live readouts in descriptions.** `(current: n | max: m)` rendered
  live — `trickLiveDesc` already exists, extend it and wire: Quick Draw
  (max 10), Head Start (current countdown), Little Guys (max 15), Expanse
  (max 10), Slow Burn (max 15), Wait For Iiiit (current chance), Stopwatch
  (remaining time, live), Fight the Power (remaining time).
- **4c. Sleight charge display `n/max` + the "inert/Spent" state.** Every
  charged Sleight prints remaining/max (owner: "n/5 charges"), one renderer
  change (both grid paths — the r161 rule — plus tooltips). Spent state:
  Piggy Bank and Capacitor stay on the grid but can't be swapped/discarded
  (`cardCan` gate) — pending the naming decision above.
- **4d. "Focus multiplier applies twice."** Shared mechanism for The Phoenix
  (existing), Kaleidoscope (changed) and Marathon (new). Owner's animation
  spec (Marathon note): the FOCUS chip gets a staggered copy of itself behind
  it, a chip flight when the second application lands, and a doubled
  focus-adjacent sound (like Flow's extra-reward stingers).
- **4e. "One of the following" random payout picker.** Rogue Wave (+80 pips
  OR +20 mult OR +10 Focus), Threepeat (rewind 9s OR +9 mult OR +9 Focus),
  Second Hand (+5 mult OR +10 pips). The scoring ones MUST roll
  deterministically (`_detReplayRand`-style, keyed on hand/card) because
  `calcScore` runs speculatively on every preview — the r217 Rerun rule.
- **4f. Time buffs do not stack** (one card, one time buff): Temporal Rift
  (+3s rewind), Wait Four It (+2s pause), The Vulture (+3s pause). One
  predicate over `permTime`/`_vulturePause`.
- **4g. "Speed bonus" keyword + handbook entry** (Overclock note): tooltip
  says Focus comes from hand complexity AND how quickly the hand followed the
  previous one. Add to `js/keywords.js` + the handbook topic.
- **4h. Move as One keyword system.** Needs a visible readout of which
  keyword matched, and a CURATED keyword list — generic words (time, hand,
  card, score, round, play) excluded. **Proposed list for owner review:**
  marked row/column · pause · rewind · replay · Focus · credits · swap ·
  discard · prime · streak · corner/edge/center · permanent card buffs ·
  each hand family (Set, Run, Flush, Pair, Straight, Full House) · named
  ranks (Ace, face cards, 2s/3s/7s/8s/9s/10s) · named suits.
- **4i. Timed-charge Sleights.** One mechanism for "time on grid = charges":
  Stopwatch (60s, 6s = 1 charge, 12 charges — charge-restore entities and
  charge-scaling entities see them as real charges), Fight the Power (3 min,
  20s = 1 charge), Reflect (discards itself after 60s).

## Tier 5 — Trick mechanic changes (two to three sessions)

Grouped by the system they touch; per-row spec is in the DIFF file.

- **Clock marks:** Minute Hand → every 30s, next hand ×2 mult (drops the
  prime/charge model — r209's "primed" section retires) · Second Hand →
  every 10s, next hand +5 mult OR +10 pips (4e) · The Cuckoo → every other
  hand pauses 1s per 5 replays this round · Sands of Time → ÷2, but ÷4 in
  modes with rounds over 3:00 (note: mode-aware divisor).
- **Marks on cards/cells:** Double Jeopardy → 2 CELLS secretly marked
  (cell-keyed — deliberate exception to the r192 card-keyed rule; note it) ·
  The Woodpecker → marks every 30s, no alternating blocks · Echoes pending
  decision 2.
- **Replays:** Rerun → ×1.2 pips per replay · Chorus → ×1.75 mult per
  replay (both move from escalating adds to multipliers) · Eye of the Storm →
  highest card replays 2× · Ripple → 50% chance, no 30s gate (deterministic
  roll, 4e rule) · Near Extinction → last third of round · Encore → set-type
  hands of odd ranks replay each card · Sideways to Infinity → each 8
  replays once per OTHER 8 · 3rd Time's a Charm → 3rd card replays 2×.
- **Focus:** Collapsing Columns → Full House +10 Focus · Richter → 4oK
  ×3 mult +10 Focus (both drop threshold-advance) · Wildfire → streak of 3
  = +5 Focus · Quick Draw → within 2s, +1 limit, cap 10 · Head Start →
  +5 Focus first hand, −1 each later hand, floor 0 (owner asks for nicer
  wording — propose one) · Expanse → +1 limit then lose half Focus, cap
  +10 · Little Guys → cap +15 (4a rule) · Wellspring → +1 mult per 10
  Focus generated · Release Valve → lose flat 16 Focus · Cull → discard OR
  swap, +1 Focus per 2 remaining · Kaleidoscope → 4+ suits applies Focus
  multiplier twice (4d) · Study Hall → replays count as cards scored.
- **Card buffs:** Heartwood → center-most card +5 pips +2 mult (define
  center on even boards) · Royal Favour → adjacency buff + Queens
  auto-discard after 45s on grid · Ace Absorb → 50% chance, removes an
  UNSCORING card · The Vulture / Wait Four It / Temporal Rift → 4f no-stack
  versions · Hourglass → 50% +1 replay.
- **Mult/pips models:** Rich Soil → all cards +1 mult (was +2 pips — big) ·
  Old Growth → cards add their PIP VALUE to mult (was perm-bonus only —
  big) · Compost → +2 mult per discard · Landfill → +1 mult per card per
  discard-or-swap used · Kindling → +4 MULT × streak · Tidal Forces →
  +5 mult per card · Get Even → even cards +4 pips · Odd One In → odd
  cards +3 mult · Jackpot (knave_power) → ×2 pips per Jack on grid ·
  Heads of State → King + any other royal · Scalper → ×1+0.25 MULT per
  missing charge · Rising Tide → 1+1 mult per level (wording) · Hard
  Labour → doubles from 1, per round.
- **Economy/credits:** Blood Diamonds → hands of ONLY hearts+diamonds, +5
  credits, −10s · Undue Influence → counts SET HANDS (two pair = one) ·
  Clean Sweep → +5 Focus +5 credits.
- **Primes/forces:** Double Take → each 2 FORCE-fires your rightmost Trick
  (rides r234 force-trick) · Prime Times → primes your LEFTMOST Trick ·
  Inspirato → wording only.
- **Position:** Feng Shui → +3 pips per hand scored with a row/col buff ·
  4x4 → counts as a row/column effect, draws its line behind column 4 ·
  Overtime/Assembly Line/Groove → wording · High Water → runs pause 1s per
  run played this round (no 3-run gate) · Tide Table → 1+0.25× per run.

## Tier 6 — Sleight rework batch (one to two sessions)

- **The Queen** → a real Queen-ranked card: +10 pips, +10 mult, 5s pause,
  **Royal Reach** (new mechanic: selectable into any hand containing a card
  in its row/column/diagonal at any distance; swappable the same way) —
  replaces the wild-rank TBD. Epic now.
- **Warehouse** → counts as 2 cards toward a flush, no rank. Common.
- **Fresh Start** (`dazed`) → on_discard: shuffle all grid cards into the
  deck and redeal; costs 3 credits and 10s.
- **Wanderer** → passive: while on grid, ANY two cards may swap regardless
  of position; still spends swap stock; n/5 charges.
- **Magnet** → pulls every card of the tapped rank to replace itself and
  adjacent cards via discard. Free (no time/stock), but each replaced card
  COUNTS as a discard for scaling entities. Owner wants the animation redone:
  cards visibly fly in, the displaced ones visibly discard.
- **Sandbagger** → discard with a pair: rewind = pair's rank; +50% per
  additional set member. **Last Call** → no final-minute gate, 3 charges.
  **Cash Out** → 3 charges, rare.
- **Reflect** → cannot be played, self-discards after 60s (4i). **Soul
  Mirror** → replays per count of that rank in the DECK; cannot be played.
- **Stopwatch / Fight the Power** → the 4i timed-charge model; verify Fight
  the Power actually suppresses live boss effects (owner doubts it — the
  known `cellCountsForTriggers` gap says audit, not assume).
- **Shift Swap / Recycler** → trigger is two scored CARDS adjacent (was two
  hands); Petty Cash stays two hands. **Slow Burn** → per 45s, cap +15.
  **Piggy Bank / Capacitor** → Spent-state (4c). Governor/Siphon/Echo/
  Bellhop → wording.

## Tier 7 — New content (one to two sessions)

Ten new Tricks (ids to mint; TERMINOLOGY.md entries; BAL + DESC_TEMPLATES;
pool, tags, force/improve vocabulary):

| name | tier | effect |
|---|---|---|
| Obsessed | legendary | each heart ×mult = 1+(credits/100) |
| Buried Treasure | legendary | each diamond ×(1 + 0.1 per diamond scored this game) mult |
| Legendary (name pending) | legendary | each scored spade: (luck/2)% chance to ×1.1 your credits |
| Patient Rulers | epic | paused/rewound this round → face cards ×1.5 mult |
| Even Better | epic | even cards 66% chance ×2.2 pips (deterministic roll, 4e rule) |
| What are The Odds | epic | odd cards ×1.7 mult |
| Feelin Lucky | epic | 5 rolled ranks ×1.25 mult; SELL costs 30% of credits and rerolls the ranks instead, 3 times, then really sells |
| Critical | epic | flush-family hands ×3 mult |
| Twinners | epic | set-family hands ×3 pips |
| Marathon | epic | run-family hands apply the Focus multiplier twice (4d + its animation) |

Plus the conversion: **Three's a Crowd** becomes a rare-or-epic KNACK —
"hands count as 1 card bigger" (pair = 3-card, two pair = 5-card) for
trigger purposes only, never for Natural Scaling. Tagalongs don't count
toward the size. Retire the Trick id per TERMINOLOGY rules.

Feelin Lucky's sell intercept touches the tray-sell flow (r278/r279) — the
confirm row must state the 30% cost and the reroll.

## Tier 8 — Mode/UX asks from the notes (one session)

- **Rain Check:** Flow wording ("adds 30s to the timer"); add a way to SKIP
  the pick-of-three in Survival/Flow (owner's proposal: CONFIRM pressed twice
  with nothing selected = skip); tapping a selected pick-of-three offer again
  unselects it.
- **More Better:** offer it only in modes with frequent reward grids (extend
  the r323 `modeHasNoRewardGrid` ban the other way — it should also skip
  modes where grids are rare, e.g. bought-only).
- **Fight the Power audit** results from Tier 6 written up for the owner.

## Tier 9 — Regen, docs, and a sim sweep (one session)

- Re-run `node tools/gen_balance_sheet.js` — NOW the CSV and code agree.
- Docs: CARD_EFFECTS.md (new card states/buffs, no-stack rule),
  TERMINOLOGY.md (renames, new ids, Spent keyword), CLAUDE.md notes that
  drifted (r183 clock-mark table — Second Hand/Minute Hand changed again;
  r190 pool counts; focusRateMods table), OPEN_DECISIONS.md.
- **Run `tools/sim`** (its README: rerun after any hand/deck value change).
  This pass is a large net buff — Rich Soil +1 mult on every card, Rainbow
  +16 mult/card, Enriched +100, Old Growth pip-value-to-mult — so expect the
  goal curves to need a look. Report the win-rate delta; retune only on the
  owner's say.

## Sequencing

1 → 2 (big_win's name frees Jackpot) → 3 → **4 before 5/6/7** → 5/6/7 in any
order → 8 → 9. Bump `BUILD` in js/menu.js every commit; validate with the
syntax check; deploy `git push origin HEAD && git push origin HEAD:main`.
