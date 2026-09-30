# EVENTS - what each one is, and what is wrong with it

**Read this before touching `js/events.js`, `js/events-core.js`, `js/events-upgrade.js`
or `js/events-slots.js`.** It is the same kind of document as OPEN_DECISIONS.md: measured
findings and a recommendation per item, left for the owner to decide on. Nothing here has
been changed in the code.

Written against **r356**. Every number in it was read out of the running game, not
estimated. Where something is a judgement rather than a measurement it says so.

---

## 1. What an event is FOR

Owner's framing, and the thing the whole document turns on:

> "The way that events are mostly going to be used moving forward is less like another
> tile on a reward grid and more like something you do **instead of** a grid."

That is a cost statement, and it is what makes a lot of the current roster fail. In the
Schedule an event is an **obligation** that fills one of about ten slots in a quarter. In
Guided it costs **a slot, 6 credits, and a level of goal scaling** (`guidedAdvanceCurve`
bumps `level` for a bought stop exactly as finishing a round would). So an event is not
free content you stumble into. It is a reward grid you chose not to take.

**The test, then: could this screen have been one tile on the grid you gave up?** If yes,
it is a bad event however well tuned it is, because you paid a whole grid for one tile.

That gives three tiers, and the whole roster sorts cleanly into them:

| tier | means |
|---|---|
| **A** | does something **only an event can do**. The grid and shop have no vocabulary for it. |
| **B** | pays in a currency the grid or shop also sells, but wraps it in a **real trade**. |
| **C** | a reward tile wearing an event's clothes. Hands you an entity, takes nothing that matters. |

---

## 2. Four findings that apply to the whole roster

### 2.1 The draw is FLAT, so a housekeeping screen is as likely as a run-defining one

`openEvent` filters the 22-id pool through `eventEligible`, drops the last 4 drawn
(`EVENT_NO_REPEAT`), and picks **uniformly**. There is no weight anywhere.

Measured over 6,000 draws at a realistic mid-run state (level 9, 5 Tricks, 2 Knacks,
2 Sleights, 40 credits): **19 events reachable, every one of them at 5.0% to 5.7%.**

So **Tray Order** - reordering your tray, which changes no number at all - comes up as
often as **Card Upgrade**, which buffs three cards for the rest of the run. That is most
of the "some of these just are not worth a node" feeling on its own, before any individual
event is looked at.

Cold start (round 1, nothing owned) reaches **14 of 22**. The 8 that cannot fire are the
ones with nothing to work on: Tray Order, Extra Rep, Maintenance, Trade a Trick, Spin to
Improve, Entity Slots, Clean Slate, Overtime. That part is `EVENT_REQUIRES` working as
designed and is not a problem.

**Recommendation:** give `openEvent` a weight table, the shape `ENTITY_TIER_W` already
has. The tier column in section 4 is the natural weighting.

### 2.2 Two event prices bypass `PRICE_MULT`, so they are half price

`PRICE_MULT` is **2**, and every shop table is scaled through `priceOf()` once at
definition. Two events hardcode a credit cost and never call it:

| | event | charges | the same thing elsewhere |
|---|---|---|---|
| `js/events.js:103,109` | **The Trade** | **12** credits for a **legendary Trick** | the shop charges **36** |
| `js/events.js:759` | **The Investment** | **10** credits for +20s on two rounds | · |

The Trade's headline offer is therefore **a third of the shop price with no downside
attached**, and it gets relatively cheaper every time `PRICE_MULT` is raised. This is the
single clearest instance of "the sacrifice is not a big deal": there is no sacrifice, it
is a discount.

**Recommendation:** wrap both in `priceOf()`. One-line fix, and it is closer to a bug than
a balance call - r234 put every other sink through that function for exactly this reason.

### 2.3 NOTHING in any of the 22 events touches the systems added since r278

This is the answer to "the buffs should be things you cannot get from the grid or the
shop", and it is a bigger opportunity than retuning any individual screen. Grepped across
all four event files:

