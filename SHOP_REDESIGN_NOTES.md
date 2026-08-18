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

---

## ⭐ LETHE Mart — chosen layout + build requirements (v3)

Chosen direction: **LETHE Mart** (`shop-preview-5-lethemart-v3.html` is the current
target). Layout = a real "section" (enter via a quick **channel-change** CRT flicker):
left **loadout** column · center **catalog** · right **checkout**.

**Consistency (confirmed):** the real build reuses the actual game CSS, so the shop,
regular play screen, and reward grid must all read as the same UI. The standalone
preview only approximates it. Keep all three visually consistent.

**Left loadout column — mirror the in-game left column:**
- Show the player's **owned** Knacks (diamonds) + Tricks (tray) so they never tab away.
- Owned **Sleights** live in the **hand-preview slot** (`#selected-cards` position).
- **Remove the score elements** (PIPS/MULT chips) here.
- Put the **settings chips** (Stats / Deck / Time / Pause) at the **bottom-left**.
- Match the game's panel framing exactly (Knacks = yellow top-border, Tricks = coral
  top-border, `--panel #14100b` / `--border #46381f`, `.panel-title` labels).

**Catalog (center):**
- **3 of 4** categories appear each visit (Tricks / Sleights / Knacks / Limits), with
  **Tricks featured** (slightly more prominent, up top).
- All purchasable items **left-aligned**, each section labeled with its **`used / N slots`**
  so growth room is visible.
- **Horizontal side-scroll** per section when items overflow the width (capacity can grow).
- **Spotlight** section ~**50% taller**, and must be able to hold **any entity type**
  (trick / sleight / knack) as the discounted feature.
- **Limit Upgrades** section and the **Tools** section below it (renamed from the
  "bonus row") both ~**60% taller**.
- **Limit tiles:** always show a **hover tooltip that includes the current limit value**
  (e.g. "Grid Rows · now 4 → 5 · max 7").

**Specials (two reserved slots):**
- **Spotlight / discount** (a single featured entity, e.g. 50% off).
- **Spin-the-wheel** — fixed price to spin; can land on any entity (probably not blessed
  cards); a **1-in-10 jackpot** outcome (TBD — owner to confirm what the jackpot is).

**Cart / buying:**
- **Drag items to the cart** (also click-to-add). Buy all at once.
- Discount **+5% per item**; a **knack** raises it to **+10% per item**; **cap = per-item%
  × Selection-Size limit**.
- **Freeze / lock** to keep items across rerolls — leaning **drag-to-a-freezer icon**
  (corner-pin per item is the alternative; owner will decide after seeing it live).
- **SFX:** dragging/adding a **Limit** to the cart plays a **satisfying glass-smash**.

**Stock logic (build correctness):**
- **Rarity must be percentage-chance per tier** (common/rare/epic/… roll odds), **not**
  uniform-by-pool-count. Sleights already do this (`pickSleightByRarity`); **apply the
  same weighted roll to Tricks and Knacks** (they currently `shuffle` the pool uniformly).
- **Allow duplicates** to appear for Tricks, Sleights, and Knacks (don't filter owned).
  Duplicates feed the **improve-on-duplicate** mechanic below.
- The **Tools** row offers context bonuses based on which categories showed
  (e.g. sleights → Recharge 1×3 / 3×1; tricks → Trick Tinker / rarity-upgrade sacrifice;
  knacks → trade a knack). More options per category still to be designed.

**New event (backlog):** a **shop-capacity event** — extend the shop by **+1 slot for
2 sections**, player chooses which two.

**Entity-improvement mechanic + sheet:**
- Buying a **duplicate** of a Trick improves its bonus (bigger bonus / looser use-case /
  other). Owner-editable sheet generated at **`ENTITY_IMPROVEMENTS.md`** (+ `.csv`) listing
  all 153 tricks, 36 knacks, 33 sleights with a blank **Improve Lv2 / Lv3** column to fill.
