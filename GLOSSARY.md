# TheGame — Trick / Sleight / Knack Style Guide

Living house-style for all card descriptions. Every redesign batch is written to
this. Player-facing text follows these rules exactly; if a card needs to break a
rule, that's a design decision to call out, not a default.

## Trigger — *when* an effect fires (subject-first)
Pattern: **"[Subject] score(s) +N …"** — never give / adds / worth / contribute / played / selected.
- Scored in a played hand → **"Runs score +10 pips per card."**
- Discarded → **"When discarded, …"**
- Swapped → **"When swapped, …"**
- Lands on grid → **"When drawn, …"**
- Always-on → **"While on the grid, …"**
- Sleight action → **"Play this: …"**

## Effect — *what* you gain
- Score parts use **"+N pips" / "+N mult"** (and "score(s)" as the verb).
- Resources are **added**, not scored: **"+N Focus", "+N seconds", "+N coins"**.
- Reserve the word *score* for pips / mult / final score — never "scores N focus".
- Always state **"per card"** when an effect scales per card; otherwise it applies once to the hand.

## Multipliers
- **No `×score`.** Every multiplier is **`×N mult`** or **`×N pips`** — decided per card (don't auto-pick).
- Symbol is the **×** glyph, number first: `×2 mult`, `×1.5 Focus`.
- `×2 mult` (multiplies the mult component) is different from `+2 mult` (adds to it) — keep them distinct.

## Hands
- **Run** = any run or straight (length 3+). A trick that says "Runs" hits all run lengths.
- **Straight** = a 5-card Run. We keep the word "Straight" (less mental load); the hands list shows both, e.g. "Straight (Run of 5)".
- **Straight Flush** kept as-is.
- **Set** = 2+ cards of the same rank: **set of 2 / set of 3 / set of 4**. Replaces pair / three-of-a-kind / four-of-a-kind everywhere.
- **Full House** and **Two Pair** are kept as named exceptions (not rewritten into set language). Tutorial clarifies that "set" means any 2+ of a kind.
- Hand-size wording: **"N-card hand"**.

## Ranks
- Range wording: **"Rank 5 and below"** (this **includes Ace**).
- **Ace:** odd, prime, scores **11 pips**, counts as Rank 5 and below, and can also make high runs (Q, K, A).
- **Face cards (J/Q/K):** never even, odd, or prime.
- Prime ranks: **A, 2, 3, 5, 7**. Even/odd by rank value (faces excluded).

## Focus (core scoring mechanic — already in code)
- Focus is a **meter** that **rises** when hands are played quickly or are more complex, and **decays slowly** over time. Resets each round.
- Default **30 nodes = 3 thresholds of 10**. Min/max can be changed by tricks/knacks.
- **Score multiplier:** `1 + 0.1 × max(0, focusNodes − 10)` → ×1 through node 10, then +0.1 per node (×2 at 20, ×2.5 at 25, ×3 at 30).
- Focus is the **third element of score, shown next to PIPS and MULT**: final score = **pips × mult × Focus**. The MULT box stays "pure" (focus is its own multiplier applied at the end of the sequence).
- The on-screen Focus multiplier **defaults to ×1** (not 0); it first ticks up at 11 focus → ×1.1.
- **Threshold** = every 10 nodes; crossing one visually resets the meter and drops a "blip" marker (multiplier stepped up). "Advance to the next threshold" = jump focusNodes up to the next multiple of 10, capped at max.
- Units: say **"+N Focus"** in player text (1 focus = 1 node).

## Card states
- **Charges** = durability (total uses before the card is destroyed): **"Charges: 3"**.
- **Use** = per-round usage. Sleights can be used **once per round** (global rule, surfaced in tooltip — not repeated on every card).
- **Inert** = the card stays on the grid but **cannot be interacted with** (not selected, swapped, discarded, or scored). Hovering "inert" shows that explanation.
- **Retrigger** = fires its effect again. Wording: **"retriggers"** (once) or **"retriggers N times"** (N>1).
- **Force-trigger** (distinct from retrigger) = makes a condition fire that normally wouldn't (e.g. a "+3 per diamond" trick force-triggered gives +3 even for a non-diamond). Per-card tricks give their per-card bonus once per force-trigger; flat tricks give their bonus once per force-trigger. *(Full mechanic TBD.)*
- **Primed** = the next *normal* trigger fires one extra time (a retrigger stack). "Primed to retrigger once" → next trigger fires twice.

## Buffs
- **Buff** = a single permanent stat modifier on a specific card (e.g. "+5 mult" is one buff; "+10 pips" is a second buff).
- Buffs are **permanent by default** — don't say "permanently". Temporary ones must state scope: **"this round" / "this hand" / "until next boss"**.

## Money & time
- **Coins**, never "gold".
- Round clock: **pause the clock for N seconds**; a pause can be extended by another pause (durations stack).

## Scoring order (engine fact)
- Cards are scored in **selection (tap) order**, preserved from `selected` → `findBestHand` → `calcScore`.
- Hand **detection is order-agnostic** (`detectHand` sorts ranks), so a run is recognized regardless of tap order. Sequence-dependent tricks must explicitly compare tap order.

## Naming & data conventions (from the redesign CSV)
- **Player-facing names: Title Case.** Backend ids: **lowercase_snake_case**.
- Use the `name_new` column. On duplicate `name_new`, the entity **first in sheet order keeps the name**; the later one is renamed after its effect.
- `name_new = "remove"` (or old Bonus Card rows marked remove) → **delete that entity**.
- Blank-id rows are **new entries** → assign new lowercase ids.
- `base_cost` is unreliable in the sheet → ignore bad values; price by rarity.
