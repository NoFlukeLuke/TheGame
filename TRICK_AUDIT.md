# Trick audit, r804 (bonuses only)

Asked: based only on the numbers a Trick pays, which Tricks sit outside their rarity's average.
Conditions (how often a Trick fires) are ignored on purpose.

**Method.** The 199 live Tricks were dumped from BAL (`tools/trick-sheet.js all`). Each was put
in a group by what it pays: pips per card, mult per card, pips per hand, mult per hand, x mult
per hand, x mult per card, x pips, Focus, replays, seconds, and scaling rates. Each group was
averaged within its rarity. A Trick about 40% or more above or below its group's average is
listed. The 18 fused Tricks are left out (each is two Tricks added together). Tricks that pay
no number (Mirror, Temp, Trade In, Severance Package...) are left out.

## Common (42)

Averages: pips per card 19 (Express Lane, Get Even, On the Edge, Right Place, Early Bird, Face
Value) · mult per card 12 (Climb the Ladder, Vestir a Camisa, Perk Package, Night Owl, Power Line)
· mult per hand 22 (Agile, Ready Set Go, Four Eyes, Semi-Dependable, Second Hand) · pips per hand 60.

| Trick | pays | vs average |
|---|---|---|
| **Above** | | |
| Cash Cow | Aces score 42 pips (+31) | 1.6x the pips per card |
| Enriched | +100 pips a hand | 1.7x; more than every rare pips-per-hand Trick (Chain of Command 80, Quarter Chime 60) |
| Crunch | every card replays once | a whole-hand replay; no rare replays a whole hand |
| Same Old | every card replays once | same as Crunch |
| Twynergy | +4 Focus per card | 4x the rare per-card Focus (Baby Steps 1, Study Hall 1) |
| Joint Venture | x2 pips | the only x bonus at common; equals rare Deep Breath |
| **Below** | | |
| Perk Package | +6 mult per card | 0.5x (it has no condition) |
| Men of Means | +8 pips and +8 mult per card | each half its group (about average together) |
| Borderline: Agile +30 mult (1.36x), Night Owl +16 mult per card (1.37x) | | |

## Rare (68)

Averages: pips per card 21 (Full Load, Prime Time, Flow State) · mult per card 11 (Esprit de
Corps, Work-Life, Odd One In, Equal Opportunity, Lie Down, Stand-Up) · mult per hand 32
(Crossroads, Inclusive, Chain of Command) · Focus about 6 a trigger · seconds 6 a trigger.

**Rare's per-card numbers are no higher than common's** (pips 21 against 19, mult 11 against 12).

| Trick | pays | vs average |
|---|---|---|
| **Above** | | |
| Eagle Eye | +15 mult per 5s without a swap (3 a second) | 5x The Swift (0.6 a second); 540 mult over 3:00 |
| Crossroads | +25 Focus and +25 mult | 4x rare Focus; more than epic Hands of Blue (+16 Focus, +24 mult) |
| Inclusive | +50 mult | 1.6x |
| Company Time | rewinds 15s | 2.5x (Please Hold 3s, Five Second Rule 5s) |
| The Heron | +2 mult a second since the last hand | 3x The Swift's rate |
| Borderline: Prime Time +29 pips per card (1.36x) | | |
| **Below** | | |
| Odd One In | +7 mult per card | 0.65x, under the common average |
| Equal Opportunity | +8 mult per card | 0.75x, under the common average |
| Flow State | +15 pips per card | 0.7x, under the common average |
| Hyper Focus | 2x the Focus multiplier as mult per card (about 2-6) | about a third of the group |
| 3rd Down | +3 Focus | 0.5x |
| 生きがい | +1 mult per 30 Focus made this game | the slowest rare scaler |

## Epic (59 without the fused ones)

