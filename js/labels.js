// ══════════════════════════════════════════════════════════════════════════
// LABELS (r197) - the ONE place a code id becomes a word the player reads.
//
// See TERMINOLOGY.md. The rule: code ids are frozen ('common', 'rare', 'epic',
// 'legendary', 'trick', 'sleight', 'knack'), and only the strings in this file
// change when the vocabulary changes. Saves, CSS classes and the data pools all
// key off the ids, so a rename that stays inside this file costs nothing.
//
// NEVER print an id. `tier.toUpperCase()` is how the old vocabulary ended up
// hard-coded across eight screens; every one of them now calls tierLabel().
// ══════════════════════════════════════════════════════════════════════════

// Tier ids, low to high. `mythic` was merged into `legendary` in r197 and is no
// longer a valid tier - see TERMINOLOGY.md for the measurement behind that.
const TIER_IDS = ['common', 'rare', 'epic', 'legendary'];

// Each entity type grades on its own ladder. They share the colour spine
// (mint / cyan / purple / magenta) so the ordering is learned once.
const TIER_LABELS = {
  trick:   { common:'Lite',   rare:'Standard',   epic:'Plus',  legendary:'Deluxe'    },
  sleight: { common:'Temp',   rare:'Contractor', epic:'Staff', legendary:'Executive' },
  // Certs use two tiers on purpose (the knack pool is 24 common / 24 rare).
  // The two words are still to be chosen; until then they show as-is.
  knack:   { common:'Common', rare:'Rare',       epic:'Rare',  legendary:'Rare'      },
};

// Fallback for anything without a ladder of its own (limits, resource tiles,
// reward-grid categories) - the generic ladder.
const TIER_LABELS_GENERIC = { common:'Common', rare:'Rare', epic:'Epic', legendary:'Elite' };

// Category words. Frozen id -> what the player calls it.
const ENTITY_LABELS = {
  trick:   { one:'Utility', many:'Utilities' },
  sleight: { one:'Hire',    many:'Hires'     },
  knack:   { one:'Cert',    many:'Certs'     },
  card:    { one:'File',    many:'Files'     },
};

// A tier id that is no longer valid maps onto the one that absorbed it, so an
// old save or a stale data entry still resolves instead of blanking the tile.
const TIER_ALIASES = { mythic:'legendary' };

function tierId(raw) {
  const t = String(raw || '').toLowerCase();
  if (TIER_ALIASES[t]) return TIER_ALIASES[t];
  return TIER_IDS.includes(t) ? t : 'common';
}

// The word for a tier, e.g. tierLabel('trick','epic') -> 'Plus'.
function tierLabel(type, raw) {
  const table = TIER_LABELS[type] || TIER_LABELS_GENERIC;
  return table[tierId(raw)] || TIER_LABELS_GENERIC[tierId(raw)];
}

// The single letter stamped on a tile corner. Derived from the LABEL, not from
// the id - 'common' would otherwise stamp C where the player reads "Lite".
function tierInitial(type, raw) { return tierLabel(type, raw).charAt(0).toUpperCase(); }

// The category word. entityLabel('sleight') -> 'Hire'; plural:true -> 'Hires'.
function entityLabel(type, plural) {
  const e = ENTITY_LABELS[type];
  if (!e) return type;
  return plural ? e.many : e.one;
}
