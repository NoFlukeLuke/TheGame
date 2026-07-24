const HAND_DEFS = {
  run4:        { name:'Run of 4',      key:'run4',        desc:'Four cards in sequence, orthogonally connected.' },
  pair:        { name:'Pair',          key:'pair',        desc:'Two cards of the same rank.' },
  twopair:     { name:'Two Pair',      key:'twopair',     desc:'Two different pairs in the same hand.' },
  straight:    { name:'Straight',      key:'straight',    desc:'Five cards in sequence.' },
  flush:       { name:'Flush',         key:'flush',       desc:'Five cards of the same suit.' },
  fullhouse:   { name:'Full House',    key:'fullhouse',   desc:'Three of a kind plus a pair.' },
  straightflush:{ name:'Straight Flush',key:'straightflush',desc:'Five cards in sequence, all the same suit.' },
  blackjack:   { name:'Blackjack',     key:'blackjack',   desc:'Any connected cards whose pip values total exactly 21.' },
};

// Relevant bonuses to offer per hand unlock
const UNLOCK_TRICK_POOL = {
  run4:         ['overgrowth','fertile_ground','early_bird'],
  pair:         ['kindred','trinity','double_bloom'],
  twopair:      ['pair_pips','two_pair_mult','kindred'],
  straight:     ['worn_path','long_road','river_run','correct_run'],
  flush:        ['enriched','tidal_force','deluge'],
  fullhouse:    ['hidden_triple','kindling','wildfire'],
  straightflush:['enriched','tidal_force','full_color','tide_table'],
  highcard:     ['rich_soil','first_light','face_value'],
  blackjack:    ['ninesong','lucky_sevens','first_play'],
};

function updateCounters(hand, handCells) {
  // Map hand name to counter key
  const handKeyMap = {
    'Run of 3': 'run3', 'Run of 4': 'run4',
    'Pair': 'pair', 'Two Pair': 'twopair', 'Three of a Kind': 'threeofakind',
    'Four of a Kind': 'fourofakind', 'Straight': 'straight', 'Flush': 'flush',
    'Full House': 'fullhouse', 'Straight Flush': 'straightflush',
    'Blackjack': 'blackjack',
  };
  const handKey = handKeyMap[hand];
  if (handKey && C[handKey] !== undefined) C[handKey]++;

  const cards = handCells.map(([r,c]) => gridData[r][c]);
  const suits = cards.map(c => c.suit);
  const allSameSuit = new Set(suits).size === 1;
  if (allSameSuit && hand === 'Run of 3') C.flow3++;
  if (allSameSuit && hand === 'Run of 4') C.flow4++;

  // Same-suit hands (for flush unlock)
  if (allSameSuit) C.sameSuitHands++;

  // Card value counters
  cards.forEach(card => {
    if (card.rank === 'A') C.aces++;
    if (card.rank === '2') C.twos++;
    if (card.rank === '4') C.fours++;
    if (['J','Q','K'].includes(card.rank)) C.faces++;
    if (card.suit === '♥') C.hearts++;
  });

  // Blackjack unlock: raw card pips (no bonuses) = 21
  const rawPips = handCells.reduce((sum, [r,c]) => sum + cardPips(gridData[r][c].rank), 0);
  if (rawPips === 21 && !unlockedHands.has('blackjack')) triggerUnlock('blackjack');

  // Goal in last second
  if (roundSeconds <= 1 && score >= roundGoal) C.goalInLastSecond = true;
}

function checkUnlocks() {
  if (ACTIVE_MODE.id === 'normal') return;
  const toCheck = [
    { key:'run4',         cond: () => C.run3 >= 10 || C.fours >= 20 },
    { key:'pair',         cond: () => C.twos >= 20 },
    { key:'twopair',      cond: () => C.pair >= 20 },
    { key:'straight',     cond: () => C.run4 >= 10 },
    { key:'flush',        cond: () => C.sameSuitHands >= 5 || C.hearts >= 100 },
    { key:'fullhouse',    cond: () => C.threeofakind >= 5 },
    { key:'straightflush',cond: () => (unlockedHands.has('straight') && unlockedHands.has('flush')) || C.flow3 >= 5 || C.flow4 >= 2 },
    { key:'highcard',     cond: () => C.aces >= 25 || C.goalInLastSecond },
    { key:'blackjack',    cond: () => (C.faces >= 20 && C.aces >= 20) },
  ];

  for (const { key, cond } of toCheck) {
    if (!unlockedHands.has(key) && cond()) {
      triggerUnlock(key);
      return; // one at a time
    }
  }
}

function triggerUnlock(key) {
  if (ACTIVE_MODE.id === 'normal') return;
  if (unlockedHands.has(key)) return;
  unlockedHands.add(key);
  handsPendingUnlock.push(key);
  if (handsPendingUnlock.length === 1) showUnlockScreen(key);
}

