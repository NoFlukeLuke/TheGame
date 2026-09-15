# TERMINOLOGY

The one reference for what things are CALLED. If you are renaming anything the
player reads, start here and change nothing else until this file is updated.

## Two vocabularies, one switch (r198)

**Settings -> Display -> Wording** picks between them. Entity NAMES are not in
this system - "Cascade" is content, not vocabulary, and never changes.

| concept | code id (frozen) | corporate | gamer |
|---|---|---|---|
| per-card score input | `pips` | **WORK** | PIPS |
| hand multiplier | `mult` | **SKILL** | MULT |
| tempo meter | `focus` | FOCUS | FOCUS |
| banked score | `score` | **OUTPUT** | SCORE |
| round target | `goal` | **QUOTA** | GOAL |
| scoring buff, side tray | `trick` | **Utility** | Trick |
| deck card with an effect | `sleight` | **Vendor** | Sleight |
| permanent rule-changer | `knack` | **Cert** | Knack |
| playing card | `card` | **Doc** | Card |
| `common` / `rare` / `epic` / `legendary` (trick) | | Lite / Standard / Plus / Deluxe | Common / Rare / Epic / Legendary |
| the same ids (sleight) | | Trial / Contract / Retainer / Partner | Common / Rare / Epic / Legendary |

**Descriptions are STORED in the gamer wording and translated at display time.**
`lexProse()` runs inside `highlightKeywords()`, which every description already
passes through on its way to the screen. That is what lets 300-odd mentions of
"pips" and "mult" follow the toggle with no data edits, no second copy of every
description, and no way for the two to drift apart. In gamer mode it is the
identity transform, so that side costs nothing.

**Only unambiguous NOUNS are swapped.** `score` is deliberately not in the prose
table: it is a verb throughout the descriptions ("Runs score +10 pips per card"),
and swapping it yields "Runs output +10 work per card". It changes as a HUD
label only.

**The keyword table carries BOTH vocabularies' terms** (`terms:['pips','pip','work']`),
so keyword colouring survives the substitution either way round.

**Static labels in `index.html` carry `data-lex`** and are rewritten by
`applyLexiconToDOM()` on load and on every toggle, so the HUD chips need no
per-site update code.

## The rule that makes renames cheap

**Code identifiers never change. Only display strings change.**

`tier:'epic'` stays `'epic'` in the data files forever. A single lookup turns it
into "Plus" on screen. The same goes for `trick`, `sleight`, `knack`, `card`:
those words are frozen in the code and are only translated at the moment they are
drawn.

Rename the ids too and you break, all at once: every save file (`SAVE_VARS`
round-trips these strings), every CSS class (`rar-epic`, `trick-tier-epic`,
`sl-rar-epic`), every grep in CLAUDE.md, and every entry in the three data pools.
For nothing: the player never sees an id.

So a future rename is one column of this file plus one row of `TIER_LABELS` or
`ENTITY_LABELS`. That is the whole job.

**Corollary: never print an id.** `tier.toUpperCase()` looks harmless and is how
the old vocabulary leaked into eight different screens. Display goes through
`tierLabel()` / `tierInitial()` (js/labels.js). If you find yourself upper-casing
a raw id, you are creating the next rename's problem.

## Entity categories

| concept | code id (frozen) | player word | drawn as |
|---|---|---|---|
| playing card | `card` | **Doc** | document with a folded corner |
| scoring buff, side tray | `trick` | **Utility** | floppy disc, body coloured by rarity |
| deck card with an effect | `sleight` | **Vendor** | business card, stock coloured by rarity |
| permanent rule-changer | `knack` | **Cert** | line on your record |
| currency | `coins` | **Credits** | (unchanged) |

## Scoring vocabulary

| concept | code id (frozen) | player word | notes |
|---|---|---|---|
| per-card score input | `pips` | **WORK** | the raw material you put in |
| hand multiplier | `mult` | **SKILL** | how good an arrangement you found |
| tempo meter | `focus` | **FOCUS** | unchanged |
| lifetime banked score | `totalScore` | **OUTPUT** | |
| per-round target | `roundGoal` | **QUOTA** | |

`SKILL` and `FOCUS` are both 5 characters, matching the existing chip width. Any
future replacement longer than 5 needs a measuring pass on the landscape chip row
(`#score-subboxes`).

The tutorial framing these support:

> Your goal is to produce sufficient output in a timely manner. Your required
> output is listed here, under quota. You produce output by doing work, and you
> can improve the output of your work through skill and focus.

## Rarity ladders

Four tiers. Each entity type grades on its own ladder, because a floppy disc and
a person are not graded the same way, but they share one colour spine so the
player learns the ordering once.

| code id (frozen) | colour | Utility (trick) | Vendor (sleight) | Cert (knack) |
|---|---|---|---|---|
| `common` | mint | **Lite** | **Trial** | **Basic** |
| `rare` | cyan | **Standard** | **Contract** | **Advanced** |
| `epic` | purple | **Plus** | **Retainer** | not used |
| `legendary` | magenta | **Deluxe** | **Partner** | not used |

**Certs use only two tiers, deliberately.** The knack pool has 24 common and 24
rare and that is the shape it is meant to be. `epic` and `legendary` fold onto
Advanced in the labels table, so a stray entry still renders rather than blanking.

