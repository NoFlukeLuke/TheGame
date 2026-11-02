# CURSE CARDS - the four horsemen (r723), the parked conditions, the ten ideas

## Built (r723)

Four curse cards, one a horseman each (`js/horsemen.js`, `js/anvil.js`). A curse card sits
on the board, cannot be selected, played or discarded by hand, and a Sleight's discard or
Severance Package removes it.

| horseman | card | does |
|---|---|---|
| **War** | the boss stone (`isAnvil`), a sword | every 15s drops a row and crushes the card under it to the played pile; rests 30s at the bottom, then drops out. Swappable. |
| **Death** | curse card `death`, a spinning scythe with an arrow | every 30s flies the way the arrow points; every card in its path goes to the played pile (the deck editor's cut look); it embeds where it stops and rolls a new direction. Falls and can be swapped until its first flight, then neither. |
| **Famine** | curse card `famine` | a 30s clock, reset by swapping it. At 0 one of: a swap or a discard of stock, 20s off the clock, a Trick muted for 20s, every Sleight on the grid discarded (charges kept). |
| **Pestilence** | curse card `pest` | every 30s a neighbour becomes one (that card to the played pile, a temp Pestilence in its cell; at most 4 on the board). Playing it in a hand resets that clock: it can be selected, takes no Selection Size slot, scores nothing and stays on the grid. Every 15s it changes places with a neighbour. One that has not spread for 65s leaves. |

Bosses: **WAR** (the old Stone Lord), **THE REAPER** (one Death card at the start, another every
45s; cards the scythe takes cost half their rank in seconds), **THE PLAGUE** (two Pestilence cards
in opposite corners, another every minute), **THE SHORTAGE** (one Famine card at the start, another
every 45s). A boss's horseman is a temp card: never in the deck, gone at the round's end.

**Where they are met outside a boss (r726):** the Balance Sheet's curse tile, the Mystery tile's
bad roll, Pairs' penalty A and the Rehearsal event each put a random horseman curse card (Death,
Famine or Pestilence) into the deck; the Balance Sheet's War tile, the Mystery, Pairs' penalty B
and the 1-on-1 put War in. A deck horseman comes back every round until it is removed: the Cleanse
tile (a curse card first, then a card curse), Clean Up / Clean Slate, Severance Package, or a
Sleight's discard. The card curses (Leaden / Taxing / Snared) are no longer handed out anywhere;
they stay in the code for saved runs and the Cleanse tile.

**Severance Package** (legendary Trick): double-tap a curse card or a stone to discard it for
1 swap and 1 discard. With it in the tray the double-tap lifts no stone for a swap (lift the
other card and tap the stone instead).

Every number is in `HM` (js/horsemen.js) and `ANVIL_CFG` (js/anvil.js).

### Pestilence: the owner picked option (c)

Of the three shapes raised (spread onto a still neighbour / play it to hold it / both), the owner
took both: it spreads on a 30s clock, and playing it in a hand resets the clock. Built in r726.

### The parked conditions (owner's four)

Named but not built: **Dead** (scores nothing, fires no Tricks), **Starved** (cannot form a hand:
a kicker), **Scarred**, **Spoiled**. The owner's note: Starved is the better fit for "becomes a
kicker"; Famine's starving carries the stock / time / Sleight loss; Spoiled as "discards cards
around it" is the weakest. Each would be given by its horseman. Leaden / Taxing / Snared stay in
the game until these replace them. Leech and Smog are retired (never drawn; a saved run keeps
them).

## The r722 survey (kept for the record)

Owner's direction: one or two more kinds of curse CARD, then remove the other
curse effects, so curse cards turn up often enough to build entities around
making and removing them.

## What exists today

Two separate systems both called "curse":

