// ══════════════════════════════════════════════════════════════════════════════
// LEVEL TYPES (r399) - rounds whose goal is SHAPED, not just sized
// ══════════════════════════════════════════════════════════════════════════════
// Owner: "Having different types of levels, they would all require score but ...
// multiple score requirements. Score requirements per row, so a hand's score
// only applies to it if it includes a hand from that row or column."
//
// Two shapes, both still paid in score:
//
//   RELAY  - the goal is cut into GOAL_RELAY_BARS bars filled one after another.
//            A hand that overfills the current bar carries only HALF of the
//            overflow into the next (QUOTA_RELAY_CARRY), so one enormous hand
//            cannot clear the whole round on its own. With a full carry this
//            would be the ordinary goal drawn in three pieces.
//   LINES  - two or three rows and columns of the board each carry their own
//            quota. A hand's score is credited to EVERY marked line it has a
//            card in, so a hand that crosses two lines pays both.
//
// Where they appear: a Flow level rolls one at LEVEL_TYPE_FLOW_CHANCE (from level
// LEVEL_TYPE_FLOW_FROM), and each is a hard-round option on the Schedule and in
// Guided (CHALLENGE_DEFS, `quota`).
//
// ONE PREDICATE decides "is this round's goal met": roundQuotaMet(). playHand's
// goal check, the round-end check and both dances' goal flash read it, so a
// shaped round cannot be cleared by the plain score >= roundGoal test anywhere.
// `score` itself is untouched and still totals every hand, so every Trick and
// payout that reads it behaves exactly as before.

let LEVEL_TYPE_FLOW_CHANCE = 0.25;   // let: dev -> Probabilities tunes it
const LEVEL_TYPE_FLOW_FROM   = 3;     // levels 1-2 always teach the plain goal
const GOAL_RELAY_BARS        = 3;
const QUOTA_RELAY_SHARE      = 0.30;  // each bar is this share of the goal
const QUOTA_RELAY_CARRY      = 0.5;   // share of a bar's overflow that reaches the next
const QUOTA_LINE_SHARE       = { 2: 0.60, 3: 0.45 };   // per line, by how many lines

// `var`, not `let`: the HUD and the dances read it by name from files that load
// ABOVE this one, and a top-level `let` is in its temporal dead zone - a THROW,
// even under `typeof` - until this script has run.
var roundQuota = null;   // null, or { kind:'relay'|'lines', ... } - in SAVE_VARS

const LEVEL_TYPE_META = {
  relay: { name: 'Relay',       icon: '⛓️', desc: `Three goals in a row. Overflow carries half into the next.` },
  lines: { name: 'Line Quotas', icon: '▦',  desc: `Each marked line has its own goal. A hand pays every marked line it touches.` },
};

function _q10(n) { return Math.max(10, Math.round(n / 10) * 10); }

function roundQuotaBuild(kind) {
  if (kind === 'relay') {
    const t = _q10(roundGoal * QUOTA_RELAY_SHARE);
    return { kind, bars: Array.from({ length: GOAL_RELAY_BARS }, () => t), idx: 0, prog: 0, announced: false };
  }
  // LINES. Always both axes, so the two quotas cross and a hand at the crossing
  // can pay both - which is the decision the round is about.
  const n = Math.random() < 0.5 ? 2 : 3;
  const rows = [...Array(gridRows).keys()], cols = [...Array(gridCols).keys()];
  const take = arr => arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
  const lines = [{ axis: 'row', index: take(rows) }, { axis: 'col', index: take(cols) }];
  if (n === 3) lines.push(Math.random() < 0.5 ? { axis: 'row', index: take(rows) } : { axis: 'col', index: take(cols) });
  const t = _q10(roundGoal * QUOTA_LINE_SHARE[n]);
  lines.forEach(l => { l.target = t; l.prog = 0; });
  return { kind: 'lines', lines, announced: false };
}

// Called from triggerLevelUp once roundGoal is final (and after a hard round's
// raise). A hard round that names a quota always gets it; otherwise Flow rolls.
function levelTypeMaybeArm() {
  roundQuota = null;
  if (typeof bossActive !== 'undefined' && bossActive) return;
  const ch = (typeof guidedActiveChallenge !== 'undefined') && guidedActiveChallenge;
  if (ch && ch.quota) { roundQuota = roundQuotaBuild(ch.quota); return; }
  if (typeof flowActive === 'function' && flowActive() && level >= LEVEL_TYPE_FLOW_FROM
      && Math.random() < LEVEL_TYPE_FLOW_CHANCE) {
    roundQuota = roundQuotaBuild(Math.random() < 0.5 ? 'relay' : 'lines');
  }
}

// The one "is this round's goal met" test.
function roundQuotaMet() {
  const q = roundQuota;
  if (!q) return score >= roundGoal;
  if (q.kind === 'relay') return q.idx >= q.bars.length;
  return q.lines.every(l => l.prog >= l.target);
}

// 0..1 across the whole round, for the HUD bar.
function roundQuotaFrac() {
  const q = roundQuota;
  if (!q) return Math.min(1, score / Math.max(1, roundGoal));
  if (q.kind === 'relay') {
    const n = q.bars.length;
    if (q.idx >= n) return 1;
    return (q.idx + Math.min(1, q.prog / q.bars[q.idx])) / n;
  }
  return q.lines.reduce((s, l) => s + Math.min(1, l.prog / l.target), 0) / q.lines.length;
}

