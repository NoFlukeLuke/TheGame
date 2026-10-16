# POST LAUNCH - parked until the itch build is out

**The goal is a version playable enough to put on itch.io, and it is close.** Anything in
this file is deliberately NOT being built before that. It is not a wish list: each item is
either a real feature with a spec, or a known fault with a decided fix. Nothing here blocks
a playable build.

- `TODO.md` is **work queued for now.** This file is work queued for **after launch**.
- An item moves from here to TODO.md only when the owner says it is in scope again.
- When an item is built, delete it from here and say so in the commit.

---

## 1. EVENTS - the rest of the roster rework

`EVENTS.md`'s "THE OWNER'S VERDICT" section is the full decision list. **None of it is
built.** What is in scope before launch is a judgement call per item; what is parked here is
everything that needs a new system underneath it:

- **The two structural events** (scaling buffs, replays, second suit / rank, card states).
  They need the card-buff weight table landed first.
- **Junk cards** and **arrival costs** (TODO 0c): nothing in the game costs you a deck slot,
  and there is no "a card landed" hook at all. Three reworked events wait on this.
- **The slot machines** (TODO 0d): Card Slots and Entity Slots both need a design pass.
- **Two and a Catch** (TODO 0e), parked until the pairing can be tailored.
