# TheGame — Roguelike Poker

Browser HTML/JS. **No build step, no framework, no deps.** Open `index.html`, it runs.
Live: https://noflukeluke.github.io/TheGame/ (Pages, auto-deploys from `main`).
Owner is non-technical — explain changes plainly.

**DESKTOP/LANDSCAPE FIRST.** All layout+polish targets `#stage.landscape`. Portrait still runs but is deprioritized — scope new layout CSS under `#stage.landscape` so portrait is untouched. Don't touch portrait unless asked.

Current branch carries the **LETHE reskin**: whole game wrapped in `#cabinet` (80s arcade-cabinet shell — marquee, CRT bezel, vents). Look lives in `css/style.css`, markup in `index.html`.

## Files

`index.html` is just skeleton markup + ordered `<link>`/`<script src>` tags. Read only the file you need; `grep -rn "fnName" js/` to locate.

- `css/style.css` (main + cabinet) · `css/dance.css` · `css/dev-overlays.css` · `css/match3.css`
- `js/data/` — **pure content, no logic.** Tune/add here without touching engine: `cards.js` (suits/ranks/`HAND_BASE`/`cardCan`) · `tricks.js` · `knacks.js` · `sleights.js` · `bosses.js` · `dominoes.js` · `balance.js` (`BAL` tuning table + `DESC_TEMPLATES`)
- `js/` engine, one file per system: `menu` `devlog` `grid-metrics` `focus-config` `limits` `combos-aim` `deck-grid` `hand-detect` `scoring` `render` `focus` `hud` `input` `play-hand` `score-anims`/`score-dance` `discard` `card-fall` `round-timers` `boss` `reward-grid` `limit-break` `sleights-runtime` `events-core`/`events` `interlude`/`level-up`/`tricks-ui` `shop` `hands-meta` `stats` `deck-view` `game-control` `challenge` `match3` `dominoes-mode` `audio` `dev-panel` `bootstrap`(last)

**CRITICAL — shared global scope + load order.** All `js/*.js` are classic scripts sharing one global scope (a `const`/`function` in one file is visible everywhere). Script order in `index.html` = original execution order and **matters** — several files run setup at load (`LIMITS_DEF.forEach`, `TRICK_CATEGORIES.forEach`, `applyBalDescriptions()`, event bindings; `bootstrap.js` last, calls `initMainMenu()`). New file → insert its tag in the right spot (data files up top, bootstrap stays last).

**Sidecar docs** for deep per-system detail: `DOMINOES_MODE.md`. Prefer adding one over growing this file.

## Workflow

- `main` = source of truth, auto-deploys. Never commit to it directly. Work on the assigned `claude/*` branch (else `git checkout -b claude/<topic> origin/main`).
- Deploy: `git push origin HEAD && git push origin HEAD:main`.
- **Bump `BUILD` at top of `js/menu.js` every commit** (increment `rN`). Shows in menu footer + dev panel so owner can confirm cache freshness.
- Commit messages detailed — a fresh session re-orients from git history.
- Validate syntax after editing (loads every JS in browser order):
  ```
  node -e "const fs=require('fs');const idx=fs.readFileSync('index.html','utf8');const srcs=[...idx.matchAll(/<script src=\"([^\"]+)\"><\/script>/g)].map(m=>m[1]);const code=srcs.map(s=>fs.readFileSync(s,'utf8')).join('\n');new Function(code);console.log('OK',srcs.length,'files');"
  ```

## Core architecture

Grid of playing cards; select orthogonally-connected cards → poker hands → score vs per-round goal under a timer.

**Globals:** `gridData[r][c]` (card | special | null) · `gridRows`/`gridCols` · `drawPile`/`playedPile` (scored → played, reshuffled at round end via `flushPlayedDeck()`) · `selected` (`[r,c]` array) · `score` `coins` `swaps` `discards` `roundSeconds` `level` `roundGoal` `totalScore` · `limits`/`LIMITS_DEF` (upgradeable caps) · `ACTIVE_MODE`.

