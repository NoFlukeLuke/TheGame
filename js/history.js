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
// onGameEnd - the two places a run can finish - so a mode that ends some other
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

// r755: a run's stats (js/run-stats.js) run to ~10-20 KB, so only the newest
// runs keep all of them. The newest HISTORY_STATS_FULL keep every hand; up to
// HISTORY_STATS_KEEP keep their rounds and loadout log; older runs keep the
// plain entry. A full store trims harder and tries again.
const HISTORY_STATS_FULL = 25;
const HISTORY_STATS_KEEP = 60;
function _histTrim(list, full, keep) {
  return list.map((r, i) => {
    if (!r.stats || i < full) return r;
    if (i >= keep) { const o = { ...r }; delete o.stats; return o; }
    return { ...r, stats: { ...r.stats, rows: (r.stats.rows || []).map(row => { const o = { ...row }; delete o.hs; return o; }) } };
  });
}
function writeRunHistory(list) {
  list = list.slice(0, HISTORY_MAX);
  for (const [full, keep] of [[HISTORY_STATS_FULL, HISTORY_STATS_KEEP], [5, 20], [1, 3], [0, 0]]) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(_histTrim(list, full, keep))); return; } catch (e) {}
  }
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
  // r680: a won run that continued into Endless ends a second time; its entry is
  // brought up to date (how far it got) rather than logged twice.
  const again = list.length && list[0].startedAt === gameStartTime;
  if (again && !(typeof endlessRun !== 'undefined' && endlessRun) && !(typeof survivalEndless !== 'undefined' && survivalEndless)) return;

  const entry = {
    startedAt: gameStartTime,
    endedAt:   Date.now(),
    seconds:   Math.max(0, Math.floor((Date.now() - gameStartTime) / 1000)),
    outcome:   outcome || 'loss',
    mode:      (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.name : '·',
    modeId:    (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.id : '',
    difficulty: (typeof difficultyTier === 'function') ? difficultyTier() : 1,   // r727
    // `score` is the round in progress; totalScore banks the rounds already cleared.
    score:     (typeof totalScore === 'number' ? totalScore : 0) + (typeof score === 'number' ? score : 0),
    level:     typeof level === 'number' ? level : 0,
    act:       typeof actNumber === 'number' ? actNumber : 0,
    endless:   !!((typeof endlessRun !== 'undefined' && endlessRun) || (typeof survivalEndless !== 'undefined' && survivalEndless)),
    hands:     typeof handsPlayed === 'number' ? handsPlayed : 0,
    bestHand:      typeof highestHandName === 'string' ? highestHandName : null,
    bestHandScore: typeof highestHandScore === 'number' ? highestHandScore : 0,
    coins:     typeof coins === 'number' ? coins : 0,
    seed:      (typeof runSeed === 'string' && runSeed) ? runSeed : null,
    tricks:    (typeof trickTray !== 'undefined' && trickTray) ? trickTray.map(t => t.name).filter(Boolean) : [],
    knacks:    (typeof acquiredKnacks !== 'undefined' && acquiredKnacks) ? acquiredKnacks.map(k => k.name).filter(Boolean) : [],
    protocol:  (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.protocol) || null,   // r755
    stats:     (typeof rsFinal === 'function') ? rsFinal() : null,                                     // r755: js/run-stats.js
  };
  if (again) { entry.outcome = 'win'; entry.endlessOutcome = outcome; list[0] = entry; } else list.unshift(entry);
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
// Lives at body level, OUTSIDE #stage - the cabinet applies CSS `zoom`, which
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
        <button class="hist-copy" id="hist-copy-all" onclick="historyCopyAll(this)">Copy all</button>
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

  const cur = historyCurrentRun();
  if (!list.length && !cur) {
    body.innerHTML = `<div class="hist-empty">No runs recorded yet.<br><span>Finish a run and it will appear here.</span></div>`;
    return;
  }

  body.innerHTML = (cur ? [cur] : []).concat(list).map((r, i) => {
    const o = r._live ? { label: 'IN PROGRESS', cls: 'hist-live' } : (_HIST_OUTCOME[r.outcome] || _HIST_OUTCOME.loss);
    const items = [...(r.tricks || []), ...(r.knacks || [])];
    const kit = items.length
      ? `<div class="hist-kit">${items.slice(0, 6).map(n => `<span class="hist-chip">${n}</span>`).join('')}${items.length > 6 ? `<span class="hist-chip more">+${items.length - 6}</span>` : ''}</div>`
      : '';
    return `<div class="hist-row">
      <div class="hist-row-top">
        <span class="hist-outcome ${o.cls}">${o.label}</span>
        <span class="hist-mode">${r.mode}</span>
        <span class="hist-when">${r._live ? 'now' : _histWhen(r.endedAt)}</span>
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
      ${r.stats ? historyStatsHTML(r.stats, cur && i === 0 ? -1 : i - (cur ? 1 : 0)) : ''}
    </div>`;
  }).join('');
}

// ── r755: run stats in the history (js/run-stats.js) ──

// The run being played (or left unfinished) is not in the list yet: shown on
// top while its stats are live, so COPY ALL works mid-run from the pause menu.
function historyCurrentRun() {
  if (typeof runStats === 'undefined' || !runStats || typeof gameStartTime !== 'number' || typeof rsFinal !== 'function') return null;
  const list = readRunHistory();
  if (list.length && list[0].startedAt === gameStartTime) return null;
  if (!runStats.rows.some(r => r.hands)) return null;
  return {
    _live: true, startedAt: gameStartTime,
    seconds: Math.max(0, Math.floor((Date.now() - gameStartTime) / 1000)),
    mode: (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.name : '·',
    score: (typeof totalScore === 'number' ? totalScore : 0) + (typeof score === 'number' ? score : 0),
    level: typeof level === 'number' ? level : 0,
    hands: typeof handsPlayed === 'number' ? handsPlayed : 0,
    stats: rsFinal(),
  };
}

const _HIST_SCREEN_WORDS = { pick: 'picks of three', shop: 'shops', event: 'events' };
function _histNameOf(kind, id) {
  const pool = kind === 'trick' ? (typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : [])
    : kind === 'knack' ? (typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [])
    : (typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []);
  const row = pool.find(e => e.id === id);
  return row ? row.name : id;
}
function _histSecs(v) { return v == null ? '·' : (v < 60 ? v.toFixed(0) + 's' : _histClock(Math.round(v))); }

// One run's STATS fold: a row per round, then what came in and when.
function historyStatsHTML(st, idx) {
  const sm = typeof rsSummary === 'function' ? rsSummary(st) : null;
  if (!sm) return '';
  const rows = sm.rows.map(r => {
    const t = r.cleared ? r.clearSecs : r.secs;
    const pct = r.goal ? Math.round(r.score / r.goal * 100) : 0;
    const avg = r.hands ? Math.round(r.score / r.hands) : 0;
    return `<tr class="${r.boss ? 'hs-boss' : ''}${r.cleared ? '' : ' hs-miss'}">
      <td>${r.lv}${r.boss ? ' ☠' : ''}</td><td>${(r.goal || 0).toLocaleString()}</td><td>${(r.score || 0).toLocaleString()}</td>
      <td>${pct}%</td><td>${_histSecs(t)}</td><td>${r.hands}</td><td>${r.hands ? (t / r.hands).toFixed(1) + 's' : '·'}</td>
      <td>${avg.toLocaleString()}</td><td>x${r.fxPeak}</td></tr>`;
  }).join('');
  const kindWord = { trick: ['Trick', 'Tricks'], knack: ['Knack', 'Knacks'], sleight: ['Sleight', 'Sleights'] };
  const gainLine = Object.keys(sm.gains).map(k => {
    const g = sm.gains[k], n = Object.values(g).reduce((a, b) => a + b, 0);
    if (!n) return '';
    const parts = (typeof TIER_IDS !== 'undefined' ? TIER_IDS : Object.keys(g)).filter(t => g[t]).map(t => `${g[t]} ${typeof tierLabel === 'function' ? tierLabel(k, t).toLowerCase() : t}`);
    return `<div><b>${n} ${kindWord[k][n === 1 ? 0 : 1]}</b> (${parts.join(', ')})</div>`;
  }).join('');
  const limLine = Object.keys(sm.limits).filter(id => sm.limits[id]).map(id => {
    const d = typeof LIMITS_DEF !== 'undefined' ? LIMITS_DEF.find(x => x.id === id) : null;
    const v = sm.limits[id];
    return `${d ? resolveLabel(d.name || d.label || id) : id} ${v > 0 ? '+' : ''}${v}`;
  }).join(', ');
  const scr = st.screens || {};
  const scrLine = Object.keys(scr).filter(k => !k.startsWith('flow:')).map(k => `${scr[k]} ${_HIST_SCREEN_WORDS[k] || (k.startsWith('grid:') ? (k === 'grid:normal' ? 'Balance Sheets' : k.slice(5) + ' grids') : k)}`).join(', ');
  const flowSteps = Object.keys(scr).filter(k => k.startsWith('flow:')).reduce((n, k) => n + scr[k], 0);
  const timeline = (st.log || []).filter(l => l.e === '+' || l.e === '-' || l.e === 'up').map(l =>
    `<span class="hs-ev hs-${l.e === '+' ? 'gain' : l.e === '-' ? 'loss' : 'up'}">L${l.lv} ${l.e === 'up' ? '▲' : l.e} ${_histNameOf(l.k, l.id)}${l.e === 'up' || l.v ? ' v' + (l.v + 1) : ''}</span>`).join('');
  return `<details class="hist-more"><summary>Stats</summary>
    <div class="hs-lines">
      <div>Average <b>${sm.perHand.toFixed(1)}s</b> a hand over ${sm.hands} hands (live round time, ${_histSecs(sm.secs)})</div>
      ${gainLine}
      ${sm.ups ? `<div><b>${sm.ups}</b> improvement${sm.ups === 1 ? '' : 's'}</div>` : ''}
      ${limLine ? `<div>Limits: ${limLine}</div>` : ''}
      ${scrLine || flowSteps ? `<div>Reward screens: ${[flowSteps ? flowSteps + ' Flow reward steps' : '', scrLine].filter(Boolean).join(', ')}</div>` : ''}
      ${st.credits ? `<div>Credits: ${creditsTxt(st.credits.earned)} earned, ${creditsTxt(st.credits.spent)} spent</div>` : ''}
    </div>
    <div class="hs-table-wrap"><table class="hs-table">
      <tr><th>Rd</th><th>Goal</th><th>Score</th><th>%</th><th>Time</th><th>Hands</th><th>s/hand</th><th>Avg hand</th><th>Focus</th></tr>
      ${rows}
    </table></div>
    ${timeline ? `<div class="hs-timeline">${timeline}</div>` : ''}
    <button class="hist-copy" onclick="historyCopy(this, ${idx})">Copy this run</button>
  </details>`;
}

// The clipboard text: every run's entry (stats included) as JSON, newest first,
// the run in progress as `current`. idx -1 = the current run alone, n = list[n].
function historyCopyText(idx) {
  const list = readRunHistory(), cur = historyCurrentRun();
  const head = { format: 'lethe-run-history-1', copied: new Date().toISOString(),
                 build: typeof BUILD === 'string' ? (BUILD.split('·')[1] || '').trim() : '' };
  if (idx === -1) return JSON.stringify({ ...head, current: cur });
  if (typeof idx === 'number') return JSON.stringify({ ...head, runs: [list[idx]] });
  return JSON.stringify({ ...head, current: cur, runs: list });
}
function historyCopy(btn, idx) {
  const text = historyCopyText(idx);
  const done = ok => {
    if (!btn) return;
    const was = btn.dataset.label || btn.textContent;
    btn.dataset.label = was;
    btn.textContent = ok ? 'Copied' : 'Select and copy below';
    setTimeout(() => { btn.textContent = was; }, 1600);
  };
  const fallback = () => {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e) {}
    if (!ok) {   // last resort: the text in a box, already selected
      document.getElementById('hist-copy-text')?.remove();
      const ta = document.createElement('textarea');
      ta.id = 'hist-copy-text'; ta.readOnly = true; ta.value = text;
      btn.after(ta); ta.focus(); ta.select();
    }
    done(ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback);
  else fallback();
}
function historyCopyAll(btn) { historyCopy(btn); }

// Main-menu button: hidden until there is something to show, so a first-time
// player isn't offered an empty screen.
function updateHistoryBtn() {
  const btn = document.getElementById('menu-history-btn');
  if (!btn) return;
  const n = readRunHistory().length;
  btn.style.display = n ? '' : 'none';
  btn.textContent = `HISTORY (${n})`;
}