function showUnlockScreen(key) {
  // Pause round timer
  clearInterval(roundInterval);
  roundInterval = null;

  const def = HAND_DEFS[key];
  if (!def) { finishUnlock(); return; }

  document.getElementById('unlock-hand-name').textContent = def.name;
  document.getElementById('unlock-desc').textContent = def.desc;

  // Example cards
  const examples = {
    run4: [{r:'5',s:'♠'},{r:'6',s:'♥'},{r:'7',s:'♦'},{r:'8',s:'♣'}],
    pair: [{r:'K',s:'♠'},{r:'K',s:'♥'}],
    twopair: [{r:'A',s:'♠'},{r:'A',s:'♥'},{r:'7',s:'♦'},{r:'7',s:'♣'}],
    straight: [{r:'7',s:'♠'},{r:'8',s:'♥'},{r:'9',s:'♦'},{r:'10',s:'♣'},{r:'J',s:'♠'}],
    flush: [{r:'2',s:'♥'},{r:'6',s:'♥'},{r:'9',s:'♥'},{r:'J',s:'♥'},{r:'K',s:'♥'}],
    fullhouse: [{r:'Q',s:'♠'},{r:'Q',s:'♥'},{r:'Q',s:'♦'},{r:'4',s:'♣'},{r:'4',s:'♠'}],
    straightflush: [{r:'5',s:'♣'},{r:'6',s:'♣'},{r:'7',s:'♣'},{r:'8',s:'♣'},{r:'9',s:'♣'}],
    highcard: [{r:'A',s:'♠'}],
    blackjack: [{r:'A',s:'♠'},{r:'10',s:'♥'}],
  };
  const ex = examples[key] || [];
  const exEl = document.getElementById('unlock-example');
  exEl.innerHTML = ex.map(c =>
    `<div class="unlock-ex-card ${suitClass(c.s)}">${c.r}<div class="ex-suit">${c.s}</div></div>`
  ).join('');

  // Pick relevant bonuses
  const pool = (UNLOCK_TRICK_POOL[key] || [])
    .map(id => TRICK_POOL.find(b => b.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const optEl = document.getElementById('unlock-trick-options');
  optEl.innerHTML = '';
  pool.forEach(b => {
    const div = document.createElement('div');
    div.className = 'trick-option';
    div.innerHTML = `
      <div class="bo-tier ${b.tier}">${b.tier.toUpperCase()}</div>
      <div class="bo-border ${b.tier}"></div>
      <div class="bo-name">${b.name}</div>
      <div class="bo-desc">${withSuitHalo(b.desc)}</div>
    `;
    div.addEventListener('click', () => {
      acquiredTricks.push(b);
      updateTrickList();
      finishUnlock();
    });
    optEl.appendChild(div);
  });

  // If no bonuses available, show a continue button
  if (pool.length === 0) {
    optEl.innerHTML = `<button class="end-btn" onclick="finishUnlock()">Continue</button>`;
  }

  document.getElementById('unlock-overlay').classList.add('show');
}

function finishUnlock() {
  // Add the hand to active hands
  const key = handsPendingUnlock.shift();
  if (key) activeHands.add(key);

  document.getElementById('unlock-overlay').classList.remove('show');

  // If more unlocks queued, show next
  if (handsPendingUnlock.length > 0) {
    showUnlockScreen(handsPendingUnlock[0]);
    return;
  }

  // Resume round timer
  startRoundTimer();
}

// ══════════════════════════════════════════════
// STATS OVERLAY
// ══════════════════════════════════════════════
const UNLOCK_PROGRESS = [
  { key:'run4',         name:'Run of 4',      paths:[
    { label:'Runs of 3', cur:()=>C.run3, goal:10 },
    { label:'Fours played', cur:()=>C.fours, goal:20 },
  ]},
  { key:'pair',         name:'Pair',          paths:[
    { label:'Twos played', cur:()=>C.twos, goal:20 },
  ]},
  { key:'twopair',      name:'Two Pair',       paths:[
    { label:'Pairs played', cur:()=>C.pair, goal:20 },
  ]},
  { key:'straight',     name:'Straight',      paths:[
    { label:'Runs of 4', cur:()=>C.run4, goal:10 },
  ]},
  { key:'flush',        name:'Flush',         paths:[
    { label:'Same-suit hands', cur:()=>C.sameSuitHands, goal:5 },
    { label:'Hearts played', cur:()=>C.hearts, goal:100 },
  ]},
  { key:'fullhouse',    name:'Full House',    paths:[
    { label:'Three of a Kinds', cur:()=>C.threeofakind, goal:5 },
  ]},
  { key:'straightflush',name:'Straight Flush',paths:[
    { label:'Flow 3s', cur:()=>C.flow3, goal:5 },
    { label:'Flow 4s', cur:()=>C.flow4, goal:2 },
  ]},
  { key:'blackjack',    name:'Blackjack',     paths:[
    { label:'Raw pips = 21 (any hand)', cur:()=>'-', goal:1 },
    { label:'Face cards', cur:()=>C.faces, goal:20 },
    { label:'Aces', cur:()=>C.aces, goal:20 },
  ]},
];

