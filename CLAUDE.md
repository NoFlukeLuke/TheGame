# TheGame — Roguelike Poker

A browser-based HTML/JS roguelike poker game. **No build step, no framework, no dependencies** — plain files loaded directly. Open `index.html` in a browser and it runs.

- **Live site:** https://noflukeluke.github.io/TheGame/ (GitHub Pages, auto-deploys from `main`)
- **Owner:** non-technical developer — explain changes plainly, avoid jargon dumps.
- **Platform focus — DESKTOP FIRST (landscape).** New features, layout work, and polish target the **desktop / landscape** experience (the `#stage.landscape` layout). Portrait / mobile is **deprioritized** — it still runs, but don't spend effort on it or block desktop work to keep it pixel-perfect. (Exception: r156 reworked the portrait strip on purpose, as groundwork for local co-op — see "Portrait shared strip" below. Desktop is still the default target.) When a change could affect both, get it right on desktop; only touch portrait if explicitly asked. (Scope layout/visual CSS under `#stage.landscape` so portrait is left as-is.)
- **LETHE reskin (this branch):** the whole game is wrapped in an `#cabinet` div — a retro-futuristic 80s arcade-cabinet shell (marquee, CRT screen bezel, deck/vents) around `#stage`. Its look lives in `css/style.css`; the wrapper markup is in `index.html`. Gameplay is unchanged from `main` r95 (this branch = r95 logic + the reskin).

## File layout (read this first — it saves you from loading the whole game)

The game **used to be one giant `index.html`**. It's now split into many small files so you only have to read (and re-send to Claude) the one part you're working on. **`index.html` is just the skeleton** — page markup plus the ordered `<link>`/`<script>` tags that pull everything else in.

- `index.html` — HTML markup + ordered `<script src>` / `<link>` tags. ~700 lines.
- `css/style.css` — all the main game styling, including the LETHE cabinet shell (the big stylesheet).
- `css/dance.css` — the score-“dance” / hand-preview animation styles.
- `css/dev-overlays.css` — dev-panel + event-overlay styling.
- `js/` — the game code, one file per system (list below).
- `js/storage.js` — **loads FIRST**, before every other script. A safety shim for browser storage (see below). Nothing else may be moved above it.
- `js/data/` — **the "entities": pure content/data, no logic.** Edit these to tune or add game content without touching engine code:
  - `cards.js` — suits, ranks, rank order, `HAND_BASE` values, round/goal durations, `cardCan`.
  - `tricks.js` — `TRICK_POOL`, `TRICK_CATEGORIES`, trick emoji.
  - `knacks.js` — `KNACK_POOL` (+ the `C` color palette const).
  - `sleights.js` — `SLEIGHT_POOL`.
  - `bosses.js` — `BOSS_PRESETS`.
  - `balance.js` — `BAL` (the big tuning table) + `DESC_TEMPLATES`.

**Animation drivers (r139–r141) — all three publish CSS custom properties rather than writing `el.style.transform`.** That is deliberate: the tiles/cards they animate already use `transform` for hover, `.selected`, fly-outs and keyframes, so the driver hands CSS a value and the element composes it. Precedence falls out correctly — an inline transform (discard fly-out) and an `!important` one (`.card.removing`) both beat the stylesheet declaration, and keyframe animations beat it too.
  - `js/float-anim.js` — `FLOAT_CFG` + `startFloat/stopFloat`. The barely-there drift on **shop AND reward-grid** tiles (x±1.5 · y±2.5 · rot±0.5° · 6s). Publishes `--fx/--fy/--fr/--fs`. Seeds cache by `data-float-key` so a re-render doesn't re-roll the phase.
  - `js/heartbeat.js` — `HB_CFG` + `startHeartbeat/stopHeartbeat`. A lub-dub wave every 5s across the play grid, starting at the **left edge, middle row(s)** and radiating outward. Publishes `--hbx/--hby/--hbr/--hbs`. Runs with the round (`startRoundTimer`/`stopTimers`).
  - `js/channel-change.js` — `channelChange(swapFn, opts)`. The CRT flick between screens (static / roll / collapse / RGB split); `swapFn` fires at the collapse, hidden in the flash. Wired into `openMart`/`closeMart`.
  All three have live tuners in the dev panel under **Animation**, and standalone preview pages: `heartbeat-preview.html`, `channel-change-preview.html`, `shop-float-anim-preview.html`.

**`fx-preview.html` (r149) — scoring & economy feedback tuner.** Not yet wired into the game; it is the design surface for four FX families over a mock HUD: score pops (card/Trick → PIPS·MULT·SCORE), the time charge over the clock bar, Focus gains, and credits moving one coin at a time. Every family has a **"Current (today)"** preset measured from the live game (`.dnc-particle` = 15px × `DANCE_CFG.pScale` 2.6 = 39px Crimson Pro, `pFlight` 550ms), so any other preset is a visible delta rather than a guess. Contrast comes mainly from `-webkit-text-stroke` + `paint-order: stroke fill`, which paints the dark edge OUTSIDE the glyph so a light number stays legible on a cream card without losing weight. The page dumps a copy-paste `FX_CFG` block.

