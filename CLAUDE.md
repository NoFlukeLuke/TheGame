# TheGame — Roguelike Poker

A browser-based HTML/JS roguelike poker game. **No build step, no framework, no dependencies** — plain files loaded directly. Open `index.html` in a browser and it runs.

- **Live site:** https://noflukeluke.github.io/TheGame/ (GitHub Pages, auto-deploys from `main`)
- **Owner:** non-technical developer — explain changes plainly, avoid jargon dumps.
- **Platform focus — DESKTOP FIRST (landscape).** New features, layout work, and polish target the **desktop / landscape** experience (the `#stage.landscape` layout). Portrait / mobile is **deprioritized** — it still runs, but don't spend effort on it or block desktop work to keep it pixel-perfect. When a change could affect both, get it right on desktop; only touch portrait if explicitly asked. (Scope layout/visual CSS under `#stage.landscape` so portrait is left as-is.)
- **LETHE reskin (this branch):** the whole game is wrapped in an `#cabinet` div — a retro-futuristic 80s arcade-cabinet shell (marquee, CRT screen bezel, deck/vents) around `#stage`. Its look lives in `css/style.css`; the wrapper markup is in `index.html`. Gameplay is unchanged from `main` r95 (this branch = r95 logic + the reskin).

## File layout (read this first — it saves you from loading the whole game)

The game **used to be one giant `index.html`**. It's now split into many small files so you only have to read (and re-send to Claude) the one part you're working on. **`index.html` is just the skeleton** — page markup plus the ordered `<link>`/`<script>` tags that pull everything else in.

- `index.html` — HTML markup + ordered `<script src>` / `<link>` tags. ~700 lines.
- `css/style.css` — all the main game styling, including the LETHE cabinet shell (the big stylesheet).
- `css/dance.css` — the score-“dance” / hand-preview animation styles.
- `css/dev-overlays.css` — dev-panel + event-overlay styling.
- `js/` — the game code, one file per system (list below).
- `js/data/` — **the "entities": pure content/data, no logic.** Edit these to tune or add game content without touching engine code:
  - `cards.js` — suits, ranks, rank order, `HAND_BASE` values, round/goal durations, `cardCan`.
  - `tricks.js` — `TRICK_POOL`, `TRICK_CATEGORIES`, trick emoji.
  - `knacks.js` — `KNACK_POOL` (+ the `C` color palette const).
  - `sleights.js` — `SLEIGHT_POOL`.
  - `bosses.js` — `BOSS_PRESETS`.
  - `balance.js` — `BAL` (the big tuning table) + `DESC_TEMPLATES`.

