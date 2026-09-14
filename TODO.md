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

- the Mart's stock comes from `buildMartStock()`, seeded `('shop', shopVisitIndex, martRerollN)`
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
- **`trickSellValue` is defined twice** - `js/shop.js` (x0.5) and `js/shop-grid-preview.js`
  (x0.6). Same global scope, so the later load wins and the real fraction is 0.6.
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
