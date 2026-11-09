// ══════════════════════════════════════════════
// RECORDS - the combined info hub (r155)
// ══════════════════════════════════════════════
// Replaces the four separate secondary chips (Stats / Deck / Time / Limits) with a
// single large tabbed pop-up that PAUSES the round while it is open. Tabs:
//   DECK · TIME · LIMITS · PERFORMANCE · PERSONNEL FILE
// Each tab is a render function in RECORDS_TABS - adding a tab is one entry.

let recordsOpen = false;
let recordsTab  = 'deck';

const RECORDS_TABS = [
  { id: 'deck',      label: 'Deck',           icon: '🂠', render: () => recordsRenderDeck() },
  { id: 'hands',     label: 'Hands',          icon: '♠', render: () => recordsRenderHands() },
  { id: 'personnel', label: 'Owned',          icon: '📁', render: () => recordsRenderPersonnel() },
  { id: 'limits',    label: 'Limits',         icon: '▲', render: () => recordsRenderLimits() },
  { id: 'time',      label: 'Time',           icon: '⏱', render: () => recordsRenderTime() },
  { id: 'stats',     label: 'Performance',    icon: '📈', render: () => recordsRenderStats() },
];

function recordsOverlay() {
  let el = document.getElementById('records-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'records-overlay';
    el.innerHTML = `<div id="records-panel">
        <div id="records-head">
          <div class="rec-brand">&gt; RECORDS<span class="rec-cur"></span></div>
          <button id="rec-close" onclick="closeRecords()">✕</button>
        </div>
        <div id="records-tabs"></div>
        <div id="records-body"></div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function openRecords(tab) {
  const el = recordsOverlay();
  if (tab) recordsTab = tab;
  if (!recordsOpen) {
    recordsOpen = true;
    // Pause the round (but keep the board visible) unless another screen owns the clock.
    if (!screenOwnsClock()) pauseGame(false);
  }
  renderRecords();
  el.classList.add('show');
  // The card fan MEASURES its row, so it has to run once the panel is on screen.
  if (recordsTab === 'deck') recordsDeckAfterRender();
  if (recordsTab === 'personnel' && recOwnedView === 'tray') recOwnedAlign();
}

function closeRecords() {
  if (!recordsOpen) return;
  recordsOpen = false;
  if (typeof hideEntityTooltip === "function") hideEntityTooltip(true);
  recordsOverlay().classList.remove('show');
  if (!screenOwnsClock()) resumeGame();
}

function recordsSwitchTab(id) { recordsTab = id; renderRecords(); }

function renderRecords() {
  const tabsEl = document.getElementById('records-tabs');
  const bodyEl = document.getElementById('records-body');
  if (!tabsEl || !bodyEl) return;
  tabsEl.innerHTML = RECORDS_TABS.map(t =>
    `<button class="rec-tab${t.id === recordsTab ? ' active' : ''}" onclick="recordsSwitchTab('${t.id}')">
       ${t.label}</button>`).join('');
  const tab = RECORDS_TABS.find(t => t.id === recordsTab) || RECORDS_TABS[0];
  bodyEl.innerHTML = tab.render();
  if (tab.id === 'deck') recordsDeckAfterRender();
  if (tab.id === 'personnel' && recOwnedView === 'tray') recOwnedAlign();
}

// ══════════════════════════════════════════════
// DECK TAB - a real deck read-out (r155 overhaul)
// ══════════════════════════════════════════════
// The old view was a flat list of rank chips, which told you almost nothing. This
// one answers the question you actually have mid-round: WHAT IS LEFT TO DRAW, and
// which of my cards are buffed. It is a rank × suit matrix - every cell is one card
// of the deck, coloured by where that card currently is (draw pile / grid / played),
// and flagged if it carries permanent pips or mult.
// The matrix is a rank x suit view, but a rank+suit is no longer necessarily ONE
// card - the shop's Duplicate service makes a second copy of the same face. So the
// census aggregates the real cards into each cell: how many there are, where they
// are, and whether ANY of them carries a buff.
// `where` for a cell is the most present copy (on the board beats in the pile beats
// played), because "can I still draw this" is the question the matrix answers.
function recordsDeckCensus() {
  const cells = {};                      // cardKey (rank+suit) → cell summary
  const rank = { grid: 3, draw: 2, played: 1 };
  const add = (c, w) => {
    if (!c || !c.rank || c._isSleight) return;
    const t = cardKey(c.rank, c.suit);
    const cell = cells[t] || (cells[t] = { n: 0, where: null, draw: 0, pips: 0, mult: 0, grow: false, cursed: false });
    const id = cardId(c);
    cell.n++;
    if (w === 'draw') cell.draw++;
    if (!cell.where || rank[w] > rank[cell.where]) cell.where = w;
    cell.pips  = Math.max(cell.pips, permPips[id] || 0);
    cell.mult  = Math.max(cell.mult, permMult[id] || 0);
    // A scaling buff (r209) may sit on a card whose flat pips/mult are still 0,
    // so without this the deck map would show it as an ordinary card.
    if ((permPipsGrow[id] || 0) || (permMultGrow[id] || 0)) cell.grow = true;
    if (cardCurses[id]) cell.cursed = true;
  };
  drawPile.forEach(c => add(c, 'draw'));
  playedPile.forEach(c => add(c, 'played'));
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) add(gridData[r]?.[c], 'grid');
  return cells;
}

// ══════════════════════════════════════════════
// DECK TAB - the CARDS view (r399). Every physical card drawn with the board's own
// renderCardAppearance, one row per suit, sorted by rank. The rank x suit map
// below is still one toggle away.
// ══════════════════════════════════════════════
let recordsDeckView   = 'cards';   // 'cards' | 'map'
let recordsDeckGrid   = false;     // outline cards that are on the board
let recordsDeckBuffed = false;     // show only cards carrying something
let _recDeckCards     = [];        // index -> card, for the tooltip

function recordsDeckSetView(v)  { recordsDeckView = v; renderRecords(); }
function recordsDeckToggle(k)   { if (k === 'grid') recordsDeckGrid = !recordsDeckGrid; else recordsDeckBuffed = !recordsDeckBuffed; renderRecords(); }

// What one card carries, as plain lines: buffs, curse, card states.
function recordsCardLines(card) {
  const k = cardId(card);
  const lines = cardBuffLines(k, card).slice();
  const cu = cardCurses[k], cd = cu ? CURSE_DEFS[cu.id] : null;
  if (cd) lines.push(`Cursed: ${cd.name} - ${cd.desc}`);
  if (typeof cardStateList === 'function')
    cardStateList(card).forEach(s => lines.push(`${s.def.name}${s.n > 1 ? ' x' + s.n : ''} - ${s.def.desc}`));
  if (card._temp) lines.push('Temp card - gone after this level');
  return lines;
}

function recordsDeckWhere() {
  const grid = new Set(), played = new Set(playedPile);
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const x = gridData[r]?.[c]; if (x) grid.add(x); }
  return card => grid.has(card) ? 'grid' : played.has(card) ? 'played' : 'draw';
}

function recordsRenderDeckCards() {
  const suits = (typeof deckSuitsShown === 'function') ? deckSuitsShown(everyDeckCard()) : (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;   // r709
  const whereOf = recordsDeckWhere();
  const all = everyDeckCard();
  const rankIdx = rk => { const i = ACTIVE_RANKS.indexOf(rk); return i < 0 ? 99 : i; };
  const counts = { draw: 0, grid: 0, played: 0 };
  all.forEach(c => counts[whereOf(c)]++);
  _recDeckCards = [];
  const rowOf = (label, cls, cards) => {
    cards = cards.filter(c => !recordsDeckBuffed || recordsCardLines(c).length);
    if (!cards.length) return '';
    cards.sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank));
    const html = cards.map(card => {
      const i = _recDeckCards.push(card) - 1;
      const { className, innerHTML } = renderCardAppearance(card, -1, -1, { revealFog: true });
      const w = whereOf(card);
      return `<div class="rec-card-slot w-${w}" data-rci="${i}">` +
             `<div class="${className}">${innerHTML}</div></div>`;
    }).join('');
    return `<div class="rec-card-row"><span class="rec-card-suit ${cls}">${label}<b>${cards.length}</b></span>` +
           `<div class="rec-card-fan">${html}</div></div>`;
  };
  let rows = suits.map(s => rowOf(s, suitClass(s), all.filter(c => c.suit === s && !isWildCard(c)))).join('');
  rows += rowOf('✶', 'rec-wild', all.filter(c => isWildCard(c)));
  const other = all.filter(c => !isWildCard(c) && !suits.includes(c.suit));
  if (other.length) rows += rowOf('?', '', other);
  if (!rows) rows = `<div class="rec-empty">None. No card is buffed yet.</div>`;
  const chip = (on, k, txt) => `<button class="rec-chip${on ? ' on' : ''}" onclick="recordsDeckToggle('${k}')">${txt}</button>`;
  return `
    <div class="rec-summary">
      <div class="rec-stat"><span class="rec-stat-v">${counts.draw}</span><span class="rec-stat-l">Not played</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.grid}</span><span class="rec-stat-l">On board</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.played}</span><span class="rec-stat-l">Played</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${all.length}</span><span class="rec-stat-l">Deck size</span></div>
    </div>
    <div class="rec-deck-bar">
      <button class="rec-chip" onclick="recordsDeckSetView('map')">Show deck map</button>
      ${chip(recordsDeckGrid, 'grid', 'Mark board cards')}
      ${chip(recordsDeckBuffed, 'buffed', 'Buffed only')}
      <span class="rec-h-note">Dim = played this round. Tap a card to see what it carries.</span>
    </div>
    <div class="rec-card-rows${recordsDeckGrid ? ' show-grid' : ''}">${rows}</div>`;
}

// Tuck each row so it fits its width (Balatro-style), and wire the card reads.
function recordsDeckAfterRender() {
  document.querySelectorAll('#records-body .rec-card-fan').forEach(fan => {
    const slots = fan.children, n = slots.length;
    if (!n) return;
    const w = slots[0].offsetWidth, avail = fan.clientWidth;
    const gap = n > 1 ? Math.min(4, (avail - w) / (n - 1) - w) : 4;
    fan.style.setProperty('--rc-gap', Math.floor(gap) + 'px');
  });
  const box = document.querySelector('#records-body .rec-card-rows');
  if (!box || box._wired) return;
  box._wired = true;
  const show = el => {
    const card = _recDeckCards[+el.dataset.rci]; if (!card) return;
    const lines = recordsCardLines(card);
    const w = recordsDeckWhere()(card);
    const face = isWildCard(card) ? 'Wild card' : `${card.rank}${card.suit}`;
    showEntityTooltip(el, { label: face, desc: lines.length ? lines.join('<br>') : 'No buffs.' });
    const rar = document.querySelector('#entity-tip .et-rar');
    if (rar) rar.textContent = w === 'grid' ? 'ON BOARD' : w === 'played' ? 'PLAYED' : 'NOT PLAYED';
  };
  box.addEventListener('click', e => { const s = e.target.closest('.rec-card-slot'); if (s) show(s); });
  box.addEventListener('mouseover', e => {
    if (!matchMedia('(hover: hover)').matches) return;
    const s = e.target.closest('.rec-card-slot'); if (s) show(s);
  });
  box.addEventListener('mouseleave', () => hideEntityTooltip());
}

window.addEventListener('resize', () => {
  if (recordsOpen && recordsTab === 'deck') recordsDeckAfterRender();
  if (recordsOpen && recordsTab === 'personnel' && recOwnedView === 'tray') recOwnedAlign();
});

function recordsRenderDeck() {
  if (recordsDeckView === 'cards') return recordsRenderDeckCards();
  const where = recordsDeckCensus();
  const suits = (typeof deckSuitsShown === 'function') ? deckSuitsShown(everyDeckCard()) : (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;   // r709: a Crown / Crescent row
  const counts = { draw: 0, grid: 0, played: 0 };
  Object.values(where).forEach(cell => { if (counts[cell.where] !== undefined) counts[cell.where] += cell.n; });

  // Rank × suit matrix.
  const head = `<div class="rec-deck-row rec-deck-head"><span class="rec-deck-corner"></span>` +
    ACTIVE_RANKS.map(r => `<span class="rec-deck-rank">${r}</span>`).join('') + `</div>`;
  const rows = suits.map(s => {
    const cells = ACTIVE_RANKS.map(rk => {
      const cell = where[cardKey(rk, s)];
      const w  = cell ? cell.where : null;
      const pp = cell ? cell.pips : 0, pm = cell ? cell.mult : 0;
      const gr = !!(cell && cell.grow);
      // Spectrum's white values sit in the row of the colour that owns them (each
      // one is still its own card) - tint the cell so it reads as colourless.
      const cls = ['rec-deck-cell', w ? 'w-' + w : 'w-gone', pp ? 'has-pip' : '', pm ? 'has-mult' : '',
                   gr ? 'has-grow' : '',
                   isWhiteRankValue(rk) ? 'rec-white' : ''].filter(Boolean).join(' ');
      const dup = cell && cell.n > 1 ? ` (x${cell.n} in the run)` : '';
      const tip = `${rk}${s} - ${w === 'draw' ? 'in draw pile' : w === 'grid' ? 'on the board' : w === 'played' ? 'played (returns next round)' : 'not in deck'}${dup}` +
                  `${pp ? ` · scores +${pp} pips` : ''}${pm ? ` · scores +${pm} mult` : ''}` +
                  `${gr ? ' · scales up each play' : ''}${cell && cell.cursed ? ' · cursed' : ''}`;
      const marks = (pp ? '<i class="rec-m rec-m-p"></i>' : '') + (pm ? '<i class="rec-m rec-m-m"></i>' : '')
                  + (gr ? '<i class="rec-m rec-m-g"></i>' : '')
                  + (cell && cell.n > 1 ? `<i class="rec-dup">${cell.n}</i>` : '');
      return `<span class="${cls}" title="${tip}">${rk}${marks}</span>`;
    }).join('');
    const remaining = ACTIVE_RANKS.reduce((n, rk) => n + (where[cardKey(rk, s)]?.draw || 0), 0);
    return `<div class="rec-deck-row">
      <span class="rec-deck-suit ${suitClass(s)}">${s}<b>${remaining}</b></span>${cells}</div>`;
  }).join('');

  // Remaining-by-rank bar (what is still drawable) - the planning tool.
  const rankBars = ACTIVE_RANKS.map(rk => {
    const left = suits.reduce((n, s) => n + (where[cardKey(rk, s)]?.draw || 0), 0);
    const pct = Math.round((left / suits.length) * 100);
    return `<div class="rec-bar"><span class="rec-bar-l">${rk}</span>
      <span class="rec-bar-track"><span class="rec-bar-fill" style="width:${pct}%"></span></span>
      <span class="rec-bar-v">${left}</span></div>`;
  }).join('');

  // Sleights are deck cards too - list them with charges left.
  const sleightCards = [];
  drawPile.forEach(c => { if (c._isSleight) sleightCards.push([c, 'draw']); });
  playedPile.forEach(c => { if (c._isSleight) sleightCards.push([c, 'played']); });
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) { const x = gridData[r]?.[c]; if (x?._isSleight) sleightCards.push([x, 'grid']); }
  const sleightHTML = sleightCards.length ? sleightCards.map(([card, w]) => {
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId) || {};
    const uses = card._usesLeft === 'infinite' ? '∞' : card._usesLeft;
    return `<div class="rec-sl"><span class="rec-sl-ico">${def.emoji || '🎴'}</span>
      <span class="rec-sl-name">${def.name || card.sleightId}</span>
      <span class="rec-sl-where w-${w}">${w}</span><span class="rec-sl-uses">${uses}</span></div>`;
  }).join('') : `<div class="rec-empty">No ${entityLabel('sleight', true)} in the deck.</div>`;

  return `
    <div class="rec-summary">
      <div class="rec-stat"><span class="rec-stat-v">${counts.draw}</span><span class="rec-stat-l">In draw pile</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.grid}</span><span class="rec-stat-l">On board</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.played}</span><span class="rec-stat-l">Played</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.draw + counts.grid + counts.played}</span><span class="rec-stat-l">Deck size</span></div>
    </div>
    <div class="rec-deck-bar"><button class="rec-chip on" onclick="recordsDeckSetView('cards')">Show cards</button></div>
    <div class="rec-cols">
      <div class="rec-col rec-col-wide">
        <div class="rec-h">Deck map <span class="rec-h-note">every card, and where it is</span></div>
        <div class="rec-deck-grid">${head}${rows}</div>
        <div class="rec-legend">
          <span><i class="rec-key w-draw"></i>Draw pile</span>
          <span><i class="rec-key w-grid"></i>On board</span>
          <span><i class="rec-key w-played"></i>Played</span>
          <span><i class="rec-m rec-m-p"></i>+pips</span>
          <span><i class="rec-m rec-m-m"></i>+mult</span>
        </div>
      </div>
      <div class="rec-col">
        <div class="rec-h">Still drawable <span class="rec-h-note">by rank</span></div>
        <div class="rec-bars">${rankBars}</div>
      </div>
    </div>
    <div class="rec-h">${entityLabel('sleight', true)} in deck</div>
    <div class="rec-sl-list">${sleightHTML}</div>`;
}

// ══════════════════════════════════════════════
// OWNED - every owned entity, description shown by default
// ══════════════════════════════════════════════
// Two views (r721, owner), chosen from the tab's bar and kept per browser:
//   list - one row each: the object large on the left, its words on the right.
//   tray - the objects in a row near their tray size, the words under each;
//          a row for Tricks, then Knacks, then Sleights.
// `rar` is the TIER ID, and it is what colours the row - not the kind, which the
// object's SHAPE already says (r198).
const REC_OWNED_KEY = 'lethe.recOwnedView.v1';          // stored only when 'tray'
let recOwnedView = (() => { try { return localStorage.getItem(REC_OWNED_KEY) === 'tray' ? 'tray' : 'list'; } catch (e) { return 'list'; } })();
function recOwnedSet(v) {
  recOwnedView = v === 'tray' ? 'tray' : 'list';
  try { if (recOwnedView === 'tray') localStorage.setItem(REC_OWNED_KEY, 'tray'); else localStorage.removeItem(REC_OWNED_KEY); } catch (e) {}
  renderRecords();
}

// One owned entity as plain data: { kind, id, emoji, name, rar, tag, desc, off }.
function recordsOwnedLists() {
  const _tid = r => (typeof tierId === 'function' ? tierId(r) : 'common');
  const _off = t => (typeof isTrickDisabledByBoss === 'function') && isTrickDisabledByBoss(t.id);
  const tricks = trickTray.map(t => ({
    kind: 'trick', id: t.id, emoji: (typeof trickEmoji === 'function' ? trickEmoji(t) : '🃏'),
    name: t.name,
    rar: _tid(t.tier), tag: tierLabel('trick', t.tier).toUpperCase(),
    desc: (typeof trickLiveDesc === 'function' ? trickLiveDesc(t) : t.desc), off: _off(t) }));
  const knacks = acquiredKnacks.map(k => ({
    kind: 'knack', id: k.id, emoji: k.emoji || '🧿', name: k.name, rar: _tid(k.rarity),
    tag: tierLabel('knack', k.rarity).toUpperCase(),
    desc: (typeof knackLiveDesc === 'function' ? knackLiveDesc(k) : k.desc), off: false }));
  const sleights = [], seen = new Set();
  const pushSleight = card => {
    if (!card?._isSleight || seen.has(card._id)) return;
    seen.add(card._id);
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
    if (!def) return;
    const uses = card._usesLeft === 'infinite' ? '∞' : card._usesLeft;
    sleights.push({ kind: 'sleight', id: def.id, emoji: def.emoji || '🎴', name: def.name, rar: _tid(def.rarity),
      tag: `${tierLabel('sleight', def.rarity).toUpperCase()} · ${uses} LEFT`, desc: def.desc, off: false });
  };
  [...drawPile, ...playedPile].forEach(pushSleight);
  gridData.forEach(row => (row || []).forEach(pushSleight));
  return { tricks, knacks, sleights };
}

function recordsEntityTile(e) {
  return (typeof entityTileHTML === 'function')
    ? entityTileHTML({ entity: e.kind, id: e.id, emoji: e.emoji, label: e.name }, e.rar, { tip: false })
    : `<span class="rec-ent-ico">${e.emoji}</span>`;
}
function recordsEntityDesc(e) {
  return (typeof colorizeKeywords === 'function') ? colorizeKeywords(withSuitHalo(e.desc || '')) : (e.desc || '');
}
function recordsEntityRow(e) {
  return `<div class="rec-ent rec-ent-row rar-${e.rar}${e.off ? ' ent-off' : ''}">
    <div class="rec-ent-big">${recordsEntityTile(e)}</div>
    <div class="rec-ent-text">
      <div class="rec-ent-top"><span class="rec-ent-name">${e.name}</span><span class="rec-ent-tag">${e.off ? 'SWITCHED OFF' : e.tag}</span></div>
      <div class="rec-ent-desc">${recordsEntityDesc(e)}</div></div></div>`;
}
function recordsEntityTrayItem(e) {
  return `<div class="rec-ent rec-ent-tray rar-${e.rar}${e.off ? ' ent-off' : ''}">
    <div class="rec-ent-head"><div class="rec-ent-mid">${recordsEntityTile(e)}</div>
      <div class="rec-ent-id"><div class="rec-ent-name">${e.name}</div>
        <div class="rec-ent-tag">${e.off ? 'SWITCHED OFF' : e.tag}</div></div></div>
    <div class="rec-ent-desc">${recordsEntityDesc(e)}</div></div>`;
}

// r733 (owner): in the tray view the text lines up with the object's drawn left edge. The
// object is drawn inset in its frame (a floppy is centred in the frame and the owner's art is
// letterboxed narrower inside the disc; the diamond and the card are centred too), so each tile
// is pulled left by its own inset. Measured, because the inset depends on the art loaded.
function recOwnedAlign() {
  document.querySelectorAll('#records-body .rec-ent-tray').forEach(it => {
    const mid = it.querySelector('.rec-ent-mid'), cell = mid && mid.querySelector('.reward-cell');
    if (!cell) return;
    mid.style.removeProperty('--ent-inset');
    const cr = cell.getBoundingClientRect(), z = cell.offsetWidth ? cr.width / cell.offsetWidth : 1;
    let inset = null;
    const dia = cell.querySelector('.rwd-diamond');
    if (dia) inset = (dia.getBoundingClientRect().left - cr.left) / z;
    else {
      const b = getComputedStyle(cell, '::before'), w = parseFloat(b.width), l = parseFloat(b.left);
      if (isFinite(w) && isFinite(l)) {
        const m = (b.transform || '').match(/matrix\(([^)]+)\)/);
        const tx = m ? parseFloat(m[1].split(',')[4]) || 0 : 0;
        let art = w;
        // The owner's floppy art is drawn `contain` in the disc box: its width is --fa-<tier>-bs's first %.
        const tier = [...cell.classList].find(c => c.startsWith('rar-'));
        if (cell.classList.contains('entity-trick') && tier) {
          const bs = getComputedStyle(document.documentElement).getPropertyValue('--fa-' + tier.slice(4) + '-bs');
          const pct = parseFloat(bs);
          if (document.documentElement.classList.contains('fa-' + tier.slice(4)) && isFinite(pct)) art = w * pct / 100;
        }
        inset = l + tx + (w - art) / 2;
      }
    }
    if (inset != null && inset > 0.5) mid.style.setProperty('--ent-inset', inset.toFixed(1) + 'px');
  });
}

function recordsRenderPersonnel() {
  const L = recordsOwnedLists();
  const anyOff = L.tricks.some(e => e.off);
  const item = recOwnedView === 'tray' ? recordsEntityTrayItem : recordsEntityRow;
  const box = recOwnedView === 'tray' ? 'rec-ents-tray' : 'rec-ents-list';
  const sec = (kind, list, note) => `
    <div class="rec-h">${entityLabel(kind, true)} <span class="rec-h-note">${note}</span></div>
    ${list.length ? `<div class="${box}">${list.map(item).join('')}</div>`
                  : `<div class="rec-empty">No ${entityLabel(kind, true)} on file.</div>`}`;
  const chip = (v, txt) => `<button class="rec-chip${recOwnedView === v ? ' on' : ''}" onclick="recOwnedSet('${v}')">${txt}</button>`;
  return `
    <div class="rec-deck-bar"><span class="rec-bar-word">VIEW</span>${chip('list', 'List')}${chip('tray', 'Tray')}
      <span class="rec-h-note">Numbers are live. The clock is held while this is open.</span></div>
    ${sec('trick', L.tricks, `${L.tricks.length}${typeof trickCapacity === 'function' ? ' / ' + trickCapacity() : ''}${anyOff ? ' · <b class="rec-off-note">some switched off</b>' : ''}`)}
    ${sec('knack', L.knacks, L.knacks.length)}
    ${sec('sleight', L.sleights, L.sleights.length)}`;
}

// ══════════════════════════════════════════════
// LIMITS / TIME / PERFORMANCE tabs
// ══════════════════════════════════════════════
// One circle per step up to the limit's max (a step is the limit's own step, so
// Starting Time's 300s is 20 circles of 15s); lit circles are what you have now.
const recLimTime = s => (typeof formatTime === 'function') ? formatTime(s) : `${s}s`;
function recLimDots(def, l, shown) {
  // r756 (owner): Starting Time is read as a time, not 20 circles.
  if (def.id === 'round_time') return '';
  const step = l.step || def.step || 1;
  const total = Math.max(1, Math.round(l.max / step));
  const lit = Math.max(0, Math.min(total, Math.floor(shown / step)));
  let h = '';
  for (let i = 0; i < total; i++) h += `<i class="${i < lit ? 'on' : ''}"></i>`;
  return `<div class="rec-dots" title="${lit} of ${total}">${h}</div>`;
}
function recordsRenderLimits() {
  const rows = LIMITS_DEF.map(def => {
    const l = limits[def.id];
    const maxed = l.current >= l.max;
    const shown = limitShownValue(def.id), dl = limitShownDelta(def.id);
    const dlStr = dl ? ` <span style="color:${dl > 0 ? 'var(--gold)' : 'var(--red)'}">${dl > 0 ? '+' : ''}${dl}</span>` : '';
    // Luck is the one limit whose number means nothing on its own, so its row
    // prints the consequence: what a chance effect becomes, and the live rarity
    // table. Otherwise it is a stat you have to take on faith.
    let extra = def.desc;
    if (def.id === 'luck' && typeof luckTierPercents === 'function') {
      const pc = luckTierPercents();
      extra = `${def.desc}<br><span style="opacity:.75">Chance effects fire at ×${luckScale().toFixed(2)} · ` +
              ENTITY_TIERS.map((t, i) => `${tierLabel('_generic', t)} ${pc[i]}%`).join(' · ') + `</span>`;
    }
    return `<div class="rec-lim${maxed ? ' maxed' : ''}">
      <div class="rec-lim-top"><span><span class="rec-lim-ico">${emGlyph(def.icon)}</span>${def.label}</span>
        <span class="rec-lim-v">${def.id === 'round_time' ? recLimTime(shown) : shown}${dlStr}${def.hideMax ? '' : `<span class="rec-lim-max">/${def.id === 'round_time' ? recLimTime(l.max) : l.max}</span>`}${maxed ? ' <b>MAX</b>' : ''}</span></div>
      ${recLimDots(def, l, shown)}
      <div class="rec-lim-desc">${extra}</div></div>`;
  }).join('');
  return `<div class="rec-note">Operating allowances for this run. Raised at the Mart, by a Limit Break, or as a reward.</div>
    <div class="rec-lims">${rows}</div>`;
}

function recordsRenderTime() {
  if (typeof updateInteractCosts === 'function') updateInteractCosts(); // refresh the hidden pop-up's values
  const g = id => document.getElementById(id)?.textContent ?? '·';
  const dur = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : ROUND_DURATION;
  const cap = (typeof startingTimeSeconds === 'function') ? startingTimeSeconds() : dur;
  const fmt = s => (typeof formatTime === 'function') ? formatTime(Math.max(0, s)) : `${s}s`;
  const rows = [
    ['Play a hand',    g('ic-play'),    'Time charged when you submit a hand.'],
    ['Discard',        g('ic-discard'), 'Per card discarded.'],
    ['Swap',           g('ic-swap'),    'Flat, per swap.'],
  ].map(([k, v, d]) => `<div class="rec-lim"><div class="rec-lim-top"><span>${k}</span><span class="rec-lim-v">${v}</span></div><div class="rec-lim-desc">${d}</div></div>`).join('');
  const facts = [
    ['Time remaining', fmt(roundSeconds)],
    ['Starting Time',  fmt(cap)],
    ['Clock paused',   `${pausesThisRound || 0}×`],
    ['Clock rewound',  `${rewindsThisRound || 0}×`],
  ].map(([k, v]) => `<div class="rec-stat"><span class="rec-stat-v">${v}</span><span class="rec-stat-l">${k}</span></div>`).join('');
  return `<div class="rec-summary">${facts}</div>
    <div class="rec-h">Interaction charges <span class="rec-h-note">seconds off the clock</span></div>
    <div class="rec-lims">${rows}</div>`;
}

// The footer explains the ACTIVE scoring model, since two of the three make the
// Pips and Score columns meaningless.
function _recHandsFoot() {
  const m = (typeof scoringModel !== 'undefined') ? scoringModel : 'classic';
  if (m === 'hand_size') {
    return 'In this mode the hand type does not change your score directly. Mult is simply how '
         + 'many cards you played, and pips come only from the cards themselves. What a hand '
         + 'type is worth to you is the Focus it gives.';
  }
  if (m === 'card_ladder') {
    return 'In this mode the hand type does not change your score directly. Pips come only from '
         + 'the cards, and each card adds its place in the hand as mult: the first card +1, the '
         + 'second +2, and so on, again every time it replays. What a hand type is worth to you is '
         + 'the Focus it gives.';
  }
  if (m === 'mult_ladder') {
    return 'In this mode pips come only from the cards you play. The hand type sets the mult and '
         + 'the Focus it adds to the meter. Tricks, Knacks and your Focus multiplier build on top.';
  }
  return "Score is pips x mult, before your cards' own pips, Tricks, Knacks and your Focus "
       + 'multiplier. Focus is what the hand adds to the meter.';
}
// Natural Scaling appended to whichever model's wording is showing - it applies
// under all of them, since handBasePips/handBaseMult carry it.
function _recHandsFootFull() {
  const ns = (typeof nsEnabled !== 'undefined' && nsEnabled)
    ? ((typeof nsModel !== 'undefined' && nsModel === 'double')
        ? ' Playing hands of one FAMILY (sets, runs, flushes) grows every card in that family: every '
          + ns2.pipsEvery + ' plays each card pays +' + ns2.pipsPer + ' pips, every ' + ns2.multEvery
          + ' plays the family climbs one step of the mult ladder. '
          + (typeof nsFamilySummary === 'function' ? nsFamilySummary().replace(/\n/g, ' · ') : '')
        : ' Playing a hand permanently raises THAT HAND, and nothing else - so a hand you have played'
          + ' forty times can out-score one you have never reached. Green is what this run has earned.')
    : '';
  const lay = (typeof layeredHandsEnabled !== 'undefined' && layeredHandsEnabled)
    ? ' Cards that are two hands at once pay for both, and score twice.'
    : '';
  return _recHandsFoot() + ns + lay;
}

// ── HANDS ──
// What each hand is worth. Read LIVE from HAND_BASE / HAND_FOCUS, never from a
// written-out table: both are global and modes overwrite them, so a written copy
// drifts. Spectrum zeroes Flush of 3, and this screen shows that.
//
// A hand the current mode does not score is listed as UNAVAILABLE with no
// numbers. Showing its numbers greyed invited the reader to compare a price that
// is not on offer; the row stays so the absence is visible, but it stops
// pretending to be a quote.
//
// activeHands holds KEYS (run3, twopair) and both value tables are keyed by
// NAME, so the reverse of HAND_KEY_TO_NAME is what joins them.
// The pre-r721 rate table: any scoring model but the card ladder with double scaling.
function recordsRenderHandsTable() {
  const nameToKey = {};
  Object.entries(HAND_KEY_TO_NAME).forEach(([k, n]) => { nameToKey[n] = k; });
  const playable = name => { const k = nameToKey[name]; return !k || activeHands.has(k); };

  const listed = Object.keys(HAND_BASE).filter(handTypeListed);
  const rows = listed.map(name => {
    if (!playable(name)) {
      return `<div class="rec-hand off">
        <span class="rh-n">${name}</span>
        <span class="rh-off">Unavailable</span>
      </div>`;
    }
    // Read through the model helpers, so switching the scoring model in the dev
    // panel is reflected here rather than quoting a table the scorer ignores.
    const pips  = handBasePips(name);
    const mult  = handBaseMult(name);
    const focus = (typeof handFocusValue === 'function' ? handFocusValue(name) : (HAND_FOCUS[name] || 0));
    const sizeMult = (typeof scoringModel !== 'undefined') && (scoringModel === 'hand_size' || scoringModel === 'card_ladder');
    // pips/mult above already INCLUDE Natural Scaling (handBasePips/handBaseMult
    // fold it in), so this only splits out how much of the quote this run earned.
    const ns    = (typeof naturalScaleBonus === 'function') ? naturalScaleBonus(name) : { pips: 0, mult: 0 };
    const gain  = ns.pips ? `<span class="rh-ns">+${ns.pips}</span>` : '';
    const gainM = ns.mult ? `<span class="rh-ns">+${ns.mult}</span>` : '';
    // pips x mult is the number that decides which hand to go for; the two
    // factors on their own do not compare across rows.
    const base  = Math.round(pips * mult);
    return `<div class="rec-hand">
      <span class="rh-n">${name}</span>
      <span class="rh-v rh-p">${pips}${gain}</span>
      <span class="rh-v rh-m">${sizeMult ? (scoringModel === 'card_ladder' ? '1+2+..' : 'cards') : 'x' + mult}${gainM}</span>
      <span class="rh-v rh-f">${focus || 0}</span>
      <span class="rh-v rh-b">${sizeMult || !pips ? '&middot;' : base.toLocaleString()}</span>
    </div>`;
  }).join('');

  const all  = listed;
  const live = all.filter(playable).length;
  const sel  = (typeof limits !== 'undefined' && limits.selection) ? limits.selection.current : 5;
  const more = sel < 7 ? `<div class="rec-foot">${sel < 6 ? '6- and 7-card hands' : '7-card hands'} are listed once Hand Size reaches ${sel < 6 ? 6 : 7}.</div>` : '';
  return `<div class="rec-h">Hand values
      <span class="rec-h-note">${live} of ${all.length} score in this mode</span></div>
    <div class="rec-hand rec-hand-head">
      <span class="rh-n">Hand</span><span class="rh-v">Pips</span><span class="rh-v">Mult</span>
      <span class="rh-v">Focus</span><span class="rh-v">Score</span>
    </div>
    <div class="rec-hands">${rows}</div>${more}
    <div class="rec-foot">${_recHandsFootFull()}</div>`;
}

// ── HANDS (r721, owner) ──
// Under the card ladder with double scaling (the shipped game) a hand's TYPE does
// not price it: every card pays its place in the hand as mult, and what grows is
// the FAMILY (set / run / flush). Focus is the one thing that is per hand type.
// So the tab has two views:
//   SCORE - one example hand per family, as real cards, with what each card pays
//           under it (place + the family's step as mult, the family's bonus pips),
//           cards past the Hand Size dimmed, and how far the next step is.
//   FOCUS - every hand type as a small hand of cards with the Focus it adds;
//           hands bigger than the Hand Size, or not in this mode, are folded away.
// Under both, one fold per hand with whatever is worth knowing about it.
// Every number is read live (nsFamStep / nsFamPips / ns2 / HAND_FOCUS); a dev
// model other than card ladder + double scaling falls back to the old table.
let recHandsView = 'score';                // 'score' | 'focus'
function recHandsSet(v) { recHandsView = v === 'focus' ? 'focus' : 'score'; renderRecords(); }

const _RX = s => s.trim().split(/\s+/).map(t => [t.slice(0, -1), t.slice(-1)]);
// Each family's example, long enough for a 7-card Hand Size. Read left to right,
// each prefix is the family's hand of that size where one exists.
const REC_FAMILIES = [
  { id: 'set',   word: 'SETS',    ex: _RX('7♠ 7♥ 7♦ K♣ K♥ K♦ K♠') },
  { id: 'run',   word: 'RUNS',    ex: _RX('5♠ 6♥ 7♦ 8♣ 9♥ 10♠ J♦') },
  { id: 'flush', word: 'FLUSHES', ex: _RX('2♥ 5♥ 9♥ J♥ K♥ 4♥ Q♥') },
];
const REC_HAND_EX = {
  'Pair': '7♠ 7♥', 'Three of a Kind': '7♠ 7♥ 7♦', 'Two Pair': '7♠ 7♥ K♣ K♦',
  'Four of a Kind': '7♠ 7♥ 7♦ 7♣', 'Full House': '7♠ 7♥ 7♦ K♣ K♦',
  'Five of a Kind': '7♠ 7♥ 7♦ 7♣ 7♠', 'Six of a Kind': '7♠ 7♥ 7♦ 7♣ 7♠ 7♥', 'Seven of a Kind': '7♠ 7♥ 7♦ 7♣ 7♠ 7♥ 7♦',
  'Run of 3': '5♠ 6♥ 7♦', 'Run of 4': '5♠ 6♥ 7♦ 8♣', 'Straight': '5♠ 6♥ 7♦ 8♣ 9♥',
  'Run of 6': '5♠ 6♥ 7♦ 8♣ 9♥ 10♠', 'Run of 7': '5♠ 6♥ 7♦ 8♣ 9♥ 10♠ J♦',
  'Flush of 3': '2♥ 9♥ K♥', 'Flush of 4': '2♥ 5♥ 9♥ K♥', 'Flush': '2♥ 5♥ 9♥ J♥ K♥',
  'Flush of 6': '2♥ 4♥ 5♥ 9♥ J♥ K♥', 'Flush of 7': '2♥ 4♥ 5♥ 9♥ J♥ Q♥ K♥',
  'Straight Flush': '5♥ 6♥ 7♥ 8♥ 9♥',
};
const REC_FOCUS_GROUPS = [
  { word: 'SETS',    hands: ['Pair', 'Three of a Kind', 'Two Pair', 'Four of a Kind', 'Full House', 'Five of a Kind', 'Six of a Kind', 'Seven of a Kind'] },
  { word: 'RUNS',    hands: ['Run of 3', 'Run of 4', 'Straight', 'Run of 6', 'Run of 7'] },
  { word: 'FLUSHES', hands: ['Flush of 3', 'Flush of 4', 'Flush', 'Flush of 6', 'Flush of 7'] },
  { word: 'BOTH',    hands: ['Straight Flush'] },
];

function _recSel() { return (typeof limits !== 'undefined' && limits.selection) ? limits.selection.current : 5; }
// The name the hand preview prints (HAND_LABEL, r611): SET OF 3, RUN OF 4, TWO PAIR.
function recHandWord(name) {
  const l = HAND_LABEL[name];
  if (!l) return name.toUpperCase();
  return /^\d+$/.test(l.size) ? `${l.fam} OF ${l.size}` : `${l.fam} ${l.size}`.trim();
}
// A real card face for a made-up card. The id is ours, so no store has anything on it.
let _recFaceN = 0;
function recCardFace(rank, suit) {
  const card = { rank, suit, _id: 'rec-x-' + (++_recFaceN) };
  const { className, innerHTML } = renderCardAppearance(card, -1, -1, { revealFog: true });
  return `<div class="${className}">${innerHTML}</div>`;
}
function recHandLadderOn() {
  return (typeof scoringModel !== 'undefined' && scoringModel === 'card_ladder')
      && (typeof nsDoubleOn === 'function' && nsDoubleOn());
}
// n of every, as a strip of squares (the stock squares' look).
function recProgress(have, every) {
  const n = Math.max(1, every), k = have % n;
  const segs = Math.min(n, 15);
  const lit = Math.floor(k / n * segs);
  return `<span class="rh-prog">${'<i class="on"></i>'.repeat(lit)}${'<i></i>'.repeat(segs - lit)}</span>`;
}

function recordsHandsScore() {
  const sel = _recSel(), n = Math.min(7, Math.max(5, sel));
  const rows = REC_FAMILIES.map(f => {
    const step = nsFamStep(f.id), pips = nsFamPips(f.id), plays = (nsFamPlays || {})[f.id] || 0;
    const cards = f.ex.slice(0, n).map(([rk, s], i) => {
      const on = i < sel, m = i + 1 + step;
      return `<div class="rh-slot${on ? '' : ' off'}">
        <div class="rh-face">${recCardFace(rk, s)}</div>
        <div class="rh-pay"><span class="rh-m"><b>${m}</b> MULT${step ? `<em>+${step}</em>` : ''}</span>
          <span class="rh-p">${pips ? `<b>+${pips}</b> PIP${pips > 1 ? 'S' : ''}` : '&middot;'}</span></div></div>`;
    }).join('');
    const mLeft = ns2.multEvery - plays % ns2.multEvery, pLeft = ns2.pipsEvery - plays % ns2.pipsEvery;
    return `<div class="rh-fam">
      <div class="rh-fam-word">${f.word}</div>
      <div class="rh-hand">${cards}</div>
      <div class="rh-next">
        <div class="rh-next-row"><span>PLAYED</span><b>${plays}</b></div>
        <div class="rh-next-row">${recProgress(plays, ns2.multEvery)}<span><b>+${ns2.multStep}</b> MULT IN <b>${mLeft}</b></span></div>
        <div class="rh-next-row">${recProgress(plays, ns2.pipsEvery)}<span><b>+${ns2.pipsPer}</b> PIP IN <b>${pLeft}</b></span></div>
      </div></div>`;
  }).join('');
  const dim = n > sel ? ` Dim cards are past your Hand Size (${sel}).` : '';
  return `<div class="rec-note">Each card pays its place in the hand as mult (the first card you pick is 1), again every time it replays. Playing a family moves all of its hands up.${dim}</div>
    <div class="rh-fams">${rows}</div>
    <div class="rec-note">A same-suit run is a run and a flush at once: every card scores twice, both families count the play, and it scores with the better family's bonus.</div>`;
}

