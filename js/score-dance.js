async function goalCelebration(handCells) {
  console.log('[SALUTE] goalCelebration called with', handCells);
  const gridEl = document.getElementById('grid');
  if (!gridEl) { console.log('[SALUTE] no grid'); return; }

  const handEls = handCells.map(([r,c]) => {
    const card = gridData[r][c];
    if (!card) { console.log('[SALUTE] no card at', r, c); return null; }
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (!el) console.log('[SALUTE] no DOM el for card', card._id);
    return el;
  }).filter(Boolean);

  console.log('[SALUTE] found handEls:', handEls.length);

  // Strip score-pop classes — they have animation: ... !important which would block our transform
  handEls.forEach(el => {
    el.classList.remove('score-pop-h','score-pop-d','score-pop-c','score-pop-s');
    el.style.animation = 'none';
  });

  // Lift each card in sequence (gold glow)
  for (let i = 0; i < handEls.length; i++) {
    const el = handEls[i];
    el.style.transition = 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.45s';
    el.style.transform = 'translateY(-22px) rotate(-5deg) scale(1.08)';
    el.style.boxShadow = '0 0 28px 8px rgba(245,192,66,0.7), 0 12px 18px rgba(0,0,0,0.5)';
    el.style.zIndex = '15';
    await new Promise(r => setTimeout(r, 140));
  }

  // Confetti burst — SUCCESS text + particles from each lifted card
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:600;display:flex;align-items:center;justify-content:center;';
  const word = document.createElement('div');
  word.style.cssText = `
    font-family:'Cinzel',serif;font-size:48px;font-weight:700;
    color:#f5c042;letter-spacing:6px;
    text-shadow:0 0 28px rgba(245,192,66,0.7),0 4px 12px rgba(0,0,0,0.5);
    transform:scale(0.4);opacity:0;
    transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;
  `;
  word.textContent = 'SUCCESS';
  overlay.appendChild(word);
  document.body.appendChild(overlay);

  await new Promise(r => setTimeout(r, 20));
  word.style.transform = 'scale(1)';
  word.style.opacity = '1';

  const COLORS = ['#f5c042','#a0030b','#2255cc','#EC9F05','#f4ead5','#c9a84c'];
  handEls.forEach((cardEl, idx) => {
    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 18; i++) {
      const c = document.createElement('div');
      c.style.cssText = `position:absolute;width:7px;height:10px;border-radius:1px;background:${COLORS[(idx+i) % COLORS.length]};left:${cx}px;top:${cy}px;will-change:transform,opacity;`;
      overlay.appendChild(c);
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 180;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const rot = (Math.random() * 720 - 360);
      c.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 80}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(0.2,0.4,0.4,1)', fill: 'forwards' });
    }
  });

  await new Promise(r => setTimeout(r, 500));

  // Drop cards back down in same order
  for (let i = 0; i < handEls.length; i++) {
    const el = handEls[i];
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.zIndex = '';
    await new Promise(r => setTimeout(r, 80));
  }

  // Fade out SUCCESS
  await new Promise(r => setTimeout(r, 300));
  word.style.opacity = '0';
  await new Promise(r => setTimeout(r, 500));
  overlay.remove();
}

// ── New preview-window scoring dance (dev toggle; owner-locked settings) ──
const DANCE_CFG = {
  actA:{cls:'dnc-pulse',dur:420,mag:1.0}, actB:{cls:'dnc-flash',dur:420,mag:0.4},
  trig:{cls:'dnc-pop',dur:260,mag:0.7}, jitInit:0.20, jitGrow:0.35,
  tickRest:600, pFlight:550, scoreClimb:1250, ff:15, pScale:2.6,
};
let newDanceEnabled = (function(){ try { return localStorage.getItem('newDance') !== '0'; } catch(e){ return true; } })();
function setNewDance(on){ newDanceEnabled = !!on; try { localStorage.setItem('newDance', on ? '1' : '0'); } catch(e){} }

// How a still-animating hand hands off when the next hand is submitted (dev-tunable, feel comparison):
//   'cut'     — the old dance vanishes instantly, new one starts (original behaviour)
//   'ff'      — briefly rush the old hand's score up to its final, then start the new one
//   'resolve' — snap the old hand's score to final with one quick pop, then start the new one
// All three cut the old dance's grid/logic immediately (grid-safe); they differ only in the brief visual handoff.
let danceInterruptMode = (function(){ try { return localStorage.getItem('danceInterrupt') || 'cut'; } catch(e){ return 'cut'; } })();
function setDanceInterruptMode(m){ if(!['cut','ff','resolve'].includes(m)) m='cut'; danceInterruptMode=m; try { localStorage.setItem('danceInterrupt', m); } catch(e){} }
let _lastDanceStart = 0; // for the spam valve: rapid re-interrupts skip the flourish
function _scoreDisplayed(){ const el=document.getElementById('score-total-num'); if(!el) return 0; const n=parseInt((el.textContent||'0').replace(/[^0-9-]/g,''),10); return isNaN(n)?0:n; }
// Brief, grid-safe visual handoff acknowledging the just-cut previous hand. Resolves when done.
async function danceInterruptFlourish(mode, fromVal, toVal, sig){
  const scoreEl=document.getElementById('score-total-num');
  const scoreBox=document.getElementById('score-mid') || document.getElementById('score-center');
  if(!scoreEl) return;
  if(mode==='resolve'){
    scoreEl.textContent = toVal.toLocaleString();
    if(scoreBox){ scoreBox.classList.remove('box-popping'); void scoreBox.offsetWidth; scoreBox.classList.add('box-popping'); }
    if(typeof sfxScoreTick==='function') sfxScoreTick();
    await new Promise(res=>{ const t=setTimeout(res,200); sig&&sig.addEventListener('abort',()=>{clearTimeout(t);res();},{once:true}); });
  } else { // 'ff' — quick count-up to the outgoing hand's final
    const dur=360, start=performance.now();
    await new Promise(res=>{ function tk(now){ if(sig&&sig.aborted){ res(); return; }
      const t=Math.min((now-start)/dur,1), e=1-Math.pow(1-t,3);
      scoreEl.textContent = Math.round(fromVal+(toVal-fromVal)*e).toLocaleString();
      if(typeof sfxScoreTick==='function' && Math.random()<0.4) sfxScoreTick();
      if(t<1) requestAnimationFrame(tk); else res(); }
      requestAnimationFrame(tk); });
  }
}

