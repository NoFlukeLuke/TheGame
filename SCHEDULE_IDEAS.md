# Ten ideas for the Schedule, from games with run maps (r655)

Researched for the owner after the Schedule became a 4 x 4 to-do list. Nothing here is built.
Each idea says what it is in our terms, where it comes from, why it helps, and a rough cost.

## What these games have in common

The games fall into two groups. Most of them draw a branching path that you walk one stop at a
time: Slay the Spire, Monster Train, Peglin, Cobalt Core and Darkest Dungeon II. A few hand you a
short menu, let you do some of it and make you leave the rest. That second shape is the
Schedule's own, and Into the Breach is its closest relative: you defend 4 of an island's 7
regions before the HQ fight, so "there will always be 3 you cannot do."

The two groups share five things:
- **You see the route before you commit,** so the fun is in planning.
- **Each stop says what it pays,** often with exact numbers. Balatro's blind panel and Hades'
  door symbols do this, Wildfrost names every battle, and Dicey Dungeons players "go for the
  enemy with the most chests behind them."
- **Harder stops are your choice and pay more.** Elites in Slay the Spire and Cobalt Core,
  corruptions in Across the Obelisk, Chaos gates in Hades, Inscryption's campfire.
- **Passing on something has a price or prize you can see.** Balatro shows the tag you get for
  skipping a blind.
- **The boss is known early,** so you plan backward from it.

The Schedule already has most of this: a visible map, a known review, a skip that pays, hard
tiles and mysteries. It has four gaps:
- Under the pick-any-two rule, lanes no longer matter.
- Most lines show no numbers.
- Skipping always pays the same thing.
- Nothing links one quarter to the next.

**Owner's verdicts (r656):** 1 built (line items, r656). 2 and 9 become departments, then two
bosses a quarter with a hidden third. 3 wanted, with better words. 5 wanted. 6, 7 and 9 become
difficulty tiers. 10 wanted, needs detail. 4 and 8 parked. The order of work is in TODO.md,
section 1.

**If you pick three to start:** 1 (line items), 3 (skip memos) and 2 (departments). They close
three of the four gaps, and 1 is small.

---

### 1. Line items: print the stakes on every line
- **What it is:** each to-do line shows the numbers that decide it, before you book.
  - **Level:** the goal it would have if you booked it next, and what it pays ("ACCOUNT
    GOAL 3,450 +5"). Every tile raises the curve, so the second level in a slot shows a higher
    goal; the numbers update as you book.
  - **Reward tile:** its grid size and how many Trick tiles it guarantees.
  - **Shop:** one featured item and its price.
  - **Limit break:** which limits are on offer.
  - **Event:** it already has its name. Add what it pays or costs, in a few words.
- **From:** Balatro's blind screen lists each blind's target, cash reward and skip tag before
  you play. Hades marks every door with the reward behind it. Wildfrost 1.0.5 named every battle
  so you can "see which battle you'll be coming up against."
- **Why:** "any two of four" is only a real choice when you can read how the four differ, and
  today every level line says the same sentence.
- **Cost:** small for levels and limit breaks (the numbers exist). Medium for reward tiles and
  shops, whose contents would be rolled when the map is built and kept.

### 2. Departments: make the lanes mean something
- **What it is:** name the four lanes SALES, OPS, IT and HR, printed as column headers. Booking
  the same department in back-to-back slots builds a streak: two in a row pays a small perk,
  three a bigger one (SALES: more credits from level payouts; OPS: +1 swap and +1 discard next
  round; IT: the next pick of three offers four; HR: the next round starts with +15s). Map
  building can lean each lane toward certain tiles so each department has a feel. Two bookings
  a slot means two streaks can run at once.
- **From:** Loop Hero's meadow tiles were placed anywhere until a bonus for neighbours
  "radically changed" how players placed them. Monster Train's two tracks let you route toward
  the stop you want.
- **Why:** since the pick-any-two rule, lanes are decoration. This brings back routing without
  bringing back the rule that tiles had to touch.
- **Cost:** medium (a streak counter, a header row, four perks). Nothing becomes unreachable.

### 3. Skip memos: show what leaving early buys, and vary it
- **What it is:** each slot carries a memo in its margin, visible from the start of the quarter,
  collected only if you leave that slot after one booking. Memos vary: "+12 credits after the
  review", "next shop: one item free", "next reward grid: one more Trick tile", "confirm every
  mystery tile", "+1 charge on every Sleight", "copy the next memo you take". Today's rising
  credits (6, 8, 10...) stay as the plainest memo.
- **From:** Balatro's skip tags (Investment Tag pays $25 after the boss, Speed Tag pays per blind
  skipped, Double Tag copies the next tag).