| system | shipped | in-game sources today | events using it |
|---|---|---|---|
| **Card states** (7 of them) | r278 | the **Hallmark** knack, and the dev panel | **none** |
| **Forced Trick fires** (92 forceable) | r234 | the **Hallmark** knack | **none** |
| **`permFocus`** (Focus per scored card) | r325 | the **Flow** deck edit | **none** |
| **Wild cards** | r325 | the deck itself | **none** |
| **Natural Scaling** accumulators | r190/r282 | playing the hand | **none** |
| **`primeTrick()`** (temporary primes) | r296 | Inspirato, Prime Times, Understudy, Hallmark | **none** |
| **`downgradeEntity()`** | r278 | **nothing at all** | **none** |
| **`luckModifiers`** (tilt one draw) | · | the Schedule's hard-round knack pick | **none** |

Seven whole mechanics, several of them with exactly one source in the game, and the
screen type whose entire job is to be unusual uses none of them. **`downgradeEntity` has
no source whatsoever** - it was written as the mirror of `improveEntity` and nothing has
ever called it.

That list is the shopping list. It is also why the fix is mostly *additive*: the roster
does not need pruning so much as it needs the interesting half of the game plugged into
it.

### 2.4 Where the roster is already strong: per-card buffs

Worth saying plainly, because it is the part that already does what the owner is asking
for and should not be disturbed.

The reward grid's Blessed Card and the shop's Cards row both offer **exactly three**
buffs: `+12 pips`, `+5 mult`, `scales +1 mult`. The events offer far more:

| lever | grid | shop | events |
|---|---|---|---|
| flat pips / mult | yes | yes | yes |
| scaling mult | yes | yes | yes |
| scaling pips (`growPips`) | no | no | **Card Upgrade** |
| `xpips` (multiply the card's pips) | no | no | **Card Upgrade · The Price · Coin Flip** |
| `xmult` | no | no | **Card Upgrade · Pick a Card · Card Slots · The Price** |
| `retrig` (the card plays twice) | no | no | **Card Upgrade · Pick a Card · Card Market · Card Slots · The Price** |
| `permTime` (seconds when it scores) | no | no | **Card Market** |
| `permCoins` (credits when it scores) | no | no | **Card Market** |
| **adding a NEW card to the deck** | no | no | **Card Market · The Price** |
| `permFocus` | no | no | **none** (Flow deck edit only) |

So the card-buff events are already the right shape. The weak events are the ones that
hand you an **entity**, because entities are the one thing the grid and the shop both
sell on every visit.

---

## 3. The roster at a glance

| # | event | id | tier | one-line verdict |
|---|---|---|---|---|
| 1 | Card Upgrade | `forge` | **A** | the best event in the game. Leave it alone. |
| 2 | Card Market | `market` | **A** | only way to add cards. Keep. |
| 3 | Extra Rep | `rehearsal` | **A** | unique and permanent. Undercosted. |
| 4 | Clean Slate | `clean_slate` | **A** | only counterplay to permanent damage. Too rare. |
| 5 | The Investment | `altar` | **A** | only multi-round effect. Two of three offers are limp. |
| 6 | Maintenance | `workshop` | **A** | only charge-ceiling raise. Narrow but real. |
| 7 | Trade a Trick | `reassignment` | **A** | only way to move value between entity types. |
| 8 | Tray Order | `shift_change` | **A** | genuinely unique, and almost always worth nothing. |
| 9 | Deck Trim | `deck_trim` | **B** | good screen. The free tier undercuts the paid ones. |
| 10 | Clean Up | `spring` | **B** | overlaps Deck Trim. Merge them. |
| 11 | Pick a Card | `bench` | **B** | Card Upgrade with one card and a choice. Fine, thin. |
| 12 | The Price | `bargain` | **B** | the best-designed cost in the roster. Under-used. |
| 13 | Card Slots | `the_floor` | **B** | honest odds, real cost. Keep. |
| 14 | Spin to Improve | `the_draw` | **B** | stake 3 of your own, get 2 tiers. Good shape. |
| 15 | Entity Slots | `the_payline` | **B** | 1 in 16 for 16 credits. Priced about right. |
| 16 | Coin Flip | `wager` | **B** | targets a RANDOM card, which kills the decision. |
| 17 | Overtime | `overtime` | **B** | Crunch only. The model every trade event should copy. |
| 18 | The Trade | `crossroads` | **C** | half-price legendaries. Costs are near-free. |
| 19 | Two and a Catch | `twin_path` | **C** | two Tricks for a catch that expires in one round. |
| 20 | The Gamble | `gamble` | **C** | the "bad" door is worth about eight seconds. |
| 21 | Free Pick | `merchant` | **C** | three free entities, no cost of any kind. |
| 22 | Theme Draft | `confluence` | **C** | a filtered reward grid with no trade at all. |

**8 tier A · 9 tier B · 5 tier C.** The roster is healthier than it feels from play, and
the reason it feels worse is section 2.1: the five tier-C screens and the weakest tier-A
one (Tray Order) are **27% of every event you meet**, at exactly the same rate as the
good ones.

---

## 4. Event by event

Format: **what it does now** (read from the code) · **the problem** · **what to do**.

---

### TIER C - the ones that need rebuilding

#### 22. Theme Draft (`confluence`)
**Now.** Pick 1 of 3 themes, then 1 of up to 3 entities matching that theme's tags. Free,
no cost, no downside.

**Problem.** This is a reward grid with a filter on it. The theme is the only idea in the
screen and it is a good one - drafting *toward* a build is something the grid cannot do -
but nothing is paid for it. It also **bypasses `pickEntityByRarity`**: the pool is a flat
shuffle-and-slice, so it opts out of the shared rarity table and out of Luck (the r203
rule). Knacks in it are hardcoded to display as `legendary` regardless of what they are.

**Do.** Keep the theme mechanic, put a price on it, and route the draw through
`pickEntityByRarity`. The obvious price is the one the screen is already about: **you
lock the theme in.** Take the entity and every future entity offer this quarter, on every
surface, is drawn from that theme's tags first. That is a genuine build commitment, it
cannot be bought anywhere else, and it makes the theme the decision rather than the
filter.

#### 21. Free Pick (`merchant`)
**Now.** Two Tricks drawn flat from the rare-and-legendary slice, plus (half the time) a
Knack and otherwise a rare-or-legendary Sleight. All free.

**Problem.** It is the reward grid with the commons cut out and the cost removed. There
is nothing to decide beyond which of three you like, which is the same question the grid
asks four times a round for free.

**Do.** Either cut it, or make it the **only** screen that sells the things nothing else
does. A "Free Pick" of *card states* (section 2.3) would be a completely different screen
using the same layout: three charged cards, take one, it goes on a card of your choice.
That is one `cardStateSet` call away and it would immediately be the most distinctive
event in the game.

#### 20. The Gamble (`gamble`)
**Now.** Two modes, 50/50 which. **Doors:** three doors, one legendary Trick, one
rare-or-common Trick, one "bad". **Double-or-nothing:** stake a Trick on a coin flip.

**Problem.** The bad door is `-1 discard for this round`, `-8 seconds`, or literally
nothing. Read that against the prize: a legendary Trick. So the doors mode is a **free
roll on a two-thirds chance of a Trick**, and the worst case costs about eight seconds.
The double-or-nothing half is fine and is the only part with a real stake in it.

**Do.** Drop the doors mode, or make the bad door **permanent**. The Overtime cost list
(`OVERTIME_COSTS`, six permanent downsides, all already written and all already shown up
front) is exactly the right severity and can be reused as-is.

#### 19. Two and a Catch (`twin_path`)
**Now.** Two Tricks drawn on the rarity table, plus one catch you cannot refuse. The
catch is one of: -5 seconds now · -1 discard permanently · -1 swap permanently · this
round's goal +15%.

**Problem.** **Two of the four catches expire immediately.** "-5 seconds now" is five
seconds of one round and "goal +15%" is one round's goal. Against *two Tricks for the
rest of the run*, those are not costs. The other two (-1 swap, -1 discard, both
permanent) are real, so the event is a coin flip between "free" and "a trade".

**Do.** Make all four permanent. `OVERTIME_COSTS` again, or simply delete the two
temporary entries from the `shadow` array - a one-line change that makes the event
honest.

#### 18. The Trade (`crossroads`)
**Now.** Three of four trades, shuffled: 12 credits for a legendary Trick · a random one
of your Knacks for 2 random Tricks · -1 discard permanently for a legendary Trick · a
grid Sleight for one of the next rarity up. Fallback: -10s round time permanently for +1
swap and +1 discard permanently.

**Problem.** Three separate ones.
- **The credit trade is a discount, not a trade** (section 2.2): 12 against the shop's 36.
- **The knack trade names the knack at random**, so you cannot choose to give up the one
  you do not want. A knack sells for 6 credits in the shop, which suggests the game
  already values them low, but a Knack is a run-long rule change and 2 random Tricks
  usually is not worth one.
- **The fallback is a limit trade**, and limits are exactly what the shop's Upgrades row
  and Limit Break already sell.

**Do.** This screen has the right *name* for what the owner wants and the wrong contents.
Rebuild it around costs the shop cannot charge: give up a **Trick's improvement tier**
(`downgradeEntity`, currently called by nothing), give up a **marked row or column**, give
up **your tray's first slot** for the quarter. Price the credit trade through `priceOf`
or drop it.

---

### TIER B - right shape, wrong numbers

#### 17. Overtime (`overtime`) - the model
**Now.** Crunch only. +90 seconds on the quarter clock. The cost is **two** permanent
downsides, rolled from six and **shown before you decide**.

**Why it is the model.** The decision is "is ninety seconds worth exactly these two
things", and both halves are on screen. Nothing is random after the fact, nothing expires,
and it cannot be gamed. **Every trade event in the roster should be built like this.**

**Do.** Nothing to Overtime. Reuse `OVERTIME_COSTS` in The Gamble, Two and a Catch and
The Trade.

#### 16. Coin Flip (`wager`)
**Now.** Three stakes, all 50/50 (r211 fixed the odds correctly). Small: a card gets
`xpips 2`, or loses 10 pips. Middling: `xpips 3` + a replay, or a card leaves the deck.
Large: `xpips 4`, `xmult 2`, a replay, or two cards leave.

**Problem.** **The target is `randomDeckCard()`.** You are gambling on a card you did not
choose, so a win lands on a card you may not have wanted and a loss takes one you may not
care about. That is the difference between a bet and a dice roll, and it is why the
screen reads as flat despite the payouts being large.

**Do.** Let the player **pick the card** they are staking, the way Pick a Card already
does. Same odds, same payouts, and the decision becomes real: stake your best card for a
x4, or a spare for a x2. One card picker, already written twice in this file.

#### 15. Entity Slots (`the_payline`)
**Now.** 16 credits a spin. Three reels of up to 4 of your own entities. Three alike and
it improves a tier. The panel prints the real odds (1 in 16).

**Verdict.** Priced about right and the honesty is good. Leave it.

#### 14. Spin to Improve (`the_draw`)
**Now.** Stake three of your own entities, the wheel picks one, it improves **two** tiers.

**Verdict.** Good shape. The stake is real (you do not choose which), the payout is large,
and it uses `improveEntity`, which nothing else does at two tiers. Leave it.

#### 13. Card Slots (`the_floor`)
**Now.** 12 credits a line, 5 lines, your real deck on the reels. A paying line buffs the
cards that made it, taking the next buff off a rotating list.

**Verdict.** Honest odds, real cost, and the buffs (`retrig`, `xmult`) are event-only.
Leave it.

#### 12. The Price (`bargain`)
**Now.** Three of up to five trades. The two good ones cost **buffed cards** - cards you
have invested in - and are gated on there being enough to take and on the run's late half.

**Why it matters.** r234 already fixed this screen for exactly the reason the owner is
raising now: the costs used to be random cards, which are worth nothing, so the trades
were free. Taking **cards you have spent the run buffing** is the best cost in the whole
roster. It is legible, it hurts, and no other screen can charge it.

**Do.** Use this cost more widely. It is the second model, alongside Overtime.

#### 11. Pick a Card (`bench`)
**Now.** Choose one of three buffs, then choose the card it goes on. Free.

**Problem.** Card Upgrade does the same thing to three cards and does not ask you to
choose. This is thinner and free. It is not *bad* - choosing the card is a real decision
Card Upgrade does not offer - it is just small for a whole node.

**Do.** Merge into Card Upgrade as its third option: "one buff, your choice of card,
double strength". One screen, three genuinely different shapes.

#### 10. Clean Up (`spring`)
**Now.** Cut 4 cards of distinct ranks, or cut 2 with no rule. Or restore damaged swap and
discard limits. Or +1 discard.

**Problem.** **Deck Trim does the same job better**, and both are in the pool at 5% each,
so about one event in ten is a deck-thinning screen. The limit-restore option is the only
part Deck Trim does not have, and Clean Slate covers the same ground more broadly.

**Do.** Merge. Keep Deck Trim's pricing ladder, move Clean Up's distinct-ranks cut in as
its free tier (the shape constraint is the better free option), and move the limit repair
to Clean Slate where the other repairs live. Pool 22 -> 21.

#### 9. Deck Trim (`deck_trim`)
**Now.** Cut 1 card free · 2 for 12 credits · 4 for 28.

**Problem.** The free tier is strictly the most efficient in credits-per-card terms at 0,
and there is nothing stopping a player taking it every time. The paid tiers only matter
when you need volume *now*.

**Do.** Keep the free tier (it is what stops the event being dead at 0 credits) but make
it the constrained one - one card, **chosen at random from your three worst**, say. Pay
for the right to choose.

---

### TIER A - unique, keep, mostly needs more weight not more power

#### 8. Tray Order (`shift_change`)
**Now.** Reorder your Trick tray by tap-to-swap. Under 2 Tricks it pays 15 credits instead.

**Problem.** Order is load-bearing for **five** things (Inspirato's first and last, Mirror's
neighbour, Prime Times' 1st/2nd/3rd/5th/7th, the Alignment knack's column, Move as One's
lowest-rarity match). But you only own one of those on most runs, and if you own none the
screen changes literally nothing. It is unique, and usually worth zero.

**Do.** Do not cut it - it is the only way to change order. **Gate it**: only offer it
when the player owns at least one order-sensitive entity. That is a one-line
`EVENT_REQUIRES` row and it turns a 5% dead draw into a screen that always matters.

#### 7. Trade a Trick (`reassignment`)
**Now.** Give up a Trick, choose whether it returns as a Knack or a Sleight, drawn at
random at its tier or better.

**Verdict.** The only way in the game to move value between the three entity shapes, and
it matters most when the tray is full. Good. Leave it.

#### 6. Maintenance (`workshop`)
**Now.** Refill every Sleight, or raise one Sleight's charge ceiling by 2 permanently.

**Verdict.** `sleightCapBonus` has no other source. Narrow (it needs finite-charge
Sleights owned) but the gate handles that. Leave it.

#### 5. The Investment (`altar`)
**Now.** 2 discards for +3 mult over 3 rounds · 10 credits for +20s over 2 rounds · a
**random** one of your Tricks for half goal over 4 rounds.

**Problem.** `altarEffects` is the only multi-round timed effect in the game, which is
worth keeping. But the first two offers are weak (2 discards and 10 unscaled credits are
both trivial mid-run) and the third takes a **random** Trick, which is the same flaw as
The Trade's knack: you cannot choose to give up the one you do not want.

**Do.** Let the player choose which Trick. Scale the credit cost through `priceOf`. Raise
the first two: this is a whole node, so +3 mult for 3 rounds should probably be +3 mult
for the rest of the quarter.

#### 4. Clean Slate (`clean_slate`)
**Now.** One permanent penalty comes off for good: quota revision, shortened rounds, play
surcharge, all card curses, dead cells, interest freeze, withheld payout.

**Problem.** Only that it is **rare in practice** - it needs a penalty on the record, so
early runs never see it, and it competes at a flat 5% with 18 other screens when it does
qualify.

**Do.** Weight it up sharply once eligible. A run carrying three permanent penalties
should meet this more than one event in twenty.

#### 3. Extra Rep (`rehearsal`)
**Now.** One Trick gains `_rank`, a **permanent** prime: it fires an extra time on every
hand for the rest of the run. Uncapped and stacking.

**Problem.** It is the most powerful single thing any event does and **it costs nothing.**
Section 1's test says that is backwards: this is the screen that should be charging the
most.

**Do.** Charge for it. The natural price is the one the mechanic already implies: give up
a **different** Trick, or take the rank on a Trick chosen at random rather than by you.

#### 2. Card Market (`market`)
**Now.** Three offers, each a copy of a card already in your deck carrying one effect
(pips / mult / time / replay / credits). Buy as many as you can pay for.

**Verdict.** The only screen that **adds** cards, and `permTime` and `permCoins` have no
other source. Copying a card already in the deck is also what keeps it mode-safe across
Spectrum and Six Suits. Leave it.

#### 1. Card Upgrade (`forge`)
**Now.** Three of seven boons, each **pre-assigned to its cards**: a scaling boon takes 2
cards, a flat one takes 3. The faces are drawn on the tile.

**Verdict.** The best event in the roster and the template for the rest. The decision is
real (which buff, and it is already pointed at specific cards you can read), the payout is
large, and four of its seven boons exist nowhere else. Leave it alone.

---

## 5. Ranked recommendations

Cheapest and highest-value first. Nothing here has been implemented.

| # | change | size | why |
|---|---|---|---|
| 1 | Wrap The Trade's 12 and The Investment's 10 in `priceOf()` | 2 lines | closer to a bug than a balance call (2.2) |
| 2 | Delete the two temporary catches from Two and a Catch | 1 line | makes the only permanent-cost event honest |
| 3 | Gate Tray Order on owning an order-sensitive entity | 1 row in `EVENT_REQUIRES` | turns a 5% dead draw into one that always matters |
| 4 | Let Coin Flip and The Investment target a **chosen** entity, not a random one | small | restores the decision both screens are for |
| 5 | Weight the draw (2.1) | one table + one line in `openEvent` | the single biggest change to how the roster *feels* |
| 6 | Reuse `OVERTIME_COSTS` as the cost list for The Gamble and The Trade | small | one severity model, already written and already proven |
| 7 | Merge Clean Up into Deck Trim; move its limit repair to Clean Slate | medium | removes the one real duplicate, pool 22 -> 21 |
| 8 | Charge for Extra Rep | medium | the strongest payout in the roster is currently free |
| 9 | Plug the unused systems in (2.3) | medium each | **the actual answer to "make them unique"** |
| 10 | Rebuild The Trade's costs around things the shop cannot charge | large | it has the right name and the wrong contents |

### On item 9, concretely

The seven unused levers, and the event each most naturally belongs to:

| lever | put it in | what the screen becomes |
|---|---|---|
| **card states** | Free Pick, rebuilt | three charged cards, take one, choose its card |
| **forced Trick fires** | The Gamble | stake credits, force one of your Tricks next hand |
| **`permFocus`** | Card Market | a sixth boon. Focus per scored card has one source today |
| **`downgradeEntity`** | The Trade | knock one entity down a tier as the price of raising another |
| **`primeTrick`** | The Investment | prime a Trick every hand for N rounds |
| **Natural Scaling** | a new event | bank plays of a hand type without playing them |
| **wild cards** | Card Market / Deck Trim | buy a wild, or trade three cards for one |

Every one of those is unbuyable at the grid and unbuyable at the shop, which is the whole
of the owner's test.

---

## 6. Related, worth knowing

- **The Pick after a payout is NOT an event** and is a different system
  (`js/payout-pick.js`, Settings -> Motion -> "Card pick after payout"). It was broken in
  two ways until r356; see the r356 section of CLAUDE.md.
- **The Flow reward chain** (`js/flow-rewards.js`, r325) has a **DECK EDIT** step with 11
  operations, including 4 adjacency ops and 7 buff ops, and is the richest card-editing
  surface in the game. It is gated on `flowActive()` and no other mode can reach it.
  Making it available in Guided is a live owner request and is not done.
- **`EVENT_REQUIRES`** (js/events-core.js) is the one place an event's eligibility is
  decided, and the renderers read the same table. An id with no row is eligible, and a
  predicate that throws is eligible, deliberately: the table must never be able to delete
  an event from the game by being wrong about it.
- Adding an event means registering it in **four** places in `js/events-core.js` (the
  `pool` array, the `handlers` map, `EVENT_META`, and the `renderers` map). The dev panel
  generates its list from `EVENT_META`, so it picks up a new one on its own.