function recFocusRow(name, why) {
  const f = (typeof handFocusValue === 'function' ? handFocusValue(name) : (HAND_FOCUS[name] || 0));
  const half = (typeof FOCUS_HALF_SPEED_HANDS !== 'undefined') && FOCUS_HALF_SPEED_HANDS.has(name);
  const cards = _RX(REC_HAND_EX[name] || '').map(([rk, s]) => `<div class="rh-mini">${recCardFace(rk, s)}</div>`).join('');
  return `<div class="rh-frow${why ? ' off' : ''}">
    <div class="rh-mhand">${cards}</div>
    <div class="rh-fname">${recHandWord(name)}${why ? `<small>${why}</small>` : half ? '<small>half the speed bonus</small>' : ''}</div>
    <div class="rh-fval"><span class="rh-fbar">${'<i></i>'.repeat(Math.max(0, Math.min(f, 14)))}</span><b>${f}</b></div></div>`;
}
function recordsHandsFocus() {
  const sel = _recSel();
  const now = [], later = [];
  REC_FOCUS_GROUPS.forEach(g => {
    const a = [], b = [];
    g.hands.forEach(h => {
      if (!(h in HAND_FOCUS) || !HAND_CARD_COUNT[h]) return;
      const size = HAND_CARD_COUNT[h];
      if (!handIsActive(h)) b.push(recFocusRow(h, 'not unlocked'));
      else if (size > sel) b.push(recFocusRow(h, `needs Hand Size ${size}`));
      else a.push(recFocusRow(h));
    });
    if (a.length) now.push(`<div class="rh-fgroup"><div class="rh-fam-word">${g.word}</div>${a.join('')}</div>`);
    if (b.length) later.push(`<div class="rh-fgroup"><div class="rh-fam-word">${g.word}</div>${b.join('')}</div>`);
  });
  return `<div class="rec-note">Focus belongs to the hand, not its cards. A hand adds this much to the meter, plus a bonus for playing it fast. A same-suit run adds the run's Focus only.</div>
    <div class="rh-focus">${now.join('') || '<div class="rec-empty">None.</div>'}</div>
    ${later.length ? `<details class="rec-fold"><summary>BIGGER AND LOCKED HANDS <span>need a larger Hand Size, or an unlock</span></summary><div class="rh-focus">${later.join('')}</div></details>` : ''}`;
}