- **Why:** a flat credit payment rarely beats a booking, and TODO.md already says credits barely
  constrain the player. A varied memo you can see slots ahead turns "only one here" into a plan.
- **Cost:** medium (a weighted memo table in `PROB_TABLES`, one hook per memo into systems that
  already exist).

### 4. Extra Mile: an opt-in clause on any level
- **What it is:** each level line has a box you can tick before CLOCK IN, for example
  "[ ] EXTRA MILE: goal +25%. Clear it and the pick of three is rare or better." Each level rolls
  one clause (goal +25%, start 20s short, one fewer discard, no swaps) and prints what it pays.
- **From:** Across the Obelisk's corruptions (a harder fight for a reward), Slice & Dice's
  generated curses and blessings.
- **Why:** PRIORITY tiles fix where the hard rounds are when the map is built. A box lets the
  player push when their build is strong, and ignoring it costs nothing.
- **Cost:** small to medium; it reuses the challenge path. Avoid the names Stretch (a Trick) and
  Overtime (an event).

### 5. Side projects: a cost now, a payoff two bookings later
- **What it is:** now and then a tile carries a SIDE PROJECT tag. Booking it puts a drawback on
  the next two levels you take (goal +15%, or start 20s short). Clear both and it pays something
  big (a pick of three at epic or better, a free limit raise). The list draws a bracket across
  the bookings it covers, with a countdown ("2 LEFT").
- **From:** Hades' Chaos gates: "a serious bonus, but only if you can survive a few chambers with
  an equally serious hindrance."
- **Why:** it ties slots together, so the order you book in matters.
- **Cost:** medium.

### 6. Due dates: tasks that go overdue
- **What it is:** one or two non-level tiles a quarter are stamped "DUE SLOT 2". Book it by then
  for a bonus. Leave it and at the end of that slot its line is struck through and moved into the
  next slot marked OVERDUE, like a paper planner. It can still be booked, but each slot it waits
  adds 5% to the review's quota, and the review line says so.
- **From:** Cultist Simulator's card timers, Papers, Please's end-of-day bills.
- **Why:** deciding what to put off is the oldest tension a to-do list has.
- **Cost:** medium (a tile that moves between slots and a quota modifier; the dead-end check must
  allow for the moved tile). Avoid the name Deadline (a card state).

### 7. Confirmed, tentative, TBC: less detail further ahead
- **What it is:** the current slot and the next are CONFIRMED and show full detail (idea 1). Slots
  further out are TENTATIVE: the kind shows, numbers and event names read TBC. Paying a few
  credits confirms a line early; a rare CALENDAR SYNC tile, or a Knack, confirms the quarter.
- **From:** Darkest Dungeon II's hidden and scouted roads (a Watchtower reveals the region), FTL's
  Long-Range Scanners.
- **Why:** it keeps surprise in slots 3 and 4 and gives credits a use on the map screen.
- **Cost:** small for the display states and the confirm button; medium with a new tile kind.

### 8. Gold stars: one flagged task a quarter, collected across the run
- **What it is:** one tile a quarter gets a gold star, placed where taking it costs something (a
  PRIORITY or AUDIT tile, or a slot whose other tiles are better). At CLOCK IN a starred tile
  offers its usual payout or the star. Four stars by the final review unlock a bonus (a
  guaranteed legendary in the last prize grid, or an optional harder final review that pays more).
- **From:** Slay the Spire's three Act 4 keys, each of which costs a route choice.
- **Why:** every quarter gets a reason to look past its own review, so four maps play as one run.
- **Cost:** medium (a flag, a saved counter, one payoff); large if the payoff is a new boss.

### 9. The quarterly memo
- **What it is:** each quarter's list opens with a memo typed above the first slot, setting one
  rule for that quarter only, half good news and half catch: "Reward grids are 5x5 this quarter.
  Shop prices +20%." "Flushes score x1.5 mult. Levels pay 2 credits less." "Events pay double.
  The last slot has one fewer tile."