async function playScoreDance(result, toRemove, isGoalHand = false) {
  if (newDanceEnabled) { return playPreviewDance(result, toRemove, isGoalHand); }
  cancelDance();
  const ctrl = new AbortController();
  danceAbortController = ctrl;
  resetParticleStep();
  const sig = ctrl.signal;

  const { hand, handCells, finalScore } = result;
  const targetPips  = lastCalcPips;
  const targetMult  = Math.round(lastCalcMult * 10) / 10;
  const preHandFocus = lastPreHandFocus;   // FOCUS multiplier when this hand STARTED scoring
  const targetFocus = lastCalcFocus;       // FOCUS multiplier AFTER this hand's Focus
  const _fmtFocus = f => '×' + (f % 1 === 0 ? f : f.toFixed(1));
  const scoreAfter  = score;
  const scoreBefore = score - finalScore;

  // ── 1. Card pop + suit glow, staggered via CSS animation-delay ──
  const gridEl = document.getElementById('grid');
  const STAGGER_MS = 180;
  const POP_MS    = 900;
  handCells.forEach(([r,c], i) => {
    const card = gridData[r][c];
    if (!card) return;
    const el = gridEl?.querySelector(`[data-card-id="${card._id}"]`);
    if (!el) return;
    const sc = card.suit === '♥' ? 'h' : card.suit === '♦' ? 'd' : card.suit === '♣' ? 'c' : 's';
    el.classList.remove('score-pop-h','score-pop-d','score-pop-c','score-pop-s');
    el.style.setProperty('animation-delay', (i * STAGGER_MS) + 'ms', 'important');
    void el.offsetWidth;
    el.classList.add(`score-pop-${sc}`);
    // SFX fires when this card's pop begins
    setTimeout(() => sfxCardPop(card.suit), i * STAGGER_MS);
  });

  // Wait for last card's pop to fully finish
  await wait(handCells.length * STAGGER_MS + POP_MS);

  // Pulse active Trick cards on the grid to celebrate their contribution
  const _trickGridEl = document.getElementById('grid');
  if (_trickGridEl) {
    _trickGridEl.querySelectorAll('.trick-card:not(.trick-dimmed)').forEach((trickEl, i) => {
      setTimeout(() => {
        trickEl.classList.remove('trick-scoring');
        void trickEl.offsetWidth;
        trickEl.classList.add('trick-scoring');
        setTimeout(() => trickEl.classList.remove('trick-scoring'), 560);
      }, i * 55);
    });
  }
  if (sig.aborted) { handleDanceAbort(isGoalHand); return; }

  // ── 2. Collect particles BEFORE removing cards (gridData gets nulled by removeAndFall) ──
  const gridEl2 = document.getElementById('grid');
  const particles = collectScoreParticles(handCells, gridEl2);

  const PIP_STAGGER  = 100;
  const MULT_STAGGER = 120;

  // ── Trick/trick contrib: call calcScore again with a contrib array for breakdown ──
  const savedPreFocusMult2 = lastPreFocusMult;
  const trickContrib = [];
  calcScore(hand, handCells, trickContrib);
  lastPreFocusMult = savedPreFocusMult2; // restore so focus beat uses correct value

  // Count card-only particles (before Trick particles are appended)
  const cardPipCount  = particles.pip.length;
  const cardMultCount = particles.mult.length;

  // Trick particles start after all card pip particles have been launched
  const TRICK_PIP_START  = cardPipCount * PIP_STAGGER + 100;
  const TRICK_MULT_START = TRICK_PIP_START + 150;
  const TRICK_STAGGER    = 90;
  let trickPipIdx = 0;
  let trickMultIdx = 0;

  // Find Trick DOM element on the grid
  const _findTrickEl = id => {
    if (trickTrayMode) {
      const chip = document.querySelector(`.trick-tray-chip[data-trick-id="${id}"]`);
      if (chip) return chip;
    }
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++) {
        const cell = gridData[r][c];
        if (cell?._isTrick && cell.trick?.id === id)
          return gridEl2.querySelector(`[data-card-id="${cell._id}"]`);
      }
    return null;
  };

  trickContrib.forEach(({ type, source, id, delta }) => {
    if (!delta || delta <= 0) return;
    let el = null;
    if (source === 'trick') el = _findTrickEl(id);
    // suit / exalt particles skip (played cards about to be removed)
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (type === 'pip') {
      particles.pip.push({
        sourceRect: rect, label: '+' + Math.round(delta), color: '#d4a857',
        sourceType: 'trick', _explicitDelay: TRICK_PIP_START + trickPipIdx++ * TRICK_STAGGER,
      });
    } else {
      particles.mult.push({
        sourceRect: rect, label: '+' + (Number.isInteger(delta) ? delta : delta.toFixed(1)),
        color: '#b07dea', sourceType: 'trick',
        _explicitDelay: TRICK_MULT_START + trickMultIdx++ * TRICK_STAGGER,
      });
    }
  });

  // Save card data and remove cards (skip for goal hands — salute will use cards in place)
  const savedCards = handCells.map(([r,c]) => ({ card: gridData[r][c], r, c }));
  if (!isGoalHand) {
    sfxFlipShuffle();
    removeAndFall(toRemove, 'play');
  }

  // ── 3. Pip particles fly + ticking ──
  const pipsValEl = document.getElementById('pips-val');
  const multValEl = document.getElementById('mult-val');
  const focusValEl = document.getElementById('focus-val');
  const scoreEl   = document.getElementById('score-total-num');

  const base       = HAND_BASE[hand] || { pips: 0, mult: 1 };
  const levelScale = Math.pow(1.1, level - 1);
  const basePips   = Math.round(base.pips * levelScale);
  const baseMult   = base.mult;

  // ── Measure box rects upfront ──
  const pipsBoxEl    = document.getElementById('pips-box');
  const multBoxEl    = document.getElementById('mult-box');
  const pipsBoxRect  = pipsBoxEl?.getBoundingClientRect();
  const multBoxRect  = multBoxEl?.getBoundingClientRect();

  // ── Set initial pips/mult to base, fire pip particles ──
  pipsValEl.textContent = basePips;
  multValEl.textContent = (baseMult % 1 === 0) ? baseMult : baseMult.toFixed(1);
  let runningPips = basePips;
  let runningMult = baseMult;

  particles.pip.forEach((p, i) => {
    const delay = p._explicitDelay !== undefined ? p._explicitDelay : i * PIP_STAGGER;
    flyParticle({
      sourceRect: p.sourceRect, targetRect: pipsBoxRect,
      label: p.label, color: p.color, delay, duration: 620,
      onLand: () => {
        const v = parseFloat(p.label.replace(/[+×]/g, '')) || 0;
        runningPips += v;
        pipsValEl.textContent = Math.round(runningPips);
        pipsValEl.style.animation = 'none'; void pipsValEl.offsetWidth;
        pipsValEl.style.animation = 'val-tick 0.18s ease';
        sfxParticleStep('pip');
      },
    });
  });

  // ── 4. Fire mult particles slightly after card pips start ──
  const multStartDelay = Math.min(cardPipCount * PIP_STAGGER * 0.5, 400);
  particles.mult.forEach((m, i) => {
    const delay = m._explicitDelay !== undefined ? m._explicitDelay : (multStartDelay + i * MULT_STAGGER);
    flyParticle({
      sourceRect: m.sourceRect, targetRect: multBoxRect,
      label: m.label, color: m.color, delay, duration: 560,
      onLand: () => {
        const v = parseFloat(m.label.replace(/[+×]/g, '')) || 0;
        runningMult += v;
        multValEl.textContent = (runningMult % 1 === 0) ? runningMult : runningMult.toFixed(1);
        multValEl.style.animation = 'none'; void multValEl.offsetWidth;
        multValEl.style.animation = 'val-tick 0.18s ease';
        sfxParticleStep('mult');
      },
    });
  });

  // ── 5. Score ticker — uses the latest particle land time (card + Trick particles) ──
  const _lastPipDelay  = particles.pip.reduce( (mx, p, i) => Math.max(mx, p._explicitDelay !== undefined ? p._explicitDelay : i * PIP_STAGGER), 0);
  const _lastMultDelay = particles.mult.reduce((mx, m, i) => Math.max(mx, m._explicitDelay !== undefined ? m._explicitDelay : (multStartDelay + i * MULT_STAGGER)), 0);
  const pipParticleEnd  = _lastPipDelay  + 620;
  const multParticleEnd = _lastMultDelay + 480;
  const lastLand        = Math.max(pipParticleEnd, multParticleEnd);

  // Focus beat: if focus multiplier is active, hold the score ticker until after
  // the mult particles finish and the focus beat plays (purple pulse on meter +
  // mult box, mult ticks rapidly from pre-focus to post-focus value).
  const focusActive   = targetFocus > 1 || targetFocus !== preHandFocus;
  const focusBeatMs   = focusActive ? focusBeatDurationMs : 0;
  const tickerStartDelay = focusActive ? multParticleEnd + 80 : 0;
  const scoreDur      = lastLand + 350; // ticker duration once it starts
  scoreEl.textContent = scoreBefore.toLocaleString();

  // If this is a goal-crossing hand, watch the score and flash when crossed
  let goalFlashFired = false;
  const goalCrossedAt = isGoalHand ? roundGoal : Infinity;

  // Focus beat — fires after mult particles finish. MULT stays pure; the FOCUS box shows the
  // hand's starting multiplier, then pops up to the post-Focus multiplier, then the score climbs by it.
  if (focusValEl) focusValEl.textContent = _fmtFocus(preHandFocus);
  if (focusActive) {
    setTimeout(() => {
      if (sig.aborted) return;
      // Trigger meter + focus box pulses
      const meterEl = document.getElementById('focus-meter-wrap');
      if (meterEl) {
        meterEl.classList.remove('beat');
        void meterEl.offsetWidth;
        meterEl.classList.add('beat');
      }
      const focusBoxEl = document.getElementById('focus-box');
      if (focusBoxEl) {
        focusBoxEl.classList.remove('focus-beat');
        void focusBoxEl.offsetWidth;
        focusBoxEl.classList.add('focus-beat');
      }
      // Pulse the readout
      updateFocusMultReadout(true);
      // Sound
      sfxFocusBeat();

      // Snap the FOCUS box to the applied (post-hand) multiplier
      if (focusValEl) focusValEl.textContent = _fmtFocus(targetFocus);
    }, multParticleEnd);
  }

  // Start the score ticker (delayed if focus is active)
  setTimeout(() => {
    if (sig.aborted) return;
    const tickerStart = performance.now();
    function watchScore() {
      const t = Math.min((performance.now() - tickerStart) / scoreDur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = scoreBefore + (scoreAfter - scoreBefore) * eased;
      if (!goalFlashFired && cur >= goalCrossedAt) {
        goalFlashFired = true;
        flashRoundEnd();
      }
      if (t < 1) requestAnimationFrame(watchScore);
    }
    if (isGoalHand) requestAnimationFrame(watchScore);

    tickValue(scoreEl, scoreBefore, scoreAfter, scoreDur);
    // Parallel tick SFX — fire roughly every 80ms while score climbs, capped
    (function scoreTicks() {
      const interval = 80;
      const maxTicks = Math.min(Math.ceil(scoreDur / interval), 22);
      for (let k = 0; k < maxTicks; k++) {
        setTimeout(() => {
          if (sig.aborted) return;
          sfxScoreTick();
        }, k * interval);
      }
    })();
  }, tickerStartDelay);

  // Wait for everything to land (focus beat + ticker)
  await wait(tickerStartDelay + focusBeatMs + scoreDur + 100);
  if (sig.aborted) { handleDanceAbort(isGoalHand); return; }

  // Force final values
  pipsValEl.textContent = targetPips;
  multValEl.textContent = (targetMult % 1 === 0) ? targetMult : targetMult.toFixed(1);
  scoreEl.textContent = scoreAfter.toLocaleString();

  // Pop score + update it
  showComboFloats(hand, handCells, result);
  const scoreBox = document.getElementById('score-mid');
  if (scoreBox) {
    scoreBox.classList.remove('box-popping');
    void scoreBox.offsetWidth;
    scoreBox.classList.add('box-popping');
  }
  if (scoreEl) {
    scoreEl.style.transition = 'color 0.15s ease';
    scoreEl.style.color = 'var(--gold)';
    scoreEl.textContent = scoreAfter.toLocaleString();
    setTimeout(() => { if (scoreEl) scoreEl.style.color = ''; }, 350);
  }
  sfxVictory && false;

  await wait(500);
  if (sig.aborted) { handleDanceAbort(isGoalHand); return; }

  // ── 6. Settle ──
  danceAbortController = null;
  // Stopwatch: the pause lasts through scoring (so while-paused bonuses fire), then releases now.
  if (stopwatchActive) endStopwatch();
  if (pipsValEl) pipsValEl.textContent = '0';
  if (multValEl) multValEl.textContent = '0';

  if (isGoalHand) {
    if (score > highestHandScore) highestHandScore = score;
    if (pendingLevelUps > 0) sfxMultiGoal(pendingLevelUps);
  }

  // Always sync display to actual score after dance — covers heldBack additions, bonus side-effects, etc.
  updateScoreUI();

  if (isGoalHand) {
    if (challengeActive) {
      showMessage('GOAL MET — COMPLETE THE CHALLENGE', '#c9a84c');
    } else {
      clearInterval(roundInterval);
      roundInterval = null;
      gameTimerPaused = true;
      frozenRoundSeconds = roundSeconds;
      sfxVictory();
      const ctx = getAudioCtx();
      if (sfxDuckGain) {
        sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
      } else {
        sfxDuckGain = ctx.createGain();
        sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
        sfxDuckGain.connect(ctx.destination);
      }
      // Salute + confetti on the played cards, then start the interlude
      console.log('[SALUTE] about to call goalCelebration', { handCells, handCellsLen: handCells?.length });
      await goalCelebration(handCells);
      console.log('[SALUTE] goalCelebration finished, starting interlude');
      startInterlude();
    }
  }
}

