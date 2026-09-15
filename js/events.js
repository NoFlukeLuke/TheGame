function confluencePoolForTheme(theme) {
  const ownedTrick     = new Set((acquiredTricks  || []).map(b => b.id));
  const ownedKnacks = new Set((acquiredKnacks   || []).map(t => t.id));
  const ownedSleights = grantedSleightIds;
  const items = [];
  TRICK_POOL.filter(b => !ownedTrick.has(b.id) && b.tags?.some(t => theme.trickTags.includes(t)))
    .forEach(b => items.push({ type:'trick', icon:'★', name:b.name, desc:b.desc, rarity:b.tier, payload:b }));
  theme.knackIds.forEach(id => {
    const t = KNACK_POOL.find(t => t.id === id);
    if (t && !ownedKnacks.has(t.id))
      items.push({ type:'knack', icon:t.emoji, name:t.name, desc:t.desc, rarity:'legendary', payload:t });
  });
  SLEIGHT_POOL.filter(j => !ownedSleights.has(j.id) && sleightOfferable(j) && j.tags?.some(t => theme.sleightTags.includes(t)))
    .forEach(j => items.push({ type:'sleight', icon:j.emoji, name:j.name, desc:j.desc, rarity:j.rarity, payload:j }));
  // shuffle and cap at 3
  const a = [...items]; for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a.slice(0, 3);
}

