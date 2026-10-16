// ══════════════════════════════════════════════
// ENGINE HELPERS (r576) - read js/data/engines.js
// ══════════════════════════════════════════════
// Free Pick and Theme Draft both offer pieces of an ENGINE (pieces that feed
// each other) rather than of a tag. These are the one place "do you own it" and
// "may it be offered" are asked for an engine member, so the two events cannot
// disagree.
function engineOwns(kind, id) {
  if (kind === 'trick')   return typeof ownsTrick === 'function' && ownsTrick(id);
  if (kind === 'knack')   return typeof hasKnack === 'function' && hasKnack(id);
  if (kind === 'sleight') return typeof grantedSleightIds !== 'undefined' && grantedSleightIds.has(id);
  return false;
}
function engineDef(kind, id) {
  const pool = kind === 'trick' ? TRICK_POOL : kind === 'knack' ? KNACK_POOL : SLEIGHT_POOL;
  return pool.find(e => e.id === id) || null;
}
// May this member be OFFERED right now: not owned, in this run's pool (a mode can
// filter Tricks out of TRICK_POOL), not banned by the mode, and not a fixture.
function engineOfferable(kind, id) {
  if (engineOwns(kind, id)) return false;
  const def = engineDef(kind, id);
  if (!def) return false;
  if (typeof offerBannedGlobal === 'function' && offerBannedGlobal(id)) return false;
  if (kind === 'sleight' && !(typeof sleightOfferable === 'function' && sleightOfferable(def))) return false;
  return true;
}
const ENGINE_KINDS = [['trick', 'tricks'], ['sleight', 'sleights'], ['knack', 'knacks']];
function engineOwnedCount(eng) {
  let n = 0;
  ENGINE_KINDS.forEach(([kind, key]) => eng[key].forEach(id => { if (engineOwns(kind, id)) n++; }));
  return n;
}
// Every offerable member of an engine as an event item, optionally one kind.
function engineMissing(eng, onlyKind) {
  const out = [];
  ENGINE_KINDS.forEach(([kind, key]) => {
    if (onlyKind && kind !== onlyKind) return;
    eng[key].forEach(id => {
      if (!engineOfferable(kind, id)) return;
      const def = engineDef(kind, id);
      out.push({ type: kind, id, icon: kind === 'trick' ? '★' : def.emoji, name: def.name, desc: def.desc,
                 rarity: (kind === 'trick' ? def.tier : def.rarity) || 'common', payload: def, engine: eng });
    });
  });
  return out;
}
// One item from a list, through the shared rarity draw (js/luck.js), so Luck
// tilts an event's offers exactly as it tilts every other offer.
function enginePickOne(items) {
  if (!items.length) return null;
  return (typeof pickEntityByRarity === 'function') ? (pickEntityByRarity(items, i => i.rarity) || items[0]) : items[0];
}
// Grant an engine item through the ordinary paths. A Trick that does not fit the
// tray is refused at SELECTION (engineRefuseFull), so this never bounces one.
function engineGrant(item) {
  if (item.type === 'trick') injectTrickAfterReward(item.payload);
  else if (item.type === 'knack') { acquiredKnacks.push({ ...item.payload }); updateKnackList?.(); noteMessage(`+ ${item.name}`, 'var(--gold)'); }
  else if (item.type === 'sleight') grantSleight(item.payload);
}
// r277: a full tray refuses a Trick where you choose it, not after.
function engineRefuseFull(item) {
  if (item && item.type === 'trick' && typeof trickTrayFull === 'function' && trickTrayFull()) {
    if (typeof refuseTrickCapacity === 'function') refuseTrickCapacity();
    return true;
  }
  return false;
}
function engineTag(eng) {
  const n = engineOwnedCount(eng);
  return `${eng.icon} ${eng.name}${n ? ` · you own ${n}` : ''}`;
}

