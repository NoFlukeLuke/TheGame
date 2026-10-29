# Money Tricks and selling: what we have, what others do, twenty ideas (r709)

The owner's list from the r706 chat: we need two or three more money Tricks and at least
three entities that interact with selling. Nothing here is built.

## What we have

**Paying or reading credits (Tricks):** Interest (x pips by credits held), Blood Diamonds
(+5 credits on hearts-and-diamonds hands), Coin and the Sword (line cards may pay the hand
size), Love of Money (fused: Obsessed + Interest), Clean Sweep (+4 credits for a cleared line),
Middle Man (+3 mult each time credits move), Five for Fodder (a discarded valid hand pays its
size), Undue Influence (a set with a face card pays the set count), Obsessed (hearts x mult by
credits), Buried Treasure (diamonds may grow credits x1.1), Feelin Lucky (selling it costs 30%
of your credits).

**Knacks:** Inheritance (+5 a round), Short Change (+1 for a short hand), Bulk Buyer, Haggler,
Time and a Half, Gross Pay, High Roller (replays by credits), Down and Back In (+5 on a top-rank
discard), Scavenger (+10 when a curse lifts), Dividend (+8 at the Focus limit), Trade Winds
(half your Focus as credits at round end).

**Sleights:** Fresh Start (costs 3), Cash Out (+10), Piggy Bank (+5 a round), Capacitor
(Focus and seconds into credits), Petty Cash (fixture, +5).

**Selling:** a Trick or Knack can be sold from its tray for credits. Only two entities care:
Feelin Lucky (refuses the sale, costs 30%) and Advance Notice (selling it changes the next boss).
Nothing raises a sell value, pays for selling, or uses what was sold.

## What other games do

- **Balatro** (jokers): Egg's sell value rises each round it is held, a savings account;
  Gift Card raises every joker's sell value each blind; Swashbuckler adds mult equal to the
  total sell value of your jokers, so the two feed it; Ceremonial Dagger destroys the joker to
  its right and keeps its sell value as mult; Campfire grows with every card sold.
- **Slay the Spire** (relics): Maw Bank pays gold every floor until you spend at a shop; Old
  Coin is a one-time windfall; Ceramic Fish pays gold whenever a card joins the deck; Golden Idol
  raises gold found; Ectoplasm is power for never gaining gold again.
- **Luck be a Landlord** (symbols): some symbols destroy others for coins (Mouse eats Cheese);
  capsules break themselves for their contents; removal tokens are a second currency for
  taking a symbol out.

The shapes worth taking: a thing that is WORTH more the longer you keep it, a reward for
NOT spending, a payout for growing or thinning the deck, and score that reads what you could
sell.

## Ten money Tricks

1. **Nest Egg** (common): pays nothing when scored; at each round's end +1 credit for every
   2 rounds you have held it (Balatro's Egg, paid in credits rather than sell value).
2. **Small Change** (common): 2s, 3s and 4s scored pay 1 credit each.
3. **Overtime Pay** (rare): hands played in the last third of the round pay 1 credit a card.
4. **Commission** (rare): every card added to your deck pays 3 credits (Ceramic Fish).
5. **Bonus Structure** (rare): clearing a goal pays 1 credit for every 10% you are over it.
6. **Golden Handshake** (rare): +6 credits at each round's end while you have bought nothing
   in a shop this run; the first purchase ends it for good (Maw Bank).
7. **Expense Account** (epic): every credit spent this round is +2 mult on your hands.
8. **Gold Standard** (epic): diamonds score x pips equal to 1 + credits / 200 (Obsessed's
   shape on the other red suit).
9. **Hedge Fund** (epic): a round you end without swapping pays 10% of the credits you hold.
10. **Payday Loan** (rare, cost): take it and gain 25 credits; it scores +15 mult and takes
    3 credits at every round's end; sell it to stop paying.

## Ten selling entities

1. **Appraiser** (Trick, rare): + mult equal to the total sell value of your other Tricks
   (Swashbuckler).
2. **Gift Card** (Knack, rare): at each round's start every Trick you hold sells for 1 more.
3. **Antique** (Trick, common): scores +4 pips a card; its sell value rises 2 each round held.
4. **Fire Sale** (Knack, rare): each Trick or Knack you sell gives this x0.1 mult, reset by
   each boss (Campfire).
5. **Pawn Shop** (Knack, common): selling pays the full shop price instead of the sale price.
6. **Buyback** (Knack, rare): the last Trick you sold waits on the next shop's first shelf at
   its sale price.
7. **Trade-In** (Knack, epic): selling a Trick offers a pick of two Tricks one rarity higher
   instead of the credits.
8. **Asset Strip** (Trick, epic): at each round's start sells the Trick to its right and gains
   its sale value as permanent mult (Ceremonial Dagger).
9. **Estate Sale** (Sleight, rare, 2 charges): double-tap: sell a random Trick for three times
   its value.
10. **Clearance** (Knack, common): each sale knocks 10% off the next shop, up to 40%.

A sell value would need to become a number a Trick carries (it is worked out from the tier
today, `trickSellValue`): 2, 3 and 8 read it, 1 and 6 raise it.

Sources: [dood.gg Balatro jokers](https://dood.gg/balatro/jokers),
[Steam: Gift Card raises every sell value](https://steamcommunity.com/app/2379780/discussions/0/4293690852341338563),
[Slay the Spire wiki: Gold](https://slaythespire.wiki.gg/wiki/Gold),
[Slay the Spire wiki: Relics](https://slaythespire.wiki.gg/wiki/Relics),
[Luck Be a Landlord (Wikipedia)](https://en.wikipedia.org/wiki/Luck_Be_a_Landlord),
[Twinfinite: removing symbols in Luck be a Landlord](https://twinfinite.net/guides/how-remove-symbols-luck-be-a-landlord/).
