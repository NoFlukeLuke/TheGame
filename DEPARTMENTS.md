# Departments: the Schedule's lanes (chunk 1, draft r657-r658)

Nothing here is built. Pairings and tiles are decided (r658); the event pools and the small
extras below are proposals waiting on the owner.

**r663:** `CHALLENGE_REWARDS.md` proposes ONE department a quarter instead of one a lane (eight
departments, leaning less hard, and paying the quarter's challenge cards).

## Decided (owner, r656-r657)
- **Eleven departments:** Sales, Marketing, Accounting, IT, HR, Operations, Legal, R&D,
  Procurement, Customer Support, Communications. Each quarter's map draws four, one per lane.
- **Favourites:** a department is twice as likely to be drawn in its favourite quarter(s).
- **Lean:** a department's tile focus is twice as likely in its column, and half of the entity
  tiles on its reward grids carry its reward focus.
- **Events:** an event tile in a column is a random event 20% of the time, otherwise one from
  that department's pool. **Event tiles are not labelled** (the tile reads EVENT); players
  learn each department's pool by playing.
- **Streak perks** (booking one department in back-to-back slots) are dropped from the
  departments and parked as a possible Knack (TODO.md, section 1).
- **(r658) Option A to start:** a department changes only what shows up in its column (tile mix,
  rewards, events). A round booked in its column plays like any other. A small extra per
  department (option B, list below) is for later, if the columns still feel alike.
- **(r658) The pairings below stand.** The shop and the pick of three in a column lean toward its
  reward focus too. An event's name stays hidden until you clock in (the command line reads
  "> EVENT").
- **(r658) New tiles:** TRAINING, FILING and CALENDAR SYNC go in; INTERVIEW does not. CALENDAR
  SYNC only appears in slots 1 and 2 (later, it would confirm almost nothing).
- **The shape stays:** 4 slots, then the review row (chunk 2 turns that row into two bosses).

## Focuses

A department has one TILE focus and one REWARD focus.

### Tile focuses (which tile is twice as likely in its column)
| focus | tile |
|---|---|
| Rounds | ACCOUNT |
| Hard rounds | PRIORITY |
| Challenge rounds | AUDIT |
| Shops | MART |
| Reward grids | INCENTIVE |
| Events | EVENT |
| Raises | RAISE |
| Mysteries | ??? |

### Reward focuses (half the entity tiles on its reward grids carry it)
Counts are live Tricks / Knacks / Sleights carrying any of the tags (r657). A focus needs
enough members that half a grid can come from it without repeating.

| focus | tags | T | K | S | all |
|---|---|---|---|---|---|
| Per card | card | 78 | 8 | 7 | 93 |
| Mult | mult, xmult | 68 | 1 | 9 | 78 |
| Time | time, clock, pause | 41 | 15 | 10 | 66 |
| Board and lines | position, line, board | 31 | 7 | 19 | 57 |
| Ranks and suits | rank, suit, wild | 43 | 6 | 6 | 55 |
| Hand types | run, set, flush, size, streak | 44 | 4 | 4 | 52 |
| Pips | pips, xpips | 44 | 1 | 4 | 49 |
| Focus | focus | 36 | 9 | 4 | 49 |
| Growth | scaling | 30 | 8 | 6 | 44 |
| Swaps and discards | stock, swap, discard | 12 | 17 | 9 | 38 |
| Between rounds | level, reward, start, boss, limit, shield, challenge, info | 6 | 27 | 2 | 35 |
| Replays | replay, replays, retrigger | 21 | 10 | 3 | 34 |
| Luck | chance, luck | 16 | 16 | 1 | 33 |
| Credits | credits, held, shop | 10 | 11 | 4 | 25 |
| Deck and buffs | deck, buffed | 14 | 2 | 9 | 25 |
| Your loadout | tricks, sleights, charges | 9 | 13 | 1 | 23 |

Mult and Per card are so common (most scoring Tricks carry them) that leaning on them changes
little. The bottom three are thin; a grid leaning on them repeats sooner.

