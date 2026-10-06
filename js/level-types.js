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
// Where they appear: from level LEVEL_TYPE_FLOW_FROM a Flow level is LINES at
// LEVEL_TYPE_LINES_CHANCE and RELAY at LEVEL_TYPE_RELAY_CHANCE (r497), and each is
// a hard-round option on the Schedule and in Guided (CHALLENGE_DEFS, `quota`).
// A Flow LINES round cleared pays at least QUOTA_LINES_REWARDS reward screens
// (flowrMaybeStart reads quotaLinesRewardFloor()).
//
// ONE PREDICATE decides "is this round's goal met": roundQuotaMet(). playHand's
// goal check, the round-end check and both dances' goal flash read it, so a
// shaped round cannot be cleared by the plain score >= roundGoal test anywhere.
// `score` itself is untouched and still totals every hand, so every Trick and
// payout that reads it behaves exactly as before.

let LEVEL_TYPE_LINES_CHANCE = 0.15;  // let: dev -> Probabilities tunes both
let LEVEL_TYPE_RELAY_CHANCE = 0.125;
const LEVEL_TYPE_FLOW_FROM   = 3;     // levels 1-2 always teach the plain goal
const GOAL_RELAY_BARS        = 3;
const QUOTA_RELAY_SHARE      = 0.30;  // each bar is this share of the goal
const QUOTA_RELAY_CARRY      = 0.5;   // share of a bar's overflow that reaches the next
const QUOTA_LINE_SHARE       = { 2: 0.60, 3: 0.45 };   // per line, by how many lines
const QUOTA_LINES_REWARDS    = 3;     // Flow: a cleared LINES round pays at least this many rewards
const QUOTA_LINE_COLORS      = ['#5ee6ee', '#ff6fd8', '#ffc24a'];   // line i on the board = meter i in the HUD
const QUOTA_INTRO_KEY        = 'lethe.lineQuotaIntro.v1';   // how many times the explainer has shown
const QUOTA_INTRO_TIMES      = 4;     // the first N LINES rounds open with the explainer card
const QUOTA_SWEEP_MS         = 280;   // gap between lines sweeping on

// `var`, not `let`: the HUD and the dances read it by name from files that load
// ABOVE this one, and a top-level `let` is in its temporal dead zone - a THROW,
// even under `typeof` - until this script has run.
var roundQuota = null;   // null, or { kind:'relay'|'lines', ... } - in SAVE_VARS
// True while the LINES explainer card is up: the round tick stands still.
var quotaIntroHold = false;

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
  // `shown` is what the board and HUD draw: it trails `prog` and catches up with
  // the score tally (roundQuotaClimb), so a line fills as the score climbs.
  lines.forEach((l, i) => { l.target = t; l.prog = 0; l.shown = 0; l.hue = i; });
  return { kind: 'lines', lines, announced: false };
}

// Called from triggerLevelUp once roundGoal is final (and after a hard round's
// raise). A hard round that names a quota always gets it; otherwise Flow rolls.
function levelTypeMaybeArm() {
  roundQuota = null;
  if (typeof bossActive !== 'undefined' && bossActive) return;
  const ch = (typeof guidedActiveChallenge !== 'undefined') && guidedActiveChallenge;
  if (ch && ch.quota) { roundQuota = roundQuotaBuild(ch.quota); return; }
  if (typeof flowActive === 'function' && flowActive() && level >= LEVEL_TYPE_FLOW_FROM) {
    const r = Math.random();
    if (r < LEVEL_TYPE_LINES_CHANCE) roundQuota = roundQuotaBuild('lines');
    else if (r < LEVEL_TYPE_LINES_CHANCE + LEVEL_TYPE_RELAY_CHANCE) roundQuota = roundQuotaBuild('relay');
  }
}

// The one "is this round's goal met" test.
function roundQuotaMet() {
  // A challenge round holds the goal open while a card is unsolved (js/challenge-round.js).
  if (typeof crHoldsGoal === 'function' && crHoldsGoal()) return false;
  const q = roundQuota;
  if (!q) return score >= roundGoal;
  if (q.kind === 'relay') return q.idx >= q.bars.length;
  return q.lines.every(l => l.prog >= l.target);
}

