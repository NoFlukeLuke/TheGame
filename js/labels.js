// ══════════════════════════════════════════════════════════════════════════
// LEXICON (r197 tiers, r198 the two-vocabulary toggle)
//
// The ONE place a code id becomes a word the player reads. See TERMINOLOGY.md.
//
// TWO VOCABULARIES, one switch (Settings -> Display -> Wording):
//   corporate - WORK / SKILL / OUTPUT / QUOTA, Utilities / Vendors / Certs,
//               Lite / Standard / Plus / Deluxe
//   gamer     - PIPS / MULT / SCORE / GOAL, Tricks / Sleights / Knacks,
//               Common / Rare / Epic / Legendary
//
// The rule that makes all of this cheap: CODE IDS ARE FROZEN. 'epic' stays
// 'epic' in the data pools forever - saves round-trip it and CSS classes are
// built from it. Only the strings in this file change.
//
// NEVER print an id. `tier.toUpperCase()` is how the old vocabulary ended up
// hard-coded across eight screens; every one of them now calls tierLabel().
//
// ENTITY NAMES ARE NOT IN HERE. "Cascade" is content, not vocabulary, and does
// not change with the toggle.
// ══════════════════════════════════════════════════════════════════════════

// Tier ids, low to high. `mythic` was merged into `legendary` in r197 and is no
// longer a valid tier - see TERMINOLOGY.md for the measurement behind that.
const TIER_IDS = ['common', 'rare', 'epic', 'legendary'];

// A tier id that is no longer valid maps onto the one that absorbed it, so an
// old save or a stale data entry still resolves instead of blanking the tile.
const TIER_ALIASES = { mythic: 'legendary' };

const LEXICONS = {
  corporate: {
    label: 'Corporate',
    // HUD labels and headings. Keys are the frozen concept ids.
    terms: {
      pips: 'WORK', mult: 'SKILL', focus: 'FOCUS',
      score: 'OUTPUT', goal: 'QUOTA', credits: 'CREDITS',
    },
    // Category words.
    entities: {
      trick:   { one: 'Utility', many: 'Utilities' },
      sleight: { one: 'Vendor',  many: 'Vendors'   },
      knack:   { one: 'Cert',    many: 'Certs'     },
      card:    { one: 'Doc',     many: 'Docs'      },
    },
    // Each entity type grades on its own ladder. They share the colour spine
    // (mint / cyan / purple / magenta) so the ordering is learned once.
    // Certs use two tiers deliberately - the knack pool is 24 common / 24 rare -
    // so epic and legendary fold onto the top word rather than inventing rungs.
    tiers: {
      trick:   { common:'Lite', rare:'Standard',   epic:'Plus',  legendary:'Deluxe'    },
      sleight: { common:'Trial', rare:'Contract', epic:'Retainer', legendary:'Partner' },
      knack:   { common:'Basic', rare:'Advanced',  epic:'Advanced', legendary:'Advanced' },
      _generic:{ common:'Lite', rare:'Standard',   epic:'Plus',  legendary:'Deluxe'    },
    },
    // Word swaps applied to stored prose at DISPLAY time - see lexProse().
    // Only NOUNS that are unambiguous. 'score' is deliberately absent: it is a
    // verb throughout the descriptions ("Runs score +10 pips per card"), and
    // swapping it gives "Runs output +10 work per card".
    prose: [['pips', 'work'], ['pip', 'work'], ['mult', 'skill']],
  },

  gamer: {
    label: 'Gamer',
    terms: {
      pips: 'PIPS', mult: 'MULT', focus: 'FOCUS',
      score: 'SCORE', goal: 'GOAL', credits: 'COINS',
    },
    entities: {
      trick:   { one: 'Trick',   many: 'Tricks'   },
      sleight: { one: 'Sleight', many: 'Sleights' },
      knack:   { one: 'Knack',   many: 'Knacks'   },
      card:    { one: 'Card',    many: 'Cards'    },
    },
    tiers: {
      trick:   { common:'Common', rare:'Rare', epic:'Epic', legendary:'Legendary' },
      sleight: { common:'Common', rare:'Rare', epic:'Epic', legendary:'Legendary' },
      knack:   { common:'Common', rare:'Rare', epic:'Rare', legendary:'Rare'      },
      _generic:{ common:'Common', rare:'Rare', epic:'Epic', legendary:'Legendary' },
    },
    // Stored prose IS the gamer vocabulary, so this side is the identity
    // transform and costs nothing. That is the whole reason descriptions need
    // no data edits and no second copy.
    prose: [],
  },
};

