# DIFFICULTY - the tiers (r727) and what else each could change

Settings -> Run -> Difficulty (also dev -> Change the game now). The setting is for the NEXT
run; a run keeps the tier it started on (`runDifficulty`, saved with the run). Every tier keeps
the tiers' changes below it. The table is `DIFF_TIERS` in `js/difficulty.js`; every reader asks
`difficultyTier()`. Four tiers today; the table takes six.

## Built

| tier | name | change 1 | change 2 |
|---|---|---|---|
| 1 | ENTRY LEVEL | a horseman curse card in the deck leaves after **4 rounds** on the grid | swaps and discards cost **no time** |
| 2 | SENIOR | horsemen last **6 rounds** | a swap costs **3s**, a discard **5s** (flat, not per card) |
| 3 | EXECUTIVE | horsemen stay **until removed** | every round starts **30s shorter** (Flow: every quarter's session) |
| 4 | C-SUITE | the run's last boss is **THE FOUR HORSEMEN** (one of each curse card on the grid as its clock starts) | (open) |

How the rounds are counted: a round counts for a card only if the card came onto the grid in it
(`hmSeen`, marked by the horsemen tick and every render; `hmRoundsSettle` at the round's end,
from `triggerLevelUp`). A round it spent in the piles does not count. A boss's own horseman is
a temp card and is never counted. The card shows its rounds left top-left.

Things that follow from the built changes, for the owner to know:
- **The first two discards of a round were already free of time** (`freeDiscardsLeft`, an old
  rule, every tier). At tier 2 the 5s bites from a round's third discard on.
- **Flow bills its clock at half rate** (r326): at tier 2 a Flow swap costs 2s and a discard 3s
  (3 x 0.5 and 5 x 0.5, rounded). If Flow should pay the full 3s / 5s, `FLOW_INTERACT_TIME_MULT`
  is the one number.
- **Steady Hand** costs 2x the tier's swap seconds (0 at tier 1), **Spoiled** 2x the discard
  seconds. **Free Swaps** and **Free Discards** are never offered at a tier where the base is 0.
- The boss round is 30s shorter at tier 3 too (`bossWindowDuration`), as any round is.
- THE FOUR HORSEMEN is never in the boss bag; only the last quarter / Flow's fourth boss deals
  it, and only at tier 4. The Schedule's Q4 review row shows it in every seat. Advance Notice
  names it. In Endless the ordinary bag is back.

## Recommendations: the knobs worth turning, two a tier

Every one is a number the game already reads in one place, so each is a line in `DIFF_TIERS`
and one reader. Ordered by how much they change the feel, least first.

| knob | where | base | a step | notes |
|---|---|---|---|---|
| Horsemen clocks | `HM.death.timer`, `HM.famine.timer`, `HM.pest.spread` | 30s | 20s | the cards act half again as often; the cheapest way to make a tier FEEL harder without touching score |
| Horsemen per debuff | the Balance Sheet curse tile, the Mystery, Pairs A | 1 card | 2 cards | more of them in the deck; pairs with the lifetime rule |
| Boss spawn pace | THE REAPER / THE SHORTAGE `everySecs` 45, THE PLAGUE 60 | | 30 / 45 | the horsemen bosses only |
| Pestilence cap | `HM.pest.max` | 4 | 6 | |
| Boss window | `bossWindowDuration` | 3:00 | 2:30 | a boss round alone, not every round |
| Round stock | `limits.swaps.base` / `limits.discards.base` | 3 / 3 | 2 / 2 | the Limit Break still raises them |
| Interest cap | `BAL._resources.interest_cap` | 10 | 7 | the shop matters less; Gross Pay still lifts it |
| Early Finish Bonus | `EFFICIENCY_SECONDS_PER_COIN` | 20 | 30 | less paid for leftover time |
| Balance Sheet path | `rewardSelectionCap` | by limit | -1 | one fewer tile a grid |
| Reshuffle card | `RESHUFFLE_CAP_CUT` | 30s | 45s | running the deck dry costs more |
| Focus fade | `focusDecayIntervalNow` | | / 1.5 | Overtime's fade cost, as a tier |
| Luck | `luckModifiers` at run start | 0 | -10 | rarer rares; offers and chance Tricks alike |
| Shop prices | the shop's price table | | +25% | |
| QRL | `qrlLimit()` | quarter N | N - 1 (min 1) | one fewer buff a card and replay source; a heavy one, keep for the top |
| Goals | `goalPenaltyMult` (Overtime's quota cost reads it) | x1 | x1.1 a tier | hold until the base curve is settled; then this is the one score knob, and it reaches every mode's curve the same way |

**Not recommended as tier knobs:** Selection Size, Hand Size, grid size (they change what the
game is, not how hard), Starting Time below 2:00 (the 30s cut is enough), and anything that
removes an entity type (Flow's chain and the Schedule's departments assume them all).

## A six-tier ladder, if five and six earn their place

| tier | change 1 | change 2 |
|---|---|---|
| 1-3 | as built | as built |
| 4 | THE FOUR HORSEMEN (built) | boss window 2:30 |
| 5 | horsemen clocks 20s | goals x1.1 (once the base is tuned) |
| 6 | THE FOUR HORSEMEN opens with TWO of each | the debuff places hand out two horsemen at a time |

Four tiers stop at the final boss, which is a clean end. Five and six only earn their place
once the score base is settled, because a tier that is "the same but a bigger number" is the
one players feel least. The two tier-6 changes keep the horsemen the theme of the top end.
