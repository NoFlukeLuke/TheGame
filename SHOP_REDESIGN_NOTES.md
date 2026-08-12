# Shop Redesign — Direction & Notes

Living notes for the shop / entity-visual redesign on branch
`claude/shop-redesign-aesthetic-1hptyx`. **Design decisions captured here are not
yet implemented** unless a build number is noted. Owner is non-technical — keep
explanations plain.

---

## ⭐ Current direction (owner call, latest)

### 1. The shop should go BACK OFF the grid
- The on-grid shop (r126, behind `USE_ONGRID_SHOP` in `js/shop-grid-preview.js`)
  proved the look/feel, **but the owner wants to move the shop off the grid again.**
- **Reason:** the owner wants to add *more options* to the shop, and the fixed
  4×4 grid spacing is a hard limit on how much can fit. A non-grid layout (a
  proper shop screen/panel) can hold more shelves/rows/services and grow over time.
- **So:** the next shop pass is a **non-grid shop** that still uses the LETHE
  CRT/neon aesthetic, but with room to expand (more items, services, the deferred
  features below).
- Keep the connected-buy discount idea in mind — decide whether it still fits a
  non-grid layout, or gets replaced by another mechanic, when we build it.
- The on-grid shop code can stay behind the flag for now (fallback / reference);
  flipping `USE_ONGRID_SHOP = false` restores the overlay shop.

### 2. Entity visuals need to be differentiated by TYPE (not just rarity)
Right now Tricks, Sleights, Knacks, and Limits all render with the same base
treatment (neon rarity border + near-black CRT background), only differing by the
small glyph/tab/diamond. They read as too similar. Target look:

- **Limits (upgrades):** should **NOT look like cards at all.** They're permanent
  stat upgrades, not collectibles — give them a distinct, non-card treatment
  (e.g. a badge / plaque / meter / chip form — TBD), clearly set apart from the
  card-like entities.
- **Tricks:** need **something more unique** to make them instantly recognizable
  as Tricks (their exact distinguishing treatment is TBD — brainstorm options).
- **Sleights:** should **look more like actual playing cards** (they *are* physical
  deck cards). Specifically:
  - **Thinner** rarity border (not the current thick neon border).
  - A **card-colored background** (light/playing-card colored, tinted by the card
    it represents / its suit color) — **NOT** the rarity-border + black background
    the other entities use.
  - Net effect: a Sleight tile should read as "a playing card with a rarity edge,"
    while Tricks/Knacks/Limits read as their own distinct thing.

> These entity-visual rules apply wherever entities are rendered (shop, reward
> grid, tray, etc.) — but the immediate driver is the new off-grid shop. Whether
> to also change the reward-grid entity tiles is TBD (keep them consistent unless
> there's a reason not to).

---

## Backlog / deferred (captured earlier, still wanted)

Shop feature ideas the owner has greenlit but that aren't built yet:

- **Wheel-of-fortune spin tile:** pay a fixed price to spin a wheel that can land
  on anything — tricks, limits, knacks, sleights (probably **not** blessed cards).
  There's also a ~1/10 special outcome (owner note was cut off — confirm what the
  1/10 does).
- **Pin Head (trick):** grants **+8 mult for each pinned item in the shop.** Pairs
  with the pin mechanic below.
- **Pin / lock mechanic:** a **watermark pin in the corner** of a shop item to keep
  it across rerolls.
- **Discount knack:** gives **50% off 50% of the shop items** (half the stock is
  half price).
- **Rotating "spotlight" tile:** one slot that changes each visit — sometimes the
  wheel, sometimes services, sometimes 2–3 other things.
- **Rotating spotlight** idea supersedes the earlier standalone "featured deal"
  (idea #3) and "sale tags" (idea #7) — fold those in.

### Already shipped (for reference)
- **Sell-back** (r126): Knacks 30% of price · Tricks 60% (floored) · Sleights
  0.75 × price × (charges left ÷ max). Will carry into the off-grid shop.
- **Shop CRT/neon reskin** (r113), **reward-grid guarantees** (always a Limit
  Break; first 5 grids guarantee row/col + selection + swap/discard upgrades, r114).
- **Per-screen background tint** (r125): play = near-black, Rewards = teal, boss
  reward = red, challenge = purple, shop = gold.
- **Live time popup** (r125): interaction costs incl. debuffs, max time, pauses,
  rewounds. **Play-cost debuff re-enabled** (normal play still free).
- **Shared "you are here" HUD** (r126): location readout replaces the pips/mult
  chips (**Rewards** / **Shop**); cost/discount readout replaces the hand preview.
  Reward grid renamed **Rewards**.
- **Tooltip flip** (r126): entity tooltips anchor to the tile and open on the
  roomier side.

## Still deferred (non-shop)
- **Events rendered inside the grid bounds** (each event currently draws in
  `#event-overlay` — a per-event rework).
- Full **boss-red / challenge-purple** background wiring beyond the current scaffold.
