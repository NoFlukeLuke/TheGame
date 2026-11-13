// ══════════════════════════════════════════════════════════════════════════
// LORE (r706, owner) - content, no logic. js/events-meta.js reads it.
//
// The lore event types a single `?`. The player enters one word; the answer is
// LORE_ANSWERS[word] (lower case, trimmed), else LORE_FALLBACK. The owner will
// supply the real document: every answer below is a PLACEHOLDER to be replaced.
// A key may list several words that share an answer ('who|whom').
// ══════════════════════════════════════════════════════════════════════════
const LORE_ANSWERS = {
  'who|whom':  'PLACEHOLDER. The record of who is pending.',
  'what':      'PLACEHOLDER. The record of what is pending.',
  'where':     'PLACEHOLDER. The record of where is pending.',
  'when':      'PLACEHOLDER. The record of when is pending.',
  'why':       'PLACEHOLDER. The record of why is pending.',
  'how':       'PLACEHOLDER. The record of how is pending.',
};
const LORE_FALLBACK = 'NO RECORD.';

// The legendaries the lore event offers, one per scheduled visit, in this order.
// An id missing from the pool is skipped. After the last, the event is a 1% chance
// on any event and offers a legendary you do not hold.
const LORE_ORDER = [
  'old_growth', 'five_stack', 'club_double', 'knave_power', 'blackjack_bonus', 'richter',
  'relentless', 'obsessed', 'buried_treasure', 'phoenix', 'aces_absorb', 'monopoly',
];
