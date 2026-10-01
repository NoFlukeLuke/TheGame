# Cleanup audit - dead and legacy code

Measured in r410-r412 (grep for callers, then run the game). **Done** is what has
already been removed; **Open** is ranked by how safe it is to take out. Everything
removed is still in git at the build named.

Why bother: less surface for bugs (several past fixes were an old, unused path
still breaking something live), smaller files to read, and no dev switch that
quietly puts the game into a state nobody has tested for a year. Archiving git
branches does none of that; only check them for unmerged work before deleting.

## Done

| build | what | where it was |
|---|---|---|
| r410 | CLAUDE.md slimmed 11,900 -> ~250 lines; the record is `HISTORY.md` | |
| r411 | **Dominoes mode** (owner: out) | `js/dominoes-mode.js`, `js/data/dominoes.js`, `css/dominoes.css`, 13 engine guards |
| r412 | the pre-r89 in-place scoring dance + its dev toggle | `playScoreDance` body, `goalCelebration`, `tickValue`/`flyParticle`/`collectScoreParticles` |
| r412 | the shop squish (r230, dormant since r237) | `shopSquishSet` etc., `.shop-squish` CSS, `#shop-squish-tab` |
| r412 | The Rota boss modifier (preset deleted r216) | `trick_rotate`, `bossRotateTick` |
| r412 | `DISCARD_TIME_COST` / `SWAP_TIME_COST` / `spendRoundTime` / `freeSwapsLeft` (dead since r151), `popSwapIndicator` + `swapPop`, `makeCardPermanent`, `leyLinePos` + `.rc-leyline` | round-timers, combos-aim, audio, card-states, deck-grid, card-fall, style.css |
| r413 | finished design docs -> `docs/archive/`; Mart mockups and the squish study -> `previews/archive/` | |
| r414 | **Tricks on the grid** + the legacy pick-1-of-3 Trick overlay; `trickTrayMode` is gone | 33 sites in 17 files, `#trick-choice-overlay`, the `.trick-card.trick-tier-*` CSS |
| r415 | **the legacy overlay shop**; `js/shop.js` 767 -> 125 lines | `#shop-overlay`, `#svc-picker`, `renderShop*`, `buyShop*`, `USE_ONGRID_SHOP` |
| r427 | **`tetris` / `autoplay` modes** and the 20-minute legacy game clock. Neither had a menu card; tetris's own flags were read by nothing, autoplay only shortened the auto-submit delay | `MODES.tetris/autoplay`, `gameInterval`/`gameSeconds`/`nextShopTime`/`nextBossTime`/`savedRoundSeconds`, the legacy boss-return branch in `endBoss` |
| r416 | **the Survival MODE entry** (owner: Flow will likely take the name). The engine in `js/survival.js` stays: Flow runs on it | `MODES.survival`, its `MODE_META` card, its walkthrough seed and step, its handbook topic |

## Open, safest first

| # | what | where | size | risk | notes |
|---|---|---|---|---|---|
| 1 | **Exalt / Corrupt** | `exaltCorruptEnabled` (13 sites), `_exalted`/`_corrupted` card flags, `exaltCorruptTotals`, the trigger counters in `playHand`/`doSwap`/`doDiscard`, two Settings toggles, `.exalted`/`.corrupted` CSS | ~250 lines | medium | Paused since r50, default off. It is woven into the per-card loop in `calcScore` and `DURABLE_CARD_FIELDS`, so this is a careful edit, and it is a designed mechanic rather than dead code. Owner's call. |
| 2 | **Old challenge system** | `js/challenge.js` (215; also declares `audioCtx`), `challengeCard`/`challengeActive` in 23 sites | ~250 lines | medium | The pre-Guided "challenge card on the board". Check whether any mode still spawns one before touching; `audioCtx` must move to `js/audio.js`. |
| 3 | Dead `BAL` entries and `DESC_TEMPLATES` for Tricks not in any pool (`jack_mult`, `heart_double`, ...) | `js/data/balance.js`, `js/scoring.js` | small | low | Scored for, described, unobtainable. Either add them to the pool or delete the scoring blocks. |
| 4 | Preview pages whose system has since moved on | `dance-preview.html`, `finale-preview.html`, `reward-preview.html`, `reward-resolve-preview.html`, `desktop-preview.html`, `layout-view.html`, `palette-preview.html` (all last touched r95-era) | 7 files | none | Self-contained, no live JS refs. Archive if the owner no longer opens them; the tuners that dump a shipped config block (`particle-preview`, `payout-pick-preview`, `heartbeat-preview`, `channel-change-preview`, `shop-float-anim-preview`, `tier-badge-preview`, `heavy-preview`, `score-trays-preview`, `poker-squares-preview`, `office-calibrate`) stay. |
| 5 | Idea backlogs in the root | `MODE_IDEAS.md`, `FOCUS_IDEAS.md`, `CARD_MECHANICS.md`, `SCORE_SCALING.md`, `GLOSSARY.md` | docs | none | Still accurate as backlogs. Could move to `docs/` to leave the root for live references. |
Also worth a decision, not dead code: **the starred card** (`assignTrickCard`, js/round-timers.js)
puts a gold ⭐ on a random card every `TRICK_CARD_INTERVAL` (20s) and that card scores x2 mult
(`_trickcard` in `calcScore`). It runs in every mode. HISTORY.md calls it "the dev grid Trick card"
but nothing gates it on dev mode, so it is a live mechanic. Keep it or cut it; either is one block.

**Kept by owner (r428): Match-3 and Zen.** The owner wants auto-play
(`autoPlayHands`, `autoSubmitDelay` in js/input.js) used elsewhere in the game, and
Match-3 is the test bed for it. Do not propose removing them.

Not on the list: `_cmOnce` (the documented seam for a once-per-card bonus),
`pendingHandMult` (fed by Second Hand), `cellCountsForTriggers` (two live
callers), `stoneInjectCount` (a comment only), `hallmark` / `card-states`
(shipped mechanics), hidden modes Guided, Spectrum, Six Suits, Crunch (whole,
reachable, and Spectrum/Six Suits are the Custom picker's decks).
