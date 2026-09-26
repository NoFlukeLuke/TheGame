# Look direction — the research, the diagnosis, and three ways out

**Open `look-preview.html`.** Tabs switch between Today / A / B / C on the identical
screen; keys `1` `2` `3`. Two sliders (PS2 grit, CRT) and a **greyscale test** that is
the fastest way to see what is actually wrong.

---

## 1. The layout is not the problem

Every panel in the preview sits at the **exact percentage** it sits at in
`css/style.css`'s `#stage.landscape` block. Nothing moved. The whole difference
between "Today" and A/B/C is **material** — surface, light, palette, type, texture.

That matters practically: none of this touches `recomputeGridMetrics`, the 747×420
fixed-canvas architecture, or a single JS file. The fixed-canvas-scaled decision was
right and it stays.

---

## 2. What is actually wrong, measured

Three findings, all computed against the real CSS rather than eyeballed.

### 2.1 Value is constant; only hue varies

Every accent in the game sits in a narrow luminance band against the background:

| accent | contrast vs `--bg` |
|---|---|
| mint `#35d59b` | 10.4 |
| cyan `#16c8d8` | 9.6 |
| violet `#b39cf5` | 8.4 |
| coral `#ff6a3c` | 6.9 |

Six saturated hues all shouting at one volume. That is *exactly* the recipe for a
screen that reads **busy and flat at the same time** — busy because there are many
hues, flat because none of them is louder than the others, so there is no focal
point and no hierarchy.

**The test:** desaturate a screenshot. If the hierarchy vanishes, the palette is
broken. Today's vanishes completely. That is the measurable version of "sad".

The rule that fixes it: **encode ordinal meaning on LIGHTNESS, categorical meaning
on HUE.** Rarity is ordinal and is currently on hue, which is why `common` and
`rare` are **1.08:1 apart** — indistinguishable in greyscale, in peripheral vision,
and to about 8% of male players. Same story for the pips/mult corner bands at
**1.12:1** (position is doing all the work there; colour contributes nothing).

### 2.2 The borders are below threshold

- `--border #3a3020` → **1.51:1** against the background
- `--border #46381f` → **1.72:1**

WCAG 1.4.11 asks **3:1** for a component boundary. Enclosure is the single strongest
grouping tool available, and it is currently not reaching the eye — which is why
nine panels read as one undifferentiated field.

Also failing body-text contrast (4.5:1): `#3a6fca` (pips, 4.00), `#c0392b` (mult,
3.59), `#8844cc` (3.48), `#7a6030` (3.29). Fine as graphics, not as text.

### 2.3 The cards float on nothing

No table, no texture, no light source, no shadow anywhere on screen. A card game
without a surface reads as unfinished no matter how good the cards are — and **the
cards are genuinely good**, the best-drawn thing in the build. They just have
nowhere to sit.

### Also found, worth fixing whenever

- **623 hardcoded hex literals** and **no `:root` palette block**. Four token names
  hold *two different values each* depending on which rule wins: `--cream`
  (`#f4ecd6` / `#f0e6c8`), `--gold` (`#ffb02e` / `#c9a84c`), `--border`, `--cream-dim`.
- **47 distinct font sizes** with half-pixel steps (8, 8.5, 9, 9.5, 10, 10.5…). A 5%
  size step is below the perceptual threshold, so most of that "hierarchy" isn't
  visible. Eight sizes on a 1.25 ratio: **9 / 11 / 14 / 18 / 22 / 28 / 34 / 43**.
- **Five typefaces** (Cinzel, Crimson Pro, Orbitron, Share Tech Mono, Courier New).
  Three is the working maximum. Orbitron has low x-height and tight counters — it is
  the exact small-size failure profile, and it's used down to 5px.
- **`#13110e` and `#14100b`** differ by ~0.5% lightness. That is one elevation
  wearing two names.

---

## 3. Two palettes, not one — this one is forced by measurement

A card face is `#F4EAD5`, luminance **0.83**. Measured *on* it:

