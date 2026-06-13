# TheGame — Roguelike Poker

A single-file HTML/JS roguelike poker game. Everything lives in **`index.html`** — there is no build step, no framework, no dependencies. Open it in a browser and it runs.

- **Live site:** https://noflukeluke.github.io/TheGame/ (GitHub Pages, auto-deploys from `main`)
- **Owner:** non-technical developer — explain changes plainly, avoid jargon dumps.

## Workflow

- **Branch:** `main` is the source of truth and auto-deploys to GitHub Pages — never commit directly to it. Develop on the `claude/*` feature branch this session was assigned. If none was given, branch off the latest main: `git checkout -b claude/<topic> origin/main`.
- **Deploy:** push your feature branch, then fast-forward `main` to it: `git push origin HEAD && git push origin HEAD:main`. Pages serves from `main`.
- **Build stamp:** bump the `BUILD` constant (near top of `<script>`, currently `'2026-06-10 · r47'`) on every commit. It shows in the menu footer + dev panel so the owner can confirm mobile cache is fresh. Increment the `rN` each commit.
- **Commit messages:** detailed, since a fresh Claude session re-orients from git history. End with the session URL line.
- After editing, validate syntax:
  ```
  node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.match(/<script>([\s\S]*)<\/script>/)[1]);console.log('OK')"
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

### Layout / scaling — "one fixed canvas, scaled" (owner's explicit choice)
The stage (`#stage`, 420×740 portrait / 747×420 landscape) is a single fixed-size canvas scaled uniformly via CSS `zoom: var(--stage-zoom)`, like a scaled image — **not** a responsive/fluid reflow layout. Card sizing is computed by `recomputeGridMetrics()` from the REAL measured DOM slot (`measureGridSlot()` → `#grid-slot.getBoundingClientRect()` ÷ zoom), not guessed footprint constants — this is what fixed a nasty grid/button overlap regression. If you ever need to change layout, preserve this architecture; don't switch to fluid reflow.

### Card types (flags on the card object)
- **Normal card:** `{ rank, suit, _id }`.
- **BC (Bonus Card):** `_isBC:true`, `bonus:{id,name,desc,tier}`. A scoring buff that **only works while physically on the grid**. `hasBonus(id)` scans `gridData`, not an owned-list. Place new BCs with `injectBCAfterReward(bonus)`. `acquiredBonuses[]` tracks ever-owned (for dedup via `ownsBonus`).
- **Joker:** `_isJoker:true`, `jokerId`, `_usesLeft`. A deck card with conditional activations (see below).
- **Stone:** `_isStone:true` — inert obstacle.
- **Totem:** NOT a card. Persistent rule-changer in `acquiredTotems[]`, shown in HUD. `hasTotem(id)`.
- **Challenge card:** `challengeCard` / `challengeActive`, occupies a cell; `resolveChallenge(success)`.
- `cardCan(card, action)` gates what each type can do (`select`/`swap`/`discard`/`fall`/`render`).

