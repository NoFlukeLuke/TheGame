# Balance Sheet — how to use it

`balance_sheet.csv` is a catalog of **every** bonus entity in the game — all
Tricks, Sleights, and Knacks — in one place, ready to open in Excel or Google
Sheets and sort/filter for a balance sweep.

## Where do I actually edit the values?

You edit the **`params_json`** column. Two ways:

1. **Locally (Excel / Numbers / LibreOffice):** open `balance_sheet.csv`, change
   the number inside e.g. `{"mult":1}`, save as CSV, then run
   `node tools/apply_balance_sheet.js`.
2. **Google Sheets:** I can upload the CSV to your Google Drive as a Sheet (it
   converts automatically). You edit it there, then to push changes back you
   download it as CSV (File → Download → Comma-separated values), drop it in over
   `balance_sheet.csv`, and run `apply`. It's not a *live* link — Google Sheets
   can't write into the GitHub repo by itself — but it's a clean edit-there /
   sync-back loop. Ask me and I'll create the Sheet.

## The round-trip (edit numbers → game updates)

The tunable numbers live in one place in the code: the `BAL` config object in
`js/data/balance.js`. The sheet round-trips with it:

```
node tools/gen_balance_sheet.js     # code  → sheet   (refresh the CSV)
# ...edit the params_json column in Excel / Google Sheets, save as CSV...
node tools/apply_balance_sheet.js   # sheet → code    (writes values into BAL)
```

After `apply`, validate and commit `js/data/balance.js` as usual (the syntax
check loads every JS file in order, exactly as the browser does — see
CLAUDE.md "Workflow"):

```
node -e "const fs=require('fs');const idx=fs.readFileSync('index.html','utf8');const srcs=[...idx.matchAll(/<script src=\"([^\"]+)\"><\/script>/g)].map(m=>m[1]);const code=srcs.map(s=>fs.readFileSync(s,'utf8')).join('\n');new Function(code);console.log('OK',srcs.length,'files');"
```

`gen` re-reads the three pools (`TRICK_POOL` from `js/data/tricks.js`,
`KNACK_POOL` from `js/data/knacks.js`, `SLEIGHT_POOL` from
`js/data/sleights.js`) plus `BAL` and `DESC_TEMPLATES` (both in
`js/data/balance.js`), so it never drifts. `apply` only rewrites values inside
the `BAL` block, preserving its order and comments, and prints every
`old → new` change.

## The columns

| Column | What it means |
|---|---|
| `entity_type` | Trick / Sleight / Knack |
| `id` | internal code id (frozen — don't change; see TERMINOLOGY.md) |
| `name` | display name |
| `rarity` | common / rare / epic / legendary. Tricks store this under `tier`, Sleights and Knacks under `rarity` — the sheet reads whichever field the pool actually uses. Knacks only use common/rare today. |
| `params_json` | **the tunable numbers** — e.g. `{"mult":1}` or `{"pips":5,"mult":1}`. Edit the number(s) inside; `apply` writes them into the game. Blank = a structural entity with no single tunable number (see `notes`). |
| `base_cost` | **suggested** starting cost by rarity (3/6/9/12). Edit freely — this is a sweep input, not read by the game yet. |
| `buff_type` | the main effect: pips, mult, score-multiplier, retrigger, focus, time, coins, resource, wildcard, exalt/corrupt, boss, challenge, utility |
| `trigger` | what makes it fire: spatial, hand-type, hand-size, card-specific, suit-specific, streak, time-based, on-swap, on-discard, on_play, passive, etc. |
| `activation` | (sleights only) how the code fires it |
| `charges` | sleights: uses per game (`durability`); knacks: "persistent" |
| `cat_*` columns | category flags (1 = applies). Slice the sheet by these: hand_type, hand_size, spatial, card_specific, suit_specific, time, money, discard_swap, play, focus, scaling, retrigger |
| `tags` | the tags already in the code (Knacks currently carry none) |
| `description` | the in-game text, rendered through `DESC_TEMPLATES` where one exists — **this is where the actual numbers live for the player** |
| `notes` | flags like "needsResolve / TBD" or "structural — no tunable value" |

## What's wired (and what isn't)

Rows with a filled `params_json` round-trip both ways: edit the number, run
`apply`, and it lands in `BAL` in `js/data/balance.js`. Rows marked
**"structural — no tunable value"** have no id in `BAL` at all — genuinely
structural effects with no single number (wild sleights, shape-detection
geometry, some flag-based Focus entities, a few whose displayed number is
*derived* rather than stored). Changing those means changing logic, not a
number.

`description` text **auto-syncs** to the numbers for any entity with a
`DESC_TEMPLATES` entry (`js/data/balance.js`): each has a `{param}` template
filled from `BAL` at load (`applyBalDescriptions()`), so changing a value via
`apply` updates the in-game tooltip too, with no separate edit needed.

## System rows

A few rows have `entity_type = System`. Two kinds:

- **`_resources` / `_exalt` / `_corrupt`** — real tuning tables that round-trip
  exactly like the entities (base interact time costs, the unspent-action and
  interest payout caps, and the exalt/corrupt per-suit effect tables).
- **Everything else with this label** — a `BAL` entry whose `id` does not match
  anything in `TRICK_POOL`/`SLEIGHT_POOL`/`KNACK_POOL`. Most of these are
  per-event tuning blocks (Rehearsal, the Card Market, Deck Trim, the Schedule's
  booking prices, and similar) that live in `BAL` alongside the entity numbers
  but aren't an entity themselves — editing their `params_json` and running
  `apply` still works. A smaller number are genuinely **dead/unobtainable**
  leftovers: a `BAL`/`DESC_TEMPLATES` pair for an id no pool currently offers
  (e.g. `jack_mult`, `heart_double` — see CLAUDE.md's payout-fx section for the
  two the game calls out by name). The sheet can't tell those two cases apart
  automatically; check the id against `js/data/tricks.js` / `sleights.js` /
  `knacks.js` if it matters for your sweep.
