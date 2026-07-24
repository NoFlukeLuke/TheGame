const HAND_FORMULAS = {
  'Run of 3':        'Base 20 pips × 3 mult',
  'Three of a Kind': 'Base 30 pips × 3 mult',
  'Four of a Kind':  'Base 60 pips × 7 mult',
  'Run of 4':        'Base 28 pips × 4 mult',
  'Pair':            'Base 20 pips × 2 mult',
  'Two Pair':        'Base 20 pips × 2 mult',
  'Straight':        'Base 30 pips × 4 mult',
  'Flush':           'Base 35 pips × 4 mult',
  'Full House':      'Base 40 pips × 4 mult',
  'Straight Flush':  'Base 100 pips × 8 mult',
  'High Card':       'Base 5 pips × 1 mult',
  'Blackjack':       'Base 21 pips × 4 mult',
};

const HAND_KEY_TO_NAME = {
  run3:'Run of 3', threeofakind:'Three of a Kind',
  fourofakind:'Four of a Kind', run4:'Run of 4', pair:'Pair', twopair:'Two Pair',
  straight:'Straight', flush:'Flush', fullhouse:'Full House',
  straightflush:'Straight Flush', highcard:'High Card', blackjack:'Blackjack',
};

function showStats() {
  const el = document.getElementById('stats-content');

  // Section 1: Active hands
  const activeRows = [...activeHands].map(k => {
    const name = HAND_KEY_TO_NAME[k] || k;
    const count = C[k] || 0;
    const formula = HAND_FORMULAS[name] || '';
    return `<div class="stat-row unlocked">
      <span class="stat-name">✓ ${name}</span>
      <span class="stat-val active">${count}x <span style="color:var(--cream-dim);font-weight:400;font-size:10px">${formula}</span></span>
    </div>`;
  }).join('');

  // Section 2: Unlock progress
  const unlockRows = UNLOCK_PROGRESS.filter(u => !unlockedHands.has(u.key)).map(u => {
    const pathStrs = u.paths.map(p => {
      const cur = typeof p.cur === 'function' ? p.cur() : p.cur;
      const pct = Math.min(Math.round((cur / p.goal) * 100), 100);
      return `<span class="stat-progress">${p.label}: ${cur}/${p.goal} (${pct}%)</span>`;
    }).join(' &nbsp;|&nbsp; ');
    return `<div class="stat-row locked">
      <span class="stat-name">⬡ ${u.name}</span>
      <span class="stat-val">${pathStrs}</span>
    </div>`;
  }).join('');

  // Section 3: General counters
  const generalRows = [
    { label:'Hands played', val: handsPlayed },
    { label:'Level', val: level },
    { label:'Round goal', val: roundGoal.toLocaleString() },
    { label:'Tricks held', val: acquiredTricks.length },
    { label:'Aces played', val: C.aces },
    { label:'Hearts played', val: C.hearts },
    { label:'Faces played', val: C.faces },
    { label:'Same-suit hands', val: C.sameSuitHands },
    { label:'Flow 3s', val: C.flow3 },
    { label:'Flow 4s', val: C.flow4 },
  ].map(r => `<div class="stat-row"><span class="stat-name">${r.label}</span><span class="stat-val">${r.val}</span></div>`).join('');

  el.innerHTML = `
    <div class="stats-section" style="flex:2;min-width:300px">
      <span class="stats-section-title">Active Hands</span>
      ${activeRows || '<span style="font-size:11px;color:var(--cream-dim)">None</span>'}
    </div>
    <div class="stats-section" style="flex:3;min-width:320px">
      <span class="stats-section-title">Unlock Progress</span>
      ${unlockRows || '<span style="font-size:11px;color:var(--cream-dim)">All hands unlocked!</span>'}
    </div>
    <div class="stats-section" style="flex:1;min-width:180px">
      <span class="stats-section-title">Counters</span>
      ${generalRows}
    </div>
  `;
  document.getElementById('stats-overlay').classList.add('show');
}

// ══════════════════════════════════════════════
// DECK OVERLAY
// ══════════════════════════════════════════════
