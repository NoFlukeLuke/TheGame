# Milestones: what the bot can tell us, what it cannot, and the questions left (r724)

Written for the owner's question: how do the bots play, where are they weak, and what should
the goal at each level be. Numbers below come from `tools/sim` on r723's game, after the two
bot fixes in this pass. Every figure is the median unless it says otherwise.

## 1. How the bot plays

The bot (`tools/sim/sim-core.js`) runs the shipped scoring code with no screen. Each turn:

1. **It lists every connected group of 2 to 5 cards** and ranks them by a rough guess (hand
   type plus card pips). The guess ignores Tricks. It then scores only the top 6 for real
   through `calcScore`, so a Trick changes its choice only when the Trick's hand was already
   among those 6.
2. **Every hand takes a fixed number of seconds** (the `handTime` knob; 6s is the calibrated
   figure for the owner's own pace). Nothing makes it faster or slower.
3. **It swaps or discards only when the board has no hand at all.** Then it swaps whatever
   makes any hand, or discards the 3 lowest cards. It never swaps to build a better hand.
4. **Rewards are taken by rarity alone.** A pick of three gives it the highest rarity on offer,
   whatever it already owns. A limit reward prefers Selection, rows, columns, time.
5. **The tray is never sold.** Once 5 Tricks are in, every later Trick reward is thrown away.

What it never does: draft for synergy, use a Sleight, spend Focus (Reserve, Focus Knacks),
edit the deck, buy in the shop (a visit is one free item), play a challenge card, think about
pick order, or play 6 and 7 card hands.

What makes it stronger than a person: it sees every hand at once, never misplays, never
meets a boss modifier and never takes a Balance Sheet debuff.

It plays a whole run in every mode. In Flow it gets the game's real reward count and reward
types at each level-up and meets the four bosses.

## 2. Two bot bugs fixed in this pass

- The bot scored through `calcScore`, which only READS the charges a real play spends
  (`playHand` zeroes them after the score). Second Hand's and Minute Hand's charges, a prime,
  Amplifier and Siphon paid on every hand after they were earned. Second Hand alone scored
  1.4 million in one 3-minute round.
- Those charges also leaked from one run to the next in a batch, so one Second Hand run
  inflated every run after it. This is the likely cause of r690's note that identical
  batches disagreed by 30 points.

Both fixed in `sim-core.js` (`SIM_afterHand`, `SIM_resetCharges`). Every number in this file
was taken after the fix. Nothing in the game changed.

## 3. What was measured

### 3a. Pace is the first thing

One 3-minute round at level 1, 4x4, 3 swaps, 3 discards, no Tricks, 300 rounds each:

| seconds a hand | hands | Focus | median score |
|---|---|---|---|
| 6 | 29 | x2.3 | 5,900 |
| 9 | 20 | x1.0 | 1,400 |
| 12 | 15 | x1.0 | 1,100 |

The Focus speed bonus stops at 8s a hand, so a 9s player plays at Focus x1 and scores a
quarter of a 6s player. No single Trick comes close to this effect. Round 1 asks 1,500: a 6s
player clears it four times over, a 9s player misses it more often than not.

### 3b. Each extra Trick multiplies the round by about 1.4x

Same round, N random Tricks drawn at the shipped rarity odds, tray cap lifted, 150 rounds each:

| Tricks | 25th pct | median | 75th pct | 90th pct |
|---|---|---|---|---|
| 0 | 5,200 | 5,900 | 6,700 | 7,400 |
| 1 | 5,800 | 7,600 | 13,400 | 21,600 |
| 2 | 7,700 | 13,200 | 19,700 | 32,900 |
| 3 | 12,000 | 19,700 | 35,600 | 66,300 |
| 4 | 15,000 | 26,900 | 51,300 | 113,000 |
| 5 | 20,200 | 37,300 | 65,300 | 115,000 |
| 6 | 25,200 | 47,300 | 92,600 | 221,000 |
| 8 | 55,700 | 94,600 | 165,000 | 448,000 |
| 10 | 75,800 | 122,500 | 238,000 | 712,000 |

- The median grows about x1.4 per Trick through Trick 6 and about x1.15 per Trick for 9 and
  10. So the answer to "when does one more entity stop mattering" is: for random Tricks with
  no synergy, not before 8. The taper in the real game is the TRAY CAP (5), not diminishing
  returns.
- The spread is the "really good Trick" effect the owner wants: the 75th percentile is about
  2x the median and the 90th is 4 to 6x. One Trick in ten doubles a run on its own.
- Legendaries are 0.9% of offers; none came up in 300 draws. The spread above is commons,
  rares and epics.

### 3c. A Schedule run, round by round

The bot plays the default 8-booking quarter (`level level level hard shop event level event`,
then the review), plays every round to the clock and the score is recorded, then takes the
rewards the tile pays and moves on. 40 runs each. "clear" is how often the recorded score met
the round's fixed goal (r708).

6s a hand, natural scaling on (today's game):

| round | goal | bot 25th pct | bot median | clear | Tricks held | NS step |
|---|---|---|---|---|---|---|
| Q1 first round | 1,500 to 2,000 | 5,300 | 6,000 | 100% | 0 | 2 |
| Q1 review (lv 9) | 5,500 | 21,000 | 39,000 | 100% | 4.5 | 11 |
| Q2 review (lv 18) | 25,000 | 62,000 | 111,000 | 98% | 5.1 | 18 |
| Q3 review (lv 27) | 111,000 | 134,000 | 225,000 | 78% | 5.1 | 25 |
| Q4 review (lv 36) | 492,000 | 262,000 | 401,000 | 40% | 5.1 | 31 |

The same at 9s a hand (Focus x1.0 to 1.2 throughout): Q1 review 100%, Q2 80%, Q3 50%, Q4 8%,
and the first two rounds of the run are cleared only 28% and 60% of the time. At 12s: Q1 100%,
Q2 88%, Q3 55%, Q4 18%, first round 10%. (12s beats 9s late because its rounds end at the
clock either way and its deck runs dry later; neither is a real player.)

Reading it:
- **Early Schedule goals are 3 to 4x under a 6s player and about level with a 9s player.** The
  first difficulty's feel depends entirely on which of those is the target.
- **The tray fills during Q1** (4.5 Tricks at the first review). From there the bot's Trick
  count never moves. Everything after Q1 is natural scaling, limits and random improvements.
- **The goals catch the bot in Q3 and pass it in Q4.** The bot's median grows about 2x a quarter
  after Q1; the goals grow 4.5x a quarter (45% a level from level 12). That gap is the "later it
  feels too hard".

### 3d. Natural scaling carries the late game

Same Schedule run at 6s with double scaling zeroed (`nsHandGrowth` returns 0):

| round | NS on, median | NS off, median | NS share |
|---|---|---|---|
| Q1 review | 39,000 | 19,000 | 2x |
| Q2 review | 111,000 | 27,000 | 4x |
| Q3 review | 225,000 | 45,000 | 5x |
| Q4 review | 401,000 | 51,000 | 8x |

Clear rates with NS off: Q1 85%, Q2 53%, Q3 10%, Q4 3%.

Today's model (r598, `nsModel 'double'`): every 15 plays of a FAMILY (sets, runs, flushes; a
same-suit run counts for both) its cards pay +2 mult each, and separately +1 pip each. It
counts plays across the whole run and never resets. Two things follow:
- **It is already family based**, not hand-type based. The per-hand-type table is the old
  model (`'table'`), still in the dev panel but not the game.
- **It counts hands, so it pays speed twice.** A 6s player plays twice the hands of a 12s
  player, so earns Focus AND climbs the ladder twice as fast. By Q4 the 6s bot has 31 steps of
  mult per card (about +62 mult on every card); the 12s bot has 28, because it too plays to the
  clock in these probes. A person who clears a round and moves on, as the game asks, plays
  far fewer hands than a bot made to fill the clock, and climbs far slower than either.

### 3e. Flow

Boss N asks `goalForLevel` of 10 / 16 / 20 / 24 (r687). 40 runs each.

6s a hand: 36 of 40 won. Boss 1 comes at level 10 (median), goal 6,700, bot scores 9,400,
100% clear; boss 2 at level 21, 25,600 vs 33,400, 100%; boss 3 at level 26, 62,450 vs 76,400,
98%; boss 4 at level 30, 152,450 vs 168,000, 92%. The bot clears levels 1 to 4 in 60 / 48 /
36 / 18 seconds and then every level in 18 to 30s (3 to 5 hands) until level 16, where the
25%-a-level goals start to outrun it (level 24: 60s, level 30: 74s).

9s a hand: 18 of 40 won. Boss 1 comes at level 6 (the bot is slower, so the first session
reaches fewer levels), 6,700 vs 7,500, 65% clear; boss 2 at 19, 88%; boss 3 at 23, 100%; boss
4 at 26, 78%.

Reading it:
- The margins are thin (1.1x to 1.4x) and the bot is consistent, so it wins; a person with a
  normal spread of rounds loses more often than these numbers say.
- **Flow's first reward chain hands the bot 5 Tricks by level 4** (Tricks 90% of the first slot,
  2.3 rewards a level-up). From level 4 on, 60 to 70% of its rewards are wasted (tray full; it
  cannot use Sleights, deck edits or cards). A real Flow player's growth after level 4 comes
  from exactly the things the bot cannot use, so Flow is where the bot is least like a person.
