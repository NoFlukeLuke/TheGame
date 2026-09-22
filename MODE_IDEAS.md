# Mode ideas, parked

Designs the owner has described but that are not built. Mode 2 of this list
shipped as **Crunch** (r293, see CLAUDE.md); this file is what is left.

---

## The Tetris solitaire (not built)

**The pitch, in the owner's words:** a solitaire-like game where you are given
cards in specific shapes, with specific connections, like Tetris, and the goal is
to fill a grid of varying sizes to score the most points. **You score by taking
LINES of the grid and treating each one as its own poker hand.**

### The loop

- You are offered **3 shapes at a time** and place one on the board. A shape is a
  small polyomino of real playing cards with its cards fixed in place relative to
  each other.
- Possibly a **30 second timer** per placement decision. The owner is unsure this
  should be timed at all, and it can go either way.
- When you decide to have the board scored, **every line is scored as a poker
  hand**, all Tricks apply, and the total is checked against the level's goal.
- Different **board shapes** per level.
- New entities that change **how a shape or a line scores**.
- **Swaps and discards drop to about 1 each.** With placement as the main verb
  they are a different resource from what they are today.

### Why it is interesting

- It is the same scoring engine (`calcScore`, Tricks, Focus) driving a completely
  different decision. Nothing about what a hand is worth has to change.
- **It is the easiest mode in the game to make multiplayer**: placement is
  turn-based and the board state is small and serialisable.
- The reference the owner named for tone and structure is the Tetris-like city
  management game (shape placement scored by adjacency rules).

### What would have to be worked out first

- **Sleights need a large rework.** They are physical deck cards that fall, swap
  and get played inside a hand; a placement game has no fall and no draw pile in
  the same sense.
- **A line is a scoring unit but `HAND_MAX_CARDS` is 7**, and a board line can be
  longer. Either lines cap, or the hand-components machinery (r199) has to take a
  longer selection.
- **Scoring every line at once is N hands in one submission.** The scoring dance
  (r220) is built around one hand with a timeline; N lines needs either a
  per-line dance or a different presentation entirely.
- Connectivity does not apply. `findBestHand` only ever builds orthogonally
  connected subsets, so a line-based scorer bypasses it and calls `detectHand`
  directly, the way `ringerAugment` and Roll Call already do.
- Goal tuning is unknown: a full board of scored lines is far more pips per
  submission than one hand, so `BASE_GOAL` and the curve would need their own
  entry in `goalForLevel` (js/goal-tuning.js), like the Schedule has.

### Open questions for the owner

1. Is the 30 second placement timer in or out?
2. Do lines score only when full, or does a partial line score its cards?
3. Does a card score once per board, or once per line it is in (so a card at a
   crossing scores twice, like the r199 flush overlay)?
4. Does the board persist across levels, or clear each time?
