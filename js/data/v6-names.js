// ══════════════════════════════════════════════
// V6 NAMES (r635, owner) - content, no logic
// ══════════════════════════════════════════════
// Some entities take a new name at their last improvement (tier 5, printed v6).
// id -> the v6 name. applyEntityTiers (js/improve.js) writes it onto the pool
// entity while the tier is 5 and puts the base name back otherwise;
// syncOwnedEntityDescs copies it onto the owned copies. Ids stay frozen.
// V6_NAMES.xlsx at the repo root holds suggestions for the rest.
const V6_NAMES = {
  pair_pips:      'Metashock',             // Aftershock (Trick)
  alignment:      'Perfect Alignment',     // Knack
  bellhop:        'Bell Captain',          // Sleight
  muscle_memory:  'Friends with Benefits', // Buddy System (Knack)
  capacitor:      'Supercapacitor',        // Sleight
  overgrowth:     'Cataract',              // Cascade (Trick)
  coin_toss:      'Weighted Coin',         // Knack
  carry_discards: 'Hoarder',               // Collector (Knack); the old Hoarder knack is Spoiled
  four_by_four:   '4x4 Queen',             // Knack
};