- Boss 1 at a level-10 goal is a wall for a 9s player (65%) and a formality for a 6s player.

### 3f. How many Tricks care which hand you play

Of 175 live Tricks: 13 are tagged for sets, 9 for runs, 4 for flushes, 14 for hand size, and
136 for none of those. Tricks that name ONE hand type in their text: Flush 4, Four of a Kind 2,
Pair / Two Pair / Full House / Straight 1 each. So the game already leans the owner's way:
families and sizes, with about ten hand-type specialists.

## 4. What this says about the goal curve

1. **Decide the pace the first difficulty is tuned for.** 6s is the owner; 9s is a careful
   new player. Round 1 at 1,500 is 4x under the first and about level with the second. There
   is no curve that is right for both without a difficulty setting or a Focus floor.
2. **The Trick engine is spent by the end of Q1 in both modes** (tray of 5). Any goal growth
   after Q1 is paid for by natural scaling, limits, improvements and selling-to-upgrade. The
   curve's growth rate after Q1 should be set to whichever of those the owner wants to be the
   late-game engine, and the bot says today's 45% a level outruns all of them together for
   a 6s bot after Q2.
3. **Natural scaling is 8x of the late game and it pays speed twice.** If it stays a count of
   hands played, the gap between a fast and a slow player widens every quarter. Counting
   something time-normalised (rounds cleared, or hands per round capped) would narrow it.
