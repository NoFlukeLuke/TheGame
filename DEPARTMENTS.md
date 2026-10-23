# Departments: the Schedule's lanes (chunk 1, draft r657)

Nothing here is built. The owner picks from these lists; events are chosen after the focuses.

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

## Departments, suggested pairings (owner to edit)
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

### Candidates (not built)
| tile | what it would be | cost to build |
|---|---|---|
| TRAINING | improve one owned Trick, Knack or Sleight of your choice | small: Flow's improve step exists |
| FILING | the deck editor (buff, cut, copy cards) | small: Flow's deck editor exists |
| INTERVIEW | a pick of three with no round | small: the pick exists |
| SIDE PROJECT | a tag on two linked tiles (chunk 4) | medium |
| OVERDUE | a tile that moves down a slot when left (chunk 5) | medium |
| CALENDAR SYNC | confirms every mystery this quarter | small |
| Second REVIEW | the two-boss quarter (chunk 2) | large |