**`mythic` was merged into `legendary` (r197).** Five tiers meant the top two were
one tier wearing two hats: 12 of 177 Utilities and 4 of 40 Vendors between them, at
2% and 1% drop weights. Across a Classic run's ~18 Vendor offers that is 0.36
expected Legendaries and 0.18 Mythics, so most runs met neither, and a tier the
player never meets teaches nothing. `mythic` is not a valid tier id any more.

The retired fifth colour is **yellow**. The top tier took magenta rather than
yellow so that it also inherits the pulse animation the old mythic tier had.

**The weight tables caught up in r226.** The data pools were re-tiered onto four
at r197, but `ENTITY_TIERS` / `ENTITY_TIER_W` kept a fifth `mythic` slot at
weight 1 that matched nothing - every roll landing there cascaded down into
legendary anyway, and the Limit Break tile, which hard-coded `tier:'mythic'`,
asked for a `rar-mythic` colour no stylesheet defines. Its weight is folded into
legendary, so the effective spread is unchanged. See CLAUDE.md, "Rarity rolls and
LUCK".

### Why Vendors, not Hires (r200)

The category was **Hires** for one revision, and it was wrong. Read the roster:
Warehouse, Lighthouse, Whetstone, Flywheel, Governor, Catalyst, Lightning Rod,
Amplifier, Magnet, Capacitor, Power Cell, Piggy Bank, Shady Tree, Bellhop,
Recycler, Petty Cash. **Not one of the 43 Sleights is a person's name**, and
every one of them reads as a small company. Framing them as people you hired
meant explaining how "Lighthouse" is an employee, which nothing else in the
world supports.

They are **vendors**: a card in your rolodex, a company you can call. The object
is a business card - a logo mark and a company name, never a photo and a face.

### What each Vendor tier means mechanically

The ladder is not a power ranking, it is a **duration** ranking, and that is the
point of it. The tier says how long the relationship lasts:

| tier | keeps |
|---|---|
| Trial | expires after N rounds |
| Contract | N jobs left (this is `durability` / `_usesLeft`) |
| Retainer | permanent |
| Partner | permanent, and scales with the run |

**Contract** maps 1:1 onto the charge system Sleights already have, and is a
better word for "3 uses left" than Contractor ever was. Do not drop that rung
when reshuffling the ladder.

### What each one LOOKS like (r228)

The word and the object agree, which is the point of naming them this way:

| entity | object | drawn in |
|---|---|---|
| Utility (trick) | a **floppy disc** - chamfered shell, metal shutter, cream label | `.reward-cell.entity-trick` |
| Vendor (sleight) | a **business card** - logo mark upper-left, name across the bottom | `.reward-cell.entity-sleight`, and `.trick-card.sleight-card` on the board |
| Cert (knack) | the moulded plastic diamond (unchanged) | `.rwd-diamond` |
| Doc (card) | still an ordinary playing card | **not done** - see CLAUDE.md |

The shell or the stock **is** the rarity colour, so colour still means rarity and
shape still means type (r198). The Vendor's card is LETTERBOXED in its frame
rather than stretched: a business card is landscape and every frame is portrait.

The playing card as a **document with a folded corner** is designed in
`art-preview.html` and is not in the game yet. It is the piece that would make
the board one system; it is also the one that touches every card.

### Utility versions are a SECOND axis, not part of the tier

A Utility upgraded by the improvements system gains a version: `Standard v3.0`.
Tier is what you found; version is what you have done to it since. They read as
different things at a glance, which is the whole reason they are separate fields.

## Superseded words

Kept so an old screenshot, comment or commit message can still be decoded.

| old | current |
|---|---|
| File (the card, briefly) | **Doc** |
| Bonus Card / BC | Trick -> **Utility** |
| Joker | Sleight -> **Vendor** |
| Hire (briefly, r197-r199) | **Vendor** |
| Totem | Knack -> **Cert** |
| Personnel File (RECORDS tab) | Owned |
| mythic | merged into `legendary` -> **Deluxe** / **Partner** |
| Mythic / Legendary (two tiers) | one top tier |
| PIPS | **WORK** |
| MULT | **SKILL** |
| coins | Credits |

## Where the strings live

- **js/labels.js** - `LEXICONS` (both vocabularies), `tierLabel()`,
  `tierInitial()`, `entityLabel()`, `lexTerm()`, `lexProse()`. The only place a
  tier or category word is spelled out.
- **js/data/*.js** - carry ids only. A `name:` or `desc:` here is content, not
  vocabulary, and is renamed by hand.
- **css/*.css** - class names are ids (`rar-legendary`, `trick-tier-common`).
  They do not change when a display word does.
- **index.html** - a handful of hard-coded labels in the action buttons and the
  score panel.

## Doing a future rename

1. Change the word in the table above.
2. Change the matching row in `js/labels.js`.
3. Add the old word to **Superseded words**.
4. `grep -rn "<old word>" js/ css/ index.html` and fix any content strings
   (entity names, descriptions, tutorial copy) - those are prose, not vocabulary,
   so they are not covered by the label table.

Nothing else should need touching. If it does, that site is printing an id, and
the fix is to route it through `js/labels.js` rather than to edit it in place.