function _qCellOnLine(l, r, c) { return l.axis === 'row' ? r === l.index : c === l.index; }

// Called from playHand straight after `score += finalScore`.
function roundQuotaCredit(amount, cells) {
  const q = roundQuota;
  if (!q || !(amount > 0)) return;
  if (q.kind === 'relay') {
    let a = amount;
    while (a > 0 && q.idx < q.bars.length) {
      const room = q.bars[q.idx] - q.prog;
      if (a < room) { q.prog += a; a = 0; break; }
      a -= room; q.idx++; q.prog = 0;
      if (q.idx < q.bars.length) {
        a *= QUOTA_RELAY_CARRY;
        showMessage(`Goal ${q.idx} of ${q.bars.length} cleared`, 'var(--gold)');
        if (typeof sfxSuccess === 'function') sfxSuccess();
      }
    }
    q.prog = Math.round(q.prog);
  } else {
    q.lines.forEach(l => {
      if (l.prog >= l.target) return;
      if (!(cells || []).some(([r, c]) => _qCellOnLine(l, r, c))) return;
      l.prog = Math.min(l.target, l.prog + Math.round(amount));
      if (l.prog >= l.target && !roundQuotaMet()) {
        showMessage(`${l.axis === 'row' ? 'Row' : 'Column'} ${l.index + 1} filled`, 'var(--gold)');
        if (typeof sfxSuccess === 'function') sfxSuccess();
      }
    });
  }
  roundQuotaPaint();
}

// Called when a round actually begins (startRoundTimer). Says what the round is
// the first time it goes live.
function roundQuotaAnnounce() {
  const q = roundQuota;
  if (!q || q.announced) return;
  q.announced = true;
  const m = LEVEL_TYPE_META[q.kind];
  showMessage(`${m.icon} ${m.name}: ${m.desc}`, 'var(--c-cyan, #5ee)', { ms: 4200 });
  roundQuotaPaint();
}

function roundQuotaClear() { roundQuota = null; roundQuotaPaint(); }

// ── Drawing ──────────────────────────────────────────────────────────────────
// RELAY rides the score panel: the goal label reads "GOAL 2/3" and the bar is
// divided into three. LINES are drawn on the board: a translucent band down each
// marked line behind the cards, and a progress pill at its outer end. The pill
// sits half outside the board, in the frame, so it never covers a rank.
function roundQuotaPaint() {
  const wrap = document.getElementById('score-progress-bar-wrap');
  if (wrap) {
    wrap.querySelectorAll('.q-div').forEach(e => e.remove());
    wrap.classList.toggle('q-relay', !!(roundQuota && roundQuota.kind === 'relay'));
    if (roundQuota && roundQuota.kind === 'relay') {
      const n = roundQuota.bars.length;
      for (let i = 1; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'q-div'; d.style.left = (i / n * 100) + '%';
        wrap.appendChild(d);
      }
    }
  }
  renderQuotaLines();
}

function renderQuotaLines() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.querySelectorAll('.q-line, .q-pill').forEach(e => e.remove());
  const q = roundQuota;
  if (!q || q.kind !== 'lines') return;
  // Only over a live board - a takeover screen has emptied #grid of cards.
  if (!gridEl.querySelector('[data-card-id]')) return;
  if (typeof cellLeft !== 'function') return;
  const W = cellLeft(gridCols - 1) + CARD_W + GRID_PAD;
  const H = cellTop(gridRows - 1) + CARD_H + GRID_PAD;
  q.lines.forEach(l => {
    if (l.axis === 'row' ? l.index >= gridRows : l.index >= gridCols) return;
    const done = l.prog >= l.target;
    const el = document.createElement('div');
    el.className = 'q-line q-line-' + l.axis + (done ? ' q-done' : '');
    const frac = Math.min(1, l.prog / l.target);
    if (l.axis === 'row') {
      el.style.left = (GRID_PAD - 3) + 'px';
      el.style.top = (cellTop(l.index) - 3) + 'px';
      el.style.width = (W - 2 * GRID_PAD + 6) + 'px';
      el.style.height = (CARD_H + 6) + 'px';
    } else {
      el.style.left = (cellLeft(l.index) - 3) + 'px';
      el.style.top = (GRID_PAD - 3) + 'px';
      el.style.width = (CARD_W + 6) + 'px';
      el.style.height = (H - 2 * GRID_PAD + 6) + 'px';
    }
    el.style.setProperty('--qf', frac);
    gridEl.appendChild(el);
    // The pill is a SIBLING, not a child: the band carries z-index 1 and so is a
    // stacking context, and a pill inside it could never rise above the cards.
    const pill = document.createElement('div');
    pill.className = 'q-pill q-pill-' + l.axis + (done ? ' q-done' : '');
    pill.textContent = done ? '✓' : `${Math.round(l.prog).toLocaleString()}/${l.target.toLocaleString()}`;
    if (l.axis === 'row') { pill.style.left = (W - GRID_PAD) + 'px'; pill.style.top = (cellTop(l.index) + CARD_H / 2) + 'px'; }
    else { pill.style.left = (cellLeft(l.index) + CARD_W / 2) + 'px'; pill.style.top = (H - GRID_PAD) + 'px'; }
    gridEl.appendChild(pill);
  });
}