// Flow's reward chain asks this before the level-up clears the round: every line
// filled means at least QUOTA_LINES_REWARDS reward screens.
function quotaLinesRewardFloor() {
  const q = roundQuota;
  return (q && q.kind === 'lines' && q.lines.every(l => l.prog >= l.target)) ? QUOTA_LINES_REWARDS : 0;
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
      if (l.from == null) l.from = l.shown != null ? l.shown : l.prog;
      l.prog = Math.min(l.target, l.prog + Math.round(amount));
    });
    // The dance reveals it (roundQuotaClimb). A hand with no dance, or a dance cut
    // short, still lands: handleDanceAbort calls the reveal, and this is the net.
    clearTimeout(_qRevealNet);
    _qRevealNet = setTimeout(() => roundQuotaClimb(1), 9000);
    // The hand that fills the LAST line plays its fill and finale at once: Flow's
    // reward pick takes the board over partway through the goal hand's dance,
    // before the tally's climb would get there.
    if (q.lines.every(l => l.prog >= l.target)) {
      const t0 = performance.now(), dur = 650;
      const step = now => {
        if (roundQuota !== q) return;
        const e = Math.min(1, (now - t0) / dur);
        roundQuotaClimb(1 - Math.pow(1 - e, 3));
        if (e < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    return;
  }
  roundQuotaPaint();
}

// ── LINES: fill, flash, finish (r497) ───────────────────────────────────────
// Called every frame of the score tally's climb with its eased 0..1, and with 1
// when a dance ends any other way. Lines move from where they were toward their
// new total; a line that reaches its goal flashes and locks, and the last one
// flashes every line at once.
let _qRevealNet = null;
function roundQuotaClimb(e) {
  const q = roundQuota;
  if (!q || q.kind !== 'lines') return;
  let moved = false;
  q.lines.forEach(l => {
    if (l.from == null) return;
    l.shown = Math.round(l.from + (l.prog - l.from) * Math.min(1, e));
    moved = true;
  });
  if (!moved) return;
  if (e >= 1) {
    clearTimeout(_qRevealNet);
    const fresh = q.lines.filter(l => l.from != null && l.from < l.target && l.prog >= l.target);
    q.lines.forEach(l => { l.from = null; l.shown = l.prog; });
    renderQuotaLines(); roundQuotaPaintHud();
    const all = q.lines.every(l => l.prog >= l.target);
    if (all) quotaFinale();
    else fresh.forEach((l, i) => setTimeout(() => quotaLineDone(l), i * 220));
    return;
  }
  renderQuotaLines(); roundQuotaPaintHud();
}

function _qEls(l) {
  const g = document.getElementById('grid');
  const i = roundQuota ? roundQuota.lines.indexOf(l) : -1;
  return g ? [...g.querySelectorAll(`.q-line[data-qi="${i}"], .q-pill[data-qi="${i}"]`),
              ...document.querySelectorAll(`#score-progress-bar-wrap .q-meter[data-qi="${i}"]`)] : [];
}
function _qKick(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function quotaLineDone(l) {
  if (!roundQuota) return;
  const n = roundQuota.lines.filter(x => x.prog >= x.target).length;
  _qEls(l).forEach(el => _qKick(el, 'q-flash'));
  sfxQuotaLine(n);
  noteMessage(`${l.axis === 'row' ? 'Row' : 'Column'} ${l.index + 1} filled`);
}

function quotaFinale() {
  const q = roundQuota;
  if (!q) return;
  q.lines.forEach(l => _qEls(l).forEach(el => _qKick(el, 'q-final')));
  sfxQuotaAll();
}

// Called when a round actually begins (startRoundTimer). Says what the round is
// the first time it goes live.
function roundQuotaAnnounce() {
  const q = roundQuota;
  if (!q || q.announced) return;
  q.announced = true;
  const m = LEVEL_TYPE_META[q.kind];
  if (q.kind !== 'lines') {
    showMessage(`${m.icon} ${m.name}: ${m.desc}`, 'var(--c-cyan, #5ee)', { ms: 4200 });
    roundQuotaPaint();
    return;
  }
  noteMessage(`${m.name}: ${m.desc}`);
  roundQuotaPaint();
  // The first QUOTA_INTRO_TIMES LINES rounds open on the explainer card, with the
  // clock held until GOT IT. Later ones get the banner and go.
  let seen = 0;
  try { seen = +localStorage.getItem(QUOTA_INTRO_KEY) || 0; } catch (e) {}
  const full = seen < QUOTA_INTRO_TIMES && !(typeof tutorialActive === 'function' && tutorialActive());
  if (full) { try { localStorage.setItem(QUOTA_INTRO_KEY, String(seen + 1)); } catch (e) {} }
  quotaIntroShow(full);
}

function roundQuotaClear() { quotaIntroClose(); roundQuota = null; roundQuotaPaint(); }

// ── The opening card / banner (r497) ─────────────────────────────────────────
// Body-level, laid over the board's rect in viewport px (it lives outside
// #cabinet like every pop-up placed that way); sizes are design px x --qz.
let _qIntroEl = null, _qIntroTimer = null;
function quotaIntroShow(full) {
  quotaIntroClose();
  const grid = document.getElementById('grid');
  if (!grid || !grid.offsetWidth) { quotaSweep(); return; }
  const r = grid.getBoundingClientRect(), z = r.width / grid.offsetWidth;
  const flow = typeof flowActive === 'function' && flowActive();
  const el = document.createElement('div');
  el.id = 'q-intro';
  el.className = full ? 'q-intro-full' : 'q-intro-brief';
  el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--qz:${z}`;
  const sw = roundQuota.lines.map(l => `<i style="--qc:${QUOTA_LINE_COLORS[l.hue % QUOTA_LINE_COLORS.length]}"></i>`).join('');
  el.innerHTML = full
    ? `<div class="qi-card"><div class="qi-sw">${sw}</div><div class="qi-title">LINE QUOTAS</div>`
      + `<div class="qi-body">Each marked line has its own goal. A hand pays every marked line it touches.</div>`
      + `<div class="qi-body">Fill every line to clear the round.${flow ? ` Cleared, it pays <b>${QUOTA_LINES_REWARDS} rewards</b>.` : ''}</div>`
      + `<button class="qi-ok">GOT IT</button></div>`
    : `<div class="qi-card"><div class="qi-sw">${sw}</div><div class="qi-title">LINE QUOTAS</div>`
      + `<div class="qi-body">Fill every marked line${flow ? ` for <b>${QUOTA_LINES_REWARDS} rewards</b>` : ''}.</div></div>`;
  document.body.appendChild(el);
  _qIntroEl = el;
  requestAnimationFrame(() => el.classList.add('in'));
  sfxQuotaOpen();
  if (full) {
    quotaIntroHold = true;
    el.querySelector('.qi-ok').addEventListener('click', e => { e.stopPropagation(); quotaIntroClose(); quotaSweep(); });
  } else {
    quotaSweep();
    _qIntroTimer = setTimeout(quotaIntroClose, 1900);
  }
}
function quotaIntroClose() {
  clearTimeout(_qIntroTimer); _qIntroTimer = null;
  quotaIntroHold = false;
  const el = _qIntroEl; _qIntroEl = null;
  if (!el) return;
  el.classList.remove('in'); el.classList.add('out');
  setTimeout(() => el.remove(), 260);
}

// The lines draw on one at a time, each with a rising tick.
function quotaSweep() {
  const q = roundQuota;
  if (!q || q.kind !== 'lines') return;
  if (typeof updateScoreUI === 'function') updateScoreUI();   // the goal box reads LINES
  renderQuotaLines(); roundQuotaPaintHud();
  q.lines.forEach((l, i) => setTimeout(() => {
    if (roundQuota !== q) return;
    _qEls(l).forEach(el => _qKick(el, 'q-sweep'));
    sfxQuotaSweep(i);
  }, i * QUOTA_SWEEP_MS));
}

// ── Sounds (catalogued under Level types in js/audio-assets.js) ──────────────
// Opening: a low swell and a bright ping.
function sfxQuotaOpen() {
  if (typeof _crVoice !== 'function') return;
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 110, 220, 0.45, 0.09 * v, 'sawtooth');
    _crTone(ctx, out, t + 0.12, 880, 880, 0.3, 0.06 * v, 'triangle');
  });
}
// A line drawing on: a short tick, higher for each line.
function sfxQuotaSweep(i) {
  if (typeof _crVoice !== 'function') return;
  _crVoice((ctx, v, t, out) => { const f = 520 * Math.pow(1.26, i); _crTone(ctx, out, t, f, f * 1.5, 0.09, 0.07 * v, 'square'); });
}
// A line filled: a struck bell, higher for each line filled.
function sfxQuotaLine(n) {
  if (typeof _crVoice !== 'function') return;
  _crVoice((ctx, v, t, out) => {
    const f = 660 * Math.pow(1.19, Math.max(0, n - 1));
    _crTone(ctx, out, t, f, f, 0.5, 0.1 * v, 'triangle');
    _crTone(ctx, out, t, f * 2.01, f * 2.01, 0.35, 0.04 * v, 'sine');
    _crTone(ctx, out, t + 0.08, f * 1.5, f * 1.5, 0.45, 0.06 * v, 'triangle');
  });
}
// Every line filled: a rolled major chord with a low hit.
function sfxQuotaAll() {
  if (typeof _crVoice !== 'function') return;
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 130, 65, 0.3, 0.16 * v, 'sine');
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => _crTone(ctx, out, t + i * 0.06, f, f, 0.7, 0.07 * v, 'triangle'));
  });
}

// ── Drawing ──────────────────────────────────────────────────────────────────
// RELAY rides the score panel: the goal label reads "GOAL 2/3" and the bar is
// divided into three. LINES are drawn on the board, one colour per line: a band
// down each marked line behind the cards and a progress pill at its outer end
// (half outside the board, in the frame, so it never covers a rank). The HUD's
// goal bar becomes one meter per line in the same colours (r497).
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
  roundQuotaPaintHud();
  renderQuotaLines();
}

const _qShown = l => (l.shown != null ? l.shown : l.prog);
const _qColor = l => QUOTA_LINE_COLORS[(l.hue || 0) % QUOTA_LINE_COLORS.length];

// One meter per line inside the goal bar's wrap. Elements are kept and updated,
// so a flash on one survives the repaints around it.
function roundQuotaPaintHud() {
  const wrap = document.getElementById('score-progress-bar-wrap');
  if (!wrap) return;
  const q = roundQuota;
  const on = !!(q && q.kind === 'lines');
  wrap.classList.toggle('q-lines', on);
  let box = wrap.querySelector('.q-meters');
  if (!on) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'q-meters'; wrap.appendChild(box); }
  q.lines.forEach((l, i) => {
    let m = box.querySelector(`.q-meter[data-qi="${i}"]`);
    if (!m) {
      m = document.createElement('div');
      m.className = 'q-meter'; m.dataset.qi = i;
      m.innerHTML = '<div class="q-meter-fill"></div>';
      box.appendChild(m);
    }
    m.style.setProperty('--qc', _qColor(l));
    m.style.setProperty('--qf', Math.min(1, _qShown(l) / l.target));
    m.classList.toggle('q-done', _qShown(l) >= l.target);
  });
  box.querySelectorAll('.q-meter').forEach(m => { if (+m.dataset.qi >= q.lines.length) m.remove(); });
  // The goal box counts lines from what is drawn, so it ticks with the fill.
  const gd = document.getElementById('goal-display');
  if (gd && !(typeof scorePanelIsBetweenRounds === 'function' && scorePanelIsBetweenRounds()))
    gd.textContent = `${q.lines.filter(l => _qShown(l) >= l.target).length}/${q.lines.length}`;
}

function renderQuotaLines() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const q = roundQuota;
  const drop = () => gridEl.querySelectorAll('.q-line, .q-pill').forEach(e => e.remove());
  if (!q || q.kind !== 'lines') { drop(); return; }
  // Only over a live board - a takeover screen has emptied #grid of cards.
  if (!gridEl.querySelector('[data-card-id]')) { drop(); return; }
  if (typeof cellLeft !== 'function') return;
  const W = cellLeft(gridCols - 1) + CARD_W + GRID_PAD;
  const H = cellTop(gridRows - 1) + CARD_H + GRID_PAD;
  const get = (cls, i) => {
    let el = gridEl.querySelector(`.${cls}[data-qi="${i}"]`);
    if (!el) { el = document.createElement('div'); el.dataset.qi = i; el.classList.add(cls); gridEl.appendChild(el); }
    return el;
  };
  q.lines.forEach((l, i) => {
    if (l.axis === 'row' ? l.index >= gridRows : l.index >= gridCols) {
      gridEl.querySelectorAll(`.q-line[data-qi="${i}"], .q-pill[data-qi="${i}"]`).forEach(e => e.remove());
      return;
    }
    const shown = _qShown(l), done = shown >= l.target;
    const el = get('q-line', i);
    el.classList.toggle('q-line-row', l.axis === 'row');
    el.classList.toggle('q-line-col', l.axis !== 'row');
    el.classList.toggle('q-done', done);
    el.style.setProperty('--qc', _qColor(l));
    el.style.setProperty('--qf', Math.min(1, shown / l.target));
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
    // The pill is a SIBLING, not a child: the band carries z-index 1 and so is a
    // stacking context, and a pill inside it could never rise above the cards.
    const pill = get('q-pill', i);
    pill.classList.toggle('q-pill-row', l.axis === 'row');
    pill.classList.toggle('q-pill-col', l.axis !== 'row');
    pill.classList.toggle('q-done', done);
    pill.style.setProperty('--qc', _qColor(l));
    const txt = done ? '✓' : `${Math.round(shown).toLocaleString()}/${l.target.toLocaleString()}`;
    if (pill.textContent !== txt) pill.textContent = txt;
    if (l.axis === 'row') { pill.style.left = (W - GRID_PAD) + 'px'; pill.style.top = (cellTop(l.index) + CARD_H / 2) + 'px'; }
    else { pill.style.left = (cellLeft(l.index) + CARD_W / 2) + 'px'; pill.style.top = (H - GRID_PAD) + 'px'; }
  });
  gridEl.querySelectorAll('.q-line, .q-pill').forEach(e => { if (+e.dataset.qi >= q.lines.length) e.remove(); });
}
