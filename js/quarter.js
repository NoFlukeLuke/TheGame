// ══════════════════════════════════════════════
// QUARTER CLOSE (r226) - js/quarter.js + css/quarter.css
// ══════════════════════════════════════════════
// Three quarters used to roll over in COMPLETE SILENCE. `actNumber++` happened
// inside finishInterlude, the pips redrew, and the next round dealt: eighteen
// rounds in a row with nothing marking the two boundaries between them. And the
// end screen was six lines of run totals that said nothing about the shape of
// the run that had just happened.
//
// Two things here, and they share one set of books:
//   1. THE QUARTER CARD - a ~2.4s beat between quarters. Q1 CLOSED / Q2 OPENS,
//      with the three quarter pips filling one. Skippable, auto-advancing.
//   2. THE RUN REPORT - the end screen, rebuilt as a quarter-by-quarter table
//      plus run totals. Both the win and the loss screen use it.
//
// THE BOOKS ARE SNAPSHOT DIFFS, NOT A SECOND SET OF COUNTERS. Every figure here
// is a cumulative global the game already maintains (`handsPlayed`, `totalScore`,
// `acquiredTricks.length`), marked at the quarter's start and subtracted at its
// close. Adding a parallel per-quarter counter to each of those call sites is how
// two numbers end up disagreeing; a diff of one number cannot.
//
// The exceptions are the two figures no cumulative global exists for - the
// quarter's best hand and what its payouts paid - and those are fed from the ONE
// site that already knows each (play-hand.js's best-hand line, showPayoutUI's
// total), not from a sweep.

let quarterLog  = [];    // one row per CLOSED quarter
let qHandsMark  = 0;     // handsPlayed at this quarter's start
let qScoreMark  = 0;     // banked score at this quarter's start
let qTricksMark = 0;     // acquiredTricks.length at this quarter's start
let qStartTime  = 0;
let qBestName   = null;
let qBestScore  = 0;
let qPayouts    = 0;     // credits the payout screens paid this quarter
let qBossName   = null;  // the boss beaten in this quarter, if any

// Banked + in-progress. `totalScore` alone under-reports by the live round, the
// same reason js/history.js sums them.
function _qScoreNow() {
  return (typeof totalScore === 'number' ? totalScore : 0) + (typeof score === 'number' ? score : 0);
}

function startQuarterTracking() {
  qHandsMark  = (typeof handsPlayed === 'number') ? handsPlayed : 0;
  qScoreMark  = _qScoreNow();
  qTricksMark = (typeof acquiredTricks !== 'undefined' && acquiredTricks) ? acquiredTricks.length : 0;
  qStartTime  = Date.now();
  qBestName   = null;
  qBestScore  = 0;
  qPayouts    = 0;
  qBossName   = null;
}

function resetQuarterLog() { quarterLog = []; startQuarterTracking(); }

// ── The three feeds ─────────────────────────────────────────────────────────
// Called from the single site that already knows each figure.
function recordQuarterBest(hand, sc) {
  if (!(sc > qBestScore)) return;
  qBestScore = Math.round(sc);
  qBestName  = hand;
}
function recordQuarterPayout(n) { qPayouts += (n || 0); }
function recordQuarterBoss(name) { if (name) qBossName = name; }

// The quarter's row, built live. `partial` marks a quarter the run ended inside.
function quarterRow(q, partial) {
  return {
    q, partial: !!partial,
    hands:   Math.max(0, ((typeof handsPlayed === 'number') ? handsPlayed : 0) - qHandsMark),
    score:   Math.max(0, _qScoreNow() - qScoreMark),
    tricks:  Math.max(0, ((typeof acquiredTricks !== 'undefined' && acquiredTricks) ? acquiredTricks.length : 0) - qTricksMark),
    payouts: qPayouts,
    boss:    qBossName,
    bestName: qBestName,
    bestScore: qBestScore,
    seconds: Math.max(0, Math.floor((Date.now() - (qStartTime || Date.now())) / 1000)),
  };
}

function closeQuarter(q) {
  quarterLog.push(quarterRow(q, false));
  startQuarterTracking();
}

// ── The rollover ────────────────────────────────────────────────────────────
// ONE function for both quarter-rollover sites - finishInterlude's node path and
// guidedAfterPrizeGrid's slot path. They had the same five lines written twice,
// which is exactly how a card gets shown on one route and not the other.
// `next` is what runs once the card is done; a won run never reaches it.
function rolloverQuarter(next) {
  const closed = (typeof actNumber === 'number') ? actNumber : 1;
  closeQuarter(closed);

  nodeInAct = 0;
  actNumber++;
  deadCells = new Set();     // Dead Drop cells are a quarter-long penalty
  if (typeof updateActProgressUI === 'function') updateActProgressUI();

  if (actNumber > 3) { onGameWin(); return; }   // the report is the wrap-up there
  // r238: deal the new quarter's boss NOW, so the progress block can name it for
  // the whole quarter instead of guessing at it. This and startGame are the two
  // places a quarter opens.
  if (typeof drawActBoss === 'function') drawActBoss();
  showQuarterCard(closed, actNumber, next);
}

