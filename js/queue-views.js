// ══════════════════════════════════════════════════════════════════════════
// QUEUE VIEWS (r329) - two peeks at the draw pile.
//
// 1. THE TRICK TRAY DOUBLES AS A SLEIGHT QUEUE. A small button in the tray's
//    corner (#tray-view-btn) switches the tray between your Tricks and a queue
//    of your Sleights in the order they will be drawn - drawPile is drawn from
//    the FRONT (drawCard shifts), so index order IS draw order. Sleights that
//    are already on the board, or in the played pile waiting on the round-end
//    reshuffle, are listed after the queue, greyed and tagged: they have no
//    draw position yet, and leaving them out would read as "my Sleight is gone".
//    The HEAD COUNT knack adds a corner number to each queued Sleight: exactly
//    how many cards sit in front of it. Without the knack the queue shows only
//    the ORDER (left to right); the count is what the knack sells.
//
// 2. THE CARD COUNTER knack gives the Focus bar a second face. A small button
//    below the bar (#focus-queue-btn) swaps the bar for a column of mini cards:
//    the next gridCols x 2 cards off the draw pile, top card next. The cards
//    are the real renderCardAppearance markup at a fixed 40x53 and the slot is
//    scaled with `zoom` - a transform would fight the .card transform stack
//    (--hb*/--frzr/--grds compose there), zoom does not.
//
// Both views READ the pile and never touch it. Two honest limits, both
// documented behaviours of the draw hook: The Hand of Famine can substitute a
// drawn card at draw time (maybeFamineDrawSwap), and The Marker stamps its mark
// in drawCard - so under those bosses the preview is the pile, not a promise.
//
// REFRESH IS POLLED, the tutorial/insights pattern: the pile changes from a
// dozen call sites (falls, discards, shop removes, reshuffles) and hooking each
// is how a view goes stale on the one nobody remembered. A 500ms tick compares
// a signature and re-renders only on a change, and only while a view is open.
// The same tick creates/removes the focus button as the knack comes and goes.
//
// Neither toggle is run state (not in SAVE_VARS): which face a panel shows is
// presentation, like the portrait panel swap.
// ══════════════════════════════════════════════════════════════════════════

let trayView = 'tricks';      // 'tricks' | 'sleights'
let focusQueueOn = false;
const FOCUS_QUEUE_KNACK = 'card_counter';
const SLEIGHT_COUNT_KNACK = 'head_count';

function _qvHasKnack(id) { return typeof hasKnack === 'function' && hasKnack(id); }

// ── The tray toggle ─────────────────────────────────────────────────────────
// Called from the TOP of renderTrickTray: it always ensures the corner button
// exists (the tray area is rebuilt-adjacent territory), and in sleight view it
// renders the queue and returns true, so renderTrickTray stands down. Every
// system that repaints the tray therefore repaints whichever face is showing.
function trayQueueIntercept() {
  const area = document.getElementById('trick-tray-area');
  if (area && !document.getElementById('tray-view-btn')) {
    const b = document.createElement('button');
    b.id = 'tray-view-btn'; b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); toggleTrayView(); });
    area.appendChild(b);
  }
  _syncTrayViewChrome();
  if (trayView !== 'sleights') return false;
  renderSleightQueue();
  return true;
}

function toggleTrayView() {
  trayView = (trayView === 'sleights') ? 'tricks' : 'sleights';
  if (typeof renderTrickTray === 'function') renderTrickTray();
}

function _syncTrayViewChrome() {
  const q = trayView === 'sleights';
  const b = document.getElementById('tray-view-btn');
  if (b) {
    // The glyph names where the tap GOES, not where you are: ▶ is the Sleight
    // tab's own mark, ✦ the Trick's.
    b.textContent = q ? '✦' : '▶';
    b.title = q ? 'Show Tricks' : 'Show the Sleight queue';
    b.classList.toggle('on', q);
  }
  const area = document.getElementById('trick-tray-area');
  if (area) area.classList.toggle('sq-view', q);   // flips the TRICKS watermark
  const word = document.getElementById('tray-title-word');
  if (word) word.textContent = q ? 'Sleights' : 'Tricks';
}

