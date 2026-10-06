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
| r432 | **Exalt / Corrupt** (owner: archive, maybe a mode or DLC later). Full write-up in `docs/archive/EXALT_CORRUPT.md` | the toggle, `exaltCorruptTotals`, the triggers in playHand/doSwap/doDiscard, the card flags in `DURABLE_CARD_FIELDS`, `BAL._exalt/_corrupt`, the glows, the 3 disabled Sleights |
| r432 | **the starred x2 card** (owner: ditch it) | `assignTrickCard`, `TRICK_CARD_INTERVAL`, `trickCardPos`, `_trickcard` in calcScore, `.trick-star` |
| r432 | 7 r95-era preview pages -> `previews/archive/` | |
| r416 | **the Survival MODE entry** (owner: Flow will likely take the name). The engine in `js/survival.js` stays: Flow runs on it | `MODES.survival`, its `MODE_META` card, its walkthrough seed and step, its handbook topic |
| r499 | **the grid heartbeat** (owner: gratuitous next to Watch). The clock's 10s tick moved to its own timer, `js/clock-tick.js` | `js/heartbeat.js`, `heartbeat-preview.html`, the dev Grid Heartbeat section, `HB_KEYS`/`devSetHb`/`devSyncHbSliders`, stored `hbCfg3`/`hbEnabled` (removed on load) |

## Open, safest first

| # | what | where | size | risk | notes |
|---|---|---|---|---|---|
| 1 | **Old challenge system** (superseded r444 by `js/challenge-round.js`) | `js/challenge.js` (215; also declares `audioCtx`), `challengeCard`/`challengeActive` in ~20 sites (render, card-fall, input, play-hand, score-dance, round-timers, save, the Shortcut Sleight) | ~250 lines | low | Nothing spawns it (its only spawner is reached only from its own pick screen) and its null-cell card is refilled by the persisting board anyway (measured r444). Move `audioCtx` to `js/audio.js`, then delete. Shortcut Sleight's 'complete the challenge' could point at `crSolve` instead. |
| 1b | `flowrPendingDual` / `flowrMaybeRunPendingDual` (js/flow-rewards.js) | the reward grid's dual card op was its only setter, removed r444 | small | low | Dead now; delete or give it a new setter. |
| 1c | the heartbeat's `--hbx/--hby/--hbr/--hbs` (nothing sets them since r499) | the composed card transform in css/style.css (~4 rules), `css/settings.css` reduced-motion line, comments in boss/clock-fx/flow-rewards css | small | low | Drop the vars from the transform strings; keep `--frzr` and `--grds`. |
| 2 | Dead `BAL` entries and `DESC_TEMPLATES` for Tricks not in any pool (`jack_mult`, `heart_double`, ...) | `js/data/balance.js`, `js/scoring.js` | small | low | Scored for, described, unobtainable. Either add them to the pool or delete the scoring blocks. |
| 3 | Idea backlogs in the root (owner: leave) | `MODE_IDEAS.md`, `FOCUS_IDEAS.md`, `CARD_MECHANICS.md`, `SCORE_SCALING.md`, `GLOSSARY.md` | docs | none | Still accurate as backlogs. Could move to `docs/` to leave the root for live references. |
**Kept by owner (r428): Match-3 and Zen.** The owner wants auto-play
(`autoPlayHands`, `autoSubmitDelay` in js/input.js) used elsewhere in the game, and
Match-3 is the test bed for it. Do not propose removing them.

Not on the list: `_cmOnce` (the documented seam for a once-per-card bonus),
`pendingHandMult` (fed by Second Hand), `cellCountsForTriggers` (two live
callers), `stoneInjectCount` (a comment only), `hallmark` / `card-states`
(shipped mechanics), hidden modes Guided, Spectrum, Six Suits, Crunch (whole,
reachable, and Spectrum/Six Suits are the Custom picker's decks).
