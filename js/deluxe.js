// ── Deluxe Subscription (common knack) ──────────────────────────────────────
// A Trick or Sleight drawn for an offer (the pick, a reward grid, the shop, an
// event: every draw goes through pickEntityByRarity) has BAL.deluxe_subscription
// .chance to come one improvement up; with chance2 (the 5th improvement) each
// further improvement is rolled again. The tier rides in `deluxeOffers` (id ->
// tier, SAVE_VARS) so the tile draws it (entityShownTier) and taking the entity
// improves it to that tier (deluxeTake, from selectTrick / grantSleight).
let deluxeOffers = {};

function deluxeKind(id) {
  if (typeof TRICK_POOL_ALL !== 'undefined' && TRICK_POOL_ALL.some(x => x && x.id === id)) return 'trick';
  if (typeof SLEIGHT_POOL !== 'undefined' && SLEIGHT_POOL.some(x => x && x.id === id)) return 'sleight';
  return null;
}
// How many improvements an offer comes with: 0 without the knack.
function deluxeRoll(id) {
  if (!hasKnack('deluxe_subscription') || typeof canImprove !== 'function' || !canImprove(id)) return 0;
  const B = BAL.deluxe_subscription;
  if (Math.random() >= B.chance) return 0;
  let n = 1;
  while (B.chance2 > 0 && entityTierOf(id) + n < IMPROVE_MAX_TIER && Math.random() < B.chance2) n++;
  return n;
}
// Called on every entity draw. A fresh roll replaces the last one for that id.
function deluxeNote(x) {
  if (!x || !x.id || !deluxeKind(x.id)) return;
  const n = deluxeRoll(x.id);
  if (n > 0) deluxeOffers[x.id] = Math.min(IMPROVE_MAX_TIER, entityTierOf(x.id) + n);
  else delete deluxeOffers[x.id];
}
// The tier a tile draws: an offer's Deluxe tier, else the entity's own.
function entityShownTier(id) {
  const t = (typeof entityTierOf === 'function') ? entityTierOf(id) : 0;
  const d = deluxeOffers[id] || 0;
  if (d <= t) return t;
  if (typeof trickTray !== 'undefined' && trickTray.some(x => x && x.id === id)) return t;   // an owned Trick shows its own
  return d;
}
// Taking an entity: improve it to the tier its offer showed.
function deluxeTake(id) {
  const d = deluxeOffers[id];
  if (!d) return;
  delete deluxeOffers[id];
  while (entityTierOf(id) < d && canImprove(id)) { if (!improveEntity(id)) break; }
}
