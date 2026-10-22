# TheGame - Roguelike Poker

A browser-based HTML/JS roguelike poker game. **No build step, no framework, no dependencies.**
Open `index.html` in a browser and it runs.

- **Live site:** https://noflukeluke.github.io/TheGame/ (GitHub Pages, auto-deploys from `main`)
- **Owner:** non-technical developer. Explain changes plainly, avoid jargon dumps.
- **Voice:** plain and direct, in game text and in code. Say what a thing does and what it
  costs, in the fewest words that stay accurate. Never justify a design in player-facing text.
  **No em dashes anywhere**, prose or comments. A lone placeholder dash is a middot.
- **Platform:** desktop / landscape first (`#stage.landscape`). Portrait still runs and is
  kept working, but new layout work goes under `#stage.landscape` unless asked otherwise.
- **Wording:** gamer vocabulary is the resting state (PIPS / MULT / SCORE / GOAL, Tricks /
  Sleights / Knacks). The corporate set is a setting the game is moved into. Structural labels
  (Q1-Q4, the Schedule's obligations, COMPANY STORE, QUOTA CLEARED) stay corporate on purpose.

## Where the history is

**`HISTORY.md` is the old CLAUDE.md** (11,000+ lines, r95 to r409): every pass, what it
measured, the traps it found. It is not loaded automatically. **Before touching a system,
grep HISTORY.md for its name** and read that section. Anything a later section marks
superseded is history, not current code. The other reference docs:

| file | what |
|---|---|
| `TERMINOLOGY.md` | what things are called. Code ids are frozen; only display strings change, and every tier/category word is spelled out in `js/labels.js` and nowhere else |
| `CARD_EFFECTS.md` | everything that can be true of one card: buffs, curses, boss states, card states |
| `EVENTS.md` | the event roster; its last section is what ships (31 live, r581) |
| `OPEN_DECISIONS.md` | the balance-audit backlog, left for the owner |
| `BALANCE_PASS_9.24.md` | the 9.24 balance pass index |
| `TODO.md` | parked work |
| `POST_LAUNCH.md` | work deliberately parked until the itch build is out. Not a wish list: each item is a spec or a decided fix |
| `CLEANUP.md` | the dead-code audit and removal log |
| `docs/archive/` | finished design docs, kept for reference |
| `tools/sim/README.md` | the Monte Carlo bot that plays whole runs headlessly; rerun after any deck or hand-value change |

## File layout

`index.html` is the skeleton: markup plus the ordered `<link>`/`<script>` tags. All `js/*.js`
files are **classic scripts sharing one global scope**. A `const`/`let`/`function` in one file is
visible to all the others. **Load order matters**: several files run set-up code at load, and
`js/bootstrap.js` runs last. `js/storage.js` loads **first** and nothing may go above it. A new
`.js` file goes in the right spot in `index.html`. `grep -rn "functionName" js/` finds anything.

- `css/style.css` is the main stylesheet (layout, cabinet shell, trays, cards). Other CSS files
  are per-system (`dance`, `boss`, `entity-fx`, `grid-pick`, `flow-rewards`, `squares`, ...).
- `js/data/` is **content, no logic**: `cards.js` (suits, ranks, `HAND_BASE`, wild card),
  `tricks.js`, `knacks.js`, `sleights.js`, `bosses.js`, `balance.js` (`BAL` tuning table +
  `DESC_TEMPLATES`), `audio-manifest.js`.
- Engine, roughly: `labels` · `menu` · `grid-metrics` · `limits` · `deck-grid` (deck, gridData,
  curses, card identity) · `hand-detect` · `scoring` (`calcScore`) · `render` · `hud` · `input` ·
  `play-hand` · `score-dance` (the tally animation) · `discard` · `card-fall` · `round-timers` ·
  `boss` / `boss-effects` · `reward-grid` · `limit-break` · `sleights-runtime` · `events-core` /
  `events*` · `interlude` / `level-up` · `shop-grid-preview` (the live shop) · `grid-pick` (the
  shared pick-of-three) · `records` · `settings` · `save` · `improve` (entity tiers) ·
  `card-states` · `flow-rewards` (Flow's reward chain + deck editor) · `map-mode` (the Schedule)
  · `guided-mode` · `survival` / `flow-mode` · `squares-mode` / `squares-patience` (Poker
  Squares; the 5x5 is the Patience run, the 3x3/4x4 dailies share the drag machine) · `tutorial` ·
  `insights` (tips) · `info-hub` (handbook) · `audio*` · `dev-panel` · `bootstrap`.
- `*-preview.html` pages are standalone tuners. A preview must dump a block byte-identical to
  the shipped config; a preview that disagrees with the game is worse than none.

## Workflow

- **Branch:** `main` is the source of truth and auto-deploys. Never commit to it directly.
  Develop on the branch this session was assigned.
- **Deploy:** push the branch, then fast-forward main: `git push origin HEAD && git push origin HEAD:main`.
- **A finished branch is not a deployed branch.** Before starting, check for unmerged work:
  `for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD); do n=$(git rev-list --count origin/main..$b); [ "$n" != 0 ] && echo "$n  $b"; done`
- **Build stamp:** bump `BUILD` at the top of `js/menu.js` on every commit (`rN`, +1 per commit).
  Parallel sessions collide on the number; a duplicate `rN` across branches means one never landed.
- **Commit messages:** detailed. A fresh session re-orients from git history. End with the session URL.
- **Syntax check after editing** (loads every JS file in order, as the browser does):
  ```
  node -e "const fs=require('fs');const idx=fs.readFileSync('index.html','utf8');const srcs=[...idx.matchAll(/<script src=\"([^\"]+)\"><\/script>/g)].map(m=>m[1]);const code=srcs.map(s=>fs.readFileSync(s,'utf8')).join('\n');new Function(code);console.log('OK',srcs.length,'files');"
  ```
- **Verify in a real browser** (Playwright + the preinstalled Chromium) at 1440x820 and 420x900
  through the real tap path. A syntax check and a read of the code pass plenty of bugs that a
  screenshot or a measurement catches. State what was measured.
- **Dev panel** (🛠, bottom-right; also the main menu's Settings) is the debug surface. Tabs
  are `DEV_GROUPS` (r416): Bonuses, Events & Bosses, Change the game now, Hand Scoring, Focus,
  Probabilities, Wild Cards, HUD & Display, Flow and Schedule tabs (goal curve, deck
  switch and settings), Modes (all but Flow and Schedule), Tools. A section's `data-group` is space-separated and
  may sit on several tabs. Boss/event/mode lists are generated from the data tables. Owner's
  standing instruction: a tunable for visual work goes in **Aesthetics** (HUD & Display tab);
  a mode's tunable goes on that mode's tab.

## Core architecture

A grid of playing cards. Select orthogonally connected cards to form hands, score against a
per-round goal under a timer. Between rounds: payout, reward screens, shops, events, a boss
every 5 nodes, four quarters (`QUARTERS_PER_RUN`).

### Key globals
- `gridData[r][c]`: a card object, a special card, or `null`. `gridRows`/`gridCols` from `limits`.
- `drawPile` / `playedPile`. Scored cards go to `playedPile`, reshuffled into `drawPile` at
  level-up (`flushPlayedDeck`). **The board redeals between rounds** (r568; r332's persisting board
  is what the Keeper Sleight brings back, `boardKeepsCard`).
- `selected`, `score`, `coins`, `swaps`, `discards`, `roundSeconds`, `level`, `roundGoal`.
- `limits` / `LIMITS_DEF`: upgradeable caps. `makeLimitRow(def)` is the one row builder.
- `ACTIVE_MODE`: a `MODES` entry. Modes are **flags** (`survival`, `map`, `guided`, `numeric`,
  `timeIsCurrency`, `clock`...), never id checks. The Custom picker synthesises a mode from flags.
- `BAL`: tuning numbers, rewritten in place from `BAL_BASE` by `applyEntityTiers()`. Nothing
  else may write to `BAL`. `DESC_TEMPLATES` regenerate descriptions from it.

### Card identity: `cardId(card)`, never `cardKey(rank, suit)`
Every per-card thing (perm pips/mult, x-pips, x-mult, replays, time, coins, Focus, curses,
counts) keys off `cardId`, the physical card. `cardKey` is the TYPE and only the RECORDS deck
matrix may use it. `DURABLE_CARD_FIELDS` + `recycleCard()`: a card is rebuilt every time it
leaves the board, and **anything not in that list is destroyed**. Derive from the face where
you can (wild = `rank === WILD_RANK`, white = `isWhiteCard`) rather than storing a flag. Target
cards, never faces (`everyDeckCard`, `resolveDeckCard`). A new run-state variable goes in
`SAVE_VARS` or it does not survive a save.

### Layout: one fixed canvas, scaled
`#stage` is 747x420 landscape / 420x740 portrait, scaled by CSS `zoom: var(--stage-zoom)` on
`#cabinet`. Not fluid. Card size comes from `recomputeGridMetrics()` measuring the real
`#grid-slot` (`offsetWidth`/`offsetHeight`, immune to transforms). Landscape panels are
absolutely positioned as stage percentages; `syncSidebarsToGrid()` places the focus column
and clock from JS because the board moves.
- **Never mix `getBoundingClientRect()` with `offsetWidth`**: the first is zoomed, the second
  is not. Divide a rect delta by `rect.width / offsetWidth` to get design px.
- **Pop-ups placed in raw viewport px live OUTSIDE `#cabinet`** (`.time-popup`, tooltips, the
  goal banner, the quarter card, the dev panel, Records, Settings) and are capped to the viewport.
- **A transform on an ancestor of `#stage` re-anchors every `position:fixed` descendant** and
  makes a stacking context. `#camera` carries none at play. Animation drivers publish CSS
  custom properties (`--hb*`, `--frzr`, `--fx*`, `--grds`) rather than writing `el.style.transform`.
- A `fill: 'both'`/`forwards` WAAPI animation owns its property for good: cancel it on finish.
- `z-index` on a `position: static` element does nothing.

### Card types
- Normal `{ rank, suit, _id }`, plus optional `suit2` / `rank2` (dual cards; scored by a ghost pass).
- **Trick**: a scoring buff in the **tray** (`trickTray[]`, `hasTrick(id)`, hard cap, sell to
  make room). Not on the grid.
- **Sleight**: a deck card (`_isSleight`, `sleightId`, `_usesLeft`) with an `activation`
  (`wildcard`, `on_play`, `on_discard`, `on_swap`, `passive`, `double_tap`, `adjacent`...).
  Leaves the board through `discardSleightAfterUse` / `discardToPlayed` (which keeps charges);
  `discardToDrawPile` silently drops Sleights.
- **Knack**: not a card. `acquiredKnacks[]`, `hasKnack(id)`.
- **Stone**, **Wild** (completes a set only, no pips, no Tricks), **Challenge** card (r444: a
  challenge round's card, `_isStone` + `_isChallenge`, falls and renders only; see below).
- `cardCan(card, action)` gates select/swap/discard/fall/render.

### Scoring: `calcScore(handName, cells)`
```
base pips x 1.1^(level-1) -> per-card loop -> x PIPS / x MULT block -> s = pips * mult -> x Focus
```
- **There is no x SCORE step.** Anything new is a x PIPS or a x MULT.
- **Per-card effects fire on the card** (`PER_CARD_PAYERS` table, `_cardMultSeq` for per-card
  x mult), replay-weighted. A card scored three times pays three times, for every counter.
- **`calcScore` is read-only.** It runs speculatively (`findBestHand`, the live preview).
  Charges (`minuteHandCharges`, primes, forced fires, `siphonMultX`) are read there and spent in
  `playHand`. Random rolls inside it are deterministic (`_detReplayRand`).
- **The timeline** (`ledger.timeline`) is an ordered list of events the dance replays. Replaying
  it must reproduce `calcScore` exactly; dev mode logs `[DANCE] timeline drift` otherwise. The
  dance plays the **banked** ledger from `playHand`, so anything bumped after the score (streaks,
  primes, scaling counters via `scalingCount`) runs AFTER `playScoreDance` at all three sites.
- Hands are **components** (`handComponentsFor`): a rank partition (sets/runs) plus a flush
  overlay (all-or-nothing on the whole selection). Cards in two components replay. Every card must
  be load-bearing; one spare **kicker** is allowed and billed (pips + seconds) unless Tagalong /
  Pip In. What you selected is what you play (no subset search when the whole selection is a hand).
- `handBasePips()` / `handBaseMult()` are the one chokepoint for a hand's value (scoring model,
  Natural Scaling, mode overrides). Never read `HAND_BASE[h].pips` directly.
- `trickFires(id)` = `1 + _primed + _rank + mirrors`, for non-pip/mult payouts. Ask it only when
  about to pay; it spends primes.

### Focus
`generateHandFocus` runs before scoring and multiplies the same hand. `focusRateMods()` reads
the loadout. `resetFocusMeter()` is the one reset (level-up, interlude, `triggerBoss`).
`onFocusMaxed()` fires on the edge into max.

### Clock
One clock, `roundSeconds`, in every mode including bosses (a boss round is an ordinary round with
a modifier; `bossWindowDuration` is its length). Flow's and Crunch's clocks span level-ups.
`rewindTime()` / `pauseRound()` are the only ways to add or freeze time (never raw
`roundSeconds +=`). `interactTimeCostMult()` is the one number for swap/discard time costs (0 /
0.5 Flow / 1), read by both charge sites and the Time pop-up. `currentRoundDuration()` for lengths.

### Boss system
`BOSS_PRESETS` (34), dealt from a bag (`nextBossPreset`, `bossPresetIsLive` skips no-ops).
`triggerBoss` -> briefing -> PROCEED -> `startBossTimer`. Effects are `bossSchedule(secs, fn)`
armed and started with the clock. `bossGoalMet()` is `score >= roundGoal`. `bossCardPipScale`
is the one place a boss changes a card's pips (read-only). `isCellBlocked` covers void,
quarantined and held cells. Briefs state the mechanic and stop.

### Between rounds
`playHand` goal -> dance -> `flashRoundEnd` -> `startInterlude` (payout) -> reward screens ->
`finishInterlude` -> `triggerLevelUp` (banks score, `level++`, goal via `goalForLevel(lv)`,
refill holes). `rolloverQuarter` is the single quarter-advance site. `rewardGridContext` picks the
continuation. Every reward pick goes through `openGridPick` (`js/grid-pick.js`): CONFIRM commits,
SKIP skips, PLAY/DISCARD mirror them. Reward chrome leaves through `rewardTransitionOut`.
- Flow's level-up can pay up to 5 screens (`js/flow-rewards.js`): count and kind are two flat
  weighted tables, no repeats of PICK 3, the deck editor is a board takeover, panel and ladder
  stay one pinned size for the chain.
- Credits: interest and unused stock are capped at 10 (`BAL._resources`), Gross Pay lifts both.
  All payout figures and their printed labels come from one function each in `js/data/cards.js`.
- The Schedule (`js/map-mode.js`): 4 lanes x 6 slots, orthogonal moves, dead ends refused by DP,
  every tile advances the curve. Boss quota fixed at map build.

### Offers and rarity
Four tiers: `common` `rare` `epic` `legendary` (ids frozen; `mythic` aliases to legendary).
**Every entity draw goes through `pickEntityByRarity`** (`js/luck.js`), which reads
`ENTITY_TIER_W` and Luck. A flat `pool[random]` opts out of both. Every offer path also calls
`survivalEntityBanned` (mode bans) and `offerBanned`. Colour means rarity; shape means type.
**Every weighted roll is listed in `PROB_TABLES` (`js/prob-tables.js`)** with a description and
a tuning note, edited in place from dev -> Probabilities; a new weighted roll goes there too.
`entityTileInner` / `entityTileHTML` (`js/entity-tile.js`) is the ONE way an entity is drawn.
`fitEntityName` shrinks names; words never break mid-word. `emGlyph` sizes emoji ink.

### Entity improvement (`js/improve.js`)
Tier 0-5 per owned entity, ladder `0 1 2 3 4 7` steps. Allowlist of parameter names only.
`applyBalDescriptions` + the once-only number substitution keep descriptions honest. The badge
prints tier + 1 (`v2.0` is the first improvement). Primes show as `+N` (violet pill).

### Priming
`primeTrick(t, n, opts)` is the one grant site. A prime replays a Trick's own ledger entry; all
stacks fire on the next firing and are then cleared; `_rank` is permanent. Forced fires
(`js/force-trick.js`) pay BAL's nominal value, capped at `force_cap_x` per axis.

## Rules that keep biting

- **One number, one place.** A quoted cost and a charged cost drift the moment they are computed
  twice (`interactTimeCostMult`, `unspentPayout`, `efficiencySecondsPerCoin`, `limitGain`,
  `minSelection`, `payoutCapsLifted`). Read, don't copy.
- **A stored value beats a default.** Changing a shipped default needs a storage key bump or a
  one-shot migration that WRITES BACK (`loadSettings` returns changed `saved`). Overrides-only
  stores (goal tuner, NS rates, clock bar) delete the key when set back to the default.
- **Guards on shared handlers must be checked against every screen that borrows them**
  (`onCardTap`, `#btn-play`, `#btn-discard`, `#swap-indicator`, `render()`'s `_takeover`).
  A screen that takes `#grid` over must clean its own children out; `render()` only reconciles
  `[data-card-id]` elements.
- **`render()` throws on a ragged `gridData`** (takeover screens resize `gridRows/gridCols`).
  Don't call it from between-screen code; `_devSafeRender` guards the dev panel.
- **One global scope, so one name per function.** A second top-level `function x` in a later file
  silently replaces the first everywhere (print-toast's `ptInk` blanked every score plate's ink for
  ~100 builds, r531). Before adding a top-level name, `grep -rn "function name" js/`.
- **Temporal dead zone:** reading a top-level `let`/`const` from another file before it is
  evaluated (or above its declaration in the same file) THROWS. `mult` does not exist inside
  `calcScore`'s card loop.
- **Deferred board work drains from `removeAndFall`'s tail** (fixture exits, Fresh Start).
  Never start a second `removeAndFall` on top of a live one.
- **Cosmetic randomness uses `fxRandom()`**, never `Math.random` (a seeded run replaces it).
- **`shuffled()` is scoped inside `_generateRewardContent`**; events use `evShuffle`.
- **Events:** register in four places in `js/events-core.js`; `EVENT_REQUIRES` gates offers and
  the renderers read it. No inline styles in event renderers; use `evLabel`/`evNote`/`evEmptyHTML`.
- **Line-marking Tricks** alternate axes (`positionAxisNext`), clamp against `limits`, and are
  reset per run (`resetPositionMarks`). The ring divides between colours; no wash on the card.
- **Audio:** every voice connects at `sfxOut`; buses, ducking and limits in `js/audio-mixer.js`.
  Packs cover ids by their own id (`variantOf` rows too). Measure new sounds against what they
  replace; `audioCtx` is declared in `js/challenge.js`.
- **Walkthrough and tips** state the mechanic and stop. Read numbers, never type them. A tip's
  `screen` defaults to `'board'`.
- **Match surrounding code style** (terse, inline helpers). Tag simplified mechanics `TBD`.

## Modes

Carousel: Flow, Schedule, Classic, Custom, Poker Squares, Climb. Hidden (dev panel -> Hidden
Modes): Guided, Spectrum, Crunch, Match-3, Zen. Dominoes (r411), `tetris`/`autoplay` and the
20-minute game clock (r427), Six Suits and
Orientation (the other r416) and the Survival mode entry (r417) were removed; **Flow runs on the Survival engine** (`js/survival.js`,
`survivalActive()` is true for Flow), so that file and its flag stay. Every mode's first run is a seeded walkthrough (`tutorialArmForRun`, filtered
by mode FLAGS); later runs are ordinary.

**Decks (r416).** Six Suits and Orientation are no longer modes. Any mode on the ordinary deck
has a per-mode switch, normal or six-suit (`modeDeckChoice`, js/deck-design.js);
**`runSuitCount()` is what reads the suit count, never `ACTIVE_MODE.suitCount`**. The six-suit
deck is fixed at 60 cards. Wilds are per suit (`wildsPerSuit`, 1 = 4 or 6) and may optionally
complete runs (`wildsInRuns`, in `deckLadderKey`). RECORDS lists hands of 2-5 cards, and 6- or
7-card hands once Hand Size reaches them (`handTypeListed`).

## Cleanup backlog

`CLEANUP.md` is the audit of dead and legacy code (what it is, where it lives, how risky it is
to remove) and what has already gone. `docs/archive/` holds finished design docs and
`previews/archive/` dead mockups.

## r419 - Chip In is PIP IN

Owner's call: the knack is **Pip In** (display only; id `kick_in`). Every "Chip In"
above now reads Pip In. What it does is unchanged: a kicker costs nothing and scores
its pips and fires per-card Tricks, but the allowance is still ONE. Carrying more
than one is Tagalong's job (any number, free, scoring nothing); owning both gives
any number, free, all scoring.

## r421 - the Poker Squares 5x5 is PATIENCE

The old turn/polyomino 5x5 (SQ_SCHEDULE, SCORE ALL / SELECT SCORE, the between-round
trick+consumable picks) is replaced by a 2-grid patience run: single cards dealt 3 at a
time as 1-cell pieces on the r375 drag machine, best >=3-card SUBSET of each line scored
through the real `calcScore`, Focus generated from kindred placements / speed / line
ignition, a 30s deal clock and a 5:00 hard grid clock, pick-1-of-5 Trick popups with
tricks carrying across grids (tray-capped, DROP on the popup frees a slot). The 3x3/4x4
dailies are untouched. `sqPatActive()` is the one predicate; `js/squares-patience.js` +
`css/squares-patience.css`, seams in `js/squares-mode.js`. Full write-up: the r409/r410
patience-branch sections at the end of HISTORY.md.

## r422 - tray Tricks LIFT on hover / thumb
`js/tray-lift.js` draws a body-level fixed COPY of the pointed-at tray chip (bigger, raised, tilting toward the pointer) so it can paint past the clipping tray. The real chip only fades (`.tray-lifted`), so the portrait tilt/turns/scrub keep working on it. Full note in HISTORY.md.

## r423 - Dealer's Choice (`js/dealers-choice.js` + `css/dealers-choice.css`)
A rare `double_tap` Sleight (3 charges). Double-tap deals three held TEMP cards (ranks from the board, random suit, 75% buffed via `DEALER_BUFFS`), then the Sleight leaves the grid. Tap a card or Sleight (`dealerPlaceAt`): it is discarded (a Sleight cycles with its charges) and the top held card takes its cell - swap time and swap hooks, no stock. DISCARD (`dealerDiscardTop`, intercepted in `doDiscard`) throws the top card away - one card's discard time, no stock, not counted as a discard. While holding, taps place rather than select, drags do not swipe-select, a tap mid-fall is held until the board settles, and the stack closes when empty or on `roundEnded`. The stack is body-level: on a mouse the top card hangs from the cursor (its top-right corner just above-right of the pointer, a stiff sub-stepped spring) at 70% of a board card, the rest trail on looser springs with a lean, and all drift at rest; on touch it docks in the hand-preview tray, current card 1.2x, and follows a dragging finger.

## r430 - step 1 of the card-animation plan: cursor, tray words, knack rings

The owner approved a 9-step plan (cursor/labels -> printer toasts -> an Aesthetics
"Card animations" tab with a mock grid -> swap, fly-to-preview, discard, cut, buff,
boss, select/idle with THREE options each -> tray reactions + a line-count setting
up to 20 -> a perf pass). This is step 1.

- **Custom cursor (`css/cursor.css`).** Three cursor IMAGES (SVG data URIs, hotspot
  3,2): cream arrow, mint for clickables, grey with a red no-entry mark. Drawn by
  the browser, so they never lag; never replace them with a div that chases the
  mouse. **Every `cursor:` in css/, index.html and js/ reads
  `var(--cur-pointer|--cur-default|--cur-no, <fallback>)`** - write new ones the
  same way. Settings -> Display -> Custom cursor sets `html.os-cursor`, which
  hands all three back to the OS.
- **The trays carry no category words** (`css/tray-fx.css`): the landscape
  TRICKS/KNACKS watermarks, `#tray-title-word` and portrait's knack label are off.
- **The landscape knack strip takes the full 3-line `--tray-rings`.**
- The Survival/Flow pick's Peek tile reads PEEK / VIEW GRID.

## r433 - step 2: notices are PRINTED (`js/print-toast.js` + `css/print-toast.css`)
`showMessage` hands every notice to `printToast` unless Settings -> Display -> Printer notices
is off (`printToastsOn`; `opts.plain` also skips it). Tractor-feed paper comes down from the top
edge of `#stage` (the `#pt-layer` is body-level, laid over the stage rect in viewport px and
clipped to it; sizes are design px x the stage zoom). Notices within `PT_CFG.groupMs` share one
slip, newest line at the top; a later notice finishes the slip at once, tears it and starts a new
one. A finished slip hangs `holdPerLine` per line. The fall is a flutter model on rAF (swing,
leading edge dips, edge-on at the ends, fastest mid-swing), one transform per frame. Sounds
`sfxPrintLine` / `sfxPrintFeed` / `sfxPrintTear` are synthesised there and catalogued. Tune in
`toast-preview.html`, which loads the real file.

## r434 - printer notices: fixed width, printed before the feed, varied falls
Every slip is `PT_CFG.width` design px wide; a long notice wraps. A line is printed out of
sight first (`sfxPrintLine`), then fed down already written (`sfxPrintFeed`), so the slip
stays hidden (`.pt-empty`) until its first line arrives. Each falling slip rolls its own swing
period and width, drop speed, sideways drift and phase; `spinChance` of them spiral (turn right
round) instead of rocking, and the back of the sheet shows the ink faintly (`--pt-back`).
`PT_CFG.variety` 0 makes every fall the same.

## r435 - notices: black paper, pulled back up, and only the helpful ones print
No fall: a finished slip (or one interrupted by a new notice) is pulled back up into the top in
steps (`ptPull`, `PT_CFG.pullMs`). Paper is black with a dark green bar every other line; text is
the notice's own UI colour; plain px sizes like the old plate toast (`fontPx` 21 VT323, 340 wide).
Print sounds ride the `detail` bus at about half gain. **`noteMessage(text)`** (js/round-timers.js)
is the quiet sibling of `showMessage`: it prints nothing and keeps `noticeLog`. 116 call sites that
only echoed the player's own pick, purchase or a visible counter use it; **`NOTICES.md`** lists
every notice and the rule. New notices pick one of the two on purpose.

## r436 - step 3: the card animation lab (`js/card-anims.js` + `css/card-anims.css`)
Dev panel -> **Card Animations** opens a body-level lab: a mock board of real card faces
(`renderCardAppearance`), a mock preview tray, and one row per movement (`CARD_ANIM_KINDS`: swap,
fly, discard, cut, buff, boss, idle) with a look dropdown and a Preview button. Tapping cards picks
which ones a preview uses. A look is a runner in `CARD_ANIM_RUN[kind][id]`, `(ctx) => Promise`,
animating card elements with WAAPI on the standalone `translate`/`scale`/`rotate` properties (they
compose with the heartbeat's `transform`); the same runner is what the game calls once a step wires
it in through `cardAnimChoice(kind)`. Unbuilt looks are listed, disabled, with their step.
Choices persist overrides-only in `lethe.cardAnims.v1`. "Current" rows are stand-ins for today's look.

## r441 - Flow economy: split rerolls, no score carry-over, shop as a reward
- **Split rerolls** (`flowSplitRerolls()`, dev -> Flow, `lethe.flowEcon.v1`, default on): on every Flow pick, SWAP becomes REROLL REWARD TYPE and grows, DISCARD becomes REROLL OPTIONS and shrinks (`#stage.gp-split`, css/grid-pick.css). Free up to the swaps / discards the round ended with (`flowRrSnapshot`, taken at the goal clear and at the boss chain), then `PICK_REROLL_STEP` x paid this level-up. The tray loses its REROLL and CONFIRM tiles (`pickRerollAction` tiles carry `reroll:true` + `_roll`; the DISCARD reroll calls `_roll`) and gains QUEUE (spreads the tab stack, also on hover) and SKIP. A type reroll on the ordinary pick turns it into a one-step chain.
- **Score over the goal no longer carries** into the next round (Survival engine). Flow pays it, front-loaded (r546, `flowEcon.overSteps`). Flow also pays interest (`interestPayout`) at each level-up; unused stock pays only when split is off. `flowLevelPayLines` is the one source; the Round breakdown prints it under "Paid at level-up".
- **Shop is a reward kind** (`shop`, odds 10): a free visit; closing it (`flowrShopStep`) advances the chain. Odds (r448) pick3 25 / tricks 25 / shop 10 / cards 7 / deck 7 / sleights 8 / limits 8 / improve 4 / knacks 6; a full trick tray drops tricks to 18 and splits the 7 over cards/deck/limits/improve (`flowrOddsNow`); r476: before the first boss tricks get +5, added after that cap. **Superseded by r560:** Tricks' share comes from the tray, the shop needs credits. The chance of 2+ rewards BUILDS UP (r449, `flowrRollCount`, `flowrPrdMisses` in SAVE_VARS): the table chance plus `flowEcon.multiStep` (10, dev -> Flow) per single-reward level-up in a row, reset on a multi. Average rate 62% -> 66%.
- **Forced kinds:** no KNACKS reward before a boss puts one in the boss chain (`flowrKnacksSeen`, in SAVE_VARS). The Tricks-by-the-3rd-level-up rule went in r560.
- **A boss refills swaps and discards** in Survival/Flow (`triggerBoss`, before the modifiers).

## r443 - steps 4-5: swap and fly-to-preview looks (`js/card-anims.js`)
**Swap** runners are FLIP-shaped exactly as `doSwap` runs: data and DOM have already swapped, `a`
is the card picked first (`r1,c1`), animated from its old cell by `dx,dy` design px; `b` travels the
other way. `cardAnimSwap(a, b, dx, dy)` is the game's one call; looks: current (220ms slide),
Leapfrog (a arcs over, b ducks), Rubber band (stretch, snap past, wobble), Shove (a barges, b is
knocked into a's old cell). `cardSwapMs()` is the chosen look's length; the Pivot / Wanderer exits
and Match-3's resolve wait on it. **Fly** looks are keyframes for the clone `flyGridCardToSlot`
flies (`cardFlyLook(dx, dy, sc, i, h, id)`): current, Lean in, Comet (curved path + 3 trailing
ghosts), Pinball (pop up, drop, squash). Every fly look keeps the caller's duration because the
dance times its beats to it. The lab flies its own cards through the real `flyGridCardToSlot`.

## r444 - challenge rounds and the penalty grid (`js/challenge-round.js`, `css/challenge-round.css`)
A round with the FULL goal plus `CR_CARDS` (3) challenge cards, one at a time. A card arrives
by sending a random board card back to the deck and rising into its cell; it asks one thing
(touch it with N hands, score a named hand, N cards of a suit, an N-card hand, a big hand,
N hand types), harder per card. Solving pays `CR_CARD_CREDITS` and the next one arrives
(drained from `removeAndFall`'s tail, `crDrain`). **`roundQuotaMet()` returns false while a card
is unsolved (`crHoldsGoal`)**, so the round cannot end on the goal alone. All solved + goal:
the reward is the PRIZE grid (`crTakePrize`, read by the interlude and by `mapAfterLevel`).
Clock out with the goal met but a card unsolved (`crOnClockOut`): the round is cleared and the
interlude opens the **penalty grid** first (`crSettle` -> `openPenaltyGrid`): every cell a
penalty from the reward grid's own table, and the path must be exactly `limits.selection.current`
long (no skip, no Greedy Boi). Clock out without the goal is an ordinary lost round.
Where: a mode with the `challengeNode` flag (Classic: node 3 of each quarter, via
`crMaybeArmForNode`), and half the Schedule's challenge tiles are an **AUDIT** (`t.audit`,
`MAP_AUDIT_SHARE`) instead of a PRIORITY account, with `CR_MAP_BONUS_SECONDS` (60) on the clock
past the round cap (`crStartBonus`, read by the countdown refill). `crRound` / `crArmed` /
`crFlow` are plain data in SAVE_VARS. Dev (Level & screens): "Next Round: Challenge", "Open
Penalty Grid", "Flow: Challenge Card Now".
Same pass: the reward grids lost the Cut tile and the dual card op, and card-buff tiles are
halved (`REWARD_BUFF_CATS` blessed 6 -> 3, prize 10 -> 5).


## r446 - steps 6-7: discard, cut, buff, boss and select/idle looks (`js/card-anims.js`)
Every movement now has three built looks plus Current. **Exits** keep their end state (the element
is removed after): `cardAnimExit(kind, els, target)`. Discard runs inside `removeAndFall`'s
'discard' mode (Toss, Crumple, Sink; aimed at the DISCARD button, divided by the zoom); Cut runs in
the Flow deck editor's delete (Burn, Snip into two clipped halves, Deep fall). **Entrances** return
to rest: `cardAnimOn(kind, els)` (Current = nothing extra). Buff fires from `enhanceCardKey` on any
card drawn on #grid (Stamp, Charge, Flip); Boss fires from The Hold and The Recall (Shackle,
Static, Pressed). Overlays (`.ca-burn`, `.ca-chain`...) are children of the card, so a re-render
clears them. **Idle**: Ripple is driven from the end of `render()` (`cardAnimAfterRender` diffs
`selected`); Gaze puts `.ca-gazing` (perspective) on #grid and writes each card's `rotate` axis-angle
toward the pointer, or the phone's tilt; Attention is `body.ca-idle-attention` CSS.
`cardAnimApplyIdle()` re-applies on every idle choice change.

## r447 - step 8: tray reactions, up to 20 lines (`js/tray-fx.js`)
The ring stack in css/style.css is generated for 20 lines (dev -> Aesthetics -> Tray lines goes to
20) and every line's alpha carries `* (1 + var(--tray-boost, 0))`. `trayWatch` wraps
`renderTrickTray` / `updateKnackList` and diffs the OWNED ids (never the DOM, so the Sleight-queue
face swap is not a leave): a gained entity drops in large and blurred and the tray ripples inward
with a flare (`trayFxKick(el,'in')`); a lost one leaves a fixed copy sinking into the tray (rect read
before the render detaches it, zoom applied) and the lines pull back outward, dimmed. A mouse over
any tray lights the line nearest the pointer. Kicked and hovered trays are skipped by the ambient tick.

## r449 - step 9: the perf pass
Measured (software-rendered Chromium, so relative; a GPU makes all of these smaller): the tray
ripple was the one steady cost, every tray repainting a 60-shadow stack 30 times a second. Now
`trayFxTrimRings()` injects `#tray-rings-trim`, re-declaring `--tray-rings` under the ring rule's
own selector with only the chosen line count (3 lines = 9 shadows, not 60; the stylesheet's
20-line stack stays as the fallback). The ambient tick runs at 20fps, skips trays that are not
drawn, and only writes `--tray-ph` when its 2-decimal value changes. Attention dims with
`opacity` instead of `filter`. Frame p95 at 1440x820 with the ripple on: ~37-43ms -> ~30ms.
The card-animation looks are WAAPI on transform/opacity-class properties and cost nothing at rest;
Gaze writes one `rotate` per card per pointer frame. Phones held 60fps in every case measured.

## r451 - tray lines: spacing, cursor tilt, comet ripple (`js/tray-fx.js`)
The painted ring stack is baked per settings by `trayFxRingString` from `trayFxGeom(n)`: each line is
thick px + a 1px soft edge + a dark gap of `gap * (1 + grow%)^i` (Line spacing / Spacing growth sliders).
The pointer's glow (`--tray-hv` at line `--tray-hp`) and tilt (`--tray-tx/-ty`, -1..1 x the Cursor tilt
slider) are their own properties, so the ambient ripple keeps running under them: ease in, hold
`TRAY_HOVER_HOLD_MS` (500) after leaving, ease out. A tilted line slides by `w[i]` (0.6 of the gaps outside
it) and the dark gap after it slides with the next line, so gaps close on the leaning side and lines keep
their thickness. The clear-centre cap counts a line only if it clears the centre at full lean. Ripple is a
comet (sharp front, tail behind) over each tray's OWN line count, restarting at the border. Store is now
`lethe.trayFx.v2`, overrides only; v1 is carried over once with its old fade 50 dropped (default 70).

## r452 - dev panel: collapsible sections and docking
A dev tab with 3+ visible sections folds each under its title (start closed; `devSetupCollapse`, one delegated click). On HUD & Display the panel docks over the info column so the grid stays visible (`devApplyDock`); opening a section marked `data-affects-info` moves it over the grid. Portrait docks above the grid. Too small a box falls back to centred.

## r453 - challenge cards v2: Flow, fall cards, arrival and effects (`js/challenge-round.js`)
- **Each card carries its own state** on the board object (`card.cr`: kind, tier, `diff`,
  prog/seen, `src` 'seq'|'flow', `timeLeft`, `done`), so two can share a board and a save keeps
  them with gridData. `crCards()` lists them; `crQueue` holds ids leaving, drained by `crDrain`
  (never mid-fall, never while a round is over; `crOnRoundStart` drains a card the last hand solved).
- **Arrival:** `crBeginArrival(src, tier, idx)` picks a valid cell (`crSpotsFor`: a playable
  neighbour for every card, fall cards in fixed rows), pulses it (`.cr-tele`, `CR_TELE_MS` 3s in a
  challenge round, 5s in Flow), sinks the old card with the animation lab's Sink look, and drops the
  challenge card in from above (`crFxLand`).
- **Flow (owner spec):** `CR_FLOW_PER_CYCLE` (2) cards per boss cycle, planned off the session clock
  (`crFlowPlanCycle`: at least `CR_FLOW_TIME`+5s apart, none within `CR_FLOW_BOSS_GAP` (60s) of either
  end of a boss), `CR_FLOW_SPICE` 10% chance of a second card 15s later, at most two at once. Each
  card has `CR_FLOW_TIME` (60s) of its own, ticked from the round tick (`crTick`), so it pauses with
  the clock and survives level-ups. Solved: +credits, +seconds (`rewindTime`), +1 reward next level-up;
  timed out: the same taken away and one fewer reward (`crTakeFlowRewardDelta`, read by `flowrArm`,
  never below 1). Amounts by difficulty: `CR_DIFFICULTY[kind+tier]` -> `CR_FLOW_STAKES` (1: 5/10s,
  2: 8/15s, 3: 12/20s). **The owner will assign difficulties after play**; until then they follow tier.
  `flowTriggerBoss` clears Flow cards (`crFlowCancel`); `flowEndBoss` re-plans (`crFlowNewCycle`).
- **Fall cards** (tier 2, every mode): `colfall` spawns in the top row, locks discards in its column
  and is solved after falling `CR_FALL_NEEDED` (2) times; `rowhit` spawns in the bottom row, locks
  discards in its row and is solved after 2 cards fall onto it. `crBeforeFall`/`crAfterFall` bracket
  `removeAndFall`; `crDiscardLocked` refuses in `doDiscard`; `crPaintLocks` draws the hatched band
  from `render()`'s tail.
- **Achievable by construction:** named hands come from `achievableHandTypes()` filtered by
  `handIsActive`; sizes/suit counts/type counts are capped; "N in one hand" is set from the median of
  recent hand scores (`crRecent`), not the goal.
- **Looks and sounds per family** (`crFamily`: slap = hand asks, tap = touch, thud = fall cards):
  increment, solve (gold check, sparks), fail (grey, shake), leave. Face: difficulty pips (Flow) or
  1/3 (round), glyph, task, to-do boxes (`crBoxes`), Flow's draining timer (red in the last 10s, ticks
  in the last 5). Synthesised sounds `sfxChallengeWarn/Land/Slap/Tap/Thud/Solve/Expire/Tick`,
  catalogued under Challenge in `js/audio-assets.js`.

## r454 - only the big trays move; small trays are quiet; Larger text reaches tooltips
`TRAY_FX_MOVING` (Knacks, hand preview, Tricks) are the only trays the ripple / pulse touches. Every
other tray gets `--tray-loud` (trayFx.small, default 35%) on its lines and outer glow, and
`--tray-amp: 0`. The ripple is slower (`trayFx.speed`, 1.4s a line), speeds up a little as it goes in
(`u^1.25`), and has a softer front and longer tail (`TRAY_RIPPLE_FRONT` / `_TAIL`); the previous comet
(`--tray-pl` lines further in) is drawn too so its tail finishes fading as the next one starts.
Default line thickness is 1px. Score / goal / credits text is white (end of css/style.css).
`body.big-text` sets `--text-z` (1.15), multiplied into the tooltip CHILDREN's zoom
(css/menu-size.css), never the host the placement code positions.

## r455 - Flow's challenge warning is 10s and can be refused
In Flow the arrival warning MARKS A CARD (`t.cardId`) for `CR_TELE_MS.flow` (10s) of live play, counted
in `crTick` (so it waits out pauses and level-ups) and shown as a countdown on the pulse. `crTeleTrack`
(run from `crPaintLocks`, i.e. every render) keeps the pulse on that card if it falls or is swapped.
**Discarding the marked card refuses the challenge** (found back in `drawPile`: the warning drops,
`sfxChallengeDodge`, "Challenge refused"); a marked card that is played leaves the warning on its last
cell. The first two warnings of a run say so. The challenge round (Classic/Schedule) keeps its 3s
cell pulse and cannot be refused.


## r460 - every tooltip takes the same desktop size (css/menu-size.css)
`--tip-z` (declared on body: `--menu-z` x `--text-z`) zooms the CHILDREN of `#entity-tip` and of the
older tooltips (`#trick-tooltip`, `#knack-tooltip`, `#reward-tooltip`, `#challenge-tooltip`,
`.sleight-tooltip`, `#sleight-grid-tooltip`, `#card-enh-tooltip`, `#sq-tip`); each host's px
max-width and padding are multiplied by it. Hosts are never zoomed (placement writes viewport px).

## r461 - Hard Labour pays per club; a card's x pips multiplies the whole pip total
- **Hard Labour** pays its current rung (base x 2^n) on every club SCORE, on the club's beat, replays
  and a dual card's club ghost included. A timeline event can carry `vals` (one value per replay); the
  dance swaps `value` per rep. Rungs interleave as the dance plays them (real rep 0, ghost rep 0, real rep 1...).
- **The ladder now advances after the dance** (`clubHitsPending`, added in `scalingCount`). It used to
  advance above the canonical score, so every hand was scored as many rungs too high as it had clubs.
- **A card's x pips (`permXPips`) multiplies the WHOLE running pip total** (owner's call), last in the
  card's beat, once per replay. Its event has `scope: 'total'`; the dance banks the beat then multiplies.
  calcScore banks each cell per replay in `_bankCell` (card pips, then x pips, then its ghost) so the two agree.
  Per-card payer pips (Early Bird, Get Even...) are now added in the loop so a later x pips multiplies them.
  A muted or Leaden card's x pips does not fire. Straight Shot reads the card's pips x its own x pips.

## r463 - trays: no idle motion; the Pit look to compare (`js/tray-pit.js`)
Owner's rule: a tray moves for exactly three things: an entity lands (`trayFxKick 'in'`), leaves
(`'out'`), or triggers (`trayFxTrigger`, a 240ms +35% flare, hooked on the dance's `dncReleaseReal`
for chips inside `TRAY_FX_MOVING`). The ambient ripple/pulse, the hover glow and the cursor tilt are
gone (their stored settings are dropped on load); `--tray-ph` rests at `TRAY_PH_REST` (-9).
**Pit look** (dev -> Aesthetics -> Tray look; off by default, `lethe.trayPit.v1`, overrides only):
each tray gets an SVG painted to its own size (`trayPitSvg`, crisp edges, repainted only on resize /
class change): four mitred trapezoid walls of `steps` terraces narrowing by `persp`, one light from the
top left (top/left walls dark, bottom/right lit) or `light:'below'` (the colour rises from the floor),
`view` shows more of the far wall, the top lip shadows the floor. While on it replaces the ring stack
and the tray background (`#tray-pit-style`), and takes the three reactions over (`trayPitKick` /
`trayPitTrigger`, WAAPI brightness). Presets: shadow, quarry, glow.

## r464 - the pit is the default tray look, with a glowing ring
`TRAY_PIT_DEFAULT.on` is 1 (store `lethe.trayPit.v2`; v1 carried over once without its `on`, since r463
shipped it off). A 1px ring in the tray's full colour sits `ring`% (50) of the way from rim to floor,
following the walls' perspective, over a blurred copy of itself (`ringGlow`, 0 = no ring; filter `#rg`).

## r465 - challenge ladders; Flow's warning marks a cell (`js/challenge-round.js`)
- **Flow warning is a CELL** (owner): plays and falls do not move it; whatever card is there when
  the 10s count ends is replaced. Discarding the card IN that cell refuses the challenge
  (`crTeleOnDiscard`, from `removeAndFall`'s 'discard' mode). `crTeleTrack` only redraws the pulse.
- **Every challenge is a LADDER** of tiers `{ d, n }` (`crTypeDefs`, owner's table): touch 1/4 2/5
  3/8 · low hands (Pair, Run of 3, Three of a Kind) 1/3 2/5 3/7 · Straight 2/2 3/4 · Two Pair, Run of
  4 2/3 3/5 · Flush, Full House, Straight Flush 2/1 3/2 · Four of a Kind 3/1 · suit (one hand with 3
  of a named suit) single tier, d3 at Selection 3 else d2 · size (hands of 4+ cards) 1/2 3/5 · types
  2/3 3/5 · big hand 2/1.3x 3/1.8x of recent typical · fall cards 1/2 2/3 3/5. "Touching hand" is
  gone. Types are offered only when the board can make them.
- **Clear, raise, take:** reaching a tier BANKS it (`crAdvance`). With a higher tier the card glows
  (`.cr-cleared`, "MORE?"): tap takes the banked payout (`crCollect`), double-tap raises
  (`crTap` -> `crRaise`, no extra time, counts carry). Unanswered, it takes the payout after
  `CR_CLEAR_HOLD` (6) live seconds. A raise that fails loses everything banked and takes the raised
  tier's penalty (`crFail`). Payout/penalty = `CR_FLOW_STAKES[d]` (credits everywhere; seconds and
  a reward in Flow).
- **Challenge rounds use ladders too:** a card counts as done for the round the moment its first
  tier clears (`q.counted`), the next card comes after it is taken, and a raised round card holds
  the goal open (`crHoldsGoal`) until it banks or the clock runs out (then it no longer counts).
  Card N of a round rolls a type whose ladder starts at difficulty N.
- Face: one pip per tier (green/amber/red by difficulty; filled = banked, ringed = current),
  progress boxes (<= 5) or `n/of`, the timer in Flow. Sounds `sfxChallengeClear` / `sfxChallengeRaise`.


## r468 - the owner's card animation picks are the defaults
`CARD_ANIM_DEFAULT` (js/card-anims.js): swap Leapfrog, fly Pinball, discard Sink, cut Snip, buff
Stamp, boss Static, idle Watch. The store holds only choices that differ from these. Tuned to the
owner's notes: Leapfrog 10% slower, the jumper (always the first-picked card, `r1,c1`) larger at the
top of its arc, both cards snapping past and settling. Pinball takes `CARD_FLY_MUL` 1.2x; the dance
multiplies its flight by `cardFlyMs()` so its beats wait for the landing. **Sink** hides the card and
plays a stand-in copy (`caStandIn`: no card id, first child of the board so every card paints over
it) for `CA_SINK_MS` while the board only waits 200ms, so new cards fall in over it; it tips onto a
corner (3D tilt about the diagonal), spins at most 60 degrees and dims to 65%. **Snip** cuts with a
thin dark line (no glow; the stand-ins strip `flowr-*` and selection classes) and both halves sink
the same way. **Stamp** is 20% slower; its ring is fainter, travels to 1.9x and takes the buff's
colour (`caBuffColor(e)`, passed from `enhanceCardKey` via `cardAnimOn(kind, els, opts)`).
**Static** cycles the channel change's own noise frames (`ccNoise`) with scan lines and a rolling
bar, and splits the card red / blue. **Watch** (new) is Attention (10% less sway) plus Gaze: the
other cards turn toward the newest selected card (`selected`'s last entry), or the pointer when
nothing is selected. Closing the lab re-applies the idle look (a preview borrows the gaze).

## r471 - the Machine panel skin to compare (`css/skin-machine.css`)
Cassette futurism with a little CloverPit grit, under `html.skin-machine` (`.mc-cream` = beige housing).
Dev -> Aesthetics -> Tray look: `trayPit.on` 0 lines / 1 pit / 2 machine (charcoal) / 3 machine (cream);
`trayPitOn()` is >= 1 (the WAAPI reactions), `trayPitDrawn()` is the SVG pit, `trayMachineOn()` the skin.
`#stage` is the housing (grain SVG, grime, seams at 41.35% / 90.6%, corner screws); every tray is a dark
glass window with a 3px bezel and a backlit colour strip on its top edge, which lights (`.mc-lit`,
`trayMachineLamp`) on a trigger (140ms) and a land (420ms). Keys are matte keycaps. The bay bezel goes on
`#grid`, not `#grid-slot` (the slot also holds the Focus bar). Pit stays the default.
**r480 (owner):** windows are a thin RECESSED edge (inset shadow on top, 1px lit lip below; no raised
bezel), the colour band is gone (a trigger now glows the window from inside in its tray colour,
`--mc-in` on `.mc-lit`), and the CRT layer (scanlines, glare, edge falloff; `::after`, z 40,
`--mc-scan`) is ONLY on the displays: #grid and every window. Housing and keys carry no grain or
scanlines. **Never give `#hand-preview-area` the layer**: in landscape it is a static wrapper, so its
`::after` filled the whole stage.
## r473 - the event log and the bug report (`js/devlog.js`, `js/bug-report.js`)
`dbgEvent` keeps 600 lines; each carries a state stamp (`dbgCtx`: mode, level, quarter, clock,
score/goal, board shape, boss/approach/challenge/ended/paused/anim/fall/takeover), printed only
when it changes. Identical lines in a row fold into a count. Errors and promise rejections log a
trimmed stack, and each distinct one keeps its state and a board picture (`_dbgErrors`).
console.error/warn are logged. The buffer is mirrored into `lethe.bugLog.v1`, so the next page
load can still report it. `js/bug-report.js` (loads just before bootstrap) wraps the big moments
(`BR_TRACE`: bosses, challenge cards, round end, interlude, level-up, picks, swap, discard, falls,
time changes, saves) and every notice, and a 250ms watch logs board size/shape, card size and
#grid size/visibility changes; a board whose gridData does not match gridRows x gridCols is a WARN.
`dbgCardStr` names a cell (`UNDEF` = outside gridData, `·` = empty, CH:/SL:/STONE).
**Settings -> Help -> Copy bug report** (`bugReportText`): build, device, run, loadout, board,
errors, log, previous page load. Clipboard, then execCommand, then a selectable box. The first
uncaught error of a page load prints a notice pointing there. A new big moment worth tracing goes
in `BR_TRACE`.

## r473 - the shop on top of a pick; the boss wipe
The pick's capture listeners on PLAY / DISCARD / swap stand down while `shopGridActive`: BUY twice
under a pick's Shop tile used to skip the pick, and LEAVE then restored the pick's 4x6 onto the 4x4
board (cards shrank, `getReachable` read `undefined`, every render threw, the board vanished).
`getReachable` now skips a missing cell. `playHand` refuses during Flow's boss wipe
(`flowBossFighting && !bossActive`); a goal cleared there opened the reward chain over the boss.

## r474 - card animation speed, Focus speed-up, Watch rebuilt
- **Speed** (lab sliders, `lethe.cardAnimSpeed.v1`, overrides only): `caSpeedCfg.speed` (default
  0.6, so every look is ~1.67x as long as built) and `focus2` (default 1.5: at Focus x2 every look
  runs 1.5x as fast, linear from x1, Focus read from `focusMultiplier()`, capped at x4). `caSlow()`
  is the one length multiplier: caAnim / caKeep / caWait / caOverlay / caSinkInto scale through it,
  CSS overlay animations read `--ca-k` set on the overlay, and `cardSwapMs()` / `cardFlyMs()` include
  it so the game's waits match. The lab's "Preview at Focus" slider (`_caLabFocus`) is lab-only.
- **Watch**: no shrink or dim (own class `ca-idle-watch`). Nothing selected: cards look around
  slowly (`caGazeWander`, a timer, 2-5 degrees, `.ca-wander` 1.6s transition). A selection: every
  other card turns to the newest selected card (max `CA_GAZE_FIX_MAX` 9 degrees, `.ca-fixed`).
  The pointer is not used. **Gaze had been invisible**: 900px perspective turned a 9 degree lean
  into under 1% edge change; now 320px, and `caGazeFrame` re-adds `.ca-gazing` every frame. The
  gazing transition list repeats the card's own transitions so adding rotate keeps them.
- **Pinball** hops `h * .35` AWAY from the tray (opposite the flight vector) before flying.
- **Sink** stand-ins go before the first `.card`, not the first child: the board's background
  layer (the swirl) is a child of #grid and was painting over them. Fall 1300ms; `.sel-num` stripped.

## r475 - Autopilot, the reward title is on the panel, names never clip, an empty-UI preview

- **Autopilot** (legendary Sleight, `js/autopilot.js`, `BAL.autopilot`): -5 Focus when it lands (first round tick that sees it), a 30s countdown ring (`sleightLifeLeft` -> `autopilotLifeLeft`), then it plays the best hand on the board, waits for the dance and the fall, and repeats until the board has no hand, the round ends, or `max_hands` (0 = no cap). Hand k applies Focus k times (`focusExtraApplies` adds `autopilotFocusExtra()`, read only while that hand is in `playHand`). Then it discards itself and cycles. Taps are ignored while it runs (`onCardTap`). The board search (`autopilotBestHand`) walks connected shapes up to the Selection Size (5, or 4 on boards over 30 cells), allows one kicker at a 0.8 weight, shuffles its start cells (fxRandom) and retries when its 2,500-shape budget runs out before calling the board empty. Measured: ~11ms on 4x4, ~94ms on 7x7; at max Focus the score roughly doubles every hand (8 hands ~75k), so it is a round-ender.
- **The current reward step has no tab.** Its title is `.fbg-title`, text in a `--fbg-head` (15px) band at the top of `#flowr-bg`; the panel grows by that band and is centred half a band higher so the board inside does not move (0 on the deck edit). The queued tabs are behind the panel (`#flowr-stack` inserted before it at z-index 0), anchored by `bottom` to the panel's top edge with height 0, so the Queue tile / hover spread (`--fst-step` 14px) can only grow UP. The fading ghost carries the title as `.ffl-title`.
- **Names are refitted when the webfonts land** (`refitAllNames` on `document.fonts` loadingdone / ready). The fonts come from Google, so a name fitted in the fallback face and then drawn in Orbitron spilled off both edges and lost its first and last letters. `fitWrapIfClipped` measures the drawn glyphs against the name's parent and, if they still spill, returns the name onto a second line (`.fit-wrap`, owner's pick over shrinking it).
- **`index.html?blank`** hides every glyph (text, numbers, emoji) without moving the layout (`js/blank-ui.js`, `css/blank-ui.css`); `?blank&screen=board|pick|reward|shop` opens a screen. `empty-ui-preview.html` wraps it with screen buttons.

## r478 - challenge stakes push harder; seconds everywhere; the mini grid
- `CR_FLOW_STAKES` is credits 4 / 9 / 15 and seconds 10 / 16 / 24 for difficulty 1 / 2 / 3 (owner:
  reward pushing the ladder). Seconds are paid in every mode now, not only Flow (`crCollect` rewinds).
- The extra reward needs difficulty `CR_BONUS_D` (2) or higher. Flow: +1 reward next level-up (and a
  failed d2+ tier takes one away; a d1 fail does not). Elsewhere: a free **mini grid**
  (`crRound.minis`, also counted for a cleared card paid at the round's end), opened by `crSettle`
  after the penalty grid and before the ordinary rewards.
- **Mini grid** (`rewardGridMode 'mini'`, `openMiniGrid(done)`, js/reward-grid.js): always 3x3,
  ordinary buff/debuff checkerboard, no guaranteed tiles, no destination, 2 Tricks minimum, its own
  seeded stream, not counted in `rewardGridsSeen`, never red, HUD reads BONUS. Hands back to its
  caller like the penalty grid (a Limit Break tile still opens its screen first). Dev: Open Mini Grid.
- Fix: goal met and every card done with no hand to end the round (last card cleared by a fall) used
  to clock out through the legacy level-up and skip the interlude (prize grid lost); `crOnClockOut`
  now ends it through the interlude.

## r479 - Autopilot has 15 charges
`durability: 15`. Each hand it actually plays spends one (`handsPlayed` rose across the `playHand` call); at 0 the run stops even if the board still has hands, and `discardToPlayed` drops the spent card for good. With charges left it cycles back into the deck as before. The Focus multiplier count (hand k applies Focus k times) still restarts every time it engages.

## r482 - spot challenge cards: 25% of ordinary rounds (`js/challenge-round.js`)
An ordinary round in a node mode (`isActMode()`, not Survival/Flow, not a boss, not the walkthrough,
not a challenge round) has `CR_SPOT_CHANCE` (25%) of ONE challenge card, src `'spot'`. Rolled once per
level in `crOnRoundStart` (`crSpotRoll`; `crSpot.rolled` guards the resumes that also run
startRoundTimer), arriving at a random clock value that leaves its 60s clock plus 10s (`crSpotTick`).
It behaves like a Flow card (`crTimed(src)`: 10s refusable cell warning, 60s clock, ladder, stakes);
a d2+ take queues a mini grid (`crSpot.minis`), a fail takes credits and seconds only. At the round's
end `crSpotSettle` (first thing in `crSettle`) drops a pending warning, removes a card still on the
board (a banked tier is paid, an open one costs nothing) and opens the queued mini grids. `crSpot` is
in SAVE_VARS. Dev: "Classic: Challenge Card Now".

## r484 - Quarter resource limits (QRL, `js/qrl.js`)
Owner's rule: in quarter N a card has N buffs working, takes replays from N sources, and a Trick
holds primes from N sources. `qrlLimit()` is the one number (Infinity when off); it applies to
`actStructure` modes and Flow, where the quarter is `survivalBossesBeaten + 1` (capped 4).
**Flow is now 4 bosses** (`SURVIVAL_BOSS_COUNT`), one per quarter. Dev -> Change the game now has
the switch (`lethe.qrl.v1`, stored only when off).
- **Buffs:** kinds are pips (incl. scaling pips), mult (incl. scaling), x pips, x mult, replay,
  time, credits, Focus (`QRL_BUFF_KINDS`; penalties always apply). A card may HOLD more; when it
  scores, `qrlActiveKinds` picks `limit` at random, deterministic on `qrlSeed`, which advances at
  the end of `scalingCount` so the preview, the score and the payouts after it agree. Every read
  goes through `qrlBuffOn(card, kind)` (calcScore, playHand's time/credits/Focus, growCardScaling).
- **Pickers** grey a card that cannot take a NEW kind (`qrlCardFull`): Flow deck editor buff ops
  (`flowrPaintQrl`, `.qrl-full`), the Bench event's chips, Payout Pick's Boost. Hover/tap gives
  "Quarter resource limit (QRL) reached" + the rule. The only place QRL is explained.
  Grants that go past the limit anyway (random-target events: Wager, Bargain, Forge) are allowed
  and print "Clearance granted for early resource expansion" (`enhanceCardKey`).
- **Replays:** calcScore lists every source on a card (`_srcs`) and keeps the `limit` biggest; a
  cut source is zeroed so the ledger never bills it. Layered-hand replays are not a source.
- **Primes:** `primeTrick(t, n, { src })` refuses a new source past the limit (`t._primeSrc`,
  cleared with `_primed` when spent). Sources: wild_heart, prime_times, understudy, hallmark,
  muscle_memory. Mirror, Move as One, forced fires and `_rank` are not limited.
- **Printouts** (`qrlNotice`, once per round per kind): "Only N buff per card permitted in QN due
  to QRL", "Replays are limited to N source(s) in QN due to QRL", "Tricks are limited to N prime
  source(s) in QN due to QRL".
- Not covered: reward-grid buff tiles (their card is fixed by the tile), Heartwood and Absorb
  (write the maps directly, no clearance note), `_vulturePause` / Whetstone.
## r485 - the shop survives its opener closing
`shopGridSaved` records `owner` ('pick' / 'map' / null). `shopRestoreSize` puts the saved size back
unless that owner closed while the shop was up; then the board under the shop is the play board,
sized from `gridData` (or the limits if it is ragged), with a WARN in the log. The Survival/Flow
"opened from the pick" close branch no longer re-pauses the clock when the pick is gone (the next
round is already dealt); it renders and restarts the round timer only if none is running. Belt and
braces under r473's button guard: verified by closing the pick underneath an open shop.

## r486 - phone trays: zigzag Tricks, stacked bars (`js/tray-zigzag.js`, `css/tray-zigzag.css`)
Settings -> Display -> **Trick tray on a phone** (`trickTrayLayout`: zigzag default / tilt) and **Phone tray layout** (`phoneTrays`: side / stacked -> `body.pt-stacked`, two full-width bars at 65% height). `fanTrickTray` hands portrait to `zigzagTrickTray` when on AND the row does not fit flat (r492; a row that fits stays an ordinary row): tiles placed by left/top, alternate rows, upper row on top. Turns: slide left by `w - 2*step` (room reserved on the left), come forward toward the tray middle at x`scale`, slide back, hold, return; after the top row, the lower row drops clear, trades z, rises, and its tiles go. Stops while a hand scores, a Trick is lifted or its tooltip is open, paused, reduced motion. Knobs: dev -> HUD & Display -> Zigzag tray (`lethe.trayZigzag.v1`, overrides only). Side-by-side halves are exactly 50% each; phone preview cards are 15% smaller (`PORTRAIT_PREVIEW_CFG.cardScale`).

## r483 (machine-panel branch) - the panel, second pass (`css/skin-machine.css`, `js/machine-skin.js`)
r487: merged to main as a dev option (Tray look -> machine panel); the pit stays the default. Further tuning on the `machine-panel` branch.
- **Screens vs housing:** every non-housing part is a domed-glass screen in a recess: `::before` is the
  dome (glare, corner falloff), `::after` the tube (scan lines + a soft RGB grille, `mix-blend-mode:
  multiply`, so dark glass stays black). Housing and keys are grained and grimy (`--mc-grain`,
  `--mc-grain-lt`, `--mc-grime`), never scanlined.
- **Text** in #stage is VT323 (shipped in `fonts/`, OFL, as 'VT323 Local'), card faces excepted, with
  `font-size-adjust: .56`. Readout numbers take `#mc-crisp` (anti-aliasing thresholded away + a bloom).
  A live SVG mosaic was tried for "pixelate everything" and dropped: 60 -> 20 fps on the board, and its
  dilate erases dark strokes on light card faces.
- **Fliers under the housing:** a body-level `position:fixed; pointer-events:none` element with no id
  is moved into `#mc-fly` (`mcAdopt`), whose mask is opaque over the screens (`MC_SCREENS` rects) and
  `MC_FLY_GHOST` (16%) elsewhere, recomputed every frame while anything flies. #grid clips its overflow
  (`overflow-clip-margin: 6px`) so falling cards come out from under the housing.
- **Focus gauge** is a fixed screen: in the skin `focusFxLoop` shakes `#focus-active-segment` (62% wide)
  instead of `#focus-bar-outer`; `#focus-mult-readout` rides on the fill (`--focus-fill` on the wrap,
  set in `syncFocusMeterState`) inside 22px of head room.
- **Clock** is a flip clock (`#mc-flip`, built over `#clock`, whose text is hidden; a MutationObserver
  on #clock flips changed digits), always four digits, flat black with faint static, no urgent colour.
**r486 (machine-panel, owner):** SCORE / GOAL labels hidden (blank screens, numbers alike); the goal
screen IS the progress bar (`#score-progress-bar-wrap` stretched to `inset:0` under the number, same
width writes and colours, 55%). Fliers are fully hidden under the housing (`MC_FLY_GHOST` 0). Desktop
credits bar is level left, credits right. **Panel words** (`MC_WORDS`, js/machine-skin.js): DISCARD
reads DEFER, the SWAP and credits emoji go, the FOCUS chip drops its x. A word is never deleted: the
game's text is wrapped in `.mc-game` beside a `.mc-panel` twin and CSS shows one (`display: contents`
for the twin so it stays in its line run), because the reward step saves and restores the key's markup.
Keys are engraved: white enamel in the cut (dark lip above, lit lip below).

## r491 - the score tally speeds up with Focus
`dncPace()` (js/dance-clock.js) now also multiplies by `dncFocusPace`, read once per hand in
`dncResetAccel` from `caFocusPace('tally2')` (js/card-anims.js): `tally2` (default 1.5, lab slider
"Score tally at Focus x2", same store as the card speed) at Focus x2, linear from x1, Focus capped
at x4. The card fly already carries Focus through `cardFlyMs`, so the dance's flight divides by
`dncPaceNoFocus()` instead of counting it twice.

## r496 - a click PINS a tray Trick's tooltip (`js/tricks-ui.js`, `js/tray-lift.js`)
Hover still shows the bubble and the lift still leans toward the cursor. A click pins (`_trickPin`):
the bubble stays, hover on other Tricks leaves it alone, the lift freezes (`trayLiftFreeze`; mouse
only) and the marquee stops, so the pointer can cross the tray to Sell. Closed by clicking the Trick
again, the bubble's X, a click elsewhere, Escape, or the sale. A re-render hands the pin to the new
chip (`trickPinReanchor`, `trayLiftReanchor`). Every chip, marquee copies included, gets the click
(`attachTrickClick`); before this the copies had none. The board's tooltip-dismiss pointerdown in
`js/sleights-runtime.js` stands down for tray chips, or it unpinned before the click landed.

## r497 - card face, stock bulbs (`js/card-face.js`, `js/stock-bulbs.js`)
- **Card face** (dev -> Aesthetics -> Card face, `lethe.cardFace.v1`, overrides only; `html.cf-*`):
  `print` (default) draws rank in VT323 with speckled ink (SVG `#cf-dot`, noise thresholded
  into a mask) on rank and suit; `phosphor` makes each card a black glass screen, rank and suit
  glowing in the suit colour (`--pg`), scanlines; `classic` is the old Cinzel face.
- **Stock bulbs** (dev -> Aesthetics -> Stock bulbs, `lethe.stockBulbs.v1`, off by default, a
  preview for the owner): one pilot lamp per point of a limit's MAX in `#sb-layer` (child of
  #stage, placed in design px from live rects every 150ms, repainted only when state or layout
  changes, and at once from `updateSelectionUI`). Swaps / discards: a column between the board
  and the key, green left / red used / dim locked. Hand / Tricks: a row on the tray's rim or
  beneath it (`trick: 'rim'|'below'`), blue used / green free / dim locked; portrait hand row sits
  in `#sel-count`. A new unlocked bulb flickers, flashes, settles (`sbExtend`, 1.4s). The x/y
  readouts it replaces get `visibility: hidden`. Shown only while `#sel-count` is live and not
  on a reward grid or the shop.

## r499 - the board heartbeat is gone; the clock tick has its own timer
Owner: the grid heartbeat (r183, a swell falling down the board every 10s) is gratuitous next to the
Watch idle look. `js/heartbeat.js`, `heartbeat-preview.html` and the dev section are removed. The
clock's tick (`pulseClockWithWave`, js/clock-fx.js) now runs from `js/clock-tick.js`
(`startClockTick` / `stopClockTick`, every `CLOCK_TICK_SEC` 10s, started with the round timer and
stopped where the heartbeat was). Anything above that says a look "composes with the heartbeat's
transform" still holds for `--frzr` / `--grds`; the `--hb*` vars are unset (CLEANUP.md 1c).

## r500 - Line Quotas made loud (`js/level-types.js`, `css/level-types.css`)
- **Odds:** from level 3 a Flow level is Line Quotas at `LEVEL_TYPE_LINES_CHANCE` (15%) and Relay at
  `LEVEL_TYPE_RELAY_CHANCE` (12.5%), one roll, lines first (dev -> Probabilities, "Flow shaped level chance").
- **Reward floor:** a cleared Flow lines round pays at least `QUOTA_LINES_REWARDS` (3) reward screens
  (`quotaLinesRewardFloor()`, read in `flowrMaybeStart` before the level-up clears `roundQuota`).
- **Onset:** the first `QUOTA_INTRO_TIMES` (4) lines rounds open on an explainer card over the board
  (`#q-intro`, count in `lethe.lineQuotaIntro.v1`, not during the walkthrough) and the round tick holds
  (`quotaIntroHold`) until GOT IT; later rounds get a 1.9s banner. Then the lines draw on one at a time.
- **Colours:** each line has its own (`QUOTA_LINE_COLORS`, `l.hue`) on its band, pill and HUD meter. The
  goal bar becomes one meter per line (`roundQuotaPaintHud`, `.q-meters`).
- **Fill:** `l.shown` trails `l.prog` and catches up with the tally's climb (`roundQuotaClimb(e)` from the
  dance; `handleDanceAbort` and a 9s net call it with 1). A filled line flares and locks faded
  (`.q-flash`, `sfxQuotaLine`, pitch rises per line). **The hand that fills the last line plays its fill
  and finale at once** (650ms), because Flow's pick takes the board mid-dance, before the climb.
  Finale: every line flares gold (`.q-final`, `sfxQuotaAll`). Board bands and meters are kept and
  updated by `data-qi`, not rebuilt, so a flash survives the repaints.

## r501 - Console mode and Stock display in Settings; the beige case
Settings -> Display: **Console mode** (the machine panel in cream, `trayPit.on` 3; off = the pit) and
**Stock display** (Numbers / Bulbs, `sbCfg.on`). Both default off. A settings row with `get` is a VIEW
of its feature's own store: it is not loaded, stored or applied by settings.js (only on a click, and
on Restore defaults), so the dev panel and Settings never disagree. The cream case is an 80s computer
beige (`--mc-house` #ddd2b2); its grain and grime are warm brown and lighter on balance, because the
black specks covered about a quarter of the surface and turned the beige grey (measured centre colour
#9c947d -> #cec1a1). All machine grain is 20% fainter.

## r502 - bulbs on the keys and tray edges; Console mode readouts (owner)
- Tray bulbs (Tricks, hand preview) are centred on the tray's LOWER edge ('below' centres them under it).
- Swap / discard bulbs sit on the key itself, flush inside its right edge (`.sb-flush`: lens only,
  no ring; an unlit one is dark glass). A column taller than the key minus 4px each end splits in
  half, one column each side of the label (`.sb-split`, a 2-column grid, left fills first). The
  desktop SWAP key splits; DEFER and the phone's keys take one column.
- With bulbs on or in Console mode, SWAP reads top to bottom (`writing-mode: vertical-rl`,
  upright); with bulbs on the key counts are `display: none` so they hold no space.
- Console mode: key letters are thickened sideways (two +-0.45px copies in the text-shadow);
  PIPS / MULT / FOCUS values are phosphor blue / red / purple (#5cc8ff / #ff6a52 / #cf8cff).

## r503 - fly-to-preview: the copy keeps its text size and marks; Sleights stand up
- **The flying copy is drawn at the board's zoom** (`flyGridCardToSlot`, js/score-dance.js). It lives on
  body, outside `#cabinet`'s zoom, while card text is sized in design px, so its text flew at 1/zoom (half
  size on a desktop). Now the copy carries `zoom: z` (z = rect width / offsetWidth) and every length it
  is given (left/top, the look's dx/dy and h) is divided by z. Measured at 1440x820: rank height / card
  height was 0.05 in flight vs 0.22 on the board; now 0.24. All four fly looks land within 2px.
- **Marks fly because they are part of the card.** `cardFlyClone` deep-clones the board element and strips
  only board-moment state (`CARD_FLY_STRIP`: selection, hints, the order badge, lab overlays). Every mark
  (buffs, curses, charges, states, rarity) must be drawn inside `renderCardAppearance`'s markup or as a
  class on the card; a mark drawn as a separate layer on `#grid` will not fly or show in the preview.
- **A Sleight stands up in the preview** (`.dnc-turn`, css/dance.css): its landscape business card turns a
  quarter and grows by 75/57 to fill the portrait slot. The turn is appended to each fly frame's
  `transform` (a standalone `rotate` would turn the flight path too). Sleights also flow in the preview
  row now (`.trick-card` is absolute on the board and used to fall out of line).

## r504 - a failed challenge charges its penalty one burst at a time (`crFail`, js/challenge-round.js)
Owner: feel the loss. The failed card STAYS on the board (shake, `cr-lost`), then every `CR_FAIL_STEP`
(640ms) fires one burst (`crFxPenalty`): the card kicks red, a red payout plate 1.7x the usual size
(`efxFly(..., 'loss', CR_FAIL_PLATE)`, js/payout-fx.js, which now returns its flight length) flies to the
readout it costs (-Ns to the clock, -N to the credits, -1 reward to the level in Flow), and on landing the
cost is charged, the readout jolts red (`.cr-loss-hit`) and `sfxChallengePenalty(i)` hits, each one lower.
The card leaves after the last burst and the "Challenge failed" notice prints then (printed first, it hung
over the clock the seconds burst flies into). Flow's reward is taken at once (a level-up mid-burst must
see it). `crFailGen` (bumped by `crReset`) drops pending bursts on a new run; `crFailing` keeps
`crOnRoundStart` from removing a card mid-burst, and that function now also queues any finished card the
queue lost (a resumed save).

## r507 - Flow's boss reshuffles; a dry deck settles low
`flowTriggerBoss` runs `flushPlayedDeck()`: Flow's boss comes mid-level, so the level's played cards used
to stay out for the whole boss. There is still no mid-round reshuffle when the draw pile runs out (owner:
running dry is a reason to take more cards). With too few cards, `removeAndFall` draws a column's cards
first and stacks them on the survivors, so the empty cells are at the TOP (it used to place by draw
order, leaving a gap under a card that fell in, e.g. a discard with an empty deck coming straight back).
`fillGridHoles` does the same when the deck cannot fill every hole: columns pack down, then fill from
the bottom, left column first.

## r508 - Autopilot plays at most 5 hands per landing
`BAL.autopilot.max_hands` 0 -> 5 (description reads it). With its 15 charges that is three landings at most. Verified: 5 hands, charges 15 -> 10, stop with hands still on the board, back in the deck.

## r511 - Console mode: nothing rides over the housing; fliers keep the screen door
- **What leaked** (filmed at 0.15x through CDP `Animation.setPlaybackRate`): the body-level fliers
  were all adopted into `#mc-fly` and masked correctly. What showed over the housing was the
  SCREENS themselves: `box-pop` swelled `#score-center` 1.32x past its recess, `subbox-pop` /
  `pmfJitter` moved the PIPS / MULT boxes, the Focus readout's `focusReadoutPulse` (1.5x) and
  width spilled off the gauge, and falling cards showed 6px above the board (the clip margin).
  In the skin: those pops are a brightness flash on the glass (`mc-screen-flash`), the jitter is
  off, the readout is 10px with no pulse, and `#grid` takes `clip-path: inset(0 -6px -6px -6px)`
  (no margin on top, where new cards fall in). The "-4s" time flash by the clock still prints on
  the housing: it is a label, like the banners, not a moving screen.
- **Screen door on fliers:** `mcAdopt` tags a card clone `.mc-door` (lines over the whole face)
  and a Trick tile `.mc-door-t`; the lifted / pinned Trick (`#tray-lift`, not adopted: it has an
  id and is meant to rise) gets the same. A Trick's door is drawn on its `.reward-cell::after`
  with the floppy's own box and cut corner, so the see-through corner stays clear.
- **Key bulbs** sit inside the key's LEFT edge (split either side of the label when too tall).
  Console mode with numbers: SWAP 12px + count 14px fit; DEFER's count is on its own line.
- **Tally dip fixed (every look):** the score climbs in js/score-dance.js used `now - start` with a
  frame timestamp that can be earlier than `start`; negative progress through the cubic showed the
  score below its old value for a frame (-5, or -110,325 at slow playback). Clamped at 0.
- Phone: the hand bulbs sit centred on the bottom of the preview's box, or of the Knacks box that
  shares its half of the strip (`js/portrait-panel.js`) while Knacks show.

## r509/r510/r512 (this session) - preview tray size, pause on the board, printer pins, console lasers
- Landscape `#selected-cards.dnc-active` keeps the resting 20.7% height (it shrank 7px whenever cards flew in).
- **Pause menu sits on the board**: `placePauseMenu()` (js/game-control.js) lays `#pause-panel` over `#grid`'s rect and zooms its contents to fit; the overlay is clear but still blocks taps. It lives inside `#cabinet`, so the cabinet zoom is divided out.
- **Printer notices**: a line hangs `holdPerLine` x (1 + 0.5 x how much longer than `avgChars` 26 it is); a tap pulls the slip; the pin keeps it up, pinned slips stack from the top and new slips hang below (`ptRestack`).
- **Reward confetti** (r514): in console mode `flowrFxHousingMask` masks `#flowr-confetti` to the `MC_SCREENS` rects (`mask-clip: no-clip`, pieces leave the slot), so it shows only through screens and stays under the chip.
- **Reward lasers**: `flowrFxOrigin` reads the zoom off `#grid-slot` (the chip arrives at scale .82, which put the first burst off centre). In console mode `flowrLasers` builds one wheel per `MC_SCREENS` screen (`.flz-clip`, z -1 in an isolated host, so under the screen's contents), beams the length of the whole stage, the housing hiding the rest. `flowrLasersClear` removes them.

## r515 - Flow Trick rewards include commons; stacked phone preview
- `flowrTrickPool` no longer drops commons (owner: only the boss reward grid lifts the floor). Every
  Flow reward is the ordinary `ENTITY_TIER_W` roll; measured 4,000 Trick screens: 71 / 22 / 5.6 / 1.3%.
- Stacked bars (`body.pt-stacked`): preview cards are `stackedFill` (90%) of the bar's height and the
  hand name is a column on the right (`--pt-name-w` 30%), family over size (css/tray-zigzag.css).

## r517 - phone trays (owner)
On a phone the hand preview (`#selected-cards`) takes no pit / console screen of its own (it sat
inside `#hand-preview-area`'s); in console mode the glass layers go on `#hand-preview-area`. The
shop's multi-buy line is a printed notice on a phone (`shopHintMaybePrint`: first 5 visits, then
15%, `lethe.shopHint.v1`); landscape keeps the readout. The phone Trick tray is left-aligned
(flat row and zigzag).

## r518 - the Reshuffle card (`js/reshuffle-card.js`); fall challenges take an IMPACT
- Deck empty, played cards to shuffle back, fewer than `RESHUFFLE_BOARD_MAX` (18) cards on the
  board, none already there: `removeAndFall` deals a RESHUFFLE? card into a hole the deck
  could not fill (lowest hole of the emptiest column, after every deck card of that fall). A board
  object (`_isStone` + `_isReshuffle`, `_temp`): falls and renders only. Double-tap
  (`reshuffleTap`, from `onCardTap`): `flushPlayedDeck()`, leaves through `removeAndFall`
  'discard', which refills every hole. **r527 (owner):** the cost is `RESHUFFLE_CAP_CUT` (30) off
  Starting Time (`limits.round_time`, floored at its min), face "-30s": the live clock keeps its
  seconds, later rounds start shorter (Flow: the next session). Refused at the floor.
  `fillGridHoles` drops it once the deck has cards again.
- Fall challenge cards (`colfall` / `rowhit`) read IMPACT N×: the card falling OR a card landing on
  it counts, for both kinds, once per fall (`crAfterFall`). Placement and locked lines unchanged.

## r523 - pause menu NEW RUN; the Knock-On knack
- **New Run** (pause menu, `restartRun`, js/game-control.js): one confirm, then a reload like Home with a
  `lethe.newRun.v1` note in sessionStorage (mode id + picker answers). Bootstrap reads and clears it
  (`takeNewRunRequest`), keeps the main menu hidden and starts the same mode on `load` (`launchNewRun`).
- **Knock-On** (rare knack, `knock_on`): `incrementLimit` calls `knockOnLimit(id)`; any limit but Focus Cap
  going up raises one more random limit (weighted, not Focus Cap, not the same one), with a printed notice.
  The second raise does not knock on. A multi-step grant knocks on once (`incrementLimit(id, { noKnockOn })`).
  The Bargain-style event that writes `limits.swaps` directly calls `knockOnLimit('swaps')` itself.

## r525 - knacks grow after bosses; Flow boss goal; Swap Shop / Harvest paid twice
- **Swap Shop, Harvest, Curator** (`KNACK_BOSS_GROW`, js/limits.js): each boss beaten (`endBoss` success),
  each owned one has `KNACK_BOSS_GROW_PCT` (60%) to give 1 more (`knackBossGrowth`, in SAVE_VARS, reset
  in startGame), read by `computeRoundResources` and `trickCapacity`. Curator stays +1. One number in
  every mode (decided r558: Classic, Schedule and Flow all beat four bosses a run, so a per-mode table
  would buy nothing and the knack's sentence would have to change per mode).
- **Swap Shop / Harvest double count fixed:** `computeRoundResources` added them in baseSwaps/baseDiscards
  AND again under "round-start knack effects", so each paid +4 while saying +2.
- **Flow boss goal** (`flowBossGoalLevel`, js/flow-mode.js): boss N's goal is `goalForLevel(1 + 5N)`
  (`FLOW_BOSS_GOAL_LEVELS`), whatever level the run reached. The level-up after the boss resets it.

## r526 - Flow goals collapsed after Continue
`survivalEndlessFromLevel` is `Infinity` for a whole Flow run; JSON saved it as `null`, and on restore
`Math.min(lv, null)` is 0, so every goal after the first post-Continue level-up was the bottom of the
curve (700 at default tuning; the owner saw 1500). `_saveEncode` now writes non-finite numbers as
`{ __t: 'num' }` and `_saveDecode` reads them back; `applySavedState` repairs a pre-r526 null to Infinity.
Verified: Flow level 12, auto-save, reload, Continue, two level-ups: 13,100 and 16,350 (was 700, 700).

## r528 - challenge cards: level starts, the cell holds, hard hands are rarer (`js/challenge-round.js`)
- **Flow arrivals near a level's start** (owner): the session-clock plan is gone. Each Flow level
  (`crFlowLevelStart`, from `crOnRoundStart`, once per `level`) rolls `CR_FLOW_LEVEL_CHANCE` (50%)
  while the cycle has room (`crFlow.used` < `CR_FLOW_PER_CYCLE`, reset by `crFlowNewCycle`); a hit
  puts the warning up `CR_FLOW_LEVEL_DELAY` (3-8) live seconds in. Still never in the first minute of
  a cycle or once `crFlowMayRun` fails near the boss; the spice second card is unchanged.
- **A timed warning (Flow, spot) lands on its marked cell or not at all.** `crLand` used to fall back
  to a fresh spot whenever the cell stopped qualifying, and `crSpotsFor` refuses a SELECTED cell: lining
  the marked card up to discard it, or a Sleight falling into the cell, moved the card next door, or
  with no spot free dropped it silently. Now a selection on the cell is let go, a Sleight there cycles
  (`discardToPlayed`), and only a stone / challenge / Reshuffle card stops it. **Only the player's
  DISCARD refuses** (`crTeleOnDiscard` moved from `removeAndFall` to `doDiscard`; a Sleight leaving or a
  boss taking cards no longer counts).
- **Hand asks are weighted** (`crReqWeight`, `_crPickW` in `crRollReq`): `CR_HAND_W` (Two Pair / Run of 4
  0.8, Straight 0.6, Flush / Full House 0.5, Four of a Kind / Straight Flush 0.25, the rest 1), and a hand
  not played yet this run asks `CR_UNPLAYED_W` (0.6) as often once `CR_UNPLAYED_AFTER` (5) hands are in.
  `crHandPlays` (per-hand counts, bumped in `crOnHand`) is in SAVE_VARS.

## r529 - a Trick Slot or Curator tile makes room for a Trick in the same reward path
`rewardTrickRoom(keys)` (js/reward-grid.js) = free slots + `rewardTrickSlotGain` of each tile in the path
(a `_limitId: 'trick_slots'` limit tile, or a Curator knack tile, `_knackId`) - one per Trick tile.
A Limit Break tile and Knock-On never count. Selection refuses a Trick only when it will not fit AND no
slot tile is left on the grid (`rewardSlotTileLeft`), so either order works; `rewardPicksMet` (CONFIRM)
waits for room >= 0. On confirm, slot tiles land FIRST, apply on landing, and the Trick count flashes
gold (`pulseTrickSlotGain`, `.tray-slot-gain`) before the Trick lands. Also fixes two Trick tiles with one
free slot (the second used to be lost at apply).

## r530 - Flow rewards in the play board's box (owner's option 3)
- `gridSameBoxOn()` (js/grid-metrics.js): a takeover (`gp-active`) in Survival/Flow, not the shop, lays its
  grid in the last play board's exact outline (`_playGeom`, kept on every ordinary recompute): same
  pad and gap, cells stretched to fill (`gridSameBoxMetrics`, no card aspect). `gridSlotPin` pins
  `#grid-slot` at the play position in landscape (inline px, so gp-active / grid-screen / flowr-hold
  move nothing) and sets `body.gp-samebox`, which hides `#grid-topline` (the panel's title band and
  tabs use that room). The pin lasts the Flow chain; `flowrFinish` lets go. Portrait never moved.
- `fitEntityName` caps its width at the parent's content box and, for the shrink test, counts the
  trailing letter-spacing the browser wraps on ("Stimulants" 69.6 measured, 70 drawn, 69 box).

## r531 - score plates: white numbers, solid until the end (`js/score-dance.js`)
Two bugs made the plate numbers grey or off-colour. (1) `js/print-toast.js` (r433) defined its own
`ptInk`, which replaced the plate's, so `--pt-ink` got a kind name ('pipAdd') and the label fell back to
the legacy per-op text colour; it is `ptLineInk` now. (2) The fade lived in the flight's keyframes, so
the flight's ease-out stretched "fade at the very end" over 74% of real flight time and the plate went
see-through. The fade is its own linear animation now (`ptFadeFrames`): solid from the first frame,
gone in the last `PARTICLE_CFG.fadeMs` (60, at most a quarter of the flight). `particle-preview.html`
mirrors it (Fade ms knob). Time plates keep their black ink on white.

## r532 - the screen change: Flow rewards turn in (`js/screen-change.js`, `css/screen-change.css`)
Owner: the game is a piece of hardware, so the screen cannot just become another screen.
`screenChange(swap)` runs a first half, calls `swap()` when none of the screen shows, and runs the
second half. Flow's chain enters through it (`flowrArm`'s first `flowrShowStep`) and leaves through
it (`flowrFinish` -> `flowrFinishSwap`, guarded against a run quit mid-turn); steps inside the chain
do not. Looks (dev -> Aesthetics -> Screen change, `lethe.screenChange.v1`, overrides only, Preview
button): **turn** (default) revolves the right-hand side on a vertical axis like a wall panel:
`SC_RIGHT_LAND` / `SC_RIGHT_PORT` parts, each `perspective() rotateY()` about one shared origin, plus
`.sc-plate` (a stage-sized copy of #stage's background clipped to the panel) over `.sc-cavity`; edge-on
the parts take `.sc-hide`, the transforms are cancelled and the swap is laid out untransformed, then
the back comes round with an overshoot and a latch. **shutter**: two plates (housing texture in the
machine skin, `.sc-skin`) slide out of the screen's recess (`#grid` + `#flowr-bg`), meet, swap, part.
Sounds `sfxScreenTurn` / `sfxScreenLatch` (built on print-toast's `ptVoice`). Console mode only (r536). Off for skip-transitions
and reduced motion. Headless Chromium renders this at ~4fps; check it with CDP
`Animation.setPlaybackRate`.
`fitEntityName` also reads back what was drawn (`fitWordSplit`, `fitClipped`) and steps down while a
word sits on two lines or the glyphs spill, before `fitWrapIfClipped` (which breaks anywhere) can fire.

## r533 - rewind copies placed from their first frame
With `fill: 'forwards'` each rewind ghost copy sat full size and unplaced beside the launch point until
its delay ran out; copies now take `fill: 'both'`. (r533 also turned the copies off; r534 put them back.)
A card's time buff is a REWIND (`permTime`, paid through `rewindTime` in `playHand`); The Vulture and
Wait Four It put a PAUSE on a card (`_vulturePause`, paid through `pauseRound`). Both show as the same
time mark on the card and the same white plate.

## r534 - rewind copies are back; a pause clicks
- `PARTICLE_CFG.trails.rewind` is 4 again (owner: the trailing copies are intended).
- **Pause is CLICK CLICK** (`tick_tock`, every pack and classic): two equal dry clicks `PAUSE_CLICK_GAP`
  (85ms, js/audio.js) apart, no held note, about 0.1s (was 0.6 to 2s), peaks within ~1.5 dB of the old.
  Rewind keeps its wind-up. Vegas built both from the same reel detent; the click is now high and dry.
- **One sound per event:** `rewindTime` already plays `playRewindFX`, and `pauseRound`'s `beginClockFreeze`
  plays the click, so their plates pass `sfx: false` (the pause plate plays it only for an extension of a
  running pause). Measured: a new pause and a rewind each played their sound twice before.

## r540 - console mode: the board is one fixed box (`gridFillOn`, js/grid-metrics.js)
Owner: the board's outline is a fixed screen; cards change shape to fill it as rows and columns
change. In console mode, landscape, not Poker Squares: `#grid-slot` is the biggest box between the
Focus column and the keys, under the timer (css/skin-machine.css, `!important`, so it also beats the
reward states and `gridSlotPin`), and `gridFillMetrics` fills it exactly (no card aspect, fractional
CARD_W / CARD_H, gap from `gapForCardW`). Measured: 328 x 367 design px at every size from 4x4 to
7x7 (the normal look's 4x4 is 274 x 350); timer, Focus bar and keys never move. A Flow reward board
gives up the panel's 15px title band (`body.gp-fillhead`: #grid drops by half a band, `#flowr-bg`
centres on the box, `--fbg-pad` 0 in console mode), so band + board fill the box exactly.
`syncSidebarsToGrid` follows the box, not the board, while it is on. The shop fills the same box.
Open: the x/y selection readout (`#sel-count`) and the pick's MAX label lived in the board's side
margin, which is gone, so they now overlap the keys; queued reward tabs peek into the timer row.

## r539 - a queued discard keeps to its own cards (`runQueuedDiscard`, js/discard.js)
DISCARD pressed while cards fall is queued with the CARDS selected at the press (`pendingDiscardCards`).
Taps still select during a fall, so the old queue discarded the next hand. Cards picked since stay
selected through the discard's fall (`discardCarryRestore`, from removeAndFall). An auto-submit timer
that fires mid-fall now waits for the fall instead of being dropped.

## r541 - keys press, click and buzz; DISCARD latches; refusals shake (`js/key-press.js`, `css/key-press.css`)
- Every `button` (and `#swap-indicator`) takes `.key-dn` on pointerdown, held at least `KEY_MIN_DOWN_MS`
  (80) so a quick tap shows the travel, then springs back (`keySpring`, WAAPI on standalone `translate`).
  Buttons with their own pressed look (`KEY_OWN`) carry `.key-dn` in their `:is(:active, .key-dn)` rules;
  any new button with its own `:active` look goes in `KEY_OWN` and gets `.key-dn` the same way. Others drop
  2px. Keyboard shortcuts press their key (`keyTap`). Dev panel buttons are skipped.
- Sound `sfxKeyClick('down'|'up')` (catalog `key_click` / `key_release`, detail bus). Vibration
  `ctlHaptic('press')` 8ms, `'refuse'` 35ms (Settings -> Controls -> Vibration; Android only, iPhones ignore it).
- **DISCARD latch** (`.key-latch`, `discardLatchSync()`, also run from `render()`): held down with a small
  jitter while it waits: armed for the next drag, waiting for its confirm, or queued behind a fall.
- `refuse()` shakes the board: `gridRefuseShake` animates `--hbx` on #grid (registered `@property`), the x
  term of the composed card transform. Reduced motion pins it to 0.


## r542 - the ten most out-of-line Tricks, owner's survey (from the r533 steering test)
- **Wellspring** (Rare): +1 mult per **30** Focus made this run (was 10).
- **Lie Down** (Rare): **+5** mult per card on one-row hands (was +10; matches Stand-Up).
- **Old Growth**: effect unchanged (it counts a card's bonus pips and replays), **Legendary**.
- **Cloud Nine** (Epic), reworked: taking it adds `BAL.nines_mult.added` (9) 9s to the deck over
  `ACTIVE_SUITS` and zeroes its mult (`cloudNinePickup`, from `selectTrick`); each 9 scored adds
  +2 mult (`scalingCount`). A 9 scored or discarded while it is held is marked `_nineSpent` and is
  destroyed on its way off the board (`discardToPlayed` / `discardToDrawPile`, `expectedDeckTotal--`).
  When no live 9 is left on the board, in either pile or in `goalHandHeld`, the Trick leaves the
  tray and its mult goes (`cloudNineCheck`). The old "forget the 9" removed a same-suit 9 from the
  PILES while the scored card was still on the board, so it never removed the scored card.
- **Rainbow** (Rare): four-suit hands score **x1.25 mult per card** (per-card x mult in the card
  loop, like What are The Odds; was +16 pips +16 mult per card).
- **Rising Tide**: **Rare**; `risingTideMult` (SAVE_VARS) starts at 0 when taken and each level-up
  while held adds 1-3 (`BAL.rising_tide.mult_min/max`, level-up.js). Improvement raises both ends.
- **Stand Up** (Common, `column_rush`) duplicated Stand-Up (Rare): `retired: true`, filtered by
  `applyModeEntityFilter`, kept in `TRICK_POOL_ALL` so a saved run that owns it still works.
- **Quake**, **Balance**: effect unchanged, **Rare**.
- **Jackpot** (Legendary): **x1.5** pips per Jack on the grid (was x2; x16 with four Jacks).

## r543 - quarter modes hide LEVEL
Owner: the quarter/node block already shows progress toward the boss. `startGame` sets
`#stage.act-run` from `isActMode()` (Classic, Schedule, Climb and the hidden quarter modes);
css/style.css hides the portrait top bar's Level stat under it. Flow keeps its LEVEL
(r544: in the landscape corner block).

## r544 - desktop: no credits bar; the credits chip; no boss name banner
- **The landscape credits bar is gone.** Its band went to the score rows: SCORE / GOAL at
  2.78% +15.4 (30px / 21px figures), PIPS / MULT / FOCUS at 20.08% +14.7 (32px); knacks and
  everything below are unchanged. `chipValFit` (js/hud.js) now also fits SCORE and GOAL to their
  box with an 18px gutter, so an 8-digit figure shrinks rather than spills. Flow's reward banner
  (`#flowr-banner`) follows the PIPS row's new box.
- **Credits chip** = `#coin-info`, moved to the start of the bottom row (10.5%; RECORDS / PAUSE
  12.72% each; Poker Squares hides the chip and keeps the old two slots). Amount only. Hover
  (mouse) or tap (touch) shows `#ci-tip`, a stage-level bubble above it, refreshed every 250ms
  while open by `creditsTipFill`: Interest (`interestPayout` x `payoutInterestMult()`, 0 while
  frozen or withheld) and the Early Finish Bonus (`earlyFinishCredits(roundSeconds)`, the
  function the payout pays from with the frozen clock; Crunch's Under Par included). Flow pays at
  level-up, so its tip shows interest and Over the goal (`flowOverGoalPay`).
- **Efficiency is now Early Finish Bonus** on the payout (`payoutEfficiencyName`) and in the walkthrough.
- **LEVEL outside quarter modes** (Flow) is the top-right corner block (`.rp-lvl`, `.rp-lv`,
  `updateRunProgressUI`); Poker Squares keeps its plain skull there. `.ci-level` is removed.
- **The boss name banner (`#boss-banner`) is removed**: the briefing already names the boss.

## r545 - credits chip on the right; challenges one at a time; the warning waits for the board
- The credits chip is the RIGHT end of the bottom row (RECORDS, PAUSE, chip); `#ci-tip` aligns to its right edge.
- **One challenge at a time** (owner): the Flow "spice" second card is gone, and a Flow or spot
  arrival is skipped while any warning is up or any unfinished challenge card is on the board
  (`crAnyLive`; that level's roll is spent).
- **Timed warnings (Flow, spot) are 15s** (`CR_TELE_MS`, was 10s). The challenge round's 3s pulse is
  unchanged and still cannot be refused.
- **The warning only counts while the board takes taps** (`crTick` holds on `animating`, `falling`,
  `dealPhase`, `roundEnded`). Measured before: one 3-card hand took 2 of the 10 seconds while
  taps were blocked. (During the score tally itself the board does take taps, so that counts.)
- **A DISCARD pressed while the board animates is queued** with its cards (`pendingAction`
  'discard', `scheduleQueuedRetry`), like PLAY; it used to be dropped silently.
- `crTeleOnDiscard` ignores the Flow deck editor's discard (`roundEnded`): a deck edit at the
  marked cell's coordinates used to refuse the warning.
- Also why refusing failed before: with two cards up, a fall card could lock discards in the
  marked cell's line. Tested refusal (real clicks, Flow and Classic): at the warning's start, with
  1s showing, right after another discard, with Confirm discards on. Once the count reaches 0 the
  card lands and the cell's selection is let go (by design).

## r546 - Flow's over-the-goal pay is front-loaded; efficiency pays half
- **Flow** (owner: more credits so the shop matters): `flowOverGoalPay` reads `flowOverSteps()`, a
  step table in `flowEcon.overSteps` ("percent over:credits added"), default `10:5, 25:2, 50:1, 100:1,
  200:1`: 10% over pays 5, 25% pays 7, 50% 8, 100% 9, 200% and up 10 (r557: `10:5, 25:3, 50:2, 100:1,
  200:1`, so 5 / 8 / 10 / 11 / 12). Was 1 per 15%, uncapped (0 at
  10%, 1 at 25%, 6 at 100%). The breakdown note (`flowOverGoalNote`) and the credits chip read the same
  function. Dev -> Flow takes the table as text; `lethe.flowEcon.v1` stays overrides only (`overPct` is gone).
- **Efficiency** (`EFFICIENCY_SECONDS_PER_COIN`) 10 -> 20: Classic / Schedule's leftover-time line,
  Crunch's par line and non-Flow Survival pay half. Time and a Half makes it 10. Classic stays 3:00.

## r547 - level growth switch, the card ladder scoring model, dev panel search
- **Level growth** (dev -> Hand Scoring -> Level growth, key `levelGrowth`, stored only when off):
  `levelPipScale()` (js/focus-config.js) is the one reader of a hand's base pips x 1.1^(level-1)
  (calcScore, captureRoundContrib, the preview chips, the dance). Off = 1. Goals are untouched. Default on.
- **Card ladder** (`scoringModel 'card_ladder'`, dev -> Hand Scoring -> Where a hand's value comes
  from, and Custom -> Hand values): no base pips, base mult 0, and card n of the hand (scoring order,
  numbering only cards that score: a wild or a kicker takes no number) adds n mult every time it
  scores, on the card (`handCardLadder`, `_ladPos`, timeline id `_ladder`, source 'card'). Measured:
  three Kings 1+2+3 = 6 mult, 12 with every card replaying once, 9 with only the third. The preview's
  MULT is `handLadderTotal(cells)`; the round breakdown shows a "Card ladder" mult row
  (`_lastHandLadderMult`). `handBaseMult(h)` with no cells (hand ranking, Records) falls back to the
  table, so the partition still prefers the bigger hand. Real hands through PLAY: no timeline drift.
  A wild pays no ladder mult and takes no number (owner, r553), unless Stand-In stands it in for a
  card: then it is numbered, in calcScore and in `handLadderTotal`'s MULT readout alike (r602).
- **Dev panel search** (`#dev-search`, the title bar; `devSearch`): lists every section on every tab
  holding the typed phrase (spaces collapsed; if none does, every word anywhere), each headed by the
  tab(s) it lives on, the matching lines lit (`.dev-hit`). It renders every tab's generated rows first
  (`devRenderGroupContent`, split out of `devOpenGroup`; the card animation lab is not opened) and
  filters the Trick and Knack lists with the same text. Escape, BACK or opening a tab clears it
  (`devSearchReset`).
- tools/sim/trick-audit.js takes `--scoring card_ladder` and `--noLevelGrowth`.


## r548 - round-start seconds carry above Starting Time
`computeRoundResources` capped the round's seconds at Starting Time, and `show321Countdown` then wound the
clock to Starting Time and capped it again. So Time Bank, Clock Tower, +15s / +25s Round, Rain Check
(outside Flow), The Investment and Slow Start / Mystery -15s all did nothing, and a Custom 2:00 or 4:00
round became 3:00 from round 2 on. Both caps are gone (also in reward-grid's mid-round `finishTimer` and
`tickAltarEffects`); the countdown leaves the clock as computed. Crunch still takes its round-cap penalty
off the bank there. Measured round 2 starts (50s left, Time Bank + a +15s tile): Classic / Schedule
180 -> 225, Custom short 180 -> 165, Custom long 180 -> 285; plain 180, penalty 175, Crunch and Flow carry.

## r549 - Stopwatch is a pause (owner)
`startStopwatch` (js/discard.js) keeps its open-ended hold (until the next hand, 6s a charge) but now
follows every pause rule: The Rerun can miss it (nothing spent), Time Slip rewinds the seconds it holds
(`stopwatchSecsLeft`) and spends it, Long Pause makes a charge last 9s (`sleightTimedDrain(card, step)`),
and it bumps `pauseInstanceGame` / `pausesThisRound` / the Vulture's first pause, throws a pause plate and
clicks. Its text says pause, not freeze.

## r550 - one wording for time (owner)
A rewind reads "rewind(s) the clock Ns", a pause "pause(s) the clock for Ns", a card's time buff adds
"when scored" (label form "+4s rewind" / "+3s pause"), a round-start bonus "starts with +Ns". Notices:
"<Name> - rewound Ns" / "paused Ns". The time Tricks, Knacks and Sleights with BAL numbers now have
`DESC_TEMPLATES` (high_water, dam_holding, five_second, four_horseman, double_jeopardy, rain_check,
temporal_rift, vulture, wait_four_it, sundial, metronome, replay_rewind, syncopation, last_call, snooze), so an
improvement prints its number (Five Second Rule's two 5s had made it unrewritable). `flowrBuffDoes(b, v, plural)`
is the verb phrase for a buffed card ("score +3 mult" / "rewind the clock 3s when scored"). Keyword `pause` has
its own colour (`.kw-pause`, css/tooltip.css). The Time pop-up and Records say Starting Time, not Max Time.

## r551 - a card says which time buff it holds (owner)
`CARD_BAND_FAMILIES` splits r299's one `time` family into `rewind` (permTime, black, as before) and `pause`
(`_vulturePause`, green #5f8f12), both in the bottom-left corner (a card holds one time buff, `cardTimeBuffed`).
`cardBuffLines(k, card)` now lists "Rewinds the clock Ns when scored" / "Pauses the clock for Ns when scored"
(it listed neither), so the card tooltip, Records, the shop's card list and `buffedDeckCards` (The Price's
targets) see time buffs. Pass the card: a pause lives on the card object, not in a perm store.

## r552 - a time chip says rewind or pause; a pause flashes like a rewind (owner)
`ptPlateEl(kind, label, scale, color, icon)` puts a mark above the number in the plate's ink (`PT_ICONS`,
inline SVG: two left triangles = rewind, two bars = pause; `.pt-has-ico` / `.pt-ico` in css/dance.css).
`efxFly` passes it for `rewind` / `pause`, which drop the "+" (Stopwatch shows the mark alone); the ghosts
carry it too. `pauseRound` now does what `rewindTime` does: a floater by the clock (`showTimeCost(text,
color)`, green "⏸ Ns") and a quiet `noteMessage` ("⏸ <Name> - paused Ns", name from `timeSrcName`). Neither
prints a slip (NOTICES.md rule). Every pauseRound call from a Trick or Knack now passes its id, so the chip
flies from that tray tile. particle-preview.html mirrors the mark on its rewind demo.

## r553 - the card ladder is the game; level growth off; cards score in the order picked (owner)
- `scoringModel` defaults to `card_ladder` (`SCORING_MODEL_DEFAULT`, js/focus-config.js; key
  `lethe.scoringModel.v2`, stored only when different; the old `scoringModel` key is dropped on load).
  `startGame`'s fallback and the Custom picker default read the same constant.
- **Level growth is OFF** (`levelGrowthOn`, key `levelGrowth` stored only as `'on'`). Nothing scales
  base pips by level now; double scaling (r554) is what grows hands.
- **`scoringOrderCells` returns selection order.** The card ladder numbers cards in the order they
  were picked (first tap = card 1), so pick order is a decision. The dance's strip, Wait Four It's
  4th card and Pivot read the same function. The old 'selection_scoring' knack hook is gone.
- A wild takes no number and pays no ladder mult.

## r554 - double scaling: a hand FAMILY climbs the ladder and gains pips (`js/natural-scaling.js`)
`nsModel` 'double' (default; 'table' keeps the r282 per-hand rate table, `lethe.nsModel.v1` stored
only when chosen). `nsFamPlays` counts plays per family (set / run / flush; a same-suit run credits
both; in SAVE_VARS). Every `ns2.multEvery` (30) family plays the family is one step up the ladder:
card n pays n + step mult (`_ns2.step` rides the `_ladder` event; cards are numbered under every
model, `handCardLadder` is 0 outside the card ladder). Every `ns2.pipsEvery` (8) plays each card in
a hand of that family pays `ns2.pipsPer` (1) more pips, once per replay, before its x pips (timeline
`_nsPips`, source card). `nsHandGrowth(names)` takes the best family on each axis; the Drought zeroes
it. Knobs in `lethe.nsDouble.v1`, overrides only; dev -> Hand Scoring has the model radio, three
steppers and a 30 / 60 / 90-play projection (60 plays of one family = about x4 on a 3-card hand:
mult 6 -> 12, a 7.3-pip card -> 14.3). `handLadderTotal` adds k x step so the preview MULT quotes it;
`_lastHandNsPips` / `_lastHandNsMult` carry the share for the breakdown. `naturalScaleBonus` is 0
under double; `nsAnythingEarned()` is what the Drought and the scaling tip ask.
**Sim note** (tools/sim Classic, native curve, handTime 6, 24 runs): main 91.7% bot wins, r553
87.5%, r554 75%; wide spread at that sample size, and the bot never steers toward a family. The
survival sim is broken ("reading 'seed'") on main as well.

## r555 - challenge cards: every ask has a TOUCHING tier; a hand that takes the whole selection asks less
`crTypeDefs`: every ask but the fall cards and "N hands touching" comes in two tiers. The base ladder
is the ask met anywhere; the touching tier (`q.touch`, `_crTouch`: each d + 1 capped at 3, repeats
dropped) counts only hands orthogonally touching the card (`crOnHand`), wears ✋ beside the glyph
(`.cr-touch`) and says so in the text. A hand that needs every selected card (`CR_HAND_SIZE` >=
Selection Size) gets the TIGHT ladder (low 2/3/5, mid 1 then 2 at d2-3, top one at d3), one with a
spare card the EASY one (low 3/5/7, mid 2/3/5, top 1/2). Three of a suit is never asked at Selection
3; at 4 it is d2/d3, at 5+ it starts at d1; hands of 4+ cards likewise. "N hands touching" is 3/5/7.
Two tiers of one ask weigh 0.6 each. Saved cards without `touch` are the anywhere tier.

## r556 - the Challenge Dial knack (`challenge_dial`, rare)
`challengeDial` (+1 / -1, SAVE_VARS, +1 on a new run; js/challenge-round.js). `crChanceMult()` is
1 +- `BAL.challenge_dial.pct` (25) / 100 while owned, multiplied into Flow's per-level roll and the
node modes' spot roll. A double-tap on its tray chip (`knackDoubleTap`, js/hud.js: a second click on
the same chip within 350ms) flips it (`crDialFlip`, prints the direction); the chip carries
`kc-dial-up` / `kc-dial-down` (a + or minus badge on the diamond) and the tooltip's live block reads
NOW. Banned where no challenge card is ever dealt (`crModeHasCards`: Flow or a node mode).

## r557 - stock bulbs on by default; Flow pays 5 a level clear and more over the goal (owner)
`SB_DEFAULT.on` 1 (the store holds only what differs; with bulbs on the landscape x/y readout is
hidden). `SURVIVAL_LEVEL_COINS` 3 -> 5. `FLOWE_DEF.overSteps` `10:5, 25:3, 50:2, 100:1, 200:1`.

## r558 - console mode: nothing prints on the housing (owner: r540's three leftovers)
On a reward or shop board the Focus gauge stays as a dark pane (fill at 22%) and the MAX note prints
inside its foot. The queued reward tabs are hidden in console landscape (no room above the fixed
box); the queue is text at the right end of the panel's title band (`.fbg-next`, "THEN PICK 3 ·
LIMITS", written by `flowrRenderStack`). With the bulbs off, `placeSelCountConsole` (js/hud.js, from
`updateSelectionUI`) lays the x/y readout on the hand preview screen's lower edge from live rects
in the slot's design px, light ink; every other look clears the inline box. Pit (the default) is
untouched. Decided this pass, no code: Prime Time keeps the universal `0 1 2 3 4 7` improvement
ladder (its 5th improvement is 3 steps like every entity); knack boss growth stays one number.

## r560 - Flow: Tricks' share comes from the tray; the shop needs credits (`js/flow-rewards.js`)
Owner's rule. **Tricks** are no longer a weight in the odds table (`FLOWR_DEF.trick`, dev -> Flow
"Tricks share"): the run's first reward chain opens on a Tricks screen `first` (90)% of the time, and
a miss rolls that slot from the other kinds and makes the NEXT chain's first slot Tricks
(`flowrFirstTrick` 'roll' / 'owed' / 'done', `flowrFirstTrickSlot`, in SAVE_VARS; the walkthrough's
plain pick is not a chain, so the first real chain rolls it). After that every slot is Tricks at
`base` (70) minus `step` (10) per Trick in the tray, never under `floor` (30): `flowrTrickShare()`
over `flowrTrickCount()`, which counts the tray less the Tricks taken from a PICK OF THREE
(`flowrPick3Tricks`, ids noted by `flowrNoteTrickTaken` from `survivalGrant` unless the live screen
is the chain's Tricks step, in SAVE_VARS). Selling a counted Trick raises the share again. The
table's other weights split what Tricks leave in their own ratios (`flowrOddsNow`); the dev panel's
TRICKS field is read-only. Within one chain a second Tricks screen is damped like any repeat, so the
measured per-screen share at an empty tray is ~57%. Gone: the r441 Tricks-by-the-3rd-level-up rule,
the r448 full-tray cap (a full tray already makes Tricks non-viable) and the r476 first-quarter +5.
**Shop** (`FLOWR_DEF.shop`): weight 0 until credits are over `min` (25); over `rich` (50) its weight
takes +`richBonus` (5). Both maps are overrides-only in `lethe.flowRewards.v2` like `odds`.
Measured (4,000 first-slot rolls): 90.4% Tricks, every miss paid Tricks on the next chain.

## r561 - renames (owner): Time Dilation, Hyperphagia
Display names only, ids frozen: boss `the_metronome` is **TIME DILATION** (it clashed with the Metronome
knack), Trick `magpie` is **Hyperphagia** (was Hoarder House, beside the Hoarder knack).
`syncOwnedEntityDescs` now copies the pool's `name` onto owned copies as well as `desc`, so a saved run
shows the current name.

## r562 - Overtime in every event mode (`js/overtime.js`, owner's design)
Offered once per run wherever events run and the round clock can end a round (`overtimeOfferable`, in
`EVENT_REQUIRES`). Taking it makes every round length the mode has `OVERTIME_LEN_MULT` (1.3) longer for
the run, boss rounds included: `currentRoundDuration` multiplies `modeRoundDuration()` (the old body), and
`triggerBoss` scales `bossWindowDuration` by `overtimeBossMult()`. **`startingTimeSeconds()`**
(js/level-up.js) is the one Starting Time figure (round start, the Time pop-up, Records). Then three of
`OVERTIME_COSTS` (8) are dealt, unseen until now; the tapped one is AVOIDED and the other two apply for good
(`overtimeRun.costs`, in SAVE_VARS). Each cost has one reader: quota `goalPenaltyMult` x1.15 (printed only as
"higher quotas"), play `extraPlayCostPerm` +5, discard `extraDiscardCostPerm` +2, fade
`focusDecayIntervalNow` / 1.5, leftover `efficiencySecondsPerCoin` x4, interest `interestCap()` x0.5,
boss_short the boss window x0.7 instead of x1.3, clock_miss 50% of `rewindTime` / `pauseRound` /
Stopwatch do nothing (`overtimeClockMisses`). **Skip** (`skipEvent` -> `skipOvertime`) silently sets
`overtimeRun.gift`: the next reward grid carries a guaranteed time Trick / Knack / Sleight
(`makeOvertimeGiftTile`), or the Schedule's pick shows one first (`guidedPickThreeOffers`).
`OVERTIME_GIFT_IDS` lists them by id. The Crunch-only +90s version in js/events.js is gone.

## r563 - 3-line Line Quotas: goals 80 / 90 / 100%
`QUOTA_LINE_EASE3` deals one of 80%, 90%, 100% of the per-line goal to each line of a 3-line round, at
random; 2-line rounds are unchanged. Each HUD meter's `flex-grow` is (its goal / the biggest)^3, so the
three read as about half, three quarters and full width.

## r564 - console mode: rewards named on the location screen; hand bulbs on PLAY; Peek fans the offers (owner)
- **The timer and its bar stay lit** on reward and shop boards (css/skin-machine.css); `#grid-topline`
  stays off the housing. The Focus gauge keeps r558's dimmed pane.
- **Hand size is a column of bulbs on the PLAY key** (`sbPlaces`, js/stock-bulbs.js, `keyCol('btn-play')`,
  flush like SWAP / DEFER), in both orientations, not while a grid screen holds the key (CONFIRM).
- **The reward queue is the LOCATION screen** (`flowrLocPaint`, js/flow-rewards.js, from
  `flowrRenderStack`; `body.flowr-loc`): it reads REWARD and holds one tile per step left, each in its
  step's colour, the current one on top at the left and the queued ones behind it, offset to the right
  so each shows a sliver with its name. Widths are fractions of the row (`sp`, `wp`), no measuring; a
  phone gets bare colour strips (`.loc-thin`). The board's panel loses its title band (`--fbg-head` 0),
  `.fbg-next` and the tab stack, so `gridFillMetrics` no longer reserves a band (r540's `gp-fillhead` is gone).
- **Peek** (`gridPeekFan`, js/grid-pick.js): replaces the Queue tile on chain screens (`flowrSplitTiles`;
  the pick-of-three keeps its own Peek, which `survivalTogglePeek` routes here). It hands the board back
  and fans the offers' objects small over the board's foot (`#gp-peek-fan`, no names); a tap on one, or
  any `gridPickRender`, brings the pick back. `flowrConsoleOn()` is the one test for all of this.

## r565 - console mode: gaps, clear-glass bulbs, the reward queue answers hover and tap (owner)
- **Gaps:** the fixed box is 43.05% wide (r540's 43.9%), 11 design px clear of the keys; in console
  mode the timer bar starts 1.4% after the readout (0.6 elsewhere) and stops 1% short of the box's
  right edge, clear of LEVEL (`syncSidebarsToGrid`).
- **Bulbs** (css/stock-bulbs.css, every look): no diffusion grid; a glare mark top-left. An unlit bulb
  on a key is clear glass (soft rim, light shade), so the key's colour shows through.
- **Reward queue:** on a mouse, hovering a queued tile on the location screen brings it to the front
  with its name; a tap (any pointer) or the **Queue** tile, back beside Peek, runs `flowrLocCycle`: each
  step left takes the front for `FLOWR_LOC_SHOW` (1500ms), `FLOWR_LOC_LOOPS` (2) times through,
  with "n/N" (`.loc-peek`); a second tap stops it. A phone lays the row out as flex (`.loc-flex`):
  the current tile as wide as its name, the queued ones sharing the rest, a name shown only where a
  tile is over 34px wide (container query).

## r566 - cleanup: the Terminal look, Jack Mult and Heart Double are gone; Climb is hidden
Owner's calls. `css/terminal-skin.css` + `js/terminal-skin.js` (the r471 prototype) are deleted with
their hooks in card-anims, card-fall, level-up, audio-assets and dev-panel. Jack Mult and Heart Double
(scored and described, in no pool) lost their BAL rows, templates and calcScore lines. Climb (the 1 to
15 deck) is in `MODE_HIDDEN_LIST` (dev -> Modes). Decks are the normal deck with wilds, six suits and
Spectrum; OPEN_DECISIONS 8 is closed.

## r567 - Fodder; Turnover hands it out (`js/deck-grid.js`, `js/card-states.js`)
**Fodder** is a card buff: swapping or discarding the card costs no stock and no seconds, and still
counts for every Trick and Knack. `permFodder` (by cardId, SAVE_VARS) is the permanent kind,
`card._fodderTemp` the temporary one (dies with `recycleCard`); **`cardIsFodder(card)` is the one
read** (doDiscard, doSwap, cardBuffLines). Mark: `.fodder-badge`, a recycle sign in the DISCARD key's
red, drawn inside `renderCardAppearance`. The deck editor has a Fodder op (up to 3 touching cards, no
roll, weight 8); card packs skip it. **Turnover** no longer discards anything: `cardStateTurnover`
marks every card idle for `BAL.turnover.idle_seconds` (45) as temporary Fodder (quiet notice). A card
that moved is not idle (`_cardLastPos`); selecting does not reset it.

## r568 - the board redeals; the Keeper holds it (`js/deck-grid.js`, `js/data/sleights.js`)
With no Keeper on the board every card leaves for `playedPile` at the round's end and the next round
deals a full board (the pre-r332 rule; Flow's `survivalRecycleBoard` likewise). **Keeper** (rare,
double_tap, infinite) keeps it: `_keepMode` on the board card is `'both'` (the r332 board), `'cards'`
(other Sleights leave) or `'sleights'` (cards leave, kept Sleights settle to the bottom of their
columns, `boardSettleKept`); a double-tap cycles it (`keeperCycle`), no charge, no round lock.
`boardKeeper()` / `boardKeepMode()` / `boardKeepsCard(card)`; `boardPersists()` is now "a Keeper is on
the board". The round-end sweep (`showLevelUpScreen_fallOnly`, `survivalDealNext`) asks per card.

## r569 - the Reserve: double-tap the Focus bar (`js/reserve.js`)
The Focus bar's double-tap is ONE gesture, hit-tested by rectangle at document level (the bar can sit
under `#grid-slot`'s box); `focusTapHandler()` gives it to the newest owned Focus knack (r571) or the
Reserve. `reserveOpen()` spends `BAL.reserve.open` (10) Focus for `BAL.reserve.cards` (3) fresh random
TEMP cards (`makeTempCard`), each `BAL.reserve.buff_chance` (75%) likely to carry one deck-editor buff
(`rollEditorBuff`: the editor's rows, weights and values). While cards are held a double-tap buys one
more for `BAL.reserve.more` (5); under the cost it refuses. The stack is Dealer's Choice's
(`dealerHand.mode 'reserve'`): cursor-follow on a mouse, docked in the preview tray on touch. Placing
sends the old card to the back of the draw pile and counts as nothing (no swap, no time, no hooks);
DISCARD throws the top card away for nothing. Not on a reward screen, the deck editor, the map, a pause
or the deal.

## r570 - the Card Counter's queue is on the hand preview (`js/queue-views.js`)
The button under the Focus bar is gone. With the knack, a double-tap on `#selected-cards` (rectangle
hit-test, like the bar) toggles `#preview-queue`: the next `gridCols x 2` draw-pile cards over the
preview's live box, left to right as they will fall, next card first and outlined, zoomed to one row.
Hidden while the board animates or falls (the tally lives there), on reward screens, the deck editor
and while a held stack is docked there (`previewQueueHidden()`).

## r571 - the Focus knacks (`js/focus-knacks.js`)
One family, one at a time: owning one replaces the Reserve on the bar's double-tap and bans the rest
from every offer (`focusKnackOfferBanned`, asked by `survivalEntityBanned`) until it is sold.
`FOCUS_TAP_KNACKS`: **Free Hand** (rare; 10 Focus: swaps and discards free of time and stock for 10
live seconds, `freeHandSecs`, treated like Fodder in doSwap / doDiscard), **Charged Card** (rare; 10
Focus: the first scoring card of the next hand takes a deck-editor buff, `chargedCardApply` in
playHand), **Shuffle Up** (common; 10 Focus: every ordinary unblocked card changes place and deals in
again), **Double Down** (epic; 10 Focus: Focus applies twice for the next 3 hands, `focusDoubleHands`
-> `focusExtraApplies`), **Overdrive** (epic; 5 Focus a hand: the board's best hand is selected loud
and played, again until Focus is short; hand k scores x(1 + 0.5k) mult, timeline event `overdrive`
after Siphon; every hand but the last scores fast via the dance's `skipBeats`; `sfxOverdriveHit(k)`
per hand; then a 45s cooldown). State in SAVE_VARS; `#focus-chip` on the bar reads what is live.
**Autoplayed hands make no Focus of their own** (`autoplayNoFocus()`: Overdrive, Autopilot, All
Hands zero the complexity and speed terms in `generateHandFocus`; Tricks and Knacks still pay).
**Loud selection** (`body.autoplay-loud`, `sfxCardSelectLoud`): Autopilot and Overdrive select with
the sound twice, the bigger hover and a beat before the play. **Focus applying again is a bigger
beat**: `focus-beat-big` on `#focus-box` and `#focus-meter-wrap` with `sfxFocusAgain(k)`, a tone up
per application, in the classic set and all four packs.

## r572 - All Hands (`js/sweep.js`, `css/sweep.css`)
Legendary double_tap Sleight, 2 charges, no cost (id `all_hands`; `clean_sweep` is a Trick). It reads
the board like a page: at each free card `sweepHands()` takes the best hand that card can anchor out of
the still-free cards (Autopilot's shape search with a fixed start, one kicker allowed, 12 hands at
most). Show phase: the cards are selected one by one, faster as it goes, a beat per hand
(`sfxOverdriveHit(i)`), picked hands keep a hued ring (`.sweep-locked`, repainted by `sweepPaint()`
from render's tail). Score phase: **each hand goes through the real `playHand` with `_sweepSilent`**
(no dance, no fall, no goal check; Tricks, families, counters, time, credits and the Focus multiplier
apply; Roll Call and the Ringer stand down; the score display is suppressed). Finale: one strip of
every card, clones fly in, one `removeAndFall('play')` takes them all (the Sleight too, with its
charges), per-hand plates fly at PIPS / MULT, the boxes climb to the sums, `pmfMergeIn` /
`pmfFlyToScore` / score climb / `pmfSplitOut`. Then, if `roundQuotaMet()`, `_sweepEndRound` takes
the dance's goal exit (`flashRoundEnd`, clock frozen, `bossSettleWin` / `survivalShowPick` /
`startInterlude`). Refused in a boss round and while the board is busy. Taps, PLAY and DISCARD are
off while it runs (`sweepRunning()`); `sweepReset` on a new run.

## r573 - the Pairs event (`js/events-pairs.js`, `css/pairs-event.css`)
Sixteen cards face down in a 4x4, eight pairs: 4 RANK pairs (two cards of one rank, random suits, two
deck-editor buffs each; a match is the rank alone; both join the deck with their buffs), 2 OP pairs (a
rarer deck op from `PAIRS_RARE_OPS`, applied to random deck cards: Stamp copies one twice, a dual op
gives two cards a second suit / neighbouring rank, a buff op lands one rolled value on two), 2 PENALTY
pairs A and B that match only like with like (A curses a random deck card, a board card only when the
piles are empty; B puts two stones in the draw pile, gone at the next boss). Two forms rolled first:
30% FREE (flip until a penalty pair matches, Leave between pairs), 70% THREE TRIES (Leave after any
completed pair). Never mid-pair (Leave disabled with one card up). **The penalty rule:** with a
penalty card turned first the second flip must be unseen or a known card of the same penalty; a known
safe card shakes and is refused. `_pairsFit` sizes the tiles to the room under the title and over the
sticky buttons (offsetTop chained to the panel) and `#event-overlay.ev-pairs` zooms the panel .8 so
four rows show unscrolled. Confirm is hidden; `renderEventShell` restores its display.

## r574 - score-merge-preview.html
Standalone (no game imports): a mock score panel and four ways PIPS x MULT x FOCUS become the score,
from three landed chips to the SCORE climbing: A Current (pmf-merge), B Two-step fuse (owner: pips and
mult combine, then that number and Focus), C Collide and press (Focus stamps the product, once per
application), D Working shown (the sum written out under the row). Plus the r571 multi-apply beat.
Timing knobs mirror `PMF_CFG`. The owner picks; the pick goes into `js/pmf-merge.js`.

## r576 - a bulb inside each stock bulb (owner)
Each `.sb-b` holds a `<b>` (made with it in `sbPaint`): a small glass round over a screw base,
painted between the lens (`::before`) and the glare (`::after`). Unlit it is a faint outline seen
through the clear glass; lit, the outline brightens and a hot filament glows in the round.

## r576-r581 - the events pass (EVENTS.md, "THE ROSTER AS BUILT")
- **Archived events** (`EVENT_ARCHIVED`, js/events-core.js) are never offered; every draw goes
  through `liveEventIds()` / `eligibleEventIds()`. A new event registers in EVENT_META, the
  renderer map, the handler map and (if it can be useless) EVENT_REQUIRES.
- **Event toys** (js/event-toys.js): `evCoin`, `evWheel`, `evDie`, `evPlinko`, `evStopper`. A toy
  is HANDED its result (rolled with Math.random first) and only shows it; cosmetic jitter is
  `fxRandom`. `evReveal(el)` scrolls a result into view inside the event panel.
- **Board screens after an event**: `evRunScreens(['pick3', 'limits', 'improve_random'...])`
  (js/events-flip.js) hides the panel and the veil, runs them, then closes the event.
- **Call It** is `rewardGridMode 'callit'` (`openCallItGrid(done)`): no destination, no
  guaranteed tiles, no mysteries, exactly Selection Size, no skip; confirm calls `callItAsk`.
- **Junk cards** (js/boss.js) and the **Lockbox** (js/lockbox.js, `lockboxStash` in SAVE_VARS,
  the held stack's 'lockbox' mode in js/dealers-choice.js).
- **Freed wilds**: `wildsUnbound` (run state) -> `wildsRunOn()` / `wildsFlushOn()`, both in
  `deckLadderKey`. **Stand-In**: `standInProxies` swaps a wild for a proxy card in calcScore's
  per-card loop. **Static Bonus**: `staticPips` / `staticMult` (declared in scoring.js) are
  added to the hand's base and to `ledger.basePips` / `baseMult`.
- **Event tour**: `index.html?events` (js/event-tour.js), verdicts in `lethe.eventTour.v1`.

## r583 - pixel icons on the entity tiles (`tools/icons/`, `js/data/icons.js`, `js/px-icons.js`)
Owner: the emoji go. Every glyph `emGlyph` (js/entity-tile.js) draws (Trick categories, Knacks,
Sleights, reward tiles; 133 of them) is a 16px, three-tone cell of `assets/icons/entities.png`,
pixelated by `tools/icons/build.js` from game-icons.net SVGs (CC BY 3.0; authors listed in
`assets/icons/CREDITS.md` and the handbook's Credits). `tools/icons/manifest.js` is the one
place that says which icon and colour a glyph gets; the three outputs are GENERATED, rerun the
tool. Keyed by emoji, so a glyph with no row keeps its emoji, and the emoji rides hidden inside
the icon span (`.px-ico > i`) so dev -> Aesthetics -> **Entity art** (`lethe.pxIcons.v1`, stored
only when off, `html.px-emoji`) flips back without a re-render. `--px-sheet` on `<html>` carries
the sheet url with a content hash. Not yet converted: the places that print `t.emoji` as text
(tooltip titles, Records lines, the event slot reels, the dev lists).

## r584 - knack diamond squared and dark; Sleights lose the logo plate (owner)
`.rwd-diamond` (css/style.css) has no rounding, no inlay ring (`::after` is gone) and a flat fill of the
rarity colour darkened (`color-mix(var(--rc) 38%, #0d0b08)`) with a 1.5px lighter edge; the owned chip
follows. The Sleight tile's and the board card's `::before` no longer paint the upper-left plate; the
icon is centred over the name band (tile padding `4% 0 38% 0`, board `12% 0 34% 0` to clear the corner
rank mark). `tools/icons/build.js --style multi` colours by depth (outline, body, a second hue in the
core) for a bigger grid (`--size 32 --margin 2`); previewed for the owner, not shipped.

## r585 - console Focus gauge: held on rewards, drains back; bulbs seen through glass (owner)
- **Readout on the top lit tick** (`focusPlaceReadout`, js/focus.js): `--focus-top` on `#focus-meter-wrap`
  is measured from the node's offsets (immune to the fill's jitter); with nothing lit it sits on the
  first tick. Ticks are 80% of the gauge (was 62%); head room is 30px so x2.0 at max fits.
- **Hold** (`focusHoldOn` / `focusHoldOff`, from `enterGridScreenHud` / `exitGridScreenHud`, machine skin
  only): a reward or shop board shows the fill where the round ended (`_focusHold`, read through
  `focusShownNodes()`), still (no jitter) and off-white (`.focus-held`), with its multiplier; MAX is one
  line in the head room. Back on the board the shown value drains to the live one over `FOCUS_DRAIN_MS`
  (900), waiting up to 4s for the level-up's reset to land.
- **Stock bulbs:** the r576 bulb shape is replaced by the top of a bulb under the cover: a round glass top
  in a dark socket ring with a short coil across it (grey and dark unlit; a hot core in the cover's
  colour lit), between the cover's tint (`::before`) and glare (`::after`).


## r586 - the fixed board box in every look (owner)
r540's console box is now the normal look's too. `gridFillOn()` no longer asks for the machine skin
(still landscape, not Poker Squares); `recomputeGridMetrics` sets `#stage.grid-fill` before it
measures, and css/style.css places `#grid-slot` from that class (46.85% / 11.11%, 43.05% x 87.4%,
`!important`), with `--fbg-pad` 0. Outside console mode the Flow panel keeps its 15px title band,
so `gridFillMetrics` brings r540's `body.gp-fillhead` back for it (the board drops half a band, the
panel centres on the box). Measured at 1440x820, pit and console alike: box 322 x 367 design px at
350,47 on play, a Tricks reward and the deck editor. Portrait is unchanged.
## r587 - Sleight icons keep 3px off the card's top; the board card's real renderer draws the icon
Owner: a buffer above the icon, and an icon too tall is cut off a pixel below the card's edge. The
Sleight tile's `.rwd-art` pads `max(3px, 4%)` on top and the board card's `.sleight-card-emoji`
`max(3px, 12%)`; both carry `clip-path: inset(1px 0 0 0)` (their box IS the card band). Measured:
tile icon 3.0 design px below the card top, board 6.7. The board Sleight's markup comes from
`sleightFaceHTML` in js/sleights-runtime.js (render.js and card-fall.js carry older copies);
it printed the raw emoji, so board Sleights never showed the pixel icon until now.

## r588 - the event layouts lab (`js/event-grid-lab.js`, `css/event-grid-lab.css`)
Owner: every event should live on the board. A look preview, nothing is granted: `index.html?evgrid`
(or dev -> Events & Bosses -> Event layouts) starts a Classic run, pauses it, and turns the board
into one of six sample events, one per shape (two options, three rungs then cards, pick an
entity, several steps, a gamble, buy several), with the real words, card faces and entity tiles.
Four layouts: **Marquee** (a merged prompt cell on top, options as cells; with room the prompt
is a left column), **Pages** (a screen per step, cells turn over between them), **Focus** (a
title strip and small cells; a tap opens one across the board), **Terminal** (the board is one
amber screen; the event types out, options are numbered lines). Three rooms: in the box, **zoom
in** (a transform on `#camera` until the box fills the screen's height, about +15% at 1440x820,
and the board widens to all that is in view; cleared at rest, camera.js rule 2), **slide off**
(every laid-out box outside the board slides out its nearer edge on the standalone `translate`,
the board takes the stage). "Only when the text won't fit" measures the step in the box first.
Cells are absolutely placed in cell units and keyed, so a redraw moves surviving cells (FLIP on
left/top/width/height) and turns new ones in. Text is `N px x var(--fit)`, fitted on a hidden
copy at the target size; the panel prints the smallest text as drawn on screen.

## r589 - event layouts lab, round two (owner: Terminal stays, Marquee was the best of the rest)
The lab now shows three crossings of Marquee and Terminal beside both originals (Pages, Focus and
zoom are gone; slide-off stays): **WALL** (Marquee's plan, every cell its own small amber screen,
picked = the screen lit solid), **READOUT** (one amber screen on the top half over a row of matte
keys with a lamp; touching or pointing at a key prints its full text on the screen, `eglHover` /
`egl.inspect`), **WIREFRAME** (one amber glass with Marquee drawn on it: the prompt in a double box,
each option a single box with its title on the top border). Every layout lays out on 12 half-cell
rows. Two screens follow the owner's designs in every layout and always keep the board's box:
**Card Market** is the board itself, `gridRows x gridCols` cards that all carry a buff (the real
odds of a second), bought by tapping (`shopgrid`); real faces wear their bands by writing the
offer's buffs to the stores for one render (`eglFaceBuffed`). **Deck Trim's cut** is the whole deck
in one column per suit, a rank to a row from the Ace down, wilds last, six rows in view
(`deckcols`, `eglDeckCols`, `EGL_DECK_ROWS`); it scrolls a row at a time from up / down arrows laid
over the Focus bar (`#egl-scroll`, hold to repeat), the mouse wheel or a drag (`--vr` on the view).
Text that does not fit overflows (`.egl-fit > * { flex-shrink: 0 }`, `justify-content: safe
center`) so the fit pass can see it. Prefs moved to `lethe.eventGridLab.v2`.

## r588-r590 numbering
Two sessions shipped r588 and r589 in parallel: the event layouts lab (the two sections
above) and the reward pick (the three below). The merge that joined them is r591.

## r588 - the reward pick is 3 rows (owner)
`GP_ROWS` 4 -> 3 and `GP_OPT_H` 3 -> 2 (js/grid-pick.js): every pick-of-three's rewards are 2 cells
tall, the action row is the last. Where the board is a fixed box (landscape, Flow on a phone) the
rows stretch to fill it, so rewards got shorter (desktop Flow 252 -> 223px) and the action row
taller (80 -> 109px). Where the board keeps the card shape (a phone outside Flow, Poker Squares)
the whole pick is a row shorter, so the art is capped by tile height (`#grid .gp-opt` is a size
container, `.gp-art` width `min(100%, (66.67cqh - 30px) * --gp-ar)`, css/grid-pick.css) and the
description keeps 2 lines (phone Classic tile 91 x 119, was 91 x 180 with 5 lines).

## r589 - the pick's action row is short (owner)
The pick's rows are not equal: `gpRows(r, h)` / `gpPickBox` (js/grid-pick.js) make the action row
`min(CARD_H, CARD_W x GP_ACT_TALL)` tall (`GP_ACT_TALL` 1.5) and the two reward rows share the rest.
`gpBox` (shared with the payout) is unchanged. Measured: desktop Flow rewards 99 x 262, action tiles
46 x 70 (r588: 223 / 109; before r588: 252 / 80); phone Flow 87 x 287 and 41 x 61; a phone outside
Flow is unchanged (its cell, 44 x 58, is already under 1.5x).

## r590 - a reward is two tiles in its rarity colour (owner)
Each pick-of-three choice is an ENTITY tile (`.gp-head`: tag, art, name; 60% of the choice) over a
DESCRIPTION tile (`.gp-body`), a board gap apart (`--gp-gap`, written by `gridPickRender`). `.gp-opt` is
only the frame (tap, tooltip, the picked lift) and paints nothing. Both tiles are the rarity colour way
darker (`--rc` from `.gp-opt.rar-*`, mixed into near black; css/grid-pick.css); picked = mint ring over
the tint. **An offer with no rarity of its own wears one from how often it is drawn**:
`rarityForShare(share)` (js/luck.js, `SHARE_RARITY`: 10%+ common, 6%+ rare, 2.5%+ epic, else
legendary), fed by `flowrOpRarity(op)` (share of the deck editor's `FLOWR_OP_WEIGHTS` draw; card packs
use their buff's op) and `limitRarity(d)` (share of `LIMITS_DEF` weights). Display only. Today: Pip /
Mult Buff and Suit Spread common; Focus, Time, Coin, Rank Pull, Cut, Fodder rare; Stamp, x buffs
(and event-only Replay) epic; Second Suit / Rank legendary. Limits common but Luck and Focus Cap rare,
Trick Slots epic. The art cap now reads `60cqh - 42px`. Measured: desktop Flow choice 99 x 262 =
154 + 6 + 102; phone Flow 169 / 112; phone Classic 70 / 46 (3-4 description lines, r588 had 2).

## r592 - the two-step score fuse (`js/pmf-merge.js`)
`pmfMergeIn(score, { speed, signal, pips, mult })` fuses in TWO STEPS when the chips' totals are
passed (the dance passes `_finalPips` / `_finalMult`, All Hands its sums; the interrupt handoff
passes none and keeps the one-step look): PIPS and MULT jitter and combine into one chip reading
pips x mult, then that chip and FOCUS jitter and combine into the score; the ghost flies to SCORE,
the row splits back out. Looks (dev -> Aesthetics -> Score merge, `lethe.pmfLook.v1` overrides
only, Preview button runs the beat on the live row): **auto** (hold in console mode, slide
elsewhere), **slide** (the chips move on WAAPI and MELT: a `.pmf-goo` layer behind them carries
blob copies through the SVG `#pmf-goo` filter, blur then alpha contrast, while the numbers
crossfade sharp on top; the fused chip is placed by JS, left / width), **hold** (nothing moves:
the values jitter, PIPS fades and MULT takes the product, MULT fades and FOCUS takes the score in
gold; the ghost is a body-level flier the housing masks), **one** (r157). `pmfFlyToScore` flies
from whatever the look fused on (`_pmfFlyFrom`). `score-merge-preview.html` loads the real file,
the real CSS and the game's score-panel markup; the pit's painted tray and the housing mask are
JS it does not load.

## r593 - event layouts lab, round three: WIREFRAME in the box (owner's pick)
- **Palette** (`EGL_PALETTE`, js/event-grid-lab.js): twelve phosphors with the amber's warmth, written
  onto #egl as `--wf-<name>`; the amber layouts' CSS reads only those. Keywords (`.kw-*`), rarity words
  (`.egl-rar`), suits (`.egl-s-*`: spades cream, hearts coral, diamonds gold, clubs sky, wilds rose) and
  buffs (`.egl-k-<buff key>`) each take the nearest one. Shown as swatches in the lab panel.
- **Entities** are drawn large with no description; the box label names them, so the tile's own name is
  hidden and the icon fills the label with a dark outline (a cream or white pixel icon vanished on the
  Trick's cream label). Pointing at one or tapping it opens the game's own tooltip (`data-et`,
  `showEntityTooltip`). Stacked strips (a phone) put the picture beside its rarity (`.egl-flat`).
- **Typing** (Settings -> Display -> **Text speed**: Normal / Fast (2x) / Instant; `textTypeCps()` in
  js/settings.js, 160 / 320 / 0 characters a second). An element marked by `eglTy(key)` types once
  (`egl.seen`); its untyped text stays laid out but hidden (`.egl-tu`), so the fit pass stays true. A
  live line (a running count) types once and then changes in place. A tap on the board finishes it.
- **One cursor** (`#egl-cur`, zero width, the block hangs off it): with the text while it types, then
  at the end of the prompt until a choice is made, then in the chosen box (CONFIRM on a card screen),
  then the outcome.
- **Card screens** lay out as a 6 x 6 board: words across the top row and a half, cards in the middle
  four columns at a playing card's shape (`EGL_CARD_RATIO` 0.714, `EGL_VIEW_ROWS` 4 rows in view), keys
  in the last half row. Measured at 1440x820: cards 39 x 55 design px, a 6 x 6 board's card. Text cards
  are sized from their own box (container units).
- **Transitions** (lab panel, `eglPrefs.tr`): CONSOLE (default; a command types at the foot, its output
  scrolls the old screen up and the new one in after it) and CUBE (the board turns like a cube), both
  run between two copies of the screens (`eglSnap`; open and close copy the game's own #grid). FLIP is
  r588's. Reduced motion takes FLIP; a room change (slide-off) moves the r588 way.

## r590-r596 - the event tour verdicts (EVENTS.md, "AFTER THE TOUR")
- **Owner's rule, game wide:** describe the mechanic and stop; never explain the consequence.
  One explainer per event screen (an empty flavor line is hidden).
- **Shared pieces:** `evDeckPicker` (js/event-picker.js, every card event picks from the whole
  deck by suit column), `evSlotMachine` (js/event-slot-machine.js, reels + lever), the physics
  `evCoin`, `evDoubleOrFlip`, `EVENT_SKIP` (priced skips), `evOverlayOut` / `evOverlayIn`
  (panel fades, Call It). **Curse cards** (js/boss.js): junk with a debuff (Leech, Smog), cannot
  be played, swapped or discarded, back into the deck after 120s; only Clean Slate removes them.
- Bought Card Market cards wait on the Focus bar (double-tap, ahead of the Reserve). Tricks
  tagged `positional` gate Tray Order. The Investment's boosts and half goal are now read
  (they did nothing before r593). Overtime's boss cost is Tough reviews (+25% boss goal).
- `sfxRewardTaken` (catalog `reward_taken`, every pack) plays when a reward is taken
  (`rewardTransitionOut` with `chosen` or `taken`). Printer notices within `PT_CFG.groupMs`
  (500) of the slip's LAST line join that slip.

## r598 - double scaling: every 15 plays, two ladder steps a grant (owner)
`NS2_DEFAULT` is `multEvery` 15, `pipsEvery` 15, `pipsPer` 1 and a new `multStep` 2: every 15 plays of
a family its cards pay 2 more mult each (card n pays n + 2 per grant) and, separately, 1 more pip each.
`nsFamStep` is rungs x `multStep`; dev -> Hand Scoring has the fourth stepper and the projection now
reads at 15 / 30 / 60 / 90 plays. The store is overrides only, so r554's numbers are gone unless typed.
A same-suit run still credits both families and takes the BEST family's step and pips, not the sum;
each card in it already scores twice (run and flush), so the ladder pays per component.

## r592-r593 numbering, again
The reward pick branch's r592 (no names) and r593 (floppy art), below, ran in parallel with
main's r592-r598 above. The merge that joined them is r599.

## r592 (pick branch) - no names on Tricks, Sleights or Knacks; big icons (owner)
`entityTileInner` (js/entity-tile.js), the live shop's `buildShopTileInner` (js/shop.js) and the board
Sleight card (`sleightFaceHTML`, plus the aim copies in js/render.js / js/card-fall.js) draw no
`.rwd-name` / `.sleight-card-name`. The name is in the tooltip, or printed beside the object by a
screen with room (the pick's `.gp-name`, an event's `.ec-name`). Plain, debuff and card-face tiles keep
their names. Icons (css/style.css): the floppy's label runs 41% to 93% of the disc and the icon fills
it (`--disc` on the tile = the disc's width, 42% of it); the business card's icon is centred, 56% of
the card's width (`--card`), still 3px clear of the top and clipped at it (r587); the knack diamond is
64% of the frame's shorter side (`.reward-cell.entity-knack` is a size container) and its icon 60% of
the diamond (`.rwd-diamond` is an inline-size container; the tray chips use the same rule); the board
Sleight's icon is 0.36 x the cell height, centred. **A reward-grid Trick shows its own icon**
(`buildRewardTileInner`, from `p._trick`); only a tile with no Trick behind it keeps the mystery ✦.
Measured at 1440x820: tray floppy icon 30 design px (frame 72 x 68), board Sleight icon 28.5 in a
68 x 79 cell, pick floppy 82 art box; 420x900 tray 14-16, board 15. No name element on any of them.

## r593 (pick branch) - the owner's floppy art (`js/floppy-art.js`, `assets/art/floppy/`)
A PNG in `assets/art/floppy/` replaces the CSS-drawn Trick disc: `common.png` / `rare.png` / `epic.png` /
`legendary.png`, and `floppy.png` for a rarity with none. Nothing lists the uploads, so the five files are
requested once at load (`floppyArtProbe`); each found sets `--fa-<rarity>` (absolute url, like
`--px-sheet`) and `html.fa-<rarity>`. css/style.css then paints the disc's `::before` as
`var(--bands), var(--fa) center / contain` (no notch clip, no painted edge): same 20:19 box, so the icon
stays on the label (padded box 40,166 to 360,345 on 400 x 380, drawn in `_guide.png`). Art 64px wide or
less sets `html.fa-pix` (pixelated). Dev -> Aesthetics -> Floppy art switches back to the drawn disc
(`lethe.floppyArt.v1`, stored only when off) and says how many files it found. `_template.png` is the
drawn disc at 400 x 380; files starting `_` are never loaded. The owner uploads straight to main on
GitHub (the folder's README says how). Verified with a test `floppy.png` (removed before commit): the
pick, the tray and the reward grid drew it, icons on its label, no page errors.

## r600 - light icons outlined; event names and card marks (owner)
- **Light pixel icons** (cream and white rows, 23 of 133): `tools/icons/build.js` now also writes
  `PX_ICON_LIGHT` (rows whose palette colour has luminance >= `--light`, 0.65) into js/data/icons.js;
  `emGlyph` tags them `.px-light` and css/px-icons.css gives them a dark outline one sheet pixel wide
  (`.0625em`, four drop-shadows), everywhere. Darker icons are untouched. The tool reproduced the
  shipped sheet byte for byte before the change; the sheet itself did not change.
- **Why The Woodpecker and The Cuckoo look alike:** 27 Tricks are in no `TRICK_CATEGORIES` row, so
  `trickEmoji` gives them the fallback ✦, drawn as the white sparkles icon. Owner to decide.
- **Event lab, WIREFRAME entities:** the box has no label (its border closes); the name is printed
  just above the picture (`.egl-enw` / `.egl-en`, 16px VT323, two lines kept so the pictures line
  up, clamped at three with an ellipsis). Measured at 1440x820: all 169 live Trick names take one
  or two lines (132 / 37) and no word is wider than the box.
- **Event cards wear the game's marks** (`eglCardMarks`): `cardBandsHTML(card, inkOf)` takes an
  optional ink chooser (geometry unchanged) and the lab passes palette inks (`EGL_BAND_INK`: pips sky,
  mult coral, rewind cream, pause sage, replay mint); x marks, the curse badge with its count (and
  the card's sage glow), Fodder, the coin ring, the scaling arrow and a card state are drawn where a
  card draws them. Text cards are laid out like the face (rank 24%, suit 29% of the height) so the
  corner marks fit. A deck card shows marks only; pointing at it or tapping it prints its buffs and
  curse in the top box (`eglHover` now also runs on card screens). Container units on a container
  resolve against its ANCESTOR: spacing inside the card is on its children.

## r601 - the owner's floppy art, fitted (`assets/art/floppy/`, `js/floppy-art.js`)
The first upload was named `common v1.png` / `rare v1.png` / `epic v1.png` / `mythic v1.png` and
drawn shutter-down. Renamed to the loader's names (`mythic` is `legendary`) and turned 180 degrees
(lossless, pixel for pixel). The art is 109 x 120, so `FLOPPY_ART_PIXEL_MAX` is 128 (was 64) and it
draws sharp. A portrait file letterboxes inside the 20:19 disc box (`contain`); the icon box still
lands on the body below the shutter. The folder's README says to rename before uploading and to
keep the shutter on top. Verified at 1440x820: Flow Tricks pick, tray, reward grid, shop; no page errors.

## r604 - every Trick has a category icon (owner)
`TRICK_CATEGORIES` (js/data/tricks.js) only picks a Trick's icon. Owner's rule: effect decides, but a
theme in the NAME wins. 26 Tricks had no row and drew the fallback white sparkles. Now: **birds**
(🐦, game-icons `lorc/sparrow`, brown) are every bird name: The Swift, Cuckoo, Woodpecker,
Hummingbird, Albatross, Vulture, Phoenix, plus Early Bird, Night Owl, The Heron, Eagle Eye and The
Kingfisher moved off the stopwatch (Hyperphagia and Traveler were birds once, renamed, and stay).
**3️⃣ / 4️⃣ / 5️⃣** (`badges/number-N`, orange): 3rd Down, Ready Set Go / Four Eyes, 4x4, Four
Horse-man, Wait Four It / Five Stack, Five for Fodder, Five Second Rule, the little guys. **🪄**
(`magic-hat`, violet; 🎩 is already Old Tricks' and The Ringer's top hat): Magician, Scalper.
Into existing rows: Release Valve, Life Lessons, Wellspring (🎯); Old Growth (🌱); Stand-Up, Double
Jeopardy (📍); Landfill (🗑️, shares the Hoarder's trash can). Sheet rebuilt: 138 icons. No live
Trick is left without a row; no Trick is in two.

## r605 - pixel icons on a 32px grid (owner)
`tools/icons/build.js` defaults to `--size 32` (margin `SIZE / 16`, so 2); the sheet is 4416 x 32
(138 icons, 54 KB). Nothing else assumed 16: the tile CSS sizes icons in em (`background-size: auto
1em`), and the light icons' outline is now one sheet pixel from `--px-cell` (1 / `PX_ICON_SIZE` em,
written on `<html>` by js/px-icons.js). Owner's reasoning, measured: a desktop tray icon is ~58
screen px, so a 16 grid gave 3.6 screen px per block (chunky, detail lost), 32 gives ~1.8 (still
reads as pixels, much clearer), 64 would be ~0.9 (no visible pixels). Verified at 1440x820 and
420x900 (DPR 3): tray, event Free Pick and phone strips draw the new sheet, outline 1 sheet px.

## r606 - double-tap a marked challenge cell; double-tap the clock's skull (owner)
- **Challenge now** (`crTeleNow(r, c)`, js/challenge-round.js): a double-tap on a cell a challenge
  warning marks (Flow, spot, or a challenge round's pulse) lands the card at once through `crLand`.
  Caught in `onCardTap` above the Sleight and swap branches, so it beats a double_tap Sleight in the
  cell and the swap lift; the card there can still be swapped as the second card, or with two
  selected and SWAP. The first tap's selection change is undone (`_dtBefore`). The first two
  warnings of a run say so.
- **Skip to the boss** (`js/boss-jump.js`, `css/boss-jump.css`): Flow only. A double-tap on the
  clock's skull (`bindClockBossPeek`, js/boss.js; the first tap opens the peek, which now says so)
  drains the session clock and ends in `flowTriggerBoss`, as 0:00 would. The round tick is stopped,
  so the skipped seconds run nothing; a pause or Stopwatch on the clock is let go. The last
  `BOSS_APPROACH_CFG.warnSeconds` drain at `BOSS_JUMP_SPEED` (8x) so the approach count shows;
  seconds above them drain in at most `BOSS_JUMP_FAST_MS` (1.5s), so 5:00 takes ~2.8s. Every
  document animation runs at 8x for the drain (`bossJumpSpeedAnims`, playbackRate, restored after),
  the heartbeat reads `bossJumpPace()`, and `#bj-osd` (a child of #grid: the VCR's two-triangle
  mark and a rolling tracking band) is drawn over the board. Sound `sfxBossJump(sec)` (js/audio.js,
  catalog `boss_jump`, returns a stop function). Refused (`refuse`) while the board is busy or the
  clock is stopped. While it runs, `bossJumpRunning()` blocks onCardTap, the grid's pointerdown,
  playHand, doDiscard, doSwap and the Focus bar; the pause menu (`isPaused`) holds it.

## r607 - Stretch is ORNERY: corner cards score x2 mult (owner)
Trick `two_corners` (id frozen), epic. Was "2+ corner cards in a hand: each corner card x4 mult",
applied as one lump in the hand-level x mult block. Now every card in a corner cell scores x2 mult
(`BAL.two_corners.mult_mult` 2) with no count needed, as a per-card x mult in calcScore's card loop
(`_xl`, beside Rainbow), so it fires on the card's beat, once per replay; ghosts and wilds don't
fire it. Pick order matters like any per-card x mult: three Kings with the corner picked first
mult 7, picked last 12 (no Trick: 6). Played through PLAY in Classic: no timeline drift.

## r608 - Encore: odd-ranked cards in a set replay once (owner)
Trick `encore`, epic. Was "a set hand made only of odd-ranked cards replays every card". Now each
odd-ranked card (A 3 5 7 9, `_rankIsOddRank`) that sits in a SET component of the hand replays once,
whatever else the hand holds (`_encoreCells` in calcScore: the cells of `_comp`'s set-family
components; with no component list, the whole hand if `handName` is a set). An odd card in a run
layered on the set, a kicker, a wild and every even card get nothing. Still one QRL replay source
('enc'). Measured: 7 7 8 8 replays the 7s only (reps 2,2,1,1); 9 9 9 all three; 5 6 7 nothing.
Played by tap at 1440x820 and 420x900: no timeline drift.

## r609 - On the Edge pays per card on an edge (owner)
Trick `edge_pips`, common. Was "+15 pips per card when EVERY card of the hand is on an edge". Now
each scored card in an edge cell (top / bottom row, left / right column; `isOnEdge([at])`) scores
+15 pips (`BAL.edge_pips.pips_per_card`), whatever the rest of the hand is. It stays a
`PER_CARD_PAYERS` row (replay-weighted, fires on the card's beat); `pays` now takes the card's cell
as a third argument (`pays(card, x, at)`), passed to the ghost check too, so a dual card's ghost
does not pay it twice. The hand-level `onEdge` field is gone. Measured on a 4x4: three Kings down
column 1 from the top pay +15 (one edge card); three Queens on the top row and right column pay +45,
a two-suit Queen among them once. Played by tap at 1440x820 and 420x900: no timeline drift.

## r610 - score chips, tally speed-up, bands on the floppy art (owner)
- **Chip size by layout:** `ptPlateEl` multiplies by `ptOrientScale()`: `DANCE_CFG.pScaleLand` 1.25 on
  `#stage.landscape` (desktop), `pScalePort` 0.9 in portrait. Base plate 46px -> 57.5 desktop, 41.4 phone.
  Every plate (dance, payout fx, challenge penalty) goes through it.
- **Growth 15% less:** `PARTICLE_CFG.growStep` 2.5 -> 2.125 (40 payouts: x2.09, was x2.37; ceiling x3
  unchanged). Dev store is `lethe.blipGrow.v3`; a v2 store is carried over once with its growStep x0.85
  and removed. Reset reads `BLIP_DEFAULTS` (the shipped values, kept before any store is laid over).
  particle-preview.html matches (default 2.125, slider step 0.125).
- **Tally speed-up 20% gentler:** `DNC_ACCEL_STEP` 0.05 -> 0.04 per payout (8x ceiling at 54 payouts, was 43).
- **Improvement bands on the owner's floppy art:** the art (109 x 120) is drawn `contain` in the 20:19 disc
  box, so it is 86% as wide and the bands, laid over the whole box, hung off its left edge.
  `floppyArtBandBox(ratio)` (js/floppy-art.js) writes `--fa-<rarity>-bs`, the art's drawn box as a
  background size; the bands layer is sized to it (`--fab`), so they cross the art's own corner.
Measured by tap at 1440x820 and 420x900: plates 57.5 / 41.4px, pace after 6 payouts 1.265 (was 1.34),
no timeline drift; tray screenshots show the bands inside every disc at tiers 1, 2, 3 and 5.

## r611 - two pairs are a Two Pair; the preview names (owner)
**The bug:** under the card ladder (the default since r553) `_bestRankPartition` still chose by the sum of
table mults (`handWorth`), and Pair 2 + Pair 2 beat Two Pair 3, so every two-pair hand was split into two
Pair components: primary Pair, label "SET OF 2 x2". Two Pair was never played, a Two Pair challenge could
not be met (`crOnHand` matches the primary name) and Aftershock ("Two Pair scores x2 pips") never fired.
Full House was not affected (Three 3 + Pair 2 ties Full House 5 and the whole hand wins the tie).
**Fix:** `handComponentsFor`'s `buildFrom` merges the first two Pair components into one Two Pair
(`rankHandForGroup` of their cells must say Two Pair) when `scoringModel === 'card_ladder'`; a scored
hand's base is 0 there, so the score is unchanged (7 7 8 8: 300 either way). Classic already prices Two
Pair above two Pairs and is left to the partition. The comp cache key now carries the scoring model.
**Labels** (`HAND_LABEL`, `handLabelHTML`): Pair reads PAIR (no size line), other sets SET OF N, a
repeated set "2 SETS OF 3"; other repeats keep x2 (RUN OF 3 x2). Measured: 77 PAIR, 777 SET OF 3,
7788 TWO PAIR, 77788 FULL HOUSE, 777888 2 SETS OF 3, 7788KK TWO PAIR + PAIR. A real 7788 played by tap
(1440x820, 420x900): preview TWO PAIR, `crOnHand` received "Two Pair", no drift.

## r612 - Classic: more improvements with a full Trick tray; improved art repaints at once (owner)
- **Improve tiles x1.5** (`rewardImproveBoost`, js/reward-grid.js, from `makeBuff`): in a Classic-shaped
  run (`isActMode()`, not Guided, not the Schedule) while `trickTrayFull()`, the improve rows of the
  reward / prize grid table are scaled so the CHANCE a tile is an improvement is `IMPROVE_FULL_TRAY_MULT`
  (1.5) times the table's (raising the weights 1.5x would only give x1.43). Dev -> Probabilities,
  "Improve tiles, Classic with a full Trick tray". Measured on a 4x4, past the first 5 grids, 4,000
  grids each: owning only Tricks 3.2% of buff tiles -> 4.8% (grids with one 20% -> 29%); with an
  improvable Knack and Sleight 8% -> 12% (44% -> 59.5%); a free slot unchanged (8.3%). An improve_knack
  / improve_sleight tile with nothing of that type to improve still falls back to a Trick, which is
  why owning only Tricks gives so few.
- **Art follows the tier** (`improveRepaintArt`, js/improve.js): `improveEntity` and `downgradeEntity`
  repaint the Trick tray and the Knack strip (one microtask, so a multi-step grant paints once). Only
  the reward grid's improve tile used to repaint; the shop, events, Flow's improve step and the Review
  state left the old bands and badge up until something else redrew the tray. A Sleight on the BOARD
  draws no tier bands at all (only its tiles do); not changed.

## r613 - board Sleights wear their improvement bands; full-tray improvements x2 (owner)
- `sleightTierClass(def)` (js/sleights-runtime.js) gives the board card the tile's `tier-N`
  (render.js and card-fall.js); the band rules are `:is(.reward-cell, .trick-card.sleight-card).tier-N`
  and the board card's `::before` paints `var(--bands, none), var(--sl-body)`, so the stripes cross
  the business card's bottom-left corner as on its tile. Aim Sleights (no card body) are left out.
  `improveRepaintArt` also runs `sleightBoardRetier()`, which rewrites the class on the board's
  Sleight cards in place (no render(), safe under a takeover). Measured at 1440x820 and 420x900:
  tiers 1/2/3/5 drawn, the class changed on the next microtask with no render() call.
- `IMPROVE_FULL_TRAY_MULT` 1.5 -> 2. Measured (4,000 grids, 4x4, past the first 5): Tricks only
  3.2% -> 6.2% of buff tiles (grids with one 20% -> 36%); with a Knack and Sleight 8% -> 16%
  (44% -> 70.7%); one slot free unchanged (8%).

## r614 - Focus speeds animations 2x at most; the Woodpecker marks a cell
- `caFocusPace` (js/card-anims.js) is capped at `CA_FOCUS_PACE_MAX` (2): the score tally (`tally2`)
  and the card looks / flights (`focus2`) never run more than twice as fast from Focus. With the
  default 1.5 at Focus x2 the cap is reached at Focus x3 (it used to reach 2.5x at x4).
- **The Woodpecker marks a CELL** (owner): `woodpeckerCell` ('r-c', in SAVE_VARS; replaces
  `woodpeckerCardId`). Every `interval_seconds` a random cell holding a card that can score is
  marked; the mark stays when cards fall or swap, whatever card scores from that cell replays
  `retrigger_count` times, and that hand spends the mark. Ring, cooldown widget and description follow.

## r615 - challenge rounds: a cleared tier stays done (owner)
Bug report: in Classic, clearing a challenge's first tier but not the raised one still gave the
penalty grid. Two causes in js/challenge-round.js: `crOnClockOut` un-counted a raised card that
had not reached its tier (`solved--`), and the next card only arrived when a card LEFT the board,
so a raise held cards 2 and 3 back until the clock ran out. Now a raised round card that falls
short at clock-out is marked lost (its banked payout is lost) but stays counted, and `crRaise`
sends for the next card at once (`q.sentNext`, so `crDrain` does not send a second one when the
raised card leaves). Superseded in r465's notes: "then it no longer counts". Measured in Classic:
card 1 cleared and raised, card 2 arrived ~1s later; cards 2 and 3 solved; clock out with the
raise open ended through the interlude with 3/3 solved and no penalty grid.

## r616 - challenge rounds: a missed raise fails again; the next card comes at the first clear (owner)
Owner: a raise you do not make IS a fail (r615's "stays counted" is reverted: `crOnClockOut` un-counts
it, as before). The bug was that a raise you DID make could still fail the round: the next round card
was only sent when a card LEFT the board, so the take-or-raise pause (6s), a raise and the hold after a
made raise all ran down the clock before cards 2 and 3 could even arrive. Now `crAdvance` sends for
the next card the moment a card first counts (`q.sentNext`; `crDrain` sends only for a card without
it). Measured in Classic: card 2 landed ~4s after card 1's first clear (0.7s + the 3s pulse) with card
1 still waiting; raise made + cards 2 and 3 solved -> ended through the interlude, 3/3, no penalty;
raise missed -> 2/3, lost (penalty grid).

## r617 - the full-tray boost doubles only Trick improvements (owner)
`rewardImproveBoost` now scales only the `improve_trick` row (exact-chance scaling as before), so in
Classic with every Trick slot full an Improve a Trick tile is `IMPROVE_FULL_TRAY_MULT` (2) times as
likely and Knack / Sleight improvements keep the table's rate. Measured (4,000 grids, 4x4, past the
first 5, owning an improvable Knack and Sleight): Improve a Trick 3.0% -> 6.2% of buff tiles, Knack
2.2% -> 2.2%, Sleight 2.5% -> 2.3% (noise); any improvement 7.7% -> 10.7% of tiles, 44% -> 55% of grids.
Owning only Tricks: 6.2% of tiles, 36% of grids (unchanged from r613, since only Trick improvements
could appear there).
## r618 - dev panel search on a desktop keeps the tab menu (owner)
At `DEV_SEARCH_WIDE_MIN` (900px) and up, a search widens the panel (`#dev-panel.dev-search-wide`,
1080px) and lays the tab menu as a column left of the results, both scrolling on their own. A tab
holding found sections is lit with their count (`data-hits`, `.dev-tab-hit`); the rest are dimmed
(`.dev-tab-miss`). A tab click opens it and leaves the search as before. Narrower windows keep the
results alone; a resize across the line relays the live search. Measured at 1440x820: menu column
200px, panel 1080; 420x900 unchanged.

## r619 / r621 - Flow reward count: 33 / 34 / 18 / 10 / 5 (owner)
`FLOWR_DEF.counts` (js/flow-rewards.js) is the chance of 1 / 2 / 3 / 4 / 5 rewards at a Flow
level-up; was 38 / 42 / 10 / 6 / 4 (r619 briefly 35 / 35 / 18 / 9 / 3). More than one reward is
67% at the base (was 62%), three or more 33% (was 20%). `flowEcon.multiStep` (10) still adds to that per single-reward level-up in a
row. The store is overrides only, so a browser that typed this row keeps playing the same.
## r620 - the Trick tour and the Trick balance sheet (`js/trick-tour.js`, `tools/trick-sheet.*`)
- **Trick tour**: `index.html?tricks` (common; `?tricks=rare|epic|legendary|all`; dev -> Bonuses -> Add
  Trick has the buttons). Like the event tour: a Classic run, walkthrough ended, the round goal put at
  1e12 so the round never ends, one Trick at a time alone in the tray, score zeroed per Trick, hands
  played for real. The panel shows the tile, the live description and **every number the Trick has in
  BAL as an input**: a change writes `BAL_BASE` and runs `applyEntityTiers()` (the one sanctioned
  write), so the next hand scores with it and the text reads it. Numbers, KEEP / EDIT / CUT and a note
  persist per Trick in `lethe.trickTour.v1` and are re-applied at the tour's start; COPY ALL prints
  verdicts with `key old -> new`. CLOCK: HELD / RUNNING (`gameTimerPaused`; Tricks in `CLOCK_IDS`
  start running), REFILL (score, Focus, stock, clock back to the round's start); a running clock is
  topped up before it hits 0. `OFF_BOARD` lists what the board cannot show (More Better, Sapling...).
- **Sheet**: `node tools/trick-sheet.js common` dumps the tier through the sim harness (live
  descriptions, BAL numbers, templates, tags); `python3 tools/trick-sheet.py <json> --out X.xlsx
  [--audit report.csv]` writes one row per BAL number with yellow NEW VALUE / Verdict / Notes columns, an
  x-factor formula, and the Trick audit's measurements matched by name (share of score, x on a hand,
  fires %). The r622 run: `tools/sim/out/trick-audit-r622.json.gz`, card ladder scoring, 6 deals x 40 grids.
- The sim harness now defines `URL` / `URLSearchParams` (js/px-icons.js built the icon sheet url at
  load and every sim had failed to load the game since r583).

## r623 - the owner's common Trick balance pass (from TRICKS_COMMON.xlsx)
Numbers in `BAL` (js/data/balance.js), descriptions regenerated; `DESC_TEMPLATES` added for every
common Trick the sheet touched, so an improvement prints its number. Plain raises: Cascade 20, Storm
10, Tidal Forces 15, Nimble 30, First Light 42, Face Value 20, Men of Repute pips 10, Rich Soil 3, Early
Bird 20, Night Owl 10, Quick Draw 3s, Tick-Tock 4, Second Hand 30 / 20, Kindling 8, Get Even 16, Right
Place 25, Middle Management 8, Compost 4, Combo Score 6, More Better 9, Cull 2, Ready Set Go 18, Four
Eyes 24, Shaky Foundation 18, Wave Amplification 15. Numbers that lived in code are BAL rows now:
`rowcol_mult.mult` 15 (Power Line), `tunnel_vision.focus` 10, `rhythm.focus` 2. Mechanics:
- **Magician**: `solo_pips` 50 while it is the only Trick in the tray (`magicianSolo()`, hand-level
  pips), else `mult_per_sleight` 6 per Sleight; one or the other, never both.
- **Five for Fodder**: any VALID hand discarded (`realHandOfSize(selected, selected.length)`) pays its
  size x `credits_per_card` (1); the 5-card rule is gone.
- **4x4**: pips 24 on the 4th AND the 6th column. The 6th is a second registry line
  `{ id:'four_by_four', index:5, _fixed:true }` that `clampRowColBonuses` leaves alone, `renderLineMarkers`
  does not draw on a narrower board, and `fourByFourCols()` (replaces `fourByFourCol`) pays only when
  `gridCols` reaches it. Measured: lines [3, 5f], cols [3] at 4 wide and [3, 5] at 6 wide, one line drawn.
Measured by tap at 1440x820 through the Trick tour: Cascade +20 x3, Power Line +15 per card on its
line, Magician alone +50 pips then +12 mult beside Rich Soil with two Sleights, a 3-card hand discarded
under Five for Fodder paid +3 credits, a real hand played with no timeline drift. TRICKS_RARE / EPIC /
LEGENDARY .xlsx + .csv at the root are the other tiers' sheets (owner: "make the sheet for the rest").

## r624 - the owner's rare Trick pass (from TRICKS_RARE.xlsx)
- **Numbers:** Quake 15, Resonance 4, Ripple 66%, Full Load 20, First Fruits 5, Eagle Eye 10, Swift 6,
  Woodpecker 3x, Hummingbird 3, Albatross 10, Quarter Chime 60, Kingfisher +2 per 2s, Balance 10, Lucky
  Sevens 5, Prime Time 29, Odd One In 7, Diversity 8, Study Hall 2, Inclusive 50, Lie Down 12, Rising
  Tide 5-10, Flow State 15, Stand-Up 10. **Rarity:** Release Valve, Every Day Essentials and Near
  Extinction are common; Kaleidoscope is epic. **Sapling** is retired (never offered; a saved run keeps it).
- **Custom improvement ladders** (`IMPROVE_PLAN` in js/improve.js, a function of the tier that writes
  over the pristine row; such an entity takes no generic step): Ripple and Echo Location gain a SECOND
  replay chance (`chance2`: 33 / 44 / 55 / 66%, rolled only after the first replay lands, salts 7727 /
  7929; the 5th sets both chances to 77%); Release Valve cycles +1 swap, +1 discard, -4 Focus lost (5th:
  all three); First Fruits alternates +5 pips and one more hand (`hands`; 5th both); The Swift alternates
  +2 mult and -2s (5th both: +12 every 4s); The Woodpecker +1 replay a tier, +2 at the 5th. Plain steps
  added to `IMPROVE_STEP`: Full Load +10, Resonance +2, Heron +0.5, Head Start +1, Quarter Chime +30.
  `fillDescTemplate` takes `[[key:text]]` (kept while the number is > 0) and `[[key>N:text]]`, for the
  second-chance clause and plurals.
- **Mechanics:** **The Heron** adds `mult_per_second` x the whole seconds since the last hand this round
  (`heronMult()`, js/scoring.js; the preview line and the tray's live line read it). **Resonance** pays on
  any hand with a Pair / Two Pair / Full House component that holds a 2 or a 4. **Kaleidoscope** applies
  Focus once per suit in the hand (`focusExtraApplies` adds suits - 1). **The Woodpecker's** mark is never
  spent; a cell stays marked until the interval moves it. **Crossroads** pays +25 mult as well as Focus.
  **Perfect Ten** counts cards played as well as discarded (`cardsScoredTotal + cardsDiscardedTotal`, at
  the discard sites and in `scalingCount`). **Plan Ahead** pays `times` (2) x the average. **Rogue Wave**
  verified: a run tapped in order, up or down, qualifies; out of order does not.
- **Chance counts** (`js/chance-count.js`, `css/chance-count.css`): a chip in `CHANCE_TRICK_IDS` (Ripple,
  Echo Location, Wait For Iiiit, Even Better) wears a gold count of its procs from the last calcScore
  (`_lastHandProcs`): the preview's while a hand is selected, the banked hand's from PLAY (playHand is
  wrapped; `handsPlayed` rising marks a real hand) through the tally (`danceAbortController` up) and
  `CC_HOLD_MS` (3s) after; a new selection or hand replaces it. Painted from render's tail and a 250ms tick.
- **Offers** (`offerWeightMult`, js/luck.js; `TRICK_NEEDS`, js/data/tricks.js): a Trick for a hand size
  above the Selection Size, or a flush before flushes unlock, is offered at `OFFER_NEED_W.unplayable`
  (50)% of its weight within its tier (dev -> Probabilities, "Tricks for hands you cannot play yet").
  `pickEntityByRarity` picks within the tier by that weight now (`offerWeightedPick`).
- The preview's Cascade and Storm lines read BAL (they typed 10 and 2).
Measured in headless Chromium at 1440x820 through the rare tour, dev mode on: every ladder's six tiers
print and apply; Rogue Wave A Q K up and down true, mixed false; a crafted pair of 2s paid 13 more Focus
than a pair of 7s; Heron +10 / +12 mult after the wait; Woodpecker mark 1-1 before and after the hand;
Perfect Ten +6 mult at the 18th card; Kaleidoscope 3 suits -> 2 extra applies, 1 suit -> 0; Ripple's
badge read 2 on selection, through the tally and for 3s after; no drift, no page errors.

## r625 - the owner's epic Trick pass (from TRICKS_EPIC.xlsx)
- **Numbers** (BAL, templates for every epic id so improvements print): Tide Table x1.25 +x0.5,
  Undertow x2, Rerun x1.25, Portfolio +x0.25, Collapsing Columns 15, Double Dutch 20, Ley Line +2,
  Hands of Blue +24 mult +16 Focus, Clean Sweep 8 / 4, Acorns 0.025 (**rare**), Royal Favour 30s,
  Heartwood +5 / +5, Landfill +5 (**+3 in Flow**, `mult_per_flow`), Four Horse-man 24 / 24 / 8 / 8s,
  Even Better x2.25, Critical x5, Threepeat 9s / +27 / +9 **or all three** (`all_chance` 20%, silent),
  Blood Diamonds +25 mult as well, D6 pips **or mult** (coin flip), Encore **common**.
- **Knacks now** (same ids, `retired:true` on the Tricks, KNACK_POOL rows): **Move as One** (2+ Tricks
  share a keyword; a random one fires again each time ALL of them fire), **Rain Check**, **Wait For
  Iiiit** (in Flow: +5% per level-up that paid a single reward, `flowrSingleRewards` in SAVE_VARS,
  Luck-free). `hasTrick || hasKnack` at every Rain Check read.
- **Temporal Rift is new**: a card scored where a row and a column effect intersect FORCE-TRIGGERS the
  Trick in tray position 3 (through `forcedTrickIds` / `trickCanForce`, once per replay, +`chance_extra`
  per improvement for a second trigger). The old +3s rewind buff is gone.
- **Custom ladders** (`IMPROVE_PLAN`): Inspirato alternates +1 prime and a rolled extra rank
  (`_heartRanks`, `rollExtraRanks`); Double Jeopardy +10s a tier and primes a random Trick from the 3rd;
  Hourglass alternates +10% and -10s; Blood Diamonds cycles credits / mult / seconds; Threepeat doubles
  one payout a tier (5th: all three, all_chance 35%); Perfect Timing a second replay chance 33% a tier
  (over 100% = a sure second and the rest a third; 5th marks a second line, `perfectTimingExtraLine`,
  `_fixed`); Hands of Blue +8 mult / +4 Focus; **Straight Shot** improves twice: the 1st jumps to tier 3
  (buffed pip values count), the 2nd to tier 5 (any 5-card hand spanning 6 rows + columns, `lineSpanTotal`);
  Clean Sweep +4 Focus / +4 credits; Cloud Nine +3 9s and +2 mult a tier (`cloudNineAddNines`), 5th never
  deletes itself (`no_delete`); Dark Matter 1st = clubs or spades, 2nd-4th +x0.5 on the time, 5th = any
  hand with a spade or club (`suits` 0 / 1 / 2); Temporal Rift +3% a tier; Heartwood alternates +10
  pips / +10 mult, 5th both + a secret second cell (`heartwoodExtraCells`, SAVE_VARS, rolled per level);
  Four Horse-man doubles one payout a tier, 5th pays 2 of the 4 (`fourHorsemanPicks`); **Undue Influence**
  improves once, straight to tier 5 (also pays the face-card count); Patient Rulers +0.75, 5th adds 3
  rolled ranks (`_prRanks`); Even Better alternates +11% / +0.4, 5th evens replay; What are The Odds
  +0.35, 5th odds replay; Critical +1, 5th adds a rolled family (`_critFamily`); Twinners +1, 5th sets
  replay; Marathon +1 apply / flushes / sets; Kaleidoscope +N applies; Landfill +5 / +3 a tier.
  **`IMPROVE_HOOKS`** run from `improveEntity` (tier jumps, rolls, deck adds). Plan values are rounded
  to 3 decimals.
- Per-card replay sources added to `_srcs` for QRL: `evb`, `wod`, `twn`; a second Perfect Timing
  replay is `pt`'s count. The Vulture only skips cards already holding its pause.
- `fillDescTemplate` nests one level: `[[k>N:...[[k<M:...]]]]`.
Measured in headless Chromium at 1440x820 through `?tricks=epic`, dev mode on: every epic ladder
improves to tier 5 (Straight Shot in 2 steps, Undue Influence in 1, Cloud Nine added 15 9s, Perfect Timing
added a line, Inspirato / Patient Rulers / Critical rolled their ranks and family); Temporal Rift with a
row and a column mark on a card forced Quake once (527 vs 186 unforced) and played with no drift; Dark
Matter 173s all spades / 0 mixed, tier 1 clubs+spades 173, tier 5 with a heart 432 (x2.5); Four Horse-man
picks 1 then 2 of 4; Marathon 1 / 2 applies then flushes, sets at 5; Kaleidoscope 2 -> 4 at tier 2;
Twinners tier 5 scored 6451 vs 605; five real hands through PLAY, no drift, no page errors.
## r626 - Builds: the object, the keyword axis, the phone rail (`js/builds.js`)
The main menu's BUILDS browser (the Procurement Catalogue, r230s; HISTORY.md "Definitions open on a
+") printed a raw emoji per record, so it stopped matching the game at r583. Each record now leads
with `entityTileHTML` in a 46 x 58 box (`.bv-tile`; 30 x 38 zoomed out): the floppy with the owner's
art, the business card with its charge count, the cert diamond, each with its pixel icon. No id is
passed, so no tier stamp or bands (a run's property, not the catalogue's). The rail's minis are the
same tiles. Events keep a glyph. **Keywords:** `broad: true` on KEYWORD_DEFS rows hand, score, play,
round, time, grid (a third of the 286 live records mention "hand"); `buildKeywordsOf` skips them for
grouping and filtering, tooltips still colour them. The filter panel lists keywords in
`BUILD_KW_FAMILIES` order (scoring, clock, actions, hands, board, things) with a live count each,
hiding any no record mentions; keyword clusters on the canvas sort by family then size, the
leftover bucket reads GENERAL. "clock" joined the time terms (46 descriptions said it uncoloured).
The "files open" count is taken over the pools, not the clusters (it read 920 / 920 under keyword
grouping); retired Tricks are not catalogued (317 records). Under 700px wide the rail is a drawer
behind a DRAFT button in the bar (`.rail-open`), the zoom controls hidden. Still unbuilt:
`isRequisitioned` has no reader, so FILE WITH PROCUREMENT flags nothing in a run.

## r627 - the improvement animation; FAST FORWARD; the notice drawer (owner)
- **Improvement animation** (`js/improve-anim.js`, `css/improve-anim.css`): an improved Trick (or
  Knack / Sleight) comes to the middle of the board as a stack of the real entity tile at every
  tier, the new tier's band comes in on its corner while the sentence under it changes (changed
  numbers are marked by the `improveDeltaHTML` rule: same sentence, numbers differ), then it goes
  back to the tray (`trayFxKick 'in'`). Looks (`iaCfg.look`): **lift** (default; rises from the
  chip on an arc, the band wipes in from the corner behind a bright edge, numbers roll like a
  counter), **stamp** (pops up at the centre, the band is slammed on with a shake and a ring, the
  old number struck and the new stamped), **flip** (slides in, turns over, the new tier is on the
  back, the sentence slides). `improveEntity` QUEUES (`improveAnimNote`; a many-tiered grant is
  one scene with a step per tier) and `improveAnimFlush()` plays the queue: on its own a moment
  later, or at the END of a sequence that holds it (`improveAnimHold`: the reward grid's confirm
  awaits it after every tile; Flow's improve step waits before the next step, `flowrAfterImprove`).
  **FAST FORWARD** (`#ia-skip`, top centre of the stage, or Escape) ends the whole sequence.
  Layer `#ia-layer` is body-level over the stage, zoomed, so everything inside is design px. Dev
  -> Aesthetics -> Improvement animation: look, speed, tile size (% of the board), hold, Preview
  and Preview 3 tiers (`improveAnimPreview(n)`, plays without improving). Store
  `lethe.improveAnim.v1`, overrides only. Off for reduced motion / skip transitions.
- **Notices over the change hang longer**: a printer line printed while the animation runs holds
  `PT_CFG.overChangeHold` (1.6x) its usual time (`line.holdMul`).
- **The paper corner and the drawer** (`js/print-toast.js`): the printer layer exists from load.
  `#pt-tab`, a folded corner just right of where slips hang, peeks out when the mouse is within
  `PT_CFG.tabZone` (36px) of the top edge (a touch screen shows it faintly all the time); a click
  or a `tabDrag` (28px) drag down opens `#pt-drawer`: one slip of the last `drawerLines` (14)
  notices, newest first, printed lines in their ink and quiet `noteMessage` lines dim
  (`ptHistory`, filled by printToast and noteMessage). A click anywhere, the corner, Escape or a
  new notice pulls it back. A tap on a hanging slip still pulls it (r510).
Measured in headless Chromium at 1440x820 (and 420x900): the tile lands centred on the board box
(984 vs 984) at 42% of it; all three looks play and end with the layer off and the chip back; a
3-tier preview skipped by FAST FORWARD after 1.5s ended in 1.9s; a notice printed during it holds
1.6x; a real `improveEntity` played and the chip redrew with its band; the corner peeks at 12px
from the top, opens on click and on a 50px drag, closes on a click elsewhere and on a new notice.

## r625 numbering, again
The reward pick branch's r625 (below) ran in parallel with main's r625-r628 above. The merge
that joined them is r629.

## r625 (pick branch) - reward grid tiles: bigger Tricks, pixel corners (owner)
The reward grid's own tiles carry `.rg-tile` (js/reward-grid.js), so the shop and Guided tiles that
share `.on-grid` are untouched. **Tricks** take `--dz: 1.12`: the disc's width is one variable now,
`--disc` = min(frame) x `--dz` (default 1), read by the disc, its label, its charge count and the tier
stamp's letterbox (`--lbv` / `--lbh`, css/entity-fx.css, equal to the old values at 1). Measured: disc
68.3 in a 61 content box at 1440x820 (61 before), 60.5 in 54 at 420x900; the frame has no box of its
own, so the disc uses the padding. **Every other tile but the Knack diamond and the Sleight card**
has no border and no radius: its fill is `::before`, `background: var(--rbg)` (each tile kind now
sets `--rbg`), clipped to a stepped pixel rounded rect (`--pxc`, three `--pxs` 2px steps a corner).
The tile itself is not clipped, so a selected tile's ring is chained `drop-shadow`s of that fill
(white, then violet, then the glow), which follow the steps; the wash is clipped the same way. The
prize grid's gold ring is a drop-shadow glow on those tiles.

## r630 - reward grid fills: dark gold and dark red (owner)
With no outline (r625, pick branch) the fill carries the tile's kind. On the reward grid only
(`#grid .rg-tile`, not the shop or Guided), a buff tile's `--rbg` is `#5a4512 -> #2e2307` and a debuff
tile's `#5c1219 -> #2f080c` (were `#221d0e -> #14110a` and `#24101a -> #140a10`). Destination and
mystery-outcome tiles keep theirs. Verified at 1440x820 and 420x900 (Flow, real click): no page errors.

## r631 - Perfect Timing capped; the `?improve` preview page (owner)
Perfect Timing's second replay chance is 33 / 66 / 99% at tiers 1-3 and a SURE second replay from
tier 4 (`chance2` 1; it was 1.32); tier 5 marks a second line. `fillDescTemplate` conditions take
decimals (`[[chance2>0.995:twice]]`). **`index.html?improve`** (becomes `?tricks=epic&improve`
before the tour reads it) hides the tour's panel (`body.ia-lab-on`) and shows `#ia-lab`: a key per
look (plays it on the tray's Trick), 3 TIERS, and the speed / size / hold sliders.

## r632 - the improvement animation is a SCREEN on the board (owner)
`iaPlay` lays `.ia-screen` over the board's box (`#grid-slot` rect, opaque amber glass styled like the
event screens, scanlines, VT323) so it replaces whatever the board holds. "> IMPROVING NAME" types out
at the game's text speed (`textTypeCps`; every character is an `.ia-ch` span hidden by `.ia-tu` until
typed, one `.ia-cur` block cursor), the tile pops / rises / flips in above the text (the three looks
keep their tile moves; **stamp** is the default now, size 46%, hold 1100), then the version line
("v1.0", a `.ia-num` that moves to "v2.0" with the look's number move) and the sentence type out, and
each step stamps the next tier and moves the changed numbers in place. **Speed-up:** every step of a
many-tiered grant, and every later improvement of the same Trick, runs `IA_STEP_SPEED` (1.1x) faster
than the one before (`k = 1.1 ^ (tier - 1)`, through `iaMsK`). The screen comes on and goes off like a
CRT (`clip-path` from a line). **Perfect Timing** (owner): the second replay chance belongs to the
Trick's own line; the 5th improvement's second line (`_fixed`) replays once (`_ptMain` in calcScore).
Measured at 1440x820 and 420x900 through `?improve`: the screen matches the board box to the pixel, the
header and sentence type (77 characters, cursor present), the version reads v1.0 then v2.0, a 3-tier
preview counts v1 -> v4, no page errors.

## r633 - the cards are Jfred's Pixel Cards; the Joker is the wild (`tools/cards/`, `js/data/card-faces.js`)
Owner's pick: Pixel Cards by Jfred (CC0, jfredd.itch.io/pixel-cards; credited in `assets/cards/jfred/
CREDITS.md` and the handbook). The pack is 50x75 faces; the board's cells are not that shape (r586 fills
the box), so a face is CUT INTO PIECES by `tools/cards/build.js` (Playwright, like the icons): the corner
INDEX (rank over suit, x 2..9 y 2..18 of the source) and the centre ART (x 10..39), ink only, into
`assets/cards/jfred/faces.png` (art cells in the top row, index cells beneath) with `CARD_FACES` ('♥K' ->
sheet boxes + where they sat on the card; 'joker' is art only). `cardFaceSpriteHTML` (js/card-face.js)
emits three `.pxf` divs scaled by `--k` = card height / 75: art centred at its source height, the index at
its corner and again rotated bottom-right; `renderCardAppearance` adds them and `has-pxf`, and
css/card-face.css hides the text rank / suit / wild glyph under `html.cf-pixel`. Card face `pixel` is the
default (`CARD_LOOK_DEFAULT`; the store holds only another choice, so nobody needs a migration); print,
phosphor and classic stay in dev -> Aesthetics -> Card face. No sprite (so the printed face on the cream
stock) for numeric cards, dual cards, a fogged rank and the six-suit deck's extra suits. The pack colours
spades navy and clubs green where the game's `--suit-spades` / `--suit-clubs` are black and blue; the
preview name and tooltips still use the game's. Owner's note for later: a RANK could be made wild
(`isWildRank` is the one check) and given the Joker face the same way.
## r634 - Builds rebuilt on the tag table; the finale; tracked builds (owner's brief)
- **Tags** (`js/data/tags.js`, `TAGS.md`, `tools/verify-tags.js`): every Trick, Sleight and Knack row
  carries `tags:` from one closed vocabulary in four groups: PAYS (pips, mult, xpips, xmult, focus,
  time, credits, replay, stock, deck, board, limit, prime, luck, info, shield), SCOPE (exactly one of
  card / hand / other), WHEN (run, set, flush, size, rank, suit, position, streak, clock, pause,
  discard, swap, buffed, wild, sleights, tricks, level, reward, shop, boss, challenge), HOW (scores,
  scaling, chance, line, cost). Sleight activation is the row's `activation`, not a tag. The old
  tags (replay/retrigger, position/positional, coins/credits) are gone; Tray Order's gate reads
  `TRAY_ORDER_IDS` in js/events.js, not a tag. TAGS.md ends with the 22 judgement calls for the owner.
- **Builds** (`js/builds.js`, `css/builds.css`, console look): a top bar of multi-select dropdowns
  (TYPE, RARITY, FILE found / not found / locked, PAYS, SCOPE, WHEN, HOW, SLEIGHT activation), each
  option counted over what the other dropdowns leave; ticked options repeat as chips with an x;
  GROUP BY rarity / type / A to Z / a tag group; only matches are drawn, no gaps. Search box is
  approximate (`bvEdit`, one edit for 4+ letters, two for 7+, prefixes) and secondary; `/` focuses
  it, Escape clears or closes. Records: the object tile, name, rarity, description, tag chips,
  + DRAFT, and `v2..v5` (the improvement ladder read by applying tiers 1-4 for a moment; v6 shows
  only once `improveTierSeen(id, 5)`, written by `improveEntity` to `lethe.tierSeen.v1`). Left
  column: the draft (tiles, `draftWarnings`: Trick Slots, one Focus knack, retired), SAVE, TRACK IN
  RUNS, TEST DRIVE, codes; saved builds; VIEW toggles: synergies (`bvSynergy`: shared WHEN tags,
  replay + per-card, prime + scoring Trick; tap a record to pin), offer odds (`bvOdds`: the tier's
  share of ENTITY_TIER_W over the tier's members of that type), run stats (`bvStatsFor`, from run
  history by name), unfound and locked files. State in `lethe.builds.v2`, overrides only. The canvas
  scrolls; +/- is CSS zoom. Under 760px the rail is a drawer.
- **Tracked build:** `entityTileHTML` adds `.requisitioned` (a star) to an offer of an entity on
  the tracked build that is not owned (`entityOwnedNow`). The pause menu's BUILDS button
  (`pauseBuildsToggle`, js/finale.js) picks which saved build is tracked.
- **Test drive** (`testDriveDraft` -> `lethe.testDrive.v1` -> `launchTestDrive` from bootstrap):
  one Classic round, the walkthrough ended, the draft granted 600ms in (Sleights to the top of the
  draw pile). `startInterlude` and `showFinale` read `testDriveActive()`; the finale then offers
  BACK TO BUILDS (`lethe.openBuilds.v1`, read at boot).
- **Finale** (`js/finale.js`, `css/finale.css`): `showFinale(kind)` replaces #end-overlay's
  report in onGameWin / onGameEnd: the last round's score against its goal as a bar, rounds,
  hands, best hand, time, credits, cards scored / discarded, MOST USED (`trickFireTotals`, totalled
  in playHand from `_trickFiredThisHand`, in SAVE_VARS), the build as tiles, DETAILS (the quarter
  table), PEEK (hold or tap: the panel fades to show the board), SAVE BUILD (`saveBuildRecord`).

## r635 - Down and Back In, Magician, the shop under a sale, the Focus readout, the phone Reserve (owner)
- **Down and Back In** (knack): a discard holding ANY card of the grid's top rank pays (it needed
  every card of that rank), and the grant is `BAL.down_and_back_in.grant` (2) discards or swaps,
  alternating, plus 5 credits. Description from `DESC_TEMPLATES`. Measured by tap: one of two Queens
  discarded paid +2; a discard with no top-rank card paid nothing.
- **Magician**: +50 pips while you own NO Sleight (`magicianNoSleights()`, was "the only Trick in the
  tray"), else +6 mult per Sleight. Lost the `tricks` tag.
- **The shop showed the board's cards over its shelves** after a Trick or Knack was sold from the
  tray: `sellTrick` / `sellKnack` called `render()`, which deals the board into #grid. `render()`
  now returns while `shopGridActive` (like the grid pick), and a sale repaints the shop instead
  (`shopOrBoardRepaint`, js/shop.js).
- **Console Focus readout always above the lit chips** (`focusPlaceReadout`, js/focus.js): a gain
  lit the chips one by one (`runFocusAnimQueue`) and never moved the readout, so it sat up to 258px
  down inside them (measured at 1440x820). `addFocus` now places it at the new top BEFORE the first
  chip lights, a rise jumps (`.fr-rise`, no ease), and the gap counts the fill's shake
  (`FOCUS_FX.jitterMaxPx` x `focusJitterFrac()`). Sampled every frame over seven gains: 2.5-6px
  clear at 1440x820 and 420x900.
- **Held stack on touch** (Reserve, Dealer's Choice, Lockbox; js/dealers-choice.js): docks in the
  hand preview's FIRST SLOT at the size a played card takes there (`dealerDockSlot`; portrait sizes it
  with `portraitPreviewCardW`, split out of `fitPortraitPreviewCards`), each card behind a small step
  right (`DL_DOCK_STEP_X`). The cards fly in from their source (`dealerFlyIn`: the Focus bar's fill
  top via `reserveSourceRect`, or the Sleight), growing, on a shallow arc, `DL_FLY_STAGGER` (80ms)
  apart, `cardFlyMs(400)` long, one card pop each. Portrait shows the preview half while cards are
  held (`dealerPanelHold`; `dealerClose` and `portraitDanceEnd` hand the view back). It used to dock
  at the centre of the strip's right half, which in Stacked bars is the Tricks bar. Measured at
  420x900: slot 229,255 58x77 against a played hand's first card at 231,255 58x77. Mouse unchanged.

## r636 - the deck editor's swap tip is a notice; printed notices can be turned off; Amplifier (owner)
- **Deck editor banner** (`flowrDeckBanner`) no longer says how to swap. That line prints as a
  notice instead (`flowrDeckHintMaybePrint`, from `flowrDeckBegin`): on the first `DECK_HINT_FIRST`
  (10) deck edits, then every `DECK_HINT_EVERY` (5)th (15, 20, 25...). Store `lethe.deckEditHint.v1`
  `{ n, off }`.
- **A printed notice can carry a "don't show this again" button**: `showMessage(text, color,
  { mute: fn })` prints an eye-with-a-line icon (`.pt-mute`, `PT_EYE_OFF`, js/print-toast.js) after
  the line; a tap calls `fn`, pulls the slip and logs a quiet "Notice hidden" line for the drawer.
  The plate toast (printer notices off) has no button. Measured: tapped at 1440x820 and on a touch
  420x900, the store read `off: true` and the next deck edit printed nothing.
- **Amplifier** (Sleight): the next hand scores the current `level` x `BAL.amplifier.mult_per_level`
  (3) mult (was a flat +10, and its notice typed +5). `IMPROVE_STEP` makes an improvement +1x, so the
  tiers read x3 x4 x5 x6 x7 x10 (the 5th is the usual triple step). Measured: level 4, double-tap by
  mouse, +12 mult in the next hand's base, spent after it.

## r637 - Chorus fires on the replay (owner)
Chorus (Trick `chorus`, epic) was one x(1.75 ^ extra replays) lump in the hand-level x mult block.
Now it is a per-card x mult in calcScore's card loop (`_xl`, last in the card's beat): x`BAL.chorus.
mult_mult` (1.5) on each REPLAY of a card, not its first scoring, real card only (not a dual ghost).
Its `_xl` entry and timeline event carry `replay: true`, the reverse of `once`: `_cardMultSeq` skips
it on rep 0, and the dance's beat filter skips it on rep 0 (js/score-dance.js). Improvements follow
the generic x-step: x1.5 x2 x2.5 x3 x3.5 x5. Rerun is still the hand-level lump.
Measured by tap, dev mode on, a Run of 3 with replays 2 / 3 / 1 under the card ladder: plates
x1.5 on card 1's replay and card 2's two replays, none elsewhere; MULT chip 1 > 3 > 5 > 10.5 >
18.8 > 21.8, the ledger's 21.75; no timeline drift at 1440x820 and 420x900.

## r639 - the printed face is back, on the pack's blank card (owner)
Card face `print` is the default again (`CARD_LOOK_DEFAULT`); `pixel` (r633's Jfred faces) stays in the
dropdown. Every paper look (print, pixel, classic) now sits on the pack's blank card: `tools/cards/
build.js` copies `empty.png` to `assets/cards/jfred/stock.png` (`CARD_FACE_STOCK`), js/card-face.js
writes it to `--cfs-stock` on `<html>`, and css/card-face.css draws it as a 9-slice `border-image`
(6 source px a side, width 6 x `--k` = card height / 75, pixelated) on `.card` with the border kept at
2px, so the card's box is unchanged and the stepped corners hold at any cell size. A border image hides
border colours, so the selected / valid / penalty states and the wild ring the card with a box-shadow
instead; the old has-pip / has-mult border tints are covered (the face bands carry that). Stones,
challenge cards and numeric cards keep their own look.
## r640 - COMPARE BUILDS; the jump strip; the owner's tag decisions
- **Compare** (`js/build-compare.js`, `css/build-compare.css`; COMPARE in the Builds bar and the
  rail): a sandbox board (4x4 / 5x5 / 4x6 of real faces from a fresh deck) scored by up to four
  builds (the draft and saved builds, each in a colour) at once. Tap a connected hand: every
  column reads PIPS x MULT = SCORE live, the best lit. LOG HAND banks it (the cards are replaced
  from the deck), so a tally per build and a per-Trick "went off n of N" count build up; the
  logged hands are listed under the columns. A column's head opens its breakdown: the base,
  each Trick's pips and mult for this hand, the fire bar. **The score is the game's:** `bcScore`
  swaps the run globals calcScore reads (gridData, gridRows/Cols, trickTray, acquiredKnacks,
  selected, streakCount, lastHandType, activeHands = every hand) for the sandbox's, runs
  `calcScore(hand, cells, contrib, ledger)` after `resetTrickFires()`, reads the contributions and
  `_trickFiredThisHand`, and restores in `finally`. Not simulated, and said on the panel: Focus
  (x1), Sleights (listed, "board only"), run counters, improvements.
- **Jump strip** (`bvJumpRender` / `bvJumpSync`): one key per group on the canvas's right edge;
  a tap scrolls the group's label up, the group in view is lit as you scroll.
- **Tags:** `prime` is `retrigger` (a Trick firing again: primes, mirrors, force-triggers); new
  `charges` (PAYS), `start` and `replays` (WHEN); Focus-apply Tricks, relative-rank Tricks and
  round-start entities retagged per the owner. TAGS.md ends with DECISIONS and STILL OPEN.

## r641 - cards keep a playing card's shape inside the fixed box (owner's option 1)
The fixed box (r540 / r586) made the CELL the card, so a desktop 4x4 drew cards at 1.16 tall (the
game's card is 1.32, the pack's 1.50). Now `gridFillMetrics` keeps `CARD_W` / `CARD_H` as the cell
(every step, span and hit test reads them) and draws the card at `CARD_VIS_W` / `CARD_VIS_H`
(`cardVisualFor`: the chosen shape, as big as fits), centred by `CARD_CX` / `CARD_CY`; `applyGridMetricsToDOM`
writes `--card-w` / `--card-h` from the drawn size and `--card-cx` / `--card-cy`, a margin on `#grid`'s
cards (css/style.css). The slack is gap. Every other metrics path draws the cell. **Dev -> Aesthetics ->
Card ratio** (`setCardRatio`, `lethe.cardRatio.v1`, stored only off the default): a playing card
(1.32, default), the pack's shape (1.5), stretched to the cell (the r586 look). Measured at 1440x820 on a
4x4: cell 71 x 82; game 63 x 82 (ratio 1.30, 4px each side), pack 55 x 82 (1.49, 8px), fill 71 x 82
(1.15); on a 6x6 game 42 x 55, pack 36 x 55, fill 47 x 55. Portrait is untouched (the cell already keeps the card shape there).
## r642 - the `held` tag (owner)
WHEN gains `held` ("cares what you are holding"), one tag for the six rows that read something you
hold rather than the hand: Interest, Obsessed, High Roller (credits), Buried Treasure (Luck),
Hyperphagia (stock), Flow State (the Focus level). TAGS.md's STILL OPEN loses that item.

## r643 - the card ratio's slack is one even gap, frame included (owner)
r641 centred the drawn card in its cell, so the gap between cards was twice the gap by the frame
(4x4 at 1440x820: 16 between, 10 at the frame). Now `cardVisualOffset(n, cell, vis, i)`
(js/grid-metrics.js) shares the board's whole padding box (pad and cell gaps included) between
the n drawn cards and n + 1 EQUAL gaps, so a card's offset in its cell depends on its column
(and row, when the cell is taller than the ratio). `cardVisualRules()` writes one `margin-left`
rule per `data-col` and one `margin-top` per `data-row` into `#card-vis-style` (only while the
drawn card is smaller than the cell); `--card-cx` / `--card-cy` stay as the first column's / row's
fallback. `cardColOffset(c)` / `cardRowOffset(r)` are the readers for code that moves a card by
its real position: the swap's dx / dy (js/input.js) and a falling card's start and travel
(js/card-fall.js; `buildCardAnimEl` tags its cell so a temp card takes its own margin). The last
card may sit a px or two into the cell gap, never in another cell, so hit tests on the cell hold.
Also fixed: `recomputeGridMetrics` reset the drawn size from the OLD cell before computing the new
one, so a portrait board whose cells grew (back from a 4x6 reward board to a 4x4) kept the smaller
card. Measured at 1440x820, game ratio: 4x4 gaps 14 13 14 13 15 (were 10 16 16 16 10), pack 20 20
20 20 21, 6x6 10 10 9 10; a 4x7's vertical gaps 31 32 31 32 32. A real swap across a column started
at translate -76.5 against a drawn distance of 76.5 (no pop); a discard's column landed on its drawn
x. 420x900 unchanged (6 6 6 6 6). No page errors.
## r644 - console by default; board screens; Line Shift; aimed landings (owner)
- **Console mode is the default skin** (`TRAY_PIT_DEFAULT.on` 3, js/tray-pit.js; the store is
  overrides only, so a browser that chose the pit keeps it). Settings -> Display -> Console mode
  defaults on. r471's "pit stays the default" is superseded.
- **The board screen** (`js/board-screen.js`, `css/board-screen.css`): `boardScreenOpen({ head,
  html, keys, peek })` lays the improvement animation's amber glass over `#grid-slot` (body-level
  layer `#bs-layer`, zoomed like the stage), types the header at the game's text speed, holds
  wireframe boxes (`.bs-note`, `.bs-lines` / `.bs-line`) and a row of keys. **PEEK** makes the
  glass clear so the board under it can be read (its line markers), BACK brings it back.
- **Surveyor / Leveler's row chooser** is a board screen (`showNextPositionChooser`,
  js/scoring.js): one box per line with the effects already on it, the provisional default lit,
  KEEP ROW N takes the default; `#pos-chooser` is gone.
- **The Limit Break** in console mode, landscape, is laid over the board's box (`lbConsolePlace`,
  js/limit-break.js; the overlay sits inside #cabinet, so the panel's zoom is `S.z / k`) and
  css/board-screen.css draws it as the amber glass. Elsewhere the full-screen panel stays.
- **Line Shift** (event `line_shift`, js/events.js): offered only with 2+ position effects
  (`lineShiftEntries`, in EVENT_REQUIRES). Tap an effect, then the line it moves to; a line
  another effect holds swaps the two (District lets them share). Confirm writes through
  `finalizePositionMark`; Leave keeps the lines.
- **Tray landings are aimed and slower** (`trayEntityLand`, js/tray-fx.js): the tile tapped in the
  last 8s (`.reward-cell`, `.gp-opt`, `.event-choice`, never a tray chip; a document pointerdown
  listener) is where the chip comes from: a body-level copy flies from that tile's box, at that
  tile's size, to the chip's own box in 780ms, then the chip shows. No source: the drop-in, 700ms.
- **Desktop console preview cards are 50 x 66** (was 42 x 55; css/skin-machine.css): the hand name
  is a band along the top of the preview screen instead of a 44px column at its left.
- **The card flight lands at the slot's exact box** (`flyGridCardToSlot`): the look's `scale(v)`
  becomes `scale(v, v * k)` with k eased in toward the slot's height ratio. The fixed box's cells
  are not the preview's shape, so a 73 x 85 card used to land 49 tall against a 55 slot and the
  real card popped in bigger. Measured: 96.1 x 127.4 vs 96.1 x 126.9 viewport px at 1440x820.
- **No selection-order numbers on cards** (`.sel-num` markup gone from render.js / card-fall.js).
  **Attention no longer shrinks or dims the unselected cards.** **Hovering the clock's skull**
  shows the boss peek on a mouse; a click still pins it and a double-click skips to the boss.
## r645 - 4x4 is a Knack; v6 names; a hand ends every pause (owner)
- **4x4** (`four_by_four`) is a rare **Knack** (the common Trick is `retired`, kept for saved runs; its
  `pips` stays in BAL for them). Every scored 4 rolls `BAL.four_by_four.chance` to force-trigger the Trick in
  tray slot 4, once per replay, in calcScore's force block beside Temporal Rift (deterministic per card,
  replay and hand). `IMPROVE_PLAN`: 44 / 60 / 76 / 92 / 100%, and the 5th improvement sets `queens` (Queens
  roll too). Measured: three 4s, slot 4 Cascade: 342 unforced, 702 one force, 967 two or more (force cap);
  25,000 rolls landed 44.3%.
- **v6 names** (`V6_NAMES`, js/data/v6-names.js, content only): at tier 5 an entity listed there takes its
  v6 name (`v6NameApply` in `applyEntityTiers`, base kept in `NAME_BASE`; `syncOwnedEntityDescs` copies it
  onto owned copies). Builds prints it on the v6 row. Shipped: Aftershock -> Metashock, Alignment -> Perfect
  Alignment, Bellhop -> Bell Captain, Buddy System -> Friends with Benefits, Capacitor -> Supercapacitor,
  Cascade -> Cataract, Coin Toss -> Weighted Coin, Collector -> Hoarder, 4x4 -> 4x4 Queen. The **Hoarder
  knack is now Spoiled** (id `hoarder`). Amplifier was given as Amplifier, so it is unchanged.
- **A played hand ends every pause** (`endPausesForPlay`, js/discard.js, called in playHand once the hand
  is committed; dev -> Change the game now -> Pauses, `lethe.pauseEnds.v1`, stored only when off). Rewinds
  are untouched. The hand that ends a pause still counts as played in it: The Falcon, Deep Breath and The
  Phoenix ask `clockPausedForHand()` (live pause OR `_handPlayedInPause`, cleared on the next microtask).
  A pause this hand grants starts after the end. The Stopwatch is untouched (it already ends with the
  hand's tally). The Pause keyword tooltip states the rule while it is on. Measured by tap at 1440x820
  and 420x900: a 30s pause ends on PLAY, Deep Breath pays on that hand, Dam Holding's own 3s pause runs
  after it, switch off keeps the pause counting down.
- **`V6_NAMES_AND_LADDERS.xlsx`** (root): every Trick, Knack and Sleight but the nine named, with three v6
  name suggestions, today's ladder, a proposed v2-v6 ladder in the owner's alternating style (236 of them;
  the owner's own ladders are kept and marked), yellow columns for the owner's picks, and notes. Found
  while building it: **Free Hand, Charged Card, Shuffle Up and Double Down get MORE expensive when
  improved** (the generic rule adds the base to their Focus cost). Not fixed; flagged in the sheet.
## r646 - Inseparable Tricks; five line Tricks; the owner's Trick notes (owner)
- **INSEPARABLE** (`js/inseparable.js`, pairs in `js/data/inseparable.js`, `css/inseparable.css`,
  suggestions in `INSEPARABLE.md`): both halves of a pair in the tray fuse into ONE Trick
  (`inseparableCheck`, from `injectTrickAfterReward`): the fused row is an ordinary
  `TRICK_POOL_ALL` row with `fused: true` (never offered: `survivalEntityBanned`,
  `pickEntityByRarity`), takes the first half's slot, keeps the higher tier. Drawn RED with both
  parts' icons (`entityTileInner` reads `inseparableDef`; `.fused` on the cell and the chip; a faint
  pulse under the pointer). **A full tray takes a pair's second half** (`trickTrayFullFor(id)`,
  every refusal site; `rewardTakesTrickSlot`). The fusion plays on the improvement animation's
  screen (`iaPlayFuse`: the two discs come in from the sides, slam together, flare, the fused disc
  types its line; dev -> Aesthetics -> "Preview inseparable"). Shipped pair: **Lie Up** = Lie Down +
  Stand-Up, +24 mult for a hand from one row or one column, +16 a tier, v6 no more than 2 rows or 2
  columns (`lieUpShape`).
- **Fix:** `improveAnimFlush` set `_iaRunning` after a runner that could finish synchronously (every
  entry skipped), so the flag stayed "running" for good and no later note flushed.
- **Line Tricks** (`POSITION_ASSIGN_IDS`, `LINE_FX_META`): **Live Wire** (epic, `line_xpips`, x1.2
  pips per card, on the card's beat beside Cornered), **High Voltage** (epic, `line_xmult`, x1.2
  mult per card, in `_xl`), **Obligatory** (epic: 25% per card per replay to force-trigger the Trick
  in the tray slot of the line's number, `markedLinesAt` / `lineSlotTrick`, beside Temporal Rift),
  **Suggestive** (epic: 35% to PRIME that slot's Trick, rolled in `scalingCount` since primes are
  spent there), **Coin and the Sword** (rare: 10% per card of credits = hand size, paid in
  `scalingCount`; 20% of +25% of your credits as mult, `coinSwordMult`, hand-level; the live line
  prints the mult). Ladders in `IMPROVE_PLAN`: +0.2x / +10% a tier (Coin and the Sword alternates
  both chances +10% with the credit share +15%); **the 5th improvement marks a SECOND line at the
  base value** (`markExtraLine(id)`, registry `_extra: true`, on the other axis when a free line is
  there; `markedLineKind(r, c, id)` says main / extra, main wins at a crossing; BAL `line2` /
  `chance2` hold the base). Perfect Timing's second line goes through the same function (a pre-r635
  save's carries `_fixed`). **`positionDescApply(trick)`** writes the line names into the sentence
  ("row 4", "column 2 (its second line)", "tray slot 4") and `syncOwnedEntityDescs` re-applies it
  after an improvement (the label used to be lost there).
- **Assembly Line**: +2 mult per line card for every card played from the line LAST round (+1 in
  Flow, counting the last quarter); `asmLine { prev, cur }` (SAVE_VARS), `asmLinePerCard()`,
  `asmLineRollover` from the round reset (not Flow) and `survivalBossBookkeeping` (Flow); with no
  finished round since the pick, the current round stands in. +2 / +1 a tier, v6 a second line.
- **The Woodpecker**: 2 replays (3 plays); v2 3, v3 25% of one more every time, v4 4, v5 33%, v6 50%
  (`chance_extra`, rolled with `_detReplayRand`, Luck-free by the owner's word).
- **Bellhop** +2 swaps +2 discards, alternating +2 a tier, v6 both. **Stand-Up** +12.
- **Gone:** the Alignment knack and the turning board pattern (`#board-hypno`, Settings -> Board
  pattern; `css/hypno.css` keeps only the CRT's floor). The owner's "delete 4x4" met r645's 4x4
  Knack mid-flight: the Knack stays, the common Trick stays retired as r645 left it.
- Measured in headless Chromium at 1440x820 and 420x900 (`?tricks=epic`, dev mode on): Live Wire
  x1.2 then x2.0 at v6 with its second line at x1.2 (a crossing pays the main line); High Voltage
  x1.2 per card; Obligatory at 100% forced Cascade (535 vs 189); Suggestive at 100% primed the slot's
  Trick 3 times from 3 cards; Coin and the Sword at 100% paid +9 credits and +30 mult (3 x 25% of
  40); Assembly Line's second hand paid line cards x (3 x 2); Lie Down + Stand-Up with a full tray
  of 5 fused into Lie Up in slot 5, +24 on a row, +104 and an L shape at v6; real hands through PLAY
  with no timeline drift and no page errors. The tour page's `[DECK AUDIT]` warning is pre-existing
  (identical on r645).
