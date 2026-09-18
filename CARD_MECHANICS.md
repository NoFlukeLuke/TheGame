# Card mechanics backlog - hostile cards, phantoms, force triggers, draw order

Owner brainstorm, written up so it stops being scattered. Nothing here is built.
Read `CLAUDE.md` first for how the engine is put together; this file only says what
a new mechanic would be and which existing seam it hangs off.

Pool sizes as of this writing: **177 Tricks · 53 Knacks · 45 Sleights**, Tricks
sorted into 16 categories in `js/data/tricks.js`.

---

## 1. The big finding: most of this list is ONE mechanic

Six separate ideas in the brainstorm are the same thing wearing different hats:

| the idea | what it really is |
|---|---|
| a card that can't be discarded and drains 5% of score every 3s | a card with a **timer** and an **effect** |
| a card with a rank that costs you a swap if not played in 15s | a card with a **timer** and a **demand** |
| five cards that can't be used, and after 2 minutes on the grid transform | a card with a **timer** and a **transformation** |
| a card that says "score a Set of 3 within 60s" | a card with a **timer** and a **demand** |
| a card that corrupts its neighbours if its score bar isn't met | a card with a **timer**, a **demand** and a **failure spread** |
| cards that turn into other things after N rounds / N actions | a card with a **counter** and a **transformation** |

So there is exactly one engine piece to build, and every one of those becomes a
**data row** rather than new code. That is the pattern this codebase already uses
everywhere else: `PER_CARD_PAYERS`, `CHALLENGE_DEFS`, `TRICK_TIMERS`,
`EVENT_REQUIRES`, `CARD_MARK_META`, `SLOT_BUFFS`. Adding the seventh hostile card
should be adding a line to a table.

**Nothing in the game does this today.** The closest things are The Hold (a card
frozen for 15s, keyed by `cardId`) and The Hallmark knack (a card marked at a random
moment in the round, resolved on the next scored hand). Both are one-off
implementations of a fragment of this.

### What already exists that this would use

Everything below is real and working, which is why this is cheaper than it looks:

- **`cardCan(card, action)`** (`js/data/cards.js:215`) gates `select` / `swap` /
  `discard` / `fall` / `render` per card type. "Cannot be discarded" and "cannot be
  played" are one line each in here.
- **`isCellBlocked`** is the single question every select, tap, swipe and
  reachability guard in the game already asks. Anything that makes a cell inert
  routes through it and needs no changes in `input.js`, `hand-detect.js`,
  `match3.js` or `tutorial.js`.
- **`cdForCard(card, r, c)`** (`js/cooldown.js:102`) already draws a countdown ring
  and a grey-out **on a card**. The Hold uses it. A contract's deadline gets its
  visual for free.
- **`CARD_MARK_META`** (`js/entity-fx.js:44`) already draws a per-card corner mark
  keyed by a `covers(r, c)` predicate.
- **`hallmarkTick(elapsedRound)`** (`js/hallmark.js:92`) is the existing shape for
  "a per-round timer that watches the board", hooked off the round tick.
- **`removeAndFall(cells, mode)`** (`js/card-fall.js:197`) takes an arbitrary cell
  list and animates them out with gravity refill. Any area effect uses this.
- **`_isTouching`** (`js/sleights-runtime.js:223`) is the 8-way adjacency test Pivot
  already needed. `getNeighborsOrtho` is the 4-way one.
- **`rowColBonuses`** plus `renderLineMarkers` draw coloured, split, end-capped
  lines down a row or column, on the play board AND the reward grid (r209/r223).
  A row-wide effect gets its visual for free.
- **`armForcedTrick(id)` / `trickCanForce(id)` / `forceableTrickIds()`**
  (`js/force-trick.js`) already force a Trick to pay its nominal BAL value, with a
  cap and an allowlist. 92 of the 176 Tricks are forceable.
- **`t._primed` / `t._rank`** already replay a Trick's pip and mult delta, and
  `trickFires(id)` (r203) already covers the ~71 Tricks that pay in Focus, seconds,
  credits or card buffs instead.