// ── which one is live ───────────────────────────────────────────────────────
// GAMER IS THE RESTING STATE, AND THAT IS A STORY DECISION, NOT A PREFERENCE.
// The Obliviscore already did its job: the work words were relabelled long
// before the run starts, and the corporate vocabulary is what COMES BACK as the
// machine fails. So corporate is no longer a default anything can fall back to -
// it is a state the game has to be moved INTO. See "The two vocabularies" in
// CLAUDE.md.
//
// Read through js/storage.js's shim, so a browser that throws on localStorage
// still gets a working default rather than aborting this file.
let activeLexicon = 'gamer';
try { const v = localStorage.getItem('lethe.lexicon'); if (LEXICONS[v]) activeLexicon = v; } catch (e) {}

function lexicon() { return LEXICONS[activeLexicon] || LEXICONS.gamer; }

function setLexicon(id) {
  if (!LEXICONS[id]) return activeLexicon;
  activeLexicon = id;
  try { localStorage.setItem('lethe.lexicon', id); } catch (e) {}
  applyLexiconToDOM();
  return activeLexicon;
}

// ── the lookups ─────────────────────────────────────────────────────────────
function tierId(raw) {
  const t = String(raw || '').toLowerCase();
  if (TIER_ALIASES[t]) return TIER_ALIASES[t];
  return TIER_IDS.includes(t) ? t : 'common';
}

// The word for a tier, e.g. tierLabel('trick','epic') -> 'Plus' | 'Epic'.
function tierLabel(type, raw) {
  const t = lexicon().tiers;
  return (t[type] || t._generic)[tierId(raw)];
}

// The single letter stamped on a tile corner. Derived from the LABEL, not from
// the id - 'common' would otherwise stamp C where the player reads "Lite".
function tierInitial(type, raw) { return tierLabel(type, raw).charAt(0).toUpperCase(); }

// The category word. entityLabel('sleight') -> 'Vendor'; plural -> 'Vendors'.
function entityLabel(type, plural) {
  const e = lexicon().entities[type];
  if (!e) return type;
  return plural ? e.many : e.one;
}

// A HUD label / heading, e.g. lexTerm('pips') -> 'WORK' | 'PIPS'.
function lexTerm(key) { return lexicon().terms[key] || String(key).toUpperCase(); }

// ── prose ───────────────────────────────────────────────────────────────────
// Descriptions are STORED in the gamer vocabulary and translated on the way to
// the screen. That is what lets 300-odd mentions of "pips" and "mult" follow the
// toggle with no data edits, no second copy of every description, and no risk of
// the two drifting apart.
const _LEX_PROSE_CACHE = {};
function _lexProseRules() {
  const id = activeLexicon;
  if (_LEX_PROSE_CACHE[id]) return _LEX_PROSE_CACHE[id];
  // Longest first, so 'pips' is consumed before 'pip' can match its stem.
  const rules = lexicon().prose.slice().sort((a, b) => b[0].length - a[0].length)
    .map(([from, to]) => [new RegExp('(?<![\\w-])' + from + '(?![\\w-])', 'gi'), to]);
  return (_LEX_PROSE_CACHE[id] = rules);
}

// Match the case of what was written: PIPS -> WORK, Pips -> Work, pips -> work.
function _matchCase(src, out) {
  if (src === src.toUpperCase() && src !== src.toLowerCase()) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

function lexProse(text) {
  if (text == null) return '';
  let s = String(text);
  for (const [re, to] of _lexProseRules()) s = s.replace(re, m => _matchCase(m, to));
  return s;
}

// A label that may be a plain string OR a function of the live vocabulary.
// Section/tab tables hold a mix - 'EVENTS' never changes, 'TRICKS' does - so
// every consumer resolves through here rather than testing the type inline.
function resolveLabel(v) { return typeof v === 'function' ? v() : v; }

// ── static labels in index.html ─────────────────────────────────────────────
// Anything marked `data-lex="pips"` has its text rewritten on load and whenever
// the toggle flips, so the HUD chips need no per-site update code.
function applyLexiconToDOM() {
  document.querySelectorAll('[data-lex]').forEach(el => {
    el.textContent = lexTerm(el.getAttribute('data-lex'));
  });
  document.querySelectorAll('[data-lex-entity]').forEach(el => {
    const [type, n] = el.getAttribute('data-lex-entity').split(':');
    el.textContent = entityLabel(type, n === 'many').toUpperCase();
  });
  if (typeof renderTrickTray === 'function' && document.getElementById('trick-tray-list')) {
    try { renderTrickTray(); } catch (e) {}
  }
}