// Every owned Sleight, queue first. `ahead` is the exact draw-pile index: the
// number of cards in front of it, which is what Head Count prints.
function sleightQueueEntries() {
  const out = [];
  (typeof drawPile !== 'undefined' ? drawPile : []).forEach((cd, i) => {
    if (cd && cd._isSleight) out.push({ card: cd, ahead: i, where: 'deck' });
  });
  if (typeof gridData !== 'undefined') {
    for (let r = 0; r < gridData.length; r++) {
      const row = gridData[r] || [];
      for (let c = 0; c < row.length; c++) if (row[c] && row[c]._isSleight) out.push({ card: row[c], where: 'grid' });
    }
  }
  (typeof playedPile !== 'undefined' ? playedPile : []).forEach(cd => {
    if (cd && cd._isSleight) out.push({ card: cd, where: 'played' });
  });
  return out;
}

function renderSleightQueue() {
  const list = document.getElementById('trick-tray-list');
  if (!list) return;
  const entries = sleightQueueEntries();
  const countEl = document.getElementById('trick-tray-count');
  if (countEl) {
    // No cap to state here - the count is simply how many you own.
    countEl.textContent = String(entries.length);
    countEl.style.color = 'var(--gold-dim)';
  }
  list.innerHTML = '';
  if (!entries.length) {
    list.innerHTML = '<div class="sq-empty">No Sleights in the deck</div>';
    return;
  }
  const showCounts = _qvHasKnack(SLEIGHT_COUNT_KNACK);
  const track = document.createElement('div');
  track.className = 'chip-marquee';
  entries.forEach(en => {
    const def = (typeof sleightDef === 'function') ? sleightDef(en.card) : null;
    if (!def) return;
    const chip = document.createElement('div');
    chip.className = 'trick-tray-chip sq-chip' + (en.where !== 'deck' ? ' sq-out' : '');
    const uses = en.card._usesLeft === 'infinite' ? '∞' : en.card._usesLeft;
    // The shared tile with its self-describing tooltip (tip defaults on). The
    // corner badges sit BOTTOM-LEFT: the fan tucks each tile under the next
    // from the right, so the left edge is the guaranteed-visible strip (r284).
    chip.innerHTML = entityTileHTML({ entity: 'sleight', id: def.id, label: def.name, emoji: def.emoji, uses }, def.rarity)
      + (en.where === 'grid'   ? '<div class="sq-tag" title="On the board">GRID</div>' : '')
      + (en.where === 'played' ? '<div class="sq-tag" title="Returns to the deck at the round-end reshuffle">♻</div>' : '')
      + (showCounts && en.where === 'deck'
          ? `<div class="sq-ahead" title="${en.ahead} card${en.ahead === 1 ? '' : 's'} in front of it">${en.ahead}</div>` : '');
    track.appendChild(chip);
  });
  list.appendChild(track);
  // Same layout pipeline as the Trick chips: portrait fans, landscape fans and
  // scrolls past half, the fallback marquees. Never both (they fight - r160).
  if (!(typeof fanTrickTray === 'function' && fanTrickTray(list, track))) {
    if (typeof applyChipMarquee === 'function') applyChipMarquee(list, track);
  }
  if (typeof fitEntityNames === 'function')
    fitEntityNames(list, '.trick-tray-chip .rwd-name', { maxLines: 2, minPx: 5 });
}

// ── The Card Counter focus queue ────────────────────────────────────────────
function focusQueueAllowed() {
  if (!_qvHasKnack(FOCUS_QUEUE_KNACK)) return false;
  // Squares hides the whole focus wrap; no queue to hang there.
  if (typeof squaresActive === 'function' && squaresActive()) return false;
  return true;
}

// Runs every tick: creates the button when the knack arrives, removes it (and
// closes the view) when the knack goes.
function focusQueueSync() {
  const wrap = document.getElementById('focus-meter-wrap');
  if (!wrap) return;
  let btn = document.getElementById('focus-queue-btn');
  if (!focusQueueAllowed()) {
    if (btn) btn.remove();
    if (focusQueueOn) { focusQueueOn = false; focusQueueApply(); }
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'focus-queue-btn'; btn.type = 'button'; btn.textContent = '🂠';
    btn.title = 'Show the draw queue';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      focusQueueOn = !focusQueueOn;
      focusQueueApply();
    });
    wrap.appendChild(btn);   // last child = below the bar and the readout
  }
}

