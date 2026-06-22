# TheGame — Roguelike Poker

An HTML/JS roguelike poker game. The bulk of it lives in **`index.html`** — no build step, no framework, no dependencies. Open it in a browser and it runs.

- **Live site:** https://noflukeluke.github.io/TheGame/ (GitHub Pages, auto-deploys from `main`)
- **Owner:** non-technical developer — explain changes plainly, avoid jargon dumps.

## File layout

We're gradually pulling large **content lists** out of `index.html` into their own
files under `data/`, so editing content doesn't mean opening the whole 12k-line
file. These are loaded as plain `<script src="data/…">` tags **before** the main
script, so their `const`s are normal globals the game can read (no imports, no
build step). **Load order matters: data files must come before the main script.**

- `data/bonuses.js` — `BONUS_POOL`, the list of Bonus Cards (BCs). Edit bonus
  data (names, descriptions, tiers, tags) here. *Note:* a bonus's **effect**
  (scoring math) still lives in `index.html` (mainly `calcScore`/`playHand`),
  looked up by id via `hasBonus('…')`. Editing text/numbers is self-contained;
  a brand-new mechanic may also touch `index.html`.

Everything else (jokers, bosses, events, all logic) is still in `index.html`.
Likely next candidates to split the same way: `JOKER_POOL`, `BOSS_PRESETS`.

## Workflow

- **Develop on branch** `claude/setup-poker-game-lT61p`.
- **Deploy:** push to both the feature branch AND `main` (`git push origin claude/setup-poker-game-lT61p:main`). Pages serves from `main`.
- **Build stamp:** bump the `BUILD` constant (near top of `<script>`, e.g. `'2026-05-30 · r18'` → `r19`) on every commit. It shows in the menu footer + dev panel so the owner can confirm mobile cache is fresh. Increment the `rN` each commit.
- **Cache-busting for data files:** each `<script src="data/…?v=rN">` tag carries a
  `?v=` version. **When you change a `data/` file, bump its `?v=` to match the new
  `BUILD` rN** (e.g. `?v=r19`). The `BUILD` stamp only forces phones to re-fetch
  `index.html`; the `?v=` is what forces them to re-fetch the data file. A changed
  data file with a stale `?v=` = the phone keeps using the OLD cached version and
  your edit appears to "do nothing". Simplest habit: bump `BUILD` *and* every
  `?v=` together each commit.
- **Commit messages:** detailed, since a fresh Claude session re-orients from git history. End with the session URL line.
- After editing, validate syntax (covers both the inline script and the data files):
  ```
  node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.match(/<script>([\s\S]*)<\/script>/)[1]);console.log('OK')"
  node --check data/bonuses.js
  ```

## Core architecture

The game is a grid of playing cards. You select orthogonally-connected cards to form poker hands, scoring against a per-round goal under a timer.

### Key globals
- `gridData[r][c]` — the grid; each cell is a card object, a special card, or `null`.
- `gridRows` / `gridCols` — grid dimensions (driven by `limits.grid_rows/grid_cols`).
- `drawPile` / `playedPile` — deck. Scored cards → `playedPile`, reshuffled into `drawPile` at round end via `flushPlayedDeck()`.
- `selected` — array of `[r,c]` currently selected.
- `score`, `coins`, `swaps`, `discards`, `roundSeconds`, `level`, `roundGoal`/`cumulativeGoal`.
- `limits` / `LIMITS_DEF` — upgradeable caps (grid size, round time, swaps, discards, reward grid size).
- `ACTIVE_MODE` — `.id === 'normal'` is the main 3-Act node mode; other modes are timer-based (legacy).

### Card types (flags on the card object)
- **Normal card:** `{ rank, suit, _id }`.
- **BC (Bonus Card):** `_isBC:true`, `bonus:{id,name,desc,tier}`. A scoring buff that **only works while physically on the grid**. The bonus **data list (`BONUS_POOL`) lives in `data/bonuses.js`**; the bonus **effects** live in `index.html` (`calcScore`/`playHand`), looked up by id. `hasBonus(id)` scans `gridData`, not an owned-list. Place new BCs with `injectBCAfterReward(bonus)`. `acquiredBonuses[]` tracks ever-owned (for dedup via `ownsBonus`).
- **Joker:** `_isJoker:true`, `jokerId`, `_usesLeft`. A deck card with conditional activations (see below).
- **Stone:** `_isStone:true` — inert obstacle.
- **Totem:** NOT a card. Persistent rule-changer in `acquiredTotems[]`, shown in HUD. `hasTotem(id)`.
- **Challenge card:** `challengeCard` / `challengeActive`, occupies a cell; `resolveChallenge(success)`.
- `cardCan(card, action)` gates what each type can do (`select`/`swap`/`discard`/`fall`/`render`).