// The owned Tricks and Knacks whose words name this hand. Longer names are taken
// out first, so "Flush" does not find "Straight Flush" and "Pair" not "Two Pair".
function recHandMentions(name) {
  const names = Object.keys(HAND_CARD_COUNT).sort((a, b) => b.length - a.length);
  const found = [];
  const look = (ent, desc) => {
    let d = String(desc || '').replace(/<[^>]+>/g, ' ');
    let hit = false;
    names.forEach(n => {
      const re = new RegExp('\\b' + n.replace(/ /g, '\\s+') + '(e?s)?\\b', 'gi');
      if (re.test(d)) { if (n === name) hit = true; d = d.replace(re, ' '); }
    });
    if (hit) found.push(ent.name);
  };
  trickTray.forEach(t => look(t, typeof trickLiveDesc === 'function' ? trickLiveDesc(t) : t.desc));
  acquiredKnacks.forEach(k => look(k, typeof knackLiveDesc === 'function' ? knackLiveDesc(k) : k.desc));
  return found;
}
function recordsHandFiles() {
  const sel = _recSel();
  const plays = (typeof crHandPlays === 'object' && crHandPlays) || {};
  const nameToKey = {};
  Object.entries(HAND_KEY_TO_NAME).forEach(([k, n]) => { nameToKey[n] = k; });
  const list = REC_FOCUS_GROUPS.flatMap(g => g.hands).filter(h => HAND_CARD_COUNT[h] && (HAND_CARD_COUNT[h] <= Math.max(5, sel) || handIsActive(h)));
  const files = list.map(h => {
    const size = HAND_CARD_COUNT[h], lines = [];
    const fams = (NS_HAND_FAMILIES[h] || []).map(f => f.toUpperCase());
    lines.push(`${size} cards · ${fams.join(' and ')}${fams.length > 1 ? ' (counts for both)' : ''}`);
    const half = FOCUS_HALF_SPEED_HANDS.has(h);
    lines.push(`Focus ${(typeof handFocusValue === 'function' ? handFocusValue(h) : (HAND_FOCUS[h] || 0))}${half ? ', and half the speed bonus' : ''}`);
    lines.push(`Played ${plays[h] || 0} time${plays[h] === 1 ? '' : 's'} this run`);
    if (!handIsActive(h)) {
      const u = (typeof UNLOCK_PROGRESS !== 'undefined') ? UNLOCK_PROGRESS.find(x => x.key === nameToKey[h]) : null;
      lines.push(u ? 'Unlocks with ' + u.paths.map(p => `${p.label} ${typeof p.cur === 'function' ? p.cur() : p.cur}/${p.goal}`).join(', or ') : 'Not unlocked yet');
    } else if (size > sel) lines.push(`Needs Hand Size ${size} (you have ${sel})`);
    const m = recHandMentions(h);
    if (m.length) lines.push(`Named by ${m.join(', ')}`);
    return `<details class="rec-hf${handIsActive(h) && size <= sel ? '' : ' off'}"><summary>${recHandWord(h)}<span>${plays[h] || 0}</span></summary>
      <div class="rec-hf-body">${lines.map(l => `<div>${l}</div>`).join('')}</div></details>`;
  }).join('');
  return `<details class="rec-fold"><summary>HAND FILES <span>one per hand</span></summary><div class="rec-hfs">${files}</div></details>`;
}