| accent | contrast on a card face |
|---|---|
| cyan | **1.28** |
| phosphor green | **1.36** |
| amber | **1.53** |
| arcade blue | 2.40 |
| Killer7 red `#D81E2C` | 4.24 |
| navy `#1E3A5F` | 9.63 |

**No neon accent can be drawn on a card.** So the game needs a **dark-field palette**
with luminous accents for the HUD and chrome, and a separate **card-ink palette** of
dark accents for anything drawn on a card face. `cardBandInk` (r302) already found
half of this empirically with its 0.28 luminance-gap rule; naming it as two palettes
is what stops it recurring.

The same measurement **disqualifies an all-light UI**: a cream card on pale paper is
**1.14:1** and simply disappears. That is why direction B keeps its board dark even
though everything around it is light.

---

## 4. Why the CRT reads weak — it's diagnosable, not a matter of taste

`#cab-screen::after` is **inside `#cabinet`**, which carries `zoom: ~1.92`. A `1px`
line on a `3px` period paints at **1.92px on a 5.77px period** — fractional on both,
so consecutive lines land in different sub-pixel phase, come out at different
weights, and moiré against the pixel grid.

**This is the same bug r300/r302 already solved on the card corner bands** — and the
codebase already has the pattern for the fix: `.time-popup`, `#toast-layer`,
`#map-bar` and the goal banner are all body-level *specifically because* anything
inside `#cabinet` inherits that zoom. The scanline field is the most zoom-sensitive
layer in the game and it's the one still inside.

Then the depth is wrong. `mix-blend-mode: overlay` pivots at 50% luminance, so it
darkens dark panels ~14% and cream cards ~2.9% — **backwards**, since a real tube's
structure is most visible in midtones and is *washed out* by bloom in highlights.
Net modulation ≈ **2%**. A real CRT is **25–45%**.

And three of the four cues are simply absent:

| missing | why it matters |
|---|---|
| **phosphor triad** | provides *horizontal* structure. Scanlines alone read as venetian blinds over a screenshot. This is the #1 tell. |
| **bloom / halation** | bright areas must visibly **eat** the scanline gaps. This is the cue that separates emissive phosphor from printed lines. |
| **geometry** | a perfect rectangle reads as an LCD pretending to be a tube. |

| | cheap | convincing |
|---|---|---|
| edge | hard stop | soft ramp with a plateau, ~50% duty |
| pitch | fractional; 2px | **integer device px; 3–4px** |
| depth | 5–15% | **25–45%** on midtones |
| blend | `overlay` | **`multiply`** for the dark pass + **`screen`** for bloom |
| mask | absent | 3px RGB triad at α 0.06–0.12 |
| motion | static, or fast flicker | very slow roll (8–20s/screen) + rare 1-frame jitter |

**Direction B ships the fixed version**, confined to the board — which is where a
screen actually is, instead of smeared over the whole interface. Drag the CRT slider.

---

## 5. The three directions

All three are complete, on the real layout, with a working grit dial.

### A · The Felt — *casino pit console, 1984*
The card-game answer. A real table: felt with a weave, a leather rail, a dealer's
arc, and light falling from a single warm lamp top-left. Panels are instrument
plates milled into a bakelite console — engraved label, brass hairline, top
highlight, cast shadow. Three warm notes (brass, oxblood, forest) so the cream cards
read as **part of the set** rather than the only lit thing.
*Safest big win. Ages as stained felt, tarnished brass, ring-marked wood.*

### B · The Terminal — *beige hardware + amber phosphor, 1984*
The boldest answer to "too much text on plain dark backgrounds": **the interface
itself is light.** Putty-beige instrument chassis — the colour of every computer,
fax and cash register built 1978–1991 — with every live number sunk into a recessed
near-black readout window. Amber appears *only inside a window*, so the glow always
means "this number is live". Two hues in the whole UI. The board is the machine's
screen, and it is where the fixed CRT lives.
*Looks like nothing else in the genre and fits LETHE Corp exactly. Highest-variance
pick. Ages as yellowed plastic, toner streak, coffee rings.*