### Scoring (`calcScore(handName, cells)` + `playHand()`)
- `calcScore` returns the numeric score: base pips (level-scaled) + per-card pips + bonuses, × mult, × score-multipliers.
- **Default suit effects:** ♣ +5 pips & ♥ +0.5 mult (in `calcScore`); ♦ +1 coin & ♠ +1s (in `playHand`). *(Owner is reconsidering whether suits should be neutral by default — see exalt/corrupt below.)*
- `findBestHand(cells)` brute-forces all connected 2–5 card subsets, scores each, returns the best. Handles wild jokers (temp rank/suit) and drops non-wild jokers from detection.
- `detectHand(cells)` returns the hand-type string. `activeHands` Set gates which hands are scorable (in Normal mode ALL hands are active from the start).

### Exalt / Corrupt (`exaltCorruptTotals`, `exaltCard`, `corruptCard`)
Per-card flags `_exalted` / `_corrupted` grant enhanced suit effects on top of defaults:
- Exalted: ♣+8 pips, ♥+3s, ♦+2 coins, ♠+2 mult.
- Corrupted: ♣+12 pips/−1 coin, ♥+5s/−3 mult, ♦+4 coins/−2s, ♠+4 mult/−2s.
- Visual: `.exalted` (gold glow) / `.corrupted` (purple glow). **Balance is TBD** — numbers are placeholders.

## Joker system (`JOKER_POOL`)

Jokers are physical deck cards. They fall, swap, get discarded, and get played like normal cards. **Long-press** a joker on the grid for its tooltip (single-tap is reserved for selecting it into a hand). Charges (`durability`) are **per game**, not per round.

`def.activation` determines how the effect fires:
| activation | fires when | wired in |
|---|---|---|
| `wildcard` | participates in hand detection (`wild:'rank'/'suit'/'both'`) | `findBestHand` (`bestWildRank`/`bestWildSuit`) |
| `on_play` | joker is part of a played hand | `fireJokersOnPlay` in `playHand` |
| `on_discard` | joker is discarded | `doDiscard` (has grid position) |
| `on_swap` | joker is moved by a swap (either direction) | `fireJokersOnSwap` in `doSwap` |
| `on_draw` | joker lands on the grid | `fireJokersOnDraw` (round start) |
| `round_start` / `round_end` | round boundaries | round-start sweep / interest calc |
| `passive` | always while on grid | checked inline (e.g. `fight_power` via `bossEffectsIgnored()`) |
| `double_tap` | double-tapped | `onCardTap` intercept (framework; none in pool yet) |

Effects live in `applyJokerGridEffect(id, r, c)`. `consumeJokerCharge` decrements/removes. `grantJoker(def)` adds one to the draw pile.

## Events (node-based, Normal mode)

Reward grid destination tiles set `pendingEventOverride` → `closeRewardGrid()` routes to shop or `openEvent()`. Events render in `#event-overlay`. Implemented: **Confluence** (theme draft), **Crossroads** (sacrifice trades), **Gamble** (doors / double-or-nothing), **Wandering Merchant** (free rare items), **Altar** (multi-round investments via `altarEffects[]`), **Cleansing Spring** (purge/restore), **Twin Path** (2 BCs + shadow debuff). All triggerable from the dev panel.

## Shop

`triggerShop()` / `renderShop()`. Currently: cards for sale + card services (remove/duplicate/change-suit/combine/buy swaps/discards). **Owner wants a redesign** to 3 BCs / 3 cards / 3 jokers / 3 totems — not yet done.

## Progression (Normal mode)
3 Acts × (5 events + 1 boss) = 18 nodes. `actNumber` (1–3), `nodeInAct` (0–4, boss at 5). `forceBossNextRound` triggers the boss after the next deal. Win at `actNumber > 3` → `onGameWin()`.

## Boss system
`BOSS_PRESETS`, `triggerBoss()`, `endBoss()`. Modifiers: blocked cells (`isCellBlocked`), BC disabling (`isBCDisabledByBoss`), low-card famine (`maybeFamineDrawSwap`). The `fight_power` joker bypasses all of these via `bossEffectsIgnored()`.

## Dev panel
🛠 button (bottom-right). Add BCs / totems / jokers by name, trigger any event/boss, adjust time/coins/score/limits, open reward grid. Invaluable for testing.

## Conventions
- Match surrounding code style (terse, inline, lots of single-line helpers).
- Animation gating: `animating` / `falling` / `pendingAction` flags block input mid-animation.
- When a mechanic is complex/ambiguous, implement a simplified version and tag it `TBD` in a comment + the item's `desc`/`needsResolve`.
