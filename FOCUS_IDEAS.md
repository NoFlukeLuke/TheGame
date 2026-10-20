# Focus — Modes & Ideas Backlog

A parking lot for focus-driven modes and mechanics, captured from design chats so any
future session (or a fresh chat) can pick one up. **Nothing here is built** unless it
also appears in `CLAUDE.md`. Ordered roughly by the owner's build priority.

## Shared premise (applies to almost everything below)

- **Lower the base Focus cap** so *reaching max is a frequent event, not the end of a
  long climb.* Target ~×1.5 (≈15 nodes) or lower, vs. today's ×3 at 30. Reaching max
  should be a recurring *beat* you build toward several times a round.
- **Retune generation + decay per mode.** For any "cycle to max" loop, gen should be
  high enough to max in ~3–5 good hands and decay brisk enough that idling loses it.
  The knobs already exist and are dev-tunable: `focusSpeedFormula`, `focusDecayBaseMs`,
  and the `HAND_FOCUS` per-hand-type table (`focus-config.js`).
- **The unifying primitive: "max Focus = a slot pull."** Nearly every idea below is the
  same event ("reach max → empty → get something") with a different payout and a
  different surrounding win condition. Build the lever once; reuse it everywhere.

  | Lever pays out… | becomes… |
  |---|---|
  | credits / swap / discard / time / mult | **Payout** mode (below) |
  | a random limit | **Bloom** / Growth Spurt knack (Growth Spurt SHIPPED r123) |
  | a 1-of-3 buff draft | **Survival** mode |
  | new unlocked reward tiers | **Focus** mode |
  | nothing — it *is* the goal | **max-Focus boss / node** |
  | a per-run chosen effect | **FATE** mode |

---

## SHIPPED already (normal-mode entities, r123)

These landed as tricks/knacks/sleights and are live in normal mode:
- **Dividend** (Knack) — each max Focus → +8 credits.
- **Release Valve** (Trick) — each max Focus → +1 swap & +1 discard, then −15 Focus.
- **Capacitor** (Sleight) — double-tap: 10 Focus → 10 credits, consumed.
- **Siphon** (Sleight) — double-tap: spend 15 Focus → next hand ×3 mult (once/round).
- **Trade Winds** (Knack) — max Focus −10; at round end, gain credits = half current Focus.
- **Growth Spurt** (Knack) — each max Focus → a random limit +1, then −15 Focus & no
  Focus gain for 10s (this is the built-in limiter, in place of a hard cap on the reward).

---

## 1. PAYOUT mode (spend-focus buttons) — high priority, well-specified

Score-vs-goal stays; a spend UI is added beside the meter.
- **UI:** 5 small square buttons to the LEFT of the focus meter. Add stronger visual
  dividers between each set of 10 in the meter (this mode only).
- **Buttons (each spends 10 Focus):** +5 credits · +1 swap · +1 discard · +15 seconds ·
  +10 mult to the next hand.
- **Overcharge:** if you let the meter fill to 30 before pressing a button, that press
  spends *all* of it and pays **4× that button's reward.** (So the tension is bank-and-
  cash-big vs. spend-early-and-often.)
- Open design qs: cooldown between presses? can you press mid-dance? do buttons grey out
  when you can't afford them (like Focus mode does)?

## 2. FOCUS mode (focus-as-currency) — spec'd, implement in its own chat

A ~10–15 item change list:
1. Focus no longer multiplies score. **Remove the FOCUS box** from the PIPS·MULT·FOCUS
   row; widen PIPS and MULT to fill the gap.
2. Reuse the Payout-style buttons beside the meter, but as an **unlock ladder** instead
   of flat buttons.
3. Buttons are **greyed out** until unlocked; on unlock they gain color + glow.
4. Every **5 Focus** unlocks the next reward; the button strip **scrolls up** as more
   unlock.
5. Default ladder: 5 → 1 swap · 10 → free random Trick · 15 → +15 seconds · 20 → free
   Knack · 25 → grid reshuffle · 30 → +10 credits.
6. **Grant each reward as you pass its threshold** (not on button press — passing 5 gives
   the swap, etc.).
7. At **30 (max)**, reset the meter and **randomize the ladder** for the next cycle.
8. So we need a **pool of grantable rewards** to draw the ladder from each cycle.
9. Score's role in this mode: TBD. Likely score → credits or just flavor.
10. Goal framing option A: **6-minute timer → boss**, race to bank as many rewards as
    possible before it. Option B (start here): **Zen mode** — no goal, just the loop.