function renderConfluence() {
  eventState.phase = 'theme';
  eventState.selectedTheme = null;
  eventState.selectedItem  = null;
  // Pick 3 random themes
  const themes = [...CONFLUENCE_THEMES]; for (let i=themes.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [themes[i],themes[j]]=[themes[j],themes[i]]; }
  eventState.themes = themes.slice(0, 3);
  const body = document.getElementById('event-body');
  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'PICK A THEME';
  body.appendChild(lbl);
  const row = document.createElement('div');
  row.className = 'event-theme-row';
  eventState.themes.forEach((theme, i) => {
    const btn = document.createElement('div');
    btn.className = 'event-theme-btn';
    btn.innerHTML = `<div class="etb-icon">${theme.icon}</div><div class="etb-name">${theme.name}</div>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.event-theme-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      eventState.selectedTheme = theme;
      showConfluenceItems(theme);
    });
    row.appendChild(btn);
  });
  body.appendChild(row);
  eventState.itemsContainer = document.createElement('div');
  eventState.itemsContainer.className = 'ev-stack';
  body.appendChild(eventState.itemsContainer);
}

function showConfluenceItems(theme) {
  const pool = confluencePoolForTheme(theme);
  eventState.items = pool;
  eventState.selectedItem = null;
  setEventConfirm(false);
  const c = eventState.itemsContainer;
  c.innerHTML = '';
  if (pool.length === 0) {
    c.innerHTML = evEmptyHTML('Nothing left in this theme. Try another.');
    setEventConfirm(true); // allow skip
    return;
  }
  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'PICK ONE';
  c.appendChild(lbl);
  pool.forEach(item => {
    const el = makeChoiceEl({ icon:item.icon, rarity:item.rarity, name:item.name, desc:item.desc,
      tile: evItemTile(item),
      onClick: () => {
        c.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.selectedItem = item;
        setEventConfirm(true);
      }
    });
    c.appendChild(el);
  });
}

function confirmConfluence() {
  const item = eventState.selectedItem;
  if (!item) { closeEvent(); return; }
  if (item.type === 'trick') {
    injectTrickAfterReward(item.payload);
  } else if (item.type === 'knack') {
    acquiredKnacks.push({ ...item.payload });
    updateKnackList?.();
    showMessage(`+ ${item.name}`, 'var(--gold)');
  } else if (item.type === 'sleight') {
    grantSleight(item.payload);
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: CROSSROADS
// ══════════════════════════════════════════════
function buildCrossroadsTrades() {
  const trades = [];
  // Trade 1: always available - pay coins for a legendary Trick
  if (coins >= 12) {
    const ownedTrick = new Set((acquiredTricks||[]).map(b=>b.id));
    const legends = TRICK_POOL.filter(b => !ownedTrick.has(b.id) && b.tier === 'legendary');
    if (legends.length > 0) {
      const pick = legends[Math.floor(Math.random()*legends.length)];
      trades.push({ icon:'💰', name:`Pay 12 credits: ${pick.name}`, desc:`Lose 12 credits. Gain the legendary Trick "${pick.name}". ${pick.desc}`, rarity:'legendary',
        apply: () => { coins -= 12; updateCoinsUI(); injectTrickAfterReward(pick); } });
    }
  }
  // Trade 2: sacrifice a knack for 2 Tricks
  if (acquiredKnacks.length > 0) {
    const t = acquiredKnacks[Math.floor(Math.random()*acquiredKnacks.length)];
    trades.push({ icon:'⚖️', name:`Sacrifice ${t.emoji} ${t.name}: 2 Tricks`, desc:`Lose "${t.name}" forever. Gain 2 random Tricks immediately.`, rarity:'rare',
      apply: () => {
        acquiredKnacks = acquiredKnacks.filter(x=>x.id!==t.id); updateKnackList?.();
        for (let i=0;i<2;i++) applyRewardRandomTrick();
        showMessage('Sacrificed knack · 2 Tricks gained', 'var(--gold)'); render();
      }
    });
  }
  // Trade 3: permanent discard reduction for a legendary Trick
  if (limits.discards.current > 1) {
    const ownedTrick = new Set((acquiredTricks||[]).map(b=>b.id));
    const legends = TRICK_POOL.filter(b => !ownedTrick.has(b.id) && b.tier === 'legendary');
    if (legends.length > 0) {
      const pick = legends[Math.floor(Math.random()*legends.length)];
      trades.push({ icon:'🍂', name:`${pick.name}, for a discard`, desc:`Lose 1 discard per round, permanently. Gain ${pick.name}. ${pick.desc}`, rarity:'legendary',
        apply: () => {
          limits.discards.current = Math.max(1, limits.discards.current - 1);
          discards = Math.min(discards, limits.discards.current);
          injectTrickAfterReward(pick);
          showMessage(`+ ${pick.name} · −1 Discard`, 'var(--gold)');
        }
      });
    }
  }
  // Trade 4: sacrifice a sleight (on grid) for a higher-rarity sleight
  const gridSleights = [];
  for (let r=0;r<gridRows;r++) for (let c=0;c<gridCols;c++) if (gridData[r]?.[c]?._isSleight) gridSleights.push({r,c,card:gridData[r][c]});
  if (gridSleights.length > 0) {
    const entry = gridSleights[Math.floor(Math.random()*gridSleights.length)];
    const j = SLEIGHT_POOL.find(x=>x.id===entry.card.sleightId) || { rarity:'common', name:'Sleight' };
    const rarityUp = { common:'rare', rare:'legendary' };
    const nextRarity = rarityUp[j.rarity];
    if (nextRarity) {
      const eligible = SLEIGHT_POOL.filter(x=>!grantedSleightIds.has(x.id) && sleightOfferable(x) && x.rarity===nextRarity);
      if (eligible.length > 0) {
        const pick = eligible[Math.floor(Math.random()*eligible.length)];
        trades.push({ icon:'🔁', name:`${pick.name}, for ${j.name}`, desc:`Lose ${j.name} off the board. Gain ${pick.name}. ${pick.desc}`, rarity:nextRarity,
          apply: () => { gridData[entry.r][entry.c]=null; grantedSleightIds.delete(j.id); grantSleight(pick); showMessage(`Sleight upgraded!`, 'var(--gold)'); render(); }
        });
      }
    }
  }
  // Always-available fallback
  if (trades.length === 0) {
    trades.push({ icon:'⏱', name:'10 seconds for a swap and a discard', desc:'Lose 10s of round time, permanently. Gain +1 swap and +1 discard per round, permanently.', rarity:'rare',
      apply: () => {
        limits.round_time.current = Math.max(30, limits.round_time.current - 10);
        limits.swaps.current++;  limits.discards.current++;
        swaps = Math.min(swaps+1, limits.swaps.current);
        discards = Math.min(discards+1, limits.discards.current);
        showMessage('−10s · +1 Swap · +1 Discard', 'var(--gold)'); render();
      }
    });
  }
  // Shuffle and cap at 3
  const a = [...trades]; for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a.slice(0,3);
}

function renderCrossroads() {
  eventState.trades = buildCrossroadsTrades();
  eventState.selectedTrade = null;
  const body = document.getElementById('event-body');
  eventState.trades.forEach(trade => {
    const el = makeChoiceEl({ icon:trade.icon, rarity:trade.rarity, name:trade.name, desc:trade.desc,
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.selectedTrade = trade;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}

function confirmCrossroads() {
  if (eventState.selectedTrade) { eventState.selectedTrade.apply(); }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: GAMBLE
// ══════════════════════════════════════════════
function renderGamble() {
  // Randomly choose sub-variant
  eventState.gambleMode = Math.random() < 0.5 ? 'doors' : 'double';
  if (acquiredTricks.length === 0) eventState.gambleMode = 'doors'; // can't stake if nothing owned
  if (eventState.gambleMode === 'doors') renderGambleDoors();
  else renderGambleDouble();
}

function buildDoorPrize(tier) {
  // tier: 'legendary' | 'good' | 'bad'
  const ownedTrick = new Set((acquiredTricks||[]).map(b=>b.id));
  const ownedT  = new Set((acquiredKnacks ||[]).map(t=>t.id));
  if (tier === 'legendary') {
    const pool = TRICK_POOL.filter(b=>!ownedTrick.has(b.id) && b.tier==='legendary');
    if (pool.length>0) { const p=pool[Math.floor(Math.random()*pool.length)]; return { icon:'★', name:p.name, desc:p.desc, cls:'revealed-good', apply:()=>injectTrickAfterReward(p) }; }
    // fallback: knack
    const tp = KNACK_POOL.filter(t=>!ownedT.has(t.id));
    if (tp.length>0) { const p=tp[Math.floor(Math.random()*tp.length)]; return { icon:p.emoji, name:p.name, desc:p.desc, cls:'revealed-good', apply:()=>{acquiredKnacks.push({...p});updateKnackList?.();showMessage(`+ ${p.name}`,'var(--gold)');} }; }
  }
  if (tier === 'good') {
    // r201: two tiers in one pool, so this one is weighted (and luck reaches it).
    // The legendary / nextRarity pools above are narrowed to a SINGLE tier by the
    // event's own design, where weighting would be a no-op - left flat on purpose.
    const pool = TRICK_POOL.filter(b=>!ownedTrick.has(b.id) && (b.tier==='rare'||b.tier==='common'));
    if (pool.length>0) { const p=pickTrickByRarity(pool)||pool[Math.floor(Math.random()*pool.length)]; return { icon:'★', name:p.name, desc:p.desc, cls:'revealed-good', apply:()=>injectTrickAfterReward(p) }; }
  }
  if (tier === 'bad') {
    const bads = [
      { icon:'☠', name:'One less discard', desc:'Lose 1 discard for this round.', cls:'revealed-bad', apply:()=>{discards=Math.max(0,discards-1);render();showMessage('−1 Discard','var(--red)');} },
      { icon:'☁', name:'Eight seconds', desc:'Eight seconds come off the clock now.',  cls:'revealed-bad', apply:()=>{roundSeconds=Math.max(1,roundSeconds-8);updateClockUI();showMessage('−8s','var(--red)');} },
      { icon:'✖', name:'Nothing', desc:'This one was empty.',        cls:'revealed-bad', apply:()=>{showMessage('Empty door','var(--cream-dim)');} },
    ];
    return bads[Math.floor(Math.random()*bads.length)];
  }
  return { icon:'?', name:'Unknown', desc:'', cls:'revealed-bad', apply:()=>{} };
}

function renderGambleDoors() {
  // Assign prizes to 3 doors secretly
  const prizes = ['legendary','good','bad'];
  for (let i=prizes.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[prizes[i],prizes[j]]=[prizes[j],prizes[i]];}
  eventState.doorPrizes = prizes.map(t => buildDoorPrize(t));
  eventState.chosenDoor = null;
  eventState.doorsRevealed = false;
  const body = document.getElementById('event-body');
  const label = document.createElement('div');
  label.className = 'ev-label';
  label.textContent = 'PICK A DOOR';
  body.appendChild(label);
  const row = document.createElement('div');
  row.className = 'door-row';
  [0,1,2].forEach(i => {
    const door = document.createElement('div');
    door.className = 'event-door';
    door.innerHTML = `<div class="door-num">${i+1}</div><div class="door-inner"><div class="door-icon"></div><div class="door-dname"></div></div>`;
    door.addEventListener('click', () => {
      if (eventState.doorsRevealed) return;
      row.querySelectorAll('.event-door').forEach(d=>d.classList.remove('chosen'));
      door.classList.add('chosen');
      eventState.chosenDoor = i;
      setEventConfirm(true);
    });
    row.appendChild(door);
  });
  body.appendChild(row);
}

function confirmGamble() {
  if (eventState.gambleMode === 'doors') {
    if (eventState.chosenDoor === null) { closeEvent(); return; }
    // Reveal all doors
    const doors = document.querySelectorAll('.event-door');
    eventState.doorPrizes.forEach((prize, i) => {
      const d = doors[i];
      d.classList.add('revealed');
      d.classList.add(prize.cls);
      d.querySelector('.door-icon').textContent = prize.icon;
      d.querySelector('.door-dname').textContent = prize.name;
    });
    eventState.doorsRevealed = true;
    // Apply chosen door's prize
    eventState.doorPrizes[eventState.chosenDoor].apply();
    setEventConfirm(false);
    document.getElementById('event-skip').textContent = 'Continue';
  } else {
    // Double or nothing, on the same even odds as Coin Flip (r211).
    const won = Math.random() < 0.5;
    if (won) {
      showMessage('You won the gamble!', 'var(--gold)');
      // Grant a random Trick as trick
      applyRewardRandomTrick();
    } else {
      showMessage('Lost the gamble!', 'var(--red)');
      // Lose the staked Trick
      if (eventState.stakedTrick) {
        acquiredTricks = acquiredTricks.filter(b=>b.id !== eventState.stakedTrick.id);
        render();
        showMessage(`Lost ${eventState.stakedTrick.name}`, 'var(--red)');
      }
    }
    closeEvent();
  }
}

function renderGambleDouble() {
  eventState.stakedTrick = null;
  const body = document.getElementById('event-body');
  const info = document.createElement('div');
  info.className = 'ev-note';
  info.textContent = 'Even odds. Win and you keep your Trick and gain another; lose and the one you staked is gone. Pick which one is riding on it.';
  body.appendChild(info);
  const ownedTrick = acquiredTricks || [];
  if (ownedTrick.length === 0) {
    body.innerHTML += evEmptyHTML('You have no Tricks to stake.');
    setEventConfirm(true); return;
  }
  ownedTrick.forEach(trick => {
    const el = makeChoiceEl({ icon:'★', rarity:trick.tier, name:trick.name, desc:trick.desc,
      tile: { entity:'trick', emoji:(typeof trickEmoji === 'function') ? trickEmoji(trick) : '✦', label:trick.name },
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.stakedTrick = trick;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}

// ══════════════════════════════════════════════
// CARD-ENHANCEMENT HELPERS (shared by Forge / Bargain / Wager events)
// ══════════════════════════════════════════════
// Every distinct real card sitting in the player's deck (grid + draw + played).
function allDeckCards() { return everyDeckCard(); }   // see js/deck-grid.js
function randomDeckCard() {
  const all = allDeckCards();
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}
// Apply a permanent enhancement to one card (keyed by cardId since r192).
// `pips`/`mult` are FLAT - scored every play. `growPips`/`growMult` are SCALING -
// how much the flat bonus rises per play. See js/deck-grid.js for why they are
// two stores and not one field with a flag.
function enhanceCardKey(key, e) {
  if (e.pips)   permPips[key]   = (permPips[key]   || 0) + e.pips;
  if (e.mult)   permMult[key]   = (permMult[key]   || 0) + e.mult;
  if (e.growPips) permPipsGrow[key] = (permPipsGrow[key] || 0) + e.growPips;
  if (e.growMult) permMultGrow[key] = (permMultGrow[key] || 0) + e.growMult;
  if (e.xpips)  permXPips[key]  = (permXPips[key]  || 1) * e.xpips;
  if (e.xmult)  permXMult[key]  = (permXMult[key]  || 1) * e.xmult;
  if (e.retrig) permRetrig[key] = (permRetrig[key] || 0) + e.retrig;
  if (e.time)   permTime[key]   = (permTime[key]   || 0) + e.time;
  if (e.subpips) permPips[key]  = Math.max(0, (permPips[key] || 0) - e.subpips);
}
// Returns the card it created. The Card Market needs that: searching the draw
// pile afterwards for "a card with this face that is not the original" picks the
// wrong one as soon as you buy two copies of the same face in one basket.
function copyCardToDeck(card) {
  if (!card) return null;
  const made = stampId({ rank: card.rank, suit: card.suit });
  drawPile.push(made);
  drawPile = deckShuffle(drawPile);
  expectedDeckTotal++;
  updateDeckHud?.();
  return made;
}
// Remove up to n random non-sleight cards from the off-grid piles (draw then played).
function removeRandomDeckCards(n) {
  let removed = 0;
  while (removed < n) {
    const candidates = [];
    drawPile.forEach((c, i)   => { if (!c._isSleight) candidates.push(['draw', i]); });
    playedPile.forEach((c, i) => { if (!c._isSleight) candidates.push(['played', i]); });
    if (!candidates.length) break;
    const [pile, idx] = candidates[Math.floor(Math.random() * candidates.length)];
    (pile === 'draw' ? drawPile : playedPile).splice(idx, 1);
    removed++;
    expectedDeckTotal--;
  }
  updateDeckHud?.();
  return removed;
}
function cardLabel(card) { return card ? `${card.rank}${card.suit}` : 'a card'; }
// The tile payload for one of the { type, icon, name, payload } item objects the
// Confluence and the Merchant build. Tricks are pushed into those lists with
// icon:'★' - the generic marker the old icon disc used - so the real emoji has to
// come from trickEmoji, or every Trick in an Event would be drawn as a star while
// the same Trick in your tray showed its own face.
function evItemTile(item) {
  const emoji = (item.type === 'trick' && typeof trickEmoji === 'function')
    ? trickEmoji(item.payload || item)
    : item.icon;
  return { entity: item.type, emoji, label: item.name };
}
// A local shuffle. reward-grid.js has a `shuffled` but it is scoped INSIDE
// _generateRewardContent, so it is not reachable from here - calling it threw a
// ReferenceError the moment The Bench opened.
function evShuffle(arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

// ══════════════════════════════════════════════
// EVENT: THE FORGE  (this-or-that card enhancement)
// ══════════════════════════════════════════════
function renderForge() {
  const body = document.getElementById('event-body');
  const all = allDeckCards();
  if (!all.length) {
    body.innerHTML = evEmptyHTML('No cards to upgrade.');
    setEventConfirm(true); return;
  }
  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'PICK AN UPGRADE';
  body.appendChild(lbl);

  // Pick 3 distinct random target cards (or reuse if deck is tiny)
  const sh = a => { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
  const picks = sh(all);
  const target = i => picks[i % picks.length];

  const boons = [
    // Two things at once here. Main's r209 point stands and is kept: FLAT vs
    // SCALING must be stated in the words, because "gains +5 mult" was a flat
    // bonus that never grew and read as one that did. On top of that the NAMES
    // are plain now (r211) - "Temper"/"Season"/"Overcharge" told the player
    // nothing about what they were choosing, and the card and the effect are the
    // only two facts that matter.
    (t) => ({ icon:'🔨', rarity:'common', name:`${cardLabel(t)}: +30 pips`, desc:`${cardLabel(t)} scores +30 pips every time it is played.`,
              apply:()=>{ enhanceCardKey(cardId(t), {pips:30}); showMessage(`${cardLabel(t)} +30 pips when played`, 'var(--gold)'); } }),
    (t) => ({ icon:'⚒️', rarity:'rare', name:`${cardLabel(t)}: ×2 pips`, desc:`${cardLabel(t)} scores double pips, for the rest of the run.`,
              apply:()=>{ enhanceCardKey(cardId(t), {xpips:2}); showMessage(`${cardLabel(t)} ×2 pips`, 'var(--gold)'); } }),
    (t) => ({ icon:'✨', rarity:'common', name:`${cardLabel(t)}: +5 mult`, desc:`${cardLabel(t)} scores +5 mult every time it is played.`,
              apply:()=>{ enhanceCardKey(cardId(t), {mult:5}); showMessage(`${cardLabel(t)} +5 mult when played`, 'var(--gold)'); } }),
    (t) => ({ icon:'📈', rarity:'epic', name:`${cardLabel(t)}: mult that grows`, desc:`${cardLabel(t)} gains another +1 mult each time it is played, for good.`,
              apply:()=>{ enhanceCardKey(cardId(t), {growMult:1}); showMessage(`${cardLabel(t)} scales +1 mult per play`, 'var(--gold)'); } }),
    (t) => ({ icon:'🌱', rarity:'rare', name:`${cardLabel(t)}: pips that grow`, desc:`${cardLabel(t)} gains another +4 pips each time it is played, for good.`,
              apply:()=>{ enhanceCardKey(cardId(t), {growPips:4}); showMessage(`${cardLabel(t)} scales +4 pips per play`, 'var(--gold)'); } }),
    (t) => ({ icon:'💥', rarity:'epic', name:`${cardLabel(t)}: ×2 mult`, desc:`${cardLabel(t)} doubles the mult, for the rest of the run.`,
              apply:()=>{ enhanceCardKey(cardId(t), {xmult:2}); showMessage(`${cardLabel(t)} ×2 mult`, 'var(--gold)'); } }),
    (t) => ({ icon:'🔁', rarity:'rare', name:`${cardLabel(t)}: plays twice`, desc:`${cardLabel(t)} scores its pips twice, for the rest of the run.`,
              apply:()=>{ enhanceCardKey(cardId(t), {retrig:1}); showMessage(`${cardLabel(t)} replays`, 'var(--gold)'); } }),
  ];
  const chosen = sh(boons).slice(0, 3).map((make, i) => make(target(i)));
  eventState.forgeChoice = null;
  chosen.forEach(opt => {
    const el = makeChoiceEl({ icon:opt.icon, rarity:opt.rarity, name:opt.name, desc:opt.desc,
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.forgeChoice = opt;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}
function confirmForge() {
  if (eventState.forgeChoice) { eventState.forgeChoice.apply(); render(); }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: THE BARGAIN  (sacrifice to get more)
// ══════════════════════════════════════════════
function buildBargainTrades() {
  const offGrid = drawPile.filter(c=>!c._isSleight).length + playedPile.filter(c=>!c._isSleight).length;
  const trades = [];
  if (offGrid >= 2) {
    trades.push({ icon:'⚖️', rarity:'rare', name:'Two cards for ×3 pips', desc:'Two random cards leave your deck. One of the cards left scores triple pips, for the rest of the run.',
      apply:()=>{ removeRandomDeckCards(2); const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {xpips:3}); showMessage(`${cardLabel(t)} ×3 pips`, 'var(--gold)'); } } });
  }
  trades.push({ icon:'🕯️', rarity:'rare', name:'Eight seconds for a copy', desc:'Lose 8s of round time, permanently. A random card is copied into your deck, and that card scores 20 more pips from now on.',
    apply:()=>{ limits.round_time.current=Math.max(30, limits.round_time.current-8); const t=randomDeckCard(); if(t){ copyCardToDeck(t); enhanceCardKey(cardId(t), {pips:20}); showMessage(`Copied ${cardLabel(t)} · +20 pips`, 'var(--gold)'); } } });
  if (coins >= 10) {
    trades.push({ icon:'🪙', rarity:'epic', name:'Ten credits for a replay', desc:'Lose 10 credits. A random card plays twice and doubles the mult, for the rest of the run.',
      apply:()=>{ coins-=10; updateCoinsUI(); const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {retrig:1, xmult:2}); showMessage(`${cardLabel(t)} replay + ×2 mult`, 'var(--gold)'); } } });
  }
  if (offGrid >= 3) {
    trades.push({ icon:'🗑️', rarity:'epic', name:'Three cards for two swaps', desc:'Three random cards leave your deck. Gain +2 swaps per round permanently, and a random card scores 40 more pips.',
      apply:()=>{ removeRandomDeckCards(3); limits.swaps.current+=2; swaps=Math.min(swaps+2, limits.swaps.current); const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {pips:40}); showMessage(`+2 swaps · ${cardLabel(t)} +40 pips`, 'var(--gold)'); } } });
  }
  // Always-available fallback
  if (trades.length === 0) {
    trades.push({ icon:'🕯️', rarity:'common', name:'Five seconds for +15 pips', desc:'Lose 5s of round time, permanently. A random card scores 15 more pips from now on.',
      apply:()=>{ limits.round_time.current=Math.max(30, limits.round_time.current-5); const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {pips:15}); showMessage(`${cardLabel(t)} +15 pips`, 'var(--gold)'); } } });
  }
  const a=[...trades]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a.slice(0,3);
}
function renderBargain() {
  eventState.bargainTrades = buildBargainTrades();
  eventState.bargainChoice = null;
  const body = document.getElementById('event-body');
  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'PICK WHAT YOU PAY';
  body.appendChild(lbl);
  eventState.bargainTrades.forEach(trade => {
    const el = makeChoiceEl({ icon:trade.icon, rarity:trade.rarity, name:trade.name, desc:trade.desc,
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.bargainChoice = trade;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}
function confirmBargain() {
  if (eventState.bargainChoice) { eventState.bargainChoice.apply(); render(); }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: THE WAGER  (coin flip - get more or lose more)
// ══════════════════════════════════════════════
function renderWager() {
  const body = document.getElementById('event-body');
  if (!allDeckCards().length) {
    body.innerHTML = evEmptyHTML('No cards to stake.');
    setEventConfirm(true); return;
  }
  eventState.wagerStake = null;
  eventState.wagerResolved = false;
  body.appendChild(evNote('One flip, even odds. The three stakes differ in what is riding on it, not in how likely you are to win.'));
  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'PICK YOUR STAKE, THEN FLIP';
  body.appendChild(lbl);
  // A COIN FLIP IS 50/50 (r211). These used to be 70 / 55 / 40, printed in the
  // option names, which made the screen two decisions wearing one coat: how much
  // to risk AND how likely it was. Worse, the odds fell as the stake rose, so the
  // expected value of every step up was worse than the last and "Reckless" was a
  // trap rather than a choice. One shared 50% leaves exactly the decision the
  // screen is for: how much are you willing to lose.
  const WAGER_ODDS = 0.5;
  const stakes = [
    { icon:'🪙', rarity:'common', name:'Small', desc:'Heads: a random card scores ×2 pips. Tails: that card loses 10 pips.',
      win:(t)=>{ enhanceCardKey(cardId(t), {xpips:2}); return `${cardLabel(t)} ×2 pips`; },
      lose:(t)=>{ enhanceCardKey(cardId(t), {subpips:10}); return `${cardLabel(t)} −10 pips`; } },
    { icon:'🎲', rarity:'rare', name:'Middling', desc:'Heads: a random card scores ×3 pips and plays twice. Tails: that card leaves your deck.',
      win:(t)=>{ enhanceCardKey(cardId(t), {xpips:3, retrig:1}); return `${cardLabel(t)} ×3 pips and plays twice`; },
      lose:(t)=>{ removeRandomDeckCards(1); return `${cardLabel(t)} gone`; } },
    { icon:'💀', rarity:'epic', name:'Large', desc:'Heads: a random card scores ×4 pips, ×2 mult and plays twice. Tails: two random cards leave your deck.',
      win:(t)=>{ enhanceCardKey(cardId(t), {xpips:4, xmult:2, retrig:1}); return `${cardLabel(t)} ×4 pips, ×2 mult, plays twice`; },
      lose:(t)=>{ removeRandomDeckCards(2); return `2 cards gone`; } },
  ].map(st => ({ ...st, odds: WAGER_ODDS }));
  stakes.forEach(stake => {
    const el = makeChoiceEl({ icon:stake.icon, rarity:stake.rarity, name:stake.name, desc:stake.desc,
      onClick: () => {
        if (eventState.wagerResolved) return;
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.wagerStake = stake;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}
function confirmWager() {
  const stake = eventState.wagerStake;
  if (!stake || eventState.wagerResolved) { closeEvent(); return; }
  eventState.wagerResolved = true;
  const target = randomDeckCard();
  const won = Math.random() < stake.odds;
  let msg = '';
  if (target) msg = won ? stake.win(target) : stake.lose(target);
  render();
  showMessage(won ? `HEADS · ${msg}` : `TAILS · ${msg}`, won ? 'var(--gold)' : 'var(--red)');
  setEventConfirm(false);
  document.getElementById('event-skip').textContent = 'Continue';
}

// ══════════════════════════════════════════════
// EVENT: WANDERING MERCHANT
// ══════════════════════════════════════════════
function renderMerchant() {
  // 2 legendary/rare Tricks + 1 sleight or knack - all free (it's a gift event, not a shop)
  const ownedTrick     = new Set((acquiredTricks||[]).map(b=>b.id));
  const ownedKnacks = new Set((acquiredKnacks ||[]).map(t=>t.id));
  const legends = TRICK_POOL.filter(b=>!ownedTrick.has(b.id) && (b.tier==='legendary'||b.tier==='rare'));
  const knacks  = KNACK_POOL.filter(t=>!ownedKnacks.has(t.id));
  const sleights  = SLEIGHT_POOL.filter(j=>!grantedSleightIds.has(j.id) && sleightOfferable(j) && (j.rarity==='rare'||j.rarity==='legendary'));
  const sh = a => { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
  const items = [];
  sh(legends).slice(0,2).forEach(b => items.push({ type:'trick', icon:'★', rarity:b.tier, name:b.name, desc:b.desc, payload:b }));
  if (knacks.length>0 && Math.random()<0.5) { const t=sh(knacks)[0]; items.push({ type:'knack', icon:t.emoji, rarity:'legendary', name:t.name, desc:t.desc, payload:t }); }
  else if (sleights.length>0) { const j=sh(sleights)[0]; items.push({ type:'sleight', icon:j.emoji, rarity:j.rarity, name:j.name, desc:j.desc, payload:j }); }
  // cap at 3, shuffle
  eventState.merchantItems = sh(items).slice(0,3);
  eventState.merchantPick  = null;
  const body = document.getElementById('event-body');
  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'TAKE ONE';
  body.appendChild(lbl);
  if (eventState.merchantItems.length === 0) {
    body.innerHTML += evEmptyHTML('Nothing here you do not already own.');
    setEventConfirm(true); return;
  }
  eventState.merchantItems.forEach(item => {
    const el = makeChoiceEl({ icon:item.icon, rarity:item.rarity, name:item.name, desc:item.desc,
      tile: evItemTile(item),
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.merchantPick = item;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}

function confirmMerchant() {
  const item = eventState.merchantPick;
  if (!item) { closeEvent(); return; }
  if (item.type === 'trick') { injectTrickAfterReward(item.payload); }
  else if (item.type === 'knack') { acquiredKnacks.push({...item.payload}); updateKnackList?.(); showMessage(`+ ${item.name}`,'var(--gold)'); }
  else if (item.type === 'sleight') { grantSleight(item.payload); }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: ALTAR
// ══════════════════════════════════════════════
function renderAltar() {
  const offerings = [
    { icon:'🕯️', name:'+3 mult for 3 rounds', rarity:'rare',
      desc:'Give up 2 discards now. Every hand scores +3 mult for the next 3 rounds.',
      cost:'Costs 2 discards',
      canTake: () => discards >= 2,
      apply: () => { discards = Math.max(0, discards-2); altarEffects.push({ type:'mult_boost', value:3, roundsLeft:3 }); showMessage('+3 mult for 3 rounds', 'var(--gold)'); render(); }
    },
    { icon:'⌛', name:'+20s for 2 rounds', rarity:'rare',
      desc:'Pay 10 credits. The next 2 rounds start with 20 extra seconds on the clock.',
      cost:'Costs 10 credits',
      canTake: () => coins >= 10,
      apply: () => { coins -= 10; updateCoinsUI(); altarEffects.push({ type:'time_boost', value:20, roundsLeft:2 }); showMessage('+20s for 2 rounds', 'var(--gold)'); }
    },
    { icon:'🌑', name:'Half goal for 4 rounds', rarity:'legendary',
      desc:'Give up one of your Tricks, chosen at random. The next 4 rounds need only half the score.',
      cost:'Costs 1 random Trick',
      canTake: () => acquiredTricks.length > 0,
      apply: () => {
        const i=Math.floor(Math.random()*acquiredTricks.length);
        const lost=acquiredTricks.splice(i,1)[0];
        altarEffects.push({ type:'goal_reduce', value:0.5, roundsLeft:4 });
        showMessage(`Gave up ${lost.name} · goal halved for 4 rounds`, 'var(--gold)'); render();
      }
    },
  ];
  eventState.altarPick = null;
  const body = document.getElementById('event-body');
  offerings.forEach(off => {
    const locked = !off.canTake();
    const el = makeChoiceEl({ icon:off.icon, rarity:off.rarity, name:off.name, desc:off.desc, cost:off.cost,
      cls: locked ? 'locked' : '',
      onClick: () => {
        if (locked) return;
        body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.altarPick = off;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}

function confirmAltar() {
  if (eventState.altarPick) { eventState.altarPick.apply(); }
  closeEvent();
}

// ── Altar tick: called at start of each round ──
function tickAltarEffects() {
  altarEffects.forEach(eff => {
    if (eff.type === 'time_boost') {
      roundSeconds = Math.min(roundSeconds + eff.value, limits.round_time.current + 60);
      updateClockUI();
    }
    eff.roundsLeft--;
  });
  altarEffects = altarEffects.filter(e => e.roundsLeft > 0);
}

function getAltarMultBoost() {
  return altarEffects.filter(e => e.type === 'mult_boost').reduce((s,e) => s + e.value, 0);
}

function getAltarGoalMultiplier() {
  const eff = altarEffects.find(e => e.type === 'goal_reduce');
  return eff ? eff.value : 1;
}

// ══════════════════════════════════════════════
// EVENT: CLEAN UP  (event id 'spring', formerly Cleansing Spring)
// ══════════════════════════════════════════════
// Thinning the deck is the strongest thing this event does, so r211 gives it a
// shape rather than a single "remove one card": FOUR cards if they are all
// different ranks, or TWO with no strings. Four-of-different-ranks is the better
// cut and the harder one to want - it forces the player to spread the loss across
// their deck instead of deleting every copy of the rank that keeps blocking them.
//
// The picker lists ONE CHIP PER CARD, not one per face, and removes by object
// identity. Cards are identified individually (see "Card identity" in CLAUDE.md)
// and the deck really can hold two 7♠ - the Mart sells duplicates - so a
// face-deduped list would hide one of them and a face-matched splice would take
// whichever copy it found first.
const SPRING_CUTS = {
  cut4: { count: 4, distinctRanks: true },
  cut2: { count: 2, distinctRanks: false },
};

function renderSpring() {
  eventState.springPick = null;
  eventState.springCards = [];
  const body = document.getElementById('event-body');
  body.appendChild(evNote('Cards you cut are gone for the rest of the run. A thinner deck draws what you want more often.'));

  const cuttable = springCuttableCards();

  const addCut = (key, opts) => {
    const cfg = SPRING_CUTS[key];
    const el = makeChoiceEl({
      icon: opts.icon, rarity: opts.rarity, name: opts.name, desc: opts.desc,
      cls: cuttable.length < cfg.count ? 'locked' : '',
      onClick: () => {
        if (cuttable.length < cfg.count) return;
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.springPick = key;
        eventState.springCards = [];
        showSpringCardPicker(cuttable, cfg);
        setEventConfirm(false);
      }
    });
    body.appendChild(el);
  };

  addCut('cut4', { icon:'✂️', rarity:'rare', name:'Cut 4 cards, all different ranks',
    desc:'Pick four cards from your draw pile. No two of them may share a rank.' });
  addCut('cut2', { icon:'✂️', rarity:'common', name:'Cut 2 cards, your choice',
    desc:'Pick any two cards from your draw pile. They can be the same rank, the same card twice over, anything.' });

  // Put resources back. PERMANENT: it repairs the LIMIT, not that round's stock,
  // so a swap lost to Two and a Catch or the Auditor is actually given back
  // rather than handed over for one round and then lost again.
  const short = springResourceShortfall();
  const restoreDesc = (short.swaps || short.discards)
    ? `Your swap and discard limits go back to ${limits.swaps.base} and ${limits.discards.base} for good, and this round's stock refills.`
    : `Nothing of yours is missing, so take the increase instead: +1 swap and +1 discard per round, permanently.`;
  const restoreOpt = makeChoiceEl({
    icon:'🔧', rarity:'common', name: (short.swaps || short.discards) ? 'Put your limits back' : '+1 swap and +1 discard',
    desc: restoreDesc,
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
      restoreOpt.classList.add('selected');
      eventState.springPick = 'restore_resources';
      eventState.springCards = [];
      document.getElementById('spring-card-picker')?.remove();
      setEventConfirm(true);
    }
  });
  body.appendChild(restoreOpt);

  // Unchanged behaviour, plain wording.
  const cleanseOpt = makeChoiceEl({
    icon:'✨', rarity:'rare', name:'Undo a downside',
    desc:'Reverse one of the permanent downsides taken from an earlier reward grid. Gives back +1 discard.',
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
      cleanseOpt.classList.add('selected');
      eventState.springPick = 'cleanse_debuff';
      eventState.springCards = [];
      document.getElementById('spring-card-picker')?.remove();
      setEventConfirm(true);
    }
  });
  body.appendChild(cleanseOpt);
}