| system | what it is | kinds | where it comes from |
|---|---|---|---|
| **Curse cards** (`CURSE_CARD_DEFS`, js/boss.js, r590) | a board object: junk that carries a debuff. Cannot be selected, played, swapped or discarded. Back into the deck after 120s on the board. | **Leech** (a hand next to it costs 2s), **Smog** (hands next to it score ×0.8 mult) | Rehearsal event (`addCurseCardsToDeck`). Removed by Clean Up / Clean Slate (`clearCurseCards`). |
| **Card curses** (`CURSE_DEFS` / `cardCurses`, js/deck-grid.js) | a debuff on one of YOUR cards, lifted by scoring it N times | **Leaden** (0 pips, 3 scores), **Taxing** (-3s a score, 4 scores), **Snared** (no swap or discard, 2 scores) | reward grid curse tile, the Mystery tile, Pairs penalty A, Plinko, Rehearsal's chain. Lifted by the Cleanse tile. |

Since r722 two things already touch curse cards: a **Sleight's discard pierces
them** (Procrastinate, Magnet, Photocopier, Fresh Start, Bomb take them off the
board), and **the Anvil crushes them** like any card.

## Proposed consolidation

1. Keep curse cards as THE curse. Delete `CURSE_DEFS` / `cardCurses` (Leaden,
   Taxing, Snared) and their tooltip lines, card marks, Records row and save
   migration.
2. Every source that cursed one of your cards adds curse cards to the deck
   instead (reward grid tile, Mystery, Pairs A, Plinko, Rehearsal). The Cleanse
   tile removes curse cards.
3. Three or four kinds in total: Smog stays, Leech folds into Red Tape (idea 1),
   plus one or two from the list below.

## Ten ideas

Every one is a curse card: it sits on the board, cannot be played, swapped or
discarded by hand, goes back into the deck after its time, and a Sleight's
discard or an Anvil removes it.

| # | name | does | notes |
|---|---|---|---|
| 1 | **Red Tape** | Cards in its row and column cost +3s to swap or discard. | The owner's "costs time to interact with", refined. Selecting and playing stay free (a cost on a tap is invisible and feels like lag). A line reads at a glance; "touching" is the alternative. Could grow +1s each time it is paid in a round. Replaces Leech. |
| 2 | **Gossip** | Every 30s, a card touching it becomes another Gossip (at most 3 on the board). | The spreader. The one that makes removal urgent, so it is what removal entities are FOR. Old idea: CARD_MECHANICS.md's "escalation". |
| 3 | **Lien** | Cards touching it lose their buffs while they touch it. | Punishes a buffed build. Rides the existing "muted card" read (a muted card's x pips does not fire). |
| 4 | **NDA** | Cards touching it are face down: rank and suit hidden. | Reuses The Fog's face. Cheap to build. |
| 5 | **Timesheet** | -1s every 5s while it is on the board. | Pure pressure, from Arrears (CARD_MECHANICS.md) moved off the score onto the clock. Through `spendRoundTime`, never a raw write. |
| 6 | **Garnish** | A hand touching it costs 3 credits; with none, 5s. | Wage garnishment. A money curse, so the shop and interest feel it. |
| 7 | **Paper Jam** | Cards do not fall past it: a hole above it stays empty until it leaves. | Plays with the board's gravity (and the Anvil, which crushes it). |
| 8 | **Oversight** | Hands touching it make no Focus. | Hits the Focus builds. Reads `generateHandFocus` like the autoplay rule (r571). |
| 9 | **Lead Weight** | Cards above it in its column score half pips. | A column curse; pairs with the Anvil's columns. |
| 10 | **Probation** | When its time runs out, the cards touching it go with it to the played pile. | Worse the longer it is ignored, and removing it early is the answer. From the Notice list (CARD_MECHANICS.md). |

**Recommendation:** Red Tape (idea 1) and Gossip (idea 2), beside Smog. Red Tape
is the owner's and covers the clock; Gossip is the one that MAKES curse cards,
which is what entities that create and remove them need to push against.

## Entity hooks, for later

Not designed, just the shapes that fall out once curse cards are common:
a Trick that pays per curse card on the board; a Knack that pays credits for
each curse card removed; a Sleight that turns a curse card into a buffed card
instead of removing it; a Trick that makes Gossip spread onto YOUR side (a
curse card next to a Sleight charges it).

## Open questions for the owner

1. Which two (or more) to build?
2. Remove Leaden / Taxing / Snared outright, or keep one as a card curse?
3. Should curse cards still leave after 120s, or stay until removed (makes
   removal entities matter more)?
