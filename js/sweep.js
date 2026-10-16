// ── All Hands (r572) ───────────────────────────────────────────────────────
//
// A legendary double-tap Sleight with no cost. It reads the board like a page,
// left to right, top to bottom, and at every card it reaches takes the best hand
// that card can anchor out of the cards no earlier hand has claimed. Then it
// plays them all. Owner's spec: "show it selecting cards one by one, then a
// sound or beat, then doing so for another hand, with speed ramping up for each
// card selected, then have it make a big animation of all the cards flying to
// the scoring area, with all their score chips going everywhere in a big fuss,
// and have the pips and mult animate up to the total numbers that each hand
// would have scored added up, and then total the total up and add it to score."
//
// How it scores: every hand goes through the real playHand, one after another,
// with `_sweepSilent` set. Silent means no dance, no fall and no goal check for
// that hand; everything else a hand does (Tricks, families, counters, time,
// credits, Focus multiplier) happens as usual. The cards stay on the board until
// the finale, when they all fly to the preview together and one removeAndFall
// takes them off. Then, if the round's goal is met, the round ends through the
// same exit the dance's goal hand uses.
//
// Owner's rules: the hands count for Tricks and hand families, but they make no
// speed or complexity Focus (autoplayNoFocus). Ringer and Roll Call stand down
// while a sweep plays, since either could pull a card another hand had claimed.
// A sweep does not run in a boss round (the boss objective and win path belong to
// hands the player plays) and waits for the board to settle.

let _sweepRun = null;       // { card, at:[r,c], hands, locked: Map('r-c' -> hand index) } while a sweep is live
let _sweepSilent = false;   // true while a sweep plays one hand through playHand
let _sweepRec = null;       // what playHand hands back from a silent hand: { result, cells }

const SWEEP_SEL_MS  = [240, 55];    // first and last select beat (ramps over the whole sweep)
const SWEEP_HAND_MS = [460, 170];   // the beat after each hand
const SWEEP_MAX_HANDS = 12;
const SWEEP_FLY_MS = 380;

function sweepRunning() { return !!_sweepRun; }
function sweepSilent() { return _sweepSilent; }
function _swLerp(pair, t) { return pair[0] + (pair[1] - pair[0]) * Math.max(0, Math.min(1, t)); }

// ── Finding the hands ──────────────────────────────────────────────────────────
// The best hand anchored on (r0,c0) from the still-free cards: every connected
// shape grown from that cell, kept when every card is load-bearing (one kicker
// allowed, as in play), ranked by summed component worth then by card count.
// Same search as autopilotBestHand, with a fixed start and an exclusion set.
function _sweepBestFrom(r0, c0, usable, cap, allow, minN) {
  const key = cells => cells.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');
  const seen = new Set();
  let best = null, bestW = -1, budget = 2500;
  const grow = cells => {
    if (budget-- <= 0) return;
    if (cells.length >= minN) {
      const k = key(cells);
      if (seen.has(k)) return;
      seen.add(k);
      const res = handComponentsFor(cells);
      if (res && res.playable) {
        const claimed = new Set();
        res.components.forEach(cp => cp.cells.forEach(([r, c]) => claimed.add(r + '-' + c)));
        const spare = cells.length - claimed.size;
        if (spare <= allow) {
          const w = res.components.reduce((s, cp) => s + handWorth(cp.name), 0) * (spare ? 0.8 : 1) + cells.length * 0.01;
          if (w > bestW) { bestW = w; best = [...cells]; }
        }
      }
    }
    if (cells.length >= cap) return;
    for (const [cr, cc] of cells)
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = cr + dr, nc = cc + dc;
        if (!usable(nr, nc) || cells.some(([a, b]) => a === nr && b === nc)) continue;
        grow([...cells, [nr, nc]]);
      }
  };
  grow([[r0, c0]]);
  return best;
}

