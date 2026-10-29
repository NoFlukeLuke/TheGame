# Trick unlocks (r706)

What is LOCKED, what unlocks it, and the two collection events. Code: `js/unlocks.js` (counters,
the lock, the collection count), `js/data/unlocks.js` (every goal; the one place to change one),
`js/events-meta.js` (Licensing, the lore event, the event counter), `js/data/lore.js` (the lore
answers and the order legendaries are offered in).

## How it works

- A **locked** Trick is never offered: not in a pick, a reward grid, the shop, an event or a
  Temp form. Its Builds record reads LOCKED with its goal and progress ("Discard 30 cards · 12 / 30").
- Goals count across every run and mode, for good (`lethe.unlocks.v1`). A goal met prints
  "UNLOCKED: name" (or "UNLOCKED: a new Rare Trick" while its name is still hidden) and the Trick
  can be offered from that moment, the same run included.
- A Trick that has been taken once is unlocked whatever its goal says (old saves keep what they found).
- **Locked is not the same as undiscovered.** Undiscovered = offered, name hidden until taken,
  and since r709 that is EVERY Trick, commons and legendaries included. Locked = not offered at
  all. A Trick that starts unlocked is still undiscovered until you take it.
- **The reveal** plays the first time each Trick is taken (FILE FOUND, the name types over
  UNDISCOVERED).
- **Tracking a goal** (r709): a locked Trick's Builds record has TRACK GOAL. During a run,
  pointing at the printer's paper corner shows that goal and its progress on a slip, and the
  drawer (tap or click the corner) prints it on its top line. One goal at a time; it ends when
  it is met, when another is tracked, or with STOP TRACKING in Builds' UNLOCKS screen.
- The tours, labs and a Builds test drive lock nothing.
- Dev -> Tools -> Trick unlocks: every Trick unlocked, reset unlocks and counts, the meta
  legendary switch, "next event is lore", open Licensing, open lore.

## The plan, as built

| tier | starts unlocked | licensed | goal |
|---|---|---|---|
| common (41) | 20 | 0 | 21, met in a run or two |
| rare (65) | 13 | 3 | 49, nearly all within about five runs |
| epic (54) | 5 | 2 | 47 (31 of them the unique proposals below) |
| legendary (12) | 0 | 0 | win one run; then found at 0.9% of offers |

Numbers come from the sim's bot (`node tools/unlocks/measure.js classic 30`): a Classic run is
about 100 hands, 20 rounds, 80 Set / 60 Run / 2.5 Flush hands, 500 cards scored, 30 replays,
2 pauses, 30 Focus fills. The bot plays far more 5-card hands than a person; goals on 3- and
4-card hands are set for people. `node tools/unlocks/list.js` prints every rule and checks that
none is missing; `--md` prints the table at the end of this file.

**Legendaries.** `ENTITY_TIER_W` is 71 / 22 / 5.5 / 0.9, so 0.9% of offers before Luck (the
legendary weight was 1.5). The meta switch "legendaries are easier to find"
(`metaFlag('legendary_find')`, dev panel only until the meta shop exists) puts it back to 1.5,
today's rate, without saying the number. The lore event offers them whether or not they are unlocked.

**Licensing** (event `licensing`): three locked `buy` Tricks, any number, priced by tier through
`priceOf` (`BAL.licensing`: rare 20, epic 32 on screen). Name hidden, description shown. Offered
only when one is affordable. Licensed: Middle Man, Mirror, Scalper (rare), Undue Influence,
Clean Sweep (epic). Middle Man, Undue Influence and Clean Sweep are credits Tricks.

**The lore event** (`lore`, never drawn): every 50th event opened, counted over every run and
mode (`lethe.eventLog.v1`), is replaced by it while `LORE_ORDER` has a legendary left. It types
"?" and takes one word; the answer comes from `LORE_ANSWERS` (placeholders until the owner's
document); then that visit's legendary is offered, Take or Leave. Either way the next visit
offers the next one. After all twelve, any event has a 1% chance to be it, offering a legendary
you do not hold.

**Flow's event step:** a Flow reward chain can roll an EVENT screen (`FLOWR_DEF.odds.event` 5,
dev -> Flow). Events that take the board for grids of their own are left out
(`FLOWR_EVENT_OUT`: Hot Streak, Prize Ladder, Call It, Overtime).

## The unique goals (shipped)

45 proposals (the r706 workflow: three drafting lenses, a merge, two critics). The owner
shipped them as written (r709). Middle Man is licensed instead, its proposal kept below.

