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

// ── 80s-electronic explosion SFX (synthesized, no asset) — fires as the board blasts apart. ──
function sfxWinExplode(){
  try{
    const actx = getAudioCtx(); if(!actx) return;
    const t = actx.currentTime;
    const master = actx.createGain(); master.gain.value = 0.8;
    master.connect(sfxDuckGain || actx.destination);
    // Detuned saw "zap" sweeping down — the analog-synth stab.
    [0,7].forEach(detune=>{
      const o=actx.createOscillator(); o.type='sawtooth'; o.detune.value=detune;
      o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(70,t+0.42);
      const g=actx.createGain(); g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.45,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
      const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(3200,t);
      f.frequency.exponentialRampToValueAtTime(400,t+0.45); f.Q.value=8;
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t+0.55);
    });
    // White-noise crash through a sweeping bandpass — the blast body.
    const dur=0.5; const buf=actx.createBuffer(1, actx.sampleRate*dur, actx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const n=actx.createBufferSource(); n.buffer=buf;
    const nf=actx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.setValueAtTime(2000,t);
    nf.frequency.exponentialRampToValueAtTime(300,t+0.4); nf.Q.value=1.2;
    const ng=actx.createGain(); ng.gain.setValueAtTime(0.45,t); ng.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
    n.connect(nf); nf.connect(ng); ng.connect(master); n.start(t); n.stop(t+dur);
    // Sub thump for weight.
    const s=actx.createOscillator(); s.type='sine'; s.frequency.setValueAtTime(120,t);
    s.frequency.exponentialRampToValueAtTime(45,t+0.3);
    const sg=actx.createGain(); sg.gain.setValueAtTime(0.55,t); sg.gain.exponentialRampToValueAtTime(0.0001,t+0.34);
    s.connect(sg); sg.connect(master); s.start(t); s.stop(t+0.38);
  }catch(e){}
}

// (The win finale visuals now live inline at the top of the goal-hand branch in
//  playPreviewDance — jitter → gentle explode → winners fly to preview — so they
//  play BEFORE the tally. sfxWinExplode above is the 80s blast they fire.)

// ── New preview-window scoring dance (dev toggle; owner-locked settings) ──
const DANCE_CFG = {
  actA:{cls:'dnc-pulse',dur:420,mag:1.0}, actB:{cls:'dnc-flash',dur:420,mag:0.4},
  trig:{cls:'dnc-pop',dur:260,mag:0.7}, jitInit:0.10, jitGrow:0.18,
  tickRest:600, pFlight:550, scoreClimb:1250, ff:15, pScale:2.6,
  // Base tally speed multiplier for ordinary hands. 1 = full speed (ordinary
  // hands are NOT globally sped up — only a hand interrupted by a NEW hand
  // fast-forwards, via danceInterruptMode below). Kept as a hook the win finale's
  // fast-forward button can raise. `ff` (15×) is the separate "illegible" speed.
  norm:1,
};
let newDanceEnabled = (function(){ try { return localStorage.getItem('newDance') !== '0'; } catch(e){ return true; } })();
function setNewDance(on){ newDanceEnabled = !!on; try { localStorage.setItem('newDance', on ? '1' : '0'); } catch(e){} }

