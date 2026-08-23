// ══════════════════════════════════════════════
// RECORDS — the combined info hub (r155)
// ══════════════════════════════════════════════
// Replaces the four separate secondary chips (Stats / Deck / Time / Limits) with a
// single large tabbed pop-up that PAUSES the round while it is open. Tabs:
//   DECK · TIME · LIMITS · PERFORMANCE · PERSONNEL FILE
// Each tab is a render function in RECORDS_TABS — adding a tab is one entry.

let recordsOpen = false;
let recordsTab  = 'deck';

const RECORDS_TABS = [
  { id: 'deck',      label: 'Deck',           icon: '🂠', render: () => recordsRenderDeck() },
  { id: 'personnel', label: 'Personnel File', icon: '📁', render: () => recordsRenderPersonnel() },
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
          <div class="rec-brand"><span class="rec-dot"></span>LETHE CORP · RECORDS</div>
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
}

function closeRecords() {
  if (!recordsOpen) return;
  recordsOpen = false;
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
       <span class="rec-tab-ico">${t.icon}</span>${t.label}</button>`).join('');
  const tab = RECORDS_TABS.find(t => t.id === recordsTab) || RECORDS_TABS[0];
  bodyEl.innerHTML = tab.render();
}

// ══════════════════════════════════════════════
// DECK TAB — a real deck read-out (r155 overhaul)
// ══════════════════════════════════════════════
// The old view was a flat list of rank chips, which told you almost nothing. This
// one answers the question you actually have mid-round: WHAT IS LEFT TO DRAW, and
// which of my cards are buffed. It is a rank × suit matrix — every cell is one card
// of the deck, coloured by where that card currently is (draw pile / grid / played),
// and flagged if it carries permanent pips or mult.
function recordsDeckCensus() {
  const where = {};                      // cardKey → 'draw' | 'grid' | 'played'
  const add = (c, w) => { if (c && c.rank && !c._isSleight) where[cardKey(c.rank, c.suit)] = w; };
  drawPile.forEach(c => add(c, 'draw'));
  playedPile.forEach(c => add(c, 'played'));
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) add(gridData[r]?.[c], 'grid');
  return where;
}

function recordsRenderDeck() {
  const where = recordsDeckCensus();
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;
  const counts = { draw: 0, grid: 0, played: 0 };
  Object.values(where).forEach(w => { if (counts[w] !== undefined) counts[w]++; });

  // Rank × suit matrix.
  const head = `<div class="rec-deck-row rec-deck-head"><span class="rec-deck-corner"></span>` +
    RANKS.map(r => `<span class="rec-deck-rank">${r}</span>`).join('') + `</div>`;
  const rows = suits.map(s => {
    const cells = RANKS.map(rk => {
      const k = cardKey(rk, s);
      const w = where[k];
      const pp = permPips[k] || 0, pm = permMult[k] || 0;
      const cls = ['rec-deck-cell', w ? 'w-' + w : 'w-gone', pp ? 'has-pip' : '', pm ? 'has-mult' : ''].filter(Boolean).join(' ');
      const tip = `${rk}${s} — ${w === 'draw' ? 'in draw pile' : w === 'grid' ? 'on the board' : w === 'played' ? 'played (returns next round)' : 'not in deck'}` +
                  `${pp ? ` · +${pp} pips` : ''}${pm ? ` · +${pm} mult` : ''}`;
      const marks = (pp ? '<i class="rec-m rec-m-p"></i>' : '') + (pm ? '<i class="rec-m rec-m-m"></i>' : '');
      return `<span class="${cls}" title="${tip}">${rk}${marks}</span>`;
    }).join('');
    const left = suits.filter(x => x === s).length; // placeholder to keep map simple
    const remaining = RANKS.filter(rk => where[cardKey(rk, s)] === 'draw').length;
    return `<div class="rec-deck-row">
      <span class="rec-deck-suit ${suitClass(s)}">${s}<b>${remaining}</b></span>${cells}</div>`;
  }).join('');

  // Remaining-by-rank bar (what is still drawable) — the planning tool.
  const rankBars = RANKS.map(rk => {
    const left = suits.filter(s => where[cardKey(rk, s)] === 'draw').length;
    const pct = Math.round((left / suits.length) * 100);
    return `<div class="rec-bar"><span class="rec-bar-l">${rk}</span>
      <span class="rec-bar-track"><span class="rec-bar-fill" style="width:${pct}%"></span></span>
      <span class="rec-bar-v">${left}</span></div>`;
  }).join('');

  // Sleights are deck cards too — list them with charges left.
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
  }).join('') : `<div class="rec-empty">No Sleights in the deck.</div>`;

  return `
    <div class="rec-summary">
      <div class="rec-stat"><span class="rec-stat-v">${counts.draw}</span><span class="rec-stat-l">In draw pile</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.grid}</span><span class="rec-stat-l">On board</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.played}</span><span class="rec-stat-l">Played</span></div>
      <div class="rec-stat"><span class="rec-stat-v">${counts.draw + counts.grid + counts.played}</span><span class="rec-stat-l">Deck size</span></div>
    </div>
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
    <div class="rec-h">Sleights in deck</div>
    <div class="rec-sl-list">${sleightHTML}</div>`;
}

// ══════════════════════════════════════════════
// PERSONNEL FILE — every owned entity, description shown by default
// ══════════════════════════════════════════════
function recordsEntityCard(icon, name, tag, desc, cls) {
  const d = (typeof colorizeKeywords === 'function') ? colorizeKeywords(withSuitHalo(desc || '')) : (desc || '');
  return `<div class="rec-ent ${cls}">
    <div class="rec-ent-top"><span class="rec-ent-ico">${icon}</span>
      <span class="rec-ent-name">${name}</span><span class="rec-ent-tag">${tag}</span></div>
    <div class="rec-ent-desc">${d}</div></div>`;
}

function recordsRenderPersonnel() {
  // Tricks (side tray), Sleights (owned deck cards), Knacks (permanent).
  const tricks = (typeof trickTray !== 'undefined' && trickTrayMode) ? trickTray : acquiredTricks;
  const trickHTML = tricks.length ? tricks.map(t => recordsEntityCard(
    (typeof trickEmoji === 'function' ? trickEmoji(t) : '🃏'), t.name,
    (t.tier || 'common').toUpperCase(),
    (typeof trickLiveDesc === 'function' ? trickLiveDesc(t) : t.desc), 'e-trick')).join('')
    : `<div class="rec-empty">No Tricks on file.</div>`;

  const owned = [];
  const seen = new Set();
  const pushSleight = card => {
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
    if (!def) return;
    const uses = card._usesLeft === 'infinite' ? '∞' : card._usesLeft;
    owned.push(recordsEntityCard(def.emoji || '🎴', def.name, `${(def.rarity || 'common').toUpperCase()} · ${uses} left`, def.desc, 'e-sleight'));
  };
  [...drawPile, ...playedPile].forEach(c => { if (c._isSleight && !seen.has(c._id)) { seen.add(c._id); pushSleight(c); } });
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) { const x = gridData[r]?.[c]; if (x?._isSleight && !seen.has(x._id)) { seen.add(x._id); pushSleight(x); } }
  const sleightHTML = owned.length ? owned.join('') : `<div class="rec-empty">No Sleights on file.</div>`;

  const knackHTML = acquiredKnacks.length ? acquiredKnacks.map(k => recordsEntityCard(
    k.emoji || '🧿', k.name, (k.rarity || 'knack').toUpperCase(), k.desc, 'e-knack')).join('')
    : `<div class="rec-empty">No Knacks on file.</div>`;

  return `
    <div class="rec-note">Active personnel and equipment. Descriptions reflect current values — the clock is held while this file is open.</div>
    <div class="rec-h">Tricks <span class="rec-h-note">${tricks.length}${typeof trickCapacity === 'function' ? ' / ' + trickCapacity() : ''}</span></div>
    <div class="rec-ents">${trickHTML}</div>
    <div class="rec-h">Sleights <span class="rec-h-note">${owned.length}</span></div>
    <div class="rec-ents">${sleightHTML}</div>
    <div class="rec-h">Knacks <span class="rec-h-note">${acquiredKnacks.length}</span></div>
    <div class="rec-ents">${knackHTML}</div>`;
}

// ══════════════════════════════════════════════
// LIMITS / TIME / PERFORMANCE tabs
// ══════════════════════════════════════════════
function recordsRenderLimits() {
  const rows = LIMITS_DEF.map(def => {
    const l = limits[def.id];
    const maxed = l.current >= l.max;
    const pct = def.hideMax ? 100 : Math.round(((l.current - def.base) / Math.max(1, l.max - def.base)) * 100);
    return `<div class="rec-lim${maxed ? ' maxed' : ''}">
      <div class="rec-lim-top"><span><span class="rec-lim-ico">${def.icon}</span>${def.label}</span>
        <span class="rec-lim-v">${l.current}${def.hideMax ? '' : `<span class="rec-lim-max">/${l.max}</span>`}${maxed ? ' <b>MAX</b>' : ''}</span></div>
      <div class="rec-bar-track"><span class="rec-bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
      <div class="rec-lim-desc">${def.desc}</div></div>`;
  }).join('');
  return `<div class="rec-note">Operating allowances for this run. Raised at the Mart, by a Limit Break, or as a reward.</div>
    <div class="rec-lims">${rows}</div>`;
}

function recordsRenderTime() {
  if (typeof updateInteractCosts === 'function') updateInteractCosts(); // refresh the hidden pop-up's values
  const g = id => document.getElementById(id)?.textContent ?? '—';
  const dur = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : ROUND_DURATION;
  const cap = Math.max(dur, limits.round_time.current) - (roundPenaltySeconds || 0);
  const fmt = s => (typeof formatTime === 'function') ? formatTime(Math.max(0, s)) : `${s}s`;
  const rows = [
    ['Play a hand',    g('ic-play'),    'Time charged when you submit a hand.'],
    ['Discard',        g('ic-discard'), 'Per card discarded.'],
    ['Swap',           g('ic-swap'),    'Flat, per swap.'],
  ].map(([k, v, d]) => `<div class="rec-lim"><div class="rec-lim-top"><span>${k}</span><span class="rec-lim-v">${v}</span></div><div class="rec-lim-desc">${d}</div></div>`).join('');
  const facts = [
    ['Time remaining', fmt(roundSeconds)],
    ['Round length',   fmt(cap)],
    ['Clock paused',   `${pausesThisRound || 0}×`],
    ['Clock rewound',  `${rewindsThisRound || 0}×`],
  ].map(([k, v]) => `<div class="rec-stat"><span class="rec-stat-v">${v}</span><span class="rec-stat-l">${k}</span></div>`).join('');
  return `<div class="rec-summary">${facts}</div>
    <div class="rec-h">Interaction charges <span class="rec-h-note">seconds off the clock</span></div>
    <div class="rec-lims">${rows}</div>`;
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
    ['Tricks held', acquiredTricks.length], ['Aces played', C.aces], ['Hearts played', C.hearts],
    ['Faces played', C.faces], ['Same-suit hands', C.sameSuitHands],
  ].map(([k, v]) => `<div class="rec-row"><span>${k}</span><span class="rec-row-v">${v}</span></div>`).join('');

  return `<div class="rec-cols">
      <div class="rec-col"><div class="rec-h">Active hands</div>${activeRows}</div>
      <div class="rec-col"><div class="rec-h">Unlock progress</div>${unlockRows}</div>
      <div class="rec-col"><div class="rec-h">Counters</div>${counters}</div>
    </div>`;
}