// ══════════════════════════════════════════════
// EVENT: THEME DRAFT (confluence) - r576 rework
// ══════════════════════════════════════════════
// One engine, LOCKED: no choice between themes (owner). It offers a Trick, a
// Sleight and a card carrying the engine's buff at twice the card editor's
// value; take two of the three. An engine you have started is preferred.
const CONFLUENCE_TAKE = 2;
function confluenceThemes() {
  return ENGINES.filter(e => engineMissing(e, 'trick').length && engineMissing(e, 'sleight').length);
}
// The engine's buff at twice the editor's value: flat buffs doubled, a multiplier
// buff doubles its part above x1 (x1.5 -> x2), a replay is +2.
function confluenceBuff(eng) {
  const op = FLOWR_DECK_OPS.find(o => o.id === eng.buff && o.buff) || FLOWR_DECK_OPS.find(o => o.id === 'pips');
  const base = flowrValRoll(op.buff.range);
  const v = op.buff.x ? Math.round((1 + (base - 1) * 2) * 100) / 100 : (op.id === 'replay' ? 2 : base * 2);
  return { op, v, label: flowrBuffLabel(op.buff, v), e: { [op.buff.key]: v } };
}
function renderConfluence() {
  const body = document.getElementById('event-body');
  const themes = confluenceThemes();
  if (!themes.length) { body.innerHTML = evEmptyHTML('Nothing left to draft.'); setEventConfirm(true); return; }
  const started = themes.filter(e => engineOwnedCount(e) > 0);
  const eng = evShuffle(started.length ? started : themes)[0];
  const card = evShuffle(everyDeckCard().filter(c => !(typeof isWildCard === 'function' && isWildCard(c))))[0];
  const items = [
    { ...enginePickOne(engineMissing(eng, 'trick')) },
    { ...enginePickOne(engineMissing(eng, 'sleight')) },
  ];
  if (card) {
    const b = confluenceBuff(eng);
    items.push({ type: 'card', card, buff: b, icon: b.op.icon, rarity: 'epic', name: `${card.rank}${card.suit} · ${b.label}`,
                 desc: `${card.rank}${card.suit} in your deck scores ${b.label} for good. Twice what the card editor gives.` });
  }
  eventState.themeEngine = eng;
  eventState.themeItems = items;
  eventState.themePicked = [];
  body.appendChild(evLabel(`THEME: ${eng.icon} ${eng.name.toUpperCase()}`));
  body.appendChild(evNote(eng.desc));
  const sync = () => setEventConfirm(eventState.themePicked.length === Math.min(CONFLUENCE_TAKE, items.length));
  items.forEach(item => {
    const extra = item.type === 'card' && typeof evCardChip === 'function' ? evCardChip(item.card) : '';
    const el = makeChoiceEl({ icon: item.icon, rarity: item.rarity, name: item.name, desc: item.desc, extra,
      tile: item.type === 'card' ? null : evItemTile(item),
      cost: item.type === 'card' ? 'CARD BUFF' : item.type.toUpperCase(),
      onClick: () => {
        const at = eventState.themePicked.indexOf(item);
        if (at >= 0) { eventState.themePicked.splice(at, 1); el.classList.remove('selected'); sync(); return; }
        if (eventState.themePicked.length >= CONFLUENCE_TAKE || engineRefuseFull(item)) return;
        eventState.themePicked.push(item); el.classList.add('selected'); sync();
      } });
    body.appendChild(el);
  });
  sync();
}
function confirmConfluence() {
  (eventState.themePicked || []).forEach(item => {
    if (item.type !== 'card') { engineGrant(item); return; }
    const t = resolveDeckCard(item.card);
    if (t) { enhanceCardKey(cardId(t), item.buff.e); noteMessage(`${t.rank}${t.suit}: ${item.buff.label}`, 'var(--gold)'); }
  });
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
        noteMessage('Sacrificed knack · 2 Tricks gained', 'var(--gold)'); render();
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
          noteMessage(`+ ${pick.name} · −1 Discard`, 'var(--gold)');
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
          apply: () => { gridData[entry.r][entry.c]=null; grantedSleightIds.delete(j.id); grantSleight(pick); noteMessage(`Sleight upgraded!`, 'var(--gold)'); render(); }
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
        noteMessage('−10s · +1 Swap · +1 Discard', 'var(--gold)'); render();
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
    const el = makeChoiceEl({ icon:trade.icon, rarity:trade.rarity, name:trade.name, desc:trade.desc, cost:trade.cost,
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
    if (tp.length>0) { const p=tp[Math.floor(Math.random()*tp.length)]; return { icon:p.emoji, name:p.name, desc:p.desc, cls:'revealed-good', apply:()=>{acquiredKnacks.push({...p});updateKnackList?.();noteMessage(`+ ${p.name}`,'var(--gold)');} }; }
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
  // A STAGE gate, not an entry gate: the Gamble's doors play fine with no Tricks
  // and only this double-or-nothing stage stakes one, so `gamble` is deliberately
  // absent from EVENT_REQUIRES.
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
  const _qrlBefore = qrlKindsOfKey(key).length;
  if (typeof cardAnimOn === 'function') setTimeout(() => cardAnimOn('buff', cardAnimEls([key]), { color: caBuffColor(e) }), 0);   // r445: the chosen buff look, if the card is on the board; r468: its ring takes the buff's colour
  if (e.pips)   permPips[key]   = (permPips[key]   || 0) + e.pips;
  if (e.mult)   permMult[key]   = (permMult[key]   || 0) + e.mult;
  if (e.growPips) permPipsGrow[key] = (permPipsGrow[key] || 0) + e.growPips;
  if (e.growMult) permMultGrow[key] = (permMultGrow[key] || 0) + e.growMult;
  if (e.xpips)  permXPips[key]  = (permXPips[key]  || 1) * e.xpips;
  if (e.xmult)  permXMult[key]  = (permXMult[key]  || 1) * e.xmult;
  if (e.retrig) permRetrig[key] = (permRetrig[key] || 0) + e.retrig;
  if (e.time)   permTime[key]   = (permTime[key]   || 0) + e.time;
  if (e.coin)   permCoins[key]  = (permCoins[key]  || 0) + e.coin;
  if (e.focus)  permFocus[key]  = (permFocus[key]  || 0) + e.focus;
  if (e.subpips) permPips[key]  = Math.max(0, (permPips[key] || 0) - e.subpips);
  // QRL (r484): a grant that takes a card past the quarter's buff limit is allowed, and says so.
  const _qrlAfter = qrlKindsOfKey(key).length;
  if (_qrlAfter > _qrlBefore && _qrlAfter > qrlLimit()) qrlNotice('clearance');
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
// Remove these exact CARDS from the deck (r234), by identity rather than by
// face - the deck can legitimately hold two 7 of spades (the shop sells
// duplicates), and splicing on a face match would take whichever it found
// first. A card sitting on the GRID is skipped: it is in play, not in a pile,
// and pulling it would leave a hole nothing refills.
function removeDeckCards(cards) {
  let removed = 0;
  (cards || []).forEach(card => {
    if (!card) return;
    for (const pile of [drawPile, playedPile]) {
      const i = pile.indexOf(card);
      if (i >= 0) { pile.splice(i, 1); removed++; expectedDeckTotal--; return; }
    }
  });
  updateDeckHud?.();
  return removed;
}

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
// EVENT: CARD UPGRADE (forge) - r576 rework, SCALING only
// ══════════════════════════════════════════════
// Owner: "offers you permanent scaling buffs for either pips or mult. either 10
// pips or 4 mult. and each time its triggered it gains that much more for the
// next play ... you choose two cards, one of them gets one of the buffs ... spend
// money for a chance to buff both cards."
//
// A scaling buff is the flat buff plus the same again per play ({ pips: 10,
// growPips: 10 }): it scores +10, then +20, then +30. growCardScaling
// (js/deck-grid.js) does the growing after each scoring hand.
//
// The two cards are picked from a sample of the deck drawn here, not off the
// board: between rounds the board has usually been swept back into the deck
// (r568), so there is nothing on it to point at.
const FORGE_SAMPLE = 8;
function forgeBuffs() {
  const B = BAL.forge;
  return [
    { key: 'pips', icon: '🔨', rarity: 'rare', name: `+${B.pips} pips, growing`, e: { pips: B.pips, growPips: B.pips },
      desc: `The card scores +${B.pips} pips, and ${B.pips} more every time it scores.` },
    { key: 'mult', icon: '📈', rarity: 'epic', name: `+${B.mult} mult, growing`, e: { mult: B.mult, growMult: B.mult },
      desc: `The card scores +${B.mult} mult, and ${B.mult} more every time it scores.` },
  ];
}
function renderForge() {
  const body = document.getElementById('event-body');
  const pool = allDeckCards().filter(c => !(typeof isWildCard === 'function' && isWildCard(c)));
  if (pool.length < 2) { body.innerHTML = evEmptyHTML('Not enough cards to upgrade.'); setEventConfirm(true); eventState.forgeNone = true; return; }
  const s = eventState;
  s.forgeBuff = null; s.forgeCards = []; s.forgeBoth = false; s.forgeDone = false;
  s.forgeSample = evShuffle(pool).slice(0, FORGE_SAMPLE);
  s.forgeBothPrice = priceOf(BAL.forge.both_price);
  body.appendChild(evLabel('1 · THE BUFF'));
  forgeBuffs().forEach(b => {
    const el = makeChoiceEl({ icon: b.icon, rarity: b.rarity, name: b.name, desc: b.desc, cls: 'forge-buff',
      onClick: () => {
        if (s.forgeDone) return;
        body.querySelectorAll('.forge-buff').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); s.forgeBuff = b; forgeSync();
      } });
    body.appendChild(el);
  });
  body.appendChild(evLabel('2 · TWO CARDS · ONE OF THEM GETS IT'));
  const chips = document.createElement('div'); chips.className = 'ev-cardchips'; chips.id = 'forge-chips';
  s.forgeSample.forEach(card => {
    const chip = document.createElement('span');
    chip.className = 'ev-cardchip' + (['♥', '♦'].includes(card.suit) ? ' red' : '');
    chip.textContent = (typeof cardLabel === 'function') ? cardLabel(card) : `${card.rank}${card.suit}`;
    chip._card = card;
    chip.addEventListener('click', () => {
      if (s.forgeDone) return;
      const at = s.forgeCards.indexOf(card);
      if (at >= 0) s.forgeCards.splice(at, 1);
      else if (s.forgeCards.length < 2) s.forgeCards.push(card);
      forgeSync();
    });
    chips.appendChild(chip);
  });
  body.appendChild(chips);
  const both = makeChoiceEl({ icon: '🪙', rarity: 'legendary', name: 'Try for both', cls: 'forge-both',
    desc: `A coin flip: heads, both cards get the buff. Tails, one card still does.`, cost: `${s.forgeBothPrice} credits`,
    onClick: () => {
      if (s.forgeDone || coins < s.forgeBothPrice) return;
      s.forgeBoth = !s.forgeBoth; both.classList.toggle('selected', s.forgeBoth); forgeSync();
    } });
  if (coins < s.forgeBothPrice) both.classList.add('locked');
  body.appendChild(both);
  forgeSync();
}
function forgeSync() {
  const s = eventState;
  document.querySelectorAll('#forge-chips .ev-cardchip').forEach(ch => ch.classList.toggle('picked', s.forgeCards.includes(ch._card)));
  setEventConfirm(!!s.forgeBuff && s.forgeCards.length === 2);
}
function confirmForge() {
  const s = eventState;
  if (s.forgeNone || s.forgeDone) { closeEvent(); return; }
  if (!s.forgeBuff || s.forgeCards.length !== 2) { closeEvent(); return; }
  s.forgeDone = true;
  setEventConfirm(false);
  document.getElementById('event-skip').style.display = 'none';
  const body = document.getElementById('event-body');
  const stage = document.createElement('div'); stage.className = 'evt-host'; body.appendChild(stage);
  evReveal(s.forgeBoth ? stage : document.getElementById('forge-chips'));
  const winIdx = Math.floor(Math.random() * 2);
  let bothWon = false;
  let p = Promise.resolve();
  if (s.forgeBoth && coins >= s.forgeBothPrice) {
    coins -= s.forgeBothPrice; updateCoinsUI?.();
    bothWon = Math.random() < BAL.forge.both_chance;
    const coin = evCoin(stage);
    p = coin.flip(bothWon ? 'heads' : 'tails').then(() => coin.caption(bothWon ? 'BOTH CARDS' : 'ONE CARD', bothWon ? 'win' : 'lose'));
  }
  p.then(() => {
    const chips = [...document.querySelectorAll('#forge-chips .ev-cardchip')].filter(ch => s.forgeCards.includes(ch._card));
    const winners = bothWon ? s.forgeCards.slice() : [s.forgeCards[winIdx]];
    // Alternate the highlight between the two picks, then land on the result.
    let k = 0;
    const flips = bothWon ? 0 : 7 + winIdx;
    const step = () => {
      chips.forEach((ch, i) => ch.classList.toggle('picked', bothWon || i === k % 2));
      if (k < flips) { k++; if (typeof sfxClockTick === 'function') try { sfxClockTick(); } catch (e) {} setTimeout(step, 90 + k * 18); return; }
      winners.forEach(card => { const t = resolveDeckCard(card); if (t) enhanceCardKey(cardId(t), s.forgeBuff.e); });
      chips.forEach(ch => ch.classList.toggle('picked', winners.includes(ch._card)));
      const names = winners.map(c => `${c.rank}${c.suit}`).join(' and ');
      const res = evNote(`<b>${names}</b> ${winners.length > 1 ? 'score' : 'scores'} ${s.forgeBuff.name}.`); stage.appendChild(res); evReveal(res);
      if (typeof sfxRewardGood === 'function') try { sfxRewardGood(); } catch (e) {}
      const btn = document.getElementById('event-confirm'); if (btn) { btn.textContent = 'DONE'; btn.disabled = false; }
    };
    step();
  });
}

// ══════════════════════════════════════════════
// EVENT: THE BARGAIN  (sacrifice to get more)
// ══════════════════════════════════════════════
// ── THE PRICE (r234) ─────────────────────────────────────────────────────────
//
// Every trade here is meant to be a real decision: something you value, given up
// for something you want. Two of them were not, and both failed the same way -
// the COST was free.
//
//   - "Two cards for x3 pips" took two RANDOM cards off a 52-card deck. A random
//     card is worth almost nothing, so this was a x3 pip enhancement for free,
//     and it was offered from round 1. It now needs the late half of the run AND
//     two already-buffed cards to exist, it takes those buffed cards, and it
//     pays x2 rather than x3.
//   - "Three cards for two swaps" had the same non-cost. It takes buffed cards
//     too, and is only offered when there are three to take.
//
// The gate is deliberately on cards you have INVESTED in. A run with no buffed
// cards simply is not offered these trades, and gets the time / credit ones.
//
// bargainLateHalf() is the run's midpoint: an act run is 18 rounds, so level 9
// is the turn. Survival and Flow have no end, so the same number reads as "long
// enough in that a buffed card is something you chose", which is what the gate
// is really asking.
function bargainLateHalf() { return (typeof level === 'number') && level >= 9; }

// Pick n distinct buffed cards at random.
function pickBuffedCards(n) {
  const pool = buffedDeckCards();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

function buildBargainTrades() {
  const trades = [];
  const buffed = buffedDeckCards().length;

  // The two card-cost trades. Both are gated on there being enough buffed cards
  // to make the cost bite, and the strong one is gated on the late half as well.
  if (bargainLateHalf() && buffed >= 2) {
    trades.push({ icon:'\u2696\ufe0f', rarity:'rare', name:'Two buffed cards for \u00d72 pips',
      desc:'Two of your BUFFED cards leave your deck, with everything you put into them. One of the cards left scores double pips, for the rest of the run.',
      cost:'Costs 2 buffed cards',
      apply:()=>{ const take=pickBuffedCards(2); removeDeckCards(take);
                  const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {xpips:2}); noteMessage(`${cardLabel(t)} \u00d72 pips`, 'var(--gold)'); } } });
  }

  trades.push({ icon:'\ud83d\udd6f\ufe0f', rarity:'rare', name:'Eight seconds for a copy',
    desc:'Lose 8s of round time, permanently. A random card is copied into your deck, and that card scores 20 more pips from now on.',
    apply:()=>{ limits.round_time.current=Math.max(30, limits.round_time.current-8); const t=randomDeckCard(); if(t){ copyCardToDeck(t); enhanceCardKey(cardId(t), {pips:20}); noteMessage(`Copied ${cardLabel(t)} \u00b7 +20 pips`, 'var(--gold)'); } } });

  // The credit trade was 10, which a mid-run wallet pays without noticing. It is
  // the one cost here that is plainly legible, so it is the one worth pricing
  // properly: 18 base, and it rides PRICE_MULT like every other sink.
  {
    const _replayCost = priceOf(18);
    if (coins >= _replayCost) {
      trades.push({ icon:'\ud83e\ude99', rarity:'epic', name:`${_replayCost} credits for a replay`,
        desc:`Lose ${_replayCost} credits. A random card plays twice and doubles the mult, for the rest of the run.`,
        cost:`Costs ${_replayCost} credits`,
        apply:()=>{ coins-=_replayCost; updateCoinsUI(); const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {retrig:1, xmult:2}); noteMessage(`${cardLabel(t)} replay + \u00d72 mult`, 'var(--gold)'); } } });
    }
  }

  if (buffed >= 3) {
    trades.push({ icon:'\ud83d\uddd1\ufe0f', rarity:'epic', name:'Three buffed cards for two swaps',
      desc:'Three of your BUFFED cards leave your deck, with everything you put into them. Gain +2 swaps per round permanently, and a random card scores 40 more pips.',
      cost:'Costs 3 buffed cards',
      apply:()=>{ const take=pickBuffedCards(3); removeDeckCards(take);
                  limits.swaps.current+=2; swaps=Math.min(swaps+2, limits.swaps.current); knockOnLimit('swaps');
                  const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {pips:40}); noteMessage(`+2 swaps \u00b7 ${cardLabel(t)} +40 pips`, 'var(--gold)'); } } });
  }

  // Always-available fallback
  if (trades.length === 0) {
    trades.push({ icon:'\ud83d\udd6f\ufe0f', rarity:'common', name:'Five seconds for +15 pips', desc:'Lose 5s of round time, permanently. A random card scores 15 more pips from now on.',
      apply:()=>{ limits.round_time.current=Math.max(30, limits.round_time.current-5); const t=randomDeckCard(); if(t){ enhanceCardKey(cardId(t), {pips:15}); noteMessage(`${cardLabel(t)} +15 pips`, 'var(--gold)'); } } });
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
    const el = makeChoiceEl({ icon:trade.icon, rarity:trade.rarity, name:trade.name, desc:trade.desc, cost:trade.cost,
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
  if (!eventEligible('wager')) {
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
  // r576 rework (owner): offer only the MISSING PIECES OF AN ENGINE you have
  // started - "if you have something that gives replays, give a knack that buffs
  // based on replays". One offer per engine, the engines you have the most of
  // first. With fewer than three engines started, the rest are starters from
  // engines you have not touched. Free: take one.
  const engines = evShuffle(ENGINES).map(e => ({ e, n: engineOwnedCount(e), miss: engineMissing(e) }))
    .filter(x => x.miss.length);
  const started = engines.filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const fresh   = engines.filter(x => x.n === 0);
  const items = [];
  const take = list => list.forEach(x => {
    if (items.length >= 3) return;
    const pick = enginePickOne(x.miss.filter(m => !items.some(i => i.id === m.id)));
    if (pick) items.push(pick);
  });
  take(started); take(fresh);
  eventState.merchantItems = items;
  eventState.merchantPick  = null;
  const body = document.getElementById('event-body');
  body.appendChild(evLabel(started.length ? 'PIECES OF YOUR ENGINES · TAKE ONE' : 'TAKE ONE'));
  if (!items.length) { body.innerHTML += evEmptyHTML('Nothing here you do not already own.'); setEventConfirm(true); return; }
  items.forEach(item => {
    const el = makeChoiceEl({ icon: item.icon, rarity: item.rarity, name: item.name, desc: item.desc,
      tile: evItemTile(item), cost: engineTag(item.engine),
      onClick: () => {
        if (engineRefuseFull(item)) return;
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.merchantPick = item;
        setEventConfirm(true);
      } });
    body.appendChild(el);
  });
}

function confirmMerchant() {
  const item = eventState.merchantPick;
  if (item) engineGrant(item);
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
      apply: () => { discards = Math.max(0, discards-2); altarEffects.push({ type:'mult_boost', value:3, roundsLeft:3 }); noteMessage('+3 mult for 3 rounds', 'var(--gold)'); render(); }
    },
    { icon:'⌛', name:'+20s for 2 rounds', rarity:'rare',
      desc:'Pay 10 credits. The next 2 rounds start with 20 extra seconds on the clock.',
      cost:'Costs 10 credits',
      canTake: () => coins >= 10,
      apply: () => { coins -= 10; updateCoinsUI(); altarEffects.push({ type:'time_boost', value:20, roundsLeft:2 }); noteMessage('+20s for 2 rounds', 'var(--gold)'); }
    },
    { icon:'🌑', name:'Half goal for 4 rounds', rarity:'legendary',
      desc:'Give up one of your Tricks, chosen at random. The next 4 rounds need only half the score.',
      cost:'Costs 1 random Trick',
      canTake: () => acquiredTricks.length > 0,
      apply: () => {
        const i=Math.floor(Math.random()*acquiredTricks.length);
        const lost=acquiredTricks.splice(i,1)[0];
        altarEffects.push({ type:'goal_reduce', value:0.5, roundsLeft:4 });
        noteMessage(`Gave up ${lost.name} · goal halved for 4 rounds`, 'var(--gold)'); render();
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
      roundSeconds += eff.value;   // r548: no ceiling, like every round-start bonus
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
        noteMessage(`${cut} card${cut > 1 ? 's' : ''} cut from the deck`, 'var(--gold)');
      }
      break;
    }
    case 'restore_resources': {
      const short = springResourceShortfall();
      if (short.swaps || short.discards) {
        limits.swaps.current    = Math.max(limits.swaps.current,    limits.swaps.base);
        limits.discards.current = Math.max(limits.discards.current, limits.discards.base);
        noteMessage(`Limits restored - ${limits.swaps.base} swaps, ${limits.discards.base} discards`, 'var(--gold)');
      } else {
        limits.swaps.current    = Math.min(limits.swaps.max,    limits.swaps.current + 1);
        limits.discards.current = Math.min(limits.discards.max, limits.discards.current + 1);
        noteMessage('+1 swap, +1 discard per round', 'var(--gold)');
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
      render(); noteMessage('+1 discard restored', 'var(--gold)'); break;
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: TWIN PATH
// ══════════════════════════════════════════════
// OVERTIME moved to js/overtime.js (r562): every event mode, longer rounds, pick a cost to avoid.

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
  if (!eventEligible('shift_change')) {
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
    noteMessage(`+${eventState.shiftPayout} credits`, 'var(--gold)');
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
    noteMessage('Shift change - Trick order updated', 'var(--gold)');
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
  if (!eventEligible('bench')) {
    body.innerHTML = evEmptyHTML('No cards in the draw pile to work on.');
    setEventConfirm(true); return;
  }
  eventState.benchBoon = null;
  eventState.benchCard = null;
  body.appendChild(evNote('Pick an upgrade, then pick the card it goes on. That card keeps it for the rest of the run.'));

  // Names and sentences from buffOfferName / buffOfferLine (js/deck-grid.js).
  // The card is picked on the NEXT step, so the subject is "this card" here.
  const boons = [
    { icon:'🔨', rarity:'common', e:{ pips:40 }  },
    { icon:'✨', rarity:'rare',   e:{ mult:6 }   },
    { icon:'💥', rarity:'epic',   e:{ xmult:2 }  },
    { icon:'🔁', rarity:'rare',   e:{ retrig:1 } },
    { icon:'📈', rarity:'epic',   e:{ growMult:1 } },
  ].map(b => ({ ...b, name: buffOfferName(b.e), desc: buffOfferLine(b.e, 'this card', false) }));
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
    // QRL (r484): a card that cannot take this kind of buff this quarter.
    const _full = qrlCardFull(card, qrlPayloadKind(eventState.benchBoon && eventState.benchBoon.e));
    if (_full) { chip.classList.add('qrl-full'); chip.title = QRL_TEXT.full() + '\n' + QRL_TEXT.fullWhy(); }
    chip.addEventListener('click', () => {
      if (_full) { refuse(QRL_TEXT.full() + '. ' + QRL_TEXT.fullWhy()); return; }
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
    if (t) { enhanceCardKey(cardId(t), b.e); noteMessage(`${cardLabel(t)}: ${buffOfferName(b.e)}`, 'var(--gold)'); }
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
  if (!eventEligible('rehearsal')) {
    body.innerHTML = evEmptyHTML('No Tricks to work on. Take the credits instead.');
    eventState.rehearseNone = true;
    setEventConfirm(true); return;
  }
  eventState.rehearsePick = null;
  body.appendChild(evNote(`One Trick fires an extra time on every hand, for the rest of the run. Cost: <b>${BAL.rehearsal.junk} junk cards</b> go into your deck. Junk takes up a space on the board and cannot be played or discarded.`));
  trickTray.forEach(t => {
    const rank = t._rank || 0;
    const el = makeChoiceEl({
      icon: (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦',
      tile: { entity:'trick', id:t.id, emoji:(typeof trickEmoji === 'function') ? trickEmoji(t) : '✦', label:t.name },
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
    noteMessage(`+${BAL.rehearsal.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.rehearsePick) {
    const t = eventState.rehearsePick;
    t._rank = (t._rank || 0) + 1;
    if (typeof addJunkToDeck === 'function') addJunkToDeck(BAL.rehearsal.junk);   // r576: the cost
    noteMessage(`${t.name} rehearsed - fires ${t._rank + 1}× a hand · ${BAL.rehearsal.junk} junk in your deck`, 'var(--gold)');
    if (typeof renderTrickTray === 'function') renderTrickTray();
  }
  closeEvent();
}

// r576 (owner): Reinforce adds 20% of the Sleight's CURRENT ceiling, rounded up,
// never under the old flat +2 - so a big Sleight gains a big step and repeat
// visits compound. One function, read by the offer text and the apply.
function workshopCapGain(def) {
  const cap = (typeof sleightMaxCharges === 'function') ? sleightMaxCharges(def) : null;
  if (cap === null) return 0;
  return Math.max(BAL.workshop.cap_bonus, Math.ceil(cap * BAL.workshop.cap_pct));
}
// ─── EVENT: THE WORKSHOP (Sleight upgrade) ───
// Sleights run on charges and, once spent, sit inert or leave the deck. Nothing
// in the game raised a charge CEILING before this.
function renderWorkshop() {
  const body = document.getElementById('event-body');
  const owned = allOwnedSleightCards().filter(c => sleightMaxCharges(sleightDef(c)) !== null);
  if (!eventEligible('workshop')) {
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
    desc:`One Sleight's charge ceiling goes up by ${Math.round(BAL.workshop.cap_pct * 100)}% (at least +${BAL.workshop.cap_bonus}) for good, and it refills to the new ceiling.`,
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
      tile: { entity:'sleight', id:def.id, emoji:def.emoji || '◈', label:def.name, uses:(card._usesLeft ?? cap) },
      desc: `${def.desc}<br>Now ${card._usesLeft ?? cap} of ${cap} charges · would become ${cap + workshopCapGain(def)}.`,
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
    noteMessage(`+${BAL.workshop.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.workshopPick === 'service') {
    let n = 0;
    allOwnedSleightCards().forEach(c => {
      const cap = sleightMaxCharges(sleightDef(c));
      if (cap !== null && (c._usesLeft || 0) < cap) { c._usesLeft = cap; n++; }
    });
    noteMessage(n ? `${n} Sleight${n > 1 ? 's' : ''} refilled` : 'All Sleights already full', 'var(--gold)');
  } else if (eventState.workshopPick === 'reinforce' && eventState.workshopCard) {
    const def = sleightDef(eventState.workshopCard);
    if (def) {
      sleightCapBonus[def.id] = (sleightCapBonus[def.id] || 0) + workshopCapGain(def);
      // Refill every copy to the NEW ceiling, not just the one that was picked -
      // the bonus is stored per sleightId, so they all share it.
      allOwnedSleightCards().forEach(c => {
        if (c.sleightId === def.id) c._usesLeft = sleightMaxCharges(def);
      });
      noteMessage(`${def.name} reinforced - ${sleightMaxCharges(def)} charges`, 'var(--gold)');
    }
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: CARD MARKET (id 'market') - r576 rework: stocks the Lockbox
// ══════════════════════════════════════════════
// Owner: "pick from a bunch of cards, 50% to have a random buff, 5% chance to
// have 2, but these go into a new feature ... a stash or reserve ... the event
// lets you buy as many as you can afford ... lets go with 5."
//
// The cards do NOT join the deck when bought: they go into the Lockbox
// (js/lockbox.js) and join the deck when you place one on the board. The first
// purchase puts a Lockbox Sleight into your deck. Buffs roll at EVENT strength
// (rollBuffs, js/flow-rewards.js), so an x mult here is x3.
const MARKET_OFFERS = 8;
function marketCardPrice() { return priceOf(BAL.market.card_price); }
function marketRollCard() {
  const ranks = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : ['♠', '♥', '♦', '♣'];
  const card = stampId({ rank: ranks[Math.floor(Math.random() * ranks.length)], suit: suits[Math.floor(Math.random() * suits.length)] });
  const r = Math.random();
  const n = r < BAL.market.two_buffs ? 2 : r < BAL.market.two_buffs + BAL.market.one_buff ? 1 : 0;
  const buffs = n ? rollBuffs(n, { event: true }) : [];
  return { card, buffs };
}
function renderMarket() {
  const body = document.getElementById('event-body');
  const s = eventState;
  s.marketOffers = Array.from({ length: MARKET_OFFERS }, marketRollCard);
  s.marketBasket = [];
  const price = marketCardPrice();
  body.appendChild(evNote(`${price} credits each. In a round, double-tap the Lockbox to place one; a placed card joins your deck.`));
  const grid = document.createElement('div'); grid.className = 'mk-grid'; grid.id = 'mk-grid';
  s.marketOffers.forEach((off, i) => {
    const el = document.createElement('div');
    el.className = 'mk-card' + (['♥', '♦'].includes(off.card.suit) ? ' red' : '') + (off.buffs.length ? ' mk-buffed' : '');
    el.innerHTML = `<div class="mk-face">${off.card.rank}<span>${off.card.suit}</span></div>` +
      `<div class="mk-buffs">${off.buffs.length ? off.buffs.map(b => `<div>${b.label}</div>`).join('') : '<div class="mk-plain">plain</div>'}</div>`;
    el.addEventListener('click', () => {
      const at = s.marketBasket.indexOf(off);
      if (at >= 0) s.marketBasket.splice(at, 1);
      else if ((s.marketBasket.length + 1) * price <= coins) s.marketBasket.push(off);
      else { if (typeof refuse === 'function') refuse('Not enough credits'); return; }
      marketSync();
    });
    off.el = el;
    grid.appendChild(el);
  });
  body.appendChild(grid);
  const lbl = evLabel(''); lbl.id = 'mk-total'; body.appendChild(lbl);
  marketSync();
}
function marketSync() {
  const s = eventState, price = marketCardPrice();
  s.marketOffers.forEach(off => off.el && off.el.classList.toggle('picked', s.marketBasket.includes(off)));
  const n = s.marketBasket.length;
  const t = document.getElementById('mk-total');
  if (t) t.textContent = n ? `${n} CARD${n > 1 ? 'S' : ''} · ${n * price} OF ${coins} CREDITS` : `YOU HAVE ${coins} CREDITS`;
  setEventConfirm(n > 0 && n * price <= coins);
}
function confirmMarket() {
  const s = eventState, basket = s.marketBasket || [], cost = basket.length * marketCardPrice();
  if (!basket.length || cost > coins) { closeEvent(); return; }
  coins -= cost;
  updateCoinsUI?.();
  basket.forEach(off => {
    off.buffs.forEach(b => enhanceCardKey(cardId(off.card), b.e));
    lockboxStash.push(off.card);
  });
  lockboxEnsureOwned();
  noteMessage(`${basket.length} card${basket.length > 1 ? 's' : ''} in your Lockbox`, 'var(--gold)');
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
  if (!eventEligible('deck_trim')) {
    body.innerHTML = evEmptyHTML('Nothing in the draw pile to cut.');
    setEventConfirm(true); return;
  }
  eventState.trimTier = null;
  eventState.trimCards = [];
  body.appendChild(evNote('Every card you cut is gone for the rest of the run. The fewer cards in the deck, the more often the ones you kept come round.'));
  // r576: the junk other events put in your deck comes out here.
  const junk = (typeof junkCards === 'function') ? junkCards().length : 0;
  if (junk) {
    const jPrice = priceOf(BAL.deck_trim.junk_each) * junk, jAfford = coins >= jPrice;
    const jel = makeChoiceEl({ icon: '✕', rarity: 'rare', name: `Clear your junk (${junk})`,
      desc: `Every junk card leaves your deck.`, cost: `${jPrice} credits`, cls: jAfford ? '' : 'locked',
      onClick: () => {
        if (!jAfford) return;
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        jel.classList.add('selected');
        document.getElementById('trim-card-picker')?.remove();
        eventState.trimTier = { junk: true, price: jPrice, cards: 0 };
        eventState.trimCards = [];
        setEventConfirm(true);
      } });
    body.appendChild(jel);
  }

  // r234: PRICE_MULT at the read site (BAL is rebuilt by applyEntityTiers).
  // A free tier stays free - priceOf() no-ops on 0.
  BAL.deck_trim.tiers.map(t => ({ ...t, price: priceOf(t.price) })).forEach(tier => {
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
  if (tier && tier.junk) {
    if (coins >= tier.price) { coins -= tier.price; updateCoinsUI?.(); const n = cutJunk(Infinity); noteMessage(`${n} junk card${n === 1 ? '' : 's'} cleared`, 'var(--gold)'); }
    closeEvent(); return;
  }
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
  noteMessage(`${cut} card${cut === 1 ? '' : 's'} cut from the deck`, 'var(--gold)');
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
  if (!eventEligible('clean_slate')) {
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
    noteMessage(`+${BAL.clean_slate.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.slatePick) {
    let say = '';
    try { say = eventState.slatePick.fix(); } catch (e) {}
    // The board shows dead cells and curses, so it has to be repainted for the
    // fix to be visible rather than only true.
    if (typeof render === 'function' && typeof gridData !== 'undefined' && gridData[0]) {
      try { render(); } catch (e) {}
    }
    updateScoreUI?.();
    noteMessage(say || 'Cleared', 'var(--gold)');
  }
  closeEvent();
}
