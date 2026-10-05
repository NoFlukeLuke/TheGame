# TODO - the shared work backlog

**Every session reads and updates this file.** It is the one place planned work lives, so a
fresh chat can pick up where the last one stopped without re-deriving it from git history.

- **This file is WORK: things to build, in rough priority order.**
- `OPEN_DECISIONS.md` is **BALANCE**: measured findings deliberately left alone because
  changing them is the owner's call. Do not merge the two - an item moves from there to
  here only once the owner has decided what it should become.

When you finish something, delete it from here and say so in the commit. When you find work
you are not doing, add it here rather than leaving it in a commit message nobody will read.

---

## 0. CARD EFFECTS - a probability table, and two dual-identity effects (owner, r391)

**A probability table for which card effects show up** (Flow's deck editor, card packs,
and since r391 the reward grids' card tiles, which guess at 35% pack / 65% buff op).
Some effects should be rarer (the x mult / x pips / replay buffs are the obvious ones).
One table read by every surface, so the odds cannot drift between them.

**The two dual-identity effects shipped in r392** (see CLAUDE.md). What is left here is the
table itself: `FLOWR_OP_WEIGHTS` in js/flow-rewards.js holds the owner's tiers as a first
pass (rarest: Second Suit / Second Rank; then Stamp, x mult, x pips, Replay; then Focus,
Time, Coin, Rank Pull, Cut; then +pips, +mult, Suit Spread). Rank Pull, Cut, Replay and
Coin were placed by guess and want the owner's call. Also open: the corner-band map for
x mult / x pips / Focus, which have no mark on the card yet (CARD_EFFECTS.md).

## 0b. THE RESERVE - cards you hold and place by hand (owner, r484)

A second place a card can be: not the deck, not the board, a **RESERVE**. Reached by
**double-tapping the hand preview area**, which swaps that panel to show what you are
holding; from there a card is **placed on the grid by hand**, the way a Sleight is.

- **Card Market stocks it.** Buy as many as you can afford at **5 credits** each (the
  price will want to vary by mode). **50% of them carry one random buff, 5% carry two.**
- The placement gesture is Dealer's Choice's (`js/dealers-choice.js`, r423): it already
  holds temp cards off-board and places them into a cell by tap, with the swap hooks and
  the swap time cost. **Read that file before designing this one.** The difference is that
  a reserve card persists across rounds and is not a temp card.
- Open: does a placed card join the deck or return to the reserve when it leaves the
  board? Is the reserve capped? Does it survive a save (it must - `SAVE_VARS`).

## 0c. JUNK CARDS - a deck cost worth paying with (owner, r484)

There is **nothing in the game that costs you a card slot**, and several events want one.
Today's three curses (`CURSE_DEFS`, js/deck-grid.js) all fire **when the card scores** and
all **lift after N scores**, so a cursed card is a nuisance you clear by playing it - the
opposite of a lasting cost. Stones are inert but boss-owned and filtered out of the piles.

What is wanted:

- **An inert card** that really sits in your deck. 6 of them as an event offer: hold them
  for N rounds and the payout is large.
- **Arrival costs** - a card that bills you when it LANDS on the board, not when it
  scores: -5 Focus, -8 seconds, caps a single card's pips at 50. **No hook exists**;
  `fireSleightsOnDraw` (js/sleights-runtime.js) is the precedent and the right site.
- **A stone that breaks what is under it** - moves that card to the played pile unplayed,
  on landing or after 20 seconds in place.
- Junk cards are then available as a **gamble cost** to any event (Extra Rep takes 3).

## 0d. THE SLOT MACHINES - a design pass before they are kept (owner, r484)

**Card Slots** (`the_floor`) and **Entity Slots** (`the_payline`) both "feel odd" and
neither is worth keeping as it is. Owner's leads, plus what the odds actually are today:

- **Card Slots** draws 5 reels from the live deck and pays a line that matches. P(three
  alike on a line) is the sum over suits of that suit's deck share cubed - **1/16 a line
  with four suits, 1/49 on Spectrum** - so most spins pay nothing and the player cannot
  tell why.
- Leads: **narrow the reels to a few random ranks** so a hit is likely; or make a spin
  **cheap and repeatable** so you buy several; and **a hit also improves one random
  entity** on top of the card buffs.
- **Entity Slots** caps at `SLOT_ENT_SYMBOLS` (4) distinct symbols, so P(three alike) is
  exactly 1/k^2. It is also the fifth source of entity improvement in the game.
- Worth reading how real slot design creates tension (near misses, variable reel weights,
  a visible paytable) and adapting it, rather than tuning these two numbers.

## 0e. TWO AND A CATCH - parked, for much later (owner, r484)

Removed from the pool because its randomness is too hard to read: two Tricks and a shadow
debuff you cannot refuse, none of it chosen. Worth bringing back only if the pairing is
**tailored** - the debuff aimed at what the two Tricks are for, so the catch is legible
before you accept it.

## 1. MAP MODE - its own mode, owner-specced

The big one. Guided's crossroads answers "what next"; this answers "what is my route through
the whole quarter", which is what every roguelike map is for.

**The board.** A **6 column x 4 row** grid. The play grid **animates outwards to the left** to
make room and the tiles **fall in from above like cards** - the same movement the reward grid
tiles already use, so it reads as part of the game rather than as a menu.

**Theme: planning your work schedule.** Dates or times on the tiles. An act is a QUARTER, so
months is the natural unit - open question, and worth a pass on the wording rather than a
guess.

**Movement.**
- Choose a starting tile, then return to the map after each level.
- Movement is **orthogonal only**.
- You move sideways one column at a time, and **within each column you may move up or down
  once** - so you can never take every tile in a column. That restriction is the whole
  decision.
- The **last tile is always the boss** and does not need to be orthogonally reachable. (Or:
  make the 5th column only 2 tiles, so the boss IS reachable orthogonally and the rule stays
  unbroken. Owner leaned toward whichever keeps the rule intact - decide when building.)

**Contents.** Every column carries **at least one playing level**, then a mix of reward grids,
shops, events and **challenge levels**.

**Depends on:** challenge levels (see below), which are being built for Guided first.

---

## 2. GOLD REVISION PASS

**The player gets so much gold it is barely a constraint.** Prices were lowered in r229 as a
stopgap, but the real fix is an economy audit: what a round pays, what the payout lines pay,
what things cost, and whether credits should be scarce at all or whether the scarce thing is
something else. Re-measure rather than adjusting single numbers - `OPEN_DECISIONS.md` has the
method for this kind of audit.

---

## 3. ELITES AS MINI-BOSSES

Challenge levels (raised goal + an extra requirement) are the first version. The other half
the owner asked for is **mini-bosses: a real boss whose gimmick is about half as hard**.

**This cannot be done by halving numbers across the board** - it needs a pass on each preset
individually, because "half" means something different for every one of them (half the
cadence? half the count? half the duration? some do not halve at all). Do it boss by boss.

---

## 4. THE PREVIEW KNACK - "see what is behind the tile"

Owner asked for a knack that shows what a crossroads tile holds before you pay for
it (Hades shows the reward type on the door). **Not built, and the reason matters.**

A preview is only worth having if it is TRUE, and the two tiles worth previewing
build their contents when they OPEN, not when they are offered:

- the shop's stock comes from `buildShopGridStock()` (js/shop-grid-preview.js)
- the reward grid's comes from `generateRewardContent()`, seeded `('reward', rewardVisitIndex)`

Both keys are POSITIONAL, so generating either twice at the same key should give
the same answer - which means a truthful preview is possible. What it needs is a
check that each generator is genuinely side-effect-free when called early (they
write `rewardCells`, `martStock` and friends), and a cache so the screen that
opens afterwards uses the SAME object rather than regenerating. A preview that
shows one thing and then hands over another is worse than none.

Events are already named on the tile, and the hard round already prints its
requirement, so those two halves of the ask are done.

## 5. KNOWN GAPS IN THE ENGINE

Small, real, and each one already measured:

- **`corner_retrigger` (Cornered) fires once at the end**, as a x pips over the whole hand,
  rather than per corner card. Moving it into the loop is one line and **changes the score**
  (`(T*m)*m` is not the same as applying x m twice mid-loop), so it is a balance decision.
- **`cellCountsForTriggers()` is defined in `js/boss-effects.js` and called from nowhere.**
  The documented rule that a quarantined cell's card should not count for "while on the grid"
  entity triggers is therefore not actually enforced.
- **`jack_mult` and `heart_double` have `BAL` entries and `DESC_TEMPLATES` but no
  `TRICK_POOL` entry** - scored for, described, and unobtainable.
- **Match-3 and Dominoes have no boss wiring at all.** That is why they are hidden behind the
  dev panel's Modes group rather than listed in the carousel. Wiring bosses into the cascade
  is the open follow-up if either is ever to ship.

---

## 6. FOCUS ON THE TIMELINE

r220 put SCORE on an ordered event timeline so every Trick pays out at its own moment.
**Focus has not had that treatment.** `generateHandFocus` runs in `playHand` BEFORE the dance,
so an attributed Focus grant fires its particle before the cards have even moved. It wants the
same ordered timeline replayed between the card beats, at which point those calls become
events rather than immediate effects.

---

## 7. GUIDED - THE REST OF THE MAP-MODE THINKING

Ideas raised and deliberately not built, kept because they are still good:

- **Route identity.** Picking a lane at act start (cheaper Mart but dearer grid, or the
  reverse) would colour a whole act. **Partly addressed in r229** - the weighted four-tile
  draw means two runs no longer route identically - but a deliberate commitment is still
  missing. Largely Map mode's job.
- **A mid-act landmark.** Eight slots with no midpoint is flat; a fixed mini-boss at slot 4
  would give the act a shape. Also largely Map mode's job.