### C · Side Art — *screen-printed cabinet vinyl, 1983*
The loud one, done as **print rather than neon**. Flat spot colours, hard black
keylines, halftone fields, and shadows that are **hard offsets with zero blur** —
depth from stacking, never from bloom. The backdrop is a printed composition of
diagonal bands and dot screens, so nothing ever floats on empty black. Deliberately
**not synthwave**: no sunset, no wire grid, no glow.
*Most immediately fun. Weakest path to grit — screenprint doesn't age, it
misregisters.*

### Where the research lands

Institutional-80s (A and B) scores best on all three axes that matter here:
freshness, tolerance of cream card rectangles, and legibility of a dense numeric
HUD — and it degrades toward PS2 grit without changing dialect. **Synthwave scores
worst**, and not only on cliché: magenta (L 0.25) and cyan (L 0.64) straddle the
card's 0.83, so its accents either compete with the cards or vanish on them.

---

## 6. Grit is a dial, not a destination

PS2 is not a different art direction — it's the same one **degraded along a time
axis**: grain 0.03 → 0.10 and fine → chunky, neutrals desaturating, accents
narrowing from three to one, bevel highlights flattening, vignette deepening, edge
wear appearing. Drag the grit slider. Whichever direction gets picked, it ages down
that curve without a redesign.

---

## 7. The technical path

`css/style.css` is 316KB, which sounds fatal and isn't. **All nine landscape HUD
panels take their material from ONE rule** — the shared chrome block that sets
`background: var(--panel); border: 1px solid var(--border)`. Four more declarations
carry the rest: `body`, `#grid`, `.card`, and the action buttons.

So the shape is a **theme layer**: one stylesheet loaded after `style.css` that
overrides surfaces and leaves geometry alone. **The codebase already works this
way** — the LETHE cabinet reskin at ~line 5100 is exactly that pattern, just living
inside the big file instead of its own.

**`css/theme-felt.css` in this branch is a working proof.** It is ~200 lines, is not
loaded by `index.html` (nothing in the game changes until you add the `<link>`), and
it reskins the live gameplay screen: warm console plates, a felt table under the
board, card stock with real shadows, brass secondary buttons, a tamed clock.

Two honest caveats it surfaced:

1. **The felt needs a home.** `#grid` has 3px of padding around a full board, so its
   background only ever shows in the gutters. Widening that would need a JS change
   (`applyGridMetricsToDOM` sizes the board from it), so the theme puts the table on
   **`#grid-slot`** instead — the column the board is centred in, already
   `position: relative`, already the right size. No JS, no measurement.
2. **~623 hex literals sit outside the token system**, mostly in particles, entity
   tiles and FX. A theme layer reaches the *surfaces* on day one; accents get swept
   afterwards file by file. That sweep is worth doing regardless — see §2.

### Suggested order

1. **One `:root` token block**, and resolve the four colliding names. Prerequisite
   for everything else.
2. **Borders to ≥3:1.** Single cheapest change that makes panels read as grouped.
3. **Pick a direction; ship the theme layer.** Surfaces only.
4. **Rarity ladder onto lightness** (monotonic, survives greyscale and CVD).
5. **Fix the CRT** per §4, outside `#cabinet`.
6. **Collapse 47 font sizes to 8**; drop to three typefaces.
7. Sweep the hex literals into tokens, file by file.

### One unrelated thing worth doing
The game loads its fonts from the Google Fonts CDN at runtime. If that fails —
offline, blocked, or inside an itch.io sandbox iframe — the entire type system falls
back silently. `assets/fonts/` in this branch has all five families self-hosted
(700KB, already wired for `look-preview.html`). Pointing `style.css`'s `@import` at
them is a one-line change and removes a hard external dependency.

---

## 8. What would help most from you

- **Pick a direction** (or say what to cross-breed — B's chassis with A's felt table
  is a real option).
- **Reference images** of anything you've seen that felt right. Specific beats
  descriptive.
- **The office photo is the strongest art asset in the build.** More art in that
  register — a boss portrait, a Trick illustration set, a shop backdrop — would lift
  whichever direction wins more than any amount of CSS.
- **A call on how far grit goes**, and whether it's fixed or progresses over a run.
