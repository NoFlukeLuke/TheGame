# Open decisions - the balance audit backlog

Everything here is **a decision, not a bug**. Each item was measured, not guessed, and
each one was deliberately left alone because changing it is a balance call the owner
should make rather than something a session should do in passing.

## Read this first: the numbers are from r183, main is now r226

The audit below was measured against **r183**. Since then `js/data/balance.js` has moved
156 lines, `js/data/tricks.js` 41, `js/data/sleights.js` 57 and `js/data/knacks.js` 15.
**Re-measure before acting on any single number.** One item has already moved on its own:
Minute Hand went from `{ mult: 3 }` to `{ mult: 5, hands: 2 }`, so its r183 figure of 464
a round is stale.

The full workbook (all 167 Tricks, the clock readers, the flagged rows, every legendary
and mythic) was delivered to the owner as `TheGame_trick_audit.xlsx`.

### How to reproduce the measurement

Score the same 500 fresh boards with and without one Trick in the tray, through the real
`calcScore()`. Five board states (fresh clock / mid-round / late-round / clock-paused /
quick-succession hands), each Trick reported at its best, with the state recorded.
Clock-mark Tricks fire from the round timer rather than from scoring, so those are priced
by driving a whole 180-second round instead.

**Two traps in that harness, both of which produced wrong numbers on the first pass:**

1. **Reset `rowColBonuses` between Tricks.** `assignPositionMark` appends to it, and
   `isEffectIntersection` asks whether ANY Trick marks a row and a column - so leftover
   marks made unrelated Tricks read as +333.
2. **Keep `focusNodes` at 0 in every state.** The Focus multiplier scales the whole hand,
   so carrying live Focus in one state doubles every Trick measured there and "best state"
   collapses to "whichever one had Focus".

Baseline at level 1: average best hand **334**, `+1 pip` = **4.26** score, `+1 mult` =
**77.3**, `+1 Focus node` = **33.4**, round goal **1200**, so ~3.6 hands to clear a round.

---

## 1. Three rares that beat every epic

| Trick | tier | hand uplift | what it asks of you |
|---|---|---|---|
| Eagle Eye | rare | **+1387%** | not swapping |
| The Swift | rare | **+1156%** | nothing at all - let the clock run |
| Quarter Chime | rare | 2110 a round, against a 1200 goal | nothing - 11 fires a round at +45 pips |

**The Swift and Eagle Eye are the sharper problem** because neither has a real condition.
The Swift is `+1 mult per 3 seconds elapsed`, which is 50 mult by 150 seconds and asks
nothing. Eagle Eye is `+5 mult per 10 seconds without a swap` and scales with no ceiling.

**Options:** cut the payout (~9.6x and ~11.6x respectively to reach the top of the rare
band), promote them to epic, or give them a cap.

**Quarter Chime** is the one to think about hardest, because it is also the Trick that
rewinding pays best after Second Hand. Nerfing it works against the rewind build the
r183 pass was meant to reward.

## 2. Thirteen Tricks that are too small for their rarity

Worst first. **Both legendaries and the mythic here are beaten by the average common.**

| Trick | tier | uplift | fires | pays when it fires | shape |
|---|---|---|---|---|---|
| Twenty-One | legendary | +1% | 0.4% | 660 | rare AND small |
| Richter | legendary | +11% | 3% | 1370 | lottery ticket |
| Hard Labour | mythic | +14% | 78% | 61 | consistent and tiny |
| Encore | epic | +1% | 3% | 171 | condition too narrow |
| Four Horse-man | epic | +3% | 4% | 237 | condition too narrow |
| Sideways to Infinity | rare | +2% | 5% | 113 | condition too narrow |
| Dark Matter | rare | +2% | 2% | 360 | condition too narrow |
| Stand Up | common | +0.3% | 0.4% | 448 | condition too narrow |
| Lie Down | common | +1% | 1% | 493 | condition too narrow |

**Fire rate decides the fix, not the average.** A Trick firing under 15% wants a WIDER
CONDITION; raising its payout only makes it swingier. Richter is the clean example: 1370
when it lands is a fine legendary payout, it is just gated on Four of a Kind, which is
available on 2.3% of boards.

**Hard Labour is the opposite** and the only one of its shape: it fires on 78% of hands
and pays 61. That is a rounding error on a mythic, and it wants the number raised.

