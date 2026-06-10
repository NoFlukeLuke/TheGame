# Balance Sheet — how to use it

`balance_sheet.csv` is a catalog of **every** bonus entity in the game — all
Bonus Cards, Jokers, and Totems — in one place, ready to open in Excel or
Google Sheets and sort/filter for a balance sweep.

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

The tunable numbers live in one place in the code: a `BAL` config object in
`index.html`. The sheet round-trips with it:

```
node tools/gen_balance_sheet.js     # code  → sheet   (refresh the CSV)
# ...edit the params_json column in Excel / Google Sheets, save as CSV...
node tools/apply_balance_sheet.js   # sheet → code    (writes values into BAL)
```

After `apply`, validate and commit `index.html` as usual:

```
node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.match(/<script>([\s\S]*)<\/script>/)[1]);console.log('OK')"
```

`gen` re-reads the three pools (`BONUS_POOL`, `TOTEM_POOL`, `JOKER_POOL`) plus
`BAL`, so it never drifts. `apply` only rewrites values inside the `BAL` block,
preserving its order and comments, and prints every `old → new` change.

## The columns

| Column | What it means |
|---|---|
| `entity_type` | Bonus Card / Joker / Totem |
| `id` | internal code id (don't change) |
| `name` | display name |
| `rarity` | common / rare / legendary (blank for totems) |
| `params_json` | **the tunable numbers** — e.g. `{"mult":1}` or `{"pips":5,"mult":1}`. Edit the number(s) inside; `apply` writes them into the game. Blank = a structural entity with no single tunable number (see `notes`). |
| `base_cost` | **suggested** starting cost by rarity (3/6/9). Edit freely — this is a sweep input, not read by the game yet. |
| `buff_type` | the main effect: pips, mult, score-multiplier, retrigger, focus, time, coins, resource, wildcard, exalt/corrupt, boss, challenge, utility |
| `trigger` | what makes it fire: spatial, hand-type, hand-size, card-specific, suit-specific, streak, time-based, on-swap, on-discard, on_play, passive, etc. |
| `activation` | (jokers only) how the code fires it |
| `charges` | jokers: uses per game; totems: "persistent" |
| `cat_*` columns | category flags (1 = applies). Slice the sheet by these: hand_type, hand_size, spatial, card_specific, suit_specific, time, money, discard_swap, play, focus, scaling, retrigger |
| `tags` | the tags already in the code |
| `description` | the in-game text **— this is where the actual numbers live today** |
| `notes` | flags like "needsResolve / TBD" |

## What's tunable vs structural

Most entities expose their numbers in `params_json`. Some are **structural** —
their behavior has no single number to tune (wild jokers, shape-detection
geometry like Four Corners, rank-shifting like Royal Favour, and the retrigger
plumbing). Those have a blank `params_json` and a `notes` of
"structural — no tunable value". Changing those means changing logic, not a
number — ask and I'll do it.

`description` text **auto-syncs** to the numbers for most entities. Each has a
template in `DESC_TEMPLATES` (in `index.html`) with `{param}` tokens filled from
`BAL` at load — so changing Deep Roots from +1 to +3 mult updates its in-game
tooltip automatically. A handful whose wording uses word-numbers ("triple",
"doubles", "6× total") keep hand-written text; those are the same ids skipped in
`DESC_TEMPLATES`, and you'd edit their wording by hand if you retune them.

## System rows

A few rows have `entity_type = System`: the default per-suit effects
(`_suit_defaults`), the exalt/corrupt suit tables (`_exalt` / `_corrupt`), and
base time costs (`_resources`). These are prime balance-sweep targets and
round-trip exactly like the entities.
