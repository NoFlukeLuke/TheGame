# Exalt / Corrupt (archived r432)

A per-card suit mechanic. Playing a card in a certain way, twice, permanently
**exalted** it (gold glow, a pure buff) or **corrupted** it (purple glow, a bigger
buff with a cost). Spec'd in r45, paused by the owner in r50 because it was
interfering with play, kept behind an off-by-default toggle until r432, then
removed from the code and archived here. Owner's note: maybe a mode or DLC later.

**The full code is in git at r431** (`git show r431-commit:js/play-hand.js`, or
`git log -S exaltCorruptTotals`). Everything below is what that code did.

## The rules

State is **permanent and mutually exclusive**: whichever locks first wins, and a
locked card never changes again (`exaltCard` / `corruptCard` cleared the other flag).
Trigger counters lived **on the card object**, so they tracked the physical card
across deck cycles and reset only on a new run. Replays counted as plays (r370).

### What each state paid (per scored card, per replay)

| suit | exalted | corrupted (buff / cost) |
|---|---|---|
| ♣ | +10 pips | +25 pips / -3 mult |
| ♦ | +3 credits | +5 credits / -20 pips |
| ♥ | +4 mult (was +2 until the 9.24 balance pass) | +5 mult / -5 seconds |
| ♠ | +4 seconds | +7 seconds / -5 credits (was -8 until 9.24; old code comments still said -8) |

Costs never went into debt: hand pips floored at 0, mult floored at 1, credits and
the clock clamped (`Math.max`). Three corrupted clubs in one hand = +75 pips / -9 mult.
Tuning lived in `BAL._exalt` / `BAL._corrupt` (js/data/balance.js) and two rows of
`balance_sheet.csv`.

### What triggered each state

| suit | exalts when | corrupts when |
|---|---|---|
| ♣ | scored in a hand with **3+ clubs**, 2x (`_clubPackPlays`) | scored as the **only club** in a hand, 2x (`_clubSoloPlays`) |
| ♥ | scored as the **only heart** in a hand, 2x (`_heartSoloPlays`) | **swapped, then missing from the next scored hand**, or discarded while in that state, 1x (`_heartSwapPending`) |
| ♠ | scored in the **first 30 seconds** of a round, 2x (`_spadeEarlyPlays`) | **discarded** 2x (`_spadeDiscards`) |
| ♦ | scored while credits **< 5**, 2x (`_diaPoorPlays`) | scored while credits **> 65**, 2x (`_diaRichPlays`) |

The design idea: each suit watches a different action (hand composition, swapping,
timing, money), so the deck slowly records how you played it.

## How it was wired (r431)

| where | what |
|---|---|
| `js/combos-aim.js` | `exaltCorruptEnabled`, persisted in localStorage key `exaltCorruptEnabled`, default false |
| `index.html` (pause menu Settings) + `js/dev-panel.js` | the "Exalt / Corrupt" checkbox, `toggleExaltCorrupt`, synced in `initDevMode` |
| `js/scoring.js` | `exaltCorruptTotals(cards, reps)` returned `{pips, mult, coins, time}`; `calcScore` called it per card inside the card loop (`_ec1`), added mult per card (`_cmAdd`) and summed pips after the loop (`_ecPipAcc`); `contrib` rows with `source:'exalt'`; `mult < 1` floor and `totalPips < 0` floor existed for corrupt costs |
| `js/play-hand.js` | coins and time paid after scoring (`_ecPlay`, replay-weighted from `_handRetrigByCell`); the whole trigger block for ♣ ♥ ♠ ♦; the ♥ swap-probation resolution |
| `js/input.js` (`doSwap`) | set `_heartSwapPending` on a swapped heart |
| `js/discard.js` (`doDiscard`) | ♠ discard counter and the pending-♥ corruption |
| `js/sleights-runtime.js` | `exaltCard`, `corruptCard`, `exaltRandomCard`; the card tooltip printed "Exalted" / "Corrupted" |
| `js/deck-grid.js` | `_exalted`, `_corrupted`, `_heartSwapPending` and the seven counters in `DURABLE_CARD_FIELDS` |
| `js/card-fall.js` + `css/style.css` | `.exalted` (gold #ffd700 glow) / `.corrupted` (purple #8844cc glow) |
| `js/score-dance.js` | contribution display name "Exalt" / "Exalt / Corrupt" |

### Entities that used it (all already disabled before r432)

- **The Good Friend** (Sleight, rare, on_play, 3 charges): played in a hand, exalts all 8 neighbours.
- **Not a Friend** (Sleight, rare, on_discard, 3 charges): discarded, corrupts all 8 neighbours.
- **Shepherd** (Sleight, common, on_draw, infinite): drawn onto the grid, exalts one random card.
- **Dark Matter** (Trick, not in any pool): corrupted cards in a hand add +5 pips each.

The three Sleights were commented out of `SLEIGHT_POOL`; their activation cases in
`sleights-runtime.js` were removed with the mechanic.

## Traps it taught (still worth knowing for a revival)

- **Replay weighting.** `exaltCorruptTotals` paired `reps` with `cards` by index; dropping
  an entry from one list shifted every payout onto the wrong card (HISTORY.md, r370 area).
- **Durable fields.** A card is rebuilt each time it leaves the board; the flags and
  counters survived only because they were in `DURABLE_CARD_FIELDS`.
- **The clock.** The ♠ time payout had to clamp to the round cap (`crunchNoRoundCap`),
  and the 30-second window read `roundStartSeconds - roundSeconds`.
- **Naming.** "Corrupted" collides with any future hostile-card idea; CARD_MECHANICS.md
  proposed NOTICE / ESCALATION for that reason.
- `_devSafeRender` exists partly because this toggle crashed the menu-screen Settings (no board).

## If it comes back

The cheapest revival is as a **mode flag** (`ACTIVE_MODE.exaltCorrupt`) rather than a
global setting, so it can be a mode or DLC rule set without touching other modes.
The Good Friend / Not a Friend / Shepherd are ready-made entities for it.