**How the split works (important — don't break this):** all `js/*.js` files are plain **classic scripts that share one global scope** — a `const`/`let`/`function` defined in one file is visible to all the others, exactly as if they were still one big `<script>`. **Load order is preserved and matters:** the `<script>` tags in `index.html` are in the same order the code originally ran, because several files run set-up code at load time (event bindings; `LIMITS_DEF.forEach`, `TRICK_CATEGORIES.forEach`, `applyBalDescriptions()`; and `js/bootstrap.js` at the very end, which calls `initMainMenu()`). If you add a new `.js` file, put its `<script>` tag in the right spot (data files load up top with the rest; `bootstrap.js` stays last). If you're not sure which file a function lives in, `grep -rn "functionName" js/`.

Rough guide to `js/` (engine): `menu` `devlog` `grid-metrics` `focus-config` `limits` `combos-aim` (combo families + aim sleights) · `deck-grid` (deck + gridData + curses) · `hand-detect` (findBestHand/detectHand) · `scoring` (calcScore, exalt/corrupt, contributions) · `render` · `focus` (focus meter) · `hud` · `input` (tap/swap/select) · `play-hand` · `score-anims` / `score-dance` (the scoring “dance”) · `discard` · `card-fall` (renderCardAppearance + fall anim) · `round-timers` · `boss` · `reward-grid` · `limit-break` · `sleights-runtime` · `events-core` / `events` · `interlude` / `level-up` / `tricks-ui` · `shop` · `hands-meta` · `stats` · `deck-view` · `game-control` (pause/resume/startGame) · `challenge` · `audio` · `dev-panel` · `bootstrap` (runs last).

## Workflow

- **Branch:** `main` is the source of truth and auto-deploys to GitHub Pages — never commit directly to it. Develop on the `claude/*` feature branch this session was assigned. If none was given, branch off the latest main: `git checkout -b claude/<topic> origin/main`.
- **Deploy:** push your feature branch, then fast-forward `main` to it: `git push origin HEAD && git push origin HEAD:main`. Pages serves from `main`.
- **Build stamp:** bump the `BUILD` constant at the top of **`js/menu.js`** (currently `'2026-08-04 · r125 · Match-3 between-rounds = the normal shop (+ credit stipend)'`) on every commit. It shows in the menu footer + dev panel so the owner can confirm the cache is fresh. Increment the `rN` each commit.
- **Commit messages:** detailed, since a fresh Claude session re-orients from git history. End with the session URL line.
- After editing, validate syntax (loads every JS file in order, exactly as the browser does):
  ```
  node -e "const fs=require('fs');const idx=fs.readFileSync('index.html','utf8');const srcs=[...idx.matchAll(/<script src=\"([^\"]+)\"><\/script>/g)].map(m=>m[1]);const code=srcs.map(s=>fs.readFileSync(s,'utf8')).join('\n');new Function(code);console.log('OK',srcs.length,'files');"
  ```

## Core architecture

The game is a grid of playing cards. You select orthogonally-connected cards to form poker hands, scoring against a per-round goal under a timer.

### Key globals
- `gridData[r][c]` — the grid; each cell is a card object, a special card, or `null`.
- `gridRows` / `gridCols` — grid dimensions (driven by `limits.grid_rows/grid_cols`).
- `drawPile` / `playedPile` — deck. Scored cards → `playedPile`, reshuffled into `drawPile` at round end via `flushPlayedDeck()`.
- `selected` — array of `[r,c]` currently selected.
- `score`, `coins`, `swaps`, `discards`, `roundSeconds`, `level`, `roundGoal`/`totalScore`.
- `limits` / `LIMITS_DEF` — upgradeable caps (grid size, round time, swaps, discards, reward grid size).
- `ACTIVE_MODE` — `.id === 'normal'` is the main 3-Act node mode; other modes are timer-based (legacy). `.match3` flags the auto-play Match-3 modes (see below); `.zen` is the no-clock variant of it.

### Layout / scaling — "one fixed canvas, scaled" (owner's explicit choice)
The stage (`#stage`, 420×740 portrait / 747×420 landscape) is a single fixed-size canvas scaled uniformly via CSS `zoom: var(--stage-zoom)`, like a scaled image — **not** a responsive/fluid reflow layout. Card sizing is computed by `recomputeGridMetrics()` from the REAL measured DOM slot (`measureGridSlot()` → `#grid-slot.getBoundingClientRect()` ÷ zoom), not guessed footprint constants — this is what fixed a nasty grid/button overlap regression. If you ever need to change layout, preserve this architecture; don't switch to fluid reflow.

**Desktop = landscape (the primary target).** JS adds `.landscape` to `#stage` when `availW > availH && availW >= 480`, switching on the **v7 landscape** layout — a set of `#stage.landscape` rules that absolutely-position each panel as a percentage of the 747×420 stage (see the big `#stage.landscape …` CSS block). This is where all current layout/visual work lives; **scope new layout CSS under `#stage.landscape`** so the (deprioritized) portrait layout is untouched. The portrait layout is the older stacked-flex version further up in the CSS.

**Desktop panel (left column), current arrangement (r87–r90):** top → bottom = SCORE/GOAL → PIPS·MULT·FOCUS chips → **Knacks** (icon row, no label) → **hand preview** (full-width `#selected-cards` frame with the hand name inside it on the left) → **Tricks** (card-shaped tiles, `n/5` count pinned bottom-right, no label) → time/coins → STATS/DECK/PAUSE. The hand preview renders the selected cards via **`renderCardAppearance()`** (the same builder the grid uses) scaled down by local `--card-w`/`--card-h` on `#selected-cards`, so preview cards mirror the grid exactly, bonus decorations and all.

### Card types (flags on the card object)
- **Normal card:** `{ rank, suit, _id }`.
- **Trick** (formerly *Bonus Card / BC*): `trick:{id,name,desc,tier}`. A scoring buff. **As of the trick redesign (r66+), Tricks do NOT live on the grid** — they sit in a persistent **side tray** (`trickTray[]`, rendered by `renderTrickTray()` into `#trick-tray-list`; `trickTrayMode` defaults to `true`, grid placement is a dev-only toggle). `hasTrick(id)` checks the tray in tray mode (falls back to scanning `gridData` only when grid placement is toggled on). `acquiredTricks[]` tracks ever-owned (for dedup via `ownsTrick`). **NOTE: Sleights (below), not Tricks, are the entities that physically live on the grid.**
- **Sleight** (formerly *Joker*): `_isSleight:true`, `sleightId`, `_usesLeft`. A deck card with conditional activations (see below).
- **Stone:** `_isStone:true` — inert obstacle.
- **Knack** (formerly *Totem*): NOT a card. Persistent rule-changer in `acquiredKnacks[]`, shown in HUD. `hasKnack(id)`.
- **Challenge card:** `challengeCard` / `challengeActive`, occupies a cell; `resolveChallenge(success)`.
- `cardCan(card, action)` gates what each type can do (`select`/`swap`/`discard`/`fall`/`render`).

### Scoring (`calcScore(handName, cells)` + `playHand()`)
- **Per-round-from-zero (r74):** `score` resets to `0` at the start of every round and is checked only against that round's own `roundGoal` — there is no running lifetime total driving gameplay anymore (the old `cumulativeGoal`, which summed every round's target forever, is gone). A round ends the instant `score >= roundGoal`. `triggerLevelUp()` banks the just-finished round's `score` into `totalScore` (a display-only lifetime counter shown as "Total Score" on the win/game-over screens) before zeroing `score` for the new round. `roundGoal` itself is still computed the same way as before (`BASE_GOAL * GOAL_SCALE^(level-1)`, rounded to the nearest 500) — only what it's compared against changed, so the round-to-round difficulty curve is unchanged from before this rework, just finally displayed and gated correctly. This also fixed two latent bugs that depended on `roundGoal` being the real pass/fail bar: the `last_stand` Trick (`score < roundGoal` → ×2) used to go permanently dead after level ~4 because it was comparing the lifetime total to a single round's increment; and the Twin Path "Goal +15%" shadow debuff used to silently do nothing because it only mutated `roundGoal`, never the actual (`cumulativeGoal`-based) gate.
- `calcScore` returns the numeric score: base pips (level-scaled) + per-card pips + bonuses, × mult, × score-multipliers.
- **Playing a hand costs no time (r50):** the old "−5s per manual play (+ reward-grid penalties)" deduction in `playHand` was removed (owner request). Reward-grid play-cost debuffs (`extraPlayCostPerm` etc.) still parse but are inert.
- **Suits are NEUTRAL by default** (owner's decision, now shipped). A plain card scores only its pips × mult — no per-suit coin/time/pip/mult bonus. Suit effects come *only* from exalt/corrupt (below) or Tricks (♥/♣ Tricks in `calcScore`; Spade Flood etc.). The old defaults (♣ pips, ♥ mult, ♦ coin, ♠ time) are gone — see the "suits are neutral" comment in `playHand`.
- `findBestHand(cells)` brute-forces all connected 2–5 card subsets, scores each, returns the best. Handles wild sleights (temp rank/suit) and drops non-wild sleights from detection.
- `detectHand(cells)` returns the hand-type string. `activeHands` Set gates which hands are scorable (in Normal mode ALL hands are active from the start).

### Exalt / Corrupt (`exaltCorruptTotals`, `exaltCard`, `corruptCard`) — r45 spec
**PAUSED by default (r50):** the whole mechanic is gated behind `exaltCorruptEnabled` (a persisted flag, default `false`, toggled in the pause-menu Settings). When off: triggers don't fire (the trigger block in `playHand`, the `_heartSwapPending` set in `doSwap`, and the discard-corruption block in `doDiscard` are all wrapped in `if (exaltCorruptEnabled)`), `exaltCard`/`corruptCard` early-return, `exaltCorruptTotals` returns zeros, and `.exalted`/`.corrupted` glow classes are suppressed in `render`. Everything below describes behavior **when the toggle is on**.

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

## Sleight system (`SLEIGHT_POOL`)

Sleights are physical deck cards. They fall, swap, get discarded, and get played like normal cards. **Long-press** a sleight on the grid for its tooltip (single-tap is reserved for selecting it into a hand). Charges (`durability`) are **per game**, not per round.

`def.activation` determines how the effect fires:
| activation | fires when | wired in |
|---|---|---|
| `wildcard` | participates in hand detection (`wild:'rank'/'suit'/'both'`) | `findBestHand` (`bestWildRank`/`bestWildSuit`) |
| `on_play` | sleight is part of a played hand | `fireSleightsOnPlay` in `playHand` |
| `on_discard` | sleight is discarded | `doDiscard` (has grid position) |
| `on_swap` | sleight is moved by a swap (either direction); **once per round, see below** | `fireSleightsOnSwap` in `doSwap` |
| `on_draw` | sleight lands on the grid | `fireSleightsOnDraw` (round start) |
| `round_start` / `round_end` | round boundaries | round-start sweep / interest calc |
| `passive` | always while on grid | checked inline (e.g. `fight_power` via `bossEffectsIgnored()`) |
| `double_tap` | double-tapped; **once per round, see below** | `onCardTap` intercept |

Effects live in `applySleightGridEffect(id, r, c)`. `consumeSleightCharge` decrements/removes (used by most activation types). `grantSleight(def)` adds one to the draw pile.

**`double_tap` / `on_swap` — once-per-round lock (not discard-on-use):** These sleights stay physically on the grid after firing. `sleightCanActivateThisRound(card)` gates activation (checks `_usedThisRound` + remaining `_usesLeft`); `lockSleightForRound(card)` sets `_usedThisRound = true` and decrements `_usesLeft` after a successful trigger. The lock is cleared for every sleight on the grid in the round-start sweep (search `_usedThisRound = false`, right before `fireSleightsAtRoundStart()`). Once `_usesLeft` hits 0 the sleight just sits inert — it is **not** auto-removed; it can still leave the grid normally by being played in a hand or discarded by the player. Grid tooltips show "ONCE PER ROUND" / "USED THIS ROUND" for these.

## Events (node-based, Normal mode)

Reward grid destination tiles set `pendingEventOverride` → `closeRewardGrid()` routes to shop or `openEvent()`. Events render in `#event-overlay`. Implemented: **Confluence** (theme draft), **Crossroads** (sacrifice trades), **Gamble** (doors / double-or-nothing), **Wandering Merchant** (free rare items), **Altar** (multi-round investments via `altarEffects[]`), **Cleansing Spring** (purge/restore), **Twin Path** (2 Tricks + shadow debuff). All triggerable from the dev panel.

## Shop

`triggerShop()` → `generateShopItems()` → `renderShop()`. **Layout = stacked shelves (r50):** `#shop-main-grid` is a vertical flex stack of four `.shop-shelf` rows (Tricks, Sleights, Knacks, Upgrades — each a fixed-width label + a horizontal `.shop-shelf-items` row), with a `#shop-footer-row` (reroll + leave) pinned below a divider. The overlay is `overflow:hidden` and shelves `flex:1` so the whole shop always fits one screen with no scroll; cards are capped at `max-height:128px`. Each shelf has a color-coded left border. `shopItems` holds curated rows, each rendered by its own function:
- **3 Tricks** (`renderShopTricks`, priced by tier via `SHOP_TRICK_PRICES`).
- **3 sleights** (`renderShopSleights`, `pickSleightByRarity`, `SHOP_SLEIGHT_PRICES`).
- **2 knacks** (`renderShopKnacks`, flat `SHOP_KNACK_PRICE`).
- **2 limit upgrades** (`renderShopLimits`, scaling cost via `limitPrice`).
- **Footer** (`renderShopFooter`): card services (remove/duplicate/change-suit/combine, capped by `SHOP_SVC_MAX`) + buy swaps/discards + **reroll** (`rerollShopItems`, which only refreshes *unpurchased* slots).

Owned Tricks/knacks and already-granted sleights are filtered out of the pools so the shop never offers a duplicate.

## Progression (Normal mode)
3 Acts × (5 events + 1 boss) = 18 nodes. `actNumber` (1–3), `nodeInAct` (0–4, boss at 5). `forceBossNextRound` triggers the boss after the next deal. Win at `actNumber > 3` → `onGameWin()`.

## Boss system
`BOSS_PRESETS`, `triggerBoss()`, `endBoss()`. Modifiers: blocked cells (`isCellBlocked`), Trick disabling (`isTrickDisabledByBoss`), low-card famine (`maybeFamineDrawSwap`). The `fight_power` sleight bypasses all of these via `bossEffectsIgnored()`.

## Scoring dance (preview-window · `playPreviewDance`)
When a hand is played, the escalating score animation ("dance") runs in the hand-preview slot (`#selected-cards`, `.dnc-active`). `newDanceEnabled` (default on) routes `playScoreDance` → `playPreviewDance`. Behaviour (desktop):
- **Cards fly into the preview (r89):** normal hands fly a clone of each selected grid card (built from `renderCardAppearance`) from its grid cell into a preview slot (`flyGridCardToSlot`), then reveal the slot's `.dnc-card`. Goal hands keep the in-place pop (they salute). Grid cards hidden mid-fly are tracked in `dncHiddenGridEls` and restored if the dance aborts before `removeAndFall`.
- **Sideways scroll for large hands (r89):** cards live in a clipped `.dnc-items` viewport holding a sliding `.dnc-track`; if the strip overflows, each scoring card slides the track left to reveal hidden cards. (Hands cap at 5, so on the full-width desktop box this rarely triggers — it's there for smaller viewports / future larger hands.)
- **Interrupt handoff (`danceInterruptMode`, r90; reworked r116):** submitting a new hand mid-dance always cuts the old dance's grid/logic **immediately** (grid- and deck-safe — the new hand's already-computed cells can't be invalidated). A dev toggle (HUD section) picks the *visual* handoff: `ff` (rush the old score up, ~360ms — **default since r116**), `cut` (instant), `resolve` (snap + pop, ~200ms). A 260ms spam valve skips the count-up flourish on rapid chaining.
- **Rapid-submit score resolution (r116) — was a game-wide bug.** The outgoing hand's total now **always** lands on the score display the moment it's interrupted (animated via the flourish, or snapped instantly on the `cut`/spam path). Previously the display was only written during a dance's own score-climb phase, which happens *after* the fly-in and the entire card-beat phase — so chaining hands fast left the score frozen on a stale mid-climb number until some hand was allowed to finish (or the goal hand landed). The underlying `score` was always correct; only the display lagged. The handoff also now runs **concurrently with the incoming hand's fly-in** (instead of blocking before it), so the new cards float into the preview while the old total rushes up behind them, and the new hand's beats wait on that count-up. `danceInterruptFlourish` is awaited, so it has an abort + timeout escape hatch — rAF is throttled to zero in a background tab and would otherwise stall the incoming dance.
- **Superseded-dance guard (`dncGen`, r89):** a dance that gets superseded bails silently and never touches the shared stage/score (which the successor owns) — this fixed particles flying from a stale/detached preview box on double-submit.

## Match-3 auto-play mode (`js/match3.js` + `css/match3.css`, r115+)

A 5×5 board where **matches play themselves**. Listed in the mode-select carousel (`MODE_SELECT_LIST` / `MODE_META` in `js/menu.js`) alongside Classic and Six Suits. The player's only board actions are **swap and discard, and both stay 100% manual** — nothing auto-swaps or auto-discards; only the *playing* of matches is automatic. `match3Active()` gates everything.

- **Progression: its own loop, NOT the 3-Act structure.** `isActMode()` is **false** for match-3, so it deliberately skips both the act/node flow and the legacy 20-minute timer flow. A round is just *hit `roundGoal` before the clock runs out* → `triggerLevelUp()`. The three places that needed explicit exclusion: the legacy game-timer branch in `startTimers` **and** `resumeGame` (otherwise shops/bosses fire off the 20-min clock and the run hard-ends at 0), and the stray-tick guard in `onRoundEnd`. `startGame` also grants `ALL_HAND_KEYS` for match-3, since it scores real hand names.
- **Why not `actStructure: true`?** It would hand match-3 the reward grid and shops for free, but also **boss rounds** — and boss objectives only advance through `checkBossObjective`, which is called from `playHand`, which match-3 never calls. That would be an unwinnable round. Wiring bosses (and thus the reward grid / shop progression) into the cascade is the open follow-up. Note `enableBosses`/`enableShops`/`enableEvents` on the mode defs are **inert** — nothing outside `menu.js` reads them; `isActMode()` is what actually drives that plumbing.
- **Between-rounds = the standard shop** (r125): `showLevelUpScreen` delegates to `showMatch3LevelUpScreen` (in `js/match3.js`) for match-3, which deals the next board (settled, hidden behind the overlay), grants a **credit stipend** (`MATCH3_SHOP_COINS_BASE + level·MATCH3_SHOP_COINS_LEVEL` — match-3 has no coin economy of its own yet, so the shop would otherwise be unaffordable), and calls `triggerShop()`. The shop grants Tricks to the **side tray** via `injectTrickAfterReward` (never the grid). Leaving the shop routes through the `match3Active()` branch of the `#shop-close` handler → `match3AfterShop()`, which runs the goal flash + 3-2-1 deal and `startRoundTimer()` (settle + cascade). *(Earlier r122–r123 tried a fullscreen pick-of-3 then an on-grid centre-tile pick; the on-grid version fought the grid's pointer-capture — flickering hover, unreliable tap-confirm — so it was replaced by the shop.)*
- **Round-win finale** (r122): on goal-reached the cascade calls `match3WinFinale(winCells)` — a self-contained mirror of the Normal-mode goal-hand finale (jitter surrounding cards → gentle explode → the goal-clinching match's cards fly into the `#selected-cards` preview), then `triggerLevelUp`. The goal check runs BEFORE the clear so those winning cards are still on the board to animate.

- **Detection — straight lines only.** Any contiguous run of 3+ cards in a row or column forming a **flush** (same suit), **run** (consecutive ranks, ace high or low, order-independent within the window) or **set** (same rank). Sleights/Tricks/stones/blocked cells are immovable blockers and never join a match (a Sleight that must be played inside a hand can't be auto-played). *TBD: wildcard Sleights standing in for a rank/suit.*
- **Overlap priority.** `match3TypesOf` returns *every* type a window satisfies (a single-suited run is both `run` and `flush`), then `findMatch3Matches` scores each and greedily accepts non-overlapping windows **highest score first** (ties: longer line, then highest rank). Guarantees the returned matches are **disjoint** — no card ever scores twice.
- **Scoring reuses the real economy.** Each match maps to a genuine `HAND_BASE` name via `match3HandName` (set3→Three of a Kind, set4→Four of a Kind, run3/4→Run of 3/4, run5→Straight or Straight Flush when single-suited, flush→Flush) and runs through **`calcScore`**, so Tricks/Knacks/perm buffs/Focus all apply. Longer lines land on bigger hands — that's where match-4/5 escalation comes from. *TBD: Sleight activations don't fire on auto-matches.*
- **Combo multiplier** = `match3ComboMult(step)`: step 1 is ×1, then **×2, ×4, ×6…** per cascade link (score = pips × mult, so ×N score ≡ ×N pips).
- **Cascade loop** (`match3Resolve`): detect → flash → pop → score → `removeAndFall(cells,'match3')` → re-detect, until quiet. Self-guarded (`match3Resolving`) so it can be called freely; capped at 60 links. **The existing fall/refill animation is reused untouched.**
- **Entry points:** `doSwap` (after the swap animation lands), the end of `removeAndFall` (post-discard), and `startRoundTimer` — the one call site every round start funnels through. `match3PendingSettle` distinguishes a fresh deal (needs `match3SettleBoard()`, which quietly re-draws pre-existing matches so there's no free opening cascade) from a mid-round resume (must NOT re-settle).
- **Zen** (`MODES.zen`): same board, no clock (`match3NoTimer()` short-circuits the round tick) and unlimited swaps/discards (`match3ApplyZenResources` tops the pools to 99). Goals are **doubled** so levelling/reward grid stay reachable.
- **Match-type toggles** (`match3Types`, r117): flush / run / set can each be switched off in Settings, which removes them from detection entirely (`match3TypesOf` gates on them). Flushes fire *very* often on a random 5×5, and since matches must be disjoint a high-scoring flush suppresses any crossing run/set — so this is a real balancing lever. `setMatch3Type` refuses to disable the **last** enabled type (the board would deadlock) and returns the resulting state so the checkbox re-syncs.
- **Dev toggles** (dev panel → *Match-3 Mode*): infinite deck (scored cards requeue to the back instead of being held out; finite is default), infinite mode (no clock **and** no goal — sandbox), and select-before-play (highlight a match 1s before it plays so it can be interrupted; off by default).
- Manual `playHand()` and selection auto-submit are disabled in match-3; selection exists only to pick cards to discard.

## Survival mode (`js/survival.js` + `css/survival.css`, r132+)

Endless escalating-goals poker, listed in the mode carousel (`MODE_SELECT_LIST`). Real manual poker (unlike match-3) so it calls `playHand`; `survivalActive()` gates everything. **Not** `isActMode()` — no 3-Act flow, no reward grid, no node/event structure, no legacy 20-min game clock (excluded from the timer-progression block in `startTimers` **and** `resumeGame`, like match-3/dominoes).

- **The loop:** clear a round's goal → an on-brand **pick-of-three** opens over the board → pick one → next round deals. Miss a goal (round clock hits 0 with `score < roundGoal`) → run ends (the normal `_onRoundEndCore` fail path). `winCondition: 'endless'`.
- **2-minute rounds.** `currentRoundDuration()` returns `SURVIVAL_ROUND_SECONDS` (120) for survival, `ROUND_DURATION` (180) otherwise; `computeRoundResources`, `updateClockUI`'s bar fill, and `startGame`'s `roundSeconds` all route through it.
- **Score & time carry over (owner spec).** At goal clear, `triggerLevelUp` seeds the next round's `score` with the **overflow** above the just-cleared goal (`score - roundGoal`), and banks only the counted portion into the display `totalScore`. So each goal is 0→target but the leftover from the previous clear starts you partway.
- **Coins.** No coin economy of its own except: each clear pays `SURVIVAL_LEVEL_COINS` (3) **+ 1 per full 10s left** on the goal timer (`survivalAfterLevelUp`).
- **Pick-of-three (`showSurvivalPickScreen`, centred over the board).** Options are drawn from **all four entity pools** — Tricks, Sleights, Knacks, Limits — weighted (`SURVIVAL_PICK_WEIGHTS`, Tricks/Sleights lead) with a guarantee: **≥1 Limit and ≥1 Knack option every 4 levels** (drought counters `survivalLevelsSinceLimit/Knack`, forced on gap ≥ 3). Grant dispatch: trick→`injectTrickAfterReward` (side tray), sleight→`grantSleight`, knack→`acquiredKnacks.push`, limit→`incrementLimit`. **Reroll:** first 2 free each level, then 5/10/15… (`survivalRerollCost`); the count resets every level-up.
- **Goal-hand finale (survival flavour):** `survivalGoalHandoff` (branched in `playPreviewDance`'s `isGoalHand` block) skips the explode/fly-to-preview; instead the board cards **spread ~20% outward and freeze**, the pick opens, and on choose `survivalDealNext` drops the old cards out while the fresh board falls in (`survivalRecycleBoard` returns the old board to the deck first so it can't deplete).
- **On-demand shop.** A `.survival-shop-btn` next to the coins chip (both the top-bar `#coins-shop-btn` and landscape `#ci-shop-btn`, shown only via the `.sv-on` class in survival) opens the **standard shop** any time for 5 coins (`survivalOpenShop` → `triggerShop`; the shop-close handler's `else` branch resumes the round).
- **Bosses every 8 clears, no challenges.** `survivalAfterLevelUp` sets `survivalBossPending` when the just-incremented `level` hits 9/17/25…; the next `survivalDealNext` deals the board then calls `survivalTriggerBoss()` instead of `startRoundTimer`. The boss clock = the **banked leftover time** across those 8 clears (`survivalBossTimeBank`, capped 180, floored 30) — `triggerBoss(preset, windowSeconds)` now takes an explicit window (`bossWindowDuration`) instead of the fixed `BOSS_WINDOW_DURATION`. The objective is checked in `playHand` (survival plays real hands, unlike match-3). `endBoss` has a `survivalActive()` branch: **win** → zero the bank + `survivalPostBossReward()` (a bonus pick, kicker "BOSS DEFEATED") → normal rounds resume; **loss** → `onGameEnd` (bosses are a hard wall). Challenges never fire (reward-grid/act-driven), matching the "no challenges" ask.

## Dev panel / Settings
`#dev-panel` is **both** the in-game dev panel (🛠 button) and the main menu's **Settings** screen (`openSettingsFromMenu`); the title bar swaps between `DEV MODE` and `SETTINGS`. As of **r117** it's a centred, bounded arcade pop-up (`css/dev-overlays.css`) rather than a full-screen sheet: sticky gold title bar, internally-scrolling `#dev-panel-body`, and a backdrop dim made by a `0 0 0 100vmax` box-shadow spread so no extra wrapper element is needed. **It lives OUTSIDE `#stage` in `index.html`** (a sibling of `#main-menu-overlay`) — inside the stage it inherited the cabinet's CSS `zoom`, which scaled its `vh` sizing by ~1.3× and pushed it off-screen.

🛠 button (bottom-right). Add Tricks / knacks / sleights by name, trigger any event/boss, adjust time/coins/score/limits, open reward grid. HUD section also has scoring-dance toggles (new dance on/off, interrupt mode). Invaluable for testing.

## Conventions
- Match surrounding code style (terse, inline, lots of single-line helpers).
- Animation gating: `animating` / `falling` / `pendingAction` flags block input mid-animation.
- When a mechanic is complex/ambiguous, implement a simplified version and tag it `TBD` in a comment + the item's `desc`/`needsResolve`.