// Every hand the sweep will play, in reading order, each hand's cells in reading order.
function sweepHands() {
  const cap = Math.min(gridRows * gridCols > 30 ? 4 : 5, (limits.selection && limits.selection.current) || 3);
  const minN = Math.max(2, (typeof handMinSelection === 'function') ? handMinSelection() : 2);
  const allow = (typeof tagalongMax === 'function') ? tagalongMax() : 1;
  const used = new Set();
  const usable = (r, c) => r >= 0 && c >= 0 && r < gridRows && c < gridCols
    && !!gridData[r]?.[c] && cardCan(gridData[r][c], 'select') && !isCellBlocked(r, c)
    && !gridData[r][c]._isSleight && !used.has(r + '-' + c);
  const hands = [];
  for (let r = 0; r < gridRows && hands.length < SWEEP_MAX_HANDS; r++)
    for (let c = 0; c < gridCols && hands.length < SWEEP_MAX_HANDS; c++) {
      if (!usable(r, c)) continue;
      const best = _sweepBestFrom(r, c, usable, cap, allow, minN);
      if (!best) continue;
      best.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      best.forEach(([rr, cc]) => used.add(rr + '-' + cc));
      hands.push(best);
    }
  return hands;
}

// ── The sweep ──────────────────────────────────────────────────────────────────
function sweepStart(card, r, c) {
  if (_sweepRun) return;
  const dim = 'var(--cream-dim)';
  if (bossActive) { refuse('All Hands cannot run in a boss round', { color: dim }); return; }
  const busy = animating || falling || !!danceAbortController || roundEnded
    || (typeof dealerHand !== 'undefined' && dealerHand)
    || (typeof autopilotRunning === 'function' && autopilotRunning())
    || (typeof sleightSpinLock !== 'undefined' && sleightSpinLock);
  if (busy) { refuse('All Hands: let the board settle first', { color: dim }); return; }
  const hands = sweepHands();
  if (!hands.length) { refuse('All Hands: no hand on the board', { color: dim }); return; }
  // The charge is spent now; the card itself leaves with the hands in the finale,
  // because a fall before then would move every card the sweep has picked.
  card._usedThisRound = true;
  if (card._usesLeft !== 'infinite') card._usesLeft = Math.max(0, card._usesLeft - 1);
  _sweepRun = { card, at: [r, c], hands, locked: new Map() };
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  document.body.classList.add('sweep-on', 'autoplay-loud');
  spinSleightTile(r, c);
  showMessage(`ALL HANDS: ${hands.length} hand${hands.length === 1 ? '' : 's'}`, 'var(--gold)');
  dbgEvent('info', 'sweep start', { hands: hands.length, cards: hands.reduce((s, h) => s + h.length, 0) });
  _sweepShow().catch(e => { console.error(e); _sweepFinish(); });
}

// Phase 1: pick the hands out, card by card, faster as it goes, a beat per hand.
async function _sweepShow() {
  const run = _sweepRun;
  const total = run.hands.reduce((s, h) => s + h.length, 0);
  let k = 0;
  for (let i = 0; i < run.hands.length; i++) {
    const h = run.hands[i];
    for (const cell of h) {
      if (_sweepRun !== run || roundEnded) { _sweepFinish(); return; }
      selected = [...selected, cell];
      render();
      if (typeof sfxCardSelectLoud === 'function') sfxCardSelectLoud();
      await wait(_swLerp(SWEEP_SEL_MS, k / Math.max(1, total - 1)));
      k++;
    }
    if (_sweepRun !== run || roundEnded) { _sweepFinish(); return; }
    h.forEach(([rr, cc]) => run.locked.set(rr + '-' + cc, i));
    selected = [];
    render();
    if (typeof sfxOverdriveHit === 'function') sfxOverdriveHit(i);
    await wait(_swLerp(SWEEP_HAND_MS, i / Math.max(1, run.hands.length - 1)));
  }
  if (_sweepRun !== run || roundEnded) { _sweepFinish(); return; }
  await _sweepScore();
}

// Called from playHand's commit site instead of the dance while _sweepSilent.
function sweepRecord(result, cells) { _sweepRec = { result, cells }; }

// Phase 2: play every hand silently through playHand, then the finale.
async function _sweepScore() {
  const run = _sweepRun;
  const recs = [];
  suppressScoreDisplay = true;   // the score lands in the finale's climb, not hand by hand
  for (let i = 0; i < run.hands.length; i++) {
    if (_sweepRun !== run || roundEnded) break;
    selected = run.hands[i].slice();
    _sweepRec = null; _sweepSilent = true;
    try { playHand(); } catch (e) { console.error(e); } finally { _sweepSilent = false; }
    if (_sweepRec) recs.push(_sweepRec);
    _sweepRec = null;
  }
  selected = [];
  if (_sweepRun !== run || roundEnded) { _sweepFinish(); return; }
  if (!recs.length) { dbgEvent('warn', 'sweep: no hand scored'); _sweepFinish(); return; }
  await _sweepFinale(run, recs);
}

