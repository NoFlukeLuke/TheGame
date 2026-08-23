function flashScore(amount) {
  const el = document.getElementById('score-flash');
  el.textContent = `+${amount.toLocaleString()}`;
  el.className = '';
  void el.offsetWidth;
  el.className = 'flash';
}

function triggerMiniCardWave() {
  const cards = document.querySelectorAll('#selected-cards .mini-card');
  cards.forEach((card, i) => {
    setTimeout(() => {
      card.classList.remove('wave');
      void card.offsetWidth; // reflow to restart animation
      card.classList.add('wave');
    }, i * 60);
  });
}

// Small floating label for suit effects
let suitEffectTimeout = null;
function showSuitEffect(text, color) {
  // Reuse score-flash but offset slightly and chain
  const isSpade = color === 'var(--suit-spades)' || color === '#000' || color === '#000000';
  const shadow = isSpade
    ? '0 0 2px rgba(240,230,200,0.95), 0 0 1px rgba(240,230,200,1)'
    : '0 0 12px rgba(255,255,255,0.3)';
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;top:46%;left:50%;transform:translate(-50%,-50%);
    font-family:'Cinzel',serif;font-size:22px;font-weight:700;color:${color};
    text-shadow:${shadow};pointer-events:none;z-index:499;opacity:0;`;
  el.textContent = text;
  document.body.appendChild(el);
  el.animate([
    { opacity:0, transform:'translate(-50%,-50%) scale(0.8)' },
    { opacity:1, transform:'translate(-50%,-60%) scale(1.05)', offset:0.2 },
    { opacity:0, transform:'translate(-50%,-80%) scale(1)' }
  ], { duration:800, easing:'ease-out', fill:'forwards' }).finished.then(() => el.remove());
}

// ══════════════════════════════════════════════
// TIMERS
// ══════════════════════════════════════════════
function startRoundTimer() {
  if (roundInterval) clearInterval(roundInterval);
  startHeartbeat();                 // the board's idle pulse runs with the round
  syncDiscoveredFromOwned();        // log anything new for the Builds archive
  roundStartSeconds = roundSeconds; // mark the start of the countdown for ♠ "first 30s" exalt
  roundInterval = setInterval(() => {
    if (pipeTimerPaused) return;
    if (gameTimerPaused) return; // global pause covers menus/shop/events
    if (match3NoTimer()) return; // Zen / infinite dev mode: the clock never runs down
    roundSeconds--;
    if (roundSeconds < 0) roundSeconds = 0;
    // Slow Burn sleights accrue on-grid time → +1 max Focus per minute (see onGridSleightCapBonus)
    for (let _r = 0; _r < gridRows; _r++) for (let _c = 0; _c < gridCols; _c++) {
      const _cd = gridData[_r]?.[_c];
      if (_cd && _cd._isSleight && _cd.sleightId === 'slow_burn') _cd._slowBurnSecs = (_cd._slowBurnSecs || 0) + 1;
    }
    handleClockMarks(roundSeconds); // clock-mark Tricks (Tick-Tock, Quarter Chime, Minute/Second Hand, Hourglass)
    trickCardTimer++;
    if (trickCardTimer >= TRICK_CARD_INTERVAL) { trickCardTimer = 0; assignTrickCard(); }
    const _elapsedRound = roundStartSeconds - roundSeconds;
    // The Cuckoo: every 60s of round time, pause the clock by 1s for each retrigger so far this round
    if (hasTrick('cuckoo') && _elapsedRound >= cuckooNextMinute) {
      cuckooNextMinute += BAL.cuckoo.interval_seconds;
      if (retriggersThisRound > 0) pauseRound(retriggersThisRound);
    }
    // The Woodpecker: marking runs in alternating 30s blocks — active 0–30s, off 30–60s, active 60–90s, …
    // During an active block one random card is marked (pecking animation); during an off block nothing is marked.
    if (hasTrick('woodpecker')) {
      const _blk = Math.floor(_elapsedRound / 30);
      if (_blk !== woodpeckerActiveBlock) {
        woodpeckerActiveBlock = _blk;
        woodpeckerPos = (_blk % 2 === 0) ? { r: Math.floor(Math.random() * gridRows), c: Math.floor(Math.random() * gridCols) } : null;
        if (!animating && !falling) render(); // show/clear the highlight + trigger the peck animation
      }
    }
    updateClockUI();
    if (roundSeconds <= 0) onRoundEnd();
  }, 1000);
  // Start focus decay alongside the round timer (pauses internally during overlays)
  startFocusDecay();
  // Match-3: a freshly dealt board settles silently (no free opening cascade),
  // then the cascade engine takes over. Resuming mid-round only re-resolves.
  if (match3Active()) {
    if (match3PendingSettle) { match3PendingSettle = false; match3SettleBoard(); render(); }
    match3ApplyZenResources();
    setTimeout(() => match3Resolve(), 300);
  }
}

function startTimers() {
  // During a boss the boss timer owns the clock; don't also start the round timer.
  if (bossActive) startBossTimer();
  else startRoundTimer();

  // Game timer
  gameInterval = setInterval(() => {
    if (gameTimerPaused) return;
    gameSeconds--;
    // Match-3 and Dominoes run their own round-goal loops, so they must NOT take
    // the legacy timer-based progression below (which would pop shops/bosses off
    // the 20-minute game clock and hard-end the run at 0).
    if (!isActMode() && !match3Active() && !dominoActive()) {
      const m = Math.floor(gameSeconds/60);
      const s = gameSeconds%60;
      document.getElementById('game-timer').textContent = `${m}:${s.toString().padStart(2,'0')}`;
      // Timer-based progression
      if (gameSeconds === nextShopTime) {
        if (bossActive) {
          nextShopTime -= 1;
        } else {
          nextShopTime -= 120;
          triggerShop();
        }
      }
      if (gameSeconds === nextBossTime && !bossActive) {
        nextBossTime -= BOSS_LOOP_DURATION;
        triggerBoss();
      }
      if (gameSeconds <= 0) onGameEnd(false);
    }
  }, 1000);
}

// v7 interact time-costs — spending an action burns seconds off the round clock.
const DISCARD_TIME_COST = 3;
const SWAP_TIME_COST    = 4;
function spendRoundTime(sec) {
  if (roundEnded || !sec || sec <= 0) return;
  roundSeconds -= sec;
  if (roundSeconds < 0) roundSeconds = 0;
  updateClockUI();   // next timer tick ends the round if this hit 0
}

function updateClockUI() {
  if (bossActive) return; // boss timer manages clock display itself
  const secs = Math.max(roundSeconds, 0);
  const m = Math.floor(secs/60);
  const s = secs%60;
  const clockEl = document.getElementById('clock');
  const barEl = document.getElementById('clock-bar');
  clockEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  barEl.style.width = (secs/ROUND_DURATION*100)+'%';
  const vf = document.getElementById('vclock-fill'); if (vf) vf.style.width = (secs/ROUND_DURATION*100)+'%';
  clockEl.classList.toggle('clock-paused', pipeTimerPaused);
  if (secs <= 10) { clockEl.classList.add('urgent'); barEl.classList.add('urgent'); }
  else { clockEl.classList.remove('urgent'); barEl.classList.remove('urgent'); }
}

function assignTrickCard() {
  const r = Math.floor(Math.random() * gridRows);
  const c = Math.floor(Math.random() * gridCols);
  trickCardPos = [r,c];
  render();
}

function stopTimers() {
  clearInterval(roundInterval);
  clearInterval(gameInterval);
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }
  roundInterval = null;
  gameInterval = null;
  stopFocusDecay();
  stopHeartbeat();
}

// ══════════════════════════════════════════════
// ROUND END
// ══════════════════════════════════════════════
function onRoundEnd() {
  if (challengeActive) {
    // Timer expired with challenge incomplete
    if (hasTrick('resilience') && !resilienceUsed) {
      resilienceUsed = true;
      roundSeconds = Math.max(10, ROUND_DURATION - roundPenaltySeconds);
      updateClockUI();
      showMessage('SECOND CHANCE — FINISH THE CHALLENGE!', '#c9a84c');
      startRoundTimer();
      return;
    }
    resolveChallenge(false);
    setTimeout(() => onGameEnd(true), 2300);
    return;
  }
  // Normal mode: once the goal is reached, the score-dance → interlude owns the
  // whole round transition. Ignore a stray/late timer tick so the legacy
  // level-up flow (showLevelUpScreen / trick pick) can never fire on top of it.
  if ((isActMode() || match3Active()) && goalReachedThisRound) return;
  _onRoundEndCore();
}

function _onRoundEndCore() {
  // goalReachedThisRound means the goal hand was already played even if the dance is still running
  if (score >= roundGoal || goalReachedThisRound) {
    cancelDance();
    suppressScoreDisplay = false;
    if (heldBackScore > 0) { score += heldBackScore; heldBackScore = 0; }
    // Dominoes has its own round advance; the normal level-up flow is poker-specific
    // (trick pick, sleight sweep, card deal) and would corrupt the domino board.
    if (dominoActive()) { dominoAdvanceLevel(); return; }
    triggerLevelUp();
    return;
  }
  if (hasTrick('resilience') && !resilienceUsed) {
    resilienceUsed = true;
    roundSeconds = Math.max(10, ROUND_DURATION - roundPenaltySeconds);
    updateClockUI();
    flashScore(0);
    showMessage('SECOND CHANCE', '#c9a84c');
    return;
  }
  if (hasKnack('safety_net') && !safetyNetUsed) {
    safetyNetUsed = true;
    roundSeconds = 30;
    updateClockUI();
    flashScore(0);
    showMessage('🪢 Safety Net — 30s extension!', 'var(--gold)');
    startRoundTimer();
    return;
  }
  onGameEnd(true);
}

function showMessage(text, color) {
  const el = document.getElementById('score-flash');
  el.textContent = text;
  el.style.color = color;
  el.className = '';
  void el.offsetWidth;
  el.className = 'flash';
  setTimeout(() => { el.style.color = ''; }, 1000);
}

// ══════════════════════════════════════════════
// BOSS SYSTEM
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// BOSS SYSTEM (v2)
// ══════════════════════════════════════════════

// Boss preset definitions. Each preset has:
//   id, name, flavor (subtitle)
//   objective: { type: 'score', target } | { type: 'hand', handName, count }
//   modifiers: array of modifier ids (see applyBossModifiers)
//   params: optional tuning (voidPattern, stoneInjectCount, swapsDelta, lockedHand, etc.)