---

## 2. Vocabulary

### The hostile card is a NOTICE, not a "corrupted doc"

**"Corrupted" is already taken and the collision is real.** `_corrupted` is a live
per-card flag in the exalt/corrupt mechanic (`exaltCard` / `corruptCard`,
`.corrupted` purple glow, `BAL._exalt`). It is switched off by default today, but it
is real code with its own suit table, and reusing the word would make two different
things share one name in the same file. That is exactly the trap
`js/payout-fx.js` vs `js/entity-fx.js` fell into (r220 had to write "NOT
`js/entity-fx.js`" at the top of a file to undo it).

**Proposed: a NOTICE.** An obligation that lands on your desk with a deadline on it.
It fits the r260/r262 schedule framing exactly (the map is a schedule, its tiles are
obligations, the boss is a manager review), and it tells the player what the card is
before they read a word of it.

Names that fall out of it with no extra invention: FINAL NOTICE, OVERDUE, ESCALATED,
WRITTEN UP, SERVED. The state a failed Notice spreads is **ESCALATION**, not
corruption, which keeps the two vocabularies apart.

### The object is a PINK SLIP, not a business card

The tile system (r228, r239) draws exactly two objects and both are drawn purely in
CSS on `.reward-cell.entity-trick` / `.entity-sleight`:

| entity | object |
|---|---|
| Trick (Utility) | floppy disc, 20/19 ratio, emoji and name on the label |
| Sleight (Vendor) | business card, letterboxed at 1.37 |

A third object: **a carbon-copy form**, torn along a perforation, with a red stamp
across it. Portrait, so it letterboxes the other way from the business card, and it
reads as bad news before the name is read. Same construction: a `::before` band with
`aspect-ratio`, layered backgrounds, a clip-path for the tear.

**Because of r182 and r239 that is the entire visual job.** Seven surfaces wrap their
own frame around the one class list, so the reward grid, Mart shelf, cart thumbnail,
loadout strip, tray, Shift Change slots, the lose picker and RECORDS Owned all pick
it up with no per-surface code. Do not draw a Notice anywhere by hand.

### A single-use card is a TEMP

The owner asked for a word for a card that can be scored once and is not in the deck.
Candidates were phantom, temp, carbon copy.

**Recommendation: TEMP.** One syllable, on theme (someone here for one job who is not
on payroll), and "the row fills with Temps" reads instantly. "Phantom" is the genre
word, which is the thing r178 spent a whole pass removing.

Mechanically it is `card._temp = true`, and it costs about three lines:

- `discardToDrawPile` already has the exact precedent: `if (card._isSleight) return;`
  drops the card on the floor instead of recycling it. A Temp does the same.
- `discardToPlayed` likewise.
- It must NOT be in `DURABLE_CARD_FIELDS`, so it can never survive back into the deck.
- The deck audit and `updateDeckHud` should not count it. Worth checking the RECORDS
  deck matrix, which is a rank x suit census and would otherwise report a Temp as a
  real card.

---

## 3. The contract card (the engine piece)

One table, one tick, one renderer.

```js
// js/notices.js
const NOTICE_DEFS = [
  {
    id: 'arrears',
    name: 'ARREARS',
    kind: 'drain',                    // what it does while it sits there
    deadline: null,                   // no deadline, it just bleeds
    every: 3,                         // seconds
    effect: () => { score -= Math.round(score * 0.05); },
    cardCan: { discard: false, swap: false },
  },
  {
    id: 'due_today',
    name: 'DUE TODAY',
    kind: 'demand',
    rank: 'random',                   // it wears a real rank and can be played
    deadline: 15,
    met: (cells) => cells.some(isThisCard),
    onFail: () => spendSwapOrDiscard(1),
  },
  {
    id: 'quota_card',
    name: 'SET OF 3',
    kind: 'demand',
    deadline: 60,
    met: () => handTypesRound.has('Three of a Kind'),
    onFail: () => escalateNeighbours(),   // 4-way, inert for the rest of the round
  },
];
```

### Six rules this has to obey, learned from things that already went wrong

1. **Key by `cardId(card)`, never by cell, and never by a field on the card.**
   Cells slide onto whatever falls into the slot (the trap The Hold avoided) and a
   card field needs a `DURABLE_CARD_FIELDS` entry plus un-marking on three paths
   (the trap The Hallmark avoided). One global map keyed by cardId compares clean
   and saves as one entry. This is r192's rule and every permanent card buff in the
   game already follows it: `permPips`, `permMult`, `permRetrig`, `permTime`,
   `permPipsGrow`, `permMultGrow`, `cardCurses`.

2. **Tick from ONE place, off the round tick, not from a `setTimeout` per card.**
   `hallmarkTick` is the model. A timer armed per card cannot be paused, cannot be
   re-timed, and survives the round ending. The round tick is also what every timing
   entity in the game already reads.

3. **A deadline is SECONDS REMAINING tested as "the clock has passed this", never an
   interval fired at.** This is The Quota boss's rule (r217): The Metronome can
   consume several seconds in one tick, so a deadline waited for by equality is
   stepped straight over.

4. **Skip a tick while `animating || falling`.** The Hollow and The Magpie both needed
   this. Starting a `removeAndFall` on top of a swap or a score cuts that animation
   short.

5. **The deadline must stop short of the round's end.** The Hallmark reserves the last
   25% of the round for this reason: a demand that lands with four seconds left reads
   as the mechanic being broken, not as a challenge. Either do not plant one late, or
   carry it into the next round.

6. **Everything in the table must be in `SAVE_VARS`**, and must be JSON-safe. The map
   mode's tiles hit this: they store a challenge as an id plus display fields and
   rehydrate the test function from `CHALLENGE_DEFS` by id, because JSON drops
   functions. Do the same here: the save holds `{cardId, defId, deadline}` and the
   predicate is re-read from the table.

### The ones from the brainstorm, as rows

| name | can't | does |
|---|---|---|
| **Arrears** | discard, swap | -5% score every 3s until it is played |
| **Due Today** | nothing, it is a real card | wears a rank; unplayed after 15s, takes a swap or a discard |
| **Quota Card** | select, discard | "score a Set of 3 in 60s"; on failure escalates its 4 neighbours |
| **Under Review** | select | a score bar; miss it and the card escalates and spreads |
| **Reassignment** | select | after N rounds or N swaps it BECOMES an ordinary card |
| **Escalated** | everything | what a failed Notice leaves behind. Inert. Lifts at round end |

A demand that names an action ("discard the two cards beside me", "swap me with a
neighbour", "score a flush touching me") is the same row with a different `met`.
Those read best because the player can see the answer on the board.

---

## 4. The five-card event

> Five cards that can't be played, used or discarded. After each has been on the grid
> for a total of 2 minutes they all turn into the same random rank, with buffs: one
> gives a 10s rewind, one gives 10 credits, one gives 30 pips, one gets a replay, one
> gets a force trigger.

This is a **payoff Notice**, which is the right instinct: the mechanic should not be
only punishment or it is a mechanic players learn to avoid rather than to plan
around.

Notes on making it work:

- **"A total of 2 minutes on the grid" means per-card accrued time, not wall clock.**
  A card that gets swapped out and comes back should keep its accrual, so the counter
  lives in the same cardId-keyed map. That is also what makes the mechanic
  interesting: five inert cells are a real cost to the board for two minutes, and the
  player can shuffle the board around them.
- **The five buffs are already four existing systems plus one.** `rewindTime()`,
  `coins`, `permPips`, `permRetrig`, and `armForcedTrick()`. No new payout code.
- **The buffs should land on the cards permanently, not on the round.** They go into
  `permPips` / `permRetrig` keyed by cardId, so the five cards go back into the deck
  as five genuinely better cards and you meet them again. That is what makes the two
  minutes feel paid for.
- **The random shared rank is the interesting part.** Five of a Kind is a real
  `HAND_BASE` entry since r199 and is otherwise almost unreachable outside Spectrum.
  This event is a way to hand the player a set that large without duplicating cards
  in the shop.
- **Register in four places** in `js/events-core.js` (the `pool` array, the
  `handlers` map, `EVENT_META`, the `renderers` map), plus an `EVENT_REQUIRES` row so
  it is never offered when the board cannot hold five inert cells.

---

## 5. Force triggers and priming

The owner asked for many more of both. **The seam is already excellent and the gap
is narrow.**

What exists: `armForcedTrick(id)` forces a Trick to pay its nominal BAL value on the
next hand, capped at 8x per axis, with an allowlist of parameter names so a tuning
number added later cannot silently start paying out. `t._primed` replays a Trick's
delta. `trickFires(id)` covers the Tricks that pay in Focus, seconds or credits.

**The one missing piece: nothing can address "the Trick in slot N".** Tray ORDER is
already load-bearing (Inspirato primes first and last, Mirror borrows from its
neighbour, Prime Times cycles 1st/2nd/3rd/5th/7th, the Alignment knack marks the
column matching a Trick's slot, and the Tray Order event exists purely to let you
rearrange it). So a `trayTrickAt(n)` helper is two lines, and then this whole family
is real:

| entity | effect |
|---|---|
| Knack | every 30s, force the Trick in slot 1 |
| Knack | your first hand of each round forces the LAST Trick in your tray |
| Sleight, double tap | force the Trick in the slot matching this Sleight's column |
| Trick | when you discard, prime the Trick to your right |
| Trick | a 5-card hand forces the lowest-tier Trick you own |
| Sleight, on_play | forces whichever Trick paid you least last round |
| Knack | a maxed Focus meter forces a random Trick instead of its usual payout |

**Why this family is worth more than more bonus Tricks:** it makes tray ORDER a
decision on every screen, which turns the Tray Order event from a curiosity into a
tool, and it gives the 92 forceable Tricks a second life late in a run when the tray
is full and another Trick would only be a replace-or-decline.

**Two rules to keep:**

- Forcing is READ-ONLY inside `calcScore` and SPENT in `playHand`. `calcScore` runs
  speculatively for every connected subset in `findBestHand` and on every tap of the
  live preview. Same rule `siphonMultX` and `minuteHandCharges` follow.
- Only ever offer from `forceableTrickIds()`. An unforceable Trick forced is a
  message worth zero.

---

## 6. Area and line Sleights

All cheap, because the visuals and the cell maths already exist.

| entity | what | rides |
|---|---|---|
| **Temp Agency** | double tap: this Sleight and every card in its row become a Temp copy of the best rank on the board | `_temp`, `renderCardAppearance` |
| **Floor Plan** | double tap: discard the 3x3 centred on this Sleight | `removeAndFall(cells, 'discard')` |
| **Spot Check** | double tap: discard a random 3x3 anywhere on the board | same |
| **Neighbourhood** | passive: every card touching it (8-way) scores +N pips | `_isTouching` |
| **Team Lead** | on play: every card touching it takes +1 permanent mult | `_isTouching`, `permMult` |
| **Department** | passive: its whole row scores +N mult | `rowColBonuses` |
| **Open Plan** | passive: its whole column may be selected non-adjacently | `hand-detect.js` |

**The row-of-Temps one is the strongest idea in the brainstorm** and deserves its own
note. A whole row of Aces is a Five, Six or Seven of a Kind, which are real
`HAND_BASE` entries that almost never come up. It is a genuine "I have been saving
this" moment, and because Temps leave the deck on the way out it costs nothing
permanent to balance.

Two things it needs:
- The Temp row must not include the Sleight's own cosmetic rank by accident.
  `sleightFace()` gives a Sleight a rank and suit for exactly this reason, so the
  Sleight itself turning into an Ace is fine and probably wanted.
- `HAND_MAX_CARDS` is **7**. A row on a 7-wide board is already at the cap, and
  `limits.selection` maxes at 9, so a wider board would have cards it cannot use.
  Either cap the effect at 7 cells or raise `HAND_MAX_CARDS`, which is a balance
  decision (r199 set it to 7 on cost grounds: a 7-card selection re-scores in ~4ms,
  a 9-card one in ~16ms).

---

## 7. Draw order: the answer to the explicit question

> Do we just have the deck shuffle itself normally, and then the buff moves the card
> up by x cards in shuffle depth so it feels like it more frequently shows up early?

**Yes. That is exactly right, and it is the approach the codebase has already
converged on once.**

### Why a shuffle-time bias and not a draw-time swap

The Hand of Famine boss used to REWRITE the rank of each card as it was drawn. It
worked, and it was wrong: it invented cards that were not in the deck, so the RECORDS
matrix, the "still drawable by rank" chart and the deck audit all described a deck the
player was not being dealt from, and a card drawn as a 3 could cycle back in as the
King it really was. r216 replaced it with `famineStackDeck()` (`js/boss.js:365`),
which **weights the draw pile at boss start** so low cards cluster at the front. Your
own cards, in a bad order.

That is the same shape you want, and the same reasons apply. Bias the ORDER, never
substitute at the draw.

### The mechanism, concretely

`drawPile` is an array. `drawCard()` does `drawPile.shift()`, so position 0 is next.
The pile is (re)ordered in exactly two places:

- `freshShuffledDeck()` at run start, via `deckShuffle`
- `flushPlayedDeck()` at every round end, which is `deckShuffle([...drawPile, ...playedPile])`

So a draw bias is applied in one helper called from those two sites, and nowhere else.

**Two ways to write it. I recommend the second.**

**A. Depth nudge, which is what you described.** After a normal shuffle, move each
biased card forward by N positions. Legible, easy to print ("moves 8 cards closer to
the top"), and self-limiting because a card already near the front gains nothing. The
weakness is that it does not compose: five biased cards fight over the same slots and
the fifth one to be spliced undoes the first.

**B. Weighted shuffle.** Give each card a sort key and sort by it:

```js
drawPile = drawPile
  .map(c => ({ c, k: Math.random() / (1 + drawBias[cardId(c)] || 0) }))
  .sort((a, b) => a.k - b.k)
  .map(x => x.c);
```

A bias of 1 makes a card land in the front half about twice as often; a bias of 3,
about four times. It composes for free (ten biased cards just all skew forward, none
of them cancelling another), it is one line, it stays inside `withSeededRng(fn,
'deck')` so seeded runs still reproduce, and **`famineStackDeck` is already this
exact code** with the weight coming from a pip threshold instead of a per-card map.
So it is a known-good shape in this codebase rather than a new one.

Print it to the player as "shows up sooner", not as a number. The percentile shift is
not something anyone can reason about.

### Where the bias lives

`drawBias = {}`, keyed by `cardId(card)`, declared in `js/deck-grid.js` beside
`permPips` / `permMult` / `permTime`, in `SAVE_VARS`, reset in `startGame`, handled
in `migrateCardKeysToIds`. It is a permanent card buff and every permanent card buff
in this game already has exactly that shape. Do **not** put it on the card object:
`recycleCard` rebuilds a normal card from `DURABLE_CARD_FIELDS` every time it leaves
the board, so anything not in that list is destroyed on the way back into the deck.

### Three different levers, and they are not the same mechanic

Worth building all three, they feel completely different:

| lever | what it does | shape |
|---|---|---|
| **Bias** | this card sorts earlier from now on | probabilistic, permanent, the one above |
| **Tutor** | this card goes on TOP, right now | deterministic, one-shot, `drawPile.unshift(...)` |
| **Bury** | this card sorts later, or goes to the back | the inverse, what a curse or a boss wants |

Famine is already a fleet-wide Bury. The Sieve boss is the extreme version (discards
do not come back at all). A Tutor is what a Sleight double-tap should do, because a
one-shot deterministic effect is something the player can plan a turn around, where a
bias is something they only notice over a round.

### It has to be VISIBLE or it does not exist

This is the r209 lesson about flat versus scaling card buffs: every offer site said
"permanently gains +1 mult" when the number was never going to move, and a player
could hold a blessed card for a whole run waiting. A draw bias is worse, because
nothing about it is visible at all.

Three cheap places to say it:

- `cardBuffLines(cardId)` in `js/deck-grid.js` is the single place a card's buffs are
  put into words, read by the grid tooltip, the deck matrix and the reward tiles. One
  line there covers all three.
- A `.card-grow-mark`-style corner marker on the board, the way scaling buffs got one.
- The RECORDS deck matrix could show a small up-arrow, and its "still drawable by
  rank" chart is already the planning readout this feeds.

### Entities this unlocks

| entity | effect |
|---|---|
| Knack, **Preferred Vendor** | the last card you scored draws sooner for the rest of the run |
| Sleight, double tap, **Expedite** | put any card in your deck on top of the pile now |
| Sleight, passive, **Filing System** | your highest card and your lowest card both draw sooner |
| Trick | every Ace you score gains draw bias |
| Knack, **Backlog** | cards you discard go to the BACK of the pile, twice over |
| Event, **Reorganisation** | pick three cards; they draw first next round |
| Boss | your three best cards are buried |

---

## 8. Paring the Trick pool

177 Tricks in 16 categories. The owner is right that there are near-duplicates, and
there is a way to find them by measurement rather than by reading all 177.

**A Trick is defined by two things: its BAL parameter shape and its trigger
predicate.** Two Tricks with the same parameter keys in the same category are almost
certainly the same Trick at a different rate. That is already a known pattern here:
r205 found Get Even at `cells.length * 2` and Odd One In at `cells.length * 5` were
"the same effect mirrored" at 2.5x the rate, and fixed both.

Proposed audit, mechanical and reproducible:

1. Cluster by `(category, sorted BAL param keys)`. Anything with two or more members
   is a duplicate candidate.
2. Inside a cluster, score each member's real value per round on real boards, the way
   r183 measured the clock-mark Tricks (it found Second Hand paying 43 a round against
   Minute Hand's 464 for the same trigger, and Quarter Chime paying 2110 against a
   1200 goal for a rare).
3. Cut the strictly dominated ones. Keep the outliers, they are the interesting ones.
4. Check `DESC_TEMPLATES` coverage on the way past: only 91 of 196 entities have one,
   and the other 105 have their number typed into the sentence, which is the thing
   that drifts.

Rough guess at where the fat is, from the category list alone: **Timing** (22 ids) and
**Accumulating** (21 ids) are the two biggest, and Position is 22. Those three are
almost half the pool.

**Budget the replacement before cutting.** The families proposed in this document are
roughly: 7 force/prime entities, 7 area and line Sleights, 6 Notices, plus 7 draw-order
entities. That is about 27, so cutting 30 to 40 near-duplicates leaves the pool the
same size and much more varied.

---

## 9. Build order

Cheapest first, and each step makes the next one cheaper.

| # | what | why here |
|---|---|---|
| 1 | **Temps** (`_temp`) | three lines, and it is a prerequisite for the row Sleight |
| 2 | **`trayTrickAt(n)`** plus 3 force entities | two lines of engine, immediate new family |
| 3 | **Draw bias** plus tutor and bury, with the readouts | self-contained, one helper, seven entities |
| 4 | **Area Sleights** | all ride existing cell helpers |
| 5 | **The contract engine** plus 3 Notices | the real work; the pink slip tile is part of this |
| 6 | **The five-card event** | trivial once 5 exists |
| 7 | **The Trick audit and cut** | do it after 2 to 4 land so the replacements are already in |

Two open decisions for the owner, neither blocking:

- **Do Notices arrive from bosses only, or from the ordinary deck too?** Boss-only is
  safer and reads as a boss mechanic. Deck-wide is more interesting and needs a rate.
- **`HAND_MAX_CARDS` stays 7 or rises to 9?** It caps the row-of-Temps Sleight, and it
  is the one number in this document that changes existing balance.