// How a still-animating hand hands off when the next hand is submitted (dev-tunable, feel comparison):
//   'cut'     — the old dance vanishes instantly, new one starts (original behaviour)
//   'ff'      — briefly rush the old hand's score up to its final, then start the new one
//   'resolve' — snap the old hand's score to final with one quick pop, then start the new one
// All three cut the old dance's grid/logic immediately (grid-safe); they differ only in the brief visual handoff.
// Default 'ff': when a NEW hand is submitted while the previous hand is still
// resolving, the OLD (superseded) hand's score rushes up to its final ("fast
// forward"), then the new hand starts. Only the interrupted hand speeds up —
// hands played on their own resolve at full speed. The outgoing hand's total now
// lands on ALL paths, including 'cut' and the spam valve (see playPreviewDance).
let danceInterruptMode = (function(){ try { return localStorage.getItem('danceInterrupt') || 'ff'; } catch(e){ return 'ff'; } })();
function setDanceInterruptMode(m){ if(!['cut','ff','resolve'].includes(m)) m='ff'; danceInterruptMode=m; try { localStorage.setItem('danceInterrupt', m); } catch(e){} }
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
    // Callers await this, so it must ALWAYS settle: rAF is throttled to zero in a background
    // tab, so an abort/timeout escape hatch keeps the incoming dance from stalling there.
    await new Promise(res=>{
      let done=false;
      const finish=()=>{ if(done) return; done=true; scoreEl.textContent = toVal.toLocaleString(); res(); };
      const bail=()=>{ if(done) return; done=true; res(); };
      const guard=setTimeout(finish, dur+400);
      sig&&sig.addEventListener('abort', ()=>{ clearTimeout(guard); bail(); }, {once:true});
      function tk(now){ if(done) return; if(sig&&sig.aborted){ clearTimeout(guard); bail(); return; }
        const t=Math.min((now-start)/dur,1), e=1-Math.pow(1-t,3);
        scoreEl.textContent = Math.round(fromVal+(toVal-fromVal)*e).toLocaleString();
        if(typeof sfxScoreTick==='function' && Math.random()<0.4) sfxScoreTick();
        if(t<1) requestAnimationFrame(tk); else { clearTimeout(guard); finish(); } }
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
// Per-dance base speed multiplier (1 = full). Set to DANCE_CFG.norm for ordinary
// hands and 1 for the goal-winning hand at the top of playPreviewDance. Composes
// with dncFF (the illegible-fast button), which overrides it when active.
let dncSpeed = 1;
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
  const dur = dncFF ? Math.max(60, DANCE_CFG.pFlight/DANCE_CFG.ff) : Math.max(60, DANCE_CFG.pFlight/dncSpeed);
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
  // Ordinary hands fast-forward to a legible ~3× by default; the goal hand plays full.
  dncSpeed = isGoalHand ? 1 : (DANCE_CFG.norm || 1);
  const aborted = () => sig.aborted;
  const dwait = ms => new Promise(r => setTimeout(r, dncFF ? Math.max(6, ms/DANCE_CFG.ff) : Math.max(6, ms/dncSpeed)));
  // ── Interrupt handoff: resolve the just-cut previous hand's score (visual only, grid untouched). ──
  // The outgoing hand's total ALWAYS lands here, one way or another. Previously this only ran for
  // the non-default 'ff'/'resolve' modes and was skipped by the spam valve, so on rapid chaining the
  // score display sat on a stale mid-climb number until the *next* completed dance reached its own
  // score climb (which happens only after the fly-in + the whole card-beat phase — seconds later).
  // That was the "score doesn't update until a hand finishes animating" bug.
  //
  // The handoff now runs CONCURRENTLY with this hand's fly-in rather than blocking before it: the
  // incoming cards float into the preview while the outgoing hand's score rushes up behind them,
  // and the new hand's own beats don't start until that count-up has landed (awaited below).
  let handoffPromise = null;
  if(outgoing && !isGoalHand){
    const endpoint = Math.max(0, score - (result.finalScore||0)); // the outgoing hand's final total
    if(!rapid && (outMode==='ff' || outMode==='resolve')){
      handoffPromise = danceInterruptFlourish(outMode, preDisplay, endpoint, sig);
    } else {
      // Spam valve / 'cut': no flourish, but the total must still resolve immediately.
      const _se = document.getElementById('score-total-num');
      if(_se) _se.textContent = endpoint.toLocaleString();
    }
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

  // Grid feedback for the goal hand is the WIN FINALE below (jitter → explode →
  // fly), which runs before the tally. Normal hands fly into the preview further down.
  const gridEl = document.getElementById('grid');

  // ── Contribution ledger (Tricks + exalt), aggregated per source + per-card ledger ──
  const savedPFM = lastPreFocusMult; const contrib=[]; const _ledger={}; calcScore(hand, handCells, contrib, _ledger); lastPreFocusMult = savedPFM;
  const trickMap = new Map();
  contrib.forEach(e=>{ if(!(e.delta>0)) return; const key=e.source+':'+e.id;
    let t=trickMap.get(key); if(!t){ t={source:e.source,id:e.id,pip:0,mult:0}; trickMap.set(key,t); }
    if(e.type==='pip') t.pip+=e.delta; else t.mult+=e.delta; });
  const tricks=[...trickMap.values()];
  const fmtM = m => (m%1===0)?m:m.toFixed(1);
  // Per-animation-card ledger info, aligned to handCells order (reps + per-card trick deltas).
  const cellInfo = handCells.map(([r,c])=>{ const e=(_ledger.cards||[]).find(x=>x.r===r&&x.c===c); return { reps: e?e.reps:1, pipT: e?e.pipT:{}, multT: e?e.multT:{} }; });
  // Ids emitted per-card (skipped in the hand-level end sweep). Replay-source ids are shown by
  // repeating the card beat, so they're skipped in the sweep too.
  const perCardIds = new Set();
  cellInfo.forEach(ci=>{ Object.keys(ci.pipT).forEach(id=>perCardIds.add(id)); Object.keys(ci.multT).forEach(id=>perCardIds.add(id)); });
  // Ids the end sweep must skip: replay sources (shown by repeating the card beat) plus 'sapling'
  // (per-card perm-pip / retrigger bookkeeping — always emitted per-card above, never hand-level).
  const REPLAY_SRC = new Set(['twos_retrigger','eights_retrigger','rowcol_retrigger','perfect_timing','eye_of_storm','ripple','reflect','soul_mirror','high_and_mighty','closing_time','echo_hand','woodpecker','sapling']);

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
  // id → rack element, so a card can release the specific tricks it triggered.
  const elById = {}; tricks.forEach((t, ti) => { if (entityEls[ti]) elById[t.id] = entityEls[ti]; });

  if(isGoalHand){
    // Survival: skip the explode/fly-to-preview finale. Spread + freeze the board
    // and open the pick-of-three centred over it (see js/survival.js).
    if(survivalActive()){ survivalGoalHandoff(stage); return; }
    // ── WIN FINALE (runs BEFORE the tally) ──
    // The cards AROUND the winning hand jitter for ~2s, then explode gently
    // outward while the winning cards fly up into the preview slots. The score
    // number stays at its pre-hand value — the tally below does the counting.
    const winIds = new Set(handCells.map(([r,c]) => gridData[r]?.[c]?._id).filter(v=>v!=null));
    const gridCards = [...(gridEl?.querySelectorAll('[data-card-id]')||[])];
    const winEls=[], loseEls=[];
    gridCards.forEach(el => { (winIds.has(+el.getAttribute('data-card-id')) ? winEls : loseEls).push(el); });
    gridCards.forEach(el => { el.classList.remove('score-pop-h','score-pop-d','score-pop-c','score-pop-s'); el.style.animation='none'; });
    // Keep the preview EMPTY during the jitter/explosion — the dnc-cards only
    // appear when the winners physically fly in (step 3 reveals each slot).
    cardEls.forEach(d=>{ const o=d.parentElement; if(o) o.style.opacity='0'; });
    // Winners: a gentle gold glow marks them while the rest jitter.
    winEls.forEach(el => { el.style.zIndex='20'; el.animate(
      [{boxShadow:'0 0 0 0 rgba(245,192,66,0)'},{boxShadow:'0 0 16px 5px rgba(245,192,66,0.6)'}],
      {duration:400, fill:'forwards'}); });
    // 1) Surrounding cards jitter for ~2s.
    const jitters = loseEls.map(el => el.animate([
      {transform:'translate(0,0) rotate(0)'},
      {transform:'translate(1.3px,-1.1px) rotate(0.8deg)'},
      {transform:'translate(-1.1px,1.3px) rotate(-0.9deg)'},
      {transform:'translate(1.1px,1px) rotate(0.6deg)'},
      {transform:'translate(-1.3px,-0.9px) rotate(-0.7deg)'},
      {transform:'translate(0,0) rotate(0)'},
    ], {duration:150, iterations:14, easing:'linear'})); // ~2.1s
    await wait(2000);
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    jitters.forEach(a=>{ try{ a.cancel(); }catch(e){} });
    // 2) Surrounding cards explode outward — gentle (short travel, slow).
    sfxWinExplode();
    const gr = gridEl.getBoundingClientRect(); const cx=gr.left+gr.width/2, cy=gr.top+gr.height/2;
    loseEls.forEach(el => {
      const r=el.getBoundingClientRect(); let ax=(r.left+r.width/2)-cx, ay=(r.top+r.height/2)-cy;
      const len=Math.hypot(ax,ay)||1; ax/=len; ay/=len;
      const dist=200+Math.random()*140, rot=(Math.random()*2-1)*160;
      el.style.zIndex='30';
      el.animate([{transform:'translate(0,0) rotate(0) scale(1)', opacity:1},
        {transform:`translate(${ax*dist}px,${ay*dist}px) rotate(${rot}deg) scale(.82)`, opacity:0}],
        {duration:900, easing:'cubic-bezier(.25,.6,.35,1)', fill:'forwards'});
    });
    // 3) As the blast happens, the winning cards fly up into the preview slots
    //    (reveals each slot's dnc-card, same handoff normal hands use).
    handCells.forEach(([r,c],i)=>{ const card=gridData[r]?.[c]; if(!card) return;
      const gEl=gridEl?.querySelector(`[data-card-id="${card._id}"]`);
      const slot=cardEls[i].parentElement;
      setTimeout(()=>{ if(aborted()) return; flyGridCardToSlot(gEl, slot, 460); }, 140 + i*100);
    });
    await wait(140 + handCells.length*100 + 460 + 220);
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    // Remove all original grid card DOM (exploded losers + flown winners). The
    // deck accounting for every card still runs in showLevelUpScreen_fallOnly.
    gridCards.forEach(el => el.remove()); dncHiddenGridEls=[];
  } else {
    // ── Normal hand: the selected grid cards physically fly into their preview slots. ──
    const FLY_STAGGER=95/dncSpeed, FLY_DUR=400/dncSpeed;
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

  // The outgoing hand's score count-up ran alongside the fly-in above; make sure it has
  // fully landed before this hand starts adding its own beats on top.
  if(handoffPromise){
    await handoffPromise;
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
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
  // Release the tricks a card triggers AS the card animates (Balatro-style), repeating the whole
  // beat once per replay. Trick particles fire concurrently; the boxes reconcile to the authoritative
  // totals after the run (per-particle values are illustrative).
  const _fireCardTricks = (info, cardEl) => {
    Object.entries(info.pipT).forEach(([id,d])=>{ if(!(d>0)) return; const el=elById[id]; if(el) dncReleaseReal(el);
      dncFly(el||cardEl, pipsBox, '+'+Math.round(d), '#d4a857', ()=>{ rp+=d; if(pipsEl) pipsEl.textContent=Math.round(rp); dncTick(pipsEl); if(typeof sfxParticleStep==='function') sfxParticleStep('pip'); }); });
    Object.entries(info.multT).forEach(([id,d])=>{ if(!(d>0)) return; const el=elById[id]; if(el) dncReleaseReal(el);
      dncFly(el||cardEl, multBox, '+'+fmtM(d), '#b07dea', ()=>{ rm+=d; if(multEl) multEl.textContent=fmtM(rm); dncTick(multEl); if(typeof sfxParticleStep==='function') sfxParticleStep('mult'); }); });
  };
  for(let i=0;i<cardEls.length;i++){
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    if(needScroll){
      const scrollTo = Math.min(cardEls[i].parentElement.offsetLeft, maxScroll);
      if(scrollTo>0 || handTrack.style.transform){ handTrack.style.transform = `translateX(${-scrollTo}px)`; await dwait(200); }
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    }
    const info = cellInfo[i];
    // A replayed card runs its whole beat again (pops + re-emits everything it triggers).
    for(let rep=0; rep<(info.reps||1); rep++){
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
      dncActivate(cardEls[i]);
      // Contributing entities charge (jitter ramps) through the entire card run.
      entityEls.forEach((el,ti)=>{ if(!el) return; agit[ti]=(agit[ti]||0)+1; dncChargeReal(el, agit[ti]); });
      // The card scores its own rank pips…
      await dncFly(cardEls[i], pipsBox, '+'+cardPipVals[i], '#5a8fe0', ()=>{
        rp+=cardPipVals[i]; if(pipsEl) pipsEl.textContent=Math.round(rp); dncTick(pipsEl);
        if(typeof sfxParticleStep==='function') sfxParticleStep('pip'); });
      // …then every trick/knack this card triggers releases its particle right now.
      _fireCardTricks(info, cardEls[i]);
      await dwait(DANCE_CFG.tickRest);
    }
  }
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // Hand finished animating → stop ALL jitter at once.
  entityEls.forEach(el=>{ if(el){ el.classList.remove('dnc-jitter'); el.style.removeProperty('--dnc-jit'); } });

  // ── HAND-LEVEL SWEEP — tricks not tied to any single card (base-hand shape/timing/set bonuses,
  //    multipliers) release after the card run. Per-card and replay-source tricks already fired above. ──
  for(let ti=0; ti<tricks.length; ti++){
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    const t=tricks[ti];
    if(perCardIds.has(t.id) || REPLAY_SRC.has(t.id)) continue;
    const el=entityEls[ti];
    dncReleaseReal(el);
    const src = el || pipsBox;
    if(t.pip>0){ await dncFly(src, pipsBox, '+'+Math.round(t.pip), '#d4a857', ()=>{
      rp+=t.pip; if(pipsEl) pipsEl.textContent=Math.round(rp); dncTick(pipsEl);
      if(typeof sfxParticleStep==='function') sfxParticleStep('pip'); }); }
    if(t.mult>0){ await dncFly(el || multBox, multBox, '+'+fmtM(t.mult), '#b07dea', ()=>{
      rm+=t.mult; if(multEl) multEl.textContent=fmtM(rm); dncTick(multEl);
      if(typeof sfxParticleStep==='function') sfxParticleStep('mult'); }); }
    await dwait(DANCE_CFG.tickRest);
  }
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // Reconcile the boxes to the authoritative totals (particle values above are illustrative).
  if(pipsEl) pipsEl.textContent = Math.round(lastCalcPips);
  if(multEl) multEl.textContent = fmtM(Math.round(lastCalcMult*10)/10);

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
  const climb = dncFF ? Math.max(120, DANCE_CFG.scoreClimb/DANCE_CFG.ff) : Math.max(120, DANCE_CFG.scoreClimb/dncSpeed);
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
  await wait(300/dncSpeed); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  danceAbortController = null;
  if(pipsEl) pipsEl.textContent='0'; if(multEl) multEl.textContent='0';
  if(isGoalHand){ if(score>highestHandScore) highestHandScore=score; if(pendingLevelUps>0) sfxMultiGoal(pendingLevelUps); }
  updateScoreUI();

  if(isGoalHand){
    if(challengeActive){ showMessage('GOAL MET — COMPLETE THE CHALLENGE','#c9a84c'); }
    else {
      // The win finale (jitter → explode → fly) already played BEFORE this
      // tally, up front in the isGoalHand branch. Here we just settle audio and
      // hand off to the interlude.
      clearInterval(roundInterval); roundInterval=null; gameTimerPaused=true; frozenRoundSeconds=roundSeconds;
      sfxVictory(); const ctx=getAudioCtx();
      if(sfxDuckGain){ sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); }
      else { sfxDuckGain=ctx.createGain(); sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); sfxDuckGain.connect(ctx.destination); }
      startInterlude();
    }
  }
}

// ══════════════════════════════════════════════
// DISCARD
// ══════════════════════════════════════════════