// Phase 3: the fuss.
async function _sweepFinale(run, recs) {
  const ledgerOf = x => (x.result && x.result._bankLedger) || {};
  const sumPips  = recs.reduce((s, x) => s + (ledgerOf(x).finalPips || lastCalcPips || 0), 0);
  const sumMult  = recs.reduce((s, x) => s + (ledgerOf(x).finalMult || 0), 0);
  const sumScore = recs.reduce((s, x) => s + (x.result.finalScore || 0), 0);
  const scoreAfter = score, scoreBefore = score - sumScore;
  const cells = recs.flatMap(x => x.cells);
  const gridEl = document.getElementById('grid');
  const stage = document.getElementById('selected-cards');
  const fmtM = m => (m % 1 === 0) ? m : m.toFixed(1);
  if (typeof holdHandNameLabel === 'function') holdHandNameLabel(false);
  if (typeof updateHandNameLabel === 'function') { try { updateHandNameLabel({ hand: `${recs.length} HANDS`, handCells: cells }, true); } catch (e) {} }
  if (typeof holdHandNameLabel === 'function') holdHandNameLabel(true);
  if (typeof portraitDanceBegin === 'function') portraitDanceBegin();
  stage.classList.add('dnc-active', 'sweep-stage'); stage.innerHTML = '';
  const row = document.createElement('div'); row.className = 'dnc-row hand';
  const lab = document.createElement('div'); lab.className = 'dnc-lab';
  const items = document.createElement('div'); items.className = 'dnc-items';
  const track = document.createElement('div'); track.className = 'dnc-track';
  row.appendChild(lab); row.appendChild(items); items.appendChild(track); stage.appendChild(row);
  // One slot per card, in sweep order, each hand's cards under its own hue.
  const slots = [];
  recs.forEach((x, hi) => x.cells.forEach(([r, c]) => {
    const card = gridData[r]?.[c]; if (!card) return;
    const outer = document.createElement('div');
    outer.className = 'dnc-outer' + (card._isSleight ? ' dnc-turn' : '');
    outer.style.setProperty('--sw-h', String((hi * 47) % 360));
    const d = document.createElement('div');
    const { className, innerHTML } = renderCardAppearance(card, r, c, { revealFog: true });
    d.className = className + ' preview-card sweep-card'; d.innerHTML = innerHTML;
    outer.appendChild(d); track.appendChild(outer);
    outer.style.opacity = '0';
    slots.push({ card, r, c, outer, hi });
  }));
  if (typeof fitPortraitPreviewCards === 'function') fitPortraitPreviewCards();
  // Shrink the strip so every card fits: zoom the track to the room there is.
  const fitZoom = () => {
    const w = items.clientWidth || stage.clientWidth, need = track.scrollWidth;
    const z = (w && need > w) ? Math.max(0.3, w / need) : 1;
    track.style.zoom = z.toFixed(3);
  };
  fitZoom();
  await wait(30); fitZoom();
  // Everything flies, quickly, in sweep order.
  const stag = Math.max(14, Math.min(60, 900 / Math.max(1, slots.length)));
  slots.forEach((s, i) => setTimeout(() => {
    if (_sweepRun !== run) return;
    const gEl = gridEl?.querySelector(`[data-card-id="${s.card._id}"]`);
    flyGridCardToSlot(gEl, s.outer, SWEEP_FLY_MS, i);
    if (typeof sfxCardPop === 'function') sfxCardPop(cardColorSuit(s.card));
  }, i * stag));
  await wait(slots.length * stag + SWEEP_FLY_MS + 120);
  if (_sweepRun !== run) return;
  // Off the board, all at once; the Sleight itself goes with them (play mode puts
  // every card, the Sleight included, into the played pile with its charges).
  const [sr, sc] = run.at;
  const fallCells = cells.slice();
  if (gridData[sr]?.[sc] === run.card) fallCells.push([sr, sc]);
  else if (typeof dbgEvent === 'function') dbgEvent('warn', 'sweep: Sleight moved; not removed');
  if (typeof sfxFlipShuffle === 'function') sfxFlipShuffle();
  removeAndFall(fallCells, 'play'); dncHiddenGridEls = [];
  run.locked.clear();

  // Chips everywhere: each hand throws its pips at PIPS and its mult at MULT,
  // from its own cards, plus loose change, and the two boxes climb to the sums.
  const pipsEl = document.getElementById('pips-val'), multEl = document.getElementById('mult-val'),
        focusEl = document.getElementById('focus-val'), scoreEl = document.getElementById('score-total-num');
  const pipsBox = document.getElementById('pips-box'), multBox = document.getElementById('mult-box');
  if (pipsEl) pipsEl.textContent = '0'; if (multEl) multEl.textContent = '0';
  if (focusEl) { const fm = focusMultiplier(); focusEl.textContent = '×' + (fm % 1 === 0 ? fm : fm.toFixed(2).replace(/0$/, '')); }
  const COLS = { pipAdd: '#d4a857', multAdd: '#b07dea' };
  const plateDur = 520, perHand = Math.max(40, Math.min(110, 1400 / Math.max(1, recs.length)));
  let firstSlot = 0;
  const flights = [];
  recs.forEach((x, hi) => {
    const L = ledgerOf(x), hp = Math.round(L.finalPips || 0), hm = Math.round((L.finalMult || 0) * 10) / 10;
    const mine = slots.filter(s => s.hi === hi);
    const at = hi * perHand;
    const throwFrom = (s, box, kind, label, scale, delay) => {
      flights.push(new Promise(res => setTimeout(() => {
        if (_sweepRun !== run || !box) { res(); return; }
        const a = s.outer.getBoundingClientRect(), b = box.getBoundingClientRect();
        if (a.width && b.width && typeof ptLaunch === 'function') ptLaunch(a, b, kind, label, COLS[kind], plateDur, { scale, trail: 0 });
        setTimeout(() => { if (typeof dncTick === 'function') dncTick(kind === 'pipAdd' ? pipsEl : multEl); res(); }, plateDur);
      }, delay)));
    };
    if (mine.length) {
      throwFrom(mine[0], pipsBox, 'pipAdd', '+' + hp, 1.1, at);
      throwFrom(mine[mine.length - 1], multBox, 'multAdd', '+' + fmtM(hm), 1.1, at + perHand * 0.4);
      // loose change: a small blip from each other card, alternating boxes
      mine.slice(1, -1).forEach((s, j) => throwFrom(s, j % 2 ? multBox : pipsBox, j % 2 ? 'multAdd' : 'pipAdd', '', 0.55, at + 60 + j * 45));
    }
    firstSlot += mine.length;
  });
  // The boxes climb while the plates land.
  const climbMs = recs.length * perHand + plateDur;
  const st = performance.now();
  await new Promise(res => {
    (function tk(now) {
      if (_sweepRun !== run) { res(); return; }
      const t = Math.max(0, Math.min((now - st) / climbMs, 1)), e = 1 - Math.pow(1 - t, 2);
      if (pipsEl) pipsEl.textContent = Math.round(sumPips * e);
      if (multEl) multEl.textContent = fmtM(Math.round(sumMult * e * 10) / 10);
      if (typeof sfxScoreTick === 'function' && fxRandom() < 0.3) sfxScoreTick();
      if (t < 1) requestAnimationFrame(tk); else res();
    })(performance.now());
  });
  await Promise.all(flights);
  if (_sweepRun !== run) return;
  if (pipsEl) pipsEl.textContent = Math.round(sumPips);
  if (multEl) multEl.textContent = fmtM(Math.round(sumMult * 10) / 10);
  await wait(220);
  // Fuse the chips onto the sweep's total, throw it at SCORE, run the number up.
  if (typeof pmfMergeIn === 'function') {
    await pmfMergeIn(sumScore, { speed: 1 });
    if (_sweepRun !== run) return;
    if (typeof pmfFlyToScore === 'function') await pmfFlyToScore({ speed: 1 });
    if (_sweepRun !== run) return;
  }
  suppressScoreDisplay = false;
  if (scoreEl) scoreEl.textContent = scoreBefore.toLocaleString();
  const climb = 700, st2 = performance.now();
  await new Promise(res => {
    (function tk(now) {
      if (_sweepRun !== run) { res(); return; }
      const t = Math.max(0, Math.min((now - st2) / climb, 1)), e = 1 - Math.pow(1 - t, 3);
      if (scoreEl) scoreEl.textContent = Math.round(scoreBefore + (scoreAfter - scoreBefore) * e).toLocaleString();
      if (typeof roundQuotaClimb === 'function') roundQuotaClimb(e);
      if (typeof sfxScoreTick === 'function' && fxRandom() < 0.35) sfxScoreTick();
      if (t < 1) requestAnimationFrame(tk); else res();
    })(performance.now());
  });
  if (typeof sfxHandScored === 'function') sfxHandScored(sumScore);
  if (typeof pmfSplitOut === 'function') await pmfSplitOut({ speed: 1 });
  if (_sweepRun !== run) return;
  // Settle.
  if (typeof holdHandNameLabel === 'function') holdHandNameLabel(false);
  stage.classList.remove('dnc-active', 'sweep-stage'); stage.innerHTML = '';
  if (typeof portraitDanceEnd === 'function') portraitDanceEnd();
  if (pipsEl) pipsEl.textContent = '0'; if (multEl) multEl.textContent = '0';
  const scoreBoxEl = document.getElementById('score-mid');
  if (scoreBoxEl) { scoreBoxEl.classList.remove('box-popping'); void scoreBoxEl.offsetWidth; scoreBoxEl.classList.add('box-popping'); }
  updateScoreUI();
  dbgEvent('ok', 'sweep done', { hands: recs.length, pips: sumPips, mult: sumMult, score: sumScore });
  // The goal: the round ends through the dance's own goal exit.
  if (!goalReachedThisRound && !bossActive && roundQuotaMet()) { _sweepEndRound(); return; }
  _sweepFinish();
}