// Every ordinary card in the draw pile, as individual cards.
function springCuttableCards() {
  return (drawPile || []).filter(c => c && c.rank && !c._isSleight && !c._isStone);
}

// How far below their base each resource limit currently sits. Below BASE, not
// below whatever the player has upgraded to: this option repairs damage, it is
// not a free copy of every limit upgrade they skipped.
function springResourceShortfall() {
  return {
    swaps:    Math.max(0, limits.swaps.base    - limits.swaps.current),
    discards: Math.max(0, limits.discards.base - limits.discards.current),
  };
}

function showSpringCardPicker(pool, cfg) {
  document.getElementById('spring-card-picker')?.remove();
  const body = document.getElementById('event-body');
  // The label lives INSIDE the removable wrapper - the picker is rebuilt every
  // time the player changes their mind about which cut they want, and appending
  // the label separately stacks a fresh copy each time (the trap r194 hit).
  const wrap = document.createElement('div');
  wrap.id = 'spring-card-picker';
  const label = evLabel('');
  wrap.appendChild(label);
  const chips = document.createElement('div');
  chips.className = 'ev-cardchips';

  const refresh = () => {
    const n = eventState.springCards.length;
    label.textContent = cfg.distinctRanks
      ? `PICK ${cfg.count} CARDS, ALL DIFFERENT RANKS  ·  ${n}/${cfg.count}`
      : `PICK ${cfg.count} CARDS  ·  ${n}/${cfg.count}`;
    const ranksTaken = new Set(eventState.springCards.map(c => c.rank));
    chips.querySelectorAll('.ev-cardchip').forEach(chip => {
      const card = chip._card;
      const picked = eventState.springCards.includes(card);
      chip.classList.toggle('picked', picked);
      // A rank already used is greyed out rather than silently refusing the tap.
      const blocked = !picked && cfg.distinctRanks && ranksTaken.has(card.rank);
      chip.classList.toggle('blocked', blocked);
    });
    setEventConfirm(n === cfg.count);
  };

  pool.forEach(card => {
    const chip = document.createElement('div');
    chip.className = 'ev-cardchip' + (['♥','♦'].includes(card.suit) ? ' red' : '');
    chip.textContent = card.rank + card.suit;
    chip._card = card;
    chip.addEventListener('click', () => {
      const i = eventState.springCards.indexOf(card);
      if (i >= 0) eventState.springCards.splice(i, 1);
      else {
        if (eventState.springCards.length >= cfg.count) return;
        if (cfg.distinctRanks && eventState.springCards.some(c => c.rank === card.rank)) return;
        eventState.springCards.push(card);
      }
      refresh();
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  body.appendChild(wrap);
  refresh();
}

function confirmSpring() {
  switch (eventState.springPick) {
    case 'cut4':
    case 'cut2': {
      // Splice by identity, never by face - see the note at the top of this event.
      let cut = 0;
      eventState.springCards.forEach(card => {
        const idx = drawPile.indexOf(card);
        if (idx >= 0) { drawPile.splice(idx, 1); cut++; }
      });
      if (cut) {
        expectedDeckTotal -= cut;
        updateDeckHud?.();
        showMessage(`${cut} card${cut > 1 ? 's' : ''} cut from the deck`, 'var(--gold)');
      }
      break;
    }
    case 'restore_resources': {
      const short = springResourceShortfall();
      if (short.swaps || short.discards) {
        limits.swaps.current    = Math.max(limits.swaps.current,    limits.swaps.base);
        limits.discards.current = Math.max(limits.discards.current, limits.discards.base);
        showMessage(`Limits restored - ${limits.swaps.base} swaps, ${limits.discards.base} discards`, 'var(--gold)');
      } else {
        limits.swaps.current    = Math.min(limits.swaps.max,    limits.swaps.current + 1);
        limits.discards.current = Math.min(limits.discards.max, limits.discards.current + 1);
        showMessage('+1 swap, +1 discard per round', 'var(--gold)');
      }
      // Refill this round's stock up to the repaired limits too, so the fix is
      // visible now rather than only from the next round.
      swaps    = Math.max(swaps,    limits.swaps.current);
      discards = Math.max(discards, limits.discards.current);
      onLimitChanged('swaps'); onLimitChanged('discards');
      render();
      break;
    }
    case 'cleanse_debuff':
      // Unchanged from before r211 - the owner confirmed this one reads right.
      discards = Math.min(discards + 1, limits.discards.current + 2);
      render(); showMessage('+1 discard restored', 'var(--gold)'); break;
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: TWIN PATH
// ══════════════════════════════════════════════
function renderTwinPath() {
  const ownedTrick = new Set((acquiredTricks||[]).map(b=>b.id));
  const pool = TRICK_POOL.filter(b=>!ownedTrick.has(b.id) && !offerBannedGlobal(b.id));
  // Both Tricks are drawn on the rarity table (r203). This event shuffled the
  // whole pool and took the top two until then - two flat draws from 177 Tricks,
  // so a Twin Path was a 31%-epic-or-better offer TWICE while the reward grid
  // beside it ran at 13%. It is most of why Tricks read as too generous.
  const picks = [];
  const taken = new Set();
  for (let i = 0; i < 2; i++) {
    const p = pickTrickByRarity(pool.filter(b => !taken.has(b.id)));
    if (p) { picks.push(p); taken.add(p.id); }
  }
  const shadow = [
    { icon:'☁', name:'Five seconds', desc:'Five seconds come off the clock now.',     apply:()=>{roundSeconds=Math.max(1,roundSeconds-5);updateClockUI();showMessage('The catch: −5s','var(--red)');} },
    { icon:'☠', name:'One less discard', desc:'Lose 1 discard per round, permanently.',      apply:()=>{limits.discards.current=Math.max(1,limits.discards.current-1);discards=Math.min(discards,limits.discards.current);render();showMessage('The catch: −1 discard','var(--red)');} },
    { icon:'✖', name:'One less swap', desc:'Lose 1 swap per round, permanently.',         apply:()=>{limits.swaps.current=Math.max(0,limits.swaps.current-1);swaps=Math.min(swaps,limits.swaps.current);render();showMessage('The catch: −1 swap','var(--red)');} },
    { icon:'🌑', name:'Goal +15%', desc:'This round needs 15% more score.', apply:()=>{roundGoal=Math.floor(roundGoal*1.15);showMessage('The catch: goal +15%','var(--red)');} },
  ];
  eventState.shadow = shadow[Math.floor(Math.random()*shadow.length)];
  eventState.twinTricks = picks;
  eventState.twinAccepted = false;
  const body = document.getElementById('event-body');

  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent='BOTH, OR NEITHER';
  body.appendChild(lbl);

  picks.forEach(trick => {
    body.appendChild(makeChoiceEl({ icon:'★', rarity:trick.tier, name:trick.name, desc:trick.desc,
      tile: { entity:'trick', emoji:(typeof trickEmoji === 'function') ? trickEmoji(trick) : '✦', label:trick.name } }));
  });

  const shadowEl = makeChoiceEl({ icon: eventState.shadow.icon, name: eventState.shadow.name, desc: eventState.shadow.desc, cls:'debuff' });
  shadowEl.style.marginTop = '6px';
  const shadowLbl = document.createElement('div');
  shadowLbl.className = 'ev-label danger';
  shadowLbl.textContent='THE CATCH · APPLIES EITHER WAY';
  body.appendChild(shadowLbl);
  body.appendChild(shadowEl);

  const acceptBtn = document.createElement('button');
  acceptBtn.textContent = 'Take both, and the catch';
  acceptBtn.className = 'ev-btn';
  acceptBtn.addEventListener('click', () => {
    eventState.twinAccepted = true;
    acceptBtn.disabled = true;
    setEventConfirm(true);
  });
  body.appendChild(acceptBtn);
  document.getElementById('event-skip').textContent = 'Take nothing';
}

function confirmTwinPath() {
  if (eventState.twinAccepted) {
    (eventState.twinTricks || []).forEach(trick => injectTrickAfterReward(trick));
    eventState.shadow.apply();
  }
  closeEvent();
}





// ══════════════════════════════════════════════
// EVENT: SHIFT CHANGE  (r182)
// ══════════════════════════════════════════════
// Reorder your Trick tray. This is a real decision, not housekeeping: slot order
// is load-bearing in several places and there was previously no way to change it
// once a Trick landed.
//
//   · Inspirato primes your FIRST and LAST Tricks
//   · Mirror borrows from whichever Trick sits beside it
//   · Prime Times cycles 1st → 2nd → 3rd → 5th → 7th
//   · the Alignment knack marks the column matching a Trick's slot number
//   · Move as One fires your lowest-rarity Trick sharing a keyword
//
// Interaction is tap-to-swap, which works identically with a finger and a mouse
// and needs no drag: tap a Trick to lift it, tap a second to trade their places.
// Tapping the lifted Trick again puts it back down. Nothing is committed until
// Confirm, and Skip leaves the tray exactly as it was.
function renderShiftChange() {
  const body = document.getElementById('event-body');
  const tray = (typeof trickTray !== 'undefined' && trickTray) ? trickTray : [];

  // Fewer than two Tricks: there is no order to change, so the shift pays out
  // instead of wasting the node.
  if (tray.length < 2) {
    eventState.shiftPayout = BAL.shift_change ? BAL.shift_change.consolation_credits : 15;
    body.appendChild(makeChoiceEl({
      icon: '🕓', name: 'Nothing to reshuffle',
      desc: `You need at least two Tricks before the order means anything. Take ${eventState.shiftPayout} credits for turning up.`,
    }));
    setEventConfirm(true);
    document.getElementById('event-skip').textContent = 'Leave';
    return;
  }

  // Work on a copy - the real tray is only written on Confirm.
  eventState.shiftOrder = tray.slice();
  eventState.shiftLifted = null;

  const lbl = document.createElement('div');
  lbl.className = 'ev-label';
  lbl.textContent = 'TAP TWO TRICKS TO SWAP THEM';
  body.appendChild(lbl);

  const row = document.createElement('div');
  row.id = 'shift-row';
  body.appendChild(row);

  const hint = document.createElement('div');
  hint.id = 'shift-hint';
  body.appendChild(hint);

  const tools = document.createElement('div');
  tools.id = 'shift-tools';
  const mkTool = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'shift-tool';
    b.textContent = label;
    b.addEventListener('click', () => { fn(); renderShiftRow(); });
    return b;
  };
  tools.appendChild(mkTool('↔ Reverse', () => { eventState.shiftOrder.reverse(); eventState.shiftLifted = null; }));
  tools.appendChild(mkTool('↺ Reset',   () => { eventState.shiftOrder = tray.slice(); eventState.shiftLifted = null; }));
  body.appendChild(tools);

  renderShiftRow();
  setEventConfirm(true);
  document.getElementById('event-skip').textContent = 'Leave as it is';
}

function renderShiftRow() {
  const row = document.getElementById('shift-row');
  if (!row) return;
  const RARS = ['common','rare','epic','legendary'];
  const order = eventState.shiftOrder || [];
  row.innerHTML = '';
  order.forEach((trick, i) => {
    const rar = RARS.includes(trick.tier) ? trick.tier : 'common';
    const slot = document.createElement('div');
    slot.className = 'shift-slot' + (eventState.shiftLifted === i ? ' lifted' : '');
    // The same entity tile the reward grid, the Mart and your tray all draw
    // (js/entity-tile.js) - a Trick looks like itself here too.
    slot.innerHTML = `<div class="shift-num">${i + 1}</div>`
                   + entityTileHTML({ entity: 'trick', label: trick.name, emoji: trickEmoji(trick) }, rar);
    slot.addEventListener('click', () => {
      if (eventState.shiftLifted === null)      eventState.shiftLifted = i;      // lift
      else if (eventState.shiftLifted === i)    eventState.shiftLifted = null;   // put back down
      else {                                                                     // trade places
        const a = eventState.shiftLifted;
        [order[a], order[i]] = [order[i], order[a]];
        eventState.shiftLifted = null;
      }
      renderShiftRow();
    });
    row.appendChild(slot);
  });
  fitEntityNames(row, '.rwd-name', { maxLines: 2, minPx: 5 });

  const hint = document.getElementById('shift-hint');
  if (hint) {
    const lifted = eventState.shiftLifted;
    hint.textContent = lifted === null
      ? 'Slot 1 is first, and the last slot is last - both matter to Inspirato.'
      : `${order[lifted].name} is lifted - tap another Trick to trade places, or tap it again to put it back.`;
    hint.classList.toggle('active', lifted !== null);
  }
}

function confirmShiftChange() {
  if (eventState.shiftPayout) {
    coins += eventState.shiftPayout;
    updateCoinsUI();
    showMessage(`+${eventState.shiftPayout} credits`, 'var(--gold)');
  } else if (eventState.shiftOrder) {
    // Write the new order back in place. trickTray is referenced by identity all
    // over the codebase (scoring walks it by index, the tray UI re-reads it), so
    // it is refilled rather than replaced.
    trickTray.length = 0;
    eventState.shiftOrder.forEach(t => trickTray.push(t));
    if (typeof renderTrickTray === 'function') renderTrickTray();
    // A position Trick's marked row/column is fixed when you ACQUIRE it
    // (assignPositionMark, guarded by _posAssigned) and is deliberately left
    // alone here - reshuffling the tray moves the Tricks, not the lines they
    // already own, so nothing you were building around silently relocates.
    showMessage('Shift change - Trick order updated', 'var(--gold)');
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// UPGRADE EVENTS (r194) - improve what you already have
// ══════════════════════════════════════════════
// Every event before these HANDED you something. That is the wrong shape for a
// run that has to close a 1.227x-per-level gap (see Natural Scaling in
// CLAUDE.md): a Trick tray caps at 10 and fills long before an act does, so a
// twelfth grant is a replace-or-decline, while an upgrade always has somewhere
// to go. Each of these rides an engine seam that already existed rather than
// inventing per-entity code:
//   cards    enhanceCardKey  (permPips / permXMult / permRetrig …)
//   Tricks   t._rank         (a permanent prime - see calcScore)
//   Sleights sleightCapBonus (a raisable charge ceiling - sleights-runtime.js)

// ─── EVENT: THE BENCH (card enhancement, on a card YOU choose) ───
// The Forge offers three enhancements on three RANDOM cards. The Bench offers
// the same kind of power on a card you pick, which is the version that can be
// aimed at a build.
function renderBench() {
  const body = document.getElementById('event-body');
  const pool = [...drawPile].filter(c => c && c.rank && !c._isSleight);
  if (!pool.length) {
    body.innerHTML = evEmptyHTML('No cards in the draw pile to work on.');
    setEventConfirm(true); return;
  }
  eventState.benchBoon = null;
  eventState.benchCard = null;
  body.appendChild(evNote('Pick an upgrade, then pick the card it goes on. That card keeps it for the rest of the run.'));

  const boons = [
    { icon:'🔨', rarity:'common', name:'+40 pips',  desc:'Scores 40 more pips, for the rest of the run.',        e:{ pips:40 },  say:'+40 pips'  },
    { icon:'✨', rarity:'rare',   name:'+6 mult',   desc:'Adds 6 mult, for the rest of the run.',         e:{ mult:6 },   say:'+6 mult'   },
    { icon:'💥', rarity:'epic',   name:'×2 mult',   desc:'Doubles the mult, for the rest of the run.',  e:{ xmult:2 },  say:'×2 mult'   },
    { icon:'🔁', rarity:'rare',   name:'Plays twice',desc:'Scores twice, for the rest of the run.',    e:{ retrig:1 }, say:'replays'   },
  ];
  const chosen = evShuffle(boons).slice(0, 3);
  chosen.forEach(b => {
    const el = makeChoiceEl({ icon:b.icon, rarity:b.rarity, name:b.name, desc:b.desc,
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.benchBoon = b;
        showBenchCardPicker(pool);
        setEventConfirm(!!eventState.benchCard);
      }
    });
    body.appendChild(el);
  });
}
// One chip per card IDENTITY, not per copy - permPips and friends are keyed by
// "rank-suit", so treating one 7♠ treats every 7♠ in the deck. Showing three
// identical chips would imply otherwise.
function showBenchCardPicker(pool) {
  // Rebuilt whenever a different treatment is picked, so the label has to live
  // INSIDE the removable wrapper - appending it separately stacked a fresh
  // "CHOOSE THE CARD" every time the player changed their mind.
  document.getElementById('bench-card-picker')?.remove();
  const body = document.getElementById('event-body');
  const wrap = document.createElement('div');
  wrap.id = 'bench-card-picker';
  wrap.appendChild(evLabel('PICK THE CARD'));
  const chips = document.createElement('div');
  chips.className = 'ev-cardchips';
  const seen = new Set();
  pool.forEach(card => {
    const key = card.rank + card.suit;
    if (seen.has(key)) return; seen.add(key);
    const chip = document.createElement('div');
    chip.className = 'ev-cardchip' + (['♥','♦'].includes(card.suit) ? ' red' : '');
    chip.textContent = card.rank + card.suit;
    chip.addEventListener('click', () => {
      chips.querySelectorAll('.ev-cardchip').forEach(c => c.classList.remove('picked'));
      chip.classList.add('picked');
      eventState.benchCard = card;
      setEventConfirm(!!eventState.benchBoon);
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  body.appendChild(wrap);
}
function confirmBench() {
  const b = eventState.benchBoon, c = eventState.benchCard;
  if (b && c) {
    // Per CARD, not per face - resolved fresh, since the pick was made before this.
    const t = resolveDeckCard(c);
    if (t) { enhanceCardKey(cardId(t), b.e); showMessage(`${cardLabel(t)} ${b.say}`, 'var(--gold)'); }
  }
  closeEvent();
}

// ─── EVENT: REHEARSAL (Trick upgrade) ───
// Permanently primes one Trick: it fires its effect an extra time, every hand,
// for the rest of the run. Generic by construction - calcScore duplicates
// whatever pip/mult delta the Trick reported, so this works on all of them
// without a line of per-Trick code.
function renderRehearsal() {
  const body = document.getElementById('event-body');
  if (!trickTrayMode || !trickTray.length) {
    body.innerHTML = evEmptyHTML('No Tricks to work on. Take the credits instead.');
    eventState.rehearseNone = true;
    setEventConfirm(true); return;
  }
  eventState.rehearsePick = null;
  body.appendChild(evNote('One Trick fires an extra time on every hand, for the rest of the run. It does not run out.'));
  trickTray.forEach(t => {
    const rank = t._rank || 0;
    const el = makeChoiceEl({
      icon: (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦',
      rarity: t.tier,
      name: t.name + (rank ? ` · rehearsed ×${rank + 1}` : ''),
      desc: (typeof trickLiveDesc === 'function') ? trickLiveDesc(t) : t.desc,
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.rehearsePick = t;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}
function confirmRehearsal() {
  if (eventState.rehearseNone) {
    coins += BAL.rehearsal.consolation_credits;
    updateCoinsUI?.();
    showMessage(`+${BAL.rehearsal.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.rehearsePick) {
    const t = eventState.rehearsePick;
    t._rank = (t._rank || 0) + 1;
    showMessage(`${t.name} rehearsed - fires ${t._rank + 1}× a hand`, 'var(--gold)');
    if (typeof renderTrickTray === 'function') renderTrickTray();
  }
  closeEvent();
}

// ─── EVENT: THE WORKSHOP (Sleight upgrade) ───
// Sleights run on charges and, once spent, sit inert or leave the deck. Nothing
// in the game raised a charge CEILING before this.
function renderWorkshop() {
  const body = document.getElementById('event-body');
  const owned = allOwnedSleightCards().filter(c => sleightMaxCharges(sleightDef(c)) !== null);
  if (!owned.length) {
    body.innerHTML = evEmptyHTML('No Sleights with charges to service. Take the fee instead.');
    eventState.workshopNone = true;
    setEventConfirm(true); return;
  }
  eventState.workshopPick = null;
  eventState.workshopCard = null;
  body.appendChild(evNote('Charges are per run, not per round. Service refills what you have; reinforcing raises the ceiling for good.'));

  const service = makeChoiceEl({
    icon:'🧰', rarity:'common', name:'Service', desc:`Refill every Sleight you own to full charges (${owned.length} held).`,
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
      service.classList.add('selected');
      eventState.workshopPick = 'service';
      document.getElementById('workshop-picker')?.remove();
      setEventConfirm(true);
    }
  });
  body.appendChild(service);

  const reinforce = makeChoiceEl({
    icon:'⚙️', rarity:'epic', name:'Reinforce',
    desc:`One Sleight permanently gains +${BAL.workshop.cap_bonus} maximum charges, and refills to that new ceiling.`,
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
      reinforce.classList.add('selected');
      eventState.workshopPick = 'reinforce';
      showWorkshopPicker(owned);
      setEventConfirm(!!eventState.workshopCard);
    }
  });
  body.appendChild(reinforce);
}
// One row per Sleight IDENTITY - the cap bonus is stored by sleightId, so
// reinforcing one copy reinforces every copy of that Sleight.
function showWorkshopPicker(owned) {
  document.getElementById('workshop-picker')?.remove();
  const body = document.getElementById('event-body');
  const wrap = document.createElement('div');
  wrap.id = 'workshop-picker';
  wrap.className = 'ev-stack';
  wrap.appendChild(evLabel('PICK THE SLEIGHT'));
  const seen = new Set();
  owned.forEach(card => {
    const def = sleightDef(card);
    if (!def || seen.has(def.id)) return; seen.add(def.id);
    const cap = sleightMaxCharges(def);
    const el = makeChoiceEl({
      icon: def.emoji || '◈', rarity: def.rarity, name: def.name,
      desc: `${def.desc}<br>Now ${card._usesLeft ?? cap} of ${cap} charges · would become ${cap + BAL.workshop.cap_bonus}.`,
      onClick: () => {
        wrap.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.workshopCard = card;
        setEventConfirm(true);
      }
    });
    wrap.appendChild(el);
  });
  body.appendChild(wrap);
}
function confirmWorkshop() {
  if (eventState.workshopNone) {
    coins += BAL.workshop.consolation_credits;
    updateCoinsUI?.();
    showMessage(`+${BAL.workshop.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.workshopPick === 'service') {
    let n = 0;
    allOwnedSleightCards().forEach(c => {
      const cap = sleightMaxCharges(sleightDef(c));
      if (cap !== null && (c._usesLeft || 0) < cap) { c._usesLeft = cap; n++; }
    });
    showMessage(n ? `${n} Sleight${n > 1 ? 's' : ''} refilled` : 'All Sleights already full', 'var(--gold)');
  } else if (eventState.workshopPick === 'reinforce' && eventState.workshopCard) {
    const def = sleightDef(eventState.workshopCard);
    if (def) {
      sleightCapBonus[def.id] = (sleightCapBonus[def.id] || 0) + BAL.workshop.cap_bonus;
      // Refill every copy to the NEW ceiling, not just the one that was picked -
      // the bonus is stored per sleightId, so they all share it.
      allOwnedSleightCards().forEach(c => {
        if (c.sleightId === def.id) c._usesLeft = sleightMaxCharges(def);
      });
      showMessage(`${def.name} reinforced - ${sleightMaxCharges(def)} charges`, 'var(--gold)');
    }
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: CARD MARKET  (id 'market', r211)
// ══════════════════════════════════════════════
// Buy cards INTO your deck. Every other event either hands you an entity or
// upgrades one you already own; this is the only place the deck itself gets
// bigger on purpose, and each card arrives carrying exactly one effect so the
// purchase is legible: a 9♦ that scores +30 pips, a Q♠ that plays twice.
//
// The card offered is always a COPY OF ONE ALREADY IN YOUR DECK. That is not
// laziness - it is what keeps the market mode-safe. Spectrum has no court cards
// and no suits, Six Suits has two extra ones, and the deck tuner can switch
// values off entirely; inventing a rank and a suit here would be the one place in
// the game that can put an illegal card into play.
//
// Multi-buy: tap to add, tap again to drop, total runs at the bottom. Confirm
// buys everything in the basket. Nothing is charged until Confirm.
const MARKET_BOONS = [
  { key:'pips',   icon:'🔨', rarity:'common', tag:'+30 pips',    e:{ pips:30 },
    say:'scores 30 extra pips every time it is played' },
  { key:'mult',   icon:'✨', rarity:'rare',   tag:'+5 mult',     e:{ mult:5 },
    say:'adds 5 mult every time it is played' },
  { key:'time',   icon:'⏱',  rarity:'rare',   tag:'+4 seconds',  e:{ time:4 },
    say:'puts 4 seconds back on the clock every time it is played' },
  { key:'replay', icon:'🔁', rarity:'epic',   tag:'plays twice', e:{ retrig:1 },
    say:'scores twice every time it is played' },
];

function renderMarket() {
  const body = document.getElementById('event-body');
  const source = allDeckCards();
  if (!source.length) {
    body.innerHTML = evEmptyHTML('No deck to copy from.');
    setEventConfirm(true); return;
  }
  eventState.marketBasket = [];
  const picks = evShuffle(source);
  const boons = evShuffle(MARKET_BOONS).slice(0, BAL.market.offers);
  eventState.marketOffers = boons.map((b, i) => {
    const card = picks[i % picks.length];
    return { boon: b, card, price: BAL.market.prices[b.key] };
  });

  body.appendChild(evNote('Each of these adds one new card to your deck, carrying the effect shown. Buy as many as you can pay for.'));

  const total = document.createElement('div');
  const refresh = () => {
    const cost = marketBasketCost();
    total.textContent = eventState.marketBasket.length
      ? `${eventState.marketBasket.length} card${eventState.marketBasket.length > 1 ? 's' : ''} · ${cost} of your ${coins} credits`
      : `You have ${coins} credits`;
    total.classList.toggle('danger', cost > coins);
    body.querySelectorAll('.event-choice').forEach((el, i) => {
      const off = eventState.marketOffers[i];
      if (!off) return;
      const inBasket = eventState.marketBasket.includes(off);
      el.classList.toggle('selected', inBasket);
      // Grey out what this basket can no longer afford, rather than letting the
      // player build a basket that Confirm would then silently trim.
      el.classList.toggle('locked', !inBasket && cost + off.price > coins);
    });
    setEventConfirm(eventState.marketBasket.length > 0 && cost <= coins);
  };

  eventState.marketOffers.forEach(off => {
    const el = makeChoiceEl({
      icon: off.boon.icon, rarity: off.boon.rarity,
      name: `${cardLabel(off.card)} · ${off.boon.tag}`,
      desc: `A new ${cardLabel(off.card)} joins your deck. It ${off.boon.say}, for the rest of the run.`,
      cost: `${off.price} credits`,
      onClick: () => {
        const i = eventState.marketBasket.indexOf(off);
        if (i >= 0) eventState.marketBasket.splice(i, 1);
        else {
          if (marketBasketCost() + off.price > coins) return;
          eventState.marketBasket.push(off);
        }
        refresh();
      }
    });
    body.appendChild(el);
  });

  total.className = 'ev-total';
  body.appendChild(total);
  refresh();
}
function marketBasketCost() {
  return (eventState.marketBasket || []).reduce((s, o) => s + o.price, 0);
}
function confirmMarket() {
  const basket = eventState.marketBasket || [];
  const cost = marketBasketCost();
  if (!basket.length || cost > coins) { closeEvent(); return; }
  coins -= cost;
  updateCoinsUI?.();
  basket.forEach(off => {
    // The effect lands on the COPY, never on the card it was copied from -
    // otherwise buying a 9♦ would buff the 9♦ already in your deck and the new
    // one would arrive plain. copyCardToDeck hands back the card it made, which
    // is the only way to get this right when the basket holds two of one face.
    const made = copyCardToDeck(off.card);
    if (made) enhanceCardKey(cardId(made), off.boon.e);
  });
  showMessage(`${basket.length} card${basket.length > 1 ? 's' : ''} added to your deck`, 'var(--gold)');
  render();
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: DECK TRIM  (id 'deck_trim', r211)
// ══════════════════════════════════════════════
// The counterweight to the Card Market, and the answer to "removal comes up too
// rarely". Clean Up gives you one cut on the rare occasions it turns up; this is
// a whole screen of them, priced by size, and the smallest one is free so the
// event is never a dead draw at 0 credits.
//
// Unlike Clean Up's four-different-ranks rule this puts no shape on the cut - you
// pick whatever you want gone. The price is the constraint.
function renderDeckTrim() {
  const body = document.getElementById('event-body');
  const pool = springCuttableCards();          // shared with Clean Up
  if (!pool.length) {
    body.innerHTML = evEmptyHTML('Nothing in the draw pile to cut.');
    setEventConfirm(true); return;
  }
  eventState.trimTier = null;
  eventState.trimCards = [];
  body.appendChild(evNote('Every card you cut is gone for the rest of the run. The fewer cards in the deck, the more often the ones you kept come round.'));

  BAL.deck_trim.tiers.forEach(tier => {
    const afford = coins >= tier.price;
    const enough = pool.length >= tier.cards;
    const el = makeChoiceEl({
      icon:'✂️',
      rarity: tier.cards >= 4 ? 'epic' : (tier.cards >= 2 ? 'rare' : 'common'),
      name: `Cut ${tier.cards} card${tier.cards > 1 ? 's' : ''}`,
      desc: tier.price === 0
        ? 'Free. Pick one card and it leaves the run.'
        : `Pick ${tier.cards} cards and they leave the run.`,
      cost: tier.price === 0 ? 'No charge' : `${tier.price} credits`,
      cls: (afford && enough) ? '' : 'locked',
      onClick: () => {
        if (!afford || !enough) return;
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.trimTier = tier;
        eventState.trimCards = [];
        showTrimCardPicker(pool, tier);
        setEventConfirm(false);
      }
    });
    body.appendChild(el);
  });
}

function showTrimCardPicker(pool, tier) {
  document.getElementById('trim-card-picker')?.remove();
  const body = document.getElementById('event-body');
  // Label inside the wrapper, same reason as every other rebuildable picker here.
  const wrap = document.createElement('div');
  wrap.id = 'trim-card-picker';
  const label = evLabel('');
  wrap.appendChild(label);
  const chips = document.createElement('div');
  chips.className = 'ev-cardchips';
  const refresh = () => {
    const n = eventState.trimCards.length;
    label.textContent = `PICK ${tier.cards} CARD${tier.cards > 1 ? 'S' : ''} TO CUT  ·  ${n}/${tier.cards}`;
    chips.querySelectorAll('.ev-cardchip').forEach(chip =>
      chip.classList.toggle('picked', eventState.trimCards.includes(chip._card)));
    setEventConfirm(n === tier.cards);
  };
  pool.forEach(card => {
    const chip = document.createElement('div');
    chip.className = 'ev-cardchip' + (['♥','♦'].includes(card.suit) ? ' red' : '');
    chip.textContent = card.rank + card.suit;
    chip._card = card;
    chip.addEventListener('click', () => {
      const i = eventState.trimCards.indexOf(card);
      if (i >= 0) eventState.trimCards.splice(i, 1);
      else if (eventState.trimCards.length < tier.cards) eventState.trimCards.push(card);
      refresh();
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  body.appendChild(wrap);
  refresh();
}

function confirmDeckTrim() {
  const tier = eventState.trimTier;
  if (!tier || (eventState.trimCards || []).length !== tier.cards) { closeEvent(); return; }
  if (coins < tier.price) { closeEvent(); return; }
  coins -= tier.price;
  updateCoinsUI?.();
  let cut = 0;
  eventState.trimCards.forEach(card => {
    const idx = drawPile.indexOf(card);      // by identity, never by face
    if (idx >= 0) { drawPile.splice(idx, 1); cut++; }
  });
  if (cut) { expectedDeckTotal -= cut; updateDeckHud?.(); }
  showMessage(`${cut} card${cut === 1 ? '' : 's'} cut from the deck`, 'var(--gold)');
  render();
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: THE CLEAN SLATE (r229) - undo what the grids did to you
// ══════════════════════════════════════════════
// Reward-grid penalties and card curses are the only PERMANENT damage a run
// takes, and nothing in the game removed them. There is no global HP here, so a
// campfire that heals would have nothing to heal - what a run actually
// accumulates is liabilities, and this is their counterplay.
//
// Every option reads the SAME live globals the penalties are stored in
// (js/combos-aim.js, js/deck-grid.js), so an option that has nothing to do says
// so rather than taking a choice and doing nothing.
const CLEAN_SLATE_FIXES = [
  { id:'goal',   icon:'📉', rarity:'epic',
    name:'Quota revision',
    has:  () => goalPenaltyMult > 1,
    desc: () => `Every future goal is raised ${Math.round((goalPenaltyMult - 1) * 100)}%. Put it back to normal.`,
    fix:  () => { goalPenaltyMult = 1; return 'Goals back to normal'; } },
  { id:'time',   icon:'⏱', rarity:'rare',
    name:'Shortened rounds',
    has:  () => roundPenaltySeconds > 0,
    desc: () => `Rounds start ${roundPenaltySeconds}s short. Give the seconds back.`,
    fix:  () => { const n = roundPenaltySeconds; roundPenaltySeconds = 0; return `+${n}s back on every round`; } },
  { id:'play',   icon:'🎟', rarity:'rare',
    name:'Play surcharge',
    has:  () => extraPlayCostPerm > 0,
    desc: () => `Playing a hand costs ${extraPlayCostPerm}s extra. Clear it.`,
    fix:  () => { extraPlayCostPerm = 0; return 'Playing is free again'; } },
  { id:'curses', icon:'🩸', rarity:'epic',
    name:'Cursed cards',
    has:  () => Object.keys(cardCurses || {}).length > 0,
    desc: () => `${Object.keys(cardCurses).length} card${Object.keys(cardCurses).length === 1 ? ' is' : 's are'} cursed. Lift all of them.`,
    fix:  () => { const n = Object.keys(cardCurses).length; cardCurses = {}; return `${n} curse${n === 1 ? '' : 's'} lifted`; } },
  { id:'dead',   icon:'⬛', rarity:'rare',
    name:'Dead cells',
    has:  () => (deadCells && deadCells.size > 0),
    desc: () => `${deadCells.size} cell${deadCells.size === 1 ? '' : 's'} on the board score nothing. Bring them back.`,
    fix:  () => { const n = deadCells.size; deadCells = new Set(); return `${n} cell${n === 1 ? '' : 's'} restored`; } },
  { id:'freeze', icon:'❄', rarity:'common',
    name:'Interest freeze',
    has:  () => interestFreezeRounds > 0,
    desc: () => `Interest is frozen for ${interestFreezeRounds} more round${interestFreezeRounds === 1 ? '' : 's'}. Thaw it.`,
    fix:  () => { interestFreezeRounds = 0; return 'Interest paying again'; } },
  { id:'payout', icon:'🚫', rarity:'common',
    name:'Withheld payout',
    has:  () => !!skipNextPayout,
    desc: () => 'Your next payout pays nothing. Release it.',
    fix:  () => { skipNextPayout = false; return 'Payout released'; } },
];

function renderCleanSlate() {
  const body = document.getElementById('event-body');
  const live = CLEAN_SLATE_FIXES.filter(f => { try { return f.has(); } catch (e) { return false; } });
  if (!live.length) {
    // Nothing owed. Pay instead of offering a screen full of things that would
    // do nothing - an event that cannot act should say so and still be worth
    // having landed on.
    body.innerHTML = evEmptyHTML('Nothing on your record. Take the credit instead.');
    eventState.slateNone = true;
    setEventConfirm(true); return;
  }
  eventState.slatePick = null;
  body.appendChild(evNote('One of these comes off your record for good.'));
  live.forEach(f => {
    const el = makeChoiceEl({
      icon: f.icon, rarity: f.rarity, name: f.name, desc: f.desc(),
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.slatePick = f;
        setEventConfirm(true);
      }
    });
    body.appendChild(el);
  });
}

function confirmCleanSlate() {
  if (eventState.slateNone) {
    coins += BAL.clean_slate.consolation_credits;
    updateCoinsUI?.();
    showMessage(`+${BAL.clean_slate.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.slatePick) {
    let say = '';
    try { say = eventState.slatePick.fix(); } catch (e) {}
    // The board shows dead cells and curses, so it has to be repainted for the
    // fix to be visible rather than only true.
    if (typeof render === 'function' && typeof gridData !== 'undefined' && gridData[0]) {
      try { render(); } catch (e) {}
    }
    updateScoreUI?.();
    showMessage(say || 'Cleared', 'var(--gold)');
  }
  closeEvent();
}
