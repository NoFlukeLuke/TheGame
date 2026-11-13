// ══════════════════════════════════════════════════════════════════════════
// COMPARE BUILDS (r640, owner) - a sandbox board inside BUILDS where one hand
// is scored by up to four builds at once.
//
// Pick a line-up (the draft and saved builds, each in its own colour), deal a
// board of real cards, tap a hand: every build's PIPS x MULT = SCORE reads out
// live, the best lit. LOG HAND banks it (the cards are replaced from the deck,
// as a round would), so a sequence of hands builds a tally per build, and each
// Trick's count of how often it went off. A build's column opens to its
// breakdown: the base, every Trick's pips and mult for this hand, and the
// fired count over the logged hands.
//
// THE SCORE IS THE GAME'S. Nothing is modelled: for each build the run's
// globals that calcScore reads (the board, the tray, the knacks, the
// selection, the streak) are swapped for the sandbox's, calcScore runs with a
// contributions list and a ledger, and everything is put back. calcScore is
// read-only, so the swap is safe. What is NOT simulated: Focus (held at x1),
// a Sleight's effect (it would have to be on the board), the run's counters
// (cards scored this run, level-ups), improvements (tier 0). The panel says so.
// ══════════════════════════════════════════════════════════════════════════

const BC_COLORS = ['#ffb02e', '#94ecb0', '#a4c6ff', '#ff8fb8'];
const BC_MAX = 4;
let bc = null;   // sandbox state while open

function bcBuilds() {
  const list = [];
  const n = draftBuild.tricks.length + draftBuild.sleights.length + draftBuild.knacks.length;
  if (n) list.push({ key: '·draft', name: draftBuild.name || 'Draft', tricks: draftBuild.tricks, sleights: draftBuild.sleights, knacks: draftBuild.knacks });
  loadSavedBuilds().forEach(b => list.push({ key: b.name, name: b.name, tricks: b.tricks, sleights: b.sleights, knacks: b.knacks }));
  return list;
}

function bcOpen() {
  const el = document.getElementById('builds-overlay'); if (!el) return;
  const all = bcBuilds();
  if (!bc) {
    bc = { rows: 4, cols: 4, deck: [], grid: [], selected: [], lineup: [], history: [], tally: {}, open: null, lastHandType: null, streak: 0 };
    // Start with the first builds listed, up to two.
    bc.lineup = all.slice(0, 2).map(b => b.key);
    bcDeal();
  }
  bc.lineup = bc.lineup.filter(k => all.some(b => b.key === k));
  el.classList.add('compare-on');
  let box = document.getElementById('bv-compare');
  if (!box) { box = document.createElement('div'); box.id = 'bv-compare'; el.appendChild(box); }
  bcRender();
}
function bcClose() {
  const el = document.getElementById('builds-overlay'); if (!el) return;
  el.classList.remove('compare-on');
}