// The round is won by a sweep: the same exit the goal hand's dance takes, with
// no goal cards to lift (they are already in the played pile).
function _sweepEndRound() {
  _sweepFinish();
  goalReachedThisRound = true;
  roundEnded = true;
  if (!challengeActive) { clearInterval(roundInterval); roundInterval = null; }
  if (typeof svGoalCells !== 'undefined') svGoalCells = [];
  if (typeof captureGoalHand === 'function') captureGoalHand([]);
  if (typeof flashRoundEnd === 'function') flashRoundEnd();
  if (challengeActive) { showMessage('GOAL MET - COMPLETE THE CHALLENGE', '#c9a84c'); return; }
  gameTimerPaused = true; frozenRoundSeconds = roundSeconds;
  sfxVictory();
  try {
    const ctx = getAudioCtx();
    if (sfxDuckGain) sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
    else { sfxDuckGain = ctx.createGain(); sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); sfxDuckGain.connect(ctx.destination); }
  } catch (e) {}
  if (typeof bossSettleWin === 'function' && bossSettleWin()) return;
  if (survivalActive()) { if (typeof survivalShowPick === 'function') survivalShowPick(); }
  else setTimeout(() => startInterlude(), 400);
}

function _sweepFinish() {
  const run = _sweepRun;
  _sweepRun = null; _sweepSilent = false; _sweepRec = null;
  suppressScoreDisplay = false;
  document.body.classList.remove('sweep-on', 'autoplay-loud');
  if (!run) return;
  selected = [];
  const stage = document.getElementById('selected-cards');
  if (stage && stage.classList.contains('sweep-stage')) { stage.classList.remove('dnc-active', 'sweep-stage'); stage.innerHTML = ''; }
  if (typeof holdHandNameLabel === 'function') holdHandNameLabel(false);
  if (!animating && !falling && !roundEnded) { try { render(); } catch (e) {} }
  updateScoreUI();
}

// From render()'s tail: the hands already picked keep their mark on the board.
function sweepPaint() {
  const run = _sweepRun;
  if (!run || !run.locked.size) return;
  const gridEl = document.getElementById('grid'); if (!gridEl) return;
  run.locked.forEach((hi, k) => {
    const [r, c] = k.split('-').map(Number);
    const card = gridData[r]?.[c]; if (!card) return;
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`); if (!el) return;
    el.classList.add('sweep-locked');
    el.style.setProperty('--sw-h', String((hi * 47) % 360));
  });
}

// A new run (startGame) clears any sweep in flight.
function sweepReset() { _sweepFinish(); }