## Departments (decided r658)
| department | tile focus | reward focus | favourite |
|---|---|---|---|
| Sales | Rounds | Hand types | Q2 |
| Marketing | Events | Focus | Q1 |
| Accounting | Shops | Credits | Q4 |
| HR | Raises | Your loadout | Q3 |
| Legal | Challenge rounds | Time | Q4 |
| Operations | Hard rounds | Swaps and discards | Q2 |
| R&D | Mysteries | Growth | Q1 |
| IT | Reward grids | Board and lines | Q2 |
| Procurement | Reward grids | Deck and buffs | Q3 |
| Customer Support | Rounds | Replays | Q3 |
| Communications | Events | Ranks and suits | Q1 |

Three per quarter, two in Q4. Unused reward focuses: Per card, Mult, Pips, Between rounds, Luck.

## Every Schedule tile

### On the map today
| tile | what it is | pays |
|---|---|---|
| ACCOUNT | an ordinary round | payout, pick of three |
| PRIORITY | a round with a raised goal and one extra ask | credits, a Knack pick |
| AUDIT | a round with 3 challenge cards and an extra minute | prize grid, or penalty grid if a card is unsolved |
| MART | the shop | spend credits |
| INCENTIVE | a reward grid | a path of tiles |
| EVENT | one event screen | the event's |
| Two-slot EVENT | an event spanning two slots | the event's, costs a booking in each |
| RAISE | a limit break | raise a limit, or trade one for credits |
| ??? | a mystery: any of the above, hidden until confirmed | as revealed |
| Not scheduled | a blank cell | nothing to book |
| REVIEW | the boss | ends the quarter |

### New tiles (TRAINING, FILING, CALENDAR SYNC decided r658; INTERVIEW cut)
| tile | what it would be | cost to build |
|---|---|---|
| TRAINING | improve one owned Trick, Knack or Sleight of your choice | small: Flow's improve step exists |
| FILING | the deck editor (buff, cut, copy cards) | small: Flow's deck editor exists |
| SIDE PROJECT | a tag on two linked tiles (chunk 4) | medium |
| OVERDUE | a tile that moves down a slot when left (chunk 5) | medium |
| CALENDAR SYNC | confirms every mystery this quarter; slots 1 and 2 only | small |
| Second REVIEW | the two-boss quarter (chunk 2) | large |

## Event pools (proposal, r658)

32 live events. An event tile in a column draws from its department's pool 80% of the time and
from every event 20%. An event the player cannot use right now (Line Shift with fewer than two
marked lines, Clean Slate with nothing to clean...) is skipped as today; a pool with nothing
usable falls back to every event. Every live event is in at least one pool; **bold** = in no
other pool, so the department can be learned by it.

| department | pool |
|---|---|
| Sales | **Hot Streak**, **Prize Ladder**, **Keep It**, **Static Bonus** |
| Marketing | **Plinko**, **Spin to Improve**, Theme Draft, Free Pick |
| Accounting | **The Investment**, Card Market, Deck Trim |
| HR | **Trade a Trick**, **Tray Order**, **Trick Gamble**, Free Pick |
| Legal | **Overtime**, **Reschedule**, **Clean Slate**, Call It |
| Operations | **Maintenance**, Line Shift, Clean Up |
| R&D | **Card Upgrade**, **Rewire**, **State Change**, **The Gamble** |
| IT | **Grid Spinner**, **Entity Slots**, Line Shift |
| Procurement | **Card Slots**, Card Market, Deck Trim, Pairs |
| Customer Support | **Extra Rep**, Pairs, Clean Up |
| Communications | **Wild Cards**, **Luck Dice**, Theme Draft, Call It |

## Small extras (option B, for later; owner to decide if worth building)

One small thing a round booked in that column gets. Each uses a hook the game already has.

| department | extra |
|---|---|
| Sales | +3 credits on the clear |
| Marketing | starts with +5 Focus |
| Accounting | +1 interest on its payout |
| HR | +1 swap |
| Legal | starts with +15s |
| Operations | +1 discard |
| R&D | its pick of three shows four |
| IT | one random Sleight you own gets +1 charge |
| Procurement | one card on the starting board gets a random buff for the round |
| Customer Support | the first hand's first card replays once |
| Communications | a random Trick is primed once |

Other candidates: goal 5% lower; the first swap is free of time; Early Finish Bonus doubled;
+1 Luck for its pick of three; +1 Selection Size for the first hand.