11. Decay/gen retune so hitting 30 semi-consistently is achievable.

## 3. Focus-scales-hand-size — needs more juice (probably an entity, not a mode)

- **As a Knack:** every 5 Focus you currently hold raises your hand-size limit by 1.
- Not obviously its own mode yet. **Potential combo direction:** a match-3 layer where
  your combo/chain length is capped by current Focus. Flagged as under-baked — revisit.

## 4. Focus-as-timer family — add to backlog

- **Pulse (mode):** no clock; Focus decays constantly and the round ends if it hits zero.
  Playing well literally buys survival. NOTE: in this mode Focus almost certainly does
  **not** also multiply score (it's the life bar, not the multiplier).
- **Redline:** there's still a clock, but high Focus slows it and low Focus speeds it up.
- **Flatline:** Focus is an HP-like bar drained by curses/bosses, refilled by hands — the
  bridge toward the older HP/damage concept.

## 5. Prestige / natural scaling — worth exploring

- Each time the meter fills past cap, it **"prestiges"**: the live multiplier resets to
  ×1 but your **base** multiplier permanently rises for the run.
- Appeals to the owner's goal of *natural late-game scaling.* Requires the gen/decay
  retune so maxing is semi-consistent.

## FATE mode — YES, build this (its own chat)

- At the **start of each run**, a pop-up **in the grid** offers **1 of 3** options for
  *what Focus does this run.*
- Options pool (any of the ideas we've discussed): max Focus buffs a card · primes Tricks
  to replay · adds time · grants a swap/discard stock · raises a base multiplier · does
  what it does today (score mult) · slows time · **Bloom** (random limit on max) · etc.
- So the work is: (a) make all those Focus-behaviors selectable/pluggable, (b) build the
  pre-round 1-of-3 chooser overlay on the grid. **Bloom lives here as one FATE option.**

## Max-Focus win condition — two forms

- **Boss type (normal mode):** a boss round with **no score requirement** — just reach
  max Focus before time runs out. (Small, buildable; reuses meter + clock.)
- **Node type / challenge:** "reach max Focus before the clock" as a node objective;
  natural 4th requirement type alongside `hand_type` / `score_threshold` /
  `adjacent_plays`. Variants: hit once (Peak) · hold N seconds (Sustain) · hit 3× (Summit)
  · double decay (Cold Start).

## MAPS mode — backlog

- A branching, choose-your-path map instead of a linear string of samey levels. The real
  payoff is **variety of *objective*** (score nodes, focus nodes, hybrid) not just
  modifiers. Reuses the existing node-resolution plumbing; the new bits are a branch/graph
  screen and node-choice UI.

---

## SURVIVAL mode — TOP PRIORITY to build next

The mode the owner most wants. Current shape (still being refined):

- Structure like normal mode: you push toward **score thresholds = levels**.
- **But instead of a reward grid each level, you get a "pick 3" screen** (draft one of
  three buffs — tricks/knacks/sleights).
- **How fast you reach each level determines how much gold you get** (speed bonus →
  currency).
- A **shop before the boss round**, funded by that gold.
- Boss round is where score "really" matters as the test of your drafted build.

**Open question — how much does score matter?** Resolved direction: score **never fully
disappears** (a run where hand-quality doesn't register "feels off," and rightly so —
score is the only thing that measures how *well* you played, not just *that* you played).
Keep score as the level/threshold driver, use **speed-to-threshold → gold**, and let the
boss round make score the literal win condition. Refine the exact
score→level / score→gold conversion in the build chat.

---

## DELAYED GRATIFICATION mode — new, captured for later

Scoring works fundamentally differently:
- Playing any hand **adds its pips to the PIPS chip and its mult to the MULT chip, but
  does NOT score yet.** Pips and mult accumulate all round.
- **When the round timer ends, the score is finally calculated** from your accumulated
  pips × mult — and only then do you learn if you won.
- **Mult is earned by hand SIZE, not the usual sources:** 3-card = +1 · 4-card = +3 ·
  5-card = +6 · 6-card (two sets of three, or a run of 6) = +10. So **hand size starts at
  6**, and we may need to add those larger hand types (run of 6, two-sets-of-three).
- Pips are still earned by card **rank**.
- Focus's role: TBD.
- **New "fatigue" mechanic:** a cell can only be played so many times per time window.
  For this mode: **2 plays per cell per minute.** After that the cell is spent — either
  cards fall in but can't be played, or new cards skip the cell entirely (decide in build).
- **Grid size 5×5** to start.
