# POST LAUNCH - parked until the itch build is out

**The goal is a version playable enough to put on itch.io, and it is close.** Anything in
this file is deliberately NOT being built before that. It is not a wish list: each item is
either a real feature with a spec, or a known fault with a decided fix. Nothing here blocks
a playable build.

- `TODO.md` is **work queued for now.** This file is work queued for **after launch**.
- An item moves from here to TODO.md only when the owner says it is in scope again.
- When an item is built, delete it from here and say so in the commit.

---

## 1. THE RESERVE - cards you hold and place by hand

A third place a card can be: not the deck, not the board, a **RESERVE**. Reached by
**double-tapping the hand preview area**, which swaps that panel to show what you are
holding; from there a card is **placed on the grid by hand**, the way a Sleight is.

- **A reserve card does not cycle.** It is not part of the deck and never enters the draw
  or played pile. It **sits in the reserve until it is used**, and placing it on the board
  is what uses it.
- **Card Market stocks it.** Buy as many as you can afford at **5 credits** each (the price
  will want to vary by mode). **50% of them carry one random buff, 5% carry two.**
- **The gesture already exists.** `js/dealers-choice.js` (r423) holds temp cards off-board
  and places them into a cell by tap, with the swap hooks and the swap time cost. **Read
  that file before designing this one.** Two differences: a reserve card persists across
  rounds and level-ups, and it is a real deck card rather than a temp card.
- Open: is the reserve capped? Does placing one bill the clock? It must be in `SAVE_VARS`.

## 2. TURNOVER NEEDS A REWORK - it breaks, and it does not help

`turnover` (rare knack, `BAL.turnover.idle_seconds` 45): a card left alone for 45 seconds
is **discarded automatically** and a fresh one falls in, free of stock and of the clock.
Owner: it breaks, and it is far less useful than it reads.

The fault is that it acts FOR you. It churns the longest-idle card on a tick you do not
control, so it can take the card you were building a hand around, and it fires inside
`cardStateTick` beside the card-state fuses, which is a busy place for an unprompted
`removeAndFall`.

**The fix, decided:** stop discarding anything. A card untouched for more than **30
seconds** simply becomes **free to discard** - no stock, no clock - and the player chooses
whether to spend it. The knack becomes an allowance rather than an actor.

- It needs a **mark on the card**: a glowing icon matching the DISCARD button's own colour,
  so "this one is free" is readable from the board without a tooltip.
- `cardIdleSecs` (js/card-states.js) is already the per-card idle clock, already ticked from
  the round tick, already reset per round and already pauses correctly. The rework reads it
  instead of acting on it.
- The free discard belongs in `doDiscard`'s cost calculation, next to Free Discards
  (`free_discards`) and Hoarder, not in a sweep.
- `BAL.turnover.idle_seconds` 45 -> 30, and its `DESC_TEMPLATES` row has to be rewritten
  with it or the printed sentence keeps promising the old behaviour.

## 3. EVENTS - the rest of the roster rework

`EVENTS.md`'s "THE OWNER'S VERDICT" section is the full decision list. **None of it is
built.** What is in scope before launch is a judgement call per item; what is parked here is
everything that needs a new system underneath it:

- **The two structural events** (scaling buffs, replays, second suit / rank, card states).
  They need the card-buff weight table landed first.
- **The matching game** - face-down cards carrying buffs and penalties, where picking a
  penalty first locks you out of re-flipping what you have already seen. A new screen.
- **Junk cards** and **arrival costs** (TODO 0c): nothing in the game costs you a deck slot,
  and there is no "a card landed" hook at all. Three reworked events wait on this.
- **The slot machines** (TODO 0d): Card Slots and Entity Slots both need a design pass.
- **Two and a Catch** (TODO 0e), parked until the pairing can be tailored.
