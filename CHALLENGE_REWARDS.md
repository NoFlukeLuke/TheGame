# Rule Sleights, a department a quarter, two-stage challenges, changing entities (draft r663-r665)

Nothing here is built. The owner's ideas, written up for review. Names marked
**(owner names)** are left blank on purpose.

## 1. Rule Sleights

A Sleight that changes how the game works while it sits on the board.

- **Lands:** spends a charge (4 charges; at 0 it is gone for good, like Autopilot).
- **While on the grid:** its rule is in force.
- **Inert from the moment it lands.** Inert is the game's word already (r341, Piggy Bank and
  Capacitor): it cannot be swapped or discarded, and it can still be selected into a hand.
  `card._inert` and `cardCan` do the work today. (The curse version on a normal card is
  **Snared**.)
- **Leaves** when it is played in a hand (it rides along, does not change the hand, but takes a
  slot of the Selection Size) or when the board redeals at the round's end. Either way the rule
  ends and the card cycles back into the deck with its charges.
- Its rule is a board rule, not a card buff, so the Quarter resource limits (QRL) do not cap it.
  The replay one is a QRL replay source like any other.

Descriptions in the game's Sleight style:

| # | name | rarity (suggested) | description |
|---|---|---|---|
| A | (owner names) | epic | When it lands, two random ranks are named on its face. While it is on the grid, cards of those ranks replay once. Inert: it cannot be swapped or discarded, only played. (4 charges) |
| B | (owner names) | common | While it is on the grid, even-ranked cards (2, 4, 6, 8, 10) score +2 Focus. Inert: it cannot be swapped or discarded, only played. (4 charges) |
| C | (owner names) | rare | While it is on the grid, face cards (J, Q, K) rewind the clock 2s when scored. Inert: it cannot be swapped or discarded, only played. (4 charges) |

Notes:
- A: two different ranks, drawn from ranks in the deck, shown on the card face.
- B and C pay per scoring, so a replayed card pays again (a King that replays rewinds 4s).
- C is a rewind, so Overtime's clock miss can stop it, like any rewind.

Spares, if one of the three does not land:

| # | description |
|---|---|
| D | When it lands, a random suit is named on its face. While it is on the grid, cards of that suit score +3 mult. |
| E | While it is on the grid, odd-ranked cards (A, 3, 5, 7, 9) score +5 pips. |
| F | While it is on the grid, swaps cost no seconds. |
| G | While it is on the grid, the first card of every hand replays once. |

## 2. A department a quarter

Replaces DEPARTMENTS.md's one-department-per-lane plan. Each quarter's Schedule has ONE
department. It covers the whole map, so it leans less hard than a lane did.