// ── The card ────────────────────────────────────────────────────────────────
// Body-level and position:fixed, like the goal banner and the pop-ups: anything
// inside #cabinet inherits its CSS zoom and would be drawn at the wrong size.
const QUARTER_CARD_MS = 2400;
let _qCardTimer = null;

function quarterCardEl() {
  let el = document.getElementById('quarter-card');
  if (!el) {
    el = document.createElement('div');
    el.id = 'quarter-card';
    el.innerHTML = `<div class="qc-panel">
        <div class="qc-kicker" id="qc-kicker">QUARTER CLOSED</div>
        <div class="qc-big" id="qc-closed">Q1</div>
        <div class="qc-pips" id="qc-pips"></div>
        <div class="qc-next" id="qc-next">Q2 OPENS</div>
        <div class="qc-skip">tap to continue</div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function showQuarterCard(closed, next, done) {
  const el = quarterCardEl();
  el.querySelector('#qc-closed').textContent = 'Q' + closed;
  el.querySelector('#qc-next').textContent   = 'Q' + next + ' OPENS';
  // Three pips, filled up to and including the quarter that just closed.
  el.querySelector('#qc-pips').innerHTML =
    [1, 2, 3].map(i => `<span class="${i <= closed ? 'on' : ''}"></span>`).join('');

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(_qCardTimer);
    el.classList.remove('show');
    el.removeEventListener('pointerdown', finish);
    // Let the fade out play before whatever comes next takes the screen.
    setTimeout(() => { if (typeof done === 'function') done(); }, 180);
  };

  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  if (typeof sfxLevelUp === 'function') sfxLevelUp();
  // Tap anywhere to skip. Someone on their tenth run should never have to wait.
  el.addEventListener('pointerdown', finish);
  _qCardTimer = setTimeout(finish, QUARTER_CARD_MS);
}

function hideQuarterCard() {
  clearTimeout(_qCardTimer);
  document.getElementById('quarter-card')?.classList.remove('show');
}

// ── The run report ──────────────────────────────────────────────────────────
// Replaces the end screen's six-line stat list. Both end screens call it, so a
// run that ended badly still gets the same account of itself as one that won.
function _qFmtTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function runReportHTML() {
  const rows = quarterLog.slice();
  // A run that ended mid-quarter gets that quarter as a partial row. A won run
  // has already closed its third, and its live tracker is empty - no ghost Q4.
  const liveHands = ((typeof handsPlayed === 'number') ? handsPlayed : 0) - qHandsMark;
  if (liveHands > 0 && rows.length < 3) rows.push(quarterRow(rows.length + 1, true));

  const secondsPlayed = Math.floor((Date.now() - (typeof gameStartTime === 'number' ? gameStartTime : Date.now())) / 1000);
  const owned = [
    ['Tricks',   (typeof trickTray !== 'undefined' && trickTray) ? trickTray.length : 0],
    ['Knacks',   (typeof acquiredKnacks !== 'undefined' && acquiredKnacks) ? acquiredKnacks.length : 0],
  ];

  let html = '<div class="rr-wrap">';

  if (rows.length) {
    html += '<div class="rr-head">By quarter</div><table class="rr-table"><thead><tr>' +
      '<th></th><th>Score</th><th>Hands</th><th>Best hand</th><th>Boss</th><th>Paid</th>' +
      '</tr></thead><tbody>';
    rows.forEach(r => {
      html += `<tr${r.partial ? ' class="rr-partial"' : ''}>` +
        `<td class="rr-q">Q${r.q}${r.partial ? '<i>unfinished</i>' : ''}</td>` +
        `<td>${r.score.toLocaleString()}</td>` +
        `<td>${r.hands}</td>` +
        `<td class="rr-best">${r.bestName ? `${r.bestName}<i>${r.bestScore.toLocaleString()}</i>` : '·'}</td>` +
        `<td class="rr-boss">${r.boss || '·'}</td>` +
        `<td>${r.payouts} &#9670;</td>` +
        `</tr>`;
    });
    html += '</tbody></table>';
  }

  html += '<div class="rr-head">The run</div><div class="rr-grid">';
  const tile = (label, value) => `<div class="rr-tile"><span>${label}</span><b>${value}</b></div>`;
  html += tile('Total score', _qScoreNow().toLocaleString());
  html += tile('Time played', _qFmtTime(secondsPlayed));
  html += tile('Rounds cleared', (typeof level === 'number' ? level : 0));
  html += tile('Hands played', (typeof handsPlayed === 'number' ? handsPlayed : 0));
  html += tile('Best hand', (typeof highestHandName === 'string' && highestHandName)
    ? `${highestHandName} <i>${(highestHandScore || 0).toLocaleString()}</i>` : '·');
  html += tile('Credits held', (typeof coins === 'number' ? coins : 0) + ' &#9670;');
  owned.forEach(([k, v]) => { html += tile(k, v); });
  html += '</div></div>';
  return html;
}
