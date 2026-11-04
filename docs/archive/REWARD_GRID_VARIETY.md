# Reward Grid Variety & Trick Slots — r74 review

> Everything below is **implemented on branch `claude/synergy-combo-mechanics`**
> (build r74, based on r73/main). This doc is for you to review the new content
> in one place. Nothing here is on `main` yet — say the word and I'll deploy.

Try it all from the 🛠 dev panel: open the reward grid repeatedly to see the new
tiles, add Tricks past 5 to see the slot cap, and grant/curse cards.

---

## 1. Trick Slots — the new limit

- New `LIMITS_DEF` entry **`trick_slots`**: **base 5**, max 10, offer-weight **0.4**.
- The Trick tray now shows a **`N/5` counter** (turns red when full).
- When you gain a Trick and the tray is full, a **replace-or-skip** popup appears:
  pick a Trick to swap out, or "Skip New Trick." (No more silent unlimited tray.)
- **Weighted limit offers (new):** the shop, Limit Break event, and the new
  reward "limit" tiles now respect each limit's `weight`. Only `trick_slots` is
  rare (0.4); everything else is 1.0. So Trick Slots shows up ~⅓ as often as a
  normal limit — a real chase. Retune the `0.4` anytime.

## 2. Reward grid now mirrors the play grid

- Reward grid **shape = play grid** (`grid_rows`/`grid_cols`), so it **starts 4×4**
  and grows when you upgrade the grid. The old separate `reward_rows`/`reward_cols`
  limits are **gone**.
- **Picks are capped by Selection Size** (same limit as the play grid) — upgrading
  it lets you claim more reward tiles too. Header shows `Picks: n/cap`.
- **Guarantee:** every grid always offers **≥5 Trick tiles** (converts other buffs
  up if the random roll came short). Verified across 400 generated grids.

## 3. UI refresh (see the preview I sent)

- Cells now read like **playing cards**: same rounded-rect silhouette, 2px border,
  card aspect ratio.
- **Cool indigo backdrop + purple selection glow** — instantly distinct from the
  warm gameplay grid, so it's obvious you're on the map, not playing a hand.
- Tiles that name a specific card (curse / blessing / cull) show a **mini playing
  card** (correct red/black suit) instead of a generic emoji.
- Cleaner tier badges, tighter typography, per-kind border colors
  (gold buff / red debuff / purple destination).

## 4. New BUFF tiles (the good half)

| Tile | Tier | Effect |
|---|---|---|
| 💰 **Windfall** | common | +8 coins now |
| ⬆️ **+1 [Limit]** | epic | +1 to a random non-time limit (weighted; e.g. +1 Grid Row, +1 Trick Slot) |
| ✨ **Blessed Card** | rare/epic | a specific card permanently gains **+12 pips** (or **+1 mult**, 30% of the time) |
| ✂️ **Cull** | rare | permanently **remove** a specific 2/3/4 from your deck (deck thinning) |
| 🕊️ **Cleanse** | rare | lift one random **curse** (only appears if you're cursed) |
| ❓ **Mystery** | mystery | unknown until claimed — **70% good** (coins / swaps / discards / time / +pips), 30% bad |

## 5. New DEBUFF tiles (the bad half)

| Tile | Effect |
|---|---|
| 💸 **Pickpocket** | −10 coins |
| 🪨 **Stones** | 2 Stones shuffled into your deck (block cells until purged) |
| ⏳ **Slow Start** | −20s at the start of next round |
| ⬇️ **−1 [Limit]** | −1 to a random limit (permanent — limits are precious!). `round_time` excluded |
| ❓ **Dark Mystery** | unknown — **70% bad** (lose coins / swap / time / a Stone / a curse), 30% good |
| **[Curse] Curse** | curses one specific card — see below |

Plus the 8 existing debuffs (round-cap, discard/swap loss, hand/discard time
costs, lose-a-Trick) are retained. "Big" tiles (curses, limit drains, mystery)
are limited to **one per grid** so a board never doubles up confusingly.

## 6. Card Curses (new status system)

A curse afflicts one **specific card identity** (e.g. every 9♠). It shows a badge
on the card with a **countdown**, and — the key idea — **playing through it is the
cure**: score the cursed card enough times and the curse lifts. Or use a Cleanse
tile. Curses reset each new game.

| Curse | Icon | Effect | Lifts after scoring it |
|---|---|---|---|
| **Leaden** | ⚓ | scores **0 pips** | 3× |
| **Taxing** | 🩸 | **−3s** each time it scores | 4× |
| **Snared** | 🕸️ | **can't be swapped or discarded** | 2× |

Cursed cards get a sickly-green glow on the play grid. Design intent: a curse is a
*puzzle to work off*, not just a flat tax — and it interacts with the deck
(cursing a card you rely on hurts; cursing junk barely matters).

---

## Validation done
- JS syntax check passes.
- Headless harness: **400 grids generated, 0 malformed** — always exactly 1
  destination, always ≥5 Trick tiles, every tile has a working effect.
- **960 tile `apply()` calls fired, 0 errors** across every new tile type
  (coins, limits, blessed, cull, cleanse, mystery, stones, curses).

## Tuning knobs (all one-liners, easy to change on your say-so)
- `trick_slots` base (5) / max (10) / weight (0.4).
- `MIN_TRICK_TILES` (5) in `generateRewardContent`.
- `buffCategories` / `debuffs` weights (relative appearance rates).
- Mystery good-odds (0.7 buff / 0.3 debuff) in `resolveRewardMystery`.
- Curse `liftAfter` counts and effects in `CURSE_DEFS`.

## Open questions for you
1. Curse counts/effects feel right, or want them harsher/gentler?
2. Should **Cull** be able to remove any rank (not just 2/3/4)? Right now it only
   thins low cards to stay a pure upside.
3. Mystery good/bad odds — happy with 70/30, or more of a gamble?