- **From:** Papers, Please's morning bulletin of new rules; Luck be a Landlord's rising rent.
- **Why:** the four quarters feel different without new tile kinds, and a memo pinned above a
  to-do list fits the office.
- **Cost:** medium. Start with six to eight memos, each a small change to an existing number.

### 10. The timesheet and a clean quarter
- **What it is:** finished lines are ticked in place with their result ("[x] ACCOUNT 3,612 / 3,450
  +5"). Before the review the notice printer runs off a timesheet: what was booked, how far each
  goal was beaten, credits in and out. If every level was cleared by 20% or more (or no slot was
  left early), it ends "CLEAN QUARTER" and offers a pick of three.
- **From:** Into the Breach's Perfect Island bonus; Papers, Please's daily ledger.
- **Why:** the list becomes a record of the quarter, and a clean quarter you can see while
  planning works against the skip memos.
- **Cost:** small for the ticks and the printout; medium with the bonus.

---

**Left out because the game has them:** rerolling the review's boss (the Reschedule event), event
names on their tiles, the review's quota on its line, mini-boss elites (parked in TODO.md).

## Sources
- https://slaythespire.wiki.gg/wiki/Keys
- https://slaythespire.wiki.gg/wiki/Map_Generation
- https://balatrowiki.org/w/Tags
- https://balatrowiki.org/w/Blinds_and_Antes
- https://steamcommunity.com/app/2379780/discussions/0/4844274293904774410
- https://en.wikipedia.org/wiki/Balatro
- https://bossrush.net/2023/03/game-review-race-through-rings-of-hell-in-monster-train/
- https://playday.one/2021/01/07/review-monster-train/
- https://shacknews.com/article/122186/door-symbol-meanings-hades
- https://kotaku.com/everything-you-need-to-know-to-beat-hades-for-the-firs-1845142723
- https://www.thegamer.com/across-the-obelisk-beginner-tips-tricks-guide/
- https://tann.itch.io/slice-dice/devlog/434748/slice-dice-20-release
- https://kosgames.com/into-the-breach-beginners-guide-advice-2021-5557/
- https://intothebreach.fandom.com/wiki/Islands
- https://www.destructoid.com/closing-the-loop-four-quarters-on-the-making-of-loop-hero/
- https://darkestdungeon.wiki.gg/wiki/Roads
- https://darkestdungeon.wiki.gg/wiki/Dungeon_map
- https://ftl.fandom.com/wiki/Federation_Ship_in_Need_of_Aid
- https://subsetgames.com/forum/viewtopic.php?p=76713
- https://nintendoeverything.com/wildfrost-update-out-now-version-1-0-5-patch-notes/
- https://en.wikipedia.org/wiki/Papers,_Please
- https://steamcommunity.com/app/239030/discussions/0/34094415974689245
- https://en.wikipedia.org/wiki/Cultist_Simulator
- https://en.wikipedia.org/wiki/Luck_Be_a_Landlord
- https://steamcommunity.com/app/861540/discussions/0/1638669204751293635
- https://gamepretty.com/cobalt-core-starting-guide-for-new-players/
- https://www.speedrun.com/Peglin/guides/6xu76
- https://en.wikipedia.org/wiki/Griftlands
- https://steamah.com/inscryption-how-to-benefits-campfires-with-no-risks/
- https://backpackhero.wiki.gg/

---

# THE SAMEY SCHEDULE (owner's notes, r659)

The owner, looking at a map after r658: three of a kind in a row feels bad; row 1 is always
four rounds; the screen reads too samey; is three or four rounds before a review too few, or
is a shorter game the point; and Guided (a choice between every round) lacked a gauge of how
ready you are for the boss. Organised into six ideas with pros and cons, then questions.

### A. Repeats in a slot
Today a slot can hold three or four of one kind. **Fixes:** cap a slot at two of a kind in the
fill; and departments (chunk 1) lean each column a different way, so rows mix on their own.
- Pros: a cap is one line in the fill; departments do most of it anyway.
- Cons: a cap of two on four columns makes every row two pairs; a column that leans rounds
  can never make a row of rounds, which is fine.

### B. Row 1 is always four rounds
Why: the first booking of a quarter must be a round (play before shopping) and the funnel row
holds no rounds, so row 1 all rounds guarantees two rounds first. **Options:**
1. A 4x1 opener: one wide ACCOUNT tile across row 1, one booking that fills the slot (a
   quarter becomes 7 bookings). Row 1 of later quarters can then hold anything.
2. Row 1 is two rounds and two others, with the rule that a quarter's first booking is a round.
3. Only Q1's row 1 is all rounds; Q2-Q4 rows mix with at least one round.
- Pros: 1 is a clear quarter opener and the lost choice was never real (four identical
  rounds); 2 keeps eight bookings; 3 changes nothing for the walkthrough.
- Cons: 1 belongs to no department column; 2 and 3 let a quarter run on two rounds (see E).

### C. Adjacent moves only
r648 replaced the orthogonal walk with pick-any-two because lanes meant nothing and dead ends
were common. The view then and now: adjacency is worth having only once columns mean
something (departments) and generation cannot strand you; chunk 5 keeps it as difficulty tier
2, adjacent to ANY tile already taken (today's dev "Free branch").
- Pros: routing is back, lanes matter, each booking shapes the next slot, planning.
- Cons: two bookings a slot from the last tile leaves one to three legal tiles, often forced;
  dead ends need the validator and rails on the screen; adjacency from any taken tile is the
  softer form and still gives most of the routing.

### D. The screen reads samey
Owner: a faint background tint per tile in its kind's colour, much darker and faded. **More:**
department column headers in their own colour (chunk 1); a bigger glyph or a stamp per kind
(URGENT on PRIORITY, a price tag on MART); tile shapes (the 2x1 event, a 4x1 opener); fewer
identical neighbours (A); a word per row (MORNING / MIDDAY / AFTERNOON / LATE) beside the time.
- Pros: all cheap; the tint and headers are CSS.
- Cons: tint on amber glass goes muddy past about 12% alpha; shapes need the fill to place them.

### E. How much play before a review
Facts: a Schedule quarter is 8 bookings, 2 to 5 of them rounds (row 1 forces two, rows 2-3
offer one or more each, the funnel none); a round is 3:00, so 6 to 15 minutes of play before
the review. Classic plays about four rounds a quarter. **Options:**
1. Keep it: fewer rounds, each one matters, a run stays about an hour.
2. Five slots (10 bookings): longer quarters, more rounds and more prep.
3. Weight the fill toward PRIORITY and AUDIT: they are rounds too, with stakes.
4. A floor: generation guarantees a path with at least four rounds, and the fill keeps a
   round in every row.
5. Make the review longer instead (chunk 2's two bosses): the quarter stays short, the end
   is bigger.
- Pros: 1 and 5 keep the run short; 3 and 4 add play without adding bookings.
- Cons: 2 lengthens a game the owner already finds long; 4 removes some of the choice the
  pick rule gives.

### F. A readiness gauge (what Guided lacked)
The review line prints its quota (r656). Add what the player brings: the best hand this
quarter next to it ("BEST 4,120 / 6,500"), or a bar on the review line that fills as the best
hand approaches the quota.
- Pros: every between-round choice gets a purpose (more prep, or play); it is the piece that
  would make a Guided-style mode work.
- Cons: one hand is not a boss round (a modifier, a window, a whole round of hands), so the
  number can mislead; it must stay a number, not advice.

### Questions to ponder
1. How long should a quarter take, in minutes? Today about 15. Is that the problem or the point?
2. Is a booking that is not a round play or prep? If events pay more than rounds, do you want
   players choosing events over rounds, or rounds as the spine?
3. Should every quarter have the same number of rounds (say four), or should it be the
   player's choice (two to six)?
4. Does slot 1 need a choice, or is a strong opener better?
5. Is a row of three rounds bad because they repeat, or because they are identical? With line
   items and departments they would differ in goal and rewards.
6. Should columns (departments) be what makes the map readable, or the tile mix and shapes?
7. Adjacency: a difficulty tier only, or back in the base game once departments exist?
8. Is the review's quota the right readiness signal, or do you want your own strength next to it?
9. Guided: remove it, or keep it as the mode with a choice between every round plus the gauge?
