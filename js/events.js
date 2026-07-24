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
  SLEIGHT_POOL.filter(j => !ownedSleights.has(j.id) && j.tags?.some(t => theme.sleightTags.includes(t)))
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
  lbl.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px';
  lbl.textContent = 'CHOOSE A THEME';
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
  eventState.itemsContainer.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:10px;margin-top:8px;';
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
    c.innerHTML = '<div style="color:var(--cream-dim);font-size:11px;text-align:center">Nothing available for this theme.</div>';
    setEventConfirm(true); // allow skip
    return;
  }
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim)';
  lbl.textContent = 'CHOOSE A REWARD';
  c.appendChild(lbl);
  pool.forEach(item => {
    const el = makeChoiceEl({ icon:item.icon, rarity:item.rarity, name:item.name, desc:item.desc,
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
    renderKnackList?.();
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
  // Trade 1: always available — pay coins for a legendary Trick
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
        acquiredKnacks = acquiredKnacks.filter(x=>x.id!==t.id); renderKnackList?.();
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
      trades.push({ icon:'🍂', name:`−1 Discard/round: ${pick.name}`, desc:`Permanently lose 1 discard per round. Gain the legendary "${pick.name}". ${pick.desc}`, rarity:'legendary',
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
      const eligible = SLEIGHT_POOL.filter(x=>!grantedSleightIds.has(x.id) && x.rarity===nextRarity);
      if (eligible.length > 0) {
        const pick = eligible[Math.floor(Math.random()*eligible.length)];
        trades.push({ icon:'🔁', name:`Upgrade Sleight: ${pick.emoji} ${pick.name}`, desc:`Lose "${j.name}". Gain the ${nextRarity} sleight "${pick.name}". ${pick.desc}`, rarity:nextRarity,
          apply: () => { gridData[entry.r][entry.c]=null; grantedSleightIds.delete(j.id); grantSleight(pick); showMessage(`Sleight upgraded!`, 'var(--gold)'); render(); }
        });
      }
    }
  }
  // Always-available fallback
  if (trades.length === 0) {
    trades.push({ icon:'⏱', name:'−10s/round: +1 Swap & Discard', desc:'Permanently lose 10s of round time. Permanently gain +1 swap and +1 discard per round.', rarity:'rare',
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
    if (tp.length>0) { const p=tp[Math.floor(Math.random()*tp.length)]; return { icon:p.emoji, name:p.name, desc:p.desc, cls:'revealed-good', apply:()=>{acquiredKnacks.push({...p});renderKnackList?.();showMessage(`+ ${p.name}`,'var(--gold)');} }; }
  }
  if (tier === 'good') {
    const pool = TRICK_POOL.filter(b=>!ownedTrick.has(b.id) && (b.tier==='rare'||b.tier==='common'));
    if (pool.length>0) { const p=pool[Math.floor(Math.random()*pool.length)]; return { icon:'★', name:p.name, desc:p.desc, cls:'revealed-good', apply:()=>injectTrickAfterReward(p) }; }
  }
  if (tier === 'bad') {
    const bads = [
      { icon:'☠', name:'−1 Discard', desc:'Lose 1 discard this round.', cls:'revealed-bad', apply:()=>{discards=Math.max(0,discards-1);render();showMessage('−1 Discard','var(--red)');} },
      { icon:'☁', name:'−8s Round',  desc:'Lose 8 seconds right now.',  cls:'revealed-bad', apply:()=>{roundSeconds=Math.max(1,roundSeconds-8);updateClockUI();showMessage('−8s','var(--red)');} },
      { icon:'✖', name:'Nothing',    desc:'This door was empty.',        cls:'revealed-bad', apply:()=>{showMessage('Empty door','var(--cream-dim)');} },
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
  label.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:8px';
  label.textContent = 'CHOOSE A DOOR';
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
    // Double or Nothing result
    const won = Math.random() < 0.6;
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
  info.style.cssText = 'font-size:12px;color:var(--cream-dim);font-family:Crimson Pro,serif;text-align:center;max-width:300px;margin-bottom:10px;line-height:1.5';
  info.textContent = '60% chance: keep your Trick and gain another. 40% chance: lose your Trick. Choose one to stake.';
  body.appendChild(info);
  const ownedTrick = acquiredTricks || [];
  if (ownedTrick.length === 0) {
    body.innerHTML += '<div style="color:var(--cream-dim);font-size:11px">You have no Tricks to stake.</div>';
    setEventConfirm(true); return;
  }
  ownedTrick.forEach(trick => {
    const el = makeChoiceEl({ icon:'★', rarity:trick.tier, name:trick.name, desc:trick.desc,
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
function allDeckCards() {
  const out = [];
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cd = gridData[r]?.[c];
      if (cd && !cd._isTrick && !cd._isSleight && !cd._isStone && cd.rank) out.push(cd);
    }
  drawPile.forEach(cd => { if (cd && !cd._isSleight && cd.rank) out.push(cd); });
  playedPile.forEach(cd => { if (cd && !cd._isSleight && cd.rank) out.push(cd); });
  return out;
}
function randomDeckCard() {
  const all = allDeckCards();
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}
// Apply a permanent enhancement to every card sharing this rank/suit key.
function enhanceCardKey(key, e) {
  if (e.pips)   permPips[key]   = (permPips[key]   || 0) + e.pips;
  if (e.mult)   permMult[key]   = (permMult[key]   || 0) + e.mult;
  if (e.xpips)  permXPips[key]  = (permXPips[key]  || 1) * e.xpips;
  if (e.xmult)  permXMult[key]  = (permXMult[key]  || 1) * e.xmult;
  if (e.retrig) permRetrig[key] = (permRetrig[key] || 0) + e.retrig;
  if (e.subpips) permPips[key]  = Math.max(0, (permPips[key] || 0) - e.subpips);
}
function copyCardToDeck(card) {
  if (!card) return;
  drawPile.push({ rank: card.rank, suit: card.suit });
  drawPile = shuffle(drawPile);
  expectedDeckTotal++;
  updateDeckHud?.();
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

// ══════════════════════════════════════════════
// EVENT: THE FORGE  (this-or-that card enhancement)
// ══════════════════════════════════════════════
function renderForge() {
  const body = document.getElementById('event-body');
  const all = allDeckCards();
  if (!all.length) {
    body.innerHTML = '<div style="color:var(--cream-dim);font-size:11px;text-align:center">No cards to enhance.</div>';
    setEventConfirm(true); return;
  }
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px';
  lbl.textContent = 'CHOOSE ONE ENHANCEMENT';
  body.appendChild(lbl);

  // Pick 3 distinct random target cards (or reuse if deck is tiny)
  const sh = a => { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
  const picks = sh(all);
  const target = i => picks[i % picks.length];

  const boons = [
    (t) => ({ icon:'🔨', rarity:'common', name:`Temper ${cardLabel(t)}`, desc:`${cardLabel(t)} permanently gains +30 pips.`,
              apply:()=>{ enhanceCardKey(cardKey(t.rank,t.suit), {pips:30}); showMessage(`${cardLabel(t)} +30 pips`, 'var(--gold)'); } }),
    (t) => ({ icon:'⚒️', rarity:'rare', name:`Sharpen ${cardLabel(t)}`, desc:`${cardLabel(t)} permanently scores ×2 pips.`,
              apply:()=>{ enhanceCardKey(cardKey(t.rank,t.suit), {xpips:2}); showMessage(`${cardLabel(t)} ×2 pips`, 'var(--gold)'); } }),
    (t) => ({ icon:'✨', rarity:'common', name:`Empower ${cardLabel(t)}`, desc:`${cardLabel(t)} permanently gains +5 mult.`,
              apply:()=>{ enhanceCardKey(cardKey(t.rank,t.suit), {mult:5}); showMessage(`${cardLabel(t)} +5 mult`, 'var(--gold)'); } }),
    (t) => ({ icon:'💥', rarity:'epic', name:`Overcharge ${cardLabel(t)}`, desc:`${cardLabel(t)} permanently scores ×2 mult.`,
              apply:()=>{ enhanceCardKey(cardKey(t.rank,t.suit), {xmult:2}); showMessage(`${cardLabel(t)} ×2 mult`, 'var(--gold)'); } }),
    (t) => ({ icon:'🔁', rarity:'rare', name:`Echo ${cardLabel(t)}`, desc:`${cardLabel(t)} permanently scores its pips twice.`,
              apply:()=>{ enhanceCardKey(cardKey(t.rank,t.suit), {retrig:1}); showMessage(`${cardLabel(t)} replays`, 'var(--gold)'); } }),
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
    trades.push({ icon:'⚖️', rarity:'rare', name:'Blood Price', desc:'Remove 2 random cards from your deck. A random remaining card permanently scores ×3 pips.',
      apply:()=>{ removeRandomDeckCards(2); const t=randomDeckCard(); if(t){ enhanceCardKey(cardKey(t.rank,t.suit), {xpips:3}); showMessage(`${cardLabel(t)} ×3 pips`, 'var(--gold)'); } } });
  }
  trades.push({ icon:'🕯️', rarity:'rare', name:'Time Tithe', desc:'Permanently lose 8s of round time. Copy a random card; that card permanently gains +20 pips.',
    apply:()=>{ limits.round_time.current=Math.max(30, limits.round_time.current-8); const t=randomDeckCard(); if(t){ copyCardToDeck(t); enhanceCardKey(cardKey(t.rank,t.suit), {pips:20}); showMessage(`Copied ${cardLabel(t)} · +20 pips`, 'var(--gold)'); } } });
  if (coins >= 10) {
    trades.push({ icon:'🪙', rarity:'epic', name:'The Toll', desc:'Lose 10 credits. A random card permanently replays and scores ×2 mult.',
      apply:()=>{ coins-=10; updateCoinsUI(); const t=randomDeckCard(); if(t){ enhanceCardKey(cardKey(t.rank,t.suit), {retrig:1, xmult:2}); showMessage(`${cardLabel(t)} replay + ×2 mult`, 'var(--gold)'); } } });
  }
  if (offGrid >= 3) {
    trades.push({ icon:'🗑️', rarity:'epic', name:'Purge', desc:'Remove 3 random cards from your deck. Gain +2 permanent swaps and a random card gains +40 pips.',
      apply:()=>{ removeRandomDeckCards(3); limits.swaps.current+=2; swaps=Math.min(swaps+2, limits.swaps.current); const t=randomDeckCard(); if(t){ enhanceCardKey(cardKey(t.rank,t.suit), {pips:40}); showMessage(`+2 swaps · ${cardLabel(t)} +40 pips`, 'var(--gold)'); } } });
  }
  // Always-available fallback
  if (trades.length === 0) {
    trades.push({ icon:'🕯️', rarity:'common', name:'Last Ember', desc:'Lose 5s of round time. A random card permanently gains +15 pips.',
      apply:()=>{ limits.round_time.current=Math.max(30, limits.round_time.current-5); const t=randomDeckCard(); if(t){ enhanceCardKey(cardKey(t.rank,t.suit), {pips:15}); showMessage(`${cardLabel(t)} +15 pips`, 'var(--gold)'); } } });
  }
  const a=[...trades]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a.slice(0,3);
}
function renderBargain() {
  eventState.bargainTrades = buildBargainTrades();
  eventState.bargainChoice = null;
  const body = document.getElementById('event-body');
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px';
  lbl.textContent = 'PAY THE PRICE';
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
// EVENT: THE WAGER  (coin flip — get more or lose more)
// ══════════════════════════════════════════════
function renderWager() {
  const body = document.getElementById('event-body');
  if (!allDeckCards().length) {
    body.innerHTML = '<div style="color:var(--cream-dim);font-size:11px;text-align:center">No cards to wager.</div>';
    setEventConfirm(true); return;
  }
  eventState.wagerStake = null;
  eventState.wagerResolved = false;
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px';
  lbl.textContent = 'CHOOSE YOUR STAKE — THEN FLIP';
  body.appendChild(lbl);
  const stakes = [
    { icon:'🪙', rarity:'common', name:'Modest — 70%', desc:'Heads: a random card scores ×2 pips. Tails: that card loses 10 pips.', odds:0.70,
      win:(t)=>{ enhanceCardKey(cardKey(t.rank,t.suit), {xpips:2}); return `${cardLabel(t)} ×2 pips!`; },
      lose:(t)=>{ enhanceCardKey(cardKey(t.rank,t.suit), {subpips:10}); return `${cardLabel(t)} −10 pips.`; } },
    { icon:'🎲', rarity:'rare', name:'Bold — 55%', desc:'Heads: a random card scores ×3 pips and replays. Tails: that card is removed from your deck.', odds:0.55,
      win:(t)=>{ enhanceCardKey(cardKey(t.rank,t.suit), {xpips:3, retrig:1}); return `${cardLabel(t)} ×3 pips + replay!`; },
      lose:(t)=>{ removeRandomDeckCards(1); return `${cardLabel(t)} lost.`; } },
    { icon:'💀', rarity:'epic', name:'Reckless — 40%', desc:'Heads: a random card scores ×4 pips, ×2 mult and replays. Tails: 2 random cards are removed.', odds:0.40,
      win:(t)=>{ enhanceCardKey(cardKey(t.rank,t.suit), {xpips:4, xmult:2, retrig:1}); return `${cardLabel(t)} ×4 pips, ×2 mult + replay!`; },
      lose:(t)=>{ removeRandomDeckCards(2); return `2 cards lost.`; } },
  ];
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
  showMessage(won ? `HEADS — ${msg}` : `TAILS — ${msg}`, won ? 'var(--gold)' : 'var(--red)');
  setEventConfirm(false);
  document.getElementById('event-skip').textContent = 'Continue';
}

// ══════════════════════════════════════════════
// EVENT: WANDERING MERCHANT
// ══════════════════════════════════════════════
function renderMerchant() {
  // 2 legendary/rare Tricks + 1 sleight or knack — all free (it's a gift event, not a shop)
  const ownedTrick     = new Set((acquiredTricks||[]).map(b=>b.id));
  const ownedKnacks = new Set((acquiredKnacks ||[]).map(t=>t.id));
  const legends = TRICK_POOL.filter(b=>!ownedTrick.has(b.id) && (b.tier==='legendary'||b.tier==='rare'));
  const knacks  = KNACK_POOL.filter(t=>!ownedKnacks.has(t.id));
  const sleights  = SLEIGHT_POOL.filter(j=>!grantedSleightIds.has(j.id) && (j.rarity==='rare'||j.rarity==='legendary'));
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
  lbl.style.cssText = 'font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px';
  lbl.textContent = 'TAKE ONE — FREE OF CHARGE';
  body.appendChild(lbl);
  if (eventState.merchantItems.length === 0) {
    body.innerHTML += '<div style="color:var(--cream-dim);font-size:11px;text-align:center">The merchant has nothing new to offer.</div>';
    setEventConfirm(true); return;
  }
  eventState.merchantItems.forEach(item => {
    const el = makeChoiceEl({ icon:item.icon, rarity:item.rarity, name:item.name, desc:item.desc,
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
  else if (item.type === 'knack') { acquiredKnacks.push({...item.payload}); renderKnackList?.(); showMessage(`+ ${item.name}`,'var(--gold)'); }
  else if (item.type === 'sleight') { grantSleight(item.payload); }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: ALTAR
// ══════════════════════════════════════════════
function renderAltar() {
  const offerings = [
    { icon:'🕯️', name:'3-Round Boost', rarity:'rare',
      desc:'Sacrifice 2 discards now. For the next 3 rounds, all hands score +3 mult.',
      cost:'−2 Discards',
      canTake: () => discards >= 2,
      apply: () => { discards = Math.max(0, discards-2); altarEffects.push({ type:'mult_boost', value:3, roundsLeft:3 }); showMessage('Altar: +3 mult for 3 rounds', 'var(--gold)'); render(); }
    },
    { icon:'⌛', name:'Time Offering', rarity:'rare',
      desc:'Sacrifice 10 credits. Next 2 rounds begin with +20 extra seconds.',
      cost:'−10 Credits',
      canTake: () => coins >= 10,
      apply: () => { coins -= 10; updateCoinsUI(); altarEffects.push({ type:'time_boost', value:20, roundsLeft:2 }); showMessage('Altar: +20s for 2 rounds', 'var(--gold)'); }
    },
    { icon:'🌑', name:'Dark Bargain', rarity:'legendary',
      desc:'Sacrifice a random owned Trick. The next 4 rounds score at 1.5× goal — but goal is halved.',
      cost:'−1 Random Trick',
      canTake: () => acquiredTricks.length > 0,
      apply: () => {
        const i=Math.floor(Math.random()*acquiredTricks.length);
        const lost=acquiredTricks.splice(i,1)[0];
        altarEffects.push({ type:'goal_reduce', value:0.5, roundsLeft:4 });
        showMessage(`Sacrificed ${lost.name} · Goal halved × 4 rounds`, 'var(--gold)'); render();
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
// EVENT: CLEANSING SPRING
// ══════════════════════════════════════════════
function renderSpring() {
  eventState.springPick = null;
  const body = document.getElementById('event-body');
  const info = document.createElement('div');
  info.style.cssText = 'font-size:12px;color:var(--cream-dim);font-family:Crimson Pro,serif;text-align:center;max-width:300px;margin-bottom:12px;line-height:1.5;';
  info.textContent = 'Remove one card permanently from your deck — no cost, no replacement. Or restore lost resources.';
  body.appendChild(info);

  // Option A: Remove a card from draw pile
  const removeOpt = makeChoiceEl({
    icon:'🍂', rarity:'rare', name:'Purge a Card',
    desc:`Remove one card from your deck permanently. Choose from your draw pile (${drawPile.length} cards).`,
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
      removeOpt.classList.add('selected');
      eventState.springPick = 'remove_card';
      setEventConfirm(true);
      showSpringCardPicker();
    }
  });
  body.appendChild(removeOpt);

  // Option B: Restore swaps and discards to max
  const restoreOpt = makeChoiceEl({
    icon:'💧', rarity:'common', name:'Cleanse Resources',
    desc:'Restore swaps and discards to their maximum for this round.',
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
      restoreOpt.classList.add('selected');
      eventState.springPick = 'restore_resources';
      setEventConfirm(true);
      document.getElementById('spring-card-picker')?.remove();
    }
  });
  body.appendChild(restoreOpt);

  // Option C: Remove a random debuff from reward history (noop if none, but always show)
  const cleanseOpt = makeChoiceEl({
    icon:'✨', rarity:'rare', name:'Cleanse a Debuff',
    desc:'Reverse one of the permanent debuffs applied in previous reward grids (+1 Discard or +5s restored).',
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e=>e.classList.remove('selected'));
      cleanseOpt.classList.add('selected');
      eventState.springPick = 'cleanse_debuff';
      setEventConfirm(true);
      document.getElementById('spring-card-picker')?.remove();
    }
  });
  body.appendChild(cleanseOpt);
  eventState.cardToRemove = null;
}

function showSpringCardPicker() {
  const existing = document.getElementById('spring-card-picker');
  if (existing) existing.remove();
  const body = document.getElementById('event-body');
  const wrap = document.createElement('div');
  wrap.id = 'spring-card-picker';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px;max-width:340px';
  const pool = [...drawPile];
  const seen = new Set();
  pool.forEach((card, i) => {
    const key = card.rank + card.suit;
    if (seen.has(key)) return; seen.add(key);
    const chip = document.createElement('div');
    chip.style.cssText = `padding:4px 8px;border-radius:5px;border:1px solid var(--gold-dim);font-family:Cinzel,serif;font-size:11px;cursor:pointer;background:#1a1410;color:${['♥','♦'].includes(card.suit)?'#c0392b':'var(--cream)'}`;
    chip.textContent = card.rank + card.suit;
    chip.addEventListener('click', () => {
      wrap.querySelectorAll('div').forEach(c=>c.style.boxShadow='');
      chip.style.boxShadow = '0 0 8px rgba(201,168,76,0.6)';
      chip.style.borderColor = 'var(--gold)';
      eventState.cardToRemove = card;
    });
    wrap.appendChild(chip);
  });
  body.appendChild(wrap);
}

function confirmSpring() {
  switch (eventState.springPick) {
    case 'remove_card':
      if (eventState.cardToRemove) {
        const c = eventState.cardToRemove;
        const idx = drawPile.findIndex(x=>x.rank===c.rank&&x.suit===c.suit);
        if (idx >= 0) { drawPile.splice(idx,1); showMessage(`${c.rank}${c.suit} removed from deck`, 'var(--gold)'); }
      } break;
    case 'restore_resources':
      swaps = limits.swaps.current;
      discards = limits.discards.current;
      render(); showMessage('Swaps & Discards restored!', 'var(--gold)'); break;
    case 'cleanse_debuff':
      // Reverse one small debuff — restore a discard or 5s
      discards = Math.min(discards + 1, limits.discards.current + 2);
      render(); showMessage('+1 Discard restored', 'var(--gold)'); break;
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: TWIN PATH
// ══════════════════════════════════════════════
function renderTwinPath() {
  const ownedTrick = new Set((acquiredTricks||[]).map(b=>b.id));
  const pool = TRICK_POOL.filter(b=>!ownedTrick.has(b.id));
  const sh = a => { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
  const picks = sh(pool).slice(0,2);
  const shadow = [
    { icon:'☁', name:'−5s This Round', desc:'Lose 5 seconds immediately.',     apply:()=>{roundSeconds=Math.max(1,roundSeconds-5);updateClockUI();showMessage('−5s (Twin Path shadow)','var(--red)');} },
    { icon:'☠', name:'−1 Discard',    desc:'Lose 1 discard permanently.',      apply:()=>{limits.discards.current=Math.max(1,limits.discards.current-1);discards=Math.min(discards,limits.discards.current);render();showMessage('−1 Discard (Twin Path shadow)','var(--red)');} },
    { icon:'✖', name:'−1 Swap',       desc:'Lose 1 swap permanently.',         apply:()=>{limits.swaps.current=Math.max(0,limits.swaps.current-1);swaps=Math.min(swaps,limits.swaps.current);render();showMessage('−1 Swap (Twin Path shadow)','var(--red)');} },
    { icon:'🌑', name:'Goal +15%',     desc:'This round\'s goal increases 15%.', apply:()=>{roundGoal=Math.floor(roundGoal*1.15);showMessage('Goal +15% (Twin Path shadow)','var(--red)');} },
  ];
  eventState.shadow = shadow[Math.floor(Math.random()*shadow.length)];
  eventState.twinTricks = picks;
  eventState.twinAccepted = false;
  const body = document.getElementById('event-body');

  const lbl = document.createElement('div');
  lbl.style.cssText='font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px';
  lbl.textContent='YOU GAIN BOTH — OR NEITHER';
  body.appendChild(lbl);

  picks.forEach(trick => {
    body.appendChild(makeChoiceEl({ icon:'★', rarity:trick.tier, name:trick.name, desc:trick.desc }));
  });

  const shadowEl = makeChoiceEl({ icon: eventState.shadow.icon, name: eventState.shadow.name, desc: eventState.shadow.desc, cls:'debuff' });
  shadowEl.style.marginTop = '6px';
  const shadowLbl = document.createElement('div');
  shadowLbl.style.cssText='font-family:Cinzel,serif;font-size:9px;letter-spacing:2px;color:var(--red);margin-top:8px;margin-bottom:4px';
  shadowLbl.textContent='THE SHADOW (always applies)';
  body.appendChild(shadowLbl);
  body.appendChild(shadowEl);

  const acceptBtn = document.createElement('button');
  acceptBtn.textContent = 'Accept Both + Shadow';
  acceptBtn.style.cssText='margin-top:12px;';
  acceptBtn.addEventListener('click', () => {
    eventState.twinAccepted = true;
    acceptBtn.disabled = true;
    setEventConfirm(true);
  });
  body.appendChild(acceptBtn);
  document.getElementById('event-skip').textContent = 'Decline (Take Nothing)';
}

function confirmTwinPath() {
  if (eventState.twinAccepted) {
    (eventState.twinTricks || []).forEach(trick => injectTrickAfterReward(trick));
    eventState.shadow.apply();
  }
  closeEvent();
}