### Scoring (`calcScore(handName, cells)` + `playHand()`)
- `calcScore` returns the numeric score: base pips (level-scaled) + per-card pips + bonuses, × mult, × score-multipliers.
- **Suits are NEUTRAL by default** (owner's decision, now shipped). A plain card scores only its pips × mult — no per-suit coin/time/pip/mult bonus. Suit effects come *only* from exalt/corrupt (below) or BCs (♥/♣ BCs in `calcScore`; Spade Flood etc.). The old defaults (♣ pips, ♥ mult, ♦ coin, ♠ time) are gone — see the "suits are neutral" comment in `playHand`.
- `findBestHand(cells)` brute-forces all connected 2–5 card subsets, scores each, returns the best. Handles wild jokers (temp rank/suit) and drops non-wild jokers from detection.
- `detectHand(cells)` returns the hand-type string. `activeHands` Set gates which hands are scorable (in Normal mode ALL hands are active from the start).

### Exalt / Corrupt (`exaltCorruptTotals`, `exaltCard`, `corruptCard`) — r45 spec
Per-card flags `_exalted` / `_corrupted` are the *only* source of suit effects now (suits are otherwise neutral). State is **permanent + mutually exclusive** (whichever locks first wins; `exaltCard`/`corruptCard` clear the other). Buff totals computed in `exaltCorruptTotals` (pips/mult fold into `calcScore`; coins/time applied in `playHand`):
- **Exalted:** ♣ +10 pips · ♦ +3 coins · ♥ +2 mult · ♠ +4 time.
- **Corrupted (buff / cost):** ♣ +25 pips / −3 mult · ♦ +5 coins / −20 pips · ♥ +5 mult / −5 time · ♠ +7 time / −8 coins.
- Buffs/costs apply **per scored card** (3 corrupt clubs = +75 pips / −9 mult). Costs floor the resource at 0 (no debt): hand pips floored before `s = totalPips*mult`, mult floored at 1, coins/time `Math.max`'d. Visual: `.exalted` gold glow / `.corrupted` purple glow.

**Triggers** — each suit watches a different action. Counters live **on the card object** (e.g. `_clubPackPlays`) so they track the individual card and survive deck cycling; they reset only on `newGame`.
| suit | exalts when | corrupts when |
|---|---|---|
| ♣ | in a hand with **3+ clubs**, 2× (`_clubPackPlays`) | **lone club** in a hand, 2× (`_clubSoloPlays`) |
| ♥ | **only heart** in a hand, 2× (`_heartSoloPlays`) | swapped, then **misses the next scored hand**, 1× (`_heartSwapPending`) |
| ♠ | played in **first 30s** of round, 2× (`_spadeEarlyPlays`) | **discarded** 2× (`_spadeDiscards`) |
| ♦ | played while coins **< 5**, 2× (`_diaPoorPlays`) | played while coins **> 65**, 2× (`_diaRichPlays`) |

Wiring: clubs/hearts-exalt/spades-exalt/diamonds all fire in the `playHand` per-card loop. **♥ corruption** is a two-step flow — `doSwap` sets `_heartSwapPending`; the next scored hand resolves it (in hand → flag cleared/safe; absent → corrupt). A pending ♥ that's discarded corrupts immediately (`doDiscard`). **♠ corruption** also fires in `doDiscard`. Spade exalt needs `roundStartSeconds` (captured in `startRoundTimer`); window = `(roundStartSeconds - roundSeconds) < 30`.

## Joker system (`JOKER_POOL`)

Jokers are physical deck cards. They fall, swap, get discarded, and get played like normal cards. **Long-press** a joker on the grid for its tooltip (single-tap is reserved for selecting it into a hand). Charges (`durability`) are **per game**, not per round.

`def.activation` determines how the effect fires:
| activation | fires when | wired in |
|---|---|---|
| `wildcard` | participates in hand detection (`wild:'rank'/'suit'/'both'`) | `findBestHand` (`bestWildRank`/`bestWildSuit`) |
| `on_play` | joker is part of a played hand | `fireJokersOnPlay` in `playHand` |
| `on_discard` | joker is discarded | `doDiscard` (has grid position) |
| `on_swap` | joker is moved by a swap (either direction); **once per round, see below** | `fireJokersOnSwap` in `doSwap` |
| `on_draw` | joker lands on the grid | `fireJokersOnDraw` (round start) |
| `round_start` / `round_end` | round boundaries | round-start sweep / interest calc |
| `passive` | always while on grid | checked inline (e.g. `fight_power` via `bossEffectsIgnored()`) |
| `double_tap` | double-tapped; **once per round, see below** | `onCardTap` intercept |

Effects live in `applyJokerGridEffect(id, r, c)`. `consumeJokerCharge` decrements/removes (used by most activation types). `grantJoker(def)` adds one to the draw pile.

**`double_tap` / `on_swap` — once-per-round lock (not discard-on-use):** These jokers stay physically on the grid after firing. `jokerCanActivateThisRound(card)` gates activation (checks `_usedThisRound` + remaining `_usesLeft`); `lockJokerForRound(card)` sets `_usedThisRound = true` and decrements `_usesLeft` after a successful trigger. The lock is cleared for every joker on the grid in the round-start sweep (search `_usedThisRound = false`, right before `fireJokersAtRoundStart()`). Once `_usesLeft` hits 0 the joker just sits inert — it is **not** auto-removed; it can still leave the grid normally by being played in a hand or discarded by the player. Grid tooltips show "ONCE PER ROUND" / "USED THIS ROUND" for these.

## Events (node-based, Normal mode)

Reward grid destination tiles set `pendingEventOverride` → `closeRewardGrid()` routes to shop or `openEvent()`. Events render in `#event-overlay`. Implemented: **Confluence** (theme draft), **Crossroads** (sacrifice trades), **Gamble** (doors / double-or-nothing), **Wandering Merchant** (free rare items), **Altar** (multi-round investments via `altarEffects[]`), **Cleansing Spring** (purge/restore), **Twin Path** (2 BCs + shadow debuff). All triggerable from the dev panel.

## Shop

`triggerShop()` → `generateShopItems()` → `renderShop()`. **Redesigned** (the old "cards for sale + services" layout is gone). `shopItems` now holds curated rows, each rendered by its own function:
- **3 BCs** (`renderShopBCs`, priced by tier via `SHOP_BC_PRICES`).
- **3 jokers** (`renderShopJokers`, `pickJokerByRarity`, `SHOP_JOKER_PRICES`).
- **2 totems** (`renderShopTotems`, flat `SHOP_TOTEM_PRICE`).
- **2 limit upgrades** (`renderShopLimits`, scaling cost via `limitPrice`).
- **Footer** (`renderShopFooter`): card services (remove/duplicate/change-suit/combine, capped by `SHOP_SVC_MAX`) + buy swaps/discards + **reroll** (`rerollShopItems`, which only refreshes *unpurchased* slots).

Owned BCs/totems and already-granted jokers are filtered out of the pools so the shop never offers a duplicate.

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
