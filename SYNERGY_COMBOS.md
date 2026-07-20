# Synergy Combos — Design Note

> Status: **combo connector entities SHIPPED in r83.** Base build: **r65** (design) → r83 (code).
> This note captures the "rare-but-powerful combo" design discussion. The 14
> connector entities (see below) are now live; see `combo_entities` spreadsheet
> for the exact final list the owner approved.
>
> **r83 shipped:** 5 Tricks (Landfill, Old Growth, Magician, Stand-Up, Scalper),
> 8 Knacks (High and Mighty, Low and Behold, Down and Back In, Muscle Memory,
> Curator, Scavenger, Coin Toss, Martyr), 1 Sleight (Magnet), plus a combo
> legibility layer (`COMBO_FAMILIES` + round-start "COMBO ONLINE" / "combo close"
> toasts). These created a 10th family — **Sleight Charges** (Magician/Stand-Up/
> Scalper hoard-vs-spend, fed by Coin Toss/Martyr).
> **Still open (future chats):** pool growth to ~150 tricks / 16–20 knacks,
> more trick-priming + money entities, run-structure (4 Eras) + vocab rename.

The goal: Slay-the-Spire-style combos. Extremely rare to assemble, but when you
pull one off it trivializes part of the game and feels *earned* — not broken.
(The Ironclad example: Barricade keeps block → big-block card → Entrench doubles
block → Body Slam deals damage = block.)

---

## 1. The combo skeleton (the formula)

Every great combo is the same 4-link chain. Each link hands off to the next.

| Link | Job | Usually a… |
|---|---|---|
| **1. Tax-remover** | Deletes the cost/limit that normally stops you doing a thing a lot | **Knack** |
| **2. Engine** | Each time you do that now-free thing, it *produces a resource* | **Sleight** or **Trick** |
| **3. Amplifier** | Turns a *pile* of that resource into a multiplier | **Trick** or **Sleight** |
| **4. Payoff** | At scoring time, converts the hoard into raw points | **Trick** |

**Test for "is this a real combo":** the output of link 4 should feed back into
link 1, *or* link 1 should let link 3 grow without a ceiling. If the loop
closes, it feels broken-but-earned. If not, it's just four nice cards.

The strongest ("legendary") combos use **~5 entities** because they double a
link — two tax-removers that cancel a downside, or two amplifiers that stack.
Typical shape: ~1 knack + ~2 sleights + ~2 tricks.

### Vocabulary recap (renamed since CLAUDE.md was written)
- **Trick** = on-grid / tray scoring buff (old "Bonus Card"). `TRICK_POOL`.
- **Sleight** = deck card with an activation (old "Joker"). `SLEIGHT_POOL`.
- **Knack** = persistent rule-changer (old "Totem"). `KNACK_POOL`.

---

## 2. The economy that makes combos "rare yet achievable"

**North-star rule:**

> In a full winning run, the player should acquire roughly **25–35% of the
> sleight pool** and **20–30% of the knack pool** — and never more than ~50%.

This is the Balatro principle: you see far less than exists, so a *specific*
combo never comes on demand, but you always cobble *something* together.
Scarcity is what creates build identity.

Method: **decide how many of each you hand out per run, then set the pool to
~3× that.** Not the other way around.

### Current drop weights (per random buff offer)
`trick 62 / sleight 15 / knack 9` (see `index.html` reward-pick logic).
These are well-tuned for scarcity — a player ends a ~15-level run with roughly
**5–7 sleights** and **3–4 knacks** (NOT one knack per grid).

### Recommended pool sizes

| Entity | Seen / run | Acquire / run | → Pool target | Have now (r65) | Action |
|---|---|---|---|---|---|
| **Sleights** | ~12–15 | ~5–7 | **24–30** | ~25 | keep; +3–5 for variety |
| **Knacks** | ~6–8 | ~3–4 | **16–20** | 14 | **add ~4–6** |
| **Tricks** | **~50** | ~25–35 | **~150** | ~125 | grow to ~150 |

