# TheGame - Roguelike Poker

A browser-based HTML/JS roguelike poker game. **No build step, no framework, no dependencies** - plain files loaded directly. Open `index.html` in a browser and it runs.

- **Live site:** https://noflukeluke.github.io/TheGame/ (GitHub Pages, auto-deploys from `main`)
- **Owner:** non-technical developer - explain changes plainly, avoid jargon dumps.
- **VOICE (r178): plain and direct, in game text and in code.** The in-world corporate framing (associates, quotas, supervisor reviews, remittance advice, "LETHE CORP · RECORDS") is gone from every player-facing surface: say what a thing does and what it costs, in the fewest words that stay accurate. The RECORDS tab formerly called "Personnel File" is now **Owned**. **No em dashes anywhere**, prose or comments; a lone em dash used as an empty placeholder is a middot instead.
- **Pop-ups are capped to the viewport.** `.time-popup` (Time, Limits, hand log) and `#knack-tooltip` carry `max-width: calc(100vw - 20px)` / `max-height: calc(100vh - 20px)` with `overflow-y:auto`. They are placed from JS in raw viewport pixels, so without the cap a longer list runs off the bottom of a phone with no way to reach it. Verified at 375x667 and 360x640: nothing paints outside the viewport and nothing is clipped without a scroll.
- **Platform focus - DESKTOP FIRST (landscape).** New features, layout work, and polish target the **desktop / landscape** experience (the `#stage.landscape` layout). Portrait / mobile is **deprioritized** - it still runs, but don't spend effort on it or block desktop work to keep it pixel-perfect. (Exception: r156 reworked the portrait strip on purpose, as groundwork for local co-op - see "Portrait shared strip" below. Desktop is still the default target.) When a change could affect both, get it right on desktop; only touch portrait if explicitly asked. (Scope layout/visual CSS under `#stage.landscape` so portrait is left as-is.)
- **LETHE reskin (this branch):** the whole game is wrapped in an `#cabinet` div - a retro-futuristic 80s arcade-cabinet shell (marquee, CRT screen bezel, deck/vents) around `#stage`. Its look lives in `css/style.css`; the wrapper markup is in `index.html`. Gameplay is unchanged from `main` r95 (this branch = r95 logic + the reskin).

## File layout (read this first - it saves you from loading the whole game)

The game **used to be one giant `index.html`**. It's now split into many small files so you only have to read (and re-send to Claude) the one part you're working on. **`index.html` is just the skeleton** - page markup plus the ordered `<link>`/`<script>` tags that pull everything else in.

- `index.html` - HTML markup + ordered `<script src>` / `<link>` tags. ~700 lines.
- `css/style.css` - all the main game styling, including the LETHE cabinet shell (the big stylesheet).
- `css/dance.css` - the score-“dance” / hand-preview animation styles.
- `css/dev-overlays.css` - dev-panel + event-overlay styling.
- `js/` - the game code, one file per system (list below).
- `TERMINOLOGY.md` - **the index of what things are CALLED.** Read it before renaming anything the player sees. The governing rule: code ids are frozen, only display strings change, and every tier/category word is spelled out in `js/labels.js` and nowhere else.
- `OPEN_DECISIONS.md` - **the balance-audit backlog: measured findings left for the owner to decide on.** Over-tuned rares, under-tuned legendaries, the rare/epic tier inversion, and how to reproduce the measurement. Read it before any balance pass.
- `js/entity-tile.js` - **`entityTileInner` / `entityTileHTML` (r182): the ONE way an entity is drawn.** See "One entity tile" below - change a Trick's look here and the reward grid, the Mart shelf, the cart, the loadout strip, your tray and the Shift Change event all move together.
- `js/fit-text.js` - `fitEntityName`. Shrinks an entity name until it fits, **never breaking a word** (r182).
- `js/dance-clock.js` - **the scoring dance's own clock (r218).** Pausable waits, a WAAPI animation registry, and the per-tick acceleration. See "The dance clock" below.
- `js/events-upgrade.js` / `js/events-slots.js` - the r218 events. Registered in `js/events-core.js` like every other event.
- `js/storage.js` - **loads FIRST**, before every other script. A safety shim for browser storage (see below). Nothing else may be moved above it.
- `js/data/` - **the "entities": pure content/data, no logic.** Edit these to tune or add game content without touching engine code:
  - `cards.js` - suits, ranks, rank order, `HAND_BASE` values, round/goal durations, `cardCan`, **and the Spectrum colour deck** (`COLORS` / `RANKS_NUMERIC` / `ACTIVE_RANKS`).
  - `tricks.js` - `TRICK_POOL`, `TRICK_CATEGORIES`, trick emoji.
  - `knacks.js` - `KNACK_POOL` (+ the `C` color palette const).
  - `sleights.js` - `SLEIGHT_POOL`.
  - `bosses.js` - `BOSS_PRESETS`.
  - `balance.js` - `BAL` (the big tuning table) + `DESC_TEMPLATES`.

**Animation drivers (r139–r141) - all three publish CSS custom properties rather than writing `el.style.transform`.** That is deliberate: the tiles/cards they animate already use `transform` for hover, `.selected`, fly-outs and keyframes, so the driver hands CSS a value and the element composes it. Precedence falls out correctly - an inline transform (discard fly-out) and an `!important` one (`.card.removing`) both beat the stylesheet declaration, and keyframe animations beat it too.
  - `js/float-anim.js` - `FLOAT_CFG` + `startFloat/stopFloat`. The barely-there drift on **shop AND reward-grid** tiles (x±1.5 · y±2.5 · rot±0.5° · 6s). Publishes `--fx/--fy/--fr/--fs`. Seeds cache by `data-float-key` so a re-render doesn't re-roll the phase.
  - `js/heartbeat.js` - `HB_CFG` + `startHeartbeat/stopHeartbeat`. **(r183)** A soft swell every **10s** that **falls from the TOP row** and travels down the board (`delay = r * rowStagger + colDist(c) * colStagger`; rowStagger 120ms is what makes it fall, colStagger 26ms only leans the front). Publishes `--hbx/--hby/--hbr/--hbs`. Runs with the round (`startRoundTimer`/`stopTimers`). It also drives the clock: the frame a new wave starts it calls `pulseClockWithWave()` (js/clock-fx.js), so the board and the timer share one beat. Its saved config key is **`hbCfg3`** - bumped from `hbCfg2` with the rework, because a saved value beats a default and anyone who had nudged a slider would have kept the old left-edge wave forever.
  - `js/channel-change.js` - `channelChange(swapFn, opts)`. The CRT flick between screens (static / roll / collapse / RGB split); `swapFn` fires at the collapse, hidden in the flash. Wired into `openMart`/`closeMart`.
  - `js/clock-fx.js` + `css/clock-fx.css` **(r183)** - everything the round clock does to the board. Three effects, all published as CSS custom properties or throwaway clones, never `el.style.transform` on a live card:
    1. **The tick.** `pulseClockWithWave()`, called by the heartbeat when a wave starts: `#clock`/`#vclock` get `.clock-wave` for one gentle swell, and `sfxClockTick()` plays (deliberately at the very bottom of the mix - it fires six times a minute for a whole run).
    2. **The freeze.** `beginClockFreeze()` / `endClockFreeze()`, called from `pauseRound` and `startStopwatch` / their release points in `js/discard.js`. The clock gets `.clock-frozen-lit`, `sfxTickTock()` plays, and a ripple spreading out from the middle of the board sets `--frzr` on every card: **left half turns its left corner out (negative), right half its right corner out (positive), and an exact centre column alternates by row.** The heartbeat checks `clockFrozen` and holds its offsets, so the board genuinely stops. `reapplyClockFreeze()` is called at the end of `render()` so a card dealt in mid-freeze arrives in line; `resetClockFx()` is called from `stopTimers()` and the new-game reset.
    3. **The rewind.** `playRewindFX()`, called from `rewindTime()`: two translucent clones stepped a few px DOWN AND RIGHT of each card, like a dealt stack (`REWIND_STEP_X` / `REWIND_STEP_Y` - a FIXED pixel step, not a fraction of the card height: anything larger reaches the row below and the board reads as columns) plus `sfxRewind()`, a reversed envelope (silence → full, then cut) with an upward pitch sweep. Removing `.out` absorbs the copies back up into the original. `#grid.rewinding` lifts the real cards above the clones for the length of the effect.
  - **`--frzr` is composed into the card transform in `css/style.css`**, alongside the heartbeat's `--hb*` - `rotate(calc(var(--hbr,0deg) + var(--frzr,0deg)))`. Anything that sets an inline transform (the discard fly-out) or an `!important` one (`.card.removing`) still wins, which is the whole reason none of this is written to `el.style.transform`.
  All three animation drivers have live tuners in the dev panel under **Animation**, and standalone preview pages: `heartbeat-preview.html`, `channel-change-preview.html`, `shop-float-anim-preview.html`.

**`fx-preview.html` (r149) - scoring & economy feedback tuner.** Not yet wired into the game; it is the design surface for four FX families over a mock HUD: score pops (card/Trick → PIPS·MULT·SCORE), the time charge over the clock bar, Focus gains, and credits moving one coin at a time. Every family has a **"Current (today)"** preset measured from the live game (`.dnc-particle` = 15px × `DANCE_CFG.pScale` 2.6 = 39px Crimson Pro, `pFlight` 550ms), so any other preset is a visible delta rather than a guess. Contrast comes mainly from `-webkit-text-stroke` + `paint-order: stroke fill`, which paints the dark edge OUTSIDE the glyph so a light number stays legible on a cream card without losing weight. The page dumps a copy-paste `FX_CFG` block.

**How the split works (important - don't break this):** all `js/*.js` files are plain **classic scripts that share one global scope** - a `const`/`let`/`function` defined in one file is visible to all the others, exactly as if they were still one big `<script>`. **Load order is preserved and matters:** the `<script>` tags in `index.html` are in the same order the code originally ran, because several files run set-up code at load time (event bindings; `LIMITS_DEF.forEach`, `TRICK_CATEGORIES.forEach`, `applyBalDescriptions()`; and `js/bootstrap.js` at the very end, which calls `initMainMenu()`). If you add a new `.js` file, put its `<script>` tag in the right spot (data files load up top with the rest; `bootstrap.js` stays last). If you're not sure which file a function lives in, `grep -rn "functionName" js/`.

Rough guide to `js/` (engine): `labels` (tier + category words - see TERMINOLOGY.md) · `menu` `devlog` `grid-metrics` `focus-config` `limits` `combos-aim` (combo families + aim sleights) · `deck-grid` (deck + gridData + curses) · `hand-detect` (findBestHand/detectHand) · `scoring` (calcScore, exalt/corrupt, contributions) · `render` · `focus` (focus meter) · `hud` · `input` (tap/swap/select) · `play-hand` · `score-anims` / `score-dance` (the scoring “dance”) · `discard` · `card-fall` (renderCardAppearance + fall anim) · `round-timers` · `boss` · `reward-grid` · `limit-break` · `sleights-runtime` · `events-core` / `events` · `interlude` / `level-up` / `tricks-ui` · `shop` · `hands-meta` · `stats` · `deck-view` · `records` (the tabbed info hub) · `settings` (player options) · `game-control` (pause/resume/startGame) · `challenge` · `audio` · `dev-panel` · `save` (run save/resume) · `history` (finished-run log) · `portrait-panel` (portrait shared strip) · `pmf-merge` (the PIPS·MULT·FOCUS fuse) · `hand-log` (the SCORE-box hand record) · `boss-approach` (the pre-boss dread + score wipe) · `bootstrap` (runs last).

## Workflow

- **Branch:** `main` is the source of truth and auto-deploys to GitHub Pages - never commit directly to it. Develop on the `claude/*` feature branch this session was assigned. If none was given, branch off the latest main: `git checkout -b claude/<topic> origin/main`.
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
- `gridData[r][c]` - the grid; each cell is a card object, a special card, or `null`.
- `gridRows` / `gridCols` - grid dimensions (driven by `limits.grid_rows/grid_cols`).
- `drawPile` / `playedPile` - deck. Scored cards → `playedPile`, reshuffled into `drawPile` at round end via `flushPlayedDeck()`.
- `selected` - array of `[r,c]` currently selected.
- `score`, `coins`, `swaps`, `discards`, `roundSeconds`, `level`, `roundGoal`/`totalScore`.
- `limits` / `LIMITS_DEF` - upgradeable caps (grid size, round time, swaps, discards, reward grid size).
- `ACTIVE_MODE` - `.id === 'normal'` is the main 3-Act node mode; other modes are timer-based (legacy). `.match3` flags the auto-play Match-3 modes (see below); `.zen` is the no-clock variant of it.

### Layout / scaling - "one fixed canvas, scaled" (owner's explicit choice)
The stage (`#stage`, 420×740 portrait / 747×420 landscape) is a single fixed-size canvas scaled uniformly via CSS `zoom: var(--stage-zoom)`, like a scaled image - **not** a responsive/fluid reflow layout. Card sizing is computed by `recomputeGridMetrics()` from the REAL measured DOM slot (`measureGridSlot()` → `#grid-slot.getBoundingClientRect()` ÷ zoom), not guessed footprint constants - this is what fixed a nasty grid/button overlap regression. If you ever need to change layout, preserve this architecture; don't switch to fluid reflow.

**Desktop = landscape (the primary target).** JS adds `.landscape` to `#stage` when `availW > availH && availW >= 480`, switching on the **v7 landscape** layout - a set of `#stage.landscape` rules that absolutely-position each panel as a percentage of the 747×420 stage (see the big `#stage.landscape …` CSS block). This is where all current layout/visual work lives; **scope new layout CSS under `#stage.landscape`** so the (deprioritized) portrait layout is untouched. The portrait layout is the older stacked-flex version further up in the CSS.

**Desktop panel (left column), current arrangement (r87–r90):** top → bottom = SCORE/GOAL → PIPS·MULT·FOCUS chips → **Knacks** (icon row, no label) → **hand preview** (full-width `#selected-cards` frame with the hand name inside it on the left) → **Tricks** (card-shaped tiles, `n/5` count pinned bottom-right, no label) → time/coins → STATS/DECK/PAUSE. The hand preview renders the selected cards via **`renderCardAppearance()`** (the same builder the grid uses) scaled down by local `--card-w`/`--card-h` on `#selected-cards`, so preview cards mirror the grid exactly, bonus decorations and all.

### Card types (flags on the card object)
- **Normal card:** `{ rank, suit, _id }`.
- **Trick** (formerly *Bonus Card / BC*): `trick:{id,name,desc,tier}`. A scoring buff. **As of the trick redesign (r66+), Tricks do NOT live on the grid** - they sit in a persistent **side tray** (`trickTray[]`, rendered by `renderTrickTray()` into `#trick-tray-list`; `trickTrayMode` defaults to `true`, grid placement is a dev-only toggle). `hasTrick(id)` checks the tray in tray mode (falls back to scanning `gridData` only when grid placement is toggled on). `acquiredTricks[]` tracks ever-owned (for dedup via `ownsTrick`). **NOTE: Sleights (below), not Tricks, are the entities that physically live on the grid.**
- **Sleight** (formerly *Joker*): `_isSleight:true`, `sleightId`, `_usesLeft`. A deck card with conditional activations (see below).
- **Stone:** `_isStone:true` - inert obstacle.
- **Knack** (formerly *Totem*): NOT a card. Persistent rule-changer in `acquiredKnacks[]`, shown in HUD. `hasKnack(id)`.
- **Challenge card:** `challengeCard` / `challengeActive`, occupies a cell; `resolveChallenge(success)`.
- `cardCan(card, action)` gates what each type can do (`select`/`swap`/`discard`/`fall`/`render`).

### Card identity (r192) - `cardId(card)`, NOT `cardKey(rank, suit)`

**Every per-card thing is keyed by the CARD, not by its face.** Permanent pips and mult, the x-pips / x-mult / retrigger buffs, curses, and the play/swap/dealt counts all key off `cardId(card)` (`js/deck-grid.js`), which is that one physical card and nothing else.

It used to be `cardKey(rank, suit)`, i.e. by card TYPE, and the base game creates cards that share a type: **the shop's Duplicate service hands you a second 7 of spades, and a buff on either landed on both.** Verified before the change: duplicating 7♠ gave 2 cards, 1 key, and buffing "one" buffed both.

- **`cardKey(rank, suit)` still exists and still means the TYPE.** It is for enumerating the rank x suit grid, which is exactly one thing: the RECORDS deck matrix. **Nothing per-card may use it.** `grep -n "cardKey(" js/` should only ever show records plus the definition.
- **`DURABLE_CARD_FIELDS` + `recycleCard()` are the trap to remember.** A normal card is rebuilt from scratch every time it leaves the board (`discardToDrawPile` / `discardToPlayed`), so **anything not named in that list is destroyed on the way back into the deck**. `_id` heads it because without an id a card has no identity to key anything by. That rebuild is also why two things this file claimed already worked did not: the exalt/corrupt counters are documented as living "on the card object so they track the individual card and survive deck cycling", and Whetstone's `_whetMult` as being "on the card itself, so it survives deck cycling". Neither did. Both are in the list now.
- **`_cardIdCounter` is in `SAVE_VARS`.** It resets to 0 on page load; without saving it, a resumed run would reissue ids that restored cards already hold.
- **Target a card, never a face.** `everyDeckCard()` lists every real ordinary card wherever it is (grid, draw pile, played pile) and is what a curse, a blessing or a shop service picks from. Picking a random rank and a random suit (the old way) could name a card that is not in the deck at all, and hit every copy of it if it was. `resolveDeckCard(card)` re-resolves at apply time, because a reward tile picks its victim when the grid is BUILT and applies it when the tile is taken, and a card can leave the run in between (Monopoly eats one, the Spectrum tuner rebuilds the deck).
- **The shop's card services target by id.** They matched on `rank === X && suit === Y`, which with a duplicate in the deck was a live bug in its own right: **Remove filtered BOTH copies out of the pile** for one payment, and Change Suit re-suited every copy (and left them sharing an `_id`). Combine consumes exactly the two cards you picked.
- **The RECORDS deck matrix is a rank x suit view, so it aggregates.** `recordsDeckCensus()` returns a per-cell summary - how many cards wear that face, where the most present one is, and whether ANY of them is buffed or cursed - and a cell holding more than one card carries a small count badge.
- **Saves are v2.** A v1 save (keyed the old way) is still accepted and re-keyed on resume by `migrateCardKeysToIds()`: each old `rank-suit` entry is written onto every card with that face, which is exactly what the old save meant by it, so a resumed run loses nothing.

### Scoring (`calcScore(handName, cells)` + `playHand()`)
- **Per-round-from-zero (r74):** `score` resets to `0` at the start of every round and is checked only against that round's own `roundGoal` - there is no running lifetime total driving gameplay anymore (the old `cumulativeGoal`, which summed every round's target forever, is gone). A round ends the instant `score >= roundGoal`. `triggerLevelUp()` banks the just-finished round's `score` into `totalScore` (a display-only lifetime counter shown as "Total Score" on the win/game-over screens) before zeroing `score` for the new round. `roundGoal` itself is still computed the same way as before (`BASE_GOAL * GOAL_SCALE^(level-1)`, rounded to the nearest 500) - only what it's compared against changed, so the round-to-round difficulty curve is unchanged from before this rework, just finally displayed and gated correctly. This also fixed two latent bugs that depended on `roundGoal` being the real pass/fail bar: the `last_stand` Trick (`score < roundGoal` → ×2) used to go permanently dead after level ~4 because it was comparing the lifetime total to a single round's increment; and the Twin Path "Goal +15%" shadow debuff used to silently do nothing because it only mutated `roundGoal`, never the actual (`cumulativeGoal`-based) gate.
- `calcScore` returns the numeric score: base pips (level-scaled) + per-card pips + bonuses, × mult, × score-multipliers.
### Hand values (r178) - priced to measured difficulty

`HAND_BASE` and `HAND_FOCUS` were retuned against real board data rather than poker intuition. Hands here are built from **orthogonally connected cards on a small grid**, so the odds look nothing like a 5-card draw and the real work is visual. Measured over 1,200 fresh 4x4 deals with every hand active, the share of boards offering each shape somewhere:

| Pair | Two Pair | Flush of 3 | Run of 3 | Three of a Kind | Run of 4 | Flush of 4 | Straight | Full House | Flush | Four of a Kind | Straight Flush |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 100% | 95% | 85% | 73% | 60% | 48% | 45% | 34% | 21% | 17% | 2.3% | 0.3% |

**Flushes are the outlier and that is the whole point.** A suit match is a colour match, so the eye finds one without reading a single rank. Runs are the opposite: every rank has to be read and ordered. So the ladder is now **flushes cheapest per card at every length, runs dearest, sets in between**, which is a difficulty ordering about *spotting* the shape, not about poker rarity.

The old table had four inversions, all fixed:
- **Two Pair paid the same 40 as a Pair** for twice the cards, so it was strictly dominated and turned up as the best hand on 0.6% of boards. It is now 90, and shows up as best on 18%.
- **Flush of 3 outpaid Run of 3** (75 vs 60) despite being easier and more common.
- **Flush cost 5 cards and paid less than Flush of 4** at 4 cards.
- **Straight, at 5 cards and rarer, paid less than Flush of 4.**

**`BASE_GOAL` went 1000 -> 1200 (and `SURVIVAL_BASE_GOAL` 750 -> 900) as a direct consequence.** The retune moves value into the hands players actually make, which lifted the average best-available hand on a fresh board from **274 to 328**, about +20% (800 deals each way, scored through the real `calcScore`). Left alone, round 1 would have cleared in ~3.0 best hands instead of ~3.6, i.e. the whole game would have got easier as a side effect of fixing the price list. At 1200 the pace is ~3.7, which is where it was.

**`HAND_FORMULAS` in `js/stats.js` is now a Proxy over `HAND_BASE`**, not a written-out string table. The written one had already drifted: modes overwrite `HAND_BASE`, so it stated a payout Spectrum does not pay.

### The score ladder (r190) - where each multiplier lands, and why

`calcScore` runs in five steps and **which step an effect lands on decides whether the player can see it**:

```
1. base pips x 1.1^(level-1)   2. per-card loop   3. xPIPS / xMULT block
   -> s = totalPips * mult  ->  4. xSCORE  ->  5. x Focus
```

`lastCalcPips` / `lastCalcMult` (the PIPS and MULT chips, and everything the scoring dance shows) are written at the **end of step 3**. So a step-4 xSCORE changes the final number and **nothing on screen says why**.

- **r190 moved four Tricks out of step 4** for exactly that reason: Perfect Storm and Twenty-One became xPIPS, Last Stand and Extinction became xMULT. The arithmetic is identical - `s = totalPips * mult`, so xK score = xK pips = xK mult - so this was pure legibility, no balance change. Their `BAL` keys renamed `score_mult` -> `pip_mult` / `mult_mult`, and `DESC_TEMPLATES` with them.
- **THERE IS NO xSCORE STEP ANY MORE (r236).** This line used to list Echo, Legacy, Low and Behold, the boss Redaction and the dev grid Trick card as deliberate survivors. It had drifted even before r236: **Echo** is a per-card retrigger in the card loop, and **Legacy** became a xMULT in r193. r194 took Spot Check, and r236 took the last four - The Redaction, The Grind, Low and Behold and the dev grid Trick card. See "The last four xSCORE effects" below. **Do not add one**: anything that would go there is a xPIPS or a xMULT.
- **The pools are now 10 and 10.** Grep them, don't count descriptions - `perfect_storm` and `extinction` were miscounted for exactly that reason. `grep "totalPips = Math.round(totalPips \*" js/scoring.js` and the `mult` equivalent are the real inventory.
- **The r190 additions cover triggers nothing else read**: Rerun / Chorus (replay count, from `_reps` - sum minus card count is the extra iterations), Deep Breath (clock paused), Interest (credits held, capped), Portfolio (buffed cards on the grid, via `permPips`/`permMult` - which are keyed by card IDENTITY, so a buff on Spectrum white counts seven cards), Redline (Focus level).
- **Compound** (top tier) banks the round score every 45s on the round tick; the next scored hand pays the bank and it re-arms, so it compounds across a round. (This line used to say its payout lands at SCORE level; it is `mult += bonusMult_compound`, an ordinary additive mult, and has been for some time.)

### The scoring TIMELINE (r220) - every Trick pays out at its own moment

`calcScore` used to hand the dance a **set of totals** (`_cp`/`_cm`: what each Trick
was worth by the end). That is the right shape for the contributions tab and the
wrong one for an animation, which needs to know WHEN each thing happened and WHAT
KIND of thing it was. So the dance did the only thing it could: every contributing
Trick rattled from the first card beat, and the ones it could not attribute to a
card all fired in one lump at the end.

`calcScore` now also emits an **ordered event timeline** (`ledger.timeline`), and
`playPreviewDance` walks it. An entity is perfectly still until its own event
lands, then pops and throws its particle - on the card that triggered it, if a card
did. **Replaying the timeline reproduces `calcScore` exactly**: verified over 10,000
scored hands (400 boards x 25 hands, full 177-Trick trays, replays to 6x, curses,
enhancements, exalt/corrupt) with **0 mismatches**.

```js
{ id, source, op:'pip+'|'mult+'|'pip*'|'mult*', value, card, from, scope, rnd }
```

- **`op` distinguishes an ADD from a MULTIPLY, and that is the whole point.** A
  x mult used to report itself as a delta, so Double Bloom showed `+35` - a number
  that means nothing on its own and is wrong the instant anything else changes. It
  shows `x1.5` now and multiplies the MULT chip. **The contributions tab still gets
  the delta** (`bPipX`/`bMultX` write the delta to the ledger and the factor to the
  timeline - same call, two audiences), because "+240 pips" is what the player
  actually gained.
- **`card` is which beat it belongs to; `from` is which card it flies FROM.** Not
  the same question. A per-card x mult (a card enhancement) multiplies the WHOLE
  running mult, so it cannot fire inside a card's beat - the mult is smaller there -
  but the particle should still come off the buffed card.
- **`scope` is card vs hand for a MULTIPLY.** Inside a beat, every pip op lands on
  that card's own subtotal, exactly as `calcScore` builds `cp` per card and only
  then does `totalPips += cp`. That is what gives a card-scoped x pips something of
  its own to multiply. **Routing the adds straight to the hand total instead left
  the subtotal at zero and the multiply multiplied nothing** - measured at 171 pips
  on a hand worth 228.
- **`rnd` carries each site's rounding**, because the sites do not agree: a x pips
  rounds to a whole number, a x mult to one decimal, the card-scoped ones not at
  all. Without it the chip drifts a few hundredths and snaps at the end.

**Four traps this encodes, all found by measurement rather than reading:**
- **Retrigger bookkeeping must NOT emit** (`bPipQ`, the quiet ledger write). The
  dance shows a replay by REPEATING the card's whole beat, which re-adds those pips
  on its own. Emitting them too counted every retrigger twice - 5,682 mismatches.
- **A beat fires ALL AT ONCE, but its values are applied by ONE timer in emission
  order (r222).** A card and everything it triggered are one event, so they leave
  and land together - no stagger. The trap is that a particle used to apply its
  number in its OWN landing callback, and a beat launched together could not keep
  those in order two different ways: `dncFly` bumps the accel per particle, so
  each successive flight is SHORTER and they land in reverse; and even pinned to
  one duration they race, because `dncWait` polls on a 60ms tick rather than
  firing in registration order. Measured on a card carrying a x3 and a x2 - **466
  pips reversed, 512 racing, 416 correct**. So the values are decoupled from the
  particles: `fireEvent(..., defer)` RETURNS the apply function instead of wiring
  it to its own landing, every particle in the beat gets one shared duration, and
  a single `dncWait` applies them in order when they arrive.
- **A beat must also await its particles before banking the card's subtotal**, or
  the next step's x mult runs against a number that has not arrived. Measured: a x2
  landing ahead of a +9 finished on 13 mult, not 26.
- **The reconcile must read the LEDGER, not `lastCalcPips`/`lastCalcMult`.** Those
  are globals every `calcScore` overwrites, and plenty run mid-dance (`removeAndFall`
  repaints, `render()` calls `findBestHand`, `findBestHand` scores candidates), so
  the old reconcile could snap the chips to another hand's numbers - measured at 228
  on a hand worth 226. In dev mode a drift between the walk and the ledger now logs
  `[DANCE] timeline drift`: if the timeline stops describing the real arithmetic, a
  beat is lying to the player and a snap at that line is the only visible symptom.

**The per-card MULT sweeps moved INTO the card loop.** Heart/Jack/King-guard mult,
`permMult`, Old Growth and exalt/corrupt were post-loop `_wc(pred) x rate` sweeps -
the same sum, but a sweep cannot tell the dance which card earned it, so all of them
animated in the end lump. They are accumulated per card now (`_hdMult`, `_jmMult`,
`_kgMult`, `_pmMult`, `_ogMult`, `_ecMultAcc`/`_ecPipAcc`) and emitted where they
happen. Addition is order-free, so **the score is unchanged to the digit** - but
they must be emitted AFTER the Blight's rewind, because the sweeps they replace were
never Blight-suppressed.

**One deliberate score change: `permXMult` moved to the x mult block.** It sat
part-way up the additive mult list, so it multiplied the base mult and the few
bonuses above it and nothing below - Old Growth, the Sleight mults, every suit, rank
and shape bonus all added after it and escaped. A x1.5 card enhancement was worth
x1.5 of a small number and x1.0 of a big one, which is not what it says on the tin
and not how any other x mult behaves (r190: a x mult lands after everything
additive). It is a **buff to card enhancements**, and it is what makes the additive
mult region CONTIGUOUS - which is what lets a per-card mult Trick animate on its own
card without the running number drifting. Measured: **1,264 hands byte-identical**
with no enhancement in play; only hands scoring a x mult-enhanced card move, by
+6-14%.

**Two scoring paths had to be brought onto the timeline to close it:**
- **Row/col +2 mult per affected card never went through the ledger at all** - it is
  the one scoring bonus with no contribution row, which was invisible while the
  dance only showed totals. It emits an event now but is still NOT billed to
  `_cp`/`_cm`: adding a row would change what the contributions tab reports.
- **Layered hands and Amplifier are part of the BASE, not events.** Both add
  straight to `totalPips`/`mult` with no ledger call, so they are folded into
  `ledger.basePips`/`ledger.baseMult` and the dance seeds its chips from THOSE, not
  from the primary hand's ladder alone.

**Known gap:** `corner_retrigger` (Cornered) is a x pips over the whole hand
(`totalPips *= minsLeft^corners`), so it fires once at the end rather than on each
corner card. Firing it per corner card is a one-line move into the loop and it
**changes the score** (`(T*m)*m` over the finished total is not the same as applying
x m twice mid-loop), so it wants a balance decision, not a quiet edit.

### A card's x MULT fires ON THE CARD (r233)

`permXMult` is the card enhancement that MULTIPLIES the mult - The Forge, The
Price, Coin Flip, the slot machine. It used to be applied at the very end of the
additive ladder, raised to the power of the replay count: a x1.5 on a card that
scores three times landed as one **x3.375**, in the end lump, on a card that had
finished animating seconds earlier, with an exponent nothing on screen explained.

The replays were always honoured. They were just **compressed into one event**,
which is the same arithmetic and cannot be communicated. It fires on its own card
now, once per replay - **x1.5, x1.5, x1.5** across that card's three beats.

**This is a real score change and a NERF.** At the end of the ladder it multiplied
everything additive in the hand; on its card it multiplies the base mult plus the
per-card mult of that card and the ones before it, and every hand-level +mult
lands after it. Measured over 403 hands:

| | hands moved | mean | worst |
|---|---|---|---|
| no enhancement in play | **0 of 403** | - | - |
| enhancement, small tray (8 Tricks) | 39 (9.7%) | **-25.6%** | -53% |
| enhancement, full tray (177 Tricks) | 44 (10.9%) | | **-70%** |

**The nerf scales with how much hand-level +mult the loadout carries**, because
that is exactly what the multiply no longer reaches. A card x mult is therefore a
much weaker late-run pick than it was. If that wants compensating, the lever is
the enhancement's own factor at the offer sites (`e.xmult` in `enhanceCardKey`),
not its position - the position is what makes it visible.

#### The whole per-card MULT region now APPLIES in scoring order

r220 moved the per-card mult sweeps' **emission** into the card loop so they would
animate on their own card, but their **arithmetic** stayed as accumulators summed
into `mult` at scattered points after it. That was score-identical for as long as
every term in the region was an ADD - and stopped being so the moment a per-card
x MULT joined them, because a multiply has to know what has already landed.

- **`_cardMultSeq` is the whole mechanism**: the card loop banks
  `{ add, once, xm, reps }` per card and the sequence is replayed against `mult`
  the moment `mult` exists. **The events are still emitted in the loop**, where
  they belong on the timeline; only the arithmetic moved.
- **`mult` does not exist during the card loop.** It is declared *below* it, so
  reading it there is a temporal-dead-zone THROW, not a wrong number - the same
  trap `_rankIsEvenRank` hit in r228. That is the entire reason for the banking.
- **The sequence runs after the base mult and before ANY hand-level add** (base +
  layered hands + Amplifier, and nothing else), because that is precisely where
  the card beats sit on the timeline. Put it one line later and the running MULT
  chip stops matching the dance.
- **The rep loop IS the order the dance replays a beat**: the per-rep adds, then
  the `once` payers on the first rep only, then the multiply. The dance filters
  `once` events out of later reps and applies everything else in emission order,
  so any other arrangement diverges the moment a REPLAYED card carries an
  enhancement. The multiply is emitted LAST in the card's block for that reason.
- **The per-card payers' MULT moved inline too** (`_cmOnce`). r228 deliberately
  added each at its own Trick's site further down; that is unreachable now,
  because a card's x mult sits between the loop and those sites. `_pcMult` is a
  LEDGER total only - the ten `mult += _pcMult.X` lines are gone and the
  `bMultQ` rows beside them stayed, so the contributions tab is unchanged. The
  pip side (`_pcPips`) is untouched.
- **The `mult < 1` corruption floor stays where it was**, applied once after the
  loop rather than per card. A running mult driven negative mid-loop by corrupted
  clubs and then multiplied is a corner that needs exalt/corrupt ON, an
  enhancement, and a negative subtotal; the floor still catches the result.
- **Verified: 0 of 403 hands move with no enhancement in play**, at 8 Tricks and
  at 177, so the restructure itself is provably score-neutral and only the
  deliberate change shows. The timeline replay is still **0 mismatches over 9,791
  scored hands**, which is what proves the dance and `calcScore` agree about the
  new order.

### The last four xSCORE effects (r236)

Owner: *"are there any xscore effects left? there shouldn't be i dont think..."* There
were four, and now there are none.

| what | factor | now |
|---|---|---|
| **The Redaction** (boss) | x0.25 on a hand family | x mult |
| **The Grind** (boss) | x0.85 per repeat | x mult |
| **Low and Behold** (knack) | x2 | **a per-card replay** (r238, below) |
| the dev grid Trick card | x2 | x mult |

**`s = totalPips * mult` and Focus is a separate multiplier after it, so a xK on the
score and a xK on the mult are the same arithmetic** - and one of them is a number
the player can watch change while the other is the score quietly coming out
different. Measured with each effect FORCED ON and with all three together:
**0 of 89 hands moved** in every case.

- **They go at the VERY END of the x mult block, in the order they used to fire**,
  after Siphon / Legacy / Spot Check. Anywhere earlier and something additive would
  land after them, which a x score never had in front of it.
- **They DO NOT ROUND** (`rnd:'none'` on the event). Every other x mult in that block
  rounds to one decimal, but these were applied to a FINISHED score, so rounding the
  mult instead would be a real, if tiny, score change. The chip still displays one
  decimal - `fmtM` formats it - so nothing looks different.
- **They EMIT but do not write the ledger.** None of the four ever had a contributions
  row (they fired past every ledger call), and `_cm` is pushed as `source:'trick'`
  wholesale - so billing `_redaction`, `_grind` or a knack there would print a raw id
  in the breakdown and change what the tab reports. Same rule the row/col +2 mult
  follows: the timeline gets it, the ledger does not. It also means no `_proc`, so
  the Rider penalty is untouched.
- **The printed descriptions are deliberately unchanged** (owner's call). "Replays the
  whole hand once" says what Low and Behold DOES; "x2 mult" would be the
  implementation talking.
- **Legacy and Spot Check were already x mult but emitted NO timeline event**, so they
  were invisible in the dance despite being in the right place. Both emit now.

### Low and Behold replays the CARDS (r238)

Owner: *"for the trick that says replace the whole hand once, that shouldn't touch
any score attributes, it should replay each of the cards once."*

r236 had moved it from a x SCORE to a x mult, which kept it legible but kept it a
MULTIPLIER - and its printed text has always said something else. It is a **+1
retrigger on every card in the hand** now (`_labOn`), exactly like **Echo**, which
had already made this same journey from a SCORE-level double to a per-card replay.

- **The CONDITION is hand-level, the EFFECT is per card.** "The hand contains the
  grid's lowest rank" is computed ONCE above the card loop and then adds a rep to
  every card, which is why it is a hoisted `const` rather than a per-card test.
- **This is a real score change and it goes BOTH WAYS.** A replay re-scores what
  the CARDS earned; it does not double the hand's base pips or any hand-level
  bonus. So a card-heavy hand gains and a base-heavy hand loses. Measured over 136
  hands with the knack forced on: **35 move, min x0.57, median x1.02, mean x1.11,
  max x2.22** - 18 up, 17 down. Verified live on a controlled board: an unsuited
  3-4-5 goes 37 pips / 111 to **49 pips / 147**, and back to 111 the moment a 2 is
  planted elsewhere on the grid.
- **It needs no timeline event**, because the dance already shows a replay by
  repeating each card's beat. `low_and_behold` emits nothing now: verified 0
  events on the timeline.
- **A suited run ALREADY replays every card** (the flush overlay puts each card in
  two components), so a test board of three spades shows `reps [2,2,2]` with the
  knack switched off. That cost a confusing measurement; use an unsuited run and
  control every cell when testing this.

### Flow State is a per-card payer after all (r238)

The r228 note below says it is deliberately excluded because its payment sat
**after** the x pips block and so escaped Undertow / Scalper / Knave Power /
Interest. The owner's rule settles it the other way: **any per-card Trick fires on
the card**, and a pip in the additive region is a pip that every x pips
multiplies. It is a `PER_CARD_PAYERS` row now, and its accumulator is added at the
LAST additive pip site before the x pips block.

**A deliberate buff, and a bounded one.** Measured with Flow State forced on at a
x1.5+ Focus multiplier over 136 hands: **112 move, every one UP, min x1.02,
median x1.11, max x1.36.** That is the x pips multipliers reaching it for the
first time.

### Per-card payers (r228) - "a rate x a number of cards"

Seventeen Tricks pay a rate times a COUNT OF CARDS - Get Even is +2 mult per even
card - and every one was still a single hand-level lump at the end of the tally.
Owner's report: "the trick did not contribute the mult as the cards animated, it
gave +6 mult at the end, that's incorrect."

**`PER_CARD_PAYERS` in `calcScore` is that whole class as a table**, so a new one
is a row rather than another fix: Get Even, Odd One In, Early Bird, Night Owl,
Overgrowth, Long Road, Correct Run, Edge Pips, Full Colour, Balanced Diet,
Column Rush, Row Power, Heavy Hand, Prime Time, Quake and Shock. Each row is
`{ id, cond, pays }` - `cond` is evaluated ONCE before the card loop from facts
already known there (`_pcCtx`), `pays(card, ctx)` returns what THIS card earns.

**Two rules:**
- **REPLAY-WEIGHTED (r236).** A card that scores three times pays these three times,
  exactly as its own pips do. They paid ONCE per card until r236, which the owner
  caught by playing it: *"when get even is owned and an even card replays, i did not
  see another mult chip fly to the score area. i saw pips go multiple times, but i
  only saw the mult animate once."* The animation was honest - the payment really was
  once - and **the CONDITION is what makes these per-card, not the bonus**, so there
  was no reason for the bonus to behave unlike every other per-card bonus. `pays`
  returns a flat per-card amount, so `* _retrig` is the whole edit; the events drop
  their `once` flag and the dance repeats the beat, which makes the chip fly once per
  replay with no work at the dance's end.
  **It is a BUFF, and only hands with a replayed card can move.** Measured against the
  same build with only this change reverted: at a 10-Trick tray, **15 of 142 hands
  (11%) move, median x1.25, max x1.69**; at an unreachable 177-Trick tray, median
  x1.45, max x4.8. Every changed hand is an increase and **0 of them lack a replayed
  card**, in all three sweeps.
  **`_cmOnce` is now unfed** and is kept as the seam a future once-per-card bonus
  drops into - the rep loop is already shaped to interleave one correctly against a
  card's x mult, and that is the hard part to re-derive. (Contrast the r220 per-card
  MULT accumulators, which always multiplied by `_retrig`.)
- **Emitted at the END of the card's block**, after `totalPips += cp`, so a pip
  lands outside that card's own subtotal and is never multiplied by a card-scoped
  x pips (Humble Roots, a card enhancement, the Blight). Each accumulator is still
  ADDED at that Trick's original site further down, so nothing moves in the order
  of operations either.

**FLOW STATE IS IN THE TABLE AS OF r238** - see the section above. It was held out
because its payment sat **after** the x pips block and so escaped Undertow /
Scalper / Knave Power / Interest; the owner's call is that a per-card Trick fires
on the card and takes the multiplies with it. **Any row still has to sit in the
additive region** - check where the Trick's `totalPips +=` actually is before
adding one, because a site below the x pips block silently means something
different from every other row here.

**Get Even and Odd One In lost their 3-card gate** (owner's call): both pay for
every even / odd card with no minimum. "3+ even cards" meant a hand with one or
two paid nothing at all, which reads as the Trick being broken rather than as a
condition unmet, and it is the one gate in this table a player cannot see coming
while choosing. Neither has a `DESC_TEMPLATES` entry, so their descriptions are
the printed text - "+2 mult" appears exactly once in each, which is what keeps
`improve.js` scaling the number. Measured: with the two out of the tray, 164 hands
identical and 0 changed; with them forced in, **all 143 changed hands are ones the
old gate rejected**.

`_rankIsEvenRank` / `_rankIsOddRank` are hoisted to the file, because the table
runs BEFORE the card loop and the post-loop sites are in the temporal dead zone
above a `const` declared there.

### Focus lands BEFORE the tally (r222)

The Focus a hand earns - its complexity, how fast it was played, and any Trick
that hands out Focus - is generated in `playHand` **before** scoring, and it
multiplies **that same hand**. The dance said the opposite: the FOCUS chip sat at
the pre-hand value through the whole tally and only climbed at the very end,
which reads as "this multiplier applies to the NEXT hand".

It is the same number either way; only *when the player is told it changed* moved.
The chip now settles on the multiplier the hand is actually being scored with
**before a single card scores**, so the rest of the tally runs underneath a FOCUS
box that is already telling the truth. `focusActive` is computed once where the
chips are first written, so the beat and the settle cannot disagree.

### The score particle is a coloured diamond (r222) - `particle-preview.html`

A particle was bare serif text with a drop shadow, competing with a board of cream
playing cards and a lit HUD. It is a small **diamond plate**, coloured by the chip
it is flying into and lettered in white Orbitron: **pips blue** (the PIPS chip's
own border colour), **mult red**, Focus violet, credits gold, time clock-blue - so
the colour says what is changing before the number is read, and an opaque plate is
legible over anything behind it. A multiply is the same hue, brighter.

- **`PARTICLE_CFG` in `js/score-dance.js` is the whole shape**, and
  **`particle-preview.html`** is where it is tuned: a mock HUD, the real flight, a
  knob for every value, and a Dump button that prints the block to paste back.
  Shapes are diamond / square / circle / pill / **none** (the pre-r222 bare text,
  kept as an option). Sizes are multiplied by `DANCE_CFG.pScaleMul` (1.15).
- **TWO nested elements, and that is load-bearing.** `.dnc-particle` is the FLIGHT
  element - `dncFly` animates its transform every frame - and `.pt-box` is the
  plate. A diamond IS a 45deg rotation, so on one element the flight's transform
  would overwrite it; the box rotates and `.pt-lab` counter-rotates so the text
  stays upright.
- **The border is the plate's own hue lightened** (`_ptLighten`), not a separate
  colour, so the diamond reads as one object rather than as an outline around a
  fill.
- `evKind(ev)` maps a timeline event to its colour family. The old per-op text
  colours are kept but are now read ONLY by the no-plate shape.

### The particle finished (r233) - one plate for the whole game

Four things r222 left on the table, plus the discovery that the preview and the
game had drifted apart.

- **The FLIGHT is tuned in the preview now, not hardcoded.** `particle-preview.html`
  had been dumping `flightMs / pop / arc / spin / landFade` since r222 and **nothing
  read them** - `dncFly` wrote its own keyframes - so a tuning session there could
  not reach the game. `ptFrames` reads them, and a fresh load of the preview now
  dumps a block byte-identical to the shipped `PARTICLE_CFG`. Keep it that way: if
  the two disagree the preview is worse than not having one.
- **`spin` is a PEAK hit at the HALFWAY point, and `spinEnd` is where it settles.**
  A single end-angle reads as a constant tumble; peaking at 30deg and settling back
  to -5deg reads as a flick of the wrist. Two numbers, not one.
- **Per-kind `shapes` and `inks` beat one more shade.** Coins are a **circle**
  (`shapes.credits`) and the clock plate is **white with black ink**
  (`colors.time` + `inks.time`) - a currency that would be mistaken for another one
  gets its own SHAPE or its own INK, because a seventh shade of the same family is
  not a distinction anyone reads mid-tally. `ptShape` / `ptInk` / `ptTrail` are the
  three lookups, each falling back to the global value.
- **The rewind ghost trail** (`trails.rewind`, 4): a rewind is the one payout that
  means "this already happened, and it is happening again", so it is the one that
  gets an after-image. The ghosts are appended **furthest-back first** - they are
  body-level siblings at one z-index, so DOM order IS paint order and the real plate
  has to go in last to sit on top. The fall-off is carried by **opacity, not
  colour**: a white plate cannot be lightened any further, and time particles are
  white plates.
- **Blip growth** (`growStart` 5, `growStep` 5%, `growMax` 3x, dev panel ->
  Animation, persisted as `lethe.blipGrow.v1`): past the first N particles of a hand
  every further one is bigger than the last, compounding, so a hand firing forty
  payouts ENDS much louder than it started. **The counter is 1-INDEXED** - `n` is
  "this is blip number n", so `growStart` 5 means blips 1-5 are base and blip 6 is
  the first one bigger. Counting from 0 gives six base-size blips, which is not what
  "after the first 5" means. `dncResetBlips()` runs beside `dncResetAccel()` at the
  top of each hand, for the same reason: each hand winds up from its own base.
- **`DANCE_CFG.pFlight` is no longer the flight length** - `ptBaseFlight()` is, and
  **the beat's own wait has to read it too**. The beat applies its values after
  `beatDur`; if that still divided 550 while the particles flew 1200, a card banked
  its subtotal less than halfway through its own animation.

**The entity payout FX now throw the SAME plate** (`js/payout-fx.js` calls
`ptLaunch`). They had their own bare-text `.efx-particle`, which was a second visual
vocabulary for the same idea and the one the owner called out as illegible. One
shape, one tuner, one fix. The icon left the label with it: the plate's colour, its
shape and the readout it flies into already say which currency this is, and an icon
beside the number doubled the label's width on a 40px diamond.

- **Two of the six `EFX_TARGETS` lists pointed at ids that do not exist.** `#ci-coins`
  and `#coin-count` are not in the document and `#coins-display` is 0-size in
  landscape, so **credits had no reachable target**; `#discard-btn` and
  `#discards-display` are absent in BOTH orientations, so **discards had none
  either**. Both currencies silently threw nothing at all since r220. The lists are
  audited in a real browser at 1440x820 and 420x820 and every one now resolves in
  both - the "first element with a non-zero rect wins" rule only works if at least
  one element is real, and nothing was checking that.

### Scoring speed is a slider, and bursts are timed (r220)

- **Settings > Motion > Scoring speed** is a **0.5x-16x slider** (was four presets),
  **defaulting to 2x** (r222), writing `DANCE_CFG.norm`. The `norm:1` in
  `DANCE_CFG` is only the value before settings apply, not the shipped default -
  and nothing about the timing MATH changed, the slider just starts at 2. It applies to the goal hand too: a player who set 8x has
  said what they want to watch, and having the one hand that ends the round ignore
  them reads as a stall, not as ceremony.
- **The per-payout acceleration is the dance clock's** (`dncBumpAccel` /
  `dncPace`, js/dance-clock.js): +5% of the current pace per payout tick,
  compounding, capped at 8x, reset per hand. Per-trigger payouts mean many more
  ticks than before, so the ramp does most of the work of keeping a long hand
  bearable. Measured, 5-card hand with 10 Tricks: **13.8s at 1x, 7.1s at 2x, 4.1s
  at 4x, 2.9s at 8x.**
- **Burst depth comes from how fast hands are SUBMITTED** (`DNC_BURST_WINDOW`,
  1400ms), not from whether `danceAbortController` happens to be non-null. That was
  the "why did this hand fast-play?" bug: a skipped dance is short but still has a
  tail (merge, throw, climb, settle), so the next hand almost always arrived while a
  controller existed and inherited the depth - **once you entered skip mode you
  stayed in it**. `cancelDance()` also stamps `dncCutAt` for cuts with no successor
  at all (round end, a boss firing, `startGame`), so a hand played just after one of
  those inherited a burst it never earned. Depth now self-heals the moment the
  player stops hammering.

### Toasts - `showMessage()` (r220)

**275 call sites shared ONE element**, one 0.9s animation, 40px Cinzel (a serif the
game uses nowhere else), no plate behind it. Two messages in the same second
clobbered each other and a single one was gone before it could be read against a
board of cream playing cards. `showMessage(text, color)` is unchanged as a
signature - **no call site moved** - but each message is now its own `.toast` in a
`#toast-layer` stack: house mono type, an **opaque** plate, a colour-coded left
edge, a dark stroke painted OUTSIDE the glyphs (`paint-order`) so the text survives
landing on a bright card, and a 2.2s dwell. Max 4 at once; the same line twice in a
row bumps an `x2` badge rather than stacking a duplicate. The optional third arg
takes `{ icon, ms, kind }`. **Outside `#cabinet`**, for the usual `zoom` reason.

### Entity payout FX - `js/payout-fx.js` (r220)

**NOT `js/entity-fx.js`.** That is a different system with a confusingly similar
name (r209): it draws the LINES and CARD MARKS that say "this cell is MARKED by
that Trick". This one animates what an entity PAID OUT, at the moment it paid.


Entities pay out in five currencies and only two were ever animated. `entityEffectFX(kind, amount, {id, source})`
pops the entity, flies a symbol from its real tray tile to the readout it changed
(clock / credits / Focus / swaps / discards) and plays that currency's existing
sound. Targets are **lists**, and the first element with a non-zero rect wins - the
same reason `js/tutorial.js` tests by rect rather than `offsetParent`: several
readouts only exist in one orientation.

**Basic version, deliberately.** `rewindTime` and `pauseRound` take optional
`srcId`/`srcSource`, and `addFocus(amount, srcId, srcSource)` fires only when a
source is named - unattributed Focus gains happen constantly and a particle for each
would be noise. **The obvious next step is Focus getting the same treatment the
score just got**: `generateHandFocus` runs in `playHand` BEFORE the dance, so an
attributed grant currently fires its particle before the cards have moved. It wants
an ordered timeline replayed between the card beats, at which point those calls
become events rather than immediate effects.

**Unrelated find, worth knowing:** `jack_mult` and `heart_double` have `BAL` entries
and `DESC_TEMPLATES` but **no `TRICK_POOL` entry** - they are scored for, described,
and unobtainable.
### Trick numbers reworked (r205)

Five Tricks whose printed effect and real effect had drifted apart. All five read their numbers out of `BAL` now, and all five have a `DESC_TEMPLATES` entry, so the description cannot drift from the value again.

| Trick | was | is |
|---|---|---|
| **Study Hall** (rare) | marked row/column **and** a once-per-minute gate: ~3 fires a round for a rare | **every 2 cards you score adds +1 Focus**, wherever they are - a 5-card hand pays twice |
| **Get Even** (common) | `cells.length x 2` - it paid for the *odd* cards in the hand too | **+2 mult per EVEN card** |
| **Odd One In** (rare) | `cells.length x 5` - same trigger, 2.5x the rate | **+2 mult per ODD card** - the same effect mirrored |
| **Cull** (common) | flat +1 Focus per discard | **+1 Focus per swap and discard you have left** (read after the discard is paid for) |
| **Escalation** (rare) | `handsPlayedRound - 5`, and since the counter is bumped *after* scoring that meant nothing until the **7th** hand | **every hand of the round is worth +3 mult**, paid from the 4th: 4th = +12, 5th = +15, 6th = +18 |

- **`studyHallCards` is a RUN counter, not a round counter.** It is declared in `deck-grid.js`, reset in `startGame` only, and is in `SAVE_VARS`. Resetting it per round would throw away a partial pair every level.
- **`handsPlayedRound` is bumped in `playHand` AFTER scoring**, so inside `calcScore` the hand being scored is the `(handsPlayedRound + 1)`-th of the round. That off-by-one is what made the old Escalation dead; anything keyed on "how many hands so far" has to account for it. The live readout in `tricks-ui.js` uses the same expression.
- **Escalation counts the first three hands, it just does not pay for them yet (r207).** `after_hands` is a PAYOUT THRESHOLD, not an offset subtracted from the count: nothing lands until the 4th hand, and then the bonus is the whole hand count x the rate. A first pass read it as an offset and paid +3 on the 4th instead of +12.

### Focus RATE vs Focus CAP (r190)

Every Focus entity before r190 raised the **ceiling** (`focusCapNodes`). Nothing touched the **rate**, which is the term that actually multiplies a run's output. `generateHandFocus` builds Focus from two terms, and `focusRateMods()` is the one place the whole loadout is read:

| lever | scales | owned by |
|---|---|---|
| `complexity` | `HAND_FOCUS[hand]` | Second Nature (Trick x2), Shorthand (Knack x1.5) |
| `speed` | `speedBonusFromTime(t)` | Overclock (Trick x2), Flywheel (Sleight x1.5) |
| `window` | **dilates t** - same bonus, twice as long to earn it | Long Fuse (Knack x2), Governor (Sleight x1.5) |

**`window` is not a weaker `speed`.** On the default linear curve (`12 - 1.5t`, zero at t=8) speed pays hard for fast play and cannot rescue a slow hand; window flattens the curve and helps slow play most. Measured on a Full House: at t=1s speed x2 gives 25 and window x2 gives 15; at t=8s speed x2 gives 4 and window x2 gives 10. The Sleights work by **sitting on the grid**, so `focusRateMods` scans for them and skips quarantined/void cells via `cellCountsForTriggers`.

### Natural Scaling (r190) - `js/natural-scaling.js`

The goal curve is exponential (`GOAL_SCALE` 1.35/level) while base hand pips scale at only 1.1, so a run must close a **1.227x-per-level gap** - about **32x over 18 nodes** - out of its loadout alone. Every existing source of that was a DROP. Natural Scaling makes the baseline itself grow: score a hand and its whole **family** (sets / runs / flushes) gets permanently better.

- **A per-run ACCUMULATOR layered on top of `HAND_BASE`, never a mutation of it.** `HAND_BASE` is global and modes overwrite it (`applyModeHandValues` zeroes Spectrum's Flush of 3), so writing into it would leak across runs and fight the mode overrides.
- **It rides `handBasePips()` / `handBaseMult()`**, the scoring-model chokepoint above, rather than patching `calcScore`. That is what makes it work under all three scoring models and makes the RECORDS Hands tab quote the earned value for free - both call the same two functions. The bonus therefore rides the `1.1^(level-1)` scale the way the printed base does. `recordNaturalScale` runs **after** the score commits, so a hand's buff lands on the next hand of that family.
- **Straight Flush is in the run AND flush families.** That mattered while the bonus was per family (it credited both but **took the better of the two**, not the sum, or the top of the table would scale twice as fast as everything else). Per hand type it is simply its own accumulator; the max-not-sum rule now lives in the Old Tricks knack, for the same reason. **The rest of this section describes the pre-r198 per-family behaviour - see "Natural Scaling is PER HAND TYPE" below.**
- Measured hands-to-clear (bare baseline, no Trick loadout, Focus x1.8, 200 runs): **OFF 2.2 -> 112 by level 18** (559 hands a run). At the +2 pips/hand default, **2.2 -> 20** (178). The curve still rises, it just stops running away. **Mult per hand is a far stronger lever than pips** - +0.25 mult/hand flattens the whole run to 6.6 hands at level 18, so mult defaults to **0**.
- **It self-nerfs flushes, by design.** In Classic `flush3`/`flush4` are not active (`startGame` seeds them only at `suitCount >= 6`), so the flush family can only earn from the 5-card Flush - and once runs start scaling, Flush is never the best available hand. Measured over a full Classic run: run 133 hands / +266 pips, set 43 / +86, **flush 0 / +0**.
- Which is what makes the **Short Suit** knack (rare) worth a slot: it turns on Flush of 3 / Flush of 4 where they aren't already active, letting the flush family start earning. It hangs off `updateKnackList()` for the same reason Tempo does.
- Tuner: **dev panel -> Score -> Natural Scaling** (on/off, pips per hand, mult per hand, every N hands, live per-family readout, reset). The **RECORDS Hands tab** quotes the live value with the earned part in green beside it.
### Natural Scaling is PER HAND TYPE (r198)

It used to credit the whole **family**: play Pairs and your Four of a Kind got better too. That meant the baseline grew no matter which hand in the family you reached for, so reaching for the harder one bought you nothing you were not already getting. It is now keyed by hand NAME, so climbing the ladder is a real decision - a Three of a Kind played forty times can out-score a Four of a Kind you have never played.

- `nsPlays` / `nsBonus` are keyed by hand name (`'Run of 3'`), not by family. Both are still in `SAVE_VARS`.
- **A pre-r198 save is migrated, not dropped.** `migrateNaturalScaleFamilies()` (called from the restore path in `js/save.js`, self-detecting) spreads each family total onto every hand in it - which is exactly what that save meant by it.
- **The family is not gone, it is a PRIZE.** The **Old Tricks** knack (epic) makes every hand read the best bonus anywhere in its family. It **REPLACES** the hand's own, it does not add to it: Three of a Kind on +50 and Four of a Kind on +24 both read **+50**, never +74. `naturalScaleBonus` takes a `Math.max` for exactly that reason, the same way Straight Flush has always taken the better of its two families rather than their sum.
- `recordNaturalScale(handName, cells)` now takes the cells and credits **every layer** the hand paid for (below), so a same-suit run advances both the run and the flush - it earned both, because it was scored as both.

### Hand components (r199) - a hand is a LIST of shapes

Phase 10 rules, on a grid. A played hand is broken into **components**, and every component pays its own printed base pips and base mult, earns its own Natural Scaling, and names itself in the HUD. `handComponentsFor(cells)` in `js/hand-detect.js` is the whole answer and everything else reads it. Two tracks build the list:

- **Track 1, the RANK PARTITION.** Sets and runs carved out of the selection as **disjoint** pieces, chosen to pay the most. This is what makes "a Run of 4 AND a Set of 3" one seven-card hand. Straight Flush is a candidate here too, because it is a run that is paid extra for being suited, not a run with a flush stacked on it.
- **Track 2, the FLUSH OVERLAY.** The biggest same-suit GROUP of `flushOverlayMin` (3) cards or more, added **on top** of Track 1 - it overlaps rather than partitions, so the same cards can be in a set and in the flush at once. Skipped when Track 1 already took a Straight Flush, which IS that hand.

**A card in more than one component REPLAYS**, once per extra component it is in (`handReplayMap`). So a Set of 4 + Set of 3 where five of the seven share a suit pays 4oK + 3oK + Flush, and exactly those five cards score twice. Measured in the real game: a 7-card Run of 4 + Set of 3 + Flush scored **1870** against a 1200 goal, with 90 base pips x 11 base mult.

- **`activeHands` gates what you may PLAY, not what a hand may LAYER.** The rank partition only ever takes an active hand, so a mode that has not unlocked Flush of 3 still cannot let you play three suited cards as a hand. The flush OVERLAY ignores `activeHands` entirely: a suited Run of 3 in Classic is paid the Flush of 3 as well. That split is the point - the flush is never the thing you chose to build, so unlocking it is about being allowed to build it **on purpose**, which is exactly what **Short Suit** now sells. Verified: suited Run of 3 in Classic = Run of 3 + Flush of 3 (350, was 120); a bare Flush of 3 is still `null`.
- **`playable` is a separate question from "has components".** A hand is playable only if at least ONE component is a hand this mode has unlocked - that is what keeps a bare short flush unplayable while its overlay still pays inside a run.
- **COMPONENTS ARE STRICT; UNCLAIMED CARDS STILL SCORE THEIR PIPS.** A component uses every one of its cards - a Pair is exactly two cards, never two cards and a spare. The spare stays in `handCells` and scores its own pips exactly as before. **This is what keeps every pre-r199 hand scoring what it used to**: `{5C 7S 7H}` is still a three-card Pair, Full House still beats 3oK + Pair (225 vs 145), Two Pair still beats Pair + Pair (90 vs 80).
- **`_bestRankPartition` is a memoised bitmask recursion**, always deciding the lowest unused card first: drop it, or group it with some subset of what is left. `3^n` with n capped at 7.
- **`HAND_MAX_CARDS` is 7 and `findBestHand`'s subset cap moved from 5 to it.** `limits.selection` has a max of **9**, so before this, cards past the fifth could never be in a hand and were billed as penalty pips - Selection Size bought nothing past 5.
- **Cost:** a 7-card selection re-scores in ~4ms, a 9-card one in ~16ms (one frame). The dominant term is `calcScore` per connected subset, which is pre-existing; `handComponentsFor` caches on a key built from the cards themselves, so a board that moves invalidates its own entries.
- **New hands** (`js/data/cards.js`): Flush of 6/7, Run of 6/7, Five/Six/Seven of a Kind. The sets past four need Spectrum (7 colours, one card each per value) or duplicated cards from the shop. **Flush House / Fuller House / Fullest House are deliberately NOT hand types** - the two tracks already produce them, with better labels: a suited Full House is `Full House + Flush`, a 4+2 is `Four of a Kind + Pair`, a 4+3 is `Four of a Kind + Three of a Kind`. Adding them as names would only be a pricing knob, and would double-count if done carelessly.
- **A pricing note, not a bug:** six cards of 3+3 come out as **Full House** (225, one card unclaimed) rather than two Threes of a Kind (210), because the partition maximises payout. If "two sets of 3" should be its own thing, that is a `HAND_BASE` decision.
- **The `handName` guard.** `calcScore` drops exactly ONE component by name (so two Sets of 3 are still paid twice) and, if the caller's name is not a component at all, adds **none** of them. Match-3 names its own hands, so that path is reachable and would otherwise pay for the same cards twice.
- Dev toggles: **Score -> Layered hands** (`layeredHandsEnabled` switches the flush overlay off; the rank partition always runs) and a **flush overlay needs N of a suit** slider (`flushOverlayMin`, 3-7). At 3 the overlay fires on roughly half of all five-card hands, which is the intent - the owner is deliberately pushing average score up so goals can be raised steeply later.

### Minimum selection + High Card (r200)

**Selection Size was pure upside**: a maximum you raise and then keep playing Pairs. It now carries a floor with it - `minSelection()` in `js/limits.js` is `limit - 2`, floored at 1 (3 -> 1, 5 -> 3, 7 -> 5, 9 -> 7). You must commit that many cards to every hand, so a two-card Pair can no longer tick the board over or stand in for a free discard. Taking the upgrade is a real decision.

- **The PLAY GRID and the REWARD GRID both (r216).** It was the play grid's alone, which had it backwards: raising Selection Size made hands harder to commit while making the reward grid strictly easier. The shop pickers are still uncapped at the bottom - there you are spending credits, and a floor would be a bill, not a decision. See "The reward grid has a floor too" below.
- **Enforced in four places, not one.** The PLAY button's `disabled` state (`js/render.js`), the auto-submit scheduler AND its firing callback (`js/input.js`), and a hard guard at the top of `playHand` - queued actions and any future keyboard path reach `playHand` without passing the button's state.
- **The `#hand-name` label states the requirement** ("NEED / 5", red) instead of naming a hand. That is where the player is already looking to find out what they have, so it is where "you cannot play this yet, and why" belongs.
- **`minSelectionBinds()`** is "does the minimum actually bite" (`> 2`). Two cards is the floor for a hand regardless, so at limit 3 and 4 nothing changes.
- **High Card** (`HAND_BASE` 0 pips / x1 mult, `HAND_FOCUS` **0**) is the escape valve: a selection you are forced to make but cannot shape is still playable, and scores the cards' own pips and nothing else. `handWorth` puts it at 1, so it never beats a real component, and `recordNaturalScale` skips it (no NS family) so **it can never grow**.
- **It is gated on `minSelectionBinds()`, and that gate is load-bearing.** With High Card live, `detectHand` returns non-null for ANY two cards, so nothing is ever "no hand here" - and **`tutorialFindDeadCards` finds cards in no hand at all**, which would have gone permanently empty. The tutorial runs at limit 3, where the gate keeps High Card off. Verified: 6 dead cards still found at limit 3, 0 regressions.

### The reward grid has a floor too (r216)

`rewardMinPicks()` in `js/reward-grid.js` is the reward grid's half of the rule above.

- **Derived from `minSelection()`, NOT from `rewardSelectionCap()`.** Greedy Boi raises the reward-grid CEILING as a reward; having it raise the floor to match would staple a downside onto a knack meant to be pure upside. The floor is then held below the cap (`Math.min`), so a grid can never ask for more picks than it will accept.
- **Enforced in three places**, the same shape as the play grid: the on-grid CONFIRM button (`updateRewardButtons`), the legacy overlay's `#reward-confirm`, and a hard guard at the top of `confirmRewardPath` - a queued tap reaches it without passing the button's state.
- **CLEAR is deliberately NOT gated.** It only needs something to clear; gating it on the minimum would strand a short pick with no way to undo it.
- **SKIP is untouched.** Taking nothing is a deliberate alternative with its own payout, not a short pick.
- `#reward-sub` states the requirement and nothing else while it is unmet ("take 2 more to confirm, or SKIP to take none") - it is the only thing between the player and CONFIRM.
- **The worst case is satisfiable, and it was worth checking**: the smallest grid in the game is the 3x3 prize grid, against a maximum floor of 7 at Selection Size 9. Measured in a real browser: all 9 tiles are reachable as one connected group, so CONFIRM is always attainable.

### The two selection readouts (r216)

They answer different questions and must not be collapsed back into one:

| element | shows | where |
|---|---|---|
| `#sel-display` | **STATIC** - the Selection Size limit itself | top bar, beside the coins (portrait; landscape hides every `#top-bar .top-stat`) |
| `#sel-count` | **LIVE** - `x/y`, what is in hand over what this screen will take | the board's own margin |

- **`#sel-count` sits in the EMPTY MARGIN of `#grid-slot` around the centred `#grid`** - the band above the board in portrait, the gutter beside it in landscape. `applyGridMetricsToDOM` publishes `--grid-w` / `--grid-h`, so the box is sized `calc((100% - var(--grid-h)) / 2)` and its content is genuinely centred in that margin rather than nudged into place with a guessed offset. No JS measurement, no resize handler.
- **It is a SIBLING of `#grid`, not a child.** `render()` rebuilds `#grid`'s children and `renderRewardTiles` empties it outright, so a child would be destroyed on the next repaint.
- **`renderRewardTiles` calls `updateSelectionUI` itself.** A reward tile click calls `renderRewardTiles()` directly and never goes through `render()`, so wiring it into `render()` alone left the count frozen at 0 for the whole reward step.
- Red below the minimum, gold at the cap, hidden when there is no board (the menu, where a stale "0/3" over an empty stage reads as a bug). `pointer-events:none`, `z-index:6` - the payout panel (40) covers it.

**Junk cards rode along free between r199 and r201** - see "Every card must be load-bearing" below, which is where that ended. The minimum now costs you cards off the board AND the score of anything you cannot use.

### The hand rules, stated plainly (r254) - what a selection IS

The owner asked for these written out after "a fifth card keeps getting dropped
and I cannot tell why". The rules, as the code actually is:

- **Tap order NEVER matters.** `selected` is a set of cells; detection reads the
  cards' ranks and suits and nothing else about how you picked them.
- **The grid arrangement matters ONLY for connectivity.** The selection must be
  one orthogonally connected group, and the smaller subset `findBestHand` falls
  back to must itself be connected - so dropping a card CAN strand a hand if that
  card was the bridge. Inside a connected group, position is irrelevant: 4,6,7,5
  in any cells and any order is a Run of 4.
- **4-6-7-5-9 is NOT a Straight.** A run needs consecutive ranks; the 9 joins no
  component, so under r201 the five-card subset is not a hand at all.
  `findBestHand` falls back to the 4-card Run of 4 and the 9 becomes a PENALTY
  card: its pips are subtracted from the hand's score and it is consumed anyway.
- **A Full House is any connected 2x + 3y.** No ordering, no shape requirement
  beyond the whole selection being connected. Same for every set and run: the
  rank partition does not care which cell holds which card.
- **Measured on planted boards (r255), because the owner asked twice:**
  `2 3 2 3 2` is a **Full House** - one component, all 5 cards used, 0 penalties,
  285 - and `3 5 4 7 6` is a **Straight** - one component, all 5 used, 0
  penalties, 325. Both were run in a straight line AND in a snake, and with the
  ranks re-sorted, and all six came out identical. The physical arrangement and
  the tap order really do not enter into it. (`4 6 7 5 9` on the same board is
  Run of 4 + 1 penalty at 199, which is the rule above doing its job.)
- **A dropped fifth card is r201 working as designed, plus one hard cap:**
  `HAND_MAX_CARDS` is 7, so at Selection Size 9 at least two cards are ALWAYS
  dropped whatever you pick. Measured over 300 real 4x4 deals (connected
  selections, base limits): a random 5-card selection carries a penalty **80%**
  of the time (avg 2.0 cards, -14 pips), a random 7-card one 86%, a 9-card one
  100% by construction; even the BEST 5-card selection on a board carries one
  29% of the time. So this is the single most common surprise in the game.
- **What was broken was the UI, and r254 fixed that, not the rule.** A selected
  card the best hand drops now renders **red and desaturated on the board**
  (`.card.hand-penalty`, from `bestHandResult.penaltyCells` in `render()`), and
  `#hand-name` prices it: `RUN 3 - DROP 2 · -14` (`.hn-drop`, red). The NEED
  label still outranks it below the minimum selection. Tagalong lifts the rule
  and the red state and the DROP line disappear with it, for free - both read
  `penaltyCells`, which Tagalong empties.

### Every card must be load-bearing (r201)

**A hand may not carry a passenger.** If the components do not account for every card in the subset, that subset is not a hand. `findBestHand` then falls back to the smaller subset that IS fully used, and the leftovers become **penalty cards**: their pips are subtracted, and they are consumed anyway (`toRemove` is the whole selection, not just `handCells`). A spare card went from a small bonus to a real cost.

- **This reverses an r199 side effect.** Components were strict but unclaimed cards still scored their pips, so `{5C 7S 7H}` was a three-card Pair paying for the 5C. Before r199 only the loose set hands could carry a spare at all; r201 removes it from those too.
- **The rank partition means "fully used" is not "one shape".** `{2S 2H JH QC KD}` is `Pair + Run of 3` - two disjoint components covering all five - and scores 395. That is the same machinery the 7-card hands use, so the rule is much less restrictive than it sounds.
- **High Card is the fallback, and it covers every cell by definition.** When the rule rejects a hand with a passenger, the subset falls through to High Card, and `findBestHand` picks whichever actually pays more: measured on a Pair beside three big cards, `Pair` + 3 penalty (52) still beat High Card (30), so the escape valve costs nothing when it isn't needed.
- **The `hasKnack` call is in the `handComponentsFor` cache key.** Granting Tagalong mid-run changes the answer for cells whose cards have not moved, and the cached entry would otherwise be reused.
- **Tagalong** (rare knack) lifts it: hands may carry cards that are not part of them, and those cards score their own pips instead of being billed as penalties. That is the whole reason it is a knack - before r201 this was free and unremarkable, so making it the default and selling it back turns "my hand has a spare in it" into something you paid for.
- **Verified unaffected:** the 7-card `Run of 4 + Set of 3 + Flush` still scores 1870; the tutorial's board audit passed 40 of 40 deals; RECORDS renders; match-3 is byte-for-byte the same behaviour before and after (checked by running the same deal on both commits).

### The partition and the load-bearing rule were fighting (r281)

Owner: *"This keeps happening when I try and play set of 3... It always drops the third
one and I can't see why."* Three 7s scored as a Pair with the third seven billed as a
penalty; A-2-3-4 scored as a Run of 3 with the 4 dropped.

**`_bestRankPartition` maximises `handWorth`, and `handWorth` reads `handBasePips` /
`handBaseMult` - which include the NATURAL SCALING accumulator.** So once a SHORT hand
had out-scaled the longer hand it lives inside, the partition preferred *take the short
hand and leave a card unclaimed* - and the load-bearing rule (r201), which runs
afterwards and knows nothing about why the partition chose what it chose, then threw the
**whole component list** away because a card was unclaimed. The selection stopped being a
hand at all, `findBestHand` fell back to the smaller subset, and the spare card went red.

- **It is reachable on the SHIPPED tuning, early.** At `nsPipsPerHand` 2: **8 Runs of 3
  kills every Run of 4**, 11 Runs of 4 kills the Straight, 17 Pairs kills Three of a
  Kind, 53 Threes of a Kind kills Four of a Kind. The full table is OPEN_DECISIONS.md 7.
- **`_bestRankPartition(cells, mustCover)`** forbids the drop branch, returning the best
  partition that claims every card or **null** when there is none. `solve` can now return
  null, so every recursion site has to survive that.
- **IT IS A LAST RESORT, NOT THE FIRST ASK, and that ordering is load-bearing.** Coverage
  is judged on the whole component list, **flush overlay included** - a card the rank
  partition left alone is still load-bearing if the flush claims it. Constraining the
  partition up front therefore refuses partitions the overlay would have rescued:
  measured, that changed 1 selection in 2,400 **with no Natural Scaling in play at all**.
  So the unrestricted answer is built first and kept whenever it already covers; the
  covering partition is asked for only when the hand was about to be voided.
- **Tagalong asks for the unrestricted partition directly**, because a passenger is
  exactly what it buys. `_tagalong` is read ABOVE the partition now for that reason.
- **This does not take the short hand away.** `findBestHand` scores every connected
  subset on its own, so "play just the Pair and eat the penalty" is still on the table and
  still wins when it genuinely pays more - which is r198 behaving as designed. The fix
  only stops a partition the game is about to reject from vetoing the one it would have
  accepted.
- **Measured, 2,400 random connected selections over 400 boards:** with NS at zero,
  **2,400 of 2,400 byte-identical**. With the ladder inverted (Pair +60, Run of 3 +40, and
  all three together) every difference is an improvement and **0 hands score lower** in
  any configuration; selections that were not a hand at all become one (`J♥ 4♣ 3♦ A♦ 2♣`:
  no hand -> Run of 4). Verified in a real browser on both boards the owner reported.

### The last slot books ONE obligation, and now says so (r281)

Owner: *"It won't let me select the slot above my current slot here."* That is
`mapLegalMoves`'s hard `set === MAP_SETS - 1` case returning only the review, which is the
r253 rule and correct - but the bar's visits chip still printed the generic **`1/2`**
there, so the game was telling the player a second obligation was owed and then refusing
it. It prints **`1/1`** in the funnel, and `mapBarInfo` names the reason ("the last slot
books one obligation, then the review") instead of the generic "not reachable from here".
Display only; no movement rule moved.

### Natural Scaling is a RATE TABLE, one row per hand type (r282)

Owner: *"Can we change the scaling bonus options such that each hand grants a different
bonus per play. A column for how many hands and what the bonus is. Then a toggle for if
it alternates between the mult and the pips."*

`nsPipsPerHand` / `nsMultPerHand` / `nsEveryHands` are **gone**. Every hand type carries
its own row in `NS_RATE_DEFAULTS` (js/natural-scaling.js):

```js
{ pips, mult, every, alt }
```

- **`every`** - the grant fires on every Nth play of THAT hand type.
- **`alt: false`** - each grant pays the pips AND the mult.
- **`alt: true`** - each grant pays ONE of them, alternating, **pips first**. So
  `+2 pips, +1 mult, every 2, ALT` is +2 pips on the 2nd play, +1 mult on the 4th, +2
  pips on the 6th. With `mult: 0` and ALT on, half the grants pay nothing, which halves
  the pips - the growth column in the editor shows that rather than hiding it.

- **THE ALTERNATION NEEDS NO STORED CURSOR, and that is the one non-obvious part.** A
  grant only fires when `plays % every === 0`, so the grant NUMBER is `plays / every` and
  odd/even on that decides the side. `nsPlays` is already in `SAVE_VARS`, so the
  alternation survives a save and resume for free and there is no second counter that
  could drift out of step with it. **Verified**: a run saved mid-sequence and restored
  continues at grant 3 (pips) rather than restarting at grant 1.
- **`nsRates` holds OVERRIDES ONLY**, in `localStorage` (`lethe.nsRates.v1`), exactly as
  the goal tuner does it (r197): an untouched row tracks whatever this file ships, and
  setting a field back to its shipped value **deletes** the override rather than pinning
  today's number forever. It is tuning, so it is **not** in `SAVE_VARS`, and
  `resetNaturalScaling()` (which `startGame` calls) clears the EARNED accumulators and
  never the rates. The two reset buttons are separate for that reason.
- **A hand type with no row scales at `NS_RATE_FALLBACK`**, the quietest rate in the
  table, rather than at nothing - a new hand type silently not scaling is the harder
  failure to notice.

#### How the shipped numbers were chosen

For a pips-only rate the growth in a hand's own WORTH (`base pips x base mult`) is just
`pipsPerPlay / basePips` - the mult term cancels - which is what `nsGrowthPerPlay()`
reports and what the table is tuned on. The rates set that **roughly inverse to how
available the hand is** (the r178 board survey: Pair 100%, Run of 3 73%, Straight 34%,
Flush 17%...), so a hand you can play on every board grows about **1% of its worth per
play** and a hand you reach for twice a run grows **8-10%**. That ordering is the whole
point: it is what keeps the harder hand ahead of the easy one nested inside it, which one
flat rate could never do (OPEN_DECISIONS 7).

Measured on the shipped table - plays of the short hand before it out-worths the long one
it lives inside: **Run of 4 -> Straight 35 · Flush of 4 -> Flush 35 · Run of 3 -> Run of 4
40 · 3oK -> Full House 63 · Flush of 3 -> Flush of 4 80 · Two Pair -> Full House 115 ·
Pair -> Two Pair 130 · Pair -> 3oK 165 · Pair -> Full House never**, against 8-21 plays
under the old flat rate. Over a simulated 18-round run the hands actually played finish
at **x1.0 to x1.6** of their starting worth.

**These are deliberately LOW - a conservative floor to tune up from, not a balance
proposal.** The node model and the live engine were cross-checked and agree to the play
on all nineteen hand types.

#### The editor

Dev panel -> Score -> Natural Scaling is one grid: **HAND · PIPS · MULT · EVERY · ALT**
(the rate) **· +P · +M** (what this run has earned, still typable to jump straight to a
value) **· N** (plays this run, and the growth-per-play figure). A row moved off the
shipped table is drawn in gold, so "what have I actually changed" is answerable without
diffing the source.

- **One grid template on every row INCLUDING the header**, so the header cannot drift out
  of line with the fields. Verified in a real browser: seven of the eight columns align to
  the pixel and the eighth is the 14px ALT checkbox centred in its 24px column.
- **`devSetNsRate` calls `devRenderNsRows`, never `devSyncNs`** - a full sync rewrites
  every field in the table and would tear the one being typed in out from under the caret,
  which is the same trap r201 wrote the split-value-write for.

### Natural Scaling bonus editor (r201)

The dev panel's Natural Scaling group now lists **every scalable hand type with its EARNED pips and mult as typed fields**, so "what does a Run of 3 at +50 feel like?" is answered by playing it rather than by grinding forty hands first. `setNaturalScaleBonus(name, field, value)` writes the accumulator; the sliders above it still only decide how fast it grows.

- **Rows come from `naturalScaleRows()`**, which filters `HAND_BASE` by `NS_HAND_FAMILIES` - so a new hand type appears in the editor for free, and **High Card is absent** because it has no family and can never scale (`setNaturalScaleBonus` refuses it too).
- **The markup is rebuilt only when the SET of rows changes** (`_nsRowsKey`), and values are written separately, skipping whichever field has focus. Re-rendering on every sync would tear the input out from under the caret mid-type.

### The hand-type label (r198) - `#hand-name`

What you are about to play, named, beside the hand preview. The preview CARDS stay inert until a hand is submitted (r99 - it is the scoring stage, not a live readout), but the NAME is live from the first selection, and with layered hands it is the only place the second hand is visible at all.

- **`updateHandNameLabel(result)` in `js/hud.js` is the only writer**, called from `render()`. It reads `handLayersFor`, so the label can never name a hand the score did not count or miss one it did.
- **One markup shape, two orientations.** Each layer is `<span class="hn-l"><b>FAM</b><i>SIZE</i></span>` from the `HAND_LABEL` table in `js/data/cards.js`; landscape stacks it into its narrow column ("RUN / 3"), portrait flattens the same spans onto one line with `display:inline`. No per-orientation renderer.
- **44px is the budget.** `#selected-cards` reserves that much left padding for this label; grow past it and a five-card hand's first card renders under the text. The label carries `overflow:hidden` as the hard stop and `.hn-layered` steps the type down to 7px, which is what keeps FLUSH inside it. Measured: label box ends at 42.9px, widest glyph at 35.6px.
- The cache guard compares the live `innerHTML` as well as the last value written, because Dominoes writes this element directly.
### Goal tuning (r197) - `js/goal-tuning.js`, dev panel -> Goals

The round goal was computed in **four** places, each spelling out `BASE_GOAL * GOAL_SCALE^(level-1)` with its own rounding: `level-up.js`, `game-control.js`, `dominoes-mode.js`, and Survival's own `survivalGoalForLevel`. Retuning difficulty meant an edit, a reload and a fresh run - and the start of a run and a level-up disagreed (see below). All four now call **`goalForLevel(lv)`**, which dispatches by mode (Survival/Flow curve, Zen's multiplier, otherwise Classic) and reads live tunables.

- **The shipped numbers are NOT copied into the tuner.** `goalTune(key)` falls back to the real constants (`BASE_GOAL`, `GOAL_SCALE`, `SURVIVAL_BASE_GOAL`, `SURVIVAL_GOAL_ROUND_TO`, `SURVIVAL_ENDLESS_ACCEL`), so an untouched knob tracks the data files and a retune there is still the shipped balance. `localStorage` (`lethe.goalTune.v1`) holds **overrides only**, and setting a knob back to its shipped value **deletes** the override rather than pinning today's number forever.
- **Growth is stored as a percent** ("35% harder each round"), not as a scale factor - it is the number worth typing. The panel is steppers built from `GOAL_TUNABLES` in `js/dev-panel.js`, the same shape as `FOCUS_TUNABLES`: add a row and the rendering, persistence and reset pick it up.
- **Knobs:** a global multiplier over every mode, then per curve - round-1 goal, growth %, rounding step - plus the endless acceleration and Zen's multiplier. Each group prints the real curve (R1 · R2 · R3 · R6 · R9 · R12 · R15 · R18, and the R18/R1 multiple), because a curve is only readable as the list of what it actually asks for.
- **Every change applies to the round in progress** (`applyGoalTuneLive()` rewrites `roundGoal` and repaints), which is the point of tuning here rather than in the data files. **Refused during a boss**: that number is being fought right now and The Ratchet has been raising it, so recomputing would move the goalposts mid-fight and throw the Ratchet's work away. It says so instead.
- **Round 1 is deliberately not rounded to the step.** `startGame` set the opening goal to a bare `BASE_GOAL` (1200) while the level-up formula rounded to the nearest 500 - so the shipped round-1 goal is **1200**, and rounding it in the shared function would have quietly dropped it to 1000. Round 1 never goes through the level-up path, so the two never disagreed in play; both are reproduced exactly. Verified: levels 2-25 are identical to the old formula in both curves.
- The global multiplier folds in **before** rounding, so a scaled goal still lands on the rounding step. Zen still multiplies **after** rounding, exactly as the inline `roundGoal *= 2` did.

### Scoring models (r179) - a dev toggle, not a decision

Three ways a hand type can be worth something, switchable in the dev panel's **Focus** group so they can be played against each other rather than argued about. `scoringModel` persists in `localStorage`; `classic` is the default and the shipped balance.

| model | base pips | mult | what hand type is then worth |
|---|---|---|---|
| `classic` | from `HAND_BASE` | from `HAND_BASE` | pips, mult and Focus |
| `mult_ladder` | 0 | from `HAND_BASE` | mult and Focus. All pips come from the cards you played. |
| `hand_size` | 0 | the number of cards played | Focus only |

**`handBasePips()` / `handBaseMult()` in `js/focus-config.js` are the single chokepoint.** Every read of a hand's pips or mult goes through them, so a model applies everywhere at once: `calcScore`, the payout breakdown, the live PIPS/MULT chips, the scoring dance and the RECORDS Hands tab. **A new site that reads `HAND_BASE[h].pips` directly silently ignores the model.**

- `detectHand`'s "flush unless the run is worth more" tiebreak compares `pips x mult`, which is 0 for every hand once base pips are zeroed. It now compares `max(pips, 1) x mult`, so the ranking still works in the no-pips models.
- **The retuned ladder is already close to hand size for most hands.** `mult_ladder` and `hand_size` differ only on Flush of 3/4/5 (2/3/4 vs 3/4/5), Two Pair (3 vs 4), Four of a Kind (7 vs 4) and Straight Flush (8 vs 5). Everything else has a ladder mult equal to its card count, so those two models are nearer each other than the names suggest.
- The Hands tab footer states which model is live, because two of the three make the Pips and Score columns meaningless.

### Focus tuning is plain English (r179)

The Focus dev controls used to be sliders labelled with the formula itself (`Linear - max(0, max_bonus - slope x t)`), which needed the source open to use. Every control is now a sentence plus a number you can type.

- **One table drives it: `FOCUS_TUNABLES` + `FOCUS_SPEED_MODES` in `js/dev-panel.js`.** Add a row and the panel, the persistence and the reset button all pick it up. Each row is `{ label, min, max, step, dp, unit, get, set }`; `get`/`set` read and write the live global.
- **Steppers, not sliders**: `[-] [number] [+]`, because these are exact values worth typing (2.5 seconds, 0.15 per node) and a slider cannot hit them across a useful range. Typed values are clamped to `min`/`max`.
- `focusMultStartNodes` and `focusMultPerNode` are new tunables for the multiplier's shape. They are deliberately **separate from `FOCUS_THRESHOLD`**, which also sets the meter's node colouring and charge spacing: retuning the multiplier should not redraw the bar.
- **`_devSafeRender()` guards every repaint.** The dev panel doubles as the main menu's Settings screen, where there is no board, and `render()` reads `gridData[0]` and throws. This was a live crash on the pre-existing exalt/corrupt toggle too.
- Both groups show a live preview of what the numbers produce (`Play after 0s: +12 · 1s: +10 …`).

### Unspent actions pay out (r218)

Swaps and discards you did NOT use pay `BAL._resources.unspent_credits` (3) each at the end of the round. Before this a round ended with leftover manipulates worth exactly nothing, so spending them on anything at all was strictly better than holding them; now the round's resources are a budget you can bank instead.

**There are two payment sites and they sit on OPPOSITE SIDES of the resource reset, which is the only subtle thing here.**

- **Classic and the act modes** pay it as a third payout line. That screen runs from `startInterlude`, which is reached from the goal dance and happens **before** `triggerLevelUp` - the reward grid comes next, and only when it closes does `triggerLevelUp` run and reset the counts. So the payout reads the **live** `swaps`/`discards`: at that instant they still hold what the finished round had left.
- **Survival and Flow** skip the payout screen entirely and pay from `survivalAfterLevelUp`, which runs **inside** `triggerLevelUp`, well after the reset. So they need the figure captured up front: `frozenUnspentActions`, taken at the top of `triggerLevelUp` (declared in `js/limits.js` beside the other frozen round figures).

The capture is taken **before** the carry-over knacks bank anything, so the figure is what you finished the round holding. Carry Swaps / Carry Discards then also carry it - that is the knack doing its job, not a double-dip to design around.

### Interact costs (r151) - ONE charge each, from `BAL._resources`
**Discard 3s per card · Swap 8s flat · Play free.** Until r151 there were **two overlapping cost systems** and both were live: a flat `spendRoundTime(DISCARD_TIME_COST/SWAP_TIME_COST)` *and* the `BAL._resources` figures. A 1-card discard billed 3+3 = **6s**, the 3rd swap of a round billed 4+10 = **14s**, and the Free Discards knack ("costs no time") still charged the flat 3s - all while the ⏱ Time pop-up quoted 3s and 4s. `DISCARD_TIME_COST` / `SWAP_TIME_COST` are now **dead constants**, kept and commented so nothing reintroduces the double charge; `freeSwapsLeft` (the "first 2 swaps free" exemption) is dead for the same reason. Costs come from `BAL._resources` alone, and `updateInteractCosts()` reads the same source so the pop-up can't drift from reality again.

- **Flow was billing its clock the whole time, and `interactTimeCostsOn()` (r234) is the fix.** `spendRoundTime` returns early for Flow and the Time pop-up quoted 0s, but **neither is what charges**: the two real sites (`js/discard.js`, `js/input.js`) write `roundSeconds` directly and neither consulted `flowActive()`. So every swap billed 8s off a session clock whose own comment says interacting must not be able to summon the inspection early. Both sites and the pop-up now read the one predicate, so the quote and the charge cannot drift. `spendRoundTime` has no remaining callers and is kept for the same reason `DISCARD_TIME_COST` is.
- **Playing a hand costs no time (r50):** the old "−5s per manual play (+ reward-grid penalties)" deduction in `playHand` was removed (owner request). Reward-grid play-cost debuffs (`extraPlayCostPerm` etc.) still parse but are inert.
- **Suits are NEUTRAL by default** (owner's decision, now shipped). A plain card scores only its pips × mult - no per-suit coin/time/pip/mult bonus. Suit effects come *only* from exalt/corrupt (below) or Tricks (♥/♣ Tricks in `calcScore`; Spade Flood etc.). The old defaults (♣ pips, ♥ mult, ♦ coin, ♠ time) are gone - see the "suits are neutral" comment in `playHand`.
- `findBestHand(cells)` brute-forces all connected 2–5 card subsets, scores each, returns the best. Handles wild sleights (temp rank/suit) and drops non-wild sleights from detection.
- `detectHand(cells)` returns the hand-type string. `activeHands` Set gates which hands are scorable (in Normal mode ALL hands are active from the start).

### Exalt / Corrupt (`exaltCorruptTotals`, `exaltCard`, `corruptCard`) - r45 spec
**PAUSED by default (r50):** the whole mechanic is gated behind `exaltCorruptEnabled` (a persisted flag, default `false`, toggled in the pause-menu Settings). When off: triggers don't fire (the trigger block in `playHand`, the `_heartSwapPending` set in `doSwap`, and the discard-corruption block in `doDiscard` are all wrapped in `if (exaltCorruptEnabled)`), `exaltCard`/`corruptCard` early-return, `exaltCorruptTotals` returns zeros, and `.exalted`/`.corrupted` glow classes are suppressed in `render`. Everything below describes behavior **when the toggle is on**.

Per-card flags `_exalted` / `_corrupted` are the *only* source of suit effects now (suits are otherwise neutral). State is **permanent + mutually exclusive** (whichever locks first wins; `exaltCard`/`corruptCard` clear the other). Buff totals computed in `exaltCorruptTotals` (pips/mult fold into `calcScore`; coins/time applied in `playHand`):
- **Exalted:** ♣ +10 pips · ♦ +3 coins · ♥ +2 mult · ♠ +4 time.
- **Corrupted (buff / cost):** ♣ +25 pips / −3 mult · ♦ +5 coins / −20 pips · ♥ +5 mult / −5 time · ♠ +7 time / −8 coins.
- Buffs/costs apply **per scored card** (3 corrupt clubs = +75 pips / −9 mult). Costs floor the resource at 0 (no debt): hand pips floored before `s = totalPips*mult`, mult floored at 1, coins/time `Math.max`'d. Visual: `.exalted` gold glow / `.corrupted` purple glow.

**Triggers** - each suit watches a different action. Counters live **on the card object** (e.g. `_clubPackPlays`) so they track the individual card and survive deck cycling; they reset only on `newGame`.
| suit | exalts when | corrupts when |
|---|---|---|
| ♣ | in a hand with **3+ clubs**, 2× (`_clubPackPlays`) | **lone club** in a hand, 2× (`_clubSoloPlays`) |
| ♥ | **only heart** in a hand, 2× (`_heartSoloPlays`) | swapped, then **misses the next scored hand**, 1× (`_heartSwapPending`) |
| ♠ | played in **first 30s** of round, 2× (`_spadeEarlyPlays`) | **discarded** 2× (`_spadeDiscards`) |
| ♦ | played while coins **< 5**, 2× (`_diaPoorPlays`) | played while coins **> 65**, 2× (`_diaRichPlays`) |

Wiring: clubs/hearts-exalt/spades-exalt/diamonds all fire in the `playHand` per-card loop. **♥ corruption** is a two-step flow - `doSwap` sets `_heartSwapPending`; the next scored hand resolves it (in hand → flag cleared/safe; absent → corrupt). A pending ♥ that's discarded corrupts immediately (`doDiscard`). **♠ corruption** also fires in `doDiscard`. Spade exalt needs `roundStartSeconds` (captured in `startRoundTimer`); window = `(roundStartSeconds - roundSeconds) < 30`.

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

**`double_tap` / `on_swap` - once-per-round lock (not discard-on-use):** These sleights stay physically on the grid after firing. `sleightCanActivateThisRound(card)` gates activation (checks `_usedThisRound` + remaining `_usesLeft`); `lockSleightForRound(card)` sets `_usedThisRound = true` and decrements `_usesLeft` after a successful trigger. The lock is cleared for every sleight on the grid in the round-start sweep (search `_usedThisRound = false`, right before `fireSleightsAtRoundStart()`). Once `_usesLeft` hits 0 the sleight just sits inert - it is **not** auto-removed; it can still leave the grid normally by being played in a hand or discarded by the player. Grid tooltips show "ONCE PER ROUND" / "USED THIS ROUND" for these.

### The Ringer (r218) - a spare card slipped into the hand

An epic `passive` Sleight, 10 charges. While it sits on the grid, submitting a hand pulls in ONE more card off the board when that makes a better hand: a third 10 becomes a fourth, a J-Q-K becomes a 10-J-Q-K. Four decisions, all in `ringerAugment` (`js/sleights-runtime.js`):

- **It ignores selection size.** The card is added AFTER the hand is found, so a selection limit of 3 can still submit a four-card set. That is why the hook is in `playHand` and **not in `findBestHand`** - findBestHand also feeds the live preview and the auto-submit, and augmenting there would promise a card before the player had committed.
- **It ignores adjacency.** `findBestHand` only ever builds orthogonally connected subsets, and the card that completes a run is usually nowhere near it. `detectHand` does NOT check connectivity (it only reads the cards), so the augmented hand is assembled directly and handed to it.
- **It fires at submit, after the Marker intercept** (r213) - a hand about to fizzle must not spend a Ringer charge. The added cell joins `selected` and `handCells` before the dance runs - so the dance's existing fly-into-the-preview animation carries it with no new animation code, and `toRemove = [...selected]` clears it with the rest.
- **It searches every rank on the board, and the first draft was wrong here.** Naming a fixed rank up front - the board's highest, say - reads well and almost never fires: nothing ranks above the highest card, so it can never extend a run. Verified on a board of 8-9-10 with a spare 10: a highest-rank Ringer found no improvement at all. Taking the best card on the board instead is what makes it do what its description promises. A hand it cannot improve spends no charge.

### Adjacency batch (r121)
Three `passive` Sleights + two Knacks built on grid adjacency (all orthogonal - `getNeighborsOrtho` / `_isOrthoAdj` in `sleights-runtime.js`):
- **Whetstone** - each adjacent card swapped or discarded banks `+1 mult` on the card itself (`card._whetMult`, so it survives deck cycling). A scored hand collects the full banked mult from every Whetstone orthogonally adjacent to at least one scored card; several Whetstones stack. Fed by `feedWhetstones(cells)` (called in `doSwap` + `doDiscard`, before the cards leave the grid), read by `whetstoneMultForCells(cells)` in `calcScore`.
- **Entourage** - `+10 mult` per *other* Sleight on the grid (`entourageMult()`); two Entourages each count the rest.
- **Lighthouse** - `lighthouseColumn` alternates first ↔ last each round (set in `triggerLevelUp` beside `shadyColumn`). `+20 mult` in that column, `−5` per column of distance, floored at 0 (`lighthouseMult()`).
- **Jury-Rig** (Knack) - swapping/discarding beside a Sleight rolls 50% to restore 1 charge, **once per Sleight per action** (deduped by `_id` in `juryRigRoll`); `restoreSleightCharge` never exceeds the printed `durability` and no-ops on `'infinite'`.
- **Tempo** (Knack) - **once, when acquired**, sets the swap and discard limits to 2 (`applyTempoLimitOnce` in `limits.js`, called from `updateKnackList()` and guarded by the per-game `tempoInitApplied` flag so later acquisitions don't re-slam it). It then gets out of the way: it does NOT lock the limits, so shop upgrades / Swap Shop / Harvest / events / other knacks stack on top of the 2 exactly as they would on the base - the design keeps wild combos open. The per-round drip (round-timer tick in `round-timers.js`) hands back 1 every 15s, alternating swap → discard → swap, refilling up to the **current** limit (so raising the limit also raises where the drip tops out); the alternation advances even when that stock is full, so the rhythm never stalls. `computeRoundResources()` has NO Tempo special-case - the lowered `limits.*.current` flows through the normal `limitSwapBonus`/`limitDiscardBonus` math. (Pre-existing quirk unrelated to Tempo: round-start discards come out one higher than the discard *limit* because `computeRoundResources` seeds from a hardcoded 4 while the limit base is 3.)

These Sleights add mult from *outside* the Trick system, so `calcScore` tracks them separately (`_whetM` / `_entM` / `_lightM`) and pushes `source:'sleight'` contribution rows; `contribDisplayName` now resolves `sleight`/`knack` sources against their own pools (previously sleight rows fell back to the raw id - Amplifier included).

### Pivot (r205) - a Sleight that works by sitting next to things

**Pivot is `passive` now, not `on_swap`.** It used to fire by being swapped itself. It now works by **sitting on the grid**: any card touching a Pivot with charges left swaps for **free**, and if one Pivot touches **both ends** of the swap, both cards take +5 permanent mult and that Pivot spends a charge and leaves the board. Brushing past a Pivot with only one end of the swap gets the free swap and nothing else - no buff, no discard.

- **Adjacency is 8-WAY here, and that is load-bearing rather than a flourish.** A swap moves two **orthogonally** adjacent cells, and two orthogonally adjacent cells have **no common orthogonal neighbour at all** - they sit on opposite colours of the board's checkerboard, and every orthogonal neighbour of a cell is the other colour. Under `_isOrthoAdj` the rule "one Pivot touching both ends" could never fire once. `_isTouching` / `livePivotsTouching` / `pivotForSwap` / `swapTouchesLivePivot` live in `sleights-runtime.js` beside the orthogonal helpers; do not swap one for the other.
- **Resolved BEFORE the cards move**, so "adjacent at the time of the swap" is what is actually measured. Pivot's own cell never counts as touching itself.
- **The discard is deferred ~260ms**, behind the 220ms FLIP swap animation: `discardSleightAfterUse` spins the tile then runs `removeAndFall`, which takes the `falling` lock, and starting that on top of the swap animation cuts the swap short.
- It leaves through `discardSleightAfterUse`, so it cycles back into the deck with its remaining charges (3 -> 2 -> 1) rather than being consumed outright. A 0-charge Pivot confers nothing - not even the free swap.
- The `'pivot'` case in `applySleightGridEffect` is now unreachable and says so: `fireSleightsOnSwap` never dispatches a `passive` sleight.

### Focus-payout entities (r123, revised r162)
Six entities that hook the **transition into max Focus** (`onFocusMaxed()` in `focus.js`, called from `addFocus` only on the `prev < cap && focusNodes === cap` edge). Credit/resource grants happen immediately; any Focus *drop* or cap change is deferred ~260ms via `setTimeout` so the fill-to-max animation plays first and we never mutate `focusNodes`/the meter while `addFocus`'s queue is mid-flight. When several entities drop Focus in one max, the deferred settle takes the **smallest keep-fraction** (biggest drop) rather than summing.
- **Dividend** (Knack) - each max → +8 credits, then Focus resets to **33% of max** (`keep_fraction 0.33`).
- **Release Valve** (Trick) - each max → +1 swap & +1 discard, then **lose 50% Focus** (`keep_fraction 0.5`).
- **Growth Spurt** (Knack) - each max **lowers the Focus ceiling by 5** (`growthSpurtCapPenalty`, applied in the deferred settle, subtracted in `focusCapNodes` and floored at one threshold = 10 - a permanent per-game erosion, reset on new game) and sets `growthSpurtMaxedThisRound`; if you maxed **at all** during a round, `triggerLevelUp` grants one `grantRandomLimit()` at that round's end and clears the flag. So repeatedly maxing trades your whole Focus-multiplier ceiling for ~1 limit/round.
- **Capacitor** (Sleight, `double_tap`, durability 1) - spend 10 Focus **and 20 seconds** → 10 credits, then removed from the grid (`gridData[r][c] = null` in the `input.js` intercept). Fails with a message if `focusNodes < 10`.
- **Siphon** (Sleight, `double_tap`, durability 4) - spend 15 Focus → sets `siphonMultX = 4`; then **leaves the grid** (decrement charge, `discardToDrawPile` if charges remain, else spent for good) rather than the once-per-round lock. `calcScore` applies `mult *= siphonMultX` **last** (after every additive mult), pushes a `source:'sleight'` contribution, and `playHand` clears it to 1 after the hand. Read-only inside `calcScore` so `findBestHand` stays consistent.
- **Trade Winds** (Knack) - `focusCapNodes()` subtracts 10 (floored at one threshold); at round end (`showLevelUpScreen_fallOnly` in `interlude.js`, before the meter zeroes) grants credits = `floor(focusNodes / 2)`.

`siphonMultX` / `growthSpurtCapPenalty` / `growthSpurtMaxedThisRound` are declared in `combos-aim.js` and reset on new game (`game-control.js`). See `FOCUS_IDEAS.md` for the larger focus-mode backlog.

### Double-tap sleights discard on use (r164)
The `double_tap` sleights **no longer sit locked on the grid once-per-round** - they now leave the grid the instant they fire, cycling back into the deck with their remaining charges, via the shared **`discardSleightAfterUse(card, r, c)`** in `sleights-runtime.js` (decrement charge → `discardToPlayed` cycles the copy or drops it if spent → `removeAndFall([[r,c]], 'discard')` animates it out AND gravity-refills the hole). Converted: **Amplifier, Snooze, Piggy Bank, Magnet, Capacitor, Siphon**. `lockSleightForRound` / `sleightCanActivateThisRound` remain only for the `on_swap` sleights (Dazed, Pivot).
- **Two traps this fixed.** (1) `discardToDrawPile` **silently drops sleights** (`if (card._isSleight) return;` - see deck-grid.js) - the r123 Siphon used it, so Siphon was consumed on first use regardless of its 4 charges. The cycling function is **`discardToPlayed`** (pushes a charge-preserving copy to `playedPile`, reshuffled next round by `flushPlayedDeck`). (2) Nulling `gridData[r][c]` by hand leaves a **permanent hole** - `removeAndFall` is what refills it, so the r123 Capacitor/Siphon left gaps.
- **Stopwatch is deliberately NOT converted.** It isn't a discrete "use": it's a drainable freeze budget (durability = paused seconds, destroyed at 0) you toggle on/off, so it already never sits inert-locked and self-removes when spent. Forcing discard-on-use would collapse its multi-session design.
- **Passive** (Whetstone/Entourage/Lighthouse/Fight the Power/Slow Burn), **aim** (Reflect/Soul Mirror) and **wildcard** sleights are exempt by nature - they work by *sitting on the grid* or leave by being played.

## What affected what (r209) - `js/entity-fx.js` + `css/entity-fx.css`

A player asks one question constantly and the board never answered it: **why is this card different?** Two surfaces, one vocabulary, both driven from tables rather than per-Trick code.

- **A marked row or column gets a coloured LINE down the board, behind the cards.** `renderLineMarkers()` draws one absolutely-positioned sibling of the cards per `rowColBonuses` entry, coloured from `LINE_FX_META`, with the owning Trick's glyph on both end caps. It **sweeps in once** when the Trick is acquired (`animateLineGrant`, called from `finalizePositionMark`) and then simply stays for the run. `_rcSeen` on the registry entry is what stops the sweep replaying - `render()` rebuilds these on every card fall.
- **The card side is a ring in the line's colour** (`.rc-line-ring`, from `lineRingHTML`). **This is the part that was missing**: only `rowcol_triple_pips`, `rowcol_mult` and `rowcol_retrigger` tinted their cards, so **Perfect Timing, Right Time, Study Hall, Groove, Assembly Line and Overtime marked a line the player could not see** - it was a number in a tooltip. One ring covers all nine. **A card on SEVERAL lines divides that ring between them** - see r223 below.
- **`z-index` is explicit, and it has to be.** Card elements carried no z-index at all, so paint order was DOM order - and `render()` appends new cards AFTER the markers, which would put a card dealt mid-round on top of a line while its neighbours sat under one. `css/entity-fx.css` sets cards/tricks/blocked cells to 2 and lines to 1. Boss cell overlays (12-15) and temp-anim clones (10) are unaffected.
- **Per-card marks are `CARD_MARK_META`, keyed by a `covers(r,c)` PREDICATE, not a position.** Two of them are derived: Ley Line and Temporal Rift both fire wherever a row effect crosses a column effect, which is a set of cells. **`leyLinePos` is never assigned by anything**, so the `.card.rc-leyline` tint it drove had been dead since it was written; Ley Line has a visible mark for the first time. Heartwood's mark reuses `Math.floor(rows/2) x Math.floor(cols/2)`, the exact expression `play-hand.js` buffs, so the mark can never point at a different cell from the one that gets the bonus.
- One mark per card by design - two glyphs in one corner of a 57px card is noise, and the tooltip lists the rest.

### The lines, finished (r223)

Four things r209's lines did not do. All four are owner spec.

- **They STAY ON THE BOARD DURING THE REWARD GRID.** `renderRewardTiles` empties
  `#grid`, which took the lines with it, so they vanished for the whole of every
  between-rounds screen - which is exactly when a player is deciding whether
  another line-marking Trick is worth a slot. It redraws them at its tail.
- **`renderLineMarkers(opts)` takes the GEOMETRY of the board it is drawing onto**
  (`{rows, cols, offX, offY}`, default the play board), because the reward grid is
  not always the play board: a **prize grid is two rows and columns smaller and is
  centred on it**, so the lines need its size and its offset or they sit under
  nothing.
- **Several lines on one row or column are spaced at `(i+1)/(n+1)` of the card** -
  one down the middle, two at a third and two thirds, three at a quarter, a half
  and three quarters. The first version divided the card into `n` bands and centred
  in each, which puts two lines at 25/75 and three at 17/50/83: lines hugging the
  card's edges rather than an evenly divided lane. Measured: 0.25 / 0.50 / 0.75.
- **A card on several lines SPLITS ITS RING between their colours** - equal wedges
  with hard stops (`lineMetasForCell` -> `lineRingPaint` -> `lineRingHTML`), so a
  crossing reads as both things instead of whichever the registry listed first. A
  blend of three Trick colours is a fourth colour belonging to nothing, hence hard
  stops. **The ring had to stop being a `box-shadow` to do this**: a box-shadow
  takes one colour and cannot be divided. It is paint masked down to the border
  now (`padding` + two masks + `mask-composite`). Verified: 3 lines give three
  33.3% wedges, a row/column crossing gives four at 25%.

#### `clampRowColBonuses()` - and why it reads the LIMITS

A Trick marking column 5 on a board that shrinks below it is marking a line that is
not there, which is a Trick that silently stopped working. It moves to the highest
line that exists and **stays** there; growing the board back does not move it. That
is lossy on purpose - the alternative is a shadow index that could resurface on a
board the player has since rebuilt differently - and `finalizePositionMark` is what
applies the move, so the Trick's printed description follows.

**It measures against `limits.grid_rows/cols`, NEVER against `gridRows`/`gridCols`,
and that is the whole reason it is safe to call.** Four things move the live board
size TEMPORARILY and put it back, and clamping against the live globals would let
any of them permanently move a line the player's real board still has room for:

| what | shrinks the live board |
|---|---|
| **Short Staffed** (reward-grid penalty) | one row or column, **for a single round** |
| the on-grid shop | forces 4x4, restores from `shopGridSaved` |
| the prize grid | two smaller than the play board |
| Dominoes | sets its own, twice (`dominoes-mode.js:115` **and** `game-control.js`, right after the limits assignment) |

Short Staffed is the one that would have hurt: a one-round penalty costing a Trick
its position for the rest of the run. So the clamp hangs off **`onLimitChanged`**,
the single place a limit actually moves, and everything that merely BORROWS the
board at a smaller size clamps what it **draws** instead (above) and leaves the
registry alone. Verified: a 4x4 prize grid drew a col-5 line at col-3 with the
stored index still 5.

### The score panel between rounds (r223)

`triggerLevelUp` banks and zeroes `score` before any between-rounds screen opens,
so the panel read **"Score 0"** over the NEXT round's goal for the whole of every
reward grid, shop and event - zero being neither true nor the number the player
wants while deciding what to take. It reads **LAST ROUND** over what the round
scored and **NEXT QUOTA** over what is being asked for next, with the progress bar
hidden (it would sit at 100% and mean nothing).

- It rides **`body.grid-screen`**, the class `enterGridScreenHud()` already sets for
  the PIPS/MULT/FOCUS -> LOCATION swap, so all three screens get it with no
  per-screen wiring. `updateScoreUI()` is the single writer.
- **`lastRoundGoal` must be captured ABOVE the level bump** in `triggerLevelUp` -
  `roundGoal` is recomputed four lines later and is the next round's target from
  then on. A first pass read it afterwards and recorded 1500 where the round that
  just cleared had been playing for 1200. `lastRoundScore` is captured lower, beside
  the `totalScore` banking, because it needs Survival's overflow figure.
- Both are in `SAVE_VARS` and reset in `startGame`.

### `shop-room-preview.html` (r223)

The two ways of giving the shop more room, on a stage laid out with the real
landscape percentages. **Squish** narrows the left column and every panel scales
with it (they are sized in container units against the column, so it genuinely
squishes rather than clipping); **Slide** pushes it off the edge at full size and
leaves an arrow tab. The readout MEASURES how many items fit a shelf rather than
asserting it: **5 per shelf today, 7 squished to 24%, 10 slid away.**

**The slide is a transform and the shop's edge is a stage percentage, so they
cannot share one number** - a `translateX` percentage is a share of the element's
OWN width, and the first version moved a 37.74% column by 37.74% of itself, about
15% of the stage, so it never cleared. Two variables: `--lw` (column width, stage
%) and `--colvis` (1 or 0).

### FLAT vs SCALING card buffs (r209)

`permPips` / `permMult` are **flat**: the card scores that bonus, unchanged, every play. Every offer site said "**permanently gains** +1 mult", which reads as growth - a player could hold a blessed card for a whole run waiting for a number that was never going to move.

- **The wording is now the type.** Flat says **"scores +5 mult when played"**; scaling says **"scales +1 mult each time it's played"**. `cardBuffLines(cardId)` in `js/deck-grid.js` is the single place a card's buffs are put into words, and the grid tooltip, the deck matrix and the reward tiles all read it, so they cannot drift apart again.
- **`permPipsGrow` / `permMultGrow` are the new scaling kind** - not scored, they are *how much the flat bonus rises per play*. Applied by `growCardScaling()` from `playHand` **after the score commits**, the same discipline `recordNaturalScale` follows: a buff earned by this hand pays out on the next one. Deduped per hand, so a retriggered card grows once.
- **Two stores, not one field with a flag**, because a card can legitimately carry both, and because every existing read of `permMult` keeps working untouched. Both are in `SAVE_VARS`, in `migrateCardKeysToIds`, and reset on a new run.
- **A scaling card needs its own marker or it is indistinguishable from a flat one** - both print "+N" somewhere. `.card-grow-mark` (a green arrow, bottom-centre) on the board; `.rec-m-g` in the RECORDS deck matrix, which matters because a scaling card may still have 0 flat pips and would otherwise read as ordinary.
- Offer sites: the reward grid's Blessed Card tile is now a 3-way roll (15% scaling mult / 25% flat +5 mult / 60% flat +12 pips), and The Bench event gained **Train** (scales +1 mult) and **Season** (scales +4 pips) beside its reworded flat boons.

## The cooldown / disable timer widget (r209) - `js/cooldown.js`

ONE widget for everything temporarily unavailable or temporarily charged: a countdown ring with the seconds left inside it, plus a grey-out of the host. Three modes, one shape - `{ mode, left, total, count }`:

| mode | means | host looks |
|---|---|---|
| `off` | switched off by a boss | greyed, red ring, counting down |
| `cooldown` | fired and recharging | greyed, amber ring |
| `primed` | charged and ready | **not** greyed, violet ring, charge count |

- **The rule that shapes the whole file: the widget NEVER re-renders its host.** A Trick chip lives inside a marquee/fan that measures itself on build, and a card element is reused across renders by `_id` - rebuilding either four times a second would restart the marquee and throw away in-flight card animations. `cdPaint` creates one `.cd-badge` child the first time and afterwards only writes its text and its `--cd-p` custom property; the ring is a conic-gradient reading that property. The driver is one 250ms interval (`cdStartTicker`, started from `startRoundTimer` **and** `startBossTimer` - a boss round has no round timer).
- **The grey-out is a WASH ELEMENT, not a `filter`.** A filter applies to the whole subtree and a child cannot undo it, so a filtered card would have dragged its own countdown badge down to 16% saturation - the one part of it that has to stay legible. `.cd-wash` is a sibling of the badge at a lower z-index. It is an appended element rather than an `::after` because `.card.rc-woodpecker` already owns that pseudo-element.
- **A tray chip a boss switched off already drains itself and stamps OFF** (r188), so on that one host the widget contributes only the ring - washing it as well double-dims it. `cdPaint` checks for `.trick-off`.
- **`renderCardAppearance` emits the badge too** (`cardCooldownParts`). `render()` rewrites a card's className and innerHTML wholesale, so a badge added only by the sweep would be wiped and re-added on every deal, swap and score - a visible flicker. `renderTrickTray` calls `cdPaint` for the same reason.
- **Adding a timed entity is one row in `TRICK_TIMERS`** (or one entry in `CD_PER_MINUTE_TRICKS`) and no new painting code. Wired today: the once-per-minute gates (Study Hall, Ley Line, Temporal Rift - they ride `firesThisMinute`, so the wait is always "until the clock crosses the next minute"), The Cuckoo, Compound, **The Woodpecker** (genuinely off for half of every minute, which nothing said out loud before), Minute Hand, every boss suspension, and every boss card hold.
- **A boss suspension with no clock prints no number.** `bossTrickOffSecondsLeft` returns null for the Voidwright's halves - they flip on a phase change, not a timer, so there is no honest number to show.

### Minute Hand: primed, not pending (r209)

It used to add +3 mult to ONE next hand - the same shape as Quarter Chime, and nothing for the player to see: the number arrived, was spent on whatever came next, and left. Now **every minute mark primes it and the next 2 hands each score +5 mult** (`BAL.minute_hand = { mult: 5, hands: 2 }`), so it has a state the widget can show and the player chooses which two hands spend it.

- **`minuteHandCharges` is read in `calcScore` and decremented in `playHand`**, never both in one place. `calcScore` is also called speculatively by `findBestHand` and by the live PIPS/MULT preview, which must not consume a charge - the same rule `siphonMultX` follows.
- A fresh mark **re-primes to the full count rather than stacking**: the value of holding a mark is meant to be playing the two hands, not banking marks.
- `pendingHandMult` is left in place as the seam a future "+N mult to your next hand" effect drops into; nothing feeds it today.

### Forced Trick fires (r234) - `js/force-trick.js`

**Priming cannot fire a Trick whose condition was not met, and that was never a
tuning gap - it is what priming IS.** A primed Trick replays its pip/mult DELTA
(`_cp[id]`/`_cm[id]`), and the replay loop opens with `if (!_pd && !_md) return;`.
Prime Rich Soil on a hand with no clubs and you get nothing; prime it twice and
you get nothing twice. A FORCED fire is the other half: the condition is ignored
and the Trick pays anyway.

- **It pays the Trick's NOMINAL value out of `BAL[id]`**, read through the same
  parameter vocabulary `js/improve.js` uses to decide what an improvement scales.
  "Only the bonus amount grows" and "only the bonus amount pays" are the same
  question asked twice, so a BAL retune moves both and a Trick improved to tier 3
  forces at its tier-3 value for free (`applyEntityTiers()` rewrites BAL in place).
  177 hand-written payouts would have drifted from BAL on the first retune.
- **An ALLOWLIST, never a denylist**, for improve.js's reason: a tuning number
  added to BAL later must not silently start paying out. Thresholds, intervals,
  costs, chances and cooldowns are absent on purpose.
- **A STEP IS AN INCREMENT, NEVER A FACTOR**, and `undertow` is the whole lesson:
  `{ pip_mult_base: 1.5, pip_mult_step: 0.5 }` is "x1.5 pips, plus x0.5 more per
  card beyond 3". Treating the step as a second factor multiplied 1.5 by 0.5 and
  produced **x0.75 - a forced fire that REDUCED the score by a quarter**. Measured.
  `Math.max(1, ...)` on both multipliers is the standing guard: a forced fire may
  pay nothing, but it may never cost.
- **`trickCanForce(id)` is what keeps it honest.** 92 of the 176 Tricks have a
  forceable payout; the rest pay in Focus, seconds or credits, or have no BAL
  entry at all, and would force for a visible message worth zero. Every caller
  draws from `forceableTrickIds()`, so an unforceable Trick is never offered
  rather than offered and silently empty. Boss-suspended Tricks are excluded too -
  routing round a suspension would make the Censor and the Voidwright optional.
- **NON-SCORING side effects do not fire.** A forced Tick-Tock pays no seconds.
  Same limit priming has always had (the `TBD` on Move as One), same reason
  `trickFires()` exists.
- **READ ONLY inside `calcScore`, spent in `playHand`.** calcScore runs
  speculatively for every connected subset in `findBestHand` and on every tap of
  the live PIPS/MULT preview, so consuming there would spend the charge dozens of
  times per selection. Same rule `siphonMultX` and `minuteHandCharges` follow.
  Verified: the arming survives 20 speculative re-scores.
- **A forced fire may MULTIPLY a hand, not REPLACE it.** Forcing pays a Trick's
  real value and a Trick's real value spans two orders of magnitude - **Rogue Wave
  measured at x130**, because it pays 80 pips AND 16 mult per card. `force_cap_x`
  (8) budgets each axis at **sqrt(cap)**, not cap: pips and mult multiply each
  other, so capping each at the full factor lets the two compound to cap^2
  (measured at x64 before the sqrt). Clamped BEFORE the event is emitted, never
  scaled back after - the dance replays this timeline and must reproduce
  calcScore exactly (r220), so a correction after the write is a drift by
  construction.

Measured on the r240 tree over **1,472 forced fires** on real boards, with the
Trick owned on both sides so the ratio is the forced fire alone: **common x1.67 ·
rare x2 · epic x1.68 · legendary x3**, max **x8.1** (the cap holding Rogue Wave),
**0 below x1 and 0 with no effect**. Seven real hands each forcing a different
Trick through the full dance in dev mode logged **0 timeline drift**.

### The Pick (r244) - `js/payout-pick.js` + `payout-pick-preview.html`

**Off by default** (Settings -> Motion -> "Card pick after payout"). After the
payout the board you just cleared COMES BACK, you pick one card off it, and you
do one thing to that card: **Boost** (+12 pips, permanently) · **Copy** (a second
one into the deck) · **Remove** (gone from the run). Then the reward screens run
as normal.

It is the deck manipulation that needs no shop, no consumable inventory and no
node. **Picking off the BOARD is the whole point** - an abstract list of 52 faces
is a spreadsheet, while the board is one you were building hands around thirty
seconds ago. It sits at the payout because that beat already exists, already
pauses and already belongs to the round that finished, so the operation costs no
node, no slot, no credits and no clock.

#### The un-explode

The goal finale blows the board apart (`js/score-dance.js`: outward from the
grid's centre, 200-340px, +-160deg, scale .82, fading, 900ms). Bringing the cards
back by REVERSING that blast is what makes this read as the round being rewound
rather than as a new screen opening. Same geometry played backwards on
`sfxRewind`, and **nearest the centre lands first**, so the board fills outward -
the exact reverse of a blast, and what stops it reading as an ordinary deal.

- **`render()` puts the cards back; this file only animates what the renderer
  produced.** Building card elements here would be a second card renderer to keep
  in step with `renderCardAppearance`.
- **`PICK_CFG` is tuned in `payout-pick-preview.html`**, which also draws the real
  finale for comparison. A fresh load of that page dumps a block **byte-identical
  to the shipped one** - verified, and it is the r233 rule: a preview that
  disagrees with the game is worse than not having one.

#### THE BOARD IS REALLY GONE BY THEN, so the pick carries a SNAPSHOT

The obvious reading - "the finale removes the card DOM while `gridData` still
holds every card" - is true of the SCORING FINALE and **not** of the interlude.
`showLevelUpScreen_fallOnly` runs before the payout and does the real thing:
`discardToPlayed(card)` on every cell, then `gridData` replaced outright with
nulls. Measured at the moment the pick opened: **4 rows, 0 candidates.**

So `pickTakeSnapshot()` is called from the TOP of `startInterlude`, above the
fall - the last moment the board exists - and the restore is **presentation
only**: the deck accounting already happened in the fall and must not happen
twice. The cards go back into `gridData` to be looked at and picked, and are
nulled straight back out when the pick closes, so every screen after this one
sees the post-fall board it expects.

`_id` is in `DURABLE_CARD_FIELDS`, so the copy now in `playedPile` is the same
card by identity. That is what lets Boost key off `cardId` and Remove splice the
pile without either caring which of the two objects it was handed.

#### Four traps, all found by running it rather than reading it

- **A module must not persist its own copy of a settings-backed flag.**
  `payoutPickEnabled` originally wrote its own `localStorage` key, and
  `js/settings.js` applies every row's stored value **or its DEFAULT** at load -
  so an unset row called `apply(false)` on boot and stamped the key back to off.
  Measured: the key read `on`, the reload read `false`. **One store, one writer**;
  the setting is the store and the module just holds the flag.
- **Remove must null the BOARD CELL as well as splice the pile.** Dropping the
  card from the snapshot alone left it sitting in `gridData` - out of the piles
  but still on the board, and therefore dealt straight back in at the next round.
  The board failed to empty on Remove and on nothing else.
- **A silent `catch` around an operation is a liability.** A bare
  `catch { note = '' }` swallowed a ReferenceError in Remove and the screen
  carried on as though the card had gone: the pile was spliced, the deck count
  was not, and only a deck audit two rounds later would have said so. It reports
  in dev mode now and tells the player it did not take.
- **The bar MEASURES itself and flips below the board when it does not fit
  above.** It changes height when a card is picked - one line becomes three
  option tiles - and the gap above the board is about 100px on a 1440x820
  desktop, so the first version ran the options off the top of the screen with no
  way to reach them. Same class of bug as the viewport cap on `.time-popup`: a
  pop-up placed in raw viewport px has to be clamped to one. Verified fully on
  screen at 1440x820 and 1100x620.

**The tap intercept sits ABOVE `onCardTap`'s `animating` guard**, because that
flag is routinely still true from the un-explode's flights and a tap that
silently does nothing reads as broken.

Verified in a real browser, all three operations through the real tap path: Boost
leaves the deck at 52 and puts +12 on that card's `permPips`; Copy takes it to 53;
Remove takes it to 51 with the card out of both piles and the board emptied. In
every case the snapshot clears, the pick closes and the reward grid opens, with
**the deck audit passing** and no page errors. Disabled and SKIP both leave the
deck untouched and the audit clean.

### The Hallmark knack (r234) - `js/hallmark.js`

A rare Knack. At a random moment in every round ONE card on the board is marked;
score it and it takes a random buff. It is deck manipulation that arrives through
PLAY - no screen, no inventory, no node. The decision is whether to build a hand
around the marked card before it leaves the board.

Seven outcomes, all from `BAL.hallmark`: **+5 mult · +10 pips · +1 replay · 3s
rewind · 3s pause · a Trick primed · a Trick forced.**

- **THE MARK PAYS FORWARD, AND ALL SEVEN DO.** It resolves in `playHand` after the
  score commits, beside `growCardScaling` and `recordNaturalScale`, for the reason
  those two sit there: a buff earned by a hand pays out on the NEXT one. The card
  buffs land permanently and pay from the card's next play; the prime and the
  forced fire arm the next hand; only the two clock outcomes are instant, because
  a clock is instant. One rule for all seven rather than three being special.
  Resolving before the score would mean rolling inside `calcScore`, which fires
  dozens of times a selection.
- **The mark is a `cardId` in a global, not a cell and not a field on the card.**
  A cell slides onto whatever card falls into the slot (the trap The Hold avoided
  in r209, and why r192 re-keyed every per-card buff off `cardId`). A card field
  would need a `DURABLE_CARD_FIELDS` entry to survive the deck cycle and
  un-marking on three paths. One global compares clean and saves as one string.
- **`hallmarkPlanted` is separate from `hallmarkCardId != null`**, which goes back
  to null the moment the mark is spent - without the flag the round would
  immediately plant another.
- **The window stops `HALLMARK_TAIL_FRACTION` (25%) short of the round's end**, so
  a mark always lands with time to use it. A mark with four seconds left reads as
  the knack not working. A tick with no legal card on the board (mid-fall, a
  blocked board) does not burn the round's mark - it retries next tick.
- **Its `CARD_MARK_META` row is FIRST on purpose**: `cardMarkHTML` returns the
  first hit, and a mark you must spend this round outranks a standing one.
- Clock outcomes go through `rewindTime` / `pauseRound`, never a raw
  `roundSeconds +=` - that is what keeps the floater and the Kingfisher/Albatross
  tallies honest (r183). `prime` and `force` fall back to the pip buff when
  nothing you own can take them, rather than rolling an outcome worth zero.

### The Understudy knack (r209)

`{ id:'understudy', rare }` - every 30s of round time, one random Trick in the tray is **primed**: it fires an extra time on the next hand. It needed **no per-Trick code** because priming is the mechanic the Rehearsal event already built (`calcScore` fires a Trick an extra time per `_primed` stack), and the primed tile shows its charge through the same widget. The knack's own chip carries the countdown to the next prime (`cdForKnack`). `understudyNextMark` is seeded to the first interval, not 0 - `_elapsedRound >= 0` is already true on the round's first tick, which would prime a Trick one second into the run.

### Two bosses on the widget (r209)

- **THE HOLD** (`card_hold`) - every 15s a random card is held for 15s, with its countdown on the card. **Keyed by card identity, not by cell**: cards fall, and a cell-keyed hold would slide onto whichever card dropped into the slot (the same reason r192 re-keyed every per-card buff off `cardId`). A held card is answered by **`isCellBlocked`**, which is the trick `nullCells` already uses - every select, tap, swipe and reachability guard in the game asks that one question, so the hold needed no changes in `input.js`, `hand-detect.js`, `match3.js` or `tutorial.js`.
- **THE ROTA** (`trick_rotate`) - exactly ONE Trick down at a time for 30s, then a different one, never the same twice in a row. The Censor's windows overlap on purpose (two down at once for a stretch of every cycle); this is the readable version - you always know precisely what you have lost. Gated by `bossPresetIsLive` below 2 Tricks owned.
- **`bossSuspendTrick(id, secs)` is the single place a suspension is written**, recording the window in `bossDisabledTotals` so the ring has a denominator. The Censor routes through it too, so the two bosses cannot disagree about the bookkeeping.

**Answering "can nulled cards be played?" - no.** There are now three kinds of unusable, all funnelled through `isCellBlocked` so every existing guard covers them: **VOID** (`blockedCells`, legacy boss patterns - the card is returned to the deck and nothing falls in), **QUARANTINED** (`nullCells`, The Quarantine - cards still fall in and fill the slot, they are just inert, permanently), and **HELD** (`bossHeldCards`, The Hold - one card, inert, expires). The other card debuffs in the game are **curses** (`cardCurses` / `CURSE_DEFS` - Leaden scores 0 pips, Taxing costs 3s a score, Snared cannot be swapped or discarded; each lifts after N scores), **contamination** (`dampCells`, The Blight - half pips and Tricks may not fire), **rank recall** (The Recall - a whole rank off the board), and **hand redaction** (The Redaction - one hand type scores x0.4).

## Events (node-based, Normal mode)

Reward grid destination tiles set `pendingEventOverride` → `closeRewardGrid()` routes to shop or `openEvent()`. Events render in `#event-overlay`. Implemented: **Confluence** (theme draft), **Crossroads** (sacrifice trades), **Gamble** (doors / double-or-nothing), **Wandering Merchant** (free rare items), **Altar** (multi-round investments via `altarEffects[]`), **Cleansing Spring** (purge/restore), **Twin Path** (2 Tricks + shadow debuff), **Shift Change** (reorder your Trick tray). All triggerable from the dev panel.

**Adding an event:** write `renderX` + `confirmX` in `js/events.js`, then register the id in FOUR places in `js/events-core.js` - the `pool` array in `openEvent`, the `handlers` map in `confirmEvent`, `EVENT_META`, and the `renderers` map in `renderEventShell`. The dev panel's event list is generated from `EVENT_META`, so it picks the new one up on its own.

**Event visual language (r183) - do not drift from this.** Events used to be a black sheet with a serif heading and some bordered boxes: correct information, no relationship to anything else in the game. They now use the **reward grid's** material, because that is the screen an Event always arrives from. The markup gained one wrapper, `#event-panel` (every id inside is unchanged), and the rules are:
- **One console.** `#event-panel` is a bezelled CRT box - cool indigo wash behind it, 2px plastic ring, violet glow, scanlines over the whole panel, a sticky marquee bar (`#event-bar`) at the top and a **sticky action footer** at the bottom so CONFIRM is never something you scroll to find. Both sticky bars carry an **opaque** base colour: the panel scrolls under them.
- **Rarity is the border colour, never the background.** `makeChoiceEl` puts `rar-<tier>` on the tile from `opts.rarity`, which sets `--rc` - the same five colours as a reward-grid tile (mint / cyan / purple / yellow / magenta). An unknown tier is left uncoloured rather than guessed at.
- **A downside is red and nothing else is.** `.event-choice.debuff` forces `--rc` red and adds a diagonal hazard stripe down its left edge, so a liability can never be misread as a rarity.
- **Type roles:** names are Orbitron caps, prose is Crimson Pro, labels/costs are Share Tech Mono. CONFIRM is the reward grid's green; SKIP is the muted secondary. Both were **browser-default grey buttons** before r183.
- **Use the shared chrome, not inline styles.** `evLabel(text, danger)`, `evNote(html)` and `evEmptyHTML(text)` in `js/events-core.js` replaced a dozen near-identical `style.cssText` strings scattered through `js/events.js` - which is how the events drifted apart in the first place. `.ev-stack`, `.ev-cardchips` / `.ev-cardchip` (Cleansing Spring's deck picker, now real mini playing cards) and `.ev-btn` cover the rest. **No new inline styling in an event renderer.**

**Shift Change (r182)** - `renderShiftChange` / `renderShiftRow` / `confirmShiftChange`. Tray ORDER is load-bearing (Inspirato primes first+last · Mirror borrows from its neighbour · Prime Times cycles 1st→2nd→3rd→5th→7th · the Alignment knack marks the column matching a Trick's slot · Move as One picks the lowest-rarity keyword match) and until now there was no way to change it after a Trick landed. Interaction is **tap-to-swap** (tap to lift, tap another to trade), which works the same with a finger and a mouse and needs no drag; `eventState.shiftOrder` is a copy, so nothing is committed until Confirm, and Skip leaves the tray alone. Holding fewer than 2 Tricks pays `BAL.shift_change.consolation_credits` instead. Position Tricks **keep the line they already marked** - `assignPositionMark` is guarded by `_posAssigned` and is deliberately not re-run, so reshuffling moves the Tricks and not the lines you were building around.

## Trick slots full / Choose a Trick to lose (`#trick-lose-picker`)

One screen with two jobs, both in `js/reward-grid.js`: **'lose' mode** (a debuff takes a Trick off you, `openTrickLosePicker`) and **'replace' mode** (`injectTrickAfterReward` found the tray at `trickCapacity()`, queued the new Trick in `_trickReplaceQueue` and called `maybeOpenTrickReplacePicker`). `_blpMode` decides which chrome is set.

**r183 restyle.** It was a black sheet of grey text boxes. It is now the same console as the events, with two deliberate differences:
- **It is RED-lit, not indigo.** Every other console gives you something; this one takes something away, and the room should say so before you read a word of it.
- **Every row carries the real entity tile** (`entityTileHTML`, js/entity-tile.js), and in replace mode `#blp-incoming` shows the **incoming** Trick as a tile above the divider, so the trade has two visible sides. The tile keeps its own rarity colour while the ROW turns red when picked - "this is the one I am losing" must never be confused with "this is an epic". The tile's own `.rwd-name` is hidden inside a row (`.blp-item-tile`) because the row prints the name in full right beside it; the same deliberate exception the portrait tray makes when it fans its chips.
- `#blp-count` prints live `held / cap`, the number the whole screen is about. Both panels reset `scrollTop` on open - they are reused, and reopening where the last one left off hides the title under the sticky bar.

The Mart wheel has its own overflow prompt (`#wheel-overflow`, "NO ROOM", js/wheel.js) with a **different** resolution - sell one of yours, or sell the prize. It already speaks the Mart's language and was deliberately left alone.

## Guided mode (r229) - `js/guided-mode.js`

An act is **`GUIDED_SLOTS_PER_ACT` (8) slots** and then the boss. Between every slot the **crossroads** opens and you choose what fills the next one: a **level** (play a round - free, and how you earn credits), a **hard round**, a **reward grid**, the **Mart**, a free **pick of three**, or an **event**. Everything except a level costs the slot AND, mostly, credits.

**The slots are the real currency, not the credits.** Buying power always costs a round you will not get to play, so the question an act asks is how much of your run you are willing to spend getting stronger rather than getting further.

### Every slot advances the difficulty curve, bought or played

**This is the load-bearing rule and the mode does not work without it.** The goal curve is driven by `level`, and `level++` lives in `triggerLevelUp`, which only runs when a ROUND starts. So if a bought slot left the curve alone, a player could buy six stops and meet the boss at level 2 holding a level-8 loadout. That is not a strategy, it is *the* dominant strategy. `guidedAdvanceCurve()` therefore bumps `level` when a stop is bought, exactly as finishing a round would.

### The crossroads is FOUR tiles, drawn by weight (r229)

It was a fixed menu of five chips, which made every crossroads the same decision. It is now **four tiles dealt onto the board**, so a crossroads is a hand you were dealt.

| kind | chance | |
|---|---|---|
| level | 90% | free |
| reward grid | 75% | `price_reward` |
| Mart | 50% | `price_shop` |
| hard round | 25% | free |
| pick of three | 20% | free |
| event | fills whatever is left | `price_event` |

- **Rolled independently, then TRIMMED FROM THE BACK** (`guidedRollOffers`). The table is in descending probability, so a crowded roll keeps the staples rather than dropping them for a novelty. Verified over 4,000 draws: never more than 4.
- **The kind you just took is not offered again**, so a crossroads can never be the decision you just made. **Events are the one exemption**: they are the filler, and a different event id is a different tile. Verified - across 3,000 draws the only kind that ever repeated was `event`.
- **A level is forced every `GUIDED_LEVEL_EVERY` (3) choices**, and the forced level BEATS the no-repeat rule - otherwise "you must play" could be blocked by "you must not repeat". Verified: 1,333 of 1,333 due draws carried one.
- **Repeat purchases cost `GUIDED_REPEAT_STEP` (3) more each time within the ACT** (`guidedBuysThisAct`, cleared by `guidedAfterPrizeGrid`). Buying the Mart twice is allowed and costs more the second time, which self-balances "just buy the Mart every slot" without a rule against it. Measured: 12 / 15 / 18.
- **The tiles are drawn ON THE GRID at about a quarter of the board each**, dealt in with the reward grid's own fall animation - because that is what this screen is, a board of things to take. Leftover cells on an odd-sized board are filled with **inert black cards** (`.gx-filler`), never left as holes: a hole in a board of cards reads as something failing to load.

### Hard rounds - the elite (r229)

A round with a raised goal AND one extra requirement, paying credits for both. `CHALLENGE_DEFS` is the whole list.

- **The requirement must be readable from counters the round already keeps**, or every one needs its own hook in `playHand`. All four read `handTypesRound`, `handsPlayedRound` or the hand log. That is the whole reason this is cheap.
- **Failing the challenge is NOT failing the round.** Clear the raised goal and the round passes as normal; meet the requirement as well and you also take the bonus. A node that can end a run on a technicality is not an elite, it is a trap, and a player would simply never take one.
- `guidedApplyPendingChallenge()` runs in `triggerLevelUp` **after** the curve and the penalty multiplier, so it lifts whatever they produced. `guidedSettleChallenge()` runs at the goal clear from `showPayoutUI`'s caller, **before** `triggerLevelUp` resets the counters every test reads.

### Take your pick - the free pick-of-three (r229)

Three rewards, one of each type, take one, no charge. It is the BASE reward of the mode: every other tile costs a slot and credits, so this is the one that simply pays.

**It draws its own entities and must.** The reward grid's payload factories (`makeTrickPayload` and friends) are **NOT globals** - they are nested inside `_generateRewardContent`, the same scoping trap `shuffled()` set for the r194 events. Calling them here produced three silent nulls and an empty panel. `guidedPickThreeOffers()` draws through `pickEntityByRarity` (the shared rarity table, so Luck tilts it identically) and `survivalEntityBanned`, then grants through the ordinary paths.

### A tap selects and reads; only CONFIRM commits (r280) - `js/grid-pick.js`

Owner: *"Pick threes should require a confirm. Tapping on them should extend the
description, or bring up a tooltip. But also, the text for the description can be
a tad smaller so you can read more of it."*

A tap used to APPLY the offer on the spot. That made this the one screen in the
game where an unrecoverable grant sat one stray tap away - and it was being made
against a description clamped to three lines, with the rest behind a 10px `…`
that was itself the only thing on the tile that did NOT choose. Now **one tap
marks the tile AND opens its full description**, and a **CONFIRM tile in the
action row** is what takes it. Reading and choosing are the same gesture;
committing is a separate one.

- **CONFIRM owns the last `GP_CONFIRM_W` (2) cells of row 4 on EVERY screen that
  comes through here**, with or without actions of its own, so the control that
  commits is always in the same place (the shop's LEAVE and the reward grid's
  CONFIRM are fixed for the same reason). A caller's actions fill
  `GP_ACT_COLS` (4) to the left of it - **`survivalPickActions()` returns exactly
  four now**, unpadded; a fifth would be sliced off rather than drawn.
- **It names what it is about to take** ("CONFIRM / Cornered"), so the last thing
  read before committing is the choice itself. `gridPickPaintSelection()` writes
  it and lights the tile, and is deliberately **not a redraw**: the options deal
  in once per screen and re-rendering for a tap would replay the fall and restart
  every object's drift.
- **THE READ IS THE NON-INTERACTIVE TOOLTIP, AND THAT IS LOAD-BEARING.** An
  interactive bubble (one carrying buttons) brings a full-screen backdrop that
  swallows the pointerdown dismissing it (r182), so moving to another option
  would cost two taps on the one screen where comparing three things IS the task.
  The plain bubble is `pointer-events:none` (css/tooltip.css) and a tap goes
  straight through it to whatever is underneath, CONFIRM included. Verified: with
  the bubble up, one tap moves the selection.
- **`data-et` moved onto the TILE** (`tip: false` on the object). Both carrying
  it would re-anchor the bubble every time the pointer crossed between the object
  and the words under it, because the delegated listener keys on the NEAREST
  `[data-et]`. It also gives a **LIMIT** offer a tooltip for the first time - it
  has no object at all, so it was the one offer on this screen with nothing to
  read.
- **The ellipsis is a MARK, not a control** (`pointer-events: none`). It says the
  description is clamped; the tap that reads the rest is the tap on the tile. A
  player reaching for the rest of a sentence must not fail to select the thing
  they were reading. The r255 "move the description entirely into the chip"
  behaviour goes with it: the selected tile going blank while its own tooltip is
  up reads as broken.
- **NEW OFFERS DROP THE SELECTION.** A reroll swaps what is on the board out from
  under it, so index 1 is a different entity afterwards and holding the mark there
  would arm CONFIRM on something the player never read. An actions-only
  `gridPickRefresh` (Survival repainting affordability as credits move) keeps it,
  and so does the peek.
- **The description is 7.5px, not 9, and clamps at 5 lines rather than 3.** The
  tile is a fixed 2x3 cells, so setting it smaller is the only way to get more of
  the text onto it - about 80% more lands before the tooltip is needed at all.

Verified in a real browser at 1440x820 and 420x820, through the real tap path, on
all three screens that use this: the guided pick-of-three, Survival's
pick-of-three (4 actions + CONFIRM, no overflow) and the map's 2-knack pick. A
tap grants nothing, CONFIRM with nothing selected does nothing, the tiles are
cleaned out of `#grid` on close, and there are no page errors.

### How it routes

- **`guidedAfterSlot()` is the single place that decides "another slot, or the boss"**, so no caller has to know how long an act is.
- **The payout hands back to the crossroads, not to a reward grid.** In Guided the grid is something you BUY. The post-boss **prize** grid is not a bought stop and still opens from `startInterlude`.
- **A bought reward grid must set `rewardGridContext = 'interlude'`**, not a context of its own: that is the only value whose continuation reaches `finishInterlude`, where the guided return lives. `'guided'` fell through to the legacy timer path and the grid closed into nothing.
- **`guidedInStop`, NOT `nodeInAct`, tells a bought grid from the prize grid.** `nodeInAct` is kept in step with the slot count purely for the HUD's pips and the boss sigil, and can legitimately read 5 for either.
- **A bought event is opened BY NAME** (`guidedOpenNamedEvent`) - the player paid for that specific one off the board. It still feeds `recentEventIds`.
- **An act opens on a LEVEL**, not on the crossroads: `guidedAfterPrizeGrid` goes straight to `drainLevelUpQueue()`.

#### The routing was documented and never written (r234)

The three functions the section above describes - **`guidedAfterSlot`,
`guidedAfterPrizeGrid` and `guidedAdvanceCurve`** - were called from four places
and **defined nowhere**, and `guidedOpenCrossroads` was defined and **never
called**. So Guided threw on the first crossroads choice, and the screen the
whole mode is never opened at all. They are written now, to the contract the rest
of the file already assumed.

- **`guidedAdvanceCurve` is deliberately NOT `triggerLevelUp`.** That function
  also banks the score, flushes the deck, resets the round resources and deals a
  board, none of which has happened, because no round was played. Only the two
  lines that ARE the curve are reproduced: `level++` and the goal recompute, with
  the Quota Revision penalty applied after it in the same order `level-up.js`
  uses. A bought slot moves the bar and nothing else. Verified: buying a stop
  takes level 1 to 2 and the goal 1200 to 1500.
- **`guidedAfterSlot` is the only thing that opens the crossroads**, which is what
  makes it the single place that decides "another slot, or the boss". It keeps
  `nodeInAct` in step with the slot count for the HUD's pips, and arms the boss
  through **`bossesEnabled()`** rather than unconditionally, so a run with bosses
  switched off still reaches the end of its act.


## Dev picker (r234) - `js/picker-mode.js` + `css/picker.css`

Every other entry in `MODES` is a fixed set of answers to the same few questions.
Classic answers them one way and Flow another, and the only way to try a
combination nobody had written down was to add a tenth mode. **Custom** (last card
in the mode carousel) asks the questions instead and **synthesizes a `MODES` entry
from the answers**.

That synthesis is the whole design decision. `pickerBuildMode` emits the SAME
flags the hand-written modes carry, so everything downstream keeps reading what it
already read and a custom run is not a special case anywhere outside this file.

| question | sets | reaches |
|---|---|---|
| Deck | `suitCount`, `numeric` | `ACTIVE_SUITS` / `ACTIVE_RANKS`, `applyModeHandValues`, `applyModeEntityFilter` |
| Between rounds | `actStructure`, `guided`, `survival` | the three between-round routes in `level-up.js` / `interlude.js` |
| Round clock | `clock` | `currentRoundDuration`, `roundClockEndsRound` |
| Interacting | `timeIsCurrency` | `interactTimeCostsOn` |
| Bosses | `enableBosses` | `bossesEnabled` |
| Submitting | `autoPlayHands` | `autoSubmitDelay` |
| Hand values | `scoringModel` | `handBasePips` / `handBaseMult` |

### The rule the file exists to enforce

**An axis is only offered if it is a REAL CHOKEPOINT.** A question the engine
cannot honour is worse than no question, because the run then quietly plays as
something other than what was picked. Four of the seven flags above were
**inert before this** - `enableBosses`, `enableShops`, `enableEvents` and
`autoPlayHands` were read by nothing outside `menu.js`, and `timeIsCurrency` was
read by a comment. Each one either got a chokepoint or stayed out of the picker.

**Where two axes are welded together, the picker FORCES the dependent one and
says so on screen.** `pickerResolve` is the single place that happens, it returns
a CLEANED COPY so stepping back and changing the cause restores what the player
had picked, and a forced answer is drawn **amber** rather than as a normal tick,
so "I chose this" and "this was chosen for me" can never be confused. Today the
one forced pair is no-clock implying free interacts: with nothing to fail against
there is no deadline to bill.

### Between rounds is ONE question, on purpose

Reward system and run structure look like two axes and are one. `survivalActive()`
gates the pick-of-three loop, the endless structure, the score carry-over, the
2:00 round and the entity bans across **30 call sites**, and `level-up.js` returns
on it before any act routing runs. Splitting them is real work on the level-up
spine. So the picker asks the question the engine can actually answer and prints
the structure in each option's own text rather than offering a second choice it
would have to override.

### What had to change to make the axes real

- **`survivalActive()` and `flowActive()` are FLAG-BASED, not id lists.** They
  tested `ACTIVE_MODE.id === 'survival'`, which a synthesized mode can never
  match. Both shipped modes already carried the flags, so this is behaviour-
  identical for them and is what lets a custom run opt into the package.
- **`roundClockEndsRound()` suppresses the END of the round, never the tick.**
  About fifteen sites measure "how far into the round are we" as
  `roundStartSeconds - roundSeconds` (The Swift, Sediment, the Cuckoo, the
  Woodpecker, the clock marks). Freezing the tick, which is what Zen does, kills
  all of them silently. The clock runs and only `onRoundEnd` is skipped, so a
  no-limit round still feeds every timing entity a real elapsed figure. **A boss
  window always ends the round** - that clock is the boss. Verified: the clock
  reaches 0, the round does not end, the timer stays live and elapsed reads 600.
- **`interactTimeCostsOn()` is the one answer to "do swaps and discards bill the
  clock", read by the two sites that charge AND by the Time pop-up that quotes
  them** - the same discipline r151 imposed after the double-charge bug.
  **Wiring an inert flag up changes whatever was carrying it wrongly, and this one
  caught Survival.** Its mode entry said `timeIsCurrency: false` while the charge
  sites billed its 2:00 clock anyway, so honouring the flag would have made
  interacting free in a shipped mode as a side effect. The FLAG was corrected to
  `true` rather than the predicate weakened, because that is what Survival does.
  Verified: Classic, Guided, Six Suits, Spectrum, Survival and Orientation all
  still bill 6s for a two-card discard, and only Flow bills 0.
- **`bossesEnabled()` gates ARMING a boss, never the boss code.** A run that has
  somehow already started one still finishes it rather than being left with
  `bossActive` and no way out. With bosses off, node 5 is an ordinary round that
  closes the quarter, and `startInterlude` asks for the **prize grid** there
  anyway: beating the quarter should pay out whether or not a boss was standing
  in front of it.
- **`autoPlayHands` only sets the auto-submit DELAY** (2000ms, or 350ms). A valid
  hand has always submitted itself on a timer; a separate auto-play path would be
  a second way into `playHand` to keep in step with this one.
- **`modeEntityTags()` gates entities on the DECK, not on the mode's name.**
  `applyModeEntityFilter` matched `t.modes` against `ACTIVE_MODE.id`, and Monopoly
  is `modes:['spectrum']` - so a custom run on the colour deck was the one place
  in the game those Tricks were unobtainable. A numeric deck adds the `spectrum`
  tag, a six-suit deck adds `sixsuits`. Verified: a custom Spectrum run offers
  Monopoly (164 Tricks, the 13 suit and court ones filtered out).
- **`survivalEntityBanned` asks the CLOCK, not the mode.** First Wind and Carry
  Time assume a round clock that refills, so they are banned wherever there is
  none. That test could not stay behind the `survivalActive()` early return,
  because a custom no-clock run played on reward grids is not survivalActive() at
  all.

### The save has to carry the ANSWERS

A picker-built mode is not in `MODES` when the page next loads, so
`MODES[save.meta.mode]` would fall back to Classic and the run would resume as a
different game. `meta.picker` stores the answer set and the restore path rebuilds
`MODES.custom` from it before the lookup. `pickerBuildMode` is pure, so that
reproduces the exact mode the run was started with.

### Two notes on the screen itself

- **It lives inside `#cab-screen`, beside the mode carousel**, so it is drawn ON
  the CRT. That means the camera's wide framing scales it DOWN, the opposite of
  the `#event-panel` trap: a 760px panel paints at about 535 real px on a 1440px
  desktop. Three of four options fit without scrolling and the rest scrolls.
- **Rail, scrolling body, sticky footer**, the same frame `#event-panel` uses and
  for the same reason: the control that commits must never be something you have
  to scroll to find. The summary rows are real buttons back to their own question,
  because the line above them says they are tappable.

## Map mode (r238) - `js/map-mode.js` + `css/map-mode.css`

One act as a MAP drawn on the borrowed grid (the shop's borrow pattern): **4 lanes x 6 sets** of tiles plus a full-width boss column. Landscape reads left to right, portrait top to bottom - the data model is lane/set and only the renderer transposes.

- **Movement is strictly orthogonal and EVERY step activates the tile.** At most 2 visits per set (so a set's two tiles must be vertically adjacent); forward always enters the next set at your lane. Leaving after ONE visit pays `MAP_SKIP_BASE + MAP_SKIP_STEP * n` credits (6, 8, 10...). Set 1 is all levels; sets 2-5 carry >=1 level each; the last set is the FUNNEL - two non-level tiles on non-adjacent lanes, you take exactly one. Blanks (inert, not passable - a knack may change that later) are a ROLL, not a fixture (`MAP_BLANK_ODDS`, r244): measured over 10,000 maps, **51% carry two, 38% one, 11% none**, so a dead cell in your way is something to read off the map rather than a constant. Fewer blanks FREES middle cells, so the minimums only ever get easier. (The funnel's two structural blanks are separate and always there.) Up to 2 mysteries (real kind hidden until confirmed, still counted in the minimums), and half of maps carry one **2x1 event** spanning two sets (charges one visit, lands you in its second set).
- **Dead ends are REFUSED, not discovered.** `mapCanFinishFrom(lane,set,visits)` is the DP "can the boss still be reached"; generation requires it from all four starts and `mapLegalMoves` marks doomed moves so the bar can say "that path dead-ends" instead of ever stranding a run. **The 2x1's TAIL is not a steppable tile of its second set** - treating it as one in the DP overpromised and stranded 1.4% of measured walks; both the DP and the legality function refuse it. Verified: 20,000 generated maps, 20,000 random walks, 0 strands, all reach the boss (avg 9.4 tiles, 2.4 skips).
- **Generation is random-fill + validate-or-retry** (`_mapBuildOnce` / `_mapValidate`, the tutorialQualifyBoard shape): minimums (>=2 shops, >=2 challenges, >=3 events, **>=2 reward grids (r243; >=1 in r241 after the owner's first playtest rolled a map with none)**. The minimum BUDGET is 12 slots (10 free middle cells + the 2 funnel tiles, after 2 blanks and the 5 forced levels); the minimums now claim 9 of them, and 10+ starves the weighted fill of variety - trade another minimum down before raising one; a reward grid here is a TILE, not a per-level payout, and at a bare 20% weight ~1 map in 10 had zero - re-checked in validate because the 2x1 absorb can eat one, which shipped 12% short before that check), no 2x2 of one kind, no level with 3+ level neighbours, full path from every start.
- **Every tile advances the difficulty curve** - Guided's load-bearing rule: levels via `triggerLevelUp`, everything else via `guidedAdvanceCurve()` at confirm. **The boss quota is FIXED at map build** (`mapBossGoal` = `BASE_GOAL * MAP_BOSS_SCALE^(MAP_BOSS_LEVELS-1)`, 1.40^8 -> 17,500) and `mapApplyPendingGoal()` (hooked in triggerLevelUp after `guidedApplyPendingChallenge`) overrides the curve's figure on the boss round. The boss tile's bar text previews the boss via `peekBossPreset` plus that quota.
- **Round 1 rides startGame's own deal.** `mapBeginRun()` (end of startGame) stops the timers and puts the map over the already-dealt board; the first level confirm resumes exactly that round (goal flash + 3-2-1 + `startRoundTimer`) - `drainLevelUpQueue` there would bump the curve to 2 before a hand was played. Guarded by `_restoringSave`: a resumed run replays its round first and the map reopens from `mapAfterLevel`'s `!mapPos` fallback.
- **Routing reuses Guided's seams.** A cleared level: `startInterlude`'s map hook -> pick-of-three (`guidedOpenPickThree`), plus `mapKnackPickTwo` after a hard round, then back to the map. Shop tile: `shopFromNodeFlow` + `nodeFlowAfterShop`. Reward tile: `rewardGridContext='interlude'` -> `finishInterludeRoute`'s map branch (`mapAfterTile`, or `onGameWin` when `mapBossArmed` - one act, no quarter rollover; the node/quarter branch in `finishInterlude` excludes `_map`). Event tile: `guidedOpenNamedEvent`. Limit Break tile: `openLimitBreakEvent`.
- **Challenge tiles ride `guidedPendingChallenge`** - `guidedApplyPendingChallenge`'s guard accepts map mode too. Tiles store the challenge as DATA (id + display fields, no test fn), rehydrated from `CHALLENGE_DEFS` by id at confirm, which is what keeps `mapTiles` JSON-safe for SAVE_VARS. **The hard-round knack pick draws 2 knacks with `luckModifiers += 20` around the draw** - literally the odds 20 Luck would give, through the shared `pickEntityByRarity`.
- **CHALLENGE_DEFS grew from 4 to 10** (guided-mode.js): back-to-back 4+ card hands (replacing the trivial-or-impossible single 4-card ask; also fixed - it tested `h.round` but hand-log entries carry `h.level`, so it never fired), a third-of-goal single hand, no discards (`cardsDiscardedRound`), no swaps (**`swapsUsedRound`** - new counter in deck-grid.js, bumped in `doSwap`, reset with the round, in SAVE_VARS), clear with 45s+ left, same type three times, and run+set+flush (gated `avail: selection >= 5`; `rollChallengeLevel` filters on `avail`).
### The funnel is a ROLL, and you may branch from any visited tile (r253)

**The funnel (the last set before the boss) is no longer always two blanks.**
How many of its four lanes carry a real tile is rolled - `MAP_FUNNEL_SOLID_ODDS`,
**2 at 25% · 3 at 40% · 4 at 35%** (measured 25.8 / 40.7 / 33.5 over 6,000 maps).
At two solid they still sit on NON-ADJACENT lanes, which is the old fixed shape.

**Nothing about "you take exactly one before the boss" depended on those
blanks.** `mapLegalMoves` has a hard `set === MAP_SETS - 1` case that returns
only the boss, so the rule holds at any funnel width; the blanks were only ever
costing the set BEFORE the funnel a second visit, whenever your lane's funnel
cell happened to be one of the holes. Measured with the greedy two-visit walker:
sets giving two visits **64.6% -> 66.5%**, 0 strands over 4,000 walks.

**Free branch** (dev panel -> Map, persisted as `lethe.map.freeBranch`) lets a
move start from **any tile you have already taken**, not only the one you are
standing on. `mapOrigins()` is the whole mechanism: normally it is just
`mapPos`, and with the toggle on it is every visited tile at the cell it leaves
you standing on (`_mapStandsAt` - a 2x1 head stands you in its SECOND set).
Measured: two-visit sets 66.5% -> 68.9%, tiles per run 9.97 -> 10.26.

- **Every move now carries `from` as well as `after`**, because the skip payout
  asks "did you leave a set having visited it once" and under free branching the
  set you are leaving is not the one `mapPos` names.
- **`_mapArriveVisits(set)` is the trap.** A forward step used to hand the
  dead-end DP a flat `visits: 1`, which is true only for a linear walk; under
  free branching you can step forward INTO a set you have already visited, and
  telling the DP there was one visit there let it plan a sideways move that no
  longer existed. Measured before the fix: **98 strands in 4,000 walks.**
- **The DP itself is applied UNCHANGED.** Loosening the doom test to "some other
  origin can still finish" was tried and measured at **86 strands in 4,000**.
  Free branching adds ORIGINS; it must not also add risk. With the strict test:
  **0 strands, 4,000 of 4,000 walks reach the boss**, with the toggle either way.
- `mapRender` marks legal tiles off the same `mapLegalMoves()` list, so branch
  targets light up with no rendering change.

### The map speaks SCHEDULE (r260)

Owner: *"The map is your schedule, sets are time slots, and each node is a...
obligation. And the boss is a manager review."* The vocabulary, everywhere the
player reads it:

| was | is |
|---|---|
| The Map (mode name) | **The Schedule** |
| set | **time slot** (`SLOT 2/6` on the bar) |
| tile / node | **obligation** |
| boss | **manager review** (the column reads `REVIEW`) |
| THE MAP (the grid-screen location chip) | **SCHEDULE** |

**Ids are frozen and nothing else moved** - TERMINOLOGY.md's rule. `mapTiles`,
`MAP_SETS`, `mapCanFinishFrom`, `kind:'boss'`, `body.map-active`, the CSS class
names and every function in `js/map-mode.js` are untouched; this is `MAP_HELP`,
`MAP_KIND_META.boss.name`, `mapTileDesc`, the bar's labels, three toasts, the
`enterGridScreenHud` label and the `MODES.map` name and description.

- **The tile KINDS keep their names** (Round, Hard Round, Shop, Reward Grid,
  Event, Limit Break). They say what the obligation IS, and Shop and Reward Grid
  are named that on their own screens - renaming them here would give one thing
  two names.
- **`REVIEW` is six letters where `BOSS` was four, and the boss name is drawn
  VERTICALLY in landscape with no fitter** (r238: the fitter measures
  horizontally, so the boss is deliberately exempt). Measured: the name box is
  20x99 inside a 79x444 column, so it fits with room to spare.

### The obligations have schedule names too (r262)

r260 renamed the map; the TILES still said Round, Hard Round, Shop, Reward
Grid, Event and Limit Break. Owner's call, with the shop and the reward grid
named directly:

| was | short chip | in full |
|---|---|---|
| Round | ACCOUNT | Client Account |
| Hard Round | PRIORITY | Priority Account |
| Shop | MART | LETHE Mart |
| Reward Grid | INCENTIVE | Incentive Program |
| Event | MEETING | Meeting |
| Limit Break | RAISE | Raise Request |
| boss | REVIEW | Manager Review |

- **A TILE CARRIES THE SHORT CHIP AND NOTHING LONGER.** It is 57px wide and a
  name is one atomic word there (r182 - words never break), so "Incentive
  Program" would shrink to nothing or truncate. `MAP_KIND_META` gained a
  `full` field: the bar's info line prints it between the chip and the
  description, and the tile's `title` carries full name plus description.
- The full name is printed only when it says something the chip does not
  (`face.full.toUpperCase() !== face.name`), so MEETING never reads
  "MEETING Meeting".
- **An event tile still shows THAT event's own name** when it has one;
  MEETING is the fallback and the type's full name.
- The shop already titles its own board COMPANY STORE (r237), so the tile
  says where you are going and the screen says what it is.
- Ids are frozen as ever: `kind:'level'`, `mk-shop`, `MAP_KIND_META` keys and
  every function are untouched.

Verified at 1440x820 and 420x820: 24 and 25 tiles, zero names overflowing.

### The schedule takes a PEN and a LEGEND (r263) - `js/map-draw.js`

Two things you can do to the schedule without changing it.

**The pen.** A canvas over the board, inside `#grid`. **Right-drag draws, with
no mode to enter**; **double right-click cycles the colour**; the cursor becomes
a pen IN THAT COLOUR. The bar carries a pen chip (finger mode), a colour
swatch, and undo / clear once there is ink.

- **The layer is `pointer-events: none` by default**, which is the whole reason
  a right-drag still works over a tile - and circling a tile is exactly what
  you want to do. The events are taken on **`#grid`**, which is emptied by
  every `mapRender` but never replaced, so one binding outlives every render.
  Only the finger mode (`.pen-on`) makes the canvas take taps, and then it
  swallows tile clicks wholesale rather than needing a guard in `mapTileTap`.
- **THE CANVAS IS MOUNTED FROM THE END OF `mapRender`.** It is a child of
  `#grid`, so it is wiped with the tiles; the STROKES live in
  `mapDrawStrokes` and are repainted onto the new canvas.
- **Strokes are NORMALISED to the grid box** (0..1), so they survive a render,
  an orientation flip and a save. They are in `SAVE_VARS` with `mapPenColor`,
  and `mapResetBoard` clears them - the ink belongs to that map.
- **The cabinet's `zoom` means a rect is NOT the element's own px.**
  `_mapDrawAdd` divides the pointer delta by `rect.width / offsetWidth`; the
  r160 Trick-fan trap, and here it would put the ink at the wrong scale.
- **THE DOUBLE-CLICK WINDOW IS STAMPED BY A CLICK, NEVER BY A DRAG.** Stamping
  it on pointer DOWN meant a click just after a quick circle read as the second
  half of a pair and cycled the colour instead of drawing. It is stamped at
  pointer UP, and only when the stroke never moved. The dot the first click of
  a real pair leaves is popped back off when the second lands.

**The legend** (the `▤` chip) lists only the kinds actually on this schedule,
in `MAP_KIND_META` order, each with the `blurb` field that table now carries.
Hovering a row lights those obligations and drops everything else, Slay the
Spire's move; tapping one **latches** it (`mapLegendLatch`) so it survives the
pointer leaving the row, and tapping again releases.

- It reuses `.mb-help` wholesale, so it cannot drift from the ? card in
  placement - above the strip, never inside it (r255's reason).
- The highlight is written straight onto the live tiles (`mt-lit` / `mt-dim`),
  with no render, so it cannot disturb a selection or replay the deal-in. The
  dim carries `!important` because an unreachable tile is already at 0.55.
- **Verified in a real browser at 1440x820 and 420x820**: right-drag lays a
  stroke (18 points, 396 inked pixels after a re-render), a double right-click
  cycles the colour and takes the dot back, pen mode draws on a left drag and
  takes no tile with it, a left click with the pen off still selects, the
  legend lights 3 of 25 tiles and the card lands fully on screen in both.

### A tile is its SYMBOL (r276)

Owner: *"Ditch the words on the schedule, just use the symbols instead. With
the legend showing the symbol and word."* The board carries the glyph and
nothing else; the bar names what you hover or pick, the tile's `title` carries
the full name and description, and the `▤` legend lists every symbol beside
its word. `fitEntityName` is gone from the tile for the same reason - there is
no name left to fit. The glyph went 15px -> 22px (30px on the boss column) and
is centred in the whole tile rather than sitting above a name band.

**The boss column lost REVIEW too.** "Just use the symbols" is the rule and
the legend spells it out; a full-height hazard column with a skull in it is
not ambiguous.

**A hard round is a PLAY SYMBOL WITH A ! IN IT** (owner's spec), which no
Unicode character is, so `MAP_ICON_PRIORITY` is a tiny inline SVG. The bang is
a **HOLE** - one path with `fill-rule: evenodd` - rather than a second shape
painted in the tile's colour, because a hole works over the wash, the big
watermark glyph and the legend chip alike. `fill: currentColor` and `1em`
sizing let it sit anywhere an emoji does; the `.mt-icon` copy takes the kind's
`--rc`. Verified: 42 painted px against the emoji's 42 at 1440x820.

### The schedule re-reads its orientation (r276)

`mapLandscape` decides which way the schedule reads and was captured ONCE in
`mapOpen`. Anything that changed the orientation afterwards - a window resized
across the threshold, or a first layout pass that decided portrait before the
office photo settled - left the board reading the wrong way for the whole
quarter with no way back.

`mapSyncOrientation()` re-reads `#stage.landscape` at the top of every
`mapRender` and swaps `gridRows`/`gridCols` when it differs, and a resize
listener redraws on a real change.

- **THE RESIZE HANDLER IS DEFERRED BY A TICK, and that is the whole trick.**
  `js/bootstrap.js` is the LAST script, so the handler that toggles
  `.landscape` is registered AFTER this one and runs after it: reading the
  class synchronously reads the PREVIOUS orientation. Measured before the
  defer - a desktop -> phone resize left the board reading left to right, and
  the resize back flipped it top down, always one step behind.

Verified at 1440x820 and 420x820: 25 tiles, **0 names on the board**, the
priority SVG on both hard rounds, the legend listing nine symbol/word rows,
and a desktop -> portrait -> desktop resize flipping the board both ways.

### The map bar is one strip, and the rules live behind a ? (r255)

Owner: the bar was *"too large and persistent, and doesn't feel especially on
theme."* It was three stacked blocks - a stats row, a two-line prose block, and
a button row on its own line - about 100px tall, permanently across the bottom
of the map.

**It is ONE compact row now (38px)**: `SET x/6`, visits, a **? chip**, the
picked tile's line, the skip price, credits, CONFIRM. Console material to match
`#event-panel` (indigo plate, plastic ring) rather than a plain dark box.

- **The standing "how the map works" prose is a tutorial you cannot dismiss**, so
  it moved into `MAP_HELP` behind the ? - five one-line rules, drawn as a card
  that opens **ABOVE** the strip. Above, because anchoring it inside the bar
  would change the bar's height and shove the board every time it opened.
- **`.mb-info` is `flex: 1` and CLIPPED to one line** (`text-overflow: ellipsis`,
  `max-width: 46vw`). A long tile description would otherwise push CONFIRM off
  the end of a `width: max-content` strip. It is `:empty { display: none }`, so
  with nothing picked the bar shrinks to 360px.
- **The outside-click close is armed only while the card is open.** The bar is
  rebuilt on every map render, so a standing document listener would stack one
  copy per render.
- A tile's `mouseleave` clears the line now; it only ever set it.

### The x/y selection readout shows only where a pick matters (r255)

`#sel-count`'s live test was `gridData.length > 0` - the number of ROWS, which is
true of a board of nulls and of every screen that merely BORROWS the grid. So
"0/3" hung over the map, the crossroads, the payout pick and the interlude,
describing a selection that could not be made.

`updateSelectionUI` now shows it on exactly three screens: **the shop, the reward
grid, and a live round** (`boardLive` = real cards on the board, and none of
`map-active` / `pick-active` / `grid-screen`). Measured: hidden on the menu and
the map, shown in a level, a reward grid and the shop.

- **A class gate needs a repaint behind it.** `map-active` goes on without a
  `render()`, so `mapRenderBar` and `mapCloseScreen` call `updateSelectionUI`
  themselves; the payout pick's close does the same, because it renders BEFORE
  it drops its class.

### The route runs THROUGH a 2x1, it does not cut across it (r254)

A tile was ONE route node, at its head cell. A 2x1 occupies two cells, so the
segment out of it started at the head and ran to whatever you took next in the
set beyond its tail: **one diagonal reading as a 45 degree short cut across a
tile you had actually walked the length of.**

A tile now has an **entry** (its head) and an **exit** (its tail, which is the
head for every ordinary tile), plus a **spine** - the straight run between them,
drawn for 2x1s only. Links go exit to entry. So a 2x1 reads as a straight run
and then a turn: two right angles, never one diagonal.

- **The rails get the spine too**, not just the walked line - the rail is what
  the board OFFERS, and it offered the same false diagonal.
- Verified on a real legal walk through a 2x1: every walked segment is 0 or
  +-90 degrees, spine included.

### The map has a BOARD, a ROUTE and coloured tiles (r247) - `css/map-mode.css`

The map was tiles on the bare stage: no surface, no sense of a journey, and a
kind identified only by a 1px border colour. Four pieces, all **absolutely
positioned siblings BEHIND the tiles** (z-index 0 against their 2), all built
from the same `_mapCellXY` / card metrics the tiles use - **so the renderer
transposes for portrait and none of this had to learn which way the board
reads.**

- **`.map-board`** is the surface: a blueprint rule over a dark panel, with the
  BOSS END GLOWING RED and the start end green, so the board reads as a journey
  toward something rather than as a spreadsheet. Portrait gets its own gradient
  angles (`.mb-port`) because the glow has to follow the direction of travel.
- **`.map-band`**, one per set, alternating and numbered, with the set you are
  standing in lit gold. The six-stop structure now reads before any tile does.
- **THE ROUTE, and it is two layers.** A faint dashed **rail** between every
  pair of set-adjacent solid cells (what the board offers), and over it the
  **walked line** in gold (what you actually did) - the only record of the shape
  of the run, and the thing that makes a finished map worth looking at.
  **`t.step` is what makes this possible**: the walk order is recorded on the
  tile at confirm as a plain number, because `mapTiles` has to stay JSON-safe
  for `SAVE_VARS`. Sorting visited tiles by `set` instead would draw the wrong
  line the moment a set holds two visits.
- **A tile carries its kind's colour now**, not just an edge: a `--rc` wash, a
  big faint **watermark glyph** (`.mt-ghost`) so a kind is recognisable across
  the board before a 6px name is read, and a coloured cap on its leading edge.
- **A blank is missing FLOOR, not a dark tile** - crosshatch, dashed edge, no
  cap and no wash. It reads as a hole rather than as an unlit option.
- **The boss column takes hazard stripes and a slow red breath**, so the end of
  the board looks like the end of the board.

- The map screen hides `#btn-play`/`#btn-discard`/`#swap-indicator` (`body.map-active`); the bar (`#map-bar`, body-level, raw viewport px) carries SET x/6, visits, skip price, the picked tile's description and CONFIRM. Tile names go through `fitEntityName` - except the boss, whose name is vertical in landscape and the fitter measures horizontally.
- **The 3-2-1 was rethemed in the same pass** (css/style.css): Orbitron on a scanlined phosphor ring instead of the pre-cabinet gold Cinzel. Same element, same timing, same keyframe name.

### The map is THREE QUARTERS now (r252)

It was one act: beat the boss and `finishInterludeRoute` called `onGameWin`. A
map run is the full three-quarter structure every other act mode has - beat the
boss, the quarter closes, **a fresh map is drawn** and you walk it.

- **It routes through `rolloverQuarter` (js/quarter.js)**, which already closes
  the quarter's books, advances `actNumber`, shows the QUARTER CLOSED card and
  **goes to `onGameWin` itself past Q3**. So the map never learns how long a run
  is, and the quarter card and the end-of-run report came free.
- **`mapResetRun` split into `mapResetRun` + `mapResetBoard`, and the split is
  the whole trap.** A fresh RUN and a fresh MAP are no longer the same thing:
  **`mapFirstRoundDone` belongs to the run alone**. It is what makes the first
  level confirm resume the board `startGame` already dealt rather than levelling
  up past it - reset it per quarter and Q2's first tile would try to resume a
  round dealt two quarters ago. `mapBeginQuarter` calls `mapResetBoard` only.
- **The boss quota is anchored to the level the QUARTER opens on**
  (`mapQuarterBossGoal`): `goalForLevel(level) * MAP_BOSS_SCALE^(MAP_BOSS_LEVELS-1)`.
  At Q1 that reads `goalForLevel(1)` = `BASE_GOAL` and reproduces the r238 figure
  **exactly (17,500)**, verified live; Q2 and Q3 open ten and twenty levels in, so
  they ask what a quarter of progress from THERE is worth instead of printing
  Q1's number three times.

Verified end to end in a real browser: Q1 opens at 17,500, the boss round runs
against that figure, the prize grid closes into the quarter card, and **Q2 opens
on a new 25-tile map with `mapBossArmed` cleared and a requota**; forcing Q3's
boss ends the run on the end screen with no further map.

### An event tile is the only event (r252)

A reward grid's **destination** tiles ("Next: Shop", "Next: Event") route the
NEXT NODE, which only means anything in the node flow. Map mode walks to those
as tiles, and `finishInterludeRoute`'s map branch clears `pendingEventOverride`
unread - so a player could spend a pick on "Next: Event" and **nothing at all
happened**. Owner's call: on the map an event is an event TILE.

`NO_DEST` in `_generateRewardContent` already excluded the prize grid and
**Guided, for this exact reason** - the map was simply missed when it landed.
One clause. Verified: 0 destination tiles across 60 generated map reward grids.

### Mini-bosses (r239) - the second challenge kind

Six CHALLENGE_DEFS entries carry `mini: { modifier, params }` instead of a task: the HANDICAP is the challenge - a boss modifier at reduced strength running inside an ordinary round - and clearing the (raised) goal pays the credits (`test: () => true`, because the settle only runs on a cleared round). Stone Lord Jr (half stones, no rubble), The Apprentice (interact x1.5, play +2s), Low Tide (-5 Focus/20s), The Intern (one card held/25s), Sour Sip (ONE suit at x0.6, rotating), Light Fog (ranks hidden for the first 60s only).

- **`bossFxLive()` (js/boss-effects.js) is the whole harness**: `bossActive || miniBossActive`. Five gates read it instead of `bossActive` - the schedule runner, `bossCardPipScale`, `bossFogHides`, `bossSuitTick`, `bossSuitSecondsLeft`. `bossInteractMult` and the card holds were never gated, so they needed nothing. Everything else about a mini is the REAL boss machinery: `applyBossEffectModifier` arms it, `bossSchedule`/`bossStartScheduledEffects` tick it, `clearBossEffects` tears it down - so state can never leak between a mini and a real boss.
- **`miniBossMaybeStart()` is hooked in `startRoundTimer`** (after the checkpoint, so a save never captures half-armed effects) - which is also what re-arms a resumed mini round. `miniBossClear()` runs in `guidedSettleChallenge`; a failed round's teardown rides the next `startGame`. Never on a real boss round (`bossActive` guard) - triggerLevelUp never arms a challenge there anyway.
- **`_stones` and `_fog` are harness-local pseudo-modifiers** (a one-shot placement and a timed flag have no schedule to arm); the other four are the shipped modifier ids with softened params.
- **The live challenge is in `SAVE_VARS` now** (`guidedPendingChallenge`/`guidedActiveChallenge`) and survives as DATA - JSON drops the test function, so `guidedSettleChallenge` re-reads the test from `CHALLENGE_DEFS` by id, never off the object. This also fixed resumed task-challenges silently paying nothing.
- Verified in a real browser, all six: effect live mid-round (stones on board, x1.5/+2s costs, a held card, ♥ marked, fog painting), goal raised, and every counter back to rest after the settle (toll 1, playCost 0, holds 0, markdown null, fog false).

### Upgrade events (r194) - improve what you already have

Every event before these HANDED you something, which is the wrong shape late in a run: the Trick tray caps at 10 and fills long before an act does, so a twelfth grant is a replace-or-decline, while an upgrade always has somewhere to go. Three new events, pool **11 -> 14**:

| event | upgrades | rides |
|---|---|---|
| **The Bench** | a card YOU pick (Forge picks three at random) | `enhanceCardKey` |
| **Rehearsal** | one Trick - it fires an extra time, every hand, for the rest of the run | `t._rank` |
| **The Workshop** | Sleights - refill all, or raise one's charge ceiling for good | `sleightCapBonus` |

**Each rides a seam that already existed rather than adding per-entity code.** That is the whole reason three upgrade events cost so little:

- **`t._rank` is a PERMANENT prime.** `calcScore` already fires a Trick an extra time per `_primed` stack, duplicating whatever pip/mult delta the Trick reported - so a rank works on all 177 Tricks with no code in any of them. The loop now reads `(t._primed || 0) + (t._rank || 0)`, and `playHand`'s consumption block only decrements `_primed`, so a rank never runs out. It is deliberately **uncapped**: each one costs a whole event choice. A rehearsed multiplicative Trick is bounded too - it re-adds the same delta, so a x1.5 becomes x2, not x2.25.
- **`sleightCapBonus` (id -> extra charges) raises a Sleight's ceiling**, which nothing could do before. `sleightMaxCharges(def)` is the new chokepoint and **all four "restore up to the cap" sites read it** (`restoreSleightCharge`, `limits.js`, `discard.js`, `level-up.js`'s Coin Toss) - miss one and a reinforced Sleight refills only to its printed durability and the upgrade silently does nothing. It returns `null` for an infinite Sleight, which every caller already treats as "leave alone". Stored by sleightId, so reinforcing one copy reinforces every copy; it is in `SAVE_VARS` and resets on a new run.
- `allOwnedSleightCards()` (sleights-runtime.js) is the Sleight counterpart to `allDeckCards()` - board, draw pile and played pile.

## Entity improvement - tiers (r206) - `js/improve.js`

An owned entity can get BETTER. Every entity carries an improvement **tier (0-5)** and its
numbers in `BAL` grow with it. `ENTITY_IMPROVEMENTS.md` is the design sheet: **option 1 of
every entity is "the number again"**, and this file is that, generically, for all of them.

**The ladder** (owner's spec): each improvement adds the entity's STEP, except the 5th which
adds three. So the cumulative steps run `0 1 2 3 4 7` and a +5 bonus climbs **5 10 15 20 25 40**.
A x2 multiplier's step is the part above x1, so it climbs **x2 x3 x4 x5 x6 x9**, never x2 x4 x8.

- **It REWRITES `BAL` in place from a pristine copy, rather than wrapping every read.** The
  ~200 sites that read a tuning number do it as `BAL.rich_soil.pips`, and **nothing in the game
  ever writes to BAL** (verified). So `BAL_BASE` holds the printed values and
  `applyEntityTiers()` recomputes `BAL` whenever a tier changes. Every read site picks it up
  with no edit, there is no per-access cost, and no proxy identity surprise.
- **An ALLOWLIST of parameter names, never a denylist.** Only the bonus amount grows.
  Thresholds, intervals, costs, chances, cooldowns and requirements are left alone - that is
  what option 2 (the looser trigger) is for. A tuning number added to `BAL` later must not
  silently start scaling. It also only touches ids that are REAL ENTITIES, so the global config
  in `BAL` (`_resources`, `_exalt`, `wheel`, `shop_discount`) can never move.
- **`IMPROVE_STEP` is where the sheet disagrees with "step = base".** Naming any param there
  makes it the complete list for that entity. Harvest grants +2 discards but steps by 1;
  Men of Repute steps its pips and not its mult, because the mult is its option 2.
- **Descriptions follow the number, and 105 of the 196 entities needed a second mechanism.**
  `applyBalDescriptions()` regenerates `desc` from `BAL` through `DESC_TEMPLATES`, but only
  **91** entities have a template - the rest have the number typed into the sentence in the
  data file. Those would improve SILENTLY: Enriched scoring +80 while still reading "+40 pips"
  is worse than not improving at all. So for those the number is substituted into the printed
  text, and **only a base value appearing EXACTLY ONCE is touched** - a sentence that mentions
  its number twice cannot be rewritten safely and is left alone rather than guessed at.
  Always rewritten from `DESC_BASE` (the pristine text), never from the last rewrite, or two
  improvements would compound the substitution. **Measured: 159 of 172 improvable entities
  update their description; 13 stay silent** (Redline, Resonance, Inspirato, The Woodpecker,
  Sediment, Balance, Wait For Iiiit, Five for Fodder, Five Second Rule, 3rd Down, Time Slip,
  Rewound Echo, Jury-Rig). The tier badge is what covers those.
- **The pools hold the canonical entity; what the player owns are COPIES** made at grant time
  (`{...pick}`), so `syncOwnedEntityDescs()` pushes the regenerated text onto the tray and the
  Knack row or they keep quoting the pre-improvement number.
- `entityTier` is in **`SAVE_VARS`**, and the restore path calls `applyEntityTiers()` - the map
  alone would restore the tiers and play at base values. `startGame` calls `resetEntityTiers()`,
  which also rewrites `BAL` back: clearing the map alone would leave the previous run's improved
  numbers live for the whole of the next one.

### The improvement reward tiles (r206)

Three rare tiles, one per type, that improve something you **already own**:
`improve_trick` / `improve_knack` / `improve_sleight` in `js/reward-grid.js`.

- **The target is chosen when the grid is BUILT**, so the tile names what it will improve and
  prints the before and after description. That follows Fortune/Jinx, which roll their Luck
  step at generation for the same reason. `apply` re-checks, because a Trick can be taken off
  you between the grid being built and the tile being picked.
- **It draws through `pickEntityByRarity` (js/luck.js)**, the shared rarity draw, so it reads
  the same probability table as every other entity draw and **Luck tilts it the same way**.
  Owning three commons and one legendary favours a common twice over: once because there are
  three of them, and again because the table itself leans common. Measured: 32% each for the
  three commons, 2.8% for the legendary.
- **Nothing of that type owned, or all of it maxed, falls back to an ordinary Trick tile.** A
  tile that does nothing is worse than an ordinary one.
- **`_improve: true` keeps the tile alive, and it is load-bearing.** The Trick-minimum pass
  (`MIN_TRICK_TILES`) spots a Trick by its `★` icon and **converts every other buff tile until
  it has five**. An improve-a-Knack tile (`◆`) was convertible, so it was overwritten on
  essentially every grid and **no knack or sleight improve tile ever reached a player**. They
  are now skipped, exactly as guaranteed tiles are. Found only by generating grids in a real
  browser and counting what came out; a syntax check and a call audit both pass without it.

**The tier badge is drawn by `entityTileInner`**, so the tray, the Mart strip, Records and the
Shift Change slots gain it at once. **Top-right is the only free corner**: a Trick puts its
glyph top-left, a Sleight its tab top-left and its charge count bottom-right, and the name band
runs the full width along the bottom - the first version sat bottom-left and printed
"+2CH SOIL" over the name.

### The tier is a VERSION, priming is a COUNT (r267)

Owner: *"the +2, what is that for? ... we need a system to represent primed status and
count, and I think I like the +2 for that."* Two different facts were wearing one
costume, so they were separated by SHAPE, COLOUR and CORNER:

| | reads | where | looks like |
|---|---|---|---|
| improvement tier | **v2.0** | top right, on the object | brass stamp |
| primed | **+2** | bottom right, on the frame | violet pill |

- **`+N` is the shape a LIVE COUNT takes, so priming took it** and the tier moved to a
  version stamp. `v2.0` reads as a property of the object; `+2` reads as something
  pending, which is exactly what a prime is and exactly what an improvement is not.
  The tier also came off `--rc`: painted in the rarity colour, the one permanent
  property of the object looked like its tier.
- **`_rank` is counted now.** `cdForTrick` read `t._primed` alone, so a Trick the Extra
  Rep event had permanently primed showed **nothing at all** for the rest of the run,
  despite `trickFires()` being `1 + _primed + _rank + mirrors`. It is
  `_primed + _rank`, which is what the player is owed.
- **A COUNT IS NOT A COUNTDOWN.** The `.cd-badge` ring is a clock face, and under a
  charge count it drew a full circle that never moved - a timer that has stuck.
  `.cd-b-count` overrides it to a pill: auto width, flat fill, `::before` (the ring's
  hole) off. The countdown modes are untouched.
- **The stamp is pinned to the OBJECT, the badge to the FRAME, and that asymmetry is
  forced.** `entityTileInner` puts `.rwd-tier` inside the `.reward-cell`, so
  `--lbv`/`--lbh` (half the letterbox leftover on each axis, per r239's ratios) can
  move it onto the disc's own corner. **`cdPaint` appends `.cd-badge` to the HOST** -
  the tray chip, the card, the knack chip - which is not a `.reward-cell` at all, so
  those selectors cannot reach it; it is also shared with hosts that have no
  letterbox. Its home is the tile's corner.
- `tier-badge-preview.html` draws the shipped stamp through the REAL `.rwd-tier` rule,
  with the old `+N` beside it as the delta, plus a third option the owner asked to see
  (gold 45-degree service bands across a corner, one per tier) that was not taken.

Verified in a real browser at 1440x820: `v2.0` / `v5.0` on the disc, `+2` / `+3` in
violet, and a Trick carrying only `_rank` reading `+3` where it used to read nothing.

### The tier is ON THE OBJECT too (r274) - bands and a shutter material

The `v2.0` stamp says the number; the DISC now says it without one. A Trick's
improvement tier is drawn as **gold bands across the bottom-left corner, one per
tier**, and as **the shutter's material**, which climbs:

| tier | 0 | 1 | 2 | 3 | 4 | 5 and up |
|---|---|---|---|---|---|---|
| shutter | dull grey | bronze | shiny silver | gold | shiny black | iridescent |

- **BOTH ARE BACKGROUND LAYERS OF THE DISC'S ONE `::before`, and that is forced,
  not chosen.** The shell, shutter and label are already layers of that pseudo
  (r239 - the chamfer clip-path cannot be shared with a second one), and
  background layers paint **first-listed on top**. So slotting the bands AFTER
  the label puts them **under the label, the emoji and the name**, which is the
  owner's spec. A child element could only ever paint above the whole object,
  and a child at `z-index: -1` would fall below the opaque shell and vanish.
- **The label is 94% opaque, so the bands GHOST faintly through it** rather than
  disappearing - foil under paper, and what keeps them legible at 40px.
- **The tier arrives as a CLASS on the `.reward-cell`, and it has to.** A custom
  property set by a CHILD cannot reach the parent's `::before`. `entityTierClass(p)`
  (js/entity-tile.js) is in `entityTileClass`, which covers every surface that
  goes through `entityTileHTML` - and the **two that build their own cell from
  `entityTileInner` call it directly**: the reward grid (`renderRewardTiles`) and
  the Mart (`martItemHTML`). Miss either and that surface silently draws every
  Trick unimproved.
- **`TIER_ART_MAX` (5) clamps the class**, so the ladder's length is the
  stylesheet's length and the cap is not written down twice. Verified: a Trick at
  tier 7 draws `tier-5` (iridescent) and still stamps `v7.0`.
- **The shutter grew** (45% -> 54% wide, 31% -> 36% tall) with the punched window
  re-solved to stay centred on it. A background layer at left L% width W% sits at
  `background-position-x: L/(100-W)*100%`, so neither number could be nudged.
- **What sells which metal it is is the RUN OF THE HIGHLIGHT, not the hue**:
  bronze and gold go warm-dark to warm-light, silver carries a hard white edge,
  black keeps a cold rim so it does not read as a hole punched in the disc.
- `tier-badge-preview.html` restates the same numbers over the real tile art and
  has live sliders for the band pitch, thickness and corner. **It and the
  stylesheet agree today; keep it that way** (r233's rule).

Verified in a real browser: all six materials live in the tray at tiers 0-5, the
bands counting up under each label, tier 7 clamped to iridescent, and the reward
grid still building its 16 tiles.

**The bands are on the BUSINESS CARD too, at pitch 5% (r275).** Owner's numbers:
pitch 5, thickness 3. The band rules are selected on **`.reward-cell.tier-N`**,
not on the object, so a Sleight reads them from its own `::before` with one
added layer and a future object only has to read `var(--bands)`. On the card
they sit above the stock and below the logo plate's wash - and below the logo
and the name for free, because those are real CHILD elements and a child always
paints above its parent's `::before`. The **shutter material stays the disc's
alone**; a card has no shutter. `entityTierClass` accepts `sleight` now.
**Knacks are deliberately out** - they have no object of their own yet (the
owner's plan is stamps with coloured backgrounds), so guessing one would be a
third vocabulary to unpick later.

**The tier stamp sits TOP-LEFT (r277).** Top-right was the only free corner on
the PRE-r228 tile; on the object both `.rwd-glyph` and `.rwd-tab` are
`display:none`, so the left corner is free - and the landscape fan tucks each
tile under the next from the RIGHT, which was clipping the stamp to `v1.` on
every tile but the newest. The bands are unaffected either way: `fanTrickTray`
sets `--fan-z` ascending, so the covered strip is each tile's RIGHT edge and the
bottom-left corner is always in view (measured r276 at 1440x820, 6 Tricks: width
110, pitch 82, so 28px covered and 82px visible).

### The tray fan may not RESTYLE the tile (r277)

Owner: *"the tricks have weird card like borders and the emoji goes into the
corner weird ... I thought we made all tricks consistent in appearance no matter
where they are."*

They were, everywhere except the PORTRAIT tray, which still carried a block of
r160/r171 overrides written against the pre-r228 chip and never revisited when
the object landed. Each line fought the floppy disc:

| the override | what it did to the object |
|---|---|
| an extra `box-shadow` on every tucked tile | a plastic ring and rarity glow AROUND the disc - the "card like border" |
| `align-items:flex-start` + padding on the cell | the label's contents pulled off the label |
| `.rwd-art { position: static }` at 23px | the emoji out of the label and into the tile's corner |
| `.rwd-name`/`.rwd-glyph { display:none }` | the disc lost its label text |
| `.rwd-art`/`.rwd-name` fixed px, both trays | fought r239's `cqw`, so the type drifted per surface |

All of it is gone. **A fan tucks tiles; it does not redraw them.** A tucked tile
shows the left part of the real object, which is what the landscape fan has
always done. Verified in a real browser at 420x900 and 1440x820: five Tricks at
tiers 1-5, emoji on the label, names present, no ring, and every `vN.0` stamp
fully readable.

Dev panel -> **Improve**: every owned entity with its tier and what one more would read as,
plus improve-a-random-one per type and a reset.

### `trickFires(id)` (r203) - firing a Trick again, for the effects the ledger cannot carry

`calcScore` keeps a per-Trick ledger of what each Trick contributed this hand (`_cp` pips,
`_cm` mult). **Mirror** replays its neighbour's entry, and **`_primed` / `_rank`** replay a
Trick's own entry once per stack. That is what makes "fire it again" generic across all 177
Tricks with no code in any of them, and it is the seam the whole improvement system rests on.

**That ledger can only carry pips and mult.** Roughly **71 of the 177 Tricks** pay in Focus,
clock seconds, credits, swaps, discards or permanent card buffs, and those fired **exactly
once** no matter how many times they were duplicated: a **rehearsed Tick-Tock or a mirrored
Deluge did nothing at all**. That was a live gap in the shipped Rehearsal event and in Mirror,
not just a future problem.

`trickFires(id)` (js/scoring.js, beside `hasTrick`) is the same count for those effects:
`1 + _primed + _rank + (Mirrors aimed at it)`, and **0 when the Trick is not owned or a boss
has switched it off**.

- **It replaces the `hasTrick()` test at the call site, it does not sit beside it.** An
  unowned Trick multiplies its amount by 0 and never lands. So **every caller must be an
  amount being granted** - never a flag being set, a tally being kept, or a cooldown being
  consumed. Groove's per-line tally and Overtime's are deliberately still inside their
  `hasTrick` blocks; only the Focus they pay out is multiplied.
- **`pauseRound()` gained a zero-guard, and it is load-bearing.** `pauseRound(3 * trickFires(...))`
  reaches it with 0 for a Trick you do not own, and unguarded that still counted a pause of no
  length toward **Hummingbird** (+mult per pause triggered this game) and the Time popup tally.
- **A predicate that reads `gridData` must stay behind the ownership check.** Hoisting
  `canBeOrderedRun(handCells)` out of Rogue Wave's `hasTrick` guard threw on an empty grid
  (`gridData` is empty between screens). Rogue Wave reads its fire count FIRST and only then
  calls the predicate. `isSquare` / `isCross` / `counts3CardHand` are pure and safe to call
  unconditionally; `canBeOrderedRun` is not. **This was caught by running the game in a real
  browser and is invisible to the syntax check.**
- **Four Horse-man rolls ONCE and pays the rolled half per firing.** Re-rolling per firing
  would make a duplicate a different Trick (several chances at the good half), and it would
  also draw extra times from the seeded stream.
- **Threshold-advance Tricks advance N thresholds** (Flash Flood, Collapsing Columns, Richter).
- **Knacks are deliberately untouched.** Knacks always improve and are never duplicated, and
  neither Mirror nor a rank applies to them, so Sundial / Metronome / Clockmaker still read
  `hasKnack` directly.

**Verified:** every one of the 177 Tricks measured across 8 hand shapes (Focus generated,
pauses, rewinds) is **byte-identical before and after**, and Dam Holding pauses 3s / 6s / 9s at
rank 0 / 1 / 2 and 6s with a Mirror on it, where it used to pause 3s in every case.

**Two traps this hit, both found by rendering the events in a real browser and neither visible to a syntax check or a static call audit:**
- **`shuffled()` in `js/reward-grid.js` is scoped INSIDE `_generateRewardContent`** - it is not a global, and calling it threw the moment The Bench opened. `events.js` has its own `evShuffle` now. A grep for `function shuffled` finds it and tells you nothing about its scope.
- A picker rebuilt on each choice must keep its **label inside the removable wrapper**, or changing your mind stacks a fresh "CHOOSE THE CARD" every time.

### Four more events (r218) - two slot machines, a wheel, and a trade

Pool **16 -> 20**.

| event | what | rides |
|---|---|---|
| **Trade a Trick** | give up a Trick, get a random Knack or Sleight at its tier or better | the pools themselves |
| **Spin to Improve** | stake three of your own; a wheel picks one and improves it twice | `improveEntity` |
| **Entity Slots** | 3 reels of what you own; three alike improves it a tier | `improveEntity` |
| **Card Slots** | 5 reels of your live deck; paid lines buff the cards that land on a hit | `enhanceCardKey` |

- **Both improve events ride `js/improve.js` (r206) and know nothing about any individual entity**: `ownedImprovable(type)` lists what can still be improved, `improvePreview(id)` says what one more step would READ as (so the tile shows the real sentence, not a generic promise), and `improveEntity(id)` applies one tier. `evImprovables()` in `js/events-upgrade.js` is just the three-type union in the shape the wheel draws. **Knacks are on the wheel** precisely because improve.js recomputes BAL in place - an earlier draft of this batch shipped its own seam over `_rank` and `sleightCapBonus` and could not improve a Knack at all; improve.js is strictly better and replaced it on merge.
- **Trade a Trick is the only way to move value BETWEEN the three entity shapes.** What you get is random, at the traded Trick's tier or better: naming the replacement would make it a shop, not naming it makes it a trade. It matters most once the tray is full, when another Trick would only be a replace-or-decline.

#### The slot math is computed and PRINTED, not tuned (`js/events-slots.js`)

A slot machine is only honest if its odds are knowable, and these reels are built from the player's own live deck and loadout, which change every run. So nothing is hand-tuned: each reel is an **independent uniform draw** over a symbol population taken from the run, which makes the odds a closed form the panel shows before the player pays.

- **Cards.** P(the leftmost three on a line share a suit) = the sum over suits of that suit's deck share cubed. Four even suits gives 4x(1/4)^3 = 1/16 a line, about 27% over five lines. Spectrum's seven colours give 1/49 - the right answer for a seven-colour deck rather than a number needing a per-mode retune. Rank runs pay more and are far rarer (1/169 a line).
- **Entities.** Capped at `SLOT_ENT_SYMBOLS` (4) distinct symbols, so P(three alike) = 1/k^2 exactly, and the cap is what stops a large loadout making the machine unwinnable - at 12 owned entities an uncapped machine would be 1 in 144. Which four make the reels is drawn once, up front, and shown.
- **A spin is decided in full before a pixel moves.** `slotSpin` builds the result grid and `slotRenderSpin` only shows it, so an interrupted animation or a backgrounded tab can never change the outcome. Reels stop left to right `SLOT_STAGGER` apart, which is the whole reason a slot machine is tense.
- **A paying card line takes the next buff off a rotating list** (`SLOT_BUFFS`, cursor `slotBuffIdx`, in `SAVE_VARS`), so a lucky run spreads across pips, mult and replays instead of piling one stat onto a few cards. Winning cards are re-resolved with `resolveDeckCard` at apply time, since the reels were built off a snapshot and a card can leave the run in between.
- **The wheel decides its winner BEFORE it spins**, same principle: `spinDrawWheel` is handed the result and builds a strip that lands on it.

### Events pass (r211) - names that say what the screen does

The events were a fantasy set - The Altar, Cleansing Spring, Blood Price, "Every gain has its price in flesh" - inside a game whose voice was stripped to plain and direct in r178. Every `EVENT_META` name and flavour was rewritten so a player meeting one for the first time can read the title and know what they are about to be asked, and the in-body prose with them. **The KEYS are unchanged and must stay unchanged** - they are the ids used by `openEvent`'s pool, `confirmEvent`, `renderEventShell`, `recentEventIds` and the dev panel.

The Confluence → **Theme Draft** · The Crossroads → **The Trade** · Wandering Merchant → **Free Pick** · The Altar → **The Investment** · Cleansing Spring → **Clean Up** · Twin Path → **Two and a Catch** · The Forge → **Card Upgrade** · The Bargain → **The Price** · The Wager → **Coin Flip** · Shift Change → **Tray Order** · The Bench → **Pick a Card** · Rehearsal → **Extra Rep** · The Workshop → **Maintenance**. The Gamble kept its name.

- **An Event now shows you the real object.** `makeChoiceEl` takes a `tile` payload; when the offer IS an entity it draws the **shared entity tile** (`entityTileHTML`, js/entity-tile.js) in place of the emoji disc, so the Trick you are offered is visibly the Trick you will own. Wired into the Confluence, the Merchant, Twin Path and the Gamble's stake list. `evItemTile(item)` resolves the emoji: those item lists push Tricks with `icon:'★'`, the generic marker the old disc used, so a Trick's own emoji has to come from `trickEmoji` or every Trick in an Event draws as a star.
- **Do NOT widen `#event-panel` with a viewport media query.** The overlay lives inside `#stage` and carries the cabinet's CSS `zoom` (~1.9 on a 1440px desktop), so its 420px is already about 800 real pixels. A `min-width: 900px` query sees the viewport's 1440 and widens something that was never narrow - measured at 560px the panel covered three quarters of the display and the prose ran to 90 characters a line. The px in that block are stage px.
- **A coin flip is 50/50.** Coin Flip's three stakes were 70 / 55 / 40, printed in the option names, which made one screen two decisions - how much to risk AND how likely it was - and, because the odds FELL as the stake rose, made every step up worse in expectation and "Reckless" a trap rather than a choice. All three are 0.5 now; only the size of the bet differs. The Gamble's double-or-nothing went 0.6 → 0.5 for the same reason.
- **Clean Up (`spring`) was reworked.** Thinning the deck is the strongest thing the event does, so it has a shape: **4 cards if they are all different ranks**, or **2 with no strings**. The picker lists **one chip per CARD, not per face**, and removes by object identity - the deck really can hold two 7♠ (the Mart sells duplicates), so a face-deduped list hides one and a face-matched splice takes whichever it finds first. Its "put your limits back" option is now **permanent**: it repairs `limits.swaps/discards.current` up to their **base** (damage, not a free copy of every upgrade skipped), and offers +1 of each permanently when nothing is missing. "Undo a downside" is unchanged - the owner confirmed it reads right.
- **Two new events, pool 14 → 16.** **Card Market** (`market`) buys cards INTO the deck, each carrying one effect; **Deck Trim** (`deck_trim`) is the frequent-removal screen, three cuts priced by size with the smallest free so it is never a dead draw at 0 credits.
  - **The market's card is always a COPY OF ONE ALREADY IN YOUR DECK, and that is what keeps it mode-safe.** Spectrum has no courts and no suits, Six Suits has two extra, and the deck tuner can switch values off; inventing a rank and a suit here would be the one place in the game that can put an illegal card into play.
  - **`copyCardToDeck` returns the card it made**, and the effect lands on that. Searching the draw pile afterwards for "this face but not the original" picks the wrong card the moment a basket holds two of one face.
  - **`permTime`** is new, beside `permPips`/`permMult`/`permRetrig`: seconds a card puts back on the clock when it scores. Applied in `playHand` through **`rewindTime()`**, never a raw `roundSeconds +=` - that is what keeps `rewindCeiling()`, the ⏪ floater and the Kingfisher tally honest. It is in `SAVE_VARS` and reset on a new run.

### Limit steps were being thrown away at `startGame` (r211)

`LIMITS_DEF` gives `round_time` a **step of 15** and `focus_cap` a step of **3**; every other limit steps by 1. `startGame` rebuilt the whole `limits` table as `{ current, base, max }` - **without `step`** - so from the first frame of every run those two steps were `undefined` and `incrementLimit`'s `(l.step || 1)` fell back to **1**. That is the real reason a Round Time upgrade granted **one second**: not a display bug, the grant itself. It applied everywhere a limit could be raised - the shop, the reward grid, Limit Break, Growth Spurt, the Survival pick. The table in `js/limits.js` had the right numbers the whole time; nothing read `LIMITS_DEF` again after that line.

Two display bugs sat on top of it and are also fixed:
- **The reward grid's `limit_up` tile hardcoded "+1"** and `current + 1` whatever it was raising, and excluded `round_time` outright on the strength of the same wrong assumption ("its +1 = 1 second") - which is why a limit tile could never raise round time at all. It reads `step` now, and `round_time` is back in the pool.
- **Limit Break showed only the limit's NAME**, so "Round Time" looked like the same size of gain as "Swaps/Round". It prints `+15s` / `+3` / `+1` beside each offer, and the give-up buttons quote the real step too.

### Limit Break, on the event console (r211)

It was the last between-round screen still wearing the old gold-on-black Cinzel look, so arriving there from a reward grid felt like leaving the game. `#limitbreak-overlay` gained an `#lb-panel` wrapper and is now the same material as `#event-panel`: indigo wash, plastic ring, scanlines, sticky marquee bar, sticky action footer, and the events' green CONFIRM. What it deliberately does NOT copy is rarity colouring - a limit has no tier, so the offer tiles keep their own gold - and the give-up section stays **red**, for the same reason `.event-choice.debuff` does: on a screen that is otherwise all gains, the one control that takes something away must not be mistakable for another one.

### An event you cannot use is never OFFERED (r248) - `EVENT_REQUIRES`

Sixteen renderers open with a guard and a consolation - "Not enough Tricks or
Sleights to fill the reels. Take the fee instead." **Every one was reachable,
because nothing anywhere asked whether an event could do anything before offering
it**: not `openEvent`'s pool, not Guided's crossroads, not the map's tile fill.

In Classic that is a wasted screen. In Guided it is worse: the crossroads NAMES
the event, charges `price_event` AND a slot, and `guidedAdvanceCurve` moves the
quota - so an Entity Slots with one improvable entity cost 6 credits, a whole slot
and a level of goal scaling to pay 12 credits back. On the map it spends a tile
out of a 12-slot budget. Owner's call: that node should not exist until you
qualify for it.

- **`EVENT_REQUIRES` is the one answer AND THE RENDERERS READ IT.** Each predicate
  is the renderer's own guard condition, and all fourteen gated renderers now test
  `!eventEligible(id)` instead of repeating it. A second copy of the condition is
  precisely how the offer filter and the empty state would drift apart.
- **An id absent from the table is ELIGIBLE, and a predicate that THROWS is
  eligible too.** The table must never be able to delete an event from the game by
  being wrong about it; the renderer's own consolation is still there to catch it.
- **A STAGE gate is not an ENTRY gate**, and the first pass got this wrong. The
  anchor `const ownedTrick = acquiredTricks || []` is unique in `js/events.js` and
  belongs to **`renderGambleDouble`** - the Gamble's double-or-nothing stage, which
  stakes a Trick - not to `renderCrossroads`. Gating `gamble` on owning a Trick
  would have blocked an event whose doors stage plays fine with none. The
  Confluence's "Nothing left in this theme" is the same shape. Those stay ungated.
- **`renderCrossroads` has NO consolation at all**, which the audit is what
  surfaced: an empty `buildCrossroadsTrades()` is a blank panel, not a take-the-fee
  tile. Its row is `buildCrossroadsTrades().length > 0` - the only gate standing
  between the player and a dead screen rather than a cheap one.
- **There are TWO consolation SHAPES** and testing for one misses the other: most
  use `evEmptyHTML` (`.ev-empty`), Tray Order uses a lone `makeChoiceEl`. A first
  audit keyed on `.ev-empty` reported Tray Order as a false mismatch. A `choices
  === 0` proxy is worse still - the Confluence, the Gamble and both slot machines
  legitimately build their own markup, so it flagged five working events.

Measured in a real browser over all 21 events, in a barren run and a stocked one:
**0 disagreements** between the table and the renderers in both, **7 events
blocked when nothing is owned** (Extra Rep, Trade a Trick, Tray Order, Spin to
Improve, Entity Slots, Maintenance, Clean Slate), **1 blocked when stocked** (Clean
Slate, with no penalties on the record yet), and **0 blocked events leaked across
400 draws**.

### The crossroads never cleared the board it drew on (r248)

`guidedCloseCrossroads` removed its bar and exited the grid-screen HUD and **left
the four tiles in `#grid`**. `render()` could not cover for it: the renderer
reconciles elements carrying `[data-card-id]` and `.gx-tile` / `.gx-filler` have
none, so **nothing in the game ever removed them**. The reward grid and the shop
happened to hide it by clearing `#grid` for their own reasons, so the tiles
survived only on the paths that do not - an event, the pick-of-three, and a plain
level - and the next round dealt on top of them. Measured: 16 cards over 4
crossroads tiles with the descriptions still legible between them, for the rest of
the run. One line at the close; verified 4 -> 0 on choose and 0 after a round deals.

### Events cannot repeat back-to-back (r191)

`openEvent` drew from an 11-event pool (16 since r211) with a bare `Math.random`. Classic routes to an event rarely enough that this never showed; Guided runs ~10 a run, where a repeat - and especially the same event twice in the post-boss pair - was near certain. `recentEventIds` (last 4) is filtered out of the draw, falling back to the full pool if that would empty it. Measured over 20,000 simulated Guided runs: **0 back-to-back repeats**, per-event share flat to within 1.5%.

### One pre-existing bug this surfaced

The post-boss red tint tested `ACTIVE_MODE?.id === 'normal'`, so **Six Suits, Spectrum and Orientation never got it** - every act mode routes its post-boss prize grid through the same place with `nodeInAct === 5`. Now `isActMode()`.

## Prize Grid (r179) - the post-boss payout

Beating a boss opens the **Prize Grid** instead of the ordinary reward grid (it **replaces** it - one grid, not two). Same machinery throughout: same tiles, same connected-path pick, same confirm/fly/apply, same `closeRewardGrid` continuation that advances the act. Three differences, all decided in `_generateRewardContent`:

- **Two fewer rows and columns, floored at 3x3** (`Math.max(3, limits.grid_rows.current - 2)`). A 5x5 board gives a 3x3 prize; a 6x7 gives 4x5.
- **Every cell is a reward.** The checkerboard (`(r+c)` even = buff, odd = debuff) is skipped entirely rather than having its debuff half swapped out, and there is no destination tile - a prize grid pays out, it doesn't route you anywhere. `debuffPos` comes out empty so the debuff fill loop simply never runs.
- **Nothing common.** Common-tier Tricks/Sleights/Knacks are filtered out of their pools (each with a fall-back to the unfiltered list, so an exhausted pool gives a common rather than a blank tile), and `prizeCategories` omits the four common resource tiles (+1 swap, +1 discard, +15s, Windfall) and the Mystery tile - "probably good... probably" is a gamble, and this is a payout. `pickPrizeSleight()` is the shop's rarity table with `common` cut out. Verified over 500 generated grids: 0 common tiles, mix is rare/epic/legendary only.

`MIN_TRICK_TILES` drops from 5 to 2 here - a 9-tile grid can't also carry 5 Tricks.

**Limits are capped, and the early-run ramp is not inherited (r189).** `buildGuaranteedRewardTiles` gives every ordinary grid a Limit Break, plus - for the **first 5 grids of a run** - the core growth upgrades (row/col, selection, +2 swaps/discards) so an opening run ramps. A prize grid takes the **Limit Break and nothing else guaranteed**: in Survival and Flow it is the only grid there is, so the first boss kill was landing all four of those on a 9-tile board. On top of that, `PRIZE_MAX_LIMIT_TILES` (3, **counting** the Limit Break) drops `limit_up` out of the category draw once the ceiling is reached, so the slot becomes something else rather than a limit tile being swapped in after the fact. Measured over 800 grids: 1-3 limit tiles, always exactly one Limit Break, identical whether it is the run's 1st grid or its 9th. The ordinary reward grid is untouched (4-6 on the first five grids, 1-4 after).

- **`rewardGridMode`** (`'normal' | 'prize'`) is the switch; `openPrizeGrid()` sets it and runs the ordinary open. `closeRewardGrid` resets it to `'normal'`, so one prize grid follows one boss and the next grid is ordinary.
- **`renderRewardTiles` centres it.** `cellLeft`/`cellTop` are anchored at the board's top-left, so a smaller grid would sit in the corner with a wedge of empty board beside it; `offX`/`offY` centre it at normal card size. Everything else downstream already reads its dimensions from `rewardCells`, so nothing else needed changing.
- **Survival and Flow use it too (r188), in place of their post-boss pick-of-three.** `rewardGridContext` gained a third value, `'survival'`, whose continuation in `closeRewardGrid` is `survivalChoose`'s own tail: set `survivalSkipCarryover` (no goal was cleared, so no score carry-over and no leftover-time credits), `triggerLevelUp()`, clear it. Both post-boss paths route here - `survivalPostBossReward` and the ENDLESS switch after the 5th boss. Their ordinary per-level pick-of-three is unchanged.
- **That made the prize grid a new OFFER PATH, which is a trap Survival/Flow already had a rule for.** `makeTrickPayload` / `makeSleightPayload` / `makeKnackPayload` never consulted `survivalEntityBanned` - they never had to, because no reward grid had ever opened in those modes. They do now (`offerBanned`), or Survival's reward-grid-only Tricks and Flow's banned clock entities leak in. Verified: 0 banned entities across 600 generated grids.
- **No entity appears twice in one grid.** Each factory picked independently, which is barely noticeable across 13 buff slots and a wasted pick on a 9-tile prize grid; `_usedThisGrid` + `freshPool()` filter what's already placed (falling back to the unfiltered pool rather than blanking), and `pickSleightByRarity` is handed the granted set plus that one.
- Dev panel: **Open Prize Grid**, beside Open Reward Grid.

## Shop

`triggerShop()` → `generateShopItems()` → `renderShop()`. **Layout = stacked shelves (r50):** `#shop-main-grid` is a vertical flex stack of four `.shop-shelf` rows (Tricks, Sleights, Knacks, Upgrades - each a fixed-width label + a horizontal `.shop-shelf-items` row), with a `#shop-footer-row` (reroll + leave) pinned below a divider. The overlay is `overflow:hidden` and shelves `flex:1` so the whole shop always fits one screen with no scroll; cards are capped at `max-height:128px`. Each shelf has a color-coded left border. `shopItems` holds curated rows, each rendered by its own function:
- **3 Tricks** (`renderShopTricks`, priced by tier via `SHOP_TRICK_PRICES`).
- **3 sleights** (`renderShopSleights`, `pickSleightByRarity`, `SHOP_SLEIGHT_PRICES`).
- **2 knacks** (`renderShopKnacks`, flat `SHOP_KNACK_PRICE`).
- **2 limit upgrades** (`renderShopLimits`, scaling cost via `limitPrice`).
- **Footer** (`renderShopFooter`): card services (remove/duplicate/change-suit/combine, capped by `SHOP_SVC_MAX`) + buy swaps/discards + **reroll** (`rerollShopItems`, which only refreshes *unpurchased* slots).

Owned Tricks/knacks and already-granted sleights are filtered out of the pools so the shop never offers a duplicate.

### The grid shop is 4 x 5 with row labels (r229)

Two options a row instead of four - four of everything made the shop a wall to read rather than a choice to make. Each row opens with a **3-wide plate naming the category** (Knacks / Tricks / Sleights / Upgrades), then its two options: `SHOPG_ROWS` 4, `SHOPG_COLS` 5, `SHOPG_LABEL_SPAN` 3.

- **`shopGridItems[r]` stays a FULL-WIDTH array** with the label columns held as `null`. That is deliberate: every existing r/c index - the selection keys, the adjacency test, `isGroupConnected`, the click handler - keeps working untouched, and only the renderer knows about the plate.
- **The plate is inert** (`pointer-events:none`). It is a heading, and making it selectable would let a connected pick route straight through it.
- **The SELL board uses the full width and carries no plates** - what you own is a mixed list, so there is no category for one to name.

### The next boss is named on the progress block (r229)

Hovering (or long-pressing) either `.rp-block` names the boss you are heading for and says what it does, so a loadout can be built against it rather than accumulated generally. `peekBossPreset()` fills the bag if empty and returns the front LIVE entry **without dealing it**, so the forecast is stable. It is still a forecast: `bossPresetIsLive` reads how many Tricks you own, so gaining your second Trick can legitimately change which boss is next - the readout says so. It stands down during a live boss, where the brief is the better answer.

### Clean Slate (r229) - the counterplay to permanent penalties

Reward-grid penalties and card curses are the only PERMANENT damage a run takes and nothing removed them. There is no global HP here, so a campfire that heals would have nothing to heal; what a run accumulates is liabilities. One of them comes off for good: the goal multiplier, the shortened rounds, the play surcharge, every card curse, the dead cells, the interest freeze, or a withheld payout.

**Every option reads the same live global the penalty is stored in**, and an option with nothing to do is not offered - a screen full of choices that would do nothing is worse than a consolation payment, which is what an empty record gets instead.

## Progression (Normal mode)
`QUARTERS_PER_RUN` quarters × (5 events + 1 boss) = 6 nodes each. `actNumber` (1..`QUARTERS_PER_RUN`), `nodeInAct` (0–4, boss at 5). `forceBossNextRound` triggers the boss after the next deal. Win at `actNumber > QUARTERS_PER_RUN` → `onGameWin()`.

## Boss system

### ONE clock and ONE score requirement (r205)

**A boss round is an ordinary round with a modifier on it.** Both halves of that are now true in code, and neither was:

- **One score requirement.** `bossGoalMet()` is `score >= roundGoal` - this round's goal, same as any other round (r155). `objective.type:'hand'` bosses layer a hand requirement **on top of** it (`handDone && bossGoalMet()`). The vestigial `target: 4000`-style numbers the presets carried were read by **nothing** and have been deleted, so a preset can no longer look like it sets a second bar. **The Ratchet raises `roundGoal`**, which is the number actually compared (an older note in this file claimed it raised `currentBoss.objective.target` instead - it does not, and if it did it would do nothing).
- **One clock.** A boss used to freeze `roundSeconds`, park it in `savedRoundSeconds` and run a **second** countdown (`bossSecondsLeft` on its own `bossInterval`). That was a leftover from the old challenge system, and it quietly switched off a large part of the game for the length of every boss, because **the round tick is where most timed things live**:

| what died during every boss | because |
|---|---|
| Tick-Tock · Second Hand · Quarter Chime · Minute Hand · Hourglass | `handleClockMarks` runs on the round tick |
| Tempo's resource drip · the Cuckoo · Compound · the Woodpecker · Slow Burn accrual | same tick |
| Focus decay, the board heartbeat | started by `startRoundTimer` |
| `pauseRound` / `rewindTime` | operate on the frozen `roundSeconds` |
| **swap and discard time costs** | billed to the frozen clock, so **interacting was free during a boss** |
| **The Tollman** | its whole gimmick is doubling those costs, so it did nothing on its own round |

  `triggerBoss` now just sets `roundSeconds = bossWindowDuration` and lets the ordinary timer run. **`bossSecondsLeft` and `bossInterval` are gone** - do not reintroduce a second countdown. What moved where:
  - `startBossTimer()` arms the scheduled effects (`bossStartScheduledEffects`) and then calls **`startRoundTimer()`**. It is still the one place a boss's clock starts.
  - The boss-only parts of the tick - the Metronome's variable step (`bossClockStep()`), the halftime phase flip, `bossSyncTrickTrayState()` - are in that one tick, behind `if (bossActive)`.
  - `currentRoundDuration()` returns **`bossWindowDuration`** during a boss, which is what makes the clock bar and `rewindCeiling()` correct without either knowing about bosses. Survival banks leftover time into that window and Flow uses a flat one, so it is not simply the mode's round length.
  - `onRoundEnd()` opens with `if (bossActive) { endBoss(false); return; }`, and **`endBoss` clears `roundInterval`**. Without that clear the tick that ran the window out keeps firing at 0 and - `bossActive` now false - falls through the guard into the ordinary missed-goal path a second later.
  - **A boss round is deliberately NOT a save point.** `startRoundTimer`'s `captureRunCheckpoint()` is guarded by `!bossActive`: `forceBossNextRound` has already been consumed by the time `triggerBoss` runs, so a checkpoint taken there would resume into an ordinary round with the boss gone. The previous round's checkpoint stands.
  - `savedRoundSeconds` survives for **one** caller: the legacy timer-based modes summon a boss in the middle of a live round and put the player back into it afterwards (the `else` branch in `endBoss`). No other mode restores it.
  - **`rewindTime` no longer returns 0 during a boss.** It did because there was nothing to give back; now there is one clock and `rewindCeiling()` reads the boss window, so a rewind does what it says on a boss round.

`BOSS_PRESETS`, `triggerBoss()`, `endBoss()`. Modifiers: blocked cells (`isCellBlocked`), Trick disabling (`isTrickDisabledByBoss`), low-card famine (`maybeFamineDrawSwap`). The `fight_power` sleight bypasses all of these via `bossEffectsIgnored()`.

### The r150 roster - `js/boss-effects.js`
Eight bosses that all share one shape: **act once at round start, then on an interval**. `bossSchedule(secs, fn)` *is* that shape - it fires immediately then repeats - and it is the single place the **Contingency Plan** knack stretches timings, so a new boss inherits the knack interaction for free. `applyBossModifiers` calls `applyBossEffectModifier(mod, params)` first; it claims its own ids and returns true, leaving the legacy modifiers untouched.

The Metronome (clock runs at the Focus multiplier) · The Tollman (interact costs ×2, +3s to play) · The Undertow (−10 Focus/15s) · The Quarantine (a cell goes dark every 15s, 10s warning) · The Censor (a Trick suspended 45s every 35s) · The Blight (3 cells contaminated every 20s) · The Recall (three ranks withdrawn at a time, rotating every 45s - see the rebalance below) · The Auditor (−1 swap or discard every 30s).

### The Marker (r205) - a boss you cannot see working

**One card in every ten is silently marked. Nothing on the card, in the tray or in Records says which.** Play a marked card and it is discarded instead of scored, taking every other marked card in the same hand with it, and the hand does not score at all. Marked cards are only spent by being played, so a hand that fizzles at least clears them.

- **The mark rides `card._discardCursed`, a plain flag, and is deliberately NOT in `DURABLE_CARD_FIELDS`.** A card discarded back into the deck is rebuilt from that list, so a marked card that leaves play comes back clean and takes a fresh roll next time it is drawn - which is the behaviour we want, and it means nothing has to un-mark the piles.
- **`drawCard()` is the hook**, because it is the single point every card enters play through: the opening deal and every refill are covered by one line. The counter is **exact**, not a 10% dice roll - "one in every ten" must not clump three into one hand and then none for a minute.
- **`bossMarkerSeedBoard()` exists because the board for a boss round is dealt BEFORE `triggerBoss` runs**, so those cards never passed through `drawCard` while the boss was live. Without it the first boardful is free.
- **`bossMarkerIntercept(cells)` is called from `playHand` after a hand is confirmed but before anything is scored or mutated**, so a fizzled hand leaves no trace in the contributions, the hand log or `handsPlayedRound`. It returns true and `playHand` returns.
- The cards **fall out of the hand preview** (`bossMarkerFizzleFX`): the whole submitted hand is drawn into `#selected-cards` exactly as the scoring dance draws it - `renderCardAppearance` into the same `.dnc-*` skeleton - so sizing and the portrait overlap rules apply for free. Marked cards drop out of the bottom, the rest fade.
- `bossEffectsIgnored()` (Fight the Power) bypasses both the marking and the intercept.

### Boss roster pass (r216)

Owner-specified retunes. **The Rota is deleted** - The Censor already owns "a Trick is off", and one-at-a-time was the readable half of a job that did not need two bosses. `trick_rotate` is left in `applyBossEffectModifier` with no preset pointing at it.

| boss | now |
|---|---|
| **The Stone Lord** | stones land ON THE BOARD at once, `round((rows+cols)/2)`, **-1** if either side <= 4 and **+1** if either is >= 6 (both can apply on a 4x6), **plus** 18% of the real deck as rubble. 4x4 -> 3 on board, 5x5 -> 5, 6x6 -> 7, 7x7 -> 8; 9 into a 52-card deck. `placeStonesOnGrid` never buries more than half the live cells. `stoneInjectCount` is dead. |
| **The Hand of Famine** | **stacks the DRAW PILE instead of forging cards** (below) |
| **The Cornerless King** | corners voided **and half your swaps and half your discards taken**, rounded in your favour (5 -> 3, 4 -> 2), via the new `ration_half` modifier. Was -1 swap. |
| **The Tollman** | playing costs **+5s**, added on top of anything it already cost |
| **The Hold** | **two** cards every **13s** (was one every 15s) |
| **The Turnstile** | **5 credits**, and it is a REAL toll (below) |
| **The Redaction** | a whole **family** at x0.25, rotating every 90s (below) |

**THE HAND OF FAMINE reorders the deck; it does not forge cards.** `maybeFamineDrawSwap` used to REWRITE the rank of each card as it was drawn (`{...card, rank:'3'}`). It worked, but it invented cards that were not in the deck: the RECORDS matrix, the "still drawable by rank" chart and the deck audit all described a deck the player was not being dealt from, and a card drawn as a 3 could cycle back in as the King it really was. `famineStackDeck()` now weights the draw pile at boss start so low cards cluster at the front - your own cards, in a bad order. "Low" is the **40th percentile of the pile by `cardPips`**, not a hardcoded 2-6, so Spectrum's 0-20 deck works with no special case. Measured: top of pile averages **4.7 pips against the deck's 7.2**, bottom **9.8**, and deck contents are byte-identical before and after. The draw hook is now a no-op that must still exist (`deck-grid.js` calls it on every draw).

**THE TURNSTILE is a toll, not a tax.** `bossOnInteract` runs AFTER the swap or discard has happened, which is right for a cost and useless for a gate, so refusal is its own hook: **`bossInteractBlocked(kind)`**, called at the TOP of `doSwap` and `doDiscard` before anything commits. Below the fare the action is refused outright with a message and `sfxNoSwaps()`. Written as a general refusal hook so a future "you may not discard" boss has somewhere to live.

**THE REDACTION marks down a FAMILY, and it rotates.** One hand type for a whole round was both narrow and trivially sidestepped - you simply never play that one - and on a game whose hands LAYER (a suited run pays Run of 3 and Flush of 3) naming a single type barely lands. Now set / run / flush scores **x0.25 for 90s**, then a different family takes over, for as long as the round runs; a round past 3:00 gets a third family with no extra code, because `bossSchedule` fires immediately then repeats. A **bag, not a re-roll**, so the same family never lands twice running (verified: 0 back-to-back over 7 rotations). Family lookup is `NS_HAND_FAMILIES`, the same table Natural Scaling and `handLayersFor` read. Two of the three families are always paying full.

**The Metronome was already correct** and needed no change: `bossClockStep()` carries a fractional debt, so Focus x2.3 really consumes 2,2,2,3,2,2,3... averaging 2.3s per second (measured), rather than rounding away to x2.

**The Tollman's ordering was already correct too**, and is now locked in by a test: `playHandCostThisRound` is charged at `play-hand.js` ~line 452, which is AFTER `score += finalScore` (271) and AFTER `checkBossObjective` (343). Verified live - with **1 second left** on a Tollman round, a hand that costs 5s still scored, still met the goal and still won the boss.

## The takeover screens own PLAY and DISCARD (r247)

`render()` ended with

```js
document.getElementById('btn-play').disabled    = ...;
document.getElementById('btn-discard').disabled = selected.length === 0 || ...;
document.getElementById('disc-count').textContent = `(${discards})`;
```

**On a grid-takeover screen those two buttons are not Play and Discard.** The
shop repurposes them as **BUY and LEAVE** (`enterShopGridButtons`) and the
reward grid as CONFIRM and CLEAR, and the shop's LEAVE is deliberately ALWAYS
enabled because **it is the only way off that screen**. One `render()` while the
shop was up wrote `selected.length === 0` over it and left the player with no
exit - and then THREW on `#disc-count`, which the takeover has removed from the
DOM, so everything after that line in `render()` was skipped too.

Measured: calling `render()` with the shop open disabled LEAVE and threw
`Cannot set properties of null`. **Nothing calls `render()` during the shop
today** - a full audit of the buy / select / sell / reroll / leave sequence in
Classic's node flow, in Map and at four viewports logged zero renders and a
working LEAVE - so this is a guard rather than a sighting. It is worth having
anyway: "the button that leaves is dead" is a soft-lock, and it was one repaint
away from any boss tick, timer or future call site.

The two `disabled` writes are now skipped when `shopGridActive || rewardOnGrid`,
and the `#disc-count` / `#swap-count` writes are null-guarded.

## A fifth toast froze the whole game (r225)

`showMessage` trims its overflow with

```js
while (layer.children.length > TOAST_MAX) dismissToast(layer.firstElementChild, true);
```

and `dismissToast(el, now)` **never removed the node synchronously** - `now` only
meant `setTimeout(..., 0)` instead of `260`. So the count the loop tests never
dropped. Worse, the element it had just marked `.toast-out` made the next call
return at the top without removing anything, so the spin was permanent: **the
fifth distinct toast in one synchronous burst hung the page for good.** No boss,
no run in progress, nothing else required - reproduced on a freshly loaded menu
by calling `showMessage` five times.

`TOAST_MAX` is 4, so this was reachable by anything that says more than four
things at once: a hand firing several Tricks that each report, a boss tick, a
between-round grant. It was found by a Sommelier test that rotated the suits six
times in a loop, which is exactly that burst.

- **`now` means GONE NOW, not "fade faster".** `dismissToast` removes the node on
  the spot when `now` is set, **including one already wearing `.toast-out`** -
  that second case is the one that made the hang permanent rather than merely
  long. Both live in `dismissToast` rather than at the call site, so any future
  `dismissToast(el, true)` gets the same guarantee.
- **The trim loop also refuses to spin.** If a child is somehow still first after
  being dismissed, it is removed outright and the loop breaks. A `while` over a
  count that nothing decrements is a hard hang, and this one is not worth leaving
  a second way into.
- Verified: 4 toasts stay 4, a burst of 40 leaves 4, the repeat-suppression
  counter still reaches x5 on a repeated line, and the layer drains to 0 on its
  own afterwards.

## Sixteen new bosses (r217)

The roster went 18 -> 34. Every one of them obeys the rule the owner set: **a boss may
make a play style COST more or PAY less, but it may never make one impossible.** Nothing
here says "runs cannot be played". The harshest of them mark a family or a set of suits
DOWN and always leave something paying full, which is what makes a round a plan rather
than a wall.

| boss | what it does | where it hooks |
|---|---|---|
| **The Quota** | 20% / 40% / 60% of the goal by each third of the window; miss one and `score = 0` | the round tick, not a schedule (below) |
| **The Tax Man** | every hand costs credits equal to its card count; run dry and the round ends | `play-hand.js`, after the score commits |
| **The Grind** | a hand type pays 15% less per repeat, forgetting after 5 other hands | xSCORE step, beside the Redaction |
| **The Drought** | Natural Scaling pays nothing this round | `naturalScaleBonus` |
| **The Inspector** | a named hand type every 45s or lose 20% of score | `bossSchedule`, first tick arms only |
| **The Ledger** | goal +15% of the ORIGINAL every 30s | `bossSchedule`, first tick arms only |
| **Short Fuse** | 90s window, goal halved | writes `bossWindowDuration` (below) |
| **The Sommelier** | 3 suits at a time score x0.6 for 60s, rotating | `bossCardPipScale` |
| **The Sieve** | discarded cards do not return to the deck | `doDiscard`, not `discardToDrawPile` |
| **The Fog** | ranks hidden until a card is selected; suits stay visible | `renderCardAppearance` |
| **The Gradient** | a scoring slope across the board, turning 90 degrees every 40s | `bossCardPipScale` + `--grds` |
| **The Swell** | Focus decays 3x faster, ceiling halved | `focusCapNodes` / `focusDecayIntervalNow` |
| **The Bookkeeper** | swaps and discards share ONE pool of 4, no refill | `bossPoolSync` |
| **The Rerun** | replays, pauses and rewinds each have a 50% chance to miss | three sites, two different rolls |
| **The Magpie** | the two highest cards on the board taken every 20s | `removeAndFall` |
| **The Stale Deck** | the draw pile reordered least-played first | `cardPlayCount` |

### The traps these encode

- **A DEADLINE is not an INTERVAL.** The Quota's three marks are held as SECONDS
  REMAINING and tested on the round tick as "the clock has passed this", never fired at
  by a schedule. The Metronome can consume several seconds in one tick, so a deadline
  waited for by equality would be stepped straight over. Everything else here is a
  `bossSchedule`, which is what gives it the Contingency Plan interaction for free.
- **`bossSchedule` fires IMMEDIATELY and then repeats**, which is right for a Blight tick
  and wrong for a bill. The Inspector and The Ledger both let their opening tick only
  ARM the window (`bossInspectDone` is pre-set true; `bossLedgerArmed` starts false), or
  the player is charged before the round has begun.
- **Short Fuse can shorten the round only because of an ordering in `triggerBoss`**:
  `bossWindowDuration` is set BEFORE `applyBossModifiers` and `roundSeconds` is written
  from it AFTER. Nothing else in the file may be reordered around that.
- **`bossCardPipScale(card, r, c)` is the ONE place a boss changes what a single card's
  pips are worth**, called from `calcScore`'s per-card loop right where the Blight's
  halving lands. It is a pure READ: `calcScore` is recomputed by `findBestHand` and by
  the live PIPS/MULT preview, so anything there that consumed a charge or advanced a
  counter would fire several times per tap. Same rule `siphonMultX` follows.
- **The Rerun's replay roll is DETERMINISTIC and its pause/rewind rolls are not**, and
  that split is load-bearing. A replay is decided inside `calcScore`, which runs on every
  preview, so a live `Math.random()` there would make the chips disagree with the score -
  it uses `_detReplayRand`, keyed on the card and the hand index, exactly as Wait For
  Iiiit does. A pause or a rewind happens once, in `playHand` or the round tick, never
  speculatively, so those roll live.
- **The Sieve hooks `doDiscard`, NOT `discardToDrawPile`.** That function is also how the
  board returns cards when a boss voids a cell, and those are not the player throwing
  anything away. Measured: 52 cards -> 50 after a 2-card discard under the boss, 52 -> 52
  with it off.
- **The Gradient publishes `--grds` and composes it into the card transform in
  `css/style.css`**, beside the heartbeat's `--hb*` and the freeze's `--frzr` - never
  `el.style.transform`, or the discard fly-out and `.card.removing` would stop beating it.
  `bossGradientPaint()` is called from the END of `render()` for the same reason
  `reapplyClockFreeze` is: a card dealt mid-round has to arrive already the right size.
  The SIZE is damped to a third of the pip scale (a 1.5x cell at full scale overlaps its
  neighbour); the tint classes `.grad-up` / `.grad-dn` are what separate a shrunken card
  from a small one.
- **The Fog must be exempt in the hand preview.** `renderCardAppearance` gained
  `revealFog`, passed by `score-dance.js` and the Marker's fizzle FX - a card in the
  preview is one you have already committed to, and fogging it there hides the hand from
  the animation explaining it.
- **The Bookkeeper ABSORBS grants rather than overwriting the counters.** The owner's
  call was explicitly *not* to disable Tricks and Knacks that hand a swap or a discard
  back, so `bossPoolSync` reads the delta since its last sync: anything gained goes into
  the shared pool, anything spent comes out of it, and both counters are then written
  from the pool. Synced on the round tick AND from `bossOnInteract`, so the two can never
  disagree for the second between an action and the next tick. Verified through the real
  `doDiscard`: 4 -> 3 -> 2, and a +1 discard grant lands as 3.
- **The Swell's cap lands on the TOTAL, not the base.** `focusCapNodes()` halves the
  finished figure, so every entity that raises the ceiling still raises it and none of
  those picks go dead for the round. `focusDecayIntervalNow()` is new and is now what
  every site arming the decay timer reads - `focusDecayIntervalMs` directly would leave
  the squeeze half-applied by whichever path happened to restart the timer. **`clearBossEffects`
  clears the flag BEFORE restarting the timer**, or the next round decays 3x faster forever.
- **The Magpie goes through `removeAndFall` and skips a tick while `animating || falling`** -
  the same two rules r213 had to give The Hollow. Measured over nine thefts: the board
  reads 16 of 16 at every reading.
- **Two presets are gated by `bossPresetIsLive`.** The Tax Man is skipped below 15 credits
  (arriving broke would make it a boss you lose on the first hand however well you play
  it, which is the one thing a boss may never be) and The Drought is skipped before any
  Natural Scaling has been earned, where it is just a plain score round.
- **The Sommelier is a BAG, not a re-roll**, so the clean suit is never the same twice
  running. With four suits, three marked leaves exactly one paying full; with Spectrum's
  seven it leaves four, which is the same three-at-a-time rule scaling on its own.

Measured for all sixteen in a real browser: every one starts, the board stays full through
a window of effects, no page errors, and nothing leaks past `endBoss` - no fogged ranks, no
`--grds` residue, Focus cap 15 -> 30 and decay 667ms -> 2000ms restored.

### #boss-banner and #boss-result were being destroyed by the reward grid (r216)

Both lived **inside `#grid`**, and `js/reward-grid.js` clears that element with `innerHTML = ''` in three places. A reward grid opens at the end of **every round**, so from the first one onward both elements were gone for the rest of the run - and `triggerBoss` then threw on `banner.querySelector(...)`, **half-starting the boss**: `bossActive` true and the modifiers applied, but no briefing, no PROCEED and no clock.

Fixed structurally: they are children of **`#grid-slot`** now, which is the element the reward grid does not touch. They are `position:absolute` overlays either way, so nothing about how they look changes; `#grid-slot` gained `position:relative` because landscape already positioned it but portrait left it static, which would have thrown them out to a further ancestor. The banner lookup in `triggerBoss` is also guarded now - a boss must never fail to start because a decoration is missing. Verified: banner survives open -> close -> render and lands centred on the board.

### The Hollow and The Recall, rebalanced (r213)

Both had been sped up 25% by two sessions reading "the card-removal boss" differently (r205 took it as The Recall, r211 as The Hollow). Measuring them showed the cadence was never the problem in either case - **they were mis-tuned in opposite directions, and one of them was dangerous.**

**THE HOLLOW now CHURNS the board, it does not shred it.** It used to null the cell and leave the hole: no gravity, no refill, so holes accumulated until a discard happened to run the fall pass. Measured live at 6s with the player not acting: **16 cards -> 9 cards and 7 holes by t+39s**, at which point the board had fragmented so badly that `findBestHand` could not return a single legal hand, and left alone it stripped all 16 cells in **96 seconds**. A boss that can hand you an unwinnable round - and "the board shrinks" is already **The Quarantine's** job, so it was a dangerous duplicate as well.

It now goes through **`removeAndFall`**, so the board is always refilled: you lose the CARD you were building a hand around, on a clock, and the board stays playable. Interval 6s -> **7s**, since a refilling tick can safely be quicker than a shredding one. Verified live: 16 cards and a legal hand available at every reading across a 40s window. **It must skip a tick while `animating || falling`** - `removeAndFall` takes the falling lock, and starting one on top of a swap or a score cuts that animation short.

**THE RECALL takes THREE ranks at a time**, not one. One rank froze an average of **1.23 cards out of 16**, and **22% of the time the rank it picked was not on the board at all**, so the boss did nothing whatever for that whole stretch. Now `rankCount: 3` on a 45s rotation, and the draw **prefers ranks that are actually on the board** so a recall is never a no-op. Measured over 300 real deals: **4.6 cards frozen (29% of the board), 0 of 300 froze nothing.**

- **`RECALL_MAX_BOARD_FRACTION` (0.4) clips the tail.** Biasing toward on-board ranks is what makes the boss bite, but a bad roll could pick three ranks holding 9 of 16 cells. Ranks are taken one at a time and the draw stops once the next would cross the cap (always keeping at least one). Average is unchanged at 4.6; worst case 9 -> 6.
- **`bossNullRank` (a single rank) is now `bossNullRanks` (a Set).** `isCardRecalled` reads the Set.
- **A withdrawn card wears a countdown now.** It had **no visual treatment at all** - you discovered a card was inert by tapping it and nothing happening. `bossRecallSecondsLeft()` feeds `cdForCard` (js/cooldown.js), so it gets the same greyed tile and red countdown ring as a card The Hold has frozen, for free.

Three more (r151) hang off **`bossOnInteract(kind)`**, called from `doSwap`/`doDiscard`, and one score hook: The Ratchet (+5% objective per interact) · The Turnstile (−3 credits per interact) · The Redaction (one hand type scores ×0.4, picked once at boss start). **The Ratchet raises `roundGoal`** - since r155 the boss win bar IS `roundGoal` (`bossGoalMet()` is `score >= roundGoal`), so that is the one number `checkBossObjective` compares against. `objective.target` is vestigial for score bosses. (An earlier revision of this file claimed the opposite; the code has always matched what is written here.)

- **TWO kinds of unusable cell, and the difference matters.** `blockedCells` = **VOID** (legacy patterns): the card is returned to the deck and nothing falls in. `nullCells` = **QUARANTINED**: cards still fall in and fill the slot, they are just inert - *a null cell, not a null card*. `isCellBlocked()` covers both, so every existing select/tap/swipe guard handles quarantine with no change; the refill logic in `card-fall.js` deliberately asks `isCellVoid()` instead so quarantined cells keep receiving cards. `cellCountsForTriggers()` is what excludes them from "while on the grid" entity triggers.
- **Cell overlays repaint from `render()`**, not just when the boss starts - they are absolutely-positioned siblings of the cards, so they have to follow the board.
- **`startGame()` tears down boss effects.** Abandoning a run mid-boss otherwise left scheduled effects running, and a quarantine cross would land 10 seconds into the *next* run.
- **The Metronome** uses a fractional carry (`_bossTimeDebt`) so ×1.4 Focus really costs 1.4s/s instead of rounding away to ×1.
- **The Blight's Trick suppression rolls BEFORE the Trick logic, not after.** The first version rolled at the end of the per-card loop and restored the `_cp` ledger - which corrected the contributions readout while the score kept every Trick bonus, i.e. the suppression was purely cosmetic. The roll now happens at the top of the loop so the per-card MULT accumulators (`_asmMult`, `_fsMult`) can be skipped too, and a muted card falls back to `(_origPips + permPips) × retriggers`. Verified numerically: a Three of a Kind with Rich Soil scores 198 clean, 144 blighted, 135 blighted-and-suppressed. Whole-hand Tricks are still unaffected - tagged TBD.
- **Contingency Plan** shaves the *surcharge*, not the base: a ×2 interact cost becomes ×1.9, not ×1.8.

### Which boss you get (r179) - `nextBossPreset()` in `js/boss.js`

Bosses were dealt as `BOSS_PRESETS[bossNumber % length]` with `bossNumber` reset to 0 every run, so the order was **fixed**: boss 1 was always The Stone Lord, boss 2 always The Voidwright, boss 3 always The Hand of Famine. A Classic/Six Suits/Spectrum act run fights exactly **3** bosses and Survival/Flow **5**, so **11 of the 16 presets - the whole r150/r151 roster - could never appear in normal play**, and the three you always got were the quietest ones on the list. That is the entire reason bosses read as "not doing anything".

- It is a **bag, not a re-roll**: `bossBag` holds a shuffled list of ids, dealt from and refilled when empty. No repeats inside a run, every boss reachable. Reset in `startGame` and `survivalInitRun`; in `SAVE_VARS` so a resumed run keeps its remaining bag.
- **`bossPresetIsLive()` skips a boss that cannot bite.** The Voidwright splits your owned Tricks and disables half; The Censor suspends one at a time. At 0 or 1 Tricks owned both are literal no-ops, so they are passed over until there is something to lose. Two passes, then it takes the front of the bag anyway rather than loop.
- The dev panel's unnamed **Trigger Boss** now deals from the same bag instead of quoting `bossNumber`.

### The Voidwright, rewritten to be readable (r188)

It used to split your **whole tray** in two and disable half of it per phase, so it scaled with how many Tricks you owned: unreadable at 8 Tricks, near-invisible at 2, and there was no way to see which ones were off. Three changes, all aimed at the same thing - you should be able to plan the round from the briefing.

- **A fixed count per phase, not a fraction of your tray.** `params.perPhase` (2) Tricks are off for the first half of the boss window, then those come back and a **different** two go off for the second half. Owning more Tricks now makes the boss *easier*, which is the right way round for a reward. Below 4 owned the split is evened out rather than dumped into the first half (own 3 → 2 then 1; own 2 → 1 then 1); `bossPresetIsLive` already blocks the boss below 2.
- **The split is decided once, in `applyBossModifiers`, and never re-rolled.** That is the whole reason the briefing can print both halves up front.
- **`bossTrickPoolsHTML()`** fills `#boss-trick-pools` in the briefing with your tray sorted into three rows - OFF · FIRST HALF, OFF · SECOND HALF, UNAFFECTED - drawn as the **shared entity tiles** (`entityTileHTML`), so the Trick in the brief is the same object as the one in your tray. The row for the half you are in is outlined red and marked NOW; reopening the brief mid-round (the GOAL chip or the act readout) re-renders against the current phase.

**A switched-off Trick is greyed everywhere it appears**, which covers The Censor too:
- **Tray:** `.trick-tray-chip.trick-off` drains the tile (`saturate .12 brightness .55`) and stamps a red **OFF**. Set from `isTrickDisabledByBoss(id)` in `renderTrickTray`.
- **Records → Owned:** `recordsEntityCard` takes an `off` flag; the card goes dashed and half-opacity and its rarity tag is replaced by **SWITCHED OFF**, with a note on the Tricks heading.
- **`bossSyncTrickTrayState()`** (js/boss-effects.js) runs on every boss clock tick. Neither boss has an event for switching a Trick back ON - the Voidwright's halves flip on a tick and the Censor's suspensions expire lazily when read - so it compares the switched-off id set against the last one and repaints **only on a change**. A blind re-render every second would restart the tray's marquee/fan on every tick.

### Boss effects start with the clock, not with `triggerBoss` (r179)

`bossSchedule()` used to fire its opening tick immediately, inside `applyBossModifiers` - which runs in `triggerBoss`, **before** the briefing panel and its PROCEED button. So the opening Blight/Quarantine/Censor/Undertow tick landed while the player was still reading what the boss does, and every interval tick after it was silently dropped (`run` returns early on `gameTimerPaused`) for as long as the briefing sat open. Both read as "the boss did nothing".

`bossSchedule` now only **arms** an effect into `bossPendingSchedules`; **`bossStartScheduledEffects()`**, called from `startBossTimer` (the one place the boss clock actually starts), fires the opening tick and starts the repeat. `clearBossEffects` empties the pending list too, so an abandoned boss can't leave one armed.

**Known gap, unchanged:** `cellCountsForTriggers()` is defined in `boss-effects.js` and **called from nowhere** - the documented rule that a quarantined cell's card shouldn't count for "while on the grid" entity triggers is not actually enforced.

### Boss approach - `js/boss-approach.js` (r177)

Dread, then a clean slate, for a boss that arrives with **no screen in front of it**. In Classic the boss is announced by the architecture - round end, payout, reward grid, a path to a node marked with a skull. Flow has none of that: its five-minute session clock reaches zero and a boss lands on the board you were mid-hand on, and until zero that clock reads like an ordinary round timer.

- **`bossApproachSecondsLeft()` is the single question** - "how many seconds until a boss starts, or null". Only **Flow** answers it today, because only Flow summons a boss off a clock with nothing in between. **Survival is deliberately not wired**: its boss fires on the next DEAL after the cadence elapses, so a countdown would hit zero and then sit there for however long the current goal takes - a countdown that lies is worse than none.
- Last 30s: the colour drains, a heartbeat (`sfxHeartbeat`, which existed unused since r95) starts and accelerates from 1900ms to 420ms, and the last ten seconds count down over the CRT. Everything scales off **one custom property, `--ba-t`** (0→1), which is why there is no per-orientation rule anywhere in it.
- **`--ba-t` is published on `:root`, not `#stage`** - the FX overlay is a *sibling* of `#stage`, so a property set on `#stage` would never reach it.
- **The FX overlay is mounted on `#cab-screen`, outside `#stage`, on purpose.** The drain is a `filter`, and a filter applies to the whole subtree - inside `#stage` the red alarm would drain along with everything else. Sitting on the CRT bezel also means one overlay covers both orientations with nothing measured.
- **The drain is an EXPLICIT LIST of HUD elements, not one filter on `#stage`.** A `filter` makes its element the containing block for every `position:fixed` descendant, and `#stage` contains the Mart, the pause menu and the pick screen - any of which the player can open during those thirty seconds. Draining `#stage` wholesale would silently re-anchor them. `#grid` covers the board and its cards in one go.
- **The wipe zeroes the score, and that changed Flow's bar.** `flowTriggerBoss` used to read `roundGoal = score + survivalGoalForLevel(level)`: the score carried in and the quota rose to match, so the bar opened part-full and the player had to work out that the DELTA was the real target. The delta is identical either way, so the score is now banked into `totalScore` (exactly as `triggerLevelUp` does) and zeroed, and the boss opens on a clean `0 / quota` like every other mode's. `bossApproachWipe()` is presentation only - the state is already correct on its first frame, so an abort cannot strand a half-reset run.

### Boss presentation (r150)
`preset.brief` is the plain-English description shown on the **preamble** - a briefing over the board with the sigil, name, flavour, what the boss does, the objective, and PROCEED. **The clock does not start until PROCEED**, then a boss-only 3-2-1 runs (`showBossCountdown` - the round-start `show321Countdown` also deals cards and refills the clock, which a boss needs neither of). On a boss round `#run-progress` gets `.boss-sigil`: the node pips collapse into one pulsing mark that leaks smoke.

The **3-2-1 is now centred on the grid** in landscape - `#countdown-321-overlay` was `position:fixed; inset:0` with a 30% top pad, i.e. centred on the *viewport*. The **payout panel** is re-themed as a LETHE remittance advice (`css/boss.css`) - overrides only, so `interlude.js`'s animation classes still drive it.

## The dance clock (r218) - `js/dance-clock.js`

The dance was a chain of bare `setTimeout`s, and a `setTimeout` can neither be paused nor re-timed once armed. Two wanted behaviours both reduce to that one fact, so they share a file.

- **Pause.** `dncWait(ms, signal)` polls a real-time accumulator and only spends it while unpaused, so a wait can never resolve early: `left` is decremented by MEASURED elapsed time, never by the sleep it asked for. `wait()` in `js/score-anims.js` now delegates to it, so every animation wait in the game is pausable at once. `dncSetPaused(on)` is called from `pauseGame`/`resumeGame`; it pauses every registered WAAPI animation and puts `.dance-paused` on `body` for the class-driven keyframes (jitter/pop/pulse/flash), which are not WAAPI and so are not in the registry.
- **THE PAUSE PREDICATE IS `isPaused`, DELIBERATELY NOT `gameTimerPaused`.** The goal-hand dance sets `gameTimerPaused` ITSELF to freeze the round clock while it plays (`js/score-dance.js`), so keying off that would deadlock the very dance that set it. `isPaused` covers the pause menu and RECORDS, which is what was asked for. Known edge: `pauseGame` early-returns when no timer is live, and the goal dance has already cleared `roundInterval` - so a goal dance is not pausable. The round is already won at that point.
- **Acceleration.** Every payout tick - a card's pips, a Trick's pips or mult, a Sleight firing - calls `dncBumpAccel()` and speeds up what is LEFT of the dance by `DNC_ACCEL_STEP` (5%), compounding, ceilinged at `DNC_ACCEL_MAX` (8 = 800% of this dance's base pace). The bump happens AFTER a flight's duration is read, so the speed-up lands on what is still to come rather than on the flight that earned it.
- **`dncPace()` is the chokepoint.** Every duration in the dance divides by it, never by `dncSpeed` directly - a new site that reads `dncSpeed` silently opts out of the acceleration. `dncResetAccel()` runs at the top of `playPreviewDance`, so each hand winds up from its own base pace.
- Measured: a 4-card Run of 4 pays 4 ticks and finishes at 1.22x; a 5-card hand through a full tray reaches roughly 2.3x. The 8x ceiling needs 43 ticks and is deliberately close to unreachable.
## A boss round ends like any other round (r213)

Beating a boss used to be: the word `VICTORY` in gold Cinzel over the still-live board for 1.5s, then the prize grid. **No fall, no payout, no banner.** Three things followed from that, and all three are fixed:

- **A boss paid ZERO credits.** Interest and the leftover-time bonus are awarded *inside* `showPayoutUI` (`coins += interestCoins` / `coins += efficiencyCoins`), which is called from exactly one place - `startInterlude` - which only ran off the goal hand. `isGoalHand` is false during a boss, so the longest and hardest round of the quarter was the only round in the game that paid nothing for beating the clock.
- **Nothing marked the clear.** The gold serif was pre-cabinet leftovers (everything else moved to Orbitron / Share Tech Mono years of builds ago) and near-illegible over cream cards.
- **Nothing marked the quarter boundary.** The pips still showed the skull, the clock still read gold like a live round, and the grid that opened looked like every other reward grid.

`endBoss(true)`'s act path now fires `goalClearPresent()` and `startInterlude({ prize: true })`.

- **`startInterlude(opts)` gained exactly one option.** `opts.prize` ends on `openPrizeGrid()` instead of `openRewardGrid()`; everything before it is identical. **Both endings set `rewardGridContext = 'interlude'`**, so `closeRewardGrid`'s `finishInterlude` continuation - which is what resets `nodeInAct` and advances `actNumber` at node 5 - is reached the same way either way. That is why this needed no new continuation.
- **`endBoss` must set `frozenRoundSeconds` itself.** The payout's Efficiency line reads it, and it is normally written by the dance's goal path, which a boss never enters. Miss it and a boss pays the *previous* round's leftover time.
- **The old `#boss-result` flash is now LOSS-ONLY.** A win's banner says the same thing better and names the boss; two captions over one board is one too many. `DEFEATED` is untouched.
- **Survival and Flow get the banner and the clock lock but no payout** - they have no payout screen at all, by design. Their boss win still routes to `survivalPostBossReward()`.

**The banner carries the boss's name.** `showGoalBanner(opts)` takes `opts.kicker` (replacing the word ROUND above the title) and `opts.force`. `force` exists because the banner is normally suppressed in Survival/Flow - their pick-of-three opens on that beat with its own kicker - but a boss win there opens the prize grid instead, so nothing else would say it. `.gb-boss` restyles the kicker line: a boss name at the kicker's 5px letter-spacing is wider than the stamp.

### Leftover time - `efficiencySecondsPerCoin()` (r278, reverting r213)

**1 credit per 10 seconds left.** r213 doubled it to 5; r278 put it back (owner's call - the player ends runs drowning in credits, across every mode). The **Time and a Half** knack halves the interval, i.e. doubles the payout. Every reader goes through `efficiencySecondsPerCoin()` (`js/data/cards.js`), never the raw constant - the payout's figure, both printed "1 per Ns remaining" labels, the count-up's per-coin tick, and **Survival's per-clear bonus**. Flow is unaffected: it banks no leftover time and pays flat coins.

### Acts are QUARTERS (r213)

Player-facing only: **Q1 / Q2 / Q3**, three of them, same structure. Everything in code - `actNumber`, `nodeInAct`, `isActMode`, `actStructure` - is unchanged, so nothing about the progression moved. The strings are `js/hud.js` (`'Q' + actNumber`, the `.rp-act` line in both run-progress blocks), `js/tricks-ui.js` (the act readout, both branches), the two `<div class="rp-act">` defaults in `index.html`, and four mode descriptions in `js/menu.js`. This and **QUOTA CLEARED** are deliberate exceptions to the r178 voice rule - the owner is putting the corporate framing back on the *structural* labels while the entity and action text stays plain.

### `QUARTERS_PER_RUN` (r264) - how long a run is, in one place

**Four quarters, and the number is written down once** - `QUARTERS_PER_RUN` at the
top of `js/quarter.js`. Setting it back to **3** restores the pre-r264 run exactly
and needs no other edit; that is the whole reason it exists, because the owner
expects to switch Q4 off for the beta.

Three things read it and nothing else may hardcode the count: the rollover's win
test (`actNumber > QUARTERS_PER_RUN` -> `onGameWin`), the quarter card's pips
(built from it rather than `[1,2,3]`), and the run report's no-ghost-row rule
(`rows.length < QUARTERS_PER_RUN`). Two more sites ask "is this the LAST quarter"
and read it too: `peekNextActBoss` (there is no next boss to name) and
`knackLiveDesc`'s Advance Notice fallback.

**A fourth quarter needed no new content, and that is the point.** A quarter's
SHAPE is 5 nodes and a boss and does not mention its own index; the goal curve
rides `level`, which just keeps climbing; the boss bag refills itself out of 34
presets; and map mode anchors each quarter's boss quota to the level that quarter
opens on (`mapQuarterBossGoal`). So Q4 is six more ordinary nodes at the
difficulty the curve has already reached.

**There is deliberately NO final boss** (owner's call: not designed yet). Q4 ends
on an ordinary boss round like every other quarter, and clearing it wins the run.

**The mode blurbs say the number in words and cannot read the constant.**
`js/menu.js` and `js/picker-mode.js` are static strings evaluated at load time,
before `js/quarter.js` runs, so "Four quarters" / "FOUR QUARTERS" are typed out
in four places there. Change them with the constant.

## Quarter close (r226) - `js/quarter.js` + `css/quarter.css`

Three quarters used to roll over in **complete silence**: `actNumber++` happened inside `finishInterlude`, the pips redrew, the next round dealt. Eighteen rounds in a row with nothing marking the two boundaries. And the end screen was six lines of run totals that said nothing about the shape of the run.

- **The quarter card.** `showQuarterCard(closed, next, done)` - a ~2.4s beat: **Q1 CLOSED**, three quarter pips with one filling, **Q2 OPENS**. Auto-advances, and a tap anywhere skips it (someone on their tenth run should never have to wait). Body-level and `position:fixed`, like the goal banner: anything inside `#cabinet` inherits its CSS zoom.
- **The run report.** `runReportHTML()` replaces `#end-stats`' text list on **both** end screens - a quarter-by-quarter table (score, hands, best hand, boss, payouts) plus run totals. A run that ended badly still gets the account of itself; the quarter it died in comes through as a **partial row** marked "unfinished".

### `rolloverQuarter(next)` is the single rollover site

There were **two** copies of the same five lines (`nodeInAct = 0; actNumber++; deadCells = new Set(); updateActProgressUI(); if (actNumber > 3) onGameWin()`) - `finishInterlude`'s node path in `js/reward-grid.js` and `guidedAfterPrizeGrid` in `js/guided-mode.js`, since Guided runs slots rather than nodes. That is exactly how a card ends up showing on one route and not the other. Both call the one helper now, which closes the quarter's books, does the advance, and shows the card before running its `next` callback.

- **`finishInterlude` had to be split** so the card can run in front of its tail. Everything after the node bookkeeping is now `finishInterludeRoute(_node, _guided)`, which `rolloverQuarter` calls when the card finishes. **A won run never reaches it** - `actNumber > 3` goes to `onGameWin` and the report is the wrap-up there.

### The books are SNAPSHOT DIFFS, not a second set of counters

Every figure is a cumulative global the game already maintains - `handsPlayed`, `totalScore + score`, `acquiredTricks.length` - **marked at the quarter's start and subtracted at its close**. Adding a parallel per-quarter counter at each of those call sites is how two numbers end up disagreeing; a diff of one number cannot.

The two figures with no cumulative global are fed from the **one site that already knows each**, never from a sweep: the quarter's best hand from `play-hand.js`'s existing best-hand line, and its payouts from `showPayoutUI`'s `totalCoins`. The boss comes from `endBoss`, which already resolves the name for the goal banner.

- **The marks are in `SAVE_VARS`** (`quarterLog`, `qHandsMark`, `qScoreMark`, `qTricksMark`, `qStartTime`, `qBestName`, `qBestScore`, `qPayouts`, `qBossName`). Drop them and a resumed run's quarter rows read as the whole run so far, because the marks would restart at zero.
- `_qScoreNow()` is `totalScore + score`. `totalScore` alone under-reports by the live round, the same reason `js/history.js` sums them.
- **No ghost Q4.** `runReportHTML` only appends a live partial row when it has hands in it and fewer than three are logged; a won run has already closed its third and its tracker is empty.

### The end overlay is INSIDE `#stage`, and that is the trap

`#end-overlay` carries the cabinet's CSS `zoom` (~1.9 on a 1440px desktop), so **every px in the report block is a stage px and paints at about twice the number written**. The first pass sized it like an ordinary page and it overflowed the screen in both directions. Same trap as `#event-panel`.

It also **never had to scroll before** - six lines of text always fit, and its `justify-content: center` silently overflowed the moment they did not. `margin: auto` on the first and last flex child is the fix that keeps the group centred when it fits AND never clips the top when it does not; flex centring plus `overflow` does clip. Verified at 1440x800 and 420x740: title and PLAY AGAIN both fully on screen, nothing scrolled off.

## Goal clear (r197) - `js/goal-clear.js` + `css/goal-clear.css`

Two things happen the instant the tally crosses `roundGoal` and the game said neither out loud.

- **The round is won.** The only signal was `flashRoundEnd()`'s grid flash and the score number quietly passing a figure printed elsewhere on the panel. The win finale (jitter -> explode -> fly) plays about **two seconds earlier**, on the hand being played, so by the time the count-up actually crosses the line there is nothing marking the moment. `showGoalBanner()` puts a **QUOTA CLEARED** stamp with the goal figure over the board for 1.5s (the wording is the owner's explicit call - the one deliberate survivor of the r178 voice rule that pulled the corporate framing off every player-facing surface), on `sfxSuccess()` - which was otherwise used only by match-3's own finale, so nothing is doubled.
- **The clock stops mattering.** It froze mid-count and then sat there for the whole payout looking like a live countdown. `markClockCleared()` turns `#clock` / `#clock-bar` / `#vclock-fill` mint and stops the bar.

**The number is kept, not wound down to zero.** Carry Time banks it and Clock Tower carries it, so it is still information; and a clock that runs itself down after you have already won reads as a penalty for winning.

- **`showGoalBanner(opts)` takes a kicker and a force flag** - see the boss-win section above.
- **`flashRoundEnd()` is the single wiring point.** It is the one function in the game that means "the tally just crossed the goal" - both dances call it and nothing else does - so `goalClearPresent()` hangs off it rather than off the dance's two call sites. `startRoundTimer()` is the single release point (it also clears any muffle, below).
- **The banner is body-level and `position:fixed`, placed from JS in raw viewport px**, same rule as the Time / Limits pop-ups and the hand log: anything inside `#cabinet` inherits its CSS `zoom` and the coordinates get multiplied. It is centred on the **grid** rect rather than the viewport, so one rule covers both orientations. By the time it fires the board has already been cleared by the finale, so it lands on an empty grid.
- **Survival and Flow get the clock state but not the banner** - their pick-of-three opens on this same beat and already carries a GOAL CLEARED kicker. **Flow does not get the clock state either**: its clock is a session countdown to the inspection, not a round clock, so it does not stop at a goal clear and marking it cleared would be a lie.
- **Match-3 is not wired.** It never calls `flashRoundEnd` - `match3WinFinale` is its own mirror of the finale. One call there would pick it up.

### The audio muffle - `sfxSetMuffle(on)` in `js/audio-mixer.js`

Survival's pick opens **during** the goal dance (deliberate - the count-up and the choosing happen together) which means its panel lands on top of the finale it is celebrating. The board is still scoring underneath, so it stays audible, just muffled: a lowpass rolled down to **620Hz** plus a pull-back to **0.55**.

- **The lowpass is ALWAYS in line, parked at 20kHz when idle** - not a node patched in and out. Patching means disconnecting the graph while voices are sounding through it, which clicks; a Butterworth (`Q = 0.7071`) lowpass above the audible range is transparent and costs one node.
- It sits between the buses and the tail, and **only the output end re-patches** when `sfxDuckGain` comes and goes, so a tail swap can never bypass it.
- It reaches samples, packs and coded sounds alike because every voice connects at `sfxOut`. **Music is not affected** - it is an `<audio>` element and never enters this graph.
- `sfxSetMuffle` is idempotent, so `startRoundTimer`'s unconditional release costs nothing.

### Peek - putting the survival pick aside

`survivalTogglePeek()` fades `#survival-pick-panel` out and makes it inert; `#sv-peek-restore` brings it back. Nothing is decided or timed by it - the deal still waits on `survivalChoose` either way.

- **The restore button lives OUTSIDE the panel.** The panel is `pointer-events:none` while peeking, so a button inside it would be unreachable.
- **It is `opacity:0`, not `display:none`.** The fade has to be visible or the panel reads as dismissed for good rather than set aside.
- **Landscape docks it bottom-LEFT** (over Records/Pause, neither usable during a pick). Bottom-right there sits on the corner of the grid, which is the one thing you peeked to see.
- **`survivalSyncPickAudio()` owns the rule** "muffled iff the pick is showing and not peeked", and every path that changes what is on screen calls it: show, choose, peek, and the Mart's return in `js/mart-shop.js`. Opening the shop from the pick releases it outright - the Mart is what covers the board then.

## Scoring dance (preview-window · `playPreviewDance`)
When a hand is played, the escalating score animation ("dance") runs in the hand-preview slot (`#selected-cards`, `.dnc-active`). `newDanceEnabled` (default on) routes `playScoreDance` → `playPreviewDance`. Behaviour (desktop):
- **Cards fly into the preview (r89):** normal hands fly a clone of each selected grid card (built from `renderCardAppearance`) from its grid cell into a preview slot (`flyGridCardToSlot`), then reveal the slot's `.dnc-card`. Goal hands keep the in-place pop (they salute). Grid cards hidden mid-fly are tracked in `dncHiddenGridEls` and restored if the dance aborts before `removeAndFall`.
- **Sideways scroll for large hands (r89):** cards live in a clipped `.dnc-items` viewport holding a sliding `.dnc-track`; if the strip overflows, each scoring card slides the track left to reveal hidden cards. (Hands cap at 5, so on the full-width desktop box this rarely triggers - it's there for smaller viewports / future larger hands.)
- **Interrupt handoff (`danceInterruptMode`, r90; reworked r116):** submitting a new hand mid-dance always cuts the old dance's grid/logic **immediately** (grid- and deck-safe - the new hand's already-computed cells can't be invalidated). A dev toggle (HUD section) picks the *visual* handoff: `ff` (rush the old score up, ~360ms - **default since r116**), `cut` (instant), `resolve` (snap + pop, ~200ms). A 260ms spam valve skips the count-up flourish on rapid chaining.
- **Rapid-submit score resolution (r116) - was a game-wide bug.** The outgoing hand's total now **always** lands on the score display the moment it's interrupted (animated via the flourish, or snapped instantly on the `cut`/spam path). Previously the display was only written during a dance's own score-climb phase, which happens *after* the fly-in and the entire card-beat phase - so chaining hands fast left the score frozen on a stale mid-climb number until some hand was allowed to finish (or the goal hand landed). The underlying `score` was always correct; only the display lagged. The handoff also now runs **concurrently with the incoming hand's fly-in** (instead of blocking before it), so the new cards float into the preview while the old total rushes up behind them, and the new hand's beats wait on that count-up. `danceInterruptFlourish` is awaited, so it has an abort + timeout escape hatch - rAF is throttled to zero in a background tab and would otherwise stall the incoming dance.
- **Superseded-dance guard (`dncGen`, r89):** a dance that gets superseded bails silently and never touches the shared stage/score (which the successor owns) - this fixed particles flying from a stale/detached preview box on double-submit.

## Spectrum mode - the numeric colour deck (`MODES.spectrum`, r160–r164)

Classic's 3-Act game on a deck with **no suits and no court cards**: seven **colours** (🔴 🟡 🔵 🟢 🟣 🟠 ⚫) with the 9s, 10s and 11s drawn as **white**, and the values **0–11 plus a lone 15 and a lone 20** — 7 × 14 = **98 cards** (of which the 21 nines/tens/elevens are white), plus the four payout fixtures below. Everything else (rounds, reward grid, events, Mart, bosses, Tricks, Sleights, Knacks, Focus) is Classic's, untouched.

- **How the deck is swapped.** The colour goes in the card's existing `suit` field and the value in `rank`, so *every* system that already keys off those two fields keeps working with no changes: flush = "all one suit" = all one colour, `cardKey`, curses, perm pips/mult, the deck audit, saves. Only the CONTENT of the fields changes. `startGame` picks the lists: `ACTIVE_SUITS = COLORS`, `ACTIVE_RANKS = RANKS_NUMERIC` (`ACTIVE_RANKS` is the new mirror of `ACTIVE_SUITS` - every deck-composition site now reads it instead of the raw `RANKS`).
- **Colours are emoji**, deliberately. Any UI that just prints the suit character (deck view, RECORDS, tooltips, the Mart, shop pickers) stays readable with zero extra styling, and `suitClass()` returns `num-suit col-<name>` so anything that *does* want to style it can.
- **Rank maths.** `RANK_ORDER` gained `0`, `1` and `11`–`15` and `20`; `2`–`10` already mapped to themselves, so no classic key changed value. Pips fall through `cardPips` — **pips = the number on the card**. The gaps are deliberate: **15 and 20 can never be part of a run or straight** (big-pip loners that only pair/set), and **0 is a genuine dead card** that still counts for sets and colour flushes.
  - **`cardPips` had to be fixed for the 0.** It was `RANK_PIPS[rank] || parseInt(rank) || 10` — and `parseInt('0')` is `0`, which is falsy, so a 0 card would have scored **10**. It now tests for a real number instead. Classic ranks are unchanged.
- **WHITE — the colourless values (r164, reworked r165).** **9, 10 and 11 are drawn WHITE (⚪) and can never complete a flush.** This is the lever that cuts flushes without adding a playable colour: measured over 8,000 opening 4×4 deals, a Flush of 3 is available on **28%** of boards instead of 51%, while a Run of 3 is unchanged at **58%** (only the colour label moved, not the value spread). Three-of-a-kind is unchanged too (14%) — there were always seven 9s. On a 5×5 board it's 45% vs 71%.
  - **Whiteness is DERIVED FROM THE VALUE, never stored on the card** (`isWhiteCard` / `cardColorSuit` in `js/data/cards.js`). Each card keeps the colour its deck slot gave it, so the seven white 9s are **seven separate cards with seven separate `cardKey`s** — they buff, curse and get tracked independently like any other card.
  - **r164 got this wrong and it is the trap to remember.** It repainted `suit` to `'⚪'` at deck-build time, which collapsed all seven onto the single key `9-⚪`: a permanent pip/mult buff — or a curse — on one white 9 applied to **all seven**. Deriving whiteness instead also removes any need to preserve per-card state through the discard → reshuffle → redraw round trip, which rebuilds cards from `{rank, suit}` alone and would have dropped a stored flag.
  - **The split is: `cardColorSuit()` for anything the player SEES, `card.suit` for anything that IDENTIFIES a card.** Display sites routed through it: the card face (`renderCardAppearance`), deck-view chips, score particles, the per-card audio chirp, the shop's card list, and the colour-COUNT Tricks (a white card counts as the colour *white*, not as the colour of the slot it came from).
  - **Flush-inertness is now an explicit test**, not a side effect: `detectHand`'s `allSameSuitStrict` is false if any card `isWhiteCard`. Under r164 white got this for free by being absent from `ACTIVE_SUITS`; now that white cards carry a real colour underneath, three of them from the same slot would otherwise read as a flush.
  - White is not a tuner chip; it's derived. Turning value `9` off in the dev tuner removes the white 9s, and turning a colour off removes that colour's white cards too.
  - The RECORDS deck map keeps its rank × colour shape (every cell is exactly one real card again) and tints the 9/10/11 cells white.
- **Flush of 3 pays nothing (r164).** `applyModeHandValues()` overrides `HAND_BASE['Flush of 3']` to **0 pips / ×1 mult** and `HAND_FOCUS['Flush of 3']` to **0** for Spectrum only, restoring the pristine table for every other mode (both tables are global). The same three cards now score 15 as a flush and 105 as a run. It stays legal and detectable — it just isn't worth playing for.
  - **`detectHand` now picks by VALUE, not by fixed order.** Flush of 3 and Run of 3 can describe the same three cards, and flush was checked first. With the flush zeroed that would have silently punished single-colour runs, so the check is now "flush unless the run is worth more" (`HAND_BASE[h].pips * HAND_BASE[h].mult`). Six Suits pays more for the flush (75 vs 60) and is unchanged; Spectrum's run wins at 60 vs 0. Verified in both modes.
- **Hands.** Detection is unchanged. Flushes are colour flushes and with seven colours they're rare, so (like Six Suits) `Flush of 3` and `Flush of 4` are active from the start - the check in `startGame` is now `suitCount >= 6`. Blackjack (pip total exactly 21) still works - 20+1, 15+6, …
- **Tricks that can't exist here are filtered out of the pool** - see `NUMERIC_BANNED_TRICKS` / `applyModeEntityFilter()` in `js/data/tricks.js`. Thirteen are pulled: the Ace/court ones (`first_light`, `wild_heart`, `face_value`, `king_guard`, `knave_power`, `royal_trio`, `queens_upgrade`, `aces_absorb`, `undue_influence`, and `little_guys`, which would otherwise be *free* - every hand has "no face cards") and the named-suit ones (`club_double`, `monochrome`, `spade_flood`). Colour-**count** Tricks (Rainbow = 4 distinct, Balance = exactly 2, Kaleidoscope = 4+) still work as written and stay in. **166 → 153.**
  - **The filter mutates `TRICK_POOL` in place** rather than patching the dozen sites that draw from it (reward grid, events, shop, Mart, wheel, survival, dev panel…). They all share the one array reference, so re-filling it at `startGame` is a single-point change; `TRICK_POOL_ALL` holds the pristine list and a classic mode restores it. Resume goes through `startGame` too, so a saved Spectrum run gets the same pool.
- **Card face** (`renderCardAppearance` + the *SPECTRUM* block in `css/style.css`): the whole card **is** the colour with the value large in the middle and no suit glyph. Keyed off `isColorSuit(card.suit)` - the CARD, not the mode - so the grid, the hand preview, the scoring dance and the fall animation all agree. `--num-color` / `--num-ink` carry the palette; `.num-wide` shrinks two-digit values. Two things needed explicit overrides so the colour isn't repainted away: **selection** (`.card.selected.hand-valid/.hand-ready` set a cream `--card-bg` → replaced by a blue ring) and the **row/column marker tints** (→ a coloured inset ring instead of a flat wash).
- **Monopoly** (`monopoly`, r161) is Spectrum's **Ace Absorb**: same effect - a scoring card swallows one random adjacent non-scored card, taking its permanent bonuses plus its pip value, and every copy of the victim is erased from the deck - but triggered by a **15 or a 20** (`MONOPOLY_RANKS`) instead of an Ace. Both now call the shared `absorbAdjacentInto(cell, scoredSet)` in `js/play-hand.js`. It is **mode-exclusive** via `modes:['spectrum']` on the Trick, a second thing `applyModeEntityFilter()` understands alongside the ban list - so it never leaks into a classic pool.
- **Balance is unproven.** Average pips per card are a little higher than Classic's (~7.9 vs ~7.2) and there are 14 ranks instead of 13. Goals/`HAND_BASE` were NOT retuned - that's the first thing to look at if it plays too fast.

### The four deck fixtures (r161) - `js/spectrum.js`
Four extra cards shuffled into the Spectrum deck at run start. **Score two hands in a cell touching one and it pays out**, then its counter resets and it does it again: **Shift Swap** 🔀 +2 swaps · **Recycler** ♻️ +2 discards · **Time Clock** ⏱️ +10 seconds · **Petty Cash** 💵 +5 credits.

- **They are Sleights**, with a new `activation:'adjacent'` (plus `adjacentPlays` and a data-driven `payout` object). That was the point of the choice: the grid, the fall animation, long-press tooltips, swapping, discarding, the deck view and saves all handle them with no new code. Tuning one is editing its `payout` in `js/data/sleights.js`.
- **`SLEIGHT_FIXTURES` + `sleightOfferable()`** keep them out of every offer pool (shop, Mart, wheel, reward grid, events, survival) while leaving them IN `SLEIGHT_POOL` - `sleightDef()` and both render paths look them up there, so filtering the array would have made them render as blanks. They carry `rarity:'fixture'`, which no rarity table asks for. The only way to have one is to draw it.
- **`fireAdjacentSleights(handCells)`** runs once per scored hand from `playHand` (right after `fireSleightsOnPlay`). A fixture touched by three cards of the same hand still counts **one** hand, and the fixture being part of the played hand doesn't count - only its NEIGHBOURS are checked.
- **Both grid render paths show `1/2` progress** instead of the charge count - `renderCardAppearance` (fall animation, hand preview) *and* the separate sleight branch in `render()`. Miss the second and the tile shows ∞ on the board while the animation shows the counter.
- Progress lives on the card object, so it survives falls and saves but **resets if the fixture leaves the board** (`discardToPlayed` rebuilds the sleight from a fixed field list, which doesn't include `_adjPlays`).
- Granting happens in `startGame` **after `initGridData()`** - that call assigns `drawPile` wholesale, so anything pushed before it is thrown away.

### Deck tuner (dev panel → Spectrum, r161) - `js/spectrum.js`
Chips for every value and every colour; turning some off shrinks the deck. **Changes apply at the START OF THE NEXT ROUND**, never mid-round - `spectrumDeckDirty` is set by a toggle and consumed by `spectrumApplyPendingDeck()`, called from `triggerLevelUp` right after `flushPlayedDeck()`. (There's an **Apply now (re-deal)** button for impatient tuning.)

- Applying rebuilds the deck AND re-deals the board via `initGridData()`, so no off-list card is left in play. **Sleights are carried across the rebuild by hand** - they aren't part of the rank × colour cross-product, so the rebuild would otherwise delete the four fixtures.
- `startGame` reads the tuner through `spectrumInstallLists()`, so a new run picks up the current tuning immediately. Selections persist in `localStorage` (`lethe.spectrum.tune.v1`).
- **A toggle that would starve the board is refused** (`spectrumMinDeck()` = grid cells + 8, and never fewer than 3 values / 1 colour). Without that the deck can run dry and refills hand back `null`, filling the grid with holes.

## Which modes are listed (r218)

`MODE_SELECT_LIST` is the carousel; `MODE_HIDDEN_LIST` (`match3`, `zen`, `dominoes`) is built but not shown. They are experiments on a different loop - Match-3 plays its own matches and **has no boss wiring at all**, Dominoes is beta - and listing them beside the real modes invited a player to start one expecting the game the other seven modes are.

They are still whole and still reachable: **dev panel -> Modes** launches any entry in `MODES` by name (`devRenderModes` / `devStartMode`), generated from `MODES` for the same reason the boss and event rows are, so a new mode cannot go missing. That is why this is two lists and not a deletion.

**Bosses were audited across every mode in r218 and the wiring is sound.** Classic, Guided, Six Suits, Spectrum and Tutorial all arm `forceBossNextRound` when `nodeInAct` reaches 5 and `triggerLevelUp` fires it; Survival sets `survivalBossPending` off its own 300s live-play cadence and `survivalDealNext` fires it; Flow fires from `onRoundEnd` at zero. All seven verified reaching a live boss end to end. Match-3 and Dominoes have no boss path and never had one - that is the only real gap, and it is why they are now hidden.

## Match-3 auto-play mode (`js/match3.js` + `css/match3.css`, r115+)

A 5×5 board where **matches play themselves**. Listed in the mode-select carousel (`MODE_SELECT_LIST` / `MODE_META` in `js/menu.js`) alongside Classic and Six Suits. The player's only board actions are **swap and discard, and both stay 100% manual** - nothing auto-swaps or auto-discards; only the *playing* of matches is automatic. `match3Active()` gates everything.

- **Progression: its own loop, NOT the 3-Act structure.** `isActMode()` is **false** for match-3, so it deliberately skips both the act/node flow and the legacy 20-minute timer flow. A round is just *hit `roundGoal` before the clock runs out* → `triggerLevelUp()`. The three places that needed explicit exclusion: the legacy game-timer branch in `startTimers` **and** `resumeGame` (otherwise shops/bosses fire off the 20-min clock and the run hard-ends at 0), and the stray-tick guard in `onRoundEnd`. `startGame` also grants `ALL_HAND_KEYS` for match-3, since it scores real hand names.
- **Why not `actStructure: true`?** It would hand match-3 the reward grid and shops for free, but also **boss rounds** - and boss objectives only advance through `checkBossObjective`, which is called from `playHand`, which match-3 never calls. That would be an unwinnable round. Wiring bosses (and thus the reward grid / shop progression) into the cascade is the open follow-up. Note `enableBosses`/`enableShops`/`enableEvents` on the mode defs are **inert** - nothing outside `menu.js` reads them; `isActMode()` is what actually drives that plumbing.
- **Between-rounds = the standard shop** (r125): `showLevelUpScreen` delegates to `showMatch3LevelUpScreen` (in `js/match3.js`) for match-3, which deals the next board (settled, hidden behind the overlay), grants a **credit stipend** (`MATCH3_SHOP_COINS_BASE + level·MATCH3_SHOP_COINS_LEVEL` - match-3 has no coin economy of its own yet, so the shop would otherwise be unaffordable), and calls `triggerShop()`. The shop grants Tricks to the **side tray** via `injectTrickAfterReward` (never the grid). Leaving the shop routes through the `match3Active()` branch of the `#shop-close` handler → `match3AfterShop()`, which runs the goal flash + 3-2-1 deal and `startRoundTimer()` (settle + cascade). *(Earlier r122–r123 tried a fullscreen pick-of-3 then an on-grid centre-tile pick; the on-grid version fought the grid's pointer-capture - flickering hover, unreliable tap-confirm - so it was replaced by the shop.)*
- **Round-win finale** (r122): on goal-reached the cascade calls `match3WinFinale(winCells)` - a self-contained mirror of the Normal-mode goal-hand finale (jitter surrounding cards → gentle explode → the goal-clinching match's cards fly into the `#selected-cards` preview), then `triggerLevelUp`. The goal check runs BEFORE the clear so those winning cards are still on the board to animate.

- **Detection - straight lines only.** Any contiguous run of 3+ cards in a row or column forming a **flush** (same suit), **run** (consecutive ranks, ace high or low, order-independent within the window) or **set** (same rank). Sleights/Tricks/stones/blocked cells are immovable blockers and never join a match (a Sleight that must be played inside a hand can't be auto-played). *TBD: wildcard Sleights standing in for a rank/suit.*
- **Overlap priority.** `match3TypesOf` returns *every* type a window satisfies (a single-suited run is both `run` and `flush`), then `findMatch3Matches` scores each and greedily accepts non-overlapping windows **highest score first** (ties: longer line, then highest rank). Guarantees the returned matches are **disjoint** - no card ever scores twice.
- **Scoring reuses the real economy.** Each match maps to a genuine `HAND_BASE` name via `match3HandName` (set3→Three of a Kind, set4→Four of a Kind, run3/4→Run of 3/4, run5→Straight or Straight Flush when single-suited, flush→Flush) and runs through **`calcScore`**, so Tricks/Knacks/perm buffs/Focus all apply. Longer lines land on bigger hands - that's where match-4/5 escalation comes from. *TBD: Sleight activations don't fire on auto-matches.*
- **Combo multiplier** = `match3ComboMult(step)`: step 1 is ×1, then **×2, ×4, ×6…** per cascade link (score = pips × mult, so ×N score ≡ ×N pips).
- **Cascade loop** (`match3Resolve`): detect → flash → pop → score → `removeAndFall(cells,'match3')` → re-detect, until quiet. Self-guarded (`match3Resolving`) so it can be called freely; capped at 60 links. **The existing fall/refill animation is reused untouched.**
- **Entry points:** `doSwap` (after the swap animation lands), the end of `removeAndFall` (post-discard), and `startRoundTimer` - the one call site every round start funnels through. `match3PendingSettle` distinguishes a fresh deal (needs `match3SettleBoard()`, which quietly re-draws pre-existing matches so there's no free opening cascade) from a mid-round resume (must NOT re-settle).
- **Zen** (`MODES.zen`): same board, no clock (`match3NoTimer()` short-circuits the round tick) and unlimited swaps/discards (`match3ApplyZenResources` tops the pools to 99). Goals are **doubled** so levelling/reward grid stay reachable.
- **Match-type toggles** (`match3Types`, r117): flush / run / set can each be switched off in Settings, which removes them from detection entirely (`match3TypesOf` gates on them). Flushes fire *very* often on a random 5×5, and since matches must be disjoint a high-scoring flush suppresses any crossing run/set - so this is a real balancing lever. `setMatch3Type` refuses to disable the **last** enabled type (the board would deadlock) and returns the resulting state so the checkbox re-syncs.
- **Dev toggles** (dev panel → *Match-3 Mode*): infinite deck (scored cards requeue to the back instead of being held out; finite is default), infinite mode (no clock **and** no goal - sandbox), and select-before-play (highlight a match 1s before it plays so it can be interrupted; off by default).
- Manual `playHand()` and selection auto-submit are disabled in match-3; selection exists only to pick cards to discard.

## Survival mode (`js/survival.js` + `css/survival.css`, r132+)

Endless escalating-goals poker, listed in the mode carousel (`MODE_SELECT_LIST`). Real manual poker (unlike match-3) so it calls `playHand`; `survivalActive()` gates everything. **Not** `isActMode()` - no 3-Act flow, no reward grid, no node/event structure, no legacy 20-min game clock (excluded from the timer-progression block in `startTimers` **and** `resumeGame`, like match-3/dominoes).

- **The loop:** clear a round's goal → an on-brand **pick-of-three** opens over the board → pick one → next round deals. Miss a goal (round clock hits 0 with `score < roundGoal`) → run ends (the normal `_onRoundEndCore` fail path). `winCondition: 'endless'`.
- **2-minute rounds.** `currentRoundDuration()` returns `SURVIVAL_ROUND_SECONDS` (120) for survival, `ROUND_DURATION` (180) otherwise; `computeRoundResources`, `updateClockUI`'s bar fill, and `startGame`'s `roundSeconds` all route through it.
- **Score & time carry over (owner spec).** At goal clear, `triggerLevelUp` seeds the next round's `score` with the **overflow** above the just-cleared goal (`score - roundGoal`), and banks only the counted portion into the display `totalScore`. So each goal is 0→target but the leftover from the previous clear starts you partway.
- **Coins.** No coin economy of its own except: each clear pays `SURVIVAL_LEVEL_COINS` (3) **+ 1 per full 10s left** on the goal timer (`survivalAfterLevelUp`).
- **Pick-of-three (`showSurvivalPickScreen`, centred over the board).** Options are drawn from **all four entity pools** - Tricks, Sleights, Knacks, Limits - weighted (`SURVIVAL_PICK_WEIGHTS`, Tricks/Sleights lead) with a guarantee: **≥1 Limit and ≥1 Knack option every 4 levels** (drought counters `survivalLevelsSinceLimit/Knack`, forced on gap ≥ 3). Grant dispatch: trick→`injectTrickAfterReward` (side tray), sleight→`grantSleight`, knack→`acquiredKnacks.push`, limit→`incrementLimit`. **Reroll:** first 2 free each level, then 5/10/15… (`survivalRerollCost`); the count resets every level-up.
- **Goal-hand transition = Classic's flourish, minus the payout (r154).** The base goal dance runs unchanged (jitter → explode → winners fly to the preview → score count-up); survival just diverges at the two hand-off points in `playPreviewDance`: right after the fly it opens the pick (`survivalShowPick`, anchored to the RIGHT of the preview in landscape so the count-up and choosing happen together), and at the end it **skips `startInterlude`** (`if(!survivalActive())`). `handleDanceAbort` skips it too - otherwise picking mid-count-up would fire the interlude and clobber the freshly dealt board. **triggerLevelUp runs on CHOOSE, not before the pick**, so (a) the granted item is already in `limits`/tray when it sizes the next round - a picked Limit applies immediately, no deltas - and (b) `roundContributions` is still live for the breakdown. `survivalDealNext` recycles the board to the deck (`survivalRecycleBoard`) and deals fresh; it also clears `gameTimerPaused` (the dance froze it). The post-boss BONUS pick reuses the same path with `survivalBonusPick` → `survivalSkipCarryover` (no score carry / no time-coins).
- **Contributions breakdown on the pick (📊).** Survival skips the payout, so the payout's Contributions view is surfaced on the pick (`survivalToggleContrib` → `roundContributionRowsHTML`, read live). `captureRoundContrib` now also emits the **base hand-type mult** row (calcScore seeds `mult` at `HAND_BASE[hand].mult`), and `roundContributionRowsHTML` adds an **Effects** group with **Replays** (`replaysThisRound`) and **Time manipulation** (`timeManipRound` + pauses + rewinds) shown ONLY when non-zero. These accumulators are additive/shared (all modes' payout benefits) - bumped in `play-hand.js`, reset in `level-up.js`.
- **On-demand shop.** A `.survival-shop-btn` next to the coins chip (both the top-bar `#coins-shop-btn` and landscape `#ci-shop-btn`, shown only via the `.sv-on` class in survival) opens the **standard shop** any time for 5 coins (`survivalOpenShop` → `triggerShop`; the shop-close handler's `else` branch resumes the round).
- **Bosses every 5 MINUTES of play, no challenges (r155).** `survivalTickBossClock()` runs off the round tick - so it counts *live* play time only (picks, shop and menus are paused) - and sets `survivalBossPending` when `SURVIVAL_BOSS_EVERY_SECONDS` (300) elapses. The next `survivalDealNext` deals the board then calls `survivalTriggerBoss()` instead of `startRoundTimer`. The boss clock = the **banked leftover time** (`survivalBossTimeBank`, capped 180, floored 30) - `triggerBoss(preset, windowSeconds)` takes an explicit window (`bossWindowDuration`). The objective is checked in `playHand`. `endBoss` has a `survivalActive()` branch: **win** → `survivalPostBossReward()` → **loss** → `onGameEnd`. Challenges never fire (reward-grid/act-driven).
- **The run ENDS after 5 bosses (r155).** `survivalPostBossReward` opens `showSurvivalCompleteScreen()` on the 5th kill: **RETIRE** (→ `onGameWin`) or **CONTINUE - ENDLESS**, which sets `survivalEndless` + `survivalEndlessFromLevel = level` so goals past that point grow **65% faster** (`SURVIVAL_ENDLESS_ACCEL`: Classic's +35%/level → +57.75%/level). Levels before the switch keep the normal curve, so the jump isn't retroactive.
- **Goal curve:** `survivalGoalForLevel()` - base **750** (`SURVIVAL_BASE_GOAL`), same ×1.35 growth, rounded to **50** (Classic rounds to 500, which would snap 750 → 1000). Curve: 750 · 1000 · 1350 · 1850 · 2500 …
- **Rerolls are a CARRY-OVER POOL, not per-level:** 3 at run start (`SURVIVAL_REROLLS_START`), **+2 per boss beaten**, unspent ones roll forward. Once the pool is empty rerolls fall back to the escalating 5/10/15 price within that pick.
- **Reward-grid-only entities are filtered out** (`SURVIVAL_BANNED_ENTITIES` = `greedy_boi`, `more_better`, `rain_check`) from both the survival pick pools and the Mart stock - survival has no reward grid, so they'd be dead picks.
- **Shop entry moved onto the PICK screen** (`#sv-pick-shop`, "entry fee 5 💰"). Opening it from there sets `survivalShopFromPick`, which makes `closeMart` return to the still-open pick instead of restarting the round timer.

## One entity tile, everywhere (r182) - `js/entity-tile.js`

A Trick used to look like **three different objects** depending on where you met it: a neon CRT card on the reward grid, a slightly different neon card in the Mart, and a small hand-styled chip with an ellipsised name in your own tray. `entityTileInner(p, {mystery})` is now the single source, and every surface wraps its own frame around a `.reward-cell.entity.entity-<type>.rar-<rarity>` and fills it from there:

| surface | frame | notes |
|---|---|---|
| reward grid | `.reward-cell.on-grid` | the one deliberate difference: `mystery:true` hides a Trick's emoji behind a ✦ (you are picking off a board) |
| Mart shelf | `.m-item` | 3 across on a phone (`flex: 0 0 calc((100% - 12px)/3)`) |
| Mart cart | `.m-cthumb.mc-<type>` | **`mc-`, not `m-`** - `.m-knack`/`.m-sleight` are the SHELF's sizing classes, and reusing them blew a 32px thumbnail up to a full tile |
| Mart loadout strip | `.m-mini.mini-<type>` | what you own, drawn like what is for sale |
| Trick tray | `.trick-tray-chip` | frame only; must state its own `width`/`height` (it used to borrow `var(--card-w)` from `.trick-card`) |
| Shift Change | `.shift-slot` | plus the slot number badge |

**Frames carry size and stacking only.** The neon rarity border, scanlines, glare, knack diamond, sleight tab and name styling all live on `.reward-cell.*` in `css/style.css` - change them once and every surface moves.

### The objects (r228) - a Utility is a FLOPPY DISC, a Vendor is a BUSINESS CARD

Both are drawn in **`css/style.css` on `.reward-cell.entity-trick` /
`.entity-sleight`**, and nowhere else. That is r182 paying off: seven surfaces
wrap their own frame around the one class list, so **all seven changed shape
with no per-surface code** - reward grid, Mart shelf, Mart cart thumbnail, Mart
loadout strip, Trick tray, Shift Change slots and the trick-lose picker rows.
(RECORDS Owned held out until r239, when its rows gained the shared tile too -
see "Every listing shows the object" below.)

**Ported from `art-preview.html` as CSS, not as its SVG.** The preview draws at
one size on a blank page; the game draws this tile from a 32px cart thumbnail to
a 118px card, and CSS scales for free while leaving `fitEntityName`, the
improvement badge, the cooldown ring, the boss grey-out and the selection glow
working untouched. Injecting an `<svg>` per tile would have meant sizing it at
six call sites.

- **`--body` is the material**: the rarity hue mixed 72% toward the object's own
  plastic - `color-mix(in srgb, var(--rc) 72%, #1b1813)`, which is art-preview's
  `bodyFor()`. Its `inkOn()` is **not** needed: at that tint against a near-black
  plastic all four tiers land at luminance **0.14-0.27**, well under the 0.42
  where ink would have to flip, so ink is cream on both materials at every tier
  (measured, all eight combinations).
- **Both drop the scanlines and the glare.** Those are the CRT-screen treatment,
  and a disc and a card are physical objects in front of the screen rather than
  pictures on it. That is also what frees `::before` and `::after` to be the
  object's own parts, which is what keeps this CSS instead of markup.
- **The floppy**: chamfered shell, a metal shutter whose window is punched by a
  hard-stop gradient layer, and a cream label plate. (r228 clipped the chamfer on
  the ELEMENT; since r239 the whole disc is one letterboxed band and the clip
  moved onto it - see below.) **The emoji and the name both sit ON
  THE LABEL** - which is what a floppy label is for - in dark ink. It is the one
  place in the tile system where a name is not light-on-dark.
- **The business card is LETTERBOXED** (owner's call), not stretched. It is
  landscape (1.37) and every frame it lands in is portrait, so the element goes
  transparent and the card is painted by `::before` at its real proportions,
  centred: about **55% of the frame's height** at every size. Stretching it to
  the frame was the alternative and it stops being a business card.

**THE BLOCK MUST STAY BELOW THE BASE TILE RULES.** `.rwd-glyph` and `.rwd-tab`
are already selected at `.reward-cell.entity-trick .rwd-glyph` - the SAME
specificity as the overrides - so order is the only thing that decides them.
Written above those rules, the floppy kept the old Trick star and the business
card kept its neon tab, and both were visible in a screenshot while a syntax
check passed.

**Three more pre-r228 leftovers sat in `css/mart.css`'s `max-width: 820px`
block** and only surfaced on a small screen, which is why the first pass missed
them: a `top:auto; bottom:0` on the loadout mini's art, and the sleight notch
plus the `.rwd-tab` sizing on `.mini-sleight`. All three carry `#mart-overlay`
in the selector, so they outrank the object rule on the ID and would have put
the old tile back at that width.

**`top` on `.rwd-art` was removed from five per-surface rules** (two tray, three
Mart). Each was a copy of one assumption about the pre-r228 tile, and each
outranked the object rule because they are written with `#stage` / `#mart-overlay`
in the selector. Position belongs to the object now; the surfaces keep only their
font size. `.rwd-art` is emitted for tricks and sleights and nothing else, so
there is no third consumer still wanting the old value.

#### The grid Sleight is the same card (r228)

A Sleight on the PLAY GRID is `.trick-card.sleight-card` at the full card cell,
**not** a `.reward-cell` - it is a real deck card that falls, swaps and is played
in hands - so it is styled separately and letterboxed the same way. The board
loses nothing: a Sleight already looked unlike a playing card on purpose, which
is how you pick one out of a boardful, so the silhouette gives a difference that
was already there a meaning.

It keeps its **corner index**, and that is not decoration: a grid Sleight is
played inside a poker hand, so its cosmetic rank and suit have to stay readable
(`sleightFace()`, js/sleights-runtime.js). On the card it reads as the small mark
a real card carries beside the logo.

- **ONE CONSTRUCTION PLACES EVERY CHILD, on both cards.** Each child is stretched
  to the card's own band with `aspect-ratio: 1.37` and then PADDED into its
  region, with `border-box` doing the arithmetic. CSS cannot be told the card's
  height from the frame's two dimensions, and this is what avoids a per-child
  magic offset that would drift on every surface and every `--card-h`.
- **The name is NOT beside the logo, and that was measured.** The longest Vendor
  name is one unbroken 11-letter word (Syncopation, and four more at 9-10), and a
  frame is only 57px wide on both the reward grid and the board, so a half-width
  column leaves about 25px. Words are atomic here (r182), so it simply truncated
  every long name to an ellipsis - "Warehouse" came out **"WAREH / OUSE"** before
  `.sleight-card-name` was given the same `word-break: keep-all` the tile has.
  Logo upper-left with the name full width underneath is the layout that fits the
  roster the game actually has.
- **The resting rarity edge moved onto the CARD.** Left on the cell it outlined
  the empty slot the card is centred in, which is the one thing the letterbox
  exists to leave alone.

### The objects keep their RATIO everywhere, and every listing shows them (r239)

Owner spec, two halves.

**1. A floppy is 3.5 inches wherever it appears.** Both objects letterbox against
BOTH axes now: the frame is a `container-type: size` CONTAINER and the band is
`width: min(100cqw, calc(100cqh * R))` + `aspect-ratio`, centred with a
translate. Insets alone can only letterbox the axis they span - a frame WIDER
than the object (the shop's 2-cell tiles) stretched and clipped the disc, which
a syntax check cannot see and a screenshot can. The disc's ratio is the real
3.5" disc's (`aspect-ratio: 20 / 19`, art-preview's `flopAspect` 0.95 h/w); the
chamfer clip-path moved from the element onto the band, so the rarity edge is an
INSET box-shadow (an outer one would be clipped away). Shell, shutter and label
are LAYERED BACKGROUNDS on the one `::before`, because a second pseudo could not
share the clip; a layer at left L% width W% sits at `background-position-x`
L/(100-W)*100%.

- **The object's TYPE scales with the object** (`33.5cqw` art / `17.5cqw` name
  on the disc, `37cqw` / `17.5cqw` on the card - each the old px value at the
  57px frame). Fixed px meant a 34px Records tile drowned under a 19px emoji
  and a 119px shop tile rattled around one. `fitEntityName` still shrinks a long
  word from wherever the cqw lands it.
- **A frame that pins the tile must be `position: relative`, never static** -
  the band is an abspos pseudo and anchors to the nearest positioned ancestor,
  so a static frame paints the object across whatever contains it.
- **Fit labels AFTER the panel shows.** A hidden element measures a zero rect
  and the fitter leaves a long name to clip ("CAPACITOR" painted "APACITOR",
  centred overflow eating both ends). The survival pick and the guided pick both
  refit in a rAF after their panel is visible.

**2. Anywhere an entity is LISTED, the listing leads with the OBJECT - the same
tile the tray draws - and the words sit BENEATH it.** Wired: the Survival/Flow
pick-of-three (`sv-pick-tile`; limits keep the bare icon - no object to show),
the guided pick-of-three (which also finally passes its RARITY -
`entityTileHTML(p)` with no second argument had drawn every offer common), the
events (a `tile:` payload adds `has-tile`, flipping `.ec-top` to a column;
Rehearsal, Workshop, Trade a Trick and the improve draws gained the payloads
they lacked), and RECORDS Owned (`rec-ent-tilebox`, name hidden at 34px - the
row states it; note the hide needs THREE classes, the object rule sets
`display:flex` at the same depth).

- **Tiled event choices wrap TWO ACROSS** via
  `#event-panel div:has(> .event-choice.has-tile)` - the container is found by
  `:has()` because event bodies wrap choices in ad-hoc divs. **`flex-direction:
  row` must be restated**: `#event-body` is a flex COLUMN, and a column with
  wrap at auto height never wraps - it just stayed one per line, centred, which
  looked exactly like `:has()` failing.
- The event tile keeps its own label now (`.ec-tile .rwd-name { display:none }`
  is gone): the tile is a picture of the thing you will own, name included.

**What is NOT done yet:** the playing card itself. `art-preview.html` also draws
the card as a **document with a folded corner** (`docSVG`), and that is the piece
that would make the board one system rather than business cards among cream
playing cards. It is also the expensive one - it touches every card on the board -
and the owner's tuned `cellAspect` of 1.12 in that file is a squarer grid cell,
which `CARD_MIN_H` (53) silently overrides at 5x5. Treat it as its own pass.

### Names never break mid-word (r182) - `js/fit-text.js`
Owner's report: "The Heron" rendered as `the / hero / n`. Two causes, both fixed:
1. the tile allowed `overflow-wrap: break-word`, and
2. `fitEntityName` only checked HEIGHT - three short lines fit three allowed lines, so it never shrank anything.

Now **words are atomic**. CSS is `overflow-wrap: normal; word-break: keep-all; hyphens: none`, and the fitter works in three passes:
1. **width** - measure the longest word on an offscreen canvas (honouring weight, `letter-spacing` and `text-transform`) and solve directly for the font size that fits it on one line, then verify and step down by 0.5px.
2. **height** - shrink until the wrapped result fits `maxLines`.
3. **last resort** - `truncateToWidth` shortens the offending WORD with an ellipsis ("KALEIDOSC…"). There is deliberately **no "break it anyway" fallback**; the full name is always one tap away in the tooltip.

Two subtleties worth keeping:
- **`sealBreaks`** wraps `/ - – — ·` in U+2060 WORD JOINER. `word-break: keep-all` does not stop a browser breaking at punctuation, so "Swaps/Round" split after the slash while being measured as one word.
- **`FIT_SLOP` (0.75px)** and not counting the *trailing* letter-space. Canvas metrics ran ~0.4px wide of layout, which was enough to truncate "Overtime" to "Overti…" - a name that fits perfectly.
- `el.dataset.fitSrc` holds the pristine name so a re-fit never truncates an already-truncated string.

Audit script: render every name in `TRICK_POOL` / `KNACK_POOL` / `SLEIGHT_POOL` / `LIMITS_DEF` at 47/66/118px and assert no element has `scrollWidth > clientWidth` and no name uses more lines than it has words.

## Tooltips: tap to read (r182)

**One tap opens the tooltip; the tooltip carries the actions.** Tapping a Mart tile used to silently drop it in the cart, so the only way to see what you were buying was to discover the press-and-hold.

- **`showEntityTooltip(anchor, payload, { actions })`** (`js/entity-tooltip.js`). Passing any action puts the bubble in **interactive mode**: `.et-card` takes pointer events and a transparent full-screen `#entity-tip-backdrop` goes in underneath, so every click that is not on the bubble dismisses it. That backdrop is what makes interactivity safe - the bubble is up to 560px wide and lies over its neighbours, and `pointer-events:auto` without it was the old "I can't add the ones on the right" bug.
- **Mart:** hover = read-only preview (mouse only); tap/click = tooltip with **📌 Pin** and **Add to cart**. A hover never replaces an open interactive bubble, or moving the mouse off the tile would close the buttons you were reaching for. **PIN MODE** stays a bulk mode: while it is on a tap pins directly, so you can hold four things without opening four tooltips.
- **Trick tray:** reading and disposing are now separate gestures - **tap** = description + a "hold for sell / discard" hint; **press-and-hold** (`attachTrickSellHold`, 430ms, finger or mouse) = the same bubble with **Sell** and **Discard**. Before this every tap put a live Sell button under your thumb just for asking what a Trick did. The hold sets `chip._sellHeld` so the lift that ends it does not toggle the bubble straight back off.

## Reward grid: one tap, two meanings (r182)

A tile answers two questions - "what is this?" and "I want it" - and the grid decides by whether the tile is one you could actually take:

| you tap | result |
|---|---|
| a **selectable** tile | select it **and** pin its tooltip |
| a **non-adjacent** tile (or one blocked by the cap / the one-destination rule) | pin its tooltip only - **the selection is untouched** |
| an **already-selected** tile | deselect it and hand the tooltip to the previous pick |

So the most recently picked tile is always the one being explained, and you can read anything on the board without that reading costing you a pick. State is `rewardTipKey` (which tile is pinned) + `rewardPickOrder` (the order tiles were taken, so `lastRewardPickKey()` can hand the tooltip back after a deselect) - both declared in `js/boss.js` beside `rewardSelected` and reset everywhere it is. `renderRewardTiles` throws the tiles away and rebuilds them, so it calls `restoreRewardTooltip()` to re-anchor the pinned bubble to the new node.

## PAUSE vs REWIND - the clock vocabulary (r182)

Two different things, and the descriptions must not blur them:

- **PAUSE** (`pauseRound(seconds)`, `js/discard.js`) - the clock **freezes** for N seconds. Pauses **stack** (an active pause is extended, not reset). Counts into `pausesThisRound` / `pauseInstanceGame` (Hummingbird) and `pausedSecondsRound` (Albatross). The **Long Pause** knack makes every pause 1.5× longer; **Time Slip** gives each pause a 25% chance to become a rewind instead.
- **REWIND** (`rewindTime(seconds, label)`, `js/discard.js`) - the clock **gets seconds back**: `roundSeconds += n`, **uncapped since r193** (`rewindCeiling()` returns `Infinity`), with a ⏪ floater. Counts into `rewoundSecondsRound` (Kingfisher) and `rewindsThisRound`. Since r205 it **works during a boss too** - there is one clock now and the boss window IS `roundSeconds`. (It used to return 0, because the boss ran a separate countdown and `roundSeconds` was frozen, so there was genuinely nothing to give back.)

Because a rewind can push the clock back past a mark it already passed, `handleClockMarks` can fire the same clock-mark Trick twice. That is an intended synergy, not a bug.

**Roughly: pause entities outnumber rewind entities about 2:1.** Causes a pause: High Water · The Cuckoo · Double Jeopardy · The Vulture · Right Time · Temporal Rift · Five Second Rule · Four Horse-man · Wait Four It · Dam Holding… (Tricks) · Sundial · Metronome · Long Pause (Knacks) · Syncopation · Snooze Button · Stopwatch (Sleights). Causes a rewind: Overtime · Hoarder House (Tricks) · Time Slip · Rewound Echo · Déjà Vu · Clockmaker (Knacks) · Rewind · Last Call · Sandbagger (Sleights). A separate group only *scales off* the clock without touching it: The Falcon, The Hummingbird, The Albatross, The Phoenix (pause) and The Kingfisher (both).

**Every rewind now goes through `rewindTime()` (r183).** Deluge, Threepeat, Blood Diamonds and the Spectrum Time Clock fixture used to write `roundSeconds += n` directly, which skipped the ceiling, the floater and the Kingfisher/rewind tallies. There are no raw `roundSeconds +=` sites left; a new one is a bug.

### `rewindCeiling()` - do NOT clamp a rewind to `ROUND_DURATION` (r183, superseded r193)

**As of r193 `rewindCeiling()` simply returns `Infinity` - rewinds are uncapped.** The history below is why the *old* `ROUND_DURATION` clamp was wrong and why any future ceiling must not be a fixed constant; it is no longer a description of the live code.

`rewindTime` used to end with `roundSeconds = Math.min(ROUND_DURATION, roundSeconds + n)`. `ROUND_DURATION` is Classic's **180**, and the clock legitimately sits above it all the time:

| situation | round starts at |
|---|---|
| Flow's session clock | 300 |
| Round Time limit upgraded | up to the limit |
| Time Bank knack | +30s |
| Clock Tower knack | carries up to +60s |

In every one of those the `min` **cut the clock down to 180 and then returned 0**, so the player silently lost the difference and nothing reported it - 110 seconds destroyed by a single Flush in Flow. r183 made the ceiling `max(currentRoundDuration(), roundStartSeconds, roundSeconds)`, and r193 removed it altogether:
- **`roundStartSeconds` is the whole answer for the limit, Time Bank and Clock Tower** - `startRoundTimer` records it after `computeRoundResources` has already folded all three in, so no separate `limits.round_time` lookup is needed. Reading the limit as well would let a 120s Survival round be rewound up to 180.
- **`roundSeconds` is in the max**, so the clamp can never move the clock backwards. The worst a rewind can do is nothing.

### Clock-mark Tricks, and why rewinding pays (r183)

`handleClockMarks(secs)` fires once per real second with the NEW `roundSeconds`, so a rewind that pushes the clock back above a mark makes it fire again on the way down. That is the whole rewind payoff, and it only works if the marks are **dense enough to re-cross**. Measured over a full 180s round (`+1 pip` = 4.26 score, `+1 mult` = 77.3, `+1 Focus node` = 33.4, measured over 500 real boards at level 1, average best hand 334):

| Trick | tier | mark | fires/round | plain round | with 60s of rewinds |
|---|---|---|---|---|---|
| Tick-Tock | common | every 10s | 17 | 34 Focus | 46 Focus (+35%) |
| Second Hand | common | every 10s | 17 | 362 | 490 (+35%) |
| Quarter Chime | rare | every 15s | 11 | 2110 | 2877 (+36%) |
| Minute Hand | rare | every 60s | 2 | 464 | 696 (+50%) |
| Hourglass | epic | every 60s | 2 x 1/3 | a permanent retrigger | +50% more chances |

- **Second Hand moved from the minute mark to the 10-second mark (r183).** It used to share Minute Hand's exact trigger and pay +5 pips against Minute Hand's +3 mult: **43 score a round against 464**, the weakest Trick in the game by a distance. Only the hand it rides on changed - the +5 is untouched - which puts it at ~360, an ordinary common, and makes it the Trick rewinding pays best (any rewind of 10s or more buys a guaranteed extra fire).
- **Quarter Chime is the outstanding outlier at 2110 a round, against a 1200 round goal**, for a rare. Left alone deliberately - it is a nerf, not the buff that was asked for, so it wants a decision.
- **Minute Hand and Hourglass are nearly rewind-proof** by construction: two marks a round means only a rewind that crosses a whole minute buys anything.

## No text selection (r182)
`html, body` carry `user-select:none` + `-webkit-touch-callout:none` + `-webkit-tap-highlight-color:transparent`, re-enabled for `input, textarea, [contenteditable], .selectable-text`. A click-drag across the board, or the press-and-hold that opens a tooltip, used to blue-highlight whatever label the finger landed on and pop iOS's copy/define callout over the card you were trying to read.

## The COMPANY STORE (r237) - the shop board rebuilt

The shop is the PLAYER'S BOARD now: same rows and columns as `limits.grid_rows/cols` (never the live globals - a boss can have shrunk those), so raising the board raises the shop. Row 0 is a full-width **COMPANY STORE** title tile that survives every reroll; every row below is a CATEGORY: one 1-cell label plate (bright, never greyed) + cols-1 items.

- **Categories are drawn per board** from `SHOP_CATS` (tricks / sleights / knacks / **cards** / **improve** / limits), no repeats, `shopgCatViable` keeping empty sellers off. **Limits is guaranteed on the FIRST board of a visit** (bottom row); reroll it away unbought and it can leave.
- **Buying from a row PINS its category** (`shopGridRowMeta[r].pinned`, a 📌 on the label): a reroll keeps that row's category but still REFILLS its stock - a bought slot comes back as fresh goods, not a ✓. Unpinned rows reroll their category too.
- **Rerolls cost 10 + 5 each and are CAPPED BY THE SWAPS you were holding when the shop opened** (`shopRerollCap`, captured in openShopGrid - in the node flow that is what the finished round left, since the reset runs later in triggerLevelUp). The old `reroll` LIMIT is therefore dead stock and is filtered out of the shop's own Upgrades row - it still exists everywhere else (reward grid, Limit Break, Records), which wants an owner decision.
- **A tile can be WIDER than one cell: the SAME payload object sits in every cell it covers.** The renderer draws the leftmost and skips the rest; `shopgLeadKey`/`shopgCellsOf`/`shopGroupConnected` expand a key to its cells so adjacency and the connected-buy discount see the whole footprint. Today only Improve uses it: a 2-wide SPECIFIC improvement (target picked at build, before/after from `improvePreview`) beside 1-wide "Random {type}" tiles - all riding `js/improve.js` (r206).
- **Cards row** offers buffs on NAMED cards from the live deck (60% +12 pips / 25% +5 mult / 15% scaling +1 mult per play), re-resolved at apply with `resolveDeckCard` + `enhanceCardKey(cardId(t))`.
- **Sell → Back is NOT a free reroll**: the buy board is cached (`_shopBuyCache`) and restored.
- **The shop no longer squishes the left column** - the title row made the board one row shorter instead. The squish machinery (`shopSquishSet`, the arrow tab, the r230 CSS) stays DORMANT for a future grid screen; the tab now sits just RIGHT of the column edge and only shows once a caller creates it (`ensureShopSquishTab`).

### Grid-takeover chrome (r237) - what every board screen swaps out

On `body.grid-screen` (reward grid, shop, crossroads), landscape:
- The **focus bar fades out** (opacity !important - its own .dim/.lit states also set opacity) leaving a `MAX: n` note at its foot; the **clock bar shrinks away** and **`#grid-topline`** fades in over the grid: `ROUND TIME m:ss` left, credits right (`updateGridTopline`, kept live by `updateCoinsUI`).
- The **grid slides left** (`#grid-slot` 45%→41%, w 49%) into the freed room, which widens the slot gutters - where `#sel-count` lives, so the x/y readout stops crowding the board. Safe to toggle mid-screen because the board is HEIGHT-bound: the slot's height never changes, so card metrics are identical and only the centring glides.
- **`updateSelectionUI` counts the SHOP's connected selection** (`shopGridSel.size` / Selection Size). Portrait shows credits beside the x/y (`#sel-count-coins`, shop only); portrait also flips the shared strip to the hand-preview half on shop open (`setPortraitPanelView('preview', {auto:true})`, restored on close) so the cost readout is on screen.
- **Shop tooltips were BROKEN since r229 and are fixed**: `showRewardTooltipFor` read `rewardCells` - the REWARD grid's array - which is stale during the shop, so it showed the previous grid's tile or nothing. It now reads `shopGridItems` when `shopGridActive`. Selecting a tile pins its tooltip (newest pick explained, r182's rule, order in `shopSelOrder`); touch long-press (430ms in `attachRewardTooltip`) pins without selecting (the following click is swallowed via `el._lpJustFired`); every bubble (reward / knack / trick) carries a ✕ that also UNPINS, so an X'd tooltip stays closed.

### The trays (r237) - fan first, scroll only past half

- **Landscape Trick tray FANS instead of marqueeing**: tiles overlap just enough to fit, later tiles on top, and the tuck is floored at **50% of a tile visible**. Past the floor the row keeps the 50% step and SCROLLS sideways - scrollbar hidden, never vertically - scrolled to the end so the newest Trick starts in view. All in `fanTrickTray`'s landscape branch; portrait keeps its own r160 fan.
- **Landscape Knacks drop the marquee for a manual no-scrollbar scroll** (the marquee's duplicated chips would read as owning everything twice under manual scrolling). Portrait keeps the marquee.

### A boss win plays the finale now (r237)

`checkBossObjective` used to call `endBoss(true)` synchronously inside playHand - before the dance drew a frame - so the boss-winning hand never got the goal finale and the screen jumped straight at the prize grid. Now the win only goes **PENDING** (`bossWinPending`); playHand routes the hand through the ordinary goal-dance exit, and the dance calls **`bossSettleWin()`** exactly where it would call `startInterlude` (normal completion, the abort path, and the legacy dance). `endBoss(true, { presented: true })` then skips its own `render()` (the finale already cleared the board - a render would pop every card back for a frame) and its own banner (`flashRoundEnd`'s `goalClearPresent` already carried the boss's name as kicker). Survival's mid-dance pick is suppressed while a boss win is pending - that hand ends in the prize grid.

### The boss-winning hand keeps its bookkeeping (r254)

The r237 rework's early return in `playHand` sat right after `checkBossObjective` - ABOVE Lucky Seven, `highestHandScore`, `recordQuarterBest`, the Full House streak, `checkChallengeAfterHand`, `fireSleightsOnPlay`, `fireAdjacentSleights`, `updateCounters` and `checkUnlocks` - so the boss-winning hand alone skipped all of it. Visibly: the run report's boss quarter printed **no best hand** ("·") however big the killing hand was, and on_play Sleights never fired on it. Pre-r237 all of that ran (`endBoss` was synchronous and `playHand` carried on), so the block simply MOVED DOWN to sit beside the ordinary goal check, below the shared bookkeeping. Verified in a real browser: the VICTORY report now names the boss-killing hand with its score.

Also r254: **an aborted goal dance now fires `flashRoundEnd()`** from `handleDanceAbort`'s goal branch. The banner + cleared-clock state only ever fired from the score climb's goal-cross tick, which an aborted dance never reaches - so a goal hand cut short (round-end teardown, a boss firing mid-dance) won the round with no QUOTA CLEARED and no boss name. Fired BEFORE `bossSettleWin()` so `bossWinPending` still carries the kicker.

**All three end-of-round variants were driven end to end in a real browser for this pass** (Playwright, 1440x820, both Pick states): ordinary goal clear -> finale -> PMF merge/throw/climb -> banner -> fall -> payout -> reward grid -> next deal; boss win -> same finale with the boss-named banner -> payout -> prize grid -> QUARTER CLOSED card -> Q2; final boss -> rolloverQuarter -> VICTORY + run report (no quarter card past Q3, by design). The r234 "fused chip stays put, a copy peels off to the total" behaviour is confirmed live in `pmfFlyToScore`; the persistent `#pmf-merged` element in the DOM after a hand is the REUSED chip without `.show`, not a leak.

## The live shop is the ON-GRID shop (r232) - `js/shop-grid-preview.js`

`USE_MART_SHOP` is **false**: `triggerShop()` now opens `openShopGrid()` - the 4x5 board shop with row plates, the r230 left-column squish and the fall-in deal. Every route the Mart served lands there:

- **`closeShopGrid`'s tail mirrors `closeMart`'s**: node flow -> `resumeAfterNodeFlowShop()`; match-3 -> `match3AfterShop()` (stays paused, that function unpauses itself); Survival from the pick -> restore the pick and STAY paused; Survival mid-round -> `render()` + `startRoundTimer()`.
- **Survival's pick panel sits centred over the board, which IS the shop now.** `openShopGrid` puts it aside with the pick's own `sv-peek` mechanism, and `body.shop-active #sv-peek-restore { display:none }` (css/survival.css) stops the restore button recalling it over the shelves; `closeShopGrid` brings it back and calls `survivalSyncPickAudio`. `survivalOpenShop` also guards on `shopGridActive` so the entry fee cannot be double-charged.
- **The tutorial's five Mart steps are four Shop steps** (board / buying / reroll+sell / leave), gated on `tutShopReady()` - `shopGridActive` AND a `.shop-tile` with a real rect, because the tiles deal in and a zero-size anchor lands the bubble centred with no spotlight.
- **The Mart is DELETED (r278).** `js/mart-shop.js`, `js/wheel.js` and `css/mart.css` are gone (owner's call - the on-grid shop is the shop); the Wheel and the Tinker Bench went with it, and `BAL.wheel`/`tinker_identity` were removed. The `trickSellValue` double-definition wart closed with it: `js/shop-grid-preview.js` (×0.6) is the only definition now.
- **Shop economy (r278):** the multi-buy discount is a flat **3% per extra item** (`BAL.shop_discount`), **5%** with the reworked **Bulk Buyer**; **Haggler** (knack) takes 5% off every buy price via `shopEffPrice` (read live, never applied to sell-backs). **Bought tiles fly to their loadout panel** one after another through the reward grid's own `flyRewardTile`/`rewardTargetKey`; limit payloads carry `flyTo`. State applies BEFORE the flights - presentation only.
- **Early-limit guidance (r278, `js/limits.js`):** until the player takes a Selection Size or grid-size limit - or beats the FIRST boss - the shop's first Upgrades slot IS one of those limits and the Survival/Flow pick forces one option to be it. One shared flag (`earlyLimitDone`, in `SAVE_VARS`), each surface REPLACES a slot of its own rather than adding weight, so the chances cannot stack; the reward grid's first-5-grids guarantee already covers that surface.
- **High Roller** (epic knack, `js/scoring.js`): each scored card replays with (credits + Luck)% chance - floor guaranteed, remainder one deterministic roll per card (`_detReplayRand`, hash offset 3301), never `luckRollDet` (Luck ADDS to the percent here, it does not scale it).
- **Payday cards** (`permCoins`, `js/deck-grid.js`): a card state paying its credits every time the card scores, REPLAY-WEIGHTED (paid in `playHand` off `_handRetrigByCell`). Offered by the Card Market (+2 credits). In `SAVE_VARS` and `migrateCardKeysToIds`; deliberately no tooltip line (owner's call).

## Flow mode (`js/flow-mode.js`, r165) - Survival with no round clock

A variant of Survival. **There is no per-round time limit and no way to fail a round:** clear a goal → pick-of-three → next (bigger) goal, immediately, for as many level-ups as you can string together. Five minutes of live play later the **inspection** arrives - a boss with a real objective *and* a real score quota, on its own 120s clock. `flowActive()` gates everything.

- **It reuses Survival wholesale.** `survivalActive()` is now true for `'survival'` **and** `'flow'`, so the pick-of-three, the reward grants, the on-demand Mart, the post-boss bonus pick, the 5-boss completion screen and endless all come for free. Anything that must differ asks `flowActive()` specifically. **That is the load-bearing decision in this mode** - the diff outside `flow-mode.js` is a dozen one-liners.
- **The session clock IS `roundSeconds`, deliberately.** ~15 sites across the engine measure "how far into the round are we" as `roundStartSeconds - roundSeconds` (The Swift, Sediment, the Cuckoo, the Woodpecker, First Wind, the ♠ exalt window, `handleClockMarks`…). **Pin `roundSeconds` to a constant and every one of those goes silently dead.** Letting the existing clock tick keeps them all working with no per-site changes. Only two things change: what happens at **zero** (the flow branch at the top of `onRoundEnd` fires the boss instead of ending the round), and the fact that a level-up does **not** refill it.
- **`flowNextRoundSeconds()` is why the clock carries.** `triggerLevelUp` resets swaps/discards as usual but routes the clock through it: refill only at run start and after an inspection (`flowRefillClock`), otherwise carry. **`flowInitRun` sets that flag FALSE, not true** - `startGame` already fills the clock itself, so arming it there would hand the run's first goal clear a fresh five minutes on top.
- **The inspection's quota is `score + survivalGoalForLevel(level)`.** `bossGoalMet()` is `score >= roundGoal`, so adding a full level's goal to what you already have makes the bar a clean "earn this much more, inside the window" - no in-progress round is thrown away and no state surgery is needed. The boss window is a flat `FLOW_BOSS_WINDOW`; Flow banks no leftover time, so `survivalAfterLevelUp` pays it **flat coins only** and skips the time bank.
- **`flowTriggerBoss` tears down an in-flight dance first** (`cancelDance`, fold back `heldBackScore`, clear `suppressScoreDisplay`) - the same teardown `_onRoundEndCore` does when any other mode's clock expires mid-animation. `triggerBoss` re-renders the board and returns cards on newly-void cells to the deck, so a dance still running would be operating on a board that moved under it.
- **Max Focus is 20** (`FLOW_FOCUS_CAP`). With no round clock, **Focus decay is the mode's only pressure**, so the bar is short: a ×2.0 ceiling that has to be actively held. It is the **base** cap, not a hard one - `flowFocusCapBase()` adds Focus Cap limit upgrades on top (20 → 21, not a snap to Classic's 30), and Expanse / Power Cell / Stimulants / Life Lessons still stack, so none of those become dead picks. Clamp in `focusCapNodes()` to make it hard.
- **Clock entities are BANNED, not special-cased** (`FLOW_BANNED_ENTITIES`). Two entities assume a round clock Flow doesn't have: **First Wind** ("no Focus decay for the first 45s of a round") measures its grace window against `ROUND_DURATION`, and Flow's clock starts at 300 against a `ROUND_DURATION` of 180 - that elapsed figure is **negative**, so decay would be held off for the first ~165s of every session, switching off the mode's only pressure. **Carry Time** banks the round's unused seconds, and Flow's clock isn't reset by a level-up, so it would pay the same seconds out at every level. Rather than guard each firing site, they are kept out of every offer pool so they can never be owned here - same pattern as `SURVIVAL_BANNED_ENTITIES`. **The firing sites are therefore unguarded**: force one in via the dev panel and the old behaviour comes back.
- **`survivalEntityBanned()` is the single chokepoint** every offer pool routes through, so one test covers both mode's ban lists. Closing it exposed two paths that had never consulted it at all: the **Wheel** (`js/wheel.js`, which draws straight from `TRICK_POOL`/`KNACK_POOL`/`SLEIGHT_POOL`) and the **legacy shop** (`js/shop.js`, the `USE_MART_SHOP=false` fallback). Both now filter - which also fixes a live Survival bug, where the wheel could hand out the reward-grid-only entities Survival's own ban list was supposed to exclude. **A new offer path must call `survivalEntityBanned`** or the bans leak.
- **`timeIsCurrency: false`, enforced.** `spendRoundTime` is a no-op in Flow - its clock is the countdown to the boss, so billing swaps/discards against it would let interacting summon the inspection early. Swaps and discards are still capped by their per-round **counts**. `updateInteractCosts()` quotes 0s to match, and `#stage.flow-mode` hides the `.act-cost` labels hard-coded into the DISCARD/swap buttons in `index.html` (they are never updated by JS - `.survival-mode` deliberately does not get this rule, since Survival still bills its clock).

## Seeded runs (`js/seed.js`, r145)

`applyRunSeed(seed)` **replaces the global `Math.random`** with a mulberry32 stream for the duration of a run. The game makes ~135 bare `Math.random()` calls across 24 files; this seeds every one of them without touching a single call site. Seeds are human-typeable strings, FNV-1a hashed (`LETHE-4F2A`). Called from `startGame` - the single point where a run's randomness is established, before any deck is built. A mode may pin one (`ACTIVE_MODE.seed`; the tutorial does) and the dev panel's **Run Seed** group sets one for the next run.

- **Cosmetic randomness must use `fxRandom()`**, which is always the real unseeded generator. This is not stylistic: a seeded stream only reproduces if draws happen in the same ORDER, and animation code draws on rAF/timer callbacks whose timing depends on frame rate, tab focus and click speed. Leaving those on the seeded stream would shuffle the gameplay draws behind them. Already converted: `score-dance` (particles, noise, tick chance), `audio` (noise buffer), `channel-change` (CRT static), `float-anim` (tile phases). **Any new animation code should call `fxRandom()`.**
### Split streams (r147) - what a seed actually pins

One shared stream pins the OPENING deal (the deck is shuffled right after the seed is installed, before the player can act) but nothing later: every draw comes off one sequence in call order, so a single extra discard shifts everything after it. So each domain now gets **its own generator**, via `withSeededRng(fn, ...key)`:

| domain | key | wrapped at |
|---|---|---|
| deck | `'deck'` (continuing) | `deckShuffle()` in `deck-grid.js`; also the drawPile reshuffles in `events.js` / `shop.js`, and the Famine draw-swap |
| reward grid | `'reward', rewardVisitIndex` | `generateRewardContent()` |
| Mart | `'shop', shopVisitIndex, martRerollN` | `buildMartStock()` |
| legacy shop | `'shop', shopVisitIndex, 0` | `generateShopItems()` |

A key containing a **number is positional**: it builds a fresh generator at that position instead of continuing a cursor. That is what makes "reward grid #3 on seed X" the same grid no matter how the player got there. `deck` is deliberately continuing (a reshuffle must follow from the previous state) but is now isolated, so a Trick proc or boss roll can't perturb the draw order.

Two traps this encodes:
- **`shuffle()` itself is NOT deck-bound.** It's also used to pick Trick options, shop rows and challenge columns; binding it to the deck would let those advance the deck order. Only the real deck operations are wrapped - hence `deckShuffle()` existing alongside it.
- **A Mart reroll must not advance `shopVisitIndex`**, or how many times you rerolled shop #1 would change what shop #2 stocks. The reroll count is part of the key instead.

Anything not wrapped still falls through to the shared global stream, so nothing regressed and unseeded play is untouched.

- **It is still a seed, not a replay.** The pinned domains hold regardless of play, but anything downstream of a player *decision* (which Trick you took, so which Tricks remain in the pool) naturally differs. Enough for sharing a run, reproducing a bug, and pinning a tutorial's opening deal.

## Limits: the printed number IS the effect (r227)

A limit moves by its `step` and then **clamps**, so the step is not the same
thing as the gain. Starting Time steps by 15, and at 295/300 raising it gives 5.
Every screen that moved a limit printed the step and let the clamp quietly take
the difference.

**`js/limits.js` is the one place the printed number is worked out**, and every
screen reads it:

| helper | answers |
|---|---|
| `limitGain(id)` / `limitLoss(id)` | what raising / lowering is REALLY worth right now, 0 at the rail |
| `limitDeltaText(id, dir)` | `+15s` / `-3` |
| `limitChangeText(id, dir)` | `Starting Time: 285s -> 300s` |
| `limitCanIncrement` / `limitCanDecrement` | is there any room left |

**Call `limitGain` / `limitLoss` BEFORE the change** - they read the live
`current`, so a toast built after `incrementLimit` quotes the NEXT upgrade.
Wired: the reward grid's limit tile and its drain debuff, the Limit Break's
offers, its sacrifice list and both of its toasts, all three shop surfaces, the
Survival pick-of-three, and the dev panel.

Two things this pass also fixed:

- **Limits have a FLOOR now** - `min` on `LIMITS_DEF`, honoured by
  `decrementLimit`, which floored at **0** and nothing else. A run could be
  drained to 0 rows, 0 columns and a Selection Size of 0, which is not hard, it
  is broken. Selection 3 · rows/cols 3 · Starting Time 60s · Trick Slots 1 ·
  Focus Cap 10 (one `FOCUS_THRESHOLD`, matching Growth Spurt's floor). Swaps,
  discards and rerolls really can go to nothing and have no `min`. This matters
  much more since the Limit Break's sacrifice became a rolled table that can put
  the same limit in front of you repeatedly.
- **`makeLimitRow(def)` is the ONE builder for a limit's row**, because there are
  TWO places that build it - `js/limits.js` and the reset in `startGame` - and
  they had already drifted once: r211 found that the `startGame` copy never
  carried `step`, so from the first frame of every run a Round Time upgrade
  granted 1 second instead of 15 and nothing read `LIMITS_DEF` again to notice.
  `min` would have gone the same way. **Add a field in `makeLimitRow` and both
  sites get it.**

## Limit Break is two stages (r227) - `js/limit-break.js`

It used to show three offers, a free pick, an optional second pick, and a
sacrifice list of **every** limit, Trick and Knack you owned, all at once and all
undoable until Confirm. Three things were wrong with that:

1. **The mystery was free to read.** Tapping the blind offer revealed it and
   tapping it again put it back, so it was never a gamble - you opened it,
   looked, and picked something else if you did not like it.
2. **The sacrifice was a shopping list.** Everything eligible was on screen, so
   "give something up" meant "find your least useful limit", which on most
   boards costs nothing you care about.
3. **Nothing said the second pick had a price** until you had already taken it.

- **Stage 1 is the free pick and nothing else**, and the button says
  **LOCK IN <name>**. Locking in APPLIES it, and that is where a blind offer
  reveals - once it is too late to change your mind.
- **Stage 2** puts the locked-in pick at the top as a one-line **receipt**, then
  the two you did not take under the heading TAKE ANOTHER AND GIVE SOMETHING UP,
  with three sacrifices beside them. **JUST THE ONE** always walks away.
- **The receipt is a line, not a tile.** Drawn as a full `.lb-offer` it was 150px
  of the panel spent on the one thing already decided, and it pushed both real
  choices and the whole sacrifice row under the sticky footer.
- **Stage 2 lays the offers and the sacrifices SIDE BY SIDE** (`#lb-second-row`),
  because the panel has width to spare and no height to spare. Stacking them is
  what put the third sacrifice off-screen. `#lb-panel.stage2` also drops the
  `RAISE A LIMIT` heading - the marquee bar already says LIMIT BREAK and the
  receipt has just confirmed what was raised.
- **`rollLbSacrifices()` draws THREE, flat.** Flat is the point: a weighted table
  would make the cheap option the likely one. **All three offers are excluded**,
  not just the one taken - the table has to stay fixed while the player chooses
  their second limit, so it must not be able to name something they are about to
  be given. It is rolled ONCE at lock-in and kept; re-rolling it on each change
  of second pick would let the player shop for a cheap price.
- **A blind SECOND pick gets a reveal beat** - the screen strips back to that one
  tile for 1.2s before closing, or the gamble would only ever be named by a toast.
- `lbStage` / `lbSacPool` / `lbRevealing` are declared in `js/reward-grid.js`
  beside the other `lb*` globals and cleared in `closeLimitBreak`.

## Limits tile (▲ Limits, r145)

Fifth button in the play screen's secondary row; opens a `.time-popup` listing every `LIMITS_DEF` entry with current value and ceiling (maxed ones highlighted). Built from `LIMITS_DEF`, so adding a limit needs no UI work. The landscape row divides the same 1.56%→39.3% span into five 6.83% slots.

**Both interaction pop-ups (`#interact-costs`, `#limits-popup`) live OUTSIDE `#cabinet`** - they are `position: fixed` and placed from JS in raw viewport px, and inside the stage the CSS `zoom` multiplied those coordinates. That is what had been putting the ⏱ Time pop-up off the bottom of the screen. Same class of bug as the dev panel; same fix.

## Orientation / tutorial mode (`js/tutorial.js` + `css/tutorial.css`, r146)

A guided first run listed **first** in the mode carousel. `MODES.tutorial` sets `actStructure: true`, so it is an **ordinary Classic run** - real rounds, real payout, real reward grid, real Mart. The board is a normal random deal; the deck is not stacked. Voice is **LETHE Corp staff orientation**: flat, procedural, no mascot. 29 steps, ~3 minutes, abandonable at any point.

- **The `tooltips` step (r183).** Nothing on the board explains itself until you ask it to, and the ask is not guessable, so it gets a step of its own rather than a line buried in another: **press and hold** on touch, **hover** on a mouse, and on the Mart shelves and the reward grid a **single tap opens the tooltip** (the pin / add-to-cart buttons live inside it). Sits between the discard lesson and Records.

- **Polled state machine, not events.** Each step declares `when` (hold it back until true) and `until` (auto-advance when true) as predicates over globals that already exist (`selected`, `handsPlayed`, `goalReachedThisRound`, `rewardSelected`, `martActive`…). One rAF loop evaluates them. **This is why the tutorial needs almost no engine hooks** - outside `js/tutorial.js` the whole footprint is the `MODES` entry, one call at the end of `startGame()`, the auto-submit guard in `input.js`, and one call in `generateRewardContent`. Adding or reordering steps means editing `TUTORIAL_STEPS` and nothing else.
- **One dim, N holes, and gating are the same mechanism.** `#tut-dim` is a single full-screen element whose `clip-path: path(evenodd, …)` cuts a hole per anchor. A clipped-away region is **not hit-testable**, so the holes pass clicks through and the rest of the dim swallows them - `pointer-events` on the dim is the entire gate. That is what lets a step expose exactly three specific reward tiles. `.tut-ring` elements are inert outlines over each hole (a clip-path can't do radius or glow).
- **The layer lives OUTSIDE `#stage`**, same reason as the dev panel and the pop-ups: CSS `zoom`.
- **`tutEl()` tests visibility by RECT ALONE.** The obvious `offsetParent !== null` check is wrong twice here - it is null for any `position: fixed` element (the Limits pop-up, the Mart's panels) and it passes `display: contents` wrappers that have no box (`#score-panel`, `#hand-preview-area`, `#action-col` in landscape). A zero-size rect catches both.
- **No stacked deck - the board is AUDITED and re-dealt instead (r148).** `tutorialQualifyBoard()` checks the opening deal against everything the lesson needs - at least 3 distinct playable hands, at least one 3-card hand, at least one dead card, and at least one adjacent exchange that *creates* a hand - and calls `initGridData()` again if it falls short. Re-dealing runs off the seeded deck stream, so "attempt 3 of seed X" is still the same board every time and the deck stays a real 52-card deck. Measured over 12 seeds: 0 failures, ≤18ms, usually first try.
- **What counts as a "clean" hand, and why the obvious test is wrong.** `findBestHand(cells).handCells.length === cells.length` does NOT mean every card is load-bearing: `detectHand` calls `{5♣ 7♠ 7♥}` a Pair, so the 5♣ sits inside `handCells` contributing nothing to the hand type. `_tutHandIsClean` instead asks whether dropping any ONE card changes what the hand is - `{7♠ 7♥ 5♣}` is still a Pair without the 5♣, so the 5♣ is padding; `{7♠ 7♥ 7♦}` degrades to a Pair whichever card you drop, so all three are load-bearing. Deriving it this way needs no hand-size table to keep in sync. A card whose removal would DISCONNECT the shape is skipped - it is a required connector and its pips still score.
- **Swap and discard are taught hands-on.** The `swap` step highlights an adjacent pair whose exchange creates a hand that isn't on the board (`tutorialFindSwap`, which simulates each pair against live `gridData` and restores it); the `discard` step highlights cards in no hand at all (`tutorialFindDeadCards`). Both are gated and recompute their plan in `onEnter`, because the first hand has already changed the board since the deal-time audit; if the live board offers nothing, the anchor falls back to the whole grid and the step still asks for the action.
- **Only two things are pinned:** the run is seeded (`LETHE-INDUCTION`), and the **first** reward grid is scripted by `tutorialScriptRewardGrid` into a Trick → liability → Mart row at `[0,0] [0,1] [0,2]`. That works with the existing layout rather than against it: the checkerboard already alternates buff/debuff by `(r+c)` parity, so those three cells are exactly buff/debuff/buff. Three gated steps then make the player walk that path, which is how the "you take everything on the path" rule is taught. Later grids generate normally.
- **Timing gotchas the steps encode:** the scoring dance runs ~6s (the step after PLAY waits on `tutIdle()` and stays hidden, so the count-up is undimmed); the payout panel counts up for ~6s (its step waits for `#po-valued.show`, not for the overlay to exist); reward tiles deal in with `rewardDealing` gating clicks; and the Mart's markup **exists while collapsed to zero size** mid-channel-change, so `tutMartReady()` tests with `tutEl`, not `getElementById`. Anchors that vanish for a frame keep their last holes (`_tutLastHoles`) so the bubble can't snap to centre and back.
- **Anti-stall:** a step whose `when` never flips shows anyway after `whenTimeoutMs` (20s), so a stalled predicate can't leave the orientation silently dead.
- `tutorialHoldClock()` only releases a pause **it** took (`_tutClockHeld`), so the reward grid and Mart keep ownership of `gameTimerPaused` during their own steps.

## RECORDS hub (`js/records.js` + `css/records.css`, r155)

The four secondary chips (Stats · Deck · Time · Limits) were **merged into one chip** - `#btn-records` - that opens a large tabbed pop-up and **pauses the round** (`pauseGame(false)`, skipped when `screenOwnsClock()`). Tabs: **Deck · Hands · Personnel File · Limits · Time · Performance**, each one entry in `RECORDS_TABS` (adding a tab is a single line).

- **Hands (r177)** is the rate card - every hand type with its base pips, mult, Focus and their product, greyed when the mode doesn't score it. It reads `HAND_BASE` / `HAND_FOCUS` **live** rather than from a written-out table, and that is the point: both are global and modes overwrite them (`applyModeHandValues()` zeroes Flush of 3 in Spectrum), so the older hardcoded `HAND_FORMULAS` strings in `js/stats.js` state a payout Spectrum does not pay. `activeHands` holds KEYS while the value tables are keyed by NAME, so the reverse of `HAND_KEY_TO_NAME` is what joins them. Lives **outside `#stage`** (body-level) for the usual cabinet-`zoom` reason.

- **Deck tab is a real read-out now.** The old chip list was near-useless; this is a **rank × suit matrix** - every card in the deck coloured by where it is (draw pile / on board / played), dotted when it carries permanent pips or mult - plus summary tiles and a **"still drawable by rank"** bar chart, which is the actual planning question. Sleights are listed separately with charges.
- **Personnel File** shows every owned Trick / Sleight / Knack with its description **expanded by default** (Tricks via `trickLiveDesc`, so scaling values read true), reviewable while the clock is held.
- Three things pointed at the removed buttons and were repointed to `#btn-records`: the card-fall target in `card-fall.js`, `rewardTargetEl('deck')` in `reward-grid.js`, and the tutorial's Limits step (which now opens Records on the Limits tab). `showStats()` / `showDeck()` and the Time/Limits pop-ups are **kept** - the dev panel and Mart still use them.
- Landscape CSS: the `1.56%→39.3%` span is now **2 slots** (Records + Pause) instead of 5.

## Settings (`js/settings.js` + `css/settings.css`, r155)

The player-facing options screen, distinct from the dev panel (which stays the debug surface). Reached from the main menu's SETTINGS button and the pause menu. **Every option is one entry in `SETTINGS_DEF`** - `{ group, id, label, hint, type: 'toggle'|'slider'|'select', default, apply(v) }` - so adding one is a single line. Values persist in `localStorage` (`lethe.settings.v1`) and re-apply on load.

- Audio (mute, master volume) works by `playTone`/`playNoise` multiplying their gain by `sfxVolume()`; motion and display options toggle body classes (`reduced-motion`, `no-shake`, `big-text`, `high-contrast`) that `css/settings.css` acts on.
- **Trap encoded:** `openSettings` must call `settingsOverlay()` (which creates the panel) *before* `renderSettings()`, or the first open renders into a `#settings-body` that does not exist yet.

## Browser storage - `js/storage.js` (r155)

**Loads before every other script, and must stay there.** Some browsers do not return `null` from `localStorage`, they **throw on first access**: Safari private browsing, "block site data" settings, and a **cross-site sandboxed iframe - which is how itch.io embeds an HTML5 game**.

That mattered because ~12 files read storage *at load time, at the top level, outside any try/catch* (`let devMode = localStorage.getItem(...)`). A throw there **aborts the rest of that file**. Measured with storage blocked: 8 files died partway through, `bossInterval` / `BOSS_LOOP_DURATION` / `devMode` were never defined, the menu drew perfectly, and pressing PLAY threw - the game looked healthy right up until it wouldn't start.

The shim swaps in a same-shaped in-memory stand-in when the real thing is unusable, so settings last the session but not beyond it. **Every existing `localStorage` call site works untouched - don't wrap them.** Two traps it encodes: the probe must actually WRITE (Safari private mode *has* a localStorage object and throws on `setItem`), and reading `window.localStorage` is itself guarded because that access is what throws in a blocked iframe. `window.LETHE_STORAGE_OK` reports which mode is live.

## Save & resume - `js/save.js` (r155)

Settings → **Save Run** writes the run to storage; **CONTINUE** on the main menu resumes it. Two decisions shape the whole file:

- **The save point is the START OF A ROUND, not "wherever you are".** `captureRunCheckpoint()` is called from `startRoundTimer()` - the one call site every round start funnels through - and SAVE writes that snapshot out. So the player can save at any moment and what lands on disk is a clean board with a full clock: no half-selected hand, no animation in flight, no scoring dance to resume. **Resuming replays the current round from its start.** Serialising a live mid-round would mean capturing timers, the dance, boss schedules and in-flight fall animations for very little gain.
- **Restore reuses `startGame()` as its baseline.** A run touches ~130 globals; if restore only assigned the manifest, anything missed would keep the value left over from the PREVIOUS run in the tab. Resume calls `startGame()` first (every global to a known-clean run) then lays the snapshot on top - **a variable missing from `SAVE_VARS` costs that one value, not a corrupt hybrid of two runs.**

**Why indirect eval:** the game's globals are top-level `let`, which - unlike `var` - do **NOT** become properties of `window`. `window['score']` is `undefined` even though `score` is a perfectly good global (verified). Indirect eval (`geval`) runs in global scope and sees the global lexical environment, which is what lets one 130-name manifest replace 260 hand-written assignments that would silently rot. `limits` and `C` are `const`, so their **contents** are copied (`SAVE_MUTATE`) rather than reassigned.

Sets get an explicit tag on serialise (JSON turns a Set into `{}`) - they're everywhere here: `activeHands`, `blockedCells`, `grantedSleightIds`, `rewardSelected`. No entity in any pool carries a function, so tricks/knacks/sleights survive the JSON round-trip intact. The **seed is saved and re-pinned** on resume so reward grids and shops keep following the same sequence. A finished run clears its save, but only when the save belongs to the run that ended (matched on `gameStartTime` - a player may have saved run A, started run B and died in B).

**Adding run state?** Add the variable name to `SAVE_VARS` or it won't survive a save.

## Run history - `js/history.js` + `css/history.css` (r159)

A log of FINISHED runs, written once when a run ends and read from the main menu's **HISTORY** button. Deliberately separate from `js/save.js`: a **save** is a resumable snapshot of a run in progress (~130 globals); a **history entry** is a few hundred bytes of "what happened", so `HISTORY_MAX` (100) of them fit where a single save would strain.

- **Two write sites only** - `onGameWin` and `onGameEnd`, the two places a run can finish. A mode that ends some other way records nothing rather than recording something wrong.
- **Double-log guard:** the entry is keyed on `gameStartTime`, and a second end call for the same run is ignored (the end overlay can fire more than once).
- **`score` is the round in progress, `totalScore` is the rounds already banked** - an entry stores the sum, or it would under-report the final round.
- The menu button is **hidden until there is something to show**, so a first-time player isn't offered an empty screen; its label carries the count.
- Body-level, outside `#cabinet`, for the usual `zoom` reason.

## Portrait shared strip - `js/portrait-panel.js` (r156)

Portrait has one narrow strip (`#trick-panel`) for three things that all want room. Landscape anchors each in its own box; portrait can't, so **the Trick tray keeps the left half and is always on screen**, while **Knacks and the hand preview share the right half** - `#panel-swap-btn` (small, top-right) picks between those two (`PORTRAIT_VIEWS`). Tiles and preview cards are drawn at **~70% of the strip's height** (owner's spec) instead of 50%.

**r159 briefly made all three take turns and that was wrong** - it hid the Tricks the player needs at a glance. Tricks that don't fit their half **fan over each other** instead (below).

Before this, **portrait had no hand preview at all**: `syncTrickTrayUI()` sets `#hand-preview-area { display:none }` *inline* whenever Tricks live in the tray (the default), and only landscape overrode it. The scoring dance renders into `#selected-cards` inside that hidden element - so in portrait the **entire dance ran in a 0×0 invisible box** (verified: `.dnc-active` set, children inside, zero size). `flyGridCardToSlot` bails to a plain reveal on a zero-width target, which is why portrait scoring looked like nothing happened.

- **The swap is a class on `#stage`** (`pv-knacks` / `pv-preview`) and the CSS carries `!important` because it must beat that inline `display:none`.
- **Every portrait rule is scoped `#stage:not(.landscape)`.** That's deliberate: the block stops matching the moment `.landscape` is on, so there's no specificity race with the landscape layout. **Follow this pattern for new portrait CSS.**
- **`portraitDanceBegin/End`** (wired into `playPreviewDance` and both its abort and normal-completion paths) auto-swap to the preview for the dance, then restore **whatever was actually showing** (`_pvBeforeDance`), not the last manual pick - a Knack granted just before the hand surfaces Knacks, and bouncing to Tricks afterwards reads as a glitch. An auto-swap still never overwrites `portraitPanelUserView`.
- **`.dnc-track`'s 8px vertical padding is trimmed in portrait.** At 70% card height a 5-card hand's dance stage came within 2px of the strip's edge; trimming the padding keeps the card size and buys the headroom (measured 73px → 58px in a 75px strip).
- **Gaining a Knack flips to Knacks**, hooked on the count inside `updateKnackList()` rather than the many separate grant sites, so a future grant path gets it free. (Tricks needs no such flip - its half is never hidden; `portraitShowTricks()` is kept as a no-op so the grant path doesn't have to know that.) **That call re-enters `updateKnackList`** (to re-measure the marquee), so the tally is updated *before* the flip and `_pvRemeasuring` guards the re-entry - get that order wrong and it recurses forever.
- **`.trick-card` is the GRID tile** (`position:absolute`, `width:var(--card-w,57px)`) and is defined later in the stylesheet than `.trick-tray-chip`, so it won for portrait tray chips: every Trick stacked absolutely at the tray's origin with one grid-sized card hanging outside the panel. Landscape already re-flows them; portrait now has its own smaller version. Rarity colours (`--rc`) were also landscape-only and are now assigned for portrait too.
- Chip rows use `applyChipMarquee`, which measures `clientWidth` - **a row rendered while its half is hidden measures 0 and never gets its auto-scroll**, hence the re-measure on swap.

### The Trick fan (`fanTrickTray`, r160)

The tray is half a narrow strip and its tiles are ~70% of the strip's height, so past three Tricks they cannot sit side by side. Rather than shrink or scroll them, the tiles **tuck over each other like a held hand**: each covers part of the previous, the **newest sits fully visible on the right**, and the rarity edge of every earlier tile still shows.

- **One CSS variable, `--fan-gap`** - the space between tiles, positive when they all fit (an ordinary row) and negative when they tuck. Measured and set in JS.
- **Do NOT write the measured tile width back into a var the tile's own `width` reads.** The first version did (`--fan-tile`) and that is a feedback loop.
- **Measure `offsetWidth`/`clientWidth`, never `getBoundingClientRect()`, for this.** The cabinet applies CSS `zoom`: `getBoundingClientRect()` reports scaled, `offsetWidth` does not, and mixing them silently divides the step by the zoom factor. That bug produced a fan that *looked* fine and was wrong by ~20%.
- **`FAN_MIN_STEP` (13px) floors how far a tile can tuck.** Past that the leftmost tiles clip instead - the row is right-aligned, so the newest Trick always stays whole. At the 10-Trick cap the step lands at ~14px, just inside the floor.
- **A tucked tile shows only its LEFT edge**, and the emoji is centred, so the sliver came out blank - a row of dead dark slices. Fanned tiles move the emoji to the **top-left corner** at 13px, the way a fanned hand shows its corner index, and drop the name (no room).
- **The fan replaces the marquee in portrait, and the two must not both run**: `applyChipMarquee` duplicates the tiles, which the fan would then measure. `renderTrickTray` calls `fanTrickTray` first and only falls back to the marquee when it returns false (landscape, or nothing to measure).
- The **`n/10` count moved onto its own line** (the tray is a column now); it used to be pinned bottom-right, where a full-width fan buried it.

## Score panel & the PMF merge (r157)

**Two separate changes - note which applies where.** The LAYOUT change is **portrait only** (owner's call); the MERGE ANIMATION runs in **both orientations**.

### Portrait score panel layout
`#score-panel-inner` is re-laid as a 2×2 grid: **PIPS·MULT·FOCUS take the left 50% at full height**, and **SCORE sits directly above GOAL** in the right 50%, separated by a **hairline** (`border-top` on `#score-left`) rather than by two panel edges. Score and goal keep their existing type sizes (24px / 18px) - the room comes from the split, not from shrinking them. Scoped `#stage:not(.landscape)` because landscape sets `display:contents !important` on the same element and positions the three children absolutely. **Landscape keeps its original three-box arrangement, verified unchanged to the pixel.**

### The PMF merge - `js/pmf-merge.js`
Once all three chips have landed on their totals they stop being three numbers and become one: the score this hand made. The three chips **jitter**, slide sideways into each other and **fuse into a single chip reading the hand's score**; the main SCORE total then climbs by that amount; then the chip **splits back** into three.

- **Where it sits in the dance:** `playPreviewDance` → card beats → pips/mult reconciled to totals → FOCUS beat → **[MERGE]** → SCORE climb → **[SPLIT]** → settle. It goes *after* the Focus beat deliberately, so the fused number matches what all three chips just showed.
- **It measures, it does not assume.** `--pmf-dx` (how far each chip travels to the row's centre) is computed live per chip, which is why one implementation covers both the landscape row and the portrait half-panel with no per-orientation branch.
- **`--pmf-dur` is set per phase** so the merge keeps pace with a fast-forwarded dance (`dncFF` → 15×) instead of dragging behind it.
- **A pop animation is cleared before merging** - `subbox-pop` is a CSS *animation* and would beat the merge *transition* on the same property.
- **Every abort path calls `pmfResetNow()`** (wired in `handleDanceAbort`). An interrupted hand must never leave the row fused, or the next hand writes its numbers into chips the player cannot see. Verified by chaining hands mid-fuse.
- **`_pmfVisible()` refuses to merge when the chips aren't there** - on grid-takeover screens (Rewards / Shop / Event) `.score-subbox` is `display:none` and `#screen-location` shows instead, so a merge would fuse three invisible boxes.
- **`#score-subboxes` needs to be a containing block** for the fused chip, so it gets `position:relative` - but only where it is static. Landscape positions it absolutely and `relative` would break that, hence the explicit `#stage.landscape #score-subboxes { position:absolute; }` restatement.
- **The legacy `playScoreDance`** (the dev-only `newDance` = off path) is deliberately NOT wired: it runs its focus beat and score ticker on overlapping timers rather than in sequence, so there is no single point where "all three have landed" is true. Every mode that populates these chips uses the preview dance.
- **Match-3 and Dominoes never populate PMF at all** (they call `calcScore` and `updateScoreUI` directly, never `playHand`), so there is nothing to fuse there.
- **The fused chip has NO label (r160).** It used to read `HAND` over the number; the word never fit the chip at either orientation. The number is self-evident in context - it appears exactly where PIPS × MULT × FOCUS just were, and the SCORE total climbs by it next.

## HUD pass (r176)

Started as r160 on a branch off r159. Main reached r175 first and had independently
landed three of the same items - **the swap cap (r169/r170)**, **the PMF chip losing
its `HAND` label (r169)** and **the action-column reorder (r169)** - so on merge those
took main's implementation, not this branch's. What is left below is what only this
pass did, plus the two places the two lines of work actually collide.

### The boss sigil lives in the progress slot, in every mode
There are now **TWO** run-progress blocks in the DOM and both carry **`.rp-block`**: `#run-progress` (the landscape box, top-right) and `#run-progress-pt` (the portrait top-bar copy, new - it replaces the old "Progress / ACT 1 · 0/5" *text* stat). `updateRunProgressUI()` fills every `.rp-block`, so neither orientation needs its own update path, and `css/boss.css`'s sigil rules are scoped to `.rp-block` rather than `#run-progress` for the same reason.

- **The sigil class is applied by `updateRunProgressUI`, not at the boss's call sites.** `render()` → `updateScoreUI()` → there repaints it, which matters precisely because a boss round is when the HUD is being rewritten constantly. `updateActProgressUI()` also calls it, which covers boss start/end, `startGame`, reward-grid advance and save restore in one place.
- **Survival shows it too.** `#stage.survival-mode #run-progress` is still `display:none` (no 3-Act structure to imply) but `…#run-progress.boss-sigil` is not - `.boss-sigil` already collapses the node pips to the single mark, so what shows is a sigil under a **REVIEW** label. Survival runs real bosses; the mark belongs where every other mode puts it.
- **Portrait yields the slot rather than stacking.** `#run-progress-pt` gets `.rp-live` when there is something to say (act mode, or ANY mode's boss round) and `#game-timer-stat` gets `.rp-yielded` (`display:none`) at the same time. Legacy timer modes keep the game timer there.
- **The boss preamble flies out of the sigil and back into it.** `_bossSigilAnchorRect()` finds whichever `.rp-block` the layout is showing; `_bossPreambleFlyTransform()` builds the transform that puts the panel over it. **Both rects are viewport px but the transform is in the element's own CSS px** - `#boss-preamble` is inside `#cabinet`, so the measured delta is divided by the effective zoom, read off the element itself (`rect.width / offsetWidth`) rather than assumed from `--stage-zoom`.
- **The entry is `el.animate()`, the return is the CSS transition - and that asymmetry is load-bearing.** Setting the start transform inline and clearing it one frame later gets coalesced into a single style recalc, so the transition has only one value and the panel just fades in at full size (measured: width never left 407px). Forcing layout does not help - `transform` doesn't affect layout, so `offsetWidth` has nothing to flush. `el.animate()` states both ends explicitly. The return flight is a genuine change on a settled element, so the transition handles it correctly.

### Hand log on the SCORE box - `js/hand-log.js`
Hover (or long-press) the score box for a record of every hand this run: name, the cards that made it, what it scored, round separators, and a footer with the count and the best. The score readout answers *where am I*; it never answered *how did I get here*, and the only record was the payout screen - which arrives after the decision it would have informed.

- **Written in `playHand`, not in the dance.** The dance is a *presentation* of a score already computed and added, and it can be interrupted, fast-forwarded or cut. The hand is a fact the moment `playHand` commits it. The one caller that takes a hand back - the post-goal guard that unwinds a hand submitted after the goal was met - calls `unlogLastHand()`.
- **Match-3 logs its own** from `match3ScoreMatch`, since it never calls `playHand`.
- `handLog` is in `SAVE_VARS`, so it survives save/resume.
- The popup lives **outside `#cabinet`** next to `#interact-costs` / `#limits-popup`, for the usual `zoom` reason, and reuses their `.time-popup` bubble chrome and placement rule.

### Portrait HUD
- The **Hands** counter is gone from the top bar (a statistic, not a live decision input - Records still has it). `updateScoreUI` no longer writes `#hands-display`.
- **Preview cards are sized at run time** by `fitPortraitPreviewCards()` (`js/portrait-panel.js`), not by a fixed `--card-w/--card-h`. Two constraints have to hold at once: a card should fill ~80% of the strip's height, and the whole hand must fit the preview's half of the strip with ~3px clear at each end. A five-card hand at 80% cannot fit side by side, so cards overlap - but **overlap has a floor**: below `minVisibleFrac` (55%) of a card, its centred rank/suit is covered and the readout is worse than the small cards were. So the card is sized *down* from the 80% ideal until the row can hold it at that minimum. One mechanism does both spacings: `step` is the pitch between cards and the margin is `step - w` - positive is a real gap, negative is overlap, published as `--dnc-lap`. Measured: a 4-card hand lands at 54×71 (77% of the strip) with 57% of each card showing.

### Landscape sizing
- **HAND and TRICKS are the same box** (both `21.75%`, was `18%` / `25.5%`) and the tiles match: preview card `42×55` (as wide as five-across affords in that column), Trick chip `40×53` - a hair smaller. The narrower chip also means **six** fit across, where the old 48px capped it at five, below the `trick_slots` max of 10.
- **The action column is SWAP → DISCARD → PLAY.** Swap is 30% taller (`15.28%` → `19.86%`); discard and play absorb the difference in their old ratio, so the column still runs `11.11%` → `97.22%`. In portrait `#action-col` is a real flex column (landscape sets it `display:contents` and places all three absolutely), so `order: -1` on `#swap-indicator` is the whole fix there.
- **The trick TILE shrinks; the trick ICON does not.** The first version of this scaled the emoji down with the tile (24px → 19px) - which is precisely what r172 had just undone in the portrait fan, and for the same reason: a Trick whose glyph changes size stops reading as the same object. The emoji keeps its full 24px and the tile's own `overflow` clips the name, the way a fanned card shows part of a full-size index.
- **The swap cap, the action-column order and the PMF label came from main** (r169/r170), not from here. Don't re-derive them from this section's history.

### Where the two lines of work collide
Both of these are live and neither is visible in a diff - they are two features landing on one element.

- **`#score-center` belongs to the hand log alone (r177).** r172's `bindBossBriefReopen()` originally included it, so during a boss one click both reopened the briefing and toggled the log - and `stopPropagation` does **not** separate those, because they are sibling listeners on one node, not ancestor and descendant. SCORE was dropped from the brief's list rather than the log being suppressed: the brief still has the GOAL chip beside it (same alarm state, same place) and the act/sigil readout, so it lost nothing, while the log is a whole-run reference wanted during a boss as much as outside one.
- **`bindBossBriefReopen()` has to know about `#run-progress-pt`.** Its target list was written when `#game-timer-stat` was the portrait top-left. That element is now `display:none` (`.rp-yielded`) exactly when a boss is running, so without the portrait block in the list, portrait loses the top-bar handle entirely.


## The room and the camera (r180) - `js/camera.js` + `css/room.css`

The game opens on the cabinet **sitting on a desk in an office cubicle**, with the main menu and the mode carousel drawn on its CRT. Start a run and the camera dollies in on the screen until the beige housing is off every edge, so the board has the whole display. Before this the menu was a full-viewport sheet in front of the cabinet, and the zoom fitted the whole housing - the game played inside a permanent beige frame.

- **`--stage-zoom` is now the PLAY zoom and it never changes between framings.** It fits `#stage` to the viewport rather than the cabinet, which is where the extra board area comes from (a 1440x800 desktop went from 1.58 to 1.90, about +20% on every card). The wide framing is a `scale()` on `#camera`, NOT a smaller zoom, so the layout and card metrics are computed once at their final size and the dolly is a pure composited transform with no relayout in it.
- **At the play framing `#camera` carries no transform at all, and that is not an optimisation.** A transform makes its element the containing block for every `position:fixed` descendant, and `#stage` is full of them - the Mart, the pause menu, the shop, the reward grid, the 3-2-1, the end screen. Leaving `scale(1)` on would silently re-anchor all of them. `scale(1)` and no transform paint identically, so `camApply` drops the transform when the dolly lands. What positions the cabinet instead is a **`position:relative` `left`/`top`** on `#cabinet`, which does not re-anchor fixed children.
- **The cabinet is offset so the STAGE centre, not the housing centre, is on the viewport centre.** That is what reduces the wide framing to a plain `scale(k)` about the viewport centre: no translate to keep in step, and one code path covers both orientations. The offset is **measured**, so a CSS change to the marquee or bezel can't drift it.
- **The dolly IN is explicit (`startGame` calls `camEnterGame`); the dolly OUT is driven off the attract screens gaining `.show`.** That covers all ten-odd places that return to the menu without touching any of them, and it is deliberately one-way: SETTINGS / HISTORY / BUILDS all *hide* the main menu to open their own screen, so reacting to the class going away would push the camera in behind them.
- **`measureGridSlot()` now divides out the camera scale as well as the zoom.** A resize while a menu is up measures a board 40% smaller than the one that will be played on.
- **The scene is a one-point perspective built from `--cab-w` / `--cab-h`.** The back wall keeps a constant margin around the housing, the ceiling and side partitions are trapezoids from it out to the canvas corners, and the desk is the same trapezoid run down from the cabinet's base - so portrait and landscape, very different cabinet shapes, both come out framed with no per-orientation geometry.
- **Everything in `#room` is authored in the cabinet's own px on a fixed 3000x2400 canvas.** Never vw/vh in there: the camera scales the scene with a transform and viewport units do not scale with a transform, so the room would slide off the cabinet as it dollies. `ROOM_W`/`ROOM_H` in `js/camera.js` and the canvas size in `css/room.css` are the same two numbers in two places.
- **`CAM_WIDE_FIT` is two numbers, not one.** The fit is against whichever axis binds, and in portrait that is always the width, so a single value would leave the cabinet filling 55% of the width and a quarter of the height.
- **The menu markup moved INSIDE `#cab-screen`, and it had to go BEFORE `#stage`.** The game's `<script>` tags live at the bottom of `#stage` and `bootstrap.js` touches `#main-menu-overlay` as it runs, so the menu has to already be in the document by then. `z-index: 50` puts it over the board and under the bezel's scanline/glare layers (60/61), which are `pointer-events:none` - so it reads as something the machine is displaying.
- **The same parse-order trap bites the camera itself.** While those scripts run the parser has not yet reached `#cab-baseline`, so the cabinet measures 10px short and the board ends up centred 5px high for the whole session. The `requestAnimationFrame` pass can still fire before the parser gets there; `DOMContentLoaded` is the first moment the housing is whole, so `update()` is bound to that and to `load` and `document.fonts.ready`.
- `#menu-left` / `#menu-right` are `display:contents` everywhere except landscape, where they become the branding column and the button column. 747x420 of glass cannot take the portrait stack; portrait is untouched.

## The opening is a PHOTOGRAPH (r244) - `js/office-photo.js` + `css/office-photo.css`

The game opens on a **photo of an office**. There is a computer on the desk and the
menu is drawn ON ITS SCREEN. The camera **drifts in on that monitor by itself over
fifteen seconds** and settles with it centred and filling most of the shot. Touch
**any button** on that menu and a **channel change** flashes; behind the flash the
photograph is gone and the UI is flat and full-screen. The monitor in the photo IS
the machine, so the r180 arcade cabinet - housing, marquee, bezel - is hidden.

### The carousel plays on the monitor; picking a mode DIVES IN (r258)

Owner: *"could we make the select mode screen a little bit smaller on desktop, it's
just all a little too big ... maybe we could just zoom back a little bit so that you
can see the frame of the computer. And then when you select a mode, it zooms in as
the game starts."*

r248's "any button is the cut" put the mode carousel **full-screen at the cabinet
zoom** - about twice the size it is on the glass - which is the whole of the "too
big". The rest framing already shows the monitor's frame, its keyboard and the desk,
so nothing had to be zoomed back: the carousel simply had to stay on the photograph.
The beats are now **drift -> settle -> carousel on the glass -> dive -> cut**.

- **A button SETTLES, it does not cut.** `officeSettleNow()` hurries the drift to
  its end over `OFFICE_SETTLE_MS` (520) so whatever opens is at full size even
  three seconds into a fifteen-second drift. It **carries on from where the drift
  is**, because `camEndBootDolly` writes the final scale with no transition and a
  drift caught at 0.6 of its travel would visibly jump.
- **`camEnterGame` is the only cut**, which it already was as a backstop. So the
  cut happens when a RUN STARTS - including CONTINUE - and never on Settings,
  History, Builds or BACK. Those three are body-level panels over the photo and
  were never on the glass anyway.
- **The dive is what earns the full screen.** `officeCutToScreen` runs
  `camDollyMul` from the rest framing to **k = 1** over `OFFICE_PUSH_MS` (820) and
  fires the channel change on arrival. `officeLayout` picked the photo's scale `S`
  so the glass COVERS the viewport at exactly k = 1, so the flat screen the flash
  reveals is already the size the trapezoid had grown to and the cut is continuous.
  The multiplier that gets there is `1 / camWideK`, its reciprocal.
- **`hold: true` is load-bearing on that dolly.** It leaves `camBootMul` on its
  TARGET instead of resetting to 1; resetting would pull the camera back out one
  frame before the flash. The swap then calls `camEndBootDolly()` and
  `camSetView('play')`, and that pair is behind the collapse.
- **`camDollyMul(from, to, ms, opts)` is now the ONE rAF move** and the drift, the
  settle and the dive all go through it. Under `reduced-motion` it still ARRIVES
  and still calls `onDone` - returning early there, as `camPlayBootDolly` does,
  would leave a run started with the photograph still up.
- **Fixed in passing:** the dolly seeded `camBootMul = CAM_BOOT_OUT` after reading
  `FROM`, so the drift painted one frame at 0.42 of the framing before the first
  rAF corrected it.

#### The carousel has to FIT the screen it is drawn on

`#mode-select-overlay` is centred with `overflow: hidden`, so content taller than
the box is clipped **equally at both ends**. Measured at **473px of content in a
420px stage**: 26px off the SELECT MODE title and 26px off the PLAY buttons. That
was invisible full-screen after a channel change and is the first thing you see on
the monitor.

- **The cards take the LEFTOVER room now** rather than asking for a fixed 300px
  (`.mode-card` `min-height: 300px` -> `0`). **Every ancestor of the flexible child
  needs `min-height: 0`** or a flex item refuses to shrink below its content:
  `#mode-select-inner`, `#mode-carousel-wrap` and `#mode-carousel` all carry it.
- **The blurb is the flexible part** and scrolls, with a bottom mask fade - a line
  cut flat by the box reads as a rendering fault. The fade is always on and costs
  nothing when the text does not reach the bottom.
- Verified `scrollHeight === clientHeight === 420` at 1440x820, 1100x620 and
  390x844, with the title and both PLAY buttons fully on screen.

### The monitor is LANDSCAPE, so the machine shows a landscape face (r257)

The skew maps **`#stage`'s whole box** onto the glass quad, so the stage's aspect and
the quad's aspect have to be near each other or the UI is stretched. Landscape is
747x420 (**1.78**) against a quad of **1.37**, which is the foreshortening of a
screen seen at an angle and reads as perspective. **Portrait is 420x740 (0.57)** -
a **2.4x horizontal crush**, and on a phone it made the menu unreadable.

So while the photograph is on screen the stage is **forced landscape**, whatever the
device is doing: `officeForcesLandscape()` is read by the one place that decides it
(`bootstrap.js`'s `update`). It is only ever a lie for as long as the photo is up.

- **`applyStageLayout` is bootstrap's own `update`, exposed.** Two paths need to
  re-decide the orientation and neither can use `camRelayout()`, which re-uses
  `camLastLandscape` - still the forced value: the channel change, which hands a
  phone back its portrait layout **behind the flash**, and the photo's own `load`
  handler, because bootstrap's first pass ran long before an image could download
  and the stage is still portrait at that point.
- **`OFFICE_HERO_FIT` is two numbers now.** In portrait the binding axis is the
  WIDTH, and a landscape monitor held to 0.78 of a phone's width is a small band in
  the middle of a very tall picture: `{ landscape: 0.78, portrait: 0.92 }`.
- **The photo crop needed nothing.** The cover framing is already centred on the
  monitor and cropped to the viewport's aspect, so a phone was already getting its
  own portrait slice of the office - the owner's "middle three columns". The squish
  was never the crop.

Verified at 390x844: forced landscape while the photo is up, glass 359x262 (was
304x222), and after a button press `landscape` is false, the stage is 420x740
painting at 386x680 in the viewport, the camera carries no transform, the skew is
cleared and there are no page errors. Desktop at 1440x820 is unchanged.

### The opening is a DRIFT and then a CUT (r248)

There is no push on PLAY. **The drift IS the approach and the flash IS the arrival**,
which is why the whole choreography is two numbers: `OFFICE_ATTRACT_MS` (15s) and
`OFFICE_HERO_FIT` (0.78, the share of the viewport the glass fills at rest).

- **r248 cut on ANY button. r258 does not - see the section above.** A button now
  only SETTLES the drift; the cut belongs to starting a run. `officeArmMenuCut` is
  `officeArmMenuSettle`, still one delegated CAPTURE-phase listener per attract
  screen that **does not stop the event**: the button's own handler runs as it
  always did.
- **It never pulls back out.** `officeDone` latches at the cut and
  `officeReturnToMenu` answers **`'stay'`** from then on, which camera.js reads as
  "leave the camera alone" - so a run that ends comes back to a flat full-screen
  menu rather than shrinking onto a desk. The opening plays once a session.
- **`.office-photo` deliberately STAYS ON after the cut**; only `.office-scene` goes.
  See the two-classes note below - putting the bezel back would shift the board off
  centre with nothing left to re-measure it.
- **The drift is r185's `camBootMul` multiplier**, not a third framing, for r185's
  reason: the first seconds of a load trigger several relayouts and a transition
  would be stamped on by the first of them. `camPlayBootDolly(fromMul, ms)` takes
  both now, and eases **squared rather than cubic** - over fifteen seconds a cubic
  spends most of the shot already stopped.
- **`camSetView` only cancels the creep when the view is REALLY changing.** The
  attract screens re-assert `'wide'` as they open, and cancelling on those snapped
  the whole fifteen-second drift to its end the moment the mode carousel appeared.
- **Start the drift AFTER `camRelayout`, not before.** `officeWideK` and
  `officeHeroK` are both 1 until the layout has measured the viewport, and the drift
  is the ratio between them - started above it that ratio is 1, the "nothing to
  travel" guard reads it as a shot with no move in it, and the opening silently does
  not happen. Measured: 0.39 -> 0.53 -> 0.61 over the fifteen seconds at 1440x820.

**The only thing you supply is the four corners of the monitor's GLASS, in the
image's own pixels** (`OFFICE_PHOTO.screen`, TL/TR/BR/BL). A screen in a photograph
is a **trapezoid**, so it takes four points and not a box. **`office-calibrate.html`**
is where they come from: click the corners, drag them until the test card sits flush,
paste the block it dumps. That page loads the real `js/office-photo.js`, so the
mapping tuned there is the arithmetic the game runs - keep it that way.

**Calibrating is a ZOOM job, not an eyeball job.** The shipped corners were read off
the monitor at 9x with a labelled pixel grid, one corner at a time; at 3x the bottom
edge came out **21px high**, which is invisible on the source image and shows as a
band of unpainted glass under the menu. Auto-detection was tried twice and is not
worth repeating: the office is unlit, so the wall beyond the monitor is as dark as
the screen and an inward scan stops on the wall, while the photo's own chromatic
fringing seeds an outward one all over the picture.

`screen: null` means photo mode never turns on and the CSS room
runs exactly as it did, so a missing file, a 404 or an uncalibrated quad cannot
break the opening. **`assets/room/_test-office.svg`** is a synthetic office with its
glass at `[[760,430],[1240,470],[1230,790],[770,745]]`; point `file` and `screen` at
those two and the whole opening runs with no photograph in the repo.

**The monitor in the photo may keep whatever is on its screen.** `#stage` paints an
opaque background over the whole quad, so a mock-up baked into the glass is covered
rather than showing through - verified against a photo that has the menu painted on
it. What it must NOT have is anything on the screen you want to still see.

### The four things this encodes

- **The camera scale at the END of the push is 1, and that is not a coincidence.**
  The photo's own scale `S` is picked so the monitor's glass COVERS the viewport at
  k = 1, so the flat screen the channel change reveals is already the size the
  trapezoid had grown to and the cut is continuous. It also means **the zoom factor
  IS how small the monitor is in the frame** - a shot where the monitor is half the
  picture has almost no push in it, and the calibration page says so in as many words.
- **THE SKEW CORRUPTS `measureGridSlot()`, and that one is not cosmetic (r248).**
  It divided the slot's rect by the zoom and the camera scale, which is only right
  while every transform above it is a plain scale. The skew is a PERSPECTIVE map, so
  the rect is the TRAPEZOID'S BOUNDING BOX and no single divisor undoes it: measured
  at 1440x820 the slot read **338 x 462 against a real box of 336 x 362**, a 28%
  over-read on the height, and the grid came out **421px tall inside a 420px stage** -
  the dark shape that pokes out above and below the monitor, and every card sized
  off a distorted measurement. It measures `offsetWidth`/`offsetHeight` now, which
  ARE design px and are immune to every transform above them, so the zoom and the
  camera scale do not come into it at all. **Same trap as the r160 Trick fan: never
  mix the two.** Verified behaviour-neutral outside photo mode - 336/362 either way
  at 1440x820, 298/444 at 420x820, identical card sizes.
- **THE WIDE FRAMING IS MEASURED FROM THE MONITOR, NOT FROM THE IMAGE'S SIZE.** The
  zoom holds the monitor on the viewport centre, and a monitor is never in the middle
  of the shot, so each of the four margins from the monitor to an edge of the photo
  has to reach half the viewport ON ITS OWN and the smallest one decides. The shipped
  photo has its monitor 71% across, and the naive whole-image cover figure left 306px
  of bare background down the right-hand side of the menu.
- **The attract screens have to be re-inset to 0.** `#main-menu-overlay` is
  `inset: 12px`, and `inset` resolves against its positioned ancestor's PADDING box -
  so with `#cab-screen`'s own 12px bezel it landed exactly on `#stage`, and with the
  bezel zeroed for photo mode it lands 12px INSIDE `#stage`. That ring is live board:
  the HUD elements are laid out from the first frame whether or not a run has started,
  so the menu sat in a frame of cyan SWAP, red DISCARD and yellow PLAY down the side
  of the monitor. Measured: menu 418x278 inside a 432x296 stage, against 666x374 on
  666x374 in the r180 cabinet.
- **The photo is placed so the MONITOR'S centre is on the viewport centre**, which is
  what reduces "fly into the screen" to `scale(k)` about the viewport centre - the
  same trick `camPlaceScene` plays with the stage. No translate to keep in step, one
  code path for both orientations.
- **THE SKEW IS ON `#cab-screen`. Not `#cabinet`, not `#stage`.** `js/channel-change.js`
  writes `#cabinet.style.transform` directly during the flash; on `#cabinet` it would
  stomp the skew and the screen would snap flat a beat BEFORE the collapse hid it. On
  `#cab-screen` the channel change's squeeze composes on top instead. `#stage` is out
  because it carries `zoom`.
- **TWO body classes, and collapsing them is a bug.** `.office-photo` means THE
  CABINET IS REPLACED - a layout fact that must hold for the whole session, because
  the cabinet's resting offset was measured against it. `.office-scene` is the much
  smaller question of whether the photograph is on screen, and that is what the swap
  turns off. Putting the bezel back at the channel change would shift the board 12px
  off centre with nothing left to re-measure it.

### Two bugs found by rendering it, both invisible to a syntax check

- **`#cabinet` carries `zoom: var(--stage-zoom)`** (`#stage` is pinned to `zoom: 1
  !important`), so `#cab-screen`'s OWN coordinate system is ~1.9x smaller than the
  pixels it paints into: its rect reads 1436x807 while its box is 747x420. **A
  transform is applied in the element's own units**, so a matrix built from
  `getBoundingClientRect` is off by the zoom - and because the horizontal translation
  is near zero, it comes out as a screen that is exactly the right size and sitting
  25px above the monitor. `officeApplySkew` divides by `rect.width / offsetWidth`.
  **This is the r160 Trick-fan trap again: never mix the two.**
- **`transform-style` must stay FLAT.** The skew is a 2D projective map expressed as
  `matrix3d`, and flat is what it wants - the element renders normally and the whole
  flattened result is projected onto the trapezoid. Under `preserve-3d` the
  descendants join the parent's 3D space and each gets projected on its own, and the
  element's bounding box then reports a position the matrix provably does not produce.

**The attract screen is held up for the length of the push** (`officeEntering` latches
camera.js's "a menu appeared, pull out to it" observer off, or it would fight its own
dolly). By that point `startGame` has already dealt the board behind it, and arriving
at a board you were already looking at is not a transition.

**Verified in a real browser at 1440x820**: the glass's bounding box and the monitor
quad agree to the pixel at the menu; the push reaches k = 1; at play the camera
carries **no transform at all** and `#stage` is 1436x807 on a 1440x820 viewport with
16 cards dealt.

### Music: a track can speed up as it plays (r244)

`ramp` on a manifest row in `js/data/audio-manifest.js`. Bare `ramp: true` is **every
20s, +10%, capped at 2x**; an object says something else. Two rules in `js/music.js`:

- **It advances on WALL CLOCK while the track is playing, never on `el.currentTime`.**
  currentTime runs at the playback rate, so keying off it would make each step arrive
  sooner than the last on top of the compounding, and the ramp would run away.
- **It RESETS on every track load**, because the ramp belongs to a play of a track and
  not to the session.

The cap is not decoration: +10% every 20s reaches 2x in two minutes and 4x in four.
`pitchUp: false` (the default) is tempo only - the browser time-stretches and the key
is held; `pitchUp: true` is a tape speed-up with the pitch rising. `musicSetRamp({...})`
overrides whatever is playing, for tuning from the console.

### Two offices, and the intro replay (r181)

**Settings > Display > Office** picks between **Grimy** (the default) and **Clean**. Grimy is the same room left running for years: dimmer, yellower, damp wicking up the partition corners, a stopped clock, a dead plant, faded notes, coffee rings, and a fluorescent tube that stutters on an irregular loop.

- **It is a `.grimy` class on `#room`, written entirely as overrides on the clean room**, so the two share one geometry - a change to the perspective or the props lands in both without being written twice. `camSetRoomStyle()` is the single site that sets it.
- **One `filter` on `#room` does the mood** (`saturate .62 brightness .8 contrast 1.05 sepia .13`) rather than a second palette. Safe there because `#room` holds no `position:fixed` descendants; it is absolutes all the way down.
- **Every grime layer is `mix-blend-mode: multiply`, and that is not a style choice.** Painted normally, a translucent brown over an already-dimmed room comes out LIGHTER than the thing it is meant to be dirtying: the first pass had coffee rings glowing on the desk like chalk (measured: ring 50,42,32 against a desk of 80,71,59 only after the switch to multiply). Dirt can only darken.
- **The paper and the mug needed explicit dulling.** They are the only white objects in the room, so under the dim filter they became the brightest thing in frame after the CRT.
- **Damp is anchored to the wall's bottom corners and fades up and inward.** A centred ellipse reads as a blob stuck on the wall rather than as something rising out of the floor.
- The cabinet itself is deliberately left pristine - it is the one thing in the room still working, and dimming it would also dim the screen the game is played on.
- **`camPlayIntro()`** (Settings > Display > Intro animation) replays the opening move. From the menu it pulls back, pushes in and returns to the menu; from inside a run it pulls out to the desk and comes back, so the run is exactly where it was when it finishes.

### The opening shot (r185)

The page loads with the camera further back than the wide framing and creeps in on the machine over **seven seconds** while the menu waits on the CRT (`camPlayBootDolly`, fired from `camInit` only when the menu is the thing showing).

- **It is a MULTIPLIER on the current framing (`camBootMul`), not a third framing.** The first second of a load triggers several relayouts on purpose - the rAF pass, `DOMContentLoaded`, `load`, `document.fonts.ready`, all wired in `js/bootstrap.js` - and each one runs `camLayout` -> `camApply(false)`. A CSS transition would be stamped on by the first of them; a multiplier folded into `camApply`'s `k` composes with a recomputed `camWideK` instead, so the creep survives them.
- **Driven by rAF, so `camApply`'s reflow flush is skipped while it runs.** That flush exists so a *later* transition starts from the current value; during the creep there is no transition, the next frame simply writes the next scale, so forcing a reflow 420 times would be pure cost.
- **Any view change cancels it** (`camSetView` calls `camEndBootDolly` first). Pressing PLAY three seconds in must dolly to play from where the camera actually is, not from 0.42x the wide framing.
## Audio: files, packs, and the classic set (r186) - `assets/`, `js/data/audio-manifest.js`, `js/audio-packs.js`

Every sound resolves through **one wrapper**, in this order, stopping at the first hit:

1. switched off in Settings -> Sound effects -> silence
2. **sound files are ON and a decoded file exists** -> play the file
3. a **sound pack** is selected and covers this id -> play the pack's version
4. otherwise -> the **classic** coded sound

Classic is the floor that always answers, so a file that 404s falls back to the pack and a pack that omits an id falls back to classic. Nothing ever goes silent by accident. `sfxSourceFor(id)` reports which of the four is live, and the sound board badges every row with it.

- **`js/data/audio-manifest.js` is the only file to edit** to add content: a `music` list and an `sfx` map of id -> path. Pure data.
- **The override works by REPLACING the global function**, not by editing ~200 call sites. Top-level `function sfxCoin()` becomes a property of `window` (top-level `let`/`const` do **not** - the same fact `js/save.js` leans on), so `installSfxOverrides()` in `js/audio-assets.js` wraps every entry in `SFX_CATALOG` and each bare `sfxCoin()` resolves through the wrapper. The original is kept on `fn._coded`.
  **`js/audio-assets.js` must load after every file that DEFINES an sfx** (audio.js, hud.js, match3.js, score-dance.js) and after `settings.js`. **`js/audio-packs.js` must load BEFORE `settings.js`**, because `SETTINGS_DEF` reads `SFX_PACK_LIST` at load time to build the pack picker's options.
- **Samples are Web Audio, music is an `<audio>` element** (`js/music.js`): `decodeAudioData` holds the whole file as PCM (~40 MB for a four-minute MP3), right for a 200 ms effect and wrong for a track. The cost is that music is not ducked by the heartbeat; its own slider covers that.
- **Autoplay:** `armMusicAutostart()` waits for the first click/key, and that gesture also unlocks the AudioContext and prewarms every listed sample.
- **A track's `off: true`** is a DEFAULT, not a state - `musicTrackOn` prefers a stored choice and only falls back to it. That is what lets twelve ambience beds ship without the playlist opening as a wall of noise.
- **Three volumes.** `sfxVolume()` is master x effects, `musicVolume()` is master x music, both folding in `muted`. Every `playTone`/`playNoise`/sample/pack voice multiplies by `sfxVolume()`, so it is the single choke point. **`sfxWinExplode` builds its own gain node** rather than going through `playTone`, so it has to fold that in by hand - it did not until r179, and mute never silenced the goal blast.

### The mixer (r191) - `js/audio-mixer.js`

Before this every sound connected straight to the output at whatever gain its own
designer picked, so a Focus node detaching was as loud as a hand scoring. The fix
is the standard game-audio answer, which is **three separate mechanisms** people
often lump together as "priority":

1. **Buses + static trim.** Sounds are grouped by what they MEAN, not by what
   makes them, and each group has one fader. This is most of the fix - a
   background tick should simply always be quieter than a headline.
2. **Ducking.** When something important starts, every bus below it dips for as
   long as it lasts, then comes back.
3. **Voice limits.** A cap per bus, plus a minimum gap between repeats of one
   sound, so a fast loop cannot turn into a buzzsaw.

**The split is the point.** Doing it all with ducking gives a mix that pumps;
doing it all with static gains gives a mix where the big moments never get room.

| bus | pri | trim | ducks to | what |
|---|---|---|---|---|
| `detail` | 1 | 0.55 | 0.30 | score ticks, Focus node pops and drops |
| `board` | 2 | 0.80 | 0.45 | card select/pop, riffle, reward pick |
| `score` | 3 | 1.00 | 0.55 | the scoring dance: particles, Focus beat, hand scored |
| `event` | 3 | 0.95 | 0.55 | coins, shop, rewards, round start, countdown |
| `headline` | 4 | 1.00 | never | goal blast, victory, level up, multi-goal |
| `alert` | 5 | 1.00 | never | the boss-approach heartbeat |

- **`sfxOut(ctx)` is the seam.** Every voice in the game connects there instead of
  to the destination - `playTone`, `playNoise`, `_packOut`, `bitTone`, `bitNoise`,
  sample playback, and the two hand-built sounds (`sfxWinExplode`, `sfxRewind`).
- **How a voice knows its bus:** the wrapper in `js/audio-assets.js` sets
  `_mixCurrentId` around the call (`sfxWithMixId`), and `sfxOut` reads it. This
  works because a sound's voices are all scheduled **synchronously** inside that
  call, even the ones carrying a `delay`. A `setTimeout` that calls another sfx
  goes through the wrapper again and gets its own id, so that is fine too.
- **The per-sound trim is folded into `sfxVolume()`**, which is why one table
  reaches every voice without touching any of them. `musicVolume()` deliberately
  does not get it.
- **`duckHold` and `voiceHold` are different numbers and sharing one is a bug.** A
  headline should keep the mix out of its way for most of a second but must not
  occupy a voice slot that long. The first version shared them, and the `alert`
  bus (cap 2, hold 0.5s) then dropped heartbeats at exactly the point the boss
  approach accelerates to one every 420ms.
- **An already-ducked bus is EXTENDED, not re-ramped.** Cancelling and ramping
  from the top again is what makes a mix pump audibly under a burst of beats.
- **A refused voice never reaches the graph** - `sfxMixAllow` runs before anything
  is built, so a dropped sound costs nothing. Limits are deliberately generous:
  silence where the player expects a sound is a worse bug than a busy mix. The
  sound board calls `sfxMixResetLimits()` first, so auditioning a row twice in a
  second is never refused.
- **Real particle spacing is 90-120ms** (`PIP_STAGGER`/`MULT_STAGGER`/
  `TRICK_STAGGER` in `js/score-dance.js`), so the 22ms gap never bites in normal
  play. Under the 15x fast-forward of an interrupted hand it drops most of them,
  which is the intent - that is the buzzsaw case.
- **Measured:** the detail bus sits at 30% of its resting level while a pip
  particle or a scored hand plays, and is back to 100% within 900ms. Solo levels
  put `focus_pop` at rms 0.0009 against `hand_scored` at 0.024, about 25x quieter
  before ducking does anything.

**`sfxHeartbeat` used to connect straight to the destination** so it would stay
loud while the others ducked - which also meant it ignored `sfxVolume()`, so mute
never silenced it (the same bug `sfxWinExplode` had). It rides the `alert` bus
now, whose `duckTo` is 1: nothing ducks it, and the sliders reach it.

### The discard sound (r205)

There was no discard sound at all: discarding reused **`sfxFlipShuffle`**, the riffle that also plays when a hand flies to the preview, so binning cards and scoring them opened the same way. `sfxCardDiscard(loud)` is a dry downward sweep - a card thrown onto a pile, not shuffled into one.

- **One function, two catalog rows.** `card_discard` and `card_discard_forced` share `fn: 'sfxCardDiscard'` and the wrapper picks the row whose `args[0]` matches the call (the same mechanism as the pip/mult particle pair), so `sfxCardDiscard()` and `sfxCardDiscard(true)` are separately switchable, mixable and auditionable.
- **The loud one is The Marker's forced discard** - a marked card eating the hand you just played. That is not something you did, so it has to announce itself: 1.7x gain and a touch lower in the sound itself, and it rides the **`event`** bus rather than `board`, so it also ducks the board under it. Measured peaks: 0.062 normal, 0.153 forced.
- **All three packs cover it (r211).** 1-bit does the louder version as a WIDER duty and an extra stroke rather than a fade, because a single output line has no envelope to fade with; slot swaps the short LFSR for the long one, a tear instead of a click. Measured peaks, none clipping: onebit 0.08 / 0.16, slot 0.07 / 0.24.

### Two sounds per particle (r191)

Each pip/mult particle is **a short tick and then a pitched body**, `PARTICLE_GAP`
(45ms) apart - "t-ding", not "ding". Two transients that close together read as
one event *with a shape*, which is what makes a long run of them sound like a
counter ratcheting rather than a row of identical bleeps. The old version layered
its overtone **simultaneously**, which just made one thicker bleep.

Below ~25ms the two fuse into a click; above ~90ms they separate into two events.
All three packs do it in their own vocabulary: classic uses a square tick into a
triangle body, 1-bit a thin high pulse into a wide one (on one output line the gap
is the only way to give a repeated event any shape), and slot a short-LFSR click
into the coin - the detent and the digit of a counter wheel.

### The packs - `js/audio-packs.js`

`SFX_PACKS` is keyed by catalog id; a pack need not cover every id. The shared toolkit is `pulseWave`, `lfsrNoiseBuffer`, `crusherNode`, plus per-pack voices.

- **`pulseWave(duty)`** builds a PeriodicWave from the Fourier series of a pulse: the nth harmonic of a duty-d pulse has amplitude `(2/(n*pi)) * sin(n*pi*d)`. 28 harmonics; past that it is CPU for nothing. Cached per duty **and per context** - a PeriodicWave belongs to the context that made it.
- **`lfsrNoiseBuffer(mode)`** is the NES noise channel: a 15-bit shift register, feedback `bit0 XOR bit1` ("long", 32767 steps, a hiss) or `bit0 XOR bit6` ("short", 93 steps, a metallic ring). **The short register is the single biggest reason the slot pack sounds like a machine rather than like static.** One second is generated per mode and PITCHED with `playbackRate`, which is how the real chip varies it too.
- **`crusherNode(bits)`** is a WaveShaper with a staircase curve - quantisation is most of what "8-bit" means, and a WaveShaper needs no AudioWorklet, which matters for a statically-hosted game.

**ONE-BIT is a constraint, not a filter.** A single output line is ON or OFF, so: **no volume envelope** (the hard gate in `bitTone` - `setValueAtTime` only, never a ramp - is the whole sound, and fading anything instantly stops it reading as 1-bit); timbre comes from **pulse width alone**; pitch slides are **stepped**, because the routine recomputes a period per iteration; noise is a square whose period is re-randomised every few ms (`bitNoise`); and chords are faked by **interleaving** pulses fast enough that the ear fuses them (`bitChord`). The per-sound `gain` values are a mixing concession - a real beeper has one loudness - but the envelope stays binary. Suits are four **duty cycles** rather than four pitches: on one line the timbre is the identifier.

**SLOT** is NES APU vocabulary aimed at a casino cabinet: pulses at 12.5/25/50% duty for anything melodic, triangle for bass, short-mode LFSR for reel clicks and coin edges, instant-attack linear-decay envelopes (the APU's 4-bit envelope). The anatomy the sounds follow: a firm mechanical click to commit, a whirr made of accelerating ticks, reels landing **one at a time** with the gap doing the tension (`reelStop`), a dry near-miss for a loss, bright chimes for a small win, and `coinCascade` for a big one.

**Levels are matched by measurement, not by ear.** Rendering all 32 sounds of each pack through an OfflineAudioContext: median peak classic 0.13, onebit 0.12, slot 0.17. That sweep is also what caught classic's `win_explode` peaking at **1.18** - it clipped - now 0.55 gain and 0.88 peak.

- **`_particleStep` is shared.** It is a top-level `let` in `js/audio.js`, so the packs increment the same counter and `resetParticleStep()` keeps working across all three.
- **Adding a sound**: one row in `SFX_CATALOG`, then optionally an entry in each pack. Two rows may share a `fn` (the pip/mult particle pair) - the wrapper picks the row whose `args[0]` matches the call.
- **Testing**: render each id into an `OfflineAudioContext` with `getAudioCtx` temporarily repointed at it, and assert a non-zero peak. A silent sound is the failure mode a pack has, and it is invisible otherwise.
- **Headless Chromium cannot decode MP3** (no proprietary codecs), so file-backed sounds cannot be verified in this environment - only in a real browser. The fallback chain is what makes that safe.

## Dev panel / Settings
`#dev-panel` is **both** the in-game dev panel (🛠 button) and the main menu's **Settings** screen (`openSettingsFromMenu`); the title bar swaps between `DEV MODE` and `SETTINGS`. As of **r117** it's a centred, bounded arcade pop-up (`css/dev-overlays.css`) rather than a full-screen sheet: sticky gold title bar, internally-scrolling `#dev-panel-body`, and a backdrop dim made by a `0 0 0 100vmax` box-shadow spread so no extra wrapper element is needed. **It lives OUTSIDE `#stage` in `index.html`** (a sibling of `#main-menu-overlay`) - inside the stage it inherited the cabinet's CSS `zoom`, which scaled its `vh` sizing by ~1.3× and pushed it off-screen.

**As of r139 it opens on a MENU OF GROUPS, not one long scroll.** `#dev-group-menu` tiles 14 groups (Tricks · Sleights · Knacks · Limits · Events · Bosses · Animation · Focus · Time · Coins · Score · HUD · Match-3 · Event Log); picking one opens `#dev-group-pop` showing only the `.dev-section`s whose `data-group` matches. **The sections are never moved or rebuilt** - every id survives, because a lot of code binds to them (`dev-trick-list`, `dev-focus-decay-slider`, …); `devOpenGroup` only toggles `display`. To add a group: give your `.dev-section` a `data-group`, add a row to `DEV_GROUPS`.

Boss and Event buttons are **generated** from `BOSS_PRESETS` / `EVENT_META` (`devRenderBosses` / `devRenderEvents`) rather than hand-written, so new content can't go missing - this is how `the_hollow` was found to have been absent.

🛠 button (bottom-right). Add Tricks / knacks / sleights by name, trigger any event/boss, adjust time/coins/score/limits, open reward grid. HUD section also has scoring-dance toggles (new dance on/off, interrupt mode). **Animation** group has the item-float, heartbeat and channel-change tuners. Invaluable for testing.

## Rarity: four tiers, three ladders (r197)

Tier ids are `common` `rare` `epic` `legendary` and are **frozen** - saves, CSS
classes (`rar-epic`, `sl-rar-epic`, `trick-tier-epic`) and all three data pools
key off them. What the player reads is a lookup in **`js/labels.js`**, which is
the only file that spells a tier word out.

| id | colour | Utility (trick) | Vendor (sleight) | Cert (knack) |
|---|---|---|---|---|
| `common` | mint | Lite | Trial | Common |
| `rare` | cyan | Standard | Contract | Rare |
| `epic` | purple | Plus | Retainer | *unused* |
| `legendary` | magenta | Deluxe | Partner | *unused* |

- **`mythic` was merged into `legendary`.** Five tiers meant the top two were one
  tier wearing two hats: 12 of 177 Tricks and 4 of 40 Sleights across both, at 2%
  and 1% drop weights, so a Classic run's ~18 Sleight offers expected 0.36
  Legendaries and 0.18 Mythics and most runs met neither. **`mythic` is not a
  valid id.** `TIER_ALIASES` in labels.js maps it onto `legendary` so an old save
  or a stale data entry resolves instead of blanking a tile.
- **The top tier took magenta, not yellow**, and inherited the old mythic pulse -
  it is the loudest tier now, and there is no fifth colour to spend.
- **Knacks use two tiers deliberately** (the pool is 24 common / 24 rare). The
  labels table maps `epic`/`legendary` onto Rare so a stray entry still renders.
- **Never print a tier id.** `tier.toUpperCase()` is how the vocabulary got
  hard-coded into eight screens; all of them now call `tierLabel(type, id)` /
  `tierInitial(type, id)`. A new site that upper-cases an id silently opts out of
  every future rename.
- **Sleights are VENDORS, not Hires (r200).** Not one of the 43 Sleight names is
  a person's - Warehouse, Lighthouse, Whetstone, Flywheel, Piggy Bank, Petty
  Cash - and every one reads as a small company. The object is a business card
  from your rolodex, never an ID badge with a face.
- **The Vendor ladder is a DURATION ladder, not a power ladder** - Trial expires,
  Contract has N jobs (this is the existing `durability` / `_usesLeft`), Retainer
  is permanent, Partner is permanent and scales. Do not drop the Contract rung;
  it is the one the charge system was already built for.
- **A tier array and its weight array must move together.** `martRollTier()`
  walks `MART_TIERS` by index; leaving its weights one entry longer made it
  return `MART_TIERS[4]` (`undefined`) on ~1% of rolls, which fell through to an
  untiered random pick. If you change the tier count, grep for every weight
  array, not just the tier arrays.

## Rarity rolls and LUCK (r203, four tiers r226) - `js/luck.js`

**Every offer's tier is decided in one place.** Before the shared draw there were
three live distributions and most of the game used none of them:

| path | common | rare | epic | legendary |
|---|---|---|---|---|
| weight table - Mart, shop Sleights | 59% | 28% | 10% | 3% |
| **UNIFORM** - reward-grid Tricks, shop Tricks, the pick-of-three | 28% | 38% | 28% | 7% |
| a stale 3-tier bag - `pickTrickOptions` | 63% | 28% | 7% | 2% |
| **UNIFORM** - the legacy shop's Tricks and Knacks (found r227) | 28% | 38% | 28% | 7% |

The uniform paths had **no weighting at all** (`pool[random * pool.length]`), so
the **pool composition was the drop rate**. The Trick pool is 49/66/50/12, which
is why "common" was rarer than "rare", epic was as likely as common, and a run
saw **~2.0 Deluxe Utilities against 0.54 Partner Vendors** for the same tier.

- **`pickEntityByRarity(pool, tierOf, weights, tiers)` in `js/luck.js` is the
  chokepoint.** It rolls a tier, then picks uniformly inside it. `tierOf` is
  passed in rather than guessed at, because the pools disagree and always have:
  Tricks carry `tier`, Sleights and Knacks carry `rarity`. `pickTrickByRarity` /
  `pickKnackByRarity` are the two shapes, so call sites do not repeat the
  accessor.
- **The cascade steps DOWN, never up.** A filtered pool (owned Tricks gone, a
  mode ban, a small top tier) often has nothing at the rolled tier. Stepping up
  would hand out something rarer than the roll said.
- **One table: `ENTITY_TIERS` / `ENTITY_TIER_W` in `js/data/balance.js`**, at
  **71/22/5.5/1.5** (owner's numbers, r227). The shop, the Mart, the wheel and
  both reward-grid draws all read it, so tuning the game's generosity is editing
  one line.
- **The PRIZE (boss) grid has its OWN table**, `PRIZE_TIER_W` = **30/55/12/3**.
  It used to cut commons out of each pool and draw the remaining three tiers,
  which is a different thing from a table: the FILTER decided the floor and the
  weights only shared out what survived, so the printed spread and the real one
  could never agree. It is a real four-tier table now - a common is about a third
  of the tiles and RARE is more than half, which is where a prize grid pays.
  `prizeCategories` still omits the common RESOURCE tiles and Mystery; that is
  about tile TYPE, not rarity.
- **Measured end to end** over real generated screens, at Luck 0: reward grid
  73.5/20.0/5.2/1.3, prize grid 30.3/53.6/13.0/3.1, Mart 71.5/21.6/6.1/0.9,
  Survival pick 70.6/22.2/5.8/1.3, legacy shop 70.3/21.9/6.3/1.4. The top tier
  runs a little light everywhere because only 12 Tricks and 4 Sleights exist
  there, so a second draw on one screen cascades down. That is the cascade
  working; the fix is more top-tier content, not a different table.
- **A new offer path must call `pickEntityByRarity`.** A flat `pool[random]`
  silently opts out of both the spread and Luck, which is exactly how the three
  distributions above happened. Two paths were still missing it at r203 (the
  Twin Path event and `applyRewardRandomTrick`, both drawing flat at 31%
  epic-or-better beside a reward grid running 13%), three more at r226 (the
  Survival/Flow pick-of-three, `pickTrickOptions`, and one mixed pool in
  `js/events.js`), and two more at r227 - **the legacy shop's Tricks and Knacks
  were still `shuffle(pool).slice(0, n)`**, the last survivors of the flat draw,
  missed by the r195 sweep because the Mart had already replaced that screen.
- **`pickSleightByRarity` kept its own copy of the roll loop, and the copy was
  wrong once Luck was on.** It rolled `Math.random() * 100` against a running sum
  of the weights, which is only the same thing while they add up to 100 -
  `luckTierWeights` makes them sum ABOVE 100, so any roll past the total fell
  through to tier 0 and handed back a common. **A lucky player was being given
  MORE commons.** It goes through `pickEntityByRarity` now, which normalises by
  the real total. If you write a weighted roll, divide by the total; never assume
  the table sums to 100.

### Four tiers, not five (r226)

`ENTITY_TIERS` carried a fifth `mythic` slot at weight 1 that **matched
nothing**: the data pools were re-tiered onto four when `mythic` was merged into
`legendary`, so every mythic roll cascaded straight down into legendary anyway.
Two things fell out of that dead slot:

- The **Limit Break** tile hard-coded `tier:'mythic'`, so the one guaranteed tile
  on every reward grid asked for a `rar-mythic` colour **no stylesheet defines**.
- `LUCK_TIER_STEP` had a fifth entry that only ever scaled a tier with no
  members, so the top of the Luck ladder was doing nothing.

The mythic weight is folded into legendary (`[59, 28, 10, 2, 1]` ->
`[59, 28, 10, 3]`, prize Sleights `[58, 28, 9, 5]` -> `[58, 28, 14]`), so the
effective spread is **unchanged**: measured over 300k draws, 58.8/28.1/10.0/3.1
against the old table's 59.0/27.9/10.0/3.0.

### LUCK

The `luck` limit tilts **every** roll, which is the real reason the chokepoint
exists: Luck reaches a new offer path by construction instead of by remembering
to add it in N places.

`luckTierWeights()` scales each tier above common by `1 + (luck/100) * step`,
with `LUCK_TIER_STEP = [0, 0.5, 1, 1.5]`, then lets the existing weighted pick
renormalise. **Common is deliberately left at 1.0** - it is what everything falls
back to, and scaling it too would partly cancel the tilt out.

| luck | common | rare | epic | legendary |
|---|---|---|---|---|
| 0 | 59% | 28% | 10% | 3% |
| 20 | 55.8% | 29.1% | 11.4% | 3.7% |
| 50 | 51.6% | 30.6% | 13.1% | 4.6% |
| 100 | 45.9% | 32.7% | 15.6% | 5.8% |

That is **gentle on purpose**, and it is the second shape this has had. The first
was geometric - each tier multiplied by `(1 + k*luck)` once more than the one
below - which put legendary at 25% by luck 8 because the exponent is the tier
index. The Luck limit runs 0-100 in steps of 5, so a curve that steep made a
single upgrade swing the whole table.

**`luckTierPercents()` prints the live table** on the RECORDS Limits tab, through
`tierLabel('_generic', id)` - Luck is the one limit whose number means nothing on
its own, so its row shows the consequence rather than asking for faith.

## Two vocabularies (r198) - `js/labels.js`

The game speaks either **corporate** (WORK / SKILL / OUTPUT / QUOTA, Utilities /
Vendors / Certs, Lite / Standard / Plus / Deluxe) or **gamer** (PIPS / MULT /
SCORE / GOAL, Tricks / Sleights / Knacks, Common / Rare / Epic / Legendary).
Settings -> Display -> Wording. Full table in **TERMINOLOGY.md**.

- **Entity NAMES are not in the lexicon.** "Cascade" is content, not vocabulary.
- **Descriptions are stored in the GAMER wording and translated on the way to the
  screen.** `lexProse()` runs inside `highlightKeywords()`, the chokepoint every
  description already passes through, so 300-odd mentions of "pips" and "mult"
  follow the toggle with no data edits and no second copy to keep in sync. Gamer
  mode is the identity transform.
- **Only unambiguous nouns are swapped.** `score` is deliberately absent from the
  prose table - it is a VERB throughout the descriptions ("Runs score +10 pips
  per card") and swapping it gives "Runs output +10 work per card". It changes as
  a HUD label only.
- **The keyword table carries both vocabularies' terms** so highlighting survives
  the swap in either direction.
- **`data-lex` on a static label in `index.html`** is rewritten by
  `applyLexiconToDOM()` at bootstrap and on every toggle. Adding a HUD label
  means adding the attribute, not a new update path.
- **`resolveLabel(v)`** exists because section/tab tables hold a MIX - 'EVENTS'
  is a fixed string, TRICKS is a function of the live vocabulary. Consumers
  resolve through it rather than testing the type inline.

### Colour means RARITY, shape means TYPE (r198)

Three screens coloured entities by their TYPE, so every Trick you owned looked
identical whatever its tier, and the tier pill printed on that flat colour:

- `css/records.css` - the Owned panel's `--e-accent` (yellow tricks, purple
  sleights, cyan knacks). Now four `rar-*` rules; `recordsEntityCard` takes the
  tier as its last argument.
- `css/survival.css` - the pick-of-three's `--sv-accent`, same three colours.
  `survivalMakeOption` now carries `rar` and the card gets a `rar-*` class.
- `js/mart-shop.js` - `MART_SEC_META` gave each shelf its own colour, and cyan
  SLEIGHTS sat directly above cyan Standard-tier tiles, so the palette said two
  things at once. All four shelves share `MART_SEC_CHROME` now; a section is told
  apart by its glyph and heading.

**A new surface must not colour by entity type.** The four rarity colours
(mint / cyan / purple / magenta) are the only meaning colour carries.

## Conventions
- Match surrounding code style (terse, inline, lots of single-line helpers).
- Animation gating: `animating` / `falling` / `pendingAction` flags block input mid-animation.
- When a mechanic is complex/ambiguous, implement a simplified version and tag it `TBD` in a comment + the item's `desc`/`needsResolve`.
