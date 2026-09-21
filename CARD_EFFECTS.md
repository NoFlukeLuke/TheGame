# CARD EFFECTS

**The one reference for everything that can be true of a single card.** If you are
adding a per-card buff, debuff, state or mark, it belongs in this file before it
belongs in the code.

Three sections:

1. **[What exists today](#1-what-exists-today)** - every live per-card effect, what
   stores it, and whether it survives a deck cycle.
2. **[Card states](#2-card-states-r278)** - the one-shot charges with a use half and
   an idle half, and how to add one.
3. **[The parked list](#3-the-parked-list)** - designed, agreed, not built.

## The rules that apply to all of it

- **Key by `cardId(card)`, never by `cardKey(rank, suit)` and never by a cell.**
  A cell slides onto whatever card falls into the slot. A face is shared by every
  duplicate the shop ever sold you. See CLAUDE.md, "Card identity (r192)".
- **A field on the card object is destroyed by the deck cycle** unless it is named
  in `DURABLE_CARD_FIELDS` (js/deck-grid.js). `discardToPlayed` and
  `discardToDrawPile` rebuild a card from that list and nothing else.
- **A permanent effect goes in a global map; a transient one can be a field.** The
  maps are all reset in `startGame` and all listed in `SAVE_VARS`. Miss either and
  the effect leaks between runs or vanishes on resume.
- **Anything that targets "a card" draws from `everyDeckCard()`** and re-resolves
  with `resolveDeckCard()` at apply time, because a card can leave the run between
  a tile being built and that tile being taken.
- **Nothing may roll `Math.random()` inside `calcScore`.** That function runs once
  per connected subset inside `findBestHand` and again on every tap of the live
  PIPS/MULT preview. Reads only; the charge is spent in `playHand`.

---

## 1. What exists today

### Permanent buffs (global maps, keyed by cardId)

| effect | store | what it does | where it lands in the ladder |
|---|---|---|---|
| **flat pips** | `permPips` | scores +N pips, every play | the per-card pip loop |
| **flat mult** | `permMult` | scores +N mult, every play | the per-card mult region |
| **x pips** | `permXPips` | multiplies this card's own pip subtotal | card-scoped x pips |
| **x mult** | `permXMult` | multiplies the running mult, ON the card, once per replay | the card's own beat (r233) |
| **replay** | `permRetrig` | this card scores +N extra times | the card's rep count |
| **seconds** | `permTime` | rewinds the clock N seconds when scored | through `rewindTime`, never a raw `roundSeconds +=` |
| **scaling pips** | `permPipsGrow` | NOT scored: how much `permPips` rises per play | applied by `growCardScaling` after the score commits |
| **scaling mult** | `permMultGrow` | NOT scored: how much `permMult` rises per play | same |

**Flat and scaling are different things and the wording is the type** (r209):
flat says *"scores +5 mult when played"*, scaling says *"scales +1 mult each time
it's played"*. `cardBuffLines(cardId)` in js/deck-grid.js is the single place a
card's buffs are put into words, and every surface reads it.

**On the BOARD they are corner bands** (r299) - `cardBandsHTML`, beside
`cardBuffLines` in the same file and for the same reason. Diagonal bands across a
corner in the Trick disc's own visual language (r274), **one per 5 pips / 5 mult /
5 seconds / 1 replay**, coloured by family: pips blue top-left, mult red
top-right, seconds (`permTime` + `_vulturePause`) black bottom-left, replays green
bottom-right. `permXPips` / `permXMult` / `permCoins` deliberately have none - a
x2 is not a tally of 5s - and there is no per-card FOCUS store to draw at all.
Adding a family is a row in `CARD_BAND_FAMILIES`; see CLAUDE.md for the geometry
and the traps.

### Permanent debuffs

| effect | store | what it does |
|---|---|---|
| **Leaden** | `cardCurses` | scores 0 pips. Lifts after 3 scores. |
| **Taxing** | `cardCurses` | -3s every time it scores. Lifts after 4 scores. |
| **Snared** | `cardCurses` | cannot be swapped or discarded. Lifts after 2 scores. |
| **negative pips** | `permPips` | a negative entry is legal and is what Roll Call's idle half writes |

Curses are defined in `CURSE_DEFS` (js/deck-grid.js) and lift by being SCORED,
which is the whole counterplay: a cursed card is a card you have to play.

### Card-object fields (durable)

| field | what |
|---|---|
| `_id` | the card's identity. Everything else keys off it. |
| `combined`, `rank2`, `suit2` | the shop's Combine service: one card, two faces |
| `_exalted` / `_corrupted` | the exalt/corrupt state, and its seven trigger counters (off by default) |
| `_whetMult` | Whetstone's banked mult |
| `_vulturePause` | the Vulture's pause-on-score buff |
| `_temp` | r278: this card exists for this level only |

`_discardCursed` (The Marker boss) is deliberately **not** durable: a marked card
that leaves play comes back clean and takes a fresh roll.

### Temporary, by a boss or a Trick

| state | store | what |
|---|---|---|
| **VOID** | `blockedCells` | the cell is gone; the card is returned to the deck and nothing falls in |
| **QUARANTINED** | `nullCells` | cards still fall in and fill the slot, they are just inert, permanently |
| **HELD** | `bossHeldCards` | one card, inert, expires. Keyed by card, not cell. |
| **RECALLED** | `bossNullRanks` | a whole rank off the board for 45s |
| **CONTAMINATED** | `dampCells` | The Blight: half pips, and Tricks may not fire |
| **MARKED** | `_discardCursed` | The Marker: played, it fizzles the hand and is discarded |
| **HALLMARKED** | `hallmarkCardId` | score it and it takes a random buff |

All three kinds of unusable funnel through **`isCellBlocked`**, which is what lets
every existing select, tap, swipe and reachability guard cover them with no
changes.

### The marks a card can wear

`CARD_MARK_META` (js/entity-fx.js) is the table, keyed by a `covers(r,c)`
PREDICATE rather than a position, because two of them are derived from where a row
effect crosses a column effect. One mark per card by design; the tooltip lists the
rest. Card states draw their own badge (`.card-state-badge`) in the one free
corner and do not go through that table.

---

## 2. Card states (r278)

**`js/card-states.js` + `css/card-states.css`.** A state is a ONE-SHOT charge on
one physical card, with two halves:

- **USE IT.** Play the card and it pays out, big.
- **IGNORE IT.** Leave it alone for its fuse and the other half fires instead.

**The idle half is never a flat penalty.** A flat penalty is a tax and the player
has no decision to make; several of these are how you thin the deck without a shop.
That is the rule any new state has to meet: "takes 60 seconds off the clock" is not
a card state, it is a bill.

### The seven

| state | fuse | play it | ignore it |
|---|---|---|---|
| **Backfill** ⧉ | - | (fires on LEAVING, played or discarded) a temp copy falls in behind. Stacks: the charge moves to the copy, so a stack of 3 is three copies and then done. | - |
| **Fleeting** ⏳ | 30s | - | discards itself back into the deck |
| **Deadline** ⏱ | 60s | two random Tricks fire | deletes itself from the run |
| **Callback** ↻ | 60s | every card in the hand replays once | deletes a card beside it |
| **Review** ↗ | 60s | 1 in 5 to improve a Trick a tier | 1 in 2 to knock a tier OFF an improved one (Luck lowers this) |
| **Scavenger** ◆ | 60s | swallows a neighbour's buffs and pips, deletes it | wipes a neighbour's buffs and deletes itself |
| **Roll Call** ☰ | 60s | every card of its rank on the board joins the hand | every card of its rank scores 15 fewer pips |

### Where each half is applied, and why they differ

Most states pay out in `cardStatesOnUse`, called from `playHand` **after the score
commits**, beside `growCardScaling` and `recordNaturalScale`. A payout earned by a
hand lands on the next one, and anything rolled inside `calcScore` would fire
dozens of times per selection.

**Two cannot live there, because their payout has to change the hand being scored:**

- **Callback** is read inside `calcScore` (`cardStateCallbackOn`), exactly like Low
  and Behold: the CONDITION is a property of the hand, the EFFECT is +1 replay on
  every card. A pure read; the charge is spent in `playHand` like every other.
- **Roll Call** runs BEFORE the hand is found (`rollCallAugment`), because it
  changes which cards the hand is made of. It follows `ringerAugment`'s shape, and
  for the same reasons: it **ignores selection size** (the cards are added after
  the player has committed) and it **ignores adjacency** (`findBestHand` only ever
  builds orthogonally connected subsets, and the other three 7s are never next to
  each other; `detectHand` does not check connectivity, so the hand is assembled
  directly). It also runs above the minimum-selection guard, so a lone charged
  card plus three pulls is a legal hand at a minimum of 3.

**Roll Call's pull is UNCONDITIONAL** and it has three tries, which are the spec
rather than defensiveness. `handComponentsFor` refuses a hand over
`HAND_MAX_CARDS` (7) and refuses one carrying a card no component claims, so:

1. the whole union - the good case, a Four of a Kind alongside a Run of 3
2. the rank group alone - what Roll Call promises, the rest of the selection
   paying as penalties
3. the hand you already had, with the pull paying as penalties

A card that cannot be part of the hand is still taken; it is just taken as a
**penalty card**, which is the engine's existing word for "committed, consumed and
billed".

### The per-card clock

`cardIdleSecs[cardId]` is whole seconds untouched. Ticked from the **round tick**,
so it stops with the round, with the pause menu and with RECORDS for free, and it
prunes anything no longer on the board. **Reset every round** (owner's spec), so a
charged card does not blow up the instant the next round deals.

- **A SWAP counts as a touch.** That is a lever, not an accident: moving a charged
  card buys it another full fuse, at the cost of a swap and eight seconds, and it
  is the only way to hold a state you are not ready to spend.
- **A blocked, held or quarantined cell does not age.** A card you are not allowed
  to touch must not have its fuse run down while you are locked out of it.
- The tick **skips while `animating || falling`** - the r213 Hollow lesson, since
  `removeAndFall` takes the falling lock.

### Self-removal, and what it costs

`cardStateRemove(recycle, destroy, opts)` is the one place a state takes a card off
the board.

- **`recycle`** is an ordinary discard: back to the draw pile.
- **`destroy`** is deck thinning, which is what the duality states are FOR: the
  card leaves the run and `expectedDeckTotal` drops.
- **It costs the CLOCK at whatever a discard costs right now, and no STOCK.** A
  card removing itself when you are on zero discards must not be a rule that cannot
  run. `CARD_SELF_DISCARD_COSTS_STOCK` at the top of the file flips that if the
  owner wants the stock billed too; `interactTimeCostsOn()` already decides the
  time half, so Flow pays nothing either way.
- **`opts.free` is the Turnover knack**, which pays neither. Not generosity:
  billing it at 3s a card costs a full board about 48 seconds of a 180-second
  round, so a priced Turnover is not a weaker Turnover, it is an unplayable one.

### Temp cards

`_temp` on the card object, the ONE state that is a field rather than a map entry,
because it has to travel through `discardToPlayed`'s rebuild so that rebuild can
refuse it.

- **It exists for this level only.** Both pile functions drop it, which is the
  whole of the rule: the level-clear sweep runs `discardToPlayed` on every cell, so
  a temp card disappears when the level ends with nothing else sweeping.
- **It IS a real card while it is there.** A boss can curse it, a mid-round
  blessing can buff it, it scores exactly like anything else. That is the risk of
  building round one around it. Effects that happen BETWEEN levels never see it,
  because by then the board is empty.
- **`gridCardCount()` does not count it.** The deck audit is about the permanent
  deck, and a temp card was never drawn from a pile and will never return to one.
- **`makeCardPermanent(card)` is the seam for a future "this one is yours for
  good" effect.** Nothing calls it today. It is written now because the flag and
  the deck accounting both live in one place, and a later caller should not have to
  find them.
- A temp copy carries the FACE and nothing else. Permanent pips, mult and curses
  are keyed by cardId, so a fresh id is a genuinely fresh card. Inheriting the
  original's buffs would make a stack of Backfill a money printer off one blessed
  card.

### The Turnover knack (rare)

Any card you leave alone for 60 seconds is discarded and a fresh one falls in.
Free of stock and of the clock.

**One card per tick, the longest-idle one.** Not the whole board at once: at a
round's start every card has aged together, so a sweep would be a board wipe on one
tick rather than the churn this is meant to be. One a second trickles them out, and
each replacement then ages on its own clock, so the knack self-staggers after the
first pass.

### Adding a state

One row in `CARD_STATE_DEFS`:

```js
my_state: {
  name: 'My State', icon: '◇', color: '#aabbcc', tier: 'rare',
  fuse: 60,                           // omit for a state with no idle half
  stacks: false, once: true,          // the defaults
  desc: 'Play it and X. Leave it 60 seconds and Y.',
  use(ctx)   { return { note: '...' }; },              // ctx: { card, r, c, id, handCells }
  idle(ctx)  { return { leave: 'discard'|'delete', note: '...' }; },
  leave(ctx) { /* fires from removeAndFall, before the fall */ },
}
```

- `use` fires post-commit in `playHand`. If your payout has to change THIS hand,
  it cannot live there - see Callback and Roll Call above.
- `once: true` (the default) spends the charge either way. That is what makes a
  state a decision rather than a permanent upgrade.
- Numbers go in `BAL.card_states`, not in the row.

### Where states come from

Today: the **Hallmark** knack (one of its eight outcomes) and the **dev panel**
(Dev → Card States: pick a state, tap a card). Obvious further wiring, none of it
done: the reward grid's Blessed Card tile, the Pick a Card event, the payout Pick's
fourth option, a Mart card service.

---

## 3. The parked list

Designed and agreed, not built. Each is a row in `CARD_STATE_DEFS` and nothing
else.

### Play halves

| name | play it |
|---|---|
| **Understudy** | primes 2 random Tricks: they fire an extra time on your NEXT hand. Rides `_primed`. |
| **Secondment** | improves one owned Trick, Sleight or Knack by a tier, no roll. Rides `improveEntity`. |
| **The Ringer's Note** | pulls one more card off the board into the hand if it makes it better, ignoring selection size and adjacency. Rides `ringerAugment`. |
| **Dispatch** | spreads its own permanent buffs onto both orthogonal neighbours. Rides `enhanceCardKey`. |
| **Bankroll** | pays credits equal to the hand's card count times N. |

### Idle halves

Each sits on a different ambiguity axis on purpose. The test for a new one: can you
name a board on which you would WANT it to fire?

| name | ignore it | good when | bad when |
|---|---|---|---|
| **Reshuffle** | goes back into the draw pile, a fresh card falls into its slot | it was a dead 2 in a corner | you were saving it |
| **Migrate** | hands its permanent pips and mult to a random neighbour, keeps its own face | concentrates a buff onto a better-placed card | the value lands where you did not choose |
| **Root** | +2 permanent mult, and it can never be swapped or discarded again, only played | you can afford to leave it and let it grow | a permanent hole in your board flexibility |
| **Ripen** | +5 pips AND becomes Fleeting | you get a fat card if you use it soon | the longer you ignore it the bigger and the closer to gone |
| **Magnetise** | drags the board's nearest card of its own rank or suit into an adjacent cell | hands you a pair or a flush start | tears that card out of whatever you had planned |
| **Tide** | the whole row takes its suit | a flush you did not have | every run in that row is gone |

Also raised and not yet placed: *converts to a random rank*, *gives a neighbour
Fleeting*, *gives a neighbour Temp*, *makes a copy of a random neighbour*,
*converts the suits of two neighbours*.

### Bigger, parked deliberately

- **Deck variants.** One deck carries card states and another does not; one carries
  all the time manipulation and a shorter clock but weaker pip cards. Balatro's
  decks, as a way of isolating systems so one run is not carrying everything at
  once. No work started.
- **Converting a temp card to a permanent one.** `makeCardPermanent` exists and is
  unused. The open question is what pays for it.

---

## Where the numbers live

| what | where |
|---|---|
| state chances and amounts | `BAL.card_states` (js/data/balance.js) |
| the Turnover interval | `BAL.turnover` |
| curse lift counts | `CURSE_DEFS` (js/deck-grid.js) |
| the discard's per-card seconds | `BAL._resources.discard_seconds_per_card` |
| fuse lengths | the `fuse` on each row in `CARD_STATE_DEFS` |

`BAL.card_states` is deliberately **not** an entity id, so `js/improve.js` never
scales it: a state is not something you own and improve.