**How the split works (important — don't break this):** all `js/*.js` files are plain **classic scripts that share one global scope** — a `const`/`let`/`function` defined in one file is visible to all the others, exactly as if they were still one big `<script>`. **Load order is preserved and matters:** the `<script>` tags in `index.html` are in the same order the code originally ran, because several files run set-up code at load time (event bindings; `LIMITS_DEF.forEach`, `TRICK_CATEGORIES.forEach`, `applyBalDescriptions()`; and `js/bootstrap.js` at the very end, which calls `initMainMenu()`). If you add a new `.js` file, put its `<script>` tag in the right spot (data files load up top with the rest; `bootstrap.js` stays last). If you're not sure which file a function lives in, `grep -rn "functionName" js/`.

Rough guide to `js/` (engine): `menu` `devlog` `grid-metrics` `focus-config` `limits` `combos-aim` (combo families + aim sleights) · `deck-grid` (deck + gridData + curses) · `hand-detect` (findBestHand/detectHand) · `scoring` (calcScore, exalt/corrupt, contributions) · `render` · `focus` (focus meter) · `hud` · `input` (tap/swap/select) · `play-hand` · `score-anims` / `score-dance` (the scoring “dance”) · `discard` · `card-fall` (renderCardAppearance + fall anim) · `round-timers` · `boss` · `reward-grid` · `limit-break` · `sleights-runtime` · `events-core` / `events` · `interlude` / `level-up` / `tricks-ui` · `shop` · `hands-meta` · `stats` · `deck-view` · `records` (the tabbed info hub) · `settings` (player options) · `game-control` (pause/resume/startGame) · `challenge` · `audio` · `dev-panel` · `save` (run save/resume) · `history` (finished-run log) · `portrait-panel` (portrait shared strip) · `pmf-merge` (the PIPS·MULT·FOCUS fuse) · `bootstrap` (runs last).

## Workflow

- **Branch:** `main` is the source of truth and auto-deploys to GitHub Pages — never commit directly to it. Develop on the `claude/*` feature branch this session was assigned. If none was given, branch off the latest main: `git checkout -b claude/<topic> origin/main`.
- **Deploy:** push your feature branch, then fast-forward `main` to it: `git push origin HEAD && git push origin HEAD:main`. Pages serves from `main`.
- **Build stamp:** bump the `BUILD` constant at the top of **`js/menu.js`** (currently `r155`) on every commit. It shows in the menu footer + dev panel so the owner can confirm the cache is fresh. Increment the `rN` each commit.
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
### Interact costs (r151) — ONE charge each, from `BAL._resources`
**Discard 3s per card · Swap 8s flat · Play free.** Until r151 there were **two overlapping cost systems** and both were live: a flat `spendRoundTime(DISCARD_TIME_COST/SWAP_TIME_COST)` *and* the `BAL._resources` figures. A 1-card discard billed 3+3 = **6s**, the 3rd swap of a round billed 4+10 = **14s**, and the Free Discards knack ("costs no time") still charged the flat 3s — all while the ⏱ Time pop-up quoted 3s and 4s. `DISCARD_TIME_COST` / `SWAP_TIME_COST` are now **dead constants**, kept and commented so nothing reintroduces the double charge; `freeSwapsLeft` (the "first 2 swaps free" exemption) is dead for the same reason. Costs come from `BAL._resources` alone, and `updateInteractCosts()` reads the same source so the pop-up can't drift from reality again.

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
**Bosses have NO separate score target (r155, every mode).** The win bar is simply **this round's `roundGoal`** — `bossGoalMet()` is `score >= roundGoal`. A boss's challenge is its *modifier*; `objective.type:'hand'` bosses layer their hand requirement **on top of** the goal (`handDone && bossGoalMet()`). `objective.target` is now vestigial for score bosses, and **The Ratchet raises `roundGoal`** (the number actually being compared) rather than the old target.

`BOSS_PRESETS`, `triggerBoss()`, `endBoss()`. Modifiers: blocked cells (`isCellBlocked`), Trick disabling (`isTrickDisabledByBoss`), low-card famine (`maybeFamineDrawSwap`). The `fight_power` sleight bypasses all of these via `bossEffectsIgnored()`.

### The r150 roster — `js/boss-effects.js`
Eight bosses that all share one shape: **act once at round start, then on an interval**. `bossSchedule(secs, fn)` *is* that shape — it fires immediately then repeats — and it is the single place the **Contingency Plan** knack stretches timings, so a new boss inherits the knack interaction for free. `applyBossModifiers` calls `applyBossEffectModifier(mod, params)` first; it claims its own ids and returns true, leaving the legacy modifiers untouched.

The Metronome (clock runs at the Focus multiplier) · The Tollman (interact costs ×2, +3s to play) · The Undertow (−10 Focus/15s) · The Quarantine (a cell goes dark every 15s, 10s warning) · The Censor (a Trick suspended 45s every 35s) · The Blight (3 cells contaminated every 20s) · The Recall (a rank withdrawn every 45s, never repeated) · The Auditor (−1 swap or discard every 30s).

Three more (r151) hang off **`bossOnInteract(kind)`**, called from `doSwap`/`doDiscard`, and one score hook: The Ratchet (+5% objective per interact) · The Turnstile (−3 credits per interact) · The Redaction (one hand type scores ×0.4, picked once at boss start). **The Ratchet raises `currentBoss.objective.target`, not `roundGoal`** — during a boss `checkBossObjective` is what gates the round, so raising `roundGoal` alone would do nothing (the same trap the Twin Path debuff fell into).

- **TWO kinds of unusable cell, and the difference matters.** `blockedCells` = **VOID** (legacy patterns): the card is returned to the deck and nothing falls in. `nullCells` = **QUARANTINED**: cards still fall in and fill the slot, they are just inert — *a null cell, not a null card*. `isCellBlocked()` covers both, so every existing select/tap/swipe guard handles quarantine with no change; the refill logic in `card-fall.js` deliberately asks `isCellVoid()` instead so quarantined cells keep receiving cards. `cellCountsForTriggers()` is what excludes them from "while on the grid" entity triggers.
- **Cell overlays repaint from `render()`**, not just when the boss starts — they are absolutely-positioned siblings of the cards, so they have to follow the board.
- **`startGame()` tears down boss effects.** Abandoning a run mid-boss otherwise left scheduled effects running, and a quarantine cross would land 10 seconds into the *next* run.
- **The Metronome** uses a fractional carry (`_bossTimeDebt`) so ×1.4 Focus really costs 1.4s/s instead of rounding away to ×1.
- **The Blight's Trick suppression rolls BEFORE the Trick logic, not after.** The first version rolled at the end of the per-card loop and restored the `_cp` ledger — which corrected the contributions readout while the score kept every Trick bonus, i.e. the suppression was purely cosmetic. The roll now happens at the top of the loop so the per-card MULT accumulators (`_asmMult`, `_fsMult`) can be skipped too, and a muted card falls back to `(_origPips + permPips) × retriggers`. Verified numerically: a Three of a Kind with Rich Soil scores 198 clean, 144 blighted, 135 blighted-and-suppressed. Whole-hand Tricks are still unaffected — tagged TBD.
- **Contingency Plan** shaves the *surcharge*, not the base: a ×2 interact cost becomes ×1.9, not ×1.8.

### Boss presentation (r150)
`preset.brief` is the plain-English description shown on the **preamble** — a briefing over the board with the sigil, name, flavour, what the boss does, the objective, and PROCEED. **The clock does not start until PROCEED**, then a boss-only 3-2-1 runs (`showBossCountdown` — the round-start `show321Countdown` also deals cards and refills the clock, which a boss needs neither of). On a boss round `#run-progress` gets `.boss-sigil`: the node pips collapse into one pulsing mark that leaks smoke.

The **3-2-1 is now centred on the grid** in landscape — `#countdown-321-overlay` was `position:fixed; inset:0` with a 30% top pad, i.e. centred on the *viewport*. The **payout panel** is re-themed as a LETHE remittance advice (`css/boss.css`) — overrides only, so `interlude.js`'s animation classes still drive it.

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
- **Goal-hand transition = Classic's flourish, minus the payout (r154).** The base goal dance runs unchanged (jitter → explode → winners fly to the preview → score count-up); survival just diverges at the two hand-off points in `playPreviewDance`: right after the fly it opens the pick (`survivalShowPick`, anchored to the RIGHT of the preview in landscape so the count-up and choosing happen together), and at the end it **skips `startInterlude`** (`if(!survivalActive())`). `handleDanceAbort` skips it too — otherwise picking mid-count-up would fire the interlude and clobber the freshly dealt board. **triggerLevelUp runs on CHOOSE, not before the pick**, so (a) the granted item is already in `limits`/tray when it sizes the next round — a picked Limit applies immediately, no deltas — and (b) `roundContributions` is still live for the breakdown. `survivalDealNext` recycles the board to the deck (`survivalRecycleBoard`) and deals fresh; it also clears `gameTimerPaused` (the dance froze it). The post-boss BONUS pick reuses the same path with `survivalBonusPick` → `survivalSkipCarryover` (no score carry / no time-coins).
- **Contributions breakdown on the pick (📊).** Survival skips the payout, so the payout's Contributions view is surfaced on the pick (`survivalToggleContrib` → `roundContributionRowsHTML`, read live). `captureRoundContrib` now also emits the **base hand-type mult** row (calcScore seeds `mult` at `HAND_BASE[hand].mult`), and `roundContributionRowsHTML` adds an **Effects** group with **Replays** (`replaysThisRound`) and **Time manipulation** (`timeManipRound` + pauses + rewinds) shown ONLY when non-zero. These accumulators are additive/shared (all modes' payout benefits) — bumped in `play-hand.js`, reset in `level-up.js`.
- **On-demand shop.** A `.survival-shop-btn` next to the coins chip (both the top-bar `#coins-shop-btn` and landscape `#ci-shop-btn`, shown only via the `.sv-on` class in survival) opens the **standard shop** any time for 5 coins (`survivalOpenShop` → `triggerShop`; the shop-close handler's `else` branch resumes the round).
- **Bosses every 5 MINUTES of play, no challenges (r155).** `survivalTickBossClock()` runs off the round tick — so it counts *live* play time only (picks, shop and menus are paused) — and sets `survivalBossPending` when `SURVIVAL_BOSS_EVERY_SECONDS` (300) elapses. The next `survivalDealNext` deals the board then calls `survivalTriggerBoss()` instead of `startRoundTimer`. The boss clock = the **banked leftover time** (`survivalBossTimeBank`, capped 180, floored 30) — `triggerBoss(preset, windowSeconds)` takes an explicit window (`bossWindowDuration`). The objective is checked in `playHand`. `endBoss` has a `survivalActive()` branch: **win** → `survivalPostBossReward()` → **loss** → `onGameEnd`. Challenges never fire (reward-grid/act-driven).
- **The run ENDS after 5 bosses (r155).** `survivalPostBossReward` opens `showSurvivalCompleteScreen()` on the 5th kill: **RETIRE** (→ `onGameWin`) or **CONTINUE — ENDLESS**, which sets `survivalEndless` + `survivalEndlessFromLevel = level` so goals past that point grow **65% faster** (`SURVIVAL_ENDLESS_ACCEL`: Classic's +35%/level → +57.75%/level). Levels before the switch keep the normal curve, so the jump isn't retroactive.
- **Goal curve:** `survivalGoalForLevel()` — base **750** (`SURVIVAL_BASE_GOAL`), same ×1.35 growth, rounded to **50** (Classic rounds to 500, which would snap 750 → 1000). Curve: 750 · 1000 · 1350 · 1850 · 2500 …
- **Rerolls are a CARRY-OVER POOL, not per-level:** 3 at run start (`SURVIVAL_REROLLS_START`), **+2 per boss beaten**, unspent ones roll forward. Once the pool is empty rerolls fall back to the escalating 5/10/15 price within that pick.
- **Reward-grid-only entities are filtered out** (`SURVIVAL_BANNED_ENTITIES` = `greedy_boi`, `more_better`, `rain_check`) from both the survival pick pools and the Mart stock — survival has no reward grid, so they'd be dead picks.
- **Shop entry moved onto the PICK screen** (`#sv-pick-shop`, "entry fee 5 💰"). Opening it from there sets `survivalShopFromPick`, which makes `closeMart` return to the still-open pick instead of restarting the round timer.

## The Mart (off-grid shop) — `js/mart-shop.js` + `js/wheel.js` + `css/mart.css`
`USE_MART_SHOP` routes `triggerShop()` to the LETHE Mart: left **loadout** column (Knacks / Sleights / Tricks / Limits panels + Stats·Deck·Time chips) · centre **catalog** (3 of 4 categories, Tricks always featured, plus Spotlight/Spin/Freezer specials) · right **checkout**.
- **Bundle discount:** `martDiscountRate()` (BAL.shop_discount, 5% — doubled by the **Bulk Buyer** knack) × per ADDITIONAL item, capped at `rate × Selection Size`. So 2 items = 5%, 3 = 10%, cap 15% at run start.
- **Checkout** flies each bought item to its loadout panel one at a time (`flyMartTile`), firing `buy()` on landing. The flyer is a body-level clone because `renderMart()` rebuilds the catalog.
- **Spin the Wheel** (`js/wheel.js`, `BAL.wheel.cost`): 10 spaces (BUST + JACKPOT + entities at shop rarity odds), **drag to spin** — release velocity sets the throw, with a floor guaranteeing ≥1 full turn and a random force so it can't be aimed. **No exit while spinning or before the prize resolves.** If a prize doesn't fit (Tricks vs `trick_slots`), an overflow prompt offers sell-a-Trick or sell-the-prize (`BAL.wheel.default_sell` = 15 unless the type has its own sell value).

**Known wart:** `trickSellValue` is defined TWICE — `js/shop.js` (×0.5) and `js/shop-grid-preview.js` (×0.6). Same global scope, so the later load wins and the effective sell fraction is 0.6, not the 0.5 that shop.js documents. Worth reconciling.

## Seeded runs (`js/seed.js`, r145)

`applyRunSeed(seed)` **replaces the global `Math.random`** with a mulberry32 stream for the duration of a run. The game makes ~135 bare `Math.random()` calls across 24 files; this seeds every one of them without touching a single call site. Seeds are human-typeable strings, FNV-1a hashed (`LETHE-4F2A`). Called from `startGame` — the single point where a run's randomness is established, before any deck is built. A mode may pin one (`ACTIVE_MODE.seed`; the tutorial does) and the dev panel's **Run Seed** group sets one for the next run.

- **Cosmetic randomness must use `fxRandom()`**, which is always the real unseeded generator. This is not stylistic: a seeded stream only reproduces if draws happen in the same ORDER, and animation code draws on rAF/timer callbacks whose timing depends on frame rate, tab focus and click speed. Leaving those on the seeded stream would shuffle the gameplay draws behind them. Already converted: `score-dance` (particles, noise, tick chance), `audio` (noise buffer), `channel-change` (CRT static), `float-anim` (tile phases). **Any new animation code should call `fxRandom()`.**
### Split streams (r147) — what a seed actually pins

One shared stream pins the OPENING deal (the deck is shuffled right after the seed is installed, before the player can act) but nothing later: every draw comes off one sequence in call order, so a single extra discard shifts everything after it. So each domain now gets **its own generator**, via `withSeededRng(fn, ...key)`:

| domain | key | wrapped at |
|---|---|---|
| deck | `'deck'` (continuing) | `deckShuffle()` in `deck-grid.js`; also the drawPile reshuffles in `events.js` / `shop.js`, and the Famine draw-swap |
| reward grid | `'reward', rewardVisitIndex` | `generateRewardContent()` |
| Mart | `'shop', shopVisitIndex, martRerollN` | `buildMartStock()` |
| legacy shop | `'shop', shopVisitIndex, 0` | `generateShopItems()` |

A key containing a **number is positional**: it builds a fresh generator at that position instead of continuing a cursor. That is what makes "reward grid #3 on seed X" the same grid no matter how the player got there. `deck` is deliberately continuing (a reshuffle must follow from the previous state) but is now isolated, so a Trick proc or boss roll can't perturb the draw order.

Two traps this encodes:
- **`shuffle()` itself is NOT deck-bound.** It's also used to pick Trick options, shop rows and challenge columns; binding it to the deck would let those advance the deck order. Only the real deck operations are wrapped — hence `deckShuffle()` existing alongside it.
- **A Mart reroll must not advance `shopVisitIndex`**, or how many times you rerolled shop #1 would change what shop #2 stocks. The reroll count is part of the key instead.

Anything not wrapped still falls through to the shared global stream, so nothing regressed and unseeded play is untouched.

- **It is still a seed, not a replay.** The pinned domains hold regardless of play, but anything downstream of a player *decision* (which Trick you took, so which Tricks remain in the pool) naturally differs. Enough for sharing a run, reproducing a bug, and pinning a tutorial's opening deal.

## Limits tile (▲ Limits, r145)

Fifth button in the play screen's secondary row; opens a `.time-popup` listing every `LIMITS_DEF` entry with current value and ceiling (maxed ones highlighted). Built from `LIMITS_DEF`, so adding a limit needs no UI work. The landscape row divides the same 1.56%→39.3% span into five 6.83% slots.

**Both interaction pop-ups (`#interact-costs`, `#limits-popup`) live OUTSIDE `#cabinet`** — they are `position: fixed` and placed from JS in raw viewport px, and inside the stage the CSS `zoom` multiplied those coordinates. That is what had been putting the ⏱ Time pop-up off the bottom of the screen. Same class of bug as the dev panel; same fix.

## Orientation / tutorial mode (`js/tutorial.js` + `css/tutorial.css`, r146)

A guided first run listed **first** in the mode carousel. `MODES.tutorial` sets `actStructure: true`, so it is an **ordinary Classic run** — real rounds, real payout, real reward grid, real Mart. The board is a normal random deal; the deck is not stacked. Voice is **LETHE Corp staff orientation**: flat, procedural, no mascot. 25 steps, ~3 minutes, abandonable at any point.

- **Polled state machine, not events.** Each step declares `when` (hold it back until true) and `until` (auto-advance when true) as predicates over globals that already exist (`selected`, `handsPlayed`, `goalReachedThisRound`, `rewardSelected`, `martActive`…). One rAF loop evaluates them. **This is why the tutorial needs almost no engine hooks** — outside `js/tutorial.js` the whole footprint is the `MODES` entry, one call at the end of `startGame()`, the auto-submit guard in `input.js`, and one call in `generateRewardContent`. Adding or reordering steps means editing `TUTORIAL_STEPS` and nothing else.
- **One dim, N holes, and gating are the same mechanism.** `#tut-dim` is a single full-screen element whose `clip-path: path(evenodd, …)` cuts a hole per anchor. A clipped-away region is **not hit-testable**, so the holes pass clicks through and the rest of the dim swallows them — `pointer-events` on the dim is the entire gate. That is what lets a step expose exactly three specific reward tiles. `.tut-ring` elements are inert outlines over each hole (a clip-path can't do radius or glow).
- **The layer lives OUTSIDE `#stage`**, same reason as the dev panel and the pop-ups: CSS `zoom`.
- **`tutEl()` tests visibility by RECT ALONE.** The obvious `offsetParent !== null` check is wrong twice here — it is null for any `position: fixed` element (the Limits pop-up, the Mart's panels) and it passes `display: contents` wrappers that have no box (`#score-panel`, `#hand-preview-area`, `#action-col` in landscape). A zero-size rect catches both.
- **No stacked deck — the board is AUDITED and re-dealt instead (r148).** `tutorialQualifyBoard()` checks the opening deal against everything the lesson needs — at least 3 distinct playable hands, at least one 3-card hand, at least one dead card, and at least one adjacent exchange that *creates* a hand — and calls `initGridData()` again if it falls short. Re-dealing runs off the seeded deck stream, so "attempt 3 of seed X" is still the same board every time and the deck stays a real 52-card deck. Measured over 12 seeds: 0 failures, ≤18ms, usually first try.
- **What counts as a "clean" hand, and why the obvious test is wrong.** `findBestHand(cells).handCells.length === cells.length` does NOT mean every card is load-bearing: `detectHand` calls `{5♣ 7♠ 7♥}` a Pair, so the 5♣ sits inside `handCells` contributing nothing to the hand type. `_tutHandIsClean` instead asks whether dropping any ONE card changes what the hand is — `{7♠ 7♥ 5♣}` is still a Pair without the 5♣, so the 5♣ is padding; `{7♠ 7♥ 7♦}` degrades to a Pair whichever card you drop, so all three are load-bearing. Deriving it this way needs no hand-size table to keep in sync. A card whose removal would DISCONNECT the shape is skipped — it is a required connector and its pips still score.
- **Swap and discard are taught hands-on.** The `swap` step highlights an adjacent pair whose exchange creates a hand that isn't on the board (`tutorialFindSwap`, which simulates each pair against live `gridData` and restores it); the `discard` step highlights cards in no hand at all (`tutorialFindDeadCards`). Both are gated and recompute their plan in `onEnter`, because the first hand has already changed the board since the deal-time audit; if the live board offers nothing, the anchor falls back to the whole grid and the step still asks for the action.
- **Only two things are pinned:** the run is seeded (`LETHE-INDUCTION`), and the **first** reward grid is scripted by `tutorialScriptRewardGrid` into a Trick → liability → Mart row at `[0,0] [0,1] [0,2]`. That works with the existing layout rather than against it: the checkerboard already alternates buff/debuff by `(r+c)` parity, so those three cells are exactly buff/debuff/buff. Three gated steps then make the player walk that path, which is how the "you take everything on the path" rule is taught. Later grids generate normally.
- **Timing gotchas the steps encode:** the scoring dance runs ~6s (the step after PLAY waits on `tutIdle()` and stays hidden, so the count-up is undimmed); the payout panel counts up for ~6s (its step waits for `#po-valued.show`, not for the overlay to exist); reward tiles deal in with `rewardDealing` gating clicks; and the Mart's markup **exists while collapsed to zero size** mid-channel-change, so `tutMartReady()` tests with `tutEl`, not `getElementById`. Anchors that vanish for a frame keep their last holes (`_tutLastHoles`) so the bubble can't snap to centre and back.
- **Anti-stall:** a step whose `when` never flips shows anyway after `whenTimeoutMs` (20s), so a stalled predicate can't leave the orientation silently dead.
- `tutorialHoldClock()` only releases a pause **it** took (`_tutClockHeld`), so the reward grid and Mart keep ownership of `gameTimerPaused` during their own steps.

## RECORDS hub (`js/records.js` + `css/records.css`, r155)

The four secondary chips (Stats · Deck · Time · Limits) were **merged into one chip** — `#btn-records` — that opens a large tabbed pop-up and **pauses the round** (`pauseGame(false)`, skipped when `screenOwnsClock()`). Tabs: **Deck · Personnel File · Limits · Time · Performance**, each one entry in `RECORDS_TABS` (adding a tab is a single line). Lives **outside `#stage`** (body-level) for the usual cabinet-`zoom` reason.

- **Deck tab is a real read-out now.** The old chip list was near-useless; this is a **rank × suit matrix** — every card in the deck coloured by where it is (draw pile / on board / played), dotted when it carries permanent pips or mult — plus summary tiles and a **"still drawable by rank"** bar chart, which is the actual planning question. Sleights are listed separately with charges.
- **Personnel File** shows every owned Trick / Sleight / Knack with its description **expanded by default** (Tricks via `trickLiveDesc`, so scaling values read true), reviewable while the clock is held.
- Three things pointed at the removed buttons and were repointed to `#btn-records`: the card-fall target in `card-fall.js`, `rewardTargetEl('deck')` in `reward-grid.js`, and the tutorial's Limits step (which now opens Records on the Limits tab). `showStats()` / `showDeck()` and the Time/Limits pop-ups are **kept** — the dev panel and Mart still use them.
- Landscape CSS: the `1.56%→39.3%` span is now **2 slots** (Records + Pause) instead of 5.

## Settings (`js/settings.js` + `css/settings.css`, r155)

The player-facing options screen, distinct from the dev panel (which stays the debug surface). Reached from the main menu's SETTINGS button and the pause menu. **Every option is one entry in `SETTINGS_DEF`** — `{ group, id, label, hint, type: 'toggle'|'slider'|'select', default, apply(v) }` — so adding one is a single line. Values persist in `localStorage` (`lethe.settings.v1`) and re-apply on load.

- Audio (mute, master volume) works by `playTone`/`playNoise` multiplying their gain by `sfxVolume()`; motion and display options toggle body classes (`reduced-motion`, `no-shake`, `big-text`, `high-contrast`) that `css/settings.css` acts on.
- **Trap encoded:** `openSettings` must call `settingsOverlay()` (which creates the panel) *before* `renderSettings()`, or the first open renders into a `#settings-body` that does not exist yet.

## Browser storage — `js/storage.js` (r155)

**Loads before every other script, and must stay there.** Some browsers do not return `null` from `localStorage`, they **throw on first access**: Safari private browsing, "block site data" settings, and a **cross-site sandboxed iframe — which is how itch.io embeds an HTML5 game**.

That mattered because ~12 files read storage *at load time, at the top level, outside any try/catch* (`let devMode = localStorage.getItem(...)`). A throw there **aborts the rest of that file**. Measured with storage blocked: 8 files died partway through, `bossInterval` / `BOSS_LOOP_DURATION` / `devMode` were never defined, the menu drew perfectly, and pressing PLAY threw — the game looked healthy right up until it wouldn't start.

The shim swaps in a same-shaped in-memory stand-in when the real thing is unusable, so settings last the session but not beyond it. **Every existing `localStorage` call site works untouched — don't wrap them.** Two traps it encodes: the probe must actually WRITE (Safari private mode *has* a localStorage object and throws on `setItem`), and reading `window.localStorage` is itself guarded because that access is what throws in a blocked iframe. `window.LETHE_STORAGE_OK` reports which mode is live.

## Save & resume — `js/save.js` (r155)

Settings → **Save Run** writes the run to storage; **CONTINUE** on the main menu resumes it. Two decisions shape the whole file:

- **The save point is the START OF A ROUND, not "wherever you are".** `captureRunCheckpoint()` is called from `startRoundTimer()` — the one call site every round start funnels through — and SAVE writes that snapshot out. So the player can save at any moment and what lands on disk is a clean board with a full clock: no half-selected hand, no animation in flight, no scoring dance to resume. **Resuming replays the current round from its start.** Serialising a live mid-round would mean capturing timers, the dance, boss schedules and in-flight fall animations for very little gain.
- **Restore reuses `startGame()` as its baseline.** A run touches ~130 globals; if restore only assigned the manifest, anything missed would keep the value left over from the PREVIOUS run in the tab. Resume calls `startGame()` first (every global to a known-clean run) then lays the snapshot on top — **a variable missing from `SAVE_VARS` costs that one value, not a corrupt hybrid of two runs.**

**Why indirect eval:** the game's globals are top-level `let`, which — unlike `var` — do **NOT** become properties of `window`. `window['score']` is `undefined` even though `score` is a perfectly good global (verified). Indirect eval (`geval`) runs in global scope and sees the global lexical environment, which is what lets one 130-name manifest replace 260 hand-written assignments that would silently rot. `limits` and `C` are `const`, so their **contents** are copied (`SAVE_MUTATE`) rather than reassigned.

Sets get an explicit tag on serialise (JSON turns a Set into `{}`) — they're everywhere here: `activeHands`, `blockedCells`, `grantedSleightIds`, `rewardSelected`. No entity in any pool carries a function, so tricks/knacks/sleights survive the JSON round-trip intact. The **seed is saved and re-pinned** on resume so reward grids and shops keep following the same sequence. A finished run clears its save, but only when the save belongs to the run that ended (matched on `gameStartTime` — a player may have saved run A, started run B and died in B).

**Adding run state?** Add the variable name to `SAVE_VARS` or it won't survive a save.

## Run history — `js/history.js` + `css/history.css` (r159)

A log of FINISHED runs, written once when a run ends and read from the main menu's **HISTORY** button. Deliberately separate from `js/save.js`: a **save** is a resumable snapshot of a run in progress (~130 globals); a **history entry** is a few hundred bytes of "what happened", so `HISTORY_MAX` (100) of them fit where a single save would strain.

- **Two write sites only** — `onGameWin` and `onGameEnd`, the two places a run can finish. A mode that ends some other way records nothing rather than recording something wrong.
- **Double-log guard:** the entry is keyed on `gameStartTime`, and a second end call for the same run is ignored (the end overlay can fire more than once).
- **`score` is the round in progress, `totalScore` is the rounds already banked** — an entry stores the sum, or it would under-report the final round.
- The menu button is **hidden until there is something to show**, so a first-time player isn't offered an empty screen; its label carries the count.
- Body-level, outside `#cabinet`, for the usual `zoom` reason.

## Portrait shared strip — `js/portrait-panel.js` (r156)

Portrait has one narrow strip (`#trick-panel`) for three things that all want room. Landscape anchors each in its own box; portrait can't, so **all three — Tricks, Knacks and the hand preview — SHARE the whole strip** and `#panel-swap-btn` (small, top-right) cycles between them (`PORTRAIT_VIEWS`, r159). Tricks used to hold its own half; giving each view the full width is what lets the tiles and preview cards be drawn at **~70% of the strip's height** (owner's spec) instead of 50%.

Before this, **portrait had no hand preview at all**: `syncTrickTrayUI()` sets `#hand-preview-area { display:none }` *inline* whenever Tricks live in the tray (the default), and only landscape overrode it. The scoring dance renders into `#selected-cards` inside that hidden element — so in portrait the **entire dance ran in a 0×0 invisible box** (verified: `.dnc-active` set, children inside, zero size). `flyGridCardToSlot` bails to a plain reveal on a zero-width target, which is why portrait scoring looked like nothing happened.

- **The swap is a class on `#stage`** (`pv-knacks` / `pv-preview`) and the CSS carries `!important` because it must beat that inline `display:none`.
- **Every portrait rule is scoped `#stage:not(.landscape)`.** That's deliberate: the block stops matching the moment `.landscape` is on, so there's no specificity race with the landscape layout. **Follow this pattern for new portrait CSS.**
- **`portraitDanceBegin/End`** (wired into `playPreviewDance` and both its abort and normal-completion paths) auto-swap to the preview for the dance, then restore **whatever was actually showing** (`_pvBeforeDance`), not the last manual pick — a Knack granted just before the hand surfaces Knacks, and bouncing to Tricks afterwards reads as a glitch. An auto-swap still never overwrites `portraitPanelUserView`.
- **`.dnc-track`'s 8px vertical padding is trimmed in portrait.** At 70% card height a 5-card hand's dance stage came within 2px of the strip's edge; trimming the padding keeps the card size and buys the headroom (measured 73px → 58px in a 75px strip).
- **Gaining a Knack flips to Knacks, gaining a Trick flips to Tricks**, hooked on the count inside `updateKnackList()` / `renderTrickTray()` rather than the many separate grant sites, so a future grant path gets it free. **That call re-enters `updateKnackList`** (to re-measure the marquee), so the tally is updated *before* the flip and `_pvRemeasuring` guards the re-entry — get that order wrong and it recurses forever.
- **`.trick-card` is the GRID tile** (`position:absolute`, `width:var(--card-w,57px)`) and is defined later in the stylesheet than `.trick-tray-chip`, so it won for portrait tray chips: every Trick stacked absolutely at the tray's origin with one grid-sized card hanging outside the panel. Landscape already re-flows them; portrait now has its own smaller version. Rarity colours (`--rc`) were also landscape-only and are now assigned for portrait too.
- Chip rows use `applyChipMarquee`, which measures `clientWidth` — **a row rendered while its half is hidden measures 0 and never gets its auto-scroll**, hence the re-measure on swap.

## Score panel & the PMF merge (r157)

**Two separate changes — note which applies where.** The LAYOUT change is **portrait only** (owner's call); the MERGE ANIMATION runs in **both orientations**.

### Portrait score panel layout
`#score-panel-inner` is re-laid as a 2×2 grid: **PIPS·MULT·FOCUS take the left 50% at full height**, and **SCORE sits directly above GOAL** in the right 50%, separated by a **hairline** (`border-top` on `#score-left`) rather than by two panel edges. Score and goal keep their existing type sizes (24px / 18px) — the room comes from the split, not from shrinking them. Scoped `#stage:not(.landscape)` because landscape sets `display:contents !important` on the same element and positions the three children absolutely. **Landscape keeps its original three-box arrangement, verified unchanged to the pixel.**

### The PMF merge — `js/pmf-merge.js`
Once all three chips have landed on their totals they stop being three numbers and become one: the score this hand made. The three chips **jitter**, slide sideways into each other and **fuse into a single chip reading the hand's score**; the main SCORE total then climbs by that amount; then the chip **splits back** into three.

- **Where it sits in the dance:** `playPreviewDance` → card beats → pips/mult reconciled to totals → FOCUS beat → **[MERGE]** → SCORE climb → **[SPLIT]** → settle. It goes *after* the Focus beat deliberately, so the fused number matches what all three chips just showed.
- **It measures, it does not assume.** `--pmf-dx` (how far each chip travels to the row's centre) is computed live per chip, which is why one implementation covers both the landscape row and the portrait half-panel with no per-orientation branch.
- **`--pmf-dur` is set per phase** so the merge keeps pace with a fast-forwarded dance (`dncFF` → 15×) instead of dragging behind it.
- **A pop animation is cleared before merging** — `subbox-pop` is a CSS *animation* and would beat the merge *transition* on the same property.
- **Every abort path calls `pmfResetNow()`** (wired in `handleDanceAbort`). An interrupted hand must never leave the row fused, or the next hand writes its numbers into chips the player cannot see. Verified by chaining hands mid-fuse.
- **`_pmfVisible()` refuses to merge when the chips aren't there** — on grid-takeover screens (Rewards / Shop / Event) `.score-subbox` is `display:none` and `#screen-location` shows instead, so a merge would fuse three invisible boxes.
- **`#score-subboxes` needs to be a containing block** for the fused chip, so it gets `position:relative` — but only where it is static. Landscape positions it absolutely and `relative` would break that, hence the explicit `#stage.landscape #score-subboxes { position:absolute; }` restatement.
- **The legacy `playScoreDance`** (the dev-only `newDance` = off path) is deliberately NOT wired: it runs its focus beat and score ticker on overlapping timers rather than in sequence, so there is no single point where "all three have landed" is true. Every mode that populates these chips uses the preview dance.
- **Match-3 and Dominoes never populate PMF at all** (they call `calcScore` and `updateScoreUI` directly, never `playHand`), so there is nothing to fuse there.


## Dev panel / Settings
`#dev-panel` is **both** the in-game dev panel (🛠 button) and the main menu's **Settings** screen (`openSettingsFromMenu`); the title bar swaps between `DEV MODE` and `SETTINGS`. As of **r117** it's a centred, bounded arcade pop-up (`css/dev-overlays.css`) rather than a full-screen sheet: sticky gold title bar, internally-scrolling `#dev-panel-body`, and a backdrop dim made by a `0 0 0 100vmax` box-shadow spread so no extra wrapper element is needed. **It lives OUTSIDE `#stage` in `index.html`** (a sibling of `#main-menu-overlay`) — inside the stage it inherited the cabinet's CSS `zoom`, which scaled its `vh` sizing by ~1.3× and pushed it off-screen.

**As of r139 it opens on a MENU OF GROUPS, not one long scroll.** `#dev-group-menu` tiles 14 groups (Tricks · Sleights · Knacks · Limits · Events · Bosses · Animation · Focus · Time · Coins · Score · HUD · Match-3 · Event Log); picking one opens `#dev-group-pop` showing only the `.dev-section`s whose `data-group` matches. **The sections are never moved or rebuilt** — every id survives, because a lot of code binds to them (`dev-trick-list`, `dev-focus-decay-slider`, …); `devOpenGroup` only toggles `display`. To add a group: give your `.dev-section` a `data-group`, add a row to `DEV_GROUPS`.

Boss and Event buttons are **generated** from `BOSS_PRESETS` / `EVENT_META` (`devRenderBosses` / `devRenderEvents`) rather than hand-written, so new content can't go missing — this is how `the_hollow` was found to have been absent.

🛠 button (bottom-right). Add Tricks / knacks / sleights by name, trigger any event/boss, adjust time/coins/score/limits, open reward grid. HUD section also has scoring-dance toggles (new dance on/off, interrupt mode). **Animation** group has the item-float, heartbeat and channel-change tuners. Invaluable for testing.

## Conventions
- Match surrounding code style (terse, inline, lots of single-line helpers).
- Animation gating: `animating` / `falling` / `pendingAction` flags block input mid-animation.
- When a mechanic is complex/ambiguous, implement a simplified version and tag it `TBD` in a comment + the item's `desc`/`needsResolve`.