**Twenty-One is the worst row in the game** - a legendary that fires on 0.4% of hands and
pays only 660 when it does. Worth noting the caveat: the harness always plays the best
hand BY TYPE, so a player deliberately building a 21-total hand gets more than 0.4%. It
is still the weakest legendary by a distance.

## 3. The tiers are inverted

Among the Tricks the harness could price, the **rare median uplift is 85% against epic's
22%**. An epic is, on average, a worse pick than a rare.

This is partly an artifact - far more epics pay through Focus, permanent buffs or the
clock, none of which a single-hand measurement can see - but not entirely. It is the
finding worth acting on before any individual row, because fixing the rows one at a time
will not fix the ladder.

## 4. There are no legendary or mythic Knacks

**All 45 Knacks are common, rare or epic.** Still true on r226.

Not necessarily wrong - Knacks are rule-changers rather than score, so the ceiling may be
deliberate. It matters if a shop, wheel or reward slot ever asks for a legendary Knack:
today it cannot be filled.

## 5. `trickSellValue` is defined twice, and the wrong one wins

- `js/shop.js` line 31 - uses `SELL_FRACTION`
- `js/shop-grid-preview.js` line 26 - hardcodes `0.60`

Same global scope, so the later load wins and the effective sell fraction is **0.60**, not
whatever `SELL_FRACTION` says. Already noted as a known wart in CLAUDE.md and still live on
r226. Reconciling it is a one-line change once the intended fraction is decided.

## 6. Three rewinds that were left as raw seconds - now fixed, noted for history

Deluge, Threepeat, Blood Diamonds and the Spectrum Time Clock fixture wrote `roundSeconds`
directly instead of calling `rewindTime()`. **Fixed in r183.** There are no raw
`roundSeconds +=` sites left; a new one is a bug.

That conversion exposed a live bug worth remembering: `rewindTime` clamped to
`ROUND_DURATION` (Classic's 180), so in Flow - whose session clock starts at 300 - a single
Flush destroyed 110 seconds and reported nothing. The ceiling is now
`max(currentRoundDuration(), roundStartSeconds, roundSeconds)`.

## 7. Natural Scaling inverts the hand ladder, and short hands always win the race

Measured r281, shipped tuning (`nsPipsPerHand` 2, `nsMultPerHand` 0, `nsEveryHands` 1).

`handWorth()` reads `handBasePips` / `handBaseMult`, which include the Natural Scaling
accumulator. So a hand type you have played a lot can out-*worth* a longer hand that the
same cards also form. How long that takes, from a fresh run:

| the short hand | out-worths | after |
|---|---|---|
| Run of 3 | Run of 4 | **8 plays** |
| Flush of 3 | Flush of 4 | 8 plays |
| Run of 4 | Straight | 11 plays |
| Pair | Two Pair | 13 plays |
| Pair | Three of a Kind | 17 plays |
| Flush of 3 | Flush | 18 plays |
| Three of a Kind | Full House | 21 plays |
| Run of 3 | Straight | 21 plays |
| Pair | Full House | 47 plays |
| Three of a Kind | Four of a Kind | 53 plays |

**This is r198 working as specified** - "a Three of a Kind played forty times may well
out-score a Four of a Kind you have never played" - so it is a decision, not a bug. But
note what it does over a whole run: NS rewards FREQUENCY, and short hands are by far the
most frequent, so the ordering does not merely become interesting, it reliably **inverts**.
Eight Runs of 3 is most of one round. Past that point, selecting four cards of a run and
being paid a Run of 3 with the fourth card dropped is the correct answer, and the board
says so only by turning that card red.

Two things worth separating if this is ever retuned:

- **The ladder inversion itself** (which hand the game reaches for). Levers: a lower
  `nsPipsPerHand`, a `nsEveryHands` above 1, a cap per hand type, or scaling the bonus by
  the hand's card count so a Pair's +2 is worth less than a Straight's.
- **Its effect on what a selection means.** That half was a real bug and is fixed in r281
  (see CLAUDE.md, "The partition and the load-bearing rule were fighting"): the inversion
  used to make the longer hand *unplayable*, not merely unchosen.

`nsMultPerHand` defaults to 0 and is the far sharper lever - +1 base mult on a Pair is
worth more than +20 base pips, so a run with it tuned up inverts the ladder in a handful
of hands rather than a handful of rounds.
