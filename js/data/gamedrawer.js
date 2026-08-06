// ══════════════════════════════════════════════
// GAME DRAWER — piece catalog (DATA ONLY, no logic)
// ══════════════════════════════════════════════
// "Game Drawer" mode plays like Classic (3-Act) but the pool of *potential
// pieces* is much wider than a plain deck: it's the junk drawer of every board
// game in the closet — Uno cards, dice, Monopoly money, chess & checker pieces,
// dominoes, Catan resources, Ticket to Ride trains, and a big pile of other
// classic components.
//
// IMPORTANT (r122): none of these DO anything yet. This file is the *catalog* —
// each entry defines what a piece IS (name / icon / where it's from / a rough
// category) with `effect: null` as a placeholder. We'll design and wire the
// per-piece effects one at a time, owner-directed, from here. Until then the
// mode is a straight clone of Classic so it's fully playable while we build.
//
// Categories are a loose grouping to help us reason about effects later:
//   token   — a physical mover/marker (pawn, race car, army, meeple)
//   card    — a card-shaped piece (Uno, property, TCG, tarot)
//   dice    — anything rolled
//   tile    — flat placed pieces (domino, Scrabble, mahjong, Azul)
//   resource— tradeable goods / currency (money, Catan bricks, gems)
//   figure  — a sculpted miniature/character (D&D mini, Munchkin monster, Clue)
//   marker  — small counters/discs/pegs (checker, Go stone, poker chip, cube)

