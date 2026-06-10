# Balance Sheet — how to use it

`balance_sheet.csv` is a catalog of **every** bonus entity in the game — all
Bonus Cards, Jokers, and Totems — in one place, ready to open in Excel or
Google Sheets and sort/filter for a balance sweep.

## How it's made

It's generated from the live game code so it never drifts out of date. After
you add or change entities in `index.html`, regenerate it with:

```
node tools/gen_balance_sheet.js
```

That re-reads the three pools (`BONUS_POOL`, `TOTEM_POOL`, `JOKER_POOL`) and
rewrites the CSV.

## The columns

| Column | What it means |
|---|---|
| `entity_type` | Bonus Card / Joker / Totem |
| `id` | internal code id (don't change) |
| `name` | display name |
| `rarity` | common / rare / legendary (blank for totems) |
| `base_cost` | **suggested** starting cost by rarity (3/6/9). Edit freely — this is a sweep input, not read by the game yet. |
| `buff_type` | the main effect: pips, mult, score-multiplier, retrigger, focus, time, coins, resource, wildcard, exalt/corrupt, boss, challenge, utility |
| `trigger` | what makes it fire: spatial, hand-type, hand-size, card-specific, suit-specific, streak, time-based, on-swap, on-discard, on_play, passive, etc. |
| `activation` | (jokers only) how the code fires it |
| `charges` | jokers: uses per game; totems: "persistent" |
| `cat_*` columns | category flags (1 = applies). Slice the sheet by these: hand_type, hand_size, spatial, card_specific, suit_specific, time, money, discard_swap, play, focus, scaling, retrigger |
| `tags` | the tags already in the code |
| `description` | the in-game text **— this is where the actual numbers live today** |
| `notes` | flags like "needsResolve / TBD" |

## Important: editing the sheet does NOT change the game (yet)

The real numeric values are baked into the description text and the scoring
functions (`calcScore`, `applyJokerGridEffect`) in `index.html`, not stored as
editable data. So this sheet is for **planning** the sweep — decide the new
numbers here, and then we apply them back into the code.

If you want a true round-trip (edit a number in the sheet → game updates), the
next step is to refactor each entity so its numbers live in the data
definitions, then have the game read those. Ask and I'll scope that out.
