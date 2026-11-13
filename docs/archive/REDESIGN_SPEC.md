# Redesign spec · shop · between-round score panel · grid lines

Three pieces of work, agreed with the owner, **not yet built**. Written so a
fresh session can pick any one of them up on its own. Owner is non-technical -
keep explanations plain.

Line references verified against **r216**. If they have drifted, the surrounding
prose says what to grep for.

> **Part 2 and Part 3 are BUILT (r223).** The between-rounds score panel and the
> whole grid-lines batch shipped; what is written below about them is the plan
> they were built from, and CLAUDE.md ("The lines, finished" and "The score panel
> between rounds") is the record of what actually landed and how it differed.
> **Part 1, the shop, is still the outstanding work** - and `shop-room-preview.html`
> is now the page for deciding how much room the left column keeps.

Decisions already made (do not re-litigate):

- The Mart overlay is **replaced**, not kept behind a flag.
- The bundle discount is **removed**, and Bulk Buyer with it.
- One item at a time: tap to highlight, then one PURCHASE button.
- "Improve Random" can hit a **card, a Sleight or a Trick**.

---

## Part 1 · The shop becomes a grid-takeover screen

### What the owner asked for

> The whole layout on the left stays in place and looks like it normally does.
> You just buy one thing at a time. Click something to highlight it, then a
> purchase button buys it right then. The purchase button could be where
> confirm or play is.

That is the **reward grid's shape, applied to the shop**. The left HUD column
(SCORE, Knacks, hand preview, Tricks, time, coins) stays exactly as it looks in
play; the shop fills the board area.

### Most of this already exists

`js/shop-grid-preview.js` is an on-grid shop behind `USE_ONGRID_SHOP`, and it
already does three of the things being asked for:

| asked for | already built | where |
|---|---|---|
| left HUD stays put | `enterGridScreenHud('SHOP','shop')` swaps the PIPS/MULT/FOCUS chips for a LOCATION readout and leaves everything else alone | `shop-grid-preview.js:36` |
| purchase button in the play slot | `enterShopGridButtons()` repurposes **Play -> BUY** and **Discard -> LEAVE** | `shop-grid-preview.js:163` |
| tiles look like the reward grid | tiles are `.reward-cell.on-grid` with the same rarity classes | `shop-grid-preview.js:186` |

So this is closer to a revive-and-finish than a build. What changes:

1. **`triggerShop()` routes here.** Delete the `USE_MART_SHOP` branch at
   `js/shop.js:167` so `openShopGrid()` is the route. `USE_ONGRID_SHOP` can go
   too once the Mart is gone - there is no longer anything to flag between.
2. **Selection becomes single.** `shopGridSel` is a Set today (the old
   multi-buy). It becomes one key or null. Tapping a second tile moves the
   highlight rather than adding to it; tapping the highlighted tile clears it.
3. **BUY buys immediately.** No cart, no checkout, no confirm step. The button
   reads `BUY 12` with the live price and greys out when the highlighted item
   is unaffordable or nothing is highlighted. On buy: charge, run `p.buy()`,
   fly the tile to its loadout bar, mark the slot `SOLD`, clear the highlight.
   `flyMartTile` in `js/mart-shop.js` is the fly animation worth keeping -
   port it before deleting the file.
4. **The grid stays the real size.** `openShopGrid` currently forces the board
   to 4x4 (`shop-grid-preview.js:133`) and restores on close. Keep that
   restore working - **see the clamp trap in Part 3**, it matters.

### Deleting the Mart

`js/mart-shop.js` (874 lines) and `css/mart.css` (594 lines) go. Carry these
across first, they are the parts worth keeping:

- `flyMartTile` - the buy-to-loadout flight.
- **Pinning** (`martPins` / `martApplyPins`) - holding an item across rerolls
  and between visits is good and has no equivalent on the grid shop yet.
- The **Tinker Bench** (`martOpenTinker`, `tinkerCost`) and the **Wheel**
  (`js/wheel.js`, still its own file) - both are services, see the Tools row
  below.
- `martTooltipPayload` - the tooltip contents.

Things that die with it and should NOT be ported: `martCart`, `martCartTotals`,
`martDiscountRate`, `martDiscountCap`, `martDiscountPct`, `martCheckout`, the
drag-to-cart gesture, the whole `mart-checkout` column, and the loadout column
(the real HUD shows your Knacks and Tricks already - that is the point of
keeping it on screen).

### What else points at the Mart

**Grep `openMart|closeMart|martActive|renderMart` before deleting anything.**
The Mart is referenced from five files outside its own, and one of them is the
tutorial, where a broken reference is silent rather than loud:

| site | what it does | what it needs |
|---|---|---|
| `js/shop.js:167` | the `triggerShop` route | delete the branch |
| `js/game-control.js:215` | `screenOwnsClock()` counts `martActive` so closing a Stats/Deck overlay does not start the round behind the shop | `shopGridActive` is **already** in that same list - just drop `martActive` |
| `js/survival.js:585` | suppresses something while the shop is open | swap to `shopGridActive` |
| `js/wheel.js:142,363` | calls `renderMart()` after a spin resolves | repoint to `renderShopGrid()` |
| `js/tutorial.js` | **four orientation steps** | see below |

**The tutorial is the one that will bite.** It has four steps anchored into the
Mart's DOM - `mart-loadout`, `mart-catalog`, `mart-wheel` and the step before
them - all gated on `tutMartReady()`, which tests for `#mart-loadout`
(`js/tutorial.js:104`). Delete the Mart and that predicate can never flip, so
each step sits on its 20-second anti-stall timeout in turn: a minute and a half
of a three-minute orientation showing text about a screen that no longer looks
like that. The steps have to be rewritten against the grid shop's anchors at
the same time as the shop lands, not afterwards.

The `survivalShopFromPick` behaviour (closing the shop returns to the
still-open pick screen rather than starting the round) also has to survive the
move - it lives in `closeMart` today.

### Removing the bundle discount

- `martDiscountPct()` and friends go with `mart-shop.js`.
- **Bulk Buyer** is the only discount entity in the game
  (`js/data/knacks.js:9`). Remove it from `KNACK_POOL` outright - with no
  bundle there is nothing for it to double, and leaving it in the pool means a
  reward tile that grants a knack doing literally nothing.
- `BAL.shop_discount` in `js/data/balance.js:118` becomes dead - delete the
  key rather than leaving a tuning table that tunes nothing.
- **Pin Head** (the backlog Trick that pays mult per pinned item) was never
  actually added to `TRICK_POOL` - checked. Nothing else depends on the
  discount. `BAL.shop_discount` is also explicitly excluded from the r206
  improvement system (`js/improve.js` only scales real entity ids), so removing
  it touches nothing there.

### Stock mix

Today every shelf is 3 wide and flat. The owner's call: **Tricks come up
enough on the reward grid**, so the shop leans the other way.

| category | now | proposed |
|---|---|---|
| Sleights | 3 | **4** |
| Knacks | 3 | **3** |
| Tricks | 3 | **2** |
| Limits | 3 | **2** |

On a 4-wide board that is a clean 4 / 3 / 2 / 2 plus a services row.

**And on the reward grid, knacks go up.** In `_generateRewardContent` the
ordinary grid table `buffCategories` (`js/reward-grid.js:68-85`) is `trick 40`,
`knack 7`. Raise knack to **12**; leave trick alone (dropping it would change
the `MIN_TRICK_TILES` guarantees too). The prize grid's own table just above it
(`js/reward-grid.js:56-67`) is already `trick 34 / knack 16` and needs no
change.

Note the tables have grown since these numbers were set - both now also carry
`luck` and three `improve_*` kinds. Raising knack takes share from everything,
so re-check the improve tiles still turn up often enough after the change.

### Services row (replaces the Mart's Tools)

Sits under the shelves, same row shape, not stock:

- **Spin the Wheel** - `openWheel()`, unchanged.
- **Tinker Bench** - `martOpenTinker()`, ported.
- **Improve Random** - new, below.

### Improve Random · 20 credits

One button, deliberately expensive, upgrades **one random thing you already
own**. It exists because the Trick tray caps at 10 and fills long before an act
does, so late in a run a shop full of grants has nowhere to put anything.

**This is now mostly already built.** `js/improve.js` (r206) gives every entity
an improvement TIER (0-5) and recomputes its numbers in `BAL` in place, so an
improved entity states its real figure to the player with no per-entity string.
The reward grid already carries an `Improve: <name>` tile
(`js/reward-grid.js:365`). What is missing is a **shop** entry point.

The whole API needed:

| call | does |
|---|---|
| `pickImproveTarget(type)` | a random owned, improvable, un-maxed entity - `type` is `'trick'`, `'knack'` or `'sleight'` |
| `improvePreview(id)` | what one more tier would read as, changing nothing |
| `improveEntity(id)` | commits the tier |
| `canImprove(id)` | false when maxed or when the entity has no scalable number |

So the service is: roll a type over the types you actually own something
improvable in, `pickImproveTarget`, `improveEntity`, and show the result.

Notes that matter:

- **Do not re-implement the three separate seams.** An earlier draft of this
  spec proposed rolling between `enhanceCardKey`, `sleightCapBonus` and
  `t._rank`. `improve.js` supersedes all three for entities - use it.
- **A deck CARD is still not covered by `improve.js`**, which only knows
  Tricks, Knacks and Sleights. If the service should also be able to buff a
  card, that branch alone rides `enhanceCardKey(key, e)`
  (`js/events.js:339`) - and it must pick with `everyDeckCard()` and key with
  `cardId(card)`, never `cardKey(rank, suit)`, or it can name a card that is
  not in the deck and buff every copy of a face. **Owner call: include cards or
  keep it entity-only?**
- **Roll only over what you own.** `pickImproveTarget` returns null for an
  empty pool - fall through to another type rather than charging 20 for
  nothing. If nothing at all is improvable the service should be greyed out on
  the shelf, not sold and then refunded.
- `pickImproveTarget` draws through `pickEntityByRarity` (`js/luck.js`), so
  Luck already tilts it. Nothing extra to wire.
- **Say what it hit.** A 20-credit spend that resolves silently reads as a bug.
  `improvePreview` gives you a before/after to show.
- Price scales per use, the way `tinkerCost()` does: 20, then 20 + step.

### Limits chip

The owner asked for a minimizable chip showing the limits, and wondered whether
an unused part of the UI could hold it. **The clock slot is that place, and it
is free precisely because of this screen**: the round clock is paused on every
grid-takeover screen (Rewards, Shop, Event), so `#clock-area` (portrait) and
`#vclock` (landscape) are dead space the whole time one is open.

- Collapsed: a chip reading `LIMITS 12` where the clock sits.
- Tapped: opens the **existing** `#limits-popup` (`js/limits.js`), already
  built from `LIMITS_DEF`, already living outside `#cabinet` for the cabinet
  `zoom` reason.
- Show it whenever `document.body.classList.contains('grid-screen')` - the
  class `enterGridScreenHud` already sets - so Rewards and Events get it free.

---

## Part 2 · Between-round score panel

### What the owner asked for

> On the reward grid screen, and maybe elsewhere, after a round and before the
> next one, the top part shows your score from the last round and the bottom
> says next quota.

The panel has two halves already: `#score-center` (label `Score` + the number)
and `#score-left` (label `GOAL` + `#goal-display` + the progress bar) -
`index.html:780-795`.

On a grid-takeover screen:

| half | normally | between rounds |
|---|---|---|
| `#score-center` | `Score` / live score | **LAST ROUND** / the score just banked |
| `#score-left` | `GOAL` / `roundGoal` | **NEXT QUOTA** / the next round's goal |
| progress bar | fills toward goal | hidden - it would read 100% and mean nothing |

### The one catch

`triggerLevelUp()` banks the finished round's `score` into `totalScore` and
**zeroes `score`** before the reward grid opens, so by the time this panel
renders the number is already gone. Capture it:

- a new `lastRoundScore` global, set in `triggerLevelUp` immediately before the
  zero;
- **add it to `SAVE_VARS`** in `js/save.js` or it will not survive a save;
- reset it in `startGame`.

`updateScoreUI()` (`js/hud.js:46`) is the single repaint point and it is called
from `render()`, so gate the relabel on `body.grid-screen` there and both
orientations get it with no second code path. `exitGridScreenHud()` puts the
labels back.

Worth checking while in there: the same panel is up during **Events** and the
**Mart** replacement, which is the "and maybe elsewhere" - `body.grid-screen`
covers all three.

---

## Part 3 · Grid lines

### Start here: there are no lines today

Eight Tricks mark a row or a column - `POSITION_ASSIGN_IDS` at
`js/scoring.js:1094`:

```
rowcol_triple_pips  rowcol_mult  rowcol_retrigger  perfect_timing
right_time  groove  assembly_line  overtime
```

**Only three of them draw anything.** `renderCardAppearance` sets `rc-pips`,
`rc-mult` and `rc-retrigger` (`js/card-fall.js:94-96`), which tint the card's
background (`css/style.css:1682-1716`). The other **five** mark a line
completely invisibly - the player is told "row 3" in the Trick's description
and the board never confirms it.

So this is not a tweak to an existing line system. It is the line system
existing for the first time, and it fixes five Tricks that currently have no
board presence at all.

### One function is already written and unused

`getRowColBonusesForCell(r, c)` at `js/scoring.js:1065` returns every bonus
whose row or column passes through a cell. It is called from **nowhere** -
verified again on r216. It is exactly the "which lines touch this card" query
the split highlight needs.

### 3a · A line layer that survives the reward grid

> The lines that appear as part of certain bonuses should remain on the grid
> during the reward grid.

- Draw lines into their own element, `#grid-lines`, a child of **`#grid-slot`**,
  not of `#grid`. (`#grid` is the only child of `#grid-slot` today -
  `index.html:843` - so the new layer is a clean sibling of it.)
- `renderRewardTiles` clears and rebuilds `#grid`'s children, and the on-grid
  shop does `gridEl.innerHTML = ''`. A layer inside `#grid` would be wiped by
  both; a sibling under `#grid-slot` is untouched.
- Position it with the same `cellLeft(c)` / `cellTop(r)` / `CARD_W` / `CARD_H`
  the cards use, and repaint it from `recomputeGridMetrics()` so it follows a
  resize.
- `pointer-events: none`, and under the cards in z-order.

### 3b · Even spacing when lines share a row or column

> If a column has two lines both appear at 33% and 66% of the width of the card.
> With 3 lines, 25 / 50 / 75.

For the **i-th** of **n** lines on one index, the offset across the card is
`(i + 1) / (n + 1)`. That gives 1/2 for one line, 1/3 and 2/3 for two, and
1/4, 1/2, 3/4 for three - exactly the owner's numbers, out of one formula.

More than one line can legitimately sit on the same index: the **District**
knack is what allows it (`lineOccupied` / `pickDefaultLine`, just below
`POSITION_ASSIGN_IDS`), and without District the game already prefers a free
line. So this case is real but uncommon - do not let it complicate the common
one-line path.

Group `rowColBonuses` by `axis + index`, sort within a group by a stable key
(the Trick id, so a repaint cannot reshuffle them), then index into the
formula.

### 3c · Clamp when the grid shrinks

> When manipulating rows or columns, the marked row should remain on its number
> when increasing. When decreasing, if the count goes below the marked number it
> should go to the highest number possible.

**Growing is already correct** and needs no work: `finalizePositionMark` stores
a plain number in `rowColBonuses` and nothing ever rewrites it, so a mark on
column 4 stays on column 4 when the grid widens.

**Shrinking is not handled at all.** Add:

```js
function clampRowColBonuses() {
  rowColBonuses.forEach(b => {
    const n = b.axis === 'row' ? gridRows : gridCols;
    if (b.index > n - 1) {
      b.index = n - 1;
      if (b._trickRef) finalizePositionMark(b._trickRef, b.axis, b.index);
    }
  });
}
```

Call it after the four sites that set the board size from the limits:
`js/game-control.js:328`, `js/level-up.js:54`, `js/save.js:256`,
`js/survival.js:470`.

**The trap - do not call it on a takeover resize.** Two screens shrink the
board temporarily and restore it on close:

- the on-grid shop forces 4x4 and restores from `shopGridSaved`
  (`js/shop-grid-preview.js:133` and `:152`);
- Dominoes sets `DOMINO_ROWS/COLS` (`js/dominoes-mode.js:115`, and again at
  `js/game-control.js:330` right after the limits assignment - so that one line
  must come *after* the clamp, not before it).

Clamping on those would permanently destroy a mark on column 5 - the board
comes back to 6 wide and the line stays at 3 forever, because the clamp is
lossy. Clamp only where the size comes from `limits.*`.

**Where this bites today**, since no debuff shrinks the play grid: the **prize
grid is two rows and columns smaller** than the play grid
(`js/reward-grid.js:32-33`). Once lines are drawn on takeover screens
(part 3a), a line on column 5 of a 6-wide board has nowhere to go on a 4-wide
prize grid. The clamp is what makes 3a correct there - but it must be a
**display-time** clamp for the prize grid, not a write back into
`rowColBonuses`, for the same reason as above. Clamp the *drawn* index against
the grid being drawn; clamp the *stored* index only on a real limits change.

### 3d · Split highlight on intersections

> If a card intersects two lines the highlight is half and half. Three lines,
> three colours at 33% each.

The highlight is the ring around the card. Today it is a background tint plus a
border colour, and the three combinations are hand-written
(`.rc-pips.rc-mult`, `.rc-pips.rc-retrigger`, `.rc-mult.rc-retrigger` -
`css/style.css:1692-1716`). That does not scale past three, and five Tricks
have no colour at all.

Replace it with one ring that divides evenly:

- `getRowColBonusesForCell(r, c)` gives the list of lines on this card.
- Map each to a colour from a new **`LINE_COLORS`** table keyed by Trick id -
  all nine ids need an entry. Keep today's three where they are so nothing the
  player has learned changes: `rowcol_triple_pips` blue `#2255cc`,
  `rowcol_mult` red `#a0030b`, `rowcol_retrigger` bone `#e0ddd0`.
- Paint a `conic-gradient` of n equal hard-stop wedges on a `::after` that
  covers the card, and mask it to a ring so only the border shows:

```css
.card.has-lines::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  padding: 3px; pointer-events: none;
  background: var(--line-ring);           /* the conic-gradient, set from JS */
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
```

JS sets `--line-ring` per card. One line is a solid colour rather than a
one-wedge gradient, so the common case stays cheap.

**Drop the background tints when this lands.** Three lines crossing one card
would make the face unreadable, and the ring already carries the information.
Spectrum's numeric cards make this decision for you - they already override the
`rc-*` backgrounds back to the card colour (`css/style.css:2110-2118`) because
the tint was destroying the one thing a Spectrum card has to show.

### 3e · What a line looks like

Not specified by the owner. Suggestion, to be confirmed: a 2px line in the
Trick's `LINE_COLORS` colour running the full length of the row or column,
under the cards, with a soft glow - the same visual family as the rings so a
player reads the line and the ring as one thing. A small marker at the head of
the line (the Trick's emoji) would say *which* Trick owns it, which matters
once several are on the board.

---

## Build order

1. **Part 3 (lines)** - self-contained, most visible, and it makes six Tricks
   real. Nothing else depends on it.
2. **Part 2 (score panel)** - small, and it is the same `body.grid-screen`
   plumbing the shop will lean on.
3. **Part 1 (shop)** - the biggest, and the only one that deletes code.

Validate after each with the syntax check in CLAUDE.md, and bump `BUILD` in
`js/menu.js` on every commit.