| Trick | Tier | Goal (live) | Why | Verdict |
|---|---|---|---|---|
| 3rd Time's a Charm | rare | Finish 3 runs | Your 3rd run is the charm, matching the Trick's 3rd card replay (a name pun, not counted toward the 30 unique goals). | |
| Cornered | rare | Score 200 corner cards | Cornered pays corner cards, so working the corners is the lesson. | |
| Crossroads | rare | Play 3 hands of 5 cards shaped like a +, T or L | Crossroads pays that 5-card shape, counted with the Trick's own test (isCross and a real 5-card hand), so the goal is learning to see it. | |
| Deep Breath | rare | Keep the clock paused for 60s in total | Deep Breath pays while the clock is paused, so live seconds the clock stood still are what it reads (not seconds granted). | |
| Deluge | rare | Play 12 Flush hands | Deluge rewinds the clock on Flushes only, and a flush is a flood. | |
| Interest | rare | Hold 50 credits at once | Interest scales with credits held, so saving up is the habit it pays. | |
| Lucky Sevens | rare | Score 77 7s | Lucky Sevens pays on every 7, and the name calls for sevens. | |
| Middle Man | rare | Licensed (proposed: Gain 300 credits) | Middle Man grows each time credits move, so a player who keeps money moving is ready. | |
| Quarter Chime | rare | Beat 6 bosses | A boss closes each quarter, so each one beaten is a quarter chime. | |
| Ripple | rare | Trigger 60 replays | A replay Trick unlocks by replaying cards, and it is the first step before Rerun's 150. | |
| The Kingfisher | rare | Pause or rewind the clock for 90s in total | The Kingfisher pays by seconds paused or rewound, so the goal counts both. | |
| The Woodpecker | rare | Trigger 4 replays in one hand | A woodpecker hits the same spot again and again, and the Trick replays one card several times. | |
| Type A | rare | Play the same hand type 5 times in a row | Type A pays during an unbroken same-type streak, and Type A people stick to one routine. | |
| Wildfire | rare | Play the same hand type 3 times in a row, 15 times | Wildfire fires on reaching a streak of 3, the exact event counted (once per streak). | |
| Bedrock | epic | Play Four of a Kind 4 times | Bedrock buffs the four cards of a Four of a Kind, so finding that hand is the whole Trick. | |
| Blood Diamonds | epic | Play 25 hands of only hearts and diamonds | Blood Diamonds pays hands made only of hearts and diamonds, so the goal is its own condition. | |
| Chorus | epic | Trigger 6 replays in one hand | Chorus multiplies mult on each replay, so a hand stacked well past the accidental 3 or 4 replays is the shape it turns huge. | |
| Collapsing Columns | epic | Play 10 Full Houses | It pays only on Full Houses, and a lifetime count stays fair when a run never reaches Selection Size 5. | |
| Critical | epic | Play 8 Flush hands in one run | Critical is a huge multiplier on flush hands, primary or layered, so fam:flush counts both (the nsFamPlays rule) and a flush-leaning run earns it. | |
| Double Dutch | epic | Play 3 hands with a pair within 30s, 10 times | Double Dutch pays exactly for 3 pair hands inside 30 seconds, so the goal is its own trigger. | |
| Feelin Lucky | epic | Sell 10 Tricks or Knacks | Feelin Lucky's twist is what happens when you try to sell it, so it unlocks for players who sell. | |
| Hands of Blue | epic | Play 10 hands in a 2x2 square | Hands of Blue pays the 2x2 shape (counted with its own isSquare test), so the goal is learning to see squares. | |
| Heads of State | epic | Score 400 face cards | Heads of state are royals, and the Trick doubles hands with a King beside another Royal. | |
| High Water | epic | Play 120 Run hands | Each Run pauses the clock longer for every Run this round, so a player who plays lots of Runs is ready for it. | |
| Inspirato | epic | Score 140 Aces | Inspirato primes Tricks on every Ace scored, so an Ace-hungry player unlocks it. | |
| Kaleidoscope | epic | Play 25 hands with all 4 suits | Kaleidoscope applies Focus once per suit, so mixing suits in a hand is the play. | |
| Landfill | epic | Discard 160 cards | Landfill counts every card swapped or discarded this game, so heavy discarding is what it pays. | |
| Ley Line | epic | Score 15 cards where a marked row and a marked column cross | Ley Line grows cards at line crossings, and Right Place plus Power Line set one up without it. | |
| Live Wire | epic | Score 250 cards from marked rows or columns | Live Wire multiplies line cards, so playing into marked lines is the skill. | |
| Magnitude | epic | Score 3,000 with one hand that holds a pair | Magnitude multiplies hands that hold a pair, so one big pair hand is what it celebrates (the number is set by the sim at about 3x a typical late-run hand and rechecked after balance passes). | |
| Marathon | epic | Play 55 Run hands in one run | A run-long commitment to Runs is the marathon its extra Focus applies on every Run reward (show live run progress in the pause menu). | |
| Obligatory | epic | Bank 12 challenge stages | Challenge cards are the game's obligations, so meeting them fits the name. | |
| Ornery | epic | Play 10 hands with 2 corner cards | Ornery multiplies every corner card, so reaching two corners in one hand is the play that doubles it twice. | |
| Overclock | epic | Fill the Focus bar 25 times in one run | Overclock doubles the Focus speed bonus, and filling the bar again and again is fast Focus play. | |
| Patient Rulers | epic | Pause or rewind the clock in 15 different rounds | Patient Rulers pays only in a round where the clock was paused or rewound, so counting those rounds teaches its rule. | |
| Perfect Timing | epic | Score 50 cards from marked rows or columns in one run | Perfect Timing replays every line card, so a run built on marked lines earns it. | |
| Rerun | epic | Trigger 150 replays | Rerun pays on every replay, so the unlock is replaying lots of cards (same-suit hands replay through their flush layer, no replay Trick needed). | |
| Straight Shot | epic | Play 2 hands of 5 cards in a straight line | Straight Shot fires on 5 cards in a straight line, which needs a bigger board and Selection Size 5, so a lifetime count keeps it reachable (counter = realHandOfSize(cells,5) and a straight line). | |
| Temporal Rift | epic | Score 3 cards where a marked row and a marked column cross | A rift is where two lines cross, the Trick's exact trigger, and this is the first small step before Ley Line's 15. | |
| The Cuckoo | epic | Trigger 45 replays in one run | The Cuckoo pauses by replays this round, so a run dense with replays teaches the count it reads. | |
| The Falcon | epic | Play 8 hands while the clock is paused | The Falcon pays for hands played during a pause, and since a hand ends a pause each one teaches timing a play into it. | |
| The Vulture | epic | Discard 12 cards while the clock is paused | The Vulture buffs cards discarded during a pause, so discarding into pauses is the habit. | |
| Tide Table | epic | Play 5 Run hands in one round | Tide Table grows with every Run scored in the round, so stacking Runs in one round is the habit it pays for. | |
| Undertow | epic | Play 20 Run hands of 4 or more cards | Undertow pays more for every card past 3 in a Run, and a Run of 4 shows that without needing Selection Size 5. | |
| What are The Odds | epic | Score 700 odd-ranked cards | What are The Odds multiplies odd ranks, and a lifetime count stays fair across short and long modes. | |