function handleDanceAbort(isGoalHand) {
  danceAbortController = null;
  if (stopwatchActive) endStopwatch(); // release the Stopwatch freeze if the dance was cut short
  updateScoreUI();
  const pipsValEl = document.getElementById('pips-val');
  const multValEl = document.getElementById('mult-val');
  if (pipsValEl) pipsValEl.textContent = '0';
  if (multValEl) multValEl.textContent = '0';
  const focusValEl = document.getElementById('focus-val');
  if (focusValEl) { const fm = focusMultiplier(); focusValEl.textContent = (fm === 1) ? '×1' : '×' + fm.toFixed(1); }
  if (isGoalHand) {
    score += heldBackScore;
    heldBackScore = 0;
    suppressScoreDisplay = false;
    if (pendingLevelUps > 0) sfxMultiGoal(pendingLevelUps);
    if (!challengeActive) {
      clearInterval(roundInterval);
      roundInterval = null;
      gameTimerPaused = true;
      frozenRoundSeconds = roundSeconds;
      sfxVictory();
      const ctx = getAudioCtx();
      sfxDuckGain = sfxDuckGain || ctx.createGain();
      sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
      if (!sfxDuckGain.connected) { sfxDuckGain.connect(ctx.destination); sfxDuckGain.connected = true; }
      setTimeout(() => startInterlude(), 400);
    }
  }
}