### Trick economy (firm numbers — owner-specified)
- Pool **~150**; player **sees ~50** per run = **33% exposure** (healthy "see a
  third"). Don't exceed ~150 — returns flatten and balance load climbs.
- Reward grid is **4×4 = 16 nodes**, ~8 positive, **≥5 of them tricks**. That's
  62% of positive rewards — almost exactly the existing `trick 62` drop weight,
  so it's internally consistent, not a new rule.
- **20 normal rounds** → 20 grids × 5 = 100 trick-offer slots; pathing + the
  owned-filter collapse that to ~50 *distinct seen*. Consistent.
- **Combo math that results:** P(see a specific trick)=50/150=1/3 →
  P(see both of a 2-trick combo)≈11% → after having to *pick* them, ~5–8% per
  named combo → with 8–10 families, assemble *some* ≈50% of runs. ✓ on target.

### ⚠ Two levers this exposes
1. **Trick capacity = a new limit (SHIPPED r74).** Tricks were uncapped, so
   ~50 seen → ~25–35 kept = board soup that buries combo pieces. Fixed: Tricks
   have their **own `LIMITS_DEF` entry** — *not* tied to grid size or hand size,
   because in **tray mode** (the default) tricks live off the grid. This doubles
   as the "soft cap" and adds a dial to the limit-manipulation game. Full tray →
   replace-or-skip popup (see REWARD_GRID_VARIETY.md).
   ```js
   { id:'trick_slots', label:'Trick Slots', icon:'✦', desc:'Max Tricks you can keep at once', base:5, max:10, weight:0.4 }
   ```
   - **Base 5** (owner call — was 4 in earlier spec), max **10**: fits exactly a
     5-piece combo at the start (tight but possible); a maxed run holds a combo +
     support tricks. Player routinely hits the cap → replace tension stays live.
   - **Keep `base` fixed** (don't randomize the start — combos reward planning).
     For run variance, inject it visibly via a knack ("+2 Trick Slots") or an
     Era-1 event, not baked-in randomness.
   - **Make the *upgrade* rare (DECIDED).** Today limits are offered by uniform
     `shuffle().slice()` in both the shop (`index.html:12797`) and the Limit
     Break event (`9754`) — there is **no weighting table** (only sleights are
     rarity-weighted). Add an optional `weight` to `LIMITS_DEF` (default 1) and a
     shared weighted-pick helper used by both spots. `trick_slots` weight ~**0.4**
     → ~8% of shop visits, ~40–50% of runs see it offered. Tune after playtest.
     This also retroactively gives every limit a tunable appearance rate.
2. **Tier-weighting vs keystones.** Combo payoff tricks skew rare/epic; if the
   grid leans common, the keystone's see-rate drops below 1/3 and combos drift
   too rare. Don't make *every* keystone top-tier, or guarantee a high-tier node.

### The key insight: many rare combos = reliably get one
A *specific* 2-sleight combo is ~4–10% per run with these pools. That feels too
rare alone — but it isn't, because the **union** of many combos is common:

- 1 combo family @ 8% → big combo ~8% of runs (bad)
- **8 families @ 8% each → at least one ~50–60% of runs (great)**

So the real lever is **number of distinct combo families.** Target **8–10**.

---

## 3. Run structure & vocabulary (proposed)

The old 24-level number was back-solved. Current plan: **20 normal rounds**.

- **4 Eras × 5 Levels = 20 normal rounds** (+ a boss as the 5th Level of each
  Era). This is the longer option; drop to 3 Eras (15) if pacing drags. The
  trick economy above assumes 20 normal rounds = 20 reward grids.
- **Vocab** (leaning into the loose time theme):
  - one round timer = **Level**
  - a set of 5 levels + boss = **Era** (bosses end "an Era"; can be named, e.g.
    "Era of Embers"). Avoid "Act" (too theatre/Spire).
  - the whole run = **Epoch** (or just **Run**).

---

## 4. Combo families

★NEW = a piece that must be created. Everything unmarked already exists in r65.

### Already latent in the pools

**① The Discard Furnace**
- Tax-remover ×2: `Free Discards` + `Hoarder` → verified in code these cancel
  (`index.html:8120` — Free Discards zeroes per-card cost; Hoarder stops the
  decrement). Result: **unlimited discards at zero time.**
- Engine: `Cull` (discard → +1 Focus) + `Cash Out` sleight (discard → 10 coins)
- Amplifier: `Compost` (+3 pips/card discarded this round) + `Penny Saved`
  (each 5 discarded → perm +5 pips)
- Payoff: **★NEW Trick "Landfill"** — hands score +1 mult per 8 cards discarded
  this round. (Closes the loop: free cycling → mult.)

**② Frozen Hour** *(already complete)*
- Tax-remover: `Time Bank` + `Clock Tower` (hoard seconds)
- Engine: `High Water` (runs pause the clock) + `Time Keeper` sleight (+20s)
- Amplifier: `Frozen Moment` (hands while paused ×2)
- Payoff: `Sands of Time` (remaining time ÷2 → pips) or `Dark Matter` (spade
  hands: half remaining time → pips)

**③ Retrigger Cascade** *(the marquee one)*
- Engine: `Soul Mirror` (every scored card of a chosen rank retriggers anywhere)
  + `Reflect` + `Echo Line` / `Corner Power`
- Amplifier: `Hard Labour` — each club = escalating *doubling* pips, and its
  text literally says **"retriggers count."** Point Soul Mirror at clubs → each
  retrigger doubles again (exponential).
- Payoff: `Sideways to Infinity` (each 8 scores once per 8 in the hand)
- Tax-remover: **★NEW Knack "Echo Chamber"** — retriggers no longer decay Focus,
  and the highest-ranked card retriggers one extra time. (The link this family
  lacks today.)

**④ Focus Overdrive** *(already nearly complete)*
- Engine: `Gnomes` + `Rhythm` + `Kaleidoscope` (pump Focus)
- Tax-remover: `Meditation` (slower decay) + `First Wind` (no decay 45s)
- Amplifier: `Flash Flood` / `Richter` (jump Focus to next threshold) + the
  Focus multiplier itself (×1.5+)
- Payoff: `Flow State` (+10 pips/card while Focus high)

### New families to design (round out the 8–10)

**⑤ The Priming Press** *(retriggers TRICKS, not cards — a distinct axis)*
- Engine: `Inspirato` (Ace → prime first & last Trick) + `Prime Times`
  (prime-rank card → prime next Trick, cycling)
- Amplifier: `Double Take` (each 2 → duplicate most-recent Trick's effect)
- Payoff: whatever heavy Trick gets primed (e.g. `Knave for the People` ×2 pips
  per Jack, primed = fires twice)
- Tax-remover: **★NEW Knack "Muscle Memory"** — primes persist one extra hand.

**⑥ Permanent Snowball**
- Engine: `Naturalist` sleight + `Bomb` sleight + `Sapling` + `First Fruits`
  (cards gain permanent pips)
- Amplifier: `Snowball` (after a 500+ hand, each scored card perm +2 pips)
- Payoff: **★NEW Trick "Old Growth"** — each card also adds its *permanent* pip
  total to mult. (Converts the slow perm-pip pile into a spike.)

**⑦ Run Engine**
- Engine: `Cascade` + `Storm` + `Rogue Wave` (runs score huge) + `The Queen`
  sleight (wild rank fills any run)
- Amplifier: `Tide Table` (×mult building per Run scored this round) + `Undertow`
- Payoff: `Flash Flood` (runs of 4+ jump Focus) → feeds Focus Overdrive
- (No new piece needed — already a complete family.)

**⑧ Twenty-One** *(cute, niche)*
- Engine: `First Light` (Ace = 21 pips) + `Face Value` + `The Queen` (wild rank
  to hit the total)
- Payoff: `Twenty-One` (face values total exactly 21 → ×3)
- A "puzzle" combo — rare to line up, satisfying when it lands.

**⑨ Position Lock** *(optional 9th)*
- Engine: `Ley Line` (perm-double at an intersection) + `Power Line` + `Echo Line`
- Amplifier: `Four Corners` (2×2 ×4) / `Diagonal` (2 corners ×4)
- Tax-remover: `Free Range` knack (swap any two non-adjacent cards) to assemble
  shapes on demand.

---

## 5. New entities this implies (~6 — matches the pool-growth target)

| Type | Name | Role | Effect |
|---|---|---|---|
| Trick | **Landfill** | discard payoff | +1 mult per 8 cards discarded this round |
| Trick | **Old Growth** | perm-pip payoff | each card adds its permanent pips to mult |
| Knack | **Echo Chamber** | retrigger tax-remover | retriggers don't decay Focus; top card retriggers +1 |
| Knack | **Muscle Memory** | priming tax-remover | primes persist one extra hand |
| Sleight | *(TBD glue)* | suit/position engine | e.g. wild-suit or shape helper, to taste |
| Knack ×2 | *(variety)* | — | ~2 more knacks to reach the 16–20 target |

After these, every resource (Discards, Time, Retriggers, Focus, Permanent-pips)
has a complete 4-link chain, and there are 8–10 combo families — so a player
assembles *some* legendary combo ~60% of runs while any *specific* one stays a
1-in-10 thrill.

---

## 6. Making combos legible (don't skip this)

Combos that exist but are invisible feel like accidents, not discoveries. Cheap
ways to surface them without hand-holding:
- Shared **tags** across a family's pieces (some already exist: `retrigger`,
  `discard`, `focus`, `position`).
- A subtle "synergy" hint when the player owns 3 of a family's ~4 pieces, nudging
  toward the 4th.
- Theme-draft events (Confluence) already bias toward tag families — lean on that.

---

## Open decisions for the owner
1. 3 Eras (recommended) vs 4?
2. "Era" / "Epoch" vocab — approve or pick alternates (Age, Chapter, Cycle)?
3. Build the ~6 new entities now, or design more families first?
