# Redesign Progress & Handoff (as of build r62)

Companion to `GLOSSARY.md` (house style) and `CLAUDE.md` (architecture). This tracks the
trick/sleight/knack redesign driven by the owner's CSV (`bonus_redesign_6.15.26.csv`,
uploaded per-session) plus occasional supplemental docs.

## Workflow (unchanged)
- Develop on `claude/blissful-gates-tovszv`; ship = `git push origin HEAD && git push origin HEAD:main` (Pages serves `main`).
- Bump the `BUILD` constant every commit (currently `r62`). Validate syntax:
  `node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.match(/<script>([\s\S]*)<\/script>/)[1]);console.log('OK')"`
- Per batch: spec the tricks in glossary style → owner confirms/tweaks → build → ship. Owner is non-technical; explain plainly.

## Build log this session
- **r48–r49** — Full terminology rename: Joker→Sleight, Totem→Knack, Bonus Card→Trick (code + CLAUDE.md). Shipped.
- **r50** — (owner's own commit) pause Exalt/Corrupt, free hand plays, stacked-shelf shop.
- **r51** — Batch 1 (Run tricks) + reading-order scoring + new **mythic** tier.
- **r52** — **F1**: Focus shown as 3rd score element (pips × mult × Focus). **Pause** mechanic + High Water.
- **r53/r54/r55** — Submit-glitch saga: r53 queue plays during animation; r54 input diagnostics; **r55 root fix** = debounce the Play button (mobile double-click) + move `cancelDance()` after the findBestHand null-check so a stray 2nd press can't abort the score animation.
- **r56** — Batch 2 (Sets family).
- **r57** — Ripple = adjacent ranks only (no pairs); round-time fractions made **dynamic** (`roundFractionRemaining()`).
- **r58** — Batch 3 (Flushes & Suits).
- **r59** — Mythomania: **Reflect**/**Soul Mirror** (aim-sleight fixtures) + **Mirror** trick.
- **r60** — Mirror = Blueprint (real duplication of a borrowed Trick's contribution).
- **r61** — Batch 4 (rank-specific scoring tricks) + Mirror extended to duplicate multiplier/on-grid tricks (e.g. Knave).
- **r62** — Priming system + Inspirato, Prime Times, Double Take.

## Batches DONE
1. **Runs** — Cascade, Storm, Torrent, Flash Flood, Rogue Wave, Tide Table, Undertow.
2. **Sets** — Quake, Shock, Resonance, Collapsing Columns, Magnitude, Aftershock, Double Dutch, Bedrock, Richter, Eye of the Storm, Ripple.
3. **Flushes & Suits** — Enriched, Tidal Forces, Deluge, Rainbow, Balance, Blood Diamonds, Dark Matter, Kaleidoscope, Hard Labour.
4. **Rank-specific** — First Light, Face Value, Men of Repute, Unsummit, Every Day Essentials, Get Even, Odd One In, Prime Time, Heads of State, Knave for the People, Gnomes, Threepeat, Lucky Sevens, D6, Sideways to Infinity, Middle Management, **+ Inspirato, Prime Times, Double Take** (the priming-system tricks).
- Mythomania (Reflect, Soul Mirror, Mirror) shipped alongside.

## Batches REMAINING (next)
**Timing/Streak → Grid/Position → Focus-centric → Scaling/Permanent → Sleights → Knacks → New & curses.**

## Key systems/mechanics (where to look in index.html)
- **Tricks** live in a tray (`trickTrayMode`); `hasTrick(id)` gates effects. `TRICK_POOL`, `BAL` (constants), `DESC_TEMPLATES` (filled into pool `desc` at init IF a template + BAL entry exist — so when redesigning a trick you MUST update or delete its template or it overwrites the new desc with stale/`undefined` text).
- **calcScore** is the scoring core: per-card pip loop → additive mult section → **multiplier block** (×pips/×mult tricks) → **Mirror/priming/Double Take duplication** → focus → `s = pips × mult` → (mostly-emptied) ×score section → `s *= focus`. `_cp`/`_cm` track per-trick pip/mult deltas (always-on) and power Mirror/priming.
- **Focus**: `focusNodes`, `FOCUS_THRESHOLD=10`, `focusCapacity=3`; `focusMultiplier()=1+0.1×max(0,nodes-10)`; shown as the FOCUS score box (default ×1). `addFocus()`.
- **Reading-order scoring**: `scoringOrderCells()` (top→bottom,left→right by default; future knack `'selection_scoring'` flips to tap order). Sequence checks (Rogue Wave) use tap order via `canBeOrderedRun`.
- **Mirror = Blueprint**: `mirroredTrickIds()` + the duplication block after the multiplier stage.
- **Priming**: `_primed` count on tray Trick objects; duplicated in calcScore, consumed in playHand. Cursor `_primeTimesCursor` for Prime Times.
- **Aim sleights**: `AIM_SLEIGHTS`, `reflectAimsAt()`, `soulMirrorRankCount()`; fixtures (fall/render only); tap rotates aim.
- **Pause**: `pauseRound(seconds)` (stacks); clock turns blue (`#clock.clock-paused`).
- **Retrigger engine**: per-card `_retrig` in calcScore (twos/eights/corner/rowcol/eye_of_storm/ripple/reflect/soul_mirror/perm).
- **Tiers**: common/rare/epic/legendary/**mythic**. Trick prices `SHOP_TRICK_PRICES`; sleight `SHOP_SLEIGHT_PRICES` + `pickSleightByRarity` weights.

## Glossary rules to honor (see GLOSSARY.md)
Subject-first "scores +N"; resources are "added" (+N Focus/seconds/coins); **no ×score** (only ×mult/×pips, decided per card); Run = any run/straight; Set of N; "Rank 5 and below" includes Ace; Ace = odd+prime, 11 pips; face cards never even/odd/prime; round-time fractions are dynamic; buffs permanent by default.

## How to add / redesign / remove a Trick (checklist)
- **Redesign:** update `TRICK_POOL` (name/tier/desc), `BAL`, the `calcScore`/`playHand` logic, **delete or fix its `DESC_TEMPLATES` entry**, and any `bonusLines` (carousel) line.
- **Remove:** delete the `TRICK_POOL` def. Its old `calcScore` lines become inert automatically (`hasTrick` returns false), so they can be left — but scrub `DESC_TEMPLATES`, theme pools (`THEME_*`), unlock pools, and carousel lines that show stale text.
- **Verify:** syntax check; grep for dangling refs; check no duplicate display names (script in r62 commit history).

## Open decisions / deferred
- **ID→name cleanup pass (FINAL, owner-requested):** rename every internal `id` to match its display name (e.g. `kindred`→`quake`). Deferred to the very end to avoid breaking references mid-redesign. Treat like the Joker→Sleight rename.
- **Force-trigger system:** deferred until a Trick needs it (fires even when its condition isn't met — distinct from priming/retrigger).
- **Curses:** new card category (a "bad sleight" that lives in the deck) — not built yet (e.g. Not a Friend / Hit and Run).
- **Devoted** (`heart_double`, "♥ +1 mult each"): currently **cut**; owner may revive/redesign.
- **`escalation`** still needs a new name (the CSV routed it to "Dark Matter", but `spade_flood` took that name first).
- Backlog from CSV rows 168–215 (new trick ideas), keyword/tag system ("Move as One"), a stat screen with counters (for meta tricks), and a "specify row/col" knack + event (the rowcol tricks currently assign randomly).

## NEXT BATCH IDEA (parked by owner, do in a fresh chat) — Time-Rewind family
Owner wants a **new bonus category that rewinds the clock** (moves it *backward*), to pair with
the pause-theme Timing/Streak batch (shipped r66–r68: Cuckoo/Woodpecker/Albatross/etc.). The hook:
rewind lets you **re-cross "on the minute" boundaries to re-proc minute-triggered bonuses**.

Scope owner sketched: ~4–6 entities total —
- **3 with "on the minute mark" / interval triggers** (siblings of Cuckoo's 60s tick + Woodpecker's
  30s blocks). e.g. "every 60s: +X", "every 30s: mark/grant", "at each minute: bank something".
- **3–4 that rewind time** (clock moves backward / earlier).

**Design question to answer in that chat: how is REWIND different from PAUSE, beyond "2× the time"?**
Pause = clock *frozen* (timeline suspended, you act for free). Rewind = clock moves *backward*
(you re-enter earlier time). That difference unlocks effects pause can't:
1. **Re-proc time-gated triggers** — rewinding past a minute mark re-arms/re-fires Cuckoo, resets
   Woodpecker's active/off block, re-crosses Swift/Albatross thresholds. (This is the combo the
   owner explicitly wants — rewind as a *minute-trigger replay engine*.)
2. **Reset cooldowns** — Ripple's 30s, Double Dutch's window, High Water's run count "as if time
   un-passed."
3. **Re-arm once-per-round locks** — unlock a spent double_tap / on_swap sleight again this round
   (and possibly Double Jeopardy / Snooze).
4. **Undo recent state** (bigger build-around) — restore the last discarded/scored card to the grid,
   or refund the last swap/discard, or restore decayed Focus nodes.
5. **Risk/identity** — pure "rewind = +2× pause seconds" is the boring version; lean into replay/undo
   so rewind reads as *manipulating the timeline*, not just *more time*.
Suggested split: keep pause = "free actions now," make rewind = "replay the timeline / re-trigger."
Reuse existing infra: `cuckooNextMinute`, `woodpeckerActiveBlock`, `roundStartSeconds`,
`_elapsedRound` in `startRoundTimer`; `pauseRound()` for the pause side.

## Known minor flags (not bugs, watch on playtest)
- Mirror duplicates a borrowed Trick's pip/mult contribution; it does NOT yet copy Focus/time/coin effects, and uses the base (pre-retrigger) amount; additive copies are added after the multiplier stage.
- Prime consumption re-derives "did it trigger?" after per-hand bookkeeping → a primed *timing-gated* Trick could consume a stack a hand off.
- Score breakdown shows raw ids (`mirror`, `primed`, `reflect`, `soul_mirror`) until the id→name pass — cosmetic.
- Knave for the People is exponential (×2 per Jack on the grid).

## Dev/debug
- 🛠 dev panel adds tricks/sleights/knacks by id, triggers events/bosses. The in-game **event log** (dbgEvent) has a Copy button — used it to diagnose the submit bug; play branches log there (`play <hand>`, `play queued (...)`, `tap missed a card`, etc.).