**Eight departments.** Cut: Communications (its events overlap Marketing's), Customer Support
(same tile focus as Sales) and Procurement (same tile focus as IT). That leaves exactly one
department per tile focus.

| department | tile focus | reward focus | favourite |
|---|---|---|---|
| Sales | Rounds | Hand types | Q2 |
| Marketing | Events | Focus | Q1 |
| Accounting | Shops | Credits | Q4 |
| HR | Raises | Your loadout | Q3 |
| Legal | Challenge rounds | Time | Q4 |
| Operations | Hard rounds | Swaps and discards | Q2 |
| R&D | Mysteries | Growth | Q1 |
| IT | Reward grids | Board and lines | Q3 (was Q2) |

Two favourites a quarter. A run draws four of the eight, no repeats.

**Less strict (proposed numbers, owner to tune):**

| lean | lane plan (r658) | quarter plan |
|---|---|---|
| tile focus | x2 in its column | x1.5 across the map |
| reward focus | half the entity tiles on its reward grids | a third |
| events | 80% from its pool, 20% any | 60% from its pool, 40% any |
| challenge payouts | none | section 4 |

The department's name goes on the schedule screen's header and the quarter card. Event tiles
stay unlabelled.

Reward focuses with no department now: Replays, Deck and buffs, Ranks and suits (plus the
five already unused: Per card, Mult, Pips, Between rounds, Luck).

**Event pools for eight.** The cut departments' own events move: Extra Rep to Sales, Luck
Dice to Marketing, Pairs to Accounting, Wild Cards to R&D, Card Slots to IT. All 32 live
events are still in at least one pool.

| department | pool |
|---|---|
| Sales | Hot Streak, Prize Ladder, Keep It, Static Bonus, Extra Rep |
| Marketing | Plinko, Spin to Improve, Theme Draft, Free Pick, Luck Dice |
| Accounting | The Investment, Card Market, Deck Trim, Pairs |
| HR | Trade a Trick, Tray Order, Trick Gamble, Free Pick |
| Legal | Overtime, Reschedule, Clean Slate, Call It |
| Operations | Maintenance, Line Shift, Clean Up |
| R&D | Card Upgrade, Rewire, State Change, The Gamble, Wild Cards |
| IT | Grid Spinner, Entity Slots, Card Slots, Line Shift |

## 3. Every challenge has two stages and one payout

- **Two stages.** Clear stage 1, then take it (tap) or raise (double-tap), as today. Unanswered,
  it takes after 6s, as today.
- **One payout.** Stage 1 pays the reward's first tier. A raise that clears pays the second
  tier INSTEAD (not as well). A raise that fails pays nothing.
- **What it pays comes from the department** (section 4), and from the challenge's class:
  - **Standard:** stage 1 starts at difficulty 1.
  - **Hard:** stage 1 starts at difficulty 2 or more (the line `CR_BONUS_D` already draws).
- The card's face names both tiers of its payout, so the raise is a choice you can see.
- Rewards that open a screen (a pick, the Limit Break) wait for the round's end, the way the
  mini grid waits today. The rest pay at once.

**The asks, cut to two stages.** Stage 1 is today's first tier, stage 2 today's second; third
tiers go. Numbers are hands (or impacts) needed.

| ask | stage 1 | stage 2 | class |
|---|---|---|---|
| N hands touching | 3 | 5 | Standard |
| Pair, Run of 3, Three of a Kind (a spare card in the hand) | 3 | 5 | Standard |
| same, needing every selected card | 2 | 3 | Standard |
| Two Pair, Run of 4, Straight (spare card) | 2 | 3 | Standard |
| same, needing every card | 1 | 2 | Hard |
| Flush, Full House, Straight Flush, Four of a Kind (spare card) | 1 | 2 | Hard |
| same, needing every card | 1 | 2 (new; one tier today) | Hard |
| 3 of a suit in one hand, Selection 5+ | 1 | 2 | Standard |
| same, Selection 4 | 1 | 2 | Hard |
| hands of 4+ cards, Selection 5+ | 2 | 4 | Standard |
| same, Selection 4 | 1 | 2 | Hard |
| N hand types | 3 | 5 | Hard |
| one big hand | 1.3x a typical hand | 1.8x | Hard |
| fall cards (IMPACT) | 2 | 3 | Standard |
| any of the above, touching the card | same numbers | | one class up |

A challenge round (AUDIT, Classic's node 3): card 1 is Standard, cards 2 and 3 Hard.

Goes away: `CR_FLOW_STAKES` (credits and seconds by difficulty), the mini grid for a d2+ take,
third tiers.

## 4. The rewards

Each reward is two tiers: stage 1 / stage 2. Owner's list first, then the new ones.

### Standard (paid by Standard challenges)

| reward | stage 1 | stage 2 | from |
|---|---|---|---|
| Credits | +8 credits | +20 credits | owner |
| Time | rewind the clock 15s | rewind the clock 30s | owner |
| Rerolls | 2 free rerolls on reward picks | 5 free rerolls | owner |
| Reward grid size | +1 selection on your next reward grid | +2 | owner |
| Sleight charges | +1 charge to every Sleight in your deck | every Sleight back to full charges | owner |
| Swaps and discards | +2 swaps and +2 discards this round | +4 and +4 | new |
| Focus twice | your next hand applies Focus twice | your next 3 hands | new (Double Down's rule) |
| Interest | interest doubled on your next payout | doubled on every payout this quarter | new |
| Prime | a random Trick in the tray is primed twice | every Trick in the tray is primed once | new (spare) |
| Card buffs | 3 random cards in your deck take a random buff | 3 cards you choose take a random buff | new (spare) |

### Hard (paid only by Hard challenges)

| reward | stage 1 | stage 2 | from |
|---|---|---|---|
| Improvement | a random improvement | a pick of three improvements | owner |
| Limit | +1 to a random limit | a Limit Break (you choose) | owner |
| Trick pick | a pick of three Tricks, rare or better | epic or better | owner |
| Focus | Focus up by half the bar | Focus to max | owner |
| Knack pick | a pick of three Knacks | rare or better | new |
| Sleight pick | a random Sleight on top of the draw pile | a pick of three Sleights | new |
| Boss goal | this quarter's boss asks 5% less | 10% less | new |
| Hand growth | your most-played hand family gains 5 plays toward its next step | 15 plays (a full step) | new (double scaling counts) |

## 5. What each department pays

| department | Standard challenge | Hard challenge |
|---|---|---|
| Sales | Credits | Hand growth |
| Marketing | Focus twice | Focus |
| Accounting | Interest | Boss goal |
| HR | Sleight charges | Limit |
| Legal | Time | Knack pick |
| Operations | Swaps and discards | Sleight pick |
| R&D | Rerolls | Improvement |
| IT | Reward grid size | Trick pick |

Prime and Card buffs are spares, to swap in for any Standard reward that plays flat.

## 7. A Trick and a Sleight that change every round (r664)

You take it without knowing what it will be. At the start of each round it becomes a random
Trick (or Sleight), drawn with no regard for rarity, and does that for the round.

| | name | rarity (suggested) | description |
|---|---|---|---|
| Trick | (owner names) | epic | At the start of each round, becomes a random Trick of any rarity. Improvements apply to the Trick it becomes. |
| Sleight | (owner names) | epic | At the start of each round, becomes a random Sleight of any rarity. Every form spends these charges. Improvements apply to the Sleight it becomes. (6 charges) |

**The flat draw** (counted from the data, r664) against an ordinary offer:

| | common | rare | epic | legendary |
|---|---|---|---|---|
| Tricks, flat (171 live) | 24% | 38% | 31% | 7% |
| Sleights, flat (45 live) | 18% | 49% | 24% | 9% |
| an ordinary offer (`ENTITY_TIER_W`, no Luck) | 71% | 22% | 5.5% | 1.5% |

Rare or better 76% of rounds against 29% of offers; a legendary about one round in 14
(Tricks) or 11 (Sleights). Hence epic for both.

**Both:**
- **When:** the round's start, after the deal and before the clock runs. Taken between
  rounds, it shows a question mark until then; taken mid-round, it changes at once. Flow:
  each level's start (its boss comes mid-level, so the level's form stays through it).
- **Shown:** the tile wears the form's icon plus a mark that it changes; the tooltip reads
  "<Form> this round". A printed notice names the form when it changes.
- **The draw:** flat (Luck does not touch it), never the same form twice in a row, only what
  the mode can offer (`survivalEntityBanned`, `offerBanned`), never retired or fused.
- **Its tier is the form's tier:** the form reads its BAL row at the changer's tier, custom
  ladders (`IMPROVE_PLAN`) included. What an improvement rolls (Inspirato's ranks, Critical's
  family) rolls fresh at each change.

**Trick only:**
- Not drawn: a Trick already in your tray, and (owner, r665) any Trick that grows from when
  you take it or round by round, since a form only lasts a round. Tricks that read the whole
  game so far ARE drawn. The 30 scaling Tricks plus Assembly Line, sorted:

| | Tricks |
|---|---|
| **In:** reads the whole game so far | Hummingbird (pauses and rewinds this game), Wellspring (Focus made this game), Wild Side (negative tiles taken this run), Unsummit (the level) |
| **In:** buffs cards for good, so nothing is lost when the form changes | Bedrock, First Fruits, The Vulture, Hourglass, Ley Line, D6, Middle Management, Royal Favour, Ace Absorb, Monopoly, Heartwood, Wait Four It |
| **Out:** grows from when you take it | Middle Man, Compound, Acorns, Penny Saved, Perfect Ten, More Better, Feng Shui, Relentless, Quick Draw, Expanse, the little guys, Cloud Nine (also adds 9s on pickup) |
| **Out:** grows round by round | Rising Tide, Life Lessons, Assembly Line |

  Not tagged scaling and already drawn: Landfill (cards swapped or discarded this game) and the
  like. Measured in code: Hummingbird reads `pauseInstanceGame + rewindInstanceGame`,
  Wellspring `focusGenGame`, Wild Side `negativeTilesTakenRun`; Perfect Ten only counts while
  held (`bonusMult_tens`), so it is out.
- A line Trick marks a random line for the round (no chooser screen at a round's start).
- Never fuses and never completes an Inseparable pair.
- Keeps its tray slot, so Tricks that read slots see the form there. Primes on it carry over
  to the next form. It sells at its own price.

**Sleight only:**
- Changes wherever it is: on the board (it turns over in place), in the draw pile or the
  played pile.
- **6 charges of its own** (owner, r665), shared by every form. Each use spends one, whatever
  the form; a form that spends by the second (Fight the Power) spends from these. A form that
  never spends a charge (a passive Sleight with infinite charges, Keeper) spends one at the
  round's end if it was on the board that round. At 0 it leaves the deck for good.
- The forms' own charge counts are not used, so an improvement that only adds charges
  (Procrastinate, Logistics Assistant...) does nothing for the changer that round.
- Not drawn: a Sleight you own a copy of (one BAL row per id would serve both at two tiers),
  or one that builds while it sits on the grid (Slow Burn, Whetstone).
- Build note: the card needs a durable field marking it as the changer (`DURABLE_CARD_FIELDS`),
  or `recycleCard` turns it into its form for good.

## 6. Open questions

1. **Rule Sleights:** is the rule in force only while the card is on the grid (as written), or
   for the rest of the round once it lands? Is the charge spent on landing (as written)?
2. **Flow and Classic** have quarters but no Schedule. Give them a department a quarter too
   (drawn the same way), or a fixed payout (Standard: Credits; Hard: Improvement)?
3. **A failed raise:** pays nothing (as written), or also today's penalty bursts? And does a
   timed card (Flow, spot) that runs out before stage 1 still charge its penalty?
4. **Which three departments go** (proposed: Communications, Customer Support, Procurement).
5. **Overlap:** TODO.md's skip perks (section 1, item 3) list a Sleight charge, a random
   improvement and +2 reward grid selection too. One reward list could serve both.
6. **Card-buffing Tricks** (Bedrock, The Vulture, Royal Favour...) are IN the changing Trick's
   draw: their buffs stay on the cards. Out if they count as "scaling from when you get it".
