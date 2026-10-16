// Which game-icons.net icon stands in for which emoji, and in what colour.
// Read by build.js. One row per glyph the game draws through emGlyph
// (js/entity-tile.js): Trick categories, Knacks, Sleights, reward tiles.
// `icon` is author/name in the game-icons checkout (a bare name takes the
// first author that has it). `color` is a key of PALETTE. `cut: true` takes the
// picture cut out of the ink (a stencil) instead of the ink.
//
// Every icon is CC BY 3.0 (https://game-icons.net). The build writes the
// author list to assets/icons/CREDITS.md; the handbook's Credits entry reads
// the same names.
const PALETTE = {
  gold:   '#e8c04a',
  orange: '#f08a2c',
  red:    '#e85a3c',
  pink:   '#ff6aa8',
  violet: '#b07cff',
  blue:   '#4aa8ff',
  cyan:   '#5cd6e8',
  green:  '#6fcf5a',
  cream:  '#f0e6c8',
  grey:   '#b8b8c4',
  brown:  '#c28a5a',
  white:  '#ffffff',
};

const ICONS = [
  // Trick categories (TRICK_CATEGORIES, js/data/tricks.js)
  { glyph: '🪜', icon: 'ladder',            color: 'brown'  },  // runs
  { glyph: '👯', icon: 'gemini',            color: 'pink'   },  // pairs / sets
  { glyph: '🎴', icon: 'poker-hand',       color: 'cream'  },  // flush / special hands
  { glyph: '👑', icon: 'jewel-crown',        color: 'gold'   },  // rank; The Queen; High and Mighty
  { glyph: '🌱', icon: 'sprout',            color: 'green'  },  // per-card pips; Growth Spurt
  { glyph: '⏱️', icon: 'lorc/stopwatch',    color: 'blue'   },  // timing; Clockmaker; Stopwatch; Time Clock
  { glyph: '⏱',  icon: 'lorc/stopwatch',    color: 'blue'   },  // reward tile
  { glyph: '🔥', icon: 'sbed/fire',         color: 'orange' },  // streaks; Combo Keeper
  { glyph: '🎨', icon: 'palette',           color: 'pink'   },  // suit conditions
  { glyph: '🔢', icon: 'abacus',            color: 'cyan'   },  // number magic; Head Count
  { glyph: '🌈', icon: 'rainbow-star',      color: 'violet' },  // rank diversity
  { glyph: '📍', icon: 'position-marker',   color: 'red'    },  // position
  { glyph: '📈', icon: 'profit',            color: 'green'  },  // level scaling; reward tile
  { glyph: '🧮', icon: 'gold-stack',             color: 'grey'   },  // accumulating
  { glyph: '🎲', icon: 'dice-six-faces-five', color: 'cream' }, // situational; reward tile
  { glyph: '🔀', icon: 'card-exchange',     color: 'cyan'   },  // diverse; Last Swap; Shift Swap
  { glyph: '🎯', icon: 'archery-target',          color: 'violet' },  // Focus; Lucky Seven
  { glyph: '⭐', icon: 'beveled-star',      color: 'gold'   },  // legendary misc
  { glyph: '★',  icon: 'beveled-star',      color: 'gold'   },  // reward tile
  { glyph: '💎', icon: 'cut-diamond',       color: 'cyan'   },  // multipliers
  // Knacks (js/data/knacks.js)
  { glyph: '🂠', icon: 'card-pickup',       color: 'cream'  },  // Card Counter
  { glyph: '📋', icon: 'checklist',         color: 'cream'  },  // Advance Notice; reward tile
  { glyph: '🛡️', icon: 'bordered-shield',   color: 'blue'   },  // Contingency Plan
  { glyph: '🕊️', icon: 'dove',              color: 'white'  },  // Free Swaps; reward tile
  { glyph: '🪶', icon: 'feather',           color: 'cream'  },  // Free Discards
  { glyph: '♾️', icon: 'infinity',          color: 'cyan'   },  // Steady Hand
  { glyph: '🗑️', icon: 'trash-can',         color: 'grey'   },  // Hoarder
  { glyph: '🗑',  icon: 'trash-can',         color: 'grey'   },  // reward tile
  { glyph: '⏳', icon: 'hourglass',         color: 'gold'   },  // Time Bank; Last Call; reward tile
  { glyph: '⌛', icon: 'hourglass',         color: 'gold'   },  // reward tile
  { glyph: '💰', icon: 'swap-bag',       color: 'gold'   },  // Inheritance; Cash Out; reward tile
  { glyph: '🤏', icon: 'lorc/hand',         color: 'cream'  },  // Short Change
  { glyph: '🛒', icon: 'shopping-cart',     color: 'cyan'   },  // Bulk Buyer
  { glyph: '🤝', icon: 'shaking-hands',     color: 'cream'  },  // Haggler; Buddy System
  { glyph: '🕰️', icon: 'pocket-watch',       color: 'brown'  },  // Time and a Half; Clock Tower
  { glyph: '🧾', icon: 'ticket',            color: 'cream'  },  // Gross Pay
  { glyph: '🎰', icon: 'slot-machine',      color: 'red'    },  // High Roller
  { glyph: '🔄', icon: 'clockwise-rotation', color: 'cyan'  },  // Swap Shop
  { glyph: '🌾', icon: 'wheat',             color: 'gold'   },  // Harvest
  { glyph: '🎒', icon: 'light-backpack',          color: 'brown'  },  // Pack Rat
  { glyph: '📦', icon: 'wooden-crate',     color: 'brown'  },  // Collector
  { glyph: '🪢', icon: 'knot',              color: 'cream'  },  // Safety Net
  { glyph: '🦅', icon: 'eagle-head',        color: 'brown'  },  // Free Range
  { glyph: '🎭', icon: 'drama-masks',       color: 'violet' },  // Understudy
  { glyph: '🔖', icon: 'medal',          color: 'red'    },  // Hallmark
  { glyph: '♻️', icon: 'recycle',           color: 'green'  },  // Turnover; Recycler
  { glyph: '🦉', icon: 'barn-owl',          color: 'brown'  },  // Long Pause
  { glyph: '🌇', icon: 'sundial',            color: 'orange' },  // Sundial
  { glyph: '🥁', icon: 'drum',              color: 'red'    },  // Metronome
  { glyph: '⏮️', icon: 'return-arrow',      color: 'blue'   },  // Time Slip
  { glyph: '🔂', icon: 'time-synchronization', color: 'blue' }, // Rewound Echo
  { glyph: '🔁', icon: 'anticlockwise-rotation', color: 'blue' }, // Deja Vu; Down and Back In; Echo
  { glyph: '🐛', icon: 'caterpillar',       color: 'green'  },  // Low and Behold
  { glyph: '✦',  icon: 'sparkles',          color: 'white'  },  // Curator; the mystery tile
  { glyph: '✨', icon: 'sparkles',          color: 'white'  },  // reward tile
  { glyph: '🃏', icon: 'card-joker',        color: 'cream'  },  // Short Suit; Dealer's Choice; reward tile
  { glyph: '🎩', icon: 'top-hat',           color: 'grey'   },  // Old Tricks; The Ringer
  { glyph: '👥', icon: 'three-friends',     color: 'cyan'   },  // Three's a Crowd; Entourage
  { glyph: '🧳', icon: 'suitcase',          color: 'brown'  },  // Tagalong
  { glyph: '🪙', icon: 'coinflip',         color: 'gold'   },  // Pip In; Coin Toss
  { glyph: '💊', icon: 'pill',              color: 'pink'   },  // Stimulants
  { glyph: '🤑', icon: 'take-my-money',     color: 'green'  },  // Greedy Boi
  { glyph: '🦴', icon: 'crossed-bones',     color: 'cream'  },  // Scavenger
  { glyph: '⚰️', icon: 'coffin',            color: 'grey'   },  // Martyr
  { glyph: '📐', icon: 'pencil-ruler',      color: 'cream'  },  // Surveyor
  { glyph: '📏', icon: 'stairs',            color: 'cream'  },  // Leveler
  { glyph: '🧲', icon: 'magnet',            color: 'red'    },  // Alignment; Magnet
  { glyph: '🏙️', icon: 'modern-city',       color: 'blue'   },  // District
  { glyph: '⏲️', icon: 'alarm-clock',       color: 'blue'   },  // Tempo
  { glyph: '🔧', icon: 'wrench',            color: 'grey'   },  // Jury-Rig
  { glyph: '🏦', icon: 'bank',              color: 'cream'  },  // Dividend
  { glyph: '⛵', icon: 'sailboat',          color: 'blue'   },  // Trade Winds
  { glyph: '🔗', icon: 'linked-rings',      color: 'grey'   },  // Knock-On
  { glyph: '🧨', icon: 'dynamite',          color: 'red'    },  // Long Fuse
  { glyph: '✍️', icon: 'quill-ink',         color: 'cream'  },  // Shorthand
  { glyph: '🧠', icon: 'brain',             color: 'pink'   },  // Core Memories
  // Sleights (js/data/sleights.js)
  { glyph: '🏭', icon: 'factory',           color: 'grey'   },  // Warehouse
  { glyph: '🗿', icon: 'stone-bust',        color: 'grey'   },  // Idol
  { glyph: '⏩', icon: 'fast-forward-button', color: 'cyan' },  // Shortcut
  { glyph: '⚔️', icon: 'crossed-swords',    color: 'grey'   },  // Fight the Power
  { glyph: '😵', icon: 'knocked-out-stars', color: 'gold'   },  // Fresh Start
  { glyph: '🔃', icon: 'cycle',             color: 'cyan'   },  // Pivot!
  { glyph: '🌿', icon: 'badges/leaf',       color: 'green'  },  // Naturalist
  { glyph: '🛎️', icon: 'ringing-bell',      color: 'gold'   },  // Bellhop
  { glyph: '🎼', icon: 'musical-score',     color: 'cream'  },  // Syncopation
  { glyph: '⏪', icon: 'backward-time',     color: 'blue'   },  // Rewind
  { glyph: '💣', icon: 'unlit-bomb',        color: 'grey'   },  // Bomb
  { glyph: '📜', icon: 'scroll-unfurled',   color: 'cream'  },  // Legacy
  { glyph: '⏬', icon: 'arrow-down',        color: 'blue'   },  // Sandbagger
  { glyph: '⬇️', icon: 'arrow-down',        color: 'red'    },  // reward tile
  { glyph: '⬆️', icon: 'arrow-up',          color: 'green'  },  // reward tile
  { glyph: '⚡', icon: 'power-lightning',   color: 'gold'   },  // Lightning Rod; reward tile
  { glyph: '🧪', icon: 'round-bottom-flask', color: 'green' },  // Catalyst
  { glyph: '🧭', icon: 'compass',           color: 'cream'  },  // Wanderer
  { glyph: '📢', icon: 'megaphone',         color: 'red'    },  // Amplifier
  { glyph: '😴', icon: 'night-sleep',       color: 'blue'   },  // Snooze Button
  { glyph: '🌳', icon: 'oak',               color: 'green'  },  // Shady Tree
  { glyph: '🐷', icon: 'piggy-bank',        color: 'pink'   },  // Piggy Bank
  { glyph: '🪞', icon: 'mirror-mirror',     color: 'cyan'   },  // Reflect; the Sleight fallback
  { glyph: '👁️', icon: 'eyeball',           color: 'violet' },  // Soul Mirror
  { glyph: '🤖', icon: 'vintage-robot',     color: 'grey'   },  // Autopilot
  { glyph: '🔪', icon: 'bowie-knife',       color: 'grey'   },  // Whetstone
  { glyph: '🗼', icon: 'lighthouse',        color: 'gold'   },  // Lighthouse
  { glyph: '🔋', icon: 'battery-75',        color: 'green'  },  // Capacitor; Power Cell
  { glyph: '🩸', icon: 'drop',              color: 'red'    },  // Siphon; reward tile
  { glyph: '🕯️', icon: 'candle-flame',      color: 'orange' },  // Slow Burn
  { glyph: '🎚️', icon: 'settings-knobs',    color: 'grey'   },  // Governor
  { glyph: '💵', icon: 'cash',              color: 'green'  },  // Petty Cash
  { glyph: '📌', icon: 'pin',               color: 'red'    },  // Keeper
  { glyph: '🔐', icon: 'padlock',           color: 'gold'   },  // Lockbox
  { glyph: '🧹', icon: 'broom',             color: 'brown'  },  // All Hands
  { glyph: '🖐️', icon: 'open-palm',         color: 'cream'  },  // Free Hand
  { glyph: '✌️', icon: 'high-five',         color: 'cream'  },  // Double Down
  // Reward tiles (js/reward-grid.js)
  { glyph: '☁',  icon: 'badges/cloud',      color: 'grey'   },
  { glyph: '☠',  icon: 'skull-crossed-bones', color: 'grey' },
  { glyph: '♛',  icon: 'chess-queen',       color: 'gold'   },
  { glyph: '⛔', icon: 'sbed/cancel',       color: 'red'    },
  { glyph: '🚫', icon: 'sbed/cancel',       color: 'red'    },
  { glyph: '✖',  icon: 'cross-mark',        color: 'red'    },
  { glyph: '❓', icon: 'uncertainty',       color: 'violet' },
  { glyph: '🍀', icon: 'lorc/clover',       color: 'green'  },
  { glyph: '🏪', icon: 'shop',              color: 'cyan'   },
  { glyph: '🐈‍⬛', icon: 'cat',        color: 'grey'   },
  { glyph: '🐌', icon: 'snail',             color: 'brown'  },
  { glyph: '🐒', icon: 'monkey',            color: 'brown'  },
  { glyph: '💔', icon: 'broken-heart',      color: 'red'    },
  { glyph: '💥', icon: 'spiky-explosion',   color: 'orange' },
  { glyph: '💸', icon: 'pay-money',         color: 'green'  },
  { glyph: '📉', icon: 'chart',             color: 'red'    },
  { glyph: '🔍', icon: 'magnifying-glass',  color: 'cyan'   },
  { glyph: '🕳', icon: 'hole',              color: 'grey'   },
  { glyph: '🧊', icon: 'lorc/ice-cube',     color: 'cyan'   },
  { glyph: '🪨', icon: 'lorc/rock',         color: 'grey'   },
];

module.exports = { PALETTE, ICONS };
