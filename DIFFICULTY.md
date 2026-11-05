# DIFFICULTY - the eight tiers (r728), what follows from them, and the spacing

Each mode has its own tier, chosen on its card in the mode carousel: sideways keys, a $ per
tier, the tier's name and what it does. A tier opens for a mode by WINNING a run of that mode at
the tier below it. A run keeps the tier it started on (`runDifficulty`, saved with the run).
The table is `DIFF_TIERS` in `js/difficulty.js`; every reader asks `difficultyTier()`. Each tier
keeps the tiers' changes below it. Dev -> Change the game now sets every mode's tier at once and
unlocks them.

## The tiers as built

| tier | name | change |
|---|---|---|
| 1 $ | INTERN | No modifiers. |
| 2 $$ | ENTRY LEVEL | You start with a curse card (a random horseman, into the deck). It goes away after **4 draws**. Swaps cost **3s**, discards cost **5s** (flat). |
| 3 $$$ | SPECIALIST | **Forced penalties can appear in rewards**: a pick of three penalties from the Balance Sheet's own table, one must be taken, no skip. Flow: a step added to **15%** of level-up chains. The Schedule: **20%** of the time after a round's pick of three. |
| 4 $$$$ | MIDDLE MANAGER | Every round starts with **30 fewer seconds** (Flow: every quarter's session). |
| 5 $$$$$ | SENIOR MANAGER | The starting curse card lasts **6 draws**. Swaps cost **5s**, discards **7s**. |
| 6 $$$$$$ | EXECUTIVE | **Penalties are more punishing**: every penalty offered (Balance Sheet, Mystery, the forced pick) is a permanent one, and the serious ones (Lose a Trick, War, Quota Revision, Red Tape, -Luck, a horseman, a limit drained) weigh double. Flow only: the chance of more than one reward at a level-up is **10 points lower**. |
| 7 $$$$$$$ | C-SUITE | The starting curse card lasts **until removed**. Every goal **x1.15**. |
| 8 $$$$$$$$ | THE BOARD | Every goal **x1.3**. The run's last boss is **THE FOUR HORSEMEN** (one of each curse card on the grid as its clock starts). |

A **draw** is the card coming onto the grid. It is counted the first time the board sees the
card after it last left the board, so a card pierced back into the deck and drawn again counts
again; a card that stays on the grid across a round (a Keeper) counts once per round. A card at
its limit leaves the run the next time it leaves the board (or at the round's end). The card
shows its draws left top-left. Every horseman in the deck follows the tier's lifetime, not only
the starting one; a boss's own horseman is a temp card and is never counted.

**Taken out in r728 (owner):** the two free-of-time discards a round (`freeDiscardsLeft` stays
at 0 for old saves), and Flow's half-rate interaction costs (`FLOW_INTERACT_TIME_MULT` is 1).
The r727 Settings row is gone; the carousel is the only place a tier is chosen.

Things that follow from the built changes:
- **Steady Hand** costs 2x the tier's swap seconds (0 at tier 1), **Spoiled** 2x the discard
  seconds. **Free Swaps** and **Free Discards** are never offered at tier 1.
- The penalty table's two discard rows read as flat costs now ("Discard cost: 5s -> 7s"), since
  a discard is one charge whatever the count.
- "Penalties are more punishing" drops the Dark Mystery from the penalty rows (it is not
  permanent) and the next-round-only rows (-1 swap, -1 discard, Hands +5s, Slow Start, Short
  Staffed, Spot Check, Withheld, Suspend, Interest Freeze, Pickpocket).
- THE FOUR HORSEMEN is never in the boss bag; only the last quarter / Flow's fourth boss deals
  it, and only at tier 8. The Schedule's Q4 review row shows it in every seat. In Endless the
  ordinary bag is back.
- Classic has no forced penalty pick: its round reward is the Balance Sheet, which already
  carries penalty tiles on the path. (One line in `mapAfterLevel` adds it for the Schedule;
  the same wrapper would add it to Classic's interlude if wanted.)
- Reaching THE BOARD on a mode takes seven won runs of that mode.

## Is the ladder spaced well? (r740: the owner took both moves below; the table above is the result)

Where each tier bites, as a share of a 3:00 round (2:30 from tier 3):

| step | what it costs a typical round | feel |
|---|---|---|
| 1 -> 2 | a curse card every few rounds; ~4 swaps and discards at 3s / 5s = 15-20s | the biggest single step: two constant changes at once |
| 2 -> 3 | 30s off 180 (17%) | constant, every round, the largest clock change on the ladder |
| 3 -> 4 | a penalty one level-up in five or six | occasional; most penalties are one round's worth |
| 4 -> 5 | the same 4 actions now 6s / 9s = 30-36s off a 150s round; the card lasts half again as long | the steepest step: interaction costs double on a clock already cut |
| 5 -> 6 | every penalty permanent and the hard ones twice as likely | big in a long run, invisible in a short one |
| 6 -> 7 | goals x1.15; the curse card never leaves | moderate |
| 7 -> 8 | goals x1.3; the final boss | moderate plus a wall |

Two places I would move:
- **Tier 5's costs are the harshest step.** 6s / 9s on a 2:30 round means five discards cost a
  third of the clock. 5s / 7s would keep the shape (dearer than tier 2) without doubling. Or
  keep 6s / 9s and move the 30s cut to tier 5, so the clock cut and the cost rise do not land
  three tiers apart on the same resource.
- **Tier 4 is the softest step** and tier 3 the second hardest, so the ladder goes hard, hard,
  soft, hardest. Swapping tiers 3 and 4 (penalties at 3, the 30s cut at 4) makes the climb
  steadier: 2 constant, 3 occasional, 4 constant, 5 dearer.
The rest reads right: the curse card's 4 / 6 / forever at 2 / 5 / 7 is evenly spaced, the goal
steps come once the player has learned the other pressures, and the final boss ends the ladder.
The two score steps (x1.15, x1.3) are placeholders until the base curve is settled.
