// ══════════════════════════════════════════════
// RUN HISTORY  (r159)
// ══════════════════════════════════════════════
// A record of finished runs, written once when a run ends and read from the
// main menu's HISTORY button. Deliberately small and separate from js/save.js:
// a SAVE is a resumable snapshot of a run in progress (~130 globals), a HISTORY
// entry is a few hundred bytes of "what happened", so hundreds of them fit in
// the same storage a single save would strain.
//
// Every write goes through recordRunToHistory(), called from onGameWin and
// onGameEnd — the two places a run can finish — so a mode that ends some other
// way simply won't be recorded rather than recording something wrong.

const HISTORY_KEY  = 'letheRunHistory';
const HISTORY_MAX  = 100;   // newest kept; oldest dropped past this

function readRunHistory() {
  let raw = null;
  try { raw = localStorage.getItem(HISTORY_KEY); } catch (e) { return []; }
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}

function writeRunHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (e) {}
}

function clearRunHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
  if (document.getElementById('history-overlay')?.classList.contains('show')) renderHistory();
  updateHistoryBtn();
}

// `outcome`: 'win' | 'loss' | 'timeup'. Called once per finished run.
function recordRunToHistory(outcome) {
  if (typeof gameStartTime !== 'number') return;
  // A run that ended twice (win screen then a stray end call) must not double-log.
  const list = readRunHistory();
  if (list.length && list[0].startedAt === gameStartTime) return;

  const entry = {
    startedAt: gameStartTime,
    endedAt:   Date.now(),
    seconds:   Math.max(0, Math.floor((Date.now() - gameStartTime) / 1000)),
    outcome:   outcome || 'loss',
    mode:      (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.name : '—',
    modeId:    (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.id : '',
    // `score` is the round in progress; totalScore banks the rounds already cleared.
    score:     (typeof totalScore === 'number' ? totalScore : 0) + (typeof score === 'number' ? score : 0),
    level:     typeof level === 'number' ? level : 0,
    act:       typeof actNumber === 'number' ? actNumber : 0,
    hands:     typeof handsPlayed === 'number' ? handsPlayed : 0,
    bestHand:      typeof highestHandName === 'string' ? highestHandName : null,
    bestHandScore: typeof highestHandScore === 'number' ? highestHandScore : 0,
    coins:     typeof coins === 'number' ? coins : 0,
    seed:      (typeof runSeed === 'string' && runSeed) ? runSeed : null,
    tricks:    (typeof trickTray !== 'undefined' && trickTray) ? trickTray.map(t => t.name).filter(Boolean) : [],
    knacks:    (typeof acquiredKnacks !== 'undefined' && acquiredKnacks) ? acquiredKnacks.map(k => k.name).filter(Boolean) : [],
  };
  list.unshift(entry);
  writeRunHistory(list);
  updateHistoryBtn();
}

// ── Derived summary across every recorded run ──
function historySummary() {
  const list = readRunHistory();
  if (!list.length) return null;
  const wins = list.filter(r => r.outcome === 'win').length;
  const best = list.reduce((a, r) => (r.score > (a?.score ?? -1) ? r : a), null);
  return {
    runs: list.length,
    wins,
    bestScore: best ? best.score : 0,
    bestMode:  best ? best.mode : '',
    bestLevel: list.reduce((m, r) => Math.max(m, r.level || 0), 0),
    totalHands: list.reduce((n, r) => n + (r.hands || 0), 0),
    totalSeconds: list.reduce((n, r) => n + (r.seconds || 0), 0),
  };
}

function _histClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function _histWhen(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} hr ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const _HIST_OUTCOME = {
  win:    { label: 'VICTORY',   cls: 'hist-win' },
  loss:   { label: 'GAME OVER', cls: 'hist-loss' },
  timeup: { label: "TIME'S UP", cls: 'hist-timeup' },
};

// ── Overlay ──────────────────────────────────────────────────────────────────
// Lives at body level, OUTSIDE #stage — the cabinet applies CSS `zoom`, which
// would scale a fixed-position panel's viewport sizing (same reason the dev
// panel, Records and the interact pop-ups live out here).
function historyOverlay() {
  let el = document.getElementById('history-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'history-overlay';
  el.innerHTML = `
    <div id="history-panel">
      <div id="history-title-bar">
        <span id="history-title"><span class="hist-led"></span>RUN HISTORY</span>
        <button id="history-close" onclick="closeHistory()">×</button>
      </div>
      <div id="history-summary"></div>
      <div id="history-body"></div>
      <div id="history-footer">
        <button class="hist-clear" onclick="historyConfirmClear()">Clear history</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) closeHistory(); });
  return el;
}

let historyFromMenu = false;
function openHistory(fromMenu = false) {
  historyFromMenu = !!fromMenu;
  const el = historyOverlay();          // must exist BEFORE render fills it
  if (fromMenu) document.getElementById('main-menu-overlay')?.classList.remove('show');
  renderHistory();
  el.classList.add('show');
}

function closeHistory() {
  document.getElementById('history-overlay')?.classList.remove('show');
  if (historyFromMenu) {
    historyFromMenu = false;
    document.getElementById('main-menu-overlay')?.classList.add('show');
  }
}

function historyConfirmClear() {
  if (!readRunHistory().length) return;
  if (!confirm('Delete every recorded run? This cannot be undone.')) return;
  clearRunHistory();
}

function renderHistory() {
  const sumEl = document.getElementById('history-summary');
  const body  = document.getElementById('history-body');
  if (!body) return;
  const list = readRunHistory();
  const s = historySummary();

  if (sumEl) {
    sumEl.innerHTML = s ? `
      <div class="hist-stat"><span class="hs-v">${s.runs}</span><span class="hs-l">Runs</span></div>
      <div class="hist-stat"><span class="hs-v">${s.wins}</span><span class="hs-l">Wins</span></div>
      <div class="hist-stat"><span class="hs-v">${s.bestScore.toLocaleString()}</span><span class="hs-l">Best score</span></div>
      <div class="hist-stat"><span class="hs-v">${s.bestLevel}</span><span class="hs-l">Best round</span></div>
      <div class="hist-stat"><span class="hs-v">${s.totalHands.toLocaleString()}</span><span class="hs-l">Hands</span></div>
      <div class="hist-stat"><span class="hs-v">${_histClock(s.totalSeconds)}</span><span class="hs-l">Played</span></div>` : '';
    sumEl.style.display = s ? '' : 'none';
  }

  if (!list.length) {
    body.innerHTML = `<div class="hist-empty">No runs recorded yet.<br><span>Finish a run and it will appear here.</span></div>`;
    return;
  }

  body.innerHTML = list.map(r => {
    const o = _HIST_OUTCOME[r.outcome] || _HIST_OUTCOME.loss;
    const items = [...(r.tricks || []), ...(r.knacks || [])];
    const kit = items.length
      ? `<div class="hist-kit">${items.slice(0, 6).map(n => `<span class="hist-chip">${n}</span>`).join('')}${items.length > 6 ? `<span class="hist-chip more">+${items.length - 6}</span>` : ''}</div>`
      : '';
    return `<div class="hist-row">
      <div class="hist-row-top">
        <span class="hist-outcome ${o.cls}">${o.label}</span>
        <span class="hist-mode">${r.mode}</span>
        <span class="hist-when">${_histWhen(r.endedAt)}</span>
      </div>
      <div class="hist-figs">
        <span><b>${(r.score || 0).toLocaleString()}</b> pts</span>
        <span>Round <b>${r.level || 0}</b></span>
        <span><b>${r.hands || 0}</b> hands</span>
        <span>${_histClock(r.seconds || 0)}</span>
        ${r.bestHand ? `<span>Best: <b>${r.bestHand}</b> ${(r.bestHandScore || 0).toLocaleString()}</span>` : ''}
        ${r.seed ? `<span class="hist-seed">${r.seed}</span>` : ''}
      </div>
      ${kit}
    </div>`;
  }).join('');
}

// Main-menu button: hidden until there is something to show, so a first-time
// player isn't offered an empty screen.
function updateHistoryBtn() {
  const btn = document.getElementById('menu-history-btn');
  if (!btn) return;
  const n = readRunHistory().length;
  btn.style.display = n ? '' : 'none';
  btn.textContent = `HISTORY (${n})`;
}
