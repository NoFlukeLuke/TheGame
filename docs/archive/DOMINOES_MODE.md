# Dominoes Mode — Design Spec (draft, pre-build)

A new, **fully separate** game mode. Nothing in this doc changes Normal/Survival/etc.
Everything is gated behind `ACTIVE_MODE.id === 'dominoes'`. Built from the r117 modular
build.

Status: **decisions locked from the owner's Q&A; scoring math + a couple of numbers
flagged PROPOSED and awaiting sign-off.**

---

## 1. The tiles (the "deck")

- A domino carries **two values**, each **1–7**. **No blanks** — every half is a real
  number.
- **Deck = 49 tiles.** Every number owns a **full set of partners 1–7**: the 1s are
  1-1…1-7, the 2s are 2-1…2-7, … the 7s are 7-1…7-7 (7 × 7 = 49).
  - Read as *unordered* tiles that means the **seven doubles** (1-1 … 7-7) exist
    **once each**, while every **mixed pair appears twice** (1-2 comes from the 1s,
    2-1 from the 2s) — 7 + (21 × 2) = 49.
  - So there ARE duplicates, but it is **not a second copy of the whole set** — the
    distinction the owner asked for when dropping the old ×2 double-six deck.
- **Shape:** twice as long as wide (2:1), noticeably **thinner** than current cards.
- **Face:** two pip clusters split by a center line — one value per half.
- **Pip colors by value:** 1 = red, 2 = orange, 3 = yellow, 4 = green, 5 = blue,
  6 = purple, **7 = magenta** (extends the owner's rainbow now the range is 1–7;
  white was the old blank's colour and is dropped with the blanks — white pips would
  barely read on the cream tile face). Cosmetic; not used for matching.
- **Doubles** (e.g. `3|3`) count as **two of that number** for set-making.

### Optional suit plumbing
Some engine machinery expects a `suit`. Map **values 2–5 → the four suits**
(2=♠, 3=♥, 4=♦, 5=♣ — arrangement TBD), leave **0, 1, 6 suitless**. This is internal
only; **suit-based tricks do not apply in this mode**, so the mapping is just to keep
shared code from choking on a missing suit.

---

## 2. The board & physics

- **Grid: 7×7** (49 cells — one cell per tile in the deck). Existing grid-size
  **upgrades apply**.
- **One domino occupies two adjacent cells** — horizontal or vertical — as **one rigid
  piece**.
- **Orientation** is decided when the piece spawns and is **fixed** thereafter (it does
  not rotate while falling).
- **Gravity** acts on the rigid piece: a horizontal domino needs **both** cells beneath
  it clear to drop; this **naturally creates gaps/overhangs**. Gaps are allowed.
- **Refill:** empty cells left behind get filled by **new dominoes** dropping from the
  top (mode auto-refills, like Normal).
- **Swap:** you can swap **adjacent whole pieces** (a domino is moved as a unit).
  *v1 constraint:* both pieces must share the same **orientation**, so the two
  footprints are congruent and the exchange always fits. (Mixed-orientation swaps
  would need rotation, which conflicts with "orientation is fixed once spawned".)

---

## 3. Selecting & forming hands

- You select **whole dominoes**, not halves. **Selection cap starts at 3 dominoes**
  (= up to 6 half-values). Upgradeable later like the normal card cap.
- **Selected dominoes must be ADJACENT** — the picked group has to stay orthogonally
  connected (any cell of one touching any cell of another), matching how connected
  selection works in the base game. Pieces that can't legally join the current
  selection are dimmed. Deselecting a piece that splits the group prunes the
  now-orphaned pieces.
- Detection runs over the **pool of half-values** from the selected dominoes.
- **Hands start at length 3** and every larger length also counts:
  - **Runs:** 3, 4, 5, 6, 7… consecutive distinct values.
  - **Sets:** 3, 4, 5, 6… of the same value. (No pairs / sets of 2.)
- **Score ALL hands present**, not just the best. Multiple hands from one selection is
  the whole point.
- **Values may count toward more than one hand simultaneously** (double-counting is
  intended). Worked examples from the owner:
  - `1|2, 3|4, 5|6` → values {1,2,3,4,5,6} → **one Run of 6**.
  - `2|2, 2|3, 2|4` → values {2,2,2,2,3,4} → **Set of 4** (the four 2s) **+ Run of 3**
    (2-3-4). The 2 is shared by both.
  - `4|5, 4|5, 4|5` → values {4,4,4,5,5,5} → **two Sets of 3** (three 4s, three 5s).
- **Decomposition rule (PROPOSED):** find **maximal** runs and **maximal** sets in the
  value pool. Take the longest run(s) rather than also counting every shorter sub-run
  inside it, so `1..6` is a single Run of 6, not also a pile of Run-of-3s. A value can
  belong to one maximal run **and** one maximal set at the same time.

