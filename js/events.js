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
      out.push({ type: kind, id, icon: kind === 'trick' ? '★' : def.emoji, name: kind === 'trick' ? shownEntityName(def, 'trick') : def.name, desc: def.desc,
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
  if (item && item.type === 'trick' && typeof trickTrayFullFor === 'function' && trickTrayFullFor(item.id || (item.data && item.data.id))) {
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
                 desc: `${card.rank}${card.suit} ${flowrBuffDoes(b.op.buff, b.v)}.` });
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
    door.innerHTML = `<div class="door-pick">YOUR PICK</div><div class="door-num">${i+1}</div><div class="door-inner"><div class="door-icon"></div><div class="door-dname"></div></div>`;
    door.addEventListener('click', () => {
      if (eventState.doorsRevealed) return;
      row.querySelectorAll('.event-door').forEach(d=>d.classList.remove('chosen'));
      door.classList.add('chosen'); row.classList.add('has-pick');
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
  info.textContent = 'Stake a Trick on a coin flip. Win: a new Trick. Lose: the staked one is gone.';
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
// The two cards are picked from the whole deck (the deck picker, r590), not off
// the board: between rounds the board has been swept back into the deck (r568).
function forgeBuffs() {
  const B = BAL.forge;
  return [
    { key: 'pips', icon: '🔨', rarity: 'rare', name: `+${B.pips} pips, growing`, e: { pips: B.pips, growPips: B.pips },
      desc: `The card scales +${B.pips} pips each time it scores.` },
    { key: 'mult', icon: '📈', rarity: 'epic', name: `+${B.mult} mult, growing`, e: { mult: B.mult, growMult: B.mult },
      desc: `The card scales +${B.mult} mult each time it scores.` },
  ];
}
function renderForge() {
  const body = document.getElementById('event-body');
  const pool = allDeckCards().filter(c => !(typeof isWildCard === 'function' && isWildCard(c)));
  if (pool.length < 2) { body.innerHTML = evEmptyHTML('Not enough cards to upgrade.'); setEventConfirm(true); eventState.forgeNone = true; return; }
  const s = eventState;
  s.forgeBuff = null; s.forgeBoth = false; s.forgeDone = false;
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
  s.picker = evDeckPicker(body, { max: 2, cards: pool, onChange: forgeSync, locked: () => s.forgeDone });
  s.forgeCards = s.picker.picks;
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
  evReveal(s.forgeBoth ? stage : s.picker.el);
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
    const chips = s.forgeCards.map(c => [...s.picker.el.querySelectorAll('.edp-card')].find(el => el._card === c)).filter(Boolean);
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
// r590 (owner): bigger stakes and more of them; credits-for-time is gone (time
// is credits in many modes). Three of these are offered, each a cost now or over
// the next rounds for a gain over the next rounds. Numbers scale with the
// quarter (Q) where the owner asked: +8 mult x Q.
// Effects live in altarEffects ({ type, value, roundsLeft }), ticked at each
// round start (tickAltarEffects, js/level-up.js). READ BY: getAltarMultBoost /
// altarPipBoost (calcScore's starting mult and pips, and the ledger base),
// tickAltarEffects (goal, swaps, clock), altarTrickLocked (isTrickDisabledByBoss,
// the sells), altarFocusMult (focusRateMods).
// (Before r590 nothing read the mult boost or the half goal: both did nothing.)
function altarQ() { return (typeof qrlQuarter === 'function') ? qrlQuarter() : 1; }
function altarOfferings() {
  const Q = altarQ();
  return [
    { id: 'discards', icon: '🕯️', rarity: 'rare', name: `+${8 * Q} mult for 3 rounds`,
      desc: `Every hand scores +${8 * Q} mult for the next 3 rounds.`, cost: 'Costs 5 discards next round',
      canTake: () => true,
      apply: () => { nextRoundDiscardDelta -= 5; altarEffects.push({ type: 'mult_boost', value: 8 * Q, roundsLeft: 3 }); } },
    { id: 'tricks', icon: '🌑', rarity: 'legendary', name: 'Half goals for 4 rounds',
      desc: 'The next 4 rounds need half the score.', cost: '2 random Tricks are switched off and their slots locked for those 4 rounds',
      canTake: () => (trickTray || []).length >= 2,
      apply: () => {
        const ids = evShuffle(trickTray.map(t => t.id)).slice(0, 2);
        altarEffects.push({ type: 'goal_reduce', value: 0.5, roundsLeft: 4 }, { type: 'trick_lock', ids, roundsLeft: 4 });
        renderTrickTray?.();
        const names = ids.map(id => (trickTray.find(t => t.id === id) || {}).name).join(' and ');
        showMessage(`${names} locked for 4 rounds`, 'var(--red)');
      } },
    { id: 'swaps', icon: '🧱', rarity: 'rare', name: `+${18 * Q} pips for 3 rounds`,
      desc: `Every hand scores +${18 * Q} pips for the next 3 rounds.`, cost: 'No swaps for the next 2 rounds',
      canTake: () => true,
      apply: () => { altarEffects.push({ type: 'swap_tax', roundsLeft: 2 }, { type: 'pip_boost', value: 18 * Q, roundsLeft: 3 }); } },
    { id: 'time', icon: '⏳', rarity: 'epic', name: 'Double Focus for 3 rounds',
      desc: 'Hands make twice the Focus for the next 3 rounds.', cost: 'The next 3 rounds start 30 seconds shorter',
      canTake: () => !(typeof modeHasNoRoundClock === 'function' && modeHasNoRoundClock()),
      apply: () => { altarEffects.push({ type: 'time_tax', value: 30, roundsLeft: 3 }, { type: 'focus_fast', value: 2, roundsLeft: 3 }); } },
    { id: 'payout', icon: '🧾', rarity: 'rare', name: `+${5 * Q} mult for 4 rounds`,
      desc: `Every hand scores +${5 * Q} mult for the next 4 rounds.`, cost: 'Your next payout pays nothing',
      canTake: () => !skipNextPayout,
      apply: () => { skipNextPayout = true; altarEffects.push({ type: 'mult_boost', value: 5 * Q, roundsLeft: 4 }); } },
  ];
}
function renderAltar() {
  const offerings = evShuffle(altarOfferings().filter(o => o.canTake())).slice(0, 3);
  eventState.altarPick = null;
  const body = document.getElementById('event-body');
  offerings.forEach(off => {
    const el = makeChoiceEl({ icon: off.icon, rarity: off.rarity, name: off.name, desc: off.desc, cost: off.cost,
      onClick: () => {
        body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.altarPick = off;
        setEventConfirm(true);
      } });
    body.appendChild(el);
  });
}

function confirmAltar() {
  const off = eventState.altarPick;
  if (off) { off.apply(); noteMessage(off.name, 'var(--gold)'); render?.(); }
  closeEvent();
}

// ── Altar tick: called at each round start, after the round's goal and stock are set ──
// An effect applies to `roundsLeft` rounds counted from the first round start it sees.
function tickAltarEffects() {
  altarEffects.forEach(eff => { if (eff.started) eff.roundsLeft--; else eff.started = true; });
  altarEffects = altarEffects.filter(e => e.roundsLeft > 0);
  altarEffects.forEach(eff => {
    if (eff.type === 'time_boost') { roundSeconds += eff.value; updateClockUI(); }   // a save made before r590
    if (eff.type === 'time_tax')   { roundSeconds = Math.max(10, roundSeconds - eff.value); updateClockUI(); }
    if (eff.type === 'swap_tax')   { swaps = 0; }
  });
  const g = getAltarGoalMultiplier();
  if (g !== 1) roundGoal = Math.max(50, Math.round(roundGoal * g / 50) * 50);
  if (typeof renderTrickTray === 'function') renderTrickTray();
}

function getAltarMultBoost() {
  return (altarEffects || []).filter(e => e.started && e.type === 'mult_boost').reduce((s, e) => s + e.value, 0);
}
function altarPipBoost() {
  return (altarEffects || []).filter(e => e.started && e.type === 'pip_boost').reduce((s, e) => s + e.value, 0);
}
function altarFocusMult() {
  return (altarEffects || []).filter(e => e.started && e.type === 'focus_fast').reduce((s, e) => s * e.value, 1);
}
function altarTrickLocked(id) {
  return (altarEffects || []).some(e => e.type === 'trick_lock' && e.ids && e.ids.includes(id));
}
function getAltarGoalMultiplier() {
  const eff = (altarEffects || []).find(e => e.started && e.type === 'goal_reduce');
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
// r590 (owner): three options. Cut 8 cards at random from the grid you just
// played (PEEK shows it); cut any 3 cards you choose; or undo one downside from
// a grid or an event (the Clean Slate list). The grid is the live board when it
// has cards (the event tour), else the last board the round-end sweep recorded
// (lastBoard, by card id, so it survives the cards being rebuilt and a save).
const SPRING_RANDOM = 8, SPRING_CHOOSE = 3;
let lastBoard = null;   // { rows, cols, ids } (js/interlude.js); in SAVE_VARS
function springGridCards() {
  const live = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; if (cd && cd.rank && !cd._isSleight && !cd._isStone) live.push(cd); }
  if (live.length) return { rows: gridRows, cols: gridCols, cells: (gridData || []).flat().map(cd => live.includes(cd) ? cd : null) };
  if (!lastBoard || !lastBoard.ids) return null;
  const deck = everyDeckCard();
  return { rows: lastBoard.rows, cols: lastBoard.cols, cells: lastBoard.ids.map(id => (id != null && deck.find(c => c._id === id)) || null) };
}
function springLiveFixes() { return CLEAN_SLATE_FIXES.filter(f => { try { return f.has(); } catch (e) { return false; } }); }

function renderSpring() {
  const s = eventState, body = document.getElementById('event-body');
  s.springPick = null; s.springFix = null;
  const grid = springGridCards(), gridCards = grid ? grid.cells.filter(Boolean) : [];
  const pick = (key, el) => {
    body.querySelectorAll('.spring-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected'); s.springPick = key;
    document.getElementById('spring-sub')?.remove();
    const sub = document.createElement('div'); sub.id = 'spring-sub'; el.after(sub);
    return sub;
  };
  const sync = () => setEventConfirm(
    (s.springPick === 'random' && gridCards.length > 0) ||
    (s.springPick === 'choose' && s.picker && s.picker.picks.length > 0) ||
    (s.springPick === 'fix' && !!s.springFix));

  const rnd = makeChoiceEl({ icon: '🎲', rarity: 'rare', name: `Cut ${SPRING_RANDOM} at random`,
    desc: `${Math.min(SPRING_RANDOM, gridCards.length)} random cards from your last grid leave your deck.`, cls: 'spring-opt' + (gridCards.length ? '' : ' locked'),
    onClick: () => { if (!gridCards.length) return; pick('random', rnd); sync(); } });
  body.appendChild(rnd);
  if (gridCards.length) {
    const row = evRow(body);
    const peek = evButton('PEEK AT THE GRID', () => {
      const open = document.getElementById('spring-peek');
      if (open) { open.remove(); peek.textContent = 'PEEK AT THE GRID'; return; }
      const box = document.createElement('div'); box.id = 'spring-peek'; box.className = 'spring-peek';
      box.style.setProperty('--sp-cols', grid.cols);
      box.innerHTML = grid.cells.map(cd => cd
        ? `<span class="edp-card${['♥', '♦'].includes(cd.suit) ? ' red' : ''}${isWildCard(cd) ? ' wild' : ''}">${isWildCard(cd) ? WILD_RANK : cd.rank + cd.suit}</span>`
        : '<span class="sp-empty">·</span>').join('');
      row.after(box); peek.textContent = 'HIDE THE GRID'; evReveal(box);
    }, true);
    row.appendChild(peek);
  }

  const choose = makeChoiceEl({ icon: '✂️', rarity: 'rare', name: `Cut any ${SPRING_CHOOSE}`,
    desc: `Choose up to ${SPRING_CHOOSE} cards from your deck.`, cls: 'spring-opt',
    onClick: () => {
      const sub = pick('choose', choose);
      s.picker = evDeckPicker(sub, { max: SPRING_CHOOSE, onChange: sync });
      sync();
    } });
  body.appendChild(choose);

  const fixes = springLiveFixes();
  const fix = makeChoiceEl({ icon: '✨', rarity: 'epic', name: 'Undo a downside',
    desc: fixes.length ? 'One downside from a grid or an event is reversed.' : 'Nothing to undo.', cls: 'spring-opt' + (fixes.length ? '' : ' locked'),
    onClick: () => {
      if (!fixes.length) return;
      const sub = pick('fix', fix);
      s.springFix = null;
      fixes.forEach(f => {
        const el = makeChoiceEl({ icon: f.icon, rarity: f.rarity, name: f.name, desc: f.desc(), cls: 'spring-fix',
          onClick: () => { sub.querySelectorAll('.spring-fix').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); s.springFix = f; sync(); } });
        sub.appendChild(el);
      });
      sync();
    } });
  body.appendChild(fix);
  s.springGrid = gridCards;
}

function confirmSpring() {
  const s = eventState;
  if (s.springPick === 'random') {
    const pool = s.springGrid.slice(), out = [];
    while (out.length < SPRING_RANDOM && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const names = out.map(c => isWildCard(c) ? WILD_RANK : c.rank + c.suit).join(' ');
    const cut = cutCardsFromDeck(out.map(c => resolveDeckCard(c) || c));
    showMessage(`Cut ${cut}: ${names}`, 'var(--gold)');
  } else if (s.springPick === 'choose' && s.picker && s.picker.picks.length) {
    const cut = cutCardsFromDeck(s.picker.picks.slice());
    noteMessage(`${cut} card${cut === 1 ? '' : 's'} cut from the deck`, 'var(--gold)');
  } else if (s.springPick === 'fix' && s.springFix) {
    let say = '';
    try { say = s.springFix.fix(); } catch (e) {}
    noteMessage(say || 'Cleared', 'var(--gold)');
  } else return;
  if (typeof gridData !== 'undefined' && gridData[0] && gridData[0].length === gridCols) { try { render(); } catch (e) {} }
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
// r590 (owner): Tray Order only turns up when something cares about tray order:
// an owned entity whose effect depends on TRAY ORDER (r634: the `tricks` tag
// in js/data/tags.js is wider, it also covers Magician-style counts, so the
// order-sensitive ones are named here). Add a new one to TRAY_ORDER_IDS.
const TRAY_ORDER_IDS = new Set(['wild_heart', 'twos_retrigger', 'prime_times', 'mirror', 'temporal_rift', 'obligatory', 'suggestive']);   // r646: Alignment is gone; Obligatory / Suggestive read a tray slot
function ownsPositional() {
  const has = e => e && TRAY_ORDER_IDS.has(e.id);
  return (trickTray || []).some(has) || (acquiredKnacks || []).some(has);
}
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
  tools.appendChild(mkTool('↔ Reverse', () => { eventState.shiftOrder.reverse(); }));
  tools.appendChild(mkTool('↺ Reset',   () => { eventState.shiftOrder = tray.slice(); }));
  body.appendChild(tools);

  requestAnimationFrame(renderShiftRow);   // it measures the row
  setEventConfirm(true);
  document.getElementById('event-skip').textContent = 'Leave as it is';
}

// r590 (owner): drag a Trick to its new place. It follows the pointer; the
// Tricks between its old and new place slide over with a slight rubber band, and
// on release it snaps in. The row is one line: slots shrink to fit the tray.
const SHIFT_GAP = 8, SHIFT_EASE = 'cubic-bezier(.3,1.45,.5,1)';
function renderShiftRow() {
  const row = document.getElementById('shift-row');
  if (!row) return;
  const RARS = ['common','rare','epic','legendary'];
  const order = eventState.shiftOrder || [];
  row.innerHTML = '';
  const n = order.length;
  const w = Math.max(30, Math.min(56, Math.floor((row.clientWidth || 340) - SHIFT_GAP * (n - 1)) / n));
  const step = w + SHIFT_GAP;
  row.style.height = Math.round(w * 74 / 56 + 14) + 'px';
  row.style.setProperty('--sh-w', w + 'px');
  const left0 = Math.max(0, ((row.clientWidth || 340) - (n * step - SHIFT_GAP)) / 2);
  const slots = order.map((trick, i) => {
    const rar = RARS.includes(trick.tier) ? trick.tier : 'common';
    const slot = document.createElement('div');
    slot.className = 'shift-slot';
    slot.style.left = (left0 + i * step) + 'px';
    slot.innerHTML = `<div class="shift-num">${i + 1}</div>`
                   + entityTileHTML({ entity: 'trick', id: trick.id, label: trick.name, emoji: trickEmoji(trick) }, rar, { tip: false });
    slot.addEventListener('pointerdown', e => shiftDragStart(e, i, slots, step));
    row.appendChild(slot);
    return slot;
  });
  fitEntityNames(row, '.rwd-name', { maxLines: 2, minPx: 5 });
  const hint = document.getElementById('shift-hint');
  if (hint) hint.textContent = 'Drag a Trick to a new place.';
}
function shiftDragStart(e, from, slots, step) {
  e.preventDefault();
  const order = eventState.shiftOrder, el = slots[from], row = el.parentElement;
  const z = row.getBoundingClientRect().width / (row.offsetWidth || 1) || 1;
  const x0 = e.clientX;
  let to = from, moved = false;
  el.classList.add('dragging');
  el.style.transition = 'none';
  slots.forEach((s, j) => { if (j !== from) s.style.transition = `transform .2s ${SHIFT_EASE}`; });
  const move = ev => {
    const dx = (ev.clientX - x0) / z;
    if (Math.abs(dx) > 3) moved = true;
    el.style.transform = `translate(${dx}px, -6px) scale(1.08)`;
    const t = Math.max(0, Math.min(order.length - 1, Math.round(from + dx / step)));
    if (t !== to) { to = t; try { sfxCardSelect?.(); } catch (er) {} }
    slots.forEach((s, j) => {
      if (j === from) return;
      const shift = (from < to && j > from && j <= to) ? -step : (to < from && j >= to && j < from) ? step : 0;
      s.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    el.classList.remove('dragging');
    el.style.transition = `transform .22s ${SHIFT_EASE}`;
    el.style.transform = `translateX(${(to - from) * step}px)`;
    if (!moved || to === from) { el.style.transform = ''; return; }
    setTimeout(() => {
      const [t] = order.splice(from, 1); order.splice(to, 0, t);
      renderShiftRow();
    }, 230);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
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

// ─── EVENT: EXTRA REP (Trick upgrade) ───
// r590 (owner): three upgrades for one Trick, each paid in curse cards (js/boss.js):
//   encore - it fires one more time each hand (one firing's worth, once a hand):
//            calcScore's `_encore` loop, beside priming.
//   echo   - every time it fires, it fires again: the permanent prime `_rank`
//            (what Extra Rep always was).
//   chain  - every time it fires, a random other Trick is force-triggered:
//            `_chain`, pushed into calcScore's forced-fire block (deterministic per hand).
const REHEARSAL_UPS = [
  { id: 'encore', icon: '➕', rarity: 'rare', name: 'Encore', desc: 'The Trick fires one more time each hand.',
    cost: () => `${BAL.rehearsal.encore_curses} curse cards`,
    apply: t => { t._encore = (t._encore || 0) + 1; addCurseCardsToDeck(BAL.rehearsal.encore_curses); } },
  { id: 'echo', icon: '🔁', rarity: 'legendary', name: 'Echo', desc: 'Every time the Trick fires, it fires again.',
    cost: () => `${BAL.rehearsal.echo_curses} curse cards`,
    apply: t => { t._rank = (t._rank || 0) + 1; addCurseCardsToDeck(BAL.rehearsal.echo_curses); } },
  { id: 'chain', icon: '⛓', rarity: 'epic', name: 'Chain', desc: 'Every time the Trick fires, a random other Trick is force-triggered.',
    cost: () => `${BAL.rehearsal.chain_curses} curse cards and ${BAL.rehearsal.chain_cursed} of your cards cursed`,
    apply: t => { t._chain = (t._chain || 0) + 1; addCurseCardsToDeck(BAL.rehearsal.chain_curses);
                  for (let k = 0; k < BAL.rehearsal.chain_cursed; k++) curseRandomCard(); } },
];
function rehearsalTag(t) {
  const bits = [];
  if (t._encore) bits.push(`encore ×${t._encore}`);
  if (t._rank) bits.push(`echo ×${t._rank}`);
  if (t._chain) bits.push(`chain ×${t._chain}`);
  return bits.length ? ` · ${bits.join(', ')}` : '';
}
function renderRehearsal() {
  const body = document.getElementById('event-body');
  if (!eventEligible('rehearsal')) {
    body.innerHTML = evEmptyHTML('No Tricks to work on. Take the credits instead.');
    eventState.rehearseNone = true;
    setEventConfirm(true); return;
  }
  eventState.rehearseUp = null; eventState.rehearsePick = null;
  body.appendChild(evNote('Curse cards cannot be played, swapped or discarded.'));
  body.appendChild(evLabel('1 · THE UPGRADE'));
  REHEARSAL_UPS.forEach(u => {
    const el = makeChoiceEl({ icon: u.icon, rarity: u.rarity, name: u.name, desc: u.desc, cost: u.cost(), cls: 'rh-up',
      onClick: () => {
        body.querySelectorAll('.rh-up').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); eventState.rehearseUp = u; rehearsalSync();
      } });
    body.appendChild(el);
  });
  body.appendChild(evLabel('2 · THE TRICK'));
  trickTray.forEach(t => {
    const em = (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦';
    const el = makeChoiceEl({
      icon: em, tile: { entity: 'trick', id: t.id, emoji: em, label: t.name },
      rarity: t.tier, name: shownEntityName(t, 'trick') + rehearsalTag(t),
      desc: (typeof trickLiveDesc === 'function') ? trickLiveDesc(t) : t.desc, cls: 'rh-trick',
      onClick: () => {
        body.querySelectorAll('.rh-trick').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); eventState.rehearsePick = t; rehearsalSync();
      } });
    body.appendChild(el);
  });
}
function rehearsalSync() { setEventConfirm(!!eventState.rehearseUp && !!eventState.rehearsePick); }
function confirmRehearsal() {
  if (eventState.rehearseNone) {
    coins += BAL.rehearsal.consolation_credits;
    updateCoinsUI?.();
    noteMessage(`+${BAL.rehearsal.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.rehearseUp && eventState.rehearsePick) {
    const t = eventState.rehearsePick, u = eventState.rehearseUp;
    u.apply(t);
    showMessage(`${t.name}: ${u.name} · ${u.cost()}`, 'var(--gold)');
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

  const service = makeChoiceEl({
    icon:'🧰', rarity:'common', name:'Service', desc:`Refill every Sleight's charges (${owned.length} held).`,
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
      service.classList.add('selected');
      eventState.workshopPick = 'service';
      document.getElementById('workshop-picker')?.remove();
      setEventConfirm(true);
    }
  });
  body.appendChild(service);

  // r590 (owner): a middle option, 3 random Sleights +1 charge each.
  const ids = [...new Set(owned.map(c => sleightDef(c)?.id).filter(Boolean))];
  const tune = makeChoiceEl({
    icon:'🔧', rarity:'rare', name:'Tune-up',
    desc:`${Math.min(3, ids.length)} random Sleight${ids.length === 1 ? '' : 's'} hold 1 more charge.`,
    onClick: () => {
      body.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
      tune.classList.add('selected');
      eventState.workshopPick = 'tune';
      document.getElementById('workshop-picker')?.remove();
      setEventConfirm(true);
    }
  });
  body.appendChild(tune);

  const reinforce = makeChoiceEl({
    icon:'⚙️', rarity:'epic', name:'Reinforce',
    desc:`One Sleight holds ${Math.round(BAL.workshop.cap_pct * 100)}% more charges (at least ${BAL.workshop.cap_bonus}) and refills.`,
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
  } else if (eventState.workshopPick === 'tune') {
    const defs = evShuffle([...new Set(allOwnedSleightCards().map(c => sleightDef(c)).filter(d => d && sleightMaxCharges(d) !== null))]).slice(0, 3);
    defs.forEach(def => {
      sleightCapBonus[def.id] = (sleightCapBonus[def.id] || 0) + 1;
      allOwnedSleightCards().forEach(c => { if (c.sleightId === def.id) c._usesLeft = (c._usesLeft || 0) + 1; });
    });
    showMessage(defs.length ? `+1 charge: ${defs.map(d => d.name).join(', ')}` : 'No Sleights to tune', 'var(--gold)');
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
// EVENT: CARD MARKET (id 'market') - r576 rework: bought cards wait in a stash (r590: the Focus bar opens it)
// ══════════════════════════════════════════════
// Owner: "pick from a bunch of cards, 50% to have a random buff, 5% chance to
// have 2, but these go into a new feature ... a stash or reserve ... the event
// lets you buy as many as you can afford ... lets go with 5."
//
// The cards do NOT join the deck when bought: they wait in the stash
// (js/lockbox.js), opened by a double-tap on the Focus bar, and join the deck
// when you place one on the board. Buffs roll at EVENT strength
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
  body.appendChild(evNote(`${price} credits each. In a round, double-tap the Focus bar to put them on the board.`));
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
  noteMessage(`${basket.length} card${basket.length > 1 ? 's' : ''} bought`, 'var(--gold)');
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: DECK TRIM  (id 'deck_trim', r211)
// ══════════════════════════════════════════════
// The counterweight to the Card Market: you pick whatever you want gone, and the
// price is the constraint.
// r590 (owner): pick any cards from the deck. The first costs 8, the second 16,
// the third 24 and so on, no card more than 128. Junk can still be cleared here.
function trimCardPrice(k) { return Math.min(priceOf(BAL.deck_trim.cap), priceOf(BAL.deck_trim.step) * k); }   // the k-th card, from 1
function trimTotal(n) { let t = 0; for (let k = 1; k <= n; k++) t += trimCardPrice(k); return t; }
function renderDeckTrim() {
  const body = document.getElementById('event-body');
  const s = eventState;
  if (!eventEligible('deck_trim')) {
    body.innerHTML = evEmptyHTML('Nothing in your deck to cut.');
    setEventConfirm(true); return;
  }
  s.trimJunk = false;
  body.appendChild(evNote('Permanently remove any cards from your deck.'));
  const junk = (typeof junkCards === 'function') ? junkCards().length : 0;
  s.trimJunkPrice = priceOf(BAL.deck_trim.junk_each) * junk;
  if (junk) {
    const jel = makeChoiceEl({ icon: '✕', rarity: 'rare', name: `Clear your junk (${junk})`,
      desc: 'Every junk card leaves your deck.', cost: `${s.trimJunkPrice} credits`, cls: 'trim-junk',
      onClick: () => {
        if (!s.trimJunk && coins < trimDue(s.picker.picks.length, true)) { refuse('Not enough credits'); return; }
        s.trimJunk = !s.trimJunk; jel.classList.toggle('selected', s.trimJunk); trimSync();
      } });
    body.appendChild(jel);
  }
  s.trimSum = document.createElement('div'); s.trimSum.className = 'ev-total';
  body.appendChild(s.trimSum);
  s.picker = evDeckPicker(body, { max: 99, onChange: trimSync,
    blocked: card => (!s.picker || s.picker.picks.includes(card) || coins >= trimDue(s.picker.picks.length + 1, s.trimJunk)) ? '' : 'Not enough credits' });
  trimSync();
}
function trimDue(n, junk) { return trimTotal(n) + (junk ? eventState.trimJunkPrice : 0); }
function trimSync() {
  const s = eventState, n = s.picker.picks.length, due = trimDue(n, s.trimJunk);
  s.trimSum.textContent = `${n} card${n === 1 ? '' : 's'} · ${due} credits · next card ${trimCardPrice(n + 1)}`;
  s.picker.sync();
  setEventConfirm((n > 0 || s.trimJunk) && coins >= due);
}
function confirmDeckTrim() {
  const s = eventState;
  if (!s.picker) { closeEvent(); return; }
  const n = s.picker.picks.length, due = trimDue(n, s.trimJunk);
  if ((!n && !s.trimJunk) || coins < due) return;
  coins -= due; updateCoinsUI?.();
  if (s.trimJunk) { const j = cutJunk(Infinity); noteMessage(`${j} junk card${j === 1 ? '' : 's'} cleared`, 'var(--gold)'); }
  if (n) { const cut = cutCardsFromDeck(s.picker.picks.slice()); noteMessage(`${cut} card${cut === 1 ? '' : 's'} cut from the deck`, 'var(--gold)'); }
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
    desc: () => `Every goal is raised ${Math.round((goalPenaltyMult - 1) * 100)}%.`,
    fix:  () => { goalPenaltyMult = 1; return 'Goals back to normal'; } },
  { id:'time',   icon:'⏱', rarity:'rare',
    name:'Shortened rounds',
    has:  () => roundPenaltySeconds > 0,
    desc: () => `Rounds start ${roundPenaltySeconds}s short.`,
    fix:  () => { const n = roundPenaltySeconds; roundPenaltySeconds = 0; return `+${n}s back on every round`; } },
  { id:'play',   icon:'🎟', rarity:'rare',
    name:'Play surcharge',
    has:  () => extraPlayCostPerm > 0,
    desc: () => `Playing a hand costs ${extraPlayCostPerm}s extra.`,
    fix:  () => { extraPlayCostPerm = 0; return 'Playing is free again'; } },
  { id:'curses', icon:'🩸', rarity:'epic',
    name:'Cursed cards',
    has:  () => Object.keys(cardCurses || {}).length > 0,
    desc: () => `${Object.keys(cardCurses).length} card${Object.keys(cardCurses).length === 1 ? ' is' : 's are'} cursed.`,
    fix:  () => { const n = Object.keys(cardCurses).length; cardCurses = {}; return `${n} curse${n === 1 ? '' : 's'} lifted`; } },
  { id:'curse_cards', icon:'🃏', rarity:'epic',
    name:'Curse cards',
    has:  () => typeof curseCardsAll === 'function' && curseCardsAll().length > 0,
    desc: () => `${curseCardsAll().length} curse card${curseCardsAll().length === 1 ? ' is' : 's are'} in your deck.`,
    fix:  () => { const n = clearCurseCards(); return `${n} curse card${n === 1 ? '' : 's'} removed`; } },
  { id:'dead',   icon:'⬛', rarity:'rare',
    name:'Dead cells',
    has:  () => (deadCells && deadCells.size > 0),
    desc: () => `${deadCells.size} cell${deadCells.size === 1 ? '' : 's'} on the board score nothing.`,
    fix:  () => { const n = deadCells.size; deadCells = new Set(); return `${n} cell${n === 1 ? '' : 's'} restored`; } },
  { id:'freeze', icon:'❄', rarity:'common',
    name:'Interest freeze',
    has:  () => interestFreezeRounds > 0,
    desc: () => `Interest is frozen for ${interestFreezeRounds} more round${interestFreezeRounds === 1 ? '' : 's'}.`,
    fix:  () => { interestFreezeRounds = 0; return 'Interest paying again'; } },
  { id:'payout', icon:'🚫', rarity:'common',
    name:'Withheld payout',
    has:  () => !!skipNextPayout,
    desc: () => 'Your next payout pays nothing.',
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
  body.appendChild(evNote('A previous mistake is undone. Choose your greatest regret below.'));
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

// ══ LINE SHIFT (r644, owner) ═══════════════════════════════════════════════
// Move your position Tricks' marked lines. Offered only with two or more
// position effects on the board (EVENT_REQUIRES). Tap an effect, then the line
// it goes to: a free line takes it, a line another effect holds SWAPS the two
// (both keep their axis). With District a line may be shared. Confirm writes
// every change through finalizePositionMark; Skip leaves the lines as they are.
function lineShiftEntries() {
  if (typeof rowColBonuses === 'undefined') return [];
  return rowColBonuses.filter(b => b._trickRef && !b._fixed && POSITION_ASSIGN_IDS.includes(b.id));
}
function renderLineShift() {
  const body = document.getElementById('event-body');
  if (!eventEligible('line_shift')) {
    eventState.lineShiftPayout = BAL.shift_change ? BAL.shift_change.consolation_credits : 15;
    body.appendChild(makeChoiceEl({ icon: '📍', name: 'Nothing to move',
      desc: `You need two position effects before their lines can trade places. Take ${eventState.lineShiftPayout} credits for turning up.` }));
    setEventConfirm(true);
    document.getElementById('event-skip').textContent = 'Leave';
    return;
  }
  // Work on a copy: { trick, axis, index } per effect. The registry is only written on Confirm.
  eventState.lines = lineShiftEntries().map(b => ({ trick: b._trickRef, id: b.id, axis: b.axis, index: b.index, axis0: b.axis, index0: b.index }));
  eventState.linePick = 0;
  const wrap = document.createElement('div'); wrap.id = 'lsh-wrap';
  wrap.innerHTML = `<div id="lsh-effects"></div><div id="lsh-hint"></div><div id="lsh-lines"></div>`;
  body.appendChild(wrap);
  const tools = document.createElement('div'); tools.id = 'shift-tools';
  const reset = document.createElement('button'); reset.className = 'shift-tool'; reset.textContent = '↺ Reset';
  reset.addEventListener('click', () => { eventState.lines.forEach(l => { l.axis = l.axis0; l.index = l.index0; }); renderLineShiftBody(); });
  tools.appendChild(reset); body.appendChild(tools);
  renderLineShiftBody();
  setEventConfirm(true);
  document.getElementById('event-skip').textContent = 'Leave as it is';
}
function renderLineShiftBody() {
  const L = eventState.lines || [], pick = eventState.linePick || 0;
  const word = a => a === 'row' ? 'row' : 'column';
  const fx = document.getElementById('lsh-effects'), lines = document.getElementById('lsh-lines'), hint = document.getElementById('lsh-hint');
  if (!fx || !lines) return;
  fx.innerHTML = '';
  L.forEach((l, i) => {
    const rar = ['common', 'rare', 'epic', 'legendary'].includes(l.trick.tier) ? l.trick.tier : 'common';
    const meta = (typeof lineFXMeta === 'function') ? lineFXMeta(l.id) : { color: '#c9a84c' };
    const chip = document.createElement('div');
    chip.className = 'lsh-chip' + (i === pick ? ' picked' : '') + ((l.axis !== l.axis0 || l.index !== l.index0) ? ' moved' : '');
    chip.style.setProperty('--lc', meta.color);
    chip.innerHTML = entityTileHTML({ entity: 'trick', id: l.trick.id, label: l.trick.name, emoji: trickEmoji(l.trick) }, rar, { tip: false })
      + `<div class="lsh-name">${l.trick.name}</div><div class="lsh-where">${word(l.axis)} ${l.index + 1}</div>`;
    chip.addEventListener('click', () => { eventState.linePick = i; renderLineShiftBody(); });
    fx.appendChild(chip);
  });
  const cur = L[pick]; if (!cur) return;
  const axis = cur.axis, n = axis === 'row' ? gridRows : gridCols;
  const district = typeof hasKnack === 'function' && hasKnack('district');
  if (hint) hint.textContent = `Tap the ${word(axis)} ${cur.trick.name} moves to. A ${word(axis)} another effect holds swaps the two.`;
  lines.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lsh-line';
    const here = L.filter(l => l !== cur && l.axis === axis && l.index === i);
    const fixed = (typeof rowColBonuses !== 'undefined' ? rowColBonuses : []).filter(x => x.axis === axis && x.index === i && !L.some(l => l.id === x.id && l.trick === x._trickRef));
    const mine = cur.index === i;
    if (mine) b.classList.add('mine');
    const names = here.map(l => l.trick.name).concat(fixed.map(x => (typeof lineFXMeta === 'function') ? lineFXMeta(x.id).name : x.id));
    b.innerHTML = `<b>${word(axis).toUpperCase()} ${i + 1}</b><small>${names.length ? names.join(', ') : 'free'}</small>`;
    if (!mine) b.addEventListener('click', () => {
      if (here.length && !district) {   // swap with the first effect there
        const other = here[0]; other.index = cur.index;
      }
      cur.index = i;
      renderLineShiftBody();
    });
    lines.appendChild(b);
  }
}
function confirmLineShift() {
  if (eventState.lineShiftPayout) {
    coins += eventState.lineShiftPayout; updateCoinsUI();
    noteMessage(`+${eventState.lineShiftPayout} credits`, 'var(--gold)');
    return;
  }
  const L = eventState.lines || [];
  let moved = 0;
  L.forEach(l => {
    if (l.axis === l.axis0 && l.index === l.index0) return;
    finalizePositionMark(l.trick, l.axis, l.index); moved++;
    noteMessage(`${l.trick.name} → ${l.axis === 'row' ? 'row' : 'column'} ${l.index + 1}`, 'var(--gold)');
  });
  if (!moved) noteMessage('Lines kept', 'var(--cream-dim)');
}
