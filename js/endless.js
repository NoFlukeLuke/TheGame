// ══ ENDLESS (r680, owner) ═══════════════════════════════════════════════════
// A won run can go on. The finale's ENDLESS key continues the run in Q5 (then
// Q6, Q7...) in the same loop the mode already plays: rounds, reviews, the
// Schedule's next quarter and department, Flow's next boss cycle. Goals climb
// FASTER from the level the run continued at: each level past it grows at
// `1 + (scale - 1) x endlessAccel` instead of `scale` (Flow's own rule since
// r155, goalTune('endlessAccel') 1.65, so 65% faster), applied to every mode's
// curve through endlessGoalMult. QRL stays at Q4's limit; the next boss draws
// as usual. A run in endless cannot be won again: it ends on a loss or a clock
// out, and the finale and the run history say how far it got.
//
// How a continue works: rolloverQuarter (js/quarter.js) keeps the continuation
// it would have run after the quarter card (`_endlessNext`) before it calls
// onGameWin, and endlessContinue runs it after the card. Flow's path is its
// own (survivalContinueEndless: the fifth boss's prize grid, then the next deal).
let endlessRun = false;        // SAVE_VARS: the run continued past its last quarter
let endlessFromLevel = Infinity;   // SAVE_VARS: levels past this one use the faster curve
let _endlessNext = null;       // the quarter rollover's continuation, kept for the finale

function endlessReset() { endlessRun = false; endlessFromLevel = Infinity; _endlessNext = null; }
// The multiplier over a mode's plain curve for level lv, given that curve's per-level scale.
function endlessGoalMult(lv, scale) {
  if (!endlessRun || !(lv > endlessFromLevel) || !(scale > 1)) return 1;
  const fast = 1 + (scale - 1) * goalTune('endlessAccel');
  return Math.pow(fast / scale, lv - endlessFromLevel);
}
// Can this finale offer ENDLESS? A won run in a quarter mode with its continuation
// kept, or a Flow run that has beaten its bosses and not continued yet.
function endlessOfferable() {
  if (typeof ACTIVE_MODE === 'undefined' || !ACTIVE_MODE) return false;
  if (ACTIVE_MODE.flow || (typeof survivalActive === 'function' && survivalActive())) return !(typeof survivalEndless !== 'undefined' && survivalEndless);
  return !!_endlessNext && typeof isActMode === 'function' && isActMode();
}
function endlessContinue() {
  if (!endlessOfferable()) return false;
  if (ACTIVE_MODE.flow || (typeof survivalActive === 'function' && survivalActive())) {
    if (typeof survivalContinueEndless === 'function') { survivalContinueEndless(); return true; }
    return false;
  }
  endlessRun = true;
  endlessFromLevel = typeof level === 'number' ? level : 1;
  const next = _endlessNext; _endlessNext = null;
  if (typeof drawActBoss === 'function') drawActBoss();
  if (typeof updateActProgressUI === 'function') updateActProgressUI();
  if (typeof showMessage === 'function') showMessage('ENDLESS. Quotas climb faster from here.', 'var(--c-coral, #ff6a3c)');
  showQuarterCard(actNumber - 1, actNumber, next);
  return true;
}
