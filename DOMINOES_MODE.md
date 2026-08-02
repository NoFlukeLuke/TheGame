# Dominoes Mode — Design Spec (draft, pre-build)

A new, **fully separate** game mode. Nothing in this doc changes Normal/Survival/etc.
Everything is gated behind `ACTIVE_MODE.id === 'dominoes'`. Built from the r117 modular
build.

Status: **decisions locked from the owner's Q&A; scoring math + a couple of numbers
flagged PROPOSED and awaiting sign-off.**

---

## 1. The tiles (the "deck")

- A domino carries **two values**, each **0–6** (blanks/`0` included).
- **Set = the full double-six set: 28 unique tiles** (all unordered pairs incl. doubles
  and blanks: `C(7,2)+7 = 21+7 = 28`). **×2 copies = 56 tiles total.**
  - *Note:* the owner said "42" before deciding to include blanks, and "~20ish" as an
    early gut number. Including blanks makes it **56**. **← confirm this is the intent.**
- **Shape:** twice as long as wide (2:1), noticeably **thinner** than current cards.
- **Face:** two pip clusters split by a center line — one value per half.
- **Pip colors by value:** 0 = white, 1 = red, 2 = orange, 3 = yellow, 4 = green,
  5 = blue, 6 = purple. (Cosmetic; not used for matching.)
- **Doubles** (e.g. `3|3`) count as **two of that number** for set-making.

### Optional suit plumbing
Some engine machinery expects a `suit`. Map **values 2–5 → the four suits**
(2=♠, 3=♥, 4=♦, 5=♣ — arrangement TBD), leave **0, 1, 6 suitless**. This is internal
only; **suit-based tricks do not apply in this mode**, so the mapping is just to keep
shared code from choking on a missing suit.

---

## 2. The board & physics

- **Grid: start 8×8.** Existing grid-size **upgrades apply**.
- **One domino occupies two adjacent cells** — horizontal or vertical — as **one rigid
  piece**.
- **Orientation** is decided when the piece spawns and is **fixed** thereafter (it does
  not rotate while falling).
- **Gravity** acts on the rigid piece: a horizontal domino needs **both** cells beneath
  it clear to drop; this **naturally creates gaps/overhangs**. Gaps are allowed.
- **Refill:** empty cells left behind get filled by **new dominoes** dropping from the
  top (mode auto-refills, like Normal).
- **Swap:** you can swap **adjacent whole pieces** (a domino is moved as a unit).

---

## 3. Selecting & forming hands

- You select **whole dominoes**, not halves. **Selection cap starts at 3 dominoes**
  (= up to 6 half-values). Upgradeable later like the normal card cap.
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

### Deferred to follow-ups (not in v1)
- **Tricks** (curated subset, per-half, hand-size-gated per component) — §6.
- **Knacks** and **curses/buffed** tiles — §6.
- **Swap** (adjacent rigid pieces) and **Discard** (currently a stub message).
- Richer fall animation (v1 uses CSS transitions on reposition).
- Grid-size upgrades / shop / events wiring.
- Timer-expiry behavior in this mode currently falls through to shared timer.

---

## 9. Open items — RESOLVED
1. **Tile count = 56** ✓ (28 unique 0–6 pairs incl. blanks & doubles, ×2 copies).
2. **Scoring model = §4 as written** ✓ (each hand scores its own base+halves ×its mult;
   loose halves add face value ×1; sum all; ×Focus).
3. **Hand base values = placeholders for now** ✓ (balance after it's playable).