function recordsRenderHands() {
  if (!recHandLadderOn()) return recordsRenderHandsTable();
  const chip = (v, txt) => `<button class="rec-chip${recHandsView === v ? ' on' : ''}" onclick="recHandsSet('${v}')">${txt}</button>`;
  return `<div class="rec-deck-bar"><span class="rec-bar-word">SHOW</span>${chip('score', 'Score')}${chip('focus', 'Focus')}</div>
    ${recHandsView === 'focus' ? recordsHandsFocus() : recordsHandsScore()}
    ${recordsHandFiles()}`;
}

function recordsRenderStats() {
  const activeRows = [...activeHands].map(k => {
    const name = HAND_KEY_TO_NAME[k] || k;
    return `<div class="rec-row"><span>${name}</span>
      <span class="rec-row-v">${C[k] || 0}× <i>${HAND_FORMULAS[name] || ''}</i></span></div>`;
  }).join('') || `<div class="rec-empty">None.</div>`;

  const unlockRows = UNLOCK_PROGRESS.filter(u => !unlockedHands.has(u.key)).map(u => {
    const paths = u.paths.map(p => {
      const cur = typeof p.cur === 'function' ? p.cur() : p.cur;
      return `${p.label}: ${cur}/${p.goal}`;
    }).join(' · ');
    return `<div class="rec-row locked"><span>⬡ ${u.name}</span><span class="rec-row-v">${paths}</span></div>`;
  }).join('') || `<div class="rec-empty">All hands unlocked.</div>`;

  const counters = [
    ['Level', level], ['Round goal', roundGoal.toLocaleString()], ['Hands played', handsPlayed],
    [entityLabel('trick', true) + ' held', acquiredTricks.length], ['Aces played', C.aces], ['Hearts played', C.hearts],
    ['Faces played', C.faces], ['Same-suit hands', C.sameSuitHands],
  ].map(([k, v]) => `<div class="rec-row"><span>${k}</span><span class="rec-row-v">${v}</span></div>`).join('');

  return `<div class="rec-cols">
      <div class="rec-col"><div class="rec-h">Active hands</div>${activeRows}</div>
      <div class="rec-col"><div class="rec-h">Unlock progress</div>${unlockRows}</div>
      <div class="rec-col"><div class="rec-h">Counters</div>${counters}</div>
    </div>`;
}