**Modes** (`MODES`/`MODE_SELECT_LIST`/`MODE_META` in `js/menu.js`): `normal` (3-Act node mode) · `sixsuits` · `match3`/`zen` (`.match3`) · `dominoes` (`.dominoes`). `isActMode()` drives act/node + reward-grid + shop plumbing; the `enableBosses`/`enableShops`/`enableEvents` flags on mode defs are **inert** (nothing reads them). Non-act modes must be excluded from the legacy 20-min game-timer branches in `startTimers`, `resumeGame`, and the stray-tick guard in `onRoundEnd`.

**Layout — "one fixed canvas, scaled" (owner's explicit choice).** `#stage` is fixed-size (420×740 portrait / 747×420 landscape), scaled uniformly via CSS `zoom: var(--stage-zoom)` like an image — **not** fluid reflow. Card sizing comes from `recomputeGridMetrics()` measuring the REAL DOM slot (`measureGridSlot()` → `getBoundingClientRect()` ÷ zoom), never guessed constants (guessing caused a nasty grid/button overlap regression). Preserve this; don't switch to reflow.
JS adds `.landscape` when `availW > availH && availW >= 480`. Desktop left column top→bottom: SCORE/GOAL → PIPS·MULT·FOCUS chips → Knacks icon row → hand preview (`#selected-cards`) → Tricks tiles → time/coins → STATS/DECK/PAUSE. Preview renders via **`renderCardAppearance()`** (same builder as the grid) scaled by local `--card-w`/`--card-h`, so preview mirrors grid exactly.

## Card types (flags on the card object)

- **Normal:** `{rank, suit, _id}`
- **Trick** (ex-"Bonus Card"): scoring buff. Lives in a **side tray** (`trickTray[]` → `renderTrickTray()` → `#trick-tray-list`), NOT on the grid (`trickTrayMode` default true; grid placement is a dev toggle). `hasTrick(id)` / `ownsTrick` (dedup via `acquiredTricks[]`).
- **Sleight** (ex-"Joker"): `_isSleight`, `sleightId`, `_usesLeft`. A real deck card that **does** live on the grid.
- **Stone:** `_isStone` — inert obstacle.
- **Knack** (ex-"Totem"): not a card. Persistent rule-changer in `acquiredKnacks[]`, `hasKnack(id)`.
- **Challenge card:** `challengeCard`/`challengeActive`, `resolveChallenge(success)`.
- `cardCan(card, action)` gates `select`/`swap`/`discard`/`fall`/`render`.

## Scoring

`calcScore(handName, cells)` → base pips (level-scaled) + per-card pips + bonuses, × mult, × score-multipliers. `findBestHand(cells)` brute-forces connected 2–5 card subsets (handles wild sleights; drops non-wild ones). `detectHand(cells)` → hand-type string. `activeHands` Set gates scorable hands (Normal mode: all active from start).

Decided rules (don't "fix" these — they're deliberate):
- **Per-round-from-zero:** `score` resets to 0 each round, checked only vs that round's `roundGoal` (`BASE_GOAL * GOAL_SCALE^(level-1)`, rounded to 500). No lifetime total drives gameplay; `triggerLevelUp()` banks `score` into `totalScore` (display-only).
- **Playing a hand costs no time.** Reward-grid play-cost debuffs (`extraPlayCostPerm`) still parse but are inert.
- **Suits are NEUTRAL.** A plain card scores pips × mult only. Suit effects come *only* from Tricks or exalt/corrupt.

**Exalt/Corrupt** — per-card `_exalted`/`_corrupted`, permanent + mutually exclusive, granting per-suit pip/mult/coin/time buffs (corrupt = bigger buff + a cost). **Gated off by default** behind `exaltCorruptEnabled` (persisted, toggled in Settings); when off all triggers, `exaltCard`/`corruptCard`, `exaltCorruptTotals`, and glow classes no-op. Full trigger table: `grep -n "_clubPackPlays\|_heartSwapPending\|_spadeEarlyPlays\|_diaPoorPlays" js/`.

## Sleights (`SLEIGHT_POOL`)

Physical deck cards — fall, swap, get discarded/played. Long-press for tooltip (tap = select). Charges (`durability`) are per **game**. `def.activation` decides firing:

| activation | fires | wired in |
|---|---|---|
| `wildcard` | during hand detection (`wild:'rank'/'suit'/'both'`) | `findBestHand` |
| `on_play` | part of played hand | `fireSleightsOnPlay` |
| `on_discard` / `on_draw` | discarded / lands on grid | `doDiscard` / `fireSleightsOnDraw` |
| `on_swap` | moved by a swap (either direction) | `fireSleightsOnSwap` |
| `round_start`/`round_end` | round boundaries | round-start sweep / interest |
| `passive` | while on grid | inline (e.g. `fight_power` via `bossEffectsIgnored()`) |
| `double_tap` | double-tapped | `onCardTap` intercept |

Effects in `applySleightGridEffect(id,r,c)`; `consumeSleightCharge` decrements; `grantSleight(def)` adds to draw pile.
**`double_tap`/`on_swap` = once-per-round lock, not discard-on-use:** they stay on the grid. `sleightCanActivateThisRound(card)` gates, `lockSleightForRound(card)` sets `_usedThisRound` + decrements. Lock cleared in the round-start sweep. At 0 uses it sits inert (not auto-removed).

## Normal mode: progression / events / shop / boss

- 3 Acts × (5 events + 1 boss) = 18 nodes. `actNumber` 1–3, `nodeInAct` 0–4 (boss at 5). `forceBossNextRound`; `actNumber > 3` → `onGameWin()`.
- **Events:** reward-grid destination tiles set `pendingEventOverride` → `closeRewardGrid()` routes to shop or `openEvent()`, rendered in `#event-overlay`. Implemented: Confluence, Crossroads, Gamble, Wandering Merchant, Altar (`altarEffects[]`), Cleansing Spring, Twin Path. All dev-panel triggerable.
- **Shop:** `triggerShop()` → `generateShopItems()` → `renderShop()`. Layout = stacked `.shop-shelf` rows (3 Tricks / 3 Sleights / 2 Knacks / 2 Upgrades) + `#shop-footer-row` (card services, buy swaps/discards, reroll). Overlay is `overflow:hidden`, shelves `flex:1` — must always fit one screen, no scroll. Owned items are filtered from pools so it never offers a duplicate.
- **Boss:** `BOSS_PRESETS`, `triggerBoss()`/`endBoss()`. Modifiers: blocked cells (`isCellBlocked`), Trick disabling (`isTrickDisabledByBoss`), low-card famine (`maybeFamineDrawSwap`). `fight_power` sleight bypasses all via `bossEffectsIgnored()`. **Boss objectives only advance via `checkBossObjective`, called from `playHand`** — any mode that doesn't call `playHand` cannot win a boss round.

## Scoring dance (`playPreviewDance`, `js/score-dance.js`)

Escalating score animation in the hand-preview slot (`#selected-cards.dnc-active`); `newDanceEnabled` (default on) routes `playScoreDance` → `playPreviewDance`. Normal hands fly clones of the selected grid cards into preview slots (`flyGridCardToSlot`); goal hands pop in place. Overflowing hands scroll a `.dnc-track` inside a clipped `.dnc-items`.
Two invariants worth knowing before touching it: submitting a new hand mid-dance **always** cuts the old dance's grid/deck logic immediately (visual handoff style is a dev toggle: `ff` default / `cut` / `resolve`), and the outgoing hand's total **always** lands on the score display when interrupted. A superseded dance (`dncGen`) bails silently and never touches the shared stage/score.

## Match-3 mode (`js/match3.js`, `css/match3.css`)

5×5 board where **matches play themselves**. Swap + discard stay 100% manual — only *playing* is automatic. `match3Active()` gates everything. Manual `playHand()` and selection auto-submit are disabled; selection exists only to pick discards.

- **Detection: straight lines only.** Contiguous run of 3+ in a row/column forming a **flush** (same suit), **run** (consecutive ranks, ace high or low, order-independent) or **set** (same rank). Sleights/Tricks/stones/blocked cells are immovable blockers, never join a match.
- **Overlap:** `match3TypesOf` returns *every* type a window satisfies; `findMatch3Matches` greedily accepts non-overlapping windows highest-score-first (ties → longer, then higher rank). Returned matches are always **disjoint** — no card scores twice.
- **Scoring reuses the real economy:** `match3HandName` maps each match to a genuine `HAND_BASE` name (set3→Three of a Kind, run5→Straight/Straight Flush, etc.) and runs through **`calcScore`**, so Tricks/Knacks/perm buffs/Focus all apply. Longer lines → bigger hands → escalation.
- **Combo mult** `match3ComboMult(step)`: ×1, ×2, ×4, ×6… per cascade link.
- **Cascade** `match3Resolve`: detect → flash → pop → score → `removeAndFall(cells,'match3')` → re-detect. Self-guarded (`match3Resolving`), capped at 60 links. Reuses the existing fall/refill animation untouched.
- **Entry points:** `doSwap` (post-animation), end of `removeAndFall`, `startRoundTimer`. `match3PendingSettle` distinguishes fresh deal (needs `match3SettleBoard()` — quietly redraws pre-existing matches so there's no free opening cascade) from mid-round resume (must NOT re-settle).
- **Progression: own loop, NOT 3 Acts.** `isActMode()` is false. A round = hit `roundGoal` before the clock → `triggerLevelUp()`. `startGame` grants `ALL_HAND_KEYS`. Between rounds `showLevelUpScreen` → `showMatch3LevelUpScreen`: deals the next board hidden behind the overlay, grants a **credit stipend** (`MATCH3_SHOP_COINS_BASE + level·MATCH3_SHOP_COINS_LEVEL` — match-3 has no coin economy yet), calls `triggerShop()`. Shop Tricks go to the side tray via `injectTrickAfterReward`, never the grid. Leaving → `match3AfterShop()` (goal flash, 3-2-1 deal, `startRoundTimer()`).
- **Round-win finale** `match3WinFinale(winCells)` — goal check runs BEFORE the clear so winning cards are still on the board to animate.
- **Zen** (`MODES.zen`): same board, no clock (`match3NoTimer()`), unlimited swaps/discards (`match3ApplyZenResources` → 99), goals doubled.
- **Type toggles** (`match3Types`, Settings): flush/run/set each disableable, removing them from detection. Real balancing lever — flushes fire *very* often on a random 5×5 and, since matches are disjoint, a high-scoring flush suppresses crossing runs/sets. `setMatch3Type` refuses to disable the last one (board would deadlock).
- **Dev toggles** (dev panel → Match-3 Mode): infinite deck, infinite mode (no clock/goal sandbox), select-before-play (1s highlight so a match can be interrupted; off).
- **Open TBDs:** wildcard Sleights standing in for a rank/suit; Sleight activations don't fire on auto-matches; bosses (and therefore reward-grid/shop act progression) aren't wired into the cascade.

## Dominoes mode (`js/dominoes-mode.js`, `js/data/dominoes.js`)

8×8 two-value tiles, fully isolated from Normal; shared entry points (`render`, `playHand`, `doDiscard`, `initGridData`, `startGame` grid-sizing) route here when `dominoActive()`. Own board model (`dominoGrid`/`dominoPieces`, separate from `gridData`). Select 3 adjacent pieces, score every run/set of 3+ across their six halves. **See `DOMINOES_MODE.md`.**

## Dev panel / Settings

`#dev-panel` is both the in-game dev panel (🛠, bottom-right) and the menu's Settings screen (`openSettingsFromMenu`); title bar swaps `DEV MODE`/`SETTINGS`. Centred bounded pop-up (`css/dev-overlays.css`) with sticky title bar, scrolling `#dev-panel-body`, backdrop dim via `0 0 0 100vmax` box-shadow (no wrapper element).
**It lives OUTSIDE `#stage` in `index.html`** (sibling of `#main-menu-overlay`) — inside the stage it inherited the cabinet's CSS `zoom` and went off-screen.
Add Tricks/knacks/sleights by name, trigger any event/boss, adjust time/coins/score/limits, open reward grid, scoring-dance + match-3 toggles.

## Conventions

- Match surrounding style: terse, inline, lots of single-line helpers.
- Animation gating: `animating` / `falling` / `pendingAction` block input mid-animation.
- Complex/ambiguous mechanic → ship a simplified version, tag `TBD` in a comment + the item's `desc`/`needsResolve`.