// ── the sandbox deck and board ──────────────────────────────────────────────
function bcFreshDeck() {
  const out = [];
  SUITS.forEach(s => RANKS.forEach(r => out.push(stampId({ rank: r, suit: s }))));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function bcDraw() { if (!bc.deck.length) bc.deck = bcFreshDeck(); return bc.deck.pop(); }
function bcDeal() {
  bc.deck = bcFreshDeck();
  bc.grid = [];
  for (let r = 0; r < bc.rows; r++) { bc.grid[r] = []; for (let c = 0; c < bc.cols; c++) bc.grid[r][c] = bcDraw(); }
  bc.selected = [];
}
function bcSelMax() { return 5; }   // a mid-run hand size; the menu's limits still read the start of a run
function bcAdjacent(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }
function bcReachable(r, c) { return !bc.selected.length || bc.selected.some(s => bcAdjacent(s, [r, c])); }
function bcTap(r, c) {
  const i = bc.selected.findIndex(([a, b]) => a === r && b === c);
  if (i >= 0) bc.selected.splice(i);                       // it and everything picked after it
  else if (bc.selected.length < bcSelMax() && bcReachable(r, c)) bc.selected.push([r, c]);
  else return;
  bcRender();
}

// ── scoring one hand with one build ─────────────────────────────────────────
function bcEntities(b) {
  return {
    tricks: (b.tricks || []).map(id => TRICK_POOL_ALL.find(t => t.id === id)).filter(Boolean).map(t => ({ ...t })),
    knacks: (b.knacks || []).map(id => KNACK_POOL.find(k => k.id === id)).filter(Boolean).map(k => ({ ...k })),
    sleights: (b.sleights || []).map(id => SLEIGHT_POOL.find(s => s.id === id)).filter(Boolean),
  };
}
function bcScore(b, cells) {
  if (!cells || cells.length < 2) return null;
  const ents = bcEntities(b);
  const keep = { gridData, gridRows, gridCols, trickTray, acquiredKnacks, selected, streakCount, lastHandType, activeHands };
  gridData = bc.grid; gridRows = bc.rows; gridCols = bc.cols; selected = cells.slice();
  activeHands = new Set(Object.values(HAND_NAME_TO_KEY));   // every hand, as a Classic run starts; the menu's default is the legacy four
  trickTray = ents.tricks; acquiredKnacks = ents.knacks;
  streakCount = bc.streak; lastHandType = bc.lastHandType;
  try {
    const comp = handComponentsFor(cells);
    const hand = comp ? comp.primary : null;
    if (!hand) return { hand: null };
    if (typeof resetTrickFires === 'function') resetTrickFires();
    const contrib = [], ledger = {};
    const score = calcScore(hand, cells, contrib, ledger);
    const fired = new Set(typeof _trickFiredThisHand !== 'undefined' ? _trickFiredThisHand : []);
    contrib.forEach(x => { if (x.source === 'trick' || x.source === 'knack') fired.add(x.id); });
    return { hand, names: handLayersFor(hand, cells), score, pips: ledger.finalPips, mult: ledger.finalMult,
      basePips: ledger.basePips, baseMult: ledger.baseMult, contrib, fired, ents };
  } catch (e) {
    console.error('[compare] score failed', e);
    return { hand: null, error: true };
  } finally {
    ({ gridData, gridRows, gridCols, trickTray, acquiredKnacks, selected, streakCount, lastHandType, activeHands } = keep);
    if (typeof resetTrickFires === 'function') resetTrickFires();
  }
}
function bcLineup() { const all = bcBuilds(); return bc.lineup.map(k => all.find(b => b.key === k)).filter(Boolean); }
function bcLive() {
  const res = {};
  bcLineup().forEach(b => { res[b.key] = bcScore(b, bc.selected); });
  return res;
}
function bcLog() {
  if (bc.selected.length < 2) return;
  const live = bcLive();
  const any = Object.values(live).find(x => x && x.hand);
  if (!any) { showBuildsToast('Not a hand'); return; }
  const cards = bc.selected.map(([r, c]) => bc.grid[r][c]);
  const entry = { hand: any.hand, names: any.names, cards, scores: {} };
  bcLineup().forEach(b => {
    const x = live[b.key]; if (!x) return;
    entry.scores[b.key] = x.hand ? x.score : 0;
    const t = bc.tally[b.key] = bc.tally[b.key] || { hands: 0, total: 0, fired: {} };
    t.hands++; t.total += x.hand ? x.score : 0;
    if (x.fired) x.fired.forEach(id => { t.fired[id] = (t.fired[id] || 0) + 1; });
  });
  bc.history.unshift(entry);
  bc.lastHandType = any.hand; bc.streak = (bc.lastHandType === entry.hand) ? bc.streak + 1 : 1;
  // The played cards leave; fresh ones take their cells, as a round would.
  bc.selected.forEach(([r, c]) => { bc.grid[r][c] = bcDraw(); });
  bc.selected = [];
  bcRender();
}
function bcResetTally() { bc.history = []; bc.tally = {}; bc.lastHandType = null; bc.streak = 0; bcRender(); }

// ── render ──────────────────────────────────────────────────────────────────
function bcCardHTML(card, r, c, sel, idx, reach) {
  const a = renderCardAppearance(card, r, c, { isSel: sel, selIdx: idx, isReachable: reach });
  return `<div class="${a.className}${reach ? '' : ' bc-far'}" data-r="${r}" data-c="${c}">${a.innerHTML}${sel ? `<span class="bc-n">${idx + 1}</span>` : ''}</div>`;
}
function bcMiniCard(card) {
  const red = card.suit === '♥' || card.suit === '♦';
  return `<span class="bc-mini ${red ? 'red' : ''}">${card.rank}<i>${card.suit}</i></span>`;
}
function bcHandName(x) {
  if (!x || !x.hand) return bc.selected.length >= 2 ? 'NOT A HAND' : 'PICK A HAND';
  const runs = []; x.names.forEach(n => { const l = runs[runs.length - 1]; if (l && l.n === n) l.k++; else runs.push({ n, k: 1 }); });
  return handLabelHTML(runs);
}
function bcRender() {
  const box = document.getElementById('bv-compare'); if (!box || !bc) return;
  const all = bcBuilds(), lineup = bcLineup(), live = bcLive();
  const anyLive = lineup.map(b => live[b.key]).find(x => x && x.hand);
  const best = lineup.reduce((m, b) => { const x = live[b.key]; return x && x.hand && (!m || x.score > live[m.key].score) ? b : m; }, null);
  const colorOf = key => BC_COLORS[bc.lineup.indexOf(key)] || '#888';

  const chips = all.map(b => {
    const on = bc.lineup.includes(b.key);
    const full = !on && bc.lineup.length >= BC_MAX;
    return `<button class="bc-chip ${on ? 'on' : ''}" data-key="${b.key.replace(/"/g, '&quot;')}" ${full ? 'disabled' : ''} style="--bc:${on ? colorOf(b.key) : '#5f563f'}">${b.name}<i>${(b.tricks || []).length + (b.sleights || []).length + (b.knacks || []).length}</i></button>`;
  }).join('') || `<span class="bv-empty">No builds yet. Add to the draft or save one.</span>`;

  let board = '';
  for (let r = 0; r < bc.rows; r++) for (let c = 0; c < bc.cols; c++) {
    const i = bc.selected.findIndex(([a, b]) => a === r && b === c);
    board += bcCardHTML(bc.grid[r][c], r, c, i >= 0, i, bcReachable(r, c) || i >= 0);
  }

  const cols = lineup.map(b => {
    const x = live[b.key], col = colorOf(b.key), t = bc.tally[b.key] || { hands: 0, total: 0, fired: {} };
    const ents = bcEntities(b);
    const tiles = [...ents.tricks.map(e => ({ e, type: 'trick' })), ...ents.sleights.map(e => ({ e, type: 'sleight' })), ...ents.knacks.map(e => ({ e, type: 'knack' }))]
      .map(({ e, type }) => `<span class="bc-tile" title="${e.name}">${entityTileHTML({ entity: type, emoji: type === 'trick' ? trickEmoji(e) : (e.emoji || '♦'), label: e.name }, tierId(type === 'trick' ? e.tier : e.rarity), { tip: false })}</span>`).join('');
    const isBest = best && best.key === b.key && lineup.length > 1;
    const read = x && x.hand
      ? `<div class="bc-read"><b>${Math.round(x.pips).toLocaleString()}</b><i>x</i><b>${(Math.round(x.mult * 10) / 10).toLocaleString()}</b><i>=</i><em>${x.score.toLocaleString()}</em></div>`
      : `<div class="bc-read bc-dim"><em>${x && x.error ? 'ERROR' : '·'}</em></div>`;
    const open = bc.open === b.key;
    let detail = '';
    if (open) {
      const rows = [];
      if (x && x.hand) rows.push(`<div class="bc-row bc-base"><span>base: ${x.hand}</span><b>${x.basePips} pips</b><b>${x.baseMult} mult</b></div>`);
      const seen = new Set();
      ents.tricks.forEach(e => {
        seen.add(e.id);
        const p = x && x.contrib ? x.contrib.filter(k => k.id === e.id) : [];
        const pip = p.filter(k => k.type === 'pip').reduce((s, k) => s + k.delta, 0), mul = p.filter(k => k.type === 'mult').reduce((s, k) => s + k.delta, 0);
        const fired = x && x.fired && x.fired.has(e.id);
        const n = t.fired[e.id] || 0;
        rows.push(`<div class="bc-row ${fired ? 'on' : ''}"><span class="bc-rn">${entityTileHTML({ entity: 'trick', emoji: trickEmoji(e), label: e.name }, tierId(e.tier), { tip: false })}${e.name}</span>
          <b>${pip ? '+' + (Math.round(pip * 10) / 10) + ' pips' : ''}</b><b>${mul ? '+' + (Math.round(mul * 10) / 10) + ' mult' : (fired && !pip ? 'fired' : '')}</b>
          <s title="went off in ${n} of ${t.hands} logged hands"><u style="width:${t.hands ? Math.round(n / t.hands * 100) : 0}%"></u>${n}/${t.hands}</s></div>`);
      });
      ents.knacks.forEach(e => {
        const fired = x && x.fired && x.fired.has(e.id); const n = t.fired[e.id] || 0;
        rows.push(`<div class="bc-row ${fired ? 'on' : ''}"><span class="bc-rn">${entityTileHTML({ entity: 'knack', emoji: e.emoji, label: e.name }, tierId(e.rarity), { tip: false })}${e.name}</span><b></b><b>${fired ? 'fired' : ''}</b><s><u style="width:${t.hands ? Math.round(n / t.hands * 100) : 0}%"></u>${n}/${t.hands}</s></div>`);
      });
      ents.sleights.forEach(e => rows.push(`<div class="bc-row bc-dim"><span class="bc-rn">${entityTileHTML({ entity: 'sleight', emoji: e.emoji, label: e.name }, tierId(e.rarity), { tip: false })}${e.name}</span><b></b><b>board only</b><s></s></div>`));
      detail = `<div class="bc-detail">${rows.join('') || '<div class="bc-row bc-dim">empty build</div>'}</div>`;
    }
    return `<div class="bc-col ${isBest ? 'best' : ''} ${open ? 'open' : ''}" data-key="${b.key.replace(/"/g, '&quot;')}" style="--bc:${col}">
      <div class="bc-col-head"><span class="bc-name">${b.name}</span>${isBest ? '<em>BEST</em>' : ''}<i>${open ? '&#9652;' : '&#9662;'}</i></div>
      <div class="bc-tiles">${tiles || '<span class="bv-empty">empty</span>'}</div>
      ${read}
      <div class="bc-tally">${t.hands ? `${t.hands} hand${t.hands === 1 ? '' : 's'} logged · <b>${t.total.toLocaleString()}</b>` : 'nothing logged yet'}</div>
      ${detail}</div>`;
  }).join('');

  const hist = bc.history.length ? `<div class="bc-hist"><div class="bc-hist-head">LOGGED HANDS <span>${bc.history.length}</span><button class="bv-key" id="bc-reset">CLEAR TALLY</button></div>
    ${bc.history.map(h => { const top = Math.max(...Object.values(h.scores));
      return `<div class="bc-hrow"><span class="bc-hname">${h.hand}</span><span class="bc-hcards">${h.cards.map(bcMiniCard).join('')}</span>
        ${lineup.map(b => `<span class="bc-hscore ${h.scores[b.key] === top && lineup.length > 1 ? 'top' : ''}" style="--bc:${colorOf(b.key)}">${(h.scores[b.key] || 0).toLocaleString()}</span>`).join('')}</div>`; }).join('')}</div>` : '';

  box.innerHTML = `
    <div class="bc-bar"><span class="bc-word">LINE-UP</span>${chips}<span class="bc-note">up to ${BC_MAX}</span><button class="bv-key bc-back" id="bc-back">&#9664; CATALOGUE</button></div>
    <div class="bc-body">
      <div class="bv-screen bc-board-box">
        <div class="bc-board" style="--card-w:56px;--card-h:76px;grid-template-columns:repeat(${bc.cols},56px)">${board}</div>
        <div class="bc-hand">${bcHandName(anyLive)}</div>
        <div class="bc-keys">
          <button class="bv-key bc-log" id="bc-log" ${bc.selected.length < 2 ? 'disabled' : ''}>LOG HAND</button>
          <button class="bv-key" id="bc-clear" ${bc.selected.length ? '' : 'disabled'}>CLEAR</button>
          <button class="bv-key" id="bc-redeal">REDEAL</button>
          <select class="bc-size" id="bc-size"><option value="4x4" ${bc.rows === 4 && bc.cols === 4 ? 'selected' : ''}>4 x 4</option><option value="5x5" ${bc.rows === 5 ? 'selected' : ''}>5 x 5</option><option value="4x6" ${bc.cols === 6 ? 'selected' : ''}>4 x 6</option></select>
        </div>
        <div class="bc-fine">A fresh round: hands of up to 5, Focus x1, no improvements, pick order counts. Sleights score only on the board, so they are listed and not scored.</div>
      </div>
      <div class="bc-cols">${cols || '<div class="bv-screen bc-none">Tick a build above.</div>'}</div>
    </div>${hist}`;

  box.querySelectorAll('.bc-chip').forEach(ch => ch.onclick = () => {
    const k = ch.dataset.key, i = bc.lineup.indexOf(k);
    if (i >= 0) bc.lineup.splice(i, 1); else if (bc.lineup.length < BC_MAX) bc.lineup.push(k);
    if (bc.open && !bc.lineup.includes(bc.open)) bc.open = null;
    bcRender();
  });
  box.querySelectorAll('.bc-board .card').forEach(el => el.onclick = () => bcTap(+el.dataset.r, +el.dataset.c));
  box.querySelectorAll('.bc-col-head').forEach(h => h.onclick = () => { const k = h.parentElement.dataset.key; bc.open = bc.open === k ? null : k; bcRender(); });
  box.querySelector('#bc-back').onclick = bcClose;
  box.querySelector('#bc-log').onclick = bcLog;
  box.querySelector('#bc-clear').onclick = () => { bc.selected = []; bcRender(); };
  box.querySelector('#bc-redeal').onclick = () => { bcDeal(); bcRender(); };
  box.querySelector('#bc-size').onchange = e => { const [r, c] = e.target.value.split('x').map(Number); bc.rows = r; bc.cols = c; bcDeal(); bcRender(); };
  const rs = box.querySelector('#bc-reset'); if (rs) rs.onclick = bcResetTally;
}