// ══════════════════════════════════════════════
// PREVIEW-WINDOW SCORING DANCE (opt-in via dev toggle)
// Grid cards keep their normal pop-then-discard; the slow, detailed Balatro
// escalation runs in the dedicated hand-preview slot (#selected-cards). Cards score (Activation), per-hand tricks
// charge (Jitter) as cards trigger them (Trigger) then RELEASE (Activation).
// Reuses the same goal / settle / abort tail as playScoreDance.
// ══════════════════════════════════════════════
let dncFF = false;
function dncApply(el, m){ if(!el) return; el.classList.remove('dnc-pulse','dnc-flash','dnc-pop');
  el.style.setProperty('--dnc-mag', m.mag); el.style.setProperty('--dnc-dur', m.dur+'ms');
  void el.offsetWidth; el.classList.add(m.cls); }
function dncActivate(el){ dncApply(el.parentElement, DANCE_CFG.actA); dncApply(el, DANCE_CFG.actB); }
function dncTrigger(chip, n){ dncApply(chip.parentElement, DANCE_CFG.trig);
  const j = DANCE_CFG.jitInit + DANCE_CFG.jitGrow * Math.pow(Math.max(0, n-1), 1.8);
  chip.style.setProperty('--dnc-jit', j.toFixed(2));
  if(!chip.classList.contains('dnc-jitter')) chip.classList.add('dnc-jitter'); }