function focusQueueApply() {
  const wrap = document.getElementById('focus-meter-wrap');
  if (!wrap) return;
  wrap.classList.toggle('fq-on', focusQueueOn);
  const btn = document.getElementById('focus-queue-btn');
  if (btn) {
    btn.classList.toggle('on', focusQueueOn);
    btn.title = focusQueueOn ? 'Show the Focus bar' : 'Show the draw queue';
  }
  const listEl = document.getElementById('focus-queue-list');
  if (!focusQueueOn) { if (listEl) listEl.remove(); return; }
  renderFocusQueue();
}

function renderFocusQueue() {
  const wrap = document.getElementById('focus-meter-wrap');
  if (!wrap || !focusQueueOn) return;
  let listEl = document.getElementById('focus-queue-list');
  if (!listEl) {
    listEl = document.createElement('div'); listEl.id = 'focus-queue-list';
    wrap.insertBefore(listEl, wrap.firstChild);
  }
  const cols = (typeof gridCols === 'number' && gridCols > 0) ? gridCols : 4;
  const n = cols * 2;
  const cards = (typeof drawPile !== 'undefined' ? drawPile : []).slice(0, n);
  listEl.innerHTML = '';
  if (!cards.length) {
    listEl.innerHTML = '<div class="fq-empty">EMPTY</div>';
    return;
  }
  // Fixed 40x53 cards (the CARD_MIN floor, where the face is still tuned to be
  // legible), zoomed down to what the column affords. The measurement is the
  // element's OWN px - zoom-immune, the r160 rule.
  const GAP = 2, CW = 40, CH = 53;
  const H = listEl.clientHeight || 300;
  const W = listEl.clientWidth || 26;
  const z = Math.max(0.3, Math.min(0.85,
    (H - (cards.length - 1) * GAP) / cards.length / CH,
    W / CW));
  cards.forEach((card, i) => {
    const slot = document.createElement('div');
    slot.className = 'fq-slot' + (i === 0 ? ' fq-next' : '');
    slot.style.zoom = z;
    try {
      // revealFog: a queue card is not a board card, and The Fog's whole rule
      // is about the board. -1,-1 lands on no marked line, hold or mark.
      const { className, innerHTML } = renderCardAppearance(card, -1, -1, { revealFog: true });
      const d = document.createElement('div');
      d.className = className + ' fq-card';
      d.innerHTML = innerHTML;
      slot.appendChild(d);
    } catch (e) { slot.textContent = '🂠'; }
    listEl.appendChild(slot);
  });
}

// ── The refresh tick ────────────────────────────────────────────────────────
let _qvSig = '';
function queueViewsTick() {
  focusQueueSync();
  const showingSleights = trayView === 'sleights';
  const showingFq = focusQueueOn && !!document.getElementById('focus-queue-list');
  if (!showingSleights && !showingFq) { _qvSig = ''; return; }
  const dp = (typeof drawPile !== 'undefined') ? drawPile : [];
  const cols = (typeof gridCols === 'number' && gridCols > 0) ? gridCols : 4;
  let sig = dp.length + ':' + cols + ':' + (_qvHasKnack(SLEIGHT_COUNT_KNACK) ? 1 : 0);
  const head = Math.min(dp.length, cols * 2);
  for (let i = 0; i < head; i++) sig += ',' + (dp[i] && dp[i]._id != null ? dp[i]._id : '?');
  dp.forEach((c, i) => { if (c && c._isSleight) sig += '|' + i + (c.sleightId || '') + (c._usesLeft ?? ''); });
  if (showingSleights) {
    if (typeof playedPile !== 'undefined')
      playedPile.forEach(c => { if (c && c._isSleight) sig += ';p' + (c.sleightId || ''); });
    if (typeof gridData !== 'undefined')
      gridData.forEach(row => (row || []).forEach(c => { if (c && c._isSleight) sig += ';g' + (c.sleightId || '') + (c._usesLeft ?? ''); }));
  }
  if (sig === _qvSig) return;
  _qvSig = sig;
  if (showingSleights && typeof renderTrickTray === 'function') renderTrickTray();
  if (showingFq) renderFocusQueue();
}
setInterval(queueViewsTick, 500);
