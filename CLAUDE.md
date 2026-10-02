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
| `EVENTS.md` | the 22 events, what each does, which tier |
| `OPEN_DECISIONS.md` | the balance-audit backlog, left for the owner |
| `BALANCE_PASS_9.24.md` | the 9.24 balance pass index |
| `TODO.md` | parked work |
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
  level-up (`flushPlayedDeck`). **The board persists between rounds** (r332): only holes refill.
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
- **Score over the goal no longer carries** into the next round (Survival engine). Flow pays it: 1 credit per `flowEcon.overPct` (15)% over. Flow also pays interest (`interestPayout`) at each level-up; unused stock pays only when split is off. `flowLevelPayLines` is the one source; the Round breakdown prints it under "Paid at level-up".
- **Shop is a reward kind** (`shop`, odds 10): a free visit; closing it (`flowrShopStep`) advances the chain. Odds (r448) pick3 25 / tricks 25 / shop 10 / cards 7 / deck 7 / sleights 8 / limits 8 / improve 4 / knacks 6; a full trick tray drops tricks to 18 and splits the 7 over cards/deck/limits/improve (`flowrOddsNow`). The chance of 2+ rewards BUILDS UP (r449, `flowrRollCount`, `flowrPrdMisses` in SAVE_VARS): the table chance plus `flowEcon.multiStep` (10, dev -> Flow) per single-reward level-up in a row, reset on a multi. Average rate 62% -> 66%.
- **Forced kinds:** no TRICKS reward by the 3rd level-up since the last boss makes it the first reward; no KNACKS reward before a boss puts one in the boss chain (`flowrLvSinceBoss`, `flowrTricksSeen`, `flowrKnacksSeen`, in SAVE_VARS).
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
past the round cap (`crStartBonus`, read by the countdown refill). Not in Flow yet: Flow has no
round clock to fail against. `crRound` / `crArmed` are plain data in SAVE_VARS. Dev:
"Next Round: Challenge" and "Open Penalty Grid" under Level & screens.
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