## Win tokens (r709)

A won run in Classic, Flow or the Schedule pays 1 token, at most 3 a mode (owner: until
difficulties exist). Custom, Poker Squares and the hidden modes pay none; a test drive pays
none; a run continued into Endless pays once. The finale prints "+1 TOKEN · FLOW 1/3". Builds'
UNLOCKS screen shows the tokens and SPEND A TOKEN: three locked Tricks with a goal (not the
licensed ones), unlock one; KEEP THE TOKEN closes it. Kept in `lethe.meta.v1` (`tokens`).
No daily seeds (owner).

## Every Trick

| Trick | Tier | How | Goal | Verdict |
|---|---|---|---|---|
| Compost | common | goal | Discard 30 cards | |
| Cull | common | goal | Swap 15 times | |
| Echoes | common | goal | Play the same hand type 3 times in a row, 2 times | |
| Encore | common | goal | Score 150 odd-ranked cards | |
| Every Day Essentials | common | goal | Score 120 cards of rank 6 or lower | |
| Expanse | common | goal | Fill the Focus bar 20 times | |
| First Wind | common | goal | Fill the Focus bar 5 times | |
| Five for Fodder | common | goal | Discard 50 cards | |
| Magician | common | goal | Use a Sleight 6 times | |
| Men of Repute | common | goal | Score 80 face cards | |
| Middle Management | common | goal | Play 25 hands of 4 cards | |
| More Better | common | goal | Finish 2 runs | |
| Near Extinction | common | goal | Clear 12 rounds | |
| Quick Draw | common | goal | Play 80 hands | |
| Ready, Set, Go | common | goal | Play 25 hands of 3 cards | |
| Release Valve | common | goal | Fill the Focus bar 10 times | |
| Second Hand | common | goal | Play 120 hands | |
| Shaky Foundation | common | goal | Play 50 Set hands | |
| Tick-Tock | common | goal | Clear 16 rounds | |
| Unsummit | common | goal | Clear 8 rounds | |
| Wave Amplification | common | goal | Play 35 Run hands | |
| Aftershock | common | start |  | |
| Cascade | common | start |  | |
| Combo Score | common | start |  | |
| Early Bird | common | start |  | |
| Enriched | common | start |  | |
| Face Value | common | start |  | |
| First Light | common | start |  | |
| Four Eyes | common | start |  | |
| Get Even | common | start |  | |
| Kindling | common | start |  | |
| Night Owl | common | start |  | |
| Nimble | common | start |  | |
| On the Edge | common | start |  | |
| Power Line | common | start |  | |
| Rhythm | common | start |  | |
| Rich Soil | common | start |  | |
| Right Place | common | start |  | |
| Storm | common | start |  | |
| Tidal Forces | common | start |  | |
| Tunnel Vision | common | start |  | |
| 3rd Down | rare | goal | Play 60 hands of 3 cards | |
| Acorns | rare | goal | Score 1,500 cards | |
| Coin and the Sword | rare | goal | Gain 150 credits | |
| Dam Holding… | rare | goal | Play 130 Run hands | |
| Diversity | rare | goal | Play 60 hands of 4 cards | |
| Double Take | rare | goal | Score 50 2s | |
| Eagle Eye | rare | goal | Play 300 hands | |
| Echo Location | rare | goal | Score 100 cards from marked rows or columns | |
| Five Second Rule | rare | goal | Play 80 hands of 5 cards | |
| Flow State | rare | goal | Reach Focus x1.5 | |
| Groove | rare | goal | Score 200 cards from marked rows or columns | |
| Head Start | rare | goal | Clear 25 rounds | |
| Hyper Focus | rare | goal | Reach Focus x2 | |
| Inclusive | rare | goal | Play 120 hands of 5 cards | |
| Life Lessons | rare | goal | Clear 55 rounds | |
| Meditation | rare | goal | Fill the Focus bar 35 times | |
| Minute Hand | rare | goal | Clear 35 rounds | |
| Overtime | rare | goal | Rewind the clock 10 times | |
| Penny Saved | rare | goal | Score 80 5s | |
| Perfect Ten | rare | goal | Discard 100 cards | |
| Plan Ahead | rare | goal | Play 450 hands | |
| Prime Times | rare | goal | Score 400 prime-ranked cards (A 2 3 5 7) | |
| Resonance | rare | goal | Play 100 Pairs | |
| Right Time | rare | goal | Score 150 cards from marked rows or columns | |
| Rising Tide | rare | goal | Clear 45 rounds | |
| Rogue Wave | rare | goal | Play 80 Run hands | |
| Sands of Time | rare | goal | Clear a round with 90s left | |
| Sideways to Infinity | rare | goal | Score 100 8s | |
| The Albatross | rare | goal | Keep the clock paused for 90s in total | |
| The Heron | rare | goal | Play 250 hands | |
| The Hummingbird | rare | goal | Pause the clock 12 times | |
| the little guys | rare | goal | Score 350 cards of rank 6 or lower | |
| Traveler | rare | goal | Play 400 hands | |
| Wait Four It | rare | goal | Play 80 hands of 4 cards | |
| Wellspring | rare | goal | Fill the Focus bar 50 times | |
| Wild Side | rare | goal | Finish 4 runs | |
| Middle Man | rare | license | Licensing event | |
| Mirror | rare | license | Licensing event | |
| Scalper | rare | license | Licensing event | |
| Balance | rare | start |  | |
| First Fruits | rare | start |  | |
| Full Load | rare | start |  | |
| Lie Down | rare | start |  | |
| Odd One In | rare | start |  | |
| Prime Time | rare | start |  | |
| Quake | rare | start |  | |
| Rainbow | rare | start |  | |
| Sediment | rare | start |  | |
| Stand-Up | rare | start |  | |
| Study Hall | rare | start |  | |
| The Swift | rare | start |  | |
| Torrent | rare | start |  | |
| 3rd Time's a Charm | rare | unique | Finish 3 runs | |
| Cornered | rare | unique | Score 200 corner cards | |
| Crossroads | rare | unique | Play 3 hands of 5 cards shaped like a +, T or L | |
| Deep Breath | rare | unique | Keep the clock paused for 60s in total | |
| Deluge | rare | unique | Play 12 Flush hands | |
| Interest | rare | unique | Hold 50 credits at once | |
| Lucky Sevens | rare | unique | Score 77 7s | |
| Quarter Chime | rare | unique | Beat 6 bosses | |
| Ripple | rare | unique | Trigger 60 replays | |
| The Kingfisher | rare | unique | Pause or rewind the clock for 90s in total | |
| The Woodpecker | rare | unique | Trigger 4 replays in one hand | |
| Type A | rare | unique | Play the same hand type 5 times in a row | |
| Wildfire | rare | unique | Play the same hand type 3 times in a row, 15 times | |
| Assembly Line | epic | goal | Score 350 cards from marked rows or columns | |
| Cloud Nine | epic | goal | Play 700 hands | |
| D6 | epic | goal | Score 2,500 cards | |
| Dark Matter | epic | goal | Score 3,000 cards | |
| Double Jeopardy | epic | goal | Pause the clock 30 times | |
| Eye of the Storm | epic | goal | Score 500 face cards | |
| Feng Shui | epic | goal | Score 300 cards from marked rows or columns | |
| Gnomes | epic | goal | Score 600 cards of rank 6 or lower | |
| High Voltage | epic | goal | Score 300 cards from marked rows or columns | |
| Hourglass | epic | goal | Clear 70 rounds | |
| Hyperphagia | epic | goal | Swap 120 times | |
| Portfolio | epic | goal | Improve 15 times | |
| Royal Favour | epic | goal | Score 600 face cards | |
| Suggestive | epic | goal | Bank 8 challenge stages | |
| Temp | epic | goal | Finish 6 runs | |
| Threepeat | epic | goal | Score 200 Aces | |
| Clean Sweep | epic | license | Licensing event | |
| Undue Influence | epic | license | Licensing event | |
| Compound | epic | start |  | |
| Even Better | epic | start |  | |
| Four Horse-man | epic | start |  | |
| Heartwood | epic | start |  | |
| Twinners | epic | start |  | |
| Bedrock | epic | unique | Play Four of a Kind 4 times | |
| Blood Diamonds | epic | unique | Play 25 hands of only hearts and diamonds | |
| Chorus | epic | unique | Trigger 6 replays in one hand | |
| Collapsing Columns | epic | unique | Play 10 Full Houses | |
| Critical | epic | unique | Play 8 Flush hands in one run | |
| Double Dutch | epic | unique | Play 3 hands with a pair within 30s, 10 times | |
| Feelin Lucky | epic | unique | Sell 10 Tricks or Knacks | |
| Hands of Blue | epic | unique | Play 10 hands in a 2x2 square | |
| Heads of State | epic | unique | Score 400 face cards | |
| High Water | epic | unique | Play 120 Run hands | |
| Inspirato | epic | unique | Score 140 Aces | |
| Kaleidoscope | epic | unique | Play 25 hands with all 4 suits | |
| Landfill | epic | unique | Discard 160 cards | |
| Ley Line | epic | unique | Score 15 cards where a marked row and a marked column cross | |
| Live Wire | epic | unique | Score 250 cards from marked rows or columns | |
| Magnitude | epic | unique | Score 3,000 with one hand that holds a pair | |
| Marathon | epic | unique | Play 55 Run hands in one run | |
| Obligatory | epic | unique | Bank 12 challenge stages | |
| Ornery | epic | unique | Play 10 hands with 2 corner cards | |
| Overclock | epic | unique | Fill the Focus bar 25 times in one run | |
| Patient Rulers | epic | unique | Pause or rewind the clock in 15 different rounds | |
| Perfect Timing | epic | unique | Score 50 cards from marked rows or columns in one run | |
| Rerun | epic | unique | Trigger 150 replays | |
| Straight Shot | epic | unique | Play 2 hands of 5 cards in a straight line | |
| Temporal Rift | epic | unique | Score 3 cards where a marked row and a marked column cross | |
| The Cuckoo | epic | unique | Trigger 45 replays in one run | |
| The Falcon | epic | unique | Play 8 hands while the clock is paused | |
| The Vulture | epic | unique | Discard 12 cards while the clock is paused | |
| Tide Table | epic | unique | Play 5 Run hands in one round | |
| Undertow | epic | unique | Play 20 Run hands of 4 or more cards | |
| What are The Odds | epic | unique | Score 700 odd-ranked cards | |
| Ace Absorb | legendary | goal | Win 1 run | |
| Buried Treasure | legendary | goal | Win 1 run | |
| Five Stack | legendary | goal | Win 1 run | |
| Hard Labour | legendary | goal | Win 1 run | |
| Jackpot | legendary | goal | Win 1 run | |
| Monopoly | legendary | goal | Win 1 run | |
| Obsessed | legendary | goal | Win 1 run | |
| Old Growth | legendary | goal | Win 1 run | |
| Relentless | legendary | goal | Win 1 run | |
| Richter | legendary | goal | Win 1 run | |
| The Phoenix | legendary | goal | Win 1 run | |
| Twenty-One | legendary | goal | Win 1 run | |