4. **In Flow the first boss is the wall for slower players**, and after level 4 the bot cannot
   say anything useful because the player's growth is in Sleights and the deck editor.

## 5. The recording session: worth doing, and what for

The bot's three biggest unknowns about the owner are: seconds per hand (and whether that
holds up as the deck thins), how often swaps and discards are used to BUILD a hand rather
than rescue a stuck board, and which hand sizes are favoured. All three set the curve more than
any Trick does, and none can be guessed from the bot.

What the recording is NOT for: replaying your hands with a Trick added. A Trick changes which
hand you would have picked, so a recorded hand cannot be re-scored honestly. The recording
tunes the bot's pace and habits; the bot then plays the Tricks.

Plan, if the owner agrees:
1. `index.html?record`: Classic, walkthrough off, 5x4 board, 3 swaps, 3 discards, Focus
   starting at 10, no Tricks, round length 1:00 or 3:00 by a key. Every hand, swap, discard
   and Reshuffle is logged with its clock time, cells and cards; Copy at the end (the bug
   report's clipboard path). 8 one-minute and 8 three-minute rounds as the owner offered.
2. One extra session with 3 random Tricks, to see how the owner adapts to a Trick (the bot
   cannot). Optional.
3. The bot gets a pace model from the log (seconds per hand by hand size and by clock), a
   swap/discard policy from the swaps actually made, and a hand-size preference.
4. Rerun the three probes with that bot and print the goal-vs-score table per mode.

## 6. What other games' players say (forum research, 2024 to 2025)

Balatro's community consensus, from Steam discussions and r/balatro:
- **Commit to one hand type, but keep a backup.** Guides say "commit to one kind of hand and
  build your whole strategy around that" and in the same breath "always have a backup, usually
  Pair or Two Pair". Players who force a hand before the deck and Jokers support it report
  unstable draws.
- **Straights and straight flushes are the sore spot.** "Straight decks are really hard to
  build, and there isn't a ton of reward if you do". "Straight Flush is a joke... run Straights
  and it'll be more consistent". Flush builds "often have off turns when you play hands that
  score almost nothing to look for your high value hand".
- **The pull toward specialising comes from the planet cards** (hand-type levelling) and from
  blinds growing faster than a spread build can keep up with: "as a run goes longer I basically
  have to commit to one or two hand types". That is the same force the owner describes: a
  per-hand-type ladder forces a choice, a per-family ladder does not.
- **Deck thinning is the accepted answer to bricking**: cut low cards, cut off-suit cards, so the
  specialised hand comes more often. Our game's deck editor and Fodder are the same lever.

Slay the Spire design notes seen along the way: meta-progression as variety rather than power;
"power lives in removing weak cards, not adding strong ones"; pity counters on rare drops so a
bad run is smoothed without the player being told.

Sources:
[Steam: straight decks are hard to build](https://steamcommunity.com/app/2379780/discussions/0/4308327178395218322) ·
[Steam: straight flush is a joke](https://steamcommunity.com/app/2379780/discussions/0/596265345117861934) ·
[Steam: flush builds have off turns](https://steamcommunity.com/app/2379780/discussions/0/4693405608847578498) ·
[Steam: always have a backup](https://steamcommunity.com/app/2379780/discussions/0/4346606879507723339) ·
[Steam: commit to one or two hand types](https://steamcommunity.com/app/2379780/discussions/0/4361250086037205608) ·
[r/balatro: straights are actually kinda good](https://redlib.nohost.network/r/balatro/comments/1cjyqbp/i_was_a_doubter_but_straights_are_actually_kinda) ·
[PC Gamer: 19 Balatro tips](https://www.pcgamer.com/balatro-tips) ·
[Slay the Spire mechanics notes](https://saschb2b.github.io/game-mechanics/games/slay-the-spire/)

## 7. The questions the owner has to answer

These are the owner's own questions, distilled. Each one, answered, unblocks a concrete change.

**A. Who the curve is for**
1. Is the first difficulty tuned for a 6s-a-hand player (you) or a 9s player (a careful new
   player)? Round 1 at 1,500 is easy for the first and a coin flip for the second.
2. What clear rate should that player have at each review? For example Q1 95%, Q2 85%,
   Q3 70%, Q4 50%. These four numbers ARE the curve; the probes can then print the goals.

**B. What grows the player after the tray is full**
3. The tray fills during Q1 in both modes. After that, which of these is MEANT to carry a
   run: natural scaling (speed), improvements, selling Tricks to take better ones, limits,
   Sleights and the deck editor? Rank them. The curve's late growth rate follows the answer.
4. Should Trick count keep mattering past 5, by making Trick Slots a more common limit, or is
   the cap the intended taper?

**C. Natural scaling**
5. Keep the family ladder (sets / runs / flushes) as the one scaling axis? Today it already is;
   the per-hand-type table is the old model. (The owner's lean, stated in this session: yes.)
6. Should it count hands played (today: pays speed twice, 8x of the late game for the bot), or
   something time-normalised, such as rounds cleared or a capped number of hands a round?
7. How big should it be at Q4 relative to the Tricks? Today the bot's Q4 score is 8x what it
   would be without it.

**D. Specialising in one hand type**
8. Do you want more Tricks that name ONE hand type (about ten exist), and if so only at epic
   and legendary, where the economy to chase them (8 swaps, 8 discards, time) is likelier?
9. Is the family ladder the backup that makes specialising safe, or does a specialist also
   need a "brick insurance" piece (a Knack that pays when the named hand is unavailable, or a
   Sleight that fetches it)?

**E. Six and seven card hands**
10. Which layering rule: (a) today's, the whole hand plus a flush overlay; (b) a duplicate rank
    unlocks a second component (a run of 5 with a pair inside it is a run of 5, a pair, and a
    second run); (c) every standalone sub-hand of a minimum size counts (4+ in a 6-card hand,
    5+ in a 7-card hand). (b) is the owner's stated lean; (c) is the one that blows up.
11. What does a layer pay? Replays only (today's shape), Focus per layer, or a base pip / mult
    value per layer (which the card ladder removed).
12. Is there a cap on layers (three was the number used)?

**F. The recording**
13. Go ahead with `?record` as in section 5 (8 one-minute and 8 three-minute rounds, 5x4,
    3 swaps, 3 discards, Focus from 10, no Tricks)? And one session with 3 random Tricks?

A note on order: A and B come first. C and D are design calls that do not need the recording.
E is independent of all of it and can wait for the itch build if the owner prefers.