const GAME_DRAWER_PIECES = [
  // ── Cards from other games ──────────────────────────────
  { id: 'uno_card',        name: 'Uno Card',          emoji: '🟥', game: 'Uno',              category: 'card',     effect: null },
  { id: 'uno_reverse',     name: 'Reverse Card',      emoji: '🔄', game: 'Uno',              category: 'card',     effect: null },
  { id: 'uno_wild',        name: 'Wild Card',         emoji: '🌈', game: 'Uno',              category: 'card',     effect: null },
  { id: 'phase10_card',    name: 'Phase 10 Card',     emoji: '🔟', game: 'Phase 10',         category: 'card',     effect: null },
  { id: 'property_card',   name: 'Property Deed',     emoji: '🏠', game: 'Monopoly',         category: 'card',     effect: null },
  { id: 'chance_card',     name: 'Chance Card',       emoji: '❓', game: 'Monopoly',         category: 'card',     effect: null },
  { id: 'tcg_card',        name: 'Trading Card',      emoji: '🃏', game: 'Magic / Pokémon',  category: 'card',     effect: null },
  { id: 'tarot_card',      name: 'Tarot Card',        emoji: '🔮', game: 'Tarot',            category: 'card',     effect: null },
  { id: 'clue_card',       name: 'Clue Card',         emoji: '🕵️', game: 'Clue',             category: 'card',     effect: null },

  // ── Dice ────────────────────────────────────────────────
  { id: 'd6',              name: 'Six-Sided Die',     emoji: '🎲', game: 'Classic',          category: 'dice',     effect: null },
  { id: 'd20',             name: 'D20',               emoji: '🎲', game: 'D&D',              category: 'dice',     effect: null },
  { id: 'yahtzee_dice',    name: 'Yahtzee Dice',      emoji: '🎲', game: 'Yahtzee',          category: 'dice',     effect: null },
  { id: 'popomatic',       name: 'Pop-o-Matic Die',   emoji: '🫧', game: 'Trouble',          category: 'dice',     effect: null },

  // ── Money / resources ───────────────────────────────────
  { id: 'money',           name: 'Monopoly Money',    emoji: '💵', game: 'Monopoly',         category: 'resource', effect: null },
  { id: 'catan_brick',     name: 'Brick',             emoji: '🧱', game: 'Catan',            category: 'resource', effect: null },
  { id: 'catan_wood',      name: 'Lumber',            emoji: '🪵', game: 'Catan',            category: 'resource', effect: null },
  { id: 'catan_sheep',     name: 'Wool',              emoji: '🐑', game: 'Catan',            category: 'resource', effect: null },
  { id: 'catan_wheat',     name: 'Grain',             emoji: '🌾', game: 'Catan',            category: 'resource', effect: null },
  { id: 'catan_ore',       name: 'Ore',               emoji: '⛏️', game: 'Catan',            category: 'resource', effect: null },
  { id: 'splendor_gem',    name: 'Gem Token',         emoji: '💎', game: 'Splendor',         category: 'resource', effect: null },

  // ── Tokens / movers ─────────────────────────────────────
  { id: 'race_car',        name: 'Race Car',          emoji: '🏎️', game: 'Monopoly',         category: 'token',    effect: null },
  { id: 'top_hat',         name: 'Top Hat',           emoji: '🎩', game: 'Monopoly',         category: 'token',    effect: null },
  { id: 'thimble',         name: 'Thimble',           emoji: '🧵', game: 'Monopoly',         category: 'token',    effect: null },
  { id: 'train',           name: 'Train',             emoji: '🚂', game: 'Ticket to Ride',   category: 'token',    effect: null },
  { id: 'meeple',          name: 'Meeple',            emoji: '🧍', game: 'Carcassonne',      category: 'token',    effect: null },
  { id: 'life_car',        name: 'Life Car',          emoji: '🚗', game: 'The Game of Life', category: 'token',    effect: null },
  { id: 'sorry_pawn',      name: 'Pawn',              emoji: '📍', game: 'Sorry! / Trouble', category: 'token',    effect: null },

  // ── Markers / small counters ────────────────────────────
  { id: 'checker',         name: 'Checker',           emoji: '🔴', game: 'Checkers',         category: 'marker',   effect: null },
  { id: 'connect4',        name: 'Connect Four Disc', emoji: '🟡', game: 'Connect Four',     category: 'marker',   effect: null },
  { id: 'poker_chip',      name: 'Poker Chip',        emoji: '🪙', game: 'Poker',            category: 'marker',   effect: null },
  { id: 'go_stone',        name: 'Go Stone',          emoji: '⚫', game: 'Go / Othello',     category: 'marker',   effect: null },
  { id: 'mancala_seed',    name: 'Mancala Seed',      emoji: '🫘', game: 'Mancala',          category: 'marker',   effect: null },
  { id: 'battleship_peg',  name: 'Hit Peg',           emoji: '📌', game: 'Battleship',       category: 'marker',   effect: null },
  { id: 'cribbage_peg',    name: 'Cribbage Peg',      emoji: '🩸', game: 'Cribbage',         category: 'marker',   effect: null },
  { id: 'disease_cube',    name: 'Disease Cube',      emoji: '🟩', game: 'Pandemic',         category: 'marker',   effect: null },
  { id: 'hippo_marble',    name: 'Marble',            emoji: '⚪', game: 'Hungry Hungry Hippos', category: 'marker', effect: null },

  // ── Tiles ───────────────────────────────────────────────
  { id: 'domino',          name: 'Domino',            emoji: '🁫', game: 'Dominoes',         category: 'tile',     effect: null },
  { id: 'scrabble_tile',   name: 'Letter Tile',       emoji: '🔠', game: 'Scrabble',         category: 'tile',     effect: null },
  { id: 'mahjong_tile',    name: 'Mahjong Tile',      emoji: '🀄', game: 'Mahjong',          category: 'tile',     effect: null },
  { id: 'rummikub_tile',   name: 'Number Tile',       emoji: '🔢', game: 'Rummikub',         category: 'tile',     effect: null },
  { id: 'azul_tile',       name: 'Azul Tile',         emoji: '🟦', game: 'Azul',             category: 'tile',     effect: null },
  { id: 'catan_road',      name: 'Road Tile',         emoji: '🛣️', game: 'Catan',            category: 'tile',     effect: null },

  // ── Figures / characters ────────────────────────────────
  { id: 'dnd_mini',        name: 'D&D Mini',          emoji: '🧙', game: 'D&D',              category: 'figure',   effect: null },
  { id: 'munchkin_monster',name: 'Munchkin Monster',  emoji: '👹', game: 'Munchkin',         category: 'figure',   effect: null },
  { id: 'clue_wrench',     name: 'The Wrench',        emoji: '🔧', game: 'Clue',             category: 'figure',   effect: null },
  { id: 'clue_candlestick',name: 'Candlestick',       emoji: '🕯️', game: 'Clue',             category: 'figure',   effect: null },
  { id: 'risk_army',       name: 'Army',              emoji: '🪖', game: 'Risk',             category: 'figure',   effect: null },
  { id: 'stratego_piece',  name: 'Stratego Piece',    emoji: '🎖️', game: 'Stratego',         category: 'figure',   effect: null },
  { id: 'guess_who',       name: 'Guess Who? Face',   emoji: '🙂', game: 'Guess Who?',       category: 'figure',   effect: null },

  // ── Chess ───────────────────────────────────────────────
  { id: 'chess_pawn',      name: 'Pawn',              emoji: '♟️', game: 'Chess',            category: 'figure',   effect: null },
  { id: 'chess_knight',    name: 'Knight',            emoji: '♞', game: 'Chess',            category: 'figure',   effect: null },
  { id: 'chess_rook',      name: 'Rook',              emoji: '♜', game: 'Chess',            category: 'figure',   effect: null },
  { id: 'chess_bishop',    name: 'Bishop',            emoji: '♝', game: 'Chess',            category: 'figure',   effect: null },
  { id: 'chess_queen',     name: 'Queen',             emoji: '♛', game: 'Chess',            category: 'figure',   effect: null },
  { id: 'chess_king',      name: 'King',              emoji: '♚', game: 'Chess',            category: 'figure',   effect: null },

  // ── Odds & ends / contraptions ──────────────────────────
  { id: 'jenga_block',     name: 'Jenga Block',       emoji: '🟫', game: 'Jenga',            category: 'tile',     effect: null },
  { id: 'twister_spinner', name: 'Twister Spinner',   emoji: '🎡', game: 'Twister',          category: 'misc',     effect: null },
  { id: 'operation_bone',  name: 'Funny Bone',        emoji: '🦴', game: 'Operation',        category: 'misc',     effect: null },
  { id: 'mousetrap_boot',  name: 'Mouse Trap Boot',   emoji: '🥾', game: 'Mouse Trap',       category: 'misc',     effect: null },
  { id: 'wingspan_egg',    name: 'Bird Egg',          emoji: '🥚', game: 'Wingspan',         category: 'resource', effect: null },
  { id: 'trivial_wedge',   name: 'Pie Wedge',         emoji: '🥧', game: 'Trivial Pursuit',  category: 'marker',   effect: null },
  { id: 'doubling_cube',   name: 'Doubling Cube',     emoji: '🎯', game: 'Backgammon',       category: 'dice',     effect: null },
];

// Quick lookup by id (for when effects start referencing pieces by id).
const GAME_DRAWER_BY_ID = Object.fromEntries(GAME_DRAWER_PIECES.map(p => [p.id, p]));

// True when the current game is the Game Drawer mode. Mirrors match3Active()'s
// shape so future wiring can gate cleanly on the mode.
function drawerMode() { return !!ACTIVE_MODE && ACTIVE_MODE.id === 'gamedrawer'; }
