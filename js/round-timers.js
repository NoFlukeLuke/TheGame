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
  // A live clock again: drop the goal-clear lock the previous round left on it,
  // and any banner still fading (js/goal-clear.js). Every round start funnels
  // through here, so this is the single release point.
  if (typeof clearClockCleared === 'function') clearClockCleared();
  if (typeof hideGoalBanner === 'function') hideGoalBanner();
  if (typeof sfxSetMuffle === 'function') sfxSetMuffle(false);
  startHeartbeat();                 // the board's idle pulse runs with the round
  cdStartTicker();                  // cooldown / disable rings (js/cooldown.js)
  // A Spectrum fixture queued to leave by the GOAL hand never drained - that
  // hand's finale explodes the board instead of calling removeAndFall - and the
  // interlude has since discarded the whole board anyway. Drop the stale entry
  // rather than carry it into a round whose board it is not on. (js/spectrum.js)
  if (typeof spectrumClearFixtureExits === 'function') spectrumClearFixtureExits();
  syncDiscoveredFromOwned();        // log anything new for the Builds archive
  roundStartSeconds = roundSeconds; // mark the start of the countdown for ♠ "first 30s" exalt
  // Suspension resolves HERE, not in triggerLevelUp: it needs roundStartSeconds to
  // know where the round's halfway mark is, and this is the one call site every
  // round start funnels through (the same reason the save checkpoint lives here).
  if (typeof resolveEntityLockout === 'function') resolveEntityLockout();
  // Save point. Every round start funnels through here, so this is where a run
  // snapshot is taken; Settings → SAVE RUN just writes the latest one out. See
  // js/save.js for why the save point is a round boundary and not "right now".
  // Save point. Every round start funnels through here (see js/save.js). A boss
  // round is deliberately NOT a save point: forceBossNextRound has already been
  // consumed by the time triggerBoss runs, so a checkpoint taken here would resume
  // into an ordinary round with the boss gone. The previous round's checkpoint stands.
  if (!bossActive && typeof captureRunCheckpoint === 'function') captureRunCheckpoint();
  // Mini-boss challenge rounds (r239): the round's handicap arms exactly when
  // its clock starts - which also covers a resumed round, since resume lands
  // here too. AFTER the checkpoint, so a save never captures half-armed effects.
  if (typeof miniBossMaybeStart === 'function') miniBossMaybeStart();
  roundInterval = setInterval(() => {
    if (pipeTimerPaused) return;
    if (gameTimerPaused) return; // global pause covers menus/shop/events
    if (match3NoTimer()) return; // Zen / infinite dev mode: the clock never runs down
    // One clock, one tick (r205). Under The Metronome bossClockStep() returns the
    // live Focus multiplier instead of 1, with a fractional carry so x1.4 really
    // costs 1.4s/s rather than rounding away.
    roundSeconds -= (bossActive && typeof bossClockStep === 'function') ? bossClockStep() : 1;
    if (roundSeconds < 0) roundSeconds = 0;
    // Slow Burn sleights accrue on-grid time → +1 max Focus per minute (see onGridSleightCapBonus)
    for (let _r = 0; _r < gridRows; _r++) for (let _c = 0; _c < gridCols; _c++) {
      const _cd = gridData[_r]?.[_c];
      if (_cd && _cd._isSleight && _cd.sleightId === 'slow_burn') _cd._slowBurnSecs = (_cd._slowBurnSecs || 0) + 1;
    }
    if (survivalActive()) survivalTickBossClock(); // 5-minute boss cadence (live play time)
    // Tempo knack: every N seconds hand back 1 resource, alternating swap → discard → swap.
    // The alternation always advances, even when that stock is already full, so the rhythm
    // stays predictable instead of stalling on a capped resource.
    if (hasKnack('tempo')) {
      if (++tempoElapsed >= BAL.tempo.interval_seconds) {
        tempoElapsed = 0;
        // Refill up to the CURRENT limit, not a hardcoded 2 - so raising the swap/discard
        // limit (shop, events, other knacks) also raises where Tempo's drip tops out.
        if (tempoNextIsSwap) { if (swaps    < limits.swaps.current)    { swaps++;    showMessage('⏲️ Tempo - +1 swap',    'var(--gold)'); } }
        else                 { if (discards < limits.discards.current) { discards++; showMessage('⏲️ Tempo - +1 discard', 'var(--gold)'); } }
        tempoNextIsSwap = !tempoNextIsSwap;
        if (!animating && !falling) render();
      }
    }
    handleClockMarks(roundSeconds); // clock-mark Tricks (Tick-Tock, Quarter Chime, Minute/Second Hand, Hourglass)
    trickCardTimer++;
    if (trickCardTimer >= TRICK_CARD_INTERVAL) { trickCardTimer = 0; assignTrickCard(); }
    const _elapsedRound = roundStartSeconds - roundSeconds;
    // Understudy: every N seconds of round time, prime one random Trick in the
    // tray. Priming is the mechanic the Rehearsal event already built on - a
    // primed Trick fires one extra time in calcScore - so this knack needed no
    // per-Trick code, and the primed tile shows its charge through the same
    // cooldown widget (js/cooldown.js).
    if (hasKnack('understudy') && _elapsedRound >= understudyNextMark) {
      understudyNextMark += BAL.understudy.interval_seconds;
      const _pool = (trickTray || []).filter(t => !(typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(t.id)));
      if (_pool.length) {
        const _t = _pool[Math.floor(Math.random() * _pool.length)];
        _t._primed = (_t._primed || 0) + 1;
        showMessage(`🎭 Understudy - ${_t.name} primed`, '#8a5cf0');
        renderTrickTray?.();
      }
    }
    if (typeof hallmarkTick === 'function') hallmarkTick(_elapsedRound);
    // The Cuckoo: every 60s of round time, pause the clock by 1s for each retrigger so far this round
    if (hasTrick('cuckoo') && _elapsedRound >= cuckooNextMinute) {
      cuckooNextMinute += BAL.cuckoo.interval_seconds;
      if (retriggersThisRound > 0) pauseRound(retriggersThisRound);
    }
    // Compound (legendary): bank the round score at each mark. It is paid out by the
    // NEXT scored hand, so a mark passing with nothing scored yet banks nothing -
    // the trick rewards scoring early and compounds from there.
    if (hasTrick('compound') && _elapsedRound >= compoundNextMark) {
      compoundNextMark += BAL.compound.interval_seconds;
      const _bank = Math.floor(score * BAL.compound.bank_fraction);
      if (_bank > 0) {
        compoundBanked += _bank;
        showMessage('Compound: ' + _bank.toLocaleString() + ' banked', '#d8a13a');
      }
    }
    // The Woodpecker: marking runs in alternating 30s blocks - active 0–30s, off 30–60s, active 60–90s, …
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
    // ── Boss round: the parts of the tick that only a boss has ──────────────
    if (bossActive) {
      // Repaints the tray only when the switched-off set changes - covers the
      // Voidwright's halftime flip AND the Censor's suspensions expiring, neither
      // of which has an event of its own.
      if (typeof bossSyncTrickTrayState === 'function') bossSyncTrickTrayState();
      // The Quota's deadlines are moments on the clock, not intervals - the
      // Metronome can eat several seconds in one tick, so they are tested as
      // "the clock has passed this" rather than fired at it.
      if (typeof bossQuotaTick === 'function') bossQuotaTick();
      // The Bookkeeper absorbs anything a Trick handed back into the shared pool.
      if (typeof bossPoolSync === 'function') bossPoolSync();
      if (bossPhase === 1 && roundSeconds <= Math.floor(bossWindowDuration / 2)) {
        bossPhase = 2;
        updateBossObjectiveUI();
        showMessage(currentBoss?.modifiers?.includes('trick_pool_split')
          ? 'SECOND HALF - different Tricks off' : 'PHASE 2', 'var(--red)');
      }
    }
    // Dread before a boss that arrives with no screen in front of it (Flow).
    // Self-gating: a no-op in every mode whose boss is announced by the reward
    // grid / payout / pick that precedes it.
    if (typeof tickBossApproach === 'function') tickBossApproach();
    // A mode with no round clock lets the countdown RUN - every entity that reads
    // "how far into the round are we" (The Swift, Sediment, the Cuckoo, the
    // Woodpecker, First Wind, the clock marks) measures it as
    // roundStartSeconds - roundSeconds, so freezing the tick would silently kill
    // all of them, which is what Zen does. Only the end-of-round is suppressed.
    // A BOSS window always ends the round: that clock is the boss.
    if (roundSeconds <= 0 && roundClockEndsRound()) onRoundEnd();
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
  // One clock either way (r205) - startBossTimer arms the boss's scheduled effects
  // and then calls startRoundTimer itself.
  if (bossActive) startBossTimer();
  else startRoundTimer();

  // Game timer
  gameInterval = setInterval(() => {
    if (gameTimerPaused) return;
    gameSeconds--;
    // Match-3 and Dominoes run their own round-goal loops, so they must NOT take
    // the legacy timer-based progression below (which would pop shops/bosses off
    // the 20-minute game clock and hard-end the run at 0).
    if (!isActMode() && !match3Active() && !dominoActive() && !survivalActive()) {
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

// DEAD as of r151 - kept only so nothing referencing them throws. These were a
// SECOND, flat interact charge that ran alongside the BAL._resources one, so a
// 1-card discard cost 3+3=6s and the 3rd swap of a round cost 4+10=14s while the
// UI quoted 3s and 4s. Interact costs now come from BAL._resources ALONE
// (discard 3s per card, swap 8s flat, play free). Do not charge these again.
const DISCARD_TIME_COST = 3;
const SWAP_TIME_COST    = 4;
// ── The two clock chokepoints (r234) ────────────────────────────────────────
// "Does the round end when the clock reaches zero?" A boss window always does -
// that clock IS the boss. Otherwise a mode may say no (Flow's session clock, or a
// picker-built run that answered "no limit").
function roundClockEndsRound() {
  if (bossActive) return true;
  if (typeof modeHasNoRoundClock === 'function' && modeHasNoRoundClock()) return false;
  return true;
}

// "Do swaps and discards bill the clock?" ONE answer, read by the two sites that
// actually charge (js/input.js, js/discard.js) and by the Time pop-up that quotes
// them, so the quote can never drift from the charge the way it did before r151.
//
// This is also the fix for a live bug: Flow is documented and displayed as
// charging 0s, and spendRoundTime returns early for it - but spendRoundTime is
// not what charges. Both real sites write roundSeconds directly and neither
// consulted flowActive(), so Flow's session clock was being billed for every
// swap and discard, which is precisely what its own comment says must not happen
// (interacting could summon the inspection early).
function interactTimeCostsOn() {
  if (typeof flowActive === 'function' && flowActive()) return false;
  if (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.timeIsCurrency === false) return false;
  return true;
}

function spendRoundTime(sec) {
  // Flow: timeIsCurrency is false. Its clock is the countdown to the boss, so
  // charging swaps/discards against it would make interacting summon the inspection
  // early. Swaps and discards are still capped by their per-round COUNTS.
  if (typeof flowActive === 'function' && flowActive()) return;
  if (roundEnded || !sec || sec <= 0) return;
  roundSeconds -= sec;
  if (roundSeconds < 0) roundSeconds = 0;
  updateClockUI();   // next timer tick ends the round if this hit 0
}

function updateClockUI() {
  const secs = Math.max(roundSeconds, 0);
  const m = Math.floor(secs/60);
  const s = secs%60;
  const clockEl = document.getElementById('clock');
  const barEl = document.getElementById('clock-bar');
  clockEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  const _dur = currentRoundDuration();
  barEl.style.width = (secs/_dur*100)+'%';
  const vf = document.getElementById('vclock-fill'); if (vf) vf.style.width = (secs/_dur*100)+'%';
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
  roundInterval = null;
  gameInterval = null;
  stopFocusDecay();
  stopHeartbeat();
  cdStopTicker();                   // and strip every cooldown badge (js/cooldown.js)
  // The board is about to be taken away or replaced; never leave it holding a
  // freeze tilt or a mirror stack behind an overlay (js/clock-fx.js).
  if (typeof resetClockFx === 'function') resetClockFx();
}

// ══════════════════════════════════════════════
// ROUND END
// ══════════════════════════════════════════════
function onRoundEnd() {
  // Since r205 the boss runs on this same clock, so reaching zero during a boss is
  // the boss window expiring - the boss's own loss path, not a missed round goal.
  if (bossActive) { endBoss(false); return; }
  // Flow: the clock is a 5-minute SESSION clock, not a round clock. Reaching zero
  // summons the boss on the board as it stands - there is no round to fail here, and
  // no goal to have missed. (During the boss itself the boss timer owns the clock, so
  // this can only be the session clock.)
  if (typeof flowActive === 'function' && flowActive() && !bossActive) {
    if (roundInterval) { clearInterval(roundInterval); roundInterval = null; }
    flowTriggerBoss();
    return;
  }
  if (challengeActive) {
    // Timer expired with challenge incomplete
    if (hasTrick('resilience') && !resilienceUsed) {
      resilienceUsed = true;
      roundSeconds = Math.max(10, ROUND_DURATION - roundPenaltySeconds);
      updateClockUI();
      showMessage('SECOND CHANCE - FINISH THE CHALLENGE!', '#c9a84c');
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
    showMessage('🪢 Safety Net - 30s extension!', 'var(--gold)');
    startRoundTimer();
    return;
  }
  onGameEnd(true);
}

// ══════════════════════════════════════════════
// TOASTS (r197)
// ══════════════════════════════════════════════
// 275 call sites shared ONE element and one 0.9s animation, in a serif the game
// uses nowhere else, with no plate behind it - so two messages in the same second
// clobbered each other, and a single one was gone before it could be read against
// a board of playing cards. Now each message is its own element in a stack, with
// the house type, a solid plate and a readable dwell.
//
// Everything still enters through showMessage(text, color), so no call site
// changed. `opts` is for the new callers that want an icon or a longer hold.
const TOAST_MAX = 4;             // more than this on screen at once is noise
const TOAST_MS  = 2200;          // long enough to read a short line, twice
let _toastLayer = null;

function toastLayer() {
  if (_toastLayer && _toastLayer.isConnected) return _toastLayer;
  _toastLayer = document.getElementById('toast-layer');
  if (!_toastLayer) {
    _toastLayer = document.createElement('div');
    _toastLayer.id = 'toast-layer';
    // OUTSIDE #cabinet, like every other fixed-position layer in this game: the
    // cabinet applies CSS `zoom`, which would scale a fixed element's coordinates.
    document.body.appendChild(_toastLayer);
  }
  return _toastLayer;
}

function showMessage(text, color, opts) {
  if (!text) return;
  const o = opts || {};
  const layer = toastLayer();
  // Repeat suppression: the same line fired twice in a row bumps a counter on the
  // toast already up rather than stacking a duplicate under it.
  const last = layer.lastElementChild;
  if (last && last.dataset.msg === String(text) && !last.classList.contains('toast-out')) {
    const n = (parseInt(last.dataset.n || '1', 10) || 1) + 1;
    last.dataset.n = n;
    const badge = last.querySelector('.toast-x');
    if (badge) { badge.textContent = 'x' + n; badge.hidden = false; }
    else { const b = document.createElement('span'); b.className = 'toast-x'; b.textContent = 'x' + n; last.appendChild(b); }
    last.classList.remove('toast-bump'); void last.offsetWidth; last.classList.add('toast-bump');
    clearTimeout(last._toastTimer);
    last._toastTimer = setTimeout(() => dismissToast(last), o.ms || TOAST_MS);
    return last;
  }

  const el = document.createElement('div');
  el.className = 'toast' + (o.kind ? ' toast-' + o.kind : '');
  el.dataset.msg = String(text);
  if (color) el.style.setProperty('--toast-ink', color);
  if (o.icon) { const i = document.createElement('span'); i.className = 'toast-ico'; i.textContent = o.icon; el.appendChild(i); }
  const label = document.createElement('span');
  label.className = 'toast-text'; label.textContent = text;
  el.appendChild(label);
  const badge = document.createElement('span'); badge.className = 'toast-x'; badge.hidden = true; el.appendChild(badge);
  layer.appendChild(el);

  // Trim the overflow. This counts children to decide when to stop, so the
  // dismissal it calls HAS to remove the node synchronously - see dismissToast.
  // The extra guard is belt and braces: if a child ever refuses to leave, stop
  // rather than spin. A `while` over a count nothing decrements is a hard hang,
  // and this one froze the whole page the moment a 5th toast arrived.
  while (layer.children.length > TOAST_MAX) {
    const victim = layer.firstElementChild;
    dismissToast(victim, true);
    if (layer.firstElementChild === victim) { victim.remove(); break; }
  }
  el._toastTimer = setTimeout(() => dismissToast(el), o.ms || TOAST_MS);
  return el;
}

// `now` means GONE NOW, not "fade faster". The overflow trim in showMessage
// counts layer.children to decide when to stop, so a dismissal that only
// scheduled the removal left the count unchanged and the loop spinning - and a
// toast already wearing .toast-out returned at the top without removing anything,
// which made the spin permanent. Both are handled here rather than at the call
// site so any future caller of dismissToast(el, true) gets the same guarantee.
function dismissToast(el, now) {
  if (!el) return;
  if (el.classList.contains('toast-out')) {
    if (now && el.parentNode) el.remove();
    return;
  }
  clearTimeout(el._toastTimer);
  el.classList.add('toast-out');
  if (now) { if (el.parentNode) el.remove(); return; }
  setTimeout(() => { if (el.parentNode) el.remove(); }, 260);
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