### Hand list + base values (PROPOSED — balance later)
| Hand | base pips | base mult |
|---|---|---|
| Run of 3 | 20 | 3 |
| Run of 4 | 28 | 4 |
| Run of 5 | 40 | 5 |
| Run of 6 | 60 | 6 |
| Run of 7 | 90 | 7 |
| Set of 3 | 30 | 3 |
| Set of 4 | 60 | 5 |
| Set of 5 | 100 | 7 |
| Set of 6 | 150 | 9 |

---

## 4. Scoring math (PROPOSED — this is the main thing to confirm)

Two owner rules drive this:
- **Q10:** every selected half contributes its **face value (0–6) as pips**, *even if
  that half isn't part of any matched hand*.
- **Q7/Q8:** every hand present scores, and shared values count in each hand.

**Proposed formula for one play:**
```
For each component hand H found:
    handScore(H) = ( HAND_BASE[H].pips  +  Σ face-values of the halves used by H )
                   × HAND_BASE[H].mult
    (× any trick effects that match H's size/type — see §6)

loosePips = Σ face-values of halves NOT used by ANY hand      (each ×1)

playScore = ( Σ handScore(H)  +  loosePips )  ×  FocusMultiplier
```
So overlapping values pay off (they're counted inside each hand they join), unused
halves still trickle in points, and Focus multiplies the whole play exactly like Normal.
**← confirm this model, or tell me how you'd rather the multiple hands combine.**

---

## 5. Scoring animation

- Add a **hand-type label to the left of the hand-preview area**.
- On play, the dance **cycles through the component hands one at a time**: label shows
  e.g. **"Set of 3"**, that hand animates/scores, then the label **pops and switches**
  to the next (e.g. **"Run of 4"**), which then animates/scores — repeat for every
  component.

---

## 6. Tricks, knacks, curses

- **Tricks:** curate a **hand-picked subset** for this mode (not an auto-convert).
  - **Exclude** suit-based tricks (no meaningful suits here).
  - **Keep** odd/even tricks (apply to domino values). Prime/rank-range tricks that read
    values 1–6 can stay.
  - **"Per card" → "per half"** to start.
  - **Hand-size tricks apply per component, by that component's size.** Example: select 4
    dominoes, get **Run of 4 + Set of 3** — a "3-card-hand" trick fires on the **Set of
    3** but **not** the Run of 4.
- **Sleights:** **removed** in this mode for now.
- **Knacks:** kept (should work as-is; verify none assume suits/faces).
- **Curses / buffed cards:** if kept, **adapt them to dominoes** (operate on a domino /
  its halves, not a rank+suit card).

---

## 7. Mode config & scope

- New `MODES.dominoes` entry in `js/menu.js`.
- **No bosses** for now.
- **Everything else uses Normal standards:** goal/points scaling, level-up flow,
  shop/events/reward-grid, credits & time economy — unchanged.
- Win condition: same family as Normal (revisit once bosses are added back).

---

## 8. Engineering plan (phased, non-invasive)

Each phase gated by `ACTIVE_MODE.id === 'dominoes'`; Normal code paths untouched.

1. **Data model** — `js/data/dominoes.js`: the 56-tile set, value/color/suit maps,
   `makeDomino()`, a `_isDomino` flag + `cardCan()` entry.
2. **Two-cell grid support** — teach `gridData` + placement that one piece spans two
   cells (piece id shared by both cells, or a piece registry with cell refs).
3. **Rigid-piece fall engine** — a dominoes-specific path in `removeAndFall` /
   dealing that drops 2-cell pieces with gaps + refill.
4. **Render** — thin 2:1 domino card in `js/render.js`: split pip clusters, per-value
   colors, horizontal/vertical layouts.
5. **Selection + detection + scoring** — half-value pool, maximal run/set
   decomposition, the §4 formula, new hand table.
6. **Animation** — hand-type label + component-by-component cycling in the dance.
7. **Tricks subset + knack/curse adaptation.**
8. **Mode wiring** — menu entry, deck init, grid size, economy, testing hooks.

**Biggest engineering risk:** #2/#3 (two-cell rigid pieces) break the one-card-per-cell
assumption the grid + fall code is built on. That's where most of the work — and the
care not to disturb Normal mode — will go.

---

## 10. Build status

### v1 (shipped, r119) — the playable core
Fully isolated subsystem (`js/data/dominoes.js` + `js/dominoes-mode.js`); Normal mode
untouched. Reached via the **DOMINOES (BETA)** button on the main menu.
- 56-tile deck, 8×8 board.
- Two-cell rigid pieces (H/V), gravity with natural gaps, top-spawn refill.
- Thin 2:1 tiles with split pip-faces + per-value colors.
- Tap to select up to 3 dominoes; live score preview.
- Detection of all maximal runs/sets ≥3 over the six halves (double-counting) —
  verified against all three of the owner's worked examples.
- §4 scoring (each hand + loose halves, × Focus); goal/level scaling per Normal.
- Component-cycling hand-type label in the preview during scoring.
- Minimal round/level advance (endless).

### v3 (shipped, r125) — merged with main; added to the mode carousel
While this branch was being built, `main` moved from r117 to r124 (Six Suits,
Match-3 + Zen, a **mode-select carousel**, win finale, 3- and 4-card trick
families). This branch was merged with that work rather than deployed over it.
- Dominoes is registered in main's existing **mode-select carousel**
  (`MODE_SELECT_LIST` + `MODE_META`), reached via **PLAY → scroll right**. It is
  the 5th card, purple accent, domino-pip glyphs.
- The standalone "DOMINOES (BETA)" button and the interim custom picker built on
  this branch were both **removed** — main's carousel supersedes them.
- `MODES.dominoes` carries a `dominoes: true` flag, mirroring match-3's `match3`
  flag, so shared code can gate on it.
- **Bug caught by the merge:** Dominoes is neither an act mode nor match-3, so it
  fell into the shared engine's *legacy timer progression* — which would have
  popped shops and bosses off the 20-minute game clock and hard-ended a run at 0.
  Added `dominoActive()` to the same guards match-3 uses (`startTimers`,
  `resumeGame`), plus a route in `_onRoundEndCore` so a timer-expiry goal-reach
  calls `dominoAdvanceLevel()` instead of the poker-specific `triggerLevelUp()`
  (which would deal cards onto the domino board).

### v2 (shipped, r120) — adjacency + the action loop
- **Adjacency rule** on selection (connected group; illegal picks dimmed; prune on
  a splitting deselect).
- **Swap:** double-tap a domino to arm it, tap an adjacent same-orientation domino
  to trade places. Costs a swap; board re-settles and refills after.
- **Discard:** selected dominoes return to the bottom of the deck; costs a discard;
  board re-settles and refills.
- Swap/discard HUD counters updated from the domino renderer (shared `render()` is
  routed away in this mode).

Verified headlessly (`ALL CHECKS PASSED`, 20 assertions): board integrity over 200
deals (no overlaps, no orphan cells, pieces always contiguous, gravity fully
settled), adjacency gating + prune, swap consistency + charge spend, and all three
of the owner's scoring examples.

### Deferred to follow-ups (not yet built)
- **Tricks** (curated subset, per-half, hand-size-gated per component) — §6.
- **Knacks** and **curses/buffed** tiles — §6.
- Richer fall animation (v1 uses CSS transitions on reposition).
- Grid-size upgrades / shop / events wiring.
- Timer-expiry behavior in this mode currently falls through to the shared timer.

### v4 (shipped, r130) — 7×7 board, 49-tile 1–7 deck
- Board **8×8 → 7×7** (owner: "smaller by one on both sides"). Tiles render larger
  and the pip faces read much more clearly.
- Deck rebuilt to the **49-tile 1–7 set** described in §1 (was 56 tiles of 0–6 ×2).
  Blanks removed; **7** added with a magenta pip colour and a 7-pip face (the
  6-pattern plus a centre pip).
- `DOMINO_ROWS`/`DOMINO_COLS` are now the single source of truth — `startGame`
  reads them via `dominoActive()` instead of repeating a hardcoded 8.

### Tuning note (needs a play-test verdict)
Boards settle at **32–48 of 49 cells filled (~11 empty cells, ~23% gaps)**. That is
the structural consequence of rigid 2-cell pieces + gravity — an odd-shaped
one-cell pocket can never be filled by a 2-cell tile. It may play great (gaps
create shape and make the adjacency rule bite) or feel sparse; easy levers if it's
too empty: spawn more aggressively, allow a piece to rotate to fit a pocket, or
shrink the board again.

Deck-vs-board note: 49 tiles against a board that holds ~19–24 means roughly two
boardfuls in the deck, so there is a real draw pile and refills bring genuinely
unseen tiles before it recycles.

---

## 9. Open items — RESOLVED
1. **Tile count = 56** ✓ (28 unique 0–6 pairs incl. blanks & doubles, ×2 copies).
2. **Scoring model = §4 as written** ✓ (each hand scores its own base+halves ×its mult;
   loose halves add face value ×1; sum all; ×Focus).
3. **Hand base values = placeholders for now** ✓ (balance after it's playable).