Averages: x mult per hand x2.55 (Partnered, Nepo Baby, Director's Cut, Corporate Culture, Growth
curve) · x mult per card x1.53 (Sonic Logo, Ornery, High Voltage, Never Tell Me, True Leader,
Feelin Lucky) · x pips about x1.86 (Better Bigger, Twinners, Rerun, Live Wire, Even Better at its
66%) · mult per hand 25 (Hands of Blue, Red Water Diamonds, Threepeat, Four Times a Zombie) ·
Focus 13 (Booked, Água mole, Director's Cut, The Falcon, Hands of Blue, Threepeat).

| Trick | pays | vs average |
|---|---|---|
| **Above** | | |
| Corporate Culture | x5 mult on flush-type hands | 2x the group |
| Ornery | x2 mult per corner card | the bonus part (+1) is 1.9x the group's |
| Twinners | x3 pips on set-type hands | bonus part 2.3x; the same number as legendary Blackjack |
| Água mole, pedra dura | +20 Focus | 1.5x |
| **Below** | | |
| High Voltage | x1.2 mult per line card | bonus part 0.4x |
| Feelin Lucky | x1.25 mult on five ranks | bonus part 0.5x |
| Live Wire | x1.2 pips per line card | bonus part 0.25x |
| Rerun | x1.25 pips per replay | bonus part 0.3x |
| Growth curve | starts at x1.25 mult | 0.5x (grows per Run) |
| Partnered | x1.5 mult | 0.6x |
| Hands of Blue, Red Water Diamonds, Threepeat, Four Times a Zombie | +24 to +27 mult a hand | the epic flat-mult group (25) is the common level (22) and under rare (32) |
| Compound | +0.1 mult per hand, for good | about +15 over a whole run; the slowest scaler in the game |
| Matrix Management | +2 mult on a card, for good | UVP gives +5 / +5, Board of Directors +8 |
| Threepeat | +9 Focus | 0.7x |

## Legendary (12)

Too few and too different to average; set against the strongest epic numbers instead.

| Trick | pays | note |
|---|---|---|
| Blackjack | x3 pips at exactly 21 | an epic number (Twinners pays x3 on every set) |
| Five Stack | +15 pips per card on 5-card hands | under rare Full Load (+20 on the same hands); its +20 mult and +1 Focus carry it |
| Buried Treasure | x1.1 credits per diamond, at half your Luck | the smallest number at legendary |
| Relentless | x0.05 mult per spade scored since taken | does nothing for the first 20 spades |
| In line: Jackpot (x1.5 per Jack, x5 with four), Obsessed, Equity Experience, Hard Labour, The Phoenix, Aceimilation, Monopoly | | |

# Base card buff to +25 (r804, done)

A flat card buff offered anywhere is now +25 pips or +25 mult (was +10 to +15 pips, +8 to +12 mult,
so about 2.1x the pips and 2.7x the mult). Changed: the deck editor rows (`FLOWR_DECK_OPS`, which also
feed the Balance Sheet's buff tiles, card packs, the Reserve, the Lockbox, the challenge Card buffs
reward, Card Slots, Pairs and every event that rolls a buff), the shop's buffed cards (12 pips / 5 mult),
the Balance Sheet's fallback Blessed Card (12), the Bench event's mult boon (6), Bargain's two pips
trades (15 and 20), Dealer's Choice's cards (12 pips / 5 mult) and the payout pick's Boost (12). Left
alone: Bargain's +40 (already over), every x buff, replay, time and credits buff, and Card Upgrade's
GROWING buffs (+8 pips / +5 mult a score, `BAL.forge`), which are a different kind.

# Tricks and Knacks that buff cards: recommended amounts (not applied)

| Entity | what it does | now | recommend |
|---|---|---|---|
| Middle Management (common Trick) | 4-card hands: the 4th card gains pips for good | +8 pips | +16 |
| First Impressions (rare Trick) | each card of the round's first hand gains pips for good | +5 (ladder +5 a step) | +10 (ladder +10) |
| Board of Directors (epic Trick) | Four of a Kind: its 4 cards gain pips for good | +8 each | +20 |
| UVP (epic Trick) | when scored, the centre-most card gains pips and mult | +5 / +5 (ladder +10) | +10 / +10 (ladder +20) |
| Matrix Management (epic Trick) | cards scored where a row and column effect cross gain mult | +2 mult | +6 |
| D6 (epic Trick) | every 6th card scored gains a random 1-6 pips or mult | 1-6 | 2-12 (the roll x2) |
| Hallmark (rare Knack) | once a round a marked card, when scored, takes a random buff | +10 pips / +5 mult | +25 / +25 (the base buff) |
| Finishing Touch (rare Knack) | a cleared level with few buffed cards buffs 3 cards | base rows | already +25 (reads the base) |
| Morning Brew (rare Knack) | 10 Focus: the next hand's first card takes a buff | base rows | already +25 |
| Curio (rare Knack) | a new card joins the deck each round with a random buff | base rows | already +25 |
| Overachiever (epic Knack) | every buff a card gains is doubled | x2 | no change; a base buff is now +50 with it |
| Hourglass, Wait Four It, The Vulture | replay / pause buffs | | no change (not pips or mult) |

Sleights, for the same pass: The Naturalist +5 pips -> +10, The Catalyst +10 / +10 -> +20 / +20,
Pivot +8 mult -> +20, The Naturalist's second buff +5 mult -> +10. The Bomb (+3 pips on the whole
grid) unchanged.

**r817: applied** (owner), with the averages pass in CLAUDE.md r817.