function dncStopJitter(chip){ chip.classList.remove('dnc-jitter'); chip.style.removeProperty('--dnc-jit');
  if(chip.parentElement) chip.parentElement.classList.remove('dnc-pulse','dnc-flash','dnc-pop'); }
function dncTick(el){ if(!el) return; el.style.animation='none'; void el.offsetWidth; el.style.animation='val-tick 0.18s ease'; }
function dncFly(srcEl, boxEl, label, color, onLand){
  const a=srcEl.getBoundingClientRect(), b=boxEl.getBoundingClientRect();
  const el=document.createElement('div'); el.className='dnc-particle'; el.textContent=label; el.style.color=color;
  el.style.left=(a.left+a.width/2)+'px'; el.style.top=(a.top+a.height/2)+'px';
  el.style.setProperty('--dnc-pscale', DANCE_CFG.pScale);
  document.body.appendChild(el);
  const dx=(b.left+b.width/2)-(a.left+a.width/2), dy=(b.top+b.height/2)-(a.top+a.height/2);
  const dur = dncFF ? Math.max(60, DANCE_CFG.pFlight/DANCE_CFG.ff) : DANCE_CFG.pFlight;
  el.animate([{transform:'translate(-50%,-50%) scale(.6)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.2},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.9)`,opacity:0}],
    {duration:dur,easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'});
  setTimeout(()=>el.remove(), dur+60);
  return new Promise(res=>setTimeout(()=>{ if(onLand) onLand(); res(); }, dur));
}
function dncFinishAbort(stage, isGoalHand, myGen){
  // If a newer dance has taken over (myGen behind the global), this dance was superseded:
  // do NOT touch the shared stage/score UI — the successor owns it now.
  if(myGen!==undefined && myGen!==dncGen) return;
  if(stage){ stage.classList.remove('dnc-active'); stage.innerHTML=''; } dncCleanupReal(); dncRestoreHiddenGridEls(); handleDanceAbort(isGoalHand); }
// Display name for a contribution entity, by source (Trick / Sleight / Knack / Exalt).
function contribLabel(source, id){
  if(source==='exalt') return 'Exalt';
  const pool = source==='sleight' ? (typeof SLEIGHT_POOL!=='undefined' && SLEIGHT_POOL)
             : source==='knack'   ? (typeof KNACK_POOL!=='undefined'   && KNACK_POOL)
             :                       (typeof TRICK_POOL!=='undefined'   && TRICK_POOL);
  const def = pool && pool.find(x=>x.id===id);
  return (def && def.name) || id;
}

// ── Charge/release on the REAL on-screen entity element (tray chip / grid card / knack) ──
let dncRealEls = [];
// Grid cards hidden while their fly-to-preview clone is airborne; restored if the dance aborts pre-removal.
let dncHiddenGridEls = [];
function dncRestoreHiddenGridEls(){ dncHiddenGridEls.forEach(el=>{ if(el && el.isConnected) el.style.opacity=''; }); dncHiddenGridEls=[]; }
function dncGlow(el, strong){ if(!el) return;
  el.animate([{boxShadow:'0 0 0 0 rgba(245,192,66,0)'},
    {boxShadow:`0 0 ${strong?14:8}px ${strong?4:2}px rgba(245,192,66,${strong?0.7:0.5})`, offset:.4},
    {boxShadow:'0 0 0 0 rgba(245,192,66,0)'}], {duration: strong?360:200, easing:'ease-in-out'}); }
function danceEntityEl(source, id){
  if(source==='trick'){
    const chip=document.querySelector(`.trick-tray-chip[data-trick-id="${CSS.escape(id)}"]`);
    if(chip) return chip;
    for(let r=0;r<gridRows;r++)for(let c=0;c<gridCols;c++){ const cell=gridData[r]?.[c];
      if(cell?._isTrick && cell.trick?.id===id) return document.querySelector(`#grid [data-card-id="${cell._id}"]`); }
  } else if(source==='knack'){
    const k=document.querySelector(`.knack-chip[data-knack-id="${CSS.escape(id)}"]`); if(k) return k;
  } else if(source==='sleight'){
    for(let r=0;r<gridRows;r++)for(let c=0;c<gridCols;c++){ const cell=gridData[r]?.[c];
      if(cell?._isSleight && cell.sleightId===id) return document.querySelector(`#grid [data-card-id="${cell._id}"]`); }
  }
  return null;
}
// Charge = intensifying jitter (transform) + a light glow (box-shadow, WAAPI → composes).
function dncChargeReal(el, n){ if(!el) return;
  const j = DANCE_CFG.jitInit + DANCE_CFG.jitGrow * Math.pow(Math.max(0,n-1),1.8);
  el.style.setProperty('--dnc-jit', j.toFixed(2));
  if(!el.classList.contains('dnc-jitter')) el.classList.add('dnc-jitter');
  dncGlow(el, false); }
// Release = stop jitter, springy pop + strong glow.
function dncReleaseReal(el){ if(!el) return;
  el.classList.remove('dnc-jitter'); el.style.removeProperty('--dnc-jit');
  el.classList.remove('dnc-pop'); void el.offsetWidth;
  el.style.setProperty('--dnc-mag', DANCE_CFG.trig.mag); el.style.setProperty('--dnc-dur', DANCE_CFG.trig.dur+'ms');
  el.classList.add('dnc-pop'); dncGlow(el, true);
  setTimeout(()=>{ if(el) el.classList.remove('dnc-pop'); }, DANCE_CFG.trig.dur+80); }
function dncCleanupReal(){ dncRealEls.forEach(el=>{ if(!el) return;
  el.classList.remove('dnc-jitter','dnc-pop','dnc-pulse','dnc-flash'); el.style.removeProperty('--dnc-jit'); }); dncRealEls=[]; }
// Fly a clone of a selected grid card into its preview slot, then reveal the slot's dnc-card.
function flyGridCardToSlot(gEl, slotEl, dur){
  if(!slotEl) return;
  const reveal=()=>{ slotEl.style.opacity=''; slotEl.animate([{transform:'scale(.82)'},{transform:'scale(1)'}],{duration:150,easing:'ease-out'}); };
  const s = gEl && gEl.getBoundingClientRect();
  const t = slotEl.getBoundingClientRect();
  if(!s || !s.width || !t.width){ reveal(); return; }
  const clone = gEl.cloneNode(true);
  clone.classList.remove('selected','hand-valid','hand-ready','swap-pending','unreachable');
  clone.style.cssText = `position:fixed;margin:0;z-index:250;pointer-events:none;transition:none;left:${s.left}px;top:${s.top}px;width:${s.width}px;height:${s.height}px;transform-origin:center center;`;
  document.body.appendChild(clone);
  gEl.style.opacity='0'; dncHiddenGridEls.push(gEl); // hide the original while its clone flies (restored on abort)
  const dx=(t.left+t.width/2)-(s.left+s.width/2), dy=(t.top+t.height/2)-(s.top+s.height/2);
  const sc=t.width/s.width;
  const done=()=>{ if(clone.parentNode) clone.remove(); reveal(); };
  const anim=clone.animate([
    {transform:'translate(0,0) scale(1)', opacity:1},
    {transform:`translate(${dx}px,${dy}px) scale(${sc})`, opacity:0.9}],
    {duration:dur, easing:'cubic-bezier(.35,.65,.3,1)', fill:'forwards'});
  anim.onfinish=done; setTimeout(done, dur+140);
}

async function playPreviewDance(result, toRemove, isGoalHand = false){
  const outgoing = !!danceAbortController;          // a prior hand is still dancing
  const outMode = danceInterruptMode;
  const preDisplay = _scoreDisplayed();             // score number shown right now (mid-climb)
  const nowTs = performance.now(); const rapid = (nowTs - _lastDanceStart) < 260; _lastDanceStart = nowTs;
  cancelDance();
  const ctrl = new AbortController(); danceAbortController = ctrl; const sig = ctrl.signal;
  const myGen = ++dncGen; // this dance's generation; if it's superseded, its abort handler stays silent
  dncFF = false; resetParticleStep();
  const aborted = () => sig.aborted;
  const dwait = ms => new Promise(r => setTimeout(r, dncFF ? Math.max(6, ms/DANCE_CFG.ff) : ms));
  // ── Interrupt handoff: briefly acknowledge the just-cut previous hand (visual only, grid untouched). ──
  // Spam valve: two interrupts in quick succession skip straight to 'cut' so rapid chaining stays snappy.
  if(outgoing && !isGoalHand && !rapid && (outMode==='ff' || outMode==='resolve')){
    const endpoint = Math.max(0, score - (result.finalScore||0)); // the outgoing hand's final total
    await danceInterruptFlourish(outMode, preDisplay, endpoint, sig);
    if(aborted()){ dncFinishAbort(null, isGoalHand, myGen); return; }
  }

  const { hand, handCells, finalScore } = result;
  const preHandFocus = lastPreHandFocus;   // FOCUS multiplier when this hand STARTED scoring
  const targetFocus = lastCalcFocus;       // FOCUS multiplier AFTER this hand's Focus (what actually scored it)
  const _fmtFocus = f => '×' + (f % 1 === 0 ? f : f.toFixed(1));
  // Seed the FOCUS box to the hand's starting multiplier immediately (before the fly-in), so the
  // box reads the pre-hand value throughout the card phase and only beats up to targetFocus later.
  { const _fEl = document.getElementById('focus-val'); if(_fEl) _fEl.textContent = _fmtFocus(preHandFocus); }
  const scoreAfter = score, scoreBefore = score - finalScore;
  const levelScale = Math.pow(1.1, level - 1);
  const base = HAND_BASE[hand] || { pips:0, mult:1 };
  const basePips = Math.round(base.pips * levelScale), baseMult = base.mult;
  // Capture per-card pips BEFORE removeAndFall nulls gridData.
  const cardPipVals = handCells.map(([r,c]) => cardPips(gridData[r][c].rank));

  // ── Grid feedback: goal hands pop in place (they salute later); normal hands FLY into the preview (below). ──
  const gridEl = document.getElementById('grid'); const STAGGER=180, POP=900;
  if(isGoalHand){
    handCells.forEach(([r,c],i)=>{ const card=gridData[r][c]; if(!card) return;
      const el=gridEl?.querySelector(`[data-card-id="${card._id}"]`); if(!el) return;
      const sc = card.suit==='♥'?'h':card.suit==='♦'?'d':card.suit==='♣'?'c':'s';
      el.classList.remove('score-pop-h','score-pop-d','score-pop-c','score-pop-s');
      el.style.setProperty('animation-delay',(i*STAGGER)+'ms','important'); void el.offsetWidth;
      el.classList.add('score-pop-'+sc); setTimeout(()=>sfxCardPop(card.suit), i*STAGGER); });
  }

  // ── Contribution ledger (Tricks + exalt), aggregated per source ──
  const savedPFM = lastPreFocusMult; const contrib=[]; calcScore(hand, handCells, contrib); lastPreFocusMult = savedPFM;
  const trickMap = new Map();
  contrib.forEach(e=>{ if(!(e.delta>0)) return; const key=e.source+':'+e.id;
    let t=trickMap.get(key); if(!t){ t={source:e.source,id:e.id,pip:0,mult:0}; trickMap.set(key,t); }
    if(e.type==='pip') t.pip+=e.delta; else t.mult+=e.delta; });
  const tricks=[...trickMap.values()];

  // ── Stage: render ONLY the played cards into the dedicated hand-preview slot. ──
  // Tricks/Knacks animate on their REAL tray/rack elements (not copies), so the slot
  // keeps its normal size and never covers the UI below it, and the physical trick
  // rack is what actually rattles/releases.
  const stage=document.getElementById('selected-cards'); stage.classList.add('dnc-active'); stage.innerHTML='';
  const mkRow=(label,extra)=>{ const row=document.createElement('div'); row.className='dnc-row'+(extra?(' '+extra):'');
    const l=document.createElement('div'); l.className='dnc-lab'; l.textContent=label;
    const items=document.createElement('div'); items.className='dnc-items';
    row.appendChild(l); row.appendChild(items); stage.appendChild(row); return items; };
  const handItems=mkRow('Hand','hand');
  const handTrack=document.createElement('div'); handTrack.className='dnc-track'; handItems.appendChild(handTrack);
  // Reuse the SAME grid-accurate markup the hand preview uses (renderCardAppearance), so cards
  // don't visually change when the dance starts (and the fly-in clone lands as an identical card).
  // Wrapped in .dnc-outer for the two-layer activation animation; sized by #selected-cards'
  // --card-w/--card-h; appended into the .dnc-track so large hands can scroll sideways as they score.
  const cardEls=handCells.map(([r,c])=>{ const card=gridData[r][c];
    const outer=document.createElement('div'); outer.className='dnc-outer';
    const d=document.createElement('div');
    const { className, innerHTML } = renderCardAppearance(card, r, c);
    d.className=className+' preview-card'; d.innerHTML=innerHTML;
    outer.appendChild(d); handTrack.appendChild(outer); return d; });
  // Resolve the REAL on-screen element for each contributing entity (aligned with `tricks`;
  // may be null, e.g. exalt or Amplifier that has no rack element — those still tally, no jitter).
  const entityEls = tricks.map(t => danceEntityEl(t.source, t.id));
  dncRealEls = entityEls.filter(Boolean);

  if(isGoalHand){
    await wait(handCells.length*STAGGER + POP);
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
  } else {
    // ── Normal hand: the selected grid cards physically fly into their preview slots. ──
    const FLY_STAGGER=95, FLY_DUR=400;
    cardEls.forEach(d=>{ const o=d.parentElement; if(o) o.style.opacity='0'; });
    handCells.forEach(([r,c],i)=>{ const card=gridData[r][c]; if(!card) return;
      const gEl=gridEl?.querySelector(`[data-card-id="${card._id}"]`);
      const slot=cardEls[i].parentElement;
      setTimeout(()=>{ if(aborted()) return; flyGridCardToSlot(gEl, slot, FLY_DUR); if(typeof sfxCardPop==='function') sfxCardPop(card.suit); }, i*FLY_STAGGER);
    });
    await wait(handCells.length*FLY_STAGGER + FLY_DUR);
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    if(typeof sfxFlipShuffle==='function') sfxFlipShuffle(); removeAndFall(toRemove,'play'); dncHiddenGridEls=[]; // flown cards now removed
  }

  // ── Score boxes ──
  const pipsEl=document.getElementById('pips-val'), multEl=document.getElementById('mult-val'),
        focusEl=document.getElementById('focus-val'), scoreEl=document.getElementById('score-total-num');
  const pipsBox=document.getElementById('pips-box'), multBox=document.getElementById('mult-box');
  let rp=basePips, rm=baseMult;
  if(pipsEl) pipsEl.textContent=rp; if(multEl) multEl.textContent=(rm%1===0)?rm:rm.toFixed(1);
  if(focusEl) focusEl.textContent=_fmtFocus(preHandFocus);   // FOCUS starts at the hand's pre-scoring multiplier
  await dwait(DANCE_CFG.tickRest); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── CARD PHASE — cards score; tricks charge (jitter ramps) ──
  // Large hands overflow the clipped viewport: as each card scores, slide the track left so
  // the current card stays in view and the hidden cards on the right get revealed.
  const needScroll = handTrack.scrollWidth > handItems.clientWidth + 2;
  const maxScroll  = Math.max(0, handTrack.scrollWidth - handItems.clientWidth);
  const agit={};
  for(let i=0;i<cardEls.length;i++){
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    if(needScroll){
      const scrollTo = Math.min(cardEls[i].parentElement.offsetLeft, maxScroll);
      if(scrollTo>0 || handTrack.style.transform){ handTrack.style.transform = `translateX(${-scrollTo}px)`; await dwait(200); }
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    }
    dncActivate(cardEls[i]);
    entityEls.forEach((el,ti)=>{ if(!el) return; agit[ti]=(agit[ti]||0)+1; dncChargeReal(el, agit[ti]); });
    await dncFly(cardEls[i], pipsBox, '+'+cardPipVals[i], '#5a8fe0', ()=>{
      rp+=cardPipVals[i]; if(pipsEl) pipsEl.textContent=Math.round(rp); dncTick(pipsEl);
      if(typeof sfxParticleStep==='function') sfxParticleStep('pip'); });
    await dwait(DANCE_CFG.tickRest);
  }
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── ENTITY PHASE — each contributing entity stops jittering and RELEASES its total,
  //    on its real rack element (particles fly from there; fall back to the box if none). ──
  for(let ti=0; ti<tricks.length; ti++){
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    const t=tricks[ti], el=entityEls[ti];
    dncReleaseReal(el);
    const src = el || pipsBox;
    if(t.pip>0){ await dncFly(src, pipsBox, '+'+Math.round(t.pip), '#d4a857', ()=>{
      rp+=t.pip; if(pipsEl) pipsEl.textContent=Math.round(rp); dncTick(pipsEl);
      if(typeof sfxParticleStep==='function') sfxParticleStep('pip'); }); }
    if(t.mult>0){ await dncFly(el || multBox, multBox, '+'+(Number.isInteger(t.mult)?t.mult:t.mult.toFixed(1)), '#b07dea', ()=>{
      rm+=t.mult; if(multEl) multEl.textContent=(rm%1===0)?rm:rm.toFixed(1); dncTick(multEl);
      if(typeof sfxParticleStep==='function') sfxParticleStep('mult'); }); }
    await dwait(DANCE_CFG.tickRest);
  }
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── FOCUS beat — the box updates from the hand's starting multiplier to the post-Focus one ──
  if(targetFocus>1 || targetFocus!==preHandFocus){
    if(focusEl) focusEl.textContent=_fmtFocus(targetFocus);
    const fb=document.getElementById('focus-box'); if(fb){ fb.classList.remove('focus-beat'); void fb.offsetWidth; fb.classList.add('focus-beat'); }
    if(typeof updateFocusMultReadout==='function') updateFocusMultReadout(true);
    if(typeof sfxFocusBeat==='function') sfxFocusBeat();
    await dwait(DANCE_CFG.tickRest); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
  }

  // ── SCORE climb ──
  if(scoreEl) scoreEl.textContent=scoreBefore.toLocaleString();
  const climb = dncFF ? Math.max(120, DANCE_CFG.scoreClimb/DANCE_CFG.ff) : DANCE_CFG.scoreClimb;
  let goalFlashed=false;
  await new Promise(res=>{ const st=performance.now();
    function tk(now){ if(aborted()){ res(); return; }
      const tt=Math.min((now-st)/climb,1), e=1-Math.pow(1-tt,3);
      const cur=Math.round(scoreBefore+(scoreAfter-scoreBefore)*e);
      if(scoreEl) scoreEl.textContent=cur.toLocaleString();
      if(isGoalHand && !goalFlashed && cur>=roundGoal){ goalFlashed=true; if(typeof flashRoundEnd==='function') flashRoundEnd(); }
      if(typeof sfxScoreTick==='function' && Math.random()<0.35) sfxScoreTick();
      if(tt<1) requestAnimationFrame(tk); else res(); }
    requestAnimationFrame(tk); });
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── Settle (same tail as playScoreDance) ──
  stage.classList.remove('dnc-active'); stage.innerHTML=''; dncCleanupReal();
  if(scoreEl) scoreEl.textContent=scoreAfter.toLocaleString();
  showComboFloats(hand, handCells, result);
  const scoreBoxEl=document.getElementById('score-mid');
  if(scoreBoxEl){ scoreBoxEl.classList.remove('box-popping'); void scoreBoxEl.offsetWidth; scoreBoxEl.classList.add('box-popping'); }
  await wait(300); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  danceAbortController = null;
  if(pipsEl) pipsEl.textContent='0'; if(multEl) multEl.textContent='0';
  if(isGoalHand){ if(score>highestHandScore) highestHandScore=score; if(pendingLevelUps>0) sfxMultiGoal(pendingLevelUps); }
  updateScoreUI();

  if(isGoalHand){
    if(challengeActive){ showMessage('GOAL MET — COMPLETE THE CHALLENGE','#c9a84c'); }
    else {
      clearInterval(roundInterval); roundInterval=null; gameTimerPaused=true; frozenRoundSeconds=roundSeconds;
      sfxVictory(); const ctx=getAudioCtx();
      if(sfxDuckGain){ sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); }
      else { sfxDuckGain=ctx.createGain(); sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); sfxDuckGain.connect(ctx.destination); }
      await goalCelebration(handCells);
      startInterlude();
    }
  }
}

// ══════════════════════════════════════════════
// DISCARD
// ══════════════════════════════════════════════
