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

  // Strip score-pop classes - they have animation: ... !important which would block our transform
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

  // Confetti burst - SUCCESS text + particles from each lifted card
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
      const angle = fxRandom() * Math.PI * 2;
      const dist = 80 + fxRandom() * 180;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const rot = (fxRandom() * 720 - 360);
      c.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 80}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 1100 + fxRandom() * 400, easing: 'cubic-bezier(0.2,0.4,0.4,1)', fill: 'forwards' });
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

// ── 80s-electronic explosion SFX (synthesized, no asset) - fires as the board blasts apart. ──
function sfxWinExplode(){
  try{
    const actx = getAudioCtx(); if(!actx) return;
    const t = actx.currentTime;
    // Volume/mute: this one builds its own graph rather than going through
    // playTone, so it has to fold in sfxVolume() itself or the mute toggle and
    // the Sound-effects slider would not touch it (they did not, before r179).
    // 0.55, not 0.8: this stacks two detuned saws, a sub and a noise burst into one
    // gain, and measured across the whole catalog it was the only sound that
    // clipped - peak 1.18 against a median of 0.13. At 0.55 it peaks near 0.81 and
    // is still comfortably the loudest thing in the game, which is the intent.
    const master = actx.createGain(); master.gain.value = 0.55 * sfxVolume();
    if (master.gain.value <= 0) return;
    master.connect(sfxOut(actx));
    // Detuned saw "zap" sweeping down - the analog-synth stab.
    [0,7].forEach(detune=>{
      const o=actx.createOscillator(); o.type='sawtooth'; o.detune.value=detune;
      o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(70,t+0.42);
      const g=actx.createGain(); g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.45,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
      const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(3200,t);
      f.frequency.exponentialRampToValueAtTime(400,t+0.45); f.Q.value=8;
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t+0.55);
    });
    // White-noise crash through a sweeping bandpass - the blast body.
    const dur=0.5; const buf=actx.createBuffer(1, actx.sampleRate*dur, actx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(fxRandom()*2-1)*(1-i/d.length);
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
//  playPreviewDance - jitter → gentle explode → winners fly to preview - so they
//  play BEFORE the tally. sfxWinExplode above is the 80s blast they fire.)

// ── New preview-window scoring dance (dev toggle; owner-locked settings) ──
const DANCE_CFG = {
  actA:{cls:'dnc-pulse',dur:420,mag:1.0}, actB:{cls:'dnc-flash',dur:420,mag:0.4},
  trig:{cls:'dnc-pop',dur:260,mag:0.7}, jitInit:0.10, jitGrow:0.18,
  tickRest:600, pFlight:550, scoreClimb:1250, ff:15, pScale:2.6,
  // The plate's size multiplier, on top of PARTICLE_CFG.size. 1.15 is the owner's
  // "+15%". pScale above is the OLD bare-text scale and is now unused by the
  // plate shapes - it still drives the no-plate fallback.
  pScaleMul:1.15,
  // Base tally speed multiplier for ordinary hands. 1 = full speed (ordinary
  // hands are NOT globally sped up - only a hand interrupted by a NEW hand
  // fast-forwards, via danceInterruptMode below). Kept as a hook the win finale's
  // fast-forward button can raise. `ff` (15×) is the separate "illegible" speed.
  // Overwritten at load by Settings > Motion > Scoring speed (default 2x). The 1
  // here is only the value before settings apply; it is not the shipped default.
  norm:1,
};
// ══════════════════════════════════════════════
// SCORE PARTICLE (r221) - tuned in particle-preview.html
// ══════════════════════════════════════════════
// A particle used to be bare serif text with a drop shadow, which had to compete
// with a board of cream playing cards and a lit HUD behind it. It is a small
// DIAMOND PLATE now, coloured by the chip it is flying into and lettered in
// white: the colour says what is changing before the number is even read, and an
// opaque plate is legible over anything.
//
// Open particle-preview.html, tune, press Dump, and paste the block it prints
// over this one. `colors` are keyed by the particle kind (see evKind).
const PARTICLE_CFG = {
  shape: 'diamond',          // diamond | square | circle | pill | none
  size: 40,                  // px, the plate
  font: 14,                  // px, the label
  round: 4, borderW: 1.5, borderLight: 45, glow: 10,
  ink: '#ffffff',
  colors: {
    pipAdd:  '#2f6bd8',      // pips are blue, the PIPS chip's own border colour
    pipMul:  '#1f9ad8',      // a multiply is the same hue, brighter
    multAdd: '#c0202c',      // mult is red, the MULT chip's colour
    multMul: '#e0533a',
    focus:   '#8a4fd0',
    credits: '#c9a84c',
    time:    '#3f9ad0',
  },
};
// Lighten a hex toward white. The border is the plate's own hue brightened, not
// a separate colour, so the diamond reads as one object rather than as an
// outline around a fill.
function _ptLighten(hex, pct){
  const n = parseInt(String(hex).slice(1), 16);
  if (!isFinite(n)) return hex;
  const t = (pct || 0) / 100, m = v => Math.round(v + (255 - v) * t);
  return `rgb(${m(n>>16)},${m((n>>8)&255)},${m(n&255)})`;
}

let newDanceEnabled = (function(){ try { return localStorage.getItem('newDance') !== '0'; } catch(e){ return true; } })();
function setNewDance(on){ newDanceEnabled = !!on; try { localStorage.setItem('newDance', on ? '1' : '0'); } catch(e){} }

// How a still-animating hand hands off when the next hand is submitted (dev-tunable, feel comparison):
//   'cut'     - the old dance vanishes instantly, new one starts (original behaviour)
//   'ff'      - briefly rush the old hand's score up to its final, then start the new one
//   'resolve' - snap the old hand's score to final with one quick pop, then start the new one
// All three cut the old dance's grid/logic immediately (grid-safe); they differ only in the brief visual handoff.
// Default 'ff': when a NEW hand is submitted while the previous hand is still
// resolving, the OLD (superseded) hand's score rushes up to its final ("fast
// forward"), then the new hand starts. Only the interrupted hand speeds up -
// hands played on their own resolve at full speed. The outgoing hand's total now
// lands on ALL paths, including 'cut' and the spam valve (see playPreviewDance).
let danceInterruptMode = (function(){ try { return localStorage.getItem('danceInterrupt') || 'ff'; } catch(e){ return 'ff'; } })();
function setDanceInterruptMode(m){ if(!['cut','ff','resolve'].includes(m)) m='ff'; danceInterruptMode=m; try { localStorage.setItem('danceInterrupt', m); } catch(e){} }
let _lastDanceStart = 0; // for the spam valve: rapid re-interrupts skip the flourish
function _scoreDisplayed(){ const el=document.getElementById('score-total-num'); if(!el) return 0; const n=parseInt((el.textContent||'0').replace(/[^0-9-]/g,''),10); return isNaN(n)?0:n; }
// ── RAPID-FIRE HANDOFF (r173) ───────────────────────────────────────────────
// Submitting a hand while another is dancing used to cut the old one and quietly
// snap a number onto the score. What the player saw was the score sitting still
// through a burst and then jumping at the end.
//
// The rule now: the outgoing hand ALWAYS finishes visibly, and the deeper the
// burst gets the more brutally that finish is compressed - but the last beat,
// the fused PMF chip flying into the SCORE, never gets skipped.
//
//   burst depth 1  ('rush')  the outgoing hand hurries to its end: fuse, fly,
//                            and the score counts up behind the incoming cards.
//   burst depth 2+ ('snap')  no ceremony left - fuse and fly at ~3x, score set
//                            on landing. The INCOMING hand also drops its fly-in
//                            and its card beats (see skipBeats) and goes straight
//                            to its own fuse-and-fly, so a five-hand burst reads
//                            as five chips hitting the score instead of one.
//
// The grid and the deck are still cut immediately in every case - that has always
// been the safety property here and it is untouched. This is visual only.
let dncChain = 0;              // how many hands deep the current burst is
let dncCutAt = -1e9;           // when cancelDance() last cut a LIVE dance (see js/score-anims.js)
const DNC_CUT_WINDOW = 60;     // ms: a cut this recent means THIS dance is the replacement
// ms between hand SUBMISSIONS that still counts as one burst. Longer than a
// skipped dance's tail (so the tail alone cannot keep a burst alive) and shorter
// than any deliberate play (so choosing a hand always gets the full tally).
const DNC_BURST_WINDOW = 1400;
let _dncLastHandAt = -1e9;    // when the player last submitted a hand
let _dncOutHandScore = 0;      // the currently-dancing hand's own score, for the handoff

async function danceHandoffToScore(tier, outHandScore, fromVal, toVal, sig) {
  const scoreEl = document.getElementById('score-total-num');
  const land = () => { if (scoreEl) scoreEl.textContent = toVal.toLocaleString(); };
  const speed = tier === 'snap' ? 3.2 : 1.6;
  // Fuse the chips onto the outgoing hand's score, then throw them at the total.
  let flew = false;
  if (typeof pmfMergeIn === 'function' && outHandScore > 0) {
    const merged = await pmfMergeIn(outHandScore, { speed, signal: sig });
    if (merged && typeof pmfFlyToScore === 'function') flew = await pmfFlyToScore({ speed });
    if (typeof pmfSplitOut === 'function') await pmfSplitOut({ speed: speed * 2 });
  }
  if (sig && sig.aborted) { land(); return; }     // land it even when cut again
  if (!flew || tier === 'snap') { land(); return; }
  // The chip landed on the total - run the number up to meet it.
  const dur = 300, start = performance.now();
  await new Promise(res => {
    let done = false;
    const finish = () => { if (done) return; done = true; land(); res(); };
    const bail   = () => { if (done) return; done = true; land(); res(); };
    const guard  = setTimeout(finish, dur + 400);   // rAF is dead in a background tab
    sig && sig.addEventListener('abort', () => { clearTimeout(guard); bail(); }, { once: true });
    (function tk(now){
      if (done) return;
      if (sig && sig.aborted) { clearTimeout(guard); bail(); return; }
      const t = Math.min(((now||performance.now()) - start)/dur, 1), e = 1 - Math.pow(1-t, 3);
      if (scoreEl) scoreEl.textContent = Math.round(fromVal + (toVal-fromVal)*e).toLocaleString();
      if (typeof sfxScoreTick === 'function' && fxRandom() < 0.4) sfxScoreTick();
      if (t < 1) requestAnimationFrame(tk); else { clearTimeout(guard); finish(); }
    })(performance.now());
  });
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
    setTimeout(() => sfxCardPop(cardColorSuit(card)), i * STAGGER_MS);
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

  // Save card data and remove cards (skip for goal hands - salute will use cards in place)
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
  const basePips   = Math.round(handBasePips(hand) * levelScale);
  const baseMult   = handBaseMult(hand, handCells?.length);

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

  // ── 5. Score ticker - uses the latest particle land time (card + Trick particles) ──
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

  // Focus beat - fires after mult particles finish. MULT stays pure; the FOCUS box shows the
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
    // Parallel tick SFX - fire roughly every 80ms while score climbs, capped
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

  // Always sync display to actual score after dance - covers heldBack additions, bonus side-effects, etc.
  updateScoreUI();

  if (isGoalHand) {
    if (challengeActive) {
      showMessage('GOAL MET - COMPLETE THE CHALLENGE', '#c9a84c');
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
  // dncChain is still not reset here, but the reason has changed: it is derived
  // from the gap between hand SUBMISSIONS now, so an abort with no successor
  // really does self-correct (the next hand is slow, the count restarts), and an
  // abort WITH a successor keeps the depth it earned.
  // An interrupted hand must never leave the PMF row fused - the next hand
  // writes its numbers into chips the player would not be able to see.
  if (typeof pmfResetNow === 'function') pmfResetNow();
  // Hand the portrait strip back to whichever half the player had chosen.
  if (typeof portraitDanceEnd === 'function') portraitDanceEnd();
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
    // Survival drives its own goal transition (pick → deal); the interlude/payout +
    // its round-freeze must NOT run on abort, or they'd clobber the freshly dealt board.
    if (!challengeActive && !survivalActive()) {
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
// `durOverride` pins the flight time. Every particle launched together in one beat
// MUST share a duration: dncBumpAccel below shortens each successive flight, so a
// beat fired in one go had its particles LAND IN REVERSE ORDER - and since a
// particle applies its number on landing, that reverses the arithmetic. On a card
// carrying a x3 and a x2 it finished on 466 pips instead of 416.
// `kind` picks the plate colour out of PARTICLE_CFG.colors; `color` stays the
// legacy text colour and is used only by the no-plate shape.
function dncFly(srcEl, boxEl, label, color, onLand, durOverride, kind){
  const a=srcEl.getBoundingClientRect(), b=boxEl.getBoundingClientRect();
  const C=PARTICLE_CFG, bg=(C.colors && C.colors[kind]) || color || '#d4a857';
  const el=document.createElement('div');
  el.className='dnc-particle pt-'+(C.shape||'diamond');
  // Two nested elements, deliberately: the OUTER is what the flight animates, so
  // the diamond's own 45deg rotation has to live on an inner box or the flight's
  // transform would overwrite it every frame. The label counter-rotates.
  el.innerHTML='<span class="pt-box"><span class="pt-lab"></span></span>';
  el.querySelector('.pt-lab').textContent=label;
  el.style.left=(a.left+a.width/2)+'px'; el.style.top=(a.top+a.height/2)+'px';
  el.style.color=color;                       // only read by the no-plate shape
  el.style.setProperty('--dnc-pscale', DANCE_CFG.pScale);
  el.style.setProperty('--pt-size', (C.size*DANCE_CFG.pScaleMul)+'px');
  el.style.setProperty('--pt-font', (C.font*DANCE_CFG.pScaleMul)+'px');
  el.style.setProperty('--pt-round', C.round+'px');
  el.style.setProperty('--pt-bw', C.borderW+'px');
  el.style.setProperty('--pt-bg', bg);
  el.style.setProperty('--pt-bc', _ptLighten(bg, C.borderLight));
  el.style.setProperty('--pt-ink', C.ink);
  el.style.setProperty('--pt-glow', C.glow+'px');
  document.body.appendChild(el);
  const dx=(b.left+b.width/2)-(a.left+a.width/2), dy=(b.top+b.height/2)-(a.top+a.height/2);
  const dur = durOverride || (dncFF ? Math.max(60, DANCE_CFG.pFlight/DANCE_CFG.ff) : Math.max(60, DANCE_CFG.pFlight/dncPace()));
  dncAnimate(el, [{transform:'translate(-50%,-50%) scale(.6)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.2},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.9)`,opacity:0}],
    {duration:dur,easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'});
  // This particle IS a payout tick - a card's pips, a Trick's pips or mult, a
  // Sleight firing. Bump AFTER dur is read so the speed-up lands on what is
  // still to come, not on the flight that earned it.
  dncBumpAccel();
  dncTimeout(()=>el.remove(), dur+60);
  return new Promise(res=>dncTimeout(()=>{ if(onLand) onLand(); res(); }, dur));
}
function dncFinishAbort(stage, isGoalHand, myGen){
  // If a newer dance has taken over (myGen behind the global), this dance was superseded:
  // do NOT touch the shared stage/score UI - the successor owns it now.
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
  // "Did this hand interrupt another?" - true if a dance is still live, OR if one
  // was cut microseconds ago by the caller (playHand does exactly that).
  // Was this hand played ON TOP of another? Two separate questions, and the code
  // used to conflate them:
  //   - is a dance still on screen        -> we owe the outgoing hand a handoff
  //   - is the player BURSTING            -> how much of this hand we may skip
  // Burst depth used to be derived from the first, which is why a hand could
  // "fast-play" for no visible reason. A skipped dance is SHORT but still has a
  // tail (merge, throw, climb, settle), so the next hand almost always arrived
  // while danceAbortController was non-null and inherited the depth - once you
  // entered skip mode you stayed in it. And cancelDance() stamps dncCutAt for
  // cuts with no successor at all (round end, a boss firing, startGame), so a
  // hand played just after one of those inherited a burst it never earned.
  // Depth now comes from how fast hands are actually being SUBMITTED.
  const outgoing = !!danceAbortController || (performance.now() - dncCutAt) < DNC_CUT_WINDOW;
  const sinceLastHand = performance.now() - _dncLastHandAt;
  _dncLastHandAt = performance.now();
  const preDisplay = _scoreDisplayed();             // score number shown right now (mid-climb)
  _lastDanceStart = performance.now();
  // How deep into a burst are we? Only a hand submitted inside DNC_BURST_WINDOW of
  // the previous one continues the burst; anything slower starts a fresh count, so
  // the depth self-heals the moment the player stops hammering.
  dncChain = (sinceLastHand < DNC_BURST_WINDOW) ? dncChain + 1 : 0;
  const chain = dncChain;
  // Third hand of a burst and beyond: no fly-in, no card beats. Straight to the
  // fuse and the throw. A goal hand always plays in full - it ends the round.
  const skipBeats = chain >= 2 && !isGoalHand;
  const outHandScore = _dncOutHandScore;            // the hand we are cutting short
  _dncOutHandScore = result.finalScore || 0;
  dncCutAt = -1e9;                                  // consumed - one handoff per cut
  cancelDance();
  const ctrl = new AbortController(); danceAbortController = ctrl; const sig = ctrl.signal;
  const myGen = ++dncGen; // this dance's generation; if it's superseded, its abort handler stays silent
  dncFF = false; resetParticleStep();
  // Portrait shares one strip between Knacks and the hand preview, and this dance
  // draws into the preview - so make sure the preview is the visible half before
  // any card flies at it. No-op in landscape. (see js/portrait-panel.js)
  if (typeof portraitDanceBegin === 'function') portraitDanceBegin();
  // Ordinary hands fast-forward to a legible ~3× by default; the goal hand plays full.
  // The Scoring speed setting applies to the goal hand too (r220). It was pinned at
  // 1x there on the grounds that the finale should play in full - but the setting is
  // a 0.5x-16x slider now, and a player who has set 8x has said what they want to
  // watch. Having the one hand that ends the round ignore them reads as a stall,
  // not as ceremony.
  dncSpeed = DANCE_CFG.norm || 1;
  dncResetAccel();          // each hand winds itself up from its own base pace
  dncClearAnims();
  const aborted = () => sig.aborted;
  const dwait = ms => dncWait(dncFF ? Math.max(6, ms/DANCE_CFG.ff) : Math.max(6, ms/dncPace()));
  // ── Interrupt handoff: resolve the just-cut previous hand's score (visual only, grid untouched). ──
  // The outgoing hand's total ALWAYS lands here, one way or another. Previously this only ran for
  // the non-default 'ff'/'resolve' modes and was skipped by the spam valve, so on rapid chaining the
  // score display sat on a stale mid-climb number until the *next* completed dance reached its own
  // score climb (which happens only after the fly-in + the whole card-beat phase - seconds later).
  // That was the "score doesn't update until a hand finishes animating" bug.
  //
  // The handoff now runs CONCURRENTLY with this hand's fly-in rather than blocking before it: the
  // incoming cards float into the preview while the outgoing hand's score rushes up behind them,
  // and the new hand's own beats don't start until that count-up has landed (awaited below).
  let handoffPromise = null;
  if(outgoing){
    const endpoint = Math.max(0, score - (result.finalScore||0)); // the outgoing hand's final total
    handoffPromise = danceHandoffToScore(chain >= 2 ? 'snap' : 'rush', outHandScore, preDisplay, endpoint, sig);
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
  const basePips = Math.round(handBasePips(hand) * levelScale), baseMult = handBaseMult(hand, handCells.length);

  // Grid feedback for the goal hand is the WIN FINALE below (jitter → explode →
  // fly), which runs before the tally. Normal hands fly into the preview further down.
  const gridEl = document.getElementById('grid');

  // ── The scoring TIMELINE (r197) ──
  // calcScore hands back an ORDERED list of everything that happened and when, so
  // the dance no longer has to guess which Trick belonged to which card. Replaying
  // it against a running pip/mult pair reproduces the real total exactly (verified
  // over 10,000 scored hands), which is what lets a Trick pay out at its own moment
  // instead of being banked into an end-of-hand lump.
  const savedPFM = lastPreFocusMult; const contrib=[]; const _ledger={}; calcScore(hand, handCells, contrib, _ledger); lastPreFocusMult = savedPFM;
  const timeline = _ledger.timeline || [];
  const fmtM = m => (m%1===0)?m:m.toFixed(1);
  // Cells in SCORING order (the timeline's card indices point here, and scoring
  // order is not selection order once the Selection Scoring knack is owned).
  const scoreCells = (typeof scoringOrderCells === 'function') ? scoringOrderCells(handCells) : handCells.slice();
  const repsByCard = (_ledger.cards||[]).map(c=>c.reps||1);
  // handCells index for a scoring-order index, so a beat animates the right slot.
  const slotOf = si => { const sc = scoreCells[si]; if(!sc) return -1;
    return handCells.findIndex(([r,c]) => r===sc[0] && c===sc[1]); };

  // Walk the timeline into STEPS: one per card (replayed `reps` times) and one per
  // hand-level event. This is the running order of the whole tally.
  const steps = [];
  for(let i=0;i<timeline.length;){
    const ev = timeline[i];
    if(ev.card >= 0){ const ci=ev.card, start=i;
      while(i<timeline.length && timeline[i].card===ci) i++;
      steps.push({ kind:'card', card:ci, slot:slotOf(ci), reps:repsByCard[ci]||1, events:timeline.slice(start,i) });
    } else { steps.push({ kind:'hand', event:ev }); i++; }
  }
  // Every entity that will fire, so the tray can be resolved once up front. Nothing
  // is charged here - an entity stays perfectly still until its own event lands.
  const elById = {};
  const entityEls = [];
  timeline.forEach(ev => {
    if(ev.id === '_card') return;
    if(elById[ev.id] !== undefined) return;
    const el = danceEntityEl(ev.source, ev.id);
    elById[ev.id] = el || null;
    if(el) entityEls.push(el);
  });

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
  // Portrait sizes its preview cards to the strip, and overlaps them if the hand
  // is too wide to fit. Must run BEFORE the fly-in - flyGridCardToSlot measures
  // each slot's rect to land the clone on it.
  if (typeof fitPortraitPreviewCards === 'function') fitPortraitPreviewCards();
  dncRealEls = entityEls.slice();

  if(isGoalHand){
    // ── WIN FINALE (runs BEFORE the tally) ──
    // The cards AROUND the winning hand jitter for ~2s, then explode gently
    // outward while the winning cards fly up into the preview slots. The score
    // number stays at its pre-hand value - the tally below does the counting.
    const winIds = new Set(handCells.map(([r,c]) => gridData[r]?.[c]?._id).filter(v=>v!=null));
    const gridCards = [...(gridEl?.querySelectorAll('[data-card-id]')||[])];
    const winEls=[], loseEls=[];
    gridCards.forEach(el => { (winIds.has(+el.getAttribute('data-card-id')) ? winEls : loseEls).push(el); });
    gridCards.forEach(el => { el.classList.remove('score-pop-h','score-pop-d','score-pop-c','score-pop-s'); el.style.animation='none'; });
    // Keep the preview EMPTY during the jitter/explosion - the dnc-cards only
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
    // 2) Surrounding cards explode outward - gentle (short travel, slow).
    sfxWinExplode();
    const gr = gridEl.getBoundingClientRect(); const cx=gr.left+gr.width/2, cy=gr.top+gr.height/2;
    loseEls.forEach(el => {
      const r=el.getBoundingClientRect(); let ax=(r.left+r.width/2)-cx, ay=(r.top+r.height/2)-cy;
      const len=Math.hypot(ax,ay)||1; ax/=len; ay/=len;
      const dist=200+fxRandom()*140, rot=(fxRandom()*2-1)*160;
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
    // The marked row/column lines belong to the board that just left (js/entity-fx.js).
    // This is one of THREE places the card DOM is torn down without a following
    // render - the goal-hand finale (here), the round-end fall (js/interlude.js)
    // and the next round's deal (js/level-up.js) - which is why the teardown is a
    // call at each of them and not a guard inside render(): render never runs
    // again in between, so a guard would never get to look. rowColBonuses is
    // untouched, so the next board draws the same lines.
    if(typeof clearLineMarkers==='function') clearLineMarkers();
    // Survival: open the pick-of-three NOW (right of the preview), so the score
    // count-up below runs alongside it - the player can watch the tally or start
    // picking a bonus. (In survival the deck accounting happens in survivalDealNext.)
    if(survivalActive()) survivalShowPick();
  } else if(skipBeats){
    // ── Third hand of a burst: no fly-in. The cards leave the board immediately
    //    and the preview keeps whatever it already shows; the only thing this
    //    hand still owes the player is its fuse and its throw at the score. ──
    cardEls.forEach(d=>{ const o=d.parentElement; if(o) o.style.opacity=''; });
    if(typeof sfxFlipShuffle==='function') sfxFlipShuffle();
    removeAndFall(toRemove,'play'); dncHiddenGridEls=[];
  } else {
    // ── Normal hand: the selected grid cards physically fly into their preview slots. ──
    const FLY_STAGGER=95/dncPace(), FLY_DUR=400/dncPace();
    cardEls.forEach(d=>{ const o=d.parentElement; if(o) o.style.opacity='0'; });
    handCells.forEach(([r,c],i)=>{ const card=gridData[r][c]; if(!card) return;
      const gEl=gridEl?.querySelector(`[data-card-id="${card._id}"]`);
      const slot=cardEls[i].parentElement;
      setTimeout(()=>{ if(aborted()) return; flyGridCardToSlot(gEl, slot, FLY_DUR); if(typeof sfxCardPop==='function') sfxCardPop(cardColorSuit(card)); }, i*FLY_STAGGER);
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
  // Seed from the LEDGER, not from the local basePips/baseMult: those are the
  // primary hand's ladder alone, while the ledger's base also folds in Amplifier
  // and any layered hand's base - neither of which goes through the ledger as an
  // event, because both are part of what the hand is worth before anything fires.
  let rp = (typeof _ledger.basePips === 'number') ? _ledger.basePips : basePips;
  let rm = (typeof _ledger.baseMult === 'number') ? _ledger.baseMult : baseMult;
  if(pipsEl) pipsEl.textContent=rp; if(multEl) multEl.textContent=(rm%1===0)?rm:rm.toFixed(1);
  if(focusEl) focusEl.textContent=_fmtFocus(preHandFocus);   // FOCUS starts at the hand's pre-scoring multiplier
  // Did this hand's own Focus change the multiplier? Answered here so the beat
  // below and the settle further down agree on it.
  const focusActive = (targetFocus > 1 || targetFocus !== preHandFocus);
  await dwait(DANCE_CFG.tickRest); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── FOCUS FIRST (r221) ──
  // The Focus this hand earned - its complexity, how fast it was played, and any
  // Trick that hands out Focus - is generated in `playHand` BEFORE scoring, and it
  // multiplies THIS hand. The dance said the opposite: the chip sat at the
  // pre-hand value through the whole tally and only climbed at the very end,
  // which reads as "that multiplier applies to the NEXT hand". It is the same
  // number either way; only when the player is told it changed.
  //
  // So the chip settles on the multiplier this hand is actually being scored with
  // before a single card scores, and the rest of the tally runs underneath a
  // FOCUS box that is already telling the truth.
  if(focusActive){
    if(focusEl) focusEl.textContent=_fmtFocus(targetFocus);
    const fb=document.getElementById('focus-box'); if(fb){ fb.classList.remove('focus-beat'); void fb.offsetWidth; fb.classList.add('focus-beat'); }
    if(typeof updateFocusMultReadout==='function') updateFocusMultReadout(true);
    if(typeof sfxFocusBeat==='function') sfxFocusBeat();
    await dwait(DANCE_CFG.tickRest); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
  }

  // ── THE TALLY - one ordered walk of the timeline ──
  // Every entity is STILL until its own event fires. There is no charge-up phase
  // and no end-of-hand lump: a Trick that triggers off the third card pops when
  // the third card pops, and a whole-hand Trick pops on its own afterwards. The
  // running chips apply each event with its real scope and rounding, so what the
  // player watches IS the arithmetic rather than an illustration of it.
  //
  // Large hands overflow the clipped viewport: as each card scores, slide the track
  // left so the current card stays in view and the hidden cards get revealed.
  const needScroll = handTrack.scrollWidth > handItems.clientWidth + 2;
  const maxScroll  = Math.max(0, handTrack.scrollWidth - handItems.clientWidth);

  const _rnd = (v,how) => how==='int' ? Math.round(v) : how==='dp1' ? Math.round(v*10)/10 : v;
  const showPips = extra => { if(pipsEl) pipsEl.textContent = Math.round(rp + (extra||0)); dncTick(pipsEl); };
  const showMult = () => { if(multEl) multEl.textContent = fmtM(rm); dncTick(multEl); };
  // A x lands on the chip it multiplies, so it is read as an operation on that
  // number rather than as one more addend. Pips fly gold, mult violet, a multiply
  // in the hotter shade of its own colour.
  // Legacy text colours - used only by PARTICLE_CFG.shape 'none'. The plate
  // shapes colour themselves from PARTICLE_CFG.colors via evKind below.
  const COL = { pipAdd:'#d4a857', pipMul:'#ff9d3c', multAdd:'#b07dea', multMul:'#ff6bd6', card:'#5a8fe0' };
  // Which colour family this event belongs to. A card's own pips are pips.
  const evKind = ev => ev.op==='pip+' ? 'pipAdd' : ev.op==='pip*' ? 'pipMul'
                     : ev.op==='mult+' ? 'multAdd' : 'multMul';
  const evLabel = ev => ev.op==='pip+'||ev.op==='mult+' ? '+'+(ev.op==='pip+'?Math.round(ev.value):fmtM(ev.value))
                                                        : '\u00d7'+fmtM(Math.round(ev.value*100)/100);
  const evColor = ev => ev.op==='pip+' ? (ev.id==='_card'?COL.card:COL.pipAdd)
                      : ev.op==='pip*' ? COL.pipMul : ev.op==='mult+' ? COL.multAdd : COL.multMul;

  // Fire ONE event: pop whatever produced it, throw the particle, apply the number.
  //
  // `subRef` is the CURRENT CARD'S own pip subtotal, and inside a card's beat every
  // pip op - add and multiply alike - lands on it, exactly as calcScore builds `cp`
  // per card and only then does `totalPips += cp`. That is what gives a card-scoped
  // x pips (Humble Roots, a card enhancement, a curse, the Blight) something of its
  // own to multiply. Routing the adds straight to the hand total instead left the
  // subtotal at zero, so the multiply multiplied nothing: measured at 171 pips on a
  // hand worth 228. Mult has no per-card subtotal - calcScore accumulates per-card
  // mult into the hand mult additively - so mult ops always land on `rm`.
  // `defer` returns the apply-the-number function instead of wiring it to this
  // particle's own landing, so a whole beat can launch together and still apply
  // its values in emission order (see the beat loop below).
  const fireEvent = (ev, fallbackEl, subRef, awaitIt, inBeat, dur, defer) => {
    const el = ev.id==='_card' ? null : elById[ev.id];
    if(el) dncReleaseReal(el);
    const src = el || fallbackEl;
    const box = (ev.op==='pip+'||ev.op==='pip*') ? pipsBox : multBox;
    const land = () => {
      if(ev.op==='pip+'){ if(inBeat) subRef.v += ev.value; else rp += ev.value; showPips(subRef.v); }
      else if(ev.op==='pip*'){ if(inBeat) subRef.v = _rnd(subRef.v*ev.value, ev.rnd); else rp = _rnd(rp*ev.value, ev.rnd); showPips(subRef.v); }
      else if(ev.op==='mult+'){ rm += ev.value; showMult(); }
      else { rm = _rnd(rm*ev.value, ev.rnd); showMult(); }
      if(typeof sfxParticleStep==='function') sfxParticleStep((ev.op==='pip+'||ev.op==='pip*')?'pip':'mult');
    };
    const p = dncFly(src, box, evLabel(ev), evColor(ev), defer ? null : land, dur, evKind(ev));
    return defer ? land : (awaitIt ? p : null);
  };

  // `!skipBeats` short-circuits the walk rather than wrapping it in a block - same
  // effect, and it cannot desync the aborts inside it.
  for(let si=0; !skipBeats && si<steps.length; si++){
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    const step = steps[si];

    if(step.kind === 'hand'){
      // A whole-hand entity: nothing on the board caused it, so it flies from its
      // own tray tile (or from the chip it feeds, if it has no tile).
      const ev = step.event;
      const anchor = (ev.from >= 0 && cardEls[slotOf(ev.from)]) ? cardEls[slotOf(ev.from)]
                   : ((ev.op==='pip+'||ev.op==='pip*') ? pipsBox : multBox);
      await fireEvent(ev, anchor, { v:0 }, true, false);
      await dwait(DANCE_CFG.tickRest);
      continue;
    }

    // ── A card's beat. Runs once per replay; a replay re-pops the card and
    //    re-fires everything it triggers, which is what a replay IS. ──
    const slot = step.slot >= 0 ? step.slot : 0;
    const cardEl = cardEls[slot] || cardEls[0];
    if(needScroll && cardEl){
      const scrollTo = Math.min(cardEl.parentElement.offsetLeft, maxScroll);
      if(scrollTo>0 || handTrack.style.transform){ handTrack.style.transform = `translateX(${-scrollTo}px)`; await dwait(200); }
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    }
    for(let rep=0; rep<step.reps; rep++){
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
      dncActivate(cardEl);
      const subRef = { v:0 };
      // The card's own pips lead, then everything it triggered, in order. The
      // leading pip is awaited so the beat reads as "card, then its consequences";
      // the rest overlap, or a heavily-buffed card would take half a minute.
      // Every particle in this beat is launched together (they overlap in the air,
      // or a heavily-buffed card would take half a minute) but the beat does not
      // END until all of them have LANDED. That is not cosmetic: a particle applies
      // its number in its landing callback, so banking the card's subtotal - or
      // letting the next step's x mult run - while one is still in flight applies
      // the two out of order. Measured before this await: a x2 landing ahead of a
      // +9 finished the hand on 13 mult instead of 26.
      // ALL AT ONCE (r221). A card and everything it triggered are one event, so
      // they leave together and land together - no stagger.
      //
      // The ordering trap this has to dodge: a particle used to apply its number
      // in its OWN landing callback, and launching a beat together could not keep
      // those in order two different ways - dncFly bumps the accel per particle,
      // so each successive flight is shorter and they land in REVERSE; and even
      // pinned to one duration they race, because dncWait polls on a 60ms tick
      // rather than firing in registration order. Measured on a card carrying a
      // x3 and a x2: 466 pips reversed, 512 racing, 416 correct.
      //
      // So the values are decoupled from the particles: every particle in the
      // beat is launched with ONE shared duration and NO landing callback
      // (`defer`), and a single timer applies all of them, in emission order, at
      // the moment they arrive. Simultaneous on screen, strictly ordered in the
      // arithmetic.
      const beatDur = dncFF ? Math.max(60, DANCE_CFG.pFlight/DANCE_CFG.ff)
                            : Math.max(60, DANCE_CFG.pFlight/dncPace());
      const applies = step.events.map(ev => fireEvent(ev, cardEl, subRef, false, true, beatDur, true));
      await dncWait(beatDur);
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
      applies.forEach(fn => { if(fn) fn(); });
      // The card's pips join the hand total once its own beat has resolved, so a
      // card-scoped multiply has something of its own to multiply.
      rp += subRef.v; showPips(0);
      await dwait(DANCE_CFG.tickRest);
    }
  }
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // Nothing should still be jittering - entities pop and settle now rather than
  // rattling through the hand - but clear it defensively in case a dance was cut
  // mid-beat and rebound.
  entityEls.forEach(el=>{ if(el){ el.classList.remove('dnc-jitter'); el.style.removeProperty('--dnc-jit'); } });

  // ── Reconcile ──
  // Against the LEDGER's captured totals, not the live lastCalcPips/lastCalcMult.
  // Those are globals that EVERY calcScore call overwrites, and plenty run during
  // a dance: removeAndFall repaints the board, render() calls findBestHand, and
  // findBestHand scores candidate hands. So the old reconcile could snap the chips
  // to some other hand's numbers - measured at 228 pips on a hand worth 226.
  const _finalPips = (typeof _ledger.finalPips === 'number') ? _ledger.finalPips : lastCalcPips;
  const _finalMult = (typeof _ledger.finalMult === 'number') ? _ledger.finalMult : lastCalcMult;
  // The walk above applies the same operations in the same order as calcScore, so
  // this should be a no-op. It is kept as a safety net - and as an alarm: if the
  // timeline ever stops describing the real arithmetic, a beat is silently lying
  // to the player, and the only visible symptom is a snap at this line.
  if(typeof devMode !== 'undefined' && devMode && !skipBeats){
    const _dp = Math.abs(rp - _finalPips), _dm = Math.abs(rm - _finalMult);
    if(_dp > 0.5 || _dm > 0.05) console.warn('[DANCE] timeline drift - pips', rp, 'vs', _finalPips, '| mult', rm, 'vs', _finalMult,
      '| seeded', _ledger.basePips, 'x', _ledger.baseMult, '|', timeline.map(e=>`${e.card>=0?'c'+e.card:'H'} ${e.id} ${e.op} ${e.value}`).join(' , '));
  }
  rp = _finalPips; rm = _finalMult;
  if(pipsEl) pipsEl.textContent = Math.round(_finalPips);
  if(multEl) multEl.textContent = fmtM(Math.round(_finalMult*10)/10);

  // ── PMF merge ── all three chips have landed on their totals, so they stop
  // being three numbers and become one: this hand's score. Jitter, fuse, then
  // let the SCORE climb below run against the fused chip. (js/pmf-merge.js)
  if(typeof pmfMergeIn==='function'){
    const _mspeed = skipBeats ? 3.2 : (dncFF ? DANCE_CFG.ff : dncPace());
    await pmfMergeIn(finalScore, { speed: _mspeed, signal: sig });
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    // ── THE THROW ── the fused chip flies into the SCORE. This beat is never
    // skipped, at any burst depth: it is the one moment that says "this hand
    // made that number, and it went there".
    if(typeof pmfFlyToScore==='function') await pmfFlyToScore({ speed: _mspeed });
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
  }

  // ── SCORE climb ──
  if(scoreEl) scoreEl.textContent=scoreBefore.toLocaleString();
  const climb = skipBeats ? 140
              : (dncFF ? Math.max(120, DANCE_CFG.scoreClimb/DANCE_CFG.ff) : Math.max(120, DANCE_CFG.scoreClimb/dncPace()));
  let goalFlashed=false;
  await new Promise(res=>{ const st=performance.now();
    function tk(now){ if(aborted()){ res(); return; }
      const tt=Math.min((now-st)/climb,1), e=1-Math.pow(1-tt,3);
      const cur=Math.round(scoreBefore+(scoreAfter-scoreBefore)*e);
      if(scoreEl) scoreEl.textContent=cur.toLocaleString();
      if(isGoalHand && !goalFlashed && cur>=roundGoal){ goalFlashed=true; if(typeof flashRoundEnd==='function') flashRoundEnd(); }
      if(typeof sfxScoreTick==='function' && fxRandom()<0.35) sfxScoreTick();
      if(tt<1) requestAnimationFrame(tk); else res(); }
    requestAnimationFrame(tk); });
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── PMF split ── the hand is banked; hand the row back as three chips.
  if(typeof pmfSplitOut==='function') await pmfSplitOut({ speed: dncFF ? DANCE_CFG.ff : dncPace() });
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── Settle (same tail as playScoreDance) ──
  stage.classList.remove('dnc-active'); stage.innerHTML=''; dncCleanupReal();
  if(scoreEl) scoreEl.textContent=scoreAfter.toLocaleString();
  showComboFloats(hand, handCells, result);
  const scoreBoxEl=document.getElementById('score-mid');
  if(scoreBoxEl){ scoreBoxEl.classList.remove('box-popping'); void scoreBoxEl.offsetWidth; scoreBoxEl.classList.add('box-popping'); }
  await wait(300/dncPace()); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  danceAbortController = null;
  dncChain = 0; _dncOutHandScore = 0;   // the burst has landed
  // Normal completion (the abort paths go through handleDanceAbort) - give the
  // portrait strip back to whichever half the player had chosen.
  if (typeof portraitDanceEnd === 'function') portraitDanceEnd();
  if(pipsEl) pipsEl.textContent='0'; if(multEl) multEl.textContent='0';
  if(isGoalHand){ if(score>highestHandScore) highestHandScore=score; if(pendingLevelUps>0) sfxMultiGoal(pendingLevelUps); }
  updateScoreUI();

  if(isGoalHand){
    if(challengeActive){ showMessage('GOAL MET - COMPLETE THE CHALLENGE','#c9a84c'); }
    else {
      // The win finale (jitter → explode → fly) already played BEFORE this
      // tally, up front in the isGoalHand branch. Here we just settle audio and
      // hand off to the interlude.
      clearInterval(roundInterval); roundInterval=null; gameTimerPaused=true; frozenRoundSeconds=roundSeconds;
      sfxVictory(); const ctx=getAudioCtx();
      if(sfxDuckGain){ sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); }
      else { sfxDuckGain=ctx.createGain(); sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime); sfxDuckGain.connect(ctx.destination); }
      // Survival opened its pick during the fly (above); the deal happens when the
      // player chooses. Everyone else hands off to the standard interlude/payout.
      if(!survivalActive()) startInterlude();
    }
  }
}

// ══════════════════════════════════════════════
// DISCARD
// ══════════════════════════════════════════════
